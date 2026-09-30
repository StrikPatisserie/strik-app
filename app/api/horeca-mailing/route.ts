import { NextResponse } from "next/server";
import { hasFullAccess } from "@/app/lib/auth/access";
import { getCurrentProfile } from "@/app/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WORDPRESS_URL = process.env.WORDPRESS_HORECA_MAILING_URL ||
  "https://strik-patisserie.nl/wp-json/strik/v1/horeca-mailing";
const MAX_BODY_BYTES = 4_300_000;

function jsonError(message: string, status = 400) {
  return NextResponse.json({ message }, { status });
}

function validOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}

async function canUseMailing() {
  return hasFullAccess(await getCurrentProfile());
}

function wordpressCredentials() {
  const username = process.env.WORDPRESS_MEDIA_USERNAME || process.env.WORDPRESS_USERNAME || "";
  const password = process.env.WORDPRESS_MEDIA_APPLICATION_PASSWORD || process.env.WORDPRESS_APPLICATION_PASSWORD || "";
  return { username, password };
}

async function wordpressRequest(method: "GET" | "POST" | "PATCH", body = "") {
  const { username, password } = wordpressCredentials();
  if (!username || !password) {
    return jsonError("WordPress-mail is nog niet ingesteld op de server.", 503);
  }

  try {
    const response = await fetch(WORDPRESS_URL, {
      method,
      cache: "no-store",
      headers: {
        Accept: "application/json",
        Authorization: `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body } : {}),
      signal: AbortSignal.timeout(25_000),
    });
    const text = await response.text();
    let data: unknown = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text ? { message: text.slice(0, 300) } : null;
    }

    if (!response.ok) {
      const remoteMessage = data && typeof data === "object" && "message" in data && typeof data.message === "string"
        ? data.message
        : "";
      if (response.status === 404) {
        return jsonError("De WordPress-snippet voor de horecamailing moet nog één keer worden geactiveerd.", 503);
      }
      return jsonError(remoteMessage || `WordPress-mail gaf status ${response.status}.`, response.status >= 500 ? 502 : response.status);
    }

    return NextResponse.json(data || { ok: true });
  } catch {
    return jsonError("Kan geen verbinding maken met de WordPress-mailservice.", 502);
  }
}

async function readBody(request: Request) {
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > MAX_BODY_BYTES) throw new Error("De gekozen foto is te groot om op te slaan.");
  const body = await request.text();
  if (Buffer.byteLength(body, "utf8") > MAX_BODY_BYTES) throw new Error("De gekozen foto is te groot om op te slaan.");
  return body;
}

export async function GET() {
  if (!(await canUseMailing())) return jsonError("Geen toegang tot de horecamailing.", 403);
  return wordpressRequest("GET");
}

export async function POST(request: Request) {
  if (!(await canUseMailing())) return jsonError("Geen toegang tot de horecamailing.", 403);
  if (!validOrigin(request)) return jsonError("Ongeldige website.", 403);
  try {
    return wordpressRequest("POST", await readBody(request));
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Mailing kon niet worden gelezen.");
  }
}

export async function PATCH(request: Request) {
  if (!(await canUseMailing())) return jsonError("Geen toegang tot de horecamailing.", 403);
  if (!validOrigin(request)) return jsonError("Ongeldige website.", 403);
  try {
    return wordpressRequest("PATCH", await readBody(request));
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Verzendopdracht kon niet worden gelezen.");
  }
}
