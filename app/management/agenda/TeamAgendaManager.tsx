"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  TeamAgendaAudience,
  TeamAgendaData,
  TeamAgendaEvent,
  TeamAgendaEventType,
  createTeamAgendaId,
  getEmptyTeamAgenda,
  getTeamAgendaUrl,
  normalizeTeamAgenda,
  teamAgendaAudiences,
  teamAgendaEventTypes,
} from "../../strik-agenda/teamAgendaApi";
import { formatJubileeYears } from "../../strik-agenda/personnelJubilees";

type EventDraft = {
  title: string;
  date: string;
  type: TeamAgendaEventType;
  audience: TeamAgendaAudience;
  description: string;
  recurringYearly: boolean;
};

type ManagementAgendaFilter = "all" | "manual" | "birthday" | "anniversary";

type TamigoEmployeeAgendaResponse = {
  events?: unknown[];
  message?: string;
};

const filterOptions: {
  value: ManagementAgendaFilter;
  label: string;
}[] = [
  { value: "all", label: "Alles" },
  { value: "manual", label: "Strik agenda" },
  { value: "birthday", label: "Verjaardagen" },
  { value: "anniversary", label: "Jubilea" },
];

function getToday() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function emptyDraft(): EventDraft {
  return {
    title: "",
    date: getToday(),
    type: "event",
    audience: "alle",
    description: "",
    recurringYearly: false,
  };
}

function parseLocalDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, (month || 1) - 1, day || 1);
  date.setHours(0, 0, 0, 0);

  return date;
}

function createYearlyDate(year: number, month: number, day: number) {
  if (month === 2 && day === 29) {
    const leapDate = new Date(year, 1, 29);
    leapDate.setHours(0, 0, 0, 0);
    if (leapDate.getMonth() === 1) return leapDate;

    return new Date(year, 1, 28);
  }

  const date = new Date(year, month - 1, day);
  date.setHours(0, 0, 0, 0);

  return date;
}

function getEventDisplayDate(event: TeamAgendaEvent, calendarYear?: number) {
  const sourceDate = parseLocalDate(event.date);

  if (!event.recurringYearly) return sourceDate;

  if (calendarYear) {
    return createYearlyDate(
      calendarYear,
      sourceDate.getMonth() + 1,
      sourceDate.getDate()
    );
  }

  const today = parseLocalDate(getToday());
  let displayDate = createYearlyDate(
    today.getFullYear(),
    sourceDate.getMonth() + 1,
    sourceDate.getDate()
  );

  if (displayDate < today) {
    displayDate = createYearlyDate(
      today.getFullYear() + 1,
      sourceDate.getMonth() + 1,
      sourceDate.getDate()
    );
  }

  return displayDate;
}

function getDaysUntilEvent(event: TeamAgendaEvent) {
  const today = parseLocalDate(getToday());
  const millisecondsPerDay = 24 * 60 * 60 * 1000;

  return Math.round(
    (getEventDisplayDate(event).getTime() - today.getTime()) /
      millisecondsPerDay
  );
}

