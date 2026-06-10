"use client";

import { useEffect, useState } from "react";
import { fetchRecepturenData } from "../bakkerij/recepturen/recepturenApi";
import type { BakeryHomeOffer } from "../bakkerij/recepturen/types";
import type { TodayStaffSchedule, TodayStaffShop } from "../tamigoApi";

type LoadState = "loading" | "ready" | "error";

const SHOP_ACCENTS: Record<
  string,
  {
    card: string;
    name: string;
  }
> = {
  Lent: {
    card: "border-[#d6e5d8] bg-[#f6faf4]",
    name: "text-[#4a6d5a]",
  },
  Heyendaal: {
    card: "border-[#f3d4a4] bg-[#fef9f3]",
    name: "text-[#8a5b10]",
  },
  Ziekerstraat: {
    card: "border-[#fee2e2] bg-[#fef2f2]",
    name: "text-[#c42828]",
  },
  Daalseweg: {
    card: "border-[#e0f2fe] bg-[#f0f9ff]",
    name: "text-[#0369a1]",
  },
};

function getShopAccent(shopName: string) {
  return (
    SHOP_ACCENTS[shopName] || {
      card: "border-[#e8e4de] bg-white",
      name: "text-[#1a1815]",
    }
  );
}

function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function dateFromKey(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return new Date();

  return new Date(year, month - 1, day);
}

function addDays(value: string, days: number) {
  const date = dateFromKey(value);
  date.setDate(date.getDate() + days);

  return dateKey(date);
}

function weekStartForDate(date = new Date()) {
  const nextDate = new Date(date);
  const day = nextDate.getDay() || 7;
  nextDate.setHours(0, 0, 0, 0);
  nextDate.setDate(nextDate.getDate() - day + 1);

  return dateKey(nextDate);
}

function formatWeekRange(weekStart: string) {
  const start = dateFromKey(weekStart);
  const end = dateFromKey(addDays(weekStart, 6));
  const formatter = new Intl.DateTimeFormat("nl-NL", {
    day: "numeric",
    month: "long",
  });

  return `${formatter.format(start)} t/m ${formatter.format(end)}`;
}

function offerForWeek(offers: BakeryHomeOffer[] = [], weekStart: string) {
  return offers.find((offer) => offer.weekStart === weekStart) || null;
}

function LoadingRows() {
  return (
    <div className="space-y-2">
      {[0, 1, 2, 3].map((item) => (
        <div
          key={item}
          className="rounded-lg bg-[#f5f2ee] px-3 py-3"
        >
          <div className="animate-pulse space-y-2">
            <div className="h-4 w-28 rounded-full bg-[#1a1815]/10" />
            <div className="h-3 w-44 rounded-full bg-[#1a1815]/10" />
          </div>
        </div>
      ))}
    </div>
  );
}

