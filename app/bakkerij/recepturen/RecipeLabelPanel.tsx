"use client";
import { useState } from "react";
import type { Ingredient, Recipe, RecipeLabeling } from "./types";
import { calculateLabel, nutritionFields } from "./labeling";
import IngredientSpecificationEditor from "./IngredientSpecificationEditor";

export default function RecipeLabelPanel({ recipe, ingredients, recipes, onSave, onSaveIngredient }: { recipe: Recipe; ingredients: Ingredient[]; recipes: Recipe[]; onSave: (recipe: Recipe) => void; onSaveIngredient?: (ingredient: Ingredient) => void }) {
  const [draft, setDraft] = useState<RecipeLabeling>(recipe.labeling || {});
  const [weight, setWeight] = useState(String(draft.finalBatchWeightGrams || ""));
  const [feedback, setFeedback] = useState("");
  const grams = Number(weight.replace(",", "."));
  const labeling = { ...draft, finalBatchWeightGrams: Number.isFinite(grams) && grams > 0 ? grams : undefined };
  const result = calculateLabel({ ...recipe, labeling }, ingredients, recipes);
  const proposedIngredients = result.composition.map(({ ingredient }) => ingredient.specification?.ingredientsText ? `${ingredient.name} (${ingredient.specification.ingredientsText})` : ingredient.name).join(", ");
  const composition = draft.ingredientsText || proposedIngredients;
  const allergenPattern = result.allergens.length ? new RegExp(`(${result.allergens.map((item) => item.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).filter(Boolean).join("|")})`, "gi") : null;
  return <details className="my-3 rounded-2xl border border-[#c3d3bc] bg-[#fffdf8] p-4">
    <summary className="min-h-11 cursor-pointer text-base font-black">Etikettering <span className="ml-2 text-xs font-bold text-[#8a6a3d]">Concept · {result.warnings.length ? "gegevens aanvullen" : "berekening beschikbaar"}</span></summary>
    <div className="mt-4 space-y-4">
      <p className="text-sm text-[#75685f]">Voedingswaarden worden uit de gekoppelde grondstoffen en halffabricaten berekend. Het eindgewicht is het gewicht van de volledige batch na bereiding.</p>
      {onSaveIngredient ? <details className="rounded-xl border bg-white p-3"><summary className="min-h-11 cursor-pointer font-bold">Gekoppelde grondstoffen · specificaties invullen</summary>{result.usedIngredients.map((ingredient) => <div key={ingredient.id}><h4 className="mt-3 font-bold">{ingredient.name}</h4><IngredientSpecificationEditor ingredient={ingredient} onSave={onSaveIngredient} /></div>)}</details> : null}
      <div className="grid gap-3 sm:grid-cols-2">{([["productName", "Naam op het etiket"], ["netQuantity", "Nettohoeveelheid / verpakking"], ["storageInstructions", "Bewaaradvies"], ["shelfLifeText", "Houdbaarheidstekst"], ["operatorDetails", "Bedrijfsnaam en adres"], ["notes", "Interne controlepunten"]] as const).map(([key, label]) => <label key={key} className="grid gap-1 text-sm font-bold">{label}<input value={draft[key] || ""} onChange={(event) => setDraft({ ...draft, [key]: event.target.value })} className="min-h-11 rounded-xl border bg-white p-2" /></label>)}</div>
      <label className="grid gap-1 text-sm font-bold">Eindgewicht volledige batch (gram)<input inputMode="decimal" value={weight} onChange={(event) => setWeight(event.target.value)} className="min-h-11 rounded-xl border bg-white p-2" /></label>
      <label className="grid gap-1 text-sm font-bold">Ingrediëntentekst op etiket<textarea value={draft.ingredientsText || ""} onChange={(event) => setDraft({ ...draft, ingredientsText: event.target.value })} placeholder={proposedIngredients || "Vul de ingrediëntenverklaring in"} className="min-h-24 rounded-xl border bg-white p-2" /></label>
      <div className="rounded-xl border bg-white p-4"><p className="text-xs font-bold uppercase text-[#8a6a3d]">Etiketconcept · controleren voor gebruik</p><h3 className="mt-2 text-xl font-black">{draft.productName || recipe.name}</h3><p className="mt-2 text-sm"><strong>Ingrediënten:</strong> {allergenPattern ? composition.split(allergenPattern).map((part, index) => result.allergens.some((allergen) => allergen.toLowerCase() === part.toLowerCase()) ? <strong key={index}>{part}</strong> : part) : composition || "Nog niet ingevuld"}</p><p className="mt-2 text-sm"><strong>Bekende allergenen:</strong> {result.allergens.join(", ") || "Nog te controleren"}</p><p className="mt-2 text-sm">{draft.netQuantity} · {draft.storageInstructions} · {draft.shelfLifeText}</p><p className="text-sm">{draft.operatorDetails}</p>
        <table className="mt-3 w-full text-sm"><caption className="text-left font-black">Voedingswaarde per 100 g eindproduct</caption><tbody>{nutritionFields.map(([key, label, unit]) => <tr key={key} className="border-t"><td className="py-2">{label}</td><td className="text-right font-bold">{result.nutrition[key] === undefined ? "—" : result.nutrition[key]!.toLocaleString("nl-NL", { maximumFractionDigits: 2 })} {unit}</td></tr>)}</tbody></table>
      </div>
      {result.warnings.length ? <div className="rounded-xl bg-[#fff5d8] p-3 text-sm"><strong>Nog aanvullen / controleren:</strong><ul className="mt-2 list-disc pl-5">{result.warnings.map((item) => <li key={item}>{item}</li>)}</ul></div> : null}
      <p className="text-xs text-[#75685f]">Ingrediëntenvoorstel op basis van gekoppelde gewichten. Controleer de definitieve ingrediëntenverklaring en benadruk alle allergenen daarin. <a href="https://www.nvwa.nl/onderwerpen/voedselveiligheid/allergenen/allergenen-op-etiket-levensmiddelen" target="_blank" rel="noreferrer" className="underline">Uitleg NVWA</a></p>
      <button type="button" onClick={() => {
        if (weight.trim() && (!Number.isFinite(grams) || grams <= 0)) { setFeedback("Vul een positief eindgewicht in, of laat het leeg."); return; }
        onSave({ ...recipe, labeling, lastUpdated: new Date().toISOString().slice(0, 10) }); setFeedback("Etiketteringsgegevens opgeslagen.");
      }} className="min-h-11 rounded-xl bg-[#315e42] px-4 font-bold text-white">Etikettering opslaan</button>
      {feedback ? <p role="status" className="text-sm font-bold">{feedback}</p> : null}
    </div>
  </details>;
}
