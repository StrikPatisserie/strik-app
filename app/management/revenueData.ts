export type RevenueShop = "Heyendaal" | "Lent" | "Ziekerstraat" | "Daalseweg";

export type RevenueSource = "excel" | "manual" | "dagafsluiting";

export const cashDenominations = [
  { key: "eur500", label: "500", value: 500, kind: "note" },
  { key: "eur200", label: "200", value: 200, kind: "note" },
  { key: "eur100", label: "100", value: 100, kind: "note" },
  { key: "eur50", label: "50", value: 50, kind: "note" },
  { key: "eur20", label: "20", value: 20, kind: "note" },
  { key: "eur10", label: "10", value: 10, kind: "note" },
  { key: "eur5", label: "5", value: 5, kind: "note" },
  { key: "eur2", label: "2", value: 2, kind: "coin" },
  { key: "eur1", label: "1", value: 1, kind: "coin" },
  { key: "cent50", label: "0,50", value: 0.5, kind: "coin" },
  { key: "cent20", label: "0,20", value: 0.2, kind: "coin" },
  { key: "cent10", label: "0,10", value: 0.1, kind: "coin" },
  { key: "cent5", label: "0,05", value: 0.05, kind: "coin" },
  { key: "cent2", label: "0,02", value: 0.02, kind: "coin" },
  { key: "cent1", label: "0,01", value: 0.01, kind: "coin" },
] as const;

export type CashDenominationKey = (typeof cashDenominations)[number]["key"];

export type CashDenominationCounts = Partial<
  Record<CashDenominationKey, number>
>;

export type RevenueRecord = {
  id: string;
  year: number;
  week: number;
  shop: RevenueShop;
  amount: number;
  note?: string;
  source?: RevenueSource;
  updatedAt?: string;
};

export type RevenueDayRecord = {
  id: string;
  date: string;
  year: number;
  week: number;
  shop: RevenueShop;
  amount: number;
  note?: string;
  source?: Exclude<RevenueSource, "excel">;
  messageId?: string;
  importedAt?: string;
  updatedAt?: string;
};

export type RevenueCashRecord = {
  id: string;
  date: string;
  year: number;
  week: number;
  shop: RevenueShop;
  denominations: CashDenominationCounts;
  denominationTotal: number;
  countedCash: number;
  startCash?: number;
  cashRevenue?: number;
  expectedCash?: number;
  difference?: number;
  countedBy?: string;
  openedAt?: string;
  closedAt?: string;
  checkedAt?: string;
  checkedBy?: string;
  note?: string;
  source?: Exclude<RevenueSource, "excel">;
  messageId?: string;
  importedAt?: string;
  updatedAt?: string;
};

