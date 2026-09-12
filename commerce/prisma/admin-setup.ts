import {PrismaClient} from '@prisma/client';
import {permissionList,roleDefaults} from '../lib/permissions.ts';
const db=new PrismaClient();
try{
 await db.$transaction(async tx=>{
  for(const id of permissionList)await tx.permission.upsert({where:{id},create:{id},update:{}});
  const key='admin-permissions-v1';
  if(!await tx.siteSetting.findUnique({where:{key}})){
   for(const [id,permissions] of Object.entries(roleDefaults)){
    await tx.role.upsert({where:{id},create:{id},update:{}});
    await tx.rolePermission.createMany({data:permissions.map(permissionId=>({roleId:id,permissionId})),skipDuplicates:true});
   }
   await tx.siteSetting.create({data:{key,value:{initializedAt:new Date().toISOString()}}});
  }
 },{timeout:30000});
 console.log('Admin permissions initialized; existing role grants preserved.');
}finally{await db.$disconnect();}
