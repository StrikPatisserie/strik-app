"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  TodayStaffShop,
  WeekStaffDay,
  WeekStaffSchedule,
} from "../../tamigoApi";

type LoadState = "loading" | "ready" | "error";
type SortMode = "day" | "shop";

const shopAccentClasses: Record<
  string,
  {
    header: string;
    pill: string;
    section: string;
  }
> = {
  Lent: {
    header: "border-[#a8bf9e]/70 bg-[#dce8d6] text-[#263b22]",
    pill: "bg-[#dce8d6] text-[#263b22]",
    section: "border-[#a8bf9e]/55 bg-[#f4f8f1]",
  },
  Ziekerstraat: {
    header: "border-[#d98f87]/70 bg-[#f8dfd8] text-[#7a2f28]",
    pill: "bg-[#f8dfd8] text-[#7a2f28]",
    section: "border-[#d98f87]/50 bg-[#fff6f4]",
  },
  Heyendaal: {
    header: "border-[#d9b761]/70 bg-[#f1d28f]/75 text-[#4a3711]",
    pill: "bg-[#f1d28f]/75 text-[#4a3711]",
    section: "border-[#d9b761]/50 bg-[#fff9e9]",
  },
  Daalseweg: {
    header: "border-[#9ebac4]/70 bg-[#dbe9ee] text-[#254858]",
    pill: "bg-[#dbe9ee] text-[#254858]",
    section: "border-[#9ebac4]/50 bg-[#f2f8fa]",
  },
};

function getShopAccent(shopName: string) {
  return (
    shopAccentClasses[shopName] || {
      header: "border-[#e7e0d8] bg-[#f8f6f3] text-[#2d2a26]",
      pill: "bg-[#f8f6f3] text-[#2d2a26]",
      section: "border-[#e7e0d8]/80 bg-white/70",
    }
  );
}

