import type {SinterklaasB2BOrder} from "../../types";
export type OrderLogo={printed_at?:string|null;printed_by_name?:string|null;printed_quantity?:number|null;printed_width_cm?:number|null;printed_height_cm?:number|null;id:string;name:string;content_type:string;size:number;quantity:number;width_cm:number;height_cm:number;created_at:string;updated_at:string};
export type PrintLogo={id:string;quantity:number;width_cm:number;height_cm:number};
export const LOGO_COLUMNS="id,name,content_type,size,quantity,width_cm,height_cm,created_at,updated_at,printed_at,printed_by_name,printed_quantity,printed_width_cm,printed_height_cm";
export const LOGO_PRINT_MARGINS={left:.5,right:.5,top:2.2,bottom:5};
export const LOGO_MAX_PRINT_HEIGHT=22.5;
export const MAX_LOGO_SIZE=4*1024*1024;
export function logoOrderRequested(order:Pick<SinterklaasB2BOrder,"logo"|"letterLines"|"orderText">) {
  return Boolean(order.logo?.trim()||order.letterLines?.some(line=>line.withLogo)||/\b(?:eigen logo|met logo|inclusief.*logo)\b/i.test(order.orderText));
}
export function validLogoPrint(value:unknown):value is PrintLogo {
  if(!value||typeof value!=="object")return false;
  const item=value as PrintLogo;
  return typeof item.id==="string" && /^[a-f0-9-]{36}$/i.test(item.id) && Number.isInteger(item.quantity)&&item.quantity>=0&&item.quantity<=2000&&Number.isFinite(item.width_cm)&&item.width_cm>=.5&&item.width_cm<=19&&Number.isFinite(item.height_cm)&&item.height_cm>=.5&&item.height_cm<=27;
}
export function logoPrintLayout(items:PrintLogo[]) {
  if(!items.length||items.length>30||items.some(item=>!validLogoPrint(item))||new Set(items.map(item=>item.id)).size!==items.length)throw Error("Controleer de logo’s, aantallen en formaten.");
  const count=items.reduce((sum,item)=>sum+item.quantity,0);
  if(count<1||count>2000)throw Error("Kies samen 1 tot maximaal 2000 logo’s.");
  const cells:{id:string;page:number;x:number;y:number;width:number;height:number}[]=[];
  const margin=LOGO_PRINT_MARGINS,right=21-margin.right,bottom=29.7-margin.bottom;
  if(items.some(item=>item.quantity>0&&item.height_cm>LOGO_MAX_PRINT_HEIGHT))throw Error("Kies een hoogte van maximaal 22,5 cm. Bovenaan staat de klantnaam en onderaan blijft 5 cm vrij voor de printer.");
  let page=0,x=margin.left,y=margin.top,rowHeight=0;
  for(const item of items) {
   if(item.quantity===0)continue;
   if(cells.length){page++;x=margin.left;y=margin.top;rowHeight=0;}
   for(let i=0;i<item.quantity;i++) {
    if(x+item.width_cm>right+.000001){x=margin.left;y+=rowHeight+.3;rowHeight=0;}
    if(y+item.height_cm>bottom+.000001){page++;x=margin.left;y=margin.top;rowHeight=0;}
    if(page>=100)throw Error("Dit zijn meer dan 100 printvellen. Kies minder logo’s of een kleiner formaat.");
    cells.push({id:item.id,page,x,y,width:item.width_cm,height:item.height_cm});
    x+=item.width_cm+.3;rowHeight=Math.max(rowHeight,item.height_cm);
  }
  }
  return cells;
}

export type LogoPrintState=Pick<OrderLogo,"quantity"|"width_cm"|"height_cm"|"printed_at"|"printed_quantity"|"printed_width_cm"|"printed_height_cm">;
export function logoPrintedFor(logo:LogoPrintState) {
 return Boolean(logo.printed_at&&logo.printed_quantity===logo.quantity&&Number(logo.printed_width_cm)===Number(logo.width_cm)&&Number(logo.printed_height_cm)===Number(logo.height_cm));
}

export function logosPrintComplete(logos:LogoPrintState[]) {
 const selected=logos.filter(logo=>logo.quantity>0);
 return selected.length>0&&selected.every(logoPrintedFor);
}
