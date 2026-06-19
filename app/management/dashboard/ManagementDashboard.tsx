"use client";

import { useEffect, useMemo, useState } from "react";

type DashboardStatus = "loading" | "ready" | "error";
type BadgeStatus = "green" | "orange" | "red" | "missing";

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
  period: "week" | "month";
  periodLabel: string;
  year: number;
  week: number;
  previousWeek: { year: number; week: number };
  sameWeekLastYear: { year: number; week: number };
  manualCompare: { year: number; week: number };
  storage?: { status: "wordpress" | "seed"; message?: string };
  laborWarning?: string;
  totals: {
    revenue: number;
    hours: number;
    laborCost: number;
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

function formatMoney(value: number | null) {
  if (value === null) return "-";

  return euroFormatter.format(value);
}

function formatHours(value: number | null) {
  if (value === null) return "-";

  return `${decimalFormatter.format(value)} uur`;
}

function formatProductivity(value: number | null) {
  if (value === null) return "-";

  return `${euroFormatter.format(value)} / uur`;
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

function statusTextClasses(status: BadgeStatus) {
  if (status === "green") return "text-[#2f6b3b]";
  if (status === "orange") return "text-[#8a5b10]";
  if (status === "red") return "text-[#a23b30]";

  return "text-[#8b8278]";
}

function statusDotClasses(status: BadgeStatus) {
  if (status === "green") return "bg-[#5c9b62]";
  if (status === "orange") return "bg-[#d7a64c]";
  if (status === "red") return "bg-[#df5a48]";

  return "bg-[#c9c1b7]";
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
    <article className="rounded-lg border border-[#e7e0d8]/80 bg-white/90 px-2.5 py-2 shadow-sm sm:px-3">
      <p className="text-[0.58rem] font-black uppercase tracking-[0.1em] text-[#2d2a26]/45">
        {label}
      </p>
      <p className="mt-0.5 text-base font-black leading-tight text-[#1a1815] sm:text-lg">
        {value}
      </p>
      {sub && (
        <p className="mt-0.5 text-[0.68rem] font-bold text-[#8b8278]">{sub}</p>
      )}
    </article>
  );
}

function DashboardRowCard({
  row,
  compareLabel,
  period,
}: Readonly<{
  row: DashboardRow;
  compareLabel: string;
  period: "week" | "month";
}>) {
  const source =
    row.source === "excel" ? "Excel" : row.source === "manual" ? "Handmatig" : "Geen omzet";

  return (
    <article className="rounded-lg border border-[#e7e0d8]/80 bg-white/92 px-2.5 py-2 shadow-sm sm:px-3">
      <div className="grid gap-2 sm:grid-cols-[9rem_minmax(0,1fr)] sm:items-center xl:grid-cols-[10rem_repeat(7,minmax(0,1fr))]">
        <div className="flex min-w-0 items-baseline justify-between gap-2 sm:block">
          <h2 className="truncate text-sm font-black leading-tight text-[#1a1815] sm:text-base">
            {row.shop}
          </h2>
          <p className="shrink-0 text-[0.62rem] font-bold text-[#8b8278] sm:mt-0.5">
            {source}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-x-2 gap-y-1 text-[0.68rem] font-bold text-[#6b645b] sm:grid-cols-4 xl:contents">
          <div>
            <p className="text-[0.55rem] uppercase tracking-[0.08em] text-[#2d2a26]/42">
              Omzet
            </p>
            <p className="text-base font-black leading-tight text-[#ef533b]">
              {formatMoney(row.revenue)}
            </p>
          </div>
          <div>
            <p className="text-[0.55rem] uppercase tracking-[0.08em] text-[#2d2a26]/42">
              Uren
            </p>
            <p className="text-sm font-black leading-tight text-[#1a1815]">
              {formatHours(row.hours)}
            </p>
          </div>
          <div>
            <p className="text-[0.55rem] uppercase tracking-[0.08em] text-[#2d2a26]/42">
              Loon
            </p>
            <p className="text-sm font-black leading-tight text-[#1a1815]">
              {formatMoney(row.laborCost)}
            </p>
          </div>
          <div>
            <p className="text-[0.55rem] uppercase tracking-[0.08em] text-[#2d2a26]/42">
              Productiviteit
            </p>
            <p
              className={`flex items-center gap-1 text-sm font-black leading-tight ${statusTextClasses(
                row.productivityStatus
              )}`}
            >
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${statusDotClasses(
                  row.productivityStatus
                )}`}
              />
              {formatProductivity(row.productivity)}
            </p>
          </div>
          <div>
            <p className="text-[0.55rem] uppercase tracking-[0.08em] text-[#2d2a26]/42">
              Loon %
            </p>
            <p
              className={`flex items-center gap-1 text-sm font-black leading-tight ${statusTextClasses(
                row.laborCostStatus
              )}`}
            >
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${statusDotClasses(
                  row.laborCostStatus
                )}`}
              />
              {formatPercent(row.laborCostPercentage)}
            </p>
          </div>
          <div>
            <p className="text-[0.55rem] uppercase tracking-[0.08em] text-[#2d2a26]/42">
              {period === "month" ? "Vorige maand" : "Vorige week"}
            </p>
            <p className="text-sm font-black leading-tight text-[#1a1815]">
              {formatIndex(row.previousWeekIndex)}
            </p>
          </div>
          <div className="col-span-2 sm:col-span-1">
            <p className="truncate text-[0.55rem] uppercase tracking-[0.08em] text-[#2d2a26]/42">
              {compareLabel}
            </p>
            <p className="text-sm font-black leading-tight text-[#1a1815]">
              {formatIndex(row.manualCompareIndex)}
            </p>
          </div>
        </div>
      </div>

      {(row.revenueMissing || row.note || row.missingLaborHours > 0) && (
        <div className="mt-2 rounded-md bg-[#f8f6f3] px-2 py-1.5 text-[0.68rem] font-bold leading-tight text-[#6b645b]">
          {row.revenueMissing && (
            <span className="mr-3 text-[#ef533b]">Omzet nog niet ingevoerd.</span>
          )}
          {row.missingLaborHours > 0 && (
            <span className="mr-3">
              {decimalFormatter.format(row.missingLaborHours)} loonuren missen nog een match.
            </span>
          )}
          {row.note && <span>{row.note}</span>}
        </div>
      )}
    </article>
  );
}

export default function ManagementDashboard() {
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const [period, setPeriod] = useState<"week" | "month">("week");
  const [year, setYear] = useState(getIsoWeekYear(now));
  const [week, setWeek] = useState(getIsoWeek(now));
  const [month, setMonth] = useState(currentMonth);
  const [compareYear, setCompareYear] = useState(getIsoWeekYear(now) - 1);
  const [compareWeek, setCompareWeek] = useState(getIsoWeek(now));
  const [compareMonth, setCompareMonth] = useState(currentMonth);
  const [state, setState] = useState<DashboardStatus>("loading");
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const dashboardWeek =
    period === "month" ? getIsoWeekForMonth(year, month) : week;
  const compareDashboardWeek =
    period === "month"
      ? getIsoWeekForMonth(compareYear, compareMonth)
      : compareWeek;

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
          compareYear: String(compareYear),
          compareWeek: String(compareDashboardWeek),
        });
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
    compareDashboardWeek,
    compareMonth,
    compareWeek,
    compareYear,
    dashboardWeek,
    month,
    period,
    week,
    year,
  ]);

  const compareLabel = useMemo(
    () =>
      period === "month"
        ? `${monthNames[compareMonth - 1]} ${compareYear}`
        : `${compareYear} · week ${compareWeek}`,
    [compareMonth, compareWeek, compareYear, period]
  );

  function movePeriod(direction: -1 | 1) {
    if (period === "month") {
      const next =
        direction < 0 ? previousMonth(year, month) : nextMonth(year, month);
      setYear(next.year);
      setMonth(next.month);
      return;
    }

    const next = direction < 0 ? previousWeek(year, week) : nextWeek(year, week);
    setYear(next.year);
    setWeek(next.week);
  }

  return (
    <div className="space-y-3">
      <section className="rounded-lg border border-[#e7e0d8]/80 bg-white/88 p-2 shadow-sm">
        <div className="grid gap-2 lg:grid-cols-[auto_auto_minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-end">
          <div className="grid grid-cols-2 rounded-full bg-[#f8f6f3] p-0.5">
            {[
              ["week", "Week"],
              ["month", "Maand"],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setPeriod(value as "week" | "month")}
                className={`rounded-full px-2.5 py-1.5 text-xs font-black transition ${
                  period === value
                    ? "bg-[#ef533b] text-white shadow-sm"
                    : "text-[#2d2a26]/50"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => movePeriod(-1)}
            className="rounded-md bg-[#f8f6f3] px-2.5 py-2 text-xs font-black shadow-sm active:scale-[0.98]"
          >
            Vorige
          </button>

          <div className="grid grid-cols-2 gap-2">
            <label className="grid gap-0.5 text-[0.56rem] font-black uppercase tracking-[0.08em] text-[#2d2a26]/45">
              Jaar
              <input
                type="number"
                value={year}
                onChange={(event) => setYear(Number(event.target.value) || year)}
                className="h-8 rounded-md border border-[#e7e0d8] bg-white px-2 text-sm font-black normal-case tracking-normal text-[#1a1815]"
              />
            </label>
            {period === "month" ? (
              <label className="grid gap-0.5 text-[0.56rem] font-black uppercase tracking-[0.08em] text-[#2d2a26]/45">
                Maand
                <select
                  value={month}
                  onChange={(event) => setMonth(Number(event.target.value))}
                  className="h-8 rounded-md border border-[#e7e0d8] bg-white px-2 text-sm font-black normal-case tracking-normal text-[#1a1815]"
                >
                  {monthNames.map((name, index) => (
                    <option key={name} value={index + 1}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <label className="grid gap-0.5 text-[0.56rem] font-black uppercase tracking-[0.08em] text-[#2d2a26]/45">
                Week
                <input
                  type="number"
                  value={week}
                  min={1}
                  max={53}
                  onChange={(event) =>
                    setWeek(Math.max(1, Math.min(53, Number(event.target.value) || week)))
                  }
                  className="h-8 rounded-md border border-[#e7e0d8] bg-white px-2 text-sm font-black normal-case tracking-normal text-[#1a1815]"
                />
              </label>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <label className="grid gap-0.5 text-[0.56rem] font-black uppercase tracking-[0.08em] text-[#2d2a26]/45">
              Vergelijk jaar
              <input
                type="number"
                value={compareYear}
                onChange={(event) =>
                  setCompareYear(Number(event.target.value) || compareYear)
                }
                className="h-8 rounded-md border border-[#e7e0d8] bg-white px-2 text-sm font-black normal-case tracking-normal text-[#1a1815]"
              />
            </label>
            {period === "month" ? (
              <label className="grid gap-0.5 text-[0.56rem] font-black uppercase tracking-[0.08em] text-[#2d2a26]/45">
                Vergelijk maand
                <select
                  value={compareMonth}
                  onChange={(event) => setCompareMonth(Number(event.target.value))}
                  className="h-8 rounded-md border border-[#e7e0d8] bg-white px-2 text-sm font-black normal-case tracking-normal text-[#1a1815]"
                >
                  {monthNames.map((name, index) => (
                    <option key={name} value={index + 1}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <label className="grid gap-0.5 text-[0.56rem] font-black uppercase tracking-[0.08em] text-[#2d2a26]/45">
                Vergelijk week
                <input
                  type="number"
                  value={compareWeek}
                  min={1}
                  max={53}
                  onChange={(event) =>
                    setCompareWeek(
                      Math.max(1, Math.min(53, Number(event.target.value) || compareWeek))
                    )
                  }
                  className="h-8 rounded-md border border-[#e7e0d8] bg-white px-2 text-sm font-black normal-case tracking-normal text-[#1a1815]"
                />
              </label>
            )}
          </div>

          <button
            type="button"
            onClick={() => movePeriod(1)}
            className="rounded-md bg-[#c3d3bc] px-2.5 py-2 text-xs font-black shadow-sm active:scale-[0.98]"
          >
            Volgende
          </button>
        </div>

        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.68rem] font-bold text-[#6b645b]">
          <span>{data?.periodLabel || (period === "month" ? `${monthNames[month - 1]} ${year}` : `week ${week} · ${year}`)}</span>
          <span>vergelijk: {compareLabel}</span>
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
          <section className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            <Metric
              label={data.period === "month" ? "Maandomzet" : "Weekomzet"}
              value={formatMoney(data.totals.revenue)}
            />
            <Metric label="Uren" value={formatHours(data.totals.hours)} />
            <Metric label="Loonkosten" value={formatMoney(data.totals.laborCost)} />
            <Metric
              label="Loonkosten %"
              value={formatPercent(data.totals.laborCostPercentage)}
              sub={formatProductivity(data.totals.productivity)}
            />
          </section>

          {(data.storage?.status === "seed" || data.laborWarning) && (
            <section className="rounded-lg border border-[#f3d4a4] bg-[#fef9f3] p-3 text-xs font-bold leading-relaxed text-[#7a5417] shadow-sm">
              {data.storage?.status === "seed" && (
                <p>{data.storage.message} Dashboard gebruikt nu de Excel-seed.</p>
              )}
              {data.laborWarning && <p>{data.laborWarning}</p>}
            </section>
          )}

          <section className="space-y-2">
            {data.rows.map((row) => (
              <DashboardRowCard
                key={row.shop}
                row={row}
                compareLabel={compareLabel}
                period={data.period}
              />
            ))}
          </section>
        </>
      )}
    </div>
  );
}
