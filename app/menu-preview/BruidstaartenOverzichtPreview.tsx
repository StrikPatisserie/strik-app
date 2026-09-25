"use client";

/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useState } from "react";
import { strikIcons } from "../StrikUI";

type WeddingCakeOverviewRow = {
  date: string;
  weekday: string;
  time: string;
  couple: string;
  code: string;
  handoff: "Bezorgen" | "Ophalen";
  location: string;
  guests: number;
  payment: "Betaald" | "Deels betaald" | "Nog te betalen";
  cake?: string;
  updated?: string;
  email?: string;
  phone?: string;
  address?: string;
  paymentNote?: string;
  total?: string;
  paymentUrgent?: boolean;
};

const previewMonths: ReadonlyArray<{
  label: string;
  rows: readonly WeddingCakeOverviewRow[];
}> = [
  {
    label: "augustus 2026",
    rows: [
      { date: "15 aug", weekday: "zaterdag", time: "10:30", couple: "Julie & Mees", code: "BT-0826-A", handoff: "Bezorgen", location: "Landgoed Brakkesteyn", guests: 72, payment: "Betaald" },
      { date: "29 aug", weekday: "zaterdag", time: "09:45", couple: "Sophie & Sam", code: "BT-0826-B", handoff: "Ophalen", location: "Ziekerstraat", guests: 48, payment: "Deels betaald" },
    ],
  },
  {
    label: "september 2026",
    rows: [
      { date: "05 sep", weekday: "zaterdag", time: "11:00", couple: "Lotte & Noah", code: "BT-0926-A", handoff: "Bezorgen", location: "Kasteel Wijenburg", guests: 86, payment: "Betaald", cake: "3 lagen hoog · klassiek", updated: "24-08-26", email: "lotte@example.nl", phone: "06 12 34 56 78", address: "Kasteel Wijenburg, Echteld", paymentNote: "Volledig betaald", total: "€ 742,50" },
      { date: "12 sep", weekday: "zaterdag", time: "09:30", couple: "Emma & Daan", code: "BT-0926-B", handoff: "Ophalen", location: "Ziekerstraat", guests: 54, payment: "Betaald", cake: "2 lagen hoog · naked", updated: "01-09-26", email: "emma@example.nl", phone: "06 23 45 67 89", address: "Ophalen bij Strik Ziekerstraat", paymentNote: "Betaald in de winkel", total: "€ 468,00" },
      { date: "18 sep", weekday: "vrijdag", time: "13:15", couple: "Mila & Finn", code: "BT-0926-C", handoff: "Bezorgen", location: "De Wolfsberg", guests: 64, payment: "Deels betaald", cake: "2 lagen hoog · crème", updated: "09-09-26", email: "mila@example.nl", phone: "06 34 56 78 90", address: "Mooksebaan 12, Groesbeek", paymentNote: "Aanbetaling ontvangen", total: "€ 536,00" },
      { date: "25 sep", weekday: "vrijdag", time: "10:00", couple: "Sara & Luuk", code: "BT-0926-D", handoff: "Bezorgen", location: "Slot Doddendael", guests: 92, payment: "Nog te betalen", cake: "2 lagen hoog · ±92 personen", updated: "23-09-26", email: "sara@example.nl", phone: "06 45 67 89 01", address: "Binnenweg 2, Ewijk", paymentNote: "Niet betaald · verzoek verstuurd", total: "€ 814,00", paymentUrgent: true },
      { date: "26 sep", weekday: "zaterdag", time: "11:30", couple: "Eva & Teun", code: "BT-0926-E", handoff: "Ophalen", location: "Ziekerstraat", guests: 38, payment: "Betaald", cake: "1 laag hoog · klassiek", updated: "18-09-26", email: "eva@example.nl", phone: "06 56 78 90 12", address: "Ophalen bij Strik Ziekerstraat", paymentNote: "Volledig betaald", total: "€ 329,00" },
    ],
  },
  {
    label: "oktober 2026",
    rows: [
      { date: "03 okt", weekday: "zaterdag", time: "10:00", couple: "Fleur & Bram", code: "BT-1026-A", handoff: "Bezorgen", location: "Landgoed Groot Warnsborn", guests: 78, payment: "Betaald" },
      { date: "17 okt", weekday: "zaterdag", time: "11:15", couple: "Nina & Lars", code: "BT-1026-B", handoff: "Ophalen", location: "Ziekerstraat", guests: 44, payment: "Nog te betalen" },
      { date: "31 okt", weekday: "zaterdag", time: "09:30", couple: "Isa & Stijn", code: "BT-1026-C", handoff: "Bezorgen", location: "Kasteel Doornenburg", guests: 68, payment: "Deels betaald" },
    ],
  },
];

