import { type OnlineLetterOrder, type OnlineOrderItem } from "../onlineOrders";

export type LogoReceipt = {
  item_id: string;
  order_revision: number;
  quantity: number;
  logo_storage_path: string;
  printed_at: string;
};
export type LogoPrintOrder = OnlineLetterOrder & { receipts: LogoReceipt[] };
export type LogoPrintSnapshot = {
  item_id: string;
  order_id: string;
  product_id: string;
  revision: number;
  quantity: number;
  logo_storage_path: string;
};
export function logoItems(order: OnlineLetterOrder) {
  return order.letter_order_items.filter(item => item.logo && item.quantity > 0);
}
export function logoItemPrinted(order: OnlineLetterOrder, item: OnlineOrderItem, receipts: LogoReceipt[]) {
  return receipts.some(receipt => receipt.item_id === item.id && receipt.order_revision === order.revision
    && receipt.quantity === item.quantity && receipt.logo_storage_path === item.logo_storage_path);
}
export function orderLogosPrinted(order: OnlineLetterOrder, receipts: LogoReceipt[]) {
  const items = logoItems(order);
  return items.length > 0 && items.every(item => logoItemPrinted(order, item, receipts));
}
export function pendingLogoItems(order: LogoPrintOrder, reprint = false) {
  return logoItems(order).filter(item => reprint || !logoItemPrinted(order, item, order.receipts));
}
export function logoOrderSummary(order: OnlineLetterOrder) {
  const labels = order.letter_order_items.filter(item => item.quantity > 0).map(item => {
    const product = Array.isArray(item.letter_products) ? item.letter_products[0] : item.letter_products;
    return `${item.quantity}× ${product?.letter || "?"} ${product?.flavour || ""} ${product?.size || ""}`.trim();
  });
  return `${order.order_number} · ${labels.join(" / ")}`;
}
