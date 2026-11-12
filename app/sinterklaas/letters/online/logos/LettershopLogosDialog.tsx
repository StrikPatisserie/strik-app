"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { formatPickupDate } from "@/app/lettershop/formatPickupDate";
import { onlineItemLabel } from "../onlineOrders";
import { orderLogosPrinted, pendingLogoItems, type LogoPrintOrder } from "./model";
import styles from "./Logos.module.css";

type Props = { onClose: () => void };
type PrintJob = { id: string; orders: LogoPrintOrder[]; itemIds: string[]; pdf: string };

export default function LettershopLogosDialog({ onClose }: Props) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const sending = useRef(false);
  const pdfUrl = useRef("");
  const [orders, setOrders] = useState<LogoPrintOrder[]>([]);
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<string[]>([]);
  const [confirmedOrders, setConfirmedOrders] = useState<string[]>([]);
  const [showPrinted, setShowPrinted] = useState(false);
  const [reprintConfirmed, setReprintConfirmed] = useState(false);
  const [width, setWidth] = useState("3");
  const [height, setHeight] = useState("3");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [job, setJob] = useState<PrintJob | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.current?.showModal();
    const controller = new AbortController();
    fetch("/api/lettershop/logos", { cache: "no-store", signal: controller.signal })
      .then(async response => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "Logo’s laden is mislukt.");
        const loaded = data.orders as LogoPrintOrder[];
        setOrders(loaded);
        setPreviews(data.previews || {});

      })
      .catch(error => { if (!controller.signal.aborted) setError(error.message || "Logo’s laden is mislukt."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => { controller.abort(); if (pdfUrl.current) URL.revokeObjectURL(pdfUrl.current); opener?.focus(); };
  }, []);

  const visible = orders.filter(order => pendingLogoItems(order, showPrinted).length > 0);
  const chosen = visible.filter(order => selected.includes(order.id));
  const itemIds = chosen.flatMap(order => pendingLogoItems(order, showPrinted).map(item => item.id));
  const hasReprint = showPrinted && chosen.some(order => pendingLogoItems(order, true).length !== pendingLogoItems(order).length);
  const count = chosen.reduce((sum, order) => sum + pendingLogoItems(order, showPrinted).reduce((n, item) => n + item.quantity, 0), 0);

  function close() {
    if (sending.current) return;
    onClose();
  }
  function toggle(id: string, checked: boolean, confirmation = false) {
    const update = (values: string[]) => checked ? [...new Set([...values, id])] : values.filter(value => value !== id);
    if (confirmation) setConfirmedOrders(update);
    else setSelected(update);
  }
  async function makePrint() {
    if (sending.current || !itemIds.length || hasReprint && !reprintConfirmed) return;
    sending.current = true;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/lettershop/logos/print", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemIds, orders: chosen.map(order => ({ id: order.id, revision: order.revision })),
          widthCm: Number(width.replace(",", ".")), heightCm: Number(height.replace(",", ".")), confirmReprint: reprintConfirmed }),
      });
      if (!response.ok) { const result = await response.json(); throw new Error(result.message || "Printvel maken is mislukt."); }
      const id = response.headers.get("X-Print-Job");
      if (!id) throw new Error("De afdruk kon niet worden vastgelegd.");
      const pdf = URL.createObjectURL(await response.blob());
      if (pdfUrl.current) URL.revokeObjectURL(pdfUrl.current);
      pdfUrl.current = pdf;
      setJob({ id, orders: chosen, itemIds, pdf });
      setConfirmedOrders([]);
    } catch (error) { setError(error instanceof Error ? error.message : "Printvel maken is mislukt."); }
    finally { sending.current = false; setBusy(false); }
  }
  async function confirmPrint() {
    if (!job || !confirmedOrders.length || sending.current) return;
    sending.current = true;
    setBusy(true);
    setError("");
    try {
      const confirmedIds = job.orders.filter(order => confirmedOrders.includes(order.id))
        .flatMap(order => order.letter_order_items.filter(item => job.itemIds.includes(item.id)).map(item => item.id));
      const response = await fetch("/api/lettershop/logos/confirm", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: job.id, itemIds: confirmedIds, confirmed: true }),
      });
      if (!response.ok) { const result = await response.json(); throw new Error(result.message || "Bevestigen is mislukt."); }
      setSaved(true);
      router.refresh();
    } catch (error) { setError(error instanceof Error ? error.message : "Bevestigen is mislukt."); }
    finally { sending.current = false; setBusy(false); }
  }

  return <dialog ref={dialog} className={styles.dialog} aria-labelledby="lettershop-logo-title"
    onCancel={event => { event.preventDefault(); close(); }} onClick={event => { if (event.target === dialog.current) close(); }}>
    <header><h2 id="lettershop-logo-title">{saved ? "Logo’s geprint" : job ? "Afdruk gelukt?" : "Logo’s printen"}</h2>
      <button type="button" aria-label="Sluiten" onClick={close} disabled={busy}>×</button></header>
    <div className={styles.body}>
      {loading && <p role="status">Logo’s laden…</p>}
      {saved ? <p role="status">{confirmedOrders.length} {confirmedOrders.length === 1 ? "bestelling afgevinkt" : "bestellingen afgevinkt"} als geprint.</p> : job ? <>
        <div className={styles.pdfActions}><a className={styles.primary} href={job.pdf} target="_blank" rel="noreferrer">Open PDF om te printen</a>
          <a href={job.pdf} download="Strik-Lettershop-logos.pdf">Download PDF</a></div>
        <p className={styles.hint}>Print op 100% / werkelijke grootte. Vink daarna de bestellingen aan die echt geprint zijn.</p>
        <iframe src={job.pdf} className={styles.preview} title="Voorbeeld Lettershop-logo’s" />
        <label className={styles.selectAll}><input type="checkbox" checked={confirmedOrders.length === job.orders.length}
          onChange={event => setConfirmedOrders(event.target.checked ? job.orders.map(order => order.id) : [])} /> Alles op deze afdruk is geprint</label>
        {job.orders.map(order => <label key={order.id} className={styles.confirmOrder}>
          <input type="checkbox" checked={confirmedOrders.includes(order.id)} onChange={event => toggle(order.id, event.target.checked, true)} />
          <span><strong>{order.customer_name}</strong><small>{order.order_number} · {order.letter_order_items.filter(item => job.itemIds.includes(item.id)).reduce((n, item) => n + item.quantity, 0)} logo’s</small></span>
        </label>)}
      </> : !loading && <>
        <div className={styles.settings}><select aria-label="Welke logo’s tonen" value={showPrinted ? "all" : "pending"}
          onChange={event => { setShowPrinted(event.target.value === "all"); setSelected([]); setReprintConfirmed(false); }}>
          <option value="pending">Nog te printen</option><option value="all">Alle logo’s / herdrukken</option></select>
          <label>Breedte <input aria-label="Logobreedte in centimeter" inputMode="decimal" value={width} onChange={event => setWidth(event.target.value)} /> cm</label>
          <label>Hoogte <input aria-label="Logohoogte in centimeter" inputMode="decimal" value={height} onChange={event => setHeight(event.target.value)} /> cm</label></div>
        {!visible.length && !error && <p>Alle logo’s zijn geprint.</p>}
        {visible.length > 0 && <label className={styles.selectAll}><input type="checkbox"
          checked={visible.some(order => pendingLogoItems(order, showPrinted).every(item => item.logo_storage_path)) && visible.filter(order => pendingLogoItems(order, showPrinted).every(item => item.logo_storage_path)).every(order => selected.includes(order.id))}
          onChange={event => setSelected(event.target.checked ? visible.filter(order => pendingLogoItems(order, showPrinted).every(item => item.logo_storage_path)).map(order => order.id) : [])} /> Alles selecteren</label>}
        {visible.map(order => {
          const items = pendingLogoItems(order, showPrinted);
          const missing = items.some(item => !item.logo_storage_path);
          return <section key={order.id} className={styles.order}>
            <label className={styles.orderTitle}><input type="checkbox" disabled={missing} checked={selected.includes(order.id)} onChange={event => toggle(order.id, event.target.checked)} />
              <span><strong>{order.customer_name}</strong><small>{order.order_number} · {formatPickupDate(order.requested_date)}</small></span>
              {orderLogosPrinted(order, order.receipts) && <small className={styles.printed}>✓ Geprint</small>}</label>
            {items.map(item => <div className={styles.logoLine} key={item.id}>
              {item.logo_storage_path && previews[item.logo_storage_path] && <Image src={previews[item.logo_storage_path]} alt="" width={40} height={40} unoptimized />}
              <span>{onlineItemLabel(item)}</span>
              {!item.logo_storage_path && <strong className={styles.error}>Logo ontbreekt</strong>}
            </div>)}
          </section>;
        })}
        {hasReprint && <label className={styles.selectAll}><input type="checkbox" checked={reprintConfirmed} onChange={event => setReprintConfirmed(event.target.checked)} /> Eerder geprinte logo’s opnieuw afdrukken</label>}
      </>}
      {error && <p role="alert" className={styles.error}>{error}</p>}
    </div>
    <footer>{saved ? <button type="button" className={styles.primary} onClick={close}>Klaar</button> : job ? <>
      <button type="button" disabled={busy} onClick={() => { setJob(null); setError(""); }}>Terug</button>
      <button type="button" className={styles.primary} disabled={busy || !confirmedOrders.length} onClick={confirmPrint}>{busy ? "Opslaan…" : "Ja, echt geprint"}</button>
    </> : <><span>{count} logo’s · {chosen.length} bestellingen</span>
      <button type="button" className={styles.primary} disabled={busy || loading || !itemIds.length || hasReprint && !reprintConfirmed} onClick={makePrint}>{busy ? "Printvel maken…" : "Printvel maken"}</button></>}</footer>
  </dialog>;
}
