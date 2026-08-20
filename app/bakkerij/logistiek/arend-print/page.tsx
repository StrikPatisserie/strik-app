"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AREND_PRINT_SESSION_KEY,
  AREND_PRINT_SQUARES_PER_SHEET,
  type ArendPrintSessionBreakdown,
  type ArendPrintSession,
} from "../arendPrintSession";

const AREND_FONT_NAME = "ArendBona";
const AREND_FONT_LOAD = `400 16px "${AREND_FONT_NAME}"`;

async function waitForArendFont(timeoutMs = 1400) {
  const fontSet = "fonts" in document ? document.fonts : null;

  if (!fontSet) return true;

  const loadFont = async () => {
    try {
      await fontSet.load(AREND_FONT_LOAD);

      return fontSet.check(AREND_FONT_LOAD);
    } catch (error) {
      console.error(error);
    }

    return false;
  };

  return Promise.race([
    loadFont(),
    new Promise<false>((resolve) => {
      window.setTimeout(() => resolve(false), timeoutMs);
    }),
  ]);
}

function formatBreakdown(items: ArendPrintSessionBreakdown[]) {
  return items.map((item) => `${item.count}x${item.number}`).join(", ");
}

function summarizeItems(items: ArendPrintSession["items"]) {
  const counts = new Map<string, number>();
  const order: string[] = [];

  items.forEach((item) => {
    if (!counts.has(item.number)) order.push(item.number);
    counts.set(item.number, (counts.get(item.number) || 0) + 1);
  });

  return order.map((number) => ({
    count: counts.get(number) || 0,
    displayNumber: number.replace(/0/g, "O"),
    number,
  }));
}

function ArendNumberValue({
  displayNumber,
  isDark,
}: Readonly<{
  displayNumber: string;
  isDark: boolean;
}>) {
  const chars = Array.from(displayNumber);
  const hasZero = chars.includes("O");

  return (
    <div
      className={`arend-number mt-[-0.7mm] flex items-center justify-center text-center leading-none ${
        hasZero ? "gap-[0.4mm]" : ""
      } ${isDark ? "text-[#f7f4f1]" : "text-[#313130]"}`}
    >
      {chars.map((char, index) => (
        <span
          key={`${displayNumber}-${index}`}
          className={
            char === "O"
              ? "arend-number-zero inline-block origin-center scale-x-[0.82] text-[15.1mm]"
              : "inline-block text-[15.6mm]"
          }
        >
          {char}
        </span>
      ))}
    </div>
  );
}

function readArendPrintSession() {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.sessionStorage.getItem(AREND_PRINT_SESSION_KEY);
    if (!raw) return null;

    const session = JSON.parse(raw) as Partial<ArendPrintSession>;
    if (
      typeof session.title === "string" &&
      typeof session.date === "string" &&
      typeof session.orderedCount === "number" &&
      typeof session.requestedCount === "number" &&
      Array.isArray(session.items)
    ) {
      const printBreakdown = Array.isArray(session.printBreakdown)
        ? session.printBreakdown
        : summarizeItems(session.items as ArendPrintSession["items"]);
      const requestedBreakdown = Array.isArray(session.requestedBreakdown)
        ? session.requestedBreakdown
        : printBreakdown;

      return {
        ...session,
        printBreakdown,
        requestedBreakdown,
        reserveCount:
          typeof session.reserveCount === "number"
            ? session.reserveCount
            : Math.max(0, session.items.length - session.requestedCount),
      } as ArendPrintSession;
    }
  } catch (error) {
    console.error(error);
  }

  return null;
}

