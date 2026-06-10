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
    <section className="rounded-[1rem] border border-[#d9d6d1] bg-[#e8e8e6] p-3 shadow-sm sm:rounded-[1.25rem] sm:p-4">
      <div className="mb-2 flex items-center justify-between gap-3 sm:mb-3">
        <div>
          <h2 className="text-xl font-black leading-tight text-[#1a1815] sm:text-2xl sm:font-normal">
            aanbieding
          </h2>
          <p className="mt-0.5 text-xs text-[#2d2a26]/70 sm:mt-1 sm:text-sm">
            week {weekNumberForDate(selectedWeek)}
          </p>
        </div>
        <div className="flex items-center gap-1 text-[#050505] sm:gap-2">
          <button
            type="button"
            onClick={() => setSelectedWeek(addDays(selectedWeek, -7))}
            aria-label="Vorige week"
            className="flex h-7 w-7 items-center justify-center rounded-full text-3xl font-light leading-none hover:bg-white/75 sm:h-9 sm:w-9 sm:text-4xl"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => setSelectedWeek(addDays(selectedWeek, 7))}
            aria-label="Volgende week"
            className="flex h-7 w-7 items-center justify-center rounded-full text-3xl font-light leading-none hover:bg-white/75 sm:h-9 sm:w-9 sm:text-4xl"
          >
            ›
          </button>
        </div>
      </div>

      <div className="flex min-h-[10rem] items-center justify-center overflow-hidden rounded-[0.85rem] bg-white sm:min-h-[17rem] sm:rounded-[1rem]">
        {offer?.imageUrl ? (
          <img
            src={offer.imageUrl}
            alt={offer.label || "Aanbieding van de week"}
            className="max-h-[10rem] w-full object-contain sm:max-h-[17rem]"
          />
        ) : (
          <p className="px-5 text-center text-xs font-black uppercase tracking-[0.12em] text-[#2d2a26]/35 sm:text-sm">
            {status || "Geen aanbieding deze week"}
          </p>
        )}
      </div>
    </section>
  );
}
