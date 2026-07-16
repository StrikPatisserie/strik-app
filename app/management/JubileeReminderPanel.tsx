"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  TeamAgendaEvent,
  normalizeTeamAgenda,
} from "../strik-agenda/teamAgendaApi";
import {
  PersonnelJubileeAlert,
  formatJubileeYears,
  getUpcomingPersonnelJubileeAlerts,
} from "../strik-agenda/personnelJubilees";

type AgendaEventsResponse = {
  events?: unknown[];
};

const seenStorageKey = "strik-management-jubilee-alerts-seen";
const acknowledgedStorageKey = "strik-management-jubilee-alerts-acknowledged";

async function fetchEvents(url: string) {
  const res = await fetch(url, { cache: "no-store" });
  const data = (await res.json().catch(() => null)) as
    | AgendaEventsResponse
    | null;

  if (!res.ok) return [];

  return normalizeTeamAgenda({ events: data?.events || [] }).events;
}

function formatAlertDate(date: Date) {
  return date.toLocaleDateString("nl-NL", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function formatDaysUntil(daysUntil: number) {
  if (daysUntil === 0) return "vandaag";
  if (daysUntil === 1) return "morgen";

  return `over ${daysUntil} dagen`;
}

function getAlertKey(alerts: PersonnelJubileeAlert[]) {
  return alerts
    .map(
      (alert) =>
        `${alert.event.id}:${alert.occurrenceDate.toISOString()}:${formatJubileeYears(
          alert.years
        )}`
    )
    .join("|");
}

function alertTone(alert: PersonnelJubileeAlert) {
  if (alert.level === "major") return "border-white/35 bg-white text-[#8f2f1d]";
  if (alert.level === "medium") return "border-white/30 bg-white/90 text-[#5f4810]";

  return "border-white/30 bg-white/90 text-[#24551d]";
}

export default function JubileeReminderPanel() {
  const [events, setEvents] = useState<TeamAgendaEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [displayMode, setDisplayMode] = useState<"large" | "compact">(
    "compact"
  );
  const [acknowledgedKey, setAcknowledgedKey] = useState("");

  useEffect(() => {
    let ignoreResult = false;

    async function loadAlerts() {
      try {
        const [tamigoEvents, driveEvents] = await Promise.all([
          fetchEvents("/api/tamigo-employees?view=management"),
          fetchEvents("/api/personnel-sheet-agenda?view=management"),
        ]);

        if (!ignoreResult) setEvents([...tamigoEvents, ...driveEvents]);
      } finally {
        if (!ignoreResult) setLoading(false);
      }
    }

    void loadAlerts();

    return () => {
      ignoreResult = true;
    };
  }, []);

  const alerts = useMemo(() => getUpcomingPersonnelJubileeAlerts(events), [
    events,
  ]);
  const alertKey = useMemo(() => getAlertKey(alerts), [alerts]);

  useEffect(() => {
    if (!alertKey) return;

    const seenKey = window.localStorage.getItem(seenStorageKey);
    setAcknowledgedKey(
      window.localStorage.getItem(acknowledgedStorageKey) || ""
    );
    setDisplayMode(seenKey === alertKey ? "compact" : "large");
    if (seenKey !== alertKey) {
      window.localStorage.setItem(seenStorageKey, alertKey);
    }
  }, [alertKey]);

  if (loading || alerts.length === 0 || acknowledgedKey === alertKey) {
    return null;
  }

  function acknowledge() {
    window.localStorage.setItem(acknowledgedStorageKey, alertKey);
    setAcknowledgedKey(alertKey);
  }

  const primaryAlert = alerts[0];

  if (displayMode === "compact") {
    return (
      <section className="rounded-lg border border-[#ef5737] bg-[#ef5737] px-3 py-2 text-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Link
            href="/management/agenda"
            className="min-w-0 flex-1 text-xs font-black uppercase leading-tight"
          >
            {alerts.length} jubileum-melding{alerts.length === 1 ? "" : "en"}{" "}
            open
          </Link>
          <button
            type="button"
            onClick={acknowledge}
            className="rounded-md bg-white px-3 py-1.5 text-xs font-black text-[#24551d] active:scale-[0.98]"
          >
            Genoteerd
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-[#ef5737] bg-[#ef5737] p-3 text-white shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-[0.62rem] font-black uppercase leading-tight text-white/78">
            Jubileum voorbereiden
          </p>
          <h2 className="mt-0.5 text-sm font-black leading-tight sm:text-base">
            {primaryAlert.event.title}
          </h2>
          <p className="mt-0.5 text-[0.72rem] font-bold leading-tight text-white/82 sm:text-xs">
            {formatAlertDate(primaryAlert.occurrenceDate)} ·{" "}
            {formatDaysUntil(primaryAlert.daysUntil)}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Link
            href="/management/agenda"
            className="rounded-md bg-white/18 px-3 py-2 text-xs font-black text-white"
          >
            Agenda
          </Link>
          <button
            type="button"
            onClick={acknowledge}
            className="rounded-md bg-white px-3 py-2 text-xs font-black text-[#24551d] active:scale-[0.98]"
          >
            Genoteerd
          </button>
        </div>
      </div>

      <div className="mt-2 grid gap-1.5">
        {alerts.map((alert) => (
          <div
            key={alert.id}
            className={`grid grid-cols-[4.6rem_1fr_auto] items-center gap-2 rounded-md border px-2 py-1.5 ${alertTone(
              alert
            )}`}
          >
            <span className="text-[0.66rem] font-black capitalize">
              {formatAlertDate(alert.occurrenceDate)}
            </span>
            <span className="min-w-0 truncate text-xs font-black">
              {alert.event.title}
            </span>
            <span className="text-[0.66rem] font-black">
              {formatDaysUntil(alert.daysUntil)}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
