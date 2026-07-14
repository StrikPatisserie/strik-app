"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createOrder } from "../orderStore";
import {
  ProductCategoryId,
  VierdaagseProduct,
  VierdaagseTable,
  categoryLabels,
  getLocationLabel,
  productCategories,
  vierdaagseProducts,
  vierdaagseTables,
} from "../vierdaagseData";

type DraftLine = {
  key: string;
  productId: string;
  name: string;
  category: ProductCategoryId;
  quantity: number;
  detail?: string;
};

type DestinationMode = "table" | "custom";

const tableGroups: Array<{ title: string; tables: VierdaagseTable[] }> = [
  {
    title: "Terras",
    tables: vierdaagseTables.filter((table) => table.location === "terras"),
  },
  {
    title: "Binnen",
    tables: vierdaagseTables.filter((table) => table.location === "binnen"),
  },
];

function formatClock(date: Date) {
  return new Intl.DateTimeFormat("nl-NL", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function lineLabel(line: Pick<DraftLine, "name" | "detail">) {
  return line.detail ? `${line.name} - ${line.detail}` : line.name;
}

function createDraftKey(productId: string, detail = "") {
  return `${productId}::${detail.trim().toLowerCase()}`;
}

function getCustomDestination(value: string) {
  return value.trim() || "To go";
}

export default function VierdaagseKassaPage() {
  const [selectedTable, setSelectedTable] = useState<VierdaagseTable | null>(
    null
  );
  const [destinationMode, setDestinationMode] =
    useState<DestinationMode>("table");
  const [customDestination, setCustomDestination] = useState("To go");
  const [activeCategory, setActiveCategory] =
    useState<ProductCategoryId>("koffie-thee");
  const [draftLines, setDraftLines] = useState<DraftLine[]>([]);
  const [note, setNote] = useState("");
  const [detailProduct, setDetailProduct] =
    useState<VierdaagseProduct | null>(null);
  const [customDetail, setCustomDetail] = useState("");
  const [clock, setClock] = useState(() => new Date());
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const interval = window.setInterval(() => setClock(new Date()), 15000);
    return () => window.clearInterval(interval);
  }, []);

  const productsInCategory = useMemo(
    () =>
      vierdaagseProducts.filter(
        (product) => product.category === activeCategory
      ),
    [activeCategory]
  );

  const totalItems = useMemo(
    () => draftLines.reduce((total, line) => total + line.quantity, 0),
    [draftLines]
  );

  function getProductCount(productId: string) {
    return draftLines
      .filter((line) => line.productId === productId)
      .reduce((total, line) => total + line.quantity, 0);
  }

  function addProduct(product: VierdaagseProduct, detail = "") {
    const cleanDetail = detail.trim();
    const key = createDraftKey(product.id, cleanDetail);

    setError("");
    setMessage("");
    setDraftLines((currentLines) => {
      const existingLine = currentLines.find((line) => line.key === key);

      if (existingLine) {
        return currentLines.map((line) =>
          line.key === key ? { ...line, quantity: line.quantity + 1 } : line
        );
      }

      return [
        ...currentLines,
        {
          key,
          productId: product.id,
          name: product.name,
          category: product.category,
          quantity: 1,
          detail: cleanDetail || undefined,
        },
      ];
    });
  }

  function handleProductAdd(product: VierdaagseProduct) {
    if (product.needsDetail) {
      setDetailProduct(product);
      setCustomDetail("");
      return;
    }

    addProduct(product);
  }

  function removeOneProduct(productId: string) {
    setDraftLines((currentLines) => {
      let lineIndex = -1;

      for (let index = currentLines.length - 1; index >= 0; index -= 1) {
        if (currentLines[index].productId === productId) {
          lineIndex = index;
          break;
        }
      }

      if (lineIndex === -1) return currentLines;

      const line = currentLines[lineIndex];
      if (line.quantity > 1) {
        return currentLines.map((currentLine, index) =>
          index === lineIndex
            ? { ...currentLine, quantity: currentLine.quantity - 1 }
            : currentLine
        );
      }

      return currentLines.filter((_, index) => index !== lineIndex);
    });
  }

  function removeDraftLine(lineKey: string) {
    setDraftLines((currentLines) =>
      currentLines.filter((line) => line.key !== lineKey)
    );
  }

  function clearDraft() {
    setSelectedTable(null);
    setDestinationMode("table");
    setCustomDestination("To go");
    setDraftLines([]);
    setNote("");
    setDetailProduct(null);
    setCustomDetail("");
    setError("");
  }

  async function submitOrder() {
    if (isSubmitting) return;

    if (destinationMode === "table" && !selectedTable) {
      setError("Kies eerst een tafel of gebruik Geen tafel / To go.");
      return;
    }

    if (destinationMode === "custom" && !customDestination.trim()) {
      setError("Vul een omschrijving in, bijvoorbeeld To go.");
      return;
    }

    if (!draftLines.length) {
      setError("Voeg minimaal een product toe.");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const tableNumber =
        destinationMode === "table" && selectedTable
          ? selectedTable.label
          : getCustomDestination(customDestination);
      const location =
        destinationMode === "table" && selectedTable
          ? selectedTable.location
          : "geen_tafel";
      const order = await createOrder({
        tableNumber,
        location,
        items: draftLines.map(({ key: _key, ...line }) => line),
        note,
      });

      clearDraft();
      setMessage(`Bestelling voor ${order.tableNumber} is verstuurd`);
    } catch {
      setError("Opslaan is mislukt. De bestelling staat nog in beeld.");
    } finally {
      window.setTimeout(() => setIsSubmitting(false), 900);
    }
  }

  const selectedDestinationLabel =
    destinationMode === "table" && selectedTable
      ? `${selectedTable.label} · ${getLocationLabel(selectedTable.location)}`
      : destinationMode === "custom"
        ? `${getCustomDestination(customDestination)} · Geen tafel`
        : "Nog geen tafel";

  return (
    <main className="min-h-screen bg-[#faf8f5] px-3 py-3 pb-24 text-[#1a1815] md:pb-6 lg:px-5">
      <div className="mx-auto grid max-w-7xl gap-3">
        <header className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#d6e5d8] bg-white p-3 shadow-sm">
          <div className="min-w-0">
            <p className="text-[0.68rem] font-black uppercase tracking-normal text-[#ef7d0a]">
              Vierdaagse kassa
            </p>
            <h1 className="text-xl font-black leading-tight text-[#24551d]">
              Nieuwe bestelling
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-[#ecf4ed] px-3 py-2 text-lg font-black text-[#24551d]">
              {formatClock(clock)}
            </span>
            <Link
              href="/vierdaagse/kassa-tool"
              className="rounded-md border border-[#ef7d0a] bg-white px-3 py-2 text-sm font-black text-[#9d3c24] transition active:scale-[0.98]"
            >
              Terug
            </Link>
          </div>
        </header>

        {(message || error) && (
          <div
            className={`rounded-lg border px-3 py-2 text-sm font-bold ${
              error
                ? "border-[#f0b4a8] bg-[#fff4f2] text-[#9d2f20]"
                : "border-[#c8dfc3] bg-[#f2faef] text-[#24551d]"
            }`}
          >
            {error || message}
          </div>
        )}

        <div className="grid gap-3 xl:grid-cols-[minmax(0,1.55fr)_minmax(21rem,0.75fr)]">
          <div className="grid gap-3">
            <section className="rounded-lg border border-[#e8e4de] bg-white p-3 shadow-sm">
              <h2 className="mb-2 text-sm font-black uppercase tracking-normal text-[#24551d]">
                Stap 1 · tafel
              </h2>
              <div className="grid gap-3 md:grid-cols-[0.85fr_1.15fr]">
                {tableGroups.map((group) => (
                  <div key={group.title} className="grid gap-2">
                    <p className="text-xs font-black uppercase tracking-normal text-[#ef7d0a]">
                      {group.title}
                    </p>
                    <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
                      {group.tables.map((table) => {
                        const selected = selectedTable?.id === table.id;

                        return (
                          <button
                            key={table.id}
                            type="button"
                            onClick={() => {
                              setDestinationMode("table");
                              setSelectedTable(table);
                            }}
                            className={`min-h-11 rounded-md border text-base font-black transition active:scale-[0.98] ${
                              selected && destinationMode === "table"
                                ? "border-[#24551d] bg-[#24551d] text-white"
                                : "border-[#d6e5d8] bg-[#f6faf4] text-[#24551d]"
                            }`}
                          >
                            {table.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-3 grid gap-2 rounded-lg border border-[#e8e4de] bg-[#faf8f5] p-2 sm:grid-cols-[auto_1fr] sm:items-center">
                <button
                  type="button"
                  onClick={() => {
                    setDestinationMode("custom");
                    setSelectedTable(null);
                  }}
                  className={`min-h-11 rounded-md border px-3 text-sm font-black transition active:scale-[0.98] ${
                    destinationMode === "custom"
                      ? "border-[#ef7d0a] bg-[#ef7d0a] text-white"
                      : "border-[#d8d0c5] bg-white text-[#24551d]"
                  }`}
                >
                  Geen tafel / To go
                </button>
                <input
                  value={customDestination}
                  onFocus={() => {
                    setDestinationMode("custom");
                    setSelectedTable(null);
                  }}
                  onChange={(event) => setCustomDestination(event.target.value)}
                  placeholder="Bijv. To go, naam klant, afhalen"
                  className="min-h-11 rounded-md border border-[#d8d0c5] bg-white px-3 text-sm font-semibold outline-none focus:border-[#24551d]"
                />
              </div>
            </section>

            <section className="rounded-lg border border-[#e8e4de] bg-white p-3 shadow-sm">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-black uppercase tracking-normal text-[#24551d]">
                  Stap 2 · producten
                </h2>
                <span className="text-xs font-bold text-[#6b645b]">
                  {totalItems} producten
                </span>
              </div>

              <div className="mb-3 grid grid-cols-2 gap-1.5 md:grid-cols-5">
                {productCategories.map((category) => {
                  const active = category.id === activeCategory;

                  return (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() => setActiveCategory(category.id)}
                      className={`min-h-11 rounded-md border px-2 text-sm font-black transition active:scale-[0.98] ${
                        active
                          ? "border-[#ef7d0a] bg-[#ef7d0a] text-white"
                          : "border-[#e8e4de] bg-[#faf8f5] text-[#24551d]"
                      }`}
                    >
                      {category.shortLabel}
                    </button>
                  );
                })}
              </div>

              {detailProduct && (
                <div className="mb-3 rounded-lg border border-[#ef7d0a] bg-[#fff8ef] p-2">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-black text-[#24551d]">
                      {detailProduct.detailLabel || "Specificatie"}
                    </p>
                    <button
                      type="button"
                      onClick={() => setDetailProduct(null)}
                      className="min-h-9 rounded-md border border-[#d8d0c5] bg-white px-3 text-xs font-black text-[#6b645b]"
                    >
                      Sluit
                    </button>
                  </div>
                  <div className="grid gap-1.5 sm:grid-cols-3">
                    {detailProduct.detailOptions?.map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => {
                          addProduct(detailProduct, option);
                          setDetailProduct(null);
                        }}
                        className="min-h-11 rounded-md bg-[#24551d] px-2 text-sm font-black text-white transition active:scale-[0.98]"
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                  <div className="mt-2 grid gap-1.5 sm:grid-cols-[1fr_auto]">
                    <input
                      value={customDetail}
                      onChange={(event) => setCustomDetail(event.target.value)}
                      placeholder="Andere smaak of naam"
                      className="min-h-11 rounded-md border border-[#d8d0c5] bg-white px-3 text-sm font-semibold outline-none focus:border-[#24551d]"
                    />
                    <button
                      type="button"
                      disabled={!customDetail.trim()}
                      onClick={() => {
                        if (!customDetail.trim()) return;
                        addProduct(detailProduct, customDetail);
                        setDetailProduct(null);
                        setCustomDetail("");
                      }}
                      className="min-h-11 rounded-md bg-[#ef7d0a] px-4 text-sm font-black text-white disabled:opacity-45"
                    >
                      Voeg toe
                    </button>
                  </div>
                </div>
              )}

              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {productsInCategory.map((product) => {
                  const count = getProductCount(product.id);

                  return (
                    <div
                      key={product.id}
                      className="grid min-h-24 grid-cols-[minmax(0,1fr)_2.7rem] gap-2 rounded-lg border border-[#d6e5d8] bg-[#f6faf4] p-2"
                    >
                      <button
                        type="button"
                        onClick={() => handleProductAdd(product)}
                        className="min-w-0 text-left active:scale-[0.99]"
                      >
                        <span className="mb-2 inline-flex h-7 min-w-8 items-center justify-center rounded-md bg-white px-2 text-xs font-black text-[#ef7d0a]">
                          {product.badge}
                        </span>
                        <span className="block text-sm font-black leading-tight text-[#1a1815]">
                          {product.name}
                        </span>
                        <span className="mt-1 block text-[0.68rem] font-bold uppercase text-[#6b645b]">
                          {categoryLabels[product.category]}
                        </span>
                      </button>
                      <div className="grid gap-1">
                        <button
                          type="button"
                          onClick={() => handleProductAdd(product)}
                          className="flex min-h-10 items-center justify-center rounded-md bg-[#ef7d0a] text-xl font-black text-white active:scale-[0.98]"
                          aria-label={`${product.name} toevoegen`}
                        >
                          +
                        </button>
                        <span className="flex min-h-8 items-center justify-center rounded-md bg-white text-base font-black text-[#24551d]">
                          {count}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeOneProduct(product.id)}
                          disabled={count === 0}
                          className="flex min-h-10 items-center justify-center rounded-md bg-[#24551d] text-xl font-black text-white disabled:opacity-35 active:scale-[0.98]"
                          aria-label={`${product.name} verwijderen`}
                        >
                          -
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>

          <aside className="rounded-lg border border-[#d6e5d8] bg-white p-3 shadow-sm xl:sticky xl:top-3 xl:self-start">
            <h2 className="text-sm font-black uppercase tracking-normal text-[#24551d]">
              Stap 3 · controle
            </h2>
            <div className="mt-3 grid gap-3">
              <div className="rounded-lg bg-[#f6faf4] p-3">
                <p className="text-[0.68rem] font-black uppercase text-[#ef7d0a]">
                  Tafel
                </p>
                <p className="text-2xl font-black text-[#24551d]">
                  {selectedDestinationLabel}
                </p>
              </div>

              <div className="grid gap-1.5">
                {draftLines.length ? (
                  draftLines.map((line) => (
                    <div
                      key={line.key}
                      className="grid grid-cols-[2.2rem_minmax(0,1fr)_2.4rem] items-center gap-2 rounded-md border border-[#e8e4de] bg-[#faf8f5] px-2 py-2"
                    >
                      <span className="text-sm font-black text-[#ef7d0a]">
                        {line.quantity}x
                      </span>
                      <span className="min-w-0 truncate text-sm font-bold text-[#1a1815]">
                        {lineLabel(line)}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeDraftLine(line.key)}
                        className="min-h-9 rounded-md bg-white text-sm font-black text-[#c8382d]"
                        aria-label={`${lineLabel(line)} verwijderen`}
                      >
                        weg
                      </button>
                    </div>
                  ))
                ) : (
                  <p className="rounded-lg border border-dashed border-[#d8d0c5] px-3 py-4 text-sm font-semibold text-[#8b8278]">
                    Nog geen producten.
                  </p>
                )}
              </div>

              <label className="grid gap-1 text-xs font-black uppercase text-[#6b645b]">
                Notitie
                <textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  rows={3}
                  className="min-h-20 rounded-md border border-[#d8d0c5] bg-white px-3 py-2 text-sm font-semibold normal-case text-[#1a1815] outline-none focus:border-[#24551d]"
                  placeholder="Bijvoorbeeld zonder cacao, eerst koffie..."
                />
              </label>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={clearDraft}
                  className="min-h-12 rounded-md border border-[#d8d0c5] bg-white px-3 text-sm font-black text-[#6b645b] active:scale-[0.98]"
                >
                  Leegmaken
                </button>
                <button
                  type="button"
                  onClick={submitOrder}
                  disabled={isSubmitting}
                  className="min-h-12 rounded-md bg-[#24551d] px-3 text-sm font-black text-white disabled:opacity-50 active:scale-[0.98]"
                >
                  Bestelling versturen
                </button>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
