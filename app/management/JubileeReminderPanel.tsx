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
  if (alert.level === "major") return "border-[#ef5737] bg-[#fff4ef]";
  if (alert.level === "medium") return "border-[#f1d28f] bg-[#fff9e8]";

  return "border-[#c3d3bc] bg-[#f6faf4]";
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
      <section className="rounded-lg border border-[#ef5737]/35 bg-[#fff4ef] px-3 py-2 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Link
            href="/management/agenda"
            className="min-w-0 flex-1 text-sm font-black leading-tight text-[#1a1815]"
          >
            {alerts.length} jubileum-melding{alerts.length === 1 ? "" : "en"}{" "}
            open
          </Link>
          <button
            type="button"
            onClick={acknowledge}
            className="rounded-md bg-[#24551d] px-3 py-1.5 text-xs font-black text-white active:scale-[0.98]"
          >
            Genoteerd
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-[#ef5737]/40 bg-white p-3 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-[0.68rem] font-black uppercase text-[#ef5737]">
            Jubileum voorbereiden
          </p>
          <h2 className="mt-0.5 text-base font-black leading-tight text-[#1a1815] sm:text-lg">
            {primaryAlert.event.title}
          </h2>
          <p className="mt-1 text-xs font-bold text-[#6b645b] sm:text-sm">
            {formatAlertDate(primaryAlert.occurrenceDate)} ·{" "}
            {formatDaysUntil(primaryAlert.daysUntil)}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Link
            href="/management/agenda"
            className="rounded-md bg-[#f8f6f3] px-3 py-2 text-xs font-black text-[#1a1815]"
          >
            Agenda
          </Link>
          <button
            type="button"
            onClick={acknowledge}
            className="rounded-md bg-[#24551d] px-3 py-2 text-xs font-black text-white active:scale-[0.98]"
          >
            Genoteerd
          </button>
        </div>
      </div>

      <div className="mt-3 grid gap-1.5">
        {alerts.map((alert) => (
          <div
            key={alert.id}
            className={`grid grid-cols-[4.6rem_1fr_auto] items-center gap-2 rounded-md border px-2 py-1.5 ${alertTone(
              alert
            )}`}
          >
            <span className="text-[0.68rem] font-black capitalize text-[#1a1815]/70">
              {formatAlertDate(alert.occurrenceDate)}
            </span>
            <span className="min-w-0 truncate text-xs font-black text-[#1a1815] sm:text-sm">
              {alert.event.title}
            </span>
            <span className="text-[0.68rem] font-black text-[#ef5737]">
              {formatDaysUntil(alert.daysUntil)}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
