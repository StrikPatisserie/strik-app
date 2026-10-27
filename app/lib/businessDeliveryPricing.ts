// Source: Strik's delivery price list, supplied 27 October 2026. All source
// amounts include 9% VAT. Surcharges without a postcode are deliberately not
// automatic: their conditions have not been agreed.
export const BUSINESS_DELIVERY_RATES = [
  { from: 6511, to: 6514, incl: 9.95 },
  { from: 6516, to: 6542, incl: 9.95 },
  { from: 6601, to: 6605, incl: 14.95 },
  { from: 6561, to: 6562, incl: 16.95 },
  { from: 6641, to: 6642, incl: 11.95 },
  { from: 6573, to: 6573, incl: 11.95 },
  { from: 6571, to: 6572, incl: 11.95 },
  { from: 6581, to: 6581, incl: 6.95 },
  { from: 6582, to: 6582, incl: 10 },
  { from: 6663, to: 6663, incl: 12 },
  { from: 6515, to: 6515, incl: 16.95 },
  { from: 6543, to: 6560, incl: 13.95 },
  { from: 6563, to: 6564, incl: 13.95 },
  { from: 6574, to: 6574, incl: 11.95 },
  { from: 6584, to: 6585, incl: 11.95 },
] as const;

export type BusinessDeliveryPricing = {
  postcode: string;
  mode: "automatic" | "manual" | "unpriced";
  manualIncl: string;
};

const cents = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const money = (value: number) => new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(value);

export function businessPostcode(value: string): string {
  const match = value.trim().toUpperCase().match(/^([1-9]\d{3})(?:\s*([A-Z]{2}))?$/);
  return match ? `${match[1]}${match[2] ? ` ${match[2]}` : ""}` : "";
}

export function businessAddressPostcode(value: string): string {
  const match = value.match(/\b([1-9]\d{3})\s*([A-Za-z]{2})\b/);
  return match ? businessPostcode(`${match[1]} ${match[2]}`) : "";
}

export function isBusinessDelivery(method: string): boolean {
  return /bezorg|lever/i.test(method) && !/afhal|afhaal|ophal|nog af te|nog afstemmen/i.test(method);
}

export function businessDeliveryRate(postcode: string) {
  const normalized = businessPostcode(postcode);
  if (!normalized) return null;
  const prefix = Number(normalized.slice(0, 4));
  const rate = BUSINESS_DELIVERY_RATES.find(rate => prefix >= rate.from && prefix <= rate.to);
  return { postcode: normalized, amountIncl: rate?.incl ?? 10, label: rate ? (rate.from === rate.to ? String(rate.from) : `${rate.from}–${rate.to}`) : "Standaardtarief" };
}

export function businessDeliveryAmount(value: string): number | null {
  if (!/^\d+(?:[.,]\d{1,2})?$/.test(value.trim())) return null;
  const amount = Number(value.trim().replace(",", "."));
  return Number.isFinite(amount) && amount >= 0 && amount <= 10000 ? cents(amount) : null;
}

export function businessDeliveryQuote(pricing: BusinessDeliveryPricing, method: string, address = "") {
  const active = isBusinessDelivery(method);
  const postcode = pricing.postcode.trim() ? businessPostcode(pricing.postcode) : businessAddressPostcode(address);
  const rate = businessDeliveryRate(postcode);
  const amountIncl = !active ? 0 : pricing.mode === "manual" ? businessDeliveryAmount(pricing.manualIncl) : pricing.mode === "automatic" ? rate?.amountIncl ?? null : null;
  return { active, postcode, rate, amountIncl, amountEx: amountIncl === null ? null : cents(amountIncl / 1.09) };
}

// Persist a readable, distinct charge in the existing order text contract. This
// survives the current API, confirmations, backups and exports without a second
// database or a coordinated WordPress schema deployment. Retain the exact
// inclusive amount as well as the rounded exclusive amount to avoid VAT drift.
export function businessDeliveryLine(pricing: BusinessDeliveryPricing, method: string, address = ""): string {
  const quote = businessDeliveryQuote(pricing, method, address);
  if (!quote.active || quote.amountIncl === null || quote.amountEx === null) return "";
  return `1 × Bezorgkosten · postcode ${quote.postcode || "onbekend"} · ${pricing.mode === "manual" ? "handmatig" : "automatisch"} · ${money(quote.amountIncl)} incl. btw · ${money(quote.amountEx)} p.s. ex btw · ${money(quote.amountEx)}`;
}

export function splitBusinessDeliveryPrice(text: string) {
  const lines = text.split("\n");
  const productStart = lines.indexOf("PRODUCTEN EN PRIJS");
  const otherStart = lines.indexOf("OVERIGE ORDERAFSPRAKEN");
  const end = otherStart < 0 ? lines.length : otherStart;
  const matches = lines.flatMap((line, index) => {
    if (index <= productStart || productStart < 0 || index >= end) return [];
    const match = line.match(/^1 × Bezorgkosten · postcode (onbekend|[1-9]\d{3}(?: [A-Z]{2})?) · (automatisch|handmatig) · €\s*([\d.,]+) incl\. btw · €\s*([\d.,]+) p\.s\. ex btw · €\s*([\d.,]+)$/);
    if (!match) return [];
    const parse = (value: string) => businessDeliveryAmount(value.replace(/\./g, "").replace(",", "."));
    const incl = parse(match[3]), ex = parse(match[4]), total = parse(match[5]);
    if (incl === null || ex === null || total !== ex || cents(incl / 1.09) !== ex) return [];
    return [{ index, pricing: { postcode: match[1] === "onbekend" ? "" : match[1], mode: match[2] === "handmatig" ? "manual" as const : "automatic" as const, manualIncl: incl.toFixed(2) }, amountIncl: incl, amountEx: ex }];
  });
  // Unknown or duplicate charge formats remain visible as ordinary order rows;
  // never silently discard original data.
  const charge = matches.length === 1 ? matches[0] : null;
  return { text: charge ? lines.filter((_, index) => index !== charge.index).join("\n") : text, charge };
}
