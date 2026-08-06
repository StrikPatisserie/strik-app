"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useState } from "react";
import { fetchRecepturenData } from "./bakkerij/recepturen/recepturenApi";
import type { BakeryHomeOffer } from "./bakkerij/recepturen/types";

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

function weekNumberForDate(value: string) {
  const date = dateFromKey(value);
  const firstThursday = new Date(date.getFullYear(), 0, 4);
  const day = firstThursday.getDay() || 7;
  firstThursday.setDate(firstThursday.getDate() - day + 1);

  return Math.ceil(
    ((date.getTime() - firstThursday.getTime()) / 86400000 + 1) / 7
  );
}

function formatShortWeekRange(value: string) {
  const start = dateFromKey(value);
  const end = dateFromKey(addDays(value, 6));
  const monthFormatter = new Intl.DateTimeFormat("nl-NL", { month: "short" });
  const startMonth = monthFormatter.format(start).replace(".", "");
  const endMonth = monthFormatter.format(end).replace(".", "");

  if (start.getMonth() === end.getMonth()) {
    return `${start.getDate()} t/m ${end.getDate()} ${endMonth}`;
  }

  return `${start.getDate()} ${startMonth} t/m ${end.getDate()} ${endMonth}`;
}

function weekDisplayLabel(value: string) {
  const currentWeek = weekStartForDate();
  const dayDiff = Math.round(
    (dateFromKey(value).getTime() - dateFromKey(currentWeek).getTime()) /
      86400000
  );

  if (dayDiff === 0) return "deze week";
  if (dayDiff === -7) return "vorige week";
  if (dayDiff === 7) return "volgende week";

  return `week ${weekNumberForDate(value)}`;
}

function offerForWeek(offers: BakeryHomeOffer[], weekStart: string) {
  return offers.find((offer) => offer.weekStart === weekStart) || null;
}

export default function WeeklyOfferPanel() {
  const [offers, setOffers] = useState<BakeryHomeOffer[]>([]);
  const [selectedWeek, setSelectedWeek] = useState(weekStartForDate);
  const [status, setStatus] = useState("Aanbieding laden...");
  const offer = offerForWeek(offers, selectedWeek);

  useEffect(() => {
    let ignoreResult = false;

    async function loadOffers() {
      const result = await fetchRecepturenData();

      if (ignoreResult) return;

      if (result.ok) {
        setOffers(result.data.bakeryHome?.offers || []);
        setStatus("");
      } else {
        setStatus("Aanbieding niet beschikbaar");
      }
    }

    void loadOffers();

    return () => {
      ignoreResult = true;
    };
  }, []);

  return (
    <section className="min-w-0 rounded-[0.9rem] border border-[#d9d6d1] bg-[#e8e8e6] p-2 shadow-sm sm:rounded-[1.25rem] sm:p-3">
      <div className="mb-1.5 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-1 sm:mb-2 sm:gap-2">
        <div>
          <h2 className="winkel-card-heading text-[#1a1815]">
            aanbieding
          </h2>
          <p className="winkel-meta-label mt-0.5 text-[#2d2a26]/55 sm:mt-1 sm:text-[#2d2a26]/70">
            <span>{weekDisplayLabel(selectedWeek)}</span>
            <span className="ml-1 font-normal italic text-[#2d2a26]/42">
              {formatShortWeekRange(selectedWeek)}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-0.5 text-[#050505] sm:gap-2">
          <button
            type="button"
            onClick={() => setSelectedWeek(addDays(selectedWeek, -7))}
            aria-label="Vorige week"
            className="flex h-6 w-6 items-center justify-center rounded-full text-2xl font-light leading-none hover:bg-white/75 sm:h-9 sm:w-9 sm:text-4xl"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => setSelectedWeek(addDays(selectedWeek, 7))}
            aria-label="Volgende week"
            className="flex h-6 w-6 items-center justify-center rounded-full text-2xl font-light leading-none hover:bg-white/75 sm:h-9 sm:w-9 sm:text-4xl"
          >
            ›
          </button>
        </div>
      </div>

      <div className="mx-auto flex aspect-[210/297] w-full max-w-[11rem] items-center justify-center overflow-hidden rounded-[0.75rem] border border-[#b9d1ae] bg-[#eef6ea] p-1 sm:max-w-[17rem] sm:rounded-[1rem] sm:p-2 lg:max-w-[18rem]">
        {offer?.imageUrl ? (
          <img
            src={offer.imageUrl}
            alt={offer.label || "Aanbieding van de week"}
            className="h-full w-full object-contain"
          />
        ) : (
          <p className="px-3 text-center text-[0.68rem] font-black uppercase tracking-[0.12em] text-[#2d2a26]/35 sm:px-5 sm:text-sm">
            {status || "Geen aanbieding deze week"}
          </p>
        )}
      </div>
    </section>
  );
}
