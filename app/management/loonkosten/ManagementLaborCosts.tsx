"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  LaborCostDay,
  LaborCostSchedule,
  LaborCostShop,
  LaborCostTotals,
} from "../../tamigoApi";

type LoadState = "loading" | "ready" | "error";

const euroFormatter = new Intl.NumberFormat("nl-NL", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

const decimalEuroFormatter = new Intl.NumberFormat("nl-NL", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatCost(value: number) {
  if (Math.abs(value) < 100) return decimalEuroFormatter.format(value);

  return euroFormatter.format(value);
}

function formatHours(value: number) {
  return `${value.toLocaleString("nl-NL", {
    maximumFractionDigits: 2,
  })} uur`;
}

function getAverageRate(totals: LaborCostTotals) {
  const paidHours = totals.directHourlyHours + totals.derivedMonthlyHours;
  const paidCost = totals.directHourlyCost + totals.derivedMonthlyCost;
  if (paidHours <= 0) return 0;

  return paidCost / paidHours;
}

function MetricCard({
  label,
  value,
  sub,
  tone = "neutral",
}: Readonly<{
  label: string;
  value: string;
  sub?: string;
  tone?: "neutral" | "green" | "red" | "sand";
}>) {
  const toneClass =
    tone === "green"
      ? "border-[#c3d3bc] bg-[#f0f5ed]"
      : tone === "red"
        ? "border-[#f0b4aa] bg-[#fff4f1]"
        : tone === "sand"
          ? "border-[#f3d4a4] bg-[#fef9f3]"
          : "border-[#e7e0d8] bg-white/90";

  return (
    <article className={`rounded-2xl border p-3 shadow-sm ${toneClass}`}>
      <p className="text-[0.62rem] font-black uppercase tracking-[0.12em] text-[#2d2a26]/45">
        {label}
      </p>
      <p className="mt-1 text-xl font-black text-[#1a1815] sm:text-2xl">
        {value}
      </p>
      {sub && (
        <p className="mt-1 text-xs font-bold leading-snug text-[#6b645b]">
          {sub}
        </p>
      )}
    </article>
  );
}

function LoadingState() {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {[0, 1, 2, 3].map((item) => (
        <div
          key={item}
          className="rounded-[1.5rem] border border-[#e7e0d8]/80 bg-white/80 p-4 shadow-sm"
        >
          <div className="animate-pulse space-y-3">
            <div className="h-5 w-32 rounded-full bg-[#2d2a26]/10" />
            <div className="h-8 w-24 rounded-full bg-[#2d2a26]/10" />
            <div className="h-20 rounded-2xl bg-[#2d2a26]/10" />
          </div>
        </div>
      ))}
    </div>
  );
}

function ShopCostCard({ shop }: Readonly<{ shop: LaborCostShop }>) {
  const missingTone = shop.missingHours > 0 ? "text-[#ef533b]" : "text-[#638a73]";

  return (
    <article className="rounded-[1.5rem] border border-[#e7e0d8]/80 bg-white/90 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-[#1a1815]">{shop.shop}</h2>
          <p className="text-xs font-bold text-[#8b8278]">
            {shop.shifts} diensten · {formatHours(shop.hours)}
          </p>
        </div>
        <p className="text-right text-xl font-black text-[#ef533b]">
          {formatCost(shop.cost)}
        </p>
      </div>

      <div className="mt-4 grid gap-2 text-sm font-bold text-[#2d2a26]/70">
        <div className="flex justify-between gap-3">
          <span>Uurloon bekend</span>
          <span>{formatCost(shop.directHourlyCost)}</span>
        </div>
        <div className="flex justify-between gap-3">
          <span>Maandloon omgerekend</span>
          <span>{formatCost(shop.derivedMonthlyCost)}</span>
        </div>
        {shop.estimatedAverageHours > 0 && (
          <div className="flex justify-between gap-3 text-[#a23b30]">
            <span>Gemiddeld ingevuld</span>
            <span>
              {formatCost(shop.estimatedAverageCost)} ·{" "}
              {formatHours(shop.estimatedAverageHours)}
            </span>
          </div>
        )}
        <div className={`flex justify-between gap-3 ${missingTone}`}>
          <span>Ontbrekende loonuren</span>
          <span>{formatHours(shop.missingHours)}</span>
        </div>
      </div>
    </article>
  );
}

function DayRow({ day }: Readonly<{ day: LaborCostDay }>) {
  return (
    <article className="rounded-2xl border border-[#e7e0d8]/80 bg-white/85 p-3 shadow-sm">
      <div className="grid gap-3 lg:grid-cols-[10rem_minmax(0,1fr)_8rem] lg:items-center">
        <div>
          <h3 className="text-base font-black capitalize text-[#1a1815]">
            {day.weekdayLabel}
          </h3>
          <p className="text-xs font-bold text-[#8b8278]">{day.dateLabel}</p>
        </div>

        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {day.shops.map((shop) => (
            <div
              key={shop.shop}
              className="rounded-xl bg-[#f8f6f3] px-3 py-2"
            >
              <p className="truncate text-[0.65rem] font-black uppercase tracking-[0.08em] text-[#2d2a26]/45">
                {shop.shop}
              </p>
              <p className="text-sm font-black text-[#1a1815]">
                {formatCost(shop.cost)}
              </p>
              <p className="text-[0.68rem] font-bold text-[#6b645b]">
                {formatHours(shop.hours)}
              </p>
            </div>
          ))}
        </div>

        <div className="text-left lg:text-right">
          <p className="text-[0.62rem] font-black uppercase tracking-[0.12em] text-[#2d2a26]/45">
            Dag totaal
          </p>
          <p className="text-lg font-black text-[#ef533b]">
            {formatCost(day.totals.cost)}
          </p>
        </div>
      </div>
    </article>
  );
}

export default function ManagementLaborCosts() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [state, setState] = useState<LoadState>("loading");
  const [schedule, setSchedule] = useState<LaborCostSchedule | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let ignoreResult = false;

    async function loadLaborCosts() {
      setState("loading");
      setErrorMessage("");

      try {
        const res = await fetch(
          `/api/tamigo-labor-costs?weekOffset=${weekOffset}`,
          { cache: "no-store" }
        );
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data?.message || "Loonkosten ophalen is mislukt.");
        }

        if (ignoreResult) return;

        setSchedule(data as LaborCostSchedule);
        setState("ready");
      } catch (error) {
        if (!ignoreResult) {
          setSchedule(null);
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Loonkosten ophalen is mislukt."
          );
          setState("error");
        }
      }
    }

    void loadLaborCosts();

    return () => {
      ignoreResult = true;
    };
  }, [weekOffset]);

  const shopTotals = useMemo(() => {
    if (!schedule) return [];

    return schedule.shops.flatMap((shopName) => {
      const totals = schedule.days.reduce<LaborCostShop | null>((current, day) => {
        const shop = day.shops.find((item) => item.shop === shopName);
        if (!shop) return current;

        if (!current) return { ...shop };

        return {
          ...current,
          shifts: current.shifts + shop.shifts,
          hours: current.hours + shop.hours,
          cost: current.cost + shop.cost,
          directHourlyHours: current.directHourlyHours + shop.directHourlyHours,
          directHourlyCost: current.directHourlyCost + shop.directHourlyCost,
          derivedMonthlyHours:
            current.derivedMonthlyHours + shop.derivedMonthlyHours,
          derivedMonthlyCost:
            current.derivedMonthlyCost + shop.derivedMonthlyCost,
          estimatedAverageHours:
            current.estimatedAverageHours + shop.estimatedAverageHours,
          estimatedAverageCost:
            current.estimatedAverageCost + shop.estimatedAverageCost,
          missingHours: current.missingHours + shop.missingHours,
          missingShifts: current.missingShifts + shop.missingShifts,
          missingEmployeeShifts:
            current.missingEmployeeShifts + shop.missingEmployeeShifts,
          missingWageShifts: current.missingWageShifts + shop.missingWageShifts,
        };
      }, null);

      return totals
        ? [
            {
              ...totals,
              hours: Number(totals.hours.toFixed(2)),
              cost: Number(totals.cost.toFixed(2)),
              directHourlyHours: Number(totals.directHourlyHours.toFixed(2)),
              directHourlyCost: Number(totals.directHourlyCost.toFixed(2)),
              derivedMonthlyHours: Number(totals.derivedMonthlyHours.toFixed(2)),
              derivedMonthlyCost: Number(totals.derivedMonthlyCost.toFixed(2)),
              estimatedAverageHours: Number(
                totals.estimatedAverageHours.toFixed(2)
              ),
              estimatedAverageCost: Number(
                totals.estimatedAverageCost.toFixed(2)
              ),
              missingHours: Number(totals.missingHours.toFixed(2)),
            },
          ]
        : [];
    });
  }, [schedule]);

  return (
    <div className="space-y-4">
      <section className="rounded-[1.5rem] border border-[#e7e0d8]/80 bg-white/85 p-3 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center">
          <button
            type="button"
            onClick={() => setWeekOffset((current) => current - 1)}
            className="rounded-full bg-[#f8f6f3] px-4 py-2 text-sm font-black shadow-sm active:scale-[0.98]"
          >
            ← Vorige
          </button>

          <div className="text-center">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[#2d2a26]/45">
              Loonkosten
            </p>
            <p className="text-lg font-black text-[#050505]">
              {schedule?.weekLabel || "Laden..."}
            </p>
          </div>

          <button
            type="button"
            onClick={() => setWeekOffset((current) => current + 1)}
            className="rounded-full bg-[#c3d3bc] px-4 py-2 text-sm font-black shadow-sm active:scale-[0.98]"
          >
            Volgende →
          </button>
        </div>
      </section>

      {state === "loading" && <LoadingState />}

      {state === "error" && (
        <section className="rounded-[1.5rem] border border-[#f0b4aa] bg-[#fff4f1] p-4 text-sm font-bold text-[#9f382f] shadow-sm">
          {errorMessage || "Loonkosten tijdelijk niet beschikbaar"}
        </section>
      )}

      {state === "ready" && schedule && (
        <>
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              label="Week totaal"
              value={formatCost(schedule.totals.cost)}
              sub={`${formatHours(schedule.totals.hours)} gepland`}
              tone="red"
            />
            <MetricCard
              label="Gemiddeld bekend"
              value={formatCost(getAverageRate(schedule.totals))}
              sub="per berekend uur"
              tone="green"
            />
            <MetricCard
              label="Maandloon"
              value={formatCost(schedule.totals.derivedMonthlyCost)}
              sub={`${formatHours(schedule.totals.derivedMonthlyHours)} omgerekend`}
              tone="sand"
            />
            <MetricCard
              label="Ontbrekend"
              value={formatHours(schedule.totals.missingHours)}
              sub={`${schedule.totals.missingShifts} diensten ingevuld met gemiddeld uurloon`}
            />
          </section>

          <section className="rounded-[1.5rem] border border-[#e7e0d8]/80 bg-white/85 p-4 shadow-sm">
            <h2 className="text-lg font-black text-[#1a1815]">
              Per winkel
            </h2>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {shopTotals.map((shop) => (
                <ShopCostCard key={shop.shop} shop={shop} />
              ))}
            </div>
          </section>

          <section className="space-y-2">
            <h2 className="px-1 text-lg font-black text-[#1a1815]">
              Per dag
            </h2>
            {schedule.days.map((day) => (
              <DayRow key={day.date} day={day} />
            ))}
          </section>

          {schedule.notes.length > 0 && (
            <section className="rounded-[1.5rem] border border-[#f3d4a4] bg-[#fef9f3] p-4 text-sm font-bold leading-relaxed text-[#6b4b18] shadow-sm">
              <ul className="space-y-1">
                {schedule.notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
