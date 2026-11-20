import { businessDeliveryRate, businessPostcode } from "../../lib/businessDeliveryPricing";

export const LETTER_DELIVERY_MINIMUM_CENTS = 5000;
export const LETTER_DELIVERY_WINDOW = "10:00–14:00";

export type StoreLetterDelivery = {
  address: string;
  postcode: string;
  city: string;
  feeCents: number;
};

export function storeLetterDeliveryFee(postcode: string): number | null {
  const rate = businessDeliveryRate(postcode);
  return rate ? Math.round(rate.amountIncl * 100) : null;
}

export function storeLetterDeliveryError(delivery: StoreLetterDelivery, subtotalCents: number): string {
  if (subtotalCents < LETTER_DELIVERY_MINIMUM_CENTS) return "Bezorgen kan vanaf € 50,00 bestelwaarde, exclusief bezorgkosten.";
  if (delivery.address.trim().length < 4 || !/\d/.test(delivery.address)) return "Vul de straat en het huisnummer voor bezorging in.";
  if (!/^[1-9]\d{3} [A-Z]{2}$/.test(businessPostcode(delivery.postcode))) return "Vul de volledige bezorgpostcode in, bijvoorbeeld 6511 AB.";
  if (delivery.city.trim().length < 2) return "Vul de plaats voor bezorging in.";
  return "";
}

export function storeLetterDeliveryAddress(delivery: StoreLetterDelivery): string {
  return `${delivery.address}, ${delivery.postcode} ${delivery.city}`;
}

export function normalizeStoreLetterDelivery(value: unknown): StoreLetterDelivery | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  const text = (key: string) => typeof input[key] === "string" ? input[key].trim() : "";
  return { address: text("address"), postcode: businessPostcode(text("postcode")), city: text("city"), feeCents: Number.isInteger(input.feeCents) && Number(input.feeCents) >= 0 ? Number(input.feeCents) : 0 };
}
