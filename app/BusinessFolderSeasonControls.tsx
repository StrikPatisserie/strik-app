"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type BusinessFolderSeason = "sint" | "kerst";

const SEASON_INTRO_SESSION_KEY = "strik-business-folder-season-2026-seen";

function GiftIcon({ className = "h-12 w-12" }: Readonly<{ className?: string }>) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 48 48"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M8 21h32v21H8z" />
      <path d="M5 14h38v8H5zM24 14v28" />
      <path d="M23.5 14C18 14 13 11.7 13 8.2 13 5.8 15 4 17.7 4c4 0 6.3 5.9 6.3 10ZM24.5 14C30 14 35 11.7 35 8.2 35 5.8 33 4 30.3 4c-4 0-6.3 5.9-6.3 10Z" />
    </svg>
  );
}

export function BusinessFolderSeasonNav({
  active,
}: Readonly<{
  active: BusinessFolderSeason;
}>) {
  return (
    <nav
      aria-label="Wissel tussen de Sint- en kerstfolder"
      className="inline-flex shrink-0 rounded-full border border-white/45 bg-white/95 p-1 text-[.62rem] font-black uppercase tracking-[.1em] shadow-lg backdrop-blur sm:text-[.68rem]"
    >
      <Link
        href="/sint-voor-bedrijven"
        aria-current={active === "sint" ? "page" : undefined}
        className={`rounded-full px-3 py-2 transition sm:px-4 ${
          active === "sint"
            ? "bg-[#d62d1d] text-white"
            : "text-[#60190f] hover:bg-[#fff0dd]"
        }`}
      >
        Sint
      </Link>
      <Link
        href="/kerst-voor-bedrijven"
        aria-current={active === "kerst" ? "page" : undefined}
        className={`rounded-full px-3 py-2 transition sm:px-4 ${
          active === "kerst"
            ? "bg-[#741f3b] text-white"
            : "text-[#262a4a] hover:bg-[#f4e8d4]"
        }`}
      >
        Kerst
      </Link>
    </nav>
  );
}

