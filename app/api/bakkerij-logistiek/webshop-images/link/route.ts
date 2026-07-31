import { NextResponse } from "next/server";
import type { LogisticsWebshopImage } from "@/app/bakkerij/logistiek/logisticsTypes";
import { canAccessLogisticsRequest } from "@/app/lib/bakeryLogisticsAuth";
import {
  readLogisticsWebshopImagesState,
  upsertLogisticsWebshopImage,
} from "@/app/lib/bakeryLogisticsStorage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;

    if (!(await canAccessLogisticsRequest(request, cleanText(body.key, 200)))) {
      return jsonError("Geen toegang tot bakkerij logistiek.", 403);
    }

    const imageId = cleanText(body.imageId, 180);
    const receiptId = cleanText(body.receiptId, 180);
    const receiptNumber = cleanText(body.receiptNumber, 120);
    const receiptCustomer = cleanText(body.receiptCustomer, 180);

    if (!imageId || !receiptId) {
      return jsonError("Geen geldige foto-koppeling ontvangen.");
    }

    const state = await readLogisticsWebshopImagesState();
    const image = state.images.find((item) => item.id === imageId);

    if (!image) {
      return jsonError("Webshopfoto niet gevonden.", 404);
    }

    const linkedImage: LogisticsWebshopImage = {
      ...image,
      matchedReceiptId: receiptId,
      matchedReceiptNumber: receiptNumber,
      matchedReceiptCustomer: receiptCustomer,
      matchedAt: new Date().toISOString(),
      matchSource: "manual",
    };

    const savedImage = await upsertLogisticsWebshopImage(linkedImage);

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
            : "Webshopfoto koppelen is mislukt.",
      },
      { status: 502 }
    );
  }
}
