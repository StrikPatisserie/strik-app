"use client";

import { useEffect, useMemo, useState } from "react";
import {
  cashDenominations,
  createRevenueCashDepositKey,
  mergeRevenueCashDeposits,
  mergeRevenueCashRecords,
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
            .at(-1) || selectedDate;

        setRecords(Array.isArray(data.records) ? data.records : []);
        setDailyRecords(Array.isArray(data.dailyRecords) ? data.dailyRecords : []);
        setCashRecords(nextCashRecords);
        setCashDeposits(
          Array.isArray(data.cashDeposits) ? data.cashDeposits : []
        );
        setStorage(data.storage);
        setSelectedDate(latestDate);
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
  const weekRows = useMemo(
    () =>
      revenueShops.map((shop) => {
        const shopRecords = recordsForWeek(
          cashRecords,
          selectedWeek.year,
          selectedWeek.week,
          shop
        ).sort((first, second) => first.date.localeCompare(second.date));
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
        const difference = shopRecords.reduce(
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
          difference,
          checkedCount: shopRecords.filter((record) => record.checkedAt).length,
          deposit,
        };
      }),
    [cashDeposits, cashRecords, selectedWeek.week, selectedWeek.year]
  );
  const weekRecords = useMemo(
    () => weekRows.flatMap((row) => row.records),
    [weekRows]
  );
  const weekExpectedTotal = useMemo(
    () =>
      weekRecords.reduce((total, record) => total + safeExpectedCash(record), 0),
    [weekRecords]
  );
  const weekCheckedTotal = useMemo(
    () =>
      weekRecords.reduce((total, record) => total + safeCheckedCash(record), 0),
    [weekRecords]
  );
  const weekCheckedCount = weekRecords.filter((record) => record.checkedAt).length;
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

  useEffect(() => {
    setSafeCashDrafts((current) => {
      const next = { ...current };

      weekRecords.forEach((record) => {
        const key = `${record.date}:${record.shop}`;
        if (next[key] !== undefined) return;
        next[key] = formatAmountInput(safeCheckedCash(record));
      });

      return next;
    });
  }, [weekRecords]);

  useEffect(() => {
    setDepositDrafts((current) => {
      const next = { ...current };

      weekRows.forEach((row) => {
        const key = `${depositWeekKey}:${row.shop}`;
        if (next[key] !== undefined) return;
        next[key] = formatAmountInput(row.deposit?.amount || row.checkedSafeCash);
      });

      return next;
    });
    setDepositNotes((current) => {
      const next = { ...current };

      weekRows.forEach((row) => {
        const key = `${depositWeekKey}:${row.shop}`;
        if (next[key] !== undefined || !row.deposit?.note) return;
        next[key] = row.deposit.note;
      });

      return next;
    });
  }, [depositWeekKey, weekRows]);

  function buildUpdatedCashRecords(
    current: RevenueCashRecord[],
    date: string,
    shop: RevenueShop,
    updater: (record: RevenueCashRecord) => RevenueCashRecord
  ) {
    const existing = findCashRecord(current, date, shop);
    if (!existing) return current;

    const updated = updater(existing);

    return mergeRevenueCashRecords(
      current.filter((record) => record.id !== updated.id),
      [updated]
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
    const amount = parseAmount(depositDrafts[draftKey] || "");
    const dateRange = row.records.map((record) => record.date).sort();
    const deposit: RevenueCashDeposit = {
      id: createRevenueCashDepositKey(selectedWeek.year, selectedWeek.week, row.shop),
      year: selectedWeek.year,
      week: selectedWeek.week,
      shop: row.shop,
      amount,
      dateFrom: dateRange[0],
      dateTo: dateRange.at(-1),
      cashRecordIds: row.records.map((record) => record.id),
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

  return (
    <div className="space-y-3">
      <section className="rounded-lg border border-[#e7e0d8]/80 bg-white/88 p-2 shadow-sm">
        <div className="grid gap-2 md:grid-cols-[15rem_minmax(0,1fr)_auto] md:items-end">
          <label className="grid gap-0.5 text-[0.56rem] font-black uppercase tracking-[0.08em] text-[#2d2a26]/45">
            Week
            <select
              value={depositWeekKey}
              onChange={(event) => {
                const parts = parseWeekKey(event.target.value);
                if (!parts) return;

                setSelectedDate(isoDateFromDate(dateFromIsoWeekParts(parts.year, parts.week)));
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
                Weekcheck
              </p>
              <p className="text-sm font-black text-[#1a1815]">
                {weekCheckedCount}/{weekRecords.length}
              </p>
            </div>
            <div className="border-r border-[#e7e0d8] px-2 py-1.5">
              <p className="text-[0.56rem] font-black uppercase tracking-normal text-[#8b8278]">
                Kluis verwacht
              </p>
              <p className="text-sm font-black text-[#1a1815]">
                {formatMoney(weekExpectedTotal)}
              </p>
            </div>
            <div className="px-2 py-1.5">
              <p className="text-[0.56rem] font-black uppercase tracking-normal text-[#8b8278]">
                Kluis geteld
              </p>
              <p className="text-sm font-black text-[#1a1815]">
                {formatMoney(weekCheckedTotal)}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void saveCash()}
            disabled={state === "loading" || state === "saving"}
            className="rounded-md bg-[#1a1815] px-3 py-2 text-xs font-black uppercase tracking-normal text-white shadow-sm transition hover:bg-[#3b352f] disabled:opacity-60"
          >
            {state === "saving" ? "Opslaan..." : "Wijzigingen opslaan"}
          </button>
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

      <section className="grid gap-2">
        {weekRows.map((row) => (
          <article
            key={row.shop}
            className="rounded-lg border border-[#e7e0d8]/80 bg-white/92 p-2 shadow-sm"
          >
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <p className="text-[0.58rem] font-black uppercase tracking-normal text-[#8b8278]">
                  Filiaal
                </p>
                <h2 className="text-base font-black leading-tight text-[#1a1815]">
                  {row.shop}
                </h2>
              </div>
              <div className="grid min-w-[16rem] grid-cols-3 rounded-md bg-[#f8f6f3] text-center">
                <StatBox label="Dagen" value={`${row.checkedCount}/${row.records.length}`} />
                <StatBox
                  label="Kluis verwacht"
                  value={formatMoney(row.expectedSafeCash)}
                />
                <StatBox
                  label="Kluis geteld"
                  value={formatMoney(row.checkedSafeCash)}
                />
              </div>
            </div>

            <div className="mt-2 grid gap-1.5">
              {row.records.length ? (
                row.records.map((record) => {
                  const warning = cashWarning(record);
                  const safeDraftKey = `${record.date}:${record.shop}`;
                  const safeInputValue =
                    safeCashDrafts[safeDraftKey] ??
                    formatAmountInput(safeCheckedCash(record));
                  const safeDraftDifference = Number(
                    (parseAmount(safeInputValue) - safeExpectedCash(record)).toFixed(2)
                  );

                  return (
                    <div
                      key={record.id}
                      className={`grid gap-2 rounded-md border p-2 lg:grid-cols-[6.4rem_minmax(12rem,1.15fr)_minmax(12rem,1.1fr)_8.5rem_8rem_auto] lg:items-center ${
                        record.checkedAt
                          ? "border-[#cbdcc5] bg-[#f6fbf5]"
                          : warning
                            ? "border-[#efd1a1] bg-[#fffdf5]"
                            : "border-[#ece5dd] bg-[#faf8f5]"
                      }`}
                    >
                      <div>
                        <p className="text-[0.58rem] font-black uppercase tracking-normal text-[#8b8278]">
                          {dayName(record.date)}
                        </p>
                        <p className="text-[0.68rem] font-bold text-[#6b645b]">
                          {record.checkedAt ? "kluis gecheckt" : "nog open"}
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                        <StatBox
                          label="Kasomzet"
                          value={formatMoney(record.cashRevenue)}
                        />
                        <StatBox
                          label="Startgeld"
                          value={formatMoney(record.startCash)}
                        />
                        <StatBox
                          label="Kluis verwacht"
                          value={formatMoney(safeExpectedCash(record))}
                        />
                        <StatBox
                          label="Kasverschil"
                          value={formatMoney(record.difference)}
                          tone={
                            record.difference && Math.abs(record.difference) > 0.05
                              ? "warn"
                              : "normal"
                          }
                        />
                      </div>

                      <CashNoteStrip record={record} />

                      <label className="grid gap-0.5 text-[0.56rem] font-black uppercase tracking-normal text-[#8b8278]">
                        Kluis geteld
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
                          className="h-8 rounded-md border border-[#d9d2c9] bg-white px-2 text-sm font-black normal-case tracking-normal text-[#1a1815]"
                        />
                      </label>

                      <StatBox
                        label="Verschil"
                        value={formatMoney(safeDraftDifference)}
                        tone={
                          record.checkedAt && Math.abs(safeDraftDifference) > 0.01
                            ? "warn"
                            : "normal"
                        }
                      />

                      <button
                        type="button"
                        onClick={() => void markChecked(record)}
                        disabled={state === "saving"}
                        className={`rounded-md border px-2 py-2 text-[0.62rem] font-black uppercase tracking-normal ${
                          record.checkedAt
                            ? "border-[#cbdcc5] bg-[#ecf4ed] text-[#1f4f35]"
                            : "border-[#1a1815] bg-white text-[#1a1815] disabled:opacity-60"
                        }`}
                      >
                        {record.checkedAt ? "Gecheckt" : "Kluis klopt"}
                      </button>

                      <div className="grid gap-1 lg:col-span-6">
                        {warning && (
                          <p className="rounded-md bg-[#fff8d8] px-2 py-1 text-xs font-bold text-[#7a5417]">
                            {warning}
                          </p>
                        )}
                        <label className="grid gap-0.5 text-[0.56rem] font-black uppercase tracking-normal text-[#8b8278]">
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
                            placeholder="Bijv. kluis mist EUR 5 of kasverschil verklaard"
                            className="h-8 rounded-md border border-[#d9d2c9] bg-white px-2 text-xs font-bold normal-case tracking-normal text-[#1a1815]"
                          />
                        </label>
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="rounded-md border border-[#ece5dd] bg-[#faf8f5] px-2 py-3 text-sm font-bold text-[#8b8278]">
                  Geen Cash-it dagafsluitingen voor dit filiaal in deze week.
                </p>
              )}
            </div>
          </article>
        ))}
      </section>

      <section className="rounded-lg border border-[#e7e0d8]/80 bg-white/92 p-2 shadow-sm">
        <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-sm font-black text-[#1a1815]">
              Week {selectedWeek.week} · {selectedWeek.year}
            </h2>
            <p className="text-[0.68rem] font-bold leading-tight text-[#8b8278]">
              De geldteller controleert per dag wat er in de kluis ligt; de
              weekstorting bundelt die gecontroleerde kluisbedragen.
            </p>
          </div>
        </div>

        <div className="grid gap-1.5">
          {weekRows.map((row) => {
            const draftKey = `${depositWeekKey}:${row.shop}`;

            return (
              <article
                key={row.shop}
                className="grid gap-2 rounded-md border border-[#e7e0d8] bg-[#faf8f5] p-2 lg:grid-cols-[7rem_repeat(5,minmax(0,1fr))_10rem_10rem_auto] lg:items-center"
              >
                <h3 className="text-sm font-black text-[#1a1815]">{row.shop}</h3>
                <StatBox
                  label="Dagen"
                  value={`${row.checkedCount}/${row.records.length}`}
                />
                <StatBox label="Kasomzet" value={formatMoney(row.cashRevenue)} />
                <StatBox
                  label="Kluis verwacht"
                  value={formatMoney(row.expectedSafeCash)}
                />
                <StatBox
                  label="Kluis geteld"
                  value={formatMoney(row.checkedSafeCash)}
                />
                <StatBox label="Verschil" value={formatMoney(row.difference)} />
                <label className="grid gap-0.5 text-[0.56rem] font-black uppercase tracking-normal text-[#8b8278]">
                  Storting
                  <input
                    value={depositDrafts[draftKey] || ""}
                    onChange={(event) =>
                      setDepositDrafts((current) => ({
                        ...current,
                        [draftKey]: event.target.value,
                      }))
                    }
                    inputMode="decimal"
                    placeholder="0,00"
                    className="h-8 rounded-md border border-[#d9d2c9] bg-white px-2 text-sm font-black normal-case tracking-normal text-[#1a1815]"
                  />
                </label>
                <label className="grid gap-0.5 text-[0.56rem] font-black uppercase tracking-normal text-[#8b8278]">
                  Stortnotitie
                  <input
                    value={depositNotes[draftKey] ?? row.deposit?.note ?? ""}
                    onChange={(event) =>
                      setDepositNotes((current) => ({
                        ...current,
                        [draftKey]: event.target.value,
                      }))
                    }
                    placeholder={row.deposit?.depositedAt ? "al gestort" : "optioneel"}
                    className="h-8 rounded-md border border-[#d9d2c9] bg-white px-2 text-xs font-bold normal-case tracking-normal text-[#1a1815]"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => void saveDeposit(row)}
                  disabled={state === "saving" || row.records.length === 0}
                  className="rounded-md bg-[#c3d3bc] px-2 py-2 text-[0.62rem] font-black uppercase tracking-normal text-[#1a1815] disabled:opacity-50"
                >
                  {row.deposit?.depositedAt
                    ? "Storting bijwerken"
                    : "Storting opslaan"}
                </button>
              </article>
            );
          })}
        </div>
      </section>
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
    <div className="rounded-md border border-[#ece5dd] bg-white px-2 py-1.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[0.55rem] font-black uppercase tracking-normal text-[#8b8278]">
          Briefjes Cash-it
        </p>
        <p className="truncate text-[0.58rem] font-bold text-[#8b8278]">
          {record.countedBy || "teller onbekend"}
        </p>
      </div>
      <div className="mt-1 flex min-h-8 flex-wrap items-center gap-1">
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
