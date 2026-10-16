"use client";

import { useState } from "react";
import type { Ingredient, IngredientSpecification, IngredientSpecificationSaver } from "./types";
import { nutritionFields } from "./labeling";
import { linkSpecsPlazaProduct } from "./specsPlazaLink";
import SpecsPlazaProductSearch from "./SpecsPlazaProductSearch";
import styles from "./SpecsPlazaLink.module.css";

export default function IngredientSpecificationEditor({ ingredient, onSave, embedded = false }: {
  ingredient: Ingredient;
  onSave: IngredientSpecificationSaver;
  embedded?: boolean;
}) {
  const [feedback, setFeedback] = useState("");
  const content = <div className={styles.editor}>
    <SpecsPlazaProductSearch ingredientName={ingredient.name} articleNumber={ingredient.supplierArticleNumber} link={ingredient.specification?.specsPlazaLink} onLink={async (result) => {
      setFeedback("");
      await onSave(linkSpecsPlazaProduct(ingredient, result), ingredient, "specsplaza-link");
    }} />
    <details className={styles.manual}>
      <summary>Handmatig aanvullen</summary>
      <ManualSpecificationForm key={`${ingredient.id}-${ingredient.specification?.updatedAt || ""}`} ingredient={ingredient} onSave={onSave} onSaved={() => setFeedback("Eigen specificatie opgeslagen.")} />
    </details>
    {feedback && <p role="status" className={styles.feedback}>{feedback}</p>}
  </div>;
  return embedded ? <section aria-label="Productspecificatie">{content}</section> : <details className="my-3 rounded-xl border border-[#e4ded5] bg-white p-3">
    <summary className="min-h-8 cursor-pointer content-center text-xs font-bold">Koppelen aan SpecsPlaza</summary>
    <div className="pt-2">{content}</div>
  </details>;
}

function ManualSpecificationForm({ ingredient, onSave, onSaved }: {
  ingredient: Ingredient;
  onSave: IngredientSpecificationSaver;
  onSaved: () => void;
}) {
  const [original] = useState(ingredient);
  const [spec, setSpec] = useState<IngredientSpecification>(ingredient.specification || {});
  const [allergens, setAllergens] = useState(ingredient.allergens.join(", "));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  return <form onSubmit={async (event) => {
    event.preventDefault();
    if (saving) return;
    const data = new FormData(event.currentTarget);
    const number = (key: string) => { const raw = String(data.get(key) || "").trim(); return raw ? Number(raw.replace(",", ".")) : undefined; };
    const values = nutritionFields.map(([key]) => [key, number(key)] as const);
    const density = number("density"), pieceWeight = number("pieceWeight");
    if ([...values.map((item) => item[1]), density, pieceWeight].some((value) => value !== undefined && (!Number.isFinite(value) || value < 0))) { setError("Vul geldige, niet-negatieve getallen in of laat onbekende waarden leeg."); return; }
    if ([density, pieceWeight].some((value) => value !== undefined && value <= 0)) { setError("Dichtheid en stukgewicht moeten positief zijn, of leeg blijven."); return; }
    setSaving(true); setError("");
    try {
      await onSave({ ...original, allergens: allergens.split(/[,;\n]/).map((item) => item.trim()).filter(Boolean), specification: { ...spec, nutritionPer100g: Object.fromEntries(values.filter((item) => item[1] !== undefined)), densityGramsPerMl: density, pieceWeightGrams: pieceWeight, updatedAt: new Date().toISOString() } }, original);
      onSaved();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Opslaan is mislukt. Probeer opnieuw."); }
    finally { setSaving(false); }
  }}>
    <label>Bron / leveranciersdocument<input value={spec.source || ""} onChange={(event) => setSpec({ ...spec, source: event.target.value })} /></label>
    <label>Samenstelling<textarea value={spec.ingredientsText || ""} onChange={(event) => setSpec({ ...spec, ingredientsText: event.target.value })} /></label>
    <label>Allergenen<input value={allergens} onChange={(event) => setAllergens(event.target.value)} /></label>
    <label className={styles.checkbox}><input type="checkbox" checked={Boolean(spec.allergensConfirmed)} onChange={(event) => setSpec({ ...spec, allergensConfirmed: event.target.checked })} />Allergeengegevens gecontroleerd</label>
    <h3>Voedingswaarden per 100 g</h3>
    <div className={styles.grid}>{nutritionFields.map(([key, label, unit]) => <label key={key}>{label} ({unit})<input name={key} inputMode="decimal" defaultValue={spec.nutritionPer100g?.[key] ?? ""} placeholder="Onbekend" /></label>)}</div>
    <div className={styles.grid}><label>Dichtheid (g/ml)<input name="density" inputMode="decimal" defaultValue={spec.densityGramsPerMl ?? ""} /></label><label>Stukgewicht (g)<input name="pieceWeight" inputMode="decimal" defaultValue={spec.pieceWeightGrams ?? ""} /></label></div>
    <button type="submit" className={styles.primary} disabled={saving}>{saving ? "Opslaan…" : "Opslaan"}</button>
    {error && <p role="alert" className={styles.error}>Niet opgeslagen: {error}</p>}
  </form>;
}
