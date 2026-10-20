"use client";

import managementStyles from "./ManagementScreens.module.css";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import IngredientSpecificationEditor from "./IngredientSpecificationEditor";
import SpecsPlazaConnectionPanel from "./SpecsPlazaConnectionPanel";
import { EmptyState, FilterSelect, Panel, SearchInput } from "./RecepturenShared";
import type { Ingredient, IngredientSpecificationSaver, Recipe } from "./types";
import styles from "./SpecsPlazaLink.module.css";
import {
  changeBadgeClass,
  formatDate,
  formatEuro,
  formatSignedPercent,
  ingredientPackagePrice,
  ingredientPriceChange,
  normalizeSearch,
  packagePriceLabel,
  quantityLabel,
  recipesUsingIngredient,
} from "./utils";

type SpecificationStatus = "unlinked" | "incomplete" | "registered";
type DetailTab = "overview" | "specification" | "recipes";

const statusLabels: Record<SpecificationStatus, string> = {
  unlinked: "Te koppelen",
  incomplete: "Gegevens aanvullen",
  registered: "Gekoppeld",
};

function specificationStatus(ingredient: Ingredient): SpecificationStatus {
  if (ingredient.specification?.specsPlazaId?.trim()) return "registered";
  if (!ingredient.supplier.trim() || !ingredient.supplierArticleNumber.trim()) {
    return "incomplete";
  }
  return "unlinked";
}

function SpecificationBadge({ ingredient }: Readonly<{ ingredient: Ingredient }>) {
  const status = specificationStatus(ingredient);
  return (
    <span className={`inline-flex items-center gap-1 text-[0.7rem] font-bold leading-4 ${
      status === "registered" ? "text-[#315e42]" : status === "incomplete" ? "text-[#805d19]" : "text-[#82786e]"
    }`}>
      <span aria-hidden="true">{status === "registered" ? "✓" : status === "incomplete" ? "!" : "↗"}</span>
      {ingredient.specification?.specsPlazaLink?.environment === "test" ? "Testkoppeling" : status === "registered" && !ingredient.specification?.specsPlazaLink ? "ID vastgelegd" : statusLabels[status]}
    </span>
  );
}

