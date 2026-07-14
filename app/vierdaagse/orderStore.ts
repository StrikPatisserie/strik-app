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
const vierdaagseOrdersApiUrl = "/api/vierdaagse-orders";

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
    (order.location === "terras" ||
      order.location === "binnen" ||
      order.location === "geen_tafel") &&
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

function writeOrdersToStorage(orders: VierdaagseOrder[], notify = true) {
  if (!isBrowser()) return;

  window.localStorage.setItem(
    ordersStorageKey,
    JSON.stringify(sortOrders(orders))
  );
  if (notify) notifyOrderSubscribers();
}

function upsertOrderInStorage(order: VierdaagseOrder, notify = true) {
  const orders = readOrdersFromStorage();
  const exists = orders.some((existingOrder) => existingOrder.id === order.id);
  const nextOrders = exists
    ? orders.map((existingOrder) =>
        existingOrder.id === order.id ? order : existingOrder
      )
    : [order, ...orders];

  writeOrdersToStorage(nextOrders, notify);
}

function removeOrderFromStorage(orderId: string, notify = true) {
  const orders = readOrdersFromStorage();
  writeOrdersToStorage(
    orders.filter((order) => order.id !== orderId),
    notify
  );
}

function updateOrder(
  orderId: string,
  updater: (order: VierdaagseOrder) => VierdaagseOrder
) {
  const orders = readOrdersFromStorage();
  let updatedOrder: VierdaagseOrder | null = null;
  const nextOrders = orders.map((order) => {
    if (order.id !== orderId) return order;

    updatedOrder = updater(order);
    return updatedOrder;
  });
  writeOrdersToStorage(nextOrders);

  return updatedOrder;
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

async function readJson(response: Response) {
  return (await response.json().catch(() => null)) as unknown;
}

function getApiMessage(data: unknown, fallback: string) {
  if (
    data &&
    typeof data === "object" &&
    "message" in data &&
    typeof data.message === "string" &&
    data.message.trim()
  ) {
    return data.message;
  }

  return fallback;
}

async function saveOrderToWordPress(order: VierdaagseOrder) {
  const response = await fetch(vierdaagseOrdersApiUrl, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ order }),
  });
  const data = await readJson(response);

  if (response.ok && isVierdaagseOrder(data)) {
    upsertOrderInStorage(data, false);
    return { ok: true as const, data };
  }

  return {
    ok: false as const,
    status: response.status,
    message: getApiMessage(data, "WordPress Vierdaagse-opslag is tijdelijk niet bereikbaar."),
  };
}

async function deleteOrderFromWordPress(orderId: string) {
  const response = await fetch(
    `${vierdaagseOrdersApiUrl}?id=${encodeURIComponent(orderId)}`,
    {
      method: "DELETE",
      headers: {
        Accept: "application/json",
      },
    }
  );
  const data = await readJson(response);

  if (response.ok) {
    return { ok: true as const, data };
  }

  return {
    ok: false as const,
    status: response.status,
    message: getApiMessage(
      data,
      "WordPress Vierdaagse-opslag is tijdelijk niet bereikbaar."
    ),
  };
}

export async function fetchVierdaagseOrdersFromWordPress() {
  try {
    const response = await fetch(vierdaagseOrdersApiUrl, {
      cache: "no-store",
      headers: {
        Accept: "application/json",
      },
    });
    const data = await readJson(response);

    if (response.ok && Array.isArray(data)) {
      const orders = sortOrders(data.filter(isVierdaagseOrder));
      writeOrdersToStorage(orders);

      return { ok: true as const, data: orders };
    }

    return {
      ok: false as const,
      data: readOrdersFromStorage(),
      status: response.status,
      message: getApiMessage(data, "WordPress Vierdaagse-opslag is tijdelijk niet bereikbaar."),
    };
  } catch {
    return {
      ok: false as const,
      data: readOrdersFromStorage(),
      message: "Kan geen verbinding maken met WordPress Vierdaagse-opslag.",
    };
  }
}

export async function createOrder(draft: VierdaagseOrderDraft) {
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

  upsertOrderInStorage(order);
  await saveOrderToWordPress(order);

  return order;
}

export function updateOrderItemStatus(
  orderId: string,
  itemId: string,
  status: VierdaagseOrderItemStatus
) {
  const updatedOrder = updateOrder(orderId, (order) => {
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

  if (updatedOrder) void saveOrderToWordPress(updatedOrder);
}

export function markOrderReady(orderId: string) {
  const now = new Date().toISOString();

  const updatedOrder = updateOrder(orderId, (order) => ({
    ...order,
    status: "klaar_voor_bediening",
    readyAt: order.readyAt || now,
  }));

  if (updatedOrder) void saveOrderToWordPress(updatedOrder);
}

export function markOrderDelivered(orderId: string) {
  const now = new Date().toISOString();

  const updatedOrder = updateOrder(orderId, (order) => ({
    ...order,
    status: "geleverd",
    deliveredAt: now,
    readyAt: order.readyAt || now,
  }));

  if (updatedOrder) void saveOrderToWordPress(updatedOrder);
}

export function cancelOrder(orderId: string) {
  const now = new Date().toISOString();

  const updatedOrder = updateOrder(orderId, (order) => ({
    ...order,
    status: "geannuleerd",
    cancelledAt: now,
  }));

  if (updatedOrder) void saveOrderToWordPress(updatedOrder);
}

export async function deleteArchivedOrder(orderId: string) {
  removeOrderFromStorage(orderId);

  try {
    return await deleteOrderFromWordPress(orderId);
  } catch {
    return {
      ok: false as const,
      message: "Kan geen verbinding maken met WordPress Vierdaagse-opslag.",
    };
  }
}

export function loadDemoOrders() {
  const currentOrders = readOrdersFromStorage();
  const demoOrders = createDemoOrders();
  writeOrdersToStorage([...demoOrders, ...currentOrders]);
  demoOrders.forEach((order) => {
    void saveOrderToWordPress(order);
  });
}
