export const TEAM_AGENDA_API_URL =
  "https://strik-patisserie.nl/wp-json/strik/v1/team-agenda";
export const TEAM_AGENDA_API_KEY = "schoonmaak-ijs-strik";

export const teamAgendaEventTypes = [
  { value: "event", label: "Strik event" },
  { value: "holiday", label: "Feestdag" },
  { value: "training", label: "Overig" },
  { value: "closing", label: "Sluitingsdag" },
  { value: "birthday", label: "Verjaardag" },
  { value: "anniversary", label: "Jubileum" },
] as const;

export type TeamAgendaEventType =
  (typeof teamAgendaEventTypes)[number]["value"];

export const teamAgendaAudiences = [
  { value: "alle", label: "Alle winkels" },
  { value: "lent", label: "Lent" },
  { value: "heyendaal", label: "Heyendaal" },
  { value: "daalseweg", label: "Daalseweg" },
  { value: "ziekerstraat", label: "Ziekerstraat" },
] as const;

export type TeamAgendaAudience =
  (typeof teamAgendaAudiences)[number]["value"];

export type TeamAgendaEventSource = "manual" | "tamigo" | "sheet";

export type TeamAgendaEvent = {
  id: string;
  title: string;
  date: string;
  type: TeamAgendaEventType;
  audience: TeamAgendaAudience;
  description: string;
  recurringYearly: boolean;
  source: TeamAgendaEventSource;
  createdAt: string;
  updatedAt?: string;
  employeeName?: string;
  startDate?: string;
  occurrenceDate?: string;
  anniversaryYears?: number;
};

export type TeamAgendaData = {
  events: TeamAgendaEvent[];
  updatedAt?: string;
};

export function getTeamAgendaUrl() {
  const url = new URL(TEAM_AGENDA_API_URL);
  url.searchParams.set("key", TEAM_AGENDA_API_KEY);

  return url;
}

export function getEmptyTeamAgenda(): TeamAgendaData {
  return {
    events: [],
  };
}

export function createTeamAgendaId(prefix = "event") {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function getEventTypeLabel(type: TeamAgendaEventType) {
  return (
    teamAgendaEventTypes.find((eventType) => eventType.value === type)?.label ||
    "Strik event"
  );
}

export function getAudienceLabel(audience: TeamAgendaAudience) {
  return (
    teamAgendaAudiences.find((item) => item.value === audience)?.label ||
    "Alle winkels"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function textFrom(value: unknown) {
  return typeof value === "string" ? value : "";
}

function boolFrom(value: unknown) {
  return value === true || value === "true" || value === 1 || value === "1";
}

function numberFrom(value: unknown) {
  const numberValue =
    typeof value === "string" ? Number(value.replace(",", ".")) : Number(value);

  return Number.isFinite(numberValue) ? numberValue : undefined;
}

function normalizeType(value: unknown): TeamAgendaEventType {
  const type = textFrom(value);
  return teamAgendaEventTypes.some((item) => item.value === type)
    ? (type as TeamAgendaEventType)
    : "event";
}

function normalizeAudience(value: unknown): TeamAgendaAudience {
  const audience = textFrom(value);
  return teamAgendaAudiences.some((item) => item.value === audience)
    ? (audience as TeamAgendaAudience)
    : "alle";
}

function normalizeSource(value: unknown): TeamAgendaEventSource {
  const source = textFrom(value);
  if (source === "tamigo") return "tamigo";
  if (source === "sheet" || source === "drive" || source === "google-sheet") {
    return "sheet";
  }

  return "manual";
}

function normalizeEvent(value: unknown): TeamAgendaEvent | null {
  if (!isRecord(value)) return null;

  const title = textFrom(value.title).trim();
  const date = textFrom(value.date).trim();

  if (!title || !date) return null;

  return {
    id: textFrom(value.id) || createTeamAgendaId(),
    title,
    date,
    type: normalizeType(value.type),
    audience: normalizeAudience(value.audience),
    description: textFrom(value.description).trim(),
    recurringYearly: boolFrom(value.recurringYearly),
    source: normalizeSource(value.source),
    createdAt: textFrom(value.createdAt) || new Date().toISOString(),
    updatedAt: textFrom(value.updatedAt) || undefined,
    employeeName: textFrom(value.employeeName).trim() || undefined,
    startDate: textFrom(value.startDate).trim() || undefined,
    occurrenceDate: textFrom(value.occurrenceDate).trim() || undefined,
    anniversaryYears: numberFrom(value.anniversaryYears),
  };
}

export function normalizeTeamAgenda(value: unknown): TeamAgendaData {
  if (!isRecord(value)) return getEmptyTeamAgenda();

  const events = Array.isArray(value.events)
    ? value.events.flatMap((item) => {
        const event = normalizeEvent(item);
        return event ? [event] : [];
      })
    : [];

  return {
    events,
    updatedAt: textFrom(value.updatedAt) || undefined,
  };
}

export function getEventSourceLabel(event: Pick<TeamAgendaEvent, "source" | "audience">) {
  if (event.source === "tamigo") return "Tamigo";
  if (event.source === "sheet") return "Drive";

  return getAudienceLabel(event.audience);
}

export function getAutomaticEventSourceLabel(source: TeamAgendaEventSource) {
  if (source === "sheet") return "Automatisch via Drive";
  if (source === "tamigo") return "Automatisch via Tamigo";

  return "Handmatig";
}
