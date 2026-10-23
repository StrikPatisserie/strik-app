export function parseBusinessDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? date : null;
}

export function historicalBusinessDeliveryDate(value: string, year: string) {
  const text = value.trim();
  if (parseBusinessDate(text)) return text;
  const numeric = text.match(/^(\d{1,2})[-/](\d{1,2})(?:[-/](\d{4}))?$/);
  const named = text.match(/^(\d{1,2})[-\s]+(nov(?:ember)?|dec(?:ember)?)$/i);
  const day = numeric?.[1] || named?.[1];
  const month = numeric?.[2] || (named?.[2].toLowerCase().startsWith("nov") ? "11" : named ? "12" : "");
  if (!day || !month) return "";
  const candidate = `${numeric?.[3] || year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  return parseBusinessDate(candidate) ? candidate : "";
}

function dateLabel(value: string, includeYear: boolean) {
  const date = parseBusinessDate(value);
  if (!date) return value;
  return new Intl.DateTimeFormat("nl-NL", {
    weekday: "short", day: "numeric", month: "short",
    ...(includeYear ? { year: "numeric" as const } : {}), timeZone: "UTC",
  }).format(date);
}

export function formatBusinessDeliveryMoment(start: string, end = "") {
  if (!start) return "In overleg";
  if (!end || end === start) return dateLabel(start, true);
  return `Tussen ${dateLabel(start, start.slice(0, 4) !== end.slice(0, 4))} en ${dateLabel(end, true)}`;
}
