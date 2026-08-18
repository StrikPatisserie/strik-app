import type {
  ChocolateLetterChocolate,
  ChocolateLetterOrder,
  ChocolateLetterSize,
  ChocolateLetterStyle,
  SinterklaasB2BOrder,
  SinterklaasListResponse,
} from "./types";

type OrderKind = "letter" | "b2b";

const ENDPOINTS: Record<OrderKind, string> = {
  letter: "/api/sinterklaas-letter-orders",
  b2b: "/api/sinterklaas-b2b-orders",
};

function currentYear() {
  return String(new Date().getFullYear());
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function textFrom(value: unknown) {
  return typeof value === "string" ? value : "";
}

function boolFrom(value: unknown) {
  return Boolean(value);
}

function numberFrom(value: unknown) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? Math.max(0, Math.round(numberValue)) : 0;
}

function normalizeLetterOrder(value: unknown): ChocolateLetterOrder | null {
  if (!isRecord(value)) return null;

  const id = textFrom(value.id);
  const customerName = textFrom(value.customerName);
  const rawLines = Array.isArray(value.lines) ? value.lines : [];

  if (!id || !customerName) return null;

  const lines = rawLines.flatMap((line, index) => {
    if (!isRecord(line)) return [];

    const letter = textFrom(line.letter).toUpperCase();
    const quantity = numberFrom(line.quantity);
    if (!letter || quantity < 1) return [];
    const chocolate: ChocolateLetterChocolate =
      line.chocolate === "puur" ||
      line.chocolate === "wit" ||
      line.chocolate === "vegan-puur"
        ? line.chocolate
        : "melk";
    const size: ChocolateLetterSize = line.size === "klein" ? "klein" : "groot";
    const style: ChocolateLetterStyle = line.style === "vorm" ? "vorm" : "spuit";

    return [
      {
        id: textFrom(line.id) || `line-${index + 1}`,
        letter,
        chocolate,
        size,
        style,
        quantity,
        logo: boolFrom(line.logo),
        notes: textFrom(line.notes),
      },
    ];
  });

  return {
    id,
    year: textFrom(value.year) || currentYear(),
    code: textFrom(value.code) || id,
    customerName,
    customerEmail: textFrom(value.customerEmail),
    phone: textFrom(value.phone),
    shop: textFrom(value.shop),
    pickupDate: textFrom(value.pickupDate),
    pickupLocation: textFrom(value.pickupLocation),
    status:
      value.status === "in-productie" ||
      value.status === "klaar" ||
      value.status === "opgehaald" ||
      value.status === "geannuleerd"
        ? value.status
        : "besteld",
    notes: textFrom(value.notes),
    lines,
    sendCustomerEmail: boolFrom(value.sendCustomerEmail),
    productionDone: boolFrom(value.productionDone),
    productionDoneAt: textFrom(value.productionDoneAt),
    productionDoneBy: textFrom(value.productionDoneBy),
    pickedUp: boolFrom(value.pickedUp),
    pickedUpAt: textFrom(value.pickedUpAt),
    bakeryEmailSentAt: textFrom(value.bakeryEmailSentAt),
    bakeryEmailError: textFrom(value.bakeryEmailError),
    customerConfirmationSentAt: textFrom(value.customerConfirmationSentAt),
    customerConfirmationError: textFrom(value.customerConfirmationError),
    createdAt: textFrom(value.createdAt),
    updatedAt: textFrom(value.updatedAt),
  };
}