export default function IngredientsOverview({
  ingredients,
  recipes,
  onEditIngredient,
  onOpenImport,
  onUpdateSpecification,
}: Readonly<{
  ingredients: Ingredient[];
  recipes: Recipe[];
  onEditIngredient: (ingredient?: Ingredient) => void;
  onOpenImport: () => void;
  onUpdateSpecification: IngredientSpecificationSaver;
}>) {
  const [search, setSearch] = useState("");
  const [supplier, setSupplier] = useState("all");
  const [allergen, setAllergen] = useState("all");
  const [priceChange, setPriceChange] = useState("all");
  const [showInactive, setShowInactive] = useState(false);
  const [status, setStatus] = useState<"all" | SpecificationStatus>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const detailRef = useRef<HTMLDivElement>(null);
  const selectedIngredient = ingredients.find((item) => item.id === selectedId);
  useEffect(() => {
    if (selectedId && window.matchMedia("(max-width: 1279px)").matches) {
      detailRef.current?.scrollIntoView({
        block: "start",
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      });
    }
  }, [selectedId]);
  const suppliers = [...new Set(ingredients.map((item) => item.supplier).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "nl-NL"));
  const allergens = [...new Set(ingredients.flatMap((item) => item.allergens))]
    .sort((a, b) => a.localeCompare(b, "nl-NL"));
  const recipeCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const recipe of recipes) {
      for (const id of new Set(recipe.ingredients.map((line) => line.ingredientId))) {
        counts.set(id, (counts.get(id) || 0) + 1);
      }
    }
    return counts;
  }, [recipes]);
  const matchingIngredients = useMemo(() => {
    const query = normalizeSearch(search);
    return ingredients.filter((ingredient) => {
      const change = ingredientPriceChange(ingredient);
      return (
        (showInactive || ingredient.status !== "inactive") &&
        (!query || [ingredient.name, ingredient.supplier, ingredient.supplierArticleNumber, ...ingredient.aliases]
          .some((value) => normalizeSearch(value).includes(query))) &&
        (supplier === "all" || ingredient.supplier === supplier) &&
        (allergen === "all" || ingredient.allergens.includes(allergen)) &&
        (priceChange === "all" || (priceChange === "up" && change > 0) ||
          (priceChange === "high" && change >= 8) || (priceChange === "stable" && Math.abs(change) < 2))
      );
    });
  }, [allergen, ingredients, priceChange, search, showInactive, supplier]);
  const filteredIngredients = matchingIngredients.filter(
    (ingredient) => status === "all" || specificationStatus(ingredient) === status
  );
  const filters = [
    ["all", "Alle"], ["unlinked", "Te koppelen"], ["incomplete", "Aanvullen"], ["registered", "Gekoppeld"],
  ] as const;
  const extraFilterCount = Number(allergen !== "all") + Number(priceChange !== "all") + Number(showInactive);

  return (
    <Panel className="!rounded-2xl !bg-[#fffefa] !p-3 sm:!p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-[#2d2a26]">Grondstoffen</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={onOpenImport} className={managementStyles.action}>Bestand uploaden</button>
          <button type="button" onClick={() => onEditIngredient()} className={`${managementStyles.action} ${managementStyles.primaryAction}`}>+ Nieuwe grondstof</button>
        </div>
      </div>

      <div className="mt-4 grid items-end gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(10rem,14rem)_auto]">
        <SearchInput value={search} onChange={setSearch} placeholder="Zoek naam, leverancier of artikelnummer" />
        <FilterSelect label="Leverancier" value={supplier} onChange={setSupplier} options={[
          { value: "all", label: "Alle leveranciers" }, ...suppliers.map((item) => ({ value: item, label: item })),
        ]} />
        <details className="relative">
          <summary className="min-h-9 cursor-pointer content-center rounded-lg border border-[#e4ded5] bg-white px-3 py-2 text-xs font-bold text-[#75685f]">Meer filters{extraFilterCount ? ` · ${extraFilterCount}` : ""}</summary>
          <div className="z-10 mt-2 grid gap-3 rounded-xl border border-[#e4ded5] bg-white p-3 shadow-sm sm:absolute sm:right-0 sm:min-w-64">
            <label className="flex items-center gap-2 text-xs font-bold"><input type="checkbox" checked={showInactive} onChange={(event) => setShowInactive(event.target.checked)} />Toon oude grondstoffen</label>
            <FilterSelect label="Allergeen" value={allergen} onChange={setAllergen} options={[
              { value: "all", label: "Alle allergenen" }, ...allergens.map((item) => ({ value: item, label: item })),
            ]} />
            <FilterSelect label="Prijs" value={priceChange} onChange={setPriceChange} options={[
              { value: "all", label: "Alle wijzigingen" }, { value: "up", label: "Prijsstijging" },
              { value: "high", label: "Sterke stijging" }, { value: "stable", label: "Stabiel" },
            ]} />
          </div>
        </details>
      </div>
      <div className="flex flex-wrap items-center gap-1 py-2.5" aria-label="Filter productspecificatie">
        {filters.map(([value, label]) => (
          <button key={value} type="button" aria-pressed={status === value} onClick={() => setStatus(value)} className={`min-h-8 rounded-lg px-2.5 py-1.5 text-xs font-bold ${status === value ? "bg-[#edf3e8] text-[#315e42]" : "text-[#82786e] hover:bg-[#f5f2ee]"}`}>
            {label} <span className="ml-1 text-[0.68rem] opacity-65">{value === "all" ? matchingIngredients.length : matchingIngredients.filter((item) => specificationStatus(item) === value).length}</span>
          </button>
        ))}
        {(search || supplier !== "all" || extraFilterCount || status !== "all") ? (
          <button type="button" onClick={() => { setSearch(""); setSupplier("all"); setAllergen("all"); setPriceChange("all"); setShowInactive(false); setStatus("all"); }} className="ml-auto min-h-8 px-2 text-xs font-bold text-[#82786e] underline underline-offset-2">Filters wissen</button>
        ) : null}
      </div>

      <div className={`grid items-start gap-4 ${selectedIngredient ? "xl:grid-cols-[minmax(0,1.2fr)_minmax(20rem,0.9fr)]" : ""}`}>
        <div className="min-w-0">
          <div className={`hidden items-center gap-3 border-b border-[#e7e3da] px-2 py-1.5 text-[0.68rem] font-bold text-[#82786e] sm:grid ${selectedIngredient ? "xl:grid-cols-[minmax(0,1fr)_5.5rem_1rem] grid-cols-[minmax(0,1fr)_6rem_8.25rem_1rem]" : "grid-cols-[minmax(0,1fr)_6rem_8.25rem_1rem]"}`}>
            <span>Grondstof</span><span className="text-right">Inkoopprijs</span><span className={selectedIngredient ? "xl:hidden" : ""}>Productspecificatie</span><span />
          </div>
          {filteredIngredients.length ? (
            <div className="divide-y divide-[#e7e3da]">
              {filteredIngredients.map((ingredient) => {
                const count = recipeCounts.get(ingredient.id) || 0;
                return (
                  <button key={ingredient.id} type="button" aria-pressed={selectedId === ingredient.id} onClick={() => setSelectedId(ingredient.id)} className={`grid min-h-12 w-full grid-cols-[minmax(0,1fr)_5.5rem_1rem] items-center gap-2 px-2 py-1.5 text-left transition ${selectedId === ingredient.id ? "bg-[#edf3e8]" : "hover:bg-[#f4f6ef]"} ${selectedIngredient ? "sm:grid-cols-[minmax(0,1fr)_6rem_8.25rem_1rem] xl:grid-cols-[minmax(0,1fr)_5.5rem_1rem]" : "sm:grid-cols-[minmax(0,1fr)_6rem_8.25rem_1rem]"}`}>
                    <span className="min-w-0">
                      <span className="block truncate text-[0.82rem] font-extrabold leading-5" title={ingredient.name}>{ingredient.name}</span>
                      <span className="block truncate text-[0.68rem] leading-4 text-[#82786e]">{[ingredient.supplier || "Leverancier aanvullen", ingredient.supplierArticleNumber, `${count} recept${count === 1 ? "" : "en"}`].filter(Boolean).join(" · ")}</span>
                      <span className={`block sm:hidden ${selectedIngredient ? "xl:block" : ""}`}><SpecificationBadge ingredient={ingredient} /></span>
                    </span>
                    <span className="text-right text-xs font-extrabold tabular-nums leading-4">
                      {ingredientPackagePrice(ingredient) > 0 ? formatEuro(ingredientPackagePrice(ingredient)) : "Nog invullen"}
                      <span className="block text-[0.68rem] font-normal text-[#82786e]">{packagePriceLabel(ingredient.recipeUnit).replace("Prijs ", "")}</span>
                    </span>
                    <span className={`hidden sm:block ${selectedIngredient ? "xl:hidden" : ""}`}><SpecificationBadge ingredient={ingredient} /></span>
                    <span aria-hidden="true" className="text-right text-lg text-[#9d9489]">›</span>
                  </button>
                );
              })}
            </div>
          ) : <EmptyState text="Geen grondstoffen gevonden met deze filters." />}
          <p aria-live="polite" className="px-2 pt-2 text-[0.68rem] text-[#82786e]">{filteredIngredients.length} van {ingredients.length} grondstoffen</p>
        </div>
        {selectedIngredient && (
          <div ref={detailRef} className="order-first scroll-mt-24 xl:order-none xl:sticky xl:top-4">
            <IngredientOverviewPanel key={selectedIngredient.id} ingredient={selectedIngredient} recipes={recipesUsingIngredient(recipes, selectedIngredient.id)} onClose={() => setSelectedId(null)} onEdit={() => onEditIngredient(selectedIngredient)} onSave={onUpdateSpecification} />
          </div>
        )}
      </div>
      {!selectedIngredient && <div className="mt-4"><SpecsPlazaConnectionPanel compact /></div>}
    </Panel>
  );
}

