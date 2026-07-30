import { NextResponse } from "next/server";
import type {
  LogisticsFulfillment,
  LogisticsReceiptOverride,
} from "@/app/bakkerij/logistiek/logisticsTypes";
import { canAccessLogisticsRequest } from "@/app/lib/bakeryLogisticsAuth";
import {
  deleteLogisticsReceiptOverride,
  upsertLogisticsReceiptOverride,
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

function cleanFulfillment(value: unknown): LogisticsFulfillment | "" {
  const clean = cleanText(value, 40);

  return ["bezorgen", "afhalen", "onbekend"].includes(clean)
    ? (clean as LogisticsFulfillment)
    : "";
}

function overrideIdFor(date: string, receiptId: string, receiptNumber: string) {
  return `${date}:${receiptNumber || receiptId}`;
}

function hasOverrideValue(override: LogisticsReceiptOverride) {
  return Boolean(
    override.time ||
      override.fulfillment ||
      override.deliveryAddress ||
      override.alternativeAddress ||
      override.pickupLocation ||
      override.routeNote
  );
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;

    if (!(await canAccessLogisticsRequest(request, cleanText(body.key, 200)))) {
      return jsonError("Geen toegang tot bakkerij logistiek.", 403);
    }

    const date = cleanText(body.date, 20);
    const receiptId = cleanText(body.receiptId, 120);
    const receiptNumber = cleanText(body.receiptNumber, 120);

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !receiptId) {
      return jsonError("Geen geldige bonaanpassing ontvangen.");
    }

    const override: LogisticsReceiptOverride = {
      id: overrideIdFor(date, receiptId, receiptNumber),
      date,
      receiptId,
      receiptNumber,
      time: cleanText(body.time, 80),
      fulfillment: cleanFulfillment(body.fulfillment),
      deliveryAddress: cleanText(body.deliveryAddress, 300),
      alternativeAddress: cleanText(body.alternativeAddress, 300),
      pickupLocation: cleanText(body.pickupLocation, 80),
      routeNote: cleanText(body.routeNote, 500),
      updatedAt: new Date().toISOString(),
    };

    if (!hasOverrideValue(override)) {
      await deleteLogisticsReceiptOverride(override.id);

      return NextResponse.json({
        ok: true,
        deleted: true,
        override,
        generatedAt: new Date().toISOString(),
      });
    }

    await upsertLogisticsReceiptOverride(override);

    return NextResponse.json({
      ok: true,
      deleted: false,
      override,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "Bonaanpassing opslaan is mislukt.",
      },
      { status: 502 }
    );
  }
}
