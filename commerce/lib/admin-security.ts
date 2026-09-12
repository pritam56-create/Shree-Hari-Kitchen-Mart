import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {db,transaction,json} from './db';
import {hash,token,passwordHash,passwordMatches,rateLimit,HttpError} from './security';
import {permissionList,requiredPermission,roleDefaults} from './permissions';
export const adminCookie='shk_admin_session';
export function requestMeta(req:NextRequest){return {ip:(req.headers.get('x-real-ip')||req.headers.get('x-forwarded-for')?.split(',')[0]||'unknown').slice(0,100),userAgent:(req.headers.get('user-agent')||'').slice(0,500)};}
export async function securityEvent(req:NextRequest,email:string,action:string,userId?:string){await db.adminSecurityEvent.create({data:{email,action,userId,...requestMeta(req)}});}
export async function adminFromToken(raw?:string){
 const session=raw?await db.adminSession.findUnique({where:{id:hash(raw)},include:{user:{include:{roles:{include:{role:{include:{permissions:true}}}}}}}}):null;
 if(!session||session.expiresAt<new Date()||Date.now()-session.lastSeenAt.getTime()>30*60000||session.user.disabled)return null;
 const roles=session.user.roles.map(r=>r.roleId);if(!roles.some(r=>r in roleDefaults))return null;
 const permissions=roles.includes('SUPER_ADMIN')?[...permissionList]:[...new Set(session.user.roles.flatMap(r=>r.role.permissions.map(p=>p.permissionId)))];
 if(Date.now()-session.lastSeenAt.getTime()>60000)await db.adminSession.updateMany({where:{id:session.id},data:{lastSeenAt:new Date()}});
 return {...session.user,permissions,sessionId:session.id};
}
export type AdminMember=NonNullable<Awaited<ReturnType<typeof adminFromToken>>>;
export function canAdmin(user:AdminMember,permission:string){return permission==='authenticated'||user.permissions.includes(permission as typeof permissionList[number]);}
export async function adminFor(req:NextRequest){const admin=await adminFromToken(req.cookies.get(adminCookie)?.value);if(!admin)throw new HttpError(req.cookies.has('shk_session')?403:401,'Private staff login required');return admin;}
export function authorizeAdmin(user:AdminMember,resource:string,method:string,body:Record<string,unknown>,detail?:string){const permission=requiredPermission(resource,method,body,detail);if(!permission)throw new HttpError(404,'Unknown admin module');if(!canAdmin(user,permission))throw new HttpError(403,'Your staff account does not have permission for this action');}
export function publicAdmin(user:AdminMember){return {id:user.id,name:user.name,email:user.email,roles:user.roles.map(r=>r.roleId),permissions:user.permissions};}
export async function reauthenticate(user:AdminMember,value:unknown){if(typeof value!=='string'||!await passwordMatches(value,user.passwordHash))throw new HttpError(403,'Enter your current administrator password to confirm this sensitive action');}
export async function adminAuth(req:NextRequest,action:string,body:Record<string,unknown>){
 if(action==='me'){if(req.method!=='GET')throw new HttpError(405,'GET required');return NextResponse.json(publicAdmin(await adminFor(req)),{headers:{'Cache-Control':'no-store'}});}
 if(req.method!=='POST')throw new HttpError(405,'POST required');
 if(action==='login'){
  const v=z.object({email:z.string().email().max(191),password:z.string().min(1).max(72),remember:z.boolean().default(false)}).parse(body);v.email=v.email.toLowerCase();
  await rateLimit('admin-ip:'+requestMeta(req).ip,40);await rateLimit('admin-login:'+v.email,8);
  const u=await db.user.findUnique({where:{email:v.email},include:{roles:true}});
  if(!u||u.disabled||!u.roles.some(r=>r.roleId in roleDefaults)||!await passwordMatches(v.password,u.passwordHash)){await securityEvent(req,v.email,'LOGIN_FAILED');throw new HttpError(401,'Invalid staff credentials');}
  const raw=token(),age=v.remember?7*86400:8*3600,previous=req.cookies.get(adminCookie)?.value;
  await transaction(async tx=>{if(previous)await tx.adminSession.deleteMany({where:{id:hash(previous)}});await tx.adminSession.create({data:{id:hash(raw),userId:u.id,expiresAt:new Date(Date.now()+age*1000)}});});
  await securityEvent(req,v.email,'LOGIN_SUCCEEDED',u.id);
  const res=NextResponse.json({ok:true});res.cookies.set(adminCookie,raw,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'strict',path:'/',maxAge:age});return res;
 }
 if(action==='forgot'){
  const email=z.string().email().max(191).parse(body.email).toLowerCase();await rateLimit('admin-reset:'+email,3);await rateLimit('admin-reset-ip:'+requestMeta(req).ip,15);
  const u=await db.user.findUnique({where:{email},include:{roles:true}});
  if(u&&!u.disabled&&u.roles.some(r=>r.roleId in roleDefaults)){const raw=token();await transaction(async tx=>{await tx.authToken.create({data:{id:hash(raw),userId:u.id,purpose:'ADMIN_RESET',expiresAt:new Date(Date.now()+1800000)}});await tx.outbox.create({data:{kind:'RESET_EMAIL',payload:json({email,url:`${process.env.APP_URL}/admin/reset-password?token=${raw}`})}});});await securityEvent(req,email,'PASSWORD_RESET_REQUEST',u.id);}
  return NextResponse.json({message:'If this staff account exists, reset instructions have been queued.'});
 }
 if(action==='reset'){
  const v=z.object({token:z.string().length(64),password:z.string().min(16).max(72)}).parse(body);await rateLimit('admin-reset-token:'+hash(v.token),5);const hashed=await passwordHash(v.password);
  const u=await transaction(async tx=>{const t=await tx.authToken.findUnique({where:{id:hash(v.token)},include:{user:{include:{roles:true}}}});if(!t||t.purpose!=='ADMIN_RESET'||t.expiresAt<new Date()||t.user.disabled||!t.user.roles.some(r=>r.roleId in roleDefaults))throw new HttpError(400,'Invalid or expired staff reset link');await tx.user.update({where:{id:t.userId},data:{passwordHash:hashed}});await tx.adminSession.deleteMany({where:{userId:t.userId}});await tx.authToken.deleteMany({where:{userId:t.userId,purpose:'ADMIN_RESET'}});return t.user;});await securityEvent(req,u.email,'PASSWORD_RESET',u.id);return NextResponse.json({ok:true});
 }
 const user=await adminFor(req);
 if(action==='logout'){await db.adminSession.deleteMany({where:{id:user.sessionId}});await securityEvent(req,user.email,'LOGOUT',user.id);const res=NextResponse.json({ok:true});res.cookies.set(adminCookie,'',{path:'/',maxAge:0,httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'strict'});return res;}
 if(action==='password'){await reauthenticate(user,body.currentPassword);const password=z.string().min(16).max(72).parse(body.password);await transaction(async tx=>{await tx.user.update({where:{id:user.id},data:{passwordHash:await passwordHash(password)}});await tx.adminSession.deleteMany({where:{userId:user.id}});});await securityEvent(req,user.email,'PASSWORD_CHANGED',user.id);return NextResponse.json({ok:true});}
 throw new HttpError(404,'Unknown staff authentication action');
}
