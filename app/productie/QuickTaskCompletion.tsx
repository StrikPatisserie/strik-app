"use client";

import { useState } from "react";
import type { Item, PreviewState, Task } from "./planning";
import { elapsedMilliseconds, type WorkCommand } from "./productionWork";
import styles from "./work.module.css";

export default function QuickTaskCompletion({ state, task, item, busy, onCommand, onClose }: {
  state: PreviewState;
  task: Task;
  item: Item;
  busy: boolean;
  onCommand: (command: WorkCommand) => Promise<string | undefined>;
  onClose: () => void;
}) {
  const timer = state.productionWork?.timers?.[task.id];
  const [who, setWho] = useState(timer?.who || "");
  const [minutes, setMinutes] = useState(() => timer
    ? String(Math.max(1, Math.round(elapsedMilliseconds(timer, Date.now()) / 60000))) : "");
  const [crew, setCrew] = useState(String(timer?.crewSize ?? 1));
  const [error, setError] = useState("");
  const amount = Number(minutes.replace(",", "."));
  const valid = who.trim().length >= 2 && amount > 0 && amount <= 1440
    && Number.isInteger(Number(crew)) && Number(crew) >= 1 && Number(crew) <= 20;

  return <form className={`${styles.panel} ${styles.quick}`} onSubmit={async event => {
    event.preventDefault();
    if (!valid || busy) return;
    const result = await onCommand({ kind: "complete", taskId: task.id, who,
      minutes: amount, crewSize: Number(crew), quantity: task.quantity, timerId: timer?.id });
    if (result) setError(result);
    else onClose();
  }}>
    <p className={styles.quickQuantity}>{task.quantity.toLocaleString("nl-NL")} {item.unit} gemaakt · {task.operation}</p>
    <label>Naam<input autoFocus required minLength={2} maxLength={80} value={who} disabled={busy} onChange={event => setWho(event.target.value)} /></label>
    <div className={styles.numbers}>
      <label>Tijd (minuten)<input required inputMode="decimal" value={minutes} disabled={busy} onChange={event => setMinutes(event.target.value)} /></label>
      <label>Aantal mensen<input required type="number" min="1" max="20" step="1" value={crew} disabled={busy} onChange={event => setCrew(event.target.value)} /></label>
    </div>
    {error && <p role="alert" className={styles.error}>{error}</p>}
    <div className={styles.buttons}>
      <button type="button" disabled={busy} onClick={onClose}>Annuleren</button>
      <button type="submit" className={styles.primary} disabled={busy || !valid}>{busy ? "Opslaan…" : "Klopt & klaar"}</button>
    </div>
  </form>;
}
