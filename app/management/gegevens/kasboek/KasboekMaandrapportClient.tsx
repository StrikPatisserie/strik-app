"use client";

import { useEffect, useMemo, useState } from "react";
import {
  revenueShops,
  type RevenueCashDeposit,
  type RevenueCashRecord,
  type RevenueData,
  type RevenueDayRecord,
  type RevenueRecord,
  type RevenueShop,
} from "@/app/management/revenueData";

type LoadState = "loading" | "ready" | "saving" | "error";

type RevenueResponse = RevenueData & {
  storage?: {
    status: "wordpress" | "seed";
    message?: string;
    wordpressStatus?: number;
  };
};

type ReportLine = {
  label: "Winkel" | "IJs";
  daysWithData: number;
  expectedDays: number;
  checkedDays: number;
  revenue: number | null;
  deposited: number | null;
  pinPaid: number | null;
  giftCards: number | null;
  cashOut: number | null;
  cashDifference: number | null;
  hasData: boolean;
};

type ShopReport = {
  shop: RevenueShop;
  winkel: ReportLine;
  ijs: ReportLine;
  comments: string[];
  warnings: string[];
};

const euroFormatter = new Intl.NumberFormat("nl-NL", {
  currency: "EUR",
  style: "currency",
});

function roundMoney(value: number) {
  return Number(value.toFixed(2));
}

function localIsoDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function localMonthKey(date = new Date()) {
  return localIsoDate(date).slice(0, 7);
}

function dateFromIso(value: string) {
  const [year, month, day] = value.split("-").map(Number);

  return new Date(year, month - 1, day);
}

function datesInMonth(monthKey: string) {
  const match = monthKey.match(/^(\d{4})-(\d{2})$/);
  if (!match) return [];

  const year = Number(match[1]);
  const month = Number(match[2]);
  const date = new Date(year, month - 1, 1);
  const dates: string[] = [];

  while (date.getMonth() === month - 1) {
    dates.push(localIsoDate(date));
    date.setDate(date.getDate() + 1);
  }

  return dates;
}

function monthLabel(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  const date = new Date(year, month - 1, 1);

  return date.toLocaleDateString("nl-NL", {
    month: "long",
    year: "numeric",
  });
}

function dayLabel(date: string) {
  return `${date.slice(8, 10)}-${date.slice(5, 7)}`;
}

function formatMoney(value: number | null | undefined) {
  if (value === null || value === undefined) return "-";

  return euroFormatter.format(value);
}

function sumMoney<T>(items: T[], picker: (item: T) => number | undefined) {
  return roundMoney(
    items.reduce((total, item) => total + (picker(item) || 0), 0)
  );
}

function isDefaultCashNote(value: string | undefined) {
  return /^Geldtelling via Gmail\b/i.test(String(value || "").trim());
}

