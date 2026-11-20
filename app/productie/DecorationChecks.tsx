"use client";
import { useState } from "react";
import { decorationChecks, type DecorationCheck, type DecorationCommand } from "./decorationPlanning";
import { dateLabel, type PreviewState, type DemoRecipe } from "./planning";
import s from "./DecorationChecks.module.css";

export default function DecorationChecks({state,recipes,week,end,canCheck,busy,onCommand}:{state:PreviewState;recipes:DemoRecipe[];week:string;end:string;canCheck:boolean;busy:boolean;onCommand:(command:DecorationCommand)=>Promise<string|undefined>}) {
  const [showDone,setShowDone]=useState(false),[selected,setSelected]=useState<DecorationCheck|null>(null),[error,setError]=useState("");
  const checks=decorationChecks(state,recipes).filter(c=>c.date<=end && (c.date>=week || c.status==="open"));
  const open=checks.filter(c=>c.status==="open"), rows=showDone?checks:open;
  async function change(command:DecorationCommand) {setError("");const message=await onCommand(command);if(message)setError(message);else setSelected(null);}
  return <section className={s.panel} aria-label="Decoraties controleren">
    <header><div><h2>Decoraties controleren <span>{open.length}</span></h2><p>Voor de geplande afwerking. Elke nieuwe productie krijgt een eigen controle.</p></div><a href="/bakkerij/productie/decoraties">Codelijst ↗</a></header>
    {!!checks.length&&<label className={s.toggle}><input type="checkbox" checked={showDone} onChange={e=>setShowDone(e.target.checked)}/> Ook afgehandelde controles ({checks.length-open.length})</label>}
    {!rows.length&&<p className={s.empty}>{checks.length?"Alle decoraties voor deze afwerkingen zijn gecontroleerd.":"Nog geen afwerking met gekoppelde decoraties in deze week."}</p>}
    {rows.map(check=><article key={check.id} className={s.row}>
      <div><strong>{check.name}</strong><small>{check.product} · afwerken {dateLabel(check.date,true)}{check.date<week?" · eerdere planning":""}</small></div>
      <b>{check.quantity.toLocaleString("nl",{maximumFractionDigits:2})} st.</b>
      {check.status==="open"?<div className={s.actions}><button disabled={!canCheck||busy} onClick={()=>void change({kind:"enough",checkId:check.id,fingerprint:check.fingerprint})}>Genoeg aanwezig</button><button disabled={!canCheck||busy} onClick={()=>{setSelected(check);setError("");}}>{check.method==="purchased"?"Klaarzetten / bestellen":"Inplannen om te maken"}</button></div>:<div className={s.actions}><span className={s.done}>{check.status==="enough"?"✓ Genoeg aanwezig":check.status==="made"?"✓ Gemaakt":`Ingepland · ${dateLabel(check.productionTask!.date)}`}</span><button disabled={!canCheck||busy} onClick={()=>void change({kind:"reopen",checkId:check.id,fingerprint:check.fingerprint})}>Opnieuw controleren</button></div>}
    </article>)}
    {selected&&<form className={s.form} key={selected.fingerprint} onSubmit={e=>{e.preventDefault();const form=new FormData(e.currentTarget);void change({kind:"plan",checkId:selected.id,fingerprint:selected.fingerprint,date:String(form.get("date")),quantity:Number(form.get("quantity")),...(form.get("minutes")?{minutes:Number(form.get("minutes"))}:{})});}}>
      <strong>{selected.code} · {selected.product}</strong>
      <label>Productiedatum<input name="date" type="date" max={selected.date} defaultValue={selected.date} required disabled={busy}/></label>
      <label>Aantal te maken<input name="quantity" type="number" min="1" max="1000000" step="1" defaultValue={Math.ceil(selected.quantity)} required disabled={busy}/></label>
      <small>Er zijn {selected.quantity.toLocaleString("nl")} nodig. Pas het te maken aantal zelf aan als er nog decoraties liggen.</small>
      <label>Tijd (minuten)<input name="minutes" type="number" min="0" max="1440" placeholder="Optioneel" disabled={busy}/></label>
      <button type="submit" disabled={busy}>Inplannen bij Chocolade</button><button type="button" disabled={busy} onClick={()=>setSelected(null)}>Annuleren</button>
    </form>}
    {error&&<p role="alert" className={s.error}>{error}</p>}
  </section>;
}
