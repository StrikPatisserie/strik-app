export type RevenueShop = "Heyendaal" | "Lent" | "Ziekerstraat" | "Daalseweg";

export type RevenueSource = "excel" | "manual" | "dagafsluiting";

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

export type RevenueData = {
  records: RevenueRecord[];
  dailyRecords?: RevenueDayRecord[];
  updatedAt?: string;
};

export const revenueShops: RevenueShop[] = [
  "Heyendaal",
  "Ziekerstraat",
  "Daalseweg",
  "Lent",
];

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
    note: textFrom(value.note),
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

export function normalizeRevenueData(value: unknown): RevenueData {
  if (!isRecord(value)) {
    return { records: [], dailyRecords: [] };
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

  return {
    records,
    dailyRecords,
    updatedAt: textFrom(value.updatedAt) || undefined,
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
