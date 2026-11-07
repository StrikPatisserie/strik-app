"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import type { Item } from "./planning";
import type { IngredientView } from "./workspaceData";
import { WORK_RECIPE_UNITS, workRecipeComponentError, type WorkRecipeComponent, type WorkRecipeInput } from "./workRecipe";
import SearchableChoice from "./SearchableChoice";
import s from "./requests.module.css";

type ComponentRow = Omit<WorkRecipeComponent, "quantity"> & { key: number; quantity: string };
type LoadedRecipe = {
  draft: WorkRecipeInput;
  recipeRevision: number;
  semiFinished: { id: string; name: string }[];
  notice?: string;
  requiresPermanent?: boolean;
};
type Props = {
  taskId?: string;
  item: Item;
  ingredients: IngredientView[];
  getRevision: () => number;
  recipeRevision: number;
  onSaved: () => Promise<void>;
  onClose: () => void;
};

export default function QuickRecipeForm({ item, ingredients, getRevision, recipeRevision, onSaved, onClose, taskId }: Props) {
  const editing = Boolean(item.recipeId);
  const nextRow = useRef(1);
  const [rows, setRows] = useState<ComponentRow[]>([{ key: 0, kind: "ingredient", linkedId: "", quantity: "", unit: "gram" }]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showValidation, setShowValidation] = useState(false);
  const [scope, setScope] = useState<"once" | "permanent">(taskId && editing ? "once" : "permanent");
  const [loaded, setLoaded] = useState<LoadedRecipe | null>(null);

  useEffect(() => {
    if (!item.recipeId) return;
    let cancelled = false;
    async function load() {
      try {
        const response = await fetch(`/api/productie/snel-recept?itemId=${encodeURIComponent(item.id)}${taskId ? `&taskId=${encodeURIComponent(taskId)}` : ""}`, { cache: "no-store" });
        const data = await response.json() as LoadedRecipe & { message?: string };
        if (!response.ok) throw Error(data.message || "Werkrecept laden mislukt.");
        if (cancelled) return;
        const components: ComponentRow[] = [
          ...data.draft.ingredients.map(line => ({ kind: "ingredient" as const, linkedId: line.ingredientId || "", quantity: Number.isFinite(line.quantity) ? String(line.quantity) : "", unit: line.unit || "" })),
          ...data.draft.semiFinishedItems.map(line => ({ kind: "semiFinished" as const, linkedId: line.recipeId || "", quantity: Number.isFinite(line.quantity) ? String(line.quantity) : "", unit: line.unit || "" })),
        ].map((line, key) => ({ ...line, key }));
        nextRow.current = components.length;
        setRows(components);
        setLoaded(data);
        if (data.requiresPermanent) setScope("permanent");
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [item.id, item.recipeId, taskId]);

  const semiFinished = loaded?.semiFinished || [];
  const ingredientChoices = useMemo(() => ingredients.map(ingredient => ({
    id: ingredient.id,
    name: ingredient.name,
    description: ingredient.supplier,
    searchValues: [ingredient.id, ingredient.unit],
  })), [ingredients]);
  const semiFinishedChoices = useMemo(() => (loaded?.semiFinished || []).map(recipe => ({
    id: recipe.id,
    name: recipe.name,
    searchValues: [recipe.id],
  })), [loaded]);
  const ingredientIds = ingredients.map(ingredient => ingredient.id);
  const semiFinishedIds = semiFinished.map(recipe => recipe.id);
  const rowErrors = rows.map(row => workRecipeComponentError(
    { ...row, quantity: Number(row.quantity) },
    row.kind === "ingredient" ? ingredientIds : semiFinishedIds,
    rows.some(other => other.key !== row.key && other.kind === row.kind && other.linkedId === row.linkedId),
  ));

  function updateRow(key: number, patch: Partial<ComponentRow>) {
    setRows(current => current.map(row => row.key === key ? { ...row, ...patch } : row));
  }

  function addRow(kind: ComponentRow["kind"]) {
    const key = nextRow.current++;
    setRows(current => [...current, { key, kind, linkedId: "", quantity: "", unit: "gram" }]);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || editing && !loaded) return;
    setShowValidation(true);
    if (!rows.length || rowErrors.some(Boolean)) {
      setError(rows.length ? "Controleer de gemarkeerde receptregels." : "Voeg minimaal één grondstof of halffabricaat toe.");
      return;
    }
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      const command = {
        itemId: item.id,
        yield: Number(form.get("yield")),
        instructions: String(form.get("instructions")),
        ingredients: rows.filter(row => row.kind === "ingredient").map(row => ({ ingredientId: row.linkedId, quantity: Number(row.quantity), unit: row.unit })),
        ...(editing ? {
          recipeId: loaded!.draft.recipeId,
          workInstructions: String(form.get("workInstructions")),
          finishingInstructions: String(form.get("finishingInstructions")),
          semiFinishedItems: rows.filter(row => row.kind === "semiFinished").map(row => ({ recipeId: row.linkedId, quantity: Number(row.quantity), unit: row.unit })),
        } : {}),
      };
      const response = await fetch("/api/productie/snel-recept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ who: String(form.get("who")), scope, taskId, revision: getRevision(), recipeRevision: editing ? loaded!.recipeRevision : recipeRevision, command }),
      });
      const data = await response.json();
      if (!response.ok) throw Error(data.message || "Recept opslaan mislukt.");
      await onSaved();
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (editing && !loaded) return <div className={s.panel}>
    {error ? <p role="alert" className={s.error}>{error} Sluit dit venster en open het opnieuw.</p> : <p role="status">Werkrecept laden…</p>}
    <button type="button" onClick={onClose}>Sluiten</button>
  </div>;

  const draft = loaded?.draft;
  return <form className={`${s.panel} ${s.form}`} onSubmit={submit}>
    <p>{scope === "once" ? "Alleen voor deze productie. Het vaste recept blijft bewaard." : editing ? "Vast werkrecept aanpassen. Controleer daarna de geplande producties." : "Werkrecept vastleggen. Controleer daarna de allergenen in receptenbeheer."}</p>
    {loaded?.notice && <p role="status">{loaded.notice}</p>}
    {editing && <p>Herstel een koppeling door de juiste grondstof of het juiste halffabricaat te kiezen. Je kunt een regel ook verwijderen of het soort onderdeel wijzigen.</p>}
    <label>Jouw naam<input name="who" required minLength={2} maxLength={80} disabled={busy} /></label>
    {taskId && editing && !loaded?.requiresPermanent && <label>Toepassen
      <select value={scope} onChange={event => setScope(event.target.value as "once" | "permanent")} disabled={busy}>
        <option value="once">Alleen deze productie</option>
        <option value="permanent">Vast recept aanpassen</option>
      </select>
    </label>}
    <label>Basisopbrengst ({item.unit})<input name="yield" type="number" min="0.000001" max="1000000" step="any" required disabled={busy} defaultValue={draft?.yield} /></label>
    {rows.map((row, index) => {
      const choices = row.kind === "ingredient" ? ingredients : semiFinished;
      const missing = Boolean(row.linkedId) && !choices.some(choice => choice.id === row.linkedId);
      const rowError = missing || showValidation ? rowErrors[index] : undefined;
      const errorId = `recipe-line-${row.key}-error`;
      const label = row.kind === "ingredient" ? "Grondstof" : "Halffabricaat";
      return <fieldset key={row.key} className={s.form}>
        <legend>Receptregel {index + 1}</legend>
        {editing && <label>Soort onderdeel
          <select value={row.kind} disabled={busy} onChange={event => updateRow(row.key, { kind: event.target.value as ComponentRow["kind"], linkedId: "" })}>
            <option value="ingredient">Grondstof</option>
            <option value="semiFinished">Halffabricaat</option>
          </select>
        </label>}
        <SearchableChoice label={label} name={`component-${row.key}`} value={row.linkedId}
          choices={row.kind === "ingredient" ? ingredientChoices : semiFinishedChoices}
          disabled={busy} required invalid={Boolean(rowError)} describedBy={rowError ? errorId : undefined}
          placeholder={`Zoek ${label.toLocaleLowerCase("nl-NL")}${row.kind === "ingredient" ? " of leverancier" : ""}…`}
          onChange={linkedId => updateRow(row.key, { linkedId })}/>
        <label>Hoeveelheid<input name={`quantity-${row.key}`} type="number" min="0.000001" max="1000000" step="any" required disabled={busy} value={row.quantity} onChange={event => updateRow(row.key, { quantity: event.target.value })} /></label>
        <label>Eenheid
          <select name={`unit-${row.key}`} disabled={busy} value={row.unit} onChange={event => updateRow(row.key, { unit: event.target.value })}>
            {!WORK_RECIPE_UNITS.includes(row.unit) && <option value={row.unit} disabled>Controleer eenheid ({row.unit || "ontbreekt"})</option>}
            {WORK_RECIPE_UNITS.map(unit => <option key={unit}>{unit}</option>)}
          </select>
        </label>
        {rowError && <p id={errorId} role="alert" className={s.error}>{missing ? "Deze koppeling bestaat niet meer. " : ""}{rowError}</p>}
        {(editing || rows.length > 1) && <button type="button" disabled={busy} onClick={() => setRows(current => current.filter(line => line.key !== row.key))}>Regel verwijderen</button>}
      </fieldset>;
    })}
    <button type="button" disabled={busy || rows.length >= (editing ? 100 : 50)} onClick={() => addRow("ingredient")}>+ Grondstof</button>
    {editing && <>
      <button type="button" disabled={busy || rows.length >= 100} onClick={() => addRow("semiFinished")}>+ Halffabricaat</button>
      <label>Werkvoorbereiding<textarea name="workInstructions" rows={3} maxLength={10000} disabled={busy} defaultValue={draft?.workInstructions} /></label>
    </>}
    <label>Werkwijze<textarea name="instructions" rows={4} required={!editing} maxLength={10000} disabled={busy} placeholder="Hoe maken jullie dit?" defaultValue={draft?.instructions} /></label>
    {editing && <label>Afwerking<textarea name="finishingInstructions" rows={3} maxLength={10000} disabled={busy} defaultValue={draft?.finishingInstructions} /></label>}
    {error && <p role="alert" className={s.error}>{error}</p>}
    <button type="submit" disabled={busy}>{busy ? "Opslaan…" : "Werkrecept opslaan"}</button>
    <button type="button" disabled={busy} onClick={onClose}>{editing ? "Annuleren" : "Later aanvullen"}</button>
  </form>;
}
