import { createHash } from "node:crypto";
import { editableFolderOrderText } from "../lib/businessFolderOrderText";
import { businessDeliveryWindow } from "../lib/businessOrderDeliveries";
import { b2bLetterHasLogo } from "../sinterklaas/b2bLetterLines";
import type { SinterklaasB2BOrder } from "../sinterklaas/types";
export const PRODUCTION_HOLIDAYS=[{id:"sint",name:"Sinterklaas"},{id:"kerst",name:"Kerst"}] as const;
export type HolidayOrder={id:string;name:string;season:string;date:string;dateEnd:string;productionDate:string;letterProductionDate?:string;letterProductionEnd?:string;department:string;products:string;letters:string[];packaging:string;instructions:string;logo:string;productionDone:boolean;letterProductionDone:boolean;hasLetters:boolean;delivered:boolean;version:string};
export function productionOrderText(value:string){
 let text=editableFolderOrderText(value) || value.replace(/\r\n?/g,"\n");
 const known=text.match(/(?:GEKOZEN SINTERKLAASPRODUCTEN|LOSSE KERSTCADEAUS|KERSTPAKKET OP MAAT)\s+([\s\S]*?)(?:PRIJSINDICATIE|GEWENSTE LEVERING|WENSEN|$)/i);if(known)text=known[1];
 return text.split("\n").filter(line=>!/^\s*(?:PRODUCTEN EN PRIJS|BEDRIJF EN CONTACT|PRIJSINDICATIE|Factuur|Totaal|Prijsafspraak|Bezorgkosten|Bezorgtoeslag|Betaal|E-?mail|Telefoon|Contactpersoon)\b/i.test(line)).map(line=>line.replace(/\s*·?\s*€.*$/,"").trim()).filter(Boolean).join("\n");
}
export function holidayOrder(order:SinterklaasB2BOrder):HolidayOrder{
 const window=businessDeliveryWindow(order as unknown as Record<string,unknown>);
 const projection={id:order.id,name:order.customerName,season:order.season,date:window?.start || "",dateEnd:window?.end || "",productionDate:order.productionDate,department:order.department,
 products:productionOrderText(order.orderText),letters:order.letterLines.map(line=>`${line.quantity}× ${line.style==="vorm"?"Vormletter":"Spuitletter"} ${line.letter} · ${line.chocolate} · ${line.size}${b2bLetterHasLogo(order,line)?" · eigen logo":""}${line.exceptions.length?` · ${line.exceptions.join(", ")}`:""}`),
 packaging:productionOrderText(order.packaging),instructions:productionOrderText([order.textInstructions,order.importantNotes].filter(Boolean).join("\n")),logo:/^(https:\/\/|data:image\/(png|jpeg|webp);base64,)/i.test(order.logo)?order.logo:"",productionDone:order.productionDone,letterProductionDone:order.letterProductionDone,hasLetters:order.letterLines.length>0,delivered:order.delivered};
 return {...projection,version:createHash("sha256").update(JSON.stringify([order.updatedAt,projection])).digest("hex")};
}
export function productionHolidayOrders(orders:SinterklaasB2BOrder[],season:string){return orders.filter(o=>o.status==="akkoord"&&!o.cancelled && (o.season===season || o.season==="sint-kerst")).map(holidayOrder).sort((a,b)=>(a.productionDate || a.date || "9999").localeCompare(b.productionDate || b.date || "9999") || a.name.localeCompare(b.name,"nl-NL"));}
