"use client";

import { Fragment, useEffect, useMemo, useState, type FormEvent } from "react";
import { fetchB2BOrders, fetchLetterOrders } from "../../sinterklaasApi";
import type {
  ChocolateLetterLine,
  ChocolateLetterOrder,
  SinterklaasB2BOrder,
} from "../../types";

export type ProductionSeedRow = {
  key: string;
  label: string;
  orders: number;
  stock: number;
  produced: number;
};

export type StoreOrderRow = {
  key: string;
  label: string;
  letter: string;
  flavour: string;
  size: string;
  style: string;
  quantity: number;
};

export type StoreStockOrder = {
  shop: string;
  rows: StoreOrderRow[];
};

export type ProductionBatchSeed = {
  id: string;
  startDate: string;
  date: string;
  pickupFrom?: string;
  deadlineAt?: string;
  status: string;
  minimumLeadDays: number;
  rows: ProductionSeedRow[];
  storeOrders: StoreStockOrder[];
};

type WorkingRow = ProductionSeedRow;
type StoreStockResult = {
  batchId: string;
  deadlineAt?: string;
  locked?: boolean;
  orders: StoreStockOrder[];
  aggregateRows: StoreOrderRow[];
};

type DistributionLine = {
  quantity: number;
  product: string;
  extras?: string[];
};

type DistributionOrder = {
  id: string;
  code: string;
  customerName: string;
  pickupDate: string;
  shop: string;
  lines: DistributionLine[];
  note?: string;
  giftWrap?: boolean;
  paid?: boolean;
};

type DistributionMarker = "wrap" | "photo" | "nut-free" | "gluten-free" | "vegan" | "lactose-free";

const DISTRIBUTION_MARKERS: Array<{ key: DistributionMarker; label: string }> = [
  { key: "wrap", label: "Inpakken" },
  { key: "photo", label: "Foto/logo" },
  { key: "nut-free", label: "Notenvrij" },
  { key: "gluten-free", label: "Glutenvrij" },
  { key: "vegan", label: "Vegan" },
  { key: "lactose-free", label: "Lactosevrij" },
];

function DistributionMarkerIcon({ marker }: Readonly<{ marker: DistributionMarker }>) {
  if (marker === "wrap") {
    return <svg viewBox="0 0 24 24" className="h-full w-full" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 10C9 5 4 4 4 7c0 2.5 4.5 3 8 3Z"/><path d="M12 10c3-5 8-6 8-3 0 2.5-4.5 3-8 3Z"/><circle cx="12" cy="10" r="1.7"/><path d="m10.8 11.5-2.3 7 3.5-2 3.5 2-2.3-7"/></svg>;
  }
  if (marker === "photo") {
    return <svg viewBox="0 0 24 24" className="h-full w-full" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7h4l1.5-2h5L16 7h4v12H4Z"/><circle cx="12" cy="13" r="3.2"/></svg>;
  }
  if (marker === "nut-free") {
    return <svg viewBox="0 0 24 24" className="h-full w-full" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 9c.5-3 2.5-5 5-5s4.5 2 5 5c-1.5 1-3.2 1.5-5 1.5S8.5 10 7 9Z"/><path d="M8 10c-1 1.5-1.5 3-1 5 1 4 4 6 7 4 3-2 4-6 2-9"/><path d="m4 4 16 16"/></svg>;
  }
  if (marker === "gluten-free") {
    return <svg viewBox="0 0 24 24" className="h-full w-full" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3v18M12 7 8 5M12 11 8 9M12 15l-4-2M12 7l4-2M12 11l4-2M12 15l4-2"/><path d="m4 4 16 16"/></svg>;
  }
  if (marker === "vegan") {
    return <svg viewBox="0 0 24 24" className="h-full w-full" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 4C10 4 5 8 5 15c0 3 2 5 5 5 7 0 9-7 9-16Z"/><path d="M6 18c3-4 6-6 10-9"/></svg>;
  }
  return <svg viewBox="0 0 24 24" className="h-full w-full" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 3h6v3l2 3v11H7V9l2-3Z"/><path d="M9 6h6M7 12h10"/><path d="m4 4 16 16"/></svg>;
}

function distributionMarkersFor(order: DistributionOrder) {
  const extras = order.lines.flatMap((line) => line.extras || []).map((extra) => extra.toLocaleLowerCase("nl-NL"));
  const markers = new Set<DistributionMarker>();
  if (order.giftWrap) markers.add("wrap");
  if (extras.some((extra) => extra.includes("foto") || extra.includes("logo"))) markers.add("photo");
  if (extras.includes("notenvrij")) markers.add("nut-free");
  if (extras.includes("glutenvrij")) markers.add("gluten-free");
  if (extras.includes("vegan")) markers.add("vegan");
  if (extras.includes("lactosevrij")) markers.add("lactose-free");
  return DISTRIBUTION_MARKERS.filter(({ key }) => markers.has(key));
}

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const DISTRIBUTION_SHOPS = ["ziekerstraat", "heyendaal", "daalseweg", "lent"];
const SHOP_LABELS: Record<string, string> = {
  ziekerstraat: "Ziekerstraat",
  heyendaal: "Heyendaal",
  daalseweg: "Daalseweg",
  lent: "Lent",
};
const SHOP_SHORT_LABELS: Record<string, string> = {
  ziekerstraat: "ZIEK",
  heyendaal: "HEY",
  daalseweg: "DAAL",
  lent: "LENT",
};

function formatDate(date: string) {
  return new Intl.DateTimeFormat("nl-NL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${date}T12:00:00`));
}

function formatProductionPeriod(startDate: string, endDate: string) {
  if (startDate === endDate) return formatDate(endDate);
  const start = new Intl.DateTimeFormat("nl-NL", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(`${startDate}T12:00:00`));
  return `${start} & ${formatDate(endDate)}`;
}

function formatCompactProductionDate(startDate: string) {
  const start = new Date(`${startDate}T12:00:00`);
  const weekday = (date: Date) => new Intl.DateTimeFormat("nl-NL", { weekday: "short" })
    .format(date)
    .replace(".", "");
  const month = (date: Date) => new Intl.DateTimeFormat("nl-NL", { month: "short" })
    .format(date)
    .replace(".", "");
  return `${weekday(start)} ${start.getDate()} ${month(start)} ${start.getFullYear()}`;
}

function formatDistributionProductionDate(startDate: string) {
  const start = new Date(`${startDate}T12:00:00`);
  const weekday = new Intl.DateTimeFormat("nl-NL", { weekday: "short" })
    .format(start)
    .replace(".", "");
  const month = new Intl.DateTimeFormat("nl-NL", { month: "short" })
    .format(start)
    .replace(".", "");
  return `${weekday} ${start.getDate()} ${month}`;
}

function formatDeadline(value?: string) {
  if (!value) return "de besteldeadline";
  return new Intl.DateTimeFormat("nl-NL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Amsterdam",
  }).format(new Date(value));
}

function storeOrderTotal(order?: StoreStockOrder) {
  return order?.rows.reduce((sum, row) => sum + row.quantity, 0) || 0;
}

function batchIsLocked(batch: ProductionBatchSeed) {
  return ["COMPLETED", "CLOSED", "IN_PRODUCTION"].includes(batch.status)
    || Boolean(batch.deadlineAt && Date.now() > new Date(batch.deadlineAt).getTime());
}

function addDays(date: string, days: number) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

function findProductionDate(
  batches: ProductionBatchSeed[],
  requestedDate: string,
  explicitDate = ""
) {
  const explicitBatch = batches.find(
    (batch) => batch.date === explicitDate || batch.startDate === explicitDate
  );
  if (explicitBatch) return explicitBatch.date;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(requestedDate)) return "";

  return batches
    .filter(
      (batch) =>
        (batch.pickupFrom || addDays(batch.date, batch.minimumLeadDays)) <=
        requestedDate
    )
    .at(-1)?.date || "";
}

function legacyLineIdentity(line: ChocolateLetterLine) {
  const extras = [
    line.logo ? "logo" : "",
    ...(line.specialRequests || []),
    line.notes.trim(),
  ].filter(Boolean);
  const label = [
    line.letter.toUpperCase(),
    line.chocolate,
    line.size,
    line.style,
    ...extras,
  ].join(" · ");
  const key = [
    line.letter.toUpperCase(),
    line.chocolate,
    line.size,
    line.style,
    ...extras,
  ].join("|").toLocaleLowerCase("nl-NL");

  return { key, label };
}

function batchIsPlanned(status: string) {
  return ["PLANNED", "IN_PRODUCTION", "COMPLETED", "CLOSED"].includes(status);
}

function totalsFor(rows: WorkingRow[]) {
  return rows.reduce(
    (total, row) => {
      const planned = row.orders + row.stock;
      return {
        orders: total.orders + row.orders,
        stock: total.stock + row.stock,
        produced: total.produced + (planned > 0 && row.produced >= planned ? planned : 0),
      };
    },
    { orders: 0, stock: 0, produced: 0 }
  );
}

function productionRowIsComplete(row: WorkingRow) {
  const planned = row.orders + row.stock;
  return planned > 0 && row.produced >= planned;
}

function productionVariant(label: string) {
  const [letter = "Onbekend", chocolate = "", size = "", style = "", ...extras] = label
    .split(" · ")
    .map((part) => part.trim())
    .filter(Boolean);

  return {
    letter,
    chocolate,
    size,
    style,
    product: [letter, chocolate, size, style].filter(Boolean).join(" · "),
    extras,
  };
}

