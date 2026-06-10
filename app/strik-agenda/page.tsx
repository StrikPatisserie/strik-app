"use client";

import { useEffect, useMemo, useState } from "react";
import { StrikShell } from "../StrikUI";
import {
  TeamAgendaEvent,
  TeamAgendaEventType,
  getAudienceLabel,
  getEventTypeLabel,
  getTeamAgendaUrl,
  normalizeTeamAgenda,
} from "./teamAgendaApi";

type DisplayEvent = TeamAgendaEvent & {
  displayDate: Date;
};

type AgendaView = "today" | "week" | "month" | "all";

const viewOptions: { value: AgendaView; label: string }[] = [
  { value: "today", label: "Vandaag" },
  { value: "week", label: "Deze week" },
  { value: "month", label: "Komende maand" },
  { value: "all", label: "Volledige agenda" },
];

const typeClasses: Record<TeamAgendaEventType, string> = {
  event: "bg-[#dce8d6] text-[#2d3f29]",
  holiday: "bg-[#f1d28f] text-[#4a3711]",
  training: "bg-[#dbe9ee] text-[#243c46]",
  closing: "bg-[#f3d5cd] text-[#6b3026]",
  birthday: "bg-[#f8e1ea] text-[#6a2b43]",
  anniversary: "bg-[#eef3ea] text-[#2d3f29]",
};

function parseDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, (month || 1) - 1, day || 1);
  date.setHours(0, 0, 0, 0);

  return date;
}

function formatDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return today;
}

function formatMonth(date: Date) {
  return date.toLocaleDateString("nl-NL", {
    month: "long",
    year: "numeric",
  });
}

function formatDay(date: Date) {
  return date.toLocaleDateString("nl-NL", {
    weekday: "short",
    day: "numeric",
  });
}

function addDaysToDate(date: Date, amount: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  next.setHours(0, 0, 0, 0);
  return next;
}

function expandUpcomingEvents(events: TeamAgendaEvent[]) {
  const today = getToday();
  const horizon = new Date(today);
  horizon.setDate(horizon.getDate() + 370);

  return events
    .flatMap((event): DisplayEvent[] => {
      if (!event.recurringYearly) {
        return [{ ...event, displayDate: parseDate(event.date) }];
      }

      const baseDate = parseDate(event.date);
      const years = [
        today.getFullYear() - 1,
        today.getFullYear(),
        today.getFullYear() + 1,
      ];

      return years.map((year) => ({
        ...event,
        displayDate: new Date(year, baseDate.getMonth(), baseDate.getDate()),
      }));
    })
    .filter((event) => event.displayDate >= today && event.displayDate <= horizon)
    .sort((a, b) => a.displayDate.getTime() - b.displayDate.getTime());
}

function groupByDate(events: DisplayEvent[]) {
  return events.reduce<Record<string, DisplayEvent[]>>((acc, event) => {
    const key = formatDateKey(event.displayDate);
    if (!acc[key]) acc[key] = [];
    acc[key].push(event);

    return acc;
  }, {});
}

async function fetchWordPressAgendaEvents() {
  const res = await fetch(getTeamAgendaUrl(), { cache: "no-store" });
  const data = (await res.json().catch(() => null)) as unknown;

  if (!res.ok) {
    throw new Error("Handmatige agenda-items zijn nog niet beschikbaar.");
  }

  return normalizeTeamAgenda(data).events.filter(
    (event) => event.source !== "tamigo"
  );
}

async function fetchTamigoBirthdayEvents() {
  const res = await fetch("/api/tamigo-employees?view=shop", {
    cache: "no-store",
  });
  const data = (await res.json().catch(() => null)) as unknown;

  if (!res.ok) {
    throw new Error("Tamigo verjaardagen zijn nog niet beschikbaar.");
  }

  return normalizeTeamAgenda(data).events;
}

