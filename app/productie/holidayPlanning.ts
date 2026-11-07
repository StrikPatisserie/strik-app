import { createHash } from "node:crypto";
import { editableFolderOrderText } from "../lib/businessFolderOrderText";
import { businessDeliveryWindow } from "../lib/businessOrderDeliveries";
import { b2bLetterHasLogo } from "../sinterklaas/b2bLetterLines";
import type { SinterklaasB2BOrder } from "../sinterklaas/types";
export const PRODUCTION_HOLIDAYS=[{id:"sint",name:"Sinterklaas"},{id:"kerst",name:"Kerst"}] as const;
export type HolidayOrder={id:string;name:string;season:string;date:string;dateEnd:string;productionDate:string;letterProductionDate?:string;letterProductionEnd?:string;department:string;products:string;letters:string[];packaging:string;instructions:string;logo:string;productionDone:boolean;letterProductionDone:boolean;hasLetters:boolean;delivered:boolean;version:string};
export function productionOrderText(value:string){
 let text=editableFolderOrderText(value) || value.replace(/\r\n?/g,"\n");
 const known=text.match(/(?:^|\n)(?:GEKOZEN SINTERKLAASPRODUCTEN|LOSSE KERSTCADEAUS|KERSTPAKKET OP MAAT)[\t ]*\n([\s\S]*?)(?=\n(?:PRIJSINDICATIE|GEWENSTE LEVERING|WENSEN)[\t ]*(?:\n|$)|$)/i);if(known)text=known[1];
 return text.split("\n").filter(line=>!/^\s*(?:\d+(?:[.,]\d+)?\s*[×x]\s*)?(?:PRODUCTEN EN PRIJS|BEDRIJF EN CONTACT|PRIJSINDICATIE|Factuur|Totaal|Prijsafspraak|Bezorgkosten|Bezorgtoeslag|Verzendkosten|Verzendtoeslag|Transportkosten|Inkoop|Verkoopprijs|Staffelkorting|Betaal|E-?mail|Telefoon|Contactpersoon)\b/i.test(line)).map(line=>line.replace(/\s*·?\s*€.*$/,"").trim()).filter(Boolean).join("\n");
}
const PRODUCT_HEADING=/^(?:PRODUCTEN EN PRIJS|GEKOZEN SINTERKLAASPRODUCTEN|LOSSE KERSTCADEAUS|KERSTPAKKET OP MAAT)$/i;
const OTHER_HEADING=/^(?:OVERIGE ORDERAFSPRAKEN|WENSEN|PRODUCTIE[- ]?INSTRUCTIES)$/i;
const ADMIN_HEADING=/^(?:PRIJSINDICATIE|GEWENSTE LEVERING|LOGISTIEK|VERZENDING|AFHALEN|BEDRIJF EN CONTACT|FACTUURGEGEVENS|PRIJSAFSPRAKEN?|BETALING)$/i;
const LOGISTICS_LINE=/^(?:Levering|Leverdatum|Levertijd|Leverweek|Bezorgen|Bezorging|Bezorgadres|Afleveradres|Afhalen|Afhaaladres|Postcode)\b/i;
function holidayOrderSections(value:string){
 const rows=(editableFolderOrderText(value)||value.replace(/\r\n?/g,"\n")).split("\n").map(row=>row.trim());
 const start=rows.findIndex(row=>PRODUCT_HEADING.test(row));
 if(start<0){
  const legacy=productionOrderText(value).split("\n");
  return {products:legacy.filter(row=>!LOGISTICS_LINE.test(row)&&!OTHER_HEADING.test(row)).join("\n"),notes:legacy.filter(row=>LOGISTICS_LINE.test(row)).join("\n")};
 }
 const products:string[]=[],notes:string[]=[];
 let inProducts=true,inNotes=false;
 for(const row of rows.slice(start+1)){
  if(OTHER_HEADING.test(row)){inProducts=false;inNotes=true;continue;}
  if(ADMIN_HEADING.test(row)){inProducts=false;inNotes=false;continue;}
  if(PRODUCT_HEADING.test(row))continue;
  if(inProducts){if(LOGISTICS_LINE.test(row))notes.push(row);else products.push(row);}else if(inNotes)notes.push(row);
 }
 return {products:productionOrderText(products.join("\n")),notes:productionOrderText(notes.join("\n"))};
}
export function productionProductsText(value:string){
 // Free legacy text can be the only product source. Keep its description and
 // quantities, removing only clearly labelled commercial sentences.
 return holidayOrderSections(value).products.replace(/(^|[.!?]\s+)(?:Verkoopprijs|Inkoopprijs|Prijsafspraak|Totaalprijs)\b[^.!?\n]*(?:[.!?](?=\s|$)|$)/gim,"$1").trim();
}
export function holidayOrder(order:SinterklaasB2BOrder):HolidayOrder{
 const window=businessDeliveryWindow(order as unknown as Record<string,unknown>);
 const notes=holidayOrderSections(order.orderText).notes;
 const projection={id:order.id,name:order.customerName,season:order.season,date:window?.start || "",dateEnd:window?.end || "",productionDate:order.productionDate,department:order.department,
 products:productionProductsText(order.orderText),letters:order.letterLines.map(line=>`${line.quantity}× ${line.style==="vorm"?"Vormletter":"Spuitletter"} ${line.letter} · ${line.chocolate} · ${line.size}${b2bLetterHasLogo(order,line)?" · eigen logo":""}${line.exceptions.length?` · ${line.exceptions.join(", ")}`:""}`),
 packaging:productionOrderText(order.packaging),instructions:[...new Set(productionOrderText([order.textInstructions,order.importantNotes,notes].filter(Boolean).join("\n")).split("\n"))].join("\n"),logo:/^(https:\/\/|data:image\/(png|jpeg|webp);base64,)/i.test(order.logo)?order.logo:"",productionDone:order.productionDone,letterProductionDone:order.letterProductionDone,hasLetters:order.letterLines.length>0,delivered:order.delivered};
 return {...projection,version:createHash("sha256").update(JSON.stringify([order.updatedAt,projection])).digest("hex")};
}
export function productionHolidayOrders(orders:SinterklaasB2BOrder[],season:string){return orders.filter(o=>o.status==="akkoord"&&!o.cancelled && (o.season===season || o.season==="sint-kerst")).map(holidayOrder).sort((a,b)=>(a.productionDate || a.date || "9999").localeCompare(b.productionDate || b.date || "9999") || a.name.localeCompare(b.name,"nl-NL"));}