export default function ArendPrintPage() {
  const [session] = useState<ArendPrintSession | null>(() =>
    readArendPrintSession()
  );
  const [fontLoadState, setFontLoadState] = useState<
    "checking" | "ready" | "fallback"
  >("checking");
  const sheets = useMemo(() => {
    if (!session) return [];

    return Array.from(
      {
        length: Math.ceil(
          session.items.length / AREND_PRINT_SQUARES_PER_SHEET
        ),
      },
      (_, index) =>
        session.items.slice(
          index * AREND_PRINT_SQUARES_PER_SHEET,
          (index + 1) * AREND_PRINT_SQUARES_PER_SHEET
        )
    );
  }, [session]);

  useEffect(() => {
    if (!session) return;

    let isCancelled = false;

    waitForArendFont(2200).then((loaded) => {
      if (!isCancelled) setFontLoadState(loaded ? "ready" : "fallback");
    });

    return () => {
      isCancelled = true;
    };
  }, [session]);

  async function handlePrint() {
    await waitForArendFont(700);

    window.print();
  }

  if (!session) {
    return (
      <main className="mx-auto max-w-xl p-6 text-[#1a1815]">
        <h1 className="text-2xl font-black tracking-normal">
          Geen Arend-print klaar
        </h1>
        <p className="mt-2 text-sm font-bold tracking-normal text-[#6b645b]">
          Ga terug naar logistiek en open de marsepein-print opnieuw.
        </p>
        <button
          type="button"
          onClick={() => window.location.assign("/bakkerij/logistiek/dagstart")}
          className="mt-5 min-h-10 border border-[#1a1815] bg-[#1a1815] px-4 text-sm font-black uppercase tracking-normal text-white"
        >
          Terug
        </button>
      </main>
    );
  }

  return (
    <main className="arend-print-page min-h-dvh bg-[#f7f4f1] text-[#313130]">
      <style>{`
        @font-face {
          font-family: "ArendBona";
          src:
            url("/fonts/arend-bona-title-bold.otf") format("opentype"),
            local("Bona Title Bold"),
            local("BonaTitle-Bold"),
            local("Bona Title");
          font-display: swap;
          font-style: normal;
          font-weight: 400;
        }
        .arend-number,
        .arend-number * {
          font-family: "ArendBona", "Bona Title Bold", "BonaTitle-Bold", "Bona Title", Georgia, serif !important;
          font-style: normal !important;
          font-synthesis: none !important;
          font-weight: 400 !important;
          text-rendering: geometricPrecision;
          -webkit-font-smoothing: antialiased;
        }
        @media print {
          @page {
            margin: 12mm 16mm 50mm;
            size: A4 portrait;
          }
          body {
            background: #f7f4f1 !important;
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
          body * {
            visibility: hidden !important;
          }
          .arend-print-page,
          .arend-print-page * {
            visibility: visible !important;
          }
          .arend-print-page {
            background: #f7f4f1 !important;
            display: block !important;
            inset: 0 auto auto 0;
            min-height: auto !important;
            position: absolute;
            width: 100%;
          }
          .arend-screen-actions,
          .arend-sheet-header {
            display: none !important;
          }
          .arend-print-summary {
            display: block !important;
            font-size: 7px !important;
            gap: 0.4mm !important;
            margin-bottom: 2mm !important;
            padding-bottom: 1.2mm !important;
          }
          .arend-sheet-wrap {
            margin: 0 !important;
            max-width: none !important;
            padding: 0 !important;
            width: 178mm !important;
          }
          .arend-sheet-grid {
            break-after: page;
            grid-template-columns: repeat(6, 29.2mm) !important;
            page-break-after: always;
          }
          .arend-sheet-grid > article {
            height: 24.2mm !important;
            width: 29.2mm !important;
          }
          .arend-sheet-grid:last-child {
            break-after: auto;
            page-break-after: auto;
          }
        }
      `}</style>
      <header className="arend-screen-actions flex items-center justify-between gap-2 border-b border-[#ddd] bg-[#f7f4f1] px-3 py-2">
        <h1 className="text-sm font-black tracking-normal">
          {session.title} · {session.requestedCount}/{session.orderedCount}{" "}
          besteld · {session.items.length} printvakjes
        </h1>
        <div className="flex items-center gap-1.5">
          <span
            className={`hidden border px-2 py-1 text-[0.62rem] font-black uppercase tracking-normal sm:inline-flex ${
              fontLoadState === "ready"
                ? "border-[#c6dec0] bg-[#edf7ea] text-[#3f6b36]"
                : fontLoadState === "fallback"
                  ? "border-[#f1d28f] bg-[#fff5d8] text-[#7a5a18]"
                  : "border-[#e8e4de] bg-white text-[#8b8278]"
            }`}
          >
            {fontLoadState === "ready"
              ? "font geladen"
              : fontLoadState === "fallback"
                ? "font fallback"
                : "font laden"}
          </span>
          <button
            type="button"
            onClick={() => window.location.assign("/bakkerij/logistiek/dagstart")}
            className="min-h-9 border border-[#313130] bg-transparent px-3 text-xs font-black uppercase tracking-normal text-[#313130]"
          >
            Terug
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="min-h-9 border border-[#313130] bg-[#313130] px-3 text-xs font-black uppercase tracking-normal text-white"
          >
            Afdrukken
          </button>
        </div>
      </header>
      <section className="arend-sheet-wrap mx-auto max-w-[210mm] px-[16mm] pb-[50mm] pt-[12mm]">
        <div className="arend-sheet-header mb-[3mm] flex items-baseline justify-between border-b border-[#313130] pb-[1.2mm]">
          <h2 className="m-0 text-[9px] font-black tracking-normal">
            {session.title}
          </h2>
          <p className="m-0 text-[9px] font-black tracking-normal">
            {session.requestedCount}/{session.orderedCount} besteld ·{" "}
            {session.items.length} printvakjes · nul als letter O
          </p>
        </div>
        <div className="arend-print-summary mb-[3mm] grid gap-[1mm] border-b border-[#313130] pb-[2mm] text-[8px] font-black uppercase tracking-normal">
          <div className="flex flex-wrap items-center justify-between gap-[2mm]">
            <span>Besteld: {formatBreakdown(session.requestedBreakdown)}</span>
            <span>
              Totaal: {session.requestedCount}/{session.orderedCount}
            </span>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-[2mm] text-[#6b645b]">
            <span>Print: {formatBreakdown(session.printBreakdown)}</span>
            <span>Reserve: {session.reserveCount}</span>
          </div>
        </div>
        {sheets.map((sheetItems, sheetIndex) => (
          <section
            key={`sheet-${sheetIndex}`}
            className="arend-sheet-grid grid justify-center [grid-template-columns:repeat(6,29.4mm)]"
          >
            {sheetItems.map((item, itemIndex) => {
              const isDark = Math.floor(itemIndex / 6) % 2 === 1;

              return (
                <article
                  key={item.id}
                  className={`flex h-[25.2mm] w-[29.4mm] items-center justify-center border-[0.25mm] border-[#f7f4f1] ${
                    isDark ? "bg-[#313130]" : "bg-[#ccccb0]"
                  }`}
                >
                  <ArendNumberValue
                    displayNumber={item.displayNumber}
                    isDark={isDark}
                  />
                </article>
              );
            })}
          </section>
        ))}
      </section>
    </main>
  );
}
