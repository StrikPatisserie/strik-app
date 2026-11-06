import "server-only";
import { canCorrectDay, correctDay, type DayCountInput } from "./patisserieDayCorrection";

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
  preserveArchivedCashDeposits,
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
    openDayCorrectionId: stored.data.cashRecords?.find(canCorrectDay)?.id,
  };
}

export async function saveRevenueData(data: RevenueData) {
  const stored = await getStoredRevenueData();
  if (stored.storage.status !== "wordpress") {
    return {
      ok: false as const,
      status: stored.storage.wordpressStatus || 502,
      message: "Bestaande stortingen konden niet worden gecontroleerd. Probeer opnieuw; er is niets overschreven.",
    };
  }
  const incoming = normalizeRevenueData(data);
  incoming.cashDeposits = preserveArchivedCashDeposits(incoming.cashDeposits || [], stored.data.cashDeposits || []);
  // An older open month or week view must not undo the completed day correction.
  const corrected = stored.data.cashRecords?.find(record =>
    record.checkedBy === "Management · dagcorrectie");
  if (corrected) {
    const rows = incoming.cashRecords ?? [];
    const stale = rows.find(row => row.id === corrected.id);
    if (!stale) rows.push(corrected);
    else Object.assign(stale, {
      cashRevenue: corrected.cashRevenue, cashOut: corrected.cashOut,
      startCash: corrected.startCash, countedCash: corrected.countedCash, expectedCash: corrected.expectedCash,
      difference: corrected.difference, safeCash: corrected.safeCash, safeDifference: corrected.safeDifference,
      note: corrected.note, checkedAt: corrected.checkedAt, checkedBy: corrected.checkedBy,
    });
    incoming.cashRecords = rows;
  }
  return writeRevenueData(incoming);
}

async function writeRevenueData(data: RevenueData) {
  return writeRevenuePayload(embedRevenueCashDataInNotes(data));
}

