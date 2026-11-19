"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import type { RecipeUnit } from "../bakkerij/recepturen/types";
import { DEPARTMENTS, type DepartmentId } from "./planning";
import { WORK_RECIPE_UNITS, workRecipeComponentError } from "./workRecipe";
import type { NewRecipeInput } from "./newRecipe";
import SearchableChoice from "./SearchableChoice";
import ProductionStepsField from "./ProductionStepsField";
import s from "./NewRecipeForm.module.css";

type CatalogRow = { id: string; name: string; unit?: string; supplier?: string; articleNumber?: string; allergens: string[] };
type Catalog = { departments: DepartmentId[]; ingredients: CatalogRow[]; semiFinished: CatalogRow[]; productGroups: string[] };
type Line = { key: number; kind: "ingredient" | "semiFinished"; linkedId: string; quantity: string; unit: string };
const units = WORK_RECIPE_UNITS as RecipeUnit[];
const number = (value: string) => Number(value.replace(",", "."));
const initial = (): NewRecipeInput => ({ name: "", type: "finalProduct", departmentId: "dessert", unit: "stuk", articleNumber: "", productGroup: "", equipment: "", notes: "", allergens: [], yield: 1, instructions: "", workInstructions: "", finishingInstructions: "", productionSteps: ["Produceren"], ingredients: [], semiFinishedItems: [] });

