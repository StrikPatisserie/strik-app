export const WEDDING_APP_ORIGIN = "https://app.strik-patisserie.nl";
export const WEDDING_WEBSITE_ORIGIN = "https://strik-patisserie.nl";
export const WEDDING_WEBSITE_PATH = "/bruidstaarten";

// Only these public booking endpoints accept the website origin. Staff APIs
// retain their existing same-origin and authentication checks.
export function weddingPublicOriginAllowed(request: Request) {
  const origin = request.headers.get("origin");
  return origin === new URL(request.url).origin || origin === WEDDING_WEBSITE_ORIGIN;
}

export function weddingPublicJson(request: Request, body: unknown, status = 200) {
  const headers: Record<string, string> = { "Cache-Control": "private, no-store", Vary: "Origin" };
  if (request.headers.get("origin") === WEDDING_WEBSITE_ORIGIN) {
    headers["Access-Control-Allow-Origin"] = WEDDING_WEBSITE_ORIGIN;
  }
  return Response.json(body, { status, headers });
}

export function weddingPublicOptions(request: Request) {
  if (!weddingPublicOriginAllowed(request)) return new Response(null, { status: 403 });
  return new Response(null, { status: 204, headers: {
    "Access-Control-Allow-Origin": request.headers.get("origin")!,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "600",
    Vary: "Origin",
  } });
}
