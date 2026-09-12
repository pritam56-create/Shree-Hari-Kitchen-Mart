import {HttpError,verifyHmac} from './security';
export function gatewayReady(){return Boolean(process.env.RAZORPAY_KEY_ID&&process.env.RAZORPAY_KEY_SECRET);}
export async function razorpay(path:string,body?:unknown){
 if(!gatewayReady())throw new HttpError(503,'Online payments are not configured. Choose cash on delivery.');
 const response=await fetch(`https://api.razorpay.com/v1/${path}`,{method:body?'POST':'GET',headers:{Authorization:'Basic '+Buffer.from(process.env.RAZORPAY_KEY_ID+':'+process.env.RAZORPAY_KEY_SECRET).toString('base64'),'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(15000)});
 const result=await response.json();if(!response.ok)throw new HttpError(502,result.error?.description||'Payment provider unavailable');return result;
}
export async function verifyPayment(orderId:string,paymentId:string,signature:string,amount:number){
 if(!gatewayReady()||!verifyHmac(`${orderId}|${paymentId}`,signature,process.env.RAZORPAY_KEY_SECRET!))throw new HttpError(400,'Payment signature verification failed');
 const payment=await razorpay(`payments/${encodeURIComponent(paymentId)}`);
 if(payment.order_id!==orderId||payment.amount!==amount||payment.currency!=='INR'||payment.status!=='captured')throw new HttpError(409,'Payment is not captured or does not match this checkout');
 return payment;
}
