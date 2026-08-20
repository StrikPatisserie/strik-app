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

const banknoteStyles: Record<string, { bg: string; border: string; text: string }> =
  {
    eur500: { bg: "#c3b1dd", border: "#7a5aa4", text: "#2a1745" },
    eur200: { bg: "#e5d58a", border: "#b2922f", text: "#46390c" },
    eur100: { bg: "#b8d7b4", border: "#6fa06b", text: "#15351f" },
    eur50: { bg: "#f6c28b", border: "#cf8345", text: "#462307" },
    eur20: { bg: "#a9cfe8", border: "#5f94b7", text: "#102f48" },
    eur10: { bg: "#eda3a8", border: "#c35b68", text: "#48141b" },
    eur5: { bg: "#c9c7c3", border: "#8d8881", text: "#22201d" },
  };

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

function formatOptionalAmountInput(value: number | undefined) {
  if (value === undefined) return "";

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

function appendCashNotes(note: string | undefined, additions: string[]) {
  const currentNote = visibleCashNote(note);
  const nextAdditions = additions.filter(
    (addition) =>
      addition && !currentNote.toLowerCase().includes(addition.toLowerCase())
  );

  return [currentNote, ...nextAdditions].filter(Boolean).join(" · ");
}

function roundedMoney(value: number) {
  return Number(value.toFixed(2));
}

function safeExpectedCashFromValues(startCash: number, countedCash: number) {
  return Math.max(0, roundedMoney((countedCash || 0) - startCash));
}

function safeExpectedCash(record: RevenueCashRecord | undefined) {
  if (!record) return 0;

  if (record.startCash !== undefined) {
    return safeExpectedCashFromValues(record.startCash, record.countedCash || 0);
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

function hasPatisserieCashRecord(
  record: RevenueCashRecord | undefined
): record is RevenueCashRecord {
  return Boolean(record && record.cashImportKind !== "ice");
}

function hasIceCashRecord(
  record: RevenueCashRecord | undefined
): record is RevenueCashRecord {
  return Boolean(
    record &&
      (record.cashImportKind === "ice" ||
        record.iceCash !== undefined ||
        record.iceStartCash !== undefined ||
        record.iceCountedCash !== undefined ||
        record.iceCashRevenue !== undefined ||
        record.iceExpectedCash !== undefined)
  );
}

function iceExpectedCash(record: RevenueCashRecord | undefined) {
  if (!record) return 0;

  return record.iceExpectedCash ?? record.iceCash ?? record.iceCashRevenue ?? 0;
}

function iceReportedCountedCash(record: RevenueCashRecord | undefined) {
  if (!record) return undefined;

  return record.iceCountedCash ?? record.iceCash ?? record.iceExpectedCash;
}

function iceCheckedCash(record: RevenueCashRecord | undefined) {
  if (!record) return 0;

  return record.iceSafeCash ?? iceExpectedCash(record);
}

function iceSafeDraftKey(record: RevenueCashRecord) {
  return `ice:${record.date}:${record.shop}`;
}

function iceSourceDraftKey(record: RevenueCashRecord) {
  return `ice:${record.date}:${record.shop}:source`;
}

function visibleIceCashNote(value: string | undefined) {
  return String(value || "").trim();
}

function appendIceCashNotes(note: string | undefined, additions: string[]) {
  const currentNote = visibleIceCashNote(note);
  const nextAdditions = additions.filter(
    (addition) =>
      addition && !currentNote.toLowerCase().includes(addition.toLowerCase())
  );

  return [currentNote, ...nextAdditions].filter(Boolean).join(" · ");
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

function cashSourceDraftKey(record: RevenueCashRecord) {
  return `${record.date}:${record.shop}:source`;
}

function parseCorrectionAmount(value: string | undefined, fallback: number) {
  if (value === undefined || !value.trim()) return fallback;

  return parseAmount(value);
}

function correctedCashExpectedTotal(record: RevenueCashRecord) {
  if (record.startCash === undefined || record.cashRevenue === undefined) {
    return record.expectedCash;
  }

  return Math.max(
    0,
    roundedMoney(record.startCash + record.cashRevenue - (record.cashOut || 0))
  );
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
  const [cashSourceDrafts, setCashSourceDrafts] = useState<
    Record<string, { startCash?: string; countedCash?: string }>
  >({});
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
        const patisserieRecords = shopRecords.filter(hasPatisserieCashRecord);
        const iceRecords = shopRecords.filter(hasIceCashRecord);
        const expectedDates = selectedWeekDates.filter(
          (date) => {
            const record = findCashRecord(shopRecords, date, shop);

            return (
              isCashExpectedForShopDate(shop, date) ||
              hasPatisserieCashRecord(record)
            );
          }
        );
        const checkedRecords = expectedDates.flatMap((date) => {
          const record = findCashRecord(shopRecords, date, shop);

          return hasPatisserieCashRecord(record) && record?.checkedAt ? [record] : [];
        });
        const cashRevenue = patisserieRecords.reduce(
          (total, record) => total + (record.cashRevenue ?? record.countedCash),
          0
        );
        const expectedSafeCash = patisserieRecords.reduce(
          (total, record) => total + safeExpectedCash(record),
          0
        );
        const checkedSafeCash = patisserieRecords.reduce(
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
        const iceCash = iceRecords.reduce(
          (total, record) => total + iceExpectedCash(record),
          0
        );
        const iceCheckedCount = iceRecords.filter(
          (record) => record.iceCheckedAt
        ).length;
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
          iceCash,
          iceCount: iceRecords.length,
          iceCheckedCount,
          checkedCount: checkedRecords.length,
          expectedCount: expectedDates.length,
          missingCount: expectedDates.filter(
            (date) => !hasPatisserieCashRecord(findCashRecord(shopRecords, date, shop))
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
      selectedWeekDates.map((date) => {
        const record = findCashRecord(cashRecords, date, selectedShop);

        return {
          date,
          patisserieRecord: hasPatisserieCashRecord(record) ? record : undefined,
          iceRecord: hasIceCashRecord(record) ? record : undefined,
          isExpected: isCashExpectedForShopDate(selectedShop, date),
        };
      }),
    [cashRecords, selectedShop, selectedWeekDates]
  );
  const selectedShopDay =
    selectedShopDays.find((day) => day.date === selectedDate) ||
    selectedShopDays[0];
  const selectedPatisserieCashRecord = selectedShopDay?.patisserieRecord;
  const selectedIceCashRecord = selectedShopDay?.iceRecord;
  const selectedCashRecord = selectedPatisserieCashRecord;
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
  const selectedStartCash = selectedCashRecord
    ? selectedCashRecord.startCash
    : undefined;
  const selectedCountedCash = selectedCashRecord
    ? selectedCashRecord.countedCash
    : undefined;
  const selectedSourceDraftKey = selectedCashRecord
    ? cashSourceDraftKey(selectedCashRecord)
    : "";
  const selectedSourceDraft = selectedSourceDraftKey
    ? cashSourceDrafts[selectedSourceDraftKey]
    : undefined;
  const selectedStartCashInputValue = selectedCashRecord
    ? selectedSourceDraft?.startCash ??
      formatOptionalAmountInput(selectedCashRecord.startCash)
    : "";
  const selectedCountedCashInputValue = selectedCashRecord
    ? selectedSourceDraft?.countedCash ??
      formatOptionalAmountInput(selectedCashRecord.countedCash)
    : "";
  const selectedCorrectedStartCash = selectedCashRecord
    ? parseCorrectionAmount(
        selectedSourceDraft?.startCash,
        selectedCashRecord.startCash ?? 0
      )
    : 0;
  const selectedCorrectedCountedCash = selectedCashRecord
    ? parseCorrectionAmount(
        selectedSourceDraft?.countedCash,
        selectedCashRecord.countedCash
      )
    : 0;
  const selectedHasSourceCorrection = selectedCashRecord
    ? Math.abs(selectedCorrectedStartCash - (selectedCashRecord.startCash ?? 0)) >
        0.01 ||
      Math.abs(selectedCorrectedCountedCash - selectedCashRecord.countedCash) >
        0.01
    : false;
  const selectedExpectedCash = selectedCashRecord
    ? safeExpectedCash(selectedCashRecord)
    : 0;
  const selectedDifference = selectedCashRecord
    ? selectedCashRecord.difference
    : undefined;
  const selectedIceSafeDraftKey = selectedIceCashRecord
    ? iceSafeDraftKey(selectedIceCashRecord)
    : "";
  const selectedIceSourceDraftKey = selectedIceCashRecord
    ? iceSourceDraftKey(selectedIceCashRecord)
    : "";
  const selectedIceSafeInputValue = selectedIceCashRecord
    ? safeCashDrafts[selectedIceSafeDraftKey] ??
      formatAmountInput(iceCheckedCash(selectedIceCashRecord))
    : "";
  const selectedIceSourceDraft = selectedIceSourceDraftKey
    ? cashSourceDrafts[selectedIceSourceDraftKey]
    : undefined;
  const selectedIceStartCashInputValue = selectedIceCashRecord
    ? selectedIceSourceDraft?.startCash ??
      formatOptionalAmountInput(selectedIceCashRecord.iceStartCash)
    : "";
  const selectedIceCountedCashInputValue = selectedIceCashRecord
    ? selectedIceSourceDraft?.countedCash ??
      formatOptionalAmountInput(iceReportedCountedCash(selectedIceCashRecord))
    : "";
  const selectedCorrectedIceStartCash = selectedIceCashRecord
    ? parseCorrectionAmount(
        selectedIceSourceDraft?.startCash,
        selectedIceCashRecord.iceStartCash ?? 0
      )
    : 0;
  const selectedCorrectedIceCountedCash = selectedIceCashRecord
    ? parseCorrectionAmount(
        selectedIceSourceDraft?.countedCash,
        iceReportedCountedCash(selectedIceCashRecord) ?? 0
      )
    : 0;
  const selectedHasIceSourceCorrection = selectedIceCashRecord
    ? Math.abs(
        selectedCorrectedIceStartCash - (selectedIceCashRecord.iceStartCash ?? 0)
      ) > 0.01 ||
      Math.abs(
        selectedCorrectedIceCountedCash -
          (iceReportedCountedCash(selectedIceCashRecord) ?? 0)
      ) > 0.01
    : false;
  const selectedIceSafeDraftDifference = selectedIceCashRecord
    ? Number(
        (
          parseAmount(selectedIceSafeInputValue) -
          iceExpectedCash(selectedIceCashRecord)
        ).toFixed(2)
      )
    : 0;
  const weekRecords = useMemo(
    () => weekRows.flatMap((row) => row.records).filter(hasPatisserieCashRecord),
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
          cashImportKind: "patisserie",
          safeCash,
          safeDifference: Number((safeCash - safeExpectedCash(current)).toFixed(2)),
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
        checkedAt: "",
        checkedBy: "",
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

  async function saveCashSourceCorrection(record: RevenueCashRecord) {
    if (record.checkedAt) {
      setStatus("Heropen de dag eerst om startbedrag of sluitbedrag te wijzigen.");
      return;
    }

    const draftKey = cashSourceDraftKey(record);
    const draft = cashSourceDrafts[draftKey];
    const startCash = parseCorrectionAmount(draft?.startCash, record.startCash ?? 0);
    const countedCash = parseCorrectionAmount(draft?.countedCash, record.countedCash);
    const changedStart = Math.abs(startCash - (record.startCash ?? 0)) > 0.01;
    const changedCounted = Math.abs(countedCash - record.countedCash) > 0.01;
    if (!changedStart && !changedCounted) {
      setStatus("Geen startbedrag of sluitbedrag gewijzigd.");
      return;
    }

    const confirmationText =
      changedStart && changedCounted
        ? "Let op: wil je het startbedrag en sluitbedrag wijzigen?"
        : changedStart
          ? "Let op: wil je het startbedrag wijzigen?"
          : "Let op: wil je het sluitbedrag wijzigen?";
    if (!window.confirm(confirmationText)) return;

    const now = new Date().toISOString();
    const correctionNotes = [
      changedStart ? "startbedrag gewijzigd" : "",
      changedCounted ? "sluitbedrag gewijzigd" : "",
    ].filter(Boolean);
    const nextCashRecords = buildUpdatedCashRecords(
      cashRecords,
      record.date,
      record.shop,
      (current) => {
        const correctedRecord = {
          ...current,
          startCash,
          countedCash,
        };
        const expectedCash = correctedCashExpectedTotal(correctedRecord);
        const expectedSafeCash = safeExpectedCashFromValues(startCash, countedCash);

        return {
          ...correctedRecord,
          expectedCash,
          difference:
            expectedCash === undefined
              ? current.difference
              : roundedMoney(countedCash - expectedCash),
          safeDifference:
            current.safeCash === undefined
              ? current.safeDifference
              : roundedMoney(current.safeCash - expectedSafeCash),
          note: appendCashNotes(current.note, correctionNotes),
          updatedAt: now,
        };
      }
    );

    setCashRecords(nextCashRecords);
    setCashSourceDrafts((current) => {
      const next = { ...current };
      delete next[draftKey];

      return next;
    });
    await saveCash(cashDeposits, nextCashRecords);
  }

  async function saveIceCashSourceCorrection(record: RevenueCashRecord) {
    if (record.iceCheckedAt) {
      setStatus("Heropen de ijstelling eerst om startbedrag of sluitbedrag te wijzigen.");
      return;
    }

    const draftKey = iceSourceDraftKey(record);
    const draft = cashSourceDrafts[draftKey];
    const startCash = parseCorrectionAmount(draft?.startCash, record.iceStartCash ?? 0);
    const countedCash = parseCorrectionAmount(
      draft?.countedCash,
      iceReportedCountedCash(record) ?? 0
    );
    const changedStart = Math.abs(startCash - (record.iceStartCash ?? 0)) > 0.01;
    const changedCounted =
      Math.abs(countedCash - (iceReportedCountedCash(record) ?? 0)) > 0.01;
    if (!changedStart && !changedCounted) {
      setStatus("Geen startbedrag of sluitbedrag gewijzigd.");
      return;
    }

    const confirmationText =
      changedStart && changedCounted
        ? "Let op: wil je het startbedrag en sluitbedrag wijzigen?"
        : changedStart
          ? "Let op: wil je het startbedrag wijzigen?"
          : "Let op: wil je het sluitbedrag wijzigen?";
    if (!window.confirm(confirmationText)) return;

    const now = new Date().toISOString();
    const expectedCash = safeExpectedCashFromValues(startCash, countedCash);
    const sourceCashRevenue = record.iceCashRevenue ?? expectedCash;
    const sourceExpectedTotal = startCash + sourceCashRevenue - (record.iceCashOut || 0);
    const correctionNotes = [
      changedStart ? "startbedrag gewijzigd" : "",
      changedCounted ? "sluitbedrag gewijzigd" : "",
    ].filter(Boolean);
    const nextCashRecords = buildUpdatedCashRecords(
      cashRecords,
      record.date,
      record.shop,
      (current) => ({
        ...current,
        iceStartCash: startCash,
        iceCountedCash: countedCash,
        iceCash: expectedCash,
        iceExpectedCash: expectedCash,
        iceDifference: roundedMoney(countedCash - sourceExpectedTotal),
        iceSafeDifference:
          current.iceSafeCash === undefined
            ? current.iceSafeDifference
            : roundedMoney(current.iceSafeCash - expectedCash),
        iceNote: appendIceCashNotes(current.iceNote, correctionNotes),
        updatedAt: now,
      })
    );

    setCashRecords(nextCashRecords);
    setCashSourceDrafts((current) => {
      const next = { ...current };
      delete next[draftKey];

      return next;
    });
    await saveCash(cashDeposits, nextCashRecords);
  }

  async function markIceChecked(record: RevenueCashRecord) {
    const key = iceSafeDraftKey(record);
    const now = new Date().toISOString();
    const nextCashRecords = buildUpdatedCashRecords(
      cashRecords,
      record.date,
      record.shop,
      (current) => {
        const safeCash = parseAmount(
          safeCashDrafts[key] || formatAmountInput(iceCheckedCash(current))
        );

        return {
          ...current,
          iceSafeCash: safeCash,
          iceSafeDifference: Number((safeCash - iceExpectedCash(current)).toFixed(2)),
          iceCheckedAt: now,
          iceCheckedBy: "Geld teller",
          iceNote: visibleIceCashNote(current.iceNote),
          updatedAt: now,
        };
      }
    );

    setCashRecords(nextCashRecords);
    await saveCash(cashDeposits, nextCashRecords);
  }

  async function unmarkIceChecked(record: RevenueCashRecord) {
    const now = new Date().toISOString();
    const nextCashRecords = buildUpdatedCashRecords(
      cashRecords,
      record.date,
      record.shop,
      (current) => ({
        ...current,
        iceCheckedAt: "",
        iceCheckedBy: "",
        updatedAt: now,
      })
    );

    setCashRecords(nextCashRecords);
    await saveCash(cashDeposits, nextCashRecords);
  }

  async function toggleIceChecked(record: RevenueCashRecord) {
    if (record.iceCheckedAt) {
      await unmarkIceChecked(record);
      return;
    }

    await markIceChecked(record);
  }

  async function saveCash(
    nextDeposits = cashDeposits,
    nextCashRecords = cashRecords
  ) {
    const cleanedCashRecords = nextCashRecords.map((record) => ({
      ...record,
      note: visibleCashNote(record.note),
      iceNote: visibleIceCashNote(record.iceNote),
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
    const checkedRecords = row.records.filter(
      (record) => hasPatisserieCashRecord(record) && record.checkedAt
    );
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

        return hasPatisserieCashRecord(record) && record?.checkedAt ? [record] : [];
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

        return hasPatisserieCashRecord(record) && record?.checkedAt ? [record] : [];
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
        depositAmount,
        depositNote: depositNotes[depositDraftKey] || sourceDeposit?.note || "",
        days: row.expectedDates.map((date) => {
          const record = findCashRecord(shopRecords, date, row.shop);

          return {
            date,
            checked: Boolean(hasPatisserieCashRecord(record) && record?.checkedAt),
            safeCash: hasPatisserieCashRecord(record) ? safeCheckedCash(record) : 0,
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

    const nextDeposits = buildWeekCashDeposits(cashRecords);
    setCashDeposits(nextDeposits);
    setMailState("sending");

    try {
      await saveCash(nextDeposits, cashRecords);

      const response = await fetch("/api/management-revenue/cash-deposit-mail", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          year: selectedWeek.year,
          week: selectedWeek.week,
          weekLabel: weekRangeLabel(selectedWeek.year, selectedWeek.week),
          rows: buildWeekDepositMailRows(cashRecords, nextDeposits),
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
    <div className="space-y-3">
      <section className="rounded-lg border border-[#d9cbb8] bg-[#f7f1e7]/90 p-2 shadow-sm">
        <div className="grid gap-2 lg:grid-cols-[minmax(14rem,18rem)_minmax(0,1fr)_auto] lg:items-end">
          <label className="grid gap-0.5 text-[0.56rem] font-black uppercase tracking-[0.08em] text-[#2d2a26]/45">
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
              className="h-9 rounded-md border border-[#e7e0d8] bg-white px-2 text-sm font-black normal-case tracking-normal text-[#1a1815]"
            >
              {availableWeeks.map((week) => (
                <option key={week.key} value={week.key}>
                  Week {week.week} - {weekRangeLabel(week.year, week.week)}
                </option>
              ))}
            </select>
          </label>

          <div className="grid grid-cols-3 rounded-md bg-[#f8f6f3] text-center">
            <div className="border-r border-[#e7e0d8] px-2 py-1.5">
              <p className="text-[0.56rem] font-black uppercase tracking-normal text-[#8b8278]">
                Gecheckt
              </p>
              <p className="text-sm font-black text-[#1a1815]">
                {weekCheckedCount}/{weekExpectedCount}
              </p>
            </div>
            <div className="border-r border-[#e7e0d8] px-2 py-1.5">
              <p className="text-[0.56rem] font-black uppercase tracking-normal text-[#8b8278]">
                Verwacht
              </p>
              <p className="text-sm font-black text-[#1a1815]">
                {formatMoney(weekExpectedTotal)}
              </p>
            </div>
            <div className="px-2 py-1.5">
              <p className="text-[0.56rem] font-black uppercase tracking-normal text-[#8b8278]">
                Weektotaal
              </p>
              <p className="text-sm font-black text-[#1a1815]">
                {formatMoney(weekCheckedTotal)}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-1">
            <button
              type="button"
              onClick={() =>
                setSelectedDate(
                  shiftedWeekDate(selectedWeek.year, selectedWeek.week, -1)
                )
              }
              className="h-9 rounded-md border border-[#d9d2c9] bg-white px-2 text-[0.62rem] font-black uppercase tracking-normal text-[#1a1815]"
            >
              Vorige
            </button>
            <button
              type="button"
              onClick={() => setSelectedDate(localIsoDate())}
              className="h-9 rounded-md border border-[#d9d2c9] bg-white px-2 text-[0.62rem] font-black uppercase tracking-normal text-[#1a1815]"
            >
              Vandaag
            </button>
            <button
              type="button"
              onClick={() =>
                setSelectedDate(
                  shiftedWeekDate(selectedWeek.year, selectedWeek.week, 1)
                )
              }
              className="h-9 rounded-md border border-[#d9d2c9] bg-white px-2 text-[0.62rem] font-black uppercase tracking-normal text-[#1a1815]"
            >
              Volgende
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
              className="flex h-9 items-center justify-center rounded-md border border-[#1a1815] bg-[#1a1815] px-2 text-white disabled:border-[#d9d2c9] disabled:bg-white disabled:text-[#8b8278] disabled:opacity-60"
            >
              <MailIcon />
            </button>
          </div>
        </div>

        <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
          {weekRows.map((row) => {
            const isSelected = row.shop === selectedShop;

            return (
              <button
                key={row.shop}
                type="button"
                onClick={() => {
                  setSelectedShop(row.shop);
                }}
                className={`rounded-md border p-2 text-left shadow-sm transition ${
                  isSelected
                    ? "border-[#1a1815] bg-[#1a1815] text-white"
                    : "border-[#e0d5c8] bg-white/94 text-[#1a1815] hover:border-[#1a1815]/45"
                }`}
              >
                <span
                  className={`block text-[0.56rem] font-black uppercase tracking-normal ${
                    isSelected ? "text-white/62" : "text-[#8b8278]"
                  }`}
                >
                  Patisserie
                </span>
                <span className="mt-0.5 block text-sm font-black">
                  {row.shop}
                </span>
                <span
                  className={`mt-1 block text-[0.62rem] font-black uppercase tracking-normal ${
                    isSelected ? "text-white/70" : "text-[#8b8278]"
                  }`}
                >
                  {row.checkedCount}/{row.expectedCount} compleet ·{" "}
                  {formatMoney(row.includedCheckedSafeCash)}
                </span>
                {row.iceCount > 0 && (
                  <span
                    className={`mt-0.5 block text-[0.62rem] font-black uppercase tracking-normal ${
                      isSelected ? "text-white/70" : "text-[#1f4f35]"
                    }`}
                  >
                    IJs {row.iceCheckedCount}/{row.iceCount} ·{" "}
                    {formatMoney(row.iceCash)}
                  </span>
                )}
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
        <section className="rounded-lg border border-[#e7e0d8]/80 bg-white/92 p-2 shadow-sm">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className="text-[0.58rem] font-black uppercase tracking-normal text-[#8b8278]">
                Patisserie
              </p>
              <h2 className="text-lg font-black leading-tight text-[#1a1815]">
                {selectedShopRow.shop}
              </h2>
              <p className="text-[0.68rem] font-bold text-[#8b8278]">
                Week {selectedWeek.week} · {weekRangeLabel(selectedWeek.year, selectedWeek.week)}
              </p>
            </div>
            <div className="grid min-w-[18rem] grid-cols-2 rounded-md bg-[#f8f6f3] text-center sm:grid-cols-4">
              <StatBox
                label="Compleet"
                value={`${selectedShopRow.checkedCount}/${selectedShopRow.expectedCount}`}
              />
              <StatBox
                label="Weektotaal"
                value={formatMoney(selectedShopRow.includedCheckedSafeCash)}
              />
              <StatBox
                label="IJs"
                value={
                  selectedShopRow.iceCount > 0
                    ? `${selectedShopRow.iceCheckedCount}/${selectedShopRow.iceCount} · ${formatMoney(selectedShopRow.iceCash)}`
                    : "-"
                }
              />
              <StatBox
                label="Ontbreekt"
                value={`${selectedShopRow.missingCount}`}
                tone={selectedShopRow.missingCount > 0 ? "warn" : "normal"}
              />
            </div>
          </div>

          <div className="mt-2 grid grid-cols-2 gap-1 sm:grid-cols-4 xl:grid-cols-7">
            {selectedShopDays.map(({ date, iceRecord, isExpected, patisserieRecord }) => {
              const isActive = date === selectedDate;
              const dayRecord = patisserieRecord;
              const warning = cashWarning(dayRecord);
              const isClosed = !isExpected && !dayRecord;
              const statusLabel =
                isClosed
                  ? "Gesloten"
                  : !dayRecord
                    ? "Ontbreekt"
                    : dayRecord.checkedAt
                      ? "Compleet"
                      : warning
                        ? "Let op"
                        : "Open";
              const tileClass = isActive
                ? "border-[#1a1815] bg-[#1a1815] text-white shadow-sm"
                : !dayRecord
                  ? "border-[#e7e0d8] bg-[#f5f2ee] text-[#8b8278]"
                  : dayRecord.checkedAt
                    ? "border-[#cbdcc5] bg-[#f6fbf5] text-[#1a1815]"
                    : warning
                      ? "border-[#efd1a1] bg-[#fff8d8] text-[#1a1815]"
                      : "border-[#e7e0d8] bg-white text-[#1a1815]";

              return (
                <button
                  key={date}
                  type="button"
                  onClick={() => setSelectedDate(date)}
                  className={`min-h-[5rem] rounded-md border px-2 py-1.5 text-left transition ${tileClass}`}
                >
                  <span
                    className={`block text-[0.55rem] font-black uppercase tracking-normal ${
                      isActive ? "text-white/65" : "text-[#8b8278]"
                    }`}
                  >
                    {dayShortName(date)}
                  </span>
                  <span className="block text-base font-black leading-tight">
                    {date.slice(8, 10)}-{date.slice(5, 7)}
                  </span>
                  <span
                    className={`mt-0.5 block text-[0.58rem] font-black uppercase tracking-normal ${
                      isActive ? "text-white/78" : "text-[#6b645b]"
                    }`}
                  >
                    {statusLabel}
                  </span>
                  <span
                    className={`mt-0.5 block truncate text-xs font-black ${
                      isActive ? "text-white" : "text-[#1a1815]"
                    }`}
                  >
                    {dayRecord
                      ? formatMoney(safeExpectedCash(dayRecord))
                      : isClosed
                        ? "geen dienst"
                        : "-"}
                  </span>
                  {iceRecord && (
                    <span
                      className={`mt-0.5 block truncate text-[0.68rem] font-black ${
                        isActive ? "text-white/88" : "text-[#1f4f35]"
                      }`}
                    >
                      IJs {iceRecord.iceCheckedAt ? "compleet" : "open"} ·{" "}
                      {formatMoney(iceExpectedCash(iceRecord))}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="mt-2">
            {!selectedCashRecord && selectedShopDay && !selectedShopDay.isExpected ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-[#e7e0d8] bg-[#f5f2ee] px-3 py-3">
                  <div>
                    <p className="text-[0.58rem] font-black uppercase tracking-normal text-[#8b8278]">
                      {dayName(selectedShopDay.date)}
                    </p>
                    <p className="text-sm font-black text-[#1a1815]">
                      Daalseweg gesloten
                    </p>
                  </div>
                  <p className="text-sm font-bold text-[#8b8278]">
                    Deze dag telt niet mee als ontbrekende storting.
                  </p>
                </div>
              </>
            ) : !selectedCashRecord ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-[#ece5dd] bg-[#faf8f5] px-3 py-3">
                  <div>
                    <p className="text-[0.58rem] font-black uppercase tracking-normal text-[#8b8278]">
                      {selectedShopDay ? dayName(selectedShopDay.date) : "Dag"}
                    </p>
                    <p className="text-sm font-black text-[#1a1815]">
                      Dagafsluiting ontbreekt
                    </p>
                  </div>
                  <p className="text-sm font-bold text-[#8b8278]">
                    Geen Cash-it dagafsluiting ontvangen.
                  </p>
                </div>
              </>
            ) : (
              <article
                key={selectedCashRecord.id}
                className={`rounded-md border px-3 py-2 ${
                  selectedCashRecord.checkedAt
                    ? "border-[#cbdcc5] bg-[#f6fbf5]"
                    : selectedCashWarning
                      ? "border-[#efd1a1] bg-[#fffdf5]"
                      : "border-[#ece5dd] bg-[#faf8f5]"
                }`}
              >
                <div className="grid gap-3 lg:grid-cols-[6rem_minmax(0,1fr)_7rem] lg:items-start">
                  <label className="flex items-center gap-2 lg:items-start">
                    <input
                      type="checkbox"
                      checked={Boolean(selectedCashRecord.checkedAt)}
                      disabled={state === "saving"}
                      onChange={() => void toggleChecked(selectedCashRecord)}
                      className="mt-0.5 h-4 w-4 accent-[#1f4f35]"
                    />
                    <span>
                      <span className="block text-[0.58rem] font-black uppercase tracking-normal text-[#8b8278]">
                        {dayShortName(selectedCashRecord.date)}
                      </span>
                      <span className="block text-base font-black leading-tight text-[#1a1815]">
                        {selectedCashRecord.date.slice(8, 10)}-
                        {selectedCashRecord.date.slice(5, 7)}
                      </span>
                      <span
                        className={`mt-0.5 inline-flex rounded-full px-2 py-0.5 text-[0.58rem] font-black uppercase tracking-normal ${
                          selectedCashRecord.checkedAt
                            ? "bg-[#dfeadd] text-[#1f4f35]"
                            : "bg-[#f5ead6] text-[#7a5417]"
                        }`}
                      >
                        {selectedCashRecord.checkedAt ? "compleet" : "open"}
                      </span>
                    </span>
                  </label>

                  <div className="grid gap-x-4 gap-y-2 sm:grid-cols-3 xl:grid-cols-6">
                    <AmountCell
                      label="Start"
                      value={formatOptionalMoney(selectedStartCash)}
                    />
                    <AmountCell
                      label="Geteld"
                      value={formatOptionalMoney(selectedCountedCash)}
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
                      value={formatMoney(selectedExpectedCash)}
                    />
                    <AmountCell
                      label="Kasverschil"
                      value={formatOptionalMoney(selectedDifference)}
                      tone={
                        selectedDifference !== undefined &&
                        Math.abs(selectedDifference) > 0.05
                          ? "warn"
                          : "normal"
                      }
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => void toggleChecked(selectedCashRecord)}
                    disabled={state === "saving"}
                    className={`h-9 rounded-md border px-2 text-[0.62rem] font-black uppercase tracking-normal disabled:opacity-60 ${
                      selectedCashRecord.checkedAt
                        ? "border-[#d9d2c9] bg-white text-[#6b645b]"
                        : "border-[#1a1815] bg-[#1a1815] text-white"
                    }`}
                  >
                    {selectedCashRecord.checkedAt ? "Heropenen" : "Afvinken"}
                  </button>
                </div>

                <div className="mt-3 grid gap-3 border-t border-[#e7e0d8]/80 pt-2 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,22rem)]">
                  <CashNoteControl
                    disabled={
                      Boolean(selectedCashRecord.checkedAt) ||
                      state === "saving"
                    }
                    drafts={cashNoteDrafts}
                    onChange={(key, value) =>
                      setCashNoteDrafts((current) => ({
                        ...current,
                        [cashNoteDraftKey(selectedCashRecord, key)]: value,
                      }))
                    }
                    record={selectedCashRecord}
                  />

                  <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_7rem]">
                    <div className="grid gap-2 rounded-md border border-[#e7e0d8] bg-white/70 p-2 sm:col-span-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                      <label className="grid gap-0.5 text-[0.56rem] font-black uppercase tracking-normal text-[#8b8278]">
                        Startbedrag
                        <input
                          value={selectedStartCashInputValue}
                          onChange={(event) =>
                            setCashSourceDrafts((current) => ({
                              ...current,
                              [selectedSourceDraftKey]: {
                                ...current[selectedSourceDraftKey],
                                startCash: event.target.value,
                              },
                            }))
                          }
                          inputMode="decimal"
                          disabled={
                            Boolean(selectedCashRecord.checkedAt) ||
                            state === "saving"
                          }
                          placeholder="0,00"
                          className="h-8 rounded-md border border-[#d9d2c9] bg-white px-2 text-sm font-black normal-case tracking-normal text-[#1a1815] disabled:opacity-60"
                        />
                      </label>

                      <label className="grid gap-0.5 text-[0.56rem] font-black uppercase tracking-normal text-[#8b8278]">
                        Sluitbedrag
                        <input
                          value={selectedCountedCashInputValue}
                          onChange={(event) =>
                            setCashSourceDrafts((current) => ({
                              ...current,
                              [selectedSourceDraftKey]: {
                                ...current[selectedSourceDraftKey],
                                countedCash: event.target.value,
                              },
                            }))
                          }
                          inputMode="decimal"
                          disabled={
                            Boolean(selectedCashRecord.checkedAt) ||
                            state === "saving"
                          }
                          placeholder="0,00"
                          className="h-8 rounded-md border border-[#d9d2c9] bg-white px-2 text-sm font-black normal-case tracking-normal text-[#1a1815] disabled:opacity-60"
                        />
                      </label>

                      <button
                        type="button"
                        onClick={() =>
                          void saveCashSourceCorrection(selectedCashRecord)
                        }
                        disabled={
                          Boolean(selectedCashRecord.checkedAt) ||
                          state === "saving" ||
                          !selectedHasSourceCorrection
                        }
                        className="h-8 rounded-md border border-[#1a1815] bg-[#1a1815] px-2 text-[0.58rem] font-black uppercase tracking-normal text-white disabled:border-[#d9d2c9] disabled:bg-white disabled:text-[#8b8278] disabled:opacity-60"
                      >
                        Corrigeren
                      </button>
                    </div>

                    <label className="grid gap-0.5 text-[0.56rem] font-black uppercase tracking-normal text-[#8b8278]">
                      Controlebedrag
                      <input
                        value={selectedSafeInputValue}
                        onChange={(event) =>
                          setSafeCashDrafts((current) => ({
                            ...current,
                            [selectedSafeDraftKey]: event.target.value,
                          }))
                        }
                        inputMode="decimal"
                        disabled={
                          Boolean(selectedCashRecord.checkedAt) ||
                          state === "saving"
                        }
                        placeholder="0,00"
                        className="h-9 rounded-md border border-[#d9d2c9] bg-white px-2 text-sm font-black normal-case tracking-normal text-[#1a1815] disabled:opacity-60"
                      />
                    </label>

                    <AmountCell
                      label="Verschil"
                      value={formatMoney(selectedSafeDraftDifference)}
                      tone={
                        Math.abs(selectedSafeDraftDifference) > 0.01
                          ? "warn"
                          : "normal"
                      }
                    />

                    <label className="grid gap-0.5 text-[0.56rem] font-black uppercase tracking-normal text-[#8b8278] sm:col-span-2">
                      Controle-notitie
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
                        disabled={
                          Boolean(selectedCashRecord.checkedAt) ||
                          state === "saving"
                        }
                        placeholder="Bijv. kas-uitbon ontbreekt of bedrag gecorrigeerd"
                        className="h-9 rounded-md border border-[#d9d2c9] bg-white px-2 text-xs font-bold normal-case tracking-normal text-[#1a1815] disabled:opacity-60"
                      />
                    </label>
                  </div>

                  {selectedCashWarning && (
                    <p className="rounded-md bg-[#fff8d8] px-2 py-1 text-xs font-bold text-[#7a5417] lg:col-span-2">
                      {selectedCashWarning}
                    </p>
                  )}
                </div>
              </article>
            )}

            {selectedIceCashRecord && (
              <IceCashSummary
                disabled={state === "saving"}
                draftDifference={selectedIceSafeDraftDifference}
                hasSourceCorrection={selectedHasIceSourceCorrection}
                inputValue={selectedIceSafeInputValue}
                onInputChange={(value) =>
                  setSafeCashDrafts((current) => ({
                    ...current,
                    [selectedIceSafeDraftKey]: value,
                  }))
                }
                onNoteChange={(value) =>
                  updateCashRecord(
                    selectedIceCashRecord.date,
                    selectedIceCashRecord.shop,
                    (current) => ({
                      ...current,
                      iceNote: value,
                      updatedAt: new Date().toISOString(),
                    })
                  )
                }
                onSaveSourceCorrection={() =>
                  void saveIceCashSourceCorrection(selectedIceCashRecord)
                }
                onSourceDraftChange={(field, value) =>
                  setCashSourceDrafts((current) => ({
                    ...current,
                    [selectedIceSourceDraftKey]: {
                      ...current[selectedIceSourceDraftKey],
                      [field]: value,
                    },
                  }))
                }
                onToggleChecked={() => void toggleIceChecked(selectedIceCashRecord)}
                record={selectedIceCashRecord}
                sourceCountedInputValue={selectedIceCountedCashInputValue}
                sourceStartInputValue={selectedIceStartCashInputValue}
              />
            )}
          </div>
        </section>
      )}

      {selectedShopRow && (
        <section className="rounded-lg border border-[#e7e0d8]/80 bg-white/92 p-3 shadow-sm">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className="text-[0.58rem] font-black uppercase tracking-normal text-[#8b8278]">
                Weekstorting
              </p>
              <h2 className="text-lg font-black leading-tight text-[#1a1815]">
                {selectedShopRow.shop}
              </h2>
            </div>
            <div className="grid w-full gap-3 sm:grid-cols-4 lg:w-auto lg:min-w-[32rem]">
              <AmountCell
                label="Compleet"
                value={`${selectedShopRow.checkedCount}/${selectedShopRow.expectedCount}`}
              />
              <AmountCell
                label="Kasomzet"
                value={formatMoney(selectedShopRow.includedCashRevenue)}
              />
              <AmountCell
                label="Verwacht"
                value={formatMoney(selectedShopRow.includedExpectedSafeCash)}
              />
              <AmountCell
                label="Weektotaal"
                value={formatMoney(selectedShopRow.includedCheckedSafeCash)}
              />
            </div>
          </div>

          <div className="mt-3 grid gap-2 lg:grid-cols-[12rem_minmax(14rem,1fr)_auto] lg:items-end">
            <label className="grid gap-0.5 text-[0.56rem] font-black uppercase tracking-normal text-[#8b8278]">
              Storting
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
                className="h-9 rounded-md border border-[#d9d2c9] bg-white px-2 text-sm font-black normal-case tracking-normal text-[#1a1815]"
              />
            </label>
            <label className="grid gap-0.5 text-[0.56rem] font-black uppercase tracking-normal text-[#8b8278]">
              Stortnotitie
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
                className="h-9 rounded-md border border-[#d9d2c9] bg-white px-2 text-xs font-bold normal-case tracking-normal text-[#1a1815]"
              />
            </label>
            <button
              type="button"
              onClick={() => void saveDeposit(selectedShopRow)}
              disabled={state === "saving" || selectedShopRow.checkedCount === 0}
              className="h-9 rounded-md bg-[#c3d3bc] px-3 text-[0.62rem] font-black uppercase tracking-normal text-[#1a1815] disabled:opacity-50"
            >
              {selectedShopRow.deposit?.depositedAt
                ? "Storting bijwerken"
                : "Storting opslaan"}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

function IceCashSummary({
  disabled,
  draftDifference,
  hasSourceCorrection,
  inputValue,
  onInputChange,
  onNoteChange,
  onSaveSourceCorrection,
  onSourceDraftChange,
  onToggleChecked,
  record,
  sourceCountedInputValue,
  sourceStartInputValue,
}: Readonly<{
  disabled: boolean;
  draftDifference: number;
  hasSourceCorrection: boolean;
  inputValue: string;
  onInputChange: (value: string) => void;
  onNoteChange: (value: string) => void;
  onSaveSourceCorrection: () => void;
  onSourceDraftChange: (
    field: "startCash" | "countedCash",
    value: string
  ) => void;
  onToggleChecked: () => void;
  record: RevenueCashRecord;
  sourceCountedInputValue: string;
  sourceStartInputValue: string;
}>) {
  const expectedCash = iceExpectedCash(record);
  const countedCash = iceReportedCountedCash(record);
  const differenceTone =
    record.iceDifference !== undefined && Math.abs(record.iceDifference) > 0.05
      ? "warn"
      : "normal";
  const isChecked = Boolean(record.iceCheckedAt);

  return (
    <article className="mt-2 rounded-md border border-[#c8ddd2] bg-[#f6fbf5] px-3 py-2">
      <div className="grid gap-3 lg:grid-cols-[14rem_minmax(0,1fr)_7rem] lg:items-start">
        <label className="flex items-start gap-2">
          <input
            type="checkbox"
            checked={isChecked}
            disabled={disabled}
            onChange={onToggleChecked}
            className="mt-0.5 h-4 w-4 accent-[#1f4f35]"
          />
          <span>
            <span className="block text-[0.58rem] font-black uppercase tracking-normal text-[#1f4f35]">
              IJstelling
            </span>
            <span className="block text-sm font-black leading-tight text-[#1a1815]">
              {dayName(record.date)} · {record.shop}
            </span>
            <span
              className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[0.58rem] font-black uppercase tracking-normal ${
                isChecked
                  ? "bg-[#dfeadd] text-[#1f4f35]"
                  : "bg-[#f5ead6] text-[#7a5417]"
              }`}
            >
              {isChecked ? "compleet" : "open"}
            </span>
            <span className="mt-1 block text-[0.62rem] font-bold text-[#6b645b]">
              {record.iceCountedBy || record.iceClosedAt || "via dagrapport"}
            </span>
          </span>
        </label>

        <div className="grid gap-x-4 gap-y-2 sm:grid-cols-3 xl:grid-cols-6">
          <AmountCell
            label="Start"
            value={formatOptionalMoney(record.iceStartCash)}
          />
          <AmountCell
            label="Geteld"
            value={formatOptionalMoney(countedCash)}
          />
          <AmountCell
            label="Kas-uit"
            value={formatOptionalMoney(record.iceCashOut)}
            tone={
              record.iceCashOut !== undefined && Math.abs(record.iceCashOut) > 0.01
                ? "warn"
                : "normal"
            }
          />
          <AmountCell
            label="Bonnen"
            value={formatOptionalMoney(record.iceReceipts)}
            tone={
              record.iceReceipts !== undefined && Math.abs(record.iceReceipts) > 0.01
                ? "warn"
                : "normal"
            }
          />
          <AmountCell label="Naar kluis" value={formatMoney(expectedCash)} />
          <AmountCell
            label="Kasverschil"
            value={formatOptionalMoney(record.iceDifference)}
            tone={differenceTone}
          />
        </div>

        <button
          type="button"
          onClick={onToggleChecked}
          disabled={disabled}
          className={`h-9 rounded-md border px-2 text-[0.62rem] font-black uppercase tracking-normal disabled:opacity-60 ${
            isChecked
              ? "border-[#d9d2c9] bg-white text-[#6b645b]"
              : "border-[#1f4f35] bg-[#1f4f35] text-white"
          }`}
        >
          {isChecked ? "Heropenen" : "Afvinken"}
        </button>
      </div>

      <div className="mt-3 grid gap-2 border-t border-[#c8ddd2]/80 pt-2 lg:grid-cols-[12rem_7rem_minmax(14rem,1fr)] lg:items-end">
        <div className="grid gap-2 rounded-md border border-[#c8ddd2] bg-white/70 p-2 lg:col-span-3 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
          <label className="grid gap-0.5 text-[0.56rem] font-black uppercase tracking-normal text-[#8b8278]">
            Startbedrag
            <input
              value={sourceStartInputValue}
              onChange={(event) =>
                onSourceDraftChange("startCash", event.target.value)
              }
              inputMode="decimal"
              disabled={isChecked || disabled}
              placeholder="0,00"
              className="h-8 rounded-md border border-[#c8ddd2] bg-white px-2 text-sm font-black normal-case tracking-normal text-[#1a1815] disabled:opacity-60"
            />
          </label>

          <label className="grid gap-0.5 text-[0.56rem] font-black uppercase tracking-normal text-[#8b8278]">
            Sluitbedrag
            <input
              value={sourceCountedInputValue}
              onChange={(event) =>
                onSourceDraftChange("countedCash", event.target.value)
              }
              inputMode="decimal"
              disabled={isChecked || disabled}
              placeholder="0,00"
              className="h-8 rounded-md border border-[#c8ddd2] bg-white px-2 text-sm font-black normal-case tracking-normal text-[#1a1815] disabled:opacity-60"
            />
          </label>

          <button
            type="button"
            onClick={onSaveSourceCorrection}
            disabled={isChecked || disabled || !hasSourceCorrection}
            className="h-8 rounded-md border border-[#1f4f35] bg-[#1f4f35] px-2 text-[0.58rem] font-black uppercase tracking-normal text-white disabled:border-[#c8ddd2] disabled:bg-white disabled:text-[#8b8278] disabled:opacity-60"
          >
            Corrigeren
          </button>
        </div>

        <label className="grid gap-0.5 text-[0.56rem] font-black uppercase tracking-normal text-[#8b8278]">
          Controlebedrag
          <input
            value={inputValue}
            onChange={(event) => onInputChange(event.target.value)}
            inputMode="decimal"
            disabled={isChecked || disabled}
            placeholder="0,00"
            className="h-9 rounded-md border border-[#c8ddd2] bg-white px-2 text-sm font-black normal-case tracking-normal text-[#1a1815] disabled:opacity-60"
          />
        </label>

        <AmountCell
          label="Verschil"
          value={formatMoney(draftDifference)}
          tone={Math.abs(draftDifference) > 0.01 ? "warn" : "normal"}
        />

        <label className="grid gap-0.5 text-[0.56rem] font-black uppercase tracking-normal text-[#8b8278]">
          Controle-notitie
          <input
            value={visibleIceCashNote(record.iceNote)}
            onChange={(event) => onNoteChange(event.target.value)}
            disabled={isChecked || disabled}
            placeholder="Bijv. opnieuw geteld of kasverschil verklaard"
            className="h-9 rounded-md border border-[#c8ddd2] bg-white px-2 text-xs font-bold normal-case tracking-normal text-[#1a1815] disabled:opacity-60"
          />
        </label>
      </div>
    </article>
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
        <p className="text-[0.55rem] font-black uppercase tracking-normal text-[#8b8278]">
          Briefjescontrole
        </p>
        <p className="truncate text-[0.58rem] font-bold text-[#8b8278]">
          {record.countedBy || "teller onbekend"}
        </p>
      </div>
      <div className="mt-1 overflow-hidden rounded-md border border-[#e7e0d8] bg-white">
        <div className="grid grid-cols-[4.6rem_4.5rem_5rem_minmax(5.5rem,1fr)] border-b border-[#e7e0d8] bg-[#f8f6f3] px-2 py-1 text-[0.54rem] font-black uppercase tracking-normal text-[#8b8278]">
          <span>Briefje</span>
          <span>Geteld</span>
          <span>Werkelijk</span>
          <span>Verschil</span>
        </div>
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
              className="grid grid-cols-[4.6rem_4.5rem_5rem_minmax(5.5rem,1fr)] items-center border-b border-[#eee7df] px-2 py-1 last:border-b-0"
            >
              <CashNote denomination={denomination} />
              <span className="text-xs font-black text-[#1a1815]">
                {expected}
              </span>
              <input
                value={inputValue}
                onChange={(event) => onChange(denomination.key, event.target.value)}
                inputMode="numeric"
                disabled={disabled}
                className="h-7 w-14 rounded-md border border-[#d9d2c9] bg-white px-2 text-sm font-black text-[#1a1815] disabled:opacity-60"
              />
              <span
                className={`text-xs font-black ${
                  valueDifference === 0 ? "text-[#6b645b]" : "text-[#7a5417]"
                }`}
              >
                {countDifference > 0 ? "+" : ""}
                {countDifference} · {formatMoney(valueDifference)}
              </span>
            </div>
          );
        })}
      </div>
      <div
        className={`mt-1 text-right text-xs font-black ${
          totalDifference === 0 ? "text-[#6b645b]" : "text-[#7a5417]"
        }`}
      >
        Briefjesverschil: {formatMoney(totalDifference)}
      </div>
    </div>
  );
}

function CashNote({
  denomination,
}: Readonly<{
  denomination: (typeof banknoteDenominations)[number];
}>) {
  const style = banknoteStyles[denomination.key] || banknoteStyles.eur5;

  return (
    <span
      aria-hidden="true"
      className="relative inline-flex h-6 w-14 items-center justify-center overflow-hidden rounded-[3px] border text-[0.58rem] font-black shadow-sm"
      style={{
        background: `linear-gradient(135deg, ${style.bg}, #fffdf8 48%, ${style.bg})`,
        borderColor: style.border,
        color: style.text,
      }}
    >
      <span className="absolute left-1 top-1 h-1.5 w-1.5 rounded-full border border-current opacity-45" />
      <span>EUR {denomination.label}</span>
      <span className="absolute bottom-1 right-1 h-1.5 w-1.5 rounded-full border border-current opacity-45" />
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
    <div className={tone === "warn" ? "text-[#7a5417]" : "text-[#1a1815]"}>
      <p className="text-[0.55rem] font-black uppercase tracking-normal text-[#8b8278]">
        {label}
      </p>
      <p className="whitespace-nowrap text-sm font-black leading-tight">{value}</p>
    </div>
  );
}

function StatBox({
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
      className={`rounded-md border px-2 py-1 ${
        tone === "warn"
          ? "border-[#efd1a1] bg-[#fff8d8]"
          : "border-[#e7e0d8] bg-white"
      }`}
    >
      <p className="text-[0.55rem] font-black uppercase tracking-normal text-[#8b8278]">
        {label}
      </p>
      <p className="truncate text-sm font-black leading-tight text-[#1a1815]">
        {value}
      </p>
    </div>
  );
}
