import {getActiveSeason} from "@/app/feestdagen/server";
import { NextResponse } from "next/server";
import { buildBusinessFolderQuote } from "@/app/lib/businessFolderQuote";
import { assertBusinessFolderDelivery } from "@/app/lib/businessFolderDelivery";

import { FolderUploadTooLarge, readBusinessFolderRequest, type FolderLogoUpload } from "@/app/lib/businessFolderUpload";

export const maxDuration = 60;
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return NextResponse.json({ message: "Ongeldige aanvraag." }, { status: 403 });
  let quote: ReturnType<typeof buildBusinessFolderQuote>;
  let logo: FolderLogoUpload | undefined;
  try {
    const parsed = await readBusinessFolderRequest(request);
    if (!parsed.input || typeof parsed.input !== "object" || Array.isArray(parsed.input)) throw Error("Controleer de aanvraaggegevens.");
    const input = parsed.input as Record<string, unknown>;
    logo = parsed.logo;
    if (input?.website) return NextResponse.json({ message: "Je aanvraag is nog niet verstuurd. Vernieuw de pagina en vul de aanvraag opnieuw in zonder automatisch ingevulde velden." }, { status: 400 });
    if(input.season!=="sint"&&input.season!=="kerst")throw Error("Kies een geldige folder.");
    const edition=await getActiveSeason(input.season);
    if(!edition?.config.business)throw Error("Dit seizoen is momenteel gesloten voor aanvragen.");
    quote = buildBusinessFolderQuote(input,edition.year,logo);
    assertBusinessFolderDelivery(quote.order.deliveryDate);
    if(quote.order.deliveryDate&&(quote.order.deliveryDate<edition.config.startDate||quote.order.deliveryDate>edition.config.endDate))throw Error("Kies een levermoment binnen het geopende seizoen.");
  } catch (error) {
    return NextResponse.json({ message: error instanceof SyntaxError ? "De aanvraag kon niet worden gelezen." : error instanceof Error ? error.message : "Controleer de aanvraaggegevens." }, { status: error instanceof FolderUploadTooLarge ? 413 : 400 });
  }
  try {
    const url = new URL(`${process.env.WORDPRESS_SINTERKLAAS_API_BASE || "https://strik-patisserie.nl/wp-json/strik/v1"}/business-folder-quote`);
    url.searchParams.set("key", process.env.WORDPRESS_SINTERKLAAS_API_KEY || process.env.WORDPRESS_STRIK_API_KEY || "schoonmaak-ijs-strik");
    const response = await fetch(url, { method: "POST", cache: "no-store", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(quote), signal: AbortSignal.timeout(25_000) });
    const result = await response.json();
    // Log only the reference and outcome, never contact details, content or the backend URL/key.
    const outcome = { reference: quote.reference, backendStatus: response.status, saved: result.saved === true, mailSent: result.mailSent === true };
    if (response.ok && result.saved === true && result.reference === quote.reference && logo) {
      try {
        const { saveBusinessFolderLogo } = await import("@/app/lib/businessFolderLogo.server");
        await saveBusinessFolderLogo(quote.order, logo);
      } catch {
        console.warn("business_quote_logo_pending", outcome);
        return NextResponse.json({ saved: true, reference: quote.reference, message: "Je aanvraag is opgeslagen, maar je logo nog niet. Klik op ‘Opnieuw proberen’ met hetzelfde bestand; je aanvraag wordt niet dubbel opgeslagen." }, { status: 503 });
      }
    }
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
