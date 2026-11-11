"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import OperationalDialog from "../../productie/OperationalDialog";
import { createOrderPrint, type OrderPrintData, type OrderPrintOptions } from "./orderPrint";
import s from "./OrderPrint.module.css";

export default function OrderPrintMenu({ data }: { data: OrderPrintData }) {
  const [open, setOpen] = useState(false);
  return <>
    <button type="button" className={s.icon} title="Bestelling printen" aria-label={`Print bestelling ${data.customer}`} onClick={() => setOpen(true)}>
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M6 9V3h12v6M6 17H3V9h18v8h-3M6 14h12v7H6zM17 11h1"/></svg>
    </button>
    {open && createPortal(<PrintDialog data={data} onClose={() => setOpen(false)}/>, document.body)}
  </>;
}
function PrintDialog({ data, onClose }: { data: OrderPrintData; onClose: () => void }) {
  const [format, setFormat] = useState<OrderPrintOptions["format"]>("a4");
  const [copies, setCopies] = useState("1");
  const [products, setProducts] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [url, setUrl] = useState("");
  const printOnLoad = useRef(false);
  const frame = useRef<HTMLIFrameElement>(null);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  function changed() { setUrl(""); setError(""); }
  async function generate(print: boolean) {
    setBusy(true); setError("");
    try {
      const blob = await createOrderPrint(data, { format, copies: Number(copies), products });
      printOnLoad.current = print;
      setUrl(URL.createObjectURL(blob));
    } catch (error) { setError(error instanceof Error ? error.message : "Printvel maken is mislukt."); }
    finally { setBusy(false); }
  }
  function print() {
    try { frame.current?.contentWindow?.focus(); frame.current?.contentWindow?.print(); }
    catch { if (url) window.open(url, "_blank", "noopener"); }
  }
  const filename = `${data.customer.replace(/[^\p{L}\p{N} -]/gu, "").slice(0, 80)}-${format}.pdf`;
  return <OperationalDialog className={s.dialog} labelledBy="order-print-title" busy={busy} onClose={onClose} closeOnBackdrop>
    <header><h2 id="order-print-title">{data.customer}</h2><button type="button" className={s.icon} disabled={busy} aria-label="Printvenster sluiten" onClick={onClose}>×</button></header>
    <div className={s.form}>
      <label>Afdruk<select value={format} disabled={busy} onChange={event => { changed(); setFormat(event.target.value as OrderPrintOptions["format"]); }}><option value="a4">A4-verdeelvel</option><option value="zebra">Zebra-etiket · 76 × 51 mm</option></select></label>
      <label>Exemplaren<input type="number" min="1" max="100" step="1" value={copies} disabled={busy} onChange={event => { changed(); setCopies(event.target.value); }}/></label>
      {format === "zebra" && <label className={s.check}><input type="checkbox" checked={products} disabled={busy} onChange={event => { changed(); setProducts(event.target.checked); }}/>Productregels tonen</label>}
    </div>
    <p className={s.hint}>{format === "zebra" ? "Papier 76 × 51 mm · werkelijke grootte / 100% · printer op 1 exemplaar." : "A4 · werkelijke grootte / 100% · printer op 1 exemplaar. Het PDF bevat alle gekozen exemplaren."}</p>
    {error && <p role="alert" className={s.error}>{error}</p>}
    <footer><button type="button" disabled={busy} onClick={() => url ? print() : void generate(true)}>{busy ? "Voorbereiden…" : "Afdrukken"}</button>{url ? <a href={url} download={filename}>PDF downloaden</a> : <button type="button" disabled={busy} onClick={() => void generate(false)}>PDF maken</button>}</footer>
    {url && <iframe ref={frame} className={s.preview} title="Afdrukvoorbeeld bestelling" src={url} onLoad={() => { if (printOnLoad.current) { printOnLoad.current = false; print(); } }}/>}
  </OperationalDialog>;
}
