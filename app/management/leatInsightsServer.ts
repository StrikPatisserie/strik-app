import "server-only";

import type {
  LeatGiftcardInsight,
  LeatInsightsResponse,
  LeatPeriodInsight,
  LeatShopInsight,
} from "./leatInsightsTypes";

const LEAT_API_BASE_URL = "https://api.leat.com/api/v3/oauth/clients";
const LEAT_TIME_ZONE = "Europe/Amsterdam";
const MAX_PAGES = 100;

type LeatMeta = {
  total?: number;
  last_page?: number;
};

type LeatListResponse<T> = {
  data?: T[];
  meta?: LeatMeta;
  message?: string;
};

type LeatContact = {
  uuid?: string;
};

type LeatLoyaltyTransaction = {
  uuid?: string;
  credits?: number | string;
  created_at?: string;
  type?: string;
  contact?: {
    id?: number | string;
    uuid?: string;
  } | null;
  shop?: {
    uuid?: string;
    name?: string;
  } | null;
};

type LeatGiftcard = {
  uuid?: string;
  amount_in_cents?: number | string;
};

type MonthBounds = {
  from: string;
  until: string;
};

type LocalDateTimeParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

const shopLabelByUuid: Record<string, string> = {
  "fdb13e9c-4899-4317-b982-e7e40772307d": "Ziekerstraat",
  "7a63ece7-800b-4364-ba70-7dce0b270196": "Heyendaal",
  "a5433838-913b-44a1-9276-68774d7e4b8a": "Daalseweg",
  "60b6ff53-8e0f-4981-be88-b2d5df75ea1b": "Lent",
  "e084d540-de58-493f-8414-6a2ae1f09f25": "Heyendaal · ijs",
  "52b22680-fbb1-459a-adb1-a954dd64ee63": "Lent · ijs",
};

function getLeatApiKey() {
  return process.env.LEAT_API_TOKEN || process.env.LEAT_API_KEY || "";
}

function roundMoney(value: number) {
  return Number(value.toFixed(2));
}

function emptyPeriod(month: string): LeatPeriodInsight {
  return {
    month,
    registrations: 0,
    activeCustomers: 0,
    transactions: 0,
    creditsEarned: 0,
    creditsSpent: 0,
    rewardsRedeemed: 0,
    shops: [],
  };
}

function emptyGiftcards(): LeatGiftcardInsight {
  return {
    totalCards: 0,
    cardsWithBalance: 0,
    cardsWithoutBalance: 0,
    outstandingBalance: 0,
  };
}

