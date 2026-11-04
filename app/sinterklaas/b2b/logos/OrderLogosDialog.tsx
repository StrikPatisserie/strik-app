"use client";
/* eslint-disable @next/next/no-img-element */
import {useEffect,useRef,useState} from "react";
import {createPortal} from "react-dom";
import {type OrderLogo,logoPrintLayout,logoPrintedFor,LOGO_MAX_PRINT_HEIGHT} from "./model";
import s from "./Logos.module.css";
function BlobPreview({logo,url}:{logo:OrderLogo;url:string}) {
 return logo.content_type==="application/pdf"?<a href={url} target="_blank" rel="noreferrer" className={s.preview} style={{display:"grid",placeItems:"center"}}>PDF bekijken</a>:<a href={url} target="_blank" rel="noreferrer"><img src={url} loading="lazy" decoding="async" alt={logo.name} className={s.preview}/></a>;
}
export default function OrderLogosDialog({orderId,year,customer,startPrint,onCountChange,onClose}:{orderId:string;year:string;customer:string;startPrint:boolean;onCountChange?:(count:number)=>void;onClose:()=>void}) {
 const countChange=useRef(onCountChange);
 useEffect(()=>{countChange.current=onCountChange;},[onCountChange]);
 const dialog=useRef<HTMLDialogElement>(null),upload=useRef<HTMLInputElement>(null),replaceInput=useRef<HTMLInputElement>(null),replaceTarget=useRef<OrderLogo|null>(null);
 const [logos,setLogos]=useState<OrderLogo[]>([]),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[status,setStatus]=useState("");
 const [pdf,setPdf]=useState<string|null>(null);
 const base=`/api/b2b-logos?orderId=${encodeURIComponent(orderId)}&year=${encodeURIComponent(year)}`;
 useEffect(()=>{dialog.current?.showModal();},[]);
 useEffect(()=>{const controller=new AbortController();fetch(base,{cache:"no-store",signal:controller.signal}).then(async response=>{const data=await response.json();if(!response.ok)throw Error(data.message);setLogos(data.logos);countChange.current?.(data.logos.length);setLoading(false);}).catch(error=>{if(!controller.signal.aborted){setLoading(false);setStatus(error instanceof Error?error.message:"Laden mislukt.");}});return()=>controller.abort();},[base]);
 useEffect(()=>()=>{if(pdf)URL.revokeObjectURL(pdf);},[pdf]);
 const fileUrl=(logo:OrderLogo,download=false)=>`${base}&id=${encodeURIComponent(logo.id)}${download?"&download=1":""}&v=${encodeURIComponent(logo.updated_at)}`;
 function update(id:string,patch:Partial<OrderLogo>){setLogos(current=>current.map(item=>item.id===id?{...item,...patch}:item));setPdf(null);}
 async function sendFiles(files:File[],replace?:OrderLogo|null) {
  if(!files.length)return;
  if(!replace&&logos.length+files.length>30){setStatus("Bewaar maximaal 30 logo’s per bestelling.");return;}
  setBusy(true);setStatus("Uploaden…");setPdf(null);
  try {
   let uploaded=0;
   for(const file of files) {
    if(file.size>4*1024*1024)throw Error(`${file.name}: maximaal 4 MB per bestand.`);
    const body=new FormData();body.set("file",file);if(replace){body.set("id",replace.id);body.set("updatedAt",replace.updated_at);}
    const response=await fetch(base,{method:"POST",body}),data=await response.json();if(!response.ok)throw Error(data.message);
    setLogos(current=>replace?current.map(item=>item.id===replace.id?data.logo:item):[...current,data.logo]);
    uploaded++;onCountChange?.(replace?logos.length:logos.length+uploaded);
   }
   setStatus(replace?"Logo vervangen.":"Logo’s opgeslagen.");
  } catch(error){setStatus(error instanceof Error?error.message:"Uploaden is mislukt.");}finally{setBusy(false);}
 }
 async function save(logo:OrderLogo,printed?:boolean) {
  setBusy(true);setStatus("Opslaan…");
  try{const response=await fetch(base,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({...logo,...(printed!==undefined?{printed}:{})})}),data=await response.json();if(!response.ok)throw Error(data.message);setLogos(current=>current.map(item=>item.id===logo.id?data.logo:item));setStatus(printed===true?"Afgevinkt als geprint.":printed===false?"Printvinkje verwijderd.":"Naam en printinstellingen opgeslagen.");}catch(error){setStatus(error instanceof Error?error.message:"Opslaan mislukt.");}finally{setBusy(false);}
 }
 async function remove(logo:OrderLogo) {
  if(!window.confirm(`Logo “${logo.name}” definitief verwijderen?`))return;
  setBusy(true);setStatus("Verwijderen…");
  try{const response=await fetch(base,{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:logo.id,updated_at:logo.updated_at})}),data=await response.json();if(!response.ok)throw Error(data.message);setLogos(current=>current.filter(item=>item.id!==logo.id));onCountChange?.(logos.length-1);setPdf(null);setStatus("Logo verwijderd.");}catch(error){setStatus(error instanceof Error?error.message:"Verwijderen mislukt.");}finally{setBusy(false);}
 }
 async function makePrint() {
  try {
   const items=logos.map(({id,quantity,width_cm,height_cm})=>({id,quantity,width_cm:Number(width_cm),height_cm:Number(height_cm)}));logoPrintLayout(items);
   const alreadyPrinted=logos.some(logo=>logo.quantity>0&&logo.printed_at);
   if(alreadyPrinted&&!window.confirm("Een geselecteerd logo is al geprint. Wil je bewust nog een printvel maken?"))return;
   setBusy(true);setStatus("Printvel maken…");setPdf(null);
   const response=await fetch(`/api/b2b-logos/print?orderId=${encodeURIComponent(orderId)}&year=${encodeURIComponent(year)}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({logos:items,confirmReprint:alreadyPrinted})});
   if(!response.ok){const data=await response.json();throw Error(data.message);}
   setPdf(URL.createObjectURL(await response.blob()));setStatus("Printvel klaar. Print op werkelijke grootte (100%).");
  }catch(error){setStatus(error instanceof Error?error.message:"Printvel maken mislukt.");}finally{setBusy(false);}
 }
 return createPortal(<dialog ref={dialog} onClose={onClose} onCancel={event=>{if(busy)event.preventDefault();}} aria-labelledby="b2b-logos-title" className={s.dialog}>
  <header className={s.header}><h2 id="b2b-logos-title">Logo’s · {customer}</h2><button type="button" className={s.icon} onClick={onClose} disabled={busy} aria-label="Logo’s sluiten">×</button></header>
  <p className={s.sub}>Meerdere logo’s per bestelling · JPG, PNG, WebP of PDF · maximaal 4 MB per bestand.</p>
  <div className={s.actions}><button type="button" className={`${s.button} ${s.primary}`} disabled={loading||busy} onClick={()=>upload.current?.click()}>+ Logo’s uploaden</button><button type="button" className={s.button} disabled={loading||busy||!logos.length} onClick={()=>void makePrint()}>Printvel maken</button></div>
  <input ref={upload} hidden type="file" multiple accept="image/png,image/jpeg,image/webp,application/pdf" onChange={event=>{void sendFiles(Array.from(event.target.files||[]));event.target.value="";}}/>
  <input ref={replaceInput} hidden type="file" accept="image/png,image/jpeg,image/webp,application/pdf" onChange={event=>{const file=event.target.files?.[0];if(file)void sendFiles([file],replaceTarget.current);event.target.value="";}}/>
  {loading&&<p role="status" className={s.status}>Logo’s laden…</p>}
  {!loading&&!logos.length&&<p className={s.status}>{startPrint?"Upload eerst een logo om een printvel te maken.":"Nog geen logo’s opgeslagen bij deze bestelling."}</p>}
  <div className={s.grid}>{logos.map(logo=><article key={logo.id} className={s.card}><div><BlobPreview logo={logo} url={fileUrl(logo)}/><a href={fileUrl(logo,true)} className={s.small}>Download origineel</a></div><div>
   <input className={s.name} aria-label={`Naam van ${logo.name}`} value={logo.name} maxLength={180} disabled={busy} onChange={event=>update(logo.id,{name:event.target.value})}/>
   <div className={s.fields}><label>Aantal<input type="number" min="0" max="2000" step="1" value={logo.quantity} disabled={busy} onChange={event=>update(logo.id,{quantity:Number(event.target.value)})}/></label><label>Breedte (cm)<input type="number" min="0.5" max="19" step="0.1" value={logo.width_cm} disabled={busy} onChange={event=>update(logo.id,{width_cm:Number(event.target.value)})}/></label><label>Hoogte (cm)<input type="number" min="0.5" max={LOGO_MAX_PRINT_HEIGHT} step="0.1" value={logo.height_cm} disabled={busy} onChange={event=>update(logo.id,{height_cm:Number(event.target.value)})}/></label></div>
   <p className={s.small}>Past binnen dit formaat; verhouding blijft behouden.{logo.content_type==="application/pdf"?" Van een PDF gebruiken we de eerste pagina.":""} Aantal 0 = niet printen.</p>
   <label className={s.printed}><input type="checkbox" checked={logoPrintedFor(logo)} disabled={busy||logo.quantity<1} onChange={event=>void save(logo,event.target.checked)}/> Geprint</label>
   {logo.printed_at&&<p className={s.small}>{logoPrintedFor(logo)?"Afgevinkt":"Eerder geprint; aantal of formaat gewijzigd"} · {logo.printed_by_name||"Medewerker"} · {new Intl.DateTimeFormat("nl-NL",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit",timeZone:"Europe/Amsterdam"}).format(new Date(logo.printed_at))}</p>}
   <div className={s.actions}><button type="button" className={s.button} disabled={busy} onClick={()=>void save(logo)}>Bewaren</button><button type="button" className={s.button} disabled={busy} onClick={()=>{replaceTarget.current=logo;replaceInput.current?.click();}}>Vervangen</button><button type="button" className={`${s.button} ${s.delete}`} disabled={busy} onClick={()=>void remove(logo)}>Verwijderen</button></div>
  </div></article>)}</div>
  {status&&<p role="status" className={s.status}>{status}</p>}
  {pdf&&<section><p className={s.small}>A4 · werkelijke grootte / 100% · niet ‘passen op pagina’. Onderaan blijft 5 cm vrij. Vink daarna zelf ‘Geprint’ aan.</p><div className={s.actions}><a className={`${s.button} ${s.primary}`} href={pdf} target="_blank" rel="noreferrer">Open PDF om te printen</a><a href={pdf} download="Strik-logo-printvel.pdf" className={s.button}>PDF downloaden</a></div><iframe src={pdf} title="Voorbeeld logo-printvel" className={s.frame}/></section>}
 </dialog>,document.body);
}
