import { businessDeliveryWindow } from "../../lib/businessOrderDeliveries";
import { b2bLetterInPackage } from "../b2bLetterLines";
import { compactWorkRow, workOverviewRows, type WorkOverviewEntry, type WorkOverviewOptions, type WorkOverviewRow } from "./workOverview";

export type DistributionRow = { id: string; customer: string; products: string[]; notes: string[]; logo: boolean; locationLabel: string; address: string };
export type DistributionDay = { date: string; rows: DistributionRow[] };
export type DistributionOptions = WorkOverviewOptions & { to: string };
const clean = (value: string) => value.replace(/[\u2010-\u2015\u2212]/g, "-").replace(/\s+/g, " ").trim();
const key = (value: string) => clean(value).toLocaleLowerCase("nl-NL");
const unique = (values: string[]) => [...new Map(values.map(value => [key(value), clean(value)] as const).filter(([id]) => id)).values()];

function compactText(value: string) {
  return clean(value).replace(/\bchocolade spuitletters\b/gi, "spuitletters")
    .replace(/\bchocolade vormletters\b/gi, "vormletters")
    .replace(/\bspeculaasbrok met letter · speculaasbrok\b/gi, "Speculaasbrok + letter ·")
    .replace(/\bchocolade (melk|puur|wit)\b/gi, "$1")
    .replace(/\binclusief\b/gi, "incl.").replace(/\bcirca\b/gi, "ca.")
    .replace(/\s*\(\+\s*€[^)]*\)/g, "").replace(/\bgram\b/gi, "g");
}

/** Keep packing, contents and delivery instructions, not accounting/email history.
 * Explicit packaging/text fields are never filtered. No length-based truncation. */
export function distributionNotes(row: WorkOverviewRow, products: string[]) {
  const { order, data } = row;
  const operational = /verpak|cadeau|doos|dozen|krat|zak|tasje|lint|sticker|kaartje|gedicht|logo|qr-code|decor|afwerk|noten|gluten|lactose|vegan|allerg|apart|herkenbaar|aflever|afhal|ophal|bezorg|levering|leveren|ingang|beveiliging|route\s*\d|uur|\d[:.]\d{2}|per pakket|pakketinhoud|strooigoed|crumble|balletjes|verdeling|verdelen|vestiging|stuks|gram|verrassing|geen info|bgg/i;
  const admin = /€|\bbtw\b|factuur|factur|inkoop|staffel|prijs|korting|kosten|offerte|akkoord|artikelnummer|\bbake.it\b|correspondentie|contactpersoon:|e-mail|website:|afkomstig|oorsprong|overgenomen|\bmail\b|orderinvoer|ingevoerd|verbijzondering|crediteuren|postbus|definitieve bestelling|productie\s+(?:ma|di|wo|do|vr|za|zo)|letters maken op/i;
  const known = key(products.join(" "));
  const candidates = data.notes.flatMap(value => value.split(/\r?\n/)).filter(value => !/^Inbegrepen in de pakketten:/i.test(value));
  candidates.push(...order.importantNotes.split(/\r?\n/).filter(value => operational.test(value)));
  const filtered = candidates.flatMap(value => value.split(/(?<=[.!?])\s+(?=[A-ZÀ-Ý])/)).filter(value => {
    if (!value.trim() || /^(?:PRODUCTEN EN PRIJS|OVERIGE ORDERAFSPRAKEN|BEDRIJF EN CONTACT)$/i.test(value.trim())) return false;
    if (/\b(?:verpakking|bezorging) in overleg\b/i.test(value)) return false;
    if (admin.test(value) || !operational.test(value)) return false;
    if (/^(?:Eigen logo volgens orderregels|Geen logo aangevraagd|Logo geupload|Verpakking is als aparte productregel|Letters moeten vóór dit bezorgmoment)/i.test(value)) return false;
    if (/^(?:Totale bestelling:|Deel \d+ van \d+|Verdeling kleine spuitletter|LETTERVERDELING:|\d+ kleine Sintpakketten uit de folder)/i.test(value)) return false;
    if (row.order.packaging && /^(?:Per pakket|Pakketinhoud|\d+ gelijke|\d+ kleine Sintpakketten;|\d+ (?:grote|extra zakje))/i.test(value)) return false;
    // The date and address already have their own columns. Retain time/entrance exceptions.
    if (/^(?:afhalen|afleveren|bezorgen|levering|leveren|De bestaande klantafspraak)/i.test(value)
      && !/uur|\d[:.]\d{2}|ochtend|middag|avond|uiterlijk|ingang|beveiliging|route\s*\d|refter|apart|bel/i.test(value)) return false;
    if (/^(?:\d+ grote spuitletters|\d+ grote chocoladeletters|Kleine spuitletters)\b/i.test(value)) return false;
    return !known.includes(key(value));
  });
  const explicit = [order.packaging, order.textInstructions].flatMap(value => value.split(/\r?\n|(?<=[.!?])\s+(?=[A-ZÀ-Ý])/))
    .filter(value => value && !/^(?:Verpakkingskosten|Geen staffelkorting|Niet nogmaals toevoegen)/i.test(value));
  // Detailed package contents can be in the order text even when packaging only says "one letter per packet".
  const contents = candidates.flatMap(value => value.split(/(?<=[.!?])\s+(?=[A-ZÀ-Ý])/))
    .filter(value => /^Pakketinhoud per pakket:/i.test(value));
  explicit.push(...contents);
  const notes = unique([...explicit, ...filtered].map(value => compactText(value).replace(/^Wensen uit aanvraag:\s*/i, "")));
  return notes.filter((note, i) => !notes.some((other, j) => i !== j && other.length > note.length && key(other).includes(key(note))));
}

