import type { RecepturenData } from "../bakkerij/recepturen/recepturenApi";
import type { ProductionDocument } from "./documents.server";
import { addDays, DEPARTMENTS, mondayOf, weekNumber } from "./planning";
import type { PreviewState } from "./planning";

export const WEEKLY_ARCHIVE_RECIPIENT = "feline@strik-patisserie.nl";
export const WEEKLY_ARCHIVE_HOUR = 7;
export type WeeklyMailStatus = "pending" | "sending" | "sent" | "checking";
export type WeeklyArchiveSummary = {
  weekStart: string;
  weekEnd: string;
  label: string;
  capturedAt: string;
  taskCount: number;
  doneCount: number;
  outputTaskCount: number;
};
export type WeeklyArchiveSnapshot = {
  format: "strik-production-week";
  version: 1;
  summary: WeeklyArchiveSummary;
  planner: ProductionDocument<PreviewState>;
  recipes: ProductionDocument<RecepturenData>;
  scope: "complete-planner-and-production-recipe-catalog";
};
export type WeeklyArchiveEntry = WeeklyArchiveSummary & {
  sha256: string;
  mailStatus: WeeklyMailStatus;
  attempts: number;
  lastAttemptAt?: string;
  sentAt?: string;
  claimId?: string;
};
export type WeeklyArchiveIndex = {
  revision: number;
  enabledAt: string;
  enabledFromWeek: string;
  weeks: WeeklyArchiveEntry[];
};
export type WeeklyArchiveListing = {
  enabledFromWeek: string | null;
  scheduledHour: number;
  timeZone: "Europe/Amsterdam";
  recipient: string;
  weeks: WeeklyArchiveEntry[];
};

export function amsterdamCalendar(now: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Amsterdam", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23",
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(row => row.type === type)!.value;
  return { date: `${part("year")}-${part("month")}-${part("day")}`, hour: Number(part("hour")) };
}

export function validArchiveWeek(value: string) {
  try { return /^\d{4}-\d{2}-\d{2}$/.test(value) && mondayOf(value) === value; } catch { return false; }
}

export function firstArchiveWeek(now: Date) {
  const { date } = amsterdamCalendar(now);
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
  return mondayOf(weekday === 0 ? addDays(date, -1) : date);
}

export function lastDueArchiveWeek(now: Date) {
  const { date, hour } = amsterdamCalendar(now);
  const monday = mondayOf(date);
  const sunday = addDays(monday, 6);
  // A week closes after Saturday. Sunday tasks, if any, remain in the full backup.
  return date === sunday && hour >= WEEKLY_ARCHIVE_HOUR ? monday : addDays(monday, -7);
}

export function archiveSummary(weekStart: string, state: PreviewState, capturedAt: string): WeeklyArchiveSummary {
  if (!validArchiveWeek(weekStart)) throw Error("Ongeldige archiefweek.");
  const weekEnd = addDays(weekStart, 5);
  const tasks = state.tasks.filter(task => task.date >= weekStart && task.date <= weekEnd);
  const date = new Intl.DateTimeFormat("nl-NL", { timeZone: "UTC", day: "numeric", month: "short" });
  const label = `Week ${weekNumber(weekStart)} · ${date.format(new Date(`${weekStart}T12:00:00Z`))} t/m ${date.format(new Date(`${weekEnd}T12:00:00Z`))} ${weekEnd.slice(0, 4)}`;
  return { weekStart, weekEnd, label, capturedAt, taskCount: tasks.length, doneCount: tasks.filter(task => task.status === "done").length, outputTaskCount: tasks.filter(task => task.recordsOutput && !task.stockFulfillmentId).length };
}

export function createArchiveSnapshot(weekStart: string, planner: ProductionDocument<PreviewState>, recipes: ProductionDocument<RecepturenData>, capturedAt: string): WeeklyArchiveSnapshot {
  // Preserve the exact planner, including cross-week dependencies, recipes plans,
  // stock checkpoints, timers, completions and original work measurements.
  const productionRecipes: RecepturenData = {
    recipes: recipes.data.recipes,
    ingredients: recipes.data.ingredients,
    packagingItems: recipes.data.packagingItems || [],
    manualProductionPlanningItems: recipes.data.manualProductionPlanningItems || [],
    invoiceImports: [],
    updatedAt: recipes.data.updatedAt,
  };
  return structuredClone({
    format: "strik-production-week", version: 1,
    summary: archiveSummary(weekStart, planner.data, capturedAt),
    planner, recipes: { ...recipes, data: productionRecipes },
    scope: "complete-planner-and-production-recipe-catalog",
  });
}

