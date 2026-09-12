import {Prisma} from '@prisma/client';
import {db,transaction} from './db';
import {HttpError} from './security';
import {paise,rupees} from './money';
export async function restockReturn(tx:Prisma.TransactionClient,orderId:string,returnId:string,variantId:string,quantity:number,actorId:string){
 const deductions=await tx.inventoryMovement.findMany({where:{reference:orderId,reason:'ORDER',inventory:{variantId},delta:{lt:0}},orderBy:{inventoryId:'asc'}});
 const returns=await tx.return.findMany({where:{orderId},select:{id:true}});
 const restored=await tx.inventoryMovement.findMany({where:{reason:'RETURN_RESTOCK',reference:{in:returns.map(r=>r.id)},inventory:{variantId}}});
 let needed=quantity;
 for(const movement of deductions){const available=-movement.delta-restored.filter(r=>r.inventoryId===movement.inventoryId).reduce((s,r)=>s+r.delta,0),count=Math.min(needed,available);if(count<=0)continue;await tx.inventory.update({where:{id:movement.inventoryId},data:{quantity:{increment:count}}});await tx.inventoryMovement.create({data:{inventoryId:movement.inventoryId,delta:count,reason:'RETURN_RESTOCK',reference:returnId,actorId}});needed-=count;}
 if(needed)throw new HttpError(409,'Original stock allocation requires reconciliation before restocking');
}
export async function completeRefund(refundId:string,reference:string,actorId?:string){
 return transaction(async tx=>{
  const refund=await tx.refund.findUniqueOrThrow({where:{id:refundId},include:{payment:{include:{order:true}}}});
  if(refund.status==='COMPLETED')return refund;
  const updated=await tx.refund.update({where:{id:refund.id},data:{status:'COMPLETED',gatewayRefundId:reference,failureReason:null}});
  await tx.paymentTransaction.create({data:{paymentId:refund.paymentId,externalId:'refund-'+refund.id,kind:refund.payment.gateway==='COD'?'MANUAL_REFUND':'REFUND',amount:refund.amount}});
  const completed=await tx.refund.aggregate({where:{paymentId:refund.paymentId,status:'COMPLETED'},_sum:{amount:true}});
  const total=paise(completed._sum.amount||0),full=total===paise(refund.payment.amount);
  if(total>paise(refund.payment.amount))throw new HttpError(409,'Completed refunds exceed collected payment');
  await tx.payment.update({where:{id:refund.paymentId},data:{status:full?'REFUNDED':'PARTIALLY_REFUNDED'}});
  // Keep fulfillment state intact so partial returns do not hide delivery history.
  await tx.orderStatusHistory.create({data:{orderId:refund.payment.orderId,status:'REFUND_COMPLETED',actorId,note:`Refund INR ${rupees(paise(refund.amount))} completed; reference ${reference}`}});
  await tx.notification.create({data:{userId:refund.payment.order.userId,title:'Refund completed',body:`Refund INR ${refund.amount} for order ${refund.payment.order.number} has been recorded. Reference: ${reference}`}});
  return updated;
 });
}
