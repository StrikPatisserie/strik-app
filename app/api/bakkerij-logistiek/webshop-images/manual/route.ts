import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import type { LogisticsWebshopImage } from "@/app/bakkerij/logistiek/logisticsTypes";
import { canAccessLogisticsRequest } from "@/app/lib/bakeryLogisticsAuth";
import { upsertLogisticsWebshopImage } from "@/app/lib/bakeryLogisticsStorage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type UploadedFile = File & {
  arrayBuffer: () => Promise<ArrayBuffer>;
  name: string;
  size: number;
  type: string;
};

const MAX_MANUAL_IMAGE_BYTES = 1_500_000;

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

function isUploadedFile(value: FormDataEntryValue | null): value is UploadedFile {
  return Boolean(
    value &&
      typeof value === "object" &&
      "arrayBuffer" in value &&
      "name" in value &&
      "size" in value
  );
}

function cleanImageContentType(value: unknown) {
  const clean = cleanText(value, 80).toLowerCase();
  if (["image/jpeg", "image/png", "image/webp"].includes(clean)) return clean;

  return "";
}

function imageIdFor(input: {
  receiptId: string;
  deliveryDate: string;
  fileName: string;
  dataUrl: string;
}) {
  const hash = createHash("sha1")
    .update(
      [
        input.receiptId,
        input.deliveryDate,
        input.fileName,
        input.dataUrl.slice(0, 4000),
      ].join("|")
    )
    .digest("hex")
    .slice(0, 14);

  return `manual-mail-photo-${input.deliveryDate || "zonder-datum"}-${hash}`;
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();

    if (!(await canAccessLogisticsRequest(request, cleanText(formData.get("key"), 200)))) {
      return jsonError("Geen toegang tot bakkerij logistiek.", 403);
    }

    const file = formData.get("file");
    if (!isUploadedFile(file)) {
      return jsonError("Geen foto ontvangen.");
    }

    const contentType = cleanImageContentType(file.type);
    if (!contentType) {
      return jsonError("Gebruik een JPG, PNG of WEBP foto.");
    }
    if (file.size <= 0 || file.size > MAX_MANUAL_IMAGE_BYTES) {
      return jsonError("Foto is te groot om veilig te bewaren.", 413);
    }

    const deliveryDate = cleanText(formData.get("date"), 20);
    const receiptId = cleanText(formData.get("receiptId"), 180);
    const receiptNumber = cleanText(formData.get("receiptNumber"), 120);
    const receiptCustomer = cleanText(formData.get("receiptCustomer"), 180);
    const productSummary = cleanText(formData.get("productSummary"), 500);

    if (!/^\d{4}-\d{2}-\d{2}$/.test(deliveryDate) || !receiptId) {
      return jsonError("Geen geldige bon ontvangen.");
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const dataUrl = `data:${contentType};base64,${buffer.toString("base64")}`;
    const importedAt = new Date().toISOString();
    const image: LogisticsWebshopImage = {
      id: imageIdFor({
        receiptId,
        deliveryDate,
        fileName: file.name,
        dataUrl,
      }),
      messageId: `manual-mail-photo:${receiptId}`,
      orderNumber: receiptNumber,
      deliveryDate,
      customerName: receiptCustomer,
      photoUrl: dataUrl,
      sourceUrl: "",
      fileName: cleanText(file.name, 240) || "handmatige-mailfoto.jpg",
      productSummary,
      matchedReceiptId: receiptId,
      matchedReceiptNumber: receiptNumber,
      matchedReceiptCustomer: receiptCustomer,
      matchedAt: importedAt,
      matchSource: "manual",
      subject: "Handmatige mailfoto",
      from: "",
      receivedAt: importedAt,
      importedAt,
      confidence: "hoog",
      notes: ["Handmatig geupload bij contantbon."],
    };

    const savedImage = await upsertLogisticsWebshopImage(image);

    return NextResponse.json({
      ok: true,
      image: savedImage,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "Handmatige foto uploaden is mislukt.",
      },
      { status: 502 }
    );
  }
}
