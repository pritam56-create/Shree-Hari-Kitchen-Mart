import {spawn} from 'node:child_process';
import {PrismaClient} from '@prisma/client';
import {randomBytes} from 'node:crypto';

function run(args,extra={}) {
  return new Promise((resolve,reject)=>{
    const child=spawn(process.execPath,args,{stdio:'inherit',env:{...process.env,...extra}});
    child.once('error',reject);
    child.once('exit',code=>code===0?resolve():reject(new Error(`Startup command failed (${code})`)));
  });
}

await run(['node_modules/prisma/build/index.js','migrate','deploy','--schema','commerce/prisma/schema.prisma']);
await run(['--experimental-strip-types','commerce/prisma/admin-setup.ts']);
if(process.env.COMMERCE_MODE==='staging')await run(['--experimental-strip-types','commerce/prisma/seed.ts']);

if(process.env.COMMERCE_MODE==='staging'&&process.env.RUN_ACCEPTANCE==='1'){
  const db=new PrismaClient();
  const tested=await db.siteSetting.findUnique({where:{key:'acceptance-admin-v1'}});
  if(!tested){
    const base='http://127.0.0.1:3099';
    const server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','commerce','--hostname','127.0.0.1','--port','3099'],{stdio:'inherit',env:{...process.env,APP_URL:base}});
    try{
      let ready=false;
      for(let i=0;i<60;i++){
        try{if((await fetch(base+'/api/health')).ok){ready=true;break;}}catch{}
        await new Promise(resolve=>setTimeout(resolve,500));
      }
      if(!ready)throw new Error('Acceptance server failed to become ready');
      await run(['commerce/tests/mysql-acceptance.mjs'],{TEST_BASE_URL:base,ALLOW_DATABASE_TESTS:'1'});
      await run(['commerce/tests/mysql-admin-acceptance.mjs'],{TEST_BASE_URL:base,ALLOW_DATABASE_TESTS:'1'});
      await db.siteSetting.create({data:{key:'acceptance-admin-v1',value:{passedAt:new Date().toISOString(),scope:'COD commerce and private admin RBAC, audit, transfers and publishing'}}});
      console.log('Initial MySQL COD acceptance: PASSED');
    }finally{server.kill('SIGTERM');}
  }
  await db.$disconnect();
}

const jobToken=randomBytes(32).toString('hex');
const app=spawn(process.execPath,['node_modules/next/dist/bin/next','start','commerce','--hostname','0.0.0.0','--port',process.env.PORT||'3000'],{stdio:'inherit',env:{...process.env,COMMERCE_JOB_TOKEN:jobToken}});
let maintenanceRunning=false;
const maintenanceTimer=setInterval(async()=>{if(maintenanceRunning)return;maintenanceRunning=true;try{const response=await fetch(`http://127.0.0.1:${process.env.PORT||3000}/api/internal/maintenance`,{method:'POST',headers:{Authorization:'Bearer '+jobToken},signal:AbortSignal.timeout(180000)});if(!response.ok)console.error('Maintenance request failed:',response.status);}catch{console.error('Maintenance will retry on the next interval.');}finally{maintenanceRunning=false}},60000);
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>app.kill(signal));
app.once('exit',code=>{clearInterval(maintenanceTimer);process.exit(code??1)});