function archiveRows(snapshot: WeeklyArchiveSnapshot) {
  const { planner: { data: state }, summary } = snapshot;
  return state.tasks.filter(task => task.date >= summary.weekStart && task.date <= summary.weekEnd)
    .sort((a, b) => a.date.localeCompare(b.date) || a.departmentId.localeCompare(b.departmentId) || a.id.localeCompare(b.id))
    .map(task => {
      const item = state.items.find(row => row.id === task.itemId);
      const completion = state.productionWork?.completions?.[task.id];
      const stock = state.productionWork?.stockFulfillments?.[task.id];
      return {
        date: task.date, department: DEPARTMENTS.find(row => row.id === task.departmentId)?.name || task.departmentId,
        product: item?.name || task.itemId, operation: task.operation, quantity: task.quantity, unit: item?.unit || "",
        status: task.stockFulfillmentId ? "Uit voorraad" : { planned: "Gepland", active: "Bezig", done: "Klaar", blocked: "Geblokkeerd" }[task.status],
        produced: task.recordsOutput && task.status === "done" && !task.stockFulfillmentId ? task.completedQuantity ?? task.quantity : "",
        minutes: completion?.minutes ?? "", crewSize: completion?.crewSize ?? "", laborMinutes: completion?.laborMinutes ?? "",
        who: completion?.who || stock?.who || "", note: task.note,
      };
    });
}

function escapeHtml(value: unknown) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

export function weeklyArchiveHtml(snapshot: WeeklyArchiveSnapshot, origin: string, limit = 40) {
  const { summary } = snapshot;
  const rows = archiveRows(snapshot);
  const path = `${origin}/api/productie/weekarchief/${summary.weekStart}`;
  const table = rows.slice(0, limit).map(row => `<tr><td>${escapeHtml(row.date.slice(5).split("-").reverse().join("-"))}</td><td>${escapeHtml(row.product)}<br><small>${escapeHtml(row.operation)}</small></td><td>${escapeHtml(row.quantity)} ${escapeHtml(row.unit)}</td><td>${escapeHtml(row.status)}</td></tr>`).join("");
  return `<!doctype html><html lang="nl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(summary.label)}</title></head><body style="margin:0;background:#f6f5ef;color:#1b3343;font:15px Arial,sans-serif"><main style="max-width:760px;margin:24px auto;background:white;padding:28px;border-radius:12px"><p style="letter-spacing:2px;font-size:12px">STRAK GEPLAND</p><h1 style="font-size:25px;margin-bottom:8px">${escapeHtml(summary.label)}</h1><p>${summary.doneCount} van ${summary.taskCount} taken klaar</p><table cellpadding="8" cellspacing="0" style="width:100%;border-collapse:collapse;text-align:left"><thead style="background:#c3d3bc"><tr><th>Dag</th><th>Product / taak</th><th>Ingepland</th><th>Status</th></tr></thead><tbody>${table}</tbody></table>${rows.length > limit ? `<p>De overige ${rows.length - limit} taken staan in het volledige overzicht.</p>` : ""}<p style="margin-top:24px"><a href="${escapeHtml(path)}?format=html">Weekoverzicht</a> &nbsp; <a href="${escapeHtml(path)}?format=csv">Excel-lijst</a> &nbsp; <a href="${escapeHtml(path)}?format=json">Volledige back-up</a></p><p style="font-size:12px;color:#54665d">Archief vastgelegd op ${escapeHtml(new Intl.DateTimeFormat("nl-NL", { timeZone: "Europe/Amsterdam", dateStyle: "short", timeStyle: "short" }).format(new Date(summary.capturedAt)))}. Open de links met je managementaccount.</p></main></body></html>`;
}

export function weeklyArchiveCsv(snapshot: WeeklyArchiveSnapshot) {
  const cell = (value: unknown) => {
    let text = String(value ?? "");
    if (typeof value === "string" && /^[\s]*[=+\-@\t\r]/.test(text)) text = `'${text}`;
    return `"${text.replaceAll('"', '""')}"`;
  };
  const header = ["Datum", "Afdeling", "Product", "Bewerking", "Gepland", "Eenheid", "Status", "Gemaakt", "Minuten", "Medewerkers", "Arbeidsminuten", "Naam", "Notitie"];
  return `\uFEFF${[header, ...archiveRows(snapshot).map(row => Object.values(row))].map(row => row.map(cell).join(";")).join("\r\n")}\r\n`;
}