const PRODUCTION_STYLE_ORDER: Record<string, number> = { spuit: 0, vorm: 1 };
const PRODUCTION_FLAVOUR_ORDER: Record<string, number> = { melk: 0, puur: 1, wit: 2, "vegan-puur": 3 };
const PRODUCTION_SIZE_ORDER: Record<string, number> = { groot: 0, klein: 1 };

function productionValueLabel(value: string) {
  if (!value) return "Overig";
  return `${value.charAt(0).toUpperCase()}${value.slice(1).replace("-", " ")}`;
}

function productionFlavourTheme(flavour: string) {
  if (flavour === "melk") {
    return { rail: "bg-[#c99f78] text-[#4b352f]", line: "bg-[#c99f78]", label: "text-[#9a704d]" };
  }
  if (flavour === "puur") {
    return { rail: "bg-[#4b352f] text-white", line: "bg-[#4b352f]", label: "text-[#4b352f]" };
  }
  if (flavour === "wit") {
    return { rail: "bg-[#eadfc4] text-[#6f624d]", line: "bg-[#d9caa8]", label: "text-[#97866a]" };
  }
  if (flavour === "vegan-puur") {
    return { rail: "bg-[#315b49] text-white", line: "bg-[#557b69]", label: "text-[#315b49]" };
  }
  return { rail: "bg-[#d6d0c7] text-[#5f5951]", line: "bg-[#d6d0c7]", label: "text-[#817a71]" };
}

function compareProductionRows(first: WorkingRow, second: WorkingRow) {
  const a = productionVariant(first.label);
  const b = productionVariant(second.label);
  return (PRODUCTION_STYLE_ORDER[a.style] ?? 99) - (PRODUCTION_STYLE_ORDER[b.style] ?? 99)
    || (PRODUCTION_FLAVOUR_ORDER[a.chocolate] ?? 99) - (PRODUCTION_FLAVOUR_ORDER[b.chocolate] ?? 99)
    || (PRODUCTION_SIZE_ORDER[a.size] ?? 99) - (PRODUCTION_SIZE_ORDER[b.size] ?? 99)
    || a.letter.localeCompare(b.letter, "nl")
    || a.extras.join("|").localeCompare(b.extras.join("|"), "nl");
}

function productionSections(rows: WorkingRow[]) {
  const sections = new Map<string, Map<string, WorkingRow[]>>();
  [...rows].sort(compareProductionRows).forEach((row) => {
    const variant = productionVariant(row.label);
    const styleKey = variant.style || "overig";
    const groupKey = `${variant.chocolate}|${variant.size}`;
    const groups = sections.get(styleKey) || new Map<string, WorkingRow[]>();
    groups.set(groupKey, [...(groups.get(groupKey) || []), row]);
    sections.set(styleKey, groups);
  });
  return [...sections.entries()].map(([style, groups]) => ({
    key: style,
    label: style === "spuit" ? "Spuitletters" : style === "vorm" ? "Vormletters" : "Overige letters",
    groups: [...groups.entries()].map(([key, groupRows]) => {
      const variant = productionVariant(groupRows[0]?.label || "");
      return {
        key,
        label: `${productionValueLabel(variant.chocolate)} · ${productionValueLabel(variant.size)}`,
        flavour: variant.chocolate,
        size: variant.size,
        rows: groupRows,
      };
    }),
  }));
}

