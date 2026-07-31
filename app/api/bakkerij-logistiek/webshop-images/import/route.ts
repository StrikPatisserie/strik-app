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
  imageAttachments: WebshopImageAttachmentInput[];
};

type WebshopImageAttachmentInput = {
  fileName: string;
  contentType: string;
  size: number;
  dataUrl: string;
};

const MAX_INLINE_IMAGE_BYTES = 1_500_000;

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

function cleanImageContentType(value: unknown) {
  const clean = cleanText(value, 80).toLowerCase();
  if (["image/jpeg", "image/png", "image/webp"].includes(clean)) return clean;

  return "";
}

function cleanDataImageUrl(value: unknown, preferredContentType = "") {
  const raw = String(value || "").trim();
  const dataUrlMatch = raw.match(
    /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=\s]+)$/i
  );
  const contentType = cleanImageContentType(
    dataUrlMatch?.[1] || preferredContentType
  );
  const base64 = (dataUrlMatch?.[2] || raw).replace(/\s+/g, "");

  if (!contentType || !/^[A-Za-z0-9+/=]+$/.test(base64)) return "";

  const buffer = Buffer.from(base64, "base64");
  if (buffer.length <= 0 || buffer.length > MAX_INLINE_IMAGE_BYTES) return "";

  return `data:${contentType};base64,${buffer.toString("base64")}`;
}

function cleanPhotoReference(value: unknown) {
  return cleanUrl(value) || cleanDataImageUrl(value);
}

function isDataImageUrl(value: string) {
  return /^data:image\/(?:jpeg|png|webp);base64,/i.test(value);
}

function extractLinks(input: Pick<WebshopImageInput, "bodyHtml" | "bodyText" | "links">) {
  const htmlLinks = Array.from(
    input.bodyHtml.matchAll(/\b(?:href|src)=["']([^"']+)["']/gi)
  ).map((match) => cleanUrl(match[1]));
  const textLinks = Array.from(
    `${input.bodyText}\n${input.bodyHtml}`.matchAll(/https?:\/\/[^\s"'<>]+/gi)
  ).map((match) => cleanUrl(match[0]));

  return unique([...input.links.map(cleanUrl), ...htmlLinks, ...textLinks]);
}

function normalizedFileNameForMatch(value: string) {
  return cleanPhotoFileName(value)
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, "");
}

function photoUrlMatchesFileName(value: string, fileName: string) {
  const expected = normalizedFileNameForMatch(fileName);
  if (!expected) return false;

  let decoded = value;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    // Keep the original URL when decoding is not possible.
  }

  return (
    normalizedFileNameForMatch(value) === expected ||
    decoded.toLowerCase().replace(/[^a-z0-9.]+/g, "").includes(expected)
  );
}

