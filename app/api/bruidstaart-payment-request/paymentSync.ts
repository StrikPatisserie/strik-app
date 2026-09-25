import "server-only";

import {
  WEDDING_CAKE_API_KEY,
  WEDDING_CAKE_API_URL,
  normalizeDraft,
  normalizeDraftList,
  type WeddingCakeDraft,
} from "@/app/bruidstaart-studio/studioApi";
import {
  getMollieApiKey,
  mollieErrorMessage,
  molliePaymentLinkUrl,
  molliePaymentUrl,
  readJson,
} from "./mollieServer";

type MollieMoney = {
  currency?: string;
  value?: string;
};

type MolliePaymentLink = {
  id?: string;
  description?: string;
  paidAt?: string | null;
  amount?: MollieMoney;
};

type MolliePayment = {
  id?: string;
  status?: string;
  description?: string;
  paidAt?: string | null;
  amount?: MollieMoney;
};

export type WeddingCakePaymentSyncResult = {
  code: string;
  paymentLinkId: string;
  paid: boolean;
  paidAt: string;
  amount: number;
  changed: boolean;
};

function cleanText(value: unknown, maxLength = 200) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function amountFromMollie(value: MollieMoney | undefined) {
  if (value?.currency !== "EUR") return 0;
  const amount = Number(value.value);
  return Number.isFinite(amount) ? amount : 0;
}

function weddingCakeApiUrl(search?: string) {
  const url = new URL(WEDDING_CAKE_API_URL);
  url.searchParams.set("key", WEDDING_CAKE_API_KEY);
  if (search) url.searchParams.set("search", search);
  return url;
}

async function mollieGet<T>(url: string) {
  const apiKey = getMollieApiKey();
  if (!apiKey) throw new Error("Mollie is niet ingesteld.");

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    cache: "no-store",
  });
  const data = (await readJson(response)) as T | null;

  if (!response.ok) {
    const detail = mollieErrorMessage(data);
    throw new Error(detail || "Mollie-status ophalen is mislukt.");
  }

  if (!data) throw new Error("Mollie gaf geen status terug.");
  return data;
}

async function loadWeddingCake(code: string) {
  const response = await fetch(weddingCakeApiUrl(code), { cache: "no-store" });
  if (!response.ok) throw new Error("Bruidstaart ophalen is mislukt.");

  return normalizeDraftList(await response.json()).find(
    (draft) => draft.code.toLowerCase() === code.toLowerCase(),
  );
}

async function saveWeddingCake(draft: WeddingCakeDraft) {
  const response = await fetch(weddingCakeApiUrl(), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(draft),
  });
  if (!response.ok) throw new Error("Betaalstatus opslaan is mislukt.");

  return normalizeDraft(await response.json()) || draft;
}

export function weddingCakeCodeFromDescription(description: string) {
  const match = description.match(/^Bruidstaart\s+-\s+(.+?)\s+-\s+/i);
  return cleanText(match?.[1], 80);
}

export async function getPaidPayment(paymentId: string) {
  if (!/^tr_[A-Za-z0-9]+$/.test(paymentId)) {
    throw new Error("Ongeldig Mollie betalings-ID.");
  }

  const payment = await mollieGet<MolliePayment>(molliePaymentUrl(paymentId));
  return {
    id: cleanText(payment.id, 80) || paymentId,
    paid: payment.status === "paid" && Boolean(payment.paidAt),
    paidAt: cleanText(payment.paidAt, 80),
    description: cleanText(payment.description, 255),
    amount: amountFromMollie(payment.amount),
  };
}

export async function syncWeddingCakePayment(input: {
  code: string;
  paymentLinkId?: string;
}): Promise<WeddingCakePaymentSyncResult> {
  const code = cleanText(input.code, 80);
  const requestedLinkId = cleanText(input.paymentLinkId, 80);
  if (!code) throw new Error("Geen bruidstaartcode gevonden.");
  if (requestedLinkId && !/^pl_[A-Za-z0-9]+$/.test(requestedLinkId)) {
    throw new Error("Ongeldige Mollie betaallink.");
  }

  const draft = await loadWeddingCake(code);
  if (!draft?.config.completed) {
    throw new Error(`Definitieve bruidstaart ${code} is niet gevonden.`);
  }

  const storedLinkId = cleanText(draft.config.paymentRequestLinkId, 80);
  if (!storedLinkId || !/^pl_[A-Za-z0-9]+$/.test(storedLinkId)) {
    throw new Error(`Bruidstaart ${code} heeft geen opgeslagen betaallink.`);
  }
  if (requestedLinkId && requestedLinkId !== storedLinkId) {
    throw new Error(`De betaallink hoort niet bij bruidstaart ${code}.`);
  }

  const link = await mollieGet<MolliePaymentLink>(
    molliePaymentLinkUrl(storedLinkId),
  );
  const paidAt = cleanText(link.paidAt, 80);
  const amount = amountFromMollie(link.amount) || draft.config.paymentRequestAmount || 0;

  if (!paidAt) {
    return {
      code: draft.code,
      paymentLinkId: storedLinkId,
      paid: false,
      paidAt: "",
      amount,
      changed: false,
    };
  }

  if (draft.config.paymentRequestPaidAt === paidAt && draft.config.paid) {
    return {
      code: draft.code,
      paymentLinkId: storedLinkId,
      paid: true,
      paidAt,
      amount,
      changed: false,
    };
  }

  await saveWeddingCake({
    ...draft,
    config: {
      ...draft.config,
      paid: true,
      paidInStoreAt: "",
      paymentRequestPaidAt: paidAt,
      paymentRequestAmount: amount,
    },
  });

  return {
    code: draft.code,
    paymentLinkId: storedLinkId,
    paid: true,
    paidAt,
    amount,
    changed: true,
  };
}
