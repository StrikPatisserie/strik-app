"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  TeamAgendaAudience,
  TeamAgendaData,
  TeamAgendaEvent,
  TeamAgendaEventType,
  createTeamAgendaId,
  getAudienceLabel,
  getEmptyTeamAgenda,
  getEventTypeLabel,
  getTeamAgendaUrl,
  normalizeTeamAgenda,
  teamAgendaAudiences,
  teamAgendaEventTypes,
} from "../../strik-agenda/teamAgendaApi";

type EventDraft = {
  title: string;
  date: string;
  type: TeamAgendaEventType;
  audience: TeamAgendaAudience;
  description: string;
  recurringYearly: boolean;
};

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

function formatDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, (month || 1) - 1, day || 1);

  return date.toLocaleDateString("nl-NL", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
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

function sortEvents(events: TeamAgendaEvent[]) {
  return [...events].sort((a, b) => {
    const dateDiff = a.date.localeCompare(b.date);
    if (dateDiff !== 0) return dateDiff;

    return a.title.localeCompare(b.title);
  });
}

export default function TeamAgendaManager() {
  const [agenda, setAgenda] = useState<TeamAgendaData>(getEmptyTeamAgenda);
  const [draft, setDraft] = useState<EventDraft>(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [status, setStatus] = useState("Agenda laden...");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const sortedEvents = useMemo(() => sortEvents(agenda.events), [agenda.events]);

  const loadAgenda = useCallback(async () => {
    setLoading(true);
    setStatus("Agenda laden...");

    try {
      const res = await fetch(getTeamAgendaUrl(), { cache: "no-store" });
      const data = (await res.json().catch(() => null)) as unknown;

      if (!res.ok) {
        setAgenda(getEmptyTeamAgenda());
        setStatus("WordPress agenda is nog niet beschikbaar.");
        return;
      }

      setAgenda(normalizeTeamAgenda(data));
      setDirty(false);
      setStatus("");
    } catch {
      setAgenda(getEmptyTeamAgenda());
      setStatus("Kan geen verbinding maken met WordPress.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      loadAgenda();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadAgenda]);

  async function saveAgenda() {
    setSaving(true);
    setStatus("Opslaan...");

    try {
      const res = await fetch(getTeamAgendaUrl(), {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(agenda),
      });

      const data = (await res.json().catch(() => null)) as unknown;

      if (!res.ok) {
        setStatus("Opslaan in WordPress lukt nog niet.");
        return;
      }

      setAgenda(normalizeTeamAgenda(data));
      setDirty(false);
      setStatus("Opgeslagen.");
    } catch {
      setStatus("Kan geen verbinding maken met WordPress.");
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

  function submitDraft() {
    const title = draft.title.trim();
    const date = draft.date.trim();

    if (!title || !date) {
      setStatus("Vul minimaal een titel en datum in.");
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

    setAgenda((current) => ({
      ...current,
      events: editingId
        ? current.events.map((event) =>
            event.id === editingId ? nextEvent : event
          )
        : [...current.events, nextEvent],
    }));
    setDirty(true);
    setStatus("Wijzigingen staan klaar om op te slaan.");
    resetDraft();
  }

  function editEvent(event: TeamAgendaEvent) {
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

  function deleteEvent(id: string) {
    setAgenda((current) => ({
      ...current,
      events: current.events.filter((event) => event.id !== id),
    }));
    setDirty(true);

    if (editingId === id) {
      resetDraft();
    }

    setStatus("Wijzigingen staan klaar om op te slaan.");
  }

  return (
    <div className="space-y-5">
      <section className="rounded-[1.75rem] border border-[#e7e0d8] bg-white/85 p-5 shadow-sm">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-2xl bg-[#eef3ea] p-3">
            <p className="text-2xl font-bold">{agenda.events.length}</p>
            <p className="text-xs font-semibold text-[#2d2a26]/55">Items</p>
          </div>
          <div className="rounded-2xl bg-[#f1d28f]/60 p-3">
            <p className="text-2xl font-bold">
              {agenda.events.filter((event) => event.recurringYearly).length}
            </p>
            <p className="text-xs font-semibold text-[#2d2a26]/55">
              Jaarlijks
            </p>
          </div>
          <div className="rounded-2xl bg-[#dbe9ee] p-3">
            <p className="text-2xl font-bold">
              {agenda.events.filter((event) => event.source === "tamigo").length}
            </p>
            <p className="text-xs font-semibold text-[#2d2a26]/55">Tamigo</p>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3 text-xs font-semibold text-gray-500">
          <span>
            {loading
              ? "Laden..."
              : dirty
              ? "Niet opgeslagen wijzigingen."
              : status || "Alles bijgewerkt."}
          </span>
          {agenda.updatedAt && <span>{formatUpdatedAt(agenda.updatedAt)}</span>}
        </div>

        <button
          type="button"
          onClick={saveAgenda}
          disabled={saving || loading || !dirty}
          className="mt-4 w-full rounded-full bg-[#c3d3bc] p-4 font-bold disabled:opacity-50"
        >
          {saving ? "Opslaan..." : "Wijzigingen opslaan"}
        </button>
      </section>

      <section className="rounded-[1.75rem] border border-[#e7e0d8] bg-white/85 p-5 shadow-sm">
        <h2 className="text-xl font-bold">
          {editingId ? "Agenda-item wijzigen" : "Agenda-item toevoegen"}
        </h2>

        <div className="mt-4 space-y-3">
          <input
            value={draft.title}
            onChange={(event) => updateDraft("title", event.target.value)}
            placeholder="Titel"
            className="w-full rounded-2xl border border-[#e7e0d8] bg-white p-4"
          />

          <input
            type="date"
            value={draft.date}
            onChange={(event) => updateDraft("date", event.target.value)}
            className="w-full rounded-2xl border border-[#e7e0d8] bg-white p-4"
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <select
              value={draft.type}
              onChange={(event) =>
                updateDraft("type", event.target.value as TeamAgendaEventType)
              }
              className="w-full rounded-2xl border border-[#e7e0d8] bg-white p-4"
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
              className="w-full rounded-2xl border border-[#e7e0d8] bg-white p-4"
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
            className="min-h-24 w-full rounded-2xl border border-[#e7e0d8] bg-white p-4"
          />

          <label className="flex items-center gap-3 rounded-2xl border border-[#e7e0d8] bg-[#f8f6f3] p-4 text-sm font-semibold">
            <input
              type="checkbox"
              checked={draft.recurringYearly}
              onChange={(event) =>
                updateDraft("recurringYearly", event.target.checked)
              }
              className="h-5 w-5"
            />
            Jaarlijks terugkerend
          </label>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={submitDraft}
              className="min-w-0 flex-1 rounded-full bg-[#c3d3bc] p-4 font-bold"
            >
              {editingId ? "Wijziging bijwerken" : "Toevoegen"}
            </button>

            {editingId && (
              <button
                type="button"
                onClick={resetDraft}
                className="rounded-full bg-[#f8f6f3] px-5 font-bold text-gray-500"
              >
                Annuleer
              </button>
            )}
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold">Agenda-items</h2>

        {sortedEvents.length === 0 ? (
          <div className="rounded-[1.5rem] bg-white/80 p-5 text-sm text-gray-600 shadow-sm">
            Nog geen handmatige items in de Strik agenda.
          </div>
        ) : (
          sortedEvents.map((event) => (
            <article
              key={event.id}
              className="rounded-[1.5rem] border border-[#e7e0d8] bg-white p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="mb-2 flex flex-wrap gap-2">
                    <span className="rounded-full bg-[#eef3ea] px-3 py-1 text-xs font-bold text-[#2d3f29]">
                      {getEventTypeLabel(event.type)}
                    </span>
                    <span className="rounded-full bg-[#f8f6f3] px-3 py-1 text-xs font-bold text-[#2d2a26]/55">
                      {getAudienceLabel(event.audience)}
                    </span>
                    {event.recurringYearly && (
                      <span className="rounded-full bg-[#f1d28f]/60 px-3 py-1 text-xs font-bold text-[#4a3711]">
                        Jaarlijks
                      </span>
                    )}
                  </div>

                  <h3 className="text-lg font-bold leading-tight">
                    {event.title}
                  </h3>
                  <p className="mt-1 text-sm font-semibold capitalize text-[#2d2a26]/55">
                    {formatDate(event.date)}
                  </p>
                  {event.description && (
                    <p className="mt-3 rounded-2xl bg-[#f8f6f3] p-3 text-sm leading-relaxed text-gray-600">
                      {event.description}
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => editEvent(event)}
                  className="flex-1 rounded-full bg-[#eef3ea] px-4 py-3 text-sm font-bold"
                >
                  Wijzig
                </button>
                <button
                  type="button"
                  onClick={() => deleteEvent(event.id)}
                  className="rounded-full bg-[#f8f6f3] px-4 py-3 text-sm font-bold text-[#d75a48]"
                >
                  Verwijder
                </button>
              </div>
            </article>
          ))
        )}
      </section>
    </div>
  );
}
