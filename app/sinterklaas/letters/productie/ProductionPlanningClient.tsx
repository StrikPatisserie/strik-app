"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
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
};

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const DISTRIBUTION_SHOPS = ["ziekerstraat", "heyendaal", "daalseweg", "lent"];
const SHOP_LABELS: Record<string, string> = {
  ziekerstraat: "Ziekerstraat",
  heyendaal: "Heyendaal",
  daalseweg: "Daalseweg",
  lent: "Lent",
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

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    OPEN: "Open",
    PLANNED: "Ingepland",
    IN_PRODUCTION: "In productie",
    COMPLETED: "Gereed",
    CLOSED: "Afgesloten",
  };
  return labels[status] || status;
}

function totalsFor(rows: WorkingRow[]) {
  return rows.reduce(
    (total, row) => ({
      orders: total.orders + row.orders,
      stock: total.stock + row.stock,
      produced: total.produced + row.produced,
    }),
    { orders: 0, stock: 0, produced: 0 }
  );
}

function productionVariant(label: string) {
  const [letter = "Onbekend", chocolate = "", size = "", style = "", ...extras] = label
    .split(" · ")
    .map((part) => part.trim())
    .filter(Boolean);

  return {
    product: [letter, chocolate, size, style].filter(Boolean).join(" · "),
    extras,
  };
}

