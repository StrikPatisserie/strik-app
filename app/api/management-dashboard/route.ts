import { NextResponse } from "next/server";
import {
  getTamigoStatusCode,
  getWeekLaborCostScheduleForIsoWeek,
  type LaborCostSchedule,
} from "../../tamigoApi";
import {
  findRevenueDayRecord,
  findRevenueRecord,
  revenueShops,
  type RevenueDayRecord,
  type RevenueRecord,
  type RevenueShop,
} from "../../management/revenueData";
import { getMergedRevenueData } from "../../management/revenueServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Status = "green" | "orange" | "red" | "missing";
type Period = "day" | "week" | "month";
type PeriodWeek = { year: number; week: number };
type PeriodDateRange = { start: string; end: string };

function getIsoWeekYear(date: Date) {
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNumber = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - dayNumber);

  return target.getUTCFullYear();
}

function getIsoWeek(date: Date) {
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNumber = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - dayNumber);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));

  return Math.ceil(((target.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

function getIsoParts(date: Date): PeriodWeek {
  return {
    year: getIsoWeekYear(date),
    week: getIsoWeek(date),
  };
}

function formatIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function parseIsoDate(value: string | null, fallback: string) {
  const text = value || fallback;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return fallback;

  const [year, month, day] = text.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return fallback;
  }

  return text;
}

function addDaysToIsoDate(value: string, days: number) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);

  return formatIsoDate(date);
}

function addYearsToIsoDate(value: string, years: number) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year + years, month - 1, day));

  if (date.getUTCMonth() !== month - 1) {
    return formatIsoDate(new Date(Date.UTC(year + years, month, 0)));
  }

  return formatIsoDate(date);
}

function getIsoPartsForDate(value: string): PeriodWeek {
  const [year, month, day] = value.split("-").map(Number);

  return getIsoParts(new Date(Date.UTC(year, month - 1, day)));
}

function getWeeksInIsoYear(year: number) {
  return getIsoWeek(new Date(Date.UTC(year, 11, 28)));
}

function getIsoWeekStartDate(year: number, week: number) {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7;
  jan4.setUTCDate(jan4.getUTCDate() - jan4Day + 1 + (week - 1) * 7);

  return jan4;
}

function getPeriodDateRange(
  year: number,
  week: number,
  period: Period,
  date = ""
): PeriodDateRange {
  if (period === "day" && date) {
    return { start: date, end: date };
  }

  const weekStart = getIsoWeekStartDate(year, week);
  if (period === "week") {
    const weekEnd = new Date(weekStart);
    weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);

    return {
      start: formatIsoDate(weekStart),
      end: formatIsoDate(weekEnd),
    };
  }

  const monthStart = new Date(
    Date.UTC(weekStart.getUTCFullYear(), weekStart.getUTCMonth(), 1)
  );
  const monthEnd = new Date(
    Date.UTC(weekStart.getUTCFullYear(), weekStart.getUTCMonth() + 1, 0)
  );

  return {
    start: formatIsoDate(monthStart),
    end: formatIsoDate(monthEnd),
  };
}

function comparableDatesForRange(
  sourceRange: PeriodDateRange,
  sourceDates: string[],
  targetRange: PeriodDateRange
) {
  const sourceStart = new Date(`${sourceRange.start}T00:00:00.000Z`);
  const targetStart = new Date(`${targetRange.start}T00:00:00.000Z`);

  return new Set(
    sourceDates.flatMap((sourceDate) => {
      const date = new Date(`${sourceDate}T00:00:00.000Z`);
      const dayOffset = Math.round(
        (date.getTime() - sourceStart.getTime()) / 86400000
      );
      const targetDate = new Date(targetStart);
      targetDate.setUTCDate(targetDate.getUTCDate() + dayOffset);
      const targetDateKey = formatIsoDate(targetDate);

      return targetDateKey <= targetRange.end ? [targetDateKey] : [];
    })
  );
}

function getPreviousWeek(year: number, week: number) {
  if (week > 1) {
    return { year, week: week - 1 };
  }

  const previousYear = year - 1;
  return { year: previousYear, week: getWeeksInIsoYear(previousYear) };
}

