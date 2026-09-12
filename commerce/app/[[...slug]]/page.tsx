import {Suspense} from 'react';
import Store from '../store';
export default function Page(){return <Suspense fallback={<p>Loading store…</p>}><Store/></Suspense>}
