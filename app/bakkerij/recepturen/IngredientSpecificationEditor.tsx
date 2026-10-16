"use client";
import { useState } from "react";
import type { Ingredient, IngredientSpecification } from "./types";
import { nutritionFields } from "./labeling";
import SpecsPlazaProductSearch from "./SpecsPlazaProductSearch";

export default function IngredientSpecificationEditor({ ingredient, onSave, embedded = false }: { ingredient: Ingredient; onSave: (ingredient: Ingredient) => void; embedded?: boolean }) {
  const [spec, setSpec] = useState<IngredientSpecification>(ingredient.specification || {});
  const [allergens, setAllergens] = useState(ingredient.allergens.join(", "));
  const [feedback, setFeedback] = useState("");
  const fieldClass = `${embedded ? "min-h-9 rounded-lg p-2 text-xs" : "min-h-11 rounded-xl p-2"} w-full min-w-0 border border-[#e4ded5] bg-white`;
  const gridClass = embedded ? "grid gap-2" : "grid gap-3 sm:grid-cols-2";
  const labelClass = embedded ? "grid min-w-0 gap-1 text-xs font-bold" : "grid min-w-0 gap-1 text-sm font-bold";
  const form = <form className={embedded ? "space-y-3 text-xs" : "mt-4 space-y-4"} onSubmit={(event) => {
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
      <p className="text-xs leading-relaxed text-[#75685f]">Leg hier jullie eigen gecontroleerde specificatie vast. De zoekresultaten hierboven worden alleen bekeken en niet automatisch in deze gegevens overgenomen.</p>
      <div className={gridClass}>{([["specsPlazaId", "SpecsPlaza product-ID"], ["specificationVersion", "Versie specificatie"], ["source", "Bron / leveranciersdocument"]] as const).map(([key, label]) => <label key={key} className={labelClass}>{label}<input value={spec[key] || ""} onChange={(event) => setSpec({ ...spec, [key]: event.target.value })} className={fieldClass} /></label>)}</div>
      <label className={labelClass}>Samenstelling volgens leverancier<textarea value={spec.ingredientsText || ""} onChange={(event) => setSpec({ ...spec, ingredientsText: event.target.value })} className={`${fieldClass} min-h-20`} /></label>
      <label className={labelClass}>Allergenen (bijvoorbeeld tarwe, ei, melk)<input value={allergens} onChange={(event) => setAllergens(event.target.value)} className={fieldClass} /></label>
      <label className={`flex items-center gap-2 font-bold ${embedded ? "min-h-9 text-xs" : "min-h-11 text-sm"}`}><input type="checkbox" checked={Boolean(spec.allergensConfirmed)} onChange={(event) => setSpec({ ...spec, allergensConfirmed: event.target.checked })} />Allergeengegevens gecontroleerd aan de hand van de specificatie</label>
      <h3 className="font-black">Voedingswaarden per 100 gram grondstof</h3>
      <div className={embedded ? "grid grid-cols-2 gap-2" : "grid gap-3 sm:grid-cols-2 lg:grid-cols-4"}>{nutritionFields.map(([key, label, unit]) => <label key={key} className={labelClass}>{label} ({unit})<input name={key} inputMode="decimal" defaultValue={spec.nutritionPer100g?.[key] ?? ""} placeholder="Onbekend" className={fieldClass} /></label>)}</div>
      <div className={gridClass}><label className={labelClass}>Dichtheid (gram per ml, indien nodig)<input name="density" inputMode="decimal" defaultValue={spec.densityGramsPerMl ?? ""} className={fieldClass} /></label><label className={labelClass}>Gewicht per stuk (gram, indien nodig)<input name="pieceWeight" inputMode="decimal" defaultValue={spec.pieceWeightGrams ?? ""} className={fieldClass} /></label></div>
      <button type="submit" className={`${embedded ? "min-h-9 rounded-lg text-xs" : "min-h-11 rounded-xl"} bg-[#315e42] px-4 py-2 font-bold text-white`}>Specificatie opslaan</button>
      {feedback ? <p role="status" className="text-sm font-bold">{feedback}</p> : null}
    </form>;
  const content = <div className="grid gap-3">
    <SpecsPlazaProductSearch articleNumber={ingredient.supplierArticleNumber} />
    <details className="rounded-xl border border-[#e4ded5] bg-white p-3">
      <summary className="min-h-8 cursor-pointer content-center text-xs font-bold">Eigen productspecificatie handmatig bewerken</summary>
      <div className="mt-3">{form}</div>
    </details>
  </div>;
  return embedded ? <section aria-label="Productspecificatie">{content}</section> : <details className="my-3 rounded-2xl border border-[#c3d3bc] bg-white p-4">
    <summary className="min-h-11 cursor-pointer text-base font-black">Etikettering · productspecificatie</summary>
    <div className="mt-3">{content}</div>
  </details>;
}
