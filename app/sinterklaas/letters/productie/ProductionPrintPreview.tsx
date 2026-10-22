"use client";

import { createPortal } from "react-dom";
import type { ProductionBatchSeed } from "./ProductionPlanningClient";
import { productionRemaining, productionTotals } from "./productionChecklist";
import { productionRowIsComplete, productionSections, productionVariant } from "./productionPresentation";
import styles from "./ProductionPrint.module.css";

function printDate(value: string) {
  return new Intl.DateTimeFormat("nl-NL", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Amsterdam" }).format(new Date(`${value}T12:00:00Z`));
}

function printDeadline(value?: string) {
  if (!value) return "de besteldeadline";
  return new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Amsterdam" }).format(new Date(value));
}

function printQuantity(quantity: number) {
  return `${quantity} ${quantity === 1 ? "stuk" : "stuks"}`;
}

export function ProductionPrintSheet({ batch }: Readonly<{ batch: ProductionBatchSeed }>) {
  const totals = productionTotals(batch.rows);
  const planned = totals.orders + totals.stock;
  const date = printDate(batch.startDate);

  return <article className={styles.sheet} aria-label="Productielijst voor zwart-wit afdrukken">
    <header className={styles.header}>
      <div className={styles.titleRow}>
        <div>
          <p className={styles.brand}>Strik Patisserie / Bakkerij</p>
          <h2>Productielijst chocoladeletters</h2>
          <p className={styles.date}>{date}</p>
        </div>
        <span className={styles.version} data-provisional={!batch.checklist}>{batch.checklist ? <>Vastgezet<strong>Versie {batch.checklist.planRevision}</strong></> : <>Voorlopig<strong>Nog wijzigbaar</strong></>}</span>
      </div>
      <div className={styles.summary}>
        <dl>
          <div><dt>Totaal</dt><dd>{planned}</dd></div>
          <div><dt>Gemaakt</dt><dd>{totals.produced}</dd></div>
          <div className={styles.openTotal}><dt>Nog te maken</dt><dd>{productionRemaining(batch.rows)}</dd></div>
        </dl>
        <p>{batch.checklist ? `Vastgezet: ${printDeadline(batch.checklist.lockedAt)}` : `Voorlopig: aantallen kunnen wijzigen tot ${printDeadline(batch.deadlineAt)}.`}</p>
      </div>
      {!!batch.checklist?.changes.length && <p className={styles.warning}><strong>LET OP</strong> {batch.checklist.changes.length} wijziging(en) nog niet overgenomen. Controleer deze eerst in de app.</p>}
      <div className={styles.writeFields}>
        <p>Bakker <span /></p><p>Datum / tijd gereed <span /></p>
      </div>
    </header>

    <div className={styles.groups}>
      {productionSections(batch.rows).flatMap(section => section.groups.map(group => <table key={`${section.key}-${group.key}`} className={styles.table}>
        <caption>{section.label} / {group.label}</caption>
        <colgroup><col className={styles.letterCol} /><col className={styles.quantityCol} /><col className={styles.quantityCol} /><col className={styles.totalCol} /><col className={styles.doneCol} /><col /></colgroup>
        <thead>
          <tr className={styles.groupHeading}><th scope="colgroup" colSpan={6}><div><h3><span>{section.label}</span> {group.label}</h3><span>{printQuantity(group.rows.reduce((sum, row) => sum + row.orders + row.stock, 0))}</span></div></th></tr>
          <tr className={styles.columns}><th scope="col">Letter</th><th scope="col">Besteld</th><th scope="col">Winkel<span>voorraad</span></th><th scope="col">Totaal</th><th scope="col">Gereed</th><th scope="col">Bijzonderheden / notities</th></tr>
        </thead>
        <tbody>{group.rows.map(row => {
          const total = row.orders + row.stock;
          const variant = productionVariant(row.label);
          const complete = productionRowIsComplete(row);
          return <tr key={row.key} className={styles.row} data-special={variant.extras.length > 0}>
            <th scope="row" className={styles.letter}>{variant.letter}</th>
            <td className={styles.quantity}>{row.orders}</td>
            <td className={styles.quantity}>{row.stock}</td>
            <td className={styles.total}>{total}</td>
            <td className={styles.done}>
              {total > 0 ? <span className={styles.checkBox} aria-label={complete ? "Gereed" : "Nog af te vinken"}>{complete ? "✓" : ""}</span> : <span>-</span>}
              {row.produced > 0 && <small>{row.produced}/{total} gemaakt</small>}
            </td>
            <td className={styles.notes}>
              {variant.extras.length > 0 && <div className={styles.extras}><span className={styles.attention} aria-label="Let op">!</span><strong>{variant.extras.join(" · ")}</strong></div>}
              {total === 0 && row.produced > 0 && <strong className={styles.cancelled}>Vervallen bestelling · {row.produced} al gemaakt</strong>}
              <span className={styles.writingLine} aria-hidden="true" />
            </td>
          </tr>;
        })}</tbody>
      </table>))}
      {batch.rows.length === 0 && <p className={styles.empty}>Geen letters op deze productielijst.</p>}
    </div>
    <footer className={styles.footer}><p><strong>Afwerken:</strong> controleer smaak, formaat en bijzonderheden. Vink pas af wanneer de letters gemaakt zijn.</p><p>Werk de voortgang daarna bij in de app. Printen verandert de productievoortgang niet.</p></footer>
  </article>;
}

export default function ProductionPrintPreviewDialog({ batch, onClose }: Readonly<{ batch: ProductionBatchSeed; onClose: () => void }>) {
  return createPortal(<div className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="production-print-title">
    <div className={styles.toolbar}>
      <div><h2 id="production-print-title">Productielijst / printvoorbeeld</h2><p>A4 · zwart-wit · printen verandert de voortgang niet</p></div>
      <div className={styles.actions}><button type="button" onClick={onClose}>Sluiten</button><button type="button" onClick={() => window.print()} className={styles.printButton}>Print productielijst</button></div>
    </div>
    <div className={styles.paperViewport}><ProductionPrintSheet batch={batch} /></div>
  </div>, document.body);
}
