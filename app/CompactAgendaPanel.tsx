"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  TeamAgendaEvent,
  getAudienceLabel,
  getEventTypeLabel,
  getTeamAgendaUrl,
  normalizeTeamAgenda,
} from "./strik-agenda/teamAgendaApi";

type DisplayEvent = TeamAgendaEvent & {
  displayDate: Date;
};

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

function parseDate(value: string) {
  const date = dateFromKey(value);
  date.setHours(0, 0, 0, 0);

  return date;
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

function formatDayLabel(date: Date) {
  const label = new Intl.DateTimeFormat("nl-NL", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
  }).format(date);

  return label.charAt(0).toUpperCase() + label.slice(1);
}

function expandEvents(events: TeamAgendaEvent[], weekStart: string) {
  const start = dateFromKey(weekStart);
  const end = dateFromKey(addDays(weekStart, 6));
  const years = [start.getFullYear() - 1, start.getFullYear(), start.getFullYear() + 1];

  return events
    .flatMap((event): DisplayEvent[] => {
      if (!event.recurringYearly) {
        return [{ ...event, displayDate: parseDate(event.date) }];
      }

      const baseDate = parseDate(event.date);

      return years.map((year) => ({
        ...event,
        displayDate: new Date(year, baseDate.getMonth(), baseDate.getDate()),
      }));
    })
    .filter((event) => event.displayDate >= start && event.displayDate <= end)
    .sort((first, second) => first.displayDate.getTime() - second.displayDate.getTime());
}

export default function CompactAgendaPanel() {
  const [weekStart, setWeekStart] = useState(weekStartForDate);
  const [events, setEvents] = useState<TeamAgendaEvent[]>([]);
  const [status, setStatus] = useState("Agenda laden...");

  useEffect(() => {
    let ignoreResult = false;

    async function loadAgenda() {
      try {
        const [wordpressResult, tamigoResult] = await Promise.allSettled([
          fetch(getTeamAgendaUrl(), { cache: "no-store" }),
          fetch("/api/tamigo-employees?view=shop", { cache: "no-store" }),
        ]);

        if (ignoreResult) return;

        const loadedEvents: TeamAgendaEvent[] = [];

        if (wordpressResult.status === "fulfilled" && wordpressResult.value.ok) {
          loadedEvents.push(
            ...normalizeTeamAgenda(await wordpressResult.value.json()).events.filter(
              (event) => event.source !== "tamigo"
            )
          );
        }

        if (tamigoResult.status === "fulfilled" && tamigoResult.value.ok) {
          loadedEvents.push(
            ...normalizeTeamAgenda(await tamigoResult.value.json()).events
          );
        }

        setEvents(loadedEvents);
        setStatus(loadedEvents.length ? "" : "Geen agenda-items gevonden");
      } catch {
        if (!ignoreResult) setStatus("Agenda niet beschikbaar");
      }
    }

    void loadAgenda();

    return () => {
      ignoreResult = true;
    };
  }, []);

  const weekEvents = expandEvents(events, weekStart);

  return (
    <section className="min-w-0 rounded-[0.9rem] border border-[#d9d6d1] bg-[#e8e8e6] p-2 shadow-sm sm:rounded-[1.25rem] sm:p-4">
      <div className="mb-2 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-1 sm:mb-3 sm:gap-3">
        <div>
          <h2 className="winkel-card-heading text-[#1a1815]">
            agenda
          </h2>
          <p className="winkel-meta-label mt-0.5 text-[#2d2a26]/55 sm:mt-1 sm:text-[#2d2a26]/70">
            week {weekNumberForDate(weekStart)}
          </p>
        </div>
        <div className="flex items-center gap-0.5 text-[#050505] sm:gap-2">
          <button
            type="button"
            onClick={() => setWeekStart(addDays(weekStart, -7))}
            aria-label="Vorige week"
            className="flex h-6 w-6 items-center justify-center rounded-full text-2xl font-light leading-none hover:bg-white/75 sm:h-9 sm:w-9 sm:text-4xl"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => setWeekStart(addDays(weekStart, 7))}
            aria-label="Volgende week"
            className="flex h-6 w-6 items-center justify-center rounded-full text-2xl font-light leading-none hover:bg-white/75 sm:h-9 sm:w-9 sm:text-4xl"
          >
            ›
          </button>
        </div>
      </div>

      <div className="min-h-[12rem] rounded-[0.75rem] bg-white/70 p-2 sm:min-h-[17rem] sm:rounded-[1rem] sm:p-4">
        {weekEvents.length ? (
          <div className="space-y-1.5 sm:space-y-3">
            {weekEvents.slice(0, 3).map((event) => (
              <Link
                key={`${event.id}-${dateKey(event.displayDate)}`}
                href="/strik-agenda"
                className="block border-b border-[#d9d6d1] pb-1.5 last:border-b-0 sm:pb-2"
              >
                <p className="text-[0.68rem] font-black leading-tight text-[#1a1815] sm:text-sm">
                  {formatDayLabel(event.displayDate)}
                </p>
                <p className="mt-0.5 text-[0.68rem] leading-snug text-[#2d2a26]/80 sm:text-sm">
                  {event.title}
                </p>
                <p className="mt-0.5 text-[0.55rem] font-black uppercase tracking-[0.1em] text-[#ef5737] sm:mt-1 sm:text-[0.68rem]">
                  {getEventTypeLabel(event.type)} ·{" "}
                  {event.source === "tamigo"
                    ? "Team"
                    : getAudienceLabel(event.audience)}
                </p>
              </Link>
            ))}
          </div>
        ) : (
          <p className="pt-16 text-center text-[0.68rem] font-bold text-[#2d2a26]/45 sm:pt-20 sm:text-sm">
            {status || "Geen agenda-items deze week"}
          </p>
        )}
      </div>
    </section>
  );
}