function normalizeB2BOrder(value: unknown): SinterklaasB2BOrder | null {
  if (!isRecord(value)) return null;

  const id = textFrom(value.id);
  const customerName = textFrom(value.customerName);
  const orderText = textFrom(value.orderText);

  if (!id || !customerName || !orderText) return null;

  return {
    id,
    year: textFrom(value.year) || currentYear(),
    season:
      value.season === "kerst" || value.season === "sint-kerst"
        ? value.season
        : "sint",
    customerName,
    contactName: textFrom(value.contactName),
    customerEmail: textFrom(value.customerEmail),
    phone: textFrom(value.phone),
    deliveryDate: textFrom(value.deliveryDate),
    productionDate: textFrom(value.productionDate),
    department:
      value.department === "bakkerij" || value.department === "beide"
        ? value.department
        : "chocolade",
    orderText,
    logo: textFrom(value.logo),
    packaging: textFrom(value.packaging),
    importantNotes: textFrom(value.importantNotes),
    priceAgreement: textFrom(value.priceAgreement),
    totalExVat: textFrom(value.totalExVat),
    deliveryMethod: textFrom(value.deliveryMethod),
    deliveryAddress: textFrom(value.deliveryAddress),
    invoiceInfo: textFrom(value.invoiceInfo),
    source: value.source === "excel" ? "excel" : "handmatig",
    sourceSheet: textFrom(value.sourceSheet),
    entered: boolFrom(value.entered),
    productionDone: boolFrom(value.productionDone),
    packed: boolFrom(value.packed),
    delivered: boolFrom(value.delivered),
    cancelled: boolFrom(value.cancelled),
    productionDoneAt: textFrom(value.productionDoneAt),
    packedAt: textFrom(value.packedAt),
    deliveredAt: textFrom(value.deliveredAt),
    reminderEmailedAt: textFrom(value.reminderEmailedAt),
    reminderEmailError: textFrom(value.reminderEmailError),
    createdAt: textFrom(value.createdAt),
    updatedAt: textFrom(value.updatedAt),
  };
}

function getErrorMessage(data: unknown, fallback: string) {
  if (isRecord(data) && typeof data.message === "string") {
    return data.message;
  }

  return fallback;
}

async function requestJson<T>(
  url: string,
  options: RequestInit,
  fallbackMessage: string
) {
  const response = await fetch(url, options);
  const data = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) {
    throw new Error(getErrorMessage(data, fallbackMessage));
  }

  return data as T;
}

async function fetchOrders<T>(
  kind: OrderKind,
  year: string,
  normalize: (value: unknown) => T | null,
  search = ""
) {
  const url = new URL(ENDPOINTS[kind], window.location.origin);
  url.searchParams.set("year", year);
  if (search.trim()) url.searchParams.set("search", search.trim());

  const data = await requestJson<SinterklaasListResponse<unknown>>(
    url.toString(),
    { cache: "no-store" },
    "Sinterklaas bestellingen ophalen is mislukt."
  );

  return Array.isArray(data.orders)
    ? data.orders.flatMap((item) => {
        const order = normalize(item);
        return order ? [order] : [];
      })
    : [];
}

export function fetchLetterOrders(year: string, search = "") {
  return fetchOrders("letter", year, normalizeLetterOrder, search);
}

export function fetchB2BOrders(year: string, search = "") {
  return fetchOrders("b2b", year, normalizeB2BOrder, search);
}

export async function saveLetterOrder(
  order: Partial<ChocolateLetterOrder> & {
    customerName: string;
    lines: ChocolateLetterOrder["lines"];
  }
) {
  const data = await requestJson<unknown>(
    ENDPOINTS.letter,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(order),
    },
    "Chocoladeletter bestelling opslaan is mislukt."
  );
  const normalized = normalizeLetterOrder(data);
  if (!normalized) throw new Error("WordPress gaf geen geldige bestelling terug.");

  return normalized;
}

export async function updateLetterOrder(
  id: string,
  patch: Partial<ChocolateLetterOrder>
) {
  const url = new URL(ENDPOINTS.letter, window.location.origin);
  url.searchParams.set("id", id);
  const data = await requestJson<unknown>(
    url.toString(),
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...patch }),
    },
    "Chocoladeletter bestelling bijwerken is mislukt."
  );
  const normalized = normalizeLetterOrder(data);
  if (!normalized) throw new Error("WordPress gaf geen geldige bestelling terug.");

  return normalized;
}

export async function saveB2BOrder(
  order: Partial<SinterklaasB2BOrder> & {
    customerName: string;
    orderText: string;
  }
) {
  const data = await requestJson<unknown>(
    ENDPOINTS.b2b,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(order),
    },
    "B2B-bestelling opslaan is mislukt."
  );
  const normalized = normalizeB2BOrder(data);
  if (!normalized) throw new Error("WordPress gaf geen geldige B2B-bestelling terug.");

  return normalized;
}

export async function updateB2BOrder(id: string, patch: Partial<SinterklaasB2BOrder>) {
  const url = new URL(ENDPOINTS.b2b, window.location.origin);
  url.searchParams.set("id", id);
  const data = await requestJson<unknown>(
    url.toString(),
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...patch }),
    },
    "B2B-bestelling bijwerken is mislukt."
  );
  const normalized = normalizeB2BOrder(data);
  if (!normalized) throw new Error("WordPress gaf geen geldige B2B-bestelling terug.");

  return normalized;
}
