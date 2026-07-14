"use client";

import {
  VierdaagseOrder,
  VierdaagseOrderDraft,
  VierdaagseOrderItemStatus,
  VierdaagseOrderStatus,
  createDemoOrders,
  createItemId,
  createOrderId,
} from "./vierdaagseData";

const ordersStorageKey = "strik-vierdaagse-orders-v1";
const ordersChangedEvent = "strik-vierdaagse-orders-changed";

function isBrowser() {
  return typeof window !== "undefined";
}

function notifyOrderSubscribers() {
  if (!isBrowser()) return;
  window.dispatchEvent(new Event(ordersChangedEvent));
}

function isOrderStatus(value: unknown): value is VierdaagseOrderStatus {
  return (
    value === "nieuw" ||
    value === "in_productie" ||
    value === "klaar_voor_bediening" ||
    value === "geleverd" ||
    value === "geannuleerd"
  );
}

function isItemStatus(value: unknown): value is VierdaagseOrderItemStatus {
  return value === "niet_gestart" || value === "klaar";
}

function isVierdaagseOrder(value: unknown): value is VierdaagseOrder {
  if (!value || typeof value !== "object") return false;
  const order = value as Partial<VierdaagseOrder>;

  return (
    typeof order.id === "string" &&
    typeof order.createdAt === "string" &&
    typeof order.date === "string" &&
    typeof order.year === "number" &&
    typeof order.tableNumber === "string" &&
    (order.location === "terras" || order.location === "binnen") &&
    typeof order.note === "string" &&
    isOrderStatus(order.status) &&
    Array.isArray(order.items) &&
    order.items.every(
      (item) =>
        item &&
        typeof item === "object" &&
        typeof item.id === "string" &&
        typeof item.productId === "string" &&
        typeof item.name === "string" &&
        typeof item.quantity === "number" &&
        isItemStatus(item.status)
    )
  );
}

function sortOrders(orders: VierdaagseOrder[]) {
  return [...orders].sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

function readOrdersFromStorage() {
  if (!isBrowser()) return [];

  try {
    const raw = window.localStorage.getItem(ordersStorageKey);
    if (!raw) return [];

    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return sortOrders(parsed.filter(isVierdaagseOrder));
  } catch {
    return [];
  }
}

function writeOrdersToStorage(orders: VierdaagseOrder[]) {
  if (!isBrowser()) return;

  window.localStorage.setItem(
    ordersStorageKey,
    JSON.stringify(sortOrders(orders))
  );
  notifyOrderSubscribers();
}

function updateOrder(
  orderId: string,
  updater: (order: VierdaagseOrder) => VierdaagseOrder
) {
  const orders = readOrdersFromStorage();
  const nextOrders = orders.map((order) =>
    order.id === orderId ? updater(order) : order
  );
  writeOrdersToStorage(nextOrders);
}

export function subscribeVierdaagseOrders(callback: () => void) {
  if (!isBrowser()) return () => {};

  const handleStorage = (event: StorageEvent) => {
    if (event.key === ordersStorageKey) callback();
  };

  window.addEventListener(ordersChangedEvent, callback);
  window.addEventListener("storage", handleStorage);

  return () => {
    window.removeEventListener(ordersChangedEvent, callback);
    window.removeEventListener("storage", handleStorage);
  };
}

export function getAllOrders() {
  return readOrdersFromStorage();
}

export function getActiveOrders() {
  return readOrdersFromStorage().filter(
    (order) => order.status === "nieuw" || order.status === "in_productie"
  );
}

export function getArchivedOrders() {
  return readOrdersFromStorage().filter(
    (order) => order.status === "geleverd" || order.status === "geannuleerd"
  );
}

export function createOrder(draft: VierdaagseOrderDraft) {
  const now = new Date();
  const order: VierdaagseOrder = {
    id: createOrderId(now),
    date: now.toISOString().slice(0, 10),
    year: now.getFullYear(),
    createdAt: now.toISOString(),
    tableNumber: draft.tableNumber,
    location: draft.location,
    note: draft.note.trim(),
    status: "nieuw",
    createdBy: draft.createdBy,
    items: draft.items.map((item) => ({
      ...item,
      id: createItemId(item.productId, item.detail),
      status: "niet_gestart",
    })),
  };

  writeOrdersToStorage([order, ...readOrdersFromStorage()]);
  return order;
}

export function updateOrderItemStatus(
  orderId: string,
  itemId: string,
  status: VierdaagseOrderItemStatus
) {
  updateOrder(orderId, (order) => {
    const nextItems = order.items.map((item) =>
      item.id === itemId ? { ...item, status } : item
    );
    const hasStarted = nextItems.some((item) => item.status === "klaar");

    return {
      ...order,
      status:
        order.status === "nieuw" && hasStarted ? "in_productie" : order.status,
      items: nextItems,
    };
  });
}

export function markOrderReady(orderId: string) {
  const now = new Date().toISOString();

  updateOrder(orderId, (order) => ({
    ...order,
    status: "klaar_voor_bediening",
    readyAt: order.readyAt || now,
  }));
}

export function markOrderDelivered(orderId: string) {
  const now = new Date().toISOString();

  updateOrder(orderId, (order) => ({
    ...order,
    status: "geleverd",
    deliveredAt: now,
    readyAt: order.readyAt || now,
  }));
}

export function cancelOrder(orderId: string) {
  const now = new Date().toISOString();

  updateOrder(orderId, (order) => ({
    ...order,
    status: "geannuleerd",
    cancelledAt: now,
  }));
}

export function loadDemoOrders() {
  const currentOrders = readOrdersFromStorage();
  const demoOrders = createDemoOrders();
  writeOrdersToStorage([...demoOrders, ...currentOrders]);
}
