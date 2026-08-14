import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { canAccessWeddingCakes } from "@/app/lib/auth/access";
import { getCurrentProfile } from "@/app/lib/auth/session";
import {
  sendPersonnelMailOrders,
  type PersonnelMailOrder,
} from "@/app/strik-agenda/personnelMailOrders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PaymentRequestInput = {
  recipientEmail?: string;
  amount?: number;
  subject?: string;
  body?: string;
  code?: string;
  customerName?: string;
  deliveryDate?: string;
};

const PAYMENT_REQUEST_RECIPIENTS = (
  process.env.WEDDING_CAKE_PAYMENT_REQUEST_RECIPIENTS ||
  "info@strik-patisserie.nl"
)
  .split(",")
  .map((recipient) => recipient.trim())
  .filter(Boolean);
const MOLLIE_PAYMENT_LINKS_URL =
  process.env.MOLLIE_PAYMENT_LINKS_URL ||
  "https://api.mollie.com/v2/payment-links";
const MOLLIE_REDIRECT_URL =
  process.env.MOLLIE_PAYMENT_LINK_REDIRECT_URL ||
  process.env.STRIK_WEBSITE_URL ||
  "https://www.strik-patisserie.nl";

type MolliePaymentLinkResponse = {
  id?: string;
  description?: string;
  _links?: {
    paymentLink?: {
      href?: string;
    };
    checkout?: {
      href?: string;
    };
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

function cleanTextarea(value: unknown, maxLength = 8000) {
  return String(value || "")
    .replace(/\r\n/g, "\n")
    .trim()
    .slice(0, maxLength);
}

function moneyFrom(value: unknown) {
  const numberValue = Number(value);

  return Number.isFinite(numberValue)
    ? Number(Math.max(0, numberValue).toFixed(2))
    : 0;
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function normalizeDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "";
}

function formatMollieAmount(amount: number) {
  return amount.toFixed(2);
}

function formatEuro(amount: number) {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
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

async function createMolliePaymentLink(input: {
  amount: number;
  description: string;
}) {
  const apiKey = getMollieApiKey();

  if (!apiKey) {
    throw new Error(
      "Mollie is nog niet ingesteld. Vul MOLLIE_API_KEY in bij de app-instellingen."
    );
  }

  const response = await fetch(MOLLIE_PAYMENT_LINKS_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: {
        currency: "EUR",
        value: formatMollieAmount(input.amount),
      },
      description: input.description,
      redirectUrl: MOLLIE_REDIRECT_URL,
    }),
  });
  const data = (await readJson(response)) as MolliePaymentLinkResponse | null;

  if (!response.ok) {
    const mollieMessage = getMollieErrorMessage(data);
    throw new Error(
      mollieMessage
        ? `Mollie betaalverzoek maken lukt niet: ${mollieMessage}`
        : "Mollie betaalverzoek maken lukt niet."
    );
  }

  const paymentLinkUrl =
    data?._links?.paymentLink?.href || data?._links?.checkout?.href || "";

  if (!paymentLinkUrl) {
    throw new Error("Mollie gaf geen betaallink terug.");
  }

  return {
    id: cleanText(data?.id, 80),
    url: paymentLinkUrl,
  };
}

function createPaymentDescription(input: {
  amount: number;
  code: string;
  customerName: string;
  deliveryDate: string;
}) {
  return cleanText(
    [
      "Bruidstaart",
      input.code,
      input.customerName,
      input.deliveryDate,
      formatEuro(input.amount),
    ]
      .filter(Boolean)
      .join(" - "),
    255
  );
}

function withPaymentLink(body: string, paymentLinkUrl: string) {
  const placeholder = "[MOLLIE LINK HIER PLAKKEN]";

  if (body.includes(placeholder)) {
    return body.replaceAll(placeholder, paymentLinkUrl);
  }

  return [body, "", `Betaallink: ${paymentLinkUrl}`].join("\n");
}

export async function POST(request: Request) {
  const profile = await getCurrentProfile();

  if (!canAccessWeddingCakes(profile)) {
    return jsonError("Geen toegang tot bruidstaart betaalverzoeken.", 403);
  }

  let input: PaymentRequestInput;

  try {
    input = (await request.json()) as PaymentRequestInput;
  } catch {
    return jsonError("Geen geldig betaalverzoek ontvangen.");
  }

  const recipientEmail = cleanText(input.recipientEmail, 180).toLowerCase();
  const amount = moneyFrom(input.amount);
  const subject = cleanText(input.subject, 240);
  const body = cleanTextarea(input.body);
  const code = cleanText(input.code, 80);
  const customerName = cleanText(input.customerName, 160) || "Bruidstaart";
  const deliveryDate = normalizeDate(cleanText(input.deliveryDate, 20));

  if (!recipientEmail || !isEmail(recipientEmail)) {
    return jsonError("Vul een geldig e-mailadres in voor het betaalverzoek.");
  }

  if (amount <= 0) {
    return jsonError("Vul een bedrag hoger dan € 0,00 in.");
  }

  if (!subject || !body) {
    return jsonError("Betaalverzoek is niet compleet.");
  }

  let paymentLink: { id: string; url: string };

  try {
    paymentLink = await createMolliePaymentLink({
      amount,
      description: createPaymentDescription({
        amount,
        code,
        customerName,
        deliveryDate,
      }),
    });
  } catch (error) {
    return jsonError(
      error instanceof Error
        ? error.message
        : "Mollie betaalverzoek maken lukt niet.",
      502
    );
  }

  const now = new Date().toISOString();
  const hash = createHash("sha1")
    .update(
      JSON.stringify({
        recipientEmail,
        amount,
        subject,
        body,
        paymentLinkId: paymentLink.id,
        paymentLinkUrl: paymentLink.url,
        now,
      })
    )
    .digest("hex")
    .slice(0, 10);

  const order: PersonnelMailOrder = {
    id: `wedding-cake-payment-link-${code || "zonder-code"}-${hash}`,
    mailType: "wedding-cake-payment-request",
    employeeName: customerName,
    firstName: customerName.split(/\s+/)[0] || "Bruidstaart",
    eventDate: deliveryDate || now.slice(0, 10),
    eventDateLabel: deliveryDate || "Geen leverdatum",
    daysUntil: 0,
    source: "drive",
    recipients: [recipientEmail],
    ccRecipients: PAYMENT_REQUEST_RECIPIENTS,
    subject,
    body: withPaymentLink(body, paymentLink.url),
    deliveryShop: "Bruidstaarten",
    deliveryDate,
    deliveryDateLabel: deliveryDate || "Geen leverdatum",
    deliveryTimeLabel: "",
    note: `Mollie betaallink ${paymentLink.id || "zonder-id"} naar ${recipientEmail}`,
  };

  try {
    const result = await sendPersonnelMailOrders([order]);

    if (result.failed.length) {
      return jsonError("Betaalverzoek mailen is mislukt.", 502);
    }

    return NextResponse.json({
      ok: true,
      message: result.sent.length
        ? "Betaalverzoek is naar de klant gemaild."
        : "Dit betaalverzoek was al gemaild.",
      paymentLinkId: paymentLink.id,
      paymentLinkUrl: paymentLink.url,
      sent: result.sent.length,
      skipped: result.skipped.length,
    });
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Betaalverzoek mailen is mislukt.",
      502
    );
  }
}
