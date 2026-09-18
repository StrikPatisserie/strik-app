export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ message: "Geen toegang." }, { status: 403 });
  }

  const base = process.env.WORDPRESS_SINTERKLAAS_API_BASE || "https://strik-patisserie.nl/wp-json/strik/v1";
  const key = process.env.WORDPRESS_SINTERKLAAS_API_KEY || process.env.WORDPRESS_STRIK_API_KEY || "schoonmaak-ijs-strik";
  const url = new URL(`${base}/sinterklaas-letter-reminders`);
  url.searchParams.set("key", key);

  try {
    const response = await fetch(url, { method: "POST", cache: "no-store", signal: AbortSignal.timeout(30000) });
    if (!response.ok) return Response.json({ message: "Ophaalherinneringen konden niet worden verstuurd.", wordpressStatus: response.status }, { status: 502 });
    return Response.json(await response.json());
  } catch {
    return Response.json({ message: "WordPress-mail is tijdelijk niet bereikbaar." }, { status: 502 });
  }
}
