import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import {
  requireSupabasePublicConfig,
  requireSupabaseServiceRoleKey,
} from "@/app/lib/supabase/config";
import { lettershopMailIsConfigured, sendLettershopOrderMails } from "@/app/lettershop/sendOrderMail";

export const runtime = "nodejs";

const BUCKET = "lettershop-logos";
const MAX_PHOTO_BYTES = 3_000_000;
const SHOPS = new Set(["ziekerstraat", "heyendaal", "daalseweg", "lent"]);
const FLAVOURS = new Set(["melk", "puur", "wit"]);
const SIZES = new Set(["groot", "klein"]);
const MIME_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp",
  "image/heic": "heic", "image/heif": "heif",
};

type CheckoutLine = {
  letter: string;
  flavour: string;
  size: string;
  quantity: number;
  withLogo: boolean;
};
type CheckoutPayload = {
  requestKey: string;
  customerName: string;
  customerEmail: string;
  phone: string;
  pickupDate: string;
  pickupLocation: string;
  notes?: string;
  lines: CheckoutLine[];
};

function error(message: string, status = 400) {
  return Response.json({ message }, { status });
}

function isCheckoutPayload(value: unknown): value is CheckoutPayload {
  if (!value || typeof value !== "object") return false;
  const data = value as Record<string, unknown>;
  const lines = data.lines;
  return typeof data.requestKey === "string" && /^[0-9a-f-]{36}$/i.test(data.requestKey)
    && typeof data.customerName === "string" && data.customerName.trim().length >= 2 && data.customerName.length <= 160
    && typeof data.customerEmail === "string" && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(data.customerEmail) && data.customerEmail.length <= 254
    && typeof data.phone === "string" && data.phone.trim().length >= 6 && data.phone.length <= 50
    && typeof data.pickupDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(data.pickupDate)
    && typeof data.pickupLocation === "string" && SHOPS.has(data.pickupLocation)
    && (data.notes === undefined || typeof data.notes === "string" && data.notes.length <= 1800)
    && Array.isArray(lines) && lines.length >= 1 && lines.length <= 30
    && lines.every((line) => line && typeof line === "object"
      && typeof line.letter === "string" && /^[A-Z]$/.test(line.letter)
      && typeof line.flavour === "string" && FLAVOURS.has(line.flavour)
      && typeof line.size === "string" && SIZES.has(line.size)
      && Number.isInteger(line.quantity) && line.quantity >= 1 && line.quantity <= 999
      && typeof line.withLogo === "boolean");
}

