"use client";
import { useState, type FormEvent } from "react";
import OperationalDialog from "./OperationalDialog";
import Icon from "./ProductionIcon";
import { DEPARTMENTS, type DepartmentId, productionRoute, productionStepIndex, remainingParty, stageParties, type PreviewState } from "./planning";
import type { PlanCommand } from "./recipePlanning";
import s from "./ProductionStageForm.module.css";
import ProductionPartyPicker, { selectedPartySources } from "./ProductionPartyPicker";


export default function ProductionStageForm({ state, priorId, today, busy, onClose, onPlan }: {
  state: PreviewState;
  priorId: string;
  today: string;
  busy: boolean;
  onClose: () => void;
  onPlan: (command: PlanCommand) => Promise<string | undefined>;
}) {
  const prior = state.tasks.find(task => task.id === priorId);
  const item = state.items.find(item => item.id === prior?.itemId);
  const route = productionRoute(item, prior);
  const index = prior ? productionStepIndex(item, prior) : -1;
  const step = index >= 0 ? route?.steps[index + 1] : undefined;
  const [date, setDate] = useState(prior && prior.date > today ? prior.date : today);
  const [quantities, setQuantities] = useState<Record<string, string>>({ [priorId]: prior ? String(remainingParty(state, prior)) : "" });
  const [error, setError] = useState("");
  const [minutes,setMinutes] = useState("");
  const [crew,setCrew] = useState(String(prior?.plannedCrewSize ?? 1));
  const [departmentId,setDepartmentId] = useState(prior?.departmentId || "dessert");
  const [commandId] = useState(() => `task-${crypto.randomUUID()}`);
  const parties = item && route ? stageParties(state, item, route, index + 1, date) : [];
  const sources = selectedPartySources(parties, quantities);
  const quantity = sources.reduce((sum, row) => sum + row.quantity, 0);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!step || !prior || !item || quantity <= 0) { setError("Kies een partij en hoeveelheid."); return; }
    const result = await onPlan({
      task: { id: commandId, itemId: item.id, departmentId: departmentId as DepartmentId, date, plannedCrewSize: Number(crew), ...(minutes!==""?{minutes:Number(minutes)}:{}), operation: step, status: "planned", note: "", source: "manual", batchId: `stage:${commandId}`, recordsOutput: false },
      amount: quantity, amountMode: "quantity", stage: { stepId: step, sources },
    });
    setError(result || "");
  }
  return <OperationalDialog className={s.dialog} labelledBy="production-stage-title" busy={busy} onClose={onClose} closeOnBackdrop>
    <form onSubmit={submit}>
      <header><div><h2 id="production-stage-title">{step || "Vervolgstap"}</h2><p>{item?.name || "Deze partij is niet meer beschikbaar."}</p></div><button type="button" aria-label="Sluiten" disabled={busy} onClick={onClose}><Icon name="close"/></button></header>
      <div className={s.body}>
        <label className={s.date}>Productiedag<input type="date" required min={prior?.date} value={date} disabled={busy} onChange={event => setDate(event.target.value)}/></label>
        {item && route && <ProductionPartyPicker state={state} item={item} route={route} index={index + 1} date={date} today={today} quantities={quantities} onChange={setQuantities} disabled={busy}/>}
        <div className={s.fields}><label>Afdeling<select disabled={busy} value={departmentId} onChange={e=>setDepartmentId(e.target.value as DepartmentId)}>{DEPARTMENTS.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></label><label>Tijd (minuten)<input type="number" min="0" max="1440" step="any" value={minutes} disabled={busy} onChange={e=>setMinutes(e.target.value)}/></label><label>Aantal personen<input type="number" required min="1" max="20" value={crew} disabled={busy} onChange={e=>setCrew(e.target.value)}/></label></div>
        {error && <p role="alert" className={s.error}>{error}</p>}
      </div>
      <footer><button type="button" disabled={busy} onClick={onClose}>Annuleren</button><button type="submit" className={s.primary} disabled={busy || !step || quantity <= 0}>{busy ? "Opslaan…" : `${step} inplannen`}</button></footer>
    </form>
  </OperationalDialog>;
}
