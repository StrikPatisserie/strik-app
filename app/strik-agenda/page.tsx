"use client";

import { useEffect, useMemo, useState } from "react";
import { StrikPageHeader, StrikShell, strikIcons } from "../StrikUI";
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

type AgendaView = "dag" | "maand" | "jaar";

const viewOptions: { value: AgendaView; label: string }[] = [
  { value: "dag", label: "Dag" },
  { value: "maand", label: "Maand" },
  { value: "jaar", label: "Jaar" },
];

const weekdayLabels = ["ma", "di", "wo", "do", "vr", "za", "zo"];

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

function addMonths(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function addYears(date: Date, amount: number) {
  return new Date(date.getFullYear() + amount, date.getMonth(), 1);
}

function getMonthGrid(date: Date) {
  const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  const firstWeekdayIndex = (firstDay.getDay() + 6) % 7;
  const cells: (Date | null)[] = Array.from(
    { length: firstWeekdayIndex },
    () => null
  );

  for (let day = 1; day <= lastDay.getDate(); day += 1) {
    cells.push(new Date(date.getFullYear(), date.getMonth(), day));
  }

  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  return cells;
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

function expandEventsForYear(events: TeamAgendaEvent[], year: number) {
  return events
    .flatMap((event): DisplayEvent[] => {
      const baseDate = parseDate(event.date);

      if (event.recurringYearly) {
        return [
          {
            ...event,
            displayDate: new Date(year, baseDate.getMonth(), baseDate.getDate()),
          },
        ];
      }

      if (baseDate.getFullYear() !== year) return [];

      return [{ ...event, displayDate: baseDate }];
    })
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
    <article className="rounded-[1.5rem] border border-[#e7e0d8] bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="w-16 shrink-0 rounded-2xl bg-[#f8f6f3] px-2 py-3 text-center">
          <p className="text-xs font-bold uppercase text-[#2d2a26]/45">
            {event.displayDate.toLocaleDateString("nl-NL", {
              month: "short",
            })}
          </p>
          <p className="text-2xl font-bold leading-none">
            {event.displayDate.getDate()}
          </p>
        </div>

        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-3 py-1 text-xs font-bold ${
                typeClasses[event.type]
              }`}
            >
              {getEventTypeLabel(event.type)}
            </span>
            <span className="rounded-full bg-[#f8f6f3] px-3 py-1 text-xs font-bold text-[#2d2a26]/55">
              {event.source === "tamigo" ? "Team" : getAudienceLabel(event.audience)}
            </span>
          </div>

          <h2 className="text-lg font-bold leading-tight">{event.title}</h2>
          <p className="mt-1 text-sm font-semibold capitalize text-[#2d2a26]/55">
            {formatDay(event.displayDate)}
            {event.recurringYearly ? " · jaarlijks" : ""}
          </p>

          {event.description && (
            <p className="mt-3 rounded-2xl bg-[#f8f6f3] p-3 text-sm leading-relaxed text-gray-600">
              {event.description}
            </p>
          )}
        </div>
      </div>
    </article>
  );
}

export default function StrikAgendaPage() {
  const [events, setEvents] = useState<TeamAgendaEvent[]>([]);
  const [viewMode, setViewMode] = useState<AgendaView>("dag");
  const [periodDate, setPeriodDate] = useState(getToday);
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
  const yearEvents = useMemo(
    () => expandEventsForYear(events, periodDate.getFullYear()),
    [events, periodDate]
  );
  const monthEvents = useMemo(
    () =>
      yearEvents.filter(
        (event) => event.displayDate.getMonth() === periodDate.getMonth()
      ),
    [yearEvents, periodDate]
  );
  const monthEventsByDate = useMemo(() => groupByDate(monthEvents), [monthEvents]);
  const yearEventsByMonth = useMemo(
    () =>
      yearEvents.reduce<Record<number, DisplayEvent[]>>((acc, event) => {
        const month = event.displayDate.getMonth();
        if (!acc[month]) acc[month] = [];
        acc[month].push(event);

        return acc;
      }, {}),
    [yearEvents]
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
      <StrikPageHeader
        title="Strik agenda"
        description="Verjaardagen en teamactiviteiten."
        icon={strikIcons.strikAgenda}
        tone="honey"
      />

      <div className="space-y-5">
        <section className="rounded-[1.75rem] border border-[#e7e0d8] bg-white/85 p-5 shadow-sm">
          <div className="grid grid-cols-3 gap-2 rounded-full bg-[#f8f6f3] p-1">
            {viewOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setViewMode(option.value)}
                className={`rounded-full px-3 py-3 text-sm font-bold transition ${
                  viewMode === option.value
                    ? "bg-[#c3d3bc] text-[#2d2a26] shadow-sm"
                    : "text-[#2d2a26]/50"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          {viewMode !== "dag" && (
            <div className="mt-4 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() =>
                  setPeriodDate((current) =>
                    viewMode === "maand"
                      ? addMonths(current, -1)
                      : addYears(current, -1)
                  )
                }
                className="rounded-full bg-[#f8f6f3] px-4 py-2 text-lg font-bold"
              >
                ←
              </button>

              <p className="text-center text-sm font-bold capitalize">
                {viewMode === "maand"
                  ? formatMonth(periodDate)
                  : periodDate.getFullYear()}
              </p>

              <button
                type="button"
                onClick={() =>
                  setPeriodDate((current) =>
                    viewMode === "maand"
                      ? addMonths(current, 1)
                      : addYears(current, 1)
                  )
                }
                className="rounded-full bg-[#c3d3bc] px-4 py-2 text-lg font-bold"
              >
                →
              </button>
            </div>
          )}

          {(loading || status) && (
            <p className="mt-4 text-sm font-semibold text-gray-500">{status}</p>
          )}
        </section>

        {viewMode === "dag" && upcomingEvents.length === 0 && !loading ? (
          <div className="rounded-[1.5rem] border border-[#e7e0d8] bg-white p-5 text-sm text-gray-600 shadow-sm">
            Er staan nog geen teammomenten in de Strik agenda.
          </div>
        ) : null}

        {viewMode === "dag" && upcomingEvents.length > 0 && (
          <div className="space-y-6">
            {Object.entries(groupedEvents).map(([month, items]) => (
              <section key={month}>
                <h2 className="mb-3 text-base font-bold capitalize">
                  {month}
                </h2>

                <div className="space-y-3">
                  {items.map((event) => (
                    <EventCard
                      key={`${event.id}-${formatDateKey(event.displayDate)}`}
                      event={event}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        {viewMode === "maand" && (
          <div className="space-y-5">
            <section className="rounded-[1.75rem] border border-[#e7e0d8] bg-white p-3 shadow-sm">
              <div className="grid grid-cols-7 gap-1 text-center text-[0.68rem] font-bold uppercase text-[#2d2a26]/45">
                {weekdayLabels.map((weekday) => (
                  <span key={weekday}>{weekday}</span>
                ))}
              </div>

              <div className="mt-2 grid grid-cols-7 gap-1.5">
                {getMonthGrid(periodDate).map((date, index) => {
                  if (!date) {
                    return (
                      <div
                        key={`empty-${index}`}
                        className="min-h-20 rounded-2xl bg-[#f8f6f3]/50"
                      />
                    );
                  }

                  const dateKey = formatDateKey(date);
                  const dayEvents = monthEventsByDate[dateKey] || [];
                  const isToday = dateKey === formatDateKey(getToday());

                  return (
                    <div
                      key={dateKey}
                      className={`min-h-20 rounded-2xl border p-1.5 ${
                        isToday
                          ? "border-[#93b28b] bg-[#eef3ea]"
                          : dayEvents.length > 0
                          ? "border-[#e7e0d8] bg-white"
                          : "border-[#eee7de] bg-[#f8f6f3]"
                      }`}
                    >
                      <p className="text-xs font-bold text-[#2d2a26]/65">
                        {date.getDate()}
                      </p>
                      <div className="mt-1 space-y-1">
                        {dayEvents.slice(0, 2).map((event) => (
                          <p
                            key={event.id}
                            className="truncate rounded-full bg-[#c3d3bc]/60 px-1.5 py-0.5 text-[0.58rem] font-bold leading-tight text-[#2d2a26]"
                          >
                            {event.title}
                          </p>
                        ))}
                        {dayEvents.length > 2 && (
                          <p className="text-[0.58rem] font-bold text-[#2d2a26]/45">
                            +{dayEvents.length - 2}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {monthEvents.length === 0 ? (
              <div className="rounded-[1.5rem] border border-[#e7e0d8] bg-white p-5 text-sm text-gray-600 shadow-sm">
                Geen teammomenten in deze maand.
              </div>
            ) : (
              <section className="space-y-3">
                <h2 className="text-xl font-bold capitalize">
                  {formatMonth(periodDate)}
                </h2>
                {monthEvents.map((event) => (
                  <EventCard
                    key={`${event.id}-${formatDateKey(event.displayDate)}`}
                    event={event}
                  />
                ))}
              </section>
            )}
          </div>
        )}

        {viewMode === "jaar" && (
          <div className="grid gap-3 sm:grid-cols-2">
            {Array.from({ length: 12 }, (_, monthIndex) => {
              const monthDate = new Date(
                periodDate.getFullYear(),
                monthIndex,
                1
              );
              const items = yearEventsByMonth[monthIndex] || [];

              return (
                <section
                  key={monthIndex}
                  className="rounded-[1.5rem] border border-[#e7e0d8] bg-white p-4 shadow-sm"
                >
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="font-bold capitalize">
                      {monthDate.toLocaleDateString("nl-NL", {
                        month: "long",
                      })}
                    </h2>
                    <span className="rounded-full bg-[#f8f6f3] px-3 py-1 text-xs font-bold text-[#2d2a26]/55">
                      {items.length}
                    </span>
                  </div>

                  {items.length === 0 ? (
                    <p className="mt-3 text-sm font-semibold text-gray-400">
                      Geen items
                    </p>
                  ) : (
                    <div className="mt-3 space-y-2">
                      {items.slice(0, 4).map((event) => (
                        <div
                          key={`${event.id}-${formatDateKey(event.displayDate)}`}
                          className="rounded-2xl bg-[#f8f6f3] p-3"
                        >
                          <p className="text-xs font-bold text-[#2d2a26]/45">
                            {event.displayDate.getDate()}{" "}
                            {getEventTypeLabel(event.type)}
                          </p>
                          <p className="mt-0.5 truncate text-sm font-bold">
                            {event.title}
                          </p>
                        </div>
                      ))}
                      {items.length > 4 && (
                        <p className="text-xs font-bold text-[#2d2a26]/45">
                          +{items.length - 4} meer
                        </p>
                      )}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </div>
    </StrikShell>
  );
}
