"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { businessSeasonColors, seasonLabel, type BusinessSeason } from "../../lib/businessSeasons";
import { productionTotalDate, productionTotalsText, type ProductionTotal, type ProductionTotals } from "./productionTotals";
import { bakeItDemandVersion, bakeItProgress, type BakeItRegistration } from "./bakeItRegistrations";
import { useBakeItRegistrations } from "./useBakeItRegistrations";
import styles from "./B2BOrders.module.css";

export default function B2BProductionTotals({ totals, season, year, loading = false, preview = false, onRefresh, onClose }: {
  totals: ProductionTotals; season: BusinessSeason; year: string; loading?: boolean; preview?: boolean; onRefresh?: () => void; onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [copied, setCopied] = useState(false), [fallback, setFallback] = useState(false);
  const registrations = useBakeItRegistrations(season, year, totals, preview);
  const [editor, setEditor] = useState<{ group: ProductionTotal; row?: BakeItRegistration; operationId: string; demandVersion: string; revision: number } | null>(null);
  const [quantity, setQuantity] = useState(""), [date, setDate] = useState("");
  const [saving, setSaving] = useState(false), [saveError, setSaveError] = useState(""), [removeConfirm, setRemoveConfirm] = useState(false);
  const colors = businessSeasonColors[season];
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  useEffect(() => { setCopied(false); }, [totals, registrations.state.revision]);
  function edit(group: ProductionTotal, row?: BakeItRegistration) {
    setEditor({ group, row, operationId: crypto.randomUUID(), demandVersion: bakeItDemandVersion(group), revision: registrations.state.revision });
    setQuantity(String(row?.quantity || bakeItProgress(group, registrations.state).remaining));
    setDate(row?.date || new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Europe/Amsterdam" }).format(new Date()));
    setSaveError(""); setRemoveConfirm(false);
  }
  async function save(remove = false, values?: { quantity: number; date: string }) {
    if (!editor || saving) return;
    setSaving(true); setSaveError("");
    try {
      await registrations.save({ operationId: editor.operationId, registrationId: editor.row?.id, productKey: editor.group.key, quantity: values?.quantity ?? Number(quantity), date: values?.date ?? date, remove, demandVersion: editor.demandVersion }, editor.revision);
      setEditor(null); onRefresh?.();
    } catch (e) { setSaveError(e instanceof Error ? e.message : "Registreren is mislukt."); onRefresh?.(); }
    finally { setSaving(false); }
  }
  const copyText = productionTotalsText(totals) + (registrations.ready ? "\n\nBake-it:\n" + totals.products.map(group => {
    const progress = bakeItProgress(group, registrations.state);
    return [`${group.product}: ${progress.planned} ingepland · ${progress.remaining} nog toevoegen`, ...progress.registrations.map(row => `  ${row.quantity} ${row.unit} ingepland op ${productionTotalDate({ date: row.date, end: "" })}`)].join("\n");
  }).join("\n\n") : "");
  async function copy() {
    try { await navigator.clipboard.writeText(copyText); setCopied(true); }
    catch { setFallback(true); }
  }
  return <dialog ref={dialog} className={`${styles.page} ${styles.productionTotalsDialog}`} style={{ "--b2b-accent": colors.accent, "--b2b-pale": colors.pale } as CSSProperties} aria-labelledby="production-totals-title" onCancel={event => { event.preventDefault(); if (!saving) onClose(); }} onClick={event => { if (!saving && event.target === event.currentTarget) onClose(); }}>
    <header className={styles.productionTotalsHeader}><div><h2 id="production-totals-title">Productie opteller</h2><p>{seasonLabel(season)} {year} · definitief, nog te maken</p></div><button type="button" className={styles.quiet} aria-label="Productie opteller sluiten" disabled={saving} onClick={onClose}>×</button></header>
    <div className={styles.productionTotalsBody}>
      {loading ? <p role="status" className={styles.empty}>Bestellingen laden…</p> : <>
        {preview && <p className={styles.productionTotalsNote}>Proefregistraties · alleen opgeslagen op dit apparaat.</p>}
        {registrations.error && <p className={styles.bakeItError} role="alert">{registrations.error} <button type="button" onClick={() => void registrations.refresh()}>Opnieuw laden</button></p>}
        {!registrations.ready && !registrations.error && <p role="status" className={styles.productionTotalsNote}>Bake-it-registraties laden…</p>}
        {totals.products.map((group, index) => {
          const progress = bakeItProgress(group, registrations.state);
          return <details key={group.key} className={styles.productionTotal} open={index === 0}>
            <summary><span>{group.product}{registrations.ready && <small className={styles.bakeItProgress}>{progress.planned} in Bake-it <b data-pending={progress.remaining > 0}>{progress.remaining ? `${progress.remaining} nog toevoegen` : "Alles ingepland"}</b></small>}</span><strong>{group.quantity} <small>{group.unit}</small></strong><span aria-hidden="true">⌄</span></summary>
            <ul>{group.allocations.map(item => <li key={item.orderId}><strong>{item.quantity}×</strong><span>{productionTotalDate(item)}</span><span>{item.customer}</span></li>)}</ul>
            <div className={styles.bakeItRecords}>
              {progress.registrations.map(row => <div key={row.id} className={styles.bakeItRecord}><span><strong>{row.quantity} {row.unit}</strong> ingepland in Bake-it op {productionTotalDate({ date: row.date, end: "" })}{(progress.rowPlanned.get(row.id) || 0) < row.quantity && <small> · {progress.rowPlanned.get(row.id) || 0} voor open orders</small>}</span><button type="button" disabled={saving || !registrations.ready || !!registrations.error} onClick={() => edit(group, row)} aria-label={`Bake-it-registratie van ${row.quantity} ${group.product} wijzigen`}>Wijzig</button></div>)}
              {progress.remaining > 0 && <button type="button" className={styles.bakeItAdd} disabled={saving || !registrations.ready || !!registrations.error} onClick={() => edit(group)}>+ In Bake-it gezet</button>}
              {editor?.group.key === group.key && <form className={styles.bakeItForm} onSubmit={event => { event.preventDefault(); const fields = new FormData(event.currentTarget); void save(false, { quantity: Number(fields.get("quantity")), date: String(fields.get("productionDate") || "") }); }}>
                <p>{editor.row ? "Bake-it-registratie wijzigen" : "Al in Bake-it ingevoerd? Registreer voor de eerstvolgende bestellingen."}</p>
                <div><label>Aantal<input name="quantity" type="number" min="1" max="1000000" step="1" required value={quantity} disabled={saving} onChange={event => setQuantity(event.target.value)} /></label><label>Productiedatum<input key={editor.operationId} name="productionDate" type="date" required defaultValue={date} disabled={saving} /></label><button type="submit" disabled={saving || !registrations.ready || !!registrations.error}>{saving ? "Opslaan…" : "Registreren"}</button><button type="button" disabled={saving} onClick={() => setEditor(null)}>Annuleer</button></div>
                {editor.row && <button type="button" className={styles.bakeItRemove} disabled={saving} onClick={() => setRemoveConfirm(true)}>Registratie verwijderen</button>}
                {removeConfirm && <p>Deze registratie verwijderen? <button type="button" disabled={saving} onClick={() => void save(true)}>Ja, verwijderen</button> <button type="button" disabled={saving} onClick={() => setRemoveConfirm(false)}>Behouden</button></p>}
                {saveError && <p className={styles.bakeItError} role="alert">{saveError}</p>}
              </form>}
            </div>
          </details>;
        })}
        {!totals.products.length && <p className={styles.empty}>Geen producten om op te tellen.</p>}
        {totals.issues.length > 0 && <details className={styles.productionTotalsIssues}><summary>{totals.issues.length} {totals.issues.length === 1 ? "bestelling" : "bestellingen"} nog controleren</summary>{totals.issues.map(issue => <p key={issue.orderId}><strong>{issue.customer}</strong> · {issue.message}</p>)}</details>}
        {totals.skippedLetters > 0 && <p className={styles.productionTotalsNote}>Losse chocoladeletters blijven in de letterplanning.</p>}
        {fallback && <textarea aria-label="Producttotalen kopiëren" readOnly rows={6} value={copyText} onFocus={event => event.target.select()} />}
      </>}
    </div>
    <footer className={styles.productionTotalsFooter}><span>{totals.orderCount} definitieve bestellingen</span><button type="button" className={styles.button} disabled={loading || !totals.products.length || !registrations.ready || !!registrations.error} onClick={() => void copy()}>{copied ? "Gekopieerd" : "Kopieer lijst"}</button></footer>
  </dialog>;
}
