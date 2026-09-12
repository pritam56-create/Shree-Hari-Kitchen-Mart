import {createHash,randomBytes,timingSafeEqual,createHmac} from 'node:crypto';
import bcrypt from 'bcryptjs';
import {NextRequest,NextResponse} from 'next/server';
import {db,transaction} from './db';
export class HttpError extends Error { constructor(public status:number,message:string){super(message);} }
export const hash=(value:string)=>createHash('sha256').update(value).digest('hex');
export const token=()=>randomBytes(32).toString('hex');
export const passwordHash=(value:string)=>bcrypt.hash(value,12);
export const passwordMatches=(value:string,stored:string)=>bcrypt.compare(value,stored);
export function verifyHmac(body:string,signature:string,secret:string){
 if(!/^[a-f0-9]{64}$/i.test(signature))return false;
 return timingSafeEqual(Buffer.from(signature,'hex'),Buffer.from(createHmac('sha256',secret).update(body).digest('hex'),'hex'));
}
export async function rateLimit(key:string,limit=20){
 const id=hash(key+':'+Math.floor(Date.now()/600000));
 const record=await db.rateLimit.upsert({where:{id},create:{id,expiresAt:new Date(Date.now()+600000)},update:{count:{increment:1}}});
 if(record.count>limit)throw new HttpError(429,'Too many requests. Try again in ten minutes.');
}
export function checkOrigin(req:NextRequest){
 if(!['GET','HEAD'].includes(req.method)&&req.headers.get('origin')!==(process.env.APP_URL||req.nextUrl.origin))throw new HttpError(403,'Invalid request origin');
}
export async function userFor(req:NextRequest,required=true){
 const raw=req.cookies.get('shk_session')?.value;
 const session=raw?await db.session.findUnique({where:{id:hash(raw)},include:{user:{include:{roles:true}}}}):null;
 if(!session||session.expiresAt<new Date()||session.user.disabled){if(required)throw new HttpError(401,'Please sign in');return null;}
 return session.user;
}
export type Member=NonNullable<Awaited<ReturnType<typeof userFor>>>;
export function requireAdmin(user:Member,superOnly=false){if(!user.roles.some(r=>r.roleId==='SUPER_ADMIN'||(!superOnly&&r.roleId==='ADMIN')))throw new HttpError(403,'Administrator access required');}
export async function sessionResponse(userId:string,remember=false){
 const raw=token(),age=remember?60*60*24*30:60*60*12;
 await db.session.create({data:{id:hash(raw),userId,expiresAt:new Date(Date.now()+age*1000)}});
 const response=NextResponse.json({ok:true});
 response.cookies.set('shk_session',raw,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/',maxAge:age});return response;
}
export async function consumeToken(raw:string,purpose:string){
 return transaction(async tx=>{const record=await tx.authToken.findUnique({where:{id:hash(raw)}});if(!record||record.purpose!==purpose||record.expiresAt<new Date())throw new HttpError(400,'Invalid or expired token');await tx.authToken.delete({where:{id:record.id}});return record.userId;});
}