function ProductionTable({ rows }: Readonly<{ rows: WorkingRow[] }>) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[470px] border-collapse text-left text-xs sm:min-w-[520px] sm:text-sm">
        <thead className="bg-[#f1ede7] text-[0.66rem] font-black uppercase tracking-[0.1em] text-[#6b645b]">
          <tr>
            <th className="px-2 py-1.5 sm:px-3 sm:py-2">Letter en uitvoering</th>
            <th className="px-2 py-1.5 text-right sm:px-3 sm:py-2">Totaal te maken</th>
            <th className="px-2 py-1.5 text-right sm:px-3 sm:py-2">Gemaakt</th>
            <th className="px-2 py-1.5 text-right sm:px-3 sm:py-2">Open</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={4} className="px-3 py-4 text-center font-semibold text-[#776f66]">
                Nog geen letters ingepland.
              </td>
            </tr>
          ) : rows.map((row) => {
            const planned = row.orders + row.stock;
            const variant = productionVariant(row.label);
            const isSpecial = variant.extras.length > 0;
            return (
              <tr
                key={row.key}
                className={`border-t border-[#e4ded5] ${isSpecial ? "bg-[#fff8e8]" : "bg-white"}`}
              >
                <td className={`px-2 py-1.5 sm:px-3 sm:py-2 ${isSpecial ? "border-l-4 border-[#d75a48]" : "border-l-4 border-[#9bb79a]"}`}>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <strong className="text-[#1a1815]">{variant.product}</strong>
                    {isSpecial ? (
                      <>
                        <span className="rounded-full bg-[#d75a48] px-2 py-0.5 text-[0.58rem] font-black uppercase tracking-[0.1em] text-white">
                          Afwijking
                        </span>
                        {variant.extras.map((extra) => (
                          <span
                            key={extra}
                            className="rounded-full border border-[#e4c17b] bg-white px-2 py-0.5 text-[0.62rem] font-black text-[#765019]"
                          >
                            {extra}
                          </span>
                        ))}
                      </>
                    ) : (
                      <span className="rounded-full bg-[#e7f0e3] px-2 py-0.5 text-[0.58rem] font-black uppercase tracking-[0.1em] text-[#3f6848]">
                        Standaard
                      </span>
                    )}
                  </div>
                  {row.stock > 0 && (
                    <p className="mt-1 text-[0.65rem] font-black text-[#7b5970]">
                      * incl. {row.stock}× algemene winkelvoorraad
                    </p>
                  )}
                </td>
                <td className="px-2 py-1.5 text-right font-black sm:px-3 sm:py-2">{planned}</td>
                <td className="px-2 py-1.5 text-right sm:px-3 sm:py-2">{row.produced}</td>
                <td className="px-2 py-1.5 text-right font-black text-[#9a3412] sm:px-3 sm:py-2">
                  {Math.max(0, planned - row.produced)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
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
  return [
    {
      id: `${batch.id}-1`, code: "CL26-0107", customerName: "Sophie van Dijk", shop: "ziekerstraat", pickupDate: firstPickup,
      lines: [{ quantity: 2, product: "S · melk · groot · spuit" }, { quantity: 1, product: "M · wit · klein · spuit", extras: ["foto"] }],
    },
    {
      id: `${batch.id}-2`, code: "CL26-0112", customerName: "Familie Jansen", shop: "ziekerstraat", pickupDate: addDays(firstPickup, 1),
      lines: [{ quantity: 3, product: "A · puur · groot · spuit" }], note: "Samen in één doos verpakken.",
    },
    {
      id: `${batch.id}-3`, code: "CL26-0118", customerName: "Noor Peters", shop: "heyendaal", pickupDate: firstPickup,
      lines: [{ quantity: 2, product: "S · melk · groot · spuit", extras: ["notenvrij"] }, { quantity: 1, product: "S · melk · groot · spuit", extras: ["notenvrij", "foto"] }],
    },
    {
      id: `${batch.id}-4`, code: "CL26-0124", customerName: "M. de Bruin", shop: "heyendaal", pickupDate: addDays(firstPickup, 2),
      lines: [{ quantity: 4, product: "B · puur · klein · spuit" }],
    },
    {
      id: `${batch.id}-5`, code: "CL26-0131", customerName: "Eva Smit", shop: "daalseweg", pickupDate: firstPickup,
      lines: [{ quantity: 1, product: "K · puur · groot · spuit", extras: ["lactosevrij", "foto"] }, { quantity: 2, product: "E · wit · klein · spuit" }],
    },
    {
      id: `${batch.id}-6`, code: "CL26-0138", customerName: "Bram Hendriks", shop: "daalseweg", pickupDate: addDays(firstPickup, 1),
      lines: [{ quantity: 2, product: "S · melk · groot · vorm" }],
    },
    {
      id: `${batch.id}-7`, code: "CL26-0145", customerName: "Lotte Willems", shop: "lent", pickupDate: firstPickup,
      lines: [{ quantity: 5, product: "S · melk · groot · spuit", extras: ["foto"] }],
    },
    {
      id: `${batch.id}-8`, code: "CL26-0150", customerName: "Daan Meijer", shop: "lent", pickupDate: addDays(firstPickup, 2),
      lines: [{ quantity: 2, product: "P · puur · groot · spuit", extras: ["vegan"] }, { quantity: 1, product: "M · wit · klein · spuit" }],
    },
  ];
}

function DistributionPreviewDialog({ batch, onClose }: Readonly<{ batch: ProductionBatchSeed; onClose: () => void }>) {
  const orders = demoDistributionOrders(batch);

  return (
    <div className="letter-distribution-overlay fixed inset-0 z-[90] overflow-y-auto bg-[#263b2b]/65 px-3 py-5 backdrop-blur-sm" role="dialog" aria-modal="true">
      <style jsx global>{`
        @media print {
          @page { size: A4 portrait; margin: 10mm; }
          body * { visibility: hidden !important; }
          .letter-distribution-print, .letter-distribution-print * { visibility: visible !important; }
          .letter-distribution-overlay { position: static !important; overflow: visible !important; background: white !important; padding: 0 !important; }
          .letter-distribution-print { position: absolute !important; inset: 0 !important; width: 100% !important; }
          .letter-distribution-page { min-height: 277mm; margin: 0 !important; border: 0 !important; box-shadow: none !important; break-after: page; page-break-after: always; }
          .letter-distribution-page:last-child { break-after: auto; page-break-after: auto; }
          .letter-distribution-no-print { display: none !important; }
        }
      `}</style>
      <div className="letter-distribution-no-print sticky top-0 z-10 mx-auto mb-4 flex max-w-4xl flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/80 bg-[#faf8f2]/95 p-3 shadow-xl backdrop-blur">
        <div>
          <p className="font-black text-[#1a1815]">Preview verdeellijst · vier winkelpagina’s</p>
          <p className="text-xs font-semibold text-[#6b645b]">Alle gegevens zijn fictief. B2B-bestellingen staan bewust niet in deze lijst.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="h-10 rounded-full border border-[#ddd5ca] bg-white px-4 text-sm font-black text-[#4d463d]">Sluiten</button>
          <button type="button" onClick={() => window.print()} className="h-10 rounded-full bg-[#24551d] px-4 text-sm font-black text-white">Print vier winkellijsten</button>
        </div>
      </div>

      <div className="letter-distribution-print mx-auto max-w-4xl space-y-5 print:space-y-0">
        {DISTRIBUTION_SHOPS.map((shop, shopIndex) => {
          const shopOrders = orders.filter((order) => order.shop === shop);
          const orderPieces = shopOrders.reduce((sum, order) => sum + order.lines.reduce((lineSum, line) => lineSum + line.quantity, 0), 0);
          const shopGeneralRows = (batch.storeOrders || []).find((order) => order.shop === shop)?.rows || [];
          const generalPieces = shopGeneralRows.reduce((sum, row) => sum + row.quantity, 0);

          return (
            <section key={shop} className="letter-distribution-page min-h-[70rem] rounded-[1.5rem] border border-[#d8d1c8] bg-white p-7 shadow-2xl">
              <header className="flex items-start justify-between gap-4 border-b-2 border-[#263b2b] pb-4">
                <div>
                  <p className="text-[0.68rem] font-black uppercase tracking-[0.2em] text-[#778878]">Chocoladeletters · verdeellijst</p>
                  <h2 className="mt-1 text-3xl font-black uppercase tracking-[0.08em] text-[#263b2b]">{SHOP_LABELS[shop]}</h2>
                  <p className="mt-1 text-sm font-bold capitalize text-[#6b645b]">Productie {formatProductionPeriod(batch.startDate, batch.date)}</p>
                </div>
                <div className="rounded-2xl bg-[#e6efe2] px-4 py-3 text-right">
                  <p className="text-[0.6rem] font-black uppercase tracking-[0.12em] text-[#59705c]">Klaarzetten</p>
                  <p className="text-xl font-black text-[#263b2b]">{orderPieces + generalPieces} letters</p>
                </div>
              </header>

              <div className="mt-4 flex flex-wrap gap-2 text-xs font-black text-[#4d463d]">
                <span className="rounded-full bg-[#f1ede7] px-3 py-1">{shopOrders.length} klantbonnen</span>
                <span className="rounded-full bg-[#f1ede7] px-3 py-1">{orderPieces} voor klanten</span>
                <span className="rounded-full bg-[#e9e0e7] px-3 py-1">{generalPieces} algemene winkelvoorraad</span>
              </div>

              <section className="mt-6">
                <h3 className="text-xs font-black uppercase tracking-[0.16em] text-[#776f66]">Klantbestellingen · losse bonnen</h3>
                <div className="mt-2 grid gap-3 sm:grid-cols-2">
                  {shopOrders.map((order) => (
                    <article key={order.id} className="break-inside-avoid rounded-xl border-2 border-dashed border-[#bdb5aa] p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[0.62rem] font-black uppercase tracking-[0.13em] text-[#8b8278]">{order.code}</p>
                          <h4 className="text-lg font-black text-[#1a1815]">{order.customerName}</h4>
                          <p className="text-xs font-bold text-[#6b645b]">Afhalen {formatDate(order.pickupDate)} · {SHOP_LABELS[shop]}</p>
                        </div>
                        <span className="text-2xl" aria-hidden="true">□</span>
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
                      {order.note && <p className="mt-2 rounded-lg bg-[#fff3dc] p-2 text-xs font-bold text-[#70460e]">Notitie: {order.note}</p>}
                      <p className="mt-3 text-right text-[0.65rem] font-black uppercase tracking-[0.12em] text-[#776f66]">Klaargelegd □</p>
                    </article>
                  ))}
                </div>
              </section>

              <section className="mt-6 break-inside-avoid rounded-2xl border border-[#cab7c2] bg-[#f3edf1] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[0.62rem] font-black uppercase tracking-[0.14em] text-[#806174]">Voor in de winkel</p>
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
                <p className="mt-4 text-right text-[0.65rem] font-black uppercase tracking-[0.12em] text-[#806174]">Toegevoegd aan winkelkrat □</p>
              </section>

              <footer className="mt-8 flex items-center justify-between border-t border-[#d8d1c8] pt-3 text-[0.65rem] font-bold text-[#8b8278]">
                <span>Strik Patisserie · interne verdeellijst</span><span>{shopIndex + 1} / {DISTRIBUTION_SHOPS.length}</span>
              </footer>
            </section>
          );
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
  const [legacyOrders, setLegacyOrders] = useState<ChocolateLetterOrder[]>([]);
  const [b2bOrders, setB2BOrders] = useState<SinterklaasB2BOrder[]>([]);
  const [loading, setLoading] = useState(!demoMode);
  const [warning, setWarning] = useState("");
  const [storeOrderBatch, setStoreOrderBatch] = useState<ProductionBatchSeed | null>(null);
  const [storeOrderInitialShop, setStoreOrderInitialShop] = useState(DISTRIBUTION_SHOPS[0]);
  const [distributionBatch, setDistributionBatch] = useState<ProductionBatchSeed | null>(null);
  const [storeOrdersByBatch, setStoreOrdersByBatch] = useState<Record<string, StoreStockOrder[]>>(() =>
    Object.fromEntries(batches.map((batch) => [batch.id, batch.storeOrders || []]))
  );
  const [stockRowsByBatch, setStockRowsByBatch] = useState<Record<string, StoreOrderRow[]>>({});

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
      rows: [...(rowsByDate.get(batch.date)?.values() || [])].sort((a, b) => a.label.localeCompare(b.label, "nl")),
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
      grandRows: [...grandRows.values()].sort((a, b) => a.label.localeCompare(b.label, "nl")),
      unplanned,
    };
  }, [b2bOrders, batches, legacyOrders, stockRowsByBatch, storeOrdersByBatch]);

  const grandTotals = totalsFor(overview.grandRows);
  const totalToMake = grandTotals.orders + grandTotals.stock;

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

      <section className="overflow-hidden rounded-2xl border border-[#d8d1c8] bg-white shadow-sm">
        <div className="grid grid-cols-3">
          <div className="border-r border-[#e4ded5] p-3 sm:p-4">
            <p className="text-[0.65rem] font-black uppercase tracking-[0.12em] text-[#776f66]">Totaal te maken</p>
            <p className="mt-0.5 text-2xl font-black text-[#1a1815] sm:mt-1 sm:text-3xl">{totalToMake}</p>
          </div>
          <div className="border-r border-[#e4ded5] p-3 sm:p-4">
            <p className="text-[0.65rem] font-black uppercase tracking-[0.12em] text-[#776f66]">Gemaakt</p>
            <p className="mt-0.5 text-2xl font-black text-[#5f3f00] sm:mt-1 sm:text-3xl">{grandTotals.produced}</p>
          </div>
          <div className="p-3 sm:p-4">
            <p className="text-[0.65rem] font-black uppercase tracking-[0.12em] text-[#776f66]">Nog open</p>
            <p className="mt-0.5 text-2xl font-black text-[#9a3412] sm:mt-1 sm:text-3xl">{Math.max(0, totalToMake - grandTotals.produced)}</p>
          </div>
        </div>
        <div className="border-t border-[#d8d1c8]">
          <div className="bg-[#dcebd8] px-3 py-2 text-sm font-black text-[#24551d]">Totaal van alle productierondes</div>
          <ProductionTable rows={overview.grandRows} />
        </div>
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
              <div className="flex flex-wrap items-center justify-between gap-2 bg-[#f7df83] px-3 py-2 sm:gap-3 sm:px-4 sm:py-2.5">
                <div>
                  <p className="text-[0.56rem] font-black uppercase tracking-[0.11em] text-[#6b5120] sm:text-[0.62rem]">Centrale productieronde</p>
                  <h2 className="mt-0.5 text-sm font-black leading-tight text-[#1a1815] sm:text-base md:text-lg">{formatCompactProductionDate(batch.startDate)}</h2>
                </div>
                <div className="flex w-full flex-wrap items-center gap-1.5 sm:w-auto sm:justify-end sm:gap-2">
                  {demoMode && (
                    <button type="button" onClick={() => setDistributionBatch(batch)} className="rounded-full border border-[#4b352f]/15 bg-[#4b352f] px-2.5 py-1 text-[0.65rem] font-black text-white shadow-sm sm:px-3 sm:py-1.5 sm:text-xs">
                      Verdeel- en printlijst
                    </button>
                  )}
                  <button type="button" onClick={() => { setStoreOrderInitialShop(DISTRIBUTION_SHOPS[0]); setStoreOrderBatch(batch); }} className="rounded-full border border-white/80 bg-white/90 px-2.5 py-1 text-[0.65rem] font-black text-[#4b352f] shadow-sm sm:px-3 sm:py-1.5 sm:text-xs">
                    {storeOrdersLocked ? "Bekijk winkelvoorraad" : storeStockTotal > 0 ? "Winkelvoorraad wijzigen" : "+ Winkelvoorraad per winkel"}
                  </button>
                  <span className="bg-white/80 px-2 py-1 text-[0.64rem] font-black text-[#5f3f00] sm:px-3 sm:text-xs">{planned} te maken</span>
                  <span className="bg-[#24551d] px-2 py-1 text-[0.64rem] font-black text-white sm:px-3 sm:text-xs">{statusLabel(batch.status)}</span>
                </div>
              </div>
              <div className="grid grid-cols-3 border-b border-[#e4ded5] bg-[#fffdf6] text-center text-[0.68rem] sm:text-xs">
                <p className="border-r p-1.5 sm:p-2">Totaal te maken <strong className="block text-sm sm:text-base">{planned}</strong></p>
                <p className="border-r p-1.5 sm:p-2">Gemaakt <strong className="block text-sm sm:text-base">{totals.produced}</strong></p>
                <p className="p-1.5 sm:p-2">Open <strong className="block text-sm text-[#9a3412] sm:text-base">{Math.max(0, planned - totals.produced)}</strong></p>
              </div>
              <ProductionTable rows={batch.rows} />
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
    </div>
  );
}
