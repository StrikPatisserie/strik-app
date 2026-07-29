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

const birthdayLookaheadDays = 5;
const seenStorageKey = "strik-management-celebration-alerts-seen";
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

function getAlertKey(alerts: CelebrationAlert[]) {
  return alerts
    .map((alert) => {
      if (alert.kind === "birthday") {
        return `${alert.kind}:${alert.event.id}:${alert.occurrenceDate.toISOString()}`;
      }

      return `${alert.kind}:${alert.event.id}:${alert.occurrenceDate.toISOString()}:${formatJubileeYears(
        alert.years
      )}`;
    })
    .join("|");
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

function alertTone(alert: CelebrationAlert) {
  if (alert.kind === "birthday") return "border-white/35 bg-white text-[#8f2f1d]";
  if (alert.level === "major") return "border-white/35 bg-white text-[#8f2f1d]";
  if (alert.level === "medium") return "border-white/30 bg-white/90 text-[#5f4810]";

  return "border-white/30 bg-white/90 text-[#24551d]";
}

export default function JubileeReminderPanel({
  onStatusChange,
}: Readonly<JubileeReminderPanelProps> = {}) {
  const [events, setEvents] = useState<TeamAgendaEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [displayMode, setDisplayMode] = useState<"large" | "compact">(
    "compact"
  );
  const [acknowledgedKey, setAcknowledgedKey] = useState("");
  const [checkedAlertKey, setCheckedAlertKey] = useState("");

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
  const alertKey = useMemo(() => getAlertKey(alerts), [alerts]);

  useEffect(() => {
    if (!alertKey) return;

    const seenKey = window.localStorage.getItem(seenStorageKey);
    // Local storage is the acknowledgement source for these browser-only reminders.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAcknowledgedKey(
      window.localStorage.getItem(acknowledgedStorageKey) || ""
    );
    setDisplayMode(seenKey === alertKey ? "compact" : "large");
    if (seenKey !== alertKey) {
      window.localStorage.setItem(seenStorageKey, alertKey);
    }
    setCheckedAlertKey(alertKey);
  }, [alertKey]);

  const hasCheckedCurrentAlertKey = !alertKey || checkedAlertKey === alertKey;
  const openAlertCount =
    !loading &&
    hasCheckedCurrentAlertKey &&
    alerts.length > 0 &&
    acknowledgedKey !== alertKey
      ? alerts.length
      : 0;

  useEffect(() => {
    onStatusChange?.({
      loading,
      openAlertCount,
    });
  }, [loading, onStatusChange, openAlertCount]);

  if (
    loading ||
    alerts.length === 0 ||
    !hasCheckedCurrentAlertKey ||
    acknowledgedKey === alertKey
  ) {
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
            {alerts.length} personeelsmelding{alerts.length === 1 ? "" : "en"}{" "}
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
            {primaryAlert.kind === "birthday"
              ? "Verjaardag voorbereiden"
              : "Jubileum voorbereiden"}
          </p>
          <h2 className="mt-0.5 text-sm font-black leading-tight sm:text-base">
            {getAlertTitle(primaryAlert)}
          </h2>
          <p className="mt-0.5 text-[0.72rem] font-bold leading-tight text-white/82 sm:text-xs">
            {formatAlertDate(primaryAlert.occurrenceDate)} ·{" "}
            {formatDaysUntil(primaryAlert.daysUntil)} ·{" "}
            {getAlertDetail(primaryAlert)}
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
              {getAlertTitle(alert)} · {getAlertDetail(alert)}
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