function ShiftSummary({ shop }: Readonly<{ shop: TodayStaffShop }>) {
  const hasEmployees = shop.employees.length > 0;
  const hasAbsences = shop.absences.length > 0;

  if (!hasEmployees && !hasAbsences) {
    return (
      <p className="text-sm font-semibold text-[#2d2a26]/45">
        Geen diensten
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {hasEmployees && (
        <ul className="space-y-1">
          {shop.employees.map((employee) => (
            <li
              key={employee.id}
              className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 text-sm"
            >
              <span className="min-w-0 font-bold text-[#2d2a26]">
                {employee.employeeName}
              </span>
              <span className="text-right text-xs font-bold text-[#2d2a26]/55">
                {employee.shifts.map((shift) => shift.timeLabel).join(", ")}
              </span>
            </li>
          ))}
        </ul>
      )}

      {hasAbsences && (
        <div className="rounded-xl bg-[#f8f6f3] px-2.5 py-2">
          <p className="text-[0.62rem] font-black uppercase tracking-[0.08em] text-[#2d2a26]/45">
            Afwezig
          </p>
          <ul className="mt-1 space-y-1">
            {shop.absences.map((absence) => (
              <li
                key={absence.id}
                className="flex items-center justify-between gap-2 text-xs font-bold"
              >
                <span className="min-w-0 truncate text-[#2d2a26]/70">
                  {absence.employeeName}
                </span>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[0.58rem] uppercase tracking-[0.06em] ${
                    absence.type === "sick"
                      ? "bg-[#f8dfd8] text-[#9f382f]"
                      : "bg-[#e8f0f2] text-[#4e6c74]"
                  }`}
                >
                  {absence.label}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function ShopBlock({
  shop,
}: Readonly<{
  shop: TodayStaffShop;
}>) {
  const accent = getShopAccent(shop.shop);

  return (
    <article className={`rounded-xl border p-2 shadow-sm ${accent.section}`}>
      <h3
        className={`rounded-lg border px-2.5 py-1.5 text-center text-sm font-black leading-tight shadow-sm ${accent.header}`}
      >
        {shop.shop}
      </h3>
      <div className="mt-2">
        <ShiftSummary shop={shop} />
      </div>
    </article>
  );
}

function DaySection({ day }: Readonly<{ day: WeekStaffDay }>) {
  return (
    <section className="rounded-2xl border border-[#e7e0d8]/80 bg-white/75 p-3 shadow-sm">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h2 className="text-base font-black capitalize text-[#050505]">
          {day.weekdayLabel}
        </h2>
        <p className="text-sm font-bold text-[#2d2a26]/50">{day.dateLabel}</p>
      </div>

      <div className="grid gap-2 md:grid-cols-2">
        {day.shops.map((shop) => (
          <ShopBlock key={shop.shop} shop={shop} />
        ))}
      </div>
    </section>
  );
}

function ShopSection({
  shopName,
  days,
}: Readonly<{
  shopName: string;
  days: WeekStaffDay[];
}>) {
  const accent = getShopAccent(shopName);

  return (
    <section className={`rounded-2xl border p-3 shadow-sm ${accent.section}`}>
      <h2
        className={`mb-2 rounded-lg border px-3 py-2 text-center text-base font-black ${accent.header}`}
      >
        {shopName}
      </h2>
      <div className="grid gap-2 md:grid-cols-2">
        {days.map((day) => {
          const shop = day.shops.find((item) => item.shop === shopName);
          if (!shop) return null;

          return (
            <article
              key={day.date}
              className="rounded-xl border border-[#e7e0d8]/80 bg-white/90 p-2 shadow-sm"
            >
              <div
                className={`mb-2 rounded-lg px-2.5 py-1.5 text-center ${accent.pill}`}
              >
                <h3 className="text-sm font-black capitalize leading-tight">
                  {day.weekdayLabel}
                </h3>
                <p className="text-xs font-bold opacity-65">
                  {day.dateLabel}
                </p>
              </div>
              <ShiftSummary shop={shop} />
            </article>
          );
        })}
      </div>
    </section>
  );
}

function LoadingState() {
  return (
    <div className="space-y-3">
      {[0, 1, 2].map((item) => (
        <div
          key={item}
          className="rounded-[1.5rem] border border-[#e7e0d8]/80 bg-white/70 p-4 shadow-sm"
        >
          <div className="animate-pulse space-y-3">
            <div className="h-5 w-36 rounded-full bg-[#2d2a26]/10" />
            <div className="grid gap-2 md:grid-cols-2">
              <div className="h-24 rounded-2xl bg-[#2d2a26]/10" />
              <div className="h-24 rounded-2xl bg-[#2d2a26]/10" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ManagementRoster() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [sortMode, setSortMode] = useState<SortMode>("day");
  const [state, setState] = useState<LoadState>("loading");
  const [schedule, setSchedule] = useState<WeekStaffSchedule | null>(null);

  useEffect(() => {
    let ignoreResult = false;

    async function loadSchedule() {
      setState("loading");

      try {
        const res = await fetch(
          `/api/tamigo-week-schedule?weekOffset=${weekOffset}`,
          { cache: "no-store" }
        );

        if (!res.ok) throw new Error("Rooster ophalen is mislukt.");

        const data = (await res.json()) as WeekStaffSchedule;
        if (ignoreResult) return;

        setSchedule(data);
        setState("ready");
      } catch {
        if (!ignoreResult) {
          setSchedule(null);
          setState("error");
        }
      }
    }

    void loadSchedule();

    return () => {
      ignoreResult = true;
    };
  }, [weekOffset]);

  const shopNames = useMemo(() => schedule?.shops || [], [schedule]);

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
              Weekrooster
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

        <div className="mt-3 grid grid-cols-2 rounded-full bg-[#f8f6f3] p-1">
          {[
            ["day", "Sorteer per dag"],
            ["shop", "Sorteer per winkel"],
          ].map(([mode, label]) => (
            <button
              key={mode}
              type="button"
              onClick={() => setSortMode(mode as SortMode)}
              className={`rounded-full px-3 py-2 text-sm font-black transition ${
                sortMode === mode
                  ? "bg-[#c3d3bc] text-[#2d2a26] shadow-sm"
                  : "text-[#2d2a26]/50"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      {state === "loading" && <LoadingState />}

      {state === "error" && (
        <section className="rounded-[1.5rem] border border-[#e7e0d8]/80 bg-white/85 p-4 text-sm font-bold text-[#2d2a26]/60 shadow-sm">
          Rooster tijdelijk niet beschikbaar
        </section>
      )}

      {state === "ready" && schedule && (
        <div className="space-y-3">
          {sortMode === "day"
            ? schedule.days.map((day) => <DaySection key={day.date} day={day} />)
            : shopNames.map((shopName) => (
                <ShopSection
                  key={shopName}
                  shopName={shopName}
                  days={schedule.days}
                />
              ))}
        </div>
      )}
    </div>
  );
}
