import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { hasFullAccess } from "../../../lib/auth/access";
import { getCurrentProfile } from "../../../lib/auth/session";
import { createPriceCardPdf, priceCardPdfFilename } from "../../../lib/priceCardPdf";
import { readPriceCardState, writePriceCardState } from "../../../lib/priceCardStorage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const RECIPIENT = "info@strik-patisserie.nl";
const MAIL_URL = process.env.WORDPRESS_PRICE_CARD_MAIL_URL ||
  "https://strik-patisserie.nl/wp-json/strik/v1/price-card-mail";

function validOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  if (!hasFullAccess(await getCurrentProfile())) {
    return NextResponse.json({ message: "Geen toegang tot prijskaartjes." }, { status: 403 });
  }
  if (!validOrigin(request)) {
    return NextResponse.json({ message: "Ongeldige website." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const sessionId = typeof body?.sessionId === "string" ? body.sessionId.trim().slice(0, 180) : "";
  if (!sessionId) {
    return NextResponse.json({ message: "Printsessie ontbreekt." }, { status: 400 });
  }

  const username = process.env.WORDPRESS_MEDIA_USERNAME || process.env.WORDPRESS_USERNAME || "";
  const password = process.env.WORDPRESS_MEDIA_APPLICATION_PASSWORD || process.env.WORDPRESS_APPLICATION_PASSWORD || "";
  if (!username || !password) {
    return NextResponse.json(
      { message: "De WordPress-mailkoppeling is nog niet ingesteld op de server." },
      { status: 503 }
    );
  }

  try {
    const state = await readPriceCardState();
    const session = state.sessions.find((entry) => entry.id === sessionId);
    if (!session) {
      return NextResponse.json({ message: "Printsessie is niet gevonden." }, { status: 404 });
    }

    const pdf = await createPriceCardPdf(session);
    if (pdf.byteLength > 8_000_000) {
      return NextResponse.json(
        { message: "De PDF is groter dan 8 MB. Maak twee kleinere printsessies." },
        { status: 413 }
      );
    }
    const cardCount = session.items.reduce((sum, item) => sum + item.quantity, 0);
    const response = await fetch(MAIL_URL, {
      method: "POST",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`,
      },
      body: JSON.stringify({
        id: randomUUID(),
        recipient: RECIPIENT,
        sessionName: session.name,
        cardCount,
        filename: priceCardPdfFilename(session),
        pdfBase64: pdf.toString("base64"),
      }),
      signal: AbortSignal.timeout(45_000),
    });
    const responseBody = (await response.json().catch(() => null)) as { message?: string } | null;
    if (!response.ok) {
      const missingSnippet = response.status === 404;
      return NextResponse.json(
        {
          message: missingSnippet
            ? "De eenmalige WordPress-mailsnippet voor prijskaartjes moet nog worden geactiveerd."
            : responseBody?.message || `WordPress-mail gaf status ${response.status}.`,
        },
        { status: missingSnippet ? 503 : 502 }
      );
    }

    const now = new Date().toISOString();
    const latestState = await readPriceCardState();
    await writePriceCardState({
      ...latestState,
      sessions: latestState.sessions.map((entry) =>
        entry.id === sessionId
          ? { ...entry, emailedAt: now, emailedTo: RECIPIENT }
          : entry
      ),
    });

    return NextResponse.json({
      sent: true,
      recipient: RECIPIENT,
      emailedAt: now,
      filename: priceCardPdfFilename(session),
    });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error && error.name === "TimeoutError"
            ? "Het mailen duurde te lang. Controleer de inbox voordat je opnieuw probeert."
            : error instanceof Error
              ? error.message
              : "PDF mailen is mislukt.",
      },
      { status: 502 }
    );
  }
}
