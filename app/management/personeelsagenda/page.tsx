"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { StrikPageHeader, StrikShell, strikIcons } from "../../StrikUI";

type PersonnelAgendaEvent = {
  id: string;
  type: "birthday" | "anniversary";
  employeeName: string;
  title: string;
  date: string;
  occurrenceDate: string;
  daysUntil: number;
  month: number;
  day: number;
  years?: number;
  source: "tamigo";
};

type PersonnelAgendaResponse = {
  personnelEvents?: PersonnelAgendaEvent[];
  birthdays?: PersonnelAgendaEvent[];
  anniversaries?: PersonnelAgendaEvent[];
  upcomingWithinWeek?: PersonnelAgendaEvent[];
  activeEmployeeCount?: number;
  generatedAt?: string;
  stats?: {
    birthdays?: number;
    anniversaries?: number;
    upcomingWithinWeek?: number;
  };
  message?: string;
};

type PersonnelAgendaFilter = "week" | "birthday" | "anniversary";

const filterOptions: {
  value: PersonnelAgendaFilter;
  label: string;
}[] = [
  { value: "week", label: "Binnen 7 dagen" },
  { value: "birthday", label: "Verjaardagen" },
  { value: "anniversary", label: "Jubilea" },
];

const eventTypeClasses = {
  birthday: "bg-[#f8e1ea] text-[#6a2b43]",
  anniversary: "bg-[#eef3ea] text-[#2d3f29]",
};

function parseDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, (month || 1) - 1, day || 1);
  date.setHours(0, 0, 0, 0);

  return date;
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
    month: "short",
  });
}

