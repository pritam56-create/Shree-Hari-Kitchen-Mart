import type {MetadataRoute} from 'next';
import {db} from '../lib/db';
export const dynamic='force-dynamic';
export default async function sitemap():Promise<MetadataRoute.Sitemap>{const base=process.env.APP_URL;if(!base)return [];const [products,categories]=await Promise.all([db.product.findMany({where:{active:true},select:{slug:true,updatedAt:true}}),db.category.findMany({select:{slug:true}})]);return [{url:base},{url:base+'/categories'},...products.map(p=>({url:base+'/product/'+p.slug,lastModified:p.updatedAt})),...categories.map(c=>({url:base+'/category/'+c.slug}))];}
