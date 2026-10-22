import { trackB2BQuoteSubmitted } from "./b2bMetaTracking";

// randomUUID is absent in some older browsers and embedded webviews.
export function createQuoteRequestId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export async function sendBusinessFolderQuote(payload: unknown): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 35_000);
  try {
    const response = await fetch("/api/business-folder-quote", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload), signal: controller.signal,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok !== true || typeof data.reference !== "string" || !/^(SINT|KERST)26-[A-F0-9]{12}$/.test(data.reference)) {
      throw new Error(data.message || "De ontvangst van je aanvraag is nog niet bevestigd. Probeer opnieuw; je ingevulde aanvraag blijft staan.");
    }
    const quote = payload as { season?: unknown; requestId?: unknown } | null;
    if (quote?.season === "sint" && typeof quote.requestId === "string") trackB2BQuoteSubmitted(quote.requestId);
    return data.reference;
  } catch (error) {
    if (controller.signal.aborted || error instanceof TypeError) {
      throw new Error("De verbinding is onderbroken of duurt te lang. Je ingevulde aanvraag blijft staan. Controleer je internetverbinding en probeer opnieuw; dezelfde aanvraag wordt niet dubbel opgeslagen.");
    }
    throw error;
  } finally { clearTimeout(timeout); }
}
