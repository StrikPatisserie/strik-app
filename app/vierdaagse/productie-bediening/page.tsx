"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  cancelOrder,
  deleteArchivedOrder,
  fetchVierdaagseOrdersFromWordPress,
  getAllOrders,
  loadDemoOrders,
  markOrderItemsReady,
  markOrderDelivered,
  markOrderReady,
  subscribeVierdaagseOrders,
  updateOrderItemStatus,
} from "../orderStore";
import {
  VierdaagseOrder,
  VierdaagseOrderStatus,
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
    return "border-[#d8422f] bg-[#fff4f1] ring-2 ring-[#d8422f]/15";
  }
  if (isOrderStillBeingMade(order) && minutes >= 8) {
    return "border-[#ef7d0a] bg-[#fffaf0]";
  }
  return "border-[#24551d] bg-white";
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

function KitchenItemLabel({
  item,
}: Readonly<{ item: VierdaagseOrder["items"][number] }>) {
  if (!item.detail) return <>{item.name}</>;

  return (
    <>
      <span>{item.name}</span>
      <span className="font-black text-[#d8422f]"> - {item.detail}</span>
    </>
  );
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

function isDrinkItem(item: VierdaagseOrder["items"][number]) {
  return item.category === "koffie-thee" || item.category === "fris-koud";
}

function sortedKitchenItems(items: VierdaagseOrder["items"]) {
  const rank = (item: VierdaagseOrder["items"][number]) => {
    if (item.category === "koffie-thee") return 2;
    if (item.category === "fris-koud") return 1;
    return 0;
  };

  return [...items].sort((first, second) => rank(first) - rank(second));
}

function itemRowTone(item: VierdaagseOrder["items"][number]) {
  if (item.category === "koffie-thee") {
    return "border-[#efb164] bg-[#fff6eb]";
  }
  if (item.category === "fris-koud") {
    return "border-[#b8d6c0] bg-[#f2faef]";
  }
  return "border-[#e5ded5] bg-white";
}

function itemQuantityTone(item: VierdaagseOrder["items"][number]) {
  return isDrinkItem(item) ? "text-[#ef7d0a]" : "text-[#24551d]";
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
      <path
        d="M9 4h6M5 7h14M10 10v7M14 10v7M7 7l1 13h8l1-13"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

function OrderCard({
  order,
  now,
  archive = false,
  isDeleting = false,
  onRefresh,
  onDelete,
}: Readonly<{
  order: VierdaagseOrder;
  now: Date;
  archive?: boolean;
  isDeleting?: boolean;
  onRefresh: () => void;
  onDelete?: (order: VierdaagseOrder) => void;
}>) {
  const elapsed = minutesBetween(order.createdAt, now);
  const allReady = order.items.every((item) => item.status === "klaar");
  const canMarkReady =
    allReady &&
    (order.status === "nieuw" || order.status === "in_productie");
  const canDeliver = order.status === "klaar_voor_bediening";
  const canMarkAllItemsReady =
    !archive &&
    !allReady &&
    (order.status === "nieuw" || order.status === "in_productie");
  const kitchenItems = sortedKitchenItems(order.items);

  function setItemStatus(itemId: string, ready: boolean) {
    updateOrderItemStatus(order.id, itemId, ready ? "klaar" : "niet_gestart");
    onRefresh();
  }

  return (
    <article
      className={`grid gap-1.5 rounded-lg border-2 p-1.5 shadow-sm sm:gap-2 sm:p-2 ${orderTone(
        order,
        now
      )}`}
    >
      <header className="flex items-start justify-between gap-2 border-b border-[#d6e5d8] pb-1">
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-baseline gap-1.5">
            <h2 className="truncate text-lg font-black leading-none text-[#24551d] sm:text-xl">
              {order.tableNumber}
            </h2>
            <span className="text-[0.64rem] font-semibold lowercase leading-none text-[#6b645b] sm:text-[0.7rem]">
              ({getLocationLabel(order.location)})
            </span>
          </div>
          <p className="mt-0.5 text-[0.64rem] font-semibold leading-tight text-[#6b645b] sm:text-[0.72rem]">
            {formatTime(order.createdAt)} · {elapsed} min geleden ·{" "}
            {countOrderItems(order.items)} st
          </p>
        </div>
        <div className="grid shrink-0 justify-items-end gap-1">
          <span
            className={`rounded-md px-1.5 py-0.5 text-[0.56rem] font-black uppercase leading-none sm:text-[0.62rem] ${
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
          {canMarkAllItemsReady && (
            <button
              type="button"
              onClick={() => {
                markOrderItemsReady(order.id);
                onRefresh();
              }}
              className="grid h-6 w-6 place-items-center rounded-md border border-[#24551d] bg-[#f2faef] text-xs font-black leading-none text-[#24551d] transition active:scale-[0.96]"
              aria-label={`Hele bon ${order.tableNumber} afvinken`}
              title="Hele bon afvinken"
            >
              ✓
            </button>
          )}
        </div>
      </header>

      <div className="grid gap-1">
        {kitchenItems.map((item) => (
          <div
            key={item.id}
            className={`grid ${
              archive
                ? "grid-cols-[1.7rem_minmax(0,1fr)]"
                : "grid-cols-[1.7rem_minmax(0,1fr)_2rem]"
            } items-center gap-1 rounded-md border px-1.5 py-1 ${itemRowTone(
              item
            )}`}
          >
            <span
              className={`text-[0.68rem] font-black leading-none sm:text-xs ${itemQuantityTone(
                item
              )}`}
            >
              {item.quantity}x
            </span>
            <span className="min-w-0 break-words text-[0.72rem] font-bold leading-tight text-[#1a1815] sm:text-xs">
              <KitchenItemLabel item={item} />
            </span>
            {!archive && (
              <button
                type="button"
                disabled={order.status === "klaar_voor_bediening"}
                onClick={() => setItemStatus(item.id, item.status !== "klaar")}
                className={`grid h-7 w-7 place-items-center rounded-md text-sm font-black leading-none transition active:scale-[0.98] disabled:opacity-60 ${
                  item.status === "klaar"
                    ? "bg-[#24551d] text-white"
                    : "border border-[#d8d0c5] bg-white text-[#8b8278]"
                }`}
                aria-label={`${itemLabel(item)} klaar melden`}
              >
                ✓
              </button>
            )}
          </div>
        ))}
      </div>

      {order.note && (
        <p className="rounded-md bg-[#fff8ef] px-1.5 py-1 text-[0.68rem] font-bold leading-tight text-[#6b3b16] sm:text-xs">
          {order.note}
        </p>
      )}

      <footer
        className={
          archive ? "grid gap-1" : "grid gap-1 sm:grid-cols-[1fr_1fr_auto]"
        }
      >
        {!archive && (
          <>
            <button
              type="button"
              disabled={!canMarkReady}
              onClick={() => {
                markOrderReady(order.id);
                onRefresh();
              }}
              className="min-h-8 rounded-md bg-[#ef7d0a] px-2 text-[0.68rem] font-black leading-tight text-white disabled:opacity-35 active:scale-[0.98] sm:min-h-9 sm:text-xs"
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
              className="min-h-8 rounded-md bg-[#24551d] px-2 text-[0.68rem] font-black text-white disabled:opacity-35 active:scale-[0.98] sm:min-h-9 sm:text-xs"
            >
              Geleverd
            </button>
            <button
              type="button"
              onClick={() => {
                cancelOrder(order.id);
                onRefresh();
              }}
              className="min-h-8 rounded-md border border-[#f0b4a8] bg-white px-2 text-[0.68rem] font-black text-[#9d2f20] active:scale-[0.98] sm:min-h-9 sm:text-xs"
            >
              Annuleer
            </button>
          </>
        )}
        {archive && (
          <div className="grid grid-cols-[1fr_auto] items-center gap-2">
            <div className="rounded-md bg-[#faf8f5] px-2 py-1 text-[0.64rem] font-bold text-[#6b645b] sm:text-[0.7rem]">
              Eindtijd {formatTime(getArchivedOrderEnd(order))} · doorlooptijd{" "}
              {minutesBetween(order.createdAt, getArchivedOrderEnd(order))} min
            </div>
            <button
              type="button"
              disabled={isDeleting}
              onClick={() => onDelete?.(order)}
              className="flex min-h-8 items-center justify-center rounded-md border border-[#f0b4a8] bg-white px-2 text-[#9d2f20] transition active:scale-[0.98] disabled:opacity-45"
              aria-label={`Bon ${order.tableNumber} definitief verwijderen`}
              title="Definitief verwijderen"
            >
              <TrashIcon />
            </button>
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
  const [deletingOrderId, setDeletingOrderId] = useState<string | null>(null);
  const [boardMessage, setBoardMessage] = useState("");
  const [boardError, setBoardError] = useState("");

  function refreshOrders() {
    setOrders(getAllOrders());
  }

  async function refreshOrdersFromWordPress() {
    const result = await fetchVierdaagseOrdersFromWordPress();
    setOrders(result.data);
  }

  useEffect(() => {
    refreshOrders();
    void refreshOrdersFromWordPress();
    const unsubscribe = subscribeVierdaagseOrders(refreshOrders);
    const interval = window.setInterval(() => {
      setNow(new Date());
      void refreshOrdersFromWordPress();
    }, 5000);

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

  async function handleDeleteArchivedOrder(order: VierdaagseOrder) {
    const confirmed = window.confirm(
      `Bon ${order.tableNumber} definitief verwijderen uit het archief?`
    );

    if (!confirmed) return;

    setDeletingOrderId(order.id);
    setBoardMessage("");
    setBoardError("");

    const result = await deleteArchivedOrder(order.id);
    refreshOrders();

    if (result.ok) {
      setBoardMessage(`Bon ${order.tableNumber} is verwijderd.`);
    } else {
      setBoardError(
        result.message ||
          "Verwijderen is niet gelukt. Controleer de WordPress-snippet."
      );
      void refreshOrdersFromWordPress();
    }

    setDeletingOrderId(null);
  }

  return (
    <main className="min-h-screen bg-[#faf8f5] px-2 py-2 pb-20 text-[#1a1815] md:pb-6 lg:px-5">
      <div className="mx-auto grid max-w-7xl gap-2 sm:gap-3">
        <header className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#d6e5d8] bg-white p-2 shadow-sm sm:p-3">
          <div className="min-w-0">
            <p className="text-[0.6rem] font-black uppercase tracking-normal text-[#ef7d0a] sm:text-[0.68rem]">
              Proeverij tool
            </p>
            <h1 className="text-lg font-black leading-tight text-[#24551d] sm:text-xl">
              Keuken
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/vierdaagse/kassa"
              className="grid h-14 w-14 place-items-center rounded-md bg-[#24551d] p-1 text-center text-white shadow-sm transition active:scale-[0.98]"
              aria-label="Naar kassa"
            >
              <span className="grid justify-items-center gap-0.5">
                <img
                  src="/app%20strik_kassa.svg"
                  alt=""
                  className="h-6 w-6 object-contain brightness-0 invert"
                />
                <span className="text-[0.52rem] font-black uppercase leading-none">
                  Kassa
                </span>
              </span>
            </Link>
          </div>
        </header>

        {(boardMessage || boardError) && (
          <div
            className={`rounded-lg border px-2 py-1.5 text-xs font-bold sm:px-3 sm:py-2 sm:text-sm ${
              boardError
                ? "border-[#f0b4a8] bg-[#fff4f2] text-[#9d2f20]"
                : "border-[#c8dfc3] bg-[#f2faef] text-[#24551d]"
            }`}
          >
            {boardError || boardMessage}
          </div>
        )}

        <nav className="grid grid-cols-3 gap-1 rounded-lg border border-[#e8e4de] bg-white p-1 shadow-sm sm:gap-1.5 sm:p-1.5">
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
              className={`min-h-9 rounded-md px-1 text-xs font-black transition active:scale-[0.98] sm:min-h-11 sm:px-2 sm:text-sm ${
                activeTab === tab.id
                  ? "bg-[#24551d] text-white"
                  : "bg-[#f6faf4] text-[#24551d]"
              }`}
            >
              {tab.id === "klaar" ? (
                <>
                  <span className="hidden sm:inline">{tab.label}</span>
                  <span className="sm:hidden">Klaar</span>
                </>
              ) : (
                tab.label
              )}{" "}
              {tab.count}
            </button>
          ))}
        </nav>

        {activeTab === "archief" && (
          <section className="grid gap-2 rounded-lg border border-[#e8e4de] bg-white p-2 shadow-sm sm:gap-3 sm:p-3">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
              <input
                type="date"
                value={filters.date}
                onChange={(event) => updateFilter("date", event.target.value)}
                className="min-h-9 rounded-md border border-[#d8d0c5] px-2 text-xs font-semibold sm:min-h-11 sm:px-3 sm:text-sm"
              />
              <input
                inputMode="numeric"
                placeholder="Jaartal"
                value={filters.year}
                onChange={(event) => updateFilter("year", event.target.value)}
                className="min-h-9 rounded-md border border-[#d8d0c5] px-2 text-xs font-semibold sm:min-h-11 sm:px-3 sm:text-sm"
              />
              <select
                value={filters.table}
                onChange={(event) => updateFilter("table", event.target.value)}
                className="min-h-9 rounded-md border border-[#d8d0c5] bg-white px-2 text-xs font-semibold sm:min-h-11 sm:px-3 sm:text-sm"
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
                className="min-h-9 rounded-md border border-[#d8d0c5] bg-white px-2 text-xs font-semibold sm:min-h-11 sm:px-3 sm:text-sm"
              >
                <option value="">Alle statussen</option>
                <option value="geleverd">Geleverd</option>
                <option value="geannuleerd">Geannuleerd</option>
              </select>
              <select
                value={filters.product}
                onChange={(event) => updateFilter("product", event.target.value)}
                className="min-h-9 rounded-md border border-[#d8d0c5] bg-white px-2 text-xs font-semibold sm:min-h-11 sm:px-3 sm:text-sm"
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
                className="min-h-9 rounded-md border border-[#d8d0c5] px-2 text-xs font-semibold sm:min-h-11 sm:px-3 sm:text-sm"
              />
            </div>

            <div className="grid gap-2 md:grid-cols-5">
              <div className="rounded-md bg-[#f6faf4] p-2 sm:p-3">
                <p className="text-[0.64rem] font-black uppercase text-[#6b645b]">
                  Bestellingen
                </p>
                <p className="text-lg font-black text-[#24551d] sm:text-xl">
                  {archiveStats.count}
                </p>
              </div>
              <div className="rounded-md bg-[#f6faf4] p-2 sm:p-3">
                <p className="text-[0.64rem] font-black uppercase text-[#6b645b]">
                  Gem. klaar
                </p>
                <p className="text-lg font-black text-[#24551d] sm:text-xl">
                  {archiveStats.averageReady ?? "-"} min
                </p>
              </div>
              <div className="rounded-md bg-[#f6faf4] p-2 sm:p-3">
                <p className="text-[0.64rem] font-black uppercase text-[#6b645b]">
                  Gem. geleverd
                </p>
                <p className="text-lg font-black text-[#24551d] sm:text-xl">
                  {archiveStats.averageDelivered ?? "-"} min
                </p>
              </div>
              <div className="rounded-md bg-[#f6faf4] p-2 sm:p-3 md:col-span-1">
                <p className="text-[0.64rem] font-black uppercase text-[#6b645b]">
                  Tafels
                </p>
                <p className="text-xs font-bold text-[#24551d]">
                  {archiveStats.tables.map(([table, count]) => `${table} ${count}`).join(" · ") || "-"}
                </p>
              </div>
              <div className="rounded-md bg-[#f6faf4] p-2 sm:p-3 md:col-span-1">
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
          <section className="grid gap-2 rounded-lg border border-dashed border-[#d8d0c5] bg-white p-3 text-center shadow-sm sm:gap-3 sm:p-4">
            <p className="text-xs font-bold text-[#6b645b] sm:text-sm">
              Er zijn nog geen Vierdaagse-bestellingen opgeslagen.
            </p>
            <button
              type="button"
              onClick={() => {
                loadDemoOrders();
                refreshOrders();
              }}
              className="mx-auto min-h-10 rounded-md bg-[#ef7d0a] px-3 text-xs font-black text-white active:scale-[0.98] sm:min-h-11 sm:px-4 sm:text-sm"
            >
              Testdata laden
            </button>
          </section>
        )}

        {orders.length > 0 && !visibleOrders.length && (
          <section className="rounded-lg border border-dashed border-[#d8d0c5] bg-white p-3 text-center text-xs font-bold text-[#6b645b] shadow-sm sm:p-4 sm:text-sm">
            Geen bestellingen in deze weergave.
          </section>
        )}

        <section className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {visibleOrders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              now={now}
              archive={activeTab === "archief"}
              isDeleting={deletingOrderId === order.id}
              onRefresh={refreshOrders}
              onDelete={handleDeleteArchivedOrder}
            />
          ))}
        </section>
      </div>
    </main>
  );
}
