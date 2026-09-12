import { PrismaClient, Prisma } from '@prisma/client';
const globalDB=globalThis as unknown as {commerceDB?:PrismaClient};
export const db=globalDB.commerceDB??new PrismaClient();
if(process.env.NODE_ENV!=='production')globalDB.commerceDB=db;
export async function transaction<T>(fn:(tx:Prisma.TransactionClient)=>Promise<T>):Promise<T>{
 for(let attempt=0;attempt<4;attempt++){
  try{return await db.$transaction(fn,{isolationLevel:Prisma.TransactionIsolationLevel.Serializable,maxWait:10000,timeout:20000});}
  catch(e){if(e instanceof Prisma.PrismaClientKnownRequestError&&e.code==='P2034'&&attempt<3)continue;throw e;}
 }
 throw new Error('Transaction retry limit');
}
export function json(value:unknown):Prisma.InputJsonValue{return JSON.parse(JSON.stringify(value));}
