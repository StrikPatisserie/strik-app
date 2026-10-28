// Pure production rules, shared by the preview and the future server adapter.
// Dates are local calendar dates. They are deliberately not elapsed 24h periods.
export const DEPARTMENTS = [
  { id: "dessert", name: "Desserttaart & fruit", short: "Dessert & fruit", tone: "sage", board: "patisserie" },
  { id: "luxe", name: "Luxe gebak", short: "Luxe gebak", tone: "rose", board: "patisserie" },
  { id: "kapsel", name: "Kapseltaarten", short: "Kapseltaarten", tone: "honey", board: "patisserie" },
  { id: "slagroom", name: "Slagroomgebak", short: "Slagroomgebak", tone: "blue", board: "patisserie" },
  { id: "bruidstaarten", name: "Bruidstaarten", short: "Bruidstaarten", tone: "rose", board: "patisserie" },
  { id: "bak", name: "Bakafdeling", short: "Bakafdeling", tone: "honey", board: "bak" },
  { id: "brood", name: "Brood", short: "Brood", tone: "sand", board: "bak" },
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
  requires?: string[]; generatedFor?: string;
  recipePlan?: RecipePlanSettings;
  weddingCode?: string; weddingDeliveryDate?: string;
};
export type PreparationChoice = { include?: boolean; date?: string; departmentId?: DepartmentId };
export type RecipePlanSettings = {
  amount: number; amountMode: "quantity" | "batches";
  preparation?: { daysBefore: number; choices: Record<string, PreparationChoice> };
};
export type DemoRecipe = {
  id: string; name: string; yield: number; unit: ItemUnit;
  ingredients: { name: string; quantity: number; unit: string }[];
  steps: string[]; allergens: string[];
  reviewRequired?: boolean;
  type?: "finalProduct" | "semiFinished";
  semiFinishedItems?: { recipeId: string; quantity: number; unit: string }[];
};
export type RemovedTask = { task: Task; removedAt: string; removedBy: string };
export type ProductionStaffingPerson = { employeeId:string; name:string; weekdays:number[]; weeklyHours:number|null; tasks:string };
export type ProductionStaffingSettings = { departmentIds:string[]; people:ProductionStaffingPerson[] };
export type CleaningCheck = { id:string; label:string; done:boolean; completedAt?:string; completedBy?:string };
export type CleaningDay = { id:string; date:string; main:CleaningCheck|null; daily:CleaningCheck[] };
export type CleaningCommand = { kind:"plan"; date:string; main:string; daily:string[]; repeatDates:string[] } | {kind:"check";date:string;checkId:string;done:boolean} | {kind:"remove";date:string} | {kind:"move";date:string;to:string};
export type PreviewState = { version: 1; items: Item[]; tasks: Task[]; removedTasks?: RemovedTask[]; staffing?:ProductionStaffingSettings; cleaning?:CleaningDay[] };
export function cleaningProgress(day:CleaningDay) {
  const checks=[...(day.main?[day.main]:[]),...day.daily],done=checks.filter(c=>c.done).length;
  return {done,total:checks.length,complete:checks.length>0 && done===checks.length};
}
export function validCleaningDays(value:unknown):value is CleaningDay[] {
  if(!Array.isArray(value) || value.length>10000)return false;
  const dates=new Set<string>(),ids=new Set<string>();
  try {for(const day of value as CleaningDay[]){
    if(!day || typeof day.date!=="string" || day.id!==`cleaning:${day.date}` || dates.has(day.date) || !Array.isArray(day.daily) || day.daily.length>40 || (!day.main && !day.daily.length))return false;
    addDays(day.date,0);dates.add(day.date);
    if(day.main!==null && (typeof day.main!=="object" || Array.isArray(day.main)))return false;
    for(const check of [...(day.main?[day.main]:[]),...day.daily]){
      if(!check || typeof check.id!=="string" || !check.id || check.id.length>200 || ids.has(check.id) || typeof check.label!=="string" || !check.label.trim() || check.label.length>300 || typeof check.done!=="boolean")return false;
      ids.add(check.id);
      if(check.done){if(typeof check.completedBy!=="string" || !check.completedBy || check.completedBy.length>200 || typeof check.completedAt!=="string" || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(check.completedAt) || !Number.isFinite(Date.parse(check.completedAt)))return false;}
      else if(check.completedAt!==undefined || check.completedBy!==undefined)return false;
    }
  }return true;}catch{return false;}
}
/** Cleaning is a separate checklist on the Patisserie board, without recipe,
 * ingredient, batch or stock side effects. Completion identity is server-owned. */
