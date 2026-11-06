"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import Link from "next/link";
import OperationalDialog from "../productie/OperationalDialog";
import Icon from "../productie/ProductionIcon";
import {HEFE_ORDER_PATH,type SupplierView} from "./model";
import s from "./suppliers.module.css";
async function api(body?:unknown){const response=await fetch("/api/leveranciers",{cache:"no-store",...(body?{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}:{})});const data=await response.json();if(!response.ok)throw Error(data.message||"Leveranciers niet bereikbaar.");return data;}
export default function Suppliers({hefePath,request=api}:{hefePath?:string;request?:typeof api}){
 const [suppliers,setSuppliers]=useState<SupplierView[]>([]),[revision,setRevision]=useState(0),[busy,setBusy]=useState(false),[message,setMessage]=useState(""),[loaded,setLoaded]=useState(false);
 const [editing,setEditing]=useState<SupplierView|null>(null),[showArchived,setShowArchived]=useState(false);
 const [credentials,setCredentials]=useState<{id:string;username:string;password:string}|null>(null);
 const availableSuppliers=suppliers.filter(supplier=>supplier.id!=="hefe"||!!hefePath);
 const sequence=useRef(0);
 const load=useCallback(async()=>{const current=++sequence.current;try{const data=await request();if(current!==sequence.current)return;setSuppliers(data.suppliers);setRevision(data.revision);setLoaded(true);setMessage("");}catch(e){if(current===sequence.current)setMessage((e as Error).message);}},[request]);
 useEffect(()=>{void load();},[load]);
 async function reveal(id:string){setBusy(true);setCredentials(null);try{const data=await request({kind:"reveal",id});setCredentials({id,...data});}catch(e){setMessage((e as Error).message);}finally{setBusy(false);}}
 async function save(event:React.FormEvent<HTMLFormElement>){
  event.preventDefault();sequence.current++;setMessage("");const form=new FormData(event.currentTarget);setBusy(true);
  try{const data=await request({kind:"save",revision,supplier:{id:editing!.id,name:form.get("name"),url:form.get("url"),username:editing!.id==="hefe"?editing!.username:form.get("username"),password:editing!.id==="hefe"?"":form.get("password"),clearPassword:form.get("clear")==="on",note:form.get("note"),archived:form.get("archived")==="on"}});setSuppliers(data.suppliers);setRevision(data.revision);setEditing(null);setCredentials(null);setMessage("Opgeslagen.");}catch(e){setMessage((e as Error).message);}finally{setBusy(false);}
 }
 return <section className={s.root}>
  <div className={s.toolbar}><span>Management · bakkerij · logistiek</span><button disabled={busy||!loaded} onClick={()=>setEditing({id:crypto.randomUUID(),name:"",url:"https://",username:"",note:"",hasPassword:false})}><Icon name="plus"/>Leverancier</button><button aria-label="Leveranciers vernieuwen" disabled={busy} onClick={()=>void load()}><Icon name="clock"/></button></div>
  {message&&<p role="status" className={s.message}>{message}</p>}{!loaded&&!message&&<p role="status">Leveranciers laden…</p>}
  <div className={s.grid}>{availableSuppliers.filter(supplier=>showArchived||!supplier.archived).map(supplier=><article className={s.card} key={supplier.id}>
   {supplier.id==="hefe"?(hefePath&&<Link className={s.open} href={hefePath}><Icon name="box"/><strong>{supplier.name}</strong><Icon name="arrow"/></Link>):<a className={s.open} href={supplier.url} target="_blank" rel="noopener noreferrer"><Icon name="box"/><strong>{supplier.name}</strong><Icon name="arrow"/></a>}
   <div className={s.actions}>{supplier.id!=="hefe"&&<button disabled={busy} aria-label={`Inlog ${supplier.name}`} onClick={()=>void reveal(supplier.id)}>i <span>Inlog</span></button>}<button disabled={busy} aria-label={`Wijzig ${supplier.name}`} onClick={()=>{setCredentials(null);setEditing(supplier);}}><Icon name="settings" size={15}/></button>{supplier.id!=="hefe"&&!supplier.username&&!supplier.hasPassword&&<small>Inlog nog invullen</small>}{supplier.archived&&<small>Verborgen</small>}</div>
   {supplier.note&&<p className={s.note}>{supplier.note}</p>}
   {credentials?.id===supplier.id&&<div className={s.credentials}><button className={s.close} aria-label="Inlog sluiten" onClick={()=>setCredentials(null)}><Icon name="close" size={16}/></button>{[["Gebruikersnaam",credentials.username],["Wachtwoord",credentials.password]].map(([label,value])=><div key={label}><small>{label}</small><span>{value||"Nog niet ingevuld"}</span>{value&&<button onClick={async()=>{try{await navigator.clipboard.writeText(value);setMessage(`${label} gekopieerd.`);}catch{setMessage("Kopiëren niet mogelijk. Selecteer de tekst.");}}}>Kopieer</button>}</div>)}</div>}
  </article>)}</div>
  {availableSuppliers.some(supplier=>supplier.archived)&&<label className={s.archived}><input type="checkbox" checked={showArchived} onChange={event=>setShowArchived(event.target.checked)}/>Verborgen leveranciers</label>}
  {editing&&<OperationalDialog labelledBy="supplier-title" className={s.dialog} busy={busy} onClose={()=>setEditing(null)}><header><h2 id="supplier-title">{editing.name||"Leverancier toevoegen"}</h2><button disabled={busy} aria-label="Sluiten" onClick={()=>setEditing(null)}><Icon name="close"/></button></header><form onSubmit={save}>
   <label>Naam<input name="name" defaultValue={editing.name} required maxLength={120}/></label>{editing.id==="hefe"?<input type="hidden" name="url" value={HEFE_ORDER_PATH}/>:<label>Inlogpagina<input name="url" type="url" defaultValue={editing.url} required maxLength={2000}/></label>}
   {editing.id!=="hefe"&&<><label>Gebruikersnaam<input name="username" autoComplete="off" defaultValue={editing.username} maxLength={240}/></label><label>Wachtwoord<input name="password" type="password" autoComplete="new-password" maxLength={500} placeholder={editing.hasPassword?"Leeg laten = behouden":"Nog invullen"}/></label>
   {editing.hasPassword&&<label className={s.check}><input type="checkbox" name="clear"/>Opgeslagen wachtwoord wissen</label>}</>}<label>Notitie<textarea name="note" defaultValue={editing.note} maxLength={1500} rows={2}/></label>
   <label className={s.check}><input name="archived" type="checkbox" defaultChecked={editing.archived}/>Verbergen</label>{editing.updatedBy&&<small>{editing.updatedBy} · {new Date(editing.updatedAt!).toLocaleString("nl-NL")}</small>}
   <footer><button type="button" disabled={busy} onClick={()=>setEditing(null)}>Annuleren</button><button disabled={busy}>{busy?"Opslaan…":"Opslaan"}</button></footer>
  </form>{message&&<p role="alert" className={s.message}>{message}</p>}</OperationalDialog>}
 </section>;
}
