"use client";

import { useState } from "react";
import { convertRecipeQuantity, type DemoRecipe, type Item, type PreviewState, type Task } from "./planning";
import { elapsedMilliseconds, learnedWorkEstimate, workView, type WorkCommand } from "./productionWork";
import Icon from "./ProductionIcon";
import styles from "./work.module.css";

export default function QuickTaskCompletion({ state, task, item, recipes, busy, onCommand, onClose, readOnly = false }: {
  state: PreviewState;
  task: Task;
  item: Item;
  recipes: DemoRecipe[];
  busy: boolean;
  readOnly?: boolean;
  onCommand: (command: WorkCommand) => Promise<string | undefined>;
  onClose: () => void;
}) {
  const timer = state.productionWork?.timers?.[task.id];
  const [who, setWho] = useState(timer?.who || "");
  const [measuredMinutes] = useState(() => timer
    ? Math.max(1, Math.round(elapsedMilliseconds(timer, Date.now()) / 60000)) : undefined);
  const [enteredMinutes, setMinutes] = useState<string | null>(null);
  const [crew, setCrew] = useState(String(timer?.crewSize ?? 1));
  const [quantity, setQuantity] = useState(String(task.quantity));
  const [error, setError] = useState("");
  const madeQuantity = Number(quantity.replace(",", "."));
  const recipe = state.productionWork?.overrides?.[task.id] || recipes.find(recipe => recipe.id === item.recipeId);
  let baseQuantity: number | undefined;
  if (recipe && recipe.yield > 0) {
    try { baseQuantity = convertRecipeQuantity(recipe.yield, recipe.unit, item.unit); }
    catch { /* Only offer base recipes when their yield matches the task unit. */ }
  }
  const estimate = state.productionWork?.overrides?.[task.id] ? null
    : learnedWorkEstimate(workView(state, recipes), item.id, task.operation, madeQuantity, Number(crew));
  const suggestedMinutes = measuredMinutes ?? estimate?.minutes ?? task.minutes;
  const minutes = enteredMinutes ?? (suggestedMinutes !== undefined && suggestedMinutes > 0 ? String(suggestedMinutes) : "");
  const amount = Number(minutes.replace(",", "."));
  const valid = who.trim().length >= 2 && who.trim().length <= 80 && Number.isFinite(amount) && amount > 0 && amount <= 1440
    && Number.isFinite(madeQuantity) && madeQuantity > 0 && madeQuantity <= 1000000
    && Number.isInteger(Number(crew)) && Number(crew) >= 1 && Number(crew) <= 20;

  return <form className={`${styles.panel} ${styles.quick}`} onSubmit={async event => {
    event.preventDefault();
    if (!valid || busy || readOnly) return;
    const result = await onCommand({ kind: "complete", taskId: task.id, who,
      minutes: amount, crewSize: Number(crew), quantity: madeQuantity, timerId: timer?.id });
    if (result) setError(result);
    else onClose();
  }}>
    <p className={styles.quickQuantity}>Gepland · {task.quantity.toLocaleString("nl-NL")} {item.unit}</p>
    <div className={styles.numbers}>
      <label>Naam<input autoFocus required minLength={2} maxLength={80} value={who} disabled={busy} onChange={event => setWho(event.target.value)} /></label>
      <label>Werkelijk gemaakt ({item.unit})<input required inputMode="decimal" value={quantity} disabled={busy} onChange={event => setQuantity(event.target.value)} /></label>
    </div>
    {baseQuantity !== undefined && <div className={styles.batchButtons}>
      {[baseQuantity, baseQuantity * 2].map((batchQuantity, index) => <button key={index} type="button" disabled={busy || readOnly} onClick={() => setQuantity(String(batchQuantity))}>
        {index + 1}× basisrecept · {batchQuantity.toLocaleString("nl-NL", { maximumFractionDigits: 2 })} {item.unit}
      </button>)}
    </div>}
    <div className={styles.numbers}>
      <label>Tijd (minuten)<input required inputMode="decimal" value={minutes} disabled={busy} onChange={event => setMinutes(event.target.value)} /></label>
      <label>Aantal mensen<input required type="number" min="1" max="20" step="1" value={crew} disabled={busy} onChange={event => setCrew(event.target.value)} /></label>
    </div>
    {!timer && estimate && <p className={styles.estimate}>Advies ± {estimate.minutes.toLocaleString("nl-NL", { maximumFractionDigits: 1 })} min · {crew} {Number(crew) === 1 ? "persoon" : "personen"} · {estimate.measurements} eerdere {estimate.measurements === 1 ? "productie" : "producties"}</p>}
    {!timer && !estimate && task.minutes !== undefined && task.minutes > 0 && <p className={styles.estimate}>Geplande tijd · {task.minutes.toLocaleString("nl-NL")} min</p>}
    {readOnly && <small>Alleen-lezen preview</small>}
    {error && <p role="alert" className={styles.error}>{error}</p>}
    <div className={`${styles.buttons} ${styles.completionActions}`}>
      <button className={styles.adjust} type="button" disabled={busy} onClick={onClose}>Annuleren</button>
      <button type="submit" className={styles.primary} disabled={busy || !valid || readOnly}><Icon name="check" size={16}/>{busy ? "Opslaan…" : "Opslaan & klaar"}</button>
    </div>
  </form>;
}
