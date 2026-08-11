"use client";

import { useEffect, useMemo, useState } from "react";
import {
  cashDenominations,
  createRevenueCashDepositKey,
  mergeRevenueCashDeposits,
  revenueShops,
  type CashDenominationCounts,
  type CashDenominationKey,
  type RevenueCashDeposit,
  type RevenueCashRecord,
  type RevenueData,
  type RevenueDayRecord,
  type RevenueRecord,
  type RevenueShop,
} from "@/app/management/revenueData";

type LoadState = "loading" | "ready" | "error" | "saving";

type RevenueResponse = RevenueData & {
  storage?: {
    status: "wordpress" | "seed";
    message?: string;
    wordpressStatus?: number;
  };
};

const euroFormatter = new Intl.NumberFormat("nl-NL", {
  currency: "EUR",
  style: "currency",
});

const banknoteDenominations = cashDenominations.filter(
  (denomination) =>
    denomination.kind === "note" &&
    denomination.value >= 5
);

function localIsoDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getIsoWeekYear(date: Date) {
  const target = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
  );
  const dayNumber = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - dayNumber);

  return target.getUTCFullYear();
}

function getIsoWeek(date: Date) {
  const target = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
  );
  const dayNumber = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - dayNumber);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));

  return Math.ceil(((target.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

function dateFromIso(value: string) {
  const [year, month, day] = value.split("-").map(Number);

  return new Date(year, month - 1, day);
}

function isoDateFromDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function startOfIsoWeek(date: Date) {
  const start = new Date(date);
  const dayNumber = start.getDay() || 7;
  start.setDate(start.getDate() - dayNumber + 1);
  start.setHours(0, 0, 0, 0);

  return start;
}

function dateFromIsoWeekParts(year: number, week: number) {
  const jan4 = new Date(year, 0, 4);
  const weekOneStart = startOfIsoWeek(jan4);
  const date = new Date(weekOneStart);
  date.setDate(weekOneStart.getDate() + (week - 1) * 7);

  return date;
}

function weekPartsForDate(value: string) {
  const date = dateFromIso(value);

  return {
    year: getIsoWeekYear(date),
    week: getIsoWeek(date),
  };
}

function weekKey(year: number, week: number) {
  return `${year}-W${String(week).padStart(2, "0")}`;
}

function parseWeekKey(value: string) {
  const match = value.match(/^(\d{4})-W(\d{1,2})$/);

  if (!match) return null;

  return {
    year: Number(match[1]),
    week: Number(match[2]),
  };
}

function weekRangeLabel(year: number, week: number) {
  const start = dateFromIsoWeekParts(year, week);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);

  return `${start.toLocaleDateString("nl-NL", {
    day: "2-digit",
    month: "2-digit",
  })} t/m ${end.toLocaleDateString("nl-NL", {
    day: "2-digit",
    month: "2-digit",
  })}`;
}

function datesInIsoWeek(year: number, week: number) {
  const start = dateFromIsoWeekParts(year, week);

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);

    return isoDateFromDate(date);
  });
}

function shiftedWeekDate(year: number, week: number, offset: number) {
  const date = dateFromIsoWeekParts(year, week);
  date.setDate(date.getDate() + offset * 7);

  return isoDateFromDate(date);
}

function parseAmount(value: string) {
  const normalized = value
    .replace(/[^0-9,.-]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const amount = Number(normalized);

  return Number.isFinite(amount) ? Math.max(0, Number(amount.toFixed(2))) : 0;
}

function parseCount(value: string) {
  const count = Number(value.replace(/[^0-9]/g, ""));

  return Number.isFinite(count) ? Math.max(0, Math.trunc(count)) : 0;
}

function formatAmountInput(value: number | undefined) {
  if (!value) return "";

  return value.toLocaleString("nl-NL", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  });
}

function formatMoney(value: number | undefined) {
  return euroFormatter.format(value || 0);
}

function formatOptionalMoney(value: number | undefined) {
  return value === undefined ? "-" : formatMoney(value);
}

function isDefaultCashNote(value: string | undefined) {
  return /^Geldtelling via Gmail\b/i.test(String(value || "").trim());
}

function visibleCashNote(value: string | undefined) {
  const note = String(value || "").trim();

  return isDefaultCashNote(note) ? "" : note;
}

function safeExpectedCash(record: RevenueCashRecord | undefined) {
  if (!record) return 0;

  if (record.startCash !== undefined) {
    return Math.max(
      0,
      Number(((record.countedCash || 0) - record.startCash).toFixed(2))
    );
  }

  return record.cashRevenue ?? record.countedCash ?? 0;
}

function safeCheckedCash(record: RevenueCashRecord | undefined) {
  if (!record) return 0;

  return record.safeCash ?? safeExpectedCash(record);
}

function safeDifference(record: RevenueCashRecord | undefined) {
  if (!record) return 0;

  return (
    record.safeDifference ??
    Number((safeCheckedCash(record) - safeExpectedCash(record)).toFixed(2))
  );
}

function cashNoteCount(record: RevenueCashRecord, key: CashDenominationKey) {
  return Math.max(0, Math.trunc(Number(record.denominations[key]) || 0));
}

function cashAdjustmentAmount(record: RevenueCashRecord) {
  if (
    record.startCash === undefined ||
    record.cashRevenue === undefined ||
    record.expectedCash === undefined
  ) {
    return undefined;
  }

  return Number(
    (record.startCash + record.cashRevenue - record.expectedCash).toFixed(2)
  );
}

function cashOutAmount(record: RevenueCashRecord) {
  if (record.cashOut !== undefined) return record.cashOut;

  return cashAdjustmentAmount(record);
}

function receiptAmount(record: RevenueCashRecord) {
  return record.receipts;
}

function iceCashAmount(record: RevenueCashRecord | undefined) {
  return record?.iceCash ?? 0;
}

function checkedCashNoteCount(record: RevenueCashRecord, key: CashDenominationKey) {
  return Math.max(
    0,
    Math.trunc(Number(record.checkedDenominations?.[key]) || 0)
  );
}

function cashNoteDraftKey(record: RevenueCashRecord, key: CashDenominationKey) {
  return `${record.date}:${record.shop}:${key}`;
}

function cashNoteInputValue(
  record: RevenueCashRecord,
  key: CashDenominationKey,
  drafts: Record<string, string>
) {
  const draft = drafts[cashNoteDraftKey(record, key)];
  if (draft !== undefined) return draft;

  if (record.checkedDenominations?.[key] !== undefined) {
    return String(checkedCashNoteCount(record, key));
  }

  return String(cashNoteCount(record, key));
}

