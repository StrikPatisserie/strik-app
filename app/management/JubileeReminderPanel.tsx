"use client";

import { useEffect, useMemo, useState } from "react";
import {
  TeamAgendaEvent,
  normalizeTeamAgenda,
} from "../strik-agenda/teamAgendaApi";
import {
  PersonnelJubileeAlert,
  formatJubileeYears,
  getPersonnelEventOccurrenceDate,
  getUpcomingPersonnelJubileeAlerts,
} from "../strik-agenda/personnelJubilees";

type AgendaEventsResponse = {
  events?: unknown[];
};

type BirthdayAlert = {
  kind: "birthday";
  id: string;
  event: TeamAgendaEvent;
  employeeName: string;
  firstName: string;
  daysUntil: number;
  occurrenceDate: Date;
  label: "verjaardag";
};

type CelebrationAlert =
  | (PersonnelJubileeAlert & { kind: "jubilee" })
  | BirthdayAlert;

export type JubileeReminderStatus = {
  loading: boolean;
  openAlertCount: number;
};

type JubileeReminderPanelProps = {
  onStatusChange?: (status: JubileeReminderStatus) => void;
};

const birthdayLookaheadDays = 1;
const acknowledgedStorageKey =
  "strik-management-celebration-alerts-acknowledged";

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

function getFirstName(employeeName: string) {
  return employeeName.trim().split(/\s+/)[0] || employeeName;
}

function daysUntil(date: Date, today: Date) {
  const millisecondsPerDay = 24 * 60 * 60 * 1000;

  return Math.round((date.getTime() - today.getTime()) / millisecondsPerDay);
}

function getBirthdayEmployeeName(event: TeamAgendaEvent) {
  if (event.employeeName) return event.employeeName;

  return event.title.replace(/\s+is jarig$/i, "").trim() || event.title;
}

function getUpcomingBirthdayAlerts(
  events: TeamAgendaEvent[],
  today = new Date()
): BirthdayAlert[] {
  const baseToday = new Date(today);
  baseToday.setHours(0, 0, 0, 0);

  return events.flatMap((event): BirthdayAlert[] => {
    if (event.type !== "birthday") return [];

    const occurrenceDate = getPersonnelEventOccurrenceDate(event, baseToday);
    if (!occurrenceDate) return [];

    const eventDaysUntil = daysUntil(occurrenceDate, baseToday);
    if (eventDaysUntil < 0 || eventDaysUntil > birthdayLookaheadDays) return [];

    const employeeName = getBirthdayEmployeeName(event);

    return [
      {
        kind: "birthday",
        id: `${event.id}-${eventDaysUntil}-birthday`,
        event,
        employeeName,
        firstName: getFirstName(employeeName),
        daysUntil: eventDaysUntil,
        occurrenceDate,
        label: "verjaardag",
      },
    ];
  });
}

function getUpcomingCelebrationAlerts(
  events: TeamAgendaEvent[],
  today = new Date()
): CelebrationAlert[] {
  const birthdays = getUpcomingBirthdayAlerts(events, today);
  const jubilees = getUpcomingPersonnelJubileeAlerts(events, today).map(
    (alert): CelebrationAlert => ({
      ...alert,
      kind: "jubilee",
    })
  );

  return [...birthdays, ...jubilees].sort((first, second) => {
    const dayDiff = first.daysUntil - second.daysUntil;
    if (dayDiff !== 0) return dayDiff;

    if (first.kind !== second.kind) {
      return first.kind === "birthday" ? -1 : 1;
    }

    if (first.kind === "jubilee" && second.kind === "jubilee") {
      return second.years - first.years;
    }

    return getAlertTitle(first).localeCompare(getAlertTitle(second));
  });
}

function getAlertKey(alert: CelebrationAlert) {
  if (alert.kind === "birthday") {
    return `${alert.kind}:${alert.event.id}:${alert.occurrenceDate.toISOString()}`;
  }

  return `${alert.kind}:${alert.event.id}:${alert.occurrenceDate.toISOString()}:${formatJubileeYears(
    alert.years
  )}`;
}

function readAcknowledgedKeys() {
  const stored = window.localStorage.getItem(acknowledgedStorageKey);
  if (!stored) return [];

  try {
    const parsed = JSON.parse(stored) as unknown;
    if (Array.isArray(parsed)) {
      return parsed.filter((value): value is string => typeof value === "string");
    }
  } catch {
    // The previous version stored all keys in one pipe-separated string.
  }

  return stored.split("|").filter(Boolean);
}

function getAlertTitle(alert: CelebrationAlert) {
  if (alert.kind === "birthday") return `${alert.employeeName} is jarig`;

  return alert.event.title;
}

function getAlertDetail(alert: CelebrationAlert) {
  if (alert.kind === "birthday") {
    return `Taartje: Gefeliciteerd ${alert.firstName}`;
  }

  return `${formatJubileeYears(alert.years)} jaar in dienst`;
}

export default function JubileeReminderPanel({
  onStatusChange,
}: Readonly<JubileeReminderPanelProps> = {}) {
  const [events, setEvents] = useState<TeamAgendaEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [acknowledgedKeys, setAcknowledgedKeys] = useState<string[]>([]);
  const [acknowledgementsLoaded, setAcknowledgementsLoaded] = useState(false);

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

  const alerts = useMemo(() => getUpcomingCelebrationAlerts(events), [
    events,
  ]);

  useEffect(() => {
    setAcknowledgedKeys(readAcknowledgedKeys());
    setAcknowledgementsLoaded(true);
  }, []);

  const openAlerts = useMemo(() => {
    const acknowledged = new Set(acknowledgedKeys);
    return alerts.filter((alert) => !acknowledged.has(getAlertKey(alert)));
  }, [acknowledgedKeys, alerts]);
  const panelLoading = loading || !acknowledgementsLoaded;
  const openAlertCount = panelLoading ? 0 : openAlerts.length;

  useEffect(() => {
    onStatusChange?.({
      loading: panelLoading,
      openAlertCount,
    });
  }, [onStatusChange, openAlertCount, panelLoading]);

  if (panelLoading || openAlerts.length === 0) return null;

  function acknowledge(alert: CelebrationAlert) {
    const key = getAlertKey(alert);
    setAcknowledgedKeys((current) => {
      const next = Array.from(new Set([...current, key]));
      window.localStorage.setItem(acknowledgedStorageKey, JSON.stringify(next));
      return next;
    });
  }

  return (
    <section className="grid gap-1.5 rounded-lg border border-[#ef5737] bg-[#ef5737] p-2 text-white shadow-sm">
      {openAlerts.map((alert) => (
        <div
          key={getAlertKey(alert)}
          className="grid gap-2 rounded-md border border-white/35 bg-white px-2.5 py-2 text-[#8f2f1d] sm:grid-cols-[4.8rem_minmax(0,1fr)_auto] sm:items-center"
        >
          <span className="text-[0.66rem] font-black capitalize">
            {formatAlertDate(alert.occurrenceDate)}
          </span>
          <span className="min-w-0 text-xs font-black leading-snug">
            {getAlertTitle(alert)} · {getAlertDetail(alert)} ·{" "}
            {formatDaysUntil(alert.daysUntil)}
          </span>
          <button
            type="button"
            onClick={() => acknowledge(alert)}
            className="w-fit rounded-md bg-[#24551d] px-3 py-1.5 text-[0.68rem] font-black text-white active:scale-[0.98]"
          >
            Afvinken
          </button>
        </div>
      ))}
    </section>
  );
}