function distributionRow(row: WorkOverviewRow, options: WorkOverviewOptions): DistributionRow {
  const compact = compactWorkRow(row, { ...options, internalNotes: false });
  const products = compact.products.filter(value => !/^\d+× (?:Inpakken van|Cadeaupapier|Verpakkingskosten)/i.test(value))
    .map(compactText);
  const packageLetters = row.order.letterLines.filter(b2bLetterInPackage);
  if (packageLetters.length) {
    const groups = new Map<string, Map<string, number>>();
    for (const letter of packageLetters) {
      const variant = [letter.chocolate, letter.size, letter.style, ...letter.exceptions, letter.withLogo ? "logo" : "", letter.decoration || ""].filter(Boolean).join(" · ");
      if (!groups.has(variant)) groups.set(variant, new Map());
      const letters = groups.get(variant)!;
      letters.set(letter.letter, (letters.get(letter.letter) || 0) + letter.quantity);
    }
    products.push(`In pakket: ${[...groups].map(([variant, letters]) => `${variant}: ${[...letters].map(([letter, quantity]) => `${quantity}×${letter}`).join(", ")}`).join("; ")}`);
  }
  const notes = distributionNotes(row, products);
  let label = "AFSTEMMEN", address = "Afhalen / bezorgen nog afspreken";
  if (row.data.location) {
    label = row.data.location.label === "Afhaaladres" ? "AFHALEN" : row.data.location.label === "Bezorgadres" ? "BEZORGEN" : "LEVERING";
    address = compactText(row.data.location.address).replace(/^Strik /, "");
  }
  // Keep entrance instructions with the order, rather than enlarging the address column.
  if (label === "BEZORGEN") {
    const lines = row.order.deliveryAddress.split(/\r?\n/).map(clean).filter(Boolean);
    const instructions = lines.filter(line => /bezorger|aanbellen|beveiliging|graag afleveren/i.test(line));
    if (instructions.length) {
      address = lines.filter(line => !instructions.includes(line)).join(", ");
      notes.push(...instructions.map(compactText));
    }
  }
  address = clean(address).replace(/(\d{1,4})(\d{4})\s*([A-Z]{2})\b/g, "$1, $2 $3")
    .replace(/\b(\d{4})([A-Z]{2})\b/g, "$1 $2");
  if (key(address).startsWith(key(row.order.customerName))) {
    address = address.slice(clean(row.order.customerName).length).replace(/^[,\s]+/, "") || address;
  }
  return { id: row.order.id, customer: clean(row.order.customerName), products, notes: unique(notes),
    logo: Boolean(compact.logo), locationLabel: label, address };
}

/** Ranges/weeks are never placed under an invented date or repeated across days. */
export function distributionDays(entries: WorkOverviewEntry[], options: DistributionOptions): DistributionDay[] {
  const rows = workOverviewRows(entries, { ...options, includeUndated: false });
  const days = new Map<string, DistributionRow[]>();
  for (const row of rows) {
    if (row.window?.type !== "date" || row.window.start !== row.window.end) continue;
    if (!days.has(row.window.start)) days.set(row.window.start, []);
    days.get(row.window.start)!.push(distributionRow(row, options));
  }
  return [...days].map(([date, orders]) => ({ date, rows: orders }));
}

export function distributionExcludedCount(entries: WorkOverviewEntry[], options: DistributionOptions) {
  return workOverviewRows(entries, options).filter(({ order }) => businessDeliveryWindow(order)?.type !== "date").length;
}

export function distributionDateLabel(date: string) {
  const value = new Date(`${date}T12:00:00Z`);
  return `${["ZO", "MA", "DI", "WO", "DO", "VR", "ZA"][value.getUTCDay()]} ${value.getUTCDate()} ${["jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec"][value.getUTCMonth()]}`;
}
