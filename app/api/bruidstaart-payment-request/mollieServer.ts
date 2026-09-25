import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";

export const MOLLIE_PAYMENT_LINKS_URL =
  process.env.MOLLIE_PAYMENT_LINKS_URL ||
  "https://api.mollie.com/v2/payment-links";

export function getMollieApiKey() {
  return (
    process.env.MOLLIE_API_KEY ||
    process.env.MOLLIE_ACCESS_TOKEN ||
    process.env.STRIK_MOLLIE_API_KEY ||
    ""
  ).trim();
}

function getWebhookToken() {
  const configured = (process.env.MOLLIE_WEBHOOK_TOKEN || "").trim();
  if (configured) return configured;

  return createHash("sha256")
    .update(`strik-wedding-cake-payment:${getMollieApiKey()}`)
    .digest("hex")
    .slice(0, 48);
}

function getAppBaseUrl() {
  const configured =
    process.env.MOLLIE_WEBHOOK_BASE_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    "https://app.strik-patisserie.nl";
  const withProtocol = /^https?:\/\//i.test(configured)
    ? configured
    : `https://${configured}`;

  return withProtocol.replace(/\/+$/, "");
}

export function getMollieWebhookUrl() {
  const url = new URL(
    "/api/bruidstaart-payment-request/webhook",
    getAppBaseUrl(),
  );
  url.searchParams.set("token", getWebhookToken());
  return url.toString();
}

export function hasValidMollieWebhookToken(value: string) {
  const expected = Buffer.from(getWebhookToken());
  const received = Buffer.from(value);

  return (
    expected.length === received.length && timingSafeEqual(expected, received)
  );
}

export function molliePaymentLinkUrl(paymentLinkId: string) {
  return `${MOLLIE_PAYMENT_LINKS_URL.replace(/\/+$/, "")}/${encodeURIComponent(
    paymentLinkId,
  )}`;
}

export function molliePaymentUrl(paymentId: string) {
  const paymentLinksUrl = new URL(MOLLIE_PAYMENT_LINKS_URL);
  return `${paymentLinksUrl.origin}/v2/payments/${encodeURIComponent(paymentId)}`;
}

export async function readJson(response: Response) {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

export function mollieErrorMessage(data: unknown) {
  if (!data || typeof data !== "object") return "";
  const source = data as {
    title?: unknown;
    detail?: unknown;
    message?: unknown;
    field?: unknown;
  };

  return [source.title, source.detail || source.message, source.field]
    .map((part) => String(part || "").replace(/\s+/g, " ").trim().slice(0, 240))
    .filter(Boolean)
    .join(" - ");
}
