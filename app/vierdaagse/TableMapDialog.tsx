"use client";

import { useEffect } from "react";

type MapId = "terras" | "binnen";

type TableMap = {
  id: MapId;
  title: string;
  subtitle: string;
  src: string;
  aspectRatio: string;
};

type TableMarker = {
  map: MapId;
  label: string;
  x: number;
  y: number;
};

const tableMaps: TableMap[] = [
  {
    id: "terras",
    title: "Terras",
    subtitle: "Tafels T1 t/m T12",
    src: "/vierdaagse/plategronden-02.svg",
    aspectRatio: "506.9 / 792.3",
  },
  {
    id: "binnen",
    title: "Binnen",
    subtitle: "Tafels B9 t/m B20",
    src: "/vierdaagse/plategronden-01.svg",
    aspectRatio: "885.35 / 305.9",
  },
];

const tableMarkers: Record<string, TableMarker> = {
  T1: { map: "terras", label: "T1", x: 20.2, y: 46.4 },
  T2: { map: "terras", label: "T2", x: 40.2, y: 46.4 },
  T3: { map: "terras", label: "T3", x: 20.2, y: 35.1 },
  T4: { map: "terras", label: "T4", x: 39.5, y: 35.1 },
  T5: { map: "terras", label: "T5", x: 58.9, y: 35.1 },
  T6: { map: "terras", label: "T6", x: 58.9, y: 47.2 },
  T7: { map: "terras", label: "T7", x: 58.9, y: 57.7 },
  T8: { map: "terras", label: "T8", x: 77.0, y: 89.4 },
  T9: { map: "terras", label: "T9", x: 59.4, y: 89.4 },
  T10: { map: "terras", label: "T10", x: 72.1, y: 18.8 },
  T11: { map: "terras", label: "T11", x: 48.1, y: 18.8 },
  T12: { map: "terras", label: "T12", x: 24.0, y: 18.8 },
  B9: { map: "binnen", label: "B9", x: 85.4, y: 37.5 },
  B10: { map: "binnen", label: "B10", x: 75.5, y: 37.5 },
  B11: { map: "binnen", label: "B11", x: 89.6, y: 76.6 },
  B12: { map: "binnen", label: "B12", x: 65.6, y: 37.5 },
  B13: { map: "binnen", label: "B13", x: 70.4, y: 80.7 },
  B14: { map: "binnen", label: "B14", x: 55.7, y: 37.5 },
  B15: { map: "binnen", label: "B15", x: 59.4, y: 80.7 },
  B16: { map: "binnen", label: "B16", x: 40.8, y: 43.1 },
  B17: { map: "binnen", label: "B17", x: 32.3, y: 43.1 },
  B18: { map: "binnen", label: "B18", x: 23.2, y: 43.1 },
  B19: { map: "binnen", label: "B19", x: 14.0, y: 43.1 },
  B20: { map: "binnen", label: "B20", x: 95.4, y: 49.7 },
};

function normalizeTableNumber(value?: string) {
  const normalized = (value || "").trim().toUpperCase().replace(/\s+/g, "");
  if (!normalized) return "";
  if (/^\d+$/.test(normalized)) return `T${normalized}`;

  return normalized;
}

function getTableMarker(tableNumber?: string) {
  return tableMarkers[normalizeTableNumber(tableNumber)];
}

export default function TableMapDialog({
  open,
  highlightedTable,
  onClose,
}: Readonly<{
  open: boolean;
  highlightedTable?: string;
  onClose: () => void;
}>) {
  const marker = getTableMarker(highlightedTable);

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-[#1a1815]/55 p-2 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Vierdaagse plattegronden"
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Plattegronden sluiten"
        onClick={onClose}
      />
      <section className="relative z-10 grid max-h-[92vh] w-full max-w-6xl gap-2 overflow-y-auto rounded-lg border border-[#d6e5d8] bg-[#faf8f5] p-2 shadow-2xl sm:gap-3 sm:p-3">
        <header className="flex items-start justify-between gap-2 rounded-md bg-white p-2">
          <div className="min-w-0">
            <p className="text-[0.62rem] font-black uppercase text-[#ef7d0a] sm:text-xs">
              Plattegronden
            </p>
            <h2 className="text-base font-black leading-tight text-[#24551d] sm:text-xl">
              Tafels Vierdaagse
            </h2>
            {marker && (
              <p className="mt-0.5 text-xs font-bold text-[#6b645b] sm:text-sm">
                {marker.label} is gemarkeerd.
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#24551d] text-sm font-black text-white active:scale-[0.96]"
            aria-label="Plattegronden sluiten"
          >
            X
          </button>
        </header>

        <div className="grid gap-2 lg:grid-cols-[0.58fr_1fr]">
          {tableMaps.map((map) => {
            const activeMarker = marker?.map === map.id ? marker : null;

            return (
              <figure
                key={map.id}
                className="grid gap-1 rounded-md border border-[#e8e4de] bg-white p-2"
              >
                <figcaption className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-black text-[#24551d]">
                    {map.title}
                  </span>
                  <span className="text-[0.62rem] font-bold uppercase text-[#8b8278]">
                    {map.subtitle}
                  </span>
                </figcaption>
                <div
                  className="relative overflow-hidden rounded-md border border-[#d8d0c5] bg-white"
                  style={{ aspectRatio: map.aspectRatio }}
                >
                  <img
                    src={map.src}
                    alt={`Plattegrond ${map.title.toLowerCase()}`}
                    className="absolute inset-0 h-full w-full object-contain"
                  />
                  {activeMarker && (
                    <div
                      className="absolute z-10 grid -translate-x-1/2 -translate-y-1/2 place-items-center"
                      style={{
                        left: `${activeMarker.x}%`,
                        top: `${activeMarker.y}%`,
                      }}
                    >
                      <span className="absolute h-12 w-12 rounded-full bg-[#ef7d0a]/35 ring-4 ring-[#ef7d0a]/25 sm:h-16 sm:w-16" />
                      <span className="relative grid h-8 min-w-8 place-items-center rounded-full bg-[#24551d] px-2 text-[0.68rem] font-black text-white shadow-lg ring-2 ring-white sm:h-10 sm:min-w-10 sm:text-xs">
                        {activeMarker.label}
                      </span>
                    </div>
                  )}
                </div>
              </figure>
            );
          })}
        </div>
      </section>
    </div>
  );
}
