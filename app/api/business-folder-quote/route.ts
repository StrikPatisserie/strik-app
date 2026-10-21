import { NextResponse } from "next/server";
import { buildBusinessFolderQuote } from "@/app/lib/businessFolderQuote";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return NextResponse.json({ message: "Ongeldige aanvraag." }, { status: 403 });
  let quote: ReturnType<typeof buildBusinessFolderQuote>;
  try {
    if (Number(request.headers.get("content-length") || 0) > 64_000) return NextResponse.json({ message: "De aanvraag is te groot." }, { status: 413 });
    const body = await request.text();
    if (Buffer.byteLength(body) > 64_000) return NextResponse.json({ message: "De aanvraag is te groot." }, { status: 413 });
    const input = JSON.parse(body);
    if (input?.website) return NextResponse.json({ message: "Je aanvraag is nog niet verstuurd. Vernieuw de pagina en vul de aanvraag opnieuw in zonder automatisch ingevulde velden." }, { status: 400 });
    quote = buildBusinessFolderQuote(input);
  } catch (error) {
    return NextResponse.json({ message: error instanceof SyntaxError ? "De aanvraag kon niet worden gelezen." : error instanceof Error ? error.message : "Controleer de aanvraaggegevens." }, { status: 400 });
  }
  try {
    const url = new URL(`${process.env.WORDPRESS_SINTERKLAAS_API_BASE || "https://strik-patisserie.nl/wp-json/strik/v1"}/business-folder-quote`);
    url.searchParams.set("key", process.env.WORDPRESS_SINTERKLAAS_API_KEY || process.env.WORDPRESS_STRIK_API_KEY || "schoonmaak-ijs-strik");
    const response = await fetch(url, { method: "POST", cache: "no-store", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(quote), signal: AbortSignal.timeout(25_000) });
    const result = await response.json();
    // Log only the reference and outcome, never contact details, content or the backend URL/key.
    const outcome = { reference: quote.reference, backendStatus: response.status, saved: result.saved === true, mailSent: result.mailSent === true };
    if (response.ok && result.ok === true && result.saved === true && result.mailSent === true && result.reference === quote.reference) {
      console.info("business_quote_received", outcome);
      return NextResponse.json({ ok: true, reference: result.reference });
    }
    console.warn("business_quote_unconfirmed", outcome);
    if (result.saved === true) return NextResponse.json({ saved: true, reference: quote.reference, message: "Je aanvraag is opgeslagen bij Strik. De e-mailmelding is nog niet bevestigd. Klik op ‘Opnieuw proberen’; je aanvraag wordt niet dubbel opgeslagen." }, { status: 503 });
    if (response.status === 409) return NextResponse.json({ message: "De aanvraag wordt al verwerkt of is gewijzigd. Probeer het over enkele seconden opnieuw." }, { status: 409 });
    if (response.status === 429) return NextResponse.json({ message: "Er zijn te veel aanvragen kort na elkaar verstuurd. Probeer later opnieuw of neem contact op via info@strik-patisserie.nl." }, { status: 429 });
    throw new Error("Quote backend unavailable");
  } catch {
    console.warn("business_quote_backend_unavailable", { reference: quote.reference });
    return NextResponse.json({ message: "We konden de ontvangst nog niet bevestigen. Je ingevulde aanvraag blijft staan. Probeer opnieuw; dezelfde aanvraag wordt niet dubbel opgeslagen." }, { status: 502 });
  }
}
