import { TIME_ZONE, type TimeValue } from "./reviewTypes";

const formatter = new Intl.DateTimeFormat("en-GB", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
export function localParts(ms: number) {
  return Object.fromEntries(formatter.formatToParts(new Date(ms)).filter(part => part.type !== "literal").map(part => [part.type, part.value]));
}
export function localDate(ms: number) {
  const p = localParts(ms);
  return `${p.year}-${p.month}-${p.day}`;
}
export function formatTime(iso: string | null | undefined) {
  if (!iso) return "—";
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return "—";
  return new Intl.DateTimeFormat("nl-NL", { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(date);
}
export function formatStamp(iso: string | null | undefined) {
  if (!iso) return "—";
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return "—";
  return new Intl.DateTimeFormat("nl-NL", { timeZone: TIME_ZONE, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZoneName: "shortOffset", hourCycle: "h23" }).format(date);
}
export function formatMinutes(minutes: number | null, signed = false) {
  if (minutes === null || !Number.isFinite(minutes)) return "Onbekend";
  const rounded = Math.round(minutes);
  return `${rounded < 0 ? "−" : signed && rounded > 0 ? "+" : ""}${Math.floor(Math.abs(rounded) / 60)}u ${String(Math.abs(rounded) % 60).padStart(2, "0")}`;
}
export function parseTime(raw: unknown): TimeValue {
  const value = typeof raw === "string" ? raw : null;
  const fail = (issue: TimeValue["issue"]): TimeValue => ({ raw: value, iso: null, ms: null, issue });
  if (!value?.trim()) return fail("missing");
  if (/^(?:0001|1899|1900)-/.test(value)) return fail("missing");
  const calendar = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/);
  if (calendar) {
    const [, year, month, day, hour, minute, second = "00"] = calendar;
    const check = new Date(Date.UTC(+year, +month - 1, +day, +hour, +minute, +second));
    if (check.getUTCFullYear() !== +year || check.getUTCMonth() + 1 !== +month || check.getUTCDate() !== +day || check.getUTCHours() !== +hour || check.getUTCMinutes() !== +minute || check.getUTCSeconds() !== +second) return fail("invalid");
  }
  const microsoft = value.match(/^\/Date\((-?\d+)(?:[+-]\d{4})?\)\/$/);
  if (microsoft || /(?:[zZ]|[+-]\d{2}:?\d{2})$/.test(value)) {
    const ms = microsoft ? Number(microsoft[1]) : Date.parse(value);
    if (!Number.isFinite(ms) || !Number.isFinite(new Date(ms).getTime())) return fail("invalid");
    if (new Date(ms).getUTCFullYear() <= 1900) return fail("missing");
    return { raw: value, iso: new Date(ms).toISOString(), ms, issue: null };
  }
  const local = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,7}))?)?$/);
  if (!local) return fail("invalid");
  const [, year, month, day, hour, minute, second = "00", fraction = ""] = local;
  const wall = Date.UTC(+year, +month - 1, +day, +hour, +minute, +second, +(fraction + "000").slice(0, 3));
  const expected = `${year}-${month}-${day}T${hour}:${minute}:${second}`;
  const candidates = new Set<number>();
  // Amsterdam offsets are derived from Intl, never from the host timezone.
  for (const delta of [-36, 0, 36]) {
    const sample = Math.floor((wall + delta * 3600000) / 1000) * 1000;
    const p = localParts(sample);
    const offset = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - sample;
    const candidate = wall - offset;
    const c = localParts(candidate);
    if (`${c.year}-${c.month}-${c.day}T${c.hour}:${c.minute}:${c.second}` === expected) candidates.add(candidate);
  }
  if (!candidates.size) return fail("nonexistent");
  if (candidates.size > 1) return fail("ambiguous");
  const ms = [...candidates][0];
  return { raw: value, iso: new Date(ms).toISOString(), ms, issue: null };
}
export function roundQuarter(ms: number, direction: "up" | "down") {
  return (direction === "up" ? Math.ceil(ms / 900000) : Math.floor(ms / 900000)) * 900000;
}
export function durationMinutes(start: TimeValue, end: TimeValue) {
  return start.ms === null || end.ms === null ? null : (end.ms - start.ms) / 60000;
}
export function nextCalendarDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("Ongeldige datum voor de dagstatus.");
  const date = new Date(`${value}T12:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new Error("Ongeldige datum voor de dagstatus.");
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}
export function monthBounds(month: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || +month.slice(0, 4) < 2000 || +month.slice(0, 4) > 2100) throw new Error("Kies een geldige maand tussen 2000 en 2100.");
  const year = +month.slice(0, 4), index = +month.slice(5) - 1;
  return { from: `${month}-01`, to: new Date(Date.UTC(year, index + 1, 1)).toISOString().slice(0, 10), fetchFrom: new Date(Date.UTC(year, index, 0)).toISOString().slice(0, 10), fetchTo: new Date(Date.UTC(year, index + 1, 2)).toISOString().slice(0, 10) };
}
export function reviewPeriodBounds(month: string, period: "calendar" | "payroll" = "calendar") {
  const calendar = monthBounds(month);
  if (period === "calendar") return calendar;
  if (period !== "payroll") throw new Error("Kies kalendermaand of loonperiode.");
  const year = +month.slice(0, 4), index = +month.slice(5) - 1;
  const date = (monthIndex: number, day: number) => new Date(Date.UTC(year, monthIndex, day)).toISOString().slice(0, 10);
  return { from: date(index - 1, 26), to: date(index, 26), fetchFrom: date(index - 1, 25), fetchTo: date(index, 27) };
}
