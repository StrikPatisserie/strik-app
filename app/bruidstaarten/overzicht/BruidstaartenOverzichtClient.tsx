"use client";

/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import StrikBackButton from "../../StrikBackButton";
import { strikIcons } from "../../StrikUI";
import { cakeSizes } from "../../bruidstaart-studio/data";
import {
  calculateWeddingCakePrice,
  findOption,
  formatEuro,
  getDeliveryMethodLabel,
  getDeliveryTimeLabel,
} from "../../bruidstaart-studio/pricing";
import {
  getWeddingCakeStudioUrl,
  getWeddingCakeYearOverviewUrl,
  normalizeDraft,
  normalizeDraftList,
  saveLocalDraft,
  searchLocalDraftsByYear,
  type WeddingCakeDraft,
} from "../../bruidstaart-studio/studioApi";

const monthFormatter = new Intl.DateTimeFormat("nl-NL", {
  month: "long",
  year: "numeric",
});
const dateFormatter = new Intl.DateTimeFormat("nl-NL", {
  day: "2-digit",
  month: "short",
});
const weekdayFormatter = new Intl.DateTimeFormat("nl-NL", {
  weekday: "long",
});
const updatedFormatter = new Intl.DateTimeFormat("nl-NL", {
  day: "2-digit",
  month: "2-digit",
  year: "2-digit",
});

