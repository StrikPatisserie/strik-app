"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  cancelOrder,
  deleteArchivedOrder,
  fetchVierdaagseOrdersFromWordPress,
  getAllOrders,
  loadDemoOrders,
  markOrderDelivered,
  setOrderItemsReady,
  subscribeVierdaagseOrders,
  updateOrderItemStatus,
  updateVierdaagseOrderDetails,
} from "../orderStore";
import {
  fetchVierdaagseProductsFromWordPress,
  getStoredVierdaagseProducts,
} from "../productStore";
import {
  ProductCategoryId,
  VierdaagseLocation,
  VierdaagseOrder,
  VierdaagseOrderItem,
  VierdaagseProduct,
  VierdaagseOrderStatus,
  getLocationLabel,
  sortVierdaagseProducts,
  vierdaagseProducts,
  vierdaagseTables,
} from "../vierdaagseData";
import TableMapDialog from "../TableMapDialog";

type BoardTab = "actief" | "archief";

type ArchiveFilters = {
  date: string;
  year: string;
  table: string;
  status: "" | VierdaagseOrderStatus;
  product: string;
  search: string;
};

type EditOrderLine = {
  id: string;
  productId: string;
  name: string;
  category: ProductCategoryId;
  quantity: number;
  status: VierdaagseOrderItem["status"];
  detail: string;
};

type EditOrderDraft = {
  tableNumber: string;
  location: VierdaagseLocation;
  note: string;
  items: EditOrderLine[];
};

const initialFilters: ArchiveFilters = {
  date: "",
  year: "",
  table: "",
  status: "",
  product: "",
  search: "",
};

function productBadgeFromName(value: string) {
  return (
    value
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "P"
  );
}

function getProductsForOrders(
  products: VierdaagseProduct[],
  orders: VierdaagseOrder[]
) {
  const productsById = new Map(products.map((product) => [product.id, product]));

  orders.forEach((order) => {
    order.items.forEach((item) => {
      if (productsById.has(item.productId)) return;

      productsById.set(item.productId, {
        id: item.productId,
        name: item.name,
        category: item.category,
        badge: productBadgeFromName(item.name),
      });
    });
  });

  return sortVierdaagseProducts([...productsById.values()]);
}

function createEditDraft(order: VierdaagseOrder): EditOrderDraft {
  return {
    tableNumber: order.tableNumber,
    location: order.location,
    note: order.note,
    items: order.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      name: item.name,
      category: item.category,
      quantity: item.quantity,
      status: item.status,
      detail: item.detail || "",
    })),
  };
}

function normalizeEditLine(line: EditOrderLine): VierdaagseOrderItem {
  return {
    ...line,
    quantity: Math.max(1, Math.min(99, Math.round(line.quantity) || 1)),
    detail: line.detail.trim() || undefined,
  };
}

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
    isLiveOrder(order) &&
    order.items.some((item) => item.status !== "klaar")
  );
}

function isLiveOrder(order: VierdaagseOrder) {
  return (
    order.status === "nieuw" ||
    order.status === "in_productie" ||
    order.status === "klaar_voor_bediening"
  );
}

function isReadyForService(order: VierdaagseOrder) {
  return (
    isLiveOrder(order) &&
    order.items.length > 0 &&
    order.items.every((item) => item.status === "klaar")
  );
}

