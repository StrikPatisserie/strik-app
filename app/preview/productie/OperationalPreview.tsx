"use client";
import {useCallback,useRef} from "react";
import Link from "next/link";
import Suppliers from "../../leveranciers/Suppliers";
import {changeSupplier,defaultSuppliers,supplierViews,type SupplierDocument} from "../../leveranciers/model";
import ProductionInventory from "../../productie/ProductionInventory";
import {applyInventory,inventoryOverview,type InventoryState,type InventoryCommand} from "../../productie/inventory";
import {addDays,type PreviewState} from "../../productie/planning";

const today="2026-11-06";
const planner:PreviewState={version:1,items:[
 {id:"demo-brok",name:"Speculaasbrok zonder amandel",kind:"product",unit:"stuks",departmentId:"bak",stock:0,note:""},
 {id:"demo-mousse",name:"Vanillemousse",kind:"component",unit:"kg",departmentId:"dessert",stock:0,note:""},
 {id:"demo-kapsel",name:"Vanillekapsels",kind:"component",unit:"stuks",departmentId:"kapsel",stock:0,note:""},
],tasks:[{id:"demo-task",itemId:"demo-brok",departmentId:"bak",date:"2026-11-02",quantity:100,completedQuantity:100,operation:"Bakken",status:"done",source:"manual",batchId:"demo-batch",recordsOutput:true,note:""}]};
const days=Array.from({length:28},(_,i)=>({date:addDays("2026-10-09",i),importedAt:"2026-11-05T19:00:00Z",unknownLines:0,lines:[{article:"DEMO-101",description:"Speculaasbrok",quantity:5}]}));
const initial:InventoryState={revision:1,counts:[{id:"demo-count",itemId:"demo-brok",unit:"stuks",date:"2026-10-08",quantity:180,who:"Voorbeeldbakker",actorId:"demo",at:"2026-10-08T20:00:00Z"}],links:[{itemId:"demo-brok",unit:"stuks",article:"DEMO-101",factor:1,leadDays:2}],actions:[]};
export default function OperationalPreview({view}:{view:"leveranciers"|"voorraad"}){
 const supplierDoc=useRef<SupplierDocument>({revision:0,suppliers:structuredClone(defaultSuppliers)}),stock=useRef(structuredClone(initial));
 const supplierRequest=useCallback(async(body?:unknown)=>{
  const input=body as {kind?:string;id?:string;revision?:number;supplier:Parameters<typeof changeSupplier>[1]}|undefined;
  if(input?.kind==="reveal"){const supplier=supplierDoc.current.suppliers.find(row=>row.id===input.id);return{username:supplier?.username||"",password:supplier?.password||""};}
  if(input?.kind==="save")supplierDoc.current=changeSupplier(supplierDoc.current,input.supplier,"Preview",new Date().toISOString());
  return{revision:supplierDoc.current.revision,suppliers:supplierViews(supplierDoc.current)};
 },[]);
 const stockRequest=useCallback(async(body?:unknown)=>{
  const input=body as {command:InventoryCommand;id:string}|undefined;
  if(input)stock.current=applyInventory(stock.current,input.command,planner.items,"demo",input.id,new Date().toISOString(),today);
  return{revision:stock.current.revision,history:[...stock.current.counts].reverse(),...inventoryOverview(planner,stock.current,days,today)};
 },[]);
 return <main style={{padding:"clamp(18px,3vw,45px)",maxWidth:1500,margin:"auto",fontFamily:"var(--font-sans),sans-serif",color:"#1b3343"}}>
  <nav style={{display:"flex",gap:20,alignItems:"center",marginBottom:24,flexWrap:"wrap"}}><Link href="/preview/productie">← Weekplanning</Link><Link href="?view=leveranciers">Leveranciers</Link><Link href="?view=voorraad">Voorraadbeheer</Link><small>Lokale preview · voorbeeldgegevens · niet opgeslagen</small></nav>
  <h1>{view==="leveranciers"?"Grondstoffen bestellen":"Voorraadbeheer"}</h1>
  {view==="leveranciers"?<Suppliers request={supplierRequest}/>:<ProductionInventory request={stockRequest}/>}
 </main>;
}
