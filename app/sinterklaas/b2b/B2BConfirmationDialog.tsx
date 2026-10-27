"use client";

import { useEffect, useRef, useState } from "react";
import { previewB2BCustomerConfirmation, previewB2BCustomerQuotation, retryB2BConfirmation, sendB2BCustomerConfirmation, sendB2BCustomerQuotation } from "../sinterklaasApi";
import type { SinterklaasB2BOrder } from "../types";

function amountLabel(value: string) {
  if (!value) return "Volgens prijsafspraak";
  const clean = value.replace(/[^0-9,.-]/g, "");
  const number = Number(clean.includes(",") ? clean.replace(/\./g, "").replace(",", ".") : clean);
  return clean && Number.isFinite(number) ? new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(number) : value;
}
function dateLabel(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : value;
}
function sentDateLabel(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat("nl-NL", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Amsterdam" }).format(date) : value;
}

export function customerConfirmationSent(order: SinterklaasB2BOrder) {
  const mail = order.confirmationMail;
  return Boolean(mail?.version && mail.customer?.version === mail.version && mail.customer.state === "sent" && mail.customer.sentAt);
}

export function customerQuotationSent(order: SinterklaasB2BOrder) {
  const mail = order.quotationMail;
  return Boolean(mail?.version && mail.customer?.version === mail.version && mail.customer.state === "sent" && mail.customer.sentAt);
}

export function canMailQuotation(order: SinterklaasB2BOrder) {
  return !order.cancelled && !order.id.startsWith("historie-") && (order.status === "aanvraag" || order.status === "offerte");
}

export function shouldOfferCustomerConfirmation(order: SinterklaasB2BOrder, previous?: SinterklaasB2BOrder | null) {
  return order.status === "akkoord" && !order.cancelled && (previous?.status !== "akkoord" ||
    Boolean(previous.confirmationMail?.version && previous.confirmationMail.version !== order.confirmationMail?.version));
}

export default function B2BConfirmationDialog({ order, mode = "confirmation", onClose, onEdit, onUpdated }: Readonly<{
  order: SinterklaasB2BOrder;
  mode?: "confirmation" | "quotation";
  onClose: () => void;
  onEdit: (order: SinterklaasB2BOrder) => void;
  onUpdated: (order: SinterklaasB2BOrder) => void;
}>) {
  const [current, setCurrent] = useState(order);
  const [html, setHtml] = useState("");
  const [subject, setSubject] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showPreview, setShowPreview] = useState(mode === "quotation");
  const [reload, setReload] = useState(0);
  const title = useRef<HTMLHeadingElement>(null);
  const sending = useRef(false);
  const root = useRef<HTMLElement>(null);
  const quotation = mode === "quotation";
  const kind = current.status === "offerte" ? "Offerte" : "Aanvraag";
  const mail = quotation ? current.quotationMail : current.confirmationMail;
  const sent = quotation ? customerQuotationSent(current) : customerConfirmationSent(current);
  const customer = mail?.customer;
  const uncertain = customer?.version === mail?.version && customer?.state === "sending";
  const allowed = quotation ? canMailQuotation(current) : current.status === "akkoord" && !current.cancelled;
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(current.customerEmail);
  const backupSent = Boolean(current.confirmationEmailedAt && !current.confirmationEmailError);

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError(""); setHtml("");
    void (quotation ? previewB2BCustomerQuotation(order.id) : previewB2BCustomerConfirmation(order.id)).then(preview => {
      if (!cancelled) { setCurrent(preview.order); setHtml(preview.html); setSubject("subject" in preview && typeof preview.subject === "string" ? preview.subject : ""); }
    }).catch(reason => { if (!cancelled) setError(reason instanceof Error ? reason.message : "Het mailvoorbeeld kon niet worden geladen."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [order.id, reload, quotation]);

  useEffect(() => {
    const previous = document.activeElement;
    title.current?.focus();
    return () => { if (previous instanceof HTMLElement) previous.focus(); };
  }, []);

  async function send() {
    if (sending.current || loading || sent || uncertain || !validEmail || !mail?.version || !allowed || !html || error) return;
    sending.current = true; setBusy(true); setError("");
    try {
      const updated = await (quotation ? sendB2BCustomerQuotation(current.id, mail.version) : sendB2BCustomerConfirmation(current.id, mail.version));
      setCurrent(updated); onUpdated(updated);
      const updatedMail = quotation ? updated.quotationMail : updated.confirmationMail;
      if (!(quotation ? customerQuotationSent(updated) : customerConfirmationSent(updated))) setError(updatedMail?.customer?.error || "De klantmail is nog niet bevestigd. Haal de mailstatus opnieuw op; dezelfde versie wordt niet dubbel verstuurd.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Versturen is nog niet bevestigd. Haal de mailstatus opnieuw op; dezelfde versie wordt niet dubbel verstuurd."); }
    finally { sending.current = false; setBusy(false); }
  }

  async function retryBackup() {
    if (sending.current) return;
    sending.current = true; setBusy(true); setError("");
    try {
      const updated = await retryB2BConfirmation(current.id);
      setCurrent(updated); onUpdated(updated);
      if (updated.confirmationEmailError) setError(updated.confirmationEmailError);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "De back-up kon nog niet worden verstuurd."); }
    finally { sending.current = false; setBusy(false); }
  }

  return <div className="fixed inset-0 z-[90] flex items-center justify-center bg-[#15261c]/60 p-3 backdrop-blur-sm sm:p-6" onKeyDown={event => {
    if (event.key === "Escape" && !sending.current) { event.stopPropagation(); onClose(); }
    if (event.key === "Tab") {
      const items = root.current?.querySelectorAll<HTMLElement>('button:not(:disabled), summary, iframe, [tabindex="0"]');
      if (!items?.length) return;
      if (event.shiftKey && (document.activeElement === items[0] || document.activeElement === title.current)) { event.preventDefault(); items[items.length - 1].focus(); }
      else if (!event.shiftKey && document.activeElement === items[items.length - 1]) { event.preventDefault(); items[0].focus(); }
    }
  }}>
    <section ref={root} role="dialog" aria-modal="true" aria-labelledby="b2b-confirmation-title" aria-busy={busy || loading} className="flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-[1.75rem] bg-[#fffdf8] shadow-2xl">
      <header className="relative shrink-0 bg-[#244b37] px-6 pb-6 pt-6 text-white sm:px-8">
        <button type="button" aria-label="Bevestigingsvenster sluiten" disabled={busy} onClick={onClose} className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-xl disabled:opacity-40">×</button>
        <span className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#e9cc89]/40 bg-white/10 px-3 py-1 text-xs font-bold text-[#e9cc89]">{quotation ? `${kind} · nog niet definitief` : "✓ Bestelling definitief"}</span>
        <h2 ref={title} tabIndex={-1} id="b2b-confirmation-title" style={{ outline: "none" }} className="pr-5 text-2xl font-black leading-tight sm:text-3xl">{sent ? "De klant is op de hoogte" : quotation ? `${kind} mailen` : "Klant een bevestiging mailen?"}</h2>
        <p className="mt-2 text-sm leading-relaxed text-[#e4ede4]">{quotation ? sent ? "Deze versie is verstuurd. De aanvraag of offerte blijft open." : "Controleer ontvanger en mail. De bestelling blijft open." : sent ? "Deze versie van de bestelling is verstuurd. De verzendstatus blijft bij de bestelling bewaard." : "Een feestelijke bevestiging met de definitieve bestelling, prijs en afspraken. Alles duidelijk op één plek."}</p>
      </header>
      <div className={quotation ? "min-h-0 space-y-3 overflow-auto p-4 sm:p-5" : "min-h-0 space-y-5 overflow-auto p-6 sm:p-8"}>
        <div className="flex items-start gap-4 rounded-2xl border border-[#dce7dc] bg-[#f1f6ef] p-4" style={quotation ? {padding:12} : undefined}>
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-[#244b37]" style={quotation ? {width:32,height:32} : undefined} aria-hidden="true"><svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 6 9 7 9-7"/></svg></span>
          <div className="min-w-0 text-sm"><p className="text-xs font-bold uppercase tracking-wide text-[#647367]">{sent ? "Verstuurd naar" : "Ontvanger"}</p><p className="mt-1 font-black text-[#244b37]">{current.customerName}</p><p className="break-all text-[#425847]">{current.customerEmail || "Nog geen e-mailadres ingevuld"}</p></div>
        </div>
        {subject && <p className="text-sm text-[#425847]"><span className="font-bold">Onderwerp:</span> {subject}</p>}
        {!quotation && <div className="flex flex-wrap justify-between gap-3 border-y border-[#e2e8df] py-4 text-sm text-[#425847]"><div><p className="text-xs text-[#647367]">Afgesproken totaal excl. btw</p><strong className="mt-1 block text-xl text-[#244b37]">{amountLabel(current.totalExVat)}</strong></div><p className="max-w-72 self-center leading-relaxed">{current.deliveryMethod || "Levering nog af te spreken"}<br/><strong>{current.deliveryWindowType === "week" ? `Leverweek ${current.deliveryWeek}` : current.deliveryDate ? `${dateLabel(current.deliveryDate)}${current.deliveryDateEnd && current.deliveryDateEnd !== current.deliveryDate ? ` t/m ${dateLabel(current.deliveryDateEnd)}` : ""}` : "Datum nog af te spreken"}</strong></p></div>}
        {loading ? <p role="status" className="text-sm text-[#647367]">De opgeslagen bestelling en het mailvoorbeeld worden opgehaald…</p> : <>
          {!validEmail && <p className="rounded-xl bg-[#fff3df] p-3 text-sm font-bold text-[#805020]">{quotation ? "Voeg een geldig e-mailadres toe via ‘Gegevens wijzigen’ om deze aanvraag of offerte te mailen." : "De interne back-up werkt ook zonder klantadres. Voeg een e-mailadres toe via ‘Gegevens wijzigen’ om de klant te mailen."}</p>}
          {html && <div><button type="button" aria-expanded={showPreview} onClick={() => setShowPreview(!showPreview)} className="text-sm font-black text-[#244b37] underline underline-offset-4">{showPreview ? "Mailvoorbeeld sluiten ↑" : "Bekijk de klantmail ↓"}</button>{showPreview && <iframe title={quotation ? "Voorbeeld aanvraag- of offertemail" : "Voorbeeld definitieve klantbevestiging"} sandbox="" srcDoc={html} className="mt-3 h-[420px] w-full rounded-xl border border-[#dce7dc] bg-white"/>}</div>}
        </>}
        {!quotation && <div className={`rounded-xl p-3 text-sm ${backupSent ? "bg-[#f1f6ef] text-[#425847]" : "bg-[#fff3df] text-[#805020]"}`}><strong>{backupSent ? "✓ Interne back-up verstuurd" : "Interne back-up nog niet bevestigd"}</strong><p className="mt-1 text-xs leading-relaxed">{backupSent ? "De definitieve bestelling is ook naar info@strik-patisserie.nl verstuurd." : current.confirmationEmailError || "Je kunt de interne bevestiging opnieuw proberen. De klant krijgt daarbij geen mail."}</p>{!backupSent && <button type="button" disabled={busy || loading} onClick={() => void retryBackup()} className="mt-2 text-xs font-black underline disabled:opacity-40">Back-up opnieuw proberen</button>}</div>}
        {error && <p role="alert" className="rounded-xl border border-[#e8b2a3] bg-[#fff3ee] p-3 text-sm font-bold text-[#943b29]">{error}<button type="button" disabled={busy} onClick={() => setReload(value => value + 1)} className="mt-2 block underline">Gegevens en mailvoorbeeld opnieuw ophalen</button></p>}
        {uncertain && !error && <p role="alert" className="text-sm font-bold text-[#805020]">{customer?.error}</p>}
        {sent && <p role="status" className="text-sm font-bold text-[#244b37]">{quotation ? `✓ ${kind} verstuurd${customer?.sentAt ? ` op ${sentDateLabel(customer.sentAt)}` : ""}.` : "✓ Klantbevestiging verstuurd."} Opnieuw klikken verstuurt deze versie niet nogmaals.</p>}
      </div>
        <footer className={quotation ? "flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-[#e2e8df] bg-[#fffdf8] px-4 py-3" : "flex shrink-0 flex-wrap items-center justify-end gap-3 border-t border-[#e2e8df] bg-[#fffdf8] px-6 py-4 sm:px-8"}>
          {(!quotation || sent) && <button type="button" disabled={busy} onClick={onClose} className="rounded-full px-4 py-3 text-sm font-bold text-[#647367] disabled:opacity-40">{sent ? "Sluiten" : "Nu niet"}</button>}
          {!sent && <><button type="button" disabled={busy || loading} onClick={() => onEdit(current)} className="rounded-full border border-[#dce7dc] px-4 py-3 text-sm font-bold text-[#244b37] disabled:opacity-40">Gegevens wijzigen</button><button type="button" disabled={busy || loading || !html || !validEmail || Boolean(uncertain) || !allowed || Boolean(error)} onClick={() => void send()} className="rounded-full bg-[#244b37] px-5 py-3 text-sm font-black text-white shadow-sm disabled:opacity-40">{busy ? "Versturen…" : quotation ? `Mail ${kind.toLowerCase()} →` : "Ja, mail de klant →"}</button></>}
        </footer>
    </section>
  </div>;
}
