import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/app/lib/auth/session";
import { hasFullAccess } from "@/app/lib/auth/access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Data = Record<string, unknown>;
function object(value: unknown): Data {
  return value && typeof value === "object" ? value as Data : {};
}
function cents(value: unknown): number | null {
  const money = object(value);
  if (money.currency !== "EUR" || typeof money.value !== "string" || !/^-?\d+\.\d{2}$/.test(money.value)) return null;
  return Math.round(Number(money.value) * 100);
}
const dateFormatter = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Amsterdam", year: "numeric", month: "2-digit", day: "2-digit" });

export async function GET(request: Request) {
  if (!hasFullAccess(await getCurrentProfile())) return NextResponse.json({ message: "Geen toegang." }, { status: 403 });
  const token = process.env.MOLLIE_REPORTING_ACCESS_TOKEN?.trim();
  if (!token) return NextResponse.json({ message: "MOLLIE_REPORTING_ACCESS_TOKEN ontbreekt op deze omgeving." }, { status: 503 });
  const url = new URL(request.url);
  const date = url.searchParams.get("date") || "";
  const expected = url.searchParams.get("amount") || "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d+\.\d{2}$/.test(expected)) return NextResponse.json({ message: "Geef datum YYYY-MM-DD en bedrag met twee decimalen op." }, { status: 400 });
  async function get(path: string): Promise<Data> {
    const target = new URL(path, "https://api.mollie.com/v2/");
    if (target.origin !== "https://api.mollie.com" || !target.pathname.startsWith("/v2/")) throw new Error("Ongeldige Mollie-vervolgpagina.");
    const response = await fetch(target, { headers: { Authorization: `Bearer ${token}`, Accept: "application/hal+json" }, cache: "no-store", signal: AbortSignal.timeout(15000) });
    const data = object(await response.json().catch(() => null));
    if (!response.ok) throw new Error(`Mollie ${response.status}: ${String(data.detail || data.title || "Opvragen mislukt").slice(0, 250)}`);
    return data;
  }
  async function list(path: string, key: string): Promise<Data[]> {
    const entries: Data[] = [];
    let next: string | null = path;
    const seen = new Set<string>();
    while (next) {
      if (seen.has(next) || seen.size >= 40) throw new Error("Mollie-resultaat is te groot of bevat herhaalde pagina’s; overzicht is niet compleet.");
      seen.add(next);
      const page = await get(next);
      const items = object(page._embedded)[key];
      if (!Array.isArray(items)) throw new Error(`Mollie mist de verwachte lijst ${key}.`);
      entries.push(...items.map(object));
      const href = object(object(page._links).next).href;
      next = typeof href === "string" ? href : null;
    }
    return entries;
  }
  try {
    const settlements = await list(`settlements?year=${date.slice(0, 4)}&month=${Number(date.slice(5, 7))}&limit=250`, "settlements");
    const matches = settlements.filter((entry) => typeof entry.settledAt === "string" && dateFormatter.format(new Date(entry.settledAt)) === date && cents(entry.amount) === Math.round(Number(expected) * 100));
    if (!matches.length) return NextResponse.json({ date, amountCents: Math.round(Number(expected) * 100), matches: [], candidates: settlements.map(({ id, reference, settledAt, status, amount }) => ({ id, reference, settledAt, status, amount })) }, { headers: { "Cache-Control": "no-store" } });
    const results = [];
    for (const settlement of matches) {
      const id = String(settlement.id);
      const detail = await get(`settlements/${encodeURIComponent(id)}`);
      const parts = await Promise.allSettled([
        list(`settlements/${id}/payments?limit=250`, "payments"),
        list(`settlements/${id}/refunds?limit=250&embed=payment`, "refunds"),
        list(`settlements/${id}/chargebacks?limit=250`, "chargebacks"),
        list(`settlements/${id}/captures?limit=250`, "captures"),
        list("profiles?limit=250", "profiles"),
      ]);
      const names = ["payments", "refunds", "chargebacks", "captures", "profiles"];
      const collections: Record<string, unknown> = {};
      parts.forEach((part, index) => {
        collections[names[index]] = part.status === "rejected" ? { error: part.reason instanceof Error ? part.reason.message : "Opvragen mislukt" } : part.value.map((entry) => ({ id: entry.id, profileId: entry.profileId || object(object(entry._embedded).payment).profileId, name: index === 4 ? entry.name : undefined, amount: entry.amount, settlementAmount: entry.settlementAmount, paymentId: entry.paymentId, status: entry.status }));
      });
      results.push({ id, reference: detail.reference, settledAt: detail.settledAt, status: detail.status, amount: detail.amount, periods: detail.periods, collections });
    }
    return NextResponse.json({ date, matches: results }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Mollie opvragen mislukt." }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}
