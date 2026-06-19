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

function statusClasses(status: BadgeStatus) {
  if (status === "green") return "bg-[#e4f1df] text-[#2f6b3b]";
  if (status === "orange") return "bg-[#fff1d6] text-[#8a5b10]";
  if (status === "red") return "bg-[#fde1dc] text-[#a23b30]";

  return "bg-[#f3f0eb] text-[#8b8278]";
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
    <article className="rounded-2xl border border-[#e7e0d8]/80 bg-white/90 p-3 shadow-sm">
      <p className="text-[0.62rem] font-black uppercase tracking-[0.12em] text-[#2d2a26]/45">
        {label}
      </p>
      <p className="mt-1 text-xl font-black text-[#1a1815]">{value}</p>
      {sub && <p className="mt-1 text-xs font-bold text-[#8b8278]">{sub}</p>}
    </article>
  );
}

function DashboardRowCard({
  row,
  compareLabel,
}: Readonly<{
  row: DashboardRow;
  compareLabel: string;
}>) {
  return (
    <article className="rounded-[1.25rem] border border-[#e7e0d8]/80 bg-white/90 p-3 shadow-sm">
      <div className="grid gap-3 xl:grid-cols-[11rem_repeat(7,minmax(0,1fr))] xl:items-center">
        <div>
          <h2 className="text-base font-black text-[#1a1815]">{row.shop}</h2>
          <p className="text-xs font-bold text-[#8b8278]">
            {row.source === "excel" ? "Excel" : row.source === "manual" ? "Handmatig" : "Ontbreekt"}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:contents">
          <Metric label="Omzet" value={formatMoney(row.revenue)} />
          <Metric label="Uren" value={formatHours(row.hours)} />
          <Metric label="Loonkosten" value={formatMoney(row.laborCost)} />
          <div className="rounded-2xl border border-[#e7e0d8]/80 bg-[#faf8f5] p-3">
            <p className="text-[0.62rem] font-black uppercase tracking-[0.12em] text-[#2d2a26]/45">
              Productiviteit
            </p>
            <p className="mt-1 text-base font-black text-[#1a1815]">
              {formatProductivity(row.productivity)}
            </p>
            <span
              className={`mt-2 inline-flex rounded-full px-2 py-1 text-[0.62rem] font-black uppercase tracking-[0.08em] ${statusClasses(
                row.productivityStatus
              )}`}
            >
              {row.productivityStatus === "missing" ? "geen data" : row.productivityStatus}
            </span>
          </div>
          <div className="rounded-2xl border border-[#e7e0d8]/80 bg-[#faf8f5] p-3">
            <p className="text-[0.62rem] font-black uppercase tracking-[0.12em] text-[#2d2a26]/45">
              Loon %
            </p>
            <p className="mt-1 text-base font-black text-[#1a1815]">
              {formatPercent(row.laborCostPercentage)}
            </p>
            <span
              className={`mt-2 inline-flex rounded-full px-2 py-1 text-[0.62rem] font-black uppercase tracking-[0.08em] ${statusClasses(
                row.laborCostStatus
              )}`}
            >
              {row.laborCostStatus === "missing" ? "geen data" : row.laborCostStatus}
            </span>
          </div>
          <Metric label="Vorige week" value={formatIndex(row.previousWeekIndex)} />
          <Metric label={compareLabel} value={formatIndex(row.manualCompareIndex)} />
        </div>
      </div>

      {(row.revenueMissing || row.note || row.missingLaborHours > 0) && (
        <div className="mt-3 rounded-2xl bg-[#f8f6f3] px-3 py-2 text-sm font-bold text-[#6b645b]">
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
  const [year, setYear] = useState(getIsoWeekYear(now));
  const [week, setWeek] = useState(getIsoWeek(now));
  const [compareYear, setCompareYear] = useState(getIsoWeekYear(now) - 1);
  const [compareWeek, setCompareWeek] = useState(getIsoWeek(now));
  const [state, setState] = useState<DashboardStatus>("loading");
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let ignoreResult = false;

    async function loadDashboard() {
      setState("loading");
      setErrorMessage("");

      try {
        const params = new URLSearchParams({
          year: String(year),
          week: String(week),
          compareYear: String(compareYear),
          compareWeek: String(compareWeek),
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
  }, [compareWeek, compareYear, week, year]);

  const compareLabel = useMemo(
    () => `${compareYear} · week ${compareWeek}`,
    [compareWeek, compareYear]
  );

  function moveWeek(direction: -1 | 1) {
    const next = direction < 0 ? previousWeek(year, week) : nextWeek(year, week);
    setYear(next.year);
    setWeek(next.week);
  }

  return (
    <div className="space-y-4">
      <section className="rounded-[1.5rem] border border-[#e7e0d8]/80 bg-white/85 p-4 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-[auto_7rem_7rem_minmax(0,1fr)_7rem_7rem_auto] lg:items-end">
          <button
            type="button"
            onClick={() => moveWeek(-1)}
            className="rounded-full bg-[#f8f6f3] px-4 py-3 text-sm font-black shadow-sm active:scale-[0.98]"
          >
            Vorige
          </button>
          <label className="grid gap-1 text-xs font-black uppercase tracking-[0.12em] text-[#2d2a26]/45">
            Jaar
            <input
              type="number"
              value={year}
              onChange={(event) => setYear(Number(event.target.value) || year)}
              className="rounded-2xl border border-[#e7e0d8] bg-white px-3 py-2 text-base font-black normal-case tracking-normal text-[#1a1815]"
            />
          </label>
          <label className="grid gap-1 text-xs font-black uppercase tracking-[0.12em] text-[#2d2a26]/45">
            Week
            <input
              type="number"
              value={week}
              min={1}
              max={53}
              onChange={(event) =>
                setWeek(Math.max(1, Math.min(53, Number(event.target.value) || week)))
              }
              className="rounded-2xl border border-[#e7e0d8] bg-white px-3 py-2 text-base font-black normal-case tracking-normal text-[#1a1815]"
            />
          </label>
          <div className="rounded-2xl bg-[#f8f6f3] px-4 py-3 text-center">
            <p className="text-xs font-black uppercase tracking-[0.12em] text-[#2d2a26]/45">
              Handmatige vergelijkweek
            </p>
            <p className="text-sm font-black text-[#1a1815]">{compareLabel}</p>
          </div>
          <label className="grid gap-1 text-xs font-black uppercase tracking-[0.12em] text-[#2d2a26]/45">
            Jaar
            <input
              type="number"
              value={compareYear}
              onChange={(event) =>
                setCompareYear(Number(event.target.value) || compareYear)
              }
              className="rounded-2xl border border-[#e7e0d8] bg-white px-3 py-2 text-base font-black normal-case tracking-normal text-[#1a1815]"
            />
          </label>
          <label className="grid gap-1 text-xs font-black uppercase tracking-[0.12em] text-[#2d2a26]/45">
            Week
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
              className="rounded-2xl border border-[#e7e0d8] bg-white px-3 py-2 text-base font-black normal-case tracking-normal text-[#1a1815]"
            />
          </label>
          <button
            type="button"
            onClick={() => moveWeek(1)}
            className="rounded-full bg-[#c3d3bc] px-4 py-3 text-sm font-black shadow-sm active:scale-[0.98]"
          >
            Volgende
          </button>
        </div>
      </section>

      {state === "loading" && (
        <section className="rounded-[1.5rem] border border-[#e7e0d8]/80 bg-white/85 p-5 text-sm font-bold text-[#8b8278] shadow-sm">
          Dashboard laden...
        </section>
      )}

      {state === "error" && (
        <section className="rounded-[1.5rem] border border-[#f0b4aa] bg-[#fff4f1] p-5 text-sm font-bold text-[#9f382f] shadow-sm">
          {errorMessage}
        </section>
      )}

      {state === "ready" && data && (
        <>
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Metric label="Weekomzet" value={formatMoney(data.totals.revenue)} />
            <Metric label="Gewerkte uren" value={formatHours(data.totals.hours)} />
            <Metric label="Loonkosten" value={formatMoney(data.totals.laborCost)} />
            <Metric
              label="Loonkosten %"
              value={formatPercent(data.totals.laborCostPercentage)}
              sub={formatProductivity(data.totals.productivity)}
            />
          </section>

          {(data.storage?.status === "seed" || data.laborWarning) && (
            <section className="rounded-[1.5rem] border border-[#f3d4a4] bg-[#fef9f3] p-4 text-sm font-bold leading-relaxed text-[#7a5417] shadow-sm">
              {data.storage?.status === "seed" && (
                <p>{data.storage.message} Dashboard gebruikt nu de Excel-seed.</p>
              )}
              {data.laborWarning && <p>{data.laborWarning}</p>}
            </section>
          )}

          <section className="space-y-3">
            {data.rows.map((row) => (
              <DashboardRowCard
                key={row.shop}
                row={row}
                compareLabel={compareLabel}
              />
            ))}
          </section>
        </>
      )}
    </div>
  );
}
