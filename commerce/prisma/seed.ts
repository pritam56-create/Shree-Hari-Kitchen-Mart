import {PrismaClient} from '@prisma/client';
import bcrypt from 'bcryptjs';
import {validateContent} from '../lib/policy.ts';
const db=new PrismaClient();
const catalog=[
 ['Mixer Grinders','750W Mixer Grinder',3499,'3 jars',750,'Stainless steel','Prepare chutneys, spice blends and smooth dosa batter.'],
 ['Juicers','Cold Press Juicer',6999,'1 L',200,'Food-grade polymer','Extract fresh fruit and vegetable juices with a slow-press system.'],
 ['Blenders','Power Blender',2799,'1.5 L',600,'Glass','Blend fruit smoothies, tomato soups and creamy nut drinks.'],
 ['Food Processors','Kitchen Food Processor',5499,'2 L',800,'Stainless steel','Chop vegetables, knead roti dough and prepare fresh dips.'],
 ['Air Fryers','Digital Air Fryer',4999,'4.5 L',1500,'Coated steel','Prepare crisp potato wedges, paneer bites and roasted vegetables.'],
 ['Microwave Ovens','Solo Microwave Oven',6799,'20 L',800,'Steel','Warm dal, rice and vegetarian curries with convenient presets.'],
 ['OTG Ovens','Baking OTG Oven',4599,'28 L',1500,'Steel','Bake bread, vegetable pizza and cookies made without animal ingredients.'],
 ['Induction Cooktops','Portable Induction Cooktop',2299,'Single zone',1800,'Ceramic glass','Cook dal, soups and vegetable curries with precise heat control.'],
 ['Gas Stoves','Two Burner Gas Stove',3199,'2 burners',0,'Stainless steel','A practical cooking surface for everyday rice, dal and vegetables.'],
 ['Electric Kettles','Rapid Electric Kettle',999,'1.5 L',1500,'Stainless steel','Boil water for tea, coffee and warm beverages.'],
 ['Coffee Makers','Drip Coffee Maker',2499,'6 cups',600,'Glass','Brew fresh filter coffee for your morning routine.'],
 ['Toasters','Two Slice Toaster',1699,'2 slices',750,'Steel','Toast bread evenly for buttered toast and fruit spreads.'],
 ['Sandwich Makers','Toast Sandwich Maker',1499,'2 sandwiches',750,'Coated steel','Make toasted paneer and vegetable sandwiches.'],
 ['Rice Cookers','Automatic Rice Cooker',2199,'1.8 L',700,'Aluminium','Cook fluffy rice, vegetable pulao and comforting khichdi.'],
 ['Pressure Cookers','Steel Pressure Cooker',1899,'5 L',0,'Stainless steel','Prepare dal, rice, chickpeas and vegetarian stews.'],
 ['Kitchen Chimneys','Wall Mounted Chimney',9999,'60 cm',180,'Steel','Manage steam and cooking odours from everyday vegetable cooking.'],
 ['Dishwashers','Countertop Dishwasher',22999,'8 place settings',1380,'Steel','Clean plates, cups and cookware after family meals.'],
 ['Refrigerators','Single Door Refrigerator',13999,'185 L',120,'Steel','Keep fruit, vegetables, milk and dairy products fresh.'],
 ['Water Purifiers','RO Water Purifier',7999,'7 L',36,'Food-grade polymer','Filtered drinking water for the family kitchen.'],
 ['Hand Blenders','Immersion Hand Blender',1299,'Handheld',300,'Stainless steel','Blend vegetable soups and fruit smoothies directly in a container.'],
 ['Stand Mixers','Baking Stand Mixer',8999,'5 L',1000,'Steel','Knead bread dough and mix plant-based cake batter.'],
 ['Wet Grinders','Table Top Wet Grinder',5999,'2 L',150,'Stone and steel','Grind rice and lentils for idli and dosa batter.'],
 ['Electric Choppers','Compact Chopper',1099,'500 ml',250,'Glass','Chop onions, herbs and nuts for everyday vegetarian meals.'],
 ['Kitchen Scales','Digital Kitchen Scale',599,'5 kg',0,'Glass','Weigh flour, fruits and baking ingredients accurately.'],
 ['Electric Vegetable Choppers','Vegetable Prep Chopper',1799,'1.5 L',400,'Glass','Prepare chopped carrots, onions and capsicum quickly.'],
 ['Roti Makers','Electric Roti Maker',2299,'25 cm',900,'Coated steel','Prepare warm rotis and thin flatbreads.'],
 ['Dosa Makers','Electric Dosa Plate',2799,'30 cm',1200,'Cast aluminium','Create crisp dosas with rice and lentil batter.'],
 ['Idli Makers','Multi Tier Idli Maker',1299,'16 idlis',0,'Stainless steel','Steam soft idlis and small portions of dhokla.'],
 ['Popcorn Makers','Hot Air Popcorn Maker',1599,'60 g',1200,'Food-grade polymer','Make fresh corn popcorn for family snack time.'],
 ['Ice Cream Makers','Frozen Dessert Maker',3799,'1.2 L',12,'Food-grade polymer','Prepare fruit sorbets and dairy or plant-based frozen desserts.'],
 ['Yogurt Makers','Yogurt Maker',1899,'1 L',20,'Glass','Set fresh dairy or plant-based yogurt at home.'],
 ['Electric Tawas','Multi Purpose Electric Tawa',2499,'30 cm',1300,'Coated steel','Prepare rotis, dosas and toasted paneer.'],
 ['Cookware','Tri Ply Cookware Set',3999,'3 pieces',0,'Stainless steel','Cook vegetable curries, dal and pasta in durable cookware.'],
 ['Kitchen Tools','Silicone Kitchen Tool Set',799,'6 pieces',0,'Silicone','Tools for stirring, serving and preparing vegetarian meals.'],
 ['Storage Products','Airtight Storage Set',1199,'6 containers',0,'Glass','Store grains, lentils, nuts and spices neatly.'],
 ['Accessories','Mixer Jar Accessory',699,'1 L',0,'Stainless steel','Replacement jar for chutneys and spice blends.'],
 ['Spare Parts','Pressure Cooker Gasket',199,'5 L compatible',0,'Silicone','Replacement sealing ring; verify compatibility before purchase.']
] as const;
const slug=(s:string)=>s.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/-$/,'');
try{
 for(const id of ['CUSTOMER','ADMIN','SUPER_ADMIN'])await db.role.upsert({where:{id},create:{id},update:{}});
 await db.warehouse.upsert({where:{id:'MAIN'},create:{id:'MAIN',name:'Main warehouse'},update:{}});
 const brand=await db.brand.upsert({where:{slug:'shree-hari-essentials'},create:{slug:'shree-hari-essentials',name:'Shree Hari Essentials'},update:{}});
 for(const [index,item] of catalog.entries()){
  const [categoryName,name,price,capacity,wattage,material,description]=item;
  validateContent({categoryName,name,description,capacity,material},true);
  const category=await db.category.upsert({where:{slug:slug(categoryName)},create:{slug:slug(categoryName),name:categoryName},update:{}});
  const product=await db.product.upsert({where:{slug:slug(name)},create:{name,slug:slug(name),description,categoryId:category.id,brandId:brand.id,warranty:'1 year limited warranty; confirm supplier terms before live sale.',active:true,vegetarianConfirmed:true,contentReviewedBy:'development-seed'},update:{}});
  const variant=await db.productVariant.upsert({where:{sku:`SHK-${String(index+1).padStart(4,'0')}`},create:{productId:product.id,sku:`SHK-${String(index+1).padStart(4,'0')}`,name:'Standard',price,mrp:Math.ceil(price*1.2),capacity,wattage,material,gstRate:18},update:{}});
  await db.inventory.upsert({where:{variantId_warehouseId:{variantId:variant.id,warehouseId:'MAIN'}},create:{variantId:variant.id,warehouseId:'MAIN',quantity:25},update:{}});
 }
 await db.siteSetting.upsert({where:{key:'business'},create:{key:'business',value:{name:'Shree Hari Kitchen Mart',address:'Business address pending configuration',gstin:'',supportEmail:'',demoCatalog:true}},update:{}});
 await db.siteSetting.upsert({where:{key:'delivery'},create:{key:'delivery',value:{enabled:false,pinCodes:[],standardDays:'5–7 business days',expressDays:'2–4 business days'}},update:{}});
 await db.coupon.upsert({where:{code:'WELCOME10'},create:{code:'WELCOME10',type:'PERCENT',value:10,minimum:999,maximum:500,expiresAt:new Date(Date.now()+90*86400000),usageLimit:1000,perCustomerLimit:1,restrictions:{}},update:{}});
 if(process.env.ADMIN_EMAIL&&process.env.ADMIN_PASSWORD){if(process.env.ADMIN_PASSWORD.length<16)throw new Error('ADMIN_PASSWORD must contain at least 16 characters');await db.user.upsert({where:{email:process.env.ADMIN_EMAIL.toLowerCase()},create:{email:process.env.ADMIN_EMAIL.toLowerCase(),name:'Store Administrator',passwordHash:await bcrypt.hash(process.env.ADMIN_PASSWORD,12),roles:{create:{roleId:'SUPER_ADMIN'}}},update:{}});}
 console.log(`Seed complete: ${catalog.length} vegetarian appliance products. Existing records were preserved.`);
}finally{await db.$disconnect();}