export type RevenueCashDeposit = {
  id: string;
  year: number;
  week: number;
  shop: RevenueShop;
  amount: number;
  dateFrom?: string;
  dateTo?: string;
  cashRecordIds: string[];
  depositedAt?: string;
  depositedBy?: string;
  note?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type RevenueData = {
  records: RevenueRecord[];
  dailyRecords?: RevenueDayRecord[];
  cashRecords?: RevenueCashRecord[];
  cashDeposits?: RevenueCashDeposit[];
  updatedAt?: string;
};

export const revenueShops: RevenueShop[] = [
  "Heyendaal",
  "Ziekerstraat",
  "Daalseweg",
  "Lent",
];

const cashRecordNotePrefix = "[[strik-cash-record:";
const cashDepositNotePrefix = "[[strik-cash-deposit:";
const cashNoteSuffix = "]]";

const shopAliases: Record<string, RevenueShop> = {
  heyendaal: "Heyendaal",
  heyendaalseweg: "Heyendaal",
  ziekerstraat: "Ziekerstraat",
  daalseweg: "Daalseweg",
  lent: "Lent",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function numberFrom(value: unknown) {
  const numberValue = Number(value);

  return Number.isFinite(numberValue) ? numberValue : 0;
}

function textFrom(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function cleanRevenueNote(value: unknown) {
  return stripEncodedRevenueCashNotes(textFrom(value));
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractEncodedRevenueNotePayloads(note: string, prefix: string) {
  const pattern = new RegExp(
    `${escapeRegExp(prefix)}([^\\]]+)${escapeRegExp(cashNoteSuffix)}`,
    "g"
  );
  const payloads: unknown[] = [];

  for (const match of note.matchAll(pattern)) {
    try {
      payloads.push(JSON.parse(decodeRevenueNotePayload(match[1] || "")));
    } catch {
      // Ignore unreadable legacy payloads and keep the visible note usable.
    }
  }

  return payloads;
}

function stripEncodedRevenueCashNotes(note: string) {
  const patterns = [cashRecordNotePrefix, cashDepositNotePrefix].map(
    (prefix) =>
      new RegExp(
        `\\s*${escapeRegExp(prefix)}[^\\]]+${escapeRegExp(cashNoteSuffix)}`,
        "g"
      )
  );

  return patterns.reduce((result, pattern) => result.replace(pattern, ""), note).trim();
}

function compactCashRecordPayload(record: RevenueCashRecord) {
  return {
    d: record.denominations,
    dt: record.denominationTotal,
    cc: record.countedCash,
    sc: record.startCash,
    cr: record.cashRevenue,
    ec: record.expectedCash,
    df: record.difference,
    cb: record.countedBy,
    oa: record.openedAt,
    ca: record.closedAt,
    cha: record.checkedAt,
    chb: record.checkedBy,
    n: record.note,
    s: record.source,
    m: record.messageId,
    ia: record.importedAt,
    ua: record.updatedAt,
  };
}

function expandCashRecordPayload(
  payload: unknown,
  date: string,
  shop: RevenueShop
): unknown {
  if (!isRecord(payload)) return null;

  return {
    date,
    shop,
    denominations: payload.denominations || payload.d,
    denominationTotal: payload.denominationTotal ?? payload.dt,
    countedCash: payload.countedCash ?? payload.cc,
    startCash: payload.startCash ?? payload.sc,
    cashRevenue: payload.cashRevenue ?? payload.cr,
    expectedCash: payload.expectedCash ?? payload.ec,
    difference: payload.difference ?? payload.df,
    countedBy: payload.countedBy ?? payload.cb,
    openedAt: payload.openedAt ?? payload.oa,
    closedAt: payload.closedAt ?? payload.ca,
    checkedAt: payload.checkedAt ?? payload.cha,
    checkedBy: payload.checkedBy ?? payload.chb,
    note: payload.note ?? payload.n,
    source: payload.source ?? payload.s,
    messageId: payload.messageId ?? payload.m,
    importedAt: payload.importedAt ?? payload.ia,
    updatedAt: payload.updatedAt ?? payload.ua,
  };
}

function compactCashDepositPayload(deposit: RevenueCashDeposit) {
  return {
    a: deposit.amount,
    df: deposit.dateFrom,
    dt: deposit.dateTo,
    ids: deposit.cashRecordIds,
    da: deposit.depositedAt,
    db: deposit.depositedBy,
    n: deposit.note,
    ca: deposit.createdAt,
    ua: deposit.updatedAt,
  };
}

function expandCashDepositPayload(
  payload: unknown,
  year: number,
  week: number,
  shop: RevenueShop
): unknown {
  if (!isRecord(payload)) return null;

  return {
    year,
    week,
    shop,
    amount: payload.amount ?? payload.a,
    dateFrom: payload.dateFrom ?? payload.df,
    dateTo: payload.dateTo ?? payload.dt,
    cashRecordIds: payload.cashRecordIds ?? payload.ids,
    depositedAt: payload.depositedAt ?? payload.da,
    depositedBy: payload.depositedBy ?? payload.db,
    note: payload.note ?? payload.n,
    createdAt: payload.createdAt ?? payload.ca,
    updatedAt: payload.updatedAt ?? payload.ua,
  };
}

function encodeRevenueNotePayload(payload: unknown) {
  const json = JSON.stringify(payload);

  if (typeof Buffer !== "undefined") {
    return Buffer.from(json, "utf8").toString("base64url");
  }

  const bytes = new TextEncoder().encode(json);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function decodeRevenueNotePayload(payload: string) {
  if (payload.includes("%")) {
    return decodeURIComponent(payload);
  }

  if (typeof Buffer !== "undefined") {
    return Buffer.from(payload, "base64url").toString("utf8");
  }

  const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(
    base64.length + ((4 - (base64.length % 4)) % 4),
    "="
  );
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));

  return new TextDecoder().decode(bytes);
}

function encodedRevenueNote(prefix: string, payload: unknown) {
  return `${prefix}${encodeRevenueNotePayload(payload)}${cashNoteSuffix}`;
}

function noteWithEncodedRevenueCashPayload(
  note: string | undefined,
  prefix: string,
  payload: unknown
) {
  return [stripEncodedRevenueCashNotes(note || ""), encodedRevenueNote(prefix, payload)]
    .filter(Boolean)
    .join("\n");
}

export function createRevenueKey(
  year: number,
  week: number,
  shop: RevenueShop
) {
  return `${year}-${String(week).padStart(2, "0")}-${shop.toLowerCase()}`;
}

export function createRevenueDayKey(date: string, shop: RevenueShop) {
  return `${date}-${shop.toLowerCase()}`;
}

export function createRevenueCashKey(date: string, shop: RevenueShop) {
  return `cash-${date}-${shop.toLowerCase()}`;
}

export function createRevenueCashDepositKey(
  year: number,
  week: number,
  shop: RevenueShop
) {
  return `cash-deposit-${year}-${String(week).padStart(2, "0")}-${shop.toLowerCase()}`;
}

function getIsoWeekYear(date: Date) {
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNumber = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - dayNumber);

  return target.getUTCFullYear();
}

function getIsoWeek(date: Date) {
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNumber = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - dayNumber);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));

  return Math.ceil(((target.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

function parseIsoDate(value: unknown) {
  const text = textFrom(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;

  const [year, month, day] = text.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
}

export function normalizeRevenueShop(value: unknown): RevenueShop | null {
  const normalized = textFrom(value)
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "");

  return shopAliases[normalized] || null;
}

function normalizeRevenueSource(value: unknown, fallback: RevenueSource) {
  const source = textFrom(value).toLowerCase();

  if (source === "excel") return "excel";
  if (["dagafsluiting", "dagomzet", "daily", "gmail"].includes(source)) {
    return "dagafsluiting";
  }

  return fallback;
}

function moneyFrom(value: unknown) {
  const amount = numberFrom(value);

  return Number(amount.toFixed(2));
}

function positiveMoneyFrom(value: unknown) {
  return Math.max(0, moneyFrom(value));
}

export function cashDenominationTotal(counts: CashDenominationCounts) {
  return Number(
    cashDenominations
      .reduce((total, denomination) => {
        const count = Math.max(0, Math.trunc(numberFrom(counts[denomination.key])));

        return total + count * denomination.value;
      }, 0)
      .toFixed(2)
  );
}

function normalizeCashDenominations(value: unknown): CashDenominationCounts {
  const source = isRecord(value) ? value : {};
  const counts: CashDenominationCounts = {};

  cashDenominations.forEach((denomination) => {
    const count = Math.max(
      0,
      Math.trunc(numberFrom((source as Record<string, unknown>)[denomination.key]))
    );
    if (count > 0) counts[denomination.key] = count;
  });

  return counts;
}

export function normalizeRevenueRecord(value: unknown): RevenueRecord | null {
  if (!isRecord(value)) return null;

  const year = Math.trunc(numberFrom(value.year));
  const week = Math.trunc(numberFrom(value.week));
  const shop = normalizeRevenueShop(value.shop);
  const amount = numberFrom(value.amount);

  if (year < 2020 || year > 2100 || week < 1 || week > 53 || !shop) {
    return null;
  }

  return {
    id: textFrom(value.id) || createRevenueKey(year, week, shop),
    year,
    week,
    shop,
    amount: Math.max(0, Number(amount.toFixed(2))),
    note: cleanRevenueNote(value.note),
    source: normalizeRevenueSource(value.source, "manual"),
    updatedAt: textFrom(value.updatedAt) || undefined,
  };
}

export function normalizeRevenueDayRecord(value: unknown): RevenueDayRecord | null {
  if (!isRecord(value)) return null;

  const date = parseIsoDate(value.date);
  const shop = normalizeRevenueShop(value.shop);
  const amount = numberFrom(value.amount);

  if (!date || !shop) return null;

  const year = getIsoWeekYear(date);
  const week = getIsoWeek(date);
  const dateKey = date.toISOString().slice(0, 10);
  const source = normalizeRevenueSource(value.source, "dagafsluiting");

  return {
    id: textFrom(value.id) || createRevenueDayKey(dateKey, shop),
    date: dateKey,
    year,
    week,
    shop,
    amount: Math.max(0, Number(amount.toFixed(2))),
    note: cleanRevenueNote(value.note),
    source:
      source === "excel"
        ? "dagafsluiting"
        : (source as Exclude<RevenueSource, "excel">),
    messageId: textFrom(value.messageId) || undefined,
    importedAt: textFrom(value.importedAt) || undefined,
    updatedAt: textFrom(value.updatedAt) || undefined,
  };
}

function extractEmbeddedCashRecords(value: unknown): RevenueCashRecord[] {
  if (!isRecord(value) || !Array.isArray(value.dailyRecords)) return [];

  return value.dailyRecords.flatMap((record) => {
    if (!isRecord(record)) return [];

    const date = parseIsoDate(record.date);
    const shop = normalizeRevenueShop(record.shop);
    if (!date || !shop) return [];

    const dateKey = date.toISOString().slice(0, 10);
    const payloads = extractEncodedRevenueNotePayloads(
      textFrom(record.note),
      cashRecordNotePrefix
    );

    return payloads.flatMap((payload) => {
      const normalized = normalizeRevenueCashRecord(
        expandCashRecordPayload(payload, dateKey, shop)
      );

      return normalized ? [normalized] : [];
    });
  });
}

function extractEmbeddedCashDeposits(value: unknown): RevenueCashDeposit[] {
  if (!isRecord(value) || !Array.isArray(value.records)) return [];

  return value.records.flatMap((record) => {
    if (!isRecord(record)) return [];

    const year = Math.trunc(numberFrom(record.year));
    const week = Math.trunc(numberFrom(record.week));
    const shop = normalizeRevenueShop(record.shop);
    if (year < 2020 || year > 2100 || week < 1 || week > 53 || !shop) {
      return [];
    }

    const payloads = extractEncodedRevenueNotePayloads(
      textFrom(record.note),
      cashDepositNotePrefix
    );

    return payloads.flatMap((payload) => {
      const normalized = normalizeRevenueCashDeposit(
        expandCashDepositPayload(payload, year, week, shop)
      );

      return normalized ? [normalized] : [];
    });
  });
}

export function normalizeRevenueCashRecord(
  value: unknown
): RevenueCashRecord | null {
  if (!isRecord(value)) return null;

  const date = parseIsoDate(value.date);
  const shop = normalizeRevenueShop(value.shop);
  if (!date || !shop) return null;

  const dateKey = date.toISOString().slice(0, 10);
  const year = getIsoWeekYear(date);
  const week = getIsoWeek(date);
  const denominations = normalizeCashDenominations(value.denominations);
  const denominationTotal =
    positiveMoneyFrom(value.denominationTotal) || cashDenominationTotal(denominations);
  const countedCash = positiveMoneyFrom(value.countedCash) || denominationTotal;
  const source = normalizeRevenueSource(value.source, "dagafsluiting");

  return {
    id: textFrom(value.id) || createRevenueCashKey(dateKey, shop),
    date: dateKey,
    year,
    week,
    shop,
    denominations,
    denominationTotal,
    countedCash,
    startCash:
      value.startCash === undefined ? undefined : positiveMoneyFrom(value.startCash),
    cashRevenue:
      value.cashRevenue === undefined
        ? undefined
        : positiveMoneyFrom(value.cashRevenue),
    expectedCash:
      value.expectedCash === undefined
        ? undefined
        : positiveMoneyFrom(value.expectedCash),
    difference:
      value.difference === undefined ? undefined : moneyFrom(value.difference),
    countedBy: textFrom(value.countedBy) || undefined,
    openedAt: textFrom(value.openedAt) || undefined,
    closedAt: textFrom(value.closedAt) || undefined,
    checkedAt: textFrom(value.checkedAt) || undefined,
    checkedBy: textFrom(value.checkedBy) || undefined,
    note: textFrom(value.note),
    source:
      source === "excel"
        ? "dagafsluiting"
        : (source as Exclude<RevenueSource, "excel">),
    messageId: textFrom(value.messageId) || undefined,
    importedAt: textFrom(value.importedAt) || undefined,
    updatedAt: textFrom(value.updatedAt) || undefined,
  };
}

export function normalizeRevenueCashDeposit(
  value: unknown
): RevenueCashDeposit | null {
  if (!isRecord(value)) return null;

  const year = Math.trunc(numberFrom(value.year));
  const week = Math.trunc(numberFrom(value.week));
  const shop = normalizeRevenueShop(value.shop);
  const amount = positiveMoneyFrom(value.amount);
  if (year < 2020 || year > 2100 || week < 1 || week > 53 || !shop) {
    return null;
  }

  const cashRecordIds = Array.isArray(value.cashRecordIds)
    ? value.cashRecordIds.map(textFrom).filter(Boolean).slice(0, 400)
    : [];

  return {
    id: textFrom(value.id) || createRevenueCashDepositKey(year, week, shop),
    year,
    week,
    shop,
    amount,
    dateFrom: parseIsoDate(value.dateFrom)?.toISOString().slice(0, 10),
    dateTo: parseIsoDate(value.dateTo)?.toISOString().slice(0, 10),
    cashRecordIds,
    depositedAt: textFrom(value.depositedAt) || undefined,
    depositedBy: textFrom(value.depositedBy) || undefined,
    note: textFrom(value.note),
    createdAt: textFrom(value.createdAt) || undefined,
    updatedAt: textFrom(value.updatedAt) || undefined,
  };
}

export function normalizeRevenueData(value: unknown): RevenueData {
  if (!isRecord(value)) {
    return { records: [], dailyRecords: [], cashRecords: [], cashDeposits: [] };
  }

  const records = Array.isArray(value.records)
    ? value.records.flatMap((record) => {
        const normalized = normalizeRevenueRecord(record);
        return normalized ? [normalized] : [];
      })
    : [];
  const dailyRecords = Array.isArray(value.dailyRecords)
    ? value.dailyRecords.flatMap((record) => {
        const normalized = normalizeRevenueDayRecord(record);
        return normalized ? [normalized] : [];
      })
    : [];
  const embeddedCashRecords = extractEmbeddedCashRecords(value);
  const directCashRecords = Array.isArray(value.cashRecords)
    ? value.cashRecords.flatMap((record) => {
        const normalized = normalizeRevenueCashRecord(record);
        return normalized ? [normalized] : [];
      })
    : [];
  const embeddedCashDeposits = extractEmbeddedCashDeposits(value);
  const directCashDeposits = Array.isArray(value.cashDeposits)
    ? value.cashDeposits.flatMap((record) => {
        const normalized = normalizeRevenueCashDeposit(record);
        return normalized ? [normalized] : [];
      })
    : [];

  return {
    records,
    dailyRecords,
    cashRecords: mergeRevenueCashRecords(embeddedCashRecords, directCashRecords),
    cashDeposits: mergeRevenueCashDeposits(
      embeddedCashDeposits,
      directCashDeposits
    ),
    updatedAt: textFrom(value.updatedAt) || undefined,
  };
}

export function embedRevenueCashDataInNotes(data: RevenueData): RevenueData {
  const cashRecordByKey = new Map(
    (data.cashRecords || []).map((record) => [
      createRevenueCashKey(record.date, record.shop),
      record,
    ])
  );
  const cashDepositByKey = new Map(
    (data.cashDeposits || []).map((deposit) => [
      createRevenueCashDepositKey(deposit.year, deposit.week, deposit.shop),
      deposit,
    ])
  );

  return {
    ...data,
    records: data.records.map((record) => {
      const deposit = cashDepositByKey.get(
        createRevenueCashDepositKey(record.year, record.week, record.shop)
      );

      if (!deposit) {
        return {
          ...record,
          note: stripEncodedRevenueCashNotes(record.note || ""),
        };
      }

      return {
        ...record,
        note: noteWithEncodedRevenueCashPayload(
          record.note,
          cashDepositNotePrefix,
          compactCashDepositPayload(deposit)
        ),
      };
    }),
    dailyRecords: (data.dailyRecords || []).map((record) => {
      const cashRecord = cashRecordByKey.get(
        createRevenueCashKey(record.date, record.shop)
      );

      if (!cashRecord) {
        return {
          ...record,
          note: stripEncodedRevenueCashNotes(record.note || ""),
        };
      }

      return {
        ...record,
        note: noteWithEncodedRevenueCashPayload(
          record.note,
          cashRecordNotePrefix,
          compactCashRecordPayload(cashRecord)
        ),
      };
    }),
  };
}

export function mergeRevenueRecords(
  baseRecords: RevenueRecord[],
  overrideRecords: RevenueRecord[]
) {
  const byKey = new Map<string, RevenueRecord>();

  for (const record of baseRecords) {
    byKey.set(createRevenueKey(record.year, record.week, record.shop), record);
  }

  for (const record of overrideRecords) {
    byKey.set(createRevenueKey(record.year, record.week, record.shop), {
      ...record,
      source: record.source || "manual",
    });
  }

  return [...byKey.values()].sort(
    (a, b) =>
      b.year - a.year ||
      b.week - a.week ||
      revenueShops.indexOf(a.shop) - revenueShops.indexOf(b.shop)
  );
}

export function mergeRevenueDayRecords(
  baseRecords: RevenueDayRecord[],
  overrideRecords: RevenueDayRecord[]
) {
  const byKey = new Map<string, RevenueDayRecord>();

  for (const record of baseRecords) {
    byKey.set(createRevenueDayKey(record.date, record.shop), record);
  }

  for (const record of overrideRecords) {
    byKey.set(createRevenueDayKey(record.date, record.shop), {
      ...record,
      source: record.source || "dagafsluiting",
    });
  }

  return [...byKey.values()].sort(
    (a, b) =>
      b.date.localeCompare(a.date) ||
      revenueShops.indexOf(a.shop) - revenueShops.indexOf(b.shop)
  );
}

export function mergeRevenueCashRecords(
  baseRecords: RevenueCashRecord[],
  overrideRecords: RevenueCashRecord[]
) {
  const byKey = new Map<string, RevenueCashRecord>();

  for (const record of baseRecords) {
    byKey.set(createRevenueCashKey(record.date, record.shop), record);
  }

  for (const record of overrideRecords) {
    const key = createRevenueCashKey(record.date, record.shop);
    const existing = byKey.get(key);

    byKey.set(key, {
      ...existing,
      ...record,
      checkedAt: record.checkedAt || existing?.checkedAt,
      checkedBy: record.checkedBy || existing?.checkedBy,
      note: record.note || existing?.note || "",
      source: record.source || existing?.source || "dagafsluiting",
    });
  }

  return [...byKey.values()].sort(
    (a, b) =>
      b.date.localeCompare(a.date) ||
      revenueShops.indexOf(a.shop) - revenueShops.indexOf(b.shop)
  );
}

export function mergeRevenueCashDeposits(
  baseRecords: RevenueCashDeposit[],
  overrideRecords: RevenueCashDeposit[]
) {
  const byKey = new Map<string, RevenueCashDeposit>();

  for (const record of baseRecords) {
    byKey.set(record.id, record);
  }
  for (const record of overrideRecords) {
    byKey.set(record.id, record);
  }

  return [...byKey.values()].sort(
    (a, b) =>
      b.year - a.year ||
      b.week - a.week ||
      revenueShops.indexOf(a.shop) - revenueShops.indexOf(b.shop)
  );
}

export function createWeeklyRevenueRecordsFromDays(
  dailyRecords: RevenueDayRecord[]
): RevenueRecord[] {
  const byKey = new Map<string, RevenueRecord & { dayCount: number }>();

  for (const dayRecord of dailyRecords) {
    if (dayRecord.amount <= 0) continue;

    const key = createRevenueKey(dayRecord.year, dayRecord.week, dayRecord.shop);
    const existing = byKey.get(key);

    if (existing) {
      existing.amount = Number((existing.amount + dayRecord.amount).toFixed(2));
      existing.dayCount += 1;
      if (dayRecord.note && !existing.note?.includes(dayRecord.note)) {
        existing.note = [existing.note, dayRecord.note].filter(Boolean).join(" · ");
      }
      if (
        dayRecord.updatedAt &&
        (!existing.updatedAt || dayRecord.updatedAt > existing.updatedAt)
      ) {
        existing.updatedAt = dayRecord.updatedAt;
      }
      continue;
    }

    byKey.set(key, {
      id: key,
      year: dayRecord.year,
      week: dayRecord.week,
      shop: dayRecord.shop,
      amount: dayRecord.amount,
      note: dayRecord.note || "",
      source: "dagafsluiting",
      updatedAt: dayRecord.updatedAt || dayRecord.importedAt,
      dayCount: 1,
    });
  }

  return [...byKey.values()].map(({ dayCount, note, ...record }) => ({
    ...record,
    note: [note, `${dayCount} dag${dayCount === 1 ? "" : "en"} automatisch`]
      .filter(Boolean)
      .join(" · "),
  }));
}

export function findRevenueRecord(
  records: RevenueRecord[],
  year: number,
  week: number,
  shop: RevenueShop
) {
  return records.find(
    (record) =>
      record.year === year && record.week === week && record.shop === shop
  );
}

export function findRevenueDayRecord(
  records: RevenueDayRecord[] | undefined,
  date: string,
  shop: RevenueShop
) {
  return (records || []).find(
    (record) => record.date === date && record.shop === shop
  );
}

export function getRevenueTotal(
  records: RevenueRecord[],
  year: number,
  week: number
) {
  return revenueShops.reduce((total, shop) => {
    const record = findRevenueRecord(records, year, week, shop);
    return total + (record?.amount || 0);
  }, 0);
}
