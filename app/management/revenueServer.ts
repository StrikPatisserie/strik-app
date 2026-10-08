import "server-only";

import { excelRevenueSeed } from "./revenueSeed";
import {
  createWeeklyRevenueRecordsFromDays,
  createRevenueCashKey,
  createRevenueDayKey,
  embedRevenueCashDataInNotes,
  mergeRevenueCashDeposits,
  mergeRevenueCashRecords,
  mergeRevenueDayRecords,
  mergeRevenueRecords,
  normalizeRevenueCashDeposit,
  normalizeRevenueCashRecord,
  normalizeRevenueDayRecord,
  normalizeRevenueData,
  type RevenueCashDeposit,
  type RevenueCashRecord,
  type RevenueDayRecord,
  type RevenueData,
  type RevenueShop,
} from "./revenueData";

const WORDPRESS_REVENUE_API_URL =
  "https://strik-patisserie.nl/wp-json/strik/v1/revenue";
const WORDPRESS_REVENUE_API_KEY =
  process.env.WORDPRESS_REVENUE_API_KEY ||
  process.env.WORDPRESS_STRIK_API_KEY ||
  "schoonmaak-ijs-strik";

export type RevenueStorageState = {
  status: "wordpress" | "seed";
  message?: string;
  wordpressStatus?: number;
};

