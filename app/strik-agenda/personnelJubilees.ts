import type { TeamAgendaEvent } from "./teamAgendaApi";

export const storeJubileeYears = [5, 10, 12.5, 25, 40, 50] as const;

const alertRules = [
  {
    years: [1, 2, 3],
    days: 3,
    level: "small",
    label: "kort jubileum",
  },
  {
    years: [5, 10],
    days: 7,
    level: "medium",
    label: "jubileum",
  },
  {
    years: [12.5, 25, 40, 50],
    days: 14,
    level: "major",
    label: "groot jubileum",
  },
] as const;

export type PersonnelJubileeAlert = {
  id: string;
  event: TeamAgendaEvent;
  years: number;
  daysUntil: number;
  occurrenceDate: Date;
  level: "small" | "medium" | "major";
  label: string;
};

function sameJubileeYear(first: number, second: number) {
  return Math.abs(first - second) < 0.01;
}

export function formatJubileeYears(years: number) {
  return Number.isInteger(years)
    ? String(years)
    : String(years).replace(".", ",");
}

export function isImportantJubileeYear(years: number | undefined) {
  return typeof years === "number"
    ? storeJubileeYears.some((year) => sameJubileeYear(year, years))
    : false;
}

export function isCupcakeJubileeYear(years: number | undefined) {
  return (
    typeof years === "number" &&
    Number.isInteger(years) &&
    years >= 1 &&
    !isImportantJubileeYear(years)
  );
}

function parseDate(value: string | undefined) {
  if (!value) return null;

  const match = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (!match) return null;

  const date = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3])
  );
  date.setHours(0, 0, 0, 0);

  return Number.isNaN(date.getTime()) ? null : date;
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

export function getPersonnelEventOccurrenceDate(
  event: Pick<TeamAgendaEvent, "date" | "occurrenceDate" | "recurringYearly">,
  today = new Date()
) {
  const exactDate = parseDate(event.occurrenceDate);
  if (exactDate) return exactDate;

  const sourceDate = parseDate(event.date);
  if (!sourceDate) return null;

  if (!event.recurringYearly) return sourceDate;

  const baseToday = new Date(today);
  baseToday.setHours(0, 0, 0, 0);
  let occurrence = createYearlyDate(
    baseToday.getFullYear(),
    sourceDate.getMonth() + 1,
    sourceDate.getDate()
  );

  if (occurrence < baseToday) {
    occurrence = createYearlyDate(
      baseToday.getFullYear() + 1,
      sourceDate.getMonth() + 1,
      sourceDate.getDate()
    );
  }

  return occurrence;
}

export function getAnniversaryYears(event: TeamAgendaEvent) {
  if (typeof event.anniversaryYears === "number") {
    return event.anniversaryYears;
  }

  const match = `${event.title} ${event.description}`.match(
    /(\d+(?:[,.]5)?)\s*jaar/i
  );

  return match ? Number(match[1].replace(",", ".")) : undefined;
}

export function isStoreAgendaJubileeEvent(event: TeamAgendaEvent) {
  return event.type === "anniversary" && isImportantJubileeYear(getAnniversaryYears(event));
}

function getAlertRule(years: number) {
  return alertRules.find((rule) =>
    rule.years.some((ruleYear) => sameJubileeYear(ruleYear, years))
  );
}

function daysUntil(date: Date, today: Date) {
  const millisecondsPerDay = 24 * 60 * 60 * 1000;

  return Math.round((date.getTime() - today.getTime()) / millisecondsPerDay);
}

export function getUpcomingPersonnelJubileeAlerts(
  events: TeamAgendaEvent[],
  today = new Date()
): PersonnelJubileeAlert[] {
  const baseToday = new Date(today);
  baseToday.setHours(0, 0, 0, 0);

  return events
    .flatMap((event): PersonnelJubileeAlert[] => {
      if (event.type !== "anniversary") return [];

      const years = getAnniversaryYears(event);
      if (typeof years !== "number") return [];

      const rule = getAlertRule(years);
      if (!rule) return [];

      const occurrenceDate = getPersonnelEventOccurrenceDate(event, baseToday);
      if (!occurrenceDate) return [];

      const eventDaysUntil = daysUntil(occurrenceDate, baseToday);
      if (eventDaysUntil < 0 || eventDaysUntil > rule.days) return [];

      return [
        {
          id: `${event.id}-${eventDaysUntil}-${formatJubileeYears(years)}`,
          event,
          years,
          daysUntil: eventDaysUntil,
          occurrenceDate,
          level: rule.level,
          label: rule.label,
        },
      ];
    })
    .sort((first, second) => {
      const dayDiff = first.daysUntil - second.daysUntil;
      if (dayDiff !== 0) return dayDiff;

      return second.years - first.years;
    });
}
