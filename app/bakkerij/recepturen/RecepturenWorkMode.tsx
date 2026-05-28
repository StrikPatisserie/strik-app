import { useEffect, useMemo, useState } from "react";
import type { Ingredient, Recipe, RecipeUnit } from "./types";
import ProductionPlanningPanel from "./ProductionPlanningPanel";
import {
  findIngredient,
  findRecipe,
  formatBatchWeight,
  formatDate,
  normalizeSearch,
  scaledRecipeBatchWeightKg,
  todayIsoDate,
} from "./utils";
import {
  defaultWorkCategoryOptions,
  workCategoriesForRecipe,
  workCategoryLabel,
} from "./workCategories";

type WorkFilterId = string;
type WorkModeView = "recipes" | "planning";

type BatchInfo = {
  quantity: number;
  unit: RecipeUnit;
};

type ProductionTask = {
  id: string;
  label: string;
  group: "ingredients" | "semi" | "steps" | "finishing";
  linkedRecipe?: Recipe;
};

const WORK_FILTERS: Array<{ id: WorkFilterId; label: string }> = [
  { id: "all", label: "Alles" },
  ...defaultWorkCategoryOptions,
  { id: "halffabricaten", label: "Halffabricaten" },
];

const QUICK_MULTIPLIERS = [0.5, 1, 2, 3];

function parseDutchNumber(value: string) {
  const number = Number.parseFloat(value.replace(",", ".").replace(/[^\d.]/g, ""));

  return Number.isFinite(number) ? number : 0;
}

function unitFromText(value: string): RecipeUnit {
  const normalized = normalizeSearch(value);

  if (/\b(kg|kilo|kilogram)\b/.test(normalized)) return "kg";
  if (/\b(g|gr|gram)\b/.test(normalized)) return "gram";
  if (/\b(l|liter|ltr)\b/.test(normalized)) return "liter";
  if (/\b(ml|milliliter)\b/.test(normalized)) return "ml";

  return "stuk";
}

function getStandardBatch(recipe: Recipe): BatchInfo {
  if (recipe.standardBatchQuantity && recipe.standardBatchUnit) {
    return {
      quantity: recipe.standardBatchQuantity,
      unit: recipe.standardBatchUnit,
    };
  }

  const match = recipe.batchSize.match(/(\d+(?:[.,]\d+)?)\s*([A-Za-z]+)/);

  if (!match) {
    return { quantity: 1, unit: recipe.type === "semiFinished" ? "kg" : "stuk" };
  }

  return {
    quantity: parseDutchNumber(match[1]) || 1,
    unit: unitFromText(match[2]),
  };
}

function formatAmount(value: number, unit: RecipeUnit) {
  const rounded =
    unit === "gram" || unit === "ml" || unit === "stuk"
      ? Math.round(value)
      : Math.round(value * 100) / 100;

  const label = rounded.toLocaleString("nl-NL", {
    maximumFractionDigits: unit === "kg" || unit === "liter" ? 2 : 0,
  });

  if (unit === "gram") return `${label} g`;
  if (unit === "liter") return `${label} l`;
  if (unit === "stuk") return `${label} stuks`;

  return `${label} ${unit}`;
}

function formatBatch(batch: BatchInfo) {
  if (batch.unit === "stuk") {
    return `${Math.round(batch.quantity).toLocaleString("nl-NL")} stuks`;
  }

  return formatAmount(batch.quantity, batch.unit);
}

function scaleQuantity(quantity: number, multiplier: number) {
  return Math.max(0, quantity * multiplier);
}

function getBatchStep(batch: BatchInfo) {
  if (batch.unit === "stuk") return 1;
  if (batch.unit === "gram" || batch.unit === "ml") return 100;

  return 0.5;
}

function recipeMatchesFilter(recipe: Recipe, filter: WorkFilterId) {
  if (filter === "all") return true;
  if (filter === "halffabricaten") return recipe.type === "semiFinished";

  return recipe.type === "finalProduct" && workCategoriesForRecipe(recipe).includes(filter);
}

function getRecipeTypeLabel(recipe: Recipe) {
  return recipe.type === "semiFinished" ? "halffabricaat" : "eindproduct";
}

function getWorkSteps(recipe: Recipe) {
  const steps = recipe.workInstructions?.length
    ? recipe.workInstructions
    : recipe.preparationSteps;

  return steps.filter((step) => step.trim());
}

function getFinishingSteps(recipe: Recipe) {
  if (recipe.type === "semiFinished") return [];

  if (recipe.finishingSteps?.length) {
    return recipe.finishingSteps.filter((step) => step.trim());
  }

  return [
    "Controleer uitstraling, structuur en batchlabel.",
    "Zet product in koeling, vriezer of klaarzetruimte volgens planning.",
  ];
}

function getWorkNotes(recipe: Recipe) {
  const rawNote = recipe.internalNotes || recipe.notes || "";
  const safeLines = rawNote
    .split(/[.\n]/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/\b(prijs|prijsadvies|kostprijs|marge|eur|euro)\b/i.test(line));

  return safeLines.join(". ");
}

function getScaledIngredients(
  recipe: Recipe,
  ingredients: Ingredient[],
  multiplier: number
) {
  return recipe.ingredients.map((item) => {
    const ingredient = findIngredient(ingredients, item.ingredientId);

    return {
      id: item.ingredientId,
      name: ingredient?.name || item.ingredientId,
      quantity: scaleQuantity(item.quantity, multiplier),
      unit: item.unit,
    };
  });
}

function getScaledSemiFinished(
  recipe: Recipe,
  recipes: Recipe[],
  multiplier: number
) {
  return recipe.semiFinishedItems.map((item) => {
    const linkedRecipe = findRecipe(recipes, item.semiFinishedRecipeId);

    return {
      id: item.semiFinishedRecipeId,
      name: linkedRecipe?.name || item.semiFinishedRecipeId,
      quantity: scaleQuantity(item.quantity, multiplier),
      unit: item.unit,
      recipe: linkedRecipe,
    };
  });
}

