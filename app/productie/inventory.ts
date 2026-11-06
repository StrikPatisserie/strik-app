import {addDays,mondayOf,weekNumber,type Item,type PreviewState} from "./planning";
import type {LogisticsBatch} from "../bakkerij/logistiek/logisticsTypes";
export type DispatchDay={date:string;importedAt:string;lines:{article:string;description:string;quantity:number}[];unknownLines:number};
export type InventoryCount={id:string;itemId:string;unit:string;date:string;quantity:number;who:string;actorId:string;at:string};
export type InventoryLink={itemId:string;article:string;factor:number;leadDays:number;unit:string};
export type InventoryState={revision:number;counts:InventoryCount[];links:InventoryLink[];actions:string[]};
export const INVENTORY_KEY="production_inventory_v1";
export const DISPATCH_PREFIX="production_dispatch_v1_";
export const emptyInventory=():InventoryState=>({revision:0,counts:[],links:[],actions:[]});
export const articleKey=(value:string)=>value.trim().toUpperCase().replace(/\s+/g,"");
const round=(n:number)=>Math.round(n*1000000)/1000000;
const validDate=(date:string)=>{addDays(date,0);return date;};
export function dispatchDay(batch:LogisticsBatch):DispatchDay|null{
 if(batch.status!=="definitief")return null;
 validDate(batch.date);
 const lines=new Map<string,DispatchDay["lines"][number]>(),seen=new Set<string>();let unknownLines=0;
 for(const receipt of batch.receipts){
  const identity=receipt.receiptNumber||receipt.id;
  if(!identity||seen.has(identity))continue;seen.add(identity);
  for(const line of receipt.lines){
   const article=articleKey(line.catalogArticleNumber||line.articleNumber||"");
   const raw=line.quantity.trim().replace(/\s/g,"");
   // Parser quantities use a decimal comma; do not guess at ambiguous 1.000.
   const value=/^-?\d+(?:[.,]\d+)?$/.test(raw)&&!/^\d{1,3}(?:\.\d{3})+$/.test(raw)?Number(raw.replace(",",".")):NaN;
   if(!article||!Number.isFinite(value)||Math.abs(value)>1000000){unknownLines++;continue;}
   const old=lines.get(article);lines.set(article,{article,description:line.description.slice(0,240),quantity:round((old?.quantity||0)+value)});
  }
 }
 return{date:batch.date,importedAt:batch.importedAt,lines:[...lines.values()].sort((a,b)=>a.article.localeCompare(b.article)),unknownLines};
}
export function mergeDispatchDays(current:DispatchDay[],incoming:DispatchDay[]){
 const days=new Map(current.map(day=>[day.date,day]));
 for(const day of incoming){const old=days.get(day.date);if(!old||day.importedAt>=old.importedAt)days.set(day.date,day);}
 return [...days.values()].sort((a,b)=>a.date.localeCompare(b.date));
}
export function dispatchDaysFromBatches(batches:LogisticsBatch[]){
 const days:DispatchDay[]=[];for(const batch of batches){const day=dispatchDay(batch);if(day)days.push(day);}return mergeDispatchDays([],days);
}
export type InventoryCommand={kind:"count";date:string;who:string;entries:{itemId:string;quantity:number}[]}|{kind:"link";itemId:string;article:string;factor:number;leadDays:number};
export function applyInventory(state:InventoryState,command:InventoryCommand,items:Item[],actorId:string,actionId:string,now:string,today:string):InventoryState{
 if(state.actions.includes(actionId))return state;
 const itemFor=(id:string)=>{const item=items.find(i=>i.id===id&&i.kind!=="activity");if(!item)throw Error("Kies een bestaand voorraadproduct.");return item;};
 let counts=state.counts,links=state.links;
 if(command.kind==="count"){
  validDate(command.date);if(command.date>today||command.date<"2020-01-01")throw Error("Kies een geldige teldag, uiterlijk vandaag.");
  if(typeof command.who!=="string"||command.who.trim().length<2||command.who.length>80)throw Error("Vul je naam in.");
  if(!Array.isArray(command.entries)||!command.entries.length||command.entries.length>500||new Set(command.entries.map(e=>e.itemId)).size!==command.entries.length)throw Error("Controleer de telregels.");
  const entries=command.entries.map(entry=>{const item=itemFor(entry.itemId);if(!Number.isFinite(entry.quantity)||entry.quantity<0||entry.quantity>1000000)throw Error("Vul een voorraad tussen 0 en 1.000.000 in.");return{id:`${actionId}:${item.id}`,itemId:item.id,quantity:entry.quantity,unit:item.unit,date:command.date,who:command.who.trim(),actorId,at:now};});
  counts=[...state.counts,...entries];
 }else if(command.kind==="link"){
  const item=itemFor(command.itemId);if(typeof command.article!=="string"||command.article.length>100||!Number.isFinite(command.factor)||command.factor<=0||command.factor>1000000||!Number.isInteger(command.leadDays)||command.leadDays<0||command.leadDays>60)throw Error("Controleer artikel, omrekenfactor en productiedagen vooraf.");
  const article=articleKey(command.article);
  // One stock source per article: two products must not both deduct the same sale.
  if(article&&links.some(link=>link.article===article&&link.itemId!==item.id))throw Error("Dit artikel is al aan een ander voorraadproduct gekoppeld.");
  links=[...links.filter(link=>link.itemId!==item.id),{itemId:item.id,unit:item.unit,article,factor:command.factor,leadDays:command.leadDays}];
 }else throw Error("Onbekende voorraadactie.");
 return{revision:state.revision+1,counts,links,actions:[...state.actions.slice(-999),actionId]};
}
function productionRows(planner:PreviewState,item:Item){
 const seen=new Set<string>();return planner.tasks.filter(task=>{
  if(task.itemId!==item.id||!task.recordsOutput||task.status!=="done"||seen.has(task.batchId))return false;seen.add(task.batchId);return true;
 }).map(task=>({date:planner.productionWork?.completions?.[task.id]?.at?new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Amsterdam",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(planner.productionWork.completions[task.id].at)):task.date,quantity:task.completedQuantity??task.quantity}));
}
export function inventoryOverview(planner:PreviewState,state:InventoryState,days:DispatchDay[],asOf:string){
 validDate(asOf);
 const closedThrough=days.filter(day=>day.date<=asOf).at(-1)?.date||asOf;
 const recentFrom=addDays(closedThrough,-27),observed=days.filter(day=>day.date>=recentFrom&&day.date<=closedThrough&&day.unknownLines===0),coverage=new Set(days.filter(day=>day.unknownLines===0).map(day=>day.date));
 const rows=planner.items.filter(item=>item.kind!=="activity"&&!item.id.startsWith("wedding:")).map(item=>{
  const count=state.counts.filter(row=>row.itemId===item.id&&row.unit===item.unit&&row.date<=asOf).reverse().sort((a,b)=>b.date.localeCompare(a.date)||b.at.localeCompare(a.at)).at(0);
  const link=state.links.find(row=>row.itemId===item.id&&row.unit===item.unit),production=productionRows(planner,item);
  const through=count&&count.date>closedThrough?count.date:closedThrough;
  const latest=production.filter(row=>row.date<=asOf).sort((a,b)=>b.date.localeCompare(a.date)).at(0);
  const made=round(production.filter(row=>count&&row.date>count.date&&row.date<=through).reduce((total,row)=>total+row.quantity,0));
  const issued=count&&link?.article?round(days.filter(day=>day.date>count.date&&day.date<=through).reduce((total,day)=>total+(day.lines.find(line=>line.article===link.article)?.quantity||0)*link.factor,0)):null;
  const missing:string[]=[];
  if(count)for(let date=addDays(count.date,1);date<=through;date=addDays(date,1)){if(!coverage.has(date))missing.push(date);}
  const balance=count?round(count.quantity+made-(issued||0)):null;
  const known=!!count&&(count.date===through||!!link?.article&&missing.length===0);
  const recentQuantity=link?.article?observed.reduce((total,day)=>total+(day.lines.find(line=>line.article===link.article)?.quantity||0)*link.factor,0):0;
  // A full 28-day window is needed. Missing days are never invented as zero.
  const rate=observed.length===28&&recentQuantity>0?recentQuantity/28:null;
  const runOut=known&&balance!==null&&rate?addDays(through,Math.min(3650,Math.max(0,Math.floor(balance/rate)))):null;
  const productionDate=runOut&&link?addDays(runOut,-link.leadDays):null;
  return{itemId:item.id,name:item.name,unit:item.unit,kind:item.kind,departmentId:item.departmentId,through,count:count||null,latest:latest||null,made,issued,balance,known,missingDays:missing.length,link:link||null,productionWeek:productionDate?{date:productionDate,monday:mondayOf(productionDate),week:weekNumber(productionDate)}:null};
 });
 const articles=new Map<string,string>();for(const day of days)for(const line of day.lines)articles.set(line.article,line.description);
 return{asOf,rows,articles:[...articles].map(([article,description])=>({article,description})),sourceFrom:days[0]?.date||null,sourceUntil:days.filter(day=>day.date<=asOf).at(-1)?.date||null,forecastDays:observed.length,unknownLines:observed.reduce((n,day)=>n+day.unknownLines,0)};
}
