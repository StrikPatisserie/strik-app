"use client";

import { useEffect, useMemo, useState } from "react";

type StallProduct = {
  id: string;
  code: string;
  name: string;
  detail?: string;
  priceCents: number;
  group: "drinken" | "zoet" | "hartig" | "koek";
};

type HoldSlot = {
  id: number;
  entries: string[];
};

const idlePromptDelayMs = 15000;

const products: StallProduct[] = [
  { id: "water", code: "05", name: "Water", priceCents: 250, group: "drinken" },
  { id: "thee", code: "03", name: "Thee", priceCents: 250, group: "drinken" },
  {
    id: "frisdrank",
    code: "04",
    name: "Frisdrank",
    priceCents: 350,
    group: "drinken",
  },
  {
    id: "koffie-xl",
    code: "02",
    name: "Koffie XL",
    priceCents: 300,
    group: "drinken",
  },
  {
    id: "croissant",
    code: "06",
    name: "Croissant",
    priceCents: 250,
    group: "zoet",
  },
  {
    id: "croissant-aardbei",
    code: "01",
    name: "Croissant",
    detail: "aardbei",
    priceCents: 500,
    group: "zoet",
  },
  {
    id: "puddingbroodje",
    code: "09",
    name: "Pudding",
    detail: "broodje",
    priceCents: 350,
    group: "zoet",
  },
  {
    id: "vulkoek",
    code: "10",
    name: "Vulkoek",
    priceCents: 300,
    group: "zoet",
  },
  {
    id: "appelflap",
    code: "11",
    name: "Appelflap",
    priceCents: 350,
    group: "zoet",
  },
  {
    id: "pastel-de-nata",
    code: "16",
    name: "Pastel de nata",
    priceCents: 100,
    group: "zoet",
  },
  {
    id: "pain-au-chocolat",
    code: "13",
    name: "Pain au chocolat",
    priceCents: 300,
    group: "zoet",
  },
  {
    id: "koffiebroodje",
    code: "14",
    name: "Koffiebroodje",
    priceCents: 300,
    group: "zoet",
  },
  {
    id: "kaneelbroodje",
    code: "15",
    name: "Kaneelbroodje",
    priceCents: 350,
    group: "zoet",
  },
  {
    id: "belegde-bol",
    code: "07",
    name: "Belegde bol",
    detail: "kaas of kipfilet",
    priceCents: 350,
    group: "hartig",
  },
  {
    id: "saucijsbroodje",
    code: "17",
    name: "Saucijs",
    detail: "broodje",
    priceCents: 350,
    group: "hartig",
  },
  {
    id: "worstbroodje",
    code: "18",
    name: "Worst",
    detail: "broodje",
    priceCents: 350,
    group: "hartig",
  },
  {
    id: "kaasbroodje",
    code: "19",
    name: "Kaas",
    detail: "broodje",
    priceCents: 350,
    group: "hartig",
  },
  {
    id: "kaasstengel",
    code: "20",
    name: "Stengel",
    detail: "kaas",
    priceCents: 300,
    group: "hartig",
  },
  {
    id: "krentenbol",
    code: "08",
    name: "Krenten",
    detail: "bol",
    priceCents: 150,
    group: "koek",
  },
  {
    id: "spelt-cookie",
    code: "12",
    name: "Spelt",
    detail: "cookie",
    priceCents: 300,
    group: "koek",
  },
  {
    id: "oat-cookie",
    code: "21",
    name: "Oat",
    detail: "cookie",
    priceCents: 300,
    group: "koek",
  },
];

