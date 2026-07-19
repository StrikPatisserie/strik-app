"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { createOrder } from "../orderStore";
import {
  fetchVierdaagseProductsFromWordPress,
  getStoredVierdaagseProducts,
  saveVierdaagseProductsToWordPress,
} from "../productStore";
import {
  ProductCategoryId,
  VierdaagseProduct,
  VierdaagseTable,
  categoryLabels,
  getLocationLabel,
  productCategories,
  sortVierdaagseProducts,
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

type ProductDraft = {
  name: string;
  badge: string;
  category: ProductCategoryId;
};

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

function emptyProductDraft(category: ProductCategoryId): ProductDraft {
  return {
    name: "",
    badge: "",
    category,
  };
}

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

function slugifyProductName(value: string) {
  return (
    value
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "product"
  );
}

function badgeFromProductName(value: string) {
  const parts = value
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const badge = parts
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return badge || "P";
}

function uniqueProductId(name: string, products: VierdaagseProduct[]) {
  const baseId = slugifyProductName(name);
  const usedIds = new Set(products.map((product) => product.id));
  let nextId = baseId;
  let index = 2;

  while (usedIds.has(nextId)) {
    nextId = `${baseId}-${index}`;
    index += 1;
  }

  return nextId;
}

function detailOptionsForProduct(product?: VierdaagseProduct) {
  return product?.modifierOptions?.length
    ? product.modifierOptions
    : product?.detailOptions || [];
}

function moveOneDraftLineToDetail(
  lines: DraftLine[],
  lineKey: string,
  detail: string
) {
  const cleanDetail = detail.trim();
  const sourceIndex = lines.findIndex((line) => line.key === lineKey);
  if (sourceIndex < 0) return lines;

  const sourceLine = lines[sourceIndex];
  const nextKey = createDraftKey(sourceLine.productId, cleanDetail);
  if (nextKey === sourceLine.key) {
    return lines.map((line, index) =>
      index === sourceIndex
        ? { ...line, detail: cleanDetail || undefined }
        : line
    );
  }

  const nextLine: DraftLine = {
    ...sourceLine,
    key: nextKey,
    quantity: 1,
    detail: cleanDetail || undefined,
  };
  const targetIndex = lines.findIndex((line) => line.key === nextKey);

  if (sourceLine.quantity <= 1) {
    if (targetIndex >= 0) {
      return lines.reduce<DraftLine[]>((nextLines, line, index) => {
        if (index === sourceIndex) return nextLines;
        nextLines.push(
          index === targetIndex ? { ...line, quantity: line.quantity + 1 } : line
        );
        return nextLines;
      }, []);
    }

    return lines.map((line, index) => (index === sourceIndex ? nextLine : line));
  }

  const nextLines: DraftLine[] = [];
  lines.forEach((line, index) => {
    if (index === sourceIndex) {
      nextLines.push({ ...line, quantity: line.quantity - 1 });
      if (targetIndex < 0) nextLines.push(nextLine);
      return;
    }

    nextLines.push(
      index === targetIndex ? { ...line, quantity: line.quantity + 1 } : line
    );
  });

  return nextLines;
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
  const [products, setProducts] =
    useState<VierdaagseProduct[]>(vierdaagseProducts);
  const [hasLoadedProducts, setHasLoadedProducts] = useState(false);
  const [hasProductChanges, setHasProductChanges] = useState(false);
  const [isEditingProducts, setIsEditingProducts] = useState(false);
  const [isManualProductOpen, setIsManualProductOpen] = useState(false);
  const [productDraft, setProductDraft] = useState<ProductDraft>(() =>
    emptyProductDraft("koffie-thee")
  );
  const [manualProductDraft, setManualProductDraft] = useState<ProductDraft>(() =>
    emptyProductDraft("overig")
  );
  const [draftLines, setDraftLines] = useState<DraftLine[]>([]);
  const [note, setNote] = useState("");
  const [detailProduct, setDetailProduct] =
    useState<VierdaagseProduct | null>(null);
  const [customDetail, setCustomDetail] = useState("");
  const [lineOptionsKey, setLineOptionsKey] = useState("");
  const [lineCustomDetail, setLineCustomDetail] = useState("");
  const [clock, setClock] = useState(() => new Date());
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const productsJsonRef = useRef(JSON.stringify(products));

  useEffect(() => {
    const interval = window.setInterval(() => setClock(new Date()), 15000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    let isMounted = true;
    setProducts(getStoredVierdaagseProducts());

    fetchVierdaagseProductsFromWordPress().then((result) => {
      if (!isMounted) return;

      if (result.data.length) {
        setProducts(result.data);
      }
      setHasLoadedProducts(true);
    });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    productsJsonRef.current = JSON.stringify(products);
  }, [products]);

  useEffect(() => {
    if (!hasLoadedProducts || !hasProductChanges) return;

    const productsToSave = products;
    const productsJson = JSON.stringify(productsToSave);
    const timeout = window.setTimeout(() => {
      saveVierdaagseProductsToWordPress(productsToSave).then((result) => {
        if (productsJson !== productsJsonRef.current) return;

        if (result.ok) {
          setHasProductChanges(false);
          return;
        }

        setError("Knoppen zijn lokaal opgeslagen; WordPress is nog niet bijgewerkt.");
      });
    }, 650);

    return () => window.clearTimeout(timeout);
  }, [hasLoadedProducts, hasProductChanges, products]);

  useEffect(() => {
    setProductDraft((current) => ({
      ...current,
      category: activeCategory,
    }));
  }, [activeCategory]);

  const productsInCategory = useMemo(
    () =>
      sortVierdaagseProducts(
        products.filter((product) => product.category === activeCategory)
      ),
    [activeCategory, products]
  );

  const productsById = useMemo(
    () => new Map(products.map((product) => [product.id, product])),
    [products]
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

  function addProductButton(draft: ProductDraft) {
    const name = draft.name.trim();
    if (!name) {
      setError("Vul eerst een productnaam in.");
      return;
    }

    const product: VierdaagseProduct = {
      id: uniqueProductId(name, products),
      name,
      category: draft.category,
      badge: (draft.badge.trim() || badgeFromProductName(name))
        .slice(0, 4)
        .toUpperCase(),
    };

    setProducts((currentProducts) =>
      sortVierdaagseProducts([...currentProducts, product])
    );
    setHasProductChanges(true);
    setProductDraft(emptyProductDraft(activeCategory));
    setMessage(`${name} is toegevoegd als knop.`);
    setError("");
  }

  function updateProductButton(
    productId: string,
    changes: Partial<VierdaagseProduct>
  ) {
    setProducts((currentProducts) =>
      sortVierdaagseProducts(
        currentProducts.map((product) =>
          product.id === productId
            ? {
                ...product,
                ...changes,
                badge:
                  typeof changes.badge === "string"
                    ? changes.badge.slice(0, 4).toUpperCase()
                    : product.badge,
              }
            : product
        )
      )
    );
    setHasProductChanges(true);
  }

  function deleteProductButton(productId: string) {
    setProducts((currentProducts) =>
      currentProducts.filter((product) => product.id !== productId)
    );
    setHasProductChanges(true);
  }

  function resetProductButtons() {
    setProducts(sortVierdaagseProducts(vierdaagseProducts));
    setHasProductChanges(true);
    setMessage("Standaard knoppen zijn teruggezet.");
    setError("");
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

  function addManualProductToOrder() {
    const name = manualProductDraft.name.trim();

    if (!name) {
      setError("Vul eerst een handmatig product in.");
      return;
    }

    addProduct({
      id: `handmatig-${manualProductDraft.category}-${slugifyProductName(name)}`,
      name,
      category: manualProductDraft.category,
      badge: (manualProductDraft.badge.trim() || badgeFromProductName(name))
        .slice(0, 4)
        .toUpperCase(),
    });
    setManualProductDraft(emptyProductDraft(manualProductDraft.category));
    setError("");
  }

  function removeDraftLine(lineKey: string) {
    setDraftLines((currentLines) =>
      currentLines.filter((line) => line.key !== lineKey)
    );
  }

  function updateDraftLineDetail(lineKey: string, detail: string) {
    const cleanDetail = detail.trim();
    const line = draftLines.find((currentLine) => currentLine.key === lineKey);
    if (!line) return;

    const nextKey = createDraftKey(line.productId, cleanDetail);
    setLineOptionsKey(nextKey);
    setDraftLines((currentLines) =>
      moveOneDraftLineToDetail(currentLines, lineKey, cleanDetail)
    );
  }

  function toggleDraftLineOption(lineKey: string, option: string) {
    const line = draftLines.find((currentLine) => currentLine.key === lineKey);
    if (!line) return;

    const parts = (line.detail || "")
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
    const hasOption = parts.some(
      (part) => part.toLowerCase() === option.toLowerCase()
    );
    const nextParts = hasOption
      ? parts.filter((part) => part.toLowerCase() !== option.toLowerCase())
      : [...parts, option];
    const detail = nextParts.join(", ");
    const nextKey = createDraftKey(line.productId, detail);

    setLineCustomDetail(detail);
    setLineOptionsKey(nextKey);
    setDraftLines((currentLines) =>
      moveOneDraftLineToDetail(currentLines, lineKey, detail)
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
    setLineOptionsKey("");
    setLineCustomDetail("");
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
  const activeLine = draftLines.find((line) => line.key === lineOptionsKey);
  const activeLineProduct = activeLine
    ? productsById.get(activeLine.productId)
    : undefined;
  const activeLineOptions = detailOptionsForProduct(activeLineProduct);

  return (
    <main className="min-h-screen bg-[#faf8f5] px-2 py-2 pb-20 text-[#1a1815] md:pb-6 lg:px-5">
      <div className="mx-auto grid max-w-7xl gap-2 sm:gap-3">
        <header className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#d6e5d8] bg-white p-2 shadow-sm sm:p-3">
          <div className="min-w-0">
            <p className="text-[0.6rem] font-black uppercase tracking-normal text-[#ef7d0a] sm:text-[0.68rem]">
              Proeverij tool
            </p>
            <h1 className="text-lg font-black leading-tight text-[#24551d] sm:text-xl">
              Nieuwe bestelling
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-[#ecf4ed] px-2 py-1.5 text-sm font-black text-[#24551d] sm:px-3 sm:py-2 sm:text-lg">
              {formatClock(clock)}
            </span>
            <Link
              href="/vierdaagse/productie-bediening"
              className="grid h-14 w-14 place-items-center rounded-md bg-[#ef7d0a] p-1 text-center text-white shadow-sm transition active:scale-[0.98]"
              aria-label="Naar keuken"
            >
              <span className="grid justify-items-center gap-0.5">
                <img
                  src="/app%20strik_keuken.svg"
                  alt=""
                  className="h-6 w-6 object-contain brightness-0 invert"
                />
                <span className="text-[0.52rem] font-black uppercase leading-none">
                  Keuken
                </span>
              </span>
            </Link>
          </div>
        </header>

        {(message || error) && (
          <div
            className={`rounded-lg border px-2 py-1.5 text-xs font-bold sm:px-3 sm:py-2 sm:text-sm ${
              error
                ? "border-[#f0b4a8] bg-[#fff4f2] text-[#9d2f20]"
                : "border-[#c8dfc3] bg-[#f2faef] text-[#24551d]"
            }`}
          >
            {error || message}
          </div>
        )}

        <div className="grid gap-2 sm:gap-3 md:grid-cols-[minmax(0,1fr)_17rem] xl:grid-cols-[minmax(0,1.55fr)_minmax(21rem,0.75fr)]">
          <div className="grid gap-2 sm:gap-3">
            <section className="rounded-lg border border-[#e8e4de] bg-white p-2 shadow-sm sm:p-3">
              <h2 className="mb-1.5 text-xs font-black uppercase tracking-normal text-[#24551d] sm:mb-2 sm:text-sm">
                Stap 1 · tafel
              </h2>
              <div className="grid gap-2 md:grid-cols-[0.85fr_1.15fr] sm:gap-3">
                {tableGroups.map((group) => (
                  <div key={group.title} className="grid gap-1.5 sm:gap-2">
                    <p className="text-[0.65rem] font-black uppercase tracking-normal text-[#ef7d0a] sm:text-xs">
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
                            className={`min-h-9 rounded-md border text-sm font-black transition active:scale-[0.98] sm:min-h-11 sm:text-base ${
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

              <div className="mt-2 grid gap-1.5 rounded-lg border border-[#e8e4de] bg-[#faf8f5] p-1.5 sm:mt-3 sm:grid-cols-[auto_1fr] sm:items-center sm:gap-2 sm:p-2">
                <button
                  type="button"
                  onClick={() => {
                    setDestinationMode("custom");
                    setSelectedTable(null);
                  }}
                  className={`min-h-9 rounded-md border px-2 text-xs font-black transition active:scale-[0.98] sm:min-h-11 sm:px-3 sm:text-sm ${
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
                  className="min-h-9 rounded-md border border-[#d8d0c5] bg-white px-2 text-xs font-semibold outline-none focus:border-[#24551d] sm:min-h-11 sm:px-3 sm:text-sm"
                />
              </div>
            </section>

            <section className="rounded-lg border border-[#e8e4de] bg-white p-2 shadow-sm sm:p-3">
              <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2 sm:mb-2">
                <h2 className="text-xs font-black uppercase tracking-normal text-[#24551d] sm:text-sm">
                  Stap 2 · producten
                </h2>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[0.65rem] font-bold text-[#6b645b] sm:text-xs">
                    {totalItems} producten
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsManualProductOpen((current) => !current)}
                    className="min-h-7 rounded-md border border-[#d8d0c5] bg-white px-2 text-[0.62rem] font-black text-[#24551d] active:scale-[0.98] sm:text-xs"
                  >
                    Handmatig
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditingProducts((current) => !current)}
                    className={`min-h-7 rounded-md border px-2 text-[0.62rem] font-black active:scale-[0.98] sm:text-xs ${
                      isEditingProducts
                        ? "border-[#ef7d0a] bg-[#ef7d0a] text-white"
                        : "border-[#d8d0c5] bg-white text-[#24551d]"
                    }`}
                  >
                    Bewerken
                  </button>
                </div>
              </div>

              <div className="mb-2 grid grid-cols-3 gap-1 md:grid-cols-6 sm:mb-3 sm:gap-1.5">
                {productCategories.map((category) => {
                  const active = category.id === activeCategory;

                  return (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() => setActiveCategory(category.id)}
                      className={`min-h-9 rounded-md border px-1.5 text-xs font-black transition active:scale-[0.98] sm:min-h-11 sm:px-2 sm:text-sm ${
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

              {isManualProductOpen && (
                <div className="mb-2 grid gap-1.5 rounded-lg border border-[#e8e4de] bg-[#faf8f5] p-1.5 md:grid-cols-[minmax(0,1fr)_8rem_5rem_auto] md:items-end">
                  <input
                    value={manualProductDraft.name}
                    onChange={(event) =>
                      setManualProductDraft((current) => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                    placeholder="Handmatig product"
                    className="min-h-9 rounded-md border border-[#d8d0c5] bg-white px-2 text-xs font-semibold outline-none focus:border-[#24551d]"
                  />
                  <select
                    value={manualProductDraft.category}
                    onChange={(event) =>
                      setManualProductDraft((current) => ({
                        ...current,
                        category: event.target.value as ProductCategoryId,
                      }))
                    }
                    className="min-h-9 rounded-md border border-[#d8d0c5] bg-white px-2 text-xs font-semibold"
                  >
                    {productCategories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.shortLabel}
                      </option>
                    ))}
                  </select>
                  <input
                    value={manualProductDraft.badge}
                    onChange={(event) =>
                      setManualProductDraft((current) => ({
                        ...current,
                        badge: event.target.value,
                      }))
                    }
                    placeholder="Code"
                    className="min-h-9 rounded-md border border-[#d8d0c5] bg-white px-2 text-xs font-semibold uppercase outline-none focus:border-[#24551d]"
                  />
                  <button
                    type="button"
                    onClick={addManualProductToOrder}
                    className="min-h-9 rounded-md bg-[#24551d] px-3 text-xs font-black text-white active:scale-[0.98]"
                  >
                    Op bon
                  </button>
                </div>
              )}

              {isEditingProducts && (
                <div className="mb-2 grid gap-2 rounded-lg border border-[#ef7d0a] bg-[#fff8ef] p-2">
                  <div className="grid gap-1.5 md:grid-cols-[minmax(0,1fr)_8rem_5rem_auto_auto] md:items-end">
                    <input
                      value={productDraft.name}
                      onChange={(event) =>
                        setProductDraft((current) => ({
                          ...current,
                          name: event.target.value,
                        }))
                      }
                      placeholder="Nieuwe knop"
                      className="min-h-9 rounded-md border border-[#d8d0c5] bg-white px-2 text-xs font-semibold outline-none focus:border-[#24551d]"
                    />
                    <select
                      value={productDraft.category}
                      onChange={(event) =>
                        setProductDraft((current) => ({
                          ...current,
                          category: event.target.value as ProductCategoryId,
                        }))
                      }
                      className="min-h-9 rounded-md border border-[#d8d0c5] bg-white px-2 text-xs font-semibold"
                    >
                      {productCategories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.shortLabel}
                        </option>
                      ))}
                    </select>
                    <input
                      value={productDraft.badge}
                      onChange={(event) =>
                        setProductDraft((current) => ({
                          ...current,
                          badge: event.target.value,
                        }))
                      }
                      placeholder="Code"
                      className="min-h-9 rounded-md border border-[#d8d0c5] bg-white px-2 text-xs font-semibold uppercase outline-none focus:border-[#24551d]"
                    />
                    <button
                      type="button"
                      onClick={() => addProductButton(productDraft)}
                      className="min-h-9 rounded-md bg-[#ef7d0a] px-3 text-xs font-black text-white active:scale-[0.98]"
                    >
                      Voeg knop toe
                    </button>
                    <button
                      type="button"
                      onClick={resetProductButtons}
                      className="min-h-9 rounded-md border border-[#d8d0c5] bg-white px-3 text-xs font-black text-[#9d3c24] active:scale-[0.98]"
                    >
                      Reset
                    </button>
                  </div>

                  <div className="grid gap-1 md:grid-cols-2">
                    {productsInCategory.map((product) => (
                      <div
                        key={product.id}
                        className="grid grid-cols-[3.4rem_minmax(0,1fr)_7rem_2rem] items-center gap-1 rounded-md bg-white p-1"
                      >
                        <input
                          value={product.badge}
                          onChange={(event) =>
                            updateProductButton(product.id, {
                              badge: event.target.value,
                            })
                          }
                          className="min-h-8 rounded-md border border-[#d8d0c5] px-1 text-center text-[0.62rem] font-black uppercase"
                          aria-label={`${product.name} code`}
                        />
                        <input
                          value={product.name}
                          onChange={(event) =>
                            updateProductButton(product.id, {
                              name: event.target.value,
                            })
                          }
                          className="min-h-8 min-w-0 rounded-md border border-[#d8d0c5] px-2 text-xs font-semibold"
                          aria-label={`${product.name} naam`}
                        />
                        <select
                          value={product.category}
                          onChange={(event) =>
                            updateProductButton(product.id, {
                              category: event.target.value as ProductCategoryId,
                            })
                          }
                          className="min-h-8 rounded-md border border-[#d8d0c5] bg-white px-1 text-[0.62rem] font-bold"
                          aria-label={`${product.name} categorie`}
                        >
                          {productCategories.map((category) => (
                            <option key={category.id} value={category.id}>
                              {category.shortLabel}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => deleteProductButton(product.id)}
                          className="min-h-8 rounded-md border border-[#f0b4a8] text-xs font-black text-[#9d2f20] active:scale-[0.98]"
                          aria-label={`${product.name} verwijderen`}
                        >
                          x
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {detailProduct && (
                <div className="mb-2 rounded-lg border border-[#ef7d0a] bg-[#fff8ef] p-1.5 sm:mb-3 sm:p-2">
                  <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2 sm:mb-2">
                    <p className="text-xs font-black text-[#24551d] sm:text-sm">
                      {detailProduct.detailLabel || "Specificatie"}
                    </p>
                    <button
                      type="button"
                      onClick={() => setDetailProduct(null)}
                      className="min-h-8 rounded-md border border-[#d8d0c5] bg-white px-2 text-[0.65rem] font-black text-[#6b645b] sm:min-h-9 sm:px-3 sm:text-xs"
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
                        className="min-h-9 rounded-md bg-[#24551d] px-2 text-xs font-black text-white transition active:scale-[0.98] sm:min-h-11 sm:text-sm"
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
                      className="min-h-9 rounded-md border border-[#d8d0c5] bg-white px-2 text-xs font-semibold outline-none focus:border-[#24551d] sm:min-h-11 sm:px-3 sm:text-sm"
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
                      className="min-h-9 rounded-md bg-[#ef7d0a] px-3 text-xs font-black text-white disabled:opacity-45 sm:min-h-11 sm:px-4 sm:text-sm"
                    >
                      Voeg toe
                    </button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-3 gap-1 md:grid-cols-5 xl:grid-cols-6">
                {productsInCategory.map((product) => {
                  const count = getProductCount(product.id);

                  return (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => handleProductAdd(product)}
                      className="relative flex min-h-[3.1rem] items-center rounded-md border border-[#d6e5d8] bg-[#f6faf4] px-2 py-1 text-left transition active:scale-[0.98]"
                    >
                      <span className="line-clamp-2 pr-5 text-[0.72rem] font-black leading-[0.92rem] text-[#1a1815]">
                        {product.name}
                      </span>
                      {count > 0 && (
                        <span className="absolute right-1 top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#24551d] px-1 text-[0.62rem] font-black text-white">
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </section>
          </div>

          <aside className="rounded-lg border border-[#d6e5d8] bg-white p-2 shadow-sm sm:p-3 md:sticky md:top-2 md:self-start xl:top-3">
            <h2 className="text-xs font-black uppercase tracking-normal text-[#24551d] sm:text-sm">
              Stap 3 · controle
            </h2>
            <div className="mt-2 grid gap-2 sm:mt-3 sm:gap-3">
              <div className="rounded-lg bg-[#f6faf4] p-2 sm:p-3">
                <p className="text-[0.58rem] font-black uppercase text-[#ef7d0a] sm:text-[0.68rem]">
                  Tafel
                </p>
                <p className="text-lg font-black leading-tight text-[#24551d] sm:text-2xl">
                  {selectedDestinationLabel}
                </p>
              </div>

              <div className="grid gap-1.5">
                {draftLines.length ? (
                  draftLines.map((line) => {
                    const product = productsById.get(line.productId);
                    const lineOptions = detailOptionsForProduct(product);

                    return (
                      <div
                        key={line.key}
                        className="grid gap-1 rounded-md border border-[#e8e4de] bg-[#faf8f5] p-1.5"
                      >
                        <div className="grid grid-cols-[1.5rem_minmax(0,1fr)_2.45rem_1.65rem] items-center gap-1.5">
                          <span className="text-xs font-black text-[#ef7d0a] sm:text-sm">
                            {line.quantity}x
                          </span>
                          <span className="min-w-0 truncate text-xs font-bold text-[#1a1815] sm:text-sm">
                            {lineLabel(line)}
                          </span>
                          <button
                            type="button"
                            disabled={!lineOptions.length}
                            onClick={() => {
                              setLineOptionsKey((current) =>
                                current === line.key ? "" : line.key
                              );
                              setLineCustomDetail(line.detail || "");
                            }}
                            className="min-h-8 rounded-md bg-white text-[0.56rem] font-black text-[#24551d] disabled:opacity-25"
                          >
                            optie
                          </button>
                          <button
                            type="button"
                            onClick={() => removeDraftLine(line.key)}
                            className="min-h-8 rounded-md bg-white text-[0.6rem] font-black text-[#c8382d] sm:text-sm"
                            aria-label={`${lineLabel(line)} verwijderen`}
                          >
                            x
                          </button>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="rounded-lg border border-dashed border-[#d8d0c5] px-2 py-3 text-xs font-semibold text-[#8b8278] sm:px-3 sm:py-4 sm:text-sm">
                    Nog geen producten.
                  </p>
                )}
              </div>

              {activeLine && activeLineOptions.length > 0 && (
                <div className="grid gap-1.5 rounded-lg border border-[#ef7d0a] bg-[#fff8ef] p-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-xs font-black text-[#24551d]">
                      Opties voor {activeLine.quantity > 1 ? "1x " : ""}
                      {activeLine.name}
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setLineOptionsKey("");
                        setLineCustomDetail("");
                      }}
                      className="text-[0.62rem] font-black text-[#9d3c24]"
                    >
                      Sluit
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    {activeLineOptions.map((option) => {
                      const isActive = (activeLine.detail || "")
                        .toLowerCase()
                        .split(",")
                        .map((part) => part.trim())
                        .includes(option.toLowerCase());

                      return (
                        <button
                          key={option}
                          type="button"
                          onClick={() => toggleDraftLineOption(activeLine.key, option)}
                          className={`min-h-8 rounded-md border px-1 text-[0.6rem] font-black active:scale-[0.98] ${
                            isActive
                              ? "border-[#24551d] bg-[#24551d] text-white"
                              : "border-[#d8d0c5] bg-white text-[#24551d]"
                          }`}
                        >
                          {option}
                        </button>
                      );
                    })}
                  </div>
                  <input
                    value={lineCustomDetail}
                    onChange={(event) => {
                      setLineCustomDetail(event.target.value);
                      updateDraftLineDetail(activeLine.key, event.target.value);
                    }}
                    placeholder="Eigen optie of opmerking"
                    className="min-h-8 rounded-md border border-[#d8d0c5] bg-white px-2 text-xs font-semibold outline-none focus:border-[#24551d]"
                  />
                </div>
              )}

              <label className="grid gap-1 text-[0.65rem] font-black uppercase text-[#6b645b] sm:text-xs">
                Notitie
                <textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  rows={3}
                  className="min-h-16 rounded-md border border-[#d8d0c5] bg-white px-2 py-1.5 text-xs font-semibold normal-case text-[#1a1815] outline-none focus:border-[#24551d] sm:min-h-20 sm:px-3 sm:py-2 sm:text-sm"
                  placeholder="Bijvoorbeeld zonder cacao, eerst koffie..."
                />
              </label>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={clearDraft}
                  className="min-h-10 rounded-md border border-[#d8d0c5] bg-white px-2 text-xs font-black text-[#6b645b] active:scale-[0.98] sm:min-h-12 sm:px-3 sm:text-sm"
                >
                  Leegmaken
                </button>
                <button
                  type="button"
                  onClick={submitOrder}
                  disabled={isSubmitting}
                  className="min-h-10 rounded-md bg-[#24551d] px-2 text-xs font-black text-white disabled:opacity-50 active:scale-[0.98] sm:min-h-12 sm:px-3 sm:text-sm"
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
