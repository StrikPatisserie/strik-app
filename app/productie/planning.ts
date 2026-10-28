// Pure production rules, shared by the preview and the future server adapter.
// Dates are local calendar dates. They are deliberately not elapsed 24h periods.
export const DEPARTMENTS = [
  { id: "dessert", name: "Desserttaart & fruit", short: "Dessert & fruit", tone: "sage", board: "patisserie" },
  { id: "luxe", name: "Luxe gebak", short: "Luxe gebak", tone: "rose", board: "patisserie" },
  { id: "kapsel", name: "Kapseltaarten", short: "Kapseltaarten", tone: "honey", board: "patisserie" },
  { id: "slagroom", name: "Slagroomgebak", short: "Slagroomgebak", tone: "blue", board: "patisserie" },
  { id: "bak", name: "Bakafdeling", short: "Bakafdeling", tone: "honey", board: "bak" },
  { id: "brood", name: "Broodafdeling", short: "Brood", tone: "sand", board: "brood" },
  { id: "ijs", name: "IJs", short: "IJs", tone: "blue", board: "ijs" },
  { id: "chocolade", name: "Chocolade", short: "Chocolade", tone: "rose", board: "chocolade" },
] as const;

export type DepartmentId = (typeof DEPARTMENTS)[number]["id"];
export type BoardId = (typeof DEPARTMENTS)[number]["board"];
export type TaskStatus = "planned" | "active" | "done" | "blocked";
export type ItemKind = "product" | "component" | "activity";
export type ItemUnit = "stuks" | "gram" | "kg" | "ml" | "liter" | "platen" | "taak";
export type Item = {
  id: string; name: string; kind: ItemKind; departmentId: DepartmentId;
  unit: ItemUnit; recipeId?: string; articleNumber?: string;
  note: string; stock: number; minimumStock?: number;
  stockKnown?: boolean; departmentUnconfirmed?: boolean;
  productionBlocked?: boolean;
};
export type Task = {
  id: string; itemId: string; departmentId: DepartmentId; date: string;
  quantity: number; operation: string; status: TaskStatus; minutes?: number;
  note: string; source: "manual" | "shop" | "order" | "routine";
  dueDate?: string; dependsOn?: string; batchId: string; recordsOutput: boolean;
};
export type DemoRecipe = {
  id: string; name: string; yield: number; unit: ItemUnit;
  ingredients: { name: string; quantity: number; unit: string }[];
  steps: string[]; allergens: string[];
  reviewRequired?: boolean;
};
export type PreviewState = { version: 1; items: Item[]; tasks: Task[] };

export const STATUS_LABELS: Record<TaskStatus, string> = { planned: "Gepland", active: "Bezig", done: "Klaar", blocked: "Geblokkeerd" };
export const SOURCE_LABELS: Record<Task["source"], string> = { manual: "Handmatig", shop: "Winkelbehoefte", order: "Bestelling", routine: "Vaste taak" };
export const KIND_LABELS: Record<ItemKind, string> = { product: "Product", component: "Onderdeel", activity: "Werkzaamheid" };
export const BOARDS: { id: BoardId; name: string }[] = [
  { id: "patisserie", name: "Patisserie" }, { id: "bak", name: "Bakafdeling" },
  { id: "brood", name: "Brood" }, { id: "ijs", name: "IJs" }, { id: "chocolade", name: "Chocolade" },
];

function calendarDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw Error("Ongeldige datum.");
  const date = new Date(`${value}T12:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw Error("Ongeldige datum.");
  return date;
}
export function addDays(value: string, days: number) {
  const date = calendarDate(value);
  if (!Number.isInteger(days)) throw Error("Ongeldig aantal dagen.");
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
export function mondayOf(value: string) {
  const date = calendarDate(value);
  return addDays(value, -((date.getUTCDay() + 6) % 7));
}
export function weekNumber(value: string) {
  const date = calendarDate(value);
  date.setUTCDate(date.getUTCDate() + 3 - ((date.getUTCDay() + 6) % 7));
  return Math.ceil(((date.getTime() - Date.UTC(date.getUTCFullYear(), 0, 1)) / 86400000 + 1) / 7);
}
export function dateLabel(value: string, long = false) {
  return new Intl.DateTimeFormat("nl-NL", { timeZone: "UTC", weekday: "short", day: "numeric", ...(long ? { month: "short" } : {}) }).format(calendarDate(value)).replaceAll(".", "");
}
export function weekLabel(value: string) {
  const end = addDays(value, 6);
  const fmt = new Intl.DateTimeFormat("nl-NL", { timeZone: "UTC", day: "numeric", month: "short" });
  return `${fmt.format(calendarDate(value))} – ${fmt.format(calendarDate(end))} ${calendarDate(end).getUTCFullYear()}`;
}
export function durationLabel(minutes: number) {
  const hours = Math.floor(minutes / 60), remainder = minutes % 60;
  return hours ? `${hours}u${remainder ? ` ${remainder}m` : ""}` : `${remainder}m`;
}
export function departmentsFor(board: BoardId) { return DEPARTMENTS.filter(d => d.board === board); }
export function taskIssues(task: Task, tasks: Task[], items: Item[] = []): string[] {
  const issues: string[] = [];
  if (items.find(i=>i.id===task.itemId)?.productionBlocked) issues.push("Het bronrecept heeft ontbrekende verwijzingen. Controleer dit recept eerst.");
  if (task.dependsOn) {
    const prior = tasks.find(t => t.id === task.dependsOn);
    if (!prior) issues.push("Voorgaande stap ontbreekt.");
    else {
      if (prior.date > task.date) issues.push("Voorgaande stap staat later ingepland.");
      if (prior.status !== "done") issues.push(`Wacht op ${prior.operation.toLocaleLowerCase("nl-NL")} (${dateLabel(prior.date)}).`);
    }
  }
  if (task.dueDate && task.date > task.dueDate) issues.push("Gepland na de benodigde datum.");
  if (task.status === "blocked") issues.push(task.note || "Deze taak is geblokkeerd; controleer de oorzaak.");
  return issues;
}
export function transitionTask(tasks: Task[], id: string, status: TaskStatus, items: Item[] = []): Task[] {
  if (!Object.hasOwn(STATUS_LABELS, status)) throw Error("Onbekende status.");
  const task = tasks.find(t => t.id === id);
  if (!task) throw Error("Taak niet gevonden.");
  if (task.status === "blocked" && (status === "active" || status === "done")) throw Error("Hef de blokkade eerst op door de taak weer op Gepland te zetten.");
  if (status === "done" || status === "active") {
    const issues = taskIssues({ ...task, status }, tasks,items);
    if (issues.length) throw Error(issues[0]);
  }
  if (task.status === "done" && status !== "done" && tasks.some(t => t.dependsOn === id && (t.status === "done" || t.status === "active"))) {
    throw Error("Een volgende stap is al gestart. Heropen die eerst.");
  }
  return tasks.map(t => t.id === id ? { ...t, status } : t);
}
export function moveTask(tasks: Task[], id: string, date: string, departmentId: DepartmentId): Task[] {
  calendarDate(date);
  if (!DEPARTMENTS.some(d => d.id === departmentId)) throw Error("Onbekende afdeling.");
  const task = tasks.find(t => t.id === id);
  if (!task) throw Error("Taak niet gevonden.");
  if (task.status === "done") throw Error("Heropen de taak voordat je deze verplaatst.");
  const prior = tasks.find(t => t.id === task.dependsOn);
  const next = tasks.filter(t => t.dependsOn === id);
  if (prior && prior.date > date) throw Error("Plan deze stap op of na de voorgaande stap.");
  if (next.some(t => t.date < date)) throw Error("Een volgende stap staat eerder. Verplaats die eerst.");
  if (task.dueDate && date > task.dueDate) throw Error("Deze datum ligt na de benodigde datum.");
  return tasks.map(t => t.id === id ? { ...t, date, departmentId } : t);
}
export function addTask(state: PreviewState, task: Task): PreviewState {
  if (state.tasks.some(t => t.id === task.id)) throw Error("Deze taak bestaat al.");
  const item = state.items.find(i => i.id === task.itemId);
  if (!item) throw Error("Kies een bestaand onderdeel.");
  if (item.productionBlocked) throw Error("Dit bronrecept heeft ontbrekende grondstoffen of onderdelen. Controleer de koppelingen eerst.");
  calendarDate(task.date);
  if (task.dueDate) calendarDate(task.dueDate);
  if (!DEPARTMENTS.some(d => d.id === task.departmentId)) throw Error("Onbekende afdeling.");
  if (!Object.hasOwn(SOURCE_LABELS, task.source)) throw Error("Onbekende herkomst.");
  if (!task.operation.trim() || task.operation.length > 100) throw Error("Vul een korte werkzaamheid in.");
  if (!Number.isFinite(task.quantity) || task.quantity <= 0 || task.quantity > 1000000) throw Error("Vul een geldig aantal groter dan nul in.");
  if (task.minutes !== undefined && (!Number.isFinite(task.minutes) || task.minutes < 0 || task.minutes > 1440)) throw Error("Vul een geldige werktijd in.");
  if (task.status !== "planned") throw Error("Een nieuwe taak begint als gepland.");
  if (!task.batchId || (task.recordsOutput && item.kind === "activity")) throw Error("Deze werkzaamheid levert geen voorraad op.");
  if (task.recordsOutput && state.tasks.some(t => t.batchId === task.batchId && t.recordsOutput)) throw Error("Deze batch heeft al een stap die voorraad registreert.");
  if (task.dependsOn) {
    const prior = state.tasks.find(t => t.id === task.dependsOn);
    if (!prior || prior.batchId !== task.batchId || prior.itemId !== task.itemId || prior.date > task.date) throw Error("Kies een eerdere stap van hetzelfde onderdeel en dezelfde batch.");
  }
  if (state.tasks.some(t => t.batchId === task.batchId && t.itemId !== task.itemId)) throw Error("Een batch hoort bij één onderdeel.");
  if (task.dueDate && task.date > task.dueDate) throw Error("De plandatum ligt na de benodigde datum.");
  return { ...state, tasks: [...state.tasks, { ...task, operation: task.operation.trim(), note: task.note.slice(0, 1000) }] };
}
export function addItem(state: PreviewState, item: Item): PreviewState {
  if (!item.id || state.items.some(i => i.id === item.id)) throw Error("Dit onderdeel bestaat al.");
  if (!item.name.trim() || item.name.length > 120) throw Error("Vul een naam van maximaal 120 tekens in.");
  if (state.items.some(i => i.name.trim().toLocaleLowerCase("nl-NL") === item.name.trim().toLocaleLowerCase("nl-NL"))) throw Error("Deze naam bestaat al. Selecteer het bestaande onderdeel.");
  if (!DEPARTMENTS.some(d => d.id === item.departmentId)) throw Error("Onbekende afdeling.");
  if (!["product", "component", "activity"].includes(item.kind) || !["stuks", "gram", "kg", "ml", "liter", "platen", "taak"].includes(item.unit)) throw Error("Ongeldig type of eenheid.");
  if (item.recipeId) throw Error("Koppel een recept via de gecontroleerde receptkeuze.");
  if (item.stock !== 0) throw Error("Een nieuw onderdeel begint zonder voorraadregistratie.");
  return { ...state, items: [...state.items, { ...item, name: item.name.trim(), note: item.note.slice(0, 1000) }] };
}
export function linkRecipe(state: PreviewState, itemId: string, recipeId: string, recipes: DemoRecipe[]): PreviewState {
  const item = state.items.find(i => i.id === itemId), recipe = recipes.find(r => r.id === recipeId);
  if (!item || !recipe) throw Error("Onderdeel of recept niet gevonden.");
  if (item.kind === "activity" || item.unit !== recipe.unit) throw Error("De eenheid van het recept past niet bij dit onderdeel.");
  return { ...state, items: state.items.map(i => i.id === itemId ? { ...i, recipeId } : i) };
}
export function completedOutput(items: Item[], tasks: Task[]): Map<string, number> {
  const result = new Map<string, number>(), batches = new Set<string>();
  for (const task of tasks) {
    if (task.status !== "done" || !task.recordsOutput) continue;
    if (batches.has(task.batchId)) throw Error("Dubbele voorraadregistratie in dezelfde batch.");
    if (!items.some(i => i.id === task.itemId && i.kind !== "activity")) throw Error("Onbekend voorraadonderdeel.");
    batches.add(task.batchId);
    result.set(task.itemId, (result.get(task.itemId) || 0) + task.quantity);
  }
  return result;
}