export default function NewRecipeForm() {
  const [catalog, setCatalog] = useState<Catalog>();
  const [loadError, setLoadError] = useState("");
  const [retry, setRetry] = useState(0);
  const [draft, setDraft] = useState(initial);
  const [yieldText, setYieldText] = useState("1");
  const [lines, setLines] = useState<Line[]>([{ key: 0, kind: "ingredient", linkedId: "", quantity: "", unit: "gram" }]);
  const nextKey = useRef(1);
  const [who, setWho] = useState("");
  const [allergensText, setAllergensText] = useState("");
  const [photo, setPhoto] = useState<NewRecipeInput["photo"]>();
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const photoVersion = useRef(0);
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const commandId = useRef<string | null>(null);
  const [error, setError] = useState("");
  const [attempted, setAttempted] = useState(false);
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);
  const errorRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoadError("");
      try {
        const response = await fetch("/api/productie/recepten", { cache: "no-store", signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw Error(data.message || "Receptgegevens laden mislukt.");
        if (!controller.signal.aborted) {
          setCatalog(data);
          setDraft(current => ({ ...current, departmentId: data.departments.includes(current.departmentId) ? current.departmentId : data.departments[0] }));
        }
      } catch (reason) { if (!controller.signal.aborted) setLoadError(reason instanceof Error ? reason.message : "Laden mislukt."); }
    }
    void load();
    return () => controller.abort();
  }, [retry]);
  useEffect(() => {
    if (!dirty || saved) return;
    function protect(event: BeforeUnloadEvent) { event.preventDefault(); }
    window.addEventListener("beforeunload", protect);
    return () => window.removeEventListener("beforeunload", protect);
  }, [dirty, saved]);
  useEffect(() => { if (error) errorRef.current?.focus(); }, [error]);

  const ingredientChoices = useMemo(() => (catalog?.ingredients || []).map(row => ({ id: row.id, name: row.name, description: [row.supplier, row.articleNumber].filter(Boolean).join(" · "), searchValues: [row.articleNumber || ""] })), [catalog]);
  const semiChoices = useMemo(() => (catalog?.semiFinished || []).map(row => ({ id: row.id, name: row.name, description: row.articleNumber, searchValues: [row.articleNumber || ""] })), [catalog]);
  const linkedAllergens = [...new Set(lines.flatMap(line => (line.kind === "ingredient" ? catalog?.ingredients : catalog?.semiFinished)?.find(row => row.id === line.linkedId)?.allergens || []))];
  function changeLine(key: number, patch: Partial<Line>) { setLines(current => current.map(line => line.key === key ? { ...line, ...patch } : line)); }
  function choose(line: Line, id: string) {
    const selected = (line.kind === "ingredient" ? catalog?.ingredients : catalog?.semiFinished)?.find(row => row.id === id);
    changeLine(line.key, { linkedId: id, ...(selected?.unit && units.includes(selected.unit as RecipeUnit) ? { unit: selected.unit } : {}) });
  }
  function lineError(line: Line, index: number) {
    const available = line.kind === "ingredient" ? catalog?.ingredients : catalog?.semiFinished;
    return workRecipeComponentError({ kind: line.kind, linkedId: line.linkedId, quantity: number(line.quantity), unit: line.unit }, (available || []).map(row => row.id), lines.slice(0, index).some(other => other.kind === line.kind && other.linkedId === line.linkedId));
  }
  async function selectPhoto(file?: File) {
    const version = ++photoVersion.current;
    setPhotoError(""); setPhoto(undefined);
    if (!file) { setPhotoBusy(false); return; }
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 1024 * 1024) { setPhotoBusy(false); setPhotoError("Kies een JPG-, PNG- of WebP-foto van maximaal 1 MB."); return; }
    setPhotoBusy(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(Error("Foto lezen mislukt.")); reader.readAsDataURL(file); });
      if (photoVersion.current === version) setPhoto({ dataUrl, name: file.name });
    } catch { if (photoVersion.current === version) setPhotoError("Foto lezen mislukt. Probeer opnieuw."); }
    finally { if (photoVersion.current === version) setPhotoBusy(false); }
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (submitting.current || photoBusy || !catalog) return;
    setAttempted(true); setError("");
    if (!Number.isFinite(number(yieldText)) || number(yieldText) <= 0 || number(yieldText) > 1000000) { setError("Vul een basisopbrengst groter dan nul in."); return; }
    const invalidLine = lines.map(lineError).find(Boolean);
    if (invalidLine || !lines.length || lines.length > 100) { setError(invalidLine || "Voeg één tot honderd grondstoffen of halffabricaten toe."); return; }
    if (![draft.instructions, draft.workInstructions, draft.finishingInstructions].some(value => value.trim())) { setError("Vul de werkwijze in."); return; }
    if (photoError) { setError(photoError); return; }
    submitting.current = true; setBusy(true);
    commandId.current ||= crypto.randomUUID();
    try {
      const command: NewRecipeInput = { ...draft, yield: number(yieldText), allergens: allergensText.split(/[,;\n]/).map(value => value.trim()).filter(Boolean), photo,
        ingredients: lines.filter(line => line.kind === "ingredient").map(line => ({ ingredientId: line.linkedId, quantity: number(line.quantity), unit: line.unit })),
        semiFinishedItems: lines.filter(line => line.kind === "semiFinished").map(line => ({ recipeId: line.linkedId, quantity: number(line.quantity), unit: line.unit })),
      };
      const response = await fetch("/api/productie/recepten", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ command, who, commandId: commandId.current }) });
      const result = await response.json();
      if (!response.ok) throw Error(result.message || "Opslaan mislukt. Je invoer blijft staan.");
      setSaved(true); setDirty(false);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Opslaan mislukt. Je invoer blijft staan."); }
    finally { submitting.current = false; setBusy(false); }
  }
  function reset() { setDraft(initial()); setYieldText("1"); setLines([{ key: nextKey.current++, kind: "ingredient", linkedId: "", quantity: "", unit: "gram" }]); setAllergensText(""); setPhoto(undefined); setPhotoError(""); commandId.current = null; setSaved(false); setAttempted(false); setError(""); setDirty(false); if (catalog) setDraft(current => ({ ...current, departmentId: catalog.departments[0] })); }

  if (saved) return <main className={s.page}><section className={s.success} role="status"><h1>Recept opgeslagen</h1><p><strong>{draft.name}</strong> staat in Recepten als concept, met jouw naam bij de invoer.</p><div className={s.actions}><Link className={s.primary} href="/bakkerij/productie?view=recipes">Naar recepten</Link><button type="button" onClick={reset}>Nog een recept</button></div></section></main>;
  return <main className={s.page}>
    <header className={s.header}><div><Link href="/bakkerij/productie?view=recipes" onClick={event => { if (dirty && !window.confirm("Je recept is nog niet opgeslagen. Toch teruggaan?")) event.preventDefault(); }}>← Recepten</Link><h1>Nieuw recept</h1></div><span>Concept</span></header>
    {loadError ? <p role="alert">{loadError} <button type="button" onClick={() => setRetry(value => value + 1)}>Opnieuw laden</button></p> : !catalog ? <p role="status">Receptgegevens laden…</p> : <form onSubmit={submit} onChange={() => setDirty(true)}>
      <fieldset disabled={busy} className={s.section}>
        <legend>Het recept</legend>
        <div className={s.grid}>
          <label className={s.wide}>Receptnaam<input required autoFocus maxLength={160} value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })}/></label>
          <label>Soort<select value={draft.type} onChange={event => setDraft({ ...draft, type: event.target.value as NewRecipeInput["type"] })}><option value="finalProduct">Eindproduct</option><option value="semiFinished">Halffabricaat</option></select></label>
          <label>Afdeling<select value={draft.departmentId} onChange={event => setDraft({ ...draft, departmentId: event.target.value as DepartmentId })}>{DEPARTMENTS.filter(row => catalog.departments.includes(row.id)).map(row => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label>
          <label>Basisopbrengst<input required inputMode="decimal" value={yieldText} onChange={event => setYieldText(event.target.value)} placeholder="Bijv. 84"/></label>
          <label>Eenheid<select value={draft.unit} onChange={event => setDraft({ ...draft, unit: event.target.value as RecipeUnit })}>{units.map(unit => <option key={unit}>{unit}</option>)}</select></label>
          <label>Artikelnummer<input maxLength={80} value={draft.articleNumber} onChange={event => setDraft({ ...draft, articleNumber: event.target.value })}/></label>
          <label>Productgroep<input maxLength={100} list="recipe-product-groups" value={draft.productGroup} placeholder={DEPARTMENTS.find(row => row.id === draft.departmentId)?.name} onChange={event => setDraft({ ...draft, productGroup: event.target.value })}/><datalist id="recipe-product-groups">{catalog.productGroups.map(group => <option key={group} value={group}/>)}</datalist></label>
        </div>
      </fieldset>
      <fieldset disabled={busy} className={s.section}><legend>Grondstoffen & halffabricaten</legend>
        <div className={s.lines}>{lines.map((line, index) => <div key={line.key} className={s.line}>
          <div className={s.choice}><SearchableChoice choices={line.kind === "ingredient" ? ingredientChoices : semiChoices} label={`${line.kind === "ingredient" ? "Grondstof" : "Halffabricaat"} ${index + 1}`} value={line.linkedId} onChange={id => { choose(line, id); setDirty(true); }} required disabled={busy} invalid={attempted && !!lineError(line, index)} describedBy={attempted && lineError(line, index) ? `recipe-line-${line.key}` : undefined}/></div>
          <label>Hoeveelheid<input inputMode="decimal" required value={line.quantity} onChange={event => changeLine(line.key, { quantity: event.target.value })}/></label>
          <label>Eenheid<select value={line.unit} onChange={event => changeLine(line.key, { unit: event.target.value })}>{units.map(unit => <option key={unit}>{unit}</option>)}</select></label>
          <button className={s.remove} type="button" aria-label={`Regel ${index + 1} verwijderen`} onClick={() => { setLines(current => current.filter(row => row.key !== line.key)); setDirty(true); }}>×</button>
          {attempted && lineError(line, index) && <p className={s.lineError} id={`recipe-line-${line.key}`}>{lineError(line, index)}</p>}
        </div>)}</div>
        <div className={s.actions}><button type="button" disabled={lines.length >= 100} onClick={() => { setLines(current => [...current, { key: nextKey.current++, kind: "ingredient", linkedId: "", quantity: "", unit: "gram" }]); setDirty(true); }}>+ Grondstof</button><button type="button" disabled={lines.length >= 100} onClick={() => { setLines(current => [...current, { key: nextKey.current++, kind: "semiFinished", linkedId: "", quantity: "", unit: "kg" }]); setDirty(true); }}>+ Halffabricaat</button></div>
      </fieldset>
      <fieldset disabled={busy} className={s.section}><legend>Werkwijze</legend><label>Voorbereiding<textarea rows={3} maxLength={10000} value={draft.instructions} onChange={event => setDraft({ ...draft, instructions: event.target.value })}/></label><label>Bereiding<textarea rows={5} maxLength={10000} value={draft.workInstructions} onChange={event => setDraft({ ...draft, workInstructions: event.target.value })}/></label><label>Afwerking<textarea rows={3} maxLength={10000} value={draft.finishingInstructions} onChange={event => setDraft({ ...draft, finishingInstructions: event.target.value })}/></label><ProductionStepsField value={draft.productionSteps || []} onChange={productionSteps => { setDraft({ ...draft, productionSteps }); setDirty(true); }} disabled={busy}/></fieldset>
      <fieldset disabled={busy} className={s.section}><legend>Allergenen & details</legend>
        <p className={s.hint}>Uit de gekoppelde grondstoffen en halffabricaten: <strong>{linkedAllergens.join(", ") || "nog controleren"}</strong></p>
        <label>Aanvullende allergenen<input value={allergensText} onChange={event => setAllergensText(event.target.value)} placeholder="Gescheiden door komma’s" maxLength={2000}/></label>
        <label>Benodigdheden<textarea rows={2} maxLength={2000} value={draft.equipment} onChange={event => setDraft({ ...draft, equipment: event.target.value })}/></label>
        <label>Notities<textarea rows={3} maxLength={10000} value={draft.notes} onChange={event => setDraft({ ...draft, notes: event.target.value })}/></label>
        <label>Receptfoto<input type="file" accept="image/jpeg,image/png,image/webp" onChange={event => { void selectPhoto(event.target.files?.[0]); setDirty(true); }}/><small>JPG, PNG of WebP · maximaal 1 MB</small></label>
        {photoBusy && <p role="status">Foto laden…</p>}{photoError && <p role="alert" className={s.error}>{photoError}</p>}
        {photo && <div className={s.photo}><Image unoptimized width={160} height={130} src={photo.dataUrl} alt={`Receptfoto ${draft.name || "nieuw recept"}`}/><button type="button" onClick={() => { void selectPhoto(); setDirty(true); }}>Foto verwijderen</button></div>}
      </fieldset>
      <fieldset disabled={busy} className={s.section}><legend>Opslaan</legend><label>Jouw naam<input required minLength={2} maxLength={80} autoComplete="name" value={who} onChange={event => setWho(event.target.value)}/></label><p className={s.hint}>Het recept wordt als concept opgeslagen. Controleer de allergenen voordat je ze met klanten deelt.</p></fieldset>
      {error && <p ref={errorRef} tabIndex={-1} role="alert" className={s.error}>{error}</p>}
      <div className={s.footer}><span>{draft.name || "Nieuw recept"}</span><button className={s.primary} type="submit" disabled={busy || photoBusy}>{busy ? "Opslaan…" : "Recept opslaan"}</button></div>
    </form>}
  </main>;
}
