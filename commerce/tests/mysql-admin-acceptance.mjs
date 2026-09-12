import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
const base=process.env.TEST_BASE_URL;
if(process.env.ALLOW_DATABASE_TESTS!=='1'||!base||!(process.env.COMMERCE_MODE==='staging'&&process.env.RUN_ACCEPTANCE==='1')&&!new URL(process.env.DATABASE_URL).pathname.endsWith('_test'))throw new Error('Explicit staging/test database required');
async function call(path,body,cookie='',expected=200,method){const r=await fetch(base+'/api/'+path,{method:method||(body?'POST':'GET'),headers:{Origin:base,...(cookie?{Cookie:cookie}:{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});assert.equal(r.status,expected,path+': '+r.status);const data=await r.json();return {data,cookie:r.headers.get('set-cookie')?.split(';')[0]||cookie,headers:r.headers};}
const run=randomUUID(),password='Staff-'+randomUUID()+'!',customerEmail=`admin-security-${run}@example.test`;
const customer=await call('auth/register',{name:'Security acceptance customer',email:customerEmail,password});
await call('admin/products',undefined,customer.cookie,403);
await call('admin/auth/login',{email:customerEmail,password},'',401);
await call('admin/products',undefined,'shk_admin_session=forged',401);
const privatePage=await fetch(base+'/admin/orders',{redirect:'manual'});assert([303,307,308].includes(privatePage.status));assert(privatePage.headers.get('location').includes('/admin/login'));
const owner=await call('admin/auth/login',{email:process.env.ADMIN_EMAIL,password:process.env.ADMIN_PASSWORD});assert(owner.headers.get('set-cookie').includes('HttpOnly'));assert(owner.headers.get('set-cookie').includes('SameSite=strict'));
await call('auth/login',{email:process.env.ADMIN_EMAIL,password:process.env.ADMIN_PASSWORD},'',401);
const staff=await call('admin/admin-users',{action:'create',name:'Acceptance product manager',email:`staff-${run}@example.test`,password,role:'PRODUCT_MANAGER',currentPassword:process.env.ADMIN_PASSWORD},owner.cookie);
assert(!JSON.stringify(staff.data).includes('passwordHash'));
const manager=await call('admin/auth/login',{email:staff.data.email,password});
await call('admin/refunds',{returnId:'forged'},manager.cookie,403);
await call('admin/admin-users',undefined,manager.cookie,403);
await call('admin/settings',undefined,manager.cookie,403);
const csrf=await fetch(base+'/api/admin/products',{method:'POST',headers:{Cookie:manager.cookie,Origin:'https://untrusted.example','Content-Type':'application/json'},body:'{}'});assert.equal(csrf.status,403);
const categories=(await call('categories')).data,brands=(await call('brands')).data;
const payload={name:'Acceptance vegetable processor',slug:'staff-test-'+run,description:'Prepare fresh vegetables and chutneys.',categoryId:categories[0].id,brandId:brands[0].id,warranty:'Testing only',active:true,vegetarianConfirmed:true,variant:{sku:'STAFF-'+run,name:'Standard',price:499,mrp:699,gstRate:18,capacity:'1 L',wattage:300,material:'Steel'}};
const product=(await call('admin/products',payload,manager.cookie)).data;
try{
 const visible=(await call('products/'+payload.slug)).data;assert.equal(visible.name,payload.name);
 await call('admin/products/'+product.id,{...payload,variant:{...payload.variant,price:399}},manager.cookie);
 assert.equal(Number((await call('products/'+payload.slug)).data.variants[0].price),399);
 await call('admin/products/'+product.id,{...payload,name:'Chicken preparation appliance'},manager.cookie,400); // Policy rejects publication; no prohibited data persists.
 assert.equal((await call('products/'+payload.slug)).data.name,payload.name);
 const inventory=(await call('admin/inventory',undefined,owner.cookie)).data.find(i=>i.variant.productId===product.id);
 await call('admin/inventory',{id:inventory.id,delta:5,reason:'Acceptance stock'},owner.cookie);
 const warehouse=(await call('admin/warehouses',{id:'test-'+run.slice(0,20),name:'Acceptance transfer warehouse'},owner.cookie)).data;
 await call('admin/transfers',{inventoryId:inventory.id,warehouseId:warehouse.id,quantity:2,reason:'Acceptance transfer'},owner.cookie);
 const stock=(await call('products/'+payload.slug)).data.variants[0].inventory;assert.equal(stock.reduce((n,i)=>n+i.quantity,0),5);assert(stock.some(i=>i.warehouseId===warehouse.id&&i.quantity===2));
 await call('admin/transfers',{inventoryId:inventory.id,warehouseId:warehouse.id,quantity:4,reason:'Reject over-transfer'},owner.cookie,409);
 const banner=(await call('admin/banners',{slug:'banner-'+run,title:'Fresh vegetarian preparations',body:'Acceptance content publishing check.',imageUrl:'',mobileImageUrl:'',ctaText:'Browse appliances',ctaLink:'/search',priority:999,active:true,startsAt:null,endsAt:null,vegetarianConfirmed:true,imageReviewed:false},owner.cookie)).data;
 assert((await call('content')).data.some(c=>c.id===banner.id));
 await call('admin/banners',{id:banner.id},owner.cookie,200,'DELETE');
 assert(!(await call('content')).data.some(c=>c.id===banner.id));
 const audit=(await call('admin/audit-logs?q=products',undefined,owner.cookie)).data;assert(audit.some(a=>a.entityId===product.id&&a.details.status==='SUCCEEDED'));
 const staffAudit=(await call('admin/audit-logs?q=admin-users',undefined,owner.cookie)).data;assert(!JSON.stringify(staffAudit).includes(password));assert(!JSON.stringify(staffAudit).includes(process.env.ADMIN_PASSWORD));
 await call('admin/admin-users',{action:'update',id:staff.data.id,name:staff.data.name,role:'PRODUCT_MANAGER',disabled:true,currentPassword:process.env.ADMIN_PASSWORD},owner.cookie);
 await call('admin/products',undefined,manager.cookie,401);
 await call('admin/auth/logout',{},owner.cookie);
 await call('admin/products',undefined,owner.cookie,401);
 console.log('Private admin MySQL acceptance: PASSED (separate sessions, RBAC, CSRF, staff revocation, catalog changes, transfers, publishing and redacted audit)');
}finally{
 const cleanup=await call('admin/auth/login',{email:process.env.ADMIN_EMAIL,password:process.env.ADMIN_PASSWORD});
 await call('admin/products/'+product.id,{},cleanup.cookie,200,'DELETE');
 await call('admin/auth/logout',{},cleanup.cookie);
}
