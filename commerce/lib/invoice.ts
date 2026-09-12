import {PDFDocument,StandardFonts,rgb} from 'pdf-lib';
import {db} from './db';
import {HttpError,Member,requireAdmin} from './security';
export async function invoicePDF(id:string,user:Member){
 const invoice=await db.invoice.findUnique({where:{orderId:id},include:{order:{include:{items:true}}}});
 if(!invoice)throw new HttpError(404,'Invoice not found');
 if(invoice.order.userId!==user.id)requireAdmin(user);
 const order=invoice.order,address=order.addressSnapshot as Record<string,string>,business=order.businessSnapshot as Record<string,string>;
 const doc=await PDFDocument.create(),font=await doc.embedFont(StandardFonts.Helvetica),bold=await doc.embedFont(StandardFonts.HelveticaBold);
 let page=doc.addPage([595.28,841.89]),y=790;
 const line=(value:string,size=11,strong=false)=>{const safe=value.replace(/[^\x20-\x7E]/g,'?');const words=safe.split(' ');let current='';for(const word of words){if((strong?bold:font).widthOfTextAtSize(current+' '+word,size)>490){draw(current,size,strong);current=word;}else current+=(current?' ':'')+word;}draw(current,size,strong);};
 function draw(s:string,size:number,strong:boolean){if(y<60){page=doc.addPage([595.28,841.89]);y=790;}page.drawText(s,{x:50,y,size,font:strong?bold:font,color:rgb(.07,.14,.1)});y-=size+8;}
 line(business.name||'Shree Hari Kitchen Mart',21,true);line(business.address||'Business address pending configuration');line(`GSTIN: ${business.gstin||'Pending configuration'}`);y-=10;
 line(`INVOICE ${invoice.number}`,17,true);line(`Date: ${invoice.createdAt.toISOString().slice(0,10)} | Order: ${order.number}`);
 line('Bill to / Ship to',12,true);for(const value of [address.name,address.line1,address.line2,`${address.city}, ${address.state} ${address.postalCode}`,address.phone])if(value)line(value);
 y-=12;
 for(const item of order.items){line(`${item.name} - ${item.variant}`,12,true);line(`SKU ${item.sku} | Qty ${item.quantity} | Unit INR ${item.unitPrice}`);line(`Discount INR ${item.discount} | GST ${item.gstRate}% included: INR ${item.tax}`);y-=6;}
 line(`Subtotal (GST inclusive): INR ${order.subtotal}`);line(`Coupon discount: INR ${order.discount}`);line(`Included GST: INR ${order.tax}`);line(`Delivery: INR ${order.shipping}`);line(`Grand total: INR ${order.total}`,16,true);
 line(`Method: ${order.paymentMethod} | Status at issue: ${(invoice.snapshot as Record<string,string>).paymentStatus}`);
 doc.setTitle(invoice.number);doc.setAuthor(business.name||'Shree Hari Kitchen Mart');return doc.save();
}
