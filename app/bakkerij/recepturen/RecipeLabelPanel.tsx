"use client";

import { useState } from "react";
import type { Ingredient, Recipe, RecipeLabeling } from "./types";
import { calculateLabel, nutritionFields } from "./labeling";
import IngredientSpecificationEditor from "./IngredientSpecificationEditor";
import styles from "./RecipeScreens.module.css";

export default function RecipeLabelPanel({ recipe, ingredients, recipes, onSave, onSaveIngredient }: {
  recipe: Recipe;
  ingredients: Ingredient[];
  recipes: Recipe[];
  onSave: (recipe: Recipe) => void;
  onSaveIngredient?: (ingredient: Ingredient) => void;
}) {
  const [draft, setDraft] = useState<RecipeLabeling>(recipe.labeling || {});
  const [weight, setWeight] = useState(String(draft.finalBatchWeightGrams || ""));
  const [feedback, setFeedback] = useState("");
  const grams = Number(weight.replace(",", "."));
  const labeling = { ...draft, finalBatchWeightGrams: Number.isFinite(grams) && grams > 0 ? grams : undefined };
  const result = calculateLabel({ ...recipe, labeling }, ingredients, recipes);
  const proposedIngredients = result.composition.map(({ ingredient }) => ingredient.specification?.ingredientsText ? `${ingredient.name} (${ingredient.specification.ingredientsText})` : ingredient.name).join(", ");
  const composition = draft.ingredientsText || proposedIngredients;
  const allergenPattern = result.allergens.length ? new RegExp(`(${result.allergens.map((item) => item.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).filter(Boolean).join("|")})`, "gi") : null;
  const fields = [
    ["productName", "Productnaam"], ["netQuantity", "Nettohoeveelheid"],
    ["storageInstructions", "Bewaaradvies"], ["shelfLifeText", "Houdbaarheid"],
    ["operatorDetails", "Bedrijfsnaam en adres"], ["notes", "Interne controlepunten"],
  ] as const;

  return <details className={styles.labelPanel}>
    <summary><span>Etikettering</span><span className="text-[0.7rem] font-semibold text-[#805d19]">Concept{result.warnings.length ? ` · ${result.warnings.length} controlepunten` : " · controleren"}</span></summary>
    <div className={styles.labelBody}>
      <p className="text-xs"><strong>Bekende allergenen:</strong> {result.allergens.join(", ") || "Nog te controleren"}</p>

      {onSaveIngredient && <details className="rounded-lg border border-[#e5e1d8] bg-white px-2.5">
        <summary className="min-h-8 cursor-pointer content-center text-xs font-bold">Grondstoffen · {result.usedIngredients.length}</summary>
        <div className="mb-2 divide-y divide-[#e5e1d8]">
          {result.usedIngredients.map((ingredient) => <details key={ingredient.id} className="py-1">
            <summary className="flex min-h-9 cursor-pointer items-center justify-between gap-3 text-xs">
              <span className="min-w-0"><strong className="block">{ingredient.name}</strong><span className="block text-[0.7rem] text-[#82786e]">{[ingredient.supplier, ingredient.supplierArticleNumber].filter(Boolean).join(" · ") || "Leveranciersgegevens aanvullen"}</span></span>
              <span className={`shrink-0 text-[0.7rem] font-semibold ${ingredient.specification?.allergensConfirmed ? "text-[#315e42]" : "text-[#805d19]"}`}>{ingredient.specification?.allergensConfirmed ? "Gecontroleerd" : "Controleren"} ▸</span>
            </summary>
            <div className="py-2"><IngredientSpecificationEditor ingredient={ingredient} onSave={onSaveIngredient} embedded /></div>
          </details>)}
        </div>
      </details>}

      <details className="rounded-lg border border-[#e5e1d8] bg-white px-2.5">
        <summary className="min-h-8 cursor-pointer content-center text-xs font-bold">Etiketgegevens bewerken</summary>
        <div className="grid gap-2 pb-3 pt-1 sm:grid-cols-2">
          {fields.map(([key, label]) => <label key={key} className="grid min-w-0 gap-1 text-xs font-semibold">{label}<input value={draft[key] || ""} onChange={(event) => setDraft({ ...draft, [key]: event.target.value })} /></label>)}
          <label className="grid min-w-0 gap-1 text-xs font-semibold sm:col-span-2">Eindgewicht hele batch na bereiding (gram)<input inputMode="decimal" value={weight} onChange={(event) => setWeight(event.target.value)} /></label>
          <label className="grid min-w-0 gap-1 text-xs font-semibold sm:col-span-2">Ingrediëntentekst<textarea value={draft.ingredientsText || ""} onChange={(event) => setDraft({ ...draft, ingredientsText: event.target.value })} placeholder={proposedIngredients || "Ingrediëntenverklaring"} className="min-h-20" /></label>
        </div>
      </details>

      <details className="rounded-lg border border-[#e5e1d8] bg-white px-2.5">
        <summary className="min-h-8 cursor-pointer content-center text-xs font-bold">Etiketconcept bekijken</summary>
        <div className="grid gap-2 pb-3 pt-1 text-xs">
          <h3>{draft.productName || recipe.name}</h3>
          <p><strong>Ingrediënten:</strong> {allergenPattern ? composition.split(allergenPattern).map((part, index) => result.allergens.some((allergen) => allergen.toLowerCase() === part.toLowerCase()) ? <strong key={index}>{part}</strong> : part) : composition || "Nog niet ingevuld"}</p>
          <p><strong>Bekende allergenen:</strong> {result.allergens.join(", ") || "Nog te controleren"}</p>
          <p>{[draft.netQuantity, draft.storageInstructions, draft.shelfLifeText].filter(Boolean).join(" · ")}</p>
          {draft.operatorDetails && <p>{draft.operatorDetails}</p>}
          <table className="w-full text-xs"><caption className="pb-1 text-left font-bold">Voedingswaarde per 100 g</caption><tbody>{nutritionFields.map(([key, label, unit]) => <tr key={key} className="border-t border-[#e5e1d8]"><th scope="row" className="py-1 text-left font-normal">{label}</th><td className="py-1 text-right font-semibold tabular-nums">{result.nutrition[key] === undefined ? "—" : result.nutrition[key]!.toLocaleString("nl-NL", { maximumFractionDigits: 2 })} {unit}</td></tr>)}</tbody></table>
        </div>
      </details>

      {result.warnings.length > 0 && <details className="rounded-lg bg-[#fff4d8] px-2.5 text-[#805d19]">
        <summary className="min-h-8 cursor-pointer content-center text-xs font-bold">Nog controleren · {result.warnings.length}</summary>
        <ul className="grid list-disc gap-1 pb-3 pl-4 text-xs">{result.warnings.map((item) => <li key={item}>{item}</li>)}</ul>
      </details>}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <a href="https://www.nvwa.nl/onderwerpen/voedselveiligheid/allergenen/allergenen-op-etiket-levensmiddelen" target="_blank" rel="noreferrer" className="text-[0.7rem] text-[#82786e] underline">Etiket controleren · uitleg NVWA</a>
        <button type="button" onClick={() => {
          if (weight.trim() && (!Number.isFinite(grams) || grams <= 0)) { setFeedback("Vul een positief eindgewicht in, of laat het leeg."); return; }
          onSave({ ...recipe, labeling, lastUpdated: new Date().toISOString().slice(0, 10) });
          setFeedback("Etiketteringsgegevens opgeslagen.");
        }} className="min-h-8 rounded-lg bg-[#315e42] px-3 py-1.5 text-xs font-bold text-white">Opslaan</button>
      </div>
      {feedback && <p role="status" className="text-xs font-semibold">{feedback}</p>}
    </div>
  </details>;
}
