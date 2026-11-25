import { businessDeliveryWindow, validBusinessDate } from "../../lib/businessOrderDeliveries";
import { formatBusinessDeliveryMoment } from "../../lib/businessDeliveryMoment";
import { orderBelongsToSeason, seasonLabel, type BusinessSeason } from "../../lib/businessSeasons";
import { logoOrderRequested } from "./logos/model";
import type { SinterklaasB2BOrder } from "../types";
import type { OrderPrintData } from "./orderPrint";

export type WorkOverviewEntry = { order: SinterklaasB2BOrder; data: OrderPrintData; made: boolean; hasLetters: boolean; lettersMade: boolean };
export type WorkOverviewOptions = { from: string; year: string; season: BusinessSeason | "all"; generatedAt: string };
export type WorkOverviewRow = WorkOverviewEntry & { window: ReturnType<typeof businessDeliveryWindow> };

export function workOverviewToday(now = new Date()) {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Amsterdam", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/** Search/status filters in the list must never silently omit work from the printout. */
export function workOverviewRows(entries: WorkOverviewEntry[], options: WorkOverviewOptions): WorkOverviewRow[] {
  if (!validBusinessDate(options.from)) return [];
  return entries.filter(({order}) => order.year === options.year && order.status === "akkoord"
    && !order.cancelled && !order.delivered && !order.id.startsWith("historie-")
    && (options.season === "all" || orderBelongsToSeason(order, options.season)))
    .map(entry => ({ ...entry, window: businessDeliveryWindow(entry.order) }))
    .filter(row => !row.window || row.window.end >= options.from)
    .sort((a, b) => (a.window?.start || "9999").localeCompare(b.window?.start || "9999")
      || a.order.customerName.localeCompare(b.order.customerName, "nl") || a.order.id.localeCompare(b.order.id));
}

const escape = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
const text = (value: string) => escape(value).replace(/\r?\n/g, "<br>");
const state = (done: boolean, label: string) => `<div class="state"><span class="box">${done ? "✓" : ""}</span>${escape(label)} <b>${done ? "klaar" : "open"}</b></div>`;

/** Plain, escaped HTML in an isolated print frame; long orders may continue on a new page. */
export function workOverviewHtml(rows: WorkOverviewRow[], options: WorkOverviewOptions) {
  const when = new Intl.DateTimeFormat("nl-NL", {dateStyle:"short",timeStyle:"short",timeZone:"Europe/Amsterdam"}).format(new Date(options.generatedAt));
  const scope = options.season === "all" ? "Sint & Kerst" : seasonLabel(options.season);
  function table(entries: WorkOverviewRow[]) {
    return `<table><colgroup><col style="width:23%"><col style="width:57%"><col style="width:20%"></colgroup><thead><tr><th>Klant & levering</th><th>Voorbereiden & inpakken</th><th>Voortgang</th></tr></thead><tbody>${entries.map(({order,data,made,hasLetters,lettersMade,window}) => {
      const notes = [...new Set([...data.notes, ...(order.importantNotes.trim() ? [`Intern: ${order.importantNotes.trim()}`] : [])].map(note=>note.trim()).filter(Boolean))];
      return `<tr><td><h3>${text(order.customerName)}</h3><b>${window ? text(formatBusinessDeliveryMoment(window.start,window.end)) : "Datum nog afspreken"}</b><div class="muted">${escape(seasonLabel(order.season))}</div>${data.location ? `<p><b>${escape(data.location.label)}</b><br>${text(data.location.address)}</p>` : "<p>Afhalen/bezorgen nog afspreken</p>"}${order.productionDate ? `<div class="muted">Productie: ${text(formatBusinessDeliveryMoment(order.productionDate))}</div>` : ""}</td>
      <td>${data.lines.map(line=>`<div class="product"><b>${line.quantity !== undefined ? `${line.quantity}× ` : ""}</b>${text(line.description)}${line.attention?.length ? `<div class="attention">${line.attention.map(text).join(" · ")}</div>` : ""}${line.instructions?.length ? `<div class="instructions">${line.instructions.map(text).join(" · ")}</div>` : ""}</div>`).join("")}${notes.length ? `<div class="notes"><b>Let op / afspraken</b><br>${notes.map(text).join("<br>")}</div>` : ""}</td>
      <td>${state(order.entered,"Bake-it")}${state(made,"Gemaakt")}${hasLetters && !made ? state(lettersMade,"Letters") : ""}${state(order.packed,"Ingepakt")}${logoOrderRequested(order) ? `<div class="logo"><b>Logo’s:</b> ${order.logoPrintComplete === true ? "geprint" : order.logoAttachmentCount ? "nog printen" : "bestand controleren"}</div>` : ""}<div class="checkline">Controle / paraaf:<br>________________</div></td></tr>`;
    }).join("")}</tbody></table>`;
  }
  const dated = rows.filter(row=>row.window), undated = rows.filter(row=>!row.window);
  return `<!doctype html><html lang="nl"><head><meta charset="utf-8"><title>B2B werkoverzicht vanaf ${escape(options.from)}</title><style>
  @page{size:A4 portrait;margin:9mm}*{box-sizing:border-box}body{font:9pt/1.32 Arial,sans-serif;color:#172b25;margin:0;background:white}header{border-bottom:2px solid #263c31;padding-bottom:3mm;margin-bottom:4mm}h1{font-size:17pt;margin:0 0 1mm}header p{margin:1mm 0}.muted{color:#58645c;font-size:8pt}.summary{font-weight:bold}h2{font-size:11pt;margin:5mm 0 2mm}h3{font-size:10pt;margin:0 0 1.5mm}table{width:100%;border-collapse:collapse;table-layout:fixed}thead{display:table-header-group}th{background:#edf1eb;text-align:left;font-size:8pt;padding:2mm;border-bottom:1px solid #88998d}td{vertical-align:top;padding:2.3mm 2mm;border-bottom:1px solid #bec7bd;overflow-wrap:anywhere}tr{break-inside:avoid;page-break-inside:avoid}td p{margin:2mm 0 0}.product+.product{margin-top:1.2mm}.attention{font-weight:bold}.instructions{font-style:italic}.notes{border-left:2px solid #536952;margin-top:2mm;padding-left:2mm}.state{display:flex;align-items:baseline;gap:1mm;font-size:8pt;margin-bottom:1mm}.state b{margin-left:auto}.box{display:inline-block;width:3mm;min-width:3mm;height:3mm;border:1px solid #647464;line-height:2.6mm;text-align:center;font-size:8pt}.logo{margin-top:2mm;font-size:8pt}.checkline{margin-top:3mm;color:#576357;font-size:8pt}footer{margin-top:3mm;font-size:8pt;color:#58645c}@media screen{body{padding:18px;max-width:900px;margin:auto}header{position:static}}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}h2{break-after:avoid}}
  </style></head><body><header><h1>B2B werkoverzicht</h1><p>${escape(scope)} · ${escape(options.year)} · levering vanaf ${escape(formatBusinessDeliveryMoment(options.from))}</p><p class="summary">${rows.length} bestellingen · ${rows.filter(row=>!row.made).length} nog maken · ${rows.filter(row=>!row.order.packed).length} nog inpakken</p><p class="muted">Momentopname ${escape(when)} · Definitief en nog niet geleverd. Aangevinkt = klaar; leeg = nog open.</p></header>${dated.length ? table(dated) : ""}${undated.length ? `<h2>Leverdatum nog afspreken · ${undated.length} bestellingen</h2>${table(undated)}` : ""}${!rows.length ? "<p>Geen nog te leveren bestellingen vanaf deze datum.</p>" : ""}<footer>Handmatige controle op papier verandert de status in de app niet.</footer></body></html>`;
}
