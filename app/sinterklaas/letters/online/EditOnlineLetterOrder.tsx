"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { onlineChangedTotal, onlineItemLabel, onlineOrderTotal, onlineQuantityChanges, type OnlineLetterOrder, type OnlineQuantityChange } from "./onlineOrders";
import styles from "./OnlineOrderEdit.module.css";

const money = (cents: number) => new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(cents / 100);

export default function EditOnlineLetterOrder({ order: currentOrder }: { order: OnlineLetterOrder }) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const sending = useRef(false);
  const requestId = useRef("");
  const [order, setOrder] = useState(currentOrder);
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [review, setReview] = useState<OnlineQuantityChange[] | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState("");
  useEffect(() => { if (open) dialog.current?.showModal(); }, [open]);

  function close() {
    if (sending.current) return;
    setOpen(false);
    trigger.current?.focus();
  }
  async function save() {
    if (!review || !confirmed || sending.current) return;
    sending.current = true;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/lettershop/change-order", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: order.id, revision: order.revision, requestId: requestId.current,
          confirmation: order.order_number, confirmed: true, lines: review }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Wijzigen is niet gelukt.");
      setResult(data.mailStatus === "SENT" ? "Gewijzigd · klantbevestiging verstuurd." : "Gewijzigd · klantbevestiging staat in de verzendwachtrij.");
      setOpen(false);
      trigger.current?.focus();
      router.refresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Wijzigen is niet gelukt.");
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }

  return <>
    <button ref={trigger} type="button" className={styles.edit} disabled={!!currentOrder.edit_block_reason}
      title={currentOrder.edit_block_reason || "Aantallen wijzigen · klant krijgt altijd een bevestiging"}
      aria-label={currentOrder.edit_block_reason ? `Wijzigen geblokkeerd · ${currentOrder.edit_block_reason}` : `Wijzig ${currentOrder.order_number} · klant krijgt een bevestiging`}
      onClick={() => {
        setOrder(currentOrder);
        setValues(Object.fromEntries(currentOrder.letter_order_items.map(item => [item.id, String(item.quantity)])));
        setReview(null); setConfirmed(false); setError(""); requestId.current = crypto.randomUUID(); setOpen(true);
      }}>
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="m15 5 4 4M4 20l4-1L20 7a2.8 2.8 0 0 0-4-4L4 15Z" /></svg>
    </button>
    {result && <span className={styles.result} role="status">{result}</span>}
    {open && <dialog ref={dialog} className={styles.dialog} aria-labelledby={`edit-${order.id}`} onCancel={event => { event.preventDefault(); close(); }} onClick={event => { if (event.target === event.currentTarget) close(); }}>
      <header><div><small>{order.order_number} · {order.customer_name}</small><h2 id={`edit-${order.id}`}>{review ? "Controleer de wijziging" : "Aantallen wijzigen"}</h2></div><button type="button" disabled={busy} onClick={close} aria-label="Sluiten">×</button></header>
      <form onSubmit={event => {
        event.preventDefault();
        if (review) { void save(); return; }
        try { setReview(onlineQuantityChanges(order, values)); setConfirmed(false); setError(""); }
        catch (error) { setError((error as Error).message); }
      }}>
        <div className={styles.body}>
          <p className={styles.notice}>De klant ontvangt altijd een nieuwe bevestiging op {order.customer_email}.</p>
          {review ? <>
            <ul className={styles.changes}>{review.filter(line => line.quantity !== order.letter_order_items.find(item => item.id === line.itemId)?.quantity).map(line => {
              const item = order.letter_order_items.find(item => item.id === line.itemId)!;
              return <li key={line.itemId}><span>{onlineItemLabel({ ...item, quantity: item.quantity })}</span><strong>{item.quantity} → {line.quantity}</strong></li>;
            })}</ul>
            <p className={styles.total}>Totaal incl. btw <span>{money(onlineOrderTotal(order))} → <strong>{money(onlineChangedTotal(order, review))}</strong></span></p>
            <label className={styles.check}><input type="checkbox" required checked={confirmed} disabled={busy} onChange={event => setConfirmed(event.target.checked)} />De aantallen en het totaal kloppen. Verstuur de klantbevestiging.</label>
          </> : <>
            {order.letter_order_items.map(item => <label className={styles.line} key={item.id}><span>{onlineItemLabel(item)}</span><input aria-label={`Nieuw aantal ${onlineItemLabel(item)}`} required type="number" min="0" max="100000" step="1" value={values[item.id] || ""} onChange={event => setValues(current => ({ ...current, [item.id]: event.target.value }))} /></label>)}
            <small>Vul 0 in om een letterregel te verwijderen.</small>
          </>}
          {error && <p role="alert" className={styles.error}>{error}</p>}
        </div>
        <footer><button type="button" disabled={busy} onClick={review ? () => { setReview(null); setError(""); requestId.current = crypto.randomUUID(); } : close}>{review ? "Terug" : "Annuleren"}</button><button type="submit" className={styles.primary} disabled={busy || !!review && !confirmed}>{busy ? "Opslaan…" : review ? "Opslaan & klant mailen" : "Controleer wijziging"}</button></footer>
      </form>
    </dialog>}
  </>;
}
