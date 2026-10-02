"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  cashDenominationTotal,
  cashDenominations,
  createRevenueCashDepositKey,
  mergeRevenueCashDeposits,
  revenueShops,
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

type CashLocationKind = "patisserie" | "ice";

type DepositReportOption = {
  key: string;
  year: number;
  week: number;
  weekLabel: string;
  shop: RevenueShop;
  kind: CashLocationKind;
  label: string;
  amount: number;
  reported: boolean;
  reportedAt?: string;
};

const euroFormatter = new Intl.NumberFormat("nl-NL", {
  currency: "EUR",
  style: "currency",
});

function isPatisserieDepositClosed(deposit: RevenueCashDeposit | undefined) {
  return Boolean(
    deposit &&
      (deposit.patisserieClosedAt ||
        deposit.closedAt ||
        deposit.cashbookBookedAt)
  );
}

function isIceDepositClosed(deposit: RevenueCashDeposit | undefined) {
  return Boolean(
    deposit &&
      (deposit.iceDepositClosedAt ||
        deposit.closedAt ||
        deposit.cashbookBookedAt)
  );
}

function isPatisserieDepositReported(deposit: RevenueCashDeposit | undefined) {
  return Boolean(deposit?.patisserieReportedAt || deposit?.cashbookBookedAt);
}

function isIceDepositReported(deposit: RevenueCashDeposit | undefined) {
  return Boolean(deposit?.iceReportedAt || deposit?.cashbookBookedAt);
}

function cashDepositLockedAt(deposit: RevenueCashDeposit) {
  return deposit.closedAt || deposit.cashbookBookedAt || "";
}

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

function hasNonWholeMoney(value: number) {
  return Math.abs(roundedMoney(value) - Math.round(value)) > 0.009;
}

function safeExpectedCashFromValues(startCash: number, countedCash: number) {
  return Math.max(0, roundedMoney((countedCash || 0) - startCash));
}

function safeExpectedCash(record: RevenueCashRecord | undefined) {
  if (!record) return 0;

  if (record.cashRevenue !== undefined) {
    return Math.max(
      0,
      roundedMoney(record.cashRevenue - (cashOutAmount(record) || 0))
    );
  }

  if (record.startCash !== undefined) {
    return safeExpectedCashFromValues(record.startCash, record.countedCash || 0);
  }

  return record.countedCash ?? 0;
}

function safeCheckedCash(record: RevenueCashRecord | undefined) {
  if (!record) return 0;

  return record.safeCash ?? safeExpectedCash(record);
}

function safeDifference(record: RevenueCashRecord | undefined) {
  if (!record) return 0;

  return Number((safeCheckedCash(record) - safeExpectedCash(record)).toFixed(2));
}

function cashNoteCount(record: RevenueCashRecord, key: CashDenominationKey) {
  return Math.max(0, Math.trunc(Number(record.denominations[key]) || 0));
}

