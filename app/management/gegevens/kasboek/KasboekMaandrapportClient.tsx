"use client";

import { useEffect, useMemo, useState } from "react";
import {
  revenueIcePaymentBreakdown,
  revenueShops,
  type RevenueCashDeposit,
  type RevenueCashRecord,
  type RevenueData,
  type RevenueDayRecord,
  type RevenueRecord,
  type RevenueShop,
} from "@/app/management/revenueData";
import type { LeatGiftcardControlResponse } from "@/app/management/leatGiftcardTypes";

type LoadState = "loading" | "ready" | "saving" | "error";
type CashbookKind = "patisserie" | "ice";

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
  estimatedDepositDays: number;
  revenue: number | null;
  cashPaid: number | null;
  expectedDeposit: number | null;
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
  winkelComments: string[];
  winkelWarnings: string[];
  iceComments: string[];
  iceWarnings: string[];
};

type GiftcardDayComparison = {
  date: string;
  cashItRedeemed: number;
  leatRedeemed: number;
  difference: number;
  leatIssued: number;
  redemptionCount: number;
  issueCount: number;
};

type GiftcardDayAllocation = {
  date: string;
  cashPatisserie: number;
  cashIce: number;
  leatPatisserie: number;
  leatIce: number;
  issuedPatisserie: number;
  issuedIce: number;
  redemptionCountPatisserie: number;
  redemptionCountIce: number;
  issueCountPatisserie: number;
  issueCountIce: number;
};

const GIFTCARD_MONTH_TOLERANCE = 1;

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

  if (record.cashRevenue !== undefined) {
    return Math.max(
      0,
      roundMoney(record.cashRevenue - cashOutAmount(record))
    );
  }

  if (record.startCash !== undefined) {
    return Math.max(
      0,
      roundMoney((record.countedCash || 0) - record.startCash)
    );
  }

  return record.countedCash ?? 0;
}

function safeCheckedCash(record: RevenueCashRecord | undefined) {
  if (!record) return 0;

  return record.safeCash ?? safeExpectedCash(record);
}

