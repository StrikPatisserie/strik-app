"use client";

import { useEffect, useId, useRef } from "react";
import { productionValueLabel, productionVariant } from "./productionPresentation";
import { productionRecipientsFor, PRODUCTION_SOURCES, type ProductionSeedRow, type ProductionSource } from "./productionSources";
import styles from "./ProductionPlanning.module.css";

const shops: Record<string, string> = { ziekerstraat: "Ziekerstraat", heyendaal: "Heyendaal", daalseweg: "Daalseweg", lent: "Lent" };

function recipientDate(value?: string) {
  if (!value) return "";
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "short", timeZone: "UTC" }).format(date);
}

export default function ProductionRecipientsDialog({ row, source, onClose }: Readonly<{
  row: ProductionSeedRow;
  source: ProductionSource;
  onClose: () => void;
}>) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const variant = productionVariant(row.label);
  const recipients = productionRecipientsFor(row, source);
  const quantity = recipients.reduce((sum, item) => sum + item.quantity, 0);
  const label = PRODUCTION_SOURCES.find(item => item.id === source)?.label;

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const trigger = document.activeElement;
    dialog.showModal();
    return () => {
      dialog.close();
      if (trigger instanceof HTMLElement) trigger.focus({ preventScroll: true });
    };
  }, []);

  return <dialog ref={ref} className={styles.recipientDialog} aria-labelledby={titleId}
    onCancel={event => { event.preventDefault(); onClose(); }}
    onClick={event => {
      if (event.target !== event.currentTarget) return;
      const bounds = event.currentTarget.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose();
    }}>
    <header className={styles.recipientHeader}>
      <div>
        <span className={styles.sourceBadge} data-source={source}>{label}</span>
        <h2 id={titleId}>{variant.letter} · {productionValueLabel(variant.chocolate)} · {productionValueLabel(variant.size)}</h2>
        <p>{[productionValueLabel(variant.style), ...variant.extras].join(" · ")}</p>
      </div>
      <button type="button" className={styles.recipientClose} onClick={onClose} aria-label="Klanten sluiten" autoFocus>
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
      </button>
    </header>
    <ul className={styles.recipientList} aria-label="Klanten en aantallen">
      {recipients.map((item, index) => {
        const details = [item.code && !item.code.startsWith("b2b-") ? item.code : "", item.shop ? shops[item.shop] || item.shop : "", recipientDate(item.date)].filter(Boolean).join(" · ");
        return <li key={`${item.id}-${index}`} data-unresolved={item.unresolved || undefined}>
          <div>
            <strong>{item.unresolved && "! "}{item.customerName}</strong>
            {details && <small>{details}</small>}
            {item.combinationProduct && <small className={styles.recipientCombination}>Combinatie · {item.combinationProduct}</small>}
            {item.notes && <p>{item.notes}</p>}
          </div>
          <b className={styles.recipientQuantity}>{item.quantity}×</b>
        </li>;
      })}
    </ul>
    <footer className={styles.recipientFooter}><span>Totaal</span><strong>{quantity} {quantity === 1 ? "letter" : "letters"}</strong></footer>
  </dialog>;
}