export async function POST(request: Request) {
  if (process.env.LETTERSHOP_CHECKOUT_ENABLED !== "true") {
    return error("Bestellen is nog niet actief.", 503);
  }
  if (!lettershopMailIsConfigured()) return error("Bestellen is tijdelijk niet beschikbaar.", 503);
  if (!process.env.LETTERSHOP_RATE_SALT) return error("Bestellen is tijdelijk niet beschikbaar.", 503);
  if (!request.headers.get("content-type")?.includes("multipart/form-data")) {
    return error("Ongeldige bestelling.");
  }
  const origin = request.headers.get("origin");
  if (origin) {
    try {
      if (new URL(origin).host !== new URL(request.url).host) return error("Bestelling vanaf een onbekende website.", 403);
    } catch { return error("Ongeldige website.", 403); }
  }

  let form: FormData;
  try { form = await request.formData(); } catch { return error("Bestelling kon niet worden gelezen."); }
  if (form.get("website")) return error("Bestelling kon niet worden verwerkt.");
  let payload: unknown;
  try { payload = JSON.parse(String(form.get("order") || "")); } catch { return error("Ongeldige bestelgegevens."); }
  if (!isCheckoutPayload(payload)) return error("Controleer je gegevens en probeer opnieuw.");
  if (payload.lines.reduce((sum, line) => sum + line.quantity, 0) > 999) {
    return error("Neem voor meer dan 999 letters contact op met Strik.");
  }
  const requestedDate = new Date(`${payload.pickupDate}T12:00:00Z`);
  if (Number.isNaN(requestedDate.getTime()) || requestedDate.toISOString().slice(0, 10) !== payload.pickupDate) {
    return error("Kies een geldige afhaaldatum.");
  }

  try {
    const { url } = requireSupabasePublicConfig();
    const supabase = createClient(url, requireSupabaseServiceRoleKey(), {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: existing } = await supabase.from("letter_orders")
      .select("id,order_number").eq("request_key", payload.requestKey).maybeSingle();
    if (existing) {
      try { await sendLettershopOrderMails(existing.id); } catch { /* Order stays safely stored. */ }
      return Response.json({ orderNumber: existing.order_number });
    }

    const clientIp = request.headers.get("x-real-ip") || request.headers.get("x-forwarded-for")?.split(",")[0] || "unknown";
    const clientHash = createHash("sha256").update(`${process.env.LETTERSHOP_RATE_SALT}:${clientIp}`).digest("hex");
    const { data: allowed, error: limitError } = await supabase.rpc("lettershop_consume_rate_limit", { p_client_hash: clientHash });
    if (limitError) return error("Bestellen is tijdelijk niet beschikbaar.", 503);
    if (!allowed) return error("Je hebt te veel bestellingen geprobeerd. Probeer het over een uur opnieuw.", 429);

    const photoBytes = payload.lines.reduce((sum, line, index) => {
      const file = form.get(`logo_${index}`);
      return sum + (line.withLogo && file instanceof File ? file.size : 0);
    }, 0);
    if (photoBytes > 5_000_000) return error("De foto's zijn samen groter dan 5 MB. Kies kleinere bestanden.");

    const lines = [];
    for (const [index, line] of payload.lines.entries()) {
      const code = `SPUIT-${line.flavour.toUpperCase()}-${line.size.toUpperCase()}-${line.letter}`;
      const { data: product, error: productError } = await supabase.from("letter_products")
        .select("id").eq("code", code).eq("active", true).single();
      if (productError || !product) return error("Een gekozen letter is niet beschikbaar.");

      let logoPath: string | null = null;
      const file = form.get(`logo_${index}`);
      if (line.withLogo) {
        if (!(file instanceof File)) return error(`Voeg een foto/logo toe aan letter ${line.letter}.`);
        const extension = MIME_EXTENSIONS[file.type];
        if (!extension || file.size < 1 || file.size > MAX_PHOTO_BYTES) {
          return error("Kies een JPG, PNG, WEBP of HEIC van maximaal 3 MB.");
        }
        logoPath = `${payload.requestKey}/${index}.${extension}`;
        const { error: uploadError } = await supabase.storage.from(BUCKET)
          .upload(logoPath, file, { contentType: file.type, upsert: true });
        if (uploadError) return error("Foto uploaden is niet gelukt. Probeer het opnieuw.", 502);
      } else if (file instanceof File) {
        return error("Afbeelding zonder foto/logo-keuze.");
      }
      lines.push({ product_id: product.id, quantity: line.quantity, logo: line.withLogo, logo_path: logoPath });
    }

    const { data: orderId, error: orderError } = await supabase.rpc("letter_create_online_checkout", {
      p_request_key: payload.requestKey,
      p_customer_name: payload.customerName.trim(),
      p_customer_email: payload.customerEmail.trim().toLowerCase(),
      p_phone: payload.phone.trim(),
      p_requested_date: payload.pickupDate,
      p_pickup_location: payload.pickupLocation,
      p_lines: lines,
      p_notes: payload.notes || "",
    });
    if (orderError || !orderId) {
      return error("Bestelling opslaan is niet gelukt. Probeer het opnieuw.", 502);
    }
    const { data: order } = await supabase.from("letter_orders")
      .select("order_number").eq("id", orderId).single();
    try { await sendLettershopOrderMails(orderId); } catch { /* Order is safely stored; outbox can be retried. */ }
    return Response.json({ orderNumber: order?.order_number || orderId });
  } catch {
    return error("Bestellen is tijdelijk niet beschikbaar.", 503);
  }
}
