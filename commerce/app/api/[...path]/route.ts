import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {Prisma} from '@prisma/client';
import {db,transaction,json} from '../../../lib/db';
import {HttpError,checkOrigin,userFor,requireAdmin,rateLimit,passwordHash,passwordMatches,sessionResponse,token,hash,verifyHmac} from '../../../lib/security';
import {validateContent} from '../../../lib/policy';
import {cartQuote,startCheckout,confirmCheckout,productInclude,releaseExpired} from '../../../lib/checkout';
import {gatewayReady,verifyPayment,razorpay} from '../../../lib/payments';
import {paise,rupees,checkTransition} from '../../../lib/money';
import {invoicePDF} from '../../../lib/invoice';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const text=z.string().trim().min(1).max(500),id=z.string().min(1).max(100),password=z.string().min(12).max(72);
const addressSchema=z.object({name:text.max(120),phone:z.string().regex(/^\+?[0-9]{10,15}$/),line1:text.max(200),line2:z.string().max(200).default(''),city:text.max(100),state:text.max(100),postalCode:z.string().regex(/^[1-9][0-9]{5}$/),country:z.literal('IN').default('IN')});
const variantSchema=z.object({sku:text.max(100),name:text.max(100),price:z.coerce.number().positive().max(99999999),mrp:z.coerce.number().positive().max(99999999),gstRate:z.coerce.number().min(0).max(28),capacity:z.string().max(80).default(''),wattage:z.coerce.number().int().min(0).max(100000).default(0),material:z.string().max(80).default('')}).refine(v=>v.price<=v.mrp,'Sale price cannot exceed MRP');
const productSchema=z.object({name:text.max(180),slug:z.string().regex(/^[a-z0-9-]{1,180}$/),description:text.max(5000),keywords:z.string().max(500).default(''),categoryId:id,brandId:id,warranty:text.max(200),seoTitle:z.string().max(180).default(''),seoDescription:z.string().max(300).default(''),active:z.boolean(),vegetarianConfirmed:z.literal(true),variant:variantSchema.optional()});
const ok=(data:unknown)=>NextResponse.json(data,{headers:{'Cache-Control':'no-store'}});
async function handler(req:NextRequest,{params}:{params:Promise<{path:string[]}>}){
 try{
 const path=(await params).path.join('/'),method=req.method;
 const raw=method==='GET'?'':await req.text();if(raw.length>64000)throw new HttpError(413,'Request too large');
 if(path==='payments/webhook'){
  if(method!=='POST')throw new HttpError(405,'POST required');
  if(!process.env.RAZORPAY_WEBHOOK_SECRET||!verifyHmac(raw,req.headers.get('x-razorpay-signature')||'',process.env.RAZORPAY_WEBHOOK_SECRET))throw new HttpError(400,'Invalid webhook signature');
  const event=JSON.parse(raw),payment=event.payload?.payment?.entity;
  if(payment){const checkout=await db.checkout.findUnique({where:{gatewayOrderId:payment.order_id}});if(checkout){
   if(event.event==='payment.captured'&&payment.currency==='INR'&&payment.amount===paise(checkout.total)){
    try{await confirmCheckout(checkout.id,checkout.userId,payment);}catch(error){await db.paymentAttempt.create({data:{checkoutId:checkout.id,paymentId:payment.id,status:'CAPTURED_UNFULFILLED',failureReason:String(error).slice(0,500)}});await db.outbox.create({data:{kind:'PAYMENT_RECONCILE',payload:json({checkoutId:checkout.id,paymentId:payment.id})}});throw error;}
   }else if(event.event==='payment.failed')await db.paymentAttempt.create({data:{checkoutId:checkout.id,paymentId:payment.id,status:'FAILED',failureReason:String(payment.error_description||'Gateway declined').slice(0,500)}});
  }}return ok({received:true});
 }
 checkOrigin(req);if(method==='GET'&&((path.startsWith('auth/')&&path!=='auth/me')||path==='admin/release-reservations'))throw new HttpError(405,'POST required');const body=raw?JSON.parse(raw):{};
 if(path==='health'){await db.$queryRaw`SELECT 1`;return ok({ok:true,database:'mysql'});}
 if(path==='delivery'&&method==='GET'){const pin=z.string().regex(/^[1-9][0-9]{5}$/).parse(req.nextUrl.searchParams.get('pin'));const config=(await db.siteSetting.findUnique({where:{key:'delivery'}}))?.value as {enabled?:boolean;pinCodes?:string[];standardDays?:string;expressDays?:string}|undefined;return ok({available:Boolean(config?.enabled&&config.pinCodes?.includes(pin)),standardDays:config?.standardDays,expressDays:config?.expressDays});}
 if(path==='settings'&&method==='GET'){return ok({business:(await db.siteSetting.findUnique({where:{key:'business'}}))?.value||{name:'Shree Hari Kitchen Mart'},onlinePayments:gatewayReady(),paymentMode:process.env.RAZORPAY_KEY_ID?.startsWith('rzp_test_')?'TEST':'LIVE'});}
 if(path==='auth/register'){
  const v=z.object({name:text.max(120),email:z.string().email().max(191),phone:z.string().regex(/^\+?[0-9]{10,15}$/).optional(),password}).parse(body);v.email=v.email.toLowerCase();await rateLimit('register:'+v.email,5);
  const user=await db.user.create({data:{name:v.name,email:v.email,phone:v.phone,passwordHash:await passwordHash(v.password),roles:{create:{roleId:'CUSTOMER'}}}});return sessionResponse(user.id);
 }
 if(path==='auth/login'){
  const v=z.object({email:text.max(191),password:z.string().max(72),remember:z.boolean().default(false)}).parse(body);await rateLimit('login:'+v.email.toLowerCase(),10);
  const user=await db.user.findFirst({where:{OR:[{email:v.email.toLowerCase()},{phone:v.email}]}});
  if(!user||user.disabled||!await passwordMatches(v.password,user.passwordHash))throw new HttpError(401,'Invalid email, phone or password');return sessionResponse(user.id,v.remember);
 }
 if(path==='auth/logout'){const raw=req.cookies.get('shk_session')?.value;if(raw)await db.session.deleteMany({where:{id:hash(raw)}});const res=ok({ok:true});res.cookies.delete('shk_session');return res;}
 if(path==='auth/me'){const u=await userFor(req,false);return ok(u?{id:u.id,name:u.name,email:u.email,roles:u.roles.map(r=>r.roleId)}:null);}
 if(path==='auth/forgot'){
  const email=z.string().email().parse(body.email).toLowerCase();await rateLimit('reset:'+email,3);const u=await db.user.findUnique({where:{email}});
  if(u){const rawToken=token();await db.authToken.create({data:{id:hash(rawToken),userId:u.id,purpose:'RESET',expiresAt:new Date(Date.now()+1800000)}});await db.outbox.create({data:{kind:'RESET_EMAIL',payload:json({email,url:`${process.env.APP_URL}/reset-password?token=${rawToken}`})}});}
  return ok({message:'If the account exists, password reset instructions have been queued.'});
 }
 if(path==='auth/reset'){
  const v=z.object({token:id,password}).parse(body);const hashed=await passwordHash(v.password);
  await transaction(async tx=>{const t=await tx.authToken.findUnique({where:{id:hash(v.token)}});if(!t||t.purpose!=='RESET'||t.expiresAt<new Date())throw new HttpError(400,'Invalid or expired reset link');await tx.user.update({where:{id:t.userId},data:{passwordHash:hashed}});await tx.authToken.deleteMany({where:{userId:t.userId,purpose:'RESET'}});await tx.session.deleteMany({where:{userId:t.userId}});});return ok({ok:true});
 }
 if(['categories','brands'].includes(path)&&method==='GET')return ok(path==='categories'?await db.category.findMany({orderBy:{name:'asc'}}):await db.brand.findMany({orderBy:{name:'asc'}}));
 if(path==='products'&&method==='GET'){
  const p=req.nextUrl.searchParams,q=(p.get('q')||'').slice(0,100);
  const where:Prisma.ProductWhereInput={active:true,...(q?{OR:[{name:{contains:q}},{keywords:{contains:q}},{brand:{name:{contains:q}}},{category:{name:{contains:q}}},{variants:{some:{sku:{contains:q}}}}]}:{}),...(p.get('category')?{category:{slug:p.get('category')!}}:{}),...(p.get('brand')?{brand:{slug:p.get('brand')!}}:{}),variants:{some:{active:true,...(p.get('min')||p.get('max')?{price:{gte:Number(p.get('min')||0),lte:Number(p.get('max')||99999999)}}:{}),...(p.get('capacity')?{capacity:{contains:p.get('capacity')!}}:{}),...(p.get('material')?{material:{contains:p.get('material')!}}:{}),...(p.get('wattage')?{wattage:{lte:Number(p.get('wattage'))}}:{})}}};
  const products=await db.product.findMany({where,include:productInclude,take:200,orderBy:{createdAt:'desc'}});
  let result=products.filter(p1=>!p.get('stock')||p1.variants.some(v=>v.inventory.some(i=>i.quantity>i.reserved)));
  if(p.get('rating'))result=result.filter(p1=>p1.reviews.length&&p1.reviews.reduce((a,r)=>a+r.rating,0)/p1.reviews.length>=Number(p.get('rating')));
  if(p.get('discount'))result=result.filter(p1=>p1.variants.some(v=>(Number(v.mrp)-Number(v.price))/Number(v.mrp)*100>=Number(p.get('discount'))));
  if(p.get('sort')==='price-asc'||p.get('sort')==='price-desc')result.sort((a,b)=>(Math.min(...a.variants.map(v=>Number(v.price)))-Math.min(...b.variants.map(v=>Number(v.price))))*(p.get('sort')==='price-desc'?-1:1));
  return ok(result);
 }
 if(path.startsWith('products/')&&method==='GET'){const product=await db.product.findUnique({where:{slug:path.split('/')[1]},include:productInclude});if(!product?.active)throw new HttpError(404,'Product not found');return ok(product);}
 const user=(await userFor(req))!;
 if(path==='auth/password'){const v=z.object({current:z.string(),password}).parse(body);if(!await passwordMatches(v.current,user.passwordHash))throw new HttpError(400,'Current password is incorrect');await transaction(async tx=>{await tx.user.update({where:{id:user.id},data:{passwordHash:await passwordHash(v.password)}});await tx.session.deleteMany({where:{userId:user.id}});});return ok({ok:true});}
 if(path==='addresses'){
  if(method==='GET')return ok(await db.address.findMany({where:{userId:user.id}}));
  if(method==='DELETE'){await db.address.deleteMany({where:{id:id.parse(body.id),userId:user.id}});return ok({ok:true});}
  const data=addressSchema.parse(body);if(body.id){const result=await db.address.updateMany({where:{id:id.parse(body.id),userId:user.id},data});if(!result.count)throw new HttpError(404,'Address not found');return ok({ok:true});}return ok(await db.address.create({data:{...data,userId:user.id}}));
 }
 if(path==='cart'){
  const cart=await db.cart.upsert({where:{userId:user.id},create:{userId:user.id},update:{}});
  if(method==='GET')return ok(await db.cartItem.findMany({where:{cartId:cart.id},include:{variant:{include:{product:{include:{images:true}},inventory:true}}}}));
  if(method==='DELETE'){await db.cartItem.deleteMany({where:{cartId:cart.id,...(body.variantId?{variantId:id.parse(body.variantId)}:{})}});return ok({ok:true});}
  const v=z.object({variantId:id,quantity:z.number().int().min(0).max(20),saved:z.boolean().default(false)}).parse(body);
  if(!v.quantity){await db.cartItem.deleteMany({where:{cartId:cart.id,variantId:v.variantId}});return ok({ok:true});}
  const variant=await db.productVariant.findUnique({where:{id:v.variantId},include:{product:true,inventory:true}});
  if(!variant?.active||!variant.product.active||variant.inventory.reduce((s,i)=>s+i.quantity-i.reserved,0)<v.quantity)throw new HttpError(409,'Requested quantity is unavailable');
  return ok(await db.cartItem.upsert({where:{cartId_variantId:{cartId:cart.id,variantId:v.variantId}},create:{cartId:cart.id,...v},update:{quantity:v.quantity,saved:v.saved}}));
 }
 if(path==='cart/merge'){
  const items=z.array(z.object({variantId:id,quantity:z.number().int().min(1).max(20)})).max(50).parse(body.items);
  await transaction(async tx=>{const cart=await tx.cart.upsert({where:{userId:user.id},create:{userId:user.id},update:{}});for(const item of items){const variant=await tx.productVariant.findUnique({where:{id:item.variantId},include:{product:true,inventory:true}});if(!variant?.active||!variant.product.active)continue;const existing=await tx.cartItem.findUnique({where:{cartId_variantId:{cartId:cart.id,variantId:item.variantId}}});const quantity=Math.min(20,(existing?.quantity||0)+item.quantity,variant.inventory.reduce((s,i)=>s+i.quantity-i.reserved,0));if(quantity)await tx.cartItem.upsert({where:{cartId_variantId:{cartId:cart.id,variantId:item.variantId}},create:{cartId:cart.id,variantId:item.variantId,quantity},update:{quantity}});}});return ok({ok:true});
 }
 if(path==='cart/quote')return ok(await cartQuote(user.id,String(body.code||''),String(body.delivery||'STANDARD')));
 if(path==='wishlist'){
  const list=await db.wishlist.upsert({where:{userId:user.id},create:{userId:user.id},update:{}});
  if(method==='GET')return ok(await db.wishlistItem.findMany({where:{wishlistId:list.id},include:{product:{include:productInclude}}}));
  const productId=id.parse(body.productId);if(method==='DELETE'){await db.wishlistItem.deleteMany({where:{wishlistId:list.id,productId}});return ok({ok:true});}
  return ok(await db.wishlistItem.upsert({where:{wishlistId_productId:{wishlistId:list.id,productId}},create:{wishlistId:list.id,productId},update:{}}));
 }
 if(path==='compare')return ok(await transaction(async tx=>{
  const list=await tx.compareList.upsert({where:{userId:user.id},create:{userId:user.id},update:{}});
  if(method==='GET')return tx.compareItem.findMany({where:{compareListId:list.id},include:{product:{include:productInclude}}});
  const productId=id.parse(body.productId);if(method==='DELETE'){await tx.compareItem.deleteMany({where:{compareListId:list.id,productId}});return {ok:true};}
  if(await tx.compareItem.count({where:{compareListId:list.id}})>=4)throw new HttpError(400,'Compare up to four products');return tx.compareItem.upsert({where:{compareListId_productId:{compareListId:list.id,productId}},create:{compareListId:list.id,productId},update:{}});
 }));
 if(path==='checkout'){
  const input=z.object({addressId:id,code:z.string().max(40).default(''),delivery:z.enum(['STANDARD','EXPRESS']),gateway:z.enum(['COD','RAZORPAY']),requestKey:z.string().uuid()}).parse(body);
  if(input.gateway==='RAZORPAY'&&!gatewayReady())throw new HttpError(503,'Payment provider is not configured');return ok(await startCheckout(user.id,input));
 }
 if(path==='payments/verify'){
  const v=z.object({checkoutId:id,razorpay_payment_id:id,razorpay_signature:z.string().length(64)}).parse(body);const c=await db.checkout.findFirst({where:{id:v.checkoutId,userId:user.id}});if(!c?.gatewayOrderId)throw new HttpError(404,'Checkout not found');
  let verified=false;
  try{const payment=await verifyPayment(c.gatewayOrderId,v.razorpay_payment_id,v.razorpay_signature,paise(c.total));verified=true;return ok({order:await confirmCheckout(c.id,user.id,payment)});}
  catch(error){await db.paymentAttempt.create({data:{checkoutId:c.id,paymentId:v.razorpay_payment_id,status:verified?'CAPTURED_UNFULFILLED':'VERIFICATION_FAILED',failureReason:String(error).slice(0,500)}});if(verified)await db.outbox.create({data:{kind:'PAYMENT_RECONCILE',payload:json({checkoutId:c.id,paymentId:v.razorpay_payment_id})}});throw error;}
 }
 if(path==='orders'&&method==='GET')return ok(await db.order.findMany({where:{userId:user.id},include:{items:true,invoice:true},orderBy:{createdAt:'desc'}}));
 if(path.startsWith('orders/')){
  const parts=path.split('/'),orderId=parts[1];
  if(parts[2]==='invoice'){const bytes=await invoicePDF(orderId,user);return new NextResponse(Buffer.from(bytes),{headers:{'Content-Type':'application/pdf','Content-Disposition':`attachment; filename="invoice-${orderId}.pdf"`,'Cache-Control':'private, no-store'}});}
  const order=await db.order.findFirst({where:{id:orderId,userId:user.id},include:{items:true,history:{orderBy:{createdAt:'asc'}},invoice:true,shipments:{include:{tracking:true}},returns:{include:{refund:true}}}});if(!order)throw new HttpError(404,'Order not found');return ok(order);
 }
 if(path==='reviews'){
  if(method==='GET')return ok(await db.review.findMany({where:{userId:user.id},include:{product:true}}));
  const v=z.object({productId:id,rating:z.number().int().min(1).max(5),title:text.max(160),body:text.max(4000)}).parse(body);validateContent({title:v.title,body:v.body},true);
  const purchased=await db.orderItem.findFirst({where:{productId:v.productId,order:{userId:user.id,status:'DELIVERED',paymentStatus:'PAID'}}});if(!purchased)throw new HttpError(403,'Reviews require a delivered, paid purchase');
  return ok(await db.review.create({data:{...v,userId:user.id,verified:true}}));
 }
 if(path==='questions'){const v=z.object({productId:id,body:text.max(2000)}).parse(body);validateContent(v.body,true);return ok(await db.question.create({data:{...v,userId:user.id}}));}
 if(path==='support'){
  if(method==='GET')return ok(await db.supportTicket.findMany({where:{userId:user.id},include:{messages:{orderBy:{createdAt:'asc'}}},orderBy:{updatedAt:'desc'}}));
  const v=z.object({subject:text.max(180),body:text.max(4000)}).parse(body);return ok(await db.supportTicket.create({data:{userId:user.id,subject:v.subject,messages:{create:{authorId:user.id,body:v.body}}}}));
 }
 if(path.startsWith('support/')){const ticketId=path.split('/')[1];if(!await db.supportTicket.findFirst({where:{id:ticketId,userId:user.id}}))throw new HttpError(404,'Ticket not found');return ok(await db.supportMessage.create({data:{ticketId,authorId:user.id,body:text.max(4000).parse(body.body)}}));}
 if(path==='notifications'){if(method==='GET')return ok(await db.notification.findMany({where:{userId:user.id},orderBy:{createdAt:'desc'}}));await db.notification.updateMany({where:{id:id.parse(body.id),userId:user.id},data:{readAt:new Date()}});return ok({ok:true});}
 if(path==='returns'){
  if(method==='GET')return ok(await db.return.findMany({where:{order:{userId:user.id}},include:{items:true,refund:true,order:{select:{number:true}}}}));
  const v=z.object({orderId:id,reason:text,resolution:z.enum(['REFUND','REPLACEMENT']).default('REFUND'),items:z.array(z.object({orderItemId:id,quantity:z.number().int().positive()})).min(1).max(50)}).parse(body);
  return ok(await transaction(async tx=>{const order=await tx.order.findFirst({where:{id:v.orderId,userId:user.id,status:'DELIVERED'},include:{items:true,history:{where:{status:'DELIVERED'},orderBy:{createdAt:'desc'},take:1}}});if(!order||!order.history[0]||Date.now()-order.history[0].createdAt.getTime()>7*86400000)throw new HttpError(400,'Returns are available within seven days of delivery');if(new Set(v.items.map(i=>i.orderItemId)).size!==v.items.length)throw new HttpError(400,'Duplicate return items');
  for(const item of v.items){const original=order.items.find(i=>i.id===item.orderItemId);const previous=await tx.returnItem.aggregate({where:{orderItemId:item.orderItemId,return:{status:{not:'REJECTED'}}},_sum:{quantity:true}});if(!original||item.quantity+(previous._sum.quantity||0)>original.quantity)throw new HttpError(400,'Invalid return quantity');}
  await tx.orderStatusHistory.create({data:{orderId:order.id,status:'RETURN_REQUESTED',note:v.reason,actorId:user.id}});return tx.return.create({data:{orderId:order.id,reason:v.reason,resolution:v.resolution,items:{create:v.items}}});}));
 }
 if(path==='coupons')return ok(await db.coupon.findMany({where:{active:true,expiresAt:{gt:new Date()}}}));
 if(!path.startsWith('admin'))throw new HttpError(404,'Unknown endpoint');
 requireAdmin(user);const resource=path.split('/')[1]||'dashboard',resourceId=path.split('/')[2];
 if(resource==='dashboard'){
  const today=new Date();today.setUTCHours(0,0,0,0);const [revenue,todayRevenue,orders,customers,products,returns,refunds,stock,recent]=await Promise.all([db.order.aggregate({where:{paymentStatus:'PAID'},_sum:{total:true},_avg:{total:true}}),db.order.aggregate({where:{paymentStatus:'PAID',createdAt:{gte:today}},_sum:{total:true}}),db.order.count(),db.user.count(),db.product.count(),db.return.count(),db.refund.aggregate({_sum:{amount:true}}),db.inventory.findMany({include:{variant:{include:{product:true}}}}),db.order.findMany({take:20,orderBy:{createdAt:'desc'}})]);return ok({revenue:revenue._sum.total||0,todayRevenue:todayRevenue._sum.total||0,averageOrderValue:revenue._avg.total||0,orders,customers,products,returns,refunds:refunds._sum.amount||0,lowStock:stock.filter(i=>i.quantity-i.reserved<=i.lowStock),recent});
 }
 if(resource==='products'){
  if(method==='GET')return ok(resourceId?await db.product.findUnique({where:{id:resourceId},include:productInclude}):await db.product.findMany({include:productInclude}));
  if(method==='DELETE'){await db.product.update({where:{id:id.parse(resourceId)},data:{active:false}});await db.auditLog.create({data:{actorId:user.id,action:'PRODUCT_DISABLE',entityId:resourceId!,details:{}}});return ok({ok:true});}
  const v=productSchema.parse(body);validateContent({name:v.name,description:v.description,keywords:v.keywords,warranty:v.warranty,seoTitle:v.seoTitle,seoDescription:v.seoDescription,variant:v.variant},v.vegetarianConfirmed);
  const {variant,...data}=v;
  return ok(await transaction(async tx=>{let result;if(resourceId){result=await tx.product.update({where:{id:resourceId},data:{...data,contentReviewedBy:user.id}});if(variant){const original=await tx.productVariant.findFirst({where:{productId:resourceId},orderBy:{id:'asc'}});if(original)await tx.productVariant.update({where:{id:original.id},data:variant});}}else{if(!variant)throw new HttpError(400,'A product variant is required');result=await tx.product.create({data:{...data,contentReviewedBy:user.id,variants:{create:{...variant,inventory:{create:{warehouseId:'MAIN',quantity:0}}}}}});}await tx.auditLog.create({data:{actorId:user.id,action:'PRODUCT_SAVE',entityId:result.id,details:json(data)}});return result;}));
 }
 if(resource==='delivery'){
  if(method==='GET')return ok((await db.siteSetting.findUnique({where:{key:'delivery'}}))?.value||{});
  const v=z.object({enabled:z.boolean(),pinCodes:z.array(z.string().regex(/^[1-9][0-9]{5}$/)).max(5000),standardDays:text.max(100),expressDays:text.max(100)}).parse(body);
  return ok(await db.siteSetting.upsert({where:{key:'delivery'},create:{key:'delivery',value:v},update:{value:v}}));
 }
 if(resource==='images'){
  if(method==='DELETE'){await db.productImage.delete({where:{id:id.parse(body.id)}});return ok({ok:true});}
  const v=z.object({productId:id,url:z.string().url().max(1000),alt:text.max(250),vegetarianConfirmed:z.literal(true),imageReviewed:z.literal(true)}).parse(body);
  if(!v.url.startsWith('https://'))throw new HttpError(400,'HTTPS image required');validateContent({url:v.url,alt:v.alt},v.vegetarianConfirmed,v.imageReviewed);
  return ok(await db.productImage.create({data:{productId:v.productId,url:v.url,alt:v.alt,reviewedBy:user.id}}));
 }
 if(resource==='categories'||resource==='brands'){
  if(method==='GET')return ok(resource==='categories'?await db.category.findMany():await db.brand.findMany());
  const v=z.object({name:text.max(120),slug:z.string().regex(/^[a-z0-9-]+$/)}).parse(body);validateContent(v,true);return ok(resource==='categories'?await db.category.upsert({where:{slug:v.slug},create:v,update:v}):await db.brand.upsert({where:{slug:v.slug},create:v,update:v}));
 }
 if(resource==='inventory'){
  if(method==='GET')return ok(await db.inventory.findMany({include:{variant:{include:{product:true}},warehouse:true,movements:{orderBy:{createdAt:'desc'},take:20}}}));
  const v=z.object({id,delta:z.number().int().min(-100000).max(100000),reason:text}).parse(body);
  return ok(await transaction(async tx=>{const i=await tx.inventory.findUniqueOrThrow({where:{id:v.id}});if(i.quantity+v.delta<i.reserved)throw new HttpError(409,'Stock cannot fall below reserved quantity');await tx.inventoryMovement.create({data:{inventoryId:i.id,delta:v.delta,reason:v.reason,actorId:user.id}});return tx.inventory.update({where:{id:i.id},data:{quantity:{increment:v.delta}}});}));
 }
 if(resource==='orders'){
  if(method==='GET')return ok(resourceId?await db.order.findUnique({where:{id:resourceId},include:{items:true,history:true,payment:true,shipments:true,user:{select:{name:true,email:true}},invoice:true}}):await db.order.findMany({include:{user:{select:{name:true,email:true}},invoice:true},orderBy:{createdAt:'desc'}}));
  const v=z.object({status:z.enum(['PROCESSING','PACKED','SHIPPED','OUT_FOR_DELIVERY','DELIVERED','CANCELLED']),note:z.string().max(500).default(''),carrier:z.string().max(100).optional(),trackingNumber:z.string().max(100).optional(),codCollected:z.boolean().default(false)}).parse(body);
  return ok(await transaction(async tx=>{const order=await tx.order.findUniqueOrThrow({where:{id:resourceId},include:{items:true,payment:true}});checkTransition(order.status,v.status);
   if(v.status==='SHIPPED'){if(!v.carrier||!v.trackingNumber)throw new HttpError(400,'Carrier and tracking number required');await tx.shipment.create({data:{orderId:order.id,carrier:v.carrier,trackingNumber:v.trackingNumber,tracking:{create:{status:'SHIPPED',description:v.note||'Handed to carrier'}}}});}
   if(v.status==='DELIVERED'&&order.paymentMethod==='COD'){if(!v.codCollected)throw new HttpError(400,'Confirm cash was collected');await tx.payment.update({where:{orderId:order.id},data:{status:'CAPTURED'}});await tx.paymentTransaction.create({data:{paymentId:order.payment!.id,externalId:`cod-${order.id}`,kind:'COD_COLLECTION',amount:order.total}});}
   if(v.status==='CANCELLED'&&!order.stockRestored){for(const item of order.items){const inv=await tx.inventory.findFirstOrThrow({where:{variantId:item.variantId}});await tx.inventory.update({where:{id:inv.id},data:{quantity:{increment:item.quantity}}});await tx.inventoryMovement.create({data:{inventoryId:inv.id,delta:item.quantity,reason:'CANCELLATION',reference:order.id,actorId:user.id}});}if(order.paymentStatus==='PAID')await tx.outbox.create({data:{kind:'CANCEL_REFUND',payload:json({orderId:order.id,paymentId:order.payment?.gatewayPaymentId})}});}
   await tx.orderStatusHistory.create({data:{orderId:order.id,status:v.status,note:v.note,actorId:user.id}});await tx.notification.create({data:{userId:order.userId,title:`Order ${order.number}: ${v.status.replaceAll('_',' ')}`,body:v.note||'Your order status has changed.'}});
   return tx.order.update({where:{id:order.id},data:{status:v.status,...(v.status==='CANCELLED'?{stockRestored:true}:{}),...(v.status==='DELIVERED'&&order.paymentMethod==='COD'?{paymentStatus:'PAID'}:{})}});
  }));
 }
 if(resource==='customers'){
  if(method==='GET')return ok(await db.user.findMany({select:{id:true,name:true,email:true,phone:true,disabled:true,createdAt:true,roles:true}}));
  requireAdmin(user,true);const v=z.object({id,disabled:z.boolean()}).parse(body);if(v.id===user.id)throw new HttpError(400,'Cannot disable your own account');await db.user.update({where:{id:v.id},data:{disabled:v.disabled}});await db.session.deleteMany({where:{userId:v.id}});return ok({ok:true});
 }
 if(resource==='reviews'){
  if(method==='GET')return ok(await db.review.findMany({include:{product:true,user:{select:{name:true}}}}));
  const v=z.object({id,status:z.enum(['APPROVED','REJECTED'])}).parse(body);return ok(await db.review.update({where:{id:v.id},data:{status:v.status}}));
 }
 if(resource==='support'){
  if(method==='GET')return ok(await db.supportTicket.findMany({include:{user:{select:{name:true,email:true}},messages:{orderBy:{createdAt:'asc'}}},orderBy:{updatedAt:'desc'}}));
  const v=z.object({id,body:text.max(4000),status:z.enum(['OPEN','WAITING_CUSTOMER','RESOLVED']).default('WAITING_CUSTOMER')}).parse(body);
  return ok(await transaction(async tx=>{await tx.supportMessage.create({data:{ticketId:v.id,authorId:user.id,staff:true,body:v.body}});const t=await tx.supportTicket.update({where:{id:v.id},data:{status:v.status}});await tx.notification.create({data:{userId:t.userId,title:'Support replied',body:v.body}});return t;}));
 }
 if(resource==='coupons'){
  if(method==='GET')return ok(await db.coupon.findMany());
  const v=z.object({code:z.string().regex(/^[A-Z0-9_-]{3,40}$/),type:z.enum(['FIXED','PERCENT']),value:z.coerce.number().positive(),minimum:z.coerce.number().nonnegative().default(0),maximum:z.coerce.number().positive().nullable().default(null),expiresAt:z.coerce.date(),usageLimit:z.coerce.number().int().positive(),perCustomerLimit:z.coerce.number().int().positive(),active:z.boolean(),restrictions:z.object({products:z.array(id).optional(),categories:z.array(id).optional(),brands:z.array(id).optional()}).default({})}).parse(body);
  if(v.type==='PERCENT'&&v.value>100)throw new HttpError(400,'Percentage cannot exceed 100');return ok(await db.coupon.upsert({where:{code:v.code},create:v,update:v}));
 }
 if(resource==='settings'){
  if(method==='GET')return ok((await db.siteSetting.findUnique({where:{key:'business'}}))?.value||{});
  requireAdmin(user,true);const v=z.object({name:text.max(120),address:text.max(500),gstin:z.string().max(30),supportEmail:z.string().email()}).parse(body);validateContent(v,true);return ok(await db.siteSetting.upsert({where:{key:'business'},create:{key:'business',value:v},update:{value:v}}));
 }
 if(resource==='returns'){
  if(method==='GET')return ok(await db.return.findMany({include:{order:true,items:{include:{orderItem:true}},refund:true}}));
  const v=z.object({id,status:z.enum(['APPROVED','REJECTED','MORE_INFO','SCHEDULED','RECEIVED']),note:text,restock:z.boolean().default(false)}).parse(body);
  return ok(await transaction(async tx=>{const r=await tx.return.findUniqueOrThrow({where:{id:v.id},include:{items:{include:{orderItem:true}}}});const allowed:Record<string,string[]>={REQUESTED:['APPROVED','REJECTED','MORE_INFO'],MORE_INFO:['APPROVED','REJECTED'],APPROVED:['SCHEDULED','RECEIVED'],SCHEDULED:['RECEIVED']};if(!allowed[r.status]?.includes(v.status))throw new HttpError(409,'Invalid return transition');if(v.status==='RECEIVED'&&v.restock)for(const item of r.items){if(!item.restocked){const inv=await tx.inventory.findFirstOrThrow({where:{variantId:item.orderItem.variantId}});await tx.inventory.update({where:{id:inv.id},data:{quantity:{increment:item.quantity}}});await tx.inventoryMovement.create({data:{inventoryId:inv.id,delta:item.quantity,reason:'RETURN_RESTOCK',reference:r.id,actorId:user.id}});await tx.returnItem.update({where:{id:item.id},data:{restocked:true}});}}await tx.orderStatusHistory.create({data:{orderId:r.orderId,status:`RETURN_${v.status}`,note:v.note,actorId:user.id}});return tx.return.update({where:{id:r.id},data:{status:v.status,note:v.note}});}));
 }
 if(resource==='refunds'){
  if(method==='GET')return ok(await db.refund.findMany({include:{return:true}}));
  const returnId=id.parse(body.returnId);const refund=await transaction(async tx=>{const r=await tx.return.findUniqueOrThrow({where:{id:returnId},include:{refund:true,items:{include:{orderItem:true}},order:{include:{payment:true}}}});if(r.refund)return r.refund;if(r.status!=='RECEIVED'||!r.order.payment||r.order.payment.status!=='CAPTURED')throw new HttpError(409,'Receive the return and confirm payment before refunding');const amount=r.items.reduce((s,i)=>s+paise(i.orderItem.unitPrice)*i.quantity-Math.round(paise(i.orderItem.discount)*i.quantity/i.orderItem.quantity),0);if(paise(r.order.payment.refunded)+amount>paise(r.order.payment.amount))throw new HttpError(409,'Refund exceeds captured amount');await tx.payment.update({where:{id:r.order.payment.id},data:{refunded:{increment:rupees(amount)}}});return tx.refund.create({data:{returnId,paymentId:r.order.payment.id,amount:rupees(amount)}});});
  if(refund.gatewayRefundId)return ok(refund);
  const p=await db.payment.findUniqueOrThrow({where:{id:refund.paymentId}});if(p.gateway!=='RAZORPAY'||!p.gatewayPaymentId)throw new HttpError(409,'A manual bank refund reference must be recorded for cash payments');
  const claimed=await db.refund.updateMany({where:{id:refund.id,status:'PENDING'},data:{status:'SUBMITTING'}});
  if(!claimed.count)throw new HttpError(409,'This refund has already been submitted or needs reconciliation. Do not submit it again.');
  let result;try{result=await razorpay(`payments/${encodeURIComponent(p.gatewayPaymentId)}/refund`,{amount:paise(refund.amount),receipt:refund.id,notes:{refundId:refund.id}});}catch(error){await db.refund.update({where:{id:refund.id},data:{status:'RECONCILIATION_REQUIRED',failureReason:'Provider outcome unknown; verify the gateway before retrying.'}});throw error;}
  return ok(await db.refund.update({where:{id:refund.id},data:{gatewayRefundId:result.id,status:result.status==='processed'?'COMPLETED':'PROCESSING'}}));
 }
 if(resource==='invoices')return ok(await db.invoice.findMany({include:{order:{select:{number:true,userId:true,total:true}}},orderBy:{createdAt:'desc'}}));
 if(resource==='outbox'&&method==='GET')return ok(await db.outbox.findMany({select:{id:true,kind:true,status:true,attempts:true,createdAt:true},orderBy:{createdAt:'desc'},take:100}));
 if(resource==='release-reservations'){await releaseExpired();return ok({ok:true});}
 throw new HttpError(404,'Unknown endpoint');
 }catch(error){
  if(error instanceof SyntaxError)return NextResponse.json({error:'Invalid JSON request'},{status:400});
  if(error instanceof HttpError)return NextResponse.json({error:error.message},{status:error.status});
  if(error instanceof z.ZodError)return NextResponse.json({error:error.issues.map(i=>i.path.join('.')+': '+i.message).join('; ')},{status:400});
  if(error instanceof Prisma.PrismaClientKnownRequestError){if(error.code==='P2002')return NextResponse.json({error:'This record already exists'},{status:409});if(error.code==='P2025')return NextResponse.json({error:'Record not found'},{status:404});}
  console.error('Commerce request failed',error instanceof Error?error.message:'Unknown error');return NextResponse.json({error:'The request could not be completed. Please try again.'},{status:500});
 }
}
export {handler as GET,handler as POST,handler as PATCH,handler as DELETE};
