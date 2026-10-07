import { NextResponse } from "next/server";
import { hasFullAccess } from "../../../lib/auth/access";
import { getCurrentProfile } from "../../../lib/auth/session";
import { createPriceCardPdf, priceCardPdfFilename } from "../../../lib/priceCardPdf";
import { readPriceCardState } from "../../../lib/priceCardStorage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  if (!hasFullAccess(await getCurrentProfile())) {
    return NextResponse.json({ message: "Geen toegang tot prijskaartjes." }, { status: 403 });
  }

  const url = new URL(request.url);
  const sessionId = String(url.searchParams.get("session") || "").trim().slice(0, 180);
  if (!sessionId) {
    return NextResponse.json({ message: "Printsessie ontbreekt." }, { status: 400 });
  }

  try {
    const state = await readPriceCardState();
    const session = state.sessions.find((entry) => entry.id === sessionId);
    if (!session) {
      return NextResponse.json({ message: "Printsessie is niet gevonden." }, { status: 404 });
    }
    const pdf = await createPriceCardPdf(session);
    const filename = priceCardPdfFilename(session);
    const disposition = url.searchParams.get("download") === "1" ? "attachment" : "inline";
    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Length": String(pdf.byteLength),
        "Content-Disposition": `${disposition}; filename="${filename}"`,
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "PDF maken is mislukt." },
      { status: 500 }
    );
  }
}