function IngredientOverviewPanel({ ingredient, recipes, onClose, onEdit, onSave }: Readonly<{
  ingredient: Ingredient;
  recipes: Recipe[];
  onClose: () => void;
  onEdit: () => void;
  onSave: IngredientSpecificationSaver;
}>) {
  const [tab, setTab] = useState<DetailTab>("overview");
  const tabId = useId();
  const tabs = [["overview", "Overzicht"], ["specification", "SpecsPlaza"], ["recipes", "Recepten"]] as const;
  return (
    <section className={`${styles.panel} rounded-xl border border-[#e5e1d8] bg-white p-3`} aria-label={`Gegevens van ${ingredient.name}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="mt-0.5 break-words text-lg font-black leading-tight">{ingredient.name}</h3>
          <p className="mt-1 break-words text-xs text-[#82786e]">{[ingredient.supplier, ingredient.supplierArticleNumber].filter(Boolean).join(" · ") || "Leveranciersgegevens aanvullen"}</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Grondstof sluiten" className="flex min-h-9 min-w-9 shrink-0 items-center justify-center rounded-lg text-xl text-[#82786e] hover:bg-[#f5f2ee]">×</button>
      </div>
      <div role="tablist" aria-label="Grondstofgegevens" className="mt-3 flex flex-wrap gap-3 border-b border-[#e5e1d8]">
        {tabs.map(([value, label]) => <button key={value} type="button" role="tab" id={`${tabId}-${value}`} aria-selected={tab === value} aria-controls={`${tabId}-panel`} onClick={() => setTab(value)} className={`min-h-9 border-b-2 pb-2 text-xs font-extrabold ${tab === value ? "border-[#315e42] text-[#315e42]" : "border-transparent text-[#82786e]"}`}>{label}</button>)}
      </div>
      <div role="tabpanel" id={`${tabId}-panel`} aria-labelledby={`${tabId}-${tab}`} className="pt-3">
        {tab === "overview" && <div className="grid gap-3">
          <dl className="grid grid-cols-2 gap-3 text-xs">
            <DetailValue label="Inkoop bij" value={ingredient.supplier || "Nog invullen"} />
            <DetailValue label="Artikelnummer" value={ingredient.supplierArticleNumber || "Nog invullen"} />
            <DetailValue label="Inkoopprijs" value={`${formatEuro(ingredientPackagePrice(ingredient))} ${packagePriceLabel(ingredient.recipeUnit).replace("Prijs ", "")}`} />
            <DetailValue label="Verpakking" value={ingredient.packageSize || "Nog invullen"} />
            <DetailValue label="Bijgewerkt" value={formatDate(ingredient.lastUpdated)} />
            <div><dt className="text-[0.68rem] text-[#82786e]">Prijswijziging</dt><dd className={`mt-1 inline-block rounded-md px-1.5 py-0.5 font-bold ${changeBadgeClass(ingredientPriceChange(ingredient))}`}>{formatSignedPercent(ingredientPriceChange(ingredient), 1)}</dd></div>
          </dl>
          <div className="border-t border-[#e5e1d8] pt-3">
            <p className="mb-1 text-[0.68rem] text-[#82786e]">Productspecificatie</p>
            <SpecificationBadge ingredient={ingredient} />
            <button type="button" onClick={() => setTab("specification")} className="ml-3 min-h-8 text-xs font-bold text-[#315e42] underline underline-offset-2">{ingredient.specification?.specsPlazaLink ? "Koppeling bekijken" : "Koppelen aan SpecsPlaza"}</button>
            <p className="mt-2 text-xs text-[#75685f]">{ingredient.allergens.length ? `Allergenen: ${ingredient.allergens.join(", ")}` : ingredient.specification?.allergensConfirmed ? "Geen allergenen volgens gecontroleerde specificatie." : "Allergeengegevens nog niet gecontroleerd."}</p>
          </div>
          <p className="break-words text-[0.68rem] text-[#82786e]">Laatste factuur: {ingredient.lastInvoice || "Nog geen factuur gekoppeld"}</p>
          {!!ingredient.aliases.length && <p className="break-words text-[0.68rem] text-[#82786e]">Ook bekend als: {ingredient.aliases.join(", ")}</p>}
          <button type="button" onClick={onEdit} className="min-h-9 w-fit rounded-lg border border-[#e4ded5] px-3 py-1.5 text-xs font-bold">Grondstof bewerken</button>
        </div>}
        {tab === "specification" && <div className="grid gap-3">
          <IngredientSpecificationEditor ingredient={ingredient} onSave={onSave} embedded />
        </div>}
        {tab === "recipes" && <div>
          <p className="mb-1 text-xs font-bold">Gebruikt in {recipes.length} recept{recipes.length === 1 ? "" : "en"}</p>
          {recipes.length ? <ul className="divide-y divide-[#e5e1d8]">{recipes.map((recipe) => <li key={recipe.id} className="grid gap-0.5 py-2 text-xs">
            <span className="font-extrabold">{recipe.name}</span>
            <span className="text-[#82786e]">{recipe.type === "semiFinished" ? "Halffabricaat" : "Eindproduct"} · {recipe.ingredients.filter((line) => line.ingredientId === ingredient.id).map((line) => quantityLabel(line.quantity, line.unit)).join(" + ")}</span>
          </li>)}</ul> : <p className="py-2 text-xs text-[#82786e]">Deze grondstof is nog niet in een recept gebruikt.</p>}
        </div>}
      </div>
    </section>
  );
}

function DetailValue({ label, value }: Readonly<{ label: string; value: string }>) {
  return <div className="min-w-0"><dt className="text-[0.68rem] text-[#82786e]">{label}</dt><dd className="mt-1 break-words font-bold">{value}</dd></div>;
}
