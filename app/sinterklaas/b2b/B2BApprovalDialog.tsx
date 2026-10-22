"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { fetchB2BOrders } from "../sinterklaasApi";
import type { SinterklaasB2BOrder } from "../types";
import { businessSeasonColors, seasonLabel } from "../../lib/businessSeasons";
import B2BLetterLineBadges from "../B2BLetterLineBadges";
import B2BProductText from "./B2BProductText";
import styles from "./B2BOrders.module.css";

function date(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : value;
}

export default function B2BApprovalDialog({ order, productText, totalLabel, onClose, onEdit, onApprove }: Readonly<{
  order: SinterklaasB2BOrder;
  productText: (order: SinterklaasB2BOrder) => string;
  totalLabel: (order: SinterklaasB2BOrder) => string;
  onClose: () => void;
  onEdit: (order: SinterklaasB2BOrder) => void;
  onApprove: (order: SinterklaasB2BOrder) => Promise<void>;
}>) {
  const dialog = useRef<HTMLDialogElement>(null);
  const submitting = useRef(false);
  const [current, setCurrent] = useState(order);
  const [loading, setLoading] = useState(true);
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const theme = businessSeasonColors[current.season === "kerst" ? "kerst" : "sint"];
  const valid = !current.cancelled && (current.status === "aanvraag" || current.status === "offerte") && Boolean(current.deliveryDate && current.orderText.trim()) && (current.department === "bakkerij" || current.letterLines.length > 0);

  useEffect(() => {
    const element = dialog.current;
    const overflow = document.documentElement.style.overflow;
    element?.showModal();
    document.documentElement.style.overflow = "hidden";
    return () => { element?.close(); document.documentElement.style.overflow = overflow; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void fetchB2BOrders(order.year, order.customerName).then(orders => {
      if (cancelled) return;
      const latest = orders.find(item => item.id === order.id);
      if (!latest) throw new Error("Deze bestelling is niet meer gevonden. Sluit dit venster en ververs het overzicht.");
      setCurrent(latest);
      setLoading(false);
    }).catch(reason => { if (!cancelled) setError(reason instanceof Error ? reason.message : "De actuele bestelling kon niet worden geladen. Sluit dit venster en probeer opnieuw."); });
    return () => { cancelled = true; };
  }, [order.id, order.year, order.customerName]);

  async function approve() {
    if (submitting.current || loading || !checked || !valid) return;
    submitting.current = true; setBusy(true); setError("");
    try { await onApprove(current); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Goedkeuren is niet bevestigd. Probeer opnieuw."); }
    finally { submitting.current = false; setBusy(false); }
  }

  return <dialog ref={dialog} className={`${styles.page} ${styles.approvalDialog}`} style={{ "--b2b-accent": theme.accent, "--b2b-pale": theme.pale } as CSSProperties} aria-labelledby="b2b-approval-title" aria-busy={loading || busy} onCancel={event => { event.preventDefault(); if (!submitting.current) onClose(); }}>
    <header className={styles.approvalHeader}><p className={styles.eyebrow}>{seasonLabel(current.season)} · laatste controle</p><h2 id="b2b-approval-title">Aanvraag goedkeuren?</h2><p>Controleer de bestelling voordat je deze definitief maakt.</p><button type="button" aria-label="Goedkeuren sluiten" disabled={busy} onClick={onClose}>×</button></header>
    <div className={styles.approvalBody}>
      {loading && !error ? <p role="status">De actuele bestelling wordt opgehaald…</p> : <>
        <div className={styles.approvalCustomer}><h3>{current.customerName}</h3><p>{current.contactName}</p><p>{current.customerEmail}</p></div>
        <section className={styles.approvalProducts} aria-label="Bestelling ter controle"><h3>Producten</h3>{current.letterLines.length > 0 && <B2BLetterLineBadges lines={current.letterLines} />}<B2BProductText text={productText(current)} /></section>
        <dl className={styles.approvalDetails}><div><dt>Levering</dt><dd>{current.deliveryWindowType === "week" ? `Leverweek ${current.deliveryWeek}` : `${date(current.deliveryDate)}${current.deliveryDateEnd ? ` t/m ${date(current.deliveryDateEnd)}` : ""}`}<br />{current.deliveryMethod}{current.deliveryAddress && <><br />{current.deliveryAddress}</>}</dd></div><div><dt>Totaal excl. btw</dt><dd><strong>{current.totalExVat.trim() ? totalLabel(current) : "Nog af te spreken"}</strong></dd></div></dl>
        {[["Prijsafspraak", current.priceAgreement], ["Logo", current.logo], ["Verpakking", current.packaging], ["Tekst", current.textInstructions], ["Opmerkingen", current.importantNotes]].filter(([, value]) => value).map(([label, value]) => <p key={label} className={styles.approvalNote}><strong>{label}</strong><br />{value}</p>)}
        {!valid && <p role="alert" className={styles.error}>{current.status === "akkoord" ? "Deze bestelling is intussen al definitief." : "Controleer eerst de leverdatum, afdeling en bestelregels via Bestelling wijzigen."}</p>}
        <label className={styles.approvalCheck}><input type="checkbox" checked={checked} disabled={loading || busy || !valid} onChange={event => setChecked(event.target.checked)} />Ik heb producten, prijs en levering gecontroleerd.</label>
        <p className={styles.approvalMailNote}>Na goedkeuren krijg je de keuze om de klant een definitieve bevestiging te mailen. De interne back-up gaat automatisch naar info@strik-patisserie.nl.</p>
      </>}
      {error && <p role="alert" className={styles.error}>{error}</p>}
    </div>
    <footer className={styles.approvalActions}><button type="button" className={styles.quiet} disabled={busy} onClick={onClose}>Annuleren</button><button type="button" className={styles.button} disabled={loading || busy} onClick={() => onEdit(current)}>Bestelling wijzigen</button><button type="button" className={styles.primary} disabled={loading || busy || !checked || !valid} onClick={() => void approve()}>{busy ? "Goedkeuren…" : "Ja, maak definitief"}</button></footer>
  </dialog>;
}
