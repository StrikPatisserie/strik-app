"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import OperationalDialog from "../../productie/OperationalDialog";
import { fetchB2BOrders } from "../sinterklaasApi";
import type { SinterklaasB2BOrder } from "../types";
import { workOverviewEnd, workOverviewRangeValid, workOverviewRows, workOverviewToday, type WorkOverviewEntry, type WorkOverviewOptions } from "./workOverview";
import { createWorkOverviewPdf } from "./workOverviewPdf";
import s from "./WorkOverview.module.css";

type PrintResult = { key:string;url:string;previews:string[];pages:number };
export default function B2BWorkOverview({year, buildEntry, onClose}: {year:string;buildEntry:(order:SinterklaasB2BOrder)=>WorkOverviewEntry;onClose:()=>void}) {
  const [from,setFrom]=useState(()=>workOverviewToday());
  const [to,setTo]=useState(()=>workOverviewEnd(workOverviewToday()));
  const [season,setSeason]=useState<WorkOverviewOptions["season"]>("all");
  const [includeUndated,setIncludeUndated]=useState(false),[internalNotes,setInternalNotes]=useState(false);
  const [snapshot,setSnapshot]=useState<{entries:WorkOverviewEntry[];generatedAt:string}|null>(null);
  const [error,setError]=useState("");
  const [refresh,setRefresh]=useState(0),[loading,setLoading]=useState(true);
  const [result,setResult]=useState<PrintResult|null>(null),[loadedUrl,setLoadedUrl]=useState("");
  const frame=useRef<HTMLIFrameElement>(null);
  useEffect(()=>{
    let active=true;
    fetchB2BOrders(year).then(orders=>{
      if(active){setSnapshot({entries:orders.map(buildEntry),generatedAt:new Date().toISOString()});setError("");}
    }).catch(failure=>{if(active){setSnapshot(null);setError(failure instanceof Error?failure.message:"Bestellingen ophalen mislukt.");}})
      .finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[year,refresh,buildEntry]);
  const options=useMemo(()=>({from,to,year,season,includeUndated,internalNotes,generatedAt:snapshot?.generatedAt||""}),[from,to,year,season,includeUndated,internalNotes,snapshot]);
  const valid=!!to&&workOverviewRangeValid(options);
  const rows=useMemo(()=>workOverviewRows(snapshot?.entries||[],options),[snapshot,options]);
  const printKey=JSON.stringify(options);
  const current=result?.key===printKey?result:null;
  useEffect(()=>{
    if(!snapshot||loading||!valid)return;
    let active=true,url="";
    createWorkOverviewPdf(rows,options).then(pdf=>{
      if(!active)return;
      url=URL.createObjectURL(pdf.blob);
      setResult({key:printKey,url,previews:pdf.previews,pages:pdf.pages});setError("");
    }).catch(failure=>{if(active)setError(failure instanceof Error?failure.message:"Printvoorbeeld maken mislukt.");});
    return()=>{active=false;if(url)URL.revokeObjectURL(url);};
  },[rows,options,printKey,valid,snapshot,loading]);
  function reload(){setLoading(true);setError("");setRefresh(value=>value+1);}
  function print(){try{if(!frame.current?.contentWindow)throw Error();frame.current.contentWindow.focus();frame.current.contentWindow.print();}catch{setError("Afdrukken lukte niet. Download het PDF en open het om af te drukken.");}}
  return createPortal(<OperationalDialog className={s.dialog} labelledBy="work-overview-title" busy={false} onClose={onClose} closeOnBackdrop>
    <header><div><h2 id="work-overview-title">Tussentijds werkoverzicht</h2><p>Definitieve, nog te leveren bestellingen binnen de gekozen leverperiode.</p></div><button type="button" onClick={onClose} aria-label="Werkoverzicht sluiten">×</button></header>
    <div className={s.controls}>
      <label>Levering vanaf<input type="date" value={from} onInput={event=>setFrom(event.currentTarget.value)} onChange={event=>setFrom(event.target.value)}/></label>
      <label>Tot en met<input type="date" value={to} min={from} onInput={event=>setTo(event.currentTarget.value)} onChange={event=>setTo(event.target.value)}/></label>
      <label>Bestellingen<select value={season} onChange={event=>setSeason(event.target.value as WorkOverviewOptions["season"])}><option value="all">Sint & Kerst</option><option value="sint">Sint</option><option value="kerst">Kerst</option></select></label>
      <button type="button" disabled={loading} onClick={reload}>Verversen</button>
      <button type="button" className={s.print} disabled={loading||!!error||!valid||!rows.length||!current||loadedUrl!==current.url} onClick={print}>Afdrukken{current?` · ${current.pages} ${current.pages===1?'pagina':"pagina’s"}`:''}</button>
      {current&&valid&&!loading&&!error&&<a href={current.url} download={`B2B-werkoverzicht-${from}-tm-${to}.pdf`}>PDF downloaden</a>}
    </div>
    <div className={s.options}><label><input type="checkbox" checked={includeUndated} onChange={event=>setIncludeUndated(event.target.checked)}/>Ook zonder leverdatum</label><label><input type="checkbox" checked={internalNotes} onChange={event=>setInternalNotes(event.target.checked)}/>Interne notities erbij</label></div>
    <p className={s.hint}>Compact A4 · werk- en inpakafspraken inbegrepen · overlappende leverweken/-periodes staan met hun hele periode vermeld.{current&&current.pages>2?` Deze selectie vraagt ${current.pages} pagina’s. Kies een kortere leverperiode voor 1–2 pagina’s.`:''}</p>
    {!valid&&<p role="alert" className={s.error}>Kies een geldige begin- en einddatum. De einddatum mag niet vóór de begindatum liggen.</p>}
    {error&&<p role="alert" className={s.error}>{error}</p>}
    {loading?<p role="status">Actuele bestellingen ophalen…</p>:valid&&!error&&!current?<p role="status">Compact printvoorbeeld maken…</p>:null}
    {!loading&&valid&&!error&&current&&<>
      <p className={s.result} role="status">{rows.length} bestellingen · {current.pages} {current.pages===1?'pagina':"pagina’s"}{!internalNotes?' · zonder interne notities':''}</p>
      <div className={s.preview}>{!rows.length?<p>Geen nog te leveren bestellingen in deze periode.</p>:current.previews.map((src,index)=><div key={src} className={s.sheet}>
        {/* The generated page image is the exact artwork embedded in the printable PDF. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={`B2B werkoverzicht, pagina ${index+1} van ${current.pages}`} />
      </div>)}</div>
      <iframe key={current.url} ref={frame} title="Printbestand B2B werkoverzicht" src={current.url} className={s.printFrame} aria-hidden="true" tabIndex={-1} onLoad={()=>setLoadedUrl(current.url)}/>
    </>}
  </OperationalDialog>,document.body);
}
