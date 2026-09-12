import {spawn} from 'node:child_process';
import {PrismaClient} from '@prisma/client';

function run(args,extra={}) {
  return new Promise((resolve,reject)=>{
    const child=spawn(process.execPath,args,{stdio:'inherit',env:{...process.env,...extra}});
    child.once('error',reject);
    child.once('exit',code=>code===0?resolve():reject(new Error(`Startup command failed (${code})`)));
  });
}

await run(['node_modules/prisma/build/index.js','migrate','deploy','--schema','commerce/prisma/schema.prisma']);
if(process.env.COMMERCE_MODE==='staging')await run(['--experimental-strip-types','commerce/prisma/seed.ts']);

if(process.env.COMMERCE_MODE==='staging'&&process.env.RUN_ACCEPTANCE==='1'){
  const db=new PrismaClient();
  const tested=await db.siteSetting.findUnique({where:{key:'acceptance-cod-v2'}});
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
      await db.siteSetting.create({data:{key:'acceptance-cod-v2',value:{passedAt:new Date().toISOString(),scope:'COD order, MySQL persistence, stock, PDF, fulfillment, verified review, support, multi-warehouse cancellation and concurrent replay'}}});
      console.log('Initial MySQL COD acceptance: PASSED');
    }finally{server.kill('SIGTERM');}
  }
  await db.$disconnect();
}

const app=spawn(process.execPath,['node_modules/next/dist/bin/next','start','commerce','--hostname','0.0.0.0','--port',process.env.PORT||'3000'],{stdio:'inherit',env:process.env});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>app.kill(signal));
app.once('exit',code=>process.exit(code??1));