function safeDifference(record: RevenueCashRecord | undefined) {
  if (!record) return 0;

  return roundMoney(safeCheckedCash(record) - safeExpectedCash(record));
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

function cashPaidAmount(record: RevenueCashRecord) {
  return (
    record.cashRevenue ??
    roundMoney(safeExpectedCash(record) + cashOutAmount(record))
  );
}

function receiptAmount(record: RevenueCashRecord) {
  return record.receipts ?? 0;
}

function iceExpectedCash(record: RevenueCashRecord | undefined) {
  if (!record) return 0;

  return record.iceExpectedCash ?? record.iceCash ?? record.iceCashRevenue ?? 0;
}

function iceCashPaidAmount(record: RevenueCashRecord) {
  return revenueIcePaymentBreakdown(record).cash;
}

function iceGiftcardAmount(record: RevenueCashRecord) {
  return revenueIcePaymentBreakdown(record).giftCards;
}

function icePinPaidAmount(record: RevenueCashRecord) {
  return revenueIcePaymentBreakdown(record).pin;
}

function iceTotalRevenueAmount(record: RevenueCashRecord) {
  return revenueIcePaymentBreakdown(record).total;
}

function iceCheckedCash(record: RevenueCashRecord | undefined) {
  if (!record) return 0;

  return record.iceSafeCash ?? iceExpectedCash(record);
}

function iceProvisionalDeposit(record: RevenueCashRecord) {
  return Math.max(
    0,
    roundMoney(iceCashPaidAmount(record) - (record.iceCashOut || 0))
  );
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

function hasRevenueDayReport(record: RevenueDayRecord) {
  return Boolean(
    record.shopClosed || record.amount > 0 || String(record.note || "").trim()
  );
}

function cashDepositBelongsToMonth(
  deposit: RevenueCashDeposit,
  monthKey: string
) {
  const bookingDate =
    deposit.dateTo ||
    deposit.patisserieReportedAt?.slice(0, 10) ||
    deposit.iceReportedAt?.slice(0, 10) ||
    deposit.depositedAt?.slice(0, 10) ||
    deposit.iceDepositedAt?.slice(0, 10) ||
    deposit.dateFrom ||
    "";

  return bookingDate.startsWith(monthKey);
}

function isCashbookDepositBooked(
  deposit: RevenueCashDeposit,
  kind: CashbookKind
) {
  if (deposit.cashbookBookedAt) return true;

  return kind === "ice"
    ? Boolean(deposit.iceCashbookBookedAt)
    : Boolean(deposit.patisserieCashbookBookedAt);
}

function cashDepositHasKind(
  deposit: RevenueCashDeposit,
  kind: CashbookKind
) {
  if (kind === "patisserie") {
    return Boolean(
      deposit.amount ||
        deposit.depositedAt ||
        deposit.patisserieClosedAt ||
        deposit.patisserieReportedAt ||
        deposit.patisserieCashbookBookedAt ||
        deposit.cashbookBookedAt
    );
  }

  return Boolean(
    deposit.iceDepositAmount !== undefined ||
      deposit.iceDepositedAt ||
      deposit.iceDepositClosedAt ||
      deposit.iceReportedAt ||
      deposit.iceCashbookBookedAt ||
      deposit.cashbookBookedAt
  );
}

function buildMonthCashTotals(cashRecords: RevenueCashRecord[], month: string) {
  const monthRecords = cashRecords.filter((record) => record.date.startsWith(month));
  const patisserieRecords = monthRecords.filter(hasPatisserieCashRecord);
  const iceRecords = monthRecords.filter(hasIceCashRecord);
  const checkedPatisserieRecords = patisserieRecords.filter(
    (record) => record.checkedAt
  );
  const checkedIceRecords = iceRecords.filter((record) => record.iceCheckedAt);
  const patisserieReceipts = sumMoney(patisserieRecords, receiptAmount);
  const iceReceipts = sumMoney(
    iceRecords,
    (record) => revenueIcePaymentBreakdown(record).giftCards
  );
  const patisserieCashOut = sumMoney(patisserieRecords, cashOutAmount);
  const iceCashOut = sumMoney(iceRecords, (record) => record.iceCashOut);
  const patisserieCashDifference = sumMoney(
    checkedPatisserieRecords,
    safeDifference
  );
  const iceCashRevenue = sumMoney(iceRecords, iceCashPaidAmount);
  const iceDeposited = sumMoney(iceRecords, (record) =>
    record.iceCheckedAt ? iceCheckedCash(record) : iceProvisionalDeposit(record)
  );
  const iceCashDifference = roundMoney(
    iceDeposited + iceCashOut - iceCashRevenue
  );

  return {
    cashRevenue: sumMoney(
      patisserieRecords,
      cashPaidAmount
    ),
    iceCashRevenue,
    icePinRevenue: sumMoney(iceRecords, icePinPaidAmount),
    iceTotalRevenue: sumMoney(iceRecords, iceTotalRevenueAmount),
    checkedPatisserieCash: sumMoney(checkedPatisserieRecords, safeCheckedCash),
    checkedIceCash: sumMoney(checkedIceRecords, iceCheckedCash),
    patisserieReceipts,
    iceReceipts,
    receipts: roundMoney(patisserieReceipts + iceReceipts),
    patisserieCashOut,
    iceCashOut,
    cashOut: roundMoney(patisserieCashOut + iceCashOut),
    patisserieCashDifference,
    iceCashDifference,
    cashDifference: roundMoney(
      patisserieCashDifference + iceCashDifference
    ),
  };
}

function cashItGiftcardAmount(
  record: RevenueCashRecord,
  kind: CashbookKind
) {
  if (kind === "ice") {
    return 0;
  }

  return hasPatisserieCashRecord(record)
    ? roundMoney(record.receipts || 0)
    : 0;
}

function buildGiftcardDayComparisons(input: {
  month: string;
  shop: RevenueShop;
  kind: CashbookKind;
  cashRecords: RevenueCashRecord[];
  control: LeatGiftcardControlResponse | null;
}) {
  const rows = new Map<string, GiftcardDayAllocation>();

  const rowFor = (date: string) =>
    rows.get(date) || {
      date,
      cashPatisserie: 0,
      cashIce: 0,
      leatPatisserie: 0,
      leatIce: 0,
      issuedPatisserie: 0,
      issuedIce: 0,
      redemptionCountPatisserie: 0,
      redemptionCountIce: 0,
      issueCountPatisserie: 0,
      issueCountIce: 0,
    };

  input.cashRecords
    .filter(
      (record) =>
        record.shop === input.shop && record.date.startsWith(input.month)
    )
    .forEach((record) => {
      const existing = rowFor(record.date);
      existing.cashPatisserie = roundMoney(
        existing.cashPatisserie + cashItGiftcardAmount(record, "patisserie")
      );
      existing.cashIce = roundMoney(
        existing.cashIce + cashItGiftcardAmount(record, "ice")
      );
      rows.set(record.date, existing);
    });

  if (input.control?.available) {
    input.control.daily
      .filter((total) => total.shop === input.shop)
      .forEach((total) => {
        const existing = rowFor(total.date);
        const isIceProfile = total.channel === "ijs";
        if (isIceProfile) {
          existing.leatIce = roundMoney(existing.leatIce + total.redeemed);
          existing.issuedIce = roundMoney(existing.issuedIce + total.issued);
          existing.redemptionCountIce += total.redemptionCount;
          existing.issueCountIce += total.issueCount;
        } else {
          existing.leatPatisserie = roundMoney(
            existing.leatPatisserie + total.redeemed
          );
          existing.issuedPatisserie = roundMoney(
            existing.issuedPatisserie + total.issued
          );
          existing.redemptionCountPatisserie += total.redemptionCount;
          existing.issueCountPatisserie += total.issueCount;
        }
        rows.set(total.date, existing);
      });
  }

  return [...rows.values()]
    .map((row): GiftcardDayComparison => {
      const cashItRedeemed =
        input.kind === "ice" ? row.cashIce : row.cashPatisserie;
      const otherCash =
        input.kind === "ice" ? row.cashPatisserie : row.cashIce;
      const cashTotal = roundMoney(cashItRedeemed + otherCash);
      const leatTotal = roundMoney(row.leatPatisserie + row.leatIce);
      const profileRedeemed =
        input.kind === "ice" ? row.leatIce : row.leatPatisserie;
      const profileRedemptionCount =
        input.kind === "ice"
          ? row.redemptionCountIce
          : row.redemptionCountPatisserie;
      const totalRedemptionCount =
        row.redemptionCountPatisserie + row.redemptionCountIce;
      const hasCashAllocation = cashTotal > 0;
      const leatRedeemed = hasCashAllocation
        ? roundMoney(leatTotal * (cashItRedeemed / cashTotal))
        : profileRedeemed;
      const redemptionCount = hasCashAllocation
        ? cashItRedeemed > 0
          ? totalRedemptionCount
          : 0
        : profileRedemptionCount;
      const leatIssued =
        input.kind === "ice" ? row.issuedIce : row.issuedPatisserie;
      const issueCount =
        input.kind === "ice" ? row.issueCountIce : row.issueCountPatisserie;

      return {
        date: row.date,
        cashItRedeemed,
        leatRedeemed,
        difference: roundMoney(cashItRedeemed - leatRedeemed),
        leatIssued,
        redemptionCount,
        issueCount,
      };
    })
    .filter(
      (row) =>
        row.cashItRedeemed !== 0 ||
        row.leatRedeemed !== 0 ||
        row.leatIssued !== 0
    )
    .sort((first, second) => first.date.localeCompare(second.date));
}

function giftcardComparisonTotals(rows: GiftcardDayComparison[]) {
  return {
    cashItRedeemed: sumMoney(rows, (row) => row.cashItRedeemed),
    leatRedeemed: sumMoney(rows, (row) => row.leatRedeemed),
    difference: sumMoney(rows, (row) => row.difference),
    leatIssued: sumMoney(rows, (row) => row.leatIssued),
    redemptionCount: rows.reduce(
      (total, row) => total + row.redemptionCount,
      0
    ),
    issueCount: rows.reduce((total, row) => total + row.issueCount, 0),
  };
}

function reportLineStatus(line: ReportLine) {
  if (!line.expectedDays && !line.hasData) return "Geen data";
  if (line.estimatedDepositDays > 0) {
    return `Voorlopig · ${line.estimatedDepositDays}× schatting`;
  }
  if (line.expectedDays && line.checkedDays < line.expectedDays) {
    return `Voorlopig · ${line.checkedDays}/${line.expectedDays}`;
  }

  return "Definitief";
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
    (date) =>
      !dailyByDate.get(date)?.shopClosed &&
      dailyByDate.has(date) &&
      hasPatisserieCashRecord(cashByDate.get(date))
  );
  const closedDates = expectedDates.filter(
    (date) => dailyByDate.get(date)?.shopClosed
  );

  expectedDates.forEach((date) => {
    const dailyRecord = dailyByDate.get(date);
    const cashRecord = cashByDate.get(date);

    if (!dailyRecord) {
      input.warnings.push(`${dayLabel(date)}: omzet niet ingeladen.`);
    }
    if (dailyRecord?.shopClosed) {
      input.comments.push(`${dayLabel(date)}: winkel gesloten.`);
      return;
    }
    if (!hasPatisserieCashRecord(cashRecord)) {
      input.warnings.push(`${dayLabel(date)}: geldtelling niet ingeladen.`);
      return;
    }
    if (!cashRecord.checkedAt) {
      input.comments.push(
        `${dayLabel(date)}: geldtelling nog niet afgevinkt; verwacht bankbedrag ${formatMoney(safeExpectedCash(cashRecord))} gebruikt.`
      );
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
        `${dayLabel(date)}: verschil in dagafsluiting ${formatMoney(cashRecord.difference)}.`
      );
    }
    if (cashRecord.checkedAt && Math.abs(safeDifference(cashRecord)) > 0.01) {
      input.comments.push(
        `${dayLabel(date)}: kasverschil ${formatMoney(safeDifference(cashRecord))}.`
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
        cashPaidAmount(cashRecord) -
        receiptAmount(cashRecord);

      if (calculated < -0.01) {
        input.warnings.push(
          `${dayLabel(date)}: pin kan niet netjes worden berekend uit omzet minus contant en bonnen.`
        );
      }

      return total + Math.max(0, calculated);
    }, 0)
  );

  const reportCashRecords = input.cashRecords.filter(
    (record) =>
      expectedDates.includes(record.date) &&
      !dailyByDate.get(record.date)?.shopClosed
  );
  const checkedRecords = reportCashRecords.filter(
    (record) => hasPatisserieCashRecord(record) && record.checkedAt
  );
  const estimatedRecords = reportCashRecords.filter(
    (record) => hasPatisserieCashRecord(record) && !record.checkedAt
  );

  return {
    label: "Winkel",
    daysWithData: input.dailyRecords.length,
    expectedDays: expectedDates.length,
    checkedDays: checkedRecords.length + closedDates.length,
    estimatedDepositDays: estimatedRecords.length,
    revenue: sumMoney(input.dailyRecords, (record) => record.amount),
    cashPaid: sumMoney(input.cashRecords, cashPaidAmount),
    expectedDeposit: sumMoney(reportCashRecords, safeExpectedCash),
    deposited: sumMoney(reportCashRecords, (record) =>
      record.checkedAt ? safeCheckedCash(record) : safeExpectedCash(record)
    ),
    pinPaid,
    giftCards: sumMoney(input.cashRecords, receiptAmount),
    cashOut: sumMoney(input.cashRecords, cashOutAmount),
    cashDifference: sumMoney(checkedRecords, safeDifference),
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
      input.comments.push(
        `${dayLabel(record.date)}: ijstelling nog niet afgevinkt; aangeslagen kasomzet ${formatMoney(iceProvisionalDeposit(record))} voorlopig als storting gebruikt.`
      );
    }
    if (
      record.icePinRevenue === undefined &&
      record.iceTotalRevenue === undefined
    ) {
      input.warnings.push(
        `${dayLabel(record.date)}: ijs pin/overig en totale omzet ontbreken.`
      );
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
        `${dayLabel(record.date)}: telverschil in het Cash-it-dagrapport ${formatMoney(record.iceDifference)}.`
      );
    }
    if (record.iceCheckedAt) {
      const bookedDifference = roundMoney(
        iceCheckedCash(record) +
          (record.iceCashOut || 0) -
          iceCashPaidAmount(record)
      );
      if (Math.abs(bookedDifference) <= 0.01) return;

      input.comments.push(
        `${dayLabel(record.date)}: gestort minus aangeslagen kasomzet ${formatMoney(bookedDifference)}.`
      );
    }
  });

  const checkedRecords = input.cashRecords.filter((record) => record.iceCheckedAt);
  const estimatedRecords = input.cashRecords.filter(
    (record) => !record.iceCheckedAt
  );
  const cashPaid = sumMoney(input.cashRecords, iceCashPaidAmount);
  const cashOut = sumMoney(input.cashRecords, (record) => record.iceCashOut);
  const deposited = sumMoney(input.cashRecords, (record) =>
    record.iceCheckedAt ? iceCheckedCash(record) : iceProvisionalDeposit(record)
  );

  return {
    label: "IJs",
    daysWithData: input.cashRecords.length,
    expectedDays: input.cashRecords.length,
    checkedDays: checkedRecords.length,
    estimatedDepositDays: estimatedRecords.length,
    revenue: sumMoney(input.cashRecords, iceTotalRevenueAmount),
    cashPaid,
    expectedDeposit: null,
    deposited,
    pinPaid: sumMoney(input.cashRecords, icePinPaidAmount),
    giftCards: sumMoney(input.cashRecords, iceGiftcardAmount),
    cashOut,
    cashDifference: roundMoney(deposited + cashOut - cashPaid),
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
    const winkelComments: string[] = [];
    const winkelWarnings: string[] = [];
    const iceComments: string[] = [];
    const iceWarnings: string[] = [];
    const shopDailyRecords = input.dailyRecords.filter(
      (record) =>
        record.shop === shop &&
        record.date.startsWith(input.month) &&
        hasRevenueDayReport(record)
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
      comments: winkelComments,
      warnings: winkelWarnings,
    });
    const ijs = buildIceLine({
      cashRecords: iceCashRecords,
      comments: iceComments,
      warnings: iceWarnings,
    });

    return {
      shop,
      winkel,
      ijs,
      winkelComments,
      winkelWarnings,
      iceComments,
      iceWarnings,
    } satisfies ShopReport;
  });
}

