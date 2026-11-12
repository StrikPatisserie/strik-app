import { readLocalBusinessDeliveries } from "@/app/preview/logistiek/businessDeliveriesSource.server";
import { getCurrentProfile } from "@/app/lib/auth/session";
import { canAccessPath } from "@/app/lib/auth/access";
import { businessDeliveriesForWeek, validBusinessDate } from "@/app/lib/businessOrderDeliveries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile) {
    const preview = await readLocalBusinessDeliveries(request);
    if (preview) return Response.json(preview, { headers: { "Cache-Control": "no-store" } });
  }
  if (!profile?.active || !canAccessPath(profile, "/bakkerij/logistiek/dagstart")) {
    return Response.json({ message: "Geen toegang tot logistiek." }, { status: 403 });
  }
  const params = new URL(request.url).searchParams;
  const date = params.get("date") || "";
  const planning = params.get("planning") === "1";
  if (!validBusinessDate(date)) return Response.json({ message: "Geen geldige leverdatum." }, { status: 400 });
  const base = process.env.WORDPRESS_SINTERKLAAS_API_BASE || "https://strik-patisserie.nl/wp-json/strik/v1";
  const url = new URL(`${base}/sinterklaas-b2b-orders`);
  url.searchParams.set("key", process.env.WORDPRESS_SINTERKLAAS_API_KEY || process.env.WORDPRESS_STRIK_API_KEY || "schoonmaak-ijs-strik");
  try {
    const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(20000) });
    if (!response.ok) throw new Error("B2B-opslag niet bereikbaar.");
    const data = await response.json();
    if (!Array.isArray(data.orders)) throw new Error("Geen geldige B2B-reactie.");
    return Response.json({ ...businessDeliveriesForWeek(data.orders, date, { includeUpcoming: planning, includePickup: planning }), selectedDate: date,
      canManage: { sint: canAccessPath(profile, "/sinterklaas/b2b"), kerst: canAccessPath(profile, "/kerst/b2b") } }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ message: "B2B-bezorgingen konden niet worden gecontroleerd. Controleer de B2B-lijst of probeer opnieuw." }, { status: 502 });
  }
}
