export type OnlineOrderItem = {
  id: string;
  quantity: number;
  logo: boolean;
  logo_storage_path: string | null;
  unit_price_cents: number | null;
  logo_price_cents: number;
  letter_products: { letter: string; flavour: string; size: string; style: string } | { letter: string; flavour: string; size: string; style: string }[] | null;
};

export type OnlineLetterOrder = {
  id: string;
  revision: number;
  edit_block_reason?: string | null;
  order_number: string;
  customer_name: string;
  customer_email: string;
  phone: string;
  notes: string;
  requested_date: string;
  pickup_location: string;
  gift_wrap: boolean;
  gift_wrap_price_cents: number;
  fulfillment_status: string;
  created_at: string;
  letter_order_items: OnlineOrderItem[];
};

export type OnlineQuantityChange = { itemId: string; quantity: number };

export function onlineQuantityChanges(order: OnlineLetterOrder, values: Record<string, string>): OnlineQuantityChange[] {
  const lines = order.letter_order_items.map(item => ({ itemId: item.id, quantity: Number(values[item.id]) }));
  if (lines.some(line => values[line.itemId]?.trim() === "" || !Number.isInteger(line.quantity) || line.quantity < 0 || line.quantity > 100000)) {
    throw new Error("Vul per letter een heel aantal van 0 t/m 100.000 in.");
  }
  if (!lines.some(line => line.quantity > 0)) throw new Error("Er moet minimaal één letter overblijven.");
  if (!lines.some((line, index) => line.quantity !== order.letter_order_items[index].quantity)) throw new Error("Pas eerst een aantal aan.");
  return lines;
}

export function onlineChangedTotal(order: OnlineLetterOrder, lines: OnlineQuantityChange[]) {
  return onlineOrderTotal({ ...order, letter_order_items: order.letter_order_items.map(item => ({
    ...item, quantity: lines.find(line => line.itemId === item.id)?.quantity ?? item.quantity,
  })) });
}

export const onlineOrderStatuses: Record<string, string> = { NEW: "Besteld", READY: "Klaar", COMPLETED: "Opgehaald", CANCELLED: "Geannuleerd" };

export function onlineOrderTotal(order: OnlineLetterOrder) {
  return order.letter_order_items.reduce((sum, item) => sum + item.quantity * ((item.unit_price_cents || 0) + item.logo_price_cents + (order.gift_wrap ? order.gift_wrap_price_cents : 0)), 0);
}

export function onlineItemLabel(item: OnlineOrderItem) {
  const product = Array.isArray(item.letter_products) ? item.letter_products[0] : item.letter_products;
  return `${item.quantity} × ${product?.style === "vorm" ? "vormletter" : "spuitletter"} ${product?.letter || "?"} · ${product?.flavour || "onbekend"} · ${product?.size || "onbekend"}${item.logo ? " · foto/logo" : ""}`;
}

export function filterOnlineOrders(orders: OnlineLetterOrder[], search: string, status: string) {
  const term = search.trim().toLocaleLowerCase("nl-NL");
  return orders.filter((order) => (!status || order.fulfillment_status === status) && (!term || [order.order_number, order.customer_name, order.customer_email, order.phone, order.requested_date, order.pickup_location, order.notes, ...order.letter_order_items.map(onlineItemLabel)].join(" ").toLocaleLowerCase("nl-NL").includes(term)))
    .sort((a, b) => (a.requested_date || "9999").localeCompare(b.requested_date || "9999") || a.customer_name.localeCompare(b.customer_name, "nl"));
}
