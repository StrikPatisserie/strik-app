"use client";

import { useMemo, useState } from "react";
import { StrikPageHeader, StrikShell, strikIcons } from "../../../StrikUI";

type HavelaarZone = {
  id: string;
  label: string;
  articleNumber: string;
  location: string;
  max: number;
  x: number;
  y: number;
  w: number;
  h: number;
};

type OrderLine = {
  zoneId: string;
  label: string;
  articleNumber: string;
  location: string;
  quantity: number;
  max: number;
};

const havelaarZones: HavelaarZone[] = [
  {
    id: "gateau-bli01",
    label: "Gateau",
    articleNumber: "18088BLI01",
    location: "Boven links",
    max: 2,
    x: 4.4,
    y: 3.4,
    w: 8.6,
    h: 15.8,
  },
  {
    id: "truffel-bli04",
    label: "Truffel",
    articleNumber: "BLI04",
    location: "Boven links",
    max: 3,
    x: 13.8,
    y: 3.4,
    w: 9.1,
    h: 15.8,
  },
  {
    id: "boterkoek-bli06",
    label: "Boterkoek",
    articleNumber: "BLI06",
    location: "Boven links",
    max: 3,
    x: 23.8,
    y: 3.4,
    w: 9.2,
    h: 15.8,
  },
  {
    id: "macaron-4-bli10",
    label: "Macaron 4",
    articleNumber: "BLI10",
    location: "Boven midden",
    max: 3,
    x: 33.8,
    y: 8.1,
    w: 7.4,
    h: 11.1,
  },
  {
    id: "macaron-6-bli11",
    label: "Macaron 6",
    articleNumber: "BLI11",
    location: "Boven midden",
    max: 1,
    x: 42,
    y: 11.2,
    w: 7.4,
    h: 8,
  },
  {
    id: "pasticceria-bli12",
    label: "Pasticceria",
    articleNumber: "BLI12",
    location: "Boven midden",
    max: 1,
    x: 50,
    y: 11.2,
    w: 7.5,
    h: 8,
  },
  {
    id: "vaandel-bli28",
    label: "Vaandel",
    articleNumber: "BLI28",
    location: "Links midden",
    max: 2,
    x: 4.3,
    y: 23,
    w: 18.8,
    h: 16.4,
  },
  {
    id: "maca-7-bli22",
    label: "Maca 7",
    articleNumber: "BLI22",
    location: "Links midden",
    max: 2,
    x: 23.3,
    y: 27.2,
    w: 9.7,
    h: 12.2,
  },
  {
    id: "19x19x8-limited",
    label: "19x19x8 limited",
    articleNumber: "18088GBD09PCAN",
    location: "Links onder",
    max: 1,
    x: 4.4,
    y: 46.8,
    w: 6.6,
    h: 12.9,
  },
  {
    id: "19x19x8",
    label: "19x19x8",
    articleNumber: "18088GBD08PC",
    location: "Links onder",
    max: 2,
    x: 11.4,
    y: 43.5,
    w: 10.9,
    h: 16.2,
  },
  {
    id: "19x19x5",
    label: "19x19x5",
    articleNumber: "18088GBD13PC",
    location: "Links onder",
    max: 2,
    x: 22.5,
    y: 43.5,
    w: 5.5,
    h: 16.2,
  },
  {
    id: "19x19x12",
    label: "19x19x12",
    articleNumber: "18088GBD15PC",
    location: "Links onder",
    max: 2,
    x: 28.1,
    y: 44,
    w: 4.9,
    h: 15.7,
  },
  {
    id: "plek-midden-1",
    label: "Artikel invullen",
    articleNumber: "HAV-001",
    location: "Middenvak boven",
    max: 7,
    x: 34.4,
    y: 27.3,
    w: 28.5,
    h: 11.7,
  },
  {
    id: "plek-midden-2",
    label: "Artikel invullen",
    articleNumber: "HAV-002",
    location: "Middenvak",
    max: 15,
    x: 34.4,
    y: 42.9,
    w: 28.5,
    h: 10.9,
  },
  {
    id: "plek-rood-boven",
    label: "Artikel invullen",
    articleNumber: "HAV-003",
    location: "Rek rechts boven",
    max: 11,
    x: 63.6,
    y: 23,
    w: 34.2,
    h: 12,
  },
  {
    id: "plek-rood-midden",
    label: "Artikel invullen",
    articleNumber: "HAV-004",
    location: "Rek rechts midden",
    max: 23,
    x: 63.6,
    y: 38.7,
    w: 34.2,
    h: 18.4,
  },
  {
    id: "plek-rood-onder",
    label: "Artikel invullen",
    articleNumber: "HAV-005",
    location: "Rek rechts onder",
    max: 12,
    x: 63.6,
    y: 60.9,
    w: 34.2,
    h: 14.4,
  },
  {
    id: "plek-blauw-onder",
    label: "Artikel invullen",
    articleNumber: "HAV-006",
    location: "Rek links onder",
    max: 8,
    x: 4.3,
    y: 62.9,
    w: 28.8,
    h: 12,
  },
  {
    id: "plek-midden-onder",
    label: "Artikel invullen",
    articleNumber: "HAV-007",
    location: "Rek midden onder",
    max: 10,
    x: 34.4,
    y: 61.1,
    w: 28.5,
    h: 14.2,
  },
];

