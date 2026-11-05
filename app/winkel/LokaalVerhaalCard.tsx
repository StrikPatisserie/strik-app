"use client";
import Image from "next/image";
import {useState} from "react";
import type {LokaalVerhaalCredentials} from "./lokaalVerhaal.server";

export const LOKAAL_VERHAAL_URL="https://beheer.lokaalverhaal.com/Sales/DeliveryRegistration";

export default function LokaalVerhaalCard({credentials}:{credentials:LokaalVerhaalCredentials|null}) {
  const [message,setMessage]=useState("");
  async function copy(value:string,label:string) {
    try {await navigator.clipboard.writeText(value);setMessage(`${label} gekopieerd.`);}
    catch {setMessage("Selecteer de inlogtekst om deze te kopiëren.");}
  }
  return <section aria-label="Lokaal Verhaal" className="my-5 flex flex-wrap items-center gap-4 border-t border-[#aabda2]/65 px-1 pt-4 sm:gap-5">
    <a href={LOKAAL_VERHAAL_URL} target="_blank" rel="noopener noreferrer" aria-label="Open Lokaal Verhaal om QR-codes te scannen (nieuw tabblad)" title="Open Lokaal Verhaal · QR-codes scannen" className="block shrink-0 rounded-2xl transition hover:opacity-85 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#49342d]">
      <Image src="/lokaalverhaal.png" alt="Lokaal Verhaal" width={112} height={108} className="h-24 w-auto object-contain"/>
    </a>
    <div className="min-w-0 text-[#49342d]">
      <h2 className="text-sm font-bold">QR-codes inleveren &amp; scannen</h2>
      {credentials?<dl className="mt-2 grid gap-1.5">{([{label:"E-mailadres",value:credentials.username},{label:"Wachtwoord",value:credentials.password}]).map(({label,value})=><div key={label} className="flex flex-wrap items-center gap-x-2 text-xs">
        <dt className="w-20 text-[#586950]">{label}</dt>
        <dd className="flex min-w-0 items-center gap-1.5"><code className="select-all break-all font-mono text-xs">{value}</code><button type="button" onClick={()=>void copy(value,label)} aria-label={`${label} kopiëren`} title={`${label} kopiëren`} className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-[#52664c] hover:bg-white/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#49342d]"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V3H3v13h5"/></svg></button></dd>
      </div>)}</dl>:<p className="mt-2 text-xs text-[#65594e]">De gedeelde inlog kan momenteel niet worden geladen.</p>}
      {message&&<p role="status" className="mt-1 text-xs text-[#426039]">{message}</p>}
    </div>
  </section>;
}