function cashDenominationKindTotal(
  record: RevenueCashRecord,
  kind: "note" | "coin"
) {
  return Number(
    cashDenominations
      .filter((denomination) => denomination.kind === kind)
      .reduce(
        (total, denomination) =>
          total + cashNoteCount(record, denomination.key) * denomination.value,
        0
      )
      .toFixed(2)
  );
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

function cashSourceDraftKey(record: RevenueCashRecord) {
  return `${record.date}:${record.shop}:source`;
}

function parseCorrectionAmount(value: string | undefined, fallback: number) {
  if (value === undefined || !value.trim()) return fallback;

  return parseAmount(value);
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

function cashLocationKey(kind: CashLocationKind, shop: RevenueShop) {
  return `${kind}:${shop}`;
}

function cashLocationLabel(kind: CashLocationKind, shop: RevenueShop) {
  return `${shop} ${kind === "ice" ? "ijs" : "Patisserie"}`;
}

function depositReportKey(
  year: number,
  week: number,
  kind: CashLocationKind,
  shop: RevenueShop
) {
  return `${year}-W${String(week).padStart(2, "0")}:${kind}:${shop}`;
}

function parseCashLocationKey(
  value: string
): { kind: CashLocationKind; shop: RevenueShop } | null {
  const [kind, shop] = value.split(":");

  if (
    (kind === "patisserie" || kind === "ice") &&
    revenueShops.includes(shop as RevenueShop)
  ) {
    return {
      kind: kind as CashLocationKind,
      shop: shop as RevenueShop,
    };
  }

  return null;
}

function dailyRecordsForWeek(
  records: RevenueDayRecord[],
  year: number,
  week: number,
  shop: RevenueShop
) {
  return records.filter(
    (record) => record.year === year && record.week === week && record.shop === shop
  );
}

function cashRevenueAmount(record: RevenueCashRecord) {
  return record.cashRevenue ?? record.countedCash ?? 0;
}

function pinRevenueAmount(
  record: RevenueCashRecord,
  dayRecord: RevenueDayRecord | undefined
) {
  if (!dayRecord) return 0;

  return Math.max(
    0,
    roundedMoney(
      dayRecord.amount - cashRevenueAmount(record) - (receiptAmount(record) || 0)
    )
  );
}

function sortCashRecords(records: RevenueCashRecord[]) {
  return [...records].sort(
    (a, b) =>
      b.date.localeCompare(a.date) ||
      revenueShops.indexOf(a.shop) - revenueShops.indexOf(b.shop)
  );
}

function syncOpenCashDepositWithCheckedDays(
  deposits: RevenueCashDeposit[],
  records: RevenueCashRecord[],
  record: RevenueCashRecord
) {
  const deposit = existingDepositFor(
    deposits,
    record.year,
    record.week,
    record.shop
  );
  if (!deposit || isPatisserieDepositClosed(deposit)) return deposits;

  const checkedRecords = recordsForWeek(
    records,
    record.year,
    record.week,
    record.shop
  ).filter((item) => hasPatisserieCashRecord(item) && item.checkedAt);
  const amount = roundedMoney(
    checkedRecords.reduce(
      (total, item) => total + safeCheckedCash(item),
      0
    )
  );
  const dateRange = checkedRecords.map((item) => item.date).sort();

  return deposits.map((item) =>
    item.id === deposit.id
      ? {
          ...item,
          amount,
          cashRecordIds: checkedRecords.map((checkedRecord) => checkedRecord.id),
          dateFrom: dateRange[0],
          dateTo: dateRange.at(-1),
          updatedAt: new Date().toISOString(),
        }
      : item
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

function isShopClosedDayRecord(record: RevenueDayRecord | undefined) {
  return Boolean(
    record &&
      (record.shopClosed === true ||
        String(record.note || "")
          .toLowerCase()
          .includes("winkel was gesloten"))
  );
}

function hasRevenueDayReport(record: RevenueDayRecord | undefined) {
  return Boolean(
    record &&
      (isShopClosedDayRecord(record) ||
        record.amount > 0 ||
        String(record.note || "").trim())
  );
}

function cashWarning(record: RevenueCashRecord | undefined) {
  if (!record) return "Geen Cash-it dagafsluiting ontvangen.";
  const calculatedDenominationTotal = cashDenominationTotal(
    record.denominations
  );
  if (Math.abs(record.countedCash - calculatedDenominationTotal) > 0.01) {
    return `Coupures zijn ${formatMoney(calculatedDenominationTotal)}, dagafsluiting is ${formatMoney(record.countedCash)}.`;
  }
  if (record.checkedAt && Math.abs(safeDifference(record)) > 0.01) {
    return "De managementtelling wijkt af van de geregistreerde cash omzet.";
  }
  if (record.difference !== undefined && Math.abs(record.difference) > 5) {
    return "Kasverschil in de dagafsluiting is groter dan EUR 5.";
  }

  return "";
}

export default function CashCountManager() {
  const [selectedDate, setSelectedDate] = useState(localIsoDate());
  const [selectedShop, setSelectedShop] = useState<RevenueShop>(revenueShops[0]);
  const [selectedCashLocationKind, setSelectedCashLocationKind] =
    useState<CashLocationKind>("patisserie");
  const [records, setRecords] = useState<RevenueRecord[]>([]);
  const [dailyRecords, setDailyRecords] = useState<RevenueDayRecord[]>([]);
  const [cashRecords, setCashRecords] = useState<RevenueCashRecord[]>([]);
  const [cashDeposits, setCashDeposits] = useState<RevenueCashDeposit[]>([]);
  const [safeCashDrafts, setSafeCashDrafts] = useState<Record<string, string>>({});
  const [cashNoteModalOpen, setCashNoteModalOpen] = useState(false);
  const [cashSourceDrafts, setCashSourceDrafts] = useState<
    Record<string, { startCash?: string; countedCash?: string }>
  >({});
  const [actualDepositDrafts, setActualDepositDrafts] = useState<Record<string, string>>({});
  const [differenceNotes, setDifferenceNotes] = useState<Record<string, string>>({});
  const [iceDepositDrafts, setIceDepositDrafts] = useState<Record<string, string>>({});
  const [iceDepositNotes, setIceDepositNotes] = useState<Record<string, string>>({});
  const [state, setState] = useState<LoadState>("loading");
  const [mailState, setMailState] = useState<"idle" | "sending">("idle");
  const [depositReportOpen, setDepositReportOpen] = useState(false);
  const [depositReportSelection, setDepositReportSelection] = useState<string[]>([]);
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
        if (latestRecord) {
          setSelectedShop(latestRecord.shop);
          setSelectedCashLocationKind(
            hasIceCashRecord(latestRecord) && !hasPatisserieCashRecord(latestRecord)
              ? "ice"
              : "patisserie"
          );
        }
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
  const selectedWeekDeposits = cashDeposits.filter(
    (deposit) =>
      deposit.year === selectedWeek.year && deposit.week === selectedWeek.week
  );
  const isIceSeasonOpen =
    selectedWeekDeposits.find(
      (deposit) => deposit.iceSeasonOpen !== undefined
    )?.iceSeasonOpen ?? true;
  const weekRows = useMemo(
    () =>
      revenueShops.map((shop) => {
        const shopRecords = recordsForWeek(
          cashRecords,
          selectedWeek.year,
          selectedWeek.week,
          shop
        ).sort((first, second) => first.date.localeCompare(second.date));
        const shopDayRecords = dailyRecordsForWeek(
          dailyRecords,
          selectedWeek.year,
          selectedWeek.week,
          shop
        );
        const dayRecordByDate = new Map(
          shopDayRecords.map((record) => [record.date, record])
        );
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
        const closedDates = expectedDates.filter(
          (date) => isShopClosedDayRecord(dayRecordByDate.get(date))
        );
        const checkedIceRecords = iceRecords.filter(
          (record) => record.iceCheckedAt
        );
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
          (total, record) => total + cashRevenueAmount(record),
          0
        );
        const includedPinRevenue = checkedRecords.reduce(
          (total, record) =>
            total + pinRevenueAmount(record, dayRecordByDate.get(record.date)),
          0
        );
        const includedReceipts = checkedRecords.reduce(
          (total, record) => total + (receiptAmount(record) || 0),
          0
        );
        const includedCashOut = checkedRecords.reduce(
          (total, record) => total + (cashOutAmount(record) || 0),
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
        const includedIceCash = checkedIceRecords.reduce(
          (total, record) => total + iceCheckedCash(record),
          0
        );
        const includedIceCashRevenue = checkedIceRecords.reduce(
          (total, record) =>
            total + (record.iceCashRevenue ?? iceExpectedCash(record)),
          0
        );
        const includedIceReceipts = checkedIceRecords.reduce(
          (total, record) => total + (record.iceReceipts || 0),
          0
        );
        const includedIceCashOut = checkedIceRecords.reduce(
          (total, record) => total + (record.iceCashOut || 0),
          0
        );
        const includedIceCashDifference = checkedIceRecords.reduce(
          (total, record) => total + (record.iceDifference || 0),
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
        const bankAmount = deposit?.actualAmount ?? includedCheckedSafeCash;
        const iceBankAmount = deposit?.iceDepositAmount ?? includedIceCash;
        const patisserieComplete =
          expectedDates.length > 0 &&
          expectedDates.length <= checkedRecords.length + closedDates.length &&
          expectedDates.every(
            (date) =>
              isShopClosedDayRecord(dayRecordByDate.get(date)) ||
              Boolean(
                hasPatisserieCashRecord(
                  findCashRecord(shopRecords, date, shop)
                ) && findCashRecord(shopRecords, date, shop)?.checkedAt
              )
          );
        const iceComplete =
          iceRecords.length > 0 &&
          checkedIceRecords.length >= iceRecords.length &&
          deposit?.iceDepositAmount !== undefined &&
          Boolean(deposit.iceDepositedAt);

        return {
          shop,
          records: shopRecords,
          cashRevenue,
          expectedSafeCash,
          checkedSafeCash,
          includedCashRevenue,
          includedPinRevenue,
          includedReceipts,
          includedCashOut,
          includedCheckedSafeCash,
          difference,
          iceCash,
          includedIceCash,
          includedIceCashRevenue,
          includedIceReceipts,
          includedIceCashOut,
          includedIceCashDifference,
          iceCount: iceRecords.length,
          iceCheckedCount,
          checkedCount: checkedRecords.length + closedDates.length,
          expectedCount: expectedDates.length,
          missingCount: expectedDates.filter(
            (date) =>
              !isShopClosedDayRecord(dayRecordByDate.get(date)) &&
              !hasPatisserieCashRecord(findCashRecord(shopRecords, date, shop))
          ).length,
          missingRevenueCount: expectedDates.filter(
            (date) =>
              date < localIsoDate() &&
              !isShopClosedDayRecord(dayRecordByDate.get(date)) &&
              !hasRevenueDayReport(dayRecordByDate.get(date))
          ).length,
          closedCount: closedDates.length,
          expectedDates,
          deposit,
          bankAmount,
          iceBankAmount,
          patisserieComplete,
          iceComplete,
          patisserieClosed: isPatisserieDepositClosed(deposit),
          iceClosed: isIceDepositClosed(deposit),
        };
      }),
    [
      cashDeposits,
      cashRecords,
      dailyRecords,
      selectedWeek.week,
      selectedWeek.year,
      selectedWeekDates,
    ]
  );
  const cashLocationRows = weekRows.flatMap((row) => {
        const locations: Array<{
          key: string;
          kind: CashLocationKind;
          shop: RevenueShop;
          label: string;
          checkedCount: number;
          expectedCount: number;
          missingCount: number;
          weekTotal: number;
          complete: boolean;
          closed: boolean;
          deposited: boolean;
        }> = [{
          key: cashLocationKey("patisserie", row.shop),
          kind: "patisserie" as const,
          shop: row.shop,
          label: cashLocationLabel("patisserie", row.shop),
          checkedCount: row.checkedCount,
          expectedCount: row.expectedCount,
          missingCount: row.missingCount,
          weekTotal: row.bankAmount,
          complete: row.patisserieComplete,
          closed: row.patisserieClosed,
          deposited: isPatisserieDepositReported(row.deposit),
        }];

        if (isIceSeasonOpen) locations.push({
          key: cashLocationKey("ice", row.shop),
          kind: "ice" as const,
          shop: row.shop,
          label: cashLocationLabel("ice", row.shop),
          checkedCount: row.iceCheckedCount,
          expectedCount: row.iceCount,
          missingCount: 0,
          weekTotal: row.iceBankAmount,
          complete: row.iceComplete,
          closed: row.iceClosed,
          deposited: isIceDepositReported(row.deposit),
        });

    return locations;
  });
  useEffect(() => {
    if (isIceSeasonOpen || selectedCashLocationKind !== "ice") return;

    setSelectedCashLocationKind("patisserie");
  }, [isIceSeasonOpen, selectedCashLocationKind]);
  const selectedCashLocationKey = cashLocationKey(
    selectedCashLocationKind,
    selectedShop
  );
  const selectedCashLocationRow =
    cashLocationRows.find((row) => row.key === selectedCashLocationKey) ||
    cashLocationRows[0];
  const selectedShopRow =
    weekRows.find((row) => row.shop === selectedShop) || weekRows[0];
  const selectedShopDays = useMemo(
    () =>
      selectedWeekDates.map((date) => {
        const record = findCashRecord(cashRecords, date, selectedShop);
        const revenueRecord = dailyRecords.find(
          (dayRecord) =>
            dayRecord.date === date && dayRecord.shop === selectedShop
        );

        return {
          date,
          patisserieRecord: hasPatisserieCashRecord(record) ? record : undefined,
          iceRecord: hasIceCashRecord(record) ? record : undefined,
          revenueRecord,
          hasRevenue: hasRevenueDayReport(revenueRecord),
          isExpected:
            isCashExpectedForShopDate(selectedShop, date) ||
            hasPatisserieCashRecord(record) ||
            isShopClosedDayRecord(revenueRecord),
        };
      }),
    [cashRecords, dailyRecords, selectedShop, selectedWeekDates]
  );
  const selectedShopDay =
    selectedShopDays.find((day) => day.date === selectedDate) ||
    selectedShopDays[0];
  const selectedShopDayIsPast = Boolean(
    selectedShopDay && selectedShopDay.date < localIsoDate()
  );
  const selectedRevenueDayRecord = dailyRecords.find(
    (record) => record.date === selectedDate && record.shop === selectedShop
  );
  const selectedPatisserieCashRecord =
    selectedCashLocationKind === "patisserie"
      ? selectedShopDay?.patisserieRecord
      : undefined;
  const selectedIceCashRecord =
    selectedCashLocationKind === "ice" ? selectedShopDay?.iceRecord : undefined;
  const selectedCashRecord = selectedPatisserieCashRecord;
  const selectedCashWarning = cashWarning(selectedCashRecord);
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
  const selectedBanknoteTotal = selectedCashRecord
    ? cashDenominationKindTotal(selectedCashRecord, "note")
    : 0;
  const selectedCoinTotal = selectedCashRecord
    ? cashDenominationKindTotal(selectedCashRecord, "coin")
    : 0;
  const selectedDenominationBreakdownTotal = Number(
    (selectedBanknoteTotal + selectedCoinTotal).toFixed(2)
  );
  const selectedDenominationSourceDifference = selectedCashRecord
    ? Number(
        (
          selectedCashRecord.countedCash - selectedDenominationBreakdownTotal
        ).toFixed(2)
      )
    : 0;
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
  const selectedCorrectedStartCash = selectedCashRecord
    ? parseCorrectionAmount(
        selectedSourceDraft?.startCash,
        selectedCashRecord.startCash ?? 0
      )
    : 0;
  const selectedSafeDraftKey = selectedCashRecord
    ? `${selectedCashRecord.date}:${selectedCashRecord.shop}`
    : "";
  const selectedSafeInputValue = selectedCashRecord
    ? safeCashDrafts[selectedSafeDraftKey] ??
      (selectedCashRecord.safeCash === undefined
        ? ""
        : formatAmountInput(
            selectedCashRecord.safeCash + selectedCorrectedStartCash
          ))
    : "";
  const selectedHasManagementCount = Boolean(selectedSafeInputValue.trim());
  const selectedManagementSafeCash = selectedHasManagementCount
    ? Math.max(
        0,
        roundedMoney(
          parseAmount(selectedSafeInputValue) - selectedCorrectedStartCash
        )
      )
    : undefined;
  const selectedExpectedCash = selectedCashRecord
    ? safeExpectedCash(selectedCashRecord)
    : 0;
  const selectedSafeDraftDifference =
    selectedManagementSafeCash === undefined
      ? undefined
      : roundedMoney(selectedManagementSafeCash - selectedExpectedCash);
  const selectedRegisteredCash = selectedCashRecord
    ? cashRevenueAmount(selectedCashRecord)
    : undefined;
  const selectedRegisteredPin = selectedCashRecord
    ? selectedRevenueDayRecord
      ? pinRevenueAmount(selectedCashRecord, selectedRevenueDayRecord)
      : undefined
    : undefined;
  const selectedRegisteredTotal = selectedRevenueDayRecord?.amount;
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
  const weekCheckedCount = weekRows.reduce(
    (total, row) => total + row.checkedCount,
    0
  );
  const weekExpectedCount = weekRows.reduce(
    (total, row) => total + row.expectedCount,
    0
  );
  const weekMissingRevenueCount = weekRows.reduce(
    (total, row) => total + row.missingRevenueCount,
    0
  );
  const weekBankTotal = roundedMoney(
    weekRows.reduce(
      (total, row) =>
        total + row.bankAmount + (isIceSeasonOpen ? row.iceBankAmount : 0),
      0
    )
  );
  const isSelectedWeekClosed =
    selectedWeekDeposits.length >= revenueShops.length &&
    revenueShops.every((shop) =>
      {
        const deposit = selectedWeekDeposits.find(
          (item) => item.shop === shop
        );

        return (
          isPatisserieDepositClosed(deposit) &&
          (!isIceSeasonOpen || isIceDepositClosed(deposit))
        );
      }
    );
  const isSelectedWeekCashbookBooked = selectedWeekDeposits.some(
    (deposit) => Boolean(deposit.cashbookBookedAt)
  );
  const isSelectedWeekReported = selectedWeekDeposits.some(
    (deposit) =>
      isPatisserieDepositReported(deposit) || isIceDepositReported(deposit)
  );
  const selectedWeekClosedAt = selectedWeekDeposits.find(
    (deposit) =>
      cashDepositLockedAt(deposit) ||
      deposit.patisserieClosedAt ||
      deposit.iceDepositClosedAt
  );
  const selectedWeekClosedAtLabel = selectedWeekClosedAt
    ? cashDepositLockedAt(selectedWeekClosedAt) ||
      selectedWeekClosedAt.patisserieClosedAt ||
      selectedWeekClosedAt.iceDepositClosedAt ||
      ""
    : "";
  const isSelectedCashLocationClosed = Boolean(
    selectedCashLocationRow?.closed
  );
  const isSelectedCashLocationReported = Boolean(
    selectedCashLocationRow?.deposited
  );
  const isSelectedCashLocationComplete = Boolean(
    selectedCashLocationRow?.complete
  );
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
    cashDeposits.forEach((deposit) => {
      const key = weekKey(deposit.year, deposit.week);
      byKey.set(key, { key, year: deposit.year, week: deposit.week });
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
  }, [cashDeposits, cashRecords, depositWeekKey, selectedWeek.week, selectedWeek.year]);
  const depositReportOptions = useMemo<DepositReportOption[]>(() => {
    const options = cashDeposits.flatMap((deposit) => {
      const next: DepositReportOption[] = [];
      const rangeLabel = weekRangeLabel(deposit.year, deposit.week);
      const weekDeposits = cashDeposits.filter(
        (item) => item.year === deposit.year && item.week === deposit.week
      );
      const iceSeasonOpen =
        weekDeposits.find((item) => item.iceSeasonOpen !== undefined)
          ?.iceSeasonOpen ?? true;

      if (isPatisserieDepositClosed(deposit)) {
        next.push({
          key: depositReportKey(
            deposit.year,
            deposit.week,
            "patisserie",
            deposit.shop
          ),
          year: deposit.year,
          week: deposit.week,
          weekLabel: rangeLabel,
          shop: deposit.shop,
          kind: "patisserie",
          label: cashLocationLabel("patisserie", deposit.shop),
          amount: roundedMoney(deposit.actualAmount ?? deposit.amount),
          reported: isPatisserieDepositReported(deposit),
          reportedAt:
            deposit.patisserieReportedAt || deposit.cashbookBookedAt,
        });
      }

      const hasIceData =
        deposit.iceDepositAmount !== undefined ||
        cashRecords.some(
          (record) =>
            record.year === deposit.year &&
            record.week === deposit.week &&
            record.shop === deposit.shop &&
            hasIceCashRecord(record)
        );
      if (iceSeasonOpen && hasIceData && isIceDepositClosed(deposit)) {
        next.push({
          key: depositReportKey(
            deposit.year,
            deposit.week,
            "ice",
            deposit.shop
          ),
          year: deposit.year,
          week: deposit.week,
          weekLabel: rangeLabel,
          shop: deposit.shop,
          kind: "ice",
          label: cashLocationLabel("ice", deposit.shop),
          amount: roundedMoney(deposit.iceDepositAmount ?? 0),
          reported: isIceDepositReported(deposit),
          reportedAt: deposit.iceReportedAt || deposit.cashbookBookedAt,
        });
      }

      return next;
    });

    return options.sort(
      (first, second) =>
        second.year - first.year ||
        second.week - first.week ||
        revenueShops.indexOf(first.shop) - revenueShops.indexOf(second.shop) ||
        first.kind.localeCompare(second.kind)
    );
  }, [cashDeposits, cashRecords]);
  const unreportedDepositOptions = depositReportOptions.filter(
    (option) => !option.reported
  );
  const selectedDepositReportOptions = depositReportOptions.filter(
    (option) =>
      !option.reported && depositReportSelection.includes(option.key)
  );
  const selectedDepositReportTotal = roundedMoney(
    selectedDepositReportOptions.reduce(
      (total, option) => total + option.amount,
      0
    )
  );
  const depositReportGroups = Array.from(
    depositReportOptions.reduce(
      (groups, option) => {
        const key = weekKey(option.year, option.week);
        const current = groups.get(key);
        if (current) {
          current.options.push(option);
        } else {
          groups.set(key, {
            key,
            year: option.year,
            week: option.week,
            weekLabel: option.weekLabel,
            options: [option],
          });
        }
        return groups;
      },
      new Map<
        string,
        {
          key: string;
          year: number;
          week: number;
          weekLabel: string;
          options: DepositReportOption[];
        }
      >()
    ).values()
  );

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

  function isCashRecordInClosedLocation(
    record: RevenueCashRecord,
    kind: CashLocationKind
  ) {
    const deposit = cashDeposits.find(
      (item) =>
        item.year === record.year &&
        item.week === record.week &&
        item.shop === record.shop
    );

    return kind === "ice"
      ? isIceDepositClosed(deposit)
      : isPatisserieDepositClosed(deposit);
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
    if (isCashRecordInClosedLocation(record, "patisserie")) {
      setStatus("Deze winkelweek is gesloten. Heropen de locatie om te wijzigen.");
      return;
    }

    const key = `${record.date}:${record.shop}`;
    const sourceKey = cashSourceDraftKey(record);
    const startCash = parseCorrectionAmount(
      cashSourceDrafts[sourceKey]?.startCash,
      record.startCash ?? 0
    );
    const countedInput =
      safeCashDrafts[key] ??
      (record.safeCash === undefined
        ? ""
        : formatAmountInput(record.safeCash + startCash));
    if (!countedInput.trim()) {
      setStatus("Vul bij de managementcontrole eerst het werkelijk getelde bedrag in.");
      return;
    }

    const managementCountedCash = parseAmount(countedInput);
    if (managementCountedCash < startCash) {
      setStatus("Het werkelijk getelde bedrag kan niet lager zijn dan het startgeld.");
      return;
    }

    const safeCash = roundedMoney(managementCountedCash - startCash);
    const expectedSafeCash = safeExpectedCash(record);
    const startCashChanged =
      Math.abs(startCash - (record.startCash ?? 0)) > 0.01;
    const now = new Date().toISOString();
    const nextCashRecords = buildUpdatedCashRecords(
      cashRecords,
      record.date,
      record.shop,
      (current) => ({
        ...current,
        cashImportKind: "patisserie",
        startCash,
        safeCash,
        safeDifference: roundedMoney(safeCash - expectedSafeCash),
        checkedAt: now,
        checkedBy: "Geld teller",
        note: appendCashNotes(visibleCashNote(current.note), [
          startCashChanged
            ? `startbedrag gecorrigeerd van ${formatMoney(record.startCash ?? 0)} naar ${formatMoney(startCash)}`
            : "",
        ]),
        updatedAt: now,
      })
    );

    const nextCashDeposits = syncOpenCashDepositWithCheckedDays(
      cashDeposits,
      nextCashRecords,
      record
    );
    setCashRecords(nextCashRecords);
    setCashDeposits(nextCashDeposits);
    const saved = await saveCash(nextCashDeposits, nextCashRecords);
    if (saved) setStatus("De managementcontrole is opgeslagen en afgevinkt.");
  }

  async function unmarkChecked(record: RevenueCashRecord) {
    if (isCashRecordInClosedLocation(record, "patisserie")) {
      setStatus("Deze winkelweek is gesloten. Heropen de locatie om te wijzigen.");
      return;
    }

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

    const nextCashDeposits = syncOpenCashDepositWithCheckedDays(
      cashDeposits,
      nextCashRecords,
      record
    );
    setCashRecords(nextCashRecords);
    setCashDeposits(nextCashDeposits);
    await saveCash(nextCashDeposits, nextCashRecords);
  }

  async function toggleChecked(record: RevenueCashRecord) {
    if (record.checkedAt) {
      await unmarkChecked(record);
      return;
    }

    await markChecked(record);
  }

  async function markShopClosed(date: string, shop: RevenueShop) {
    const parts = weekPartsForDate(date);
    if (
      isPatisserieDepositClosed(
        existingDepositFor(cashDeposits, parts.year, parts.week, shop)
      )
    ) {
      setStatus("Deze winkelweek is gesloten. Heropen de locatie om te wijzigen.");
      return;
    }

    const confirmed = window.confirm(
      `Wil je ${shop} op ${dayName(date)} markeren als gesloten?`
    );
    if (!confirmed) return;

    const now = new Date().toISOString();
    const closedRecord: RevenueDayRecord = {
      id: `closed:${date}:${shop}`,
      date,
      year: parts.year,
      week: parts.week,
      shop,
      amount: 0,
      shopClosed: true,
      shopClosedAt: now,
      shopClosedBy: "Management",
      note: "Winkel was gesloten.",
      source: "manual",
      updatedAt: now,
    };
    const nextDailyRecords = [
      ...dailyRecords.filter(
        (record) => !(record.date === date && record.shop === shop)
      ),
      closedRecord,
    ].sort(
      (first, second) =>
        second.date.localeCompare(first.date) ||
        revenueShops.indexOf(first.shop) - revenueShops.indexOf(second.shop)
    );

    setDailyRecords(nextDailyRecords);
    const saved = await saveCash(cashDeposits, cashRecords, nextDailyRecords);
    if (saved) {
      setStatus(`${shop} is voor ${dayName(date)} gemarkeerd als gesloten.`);
    }
  }

  async function unmarkShopClosed(date: string, shop: RevenueShop) {
    const parts = weekPartsForDate(date);
    if (
      isPatisserieDepositClosed(
        existingDepositFor(cashDeposits, parts.year, parts.week, shop)
      )
    ) {
      setStatus("Deze winkelweek is gesloten. Heropen de locatie om te wijzigen.");
      return;
    }

    const nextDailyRecords = dailyRecords.filter(
      (record) =>
        !(
          record.date === date &&
          record.shop === shop &&
          isShopClosedDayRecord(record)
        )
    );

    setDailyRecords(nextDailyRecords);
    const saved = await saveCash(cashDeposits, cashRecords, nextDailyRecords);
    if (saved) {
      setStatus(
        `De sluitingsmarkering voor ${shop} op ${dayName(date)} is verwijderd.`
      );
    }
  }

  async function saveIceCashSourceCorrection(record: RevenueCashRecord) {
    if (isCashRecordInClosedLocation(record, "ice")) {
      setStatus("Deze ijsweek is gesloten. Heropen de locatie om te wijzigen.");
      return;
    }

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
    if (isCashRecordInClosedLocation(record, "ice")) {
      setStatus("Deze ijsweek is gesloten. Heropen de locatie om te wijzigen.");
      return;
    }

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
    if (isCashRecordInClosedLocation(record, "ice")) {
      setStatus("Deze ijsweek is gesloten. Heropen de locatie om te wijzigen.");
      return;
    }

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
    nextCashRecords = cashRecords,
    nextDailyRecords = dailyRecords
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
          dailyRecords: nextDailyRecords,
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
        Array.isArray(data.dailyRecords) ? data.dailyRecords : nextDailyRecords
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
      return true;
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Geldcontrole opslaan is mislukt."
      );
      setState("ready");
      return false;
    }
  }

  function depositForWeekRow(
    row: (typeof weekRows)[number],
    now = new Date().toISOString()
  ): RevenueCashDeposit {
    const checkedRecords = row.expectedDates.flatMap((date) => {
      const record = findCashRecord(row.records, date, row.shop);

      return hasPatisserieCashRecord(record) && record?.checkedAt ? [record] : [];
    });
    const dateRange = checkedRecords.map((record) => record.date).sort();
    const existing = row.deposit;

    return {
      id: createRevenueCashDepositKey(
        selectedWeek.year,
        selectedWeek.week,
        row.shop
      ),
      year: selectedWeek.year,
      week: selectedWeek.week,
      shop: row.shop,
      ...existing,
      amount: roundedMoney(
        checkedRecords.reduce(
          (total, record) => total + safeCheckedCash(record),
          0
        )
      ),
      cashRecordIds: checkedRecords.map((record) => record.id),
      dateFrom: dateRange[0] || existing?.dateFrom || selectedWeekDates[0],
      dateTo:
        dateRange.at(-1) || existing?.dateTo || selectedWeekDates.at(-1),
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };
  }

  function finalizeWeekWhenAllActiveLocationsClosed(
    deposits: RevenueCashDeposit[],
    iceSeasonOpen: boolean,
    now = new Date().toISOString()
  ) {
    const depositsForWeek = revenueShops.map((shop) =>
      deposits.find(
        (deposit) =>
          deposit.year === selectedWeek.year &&
          deposit.week === selectedWeek.week &&
          deposit.shop === shop
      )
    );
    const allClosed = depositsForWeek.every(
      (deposit) =>
        isPatisserieDepositClosed(deposit) &&
        (!iceSeasonOpen || isIceDepositClosed(deposit))
    );

    if (!allClosed) return { deposits, allClosed: false };

    return {
      allClosed: true,
      deposits: deposits.map((deposit) =>
        deposit.year === selectedWeek.year &&
        deposit.week === selectedWeek.week
          ? {
              ...deposit,
              closedAt: deposit.closedAt || now,
              closedBy: deposit.closedBy || "Strik app",
              updatedAt: now,
            }
          : deposit
      ),
    };
  }

  function openDepositReport() {
    const currentWeekOptions = unreportedDepositOptions.filter(
      (option) =>
        option.year === selectedWeek.year && option.week === selectedWeek.week
    );
    setDepositReportSelection(currentWeekOptions.map((option) => option.key));
    setDepositReportOpen(true);
  }

  function toggleDepositReportOption(key: string) {
    setDepositReportSelection((current) =>
      current.includes(key)
        ? current.filter((item) => item !== key)
        : [...current, key]
    );
  }

  async function reportSelectedDeposits() {
    if (!selectedDepositReportOptions.length || mailState === "sending") return;
    if (
      !window.confirm(
        `${selectedDepositReportOptions.length} locatie${selectedDepositReportOptions.length === 1 ? "" : "s"} met totaal ${formatMoney(selectedDepositReportTotal)} als gestort melden aan administratie?`
      )
    ) {
      return;
    }

    setMailState("sending");
    try {
      const response = await fetch("/api/management-revenue/cash-deposit-mail", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          entries: selectedDepositReportOptions.map((option) => ({
            key: option.key,
            year: option.year,
            week: option.week,
            weekLabel: option.weekLabel,
            shop: option.shop,
            kind: option.kind,
            label: option.label,
            amount: option.amount,
          })),
        }),
      });
      const data = (await response.json().catch(() => null)) as
        | { message?: string }
        | null;
      if (!response.ok) {
        throw new Error(data?.message || "Stortingsmelding mailen is mislukt.");
      }

      const reportedKeys = new Set(
        selectedDepositReportOptions.map((option) => option.key)
      );
      const now = new Date().toISOString();
      const nextDeposits = cashDeposits.map((deposit) => {
        const patisserieKey = depositReportKey(
          deposit.year,
          deposit.week,
          "patisserie",
          deposit.shop
        );
        const iceKey = depositReportKey(
          deposit.year,
          deposit.week,
          "ice",
          deposit.shop
        );
        let next = deposit;

        if (reportedKeys.has(patisserieKey)) {
          next = {
            ...next,
            patisserieReportedAt: now,
            patisserieReportedBy: "Management",
            updatedAt: now,
          };
        }
        if (reportedKeys.has(iceKey)) {
          next = {
            ...next,
            iceReportedAt: now,
            iceReportedBy: "Management",
            updatedAt: now,
          };
        }

        return next;
      });
      const saved = await saveCash(nextDeposits);
      if (!saved) {
        setStatus(
          "De mail is verstuurd, maar de status ‘gestort’ kon niet worden opgeslagen. Open ‘Storting melden’ en probeer opnieuw."
        );
        return;
      }

      setDepositReportSelection([]);
      setDepositReportOpen(false);
      setStatus(
        `${selectedDepositReportOptions.length} storting${selectedDepositReportOptions.length === 1 ? "" : "en"} gemeld. ${data?.message || "Mail naar administratie verstuurd."}`
      );
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : "Stortingsmelding mailen is mislukt."
      );
    } finally {
      setMailState("idle");
    }
  }

  async function closeSelectedCashLocation() {
    if (!selectedShopRow || !selectedCashLocationRow || state === "saving") return;
    if (isSelectedCashLocationClosed) {
      await reopenSelectedCashLocation();
      return;
    }
    if (!isSelectedCashLocationComplete) {
      setStatus(
        selectedCashLocationKind === "ice"
          ? "Sla eerst de complete ijsstorting voor deze locatie op."
          : "Controleer eerst alle verwachte dagen van deze winkel."
      );
      return;
    }

    const locationLabel = cashLocationLabel(
      selectedCashLocationKind,
      selectedShopRow.shop
    );
    const amount =
      selectedCashLocationKind === "ice"
        ? selectedShopRow.iceBankAmount
        : selectedShopRow.bankAmount;
    if (
      !window.confirm(
        `${locationLabel} sluiten met ${formatMoney(amount)} naar bank? De andere locaties blijven open.`
      )
    ) {
      return;
    }

    const now = new Date().toISOString();
    const baseDeposit = depositForWeekRow(selectedShopRow, now);
    const closedDeposit: RevenueCashDeposit =
      selectedCashLocationKind === "ice"
        ? {
            ...baseDeposit,
            iceDepositClosedAt: now,
            iceDepositClosedBy: "Management",
            updatedAt: now,
          }
        : {
            ...baseDeposit,
            depositedAt: baseDeposit.depositedAt || now,
            depositedBy: baseDeposit.depositedBy || "Strik app",
            patisserieClosedAt: now,
            patisserieClosedBy: "Management",
            updatedAt: now,
          };
    const mergedDeposits = mergeRevenueCashDeposits(
      cashDeposits.filter((deposit) => deposit.id !== closedDeposit.id),
      [closedDeposit]
    );
    const finalized = finalizeWeekWhenAllActiveLocationsClosed(
      mergedDeposits,
      isIceSeasonOpen,
      now
    );

    setCashDeposits(finalized.deposits);
    const saved = await saveCash(finalized.deposits);
    if (!saved) return;

    if (!finalized.allClosed) {
      setStatus(`${locationLabel} is gesloten. De andere locaties blijven open.`);
      return;
    }
    setStatus(
      "Alle actieve locaties zijn gesloten. Meld de daadwerkelijke bankstorting via ‘Storting melden’."
    );
  }

  async function reopenSelectedCashLocation() {
    if (!selectedShopRow || !selectedCashLocationRow || state === "saving") return;
    const deposit = selectedShopRow.deposit;
    if (isSelectedCashLocationReported) {
      setStatus(
        "Deze storting is al gemeld aan administratie en kan niet meer worden heropend."
      );
      return;
    }
    if (!deposit || deposit.cashbookBookedAt) {
      setStatus(
        deposit?.cashbookBookedAt
          ? "Deze storting is al in het kasboek geboekt en kan niet worden heropend."
          : "Voor deze locatie is geen gesloten storting gevonden."
      );
      return;
    }
    if (
      deposit.closedAt &&
      !deposit.patisserieClosedAt &&
      !deposit.iceDepositClosedAt
    ) {
      setStatus("Dit is een oude gesloten week. Gebruik ‘Week heropenen’.");
      return;
    }

    const locationLabel = cashLocationLabel(
      selectedCashLocationKind,
      selectedShopRow.shop
    );
    if (!window.confirm(`${locationLabel} heropenen voor correcties?`)) return;

    const now = new Date().toISOString();
    const nextDeposits = cashDeposits.map((item) => {
      if (item.year !== selectedWeek.year || item.week !== selectedWeek.week) {
        return item;
      }
      if (item.shop !== selectedShopRow.shop) {
        return {
          ...item,
          closedAt: undefined,
          closedBy: undefined,
          updatedAt: now,
        };
      }

      return selectedCashLocationKind === "ice"
        ? {
            ...item,
            iceDepositClosedAt: undefined,
            iceDepositClosedBy: undefined,
            closedAt: undefined,
            closedBy: undefined,
            updatedAt: now,
          }
        : {
            ...item,
            patisserieClosedAt: undefined,
            patisserieClosedBy: undefined,
            closedAt: undefined,
            closedBy: undefined,
            updatedAt: now,
          };
    });

    if (await saveCash(nextDeposits)) {
      setStatus(`${locationLabel} is heropend; de andere gesloten locaties blijven dicht.`);
    }
  }

  async function toggleIceSeason() {
    if (state === "saving" || mailState === "sending") return;
    if (isSelectedWeekClosed) {
      setStatus("Heropen de week voordat je de ijsseizoen-instelling wijzigt.");
      return;
    }

    const nextOpen = !isIceSeasonOpen;
    const hasIceData = weekRows.some(
      (row) =>
        row.iceCount > 0 ||
        row.deposit?.iceDepositAmount !== undefined ||
        Boolean(row.deposit?.iceDepositedAt)
    );
    if (
      !nextOpen &&
      hasIceData &&
      !window.confirm(
        "Er staat al ijsdata in deze week. IJsseizoen toch sluiten? De bestaande ijsdata blijft bewaard, maar ijslocaties zijn niet meer verplicht voor de weekafsluiting."
      )
    ) {
      return;
    }

    const now = new Date().toISOString();
    const weekDeposits = weekRows.map((row) => ({
      ...depositForWeekRow(row, now),
      iceSeasonOpen: nextOpen,
      updatedAt: now,
    }));
    const mergedDeposits = mergeRevenueCashDeposits(
      cashDeposits.filter(
        (deposit) =>
          deposit.year !== selectedWeek.year ||
          deposit.week !== selectedWeek.week
      ),
      weekDeposits
    );
    const finalized = finalizeWeekWhenAllActiveLocationsClosed(
      mergedDeposits,
      nextOpen,
      now
    );

    if (!nextOpen) setSelectedCashLocationKind("patisserie");
    const saved = await saveCash(finalized.deposits);
    if (!saved) return;

    if (!finalized.allClosed) {
      setStatus(
        nextOpen
          ? "IJsseizoen staat voor deze week open."
          : "IJsseizoen staat voor deze week dicht; ijslocaties blokkeren de weekafsluiting niet."
      );
      return;
    }
    setStatus(
      "Alle actieve locaties zijn gesloten. Meld de daadwerkelijke bankstorting via ‘Storting melden’."
    );
  }

  async function reopenWeek() {
    if (!isSelectedWeekClosed || state === "saving" || mailState === "sending") return;
    if (isSelectedWeekReported) {
      setStatus(
        "In deze week zijn al stortingen gemeld aan administratie. De week kan daarom niet meer worden heropend."
      );
      return;
    }
    if (isSelectedWeekCashbookBooked) {
      setStatus("Deze week is al in het kasboek geboekt. Heropenen is niet mogelijk.");
      return;
    }
    if (!window.confirm(`Weet je zeker dat je week ${selectedWeek.week} ${selectedWeek.year} wilt heropenen?`)) return;
    if (!window.confirm("Tweede controle: wil je deze week echt heropenen voor correcties?")) return;

    const now = new Date().toISOString();
    const nextDeposits = cashDeposits.map((deposit) =>
      deposit.year === selectedWeek.year && deposit.week === selectedWeek.week
        ? {
            ...deposit,
            patisserieClosedAt: undefined,
            patisserieClosedBy: undefined,
            iceDepositClosedAt: undefined,
            iceDepositClosedBy: undefined,
            closedAt: undefined,
            closedBy: undefined,
            updatedAt: now,
          }
        : deposit
    );
    if (await saveCash(nextDeposits)) {
      setStatus("Week heropend voor correcties.");
    }
  }

  async function saveActualDeposit(row: (typeof weekRows)[number]) {
    const deposit = row.deposit;
    if (!deposit?.depositedAt || state === "saving") return;
    if (deposit.cashbookBookedAt) {
      setStatus("Deze storting is al in het kasboek geboekt. Wijzigen is niet mogelijk.");
      return;
    }
    const draftKey = `${depositWeekKey}:${row.shop}`;
    const raw = actualDepositDrafts[draftKey] ?? formatAmountInput(deposit.actualAmount ?? deposit.amount);
    if (!/^\d+(?:[.,]\d{1,2})?$/.test(raw.trim())) {
      setStatus("Vul een geldig werkelijk gestort bedrag in.");
      return;
    }
    const actualAmount = parseAmount(raw);
    const differenceNote = (differenceNotes[draftKey] ?? deposit.differenceNote ?? "").trim();
    if (Math.abs(actualAmount - deposit.amount) > 0.009 && !differenceNote) {
      setStatus("Geef bij een stortverschil ook een toelichting op.");
      return;
    }
    if (!window.confirm(`Storting ${cashLocationLabel("patisserie", row.shop)}: opgegeven ${formatMoney(deposit.amount)}, werkelijk ${formatMoney(actualAmount)}. Verschil ${formatMoney(actualAmount - deposit.amount)}. Opslaan?`)) return;

    const nextDeposits = cashDeposits.map((item) =>
      item.id === deposit.id
        ? { ...item, actualAmount, differenceNote, updatedAt: new Date().toISOString() }
        : item
    );
    if (await saveCash(nextDeposits)) {
      setStatus(`Werkelijke storting voor ${cashLocationLabel("patisserie", row.shop)} opgeslagen; oorspronkelijke storting blijft bewaard.`);
    }
  }

  async function saveIceDeposit(row: (typeof weekRows)[number]) {
    if (row.iceClosed || state === "saving") {
      setStatus("Deze ijsweek is gesloten. Heropen de locatie om te wijzigen.");
      return;
    }
    if (row.deposit?.cashbookBookedAt) {
      setStatus("Deze week is al in het kasboek geboekt. De ijsstorting kan niet worden gewijzigd.");
      return;
    }
    const draftKey = `${depositWeekKey}:ice:${row.shop}`;
    const raw = iceDepositDrafts[draftKey] ?? formatOptionalAmountInput(row.deposit?.iceDepositAmount);
    if (!/^\d+(?:[.,]\d{1,2})?$/.test(raw.trim())) {
      setStatus("Vul een geldig ijsstortingsbedrag in.");
      return;
    }
    const note = (iceDepositNotes[draftKey] ?? row.deposit?.iceDepositNote ?? "").trim();
    if (row.iceCount === 0 && !note) {
      setStatus("Vul een reden in wanneer er geen ijs-dagrapport is.");
      return;
    }
    const amount = parseAmount(raw);
    if (!window.confirm(`${cashLocationLabel("ice", row.shop)}: ${formatMoney(amount)} als weekstorting opslaan${row.iceCount === 0 ? " zonder dagrapport" : ""}?`)) return;

    const now = new Date().toISOString();
    const existing = row.deposit;
    const deposit: RevenueCashDeposit = {
      id: createRevenueCashDepositKey(selectedWeek.year, selectedWeek.week, row.shop),
      year: selectedWeek.year,
      week: selectedWeek.week,
      shop: row.shop,
      amount: existing?.amount ?? 0,
      cashRecordIds: existing?.cashRecordIds ?? [],
      ...existing,
      dateFrom: existing?.dateFrom || selectedWeekDates[0],
      dateTo: existing?.dateTo || selectedWeekDates.at(-1),
      iceDepositAmount: amount,
      iceDepositedAt: now,
      iceDepositNote: note,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };
    const nextDeposits = mergeRevenueCashDeposits(
      cashDeposits.filter((item) => item.id !== deposit.id),
      [deposit]
    );
    if (await saveCash(nextDeposits)) {
      setStatus(`IJs-storting voor ${cashLocationLabel("ice", row.shop)} opgeslagen; overige kasgegevens zijn niet gewijzigd.`);
    }
  }

  const selectedDepositDraftKey = selectedShopRow
    ? `${depositWeekKey}:${selectedShopRow.shop}`
    : "";
  const selectedIceDepositDraftKey = selectedShopRow
    ? `${depositWeekKey}:ice:${selectedShopRow.shop}`
    : "";

  return (
    <div className="space-y-3">
      <nav
        aria-label="Geldgegevens"
        className="grid w-full max-w-lg grid-cols-3 gap-1 rounded-full border border-white/70 bg-white/82 p-1 shadow-sm backdrop-blur-sm"
      >
        <Link
          href="/management/gegevens/geld-tellen"
          aria-current="page"
          className="rounded-full bg-[#1f4f35] px-3 py-2 text-center text-[0.7rem] font-black text-white shadow-sm"
        >
          Geld tellen
        </Link>
        <Link
          href="/management/gegevens/kasboek"
          className="rounded-full px-3 py-2 text-center text-[0.7rem] font-black text-[#4a4540] transition hover:bg-white"
        >
          Maandrapport
        </Link>
        <button
          type="button"
          onClick={openDepositReport}
          className="rounded-full bg-[#f1e4c8] px-3 py-2 text-center text-[0.7rem] font-black text-[#6f4e17] transition hover:bg-[#ead8b3]"
        >
          Storting melden
        </button>
      </nav>

      <section className="rounded-3xl border border-[#d9cbb8] bg-[#fbf7ef]/95 p-2.5 shadow-sm sm:p-3">
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-[minmax(8rem,9.5rem)_minmax(0,1fr)_minmax(8rem,9.5rem)_minmax(21rem,24rem)] xl:items-end">
          <label className="relative flex h-12 min-w-0 cursor-pointer items-center gap-1.5 rounded-xl border border-[#cad9c5] bg-[#eef6eb] px-2.5 text-[#1f4f35] shadow-sm">
            <span className="text-[0.52rem] font-black uppercase tracking-[0.06em]">
              Weeknr.
            </span>
            <strong className="text-2xl font-black leading-none tabular-nums">
              {selectedWeek.week}
            </strong>
            <span className="ml-auto text-[0.52rem] font-bold text-[#71806d]">
              {selectedWeek.year}
            </span>
            <select
              aria-label="Kies weeknummer"
              value={depositWeekKey}
              onChange={(event) => {
                const parts = parseWeekKey(event.target.value);
                if (!parts) return;

                setSelectedDate(
                  isoDateFromDate(dateFromIsoWeekParts(parts.year, parts.week))
                );
              }}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            >
              {availableWeeks.map((week) => (
                <option key={week.key} value={week.key}>
                  Week {week.week} · {week.year}
                </option>
              ))}
            </select>
          </label>

          <label className="grid min-w-0 gap-0.5 text-[0.54rem] font-black uppercase tracking-[0.08em] text-[#766b5f]">
            Locatie
            <select
              value={selectedCashLocationKey}
              onChange={(event) => {
                const nextLocation = parseCashLocationKey(event.target.value);
                if (!nextLocation) return;

                setSelectedShop(nextLocation.shop);
                setSelectedCashLocationKind(nextLocation.kind);
                if (!selectedWeekDates.includes(selectedDate)) {
                  setSelectedDate(selectedWeekDates[0] || localIsoDate());
                }
              }}
              className={`h-10 w-full min-w-0 max-w-full truncate rounded-xl border border-[#ded5ca] bg-white px-2 text-[0.68rem] font-black normal-case tracking-normal outline-none transition focus:border-[#8ba287] ${
                selectedCashLocationRow?.closed
                  ? "border-[#9fbd9d] bg-[#eef8ef] text-[#1f4f35]"
                  : selectedCashLocationRow &&
                      hasNonWholeMoney(selectedCashLocationRow.weekTotal)
                    ? "text-[#a43b2f]"
                    : "text-[#1a1815]"
              }`}
            >
              {cashLocationRows.map((row) => (
                <option key={row.key} value={row.key}>
                  {row.label} ·{" "}
                  naar bank {formatMoney(row.weekTotal)}
                  {row.deposited
                    ? " · gestort"
                    : row.closed
                      ? " · gesloten"
                      : ""}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            role="switch"
            aria-checked={isIceSeasonOpen}
            onClick={() => void toggleIceSeason()}
            disabled={
              state === "saving" ||
              mailState === "sending" ||
              isSelectedWeekClosed
            }
            className={`flex h-10 min-w-0 items-center justify-between gap-1.5 overflow-hidden rounded-xl border px-2.5 text-left text-[0.58rem] font-black transition disabled:cursor-not-allowed disabled:opacity-50 ${
              isIceSeasonOpen
                ? "border-[#a8c4a6] bg-[#eef8ef] text-[#1f4f35]"
                : "border-[#d9d2c9] bg-[#f2efeb] text-[#766f67]"
            }`}
          >
            <span>
              IJsseizoen
              <span className="block text-[0.48rem] font-bold opacity-70">
                deze week
              </span>
            </span>
            <span
              className={`relative h-4 w-8 shrink-0 rounded-full transition ${
                isIceSeasonOpen ? "bg-[#2f6f43]" : "bg-[#b8b1a8]"
              }`}
            >
              <span
                className={`absolute top-px h-3.5 w-3.5 rounded-full bg-white shadow-sm transition ${
                  isIceSeasonOpen ? "left-[1.05rem]" : "left-px"
                }`}
              />
            </span>
          </button>

          <div className="grid min-h-12 min-w-0 grid-cols-3 overflow-hidden rounded-xl border border-[#e7e0d8] bg-white text-center">
            <div
              className={`min-w-0 border-r border-[#e7e0d8] px-1.5 py-1.5 ${
                weekMissingRevenueCount > 0 ? "bg-[#fff1ee]" : ""
              }`}
            >
              <p
                className={`flex items-center justify-center gap-1 whitespace-nowrap text-[0.58rem] font-black uppercase tracking-[0.04em] ${
                  weekMissingRevenueCount > 0
                    ? "text-[#a43b2f]"
                    : "text-[#8b8278]"
                }`}
              >
                {weekMissingRevenueCount > 0 && (
                  <span
                    aria-hidden="true"
                    className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-[#d2453d] text-[0.62rem] text-white"
                  >
                    !
                  </span>
                )}
                Gecheckt
              </p>
              <p className="mt-0.5 whitespace-nowrap text-[0.9rem] font-black tabular-nums text-[#1a1815]">
                {weekCheckedCount}/{weekExpectedCount}
              </p>
              {weekMissingRevenueCount > 0 && (
                <p className="mt-0.5 text-[0.52rem] font-black uppercase tracking-[0.03em] text-[#a43b2f]">
                  {weekMissingRevenueCount}× mist omzet
                </p>
              )}
            </div>
            <div className="min-w-0 border-r border-[#e7e0d8] bg-[#f6faf4] px-1.5 py-1.5">
              <p className="whitespace-nowrap text-[0.58rem] font-black uppercase tracking-[0.04em] text-[#71806d]">
                Verwacht
              </p>
              <p
                className="mt-0.5 whitespace-nowrap text-[0.9rem] font-black tabular-nums text-[#1f4f35]"
                title={formatMoney(weekExpectedTotal)}
              >
                {formatMoney(weekExpectedTotal)}
              </p>
            </div>
            <div className="min-w-0 px-1.5 py-1.5">
              <p className="whitespace-nowrap text-[0.58rem] font-black uppercase tracking-[0.04em] text-[#8b8278]">
                Naar bank
              </p>
              <p
                className={`mt-0.5 whitespace-nowrap text-[0.9rem] font-black tabular-nums ${
                  hasNonWholeMoney(weekBankTotal)
                    ? "text-[#a43b2f]"
                    : "text-[#1a1815]"
                }`}
                title={formatMoney(weekBankTotal)}
              >
                {formatMoney(weekBankTotal)}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-[2.75rem_minmax(5rem,1fr)_2.75rem_minmax(8rem,1.25fr)] gap-1.5 md:col-span-2 xl:col-span-4 xl:ml-auto xl:w-full xl:max-w-[28rem]">
            <button
              type="button"
              onClick={() =>
                setSelectedDate(
                  shiftedWeekDate(selectedWeek.year, selectedWeek.week, -1)
                )
              }
              aria-label="Vorige week"
              title="Vorige week"
              className="h-10 rounded-xl border border-[#d9d2c9] bg-white px-2 text-lg font-black text-[#1a1815] transition hover:bg-[#f8f6f3]"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={() => setSelectedDate(localIsoDate())}
              className="h-10 rounded-xl border border-[#d9d2c9] bg-white px-2 text-[0.68rem] font-black text-[#1a1815] transition hover:bg-[#f8f6f3]"
            >
              Deze week
            </button>
            <button
              type="button"
              onClick={() =>
                setSelectedDate(
                  shiftedWeekDate(selectedWeek.year, selectedWeek.week, 1)
                )
              }
              aria-label="Volgende week"
              title="Volgende week"
              className="h-10 rounded-xl border border-[#d9d2c9] bg-white px-2 text-lg font-black text-[#1a1815] transition hover:bg-[#f8f6f3]"
            >
              ›
            </button>
            <button
              type="button"
              onClick={() => void closeSelectedCashLocation()}
              aria-label={
                isSelectedCashLocationReported
                  ? "Geselecteerde locatie is gestort"
                  : isSelectedCashLocationClosed
                  ? "Geselecteerde locatie heropenen"
                  : "Geselecteerde locatie sluiten"
              }
              disabled={
                isSelectedCashLocationReported ||
                (!isSelectedCashLocationClosed &&
                  !isSelectedCashLocationComplete) ||
                state === "saving" ||
                mailState === "sending" ||
                Boolean(selectedShopRow?.deposit?.cashbookBookedAt)
              }
              title={
                isSelectedCashLocationReported
                  ? "Deze storting is al gemeld aan administratie"
                  : isSelectedCashLocationClosed
                  ? "Alleen deze locatie heropenen"
                  : isSelectedCashLocationComplete
                    ? "Bedrag vastzetten en deze locatie sluiten"
                    : "Deze locatie eerst compleet maken"
              }
              className={`flex h-10 items-center justify-center gap-1.5 rounded-xl border px-2.5 text-[0.68rem] font-black shadow-sm disabled:border-[#d9d2c9] disabled:bg-white disabled:text-[#8b8278] disabled:opacity-60 ${
                isSelectedCashLocationClosed
                  ? "border-[#8fb18b] bg-[#eef8ef] text-[#1f4f35]"
                  : "border-[#1f4f35] bg-[#1f4f35] text-white"
              }`}
            >
              <BankIcon />
              <span>
                {mailState === "sending"
                  ? "Mail versturen..."
                  : isSelectedCashLocationReported
                    ? "Gestort"
                  : isSelectedCashLocationClosed
                    ? "Heropen locatie"
                    : "Locatie sluiten"}
              </span>
            </button>
          </div>
        </div>

        {isSelectedWeekClosed ? (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[#cbdcc5] bg-[#f6fbf5] px-3 py-2.5 text-xs font-bold text-[#1f4f35]">
            <span>
              Week definitief gesloten
              {selectedWeekClosedAtLabel
                ? ` op ${selectedWeekClosedAtLabel.slice(0, 10)}`
                : ""}
              . De oorspronkelijke kasgegevens blijven bewaard.
            </span>
            <button
              type="button"
              onClick={() => void reopenWeek()}
              disabled={state === "saving" || mailState === "sending" || isSelectedWeekCashbookBooked || isSelectedWeekReported}
              title={isSelectedWeekReported ? "Er zijn al stortingen gemeld" : isSelectedWeekCashbookBooked ? "Deze week is al in het kasboek geboekt" : "Week na twee bevestigingen heropenen"}
              className="rounded-xl border border-[#1f4f35] bg-white px-3 py-2 text-[0.68rem] font-black disabled:cursor-not-allowed disabled:opacity-50"
            >
              Week heropenen
            </button>
          </div>
        ) : isSelectedCashLocationReported ? (
          <p className="mt-3 rounded-2xl border border-[#a8c4a6] bg-[#eef8ef] px-3 py-2.5 text-xs font-bold text-[#1f4f35]">
            {cashLocationLabel(selectedCashLocationKind, selectedShop)} is als
            gestort gemeld aan administratie.
          </p>
        ) : isSelectedCashLocationClosed ? (
          <p className="mt-3 rounded-2xl border border-[#cbdcc5] bg-[#f6fbf5] px-3 py-2.5 text-xs font-bold text-[#1f4f35]">
            {cashLocationLabel(selectedCashLocationKind, selectedShop)} is voor deze week gesloten. Andere locaties kunnen
            apart verder worden afgehandeld.
          </p>
        ) : isSelectedCashLocationComplete ? (
          <p className="mt-3 rounded-2xl border border-[#efd1a1] bg-[#fff8d8] px-3 py-2.5 text-xs font-bold text-[#7a5417]">
            Het bedrag voor deze locatie staat vast. Sluit alleen deze locatie;
            de overige vestigingen blijven open.
          </p>
        ) : null}

        {storage?.status === "seed" && (
          <p className="mt-3 rounded-2xl border border-[#f3d4a4] bg-[#fef9f3] px-3 py-2.5 text-xs font-bold text-[#7a5417]">
            {storage.message} Nieuwe geldcontroles worden pas blijvend opgeslagen
            zodra de WordPress omzet-snippet actief is.
          </p>
        )}

        {status && (
          <p className="mt-3 rounded-2xl bg-[#f8f6f3] px-3 py-2.5 text-xs font-bold text-[#6b645b]">
            {status}
          </p>
        )}
      </section>

      {selectedShopRow && (
        <section className="rounded-3xl border border-[#e7e0d8]/80 bg-white/95 p-3 shadow-sm sm:p-4">
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4 md:grid-cols-7">
            {selectedShopDays.map(
              ({
                date,
                hasRevenue,
                iceRecord,
                isExpected,
                patisserieRecord,
                revenueRecord,
              }) => {
                  const isActive = date === selectedDate;
                  const dayRecord =
                    selectedCashLocationKind === "ice"
                      ? iceRecord
                      : patisserieRecord;
                  const isMarkedClosed =
                    selectedCashLocationKind === "patisserie" &&
                    isShopClosedDayRecord(revenueRecord);
                  const dayIsExpected =
                    selectedCashLocationKind === "ice"
                      ? Boolean(iceRecord)
                      : isExpected;
                  const warning =
                    selectedCashLocationKind === "ice"
                      ? ""
                      : cashWarning(dayRecord);
                  const isClosed =
                    isMarkedClosed || (!dayIsExpected && !dayRecord);
                  const isPast = date < localIsoDate();
                  const isMissingRevenue =
                    selectedCashLocationKind === "patisserie" &&
                    dayIsExpected &&
                    isPast &&
                    !isMarkedClosed &&
                    !hasRevenue;
                  const isMissing =
                    selectedCashLocationKind === "patisserie" &&
                    dayIsExpected &&
                    isPast &&
                    !isMarkedClosed &&
                    !dayRecord;
                  const isChecked =
                    selectedCashLocationKind === "ice"
                      ? Boolean(dayRecord?.iceCheckedAt)
                      : Boolean(dayRecord?.checkedAt);
                  const rowClass = isMissing
                    ? "border-[#e1a49d] bg-[#fdeaea] text-[#1a1815]"
                    : isChecked
                      ? "border-[#a8c4a6] bg-[#eef8ef] text-[#1a1815]"
                      : warning
                        ? "border-[#e0c269] bg-[#fff8d8] text-[#1a1815]"
                        : isClosed
                          ? "border-[#ddd7cf] bg-[#f5f2ee] text-[#8b8278]"
                          : "border-[#ddd7cf] bg-white text-[#1a1815]";

                  return (
                    <button
                      key={date}
                      type="button"
                      onClick={() => setSelectedDate(date)}
                      className={`relative min-h-[4.35rem] w-full rounded-[1.35rem] border px-2.5 py-2 text-left transition hover:-translate-y-0.5 hover:shadow-sm ${
                        isActive ? "ring-2 ring-[#1f4f35] ring-offset-1" : ""
                      } ${rowClass}`}
                    >
                      <span className="flex items-baseline gap-1.5 pr-5">
                        <span className="text-[0.68rem] font-black uppercase tracking-[0.06em] opacity-70">
                          {dayShortName(date).replace(".", "")}
                        </span>
                        <span className="text-[0.55rem] font-bold italic leading-none opacity-65">
                          {date.slice(8, 10)}-{date.slice(5, 7)}
                        </span>
                      </span>
                      <span className="mt-1.5 block truncate text-[0.78rem] font-black tabular-nums leading-none">
                        {isMarkedClosed
                          ? "gesloten"
                          : dayRecord
                          ? formatMoney(
                              selectedCashLocationKind === "ice"
                                ? iceExpectedCash(dayRecord)
                                : cashRevenueAmount(dayRecord)
                            )
                          : isClosed
                            ? selectedCashLocationKind === "ice"
                              ? "geen ijs"
                              : "gesloten"
                            : "-"}
                      </span>
                      <span
                        className={`absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full text-[0.62rem] font-black leading-none ${
                          isMissingRevenue
                            ? "bg-[#d2453d] text-white"
                            : isMarkedClosed
                              ? "bg-[#8b8278] text-white"
                            : isChecked
                              ? "bg-[#2f6f43] text-white"
                              : "bg-white/70 text-[#8b8278]"
                        }`}
                      >
                        {isMissingRevenue
                          ? "!"
                          : isMarkedClosed
                            ? "✓"
                            : isMissing
                              ? "×"
                              : isChecked
                                ? "✓"
                                : isClosed
                                  ? ""
                                  : "•"}
                      </span>
                    </button>
                  );
                }
              )}
          </div>

          <div className="mt-3">
            {selectedCashLocationKind === "patisserie" ? (
              <>
                {!selectedCashRecord &&
                isShopClosedDayRecord(selectedShopDay?.revenueRecord) ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#d8d2ca] bg-[#f5f2ee] px-4 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#8b8278] text-base font-black text-white">
                    ✓
                  </span>
                  <div>
                    <p className="text-[0.58rem] font-black uppercase tracking-[0.06em] text-[#8b8278]">
                      {dayName(selectedShopDay.date)} · {cashLocationLabel("patisserie", selectedShop)}
                    </p>
                    <p className="text-sm font-black text-[#1a1815]">
                      Winkel was gesloten
                    </p>
                    <p className="mt-0.5 text-xs font-semibold text-[#766f67]">
                      Deze dag telt als afgehandeld en bevat geen omzet.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    void unmarkShopClosed(selectedShopDay.date, selectedShop)
                  }
                  disabled={state === "saving" || isSelectedCashLocationClosed}
                  className="h-9 rounded-full border border-[#8b8278] bg-white px-4 text-xs font-black text-[#6b645b] disabled:opacity-50"
                >
                  Markering verwijderen
                </button>
              </div>
            ) : !selectedCashRecord &&
                selectedShopDay &&
                !selectedShopDay.isExpected ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#e7e0d8] bg-[#f5f2ee] px-4 py-4">
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
              <div
                className={`rounded-2xl border px-4 py-3 ${
                  selectedShopDayIsPast
                    ? "border-[#e1a49d] bg-[#fff1ee]"
                    : "border-[#e7e0d8] bg-[#faf8f5]"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg font-black ${
                        selectedShopDayIsPast
                          ? "bg-[#d2453d] text-white"
                          : "bg-[#e9e4de] text-[#8b8278]"
                      }`}
                    >
                      {selectedShopDayIsPast ? "!" : "·"}
                    </span>
                    <div>
                      <p className="text-[0.58rem] font-black uppercase tracking-[0.06em] text-[#a43b2f]">
                        {selectedShopDay ? dayName(selectedShopDay.date) : "Dag"} · {cashLocationLabel("patisserie", selectedShop)}
                      </p>
                      <p className="text-sm font-black text-[#1a1815]">
                        {!selectedShopDayIsPast
                          ? "Nog niet ontvangen"
                          : selectedShopDay?.hasRevenue
                          ? "Mist kasgegevens"
                          : "Mist omzet"}
                      </p>
                      <p className="mt-0.5 max-w-xl text-xs font-semibold text-[#766f67]">
                        {!selectedShopDayIsPast
                          ? "De dagafsluiting van deze dag wordt later verwacht."
                          : selectedShopDay?.hasRevenue
                          ? "De omzet is binnen, maar de Cash-it geldtelling ontbreekt. Laad het dagrapport opnieuw in."
                          : "Was de winkel open? Laad dan het dagrapport opnieuw in. Alleen bij een werkelijk gesloten winkel mag je deze dag als gesloten markeren."}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {selectedShopDayIsPast && (
                      <button
                        type="button"
                        onClick={() => window.location.reload()}
                        className="h-9 rounded-full border border-[#a43b2f] bg-white px-4 text-xs font-black text-[#a43b2f]"
                      >
                        Opnieuw ophalen
                      </button>
                    )}
                    {selectedShopDayIsPast &&
                      !selectedShopDay?.hasRevenue &&
                      selectedShopDay && (
                      <button
                        type="button"
                        onClick={() =>
                          void markShopClosed(
                            selectedShopDay.date,
                            selectedShop
                          )
                        }
                        disabled={state === "saving" || isSelectedCashLocationClosed}
                        className="h-9 rounded-full bg-[#1a1815] px-4 text-xs font-black text-white disabled:opacity-50"
                      >
                        Winkel was gesloten
                      </button>
                      )}
                  </div>
                </div>
              </div>
            ) : (
              <article
                key={selectedCashRecord.id}
                className="rounded-[1.65rem] border border-[#e2ddd6] bg-[#faf8f5] p-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 px-1">
                  <div>
                    <p className="text-[0.56rem] font-black uppercase tracking-[0.1em] text-[#71806d]">
                      {dayName(selectedCashRecord.date)}
                    </p>
                    <p className="mt-0.5 text-sm font-black leading-none text-[#1a1815]">
                      Dagcontrole · {cashLocationLabel("patisserie", selectedCashRecord.shop)}
                    </p>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.58rem] font-black uppercase tracking-[0.06em] ${
                      selectedCashRecord.checkedAt
                        ? "bg-[#dfeadd] text-[#1f4f35]"
                        : "bg-[#f5ead6] text-[#7a5417]"
                    }`}
                  >
                    <span aria-hidden="true">
                      {selectedCashRecord.checkedAt ? "✓" : "•"}
                    </span>
                    {selectedCashRecord.checkedAt
                      ? "management akkoord"
                      : "nog controleren"}
                  </span>
                </div>

                <div className="mt-2.5 grid gap-2 lg:grid-cols-3">
                  <section className="rounded-[1.25rem] border border-[#e2ddd6] bg-white px-3 py-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-[0.58rem] font-black uppercase tracking-[0.1em] text-[#77716a]">
                          Kassa geregistreerd
                        </p>
                        <p className="mt-0.5 text-[0.62rem] font-semibold text-[#8b8278]">
                          Uit de dagafsluiting
                        </p>
                      </div>
                      <span className="rounded-full bg-[#f0ece7] px-2 py-1 text-[0.5rem] font-black uppercase text-[#77716a]">
                        kassa
                      </span>
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-1.5">
                      <CashOverviewMetric
                        label="Cash"
                        value={formatOptionalMoney(selectedRegisteredCash)}
                      />
                      <CashOverviewMetric
                        label="Pin"
                        value={formatOptionalMoney(selectedRegisteredPin)}
                      />
                      <CashOverviewMetric
                        label="Bonnen"
                        value={formatOptionalMoney(selectedReceipts)}
                      />
                    </div>
                    <div className="mt-2 flex items-center justify-between border-t border-[#e7e0d8] pt-2">
                      <span className="text-[0.56rem] font-black uppercase tracking-[0.06em] text-[#8b8278]">
                        Totaal kassa
                      </span>
                      <strong className="text-sm tabular-nums text-[#1a1815]">
                        {formatOptionalMoney(selectedRegisteredTotal)}
                      </strong>
                    </div>
                  </section>

                  <section className="rounded-[1.25rem] border border-[#e2ddd6] bg-white px-3 py-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-[0.58rem] font-black uppercase tracking-[0.1em] text-[#77716a]">
                          Winkeldame genoteerd
                        </p>
                        <p className="mt-0.5 text-[0.62rem] font-semibold text-[#8b8278]">
                          {selectedCashRecord.countedBy || "Teller niet vermeld"}
                        </p>
                      </div>
                      <span className="rounded-full bg-[#f0ece7] px-2 py-1 text-[0.5rem] font-black uppercase text-[#77716a]">
                        telling
                      </span>
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-1.5">
                      <CashOverviewMetricButton
                        label="Geteld in lade"
                        value={formatOptionalMoney(selectedCountedCash)}
                        onClick={() => setCashNoteModalOpen(true)}
                      />
                      <CashOverviewMetric
                        label="Startgeld"
                        value={formatOptionalMoney(selectedStartCash)}
                      />
                      <CashOverviewMetric
                        label="Kas-uit"
                        value={formatOptionalMoney(selectedCashOut)}
                      />
                    </div>
                  </section>

                  <section
                    className={`rounded-[1.25rem] border px-3 py-2.5 ${
                      selectedCashRecord.checkedAt
                        ? "border-[#b8cfb3] bg-[#e8f2e5]"
                        : "border-[#e5c36f] bg-[#fff5d8]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-[0.58rem] font-black uppercase tracking-[0.1em] text-[#4f493f]">
                          Managementcontrole
                        </p>
                        <p className="mt-0.5 text-[0.62rem] font-semibold text-[#6f675d]">
                          Tel de lade en controleer het bedrag voor de kluis
                        </p>
                      </div>
                      <span className={`rounded-full bg-white/80 px-2 py-1 text-[0.5rem] font-black uppercase ${
                        selectedCashRecord.checkedAt
                          ? "text-[#1f4f35]"
                          : "text-[#7a5417]"
                      }`}>
                        {selectedCashRecord.checkedAt ? "akkoord" : "open"}
                      </span>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <label className="grid gap-0.5 text-[0.54rem] font-black uppercase tracking-[0.04em] text-[#6f675d]">
                        Totaal geteld in lade
                        <span className="relative block">
                          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-black text-[#4f493f]">
                            €
                          </span>
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
                              state === "saving" ||
                              isSelectedCashLocationClosed
                            }
                            placeholder="0,00"
                            className="h-10 w-full rounded-xl border border-[#d8c58f] bg-white pl-7 pr-3 text-base font-black normal-case tracking-normal text-[#1a1815] disabled:opacity-60"
                          />
                        </span>
                      </label>
                      <label className="grid gap-0.5 text-[0.54rem] font-black uppercase tracking-[0.04em] text-[#6f675d]">
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
                            state === "saving" ||
                            isSelectedCashLocationClosed
                          }
                          placeholder="0,00"
                          className="h-10 rounded-xl border border-[#d8c58f] bg-white px-3 text-sm font-black normal-case tracking-normal text-[#1a1815] disabled:opacity-60"
                        />
                      </label>
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-1.5">
                      <CashOverviewMetric
                        label="Volgens kassa"
                        value={formatMoney(selectedExpectedCash)}
                      />
                      <CashOverviewMetric
                        label="Naar kluis"
                        value={
                          selectedManagementSafeCash === undefined
                            ? "—"
                            : formatMoney(selectedManagementSafeCash)
                        }
                        emphasized
                        tone={
                          selectedManagementSafeCash !== undefined &&
                          hasNonWholeMoney(selectedManagementSafeCash)
                            ? "warn"
                            : "normal"
                        }
                      />
                      <CashOverviewMetric
                        label="Kasverschil"
                        value={
                          selectedSafeDraftDifference === undefined
                            ? "—"
                            : formatMoney(selectedSafeDraftDifference)
                        }
                      />
                    </div>
                    <p className="mt-1.5 text-[0.54rem] font-semibold leading-snug text-[#756d62]">
                      Naar kluis = geteld min startbedrag. Kasverschil = naar kluis min geregistreerde cash omzet{selectedCashOut ? " (na kas-uit)" : ""}.
                    </p>
                    <label className="mt-2 grid gap-0.5 text-[0.54rem] font-black uppercase tracking-[0.04em] text-[#6f675d]">
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
                        disabled={
                          Boolean(selectedCashRecord.checkedAt) ||
                          state === "saving" ||
                          isSelectedCashLocationClosed
                        }
                        placeholder="Bijv. startbedrag gecorrigeerd of verschil verklaard"
                        className="h-9 rounded-xl border border-[#d8c58f] bg-white px-3 text-xs font-bold normal-case tracking-normal text-[#1a1815] disabled:opacity-60"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => void toggleChecked(selectedCashRecord)}
                      disabled={state === "saving" || isSelectedCashLocationClosed}
                      className={`mt-2.5 flex h-9 w-full items-center justify-center gap-1.5 rounded-full border px-3 text-[0.68rem] font-black disabled:opacity-60 ${
                        selectedCashRecord.checkedAt
                          ? "border-[#9fbd9d] bg-[#1f4f35] text-white"
                          : "border-[#1f4f35] bg-[#1f4f35] text-white"
                      }`}
                    >
                      <span aria-hidden="true">
                        {selectedCashRecord.checkedAt ? "↺" : "✓"}
                      </span>
                      {selectedCashRecord.checkedAt
                        ? "Controle heropenen"
                        : "Controle afvinken"}
                    </button>
                  </section>
                </div>

                {selectedCashWarning && (
                  <p className="mt-2.5 rounded-xl bg-[#fff8d8] px-3 py-2 text-xs font-bold text-[#7a5417]">
                    {selectedCashWarning}
                  </p>
                )}
              </article>
                )}
              </>
            ) : selectedIceCashRecord ? (
              <IceCashSummary
                disabled={state === "saving" || isSelectedCashLocationClosed}
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
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#dce8df] bg-[#f6fbf5] px-4 py-4">
                <div>
                  <p className="text-[0.58rem] font-black uppercase tracking-normal text-[#1f4f35]">
                    {selectedShopDay ? dayName(selectedShopDay.date) : "Dag"}
                  </p>
                  <p className="text-sm font-black text-[#1a1815]">
                    Geen ijs dagrapport
                  </p>
                </div>
                <p className="text-sm font-bold text-[#6b645b]">
                  Voor deze ijsselectie is geen ijstelling gevonden.
                </p>
              </div>
            )}
          </div>
        </section>
      )}

      {selectedShopRow && selectedCashLocationKind === "patisserie" && (
        <section className="rounded-[1.6rem] border border-[#d9e1d5] bg-white/95 p-3 shadow-sm">
          <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,24rem)] lg:items-stretch">
            <div className="flex min-w-0 items-center justify-between gap-3 rounded-2xl bg-[#f8f6f3] px-3 py-2.5">
              <div className="min-w-0">
                <p className="text-[0.55rem] font-black uppercase tracking-[0.1em] text-[#71806d]">
                  Weekstorting
                </p>
                <h2 className="mt-0.5 truncate text-lg font-black leading-none text-[#1a1815]">
                  {cashLocationLabel("patisserie", selectedShopRow.shop)}
                </h2>
              </div>
              <div className="text-right">
                <p className="text-[0.5rem] font-black uppercase tracking-[0.05em] text-[#8b8278]">
                  Dagen gecontroleerd
                </p>
                <p className="mt-0.5 text-base font-black tabular-nums text-[#1a1815]">
                  {selectedShopRow.checkedCount}/{selectedShopRow.expectedCount}
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-[#9fbd9d] bg-[#e7f2e4] px-4 py-2.5">
              <div className="flex items-end justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[0.55rem] font-black uppercase tracking-[0.08em] text-[#1f4f35]">
                    Naar bank voor {cashLocationLabel("patisserie", selectedShopRow.shop)}
                  </p>
                  <p
                    className={`mt-1 truncate text-xl font-black leading-none tabular-nums ${
                      hasNonWholeMoney(selectedShopRow.bankAmount)
                        ? "text-[#a43b2f]"
                        : "text-[#1f4f35]"
                    }`}
                    title={formatMoney(selectedShopRow.bankAmount)}
                  >
                    {formatMoney(selectedShopRow.bankAmount)}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-white/75 px-2 py-1 text-[0.5rem] font-black uppercase text-[#1f4f35]">
                  telt automatisch op
                </span>
              </div>
            </div>
          </div>

          <div className="mt-2 grid gap-2 lg:grid-cols-2">
            <section className="rounded-2xl border border-[#e7e0d8] bg-[#faf8f5] px-3 py-2.5">
              <p className="text-[0.55rem] font-black uppercase tracking-[0.08em] text-[#77716a]">
                Kassa geregistreerd
              </p>
              <div className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-1.5 sm:grid-cols-4">
                <WeekControlMetric
                  label="Cash"
                  value={formatMoney(selectedShopRow.includedCashRevenue)}
                />
                <WeekControlMetric
                  label="Pin"
                  value={formatMoney(selectedShopRow.includedPinRevenue)}
                />
                <WeekControlMetric
                  label="Bonnen"
                  value={formatMoney(selectedShopRow.includedReceipts)}
                />
                <WeekControlMetric
                  label="Kas uit"
                  value={formatMoney(selectedShopRow.includedCashOut)}
                />
              </div>
            </section>

            <section className="rounded-2xl border border-[#c8d9c3] bg-[#f2f7f0] px-3 py-2.5">
              <p className="text-[0.55rem] font-black uppercase tracking-[0.08em] text-[#1f4f35]">
                Daadwerkelijk geteld en gecheckt
              </p>
              <div className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-1.5">
                <WeekControlMetric
                  label="Naar bank"
                  value={formatMoney(selectedShopRow.bankAmount)}
                  emphasized
                  tone={
                    hasNonWholeMoney(selectedShopRow.bankAmount)
                      ? "warn"
                      : "normal"
                  }
                />
                <WeekControlMetric
                  label="Kasverschil"
                  tone={
                    Math.abs(selectedShopRow.difference) > 0.01
                      ? "warn"
                      : "normal"
                  }
                  value={formatMoney(selectedShopRow.difference)}
                />
              </div>
            </section>
          </div>

          {selectedShopRow.deposit?.depositedAt && (
            <details className="mt-2 rounded-xl border border-[#ead9b9] bg-[#fffaf0] px-3 py-2">
              <summary className="cursor-pointer text-[0.56rem] font-black uppercase tracking-[0.05em] text-[#866326]">
                Bankbedrag corrigeren
                {selectedShopRow.deposit.actualAmount !== undefined && (
                  <span className="ml-2 normal-case tracking-normal text-[#6b645b]">
                    Verschil {formatMoney(
                      selectedShopRow.deposit.actualAmount -
                        selectedShopRow.deposit.amount
                    )}
                  </span>
                )}
              </summary>
              <div className="mt-2 grid gap-2 md:grid-cols-[11rem_minmax(12rem,1fr)_auto] md:items-end">
                <label className="grid gap-0.5 text-[0.52rem] font-black uppercase text-[#8b8278]">
                  Werkelijk op de bank
                  <input
                    value={actualDepositDrafts[selectedDepositDraftKey] ?? formatAmountInput(selectedShopRow.deposit.actualAmount ?? selectedShopRow.deposit.amount)}
                    onChange={(event) => setActualDepositDrafts((current) => ({ ...current, [selectedDepositDraftKey]: event.target.value }))}
                    inputMode="decimal"
                    disabled={Boolean(selectedShopRow.deposit.cashbookBookedAt)}
                    className="h-9 rounded-xl border border-[#d9d2c9] bg-white px-3 text-sm font-black normal-case text-[#1a1815] disabled:opacity-50"
                  />
                </label>
                <label className="grid gap-0.5 text-[0.52rem] font-black uppercase text-[#8b8278]">
                  Reden van verschil
                  <input
                    value={differenceNotes[selectedDepositDraftKey] ?? selectedShopRow.deposit.differenceNote ?? ""}
                    onChange={(event) => setDifferenceNotes((current) => ({ ...current, [selectedDepositDraftKey]: event.target.value }))}
                    disabled={Boolean(selectedShopRow.deposit.cashbookBookedAt)}
                    placeholder="Bijv. bank telde € 15 minder"
                    className="h-9 rounded-xl border border-[#d9d2c9] bg-white px-3 text-xs font-bold normal-case text-[#1a1815] disabled:opacity-50"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => void saveActualDeposit(selectedShopRow)}
                  disabled={state === "saving" || Boolean(selectedShopRow.deposit.cashbookBookedAt)}
                  className="h-9 rounded-full bg-[#c3d3bc] px-4 text-[0.65rem] font-black text-[#1a1815] disabled:opacity-50"
                >
                  Correctie opslaan
                </button>
              </div>
            </details>
          )}
        </section>
      )}

      {selectedShopRow && selectedCashLocationKind === "ice" && (
        <section className="rounded-3xl border border-[#c8ddd2] bg-[#f6fbf5] p-3 shadow-sm sm:p-4">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className="text-[0.65rem] font-black uppercase tracking-[0.1em] text-[#1f4f35]">
                IJs weekoverzicht
              </p>
              <h2 className="mt-0.5 text-2xl font-black leading-tight text-[#1a1815]">
                {cashLocationLabel("ice", selectedShopRow.shop)}
              </h2>
            </div>
            <div className="grid w-full grid-cols-3 gap-3 lg:w-auto lg:min-w-[28rem]">
              <AmountCell
                label="Compleet"
                value={`${selectedShopRow.iceCheckedCount}/${selectedShopRow.iceCount}`}
              />
              <AmountCell
                label="Kasomzet"
                value={formatMoney(selectedShopRow.includedIceCashRevenue)}
              />
              <AmountCell
                label="Weektotaal"
                value={formatMoney(selectedShopRow.includedIceCash)}
              />
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3 rounded-2xl border border-[#c8ddd2] bg-white/70 p-3 md:grid-cols-4">
            <AmountCell
              label="Bonnen"
              value={formatMoney(selectedShopRow.includedIceReceipts)}
            />
            <AmountCell
              label="Kas uit"
              value={formatMoney(selectedShopRow.includedIceCashOut)}
            />
            <AmountCell
              label="Kasverschil"
              tone={
                Math.abs(selectedShopRow.includedIceCashDifference) > 5
                  ? "warn"
                  : "normal"
              }
              value={formatMoney(selectedShopRow.includedIceCashDifference)}
            />
            <AmountCell
              label="Naar kluis"
              value={formatMoney(selectedShopRow.includedIceCash)}
              tone={
                hasNonWholeMoney(selectedShopRow.includedIceCash)
                  ? "error"
                  : "normal"
              }
            />
          </div>
          <div className="mt-3 grid gap-2 rounded-2xl border border-[#c8ddd2] bg-white/70 p-3 md:grid-cols-[12rem_minmax(14rem,1fr)_auto] md:items-end">
            <label className="grid gap-0.5 text-[0.56rem] font-black uppercase text-[#1f4f35]">
              Gestort voor ijs
              <input
                value={iceDepositDrafts[selectedIceDepositDraftKey] ?? formatOptionalAmountInput(selectedShopRow.deposit?.iceDepositAmount)}
                onChange={(event) => setIceDepositDrafts((current) => ({ ...current, [selectedIceDepositDraftKey]: event.target.value }))}
                inputMode="decimal"
                disabled={isSelectedCashLocationClosed || Boolean(selectedShopRow.deposit?.cashbookBookedAt)}
                placeholder="0,00"
                className="h-10 rounded-xl border border-[#c8ddd2] bg-white px-3 text-sm font-bold normal-case text-[#1a1815] disabled:opacity-50"
              />
            </label>
            <label className="grid gap-0.5 text-[0.56rem] font-black uppercase text-[#1f4f35]">
              Toelichting {selectedShopRow.iceCount === 0 ? "(verplicht zonder dagrapport)" : "(optioneel)"}
              <input
                value={iceDepositNotes[selectedIceDepositDraftKey] ?? selectedShopRow.deposit?.iceDepositNote ?? ""}
                onChange={(event) => setIceDepositNotes((current) => ({ ...current, [selectedIceDepositDraftKey]: event.target.value }))}
                disabled={isSelectedCashLocationClosed || Boolean(selectedShopRow.deposit?.cashbookBookedAt)}
                placeholder="Bijv. kassa tijdelijk uitgeschakeld"
                className="h-10 rounded-xl border border-[#c8ddd2] bg-white px-3 text-xs font-bold normal-case text-[#1a1815] disabled:opacity-50"
              />
            </label>
            <button
              type="button"
              onClick={() => void saveIceDeposit(selectedShopRow)}
              disabled={state === "saving" || isSelectedCashLocationClosed || Boolean(selectedShopRow.deposit?.cashbookBookedAt)}
              className="h-10 rounded-xl bg-[#1f4f35] px-3 text-[0.68rem] font-black text-white disabled:opacity-50"
            >
              {selectedShopRow.deposit?.iceDepositedAt ? "Ijsstorting bijwerken" : "Ijsstorting opslaan"}
            </button>
          </div>
          {selectedShopRow.iceCount === 0 && (
            <p className="mt-1 text-xs text-[#1f4f35]">
              Geen ijs-dagrapport gevonden; je kunt de storting toch apart registreren.
            </p>
          )}
        </section>
      )}

      {depositReportOpen && (
        <div
          className="fixed inset-0 z-[120] flex items-end justify-center bg-[#1a1815]/45 p-2 backdrop-blur-[2px] sm:items-center sm:p-5"
          onClick={() => {
            if (mailState === "sending" || state === "saving") return;
            setDepositReportOpen(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="deposit-report-title"
            className="flex max-h-[92dvh] w-full max-w-3xl flex-col overflow-hidden rounded-[1.6rem] border border-[#d9cbb8] bg-[#fbfaf7] shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="flex items-start justify-between gap-3 border-b border-[#e7e0d8] px-4 py-3 sm:px-5">
              <div>
                <p className="text-[0.56rem] font-black uppercase tracking-[0.08em] text-[#8a6a35]">
                  Naar administratie@strik-banket.nl
                </p>
                <h2
                  id="deposit-report-title"
                  className="mt-0.5 text-xl font-black text-[#1a1815]"
                >
                  Storting melden
                </h2>
                <p className="mt-1 text-xs font-semibold text-[#6b645b]">
                  Vink de weken en locaties aan die samen op de bank zijn gestort.
                </p>
              </div>
              <button
                type="button"
                aria-label="Stortingsmelding sluiten"
                disabled={mailState === "sending" || state === "saving"}
                onClick={() => setDepositReportOpen(false)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#d9d2c9] bg-white text-lg font-black text-[#6b645b] disabled:opacity-50"
              >
                ×
              </button>
            </header>

            <div className="flex items-center justify-between gap-2 border-b border-[#e7e0d8] bg-white/70 px-4 py-2 sm:px-5">
              <p className="text-[0.62rem] font-bold text-[#6b645b]">
                {unreportedDepositOptions.length} nog te melden
              </p>
              {unreportedDepositOptions.length > 0 && (
                <button
                  type="button"
                  onClick={() =>
                    setDepositReportSelection((current) =>
                      current.length === unreportedDepositOptions.length
                        ? []
                        : unreportedDepositOptions.map((option) => option.key)
                    )
                  }
                  className="rounded-full border border-[#c8d9c3] bg-white px-3 py-1.5 text-[0.6rem] font-black text-[#1f4f35]"
                >
                  {depositReportSelection.length === unreportedDepositOptions.length
                    ? "Alles uitvinken"
                    : "Alles aanvinken"}
                </button>
              )}
            </div>

            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3 sm:p-4">
              {depositReportGroups.length ? (
                depositReportGroups.map((group) => {
                  const pendingKeys = group.options
                    .filter((option) => !option.reported)
                    .map((option) => option.key);
                  const allPendingSelected =
                    pendingKeys.length > 0 &&
                    pendingKeys.every((key) =>
                      depositReportSelection.includes(key)
                    );

                  return (
                    <section
                      key={group.key}
                      className="overflow-hidden rounded-2xl border border-[#e2dbd2] bg-white"
                    >
                      <label className="flex cursor-pointer items-center gap-2 border-b border-[#eee8e1] bg-[#f7f4ef] px-3 py-2">
                        <input
                          type="checkbox"
                          checked={allPendingSelected}
                          disabled={!pendingKeys.length}
                          onChange={() =>
                            setDepositReportSelection((current) =>
                              allPendingSelected
                                ? current.filter(
                                    (key) => !pendingKeys.includes(key)
                                  )
                                : Array.from(
                                    new Set([...current, ...pendingKeys])
                                  )
                            )
                          }
                          className="h-4 w-4 accent-[#1f4f35] disabled:opacity-40"
                        />
                        <strong className="text-xs text-[#1a1815]">
                          Week {group.week} · {group.year}
                        </strong>
                        <span className="ml-auto text-[0.6rem] font-semibold text-[#8b8278]">
                          {group.weekLabel}
                        </span>
                      </label>
                      <div className="divide-y divide-[#eee8e1]">
                        {group.options.map((option) => (
                          <label
                            key={option.key}
                            className={`flex items-center gap-3 px-3 py-2.5 ${
                              option.reported
                                ? "cursor-default bg-[#f1f7ef]"
                                : "cursor-pointer hover:bg-[#fbfaf7]"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={
                                option.reported ||
                                depositReportSelection.includes(option.key)
                              }
                              disabled={option.reported}
                              onChange={() =>
                                toggleDepositReportOption(option.key)
                              }
                              className="h-5 w-5 shrink-0 accent-[#1f4f35] disabled:opacity-60"
                            />
                            <span className="min-w-0 flex-1">
                              <strong className="block truncate text-xs text-[#1a1815]">
                                {option.label}
                              </strong>
                              <span className="text-[0.56rem] font-bold uppercase tracking-[0.04em] text-[#8b8278]">
                                Week {option.week}
                              </span>
                            </span>
                            <strong className="shrink-0 text-sm tabular-nums text-[#1a1815]">
                              {formatMoney(option.amount)}
                            </strong>
                            {option.reported && (
                              <span className="shrink-0 rounded-full bg-[#dfeadd] px-2 py-1 text-[0.52rem] font-black uppercase text-[#1f4f35]">
                                gestort
                              </span>
                            )}
                          </label>
                        ))}
                      </div>
                    </section>
                  );
                })
              ) : (
                <div className="rounded-2xl border border-[#e7e0d8] bg-white p-5 text-center">
                  <p className="text-sm font-black text-[#1a1815]">
                    Nog geen gesloten locaties
                  </p>
                  <p className="mt-1 text-xs font-semibold text-[#8b8278]">
                    Een locatie verschijnt hier zodra de weekcontrole daarvan is gesloten.
                  </p>
                </div>
              )}
            </div>

            <footer className="grid gap-2 border-t border-[#e7e0d8] bg-white px-4 py-3 sm:grid-cols-[1fr_auto_auto] sm:items-center sm:px-5">
              <div>
                <p className="text-[0.54rem] font-black uppercase tracking-[0.06em] text-[#8b8278]">
                  Geselecteerd
                </p>
                <p className="text-base font-black text-[#1f4f35]">
                  {selectedDepositReportOptions.length} locatie{selectedDepositReportOptions.length === 1 ? "" : "s"} · {formatMoney(selectedDepositReportTotal)}
                </p>
              </div>
              <button
                type="button"
                disabled={mailState === "sending" || state === "saving"}
                onClick={() => setDepositReportOpen(false)}
                className="h-10 rounded-full border border-[#d9d2c9] bg-white px-4 text-xs font-black text-[#6b645b] disabled:opacity-50"
              >
                Annuleren
              </button>
              <button
                type="button"
                disabled={
                  !selectedDepositReportOptions.length ||
                  mailState === "sending" ||
                  state === "saving"
                }
                onClick={() => void reportSelectedDeposits()}
                className="h-10 rounded-full bg-[#1f4f35] px-5 text-xs font-black text-white disabled:bg-[#cbd8c7] disabled:text-[#71806d]"
              >
                {mailState === "sending"
                  ? "Mail versturen..."
                  : "Definitief melden"}
              </button>
            </footer>
          </section>
        </div>
      )}

      {cashNoteModalOpen && selectedCashRecord && (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-[#1a1815]/45 p-2 backdrop-blur-[2px] sm:items-center sm:p-5"
          onClick={() => {
            if (state === "saving") return;
            setCashNoteModalOpen(false);
          }}
        >
          <section
            aria-labelledby="cash-note-dialog-title"
            aria-modal="true"
            role="dialog"
            onClick={(event) => event.stopPropagation()}
            className="max-h-[calc(100dvh-1rem)] w-full max-w-2xl overflow-y-auto rounded-[1.6rem] border border-[#ded5ca] bg-[#fbf9f5] p-3 shadow-2xl sm:max-h-[calc(100dvh-2.5rem)] sm:p-4"
          >
            <div className="flex items-start justify-between gap-3 border-b border-[#e7e0d8] pb-3">
              <div>
                <p className="text-[0.58rem] font-black uppercase tracking-[0.1em] text-[#866326]">
                  Geteld in de lade · {selectedCashRecord.shop}
                </p>
                <h2
                  id="cash-note-dialog-title"
                  className="mt-0.5 text-xl font-black leading-tight text-[#1a1815]"
                >
                  Coupures uit de dagafsluiting
                </h2>
                <p className="mt-1 text-xs font-semibold text-[#766f67]">
                  Deze bedragen komen uit de kassa en zijn daarom alleen-lezen.
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[0.58rem] font-black">
                  <span className="rounded-full bg-[#f2eee9] px-2 py-1 text-[#6b645b]">
                    Briefgeld {formatMoney(selectedBanknoteTotal)}
                  </span>
                  <span aria-hidden="true" className="text-[#9b938a]">
                    +
                  </span>
                  <span className="rounded-full bg-[#f2eee9] px-2 py-1 text-[#6b645b]">
                    Muntgeld {formatMoney(selectedCoinTotal)}
                  </span>
                  <span aria-hidden="true" className="text-[#9b938a]">
                    =
                  </span>
                  <span className="rounded-full bg-[#f2eee9] px-2 py-1 text-[#6b645b]">
                    Totaal {formatMoney(selectedDenominationBreakdownTotal)}
                  </span>
                </div>
                {Math.abs(selectedDenominationSourceDifference) > 0.01 && (
                  <p className="mt-2 rounded-xl border border-[#edb3a9] bg-[#fff0ed] px-3 py-2 text-xs font-black leading-snug text-[#a43b2f]">
                    ! De coupures tellen op tot{" "}
                    {formatMoney(selectedDenominationBreakdownTotal)}, maar de
                    dagafsluiting noemt {formatMoney(selectedCashRecord.countedCash)}.
                    Verschil {formatMoney(selectedDenominationSourceDifference)}.
                  </p>
                )}
              </div>
              <button
                type="button"
                aria-label="Briefjescontrole sluiten"
                onClick={() => setCashNoteModalOpen(false)}
                disabled={state === "saving"}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#ded5ca] bg-white text-lg font-black text-[#6b645b] disabled:opacity-50"
              >
                ×
              </button>
            </div>

            <div className="mt-3 rounded-2xl border border-[#e2ddd6] bg-white p-3">
              <CashNoteControl record={selectedCashRecord} />
            </div>
          </section>
        </div>
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
    <article className="mt-3 rounded-2xl border border-[#c8ddd2] bg-[#f6fbf5] p-3">
      <div className="grid gap-3 md:grid-cols-[10rem_minmax(0,1fr)_7rem] md:items-start">
        <label className="flex items-start gap-2">
          <input
            type="checkbox"
            checked={isChecked}
            disabled={disabled}
            onChange={onToggleChecked}
            className="mt-0.5 h-5 w-5 accent-[#1f4f35]"
          />
          <span>
            <span className="block text-[0.58rem] font-black uppercase tracking-normal text-[#1f4f35]">
              IJstelling
            </span>
            <span className="block text-base font-black leading-tight text-[#1a1815]">
              {dayName(record.date)} · {cashLocationLabel("ice", record.shop)}
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

        <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3 xl:grid-cols-6">
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
          <AmountCell
            label="Naar kluis"
            value={formatMoney(expectedCash)}
            tone={hasNonWholeMoney(expectedCash) ? "error" : "normal"}
          />
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
          className={`h-10 rounded-xl border px-3 text-xs font-black disabled:opacity-60 ${
            isChecked
              ? "border-[#d9d2c9] bg-white text-[#6b645b]"
              : "border-[#1f4f35] bg-[#1f4f35] text-white"
          }`}
        >
          {isChecked ? "Heropenen" : "Afvinken"}
        </button>
      </div>

      <div className="mt-3 grid gap-2 border-t border-[#c8ddd2]/80 pt-3 md:grid-cols-[12rem_7rem_minmax(14rem,1fr)] md:items-end">
        <div className="grid gap-2 rounded-xl border border-[#c8ddd2] bg-white/70 p-2.5 md:col-span-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
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
              className="h-10 rounded-xl border border-[#c8ddd2] bg-white px-3 text-sm font-black normal-case tracking-normal text-[#1a1815] disabled:opacity-60"
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
              className="h-10 rounded-xl border border-[#c8ddd2] bg-white px-3 text-sm font-black normal-case tracking-normal text-[#1a1815] disabled:opacity-60"
            />
          </label>

          <button
            type="button"
            onClick={onSaveSourceCorrection}
            disabled={isChecked || disabled || !hasSourceCorrection}
            className="h-10 rounded-xl border border-[#1f4f35] bg-[#1f4f35] px-3 text-[0.68rem] font-black text-white disabled:border-[#c8ddd2] disabled:bg-white disabled:text-[#8b8278] disabled:opacity-60"
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
            className="h-10 rounded-xl border border-[#c8ddd2] bg-white px-3 text-sm font-black normal-case tracking-normal text-[#1a1815] disabled:opacity-60"
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
            className="h-10 rounded-xl border border-[#c8ddd2] bg-white px-3 text-xs font-bold normal-case tracking-normal text-[#1a1815] disabled:opacity-60"
          />
        </label>
      </div>
    </article>
  );
}

function CashNoteControl({ record }: Readonly<{ record: RevenueCashRecord }>) {
  const usedDenominations = cashDenominations.filter(
    (denomination) => cashNoteCount(record, denomination.key) > 0
  );

  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[0.62rem] font-black uppercase tracking-[0.08em] text-[#8b8278]">
          Vastgelegd door de kassa
        </p>
        <span className="text-[0.65rem] font-bold text-[#8b8278]">
          {record.countedBy || "teller onbekend"}
        </span>
      </div>
      <div className="mt-1.5 overflow-hidden rounded-xl border border-[#e7e0d8] bg-white">
        <div className="grid grid-cols-[1fr_4rem_6rem] items-center gap-2 border-b border-[#e7e0d8] bg-[#f8f6f3] px-3 py-1.5 text-[0.56rem] font-black uppercase tracking-[0.05em] text-[#8b8278]">
          <span>Coupure</span>
          <span className="text-center">Aantal</span>
          <span className="text-right">Bedrag</span>
        </div>
        {usedDenominations.map((denomination) => {
          const count = cashNoteCount(record, denomination.key);
          const amount = roundedMoney(count * denomination.value);

          return (
            <div
              key={denomination.key}
              className="grid grid-cols-[1fr_4rem_6rem] items-center gap-2 border-b border-[#eee7df] px-3 py-2 last:border-b-0"
            >
              <span className="text-xs font-black text-[#4f493f]">
                € {denomination.label}
              </span>
              <span className="text-center text-sm font-black text-[#1a1815]">
                {count}
              </span>
              <span className="text-right text-xs font-black tabular-nums text-[#1a1815]">
                {formatMoney(amount)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BankIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="m3 9 9-5 9 5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
      <path
        d="M5 9h14M6.5 9v8M11 9v8M15.5 9v8M4 17h16M3 20h18"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

function CashOverviewMetric({
  emphasized = false,
  label,
  tone = "normal",
  value,
}: Readonly<{
  emphasized?: boolean;
  label: string;
  tone?: "normal" | "warn";
  value: string;
}>) {
  const valueColorClass =
    tone === "warn"
      ? "text-[#a43b2f]"
      : emphasized
        ? "text-[#1f4f35]"
        : "text-[#1a1815]";

  return (
    <div
      className={`min-w-0 rounded-xl px-2 py-2 ${
        emphasized ? "bg-[#f1f6ef]" : "bg-[#faf8f5]"
      }`}
    >
      <p className="truncate text-[0.5rem] font-bold uppercase tracking-[0.04em] text-[#8b8278]">
        {label}
      </p>
      <p
        className={`mt-0.5 truncate whitespace-nowrap font-black leading-none tabular-nums ${valueColorClass} ${
          emphasized ? "text-base" : "text-sm"
        }`}
        title={value}
      >
        {value}
      </p>
    </div>
  );
}

function CashOverviewMetricButton({
  label,
  onClick,
  value,
}: Readonly<{
  label: string;
  onClick: () => void;
  value: string;
}>) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="min-w-0 rounded-xl bg-[#faf8f5] px-2 py-2 text-left transition hover:bg-[#f2eee9] focus:outline-none focus:ring-2 focus:ring-[#9b938a]"
    >
      <span className="block truncate text-[0.5rem] font-bold uppercase tracking-[0.04em] text-[#8b8278]">
        {label}
      </span>
      <span
        className="mt-0.5 block truncate whitespace-nowrap text-base font-black leading-none tabular-nums text-[#1a1815]"
        title={value}
      >
        {value}
      </span>
      <span className="mt-1 block truncate text-[0.5rem] font-black uppercase tracking-[0.03em] text-[#8b8278]">
        Bekijk coupures →
      </span>
    </button>
  );
}

function WeekControlMetric({
  emphasized = false,
  label,
  tone = "normal",
  value,
}: Readonly<{
  emphasized?: boolean;
  label: string;
  tone?: "normal" | "warn";
  value: string;
}>) {
  const colorClass =
    tone === "warn"
      ? "text-[#a43b2f]"
      : emphasized
        ? "text-[#1f4f35]"
        : "text-[#1a1815]";

  return (
    <div className="min-w-0">
      <p className="truncate text-[0.48rem] font-bold uppercase tracking-[0.03em] text-[#8b8278]">
        {label}
      </p>
      <p
        className={`mt-0.5 truncate whitespace-nowrap font-black leading-none tabular-nums ${colorClass} ${
          emphasized ? "text-sm" : "text-[0.72rem]"
        }`}
        title={value}
      >
        {value}
      </p>
    </div>
  );
}

function AmountCell({
  label,
  tone = "normal",
  value,
}: Readonly<{
  label: string;
  tone?: "normal" | "warn" | "error";
  value: string;
}>) {
  const colorClass =
    tone === "error"
      ? "text-[#a43b2f]"
      : tone === "warn"
        ? "text-[#7a5417]"
        : "text-[#1a1815]";

  return (
    <div className={colorClass}>
      <p className="text-[0.62rem] font-black uppercase tracking-[0.05em] text-[#8b8278]">
        {label}
      </p>
      <p className="mt-0.5 whitespace-nowrap text-base font-black leading-tight tabular-nums">{value}</p>
    </div>
  );
}
