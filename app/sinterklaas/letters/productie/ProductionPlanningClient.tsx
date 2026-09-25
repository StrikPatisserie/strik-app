"use client";

import { useEffect, useMemo, useState } from "react";
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

export type ProductionBatchSeed = {
  id: string;
  date: string;
  status: string;
  minimumLeadDays: number;
  rows: ProductionSeedRow[];
};

type WorkingRow = ProductionSeedRow;

function formatDate(date: string) {
  return new Intl.DateTimeFormat("nl-NL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${date}T12:00:00`));
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
  if (batches.some((batch) => batch.date === explicitDate)) return explicitDate;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(requestedDate)) return "";

  return batches
    .filter((batch) => addDays(batch.date, batch.minimumLeadDays) <= requestedDate)
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

function ProductionTable({ rows }: Readonly<{ rows: WorkingRow[] }>) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[620px] border-collapse text-left text-sm">
        <thead className="bg-[#f1ede7] text-[0.66rem] font-black uppercase tracking-[0.1em] text-[#6b645b]">
          <tr>
            <th className="px-3 py-2">Letter</th>
            <th className="px-3 py-2 text-right">Besteld</th>
            <th className="px-3 py-2 text-right">Voorraad</th>
            <th className="px-3 py-2 text-right">Te maken</th>
            <th className="px-3 py-2 text-right">Gemaakt</th>
            <th className="px-3 py-2 text-right">Open</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-3 py-4 text-center font-semibold text-[#776f66]">
                Nog geen letters ingepland.
              </td>
            </tr>
          ) : rows.map((row) => {
            const planned = row.orders + row.stock;
            return (
              <tr key={row.key} className="border-t border-[#e4ded5] bg-white">
                <td className="px-3 py-2 font-bold text-[#1a1815]">{row.label}</td>
                <td className="px-3 py-2 text-right">{row.orders}</td>
                <td className="px-3 py-2 text-right">{row.stock}</td>
                <td className="px-3 py-2 text-right font-black">{planned}</td>
                <td className="px-3 py-2 text-right">{row.produced}</td>
                <td className="px-3 py-2 text-right font-black text-[#9a3412]">
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

export default function ProductionPlanningClient({
  season,
  batches,
  centralUnplannedCount,
}: Readonly<{
  season: string;
  batches: ProductionBatchSeed[];
  centralUnplannedCount: number;
}>) {
  const [legacyOrders, setLegacyOrders] = useState<ChocolateLetterOrder[]>([]);
  const [b2bOrders, setB2BOrders] = useState<SinterklaasB2BOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [warning, setWarning] = useState("");

  useEffect(() => {
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
  }, [season]);

  const overview = useMemo(() => {
    const rowsByDate = new Map<string, Map<string, WorkingRow>>();
    for (const batch of batches) {
      rowsByDate.set(
        batch.date,
        new Map(batch.rows.map((row) => [row.key, { ...row }]))
      );
    }

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
  }, [b2bOrders, batches, legacyOrders]);

  const grandTotals = totalsFor(overview.grandRows);
  const totalToMake = grandTotals.orders + grandTotals.stock;

  return (
    <div className="space-y-5">
      {loading && (
        <p className="border border-[#d8d1c8] bg-white px-3 py-2 text-sm font-bold text-[#6b645b]">
          Bestaande B2B- en winkelbestellingen worden erbij geladen...
        </p>
      )}
      {warning && <p role="alert" className="border border-[#efb8aa] bg-[#fff4ef] px-3 py-2 text-sm font-bold text-[#9a3412]">{warning}</p>}

      <section className="border border-[#d8d1c8] bg-white shadow-sm">
        <div className="grid sm:grid-cols-4">
          <div className="border-b border-[#e4ded5] p-4 sm:border-b-0 sm:border-r">
            <p className="text-[0.65rem] font-black uppercase tracking-[0.12em] text-[#776f66]">Totaal te maken</p>
            <p className="mt-1 text-3xl font-black text-[#1a1815]">{totalToMake}</p>
          </div>
          <div className="border-b border-[#e4ded5] p-4 sm:border-b-0 sm:border-r">
            <p className="text-[0.65rem] font-black uppercase tracking-[0.12em] text-[#776f66]">Voor bestellingen</p>
            <p className="mt-1 text-3xl font-black text-[#24551d]">{grandTotals.orders}</p>
          </div>
          <div className="border-b border-[#e4ded5] p-4 sm:border-b-0 sm:border-r">
            <p className="text-[0.65rem] font-black uppercase tracking-[0.12em] text-[#776f66]">Extra voorraad</p>
            <p className="mt-1 text-3xl font-black text-[#5f3f00]">{grandTotals.stock}</p>
          </div>
          <div className="p-4">
            <p className="text-[0.65rem] font-black uppercase tracking-[0.12em] text-[#776f66]">Nog open</p>
            <p className="mt-1 text-3xl font-black text-[#9a3412]">{Math.max(0, totalToMake - grandTotals.produced)}</p>
          </div>
        </div>
        <div className="border-t border-[#d8d1c8]">
          <div className="bg-[#dcebd8] px-3 py-2 text-sm font-black text-[#24551d]">Totaal van alle drie productiedagen</div>
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
          return (
            <section key={batch.id} className="overflow-hidden border border-[#d8d1c8] bg-white shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 bg-[#f7df83] px-4 py-3">
                <div>
                  <p className="text-[0.65rem] font-black uppercase tracking-[0.12em] text-[#6b5120]">Centrale productiedag</p>
                  <h2 className="text-xl font-black capitalize text-[#1a1815]">{formatDate(batch.date)}</h2>
                </div>
                <div className="flex items-center gap-2">
                  <span className="bg-white/80 px-3 py-1 text-xs font-black text-[#5f3f00]">{planned} te maken</span>
                  <span className="bg-[#24551d] px-3 py-1 text-xs font-black text-white">{statusLabel(batch.status)}</span>
                </div>
              </div>
              <div className="grid grid-cols-4 border-b border-[#e4ded5] bg-[#fffdf6] text-center text-xs">
                <p className="border-r p-2">Besteld <strong className="block text-base">{totals.orders}</strong></p>
                <p className="border-r p-2">Voorraad <strong className="block text-base">{totals.stock}</strong></p>
                <p className="border-r p-2">Gemaakt <strong className="block text-base">{totals.produced}</strong></p>
                <p className="p-2">Open <strong className="block text-base text-[#9a3412]">{Math.max(0, planned - totals.produced)}</strong></p>
              </div>
              <ProductionTable rows={batch.rows} />
            </section>
          );
        })}
      </div>
    </div>
  );
}