function buildCheckedCashDenominations(
  record: RevenueCashRecord,
  drafts: Record<string, string>
) {
  const counts: CashDenominationCounts = {};

  banknoteDenominations.forEach((denomination) => {
    const count = parseCount(cashNoteInputValue(record, denomination.key, drafts));
    counts[denomination.key] = count;
  });

  return counts;
}

function cashNoteControlDifference(
  record: RevenueCashRecord,
  drafts: Record<string, string>
) {
  return Number(
    banknoteDenominations
      .reduce((total, denomination) => {
        const expected = cashNoteCount(record, denomination.key);
        const actual = parseCount(
          cashNoteInputValue(record, denomination.key, drafts)
        );

        return total + (actual - expected) * denomination.value;
      }, 0)
      .toFixed(2)
  );
}

function findCashRecord(
  records: RevenueCashRecord[],
  date: string,
  shop: RevenueShop
) {
  return records.find((record) => record.date === date && record.shop === shop);
}

function recordsForWeek(
  records: RevenueCashRecord[],
  year: number,
  week: number,
  shop: RevenueShop
) {
  return records.filter(
    (record) => record.year === year && record.week === week && record.shop === shop
  );
}

function sortCashRecords(records: RevenueCashRecord[]) {
  return [...records].sort(
    (a, b) =>
      b.date.localeCompare(a.date) ||
      revenueShops.indexOf(a.shop) - revenueShops.indexOf(b.shop)
  );
}

function existingDepositFor(
  deposits: RevenueCashDeposit[],
  year: number,
  week: number,
  shop: RevenueShop
) {
  return deposits.find(
    (deposit) =>
      deposit.year === year && deposit.week === week && deposit.shop === shop
  );
}

function dayName(value: string) {
  return dateFromIso(value).toLocaleDateString("nl-NL", {
    day: "2-digit",
    month: "2-digit",
    weekday: "short",
  });
}

function dayShortName(value: string) {
  return dateFromIso(value).toLocaleDateString("nl-NL", {
    weekday: "short",
  });
}

function isCashExpectedForShopDate(shop: RevenueShop, date: string) {
  return !(shop === "Daalseweg" && dateFromIso(date).getDay() === 0);
}

function cashWarning(record: RevenueCashRecord | undefined) {
  if (!record) return "Geen Cash-it dagafsluiting ontvangen.";
  if (Math.abs(record.countedCash - record.denominationTotal) > 0.01) {
    return "Cash-it coupures tellen niet op naar dagafsluiting.";
  }
  if (record.checkedAt && Math.abs(safeDifference(record)) > 0.01) {
    return "Kluis wijkt af van wat volgens Cash-it is weggelegd.";
  }
  if (record.difference !== undefined && Math.abs(record.difference) > 5) {
    return "Kasverschil in de dagafsluiting is groter dan EUR 5.";
  }

  return "";
}

