"use client";
import { useState } from "react";
import { productionDeadlinePassed } from "./productionChecklist";
import { batchReadyDate, type B2BProductionPlan } from "./b2bProductionPlanning";
import type { ProductionBatchSeed } from "./ProductionPlanningClient";
import styles from "./ProductionPlanning.module.css";
const date = (value: string) => new Intl.DateTimeFormat("nl-NL", {day:"numeric", month:"short", timeZone:"UTC"}).format(new Date(`${value}T12:00:00Z`));
type Props = Readonly<{plans:B2BProductionPlan[]; batches:ProductionBatchSeed[]; season:string; onSaved:()=>void; onExtra:(batchId:string)=>void}>;
function PlanningRow({plan,batches,season,onSaved,onExtra}: Omit<Props,"plans"> & {plan:B2BProductionPlan}) {
  const options = [...new Set(batches.map(batch => batch.startDate))].sort().map(day => {
    const runs = batches.filter(batch => batch.startDate === day);
    const main = runs.find(batch => !batch.supplementId);
    const closed = main ? Boolean(main.checklist?.lockedAt) || productionDeadlinePassed(main) : runs.some(batch => batch.checklist?.lockedAt);
    const tooLate = Boolean(plan.deliveryDate && (main ? batchReadyDate(main) : day) > plan.deliveryDate);
    return {day, label: `${date(day)}${main ? "" : " · extra"}${closed ? " · vast" : ""}`, disabled: closed || tooLate};
  });
  const initial = plan.scheduledDate || "";
  const [selected,setSelected] = useState(plan.productionDates && plan.productionDates.length > 1 ? "multiple" : initial && !options.some(option => option.day === initial) ? "custom" : initial);
  const [customDate,setCustomDate] = useState(initial);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState("");
  const chosen = selected === "custom" ? customDate : selected;
  const disabled = busy || !plan.canReplan;
  async function save() {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/sinterklaas-letter-production/b2b-planning", {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({season,orderId:plan.id,date:chosen || null,revision:plan.revision,version:plan.version,scheduleVersion:plan.scheduleVersion})});
      const result = await response.json(); if (!response.ok) throw new Error(result.message); onSaved();
    } catch (reason) {setError(reason instanceof Error ? reason.message : "Opslaan is mislukt.");} finally {setBusy(false);}
  }
  return <div className={styles.b2bPlanningRow}>
    <div><strong>{plan.customerName}</strong><small>{plan.quantity} letters · {plan.deliveryDate ? `Levering ${date(plan.deliveryDate)}` : "Leverdatum nog afspreken"}{!!plan.combinationQuantity && " · in pakket"}</small>
      <small>{plan.productionDates?.length ? `Productie ${plan.productionDates.map(date).join(" + ")} · ${plan.planningNote}` : plan.planningNote}{!!plan.pendingQuantity && plan.productionDates?.length ? ` · ${plan.pendingQuantity} nog inplannen` : ""}</small>
      <details className={styles.b2bLetterDetails}><summary>Letters en opmerkingen</summary><p>{plan.letters}</p></details>
      {plan.issues?.map(issue => <p key={issue} className={styles.error}>{issue}</p>)}
    </div>
    <div><div className={styles.b2bPlanningControls}>
      <select aria-label={`Productiedag voor ${plan.customerName}`} disabled={disabled} value={selected} onChange={event=>setSelected(event.target.value)}>
        <option value="">Later inplannen</option>
        {options.map(option=><option key={option.day} value={option.day} disabled={option.disabled}>{option.label}</option>)}
        {plan.productionDates && plan.productionDates.length > 1 && <option value="multiple" disabled>Meerdere dagen</option>}
        <option value="custom">+ Extra productiedag…</option>
      </select>
      {selected === "custom" && <input type="date" aria-label={`Extra productiedag voor ${plan.customerName}`} disabled={disabled} min={new Intl.DateTimeFormat("sv-SE",{timeZone:"Europe/Amsterdam"}).format(new Date())} max={plan.deliveryDate || `${season}-12-31`} value={customDate} onChange={event=>setCustomDate(event.target.value)}/>}
      <button type="button" className={styles.button} disabled={disabled || selected === "custom" && !customDate || chosen === initial && (Boolean(initial) || plan.manual)} onClick={()=>void save()}>{busy ? "Opslaan…" : "Opslaan"}</button>
    </div>
    {!plan.canReplan && !!plan.pendingQuantity && plan.batchId && !plan.issues?.length && <button type="button" className={styles.button} onClick={()=>onExtra(plan.batchId!)}>Extra {plan.pendingQuantity} letters inplannen</button>}
    {!!plan.issues?.length && <small>Vul de letterkeuze aan in de B2B-bestelling.</small>}
    {error && <p role="alert" className={styles.error}>{error}</p>}</div>
  </div>;
}
export default function B2BProductionPlanning(props: Props) {
  const pending = props.plans.filter(plan => !!plan.pendingQuantity || !plan.productionDates?.length || !!plan.issues?.length);
  const planned = props.plans.filter(plan => !pending.includes(plan));
  const rows = (plans:B2BProductionPlan[]) => plans.map(plan => <PlanningRow key={`${plan.id}:${plan.revision}:${plan.version}:${plan.productionDates?.join()}:${plan.pendingQuantity}`} plan={plan} batches={props.batches} season={props.season} onSaved={props.onSaved} onExtra={props.onExtra}/>);
  return <>
    <details className={styles.b2bPlanning}><summary>B2B-productieplanning <span>{planned.length} ingepland</span></summary>{rows(planned)}{!planned.length && <p>Nog geen B2B-bestellingen ingepland.</p>}</details>
    {pending.length > 0 && <details className={`${styles.b2bPlanning} ${styles.b2bUnplanned}`} open><summary>B2B nog niet ingepland <span>{pending.length} bestellingen</span></summary>{rows(pending)}</details>}
  </>;
}
