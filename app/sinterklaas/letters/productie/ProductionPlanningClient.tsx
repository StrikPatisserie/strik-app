"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { productionDeadlinePassed, productionRemaining, productionTotals as totalsFor, type ProductionChecklist } from "./productionChecklist";
import styles from "./ProductionPlanning.module.css";
import ProductionPrintPreviewDialog from "./ProductionPrintPreview";
import { compareProductionRows, productionRowIsComplete, productionSections, productionValueLabel, productionVariant } from "./productionPresentation";
import { aggregateProductionRows, productionSourceBreakdown, type ProductionSeedRow } from "./productionSources";
export type { ProductionSeedRow } from "./productionSources";

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

type StartDistribution = {
  id: string;
  date: string;
  createdAt: string;
  updatedAt: string;
  orders: StoreStockOrder[];
};

type StartDistributionResult = {
  season: string;
  distributions: StartDistribution[];
  message?: string;
};

export type ProductionBatchSeed = {
  id: string;
  startDate: string;
  date: string;
  pickupFrom?: string;
  deadlineAt?: string;
  status: string;
  minimumLeadDays: number;
  checklist?: ProductionChecklist;
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

function formatShortDate(date: string) {
  return new Intl.DateTimeFormat("nl-NL", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${date}T12:00:00`)).replaceAll(".", "");
}

function todayInAmsterdam() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Amsterdam",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value || "";
  return `${value("year")}-${value("month")}-${value("day")}`;
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

function distributionTotal(distribution: StartDistribution) {
  return distribution.orders.reduce((sum, order) => sum + storeOrderTotal(order), 0);
}

function batchIsLocked(batch: ProductionBatchSeed) {
  return Boolean(batch.checklist) || productionDeadlinePassed(batch);
}

function addDays(date: string, days: number) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

function batchIsPlanned(status: string) {
  return ["PLANNED", "IN_PRODUCTION", "COMPLETED", "CLOSED"].includes(status);
}

function ProductionTable({
  rows,
  onToggleComplete,
  onEditQuantity,
  saving = false,
}: Readonly<{
  rows: WorkingRow[];
  onToggleComplete?: (row: WorkingRow) => void;
  onEditQuantity?: (row: WorkingRow) => void;
  saving?: boolean;
}>) {
  if (rows.length === 0) return <p className={styles.empty}>Nog geen letters ingepland.</p>;

  return (
    <div className={styles.tables}>
      {productionSections(rows).map((section) => (
        <section key={section.key} className={styles.tableSection}>
          <div className={styles.sectionHeading}>
            <h3>{section.label}</h3>
            <span>{section.groups.reduce((sum, group) => sum + group.rows.reduce((count, row) => count + row.orders + row.stock, 0), 0)} stuks</span>
          </div>
          <table className={styles.table}>
            <caption>{section.label} · aantallen voor productie</caption>
            <thead>
              <tr>
                <th scope="col" className={styles.letterCol}>Letter</th>
                <th scope="col" className={styles.numberCol}>Besteld</th>
                <th scope="col" className={styles.numberCol}>Winkel</th>
                <th scope="col" className={styles.totalCol}>Totaal</th>
                <th scope="col" className={styles.stateCol}>Status</th>
                <th scope="col" className={styles.sourceCol}>Herkomst</th>
              </tr>
            </thead>
            {section.groups.map((group) => (
              <tbody key={`${section.key}-${group.key}`}>
                <tr className={styles.groupRow}>
                  <th colSpan={6} scope="rowgroup"><span className={styles.flavour} data-flavour={group.flavour}>{group.label}</span></th>
                </tr>
                {group.rows.map((row) => {
                  const planned = row.orders + row.stock;
                  const variant = productionVariant(row.label);
                  const isComplete = productionRowIsComplete(row);
                  return (
                    <tr key={row.key} data-complete={isComplete}>
                      <td className={styles.letterCell}>
                        <div className={styles.letterLine}>
                          <strong>{variant.letter}</strong>
                          <span className={styles.variant}>{productionValueLabel(variant.chocolate)} · {productionValueLabel(variant.size)}</span>
                        </div>
                        {variant.extras.length > 0 && <div className={styles.extras}>
                          {variant.extras.map((extra, index) => <span key={`${extra}-${index}`} className={styles.extra}>{index === 0 && <span className={styles.extraMark} aria-label="Afwijking">!</span>}{extra}</span>)}
                        </div>}
                      </td>
                      <td className={styles.quantity}>{row.orders}</td>
                      <td className={styles.quantity}>{row.stock}</td>
                      <td className={styles.total}>{planned}</td>
                      <td className={styles.stateCell}>
                        {onToggleComplete && planned > 0 ? (
                          <button type="button" role="checkbox" aria-checked={isComplete}
                            aria-label={`${row.label} ${isComplete ? "weer openzetten" : "als geproduceerd markeren"}`}
                            disabled={saving} onClick={() => onToggleComplete(row)} className={styles.completeButton}>
                            {isComplete ? "✓" : ""}
                          </button>
                        ) : <span className={styles.status} data-complete={isComplete}>{planned === 0 ? "Vervallen" : isComplete ? "Gereed" : "Open"}</span>}
                        {onEditQuantity && <button type="button" disabled={saving} className={styles.amountButton} onClick={() => onEditQuantity(row)} aria-label={`Geproduceerd aantal voor ${row.label} aanpassen`}>{row.produced}/{planned}</button>}
                        {!onEditQuantity && row.produced > 0 && !isComplete && <small className={styles.partial}>{row.produced}/{planned} gereed</small>}
                      </td>
                      <td className={styles.sourceCell}>
                        <div className={styles.sourceBadges}>
                          {productionSourceBreakdown(row).filter(({ id }) => id !== "voorraad").map(({ id, label, quantity }) => <span key={id} className={styles.sourceBadge} data-source={id} title={`${label}: ${quantity} ${quantity === 1 ? "letter" : "letters"}`}>
                            <span>{label}</span><b>{quantity}</b>
                          </span>)}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            ))}
          </table>
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
    if (!review || saving || locked) return;
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
    <div className={`${styles.dialog} fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-[#263b2b]/45 px-2 py-3 backdrop-blur-sm sm:px-3 sm:py-8`} role="dialog" aria-modal="true" aria-label="Winkelvoorraad bestellen">
      <form onSubmit={submit} className="w-full max-w-3xl rounded-[1.4rem] border border-white/90 bg-[#faf8f2] p-3 shadow-2xl sm:rounded-[2rem] sm:p-5 lg:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className={styles.dialogHeading}>Algemene winkelvoorraad</p>
            <h2 className="mt-0.5 text-lg font-black text-[#1a1815] sm:mt-1 sm:text-xl">{review ? "Bestelling controleren" : "Winkelbestelling maken"}</h2>
            <p className="mt-1 text-xs font-bold text-[#6b645b]">Productieronde {formatProductionPeriod(batch.startDate, batch.date)}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Sluiten" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#dfd8ce] bg-white text-lg font-black sm:h-9 sm:w-9 sm:text-xl">×</button>
        </div>

        <div className={styles.shopGrid}>
          {DISTRIBUTION_SHOPS.map((shop) => {
            const total = (drafts[shop] || []).reduce((sum, row) => sum + row.quantity, 0);
            return (
              <button
                key={shop}
                type="button"
                onClick={() => { setSelectedShop(shop); setReview(false); setError(""); }}
                className={styles.shop} data-selected={selectedShop === shop} aria-pressed={selectedShop === shop}
              >
                <span className="block text-[0.62rem] font-black uppercase tracking-[0.06em] text-[#4d463d] sm:text-xs sm:tracking-[0.08em]">{SHOP_LABELS[shop]}</span>
                <small>{total > 0 ? `${total} letters` : "Nog leeg"}</small>
              </button>
            );
          })}
        </div>

        <div className={styles.dialogNote}>
          {locked
            ? "De besteldeadline is verstreken; deze winkelbestellingen zijn vergrendeld."
            : `Je kunt bevestigde bestellingen wijzigen tot ${formatDeadline(batch.deadlineAt)}.`}
        </div>

        {!review ? (
          <>
            <section className={styles.dialogPanel}>
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-[0.62rem] font-black uppercase tracking-[0.14em] text-[#8b8278]">Bestelling voor</p>
                  <h3 className="text-base font-black text-[#263b2b] sm:text-lg">{SHOP_LABELS[selectedShop]}</h3>
                </div>
                <strong className={styles.dialogTotal}>{rowsTotal} letters</strong>
              </div>

              {!locked && (
                <div className="mt-3 grid grid-cols-2 gap-2 sm:mt-4 sm:grid-cols-5 sm:gap-3">
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
                  <label className="col-span-2 text-[0.58rem] font-black uppercase tracking-[0.08em] text-[#6b645b] sm:col-span-1 sm:text-xs sm:tracking-[0.1em]">Aantal
                    <input type="number" min={1} max={10000} value={quantity} onChange={(event) => setQuantity(Math.max(1, Number(event.target.value) || 1))} className="mt-1 h-9 w-full rounded-lg border border-[#ddd5ca] bg-white px-2 text-xs font-black text-[#1a1815] sm:h-11 sm:rounded-xl sm:px-3 sm:text-sm" />
                  </label>
                  <button type="button" onClick={addLine} className={`${styles.button} col-span-2 sm:col-span-5`}>+ Zet op totaallijst van {SHOP_LABELS[selectedShop]}</button>
                </div>
              )}
            </section>

            <section className={styles.dialogList}>
              <div className={styles.dialogListHead}>
                <h3 className="text-xs font-black sm:text-sm">Totaallijst {SHOP_LABELS[selectedShop]}</h3>
                <span className="text-[0.65rem] font-black text-[#6b645b] sm:text-xs">{rows.length} regels · {rowsTotal} stuks</span>
              </div>
              {rows.length === 0 ? (
                <p className="px-3 py-3 text-xs font-semibold text-[#776f66] sm:px-4 sm:py-5 sm:text-sm">Nog geen letters toegevoegd.</p>
              ) : (
                <div className="divide-y divide-[#e4ded5]">
                  {rows.map((row) => (
                    <div key={row.key} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 sm:gap-3 sm:px-4 sm:py-3">
                      <p className={styles.dialogLineLabel}>{row.letter}<small>{productionValueLabel(row.flavour)} · {productionValueLabel(row.size)} · {productionValueLabel(row.style)}</small></p>
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
          <section className={styles.dialogPanel}>
            <p className={styles.dialogHeading}>Laatste controle</p>
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
          <button type="button" onClick={onClose} className={styles.button}>Annuleren</button>
          {review ? (
            <>
              <button type="button" onClick={() => setReview(false)} className={styles.button}>← Nog wijzigen</button>
              <button key="save-stock" type="submit" disabled={saving || locked} className={styles.primary}>{saving ? "Opslaan..." : existingRows.length > 0 ? "Ja, wijzigingen opslaan" : "Ja, toevoegen aan productie"}</button>
            </>
          ) : (
            <button key="review-stock" type="button" onClick={() => setReview(true)} disabled={locked || (rows.length === 0 && existingRows.length === 0)} className={styles.primary}>Controleer deze winkelbestelling →</button>
          )}
        </div>
      </form>
    </div>
  );
}

function StartDistributionDialog({
  season,
  initial,
  onClose,
  onSaved,
  onAutosaved,
}: Readonly<{
  season: string;
  initial: StartDistribution | null;
  onClose: () => void;
  onSaved: (result: StartDistributionResult) => void;
  onAutosaved: (result: StartDistributionResult) => void;
}>) {
  const defaultDate = todayInAmsterdam().startsWith(`${season}-`) ? todayInAmsterdam() : `${season}-09-01`;
  const [date, setDate] = useState(initial?.date || defaultDate);
  const [selectedShop, setSelectedShop] = useState(DISTRIBUTION_SHOPS[0]);
  const [drafts, setDrafts] = useState<Record<string, StoreOrderRow[]>>(() =>
    Object.fromEntries(DISTRIBUTION_SHOPS.map((shop) => [
      shop,
      (initial?.orders.find((order) => order.shop === shop)?.rows || []).map((row) => ({ ...row })),
    ]))
  );
  const [letter, setLetter] = useState("S");
  const [flavour, setFlavour] = useState("melk");
  const [size, setSize] = useState("groot");
  const [style, setStyle] = useState("spuit");
  const [quantity, setQuantity] = useState("12");
  const [review, setReview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [savedId, setSavedId] = useState(initial?.id || "");
  const [autosaveState, setAutosaveState] = useState<"idle" | "saving" | "saved" | "error">(initial ? "saved" : "idle");
  const [autosaveError, setAutosaveError] = useState("");
  const draftsRef = useRef(drafts);
  const dateRef = useRef(date);
  const savedIdRef = useRef(initial?.id || "");
  const autosaveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const latestAutosaveRef = useRef(0);
  const rows = drafts[selectedShop] || [];
  const rowsTotal = rows.reduce((sum, row) => sum + row.quantity, 0);
  const overallTotal = DISTRIBUTION_SHOPS.reduce(
    (sum, shop) => sum + (drafts[shop] || []).reduce((shopSum, row) => shopSum + row.quantity, 0),
    0
  );

  function ordersFor(nextDrafts: Record<string, StoreOrderRow[]>) {
    return DISTRIBUTION_SHOPS.flatMap((shop) => {
      const shopRows = nextDrafts[shop] || [];
      return shopRows.length > 0 ? [{ shop, rows: shopRows }] : [];
    });
  }

  function totalFor(nextDrafts: Record<string, StoreOrderRow[]>) {
    return DISTRIBUTION_SHOPS.reduce(
      (sum, shop) => sum + (nextDrafts[shop] || []).reduce((shopSum, row) => shopSum + row.quantity, 0),
      0
    );
  }

  function queueAutosave(nextDrafts: Record<string, StoreOrderRow[]>, nextDate: string) {
    if (totalFor(nextDrafts) < 1 || !/^\d{4}-\d{2}-\d{2}$/.test(nextDate) || !nextDate.startsWith(`${season}-`)) return;
    const version = latestAutosaveRef.current + 1;
    latestAutosaveRef.current = version;
    setAutosaveState("saving");
    setAutosaveError("");

    const snapshot = Object.fromEntries(
      DISTRIBUTION_SHOPS.map((shop) => [shop, (nextDrafts[shop] || []).map((row) => ({ ...row }))])
    ) as Record<string, StoreOrderRow[]>;

    autosaveQueueRef.current = autosaveQueueRef.current
      .catch(() => undefined)
      .then(async () => {
        const response = await fetch("/api/sinterklaas-letter-start-distributions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: savedIdRef.current,
            season,
            date: nextDate,
            orders: ordersFor(snapshot),
          }),
        });
        const result = await response.json() as StartDistributionResult;
        if (!response.ok) throw new Error(result.message || "Automatisch opslaan is mislukt.");
        const saved = result.distributions.find((distribution) => distribution.id === savedIdRef.current)
          || result.distributions.find((distribution) => distribution.date === nextDate);
        if (saved) {
          savedIdRef.current = saved.id;
          setSavedId(saved.id);
        }
        onAutosaved(result);
        if (latestAutosaveRef.current === version) {
          setAutosaveState("saved");
          setAutosaveError("");
        }
      })
      .catch((saveError) => {
        if (latestAutosaveRef.current === version) {
          setAutosaveState("error");
          setAutosaveError(saveError instanceof Error ? saveError.message : "Automatisch opslaan is mislukt.");
        }
      });
  }

  function applyDrafts(nextDrafts: Record<string, StoreOrderRow[]>) {
    draftsRef.current = nextDrafts;
    setDrafts(nextDrafts);
    queueAutosave(nextDrafts, dateRef.current);
    setReview(false);
  }

  function updateRows(nextRows: StoreOrderRow[]) {
    applyDrafts({ ...draftsRef.current, [selectedShop]: nextRows });
  }

  function rowWithAddedQuantity(currentRows: StoreOrderRow[], amount: number) {
    const values = [letter, flavour, size, style];
    const key = values.join("|").toLocaleLowerCase("nl-NL");
    const current = currentRows.find((row) => row.key === key);
    const nextRow: StoreOrderRow = {
      key,
      label: values.join(" · "),
      letter,
      flavour,
      size,
      style,
      quantity: (current?.quantity || 0) + amount,
    };
    return current
      ? currentRows.map((row) => row.key === key ? nextRow : row)
      : [...currentRows, nextRow].sort((a, b) => a.label.localeCompare(b.label, "nl"));
  }

  function addLine(target: "selected" | "all") {
    const amount = Number(quantity);
    if (!Number.isInteger(amount) || amount < 1 || amount > 10000) {
      setError("Vul een heel aantal tussen 1 en 10.000 in.");
      return;
    }
    const current = draftsRef.current;
    const nextDrafts = target === "all"
      ? Object.fromEntries(DISTRIBUTION_SHOPS.map((shop) => [
        shop,
        rowWithAddedQuantity(current[shop] || [], amount),
      ])) as Record<string, StoreOrderRow[]>
      : {
        ...current,
        [selectedShop]: rowWithAddedQuantity(current[selectedShop] || [], amount),
      };
    applyDrafts(nextDrafts);
    setQuantity("1");
    setReview(false);
    setError("");
  }

  function copySelectedShopToAll() {
    if (rows.length === 0) {
      setError(`Voeg eerst letters toe aan ${SHOP_LABELS[selectedShop]}.`);
      return;
    }
    const otherShopsContainRows = DISTRIBUTION_SHOPS.some(
      (shop) => shop !== selectedShop && (drafts[shop] || []).length > 0
    );
    if (
      otherShopsContainRows
      && !window.confirm(`De huidige lijsten van de andere winkels vervangen door die van ${SHOP_LABELS[selectedShop]}?`)
    ) return;
    applyDrafts(Object.fromEntries(DISTRIBUTION_SHOPS.map((shop) => [
      shop,
      rows.map((row) => ({ ...row })),
    ])) as Record<string, StoreOrderRow[]>);
    setError("");
  }

  function adjustLine(key: string, delta: number) {
    const currentRows = draftsRef.current[selectedShop] || [];
    updateRows(currentRows.flatMap((row) => {
      if (row.key !== key) return [row];
      const nextQuantity = row.quantity + delta;
      return nextQuantity > 0 ? [{ ...row, quantity: nextQuantity }] : [];
    }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !date.startsWith(`${season}-`)) {
      setError(`Kies een datum in ${season}.`);
      setReview(false);
      return;
    }
    if (overallTotal < 1) {
      setError("Voeg minimaal één letter toe.");
      setReview(false);
      return;
    }

    setSaving(true);
    setError("");
    try {
      await autosaveQueueRef.current.catch(() => undefined);
      const response = await fetch("/api/sinterklaas-letter-start-distributions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: savedIdRef.current,
          season,
          date,
          orders: ordersFor(draftsRef.current),
        }),
      });
      const result = await response.json() as StartDistributionResult;
      if (!response.ok) throw new Error(result.message || "Startverdeling opslaan is mislukt.");
      onSaved(result);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Startverdeling opslaan is mislukt.");
    } finally {
      setSaving(false);
    }
  }

  async function removeDistribution() {
    const distributionId = savedIdRef.current;
    if (!distributionId || !window.confirm(`Startverdeling van ${formatShortDate(dateRef.current)} verwijderen?`)) return;
    setSaving(true);
    setError("");
    try {
      const url = new URL("/api/sinterklaas-letter-start-distributions", window.location.origin);
      url.searchParams.set("season", season);
      url.searchParams.set("id", distributionId);
      const response = await fetch(url.toString(), { method: "DELETE" });
      const result = await response.json() as StartDistributionResult;
      if (!response.ok) throw new Error(result.message || "Startverdeling verwijderen is mislukt.");
      onSaved(result);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Startverdeling verwijderen is mislukt.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[85] flex items-start justify-center overflow-y-auto bg-[#263b2b]/50 px-2 py-3 backdrop-blur-sm sm:px-3 sm:py-8" role="dialog" aria-modal="true" aria-labelledby="start-distribution-title">
      <form onSubmit={submit} className="w-full max-w-3xl rounded-[1.4rem] border border-white/90 bg-[#faf8f2] p-3 shadow-2xl sm:rounded-[2rem] sm:p-5 lg:p-6">
        <header className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[0.62rem] font-black uppercase tracking-[0.16em] text-[#8b8278]">Voorraad vóór de centrale rondes</p>
            <h2 id="start-distribution-title" className="mt-0.5 text-lg font-black text-[#1a1815] sm:text-xl">{review ? "Startverdeling controleren" : initial ? "Startverdeling wijzigen" : "Startverdeling winkels"}</h2>
            <p className="mt-1 max-w-xl text-xs font-semibold leading-relaxed text-[#6b645b]">Leg vast welke letters op deze datum daadwerkelijk naar iedere winkel gaan. Deze aantallen worden niet opnieuw bij productie opgeteld.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Sluiten" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#dfd8ce] bg-white text-lg font-black sm:h-9 sm:w-9 sm:text-xl">×</button>
        </header>

        <div className="mt-3 flex flex-wrap items-end justify-between gap-2 sm:mt-4">
          <label className="block w-full max-w-xs text-[0.62rem] font-black uppercase tracking-[0.12em] text-[#6b645b] sm:text-xs">Datum meegegeven
            <input type="date" value={date} min={`${season}-01-01`} max={`${season}-12-31`} onChange={(event) => { const nextDate = event.target.value; dateRef.current = nextDate; setDate(nextDate); queueAutosave(draftsRef.current, nextDate); setReview(false); }} className="mt-1 h-10 w-full rounded-xl border border-[#d8d1c8] bg-white px-3 text-sm font-black text-[#263b2b] outline-none focus:border-[#547762] sm:h-11" />
          </label>
          <span role="status" className={`inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[0.62rem] font-black sm:text-xs ${autosaveState === "error" ? "bg-[#fff0ea] text-[#9a3412]" : autosaveState === "saving" ? "bg-[#fff3dc] text-[#70460e]" : "bg-[#e6efe2] text-[#24551d]"}`}>
            <svg viewBox="0 0 24 24" aria-hidden="true" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 4h12l2 2v14H5Z"/><path d="M8 4v6h8V4M8 20v-6h8v6"/></svg>
            {autosaveState === "saving" ? "Automatisch opslaan..." : autosaveState === "error" ? "Niet opgeslagen" : autosaveState === "saved" ? "Automatisch opgeslagen" : "Wordt automatisch opgeslagen"}
          </span>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-1.5 sm:mt-4 sm:grid-cols-4 sm:gap-2">
          {DISTRIBUTION_SHOPS.map((shop) => {
            const total = (drafts[shop] || []).reduce((sum, row) => sum + row.quantity, 0);
            return (
              <button key={shop} type="button" onClick={() => { setSelectedShop(shop); setReview(false); setError(""); }} className={`rounded-xl border px-2.5 py-2 text-left transition sm:rounded-2xl sm:px-3 sm:py-3 ${selectedShop === shop ? "border-[#24551d] bg-[#e4eee0]" : "border-[#ddd5ca] bg-white"}`}>
                <span className="block text-[0.62rem] font-black uppercase tracking-[0.06em] text-[#4d463d] sm:text-xs">{SHOP_LABELS[shop]}</span>
                <span className="mt-0.5 block text-xs font-bold text-[#776f66] sm:text-sm">{total > 0 ? `${total} letters` : "Nog leeg"}</span>
              </button>
            );
          })}
        </div>

        {!review ? (
          <>
            <section className="mt-3 rounded-xl border border-[#e0d8cd] bg-white p-3 sm:mt-4 sm:rounded-2xl sm:p-4">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div><p className="text-[0.6rem] font-black uppercase tracking-[0.14em] text-[#8b8278]">Meegeven aan</p><h3 className="text-base font-black text-[#263b2b] sm:text-lg">{SHOP_LABELS[selectedShop]}</h3></div>
                <div className="flex flex-wrap items-center justify-end gap-1.5">
                  <strong className="rounded-full bg-[#e6efe2] px-2.5 py-1 text-xs text-[#24551d] sm:text-sm">{rowsTotal} letters</strong>
                  <button type="button" onClick={copySelectedShopToAll} disabled={rows.length === 0} className="rounded-full border border-[#c9d9c5] bg-[#f4f8f2] px-2.5 py-1 text-[0.62rem] font-black text-[#24551d] disabled:opacity-40 sm:text-xs">Kopieer hele lijst naar alle winkels</button>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5 sm:gap-3">
                <label className="text-[0.56rem] font-black uppercase tracking-[0.08em] text-[#6b645b] sm:text-xs">Letter
                  <select value={letter} disabled={style === "vorm"} onChange={(event) => setLetter(event.target.value)} className="mt-1 h-9 w-full rounded-lg border border-[#ddd5ca] bg-white px-2 text-xs font-black disabled:bg-[#eee9e2] sm:h-11 sm:text-sm">{LETTERS.map((value) => <option key={value} value={value}>{value}</option>)}</select>
                </label>
                <label className="text-[0.56rem] font-black uppercase tracking-[0.08em] text-[#6b645b] sm:text-xs">Chocolade
                  <select value={flavour} onChange={(event) => setFlavour(event.target.value)} className="mt-1 h-9 w-full rounded-lg border border-[#ddd5ca] bg-white px-2 text-xs font-black sm:h-11 sm:text-sm"><option value="melk">Melk</option><option value="puur">Puur</option><option value="wit">Wit</option></select>
                </label>
                <label className="text-[0.56rem] font-black uppercase tracking-[0.08em] text-[#6b645b] sm:text-xs">Formaat
                  <select value={size} disabled={style === "vorm"} onChange={(event) => setSize(event.target.value)} className="mt-1 h-9 w-full rounded-lg border border-[#ddd5ca] bg-white px-2 text-xs font-black disabled:bg-[#eee9e2] sm:h-11 sm:text-sm"><option value="groot">Groot</option><option value="klein">Klein</option></select>
                </label>
                <label className="text-[0.56rem] font-black uppercase tracking-[0.08em] text-[#6b645b] sm:text-xs">Uitvoering
                  <select value={style} onChange={(event) => { const next = event.target.value; setStyle(next); if (next === "vorm") { setLetter("S"); setSize("groot"); } }} className="mt-1 h-9 w-full rounded-lg border border-[#ddd5ca] bg-white px-2 text-xs font-black sm:h-11 sm:text-sm"><option value="spuit">Spuit</option><option value="vorm">Vorm</option></select>
                </label>
                <label className="text-[0.56rem] font-black uppercase tracking-[0.08em] text-[#6b645b] sm:text-xs">Aantal
                  <input type="number" inputMode="numeric" min={1} max={10000} value={quantity} onFocus={(event) => event.currentTarget.select()} onChange={(event) => setQuantity(event.target.value)} className="mt-1 h-9 w-full rounded-lg border border-[#ddd5ca] bg-white px-2 text-xs font-black sm:h-11 sm:text-sm" />
                </label>
                <div className="col-span-3 grid grid-cols-1 gap-1.5 sm:col-span-5 sm:grid-cols-2 sm:gap-2">
                  <button type="button" onClick={() => addLine("selected")} className="h-9 rounded-full bg-[#4b352f] px-3 text-xs font-black text-white sm:h-11 sm:text-sm">+ Alleen {SHOP_LABELS[selectedShop]}</button>
                  <button type="button" onClick={() => addLine("all")} className="h-9 rounded-full bg-[#24551d] px-3 text-xs font-black text-white sm:h-11 sm:text-sm">+ Dezelfde letter voor alle winkels</button>
                </div>
                <p className="col-span-3 -mt-0.5 text-center text-[0.6rem] font-semibold text-[#776f66] sm:col-span-5 sm:text-xs">Bij ‘alle winkels’ geldt het ingevulde aantal voor iedere winkel apart.</p>
              </div>
            </section>

            <section className="mt-3 overflow-hidden rounded-xl border border-[#e0d8cd] bg-white sm:mt-4 sm:rounded-2xl">
              <div className="flex items-center justify-between bg-[#f1ede7] px-3 py-2 sm:px-4 sm:py-3"><h3 className="text-xs font-black sm:text-sm">Verdeling {SHOP_LABELS[selectedShop]}</h3><span className="text-[0.65rem] font-black text-[#6b645b] sm:text-xs">{rows.length} regels · {rowsTotal} stuks</span></div>
              {rows.length === 0 ? <p className="px-3 py-3 text-xs font-semibold text-[#776f66] sm:px-4 sm:py-5 sm:text-sm">Voor deze winkel zijn nog geen letters toegevoegd.</p> : (
                <div className="divide-y divide-[#e4ded5]">{rows.map((row) => (
                  <div key={row.key} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 sm:px-4 sm:py-3"><p className="text-sm font-black text-[#1a1815] sm:text-base">{row.label}</p><div className="flex items-center gap-1.5"><button type="button" onClick={() => adjustLine(row.key, -1)} className="h-7 w-7 rounded-full border border-[#ddd5ca] bg-white text-sm font-black sm:h-8 sm:w-8">−</button><strong className="min-w-8 text-center text-sm sm:text-base">{row.quantity}×</strong><button type="button" onClick={() => adjustLine(row.key, 1)} className="h-7 w-7 rounded-full bg-[#dbe9ee] text-sm font-black text-[#244c60] sm:h-8 sm:w-8">+</button><button type="button" onClick={() => updateRows(rows.filter((item) => item.key !== row.key))} className="ml-1 text-[0.65rem] font-black text-[#a23c2b] underline sm:text-xs">Verwijder</button></div></div>
                ))}</div>
              )}
            </section>
          </>
        ) : (
          <section className="mt-3 rounded-[1.25rem] border border-[#c9d9c5] bg-white p-4 sm:mt-4 sm:p-5">
            <p className="text-[0.62rem] font-black uppercase tracking-[0.15em] text-[#668064]">Laatste controle · {formatShortDate(date)}</p>
            <div className="mt-1 flex items-end justify-between gap-3"><h3 className="text-xl font-black text-[#263b2b]">Startverdeling winkels</h3><strong className="text-lg text-[#24551d] sm:text-xl">{overallTotal} letters</strong></div>
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">{DISTRIBUTION_SHOPS.map((shop) => { const total = (drafts[shop] || []).reduce((sum, row) => sum + row.quantity, 0); return <div key={shop} className="rounded-xl bg-[#f3f0ea] p-3"><p className="text-xs font-black">{SHOP_LABELS[shop]}</p><p className="mt-1 text-lg font-black text-[#24551d]">{total}</p></div>; })}</div>
            <p className="mt-3 rounded-xl bg-[#fff3dc] p-2.5 text-xs font-black text-[#70460e] sm:p-3 sm:text-sm">Na opslaan telt deze verdeling mee in het cumulatieve winkeltotaal, maar niet in de nog te maken productie.</p>
          </section>
        )}

        {(error || autosaveError) && <p role="alert" className="mt-3 rounded-xl bg-[#fff0ea] p-3 text-sm font-black text-[#9a3412]">{error || autosaveError}</p>}
        <footer className="mt-3 flex flex-col-reverse gap-1.5 sm:mt-5 sm:flex-row sm:items-center sm:justify-end sm:gap-2">
          {savedId && <button type="button" disabled={saving || autosaveState === "saving"} onClick={() => void removeDistribution()} className="h-10 rounded-full border border-[#efb8aa] bg-white px-4 text-xs font-black text-[#9a3412] disabled:opacity-50 sm:mr-auto sm:h-11 sm:text-sm">Verwijder verdeling</button>}
          <button type="button" onClick={onClose} className="h-10 rounded-full border border-[#ddd5ca] bg-white px-4 text-xs font-black text-[#4d463d] sm:h-11 sm:text-sm">Sluiten</button>
          {review ? <><button type="button" onClick={() => setReview(false)} className="h-10 rounded-full border border-[#b9cbb5] bg-[#edf4eb] px-4 text-xs font-black text-[#24551d] sm:h-11 sm:text-sm">← Nog wijzigen</button><button type="submit" disabled={saving} className="h-10 rounded-full bg-[#24551d] px-5 text-xs font-black text-white disabled:opacity-60 sm:h-11 sm:text-sm">{saving ? "Opslaan..." : initial ? "Wijzigingen opslaan" : "Startverdeling opslaan"}</button></> : <button type="button" onClick={() => { if (overallTotal < 1) setError("Voeg minimaal één letter toe."); else { setError(""); setReview(true); } }} className="h-10 rounded-full bg-[#24551d] px-5 text-xs font-black text-white sm:h-11 sm:text-sm">Controleer startverdeling →</button>}
        </footer>
      </form>
    </div>
  );
}

function StartDistributionPrintDialog({
  distribution,
  onClose,
}: Readonly<{
  distribution: StartDistribution;
  onClose: () => void;
}>) {
  return (
    <div className="start-distribution-print-overlay fixed inset-0 z-[95] overflow-y-auto bg-[#263b2b]/65 px-2 py-4 backdrop-blur-sm sm:px-4" role="dialog" aria-modal="true" aria-labelledby="start-distribution-print-title">
      <style jsx global>{`
        @media print {
          @page { size: A4 portrait; margin: 10mm; }
          body * { visibility: hidden !important; }
          .start-distribution-print, .start-distribution-print * { visibility: visible !important; }
          .start-distribution-print-overlay { position: static !important; overflow: visible !important; background: white !important; padding: 0 !important; }
          .start-distribution-print {
            position: absolute !important;
            inset: 0 !important;
            width: 100% !important;
            filter: grayscale(100%) contrast(108%) !important;
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
          .start-distribution-print-page {
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
          .start-distribution-print-page:last-child { break-after: auto; page-break-after: auto; }
          .start-distribution-no-print { display: none !important; }
        }
      `}</style>

      <div className="start-distribution-no-print sticky top-0 z-10 mx-auto mb-4 flex max-w-4xl flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/80 bg-[#faf8f2]/95 p-3 shadow-xl backdrop-blur">
        <div>
          <p id="start-distribution-print-title" className="font-black text-[#1a1815]">Preview startverdeling · 4 A4-pagina’s</p>
          <p className="text-xs font-semibold text-[#6b645b]">Iedere winkel krijgt één eigen pagina met de ontvangen voorraad.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="h-10 rounded-full border border-[#ddd5ca] bg-white px-4 text-sm font-black text-[#4d463d]">Sluiten</button>
          <button type="button" onClick={() => window.print()} className="h-10 rounded-full bg-[#24551d] px-4 text-sm font-black text-white">Print 4 pagina’s</button>
        </div>
      </div>

      <div className="start-distribution-print mx-auto max-w-4xl space-y-5 print:space-y-0">
        {DISTRIBUTION_SHOPS.map((shop) => {
          const rows = [...(distribution.orders.find((order) => order.shop === shop)?.rows || [])].sort((a, b) => {
            const flavourOrder: Record<string, number> = { melk: 0, puur: 1, wit: 2 };
            return a.style.localeCompare(b.style, "nl")
              || (flavourOrder[a.flavour] ?? 9) - (flavourOrder[b.flavour] ?? 9)
              || a.size.localeCompare(b.size, "nl")
              || a.letter.localeCompare(b.letter, "nl");
          });
          const total = rows.reduce((sum, row) => sum + row.quantity, 0);

          return (
            <section key={shop} className="start-distribution-print-page flex min-h-[70rem] aspect-[210/297] flex-col rounded-[1.5rem] border border-[#d8d1c8] bg-white p-7 shadow-2xl">
              <header className="flex items-start justify-between gap-4 border-b-2 border-[#263b2b] pb-4">
                <div>
                  <p className="text-[0.68rem] font-black uppercase tracking-[0.2em] text-[#778878]">Strik Patisserie · chocoladeletters</p>
                  <h2 className="mt-1 text-3xl font-black uppercase tracking-[0.07em] text-[#263b2b]">{SHOP_LABELS[shop]}</h2>
                  <p className="mt-1 text-base font-black text-[#4b352f]">Startverdeling · {formatShortDate(distribution.date)}</p>
                </div>
                <div className="rounded-2xl bg-[#e6efe2] px-5 py-3 text-right">
                  <p className="text-[0.58rem] font-black uppercase tracking-[0.13em] text-[#59705c]">Totaal ontvangen</p>
                  <p className="mt-0.5 text-3xl font-black text-[#263b2b]">{total}</p>
                  <p className="text-[0.58rem] font-black uppercase tracking-[0.12em] text-[#59705c]">letters</p>
                </div>
              </header>

              <div className="mt-5 grid grid-cols-[minmax(0,1fr)_3.5rem] border-b border-[#cfc8be] pb-1.5 text-[0.6rem] font-black uppercase italic tracking-[0.14em] text-[#776f66]">
                <span>Letter en uitvoering</span>
                <span className="text-right">Aantal</span>
              </div>

              {rows.length > 0 ? (
                <div className="mt-2 grid grid-cols-2 gap-x-8">
                  {rows.map((row) => (
                    <div key={`${shop}-${row.key}`} className="flex break-inside-avoid items-center justify-between gap-3 border-b border-[#e5dfd6] py-1.5 text-[0.72rem]">
                      <span className="font-bold text-[#322e29]">{row.letter} · {row.flavour} · {row.size} · {row.style}</span>
                      <strong className="min-w-8 text-right text-sm text-[#1a1815]">{row.quantity}×</strong>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-5 rounded-xl border border-dashed border-[#cfc8be] p-4 text-sm font-semibold text-[#6b645b]">Voor deze winkel staan geen letters in deze startverdeling.</p>
              )}

              <section className="mt-auto rounded-2xl border-2 border-[#4b352f] p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-[0.62rem] font-black uppercase tracking-[0.14em] text-[#6b645b]">Controle winkel</p>
                    <p className="mt-1 text-base font-black text-[#1a1815]">Alles ontvangen en gecontroleerd</p>
                  </div>
                  <span className="h-11 w-11 shrink-0 rounded-md border-[3px] border-[#1a1815] bg-white" aria-hidden="true" />
                </div>
                <div className="mt-4 grid grid-cols-2 gap-8 text-[0.65rem] font-bold text-[#6b645b]">
                  <p className="border-t border-[#8b8278] pt-1">Naam</p>
                  <p className="border-t border-[#8b8278] pt-1">Datum</p>
                </div>
              </section>

              <footer className="mt-4 flex items-center justify-between border-t border-[#d8d1c8] pt-3 text-[0.62rem] font-bold text-[#8b8278]">
                <span>Interne winkellijst · startvoorraad</span>
                <span>{SHOP_LABELS[shop]} · 1 van 1</span>
              </footer>
            </section>
          );
        })}
      </div>
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
  const [liveBatches, setLiveBatches] = useState<ProductionBatchSeed[] | null>(null);
  const [liveUnplanned, setLiveUnplanned] = useState<string[]>([]);
  const [liveUnplannedCount, setLiveUnplannedCount] = useState(centralUnplannedCount);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [savingProduction, setSavingProduction] = useState(false);
  const productionMutationVersion = useRef(0);
  const [productionNotice, setProductionNotice] = useState("");
  const [productionNoticeBatch, setProductionNoticeBatch] = useState("");
  const [quantityDialog, setQuantityDialog] = useState<{batch: ProductionBatchSeed; row: WorkingRow} | null>(null);
  const [quantityDraft, setQuantityDraft] = useState("");
  const [reviseBatch, setReviseBatch] = useState<ProductionBatchSeed | null>(null);
  const [loading, setLoading] = useState(!demoMode);
  const [warning, setWarning] = useState("");
  const [storeOrderBatch, setStoreOrderBatch] = useState<ProductionBatchSeed | null>(null);
  const [storeOrderInitialShop, setStoreOrderInitialShop] = useState(DISTRIBUTION_SHOPS[0]);
  const [printOptionsBatch, setPrintOptionsBatch] = useState<ProductionBatchSeed | null>(null);
  const [distributionBatch, setDistributionBatch] = useState<ProductionBatchSeed | null>(null);
  const [productionPrintBatch, setProductionPrintBatch] = useState<ProductionBatchSeed | null>(null);
  const [showGrandOverview, setShowGrandOverview] = useState(false);
  const [startDistributions, setStartDistributions] = useState<StartDistribution[]>([]);
  const [startDistributionsLoading, setStartDistributionsLoading] = useState(!demoMode);
  const [startDistributionError, setStartDistributionError] = useState("");
  const [startDistributionOpen, setStartDistributionOpen] = useState(false);
  const [editingStartDistribution, setEditingStartDistribution] = useState<StartDistribution | null>(null);
  const [startDistributionPrint, setStartDistributionPrint] = useState<StartDistribution | null>(null);
  const [storeOrdersByBatch, setStoreOrdersByBatch] = useState<Record<string, StoreStockOrder[]>>(() =>
    Object.fromEntries(batches.map((batch) => [batch.id, batch.storeOrders || []]))
  );
  const [stockRowsByBatch, setStockRowsByBatch] = useState<Record<string, StoreOrderRow[]>>({});
  const [producedRowsByBatch, setProducedRowsByBatch] = useState<Record<string, ProductionSeedRow[]>>({});

  useEffect(() => {
    if (demoMode) { setLoading(false); return; }
    let active = true;
    const controller = new AbortController();
    let pending = false;
    async function refresh() {
      if (pending || document.visibilityState === "hidden") return;
      pending = true;
      const version = productionMutationVersion.current;
      try {
        const response = await fetch(`/api/sinterklaas-letter-production?season=${encodeURIComponent(season)}`, { cache: "no-store", signal: controller.signal });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || "Productiegegevens laden is mislukt.");
        if (active && version === productionMutationVersion.current) {
          setLiveBatches(result.batches);
          setLiveUnplanned(result.unplanned || []);
          setLiveUnplannedCount(result.centralUnplannedCount || 0);
          setStockRowsByBatch({});
          setWarning("");
        }
      } catch (error) {
        if (active) setWarning(error instanceof Error ? error.message : "De volledige productielijst kon niet worden geladen.");
      } finally {
        pending = false;
        if (active) setLoading(false);
      }
    }
    void refresh();
    const timer = window.setInterval(() => { void refresh(); }, 60000);
    // Also switch an already open page at the deadline, without a manual reload.
    const nextDeadline = Math.min(...batches.map(batch => Date.parse(batch.deadlineAt || "")).filter(time => time > Date.now()));
    const deadlineTimer = Number.isFinite(nextDeadline) ? window.setTimeout(() => { void refresh(); }, Math.min(nextDeadline - Date.now() + 500, 2147483647)) : undefined;
    const onFocus = () => { void refresh(); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => { active = false; controller.abort(); window.clearInterval(timer); window.clearTimeout(deadlineTimer); window.removeEventListener("focus", onFocus); document.removeEventListener("visibilitychange", onFocus); };
  }, [demoMode, season, batches, refreshVersion]);

  useEffect(() => {
    if (demoMode) {
      setStartDistributions([]);
      setStartDistributionsLoading(false);
      setStartDistributionError("");
      return;
    }

    let active = true;
    setStartDistributionsLoading(true);
    fetch(`/api/sinterklaas-letter-start-distributions?season=${encodeURIComponent(season)}`, { cache: "no-store" })
      .then(async (response) => {
        const result = await response.json() as StartDistributionResult;
        if (!response.ok) throw new Error(result.message || "Startverdelingen konden niet worden geladen.");
        if (active) {
          setStartDistributions(result.distributions || []);
          setStartDistributionError("");
        }
      })
      .catch((loadError) => {
        if (active) setStartDistributionError(loadError instanceof Error ? loadError.message : "Startverdelingen konden niet worden geladen.");
      })
      .finally(() => {
        if (active) setStartDistributionsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [demoMode, season]);

  const overview = useMemo(() => {
    const rowsByDate = new Map<string, Map<string, WorkingRow>>();
    for (const batch of liveBatches || batches) {
      rowsByDate.set(
        batch.date,
        new Map(batch.rows.map((row) => [row.key, { ...row, orderSources: { ...row.orderSources } }]))
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

    const batchViews = (liveBatches || batches).map(batch => ({
      ...batch,
      storeOrders: demoMode ? storeOrdersByBatch[batch.id] || batch.storeOrders || [] : batch.storeOrders,
      rows: [...(rowsByDate.get(batch.date)?.values() || [])].map(row => ({...row, produced: producedRowsByBatch[batch.id]?.find(update => update.key === row.key)?.produced ?? row.produced})).sort(compareProductionRows),
    }));
    const grandRows = aggregateProductionRows(batchViews.flatMap((batch) => batch.rows));

    return {
      batches: batchViews,
      grandRows: grandRows.sort(compareProductionRows),
      unplanned: liveUnplanned,
    };
  }, [batches, liveBatches, liveUnplanned, demoMode, producedRowsByBatch, stockRowsByBatch, storeOrdersByBatch]);

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
  const startDistributionTotal = startDistributions.reduce((sum, distribution) => sum + distributionTotal(distribution), 0);
  const startTotalsByShop = Object.fromEntries(DISTRIBUTION_SHOPS.map((shop) => [
    shop,
    startDistributions.reduce(
      (sum, distribution) => sum + storeOrderTotal(distribution.orders.find((order) => order.shop === shop)),
      0
    ),
  ])) as Record<string, number>;
  const roundTotalsByShop = Object.fromEntries(DISTRIBUTION_SHOPS.map((shop) => [
    shop,
    overview.batches.reduce(
      (sum, batch) => sum + storeOrderTotal((batch.storeOrders || []).find((order) => order.shop === shop)),
      0
    ),
  ])) as Record<string, number>;

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

  async function saveProduction(batch: ProductionBatchSeed, action: "quantity" | "revise", row?: WorkingRow, quantity?: number) {
    if (savingProduction) return false;
    setProductionNoticeBatch(batch.id);
    if (demoMode) {
      if (row && quantity !== undefined) setProducedRowsByBatch(current => ({...current, [batch.id]: batch.rows.map(item => item.key === row.key ? {...item, produced: quantity} : item)}));
      setProductionNotice("Demo: voortgang aangepast, niets werkelijk opgeslagen.");
      return true;
    }
    if (!batch.checklist) return false;
    setSavingProduction(true);
    setProductionNotice("");
    productionMutationVersion.current += 1;
    try {
      const response = await fetch("/api/sinterklaas-letter-production", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({batchId: batch.id, revision: batch.checklist.revision, planVersion: batch.checklist.planVersion, action, key: row?.key, quantity})});
      const result = await response.json();
      if (!response.ok) {
        if (response.status === 409) { setRefreshVersion(current => current + 1); setQuantityDialog(null); setReviseBatch(null); }
        throw new Error(result.message || "Productie opslaan is mislukt.");
      }
      const list = result.list;
      setLiveBatches(current => current?.map(item => item.id === batch.id ? {...item, rows: list.rows, checklist: {...item.checklist!, revision: list.revision, planRevision: list.plan_revision, updatedAt: list.updated_at, changes: action === "revise" ? [] : item.checklist?.changes || []}} : item) || null);
      setProductionNotice(action === "revise" ? "Nieuwe versie opgeslagen. Print de bijgewerkte productielijst voor de bakkers." : "Productievoortgang opgeslagen.");
      return true;
    } catch (error) {
      setProductionNotice(error instanceof Error ? error.message : "Opslaan is mislukt.");
      return false;
    } finally {
      productionMutationVersion.current += 1;
      setSavingProduction(false);
    }
  }

  return (
    <div className={styles.planning}>
      {demoMode && <div className={styles.notice}>
        <p><strong>Demoweergave</strong> · de aantallen en bestellingen zijn fictief.</p>
        <a href="/sinterklaas/letters/productie" className="underline underline-offset-2">Demo sluiten</a>
      </div>}
      {loading && <p className={styles.notice}>Bestaande B2B- en winkelbestellingen worden erbij geladen…</p>}
      {warning && <p role="alert" className={styles.error}>{warning}</p>}

      <section className={styles.summary} aria-label="Totaaloverzicht productie">
        <div className={styles.summaryHead}>
          <h2 className={styles.summaryTitle}>Alle productierondes</h2>
          <dl className={styles.metrics}>
            <div><dt>Totaal</dt><dd>{totalToMake}</dd></div>
            <div><dt>Gereed</dt><dd>{grandTotals.produced}</dd></div>
            <div className={styles.remaining}><dt>Nog te maken</dt><dd>{overview.batches.reduce((sum, batch) => sum + productionRemaining(batch.rows), 0)}</dd></div>
          </dl>
          <div className={styles.summaryActions}>
            <button type="button" onClick={() => setShowGrandOverview((current) => !current)} aria-expanded={showGrandOverview} aria-controls="production-grand-overview" className={styles.quiet}>
              {showGrandOverview ? "Totaallijst sluiten ↑" : "Bekijk totaallijst ↓"}
            </button>
            {!demoMode && <button type="button" onClick={() => { setEditingStartDistribution(null); setStartDistributionOpen(true); }} className={styles.button}>+ Startverdeling winkels</button>}
          </div>
        </div>
        {showGrandOverview && <div id="production-grand-overview"><ProductionTable rows={overview.grandRows} /></div>}
        {!demoMode && (startDistributionsLoading || startDistributionError || startDistributions.length > 0) && (
          <div className={styles.startStock}>
            <div className={styles.stockHeading}>
              <span>Startvoorraad</span>
              {startDistributionsLoading && <span>Laden…</span>}
              {!startDistributionsLoading && startDistributions.map((distribution) => (
                <span key={distribution.id} className={styles.stockDate}>
                  <button type="button" onClick={() => { setEditingStartDistribution(distribution); setStartDistributionOpen(true); }}>{formatShortDate(distribution.date)} · {distributionTotal(distribution)}</button>
                  <button type="button" onClick={() => setStartDistributionPrint(distribution)} aria-label={`Startverdeling van ${formatShortDate(distribution.date)} printen`} title="Startverdeling printen">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9V3h12v6"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="7" rx="1"/></svg>
                  </button>
                </span>
              ))}
              {startDistributions.length > 0 && <strong>{startDistributionTotal} letters verdeeld</strong>}
            </div>
            {startDistributionError && <p role="alert" className={styles.error}>{startDistributionError}</p>}
            {startDistributions.length > 0 && <details className={styles.startDetails}><summary>Verdeling per winkel</summary><div className={styles.shopGrid}>
              {DISTRIBUTION_SHOPS.map((shop) => {
                const startTotal = startTotalsByShop[shop] || 0;
                const roundsTotal = roundTotalsByShop[shop] || 0;
                return <div key={shop} className={styles.shop}>
                  <span>{SHOP_LABELS[shop]}</span>
                  <small>Start {startTotal} · rondes {roundsTotal}</small>
                  <strong>Totaal {startTotal + roundsTotal}</strong>
                </div>;
              })}
            </div></details>}
          </div>
        )}
      </section>

      {(liveUnplannedCount > 0 || overview.unplanned.length > 0) && <section className={styles.attention}>
        <h2>Nog niet aan een productiedag gekoppeld</h2>
        {liveUnplannedCount > 0 && <p>{liveUnplannedCount} centrale orderregel(s) zijn nog niet volledig ingepland.</p>}
        {overview.unplanned.length > 0 && <p>{overview.unplanned.length} bestaande bestelling(en): {overview.unplanned.slice(0, 6).join(" · ")}{overview.unplanned.length > 6 ? ` · +${overview.unplanned.length - 6}` : ""}</p>}
      </section>}

      <div className={styles.rounds}>
        {overview.batches.map((batch) => {
          const totals = totalsFor(batch.rows);
          const planned = totals.orders + totals.stock;
          const storeStockTotal = (batch.storeOrders || []).reduce((sum, order) => sum + storeOrderTotal(order), 0);
          const storeOrdersLocked = batchIsLocked(batch);
          return <section key={batch.id} className={styles.round}>
            <div className={styles.roundHead}>
              <div className={styles.roundDate}>
                <p className={styles.roundLabel}>Centrale productieronde</p>
                <h2>{formatCompactProductionDate(batch.startDate)}</h2>
              </div>
              <span className={styles.roundState} data-planned={Boolean(batch.checklist) || batchIsPlanned(batch.status)}>{batch.checklist ? productionRemaining(batch.rows) === 0 ? "Productie gereed" : "Vastgezet · afvinken mogelijk" : batchIsPlanned(batch.status) ? "Ingepland" : "Nog niet ingepland"}</span>
              <div className={styles.roundActions}>
                {demoMode && <button type="button" onClick={() => setPrintOptionsBatch(batch)} className={styles.button}>Printlijsten</button>}
                {!demoMode && <button type="button" disabled={loading || Boolean(warning) || !liveBatches} onClick={() => setProductionPrintBatch(batch)} className={styles.button}>{batch.checklist ? "Productielijst printen" : "Voorbeeld printen"}</button>}
                <button type="button" onClick={() => { setStoreOrderInitialShop(DISTRIBUTION_SHOPS[0]); setStoreOrderBatch(batch); }} className={styles.button}>
                  {storeOrdersLocked ? "Bekijk winkelvoorraad" : storeStockTotal > 0 ? "Winkelvoorraad wijzigen" : "+ Winkelvoorraad per winkel"}
                </button>
              </div>
            </div>
            <div className={styles.roundSummary}>
              <span>Totaal <b>{planned}</b></span>
              <span>Gereed <b>{totals.produced}</b></span>
              <span className={styles.remaining}>Nog te maken <b>{productionRemaining(batch.rows)}</b></span>
              <p className={styles.tableLegend}>Besteld = klantbestellingen · Winkel = vrije winkelvoorraad</p>
            </div>
            <div className={styles.checklistNote}>
              {batch.checklist ? <>Vastgezet op {formatDeadline(batch.checklist.lockedAt)} · versie {batch.checklist.planRevision}. Vink af wat klaar is, of tik op het aantal voor deelproductie. Printen verandert de voortgang niet.</> : <>Bestellen tot {formatDeadline(batch.deadlineAt)}. Daarna wordt de lijst vastgezet en kun je afvinken.</>}
            </div>
            {productionNotice && productionNoticeBatch === batch.id && <p role="status" className={styles.checklistNote}>{productionNotice}</p>}
            {!!batch.checklist?.changes.length && <div className={styles.changeNotice} role="status"><strong>Bestellingen gewijzigd na vastzetten</strong><p>{batch.checklist.changes.length} gewijzigde letterregel(s). De productielijst blijft staan totdat je deze wijzigingen controleert.</p><button type="button" className={styles.button} disabled={savingProduction || Boolean(warning)} onClick={() => {setProductionNotice(""); setReviseBatch(batch);}}>Wijzigingen bekijken</button></div>}
            <ProductionTable rows={batch.rows} saving={savingProduction}
              onToggleComplete={demoMode ? row => toggleProductionRow(batch, row) : batch.checklist && !warning ? row => { void saveProduction(batch, "quantity", row, productionRowIsComplete(row) ? 0 : row.orders + row.stock); } : undefined}
              onEditQuantity={(demoMode || batch.checklist && !warning) ? row => {setProductionNotice(""); setQuantityDialog({batch, row}); setQuantityDraft(String(row.produced));} : undefined} />
            <div className={styles.storeFooter}>
              <div className={styles.stockHeading}>
                <span>Winkelbestellingen · voorraad per vestiging</span>
                <strong>{storeOrdersLocked ? "Vergrendeld" : `Wijzigbaar tot ${formatDeadline(batch.deadlineAt)}`}</strong>
              </div>
              <div className={styles.shopGrid}>
                {DISTRIBUTION_SHOPS.map((shop) => {
                  const total = storeOrderTotal((batch.storeOrders || []).find((order) => order.shop === shop));
                  return <button key={shop} type="button" onClick={() => { setStoreOrderInitialShop(shop); setStoreOrderBatch(batch); }} className={styles.shop} data-empty={total === 0}>
                    <span>{SHOP_LABELS[shop]}</span>
                    <strong>{total > 0 ? `${total} letters` : "Nog geen bestelling"}</strong>
                  </button>;
                })}
              </div>
            </div>
          </section>;
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
            if (!demoMode) setRefreshVersion(current => current + 1);
          }}
        />
      )}
      {distributionBatch && (
        <DistributionPreviewDialog batch={distributionBatch} onClose={() => setDistributionBatch(null)} />
      )}
      {productionPrintBatch && (
        <ProductionPrintPreviewDialog batch={productionPrintBatch} onClose={() => setProductionPrintBatch(null)} />
      )}
      {quantityDialog && <div className={`${styles.progressOverlay} ${styles.dialog}`} role="dialog" aria-modal="true" aria-labelledby="quantity-title"><form className={styles.progressDialog} onSubmit={async event => {event.preventDefault(); if (!/^\d+$/.test(quantityDraft)) return; const saved = await saveProduction(quantityDialog.batch, "quantity", quantityDialog.row, Number(quantityDraft)); if (saved) setQuantityDialog(null);}}>
        <h2 id="quantity-title">Hoeveel zijn er gemaakt?</h2><p>{quantityDialog.row.label}</p><p>Ingepland: {quantityDialog.row.orders + quantityDialog.row.stock} stuks. De rest blijft openstaan.</p>
        <label>Geproduceerd aantal<input aria-label="Geproduceerd aantal" type="text" inputMode="numeric" pattern="[0-9]+" required value={quantityDraft} onChange={event => setQuantityDraft(event.target.value)} /></label>
        {productionNotice && <p role="alert">{productionNotice}</p>}
        <div className={styles.progressActions}><button type="button" className={styles.button} disabled={savingProduction} onClick={() => setQuantityDialog(null)}>Annuleren</button><button type="submit" className={styles.primary} disabled={savingProduction}>{savingProduction ? "Opslaan…" : "Aantal opslaan"}</button></div>
      </form></div>}
      {reviseBatch && <div className={`${styles.progressOverlay} ${styles.dialog}`} role="dialog" aria-modal="true" aria-labelledby="revise-title"><section className={styles.progressDialog}>
        <h2 id="revise-title">Gewijzigde bestellingen controleren</h2><p>De bestaande vinkjes en gemaakte aantallen blijven bewaard. Bij een verhoging blijft het extra aantal openstaan.</p>
        <ul className={styles.changeList}>{reviseBatch.checklist?.changes.map(change => <li key={change.key}><strong>{change.label}</strong><span>{change.before} → {change.after} stuks · {change.detail}</span></li>)}</ul>
        <p>Na overnemen krijgt de lijst een nieuw versienummer. Vervang ook de papieren lijst in de bakkerij.</p>
        {productionNotice && <p role="alert">{productionNotice}</p>}
        <div className={styles.progressActions}><button type="button" className={styles.button} disabled={savingProduction} onClick={() => setReviseBatch(null)}>Sluiten</button><button type="button" className={styles.primary} disabled={savingProduction} onClick={async () => {if (await saveProduction(reviseBatch, "revise")) setReviseBatch(null);}}>{savingProduction ? "Opslaan…" : "Bijgewerkte lijst overnemen"}</button></div>
      </section></div>}
      {startDistributionOpen && (
        <StartDistributionDialog
          season={season}
          initial={editingStartDistribution}
          onClose={() => { setStartDistributionOpen(false); setEditingStartDistribution(null); }}
          onAutosaved={(result) => {
            setStartDistributions(result.distributions || []);
            setStartDistributionError("");
          }}
          onSaved={(result) => {
            setStartDistributions(result.distributions || []);
            setStartDistributionError("");
            setStartDistributionOpen(false);
            setEditingStartDistribution(null);
          }}
        />
      )}
      {startDistributionPrint && (
        <StartDistributionPrintDialog distribution={startDistributionPrint} onClose={() => setStartDistributionPrint(null)} />
      )}
    </div>
  );
}
