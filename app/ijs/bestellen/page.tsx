"use client";

import { useEffect, useMemo, useState } from "react";
import { StrikPageHeader, StrikShell, strikIcons } from "../../StrikUI";

const EXTRAVESTIGING_URL = "https://evstrikb2b.extravestiging.nl";
const CUSTOM_PRODUCTS_KEY = "strik-ijs-bestellen-custom-products";
const HIDDEN_PRODUCTS_KEY = "strik-ijs-bestellen-hidden-products";
const QUANTITIES_KEY = "strik-ijs-bestellen-quantities";

type ProductGroup = "Ijs" | "Horeca Benodigdheden" | "Winkel benodigdheden divers";

type Product = {
  code: string;
  name: string;
  group: ProductGroup;
  price?: number;
  subcode?: string;
  custom?: boolean;
};

const ijssalons = [
  "Strik ijs Heyendaal",
  "Strik ijs Lent",
  "Strik ijs Daalseweg",
  "Strik ijs Ziekerstraat",
];

const productGroups: ProductGroup[] = [
  "Ijs",
  "Horeca Benodigdheden",
  "Winkel benodigdheden divers",
];

const defaultProducts: Product[] = [
  {
    code: "1008807",
    name: "Zak/doos slagroom",
    group: "Horeca Benodigdheden",
  },
  {
    code: "5511",
    name: "Roomijs Aardbeien room (5L bak, 4,5kg)",
    group: "Ijs",
    price: 32.5,
  },
  {
    code: "5506",
    name: "Roomijs Choco Brownie (5L bak 4,5kg)",
    group: "Ijs",
    price: 32.5,
  },
  {
    code: "5503",
    name: "Roomijs Hazelino (5L bak 4,5kg)",
    group: "Ijs",
    price: 32.5,
  },
  {
    code: "5509",
    name: "Roomijs Lemon Merengue (5L bak 4,5kg)",
    group: "Ijs",
    price: 32.5,
  },
  {
    code: "5505",
    name: "Roomijs Monchou Amarena (5L bak 4,5kg)",
    group: "Ijs",
    price: 32.5,
  },
  {
    code: "5504",
    name: "Roomijs Pecan gezouten Caramel (5L bak)",
    group: "Ijs",
    price: 32.5,
  },
  {
    code: "5507",
    name: "Roomijs Pistache (5L bak 4,5kg)",
    group: "Ijs",
    price: 32.5,
  },
  {
    code: "5508",
    name: "Roomijs Slagroom Truffel (5L bak 4,5kg)",
    group: "Ijs",
    price: 32.5,
  },
  {
    code: "5501",
    name: "Roomijs Vanille (5L bak 4,5kg)",
    group: "Ijs",
    price: 32.5,
  },
  {
    code: "5518",
    name: "Roomijs Witte Choco Framb (5L bak 4,5L)",
    group: "Ijs",
    price: 32.5,
  },
];

function parseJson<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function readLocalStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;

  return parseJson<T>(window.localStorage.getItem(key), fallback);
}

function formatPrice(value: number) {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
  }).format(value);
}

function buildAddProductUrl(product: Product, amount: number) {
  const url = new URL("/AddProduct.aspx", EXTRAVESTIGING_URL);
  url.searchParams.set("ProductCode", product.code);
  url.searchParams.set("Amount", String(amount));

  if (product.subcode) {
    url.searchParams.set("Subcode", product.subcode);
  }

  return url.toString();
}