function createPrintHtml(
  recipe: Recipe,
  batch: BatchInfo,
  batchWeightKg: number,
  ingredients: ReturnType<typeof getScaledIngredients>,
  semiFinished: ReturnType<typeof getScaledSemiFinished>,
  steps: string[],
  finishingSteps: string[]
) {
  const ingredientRows = ingredients
    .map(
      (item) =>
        `<tr><td>${escapeHtml(formatAmount(item.quantity, item.unit))}</td><td>${escapeHtml(item.name)}</td></tr>`
    )
    .join("");
  const semiRows = semiFinished
    .map(
      (item) =>
        `<tr><td>${escapeHtml(formatAmount(item.quantity, item.unit))}</td><td>${escapeHtml(item.name)}</td></tr>`
    )
    .join("");
  const stepRows = steps.map((step) => `<li>${escapeHtml(step)}</li>`).join("");
  const finishingRows = finishingSteps
    .map((step) => `<li>${escapeHtml(step)}</li>`)
    .join("");
  const photoBlock = recipe.type === "finalProduct" && recipe.photoPreviewDataUrl
    ? `<div class="photo"><img src="${escapeHtml(
        recipe.photoPreviewDataUrl
      )}" alt="${escapeHtml(recipe.name)} voorbeeld" /></div>`
    : "";

  return `<!doctype html>
<html lang="nl">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(recipe.name)} productiekaart</title>
  <style>
    body { color: #2d2a26; font-family: Arial, sans-serif; margin: 28px; }
    h1 { font-size: 28px; margin: 0 0 8px; }
    h2 { font-size: 17px; margin: 24px 0 8px; }
    p { margin: 4px 0; }
    table { border-collapse: collapse; width: 100%; }
    td, th { border-bottom: 1px solid #ded6ca; font-size: 14px; padding: 9px; text-align: left; }
    th { background: #f4f0ea; }
    li { margin: 8px 0; }
    .photo { border: 1px solid #ded6ca; border-radius: 14px; margin: 18px 0; overflow: hidden; width: 260px; }
    .photo img { display: block; width: 100%; }
  </style>
</head>
<body>
  <h1>${escapeHtml(recipe.name)}</h1>
  <p>${escapeHtml(recipe.productGroup)} - ${escapeHtml(getRecipeTypeLabel(recipe))}</p>
  <p><strong>Batch:</strong> ${escapeHtml(formatBatch(batch))}</p>
  <p><strong>Batchgewicht:</strong> ${escapeHtml(formatBatchWeight(batchWeightKg))}</p>
  ${photoBlock}
  <h2>Ingredienten</h2>
  <table><tbody>${ingredientRows || "<tr><td>Geen directe ingredienten.</td></tr>"}</tbody></table>
  <h2>Benodigde halffabricaten</h2>
  <table><tbody>${semiRows || "<tr><td>Geen halffabricaten.</td></tr>"}</tbody></table>
  <h2>Bereidingswijze</h2>
  <ol>${stepRows}</ol>
  ${
    finishingRows
      ? `<h2>Afwerking</h2><ol>${finishingRows}</ol>`
      : ""
  }
</body>
</html>`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export default function RecepturenWorkMode({
  recipes,
  ingredients,
  initialView = "recipes",
  lockedView,
  startRecipeId,
  startQuantity,
  startToken,
  onOpenRecipeCard,
  onMarkProduced,
  onAdjustStock,
  onUpdateProductionLog,
  onDeleteProductionLog,
}: Readonly<{
  recipes: Recipe[];
  ingredients: Ingredient[];
  initialView?: WorkModeView;
  lockedView?: WorkModeView;
  startRecipeId?: string;
  startQuantity?: number;
  startToken?: number;
  onOpenRecipeCard?: (recipe: Recipe) => void;
  onMarkProduced: (
    recipe: Recipe,
    quantity: number,
    requestId?: string,
    date?: string
  ) => void;
  onAdjustStock: (recipe: Recipe, quantity: number, date: string) => void;
  onUpdateProductionLog: (
    recipe: Recipe,
    entryId: string,
    changes: { date?: string; quantity?: number; note?: string }
  ) => void;
  onDeleteProductionLog: (recipe: Recipe, entryId: string) => void;
}>) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<WorkFilterId>("all");
  const [activeView, setActiveView] = useState<WorkModeView>(initialView);
  const visibleView = lockedView || activeView;
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [startInProduction, setStartInProduction] = useState(false);
  const [selectedStartQuantity, setSelectedStartQuantity] =
    useState<number | undefined>(undefined);
  const [productionFeedback, setProductionFeedback] = useState("");
  const workFilters = useMemo(() => {
    const customCategories = recipes
      .flatMap((recipe) =>
        recipe.type === "finalProduct" ? workCategoriesForRecipe(recipe) : []
      )
      .filter(
        (category) =>
          !WORK_FILTERS.some((filterOption) => filterOption.id === category)
      );

    return [
      ...WORK_FILTERS,
      ...Array.from(new Set(customCategories)).map((category) => ({
        id: category,
        label: workCategoryLabel(category),
      })),
    ];
  }, [recipes]);
  const visibleRecipes = useMemo(() => {
    const query = normalizeSearch(search);

    return recipes.filter((recipe) => {
      if (recipe.isWorkModeVisible === false) return false;

      const matchesSearch =
        !query ||
        normalizeSearch(recipe.name).includes(query) ||
        normalizeSearch(recipe.productGroup).includes(query);

      return matchesSearch && recipeMatchesFilter(recipe, filter);
    });
  }, [filter, recipes, search]);

  function markProduced(
    recipe: Recipe,
    quantity: number,
    requestId?: string,
    date?: string
  ) {
    onMarkProduced(recipe, quantity, requestId, date);
    setProductionFeedback(`${recipe.name} staat als gemaakt geregistreerd.`);
    window.setTimeout(() => setProductionFeedback(""), 2600);
  }

  useEffect(() => {
    if (!startRecipeId) return;

    const recipe = findRecipe(recipes, startRecipeId);
    if (!recipe) return;

    setActiveView("planning");
    setSelectedRecipe(recipe);
    setSelectedStartQuantity(startQuantity);
    setStartInProduction(true);
  }, [recipes, startQuantity, startRecipeId, startToken]);

  return (
    <section className="grid gap-4">
      {productionFeedback && (
        <p className="rounded-[1rem] border border-[#c7ddbf] bg-[#f4faf0] p-3 text-sm font-black text-[#45663b]">
          {productionFeedback}
        </p>
      )}

      {!lockedView && (
      <div className="rounded-[1.15rem] border border-[#d8d8d4] bg-white p-2 shadow-sm">
        <div className="grid gap-2 sm:grid-cols-2">
          {[
            { id: "recipes" as const, label: "Recept maken", hint: "Zoeken en starten" },
            { id: "planning" as const, label: "Productieplanning", hint: "Voorraad en bijmaken" },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveView(item.id)}
              className={`rounded-[1rem] px-4 py-3 text-left transition active:scale-[0.99] ${
                activeView === item.id
                  ? "bg-[#c3d3bc] text-[#2d2a26] shadow-sm"
                  : "bg-[#f8f6f3] text-[#2d2a26]/58"
              }`}
            >
              <span className="block text-base font-black">{item.label}</span>
              <span className="mt-0.5 block text-xs font-bold">{item.hint}</span>
            </button>
          ))}
        </div>
      </div>
      )}

      {visibleView === "planning" && (
        <ProductionPlanningPanel
          recipes={recipes}
          onOpenRecipe={(recipe) => {
            if (onOpenRecipeCard) {
              onOpenRecipeCard(recipe);
              return;
            }
            setStartInProduction(false);
            setSelectedStartQuantity(undefined);
            setSelectedRecipe(recipe);
          }}
          onMarkProduced={markProduced}
          onAdjustStock={onAdjustStock}
          onUpdateProductionLog={onUpdateProductionLog}
          onDeleteProductionLog={onDeleteProductionLog}
        />
      )}

      {visibleView === "recipes" && (
      <>
      <div className="rounded-[1.1rem] border border-[#e2dbcf] bg-white/88 p-3 shadow-sm sm:p-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-[0.68rem] font-black uppercase tracking-[0.14em] text-[#45663b]">
              Werkvloer
            </p>
            <h2 className="mt-0.5 text-2xl font-black leading-tight sm:text-3xl">
              Recepten werkmodus
            </h2>
          </div>
          <p className="max-w-md text-xs font-bold leading-snug text-[#2d2a26]/50 sm:text-right">
            Zoek, schaal en volg.
          </p>
        </div>
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Zoek recept..."
          className="mt-3 w-full rounded-[1rem] border border-[#d8d0c4] bg-[#fffdf8] px-4 py-3 text-base font-black text-[#2d2a26] shadow-sm outline-none placeholder:text-[#2d2a26]/35 focus:ring-2 focus:ring-[#8fb184]"
        />
        <div className="mt-3 flex flex-wrap gap-1.5">
          {workFilters.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setFilter(item.id)}
              className={`rounded-full px-3 py-2 text-xs font-black shadow-sm transition active:scale-[0.98] ${
                filter === item.id
                  ? "bg-[#c3d3bc] text-[#2d2a26]"
                  : "bg-[#f8f6f3] text-[#2d2a26]/60"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {visibleRecipes.length ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {visibleRecipes.map((recipe) => (
            <RecipeWorkCard
              key={recipe.id}
              recipe={recipe}
              onOpen={() => {
                setStartInProduction(false);
                setSelectedStartQuantity(undefined);
                setSelectedRecipe(recipe);
              }}
              onStart={() => {
                setStartInProduction(true);
                setSelectedStartQuantity(undefined);
                setSelectedRecipe(recipe);
              }}
            />
          ))}
        </div>
      ) : (
        <p className="rounded-[1.2rem] bg-white/85 p-5 text-sm font-bold text-[#2d2a26]/55">
          Geen recepten gevonden voor deze zoekopdracht.
        </p>
      )}
      </>
      )}

      {selectedRecipe && (
        <WorkRecipeDetail
          key={`${selectedRecipe.id}-${startInProduction ? "production" : "detail"}-${
            selectedStartQuantity || ""
          }-${startToken || ""}`}
          recipe={selectedRecipe}
          recipes={recipes}
          ingredients={ingredients}
          startInProduction={startInProduction}
          initialQuantity={selectedStartQuantity}
          onSelectRecipe={setSelectedRecipe}
          onMarkProduced={markProduced}
          onClose={() => setSelectedRecipe(null)}
        />
      )}
    </section>
  );
}

function RecipeWorkCard({
  recipe,
  onOpen,
  onStart,
}: Readonly<{ recipe: Recipe; onOpen: () => void; onStart: () => void }>) {
  const batch = getStandardBatch(recipe);
  const categories = recipe.type === "finalProduct"
    ? workCategoriesForRecipe(recipe).slice(0, 3)
    : ["halffabricaten"];
  const showThumb = recipe.type === "finalProduct";

  return (
    <article className="grid gap-3 rounded-[1.05rem] border border-[#e2dbcf] bg-white/92 p-3 shadow-sm">
      <div className={`grid gap-3 ${showThumb ? "grid-cols-[4.25rem_minmax(0,1fr)]" : ""}`}>
        {showThumb && <RecipeWorkThumb recipe={recipe} />}
        <div className="min-w-0">
          <p className="text-[0.62rem] font-black uppercase tracking-[0.12em] text-[#2d2a26]/42">
            {recipe.productGroup}
          </p>
          <h3 className="mt-0.5 truncate text-base font-black leading-tight">
            {recipe.name}
          </h3>
          <p className="mt-1 text-xs font-bold leading-snug text-[#2d2a26]/55">
            {getRecipeTypeLabel(recipe)} - {formatBatch(batch)}
          </p>
          <p className="mt-0.5 text-[0.68rem] font-bold text-[#2d2a26]/42">
            Gewijzigd {formatDate(recipe.lastUpdated)}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {categories.map((category) => (
          <span
            key={category}
            className="rounded-full bg-[#dce8d6] px-2 py-0.5 text-[0.66rem] font-black text-[#45663b]"
          >
            {category === "halffabricaten"
              ? "Halffabricaat"
              : workCategoryLabel(category)}
          </span>
        ))}
        {recipe.allergens.length ? (
          recipe.allergens.slice(0, 4).map((allergen) => (
            <span
              key={allergen}
              className="rounded-full bg-[#f8f6f3] px-2 py-0.5 text-[0.66rem] font-black text-[#2d2a26]/58"
            >
              {allergen}
            </span>
          ))
        ) : (
          <span className="rounded-full bg-[#f8f6f3] px-2 py-0.5 text-[0.66rem] font-black text-[#2d2a26]/45">
            Geen allergenen
          </span>
        )}
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={onOpen}
          className="rounded-full bg-white px-3 py-2.5 text-xs font-black shadow-sm"
        >
          Open recept
        </button>
        <button
          type="button"
          onClick={onStart}
          className="rounded-full bg-[#c3d3bc] px-3 py-2.5 text-xs font-black shadow-sm"
        >
          Start werkmodus
        </button>
      </div>
    </article>
  );
}

function RecipeWorkThumb({ recipe }: Readonly<{ recipe: Recipe }>) {
  const hasPhoto =
    recipe.type === "finalProduct" && Boolean(recipe.photoPreviewDataUrl);

  return (
    <div
      className="flex aspect-square items-center justify-center overflow-hidden rounded-2xl border border-[#e2dbcf] bg-[#eadfcf] bg-cover bg-center text-center shadow-sm"
      style={
        hasPhoto
          ? {
              backgroundImage: `url("${recipe.photoPreviewDataUrl}")`,
            }
          : undefined
      }
      aria-label={hasPhoto ? `Foto van ${recipe.name}` : "Geen receptfoto"}
    >
      {!hasPhoto && (
        <span className="text-lg font-black text-[#2d2a26]/42">
          {recipe.name.slice(0, 1).toUpperCase()}
        </span>
      )}
    </div>
  );
}

function WorkRecipeDetail({
  recipe,
  recipes,
  ingredients,
  startInProduction,
  initialQuantity,
  onSelectRecipe,
  onMarkProduced,
  onClose,
}: Readonly<{
  recipe: Recipe;
  recipes: Recipe[];
  ingredients: Ingredient[];
  startInProduction: boolean;
  initialQuantity?: number;
  onSelectRecipe: (recipe: Recipe) => void;
  onMarkProduced: (
    recipe: Recipe,
    quantity: number,
    requestId?: string,
    date?: string
  ) => void;
  onClose: () => void;
}>) {
  const standardBatch = getStandardBatch(recipe);
  const [batchQuantity, setBatchQuantity] = useState(
    initialQuantity || standardBatch.quantity
  );
  const [isProducing, setIsProducing] = useState(startInProduction);
  const baseScaleRows = useMemo(
    () => [
      ...getScaledIngredients(recipe, ingredients, 1),
      ...getScaledSemiFinished(recipe, recipes, 1),
    ],
    [ingredients, recipe, recipes]
  );
  const [scaleIngredientId, setScaleIngredientId] = useState(
    () => baseScaleRows[0]?.id || ""
  );
  const [scaleIngredientAmount, setScaleIngredientAmount] = useState("");
  const [isRegisteringProduction, setIsRegisteringProduction] = useState(false);
  const activeBatch = { ...standardBatch, quantity: batchQuantity };
  const multiplier = standardBatch.quantity
    ? batchQuantity / standardBatch.quantity
    : 1;
  const batchWeightKg = scaledRecipeBatchWeightKg(recipe, multiplier);
  const scaledIngredients = getScaledIngredients(recipe, ingredients, multiplier);
  const scaledSemiFinished = getScaledSemiFinished(recipe, recipes, multiplier);
  const workSteps = getWorkSteps(recipe);
  const finishingSteps = getFinishingSteps(recipe);
  const workNotes = getWorkNotes(recipe);

  function setMultiplier(multiplierValue: number) {
    setBatchQuantity(Math.max(0, standardBatch.quantity * multiplierValue));
  }

  function adjustBatch(direction: 1 | -1) {
    const step = getBatchStep(standardBatch);

    setBatchQuantity((current) => Math.max(step, current + step * direction));
  }

  function scaleFromIngredient(rowId: string, value: string) {
    setScaleIngredientAmount(value);

    const selectedRow =
      baseScaleRows.find((row) => row.id === rowId) || baseScaleRows[0];
    const desiredQuantity = parseDutchNumber(value);

    if (!selectedRow || selectedRow.quantity <= 0 || desiredQuantity <= 0) {
      return;
    }

    setBatchQuantity(
      Math.max(
        getBatchStep(standardBatch),
        Math.round(
          ((standardBatch.quantity * desiredQuantity) / selectedRow.quantity) * 1000
        ) / 1000
      )
    );
  }

  function printProductionCard() {
    const printWindow = window.open("", "_blank", "width=980,height=760");

    if (!printWindow) return;

    printWindow.document.write(
      createPrintHtml(
        recipe,
        activeBatch,
        batchWeightKg,
        scaledIngredients,
        scaledSemiFinished,
        workSteps,
        finishingSteps
      )
    );
    printWindow.document.close();
    printWindow.focus();
    window.setTimeout(() => printWindow.print(), 150);
  }

  return (
    <div className="fixed inset-0 z-[70] overflow-y-auto bg-[#2d2a26]/35 px-3 py-5 backdrop-blur-sm">
      <div className="mx-auto max-w-6xl rounded-[1.5rem] border border-[#ded6ca] bg-[#f4f0ea] p-4 shadow-2xl">
        <div className="rounded-[1.25rem] bg-white/92 p-5">
          <div
            className={`grid gap-4 ${
              recipe.type === "finalProduct"
                ? "lg:grid-cols-[minmax(0,1fr)_18rem]"
                : ""
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-[#45663b]">
                  Recept werkmodus
                </p>
                <h2 className="mt-1 text-3xl font-black leading-tight">
                  {recipe.name}
                </h2>
                <p className="mt-2 text-sm font-bold text-[#2d2a26]/55">
                  {recipe.productGroup} - {getRecipeTypeLabel(recipe)} - standaard{" "}
                  {formatBatch(standardBatch)}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full bg-[#f8f6f3] px-4 py-3 text-sm font-black shadow-sm"
              >
                Sluit
              </button>
            </div>
            {recipe.type === "finalProduct" && (
              <RecipeWorkPhoto recipe={recipe} label="Zo moet het eruit zien" />
            )}
          </div>

          <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-[#2d2a26]/42">
                Batch schalen
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => adjustBatch(-1)}
                  className="h-12 w-12 rounded-full bg-white text-2xl font-black shadow-sm"
                >
                  -
                </button>
                <input
                  value={String(batchQuantity).replace(".", ",")}
                  onChange={(event) =>
                    setBatchQuantity(Math.max(0, parseDutchNumber(event.target.value)))
                  }
                  inputMode="decimal"
                  className="h-12 w-32 rounded-2xl border border-[#d8d0c4] bg-white px-4 text-center text-lg font-black outline-none focus:ring-2 focus:ring-[#8fb184]"
                />
                <span className="text-sm font-black text-[#2d2a26]/60">
                  {standardBatch.unit === "stuk" ? "stuks" : standardBatch.unit}
                </span>
                <button
                  type="button"
                  onClick={() => adjustBatch(1)}
                  className="h-12 w-12 rounded-full bg-white text-2xl font-black shadow-sm"
                >
                  +
                </button>
                {QUICK_MULTIPLIERS.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setMultiplier(item)}
                    className="rounded-full bg-[#f8f6f3] px-4 py-3 text-sm font-black shadow-sm"
                  >
                    {String(item).replace(".", ",")}x
                  </button>
                ))}
              </div>
              <p className="mt-2 text-sm font-bold text-[#45663b]">
                Hoeveelheden zijn geschaald naar {formatBatch(activeBatch)}.
              </p>
              <p className="mt-1 text-sm font-black text-[#2d2a26]/58">
                Batchgewicht: {formatBatchWeight(batchWeightKg)}
              </p>
              {recipe.type === "semiFinished" && baseScaleRows.length > 0 && (
                <div className="mt-3 grid gap-2 border border-[#c3d3bc] bg-white p-3 sm:grid-cols-[minmax(0,1fr)_9rem_auto] sm:items-end">
                  <label className="grid gap-1 text-[0.65rem] font-black uppercase tracking-[0.12em] text-[#2d2a26]/45">
                    Stuur op ingredient
                    <select
                      value={scaleIngredientId || baseScaleRows[0]?.id || ""}
                      onChange={(event) => {
                        setScaleIngredientId(event.target.value);
                        if (scaleIngredientAmount) {
                          scaleFromIngredient(event.target.value, scaleIngredientAmount);
                        }
                      }}
                      className="min-w-0 border border-[#d8d0c4] bg-white px-3 py-2 text-sm font-black normal-case tracking-normal text-[#2d2a26]"
                    >
                      {baseScaleRows.map((row) => (
                        <option key={row.id} value={row.id}>
                          {row.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-1 text-[0.65rem] font-black uppercase tracking-[0.12em] text-[#2d2a26]/45">
                    Hoeveelheid
                    <input
                      value={scaleIngredientAmount}
                      onChange={(event) =>
                        scaleFromIngredient(
                          scaleIngredientId || baseScaleRows[0]?.id || "",
                          event.target.value
                        )
                      }
                      inputMode="decimal"
                      placeholder="4000"
                      className="min-w-0 border border-[#d8d0c4] bg-white px-3 py-2 text-sm font-black normal-case tracking-normal text-[#2d2a26] outline-none"
                    />
                  </label>
                  <span className="pb-2 text-xs font-black text-[#2d2a26]/50">
                    {baseScaleRows.find((row) => row.id === scaleIngredientId)?.unit ||
                      baseScaleRows[0]?.unit}
                  </span>
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setIsRegisteringProduction(true)}
                className="rounded-full bg-[#fff0bd] px-5 py-3 text-sm font-black text-[#7a5a18] shadow-sm"
              >
                Product gemaakt
              </button>
              <button
                type="button"
                onClick={() => setIsProducing(true)}
                className="rounded-full bg-[#c3d3bc] px-5 py-3 text-sm font-black shadow-sm"
              >
                Start productie
              </button>
              <button
                type="button"
                onClick={printProductionCard}
                className="rounded-full bg-white px-5 py-3 text-sm font-black shadow-sm"
              >
                Print productiekaart
              </button>
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <WorkPanel title="Ingredienten">
            <div className="grid gap-2">
              {scaledIngredients.length ? (
                scaledIngredients.map((item) => (
                  <WorkQuantityLine
                    key={`${item.id}-${item.quantity}`}
                    quantity={formatAmount(item.quantity, item.unit)}
                    name={item.name}
                  />
                ))
              ) : (
                <p className="rounded-2xl bg-[#f8f6f3] p-3 text-sm font-bold text-[#2d2a26]/50">
                  Geen directe ingredienten.
                </p>
              )}
            </div>
          </WorkPanel>

          <WorkPanel title="Eerst benodigde halffabricaten">
            <div className="grid gap-2">
              {scaledSemiFinished.length ? (
                scaledSemiFinished.map((item) => {
                  const linkedRecipe = item.recipe;

                  return (
                    <div
                      key={`${item.id}-${item.quantity}`}
                      className="grid gap-3 rounded-2xl bg-[#fffdf8] p-3 text-sm font-bold shadow-sm sm:grid-cols-[7rem_minmax(0,1fr)_auto] sm:items-center"
                    >
                      <span>{formatAmount(item.quantity, item.unit)}</span>
                      <span className="font-black">{item.name}</span>
                      {linkedRecipe ? (
                        <button
                          type="button"
                          onClick={() => onSelectRecipe(linkedRecipe)}
                          className="rounded-full bg-[#c3d3bc] px-3 py-2 text-xs font-black shadow-sm"
                        >
                          Open recept
                        </button>
                      ) : (
                        <span className="rounded-full bg-[#f8f6f3] px-3 py-2 text-xs font-black text-[#2d2a26]/45">
                          Niet gevonden
                        </span>
                      )}
                    </div>
                  );
                })
              ) : (
                <p className="rounded-2xl bg-[#f8f6f3] p-3 text-sm font-bold text-[#2d2a26]/50">
                  Geen halffabricaten nodig.
                </p>
              )}
            </div>
          </WorkPanel>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)]">
          <WorkPanel title="Bereidingswijze">
            <ol className="grid gap-2">
              {workSteps.map((step, index) => (
                <li key={`${step}-${index}`} className="flex gap-3 rounded-2xl bg-[#fffdf8] p-4">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#c3d3bc] text-sm font-black">
                    {index + 1}
                  </span>
                  <span className="text-base font-semibold leading-relaxed text-[#2d2a26]/72">
                    {step}
                  </span>
                </li>
              ))}
            </ol>
          </WorkPanel>

          <div className="grid gap-4">
            {finishingSteps.length > 0 && (
              <WorkPanel title="Afwerking">
                <div className="grid gap-2">
                  {finishingSteps.map((step, index) => (
                    <WorkChecklistPreview key={`${step}-${index}`} label={step} />
                  ))}
                </div>
              </WorkPanel>
            )}

            <WorkPanel title="Allergenen">
              <div className="flex flex-wrap gap-2">
                {recipe.allergens.length ? (
                  recipe.allergens.map((allergen) => (
                    <span
                      key={allergen}
                      className="rounded-full bg-[#fff0bd] px-3 py-1.5 text-xs font-black text-[#7a5a18]"
                    >
                      {allergen}
                    </span>
                  ))
                ) : (
                  <span className="text-sm font-bold text-[#2d2a26]/50">
                    Geen allergenen geregistreerd.
                  </span>
                )}
              </div>
            </WorkPanel>

            <WorkPanel title="Interne opmerkingen">
              <p className="text-sm font-semibold leading-relaxed text-[#2d2a26]/65">
                {workNotes || "Geen interne productienotities."}
              </p>
            </WorkPanel>
          </div>
        </div>
      </div>

      {isProducing && (
        <ProductionMode
          recipe={recipe}
          batch={activeBatch}
          batchWeightKg={batchWeightKg}
          onMarkProduced={(date) => onMarkProduced(recipe, batchQuantity, undefined, date)}
          ingredients={scaledIngredients}
          semiFinished={scaledSemiFinished}
          steps={workSteps}
          finishingSteps={finishingSteps}
          onOpenRecipe={(linkedRecipe) => {
            setIsProducing(false);
            onSelectRecipe(linkedRecipe);
          }}
          onBack={() => setIsProducing(false)}
        />
      )}
      {isRegisteringProduction && (
        <ProductionRegistrationDialog
          title="Product gemaakt opslaan"
          quantity={batchQuantity}
          unit={standardBatch.unit}
          onCancel={() => setIsRegisteringProduction(false)}
          onConfirm={(date) => {
            onMarkProduced(recipe, batchQuantity, undefined, date);
            setIsRegisteringProduction(false);
          }}
        />
      )}
    </div>
  );
}

function WorkPanel({
  title,
  children,
}: Readonly<{ title: string; children: React.ReactNode }>) {
  return (
    <section className="rounded-[1.25rem] border border-[#e2dbcf] bg-white/90 p-4 shadow-sm">
      <h3 className="text-lg font-black leading-tight">{title}</h3>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function RecipeWorkPhoto({
  recipe,
  label = "Voorbeeld",
  compact = false,
}: Readonly<{ recipe: Recipe; label?: string; compact?: boolean }>) {
  const hasPhoto =
    recipe.type === "finalProduct" && Boolean(recipe.photoPreviewDataUrl);

  return (
    <div
      className={`relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-[1rem] border border-[#e2dbcf] bg-[#eadfcf] bg-cover bg-center text-center shadow-sm ${
        compact ? "min-h-36" : "min-h-44"
      }`}
      style={
        hasPhoto
          ? {
              backgroundImage: `url("${recipe.photoPreviewDataUrl}")`,
            }
          : undefined
      }
    >
      {hasPhoto ? (
        <div className="absolute inset-x-2 bottom-2 rounded-2xl bg-white/88 px-3 py-2 text-left shadow-sm">
          <p className="text-[0.65rem] font-black uppercase tracking-[0.14em] text-[#2d2a26]/45">
            {label}
          </p>
          <p className="truncate text-sm font-black">
            {recipe.photoHint || recipe.name}
          </p>
        </div>
      ) : (
        <div className="px-4">
          <p className="text-[0.65rem] font-black uppercase tracking-[0.14em] text-[#2d2a26]/42">
            Nog geen foto
          </p>
          <p className="mt-2 text-sm font-black text-[#2d2a26]/70">
            {recipe.photoHint || recipe.name}
          </p>
        </div>
      )}
    </div>
  );
}

function WorkQuantityLine({
  quantity,
  name,
}: Readonly<{ quantity: string; name: string }>) {
  return (
    <div className="grid grid-cols-[7rem_minmax(0,1fr)] gap-3 rounded-2xl bg-[#fffdf8] p-3 text-sm font-bold shadow-sm">
      <span>{quantity}</span>
      <span className="font-black">{name}</span>
    </div>
  );
}

function WorkChecklistPreview({ label }: Readonly<{ label: string }>) {
  return (
    <div className="flex gap-3 rounded-2xl bg-[#fffdf8] p-3 text-sm font-semibold text-[#2d2a26]/70">
      <span className="mt-0.5 h-5 w-5 rounded-md border-2 border-[#c3d3bc]" />
      <span>{label}</span>
    </div>
  );
}

function ProductionMode({
  recipe,
  batch,
  batchWeightKg,
  onMarkProduced,
  ingredients,
  semiFinished,
  steps,
  finishingSteps,
  onOpenRecipe,
  onBack,
}: Readonly<{
  recipe: Recipe;
  batch: BatchInfo;
  batchWeightKg: number;
  onMarkProduced: (date: string) => void;
  ingredients: ReturnType<typeof getScaledIngredients>;
  semiFinished: ReturnType<typeof getScaledSemiFinished>;
  steps: string[];
  finishingSteps: string[];
  onOpenRecipe: (recipe: Recipe) => void;
  onBack: () => void;
}>) {
  const [checkedTasks, setCheckedTasks] = useState<Record<string, boolean>>({});
  const [isPaused, setIsPaused] = useState(false);
  const [viewMode, setViewMode] = useState<"checklist" | "focus">("checklist");
  const [focusIndex, setFocusIndex] = useState(0);
  const [isFinishingProduction, setIsFinishingProduction] = useState(false);
  const tasks = useMemo(
    () => createProductionTasks(ingredients, semiFinished, steps, finishingSteps),
    [finishingSteps, ingredients, semiFinished, steps]
  );
  const completed = tasks.filter((task) => checkedTasks[task.id]).length;
  const progress = tasks.length ? Math.round((completed / tasks.length) * 100) : 0;
  const focusTask = tasks[focusIndex] || tasks[0];

  function toggleTask(taskId: string) {
    setCheckedTasks((current) => ({
      ...current,
      [taskId]: !current[taskId],
    }));
  }

  function resetChecklist() {
    setCheckedTasks({});
    setFocusIndex(0);
    setIsPaused(false);
  }

  function completeAll() {
    setCheckedTasks(Object.fromEntries(tasks.map((task) => [task.id, true])));
    setIsFinishingProduction(true);
  }

  return (
    <div className="fixed inset-0 z-[90] overflow-y-auto bg-white px-3 py-4 text-[#111111]">
      <div className="mx-auto grid max-w-6xl gap-4">
        <header className="border border-[#111111] bg-white p-4 shadow-2xl sm:p-5">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-[#8c8c8c]">
                  Productiemodus
                </p>
                <h2 className="mt-1 text-[clamp(1.8rem,4vw,2.7rem)] font-light leading-tight">
                  {recipe.name}
                </h2>
                <p className="mt-2 text-base font-black text-[#555555]">
                  Batchgrootte: {formatBatch(batch)}
                </p>
                <p className="mt-1 text-sm font-black text-[#707070]">
                  Batchgewicht: {formatBatchWeight(batchWeightKg)}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setIsPaused((current) => !current)}
                  className="border border-[#c3d3bc] bg-white px-4 py-2.5 text-sm font-black text-[#707070]"
                >
                  {isPaused ? "Hervat" : "Pauzeer"}
                </button>
                <button
                  type="button"
                  onClick={completeAll}
                  className="border border-[#c3d3bc] bg-[#c3d3bc] px-4 py-2.5 text-sm font-black"
                >
                  Afronden
                </button>
                <button
                  type="button"
                  onClick={resetChecklist}
                  className="border border-[#c3d3bc] bg-white px-4 py-2.5 text-sm font-black"
                >
                  Reset checklist
                </button>
                <button
                  type="button"
                  onClick={onBack}
                  className="border border-[#c3d3bc] bg-white px-4 py-2.5 text-sm font-black"
                >
                  Terug naar recept
                </button>
              </div>
            </div>
            {recipe.type === "finalProduct" && (
              <RecipeWorkPhoto recipe={recipe} label="Eindbeeld" />
            )}
          </div>
          <div className="mt-5">
            <div className="flex items-center justify-between gap-3 text-sm font-black text-[#707070]">
              <span>
                {completed} van {tasks.length} taken voltooid
              </span>
              <span>{progress}%</span>
            </div>
            <div className="mt-2 h-3 overflow-hidden border border-[#c3d3bc] bg-white">
              <div
                className="h-full bg-[#c3d3bc] transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
          <div className="mt-4 flex w-fit border border-[#c3d3bc] bg-white">
            {(["checklist", "focus"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setViewMode(mode)}
                className={`border-r border-[#c3d3bc] px-5 py-2.5 text-sm font-black last:border-r-0 ${
                  viewMode === mode ? "bg-[#c3d3bc]" : "text-[#707070]"
                }`}
              >
                {mode === "checklist" ? "Checklist" : "Focus"}
              </button>
            ))}
          </div>
        </header>

        {isPaused && (
          <p className="border border-[#ead7a6] bg-[#fff8e3] p-4 text-sm font-black text-[#7a5a18]">
            Productie gepauzeerd. Checklist blijft lokaal bewaard zolang deze pagina open is.
          </p>
        )}

        {viewMode === "checklist" ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <ProductionTaskGroup
              title="Ingredienten"
              tasks={tasks.filter((task) => task.group === "ingredients")}
              checkedTasks={checkedTasks}
              onToggle={toggleTask}
              onOpenRecipe={onOpenRecipe}
            />
            <ProductionTaskGroup
              title="Halffabricaten"
              tasks={tasks.filter((task) => task.group === "semi")}
              checkedTasks={checkedTasks}
              onToggle={toggleTask}
              onOpenRecipe={onOpenRecipe}
            />
            <ProductionTaskGroup
              title="Stappen"
              tasks={tasks.filter((task) => task.group === "steps")}
              checkedTasks={checkedTasks}
              onToggle={toggleTask}
              onOpenRecipe={onOpenRecipe}
            />
            {finishingSteps.length > 0 && (
              <ProductionTaskGroup
                title="Afwerking"
                tasks={tasks.filter((task) => task.group === "finishing")}
                checkedTasks={checkedTasks}
                onToggle={toggleTask}
                onOpenRecipe={onOpenRecipe}
              />
            )}
          </div>
        ) : (
          <section className="border border-[#c3d3bc] bg-white p-5 text-center">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[#8c8c8c]">
              Huidige stap
            </p>
            {focusTask ? (
              <>
                <p className="mt-5 text-2xl font-black leading-tight">
                  {focusTask.label}
                </p>
                <button
                  type="button"
                  onClick={() => toggleTask(focusTask.id)}
                  className={`mt-6 border border-[#c3d3bc] px-8 py-3 text-lg font-black ${
                    checkedTasks[focusTask.id]
                      ? "bg-[#dce8d6] text-[#45663b]"
                      : "bg-[#c3d3bc] text-[#111111]"
                  }`}
                >
                  {checkedTasks[focusTask.id] ? "Gedaan" : "Afvinken"}
                </button>
                <div className="mt-6 flex justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => setFocusIndex((current) => Math.max(0, current - 1))}
                    className="border border-[#c3d3bc] bg-white px-4 py-2.5 text-sm font-black"
                  >
                    Vorige stap
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setFocusIndex((current) =>
                        Math.min(tasks.length - 1, current + 1)
                      )
                    }
                    className="border border-[#c3d3bc] bg-[#c3d3bc] px-4 py-2.5 text-sm font-black"
                  >
                    Volgende stap
                  </button>
                </div>
              </>
            ) : (
              <p className="mt-4 text-lg font-bold text-[#2d2a26]/55">
                Geen taken beschikbaar.
              </p>
            )}
          </section>
        )}
        {isFinishingProduction && (
          <ProductionRegistrationDialog
            title="Productie afronden"
            quantity={batch.quantity}
            unit={batch.unit}
            onCancel={() => setIsFinishingProduction(false)}
            onConfirm={(date) => {
              onMarkProduced(date);
              setIsFinishingProduction(false);
              onBack();
            }}
          />
        )}
      </div>
    </div>
  );
}

function ProductionRegistrationDialog({
  title,
  quantity,
  unit,
  onCancel,
  onConfirm,
}: Readonly<{
  title: string;
  quantity: number;
  unit: RecipeUnit;
  onCancel: () => void;
  onConfirm: (date: string) => void;
}>) {
  const [date, setDate] = useState(todayIsoDate());

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-[#111111]/35 px-4">
      <div className="w-full max-w-md border border-[#111111] bg-white p-5 shadow-2xl">
        <p className="text-[0.68rem] font-black uppercase tracking-[0.14em] text-[#8c8c8c]">
          Opslaan
        </p>
        <h3 className="mt-1 text-2xl font-light">{title}</h3>
        <p className="mt-2 text-sm font-bold text-[#707070]">
          Datum controleren voordat de voorraad/prognose wordt bijgewerkt.
        </p>
        <label className="mt-4 block">
          <span className="text-[0.68rem] font-black uppercase tracking-[0.12em] text-[#8c8c8c]">
            Productiedatum
          </span>
          <input
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            className="mt-1 w-full border border-[#c3d3bc] bg-white px-4 py-3 text-base font-black outline-none"
          />
        </label>
        <div className="mt-3 border border-[#c3d3bc] bg-[#f8f6f3] p-3">
          <p className="text-[0.68rem] font-black uppercase tracking-[0.12em] text-[#8c8c8c]">
            Aantal
          </p>
          <p className="mt-1 text-lg font-black">{formatAmount(quantity, unit)}</p>
        </div>
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="border border-[#c3d3bc] bg-white px-4 py-2.5 text-sm font-black text-[#707070]"
          >
            Annuleer
          </button>
          <button
            type="button"
            onClick={() => onConfirm(date || todayIsoDate())}
            className="border border-[#c3d3bc] bg-[#c3d3bc] px-4 py-2.5 text-sm font-black"
          >
            Opslaan
          </button>
        </div>
      </div>
    </div>
  );
}

function createProductionTasks(
  ingredients: ReturnType<typeof getScaledIngredients>,
  semiFinished: ReturnType<typeof getScaledSemiFinished>,
  steps: string[],
  finishingSteps: string[]
): ProductionTask[] {
  return [
    ...ingredients.map((item, index) => ({
      id: `ingredient-${item.id}-${index}`,
      label: `${formatAmount(item.quantity, item.unit)} ${item.name}`,
      group: "ingredients" as const,
    })),
    ...semiFinished.map((item, index) => ({
      id: `semi-${item.id}-${index}`,
      label: `${formatAmount(item.quantity, item.unit)} ${item.name}`,
      group: "semi" as const,
      linkedRecipe: item.recipe,
    })),
    ...steps.map((step, index) => ({
      id: `step-${index}`,
      label: step,
      group: "steps" as const,
    })),
    ...finishingSteps.map((step, index) => ({
      id: `finishing-${index}`,
      label: step,
      group: "finishing" as const,
    })),
  ];
}

function ProductionTaskGroup({
  title,
  tasks,
  checkedTasks,
  onToggle,
  onOpenRecipe,
}: Readonly<{
  title: string;
  tasks: ProductionTask[];
  checkedTasks: Record<string, boolean>;
  onToggle: (taskId: string) => void;
  onOpenRecipe: (recipe: Recipe) => void;
}>) {
  return (
    <section className="border border-[#c3d3bc] bg-white p-4">
      <h3 className="text-lg font-black">{title}</h3>
      <div className="mt-3 grid gap-2">
        {tasks.length ? (
          tasks.map((task) => {
            const linkedRecipe = task.linkedRecipe;

            return (
              <div
                key={task.id}
                className={`grid gap-2 border p-2 text-sm font-black transition sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center ${
                  checkedTasks[task.id]
                    ? "border-[#c3d3bc] bg-[#dce8d6] text-[#45663b]"
                    : "border-[#c3d3bc] bg-white text-[#111111]"
                }`}
              >
                <button
                  type="button"
                  onClick={() => onToggle(task.id)}
                  className="flex min-w-0 gap-3 p-2 text-left"
                >
                  <span
                    className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center border text-[0.62rem] ${
                      checkedTasks[task.id]
                        ? "border-[#45663b] bg-[#45663b] text-white"
                        : "border-[#c3d3bc]"
                    }`}
                  >
                    {checkedTasks[task.id] ? "OK" : ""}
                  </span>
                  <span>{task.label}</span>
                </button>
                {linkedRecipe && (
                  <button
                    type="button"
                    onClick={() => onOpenRecipe(linkedRecipe)}
                    className="border border-[#c3d3bc] bg-white px-3 py-2 text-xs font-black text-[#45663b]"
                  >
                    Open recept
                  </button>
                )}
              </div>
            );
          })
        ) : (
          <p className="border border-[#c3d3bc] bg-[#f8f6f3] p-4 text-sm font-bold text-[#707070]">
            Geen taken in deze categorie.
          </p>
        )}
      </div>
    </section>
  );
}
