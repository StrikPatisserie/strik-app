import { NextResponse } from "next/server";
import {
  getTamigoStatusCode,
  getWeekLaborCostScheduleForIsoWeek,
} from "../../tamigoApi";
import {
  findRevenueRecord,
  getRevenueTotal,
  revenueShops,
  type RevenueShop,
} from "../../management/revenueData";
import { getMergedRevenueData } from "../../management/revenueServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Status = "green" | "orange" | "red" | "missing";

function getIsoWeekYear(date: Date) {
  const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNumber = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - dayNumber);

  return target.getUTCFullYear();
}

function getIsoWeek(date: Date) {
  const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNumber = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - dayNumber);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));

  return Math.ceil(((target.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

function getWeeksInIsoYear(year: number) {
  return getIsoWeek(new Date(Date.UTC(year, 11, 28)));
}

function getPreviousWeek(year: number, week: number) {
  if (week > 1) {
    return { year, week: week - 1 };
  }

  const previousYear = year - 1;
  return { year: previousYear, week: getWeeksInIsoYear(previousYear) };
}

function numberParam(url: URL, key: string, fallback: number) {
  const value = Number(url.searchParams.get(key));

  return Number.isFinite(value) ? Math.trunc(value) : fallback;
}

function clampWeek(week: number) {
  return Math.max(1, Math.min(53, Math.trunc(week)));
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

export async function GET(request: Request) {
  const now = new Date();
  const url = new URL(request.url);
  const year = numberParam(url, "year", getIsoWeekYear(now));
  const week = clampWeek(numberParam(url, "week", getIsoWeek(now)));
  const previousWeek = getPreviousWeek(year, week);
  const sameWeekLastYear = { year: year - 1, week };
  const compareYear = numberParam(url, "compareYear", sameWeekLastYear.year);
  const compareWeek = clampWeek(
    numberParam(url, "compareWeek", sameWeekLastYear.week)
  );
  const revenue = await getMergedRevenueData();
  let laborSchedule: Awaited<ReturnType<typeof getWeekLaborCostScheduleForIsoWeek>> | null =
    null;
  let laborWarning = "";

  try {
    laborSchedule = await getWeekLaborCostScheduleForIsoWeek(year, week);
  } catch (error) {
    const status = getTamigoStatusCode(error);
    laborWarning =
      status === 403
        ? "Tamigo gaf geen toegang tot rooster/loonkosten voor deze week."
        : "Tamigo uren en loonkosten konden tijdelijk niet geladen worden.";
  }

  const rows = revenueShops.map((shop) => {
    const currentRevenue = findRevenueRecord(revenue.records, year, week, shop);
    const previousRevenue = findRevenueRecord(
      revenue.records,
      previousWeek.year,
      previousWeek.week,
      shop
    );
    const lastYearRevenue = findRevenueRecord(
      revenue.records,
      sameWeekLastYear.year,
      sameWeekLastYear.week,
      shop
    );
    const manualRevenue = findRevenueRecord(
      revenue.records,
      compareYear,
      compareWeek,
      shop
    );
    const laborShop = laborSchedule?.days.reduce(
      (totals, day) => {
        const dayShop = day.shops.find((item) => item.shop === shop);
        if (!dayShop) return totals;

        return {
          hours: totals.hours + dayShop.hours,
          cost: totals.cost + dayShop.cost,
          missingHours: totals.missingHours + dayShop.missingHours,
          missingShifts: totals.missingShifts + dayShop.missingShifts,
        };
      },
      { hours: 0, cost: 0, missingHours: 0, missingShifts: 0 }
    );
    const revenueAmount = currentRevenue?.amount ?? null;
    const hours = laborShop ? Number(laborShop.hours.toFixed(2)) : null;
    const laborCost = laborShop ? Number(laborShop.cost.toFixed(2)) : null;
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
      revenueMissing: revenueAmount === null,
      hours,
      laborCost,
      missingLaborHours: laborShop
        ? Number(laborShop.missingHours.toFixed(2))
        : 0,
      missingLaborShifts: laborShop?.missingShifts || 0,
      productivity,
      productivityStatus: getProductivityStatus(shop, productivity),
      laborCostPercentage,
      laborCostStatus: getLaborCostStatus(shop, laborCostPercentage),
      previousWeekIndex: percentDifference(
        revenueAmount,
        previousRevenue?.amount ?? null
      ),
      sameWeekLastYearIndex: percentDifference(
        revenueAmount,
        lastYearRevenue?.amount ?? null
      ),
      manualCompareIndex: percentDifference(
        revenueAmount,
        manualRevenue?.amount ?? null
      ),
      note: currentRevenue?.note || "",
      source: currentRevenue?.source || null,
    };
  });
  const totalRevenue = getRevenueTotal(revenue.records, year, week);
  const totalHours = rows.reduce((total, row) => total + (row.hours || 0), 0);
  const totalLaborCost = rows.reduce(
    (total, row) => total + (row.laborCost || 0),
    0
  );

  return NextResponse.json(
    {
      generatedAt: now.toISOString(),
      year,
      week,
      previousWeek,
      sameWeekLastYear,
      manualCompare: { year: compareYear, week: compareWeek },
      storage: revenue.storage,
      laborWarning,
      totals: {
        revenue: Number(totalRevenue.toFixed(2)),
        hours: Number(totalHours.toFixed(2)),
        laborCost: Number(totalLaborCost.toFixed(2)),
        productivity:
          totalHours > 0 ? Number((totalRevenue / totalHours).toFixed(2)) : null,
        laborCostPercentage:
          totalRevenue > 0
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