function visibleCashNote(value: string | undefined) {
  const note = String(value || "").trim();

  return isDefaultCashNote(note) ? "" : note;
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

function safeExpectedCash(record: RevenueCashRecord | undefined) {
  if (!record) return 0;

  if (record.startCash !== undefined) {
    return Math.max(
      0,
      roundMoney((record.countedCash || 0) - record.startCash)
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

  return record.safeDifference ?? roundMoney(safeCheckedCash(record) - safeExpectedCash(record));
}

function cashAdjustmentAmount(record: RevenueCashRecord) {
  if (
    record.startCash === undefined ||
    record.cashRevenue === undefined ||
    record.expectedCash === undefined
  ) {
    return undefined;
  }

  return roundMoney(record.startCash + record.cashRevenue - record.expectedCash);
}

function cashOutAmount(record: RevenueCashRecord) {
  return record.cashOut ?? cashAdjustmentAmount(record) ?? 0;
}

function receiptAmount(record: RevenueCashRecord) {
  return record.receipts ?? 0;
}

function iceExpectedCash(record: RevenueCashRecord | undefined) {
  if (!record) return 0;

  return record.iceExpectedCash ?? record.iceCash ?? record.iceCashRevenue ?? 0;
}

function iceCheckedCash(record: RevenueCashRecord | undefined) {
  if (!record) return 0;

  return record.iceSafeCash ?? iceExpectedCash(record);
}

function isCashExpectedForShopDate(shop: RevenueShop, date: string) {
  return !(shop === "Daalseweg" && dateFromIso(date).getDay() === 0);
}

function recordsByDate<T extends { date: string }>(records: T[]) {
  return records.reduce((map, record) => {
    map.set(record.date, record);

    return map;
  }, new Map<string, T>());
}

function cashDepositTouchesMonth(
  deposit: RevenueCashDeposit,
  monthKey: string
) {
  const monthDates = datesInMonth(monthKey);
  const monthStart = `${monthKey}-01`;
  const monthEnd = monthDates.at(-1) || monthStart;
  const depositStart =
    deposit.dateFrom || deposit.dateTo || deposit.depositedAt?.slice(0, 10) || "";
  const depositEnd =
    deposit.dateTo || deposit.dateFrom || deposit.depositedAt?.slice(0, 10) || "";

  if (!depositStart && !depositEnd) return false;

  return depositStart <= monthEnd && depositEnd >= monthStart;
}

function buildMonthCashTotals(cashRecords: RevenueCashRecord[], month: string) {
  const monthRecords = cashRecords.filter((record) => record.date.startsWith(month));
  const patisserieRecords = monthRecords.filter(hasPatisserieCashRecord);
  const iceRecords = monthRecords.filter(hasIceCashRecord);
  const checkedPatisserieRecords = patisserieRecords.filter(
    (record) => record.checkedAt
  );
  const checkedIceRecords = iceRecords.filter((record) => record.iceCheckedAt);

  return {
    cashRevenue: sumMoney(
      patisserieRecords,
      (record) => record.cashRevenue ?? safeExpectedCash(record)
    ),
    iceCashRevenue: sumMoney(
      iceRecords,
      (record) => record.iceCashRevenue ?? iceExpectedCash(record)
    ),
    checkedPatisserieCash: sumMoney(checkedPatisserieRecords, safeCheckedCash),
    checkedIceCash: sumMoney(checkedIceRecords, iceCheckedCash),
    receipts: roundMoney(
      sumMoney(patisserieRecords, receiptAmount) +
        sumMoney(iceRecords, (record) => record.iceReceipts)
    ),
    cashOut: roundMoney(
      sumMoney(patisserieRecords, cashOutAmount) +
        sumMoney(iceRecords, (record) => record.iceCashOut)
    ),
    cashDifference: roundMoney(
      sumMoney(patisserieRecords, (record) => record.difference) +
        sumMoney(iceRecords, (record) => record.iceDifference)
    ),
  };
}

function reportLineStatus(line: ReportLine) {
  if (!line.expectedDays && !line.hasData) return "Geen data";
  if (line.expectedDays && line.checkedDays < line.expectedDays) {
    return `${line.checkedDays}/${line.expectedDays} gecontroleerd`;
  }

  return "Compleet";
}

function buildWinkelLine(input: {
  dates: string[];
  today: string;
  shop: RevenueShop;
  dailyRecords: RevenueDayRecord[];
  cashRecords: RevenueCashRecord[];
  comments: string[];
  warnings: string[];
}) {
  const dailyByDate = recordsByDate(input.dailyRecords);
  const cashByDate = recordsByDate(input.cashRecords);
  const expectedDates = input.dates.filter(
    (date) => date <= input.today && isCashExpectedForShopDate(input.shop, date)
  );
  const completeDates = expectedDates.filter(
    (date) => dailyByDate.has(date) && hasPatisserieCashRecord(cashByDate.get(date))
  );

  expectedDates.forEach((date) => {
    const dailyRecord = dailyByDate.get(date);
    const cashRecord = cashByDate.get(date);

    if (!dailyRecord) {
      input.warnings.push(`${dayLabel(date)}: omzet niet ingeladen.`);
    }
    if (!hasPatisserieCashRecord(cashRecord)) {
      input.warnings.push(`${dayLabel(date)}: geldtelling niet ingeladen.`);
      return;
    }
    if (!cashRecord.checkedAt) {
      input.warnings.push(`${dayLabel(date)}: geldtelling nog niet afgevinkt.`);
    }

    const note = visibleCashNote(cashRecord.note);
    if (note) input.comments.push(`${dayLabel(date)}: opmerking: ${note}`);
    if (cashOutAmount(cashRecord) > 0) {
      input.comments.push(
        `${dayLabel(date)}: kas-uit ${formatMoney(cashOutAmount(cashRecord))}.`
      );
    }
    if (cashRecord.difference !== undefined && Math.abs(cashRecord.difference) > 0.01) {
      input.comments.push(
        `${dayLabel(date)}: kasverschil ${formatMoney(cashRecord.difference)}.`
      );
    }
    if (cashRecord.checkedAt && Math.abs(safeDifference(cashRecord)) > 0.01) {
      input.comments.push(
        `${dayLabel(date)}: kluisverschil ${formatMoney(safeDifference(cashRecord))}.`
      );
    }
  });

  const pinPaid = roundMoney(
    completeDates.reduce((total, date) => {
      const dailyRecord = dailyByDate.get(date);
      const cashRecord = cashByDate.get(date);
      if (!dailyRecord || !hasPatisserieCashRecord(cashRecord)) return total;

      const calculated =
        dailyRecord.amount -
        (cashRecord.cashRevenue ?? safeExpectedCash(cashRecord)) -
        receiptAmount(cashRecord);

      if (calculated < -0.01) {
        input.warnings.push(
          `${dayLabel(date)}: pin kan niet netjes worden berekend uit omzet minus contant en bonnen.`
        );
      }

      return total + Math.max(0, calculated);
    }, 0)
  );

  const checkedRecords = input.cashRecords.filter(
    (record) => hasPatisserieCashRecord(record) && record.checkedAt
  );

  return {
    label: "Winkel",
    daysWithData: input.dailyRecords.length,
    expectedDays: expectedDates.length,
    checkedDays: checkedRecords.length,
    revenue: sumMoney(input.dailyRecords, (record) => record.amount),
    deposited: sumMoney(checkedRecords, safeCheckedCash),
    pinPaid,
    giftCards: sumMoney(input.cashRecords, receiptAmount),
    cashOut: sumMoney(input.cashRecords, cashOutAmount),
    cashDifference: sumMoney(input.cashRecords, (record) => record.difference),
    hasData: input.dailyRecords.length > 0 || input.cashRecords.length > 0,
  } satisfies ReportLine;
}

function buildIceLine(input: {
  cashRecords: RevenueCashRecord[];
  comments: string[];
  warnings: string[];
}) {
  input.cashRecords.forEach((record) => {
    if (!record.iceCheckedAt) {
      input.warnings.push(`${dayLabel(record.date)}: ijstelling nog niet afgevinkt.`);
    }
    if (record.iceNote?.trim()) {
      input.comments.push(`${dayLabel(record.date)}: ijs opmerking: ${record.iceNote.trim()}`);
    }
    if ((record.iceCashOut || 0) > 0) {
      input.comments.push(
        `${dayLabel(record.date)}: ijs kas-uit ${formatMoney(record.iceCashOut)}.`
      );
    }
    if (record.iceDifference !== undefined && Math.abs(record.iceDifference) > 0.01) {
      input.comments.push(
        `${dayLabel(record.date)}: ijs kasverschil ${formatMoney(record.iceDifference)}.`
      );
    }
    if (
      record.iceCheckedAt &&
      record.iceSafeDifference !== undefined &&
      Math.abs(record.iceSafeDifference) > 0.01
    ) {
      input.comments.push(
        `${dayLabel(record.date)}: ijs kluisverschil ${formatMoney(record.iceSafeDifference)}.`
      );
    }
  });

  const checkedRecords = input.cashRecords.filter((record) => record.iceCheckedAt);

  return {
    label: "IJs",
    daysWithData: input.cashRecords.length,
    expectedDays: input.cashRecords.length,
    checkedDays: checkedRecords.length,
    revenue: null,
    deposited: sumMoney(checkedRecords, iceCheckedCash),
    pinPaid: null,
    giftCards: sumMoney(input.cashRecords, (record) => record.iceReceipts),
    cashOut: sumMoney(input.cashRecords, (record) => record.iceCashOut),
    cashDifference: sumMoney(input.cashRecords, (record) => record.iceDifference),
    hasData: input.cashRecords.length > 0,
  } satisfies ReportLine;
}

function buildShopReports(input: {
  month: string;
  dailyRecords: RevenueDayRecord[];
  cashRecords: RevenueCashRecord[];
}) {
  const dates = datesInMonth(input.month);
  const today = localIsoDate();

  return revenueShops.map((shop) => {
    const comments: string[] = [];
    const warnings: string[] = [];
    const shopDailyRecords = input.dailyRecords.filter(
      (record) => record.shop === shop && record.date.startsWith(input.month)
    );
    const shopCashRecords = input.cashRecords.filter(
      (record) => record.shop === shop && record.date.startsWith(input.month)
    );
    const winkelCashRecords = shopCashRecords.filter(hasPatisserieCashRecord);
    const iceCashRecords = shopCashRecords.filter(hasIceCashRecord);
    const winkel = buildWinkelLine({
      dates,
      today,
      shop,
      dailyRecords: shopDailyRecords,
      cashRecords: winkelCashRecords,
      comments,
      warnings,
    });
    const ijs = buildIceLine({
      cashRecords: iceCashRecords,
      comments,
      warnings,
    });

    return {
      shop,
      winkel,
      ijs,
      comments,
      warnings,
    } satisfies ShopReport;
  });
}

function totalReportLine(label: ReportLine["label"], lines: ReportLine[]) {
  const sumNullable = (picker: (line: ReportLine) => number | null) => {
    const values = lines.map(picker).filter((value): value is number => value !== null);

    return values.length ? roundMoney(values.reduce((total, value) => total + value, 0)) : null;
  };

  return {
    label,
    daysWithData: lines.reduce((total, line) => total + line.daysWithData, 0),
    expectedDays: lines.reduce((total, line) => total + line.expectedDays, 0),
    checkedDays: lines.reduce((total, line) => total + line.checkedDays, 0),
    revenue: sumNullable((line) => line.revenue),
    deposited: sumNullable((line) => line.deposited),
    pinPaid: sumNullable((line) => line.pinPaid),
    giftCards: sumNullable((line) => line.giftCards),
    cashOut: sumNullable((line) => line.cashOut),
    cashDifference: sumNullable((line) => line.cashDifference),
    hasData: lines.some((line) => line.hasData),
  } satisfies ReportLine;
}

function csvValue(value: string | number | null | undefined) {
  const text = value === null || value === undefined ? "" : String(value);

  return `"${text.replace(/"/g, '""')}"`;
}

function lineCsvValue(value: number | null) {
  if (value === null) return "";

  return value.toFixed(2).replace(".", ",");
}

function buildCsv(month: string, reports: ShopReport[]) {
  const rows = [
    [
      "Maand",
      "Locatie",
      "Soort",
      "Dagen data",
      "Dagen verwacht",
      "Gecontroleerd",
      "Omzet",
      "Gestort",
      "Pin betaald",
      "Kadobonnen",
      "Kas-uit",
      "Kasverschil",
      "Status",
      "Opmerkingen",
      "Datachecks",
    ],
  ];

  reports.forEach((report) => {
    [report.winkel, report.ijs].forEach((line) => {
      rows.push([
        monthLabel(month),
        report.shop,
        line.label,
        String(line.daysWithData),
        String(line.expectedDays),
        String(line.checkedDays),
        lineCsvValue(line.revenue),
        lineCsvValue(line.deposited),
        lineCsvValue(line.pinPaid),
        lineCsvValue(line.giftCards),
        lineCsvValue(line.cashOut),
        lineCsvValue(line.cashDifference),
        reportLineStatus(line),
        report.comments.join(" | "),
        report.warnings.join(" | "),
      ]);
    });
  });

  return rows.map((row) => row.map(csvValue).join(";")).join("\n");
}

function downloadCsv(month: string, reports: ShopReport[]) {
  const csv = buildCsv(month, reports);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = `kasboek-${month}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function MetricCell({
  label,
  value,
  warn = false,
}: Readonly<{
  label: string;
  value: string;
  warn?: boolean;
}>) {
  return (
    <div className={`min-w-[7rem] px-2 py-2 ${warn ? "text-[#a15c10]" : ""}`}>
      <p className="text-[0.55rem] font-black uppercase tracking-normal text-[#8b8278]">
        {label}
      </p>
      <p className="mt-0.5 whitespace-nowrap text-sm font-black text-[#1a1815]">
        {value}
      </p>
    </div>
  );
}

function ReportLineRow({ line }: Readonly<{ line: ReportLine }>) {
  const hasOpenChecks = line.expectedDays > 0 && line.checkedDays < line.expectedDays;

  return (
    <tr className="border-t border-[#ece5dc] align-top">
      <th className="sticky left-0 bg-white px-2 py-2 text-left text-xs font-black text-[#1a1815]">
        {line.label}
      </th>
      <td className="px-2 py-2 text-xs font-bold text-[#6b645b]">
        {line.daysWithData}/{line.expectedDays || "-"}
      </td>
      <td className="px-2 py-2 text-xs font-bold text-[#6b645b]">
        {line.checkedDays}/{line.expectedDays || "-"}
      </td>
      <td className="px-2 py-2 text-right text-xs font-black">
        {formatMoney(line.revenue)}
      </td>
      <td className="px-2 py-2 text-right text-xs font-black">
        {formatMoney(line.deposited)}
      </td>
      <td className="px-2 py-2 text-right text-xs font-black">
        {formatMoney(line.pinPaid)}
      </td>
      <td className="px-2 py-2 text-right text-xs font-black">
        {formatMoney(line.giftCards)}
      </td>
      <td className="px-2 py-2 text-right text-xs font-black">
        {formatMoney(line.cashOut)}
      </td>
      <td
        className={`px-2 py-2 text-right text-xs font-black ${
          line.cashDifference && Math.abs(line.cashDifference) > 0.01
            ? "text-[#a15c10]"
            : ""
        }`}
      >
        {formatMoney(line.cashDifference)}
      </td>
      <td
        className={`px-2 py-2 text-xs font-black ${
          hasOpenChecks ? "text-[#a15c10]" : "text-[#1f4f35]"
        }`}
      >
        {reportLineStatus(line)}
      </td>
    </tr>
  );
}

function ReportTable({ report }: Readonly<{ report: ShopReport }>) {
  const detailCount = report.comments.length + report.warnings.length;

  return (
    <section className="rounded-lg border border-[#e7e0d8] bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#ece5dc] px-3 py-2">
        <div>
          <p className="text-[0.58rem] font-black uppercase tracking-normal text-[#8b8278]">
            Locatie
          </p>
          <h2 className="text-base font-black leading-tight text-[#1a1815]">
            {report.shop}
          </h2>
        </div>
        <span
          className={`rounded-full px-2 py-1 text-[0.62rem] font-black uppercase tracking-normal ${
            report.warnings.length
              ? "bg-[#fff8d8] text-[#8a5a10]"
              : "bg-[#edf7ec] text-[#1f4f35]"
          }`}
        >
          {report.warnings.length ? `${report.warnings.length} checks` : "compleet"}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[48rem] border-collapse text-left">
          <thead>
            <tr className="text-[0.55rem] font-black uppercase tracking-normal text-[#8b8278]">
              <th className="sticky left-0 bg-white px-2 py-2 text-left">Soort</th>
              <th className="px-2 py-2 text-left">Dagen</th>
              <th className="px-2 py-2 text-left">Controle</th>
              <th className="px-2 py-2 text-right">Omzet</th>
              <th className="px-2 py-2 text-right">Gestort</th>
              <th className="px-2 py-2 text-right">Pin</th>
              <th className="px-2 py-2 text-right">Kadobonnen</th>
              <th className="px-2 py-2 text-right">Kas-uit</th>
              <th className="px-2 py-2 text-right">Kasverschil</th>
              <th className="px-2 py-2 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            <ReportLineRow line={report.winkel} />
            <ReportLineRow line={report.ijs} />
          </tbody>
        </table>
      </div>

      {detailCount > 0 && (
        <details className="border-t border-[#ece5dc] bg-[#fbfaf8] px-3 py-2">
          <summary className="cursor-pointer text-xs font-black text-[#1a1815]">
            Kasverschillen en datachecks ({detailCount})
          </summary>
          <div className="mt-2 grid gap-2 md:grid-cols-2">
            {report.comments.length > 0 && (
              <div>
                <p className="text-[0.56rem] font-black uppercase tracking-normal text-[#8b8278]">
                  Herleiding
                </p>
                <ul className="mt-1 space-y-1 text-xs font-bold leading-snug text-[#4a433b]">
                  {report.comments.map((comment) => (
                    <li key={comment}>{comment}</li>
                  ))}
                </ul>
              </div>
            )}
            {report.warnings.length > 0 && (
              <div>
                <p className="text-[0.56rem] font-black uppercase tracking-normal text-[#8b8278]">
                  Datachecks
                </p>
                <ul className="mt-1 space-y-1 text-xs font-bold leading-snug text-[#8a5a10]">
                  {report.warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </details>
      )}
    </section>
  );
}

export default function KasboekMaandrapportClient() {
  const [month, setMonth] = useState(localMonthKey());
  const [selectedShop, setSelectedShop] = useState<RevenueShop>(revenueShops[0]);
  const [records, setRecords] = useState<RevenueRecord[]>([]);
  const [dailyRecords, setDailyRecords] = useState<RevenueDayRecord[]>([]);
  const [cashRecords, setCashRecords] = useState<RevenueCashRecord[]>([]);
  const [cashDeposits, setCashDeposits] = useState<RevenueCashDeposit[]>([]);
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
          throw new Error(data?.storage?.message || "Omzetdata ophalen is mislukt.");
        }
        if (ignoreResult) return;

        const nextDailyRecords = Array.isArray(data.dailyRecords)
          ? data.dailyRecords
          : [];
        const nextCashRecords = Array.isArray(data.cashRecords)
          ? data.cashRecords
          : [];
        const nextCashDeposits = Array.isArray(data.cashDeposits)
          ? data.cashDeposits
          : [];
        const latestDate =
          [...nextDailyRecords, ...nextCashRecords]
            .map((record) => record.date)
            .sort()
            .at(-1) || localIsoDate();

        setRecords(Array.isArray(data.records) ? data.records : []);
        setDailyRecords(nextDailyRecords);
        setCashRecords(nextCashRecords);
        setCashDeposits(nextCashDeposits);
        setStorage(data.storage);
        setMonth(latestDate.slice(0, 7));
        setState("ready");
      } catch (error) {
        if (!ignoreResult) {
          setStatus(
            error instanceof Error
              ? error.message
              : "Omzetdata ophalen is mislukt."
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

  const reports = useMemo(
    () => buildShopReports({ month, dailyRecords, cashRecords }),
    [cashRecords, dailyRecords, month]
  );
  const totalWinkel = useMemo(
    () => totalReportLine("Winkel", reports.map((report) => report.winkel)),
    [reports]
  );
  const totalIjs = useMemo(
    () => totalReportLine("IJs", reports.map((report) => report.ijs)),
    [reports]
  );
  const selectedReport =
    reports.find((report) => report.shop === selectedShop) || reports[0];
  const monthCashTotals = useMemo(
    () => buildMonthCashTotals(cashRecords, month),
    [cashRecords, month]
  );
  const monthCashDeposits = useMemo(
    () =>
      cashDeposits.filter((deposit) => cashDepositTouchesMonth(deposit, month)),
    [cashDeposits, month]
  );
  const monthDepositTotal = useMemo(
    () => sumMoney(monthCashDeposits, (deposit) => deposit.amount),
    [monthCashDeposits]
  );
  const isMonthCashbookBooked =
    monthCashDeposits.length > 0 &&
    monthCashDeposits.every((deposit) => deposit.cashbookBookedAt);
  const warningCount = reports.reduce(
    (total, report) => total + report.warnings.length,
    0
  );

  async function markCashbookBooked() {
    if (isMonthCashbookBooked) {
      setStatus("Dit kasboek is al geboekt.");
      return;
    }
    if (!monthCashDeposits.length) {
      setStatus("Er zijn nog geen weekstortingen voor deze maand gevonden.");
      return;
    }

    const confirmed = window.confirm(
      [
        `Wil je het kasboek van ${monthLabel(month)} als geboekt markeren?`,
        "",
        "Let op: hierna is dit kasboek gesloten.",
      ].join("\n")
    );
    if (!confirmed) return;

    const now = new Date().toISOString();
    const nextCashDeposits = cashDeposits.map((deposit) => {
      if (!cashDepositTouchesMonth(deposit, month)) return deposit;

      return {
        ...deposit,
        cashbookBookedAt: deposit.cashbookBookedAt || now,
        cashbookBookedBy: deposit.cashbookBookedBy || "Strik app",
        updatedAt: now,
      };
    });

    setState("saving");
    setStatus("Kasboek boeken...");

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
          cashDeposits: nextCashDeposits,
        }),
      });
      const data = (await response.json().catch(() => null)) as
        | RevenueResponse
        | { message?: string }
        | null;

      if (!response.ok || !data || !("records" in data)) {
        throw new Error(
          (data && "message" in data && data.message) ||
            "Kasboek boeken is mislukt."
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
        Array.isArray(data.cashDeposits) ? data.cashDeposits : nextCashDeposits
      );
      setStorage(data.storage);
      setStatus("Kasboek geboekt.");
      setState("ready");
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Kasboek boeken is mislukt."
      );
      setState("ready");
    }
  }

  return (
    <div className="space-y-3">
      <section className="rounded-lg border border-[#e7e0d8] bg-white/95 p-3 shadow-sm print:hidden">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[0.6rem] font-black uppercase tracking-normal text-[#8b8278]">
              Maandrapport
            </p>
            <h2 className="text-xl font-black leading-tight text-[#1a1815]">
              {monthLabel(month)}
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="text-xs font-black uppercase tracking-normal text-[#8b8278]">
              Maand
              <input
                type="month"
                value={month}
                onChange={(event) => setMonth(event.target.value || localMonthKey())}
                className="ml-2 rounded-md border border-[#d8d0c7] bg-white px-2 py-1.5 text-sm font-black text-[#1a1815]"
              />
            </label>
            <button
              type="button"
              onClick={() => void markCashbookBooked()}
              disabled={state !== "ready" || isMonthCashbookBooked}
              className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 text-xs font-black uppercase tracking-normal disabled:opacity-60 ${
                isMonthCashbookBooked
                  ? "border-[#cbdcc5] bg-[#edf7ec] text-[#1f4f35]"
                  : "border-[#1a1815] bg-[#1a1815] text-white"
              }`}
              title={
                isMonthCashbookBooked
                  ? "Kasboek is geboekt"
                  : "Kasboek boeken en sluiten"
              }
            >
              <CashbookIcon />
              {isMonthCashbookBooked ? "Kas geboekt" : "Kas boeken"}
            </button>
            <button
              type="button"
              onClick={() => downloadCsv(month, reports)}
              disabled={state !== "ready"}
              className="rounded-md border border-[#24543a] bg-[#24543a] px-3 py-2 text-xs font-black uppercase tracking-normal text-white disabled:opacity-50"
            >
              CSV
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              disabled={state !== "ready"}
              className="rounded-md border border-[#d8d0c7] bg-white px-3 py-2 text-xs font-black uppercase tracking-normal text-[#1a1815] disabled:opacity-50"
            >
              Print
            </button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-md bg-[#f8f6f3] p-2">
          <label className="text-xs font-black uppercase tracking-normal text-[#8b8278]">
            Locatie
            <select
              value={selectedShop}
              onChange={(event) =>
                setSelectedShop(event.target.value as RevenueShop)
              }
              className="ml-2 min-w-[12rem] rounded-md border border-[#d8d0c7] bg-white px-2 py-1.5 text-sm font-black normal-case text-[#1a1815]"
            >
              {revenueShops.map((shop) => (
                <option key={shop} value={shop}>
                  {shop}
                </option>
              ))}
            </select>
          </label>
          <span className="text-xs font-bold text-[#6b645b]">
            {isMonthCashbookBooked
              ? "Deze maand is geboekt en gesloten."
              : "Boek pas wanneer alle weekstortingen kloppen."}
          </span>
        </div>

        {storage?.status === "seed" && (
          <p className="mt-2 rounded-md border border-[#f3d4a4] bg-[#fef9f3] px-2 py-1.5 text-xs font-bold text-[#7a5417]">
            {storage.message} Het rapport gebruikt dan mogelijk alleen seeddata.
          </p>
        )}
        {status && (
          <p className="mt-2 rounded-md bg-[#f8f6f3] px-2 py-1.5 text-xs font-bold text-[#6b645b]">
            {status}
          </p>
        )}
      </section>

      <section className="rounded-lg border border-[#e7e0d8] bg-white/95 p-2 shadow-sm">
        <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
          <MetricCell label="Omzet winkel" value={formatMoney(totalWinkel.revenue)} />
          <MetricCell
            label="Contant winkel"
            value={formatMoney(monthCashTotals.cashRevenue)}
          />
          <MetricCell label="Pin winkel" value={formatMoney(totalWinkel.pinPaid)} />
          <MetricCell
            label="Kadobonnen"
            value={formatMoney(monthCashTotals.receipts)}
          />
          <MetricCell
            label="Weekstortingen"
            value={formatMoney(monthDepositTotal)}
          />
          <MetricCell
            label="Open checks"
            value={String(warningCount)}
            warn={warningCount > 0}
          />
          <MetricCell
            label="Contant ijs"
            value={formatMoney(monthCashTotals.iceCashRevenue)}
          />
          <MetricCell
            label="Gestort winkel"
            value={formatMoney(totalWinkel.deposited)}
          />
          <MetricCell label="Gestort ijs" value={formatMoney(totalIjs.deposited)} />
          <MetricCell label="Kas-uit" value={formatMoney(monthCashTotals.cashOut)} />
          <MetricCell
            label="Kasverschil"
            value={formatMoney(monthCashTotals.cashDifference)}
            warn={Boolean(
              monthCashTotals.cashDifference &&
                Math.abs(monthCashTotals.cashDifference) > 0.01
            )}
          />
        </div>
      </section>

      {state === "loading" ? (
        <section className="rounded-lg border border-[#e7e0d8] bg-white p-4 text-sm font-bold text-[#6b645b]">
          Maandrapport laden...
        </section>
      ) : (
        <div className="grid gap-3 print:block print:space-y-3">
          {selectedReport && <ReportTable report={selectedReport} />}
        </div>
      )}
    </div>
  );
}

function CashbookIcon() {
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
        strokeLinejoin="round"
        strokeWidth="2"
      />
      <path
        d="M7 10h10M7 14h5M15.5 13.5l1.5 1.5 3-3"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}