function getWordPressRevenueUrl() {
  const url = new URL(WORDPRESS_REVENUE_API_URL);
  url.searchParams.set("key", WORDPRESS_REVENUE_API_KEY);

  return url;
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function readJson(response: Response) {
  return (await response.json().catch(() => null)) as unknown;
}

function getWordPressMessage(status: number) {
  if (status === 403) return "Geen toegang tot WordPress omzetopslag.";
  if (status === 404) return "WordPress omzetroute is nog niet beschikbaar.";
  if (status >= 500) return "WordPress omzetopslag geeft een serverfout.";

  return "WordPress omzetopslag is tijdelijk niet beschikbaar.";
}

async function fetchWordPressRevenueResponse() {
  const requestInit = {
    cache: "no-store",
    headers: {
      Accept: "application/json",
    },
  } as const;

  try {
    const response = await fetch(getWordPressRevenueUrl(), requestInit);
    if (response.status < 500) return response;
  } catch {
    // Retry below for short WordPress/network hiccups.
  }

  await wait(300);

  return fetch(getWordPressRevenueUrl(), requestInit);
}

export async function getStoredRevenueData(): Promise<{
  data: RevenueData;
  storage: RevenueStorageState;
}> {
  try {
    const response = await fetchWordPressRevenueResponse();
    const body = await readJson(response);

    if (response.ok) {
      return {
        data: normalizeRevenueData(body),
        storage: { status: "wordpress" },
      };
    }

    return {
      data: { records: [], dailyRecords: [], cashRecords: [], cashDeposits: [] },
      storage: {
        status: "seed",
        message: getWordPressMessage(response.status),
        wordpressStatus: response.status,
      },
    };
  } catch {
    return {
      data: { records: [], dailyRecords: [], cashRecords: [], cashDeposits: [] },
      storage: {
        status: "seed",
        message: "Kan geen verbinding maken met WordPress omzetopslag.",
      },
    };
  }
}

export async function getMergedRevenueData() {
  const stored = await getStoredRevenueData();
  const dailyWeekRecords = createWeeklyRevenueRecordsFromDays(
    stored.data.dailyRecords || []
  );
  const dailyWeekKeys = new Set(
    dailyWeekRecords.map(
      (record) => `${record.year}-W${record.week}-${record.shop}`
    )
  );
  const storedWeeklyFallbacks = (stored.data.records || []).filter(
    (record) =>
      !dailyWeekKeys.has(`${record.year}-W${record.week}-${record.shop}`)
  );
  const recordsWithDaily = mergeRevenueRecords(
    excelRevenueSeed,
    dailyWeekRecords
  );

  return {
    // The WordPress payload also contains technical weekly carrier rows for
    // cash deposits and older partial daily rollups. Once day records exist,
    // their fresh sum is authoritative; otherwise an old/zero carrier can
    // overwrite the actual weekly turnover shown on the dashboard.
    records: mergeRevenueRecords(recordsWithDaily, storedWeeklyFallbacks),
    dailyRecords: stored.data.dailyRecords || [],
    cashRecords: stored.data.cashRecords || [],
    cashDeposits: stored.data.cashDeposits || [],
    updatedAt: stored.data.updatedAt,
    storage: stored.storage,
    seedCount: excelRevenueSeed.length,
  };
}

export async function saveRevenueData(data: RevenueData) {
  const normalized = embedRevenueCashDataInNotes(normalizeRevenueData(data));
  const response = await fetch(getWordPressRevenueUrl(), {
    method: "PUT",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(normalized),
    cache: "no-store",
  });
  const body = await readJson(response);

  if (!response.ok) {
    return {
      ok: false as const,
      status: response.status,
      message: getWordPressMessage(response.status),
    };
  }

  return {
    ok: true as const,
    data: normalizeRevenueData(body),
  };
}

export async function upsertRevenueDayRecords(dayRecords: RevenueDayRecord[]) {
  const stored = await getStoredRevenueData();
  const normalizedDayRecords = dayRecords.flatMap((record) => {
    const normalized = normalizeRevenueDayRecord(record);
    return normalized ? [normalized] : [];
  });
  const unlockedDayRecords = normalizedDayRecords.filter(
    (record) => !isPatisserieDayImportLocked(stored.data, record)
  );
  const nextData = normalizeRevenueData({
    ...stored.data,
    dailyRecords: mergeRevenueDayRecords(
      stored.data.dailyRecords || [],
      unlockedDayRecords
    ),
  });

  return saveRevenueData(nextData);
}

export async function upsertRevenueCashRecords(cashRecords: RevenueCashRecord[]) {
  const stored = await getStoredRevenueData();
  const normalizedCashRecords = cashRecords.flatMap((record) => {
    const normalized = normalizeRevenueCashRecord(record);
    return normalized ? [normalized] : [];
  });
  const importableCashRecords = normalizedCashRecords.flatMap((record) => {
    const existing = (stored.data.cashRecords || []).find(
      (item) =>
        createRevenueCashKey(item.date, item.shop) ===
        createRevenueCashKey(record.date, record.shop)
    );
    const existingHasIceData = Boolean(
      existing &&
        (existing.cashImportKind === "ice" ||
          existing.iceCash !== undefined ||
          existing.iceStartCash !== undefined ||
          existing.iceCountedCash !== undefined ||
          existing.iceCashRevenue !== undefined ||
          existing.iceExpectedCash !== undefined)
    );

    if (record.cashImportKind !== "ice" || !existing || !existingHasIceData) {
      return isCashImportLocked(stored.data, record) ? [] : [record];
    }
    if (
      record.icePinRevenue === undefined &&
      record.iceTotalRevenue === undefined &&
      !(record.iceReceipts && record.iceReceipts > 0)
    ) {
      return [];
    }

    const icePinRevenue = existing.icePinRevenue ?? record.icePinRevenue;
    const iceTotalRevenue = existing.iceTotalRevenue ?? record.iceTotalRevenue;
    const iceReceipts =
      existing.iceReceipts && existing.iceReceipts > 0
        ? existing.iceReceipts
        : record.iceReceipts ?? existing.iceReceipts;
    const changed =
      icePinRevenue !== existing.icePinRevenue ||
      iceTotalRevenue !== existing.iceTotalRevenue ||
      iceReceipts !== existing.iceReceipts;

    if (!changed) return [];

    // Een bestaand ijsrecord is financieel leidend, óók als de week nog open is.
    // Herimport vult uitsluitend ontbrekende betaalvormen aan, zodat tellingen,
    // startgeld, kluisbedragen en handmatige correcties nooit teruggezet worden.
    return [
      {
        ...existing,
        icePinRevenue,
        iceTotalRevenue,
        iceReceipts,
        updatedAt: record.updatedAt || existing.updatedAt,
      },
    ];
  });
  const nextData = normalizeRevenueData({
    ...stored.data,
    cashRecords: mergeImportedRevenueCashRecords(
      stored.data.cashRecords || [],
      importableCashRecords
    ),
  });

  return saveRevenueData(nextData);
}

function findRevenueDeposit(
  data: RevenueData,
  year: number,
  week: number,
  shop: RevenueShop
) {
  return (data.cashDeposits || []).find(
    (deposit) =>
      deposit.year === year && deposit.week === week && deposit.shop === shop
  );
}

function isPatisserieDepositLocked(deposit: RevenueCashDeposit | undefined) {
  return Boolean(
    deposit &&
      (deposit.patisserieClosedAt ||
        deposit.closedAt ||
        deposit.patisserieCashbookBookedAt ||
        deposit.cashbookBookedAt)
  );
}

function isIceDepositLocked(deposit: RevenueCashDeposit | undefined) {
  return Boolean(
    deposit &&
      (deposit.iceDepositClosedAt ||
        deposit.closedAt ||
        deposit.iceCashbookBookedAt ||
        deposit.cashbookBookedAt)
  );
}

function isPatisserieDayImportLocked(
  data: RevenueData,
  record: RevenueDayRecord
) {
  const dayKey = createRevenueDayKey(record.date, record.shop);
  const cashKey = createRevenueCashKey(record.date, record.shop);
  const existingDayRecord = (data.dailyRecords || []).find(
    (item) => createRevenueDayKey(item.date, item.shop) === dayKey
  );
  const existingCashRecord = (data.cashRecords || []).find(
    (item) => createRevenueCashKey(item.date, item.shop) === cashKey
  );
  const deposit = findRevenueDeposit(data, record.year, record.week, record.shop);

  return Boolean(
    existingDayRecord?.shopClosed ||
      existingCashRecord?.checkedAt ||
      isPatisserieDepositLocked(deposit)
  );
}

function isCashImportLocked(data: RevenueData, record: RevenueCashRecord) {
  const key = createRevenueCashKey(record.date, record.shop);
  const existing = (data.cashRecords || []).find(
    (item) => createRevenueCashKey(item.date, item.shop) === key
  );
  const deposit = findRevenueDeposit(data, record.year, record.week, record.shop);

  return record.cashImportKind === "ice"
    ? Boolean(existing?.iceCheckedAt || isIceDepositLocked(deposit))
    : Boolean(existing?.checkedAt || isPatisserieDepositLocked(deposit));
}

function preservePositiveAmountWhenImportReadsZero(
  incoming: number | undefined,
  existing: number | undefined
) {
  if (incoming === 0 && existing !== undefined && existing > 0) {
    return existing;
  }

  return incoming;
}

function mergeImportedRevenueCashRecords(
  existingRecords: RevenueCashRecord[],
  incomingRecords: RevenueCashRecord[]
) {
  const merged = mergeRevenueCashRecords(existingRecords, incomingRecords);
  const existingByKey = new Map(
    existingRecords.map((record) => [
      createRevenueCashKey(record.date, record.shop),
      record,
    ])
  );
  const incomingByKey = new Map(
    incomingRecords.map((record) => [
      createRevenueCashKey(record.date, record.shop),
      record,
    ])
  );

  return merged.map((record) => {
    const key = createRevenueCashKey(record.date, record.shop);
    const existing = existingByKey.get(key);
    const incoming = incomingByKey.get(key);
    if (!existing || !incoming) return record;

    return {
      ...record,
      receipts: preservePositiveAmountWhenImportReadsZero(
        incoming.receipts,
        existing.receipts
      ),
      iceReceipts: preservePositiveAmountWhenImportReadsZero(
        incoming.iceReceipts,
        existing.iceReceipts
      ),
    };
  });
}

export async function upsertRevenueCashDeposits(
  cashDeposits: RevenueCashDeposit[]
) {
  const stored = await getStoredRevenueData();
  const normalizedCashDeposits = cashDeposits.flatMap((record) => {
    const normalized = normalizeRevenueCashDeposit(record);
    return normalized ? [normalized] : [];
  });
  const nextData = normalizeRevenueData({
    ...stored.data,
    cashDeposits: mergeRevenueCashDeposits(
      stored.data.cashDeposits || [],
      normalizedCashDeposits
    ),
  });

  return saveRevenueData(nextData);
}