export function BusinessGiftFinderButton({
  season,
  onClick,
}: Readonly<{
  season: BusinessFolderSeason;
  onClick: () => void;
}>) {
  const isChristmas = season === "kerst";

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Open de interactieve ${isChristmas ? "kerst" : "Sint"}cadeaukeuzehulp`}
      className="group relative mx-auto flex w-full max-w-md items-center gap-3 rounded-[50%] px-5 py-5 text-left transition hover:-translate-y-0.5 sm:mx-0 sm:w-[26rem] sm:gap-4 sm:px-10 sm:py-7"
    >
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 rotate-[1.5deg] rounded-[50%] border ${
          isChristmas ? "border-[#d8b56d]/60" : "border-[#d62d1d]/60"
        }`}
      />
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute inset-x-2 inset-y-1 -rotate-[1deg] rounded-[50%] border ${
          isChristmas ? "border-[#d8b56d]/35" : "border-[#d62d1d]/35"
        }`}
      />
      <span
        className={`relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full shadow-lg transition group-hover:scale-105 sm:h-14 sm:w-14 ${
          isChristmas
            ? "bg-[#741f3b] text-[#d8b56d]"
            : "bg-[#d62d1d] text-white"
        }`}
      >
        <GiftIcon className="h-7 w-7 sm:h-8 sm:w-8" />
        <span
          aria-hidden="true"
          className={`absolute -right-0.5 -top-0.5 flex h-5 w-5 items-center justify-center rounded-full text-[.65rem] font-black ${
            isChristmas
              ? "bg-[#d8b56d] text-[#222849]"
              : "bg-white text-[#d62d1d]"
          }`}
        >
          ?
        </span>
      </span>
      <span className="relative min-w-0">
        <span
          className={`block text-[.52rem] font-black uppercase tracking-[.16em] sm:text-[.58rem] sm:tracking-[.18em] ${
            isChristmas ? "text-[#d8b56d]" : "text-white"
          }`}
        >
          Interactieve keuzehulp
        </span>
        <span className="mt-0.5 block font-[Butterscotch] text-[1.55rem] leading-none text-white sm:text-3xl">
          Vind jouw cadeau
        </span>
        <span
          className={`mt-1 block text-[.54rem] font-bold sm:text-[.62rem] ${
            isChristmas ? "text-[#ddd5dc]" : "text-white"
          }`}
        >
          Aantal, budget en logo — wij rekenen mee.
        </span>
      </span>
    </button>
  );
}

export function BusinessFolderSeasonIntro() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (window.sessionStorage.getItem(SEASON_INTRO_SESSION_KEY)) return;

    const frame = window.requestAnimationFrame(() => setOpen(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  function close() {
    window.sessionStorage.setItem(SEASON_INTRO_SESSION_KEY, "1");
    setOpen(false);
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center overflow-auto bg-[#11152c]/95 p-4 sm:p-7"
      onClick={close}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="season-intro-title"
        className="relative w-full max-w-4xl overflow-hidden rounded-[2rem] border border-[#d8b56d]/45 bg-[#171b38] p-5 text-center shadow-2xl sm:p-8"
        onClick={(event) => event.stopPropagation()}
      >
        <span className="pointer-events-none absolute -left-16 -top-20 h-52 w-52 rounded-full bg-[#741f3b]/50 blur-3xl" />
        <span className="pointer-events-none absolute -bottom-24 -right-10 h-64 w-64 rounded-full bg-[#d59c38]/25 blur-3xl" />
        <button
          type="button"
          aria-label="Sluiten"
          onClick={close}
          className="relative ml-auto flex h-9 w-9 items-center justify-center rounded-full bg-white/95 text-lg font-black text-[#171b38]"
        >
          ×
        </button>
        <div className="relative mx-auto max-w-2xl">
          <p className="text-[.65rem] font-black uppercase tracking-[.24em] text-[#d8b56d] sm:text-xs">
            Zakelijke feestdagenfolders 2026
          </p>
          <h2
            id="season-intro-title"
            className="mt-2 text-3xl font-black leading-tight text-white sm:text-5xl"
          >
            Voor welk feest zoek je een cadeau?
          </h2>
          <p className="mt-2 text-sm font-semibold text-[#e8dfd4] sm:text-base">
            Pak een cadeau uit en bekijk de passende bedrijfsfolder.
          </p>
        </div>

        <div className="relative mt-6 grid gap-4 sm:grid-cols-2">
          <Link
            href="/sint-voor-bedrijven"
            onClick={close}
            className="group gift-reveal relative overflow-hidden rounded-[1.7rem] bg-[#efb800] p-5 text-left text-[#60190f] shadow-xl transition hover:-translate-y-1 sm:p-7"
          >
            <span className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-[#d62d1d]/15" />
            <span className="flex h-20 w-20 items-center justify-center rounded-[1.5rem] bg-[#d62d1d] text-white shadow-lg transition group-hover:rotate-3 group-hover:scale-105">
              <GiftIcon />
            </span>
            <span className="mt-5 block text-[.62rem] font-black uppercase tracking-[.18em] text-white">
              Nu te bekijken
            </span>
            <strong className="mt-1 block text-3xl font-black">Sinterklaas</strong>
            <span className="mt-2 block text-sm font-bold">
              Bekijk het assortiment en stel direct een offerteaanvraag samen.
            </span>
            <span className="mt-5 inline-flex rounded-full bg-white px-4 py-2 text-xs font-black">
              Open de Sintfolder →
            </span>
          </Link>

          <Link
            href="/kerst-voor-bedrijven"
            onClick={close}
            className="group gift-reveal relative overflow-hidden rounded-[1.7rem] border border-[#d8b56d]/60 bg-gradient-to-br from-[#222849] via-[#421f42] to-[#741f3b] p-5 text-left text-white shadow-xl transition hover:-translate-y-1 sm:p-7"
          >
            <span className="absolute right-5 top-4 text-3xl text-[#d8b56d]">✦</span>
            <span className="flex h-20 w-20 items-center justify-center rounded-[1.5rem] bg-[#d8b56d] text-[#222849] shadow-lg transition group-hover:-rotate-3 group-hover:scale-105">
              <GiftIcon />
            </span>
            <span className="mt-5 block text-[.62rem] font-black uppercase tracking-[.18em] text-[#d8b56d]">
              Binnenkort gevuld
            </span>
            <strong className="mt-1 block text-3xl font-black">Kerst</strong>
            <span className="mt-2 block text-sm font-bold text-[#eee5db]">
              Bekijk alvast de nieuwe kerstfolder en houd de invulling in de gaten.
            </span>
            <span className="mt-5 inline-flex rounded-full bg-[#d8b56d] px-4 py-2 text-xs font-black text-[#222849]">
              Open de kerstfolder →
            </span>
          </Link>
        </div>
      </section>
    </div>
  );
}