function getShiftedMonthWeek(year: number, week: number, monthOffset: number) {
  const weekStart = getIsoWeekStartDate(year, week);
  const anchor = new Date(
    Date.UTC(
      weekStart.getUTCFullYear(),
      weekStart.getUTCMonth() + monthOffset,
      15
    )
  );

  return getIsoParts(anchor);
}

function getShiftedYearWeek(year: number, week: number, yearOffset: number) {
  const weekStart = getIsoWeekStartDate(year, week);
  const anchor = new Date(
    Date.UTC(
      weekStart.getUTCFullYear() + yearOffset,
      weekStart.getUTCMonth(),
      15
    )
  );

  return getIsoParts(anchor);
}

function numberParam(url: URL, key: string, fallback: number) {
  const rawValue = url.searchParams.get(key);
  if (!rawValue) return fallback;

  const value = Number(rawValue);

  return Number.isFinite(value) ? Math.trunc(value) : fallback;
}

function clampWeek(week: number) {
  return Math.max(1, Math.min(53, Math.trunc(week)));
}

function getPeriod(url: URL): Period {
  const period = url.searchParams.get("period");
  if (period === "day" || period === "month") return period;

  return "week";
}

function dedupeWeeks(weeks: PeriodWeek[]) {
  const seen = new Set<string>();

  return weeks.filter((week) => {
    const key = `${week.year}-${week.week}`;
    if (seen.has(key)) return false;

    seen.add(key);
    return true;
  });
}

