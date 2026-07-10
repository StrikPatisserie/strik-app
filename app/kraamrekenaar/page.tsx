"use client";

import { useEffect, useMemo, useState } from "react";

type StallProduct = {
  id: string;
  code: string;
  name: string;
  detail?: string;
  priceCents: number;
  group: ProductGroup;
};

type HoldSlot = {
  id: number;
  entries: string[];
};

type ProductGroup = "drinken" | "zoet" | "hartig" | "koek";

type ProductDraft = {
  code: string;
  name: string;
  detail: string;
  price: string;
  group: ProductGroup;
};

const idlePromptDelayMs = 15000;
const editableProductsStorageKey = "strik-kraamrekenaar-products-v1";

const defaultProducts: StallProduct[] = [
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
    id: "ijskoffie",
    code: "22",
    name: "IJskoffie",
    priceCents: 450,
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

const cashButtons = [5, 10, 20, 50];
const groupLabels: Record<ProductGroup, string> = {
  drinken: "Drank",
  zoet: "Zoet",
  hartig: "Hartig",
  koek: "Koek",
};
function formatEuro(cents: number) {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

function formatCompactEuro(cents: number) {
  return formatEuro(cents).replace(/\s/g, "");
}

function getEntriesTotal(
  entries: string[],
  productLookup: Map<string, StallProduct>
) {
  return entries.reduce((total, productId) => {
    return total + (productLookup.get(productId)?.priceCents || 0);
  }, 0);
}

function countEntries(entries: string[], productList: StallProduct[]) {
  const counts = new Map<string, number>();

  for (const productId of entries) {
    counts.set(productId, (counts.get(productId) || 0) + 1);
  }

  return productList
    .map((product) => ({
      product,
      count: counts.get(product.id) || 0,
    }))
    .filter((line) => line.count > 0);
}

function productLabel(product: StallProduct) {
  return product.detail ? `${product.name} ${product.detail}` : product.name;
}

function createProductId(name: string) {
  const base =
    name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "product";

  return `${base}-${Date.now().toString(36)}`;
}

function parsePriceToCents(value: string) {
  const normalized = value.trim().replace(",", ".");
  const parsed = Number.parseFloat(normalized);

  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
}

function priceCentsToDraft(priceCents: number) {
  return (priceCents / 100).toLocaleString("nl-NL", {
    minimumFractionDigits: priceCents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

function productToDraft(product: StallProduct): ProductDraft {
  return {
    code: product.code,
    name: product.name,
    detail: product.detail || "",
    price: priceCentsToDraft(product.priceCents),
    group: product.group,
  };
}

function createEmptyDraft(nextCode: string): ProductDraft {
  return {
    code: nextCode,
    name: "",
    detail: "",
    price: "",
    group: "zoet",
  };
}

function isValidProductList(value: unknown): value is StallProduct[] {
  return (
    Array.isArray(value) &&
    value.every(
      (product) =>
        product &&
        typeof product === "object" &&
        "id" in product &&
        typeof product.id === "string" &&
        "name" in product &&
        typeof product.name === "string" &&
        "priceCents" in product &&
        typeof product.priceCents === "number" &&
        "group" in product &&
        (product.group === "drinken" ||
          product.group === "zoet" ||
          product.group === "hartig" ||
          product.group === "koek")
    )
  );
}

function getNextProductCode(productList: StallProduct[]) {
  const highestCode = productList.reduce((highest, product) => {
    const parsed = Number.parseInt(product.code, 10);

    return Number.isFinite(parsed) ? Math.max(highest, parsed) : highest;
  }, 0);

  return String(highestCode + 1).padStart(2, "0");
}

function productGroupClass(
  group: ProductGroup,
  selected: boolean,
  editMode: boolean
) {
  if (editMode) return "border-[#ff9b1a] bg-[#fff7ef]";
  if (selected) return "border-white bg-[#ffffff] text-[#9f3b18]";

  if (group === "drinken") return "border-[#ff9b1a] bg-[#9f3b18]";
  if (group === "hartig") return "border-[#ff9b1a] bg-[#853112]";
  if (group === "koek") return "border-[#ff9b1a] bg-[#a8441e]";

  return "border-[#ff9b1a] bg-[#973715]";
}

export default function KraamrekenaarPage() {
  const [products, setProducts] = useState<StallProduct[]>(defaultProducts);
  const [entries, setEntries] = useState<string[]>([]);
  const [holdSlots, setHoldSlots] = useState<HoldSlot[]>([
    { id: 1, entries: [] },
    { id: 2, entries: [] },
    { id: 3, entries: [] },
  ]);
  const [cashGivenCents, setCashGivenCents] = useState<number | null>(null);
  const [lastActivityAt, setLastActivityAt] = useState(Date.now());
  const [showIdlePrompt, setShowIdlePrompt] = useState(false);
  const [isProductsLoaded, setIsProductsLoaded] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isProductEditorOpen, setIsProductEditorOpen] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ProductDraft>(() =>
    createEmptyDraft(getNextProductCode(defaultProducts))
  );
  const [draggingProductId, setDraggingProductId] = useState<string | null>(null);

  const productById = useMemo(
    () => new Map(products.map((product) => [product.id, product])),
    [products]
  );
  const orderLines = useMemo(
    () => countEntries(entries, products),
    [entries, products]
  );
  const totalCents = useMemo(
    () => getEntriesTotal(entries, productById),
    [entries, productById]
  );
  const productCounts = useMemo(() => {
    const counts = new Map<string, number>();

    for (const productId of entries) {
      counts.set(productId, (counts.get(productId) || 0) + 1);
    }

    return counts;
  }, [entries]);
  const canHoldOrder =
    entries.length > 0 && holdSlots.some((slot) => slot.entries.length === 0);
  const changeCents =
    cashGivenCents !== null ? cashGivenCents - totalCents : null;
  const editingProduct = editingProductId
    ? products.find((product) => product.id === editingProductId)
    : null;

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

  function openEditMode() {
    setIsEditMode(true);
    setIsProductEditorOpen(false);
  }

  function closeEditMode() {
    setIsEditMode(false);
    setIsProductEditorOpen(false);
    setEditingProductId(null);
  }

  function startNewProduct() {
    setIsEditMode(true);
    setIsProductEditorOpen(true);
    setEditingProductId(null);
    setDraft(createEmptyDraft(getNextProductCode(products)));
  }

  function selectProductForEdit(product: StallProduct) {
    setIsEditMode(true);
    setIsProductEditorOpen(true);
    setEditingProductId(product.id);
    setDraft(productToDraft(product));
  }

  function saveProduct() {
    const cleanName = draft.name.trim();
    const cleanDetail = draft.detail.trim();
    const cleanCode = draft.code.trim() || getNextProductCode(products);
    const priceCents = parsePriceToCents(draft.price);

    if (!cleanName || priceCents <= 0) return;

    if (editingProductId) {
      setProducts((currentProducts) =>
        currentProducts.map((product) =>
          product.id === editingProductId
            ? {
                ...product,
                code: cleanCode,
                name: cleanName,
                detail: cleanDetail || undefined,
                priceCents,
                group: draft.group,
              }
            : product
        )
      );
    } else {
      const product: StallProduct = {
        id: createProductId(cleanName),
        code: cleanCode,
        name: cleanName,
        detail: cleanDetail || undefined,
        priceCents,
        group: draft.group,
      };

      setProducts((currentProducts) => [...currentProducts, product]);
      setEditingProductId(product.id);
    }
  }

  function deleteEditingProduct() {
    if (!editingProductId) return;

    setProducts((currentProducts) =>
      currentProducts.filter((product) => product.id !== editingProductId)
    );
    setEntries((currentEntries) =>
      currentEntries.filter((productId) => productId !== editingProductId)
    );
    setHoldSlots((currentSlots) =>
      currentSlots.map((slot) => ({
        ...slot,
        entries: slot.entries.filter((productId) => productId !== editingProductId),
      }))
    );
    setEditingProductId(null);
    setIsProductEditorOpen(false);
  }

  function resetProducts() {
    setProducts(defaultProducts);
    setEntries([]);
    setHoldSlots([
      { id: 1, entries: [] },
      { id: 2, entries: [] },
      { id: 3, entries: [] },
    ]);
    setCashGivenCents(null);
    setEditingProductId(null);
    setIsProductEditorOpen(false);
  }

  function moveProduct(sourceId: string, targetId: string) {
    if (sourceId === targetId) return;

    setProducts((currentProducts) => {
      const sourceIndex = currentProducts.findIndex(
        (product) => product.id === sourceId
      );
      const targetIndex = currentProducts.findIndex(
        (product) => product.id === targetId
      );

      if (sourceIndex < 0 || targetIndex < 0) return currentProducts;

      const nextProducts = [...currentProducts];
      const [sourceProduct] = nextProducts.splice(sourceIndex, 1);
      nextProducts.splice(targetIndex, 0, sourceProduct);

      return nextProducts;
    });
  }

  function moveEditingProduct(offset: number) {
    if (!editingProductId) return;

    setProducts((currentProducts) => {
      const currentIndex = currentProducts.findIndex(
        (product) => product.id === editingProductId
      );
      const nextIndex = currentIndex + offset;

      if (currentIndex < 0 || nextIndex < 0 || nextIndex >= currentProducts.length) {
        return currentProducts;
      }

      const nextProducts = [...currentProducts];
      const [product] = nextProducts.splice(currentIndex, 1);
      nextProducts.splice(nextIndex, 0, product);

      return nextProducts;
    });
  }

  useEffect(() => {
    try {
      const storedProducts = window.localStorage.getItem(
        editableProductsStorageKey
      );

      if (storedProducts) {
        const parsedProducts = JSON.parse(storedProducts) as unknown;

        if (isValidProductList(parsedProducts)) {
          setProducts(parsedProducts);
        }
      }
    } catch {
      setProducts(defaultProducts);
    } finally {
      setIsProductsLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!isProductsLoaded) return;

    window.localStorage.setItem(
      editableProductsStorageKey,
      JSON.stringify(products)
    );
  }, [isProductsLoaded, products]);

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
    <main className="min-h-dvh bg-[#9f3b18] text-white">
      <div className="mx-auto flex min-h-dvh w-full max-w-7xl flex-col gap-1.5 px-1.5 py-1.5 tracking-normal sm:gap-2 sm:px-3 sm:py-2">
        <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-1.5 border border-[#ff9b1a] bg-[#8b3215] p-1.5 shadow-sm">
          <div className="min-w-0">
            <h1 className="truncate text-sm font-extrabold uppercase tracking-normal text-white sm:text-lg">
              4Daagse rekentool
            </h1>
            <p className="text-[0.58rem] font-normal uppercase tracking-normal text-[#ffbe64] sm:text-xs">
              {entries.length} stuks
            </p>
          </div>

          <div className="grid min-w-[8.1rem] grid-cols-[auto_1fr] items-center gap-1 border border-white bg-white px-2 py-1 text-[#9f3b18] sm:min-w-52 sm:px-3 sm:py-2">
            <span className="text-[0.52rem] font-normal uppercase tracking-normal text-[#9f3b18]/65 sm:text-xs">
              Totaal
            </span>
            <strong className="text-right font-mono text-2xl font-black tracking-normal sm:text-4xl">
              {formatCompactEuro(totalCents)}
            </strong>
          </div>
        </header>

        <section className="min-h-8 border border-[#ff9b1a] bg-[#8b3215] px-1.5 py-1 shadow-sm">
          {orderLines.length ? (
            <div className="grid max-h-28 gap-1 overflow-y-auto sm:max-h-36 sm:grid-cols-2 lg:grid-cols-3">
              {orderLines.map(({ product, count }) => (
                <div
                  key={product.id}
                  className="grid min-h-7 grid-cols-[1.6rem_minmax(0,1fr)_1.35rem_1.35rem] items-center gap-1 border border-[#ff9b1a]/65 bg-[#9f3b18] px-1 text-[0.64rem] text-white sm:text-xs"
                >
                  <span className="font-extrabold">{count}x</span>
                  <span className="min-w-0 truncate font-normal">
                    {productLabel(product)}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeOne(product.id)}
                    className="flex h-6 items-center justify-center bg-white text-sm font-black text-[#9f3b18]"
                    aria-label={`${productLabel(product)} eentje minder`}
                  >
                    -
                  </button>
                  <button
                    type="button"
                    onClick={() => addProduct(product.id)}
                    className="flex h-6 items-center justify-center bg-[#ff9b1a] text-sm font-black text-[#4a1c0c]"
                    aria-label={`${productLabel(product)} eentje meer`}
                  >
                    +
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="px-1 text-[0.68rem] font-normal text-white/70 sm:text-xs">
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
                draggable={isEditMode}
                onClick={() =>
                  isEditMode ? selectProductForEdit(product) : addProduct(product.id)
                }
                onDragStart={(event) => {
                  if (!isEditMode) return;

                  setDraggingProductId(product.id);
                  event.dataTransfer.effectAllowed = "move";
                }}
                onDragOver={(event) => {
                  if (isEditMode) event.preventDefault();
                }}
                onDrop={(event) => {
                  event.preventDefault();

                  if (draggingProductId) {
                    moveProduct(draggingProductId, product.id);
                    setDraggingProductId(null);
                  }
                }}
                className={`relative grid min-h-[3rem] content-between border p-1 text-left shadow-sm transition active:scale-[0.98] sm:min-h-[4rem] sm:p-1.5 ${productGroupClass(
                  product.group,
                  count > 0,
                  isEditMode
                )}`}
              >
                <span className="flex min-w-0 items-start justify-between gap-1">
                  <span className="text-[0.48rem] font-normal leading-none text-current opacity-70 sm:text-[0.62rem]">
                    {isEditMode ? "sleep" : product.code}
                  </span>
                  {count > 0 && (
                    <span className="flex h-5 min-w-5 items-center justify-center bg-white px-1 text-xs font-black text-[#9f3b18] sm:h-6 sm:min-w-6">
                      {count}
                    </span>
                  )}
                </span>
                <span className="min-w-0">
                  <span className="block break-words text-[0.64rem] font-extrabold uppercase leading-[0.9] tracking-normal text-current sm:text-sm">
                    {product.name}
                  </span>
                  {product.detail && (
                    <span className="block truncate text-[0.48rem] font-normal uppercase leading-none tracking-normal text-current opacity-80 sm:text-[0.62rem]">
                      {product.detail}
                    </span>
                  )}
                </span>
                <span className="text-sm font-extrabold leading-none tracking-normal text-current sm:text-lg">
                  {formatCompactEuro(product.priceCents)}
                </span>
              </button>
            );
          })}
        </section>

        <section className="grid gap-1 border border-[#ff9b1a] bg-[#8b3215] p-1.5 shadow-sm">
          <div className="grid grid-cols-[1fr_1fr_1.2fr_2rem] gap-1">
            <button
              type="button"
              onClick={undoLast}
              disabled={!entries.length}
              className="min-h-9 border border-[#ff9b1a] bg-[#9f3b18] px-1 text-[0.64rem] font-normal text-white disabled:opacity-45 sm:min-h-11 sm:text-sm"
            >
              Ongedaan
            </button>
            <button
              type="button"
              onClick={holdOrder}
              disabled={!canHoldOrder}
              className="min-h-9 border border-[#ff9b1a] bg-[#ff9b1a] px-1 text-[0.64rem] font-extrabold text-[#4a1c0c] disabled:opacity-45 sm:min-h-11 sm:text-sm"
            >
              In wacht
            </button>
            <button
              type="button"
              onClick={clearOrder}
              disabled={!entries.length}
              className="min-h-9 bg-white px-1 text-sm font-black text-[#9f3b18] disabled:opacity-45 sm:min-h-11 sm:text-base"
            >
              Klaar
            </button>
            <button
              type="button"
              onClick={isEditMode ? closeEditMode : openEditMode}
              className={`min-h-9 border px-1 text-base font-black sm:min-h-11 ${
                isEditMode
                  ? "border-white bg-white text-[#9f3b18]"
                  : "border-[#ff9b1a] bg-[#9f3b18] text-white"
              }`}
              aria-label="Producten bewerken"
            >
              ✎
            </button>
          </div>

          <div className="grid grid-cols-3 gap-1">
            {holdSlots.map((slot) => {
              const slotTotal = getEntriesTotal(slot.entries, productById);
              const occupied = slot.entries.length > 0;

              return (
                <button
                  key={slot.id}
                  type="button"
                  onClick={() => activateHoldSlot(slot.id)}
                  className={`min-h-8 border px-1 text-[0.66rem] font-black sm:min-h-10 sm:text-sm ${
                    occupied
                      ? "border-white bg-[#ff9b1a] text-[#4a1c0c]"
                      : "border-[#ff9b1a]/65 bg-[#9f3b18] text-white/75"
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
                    ? "border-white bg-white text-[#9f3b18]"
                    : "border-[#ff9b1a]/65 bg-[#9f3b18] text-white"
                }`}
              >
                €{amount}
              </button>
            ))}
            <div className="grid min-h-8 content-center bg-[#ff9b1a] px-1 text-center text-[#4a1c0c] sm:min-h-10">
              <span className="text-[0.5rem] font-normal uppercase leading-none tracking-normal sm:text-[0.62rem]">
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
              className="min-h-8 border-2 border-white bg-[#ff9b1a] px-2 text-xs font-black text-[#4a1c0c] sm:min-h-10 sm:text-sm"
            >
              Nieuwe klant
            </button>
          )}

          {isEditMode && (
            <div className="grid gap-1 border border-[#ff9b1a] bg-[#9f3b18] p-1 text-white">
              <div className="grid grid-cols-[1fr_1fr_1fr] gap-1">
                <button
                  type="button"
                  onClick={startNewProduct}
                  className="min-h-8 bg-[#ff9b1a] px-2 text-[0.66rem] font-black text-[#4a1c0c] sm:text-sm"
                >
                  Nieuwe knop
                </button>
                <button
                  type="button"
                  onClick={() => moveEditingProduct(-1)}
                  disabled={!editingProduct}
                  className="min-h-8 border border-[#ff9b1a] px-2 text-[0.66rem] font-normal disabled:opacity-45 sm:text-sm"
                >
                  Omhoog
                </button>
                <button
                  type="button"
                  onClick={() => moveEditingProduct(1)}
                  disabled={!editingProduct}
                  className="min-h-8 border border-[#ff9b1a] px-2 text-[0.66rem] font-normal disabled:opacity-45 sm:text-sm"
                >
                  Omlaag
                </button>
              </div>

              {isProductEditorOpen ? (
                <div className="grid gap-1 sm:grid-cols-[4rem_1fr_1fr_5rem_7rem_auto_auto]">
                  <input
                    value={draft.code}
                    onChange={(event) =>
                      setDraft((currentDraft) => ({
                        ...currentDraft,
                        code: event.target.value,
                      }))
                    }
                    placeholder="nr"
                    className="min-h-8 border border-[#ff9b1a] bg-[#8b3215] px-2 text-xs text-white outline-none placeholder:text-white/45"
                  />
                  <input
                    value={draft.name}
                    onChange={(event) =>
                      setDraft((currentDraft) => ({
                        ...currentDraft,
                        name: event.target.value,
                      }))
                    }
                    placeholder="product"
                    className="min-h-8 border border-[#ff9b1a] bg-[#8b3215] px-2 text-xs text-white outline-none placeholder:text-white/45"
                  />
                  <input
                    value={draft.detail}
                    onChange={(event) =>
                      setDraft((currentDraft) => ({
                        ...currentDraft,
                        detail: event.target.value,
                      }))
                    }
                    placeholder="klein label"
                    className="min-h-8 border border-[#ff9b1a] bg-[#8b3215] px-2 text-xs text-white outline-none placeholder:text-white/45"
                  />
                  <input
                    inputMode="decimal"
                    value={draft.price}
                    onChange={(event) =>
                      setDraft((currentDraft) => ({
                        ...currentDraft,
                        price: event.target.value,
                      }))
                    }
                    placeholder="prijs"
                    className="min-h-8 border border-[#ff9b1a] bg-[#8b3215] px-2 text-xs text-white outline-none placeholder:text-white/45"
                  />
                  <select
                    value={draft.group}
                    onChange={(event) =>
                      setDraft((currentDraft) => ({
                        ...currentDraft,
                        group: event.target.value as ProductGroup,
                      }))
                    }
                    className="min-h-8 border border-[#ff9b1a] bg-[#8b3215] px-2 text-xs text-white outline-none"
                  >
                    {Object.entries(groupLabels).map(([group, label]) => (
                      <option key={group} value={group}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={saveProduct}
                    className="min-h-8 bg-white px-2 text-xs font-black text-[#9f3b18]"
                  >
                    Opslaan
                  </button>
                  {editingProduct && (
                    <button
                      type="button"
                      onClick={deleteEditingProduct}
                      className="min-h-8 border border-white px-2 text-xs font-normal"
                    >
                      Verwijder
                    </button>
                  )}
                </div>
              ) : (
                <p className="text-[0.66rem] font-normal text-white/75 sm:text-xs">
                  Tik een product aan om te bewerken, of sleep knoppen naar een
                  andere plek.
                </p>
              )}

              <button
                type="button"
                onClick={resetProducts}
                className="justify-self-start text-[0.64rem] font-normal text-white/65 underline underline-offset-2"
              >
                Standaardlijst herstellen
              </button>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