export function applyCleaningCommand(current:CleaningDay[],command:CleaningCommand,actor:string,now:string,createId:()=>string):CleaningDay[] {
  if(!validCleaningDays(current))throw Error("De bestaande schoonmaaklijst moet eerst worden gecontroleerd.");
  if(!command || typeof command.date!=="string")throw Error("Kies een geldige schoonmaakdatum.");
  addDays(command.date,0);
  const existing=current.find(d=>d.date===command.date);
  const requireDay=()=>{if(!existing)throw Error("Deze schoonmaakdag bestaat niet meer. Ververs de planning.");return existing;};
  let next:CleaningDay[];
  if(command.kind==="check"){
    const day=requireDay();if(typeof command.done!=="boolean" || ![...(day.main?[day.main]:[]),...day.daily].some(c=>c.id===command.checkId))throw Error("Kies een bestaande schoonmaaktaak.");
    const update=(check:CleaningCheck):CleaningCheck=>check.id!==command.checkId || check.done===command.done?check:command.done?{id:check.id,label:check.label,done:true,completedBy:actor,completedAt:now}:{id:check.id,label:check.label,done:false};
    next=current.map(d=>d.id===day.id?{...d,main:d.main?update(d.main):null,daily:d.daily.map(update)}:d);
  }else if(command.kind==="remove" || command.kind==="move"){
    const day=requireDay();if(cleaningProgress(day).done)throw Error("Deze dag bevat afgevinkte schoonmaaktaken. Heropen die eerst; uitgevoerde schoonmaak blijft bewaard.");
    if(command.kind==="move"){
      addDays(command.to,0);if(command.to!==day.date && current.some(d=>d.date===command.to))throw Error("Op die dag staat al een schoonmaaklijst. Pas de dag aan via de checklist.");
      next=current.map(d=>d.id===day.id?{...d,id:`cleaning:${command.to}`,date:command.to}:d);
    }else next=current.filter(d=>d.id!==day.id);
  }else if(command.kind==="plan"){
    const label=(value:unknown)=>{if(typeof value!=="string" || value.length>300)throw Error("Gebruik maximaal 300 tekens per schoonmaaktaak.");return value.trim();};
    const main=label(command.main);
    if(!Array.isArray(command.daily) || command.daily.length>40 || !Array.isArray(command.repeatDates) || command.repeatDates.length>6)throw Error("Gebruik maximaal 40 dagelijkse taken en zeven dagen per week.");
    const daily=command.daily.map(label).filter(Boolean);
    if(new Set(daily.map(s=>s.toLocaleLowerCase("nl-NL"))).size!==daily.length)throw Error("Een dagelijkse taak staat dubbel in de lijst.");
    const dates=[command.date,...command.repeatDates];
    if(new Set(dates).size!==dates.length || dates.some(d=>typeof d!=="string" || mondayOf(d)!==mondayOf(command.date)))throw Error("Kies unieke herhaaldagen binnen dezelfde week.");
    if(command.repeatDates.length && !daily.length)throw Error("Vul eerst dagelijkse taken in om deze te herhalen.");
    const updated=new Map<string,CleaningDay|null>();
    for(const date of dates){
      const old=current.find(d=>d.date===date),mainLabel=date===command.date?main:old?.main?.label || "";
      const dayLabels=date===command.date?daily:[...(old?.daily.map(c=>c.label)||[]),...daily.filter(text=>!old?.daily.some(c=>c.label.toLocaleLowerCase("nl-NL")===text.toLocaleLowerCase("nl-NL")))];
      if(dayLabels.length>40)throw Error("Er kunnen maximaal 40 dagelijkse taken op één dag staan.");
      if(old?.main?.done && old.main.label!==mainLabel)throw Error("De hoofdtaak is al afgevinkt. Heropen deze eerst voordat je de tekst wijzigt of verwijdert.");
      if(old?.daily.some(c=>c.done && !dayLabels.includes(c.label)))throw Error("Er zijn al dagelijkse taken afgevinkt. Behoud de tekst of heropen deze eerst.");
      const make=(text:string,previous?:CleaningCheck):CleaningCheck=>previous?.label===text?previous:{id:createId(),label:text,done:false};
      updated.set(date,mainLabel || dayLabels.length?{id:`cleaning:${date}`,date,main:mainLabel?make(mainLabel,old?.main || undefined):null,daily:dayLabels.map(text=>make(text,old?.daily.find(c=>c.label===text)))}:null);
    }
    next=[...current.filter(d=>!updated.has(d.date)),...[...updated.values()].filter((d):d is CleaningDay=>d!==null)];
  }else throw Error("Onbekende schoonmaakactie.");
  if(!validCleaningDays(next))throw Error("De schoonmaakwijziging bevat ongeldige gegevens.");
  return [...next].sort((a,b)=>a.date.localeCompare(b.date));
}
export function validStaffingSettings(value:unknown):value is ProductionStaffingSettings {
  if(!value || typeof value!=="object" || Array.isArray(value))return false;
  const s=value as ProductionStaffingSettings;
  const guid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
  if(!Array.isArray(s.departmentIds) || s.departmentIds.length>12 || s.departmentIds.some(id=>typeof id!=="string" || !guid.test(id)) || !Array.isArray(s.people) || s.people.length>200)return false;
  if(new Set(s.departmentIds.map(id=>id.toLowerCase())).size!==s.departmentIds.length || new Set(s.people.map(p=>typeof p?.employeeId==="string"?p.employeeId.toLowerCase():undefined)).size!==s.people.length)return false;
  return s.people.every(p=>{
    if(!p || typeof p.employeeId!=="string" || !guid.test(p.employeeId) || typeof p.name!=="string" || !p.name.trim() || p.name.length>160 || typeof p.tasks!=="string" || p.tasks.length>5000)return false;
    if(!Array.isArray(p.weekdays) || p.weekdays.length>7 || new Set(p.weekdays).size!==p.weekdays.length || p.weekdays.some(d=>!Number.isInteger(d)||d<0||d>6))return false;
    return p.weeklyHours===null || (typeof p.weeklyHours==="number" && Number.isFinite(p.weeklyHours) && p.weeklyHours>0 && p.weeklyHours<=84);
  });
}
export function normalizeStaffingSettings(value:ProductionStaffingSettings):ProductionStaffingSettings {
  return {departmentIds:value.departmentIds.map(id=>id.toLowerCase()),people:value.people.map(p=>({employeeId:p.employeeId.toLowerCase(),name:p.name.trim(),weekdays:[...p.weekdays].sort((a,b)=>a-b),weeklyHours:p.weeklyHours,tasks:p.tasks.trim()}))};
}

