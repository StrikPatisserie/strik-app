"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  cancelOrder,
  getAllOrders,
  loadDemoOrders,
  markOrderDelivered,
  markOrderReady,
  subscribeVierdaagseOrders,
  updateOrderItemStatus,
} from "../orderStore";
import {
  ProductCategoryId,
  VierdaagseOrder,
  VierdaagseOrderStatus,
  categoryLabels,
  getLocationLabel,
  vierdaagseProducts,
  vierdaagseTables,
} from "../vierdaagseData";

type BoardTab = "actief" | "klaar" | "archief";

type ArchiveFilters = {
  date: string;
  year: string;
  table: string;
  status: "" | VierdaagseOrderStatus;
  product: string;
  search: string;
};

const initialFilters: ArchiveFilters = {
  date: "",
  year: "",
  table: "",
  status: "",
  product: "",
  search: "",
};

function formatTime(value: string) {
  return new Intl.DateTimeFormat("nl-NL", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function minutesBetween(start: string, end: Date | string) {
  const endTime = typeof end === "string" ? new Date(end).getTime() : end.getTime();
  return Math.max(0, Math.floor((endTime - new Date(start).getTime()) / 60000));
}

function averageMinutes(values: number[]) {
  if (!values.length) return null;
  return Math.round(values.reduce((total, value) => total + value, 0) / values.length);
}

function isOrderStillBeingMade(order: VierdaagseOrder) {
  return (
    (order.status === "nieuw" || order.status === "in_productie") &&
    order.items.some((item) => item.status !== "klaar")
  );
}

function orderTone(order: VierdaagseOrder, now: Date) {
  const minutes = minutesBetween(order.createdAt, now);
  if (isOrderStillBeingMade(order) && minutes >= 10) {
    return "border-[#d8422f] bg-[#fff1ef] ring-2 ring-[#d8422f]/15";
  }
  if (isOrderStillBeingMade(order) && minutes >= 8) {
    return "border-[#f0d7a0] bg-[#fffaf0]";
  }
  return "border-[#d6e5d8] bg-white";
}

function statusLabel(status: VierdaagseOrderStatus) {
  if (status === "nieuw") return "Nieuw";
  if (status === "in_productie") return "In productie";
  if (status === "klaar_voor_bediening") return "Klaar voor bediening";
  if (status === "geleverd") return "Geleverd";
  return "Geannuleerd";
}

function itemLabel(item: VierdaagseOrder["items"][number]) {
  return item.detail ? `${item.name} - ${item.detail}` : item.name;
}

function countBy<T extends string>(values: T[]) {
  return values.reduce<Record<string, number>>((counts, value) => {
    counts[value] = (counts[value] || 0) + 1;
    return counts;
  }, {});
}

function getTopCounts(counts: Record<string, number>, limit = 5) {
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);
}

function matchesArchiveFilters(order: VierdaagseOrder, filters: ArchiveFilters) {
  const query = filters.search.trim().toLowerCase();

  if (filters.date && order.date !== filters.date) return false;
  if (filters.year && String(order.year) !== filters.year) return false;
  if (filters.table && order.tableNumber !== filters.table) return false;
  if (filters.status && order.status !== filters.status) return false;
  if (
    filters.product &&
    !order.items.some((item) => item.productId === filters.product)
  ) {
    return false;
  }

  if (!query) return true;

  return (
    order.id.toLowerCase().includes(query) ||
    order.tableNumber.toLowerCase().includes(query) ||
    order.note.toLowerCase().includes(query) ||
    order.items.some((item) => itemLabel(item).toLowerCase().includes(query))
  );
}

function getArchivedOrderEnd(order: VierdaagseOrder) {
  return order.deliveredAt || order.cancelledAt || order.readyAt || order.createdAt;
}

function countOrderItems(items: VierdaagseOrder["items"]) {
  return items.reduce((total, item) => total + item.quantity, 0);
}

function getOrderItemGroups(order: VierdaagseOrder) {
  const serviceItems = order.items.filter(
    (item) => item.category !== "koffie-thee"
  );
  const coffeeItems = order.items.filter(
    (item) => item.category === "koffie-thee"
  );

  return [
    {
      id: "service",
      title: "gebak/hartig/overig",
      badge: "bediening",
      items: serviceItems,
      className: "border-[#d6e5d8] bg-white",
      badgeClassName: "bg-transparent text-[#9a9188]",
    },
    {
      id: "coffee",
      title: "coffee corner",
      badge: "apart",
      items: coffeeItems,
      className: "border-[#f0c084] bg-[#fffaf4]",
      badgeClassName: "bg-transparent text-[#9a9188]",
    },
  ].filter((group) => group.items.length > 0);
}

function OrderCard({
  order,
  now,
  archive = false,
  onRefresh,
}: Readonly<{
  order: VierdaagseOrder;
  now: Date;
  archive?: boolean;
  onRefresh: () => void;
}>) {
  const elapsed = minutesBetween(order.createdAt, now);
  const allReady = order.items.every((item) => item.status === "klaar");
  const canMarkReady =
    allReady &&
    (order.status === "nieuw" || order.status === "in_productie");
  const canDeliver = order.status === "klaar_voor_bediening";
  const itemGroups = getOrderItemGroups(order);

  function setItemStatus(itemId: string, ready: boolean) {
    updateOrderItemStatus(order.id, itemId, ready ? "klaar" : "niet_gestart");
    onRefresh();
  }

  return (
    <article
      className={`grid gap-3 rounded-lg border p-3 shadow-sm ${orderTone(
        order,
        now
      )}`}
    >
      <header className="flex items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-baseline gap-2">
            <h2 className="text-2xl font-black leading-none text-[#24551d]">
              {order.tableNumber}
            </h2>
            <span className="rounded-md bg-[#ecf4ed] px-2 py-1 text-xs font-black uppercase text-[#24551d]">
              {getLocationLabel(order.location)}
            </span>
          </div>
          <p className="mt-1 text-xs font-bold text-[#6b645b]">
            {formatTime(order.createdAt)} · {elapsed} min geleden
          </p>
        </div>
        <span
          className={`rounded-md px-2 py-1 text-xs font-black uppercase ${
            order.status === "klaar_voor_bediening"
              ? "bg-[#ef7d0a] text-white"
              : order.status === "geleverd"
                ? "bg-[#24551d] text-white"
                : order.status === "geannuleerd"
                  ? "bg-[#f7d7d2] text-[#9d2f20]"
                  : "bg-white text-[#9d3c24]"
          }`}
        >
          {statusLabel(order.status)}
        </span>
      </header>

      <div className="grid gap-2">
        {itemGroups.map((group) => (
          <section
            key={group.id}
            className={`grid gap-1.5 rounded-lg border p-2 ${group.className}`}
          >
            <div className="flex items-center justify-between gap-2">
              <h3
                className="font-thin italic lowercase leading-none tracking-normal text-[#9a9188]"
                style={{ fontSize: "0.48rem", fontWeight: 200 }}
              >
                {group.title}
              </h3>
              <span
                className={`px-0.5 font-thin italic lowercase leading-none ${group.badgeClassName}`}
                style={{ fontSize: "0.46rem", fontWeight: 200 }}
              >
                {group.badge} · {countOrderItems(group.items)}
              </span>
            </div>

            {group.items.map((item) => (
              <div
                key={item.id}
                className="grid grid-cols-[2.1rem_minmax(0,1fr)_3.2rem] items-center gap-2 rounded-md border border-[#e8e4de] bg-white px-2 py-2"
              >
                <span className="text-sm font-black text-[#ef7d0a]">
                  {item.quantity}x
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-black text-[#1a1815]">
                    {itemLabel(item)}
                  </span>
                  <span className="block text-[0.64rem] font-bold uppercase text-[#8b8278]">
                    {categoryLabels[item.category as ProductCategoryId]}
                  </span>
                </span>
                <button
                  type="button"
                  disabled={archive || order.status === "klaar_voor_bediening"}
                  onClick={() => setItemStatus(item.id, item.status !== "klaar")}
                  className={`min-h-11 rounded-md text-lg font-black transition active:scale-[0.98] disabled:opacity-60 ${
                    item.status === "klaar"
                      ? "bg-[#24551d] text-white"
                      : "border border-[#d8d0c5] bg-[#faf8f5] text-[#8b8278]"
                  }`}
                  aria-label={`${itemLabel(item)} klaar melden`}
                >
                  ✓
                </button>
              </div>
            ))}
          </section>
        ))}
      </div>

      {order.note && (
        <p className="rounded-md bg-[#fff8ef] px-3 py-2 text-sm font-bold text-[#6b3b16]">
          {order.note}
        </p>
      )}

      <footer className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
        {!archive && (
          <>
            <button
              type="button"
              disabled={!canMarkReady}
              onClick={() => {
                markOrderReady(order.id);
                onRefresh();
              }}
              className="min-h-11 rounded-md bg-[#ef7d0a] px-3 text-sm font-black text-white disabled:opacity-35 active:scale-[0.98]"
            >
              Klaar voor bediening
            </button>
            <button
              type="button"
              disabled={!canDeliver}
              onClick={() => {
                markOrderDelivered(order.id);
                onRefresh();
              }}
              className="min-h-11 rounded-md bg-[#24551d] px-3 text-sm font-black text-white disabled:opacity-35 active:scale-[0.98]"
            >
              Geleverd
            </button>
            <button
              type="button"
              onClick={() => {
                cancelOrder(order.id);
                onRefresh();
              }}
              className="min-h-11 rounded-md border border-[#f0b4a8] bg-white px-3 text-sm font-black text-[#9d2f20] active:scale-[0.98]"
            >
              Annuleer
            </button>
          </>
        )}
        {archive && (
          <div className="rounded-md bg-[#faf8f5] px-3 py-2 text-xs font-bold text-[#6b645b] sm:col-span-3">
            Eindtijd {formatTime(getArchivedOrderEnd(order))} · doorlooptijd{" "}
            {minutesBetween(order.createdAt, getArchivedOrderEnd(order))} min
          </div>
        )}
      </footer>
    </article>
  );
}

export default function VierdaagseProductieBedieningPage() {
  const [orders, setOrders] = useState<VierdaagseOrder[]>([]);
  const [now, setNow] = useState(() => new Date());
  const [activeTab, setActiveTab] = useState<BoardTab>("actief");
  const [filters, setFilters] = useState<ArchiveFilters>(initialFilters);

  function refreshOrders() {
    setOrders(getAllOrders());
  }

  useEffect(() => {
    refreshOrders();
    const unsubscribe = subscribeVierdaagseOrders(refreshOrders);
    const interval = window.setInterval(() => setNow(new Date()), 30000);

    return () => {
      unsubscribe();
      window.clearInterval(interval);
    };
  }, []);

  const activeOrders = useMemo(
    () =>
      orders.filter(
        (order) => order.status === "nieuw" || order.status === "in_productie"
      ),
    [orders]
  );

  const readyOrders = useMemo(
    () => orders.filter((order) => order.status === "klaar_voor_bediening"),
    [orders]
  );

  const archivedOrders = useMemo(
    () =>
      orders.filter(
        (order) => order.status === "geleverd" || order.status === "geannuleerd"
      ),
    [orders]
  );

  const filteredArchive = useMemo(
    () =>
      archivedOrders.filter((order) => matchesArchiveFilters(order, filters)),
    [archivedOrders, filters]
  );

  const visibleOrders =
    activeTab === "actief"
      ? activeOrders
      : activeTab === "klaar"
        ? readyOrders
        : filteredArchive;

  const archiveStats = useMemo(() => {
    const readyDurations = filteredArchive
      .filter((order) => order.readyAt)
      .map((order) => minutesBetween(order.createdAt, order.readyAt || order.createdAt));
    const deliveredDurations = filteredArchive
      .filter((order) => order.deliveredAt)
      .map((order) =>
        minutesBetween(order.createdAt, order.deliveredAt || order.createdAt)
      );
    const tableCounts = countBy(filteredArchive.map((order) => order.tableNumber));
    const productCounts = filteredArchive.reduce<Record<string, number>>(
      (counts, order) => {
        for (const item of order.items) {
          const label = item.detail ? `${item.name} - ${item.detail}` : item.name;
          counts[label] = (counts[label] || 0) + item.quantity;
        }
        return counts;
      },
      {}
    );

    return {
      count: filteredArchive.length,
      averageReady: averageMinutes(readyDurations),
      averageDelivered: averageMinutes(deliveredDurations),
      tables: getTopCounts(tableCounts),
      products: getTopCounts(productCounts),
    };
  }, [filteredArchive]);

  function updateFilter<Key extends keyof ArchiveFilters>(
    key: Key,
    value: ArchiveFilters[Key]
  ) {
    setFilters((currentFilters) => ({ ...currentFilters, [key]: value }));
  }

  return (
    <main className="min-h-screen bg-[#faf8f5] px-3 py-3 pb-24 text-[#1a1815] md:pb-6 lg:px-5">
      <div className="mx-auto grid max-w-7xl gap-3">
        <header className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#d6e5d8] bg-white p-3 shadow-sm">
          <div className="min-w-0">
            <p className="text-[0.68rem] font-black uppercase tracking-normal text-[#ef7d0a]">
              Vierdaagse kassa
            </p>
            <h1 className="text-xl font-black leading-tight text-[#24551d]">
              Productie & bediening
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/vierdaagse/kassa"
              className="rounded-md bg-[#ef7d0a] px-3 py-2 text-sm font-black text-white transition active:scale-[0.98]"
            >
              Nieuwe bestelling
            </Link>
            <Link
              href="/vierdaagse/kassa-tool"
              className="rounded-md border border-[#d6e5d8] bg-white px-3 py-2 text-sm font-black text-[#24551d] transition active:scale-[0.98]"
            >
              Terug
            </Link>
          </div>
        </header>

        <nav className="grid grid-cols-3 gap-1.5 rounded-lg border border-[#e8e4de] bg-white p-1.5 shadow-sm">
          {[
            { id: "actief" as const, label: "Actief", count: activeOrders.length },
            {
              id: "klaar" as const,
              label: "Klaar voor bediening",
              count: readyOrders.length,
            },
            {
              id: "archief" as const,
              label: "Archief",
              count: archivedOrders.length,
            },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`min-h-11 rounded-md px-2 text-sm font-black transition active:scale-[0.98] ${
                activeTab === tab.id
                  ? "bg-[#24551d] text-white"
                  : "bg-[#f6faf4] text-[#24551d]"
              }`}
            >
              {tab.label} {tab.count}
            </button>
          ))}
        </nav>

        {activeTab === "archief" && (
          <section className="grid gap-3 rounded-lg border border-[#e8e4de] bg-white p-3 shadow-sm">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
              <input
                type="date"
                value={filters.date}
                onChange={(event) => updateFilter("date", event.target.value)}
                className="min-h-11 rounded-md border border-[#d8d0c5] px-3 text-sm font-semibold"
              />
              <input
                inputMode="numeric"
                placeholder="Jaartal"
                value={filters.year}
                onChange={(event) => updateFilter("year", event.target.value)}
                className="min-h-11 rounded-md border border-[#d8d0c5] px-3 text-sm font-semibold"
              />
              <select
                value={filters.table}
                onChange={(event) => updateFilter("table", event.target.value)}
                className="min-h-11 rounded-md border border-[#d8d0c5] bg-white px-3 text-sm font-semibold"
              >
                <option value="">Alle tafels</option>
                {vierdaagseTables.map((table) => (
                  <option key={table.id} value={table.label}>
                    {table.label}
                  </option>
                ))}
              </select>
              <select
                value={filters.status}
                onChange={(event) =>
                  updateFilter(
                    "status",
                    event.target.value as ArchiveFilters["status"]
                  )
                }
                className="min-h-11 rounded-md border border-[#d8d0c5] bg-white px-3 text-sm font-semibold"
              >
                <option value="">Alle statussen</option>
                <option value="geleverd">Geleverd</option>
                <option value="geannuleerd">Geannuleerd</option>
              </select>
              <select
                value={filters.product}
                onChange={(event) => updateFilter("product", event.target.value)}
                className="min-h-11 rounded-md border border-[#d8d0c5] bg-white px-3 text-sm font-semibold"
              >
                <option value="">Alle producten</option>
                {vierdaagseProducts.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </select>
              <input
                placeholder="Zoeken"
                value={filters.search}
                onChange={(event) => updateFilter("search", event.target.value)}
                className="min-h-11 rounded-md border border-[#d8d0c5] px-3 text-sm font-semibold"
              />
            </div>

            <div className="grid gap-2 md:grid-cols-5">
              <div className="rounded-md bg-[#f6faf4] p-3">
                <p className="text-[0.64rem] font-black uppercase text-[#6b645b]">
                  Bestellingen
                </p>
                <p className="text-xl font-black text-[#24551d]">
                  {archiveStats.count}
                </p>
              </div>
              <div className="rounded-md bg-[#f6faf4] p-3">
                <p className="text-[0.64rem] font-black uppercase text-[#6b645b]">
                  Gem. klaar
                </p>
                <p className="text-xl font-black text-[#24551d]">
                  {archiveStats.averageReady ?? "-"} min
                </p>
              </div>
              <div className="rounded-md bg-[#f6faf4] p-3">
                <p className="text-[0.64rem] font-black uppercase text-[#6b645b]">
                  Gem. geleverd
                </p>
                <p className="text-xl font-black text-[#24551d]">
                  {archiveStats.averageDelivered ?? "-"} min
                </p>
              </div>
              <div className="rounded-md bg-[#f6faf4] p-3 md:col-span-1">
                <p className="text-[0.64rem] font-black uppercase text-[#6b645b]">
                  Tafels
                </p>
                <p className="text-xs font-bold text-[#24551d]">
                  {archiveStats.tables.map(([table, count]) => `${table} ${count}`).join(" · ") || "-"}
                </p>
              </div>
              <div className="rounded-md bg-[#f6faf4] p-3 md:col-span-1">
                <p className="text-[0.64rem] font-black uppercase text-[#6b645b]">
                  Populair
                </p>
                <p className="text-xs font-bold text-[#24551d]">
                  {archiveStats.products
                    .map(([product, count]) => `${product} ${count}`)
                    .join(" · ") || "-"}
                </p>
              </div>
            </div>
          </section>
        )}

        {!orders.length && (
          <section className="grid gap-3 rounded-lg border border-dashed border-[#d8d0c5] bg-white p-4 text-center shadow-sm">
            <p className="text-sm font-bold text-[#6b645b]">
              Er zijn nog geen Vierdaagse-bestellingen opgeslagen.
            </p>
            <button
              type="button"
              onClick={() => {
                loadDemoOrders();
                refreshOrders();
              }}
              className="mx-auto min-h-11 rounded-md bg-[#ef7d0a] px-4 text-sm font-black text-white active:scale-[0.98]"
            >
              Testdata laden
            </button>
          </section>
        )}

        {orders.length > 0 && !visibleOrders.length && (
          <section className="rounded-lg border border-dashed border-[#d8d0c5] bg-white p-4 text-center text-sm font-bold text-[#6b645b] shadow-sm">
            Geen bestellingen in deze weergave.
          </section>
        )}

        <section className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
          {visibleOrders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              now={now}
              archive={activeTab === "archief"}
              onRefresh={refreshOrders}
            />
          ))}
        </section>
      </div>
    </main>
  );
}
