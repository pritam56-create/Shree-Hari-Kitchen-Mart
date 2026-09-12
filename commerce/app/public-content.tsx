'use client';
import {useEffect,useState} from 'react';
export default function PublicContent({kind='HOME',slug}:{kind?:string;slug?:string}){
 const [rows,setRows]=useState<Record<string,any>[]>([]),[error,setError]=useState('');
 useEffect(()=>{let active=true;const reload=()=>fetch('/api/content',{cache:'no-store'}).then(r=>r.json()).then(data=>{if(active)setRows(data)}).catch(()=>{if(active)setError('Content could not be loaded.')});reload();const timer=setInterval(reload,60000);return()=>{active=false;clearInterval(timer)}},[]);
 const visible=rows.filter(r=>kind==='HOME'?['BANNER','HOMEPAGE','OFFER'].includes(r.kind):r.kind===kind).filter(r=>!slug||r.slug===slug);
 if(kind==='HOME'&&!visible.length)return null;
 return <section aria-label={kind==='HOME'?'Store updates':'Store articles'}>{error&&<p role="alert">{error}</p>}{visible.map(r=><article className="panel" key={r.id}>{r.imageUrl&&<picture>{r.mobileImageUrl&&<source media="(max-width: 700px)" srcSet={r.mobileImageUrl}/>}<img src={r.imageUrl} alt={r.title} style={{width:'100%',maxHeight:340,objectFit:'cover'}}/></picture>}<h2>{kind==='BLOG'&&!slug?<a href={'/blog/'+r.slug}>{r.title}</a>:r.title}</h2><p style={{whiteSpace:'pre-wrap'}}>{r.body}</p>{r.ctaText&&r.ctaLink&&<a className="button" href={r.ctaLink}>{r.ctaText}</a>}</article>)}</section>;
}
export function ProductAnswers({productId}:{productId:string}){const [rows,setRows]=useState<Record<string,any>[]>([]);useEffect(()=>{fetch('/api/questions/'+productId).then(r=>r.json()).then(setRows).catch(()=>{})},[productId]);return <>{rows.map(q=><article className="panel" key={q.id}><h3>{q.body}</h3>{q.answers.map((a:Record<string,any>)=><p key={a.id}><strong>Store team:</strong> {a.body}</p>)}</article>)}</>}
