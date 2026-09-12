import {NextRequest} from 'next/server';
import {db,json} from './db';
import {adminFor,authorizeAdmin,requestMeta} from './admin-security';
export function redact(value:unknown):unknown{
 if(Array.isArray(value))return value.map(redact);
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,v])=>[key,/password|secret|token|cookie|authorization|payload/i.test(key)?'[REDACTED]':redact(v)]));
 return value;
}
export async function beginAdminAudit(req:NextRequest){
 const segments=req.nextUrl.pathname.split('/').filter(Boolean),resource=segments[2],detail=segments[3];
 if(segments[1]!=='admin'||resource==='auth'||['GET','HEAD'].includes(req.method))return null;
 const raw=await req.clone().text();if(raw.length>64000)return null;
 const body=raw?JSON.parse(raw):{},user=await adminFor(req);authorizeAdmin(user,resource,req.method,body,detail);
 const entityId=String(detail||body.id||body.returnId||body.productId||resource).slice(0,100);let before:unknown=null;
 if(resource==='products'&&detail)before=await db.product.findUnique({where:{id:detail},include:{variants:true,specifications:true,images:true}});
 if(resource==='inventory'&&body.id)before=await db.inventory.findUnique({where:{id:body.id}});
 if(resource==='orders'&&detail)before=await db.order.findUnique({where:{id:detail},select:{status:true,paymentStatus:true,stockRestored:true}});
 if(resource==='settings')before=(await db.siteSetting.findUnique({where:{key:'business'}}))?.value;
 const details={status:'STARTED',before:redact(before),requested:redact(body)};
 const log=await db.auditLog.create({data:{actorId:user.id,action:req.method+' '+resource,entityId,details:json(details),...requestMeta(req)}});
 return {id:log.id,details};
}
export async function finishAdminAudit(audit:NonNullable<Awaited<ReturnType<typeof beginAdminAudit>>>,status:number){await db.auditLog.update({where:{id:audit.id},data:{details:json({...audit.details,status:status<400?'SUCCEEDED':'REJECTED',httpStatus:status})}});}
