import { businessDeliveryWindow, validBusinessDate } from "../../lib/businessOrderDeliveries";
import { formatBusinessDeliveryMoment } from "../../lib/businessDeliveryMoment";
import { orderBelongsToSeason, seasonLabel, type BusinessSeason } from "../../lib/businessSeasons";
import { logoOrderRequested } from "./logos/model";
import type { SinterklaasB2BOrder } from "../types";
import type { OrderPrintData } from "./orderPrint";

export type WorkOverviewEntry = { order: SinterklaasB2BOrder; data: OrderPrintData; made: boolean; hasLetters: boolean; lettersMade: boolean };
export type WorkOverviewOptions = { from: string; to?: string; year: string; season: BusinessSeason | "all"; generatedAt: string; includeUndated?: boolean; internalNotes?: boolean };
export type WorkOverviewRow = WorkOverviewEntry & { window: ReturnType<typeof businessDeliveryWindow> };
export type CompactWorkRow = { customer: string; delivery: string; location: string; products: string[]; notes: string[]; states: { done: boolean; label: string }[]; payment: string; logo: string };

export function workOverviewToday(now = new Date()) {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Amsterdam", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}
export function workOverviewEnd(from: string, days = 6) {
  const date = new Date(`${from}T12:00:00Z`); date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
export function workOverviewRangeValid(options: Pick<WorkOverviewOptions, "from" | "to">) {
  return validBusinessDate(options.from) && (!options.to || validBusinessDate(options.to) && options.to >= options.from);
}

/** Include overlapping delivery windows; never imply a week/range is an exact day. */
export function workOverviewRows(entries: WorkOverviewEntry[], options: WorkOverviewOptions): WorkOverviewRow[] {
  if (!workOverviewRangeValid(options)) return [];
  return entries.filter(({order}) => order.year === options.year && order.status === "akkoord"
    && !order.cancelled && !order.delivered && !order.id.startsWith("historie-")
    && (options.season === "all" || orderBelongsToSeason(order, options.season)))
    .map(entry => ({ ...entry, window: businessDeliveryWindow(entry.order) }))
    .filter(row => row.window ? row.window.end >= options.from && (!options.to || row.window.start <= options.to) : options.includeUndated === true)
    .sort((a, b) => (a.window?.start || "9999").localeCompare(b.window?.start || "9999")
      || a.order.customerName.localeCompare(b.order.customerName, "nl") || a.order.id.localeCompare(b.order.id));
}
const clean = (value: string) => value.replace(/\s+/g, " ").trim();
const key = (value: string) => clean(value).toLocaleLowerCase("nl-NL");
const unique = (values: string[]) => [...new Map(values.map(value=>[key(value),clean(value)] as const).filter(([id])=>id)).values()];

/** Group only identical letter variants, including every diet/decor/wrapping instruction. */
export function compactWorkRow(row: WorkOverviewRow, options: WorkOverviewOptions): CompactWorkRow {
  const {order,data,made,hasLetters,lettersMade,window} = row;
  const sharedInstructions = data.lines.length ? unique(data.lines[0].instructions || [])
    .filter(instruction=>data.lines.every(line=>(line.instructions||[]).some(value=>key(value)===key(instruction)))) : [];
  const sharedKeys = new Set(sharedInstructions.map(key));
  const groups = new Map<string,{quantity:number;variant:string;letters:Map<string,number>;details:string[]}>();
  const products: (string|ReturnType<typeof groups.get>)[] = [];
  for (const line of data.lines) {
    const parts = clean(line.description).split(" · ");
    const visibleDetails = new Set(parts.flatMap(part=>part.split(/,\s*/)).map(key));
    const details = unique([...(line.attention||[]).filter(value=>!visibleDetails.has(key(value))),
      ...(line.instructions||[]).filter(value=>!sharedKeys.has(key(value)))]);
    const letter = clean(line.description).match(/^([A-Z]) · ((?:melk|puur|wit) (?:spuit|vorm) · (?:klein|groot)(?: · .+)?)$/);
    if (letter && line.quantity !== undefined) {
      const id = JSON.stringify([letter[2],details]);
      let group = groups.get(id);
      if (!group) { group={quantity:0,variant:letter[2],letters:new Map(),details}; groups.set(id,group); products.push(group); }
      group.quantity+=line.quantity; group.letters.set(letter[1],(group.letters.get(letter[1])||0)+line.quantity);
    } else products.push(`${line.quantity !== undefined ? `${line.quantity}× ` : ""}${clean(line.description)}${details.length ? ` · ${details.join(" · ")}` : ""}`);
  }
  const notes = unique([...sharedInstructions, ...data.notes,
    ...(options.internalNotes && order.importantNotes.trim() ? [`Intern: ${order.importantNotes}`] : [])]);
  return {
    customer:clean(order.customerName),
    delivery:window ? formatBusinessDeliveryMoment(window.start,window.end).replaceAll(` ${options.year}`,"").replace(/^Tussen /,"Periode: ").replace(" en "," – ") : "Datum nog afspreken",
    location:data.location ? `${data.location.label === "Afhaaladres" ? "Afhalen" : data.location.label === "Bezorgadres" ? "Bezorgen" : data.location.label}: ${clean(data.location.address)}` : "Afhalen/bezorgen afspreken",
    products:products.flatMap(item=>!item?[]:typeof item==='string'?[item]:[`${item.quantity}× ${item.variant}: ${[...item.letters].map(([letter,quantity])=>`${quantity}× ${letter}`).join(", ")}${item.details.length?` · ${item.details.join(" · ")}`:""}`]),
    notes,
    states:[{done:order.entered,label:"Bake-it"},{done:made,label:"Gemaakt"},...(hasLetters&&!made?[{done:lettersMade,label:"Letters"}]:[]),{done:order.packed,label:"Ingepakt"}],
    payment:order.paidInStore ? "Betaald in winkel · geen factuur" : "Op factuur",
    logo:logoOrderRequested(order)?`Logo: ${order.logoPrintComplete===true?"geprint":order.logoAttachmentCount?"nog printen":"bestand controleren"}`:"",
  };
}
export function workOverviewHeading(rows: WorkOverviewRow[], options: WorkOverviewOptions) {
  const scope=options.season==='all'?'Sint & Kerst':seasonLabel(options.season);
  const when=new Intl.DateTimeFormat('nl-NL',{dateStyle:'short',timeStyle:'short',timeZone:'Europe/Amsterdam'}).format(new Date(options.generatedAt));
  return {
    title:'B2B werkoverzicht',
    period:`${scope} · ${options.to ? `${formatBusinessDeliveryMoment(options.from)} t/m ${formatBusinessDeliveryMoment(options.to)}` : `vanaf ${formatBusinessDeliveryMoment(options.from)}`}`,
    summary:`${rows.length} bestellingen · ${rows.filter(row=>!row.made).length} nog maken · ${rows.filter(row=>!row.order.packed).length} nog inpakken · ${when}`,
    footer:`Aangevinkt = klaar · ${options.internalNotes?'Inclusief interne notities':'Werkafspraken; zonder interne notities'} · ${options.includeUndated?'Zonder leverdatum onderaan':'Alleen gekozen leverperiode'}`,
  };
}