function dateFrom(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function deliveryDateFor(draft: WeddingCakeDraft) {
  return draft.config.contact.deliveryDate || draft.config.contact.weddingDate;
}

function isPaid(draft: WeddingCakeDraft) {
  return Boolean(
    draft.config.paid ||
      draft.config.paidInStoreAt ||
      draft.config.paymentRequestPaidAt,
  );
}

function isUrgentUnpaid(draft: WeddingCakeDraft) {
  if (isPaid(draft)) return false;
  const deliveryDate = dateFrom(deliveryDateFor(draft));
  if (!deliveryDate) return false;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const difference = deliveryDate.getTime() - today.getTime();
  return difference >= 0 && difference <= 7 * 24 * 60 * 60 * 1000;
}

function mergeDrafts(...groups: WeddingCakeDraft[][]) {
  const drafts = new Map<string, WeddingCakeDraft>();
  groups.flat().forEach((draft) => {
    const key = draft.code.toLowerCase();
    const current = drafts.get(key);
    if (!current || draft.updatedAt >= current.updatedAt) drafts.set(key, draft);
  });
  return [...drafts.values()];
}

function cakeDescription(draft: WeddingCakeDraft) {
  const size = findOption(cakeSizes, draft.config.sizeId);
  if (draft.config.sizeId === "custom") {
    return `${draft.config.customCakePersons || "?"} personen · maatwerk`;
  }
  return size
    ? `${size.tiers} ${size.tiers === 1 ? "laag" : "lagen"} · ${size.personsLabel}`
    : "Formaat niet ingevuld";
}

function paymentLabel(draft: WeddingCakeDraft) {
  if (isPaid(draft)) return "Betaald";
  return draft.config.paymentRequestEmailedAt
    ? "Niet betaald · verzoek verstuurd"
    : "Nog te betalen";
}

function updatedLabel(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "recent" : updatedFormatter.format(date);
}

export default function BruidstaartenOverzichtClient() {
  const today = useMemo(() => new Date(), []);
  const [visibleMonth, setVisibleMonth] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1),
  );
  const [drafts, setDrafts] = useState<WeddingCakeDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [selectedDraft, setSelectedDraft] = useState<WeddingCakeDraft | null>(null);
  const [dialogMode, setDialogMode] = useState<"choice" | "details" | "cake">("choice");
  const [editDraft, setEditDraft] = useState<WeddingCakeDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [reminderDraft, setReminderDraft] = useState<WeddingCakeDraft | null>(null);
  const [reminderSending, setReminderSending] = useState(false);
  const year = String(visibleMonth.getFullYear());

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setStatus("");

    async function load() {
      const local = searchLocalDraftsByYear(year);
      try {
        const response = await fetch(getWeddingCakeYearOverviewUrl(year), {
          cache: "no-store",
        });
        if (!response.ok) throw new Error("overzicht niet beschikbaar");
        const remote = normalizeDraftList(await response.json());
        if (!cancelled) {
          setDrafts(mergeDrafts(remote, local).filter((draft) => draft.config.completed));
        }
      } catch {
        if (!cancelled) {
          setDrafts(local.filter((draft) => draft.config.completed));
          setStatus(
            local.length
              ? "WordPress was niet bereikbaar; je ziet de lokaal opgeslagen bestellingen."
              : "Het overzicht kon niet worden geladen. Probeer het zo nog eens.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [year]);

  const monthDrafts = useMemo(
    () =>
      drafts
        .filter((draft) => {
          const date = dateFrom(deliveryDateFor(draft));
          return (
            date?.getFullYear() === visibleMonth.getFullYear() &&
            date.getMonth() === visibleMonth.getMonth()
          );
        })
        .sort((left, right) =>
          deliveryDateFor(left).localeCompare(deliveryDateFor(right)),
        ),
    [drafts, visibleMonth],
  );
  const paidCount = monthDrafts.filter(isPaid).length;
  const deliveryCount = monthDrafts.filter(
    (draft) => draft.config.contact.deliveryMethod !== "pickup",
  ).length;
  const urgentCount = monthDrafts.filter(isUrgentUnpaid).length;

  function changeMonth(offset: number) {
    setVisibleMonth(
      (current) => new Date(current.getFullYear(), current.getMonth() + offset, 1),
    );
  }

  function openDraft(draft: WeddingCakeDraft) {
    setSelectedDraft(draft);
    setEditDraft(draft);
    setDialogMode("choice");
    setStatus("");
  }

  function closeDraft() {
    setSelectedDraft(null);
    setEditDraft(null);
    setDialogMode("choice");
  }

  function updateContact(field: keyof WeddingCakeDraft["config"]["contact"], value: string) {
    setEditDraft((current) =>
      current
        ? {
            ...current,
            config: {
              ...current.config,
              contact: { ...current.config.contact, [field]: value },
            },
          }
        : current,
    );
  }

  async function saveDetails() {
    if (!editDraft) return;
    setSaving(true);
    setStatus("");
    try {
      const response = await fetch(getWeddingCakeStudioUrl(), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editDraft),
      });
      if (!response.ok) throw new Error("Opslaan in WordPress is mislukt.");
      const saved = normalizeDraft(await response.json()) || editDraft;
      saveLocalDraft(saved);
      setDrafts((current) => mergeDrafts(current, [saved]));
      setStatus(`Gegevens van ${saved.code} zijn opgeslagen.`);
      closeDraft();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Opslaan is mislukt.");
    } finally {
      setSaving(false);
    }
  }

  async function sendReminder() {
    if (!reminderDraft) return;
    const config = reminderDraft.config;
    const recipientEmail = config.paymentRequestEmail || config.contact.email;
    const paymentLinkId = config.paymentRequestLinkId || "";
    if (!recipientEmail || !paymentLinkId) {
      setStatus(
        "Er is nog geen eerder betaalverzoek met betaallink gevonden. Open de taart in de Studio om eerst een betaalverzoek te maken.",
      );
      setReminderDraft(null);
      return;
    }
    const amount = config.paymentRequestAmount || calculateWeddingCakePrice(config).total;
    const customerName = config.contact.names || config.contact.surname || "klant";
    setReminderSending(true);
    setStatus("");
    try {
      const response = await fetch("/api/bruidstaart-payment-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientEmail,
          amount,
          code: reminderDraft.code,
          customerName,
          deliveryDate: deliveryDateFor(reminderDraft),
          existingPaymentLinkId: paymentLinkId,
          subject: `Herinnering betaalverzoek bruidstaart ${reminderDraft.code}`,
          body: [
            `Beste ${customerName},`,
            "",
            "Graag herinneren we je aan het openstaande betaalverzoek voor jullie bruidstaart.",
            `Bedrag: ${formatEuro(amount)}`,
            "",
            "Via onderstaande link kun je de betaling afronden:",
            "[MOLLIE LINK HIER PLAKKEN]",
            "",
            "Hartelijke groet,",
            "Strik Patisserie",
          ].join("\n"),
        }),
      });
      const result = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(result.message || "Herinnering versturen is mislukt.");
      setStatus(result.message || "De betaalherinnering is verstuurd.");
      setReminderDraft(null);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Herinnering versturen is mislukt.");
    } finally {
      setReminderSending(false);
    }
  }

  return (
    <main className="relative min-h-dvh overflow-hidden bg-[#c3d3bc] px-3 py-4 pb-24 text-[#49342d] sm:px-6 sm:py-6 lg:px-8">
      <span aria-hidden="true" className="pointer-events-none absolute -right-[22rem] top-12 h-[34rem] w-[46rem] rotate-[-9deg] bg-[#dce6d8] opacity-[0.55] sm:-right-[28rem] sm:-top-40 sm:h-[68rem] sm:w-[90rem]" style={{ WebkitMask: 'url("/strik%20logo%20icon.svg") center / contain no-repeat', mask: 'url("/strik%20logo%20icon.svg") center / contain no-repeat' }} />
      <div className="relative mx-auto w-full max-w-[72rem]">
        <StrikBackButton />
        <header className="mt-3 flex items-center gap-2">
          <img src={strikIcons.bruidstaart} alt="" className="h-7 w-7 object-contain brightness-0 invert" />
          <h1 className="text-[0.9rem] font-medium uppercase tracking-[0.3em] text-white">Bruidstaarten overzicht</h1>
        </header>

        {status ? <p className="mt-3 rounded-xl border border-white/70 bg-white/60 px-4 py-2 text-xs font-bold">{status}</p> : null}

        <section className="mt-4 overflow-hidden rounded-[1.4rem] border border-white/65 bg-[#fffaf0]/95 shadow-[0_14px_38px_rgba(73,52,45,.12)]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e6ddd2] px-4 py-3 sm:px-5">
            <div className="flex items-center overflow-hidden rounded-full border border-[#ddd3c8] bg-white text-xs font-black">
              <button type="button" aria-label="Vorige maand" onClick={() => changeMonth(-1)} className="px-3 py-2 text-lg leading-none text-[#49342d]/55">‹</button>
              <p className="min-w-40 border-x border-[#eee6dd] px-4 py-2 text-center capitalize">{monthFormatter.format(visibleMonth)}</p>
              <button type="button" aria-label="Volgende maand" onClick={() => changeMonth(1)} className="px-3 py-2 text-lg leading-none text-[#49342d]/55">›</button>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[0.58rem] font-black uppercase tracking-[0.08em]">
              <span className="rounded-full bg-[#f3eadf] px-3 py-2">{monthDrafts.length} taarten</span>
              <span className="rounded-full bg-[#e3eee0] px-3 py-2 text-[#45663b]">{paidCount} betaald</span>
              <span className="rounded-full bg-[#eadfe5] px-3 py-2 text-[#765a68]">{deliveryCount} bezorgen</span>
              {urgentCount ? <span className="rounded-full bg-[#d75a48] px-3 py-2 text-white">! {urgentCount} actie nodig</span> : null}
            </div>
          </div>

          <div className="hidden grid-cols-[5.5rem_minmax(13rem,1.4fr)_5rem_minmax(12rem,1.2fr)_13rem_2rem] bg-[#f3eadf] px-5 text-[0.52rem] font-black uppercase tracking-[0.12em] text-[#49342d]/45 md:grid">
            <span className="py-2">Datum</span><span className="py-2">Bruidspaar</span><span className="py-2">Tijd</span><span className="py-2">Overdracht</span><span className="py-2">Status</span><span />
          </div>

          <div className="divide-y divide-[#eee6dd] bg-white">
            {loading ? <p className="px-5 py-10 text-center text-xs font-bold text-[#49342d]/45">Definitieve bruidstaarten laden…</p> : null}
            {!loading && !monthDrafts.length ? <p className="px-5 py-10 text-center text-xs font-bold text-[#49342d]/45">Geen definitieve bruidstaarten in deze maand.</p> : null}
            {monthDrafts.map((draft) => {
              const date = dateFrom(deliveryDateFor(draft));
              const contact = draft.config.contact;
              const urgent = isUrgentUnpaid(draft);
              const paid = isPaid(draft);
              const deliveryTime = getDeliveryTimeLabel(contact) || contact.deliveryTimeStart || contact.deliveryTimeEnd || "—";
              return (
                <article key={draft.code} role="button" tabIndex={0} onClick={() => openDraft(draft)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") openDraft(draft); }} className="grid cursor-pointer gap-3 px-4 py-3 transition hover:bg-[#fbf8f2] md:grid-cols-[5.5rem_minmax(13rem,1.4fr)_5rem_minmax(12rem,1.2fr)_13rem_2rem] md:items-center sm:px-5">
                  <div><p className="text-xs font-black">{date ? dateFormatter.format(date).replace(".", "") : "Geen datum"}</p><p className="mt-0.5 text-[0.52rem] font-bold capitalize text-[#49342d]/35">{date ? weekdayFormatter.format(date) : ""}</p></div>
                  <div><p className="text-xs font-black">{draft.code} · {contact.names || draft.surname}</p><p className="mt-0.5 text-[0.56rem] font-bold text-[#49342d]/45">{cakeDescription(draft)} · bijgewerkt {updatedLabel(draft.updatedAt)}</p></div>
                  <p className="text-xs font-black">{deliveryTime}</p>
                  <div><p className="text-xs font-black capitalize">{getDeliveryMethodLabel(contact.deliveryMethod)}</p><p className="mt-0.5 truncate text-[0.58rem] font-bold text-[#49342d]/45">{contact.deliveryMethod === "pickup" ? "Strik Ziekerstraat" : contact.deliveryAddress || "Adres niet ingevuld"}</p></div>
                  <span className="flex flex-wrap gap-1"><span className="w-fit rounded-full bg-[#e3eee0] px-2.5 py-1 text-[0.5rem] font-black uppercase tracking-[0.06em] text-[#45663b]">Definitief</span><span className={`w-fit rounded-full px-2.5 py-1 text-[0.5rem] font-black uppercase tracking-[0.04em] ${paid ? "bg-[#e3eee0] text-[#45663b]" : "bg-[#fff0bb] text-[#765c00]"}`}>{paymentLabel(draft)}</span>{urgent ? <button type="button" aria-label={`Betaalherinnering voor ${contact.names || draft.surname}`} title="Binnen 7 dagen en nog niet betaald" onClick={(event) => { event.stopPropagation(); setReminderDraft(draft); }} className="flex h-6 w-6 items-center justify-center rounded-full bg-[#d75a48] text-xs font-black text-white">!</button> : null}</span>
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#f1e9df] text-sm font-black">›</span>
                </article>
              );
            })}
          </div>
          <footer className="border-t border-[#e6ddd2] bg-[#f3eadf] px-5 py-2.5 text-[0.56rem] font-bold italic text-[#49342d]/45">Alleen definitieve bruidstaarten staan hier; niet-definitieve aanvragen blijven bij Concepten beheren.</footer>
        </section>
      </div>

      {selectedDraft && editDraft ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1a1815]/45 p-3">
          <section className="max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-[1.3rem] bg-[#fffaf0] p-4 shadow-2xl sm:p-5">
            <div className="flex items-start justify-between gap-3"><div><p className="text-[0.55rem] font-black uppercase tracking-[0.14em] text-[#55704d]">Definitieve bruidstaart</p><h2 className="mt-1 text-lg font-black">{selectedDraft.code} · {selectedDraft.config.contact.names || selectedDraft.surname}</h2></div><button type="button" onClick={closeDraft} aria-label="Sluiten" className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f1e9df] text-lg font-black">×</button></div>
            {dialogMode === "choice" ? <div className="mt-4 grid gap-2"><button type="button" onClick={() => setDialogMode("details")} className="flex items-center justify-between rounded-xl border border-[#cdddc8] bg-white p-3 text-left"><span><strong className="block text-sm font-black">Alleen gegevens wijzigen</strong><small className="text-[0.62rem] font-bold text-[#49342d]/45">Contact en levering; het taartontwerp blijft vergrendeld.</small></span><span className="rounded-full bg-[#e3eee0] px-3 py-2 font-black">›</span></button><button type="button" onClick={() => setDialogMode("cake")} className="flex items-center justify-between rounded-xl border border-[#efd0c8] bg-white p-3 text-left"><span><strong className="block text-sm font-black">De taart zelf wijzigen</strong><small className="text-[0.62rem] font-bold text-[#49342d]/45">Opbouw, smaak, kleur, decoratie of topper in de Studio.</small></span><span className="rounded-full bg-[#f7e3de] px-3 py-2 font-black text-[#d75a48]">›</span></button></div> : null}
            {dialogMode === "details" ? <div className="mt-4"><div className="mb-3 flex items-center justify-between"><p className="text-[0.56rem] font-black uppercase tracking-[0.12em] text-[#55704d]">Gegevens wijzigen</p><span className="rounded-full bg-[#e3eee0] px-2.5 py-1 text-[0.5rem] font-black uppercase text-[#45663b]">Taart vergrendeld</span></div><div className="grid gap-2 sm:grid-cols-2">{([['names','Bruidspaar','text'],['email','E-mail','email'],['phone','Telefoon','tel'],['deliveryDate','Leverdatum','date'],['deliveryTimeStart','Tijd vanaf','time'],['deliveryTimeEnd','Tijd tot / uiterlijk','time'],['deliveryAddress','Locatie / adres','text'],['invoiceEmail','Factuur e-mail','email']] as const).map(([field,label,type]) => <label key={field}><span className="block text-[0.5rem] font-black uppercase tracking-[0.1em] text-[#49342d]/40">{label}</span><input type={type} value={editDraft.config.contact[field]} onChange={(event) => updateContact(field,event.target.value)} className="mt-1 h-9 w-full rounded-lg border border-[#ddd3c8] bg-white px-3 text-xs font-bold outline-none" /></label>)}</div><div className="mt-3 flex justify-end gap-2"><button type="button" onClick={() => setDialogMode("choice")} className="rounded-full px-4 py-2 text-xs font-black">Terug</button><button type="button" disabled={saving} onClick={() => void saveDetails()} className="rounded-full bg-[#265c45] px-4 py-2 text-xs font-black text-white disabled:opacity-50">{saving ? "Opslaan…" : "Gegevens opslaan"}</button></div></div> : null}
            {dialogMode === "cake" ? <div className="mt-4 rounded-xl border border-[#efd0c8] bg-white p-4"><p className="text-sm font-black text-[#b34535]">Weet je zeker dat je de definitieve taart wilt aanpassen?</p><p className="mt-1 text-xs font-bold text-[#49342d]/55">Je opent de volledige Studio en kunt daarmee het afgesproken taartontwerp veranderen.</p><div className="mt-4 flex justify-end gap-2"><button type="button" onClick={() => setDialogMode("choice")} className="rounded-full px-4 py-2 text-xs font-black">Annuleren</button><Link href={`/bruidstaarten/studio?openFinal=${encodeURIComponent(selectedDraft.code)}&editCake=1`} className="rounded-full bg-[#d75a48] px-4 py-2 text-xs font-black text-white">Ja, open Studio</Link></div></div> : null}
          </section>
        </div>
      ) : null}

      {reminderDraft ? <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#1a1815]/45 p-3"><section className="w-full max-w-md rounded-[1.3rem] bg-[#fffaf0] p-5 shadow-2xl"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#d75a48] text-lg font-black text-white">!</span><h2 className="mt-3 text-lg font-black">Betaalherinnering versturen?</h2><p className="mt-1 text-xs font-bold text-[#49342d]/55">De bestaande betaallink wordt opnieuw gemaild naar {reminderDraft.config.paymentRequestEmail || reminderDraft.config.contact.email || "de klant"}. Er wordt geen nieuw betaalverzoek aangemaakt.</p><div className="mt-4 flex justify-end gap-2"><button type="button" disabled={reminderSending} onClick={() => setReminderDraft(null)} className="rounded-full px-4 py-2 text-xs font-black">Annuleren</button><button type="button" disabled={reminderSending} onClick={() => void sendReminder()} className="rounded-full bg-[#d75a48] px-4 py-2 text-xs font-black text-white disabled:opacity-50">{reminderSending ? "Versturen…" : "Herinnering versturen"}</button></div></section></div> : null}
    </main>
  );
}
