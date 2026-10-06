import "server-only";

import type { RevenueShop } from "./revenueData";
import type {
  LeatGiftcardChannel,
  LeatGiftcardControlResponse,
  LeatGiftcardDailyTotal,
  LeatUnmappedShopTotal,
} from "./leatGiftcardTypes";

const LEAT_API_BASE_URL = "https://api.leat.com/api/v3/oauth/clients";
const LEAT_TIME_ZONE = "Europe/Amsterdam";
const MAX_PAGES = 100;

type LeatTransaction = {
  uuid?: string;
  amount_in_cents?: number | string;
  created_at?: string;
  shop?: {
    uuid?: string;
    name?: string;
  } | null;
};

type LeatTransactionResponse = {
  data?: LeatTransaction[];
  meta?: {
    page?: number;
    last_page?: number;
  };
  message?: string;
};

type ShopMapping = {
  shop: RevenueShop;
  channel: LeatGiftcardChannel;
};

const shopMappingByUuid: Record<string, ShopMapping> = {
  // Patisserieën
  "fdb13e9c-4899-4317-b982-e7e40772307d": {
    shop: "Ziekerstraat",
    channel: "winkel",
  },
  "7a63ece7-800b-4364-ba70-7dce0b270196": {
    shop: "Heyendaal",
    channel: "winkel",
  },
  "a5433838-913b-44a1-9276-68774d7e4b8a": {
    shop: "Daalseweg",
    channel: "winkel",
  },
  "60b6ff53-8e0f-4981-be88-b2d5df75ea1b": {
    shop: "Lent",
    channel: "winkel",
  },
  // IJssalons die in Geld tellen onder dezelfde locatie vallen.
  "e084d540-de58-493f-8414-6a2ae1f09f25": {
    shop: "Heyendaal",
    channel: "ijs",
  },
  "52b22680-fbb1-459a-adb1-a954dd64ee63": {
    shop: "Lent",
    channel: "ijs",
  },
};

const localDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: LEAT_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function roundMoney(value: number) {
  return Number(value.toFixed(2));
}

function getLeatApiKey() {
  return process.env.LEAT_API_TOKEN || process.env.LEAT_API_KEY || "";
}

function monthRequestBounds(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const start = new Date(Date.UTC(year, monthNumber - 1, 1));
  const end = new Date(Date.UTC(year, monthNumber, 1));

  // Amsterdam can be one or two hours ahead of UTC. A padded request range
  // avoids losing transactions around midnight; the local-month filter below
  // remains authoritative.
  start.setUTCDate(start.getUTCDate() - 1);
  end.setUTCDate(end.getUTCDate() + 1);

  return {
    from: start.toISOString(),
    until: end.toISOString(),
  };
}

function localDate(value: string | undefined) {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";

  return localDateFormatter.format(parsed);
}

async function fetchTransactionPage(input: {
  apiKey: string;
  page: number;
  from: string;
  until: string;
}) {
  const url = new URL(`${LEAT_API_BASE_URL}/giftcard-transactions`);
  url.searchParams.set("perPage", "100");
  url.searchParams.set("page", String(input.page));
  url.searchParams.set("sort", "created_at");
  url.searchParams.set("created_at[gte]", input.from);
  url.searchParams.set("created_at[lt]", input.until);

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${input.apiKey}`,
    },
    cache: "no-store",
  });
  const body = (await response.json().catch(() => null)) as
    | LeatTransactionResponse
    | null;

  if (!response.ok) {
    throw new Error(
      response.status === 401 || response.status === 403
        ? "De Leat API-sleutel heeft geen toegang tot cadeaubontransacties."
        : "Leat is tijdelijk niet bereikbaar."
    );
  }

  return body || {};
}

async function fetchMonthTransactions(month: string, apiKey: string) {
  const bounds = monthRequestBounds(month);
  const transactions: LeatTransaction[] = [];

  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const response = await fetchTransactionPage({
      apiKey,
      page,
      from: bounds.from,
      until: bounds.until,
    });
    const pageTransactions = Array.isArray(response.data) ? response.data : [];
    transactions.push(...pageTransactions);

    const lastPage = Math.max(1, Number(response.meta?.last_page) || 1);
    if (page >= lastPage || pageTransactions.length === 0) break;
  }

  return transactions.filter((transaction) =>
    localDate(transaction.created_at).startsWith(month)
  );
}

function aggregateTransactions(
  month: string,
  transactions: LeatTransaction[]
): Pick<LeatGiftcardControlResponse, "daily" | "unmappedShops"> {
  const daily = new Map<string, LeatGiftcardDailyTotal>();
  const unmapped = new Map<string, LeatUnmappedShopTotal>();

  transactions.forEach((transaction) => {
    const cents = Number(transaction.amount_in_cents);
    const date = localDate(transaction.created_at);
    if (!Number.isFinite(cents) || !date.startsWith(month) || cents === 0) return;

    const amount = roundMoney(Math.abs(cents) / 100);
    const uuid = String(transaction.shop?.uuid || "onbekend");
    const name = String(transaction.shop?.name || "Onbekend Leat-verkooppunt");
    const mapping = shopMappingByUuid[uuid];

    if (!mapping) {
      const existing = unmapped.get(uuid) || {
        uuid,
        name,
        redeemed: 0,
        issued: 0,
        transactionCount: 0,
      };
      existing.transactionCount += 1;
      if (cents < 0) existing.redeemed = roundMoney(existing.redeemed + amount);
      if (cents > 0) existing.issued = roundMoney(existing.issued + amount);
      unmapped.set(uuid, existing);
      return;
    }

    const key = `${date}|${mapping.shop}|${mapping.channel}`;
    const existing = daily.get(key) || {
      date,
      shop: mapping.shop,
      channel: mapping.channel,
      redeemed: 0,
      issued: 0,
      redemptionCount: 0,
      issueCount: 0,
    };

    if (cents < 0) {
      existing.redeemed = roundMoney(existing.redeemed + amount);
      existing.redemptionCount += 1;
    }
    if (cents > 0) {
      existing.issued = roundMoney(existing.issued + amount);
      existing.issueCount += 1;
    }
    daily.set(key, existing);
  });

  return {
    daily: [...daily.values()].sort((first, second) =>
      `${first.date}|${first.shop}|${first.channel}`.localeCompare(
        `${second.date}|${second.shop}|${second.channel}`
      )
    ),
    unmappedShops: [...unmapped.values()].sort((first, second) =>
      first.name.localeCompare(second.name, "nl")
    ),
  };
}

export async function getLeatGiftcardControl(
  month: string
): Promise<LeatGiftcardControlResponse> {
  const apiKey = getLeatApiKey();
  if (!apiKey) {
    return {
      available: false,
      month,
      transactionCount: 0,
      daily: [],
      unmappedShops: [],
      warning: "Leat API-sleutel ontbreekt.",
    };
  }

  try {
    const transactions = await fetchMonthTransactions(month, apiKey);
    const totals = aggregateTransactions(month, transactions);

    return {
      available: true,
      month,
      syncedAt: new Date().toISOString(),
      transactionCount: transactions.length,
      ...totals,
    };
  } catch (error) {
    return {
      available: false,
      month,
      transactionCount: 0,
      daily: [],
      unmappedShops: [],
      warning:
        error instanceof Error
          ? error.message
          : "Leat-controle kon niet worden geladen.",
    };
  }
}
