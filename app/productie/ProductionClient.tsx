"use client";
import ProductionLoading from "./ProductionLoading";
import ProductionResourceFrame from "./ProductionResourceFrame";
import { useProductionSession } from "./ProductionSession";
import { useCallback, useEffect, useRef, useState } from "react";
import ProductionPreview from "../preview/productie/ProductionPreview";
import type { LiveWorkspace } from "./workspaceData";
import type { RecipeTransferReport } from "./recipeMigration";
import s from "../preview/productie/production.module.css";
import type { BoardId, DepartmentId } from "./planning";

function unchangedWorkspace(current:LiveWorkspace,next:LiveWorkspace) {
  if(current.revision!==next.revision || current.recipeRevision!==next.recipeRevision)return false;
  if(Object.keys(current).length!==Object.keys(next).length)return false;
  // The document revisions cover these large projections. Other metadata,
  // including permissions, date and offers, can change independently.
  return Object.entries(next).every(([key,value])=>
    ["state","recipes","ingredients"].includes(key) || JSON.stringify(current[key as keyof LiveWorkspace])===JSON.stringify(value));
}

export default function ProductionClient({canManage,initialView,initialBoard,initialDepartment,initialWeek,initialTask,appVersion='development'}:{appVersion?:string;canManage:boolean;initialView?:string;initialBoard?:BoardId;initialDepartment?:DepartmentId;initialWeek?:string;initialTask?:string}) {
  const session=useProductionSession();
  const [workspace,setWorkspace]=useState<LiveWorkspace|null>(null);
  const [error,setError]=useState("");
  const [setup,setSetup]=useState(false);
  const [busy,setBusy]=useState(false);
  const [report,setReport]=useState<RecipeTransferReport|null>(null);
  const [loading,setLoading]=useState(true);
  const serial=useRef(0);
  const pending=useRef(0);
  const [mountedVersion]=useState(appVersion);
  const load=useCallback(async()=>{
    const id=++serial.current;
    pending.current++;
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),20000);
    try {
      const response=await fetch("/api/productie",{cache:"no-store",signal:controller.signal}),data=await response.json();
      if (!response.ok) { setSetup(!!data.setupRequired); throw Error(data.message || "De planning kon niet worden vernieuwd."); }
      if(id===serial.current){setWorkspace(current=>current&&(current.revision>data.revision || unchangedWorkspace(current,data))?current:data);setError("");setSetup(false);}
    } catch(e) {if(id===serial.current)setError(controller.signal.aborted?"Verversen duurt te lang. Probeer opnieuw.":(e as Error).message);} finally {clearTimeout(timeout);pending.current--;if(id===serial.current)setLoading(false);}
  },[]);
  const available=!!workspace;
  useEffect(()=>{void load();},[load]);
  useEffect(()=>{if(!available || busy)return;const timer=setInterval(()=>{if(!document.hidden&&!pending.current&&(typeof navigator==='undefined'||navigator.onLine!==false))void load();},15000);return()=>clearInterval(timer);},[load,available,busy]);
  async function transfer(migrate=false) {
    setBusy(true);setError("");
    try {
      const response=await fetch("/api/productie/transfer",migrate?{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"migrate"})}:{cache:"no-store"});
      const data=await response.json();if(data.report)setReport(data.report);
      if(!response.ok)throw Error(data.message || "De overdracht is niet gelukt.");
      if(data.active)await load();
    } catch(e) {setError((e as Error).message);} finally {setBusy(false);}
  }
  if(workspace)return <>{error && <div className={s.connectionWarning} role="alert">Verbinding onderbroken: {error} De getoonde planning kan verouderd zijn. <button onClick={()=>void load()}>Opnieuw proberen</button></div>}<ProductionPreview connectionHealthy={!error} releaseVersion={mountedVersion} live={workspace} onRefresh={load} initialView={initialView} initialBoard={initialBoard} initialDepartment={initialDepartment} initialWeek={initialWeek} initialTask={initialTask}/></>;
  if(loading)return <ProductionLoading/>;
  return <ProductionResourceFrame title="Productieomgeving aansluiten" active="planning" canManage={canManage} canManageData={session.canManageData} departments={session.departments}><div className={s.settingCard}><p>{setup?"De nieuwe omgeving gebruikt één gedeelde receptenbron in Supabase. De bestaande WordPress-gegevens blijven als herstelkopie behouden.":error || "Even geduld, je gegevens worden geladen."}</p>{session.canManageData && setup && <><button disabled={busy} className={s.secondaryButton} onClick={()=>void transfer()}>Brongegevens controleren</button>{report && <section className={s.settingCard}><h2>Controle overdracht</h2><p>{report.counts.recipes} recepten · {report.counts.semiFinished} halffabricaten · {report.counts.ingredients} grondstoffen · {report.counts.invoices} facturen</p><p>{report.errors.length} blokkerende punten · {report.warnings.length} aandachtspunten</p>{report.errors.length>0 && <ul>{report.errors.slice(0,30).map((e,i)=><li key={i}>{e.collection}{e.index!==undefined?` #${e.index+1}`:""}: {e.code}{e.field?` (${e.field})`:""}</li>)}</ul>}<button disabled={busy || !report.ready} className={s.primaryButton} onClick={()=>void transfer(true)}>{busy?"Overdracht en eindcontrole bezig…":"Recepten gecontroleerd overzetten"}</button></section>}</>}{error && !loading && <p role="alert" className={s.formError}>{error}</p>}{busy && <p role="status">Laat dit scherm open tot de overdracht is afgerond.</p>}</div></ProductionResourceFrame>;
}
