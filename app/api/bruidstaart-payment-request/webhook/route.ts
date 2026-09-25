import { NextResponse } from "next/server";
import {
  hasValidMollieWebhookToken,
  molliePaymentLinkUrl,
  readJson,
  getMollieApiKey,
} from "../mollieServer";
import {
  getPaidPayment,
  syncWeddingCakePayment,
  weddingCakeCodeFromDescription,
} from "../paymentSync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type MolliePaymentLink = {
  id?: string;
  description?: string;
};

function jsonError(message: string, status: number) {
  return NextResponse.json({ message }, { status });
}

async function paymentLinkDescription(paymentLinkId: string) {
  const apiKey = getMollieApiKey();
  if (!apiKey) throw new Error("Mollie is niet ingesteld.");

  const response = await fetch(molliePaymentLinkUrl(paymentLinkId), {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    cache: "no-store",
  });
  const data = (await readJson(response)) as MolliePaymentLink | null;
  if (!response.ok || !data) {
    throw new Error("Mollie betaallink ophalen is mislukt.");
  }

  return String(data.description || "");
}

async function webhookEntity(request: Request) {
  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    const data = (await request.json()) as {
      type?: unknown;
      entityId?: unknown;
      id?: unknown;
    };
    const eventType = String(data.type || "");
    const entityId = String(data.entityId || data.id || "").trim();

    if (eventType && eventType !== "payment-link.paid") {
      return { id: "", ignored: true };
    }
    return { id: entityId, ignored: false };
  }

  const formData = await request.formData();
  return { id: String(formData.get("id") || "").trim(), ignored: false };
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  if (!hasValidMollieWebhookToken(url.searchParams.get("token") || "")) {
    return jsonError("Ongeldige webhook.", 401);
  }

  try {
    const entity = await webhookEntity(request);
    if (entity.ignored) return NextResponse.json({ ok: true, ignored: true });

    let code = "";
    let paymentLinkId = "";

    if (/^pl_[A-Za-z0-9]+$/.test(entity.id)) {
      paymentLinkId = entity.id;
      code = weddingCakeCodeFromDescription(
        await paymentLinkDescription(paymentLinkId),
      );
    } else if (/^tr_[A-Za-z0-9]+$/.test(entity.id)) {
      const payment = await getPaidPayment(entity.id);
      if (!payment.paid) {
        return NextResponse.json({ ok: true, ignored: true });
      }
      code = weddingCakeCodeFromDescription(payment.description);
    } else {
      return jsonError("Onbekend Mollie-object.", 400);
    }

    const result = await syncWeddingCakePayment({ code, paymentLinkId });
    return NextResponse.json({
      ok: true,
      code: result.code,
      paid: result.paid,
      changed: result.changed,
    });
  } catch (error) {
    return jsonError(
      error instanceof Error
        ? error.message
        : "Betaalstatus verwerken is mislukt.",
      502,
    );
  }
}
