import { revenueShops, type RevenueShop } from "../../revenueData";

export type CashCountView = {
  date: string;
  shop: RevenueShop;
  kind: "patisserie" | "ice";
};

function validDate(value: string | null): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function readCashCountView(params: URLSearchParams, today: string): CashCountView {
  const date = params.get("date"), shop = params.get("shop");
  return {
    date: validDate(date) ? date : today,
    shop: revenueShops.includes(shop as RevenueShop) ? shop as RevenueShop : revenueShops[0],
    kind: params.get("kind") === "ice" ? "ice" : "patisserie",
  };
}

// Replace the current URL without navigating, adding history entries or
// changing any cash data. Preserve unrelated query parameters and the hash.
export function cashCountViewHref(href: string, view: CashCountView) {
  const url = new URL(href, "https://app.strik-patisserie.nl");
  url.searchParams.set("date", view.date);
  url.searchParams.set("shop", view.shop);
  url.searchParams.set("kind", view.kind);
  return `${url.pathname}${url.search}${url.hash}`;
}
