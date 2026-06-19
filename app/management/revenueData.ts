export type RevenueShop = "Heyendaal" | "Lent" | "Ziekerstraat" | "Daalseweg";

export type RevenueSource = "excel" | "manual";

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

export type RevenueData = {
  records: RevenueRecord[];
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

export function normalizeRevenueShop(value: unknown): RevenueShop | null {
  const normalized = textFrom(value)
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "");

  return shopAliases[normalized] || null;
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
    source: value.source === "excel" ? "excel" : "manual",
    updatedAt: textFrom(value.updatedAt) || undefined,
  };
}

export function normalizeRevenueData(value: unknown): RevenueData {
  if (!isRecord(value)) {
    return { records: [] };
  }

  const records = Array.isArray(value.records)
    ? value.records.flatMap((record) => {
        const normalized = normalizeRevenueRecord(record);
        return normalized ? [normalized] : [];
      })
    : [];

  return {
    records,
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
