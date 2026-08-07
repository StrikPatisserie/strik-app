import "server-only";

import { excelRevenueSeed } from "./revenueSeed";
import {
  createWeeklyRevenueRecordsFromDays,
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
  const recordsWithDaily = mergeRevenueRecords(
    excelRevenueSeed,
    dailyWeekRecords
  );

  return {
    records: mergeRevenueRecords(recordsWithDaily, stored.data.records),
    dailyRecords: stored.data.dailyRecords || [],
    cashRecords: stored.data.cashRecords || [],
    cashDeposits: stored.data.cashDeposits || [],
    updatedAt: stored.data.updatedAt,
    storage: stored.storage,
    seedCount: excelRevenueSeed.length,
  };
}

export async function saveRevenueData(data: RevenueData) {
  const normalized = normalizeRevenueData(data);
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
  const nextData = normalizeRevenueData({
    ...stored.data,
    dailyRecords: mergeRevenueDayRecords(
      stored.data.dailyRecords || [],
      normalizedDayRecords
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
  const nextData = normalizeRevenueData({
    ...stored.data,
    cashRecords: mergeRevenueCashRecords(
      stored.data.cashRecords || [],
      normalizedCashRecords
    ),
  });

  return saveRevenueData(nextData);
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
