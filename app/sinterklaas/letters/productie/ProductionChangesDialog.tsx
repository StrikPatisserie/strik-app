"use client";

import { useEffect, useRef, useState } from "react";
import type { ProductionBatchSeed } from "./ProductionPlanningClient";
import styles from "./ProductionPlanning.module.css";

function dateLabel(value?: string) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${value}T12:00:00Z`)) : "";
}

export default function ProductionChangesDialog({ batch, saving, notice, onClose, onRevise, onSchedule }: {
  batch: ProductionBatchSeed;
  saving: boolean;
  notice: string;
  onClose: () => void;
  onRevise: () => Promise<void>;
  onSchedule: (date: string, customerIds: string[]) => Promise<void>;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [date, setDate] = useState("");
  const [confirmRevise, setConfirmRevise] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const groups = batch.checklist?.orderChanges || [];
  const extra = groups.filter(item => selected.includes(item.id)).reduce((sum, item) => sum + item.extra, 0);
  const today = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Amsterdam" }).format(new Date());
  useEffect(() => {
    const element = dialog.current;
    const previous = document.activeElement as HTMLElement | null;
    element?.showModal();
    return () => { element?.close(); previous?.focus(); };
  }, []);

  return <dialog ref={dialog} className={styles.changesDialog} aria-labelledby="letter-changes-title" onCancel={event => { event.preventDefault(); if (!saving) onClose(); }}>
    <header className={styles.changesHead}><div><h2 id="letter-changes-title">Wijzigingen per klant</h2><p>Productieronde {dateLabel(batch.startDate)}</p></div><button type="button" aria-label="Sluiten" className={styles.button} disabled={saving} onClick={onClose}>×</button></header>
    <form onSubmit={async event => { event.preventDefault(); await onSchedule(date, selected); }}>
      <div className={styles.customerChanges}>
        {groups.map(group => <section key={group.id} className={styles.customerChange}>
          <div className={styles.customerChangeHead}>
            <label>{group.extra > 0 && <input type="checkbox" disabled={saving} checked={selected.includes(group.id)} onChange={event => setSelected(current => event.target.checked ? [...current, group.id] : current.filter(id => id !== group.id))} />}<strong>{group.customerName}</strong></label>
            <span>{group.deliveryDate ? `Levering ${dateLabel(group.deliveryDate)}` : ""}</span>
          </div>
          <p className={styles.customerCode}>{group.code} {group.source === "b2b" && <a href={`/sinterklaas/b2b?q=${encodeURIComponent(group.customerName)}`} target="_blank" rel="noopener noreferrer">Bestelling bekijken ↗</a>}</p>
          <ul>{group.items.map((item, index) => <li key={`${item.key}-${index}`}><span>{item.label}</span><span>{item.before} → {item.after} <b className={item.after < item.before ? styles.surplus : undefined}>{item.after === item.before ? "Gewijzigd" : `${item.after > item.before ? "+" : ""}${item.after - item.before}`}</b></span></li>)}</ul>
        </section>)}
        {!groups.length && <ul className={styles.changeList}>{batch.checklist?.changes.map(change => <li key={change.key}><strong>{change.label}</strong><span>{change.before} → {change.after} · {change.detail}</span></li>)}</ul>}
      </div>
      {groups.some(group => group.extra > 0) && <section className={styles.scheduleSupplement}><h3>Aanvullende productie inplannen</h3><p>Kies klanten hierboven en een productiedag.</p><div><label>Productiedag<input type="date" required min={today} max={`${batch.startDate.slice(0, 4)}-12-31`} value={date} disabled={saving} onChange={event => setDate(event.target.value)} /></label><button type="submit" className={styles.primary} disabled={saving || !extra || !date}>{saving ? "Opslaan…" : `${extra} extra letters inplannen`}</button></div></section>}
      {notice && <p role="alert" className={styles.error}>{notice}</p>}
    </form>
    <details className={styles.reviseOption}><summary>Oorspronkelijke lijsten bijwerken</summary><p>Dit verwerkt ook verlagingen en vervallen bestellingen. Gemaakte aantallen blijven bewaard. Print daarna de gewijzigde lijsten opnieuw.</p><label><input type="checkbox" checked={confirmRevise} disabled={saving} onChange={event => setConfirmRevise(event.target.checked)} />Ik wil de bestaande lijsten vervangen.</label><button type="button" className={styles.button} disabled={saving || !confirmRevise} onClick={() => void onRevise()}>Bijgewerkte lijsten overnemen</button></details>
  </dialog>;
}
