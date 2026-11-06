"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import Icon from "./ProductionIcon";
import ScreenMessageCard from "./ScreenMessageCard";
import {screenDate,type ScreenMessage,type ScreenMessageDocument} from "./screenMessages";
import s from "./screenMessages.module.css";
export type ScreenMessagesAdmin=ScreenMessageDocument&{now:string};
export type SaveScreenMessageInput={revision:number;message:ScreenMessage};
async function api(body?:SaveScreenMessageInput):Promise<ScreenMessagesAdmin>{
 const response=await fetch("/api/productie/schermberichten",{cache:"no-store",...(body?{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}:{})});
 const data=await response.json();if(!response.ok)throw Error(data.message||"Schermberichten niet bereikbaar.");return data;
}
const dateLabel=(date:string)=>new Intl.DateTimeFormat("nl-NL",{day:"numeric",month:"short",year:"numeric"}).format(new Date(date+"T12:00:00Z"));
export default function ScreenMessagesEditor({request=api}:{request?:typeof api}){
 const [data,setData]=useState<ScreenMessagesAdmin|null>(null),[editing,setEditing]=useState<ScreenMessage|null>(null),[preview,setPreview]=useState<ScreenMessage|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
 const serial=useRef(0);
 const load=useCallback(async()=>{const id=++serial.current;try{const next=await request();if(id!==serial.current)return;setData(next);setError("");}catch(e){if(id===serial.current)setError((e as Error).message);}},[request]);
 useEffect(()=>{void load();},[load]);
 const today=screenDate(data?.now||new Date());
 function newMessage(){setNotice("");setError("");setEditing({id:crypto.randomUUID(),version:1,title:"",body:"",startDate:today,endDate:today,enabled:true});}
 async function save(event:React.FormEvent<HTMLFormElement>){
  event.preventDefault();if(!editing||!data)return;setBusy(true);setError("");setNotice("");serial.current++;
  try{setData(await request({revision:data.revision,message:editing}));setEditing(null);setNotice("Klaargezet voor het bakkerijscherm.");}catch(e){setError((e as Error).message);}finally{setBusy(false);}
 }
 function update(key:keyof ScreenMessage,value:string|boolean){setEditing(current=>current?{...current,[key]:value}:null);}
 return <section className={s.editor}>
  <header className={s.editorToolbar}><span>Alleen de bakkerij-inlog · verdwijnt automatisch na de einddatum</span><button disabled={!data||busy||!!editing} onClick={newMessage}><Icon name="plus"/>Nieuw bericht</button></header>
  {error&&<p role="alert" className={s.error}>{error} <button disabled={busy} onClick={()=>void load()}>Vernieuwen</button></p>}{notice&&<p role="status" className={s.notice}>{notice}</p>}
  {!data&&!error&&<p role="status">Berichten laden…</p>}
  {editing?<form className={s.form} onSubmit={save} data-production-update-block="true">
   <div className={s.formHeading}><h2>{editing.title||"Nieuw schermbericht"}</h2><button type="button" aria-label="Bewerken sluiten" disabled={busy} onClick={()=>setEditing(null)}><Icon name="close"/></button></div>
   <label>Titel<input value={editing.title} onChange={event=>update("title",event.target.value)} required maxLength={120} placeholder="Wat wil je vertellen?"/></label>
   <label>Bericht<textarea value={editing.body} onChange={event=>update("body",event.target.value)} required maxLength={1600} rows={4} placeholder="Kort, duidelijk en persoonlijk."/></label>
   <div className={s.dates}><label>Vanaf<input type="date" value={editing.startDate} onChange={event=>update("startDate",event.target.value)} required/></label><label>Tot en met<input type="date" value={editing.endDate} min={editing.startDate} onChange={event=>update("endDate",event.target.value)} required/></label></div>
   <label className={s.checkbox}><input type="checkbox" checked={editing.enabled} onChange={event=>update("enabled",event.target.checked)}/>Zichtbaar binnen deze datums</label>
   <footer><button type="button" disabled={busy||!editing.title.trim()||!editing.body.trim()} onClick={()=>setPreview(editing)}><Icon name="screen"/>Voorbeeld</button><button type="button" disabled={busy} onClick={()=>setEditing(null)}>Annuleren</button><button className={s.primary} disabled={busy}>{busy?"Opslaan…":"Klaarzetten"}</button></footer>
  </form>:<div className={s.messageList}>{data?.messages.map(message=>{
   const status=!message.enabled?"Uitgezet":message.endDate<today?"Verlopen":message.startDate>today?"Ingepland":"Zichtbaar";
   return <article key={message.id}><div><span className={`${s.status} ${status==="Zichtbaar"?s.activeStatus:""}`}>{status}</span><h2>{message.title}</h2><p>{message.body}</p><small>{dateLabel(message.startDate)} — {dateLabel(message.endDate)}{message.updatedBy?` · ${message.updatedBy}`:""}</small></div><div className={s.listActions}><button onClick={()=>setPreview(message)} aria-label={`Bekijk ${message.title}`}><Icon name="screen"/></button><button onClick={()=>{setNotice("");setError("");setEditing(message);}}>Wijzigen</button></div></article>;
  })}{data&&!data.messages.length&&<p>Nog geen schermberichten.</p>}</div>}
  {preview&&<ScreenMessageCard message={preview} preview onClose={()=>setPreview(null)}/>}
 </section>;
}
