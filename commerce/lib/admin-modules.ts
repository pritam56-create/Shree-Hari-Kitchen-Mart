import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {db,transaction,json} from './db';
import {HttpError,passwordHash,requireAdmin} from './security';
import {AdminMember,canAdmin,reauthenticate,requestMeta,securityEvent} from './admin-security';
import {permissionList,roleDefaults} from './permissions';
import {validateContent} from './policy';
import {invoicePDF} from './invoice';
import {productInclude} from './checkout';
import {completeRefund} from './refunds';
const id=z.string().min(1).max(100),text=z.string().trim().min(1),money=z.coerce.number().min(0).max(99999999);
const ok=(data:unknown)=>NextResponse.json(data,{headers:{'Cache-Control':'no-store'}});
const safeUser={id:true,name:true,email:true,phone:true,disabled:true,createdAt:true,roles:true} as const;
const contentKinds:Record<string,string>={banners:'BANNER',blog:'BLOG',homepage:'HOMEPAGE',offers:'OFFER'};
function safeLink(value:string){return !value||(/^\/(?!\/)/.test(value)&&!/[\\\r\n]/.test(value));}
export async function adminModule(req:NextRequest,user:AdminMember,resource:string,resourceId:string|undefined,body:Record<string,unknown>){
 const method=req.method,read=method==='GET',q=(req.nextUrl.searchParams.get('q')||'').slice(0,120);
 if(resource==='refunds'&&body.action==='manual-complete'){
  const v=z.object({id,reference:z.string().regex(/^[a-zA-Z0-9_-]{6,80}$/),confirmTransferred:z.literal(true)}).parse(body);await reauthenticate(user,body.currentPassword);
  const refund=await db.refund.findUniqueOrThrow({where:{id:v.id},include:{payment:true}});if(refund.payment.gateway!=='COD')throw new HttpError(400,'Gateway refunds must be confirmed by the gateway');
  if(!['AWAITING_MANUAL_TRANSFER','PENDING','COMPLETED'].includes(refund.status))throw new HttpError(409,'Refund cannot be manually completed in this state');
  return ok(await completeRefund(refund.id,'manual-'+v.reference,user.id));
 }
 if(resource==='admin-users'){
  requireAdmin(user,true);
  if(read)return ok(await db.user.findMany({where:{roles:{some:{roleId:{not:'CUSTOMER'}}}},select:{...safeUser,adminSessions:{select:{id:true,createdAt:true,lastSeenAt:true,expiresAt:true}}},orderBy:{createdAt:'desc'}}));
  await reauthenticate(user,body.currentPassword);
  const action=z.enum(['create','update','terminate','password']).parse(body.action);
  if(action==='create'){
   const v=z.object({name:text.max(120),email:z.string().email().max(191).transform(s=>s.toLowerCase()),phone:z.string().max(20).optional(),role:z.enum(Object.keys(roleDefaults) as [string,...string[]]),password:z.string().min(16).max(72)}).parse(body);
   if(await db.user.findUnique({where:{email:v.email}}))throw new HttpError(409,'Email already belongs to an account; use a separate staff address');
   const created=await db.user.create({data:{name:v.name,email:v.email,phone:v.phone||null,passwordHash:await passwordHash(v.password),roles:{create:{roleId:v.role}}},select:safeUser});return ok(created);
  }
  const target=id.parse(body.id);if(target===user.id)throw new HttpError(409,'Use your security page to change your own password; another owner must change your access');
  const existing=await db.user.findUnique({where:{id:target},include:{roles:true}});if(!existing||!existing.roles.some(r=>r.roleId in roleDefaults))throw new HttpError(404,'Staff account not found');
  await transaction(async tx=>{
   if(action==='update'){const v=z.object({name:text.max(120),disabled:z.boolean(),role:z.enum(Object.keys(roleDefaults) as [string,...string[]])}).parse(body);await tx.user.update({where:{id:target},data:{name:v.name,disabled:v.disabled}});await tx.userRole.deleteMany({where:{userId:target}});await tx.userRole.create({data:{userId:target,roleId:v.role}});}
   if(action==='password')await tx.user.update({where:{id:target},data:{passwordHash:await passwordHash(z.string().min(16).max(72).parse(body.password))}});
   await tx.adminSession.deleteMany({where:{userId:target}});await tx.session.deleteMany({where:{userId:target}});
  });await securityEvent(req,existing.email,action==='password'?'STAFF_PASSWORD_RESET':'SESSIONS_TERMINATED',existing.id);return ok({ok:true});
 }
 if(resource==='roles'||resource==='permissions'){
  requireAdmin(user,true);
  if(read)return ok({permissions:permissionList,roles:await db.role.findMany({where:{id:{in:Object.keys(roleDefaults)}},include:{permissions:true}})});
  await reauthenticate(user,body.currentPassword);
  const v=z.object({role:z.enum(Object.keys(roleDefaults) as [string,...string[]]),permissions:z.array(z.enum(permissionList))}).parse(body);if(v.role==='SUPER_ADMIN')throw new HttpError(409,'Owner permissions cannot be removed');
  await transaction(async tx=>{await tx.rolePermission.deleteMany({where:{roleId:v.role}});await tx.rolePermission.createMany({data:[...new Set(v.permissions)].map(permissionId=>({roleId:v.role,permissionId}))});});return ok({ok:true});
 }
 if(resource==='audit-logs'){if(!read)throw new HttpError(405,'Audit history is read-only');return ok(await db.auditLog.findMany({where:q?{OR:[{action:{contains:q}},{entityId:{contains:q}}]}:{},include:{actor:{select:{name:true,email:true}}},orderBy:{createdAt:'desc'},take:200}));}
 if(resource==='security'){if(!read)throw new HttpError(405,'Security history is read-only');return ok(await db.adminSecurityEvent.findMany({orderBy:{createdAt:'desc'},take:200}));}
 if(resource==='payments'){
  if(!read)throw new HttpError(405,'Payments can only be changed through verified payment workflows');
  return ok({payments:await db.payment.findMany({where:q?{OR:[{gatewayPaymentId:{contains:q}},{order:{number:{contains:q}}}]}:{},include:{order:{select:{number:true,user:{select:{name:true,email:true}}}},transactions:true,refunds:true},orderBy:{createdAt:'desc'},take:200}),attempts:await db.paymentAttempt.findMany({where:{status:{in:['FAILED','CAPTURED_UNFULFILLED']}},orderBy:{createdAt:'desc'},take:50})});
 }
 if(resource==='invoices'&&resourceId){if(!read)throw new HttpError(405,'GET required');const bytes=await invoicePDF(resourceId,user);return new NextResponse(Buffer.from(bytes),{headers:{'Content-Type':'application/pdf','Content-Disposition':`${req.nextUrl.searchParams.get('view')==='1'?'inline':'attachment'}; filename="invoice-${resourceId}.pdf"`,'Cache-Control':'private, no-store'}});}
 if(resource==='customers'&&resourceId&&read){const customer=await db.user.findUnique({where:{id:resourceId},select:{...safeUser,addresses:true,orders:{include:{items:true,invoice:true,returns:{include:{refund:true}}}},reviews:true,wishlist:{include:{items:{include:{product:{select:{name:true}}}}}},tickets:{include:{messages:true}},notifications:true}});if(!customer)throw new HttpError(404,'Customer not found');return ok(customer);}
 if(resource==='warehouses'){
  if(read)return ok(await db.warehouse.findMany({include:{_count:{select:{inventory:true}}}}));
  const v=z.object({id:z.string().regex(/^[a-zA-Z0-9_-]{1,30}$/),name:text.max(100)}).parse(body);validateContent(v,true);return ok(await db.warehouse.upsert({where:{id:v.id},create:v,update:{name:v.name}}));
 }
 if(resource==='transfers'){
  if(read)throw new HttpError(405,'POST required');
  const v=z.object({inventoryId:id,warehouseId:id,quantity:z.coerce.number().int().positive().max(100000),reason:text.max(200)}).parse(body);
  return ok(await transaction(async tx=>{const source=await tx.inventory.findUniqueOrThrow({where:{id:v.inventoryId}});if(source.warehouseId===v.warehouseId)throw new HttpError(400,'Choose a different destination warehouse');const changed=await tx.inventory.updateMany({where:{id:source.id,quantity:{gte:source.reserved+v.quantity}},data:{quantity:{decrement:v.quantity}}});if(!changed.count)throw new HttpError(409,'Insufficient unreserved stock');const dest=await tx.inventory.upsert({where:{variantId_warehouseId:{variantId:source.variantId,warehouseId:v.warehouseId}},create:{variantId:source.variantId,warehouseId:v.warehouseId,quantity:v.quantity},update:{quantity:{increment:v.quantity}}});const reference=crypto.randomUUID();await tx.inventoryMovement.createMany({data:[{inventoryId:source.id,delta:-v.quantity,reason:'TRANSFER_OUT: '+v.reason,reference,actorId:user.id},{inventoryId:dest.id,delta:v.quantity,reason:'TRANSFER_IN: '+v.reason,reference,actorId:user.id}]});return {ok:true};}));
 }
 if(resource==='variants'){
  if(read)return ok(await db.productVariant.findMany({where:{productId:id.parse(req.nextUrl.searchParams.get('productId'))},include:{inventory:true}}));
  const v=z.object({id:id.optional(),productId:id,sku:text.max(100),name:text.max(100),price:money.positive(),mrp:money.positive(),gstRate:z.coerce.number().min(0).max(28),capacity:z.string().max(80),wattage:z.coerce.number().int().min(0).max(100000),material:z.string().max(80),active:z.boolean(),vegetarianConfirmed:z.literal(true)}).parse(body);if(v.price>v.mrp)throw new HttpError(400,'Selling price cannot exceed MRP');validateContent({name:v.name,sku:v.sku,capacity:v.capacity,material:v.material},true);const {id:variantId,vegetarianConfirmed,...data}=v;
  if(variantId){const existing=await db.productVariant.findUnique({where:{id:variantId}});if(existing?.productId!==v.productId)throw new HttpError(404,'Variant not found');return ok(await db.productVariant.update({where:{id:variantId},data}));}
  return ok(await db.productVariant.create({data:{...data,inventory:{create:{warehouseId:'MAIN'}}}}));
 }
 if(resource==='specifications'){
  if(read)throw new HttpError(405,'POST required');
  const v=z.object({productId:id,items:z.array(z.object({name:text.max(100),value:text.max(300)})).max(60),vegetarianConfirmed:z.literal(true)}).parse(body);validateContent(v.items,true);if(new Set(v.items.map(i=>i.name)).size!==v.items.length)throw new HttpError(400,'Specification names must be unique');return ok(await transaction(async tx=>{await tx.productSpecification.deleteMany({where:{productId:v.productId}});await tx.productSpecification.createMany({data:v.items.map(i=>({...i,productId:v.productId}))});return {ok:true};}));
 }
 if(resource==='products'&&body.action==='duplicate'){
  const original=await db.product.findUniqueOrThrow({where:{id:id.parse(resourceId)},include:{variants:true,specifications:true,images:true}});validateContent({name:original.name,description:original.description,specifications:original.specifications,images:original.images},true);
  const suffix=crypto.randomUUID().slice(0,8),{id:ignored,createdAt,updatedAt,variants,specifications,images,...data}=original;
  return ok(await db.product.create({data:{...data,name:original.name.slice(0,165)+' (copy)',slug:original.slug.slice(0,175)+'-'+suffix,active:false,contentReviewedBy:user.id,variants:{create:variants.map(({id,productId,...v})=>({...v,sku:v.sku.slice(0,90)+'-'+suffix,inventory:{create:{warehouseId:'MAIN',quantity:0}}}))},specifications:{create:specifications.map(s=>({name:s.name,value:s.value}))},images:{create:images.map(i=>({url:i.url,alt:i.alt,reviewedBy:user.id}))}}}));
 }
 if(resource==='questions'){
  if(read)return ok(await db.question.findMany({include:{product:{select:{name:true}},user:{select:{name:true}},answers:true},orderBy:{createdAt:'desc'},take:200}));
  const v=z.object({questionId:id,body:text.max(4000)}).parse(body);validateContent(v.body,true);return ok(await db.answer.create({data:{...v,actorId:user.id}}));
 }
 if(resource in contentKinds){
  const kind=contentKinds[resource];
  if(read)return ok(await db.contentEntry.findMany({where:{kind},orderBy:[{priority:'asc'},{createdAt:'desc'}]}));
  if(method==='DELETE'){await db.contentEntry.deleteMany({where:{id:id.parse(body.id),kind}});return ok({ok:true});}
  const v=z.object({id:id.optional(),slug:z.string().regex(/^[a-z0-9-]{1,180}$/),title:text.max(180),body:z.string().max(20000),imageUrl:z.string().max(1000).default(''),mobileImageUrl:z.string().max(1000).default(''),ctaText:z.string().max(100).default(''),ctaLink:z.string().max(500).default(''),priority:z.coerce.number().int().min(0).max(9999),active:z.boolean(),startsAt:z.string().datetime().nullable(),endsAt:z.string().datetime().nullable(),vegetarianConfirmed:z.literal(true),imageReviewed:z.boolean()}).parse(body);
  validateContent({title:v.title,body:v.body,imageUrl:v.imageUrl,mobileImageUrl:v.mobileImageUrl,ctaText:v.ctaText,ctaLink:v.ctaLink},true,!(v.imageUrl||v.mobileImageUrl)||v.imageReviewed);
  for(const url of [v.imageUrl,v.mobileImageUrl])if(url&&(!URL.canParse(url)||new URL(url).protocol!=='https:'))throw new HttpError(400,'Images require HTTPS URLs');
  if(!safeLink(v.ctaLink))throw new HttpError(400,'Choose a store-relative link such as /search');if(v.startsAt&&v.endsAt&&v.endsAt<=v.startsAt)throw new HttpError(400,'End time must be after start time');
  const {id:entryId,vegetarianConfirmed,imageReviewed,...data}=v;
  if(entryId){const result=await db.contentEntry.updateMany({where:{id:entryId,kind},data:{...data,reviewedBy:user.id}});if(!result.count)throw new HttpError(404,'Content not found');return ok({ok:true});}
  return ok(await db.contentEntry.create({data:{...data,kind,reviewedBy:user.id}}));
 }
 if(resource==='analytics'||resource==='reports'){
  if(!read)throw new HttpError(405,'Reports are read-only');
  const days=z.coerce.number().int().min(1).max(366).parse(req.nextUrl.searchParams.get('days')||30),since=new Date(Date.now()-days*86400000);
  const orders=await db.order.findMany({where:{createdAt:{gte:since}},include:{items:true,payment:true},orderBy:{createdAt:'asc'}});
  const daily:Record<string,{date:string;orders:number;revenue:number;tax:number;refunds:number}>={};const methods:Record<string,number>={},top:Record<string,{name:string;quantity:number;revenue:number}>={};
  for(const o of orders){const date=o.createdAt.toISOString().slice(0,10),d=daily[date]??={date,orders:0,revenue:0,tax:0,refunds:0};d.orders++;if(o.paymentStatus==='PAID'){d.revenue+=Number(o.total);d.tax+=Number(o.tax);methods[o.paymentMethod]=(methods[o.paymentMethod]||0)+Number(o.total);for(const i of o.items){const t=top[i.productId]??={name:i.name,quantity:0,revenue:0};t.quantity+=i.quantity;t.revenue+=Number(i.unitPrice)*i.quantity-Number(i.discount);}}}
  const completed=await db.refund.findMany({where:{status:'COMPLETED',updatedAt:{gte:since}}});for(const r of completed){const date=r.updatedAt.toISOString().slice(0,10),d=daily[date]??={date,orders:0,revenue:0,tax:0,refunds:0};d.refunds+=Number(r.amount);}
  const rows=Object.values(daily).sort((a,b)=>a.date.localeCompare(b.date));
  if(req.nextUrl.searchParams.get('format')==='csv'){const csv=['Date,Orders,Gross collections,GST included,Completed refunds',...rows.map(r=>[r.date,r.orders,r.revenue.toFixed(2),r.tax.toFixed(2),r.refunds.toFixed(2)].join(','))].join('\r\n');return new NextResponse(csv,{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="sales-report.csv"','Cache-Control':'private, no-store'}});}
  return ok({days,daily:rows,methods,topProducts:Object.values(top).sort((a,b)=>b.revenue-a.revenue).slice(0,20),orders:orders.length,grossCollections:rows.reduce((s,r)=>s+r.revenue,0),completedRefunds:completed.reduce((s,r)=>s+Number(r.amount),0)});
 }
 if(resource==='search'){
  if(!read)throw new HttpError(405,'GET required');if(q.length<2)return ok([]);
  const results:{label:string;href:string;type:string}[]=[];
  if(canAdmin(user,'products.view'))for(const p of await db.product.findMany({where:{OR:[{name:{contains:q}},{variants:{some:{sku:{contains:q}}}}]},take:8}))results.push({label:p.name,href:'/admin/products/'+p.id,type:'Product'});
  if(canAdmin(user,'orders.view'))for(const o of await db.order.findMany({where:{OR:[{number:{contains:q}},{shipments:{some:{trackingNumber:{contains:q}}}}]},take:8}))results.push({label:o.number,href:'/admin/orders/'+o.id,type:'Order'});
  if(canAdmin(user,'customers.view'))for(const c of await db.user.findMany({where:{roles:{some:{roleId:'CUSTOMER'}},OR:[{name:{contains:q}},{email:{contains:q}},{phone:{contains:q}}]},take:8,select:{id:true,name:true,email:true}}))results.push({label:c.name+' · '+c.email,href:'/admin/customers/'+c.id,type:'Customer'});
  if(canAdmin(user,'invoices.view'))for(const i of await db.invoice.findMany({where:{number:{contains:q}},take:8}))results.push({label:i.number,href:'/api/admin/invoices/'+i.orderId,type:'Invoice'});
  return ok(results);
 }
 if(resource==='notifications'){
  if(!read)throw new HttpError(405,'Notifications are derived from current records');const notices:{title:string;href:string}[]=[];
  if(canAdmin(user,'orders.view'))for(const o of await db.order.findMany({where:{status:{in:['PLACED','PAYMENT_CONFIRMED']}},take:20,orderBy:{createdAt:'desc'}}))notices.push({title:'New order '+o.number,href:'/admin/orders/'+o.id});
  if(canAdmin(user,'support.manage'))for(const t of await db.supportTicket.findMany({where:{status:'OPEN'},take:20}))notices.push({title:'Support: '+t.subject,href:'/admin/support'});
  if(canAdmin(user,'returns.manage'))for(const r of await db.return.findMany({where:{status:'REQUESTED'},take:20,include:{order:true}}))notices.push({title:'Return request '+r.order.number,href:'/admin/returns'});
  if(canAdmin(user,'inventory.view')){const stock=await db.inventory.findMany({include:{variant:true}});for(const i of stock.filter(i=>i.quantity-i.reserved<=i.lowStock).slice(0,20))notices.push({title:'Low stock: '+i.variant.sku,href:'/admin/inventory'});}
  return ok(notices);
 }
 return null;
}
