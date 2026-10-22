import "server-only";
import { createHash } from "node:crypto";

type LegacyRow = Record<string, string | number | null>;
export type WeddingArchive = { format: string; exportedAt: string; timezone: string; counts: Record<string, number>; sha256: string; raw: string };

function formFields(value: string) {
  return Object.fromEntries(value.split("~").flatMap(field => {
    const [type, name, ...parts] = field.split("^");
    if (!type || !name || !parts.length) return [];
    let text = parts.join("^");
    try { text = decodeURIComponent(text); } catch { /* Preserve old literal percent signs. */ }
    text = text.replace(/&amp;|&#0*38;/g, "&").replace(/&quot;|&#0*34;/g, '"').replace(/&#0*39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
    return [[name, text]];
  }));
}

export function normalizeWeddingArchive(input: unknown) {
  const archive = input as WeddingArchive;
  if (!archive || archive.format !== "strik-wedding-booking-export-v1" || typeof archive.raw !== "string" || archive.raw.length > 20_000_000 || !/^[a-f0-9]{64}$/.test(archive.sha256)
    || createHash("sha256").update(archive.raw).digest("hex") !== archive.sha256) throw new Error("De volledige export kon niet worden gecontroleerd. Er is niets overgenomen.");
  const tables = JSON.parse(archive.raw) as Record<string, LegacyRow[]>;
  if (!Array.isArray(tables.booking) || !Array.isArray(tables.bookingdates)) throw new Error("De oorspronkelijke boekingstabellen ontbreken.");
  for (const [name, rows] of Object.entries(tables)) if (!Array.isArray(rows) || rows.length !== archive.counts[name]) throw new Error(`Het controleaantal voor ${name} klopt niet.`);
  const datesById = new Map<string, LegacyRow[]>();
  for (const row of tables.bookingdates) {
    const id = String(row.booking_id);
    datesById.set(id, [...(datesById.get(id) || []), row]);
  }
  if (datesById.size !== tables.booking.length) throw new Error("Niet alle datumregels konden aan een afspraak worden gekoppeld.");
  const appointments = tables.booking.map(booking => {
    const id = String(booking.booking_id);
    const dates = datesById.get(id)?.slice().sort((a, b) => String(a.booking_date).localeCompare(String(b.booking_date))) || [];
    if (dates.length !== 2 || String(dates[0].booking_date).slice(0, 10) !== String(dates[1].booking_date).slice(0, 10)) throw new Error(`Afspraak ${id} heeft afwijkende datumregels; controleer deze vóór de overname.`);
    const start = String(dates[0].booking_date).slice(11, 16), end = String(dates[1].booking_date).slice(11, 16), date = String(dates[0].booking_date).slice(0, 10);
    if (!/^20\d{2}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(start) || end <= start) throw new Error(`Het tijdvak van afspraak ${id} is niet geldig.`);
    const fields = formFields(String(booking.form || ""));
    const created = String(booking.creation_date || "");
    const modified = String(booking.modification_date || created);
    if (!Number.isFinite(Date.parse(created.replace(" ", "T") + "Z"))) throw new Error(`De oorspronkelijke aanmaakdatum van afspraak ${id} kon niet worden gelezen.`);
    return {
      source_id: id, source_booking_id: id, appointment_date: date, start_time: start, end_time: end,
      // Booking Calendar uses :01/:02 as range markers, not UTC offsets.
      // Preserve its displayed wall-clock time, including older afternoon slots.
      status: String(booking.trash) === "1" || String(booking.is_trash) === "1" ? "trash" : dates.every(row => String(row.approved) === "1") ? "confirmed" : "pending",
      names: [fields.name1, fields.secondname1].filter(Boolean).join(" ") || "Naam niet ingevuld", email: fields.email1 || "", phone: fields.phone1 || "", notes: fields.details1 || fields.details || "",
      raw_source: { booking, dates, fields }, created_at: created.replace(" ", "T") + "Z",
      updated_at: Number.isFinite(Date.parse(modified.replace(" ", "T") + "Z")) ? modified.replace(" ", "T") + "Z" : created.replace(" ", "T") + "Z",
    };
  });
  const blocks = (tables.booking_dates_props || []).map(row => {
    if (row.prop_name !== "date_status" || row.prop_value !== "unavailable") throw new Error("De export bevat een onbekende beschikbaarheidsregel; controleer deze eerst.");
    return { source_id: `wordpress:${row.booking_dates_prop_id}`, block_date: String(row.calendar_date).slice(0, 10), reason: "Overgenomen blokkade uit de oude kalender", raw_source: row };
  });
  if (appointments.length !== archive.counts.booking || appointments.reduce((sum, row) => sum + row.raw_source.dates.length, 0) !== archive.counts.bookingdates) throw new Error("De totale overname is niet volledig.");
  return { archive, appointments, blocks };
}
