export const WEDDING_LOCATION = "Strik Ziekerstraat · Ziekerstraat 124, Nijmegen";
export const WEDDING_TIMES = ["10:30", "11:30"] as const;
export type WeddingContact = { names: string; email: string; phone: string; weddingDate: string; guests: string; notes: string };
export type WeddingSettings = { enabled: boolean; weekdays: number[]; times: string[]; minimum_notice_minutes: number; advance_days: number; migration_count?: number; migration_sha256?: string | null };
export type WeddingAppointment = {
  id: string; reference: string; appointment_date: string; start_time: string; end_time: string;
  status: "confirmed" | "pending" | "cancelled" | "trash"; names: string; email: string; phone: string;
  wedding_date?: string | null; guests?: number | null; notes: string; source: "app" | "wordpress";
  source_booking_id?: string | null; raw_source?: unknown; created_at?: string;
  revision?: number; updated_at?: string;
};
export type WeddingSlotDay = { date: string; times: string[] };
export type WeddingReceipt = Pick<WeddingAppointment, "id" | "reference" | "appointment_date" | "start_time" | "end_time" | "names" | "email"> & { mailPending: boolean };

export function weddingDateIsValid(value: string) {
  const date = new Date(`${value}T12:00:00Z`);
  return /^20\d{2}-\d{2}-\d{2}$/.test(value) && Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export function weddingLocalDate(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Amsterdam", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}
export function weddingDateLabel(value: string) {
  return new Intl.DateTimeFormat("nl-NL", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T12:00:00Z`));
}
export function weddingSlotEnd(time: string) {
  const [hour, minute] = time.split(":").map(Number);
  return `${String(hour + Math.floor((minute + 30) / 60)).padStart(2, "0")}:${String((minute + 30) % 60).padStart(2, "0")}`;
}
export function weddingSlotInstant(date: string, time: string) {
  // The offered morning slots are never inside the ambiguous DST change hour.
  const noon = new Date(`${date}T12:00:00Z`);
  const zone = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Amsterdam", timeZoneName: "shortOffset" }).formatToParts(noon).find(part => part.type === "timeZoneName")?.value || "";
  const offset = zone.match(/^GMT([+-])(\d{1,2})(?::(\d{2}))?$/);
  if (!offset) throw new Error("Het tijdstip kon niet worden bepaald.");
  return new Date(`${date}T${time}:00${offset[1]}${offset[2].padStart(2, "0")}:${offset[3] || "00"}`);
}
export function availableWeddingSlots(settings: WeddingSettings, from: string, to: string, busy: Pick<WeddingAppointment, "appointment_date" | "start_time" | "end_time" | "status">[], blocked: string[], now = new Date()): WeddingSlotDay[] {
  if (!settings.enabled) return [];
  const result: WeddingSlotDay[] = [];
  const latest = new Date(`${weddingLocalDate(now)}T12:00:00Z`);
  latest.setUTCDate(latest.getUTCDate() + settings.advance_days);
  for (let current = new Date(`${from}T12:00:00Z`); current.toISOString().slice(0, 10) <= to; current = new Date(current.getTime() + 86400000)) {
    const date = current.toISOString().slice(0, 10);
    if (current > latest || !settings.weekdays.includes(current.getUTCDay()) || blocked.includes(date)) continue;
    const times = settings.times.filter(time => WEDDING_TIMES.includes(time as typeof WEDDING_TIMES[number])
      && weddingSlotInstant(date, time).getTime() > now.getTime() + settings.minimum_notice_minutes * 60000
      && !busy.some(item => item.appointment_date === date && ["confirmed", "pending"].includes(item.status) && item.start_time.slice(0, 5) < weddingSlotEnd(time) && item.end_time.slice(0, 5) > time));
    if (times.length) result.push({ date, times });
  }
  return result;
}
export function parseWeddingContact(input: unknown, staff = false): WeddingContact {
  if (!input || typeof input !== "object") throw new Error("Vul jullie gegevens in.");
  const raw = input as Record<string, unknown>;
  const text = (key: string, limit: number) => {
    if (typeof raw[key] !== "string") return "";
    const value = raw[key].trim();
    if (value.length > limit) throw new Error("Een ingevuld veld is te lang.");
    return value;
  };
  const contact = { names: text("names", 160), email: text("email", 200).toLowerCase(), phone: text("phone", 40), weddingDate: text("weddingDate", 10), guests: text("guests", 4), notes: text("notes", 1500) };
  if (!contact.names || (!staff && !contact.phone) || ((!staff || contact.email) && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email))) throw new Error(staff ? "Vul de namen en, indien ingevuld, een geldig e-mailadres in." : "Vul jullie namen, een geldig e-mailadres en telefoonnummer in.");
  if (/[\r\n]/.test(contact.email + contact.names + contact.phone)) throw new Error("Controleer de contactgegevens.");
  if (contact.weddingDate && !weddingDateIsValid(contact.weddingDate)) throw new Error("Controleer de trouwdatum.");
  if (contact.guests && (!/^\d+$/.test(contact.guests) || Number(contact.guests) < 1 || Number(contact.guests) > 2000)) throw new Error("Kies een aantal gasten tussen 1 en 2000.");
  return contact;
}
