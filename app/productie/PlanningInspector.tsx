"use client";
import { useEffect, useRef, useState } from "react";
import Icon from "./ProductionIcon";
import TaskWorkPanel, { WorkClock } from "./TaskWorkPanel";
import { convertRecipeQuantity, dateLabel, DEPARTMENTS, requiredTaskIds, STATUS_LABELS, taskIssues, type DemoRecipe, type PreviewState, type Task } from "./planning";
import { materialBatchGroups, materialConsumers, recipeMaterialNeeds } from "./materialPlanning";
import { taskWorkSummary } from "./workSummary";
import type { WorkCommand } from "./productionWork";
import s from "./PlanningInspector.module.css";
const number = (value: number) => value.toLocaleString("nl-NL", { maximumFractionDigits: 2 });
type Selection = { taskId?: string; recipeId?: string; amount: number };
type Stock = { itemId: string; balance: number; known: boolean; count?: { date: string; quantity: number } | null };
export default function PlanningInspector({ state, recipes, task, canManage, busy, revision, live, onClose, onWork, onComplete, onCorrect, onAdvanced, onRecipe, onCombine }: {
  state: PreviewState; recipes: DemoRecipe[]; task: Task; canManage: boolean; busy: boolean; revision: number; live: boolean;
  onClose: () => void; onWork: (command: WorkCommand) => Promise<string | undefined>; onComplete: (id: string) => void;
  onCorrect: (id: string) => void;
  onAdvanced: (id: string) => void; onRecipe: (itemId: string, taskId?: string) => void; onCombine: (ids: string[]) => Promise<string | undefined>;
}) {
  const [path, setPath] = useState<Selection[]>([]);
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [stockError, setStockError] = useState(false);
  const [combine, setCombine] = useState(false);
  const [error, setError] = useState("");
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, [path.length]);
  useEffect(() => {
    if (!live) return;
    const controller = new AbortController();
    setStockError(false);
    fetch("/api/productie/voorraad", { cache: "no-store", signal: controller.signal }).then(async response => {
      if (!response.ok) throw Error("Voorraad laden is mislukt.");
      const data = await response.json(); setStocks(data.rows || []);
    }).catch(() => { if (!controller.signal.aborted) { setStocks([]); setStockError(true); } });
    return () => controller.abort();
  }, [live, revision]);
  const selected = path.at(-1);
  const currentTask = selected ? state.tasks.find(row => row.id === selected.taskId) : task;
  const item = currentTask ? state.items.find(row => row.id === currentTask.itemId) : state.items.find(row => row.recipeId === selected?.recipeId);
  const recipe = (currentTask && state.productionWork?.overrides?.[currentTask.id]) || recipes.find(row => row.id === (selected?.recipeId || item?.recipeId));
  const amount = currentTask?.quantity ?? selected?.amount ?? recipe?.yield ?? 0;
  const unit = currentTask ? item?.unit || "" : recipe?.unit || "";
  let recipeAmount: number | undefined;
  try {
    if (recipe) recipeAmount = convertRecipeQuantity(amount, unit, recipe.unit);
  } catch { /* Show the original quantity until the recipe unit has been reviewed. */ }
  const title = item?.name || recipe?.name || "Onderdeel niet gevonden";
  const stock = stocks.find(row => row.itemId === item?.id);
  const consumers = currentTask ? materialConsumers(state, recipes, currentTask.id) : [];
  const reserved = consumers.reduce((sum, row) => sum + (row.quantity || 0), 0);
  const requirements = currentTask ? recipeMaterialNeeds(state, recipes, currentTask) : {};
  const issues = currentTask ? taskIssues(currentTask, state.tasks, state.items) : [];
  const steps = currentTask ? state.tasks.filter(row => row.batchId === currentTask.batchId).sort((a, b) => a.date.localeCompare(b.date)) : [];
  const group = currentTask ? materialBatchGroups(state).find(group => group.some(row => row.id === currentTask.id)) : undefined;
  const completed = currentTask?.status === "done" ? taskWorkSummary(state, currentTask) : undefined;
  function open(selection: Selection) { setPath(current => [...current, selection]); setCombine(false); setError(""); }
  function openTask(row: Task) { open({ taskId: row.id, amount: row.quantity }); }
  function openComponent(recipeId: string, quantity: number, unit: string) {
    const matches = state.tasks.filter(row => currentTask?.requires?.includes(row.id) && state.items.find(item => item.id === row.itemId)?.recipeId === recipeId);
    if (matches.length === 1) openTask(matches[0]);
    else {
      try { open({ recipeId, amount: convertRecipeQuantity(quantity, unit, recipes.find(row => row.id === recipeId)?.unit || unit) }); }
      catch { setError("Controleer de eenheid van dit halffabricaat in het recept."); }
    }
  }
  const produced = currentTask?.status === "done" ? currentTask.stockFulfillmentId ? 0 : currentTask.completedQuantity ?? currentTask.quantity : 0;
  return <section className={s.panel} aria-label="Productiedetails" onKeyDown={event => { if (event.key === "Escape" && !busy) { event.stopPropagation(); onClose(); } }}>
    <header className={s.heading}>
      {path.length > 0 && <button type="button" className={s.back} aria-label="Terug naar vorig product" disabled={busy} onClick={() => { setPath(path.slice(0, -1)); setCombine(false); setError(""); }}><Icon name="back" size={16}/>Terug</button>}
      <button type="button" className={s.close} aria-label="Productiedetails sluiten" disabled={busy} onClick={onClose}><Icon name="close" size={20}/></button>
      <h2 ref={heading} tabIndex={-1}>{title}</h2>
      {currentTask && <small>{dateLabel(currentTask.date, true)} · {DEPARTMENTS.find(row => row.id === currentTask.departmentId)?.short}</small>}
      <div className={s.facts}><strong>{number(amount)} {unit}</strong>{currentTask ? <span className={s[currentTask.status]}>{STATUS_LABELS[currentTask.status]}</span> : <span>Recept · geen gekoppelde taak</span>}</div>
      {currentTask && <div className={s.time}>{currentTask.minutes !== undefined && <span><Icon name="clock" size={14}/>{number(currentTask.minutes)} min gepland</span>}<WorkClock state={state} taskId={currentTask.id}/>{completed && <span><Icon name="users" size={14}/>{completed.crewSize ?? "—"} · {completed.minutes === undefined ? "tijd onbekend" : `${number(completed.minutes)} min`}</span>}</div>}
    </header>
    <div className={s.body}>
      {!!issues.length && currentTask?.status !== "done" && <details className={s.warnings} open><summary><Icon name="warning" size={15}/>{issues.length} aandachtspunt{issues.length > 1 ? "en" : ""}</summary><ul>{issues.map(issue => <li key={issue}>{issue}</li>)}</ul></details>}
      {consumers.length > 0 && currentTask && <details open><summary>Batch & afnemende producties</summary>
        <div className={s.amounts}><span>Benodigd<strong>{consumers.some(row => row.quantity === null) ? "Deels onbekend" : `${number(reserved)} ${unit}`}</strong></span><span>{currentTask.stockFulfillmentId ? "Uit voorraad" : "Gemaakt"}<strong>{number(currentTask.stockFulfillmentId ? currentTask.quantity : produced)} {unit}</strong></span></div>
        {currentTask.status === "done" && produced + 1e-6 < reserved && !currentTask.stockFulfillmentId &&
          <p className={s.warnings}>{number(reserved)} {unit} gekoppeld · {number(produced)} {unit} gemaakt</p>}
        <p className={s.stock}>{stockError ? "Voorraad tijdelijk niet beschikbaar" : stock?.known ? `Voorraadprognose ${number(stock.balance)} ${unit}` : stock?.count ? `Laatste telling ${number(stock.count.quantity)} ${unit} · ${dateLabel(stock.count.date, true)}` : "Actuele voorraad nog niet vastgesteld"}</p>
        {consumers.map(row => <button type="button" className={s.linkRow} key={row.task.id} onClick={() => openTask(row.task)}><span>{row.item.name}<small>{dateLabel(row.task.date, true)} · {STATUS_LABELS[row.task.status]}</small></span><b>{row.quantity === null ? "Hoeveelheid?" : `${number(row.quantity)} ${unit}`}</b><Icon name="chevron" size={14}/></button>)}
        {canManage && group && <div className={s.combine}>
          {!combine ? <button type="button" disabled={busy} onClick={() => setCombine(true)}><Icon name="link" size={14}/>{group.length} batches bundelen</button> : <><p>{number(group.reduce((sum, row) => sum + row.quantity, 0))} {unit} op {dateLabel(currentTask.date, true)}. Alle gekoppelde producties gebruiken daarna deze batch.</p><button type="button" disabled={busy} onClick={async () => { const result = await onCombine(group.map(row => row.id)); setError(result || ""); if (!result) onClose(); }}>Bevestig gezamenlijke batch</button><button type="button" disabled={busy} onClick={() => setCombine(false)}>Annuleren</button></>}
        </div>}
      </details>}
      <details open><summary>Productiestappen</summary>
        {steps.length ? steps.map(row => <button type="button" className={s.step} key={row.id} onClick={() => openTask(row)}><span className={`${s.dot} ${s[row.status]}`}>{row.status === "done" ? <Icon name="check" size={13}/> : row.status === "active" ? <Icon name="play" size={11}/> : null}</span><span><strong>{row.operation}</strong><small>{dateLabel(row.date, true)} · {STATUS_LABELS[row.status]}</small></span></button>) : <p className={s.muted}>Voor dit recept is geen productietaak gekoppeld.</p>}
        {recipe?.steps.length ? <ol className={s.instructions}>{recipe.steps.map((step, index) => <li key={index}>{step}</li>)}</ol> : <p className={s.muted}>Werkwijze nog aanvullen.</p>}
      </details>
      <details open><summary>Halffabricaten & afhankelijkheden</summary>
        {recipe && recipeAmount === undefined && <p className={s.warnings}>Controleer de eenheid van de taak en het recept om de benodigde hoeveelheden te berekenen.</p>}
        {recipeAmount !== undefined && recipe?.semiFinishedItems?.map((part, index) => {
          const child = recipes.find(row => row.id === part.recipeId);
          const required = recipe.yield > 0 ? part.quantity * recipeAmount / recipe.yield : part.quantity;
          const linked = currentTask?.requires?.filter(id => state.items.find(item => item.id === state.tasks.find(task => task.id === id)?.itemId)?.recipeId === part.recipeId) || [];
          return <button type="button" key={`${part.recipeId}:${index}`} className={s.linkRow} onClick={() => openComponent(part.recipeId, required, part.unit)}><span>{child?.name || "Receptkoppeling controleren"}<small>{linked.length ? linked.map(id => `${dateLabel(state.tasks.find(row => row.id === id)!.date, true)} · ${STATUS_LABELS[state.tasks.find(row => row.id === id)!.status]}`).join(" · ") : "Geen productietaak gekoppeld"}</small></span><b>{number(required)} {part.unit}</b><Icon name="chevron" size={14}/></button>;
        })}
        {currentTask && requiredTaskIds(currentTask).filter(id => !recipe?.semiFinishedItems?.some(part => state.items.find(item => item.id === state.tasks.find(task => task.id === id)?.itemId)?.recipeId === part.recipeId)).map(id => {
          const row = state.tasks.find(task => task.id === id); if (!row) return null;
          return <button type="button" key={id} className={s.linkRow} onClick={() => openTask(row)}><span>{state.items.find(item => item.id === row.itemId)?.name}<small>{dateLabel(row.date, true)} · {STATUS_LABELS[row.status]}</small></span>{requirements[id] !== undefined && <b>{number(requirements[id])}</b>}<Icon name="chevron" size={14}/></button>;
        })}
        {!recipe?.semiFinishedItems?.length && !currentTask?.requires?.length && !currentTask?.dependsOn && <p className={s.muted}>Geen gekoppelde voorbereidingen.</p>}
      </details>
      <details><summary>Recept & ingrediënten</summary>
        {recipe ? <><small>Basis {number(recipe.yield)} {recipe.unit}{recipe.yield > 0 ? ` · recept × ${recipeAmount === undefined ? "?" : number(recipeAmount / recipe.yield)}` : " · opbrengst controleren"}</small><div className={s.ingredients}>{recipe.ingredients.map((line, index) => <div key={index}><span>{line.name}</span><b>{recipe.yield > 0 && recipeAmount !== undefined ? number(line.quantity * recipeAmount / recipe.yield) : "Hoeveelheid controleren · basis " + number(line.quantity)} {line.unit}</b></div>)}</div><p className={s.muted}>Allergenen · {recipe.allergens.join(", ") || "Nog controleren"}</p></> : <p>Recept nog koppelen of aanvullen.</p>}
        {canManage && item && <button type="button" className={s.action} disabled={busy} onClick={() => onRecipe(item.id, currentTask?.id)}><Icon name="edit" size={14}/>{recipe ? "Recept aanpassen" : "Recept toevoegen"}</button>}
      </details>
      {(currentTask?.note || item?.note) && <details><summary>Opmerkingen</summary>{[currentTask?.note, item?.note].filter(Boolean).map((note, index) => <p className={s.note} key={index}>{note}</p>)}</details>}
      {currentTask && canManage && <details><summary>Timer & voorraad gebruiken</summary><TaskWorkPanel key={currentTask.id} state={state} task={currentTask} item={item!} recipes={recipes} busy={busy} onCommand={onWork}/></details>}
      {error && <p role="alert" className={s.warnings}>{error}</p>}
    </div>
    {currentTask && canManage && <footer className={s.footer}><button type="button" disabled={busy || !!currentTask.stockFulfillmentId} onClick={() => currentTask.status === "done" ? onCorrect(currentTask.id) : onComplete(currentTask.id)}><Icon name={currentTask.status === "done" ? "edit" : "check"} size={16}/>{currentTask.status === "done" ? "Aantal corrigeren" : "Afronden"}</button><button type="button" className={s.secondary} disabled={busy} onClick={() => onAdvanced(currentTask.id)}><Icon name="settings" size={16}/>Aanpassen</button></footer>}
  </section>;
}