export default function CashCountManager() {
  const [selectedDate, setSelectedDate] = useState(localIsoDate());
  const [selectedShop, setSelectedShop] = useState<RevenueShop>(revenueShops[0]);
  const [records, setRecords] = useState<RevenueRecord[]>([]);
  const [dailyRecords, setDailyRecords] = useState<RevenueDayRecord[]>([]);
  const [cashRecords, setCashRecords] = useState<RevenueCashRecord[]>([]);
  const [cashDeposits, setCashDeposits] = useState<RevenueCashDeposit[]>([]);
  const [safeCashDrafts, setSafeCashDrafts] = useState<Record<string, string>>({});
  const [cashNoteDrafts, setCashNoteDrafts] = useState<Record<string, string>>({});
  const [iceCashDrafts, setIceCashDrafts] = useState<Record<string, string>>({});
  const [depositDrafts, setDepositDrafts] = useState<Record<string, string>>({});
  const [depositNotes, setDepositNotes] = useState<Record<string, string>>({});
  const [state, setState] = useState<LoadState>("loading");
  const [mailState, setMailState] = useState<"idle" | "sending">("idle");
  const [status, setStatus] = useState("");
  const [storage, setStorage] = useState<RevenueResponse["storage"]>();

  useEffect(() => {
    let ignoreResult = false;

    async function loadRevenue() {
      setState("loading");

      try {
        const response = await fetch("/api/management-revenue", {
          cache: "no-store",
        });
        const data = (await response.json()) as RevenueResponse;

        if (!response.ok) {
          throw new Error(data?.storage?.message || "Gelddata ophalen is mislukt.");
        }
        if (ignoreResult) return;

        const nextCashRecords = Array.isArray(data.cashRecords)
          ? data.cashRecords
          : [];
        const latestDate =
          nextCashRecords
            .map((record) => record.date)
            .sort()
            .at(-1) || localIsoDate();
        const latestRecord = [...nextCashRecords].sort((first, second) =>
          first.date.localeCompare(second.date)
        ).at(-1);

        setRecords(Array.isArray(data.records) ? data.records : []);
        setDailyRecords(Array.isArray(data.dailyRecords) ? data.dailyRecords : []);
        setCashRecords(nextCashRecords);
        setCashDeposits(
          Array.isArray(data.cashDeposits) ? data.cashDeposits : []
        );
        setStorage(data.storage);
        setSelectedDate(latestDate);
        if (latestRecord) setSelectedShop(latestRecord.shop);
        setState("ready");
      } catch (error) {
        if (!ignoreResult) {
          setStatus(
            error instanceof Error
              ? error.message
              : "Gelddata ophalen is mislukt."
          );
          setState("error");
        }
      }
    }

    void loadRevenue();

    return () => {
      ignoreResult = true;
    };
  }, []);

  const selectedWeek = useMemo(() => weekPartsForDate(selectedDate), [selectedDate]);
  const depositWeekKey = weekKey(selectedWeek.year, selectedWeek.week);
  const selectedWeekDates = useMemo(
    () => datesInIsoWeek(selectedWeek.year, selectedWeek.week),
    [selectedWeek.week, selectedWeek.year]
  );
  const weekRows = useMemo(
    () =>
      revenueShops.map((shop) => {
        const shopRecords = recordsForWeek(
          cashRecords,
          selectedWeek.year,
          selectedWeek.week,
          shop
        ).sort((first, second) => first.date.localeCompare(second.date));
        const expectedDates = selectedWeekDates.filter(
          (date) =>
            isCashExpectedForShopDate(shop, date) ||
            Boolean(findCashRecord(shopRecords, date, shop))
        );
        const checkedRecords = expectedDates.flatMap((date) => {
          const record = findCashRecord(shopRecords, date, shop);

          return record?.checkedAt ? [record] : [];
        });
        const cashRevenue = shopRecords.reduce(
          (total, record) => total + (record.cashRevenue ?? record.countedCash),
          0
        );
        const expectedSafeCash = shopRecords.reduce(
          (total, record) => total + safeExpectedCash(record),
          0
        );
        const checkedSafeCash = shopRecords.reduce(
          (total, record) => total + safeCheckedCash(record),
          0
        );
        const includedCashRevenue = checkedRecords.reduce(
          (total, record) => total + (record.cashRevenue ?? record.countedCash),
          0
        );
        const includedExpectedSafeCash = checkedRecords.reduce(
          (total, record) => total + safeExpectedCash(record),
          0
        );
        const includedCheckedSafeCash = checkedRecords.reduce(
          (total, record) => total + safeCheckedCash(record),
          0
        );
        const difference = checkedRecords.reduce(
          (total, record) => total + safeDifference(record),
          0
        );
        const deposit = existingDepositFor(
          cashDeposits,
          selectedWeek.year,
          selectedWeek.week,
          shop
        );

        return {
          shop,
          records: shopRecords,
          cashRevenue,
          expectedSafeCash,
          checkedSafeCash,
          includedCashRevenue,
          includedExpectedSafeCash,
          includedCheckedSafeCash,
          difference,
          checkedCount: checkedRecords.length,
          expectedCount: expectedDates.length,
          missingCount: expectedDates.filter(
            (date) => !findCashRecord(shopRecords, date, shop)
          ).length,
          expectedDates,
          deposit,
        };
      }),
    [
      cashDeposits,
      cashRecords,
      selectedWeek.week,
      selectedWeek.year,
      selectedWeekDates,
    ]
  );
  const selectedShopRow =
    weekRows.find((row) => row.shop === selectedShop) || weekRows[0];
  const selectedShopDays = useMemo(
    () =>
      selectedWeekDates.map((date) => ({
        date,
        record: findCashRecord(cashRecords, date, selectedShop),
        isExpected: isCashExpectedForShopDate(selectedShop, date),
      })),
    [cashRecords, selectedShop, selectedWeekDates]
  );
  const selectedShopDay =
    selectedShopDays.find((day) => day.date === selectedDate) ||
    selectedShopDays[0];
  const selectedCashRecord = selectedShopDay?.record;
  const selectedCashWarning = cashWarning(selectedCashRecord);
  const selectedSafeDraftKey = selectedCashRecord
    ? `${selectedCashRecord.date}:${selectedCashRecord.shop}`
    : "";
  const selectedSafeInputValue = selectedCashRecord
    ? safeCashDrafts[selectedSafeDraftKey] ??
      formatAmountInput(safeCheckedCash(selectedCashRecord))
    : "";
  const selectedSafeDraftDifference = selectedCashRecord
    ? Number(
        (
          parseAmount(selectedSafeInputValue) -
          safeExpectedCash(selectedCashRecord)
        ).toFixed(2)
      )
    : 0;
  const selectedCashOut = selectedCashRecord
    ? cashOutAmount(selectedCashRecord)
    : undefined;
  const selectedReceipts = selectedCashRecord
    ? receiptAmount(selectedCashRecord)
    : undefined;
  const weekRecords = useMemo(
    () => weekRows.flatMap((row) => row.records),
    [weekRows]
  );
  const checkedWeekRecords = useMemo(
    () => weekRecords.filter((record) => record.checkedAt),
    [weekRecords]
  );
  const weekExpectedTotal = useMemo(
    () =>
      checkedWeekRecords.reduce(
        (total, record) => total + safeExpectedCash(record),
        0
      ),
    [checkedWeekRecords]
  );
  const weekCheckedTotal = useMemo(
    () =>
      checkedWeekRecords.reduce(
        (total, record) => total + safeCheckedCash(record),
        0
      ),
    [checkedWeekRecords]
  );
  const weekCheckedCount = weekRows.reduce(
    (total, row) => total + row.checkedCount,
    0
  );
  const weekExpectedCount = weekRows.reduce(
    (total, row) => total + row.expectedCount,
    0
  );
  const weekMissingCount = weekRows.reduce(
    (total, row) => total + row.missingCount,
    0
  );
  const isSelectedWeekComplete =
    weekExpectedCount > 0 &&
    weekMissingCount === 0 &&
    weekRows.every((row) => row.checkedCount >= row.expectedCount);
  const availableWeeks = useMemo(() => {
    const byKey = new Map<string, { key: string; year: number; week: number }>();

    cashRecords.forEach((record) => {
      const key = weekKey(record.year, record.week);
      byKey.set(key, {
        key,
        year: record.year,
        week: record.week,
      });
    });
    if (!byKey.has(depositWeekKey)) {
      byKey.set(depositWeekKey, {
        key: depositWeekKey,
        year: selectedWeek.year,
        week: selectedWeek.week,
      });
    }

    return [...byKey.values()].sort(
      (first, second) => second.year - first.year || second.week - first.week
    );
  }, [cashRecords, depositWeekKey, selectedWeek.week, selectedWeek.year]);

  function buildUpdatedCashRecords(
    current: RevenueCashRecord[],
    date: string,
    shop: RevenueShop,
    updater: (record: RevenueCashRecord) => RevenueCashRecord
  ) {
    const existing = findCashRecord(current, date, shop);
    if (!existing) return current;

    const updated = updater(existing);

    return sortCashRecords(
      current.map((record) => (record.id === updated.id ? updated : record))
    );
  }

  function updateCashRecord(
    date: string,
    shop: RevenueShop,
    updater: (record: RevenueCashRecord) => RevenueCashRecord
  ) {
    setCashRecords((current) =>
      buildUpdatedCashRecords(current, date, shop, updater)
    );
  }

  async function markChecked(record: RevenueCashRecord) {
    const key = `${record.date}:${record.shop}`;
    const now = new Date().toISOString();
    const nextCashRecords = buildUpdatedCashRecords(
      cashRecords,
      record.date,
      record.shop,
      (current) => {
        const safeCash = parseAmount(
          safeCashDrafts[key] || formatAmountInput(safeCheckedCash(current))
        );

        return {
          ...current,
          safeCash,
          safeDifference: Number((safeCash - safeExpectedCash(current)).toFixed(2)),
          iceCash: parseAmount(
            iceCashDrafts[key] || formatAmountInput(iceCashAmount(current))
          ),
          checkedDenominations: buildCheckedCashDenominations(
            current,
            cashNoteDrafts
          ),
          checkedAt: now,
          checkedBy: "Geld teller",
          note: visibleCashNote(current.note),
          updatedAt: now,
        };
      }
    );

    setCashRecords(nextCashRecords);
    await saveCash(cashDeposits, nextCashRecords);
  }

  async function unmarkChecked(record: RevenueCashRecord) {
    const now = new Date().toISOString();
    const nextCashRecords = buildUpdatedCashRecords(
      cashRecords,
      record.date,
      record.shop,
      (current) => ({
        ...current,
        checkedAt: undefined,
        checkedBy: undefined,
        updatedAt: now,
      })
    );

    setCashRecords(nextCashRecords);
    await saveCash(cashDeposits, nextCashRecords);
  }

  async function toggleChecked(record: RevenueCashRecord) {
    if (record.checkedAt) {
      await unmarkChecked(record);
      return;
    }

    await markChecked(record);
  }

  function cashRecordDraftKey(record: RevenueCashRecord) {
    return `${record.date}:${record.shop}`;
  }

  function iceCashInputValue(record: RevenueCashRecord) {
    return (
      iceCashDrafts[cashRecordDraftKey(record)] ??
      formatAmountInput(iceCashAmount(record))
    );
  }

  function applyIceCashDrafts(sourceRecords = cashRecords) {
    const now = new Date().toISOString();

    return sourceRecords.map((record) => {
      const key = cashRecordDraftKey(record);
      if (!Object.prototype.hasOwnProperty.call(iceCashDrafts, key)) {
        return record;
      }

      return {
        ...record,
        iceCash: parseAmount(iceCashDrafts[key] || "0"),
        updatedAt: now,
      };
    });
  }

  async function saveIceCash(record: RevenueCashRecord) {
    const key = cashRecordDraftKey(record);
    const now = new Date().toISOString();
    const nextCashRecords = buildUpdatedCashRecords(
      cashRecords,
      record.date,
      record.shop,
      (current) => ({
        ...current,
        iceCash: parseAmount(
          iceCashDrafts[key] ?? formatAmountInput(iceCashAmount(current))
        ),
        updatedAt: now,
      })
    );

    setCashRecords(nextCashRecords);
    await saveCash(cashDeposits, nextCashRecords);
  }

  async function saveCash(
    nextDeposits = cashDeposits,
    nextCashRecords = cashRecords
  ) {
    const cleanedCashRecords = nextCashRecords.map((record) => ({
      ...record,
      note: visibleCashNote(record.note),
    }));

    setState("saving");
    setStatus("Geldcontrole opslaan...");

    try {
      const response = await fetch("/api/management-revenue", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          records,
          dailyRecords,
          cashRecords: cleanedCashRecords,
          cashDeposits: nextDeposits,
        }),
      });
      const data = (await response.json().catch(() => null)) as
        | RevenueResponse
        | { message?: string }
        | null;

      if (!response.ok || !data || !("records" in data)) {
        throw new Error(
          (data && "message" in data && data.message) ||
            "Geldcontrole opslaan is mislukt."
        );
      }

      setRecords(Array.isArray(data.records) ? data.records : records);
      setDailyRecords(
        Array.isArray(data.dailyRecords) ? data.dailyRecords : dailyRecords
      );
      setCashRecords(
        Array.isArray(data.cashRecords) ? data.cashRecords : cleanedCashRecords
      );
      setCashDeposits(
        Array.isArray(data.cashDeposits) ? data.cashDeposits : nextDeposits
      );
      setStorage(data.storage);
      setStatus("Geldcontrole opgeslagen.");
      setState("ready");
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Geldcontrole opslaan is mislukt."
      );
      setState("ready");
    }
  }

  async function saveDeposit(row: (typeof weekRows)[number]) {
    const now = new Date().toISOString();
    const draftKey = `${depositWeekKey}:${row.shop}`;
    const amount = parseAmount(
      depositDrafts[draftKey] ??
        formatAmountInput(row.deposit?.amount || row.includedCheckedSafeCash)
    );
    const checkedRecords = row.records.filter((record) => record.checkedAt);
    const dateRange = checkedRecords.map((record) => record.date).sort();
    const deposit: RevenueCashDeposit = {
      id: createRevenueCashDepositKey(selectedWeek.year, selectedWeek.week, row.shop),
      year: selectedWeek.year,
      week: selectedWeek.week,
      shop: row.shop,
      amount,
      dateFrom: dateRange[0],
      dateTo: dateRange.at(-1),
      cashRecordIds: checkedRecords.map((record) => record.id),
      depositedAt: now,
      depositedBy: "Strik app",
      note: depositNotes[draftKey] || row.deposit?.note || "",
      createdAt: row.deposit?.createdAt || now,
      updatedAt: now,
    };
    const nextDeposits = mergeRevenueCashDeposits(
      cashDeposits.filter((item) => item.id !== deposit.id),
      [deposit]
    );

    setCashDeposits(nextDeposits);
    await saveCash(nextDeposits);
  }

  function buildWeekCashDeposits(sourceRecords = cashRecords) {
    const now = new Date().toISOString();
    const weekShops = new Set(weekRows.map((row) => row.shop));
    const deposits = weekRows.map((row) => {
      const shopRecords = recordsForWeek(
        sourceRecords,
        selectedWeek.year,
        selectedWeek.week,
        row.shop
      );
      const checkedRecords = row.expectedDates.flatMap((date) => {
        const record = findCashRecord(shopRecords, date, row.shop);

        return record?.checkedAt ? [record] : [];
      });
      const checkedSafeCash = checkedRecords.reduce(
        (total, record) => total + safeCheckedCash(record),
        0
      );
      const dateRange = checkedRecords.map((record) => record.date).sort();
      const draftKey = `${depositWeekKey}:${row.shop}`;
      const amount = parseAmount(
        depositDrafts[draftKey] ??
          formatAmountInput(row.deposit?.amount || checkedSafeCash)
      );

      return {
        id: createRevenueCashDepositKey(selectedWeek.year, selectedWeek.week, row.shop),
        year: selectedWeek.year,
        week: selectedWeek.week,
        shop: row.shop,
        amount,
        dateFrom: dateRange[0],
        dateTo: dateRange.at(-1),
        cashRecordIds: checkedRecords.map((record) => record.id),
        depositedAt: row.deposit?.depositedAt || now,
        depositedBy: row.deposit?.depositedBy || "Strik app",
        note: depositNotes[draftKey] || row.deposit?.note || "",
        createdAt: row.deposit?.createdAt || now,
        updatedAt: now,
      } satisfies RevenueCashDeposit;
    });

    return mergeRevenueCashDeposits(
      cashDeposits.filter(
        (item) =>
          item.year !== selectedWeek.year ||
          item.week !== selectedWeek.week ||
          !weekShops.has(item.shop)
      ),
      deposits
    );
  }

  function buildWeekDepositMailRows(
    sourceRecords = cashRecords,
    sourceDeposits = cashDeposits
  ) {
    return weekRows.map((row) => {
      const shopRecords = recordsForWeek(
        sourceRecords,
        selectedWeek.year,
        selectedWeek.week,
        row.shop
      );
      const checkedRecords = row.expectedDates.flatMap((date) => {
        const record = findCashRecord(shopRecords, date, row.shop);

        return record?.checkedAt ? [record] : [];
      });
      const depositDraftKey = `${depositWeekKey}:${row.shop}`;
      const expectedSafeCash = checkedRecords.reduce(
        (total, record) => total + safeExpectedCash(record),
        0
      );
      const checkedSafeCash = checkedRecords.reduce(
        (total, record) => total + safeCheckedCash(record),
        0
      );
      const iceCash = checkedRecords.reduce(
        (total, record) =>
          total +
          parseAmount(
            iceCashDrafts[cashRecordDraftKey(record)] ??
              formatAmountInput(iceCashAmount(record))
          ),
        0
      );
      const cashRevenue = checkedRecords.reduce(
        (total, record) => total + (record.cashRevenue ?? record.countedCash),
        0
      );
      const difference = checkedRecords.reduce(
        (total, record) => total + safeDifference(record),
        0
      );
      const sourceDeposit =
        sourceDeposits.find(
          (deposit) =>
            deposit.year === selectedWeek.year &&
            deposit.week === selectedWeek.week &&
            deposit.shop === row.shop
        ) || row.deposit;
      const depositAmount = parseAmount(
        depositDrafts[depositDraftKey] ??
          formatAmountInput(sourceDeposit?.amount || checkedSafeCash)
      );

      return {
        shop: row.shop,
        expectedCount: row.expectedCount,
        checkedCount: checkedRecords.length,
        missingCount: row.missingCount,
        cashRevenue,
        expectedSafeCash,
        checkedSafeCash,
        difference,
        iceCash,
        depositAmount,
        depositNote: depositNotes[depositDraftKey] || sourceDeposit?.note || "",
        days: row.expectedDates.map((date) => {
          const record = findCashRecord(shopRecords, date, row.shop);

          return {
            date,
            checked: Boolean(record?.checkedAt),
            safeCash: record ? safeCheckedCash(record) : 0,
            iceCash: record
              ? parseAmount(
                  iceCashDrafts[cashRecordDraftKey(record)] ??
                    formatAmountInput(iceCashAmount(record))
                )
              : 0,
          };
        }),
      };
    });
  }

  async function sendWeekDepositMail() {
    if (!isSelectedWeekComplete) {
      setStatus("Weekstorting kan pas worden gemaild als alle verwachte dagen compleet zijn.");
      return;
    }

    const nextCashRecords = applyIceCashDrafts();
    const nextDeposits = buildWeekCashDeposits(nextCashRecords);
    setCashRecords(nextCashRecords);
    setCashDeposits(nextDeposits);
    setMailState("sending");

    try {
      await saveCash(nextDeposits, nextCashRecords);

      const response = await fetch("/api/management-revenue/cash-deposit-mail", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          year: selectedWeek.year,
          week: selectedWeek.week,
          weekLabel: weekRangeLabel(selectedWeek.year, selectedWeek.week),
          rows: buildWeekDepositMailRows(nextCashRecords, nextDeposits),
        }),
      });
      const data = (await response.json().catch(() => null)) as
        | { message?: string }
        | null;

      if (!response.ok) {
        throw new Error(data?.message || "Weekstorting mailen is mislukt.");
      }

      setStatus(data?.message || "Weekstorting naar administratie gemaild.");
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : "Weekstorting mailen is mislukt."
      );
    } finally {
      setMailState("idle");
    }
  }

  const selectedDepositDraftKey = selectedShopRow
    ? `${depositWeekKey}:${selectedShopRow.shop}`
    : "";

  return (
    <div className="space-y-2">
      <section className="rounded-md border border-[#d9d2c9] bg-white p-2 shadow-sm">
        <div className="grid gap-1.5 lg:grid-cols-[minmax(13rem,18rem)_minmax(0,1fr)_auto] lg:items-end">
          <label className="grid gap-0.5 text-[0.54rem] font-black uppercase tracking-normal text-[#8b8278]">
            Week
            <select
              value={depositWeekKey}
              onChange={(event) => {
                const parts = parseWeekKey(event.target.value);
                if (!parts) return;

                setSelectedDate(
                  isoDateFromDate(dateFromIsoWeekParts(parts.year, parts.week))
                );
              }}
              className="h-8 rounded-md border border-[#d9d2c9] bg-white px-2 text-xs font-black normal-case tracking-normal text-[#1a1815]"
            >
              {availableWeeks.map((week) => (
                <option key={week.key} value={week.key}>
                  Week {week.week} - {weekRangeLabel(week.year, week.week)}
                </option>
              ))}
            </select>
          </label>

          <div className="flex h-8 min-w-0 items-center justify-center gap-3 rounded-md border border-[#e7e0d8] bg-white px-2 text-xs font-black text-[#1a1815]">
            <span>{weekCheckedCount}/{weekExpectedCount}</span>
            <span className="hidden text-[#8b8278] sm:inline">
              verw. {formatMoney(weekExpectedTotal)}
            </span>
            <span>{formatMoney(weekCheckedTotal)}</span>
          </div>

          <div className="grid grid-cols-4 gap-1">
            <button
              type="button"
              onClick={() =>
                setSelectedDate(
                  shiftedWeekDate(selectedWeek.year, selectedWeek.week, -1)
                )
              }
              title="Vorige week"
              className="h-8 rounded-md border border-[#d9d2c9] bg-white px-2 text-sm font-black text-[#1a1815]"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={() => setSelectedDate(localIsoDate())}
              className="h-8 rounded-md border border-[#d9d2c9] bg-white px-2 text-[0.6rem] font-black uppercase tracking-normal text-[#1a1815]"
            >
              Nu
            </button>
            <button
              type="button"
              onClick={() =>
                setSelectedDate(
                  shiftedWeekDate(selectedWeek.year, selectedWeek.week, 1)
                )
              }
              title="Volgende week"
              className="h-8 rounded-md border border-[#d9d2c9] bg-white px-2 text-sm font-black text-[#1a1815]"
            >
              ›
            </button>
            <button
              type="button"
              onClick={() => void sendWeekDepositMail()}
              aria-label="Mail weekstorting naar administratie"
              disabled={
                !isSelectedWeekComplete ||
                state === "saving" ||
                mailState === "sending"
              }
              title={
                isSelectedWeekComplete
                  ? "Mail weekstorting naar administratie"
                  : "Alle verwachte dagen eerst afvinken"
              }
              className="flex h-8 items-center justify-center rounded-md border border-[#1a1815] bg-[#1a1815] px-2 text-white disabled:border-[#d9d2c9] disabled:bg-white disabled:text-[#8b8278] disabled:opacity-60"
            >
              <MailIcon />
            </button>
          </div>
        </div>

        <div className="mt-2 grid overflow-hidden rounded-md border border-[#e7e0d8] sm:grid-cols-2 xl:grid-cols-4">
          {weekRows.map((row) => {
            const isSelected = row.shop === selectedShop;

            return (
              <button
                key={row.shop}
                type="button"
                onClick={() => setSelectedShop(row.shop)}
                className={`flex min-h-10 items-center justify-between gap-2 border-b border-[#e7e0d8] px-2 py-1.5 text-left transition last:border-b-0 sm:border-r sm:last:border-r-0 xl:border-b-0 ${
                  isSelected
                    ? "bg-[#1a1815] text-white"
                    : "bg-white text-[#1a1815] hover:bg-[#f8f6f3]"
                }`}
              >
                <span className="truncate text-sm font-black">{row.shop}</span>
                <span
                  className={`shrink-0 text-xs font-black ${
                    isSelected ? "text-white/70" : "text-[#8b8278]"
                  }`}
                >
                  {row.checkedCount}/{row.expectedCount} · {formatMoney(row.includedCheckedSafeCash)}
                </span>
              </button>
            );
          })}
        </div>

        {storage?.status === "seed" && (
          <p className="mt-2 rounded-md border border-[#f3d4a4] bg-[#fef9f3] px-2 py-1.5 text-xs font-bold text-[#7a5417]">
            {storage.message} Nieuwe geldcontroles worden pas blijvend opgeslagen
            zodra de WordPress omzet-snippet actief is.
          </p>
        )}

        {status && (
          <p className="mt-2 rounded-md bg-[#f8f6f3] px-2 py-1.5 text-xs font-bold text-[#6b645b]">
            {status}
          </p>
        )}
      </section>

      {selectedShopRow && (
        <section className="rounded-md border border-[#d9d2c9] bg-white p-2 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex min-w-0 items-baseline gap-2">
              <h2 className="truncate text-xl font-black leading-none text-[#1a1815]">
                {selectedShopRow.shop}
              </h2>
              <span className="shrink-0 text-xs font-black text-[#8b8278]">
                W{selectedWeek.week}
              </span>
            </div>
            <div className="flex min-h-8 flex-wrap items-center gap-3 rounded-md border border-[#e7e0d8] px-2 text-xs font-black text-[#1a1815]">
              <span>{selectedShopRow.checkedCount}/{selectedShopRow.expectedCount}</span>
              <span>{formatMoney(selectedShopRow.includedCheckedSafeCash)}</span>
              <span
                className={
                  selectedShopRow.missingCount > 0
                    ? "text-[#1a1815]"
                    : "text-[#8b8278]"
                }
              >
                mist {selectedShopRow.missingCount}
              </span>
            </div>
          </div>

          <div className="mt-2 grid grid-cols-4 overflow-hidden rounded-md border border-[#e7e0d8] sm:grid-cols-7">
            {selectedShopDays.map(({ date, isExpected, record }) => {
              const isActive = date === selectedDate;
              const warning = cashWarning(record);
              const isClosed = !isExpected && !record;
              const statusLabel = record?.checkedAt
                ? "✓"
                : isClosed
                  ? "vrij"
                  : !record
                    ? "–"
                    : warning
                      ? "!"
                      : "";
              const tileClass = isActive
                ? "bg-[#1a1815] text-white"
                : !record
                  ? "bg-[#f7f7f7] text-[#8b8278]"
                  : record.checkedAt
                    ? "bg-white text-[#1a1815]"
                    : warning
                      ? "bg-white text-[#1a1815]"
                      : "bg-white text-[#1a1815]";

              return (
                <button
                  key={date}
                  type="button"
                  onClick={() => setSelectedDate(date)}
                  className={`min-h-12 border-b border-r border-[#e7e0d8] px-2 py-1.5 text-left transition last:border-r-0 sm:border-b-0 ${tileClass}`}
                >
                  <span className="flex items-center justify-between gap-1">
                    <span
                      className={`text-[0.6rem] font-black uppercase tracking-normal ${
                        isActive ? "text-white/70" : "text-[#8b8278]"
                      }`}
                    >
                      {dayShortName(date).slice(0, 2)} {date.slice(8, 10)}
                    </span>
                    {statusLabel && (
                      <span
                        className={`text-[0.62rem] font-black ${
                          isActive ? "text-white" : "text-[#1a1815]"
                        }`}
                      >
                        {statusLabel}
                      </span>
                    )}
                  </span>
                  <span
                    className={`mt-1 block truncate text-xs font-black ${
                      isActive ? "text-white" : "text-[#1a1815]"
                    }`}
                  >
                    {record
                      ? formatMoney(safeExpectedCash(record))
                      : isClosed
                        ? "vrij"
                        : "-"}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-2">
            {!selectedCashRecord && selectedShopDay && !selectedShopDay.isExpected ? (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-[#d9d2c9] bg-white px-3 py-2">
                <div>
                  <p className="text-sm font-black text-[#1a1815]">
                    Daalseweg gesloten
                  </p>
                </div>
                <p className="text-xs font-black text-[#8b8278]">
                  {dayName(selectedShopDay.date)} · telt niet mee
                </p>
              </div>
            ) : !selectedCashRecord ? (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-[#d9d2c9] bg-white px-3 py-2">
                <div>
                  <p className="text-sm font-black text-[#1a1815]">
                    Ontbreekt
                  </p>
                </div>
                <p className="text-xs font-black text-[#8b8278]">
                  {selectedShopDay ? dayName(selectedShopDay.date) : "Dag"} · geen Cash-it
                </p>
              </div>
            ) : (
              <article
                key={selectedCashRecord.id}
                className={`rounded-md border bg-white px-2 py-2 ${
                  selectedCashWarning ? "border-[#1a1815]" : "border-[#d9d2c9]"
                }`}
              >
                <div className="grid gap-2 lg:grid-cols-[5rem_minmax(0,1fr)_6.5rem] lg:items-start">
                  <label className="flex items-center gap-2 lg:items-start">
                    <input
                      type="checkbox"
                      checked={Boolean(selectedCashRecord.checkedAt)}
                      disabled={state === "saving"}
                      onChange={() => void toggleChecked(selectedCashRecord)}
                      className="mt-0.5 h-4 w-4 accent-[#1a1815]"
                    />
                    <span>
                      <span className="block text-lg font-black leading-none text-[#1a1815]">
                        {selectedCashRecord.date.slice(8, 10)}-
                        {selectedCashRecord.date.slice(5, 7)}
                      </span>
                      <span
                        className={`mt-1 inline-flex rounded border px-1.5 py-0.5 text-[0.55rem] font-black uppercase tracking-normal ${
                          selectedCashRecord.checkedAt
                            ? "border-[#d9d2c9] text-[#1a1815]"
                            : "border-[#1a1815] text-[#1a1815]"
                        }`}
                      >
                        {selectedCashRecord.checkedAt ? "ok" : "open"}
                      </span>
                    </span>
                  </label>

                  <div className="grid gap-x-4 gap-y-2 sm:grid-cols-3 xl:grid-cols-6">
                    <AmountCell
                      label="Start"
                      value={formatOptionalMoney(selectedCashRecord.startCash)}
                    />
                    <AmountCell
                      label="Geteld"
                      value={formatMoney(selectedCashRecord.countedCash)}
                    />
                    <AmountCell
                      label="Kas-uit"
                      value={formatOptionalMoney(selectedCashOut)}
                      tone={
                        selectedCashOut !== undefined &&
                        Math.abs(selectedCashOut) > 0.01
                          ? "warn"
                          : "normal"
                      }
                    />
                    <AmountCell
                      label="Bonnen"
                      value={formatOptionalMoney(selectedReceipts)}
                      tone={
                        selectedReceipts !== undefined &&
                        Math.abs(selectedReceipts) > 0.01
                          ? "warn"
                          : "normal"
                      }
                    />
                    <AmountCell
                      label="Naar kluis"
                      value={formatMoney(safeExpectedCash(selectedCashRecord))}
                    />
                    <AmountCell
                      label="Kasverschil"
                      value={formatOptionalMoney(selectedCashRecord.difference)}
                      tone={
                        selectedCashRecord.difference !== undefined &&
                        Math.abs(selectedCashRecord.difference) > 0.05
                          ? "warn"
                          : "normal"
                      }
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => void toggleChecked(selectedCashRecord)}
                    disabled={state === "saving"}
                    className={`h-8 rounded-md border px-2 text-[0.58rem] font-black uppercase tracking-normal disabled:opacity-60 ${
                      selectedCashRecord.checkedAt
                        ? "border-[#d9d2c9] bg-white text-[#6b645b]"
                        : "border-[#1a1815] bg-[#1a1815] text-white"
                    }`}
                  >
                    {selectedCashRecord.checkedAt ? "Heropenen" : "Afvinken"}
                  </button>
                </div>

                <div className="mt-2 grid gap-2 border-t border-[#e7e0d8] pt-2 lg:grid-cols-[minmax(0,1fr)_minmax(17rem,21rem)]">
                  <CashNoteControl
                    disabled={Boolean(selectedCashRecord.checkedAt) || state === "saving"}
                    drafts={cashNoteDrafts}
                    onChange={(key, value) =>
                      setCashNoteDrafts((current) => ({
                        ...current,
                        [cashNoteDraftKey(selectedCashRecord, key)]: value,
                      }))
                    }
                    record={selectedCashRecord}
                  />

                  <div className="grid gap-2 sm:grid-cols-2">
                    <label className="grid gap-0.5 text-[0.54rem] font-black uppercase tracking-normal text-[#8b8278]">
                      Kluis
                      <input
                        value={selectedSafeInputValue}
                        onChange={(event) =>
                          setSafeCashDrafts((current) => ({
                            ...current,
                            [selectedSafeDraftKey]: event.target.value,
                          }))
                        }
                        inputMode="decimal"
                        disabled={Boolean(selectedCashRecord.checkedAt) || state === "saving"}
                        placeholder="0,00"
                        className="h-8 rounded-md border border-[#d9d2c9] bg-white px-2 text-sm font-black normal-case tracking-normal text-[#1a1815] disabled:opacity-60"
                      />
                    </label>

                    <AmountCell
                      label="Δ"
                      value={formatMoney(selectedSafeDraftDifference)}
                      tone={
                        Math.abs(selectedSafeDraftDifference) > 0.01
                          ? "warn"
                          : "normal"
                      }
                    />

                    <label className="grid gap-0.5 text-[0.54rem] font-black uppercase tracking-normal text-[#8b8278] sm:col-span-2">
                      Notitie
                      <input
                        value={visibleCashNote(selectedCashRecord.note)}
                        onChange={(event) =>
                          updateCashRecord(
                            selectedCashRecord.date,
                            selectedCashRecord.shop,
                            (current) => ({
                              ...current,
                              note: event.target.value,
                              updatedAt: new Date().toISOString(),
                            })
                          )
                        }
                        disabled={Boolean(selectedCashRecord.checkedAt) || state === "saving"}
                        placeholder="optioneel"
                        className="h-8 rounded-md border border-[#d9d2c9] bg-white px-2 text-xs font-bold normal-case tracking-normal text-[#1a1815] disabled:opacity-60"
                      />
                    </label>

                    <label className="grid gap-0.5 rounded-md border border-[#1a1815] p-1.5 text-[0.54rem] font-black uppercase tracking-normal text-[#1a1815]">
                      Ijs
                      <input
                        value={iceCashInputValue(selectedCashRecord)}
                        onChange={(event) =>
                          setIceCashDrafts((current) => ({
                            ...current,
                            [cashRecordDraftKey(selectedCashRecord)]:
                              event.target.value,
                          }))
                        }
                        inputMode="decimal"
                        disabled={state === "saving"}
                        placeholder="0,00"
                        className="h-8 rounded-md border border-[#d9d2c9] bg-white px-2 text-sm font-black normal-case tracking-normal text-[#1a1815] disabled:opacity-60"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => void saveIceCash(selectedCashRecord)}
                      disabled={state === "saving"}
                      className="self-end rounded-md border border-[#1a1815] bg-[#1a1815] px-3 text-[0.58rem] font-black uppercase tracking-normal text-white disabled:opacity-60 sm:h-8"
                    >
                      OK
                    </button>
                  </div>

                  {selectedCashWarning && (
                    <p className="rounded-md border border-[#1a1815] bg-white px-2 py-1 text-xs font-black text-[#1a1815] lg:col-span-2">
                      {selectedCashWarning}
                    </p>
                  )}
                </div>
              </article>
            )}
          </div>
        </section>
      )}

      {selectedShopRow && (
        <section className="rounded-md border border-[#d9d2c9] bg-white p-2 shadow-sm">
          <div className="grid gap-2 lg:grid-cols-[8rem_10rem_minmax(12rem,1fr)_auto] lg:items-end">
            <div className="min-w-0">
              <p className="text-[0.54rem] font-black uppercase tracking-normal text-[#8b8278]">
                Week
              </p>
              <p className="truncate text-sm font-black text-[#1a1815]">
                {selectedShopRow.shop} · {selectedShopRow.checkedCount}/{selectedShopRow.expectedCount}
              </p>
            </div>
            <label className="grid gap-0.5 text-[0.54rem] font-black uppercase tracking-normal text-[#8b8278]">
              Bedrag
              <input
                value={
                  depositDrafts[selectedDepositDraftKey] ??
                  formatAmountInput(
                    selectedShopRow.deposit?.amount ||
                      selectedShopRow.includedCheckedSafeCash
                  )
                }
                onChange={(event) =>
                  setDepositDrafts((current) => ({
                    ...current,
                    [selectedDepositDraftKey]: event.target.value,
                  }))
                }
                inputMode="decimal"
                placeholder="0,00"
                className="h-8 rounded-md border border-[#d9d2c9] bg-white px-2 text-sm font-black normal-case tracking-normal text-[#1a1815]"
              />
            </label>
            <label className="grid gap-0.5 text-[0.54rem] font-black uppercase tracking-normal text-[#8b8278]">
              Notitie
              <input
                value={
                  depositNotes[selectedDepositDraftKey] ??
                  selectedShopRow.deposit?.note ??
                  ""
                }
                onChange={(event) =>
                  setDepositNotes((current) => ({
                    ...current,
                    [selectedDepositDraftKey]: event.target.value,
                  }))
                }
                placeholder={
                  selectedShopRow.deposit?.depositedAt ? "al gestort" : "optioneel"
                }
                className="h-8 rounded-md border border-[#d9d2c9] bg-white px-2 text-xs font-bold normal-case tracking-normal text-[#1a1815]"
              />
            </label>
            <button
              type="button"
              onClick={() => void saveDeposit(selectedShopRow)}
              disabled={state === "saving" || selectedShopRow.checkedCount === 0}
              className="h-8 rounded-md border border-[#1a1815] bg-[#1a1815] px-3 text-[0.58rem] font-black uppercase tracking-normal text-white disabled:bg-white disabled:text-[#8b8278] disabled:opacity-60"
            >
              {selectedShopRow.deposit?.depositedAt ? "Bijwerken" : "Opslaan"}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

function CashNoteControl({
  disabled,
  drafts,
  onChange,
  record,
}: Readonly<{
  disabled: boolean;
  drafts: Record<string, string>;
  onChange: (key: CashDenominationKey, value: string) => void;
  record: RevenueCashRecord;
}>) {
  const totalDifference = cashNoteControlDifference(record, drafts);

  return (
    <div className="min-w-0">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[0.54rem] font-black uppercase tracking-normal text-[#8b8278]">
          Briefjes
        </p>
        <p className="truncate text-[0.58rem] font-bold text-[#8b8278]">
          {record.countedBy || "teller onbekend"}
        </p>
      </div>
      <div className="mt-1 grid grid-cols-2 gap-1 sm:grid-cols-4 xl:grid-cols-7">
        {banknoteDenominations.map((denomination) => {
          const expected = cashNoteCount(record, denomination.key);
          const inputValue = cashNoteInputValue(record, denomination.key, drafts);
          const actual = parseCount(inputValue);
          const countDifference = actual - expected;
          const valueDifference = Number(
            (countDifference * denomination.value).toFixed(2)
          );

          return (
            <div
              key={denomination.key}
              className="rounded-md border border-[#e7e0d8] bg-white p-1"
            >
              <div className="flex items-center justify-between gap-1">
                <CashNote denomination={denomination} />
                <span className="text-xs font-black text-[#1a1815]">
                  {expected}
                </span>
              </div>
              <input
                value={inputValue}
                onChange={(event) => onChange(denomination.key, event.target.value)}
                inputMode="numeric"
                disabled={disabled}
                className="mt-1 h-7 w-full rounded-md border border-[#d9d2c9] bg-white px-2 text-center text-sm font-black text-[#1a1815] disabled:opacity-60"
              />
              {valueDifference !== 0 && (
                <span className="mt-1 block truncate text-[0.58rem] font-black text-[#1a1815]">
                  {countDifference > 0 ? "+" : ""}
                  {countDifference} · {formatMoney(valueDifference)}
                </span>
              )}
            </div>
          );
        })}
      </div>
      <div
        className={`mt-1 text-right text-xs font-black ${
          totalDifference === 0 ? "text-[#8b8278]" : "text-[#1a1815]"
        }`}
      >
        Δ {formatMoney(totalDifference)}
      </div>
    </div>
  );
}

function CashNote({
  denomination,
}: Readonly<{
  denomination: (typeof banknoteDenominations)[number];
}>) {
  return (
    <span
      aria-hidden="true"
      className="inline-flex h-5 w-12 items-center justify-center rounded-[3px] border border-[#d9d2c9] bg-white text-[0.52rem] font-black text-[#1a1815]"
    >
      € {denomination.label}
    </span>
  );
}

function MailIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="M4 6.5h16v11H4z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
      <path
        d="m5 7 7 6 7-6"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

function AmountCell({
  label,
  tone = "normal",
  value,
}: Readonly<{
  label: string;
  tone?: "normal" | "warn";
  value: string;
}>) {
  return (
    <div
      className={
        tone === "warn"
          ? "text-[#1a1815] underline decoration-[#1a1815]/35 underline-offset-2"
          : "text-[#1a1815]"
      }
    >
      <p className="text-[0.55rem] font-black uppercase tracking-normal text-[#8b8278]">
        {label}
      </p>
      <p className="whitespace-nowrap text-sm font-black leading-tight">{value}</p>
    </div>
  );
}
