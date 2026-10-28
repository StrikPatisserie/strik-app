"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import ProductionPreview from "../preview/productie/ProductionPreview";
import type { LiveWorkspace } from "./workspaceData";
import type { RecipeTransferReport } from "./recipeMigration";
import s from "../preview/productie/production.module.css";

export default function ProductionClient({canManage}:{canManage:boolean}) {
  const [workspace,setWorkspace]=useState<LiveWorkspace|null>(null);
  const [error,setError]=useState("");
  const [setup,setSetup]=useState(false);
  const [busy,setBusy]=useState(false);
  const [report,setReport]=useState<RecipeTransferReport|null>(null);
  const [loading,setLoading]=useState(true);
  const load=useCallback(async()=>{
    try {
      const response=await fetch("/api/productie",{cache:"no-store"}),data=await response.json();
      if (!response.ok) { setSetup(!!data.setupRequired); throw Error(data.message || "De planning kon niet worden vernieuwd."); }
      setWorkspace(data);setError("");setSetup(false);
    } catch(e) {setError((e as Error).message);} finally {setLoading(false);}
  },[]);
  const available=!!workspace;
  useEffect(()=>{void load();},[load]);
  useEffect(()=>{if(!available || busy)return;const timer=setInterval(()=>{if(!document.hidden)void load();},15000);return()=>clearInterval(timer);},[load,available,busy]);
  async function transfer(migrate=false) {
    setBusy(true);setError("");
    try {
      const response=await fetch("/api/productie/transfer",migrate?{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"migrate"})}:{cache:"no-store"});
      const data=await response.json();if(data.report)setReport(data.report);
      if(!response.ok)throw Error(data.message || "De overdracht is niet gelukt.");
      if(data.active)await load();
    } catch(e) {setError((e as Error).message);} finally {setBusy(false);}
  }
  if(workspace)return <>{error && <div className={s.connectionWarning} role="alert">Verbinding onderbroken: {error} De getoonde planning kan verouderd zijn. <button onClick={()=>void load()}>Opnieuw proberen</button></div>}<ProductionPreview live={workspace} onRefresh={load}/></>;
  return <main className={s.setupPage}><Link href="/bakkerij">← Terug naar Productie</Link><span className={s.eyebrow}>STRIK PRODUCTIE</span><h1>{loading?"Je productieomgeving laden…":"Productieomgeving aansluiten"}</h1><p>{setup?"De nieuwe omgeving gebruikt één gedeelde receptenbron in Supabase. De bestaande WordPress-gegevens blijven als herstelkopie behouden.":error || "Even geduld, je gegevens worden geladen."}</p>{canManage && setup && <><button disabled={busy} className={s.secondaryButton} onClick={()=>void transfer()}>Brongegevens controleren</button>{report && <section className={s.settingCard}><h2>Controle overdracht</h2><p>{report.counts.recipes} recepten · {report.counts.semiFinished} halffabricaten · {report.counts.ingredients} grondstoffen · {report.counts.invoices} facturen</p><p>{report.errors.length} blokkerende punten · {report.warnings.length} aandachtspunten</p>{report.errors.length>0 && <ul>{report.errors.slice(0,30).map((e,i)=><li key={i}>{e.collection}{e.index!==undefined?` #${e.index+1}`:""}: {e.code}{e.field?` (${e.field})`:""}</li>)}</ul>}<button disabled={busy || !report.ready} className={s.primaryButton} onClick={()=>void transfer(true)}>{busy?"Overdracht en eindcontrole bezig…":"Recepten gecontroleerd overzetten"}</button></section>}</>}{error && !loading && <p role="alert" className={s.formError}>{error}</p>}{busy && <p role="status">Laat dit scherm open tot de overdracht is afgerond.</p>}</main>;
}