export default function IjsBestellenPage() {
  const [winkel, setWinkel] = useState(ijssalons[0]);
  const [query, setQuery] = useState("");
  const [selectedGroup, setSelectedGroup] = useState<ProductGroup | "Alles">(
    "Alles"
  );
  const [customProducts, setCustomProducts] = useState<Product[]>(() =>
    readLocalStorage<Product[]>(CUSTOM_PRODUCTS_KEY, [])
  );
  const [hiddenProductCodes, setHiddenProductCodes] = useState<string[]>(() =>
    readLocalStorage<string[]>(HIDDEN_PRODUCTS_KEY, [])
  );
  const [quantities, setQuantities] = useState<Record<string, number>>(() =>
    readLocalStorage<Record<string, number>>(QUANTITIES_KEY, {})
  );
  const [newProductCode, setNewProductCode] = useState("");
  const [newProductName, setNewProductName] = useState("");
  const [newProductGroup, setNewProductGroup] =
    useState<ProductGroup>("Ijs");
  const [newProductPrice, setNewProductPrice] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    localStorage.setItem(QUANTITIES_KEY, JSON.stringify(quantities));
  }, [quantities]);

  const products = useMemo(() => {
    const byCode = new Map<string, Product>();

    defaultProducts.forEach((product) => byCode.set(product.code, product));
    customProducts.forEach((product) => byCode.set(product.code, product));

    return Array.from(byCode.values())
      .filter((product) => !hiddenProductCodes.includes(product.code))
      .sort((a, b) => {
        const groupOrder =
          productGroups.indexOf(a.group) - productGroups.indexOf(b.group);

        return groupOrder || a.name.localeCompare(b.name, "nl-NL");
      });
  }, [customProducts, hiddenProductCodes]);

  const filteredProducts = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return products.filter((product) => {
      const matchesGroup =
        selectedGroup === "Alles" || product.group === selectedGroup;
      const matchesQuery =
        !needle ||
        product.name.toLowerCase().includes(needle) ||
        product.code.includes(needle);

      return matchesGroup && matchesQuery;
    });
  }, [products, query, selectedGroup]);

  const orderLines = products
    .map((product) => ({
      product,
      amount: quantities[product.code] || 0,
    }))
    .filter((line) => line.amount > 0);

  const total = orderLines.reduce((sum, line) => {
    return sum + (line.product.price || 0) * line.amount;
  }, 0);

  function updateQuantity(productCode: string, value: string) {
    const amount = Math.max(0, Number.parseInt(value || "0", 10) || 0);

    setQuantities((prev) => ({
      ...prev,
      [productCode]: amount,
    }));
  }

  function addCustomProduct() {
    const code = newProductCode.trim();
    const name = newProductName.trim();
    const parsedPrice = Number.parseFloat(
      newProductPrice.replace(",", ".")
    );

    if (!code || !name) {
      setStatus("Vul minimaal een nummer en naam in.");
      return;
    }

    const nextProduct: Product = {
      code,
      name,
      group: newProductGroup,
      price: Number.isFinite(parsedPrice) ? parsedPrice : undefined,
      custom: true,
    };
    const nextCustomProducts = [
      ...customProducts.filter((product) => product.code !== code),
      nextProduct,
    ];
    const nextHiddenCodes = hiddenProductCodes.filter((item) => item !== code);

    setCustomProducts(nextCustomProducts);
    setHiddenProductCodes(nextHiddenCodes);
    localStorage.setItem(
      CUSTOM_PRODUCTS_KEY,
      JSON.stringify(nextCustomProducts)
    );
    localStorage.setItem(
      HIDDEN_PRODUCTS_KEY,
      JSON.stringify(nextHiddenCodes)
    );
    setNewProductCode("");
    setNewProductName("");
    setNewProductPrice("");
    setStatus("Product toegevoegd.");
  }

  function hideProduct(productCode: string) {
    const nextHiddenCodes = Array.from(
      new Set([...hiddenProductCodes, productCode])
    );
    const nextCustomProducts = customProducts.filter(
      (product) => product.code !== productCode
    );

    setHiddenProductCodes(nextHiddenCodes);
    setCustomProducts(nextCustomProducts);
    localStorage.setItem(
      HIDDEN_PRODUCTS_KEY,
      JSON.stringify(nextHiddenCodes)
    );
    localStorage.setItem(
      CUSTOM_PRODUCTS_KEY,
      JSON.stringify(nextCustomProducts)
    );
  }

  async function copyOrder() {
    const lines = orderLines.map(
      ({ product, amount }) => `${amount}x ${product.code} - ${product.name}`
    );
    const text = [`Bestelling ${winkel}`, ...lines].join("\n");

    try {
      await navigator.clipboard.writeText(text);
      setStatus("Bestellijst gekopieerd.");
    } catch {
      setStatus("Kopiëren lukte niet op dit apparaat.");
    }
  }

  function clearQuantities() {
    setQuantities({});
    setStatus("Aantallen gewist.");
  }

  function restoreHiddenProducts() {
    setHiddenProductCodes([]);
    localStorage.setItem(HIDDEN_PRODUCTS_KEY, JSON.stringify([]));
    setStatus("Verborgen producten teruggezet.");
  }

  return (
    <StrikShell wide>
      <StrikPageHeader
        title="IJs bestellen"
        description="Rustige bestellijst voor de zakelijke webshop."
        icon={strikIcons.ijs}
        tone="medium"
      />

      <div className="space-y-4">
        <section className="rounded-[1.5rem] bg-white/90 p-4 shadow-sm">
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr]">
            <select
              value={winkel}
              onChange={(event) => setWinkel(event.target.value)}
              className="w-full rounded-2xl border border-[#e7e0d8] bg-white p-3 text-sm font-semibold"
            >
              {ijssalons.map((ijssalon) => (
                <option key={ijssalon}>{ijssalon}</option>
              ))}
            </select>

            <a
              href={EXTRAVESTIGING_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center rounded-2xl bg-[#c3d3bc] px-4 py-3 text-sm font-bold text-[#2d2a26]"
            >
              Open zakelijke webshop
            </a>
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto]">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Zoek op product of nummer"
              className="w-full rounded-2xl border border-[#e7e0d8] bg-white p-3 text-sm"
            />

            <select
              value={selectedGroup}
              onChange={(event) =>
                setSelectedGroup(event.target.value as ProductGroup | "Alles")
              }
              className="w-full rounded-2xl border border-[#e7e0d8] bg-white p-3 text-sm font-semibold sm:w-56"
            >
              <option>Alles</option>
              {productGroups.map((group) => (
                <option key={group}>{group}</option>
              ))}
            </select>
          </div>
        </section>

        {orderLines.length > 0 && (
          <section className="rounded-[1.5rem] border border-[#c3d3bc] bg-[#eef3ea] p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#2d2a26]/55">
                  Bestelling
                </p>
                <h2 className="mt-1 text-2xl font-bold">
                  {orderLines.length} regel
                  {orderLines.length === 1 ? "" : "s"}
                </h2>
              </div>
              <p className="rounded-full bg-white px-4 py-2 text-sm font-bold">
                {formatPrice(total)}
              </p>
            </div>

            <div className="mt-4 space-y-2">
              {orderLines.map(({ product, amount }) => (
                <div
                  key={product.code}
                  className="flex items-center justify-between gap-3 rounded-2xl bg-white px-3 py-2 text-sm"
                >
                  <div className="min-w-0">
                    <p className="truncate font-bold">{product.name}</p>
                    <p className="text-xs text-[#2d2a26]/55">
                      {amount} x {product.code}
                    </p>
                  </div>
                  <a
                    href={buildAddProductUrl(product, amount)}
                    target="_blank"
                    rel="noreferrer"
                    className="shrink-0 rounded-full bg-[#c3d3bc] px-3 py-2 text-xs font-bold"
                  >
                    Toevoegen
                  </a>
                </div>
              ))}
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={copyOrder}
                className="rounded-2xl bg-white px-4 py-3 text-sm font-bold"
              >
                Kopieer lijst
              </button>
              <button
                type="button"
                onClick={clearQuantities}
                className="rounded-2xl bg-white px-4 py-3 text-sm font-bold text-[#d75a48]"
              >
                Wis aantallen
              </button>
            </div>
          </section>
        )}

        <section className="rounded-[1.5rem] bg-white/90 p-3 shadow-sm">
          <div className="space-y-2">
            {filteredProducts.map((product) => {
              const amount = quantities[product.code] || 0;

              return (
                <article
                  key={product.code}
                  className={`rounded-2xl border px-3 py-2 ${
                    amount > 0
                      ? "border-[#9fb891] bg-[#eef3ea]"
                      : "border-[#e7e0d8] bg-white"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-[#f4f0ea] px-2 py-0.5 text-xs font-bold text-[#2d2a26]/65">
                          {product.code}
                        </span>
                        <span className="text-xs font-semibold text-[#2d2a26]/45">
                          {product.group}
                        </span>
                      </div>
                      <h2 className="mt-1 text-sm font-bold leading-snug">
                        {product.name}
                      </h2>
                      <p className="mt-1 text-xs font-semibold text-[#2d2a26]/50">
                        {product.price ? formatPrice(product.price) : "Prijs in webshop"}
                      </p>
                    </div>

                    <input
                      value={amount}
                      onChange={(event) =>
                        updateQuantity(product.code, event.target.value)
                      }
                      type="number"
                      min="0"
                      inputMode="numeric"
                      className="h-12 w-20 rounded-xl border border-[#d6e2cf] bg-white text-center text-lg font-bold"
                    />
                  </div>

                  <div className="mt-2 flex gap-2">
                    {amount > 0 && (
                      <a
                        href={buildAddProductUrl(product, amount)}
                        target="_blank"
                        rel="noreferrer"
                        className="flex-1 rounded-xl bg-[#c3d3bc] px-3 py-2 text-center text-xs font-bold"
                      >
                        Toevoegen in webshop
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => hideProduct(product.code)}
                      className="rounded-xl bg-[#f8f6f3] px-3 py-2 text-xs font-bold text-[#2d2a26]/55"
                    >
                      Verberg
                    </button>
                  </div>
                </article>
              );
            })}
          </div>

          {filteredProducts.length === 0 && (
            <div className="rounded-2xl bg-[#f8f6f3] p-4 text-sm font-semibold text-[#2d2a26]/55">
              Geen producten gevonden.
            </div>
          )}
        </section>

        <section className="rounded-[1.5rem] bg-white/90 p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#2d2a26]/55">
                Product
              </p>
              <h2 className="mt-1 text-xl font-bold">Toevoegen</h2>
            </div>
            <span className="rounded-full bg-[#eef3ea] px-3 py-1 text-xs font-bold text-[#2d2a26]/55">
              Bake-it nummer
            </span>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <input
              value={newProductCode}
              onChange={(event) => setNewProductCode(event.target.value)}
              placeholder="Nummer"
              className="rounded-2xl border border-[#e7e0d8] bg-white p-3 text-sm"
            />
            <input
              value={newProductName}
              onChange={(event) => setNewProductName(event.target.value)}
              placeholder="Naam"
              className="rounded-2xl border border-[#e7e0d8] bg-white p-3 text-sm"
            />
            <select
              value={newProductGroup}
              onChange={(event) =>
                setNewProductGroup(event.target.value as ProductGroup)
              }
              className="rounded-2xl border border-[#e7e0d8] bg-white p-3 text-sm font-semibold"
            >
              {productGroups.map((group) => (
                <option key={group}>{group}</option>
              ))}
            </select>
            <input
              value={newProductPrice}
              onChange={(event) => setNewProductPrice(event.target.value)}
              placeholder="Prijs"
              inputMode="decimal"
              className="rounded-2xl border border-[#e7e0d8] bg-white p-3 text-sm"
            />
          </div>

          <button
            type="button"
            onClick={addCustomProduct}
            className="mt-3 w-full rounded-2xl bg-[#c3d3bc] px-4 py-3 text-sm font-bold"
          >
            Product opslaan
          </button>

          {hiddenProductCodes.length > 0 && (
            <button
              type="button"
              onClick={restoreHiddenProducts}
              className="mt-2 w-full rounded-2xl bg-[#f8f6f3] px-4 py-3 text-sm font-bold text-[#2d2a26]/65"
            >
              Verborgen producten terugzetten
            </button>
          )}
        </section>

        {status && (
          <p className="rounded-2xl bg-white p-3 text-center text-sm font-semibold shadow-sm">
            {status}
          </p>
        )}
      </div>
    </StrikShell>
  );
}
