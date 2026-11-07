"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import OperationalDialog from "./OperationalDialog";
import SearchableChoice from "./SearchableChoice";
import Icon from "./ProductionIcon";
import {DEPARTMENTS} from "./planning";
import type {inventoryOverview,InventoryCommand,InventoryCount} from "./inventory";
import s from "./inventory.module.css";
type Overview=ReturnType<typeof inventoryOverview>&{revision:number;history:InventoryCount[]};
const dateLabel=(value:string)=>new Intl.DateTimeFormat("nl-NL",{day:"numeric",month:"short",year:"numeric",timeZone:"Europe/Amsterdam"}).format(new Date(value+"T12:00:00Z"));
const number=(value:number)=>value.toLocaleString("nl-NL",{maximumFractionDigits:2});
async function api(body?:unknown){const response=await fetch("/api/productie/voorraad",{cache:"no-store",...(body?{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}:{})});const data=await response.json();if(!response.ok)throw Error(data.message||"Voorraad niet bereikbaar.");return data as Overview;}
export default function ProductionInventory({request=api}:{request?:typeof api}={}){
 const [data,setData]=useState<Overview|null>(null),[message,setMessage]=useState(""),[busy,setBusy]=useState(false),[search,setSearch]=useState(""),[department,setDepartment]=useState("all");
 const [modal,setModal]=useState<"count"|string|null>(null);
 const [articleId,setArticleId]=useState("");
 const sequence=useRef(0);
 const load=useCallback(async()=>{const current=++sequence.current;try{const next=await request();if(current!==sequence.current)return;setData(next);setMessage("");}catch(e){if(current===sequence.current)setMessage((e as Error).message);}},[request]);
 useEffect(()=>{void load();},[load]);
 useEffect(()=>{if(modal||busy)return;const timer=setInterval(()=>{if(!document.hidden)void load();},60000);return()=>clearInterval(timer);},[load,modal,busy]);
 const rows=(data?.rows||[]).filter(row=>(department==="all"||row.departmentId===department)&&row.name.toLowerCase().includes(search.toLowerCase()));
 const selected=data?.rows.find(row=>row.itemId===modal);
 async function save(command:InventoryCommand){sequence.current++;setBusy(true);setMessage("");try{setData(await request({id:crypto.randomUUID(),revision:data!.revision,command}));setModal(null);setMessage("Opgeslagen.");}catch(e){setMessage((e as Error).message);}finally{setBusy(false);}}
 return <section className={s.root}>
  <div className={s.toolbar}><input aria-label="Zoek voorraadproduct" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Zoek product…"/><select aria-label="Voorraadafdeling" value={department} onChange={e=>setDepartment(e.target.value)}><option value="all">Alle afdelingen</option>{DEPARTMENTS.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select><button disabled={!data||busy} onClick={()=>setModal("count")}><Icon name="plus"/>Telling</button><button disabled={busy} aria-label="Voorraad vernieuwen" onClick={()=>void load()}><Icon name="clock"/></button></div>
  {message&&<p role="status" className={s.message}>{message}</p>}
  {!data&&!message&&<p role="status">Voorraad laden…</p>}
  {data&&<><div className={s.source}><span>Bonnen: {data.sourceFrom?`${dateLabel(data.sourceFrom)} – ${dateLabel(data.sourceUntil||data.sourceFrom)}`:"nog geen bron"}</span><span>Uitgifte uit de bakkerij · productieweek is een richtweek</span></div>
   <div className={s.scroll}><table><thead><tr><th>Product</th><th>Laatste productie</th><th>Laatste telling</th><th>Gemaakt¹</th><th>Uit bonnen¹</th><th>Verwacht saldo</th><th>Weer maken</th><th/></tr></thead><tbody>{rows.map(row=><tr key={row.itemId}>
    <th><strong>{row.name}</strong><small>{row.unit}{row.link?.article?` · ${row.link.article}`:""}</small></th><td>{row.latest?<>{dateLabel(row.latest.date)}<small>{number(row.latest.quantity)} {row.unit}</small></>:"—"}</td>
    <td>{row.count?<>{number(row.count.quantity)}<small>{dateLabel(row.count.date)} · {row.count.who}</small></>:<span className={s.warning}>Telling nodig</span>}</td><td>{row.count?number(row.made):"—"}</td><td>{row.issued===null?"—":number(row.issued)}</td>
    <td>{row.checkpoint&&row.count?<><strong>{number(row.count.quantity)} over</strong><small>Geteld {dateLabel(row.count.date)}, {new Intl.DateTimeFormat("nl-NL",{timeZone:"Europe/Amsterdam",hour:"2-digit",minute:"2-digit"}).format(new Date(row.count.at))}</small><small>Einde-dagtelling nodig voor prognose</small></>:row.balance===null?"—":<>ca. {number(row.balance)}<small>t/m {dateLabel(row.through)}</small><small>{!row.link?.article?"Artikel koppelen":!row.known?`${row.missingDays} dag(en) bron ontbreekt`:row.balance<0?"Telling controleren":"op basis van bonnen"}</small></>}</td>
    <td>{row.productionWeek?<strong className={row.productionWeek.date<=data.asOf?s.warning:""}>Week {row.productionWeek.week}<small>{dateLabel(row.productionWeek.date)}</small></strong>:<small>{row.checkpoint?"Einde-dagtelling nodig":!row.link?.article?"Artikel koppelen":!row.count?"Eerst tellen":"Meer brongegevens nodig"}</small>}</td>
    <td><button aria-label={`Artikel koppelen ${row.name}`} title="Artikel en productietermijn" onClick={()=>{setArticleId(row.link?.article||"");setModal(row.itemId);}}><Icon name="link" size={16}/></button></td>
   </tr>)}</tbody></table></div><p className={s.footnote}>¹ Sinds de laatste telling. Richtweek na 28 complete brondagen; geen ontbrekende dagen als nul geteld.</p>
   <details className={s.history}><summary>Telhistorie</summary>{data.history.length?data.history.map(row=><p key={row.id}><strong>{data.rows.find(item=>item.itemId===row.itemId)?.name||row.itemId}</strong> · {row.stockUse?<>{number(row.stockUse.countedQuantity)} geteld − {number(row.stockUse.quantity)} gebruikt = </>:null}{number(row.quantity)} {row.unit}{row.stockUse?" over":""} · {dateLabel(row.date)} · {row.who} <small>Q{Math.ceil(Number(row.date.slice(5,7))/3)} {row.date.slice(0,4)}</small></p>):<p>Nog geen tellingen.</p>}</details>
  </>}
  {modal&&data&&<OperationalDialog className={s.dialog} labelledBy="inventory-title" busy={busy} onClose={()=>setModal(null)}><header><h2 id="inventory-title">{modal==="count"?"Voorraad tellen":selected?.name}</h2><button disabled={busy} aria-label="Sluiten" onClick={()=>setModal(null)}><Icon name="close"/></button></header>
   <form onSubmit={event=>{event.preventDefault();const form=new FormData(event.currentTarget);if(modal==="count")void save({kind:"count",date:String(form.get("date")),who:String(form.get("who")),entries:rows.flatMap(row=>{const value=String(form.get(`count:${row.itemId}`)||"").trim();return value?[{itemId:row.itemId,quantity:Number(value.replace(",","."))}]:[]})});else void save({kind:"link",itemId:modal,article:String(form.get("article")),factor:Number(String(form.get("factor")).replace(",",".")),leadDays:Number(form.get("leadDays"))});}}>
    {modal==="count"?<><div className={s.fields}><label>Telstand per einde dag<input type="date" name="date" defaultValue={data.asOf} max={data.asOf} required/></label><label>Jouw naam<input name="who" required minLength={2} maxLength={80}/></label></div><small>Leeg laten = niet geteld. Een nieuwe telling vervangt de rekenbasis; eerdere tellingen blijven bewaard.</small><div className={s.counts}>{rows.map(row=><label key={row.itemId}><span>{row.name}<small>{row.unit}</small></span><input name={`count:${row.itemId}`} aria-label={`Tel ${row.name}`} inputMode="decimal" placeholder="—"/></label>)}</div></>:<><SearchableChoice name="article" label="Bake-it-artikel" value={articleId} onChange={setArticleId} disabled={busy} placeholder="Zoek artikelnummer of omschrijving…" resultsLabel="Bake-it-artikelen" clearLabel="Artikelkoppeling wissen" emptyMessage="Geen artikelen gevonden." choices={data.articles.map(article=>({id:article.article,name:article.description||article.article,description:`Artikel ${article.article}`,searchValues:[article.article,article.description]}))}/>{articleId&&<small>Gekozen artikel {articleId}</small>}<label>{selected?.unit} per eenheid op de bon<input name="factor" defaultValue={selected?.link?.factor??1} inputMode="decimal" required/></label><label>Dagen vóór verwacht opraken produceren<input name="leadDays" type="number" min="0" max="60" required defaultValue={selected?.link?.leadDays??1}/></label><small>Controleer artikel en omrekening. Een bon telt alleen mee bij een exact gekoppeld artikelnummer.</small></>}
    <footer><button type="button" disabled={busy} onClick={()=>setModal(null)}>Annuleren</button><button disabled={busy}>{busy?"Opslaan…":"Opslaan"}</button></footer>
   </form>{message&&<p role="alert" className={s.message}>{message}</p>}
  </OperationalDialog>}
 </section>;
}
