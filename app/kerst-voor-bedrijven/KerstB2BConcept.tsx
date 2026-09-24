"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import {
  BusinessFolderSeasonIntro,
  BusinessFolderSeasonNav,
  BusinessGiftFinderButton,
} from "@/app/BusinessFolderSeasonControls";
import { BUSINESS_FOLDER_LOGO_PRICE_INCL } from "@/app/lib/business-folder-pricing";

const LOGO_PRICE_LABEL = BUSINESS_FOLDER_LOGO_PRICE_INCL.toLocaleString("nl-NL", {
  style: "currency",
  currency: "EUR",
});

function ChristmasGiftIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 64 64"
      className="h-16 w-16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 29h40v27H12zM8 19h48v11H8zM32 19v37" />
      <path d="M31 19c-7 0-13-3-13-7.5C18 8.5 20.4 6 24 6c5 0 8 7.5 8 13ZM33 19c7 0 13-3 13-7.5C46 8.5 43.6 6 40 6c-5 0-8 7.5-8 13Z" />
      <path d="m51 5 1.4 3.6L56 10l-3.6 1.4L51 15l-1.4-3.6L46 10l3.6-1.4L51 5Z" />
    </svg>
  );
}

export default function KerstB2BConcept() {
  const [finderOpen, setFinderOpen] = useState(false);
  const [recipientCount, setRecipientCount] = useState(25);
  const [budget, setBudget] = useState(20);
  const [wantsLogo, setWantsLogo] = useState(false);
  const [includeVat, setIncludeVat] = useState(true);

  return (
    <main className="min-h-dvh overflow-hidden bg-[#171b38] text-[#f8f0df]">
      <header className="relative overflow-hidden border-b border-[#d8b56d]/30 px-4 py-4 sm:px-8 lg:px-12 lg:py-5">
        <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-[#741f3b]/70 blur-3xl" />
        <div className="pointer-events-none absolute left-[42%] top-12 h-44 w-44 rounded-full bg-[#4d2857]/45 blur-3xl" />
        <span className="pointer-events-none absolute right-[10%] top-[32%] text-5xl text-[#d8b56d]/65">✦</span>
        <span className="pointer-events-none absolute right-[28%] top-[18%] text-xl text-[#d8b56d]/45">✦</span>

        <nav className="relative mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
          <Image
            src="/strik-logo.png"
            alt="Strik Patisserie"
            width={112}
            height={72}
            className="h-11 w-auto object-contain brightness-0 invert sm:h-12"
            priority
          />
          <BusinessFolderSeasonNav active="kerst" />
        </nav>

        <div className="relative mx-auto mt-3 grid max-w-7xl items-center gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-8">
          <div className="min-w-0">
            <p className="text-[.6rem] font-black uppercase tracking-[.2em] text-[#d8b56d] sm:text-xs sm:tracking-[.24em]">
              Sinds 1937 · ambacht uit Nijmegen
            </p>
            <div className="mt-2 inline-flex min-w-0 flex-col sm:mt-1">
              <h1 className="text-[clamp(4.5rem,20vw,6.5rem)] font-black leading-[.7] tracking-[-.08em] text-white lg:text-[clamp(6.5rem,12vw,10.5rem)]">
                KERST
              </h1>
              <p className="mt-1 whitespace-nowrap font-[Butterscotch] text-[clamp(2.35rem,10vw,3.2rem)] leading-none text-[#d8b56d] sm:self-end sm:pr-2 lg:text-[clamp(2rem,3.2vw,3.5rem)]">
                Met een Strik
              </p>
            </div>
            <p className="mt-3 max-w-3xl text-[.72rem] font-bold leading-snug text-[#ddd5dc] sm:text-sm">
              <span className="block">Ambachtelijke kerstcadeaus voor collega&apos;s en relaties.</span>
              <span className="block">De feestelijke invulling wordt momenteel met zorg samengesteld.</span>
            </p>
          </div>
          <BusinessGiftFinderButton
            season="kerst"
            onClick={() => setFinderOpen(true)}
          />
        </div>
      </header>

      {finderOpen && (
        <div
          className="fixed inset-0 z-[65] flex items-end justify-center bg-[#090c21]/80 p-0 sm:items-center sm:p-5"
          onClick={() => setFinderOpen(false)}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="kerst-finder-title"
            className="max-h-[92dvh] w-full max-w-4xl overflow-auto rounded-t-[2rem] border border-[#d8b56d]/45 bg-[#202542] p-5 shadow-2xl sm:rounded-[2rem] sm:p-7"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[.2em] text-[#d8b56d]">
                  Interactieve keuzehulp
                </p>
                <h2 id="kerst-finder-title" className="mt-1 text-2xl font-black text-white sm:text-3xl">
                  Welk kerstcadeau past bij jouw team?
                </h2>
                <p className="mt-1 text-sm font-semibold text-[#ddd5dc]">
                  Vul drie dingen in; zodra het assortiment er staat rekenen we meteen met je mee.
                </p>
              </div>
              <button
                type="button"
                aria-label="Sluiten"
                onClick={() => setFinderOpen(false)}
                className="h-10 w-10 shrink-0 rounded-full bg-white text-xl font-black text-[#202542]"
              >
                ×
              </button>
            </div>

            <div className="mt-5 grid gap-5 border-t border-[#d8b56d]/30 pt-5 lg:grid-cols-3">
              <div className="flex flex-wrap items-center justify-between gap-3 lg:col-span-3">
                <p className="text-xs font-bold text-[#ddd5dc]">
                  De keuzehulp gebruikt straks dezelfde btw-weergave als de folder.
                </p>
                <div className="inline-flex rounded-full border border-[#d8b56d]/60 bg-[#f8f0df] p-1 text-xs font-black">
                  <button
                    type="button"
                    aria-pressed={includeVat}
                    onClick={() => setIncludeVat(true)}
                    className={`rounded-full px-4 py-2 ${includeVat ? "bg-[#741f3b] text-white" : "text-[#202542]"}`}
                  >
                    Incl. btw
                  </button>
                  <button
                    type="button"
                    aria-pressed={!includeVat}
                    onClick={() => setIncludeVat(false)}
                    className={`rounded-full px-4 py-2 ${!includeVat ? "bg-[#741f3b] text-white" : "text-[#202542]"}`}
                  >
                    Excl. btw
                  </button>
                </div>
              </div>

              <label className="grid gap-2 text-sm font-black text-white">
                1. Hoeveel ontvangers?
                <input
                  type="number"
                  min="1"
                  value={recipientCount}
                  onChange={(event) => setRecipientCount(Math.max(1, Number(event.target.value) || 1))}
                  className="h-11 rounded-xl border border-[#d8b56d]/50 bg-[#f8f0df] px-4 text-lg text-[#202542]"
                />
              </label>
              <label className="grid gap-2 text-sm font-black text-white">
                2. Budget per persoon, {includeVat ? "incl." : "excl."} btw
                <input
                  type="number"
                  min="1"
                  value={budget}
                  onChange={(event) => setBudget(Math.max(1, Number(event.target.value) || 1))}
                  className="h-11 rounded-xl border border-[#d8b56d]/50 bg-[#f8f0df] px-4 text-lg text-[#202542]"
                />
              </label>
              <div className="grid content-end gap-2 text-sm font-black text-white">
                3. Met eigen logo?
                <button
                  type="button"
                  aria-pressed={wantsLogo}
                  onClick={() => setWantsLogo(!wantsLogo)}
                  className={`h-11 rounded-xl border px-4 text-left ${
                    wantsLogo
                      ? "border-[#d8b56d] bg-[#741f3b] text-white"
                      : "border-[#d8b56d]/50 bg-[#f8f0df] text-[#202542]"
                  }`}
                >
                  {wantsLogo ? `Ja, + ${LOGO_PRICE_LABEL} p.s. ✓` : "Nee, zonder logo"}
                </button>
              </div>

              <div className="relative overflow-hidden rounded-2xl border border-[#d8b56d]/35 bg-gradient-to-r from-[#351f42] to-[#741f3b] p-5 lg:col-span-3">
                <span className="pointer-events-none absolute -right-3 -top-8 text-8xl text-[#d8b56d]/10">✦</span>
                <p className="relative text-xs font-black uppercase tracking-[.16em] text-[#d8b56d]">
                  Jouw passende kerstcadeaus
                </p>
                <p className="relative mt-2 max-w-2xl text-sm font-bold leading-relaxed text-white">
                  De kerstkeuzehulp staat klaar voor {recipientCount} ontvangers met een budget van maximaal € {budget.toLocaleString("nl-NL", { minimumFractionDigits: 2 })} per persoon{wantsLogo ? ` en een eigen logo van ${LOGO_PRICE_LABEL} p.s. incl. btw` : ""}. Zodra de producten zijn toegevoegd, verschijnen hier automatisch alle passende opties.
                </p>
              </div>
            </div>
          </section>
        </div>
      )}

      <section className="relative mx-auto max-w-7xl px-4 pb-6 pt-4 sm:px-8 lg:px-12 lg:pb-8 lg:pt-5">
        <div className="pointer-events-none absolute -left-32 top-20 h-72 w-72 rounded-full bg-[#741f3b]/30 blur-3xl" />
        <div className="relative overflow-hidden rounded-[2rem] border border-[#d8b56d]/45 bg-gradient-to-br from-[#222849] via-[#351f42] to-[#621f3d] p-6 shadow-[0_24px_70px_rgba(4,7,24,.45)] sm:p-10 lg:p-14">
          <span className="pointer-events-none absolute -right-10 -top-16 text-[12rem] leading-none text-[#d8b56d]/10">✦</span>
          <div className="grid items-center gap-8 lg:grid-cols-[auto_minmax(0,1fr)]">
            <div className="mx-auto flex h-36 w-36 items-center justify-center rounded-[2.5rem] border border-[#d8b56d]/55 bg-[#171b38]/65 text-[#d8b56d] shadow-2xl sm:h-44 sm:w-44">
              <ChristmasGiftIcon />
            </div>
            <div className="max-w-2xl text-center lg:text-left">
              <p className="text-xs font-black uppercase tracking-[.2em] text-[#d8b56d]">
                Binnenkort verkrijgbaar
              </p>
              <h3 className="mt-2 text-2xl font-black leading-tight text-white sm:text-4xl">
                De invulling van de kerstfolder volgt zo spoedig mogelijk.
              </h3>
              <p className="mt-3 text-sm font-semibold leading-relaxed text-[#e4dce2] sm:text-base">
                We stellen op dit moment een feestelijk assortiment samen. Houd deze pagina in de gaten; producten, prijzen en mogelijkheden verschijnen hier zodra ze klaarstaan.
              </p>
              <Link
                href="/sint-voor-bedrijven"
                className="mt-6 inline-flex rounded-full bg-[#d8b56d] px-5 py-3 text-sm font-black text-[#202542] shadow-lg transition hover:-translate-y-0.5"
              >
                Bekijk ondertussen de Sintfolder →
              </Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-[#d8b56d]/25 bg-[#11152c] px-4 py-6 text-center text-xs font-semibold text-[#cfc7cf]">
        Strik Patisserie · zakelijke feestdagenfolder 2026
      </footer>

      <BusinessFolderSeasonIntro />
    </main>
  );
}
