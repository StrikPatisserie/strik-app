"use client";
import Image from "next/image";
import {useId,useRef,useState} from "react";
import type {LokaalVerhaalCredentials} from "./lokaalVerhaal.server";

export const LOKAAL_VERHAAL_URL="https://beheer.lokaalverhaal.com/Sales/DeliveryRegistration";

export default function LokaalVerhaalCard({credentials}:{credentials:LokaalVerhaalCredentials|null}) {
  const dialog=useRef<HTMLDialogElement>(null),id=useId();
  const [infoOpen,setInfoOpen]=useState(false),[message,setMessage]=useState("");
  async function copy(value:string,label:string) {
    try {await navigator.clipboard.writeText(value);setMessage(`${label} gekopieerd.`);}
    catch {setMessage("Selecteer de inlogtekst om deze te kopiëren.");}
  }
  return <section aria-label="Lokaal Verhaal" className="my-3 inline-flex items-center gap-2 px-1">
    <a href={LOKAAL_VERHAAL_URL} target="_blank" rel="noopener noreferrer" aria-label="Open Lokaal Verhaal om QR-codes te scannen (nieuw tabblad)" title="Open Lokaal Verhaal · QR-codes scannen" className="block shrink-0 rounded-xl transition hover:opacity-85 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#49342d]">
      <Image src="/lokaalverhaal-transparent.png" alt="Lokaal Verhaal" width={64} height={62} className="h-14 w-auto object-contain sm:h-16"/>
    </a>
    <button type="button" aria-label="Inloggegevens Lokaal Verhaal" aria-haspopup="dialog" aria-controls={id} aria-expanded={infoOpen} title="Inloggegevens" onClick={()=>{dialog.current?.showModal();setInfoOpen(true);}} className="inline-flex size-9 items-center justify-center rounded-full text-[#52664c] hover:bg-white/35 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#49342d]">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10h.01"/></svg>
    </button>
    <dialog id={id} ref={dialog} aria-labelledby={`${id}-title`} onClose={()=>{setInfoOpen(false);setMessage("");}} className="m-auto max-h-[85dvh] w-[min(25rem,calc(100%_-_24px))] overflow-auto rounded-xl border border-[#c2cfb9] bg-[#fffaf4] p-4 text-[#49342d] shadow-xl backdrop:bg-black/20">
      <header className="flex items-center justify-between gap-3"><h2 id={`${id}-title`} className="text-sm font-bold">Inlog Lokaal Verhaal</h2><button type="button" aria-label="Inloggegevens sluiten" onClick={()=>dialog.current?.close()} className="inline-flex size-9 items-center justify-center rounded-lg hover:bg-[#edf1e7]"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button></header>
      {credentials?<dl className="mt-2 grid gap-1.5">{([{label:"E-mailadres",value:credentials.username},{label:"Wachtwoord",value:credentials.password}]).map(({label,value})=><div key={label} className="flex flex-wrap items-center gap-x-2 text-xs">
        <dt className="w-20 text-[#586950]">{label}</dt>
        <dd className="flex min-w-0 items-center gap-1.5"><code className="select-all break-all font-mono text-xs">{value}</code><button type="button" onClick={()=>void copy(value,label)} aria-label={`${label} kopiëren`} title={`${label} kopiëren`} className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-[#52664c] hover:bg-white/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#49342d]"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V3H3v13h5"/></svg></button></dd>
      </div>)}</dl>:<p className="mt-2 text-xs text-[#65594e]">De gedeelde inlog kan momenteel niet worden geladen.</p>}
      {message&&<p role="status" className="mt-1 text-xs text-[#426039]">{message}</p>}
    </dialog>
  </section>;
}