function previousMonth(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, monthNumber - 2, 1));

  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(
    2,
    "0"
  )}`;
}

function localDateTimeParts(date: Date): LocalDateTimeParts {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: LEAT_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value || 0);

  return {
    year: value("year"),
    month: value("month"),
    day: value("day"),
    hour: value("hour"),
    minute: value("minute"),
    second: value("second"),
  };
}

function timeZoneOffsetMilliseconds(date: Date) {
  const part = new Intl.DateTimeFormat("en-US", {
    timeZone: LEAT_TIME_ZONE,
    timeZoneName: "longOffset",
  })
    .formatToParts(date)
    .find((item) => item.type === "timeZoneName")?.value;
  const match = part?.match(/GMT([+-])(\d{2}):(\d{2})/);
  if (!match) return 0;

  const sign = match[1] === "+" ? 1 : -1;
  return sign * (Number(match[2]) * 60 + Number(match[3])) * 60 * 1000;
}

function localMonthStartUtc(year: number, monthIndex: number) {
  const utcCandidate = new Date(Date.UTC(year, monthIndex, 1));
  return new Date(
    utcCandidate.getTime() - timeZoneOffsetMilliseconds(utcCandidate)
  );
}

function localDateTimeUtc(parts: LocalDateTimeParts) {
  const utcCandidate = new Date(
    Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second
    )
  );

  return new Date(
    utcCandidate.getTime() - timeZoneOffsetMilliseconds(utcCandidate)
  );
}

function monthBounds(month: string): MonthBounds {
  const [year, monthNumber] = month.split("-").map(Number);

  return {
    from: localMonthStartUtc(year, monthNumber - 1).toISOString(),
    until: localMonthStartUtc(year, monthNumber).toISOString(),
  };
}

function currentLocalMonth(now: Date) {
  const parts = localDateTimeParts(now);
  return `${parts.year}-${String(parts.month).padStart(2, "0")}`;
}

function previousMonthToDateBounds(month: string, now: Date): MonthBounds {
  const comparisonMonth = previousMonth(month);
  const [year, monthNumber] = comparisonMonth.split("-").map(Number);
  const nowParts = localDateTimeParts(now);
  const daysInComparisonMonth = new Date(
    Date.UTC(year, monthNumber, 0)
  ).getUTCDate();
  const until = localDateTimeUtc({
    year,
    month: monthNumber,
    day: Math.min(nowParts.day, daysInComparisonMonth),
    hour: nowParts.hour,
    minute: nowParts.minute,
    second: nowParts.second,
  });

  return {
    from: localMonthStartUtc(year, monthNumber - 1).toISOString(),
    until: until.toISOString(),
  };
}

async function fetchLeatPage<T>(input: {
  apiKey: string;
  path: string;
  page?: number;
  params?: Record<string, string>;
}) {
  const url = new URL(`${LEAT_API_BASE_URL}/${input.path}`);
  if (input.page) url.searchParams.set("page", String(input.page));
  Object.entries(input.params || {}).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${input.apiKey}`,
    },
    cache: "no-store",
  });
  const body = (await response.json().catch(() => null)) as
    | LeatListResponse<T>
    | null;

  if (!response.ok) {
    throw new Error(
      response.status === 401 || response.status === 403
        ? "De Leat API-sleutel heeft niet voldoende leesrechten."
        : "Leat is tijdelijk niet bereikbaar."
    );
  }

  return body || {};
}

async function fetchAllPages<T>(input: {
  apiKey: string;
  path: string;
  params?: Record<string, string>;
}) {
  const first = await fetchLeatPage<T>({
    ...input,
    page: 1,
  });
  const lastPage = Math.min(
    MAX_PAGES,
    Math.max(1, Number(first.meta?.last_page) || 1)
  );
  const otherPages = await Promise.all(
    Array.from({ length: lastPage - 1 }, (_, index) =>
      fetchLeatPage<T>({
        ...input,
        page: index + 2,
      })
    )
  );

  return [first, ...otherPages].flatMap((response) =>
    Array.isArray(response.data) ? response.data : []
  );
}

async function fetchContactCount(input: {
  apiKey: string;
  bounds?: MonthBounds;
}) {
  const response = await fetchLeatPage<LeatContact>({
    apiKey: input.apiKey,
    path: "contacts",
    page: 1,
    params: {
      limit: "1",
      ...(input.bounds
        ? {
            "created_at[gte]": input.bounds.from,
            "created_at[lt]": input.bounds.until,
          }
        : {}),
    },
  });

  return Math.max(0, Number(response.meta?.total) || 0);
}

function shopLabel(transaction: LeatLoyaltyTransaction) {
  const uuid = String(transaction.shop?.uuid || "");
  const mapped = shopLabelByUuid[uuid];
  if (mapped) return mapped;

  const name = String(transaction.shop?.name || "Onbekend verkooppunt");
  if (/webshop/i.test(name)) return "Webshop";

  return name.replace(/^Strik Patisserie\s*/i, "").trim() || name;
}