function reportLineForKind(report: ShopReport, kind: CashbookKind) {
  return kind === "ice" ? report.ijs : report.winkel;
}

function reportCommentsForKind(report: ShopReport, kind: CashbookKind) {
  return kind === "ice" ? report.iceComments : report.winkelComments;
}

function reportWarningsForKind(report: ShopReport, kind: CashbookKind) {
  return kind === "ice" ? report.iceWarnings : report.winkelWarnings;
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
    estimatedDepositDays: lines.reduce(
      (total, line) => total + line.estimatedDepositDays,
      0
    ),
    revenue: sumNullable((line) => line.revenue),
    cashPaid: sumNullable((line) => line.cashPaid),
    expectedDeposit: sumNullable((line) => line.expectedDeposit),
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

function buildCsv(
  kind: CashbookKind,
  month: string,
  reports: ShopReport[],
  cashRecords: RevenueCashRecord[],
  giftcardControl: LeatGiftcardControlResponse | null
) {
  const compareWithLeat = kind === "patisserie" && giftcardControl?.available;
  const rows = [
    [
      "Maand",
      "Kasboek",
      "Locatie",
      "Dagen data",
      "Dagen verwacht",
      "Gecontroleerd",
      "Omzet",
      kind === "ice" ? "Kasomzet" : "Contant betaald",
      "Pin en overig elektronisch",
      "Kadobonnen Cash-it",
      "Leat ingewisseld",
      "Kadobonverschil",
      "Leat uitgegeven",
      "Kas-uit",
      ...(kind === "ice"
        ? [
            "Daadwerkelijk gestort (of voorlopig bij open telling)",
            "Kasverschil (gestort + kas-uit - kasomzet)",
          ]
        : [
            "Verwacht naar bank",
            "Boekingsbedrag naar bank (geteld of verwacht)",
            "Kasverschil telling",
          ]),
      "Status",
      "Opmerkingen",
      "Datachecks",
    ],
  ];

  reports.forEach((report) => {
    const giftcardTotals = giftcardComparisonTotals(
      buildGiftcardDayComparisons({
        month,
        shop: report.shop,
        kind,
        cashRecords,
        control: giftcardControl,
      })
    );

    const line = reportLineForKind(report, kind);
    rows.push([
      monthLabel(month),
      kind === "ice" ? "IJs" : "Patisserie",
      report.shop,
      String(line.daysWithData),
      String(line.expectedDays),
      String(line.checkedDays),
      lineCsvValue(line.revenue),
      lineCsvValue(line.cashPaid),
      lineCsvValue(line.pinPaid),
      lineCsvValue(line.giftCards),
      compareWithLeat
        ? lineCsvValue(giftcardTotals.leatRedeemed)
        : "",
      compareWithLeat
        ? lineCsvValue(giftcardTotals.difference)
        : "",
      compareWithLeat
        ? lineCsvValue(giftcardTotals.leatIssued)
        : "",
      lineCsvValue(line.cashOut),
      ...(kind === "ice"
        ? [
            lineCsvValue(line.deposited),
            lineCsvValue(line.cashDifference),
          ]
        : [
            lineCsvValue(line.expectedDeposit),
            lineCsvValue(line.deposited),
            lineCsvValue(line.cashDifference),
          ]),
      reportLineStatus(line),
      reportCommentsForKind(report, kind).join(" | "),
      reportWarningsForKind(report, kind).join(" | "),
    ]);
  });

  return rows.map((row) => row.map(csvValue).join(";")).join("\n");
}

function downloadCsv(
  kind: CashbookKind,
  month: string,
  reports: ShopReport[],
  cashRecords: RevenueCashRecord[],
  giftcardControl: LeatGiftcardControlResponse | null
) {
  const csv = buildCsv(kind, month, reports, cashRecords, giftcardControl);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = `kasboek-${kind === "ice" ? "ijs" : "patisserie"}-${month}.csv`;
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

function ReportLineRow({
  line,
  kind,
}: Readonly<{ line: ReportLine; kind: CashbookKind }>) {
  const hasOpenChecks = line.expectedDays > 0 && line.checkedDays < line.expectedDays;

  return (
    <tr className="border-t border-[#ece5dc] align-top">
      <th className="sticky left-0 bg-white px-2 py-2 text-left text-xs font-black text-[#1a1815]">
        {kind === "ice" ? "IJs" : "Patisserie"}
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
        {formatMoney(line.cashPaid)}
      </td>
      <td className="px-2 py-2 text-right text-xs font-black">
        {formatMoney(line.pinPaid)}
      </td>
      <td className="px-2 py-2 text-right text-xs font-black">
        {kind === "ice" ? "n.v.t." : formatMoney(line.giftCards)}
      </td>
      <td className="px-2 py-2 text-right text-xs font-black">
        {formatMoney(line.cashOut)}
      </td>
      {kind === "patisserie" && (
        <td className="px-2 py-2 text-right text-xs font-black">
          {formatMoney(line.expectedDeposit)}
        </td>
      )}
      <td className="px-2 py-2 text-right text-xs font-black">
        {formatMoney(line.deposited)}
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

function ReportTable({
  report,
  kind,
}: Readonly<{ report: ShopReport; kind: CashbookKind }>) {
  const line = reportLineForKind(report, kind);
  const comments = reportCommentsForKind(report, kind);
  const warnings = reportWarningsForKind(report, kind);
  const detailCount = comments.length + warnings.length;

  return (
    <section className="rounded-lg border border-[#e7e0d8] bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#ece5dc] px-3 py-2">
        <div>
          <p className="text-[0.58rem] font-black uppercase tracking-normal text-[#8b8278]">
            {kind === "ice" ? "IJskasboek" : "Patisseriekasboek"}
          </p>
          <h2 className="text-base font-black leading-tight text-[#1a1815]">
            {report.shop}
          </h2>
        </div>
        <span
          className={`rounded-full px-2 py-1 text-[0.62rem] font-black uppercase tracking-normal ${
            warnings.length
              ? "bg-[#fff8d8] text-[#8a5a10]"
              : "bg-[#edf7ec] text-[#1f4f35]"
          }`}
        >
          {warnings.length ? `${warnings.length} checks` : "compleet"}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[62rem] border-collapse text-left">
          <thead>
            <tr className="text-[0.55rem] font-black uppercase tracking-normal text-[#8b8278]">
              <th className="sticky left-0 bg-white px-2 py-2 text-left">Soort</th>
              <th className="px-2 py-2 text-left">Dagen</th>
              <th className="px-2 py-2 text-left">Controle</th>
              <th className="px-2 py-2 text-right">Omzet</th>
              <th className="px-2 py-2 text-right">{kind === "ice" ? "Kasomzet" : "Contant"}</th>
              <th className="px-2 py-2 text-right">Pin/overig</th>
              <th className="px-2 py-2 text-right">Kadobonnen</th>
              <th className="px-2 py-2 text-right">Kas-uit</th>
              {kind === "patisserie" && (
                <th className="px-2 py-2 text-right">Verwacht bank</th>
              )}
              <th className="px-2 py-2 text-right">
                {kind === "ice" ? "Gestort bank" : "Boekingsbedrag"}
              </th>
              <th className="px-2 py-2 text-right">
                {kind === "ice" ? "Kasverschil" : "Verschil"}
              </th>
              <th className="px-2 py-2 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            <ReportLineRow line={line} kind={kind} />
          </tbody>
        </table>
      </div>

      {detailCount > 0 && (
        <details className="border-t border-[#ece5dc] bg-[#fbfaf8] px-3 py-2">
          <summary className="cursor-pointer text-xs font-black text-[#1a1815]">
            Kasverschillen en datachecks ({detailCount})
          </summary>
          <div className="mt-2 grid gap-2 md:grid-cols-2">
            {comments.length > 0 && (
              <div>
                <p className="text-[0.56rem] font-black uppercase tracking-normal text-[#8b8278]">
                  Herleiding
                </p>
                <ul className="mt-1 space-y-1 text-xs font-bold leading-snug text-[#4a433b]">
                  {comments.map((comment) => (
                    <li key={comment}>{comment}</li>
                  ))}
                </ul>
              </div>
            )}
            {warnings.length > 0 && (
              <div>
                <p className="text-[0.56rem] font-black uppercase tracking-normal text-[#8b8278]">
                  Datachecks
                </p>
                <ul className="mt-1 space-y-1 text-xs font-bold leading-snug text-[#8a5a10]">
                  {warnings.map((warning) => (
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

function MonthShopOverview({
  reports,
  kind,
  month,
  selectedShop,
}: Readonly<{
  reports: ShopReport[];
  kind: CashbookKind;
  month: string;
  selectedShop: RevenueShop;
}>) {
  const total = totalReportLine(
    kind === "ice" ? "IJs" : "Winkel",
    reports.map((report) => reportLineForKind(report, kind))
  );

  return (
    <section className="cashbook-print-report rounded-lg border border-[#e7e0d8] bg-white/95 shadow-sm print:border-0 print:shadow-none">
      <div className="flex flex-wrap items-end justify-between gap-2 border-b border-[#ece5dc] px-3 py-1.5">
        <div>
          <p className="text-[0.52rem] font-black uppercase tracking-normal text-[#8b8278]">
            {kind === "ice" ? "IJskasboek" : "Patisseriekasboek"}
          </p>
          <h2 className="text-sm font-black leading-tight text-[#1a1815]">
            Maandcijfers in één overzicht
          </h2>
        </div>
        <p className="text-xs font-black capitalize text-[#4b433c]">
          {monthLabel(month)}
        </p>
        <p className="w-full text-[0.62rem] font-bold leading-tight text-[#8b8278] print:hidden">
          {kind === "ice"
            ? "Alleen ijsdagrapporten, ijsstortingen en ijsverschillen staan in dit kasboek."
            : "Omzet komt uit Cash-it. Pin/overig is omzet min contant en kadobonnen; ijs staat volledig apart."}
        </p>
      </div>
      <div className="overflow-x-auto">
        <table
          className="w-full min-w-[68rem] border-collapse text-left print:min-w-0"
        >
          <thead>
            <tr className="text-[0.55rem] font-black uppercase tracking-normal text-[#8b8278]">
              <th className="px-3 py-1.5">Locatie</th>
              <th className="px-2 py-1.5 text-right">Omzet</th>
              <th className="px-2 py-1.5 text-right">
                {kind === "ice" ? "Kasomzet" : "Contant"}
              </th>
              <th className="px-2 py-1.5 text-right">Pin/overig</th>
              <th className="px-2 py-1.5 text-right">Kadobonnen</th>
              <th className="px-2 py-1.5 text-right">Kas-uit</th>
              {kind === "patisserie" && (
                <th className="px-2 py-1.5 text-right">Verwacht bank</th>
              )}
              <th className="px-2 py-1.5 text-right">
                {kind === "ice" ? "Gestort bank" : "Boekingsbedrag"}
              </th>
              <th className="px-2 py-1.5 text-right">
                {kind === "ice" ? "Kasverschil" : "Verschil"}
              </th>
              <th className="px-3 py-1.5">Status</th>
            </tr>
          </thead>
          <tbody>
            {reports.map((report) => {
              const line = reportLineForKind(report, kind);
              const warnings = reportWarningsForKind(report, kind);
              const isFinal =
                reportLineStatus(line) === "Definitief" &&
                warnings.length === 0;
              const status = isFinal
                ? "Definitief"
                : warnings.length > 0
                  ? `Voorlopig · ${warnings.length} checks`
                  : reportLineStatus(line);

              return (
                <tr
                  key={report.shop}
                  className={`border-t border-[#ece5dc] text-xs font-bold ${
                    report.shop === selectedShop ? "bg-[#fff3a8]" : ""
                  }`}
                >
                  <th className="px-3 py-1.5 text-left font-black text-[#1a1815]">
                    <span className="inline-flex items-center gap-1.5">
                      {report.shop}
                      {report.shop === selectedShop && (
                        <span className="rounded-full bg-[#fed500] px-1.5 py-0.5 text-[0.5rem] font-black uppercase text-[#332c25] print:hidden">
                          geselecteerd
                        </span>
                      )}
                    </span>
                  </th>
                  <td className="px-2 py-1.5 text-right font-black">
                    {formatMoney(line.revenue)}
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    {formatMoney(line.cashPaid)}
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    {formatMoney(line.pinPaid)}
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    {kind === "ice" ? "n.v.t." : formatMoney(line.giftCards)}
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    {formatMoney(line.cashOut)}
                  </td>
                  {kind === "patisserie" && (
                    <td className="px-2 py-1.5 text-right">
                      {formatMoney(line.expectedDeposit)}
                    </td>
                  )}
                  <td className="px-2 py-1.5 text-right">
                    {formatMoney(line.deposited)}
                  </td>
                  <td
                    className={`px-2 py-1.5 text-right ${
                      line.cashDifference &&
                      Math.abs(line.cashDifference) > 0.01
                        ? "text-[#a15c10]"
                        : ""
                    }`}
                  >
                    {formatMoney(line.cashDifference)}
                  </td>
                  <td
                    className={`px-3 py-1.5 font-black ${
                      isFinal ? "text-[#1f4f35]" : "text-[#a15c10]"
                    }`}
                  >
                    {status}
                  </td>
                </tr>
              );
            })}
            <tr className="border-t-2 border-[#d9d0c6] bg-[#f8f6f3] text-xs font-black text-[#1a1815]">
              <th className="px-3 py-1.5 text-left">Totaal</th>
              <td className="px-2 py-1.5 text-right">
                {formatMoney(total.revenue)}
              </td>
              <td className="px-2 py-1.5 text-right">
                {formatMoney(total.cashPaid)}
              </td>
              <td className="px-2 py-1.5 text-right">
                {formatMoney(total.pinPaid)}
              </td>
              <td className="px-2 py-1.5 text-right">
                {kind === "ice" ? "n.v.t." : formatMoney(total.giftCards)}
              </td>
              <td className="px-2 py-1.5 text-right">
                {formatMoney(total.cashOut)}
              </td>
              {kind === "patisserie" && (
                <td className="px-2 py-1.5 text-right">
                  {formatMoney(total.expectedDeposit)}
                </td>
              )}
              <td className="px-2 py-1.5 text-right">
                {formatMoney(total.deposited)}
              </td>
              <td className="px-2 py-1.5 text-right">
                {formatMoney(total.cashDifference)}
              </td>
              <td className="px-3 py-1.5">
                {reports.some((report) => reportWarningsForKind(report, kind).length > 0)
                  ? "Voorlopig"
                  : reportLineStatus(total)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}

function GiftcardControlPanel({
  month,
  selectedShop,
  kind,
  cashRecords,
  control,
  loading,
}: Readonly<{
  month: string;
  selectedShop: RevenueShop;
  kind: CashbookKind;
  cashRecords: RevenueCashRecord[];
  control: LeatGiftcardControlResponse | null;
  loading: boolean;
}>) {
  const rows = buildGiftcardDayComparisons({
    month,
    shop: selectedShop,
    kind,
    cashRecords,
    control,
  });
  const totals = giftcardComparisonTotals(rows);
  const monthTotals = giftcardComparisonTotals(
    revenueShops.flatMap((shop) =>
      buildGiftcardDayComparisons({
        month,
        shop,
        kind,
        cashRecords,
        control,
      })
    )
  );
  const mismatchCount = rows.filter(
    (row) => Math.abs(row.difference) > 0.01
  ).length;
  const ready = Boolean(control?.available && !loading);

  if (kind === "ice") {
    return (
      <section className="rounded-lg border border-[#dce6d8] bg-white/95 px-3 py-3 shadow-sm">
        <p className="text-[0.58rem] font-black uppercase tracking-normal text-[#71806c]">
          IJsbonnen
        </p>
        <div className="mt-1 flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-sm font-bold text-[#4a433b]">
            Bij de ijsbalies worden geen cadeaubonnen aangenomen. Bedragen die
            door de PDF-uitlezing als bon werden gezien, tellen daarom niet mee
            in het ijskasboek.
          </p>
          <strong className="text-base text-[#1a1815]">n.v.t.</strong>
        </div>
      </section>
    );
  }

  const monthMatches =
    Math.abs(monthTotals.difference) <= GIFTCARD_MONTH_TOLERANCE;

  return (
    <section className="rounded-lg border border-[#dce6d8] bg-white/95 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#e7eee4] px-3 py-2">
        <div>
          <p className="text-[0.58rem] font-black uppercase tracking-normal text-[#71806c]">
            Automatische cadeauboncontrole
          </p>
          <h2 className="text-base font-black text-[#1a1815]">
            Cash-it ↔ Leat · {selectedShop} Patisserie
          </h2>
          <p className="mt-0.5 text-[0.68rem] font-bold text-[#7c746b]">
            Cash-it registreert wat aan de kassa is afgerekend; Leat bevestigt wat werkelijk is ingewisseld.
          </p>
        </div>
        <span
          className={`rounded-full px-2 py-1 text-[0.62rem] font-black uppercase tracking-normal ${
            loading
              ? "bg-[#f4f1ed] text-[#70685f]"
              : ready && monthMatches
                ? "bg-[#edf7ec] text-[#1f4f35]"
                : "bg-[#fff4cf] text-[#8a5a10]"
          }`}
        >
          {loading
            ? "Leat laden"
            : !control?.available
              ? "Niet gecontroleerd"
              : monthMatches
                ? mismatchCount > 0
                  ? `Maand klopt · ${mismatchCount} dagverschil${mismatchCount === 1 ? "" : "len"}`
                  : "Klopt"
                : mismatchCount > 0
                  ? `${mismatchCount} verschil${mismatchCount === 1 ? "" : "len"}`
                : "Klopt"}
        </span>
      </div>

      {ready && monthMatches && mismatchCount > 0 && (
        <p className="m-3 rounded-md border border-[#cfe1ca] bg-[#f2f8f0] px-2 py-1.5 text-xs font-bold text-[#315f39]">
          Het totale maandverschil is {formatMoney(monthTotals.difference)} en
          valt binnen de afrondtolerantie van{" "}
          {formatMoney(GIFTCARD_MONTH_TOLERANCE)}. De dag- en
          locatieverschillen blijven hieronder zichtbaar, maar blokkeren de
          maandboeking niet.
        </p>
      )}

      <div className="grid gap-px bg-[#e7eee4] sm:grid-cols-4">
        {[
          ["Cash-it ingewisseld", formatMoney(totals.cashItRedeemed)],
          ["Leat ingewisseld", ready ? formatMoney(totals.leatRedeemed) : "-"],
          ["Verschil", ready ? formatMoney(totals.difference) : "-"],
          ["Leat uitgegeven", ready ? formatMoney(totals.leatIssued) : "-"],
        ].map(([label, value], index) => (
          <div key={label} className="bg-[#f8fbf7] px-3 py-2">
            <p className="text-[0.55rem] font-black uppercase tracking-normal text-[#71806c]">
              {label}
            </p>
            <p
              className={`mt-0.5 text-sm font-black ${
                index === 2 && ready && Math.abs(totals.difference) > 0.01
                  ? "text-[#a15c10]"
                  : "text-[#1a1815]"
              }`}
            >
              {value}
            </p>
          </div>
        ))}
      </div>

      {!loading && control?.warning && (
        <p className="m-3 rounded-md border border-[#f3d4a4] bg-[#fef9f3] px-2 py-1.5 text-xs font-bold text-[#7a5417]">
          {control.warning}
        </p>
      )}

      {!loading &&
        kind === "patisserie" &&
        control?.available &&
        control.unmappedShops.length > 0 && (
        <div className="m-3 rounded-md border border-[#f3d4a4] bg-[#fef9f3] px-2 py-1.5 text-xs font-bold text-[#7a5417]">
          Nog niet gekoppeld aan dit maandrapport:{" "}
          {control.unmappedShops
            .map(
              (shop) =>
                `${shop.name} (${formatMoney(shop.redeemed)} ingewisseld, ${formatMoney(shop.issued)} uitgegeven)`
            )
            .join(" · ")}
        </div>
      )}

      {ready && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[48rem] border-collapse text-left">
            <thead>
              <tr className="text-[0.55rem] font-black uppercase tracking-normal text-[#71806c]">
                <th className="px-3 py-2">Datum</th>
                <th className="px-2 py-2 text-right">Cash-it</th>
                <th className="px-2 py-2 text-right">Leat ingewisseld</th>
                <th className="px-2 py-2 text-right">Verschil</th>
                <th className="px-2 py-2 text-right">Leat uitgegeven</th>
                <th className="px-2 py-2 text-right">Transacties</th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr className="border-t border-[#e7eee4]">
                  <td colSpan={7} className="px-3 py-3 text-xs font-bold text-[#7c746b]">
                    In deze maand zijn voor {selectedShop} geen cadeaubonnen gebruikt of uitgegeven.
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const matches = Math.abs(row.difference) <= 0.01;

                  return (
                    <tr key={row.date} className="border-t border-[#e7eee4] text-xs font-bold">
                      <th className="px-3 py-2 text-left font-black text-[#1a1815]">
                        {dayLabel(row.date)}
                      </th>
                      <td className="px-2 py-2 text-right">{formatMoney(row.cashItRedeemed)}</td>
                      <td className="px-2 py-2 text-right">{formatMoney(row.leatRedeemed)}</td>
                      <td className={`px-2 py-2 text-right font-black ${matches ? "text-[#1f4f35]" : "text-[#a15c10]"}`}>
                        {formatMoney(row.difference)}
                      </td>
                      <td className="px-2 py-2 text-right">{formatMoney(row.leatIssued)}</td>
                      <td className="px-2 py-2 text-right text-[#6b645b]">
                        {row.redemptionCount} in · {row.issueCount} uit
                      </td>
                      <td className={`px-3 py-2 font-black ${matches ? "text-[#1f4f35]" : "text-[#a15c10]"}`}>
                        {matches ? "Klopt" : "Controleren"}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {control?.syncedAt && (
        <p className="border-t border-[#e7eee4] px-3 py-2 text-[0.62rem] font-bold text-[#8b8278]">
          Leat live gecontroleerd op {new Date(control.syncedAt).toLocaleString("nl-NL")} · bij een gedeeld Leat-verkooppunt wordt ingewisseld per dag verdeeld volgens de aparte Cash-it-regels voor patisserie en ijs · positieve transacties staan apart en wijzigen de omzet niet.
        </p>
      )}
    </section>
  );
}

export default function KasboekMaandrapportClient() {
  const [month, setMonth] = useState(localMonthKey());
  const [cashbookKind, setCashbookKind] =
    useState<CashbookKind>("patisserie");
  const [selectedShop, setSelectedShop] = useState<RevenueShop>(revenueShops[0]);
  const [records, setRecords] = useState<RevenueRecord[]>([]);
  const [dailyRecords, setDailyRecords] = useState<RevenueDayRecord[]>([]);
  const [cashRecords, setCashRecords] = useState<RevenueCashRecord[]>([]);
  const [cashDeposits, setCashDeposits] = useState<RevenueCashDeposit[]>([]);
  const [state, setState] = useState<LoadState>("loading");
  const [status, setStatus] = useState("");
  const [storage, setStorage] = useState<RevenueResponse["storage"]>();
  const [giftcardControl, setGiftcardControl] =
    useState<LeatGiftcardControlResponse | null>(null);
  const [giftcardLoading, setGiftcardLoading] = useState(true);

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

  useEffect(() => {
    const controller = new AbortController();

    async function loadGiftcardControl() {
      setGiftcardLoading(true);

      try {
        const response = await fetch(
          `/api/management-revenue/giftcard-control?month=${encodeURIComponent(month)}`,
          {
            cache: "no-store",
            signal: controller.signal,
          }
        );
        const data = (await response.json().catch(() => null)) as
          | LeatGiftcardControlResponse
          | { message?: string }
          | null;

        if (!response.ok || !data || !("available" in data)) {
          throw new Error(
            (data && "message" in data && data.message) ||
              "Leat-controle ophalen is mislukt."
          );
        }

        setGiftcardControl(data);
      } catch (error) {
        if (controller.signal.aborted) return;
        setGiftcardControl({
          available: false,
          month,
          transactionCount: 0,
          daily: [],
          unmappedShops: [],
          warning:
            error instanceof Error
              ? error.message
              : "Leat-controle ophalen is mislukt.",
        });
      } finally {
        if (!controller.signal.aborted) setGiftcardLoading(false);
      }
    }

    void loadGiftcardControl();

    return () => controller.abort();
  }, [month]);

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
  const estimatedDepositDays =
    cashbookKind === "ice"
      ? totalIjs.estimatedDepositDays
      : totalWinkel.estimatedDepositDays;
  const selectedReport =
    reports.find((report) => report.shop === selectedShop) || reports[0];
  const monthCashTotals = useMemo(
    () => buildMonthCashTotals(cashRecords, month),
    [cashRecords, month]
  );
  const monthCashDeposits = useMemo(
    () =>
      cashDeposits.filter((deposit) => cashDepositBelongsToMonth(deposit, month)),
    [cashDeposits, month]
  );
  const activeMonthCashDeposits = useMemo(
    () =>
      monthCashDeposits.filter((deposit) =>
        cashDepositHasKind(deposit, cashbookKind)
      ),
    [cashbookKind, monthCashDeposits]
  );
  const monthDepositTotal = useMemo(
    () =>
      sumMoney(activeMonthCashDeposits, (deposit) =>
        cashbookKind === "ice"
          ? deposit.iceDepositedAt
            ? deposit.iceDepositAmount ?? 0
            : 0
          : deposit.depositedAt
            ? deposit.actualAmount ?? deposit.amount
            : 0
      ),
    [activeMonthCashDeposits, cashbookKind]
  );
  const isMonthCashbookBooked =
    activeMonthCashDeposits.length > 0 &&
    activeMonthCashDeposits.every((deposit) =>
      isCashbookDepositBooked(deposit, cashbookKind)
    );
  const revenueWarningCount = reports.reduce(
    (total, report) =>
      total + reportWarningsForKind(report, cashbookKind).length,
    0
  );
  const allGiftcardRows = useMemo(
    () =>
      revenueShops.flatMap((shop) =>
        buildGiftcardDayComparisons({
          month,
          shop,
          kind: cashbookKind,
          cashRecords,
          control: giftcardControl,
        })
      ),
    [cashRecords, cashbookKind, giftcardControl, month]
  );
  const allGiftcardTotals = useMemo(
    () => giftcardComparisonTotals(allGiftcardRows),
    [allGiftcardRows]
  );
  const giftcardMonthMismatch =
    Math.abs(allGiftcardTotals.difference) > GIFTCARD_MONTH_TOLERANCE;
  const giftcardControlCount =
    cashbookKind === "ice"
      ? 0
      : giftcardLoading
        ? 1
        : giftcardControl?.available
          ? (giftcardMonthMismatch ? 1 : 0) +
            (giftcardControl.unmappedShops.length > 0 ? 1 : 0)
          : 1;
  const warningCount = revenueWarningCount + giftcardControlCount;

  async function markCashbookBooked() {
    if (isMonthCashbookBooked) {
      setStatus("Dit kasboek is al geboekt.");
      return;
    }
    if (!activeMonthCashDeposits.length) {
      setStatus(
        `Er zijn nog geen ${cashbookKind === "ice" ? "ijs" : "patisserie"}weekstortingen voor deze maand gevonden.`
      );
      return;
    }
    if (warningCount > 0) {
      setStatus(
        `Deze maand is nog niet definitief: los eerst ${warningCount} open controle${warningCount === 1 ? "" : "s"} op.`
      );
      return;
    }

    const confirmed = window.confirm(
      [
        `Heb je het ${cashbookKind === "ice" ? "ijskasboek" : "patisseriekasboek"} van ${monthLabel(month)} in Exact geboekt?`,
        estimatedDepositDays > 0
          ? cashbookKind === "ice"
            ? `Voor ${estimatedDepositDays} nog niet getelde dag${estimatedDepositDays === 1 ? "" : "en"} gebruikt dit rapport de aangeslagen kasomzet voorlopig als storting.`
            : `Voor ${estimatedDepositDays} nog niet getelde dag${estimatedDepositDays === 1 ? "" : "en"} gebruikt dit rapport het verwachte bankbedrag.`
          : "",
        "",
        "Na bevestigen wordt deze maand in de Strik app gesloten.",
      ].filter(Boolean).join("\n")
    );
    if (!confirmed) return;

    const now = new Date().toISOString();
    const nextCashDeposits = cashDeposits.map((deposit) => {
      if (
        !cashDepositBelongsToMonth(deposit, month) ||
        !cashDepositHasKind(deposit, cashbookKind)
      ) {
        return deposit;
      }

      return cashbookKind === "ice"
        ? {
            ...deposit,
            iceCashbookBookedAt: deposit.iceCashbookBookedAt || now,
            iceCashbookBookedBy:
              deposit.iceCashbookBookedBy || "Strik app",
            updatedAt: now,
          }
        : {
            ...deposit,
            patisserieCashbookBookedAt:
              deposit.patisserieCashbookBookedAt || now,
            patisserieCashbookBookedBy:
              deposit.patisserieCashbookBookedBy || "Strik app",
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
      setStatus(
        `${cashbookKind === "ice" ? "IJskasboek" : "Patisseriekasboek"} geboekt.`
      );
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
              {cashbookKind === "ice" ? "IJskasboek" : "Patisseriekasboek"}
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
                  ? `${cashbookKind === "ice" ? "IJskasboek" : "Patisseriekasboek"} is in Exact geboekt`
                  : warningCount > 0
                    ? `Nog ${warningCount} open controles vóór boeken in Exact`
                    : "Na boeken in Exact deze maand sluiten"
              }
            >
              <CashbookIcon />
              {isMonthCashbookBooked ? "Geboekt in Exact" : "Markeer geboekt"}
            </button>
            <button
              type="button"
              onClick={() =>
                downloadCsv(
                  cashbookKind,
                  month,
                  reports,
                  cashRecords,
                  giftcardControl
                )
              }
              disabled={state !== "ready"}
              className="rounded-md border border-[#24543a] bg-[#24543a] px-3 py-2 text-xs font-black uppercase tracking-normal text-white disabled:opacity-50"
            >
              Boekings-CSV
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              disabled={state !== "ready"}
              className="rounded-md border border-[#d8d0c7] bg-white px-3 py-2 text-xs font-black uppercase tracking-normal text-[#1a1815] disabled:opacity-50"
            >
              Print maand {monthLabel(month).replace(/\s+\d{4}$/, "")}
            </button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-md bg-[#f8f6f3] p-2">
          <div className="inline-flex rounded-md border border-[#cbd8c7] bg-white p-0.5">
            {(["patisserie", "ice"] as const).map((kind) => (
              <button
                key={kind}
                type="button"
                onClick={() => {
                  setCashbookKind(kind);
                  setStatus("");
                }}
                className={`rounded px-3 py-1.5 text-xs font-black transition ${
                  cashbookKind === kind
                    ? "bg-[#24543a] text-white"
                    : "text-[#5f574f] hover:bg-[#edf4ea]"
                }`}
              >
                {kind === "ice" ? "IJs" : "Patisserie"}
              </button>
            ))}
          </div>
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
              ? `Het ${cashbookKind === "ice" ? "ijskasboek" : "patisseriekasboek"} is geboekt en gesloten.`
              : `Boek alleen het ${cashbookKind === "ice" ? "ijskasboek" : "patisseriekasboek"} wanneer de bijbehorende stortingen kloppen.`}
          </span>
        </div>

        {storage?.status === "seed" && (
          <p className="mt-2 rounded-md border border-[#f3d4a4] bg-[#fef9f3] px-2 py-1.5 text-xs font-bold text-[#7a5417]">
            {storage.message} Het rapport gebruikt dan mogelijk alleen seeddata.
          </p>
        )}
        {estimatedDepositDays > 0 && (
          <p className="mt-2 rounded-md border border-[#ead59d] bg-[#fff8d8] px-2 py-1.5 text-xs font-bold text-[#7a5417]">
            Voor {estimatedDepositDays} nog niet getelde dag
            {estimatedDepositDays === 1 ? "" : "en"} gebruikt de storting
            voorlopig de aangeslagen kasomzet. Reeds getelde en gecorrigeerde
            stortingen blijven leidend.
          </p>
        )}
        {status && (
          <p className="mt-2 rounded-md bg-[#f8f6f3] px-2 py-1.5 text-xs font-bold text-[#6b645b]">
            {status}
          </p>
        )}
      </section>

      {state !== "loading" && (
        <MonthShopOverview
          reports={reports}
          kind={cashbookKind}
          month={month}
          selectedShop={selectedShop}
        />
      )}

      <section className="rounded-lg border border-[#e7e0d8] bg-white/95 p-2 shadow-sm print:hidden">
        <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
          <MetricCell
            label={cashbookKind === "ice" ? "Omzet ijs" : "Omzet patisserie"}
            value={formatMoney(
              cashbookKind === "ice"
                ? monthCashTotals.iceTotalRevenue
                : totalWinkel.revenue
            )}
          />
          <MetricCell
            label={cashbookKind === "ice" ? "Kasomzet ijs" : "Contant patisserie"}
            value={formatMoney(
              cashbookKind === "ice"
                ? monthCashTotals.iceCashRevenue
                : monthCashTotals.cashRevenue
            )}
          />
          <MetricCell
            label={cashbookKind === "ice" ? "Pin/overig ijs" : "Pin/overig patisserie"}
            value={formatMoney(
              cashbookKind === "ice"
                ? monthCashTotals.icePinRevenue
                : totalWinkel.pinPaid
            )}
          />
          <MetricCell
            label={`Bonnen Cash-it ${cashbookKind === "ice" ? "ijs" : "patisserie"}`}
            value={
              cashbookKind === "ice"
                ? "n.v.t."
                : formatMoney(monthCashTotals.patisserieReceipts)
            }
          />
          <MetricCell
            label="Bonnen Leat"
            value={
              cashbookKind === "ice"
                ? "n.v.t."
                : giftcardControl?.available
                ? formatMoney(allGiftcardTotals.leatRedeemed)
                : "-"
            }
          />
          <MetricCell
            label="Bonverschil"
            value={
              cashbookKind === "ice"
                ? "n.v.t."
                : giftcardControl?.available
                ? formatMoney(allGiftcardTotals.difference)
                : "-"
            }
            warn={
              cashbookKind === "patisserie" &&
              (!giftcardControl?.available || giftcardMonthMismatch)
            }
          />
          <MetricCell
            label="Bonnen uitgegeven"
            value={
              cashbookKind === "ice"
                ? "n.v.t."
                : giftcardControl?.available
                ? formatMoney(allGiftcardTotals.leatIssued)
                : "-"
            }
          />
          <MetricCell
            label={`Weekstortingen ${cashbookKind === "ice" ? "ijs" : "patisserie"}`}
            value={formatMoney(monthDepositTotal)}
          />
          <MetricCell
            label="Open checks"
            value={String(warningCount)}
            warn={warningCount > 0}
          />
          <MetricCell
            label={
              cashbookKind === "ice"
                ? "Gestort/boekingsbedrag ijs"
                : "Boekingsbedrag patisserie"
            }
            value={formatMoney(
              cashbookKind === "ice"
                ? totalIjs.deposited
                : totalWinkel.deposited
            )}
            warn={estimatedDepositDays > 0}
          />
          <MetricCell
            label={`Kas-uit ${cashbookKind === "ice" ? "ijs" : "patisserie"}`}
            value={formatMoney(
              cashbookKind === "ice"
                ? monthCashTotals.iceCashOut
                : monthCashTotals.patisserieCashOut
            )}
          />
          <MetricCell
            label={
              cashbookKind === "ice"
                ? "Kasverschil omzet/storting"
                : "Kasverschil telling"
            }
            value={formatMoney(
              cashbookKind === "ice"
                ? totalIjs.cashDifference
                : monthCashTotals.patisserieCashDifference
            )}
            warn={Boolean(
              cashbookKind === "ice"
                ? totalIjs.cashDifference &&
                    Math.abs(totalIjs.cashDifference) > 0.01
                : monthCashTotals.patisserieCashDifference &&
                    Math.abs(monthCashTotals.patisserieCashDifference) > 0.01
            )}
          />
        </div>
      </section>

      {state === "loading" ? (
        <section className="rounded-lg border border-[#e7e0d8] bg-white p-4 text-sm font-bold text-[#6b645b] print:hidden">
          Maandrapport laden...
        </section>
      ) : (
        <div className="grid gap-3 print:hidden">
          <GiftcardControlPanel
            month={month}
            selectedShop={selectedShop}
            kind={cashbookKind}
            cashRecords={cashRecords}
            control={giftcardControl}
            loading={giftcardLoading}
          />
          {selectedReport && (
            <ReportTable report={selectedReport} kind={cashbookKind} />
          )}
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
