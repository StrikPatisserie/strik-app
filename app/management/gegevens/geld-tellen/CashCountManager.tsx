"use client";

import { useEffect, useMemo, useState } from "react";
import {
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

const euroFormatter = new Intl.NumberFormat("nl-NL", {
  currency: "EUR",
  style: "currency",
});

const banknoteDenominations = cashDenominations.filter(
  (denomination) =>
    denomination.kind === "note" &&
    denomination.value >= 5 &&
    denomination.value <= 100
);

const banknoteStyles: Record<string, { bg: string; border: string; text: string }> =
  {
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
  const [depositDrafts, setDepositDrafts] = useState<Record<string, string>>({});
  const [depositNotes, setDepositNotes] = useState<Record<string, string>>({});
  const [state, setState] = useState<LoadState>("loading");
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
        const checkedRecords = shopRecords.filter((record) => record.checkedAt);
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
          missingCount: selectedWeekDates.filter(
            (date) => !findCashRecord(shopRecords, date, shop)
          ).length,
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
      })),
    [cashRecords, selectedShop, selectedWeekDates]
  );
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
  const weekCheckedCount = checkedWeekRecords.length;
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
          checkedAt: now,
          checkedBy: "Geld teller",
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

  async function saveCash(
    nextDeposits = cashDeposits,
    nextCashRecords = cashRecords
  ) {
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
          cashRecords: nextCashRecords,
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
        Array.isArray(data.cashRecords) ? data.cashRecords : nextCashRecords
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

  const selectedDepositDraftKey = selectedShopRow
    ? `${depositWeekKey}:${selectedShopRow.shop}`
    : "";

  return (
    <div className="space-y-3">
      <section className="rounded-lg border border-[#e7e0d8]/80 bg-white/88 p-2 shadow-sm">
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
                {weekCheckedCount}/{weekRecords.length}
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

          <div className="grid grid-cols-3 gap-1">
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
          </div>
        </div>

        <div className="mt-2 grid gap-1.5 sm:grid-cols-2 xl:grid-cols-4">
          {weekRows.map((row) => {
            const isSelected = row.shop === selectedShop;

            return (
              <button
                key={row.shop}
                type="button"
                onClick={() => setSelectedShop(row.shop)}
                className={`rounded-md border p-2 text-left transition ${
                  isSelected
                    ? "border-[#1a1815] bg-[#1a1815] text-white"
                    : "border-[#e7e0d8] bg-white text-[#1a1815] hover:border-[#cfc5ba]"
                }`}
              >
                <span className="block text-sm font-black">{row.shop}</span>
                <span
                  className={`mt-1 block text-[0.62rem] font-black uppercase tracking-normal ${
                    isSelected ? "text-white/70" : "text-[#8b8278]"
                  }`}
                >
                  {row.checkedCount}/7 compleet · {formatMoney(row.includedCheckedSafeCash)}
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
        <section className="rounded-lg border border-[#e7e0d8]/80 bg-white/92 p-2 shadow-sm">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className="text-[0.58rem] font-black uppercase tracking-normal text-[#8b8278]">
                Filiaal
              </p>
              <h2 className="text-lg font-black leading-tight text-[#1a1815]">
                {selectedShopRow.shop}
              </h2>
              <p className="text-[0.68rem] font-bold text-[#8b8278]">
                Week {selectedWeek.week} · {weekRangeLabel(selectedWeek.year, selectedWeek.week)}
              </p>
            </div>
            <div className="grid min-w-[18rem] grid-cols-3 rounded-md bg-[#f8f6f3] text-center">
              <StatBox label="Compleet" value={`${selectedShopRow.checkedCount}/7`} />
              <StatBox
                label="Weektotaal"
                value={formatMoney(selectedShopRow.includedCheckedSafeCash)}
              />
              <StatBox
                label="Ontbreekt"
                value={`${selectedShopRow.missingCount}`}
                tone={selectedShopRow.missingCount > 0 ? "warn" : "normal"}
              />
            </div>
          </div>

          <div className="mt-2 grid gap-1.5">
            {selectedShopDays.map(({ date, record }) => {
              if (!record) {
                return (
                  <div
                    key={date}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-[#ece5dd] bg-[#faf8f5] px-3 py-2"
                  >
                    <div>
                      <p className="text-[0.58rem] font-black uppercase tracking-normal text-[#8b8278]">
                        {dayName(date)}
                      </p>
                      <p className="text-[0.68rem] font-bold text-[#8b8278]">
                        ontbreekt
                      </p>
                    </div>
                    <p className="text-sm font-bold text-[#8b8278]">
                      Geen Cash-it dagafsluiting ontvangen.
                    </p>
                  </div>
                );
              }

              const warning = cashWarning(record);
              const safeDraftKey = `${record.date}:${record.shop}`;
              const safeInputValue =
                safeCashDrafts[safeDraftKey] ??
                formatAmountInput(safeCheckedCash(record));
              const safeDraftDifference = Number(
                (parseAmount(safeInputValue) - safeExpectedCash(record)).toFixed(2)
              );
              const adjustmentAmount = cashAdjustmentAmount(record);

              return (
                <article
                  key={record.id}
                  className={`rounded-md border px-3 py-2 ${
                    record.checkedAt
                      ? "border-[#cbdcc5] bg-[#f6fbf5]"
                      : warning
                        ? "border-[#efd1a1] bg-[#fffdf5]"
                        : "border-[#ece5dd] bg-[#faf8f5]"
                  }`}
                >
                  <div className="grid gap-3 lg:grid-cols-[7rem_minmax(0,1fr)_7rem] lg:items-start">
                    <label className="flex items-center gap-2 lg:items-start">
                      <input
                        type="checkbox"
                        checked={Boolean(record.checkedAt)}
                        disabled={state === "saving"}
                        onChange={() => void toggleChecked(record)}
                        className="mt-0.5 h-4 w-4 accent-[#1f4f35]"
                      />
                      <span>
                        <span className="block text-[0.58rem] font-black uppercase tracking-normal text-[#8b8278]">
                          {dayShortName(record.date)}
                        </span>
                        <span className="block text-base font-black leading-tight text-[#1a1815]">
                          {record.date.slice(8, 10)}-{record.date.slice(5, 7)}
                        </span>
                        <span
                          className={`mt-0.5 inline-flex rounded-full px-2 py-0.5 text-[0.58rem] font-black uppercase tracking-normal ${
                            record.checkedAt
                              ? "bg-[#dfeadd] text-[#1f4f35]"
                              : "bg-[#f5ead6] text-[#7a5417]"
                          }`}
                        >
                          {record.checkedAt ? "compleet" : "open"}
                        </span>
                      </span>
                    </label>

                    <div className="grid gap-x-4 gap-y-2 sm:grid-cols-3 xl:grid-cols-5">
                      <AmountCell
                        label="Start"
                        value={formatOptionalMoney(record.startCash)}
                      />
                      <AmountCell label="Geteld" value={formatMoney(record.countedCash)} />
                      <AmountCell
                        label="Kas-uit/bonnen"
                        value={formatOptionalMoney(adjustmentAmount)}
                        tone={
                          adjustmentAmount !== undefined &&
                          Math.abs(adjustmentAmount) > 0.01
                            ? "warn"
                            : "normal"
                        }
                      />
                      <AmountCell
                        label="Naar kluis"
                        value={formatMoney(safeExpectedCash(record))}
                      />
                      <AmountCell
                        label="Kasverschil"
                        value={formatOptionalMoney(record.difference)}
                        tone={
                          record.difference !== undefined &&
                          Math.abs(record.difference) > 0.05
                            ? "warn"
                            : "normal"
                        }
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => void toggleChecked(record)}
                      disabled={state === "saving"}
                      className={`h-9 rounded-md border px-2 text-[0.62rem] font-black uppercase tracking-normal disabled:opacity-60 ${
                        record.checkedAt
                          ? "border-[#d9d2c9] bg-white text-[#6b645b]"
                          : "border-[#1a1815] bg-[#1a1815] text-white"
                      }`}
                    >
                      {record.checkedAt ? "Heropenen" : "Afvinken"}
                    </button>
                  </div>

                  <div className="mt-3 grid gap-3 border-t border-[#e7e0d8]/80 pt-2 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,22rem)]">
                    <CashNoteStrip record={record} />

                    <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_7rem]">
                      <label className="grid gap-0.5 text-[0.56rem] font-black uppercase tracking-normal text-[#8b8278]">
                        Controlebedrag
                        <input
                          value={safeInputValue}
                          onChange={(event) =>
                            setSafeCashDrafts((current) => ({
                              ...current,
                              [safeDraftKey]: event.target.value,
                            }))
                          }
                          inputMode="decimal"
                          placeholder="0,00"
                          className="h-9 rounded-md border border-[#d9d2c9] bg-white px-2 text-sm font-black normal-case tracking-normal text-[#1a1815]"
                        />
                      </label>

                      <AmountCell
                        label="Verschil"
                        value={formatMoney(safeDraftDifference)}
                        tone={
                          Math.abs(safeDraftDifference) > 0.01 ? "warn" : "normal"
                        }
                      />

                      <label className="grid gap-0.5 text-[0.56rem] font-black uppercase tracking-normal text-[#8b8278] sm:col-span-2">
                        Controle-notitie
                        <input
                          value={record.note || ""}
                          onChange={(event) =>
                            updateCashRecord(
                              record.date,
                              record.shop,
                              (current) => ({
                                ...current,
                                note: event.target.value,
                                updatedAt: new Date().toISOString(),
                              })
                            )
                          }
                          placeholder="Bijv. kas-uitbon ontbreekt of bedrag gecorrigeerd"
                          className="h-9 rounded-md border border-[#d9d2c9] bg-white px-2 text-xs font-bold normal-case tracking-normal text-[#1a1815]"
                        />
                      </label>
                    </div>

                    {warning && (
                      <p className="rounded-md bg-[#fff8d8] px-2 py-1 text-xs font-bold text-[#7a5417] lg:col-span-2">
                        {warning}
                      </p>
                    )}
                  </div>
                </article>
              );
            })}
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
                value={`${selectedShopRow.checkedCount}/7`}
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

function CashNoteStrip({ record }: Readonly<{ record: RevenueCashRecord }>) {
  const notes = banknoteDenominations
    .map((denomination) => ({
      denomination,
      count: cashNoteCount(record, denomination.key),
    }))
    .filter((note) => note.count > 0);

  return (
    <div className="min-w-0">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[0.55rem] font-black uppercase tracking-normal text-[#8b8278]">
          Briefjes Cash-it
        </p>
        <p className="truncate text-[0.58rem] font-bold text-[#8b8278]">
          {record.countedBy || "teller onbekend"}
        </p>
      </div>
      <div className="mt-1 flex min-h-8 flex-wrap items-center gap-1.5">
        {notes.length ? (
          notes.map(({ denomination, count }) => (
            <CashNote
              key={denomination.key}
              count={count}
              denomination={denomination}
            />
          ))
        ) : (
          <span className="text-xs font-bold text-[#8b8278]">
            Geen briefjes ontvangen.
          </span>
        )}
      </div>
    </div>
  );
}

function CashNote({
  count,
  denomination,
}: Readonly<{
  count: number;
  denomination: (typeof banknoteDenominations)[number];
}>) {
  const style = banknoteStyles[denomination.key] || banknoteStyles.eur5;

  return (
    <span className="inline-flex items-center gap-1">
      <span
        aria-hidden="true"
        className="relative inline-flex h-6 w-12 items-center justify-center overflow-hidden rounded-[3px] border text-[0.58rem] font-black shadow-sm"
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
      <span className="text-[0.62rem] font-black text-[#1a1815]">x{count}</span>
    </span>
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
