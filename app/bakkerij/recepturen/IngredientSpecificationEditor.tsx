"use client";
import { useState } from "react";
import type { Ingredient, IngredientSpecification } from "./types";
import { nutritionFields } from "./labeling";

export default function IngredientSpecificationEditor({ ingredient, onSave }: { ingredient: Ingredient; onSave: (ingredient: Ingredient) => void }) {
  const [spec, setSpec] = useState<IngredientSpecification>(ingredient.specification || {});
  const [allergens, setAllergens] = useState(ingredient.allergens.join(", "));
  const [feedback, setFeedback] = useState("");
  return <details className="my-3 rounded-2xl border border-[#c3d3bc] bg-white p-4">
    <summary className="min-h-11 cursor-pointer text-base font-black">Etikettering · productspecificatie</summary>
    <form className="mt-4 space-y-4" onSubmit={(event) => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      const number = (key: string) => { const raw = String(data.get(key) || "").trim(); return raw ? Number(raw.replace(",", ".")) : undefined; };
      const values = nutritionFields.map(([key]) => [key, number(key)] as const);
      const density = number("density"), pieceWeight = number("pieceWeight");
      if ([...values.map((item) => item[1]), density, pieceWeight].some((value) => value !== undefined && (!Number.isFinite(value) || value < 0))) { setFeedback("Vul geldige, niet-negatieve getallen in of laat onbekende waarden leeg."); return; }
      if ([density, pieceWeight].some((value) => value !== undefined && value <= 0)) { setFeedback("Dichtheid en stukgewicht moeten positief zijn, of leeg blijven."); return; }
      onSave({ ...ingredient, allergens: allergens.split(/[,;\n]/).map((item) => item.trim()).filter(Boolean), specification: { ...spec, nutritionPer100g: Object.fromEntries(values.filter((item) => item[1] !== undefined)), densityGramsPerMl: density, pieceWeightGrams: pieceWeight, updatedAt: new Date().toISOString() } });
      setFeedback("Specificatie opgeslagen.");
    }}>
      <p className="text-sm text-[#75685f]">Voer leveranciersgegevens in. De SpecsPlaza-ID bereidt de koppeling voor; er is nog geen automatische synchronisatie.</p>
      <div className="grid gap-3 sm:grid-cols-2">{([["specsPlazaId", "SpecsPlaza product-ID"], ["specificationVersion", "Versie specificatie"], ["source", "Bron / leveranciersdocument"]] as const).map(([key, label]) => <label key={key} className="grid gap-1 text-sm font-bold">{label}<input value={spec[key] || ""} onChange={(event) => setSpec({ ...spec, [key]: event.target.value })} className="min-h-11 rounded-xl border p-2" /></label>)}</div>
      <label className="grid gap-1 text-sm font-bold">Samenstelling volgens leverancier<textarea value={spec.ingredientsText || ""} onChange={(event) => setSpec({ ...spec, ingredientsText: event.target.value })} className="min-h-20 rounded-xl border p-2" /></label>
      <label className="grid gap-1 text-sm font-bold">Allergenen (bijvoorbeeld tarwe, ei, melk)<input value={allergens} onChange={(event) => setAllergens(event.target.value)} className="min-h-11 rounded-xl border p-2" /></label>
      <label className="flex min-h-11 items-center gap-3 text-sm font-bold"><input type="checkbox" checked={Boolean(spec.allergensConfirmed)} onChange={(event) => setSpec({ ...spec, allergensConfirmed: event.target.checked })} />Allergeengegevens gecontroleerd aan de hand van de specificatie</label>
      <h3 className="font-black">Voedingswaarden per 100 gram grondstof</h3>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{nutritionFields.map(([key, label, unit]) => <label key={key} className="grid gap-1 text-sm font-bold">{label} ({unit})<input name={key} inputMode="decimal" defaultValue={spec.nutritionPer100g?.[key] ?? ""} placeholder="Onbekend" className="min-h-11 rounded-xl border p-2" /></label>)}</div>
      <div className="grid gap-3 sm:grid-cols-2"><label className="grid gap-1 text-sm font-bold">Dichtheid (gram per ml, indien nodig)<input name="density" inputMode="decimal" defaultValue={spec.densityGramsPerMl ?? ""} className="min-h-11 rounded-xl border p-2" /></label><label className="grid gap-1 text-sm font-bold">Gewicht per stuk (gram, indien nodig)<input name="pieceWeight" inputMode="decimal" defaultValue={spec.pieceWeightGrams ?? ""} className="min-h-11 rounded-xl border p-2" /></label></div>
      <button type="submit" className="min-h-11 rounded-xl bg-[#315e42] px-4 font-bold text-white">Specificatie opslaan</button>
      {feedback ? <p role="status" className="text-sm font-bold">{feedback}</p> : null}
    </form>
  </details>;
}