function EventCard({ event }: { event: DisplayEvent }) {
  return (
    <article className="rounded-[1.1rem] border border-[#e7e0d8] bg-white p-3 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="w-14 shrink-0 rounded-2xl bg-[#f8f6f3] px-2 py-2 text-center">
          <p className="text-[0.68rem] font-bold uppercase text-[#2d2a26]/45">
            {event.displayDate.toLocaleDateString("nl-NL", {
              month: "short",
            })}
          </p>
          <p className="text-xl font-black leading-none">
            {event.displayDate.getDate()}
          </p>
        </div>

        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
            <span
              className={`rounded-full px-2.5 py-1 text-[0.68rem] font-black ${
                typeClasses[event.type]
              }`}
            >
              {getEventTypeLabel(event.type)}
            </span>
            <span className="rounded-full bg-[#f8f6f3] px-2.5 py-1 text-[0.68rem] font-black text-[#2d2a26]/55">
              {event.source === "tamigo"
                ? "Team"
                : getAudienceLabel(event.audience)}
            </span>
          </div>

          <h2 className="text-base font-black leading-tight">{event.title}</h2>
          <p className="mt-1 text-xs font-bold capitalize text-[#2d2a26]/55">
            {formatDay(event.displayDate)}
            {event.recurringYearly ? " · jaarlijks" : ""}
          </p>

          {event.description && (
            <p className="mt-2 rounded-2xl bg-[#f8f6f3] p-2.5 text-sm leading-relaxed text-[#6b645b]">
              {event.description}
            </p>
          )}
        </div>
      </div>
    </article>
  );
}

function isSameDay(a: Date, b: Date) {
  return formatDateKey(a) === formatDateKey(b);
}

export default function StrikAgendaPage() {
  const [events, setEvents] = useState<TeamAgendaEvent[]>([]);
  const [viewMode, setViewMode] = useState<AgendaView>("today");
  const [status, setStatus] = useState("Agenda laden...");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let ignoreResult = false;

    async function loadAgenda() {
      setLoading(true);
      setStatus("Agenda laden...");

      try {
        const [wordpressResult, tamigoResult] = await Promise.allSettled([
          fetchWordPressAgendaEvents(),
          fetchTamigoBirthdayEvents(),
        ]);

        if (ignoreResult) return;

        const wordpressEvents =
          wordpressResult.status === "fulfilled" ? wordpressResult.value : [];
        const tamigoEvents =
          tamigoResult.status === "fulfilled" ? tamigoResult.value : [];

        setEvents([...wordpressEvents, ...tamigoEvents]);

        if (
          wordpressResult.status === "rejected" &&
          tamigoResult.status === "rejected"
        ) {
          setStatus("Kan de Strik agenda niet laden.");
          return;
        }

        if (wordpressResult.status === "rejected") {
          setStatus("Handmatige agenda-items zijn nog niet beschikbaar.");
          return;
        }

        if (tamigoResult.status === "rejected") {
          setStatus("Tamigo verjaardagen zijn nog niet beschikbaar.");
          return;
        }

        setStatus("");
      } catch {
        if (!ignoreResult) {
          setEvents([]);
          setStatus("Kan de Strik agenda niet laden.");
        }
      } finally {
        if (!ignoreResult) {
          setLoading(false);
        }
      }
    }

    loadAgenda();

    return () => {
      ignoreResult = true;
    };
  }, []);

  const upcomingEvents = useMemo(() => expandUpcomingEvents(events), [events]);
  const today = getToday();
  const todayEvents = useMemo(
    () =>
      upcomingEvents.filter((event) => isSameDay(event.displayDate, today)),
    [upcomingEvents, today]
  );
  const weekEvents = useMemo(
    () =>
      upcomingEvents.filter(
        (event) => event.displayDate <= addDaysToDate(today, 6)
      ),
    [upcomingEvents, today]
  );
  const monthEvents = useMemo(
    () =>
      upcomingEvents.filter(
        (event) => event.displayDate <= addDaysToDate(today, 29)
      ),
    [upcomingEvents, today]
  );
  const groupedEvents = useMemo(
    () =>
      upcomingEvents.reduce<Record<string, DisplayEvent[]>>((acc, event) => {
        const key = formatMonth(event.displayDate);
        if (!acc[key]) acc[key] = [];
        acc[key].push(event);

        return acc;
      }, {}),
    [upcomingEvents]
  );

  return (
    <StrikShell>
      <header className="mb-4 border-b border-[#e7e0d8] pb-3">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-[#ef5737]">
          Winkel
        </p>
        <h1 className="mt-1 text-2xl font-black uppercase tracking-[0.12em] text-[#1a1815] sm:text-3xl">
          Agenda
        </h1>
      </header>

      <div className="space-y-4">
        <section className="rounded-[1.25rem] border border-[#e7e0d8] bg-white/85 p-3 shadow-sm">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {viewOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setViewMode(option.value)}
                className={`rounded-2xl px-3 py-2 text-sm font-black transition ${
                  viewMode === option.value
                    ? "bg-[#ef5737] text-white shadow-sm"
                    : "bg-[#f8f6f3] text-[#2d2a26]/70 hover:bg-[#ecf4ed]"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          {(loading || status) && (
            <p className="mt-4 text-sm font-semibold text-[#6b645b]">{status}</p>
          )}
        </section>

        {viewMode === "today" && (
          <section className="space-y-3">
            {todayEvents.length === 0 ? (
              <div className="rounded-[1.1rem] border border-[#e7e0d8] bg-white p-4 text-sm font-bold text-[#6b645b] shadow-sm">
                Geen activiteiten voor vandaag.
              </div>
            ) : (
              <div className="grid gap-3">
                {todayEvents.map((event) => (
                  <EventCard
                    key={`${event.id}-${formatDateKey(event.displayDate)}`}
                    event={event}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {viewMode === "week" && (
          <section className="space-y-3">
            {weekEvents.length === 0 ? (
              <div className="rounded-[1.1rem] border border-[#e7e0d8] bg-white p-4 text-sm font-bold text-[#6b645b] shadow-sm">
                Geen activiteiten deze week.
              </div>
            ) : (
              <div className="grid gap-3">
                {weekEvents.map((event) => (
                  <EventCard
                    key={`${event.id}-${formatDateKey(event.displayDate)}`}
                    event={event}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {viewMode === "month" && (
          <section className="space-y-3">
            {monthEvents.length === 0 ? (
              <div className="rounded-[1.1rem] border border-[#e7e0d8] bg-white p-4 text-sm font-bold text-[#6b645b] shadow-sm">
                Geen activiteiten in de komende maand.
              </div>
            ) : (
              <div className="grid gap-3">
                {monthEvents.map((event) => (
                  <EventCard
                    key={`${event.id}-${formatDateKey(event.displayDate)}`}
                    event={event}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {viewMode === "all" && (
          <section className="space-y-4">
            {Object.entries(groupedEvents).map(([period, items]) => (
              <div key={period} className="space-y-3">
                <div className="rounded-[1.1rem] border border-[#e7e0d8] bg-white p-3 shadow-sm">
                  <h2 className="text-base font-black text-[#1a1815]">{period}</h2>
                </div>
                <div className="grid gap-3">
                  {items.map((event) => (
                    <EventCard
                      key={`${event.id}-${formatDateKey(event.displayDate)}`}
                      event={event}
                    />
                  ))}
                </div>
              </div>
            ))}
          </section>
        )}
      </div>
    </StrikShell>
  );
}
