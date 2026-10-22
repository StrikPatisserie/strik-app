"use client";
import { useState } from "react";
import { productionDeadlinePassed } from "./productionChecklist";
import { batchReadyDate, type B2BProductionPlan } from "./b2bProductionPlanning";
import type { ProductionBatchSeed } from "./ProductionPlanningClient";
import styles from "./ProductionPlanning.module.css";
const date=(value:string)=>new Intl.DateTimeFormat("nl-NL",{day:"numeric",month:"short",timeZone:"UTC"}).format(new Date(`${value}T12:00:00Z`));
const deadline=(value?:string)=>value?new Intl.DateTimeFormat("nl-NL",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit",timeZone:"Europe/Amsterdam"}).format(new Date(value)):"niet ingesteld";
function PlanningRow({plan,batches,season,onSaved}:Readonly<{plan:B2BProductionPlan;batches:ProductionBatchSeed[];season:string;onSaved:()=>void}>){
  const [selected,setSelected]=useState(plan.batchId||"");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const current=batches.find(batch=>batch.id===plan.batchId);
  const locked=Boolean(current&&(current.checklist||productionDeadlinePassed(current)));
  async function save(){
    setBusy(true);setError("");
    try{const response=await fetch("/api/sinterklaas-letter-production/b2b-planning",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({season,orderId:plan.id,batchId:selected||null,revision:plan.revision,version:plan.version})});const result=await response.json();if(!response.ok)throw new Error(result.message);onSaved();}catch(reason){setError(reason instanceof Error?reason.message:"Opslaan is mislukt.");}finally{setBusy(false);}
  }
  return <div className={styles.b2bPlanningRow}><div><strong>{plan.customerName}</strong><p>{plan.letters}</p><small>{plan.deliveryDate?`Gewenste levering ${date(plan.deliveryDate)}`:"Leverdatum nog afspreken"} · {current?`${plan.manual?"Ingepland":"Voorgestelde ronde"}: ${date(current.startDate)}`:"Nog niet ingedeeld"}</small></div><div><label>Productieronde<select aria-label={`Productieronde voor ${plan.customerName}`} disabled={busy||locked} value={selected} onChange={event=>setSelected(event.target.value)}><option value="">Nog niet inplannen</option>{batches.map(batch=><option key={batch.id} value={batch.id} disabled={Boolean(batch.checklist)||productionDeadlinePassed(batch)||Boolean(plan.deliveryDate&&batchReadyDate(batch)>plan.deliveryDate)}>{date(batch.startDate)} · deadline {deadline(batch.deadlineAt)}{productionDeadlinePassed(batch)?" · gesloten":""}</option>)}</select></label><button type="button" className={styles.button} disabled={busy||locked||selected===(plan.batchId||"")&&plan.manual} onClick={()=>void save()}>{busy?"Opslaan…":"Planning vastleggen"}</button>{locked&&<small>De deadline is voorbij; deze ronde staat vast.</small>}{error&&<p role="alert" className={styles.error}>{error}</p>}</div></div>;
}
export default function B2BProductionPlanning({plans,batches,season,onSaved}:Readonly<{plans:B2BProductionPlan[];batches:ProductionBatchSeed[];season:string;onSaved:()=>void}>){
  return <details className={styles.b2bPlanning}><summary>B2B-letters inplannen <span>{plans.length} bestellingen met losse letters</span></summary><p>Alleen definitieve bestellingen met losse chocoladeletters. Letters bij combinatieartikelen, zoals speculaaspakketten, staan hier niet tussen. Een voorgestelde ronde kun je vóór de deadline vastleggen of aanpassen.</p>{plans.map(plan=><PlanningRow key={`${plan.id}:${plan.revision}:${plan.version}`} plan={plan} batches={batches} season={season} onSaved={onSaved}/>)}{!plans.length&&<p>Geen definitieve losse B2B-letters om in te plannen.</p>}</details>;
}
