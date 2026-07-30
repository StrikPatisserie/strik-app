import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import type {
  LogisticsWebshopImage,
  LogisticsWebshopImageConfidence,
} from "@/app/bakkerij/logistiek/logisticsTypes";
import { canAccessLogisticsRequest } from "@/app/lib/bakeryLogisticsAuth";
import { upsertLogisticsWebshopImage } from "@/app/lib/bakeryLogisticsStorage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type WebshopImageInput = {
  key: string;
  messageId: string;
  subject: string;
  from: string;
  receivedAt: string;
  orderNumber: string;
  deliveryDate: string;
  customerName: string;
  photoUrl: string;
  sourceUrl: string;
  fileName: string;
  bodyText: string;
  bodyHtml: string;
  links: string[];
};

const dutchMonths: Record<string, string> = {
  januari: "01",
  februari: "02",
  maart: "03",
  april: "04",
  mei: "05",
  juni: "06",
  juli: "07",
  augustus: "08",
  september: "09",
  oktober: "10",
  november: "11",
  december: "12",
};

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, message }, { status });
}

function cleanText(value: unknown, maxLength = 500) {
  return String(value || "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function htmlToText(value: string) {
  return decodeHtmlEntities(value)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|li|h\d)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .split(/\n/)
    .map((line) => cleanText(line, 1000))
    .filter(Boolean)
    .join("\n");
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function cleanUrl(value: unknown) {
  const clean = decodeHtmlEntities(String(value || ""))
    .replace(/^<|>$/g, "")
    .trim();

  return isHttpUrl(clean) ? clean.slice(0, 2000) : "";
}

function extractLinks(input: Pick<WebshopImageInput, "bodyHtml" | "bodyText" | "links">) {
  const htmlLinks = Array.from(input.bodyHtml.matchAll(/href=["']([^"']+)["']/gi)).map(
    (match) => cleanUrl(match[1])
  );
  const textLinks = Array.from(
    `${input.bodyText}\n${input.bodyHtml}`.matchAll(/https?:\/\/[^\s"'<>]+/gi)
  ).map((match) => cleanUrl(match[0]));

  return unique([...input.links.map(cleanUrl), ...htmlLinks, ...textLinks]);
}

function scorePhotoUrl(value: string) {
  const lower = value.toLowerCase();
  let score = 0;

  if (/\.(jpe?g|png|webp)(\?|#|$)/i.test(value)) score += 8;
  if (/foto|photo|image|afbeeld|upload|media|download|bestand|file/i.test(value)) {
    score += 5;
  }
  if (/marsepein|taart|webshop|order|bestelling/i.test(value)) score += 2;
  if (/unsubscribe|uitschrijven|facebook|instagram|linkedin|privacy|voorwaarden/i.test(lower)) {
    score -= 10;
  }
  if (/strik-patisserie\.nl\/?$/i.test(lower)) score -= 6;

  return score;
}

function pickPhotoUrl(input: WebshopImageInput) {
  const directPhotoUrl = cleanUrl(input.photoUrl);
  if (directPhotoUrl) return directPhotoUrl;

  const links = extractLinks(input)
    .map((url) => ({ url, score: scorePhotoUrl(url) }))
    .sort((first, second) => second.score - first.score);
  const likelyPhoto = links.find((item) => item.score > 0);

  return likelyPhoto?.url || "";
}

function parseDateParts(day: string, month: string, year: string) {
  const parsedYear = Number(year.length === 2 ? `20${year}` : year);
  const parsedMonth = Number(month);
  const parsedDay = Number(day);

  if (
    !Number.isInteger(parsedYear) ||
    !Number.isInteger(parsedMonth) ||
    !Number.isInteger(parsedDay) ||
    parsedMonth < 1 ||
    parsedMonth > 12 ||
    parsedDay < 1 ||
    parsedDay > 31
  ) {
    return "";
  }

  return `${parsedYear}-${String(parsedMonth).padStart(2, "0")}-${String(parsedDay).padStart(2, "0")}`;
}

function parseDeliveryDate(value: string) {
  const clean = cleanText(value, 120).toLowerCase();
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean;

  const numeric = clean.match(/\b(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})\b/);
  if (numeric) return parseDateParts(numeric[1], numeric[2], numeric[3]);

  const dutch = clean.match(/\b(\d{1,2})\s+([a-z]+)\s+(\d{4})\b/);
  if (dutch) {
    const month = dutchMonths[dutch[2]];
    if (month) return parseDateParts(dutch[1], month, dutch[3]);
  }

  return "";
}

function extractDeliveryDate(input: WebshopImageInput, text: string) {
  const direct = parseDeliveryDate(input.deliveryDate);
  if (direct) return direct;

  const labelMatch = text.match(
    /\b(?:leverdatum|afhaaldatum|bezorgdatum|datum levering|gewenste datum)\s*:?\s*([^\n]+)/i
  );
  if (labelMatch) {
    const parsed = parseDeliveryDate(labelMatch[1]);
    if (parsed) return parsed;
  }

  const firstDate = text.match(
    /\b(\d{4}-\d{2}-\d{2}|\d{1,2}[-/]\d{1,2}[-/]\d{2,4}|\d{1,2}\s+[a-z]+\s+\d{4})\b/i
  );

  return firstDate ? parseDeliveryDate(firstDate[1]) : "";
}

function extractOrderNumber(input: WebshopImageInput, text: string) {
  const direct = cleanText(input.orderNumber, 80);
  if (direct) return direct;

  const match = text.match(
    /\b(?:bestelnummer|ordernummer|order\s*nr\.?|bestelling(?:snummer)?|referentie)\s*:?\s*#?\s*([A-Z0-9-]{3,})/i
  );

  return match ? cleanText(match[1], 80) : "";
}

function extractCustomerName(input: WebshopImageInput, text: string) {
  const direct = cleanText(input.customerName, 160);
  if (direct) return direct;

  const match = text.match(
    /\b(?:klantnaam|klant|naam|besteld door|factuuradres)\s*:?\s*([^\n]+)/i
  );
  if (!match) return "";

  return cleanText(match[1], 160)
    .replace(/\b(e-mail|email|telefoon|adres)\b.*$/i, "")
    .trim();
}

function confidenceFor(input: {
  orderNumber: string;
  deliveryDate: string;
  customerName: string;
  photoUrl: string;
}): LogisticsWebshopImageConfidence {
  if (input.orderNumber && input.deliveryDate && input.customerName && input.photoUrl) {
    return "hoog";
  }
  if (input.deliveryDate && input.customerName && input.photoUrl) return "middel";

  return "laag";
}

function imageIdFor(input: {
  messageId: string;
  orderNumber: string;
  deliveryDate: string;
  customerName: string;
  photoUrl: string;
}) {
  const hash = createHash("sha1")
    .update(
      [
        input.messageId,
        input.orderNumber,
        input.deliveryDate,
        input.customerName,
        input.photoUrl,
      ].join("|")
    )
    .digest("hex")
    .slice(0, 14);

  return `webshop-foto-${input.deliveryDate || "zonder-datum"}-${hash}`;
}

async function readJsonInput(request: Request): Promise<WebshopImageInput | Response> {
  const body = (await request.json()) as Record<string, unknown>;

  return {
    key: cleanText(body.key, 200),
    messageId: cleanText(body.messageId, 240),
    subject: cleanText(body.subject, 300),
    from: cleanText(body.from, 240),
    receivedAt: cleanText(body.receivedAt, 120) || new Date().toISOString(),
    orderNumber: cleanText(body.orderNumber, 80),
    deliveryDate: cleanText(body.deliveryDate, 120),
    customerName: cleanText(body.customerName, 160),
    photoUrl: cleanUrl(body.photoUrl),
    sourceUrl: cleanUrl(body.sourceUrl),
    fileName: cleanText(body.fileName, 240),
    bodyText: cleanText(body.bodyText, 12000),
    bodyHtml: String(body.bodyHtml || "").slice(0, 60000),
    links: Array.isArray(body.links)
      ? body.links.map((link) => cleanUrl(link)).filter(Boolean)
      : [],
  };
}

export async function POST(request: Request) {
  try {
    if (!(request.headers.get("content-type") || "").includes("application/json")) {
      return jsonError("Gebruik application/json voor webshopfoto-import.");
    }

    const input = await readJsonInput(request);
    if (input instanceof Response) return input;

    if (!(await canAccessLogisticsRequest(request, input.key))) {
      return jsonError("Geen toegang tot bakkerij logistiek import.", 403);
    }

    const text = `${input.subject}\n${input.bodyText}\n${htmlToText(input.bodyHtml)}`;
    const photoUrl = pickPhotoUrl(input);
    const deliveryDate = extractDeliveryDate(input, text);
    const orderNumber = extractOrderNumber(input, text);
    const customerName = extractCustomerName(input, text);
    const notes: string[] = [];

    if (!photoUrl) notes.push("Geen duidelijke fotolink gevonden.");
    if (!deliveryDate) notes.push("Geen leverdatum gevonden.");
    if (!customerName) notes.push("Geen klantnaam gevonden.");
    if (!orderNumber) notes.push("Geen bestelnummer gevonden.");

    if (!photoUrl || !deliveryDate) {
      return jsonError(
        notes.length ? notes.join(" ") : "Webshopfoto kon niet worden gelezen.",
        422
      );
    }

    const image: LogisticsWebshopImage = {
      id: imageIdFor({
        messageId: input.messageId,
        orderNumber,
        deliveryDate,
        customerName,
        photoUrl,
      }),
      messageId: input.messageId,
      orderNumber,
      deliveryDate,
      customerName,
      photoUrl,
      sourceUrl: input.sourceUrl,
      fileName: input.fileName,
      subject: input.subject,
      from: input.from,
      receivedAt: input.receivedAt,
      importedAt: new Date().toISOString(),
      confidence: confidenceFor({
        orderNumber,
        deliveryDate,
        customerName,
        photoUrl,
      }),
      notes,
    };

    if (new URL(request.url).searchParams.get("dryRun") !== "1") {
      await upsertLogisticsWebshopImage(image);
    }

    return NextResponse.json({
      ok: true,
      image,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "Webshopfoto inlezen is mislukt.",
      },
      { status: 502 }
    );
  }
}
