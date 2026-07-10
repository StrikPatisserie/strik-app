"use client";

import Image from "next/image";
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
const groupLabels: Record<StallProduct["group"], string> = {
  drinken: "Drinken",
  zoet: "Zoet",
  hartig: "Hartig",
  koek: "Koek",
};
const groupOrder: StallProduct["group"][] = ["drinken", "zoet", "hartig", "koek"];

function formatEuro(cents: number) {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
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
  const groupedProducts = useMemo(
    () =>
      groupOrder.map((group) => ({
        group,
        products: products.filter((product) => product.group === group),
      })),
    []
  );
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
      <div className="mx-auto flex min-h-dvh w-full max-w-7xl flex-col gap-3 px-3 py-3 tracking-normal sm:px-4">
        <header className="grid gap-2 border border-[#d8d0c5] bg-white p-3 shadow-sm lg:grid-cols-[1fr_22rem]">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center bg-[#f0e3a0]">
              <Image
                src="/strik-logo.png"
                alt=""
                width={36}
                height={36}
                className="h-9 w-9 object-contain"
                priority
              />
            </span>
            <div className="min-w-0">
              <h1 className="text-2xl font-black tracking-normal text-[#161412] sm:text-3xl">
                Kraamrekenaar
              </h1>
              <p className="text-xs font-black uppercase tracking-normal text-[#6f6558]">
                Vierdaagse
              </p>
            </div>
          </div>

          <div className="grid grid-cols-[1fr_auto] items-center gap-2 bg-[#161412] px-3 py-2 text-white">
            <span className="text-xs font-black uppercase tracking-normal text-white/60">
              Totaal
            </span>
            <strong className="font-mono text-4xl font-black tracking-normal sm:text-5xl">
              {formatEuro(totalCents)}
            </strong>
          </div>
        </header>

        <section className="grid gap-3 lg:grid-cols-[1fr_24rem]">
          <div className="grid gap-3">
            {groupedProducts.map(({ group, products: groupProducts }) => (
              <div key={group} className="grid gap-2">
                <h2 className="text-sm font-black uppercase tracking-normal text-[#6f6558]">
                  {groupLabels[group]}
                </h2>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
                  {groupProducts.map((product) => {
                    const count = productCounts.get(product.id) || 0;

                    return (
                      <button
                        key={product.id}
                        type="button"
                        onClick={() => addProduct(product.id)}
                        className={`relative grid min-h-28 content-between border-2 bg-white p-2 text-left shadow-sm transition active:scale-[0.98] ${
                          count
                            ? "border-[#ef5737]"
                            : "border-[#d8d0c5] hover:border-[#968a7d]"
                        }`}
                      >
                        <span className="flex items-start justify-between gap-2">
                          <span className="text-xs font-black text-[#8b8278]">
                            {product.code}
                          </span>
                          {count > 0 && (
                            <span className="flex h-8 min-w-8 items-center justify-center bg-[#ef5737] px-2 text-lg font-black text-white">
                              {count}
                            </span>
                          )}
                        </span>
                        <span>
                          <span className="block text-xl font-black uppercase leading-none tracking-normal text-[#161412] sm:text-2xl">
                            {product.name}
                          </span>
                          {product.detail && (
                            <span className="mt-1 block text-xs font-black uppercase leading-none tracking-normal text-[#161412]/70">
                              {product.detail}
                            </span>
                          )}
                        </span>
                        <span className="text-2xl font-black tracking-normal text-[#161412]">
                          {formatEuro(product.priceCents)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <aside className="grid content-start gap-3">
            <section className="border border-[#d8d0c5] bg-white p-3 shadow-sm">
              <div className="flex items-end justify-between gap-2">
                <h2 className="text-base font-black tracking-normal">
                  Bonnetje
                </h2>
                <span className="text-sm font-black text-[#6f6558]">
                  {entries.length} stuks
                </span>
              </div>

              <div className="mt-3 grid gap-1.5">
                {orderLines.length ? (
                  orderLines.map(({ product, count }) => (
                    <div
                      key={product.id}
                      className="grid grid-cols-[2.3rem_1fr_auto] items-center gap-2 border border-[#eee7df] bg-[#fbfaf7] px-2 py-2"
                    >
                      <span className="text-xl font-black">{count}x</span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-black">
                          {productLabel(product)}
                        </span>
                        <span className="block text-xs font-bold text-[#6f6558]">
                          {formatEuro(product.priceCents)}
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={() => removeOne(product.id)}
                        className="h-10 w-10 bg-[#eee7df] text-xl font-black"
                        aria-label={`${productLabel(product)} eentje minder`}
                      >
                        -
                      </button>
                    </div>
                  ))
                ) : (
                  <p className="bg-[#fbfaf7] px-3 py-6 text-center text-sm font-black text-[#6f6558]">
                    €0,00
                  </p>
                )}
              </div>
            </section>

            <section className="grid gap-2 border border-[#d8d0c5] bg-white p-3 shadow-sm">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={undoLast}
                  disabled={!entries.length}
                  className="min-h-12 bg-[#eee7df] px-3 text-sm font-black disabled:opacity-45"
                >
                  Ongedaan
                </button>
                <button
                  type="button"
                  onClick={holdOrder}
                  disabled={!entries.length}
                  className="min-h-12 bg-[#f0e3a0] px-3 text-sm font-black disabled:opacity-45"
                >
                  In wacht
                </button>
              </div>
              <button
                type="button"
                onClick={clearOrder}
                disabled={!entries.length}
                className="min-h-14 bg-[#ef5737] px-3 text-lg font-black text-white disabled:opacity-45"
              >
                Klaar
              </button>

              {showIdlePrompt && (
                <button
                  type="button"
                  onClick={clearOrder}
                  className="min-h-12 border-2 border-[#ef5737] bg-white px-3 text-sm font-black text-[#ef5737]"
                >
                  Nieuwe klant
                </button>
              )}
            </section>

            <section className="border border-[#d8d0c5] bg-white p-3 shadow-sm">
              <h2 className="text-base font-black tracking-normal">
                Wisselgeld
              </h2>
              <div className="mt-2 grid grid-cols-4 gap-2">
                {cashButtons.map((amount) => (
                  <button
                    key={amount}
                    type="button"
                    onClick={() => chooseCash(amount)}
                    disabled={!totalCents}
                    className={`min-h-12 border px-2 text-sm font-black disabled:opacity-45 ${
                      cashGivenCents === amount * 100
                        ? "border-[#161412] bg-[#161412] text-white"
                        : "border-[#d8d0c5] bg-[#fbfaf7]"
                    }`}
                  >
                    €{amount}
                  </button>
                ))}
              </div>
              <div className="mt-2 bg-[#fbfaf7] px-3 py-3 text-center">
                <span className="block text-xs font-black uppercase tracking-normal text-[#6f6558]">
                  {changeCents !== null && changeCents < 0
                    ? "Nog"
                    : "Terug"}
                </span>
                <strong className="font-mono text-3xl font-black tracking-normal">
                  {changeCents === null
                    ? formatEuro(0)
                    : formatEuro(Math.abs(changeCents))}
                </strong>
              </div>
            </section>

            <section className="border border-[#d8d0c5] bg-white p-3 shadow-sm">
              <h2 className="text-base font-black tracking-normal">Wacht</h2>
              <div className="mt-2 grid gap-2">
                {holdSlots.map((slot) => {
                  const slotTotal = getEntriesTotal(slot.entries);
                  const occupied = slot.entries.length > 0;

                  return (
                    <button
                      key={slot.id}
                      type="button"
                      onClick={() => activateHoldSlot(slot.id)}
                      className={`grid min-h-12 grid-cols-[3rem_1fr] items-center border px-2 text-left ${
                        occupied
                          ? "border-[#161412] bg-[#f0e3a0]"
                          : "border-[#d8d0c5] bg-[#fbfaf7] text-[#6f6558]"
                      }`}
                    >
                      <span className="text-sm font-black">W{slot.id}</span>
                      <span className="text-lg font-black">
                        {occupied ? formatEuro(slotTotal) : "Vrij"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          </aside>
        </section>
      </div>
    </main>
  );
}