function formatEventDate(event: TeamAgendaEvent, calendarYear: number) {
  const date = getEventDisplayDate(event, calendarYear);

  return date.toLocaleDateString("nl-NL", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function eventBelongsToYear(event: TeamAgendaEvent, calendarYear: number) {
  const displayDate = getEventDisplayDate(event, calendarYear);

  if (!event.recurringYearly && displayDate.getFullYear() !== calendarYear) {
    return false;
  }

  if (event.type === "anniversary" && event.startDate) {
    return calendarYear >= parseLocalDate(event.startDate).getFullYear() + 1;
  }

  return true;
}

function getAnniversaryYearsForYear(
  event: TeamAgendaEvent,
  calendarYear: number
) {
  if (event.type !== "anniversary") return undefined;
  if (!event.recurringYearly) return event.anniversaryYears;

  if (event.startDate) {
    return calendarYear - parseLocalDate(event.startDate).getFullYear();
  }

  if (event.occurrenceDate && typeof event.anniversaryYears === "number") {
    return (
      event.anniversaryYears +
      calendarYear -
      parseLocalDate(event.occurrenceDate).getFullYear()
    );
  }

  return event.anniversaryYears;
}

function getEventDisplayTitle(event: TeamAgendaEvent, calendarYear: number) {
  const years = getAnniversaryYearsForYear(event, calendarYear);
  if (!years || years < 1) return event.title;

  const employeeName =
    event.employeeName?.trim() ||
    event.title.replace(/\s+\d+(?:[,.]5)?\s+jaar\s+bij\s+Strik.*$/i, "").trim();

  return `${employeeName} ${formatJubileeYears(years)} jaar bij Strik`;
}

function formatUpdatedAt(value?: string) {
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

function sortEvents(events: TeamAgendaEvent[], calendarYear?: number) {
  return [...events].sort((a, b) => {
    const dateDiff =
      getEventDisplayDate(a, calendarYear).getTime() -
      getEventDisplayDate(b, calendarYear).getTime();
    if (dateDiff !== 0) return dateDiff;

    return a.title.localeCompare(b.title);
  });
}

async function fetchManualAgenda() {
  const res = await fetch(getTeamAgendaUrl(), { cache: "no-store" });
  const data = (await res.json().catch(() => null)) as unknown;

  if (!res.ok) {
    throw new Error("WordPress agenda is nog niet beschikbaar.");
  }

  return normalizeTeamAgenda(data);
}

async function fetchTamigoAgendaEvents() {
  const res = await fetch("/api/tamigo-employees?view=management", {
    cache: "no-store",
  });
  const data = (await res.json().catch(() => null)) as
    | TamigoEmployeeAgendaResponse
    | null;

  if (!res.ok) {
    throw new Error(
      data?.message || "Tamigo-events zijn tijdelijk niet beschikbaar."
    );
  }

  return normalizeTeamAgenda({ events: data?.events || [] }).events.filter(
    (event) => event.source === "tamigo"
  );
}

async function fetchDriveAgendaEvents() {
  const res = await fetch("/api/personnel-sheet-agenda", {
    cache: "no-store",
  });
  const data = (await res.json().catch(() => null)) as
    | TamigoEmployeeAgendaResponse
    | null;

  if (!res.ok) {
    throw new Error(
      data?.message || "Drive personeelslijst is tijdelijk niet beschikbaar."
    );
  }

  return normalizeTeamAgenda({ events: data?.events || [] }).events.filter(
    (event) => event.source === "sheet"
  );
}

export default function TeamAgendaManager() {
  const [agenda, setAgenda] = useState<TeamAgendaData>(getEmptyTeamAgenda);
  const [tamigoEvents, setTamigoEvents] = useState<TeamAgendaEvent[]>([]);
  const [driveEvents, setDriveEvents] = useState<TeamAgendaEvent[]>([]);
  const [draft, setDraft] = useState<EventDraft>(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [filter, setFilter] = useState<ManagementAgendaFilter>("all");
  const [calendarYear, setCalendarYear] = useState(
    () => new Date().getFullYear()
  );
  const [status, setStatus] = useState("Agenda laden...");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [manualAgendaAvailable, setManualAgendaAvailable] = useState(true);

  const combinedEvents = useMemo(
    () => [...agenda.events, ...tamigoEvents, ...driveEvents],
    [agenda.events, driveEvents, tamigoEvents]
  );
  const visibleEvents = useMemo(() => {
    const filteredEvents =
      filter === "manual"
        ? agenda.events
        : filter === "birthday"
        ? combinedEvents.filter((event) => event.type === "birthday")
        : filter === "anniversary"
        ? combinedEvents.filter((event) => event.type === "anniversary")
        : combinedEvents;

    return sortEvents(
      filteredEvents.filter((event) =>
        eventBelongsToYear(event, calendarYear)
      ),
      calendarYear
    );
  }, [agenda.events, calendarYear, combinedEvents, filter]);
  const upcomingTamigoCount = useMemo(
    () =>
      [...tamigoEvents, ...driveEvents].filter((event) => {
        const daysUntil = getDaysUntilEvent(event);

        return daysUntil >= 0 && daysUntil <= 7;
      }).length,
    [driveEvents, tamigoEvents]
  );

  const loadAgenda = useCallback(async () => {
    setLoading(true);
    setStatus("Agenda laden...");

    const [manualResult, tamigoResult, driveResult] = await Promise.allSettled([
      fetchManualAgenda(),
      fetchTamigoAgendaEvents(),
      fetchDriveAgendaEvents(),
    ]);
    const statusMessages: string[] = [];

    if (manualResult.status === "fulfilled") {
      setAgenda(manualResult.value);
      setManualAgendaAvailable(true);
    } else {
      setAgenda(getEmptyTeamAgenda());
      setManualAgendaAvailable(false);
      statusMessages.push(
        "Handmatige agenda-items zijn tijdelijk niet beschikbaar."
      );
    }

    if (tamigoResult.status === "fulfilled") {
      setTamigoEvents(tamigoResult.value);
    } else {
      setTamigoEvents([]);
      statusMessages.push(
        "Tamigo-verjaardagen en jubilea zijn tijdelijk niet beschikbaar."
      );
    }

    if (driveResult.status === "fulfilled") {
      setDriveEvents(driveResult.value);
    } else {
      setDriveEvents([]);
      statusMessages.push(
        "Drive-personeelslijst is tijdelijk niet beschikbaar."
      );
    }

    setStatus(statusMessages.join(" "));
    setLoading(false);
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      loadAgenda();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadAgenda]);

  async function saveAgenda(nextAgenda: TeamAgendaData) {
    if (!manualAgendaAvailable) {
      setStatus("Haal de handmatige agenda eerst opnieuw op.");
      return false;
    }

    setSaving(true);
    setStatus("Opslaan...");

    try {
      const res = await fetch(getTeamAgendaUrl(), {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(nextAgenda),
      });

      const data = (await res.json().catch(() => null)) as unknown;

      if (!res.ok) {
        setStatus("Opslaan in WordPress lukt nog niet.");
        return false;
      }

      setAgenda(normalizeTeamAgenda(data));
      setManualAgendaAvailable(true);
      setStatus("Opgeslagen.");
      return true;
    } catch {
      setStatus("Kan geen verbinding maken met WordPress.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  function updateDraft<K extends keyof EventDraft>(
    key: K,
    value: EventDraft[K]
  ) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function resetDraft() {
    setDraft(emptyDraft());
    setEditingId(null);
  }

  function openDraftForm() {
    resetDraft();
    setFormOpen(true);
  }

  function closeDraftForm() {
    resetDraft();
    setFormOpen(false);
  }

  async function submitDraft() {
    const title = draft.title.trim();
    const date = draft.date.trim();

    if (!title || !date) {
      setStatus("Vul minimaal een titel en datum in.");
      return;
    }

    if (!manualAgendaAvailable) {
      setStatus("Haal de handmatige agenda eerst opnieuw op.");
      return;
    }

    const now = new Date().toISOString();
    const nextEvent: TeamAgendaEvent = {
      id: editingId || createTeamAgendaId(),
      title,
      date,
      type: draft.type,
      audience: draft.audience,
      description: draft.description.trim(),
      recurringYearly: draft.recurringYearly,
      source: "manual",
      createdAt:
        agenda.events.find((event) => event.id === editingId)?.createdAt ||
        now,
      updatedAt: now,
    };
    const nextAgenda = {
      ...agenda,
      events: editingId
        ? agenda.events.map((event) =>
            event.id === editingId ? nextEvent : event
          )
        : [...agenda.events, nextEvent],
    };
    const saved = await saveAgenda(nextAgenda);

    if (saved) {
      closeDraftForm();
    }
  }

  function editEvent(event: TeamAgendaEvent) {
    if (event.source !== "manual") return;

    setFormOpen(true);
    setEditingId(event.id);
    setDraft({
      title: event.title,
      date: event.date,
      type: event.type,
      audience: event.audience,
      description: event.description,
      recurringYearly: event.recurringYearly,
    });
  }

  async function deleteEvent(id: string) {
    const nextAgenda = {
      ...agenda,
      events: agenda.events.filter((event) => event.id !== id),
    };
    const saved = await saveAgenda(nextAgenda);

    if (saved && editingId === id) {
      closeDraftForm();
    }
  }

  return (
    <div className="space-y-2">
      <section className="rounded-2xl border border-[#e7e0d8] bg-white/88 p-2 shadow-sm">
        <div className="grid grid-cols-2 gap-1 text-center sm:grid-cols-4">
          <div className="flex min-h-8 items-center justify-center gap-1.5 rounded-lg bg-[#eef3ea] px-1.5 py-1">
            <p className="text-sm font-black leading-none">{agenda.events.length}</p>
            <p className="text-[0.52rem] font-bold leading-none text-[#2d2a26]/55">
              Strik agenda
            </p>
          </div>
          <div className="flex min-h-8 items-center justify-center gap-1.5 rounded-lg bg-[#f8e1ea] px-1.5 py-1">
            <p className="text-sm font-black leading-none">
              {
                [...tamigoEvents, ...driveEvents].filter(
                  (event) => event.type === "birthday"
                ).length
              }
            </p>
            <p className="text-[0.52rem] font-bold leading-none text-[#2d2a26]/55">
              Verjaardagen
            </p>
          </div>
          <div className="flex min-h-8 items-center justify-center gap-1.5 rounded-lg bg-[#eef3ea] px-1.5 py-1">
            <p className="text-sm font-black leading-none">
              {
                [...tamigoEvents, ...driveEvents].filter(
                  (event) => event.type === "anniversary"
                ).length
              }
            </p>
            <p className="text-[0.52rem] font-bold leading-none text-[#2d2a26]/55">
              Jubilea
            </p>
          </div>
          <div className="flex min-h-8 items-center justify-center gap-1.5 rounded-lg bg-[#f1d28f]/60 px-1.5 py-1">
            <p className="text-sm font-black leading-none">{upcomingTamigoCount}</p>
            <p className="text-[0.52rem] font-bold leading-none text-[#2d2a26]/55">
              Binnen 7 dagen
            </p>
          </div>
        </div>

        {(loading || status) && (
          <div className="mt-1 flex items-center justify-between gap-3 px-0.5 text-[0.52rem] font-semibold text-gray-500">
            <span>{loading ? "Laden..." : status}</span>
            {agenda.updatedAt && <span>{formatUpdatedAt(agenda.updatedAt)}</span>}
          </div>
        )}

        <div className="mt-1 grid grid-cols-[minmax(0,1fr)_auto] gap-1 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
          <div className="col-span-2 grid grid-cols-4 gap-px rounded-lg bg-[#f8f6f3] p-px sm:col-span-1">
            {filterOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setFilter(option.value)}
                className={`min-h-8 rounded-md px-1.5 py-1 text-[0.58rem] font-black transition ${
                  filter === option.value
                    ? "bg-[#c3d3bc] text-[#2d2a26] shadow-sm"
                    : "text-[#2d2a26]/50"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          <div className="flex h-8 items-center overflow-hidden rounded-lg border border-[#e7e0d8] bg-white">
            <button
              type="button"
              aria-label="Vorig kalenderjaar"
              onClick={() => setCalendarYear((year) => year - 1)}
              className="h-full w-8 text-sm font-black text-[#52654f]"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={() => setCalendarYear(new Date().getFullYear())}
              className="h-full min-w-12 border-x border-[#e7e0d8] px-1.5 text-[0.65rem] font-black tabular-nums text-[#2d2a26]"
              title="Terug naar dit jaar"
            >
              {calendarYear}
            </button>
            <button
              type="button"
              aria-label="Volgend kalenderjaar"
              onClick={() => setCalendarYear((year) => year + 1)}
              className="h-full w-8 text-sm font-black text-[#52654f]"
            >
              ›
            </button>
          </div>
          <button
            type="button"
            onClick={formOpen ? closeDraftForm : openDraftForm}
            aria-label={
              formOpen ? "Agenda-item toevoegen sluiten" : "Agenda-item toevoegen"
            }
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#c3d3bc] text-base font-black leading-none text-[#2d2a26] shadow-sm active:scale-[0.98]"
          >
            {formOpen ? "x" : "+"}
          </button>
        </div>
      </section>

      {formOpen && (
          <section className="rounded-[1.5rem] border border-[#e7e0d8] bg-white/85 p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-base font-black">
                {editingId ? "Agenda-item wijzigen" : "Agenda-item toevoegen"}
              </h3>
              <button
                type="button"
                onClick={closeDraftForm}
                className="rounded-full bg-[#f8f6f3] px-3 py-1.5 text-sm font-black text-[#2d2a26]/55"
              >
                Sluit
              </button>
            </div>

            <div className="mt-3 space-y-2">
              <input
                value={draft.title}
                onChange={(event) => updateDraft("title", event.target.value)}
                placeholder="Titel"
                className="w-full rounded-xl border border-[#e7e0d8] bg-white px-3 py-2.5 text-sm"
              />

              <input
                type="date"
                value={draft.date}
                onChange={(event) => updateDraft("date", event.target.value)}
                className="w-full rounded-xl border border-[#e7e0d8] bg-white px-3 py-2.5 text-sm"
              />

              <div className="grid gap-2 sm:grid-cols-2">
                <select
                  value={draft.type}
                  onChange={(event) =>
                    updateDraft("type", event.target.value as TeamAgendaEventType)
                  }
                  className="w-full rounded-xl border border-[#e7e0d8] bg-white px-3 py-2.5 text-sm"
                >
                  {teamAgendaEventTypes.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>

                <select
                  value={draft.audience}
                  onChange={(event) =>
                    updateDraft(
                      "audience",
                      event.target.value as TeamAgendaAudience
                    )
                  }
                  className="w-full rounded-xl border border-[#e7e0d8] bg-white px-3 py-2.5 text-sm"
                >
                  {teamAgendaAudiences.map((audience) => (
                    <option key={audience.value} value={audience.value}>
                      {audience.label}
                    </option>
                  ))}
                </select>
              </div>

              <textarea
                value={draft.description}
                onChange={(event) =>
                  updateDraft("description", event.target.value)
                }
                placeholder="Omschrijving"
                className="min-h-20 w-full rounded-xl border border-[#e7e0d8] bg-white px-3 py-2.5 text-sm"
              />

              <label className="flex items-center gap-2 rounded-xl border border-[#e7e0d8] bg-[#f8f6f3] px-3 py-2.5 text-sm font-semibold">
                <input
                  type="checkbox"
                  checked={draft.recurringYearly}
                  onChange={(event) =>
                    updateDraft("recurringYearly", event.target.checked)
                  }
                  className="h-4 w-4"
                />
                Jaarlijks terugkerend
              </label>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={submitDraft}
                  disabled={saving || loading || !manualAgendaAvailable}
                  className="min-w-0 flex-1 rounded-full bg-[#c3d3bc] px-4 py-3 text-sm font-black disabled:opacity-50"
                >
                  {saving
                    ? "Opslaan..."
                    : editingId
                    ? "Wijziging opslaan"
                    : "Toevoegen en opslaan"}
                </button>

                {editingId && (
                  <button
                    type="button"
                    onClick={closeDraftForm}
                    className="rounded-full bg-[#f8f6f3] px-4 py-3 text-sm font-black text-gray-500"
                  >
                    Annuleer
                  </button>
                )}
              </div>
            </div>
          </section>
        )}

      <section className="space-y-1">
        <div className="flex items-center justify-between gap-3 px-1 text-[0.55rem] font-black uppercase tracking-[0.07em] text-[#52654f]">
          <span>
            {filterOptions.find((option) => option.value === filter)?.label} · {calendarYear}
          </span>
          <span>{visibleEvents.length} items</span>
        </div>

        {visibleEvents.length === 0 ? (
          <div className="rounded-lg bg-white/80 px-2.5 py-3 text-xs text-gray-600 shadow-sm">
            Geen agenda-items gevonden in {calendarYear}.
          </div>
        ) : (
          visibleEvents.map((event) => {
            const eventDate = getEventDisplayDate(event, calendarYear);
            const isPast = eventDate < parseLocalDate(getToday());

            return (
              <article
                key={event.id}
                className={`rounded-md border px-2 py-1 shadow-sm ${
                  event.type === "anniversary"
                    ? isPast
                      ? "border-[#d8ddd4] bg-white/72"
                      : "border-[#c3d3bc] bg-[#f6faf4]"
                    : "border-[#e7e0d8] bg-white"
                }`}
              >
                <div className="grid min-h-7 grid-cols-[6rem_1fr] items-center gap-1.5 sm:grid-cols-[7.1rem_1fr_auto]">
                  <p className="flex items-center gap-1 text-[0.58rem] font-black capitalize leading-none text-[#2d2a26]/55">
                    <span>{formatEventDate(event, calendarYear)}</span>
                    {isPast && (
                      <span className="text-[0.43rem] font-bold uppercase tracking-[0.03em] text-[#9a8d81]">
                        geweest
                      </span>
                    )}
                  </p>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-black leading-none text-[#1a1815]">
                      {getEventDisplayTitle(event, calendarYear)}
                    </p>
                  </div>

                  {event.source === "manual" && (
                    <div className="col-span-2 flex gap-1 sm:col-span-1">
                      <button
                        type="button"
                        onClick={() => editEvent(event)}
                        className="rounded bg-white px-1.5 py-0.5 text-[0.52rem] font-black text-[#24551d]"
                      >
                        Wijzig
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteEvent(event.id)}
                        className="rounded bg-white px-1.5 py-0.5 text-[0.52rem] font-black text-[#d75a48]"
                      >
                        Verwijder
                      </button>
                    </div>
                  )}
                </div>
              </article>
            );
          })
        )}
      </section>
    </div>
  );
}
