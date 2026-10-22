"use client";

import { useEffect, useRef, useState } from "react";
import { StrikPageHeader, StrikShell, strikIcons } from "../../StrikUI";
import { weddingDateLabel, weddingLocalDate, weddingSlotEnd, type WeddingAppointment } from "../../lib/weddingAppointments";
import styles from "./WeddingAgenda.module.css";

type Appointment = WeddingAppointment & {mail?:{template:string;status:string;sent_at:string|null;available_at:string;last_error:string|null}[]};
type Contact = {names:string;email:string;phone:string;weddingDate:string;guests:string;notes:string};
const blank:Contact={names:"",email:"",phone:"",weddingDate:"",guests:"",notes:""};
const monday=(value:string)=>{const d=new Date(`${value}T12:00:00Z`); d.setUTCDate(d.getUTCDate()-((d.getUTCDay()+6)%7));return d.toISOString().slice(0,10);};
const addDays=(value:string,number:number)=>{const d=new Date(`${value}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+number);return d.toISOString().slice(0,10);};

export default function WeddingAgenda() {
  const today=weddingLocalDate();
  const [mode,setMode]=useState<"week"|"history">("week");
  const [start,setStart]=useState(()=>monday(today));
  const [year,setYear]=useState(today.slice(0,4));
  const [search,setSearch]=useState("");
  const [appointments,setAppointments]=useState<Appointment[]>([]);
  const [enabled,setEnabled]=useState(false);
  const [canManage,setCanManage]=useState(false);
  const [migrationCount,setMigrationCount]=useState(0);
  const [historyCount,setHistoryCount]=useState(0);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [refresh,setRefresh]=useState(0);
  const [formOpen,setFormOpen]=useState(false);
  const [editing,setEditing]=useState<Appointment|null>(null);
  const [contact,setContact]=useState<Contact>(blank);
  const [date,setDate]=useState(today);
  const [begin,setBegin]=useState("10:30");
  const [end,setEnd]=useState("11:00");
  const [notify,setNotify]=useState(true);
  const requestId=useRef("");
  const saving=useRef(false);
  const from=mode==="week"?start:`${year}-01-01`,to=mode==="week"?addDays(start,6):`${year}-12-31`;

  useEffect(()=>{
    const controller=new AbortController();setLoading(true);setError("");
    void fetch(`/api/wedding-appointments/manage?from=${from}&to=${to}`,{cache:"no-store",signal:controller.signal}).then(async response=>{const data=await response.json();if(!response.ok)throw new Error(data.message);setAppointments(data.appointments);setEnabled(data.enabled);setCanManage(data.canManage);setMigrationCount(data.migrationCount||0);setHistoryCount(data.totalHistory||data.migrationCount||0);}).catch(reason=>{if(!controller.signal.aborted)setError(reason instanceof Error?reason.message:"De agenda kon niet worden geladen.");}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return()=>controller.abort();
  },[from,to,refresh]);

  function open(appointment?:Appointment){
    setError("");setNotice("");setEditing(appointment||null);setContact(appointment?{names:appointment.names,email:appointment.email,phone:appointment.phone,weddingDate:appointment.wedding_date||"",guests:appointment.guests?String(appointment.guests):"",notes:appointment.notes}:blank);setDate(appointment?.appointment_date||today);setBegin(appointment?.start_time.slice(0,5)||"10:30");setEnd(appointment?.end_time.slice(0,5)||"11:00");setNotify(true);requestId.current=crypto.randomUUID();setFormOpen(true);
  }
  async function post(body:unknown){const response=await fetch("/api/wedding-appointments/manage",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});const result=await response.json();if(!response.ok)throw new Error(result.message||"Opslaan is niet gelukt.");return result;}
  async function save(event:React.FormEvent){
    event.preventDefault();if(saving.current||!enabled)return;saving.current=true;setBusy(true);setError("");
    try{await post({id:editing?.id,revision:editing?.revision,requestId:requestId.current,date,start:begin,end,contact,notify:notify&&Boolean(contact.email.trim())});setFormOpen(false);setNotice(editing?"Afspraak bijgewerkt.":"Afspraak ingepland. De interne bevestiging gaat naar info@strik-patisserie.nl.");setMode("week");setStart(monday(date));setRefresh(value=>value+1);}catch(reason){setError(reason instanceof Error?reason.message:"Opslaan is niet gelukt.");}finally{setBusy(false);saving.current=false;}
  }
  async function cancel(appointment:Appointment){if(!window.confirm(`Afspraak van ${appointment.names} op ${weddingDateLabel(appointment.appointment_date)} annuleren? Het tijdvak komt weer vrij. Er wordt geen annuleringsmail verstuurd.`))return;setBusy(true);setError("");try{await post({action:"cancel",id:appointment.id,revision:appointment.revision});setNotice("Afspraak geannuleerd; het tijdvak is weer beschikbaar.");setRefresh(value=>value+1);}catch(reason){setError(reason instanceof Error?reason.message:"Annuleren is niet gelukt.");}finally{setBusy(false);}}
  async function importHistory(){if(saving.current)return;saving.current=true;setBusy(true);setError("");try{const result=await post({action:"import"});setMigrationCount(result.imported.bookings);setNotice(`${result.imported.bookings} afspraken met volledige historie veilig overgenomen. De huidige planner blijft actief.`);}catch(reason){setError(reason instanceof Error?reason.message:"De historie kon niet worden overgenomen.");}finally{setBusy(false);saving.current=false;}}
  const visible=appointments.filter(item=>(mode==="history" || !["trash","cancelled"].includes(item.status)) && [item.names,item.email,item.phone,item.notes].join(" ").toLowerCase().includes(search.toLowerCase()));
  const groups=visible.reduce<Record<string,Appointment[]>>((result,item)=>{(result[item.appointment_date] ||= []).push(item);return result;},{});
  const field=(key:keyof Contact,value:string)=>setContact(current=>({...current,[key]:value}));

  return <StrikShell><div className={styles.page}>
    <StrikPageHeader title="Bruidstaartafspraken" description="Agenda bekijken, afspraken inplannen en de verzendstatus volgen." icon={strikIcons.bruidstaart}/>
    <div className={styles.topActions}><button type="button" className={!formOpen?styles.active:styles.button} onClick={()=>setFormOpen(false)}>Agenda bekijken</button><button type="button" className={formOpen?styles.active:styles.button} onClick={()=>open()}>+ Afspraak inplannen</button></div>
    {!loading&&!enabled&&<div className={styles.setup}><strong>De nieuwe planner staat in voorbereiding.</strong><p>De bestaande afspraken blijven zichtbaar. Handmatig inplannen en automatische herinneringen starten zodra de nieuwe agenda is geactiveerd.</p><small>{historyCount} afspraken in de volledige historie{migrationCount?` · ${migrationCount} al overgenomen`:""}</small>{canManage&&<button type="button" className={styles.button} disabled={busy} onClick={()=>void importHistory()}>{busy?"Overnemen…":"Historie bijwerken"}</button>}</div>}
    {notice&&<p role="status" className={styles.notice}>{notice}</p>}{error&&<p role="alert" className={styles.error}>{error}</p>}
    {formOpen?<form className={styles.form} onSubmit={save}><header><h2>{editing?"Afspraak wijzigen":"Nieuwe afspraak"}</h2><p>Vrije keuze van datum en tijd. Bezetting wordt bij het opslaan gecontroleerd.</p></header><div className={styles.fields}>
      <label className={styles.full}>Namen *<input required maxLength={160} value={contact.names} onChange={event=>field("names",event.target.value)}/></label><label>E-mailadres<input type="email" maxLength={200} value={contact.email} onChange={event=>field("email",event.target.value)}/></label><label>Telefoon<input type="tel" maxLength={40} value={contact.phone} onChange={event=>field("phone",event.target.value)}/></label>
      <label>Datum *<input required type="date" value={date} onChange={event=>setDate(event.target.value)}/></label><div className={styles.times}><label>Van *<input required type="time" value={begin} onChange={event=>{setBegin(event.target.value);setEnd(weddingSlotEnd(event.target.value));}}/></label><label>Tot *<input required type="time" value={end} onChange={event=>setEnd(event.target.value)}/></label></div>
      <label>Trouwdatum<input type="date" value={contact.weddingDate} onChange={event=>field("weddingDate",event.target.value)}/></label><label>Aantal gasten<input type="number" min={1} max={2000} value={contact.guests} onChange={event=>field("guests",event.target.value)}/></label><label className={styles.full}>Wensen / opmerkingen voor het gesprek<textarea rows={4} maxLength={1500} value={contact.notes} onChange={event=>field("notes",event.target.value)}/><small>Deze gegevens staan ook in de klantbevestiging.</small></label>
      <label className={styles.check}><input type="checkbox" checked={notify&&Boolean(contact.email.trim())} disabled={!contact.email.trim()} onChange={event=>setNotify(event.target.checked)}/>Klant ook een bevestiging mailen</label><p className={styles.help}>Een dag vooraf ontvangt de klant automatisch een herinnering. Zonder e-mailadres worden geen klantmails verstuurd. Strik krijgt een interne bevestiging.</p>
    </div><footer><button type="button" className={styles.button} disabled={busy} onClick={()=>setFormOpen(false)}>Terug naar agenda</button><button type="submit" className={styles.primary} disabled={busy||!enabled}>{busy?"Opslaan…":editing?"Wijziging opslaan":"Afspraak inplannen"}</button></footer></form>:<>
      <div className={styles.tools}><button type="button" className={mode==="week"?styles.active:styles.button} onClick={()=>setMode("week")}>Weekagenda</button><button type="button" className={mode==="history"?styles.active:styles.button} onClick={()=>setMode("history")}>Historie</button>{mode==="week"?<><button type="button" className={styles.button} aria-label="Vorige week" onClick={()=>setStart(value=>addDays(value,-7))}>←</button><input type="date" aria-label="Week van" value={start} onChange={event=>{if(event.target.value)setStart(monday(event.target.value));}}/><button type="button" className={styles.button} aria-label="Volgende week" onClick={()=>setStart(value=>addDays(value,7))}>→</button></>:<select aria-label="Historiejaar" value={year} onChange={event=>setYear(event.target.value)}>{Array.from({length:Number(today.slice(0,4))-2023+3},(_,index)=>String(Number(today.slice(0,4))+1-index)).map(value=><option key={value}>{value}</option>)}</select>}<input aria-label="Zoek afspraak" placeholder="Zoek naam, e-mail of opmerking" value={search} onChange={event=>setSearch(event.target.value)}/><button type="button" className={styles.button} disabled={loading} onClick={()=>setRefresh(value=>value+1)}>↻ Ververs</button></div>
      {loading?<p role="status" className={styles.empty}>Afspraken laden…</p>:visible.length?<div className={styles.list}>{Object.entries(groups).sort(([a],[b])=>mode==="history"?b.localeCompare(a):a.localeCompare(b)).map(([day,items])=><section key={day}><h2>{weddingDateLabel(day)}</h2>{items?.map(item=><article key={item.id} className={["trash","cancelled"].includes(item.status)?styles.cancelled:""}><div className={styles.time}>{item.start_time.slice(0,5)}<small>{item.end_time.slice(0,5)}</small></div><div className={styles.customer}><h3>{item.names}</h3><p>{item.email}{item.phone?` · ${item.phone}`:""}</p>{item.notes&&<p className={styles.notes}>{item.notes}</p>}<div className={styles.mail}>{item.status==="pending"?<span>In afwachting</span>:item.status==="trash"?<span>Verwijderd in de oude agenda</span>:item.status==="cancelled"?<span>Geannuleerd</span>:<span>Bevestigd</span>}{item.mail?.map(job=><span key={job.template} data-error={job.status==="FAILED"||undefined}>{job.template==="CUSTOMER_REMINDER"?"Herinnering":job.template==="INTERNAL_CONFIRMATION"?"Interne kopie":"Klantbevestiging"}: {job.status==="SENT"?"verstuurd":job.status==="SKIPPED"?"vervallen":job.status==="FAILED"?"opnieuw proberen": "gepland"}</span>)}</div></div>{enabled&&["confirmed","pending"].includes(item.status)&&<div className={styles.rowActions}><button type="button" className={styles.button} disabled={busy} onClick={()=>open(item)}>Wijzig</button><button type="button" className={styles.quiet} disabled={busy} onClick={()=>void cancel(item)}>Annuleren</button></div>}</article>)}</section>)}</div>:<p className={styles.empty}>Geen afspraken in deze periode.</p>}
    </>}
  </div></StrikShell>;
}
