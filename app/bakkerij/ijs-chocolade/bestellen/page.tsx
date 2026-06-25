"use client";

import { useMemo, useState } from "react";
import { StrikPageHeader, StrikShell, strikIcons } from "../../../StrikUI";
import {
  hefeOrderItems,
  type HefeOrderItem,
} from "../../recepturen/hefeOrderData";
import { formatEuro } from "../../recepturen/utils";

type QuantityMap = Record<string, number>;
type CustomOrderLine = {
  id: string;
  articleNumber: string;
  name: string;
  packageSize: string;
  quantity: number;
};

function hefeCategory(item: HefeOrderItem) {
  const text = `${item.name} ${item.packageSize}`.toLocaleLowerCase("nl-NL");

  if (/becher|deckel|spaten|hörnchen/.test(text)) return "Verpakking";
  if (/joy|preg|m'3|gelatop|varieg|pistachio|pistaz|paste|cream|fruit/.test(text)) {
    return "IJsgrondstof";
  }
  if (/milch|sahne|butter|suiker|sucker|glukose|dextrose/.test(text)) {
    return "Basis";
  }

  return "Overig";
}

function selectedQuantity(quantities: QuantityMap, id: string) {
  return Math.max(0, quantities[id] || 0);
}

export default function HefeBestellenPage() {
  const [quantities, setQuantities] = useState<QuantityMap>({});
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("Alles");
  const [customName, setCustomName] = useState("");
  const [customArticleNumber, setCustomArticleNumber] = useState("");
  const [customPackage, setCustomPackage] = useState("");
  const [customQuantity, setCustomQuantity] = useState(1);
  const [customLines, setCustomLines] = useState<CustomOrderLine[]>([]);

  const categories = useMemo(
    () => ["Alles", ...Array.from(new Set(hefeOrderItems.map(hefeCategory)))],
    []
  );
  const filteredItems = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("nl-NL");

    return hefeOrderItems.filter((item) => {
      const matchesCategory =
        category === "Alles" || hefeCategory(item) === category;
      const matchesSearch =
        query === "" ||
        item.name.toLocaleLowerCase("nl-NL").includes(query) ||
        item.articleNumber.toLocaleLowerCase("nl-NL").includes(query);

      return matchesCategory && matchesSearch;
    });
  }, [category, search]);
  const selectedItems = hefeOrderItems.filter(
    (item) => selectedQuantity(quantities, item.id) > 0
  );
  const selectedCount =
    selectedItems.reduce(
      (total, item) => total + selectedQuantity(quantities, item.id),
      0
    ) + customLines.reduce((total, item) => total + item.quantity, 0);

  function setItemQuantity(itemId: string, nextQuantity: number) {
    setQuantities((current) => ({
      ...current,
      [itemId]: Math.max(0, nextQuantity),
    }));
  }

  function addCustomLine() {
    const name = customName.trim();
    if (!name) return;

    setCustomLines((current) => [
      ...current,
      {
        id: `custom-${Date.now()}`,
        articleNumber: customArticleNumber.trim(),
        name,
        packageSize: customPackage.trim(),
        quantity: Math.max(1, customQuantity),
      },
    ]);
    setCustomName("");
    setCustomArticleNumber("");
    setCustomPackage("");
    setCustomQuantity(1);
  }

  function mailOrder() {
    if (!selectedCount) return;

    const orderLines = selectedItems.map((item) => {
      const quantity = selectedQuantity(quantities, item.id);
      const note = item.note ? ` - ${item.note}` : "";

      return `- ${quantity} x ${item.articleNumber} - ${item.name} (${item.packageSize})${note}`;
    });
    const customOrderLines = customLines.map((item) => {
      const packageText = item.packageSize ? ` (${item.packageSize})` : "";
      const articleText = item.articleNumber ? `${item.articleNumber} - ` : "";

      return `- ${item.quantity} x ${articleText}${item.name}${packageText}`;
    });
    const today = new Intl.DateTimeFormat("nl-NL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(new Date());
    const body = [
      "Beste Hefe van Haag,",
      "",
      `Graag onderstaande bestelling voor Strik (${today}):`,
      "",
      ...orderLines,
      ...customOrderLines,
      "",
      "Met vriendelijke groet,",
      "Strik Banketbakkerij",
    ].join("\n");
    const mailto = `mailto:verkoop@hefe-van-haag.nl?subject=${encodeURIComponent(
      `Bestelling Strik ${today}`
    )}&body=${encodeURIComponent(body)}`;

    window.location.href = mailto;
  }

  return (
    <StrikShell wide>
      <StrikPageHeader
        title="Hefe bestellen"
        kicker="IJs & chocolade"
        description="Plus de aantallen, voeg eventueel een losse regel toe en mail de bestelling."
        icon={strikIcons.ijs}
      />

      <section className="mb-3 grid gap-2 rounded-xl border border-[#eadb8b] bg-[#fff8d8] p-3 shadow-sm lg:grid-cols-[1fr_auto]">
        <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="zoek product of artikelnummer"
            className="min-h-11 border border-[#d7ccb7] bg-white px-3 text-base font-bold outline-none focus:border-[#8aa37d]"
          />
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            className="min-h-11 border border-[#d7ccb7] bg-white px-3 text-base font-bold outline-none focus:border-[#8aa37d]"
          >
            {categories.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={mailOrder}
          disabled={!selectedCount}
          className="min-h-11 border border-[#a8bf9e] bg-[#c3d3bc] px-5 text-sm font-black text-[#1a1815] shadow-sm disabled:cursor-not-allowed disabled:opacity-45"
        >
          Mail bestelling ({selectedCount})
        </button>
      </section>

      <section className="overflow-hidden border border-[#cbdcc5] bg-white shadow-sm">
        <div className="grid grid-cols-[4.5rem_1fr_7rem_9rem_8rem] border-b border-[#dbe8d7] bg-[#f3f1ec] px-3 py-2 text-[0.68rem] font-black uppercase tracking-[0.14em] text-[#2d2a26]/45 max-lg:hidden">
          <span>Aantal</span>
          <span>Product</span>
          <span>Art.nr</span>
          <span>Verpakking</span>
          <span>Prijs</span>
        </div>

        <div className="max-h-[calc(100dvh-20rem)] overflow-y-auto">
          {filteredItems.map((item) => {
            const quantity = selectedQuantity(quantities, item.id);

            return (
              <div
                key={item.id}
                className="grid gap-2 border-b border-[#e5efe1] px-3 py-2 lg:grid-cols-[4.5rem_1fr_7rem_9rem_8rem] lg:items-center"
              >
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setItemQuantity(item.id, quantity - 1)}
                    className="h-8 w-8 border border-[#d6e5d8] bg-white text-lg font-black"
                    aria-label={`${item.name} minder`}
                  >
                    -
                  </button>
                  <input
                    value={quantity}
                    onChange={(event) =>
                      setItemQuantity(item.id, Number(event.target.value) || 0)
                    }
                    inputMode="numeric"
                    className="h-8 w-10 border border-[#d6e5d8] text-center text-sm font-black"
                    aria-label={`${item.name} aantal`}
                  />
                  <button
                    type="button"
                    onClick={() => setItemQuantity(item.id, quantity + 1)}
                    className="h-8 w-8 border border-[#a8bf9e] bg-[#c3d3bc] text-lg font-black"
                    aria-label={`${item.name} meer`}
                  >
                    +
                  </button>
                </div>

                <div className="min-w-0">
                  <p className="truncate text-base font-black text-[#1a1815]">
                    {item.name}
                  </p>
                  <p className="text-xs font-bold text-[#2d2a26]/45 lg:hidden">
                    {item.articleNumber} - {item.packageSize}
                  </p>
                  {item.note && (
                    <p className="text-xs font-bold text-[#8a6b21]">
                      {item.note}
                    </p>
                  )}
                </div>

                <p className="hidden text-sm font-black text-[#2d2a26]/65 lg:block">
                  {item.articleNumber}
                </p>
                <p className="hidden text-sm font-black text-[#2d2a26]/65 lg:block">
                  {item.packageSize}
                </p>
                <p className="hidden text-sm font-black text-[#2d2a26]/65 lg:block">
                  {item.lastPrice ? formatEuro(item.lastPrice) : "-"}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="mt-3 rounded-xl border border-[#e7e0d8] bg-white p-3 shadow-sm">
        <p className="mb-2 text-[0.68rem] font-black uppercase tracking-[0.14em] text-[#2d2a26]/45">
          Losse regel
        </p>
        <div className="grid gap-2 md:grid-cols-[1fr_10rem_12rem_7rem_auto]">
          <input
            value={customName}
            onChange={(event) => setCustomName(event.target.value)}
            placeholder="productnaam"
            className="min-h-11 border border-[#d7ccb7] px-3 text-base font-bold outline-none focus:border-[#8aa37d]"
          />
          <input
            value={customArticleNumber}
            onChange={(event) => setCustomArticleNumber(event.target.value)}
            placeholder="art.nr"
            className="min-h-11 border border-[#d7ccb7] px-3 text-base font-bold outline-none focus:border-[#8aa37d]"
          />
          <input
            value={customPackage}
            onChange={(event) => setCustomPackage(event.target.value)}
            placeholder="verpakking"
            className="min-h-11 border border-[#d7ccb7] px-3 text-base font-bold outline-none focus:border-[#8aa37d]"
          />
          <input
            value={customQuantity}
            onChange={(event) =>
              setCustomQuantity(Math.max(1, Number(event.target.value) || 1))
            }
            inputMode="numeric"
            className="min-h-11 border border-[#d7ccb7] px-3 text-base font-bold outline-none focus:border-[#8aa37d]"
          />
          <button
            type="button"
            onClick={addCustomLine}
            className="min-h-11 border border-[#a8bf9e] bg-[#c3d3bc] px-4 text-sm font-black"
          >
            Voeg toe
          </button>
        </div>
        {customLines.length > 0 && (
          <div className="mt-3 grid gap-1">
            {customLines.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between border border-[#e7e0d8] bg-[#faf8f5] px-3 py-2 text-sm font-black"
              >
                <span>
                  {item.quantity} x {item.name}
                  {item.articleNumber ? ` - ${item.articleNumber}` : ""}
                  {item.packageSize ? ` (${item.packageSize})` : ""}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setCustomLines((current) =>
                      current.filter((line) => line.id !== item.id)
                    )
                  }
                  className="text-[#b44a3a]"
                >
                  Verwijder
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </StrikShell>
  );
}
