"use client";
/* eslint-disable @next/next/no-img-element */
import {useEffect,useRef,useState,type FormEvent} from "react";
import {fetchRecepturenData,saveRecepturenData} from "./bakkerij/recepturen/recepturenApi";
import type {BakeryHomeOffer} from "./bakkerij/recepturen/types";

export default function WeeklyOfferEditor({week,offer,onSaved,onClose}:{week:string;offer:BakeryHomeOffer|null;onSaved:(offers:BakeryHomeOffer[])=>void;onClose:()=>void}) {
  const dialog=useRef<HTMLDialogElement>(null);
  const [label,setLabel]=useState(offer?.label||"");
  const [file,setFile]=useState<File|null>(null),[preview,setPreview]=useState("");
  const [busy,setBusy]=useState(false),[status,setStatus]=useState("");
  useEffect(()=>{dialog.current?.showModal();},[]);
  useEffect(()=>{if(!file)return;const url=URL.createObjectURL(file);setPreview(url);return()=>URL.revokeObjectURL(url);},[file]);
  async function save(event:FormEvent) {
    event.preventDefault();if(busy)return;
    if(!file&&!offer?.imageUrl){setStatus("Kies eerst een afbeelding.");return;}
    if(file&&file.size>3*1024*1024){setStatus("Kies een afbeelding van maximaal 3 MB.");return;}
    setBusy(true);setStatus("Opslaan…");
    try {
      const current=await fetchRecepturenData();if(!current.ok)throw Error(current.message);
      const home=current.data.bakeryHome||{notes:[],offers:[]};
      const existing=home.offers.find(item=>item.weekStart===week);
      if((existing?.updatedAt||"")!==(offer?.updatedAt||""))throw Error("Deze week is intussen gewijzigd. Sluit dit venster en ververs eerst de pagina.");
      let imageUrl=existing?.imageUrl||"",mediaId=existing?.mediaId||0,fileName=existing?.fileName||"";
      if(file) {
        const body=new FormData();body.set("file",file);body.set("weekStart",week);body.set("label",label.trim());
        const response=await fetch("/api/recepturen/home-photo",{method:"POST",body});const result=await response.json();
        if(!response.ok||!result.url)throw Error(result.message||"Uploaden is mislukt.");
        imageUrl=result.url;mediaId=result.id||0;fileName=result.fileName||file.name;
      }
      const end=new Date(`${week}T12:00:00Z`);end.setUTCDate(end.getUTCDate()+6);
      const now=new Date().toISOString();
      const next:BakeryHomeOffer={id:existing?.id||crypto.randomUUID(),weekStart:week,weekEnd:end.toISOString().slice(0,10),label:label.trim()||"Weekaanbieding",imageUrl,mediaId,fileName,createdAt:existing?.createdAt||now,updatedAt:now};
      const result=await saveRecepturenData({...current.data,bakeryHome:{...home,offers:[next,...home.offers.filter(item=>item.weekStart!==week)]}});
      if(!result.ok)throw Error(result.message);
      onSaved(result.data.bakeryHome?.offers||[]);onClose();
    } catch(error){setStatus(error instanceof Error?error.message:"Opslaan is mislukt. Probeer opnieuw.");}
    finally{setBusy(false);}
  }
  const field="mt-1 w-full rounded-xl border border-[#c6d1bd] bg-white p-3 text-sm";
  return <dialog ref={dialog} onClose={onClose} onCancel={event=>{if(busy)event.preventDefault();}} className="m-auto max-h-[90dvh] w-[min(28rem,calc(100%-2rem))] overflow-auto rounded-2xl border border-[#c6d1bd] bg-[#fffaf0] p-5 text-[#49342d] shadow-xl backdrop:bg-black/30" aria-labelledby="weekly-offer-editor-title">
    <div className="flex items-center justify-between gap-3"><h2 id="weekly-offer-editor-title" className="text-lg font-bold">Weekaanbieding</h2><button type="button" onClick={onClose} disabled={busy} aria-label="Sluiten" className="size-9 rounded-full hover:bg-black/5">×</button></div>
    <p className="mt-1 text-xs text-[#63765c]">Week vanaf {new Intl.DateTimeFormat("nl-NL",{day:"numeric",month:"long",year:"numeric",timeZone:"UTC"}).format(new Date(`${week}T12:00:00Z`))}</p>
    <form onSubmit={save} className="mt-4 space-y-4">
      <label className="block text-sm font-semibold">Titel<input autoFocus maxLength={180} value={label} onChange={event=>setLabel(event.target.value)} className={field} disabled={busy}/></label>
      <label className="block text-sm font-semibold">Afbeelding<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={event=>setFile(event.target.files?.[0]||null)} className={`${field} font-normal`} disabled={busy}/><span className="mt-1 block text-xs font-normal text-[#63765c]">JPG, PNG, WebP of GIF · maximaal 3 MB</span></label>
      {(preview||offer?.imageUrl)&&<img src={preview||offer!.imageUrl} alt="Voorbeeld weekaanbieding" className="mx-auto max-h-56 rounded-lg object-contain"/>}
      {status&&<p role="status" className="text-sm">{status}</p>}
      <button type="submit" disabled={busy} className="w-full rounded-xl bg-[#2d503c] px-4 py-3 text-sm font-bold text-white disabled:opacity-50">{busy?"Opslaan…":"Aanbieding opslaan"}</button>
    </form>
  </dialog>;
}
