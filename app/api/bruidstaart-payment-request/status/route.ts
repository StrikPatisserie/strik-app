import { NextResponse } from "next/server";
import { canAccessWeddingCakes } from "@/app/lib/auth/access";
import { getCurrentProfile } from "@/app/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MOLLIE_PAYMENT_LINKS_URL =
  process.env.MOLLIE_PAYMENT_LINKS_URL ||
  "https://api.mollie.com/v2/payment-links";

type MolliePaymentLinkStatusResponse = {
  id?: string;
  paidAt?: string | null;
  mode?: string;
  amount?: {
    currency?: string;
    value?: string;
  };
};

function jsonError(message: string, status = 400) {
  return NextResponse.json({ message }, { status });
}

function cleanText(value: unknown, maxLength = 200) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function getMollieApiKey() {
  return (
    process.env.MOLLIE_API_KEY ||
    process.env.MOLLIE_ACCESS_TOKEN ||
    process.env.STRIK_MOLLIE_API_KEY ||
    ""
  ).trim();
}

function getMollieErrorMessage(data: unknown) {
  if (!data || typeof data !== "object") return "";

  const source = data as {
    title?: unknown;
    detail?: unknown;
    message?: unknown;
    field?: unknown;
  };

  return [source.title, source.detail || source.message, source.field]
    .map((part) => cleanText(part, 240))
    .filter(Boolean)
    .join(" - ");
}

async function readJson(response: Response) {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function amountFromMollie(value: unknown) {
  if (!value || typeof value !== "object") return 0;

  const amount = value as { currency?: unknown; value?: unknown };
  if (amount.currency !== "EUR") return 0;

  const numberValue = Number(amount.value);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

export async function GET(request: Request) {
  const profile = await getCurrentProfile();

  if (!canAccessWeddingCakes(profile)) {
    return jsonError("Geen toegang tot bruidstaart betaalverzoeken.", 403);
  }

  const url = new URL(request.url);
  const paymentLinkId = cleanText(url.searchParams.get("paymentLinkId"), 80);

  if (!/^pl_[A-Za-z0-9]+$/.test(paymentLinkId)) {
    return jsonError("Geen geldige Mollie betaallink gevonden.");
  }

  const apiKey = getMollieApiKey();
  if (!apiKey) {
    return jsonError(
      "Mollie is nog niet ingesteld. Vul MOLLIE_API_KEY in bij de app-instellingen.",
      502
    );
  }

  const mollieUrl = `${MOLLIE_PAYMENT_LINKS_URL.replace(
    /\/+$/,
    ""
  )}/${encodeURIComponent(paymentLinkId)}`;
  const response = await fetch(mollieUrl, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    cache: "no-store",
  });
  const data = (await readJson(response)) as
    | MolliePaymentLinkStatusResponse
    | null;

  if (!response.ok) {
    const mollieMessage = getMollieErrorMessage(data);
    return jsonError(
      mollieMessage
        ? `Mollie betaling controleren lukt niet: ${mollieMessage}`
        : "Mollie betaling controleren lukt niet.",
      502
    );
  }

  const paidAt = cleanText(data?.paidAt, 80);

  return NextResponse.json({
    ok: true,
    paymentLinkId: cleanText(data?.id, 80) || paymentLinkId,
    paid: Boolean(paidAt),
    paidAt,
    amount: amountFromMollie(data?.amount),
    mode: cleanText(data?.mode, 40),
  });
}
