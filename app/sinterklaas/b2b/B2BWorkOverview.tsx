"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import OperationalDialog from "../../productie/OperationalDialog";
import { fetchB2BOrders } from "../sinterklaasApi";
import type { SinterklaasB2BOrder } from "../types";
import { workOverviewHtml, workOverviewRows, workOverviewToday, type WorkOverviewEntry, type WorkOverviewOptions } from "./workOverview";
import s from "./WorkOverview.module.css";

export default function B2BWorkOverview({year, buildEntry, onClose}: {year:string;buildEntry:(order:SinterklaasB2BOrder)=>WorkOverviewEntry;onClose:()=>void}) {
  const [from,setFrom]=useState(()=>workOverviewToday());
  const [season,setSeason]=useState<WorkOverviewOptions["season"]>("all");
  const [snapshot,setSnapshot]=useState<{entries:WorkOverviewEntry[];generatedAt:string}|null>(null);
  const [error,setError]=useState("");
  const [refresh,setRefresh]=useState(0),[loading,setLoading]=useState(true);
  const [frameReady,setFrameReady]=useState(false);
  const frame=useRef<HTMLIFrameElement>(null);
  useEffect(()=>{
    let active=true;
    fetchB2BOrders(year).then(orders=>{
      if(active){setSnapshot({entries:orders.map(buildEntry),generatedAt:new Date().toISOString()});setError("");}
    }).catch(failure=>{if(active)setError(failure instanceof Error?failure.message:"Bestellingen ophalen mislukt.");})
      .finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[year,refresh,buildEntry]);
  const options=useMemo(()=>({from,year,season,generatedAt:snapshot?.generatedAt||""}),[from,year,season,snapshot]);
  const rows=useMemo(()=>workOverviewRows(snapshot?.entries||[],options),[snapshot,options]);
  const html=useMemo(()=>snapshot&&from?workOverviewHtml(rows,options):"",[snapshot,from,rows,options]);
  function reload(){setLoading(true);setError("");setFrameReady(false);setRefresh(value=>value+1);}
  function print(){try{if(!frame.current?.contentWindow)throw Error();frame.current.contentWindow.focus();frame.current.contentWindow.print();}catch{setError("Afdrukken lukte niet. Open dit overzicht opnieuw en probeer nogmaals.");}}
  return createPortal(<OperationalDialog className={s.dialog} labelledBy="work-overview-title" busy={false} onClose={onClose} closeOnBackdrop>
    <header><div><h2 id="work-overview-title">Tussentijds werkoverzicht</h2><p>Alle definitieve, nog te leveren bestellingen. Zoek- en statusfilters van de lijst tellen hier niet mee.</p></div><button type="button" onClick={onClose} aria-label="Werkoverzicht sluiten">×</button></header>
    <div className={s.controls}><label>Levering vanaf<input type="date" value={from} onChange={event=>{setFrameReady(false);setFrom(event.target.value);}}/></label><label>Bestellingen<select value={season} onChange={event=>{setFrameReady(false);setSeason(event.target.value as WorkOverviewOptions["season"]);}}><option value="all">Sint & Kerst</option><option value="sint">Sint</option><option value="kerst">Kerst</option></select></label><button type="button" disabled={loading} onClick={reload}>Verversen</button><button type="button" className={s.print} disabled={loading||!!error||!from||!rows.length||!frameReady} onClick={print}>Afdrukken</button></div>
    <p className={s.hint}>Compact A4 · op leverdatum · zonder vaste datum apart onderaan. Gemaakte en ingepakte bestellingen blijven zichtbaar tot ze geleverd zijn.</p>
    {error&&<p role="alert" className={s.error}>{error}</p>}
    {loading?<p role="status">Actuele bestellingen ophalen…</p>:html&&!error?<iframe key={html} ref={frame} title="Afdrukvoorbeeld B2B werkoverzicht" className={s.preview} sandbox="allow-same-origin allow-modals" srcDoc={html} onLoad={()=>setFrameReady(true)}/>:null}
  </OperationalDialog>,document.body);
}