function ShopRow({
  shop,
}: Readonly<{
  shop: TodayStaffShop;
}>) {
  const accent = getShopAccent(shop.shop);
  const iceEmployees = shop.iceEmployees || [];
  const iceShiftText = iceEmployees.length
    ? iceEmployees
        .map(
          (employee) =>
            `${employee.employeeName} ${employee.shifts
              .map((shift) => shift.timeLabel)
              .join(", ")}`
        )
        .join(" · ")
    : "geen ijsdienst vandaag";

  return (
    <article className={`rounded-2xl border px-3 py-3 ${accent.card}`}>
      <h3 className={`text-base font-black leading-tight ${accent.name}`}>
        {shop.shop}
      </h3>

      {shop.employees.length > 0 ? (
        <ul className="mt-2 space-y-1.5">
          {shop.employees.map((employee) => (
            <li
              key={employee.id}
              className="grid grid-cols-[minmax(0,1fr)_auto] gap-3"
            >
              <span className="min-w-0 break-words text-sm font-bold leading-snug text-[#2d2a26]">
                {employee.employeeName}
              </span>
              <span className="max-w-[9.5rem] text-right text-xs font-bold leading-snug text-[#2d2a26]/55">
                {employee.shifts.map((shift) => shift.timeLabel).join(", ")}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1.5 text-sm font-semibold text-[#2d2a26]/50">
          Geen diensten vandaag
        </p>
      )}

      {shop.iceEmployees && (
        <p className="mt-2 rounded-xl bg-white/50 px-2.5 py-2 text-xs font-semibold italic leading-snug text-[#2d2a26]/60">
          IJs: {iceShiftText}
        </p>
      )}

      {shop.absences.length > 0 && (
        <div className="mt-2 rounded-xl bg-white/55 px-2.5 py-2">
          <p className="text-[0.65rem] font-black uppercase tracking-[0.08em] text-[#2d2a26]/45">
            Afwezig
          </p>
          <ul className="mt-1 space-y-1">
            {shop.absences.map((absence) => (
              <li
                key={absence.id}
                className="flex items-center justify-between gap-2 text-xs font-bold text-[#2d2a26]/65"
              >
                <span className="min-w-0 truncate">{absence.employeeName}</span>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[0.62rem] uppercase tracking-[0.06em] ${
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
    </article>
  );
}

export default function TodayStaffWidget() {
  const [state, setState] = useState<LoadState>("loading");
  const [schedule, setSchedule] = useState<TodayStaffSchedule | null>(null);
  const [bakeryOffers, setBakeryOffers] = useState<BakeryHomeOffer[]>([]);
  const [selectedOfferWeek, setSelectedOfferWeek] = useState(weekStartForDate);

  useEffect(() => {
    let ignoreResult = false;

    async function loadScheduleAndOffer() {
      try {
        const [scheduleResult, recepturenResult] = await Promise.allSettled([
          fetch("/api/tamigo-shifts-today", {
            cache: "no-store",
          }),
          fetchRecepturenData(),
        ]);

        if (ignoreResult) return;

        if (recepturenResult.status === "fulfilled" && recepturenResult.value.ok) {
          setBakeryOffers(recepturenResult.value.data.bakeryHome?.offers || []);
        }

        if (scheduleResult.status !== "fulfilled") {
          throw new Error("Tamigo rooster ophalen is mislukt.");
        }

        if (!scheduleResult.value.ok) {
          throw new Error("Tamigo rooster ophalen is mislukt.");
        }

        const data = (await scheduleResult.value.json()) as TodayStaffSchedule;

        setSchedule(data);
        setState("ready");
      } catch {
        if (!ignoreResult) {
          setSchedule(null);
          setState("error");
        }
      }
    }

    void loadScheduleAndOffer();

    return () => {
      ignoreResult = true;
    };
  }, []);

  return (
    <section className="rounded-[1.5rem] border border-[#e7e0d8]/80 bg-white/80 p-4 shadow-sm">
      <h2 className="text-xl font-black leading-tight text-[#050505]">
        Wie werkt vandaag?
      </h2>

      <div className="mt-3">
        {state === "loading" && <LoadingRows />}

        {state === "error" && (
          <div className="rounded-2xl bg-[#f7f4ef] px-3 py-3 text-sm font-bold text-[#2d2a26]/60">
            Rooster tijdelijk niet beschikbaar
          </div>
        )}

        {state === "ready" && schedule && (
          <div className="space-y-2">
            {schedule.shops.map((shop) => (
              <ShopRow key={shop.shop} shop={shop} />
            ))}
          </div>
        )}

        {bakeryOffers.length > 0 && (
          <BakeryOfferThumbnail
            offers={bakeryOffers}
            selectedWeek={selectedOfferWeek}
            onSelectWeek={setSelectedOfferWeek}
          />
        )}
      </div>
    </section>
  );
}

function BakeryOfferThumbnail({
  offers,
  selectedWeek,
  onSelectWeek,
}: Readonly<{
  offers: BakeryHomeOffer[];
  selectedWeek: string;
  onSelectWeek: (weekStart: string) => void;
}>) {
  const offer = offerForWeek(offers, selectedWeek);

  return (
    <article className="mt-4 overflow-hidden rounded-2xl border border-[#c3d3bc] bg-white">
      <div className="grid h-8 grid-cols-[2rem_2rem_minmax(0,1fr)] border-b border-[#6d746a] bg-[#c3d3bc]">
        <button
          type="button"
          onClick={() => onSelectWeek(addDays(selectedWeek, -7))}
          className="border-r border-[#6d746a] text-2xl font-light leading-none text-[#2d2a26]"
          aria-label="Vorige week"
        >
          ‹
        </button>
        <button
          type="button"
          onClick={() => onSelectWeek(addDays(selectedWeek, 7))}
          className="border-r border-[#6d746a] text-2xl font-light leading-none text-[#2d2a26]"
          aria-label="Volgende week"
        >
          ›
        </button>
        <h3 className="flex items-center px-3 text-xs font-black uppercase tracking-[0.16em] text-[#2d2a26]/75">
          <span className="min-w-0 truncate">
            Aanbieding · {formatWeekRange(selectedWeek)}
          </span>
        </h3>
      </div>
      <div className="flex min-h-36 items-center justify-center bg-white p-2">
        {offer?.imageUrl ? (
          <img
            src={offer.imageUrl}
            alt={offer.label || "Aanbieding van de week"}
            className="mx-auto max-h-44 w-full object-contain"
          />
        ) : (
          <p className="px-4 text-center text-xs font-black uppercase tracking-[0.12em] text-[#2d2a26]/35">
            Geen aanbieding deze week
          </p>
        )}
      </div>
    </article>
  );
}
