"use client";

import { useEffect, useMemo, useState } from "react";
import {
  laborCostBenchmarkText,
  productivityBenchmarkText,
  type LaborBenchmarkStatus,
} from "../laborBenchmarks";

type DashboardStatus = "loading" | "ready" | "error";
type BadgeStatus = LaborBenchmarkStatus;
type CompareMode = "none" | "previous" | "lastYear" | "custom";
type Period = "day" | "week" | "month";

type DashboardRow = {
  shop: string;
  revenue: number | null;
  revenueMissing: boolean;
  hours: number | null;
  laborCost: number | null;
  missingLaborHours: number;
  missingLaborShifts: number;
  productivity: number | null;
  productivityStatus: BadgeStatus;
  laborCostPercentage: number | null;
  laborCostStatus: BadgeStatus;
  previousWeekIndex: number | null;
  sameWeekLastYearIndex: number | null;
  manualCompareIndex: number | null;
  note: string;
  source: string | null;
};

type DashboardResponse = {
  period: Period;
  periodLabel: string;
  year: number;
  week: number;
  date: string;
  previousDay?: string;
  sameDayLastYear?: string;
  manualCompareDate?: string;
  previousWeek: { year: number; week: number };
  sameWeekLastYear: { year: number; week: number };
  manualCompare: { year: number; week: number };
  storage?: { status: "wordpress" | "seed"; message?: string };
  laborWarning?: string;
  totals: {
    revenue: number;
    hours: number | null;
    laborCost: number | null;
    productivity: number | null;
    laborCostPercentage: number | null;
  };
  rows: DashboardRow[];
};

const euroFormatter = new Intl.NumberFormat("nl-NL", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

const decimalFormatter = new Intl.NumberFormat("nl-NL", {
  maximumFractionDigits: 1,
});

const monthNames = [
  "januari",
  "februari",
  "maart",
  "april",
  "mei",
  "juni",
  "juli",
  "augustus",
  "september",
  "oktober",
  "november",
  "december",
];

function formatIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function parseIsoDateInput(value: string, fallback: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return fallback;

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return fallback;
  }

  return value;
}

function addDaysToIsoDate(value: string, days: number) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);

  return date.toISOString().slice(0, 10);
}

function addYearsToIsoDate(value: string, years: number) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year + years, month - 1, day));

  if (date.getUTCMonth() !== month - 1) {
    return new Date(Date.UTC(year + years, month, 0)).toISOString().slice(0, 10);
  }

  return date.toISOString().slice(0, 10);
}

function getIsoPartsForIsoDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return {
    year: getIsoWeekYear(date),
    week: getIsoWeek(date),
  };
}

