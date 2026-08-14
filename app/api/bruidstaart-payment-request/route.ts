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

  const now = new Date().toISOString();
  const hash = createHash("sha1")
    .update(JSON.stringify({ recipientEmail, amount, subject, body, now }))
    .digest("hex")
    .slice(0, 10);

  const order: PersonnelMailOrder = {
    id: `wedding-cake-payment-request-${code || "zonder-code"}-${hash}`,
    mailType: "wedding-cake-payment-request",
    employeeName: customerName,
    firstName: customerName.split(/\s+/)[0] || "Bruidstaart",
    eventDate: deliveryDate || now.slice(0, 10),
    eventDateLabel: deliveryDate || "Geen leverdatum",
    daysUntil: 0,
    source: "drive",
    recipients: PAYMENT_REQUEST_RECIPIENTS,
    subject,
    body,
    deliveryShop: "Bruidstaarten",
    deliveryDate,
    deliveryDateLabel: deliveryDate || "Geen leverdatum",
    deliveryTimeLabel: "",
    note: `Betaalverzoek naar ${recipientEmail}`,
  };

  try {
    const result = await sendPersonnelMailOrders([order]);

    if (result.failed.length) {
      return jsonError("Betaalverzoek mailen is mislukt.", 502);
    }

    return NextResponse.json({
      ok: true,
      message: result.sent.length
        ? "Betaalverzoek is naar Strik gemaild."
        : "Dit betaalverzoek was al gemaild.",
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