const productById = new Map(products.map((product) => [product.id, product]));
const cashButtons = [5, 10, 20, 50];
function formatEuro(cents: number) {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

function formatCompactEuro(cents: number) {
  return formatEuro(cents).replace(/\s/g, "");
}

function getEntriesTotal(entries: string[]) {
  return entries.reduce((total, productId) => {
    return total + (productById.get(productId)?.priceCents || 0);
  }, 0);
}

function countEntries(entries: string[]) {
  const counts = new Map<string, number>();

  for (const productId of entries) {
    counts.set(productId, (counts.get(productId) || 0) + 1);
  }

  return products
    .map((product) => ({
      product,
      count: counts.get(product.id) || 0,
    }))
    .filter((line) => line.count > 0);
}

function productLabel(product: StallProduct) {
  return product.detail ? `${product.name} ${product.detail}` : product.name;
}

function productGroupClass(group: StallProduct["group"], selected: boolean) {
  if (selected) return "border-[#ef5737] bg-white";

  if (group === "drinken") return "border-[#a9cfe2] bg-[#f2f9fc]";
  if (group === "hartig") return "border-[#b7d0b1] bg-[#f3faee]";
  if (group === "koek") return "border-[#e7bdd0] bg-[#fff4f8]";

  return "border-[#f1d081] bg-[#fff8df]";
}

export default function KraamrekenaarPage() {
  const [entries, setEntries] = useState<string[]>([]);
  const [holdSlots, setHoldSlots] = useState<HoldSlot[]>([
    { id: 1, entries: [] },
    { id: 2, entries: [] },
    { id: 3, entries: [] },
  ]);
  const [cashGivenCents, setCashGivenCents] = useState<number | null>(null);
  const [lastActivityAt, setLastActivityAt] = useState(Date.now());
  const [showIdlePrompt, setShowIdlePrompt] = useState(false);

  const orderLines = useMemo(() => countEntries(entries), [entries]);
  const totalCents = useMemo(() => getEntriesTotal(entries), [entries]);
  const productCounts = useMemo(() => {
    const counts = new Map<string, number>();

    for (const productId of entries) {
      counts.set(productId, (counts.get(productId) || 0) + 1);
    }

    return counts;
  }, [entries]);
  const receiptSummary = useMemo(
    () =>
      orderLines
        .map(({ product, count }) => `${count}x ${productLabel(product)}`)
        .join(" · "),
    [orderLines]
  );
  const canHoldOrder =
    entries.length > 0 && holdSlots.some((slot) => slot.entries.length === 0);
  const changeCents =
    cashGivenCents !== null ? cashGivenCents - totalCents : null;

  function markActivity() {
    setLastActivityAt(Date.now());
    setShowIdlePrompt(false);
  }

  function addProduct(productId: string) {
    markActivity();
    setEntries((currentEntries) => [...currentEntries, productId]);
    setCashGivenCents(null);
  }

  function removeOne(productId: string) {
    markActivity();
    setEntries((currentEntries) => {
      const index = currentEntries.lastIndexOf(productId);

      if (index < 0) return currentEntries;

      return [
        ...currentEntries.slice(0, index),
        ...currentEntries.slice(index + 1),
      ];
    });
    setCashGivenCents(null);
  }

  function undoLast() {
    markActivity();
    setEntries((currentEntries) => currentEntries.slice(0, -1));
    setCashGivenCents(null);
  }

  function clearOrder() {
    markActivity();
    setEntries([]);
    setCashGivenCents(null);
  }

  function holdOrder() {
    if (!entries.length) return;

    markActivity();
    const emptySlot = holdSlots.find((slot) => slot.entries.length === 0);

    if (!emptySlot) return;

    setHoldSlots((currentSlots) =>
      currentSlots.map((slot) =>
        slot.id === emptySlot.id ? { ...slot, entries } : slot
      )
    );
    setEntries([]);
    setCashGivenCents(null);
  }

  function activateHoldSlot(slotId: number) {
    markActivity();
    const selectedSlot = holdSlots.find((slot) => slot.id === slotId);

    if (!selectedSlot) return;

    setHoldSlots((currentSlots) =>
      currentSlots.map((slot) =>
        slot.id === slotId ? { ...slot, entries } : slot
      )
    );
    setEntries(selectedSlot.entries);
    setCashGivenCents(null);
  }

  function chooseCash(amountEuro: number) {
    markActivity();
    setCashGivenCents(amountEuro * 100);
  }

  useEffect(() => {
    if (!entries.length) {
      setShowIdlePrompt(false);
      return;
    }

    const timeout = window.setTimeout(() => {
      if (Date.now() - lastActivityAt >= idlePromptDelayMs) {
        setShowIdlePrompt(true);
      }
    }, idlePromptDelayMs);

    return () => window.clearTimeout(timeout);
  }, [entries.length, lastActivityAt]);

  return (
    <main className="min-h-dvh bg-[#f7f4ed] text-[#161412]">
      <div className="mx-auto flex min-h-dvh w-full max-w-7xl flex-col gap-1.5 px-1.5 py-1.5 tracking-normal sm:gap-2 sm:px-3 sm:py-2">
        <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-1.5 border border-[#d8d0c5] bg-white p-1.5 shadow-sm">
          <div className="min-w-0">
            <h1 className="truncate text-base font-black tracking-normal text-[#161412] sm:text-xl">
              Kraamrekenaar
            </h1>
            <p className="text-[0.6rem] font-black uppercase tracking-normal text-[#6f6558] sm:text-xs">
              {entries.length} stuks
            </p>
          </div>

          <div className="grid min-w-[8.2rem] grid-cols-[auto_1fr] items-center gap-1 bg-[#161412] px-2 py-1 text-white sm:min-w-52 sm:px-3 sm:py-2">
            <span className="text-[0.55rem] font-black uppercase tracking-normal text-white/60 sm:text-xs">
              Totaal
            </span>
            <strong className="text-right font-mono text-2xl font-black tracking-normal sm:text-4xl">
              {formatCompactEuro(totalCents)}
            </strong>
          </div>
        </header>

        <section className="min-h-8 overflow-x-auto border border-[#d8d0c5] bg-white px-1.5 py-1 shadow-sm">
          {orderLines.length ? (
            <div className="flex min-w-max items-center gap-1">
              <span className="max-w-56 truncate px-1 text-[0.62rem] font-black text-[#6f6558] sm:max-w-none sm:text-xs">
                {receiptSummary}
              </span>
              {orderLines.map(({ product, count }) => (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => removeOne(product.id)}
                  className="grid min-h-7 grid-cols-[auto_1.4rem] items-center border border-[#eee7df] bg-[#fbfaf7] pl-2 text-left text-[0.68rem] font-black sm:text-xs"
                  aria-label={`${productLabel(product)} eentje minder`}
                >
                  <span className="max-w-24 truncate">
                    {count}x {productLabel(product)}
                  </span>
                  <span className="flex h-full items-center justify-center bg-[#eee7df] text-sm">
                    -
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <p className="px-1 text-[0.68rem] font-black text-[#6f6558] sm:text-xs">
              Bon leeg
            </p>
          )}
        </section>

        <section className="grid flex-1 grid-cols-3 content-start gap-1 sm:grid-cols-4 lg:grid-cols-7">
          {products.map((product) => {
            const count = productCounts.get(product.id) || 0;

            return (
              <button
                key={product.id}
                type="button"
                onClick={() => addProduct(product.id)}
                className={`relative grid min-h-[3.15rem] content-between border p-1 text-left shadow-sm transition active:scale-[0.98] sm:min-h-[4.25rem] sm:p-1.5 ${productGroupClass(
                  product.group,
                  count > 0
                )}`}
              >
                <span className="flex min-w-0 items-start justify-between gap-1">
                  <span className="text-[0.5rem] font-black leading-none text-[#8b8278] sm:text-[0.62rem]">
                    {product.code}
                  </span>
                  {count > 0 && (
                    <span className="flex h-5 min-w-5 items-center justify-center bg-[#ef5737] px-1 text-xs font-black text-white sm:h-6 sm:min-w-6">
                      {count}
                    </span>
                  )}
                </span>
                <span className="min-w-0">
                  <span className="block break-words text-[0.68rem] font-black uppercase leading-[0.88] tracking-normal text-[#161412] sm:text-sm">
                    {product.name}
                  </span>
                  {product.detail && (
                    <span className="block truncate text-[0.5rem] font-black uppercase leading-none tracking-normal text-[#161412]/65 sm:text-[0.62rem]">
                      {product.detail}
                    </span>
                  )}
                </span>
                <span className="text-base font-black leading-none tracking-normal text-[#161412] sm:text-xl">
                  {formatCompactEuro(product.priceCents)}
                </span>
              </button>
            );
          })}
        </section>

        <section className="grid gap-1 border border-[#d8d0c5] bg-white p-1.5 shadow-sm">
          <div className="grid grid-cols-[1fr_1fr_1.25fr] gap-1">
            <button
              type="button"
              onClick={undoLast}
              disabled={!entries.length}
              className="min-h-9 bg-[#eee7df] px-1 text-[0.68rem] font-black disabled:opacity-45 sm:min-h-11 sm:text-sm"
            >
              Ongedaan
            </button>
            <button
              type="button"
              onClick={holdOrder}
              disabled={!canHoldOrder}
              className="min-h-9 bg-[#f0e3a0] px-1 text-[0.68rem] font-black disabled:opacity-45 sm:min-h-11 sm:text-sm"
            >
              In wacht
            </button>
            <button
              type="button"
              onClick={clearOrder}
              disabled={!entries.length}
              className="min-h-9 bg-[#ef5737] px-1 text-sm font-black text-white disabled:opacity-45 sm:min-h-11 sm:text-base"
            >
              Klaar
            </button>
          </div>

          <div className="grid grid-cols-3 gap-1">
            {holdSlots.map((slot) => {
              const slotTotal = getEntriesTotal(slot.entries);
              const occupied = slot.entries.length > 0;

              return (
                <button
                  key={slot.id}
                  type="button"
                  onClick={() => activateHoldSlot(slot.id)}
                  className={`min-h-8 border px-1 text-[0.66rem] font-black sm:min-h-10 sm:text-sm ${
                    occupied
                      ? "border-[#161412] bg-[#f0e3a0] text-[#161412]"
                      : "border-[#d8d0c5] bg-[#fbfaf7] text-[#6f6558]"
                  }`}
                >
                  W{slot.id} {occupied ? formatCompactEuro(slotTotal) : "vrij"}
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-[repeat(4,minmax(0,1fr))_minmax(0,1.35fr)] gap-1">
            {cashButtons.map((amount) => (
              <button
                key={amount}
                type="button"
                onClick={() => chooseCash(amount)}
                disabled={!totalCents}
                className={`min-h-8 border px-1 text-[0.68rem] font-black disabled:opacity-45 sm:min-h-10 sm:text-sm ${
                  cashGivenCents === amount * 100
                    ? "border-[#161412] bg-[#161412] text-white"
                    : "border-[#d8d0c5] bg-[#fbfaf7]"
                }`}
              >
                €{amount}
              </button>
            ))}
            <div className="grid min-h-8 content-center bg-[#fbfaf7] px-1 text-center sm:min-h-10">
              <span className="text-[0.5rem] font-black uppercase leading-none tracking-normal text-[#6f6558] sm:text-[0.62rem]">
                {changeCents !== null && changeCents < 0 ? "Nog" : "Terug"}
              </span>
              <strong className="font-mono text-sm font-black leading-tight tracking-normal sm:text-lg">
                {changeCents === null
                  ? formatCompactEuro(0)
                  : formatCompactEuro(Math.abs(changeCents))}
              </strong>
            </div>
          </div>

          {showIdlePrompt && (
            <button
              type="button"
              onClick={clearOrder}
              className="min-h-8 border-2 border-[#ef5737] bg-white px-2 text-xs font-black text-[#ef5737] sm:min-h-10 sm:text-sm"
            >
              Nieuwe klant
            </button>
          )}
        </section>
      </div>
    </main>
  );
}
