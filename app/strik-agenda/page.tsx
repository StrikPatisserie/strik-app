"use client";

import { useEffect, useMemo, useState } from "react";
import { StrikShell, strikIcons } from "../StrikUI";
import {
  TeamAgendaEvent,
  TeamAgendaEventType,
  getEventTypeLabel,
  getEventSourceLabel,
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
    throw new Error("Tamigo agenda is nog niet beschikbaar.");
  }

  return normalizeTeamAgenda(data).events;
}

async function fetchDrivePersonnelEvents() {
  const res = await fetch("/api/personnel-sheet-agenda?view=shop", {
    cache: "no-store",
  });
  const data = (await res.json().catch(() => null)) as unknown;

  if (!res.ok) {
    throw new Error("Drive personeelslijst is nog niet beschikbaar.");
  }

  return normalizeTeamAgenda(data).events;
}

function EventCard({ event }: { event: DisplayEvent }) {
  return (
    <article className="rounded-lg border border-[#e7e0d8] bg-white px-2 py-2 shadow-sm sm:px-3">
      <div className="flex items-start gap-2 sm:gap-3">
        <div className="w-10 shrink-0 rounded-lg bg-[#f8f6f3] px-1.5 py-1.5 text-center sm:w-12">
          <p className="text-[0.52rem] font-black uppercase leading-none text-[#2d2a26]/45 sm:text-[0.62rem]">
            {event.displayDate.toLocaleDateString("nl-NL", {
              month: "short",
            })}
          </p>
          <p className="mt-0.5 text-base font-black leading-none sm:text-lg">
            {event.displayDate.getDate()}
          </p>
        </div>

        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-1">
            <span
              className={`rounded-full px-2 py-0.5 text-[0.58rem] font-black sm:text-[0.68rem] ${
                typeClasses[event.type]
              }`}
            >
              {getEventTypeLabel(event.type)}
            </span>
            <span className="rounded-full bg-[#f8f6f3] px-2 py-0.5 text-[0.58rem] font-black text-[#2d2a26]/55 sm:text-[0.68rem]">
              {getEventSourceLabel(event)}
            </span>
          </div>

          <p className="text-sm font-black leading-tight text-[#1a1815] sm:text-base">
            {event.title}
          </p>
          <p className="mt-0.5 text-[0.68rem] font-bold capitalize leading-tight text-[#2d2a26]/55 sm:text-xs">
            {formatDay(event.displayDate)}
            {event.recurringYearly ? " · jaarlijks" : ""}
          </p>

          {event.description && (
            <p className="mt-1.5 rounded-lg bg-[#f8f6f3] px-2 py-1.5 text-xs leading-snug text-[#6b645b] sm:text-sm">
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
        const [wordpressResult, tamigoResult, driveResult] = await Promise.allSettled([
          fetchWordPressAgendaEvents(),
          fetchTamigoBirthdayEvents(),
          fetchDrivePersonnelEvents(),
        ]);

        if (ignoreResult) return;

        const wordpressEvents =
          wordpressResult.status === "fulfilled" ? wordpressResult.value : [];
        const tamigoEvents =
          tamigoResult.status === "fulfilled" ? tamigoResult.value : [];
        const driveEvents =
          driveResult.status === "fulfilled" ? driveResult.value : [];

        setEvents([...wordpressEvents, ...tamigoEvents, ...driveEvents]);

        const statusMessages: string[] = [];

        if (wordpressResult.status === "rejected") {
          statusMessages.push("Handmatige agenda-items zijn nog niet beschikbaar.");
        }

        if (tamigoResult.status === "rejected") {
          statusMessages.push("Tamigo agenda is nog niet beschikbaar.");
        }

        if (driveResult.status === "rejected") {
          statusMessages.push("Drive personeelslijst is nog niet beschikbaar.");
        }

        if (statusMessages.length === 3) {
          setStatus("Kan de Strik agenda niet laden.");
          return;
        }

        setStatus(statusMessages.join(" "));
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
      <header className="mb-3 flex items-center gap-2 sm:mb-4">
        <span
          aria-hidden="true"
          className="block h-[clamp(1rem,4.4vw,1.8rem)] w-[clamp(1rem,4.4vw,1.8rem)] shrink-0 bg-[#ef5737]"
          style={{
            WebkitMask: `url("${strikIcons.agenda}") center / contain no-repeat`,
            mask: `url("${strikIcons.agenda}") center / contain no-repeat`,
          }}
        />
        <h1 className="strik-page-title text-[#ef5737]">
          Agenda
        </h1>
      </header>

      <div className="space-y-2.5 sm:space-y-4">
        <section className="rounded-lg border border-[#e7e0d8] bg-white/85 p-1.5 shadow-sm sm:p-2">
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
            {viewOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setViewMode(option.value)}
                className={`rounded-md px-2 py-1.5 text-[0.68rem] font-black leading-tight transition sm:text-sm ${
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
            <p className="mt-2 px-1 text-xs font-semibold text-[#6b645b]">
              {status}
            </p>
          )}
        </section>

        {viewMode === "today" && (
          <section className="space-y-2">
            {todayEvents.length === 0 ? (
              <div className="rounded-lg border border-[#e7e0d8] bg-white p-3 text-xs font-bold text-[#6b645b] shadow-sm sm:text-sm">
                Geen activiteiten voor vandaag.
              </div>
            ) : (
              <div className="grid gap-2">
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
          <section className="space-y-2">
            {weekEvents.length === 0 ? (
              <div className="rounded-lg border border-[#e7e0d8] bg-white p-3 text-xs font-bold text-[#6b645b] shadow-sm sm:text-sm">
                Geen activiteiten deze week.
              </div>
            ) : (
              <div className="grid gap-2">
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
          <section className="space-y-2">
            {monthEvents.length === 0 ? (
              <div className="rounded-lg border border-[#e7e0d8] bg-white p-3 text-xs font-bold text-[#6b645b] shadow-sm sm:text-sm">
                Geen activiteiten in de komende maand.
              </div>
            ) : (
              <div className="grid gap-2">
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
          <section className="space-y-3">
            {Object.entries(groupedEvents).map(([period, items]) => (
              <div key={period} className="space-y-2">
                <div className="rounded-lg border border-[#e7e0d8] bg-white px-3 py-2 shadow-sm">
                  <p className="text-sm font-black text-[#1a1815] sm:text-base">
                    {period}
                  </p>
                </div>
                <div className="grid gap-2">
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