function scorePhotoUrl(value: string, fileName = "") {
  if (isDataImageUrl(value)) return 100;

  const lower = value.toLowerCase();
  let score = 0;

  if (/\.(jpe?g|png|webp)(\?|#|$)/i.test(value)) score += 8;
  if (fileName && photoUrlMatchesFileName(value, fileName)) score += 30;
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

function pickPhotoUrl(input: WebshopImageInput, fileName = "") {
  const directPhotoUrl = cleanPhotoReference(input.photoUrl);
  if (isDataImageUrl(directPhotoUrl)) return directPhotoUrl;

  const links = unique([directPhotoUrl, ...extractLinks(input)])
    .map((url) => ({ url, score: scorePhotoUrl(url, fileName) }))
    .sort((first, second) => second.score - first.score);
  const likelyPhoto = links.find((item) => item.score > 0);

  return likelyPhoto?.url || directPhotoUrl || "";
}

function cleanPhotoFileName(value: unknown) {
  let clean = decodeHtmlEntities(String(value || ""))
    .split(/[?#]/)[0]
    .replace(/^.*[\\/]/, "")
    .replace(/\s+/g, " ")
    .trim();

  try {
    clean = decodeURIComponent(clean);
  } catch {
    // Keep the original string if URL decoding is not possible.
  }

  const fileMatch = clean.match(/([^<>"|\\/\r\n]{1,180}\.(?:jpe?g|png|webp))/i);
  if (!fileMatch) return "";

  return fileMatch[1]
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 240);
}

function extractPhotoFileName(
  input: WebshopImageInput,
  text: string,
  photoUrl: string
) {
  const direct = cleanPhotoFileName(input.fileName);
  if (direct) return direct;

  const uploadMatch = text.match(
    /\b(?:foto|photo|afbeelding|bestand|file)\s*(?:geupload|geüpload|uploaded|upload)?\s*:?\s*([^\r\n]{0,220}\.(?:jpe?g|png|webp))/i
  );
  if (uploadMatch) {
    const fileName = cleanPhotoFileName(uploadMatch[1]);
    if (fileName) return fileName;
  }

  const anyFileMatch = text.match(
    /([A-Za-z0-9][^<>"|\\/\r\n]{0,180}\.(?:jpe?g|png|webp))/i
  );
  if (anyFileMatch) {
    const fileName = cleanPhotoFileName(anyFileMatch[1]);
    if (fileName) return fileName;
  }

  return cleanPhotoFileName(photoUrl);
}

function cleanImageAttachment(value: unknown): WebshopImageAttachmentInput | null {
  if (!value || typeof value !== "object") return null;

  const item = value as Record<string, unknown>;
  const contentType = cleanImageContentType(item.contentType);
  const dataUrl = cleanDataImageUrl(item.dataBase64 || item.dataUrl, contentType);
  if (!contentType || !dataUrl) return null;

  return {
    fileName: cleanPhotoFileName(item.fileName) || "webshop-foto.png",
    contentType,
    size: Buffer.from(dataUrl.split(",")[1] || "", "base64").length,
    dataUrl,
  };
}

function scoreImageAttachment(
  attachment: WebshopImageAttachmentInput,
  fileName: string
) {
  let score = attachment.size > 20_000 ? 5 : 0;

  if (attachment.fileName) score += 4;
  if (fileName && normalizedFileNameForMatch(attachment.fileName) === normalizedFileNameForMatch(fileName)) {
    score += 60;
  } else if (
    fileName &&
    normalizedFileNameForMatch(attachment.fileName).includes(normalizedFileNameForMatch(fileName))
  ) {
    score += 35;
  }
  if (/logo|foto|photo|image|afbeeld|upload|petit|taart/i.test(attachment.fileName)) {
    score += 8;
  }

  return score;
}

function pickImageAttachment(
  attachments: WebshopImageAttachmentInput[],
  fileName: string
) {
  const scored = attachments
    .map((attachment) => ({
      attachment,
      score: scoreImageAttachment(attachment, fileName),
    }))
    .sort((first, second) => second.score - first.score);

  return scored.find((item) => item.score > 0)?.attachment || null;
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

  const salutationMatch = text.match(/\bBeste\s+([^,\n]{2,120})[,.\n]/i);
  if (salutationMatch) {
    return cleanText(salutationMatch[1], 160);
  }

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
    photoUrl: cleanPhotoReference(body.photoUrl),
    sourceUrl: cleanUrl(body.sourceUrl),
    fileName: cleanText(body.fileName, 240),
    bodyText: cleanText(body.bodyText, 12000),
    bodyHtml: String(body.bodyHtml || "").slice(0, 60000),
    links: Array.isArray(body.links)
      ? body.links.map((link) => cleanUrl(link)).filter(Boolean)
      : [],
    imageAttachments: Array.isArray(body.imageAttachments)
      ? body.imageAttachments
          .map(cleanImageAttachment)
          .filter((attachment): attachment is WebshopImageAttachmentInput =>
            Boolean(attachment)
          )
          .slice(0, 4)
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
    const initialPhotoUrl = pickPhotoUrl(input);
    const initialAttachment = pickImageAttachment(input.imageAttachments, "");
    const fileName =
      extractPhotoFileName(
        input,
        text,
        initialPhotoUrl || initialAttachment?.fileName || ""
      ) ||
      initialAttachment?.fileName ||
      "";
    const matchedAttachment = pickImageAttachment(input.imageAttachments, fileName);
    const photoUrl =
      pickPhotoUrl(input, fileName) ||
      matchedAttachment?.dataUrl ||
      initialPhotoUrl ||
      "";
    const deliveryDate = extractDeliveryDate(input, text);
    const orderNumber = extractOrderNumber(input, text);
    const customerName = extractCustomerName(input, text);
    const notes: string[] = [];

    if (!photoUrl) notes.push("Geen duidelijke fotolink gevonden.");
    if (!deliveryDate) notes.push("Geen leverdatum gevonden.");
    if (!customerName) notes.push("Geen klantnaam gevonden.");
    if (!orderNumber) notes.push("Geen bestelnummer gevonden.");
    if (matchedAttachment && photoUrl === matchedAttachment.dataUrl) {
      notes.push("Foto uit mailbijlage gelezen.");
    }

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
      fileName,
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
      await upsertLogisticsWebshopImage(image, { preserveManualMatch: true });
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