export const STATUS_LABELS: Record<TaskStatus, string> = { planned: "Gepland", active: "Bezig", done: "Klaar", blocked: "Geblokkeerd" };
export const SOURCE_LABELS: Record<Task["source"], string> = { manual: "Handmatig", shop: "Winkelbehoefte", order: "Bestelling", routine: "Vaste taak" };
export const KIND_LABELS: Record<ItemKind, string> = { product: "Eindproduct", component: "Halffabricaat", activity: "Werkzaamheid" };
export const BOARDS: { id: BoardId; name: string }[] = [
  { id: "patisserie", name: "Patisserie" }, { id: "bak", name: "Bakkant" },
  { id: "ijs", name: "IJs" }, { id: "chocolade", name: "Chocolade" },
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
export function requiredTaskIds(task: Task): string[] { return [...new Set([...(task.dependsOn ? [task.dependsOn] : []), ...(task.requires || [])])]; }
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
  for (const id of task.requires || []) {
    const prior=tasks.find(t=>t.id===id);
    const name=items.find(i=>i.id===prior?.itemId)?.name || "halffabricaat";
    if (!prior) issues.push("Benodigd halffabricaat ontbreekt in de planning.");
    else if (prior.date>task.date) issues.push(`${name} staat later ingepland (${dateLabel(prior.date)}).`);
    else if (prior.status!=="done") issues.push(`Wacht op ${name} (${dateLabel(prior.date)}).`);
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
  if (task.status === "done" && status !== "done" && tasks.some(t => requiredTaskIds(t).includes(id) && (t.status === "done" || t.status === "active"))) {
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
  const next = tasks.filter(t => requiredTaskIds(t).includes(id));
  if (prior && prior.date > date) throw Error("Plan deze stap op of na de voorgaande stap.");
  if ((task.requires || []).some(id=>tasks.find(t=>t.id===id)!.date>date)) throw Error("Plan de taak op of na de benodigde halffabricaten.");
  if (next.some(t => t.date < date)) throw Error("Een volgende stap staat eerder. Verplaats die eerst.");
  if (task.dueDate && date > task.dueDate) throw Error("Deze datum ligt na de benodigde datum.");
  return tasks.map(t => t.id === id ? { ...t, date, departmentId } : t);
}
export function removePlannedTask(tasks: Task[], id: string): Task[] {
  const task = tasks.find(t => t.id === id);
  if (!task) throw Error("Taak niet gevonden.");
  if (task.status !== "planned") throw Error("Alleen geplande taken kunnen worden verwijderd.");
  if (tasks.some(t => requiredTaskIds(t).includes(id))) throw Error("Er is een vervolgstap gekoppeld. Verwijder die eerst.");
  let remaining=tasks.filter(t => t.id !== id);
  // Unstarted preparation created exclusively for this order can disappear
  // with its parent. Actual work and preparation used elsewhere are retained.
  let changed=true;
  while(changed) {
    const removable=remaining.filter(t=>t.generatedFor===id && t.status==="planned" && !remaining.some(n=>requiredTaskIds(n).includes(t.id)));
    changed=removable.length>0;
    remaining=remaining.filter(t=>!removable.some(r=>r.id===t.id));
  }
  return remaining;
}
/** An explicit production group, never inferred from recipe names or dates.
 * Batch steps and automatically generated preparation belong together;
 * a required preparation owned by another order does not. */
export function recipeProductionTasks(tasks: Task[], id: string): Task[] {
  const byId=new Map(tasks.map(t=>[t.id,t]));
  if(!byId.has(id))throw Error("Taak niet gevonden.");
  const batches=new Map<string,Task[]>(),children=new Map<string,Task[]>();
  for(const task of tasks){batches.set(task.batchId,[...(batches.get(task.batchId)||[]),task]);if(task.generatedFor)children.set(task.generatedFor,[...(children.get(task.generatedFor)||[]),task]);}
  const selected=new Set<string>(),seenBatches=new Set<string>(),queue=[id];
  for(let index=0;index<queue.length;index++){
    const task=byId.get(queue[index]);if(!task || selected.has(task.id))continue;
    selected.add(task.id);
    if(!seenBatches.has(task.batchId)){seenBatches.add(task.batchId);queue.push(...(batches.get(task.batchId)||[]).map(t=>t.id));}
    if(task.generatedFor)queue.push(task.generatedFor);
    queue.push(...(children.get(task.id)||[]).map(t=>t.id));
  }
  return tasks.filter(t=>selected.has(t.id));
}
export function removeRecipeProduction(tasks: Task[], id: string): Task[] {
  const group=recipeProductionTasks(tasks,id),ids=new Set(group.map(t=>t.id));
  if(group.some(t=>t.status!=="planned"))throw Error("Deze productie bevat gestarte, afgeronde of geblokkeerde taken. Alleen een volledig geplande productie kan in één keer worden verwijderd.");
  if(tasks.some(t=>!ids.has(t.id) && requiredTaskIds(t).some(required=>ids.has(required))))throw Error("Een onderdeel is ook nodig voor een andere productie. Verwijder eerst die gekoppelde vervolgstap.");
  return tasks.filter(t=>!ids.has(t.id));
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
  for(const id of task.requires || []) {
    const prior=state.tasks.find(t=>t.id===id);
    if(!prior || prior.id===task.id || prior.date>task.date) throw Error("Een benodigd halffabricaat ontbreekt of staat later ingepland.");
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

export function validRecipePlan(value:RecipePlanSettings):boolean {
  if(!value || !Number.isFinite(value.amount) || value.amount<=0 || value.amount>1000000 || !["quantity","batches"].includes(value.amountMode))return false;
  const prep=value.preparation;if(!prep)return true;
  if(!Number.isInteger(prep.daysBefore) || prep.daysBefore<0 || prep.daysBefore>30 || !prep.choices || typeof prep.choices!=="object" || Array.isArray(prep.choices) || Object.keys(prep.choices).length>250)return false;
  return Object.values(prep.choices).every(c=>{if(!c || typeof c!=="object" || (c.include!==undefined && typeof c.include!=="boolean") || (c.departmentId!==undefined && !DEPARTMENTS.some(d=>d.id===c.departmentId)))return false;try{if(c.date)addDays(c.date,0);return true;}catch{return false;}});
}

export function matchesProductionSearch(query:string,values:(string|undefined)[]):boolean {
  const normalize=(value:string)=>value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("nl-NL");
  const haystack=normalize(values.filter(Boolean).join(" "));
  return normalize(query).trim().split(/\s+/).filter(Boolean).every(part=>haystack.includes(part));
}
