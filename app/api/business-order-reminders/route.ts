export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return Response.json({ message: "Geen toegang." }, { status: 403 });
  const base = process.env.WORDPRESS_SINTERKLAAS_API_BASE || "https://strik-patisserie.nl/wp-json/strik/v1";
  const url = new URL(`${base}/business-order-reminders`);
  url.searchParams.set("key", process.env.WORDPRESS_SINTERKLAAS_API_KEY || process.env.WORDPRESS_STRIK_API_KEY || "schoonmaak-ijs-strik");
  const dryRun = new URL(request.url).searchParams.get("dryRun") === "1";
  try {
    const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dryRun }), cache: "no-store", signal: AbortSignal.timeout(45000) });
    if (!response.ok) return Response.json({ message: "De B2B-controle kon niet worden uitgevoerd.", wordpressStatus: response.status }, { status: 502 });
    const result = await response.json();
    return Response.json(result, { status: result.failed || result.uncertain ? 502 : 200 });
  } catch {
    return Response.json({ message: "WordPress-mail is tijdelijk niet bereikbaar." }, { status: 502 });
  }
}
