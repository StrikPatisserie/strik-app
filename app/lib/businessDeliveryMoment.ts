function dateLabel(value: string, includeYear: boolean) {
  const date = new Date(`${value}T12:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(date.getTime())) return value;
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