function orderTone(order: VierdaagseOrder, now: Date) {
  const minutes = minutesBetween(order.createdAt, now);
  if (isReadyForService(order)) {
    return "border-[#163f1a] bg-[#24551d] text-white ring-2 ring-[#163f1a]/15";
  }
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
  readyForService = false,
}: Readonly<{
  item: VierdaagseOrder["items"][number];
  readyForService?: boolean;
}>) {
  if (!item.detail) return <>{item.name}</>;

  return (
    <>
      <span>{item.name}</span>
      <span
        className={`font-black ${
          readyForService ? "text-white" : "text-[#d8422f]"
        }`}
      >
        {" "}
        - {item.detail}
      </span>
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

function getOrderCreatedAtMs(order: VierdaagseOrder) {
  const createdAtMs = new Date(order.createdAt).getTime();
  if (Number.isFinite(createdAtMs)) return createdAtMs;

  const orderIdTime = order.id.match(/^VD-\d{4}-([A-Z0-9]+)-/);
  if (orderIdTime) {
    const parsedOrderIdTime = Number.parseInt(orderIdTime[1], 36);
    if (Number.isFinite(parsedOrderIdTime)) return parsedOrderIdTime;
  }

  const orderDateMs = new Date(order.date).getTime();
  return Number.isFinite(orderDateMs) ? orderDateMs : 0;
}

function sortActiveKitchenOrders(orders: VierdaagseOrder[]) {
  return [...orders].sort((firstOrder, secondOrder) => {
    return (
      getOrderCreatedAtMs(firstOrder) - getOrderCreatedAtMs(secondOrder)
    );
  });
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

function itemRowTone(
  item: VierdaagseOrder["items"][number],
  readyForService = false
) {
  if (readyForService) {
    return "border-white/15 bg-white/10";
  }
  if (item.category === "koffie-thee") {
    return "border-[#efb164] bg-[#fff6eb]";
  }
  if (item.category === "fris-koud") {
    return "border-[#b8d6c0] bg-[#f2faef]";
  }
  return "border-[#e5ded5] bg-white";
}

function itemQuantityTone(
  item: VierdaagseOrder["items"][number],
  readyForService = false
) {
  if (readyForService) return "text-white";
  return isDrinkItem(item) ? "text-[#ef7d0a]" : "text-[#24551d]";
}

function ReadyCurlIcon() {
  return (
    <svg viewBox="0 0 34 24" aria-hidden="true" className="h-6 w-8">
      <path
        d="M4 15c6 8 19 5 18-3-.7-6.3-10.4-5.6-9.1.5.9 4.2 9.1 4.5 16.6-5.5"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="3"
      />
    </svg>
  );
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

function OrderEditDialog({
  order,
  products,
  onClose,
  onSave,
}: Readonly<{
  order: VierdaagseOrder;
  products: VierdaagseProduct[];
  onClose: () => void;
  onSave: (draft: EditOrderDraft) => void;
}>) {
  const [draft, setDraft] = useState(() => createEditDraft(order));
  const productsById = useMemo(
    () => new Map(products.map((product) => [product.id, product])),
    [products]
  );
  const selectedTable = vierdaagseTables.find(
    (table) => table.label === draft.tableNumber
  );
  const tableValue = selectedTable ? selectedTable.label : "custom";

  useEffect(() => {
    setDraft(createEditDraft(order));
  }, [order]);

  function updateLine(lineId: string, changes: Partial<EditOrderLine>) {
    setDraft((currentDraft) => ({
      ...currentDraft,
      items: currentDraft.items.map((item) =>
        item.id === lineId ? { ...item, ...changes } : item
      ),
    }));
  }

  function changeLineProduct(lineId: string, productId: string) {
    const product = productsById.get(productId);
    if (!product) return;

    updateLine(lineId, {
      productId: product.id,
      name: product.name,
      category: product.category,
      status: "niet_gestart",
    });
  }

  function addProductLine() {
    const product = products[0];
    if (!product) return;

    setDraft((currentDraft) => ({
      ...currentDraft,
      items: [
        ...currentDraft.items,
        {
          id: `edit-${Date.now()}-${currentDraft.items.length}`,
          productId: product.id,
          name: product.name,
          category: product.category,
          quantity: 1,
          status: "niet_gestart",
          detail: "",
        },
      ],
    }));
  }

  function removeLine(lineId: string) {
    setDraft((currentDraft) => ({
      ...currentDraft,
      items: currentDraft.items.filter((item) => item.id !== lineId),
    }));
  }

  function saveDraft() {
    if (!draft.tableNumber.trim() || draft.items.length < 1) return;
    onSave({
      ...draft,
      tableNumber: draft.tableNumber.trim(),
      items: draft.items.map((item) => ({
        ...item,
        quantity: Math.max(1, Math.min(99, Math.round(item.quantity) || 1)),
        detail: item.detail.trim(),
      })),
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-[#1a1815]/55 p-2 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Bon ${order.tableNumber} wijzigen`}
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Bewerken sluiten"
        onClick={onClose}
      />
      <section className="relative z-10 grid max-h-[92vh] w-full max-w-3xl gap-2 overflow-y-auto rounded-lg border border-[#d6e5d8] bg-[#faf8f5] p-2 shadow-2xl sm:gap-3 sm:p-3">
        <header className="flex items-start justify-between gap-2 rounded-md bg-white p-2">
          <div className="min-w-0">
            <p className="text-[0.62rem] font-black uppercase text-[#ef7d0a] sm:text-xs">
              Bon wijzigen
            </p>
            <h2 className="text-base font-black leading-tight text-[#24551d] sm:text-xl">
              {order.tableNumber}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#24551d] text-sm font-black text-white active:scale-[0.96]"
            aria-label="Bewerken sluiten"
          >
            X
          </button>
        </header>

        <div className="grid gap-2 rounded-md bg-white p-2 sm:grid-cols-[1fr_1fr]">
          <label className="grid gap-1 text-[0.65rem] font-black uppercase text-[#6b645b]">
            Tafel
            <select
              value={tableValue}
              onChange={(event) => {
                const table = vierdaagseTables.find(
                  (option) => option.label === event.target.value
                );
                setDraft((currentDraft) => ({
                  ...currentDraft,
                  tableNumber: table ? table.label : currentDraft.tableNumber,
                  location: table ? table.location : currentDraft.location,
                }));
              }}
              className="min-h-10 rounded-md border border-[#d8d0c5] bg-white px-2 text-sm font-bold normal-case text-[#1a1815] outline-none focus:border-[#24551d]"
            >
              {vierdaagseTables.map((table) => (
                <option key={table.id} value={table.label}>
                  {table.label} - {getLocationLabel(table.location)}
                </option>
              ))}
              <option value="custom">Anders / to go</option>
            </select>
          </label>
          <label className="grid gap-1 text-[0.65rem] font-black uppercase text-[#6b645b]">
            Tafeltekst
            <input
              value={draft.tableNumber}
              onChange={(event) =>
                setDraft((currentDraft) => ({
                  ...currentDraft,
                  tableNumber: event.target.value,
                }))
              }
              className="min-h-10 rounded-md border border-[#d8d0c5] bg-white px-2 text-sm font-bold normal-case text-[#1a1815] outline-none focus:border-[#24551d]"
            />
          </label>
          <label className="grid gap-1 text-[0.65rem] font-black uppercase text-[#6b645b] sm:col-span-2">
            Notitie
            <input
              value={draft.note}
              onChange={(event) =>
                setDraft((currentDraft) => ({
                  ...currentDraft,
                  note: event.target.value,
                }))
              }
              className="min-h-10 rounded-md border border-[#d8d0c5] bg-white px-2 text-sm font-semibold normal-case text-[#1a1815] outline-none focus:border-[#24551d]"
            />
          </label>
        </div>

        <div className="grid gap-1.5">
          {draft.items.map((item) => (
            <div
              key={item.id}
              className="grid gap-1 rounded-md border border-[#e8e4de] bg-white p-1.5 sm:grid-cols-[4.8rem_minmax(0,1fr)_minmax(0,1fr)_2.4rem] sm:items-end"
            >
              <label className="grid gap-1 text-[0.62rem] font-black uppercase text-[#6b645b]">
                Aantal
                <input
                  type="number"
                  min={1}
                  max={99}
                  value={item.quantity}
                  onChange={(event) =>
                    updateLine(item.id, {
                      quantity: Number(event.target.value) || 1,
                      status: "niet_gestart",
                    })
                  }
                  className="min-h-10 rounded-md border border-[#d8d0c5] px-2 text-sm font-black text-[#ef7d0a] outline-none focus:border-[#24551d]"
                />
              </label>
              <label className="grid gap-1 text-[0.62rem] font-black uppercase text-[#6b645b]">
                Product
                <select
                  value={item.productId}
                  onChange={(event) =>
                    changeLineProduct(item.id, event.target.value)
                  }
                  className="min-h-10 rounded-md border border-[#d8d0c5] bg-white px-2 text-sm font-bold normal-case text-[#1a1815] outline-none focus:border-[#24551d]"
                >
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-[0.62rem] font-black uppercase text-[#6b645b]">
                Optie
                <input
                  value={item.detail}
                  onChange={(event) =>
                    updateLine(item.id, {
                      detail: event.target.value,
                      status: "niet_gestart",
                    })
                  }
                  placeholder="Bijv. havermelk"
                  className="min-h-10 rounded-md border border-[#d8d0c5] px-2 text-sm font-semibold normal-case text-[#1a1815] outline-none focus:border-[#24551d]"
                />
              </label>
              <button
                type="button"
                disabled={draft.items.length <= 1}
                onClick={() => removeLine(item.id)}
                className="min-h-10 rounded-md border border-[#f0b4a8] bg-white px-2 text-xs font-black text-[#9d2f20] disabled:opacity-30 active:scale-[0.98]"
              >
                Weg
              </button>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={addProductLine}
            className="min-h-10 rounded-md border border-[#d8d0c5] bg-white px-2 text-xs font-black text-[#24551d] active:scale-[0.98]"
          >
            Product erbij
          </button>
          <button
            type="button"
            onClick={onClose}
            className="min-h-10 rounded-md border border-[#d8d0c5] bg-white px-2 text-xs font-black text-[#6b645b] active:scale-[0.98]"
          >
            Annuleer
          </button>
          <button
            type="button"
            onClick={saveDraft}
            className="min-h-10 rounded-md bg-[#24551d] px-2 text-xs font-black text-white active:scale-[0.98]"
          >
            Opslaan
          </button>
        </div>
      </section>
    </div>
  );
}

function OrderCard({
  order,
  now,
  archive = false,
  isDeleting = false,
  onRefresh,
  onDelete,
  onShowTableMap,
  onEdit,
}: Readonly<{
  order: VierdaagseOrder;
  now: Date;
  archive?: boolean;
  isDeleting?: boolean;
  onRefresh: () => void;
  onDelete?: (order: VierdaagseOrder) => void;
  onShowTableMap: (tableNumber: string) => void;
  onEdit: (order: VierdaagseOrder) => void;
}>) {
  const elapsed = minutesBetween(order.createdAt, now);
  const displayMinutes = archive
    ? minutesBetween(order.createdAt, getArchivedOrderEnd(order))
    : elapsed;
  const displayTimeContext = archive
    ? order.status === "geleverd"
      ? "geleverd"
      : order.status === "geannuleerd"
        ? "geannuleerd"
        : "afgerond"
    : "geleden";
  const allReady = order.items.every((item) => item.status === "klaar");
  const readyForService = isReadyForService(order);
  const canDeliver = readyForService;
  const showBulkReadyCheck = !archive && isLiveOrder(order);
  const kitchenItems = sortedKitchenItems(order.items);

  function setItemStatus(itemId: string, ready: boolean) {
    updateOrderItemStatus(order.id, itemId, ready ? "klaar" : "niet_gestart");
    onRefresh();
  }

  return (
    <article
      className={`grid gap-1 rounded-md border-2 p-1 shadow-sm sm:gap-1.5 sm:p-1.5 ${orderTone(
        order,
        now
      )}`}
    >
      {readyForService && (
        <div className="flex items-center justify-between gap-2 rounded-md bg-white/10 px-1.5 py-0.5 text-white">
          <p className="text-[0.78rem] font-black uppercase leading-none sm:text-sm">
            Klaar voor levering
          </p>
          <ReadyCurlIcon />
        </div>
      )}
      <header
        className={`flex items-start justify-between gap-1.5 border-b pb-0.5 ${
          readyForService ? "border-white/20" : "border-[#d6e5d8]"
        }`}
      >
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-baseline gap-1.5">
            <h2
              className={`truncate text-lg font-black leading-none sm:text-xl ${
                readyForService ? "text-white" : "text-[#24551d]"
              }`}
            >
              {order.tableNumber}
            </h2>
            <button
              type="button"
              onClick={() => onShowTableMap(order.tableNumber)}
              className={`grid h-5 w-5 place-items-center rounded-full border text-[0.62rem] font-black leading-none active:scale-[0.96] ${
                readyForService
                  ? "border-white/55 bg-white text-[#24551d]"
                  : "border-[#24551d]/25 bg-white text-[#24551d]"
              }`}
              aria-label={`Plattegrond voor ${order.tableNumber}`}
            >
              i
            </button>
            <span
              className={`text-[0.64rem] font-semibold lowercase leading-none sm:text-[0.7rem] ${
                readyForService ? "text-white/75" : "text-[#6b645b]"
              }`}
            >
              ({getLocationLabel(order.location)})
            </span>
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-1">
            <span
              className={`text-[0.62rem] font-semibold leading-none sm:text-[0.68rem] ${
                readyForService ? "text-white/75" : "text-[#6b645b]"
              }`}
            >
              {formatTime(order.createdAt)}
            </span>
            <span
              className={`rounded-md px-1.5 py-0.5 text-[0.78rem] font-black leading-none sm:text-[0.88rem] ${
                archive
                  ? order.status === "geannuleerd"
                    ? "bg-[#f7d7d2] text-[#9d2f20]"
                    : "bg-[#24551d] text-white"
                  : readyForService
                  ? "bg-white text-[#24551d]"
                  : elapsed >= 10
                    ? "bg-[#d8422f] text-white"
                    : elapsed >= 8
                      ? "bg-[#ef7d0a] text-white"
                      : "bg-[#24551d] text-white"
              }`}
            >
              {displayMinutes} min
            </span>
            <span
              className={`text-[0.62rem] font-semibold leading-none sm:text-[0.68rem] ${
                readyForService ? "text-white/75" : "text-[#6b645b]"
              }`}
            >
              {displayTimeContext} · {countOrderItems(order.items)} st
            </span>
          </div>
        </div>
        <div className="grid shrink-0 justify-items-end gap-1">
          <span
            className={`rounded-md px-1.5 py-0.5 text-[0.56rem] font-black uppercase leading-none sm:text-[0.62rem] ${
              readyForService
                ? "bg-white text-[#24551d]"
                : order.status === "geleverd"
                  ? "bg-[#24551d] text-white"
                  : order.status === "geannuleerd"
                    ? "bg-[#f7d7d2] text-[#9d2f20]"
                    : "bg-white text-[#9d3c24]"
            }`}
          >
            {readyForService ? "Klaar" : statusLabel(order.status)}
          </span>
          {showBulkReadyCheck && (
            <button
              type="button"
              onClick={() => {
                setOrderItemsReady(order.id, !allReady);
                onRefresh();
              }}
              className={`-m-1 grid h-8 w-8 place-items-center rounded-md border text-base font-black leading-none transition active:scale-[0.96] ${
                allReady
                  ? readyForService
                    ? "border-white bg-white text-[#24551d]"
                    : "border-[#24551d] bg-[#24551d] text-white"
                  : readyForService
                    ? "border-white/70 bg-transparent text-white"
                    : "border-[#24551d] bg-white text-[#24551d]"
              }`}
              aria-label={
                allReady
                  ? `Hele bon ${order.tableNumber} uitvinken`
                  : `Hele bon ${order.tableNumber} afvinken`
              }
              title={allReady ? "Hele bon uitvinken" : "Hele bon afvinken"}
            >
              {allReady ? "✓" : ""}
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
                ? "grid-cols-[2.5rem_minmax(0,1fr)]"
                : "grid-cols-[2.5rem_minmax(0,1fr)_1.8rem]"
            } items-center gap-0.5 rounded-md border px-1 py-0.5 ${itemRowTone(
              item,
              readyForService
            )}`}
          >
            <span
              className={`text-base font-black leading-none sm:text-lg ${itemQuantityTone(
                item,
                readyForService
              )}`}
            >
              {item.quantity}x
            </span>
            <span
              className={`min-w-0 break-words text-xs font-bold leading-tight sm:text-sm ${
                readyForService ? "text-white" : "text-[#1a1815]"
              }`}
            >
              <KitchenItemLabel item={item} readyForService={readyForService} />
            </span>
            {!archive && (
              <button
                type="button"
                onClick={() => setItemStatus(item.id, item.status !== "klaar")}
                className={`-m-1 grid h-8 w-8 place-items-center rounded-md text-lg font-black leading-none transition active:scale-[0.98] ${
                  item.status === "klaar"
                    ? readyForService
                      ? "bg-white text-[#24551d]"
                      : "bg-[#24551d] text-white"
                    : readyForService
                      ? "border border-white/70 bg-transparent text-white"
                      : "border border-[#d8d0c5] bg-white text-[#8b8278]"
                }`}
                aria-label={`${itemLabel(item)} klaar melden`}
              >
                {item.status === "klaar" ? "✓" : ""}
              </button>
            )}
          </div>
        ))}
      </div>

      {order.note && (
        <p
          className={`rounded-md px-1.5 py-1 text-[0.68rem] font-bold leading-tight sm:text-xs ${
            readyForService
              ? "bg-white/10 text-white"
              : "bg-[#fff8ef] text-[#6b3b16]"
          }`}
        >
          {order.note}
        </p>
      )}

      <footer
        className={
          archive ? "grid gap-1" : "grid gap-1 sm:grid-cols-[1fr_auto_auto]"
        }
      >
        {!archive && (
          <>
            <button
              type="button"
              disabled={!canDeliver}
              onClick={() => {
                markOrderDelivered(order.id);
                onRefresh();
              }}
              className="min-h-7 rounded-md bg-[#ef7d0a] px-2 text-[0.68rem] font-black text-white shadow-sm disabled:opacity-35 active:scale-[0.98] sm:min-h-8 sm:text-xs"
            >
              Geleverd
            </button>
            <button
              type="button"
              onClick={() => onEdit(order)}
              className="min-h-7 rounded-md border border-[#d8d0c5] bg-white px-2 text-[0.68rem] font-black text-[#24551d] active:scale-[0.98] sm:min-h-8 sm:text-xs"
            >
              Wijzig
            </button>
            <button
              type="button"
              onClick={() => {
                cancelOrder(order.id);
                onRefresh();
              }}
              className="min-h-7 rounded-md border border-[#f0b4a8] bg-white px-2 text-[0.68rem] font-black text-[#9d2f20] active:scale-[0.98] sm:min-h-8 sm:text-xs"
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
  const [mapTableNumber, setMapTableNumber] = useState<string | null>(null);
  const [editingOrder, setEditingOrder] = useState<VierdaagseOrder | null>(null);
  const [products, setProducts] = useState<VierdaagseProduct[]>(vierdaagseProducts);

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
    setProducts(getStoredVierdaagseProducts());
    void fetchVierdaagseProductsFromWordPress().then((result) => {
      setProducts(result.data);
    });
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

  const availableProducts = useMemo(
    () => getProductsForOrders(products, orders),
    [orders, products]
  );

  const activeOrders = useMemo(
    () =>
      sortActiveKitchenOrders(
        orders.filter(
          (order) =>
            order.status === "nieuw" ||
            order.status === "in_productie" ||
            order.status === "klaar_voor_bediening"
        )
      ),
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
    activeTab === "actief" ? activeOrders : filteredArchive;

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

  function handleSaveEditedOrder(draft: EditOrderDraft) {
    if (!editingOrder) return;

    const table = vierdaagseTables.find(
      (option) => option.label === draft.tableNumber
    );
    const updatedOrder = updateVierdaagseOrderDetails(editingOrder.id, {
      tableNumber: draft.tableNumber,
      location: table ? table.location : "geen_tafel",
      note: draft.note,
      items: draft.items.map(normalizeEditLine),
    });

    refreshOrders();
    setEditingOrder(null);

    if (updatedOrder) {
      setBoardError("");
      setBoardMessage(`Bon ${updatedOrder.tableNumber} is bijgewerkt.`);
    } else {
      setBoardMessage("");
      setBoardError("Bon bijwerken is niet gelukt.");
    }
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

        <nav className="grid grid-cols-2 gap-1 rounded-lg border border-[#e8e4de] bg-white p-1 shadow-sm sm:gap-1.5 sm:p-1.5">
          {[
            { id: "actief" as const, label: "Actieve bonnen", count: activeOrders.length },
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
              {tab.label} {tab.count}
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
                {availableProducts.map((product) => (
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

        <section className="grid gap-1.5 md:grid-cols-3 xl:grid-cols-4">
          {visibleOrders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              now={now}
              archive={activeTab === "archief"}
              isDeleting={deletingOrderId === order.id}
              onRefresh={refreshOrders}
              onDelete={handleDeleteArchivedOrder}
              onShowTableMap={setMapTableNumber}
              onEdit={setEditingOrder}
            />
          ))}
        </section>
      </div>
      {editingOrder && (
        <OrderEditDialog
          order={editingOrder}
          products={availableProducts}
          onClose={() => setEditingOrder(null)}
          onSave={handleSaveEditedOrder}
        />
      )}
      <TableMapDialog
        open={mapTableNumber !== null}
        highlightedTable={mapTableNumber || undefined}
        onClose={() => setMapTableNumber(null)}
      />
    </main>
  );
}