const paymentClasses: Record<WeddingCakeOverviewRow["payment"], string> = {
  Betaald: "bg-[#e3eee0] text-[#45663b]",
  "Deels betaald": "bg-[#fff0bb] text-[#765c00]",
  "Nog te betalen": "bg-[#f7e3de] text-[#b34535]",
};

export default function BruidstaartenOverzichtPreview({
  toolbar,
}: Readonly<{ toolbar: React.ReactNode }>) {
  const [monthIndex, setMonthIndex] = useState(1);
  const [selectedCake, setSelectedCake] =
    useState<WeddingCakeOverviewRow | null>(null);
  const [dialogMode, setDialogMode] = useState<
    "choice" | "details" | "cake-confirm"
  >("choice");
  const [reminderCake, setReminderCake] =
    useState<WeddingCakeOverviewRow | null>(null);
  const [reminderSent, setReminderSent] = useState(false);
  const month = previewMonths[monthIndex];
  const paidCount = month.rows.filter((row) => row.payment === "Betaald").length;
  const deliveryCount = month.rows.filter((row) => row.handoff === "Bezorgen").length;
  const urgentPaymentCount = month.rows.filter(
    (row) => row.paymentUrgent && row.payment !== "Betaald",
  ).length;

  function openCake(row: WeddingCakeOverviewRow) {
    setSelectedCake(row);
    setDialogMode("choice");
  }

  function closeCake() {
    setSelectedCake(null);
    setDialogMode("choice");
  }

  return (
    <main className="relative min-h-dvh overflow-hidden bg-[#c3d3bc] px-3 py-4 pb-24 text-[#49342d] sm:px-6 sm:py-6 lg:px-8">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-[22rem] top-12 h-[34rem] w-[46rem] rotate-[-9deg] bg-[#dce6d8] opacity-[0.55] sm:-right-[28rem] sm:-top-40 sm:h-[68rem] sm:w-[90rem]"
        style={{
          WebkitMask:
            'url("/strik%20logo%20icon.svg") center / contain no-repeat',
          mask: 'url("/strik%20logo%20icon.svg") center / contain no-repeat',
        }}
      />

      <div className="relative mx-auto w-full max-w-[72rem]">
        {toolbar}

        <Link
          href="/menu-preview?menu=bruidstaarten"
          className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.15em] text-white"
        >
          <span aria-hidden="true">←</span>
          Bruidstaarten
        </Link>

        <header className="mt-4 flex items-center gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center">
            <img
              src={strikIcons.bruidstaart}
              alt=""
              className="h-[1.65rem] w-[1.65rem] object-contain brightness-0 invert"
            />
          </span>
          <h1
            className="uppercase text-white"
            style={{
              fontSize: "clamp(0.84rem, 1.25vw, 0.98rem)",
              fontWeight: 500,
              letterSpacing: "0.3em",
              lineHeight: 1,
            }}
          >
            Bruidstaarten overzicht
          </h1>
        </header>

        <section className="mt-4 overflow-hidden rounded-[1.4rem] border border-white/65 bg-[#fffaf0]/95 shadow-[0_14px_38px_rgba(73,52,45,.12)] backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e6ddd2] px-4 py-3 sm:px-5">
            <div className="flex items-center overflow-hidden rounded-full border border-[#ddd3c8] bg-white text-xs font-black">
              <button
                type="button"
                aria-label="Vorige maand"
                disabled={monthIndex === 0}
                onClick={() => setMonthIndex((current) => Math.max(0, current - 1))}
                className="px-3 py-2 text-lg leading-none text-[#49342d]/55 disabled:opacity-20"
              >
                ‹
              </button>
              <p className="min-w-40 border-x border-[#eee6dd] px-4 py-2 text-center capitalize text-[#49342d]">
                {month.label}
              </p>
              <button
                type="button"
                aria-label="Volgende maand"
                disabled={monthIndex === previewMonths.length - 1}
                onClick={() =>
                  setMonthIndex((current) =>
                    Math.min(previewMonths.length - 1, current + 1),
                  )
                }
                className="px-3 py-2 text-lg leading-none text-[#49342d]/55 disabled:opacity-20"
              >
                ›
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-[0.58rem] font-black uppercase tracking-[0.08em]">
              <span className="rounded-full bg-[#f3eadf] px-3 py-2">
                {month.rows.length} taarten
              </span>
              <span className="rounded-full bg-[#e3eee0] px-3 py-2 text-[#45663b]">
                {paidCount} betaald
              </span>
              <span className="rounded-full bg-[#eadfe5] px-3 py-2 text-[#765a68]">
                {deliveryCount} bezorgen
              </span>
              {urgentPaymentCount > 0 ? (
                <span className="rounded-full bg-[#d75a48] px-3 py-2 text-white">
                  ! {urgentPaymentCount} actie nodig
                </span>
              ) : null}
            </div>
          </div>

          <div className="hidden grid-cols-[5.5rem_minmax(13rem,1.4fr)_5rem_minmax(12rem,1.2fr)_13rem_2rem] bg-[#f3eadf] px-4 text-[0.52rem] font-black uppercase tracking-[0.12em] text-[#49342d]/45 md:grid sm:px-5">
            <span className="py-2">Datum</span>
            <span className="py-2">Bruidspaar</span>
            <span className="py-2">Tijd</span>
            <span className="py-2">Overdracht</span>
            <span className="py-2">Status</span>
            <span />
          </div>

          <div className="divide-y divide-[#eee6dd] bg-white">
            {month.rows.map((row) => (
              <article
                key={row.code}
                onClick={() => openCake(row)}
                onKeyDown={(event) => {
                  if (event.currentTarget !== event.target) return;
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    openCake(row);
                  }
                }}
                role="button"
                tabIndex={0}
                className="grid w-full cursor-pointer gap-3 px-4 py-3 text-left transition hover:bg-[#fbf8f2] focus:bg-[#fbf8f2] focus:outline-none md:grid-cols-[5.5rem_minmax(13rem,1.4fr)_5rem_minmax(12rem,1.2fr)_13rem_2rem] md:items-center sm:px-5"
              >
                <div>
                  <p className="text-xs font-black text-[#49342d]">{row.date}</p>
                  <p className="mt-0.5 text-[0.52rem] font-bold capitalize text-[#49342d]/35">
                    {row.weekday}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-black text-[#49342d]">
                    {row.code} · {row.couple}
                  </p>
                  <p className="mt-0.5 text-[0.56rem] font-bold text-[#49342d]/45">
                    {row.cake || `${row.guests} personen`} · bijgewerkt {row.updated || "recent"}
                  </p>
                </div>
                <p className="text-xs font-black text-[#49342d]">{row.time}</p>
                <div>
                  <p className="text-xs font-black text-[#49342d]">{row.handoff}</p>
                  <p className="mt-0.5 truncate text-[0.58rem] font-bold text-[#49342d]/45">
                    {row.location}
                  </p>
                </div>
                <span className="flex flex-wrap gap-1">
                  <span className="w-fit rounded-full bg-[#e3eee0] px-2.5 py-1 text-[0.5rem] font-black uppercase tracking-[0.06em] text-[#45663b]">
                    Definitief
                  </span>
                  <span className={`w-fit rounded-full px-2.5 py-1 text-[0.5rem] font-black uppercase tracking-[0.04em] ${paymentClasses[row.payment]}`}>
                    {row.paymentNote || row.payment}
                  </span>
                  {row.paymentUrgent && row.payment !== "Betaald" ? (
                    <button
                      type="button"
                      aria-label={`Betaalherinnering versturen aan ${row.couple}`}
                      title="Binnen 7 dagen en nog niet betaald"
                      onClick={(event) => {
                        event.stopPropagation();
                        setReminderCake(row);
                        setReminderSent(false);
                      }}
                      className="flex h-6 w-6 items-center justify-center rounded-full bg-[#d75a48] text-xs font-black text-white shadow-sm"
                    >
                      !
                    </button>
                  ) : null}
                </span>
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#f1e9df] text-sm font-black text-[#49342d]">
                  ›
                </span>
              </article>
            ))}
          </div>

          <footer className="border-t border-[#e6ddd2] bg-[#f3eadf] px-4 py-2.5 text-[0.56rem] font-bold italic text-[#49342d]/45 sm:px-5">
            Alleen definitieve bruidstaarten staan in dit overzicht; niet-definitieve aanvragen blijven bij Concepten beheren.
          </footer>
        </section>
      </div>

      {selectedCake ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1a1815]/45 p-3 sm:p-5">
          <section className="max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-[1.3rem] border border-[#ddd3c8] bg-[#fffaf0] p-4 shadow-2xl sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[0.55rem] font-black uppercase tracking-[0.14em] text-[#55704d]">
                  Definitieve bruidstaart
                </p>
                <h2 className="mt-1 text-lg font-black text-[#49342d]">
                  {selectedCake.code} · {selectedCake.couple}
                </h2>
                <p className="mt-1 text-[0.65rem] font-bold text-[#49342d]/45">
                  Leverdatum {selectedCake.date} · {selectedCake.cake || `${selectedCake.guests} personen`}
                </p>
              </div>
              <button
                type="button"
                onClick={closeCake}
                aria-label="Sluiten"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#f1e9df] text-lg font-black text-[#49342d]"
              >
                ×
              </button>
            </div>

            {dialogMode === "choice" ? (
              <div className="mt-4 grid gap-2">
                <button
                  type="button"
                  onClick={() => setDialogMode("details")}
                  className="flex items-center justify-between gap-4 rounded-xl border border-[#cdddc8] bg-white p-3 text-left"
                >
                  <span>
                    <strong className="block text-sm font-black text-[#49342d]">
                      Alleen gegevens wijzigen
                    </strong>
                    <small className="mt-0.5 block text-[0.62rem] font-bold text-[#49342d]/45">
                      Contact, levering en betaling; het taartontwerp blijft vergrendeld.
                    </small>
                  </span>
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#e3eee0] font-black text-[#45663b]">
                    ›
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setDialogMode("cake-confirm")}
                  className="flex items-center justify-between gap-4 rounded-xl border border-[#efd0c8] bg-white p-3 text-left"
                >
                  <span>
                    <strong className="block text-sm font-black text-[#49342d]">
                      De taart zelf wijzigen
                    </strong>
                    <small className="mt-0.5 block text-[0.62rem] font-bold text-[#49342d]/45">
                      Opbouw, smaak, kleur, decoratie of topper aanpassen in de Studio.
                    </small>
                  </span>
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#f7e3de] font-black text-[#d75a48]">
                    ›
                  </span>
                </button>
              </div>
            ) : null}

            {dialogMode === "details" ? (
              <div className="mt-4">
                <div className="rounded-xl border border-[#cdddc8] bg-white p-3">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <p className="text-[0.56rem] font-black uppercase tracking-[0.12em] text-[#55704d]">
                      Gegevens wijzigen
                    </p>
                    <span className="rounded-full bg-[#e3eee0] px-2.5 py-1 text-[0.5rem] font-black uppercase tracking-[0.06em] text-[#45663b]">
                      Taart vergrendeld
                    </span>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {[
                      ["Bruidspaar", selectedCake.couple],
                      ["E-mail", selectedCake.email || "klant@example.nl"],
                      ["Telefoon", selectedCake.phone || "06 12 34 56 78"],
                      ["Leverdatum", selectedCake.date],
                      ["Tijd", selectedCake.time],
                      ["Locatie / adres", selectedCake.address || selectedCake.location],
                    ].map(([label, value]) => (
                      <label key={label} className="min-w-0">
                        <span className="block text-[0.5rem] font-black uppercase tracking-[0.1em] text-[#49342d]/40">
                          {label}
                        </span>
                        <input
                          defaultValue={value}
                          className="mt-1 h-9 w-full rounded-lg border border-[#ddd3c8] bg-[#fffaf0] px-3 text-xs font-bold text-[#49342d] outline-none"
                        />
                      </label>
                    ))}
                    <label className="min-w-0">
                      <span className="block text-[0.5rem] font-black uppercase tracking-[0.1em] text-[#49342d]/40">
                        Overdracht
                      </span>
                      <select
                        defaultValue={selectedCake.handoff}
                        className="mt-1 h-9 w-full rounded-lg border border-[#ddd3c8] bg-[#fffaf0] px-3 text-xs font-bold text-[#49342d] outline-none"
                      >
                        <option>Bezorgen</option>
                        <option>Ophalen</option>
                      </select>
                    </label>
                    <label className="min-w-0">
                      <span className="block text-[0.5rem] font-black uppercase tracking-[0.1em] text-[#49342d]/40">
                        Betaling
                      </span>
                      <select
                        defaultValue={selectedCake.payment}
                        className="mt-1 h-9 w-full rounded-lg border border-[#ddd3c8] bg-[#fffaf0] px-3 text-xs font-bold text-[#49342d] outline-none"
                      >
                        <option>Betaald</option>
                        <option>Deels betaald</option>
                        <option>Nog te betalen</option>
                      </select>
                    </label>
                  </div>
                </div>
                <div className="mt-3 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setDialogMode("choice")}
                    className="rounded-full border border-[#ddd3c8] bg-white px-4 py-2 text-xs font-black text-[#49342d]/55"
                  >
                    Terug
                  </button>
                  <button
                    type="button"
                    onClick={closeCake}
                    className="rounded-full bg-[#45663b] px-4 py-2 text-xs font-black text-white"
                  >
                    Gegevens opslaan
                  </button>
                </div>
              </div>
            ) : null}

            {dialogMode === "cake-confirm" ? (
              <div className="mt-4 rounded-xl border border-[#efb8ad] bg-[#fff3f0] p-4">
                <p className="text-[0.56rem] font-black uppercase tracking-[0.12em] text-[#d75a48]">
                  Extra controle
                </p>
                <h3 className="mt-1 text-base font-black text-[#49342d]">
                  Weet je zeker dat je de definitieve taart wilt wijzigen?
                </h3>
                <p className="mt-1 text-xs font-bold leading-relaxed text-[#49342d]/55">
                  Je opent het taartontwerp in de Bruidstaart Studio. Een wijziging kan gevolgen hebben voor prijs, productiekaart en planning.
                </p>
                <div className="mt-4 flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setDialogMode("choice")}
                    className="rounded-full border border-[#e4bdb5] bg-white px-4 py-2 text-xs font-black text-[#49342d]/60"
                  >
                    Nee, terug
                  </button>
                  <Link
                    href={`/bruidstaarten/studio?zoek=${encodeURIComponent(selectedCake.code)}`}
                    className="rounded-full bg-[#d75a48] px-4 py-2 text-xs font-black text-white"
                  >
                    Ja, open de Studio
                  </Link>
                </div>
              </div>
            ) : null}
          </section>
        </div>
      ) : null}

      {reminderCake ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#1a1815]/50 p-3 sm:p-5">
          <section className="w-full max-w-lg rounded-[1.3rem] border border-[#efb8ad] bg-[#fffaf0] p-4 shadow-2xl sm:p-5">
            {!reminderSent ? (
              <>
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#d75a48] text-lg font-black text-white">
                    !
                  </span>
                  <div>
                    <p className="text-[0.54rem] font-black uppercase tracking-[0.13em] text-[#d75a48]">
                      Betaling vereist binnen 7 dagen
                    </p>
                    <h2 className="mt-1 text-lg font-black text-[#49342d]">
                      Betaalherinnering versturen?
                    </h2>
                    <p className="mt-1 text-xs font-bold leading-relaxed text-[#49342d]/50">
                      De eerdere betaallink en het openstaande bedrag worden opnieuw verstuurd naar het e-mailadres uit de bestelling.
                    </p>
                  </div>
                </div>

                <div className="mt-4 divide-y divide-[#eee6dd] rounded-xl border border-[#e6ddd2] bg-white px-3 text-xs">
                  <p className="flex justify-between gap-3 py-2">
                    <span className="font-bold text-[#49342d]/40">Klant</span>
                    <strong className="text-right text-[#49342d]">{reminderCake.couple}</strong>
                  </p>
                  <p className="flex justify-between gap-3 py-2">
                    <span className="font-bold text-[#49342d]/40">E-mail</span>
                    <strong className="text-right text-[#49342d]">{reminderCake.email || "klant@example.nl"}</strong>
                  </p>
                  <p className="flex justify-between gap-3 py-2">
                    <span className="font-bold text-[#49342d]/40">Bedrag</span>
                    <strong className="text-right text-[#49342d]">{reminderCake.total || "Openstaand bedrag"}</strong>
                  </p>
                  <p className="flex justify-between gap-3 py-2">
                    <span className="font-bold text-[#49342d]/40">Leverdatum</span>
                    <strong className="text-right text-[#49342d]">{reminderCake.date}</strong>
                  </p>
                </div>

                <p className="mt-3 rounded-lg bg-[#f3eadf] px-3 py-2 text-[0.56rem] font-bold italic text-[#49342d]/45">
                  Preview: er wordt vanaf dit voorbeeld geen echte e-mail verzonden.
                </p>

                <div className="mt-4 flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setReminderCake(null)}
                    className="rounded-full border border-[#ddd3c8] bg-white px-4 py-2 text-xs font-black text-[#49342d]/55"
                  >
                    Annuleren
                  </button>
                  <button
                    type="button"
                    onClick={() => setReminderSent(true)}
                    className="rounded-full bg-[#d75a48] px-4 py-2 text-xs font-black text-white"
                  >
                    Betaalherinnering versturen
                  </button>
                </div>
              </>
            ) : (
              <div className="py-3 text-center">
                <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#e3eee0] text-xl font-black text-[#45663b]">
                  ✓
                </span>
                <h2 className="mt-3 text-lg font-black text-[#49342d]">
                  Herinnering staat klaar
                </h2>
                <p className="mt-1 text-xs font-bold text-[#49342d]/45">
                  Voorbeeld voor {reminderCake.email || "het klantadres"} met dezelfde betaallink.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setReminderCake(null);
                    setReminderSent(false);
                  }}
                  className="mt-4 rounded-full bg-[#45663b] px-5 py-2 text-xs font-black text-white"
                >
                  Sluiten
                </button>
              </div>
            )}
          </section>
        </div>
      ) : null}
    </main>
  );
}
