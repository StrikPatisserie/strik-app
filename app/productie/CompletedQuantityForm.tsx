"use client";
import {productionUnit} from "./planning";

import { useState } from "react";
import { convertRecipeQuantity, type DemoRecipe, type Item, type Task } from "./planning";
import { productionDay, type WorkCommand } from "./productionWork";
import styles from "./work.module.css";

export default function CompletedQuantityForm({ task, item, recipe, completedDate = task.date, busy, readOnly = false, onCommand, onClose }: {
  task: Task;
  item: Item;
  recipe?: DemoRecipe;
  completedDate?: string;
  busy: boolean;
  readOnly?: boolean;
  onCommand: (command: WorkCommand) => Promise<string | undefined>;
  onClose: () => void;
}) {
  const [expectedQuantity] = useState(task.completedQuantity ?? task.quantity);
  const [quantity, setQuantity] = useState(String(expectedQuantity));
  const [today] = useState(() => productionDay(new Date().toISOString()));
  const [productionDate, setProductionDate] = useState(completedDate);
  const [who, setWho] = useState("");
  const [error, setError] = useState("");
  const amount = Number(quantity.replace(",", "."));
  let baseQuantity: number | undefined;
  if (recipe && recipe.yield > 0) {
    try { baseQuantity = convertRecipeQuantity(recipe.yield, recipe.unit, item.unit); }
    catch { /* A recipe with an incompatible unit cannot supply a batch quantity. */ }
  }
  const valid = who.trim().length >= 2 && Number.isFinite(amount)
    && amount > 0 && amount <= 1000000 && !!productionDate && productionDate <= today
    && (amount !== expectedQuantity || productionDate !== completedDate || productionDate !== task.date);

  return <form className={`${styles.panel} ${styles.quick} ${styles.correction}`} aria-label="Gemaakt aantal corrigeren" onSubmit={async event => {
    event.preventDefault();
    if (!valid || busy || readOnly) return;
    const result = await onCommand({ kind: "correct-output", taskId: task.id, who, quantity: amount, expectedQuantity, productionDate, expectedProductionDate: completedDate });
    if (result) setError(result);
    else onClose();
  }}>
    <p>{expectedQuantity.toLocaleString("nl-NL", { maximumFractionDigits: 2 })} {productionUnit(item)} geregistreerd</p>
    {baseQuantity !== undefined && <div className={styles.batchButtons}>
      {[baseQuantity, baseQuantity * 2].map((batchQuantity, index) => <button key={index} type="button" disabled={busy || readOnly} onClick={() => setQuantity(String(batchQuantity))}>
        {index + 1}× basisrecept · {batchQuantity.toLocaleString("nl-NL", { maximumFractionDigits: 2 })} {productionUnit(item)}
      </button>)}
    </div>}
    <div className={styles.numbers}>
      <label>Werkelijk gemaakt ({productionUnit(item)})<input autoFocus required inputMode="decimal" disabled={busy} value={quantity} onChange={event => setQuantity(event.target.value)} /></label>
      <label>Jouw naam<input required minLength={2} maxLength={80} disabled={busy} value={who} onChange={event => setWho(event.target.value)} /></label>
    </div>
    <label>Gemaakt op<input type="date" required max={today} disabled={busy} value={productionDate} onChange={event => setProductionDate(event.target.value)} /></label>
    {readOnly && <small>Alleen-lezen preview</small>}
    {error && <p role="alert" className={styles.error}>{error}</p>}
    <div className={styles.buttons}>
      <button type="button" disabled={busy} onClick={onClose}>Annuleren</button>
      <button type="submit" className={styles.primary} disabled={busy || !valid || readOnly}>Bewaar correctie</button>
    </div>
  </form>;
}
