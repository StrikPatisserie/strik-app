"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Icon from "./ProductionIcon";
import TaskWorkPanel, { WorkClock } from "./TaskWorkPanel";
import { productionRoute, productionStepIndex, productionUnit, remainingParty, isBakeOffTask, convertRecipeQuantity, dateLabel, DEPARTMENTS, mondayOf, requiredTaskIds, STATUS_LABELS, taskIssues, type DemoRecipe, type DepartmentId, type PreviewState, type Task } from "./planning";
import { earlierPreparations, materialBatchGroups, materialConsumers, materialUsesByRecipe } from "./materialPlanning";
import { recipeLinks } from "./recipeGroups";
import { taskWorkSummary } from "./workSummary";
import type { WorkCommand } from "./productionWork";
import s from "./PlanningInspector.module.css";
const number = (value: number) => value.toLocaleString("nl-NL", { maximumFractionDigits: 2 });
type Selection = { taskId?: string; recipeId?: string; amount: number };
type Stock = { itemId: string; balance: number; known: boolean; count?: { date: string; quantity: number } | null };
const isImportNote = (line: string) => /^(Receptregels zijn overgenomen uit Halffabricaten Recepturen Strik|Werkwijze en kritieke temperaturen kunnen later per halffabricaat worden aangevuld)/i.test(line.trim());
export default function PlanningInspector({ state, recipes, task, preparationDate, canManage, busy, revision, live, onClose, onWork, onComplete, onCorrect, onAdvanced, onRecipe, onCombine, onMove, onReturn, onNext }: {
  state: PreviewState; recipes: DemoRecipe[]; task: Task; preparationDate?: string; canManage: boolean; busy: boolean; revision: number; live: boolean;
  onClose: () => void; onWork: (command: WorkCommand) => Promise<string | undefined>; onComplete: (id: string) => void;
  onCorrect: (id: string) => void;
  onNext: (id: string) => void;
  onMove: (id: string, date: string, departmentId: DepartmentId) => Promise<string | undefined>;
  onReturn: (id: string) => Promise<string | undefined>;
  onAdvanced: (id: string) => void; onRecipe: (itemId: string, taskId?: string) => void; onCombine: (ids: string[]) => Promise<string | undefined>;
}) {
  const [path, setPath] = useState<Selection[]>([]);
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [stockError, setStockError] = useState(false);
  const [combine, setCombine] = useState(false);
  const [error, setError] = useState("");
  const [planningAction, setPlanningAction] = useState<"move" | "return" | null>(null);
  const [moveDate, setMoveDate] = useState(task.date);
  const [moveDepartment, setMoveDepartment] = useState<DepartmentId>(task.departmentId);
  const heading = useRef<HTMLHeadingElement>(null);
  const links = useMemo(() => recipeLinks(state.tasks, state.items), [state.tasks, state.items]);
  const materialUses = useMemo(() => materialUsesByRecipe(state, recipes), [state, recipes]);
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
  try { if (recipe) recipeAmount = convertRecipeQuantity(amount, unit, recipe.unit); }
  catch { /* Incompatible units remain explicit instead of inventing quantities. */ }
  const route = currentTask?.productionStage ? productionRoute(item, currentTask) : undefined;
  const stepIndex = currentTask ? productionStepIndex(item,currentTask) : -1;
  const nextStep = route && stepIndex>=0 ? route.steps[stepIndex+1] : undefined;
  const displayUnit = currentTask ? productionUnit(item) : unit;
  const title = item?.name || recipe?.name || "Onderdeel niet gevonden";
  const stock = stocks.find(row => row.itemId === item?.id);
  const consumers = currentTask ? materialConsumers(state, recipes, currentTask.id) : [];
  const reserved = consumers.reduce((sum, row) => sum + (row.quantity || 0), 0);
  const issues = currentTask ? taskIssues(currentTask, state.tasks, state.items) : [];
  const steps = currentTask ? state.tasks.filter(row => row.batchId === currentTask.batchId).sort((a, b) => a.date.localeCompare(b.date)) : [];
  const parents = currentTask ? (links.get(currentTask.id) || []).filter(link => state.tasks.find(row => row.id === link.rootId)?.batchId !== currentTask.batchId) : [];
  const related = currentTask && !parents.length ? state.tasks.filter(row => row.batchId !== currentTask.batchId && links.get(row.id)?.some(link => state.tasks.find(root => root.id === link.rootId)?.batchId === currentTask.batchId)).sort((a, b) => a.date.localeCompare(b.date)) : [];
  const group = currentTask ? materialBatchGroups(state).find(group => group.some(row => row.id === currentTask.id)) : undefined;
  const completed = currentTask?.status === "done" ? taskWorkSummary(state, currentTask) : undefined;
  const instructions = recipe?.steps.filter(line => !isImportNote(line)) || [];
  const produced = currentTask?.status === "done" ? currentTask.stockFulfillmentId ? 0 : currentTask.completedQuantity ?? currentTask.quantity : 0;
  const shortage = currentTask?.status === "done" && produced + 1e-6 < reserved && !currentTask.stockFulfillmentId;
  const requiredIds = currentTask ? requiredTaskIds(currentTask) : [];
  const relatedRecipeIds = new Set(related.map(row => state.items.find(item => item.id === row.itemId)?.recipeId));
  const recipeParts = currentTask && isBakeOffTask(currentTask) ? [] : recipe?.semiFinishedItems?.filter(part => !relatedRecipeIds.has(part.recipeId)) || [];
  const otherRequired = requiredIds.filter(id => !related.some(row => row.id === id) && !recipe?.semiFinishedItems?.some(part => state.items.find(item => item.id === state.tasks.find(task => task.id === id)?.itemId)?.recipeId === part.recipeId));
  const focusDate = !selected ? preparationDate : undefined;
  const visibleRelated = focusDate ? related.filter(row => row.date === focusDate) : related;
  const visibleRecipeParts = focusDate ? [] : recipeParts;
  const visibleRequired = focusDate ? otherRequired.filter(id => state.tasks.find(row => row.id === id)?.date === focusDate) : otherRequired;
  const partCount = visibleRelated.length + visibleRecipeParts.length + visibleRequired.length;
  const preparation = currentTask ? earlierPreparations(state, currentTask).filter(row => row.status !== "done") : [];
  const preparationDates = [...new Set(preparation.map(row => row.date))];
  function preparationDateLabel(row: Task) {
    const days = currentTask ? Math.round((Date.parse(currentTask.date) - Date.parse(row.date)) / 86400000) : 0;
    return `${dateLabel(row.date, true)}${days > 0 ? ` · ${days} ${days === 1 ? "dag" : "dagen"} ervoor` : ""}`;
  }

  function open(selection: Selection) { setPath(current => [...current, selection]); setCombine(false); setPlanningAction(null); setError(""); }
  function openTask(row: Task) { open({ taskId: row.id, amount: row.quantity }); }
  function openComponent(recipeId: string, quantity: number, unit: string) {
    const matches = state.tasks.filter(row => requiredIds.includes(row.id) && state.items.find(item => item.id === row.itemId)?.recipeId === recipeId);
    if (matches.length === 1) openTask(matches[0]);
    else {
      try { open({ recipeId, amount: convertRecipeQuantity(quantity, unit, recipes.find(row => row.id === recipeId)?.unit || unit) }); }
      catch { setError("Controleer de eenheid van dit halffabricaat in het recept."); }
    }
  }
  function materialNotice(recipeId: string | undefined, date: string, ownProducer?: Task) {
    if (!recipeId) return null;
    const ownBatches = new Set([currentTask?.batchId, ...related.map(row => row.batchId)]);
    if (ownProducer) {
      for (const consumer of materialConsumers(state, recipes, ownProducer.id)) ownBatches.add(consumer.task.batchId);
    }
    const others = (materialUses.get(recipeId) || []).filter(use => use.week === mondayOf(date) && !ownBatches.has(use.task.batchId));
    if (!others.length) return null;
    const remaining = others.filter(use => use.producerIds.length
      ? use.producerIds.some(id => state.tasks.find(row => row.id === id)?.status !== "done")
      : use.task.status !== "done");
    if (!remaining.length) return null;
    return <details className={s.weekMaterial}>
      <summary><Icon name="link" size={12}/><span>Ook deze week · {remaining.length} andere {remaining.length === 1 ? "productie" : "producties"}</span></summary>
      {remaining.map(use => <button type="button" className={s.weekMaterialRow} key={`${use.task.batchId}:${use.week}`} onClick={() => openTask(use.task)}>
        <span>{state.items.find(item => item.id === use.task.itemId)?.name || use.task.operation}<small>{use.dates.map(date => dateLabel(date, true)).join(" · ")}{use.producerIds.length > 0 && use.producerIds.every(id => state.tasks.find(row => row.id === id)?.status === "done") ? " · Gemaakt" : ""}</small></span>
        <b>{use.quantity === null ? "Aantal controleren" : `${number(use.quantity)} ${use.unit}`}</b><Icon name="chevron" size={12}/>
      </button>)}
    </details>;
  }
  function taskRow(row: Task) {
    const name = state.items.find(item => item.id === row.itemId)?.name || row.operation;
    const portions = currentTask ? materialConsumers(state, recipes, row.id).filter(consumer => consumer.task.batchId === currentTask.batchId) : [];
    const allocated = portions.length && portions.every(consumer => consumer.quantity !== null) ? portions.reduce((sum, consumer) => sum + (consumer.quantity || 0), 0) : undefined;
    const shared = allocated !== undefined && Math.abs(allocated - row.quantity) > 1e-6;
    const rowUnit = state.items.find(item => item.id === row.itemId)?.unit;
    const earlier = !!currentTask && row.date < currentTask.date && row.status !== "done";
    return <div key={row.id}><button type="button" className={`${s.linkRow} ${earlier ? s.earlier : ""}`} onClick={() => openTask(row)}>
      <span className={`${s.dot} ${s[row.status]}`} aria-label={STATUS_LABELS[row.status]}>{earlier ? <Icon name="warning" size={13}/> : row.status === "done" ? <Icon name="check" size={12}/> : row.status === "active" ? <Icon name="play" size={10}/> : null}</span>
      <span>{name}<small>{preparationDateLabel(row)}{steps.length > 1 && row.batchId === currentTask?.batchId ? ` · ${row.operation}` : ""}</small></span>
      <b>{number(allocated ?? row.quantity)} {rowUnit}{shared && <small>batch {number(row.quantity)} {rowUnit}</small>}</b><Icon name="chevron" size={13}/>
    </button>{materialNotice(state.items.find(item => item.id === row.itemId)?.recipeId, row.date)}</div>;
  }
  return <section className={s.panel} aria-label="Productiedetails" onKeyDown={event => { if (event.key === "Escape" && !busy) { event.stopPropagation(); onClose(); } }}>
    <header className={s.heading}>
      {path.length > 0 && <button type="button" className={s.back} aria-label="Terug naar vorig product" disabled={busy} onClick={() => { setPath(path.slice(0, -1)); setCombine(false); setPlanningAction(null); setError(""); }}><Icon name="back" size={16}/>Terug</button>}
      <button type="button" className={s.close} aria-label="Productiedetails sluiten" disabled={busy} onClick={onClose}><Icon name="close" size={20}/></button>
      <h2 ref={heading} tabIndex={-1}>{title}</h2>
      {currentTask && (currentTask.productionStage || productionRoute(item, currentTask)?.steps.includes(currentTask.operation)) && <strong>{currentTask.operation}</strong>}
      {currentTask && <small>{focusDate ? `Voorbereiden ${dateLabel(focusDate, true)} · voor ${dateLabel(currentTask.date, true)}` : dateLabel(currentTask.date, true)} · {DEPARTMENTS.find(row => row.id === currentTask.departmentId)?.short}</small>}
      <div className={s.facts}><strong>{number(amount)} {displayUnit}</strong>{currentTask ? <span className={s[currentTask.status]}>{STATUS_LABELS[currentTask.status]}</span> : <span>Recept · geen gekoppelde taak</span>}</div>
      {currentTask && <div className={s.time}>{currentTask.minutes !== undefined && <span><Icon name="clock" size={14}/>{number(currentTask.minutes)} min gepland</span>}<WorkClock state={state} taskId={currentTask.id}/>{completed && <span><Icon name="users" size={14}/>{completed.crewSize ?? "—"} · {completed.minutes === undefined ? "tijd onbekend" : `${number(completed.minutes)} min`}</span>}</div>}
      {!focusDate && preparationDates.length > 0 && <p className={s.preparationNotice}><Icon name="warning" size={15}/><span>Voorbereiden {preparationDates.map(date => dateLabel(date, true)).join(" · ")}</span></p>}
    </header>
    <div className={s.body} key={currentTask?.id || recipe?.id}>
      {currentTask && canManage && !focusDate && currentTask.status !== "done" && <div className={s.planningActions}>
        <div className={s.planningButtons}>
          <button type="button" disabled={busy} aria-expanded={planningAction === "move"} onClick={() => { setMoveDate(currentTask.date); setMoveDepartment(currentTask.departmentId); setPlanningAction(planningAction === "move" ? null : "move"); setError(""); }}><Icon name="move" size={14}/>Verplaatsen</button>
          {currentTask.status === "planned" && !currentTask.generatedFor && !currentTask.dependsOn && !currentTask.weddingCode && item?.kind !== "activity" && <button type="button" disabled={busy} aria-expanded={planningAction === "return"} onClick={() => { setPlanningAction(planningAction === "return" ? null : "return"); setError(""); }}><Icon name="back" size={14}/>Terug naar verzoeken</button>}
        </div>
        {planningAction === "move" && <form className={s.moveForm} onSubmit={async event => { event.preventDefault(); const result = await onMove(currentTask.id, moveDate, moveDepartment); setError(result || ""); if (!result) setPlanningAction(null); }}>
          <label>Dag<input type="date" required value={moveDate} disabled={busy} onChange={event => setMoveDate(event.target.value)}/></label>
          <label>Afdeling<select value={moveDepartment} disabled={busy} onChange={event => setMoveDepartment(event.target.value as DepartmentId)}>{DEPARTMENTS.filter(row => row.id !== "bruidstaarten").map(row => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label>
          <button type="submit" disabled={busy}>Verplaatsen</button>
        </form>}
        {planningAction === "return" && <div className={s.returnConfirm}><p>{title} terugzetten naar productieverzoeken?</p><button type="button" disabled={busy} onClick={async () => { const result = await onReturn(currentTask.id); setError(result || ""); if (!result) setPlanningAction(null); }}>Terugzetten</button><button type="button" disabled={busy} onClick={() => setPlanningAction(null)}>Annuleren</button></div>}
      </div>}
      {parents.length > 0 && <section className={s.forRecipes} aria-label="Bijbehorende recepten"><h3><Icon name="link" size={14}/>{parents.length === 1 ? "Voor" : "Gedeeld voor"}</h3>
        {parents.map(link => {
          const parent = state.tasks.find(row => row.id === link.rootId)!;
          const portions = consumers.filter(row => row.task.batchId === parent.batchId);
          const known = portions.length > 0 && portions.every(row => row.quantity !== null);
          return <button type="button" className={s.linkRow} key={link.rootId} onClick={() => openTask(parent)}><span className={s.recipeDot} style={{ background: ["#50708f", "#81609b", "#b75676", "#987020", "#b55764", "#657b4f"][link.tone] }}/><span><strong>{link.name}</strong><small>{dateLabel(parent.date, true)}</small></span>{known && <b>{number(portions.reduce((sum, row) => sum + (row.quantity || 0), 0))} {displayUnit}</b>}<Icon name="chevron" size={14}/></button>;
        })}
      </section>}
      {currentTask && item?.kind === "component" && materialNotice(item.recipeId, currentTask.date, currentTask)}
      {!!issues.length && currentTask?.status !== "done" && <details className={s.warnings}><summary><Icon name="warning" size={15}/>{issues.length} aandachtspunt{issues.length > 1 ? "en" : ""}</summary><ul>{issues.map(issue => <li key={issue}>{issue}</li>)}</ul></details>}
      {shortage && <p className={s.warnings}>{number(reserved)} {displayUnit} nodig · {number(produced)} {displayUnit} gemaakt</p>}
      {partCount > 0 && <details open={!parents.length || preparation.length > 0}><summary>{focusDate ? "Voorbereiden" : "Onderdelen"} <small>{partCount}</small>{!focusDate && preparation.length > 0 && <span className={s.preparationCount}><Icon name="warning" size={12}/>{preparation.length} eerder</span>}</summary>
        {visibleRelated.map(taskRow)}
          {visibleRecipeParts.length > 0 && recipeAmount === undefined && <p className={s.warnings}>Controleer de eenheid van de taak en het recept.</p>}
          {recipeAmount !== undefined && visibleRecipeParts.map((part, index) => {
            const child = recipes.find(row => row.id === part.recipeId);
            const required = recipe && recipe.yield > 0 ? part.quantity * recipeAmount / recipe.yield : part.quantity;
            const linked = requiredIds.filter(id => state.items.find(item => item.id === state.tasks.find(task => task.id === id)?.itemId)?.recipeId === part.recipeId);
            if (linked.length === 1) return taskRow(state.tasks.find(row => row.id === linked[0])!);
            return <div key={`${part.recipeId}:${index}`}><button type="button" className={s.linkRow} onClick={() => openComponent(part.recipeId, required, part.unit)}><span>{child?.name || "Receptkoppeling controleren"}<small>{linked.length ? linked.map(id => `${dateLabel(state.tasks.find(row => row.id === id)!.date, true)} · ${STATUS_LABELS[state.tasks.find(row => row.id === id)!.status]}`).join(" · ") : "Niet apart ingepland"}</small></span><b>{number(required)} {part.unit}</b><Icon name="chevron" size={14}/></button>{materialNotice(part.recipeId, currentTask?.date || task.date)}</div>;
          })}
          {visibleRequired.map(id => {
            const row = state.tasks.find(task => task.id === id);
            return row ? taskRow(row) : null;
          })}
      </details>}
      {focusDate && <button type="button" className={s.action} onClick={() => openTask(task)}><Icon name="book" size={14}/>Hele recept</button>}
      {steps.length > 1 && !focusDate && <details><summary>Stappen <small>{steps.length}</small></summary>{steps.map(row => <button type="button" className={s.step} key={row.id} onClick={() => openTask(row)}><span className={`${s.dot} ${s[row.status]}`}>{row.status === "done" ? <Icon name="check" size={13}/> : row.status === "active" ? <Icon name="play" size={11}/> : null}</span><span><strong>{row.operation}</strong><small>{dateLabel(row.date, true)} · {STATUS_LABELS[row.status]}</small></span></button>)}</details>}
      <details><summary>Recept</summary>
        {recipe ? <><small>Basis {number(recipe.yield)} {productionUnit({recipeId:recipe.id,unit:recipe.unit})}{recipe.yield > 0 ? ` · × ${recipeAmount === undefined ? "?" : number(recipeAmount / recipe.yield)}` : " · opbrengst controleren"}</small><div className={s.ingredients}>{recipe.ingredients.map((line, index) => <div key={index}><span>{line.name}</span><b>{recipe.yield > 0 && recipeAmount !== undefined ? number(line.quantity * recipeAmount / recipe.yield) : "Basis " + number(line.quantity)} {line.unit}</b></div>)}</div>{instructions.length > 0 && <ol className={s.instructions}>{instructions.map((step, index) => <li key={index}>{step}</li>)}</ol>}<p className={s.muted}>Allergenen · {recipe.allergens.join(", ") || "Nog controleren"}</p></> : <p>Recept nog koppelen of aanvullen.</p>}
        {canManage && item && <button type="button" className={s.action} disabled={busy} onClick={() => onRecipe(item.id, currentTask?.id)}><Icon name="edit" size={14}/>{recipe ? "Recept aanpassen" : "Recept toevoegen"}</button>}
      </details>
      {(currentTask || item?.note) && <details><summary>Meer</summary>
        {consumers.length > 0 && currentTask && <div className={s.amounts}><span>Nodig<strong>{consumers.some(row => row.quantity === null) ? "Deels onbekend" : `${number(reserved)} ${displayUnit}`}</strong></span><span>{currentTask.stockFulfillmentId ? "Uit voorraad" : "Gemaakt"}<strong>{number(currentTask.stockFulfillmentId ? currentTask.quantity : produced)} {displayUnit}</strong></span></div>}
        {(stockError || stock?.known || stock?.count) && <p className={s.stock}>{stockError ? "Voorraad tijdelijk niet beschikbaar" : stock?.known ? `Voorraadprognose ${number(stock.balance)} ${displayUnit}` : `Geteld ${number(stock!.count!.quantity)} ${displayUnit} · ${dateLabel(stock!.count!.date, true)}`}</p>}
        {[currentTask?.note, item?.note].filter((note): note is string => !!note && !isImportNote(note)).map((note, index) => <p className={s.note} key={index}>{note}</p>)}
        {canManage && group && currentTask && <div className={s.combine}>
          {!combine ? <button type="button" disabled={busy} onClick={() => setCombine(true)}><Icon name="link" size={14}/>{group.length} batches bundelen</button> : <><p>{number(group.reduce((sum, row) => sum + row.quantity, 0))} {displayUnit} op {dateLabel(currentTask.date, true)}.</p><button type="button" disabled={busy} onClick={async () => { const result = await onCombine(group.map(row => row.id)); setError(result || ""); if (!result) onClose(); }}>Bevestig gezamenlijke batch</button><button type="button" disabled={busy} onClick={() => setCombine(false)}>Annuleren</button></>}
        </div>}
        {currentTask && item && canManage && <TaskWorkPanel key={currentTask.id} state={state} task={currentTask} item={item} recipes={recipes} busy={busy} onCommand={onWork}/>}
      </details>}
      {currentTask && route && <section className={s.party}><strong>{currentTask.operation}</strong><p>{route.steps.join(" → ")}</p>{currentTask.productionStage?.availableQuantity !== undefined && <p>Vorige stap was al gedaan buiten de planning · {number(currentTask.productionStage.availableQuantity)} {displayUnit} gebruikt.</p>}{currentTask.productionStage?.sources.map(link=>{const source=state.tasks.find(row=>row.id===link.taskId);return <button type="button" key={link.taskId} onClick={()=>setPath([...path,{taskId:link.taskId,amount:link.quantity}])}>{source?.operation} · {source?dateLabel(source.date,true):""} · {number(link.quantity)} {displayUnit}</button>;})}{nextStep && <button type="button" disabled={!canManage || busy || remainingParty(state,currentTask)<=0 || !!currentTask.stockFulfillmentId} onClick={()=>onNext(currentTask.id)}>{nextStep} inplannen · {number(remainingParty(state,currentTask))} {displayUnit} vrij</button>}</section>}
      {error && <p role="alert" className={s.warnings}>{error}</p>}
    </div>
    {currentTask && canManage && !focusDate && <footer className={s.footer}><button type="button" disabled={busy || !!currentTask.stockFulfillmentId} onClick={() => currentTask.status === "done" ? onCorrect(currentTask.id) : onComplete(currentTask.id)}><Icon name={currentTask.status === "done" ? "edit" : "check"} size={16}/>{currentTask.status === "done" ? "Aantal corrigeren" : "Afronden"}</button><button type="button" className={s.secondary} disabled={busy} onClick={() => onAdvanced(currentTask.id)}><Icon name="settings" size={16}/>Aanpassen</button></footer>}
  </section>;
}
