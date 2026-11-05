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
  const needsReview=Boolean(plan.issues?.length);
  async function save(){
    setBusy(true);setError("");
    try{const response=await fetch("/api/sinterklaas-letter-production/b2b-planning",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({season,orderId:plan.id,batchId:selected||null,revision:plan.revision,version:plan.version})});const result=await response.json();if(!response.ok)throw new Error(result.message);onSaved();}catch(reason){setError(reason instanceof Error?reason.message:"Opslaan is mislukt.");}finally{setBusy(false);}
  }
  return <div className={styles.b2bPlanningRow}><div><strong>{plan.customerName}</strong>{!!plan.combinationQuantity&&<span className={styles.combinationBadge}>Combinatieproduct · {plan.combinationQuantity} letters</span>}<p>{plan.letters}</p>{plan.issues?.map(issue=><p key={issue} className={styles.error}>{issue}</p>)}<small>{plan.deliveryDate?`Gewenste levering ${date(plan.deliveryDate)}`:"Leverdatum nog afspreken"} · {needsReview?"Eerst controleren":current?`${plan.manual?"Ingepland":"Voorgestelde ronde"}: ${date(current.startDate)}`:"Nog niet ingedeeld"}</small></div><div><label>Productieronde<select aria-label={`Productieronde voor ${plan.customerName}`} disabled={busy||locked||needsReview} value={selected} onChange={event=>setSelected(event.target.value)}><option value="">Nog niet inplannen</option>{batches.map(batch=><option key={batch.id} value={batch.id} disabled={Boolean(batch.checklist)||productionDeadlinePassed(batch)||Boolean(plan.deliveryDate&&batchReadyDate(batch)>plan.deliveryDate)}>{date(batch.startDate)} · deadline {deadline(batch.deadlineAt)}{productionDeadlinePassed(batch)?" · gesloten":""}</option>)}</select></label><button type="button" className={styles.button} disabled={busy||locked||needsReview||selected===(plan.batchId||"")&&plan.manual} onClick={()=>void save()}>{busy?"Opslaan…":"Planning vastleggen"}</button>{needsReview&&<small>Vul de letterkeuze aan in de B2B-bestelling.</small>}{locked&&<small>De deadline is voorbij; deze ronde staat vast.</small>}{error&&<p role="alert" className={styles.error}>{error}</p>}</div></div>;
}
export default function B2BProductionPlanning({plans,batches,season,onSaved}:Readonly<{plans:B2BProductionPlan[];batches:ProductionBatchSeed[];season:string;onSaved:()=>void}>){
  return <details className={styles.b2bPlanning}><summary>B2B-letters inplannen <span>{plans.length} bestellingen</span></summary><p>Losse letters en letters uit combinatieproducten. Bij combinatieproducten wordt alleen de letter hier gemaakt; het pakket blijft in de B2B-lijst.</p>{plans.map(plan=><PlanningRow key={`${plan.id}:${plan.revision}:${plan.version}`} plan={plan} batches={batches} season={season} onSaved={onSaved}/>)}{!plans.length&&<p>Geen definitieve B2B-letters om in te plannen.</p>}</details>;
}
