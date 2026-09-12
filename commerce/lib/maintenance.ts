import {db,json} from './db';
import {releaseExpired} from './checkout';
// https://resend.com/docs/api-reference/emails/send-email
export async function maintenance(){
 await releaseExpired();
 await db.adminSession.deleteMany({where:{expiresAt:{lt:new Date()}}});
 await db.session.deleteMany({where:{expiresAt:{lt:new Date()}}});
 await db.rateLimit.deleteMany({where:{expiresAt:{lt:new Date()}}});
 if(!process.env.RESEND_API_KEY||!process.env.EMAIL_FROM)return {reservations:'checked',email:'not_configured'};
 await db.outbox.updateMany({where:{kind:{in:['RESET_EMAIL','ORDER_EMAIL']},status:'SENDING',availableAt:{lt:new Date()}},data:{status:'PENDING'}});
 const jobs=await db.outbox.findMany({where:{kind:{in:['RESET_EMAIL','ORDER_EMAIL']},status:'PENDING',availableAt:{lte:new Date()}},orderBy:{createdAt:'asc'},take:10});
 let sent=0;
 for(const job of jobs){
  // Avoid retrying an unknown outcome after the provider idempotency window.
  if(job.attempts>0&&Date.now()-job.createdAt.getTime()>23*3600000){await db.outbox.updateMany({where:{id:job.id,status:'PENDING'},data:{status:'REVIEW_REQUIRED'}});continue;}
  const claim=await db.outbox.updateMany({where:{id:job.id,status:'PENDING'},data:{status:'SENDING',attempts:{increment:1},availableAt:new Date(Date.now()+5*60000)}});if(!claim.count)continue;
  try{
   const payload=job.payload as Record<string,string>;let to='',subject='',text='';
   if(job.kind==='RESET_EMAIL'){
    if(Date.now()-job.createdAt.getTime()>30*60000){await db.outbox.update({where:{id:job.id},data:{status:'EXPIRED',payload:json({email:payload.email})}});continue;}
    to=payload.email;subject='Reset your Shree Hari password';text=`Use this link within 30 minutes to reset your password:\n${payload.url}\n\nIf you did not request this, ignore this email.`;
   }else{const order=await db.order.findUniqueOrThrow({where:{id:payload.orderId},include:{user:true}});to=order.user.email;subject=`Order ${order.number} confirmed`;text=`Your order ${order.number} is ${order.status}. Total: INR ${order.total}. Payment: ${order.paymentStatus}.\nView the order and download your invoice: ${process.env.APP_URL}/account/orders/${order.id}`;}
   if(to.endsWith('.test')){await db.outbox.update({where:{id:job.id},data:{status:'SANDBOX_RECORDED'}});continue;}
   const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+process.env.RESEND_API_KEY,'Content-Type':'application/json','Idempotency-Key':'shk-'+job.id},body:JSON.stringify({from:process.env.EMAIL_FROM,to:[to],subject,text}),signal:AbortSignal.timeout(15000)});
   if(!response.ok)throw new Error('Email provider did not accept the request');
   await db.outbox.update({where:{id:job.id},data:{status:'SENT',...(job.kind==='RESET_EMAIL'?{payload:json({email:payload.email})}:{})}});sent++;
  }catch{await db.outbox.update({where:{id:job.id},data:{status:job.attempts>=5?'REVIEW_REQUIRED':'PENDING',availableAt:new Date(Date.now()+Math.min(60,2**job.attempts)*60000)}});}
 }
 return {reservations:'checked',email:'configured',sent};
}