async function writeRevenuePayload(payload: unknown) {
  const response = await fetch(getWordPressRevenueUrl(), {
    method: "PUT",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
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

let dayCorrectionInProgress = false;

export async function savePatisserieDayCorrection(input: Partial<DayCountInput> & {
  shop?: unknown; date?: unknown; checkedAt?: unknown;
}) {
  if (typeof input.shop !== "string" || typeof input.date !== "string" || typeof input.checkedAt !== "string") {
    return { ok: false as const, status: 409, message: "Er staat geen dagcorrectie open voor deze telling." };
  }
  if (dayCorrectionInProgress) {
    return { ok: false as const, status: 409, message: "Deze dag wordt al opgeslagen." };
  }
  dayCorrectionInProgress = true;
  try {
    const response = await fetchWordPressRevenueResponse();
    const raw = await readJson(response) as {
      dailyRecords?: Record<string, unknown>[]; cashRecords?: Record<string, unknown>[];
      updatedAt?: string; records?: unknown[];
    } | null;
    if (!response.ok || !raw || !Array.isArray(raw.dailyRecords) || !Array.isArray(raw.records)) {
      return { ok: false as const, status: 502, message: "De actuele telling kon niet worden opgehaald." };
    }
    const data = normalizeRevenueData(raw);
    const rows = data.cashRecords || [];
    const record = rows.find(row => row.date === input.date && row.shop === input.shop);
    const deposit = record && findRevenueDeposit(data, record.year, record.week, record.shop);
    if (!record || !canCorrectDay(record) || input.checkedAt !== record.checkedAt ||
        !(deposit?.patisserieReportedAt || deposit?.patisserieCashbookBookedAt || deposit?.cashbookBookedAt)) {
      return { ok: false as const, status: 409, message: "De dag is al gesloten of gewijzigd. Vernieuw het overzicht." };
    }
    let corrected: RevenueCashRecord;
    try {
      corrected = correctDay(record, input, new Date().toISOString());
    } catch (error) {
      return { ok: false as const, status: 400, message: error instanceof Error ? error.message : "Controleer de bedragen." };
    }
    // Older WordPress versions store the count in the day's revenue note. Edit
    // just that carrier and (if present) the matching direct row, keeping every
    // other raw entry intact, including all weekly deposits.
    const isTarget = (row: Record<string, unknown>) => row.date === record.date && row.shop === record.shop;
    const days = raw.dailyRecords.filter(isTarget);
    const direct = raw.cashRecords?.filter(isTarget) ?? [];
    if (days.length !== 1 || direct.length > 1) {
      return { ok: false as const, status: 409, message: "De dag kon niet eenduidig worden teruggevonden." };
    }
    const day = normalizeRevenueDayRecord(days[0]);
    if (!day) return { ok: false as const, status: 409, message: "Het omzetrecord van deze dag ontbreekt." };
    const carrier = embedRevenueCashDataInNotes({
      records: [], dailyRecords: [day], cashRecords: [corrected],
    }).dailyRecords![0];
    const next = {
      ...raw,
      dailyRecords: raw.dailyRecords.map(row => isTarget(row) ? { ...row, note: carrier.note } : row),
      ...(direct.length ? { cashRecords: raw.cashRecords!.map(row => isTarget(row) ? { ...row,
        countedCash: corrected.countedCash, startCash: corrected.startCash, expectedCash: corrected.expectedCash,
        difference: corrected.difference, safeCash: corrected.safeCash, safeDifference: corrected.safeDifference,
        checkedAt: corrected.checkedAt, checkedBy: corrected.checkedBy, updatedAt: corrected.updatedAt, note: corrected.note,
      } : row) } : {}),
    };
    const latest = await fetchWordPressRevenueResponse();
    if (!latest.ok || JSON.stringify(await readJson(latest)) !== JSON.stringify(raw)) {
      return { ok: false as const, status: 409, message: "De kasgegevens zijn intussen veranderd. Vernieuw de dag en probeer opnieuw." };
    }
    const result = await writeRevenuePayload(next);
    if (!result.ok) return result;
    const stored = await getStoredRevenueData();
    const saved = stored.data.cashRecords?.find(row => row.id === record.id);
    const savedDeposit = stored.data.cashDeposits?.find(item => item.id === deposit.id);
    if (!saved || saved.checkedAt !== corrected.checkedAt || saved.safeCash !== corrected.safeCash ||
        saved.countedCash !== corrected.countedCash || saved.startCash !== corrected.startCash ||
        saved.cashRevenue !== record.cashRevenue || saved.cashOut !== record.cashOut || saved.note !== corrected.note ||
        JSON.stringify(savedDeposit) !== JSON.stringify(deposit)) {
      return { ok: false as const, status: 502, message: "De dag kon na opslaan niet worden bevestigd. Vernieuw het overzicht." };
    }
    return { ok: true as const, record: saved };
  } finally {
    dayCorrectionInProgress = false;
  }
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
      record.iceCashRevenue === undefined &&
      record.icePinRevenue === undefined &&
      record.iceTotalRevenue === undefined &&
      !(record.iceReceipts && record.iceReceipts > 0)
    ) {
      return [];
    }

    // A repair import may replace only the derived payment split. Counted
    // cash, start money, checked amounts, notes and closed-week state remain
    // sourced from the existing record below.
    const iceCashRevenue =
      record.iceCashRevenue ?? existing.iceCashRevenue;
    const icePinRevenue = record.icePinRevenue ?? existing.icePinRevenue;
    const iceTotalRevenue = record.iceTotalRevenue ?? existing.iceTotalRevenue;
    const iceReceipts = record.iceReceipts ?? existing.iceReceipts;
    const changed =
      iceCashRevenue !== existing.iceCashRevenue ||
      icePinRevenue !== existing.icePinRevenue ||
      iceTotalRevenue !== existing.iceTotalRevenue ||
      iceReceipts !== existing.iceReceipts;

    if (!changed) return [];

    // Een bestaand ijsrecord blijft financieel leidend voor de telling. Alleen
    // de betaalvormen worden door de herstelimport opnieuw afgeleid.
    return [
      {
        ...existing,
        iceCashRevenue,
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