function aggregatePeriod(
  month: string,
  registrations: number,
  transactions: LeatLoyaltyTransaction[]
): LeatPeriodInsight {
  const customers = new Set<string>();
  const shops = new Map<
    string,
    LeatShopInsight & { customerIds: Set<string> }
  >();
  let creditsEarned = 0;
  let creditsSpent = 0;
  let rewardsRedeemed = 0;

  transactions.forEach((transaction) => {
    const credits = Number(transaction.credits) || 0;
    const contactId = String(
      transaction.contact?.uuid || transaction.contact?.id || ""
    );
    const label = shopLabel(transaction);
    const row = shops.get(label) || {
      shop: label,
      activeCustomers: 0,
      transactions: 0,
      creditsEarned: 0,
      creditsSpent: 0,
      rewardsRedeemed: 0,
      customerIds: new Set<string>(),
    };

    if (contactId) {
      customers.add(contactId);
      row.customerIds.add(contactId);
    }
    row.transactions += 1;
    if (credits > 0) row.creditsEarned += credits;
    if (credits < 0) row.creditsSpent += Math.abs(credits);
    if (transaction.type === "reward_reception") row.rewardsRedeemed += 1;
    shops.set(label, row);

    if (credits > 0) creditsEarned += credits;
    if (credits < 0) creditsSpent += Math.abs(credits);
    if (transaction.type === "reward_reception") rewardsRedeemed += 1;
  });

  return {
    month,
    registrations,
    activeCustomers: customers.size,
    transactions: transactions.length,
    creditsEarned,
    creditsSpent,
    rewardsRedeemed,
    shops: [...shops.values()]
      .map(({ customerIds, ...row }) => ({
        ...row,
        activeCustomers: customerIds.size,
      }))
      .sort((first, second) =>
        first.shop.localeCompare(second.shop, "nl")
      ),
  };
}

async function fetchPeriod(
  apiKey: string,
  month: string,
  bounds = monthBounds(month)
) {
  const [registrations, transactions] = await Promise.all([
    fetchContactCount({ apiKey, bounds }),
    fetchAllPages<LeatLoyaltyTransaction>({
      apiKey,
      path: "loyalty-transactions",
      params: {
        limit: "100",
        sort: "created_at",
        "created_at[gte]": bounds.from,
        "created_at[lt]": bounds.until,
      },
    }),
  ]);

  return aggregatePeriod(month, registrations, transactions);
}

async function fetchGiftcards(apiKey: string): Promise<LeatGiftcardInsight> {
  const cards = await fetchAllPages<LeatGiftcard>({
    apiKey,
    path: "giftcards",
  });
  let cardsWithBalance = 0;
  let outstandingBalanceCents = 0;

  cards.forEach((card) => {
    const balance = Number(card.amount_in_cents) || 0;
    if (balance > 0) {
      cardsWithBalance += 1;
      outstandingBalanceCents += balance;
    }
  });

  return {
    totalCards: cards.length,
    cardsWithBalance,
    cardsWithoutBalance: cards.length - cardsWithBalance,
    outstandingBalance: roundMoney(outstandingBalanceCents / 100),
  };
}

export async function checkLeatConnection() {
  const apiKey = getLeatApiKey();
  if (!apiKey) return false;

  try {
    await fetchContactCount({ apiKey });
    return true;
  } catch {
    return false;
  }
}

export async function getLeatInsights(
  month: string
): Promise<LeatInsightsResponse> {
  const comparisonMonth = previousMonth(month);
  const now = new Date();
  const comparisonMode =
    month === currentLocalMonth(now) ? "month-to-date" : "full-month";
  const apiKey = getLeatApiKey();
  if (!apiKey) {
    return {
      available: false,
      month,
      comparisonMode,
      totalContacts: 0,
      current: emptyPeriod(month),
      previous: emptyPeriod(comparisonMonth),
      giftcards: emptyGiftcards(),
      warning: "Leat API-sleutel ontbreekt.",
    };
  }

  try {
    const [totalContacts, current, previous, giftcards] = await Promise.all([
      fetchContactCount({ apiKey }),
      fetchPeriod(
        apiKey,
        month,
        comparisonMode === "month-to-date"
          ? { ...monthBounds(month), until: now.toISOString() }
          : monthBounds(month)
      ),
      fetchPeriod(
        apiKey,
        comparisonMonth,
        comparisonMode === "month-to-date"
          ? previousMonthToDateBounds(month, now)
          : monthBounds(comparisonMonth)
      ),
      fetchGiftcards(apiKey),
    ]);

    return {
      available: true,
      month,
      comparisonMode,
      totalContacts,
      current,
      previous,
      giftcards,
      syncedAt: new Date().toISOString(),
    };
  } catch (error) {
    return {
      available: false,
      month,
      comparisonMode,
      totalContacts: 0,
      current: emptyPeriod(month),
      previous: emptyPeriod(comparisonMonth),
      giftcards: emptyGiftcards(),
      warning:
        error instanceof Error
          ? error.message
          : "Leat-overzicht kon niet worden geladen.",
    };
  }
}