const shelfFrames = [
  { x: 3.7, y: 19.4, w: 29.9, h: 22.5 },
  { x: 33.4, y: 19.4, w: 29.8, h: 22.5 },
  { x: 63.1, y: 19.4, w: 35.2, h: 18.8 },
  { x: 3.7, y: 41.8, w: 29.9, h: 20.4 },
  { x: 33.4, y: 41.8, w: 29.8, h: 15.7 },
  { x: 63.1, y: 38.3, w: 35.2, h: 21.4 },
  { x: 3.7, y: 62.2, w: 29.9, h: 14.7 },
  { x: 33.4, y: 57.5, w: 29.8, h: 19.4 },
  { x: 63.1, y: 59.6, w: 35.2, h: 17.3 },
];

function createOrderText(lines: OrderLine[]) {
  return lines
    .map(
      (line) =>
        `${line.quantity}x ${line.articleNumber} - ${line.label} (${line.location}, max ${line.max})`
    )
    .join("\n");
}

function clampQuantity(value: number, max: number) {
  if (!Number.isFinite(value)) return 1;
  return Math.max(1, Math.min(max, Math.round(value)));
}

export default function HavelaarPlanner() {
  const [selectedZone, setSelectedZone] = useState<HavelaarZone | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [orderLines, setOrderLines] = useState<OrderLine[]>([]);
  const [copied, setCopied] = useState(false);
  const selectedLine = selectedZone
    ? orderLines.find((line) => line.zoneId === selectedZone.id)
    : null;
  const selectedRemaining = selectedZone
    ? Math.max(0, selectedZone.max - (selectedLine?.quantity || 0))
    : 0;
  const totalQuantity = useMemo(
    () => orderLines.reduce((sum, line) => sum + line.quantity, 0),
    [orderLines]
  );

  function openZone(zone: HavelaarZone) {
    const existing = orderLines.find((line) => line.zoneId === zone.id);
    const remaining = Math.max(0, zone.max - (existing?.quantity || 0));

    setSelectedZone(zone);
    setQuantity(remaining > 0 ? 1 : zone.max);
    setCopied(false);
  }

  function addSelectedZone() {
    if (!selectedZone || selectedRemaining <= 0) return;

    const addQuantity = clampQuantity(quantity, selectedRemaining);
    setOrderLines((current) => {
      const existing = current.find((line) => line.zoneId === selectedZone.id);
      if (existing) {
        return current.map((line) =>
          line.zoneId === selectedZone.id
            ? {
                ...line,
                quantity: Math.min(line.max, line.quantity + addQuantity),
              }
            : line
        );
      }

      return [
        ...current,
        {
          zoneId: selectedZone.id,
          label: selectedZone.label,
          articleNumber: selectedZone.articleNumber,
          location: selectedZone.location,
          quantity: addQuantity,
          max: selectedZone.max,
        },
      ];
    });
    setSelectedZone(null);
  }

  function updateLineQuantity(zoneId: string, nextQuantity: number) {
    setOrderLines((current) =>
      current
        .map((line) =>
          line.zoneId === zoneId
            ? {
                ...line,
                quantity: clampQuantity(nextQuantity, line.max),
              }
            : line
        )
        .filter((line) => line.quantity > 0)
    );
    setCopied(false);
  }

  async function copyOrderList() {
    if (!orderLines.length) return;

    await navigator.clipboard.writeText(createOrderText(orderLines));
    setCopied(true);
  }

  return (
    <StrikShell wide>
      <StrikPageHeader
        title="Havelaar"
        icon={strikIcons.logistiek}
        kicker="Logistiek"
        description="Verpakkingen en bestellijst."
      />

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <section className="overflow-hidden border border-[#d8d3ca] bg-white shadow-sm">
          <div className="flex items-center justify-between gap-2 border-b border-[#e8e4de] bg-[#f8f6f3] px-3 py-2">
            <h2 className="text-sm font-black uppercase tracking-normal text-[#4f4942]">
              Magazijnkaart
            </h2>
            <span className="rounded-full bg-[#1f4f35] px-2.5 py-1 text-xs font-black text-white">
              {havelaarZones.length} plekken
            </span>
          </div>

          <div className="overflow-x-auto p-2 sm:p-3">
            <div
              className="relative min-w-[920px] overflow-hidden bg-white"
              style={{ aspectRatio: "1414 / 996" }}
            >
              {shelfFrames.map((frame) => (
                <div
                  key={`${frame.x}-${frame.y}`}
                  className="absolute border-[7px] border-black bg-white"
                  style={{
                    left: `${frame.x}%`,
                    top: `${frame.y}%`,
                    width: `${frame.w}%`,
                    height: `${frame.h}%`,
                  }}
                />
              ))}

              {havelaarZones.map((zone) => {
                const line = orderLines.find((item) => item.zoneId === zone.id);
                const isFull = (line?.quantity || 0) >= zone.max;

                return (
                  <button
                    key={zone.id}
                    type="button"
                    onClick={() => openZone(zone)}
                    className={`absolute flex flex-col items-center justify-center border border-white/85 px-1 text-center shadow-sm outline-none transition hover:z-20 hover:scale-[1.02] hover:ring-2 hover:ring-[#ef5737] focus-visible:z-20 focus-visible:ring-2 focus-visible:ring-[#ef5737] ${
                      isFull
                        ? "bg-[#b9c9b3] text-[#1f4f35]"
                        : "bg-[#d8d8d8] text-[#111]"
                    }`}
                    style={{
                      left: `${zone.x}%`,
                      top: `${zone.y}%`,
                      width: `${zone.w}%`,
                      height: `${zone.h}%`,
                    }}
                    title={`${zone.label} ${zone.articleNumber}`}
                  >
                    <span className="max-w-full text-[clamp(0.55rem,0.95vw,0.9rem)] font-black uppercase leading-none">
                      {zone.label}
                    </span>
                    <span className="mt-1 max-w-full text-[clamp(0.48rem,0.82vw,0.72rem)] font-bold leading-none">
                      {zone.articleNumber}
                    </span>
                    <span className="absolute right-1 top-1 rounded-full bg-white/90 px-1.5 py-0.5 text-[0.58rem] font-black text-[#4f4942]">
                      {line?.quantity || 0}/{zone.max}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        <aside className="border border-[#d8d3ca] bg-white shadow-sm">
          <div className="flex items-center justify-between gap-2 border-b border-[#e8e4de] bg-[#f8f6f3] px-3 py-2">
            <h2 className="text-sm font-black uppercase tracking-normal text-[#4f4942]">
              Bestellijst
            </h2>
            <span className="rounded-full bg-[#ef5737] px-2.5 py-1 text-xs font-black text-white">
              {totalQuantity}
            </span>
          </div>

          <div className="space-y-2 p-3">
            {orderLines.length === 0 ? (
              <p className="border border-dashed border-[#d8d3ca] bg-[#faf8f5] p-3 text-sm font-bold text-[#7b7268]">
                Nog niets toegevoegd.
              </p>
            ) : (
              orderLines.map((line) => (
                <div
                  key={line.zoneId}
                  className="border border-[#e8e4de] bg-[#faf8f5] p-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-[#1a1815]">
                        {line.label}
                      </p>
                      <p className="text-xs font-bold text-[#6b645b]">
                        {line.articleNumber} · max {line.max}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setOrderLines((current) =>
                          current.filter((item) => item.zoneId !== line.zoneId)
                        )
                      }
                      className="h-8 w-8 border border-[#e8d3cf] bg-white text-sm font-black text-[#bf3d26]"
                      aria-label={`${line.label} verwijderen`}
                    >
                      x
                    </button>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        updateLineQuantity(line.zoneId, line.quantity - 1)
                      }
                      className="h-8 w-8 border border-[#d8d3ca] bg-white text-lg font-black"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      min={1}
                      max={line.max}
                      value={line.quantity}
                      onChange={(event) =>
                        updateLineQuantity(
                          line.zoneId,
                          Number(event.target.value)
                        )
                      }
                      className="h-8 w-16 border border-[#d8d3ca] bg-white text-center text-sm font-black outline-none focus:border-[#1f4f35]"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        updateLineQuantity(line.zoneId, line.quantity + 1)
                      }
                      className="h-8 w-8 border border-[#d8d3ca] bg-white text-lg font-black"
                    >
                      +
                    </button>
                  </div>
                </div>
              ))
            )}

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={copyOrderList}
                disabled={!orderLines.length}
                className="h-10 border border-[#1f4f35] bg-[#1f4f35] text-sm font-black text-white disabled:cursor-not-allowed disabled:border-[#d8d3ca] disabled:bg-[#d8d3ca]"
              >
                {copied ? "Gekopieerd" : "Kopieer"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setOrderLines([]);
                  setCopied(false);
                }}
                disabled={!orderLines.length}
                className="h-10 border border-[#d8d3ca] bg-white text-sm font-black text-[#4f4942] disabled:cursor-not-allowed disabled:text-[#b5afa6]"
              >
                Leegmaken
              </button>
            </div>
          </div>
        </aside>
      </div>

      {selectedZone && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-sm border border-[#d8d3ca] bg-white p-4 shadow-xl">
            <p className="text-xs font-black uppercase tracking-normal text-[#7b7268]">
              {selectedZone.location}
            </p>
            <h2 className="mt-1 text-2xl font-black leading-tight text-[#1a1815]">
              {selectedZone.label}
            </h2>
            <p className="mt-1 text-sm font-bold text-[#5f574f]">
              Artikel {selectedZone.articleNumber}
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="border border-[#e8e4de] bg-[#faf8f5] p-2">
                <p className="text-[0.65rem] font-black uppercase text-[#7b7268]">
                  Max op plek
                </p>
                <p className="text-xl font-black">{selectedZone.max}</p>
              </div>
              <div className="border border-[#e8e4de] bg-[#faf8f5] p-2">
                <p className="text-[0.65rem] font-black uppercase text-[#7b7268]">
                  Op lijst
                </p>
                <p className="text-xl font-black">
                  {selectedLine?.quantity || 0}
                </p>
              </div>
            </div>

            <p className="mt-4 text-base font-black text-[#1a1815]">
              Artikel toevoegen aan je bestellijst?
            </p>

            {selectedRemaining > 0 ? (
              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setQuantity((current) =>
                      clampQuantity(current - 1, selectedRemaining)
                    )
                  }
                  className="h-10 w-10 border border-[#d8d3ca] bg-white text-lg font-black"
                >
                  -
                </button>
                <input
                  type="number"
                  min={1}
                  max={selectedRemaining}
                  value={quantity}
                  onChange={(event) =>
                    setQuantity(
                      clampQuantity(Number(event.target.value), selectedRemaining)
                    )
                  }
                  className="h-10 w-20 border border-[#d8d3ca] bg-white text-center text-sm font-black outline-none focus:border-[#1f4f35]"
                />
                <button
                  type="button"
                  onClick={() =>
                    setQuantity((current) =>
                      clampQuantity(current + 1, selectedRemaining)
                    )
                  }
                  className="h-10 w-10 border border-[#d8d3ca] bg-white text-lg font-black"
                >
                  +
                </button>
                <span className="text-xs font-bold text-[#7b7268]">
                  nog {selectedRemaining}
                </span>
              </div>
            ) : (
              <p className="mt-3 border border-[#c8dbc2] bg-[#f3faf0] p-2 text-sm font-bold text-[#275d35]">
                Maximum bereikt.
              </p>
            )}

            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setSelectedZone(null)}
                className="h-11 border border-[#d8d3ca] bg-white text-sm font-black text-[#4f4942]"
              >
                Annuleer
              </button>
              <button
                type="button"
                onClick={addSelectedZone}
                disabled={selectedRemaining <= 0}
                className="h-11 border border-[#1f4f35] bg-[#1f4f35] text-sm font-black text-white disabled:cursor-not-allowed disabled:border-[#d8d3ca] disabled:bg-[#d8d3ca]"
              >
                Toevoegen
              </button>
            </div>
          </div>
        </div>
      )}
    </StrikShell>
  );
}
