"use client";

import { useEffect, useMemo, useState } from "react";
import {
  cashDenominationTotal,
  cashDenominations,
  createRevenueCashDepositKey,
  createRevenueCashKey,
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

function weekPartsForDate(value: string) {
  const date = dateFromIso(value);

  return {
    year: getIsoWeekYear(date),
    week: getIsoWeek(date),
  };
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

function numberFrom(value: unknown) {
  const numberValue = Number(value);

  return Number.isFinite(numberValue) ? numberValue : 0;
}

function blankCashRecord(date: string, shop: RevenueShop): RevenueCashRecord {
  const parts = weekPartsForDate(date);
  const now = new Date().toISOString();

  return {
    id: createRevenueCashKey(date, shop),
    date,
    year: parts.year,
    week: parts.week,
    shop,
    denominations: {},
    denominationTotal: 0,
    countedCash: 0,
    note: "",
    source: "manual",
    importedAt: now,
    updatedAt: now,
  };
}

function recalcCashRecord(record: RevenueCashRecord): RevenueCashRecord {
  const denominationTotal = cashDenominationTotal(record.denominations);
  const expectedCash = record.expectedCash;

  return {
    ...record,
    denominationTotal,
    countedCash: denominationTotal,
    difference:
      expectedCash === undefined
        ? record.difference
        : Number((denominationTotal - expectedCash).toFixed(2)),
    updatedAt: new Date().toISOString(),
  };
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
  if (!record) return "Geen geldtelling ontvangen.";
  if (Math.abs(record.countedCash - record.denominationTotal) > 0.01) {
    return "Coupures tellen niet op naar geteld bedrag.";
  }
  if (record.difference !== undefined && Math.abs(record.difference) > 5) {
    return "Kasverschil is groter dan EUR 5.";
  }

  return "";
}

export default function CashCountManager() {
  const [selectedDate, setSelectedDate] = useState(localIsoDate());
  const [records, setRecords] = useState<RevenueRecord[]>([]);
  const [dailyRecords, setDailyRecords] = useState<RevenueDayRecord[]>([]);
  const [cashRecords, setCashRecords] = useState<RevenueCashRecord[]>([]);
  const [cashDeposits, setCashDeposits] = useState<RevenueCashDeposit[]>([]);
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
  const depositWeekKey = `${selectedWeek.year}-W${String(
    selectedWeek.week
  ).padStart(2, "0")}`;
  const dayRecords = useMemo(
    () =>
      revenueShops.map((shop) => ({
        shop,
        record: findCashRecord(cashRecords, selectedDate, shop),
      })),
    [cashRecords, selectedDate]
  );
  const dayTotal = useMemo(
    () =>
      dayRecords.reduce(
        (total, row) => total + (row.record?.countedCash || 0),
        0
      ),
    [dayRecords]
  );
  const dayCheckedCount = dayRecords.filter((row) => row.record?.checkedAt).length;

  const weekRows = useMemo(
    () =>
      revenueShops.map((shop) => {
        const shopRecords = recordsForWeek(
          cashRecords,
          selectedWeek.year,
          selectedWeek.week,
          shop
        );
        const cashRevenue = shopRecords.reduce(
          (total, record) => total + (record.cashRevenue ?? record.countedCash),
          0
        );
        const countedCash = shopRecords.reduce(
          (total, record) => total + record.countedCash,
          0
        );
        const difference = shopRecords.reduce(
          (total, record) => total + (record.difference || 0),
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
          countedCash,
          difference,
          checkedCount: shopRecords.filter((record) => record.checkedAt).length,
          deposit,
        };
      }),
    [cashDeposits, cashRecords, selectedWeek.week, selectedWeek.year]
  );

  useEffect(() => {
    setDepositDrafts((current) => {
      const next = { ...current };

      weekRows.forEach((row) => {
        const key = `${depositWeekKey}:${row.shop}`;
        if (next[key] !== undefined) return;
        next[key] = formatAmountInput(row.deposit?.amount || row.cashRevenue);
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

  function updateCashRecord(
    shop: RevenueShop,
    updater: (record: RevenueCashRecord) => RevenueCashRecord
  ) {
    setCashRecords((current) => {
      const existing = findCashRecord(current, selectedDate, shop);
      const base = existing || blankCashRecord(selectedDate, shop);
      const updated = updater(base);

      return mergeRevenueCashRecords(
        current.filter((record) => record.id !== updated.id),
        [updated]
      );
    });
  }

  function updateDenomination(
    shop: RevenueShop,
    key: CashDenominationKey,
    value: string
  ) {
    updateCashRecord(shop, (record) =>
      recalcCashRecord({
        ...record,
        denominations: {
          ...record.denominations,
          [key]: Math.max(0, Math.trunc(numberFrom(value))),
        },
      })
    );
  }

  function markChecked(shop: RevenueShop) {
    updateCashRecord(shop, (record) => ({
      ...recalcCashRecord(record),
      checkedAt: new Date().toISOString(),
      checkedBy: "Strik app",
      updatedAt: new Date().toISOString(),
    }));
  }

  async function saveCash(nextDeposits = cashDeposits) {
    setState("saving");
    setStatus("Geldtelling opslaan...");

    try {
      const response = await fetch("/api/management-revenue", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          records,
          dailyRecords,
          cashRecords,
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
            "Geldtelling opslaan is mislukt."
        );
      }

      setRecords(Array.isArray(data.records) ? data.records : records);
      setDailyRecords(
        Array.isArray(data.dailyRecords) ? data.dailyRecords : dailyRecords
      );
      setCashRecords(
        Array.isArray(data.cashRecords) ? data.cashRecords : cashRecords
      );
      setCashDeposits(
        Array.isArray(data.cashDeposits) ? data.cashDeposits : nextDeposits
      );
      setStorage(data.storage);
      setStatus("Geldtelling opgeslagen.");
      setState("ready");
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Geldtelling opslaan is mislukt."
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
        <div className="grid gap-2 md:grid-cols-[10rem_minmax(0,1fr)_auto] md:items-end">
          <label className="grid gap-0.5 text-[0.56rem] font-black uppercase tracking-[0.08em] text-[#2d2a26]/45">
            Datum
            <input
              type="date"
              value={selectedDate}
              onChange={(event) => setSelectedDate(event.target.value)}
              className="h-9 rounded-md border border-[#e7e0d8] bg-white px-2 text-sm font-black normal-case tracking-normal text-[#1a1815]"
            />
          </label>
          <div className="grid grid-cols-3 rounded-md bg-[#f8f6f3] text-center">
            <div className="border-r border-[#e7e0d8] px-2 py-1.5">
              <p className="text-[0.56rem] font-black uppercase tracking-normal text-[#8b8278]">
                Dagcheck
              </p>
              <p className="text-sm font-black text-[#1a1815]">
                {dayCheckedCount}/4
              </p>
            </div>
            <div className="border-r border-[#e7e0d8] px-2 py-1.5">
              <p className="text-[0.56rem] font-black uppercase tracking-normal text-[#8b8278]">
                Geteld
              </p>
              <p className="text-sm font-black text-[#1a1815]">
                {formatMoney(dayTotal)}
              </p>
            </div>
            <div className="px-2 py-1.5">
              <p className="text-[0.56rem] font-black uppercase tracking-normal text-[#8b8278]">
                Week
              </p>
              <p className="text-sm font-black text-[#1a1815]">
                {selectedWeek.week} · {selectedWeek.year}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void saveCash()}
            disabled={state === "loading" || state === "saving"}
            className="rounded-md bg-[#1a1815] px-3 py-2 text-xs font-black uppercase tracking-normal text-white shadow-sm transition hover:bg-[#3b352f] disabled:opacity-60"
          >
            {state === "saving" ? "Opslaan..." : "Dag opslaan"}
          </button>
        </div>

        {storage?.status === "seed" && (
          <p className="mt-2 rounded-md border border-[#f3d4a4] bg-[#fef9f3] px-2 py-1.5 text-xs font-bold text-[#7a5417]">
            {storage.message} Nieuwe geldtellingen worden pas blijvend opgeslagen
            zodra de WordPress omzet-snippet actief is.
          </p>
        )}

        {status && (
          <p className="mt-2 rounded-md bg-[#f8f6f3] px-2 py-1.5 text-xs font-bold text-[#6b645b]">
            {status}
          </p>
        )}
      </section>

      <section className="grid gap-2 xl:grid-cols-2">
        {dayRecords.map(({ shop, record }) => {
          const warning = cashWarning(record);

          return (
            <article
              key={shop}
              className={`rounded-lg border bg-white/92 p-2 shadow-sm ${
                record?.checkedAt
                  ? "border-[#cbdcc5]"
                  : warning
                    ? "border-[#efd1a1]"
                    : "border-[#e7e0d8]"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[0.58rem] font-black uppercase tracking-normal text-[#8b8278]">
                    {dayName(selectedDate)}
                  </p>
                  <h2 className="text-base font-black leading-tight text-[#1a1815]">
                    {shop}
                  </h2>
                  <p className="mt-0.5 text-[0.68rem] font-bold text-[#6b645b]">
                    {record
                      ? `${record.openedAt || "open ?"} - ${record.closedAt || "sluit ?"} · ${record.countedBy || "teller onbekend"}`
                      : "Nog geen Cash-it telling ontvangen."}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={!record}
                  onClick={() => markChecked(shop)}
                  className={`rounded-md border px-2 py-1 text-[0.62rem] font-black uppercase tracking-normal ${
                    record?.checkedAt
                      ? "border-[#cbdcc5] bg-[#ecf4ed] text-[#1f4f35]"
                      : "border-[#1a1815] bg-white text-[#1a1815] disabled:border-[#e7e0d8] disabled:text-[#aaa]"
                  }`}
                >
                  {record?.checkedAt ? "Gecheckt" : "Afvinken"}
                </button>
              </div>

              <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                <StatBox label="Startgeld" value={formatMoney(record?.startCash)} />
                <StatBox
                  label="Kasomzet"
                  value={formatMoney(record?.cashRevenue)}
                />
                <StatBox label="Geteld" value={formatMoney(record?.countedCash)} />
                <StatBox
                  label="Verschil"
                  value={formatMoney(record?.difference)}
                  tone={
                    record?.difference && Math.abs(record.difference) > 0.05
                      ? "warn"
                      : "normal"
                  }
                />
              </div>

              {warning && (
                <p className="mt-2 rounded-md bg-[#fff8d8] px-2 py-1 text-xs font-bold text-[#7a5417]">
                  {warning}
                </p>
              )}

              <div className="mt-2 grid grid-cols-3 gap-1 sm:grid-cols-5">
                {cashDenominations.map((denomination) => (
                  <label
                    key={denomination.key}
                    className="grid gap-0.5 rounded-md border border-[#ece5dd] bg-[#faf8f5] px-1.5 py-1 text-[0.54rem] font-black uppercase tracking-normal text-[#8b8278]"
                  >
                    EUR {denomination.label}
                    <input
                      value={record?.denominations[denomination.key] || ""}
                      onChange={(event) =>
                        updateDenomination(
                          shop,
                          denomination.key,
                          event.target.value
                        )
                      }
                      inputMode="numeric"
                      placeholder="0"
                      className="h-7 rounded border border-[#d9d2c9] bg-white px-1.5 text-sm font-black normal-case tracking-normal text-[#1a1815]"
                    />
                  </label>
                ))}
              </div>

              <label className="mt-2 grid gap-0.5 text-[0.56rem] font-black uppercase tracking-normal text-[#8b8278]">
                Notitie
                <input
                  value={record?.note || ""}
                  onChange={(event) =>
                    updateCashRecord(shop, (current) => ({
                      ...current,
                      note: event.target.value,
                      updatedAt: new Date().toISOString(),
                    }))
                  }
                  placeholder="Bijv. wisselgeld aangepast of kasverschil verklaard"
                  className="h-8 rounded-md border border-[#d9d2c9] bg-white px-2 text-xs font-bold normal-case tracking-normal text-[#1a1815]"
                />
              </label>
            </article>
          );
        })}
      </section>

      <section className="rounded-lg border border-[#e7e0d8]/80 bg-white/92 p-2 shadow-sm">
        <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-sm font-black text-[#1a1815]">
              Week {selectedWeek.week} · {selectedWeek.year}
            </h2>
            <p className="text-[0.68rem] font-bold leading-tight text-[#8b8278]">
              Kasomzet is het advies voor de storting; geteld cash blijft
              zichtbaar voor controle op startgeld en verschil.
            </p>
          </div>
        </div>

        <div className="grid gap-1.5">
          {weekRows.map((row) => {
            const draftKey = `${depositWeekKey}:${row.shop}`;

            return (
              <article
                key={row.shop}
                className="grid gap-2 rounded-md border border-[#e7e0d8] bg-[#faf8f5] p-2 lg:grid-cols-[7rem_repeat(4,minmax(0,1fr))_10rem_10rem_auto] lg:items-center"
              >
                <h3 className="text-sm font-black text-[#1a1815]">{row.shop}</h3>
                <StatBox
                  label="Dagen"
                  value={`${row.checkedCount}/${row.records.length}`}
                />
                <StatBox label="Kasomzet" value={formatMoney(row.cashRevenue)} />
                <StatBox label="Geteld" value={formatMoney(row.countedCash)} />
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
