'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { StrikPageHeader, StrikShell, strikIcons } from '../../StrikUI';
import { euro, isOverdue, paymentInput, paymentMail, paymentReference } from './paymentRequests';
import type { PaymentSummary } from './paymentServer';
import s from './payments.module.css';

const date=(value:string|null)=>value?new Intl.DateTimeFormat('nl-NL',{timeZone:'Europe/Amsterdam',dateStyle:'medium',timeStyle:'short'}).format(new Date(value)):'—';
function status(row:PaymentSummary){
 if(row.paid_at)return row.settlement_method==='bank'?'Betaald via bank':row.settlement_method==='store'?'Betaald in winkel':'Betaald';
 if(row.customer_reminder_sent_at)return row.customer_reminder_due_at&&Date.parse(row.customer_reminder_due_at)<=Date.now()?'! Herinneringstermijn verlopen':'Herinnering verstuurd';
 if(isOverdue(row))return '! Twee weken open';
 if(row.link_state==='uncertain')return 'Aanmaak controleren';
 if(row.link_state==='creating')return 'Wordt aangemaakt';
 if(row.customer_mail_state!=='sent')return 'Mail nog niet bevestigd';
 if(row.check_error)return 'Betaalstatus controleren';
 return 'Open';
}
async function api(body?:unknown,query=''){
 const response=await fetch(`/api/management-payment-requests${query}`,body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{cache:'no-store'});
 const result=await response.json();if(!response.ok)throw Error(result.message||'Betaalverzoeken zijn tijdelijk niet beschikbaar.');return result;
}
export default function PaymentRequests(){
 const [email,setEmail]=useState(''),[amount,setAmount]=useState(''),[description,setDescription]=useState('');
 const [requests,setRequests]=useState<PaymentSummary[]>([]),[total,setTotal]=useState(0),[offset,setOffset]=useState(0),[view,setView]=useState('all'),[epoch,setEpoch]=useState(0);
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[active,setActive]=useState(''),[error,setError]=useState(''),[message,setMessage]=useState('');
 const [hasSubmission,setHasSubmission]=useState(false);
 const [preview,setPreview]=useState<{subject:string;html:string;recipient:string;sent_at:string|null;legacy?:boolean}|null>(null),[paidRow,setPaidRow]=useState<PaymentSummary|null>(null),[paidMethod,setPaidMethod]=useState<'bank'|'store'>('bank'),[paidNote,setPaidNote]=useState('');
 const dialog=useRef<HTMLDialogElement>(null),actionLock=useRef(false);
 useEffect(()=>{if(preview||paidRow)dialog.current?.showModal();},[preview,paidRow]);
 const submission=useRef<string|null>(null),sending=useRef(false);
 useEffect(()=>{let cancelled=false;setLoading(true);api(undefined,`?offset=${offset}&view=${view}`).then(data=>{if(!cancelled){setRequests(data.requests);setTotal(data.total||0);}}).catch(e=>{if(!cancelled)setError((e as Error).message);}).finally(()=>{if(!cancelled)setLoading(false);});return()=>{cancelled=true;};},[offset,view,epoch]);
 function reset(){submission.current=null;setHasSubmission(false);setEmail('');setAmount('');setDescription('');setError('');}
 async function send(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(sending.current)return;
  const id=submission.current||crypto.randomUUID();
  try{paymentInput({id,email,amount,description});}catch(e){setError((e as Error).message);return;}
  submission.current=id;setHasSubmission(true);sending.current=true;setBusy(true);setError('');setMessage('');
  try{
   const data=await api({action:'create',id,email,amount,description});const row=data.request as PaymentSummary;
   setOffset(0);setView('all');setEpoch(value=>value+1);
   if(row.customer_mail_state==='sent'){reset();setMessage(`Betaalverzoek ${paymentReference(row.id)} is naar ${row.recipient_email} verstuurd.`);}
   else setError(row.last_error||'Het verzoek is bewaard. Controleer de status hieronder voordat je opnieuw verstuurt.');
  }catch(e){setError((e as Error).message);setEpoch(value=>value+1);}finally{sending.current=false;setBusy(false);}
 }
 async function action(id:string,kind:'sync'|'retry_mail'|'remind_customer'|'mark_paid'){
  if(actionLock.current)return null;actionLock.current=true;setActive(id);setError('');setMessage('');
  try{
   const data=await api({action:kind,id,...(kind==='mark_paid'?{method:paidMethod,note:paidNote}:{})});const row=data.request as PaymentSummary;
   setRequests(current=>current.map(item=>item.id===id?row:item));setEpoch(value=>value+1);
   if(data.message)setError(data.message);
   else if(kind==='remind_customer'){if(row.paid_at)setMessage('Het verzoek is al betaald; er is geen herinnering verstuurd.');else if(row.customer_reminder_mail_state==='sent')setMessage('De herinnering is verstuurd met het verzoek binnen één week te betalen.');else setError(row.last_error||'De herinnering is nog niet bevestigd.');}
   else if(kind==='mark_paid'){if(row.paid_at)setMessage('De betaling is vastgelegd. Verdere herinneringen stoppen.');else setError('De betaling is nog niet vastgelegd.');}
   else if(kind==='retry_mail'&&row.customer_mail_state!=='sent'&&!row.paid_at)setError(row.last_error||'De mail is nog niet bevestigd.');
   else setMessage(row.paid_at?`Betaling vastgelegd${row.settlement_method==='bank'?' via bank':row.settlement_method==='store'?' in de winkel':' door Mollie'}.`:kind==='retry_mail'?'De mail is bevestigd.':'Status bij Mollie gecontroleerd; het verzoek staat nog open.');
   if(row.archive_error)setError(row.archive_error);return row;
  }catch(e){setError((e as Error).message);return null;}finally{actionLock.current=false;setActive('');}
 }
 async function showMail(row:PaymentSummary,kind='customer'){
  setError('');try{setPreview(await api(undefined,`?id=${encodeURIComponent(row.id)}&mail=${kind}`));}catch(e){setError((e as Error).message);}
 }
 function previewNew(){
  try{const id=submission.current||crypto.randomUUID(),values=paymentInput({id,email,amount,description});setPreview({...paymentMail({...values,created_at:new Date().toISOString(),sent_at:null,mail_version:2,checkout_url:'https://payment-links.mollie.com/voorbeeld',customer_reminder_sent_at:null}),recipient:values.recipient_email,sent_at:null});}catch(e){setError((e as Error).message);}
 }
 function closeDialog(){if(active)return;setPreview(null);setPaidRow(null);}
 const locked=busy||hasSubmission;
 return <StrikShell extraWide backHref="/management"><div className={s.root}>
  <StrikPageHeader title="Betaalverzoeken" icon={strikIcons.managementCashCount}/>
  <section className={s.intro}>
   <div><span className={s.eyebrow}>Snel geregeld</span><h1>Een betaalverzoek in een paar tellen</h1><p>Vul het e-mailadres en bedrag in. Je klant ontvangt een verzorgde Strik-mail met een persoonlijke Mollie-betaallink.</p></div>
   <form onSubmit={send} className={s.form}>
    <label>E-mailadres<input type="email" autoComplete="email" required maxLength={254} value={email} disabled={locked} onChange={event=>setEmail(event.target.value)} placeholder="klant@voorbeeld.nl"/></label>
    <label>Bedrag in euro’s<input type="text" inputMode="decimal" required maxLength={10} value={amount} disabled={locked} onChange={event=>setAmount(event.target.value)} placeholder="25,00"/></label>
    <label className={s.wide}>Omschrijving <span>optioneel</span><input maxLength={180} value={description} disabled={locked} onChange={event=>setDescription(event.target.value)} placeholder="Bijvoorbeeld: bestelling taart"/></label>
    <div className={s.actions}><button type="button" disabled={busy} onClick={previewNew}>Voorbeeld mail</button><button type="submit" disabled={busy} className={s.primary}>{busy?'Versturen…':'Verstuur betaalverzoek'}</button>{hasSubmission&&!busy?<button type="button" onClick={reset}>Nieuw formulier</button>:null}</div>
    <p className={s.hint}>Na twee weken openstaan verschijnt een ! en gaat een melding naar info@strik-patisserie.nl. Met één klik stuur je de klant een herinnering met één week betaaltermijn. Is daarna nog niet betaald, dan volgt een nieuwe interne melding.</p>
   </form>
  </section>
  {error?<p role="alert" className={s.error}>{error}</p>:null}{message?<p role="status" className={s.success}>{message}</p>:null}
  <section className={s.overview} aria-label="Verstuurde betaalverzoeken">
   <header><h2>Overzicht</h2><div className={s.tabs} role="group" aria-label="Betaalstatus filteren">{[['all','Alle'],['open','Open'],['paid','Betaald']].map(([key,label])=><button type="button" key={key} aria-pressed={view===key} onClick={()=>{setView(key);setOffset(0);}}>{label}</button>)}<button type="button" disabled={loading} onClick={()=>setEpoch(value=>value+1)}>Vernieuwen</button></div></header>
   {loading?<p role="status" className={s.empty}>Betaalverzoeken laden…</p>:requests.length?<div className={s.rows}>{requests.map(row=><article className={`${s.row} ${isOverdue(row)?s.overdueRow:''}`} key={row.id}>
    <div className={s.identity}><strong>{row.recipient_email}</strong><span>{row.description}</span><small>{paymentReference(row.id)} · {date(row.created_at)}</small></div>
    <div className={s.money}>{euro(row.amount_cents)}{row.mode==='test'?<small>Testmodus</small>:null}</div>
    <div className={s.status}><strong className={row.paid_at?s.paid:isOverdue(row)?s.overdue:s.open}>{status(row)}</strong><small>{row.paid_at?`Betaald ${date(row.paid_at)}`:row.sent_at?`Gemaild ${date(row.sent_at)}`:'Nog niet gemaild'}</small>{row.reminded_at?<small>Interne waarschuwing verstuurd {date(row.reminded_at)}</small>:null}{row.customer_reminder_sent_at?<small>Klantherinnering verstuurd {date(row.customer_reminder_sent_at)} · betalen vóór {date(row.customer_reminder_due_at)}</small>:null}{row.followup_sent_at?<small>Vervolgmelding naar info@strik verstuurd {date(row.followup_sent_at)}</small>:null}{row.manual_paid_note?<small>Toelichting: {row.manual_paid_note}</small>:null}{row.checked_at?<small>{row.check_error?'Laatste controlepoging':'Laatst gecontroleerd'} {date(row.checked_at)}</small>:null}</div>
    <div className={s.rowActions}><button type="button" disabled={Boolean(active)} onClick={()=>void showMail(row)}>Mail bekijken</button>{row.customer_reminder_sent_at?<button type="button" disabled={Boolean(active)} onClick={()=>void showMail(row,'customer_reminder')}>Herinnering bekijken</button>:null}{row.checkout_url&&!row.paid_at?<a href={row.checkout_url} target="_blank" rel="noopener noreferrer">Betaallink bekijken</a>:null}{row.link_state==='ready'?<button type="button" disabled={Boolean(active)} onClick={()=>void action(row.id,'sync')}>{active===row.id?'Controleren…':'Controleer betaling'}</button>:null}{row.link_state==='ready'&&!row.paid_at?<button type="button" disabled={Boolean(active)} onClick={()=>{setPaidMethod('bank');setPaidNote('');setPaidRow(row);}}>Handmatig betaald</button>:null}{isOverdue(row)&&row.customer_reminder_mail_state!=='sent'?<button type="button" className={s.primary} disabled={Boolean(active)} onClick={()=>void action(row.id,'remind_customer')}>{row.customer_reminder_mail_state==='failed'?'Herinnering opnieuw proberen':'Herinnering sturen · 1 week'}</button>:null}{row.link_state==='ready'&&!row.paid_at&&row.customer_mail_state!=='sent'?<button type="button" disabled={Boolean(active)} onClick={()=>void action(row.id,'retry_mail')}>Bestaande mail opnieuw proberen</button>:null}</div>
    {row.last_error||row.check_error||row.archive_error?<p className={s.rowError}>{row.archive_error||row.last_error||row.check_error}</p>:null}
   </article>)}</div>:<p className={s.empty}>Nog geen betaalverzoeken in deze selectie.</p>}
   <footer><span>{total} betaalverzoeken</span><div><button type="button" disabled={loading||offset===0} onClick={()=>setOffset(value=>Math.max(0,value-50))}>Vorige</button><button type="button" disabled={loading||offset+50>=total} onClick={()=>setOffset(value=>value+50)}>Volgende</button></div></footer>
  </section>
  {(preview||paidRow)&&<dialog ref={dialog} className={s.dialog} onCancel={event=>{event.preventDefault();closeDialog();}} aria-label={preview?'Voorbeeld betaalmail':'Betaling vastleggen'}>
   <header><h2>{preview?'Betaalmail bekijken':'Betaling vastleggen'}</h2><button type="button" disabled={Boolean(active)} onClick={closeDialog}>Sluiten</button></header>
   {preview?<><div className={s.dialogBody}><p><strong>Aan:</strong> {preview.recipient}</p><p><strong>Onderwerp:</strong> {preview.subject}</p><small>{preview.sent_at?`Verstuurd ${date(preview.sent_at)}`:'Voorbeeld · nog niet verstuurd'}{preview.legacy?' · oorspronkelijke opmaak':''}</small></div><iframe className={s.mailFrame} sandbox="" referrerPolicy="no-referrer" title="Voorbeeld betaalmail" srcDoc={preview.html} tabIndex={-1}/></>:paidRow?<form className={s.dialogBody} onSubmit={async event=>{event.preventDefault();const row=await action(paidRow.id,'mark_paid');if(row?.paid_at)setPaidRow(null);}}>
    <p>{paidRow.recipient_email} · <strong>{euro(paidRow.amount_cents)}</strong><br/>{paidRow.description}</p>
    <label>Waar is het bedrag ontvangen?<select value={paidMethod} disabled={Boolean(active)} onChange={e=>setPaidMethod(e.target.value as 'bank'|'store')}><option value="bank">Handmatig overgemaakt via bank</option><option value="store">Betaald in de winkel</option></select></label>
    <label>Toelichting <small>optioneel</small><input maxLength={300} value={paidNote} disabled={Boolean(active)} onChange={e=>setPaidNote(e.target.value)} placeholder="Bijvoorbeeld datum of kassabonnummer"/></label>
    <p className={s.hint}>Bevestig dit wanneer het volledige bedrag is ontvangen. De app bewaart wie dit vastlegt, stopt herinneringen en sluit de Mollie-link.</p>
    {error?<p className={s.error} role="alert">{error}</p>:null}<button className={s.primary} type="submit" disabled={Boolean(active)}>{active?'Vastleggen…':'Markeer als betaald'}</button>
   </form>:null}
  </dialog>}

 </div></StrikShell>;
}