function getPeriodWeeks(year: number, week: number, period: Period) {
  if (period === "day") return [{ year, week }];
  if (period === "week") return [{ year, week }];

  const selectedWeekStart = getIsoWeekStartDate(year, week);
  const monthYear = selectedWeekStart.getUTCFullYear();
  const month = selectedWeekStart.getUTCMonth();
  const monthStart = new Date(Date.UTC(monthYear, month, 1));
  const monthEnd = new Date(Date.UTC(monthYear, month + 1, 1));
  const firstDay = monthStart.getUTCDay() || 7;
  const cursor = new Date(monthStart);
  cursor.setUTCDate(cursor.getUTCDate() - firstDay + 1);

  const weeks: PeriodWeek[] = [];
  while (cursor < monthEnd) {
    weeks.push(getIsoParts(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 7);
  }

  return dedupeWeeks(weeks);
}

function getPeriodLabel(year: number, week: number, period: Period, date = "") {
  if (period === "day" && date) {
    return new Intl.DateTimeFormat("nl-NL", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(`${date}T00:00:00.000Z`));
  }

  if (period === "week") return `Week ${week} · ${year}`;

  const selectedWeekStart = getIsoWeekStartDate(year, week);
  const monthLabel = new Intl.DateTimeFormat("nl-NL", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(selectedWeekStart);

  return monthLabel;
}

function getCompareAnchor(year: number, week: number, period: Period) {
  return period === "month"
    ? getShiftedMonthWeek(year, week, -12)
    : { year: year - 1, week };
}

function percentDifference(current: number | null, compare: number | null) {
  if (current === null || compare === null || compare <= 0) return null;

  return Number((((current - compare) / compare) * 100).toFixed(1));
}

function getProductivityStatus(shop: RevenueShop, value: number | null): Status {
  if (value === null) return "missing";

  if (shop === "Ziekerstraat") {
    if (value >= 80) return "green";
    if (value >= 65) return "orange";
    return "red";
  }

  if (value >= 100) return "green";
  if (value >= 80) return "orange";
  return "red";
}

function getLaborCostStatus(shop: RevenueShop, value: number | null): Status {
  if (value === null) return "missing";

  if (shop === "Ziekerstraat") {
    if (value <= 0.22) return "green";
    if (value <= 0.26) return "orange";
    return "red";
  }

  if (value <= 0.18) return "green";
  if (value <= 0.21) return "orange";
  return "red";
}

function sumRevenue(
  records: RevenueRecord[],
  weeks: PeriodWeek[],
  shop: RevenueShop
) {
  let amount = 0;
  let foundCount = 0;
  let hasManual = false;
  let hasDaily = false;
  const notes: string[] = [];

  for (const periodWeek of weeks) {
    const record = findRevenueRecord(records, periodWeek.year, periodWeek.week, shop);
    if (!record) continue;

    amount += record.amount;
    foundCount += 1;
    if (record.source === "manual") hasManual = true;
    if (record.source === "dagafsluiting") hasDaily = true;
    if (record.note) notes.push(record.note);
  }

  return {
    amount: foundCount > 0 ? Number(amount.toFixed(2)) : null,
    missing: foundCount < weeks.length,
    note: [...new Set(notes)].join(" · "),
    source:
      foundCount === 0 ? null : hasManual ? "manual" : hasDaily ? "dagafsluiting" : "excel",
  };
}

function sumRevenueDay(
  records: RevenueDayRecord[] | undefined,
  date: string,
  shop: RevenueShop
) {
  const record = findRevenueDayRecord(records, date, shop);

  return {
    amount: record ? record.amount : null,
    missing: !record,
    note: record?.note || "",
    source: record ? record.source || "dagafsluiting" : null,
    dailyDates: record ? [date] : [],
    usesDaily: true,
  };
}

function isActualRevenueDayRecord(record: RevenueDayRecord) {
  return Boolean(
    record.amount > 0 || record.shopClosed || String(record.note || "").trim()
  );
}

function sumRevenueForRange(
  weeklyRecords: RevenueRecord[],
  dailyRecords: RevenueDayRecord[] | undefined,
  weeks: PeriodWeek[],
  range: PeriodDateRange,
  shop: RevenueShop,
  includedDates?: ReadonlySet<string>
) {
  const matchingDays = (dailyRecords || []).filter(
    (record) =>
      record.shop === shop &&
      record.date >= range.start &&
      record.date <= range.end &&
      (!includedDates || includedDates.has(record.date)) &&
      isActualRevenueDayRecord(record)
  );

  if (!matchingDays.length) {
    if (includedDates) {
      return {
        amount: null,
        missing: true,
        note: "Geen dagcijfers beschikbaar voor een zuivere vergelijking.",
        source: null,
        dailyDates: [] as string[],
        usesDaily: true,
      };
    }

    return {
      ...sumRevenue(weeklyRecords, weeks, shop),
      dailyDates: [] as string[],
      usesDaily: false,
    };
  }

  return {
    amount: Number(
      matchingDays
        .reduce((total, record) => total + record.amount, 0)
        .toFixed(2)
    ),
    missing: false,
    note: [
      ...new Set(
        matchingDays.map((record) => record.note).filter(Boolean)
      ),
    ].join(" · "),
    source: "dagafsluiting",
    dailyDates: matchingDays.map((record) => record.date),
    usesDaily: true,
  };
}

async function fetchLaborSchedules(weeks: PeriodWeek[]) {
  const results = await Promise.allSettled(
    weeks.map((week) =>
      getWeekLaborCostScheduleForIsoWeek(week.year, week.week)
    )
  );
  const schedules: LaborCostSchedule[] = [];
  const warnings: string[] = [];

  for (const result of results) {
    if (result.status === "fulfilled") {
      schedules.push(result.value);
      continue;
    }

    const status = getTamigoStatusCode(result.reason);
    warnings.push(
      status === 403
        ? "Tamigo gaf geen toegang tot rooster/loonkosten voor een periode."
        : "Tamigo uren en loonkosten konden voor een periode niet geladen worden."
    );
  }

  return {
    schedules,
    warning: [...new Set(warnings)].join(" "),
  };
}

function sumLaborForShop(
  schedules: LaborCostSchedule[],
  shop: RevenueShop,
  range?: PeriodDateRange,
  includedDates?: ReadonlySet<string>
) {
  return schedules.reduce(
    (totals, schedule) => {
      for (const day of schedule.days) {
        if (range && (day.date < range.start || day.date > range.end)) continue;
        if (includedDates && !includedDates.has(day.date)) continue;

        const dayShop = day.shops.find((item) => item.shop === shop);
        if (!dayShop) continue;

        totals.hours += dayShop.hours;
        totals.cost += dayShop.cost;
        totals.missingHours += dayShop.missingHours;
        totals.missingShifts += dayShop.missingShifts;
      }

      return totals;
    },
    { hours: 0, cost: 0, missingHours: 0, missingShifts: 0 }
  );
}

export async function GET(request: Request) {
  const now = new Date();
  const url = new URL(request.url);
  const period = getPeriod(url);
  const currentIsoDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Amsterdam",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const selectedDate = parseIsoDate(url.searchParams.get("date"), currentIsoDate);
  const selectedDateWeek = getIsoPartsForDate(selectedDate);
  const year =
    period === "day"
      ? selectedDateWeek.year
      : numberParam(url, "year", selectedDateWeek.year);
  const week =
    period === "day"
      ? selectedDateWeek.week
      : clampWeek(numberParam(url, "week", selectedDateWeek.week));
  const previousDay = addDaysToIsoDate(selectedDate, -1);
  const sameDayLastYear = addYearsToIsoDate(selectedDate, -1);
  const manualCompareDate = parseIsoDate(
    url.searchParams.get("compareDate"),
    sameDayLastYear
  );
  const previousPeriod =
    period === "day"
      ? getIsoPartsForDate(previousDay)
      : period === "month"
        ? getShiftedMonthWeek(year, week, -1)
        : getPreviousWeek(year, week);
  const samePeriodLastYear =
    period === "day" ? getIsoPartsForDate(sameDayLastYear) : getCompareAnchor(year, week, period);
  const compareYear = numberParam(url, "compareYear", samePeriodLastYear.year);
  const compareWeek = clampWeek(
    numberParam(url, "compareWeek", samePeriodLastYear.week)
  );
  const periodWeeks =
    period === "day" ? [selectedDateWeek] : getPeriodWeeks(year, week, period);
  const previousPeriodWeeks =
    period === "day"
      ? [getIsoPartsForDate(previousDay)]
      : getPeriodWeeks(previousPeriod.year, previousPeriod.week, period);
  const samePeriodLastYearWeeks =
    period === "day"
      ? [getIsoPartsForDate(sameDayLastYear)]
      : getPeriodWeeks(samePeriodLastYear.year, samePeriodLastYear.week, period);
  const manualPeriodWeeks =
    period === "day"
      ? [getIsoPartsForDate(manualCompareDate)]
      : getPeriodWeeks(compareYear, compareWeek, period);
  const periodRange = getPeriodDateRange(
    year,
    week,
    period,
    selectedDate
  );
  const previousPeriodRange = getPeriodDateRange(
    previousPeriod.year,
    previousPeriod.week,
    period,
    previousDay
  );
  const samePeriodLastYearRange = getPeriodDateRange(
    samePeriodLastYear.year,
    samePeriodLastYear.week,
    period,
    sameDayLastYear
  );
  const manualPeriodRange = getPeriodDateRange(
    compareYear,
    compareWeek,
    period,
    manualCompareDate
  );
  const [revenue, labor] = await Promise.all([
    getMergedRevenueData(),
    fetchLaborSchedules(periodWeeks),
  ]);

  const rows = revenueShops.map((shop) => {
    const currentRevenue =
      period === "day"
        ? sumRevenueDay(revenue.dailyRecords, selectedDate, shop)
        : sumRevenueForRange(
            revenue.records,
            revenue.dailyRecords,
            periodWeeks,
            periodRange,
            shop
          );
    const previousComparableDates =
      period !== "day" && currentRevenue.usesDaily
        ? comparableDatesForRange(
            periodRange,
            currentRevenue.dailyDates,
            previousPeriodRange
          )
        : undefined;
    const lastYearComparableDates =
      period !== "day" && currentRevenue.usesDaily
        ? comparableDatesForRange(
            periodRange,
            currentRevenue.dailyDates,
            samePeriodLastYearRange
          )
        : undefined;
    const manualComparableDates =
      period !== "day" && currentRevenue.usesDaily
        ? comparableDatesForRange(
            periodRange,
            currentRevenue.dailyDates,
            manualPeriodRange
          )
        : undefined;
    const previousRevenue =
      period === "day"
        ? sumRevenueDay(revenue.dailyRecords, previousDay, shop)
        : sumRevenueForRange(
            revenue.records,
            revenue.dailyRecords,
            previousPeriodWeeks,
            previousPeriodRange,
            shop,
            previousComparableDates
          );
    const lastYearRevenue =
      period === "day"
        ? sumRevenueDay(revenue.dailyRecords, sameDayLastYear, shop)
        : sumRevenueForRange(
            revenue.records,
            revenue.dailyRecords,
            samePeriodLastYearWeeks,
            samePeriodLastYearRange,
            shop,
            lastYearComparableDates
          );
    const manualRevenue =
      period === "day"
        ? sumRevenueDay(revenue.dailyRecords, manualCompareDate, shop)
        : sumRevenueForRange(
            revenue.records,
            revenue.dailyRecords,
            manualPeriodWeeks,
            manualPeriodRange,
            shop,
            manualComparableDates
          );
    const includedLaborDates =
      period !== "day" && currentRevenue.usesDaily
        ? new Set(currentRevenue.dailyDates)
        : undefined;
    const laborShop = sumLaborForShop(
      labor.schedules,
      shop,
      periodRange,
      includedLaborDates
    );
    const revenueAmount = currentRevenue.amount;
    const hours = labor.schedules.length
      ? Number(laborShop.hours.toFixed(2))
      : null;
    const laborCost = labor.schedules.length
      ? Number(laborShop.cost.toFixed(2))
      : null;
    const productivity =
      revenueAmount !== null && hours && hours > 0
        ? Number((revenueAmount / hours).toFixed(2))
        : null;
    const laborCostPercentage =
      revenueAmount !== null && revenueAmount > 0 && laborCost !== null
        ? Number((laborCost / revenueAmount).toFixed(4))
        : null;

    return {
      shop,
      year,
      week,
      revenue: revenueAmount,
      revenueMissing: currentRevenue.missing,
      hours,
      laborCost,
      missingLaborHours: Number(laborShop.missingHours.toFixed(2)),
      missingLaborShifts: laborShop.missingShifts,
      productivity,
      productivityStatus: getProductivityStatus(shop, productivity),
      laborCostPercentage,
      laborCostStatus: getLaborCostStatus(shop, laborCostPercentage),
      previousWeekIndex: percentDifference(
        revenueAmount,
        previousRevenue.amount
      ),
      sameWeekLastYearIndex: percentDifference(
        revenueAmount,
        lastYearRevenue.amount
      ),
      manualCompareIndex: percentDifference(
        revenueAmount,
        manualRevenue.amount
      ),
      note: currentRevenue.note,
      source: currentRevenue.source,
    };
  });
  const totalRevenue = rows.reduce((total, row) => total + (row.revenue || 0), 0);
  const totalHours = rows.reduce((total, row) => total + (row.hours || 0), 0);
  const totalLaborCost = rows.reduce(
    (total, row) => total + (row.laborCost || 0),
    0
  );
  const hasLaborData = rows.some(
    (row) => row.hours !== null || row.laborCost !== null
  );

  return NextResponse.json(
    {
      generatedAt: now.toISOString(),
      period,
      periodLabel: getPeriodLabel(year, week, period, selectedDate),
      periodWeeks,
      year,
      week,
      date: selectedDate,
      previousDay,
      sameDayLastYear,
      manualCompareDate,
      previousWeek: previousPeriod,
      sameWeekLastYear: samePeriodLastYear,
      manualCompare: { year: compareYear, week: compareWeek },
      storage: revenue.storage,
      laborWarning: labor.warning,
      totals: {
        revenue: Number(totalRevenue.toFixed(2)),
        hours: hasLaborData ? Number(totalHours.toFixed(2)) : null,
        laborCost: hasLaborData ? Number(totalLaborCost.toFixed(2)) : null,
        productivity:
          hasLaborData && totalHours > 0
            ? Number((totalRevenue / totalHours).toFixed(2))
            : null,
        laborCostPercentage:
          hasLaborData && totalRevenue > 0
            ? Number((totalLaborCost / totalRevenue).toFixed(4))
            : null,
      },
      rows,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}
