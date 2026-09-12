import {Prisma} from '@prisma/client';
import {db,transaction,json} from './db';
import {HttpError} from './security';
import {paise,rupees,quote} from './money';
import {razorpay} from './payments';
export const productInclude={category:true,brand:true,images:true,specifications:true,variants:{include:{inventory:true}},reviews:{where:{status:'APPROVED'},select:{rating:true,title:true,body:true,verified:true}}} satisfies Prisma.ProductInclude;
export async function releaseExpired(){
 await transaction(async tx=>{
  const rows=await tx.reservation.findMany({where:{released:false,expiresAt:{lt:new Date()}},take:200});
  for(const r of rows){await tx.inventory.update({where:{id:r.inventoryId},data:{reserved:{decrement:r.quantity}}});await tx.reservation.update({where:{id:r.id},data:{released:true}});}
 });
}
export async function cartQuote(userId:string,code='',delivery='STANDARD',tx:Prisma.TransactionClient=db){
 const cart=await tx.cart.findUnique({where:{userId},include:{items:{where:{saved:false},include:{variant:{include:{product:{include:{images:true,specifications:true}},inventory:true}}}}}});
 if(!cart?.items.length)throw new HttpError(400,'Your cart is empty');
 const items=cart.items.sort((a,b)=>a.variantId.localeCompare(b.variantId));
 for(const item of items){if(!item.variant.active||!item.variant.product.active)throw new HttpError(409,'An item is no longer available');if(item.variant.inventory.reduce((s,i)=>s+i.quantity-i.reserved,0)<item.quantity)throw new HttpError(409,`Insufficient stock: ${item.variant.product.name}`);}
 let discount=0,couponId:string|null=null, eligibleIds:string[]|undefined;
 if(code){
  const coupon=await tx.coupon.findUnique({where:{code:code.toUpperCase()}});
  if(!coupon||!coupon.active||coupon.expiresAt<new Date()||coupon.used>=coupon.usageLimit)throw new HttpError(400,'Coupon is unavailable or expired');
  const restrictions=coupon.restrictions as {products?:string[];categories?:string[];brands?:string[]};
  const eligible=items.filter(i=>(!restrictions.products?.length||restrictions.products.includes(i.variant.productId))&&(!restrictions.categories?.length||restrictions.categories.includes(i.variant.product.categoryId))&&(!restrictions.brands?.length||restrictions.brands.includes(i.variant.product.brandId)));
  eligibleIds=eligible.map(i=>i.id);
  const amount=eligible.reduce((s,i)=>s+paise(i.variant.price)*i.quantity,0);
  if(!amount||amount<paise(coupon.minimum))throw new HttpError(400,'Coupon minimum or product restrictions are not met');
  if(await tx.couponUsage.count({where:{couponId:coupon.id,userId}})>=coupon.perCustomerLimit)throw new HttpError(400,'Coupon already used');
  discount=coupon.type==='PERCENT'?Math.floor(amount*Number(coupon.value)/100):paise(coupon.value);
  discount=Math.min(amount,discount,coupon.maximum?paise(coupon.maximum):amount);couponId=coupon.id;
 }
 const totals=quote(items.map(i=>({...i.variant,quantity:i.quantity})),discount,delivery==='EXPRESS',eligibleIds?items.map(i=>eligibleIds!.includes(i.id)):undefined);
 return {items,totals,couponId,code,delivery};
}
async function number(tx:Prisma.TransactionClient,prefix:string){
 const year=new Date().getUTCFullYear();const seq=await tx.sequence.upsert({where:{id:`${prefix}-${year}`},create:{id:`${prefix}-${year}`,value:1},update:{value:{increment:1}}});
 return `${prefix}-${year}-${String(seq.value).padStart(6,'0')}`;
}
export async function startCheckout(userId:string,input:{addressId:string;code:string;delivery:string;gateway:string;requestKey:string}){
 await releaseExpired();
 const checkout=await transaction(async tx=>{
  const existing=await tx.checkout.findUnique({where:{requestKey:input.requestKey}});if(existing){if(existing.userId!==userId)throw new HttpError(409,'Invalid checkout key');return existing;}
  const address=await tx.address.findFirst({where:{id:input.addressId,userId}});if(!address)throw new HttpError(400,'Select your delivery address');
  const coverage=(await tx.siteSetting.findUnique({where:{key:'delivery'}}))?.value as {enabled?:boolean;pinCodes?:string[]}|undefined;if(!coverage?.enabled||!coverage.pinCodes?.includes(address.postalCode))throw new HttpError(400,'Delivery is not enabled for this PIN code');
  const q=await cartQuote(userId,input.code,input.delivery,tx);
  const business=(await tx.siteSetting.findUnique({where:{key:'business'}}))?.value;
  const expiresAt=new Date(Date.now()+30*60000);
  const created=await tx.checkout.create({data:{userId,requestKey:input.requestKey,gateway:input.gateway,expiresAt,total:rupees(q.totals.total),snapshot:json({...q,address,business})}});
  for(const item of q.items){let needed=item.quantity;for(const inventory of item.variant.inventory.sort((a,b)=>a.id.localeCompare(b.id))){const count=Math.min(needed,inventory.quantity-inventory.reserved);if(count>0){await tx.inventory.update({where:{id:inventory.id},data:{reserved:{increment:count}}});await tx.reservation.create({data:{checkoutId:created.id,inventoryId:inventory.id,quantity:count,expiresAt}});needed-=count;}}if(needed)throw new HttpError(409,'Stock changed. Please retry.');}
  return created;
 });
 if(checkout.gateway==='COD')return {order:await confirmCheckout(checkout.id,userId,null)};
 if(checkout.gatewayOrderId)return {checkoutId:checkout.id,gatewayOrderId:checkout.gatewayOrderId,key:process.env.RAZORPAY_KEY_ID,amount:paise(checkout.total)};
 const claimed=await db.checkout.updateMany({where:{id:checkout.id,status:'PENDING'},data:{status:'GATEWAY_INITIALIZING'}});
 if(!claimed.count)throw new HttpError(409,'This checkout is already initializing. Check your orders before retrying.');
 let remote;
 try{remote=await razorpay('orders',{amount:paise(checkout.total),currency:'INR',receipt:checkout.id,notes:{checkoutId:checkout.id}});}catch(error){await db.checkout.update({where:{id:checkout.id},data:{status:'GATEWAY_RECONCILIATION_REQUIRED'}});throw error;}
 await db.checkout.update({where:{id:checkout.id},data:{gatewayOrderId:remote.id}});
 return {checkoutId:checkout.id,gatewayOrderId:remote.id,key:process.env.RAZORPAY_KEY_ID,amount:remote.amount};
}
type Snapshot=Awaited<ReturnType<typeof cartQuote>>&{address:Record<string,unknown>;business:Record<string,unknown>};
export async function confirmCheckout(checkoutId:string,userId:string,payment:{id:string;method:string;order_id:string}|null){
 return transaction(async tx=>{
  const checkout=await tx.checkout.findUnique({where:{id:checkoutId},include:{order:true}});
  if(!checkout||checkout.userId!==userId)throw new HttpError(404,'Checkout not found');
  if(checkout.order)return checkout.order;
  if(checkout.gateway==='RAZORPAY'&&!payment)throw new HttpError(400,'Verified payment is required');
  if(payment&&payment.order_id!==checkout.gatewayOrderId)throw new HttpError(400,'Payment order mismatch');
  const q=checkout.snapshot as unknown as Snapshot;
  const reservations=await tx.reservation.findMany({where:{checkoutId,released:false},orderBy:{inventoryId:'asc'}});
  if(!reservations.length||checkout.expiresAt<new Date())throw new HttpError(409,'Checkout expired. Payment reconciliation is required if funds were captured.');
  if(q.couponId){const coupon=await tx.coupon.findUniqueOrThrow({where:{id:q.couponId}});if(coupon.used>=coupon.usageLimit||await tx.couponUsage.count({where:{couponId:coupon.id,userId}})>=coupon.perCustomerLimit)throw new HttpError(409,'Coupon usage limit reached');await tx.coupon.update({where:{id:coupon.id},data:{used:{increment:1}}});}
  for(const r of reservations){const changed=await tx.inventory.updateMany({where:{id:r.inventoryId,quantity:{gte:r.quantity},reserved:{gte:r.quantity}},data:{quantity:{decrement:r.quantity},reserved:{decrement:r.quantity}}});if(changed.count!==1)throw new HttpError(409,'Inventory requires reconciliation');await tx.reservation.update({where:{id:r.id},data:{released:true}});}
  const orderNumber=await number(tx,'SHK'),invoiceNumber=await number(tx,'INV');
  const order=await tx.order.create({data:{number:orderNumber,userId,checkoutId,status:payment?'PAYMENT_CONFIRMED':'PLACED',paymentStatus:payment?'PAID':'PENDING',paymentMethod:payment?.method||'COD',subtotal:rupees(q.totals.subtotal),discount:rupees(q.totals.discount),tax:rupees(q.totals.tax),shipping:rupees(q.totals.shipping),total:checkout.total,addressSnapshot:json(q.address),businessSnapshot:json(q.business||{}),items:{create:q.items.map((item,i)=>({productId:item.variant.productId,variantId:item.variantId,name:item.variant.product.name,sku:item.variant.sku,variant:item.variant.name,quantity:item.quantity,unitPrice:rupees(paise(item.variant.price)),discount:rupees(q.totals.discounts[i]),tax:rupees(q.totals.taxes[i]),gstRate:item.variant.gstRate,snapshot:json({image:item.variant.product.images[0]?.url||null,specifications:item.variant.product.specifications,warranty:item.variant.product.warranty})}))},history:{create:[{status:'PLACED',note:'Order created',actorId:userId},...(payment?[{status:'PAYMENT_CONFIRMED',note:'Captured payment verified on server',actorId:userId}]:[])]}}});
  const paymentRecord=await tx.payment.create({data:{orderId:order.id,gateway:checkout.gateway,gatewayPaymentId:payment?.id,gatewayOrderId:checkout.gatewayOrderId,amount:checkout.total,method:payment?.method||'COD',status:payment?'CAPTURED':'PENDING'}});
  if(payment){await tx.paymentTransaction.create({data:{paymentId:paymentRecord.id,externalId:payment.id,kind:'CAPTURE',amount:checkout.total}});await tx.paymentAttempt.create({data:{checkoutId,paymentId:payment.id,status:'VERIFIED'}});}
  await tx.invoice.create({data:{orderId:order.id,number:invoiceNumber,snapshot:json({orderNumber,invoiceNumber,address:q.address,business:q.business||{},totals:q.totals,paymentMethod:order.paymentMethod,paymentStatus:order.paymentStatus}),items:{create:q.items.map((item,i)=>({snapshot:json({name:item.variant.product.name,sku:item.variant.sku,quantity:item.quantity,unitPrice:String(item.variant.price),gstRate:String(item.variant.gstRate),discount:rupees(q.totals.discounts[i]),tax:rupees(q.totals.taxes[i])})}))}}});
  for(const r of reservations)await tx.inventoryMovement.create({data:{inventoryId:r.inventoryId,delta:-r.quantity,reason:'ORDER',reference:order.id,actorId:userId}});
  if(q.couponId)await tx.couponUsage.create({data:{couponId:q.couponId,userId,orderId:order.id}});
  await tx.checkout.update({where:{id:checkoutId},data:{status:'CONFIRMED'}});
  for(const item of q.items){const current=await tx.cartItem.findUnique({where:{id:item.id}});if(current){if(current.quantity<=item.quantity)await tx.cartItem.delete({where:{id:item.id}});else await tx.cartItem.update({where:{id:item.id},data:{quantity:{decrement:item.quantity}}});}}
  await tx.notification.create({data:{userId,title:`Order ${order.number} confirmed`,body:payment?'Your payment was verified. Your invoice is ready.':'Pay on delivery. Your invoice is ready.'}});
  await tx.outbox.create({data:{kind:'ORDER_EMAIL',payload:json({userId,orderId:order.id})}});
  return order;
 });
}