function formatDateLabel(value: string) {
  return new Intl.DateTimeFormat("nl-NL", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00.000Z`));
}

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

function getCurrentPeriodParts() {
  const now = new Date();

  return {
    year: getIsoWeekYear(now),
    week: getIsoWeek(now),
    month: now.getMonth() + 1,
    date: formatIsoDate(now),
  };
}

function getWeeksInIsoYear(year: number) {
  return getIsoWeek(new Date(Date.UTC(year, 11, 28)));
}

function previousWeek(year: number, week: number) {
  if (week > 1) return { year, week: week - 1 };

  const nextYear = year - 1;
  return { year: nextYear, week: getWeeksInIsoYear(nextYear) };
}

function nextWeek(year: number, week: number) {
  const weeks = getWeeksInIsoYear(year);
  if (week < weeks) return { year, week: week + 1 };

  return { year: year + 1, week: 1 };
}

function getIsoWeekForMonth(year: number, month: number) {
  return getIsoWeek(new Date(Date.UTC(year, month - 1, 15)));
}

function previousMonth(year: number, month: number) {
  if (month > 1) return { year, month: month - 1 };

  return { year: year - 1, month: 12 };
}

function nextMonth(year: number, month: number) {
  if (month < 12) return { year, month: month + 1 };

  return { year: year + 1, month: 1 };
}

function cleanDigits(value: string, maxLength: number) {
  return value.replace(/\D/g, "").slice(0, maxLength);
}

function clampNumber(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.trunc(value)));
}

function parseYear(value: string, fallback: number) {
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) return fallback;

  return clampNumber(numberValue, 2020, 2100);
}

function parseWeek(value: string, fallback: number, year: number) {
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) return fallback;

  return clampNumber(numberValue, 1, getWeeksInIsoYear(year));
}

function formatMoney(value: number | null) {
  if (value === null) return "-";

  return euroFormatter.format(value);
}

function formatHours(value: number | null) {
  if (value === null) return "-";

  return `${decimalFormatter.format(value)}u`;
}

function formatProductivity(value: number | null) {
  if (value === null) return "-";

  return `${euroFormatter.format(value)}/u`;
}

function formatPercent(value: number | null) {
  if (value === null) return "-";

  return `${decimalFormatter.format(value * 100)}%`;
}

function formatIndex(value: number | null) {
  if (value === null) return "-";

  const sign = value > 0 ? "+" : "";
  return `${sign}${decimalFormatter.format(value)}%`;
}

function formatPeriodLabel(
  period: Period,
  year: number,
  week: number,
  month: number,
  date: string
) {
  if (period === "day") return formatDateLabel(date);
  if (period === "month") return `${monthNames[month - 1]} ${year}`;

  return `week ${week} · ${year}`;
}

function getCompareTarget(
  mode: CompareMode,
  period: Period,
  year: number,
  week: number,
  month: number,
  date: string,
  customYear: number,
  customWeek: number,
  customMonth: number,
  customDate: string
) {
  if (mode === "custom") {
    if (period === "day") {
      const customDateParts = getIsoPartsForIsoDate(customDate);

      return {
        ...customDateParts,
        month: Number(customDate.slice(5, 7)),
        date: customDate,
      };
    }

    return {
      year: customYear,
      week: period === "month" ? getIsoWeekForMonth(customYear, customMonth) : customWeek,
      month: customMonth,
      date,
    };
  }

  if (mode === "lastYear") {
    if (period === "day") {
      const lastYearDate = addYearsToIsoDate(date, -1);
      const lastYearParts = getIsoPartsForIsoDate(lastYearDate);

      return {
        ...lastYearParts,
        month,
        date: lastYearDate,
      };
    }

    return {
      year: year - 1,
      week: period === "month" ? getIsoWeekForMonth(year - 1, month) : week,
      month,
      date,
    };
  }

  if (period === "day") {
    const previousDate = addDaysToIsoDate(date, -1);
    const previousParts = getIsoPartsForIsoDate(previousDate);

    return {
      ...previousParts,
      month: Number(previousDate.slice(5, 7)),
      date: previousDate,
    };
  }

  if (period === "month") {
    const previous = previousMonth(year, month);

    return {
      ...previous,
      week: getIsoWeekForMonth(previous.year, previous.month),
      date,
    };
  }

  return {
    ...previousWeek(year, week),
    month,
    date,
  };
}

function getCompareLabel(
  mode: CompareMode,
  period: Period,
  target: { year: number; week: number; month: number; date: string }
) {
  if (mode === "none") return "";
  if (mode === "previous") {
    if (period === "day") return "dag eerder";

    return period === "month" ? "maand eerder" : "week eerder";
  }
  if (mode === "lastYear") return "jaar eerder";

  if (period === "day") return formatDateLabel(target.date);

  return period === "month"
    ? `${monthNames[target.month - 1]} ${target.year}`
    : `week ${target.week} · ${target.year}`;
}

function statusTextClasses(status: BadgeStatus) {
  if (status === "green") return "text-[#2f6b3b]";
  if (status === "orange") return "text-[#8a5b10]";
  if (status === "red") return "text-[#a23b30]";

  return "text-[#8b8278]";
}

function KpiStatusDot({
  status,
  description,
}: Readonly<{
  status: BadgeStatus;
  description: string;
}>) {
  const dotClass = status === "green"
    ? "border-[#2f6b3b] bg-[#48a15a]"
    : status === "orange"
      ? "border-[#b88900] bg-[#fed500]"
      : status === "red"
        ? "border-[#a23b30] bg-[#d75a48]"
        : "border-[#aaa39b] bg-[#d8d3cc]";

  return (
    <details className="relative inline-flex shrink-0">
      <summary
        aria-label={description}
        title={description}
        className="grid h-4 w-4 cursor-pointer list-none place-items-center rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[#a27a8e]"
      >
        <span className={`h-2.5 w-2.5 rounded-full border ${dotClass}`} />
      </summary>
      <span className="absolute left-0 top-5 z-30 w-max max-w-48 rounded-md border border-[#ded7cf] bg-white px-2 py-1.5 text-[0.6rem] font-bold normal-case leading-snug tracking-normal text-[#4d463d] shadow-lg">
        {description}
      </span>
    </details>
  );
}

function Metric({
  label,
  value,
  sub,
}: Readonly<{
  label: string;
  value: string;
  sub?: string;
}>) {
  return (
    <article className="rounded-md border border-[#e7e0d8]/80 bg-white/90 px-2 py-1.5 shadow-sm sm:px-3 sm:py-2">
      <p className="text-[0.5rem] font-black uppercase tracking-[0.08em] text-[#2d2a26]/45 sm:text-[0.58rem]">
        {label}
      </p>
      <p className="mt-0.5 text-sm font-black leading-tight text-[#1a1815] sm:text-lg">
        {value}
      </p>
      {sub && (
        <p className="mt-0.5 text-[0.58rem] font-bold leading-tight text-[#8b8278] sm:text-[0.68rem]">
          {sub}
        </p>
      )}
    </article>
  );
}

function DashboardRowCard({
  row,
  compareLabel,
  showCompare,
}: Readonly<{
  row: DashboardRow;
  compareLabel: string;
  showCompare: boolean;
}>) {
  const source =
    row.source === "excel"
      ? "Excel"
      : row.source === "manual"
        ? "Handmatig"
        : row.source === "dagafsluiting"
          ? "Dagafsluiting"
          : "Geen omzet";

  return (
    <article className="rounded-md border border-[#e7e0d8]/80 bg-white/92 px-2 py-1.5 shadow-sm sm:px-3 sm:py-2">
      <div
        className={`grid gap-1.5 sm:grid-cols-[7.5rem_minmax(0,1fr)] sm:items-center ${
          showCompare
            ? "xl:grid-cols-[8rem_repeat(6,minmax(0,1fr))]"
            : "xl:grid-cols-[8rem_repeat(5,minmax(0,1fr))]"
        }`}
      >
        <div className="flex min-w-0 items-center justify-between gap-1 sm:block">
          <p className="whitespace-nowrap text-[0.62rem] font-black uppercase leading-none tracking-[0.08em] text-[#1a1815] sm:text-[0.68rem]">
            {row.shop}
          </p>
          <p className="shrink-0 text-[0.52rem] font-bold leading-tight text-[#8b8278] sm:mt-0.5 sm:text-[0.62rem]">
            {source}
          </p>
        </div>

        <div
          className={`grid gap-x-1.5 gap-y-1 text-[0.6rem] font-bold text-[#6b645b] xl:contents ${
            showCompare ? "grid-cols-3 sm:grid-cols-6" : "grid-cols-5"
          }`}
        >
          <div>
            <p className="text-[0.48rem] uppercase tracking-[0.06em] text-[#2d2a26]/42">
              Omzet
            </p>
            <p className="text-[0.8rem] font-black leading-tight text-[#ef533b] sm:text-sm">
              {formatMoney(row.revenue)}
            </p>
          </div>
          <div>
            <p className="text-[0.48rem] uppercase tracking-[0.06em] text-[#2d2a26]/42">
              Uren
            </p>
            <p className="text-[0.76rem] font-black leading-tight text-[#1a1815] sm:text-sm">
              {formatHours(row.hours)}
            </p>
          </div>
          <div>
            <p className="text-[0.48rem] uppercase tracking-[0.06em] text-[#2d2a26]/42">
              Loon
            </p>
            <p className="text-[0.76rem] font-black leading-tight text-[#1a1815] sm:text-sm">
              {formatMoney(row.laborCost)}
            </p>
          </div>
          <div>
            <p className="text-[0.48rem] uppercase tracking-[0.06em] text-[#2d2a26]/42">
              Prod.
            </p>
            <div
              className={`text-[0.76rem] font-black leading-tight sm:text-sm ${statusTextClasses(
                row.productivityStatus
              )} flex items-center gap-1`}
            >
              <KpiStatusDot
                status={row.productivityStatus}
                description={productivityBenchmarkText(row.shop, row.productivityStatus)}
              />
              {formatProductivity(row.productivity)}
            </div>
          </div>
          <div>
            <p className="text-[0.48rem] uppercase tracking-[0.06em] text-[#2d2a26]/42">
              Loon %
            </p>
            <div
              className={`text-[0.76rem] font-black leading-tight sm:text-sm ${statusTextClasses(
                row.laborCostStatus
              )} flex items-center gap-1`}
            >
              <KpiStatusDot
                status={row.laborCostStatus}
                description={laborCostBenchmarkText(row.shop, row.laborCostStatus)}
              />
              {formatPercent(row.laborCostPercentage)}
            </div>
          </div>
          {showCompare && (
            <div className="col-span-3 sm:col-span-1">
              <p className="truncate text-[0.48rem] uppercase tracking-[0.06em] text-[#2d2a26]/42">
                % tov aangegeven vergelijking
              </p>
              <p className="text-[0.76rem] font-black leading-tight text-[#1a1815] sm:text-sm">
                {formatIndex(row.manualCompareIndex)}
              </p>
            </div>
          )}
        </div>
      </div>

      {(row.revenueMissing || row.note || row.missingLaborHours > 0) && (
        <div className="mt-1.5 rounded-md bg-[#fff4f1] px-2 py-1 text-[0.58rem] font-bold leading-tight text-[#a23b30] sm:text-[0.68rem]">
          {row.revenueMissing && (
            <span className="mr-2 text-[#ef533b]">Omzet mist.</span>
          )}
          {row.missingLaborHours > 0 && (
            <span className="mr-2 inline-flex items-center gap-1">
              <span className="grid h-3.5 w-3.5 place-items-center rounded-full bg-[#ef533b] text-[0.58rem] leading-none text-white">
                !
              </span>
              {decimalFormatter.format(row.missingLaborHours)}u zonder loonmatch
              (ingevuld met gemiddeld uurloon).
            </span>
          )}
          {row.note && <span>{row.note}</span>}
        </div>
      )}

      {showCompare && compareLabel && (
        <p className="mt-1 text-[0.52rem] font-bold leading-tight text-[#8b8278] sm:hidden">
          vergeleken met {compareLabel}
        </p>
      )}
    </article>
  );
}

export default function ManagementDashboard() {
  const initialPeriod = useMemo(() => getCurrentPeriodParts(), []);
  const [period, setPeriod] = useState<Period>("week");
  const [year, setYear] = useState(initialPeriod.year);
  const [week, setWeek] = useState(initialPeriod.week);
  const [month, setMonth] = useState(initialPeriod.month);
  const [date, setDate] = useState(initialPeriod.date);
  const [compareMode, setCompareMode] = useState<CompareMode>("none");
  const [compareYear, setCompareYear] = useState(initialPeriod.year - 1);
  const [compareWeek, setCompareWeek] = useState(initialPeriod.week);
  const [compareMonth, setCompareMonth] = useState(initialPeriod.month);
  const [compareDate, setCompareDate] = useState(
    addYearsToIsoDate(initialPeriod.date, -1)
  );
  const [draftPeriod, setDraftPeriod] = useState<Period>("week");
  const [draftYear, setDraftYear] = useState(String(initialPeriod.year));
  const [draftWeek, setDraftWeek] = useState(String(initialPeriod.week));
  const [draftMonth, setDraftMonth] = useState(initialPeriod.month);
  const [draftDate, setDraftDate] = useState(initialPeriod.date);
  const [draftCompareMode, setDraftCompareMode] = useState<CompareMode>("none");
  const [draftCompareYear, setDraftCompareYear] = useState(String(initialPeriod.year - 1));
  const [draftCompareWeek, setDraftCompareWeek] = useState(String(initialPeriod.week));
  const [draftCompareMonth, setDraftCompareMonth] = useState(initialPeriod.month);
  const [draftCompareDate, setDraftCompareDate] = useState(
    addYearsToIsoDate(initialPeriod.date, -1)
  );
  const [compareOpen, setCompareOpen] = useState(false);
  const [state, setState] = useState<DashboardStatus>("loading");
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const dashboardWeek =
    period === "month"
      ? getIsoWeekForMonth(year, month)
      : period === "day"
        ? getIsoPartsForIsoDate(date).week
        : week;
  const compareTarget = useMemo(
    () =>
      getCompareTarget(
        compareMode,
        period,
        year,
        week,
        month,
        date,
        compareYear,
        compareWeek,
        compareMonth,
        compareDate
      ),
    [
      compareDate,
      compareMode,
      compareMonth,
      compareWeek,
      compareYear,
      date,
      month,
      period,
      week,
      year,
    ]
  );
  const showCompare = compareMode !== "none";
  const compareLabel = useMemo(
    () => getCompareLabel(compareMode, period, compareTarget),
    [compareMode, compareTarget, period]
  );

  useEffect(() => {
    let ignoreResult = false;

    async function loadDashboard() {
      setState("loading");
      setErrorMessage("");

      try {
        const params = new URLSearchParams({
          period,
          year: String(year),
          week: String(dashboardWeek),
          compareYear: String(compareTarget.year),
          compareWeek: String(compareTarget.week),
        });
        if (period === "day") {
          params.set("date", date);
          params.set("compareDate", compareTarget.date);
        }
        const response = await fetch(`/api/management-dashboard?${params}`, {
          cache: "no-store",
        });
        const body = (await response.json().catch(() => null)) as
          | DashboardResponse
          | { message?: string }
          | null;

        if (!response.ok || !body || !("rows" in body)) {
          throw new Error(
            (body && "message" in body && body.message) ||
              "Dashboard ophalen is mislukt."
          );
        }

        if (ignoreResult) return;

        setData(body);
        setState("ready");
      } catch (error) {
        if (!ignoreResult) {
          setData(null);
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Dashboard ophalen is mislukt."
          );
          setState("error");
        }
      }
    }

    void loadDashboard();

    return () => {
      ignoreResult = true;
    };
  }, [
    compareTarget.date,
    compareTarget.week,
    compareTarget.year,
    dashboardWeek,
    date,
    period,
    year,
  ]);

  function applyFilters() {
    const nextDate = parseIsoDateInput(draftDate, date);
    const nextDateParts = getIsoPartsForIsoDate(nextDate);
    const nextYear =
      draftPeriod === "day" ? nextDateParts.year : parseYear(draftYear, year);
    const nextWeek =
      draftPeriod === "day"
        ? nextDateParts.week
        : parseWeek(draftWeek, week, nextYear);
    const nextMonth =
      draftPeriod === "day" ? Number(nextDate.slice(5, 7)) : draftMonth;
    const nextCompareDate = parseIsoDateInput(draftCompareDate, compareDate);
    const nextCompareYear = parseYear(draftCompareYear, compareYear);
    const nextCompareWeek = parseWeek(draftCompareWeek, compareWeek, nextCompareYear);

    setPeriod(draftPeriod);
    setYear(nextYear);
    setWeek(nextWeek);
    setMonth(nextMonth);
    setDate(nextDate);
    setCompareMode(draftCompareMode);
    setCompareYear(nextCompareYear);
    setCompareWeek(nextCompareWeek);
    setCompareMonth(draftCompareMonth);
    setCompareDate(nextCompareDate);
    setDraftYear(String(nextYear));
    setDraftWeek(String(nextWeek));
    setDraftMonth(nextMonth);
    setDraftDate(nextDate);
    setDraftCompareYear(String(nextCompareYear));
    setDraftCompareWeek(String(nextCompareWeek));
    setDraftCompareDate(nextCompareDate);
    setCompareOpen(false);
  }

  function nudgeDraftPeriod(direction: -1 | 1) {
    const parsedYear = parseYear(draftYear, year);

    if (draftPeriod === "day") {
      const nextDate = addDaysToIsoDate(parseIsoDateInput(draftDate, date), direction);
      const nextDateParts = getIsoPartsForIsoDate(nextDate);
      const nextMonth = Number(nextDate.slice(5, 7));

      setDraftDate(nextDate);
      setDraftYear(String(nextDateParts.year));
      setDraftWeek(String(nextDateParts.week));
      setDraftMonth(nextMonth);
      setPeriod("day");
      setDate(nextDate);
      setYear(nextDateParts.year);
      setWeek(nextDateParts.week);
      setMonth(nextMonth);
      return;
    }

    if (draftPeriod === "month") {
      const next =
        direction < 0
          ? previousMonth(parsedYear, draftMonth)
          : nextMonth(parsedYear, draftMonth);

      setDraftYear(String(next.year));
      setDraftMonth(next.month);
      setPeriod("month");
      setYear(next.year);
      setMonth(next.month);
      setWeek(getIsoWeekForMonth(next.year, next.month));
      return;
    }

    const parsedWeek = parseWeek(draftWeek, week, parsedYear);
    const next =
      direction < 0
        ? previousWeek(parsedYear, parsedWeek)
        : nextWeek(parsedYear, parsedWeek);

    setDraftYear(String(next.year));
    setDraftWeek(String(next.week));
    setPeriod("week");
    setYear(next.year);
    setWeek(next.week);
  }

  function goToCurrentWeek() {
    const current = getCurrentPeriodParts();

    setPeriod("week");
    setYear(current.year);
    setWeek(current.week);
    setMonth(current.month);
    setDate(current.date);
    setCompareMode("none");
    setCompareOpen(false);
    setDraftPeriod("week");
    setDraftYear(String(current.year));
    setDraftWeek(String(current.week));
    setDraftMonth(current.month);
    setDraftDate(current.date);
    setDraftCompareMode("none");
    setDraftCompareYear(String(current.year - 1));
    setDraftCompareWeek(String(current.week));
    setDraftCompareMonth(current.month);
    setCompareDate(addYearsToIsoDate(current.date, -1));
    setDraftCompareDate(addYearsToIsoDate(current.date, -1));
  }

  function resetCompare() {
    setCompareMode("none");
    setDraftCompareMode("none");
    setCompareOpen(false);
  }

  function openComparePanel() {
    if (compareOpen) {
      setCompareOpen(false);
      if (compareMode === "none") {
        setDraftCompareMode("none");
      }
      return;
    }

    if (compareMode !== "none") {
      resetCompare();
      return;
    }

    setCompareOpen(true);
    setDraftCompareMode("previous");
  }

  const draftLabel = formatPeriodLabel(
    draftPeriod,
    parseYear(draftYear, year),
    parseWeek(draftWeek, week, parseYear(draftYear, year)),
    draftMonth,
    parseIsoDateInput(draftDate, date)
  );

  return (
    <div className="space-y-2 sm:space-y-3">
      <section className="rounded-2xl border border-[#dce5d8] bg-white/92 p-3 shadow-sm">
        <div className="mb-2 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[0.58rem] font-black uppercase tracking-[0.1em] text-[#8b8278]">
              Loonkostenoverzicht
            </p>
            <h2 className="truncate text-base font-black capitalize text-[#1a1815]">
              {formatPeriodLabel(period, year, week, month, date)}
            </h2>
          </div>
          <button
            type="button"
            onClick={goToCurrentWeek}
            className="h-8 shrink-0 rounded-full bg-[#dcebd8] px-3 text-[0.62rem] font-black text-[#24551d] shadow-sm active:scale-[0.98]"
          >
            deze week
          </button>
        </div>

        <div className="flex flex-wrap items-end gap-2 rounded-xl bg-[#f8f6f3] p-2">
          <div className="grid h-9 grid-cols-3 rounded-full bg-white p-0.5 shadow-sm">
            {[
              ["day", "Dag"],
              ["week", "Week"],
              ["month", "Maand"],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setDraftPeriod(value as Period)}
                className={`rounded-full px-3 text-xs font-black transition ${
                  draftPeriod === value
                    ? "bg-[#a27a8e] text-white shadow-sm"
                    : "text-[#2d2a26]/50"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {draftPeriod !== "day" && (
            <label className="grid w-20 gap-0.5 text-[0.56rem] font-black uppercase tracking-[0.08em] text-[#2d2a26]/45">
              Jaar
              <input
                type="text"
                inputMode="numeric"
                value={draftYear}
                onChange={(event) => setDraftYear(cleanDigits(event.target.value, 4))}
                className="h-9 rounded-lg border border-[#e7e0d8] bg-white px-2 text-sm font-black normal-case tracking-normal text-[#1a1815]"
              />
            </label>
          )}

          {draftPeriod === "day" ? (
            <label className="grid min-w-40 gap-0.5 text-[0.56rem] font-black uppercase tracking-[0.08em] text-[#2d2a26]/45">
              Datum
              <input
                type="date"
                value={draftDate}
                onChange={(event) => setDraftDate(event.target.value)}
                className="h-9 rounded-lg border border-[#e7e0d8] bg-white px-2 text-xs font-black normal-case tracking-normal text-[#1a1815]"
              />
            </label>
          ) : draftPeriod === "month" ? (
            <label className="grid min-w-32 flex-1 gap-0.5 text-[0.56rem] font-black uppercase tracking-[0.08em] text-[#2d2a26]/45 sm:max-w-44">
              Maand
              <select
                value={draftMonth}
                onChange={(event) => setDraftMonth(Number(event.target.value))}
                className="h-9 rounded-lg border border-[#e7e0d8] bg-white px-2 text-xs font-black normal-case tracking-normal text-[#1a1815]"
              >
                {monthNames.map((name, index) => (
                  <option key={name} value={index + 1}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <label className="grid w-16 gap-0.5 text-[0.56rem] font-black uppercase tracking-[0.08em] text-[#2d2a26]/45">
              Week
              <input
                type="text"
                inputMode="numeric"
                value={draftWeek}
                onChange={(event) => setDraftWeek(cleanDigits(event.target.value, 2))}
                className="h-9 rounded-lg border border-[#e7e0d8] bg-white px-2 text-sm font-black normal-case tracking-normal text-[#1a1815]"
              />
            </label>
          )}

          <div className="flex h-9 items-end gap-1">
            <button
              type="button"
              onClick={() => nudgeDraftPeriod(-1)}
              aria-label="Week eerder"
              className="grid h-9 w-9 place-items-center rounded-lg bg-white text-lg font-black leading-none text-[#1a1815] shadow-sm active:scale-[0.96]"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={() => nudgeDraftPeriod(1)}
              aria-label="Week verder"
              className="grid h-9 w-9 place-items-center rounded-lg bg-white text-lg font-black leading-none text-[#1a1815] shadow-sm active:scale-[0.96]"
            >
              ›
            </button>
          </div>

          <button
            type="button"
            onClick={openComparePanel}
            className={`h-9 rounded-lg border px-3 text-[0.68rem] font-black shadow-sm active:scale-[0.98] ${
              compareOpen || draftCompareMode !== "none"
                ? "border-[#a27a8e] bg-[#a27a8e] text-white"
                : "border-[#d8d2ca] bg-white text-[#6b645b]"
            }`}
          >
            {showCompare ? "vergelijking uit" : "vergelijk"}
          </button>
        </div>

        {compareOpen && (
          <div className="mt-2 rounded-xl border border-[#e7e0d8]/80 bg-[#fbfaf8] p-2.5 shadow-inner">
            <div className="flex flex-wrap gap-1.5">
              {[
                [
                  "previous",
                  draftPeriod === "day"
                    ? "dag eerder"
                    : draftPeriod === "month"
                      ? "maand eerder"
                      : "week eerder",
                ],
                ["lastYear", "jaar eerder"],
                ["custom", "anders"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setDraftCompareMode(value as CompareMode)}
                  className={`h-7 rounded-full border px-3 text-[0.65rem] font-black transition ${
                    draftCompareMode === value
                      ? "border-[#a27a8e] bg-[#a27a8e] text-white shadow-sm"
                      : "border-[#ded7cf] bg-white text-[#6b645b]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {draftCompareMode === "custom" && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {draftPeriod === "day" ? (
                  <label className="grid min-w-36 gap-0.5 text-[0.5rem] font-black uppercase tracking-[0.08em] text-[#2d2a26]/45">
                    Datum
                    <input
                      type="date"
                      value={draftCompareDate}
                      onChange={(event) =>
                        setDraftCompareDate(event.target.value)
                      }
                      className="h-8 rounded-md border border-[#e7e0d8] bg-white px-2 text-xs font-black normal-case tracking-normal text-[#1a1815]"
                    />
                  </label>
                ) : (
                  <label className="grid w-16 gap-0.5 text-[0.5rem] font-black uppercase tracking-[0.08em] text-[#2d2a26]/45">
                    Jaar
                    <input
                      type="text"
                      inputMode="numeric"
                      value={draftCompareYear}
                      onChange={(event) =>
                        setDraftCompareYear(cleanDigits(event.target.value, 4))
                      }
                      className="h-8 rounded-md border border-[#e7e0d8] bg-white px-2 text-sm font-black normal-case tracking-normal text-[#1a1815]"
                    />
                  </label>
                )}
                {draftPeriod === "month" ? (
                  <label className="grid min-w-28 flex-1 gap-0.5 text-[0.5rem] font-black uppercase tracking-[0.08em] text-[#2d2a26]/45 sm:max-w-40">
                    Maand
                    <select
                      value={draftCompareMonth}
                      onChange={(event) =>
                        setDraftCompareMonth(Number(event.target.value))
                      }
                      className="h-8 rounded-md border border-[#e7e0d8] bg-white px-2 text-xs font-black normal-case tracking-normal text-[#1a1815]"
                    >
                      {monthNames.map((name, index) => (
                        <option key={name} value={index + 1}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : draftPeriod === "week" ? (
                  <label className="grid w-14 gap-0.5 text-[0.5rem] font-black uppercase tracking-[0.08em] text-[#2d2a26]/45">
                    Week
                    <input
                      type="text"
                      inputMode="numeric"
                      value={draftCompareWeek}
                      onChange={(event) =>
                        setDraftCompareWeek(cleanDigits(event.target.value, 2))
                      }
                      className="h-8 rounded-md border border-[#e7e0d8] bg-white px-2 text-sm font-black normal-case tracking-normal text-[#1a1815]"
                    />
                  </label>
                ) : null}
              </div>
            )}

          </div>
        )}

        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 px-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[0.68rem] font-semibold text-[#8b8278]">
            <span>Geselecteerd: {draftLabel}</span>
            {showCompare && <span>actief: {compareLabel}</span>}
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            {(draftCompareMode !== "none" || showCompare) && (
              <button
                type="button"
                onClick={resetCompare}
                className="h-7 rounded-full border border-[#ded7cf] bg-white px-3 text-[0.62rem] font-black text-[#6b645b] shadow-sm active:scale-[0.98]"
              >
                vergelijking uit
              </button>
            )}
            <button
              type="button"
              onClick={applyFilters}
              className="h-8 rounded-lg bg-[#24551d] px-3 text-[0.68rem] font-black text-white shadow-sm active:scale-[0.98]"
            >
              Tonen
            </button>
          </div>
        </div>
      </section>

      {state === "loading" && (
        <section className="rounded-lg border border-[#e7e0d8]/80 bg-white/85 p-3 text-sm font-bold text-[#8b8278] shadow-sm">
          Dashboard laden...
        </section>
      )}

      {state === "error" && (
        <section className="rounded-lg border border-[#f0b4aa] bg-[#fff4f1] p-3 text-sm font-bold text-[#9f382f] shadow-sm">
          {errorMessage}
        </section>
      )}

      {state === "ready" && data && (
        <>
          <section className="grid grid-cols-4 gap-1.5 sm:gap-2">
            <Metric
              label={
                data.period === "day"
                  ? "Dagomzet"
                  : data.period === "month"
                    ? "Maandomzet"
                    : "Weekomzet"
              }
              value={formatMoney(data.totals.revenue)}
            />
            <Metric label="Uren" value={formatHours(data.totals.hours)} />
            <Metric label="Loon" value={formatMoney(data.totals.laborCost)} />
            <Metric
              label="Loon %"
              value={formatPercent(data.totals.laborCostPercentage)}
              sub={formatProductivity(data.totals.productivity)}
            />
          </section>

          {(data.storage?.status === "seed" || data.laborWarning) && (
            <section className="rounded-lg border border-[#f3d4a4] bg-[#fef9f3] p-2 text-[0.68rem] font-bold leading-snug text-[#7a5417] shadow-sm sm:p-3 sm:text-xs">
              {data.storage?.status === "seed" && (
                <p>{data.storage.message} Dashboard gebruikt nu de Excel-seed.</p>
              )}
              {data.laborWarning && <p>{data.laborWarning}</p>}
            </section>
          )}

          <section className="space-y-1.5 sm:space-y-2">
            {data.rows.map((row) => (
              <DashboardRowCard
                key={row.shop}
                row={row}
                compareLabel={compareLabel}
                showCompare={showCompare}
              />
            ))}
          </section>
        </>
      )}
    </div>
  );
}