function ProductionTable({
  rows,
  onToggleComplete,
}: Readonly<{
  rows: WorkingRow[];
  onToggleComplete?: (row: WorkingRow) => void;
}>) {
  if (rows.length === 0) {
    return <p className="bg-white px-3 py-4 text-center text-sm font-semibold text-[#776f66]">Nog geen letters ingepland.</p>;
  }

  return (
    <div className="space-y-3 bg-[#f7f3ee] p-2 sm:space-y-4 sm:p-3">
      {productionSections(rows).map((section) => (
        <section key={section.key} className="overflow-hidden rounded-xl border border-[#d9d2c8] bg-white shadow-sm">
          <h3 className="border-b border-[#bfcfbb] bg-[#dcebd8] px-3 py-2 text-[0.68rem] font-black uppercase tracking-[0.15em] text-[#24551d]">{section.label}</h3>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[500px] border-collapse text-left text-xs sm:min-w-[560px] sm:text-sm">
              <thead className="bg-[#fffdfa] text-[0.56rem] italic tracking-[0.05em] text-[#9a9187] sm:text-[0.6rem]">
                <tr>
                  <th className="px-3 py-1.5 font-medium">Letter en uitvoering</th>
                  <th className="w-16 px-1 py-1.5 text-center text-[0.5rem] font-normal text-[#aaa197]">Besteld</th>
                  <th className="w-16 px-1 py-1.5 text-center text-[0.5rem] font-normal text-[#aaa197]">Winkel</th>
                  <th className="w-16 border-x-2 border-[#d5cec5] bg-[#eeeae3] px-1 py-1.5 text-center text-[0.62rem] font-black uppercase text-[#4d463d]">Totaal</th>
                  <th className="w-20 px-1 py-1.5 text-center font-medium">Klaar</th>
                </tr>
              </thead>
              <tbody>
                {section.groups.map((group) => {
                  const flavourTheme = productionFlavourTheme(group.flavour);
                  return (
                  <Fragment key={`${section.key}-${group.key}`}>
                    <tr className="bg-white">
                      <td colSpan={5} className="px-3 pb-1 pt-2">
                        <div className="flex items-center gap-2">
                          <span className={`shrink-0 text-[0.58rem] font-bold italic uppercase tracking-[0.12em] ${flavourTheme.label}`}>{group.label}</span>
                          <span className={`h-px flex-1 opacity-55 ${flavourTheme.line}`} />
                        </div>
                      </td>
                    </tr>
                    {group.rows.map((row) => {
                      const planned = row.orders + row.stock;
                      const variant = productionVariant(row.label);
                      const isSpecial = variant.extras.length > 0;
                      const isComplete = productionRowIsComplete(row);
                      const rowTheme = productionFlavourTheme(variant.chocolate);
                      return (
                        <tr key={row.key} className={`border-t border-[#eee9e2] ${isComplete ? "bg-[#f3f8f0]" : "bg-white"}`}>
                          <td className="p-0">
                            <div className="flex min-h-12 items-stretch">
                              <span className={`flex w-[1.4rem] shrink-0 items-center justify-center py-1 text-[0.48rem] font-black uppercase tracking-[0.08em] [writing-mode:vertical-rl] ${rowTheme.rail}`}>{productionValueLabel(variant.chocolate)}</span>
                              <div className="flex flex-1 flex-wrap items-center gap-1.5 px-2 py-1.5 sm:px-3 sm:py-2">
                                <strong className={isComplete ? "text-[#527058] line-through opacity-65" : "text-[#1a1815]"}>{variant.letter}</strong>
                                {isSpecial && (
                                  <>
                                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#d75a48] text-[0.7rem] font-black text-white" aria-label="Afwijking">!</span>
                                    {variant.extras.map((extra) => (
                                      <span key={extra} className="rounded-full border border-[#e4c17b] bg-[#fffaf0] px-2 py-0.5 text-[0.62rem] font-black text-[#765019]">{extra}</span>
                                    ))}
                                  </>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-1 py-1.5 text-center text-[0.66rem] font-medium text-[#9d958c]">{row.orders}</td>
                          <td className="px-1 py-1.5 text-center text-[0.66rem] font-medium text-[#9d958c]">{row.stock}</td>
                          <td className="border-x-2 border-[#d5cec5] bg-[#eeeae3] px-1 py-1.5 text-center text-lg font-black text-[#1a1815]">{planned}</td>
                          <td className="px-1 py-1.5 text-center">
                            {onToggleComplete ? (
                              <button
                                type="button"
                                role="checkbox"
                                aria-checked={isComplete}
                                aria-label={`${variant.product} ${isComplete ? "weer openzetten" : "als geproduceerd markeren"}`}
                                onClick={() => onToggleComplete(row)}
                                className={`mx-auto flex h-8 min-w-8 items-center justify-center rounded-full border px-2 text-xs font-black transition ${isComplete ? "border-[#24551d] bg-[#24551d] text-white" : "border-[#cfc8be] bg-white text-[#8b8278] hover:border-[#7aa173] hover:text-[#24551d]"}`}
                              >
                                {isComplete ? "✓" : "○"}
                              </button>
                            ) : (
                              <span className={`inline-flex rounded-full px-2 py-1 text-[0.58rem] font-black uppercase tracking-[0.08em] ${isComplete ? "bg-[#dcebd8] text-[#24551d]" : "bg-[#fff0e8] text-[#9a3412]"}`}>
                                {isComplete ? "✓ Gereed" : "Open"}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}

function GeneralStoreOrderDialog({
  batch,
  demoMode,
  initialShop,
  onClose,
  onSaved,
}: Readonly<{
  batch: ProductionBatchSeed;
  demoMode: boolean;
  initialShop: string;
  onClose: () => void;
  onSaved: (result: StoreStockResult) => void;
}>) {
  const [selectedShop, setSelectedShop] = useState(initialShop);
  const [drafts, setDrafts] = useState<Record<string, StoreOrderRow[]>>(() =>
    Object.fromEntries(DISTRIBUTION_SHOPS.map((shop) => [
      shop,
      ((batch.storeOrders || []).find((order) => order.shop === shop)?.rows || []).map((row) => ({ ...row })),
    ]))
  );
  const [letter, setLetter] = useState("S");
  const [flavour, setFlavour] = useState("melk");
  const [size, setSize] = useState("groot");
  const [style, setStyle] = useState("spuit");
  const [quantity, setQuantity] = useState(12);
  const [review, setReview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const locked = batchIsLocked(batch);
  const rows = drafts[selectedShop] || [];
  const existingRows = (batch.storeOrders || []).find((order) => order.shop === selectedShop)?.rows || [];
  const rowsTotal = rows.reduce((sum, row) => sum + row.quantity, 0);

  function updateRows(nextRows: StoreOrderRow[]) {
    setDrafts((current) => ({ ...current, [selectedShop]: nextRows }));
  }

  function addLine() {
    const values = [letter, flavour, size, style];
    const key = values.join("|").toLocaleLowerCase("nl-NL");
    const current = rows.find((row) => row.key === key);
    const nextRow: StoreOrderRow = {
      key,
      label: values.join(" · "),
      letter,
      flavour,
      size,
      style,
      quantity: (current?.quantity || 0) + quantity,
    };
    updateRows(current
      ? rows.map((row) => row.key === key ? nextRow : row)
      : [...rows, nextRow].sort((a, b) => a.label.localeCompare(b.label, "nl")));
    setQuantity(1);
  }

  function adjustLine(key: string, delta: number) {
    updateRows(rows.flatMap((row) => {
      if (row.key !== key) return [row];
      const nextQuantity = row.quantity + delta;
      return nextQuantity > 0 ? [{ ...row, quantity: nextQuantity }] : [];
    }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      if (demoMode) {
        const orders = DISTRIBUTION_SHOPS.flatMap((shop) => {
          const shopRows = shop === selectedShop
            ? rows
            : (drafts[shop] || (batch.storeOrders || []).find((order) => order.shop === shop)?.rows || []);
          return shopRows.length > 0 ? [{ shop, rows: shopRows }] : [];
        });
        const aggregate = new Map<string, StoreOrderRow>();
        orders.forEach((order) => order.rows.forEach((row) => {
          const current = aggregate.get(row.key);
          aggregate.set(row.key, { ...row, quantity: (current?.quantity || 0) + row.quantity });
        }));
        onSaved({
          batchId: batch.id,
          deadlineAt: batch.deadlineAt,
          locked: false,
          orders,
          aggregateRows: [...aggregate.values()],
        });
        return;
      }

      const response = await fetch("/api/sinterklaas-letter-store-stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          batchId: batch.id,
          shop: selectedShop,
          lines: rows.map(({ letter: rowLetter, flavour: rowFlavour, size: rowSize, style: rowStyle, quantity: rowQuantity }) => ({
            letter: rowLetter,
            flavour: rowFlavour,
            size: rowSize,
            style: rowStyle,
            quantity: rowQuantity,
          })),
        }),
      });
      const result = await response.json() as StoreStockResult & { message?: string };
      if (!response.ok) throw new Error(result.message || "Opslaan is niet gelukt.");
      onSaved(result);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Opslaan is niet gelukt.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-[#263b2b]/45 px-2 py-3 backdrop-blur-sm sm:px-3 sm:py-8" role="dialog" aria-modal="true">
      <form onSubmit={submit} className="w-full max-w-3xl rounded-[1.4rem] border border-white/90 bg-[#faf8f2] p-3 shadow-2xl sm:rounded-[2rem] sm:p-5 lg:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[0.65rem] font-black uppercase tracking-[0.16em] text-[#8b8278]">Algemene winkelvoorraad</p>
            <h2 className="mt-0.5 text-lg font-black text-[#1a1815] sm:mt-1 sm:text-xl">{review ? "Bestelling controleren" : "Winkelbestelling maken"}</h2>
            <p className="mt-1 text-xs font-bold text-[#6b645b]">Productieronde {formatProductionPeriod(batch.startDate, batch.date)}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Sluiten" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#dfd8ce] bg-white text-lg font-black sm:h-9 sm:w-9 sm:text-xl">×</button>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-1.5 sm:mt-5 sm:grid-cols-4 sm:gap-2">
          {DISTRIBUTION_SHOPS.map((shop) => {
            const total = (drafts[shop] || []).reduce((sum, row) => sum + row.quantity, 0);
            return (
              <button
                key={shop}
                type="button"
                onClick={() => { setSelectedShop(shop); setReview(false); setError(""); }}
                className={`rounded-xl border px-2.5 py-2 text-left transition sm:rounded-2xl sm:px-3 sm:py-3 ${selectedShop === shop ? "border-[#24551d] bg-[#e4eee0]" : "border-[#ddd5ca] bg-white"}`}
              >
                <span className="block text-[0.62rem] font-black uppercase tracking-[0.06em] text-[#4d463d] sm:text-xs sm:tracking-[0.08em]">{SHOP_LABELS[shop]}</span>
                <span className="mt-0.5 block text-xs font-bold text-[#776f66] sm:mt-1 sm:text-sm">{total > 0 ? `${total} letters` : "Nog leeg"}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-3 rounded-xl bg-[#eee8df] px-3 py-2 text-[0.7rem] font-bold text-[#5f584f] sm:mt-4 sm:rounded-2xl sm:px-4 sm:py-3 sm:text-xs">
          {locked
            ? "De besteldeadline is verstreken; deze winkelbestellingen zijn vergrendeld."
            : `Je kunt bevestigde bestellingen wijzigen tot ${formatDeadline(batch.deadlineAt)}.`}
        </div>

        {!review ? (
          <>
            <section className="mt-3 rounded-xl border border-[#e0d8cd] bg-white p-3 sm:mt-4 sm:rounded-2xl sm:p-4">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-[0.62rem] font-black uppercase tracking-[0.14em] text-[#8b8278]">Bestelling voor</p>
                  <h3 className="text-base font-black text-[#263b2b] sm:text-lg">{SHOP_LABELS[selectedShop]}</h3>
                </div>
                <strong className="rounded-full bg-[#e6efe2] px-2.5 py-1 text-xs text-[#24551d] sm:px-3 sm:text-sm">{rowsTotal} letters</strong>
              </div>

              {!locked && (
                <div className="mt-3 grid grid-cols-3 gap-2 sm:mt-4 sm:grid-cols-5 sm:gap-3">
                  <label className="text-[0.58rem] font-black uppercase tracking-[0.08em] text-[#6b645b] sm:text-xs sm:tracking-[0.1em]">Letter
                    <select value={letter} disabled={style === "vorm"} onChange={(event) => setLetter(event.target.value)} className="mt-1 h-9 w-full rounded-lg border border-[#ddd5ca] bg-white px-2 text-xs font-black text-[#1a1815] disabled:bg-[#eee9e2] sm:h-11 sm:rounded-xl sm:px-3 sm:text-sm">
                      {LETTERS.map((value) => <option key={value} value={value}>{value}</option>)}
                    </select>
                  </label>
                  <label className="text-[0.58rem] font-black uppercase tracking-[0.08em] text-[#6b645b] sm:text-xs sm:tracking-[0.1em]">Chocolade
                    <select value={flavour} onChange={(event) => setFlavour(event.target.value)} className="mt-1 h-9 w-full rounded-lg border border-[#ddd5ca] bg-white px-2 text-xs font-black text-[#1a1815] sm:h-11 sm:rounded-xl sm:px-3 sm:text-sm">
                      <option value="melk">Melk</option><option value="puur">Puur</option><option value="wit">Wit</option>
                    </select>
                  </label>
                  <label className="text-[0.58rem] font-black uppercase tracking-[0.08em] text-[#6b645b] sm:text-xs sm:tracking-[0.1em]">Formaat
                    <select value={size} disabled={style === "vorm"} onChange={(event) => setSize(event.target.value)} className="mt-1 h-9 w-full rounded-lg border border-[#ddd5ca] bg-white px-2 text-xs font-black text-[#1a1815] disabled:bg-[#eee9e2] sm:h-11 sm:rounded-xl sm:px-3 sm:text-sm">
                      <option value="groot">Groot</option><option value="klein">Klein</option>
                    </select>
                  </label>
                  <label className="text-[0.58rem] font-black uppercase tracking-[0.08em] text-[#6b645b] sm:text-xs sm:tracking-[0.1em]">Uitvoering
                    <select value={style} onChange={(event) => { const next = event.target.value; setStyle(next); if (next === "vorm") { setLetter("S"); setSize("groot"); } }} className="mt-1 h-9 w-full rounded-lg border border-[#ddd5ca] bg-white px-2 text-xs font-black text-[#1a1815] sm:h-11 sm:rounded-xl sm:px-3 sm:text-sm">
                      <option value="spuit">Spuit</option><option value="vorm">Vorm</option>
                    </select>
                  </label>
                  <label className="text-[0.58rem] font-black uppercase tracking-[0.08em] text-[#6b645b] sm:text-xs sm:tracking-[0.1em]">Aantal
                    <input type="number" min={1} max={10000} value={quantity} onChange={(event) => setQuantity(Math.max(1, Number(event.target.value) || 1))} className="mt-1 h-9 w-full rounded-lg border border-[#ddd5ca] bg-white px-2 text-xs font-black text-[#1a1815] sm:h-11 sm:rounded-xl sm:px-3 sm:text-sm" />
                  </label>
                  <button type="button" onClick={addLine} className="col-span-3 h-9 rounded-full bg-[#4b352f] px-3 text-xs font-black text-white sm:col-span-5 sm:h-11 sm:px-4 sm:text-sm">+ Zet op totaallijst van {SHOP_LABELS[selectedShop]}</button>
                </div>
              )}
            </section>

            <section className="mt-3 overflow-hidden rounded-xl border border-[#e0d8cd] bg-white sm:mt-4 sm:rounded-2xl">
              <div className="flex items-center justify-between bg-[#f1ede7] px-3 py-2 sm:px-4 sm:py-3">
                <h3 className="text-xs font-black sm:text-sm">Totaallijst {SHOP_LABELS[selectedShop]}</h3>
                <span className="text-[0.65rem] font-black text-[#6b645b] sm:text-xs">{rows.length} regels · {rowsTotal} stuks</span>
              </div>
              {rows.length === 0 ? (
                <p className="px-3 py-3 text-xs font-semibold text-[#776f66] sm:px-4 sm:py-5 sm:text-sm">Nog geen letters toegevoegd.</p>
              ) : (
                <div className="divide-y divide-[#e4ded5]">
                  {rows.map((row) => (
                    <div key={row.key} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 sm:gap-3 sm:px-4 sm:py-3">
                      <p className="text-sm font-black text-[#1a1815] sm:text-base">{row.label}</p>
                      <div className="flex items-center gap-1.5 sm:gap-2">
                        {!locked && <button type="button" onClick={() => adjustLine(row.key, -1)} className="h-7 w-7 rounded-full border border-[#ddd5ca] bg-white text-sm font-black sm:h-8 sm:w-8">−</button>}
                        <strong className="min-w-8 text-center text-sm sm:min-w-10 sm:text-base">{row.quantity}×</strong>
                        {!locked && <button type="button" onClick={() => adjustLine(row.key, 1)} className="h-7 w-7 rounded-full bg-[#dbe9ee] text-sm font-black text-[#244c60] sm:h-8 sm:w-8">+</button>}
                        {!locked && <button type="button" onClick={() => updateRows(rows.filter((item) => item.key !== row.key))} className="ml-1 text-[0.65rem] font-black text-[#a23c2b] underline underline-offset-2 sm:text-xs">Verwijder</button>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        ) : (
          <section className="mt-3 rounded-[1.25rem] border border-[#c9d9c5] bg-white p-4 sm:mt-4 sm:rounded-[1.5rem] sm:p-5">
            <p className="text-[0.65rem] font-black uppercase tracking-[0.15em] text-[#668064]">Laatste controle</p>
            <div className="mt-1 flex items-end justify-between gap-3">
              <h3 className="text-xl font-black text-[#263b2b] sm:text-2xl">{SHOP_LABELS[selectedShop]}</h3>
              <strong className="text-lg text-[#24551d] sm:text-xl">{rowsTotal} letters</strong>
            </div>
            <div className="mt-4 divide-y divide-[#e4ded5] border-y border-[#e4ded5]">
              {rows.map((row) => (
                <p key={row.key} className="flex justify-between gap-3 py-2 text-xs sm:py-3 sm:text-sm"><span className="font-bold">{row.label}</span><strong>{row.quantity}×</strong></p>
              ))}
              {rows.length === 0 && <p className="py-4 text-sm font-bold text-[#a23c2b]">Alle regels worden uit deze winkelbestelling verwijderd.</p>}
            </div>
            <p className="mt-3 rounded-xl bg-[#fff3dc] p-2.5 text-xs font-black text-[#70460e] sm:mt-4 sm:p-3 sm:text-sm">
              {rows.length === 0
                ? "Wil je de winkelbestelling uit de productie verwijderen?"
                : "Wil je deze bestelling toevoegen aan de productie? Pas na bevestigen worden deze aantallen meegerekend."}
            </p>
          </section>
        )}
        {error && <p role="alert" className="mt-3 rounded-xl bg-[#fff0ea] p-3 text-sm font-black text-[#9a3412]">{error}</p>}

        <div className="mt-3 flex flex-col-reverse gap-1.5 sm:mt-5 sm:flex-row sm:justify-end sm:gap-2">
          <button type="button" onClick={onClose} className="h-10 rounded-full border border-[#ddd5ca] bg-white px-4 text-xs font-black text-[#4d463d] sm:h-11 sm:px-5 sm:text-sm">Annuleren</button>
          {review ? (
            <>
              <button type="button" onClick={() => setReview(false)} className="h-10 rounded-full border border-[#b9cbb5] bg-[#edf4eb] px-4 text-xs font-black text-[#24551d] sm:h-11 sm:px-5 sm:text-sm">← Nog wijzigen</button>
              <button type="submit" disabled={saving || locked} className="h-10 rounded-full bg-[#24551d] px-4 text-xs font-black text-white shadow-sm disabled:opacity-60 sm:h-11 sm:px-5 sm:text-sm">{saving ? "Opslaan..." : existingRows.length > 0 ? "Ja, wijzigingen opslaan" : "Ja, toevoegen aan productie"}</button>
            </>
          ) : (
            <button type="button" onClick={() => setReview(true)} disabled={locked || (rows.length === 0 && existingRows.length === 0)} className="h-10 rounded-full bg-[#24551d] px-4 text-xs font-black text-white shadow-sm disabled:opacity-40 sm:h-11 sm:px-5 sm:text-sm">Controleer deze winkelbestelling →</button>
          )}
        </div>
      </form>
    </div>
  );
}

function demoDistributionOrders(batch: ProductionBatchSeed): DistributionOrder[] {
  const firstPickup = batch.pickupFrom || addDays(batch.date, batch.minimumLeadDays);
  const baseOrders: DistributionOrder[] = [
    {
      id: `${batch.id}-1`, code: "CL26-0107", customerName: "Sophie van Dijk", shop: "ziekerstraat", pickupDate: firstPickup,
      lines: [{ quantity: 2, product: "S · melk · groot · spuit" }, { quantity: 1, product: "M · wit · klein · spuit", extras: ["foto"] }],
      paid: true,
    },
    {
      id: `${batch.id}-2`, code: "CL26-0112", customerName: "Familie Jansen", shop: "ziekerstraat", pickupDate: addDays(firstPickup, 1),
      lines: [{ quantity: 3, product: "A · puur · groot · spuit" }], note: "Samen in één doos verpakken.",
    },
    {
      id: `${batch.id}-3`, code: "CL26-0118", customerName: "Noor Peters", shop: "heyendaal", pickupDate: firstPickup,
      lines: [{ quantity: 2, product: "S · melk · groot · spuit", extras: ["notenvrij"] }, { quantity: 1, product: "S · melk · groot · spuit", extras: ["notenvrij", "foto"] }], paid: true,
    },
    {
      id: `${batch.id}-4`, code: "CL26-0124", customerName: "M. de Bruin", shop: "heyendaal", pickupDate: addDays(firstPickup, 2),
      lines: [{ quantity: 4, product: "B · puur · klein · spuit" }],
    },
    {
      id: `${batch.id}-5`, code: "CL26-0131", customerName: "Eva Smit", shop: "daalseweg", pickupDate: firstPickup,
      lines: [{ quantity: 1, product: "K · puur · groot · spuit", extras: ["lactosevrij", "foto"] }, { quantity: 2, product: "E · wit · klein · spuit" }], paid: true,
    },
    {
      id: `${batch.id}-6`, code: "CL26-0138", customerName: "Bram Hendriks", shop: "daalseweg", pickupDate: addDays(firstPickup, 1),
      lines: [{ quantity: 2, product: "S · melk · groot · vorm" }],
    },
    {
      id: `${batch.id}-7`, code: "CL26-0145", customerName: "Lotte Willems", shop: "lent", pickupDate: firstPickup,
      lines: [{ quantity: 5, product: "S · melk · groot · spuit", extras: ["foto"] }],
      giftWrap: true,
    },
    {
      id: `${batch.id}-8`, code: "CL26-0150", customerName: "Daan Meijer", shop: "lent", pickupDate: addDays(firstPickup, 2),
      lines: [{ quantity: 2, product: "P · puur · groot · spuit", extras: ["vegan"] }, { quantity: 1, product: "M · wit · klein · spuit" }],
    },
  ];

  const ziekerstraatCustomers = [
    "Lieke de Boer", "Milan Vermeer", "Saar Hendriks", "Tess van Leeuwen", "Noah Vos", "Evi van Dalen",
    "Lucas Smeets", "Fleur Janssen", "Olivier de Wit", "Nina Kuipers", "Sem Peeters", "Lynn Mulder",
    "Mees Bakker", "Julia van den Berg", "Finn Bos", "Sara Peters", "Levi de Jong", "Emma Willems",
  ];
  const letters = ["A", "B", "E", "F", "J", "K", "L", "M", "N", "P", "R", "S", "T", "V", "W"];
  const chocolates = ["melk", "puur", "wit"];
  const extraZiekerstraatOrders: DistributionOrder[] = ziekerstraatCustomers.map((customerName, index) => {
    const extras = index % 7 === 2
      ? ["foto"]
      : index % 9 === 4
        ? ["notenvrij"]
        : index % 11 === 6
          ? ["glutenvrij"]
          : undefined;
    const giftWrap = index === 5 || index === 14;
    return {
      id: `${batch.id}-ziek-test-${index + 1}`,
      code: `CL26-${String(160 + index).padStart(4, "0")}`,
      customerName,
      shop: "ziekerstraat",
      pickupDate: addDays(firstPickup, index % 3),
      lines: [{
        quantity: (index % 3) + 1,
        product: `${letters[index % letters.length]} · ${chocolates[index % chocolates.length]} · ${index % 4 === 0 ? "klein" : "groot"} · spuit`,
        extras,
      }],
      giftWrap,
      paid: index % 4 !== 1,
    };
  });

  return [...baseOrders, ...extraZiekerstraatOrders];
}

function paginateDistributionOrders(orders: DistributionOrder[]) {
  if (orders.length === 0) return [[]];
  const pages: DistributionOrder[][] = [orders.slice(0, 4)];
  for (let index = 4; index < orders.length; index += 8) {
    pages.push(orders.slice(index, index + 8));
  }
  return pages;
}

function DistributionOrderCard({ order, shop }: Readonly<{ order: DistributionOrder; shop: string }>) {
  const markers = distributionMarkersFor(order);
  const packingInstruction = order.giftWrap && !/inpak|cadeaupapier/i.test(order.note || "")
    ? "Inpakken in cadeaupapier."
    : "";
  const note = [packingInstruction, order.note].filter(Boolean).join(" ");

  return (
    <article className="break-inside-avoid rounded-xl border-2 border-dashed border-[#bdb5aa] p-4">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.12em] text-[#6f6860] sm:text-sm">{order.code}</p>
        <h4 className="text-lg font-black text-[#1a1815]">{order.customerName}</h4>
        <p className="mt-0.5 text-[0.68rem] font-black uppercase tracking-[0.08em] text-[#6b645b]">
          {SHOP_SHORT_LABELS[shop]} · {formatDistributionProductionDate(order.pickupDate)} · <span className={order.paid ? "text-[#24551d]" : "text-[#9a3412]"}>{order.paid ? "Betaald" : "Niet betaald"}</span>
        </p>
      </div>
      <ul className="mt-3 divide-y divide-[#e4ded5] border-y border-[#e4ded5]">
        {order.lines.map((line, index) => (
          <li key={`${order.id}-${index}`} className="flex gap-2 py-2 text-sm">
            <strong className="w-8 shrink-0 text-base">{line.quantity}×</strong>
            <div>
              <p className="font-black">{line.product}</p>
              {line.extras?.length ? <p className="mt-0.5 font-black text-[#a23c2b]">Let op: {line.extras.join(" + ")}</p> : null}
            </div>
          </li>
        ))}
      </ul>
      {note && <p className="mt-2 rounded-lg bg-[#fff3dc] p-2 text-xs font-bold text-[#70460e]">Notitie: {note}</p>}
      <div className="mt-3 flex min-h-7 items-end justify-between gap-3">
        <div className="flex flex-wrap gap-1.5" aria-label="Bijzonderheden">
          {markers.map(({ key, label }) => (
            <span key={key} title={label} aria-label={label} className="flex h-7 w-7 items-center justify-center rounded-full border border-[#8b8278] bg-white text-[#302d29]">
              <span className="h-[1.05rem] w-[1.05rem]"><DistributionMarkerIcon marker={key} /></span>
            </span>
          ))}
        </div>
        <p className="shrink-0 text-right text-xs font-black uppercase tracking-[0.12em] text-[#4d463d]">Compleet □</p>
      </div>
    </article>
  );
}

function DistributionLegend() {
  return (
    <section className="mt-auto break-inside-avoid pt-6">
      <p className="text-[0.58rem] font-black uppercase tracking-[0.15em] text-[#8b8278]">Legenda bijzonderheden</p>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
        {DISTRIBUTION_MARKERS.map(({ key, label }) => (
          <span key={key} className="flex items-center gap-1.5 text-[0.64rem] font-bold text-[#4d463d]">
            <span className="flex h-6 w-6 items-center justify-center rounded-full border border-[#8b8278] bg-white text-[#302d29]">
              <span className="h-3.5 w-3.5"><DistributionMarkerIcon marker={key} /></span>
            </span>
            {label}
          </span>
        ))}
      </div>
    </section>
  );
}

function PrintOptionsDialog({
  batch,
  onClose,
  onSelect,
}: Readonly<{
  batch: ProductionBatchSeed;
  onClose: () => void;
  onSelect: (type: "production" | "distribution") => void;
}>) {
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-[#263b2b]/60 px-3 py-6 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="print-options-title">
      <section className="w-full max-w-lg overflow-hidden rounded-[1.5rem] border border-white/90 bg-[#faf8f2] shadow-2xl sm:rounded-[2rem]">
        <header className="flex items-start justify-between gap-3 border-b border-[#ded7cd] px-4 py-4 sm:px-5">
          <div>
            <p className="text-[0.58rem] font-black uppercase tracking-[0.15em] text-[#778878]">Printlijsten · {formatCompactProductionDate(batch.startDate)}</p>
            <h2 id="print-options-title" className="mt-0.5 text-xl font-black text-[#263b2b]">Welke lijst wil je printen?</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Sluiten" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#dfd8ce] bg-white text-lg font-black">×</button>
        </header>

        <div className="grid gap-2.5 p-3 sm:grid-cols-2 sm:p-5">
          <button type="button" onClick={() => onSelect("production")} className="group rounded-2xl border border-[#bdd0b8] bg-[#edf4eb] p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#24551d] text-xl font-black text-white" aria-hidden="true">✓</span>
            <strong className="mt-3 block text-base text-[#263b2b]">Productielijst bakkerij</strong>
            <span className="mt-1 block text-xs font-semibold leading-relaxed text-[#657063]">Alle letters per smaak, soort en alfabet om tijdens de productie af te werken.</span>
          </button>
          <button type="button" onClick={() => onSelect("distribution")} className="group rounded-2xl border border-[#d7c4cf] bg-[#f3edf1] p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#7b5970] text-lg font-black text-white" aria-hidden="true">↗</span>
            <strong className="mt-3 block text-base text-[#4b352f]">Verdeellijst logistiek</strong>
            <span className="mt-1 block text-xs font-semibold leading-relaxed text-[#75686f]">Klantbonnen en winkelvoorraad, per vestiging op een aparte pagina.</span>
          </button>
        </div>
      </section>
    </div>
  );
}

function DistributionPreviewDialog({ batch, onClose }: Readonly<{ batch: ProductionBatchSeed; onClose: () => void }>) {
  const orders = demoDistributionOrders(batch);
  const shopPageGroups = DISTRIBUTION_SHOPS.map((shop) => {
    const shopOrders = orders.filter((order) => order.shop === shop);
    return { shop, shopOrders, pages: paginateDistributionOrders(shopOrders) };
  });
  const totalPrintPages = shopPageGroups.reduce((total, group) => total + group.pages.length, 0);

  return (
    <div className="letter-distribution-overlay fixed inset-0 z-[90] overflow-y-auto bg-[#263b2b]/65 px-3 py-5 backdrop-blur-sm" role="dialog" aria-modal="true">
      <style jsx global>{`
        @media print {
          @page { size: A4 portrait; margin: 10mm; }
          body * { visibility: hidden !important; }
          .letter-distribution-print, .letter-distribution-print * { visibility: visible !important; }
          .letter-distribution-overlay { position: static !important; overflow: visible !important; background: white !important; padding: 0 !important; }
          .letter-distribution-print {
            position: absolute !important;
            inset: 0 !important;
            width: 100% !important;
            filter: grayscale(100%) contrast(108%) !important;
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
          .letter-distribution-page {
            box-sizing: border-box !important;
            width: 190mm !important;
            min-height: 277mm !important;
            height: 277mm !important;
            margin: 0 auto !important;
            border: 0 !important;
            box-shadow: none !important;
            break-inside: avoid-page;
            page-break-inside: avoid;
            break-after: page;
            page-break-after: always;
          }
          .letter-distribution-page:last-child { break-after: auto; page-break-after: auto; }
          .letter-distribution-no-print { display: none !important; }
        }
      `}</style>
      <div className="letter-distribution-no-print sticky top-0 z-10 mx-auto mb-4 flex max-w-4xl flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/80 bg-[#faf8f2]/95 p-3 shadow-xl backdrop-blur">
        <div>
          <p className="font-black text-[#1a1815]">Preview verdeellijst · {totalPrintPages} printpagina’s</p>
          <p className="text-xs font-semibold text-[#6b645b]">Ziekerstraat bevat tijdelijk twintig fictieve klantbonnen. B2B staat bewust niet in deze lijst.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="h-10 rounded-full border border-[#ddd5ca] bg-white px-4 text-sm font-black text-[#4d463d]">Sluiten</button>
          <button type="button" onClick={() => window.print()} className="h-10 rounded-full bg-[#24551d] px-4 text-sm font-black text-white">Print {totalPrintPages} pagina’s</button>
        </div>
      </div>

      <div className="letter-distribution-print mx-auto max-w-4xl space-y-5 print:space-y-0">
        {shopPageGroups.map(({ shop, shopOrders, pages }) => {
          const orderPieces = shopOrders.reduce((sum, order) => sum + order.lines.reduce((lineSum, line) => lineSum + line.quantity, 0), 0);
          const shopGeneralRows = (batch.storeOrders || []).find((order) => order.shop === shop)?.rows || [];
          const generalPieces = shopGeneralRows.reduce((sum, row) => sum + row.quantity, 0);

          return pages.map((pageOrders, pageIndex) => (
            <section key={`${shop}-${pageIndex}`} className="letter-distribution-page flex min-h-[70rem] aspect-[210/297] flex-col rounded-[1.5rem] border border-[#d8d1c8] bg-white p-7 shadow-2xl">
              <header className="flex items-start justify-between gap-4 border-b-2 border-[#263b2b] pb-4">
                <div>
                  <p className="text-[0.68rem] font-black uppercase tracking-[0.2em] text-[#778878]">Chocoladeletters · verdeellijst</p>
                  <h2 className="mt-1 text-3xl font-black uppercase tracking-[0.08em] text-[#263b2b]">{SHOP_LABELS[shop]}</h2>
                  <p className="mt-1 text-sm font-bold text-[#6b645b]">Productie {formatDistributionProductionDate(batch.startDate)}{pageIndex > 0 ? " · vervolg" : ""}</p>
                </div>
                <div className="rounded-2xl bg-[#e6efe2] px-4 py-3 text-right">
                  <p className="text-[0.6rem] font-black uppercase tracking-[0.12em] text-[#59705c]">Klaarzetten</p>
                  <p className="text-xl font-black text-[#263b2b]">{orderPieces + generalPieces} letters</p>
                  <p className="mt-0.5 text-[0.58rem] font-black uppercase tracking-[0.1em] text-[#59705c]">Pagina {pageIndex + 1} van {pages.length}</p>
                </div>
              </header>

              <div className="mt-4 flex flex-wrap gap-2 text-xs font-black text-[#4d463d]">
                <span className="rounded-full bg-[#f1ede7] px-3 py-1">{shopOrders.length} klantbonnen</span>
                <span className="rounded-full bg-[#f1ede7] px-3 py-1">{orderPieces} voor klanten</span>
                <span className="rounded-full bg-[#e9e0e7] px-3 py-1">{generalPieces} algemene winkelvoorraad</span>
              </div>

              {pageIndex === 0 && (
                <section className="mt-6 break-inside-avoid rounded-2xl border border-[#cab7c2] bg-[#f3edf1] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[0.62rem] font-black uppercase tracking-[0.14em] text-[#806174]">Eerst klaarzetten</p>
                      <h3 className="text-lg font-black text-[#4b352f]">Algemene winkelvoorraad</h3>
                    </div>
                    <span className="rounded-full bg-white px-3 py-1 text-sm font-black text-[#4b352f]">{generalPieces} letters</span>
                  </div>
                  <div className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2">
                    {shopGeneralRows.map((row) => (
                      <p key={row.label} className="flex justify-between gap-3 border-b border-[#d8cbd3] pb-1 text-sm"><span>{row.label}</span><strong>{row.quantity}×</strong></p>
                    ))}
                    {shopGeneralRows.length === 0 && <p className="text-sm font-semibold text-[#6b645b]">Geen algemene winkelvoorraad voor deze ronde.</p>}
                  </div>
                  <div className="mt-4 flex items-center justify-end gap-2.5 text-[#4b352f]">
                    <p className="text-[0.68rem] font-black uppercase tracking-[0.12em]">Toegevoegd aan winkelkrat</p>
                    <span className="h-8 w-8 shrink-0 rounded-md border-2 border-[#4b352f] bg-white" aria-hidden="true" />
                  </div>
                </section>
              )}

              <section className="mt-6">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-xs font-black uppercase tracking-[0.16em] text-[#776f66]">Klantbestellingen{pageIndex > 0 ? " · vervolg" : ""}</h3>
                  <span className="text-[0.62rem] font-black uppercase tracking-[0.12em] text-[#9a9187]">
                    {shopOrders.length === 0
                      ? "Geen bonnen"
                      : `Bon ${pageIndex === 0 ? 1 : 5 + ((pageIndex - 1) * 8)}–${Math.min(shopOrders.length, pageIndex === 0 ? 4 : 4 + (pageIndex * 8))} van ${shopOrders.length}`}
                  </span>
                </div>
                <div className="mt-2 grid gap-3 sm:grid-cols-2">
                  {pageOrders.map((order) => <DistributionOrderCard key={order.id} order={order} shop={shop} />)}
                  {shopOrders.length === 0 && <p className="rounded-xl border border-dashed border-[#cfc8be] p-4 text-sm font-semibold text-[#6b645b]">Geen klantbestellingen voor deze winkel.</p>}
                </div>
              </section>

              <DistributionLegend />

              <footer className="mt-4 flex items-center justify-between border-t border-[#d8d1c8] pt-3 text-[0.65rem] font-bold text-[#8b8278]">
                <span>Strik Patisserie · interne verdeellijst</span><span>{SHOP_LABELS[shop]} · Pagina {pageIndex + 1} van {pages.length}</span>
              </footer>
            </section>
          ));
        })}
      </div>
    </div>
  );
}

function ProductionPrintPreviewDialog({ batch, onClose }: Readonly<{ batch: ProductionBatchSeed; onClose: () => void }>) {
  const totals = totalsFor(batch.rows);
  const totalToMake = totals.orders + totals.stock;
  const totalOpen = Math.max(0, totalToMake - totals.produced);

  return (
    <div className="production-checklist-overlay fixed inset-0 z-[95] overflow-y-auto bg-[#263b2b]/65 px-2 py-4 backdrop-blur-sm sm:px-4" role="dialog" aria-modal="true">
      <style jsx global>{`
        @media print {
          @page { size: A4 portrait; margin: 10mm; }
          body * { visibility: hidden !important; }
          .production-checklist-print, .production-checklist-print * { visibility: visible !important; }
          .production-checklist-overlay { position: static !important; overflow: visible !important; background: white !important; padding: 0 !important; }
          .production-checklist-print { position: absolute !important; inset: 0 !important; width: 100% !important; margin: 0 !important; border: 0 !important; box-shadow: none !important; }
          .production-checklist-no-print { display: none !important; }
          .production-checklist-row { break-inside: avoid; page-break-inside: avoid; }
          .production-checklist-print thead { display: table-header-group; }
          .production-checklist-print {
            filter: grayscale(100%) contrast(108%) !important;
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
        }
      `}</style>

      <div className="production-checklist-no-print sticky top-0 z-10 mx-auto mb-3 flex max-w-5xl flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/80 bg-[#faf8f2]/95 p-3 shadow-xl backdrop-blur">
        <div>
          <p className="font-black text-[#1a1815]">Preview productielijst · {formatCompactProductionDate(batch.startDate)}</p>
          <p className="text-xs font-semibold text-[#6b645b]">Eén duidelijke afwerklijst voor de bakkerij.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="h-9 rounded-full border border-[#ddd5ca] bg-white px-4 text-xs font-black text-[#4d463d]">Sluiten</button>
          <button type="button" onClick={() => window.print()} className="h-9 rounded-full bg-[#24551d] px-4 text-xs font-black text-white">Print productielijst</button>
        </div>
      </div>

      <section className="production-checklist-print mx-auto max-w-5xl overflow-hidden rounded-[1.5rem] border border-[#cfc8be] bg-white p-5 shadow-2xl sm:p-7">
        <header className="border-b-2 border-[#263b2b] pb-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[0.66rem] font-black uppercase tracking-[0.2em] text-[#778878]">Strik Patisserie · chocoladeletters</p>
              <h2 className="mt-1 text-3xl font-black text-[#263b2b]">Productielijst</h2>
              <p className="mt-1 text-lg font-black text-[#4b352f]">{formatCompactProductionDate(batch.startDate)}</p>
            </div>
            <div className="grid grid-cols-3 overflow-hidden rounded-xl border border-[#d8d1c8] text-center">
              <div className="px-3 py-2">
                <span className="block text-[0.55rem] font-black uppercase tracking-[0.1em] text-[#776f66]">Totaal</span>
                <strong className="text-xl">{totalToMake}</strong>
              </div>
              <div className="border-x border-[#d8d1c8] px-3 py-2">
                <span className="block text-[0.55rem] font-black uppercase tracking-[0.1em] text-[#776f66]">Gereed</span>
                <strong className="text-xl text-[#5f3f00]">{totals.produced}</strong>
              </div>
              <div className="bg-[#fff2e9] px-3 py-2">
                <span className="block text-[0.55rem] font-black uppercase tracking-[0.1em] text-[#8a4937]">Open</span>
                <strong className="text-xl text-[#9a3412]">{totalOpen}</strong>
              </div>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-5 text-xs font-bold text-[#6b645b]">
            <p>Bakker: <span className="ml-2 inline-block w-44 border-b border-[#8b8278]">&nbsp;</span></p>
            <p>Datum/tijd gereed: <span className="ml-2 inline-block w-32 border-b border-[#8b8278]">&nbsp;</span></p>
          </div>
        </header>

        <div className="mt-4 space-y-4">
          {productionSections(batch.rows).map((section) => (
            <section key={section.key} className="overflow-hidden rounded-xl border border-[#d8d1c8] bg-white">
              <h3 className="border-b border-[#bfcfbb] bg-[#dcebd8] px-3 py-2 text-[0.7rem] font-black uppercase tracking-[0.14em] text-[#24551d]">{section.label}</h3>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[620px] border-collapse text-left">
                  <thead>
                    <tr className="bg-[#fffdfa] text-[0.58rem] italic tracking-[0.05em] text-[#9a9187]">
                      <th className="px-3 py-1.5 font-medium">Letter en uitvoering</th>
                      <th className="w-16 px-1 py-1.5 text-center text-[0.5rem] font-normal text-[#aaa197]">Besteld</th>
                      <th className="w-16 px-1 py-1.5 text-center text-[0.5rem] font-normal text-[#aaa197]">Winkel</th>
                      <th className="w-16 border-x-2 border-[#a9a29a] bg-[#ededeb] px-1 py-1.5 text-center text-[0.62rem] font-black uppercase text-[#302d29]">Totaal</th>
                      <th className="w-20 px-2 py-1.5 text-center font-medium">Klaar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {section.groups.map((group) => {
                      const flavourTheme = productionFlavourTheme(group.flavour);
                      return (
                      <Fragment key={`${section.key}-${group.key}`}>
                        <tr className="bg-white">
                          <td colSpan={5} className="px-3 pb-1 pt-2">
                            <div className="flex items-center gap-2">
                              <span className={`shrink-0 text-[0.58rem] font-bold italic uppercase tracking-[0.12em] ${flavourTheme.label}`}>{group.label}</span>
                              <span className={`h-px flex-1 opacity-55 ${flavourTheme.line}`} />
                            </div>
                          </td>
                        </tr>
                        {group.rows.map((row) => {
                          const planned = row.orders + row.stock;
                          const variant = productionVariant(row.label);
                          const isSpecial = variant.extras.length > 0;
                          const isComplete = productionRowIsComplete(row);
                          const rowTheme = productionFlavourTheme(variant.chocolate);
                          return (
                            <tr key={row.key} className="production-checklist-row border-t border-[#eee9e2] bg-white">
                              <td className="p-0">
                                <div className="flex min-h-12 items-stretch">
                                  <span className={`flex w-[1.4rem] shrink-0 items-center justify-center py-1 text-[0.48rem] font-black uppercase tracking-[0.08em] [writing-mode:vertical-rl] ${rowTheme.rail}`}>{productionValueLabel(variant.chocolate)}</span>
                                  <div className="flex flex-1 flex-wrap items-center gap-1.5 px-3 py-2.5">
                                    <strong className="text-base text-[#1a1815]">{variant.letter}</strong>
                                    {isSpecial && (
                                      <>
                                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#d75a48] text-[0.7rem] font-black text-white">!</span>
                                        {variant.extras.map((extra) => (
                                          <span key={extra} className="rounded-full border border-[#e4c17b] bg-[#fffaf0] px-2 py-0.5 text-[0.62rem] font-black text-[#765019]">{extra}</span>
                                        ))}
                                      </>
                                    )}
                                  </div>
                                </div>
                              </td>
                              <td className="px-1 py-2.5 text-center text-[0.68rem] font-medium text-[#88827b]">{row.orders}</td>
                              <td className="px-1 py-2.5 text-center text-[0.68rem] font-medium text-[#88827b]">{row.stock}</td>
                              <td className="border-x-2 border-[#a9a29a] bg-[#ededeb] px-1 py-2.5 text-center text-xl font-black text-black">{planned}</td>
                              <td className={`px-2 py-2.5 text-center text-2xl font-black ${isComplete ? "text-[#24551d]" : "text-[#8b8278]"}`}>{isComplete ? "✓" : "□"}</td>
                            </tr>
                          );
                        })}
                      </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>

        <footer className="mt-5 flex items-center justify-between border-t border-[#d8d1c8] pt-3 text-[0.62rem] font-bold text-[#8b8278]">
          <span>Werk regel voor regel af en controleer afwijkingen vóór verpakken.</span>
          <span>Productieronde {formatCompactProductionDate(batch.startDate)}</span>
        </footer>
      </section>
    </div>
  );
}

export default function ProductionPlanningClient({
  season,
  batches,
  centralUnplannedCount,
  demoMode = false,
}: Readonly<{
  season: string;
  batches: ProductionBatchSeed[];
  centralUnplannedCount: number;
  demoMode?: boolean;
}>) {
  const [legacyOrders, setLegacyOrders] = useState<ChocolateLetterOrder[]>([]);
  const [b2bOrders, setB2BOrders] = useState<SinterklaasB2BOrder[]>([]);
  const [loading, setLoading] = useState(!demoMode);
  const [warning, setWarning] = useState("");
  const [storeOrderBatch, setStoreOrderBatch] = useState<ProductionBatchSeed | null>(null);
  const [storeOrderInitialShop, setStoreOrderInitialShop] = useState(DISTRIBUTION_SHOPS[0]);
  const [printOptionsBatch, setPrintOptionsBatch] = useState<ProductionBatchSeed | null>(null);
  const [distributionBatch, setDistributionBatch] = useState<ProductionBatchSeed | null>(null);
  const [productionPrintBatch, setProductionPrintBatch] = useState<ProductionBatchSeed | null>(null);
  const [showGrandOverview, setShowGrandOverview] = useState(false);
  const [storeOrdersByBatch, setStoreOrdersByBatch] = useState<Record<string, StoreStockOrder[]>>(() =>
    Object.fromEntries(batches.map((batch) => [batch.id, batch.storeOrders || []]))
  );
  const [stockRowsByBatch, setStockRowsByBatch] = useState<Record<string, StoreOrderRow[]>>({});
  const [producedRowsByBatch, setProducedRowsByBatch] = useState<Record<string, ProductionSeedRow[]>>({});

  useEffect(() => {
    if (demoMode) {
      setLegacyOrders([]);
      setB2BOrders([]);
      setLoading(false);
      setWarning("");
      return;
    }

    let active = true;
    Promise.allSettled([fetchLetterOrders(season), fetchB2BOrders(season)])
      .then(([lettersResult, b2bResult]) => {
        if (!active) return;
        if (lettersResult.status === "fulfilled") setLegacyOrders(lettersResult.value);
        if (b2bResult.status === "fulfilled") setB2BOrders(b2bResult.value);
        const failed = [lettersResult, b2bResult].filter((result) => result.status === "rejected").length;
        if (failed > 0) setWarning("Een bestaande bestellijst kon niet worden geladen. De centrale online aantallen staan wel in beeld.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [demoMode, season]);

  const overview = useMemo(() => {
    const rowsByDate = new Map<string, Map<string, WorkingRow>>();
    for (const batch of batches) {
      rowsByDate.set(
        batch.date,
        new Map(batch.rows.map((row) => [row.key, { ...row }]))
      );
    }

    Object.entries(stockRowsByBatch).forEach(([batchId, aggregateRows]) => {
      const batch = batches.find((item) => item.id === batchId);
      const rows = batch ? rowsByDate.get(batch.date) : undefined;
      if (!rows) return;
      rows.forEach((row) => { row.stock = 0; });
      aggregateRows.forEach((update) => {
        const current = rows.get(update.key) || {
          key: update.key,
          label: update.label,
          orders: 0,
          stock: 0,
          produced: 0,
        };
        current.stock = update.quantity;
        rows.set(update.key, current);
      });
    });

    Object.entries(producedRowsByBatch).forEach(([batchId, producedRows]) => {
      const batch = batches.find((item) => item.id === batchId);
      const rows = batch ? rowsByDate.get(batch.date) : undefined;
      if (!rows) return;
      producedRows.forEach((update) => {
        const current = rows.get(update.key);
        if (current) current.produced = update.produced;
      });
    });

    const unplanned: string[] = [];
    const addOrderLine = (date: string, key: string, label: string, quantity: number) => {
      const rows = rowsByDate.get(date);
      if (!rows) return;
      const current = rows.get(key) || { key, label, orders: 0, stock: 0, produced: 0 };
      current.orders += quantity;
      rows.set(key, current);
    };

    legacyOrders
      .filter((order) => !order.productionDone && !order.pickedUp && order.status !== "opgehaald" && order.status !== "geannuleerd")
      .forEach((order) => {
        const date = findProductionDate(batches, order.pickupDate);
        if (!date) {
          unplanned.push(`${order.code} · ${order.customerName}`);
          return;
        }
        order.lines.forEach((line) => {
          const identity = legacyLineIdentity(line);
          addOrderLine(date, identity.key, identity.label, line.quantity);
        });
      });

    b2bOrders
      .filter((order) => {
        const done = order.department === "beide" || order.department === "bakkerij"
          ? order.letterProductionDone
          : order.productionDone;
        return order.status === "akkoord" && !order.cancelled && !order.delivered && !done;
      })
      .forEach((order) => {
        const date = findProductionDate(batches, order.deliveryDate, order.productionDate);
        if (!date || order.letterLines.length === 0) {
          unplanned.push(`B2B · ${order.customerName}`);
          return;
        }
        order.letterLines.forEach((line) => {
          const extras = [order.logo ? "logo" : "", ...line.exceptions].filter(Boolean);
          const label = [line.letter, line.chocolate, line.size, line.style, ...extras].join(" · ");
          const key = [line.letter, line.chocolate, line.size, line.style, ...extras].join("|").toLocaleLowerCase("nl-NL");
          addOrderLine(date, key, label, line.quantity);
        });
      });

    const batchViews = batches.map((batch) => ({
      ...batch,
      storeOrders: storeOrdersByBatch[batch.id] || batch.storeOrders || [],
      rows: [...(rowsByDate.get(batch.date)?.values() || [])].sort(compareProductionRows),
    }));
    const grandRows = new Map<string, WorkingRow>();
    batchViews.forEach((batch) => batch.rows.forEach((row) => {
      const current = grandRows.get(row.key) || { key: row.key, label: row.label, orders: 0, stock: 0, produced: 0 };
      current.orders += row.orders;
      current.stock += row.stock;
      current.produced += row.produced;
      grandRows.set(row.key, current);
    }));

    return {
      batches: batchViews,
      grandRows: [...grandRows.values()].sort(compareProductionRows),
      unplanned,
    };
  }, [b2bOrders, batches, legacyOrders, producedRowsByBatch, stockRowsByBatch, storeOrdersByBatch]);

  const grandTotals = overview.batches.reduce(
    (total, batch) => {
      const batchTotals = totalsFor(batch.rows);
      return {
        orders: total.orders + batchTotals.orders,
        stock: total.stock + batchTotals.stock,
        produced: total.produced + batchTotals.produced,
      };
    },
    { orders: 0, stock: 0, produced: 0 }
  );
  const totalToMake = grandTotals.orders + grandTotals.stock;

  function toggleProductionRow(batch: ProductionBatchSeed, selectedRow: WorkingRow) {
    setProducedRowsByBatch((current) => ({
      ...current,
      [batch.id]: batch.rows.map((row) => {
        if (row.key !== selectedRow.key) return row;
        return {
          ...row,
          produced: productionRowIsComplete(row) ? 0 : row.orders + row.stock,
        };
      }),
    }));
  }

  return (
    <div className="space-y-3 sm:space-y-5">
      {demoMode && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[#e6be62] bg-[#fff4cc] px-4 py-3 text-sm text-[#62460b] shadow-sm">
          <p><strong>Tijdelijke demoweergave</strong> · alle aantallen en bestellingen hieronder zijn fictief.</p>
          <a href="/sinterklaas/letters/productie" className="font-black underline underline-offset-2">Demo sluiten</a>
        </div>
      )}
      {loading && (
        <p className="border border-[#d8d1c8] bg-white px-3 py-2 text-sm font-bold text-[#6b645b]">
          Bestaande B2B- en winkelbestellingen worden erbij geladen...
        </p>
      )}
      {warning && <p role="alert" className="border border-[#efb8aa] bg-[#fff4ef] px-3 py-2 text-sm font-bold text-[#9a3412]">{warning}</p>}

      <section className="overflow-hidden rounded-2xl border border-white/80 bg-[#edf1e8]/90 shadow-sm">
        <div className="flex flex-wrap items-center gap-2 px-3 py-2.5 sm:px-4">
          <div className="mr-auto min-w-[9rem]">
            <p className="text-[0.58rem] font-black uppercase tracking-[0.14em] text-[#748071]">Alle rondes samen</p>
            <p className="text-sm font-black text-[#263b2b]">Compact totaaloverzicht</p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <p className="rounded-full bg-white px-2.5 py-1 text-[0.65rem] font-bold text-[#615a52]"><strong className="mr-1 text-sm text-[#1a1815]">{totalToMake}</strong> te maken</p>
            <p className="rounded-full bg-white px-2.5 py-1 text-[0.65rem] font-bold text-[#615a52]"><strong className="mr-1 text-sm text-[#5f3f00]">{grandTotals.produced}</strong> gereed</p>
            <p className="rounded-full bg-[#fff2e9] px-2.5 py-1 text-[0.65rem] font-bold text-[#7c3a28]"><strong className="mr-1 text-sm text-[#9a3412]">{Math.max(0, totalToMake - grandTotals.produced)}</strong> open</p>
          </div>
          <button type="button" onClick={() => setShowGrandOverview((current) => !current)} className="rounded-full border border-[#cbd6c7] bg-white px-3 py-1 text-[0.65rem] font-black text-[#36523a]">
            {showGrandOverview ? "Verberg lijst ↑" : "Bekijk totaallijst ↓"}
          </button>
        </div>
        {showGrandOverview && (
          <div className="border-t border-[#d7dfd3] bg-white">
            <ProductionTable rows={overview.grandRows} />
          </div>
        )}
      </section>

      {(centralUnplannedCount > 0 || overview.unplanned.length > 0) && (
        <section className="border border-[#e4c76c] bg-[#fff8d8] p-3">
          <h2 className="font-black text-[#5f3f00]">Nog niet aan een productiedag gekoppeld</h2>
          {centralUnplannedCount > 0 && <p className="mt-1 text-sm font-semibold">{centralUnplannedCount} centrale orderregel(s) zijn nog niet volledig ingepland.</p>}
          {overview.unplanned.length > 0 && (
            <p className="mt-1 text-sm font-semibold">
              {overview.unplanned.length} bestaande bestelling(en): {overview.unplanned.slice(0, 6).join(" · ")}{overview.unplanned.length > 6 ? ` · +${overview.unplanned.length - 6}` : ""}
            </p>
          )}
        </section>
      )}

      <div className="space-y-4">
        {overview.batches.map((batch) => {
          const totals = totalsFor(batch.rows);
          const planned = totals.orders + totals.stock;
          const storeStockTotal = (batch.storeOrders || []).reduce((sum, order) => sum + storeOrderTotal(order), 0);
          const storeOrdersLocked = batchIsLocked(batch);
          return (
            <section key={batch.id} className="overflow-hidden rounded-2xl border border-[#d8d1c8] bg-white shadow-sm">
              <div className="relative flex flex-wrap items-center justify-between gap-2 bg-[#f7df83] py-2 pl-3 pr-12 sm:gap-3 sm:py-2.5 sm:pl-4 sm:pr-14">
                <div>
                  <p className="text-[0.56rem] font-black uppercase tracking-[0.11em] text-[#6b5120] sm:text-[0.62rem]">Centrale productieronde</p>
                  <h2 className="mt-0.5 text-sm font-black leading-tight text-[#1a1815] sm:text-base md:text-lg">{formatCompactProductionDate(batch.startDate)}</h2>
                </div>
                <div className="flex w-full flex-wrap items-center gap-1.5 sm:w-auto sm:justify-end sm:gap-2">
                  {demoMode && (
                    <button
                      type="button"
                      onClick={() => setPrintOptionsBatch(batch)}
                      aria-label="Printlijsten openen"
                      title="Printlijsten"
                      className="flex h-8 w-8 items-center justify-center rounded-full border border-[#24551d]/15 bg-[#24551d] text-white shadow-sm transition hover:scale-105 sm:h-9 sm:w-9"
                    >
                      <svg viewBox="0 0 24 24" className="h-4 w-4 sm:h-[1.1rem] sm:w-[1.1rem]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M6 9V3h12v6" />
                        <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                        <rect x="6" y="14" width="12" height="7" rx="1" />
                      </svg>
                    </button>
                  )}
                  <button type="button" onClick={() => { setStoreOrderInitialShop(DISTRIBUTION_SHOPS[0]); setStoreOrderBatch(batch); }} className="rounded-full border border-white/80 bg-white/90 px-2.5 py-1 text-[0.65rem] font-black text-[#4b352f] shadow-sm sm:px-3 sm:py-1.5 sm:text-xs">
                    {storeOrdersLocked ? "Bekijk winkelvoorraad" : storeStockTotal > 0 ? "Winkelvoorraad wijzigen" : "+ Winkelvoorraad per winkel"}
                  </button>
                  <span className="bg-white/80 px-2 py-1 text-[0.64rem] font-black text-[#5f3f00] sm:px-3 sm:text-xs">{planned} te maken</span>
                </div>
                <span
                  role="img"
                  aria-label={batchIsPlanned(batch.status) ? "Productieronde ingepland" : "Productieronde nog niet ingepland"}
                  title={batchIsPlanned(batch.status) ? "Ingepland" : "Nog niet ingepland"}
                  className={`absolute right-3 top-2.5 flex h-7 w-7 items-center justify-center rounded-full border sm:right-4 sm:top-3 sm:h-8 sm:w-8 ${batchIsPlanned(batch.status) ? "border-[#24551d] bg-[#24551d] text-white" : "border-[#c9c2b8] bg-white/55 text-[#aaa197]"}`}
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="m5 12 4 4L19 6" />
                  </svg>
                </span>
              </div>
              <div className="grid grid-cols-3 border-b border-[#e4ded5] bg-[#fffdf6] text-center text-[0.68rem] sm:text-xs">
                <p className="border-r p-1.5 sm:p-2">Totaal te maken <strong className="block text-sm sm:text-base">{planned}</strong></p>
                <p className="border-r p-1.5 sm:p-2">Gereed <strong className="block text-sm sm:text-base">{totals.produced}</strong></p>
                <p className="p-1.5 sm:p-2">Open <strong className="block text-sm text-[#9a3412] sm:text-base">{Math.max(0, planned - totals.produced)}</strong></p>
              </div>
              <ProductionTable
                rows={batch.rows}
                onToggleComplete={demoMode ? (row) => toggleProductionRow(batch, row) : undefined}
              />
              <div className="border-t border-[#e4ded5] bg-[#f7f3ee] p-2.5 sm:p-3">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[0.64rem] font-black uppercase tracking-[0.13em] text-[#776f66]">Bevestigde winkelvoorraad per vestiging</p>
                  <p className="text-xs font-bold text-[#6b645b]">{storeOrdersLocked ? "Vergrendeld" : `Wijzigbaar tot ${formatDeadline(batch.deadlineAt)}`}</p>
                </div>
                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4 sm:gap-2">
                  {DISTRIBUTION_SHOPS.map((shop) => {
                    const total = storeOrderTotal((batch.storeOrders || []).find((order) => order.shop === shop));
                    return (
                      <button key={shop} type="button" onClick={() => { setStoreOrderInitialShop(shop); setStoreOrderBatch(batch); }} className="rounded-xl border border-[#ded7cd] bg-white px-2.5 py-1.5 text-left sm:px-3 sm:py-2">
                        <span className="block text-xs font-black text-[#4d463d]">{SHOP_LABELS[shop]}</span>
                        <span className={`mt-0.5 block text-sm font-black ${total > 0 ? "text-[#24551d]" : "text-[#aaa197]"}`}>{total > 0 ? `${total} letters` : "Nog geen bestelling"}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>
          );
        })}
      </div>
      {printOptionsBatch && (
        <PrintOptionsDialog
          batch={printOptionsBatch}
          onClose={() => setPrintOptionsBatch(null)}
          onSelect={(type) => {
            const selectedBatch = printOptionsBatch;
            setPrintOptionsBatch(null);
            if (type === "production") setProductionPrintBatch(selectedBatch);
            else setDistributionBatch(selectedBatch);
          }}
        />
      )}
      {storeOrderBatch && (
        <GeneralStoreOrderDialog
          batch={storeOrderBatch}
          demoMode={demoMode}
          initialShop={storeOrderInitialShop}
          onClose={() => setStoreOrderBatch(null)}
          onSaved={(result) => {
            setStoreOrdersByBatch((current) => ({ ...current, [result.batchId]: result.orders }));
            setStockRowsByBatch((current) => ({ ...current, [result.batchId]: result.aggregateRows }));
            setStoreOrderBatch(null);
          }}
        />
      )}
      {distributionBatch && (
        <DistributionPreviewDialog batch={distributionBatch} onClose={() => setDistributionBatch(null)} />
      )}
      {productionPrintBatch && (
        <ProductionPrintPreviewDialog batch={productionPrintBatch} onClose={() => setProductionPrintBatch(null)} />
      )}
    </div>
  );
}
