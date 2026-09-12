export function paise(value: unknown): number {
  const match = String(value).match(/^(\d{1,10})(?:\.(\d{1,2}))?$/);
  if (!match) throw new Error('Invalid monetary value');
  return Number(match[1]) * 100 + Number((match[2] || '').padEnd(2, '0'));
}
export const rupees = (v: number) => (v / 100).toFixed(2);
export function allocate(total: number, weights: number[]): number[] {
  const sum = weights.reduce((a,b)=>a+b,0);
  if(total>sum||total<0||(!sum&&total))throw new Error('Invalid allocation');
  const parts=weights.map(w=>sum?Math.floor(total*w/sum):0);
  let remaining=total-parts.reduce((a,b)=>a+b,0);
  const order=weights.map((w,i)=>({i,fraction:sum?total*w/sum-parts[i]:0})).sort((a,b)=>b.fraction-a.fraction);
  for(const item of order){if(!remaining)break;if(weights[item.i]>0){parts[item.i]++;remaining--;}}
  return parts;
}
export function quote(lines: {price: unknown; mrp: unknown; gstRate: unknown; quantity: number}[], couponDiscount=0, express=false, eligible?:boolean[]) {
  if (!lines.length) throw new Error('Cart is empty');
  const gross = lines.map(l=> { if(!Number.isInteger(l.quantity)||l.quantity<1||l.quantity>20)throw new Error('Invalid quantity'); return paise(l.price)*l.quantity; });
  const subtotal = gross.reduce((a,b)=>a+b,0);
  if(!Number.isInteger(couponDiscount)||couponDiscount<0||couponDiscount>subtotal)throw new Error('Invalid discount');
  const discounts=allocate(couponDiscount,gross.map((v,i)=>eligible&&!eligible[i]?0:v));
  const taxes=lines.map((l,i)=>Math.round((gross[i]-discounts[i])*Number(l.gstRate)/(100+Number(l.gstRate))));
  const mrp=lines.reduce((s,l)=>s+paise(l.mrp)*l.quantity,0);
  const shipping=express?14900:subtotal-couponDiscount>=299900?0:7900;
  return {subtotal,mrp,discount:couponDiscount,tax:taxes.reduce((a,b)=>a+b,0),shipping,total:subtotal-couponDiscount+shipping,savings:mrp-subtotal+couponDiscount,discounts,taxes};
}
export const nextStatuses: Record<string,string[]> = {
  PLACED:['PROCESSING','CANCELLED'], PAYMENT_CONFIRMED:['PROCESSING','CANCELLED'],PROCESSING:['PACKED','CANCELLED'],PACKED:['SHIPPED','CANCELLED'],SHIPPED:['OUT_FOR_DELIVERY'],OUT_FOR_DELIVERY:['DELIVERED'],DELIVERED:[],CANCELLED:[]
};
export function checkTransition(from:string,to:string){if(!nextStatuses[from]?.includes(to))throw new Error(`Cannot change ${from} to ${to}`);}
