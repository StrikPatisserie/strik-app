import { businessSeasons, type BusinessSeason } from "./businessSeasons";

type RawOrder = Record<string, unknown>;
export type BusinessDelivery = {
  id: string;
  season: BusinessSeason | "sint-kerst";
  company: string;
  start: string;
  end: string;
  windowType: string;
  status: "aanvraag" | "offerte" | "akkoord";
  entered: boolean;
  deliveryMethod: string;
  address: string;
  contact: string;
  phone: string;
  summary: string;
  packaging: string;
  deliveryUnclear: boolean;
  overdue: boolean;
  onSelectedDay: boolean;
  managementHref: string;
};
const text = (value: unknown) => typeof value === "string" ? value : "";
const flag = (value: unknown) => value === true || value === 1 || value === "1";
export function validBusinessDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T12:00:00Z`)) && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value;
}
function addDays(value: string, days: number) {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
export function businessWeek(date: string) {
  if (!validBusinessDate(date)) throw new Error("Geen geldige leverdatum.");
  const day = new Date(`${date}T12:00:00Z`).getUTCDay() || 7;
  const start = addDays(date, 1 - day);
  return { start, end: addDays(start, 6) };
}
export function businessDeliveryWindow(order: RawOrder) {
  let type = text(order.deliveryWindowType) || "date";
  let start = text(order.deliveryDate), end = text(order.deliveryDateEnd), week = text(order.deliveryWeek);
  const marker = text(order.sourceSheet).match(/__STRIK_LEVERPERIODE__(range|week)\|([^|]*)\|([^|]*)$/);
  if (marker) { type = marker[1]; end = marker[2]; week = marker[3]; }
  const match = week.match(/^(\d{4})-W(\d{2})$/);
  if (type === "week" && match) {
    const jan4 = `${match[1]}-01-04`;
    const monday = businessWeek(jan4).start;
    const weekNumber = Number(match[2]);
    if (weekNumber < 1 || weekNumber > 53) return null;
    start = addDays(monday, (weekNumber - 1) * 7);
    // ISO week 53 only exists if its Thursday is still in the requested year.
    if (addDays(start, 3).slice(0, 4) !== match[1]) return null;
    end = addDays(start, 6);
  }
  if (!validBusinessDate(start)) return null;
  return { start, end: type !== "date" && validBusinessDate(end) && end >= start ? end : start, type };
}
function deliverySummary(order: RawOrder) {
  let description = text(order.orderText).replace(/\r\n?/g, "\n");
  const folder = description.match(/(?:GEKOZEN SINTERKLAASPRODUCTEN|LOSSE KERSTCADEAUS|KERSTPAKKET OP MAAT)\s+([\s\S]*?)(?:PRIJSINDICATIE|GEWENSTE LEVERING|WENSEN|$)/i);
  if (folder) description = folder[1];
  description = description.replace(/^PRODUCTEN EN PRIJS\n/, "").split("OVERIGE ORDERAFSPRAKEN")[0];
  const products = description.split("\n").map(line => line.replace(/\s*·?\s*€.*$/, "").trim()).filter(Boolean).join(" · ");
  return products.slice(0, 350) || (Array.isArray(order.letterLines) && order.letterLines.length ? `${order.letterLines.reduce((sum, line) => sum + (Number(line.quantity) || 0), 0)} chocoladeletters` : "Bestelling controleren");
}
export function businessDeliveriesForWeek(raw: unknown[], selectedDate: string): { week: { start: string; end: string }; orders: BusinessDelivery[] } {
  const week = businessWeek(selectedDate);
  const orders = raw.flatMap(value => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return [];
    const order = value as RawOrder, id = text(order.id), company = text(order.customerName);
    if (!id || !company || id.startsWith("historie-") || flag(order.cancelled) || flag(order.delivered) || ["afgewezen", "geannuleerd"].includes(text(order.status))) return [];
    const window = businessDeliveryWindow(order);
    if (!window || window.start > week.end) return [];
    const overdue = window.end < week.start;
    // Old annual archives must not reappear as current seasonal deliveries.
    if (overdue && window.end.slice(0, 4) !== selectedDate.slice(0, 4)) return [];
    const method = text(order.deliveryMethod), address = text(order.deliveryAddress);
    const pickup = /afhal|afhaal|ophal|gehaald|haalt|halen/i.test(method);
    const delivery = /bezorg|lever|brengen|deliver|transport/i.test(method);
    if (pickup && !delivery && !address) return [];
    const season = order.season === "kerst" || order.season === "sint-kerst" ? order.season : "sint";
    const status = order.status === "akkoord" || order.status === "offerte" ? order.status : "aanvraag";
    return [{ id, season, company, start: window.start, end: window.end, windowType: window.type, status,
      entered: flag(order.entered), deliveryMethod: method, address, contact: text(order.contactName), phone: text(order.phone),
      summary: deliverySummary(order), packaging: text(order.packaging), deliveryUnclear: !delivery || pickup,
      overdue: window.end < selectedDate, onSelectedDay: window.start <= selectedDate && window.end >= selectedDate,
      managementHref: businessSeasons[season === "kerst" ? "kerst" : "sint"].orders,
    } satisfies BusinessDelivery];
  }).sort((a, b) => Number(b.overdue) - Number(a.overdue) || Number(b.onSelectedDay) - Number(a.onSelectedDay) || a.start.localeCompare(b.start) || a.company.localeCompare(b.company, "nl"));
  return { week, orders };
}
export function possibleBusinessReceipts(order: BusinessDelivery, receipts: { customer: string; receiptNumber: string }[]) {
  if (!order.onSelectedDay) return [];
  const normalize = (value: string) => value.toLocaleLowerCase("nl-NL").replace(/\b(?:b\.?v\.?|n\.?v\.?)\b/g, "").replace(/[^\p{L}\p{N}]/gu, "");
  const company = normalize(order.company);
  // A receipt is only a hint; it must never hide the independent B2B check.
  return company.length >= 5 ? [...new Set(receipts.filter(receipt => normalize(receipt.customer) === company).map(receipt => receipt.receiptNumber).filter(Boolean))] : [];
}