function formatGeneratedAt(value?: string) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleString("nl-NL", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getEventTypeLabel(type: PersonnelAgendaEvent["type"]) {
  return type === "birthday" ? "Verjaardag" : "Jubileum";
}

function getRelativeLabel(daysUntil: number) {
  if (daysUntil === 0) return "Vandaag";
  if (daysUntil === 1) return "Morgen";

  return `Over ${daysUntil} dagen`;
}

function sortEvents(events: PersonnelAgendaEvent[]) {
  return [...events].sort((a, b) => {
    const dateDiff = a.occurrenceDate.localeCompare(b.occurrenceDate);
    if (dateDiff !== 0) return dateDiff;

    return a.employeeName.localeCompare(b.employeeName);
  });
}

function groupByMonth(events: PersonnelAgendaEvent[]) {
  return events.reduce<Record<string, PersonnelAgendaEvent[]>>((acc, event) => {
    const month = formatMonth(parseDate(event.occurrenceDate));
    if (!acc[month]) acc[month] = [];
    acc[month].push(event);

    return acc;
  }, {});
}

function PersonnelEventCard({ event }: { event: PersonnelAgendaEvent }) {
  const date = parseDate(event.occurrenceDate);

  return (
    <article className="rounded-[1.5rem] border border-[#e7e0d8] bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="w-16 shrink-0 rounded-2xl bg-[#f8f6f3] px-2 py-3 text-center">
          <p className="text-xs font-bold uppercase text-[#2d2a26]/45">
            {date.toLocaleDateString("nl-NL", { month: "short" })}
          </p>
          <p className="text-2xl font-bold leading-none">{date.getDate()}</p>
        </div>

        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-3 py-1 text-xs font-bold ${
                eventTypeClasses[event.type]
              }`}
            >
              {getEventTypeLabel(event.type)}
            </span>
            <span className="rounded-full bg-[#f8f6f3] px-3 py-1 text-xs font-bold text-[#2d2a26]/55">
              {getRelativeLabel(event.daysUntil)}
            </span>
            {event.type === "anniversary" && event.years ? (
              <span className="rounded-full bg-[#f1d28f]/60 px-3 py-1 text-xs font-bold text-[#4a3711]">
                {event.years} jaar
              </span>
            ) : null}
          </div>

          <h2 className="text-lg font-bold leading-tight">{event.title}</h2>
          <p className="mt-1 text-sm font-semibold capitalize text-[#2d2a26]/55">
            {formatDay(date)}
          </p>
        </div>
      </div>
    </article>
  );
}

export default function ManagementPersonnelAgendaPage() {
  const [birthdays, setBirthdays] = useState<PersonnelAgendaEvent[]>([]);
  const [anniversaries, setAnniversaries] = useState<PersonnelAgendaEvent[]>([]);
  const [upcomingWithinWeek, setUpcomingWithinWeek] = useState<
    PersonnelAgendaEvent[]
  >([]);
  const [activeEmployeeCount, setActiveEmployeeCount] = useState(0);
  const [generatedAt, setGeneratedAt] = useState("");
  const [filter, setFilter] = useState<PersonnelAgendaFilter>("week");
  const [status, setStatus] = useState("Personeelsagenda laden...");
  const [loading, setLoading] = useState(true);

  const loadPersonnelAgenda = useCallback(async () => {
    setLoading(true);
    setStatus("Personeelsagenda laden...");

    try {
      const res = await fetch("/api/tamigo-employees?view=management", {
        cache: "no-store",
      });
      const data = (await res.json().catch(() => null)) as
        | PersonnelAgendaResponse
        | null;

      if (!res.ok || !data) {
        setStatus(data?.message || "Kan de personeelsagenda niet laden.");
        setBirthdays([]);
        setAnniversaries([]);
        setUpcomingWithinWeek([]);
        return;
      }

      setBirthdays(sortEvents(data.birthdays || []));
      setAnniversaries(sortEvents(data.anniversaries || []));
      setUpcomingWithinWeek(sortEvents(data.upcomingWithinWeek || []));
      setActiveEmployeeCount(data.activeEmployeeCount || 0);
      setGeneratedAt(data.generatedAt || "");
      setStatus("");
    } catch {
      setStatus("Kan geen verbinding maken met de Tamigo-koppeling.");
      setBirthdays([]);
      setAnniversaries([]);
      setUpcomingWithinWeek([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      loadPersonnelAgenda();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadPersonnelAgenda]);

  const visibleEvents = useMemo(() => {
    if (filter === "birthday") return birthdays;
    if (filter === "anniversary") return anniversaries;

    return upcomingWithinWeek;
  }, [anniversaries, birthdays, filter, upcomingWithinWeek]);
  const visibleEventsByMonth = useMemo(
    () => groupByMonth(visibleEvents),
    [visibleEvents]
  );
  const emptyText =
    filter === "week"
      ? "Geen verjaardagen of jubilea binnen 7 dagen."
      : filter === "birthday"
      ? "Geen verjaardagen gevonden."
      : "Geen jubilea gevonden.";

  return (
    <StrikShell wide>
      <StrikPageHeader
        title="Personeelsagenda"
        description="Verjaardagen en jubilea vanuit Tamigo."
        icon={strikIcons.strikAgenda}
        kicker="Management"
        tone="honey"
      />

      <div className="space-y-5">
        <section className="rounded-[1.75rem] border border-[#e7e0d8] bg-white/85 p-5 shadow-sm">
          <div className="grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
            <div className="rounded-2xl bg-[#eef3ea] p-3">
              <p className="text-2xl font-bold">{activeEmployeeCount}</p>
              <p className="text-xs font-semibold text-[#2d2a26]/55">
                Actief
              </p>
            </div>
            <div className="rounded-2xl bg-[#f8e1ea] p-3">
              <p className="text-2xl font-bold">{birthdays.length}</p>
              <p className="text-xs font-semibold text-[#2d2a26]/55">
                Verjaardagen
              </p>
            </div>
            <div className="rounded-2xl bg-[#eef3ea] p-3">
              <p className="text-2xl font-bold">{anniversaries.length}</p>
              <p className="text-xs font-semibold text-[#2d2a26]/55">
                Jubilea
              </p>
            </div>
            <div className="rounded-2xl bg-[#f1d28f]/60 p-3">
              <p className="text-2xl font-bold">{upcomingWithinWeek.length}</p>
              <p className="text-xs font-semibold text-[#2d2a26]/55">
                Binnen 7 dagen
              </p>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between gap-3 text-xs font-semibold text-gray-500">
            <span>
              {loading ? "Laden..." : status || "Alles bijgewerkt."}
            </span>
            {generatedAt && <span>{formatGeneratedAt(generatedAt)}</span>}
          </div>

          <button
            type="button"
            onClick={loadPersonnelAgenda}
            disabled={loading}
            className="mt-4 w-full rounded-full bg-[#c3d3bc] p-4 font-bold disabled:opacity-50"
          >
            {loading ? "Laden..." : "Opnieuw ophalen"}
          </button>
        </section>

        <section className="rounded-[1.75rem] border border-[#e7e0d8] bg-white/85 p-3 shadow-sm">
          <div className="grid grid-cols-3 gap-2 rounded-full bg-[#f8f6f3] p-1">
            {filterOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setFilter(option.value)}
                className={`rounded-full px-3 py-3 text-sm font-bold transition ${
                  filter === option.value
                    ? "bg-[#c3d3bc] text-[#2d2a26] shadow-sm"
                    : "text-[#2d2a26]/50"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </section>

        {visibleEvents.length === 0 && !loading ? (
          <div className="rounded-[1.5rem] border border-[#e7e0d8] bg-white p-5 text-sm text-gray-600 shadow-sm">
            {emptyText}
          </div>
        ) : null}

        {visibleEvents.length > 0 ? (
          <div className="space-y-6">
            {Object.entries(visibleEventsByMonth).map(([month, items]) => (
              <section key={month}>
                <h2 className="mb-3 text-base font-bold capitalize">
                  {month}
                </h2>

                <div className="space-y-3">
                  {items.map((event) => (
                    <PersonnelEventCard key={event.id} event={event} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : null}
      </div>
    </StrikShell>
  );
}
