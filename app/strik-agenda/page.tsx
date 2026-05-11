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

export default function StrikAgendaPage() {
  const [events, setEvents] = useState<TeamAgendaEvent[]>([]);
  const [status, setStatus] = useState("Agenda laden...");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let ignoreResult = false;

    async function loadAgenda() {
      setLoading(true);
      setStatus("Agenda laden...");

      try {
        const res = await fetch(getTeamAgendaUrl(), { cache: "no-store" });
        const data = (await res.json().catch(() => null)) as unknown;

        if (ignoreResult) return;

        if (!res.ok) {
          setEvents([]);
          setStatus("Strik agenda is nog niet gekoppeld aan WordPress.");
          return;
        }

        setEvents(normalizeTeamAgenda(data).events);
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
        description="Verjaardagen, jubilea en teamactiviteiten."
        icon={strikIcons.strikAgenda}
        tone="honey"
      />

      <div className="space-y-5">
        <section className="rounded-[1.75rem] border border-[#e7e0d8] bg-white/85 p-5 shadow-sm">
          <div className="grid grid-cols-2 gap-3 text-center">
            <div className="rounded-2xl bg-[#eef3ea] p-4">
              <p className="text-2xl font-bold">{upcomingEvents.length}</p>
              <p className="text-xs font-semibold text-[#2d2a26]/55">
                Komend jaar
              </p>
            </div>
            <div className="rounded-2xl bg-[#f1d28f]/55 p-4">
              <p className="text-2xl font-bold">
                {
                  upcomingEvents.filter(
                    (event) =>
                      formatDateKey(event.displayDate) === formatDateKey(getToday())
                  ).length
                }
              </p>
              <p className="text-xs font-semibold text-[#2d2a26]/55">
                Vandaag
              </p>
            </div>
          </div>

          {(loading || status) && (
            <p className="mt-4 text-sm font-semibold text-gray-500">{status}</p>
          )}
        </section>

        {upcomingEvents.length === 0 && !loading ? (
          <div className="rounded-[1.5rem] border border-[#e7e0d8] bg-white p-5 text-sm text-gray-600 shadow-sm">
            Er staan nog geen teammomenten in de Strik agenda.
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedEvents).map(([month, items]) => (
              <section key={month}>
                <h2 className="mb-3 text-base font-bold capitalize">
                  {month}
                </h2>

                <div className="space-y-3">
                  {items.map((event) => (
                    <article
                      key={`${event.id}-${formatDateKey(event.displayDate)}`}
                      className="rounded-[1.5rem] border border-[#e7e0d8] bg-white p-4 shadow-sm"
                    >
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
                              {getAudienceLabel(event.audience)}
                            </span>
                          </div>

                          <h2 className="text-lg font-bold leading-tight">
                            {event.title}
                          </h2>
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
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </StrikShell>
  );
}
