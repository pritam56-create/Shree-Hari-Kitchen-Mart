import type {MetadataRoute} from 'next';
export default function robots():MetadataRoute.Robots{return {rules:{userAgent:'*',allow:'/',disallow:['/admin','/api/','/account','/checkout','/payment','/cart','/wishlist','/login','/register','/reset-password']},sitemap:process.env.APP_URL?process.env.APP_URL+'/sitemap.xml':undefined};}
