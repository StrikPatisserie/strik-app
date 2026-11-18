"use client";
/* eslint-disable @next/next/no-img-element -- existing order logo URLs can require their original source. */
import Link from "next/link";
import { useCallback,useEffect,useRef,useState,type ReactNode } from "react";
import B2BProductText from "../sinterklaas/b2b/B2BProductText";
import Icon from "./ProductionIcon";
import { dateLabel,matchesProductionSearch } from "./planning";
import type { HolidayOrder } from "./holidayPlanning";
import { productionTotalDate,productionTotalsText,type ProductionTotals } from "../sinterklaas/b2b/productionTotals";
import s from "../preview/productie/production.module.css";
type Batch={id:string;startDate:string;date:string;status:string;checklist?:{revision:number;lockedAt?:string|null;planToken:string;changes:{key:string;label:string;before:number;after:number}[]};rows:{key:string;label:string;orders:number;stock:number;produced:number;recipients?:{customerName:string;quantity:number}[]}[]};
type Data={orders:HolidayOrder[];productionTotals:ProductionTotals;batches:Batch[];updatedAt:string;letterError?:string;unplannedCount:number};
const count=(n:number)=>n.toLocaleString("nl-NL",{maximumFractionDigits:1});
function moment(date:string,end?:string){if(!date)return "Levermoment controleren";try{return end && end!==date?`${dateLabel(date,true)} – ${dateLabel(end,true)}`:dateLabel(date,true);}catch{return "Levermoment controleren";}}
function HolidayDialog({label,onClose,children}:{label:string;onClose:()=>void;children:ReactNode}){
 const dialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{const element=dialog.current;element?.showModal();return()=>element?.close();},[]);
 return <dialog ref={dialog} className={s.holidayOverlay} aria-label={label} onCancel={event=>{event.preventDefault();onClose();}}><div>{children}</div></dialog>;
}
function HolidayProductionTotals({totals,season,year,onClose}:{totals:ProductionTotals;season:"sint"|"kerst";year:string;onClose:()=>void}){
 const [copied,setCopied]=useState(false),[fallback,setFallback]=useState(false);
 async function copy(){try{await navigator.clipboard.writeText(productionTotalsText(totals));setCopied(true);}catch{setFallback(true);}}
 return <HolidayDialog label="Productie opteller" onClose={onClose}>
  <header className={s.holidayOptellerHeader}><div><h2>Productie opteller</h2><p>{season==="sint"?"Sinterklaas":"Kerst"} {year} · definitief, nog te maken</p></div><button className={s.secondaryButton} aria-label="Opteller sluiten" onClick={onClose}><Icon name="close" size={18}/></button></header>
  <div className={s.holidayOptellerBody}>
   {totals.products.map(group=><details key={group.key} className={s.holidayProductTotal}>
    <summary><span>{group.product}</span><strong>{count(group.quantity)} <small>{group.unit}</small></strong><Icon name="chevron" size={15}/></summary>
    <ul>{group.allocations.map(item=><li key={item.orderId}><strong>{count(item.quantity)}×</strong><span>{productionTotalDate(item)}</span><span>{item.customer}</span></li>)}</ul>
   </details>)}
   {!totals.products.length && <p className={s.holidayEmpty}>Geen producten meer om op te tellen.</p>}
   {totals.issues.length>0 && <details className={s.holidayTotalIssues}><summary><Icon name="warning" size={14}/>{totals.issues.length} {totals.issues.length===1?"bestelling":"bestellingen"} controleren</summary>{totals.issues.map(issue=><p key={issue.orderId}><strong>{issue.customer}</strong> · {issue.message}</p>)}</details>}
   {totals.skippedLetters>0 && <p className={s.fieldHint}>Losse chocoladeletters staan in de letterplanning.</p>}
   {fallback && <textarea aria-label="Producttotalen kopiëren" readOnly rows={5} value={productionTotalsText(totals)} onFocus={event=>event.target.select()}/>}
  </div>
  <footer className={s.holidayOptellerFooter}><span>{totals.orderCount} definitieve bestellingen</span><button className={s.secondaryButton} disabled={!totals.products.length} onClick={()=>void copy()}>{copied?"Gekopieerd":"Kopieer lijst"}</button></footer>
 </HolidayDialog>;
}
export default function HolidayProduction({season,initialYear}:{season:"sint"|"kerst";initialYear:string}){
 const [year,setYear]=useState(initialYear),[tab,setTab]=useState("orders"),[filter,setFilter]=useState("open"),[department,setDepartment]=useState("all"),[search,setSearch]=useState(""),[data,setData]=useState<Data|null>(null),[error,setError]=useState(""),[saving,setSaving]=useState(false),[wall,setWall]=useState(false),[logo,setLogo]=useState<string|null>(null),[revision,setRevision]=useState<Batch|null>(null);
 const [saveError,setSaveError]=useState(""),[showTotals,setShowTotals]=useState(false);
 const pending=useRef(false),epoch=useRef(0),url=`/api/productie/feestdagen?season=${season}&year=${year}`;
 const invalidateLoad=useCallback(()=>{epoch.current++;},[]);
 const load=useCallback(async()=>{if(pending.current)return;const serial=++epoch.current;try{const response=await fetch(url,{cache:"no-store"}),result=await response.json();if(!response.ok)throw Error(result.message || "Productie laden is mislukt.");if(serial===epoch.current){setData(result);setError("");}}catch(e){if(serial===epoch.current)setError((e as Error).message);}},[url]);
 useEffect(()=>{setData(null);setSaveError("");setShowTotals(false);void load();const timer=setInterval(()=>{if(!document.hidden)void load();},15000);return()=>{clearInterval(timer);invalidateLoad();};},[load,invalidateLoad]);
 async function save(input:unknown){if(pending.current)return;pending.current=true;epoch.current++;setSaving(true);setSaveError("");try{const response=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(input)}),result=await response.json();if(!response.ok)throw Error(result.message || "Opslaan is mislukt.");if(result.order)setData(current=>current?{...current,orders:current.orders.map(o=>o.id===result.order.id?{...o,...result.order}:o)}:current);setRevision(null);}catch(e){setSaveError((e as Error).message);}finally{pending.current=false;setSaving(false);await load();}}
 const isDone=(o:HolidayOrder)=>o.hasLetters && o.department!=="chocolade"?o.productionDone && o.letterProductionDone:o.productionDone;
 const orders=data?.orders.filter(o=>(filter==="all" || (filter==="open"?!isDone(o):isDone(o))) && (department==="all" || o.department===department || o.department==="beide") && matchesProductionSearch(search,[o.name,o.products,...o.letters,o.instructions,o.packaging])) || [];
 const batches=data?.batches || [],totals=batches.flatMap(b=>b.rows).reduce((sum,r)=>({ordered:sum.ordered+r.orders+r.stock,made:sum.made+r.produced,remaining:sum.remaining+Math.max(0,r.orders+r.stock-r.produced),surplus:sum.surplus+Math.max(0,r.produced-r.orders-r.stock)}),{ordered:0,made:0,remaining:0,surplus:0});
 return <div className={wall?s.holidayWall:""} aria-busy={saving}>
  <div className={s.holidayToolbar}>
   <Link href="/bakkerij/productie/feestdagen" className={s.textLink}><Icon name="back" size={16}/>Feestdagen</Link>
   <nav className={s.resourceTabs} aria-label="Feestdag"><Link href={`/bakkerij/productie/feestdagen/sint?year=${year}`} aria-current={season==="sint"?"page":undefined}>Sinterklaas</Link><Link href={`/bakkerij/productie/feestdagen/kerst?year=${year}`} aria-current={season==="kerst"?"page":undefined}>Kerst</Link></nav>
   <div className={s.holidayTabs}><button aria-pressed={tab==="orders"} onClick={()=>setTab("orders")}>B2B · {data?.orders.length || 0}</button>{season==="sint" && <button aria-pressed={tab==="letters"} onClick={()=>setTab("letters")}>Letters · {count(totals.made)} / {count(totals.ordered)}</button>}</div>
   <div className={s.holidayTools}>
    {tab==="orders" && <button className={s.secondaryButton} aria-label="Producten optellen" disabled={saving || !data?.productionTotals || !!error} onClick={()=>setShowTotals(true)}><Icon name="stock" size={16}/>Optellen</button>}
    <label className={s.field}><span className={s.srOnly}>Jaar</span><select value={year} disabled={saving} onChange={e=>setYear(e.target.value)}>{[-1,0,1].map(offset=><option key={offset}>{Number(initialYear)+offset}</option>)}</select></label>
    <button className={s.secondaryButton} aria-label="Productie vernieuwen" title={data?.updatedAt?`Bijgewerkt ${new Intl.DateTimeFormat("nl-NL",{hour:"2-digit",minute:"2-digit",timeZone:"Europe/Amsterdam"}).format(new Date(data.updatedAt))}`:"Vernieuwen"} onClick={()=>{setSaveError("");void load();}} disabled={saving}><Icon name="refresh" size={16}/></button>
    <button className={s.secondaryButton} aria-pressed={wall} onClick={()=>setWall(!wall)}><Icon name="screen" size={16}/>{wall?"Sluit XL":"XL weergave"}</button>
   </div>
  </div>
  {error && <p role="alert" className={s.formError}>{error} De getoonde gegevens kunnen verouderd zijn.</p>}
  {saveError && <p role="alert" className={s.formError}>{saveError} Controleer de actuele lijst voordat je opnieuw afvinkt.</p>}
  {!data && !error && <div role="status" className={s.loadingInline}><span className={s.spinner}/>Productiegegevens laden…</div>}
  {data && tab==="orders" && <><div className={s.listToolbar}><input type="search" aria-label="Zoek B2B-productie" placeholder="Zoek klant, product of letter…" value={search} onChange={e=>setSearch(e.target.value)}/><select aria-label="Voortgang" value={filter} onChange={e=>setFilter(e.target.value)}><option value="open">Nog te maken</option><option value="all">Alle definitieve orders</option><option value="done">Gemaakt</option></select><select aria-label="Productieafdeling" value={department} onChange={e=>setDepartment(e.target.value)}><option value="all">Alle afdelingen</option><option value="bakkerij">Bakkerij</option><option value="chocolade">Chocolade</option></select></div>
  <div className={s.holidayOrders}>
   <table className={s.holidayOrderTable} aria-label="B2B-productie">
    <caption className={s.srOnly}>Definitieve B2B-bestellingen voor de bakkerij</caption>
    <colgroup><col className={s.holidayDeliveryColumn}/><col/><col className={s.holidayProgressColumn}/></colgroup>
    <thead><tr><th scope="col">Levering / klant</th><th scope="col">Bestelling</th><th scope="col">Klaar</th></tr></thead>
    <tbody>{orders.map(o=>{
     const mixed=o.hasLetters && o.department!=="chocolade";
     return <tr key={o.id} aria-label={o.name} className={isDone(o)?s.holidayDone:undefined}>
      <th scope="row" className={s.holidayDelivery}><span className={s.holidayDate}>{moment(o.date,o.dateEnd)}</span><span className={s.holidayCustomer}>{o.name}</span></th>
      <td className={s.holidayProducts}>
       <ul className={s.holidayOrderLines}>{o.products.split(/\n+/).map(line=>line.trim()).filter(Boolean).map((line,index)=><li key={index}><B2BProductText text={line} icon="camera"/></li>)}</ul>
       <div className={s.holidayOrderExtras}>
        {o.letters.length>0 && <details><summary>Letterverdeling</summary>{o.letters.map((line,index)=><p key={index}>{line}</p>)}</details>}
        {o.logo && <button className={s.textLink} aria-label={`Logo bekijken: ${o.name}`} onClick={()=>setLogo(o.logo)}><Icon name="link" size={13}/>Logo</button>}
        {(o.packaging || o.instructions || o.productionDate || o.letterProductionDate) && <details><summary>Details</summary>
         {o.packaging && <p>{o.packaging}</p>}{o.instructions && <p>{o.instructions}</p>}
         {o.productionDate && <small>Productie {moment(o.productionDate)}</small>}
         {o.letterProductionDate && <small>Letterproductie {moment(o.letterProductionDate,o.letterProductionEnd)}</small>}
        </details>}
       </div>
      </td>
      <td className={s.holidayStatus}><div className={s.holidayProgress}>
       {mixed && <label title="Letters gemaakt"><input type="checkbox" aria-label={`Letters gemaakt: ${o.name}`} checked={o.letterProductionDone} disabled={saving || o.delivered} onChange={e=>void save({id:o.id,field:"letterProductionDone",done:e.target.checked,version:o.version})}/>Letters</label>}
       <label title={o.hasLetters && o.department==="chocolade"?"Letters gemaakt":mixed?"Overig gemaakt":"Gemaakt"}><input type="checkbox" aria-label={`${o.hasLetters && o.department==="chocolade"?"Letters gemaakt":mixed?"Overig gemaakt":"Gemaakt"}: ${o.name}`} checked={o.productionDone} disabled={saving || o.delivered} onChange={e=>void save({id:o.id,field:"productionDone",done:e.target.checked,version:o.version})}/>{mixed?"Overig":null}</label>
       {o.delivered && <small>Geleverd</small>}
      </div></td>
     </tr>;
    })}</tbody>
   </table>
   {!orders.length && <p className={s.holidayEmpty}>Geen bestellingen met deze filters.</p>}
  </div></>}
  {data && tab==="letters" && <>{data.letterError && <p role="alert" className={s.formError}>{data.letterError}</p>}<div className={s.holidayTotals}><strong>{count(totals.ordered)} te produceren</strong><span>{count(totals.made)} gemaakt</span><b>{count(totals.remaining)} nog te maken</b>{totals.surplus>0 && <b>{count(totals.surplus)} te veel gemaakt</b>}{!!data.unplannedCount && <small>{data.unplannedCount} bestellingen nog niet aan een productiedag gekoppeld.</small>}</div>{batches.map((batch,index)=><details className={s.holidayBatch} key={batch.id} open={index===0}><summary><strong>Productie {moment(batch.startDate || batch.date,batch.date)}</strong><span>{count(batch.rows.reduce((sum,r)=>sum+r.produced,0))} / {count(batch.rows.reduce((sum,r)=>sum+r.orders+r.stock,0))} gemaakt</span></summary>{!!batch.checklist?.changes.length && <div className={s.planWarning}>Er zijn {batch.checklist.changes.length} wijzigingen sinds de productielijst is vastgezet. <button className={s.textLink} onClick={()=>setRevision(batch)}>Verschillen controleren</button></div>}<div className={s.letterProductionHeader}><span>Letter / uitvoering</span><span>Besteld + voorraad</span><span>Gemaakt</span><span>Klaar</span></div>{batch.rows.filter(r=>r.orders+r.stock>0 || r.produced>0).map(row=><div className={s.letterProductionRow} key={row.key}><div><strong>{row.label}</strong>{!!row.recipients?.length && <details><summary>Voor wie?</summary>{row.recipients.map((recipient,i)=><small key={i}>{recipient.quantity}× {recipient.customerName}</small>)}</details>}</div><span>{row.orders} + {row.stock} = <b>{row.orders+row.stock}</b>{row.produced>row.orders+row.stock && <small>{row.produced-row.orders-row.stock} te veel gemaakt</small>}</span><input aria-label={`Gemaakt ${row.label}`} type="number" min="0" step="1" key={`${batch.checklist?.revision}:${row.key}`} defaultValue={row.produced} disabled={saving || Boolean(data.letterError)} onBlur={e=>{const value=Number(e.target.value);if(value!==row.produced)void save({kind:"letters",batchId:batch.id,revision:batch.checklist?.revision || 0,key:row.key,quantity:value});}}/><input aria-label={`Klaar ${row.label}`} type="checkbox" checked={row.orders+row.stock>0 && row.produced>=row.orders+row.stock} disabled={saving || Boolean(data.letterError)} onChange={e=>void save({kind:"letters",batchId:batch.id,revision:batch.checklist?.revision || 0,key:row.key,quantity:e.target.checked?row.orders+row.stock:0})}/></div>)}{!batch.checklist?.lockedAt && <p className={s.fieldHint}>Aantallen lopen mee met de bestellingen. Gemaakte aantallen kun je nu al registreren.</p>}</details>)}{!batches.length && !data.letterError && <p>Geen productiedagen voor dit jaar gevonden.</p>}</>}
  {showTotals && data?.productionTotals && <HolidayProductionTotals key={`${season}:${year}`} totals={data.productionTotals} season={season} year={year} onClose={()=>setShowTotals(false)}/>}
  {logo && <HolidayDialog label="Eigen logo" onClose={()=>setLogo(null)}><button className={s.secondaryButton} onClick={()=>setLogo(null)}>Sluiten</button><img src={logo} alt="Logo bij de bestelling"/></HolidayDialog>}
  {revision && <HolidayDialog label="Productiewijzigingen" onClose={()=>setRevision(null)}><h2>Wijzigingen productielijst</h2><div className={s.planChanges}>{revision.checklist?.changes.map(c=><div key={c.key}><strong>{c.label}</strong><span>{c.before} → {c.after}</span></div>)}</div><p>Gemaakte aantallen blijven behouden. Controleer het nieuwe benodigde aantal voordat je bijwerkt.</p><div className={s.weddingActions}><button className={s.secondaryButton} onClick={()=>setRevision(null)}>Annuleren</button><button disabled={saving} className={s.primaryButton} onClick={()=>void save({kind:"letters-revise",batchId:revision.id,revision:revision.checklist?.revision,planToken:revision.checklist?.planToken})}>Productielijst bijwerken</button></div></HolidayDialog>}
 </div>;
}
