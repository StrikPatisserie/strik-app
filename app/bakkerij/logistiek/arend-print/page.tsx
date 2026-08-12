"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AREND_PRINT_SESSION_KEY,
  AREND_PRINT_SQUARES_PER_SHEET,
  type ArendPrintSession,
} from "../arendPrintSession";

function readArendPrintSession() {
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
      return session as ArendPrintSession;
    }
  } catch (error) {
    console.error(error);
  }

  return null;
}

export default function ArendPrintPage() {
  const [session, setSession] = useState<ArendPrintSession | null>(null);
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
    setSession(readArendPrintSession());
  }, []);

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
          onClick={() => window.location.assign("/bakkerij/logistiek")}
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
          src: url("/61771%20-%20Gasterij%20de%20Arend/BORUTTA%20GROUP%20-%20Bona%20Title%20Bold.otf") format("opentype");
          font-display: block;
          font-weight: 800;
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
          .arend-sheet-wrap {
            margin: 0 !important;
            max-width: none !important;
            padding: 0 !important;
            width: 178mm !important;
          }
          .arend-sheet-grid {
            break-after: page;
            page-break-after: always;
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
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => window.location.assign("/bakkerij/logistiek")}
            className="min-h-9 border border-[#313130] bg-transparent px-3 text-xs font-black uppercase tracking-normal text-[#313130]"
          >
            Terug
          </button>
          <button
            type="button"
            onClick={() => window.print()}
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
                  <div
                    className={`mt-[-0.7mm] text-center font-[ArendBona,Georgia,serif] text-[15.6mm] font-black leading-[0.86] ${
                      isDark ? "text-[#f7f4f1]" : "text-[#313130]"
                    }`}
                  >
                    {item.displayNumber}
                  </div>
                </article>
              );
            })}
          </section>
        ))}
      </section>
    </main>
  );
}
