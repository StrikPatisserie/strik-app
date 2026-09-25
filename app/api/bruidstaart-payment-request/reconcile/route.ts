import { NextResponse } from "next/server";
import { canAccessWeddingCakes } from "@/app/lib/auth/access";
import { getCurrentProfile } from "@/app/lib/auth/session";
import {
  syncWeddingCakePayment,
  type WeddingCakePaymentSyncResult,
} from "../paymentSync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ReconcileInput = {
  orders?: Array<{
    code?: string;
    paymentLinkId?: string;
  }>;
};

function cleanText(value: unknown, maxLength = 200) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function jsonError(message: string, status = 400) {
  return NextResponse.json({ message }, { status });
}

export async function POST(request: Request) {
  const profile = await getCurrentProfile();
  if (!canAccessWeddingCakes(profile)) {
    return jsonError("Geen toegang tot bruidstaartbetalingen.", 403);
  }

  let input: ReconcileInput;
  try {
    input = (await request.json()) as ReconcileInput;
  } catch {
    return jsonError("Geen geldige betaalcontrole ontvangen.");
  }

  const uniqueOrders = new Map<string, { code: string; paymentLinkId: string }>();
  (input.orders || []).slice(0, 40).forEach((order) => {
    const code = cleanText(order.code, 80);
    const paymentLinkId = cleanText(order.paymentLinkId, 80);
    if (code && /^pl_[A-Za-z0-9]+$/.test(paymentLinkId)) {
      uniqueOrders.set(`${code.toLowerCase()}:${paymentLinkId}`, {
        code,
        paymentLinkId,
      });
    }
  });

  if (!uniqueOrders.size) {
    return jsonError("Geen openstaande betaalverzoeken gevonden.");
  }

  const results: WeddingCakePaymentSyncResult[] = [];
  const failed: Array<{ code: string; message: string }> = [];

  for (const order of uniqueOrders.values()) {
    try {
      results.push(await syncWeddingCakePayment(order));
    } catch (error) {
      failed.push({
        code: order.code,
        message:
          error instanceof Error ? error.message : "Controleren is mislukt.",
      });
    }
  }

  return NextResponse.json({ ok: true, results, failed });
}
