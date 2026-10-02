"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useActionState, useRef, useState } from "react";
import { strikIcons } from "../../StrikUI";
import {
  addCustomEvaluationAction,
  type CustomEvaluationActionState,
} from "./customActions";

const initialState: CustomEvaluationActionState = {};

export default function EvaluationOverviewToolbar({
  years,
  selectedYear,
}: Readonly<{
  years: string[];
  selectedYear: string;
}>) {
  const yearMenuRef = useRef<HTMLDetailsElement>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [state, formAction, pending] = useActionState(
    addCustomEvaluationAction,
    initialState
  );

  return (
    <>
      <div className="relative z-20 flex justify-end gap-1.5">
        <button
          type="button"
          onClick={() => setIsAdding(true)}
          className="grid h-10 w-10 place-items-center rounded-full bg-[#fed500] text-xl font-black text-[#49342d] shadow-sm"
          aria-label="Feestdag of actie toevoegen"
          title="Feestdag of actie toevoegen"
        >
          +
        </button>

        <details ref={yearMenuRef} className="group relative">
          <summary className="flex h-10 cursor-pointer list-none items-center gap-2 rounded-full bg-white/85 px-2.5 shadow-sm">
            <img src={strikIcons.agenda} alt="" className="h-5 w-5 object-contain" />
            <span className="text-xs font-black text-[#49342d]">{selectedYear}</span>
          </summary>
          <div className="absolute right-0 top-12 min-w-28 overflow-hidden rounded-xl bg-white p-1.5 shadow-xl">
            {years.map((year) => (
              <Link
                key={year}
                href={`/management/cijfers-evaluaties?jaar=${year}`}
                onClick={() => yearMenuRef.current?.removeAttribute("open")}
                className={`block rounded-lg px-3 py-2 text-center text-xs font-black ${
                  year === selectedYear
                    ? "bg-[#a27a8e] text-white"
                    : "text-[#49342d] hover:bg-[#f4eee8]"
                }`}
              >
                {year}
              </Link>
            ))}
          </div>
        </details>
      </div>

      {isAdding ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-[#2f241f]/45 p-0 sm:items-center sm:p-4"
          role="presentation"
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-evaluation-title"
            className="max-h-[92dvh] w-full max-w-lg overflow-auto rounded-t-[1.5rem] bg-[#fffaf0] p-4 shadow-2xl sm:rounded-[1.5rem]"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[0.58rem] font-black uppercase tracking-[0.14em] text-[#a27a8e]">
                  Nieuw jaararchief
                </p>
                <h2
                  id="new-evaluation-title"
                  className="mt-0.5 font-black text-[#49342d]"
                  style={{ fontSize: "1rem" }}
                >
                  Feestdag of actie toevoegen
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="grid h-8 w-8 place-items-center rounded-full bg-white text-lg font-black text-[#49342d]"
                aria-label="Sluiten"
              >
                ×
              </button>
            </div>

            <form action={formAction} className="mt-4 space-y-3">
              <label className="block text-[0.68rem] font-bold text-[#5f554d]">
                Naam
                <input
                  name="title"
                  required
                  placeholder="Bijv. Vaderdag"
                  className="mt-1 h-10 w-full rounded-xl border border-[#ddd2c5] bg-white px-3 text-sm font-medium outline-none focus:border-[#a27a8e]"
                />
              </label>

              <div className="grid grid-cols-2 gap-2">
                <label className="block text-[0.68rem] font-bold text-[#5f554d]">
                  Jaar
                  <select
                    name="year"
                    defaultValue={selectedYear}
                    className="mt-1 h-10 w-full rounded-xl border border-[#ddd2c5] bg-white px-3 text-sm font-medium"
                  >
                    {years.map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-[0.68rem] font-bold text-[#5f554d]">
                  Soort
                  <select
                    name="group"
                    defaultValue="feestdag"
                    className="mt-1 h-10 w-full rounded-xl border border-[#ddd2c5] bg-white px-3 text-sm font-medium"
                  >
                    <option value="feestdag">Feestdag</option>
                    <option value="actie">Overige actie</option>
                  </select>
                </label>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <label className="block text-[0.68rem] font-bold text-[#5f554d]">
                  Startdatum
                  <input
                    type="date"
                    name="startDate"
                    className="mt-1 h-10 w-full rounded-xl border border-[#ddd2c5] bg-white px-3 text-sm"
                  />
                </label>
                <label className="block text-[0.68rem] font-bold text-[#5f554d]">
                  Einddatum
                  <input
                    type="date"
                    name="endDate"
                    className="mt-1 h-10 w-full rounded-xl border border-[#ddd2c5] bg-white px-3 text-sm"
                  />
                </label>
              </div>

              <label className="block rounded-xl bg-[#f3eadf] p-3 text-[0.68rem] font-bold text-[#5f554d]">
                Evaluatie-PDF (optioneel)
                <input
                  type="file"
                  name="pdf"
                  accept="application/pdf,.pdf"
                  className="mt-2 block w-full text-xs file:mr-3 file:rounded-full file:border-0 file:bg-[#a27a8e] file:px-3 file:py-2 file:font-bold file:text-white"
                />
                <span className="mt-1.5 block font-normal italic text-[#786e65]">
                  De tekst wordt uitgelezen en als bewerkbaar evaluatieconcept ingevuld. Controleer het concept altijd zelf.
                </span>
              </label>

              {state.message ? (
                <p
                  className={`rounded-lg px-3 py-2 text-xs font-semibold ${
                    state.ok
                      ? "bg-[#dfead9] text-[#315c39]"
                      : "bg-[#fbe2dc] text-[#9b3427]"
                  }`}
                >
                  {state.message}
                </p>
              ) : null}

              <div className="flex items-center justify-end gap-2">
                {state.ok && state.slug ? (
                  <Link
                    href={`/management/cijfers-evaluaties/${state.slug}?jaar=${selectedYear}`}
                    className="rounded-full border border-[#a27a8e] px-3 py-2 text-xs font-bold text-[#6f4f61]"
                  >
                    Open pagina
                  </Link>
                ) : null}
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-full bg-[#1f4f35] px-4 py-2 text-xs font-black text-white disabled:opacity-50"
                >
                  {pending ? "Inlezen…" : "Toevoegen"}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </>
  );
}
