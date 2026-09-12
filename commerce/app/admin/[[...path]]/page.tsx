import {cookies} from 'next/headers';
import {redirect,notFound} from 'next/navigation';
import {Suspense} from 'react';
import {adminCookie,adminFromToken,canAdmin} from '../../../lib/admin-security';
import {requiredPermission} from '../../../lib/permissions';
import Store from '../../store';
import {AdminLogin} from '../../admin-ui';
export const dynamic='force-dynamic';
export const metadata={title:'Private administration',robots:{index:false,follow:false}};
export default async function AdminPage({params}:{params:Promise<{path?:string[]}>}){
 const segments=(await params).path||[],section=segments[0]||'dashboard';
 if(['login','forgot-password','reset-password'].includes(section))return <Suspense><AdminLogin mode={section}/></Suspense>;
 const jar=await cookies(),admin=await adminFromToken(jar.get(adminCookie)?.value);
 if(!admin)redirect('/admin/login');
 const permission=requiredPermission(section,section==='products'&&segments[1]==='add'?'POST':'GET');
 if(!permission)notFound();
 if(!canAdmin(admin,permission))return <main className="container"><h1>Access denied</h1><p>Your staff role does not permit this module.</p><a href="/admin/notifications">Open your permitted workspace</a></main>;
 return <Suspense fallback={<p>Loading administration…</p>}><Store/></Suspense>;
}
