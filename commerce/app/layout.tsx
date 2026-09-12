import type {Metadata} from 'next';
import './globals.css';
export const metadata:Metadata={title:{default:'Shree Hari Kitchen Mart',template:'%s | Shree Hari Kitchen Mart'},description:'Kitchen appliances for a vegetarian home. Browse, compare and order kitchen essentials.'};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="en-IN"><body>{process.env.COMMERCE_MODE==='staging'&&<aside className="notice" style={{margin:0,borderRadius:0,textAlign:'center'}}>Staging store · Sample catalog · Orders are for testing and will not be fulfilled.</aside>}{children}</body></html>}
