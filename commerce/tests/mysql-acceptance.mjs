// Runs only against an explicitly designated MySQL test database and running app.
// This is a COD integration flow. It does NOT certify the Razorpay payment flow.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {PrismaClient} from '@prisma/client';
const base=process.env.TEST_BASE_URL;
const designatedStaging=process.env.COMMERCE_MODE==='staging'&&process.env.RUN_ACCEPTANCE==='1';
if(process.env.ALLOW_DATABASE_TESTS!=='1'||!base||!process.env.DATABASE_URL||(!new URL(process.env.DATABASE_URL).pathname.endsWith('_test')&&!designatedStaging))throw new Error('Integration tests require an explicitly designated staging or test database.');
const db=new PrismaClient();
let customerCookie='',adminCookie='';
async function request(path,body,cookie='',method){const res=await fetch(base+'/api/'+path,{method:method||(body?'POST':'GET'),headers:{Origin:base,...(cookie?{Cookie:cookie}:{}),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});if(!res.ok)throw new Error(`${path}: ${res.status} ${await res.text()}`);const type=res.headers.get('content-type');return {data:type?.includes('pdf')?Buffer.from(await res.arrayBuffer()):await res.json(),cookie:res.headers.get('set-cookie')?.split(';')[0]||cookie};}
try{
 const run=randomUUID(),email=`acceptance-${run}@example.test`,password=`Test-${randomUUID()}!`;
 customerCookie=(await request('auth/register',{name:'Acceptance Customer',email,password})).cookie;
 await request('auth/logout',{},customerCookie);
 customerCookie=(await request('auth/login',{email,password})).cookie;
 const me=(await request('auth/me',undefined,customerCookie)).data;
 adminCookie=(await request('auth/login',{email:process.env.ADMIN_EMAIL,password:process.env.ADMIN_PASSWORD})).cookie;
 await request('admin/delivery',{enabled:true,pinCodes:['395006'],standardDays:'5–7 business days',expressDays:'2–4 business days'},adminCookie);
 const products=(await request('products?q=Mixer&sort=price-asc&max=10000')).data;assert(products.length);
 const product=(await request('products/'+products[0].slug)).data,variant=product.variants[0];
 const before=await db.inventory.aggregate({where:{variantId:variant.id},_sum:{quantity:true}});
 await request('wishlist',{productId:product.id},customerCookie);
 assert.equal((await request('wishlist',undefined,customerCookie)).data.length,1);
 await request('cart',{variantId:variant.id,quantity:1},customerCookie);
 await request('wishlist',{productId:product.id},customerCookie,'DELETE');
 await request('cart',{variantId:variant.id,quantity:2},customerCookie);
 const quote=(await request('cart/quote',{code:'WELCOME10',delivery:'STANDARD'},customerCookie)).data;assert(quote.totals.discount>0);
 const address=(await request('addresses',{name:'Acceptance Customer',phone:'9999999999',line1:'Test address',line2:'',city:'Surat',state:'Gujarat',postalCode:'395006'},customerCookie)).data;
 const intent={addressId:address.id,code:'WELCOME10',delivery:'STANDARD',gateway:'COD',requestKey:randomUUID()};
 const placed=(await request('checkout',intent,customerCookie)).data.order;
 const duplicate=(await request('checkout',intent,customerCookie)).data.order;assert.equal(placed.id,duplicate.id);
 assert.equal(await db.order.count({where:{checkoutId:placed.checkoutId}}),1);
 assert.equal(await db.orderItem.count({where:{orderId:placed.id}}),1);
 const payment=await db.payment.findUniqueOrThrow({where:{orderId:placed.id}});assert.equal(payment.status,'PENDING');
 const after=await db.inventory.aggregate({where:{variantId:variant.id},_sum:{quantity:true}});assert.equal(before._sum.quantity-after._sum.quantity,2);
 assert(await db.invoice.findUnique({where:{orderId:placed.id}}));
 const pdf=(await request(`orders/${placed.id}/invoice`,undefined,customerCookie)).data;assert.equal(pdf.subarray(0,4).toString(),'%PDF');
 assert((await request('orders',undefined,customerCookie)).data.some(o=>o.id===placed.id));
 assert((await request('admin/orders',undefined,adminCookie)).data.some(o=>o.id===placed.id));
 for(const status of ['PROCESSING','PACKED','SHIPPED','OUT_FOR_DELIVERY','DELIVERED']){await request('admin/orders/'+placed.id,{status,note:'Acceptance test',carrier:'Test carrier',trackingNumber:run,codCollected:status==='DELIVERED'},adminCookie);const tracked=(await request('orders/'+placed.id,undefined,customerCookie)).data;assert.equal(tracked.status,status);assert(tracked.history.some(h=>h.status===status));}
 assert.equal((await db.payment.findUniqueOrThrow({where:{orderId:placed.id}})).status,'CAPTURED');
 await request('reviews',{productId:product.id,rating:5,title:'Test review',body:'Suitable for fresh chutneys and vegetable preparation.'},customerCookie);
 const review=await db.review.findUniqueOrThrow({where:{userId_productId:{userId:me.id,productId:product.id}}});assert(review.verified);
 const ticket=(await request('support',{subject:'Acceptance support ticket',body:'Please confirm warranty details.'},customerCookie)).data;
 await request('admin/support',{id:ticket.id,body:'Please keep your invoice for warranty service.',status:'WAITING_CUSTOMER'},adminCookie);
 const tickets=(await request('support',undefined,customerCookie)).data;assert(tickets.find(t=>t.id===ticket.id).messages.some(m=>m.staff));
 console.log('COD MySQL acceptance flow passed. Razorpay success/failure/webhook tests remain separate.');
}finally{await db.$disconnect();}
