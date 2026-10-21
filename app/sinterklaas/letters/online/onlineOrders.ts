export type OnlineOrderItem = {
  quantity: number;
  logo: boolean;
  logo_storage_path: string | null;
  unit_price_cents: number | null;
  logo_price_cents: number;
  letter_products: { letter: string; flavour: string; size: string; style: string } | { letter: string; flavour: string; size: string; style: string }[] | null;
};

export type OnlineLetterOrder = {
  id: string;
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
