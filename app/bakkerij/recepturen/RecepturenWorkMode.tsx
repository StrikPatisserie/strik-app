import { useMemo, useState } from "react";
import type { Ingredient, Recipe, RecipeUnit } from "./types";
import { findIngredient, findRecipe, formatDate, normalizeSearch } from "./utils";

type WorkFilterId =
  | "all"
  | "gebak"
  | "taarten"
  | "sloffen"
  | "koek"
  | "ijs"
  | "bonbons"
  | "halffabricaten";

type BatchInfo = {
  quantity: number;
  unit: RecipeUnit;
};

type ProductionTask = {
  id: string;
  label: string;
  group: "ingredients" | "semi" | "steps" | "finishing";
};

const WORK_FILTERS: Array<{ id: WorkFilterId; label: string }> = [
  { id: "all", label: "Alles" },
  { id: "gebak", label: "Gebak" },
  { id: "taarten", label: "Taarten" },
  { id: "sloffen", label: "Sloffen" },
  { id: "koek", label: "Koek" },
  { id: "ijs", label: "IJs" },
  { id: "bonbons", label: "Bonbons" },
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
  const group = normalizeSearch(recipe.productGroup);
  const name = normalizeSearch(recipe.name);

  if (filter === "all") return true;
  if (filter === "halffabricaten") return recipe.type === "semiFinished";
  if (filter === "gebak") return group.includes("gebak") || group.includes("gateau");
  if (filter === "taarten") return group.includes("taart") || name.includes("taart");
  if (filter === "sloffen") return group.includes("slof") || name.includes("slof");
  if (filter === "koek") return group.includes("koek") || name.includes("koek");
  if (filter === "ijs") return group.includes("ijs") || name.includes("ijs");
  if (filter === "bonbons") return group.includes("bonbon") || name.includes("bonbon");

  return true;
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
  </style>
</head>
<body>
  <h1>${escapeHtml(recipe.name)}</h1>
  <p>${escapeHtml(recipe.productGroup)} - ${escapeHtml(getRecipeTypeLabel(recipe))}</p>
  <p><strong>Batch:</strong> ${escapeHtml(formatBatch(batch))}</p>
  <h2>Ingredienten</h2>
  <table><tbody>${ingredientRows || "<tr><td>Geen directe ingredienten.</td></tr>"}</tbody></table>
  <h2>Benodigde halffabricaten</h2>
  <table><tbody>${semiRows || "<tr><td>Geen halffabricaten.</td></tr>"}</tbody></table>
  <h2>Bereidingswijze</h2>
  <ol>${stepRows}</ol>
  <h2>Afwerking</h2>
  <ol>${finishingRows}</ol>
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
}: Readonly<{
  recipes: Recipe[];
  ingredients: Ingredient[];
}>) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<WorkFilterId>("all");
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [startInProduction, setStartInProduction] = useState(false);
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

  return (
    <section className="grid gap-4">
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
          {WORK_FILTERS.map((item) => (
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
                setSelectedRecipe(recipe);
              }}
              onStart={() => {
                setStartInProduction(true);
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

      {selectedRecipe && (
        <WorkRecipeDetail
          key={`${selectedRecipe.id}-${startInProduction ? "production" : "detail"}`}
          recipe={selectedRecipe}
          recipes={recipes}
          ingredients={ingredients}
          startInProduction={startInProduction}
          onSelectRecipe={setSelectedRecipe}
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

  return (
    <article className="grid gap-3 rounded-[1.05rem] border border-[#e2dbcf] bg-white/92 p-4 shadow-sm">
      <div>
        <p className="text-[0.65rem] font-black uppercase tracking-[0.13em] text-[#2d2a26]/42">
          {recipe.productGroup}
        </p>
        <h3 className="mt-1 text-lg font-black leading-tight">{recipe.name}</h3>
        <p className="mt-1 text-xs font-bold text-[#2d2a26]/55">
          {getRecipeTypeLabel(recipe)} - standaard batch {formatBatch(batch)}
        </p>
        <p className="mt-0.5 text-[0.7rem] font-bold text-[#2d2a26]/42">
          Laatst gewijzigd {formatDate(recipe.lastUpdated)}
        </p>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {recipe.allergens.length ? (
          recipe.allergens.slice(0, 5).map((allergen) => (
            <span
              key={allergen}
              className="rounded-full bg-[#f8f6f3] px-2.5 py-1 text-[0.7rem] font-black text-[#2d2a26]/58"
            >
              {allergen}
            </span>
          ))
        ) : (
          <span className="rounded-full bg-[#f8f6f3] px-2.5 py-1 text-[0.7rem] font-black text-[#2d2a26]/45">
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

function WorkRecipeDetail({
  recipe,
  recipes,
  ingredients,
  startInProduction,
  onSelectRecipe,
  onClose,
}: Readonly<{
  recipe: Recipe;
  recipes: Recipe[];
  ingredients: Ingredient[];
  startInProduction: boolean;
  onSelectRecipe: (recipe: Recipe) => void;
  onClose: () => void;
}>) {
  const standardBatch = getStandardBatch(recipe);
  const [batchQuantity, setBatchQuantity] = useState(standardBatch.quantity);
  const [isProducing, setIsProducing] = useState(startInProduction);
  const activeBatch = { ...standardBatch, quantity: batchQuantity };
  const multiplier = standardBatch.quantity
    ? batchQuantity / standardBatch.quantity
    : 1;
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

  function printProductionCard() {
    const printWindow = window.open("", "_blank", "width=980,height=760");

    if (!printWindow) return;

    printWindow.document.write(
      createPrintHtml(
        recipe,
        activeBatch,
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
            </div>
            <div className="flex flex-wrap gap-2">
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
                scaledSemiFinished.map((item) => (
                  <button
                    key={`${item.id}-${item.quantity}`}
                    type="button"
                    onClick={() => item.recipe && onSelectRecipe(item.recipe)}
                    className="grid grid-cols-[7rem_minmax(0,1fr)] gap-3 rounded-2xl bg-[#fffdf8] p-3 text-left text-sm font-bold shadow-sm"
                  >
                    <span>{formatAmount(item.quantity, item.unit)}</span>
                    <span className="font-black">{item.name}</span>
                  </button>
                ))
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
            <WorkPanel title="Afwerking">
              <div className="grid gap-2">
                {finishingSteps.map((step, index) => (
                  <WorkChecklistPreview key={`${step}-${index}`} label={step} />
                ))}
              </div>
            </WorkPanel>

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
          ingredients={scaledIngredients}
          semiFinished={scaledSemiFinished}
          steps={workSteps}
          finishingSteps={finishingSteps}
          onBack={() => setIsProducing(false)}
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
  ingredients,
  semiFinished,
  steps,
  finishingSteps,
  onBack,
}: Readonly<{
  recipe: Recipe;
  batch: BatchInfo;
  ingredients: ReturnType<typeof getScaledIngredients>;
  semiFinished: ReturnType<typeof getScaledSemiFinished>;
  steps: string[];
  finishingSteps: string[];
  onBack: () => void;
}>) {
  const [checkedTasks, setCheckedTasks] = useState<Record<string, boolean>>({});
  const [isPaused, setIsPaused] = useState(false);
  const [viewMode, setViewMode] = useState<"checklist" | "focus">("checklist");
  const [focusIndex, setFocusIndex] = useState(0);
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
  }

  return (
    <div className="fixed inset-0 z-[90] overflow-y-auto bg-[#f4f0ea] px-3 py-4 text-[#2d2a26]">
      <div className="mx-auto grid max-w-6xl gap-4">
        <header className="rounded-[1.25rem] bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[#45663b]">
                Productiemodus
              </p>
              <h2 className="mt-1 text-3xl font-black leading-tight">
                {recipe.name}
              </h2>
              <p className="mt-2 text-lg font-black text-[#2d2a26]/65">
                Batchgrootte: {formatBatch(batch)}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setIsPaused((current) => !current)}
                className="rounded-full bg-[#fff0bd] px-5 py-3 text-sm font-black text-[#7a5a18] shadow-sm"
              >
                {isPaused ? "Hervat" : "Pauzeer"}
              </button>
              <button
                type="button"
                onClick={completeAll}
                className="rounded-full bg-[#c3d3bc] px-5 py-3 text-sm font-black shadow-sm"
              >
                Afronden
              </button>
              <button
                type="button"
                onClick={resetChecklist}
                className="rounded-full bg-white px-5 py-3 text-sm font-black shadow-sm"
              >
                Reset checklist
              </button>
              <button
                type="button"
                onClick={onBack}
                className="rounded-full bg-white px-5 py-3 text-sm font-black shadow-sm"
              >
                Terug naar recept
              </button>
            </div>
          </div>
          <div className="mt-5">
            <div className="flex items-center justify-between gap-3 text-sm font-black text-[#2d2a26]/60">
              <span>
                {completed} van {tasks.length} taken voltooid
              </span>
              <span>{progress}%</span>
            </div>
            <div className="mt-2 h-4 overflow-hidden rounded-full bg-[#e5ddd2]">
              <div
                className="h-full rounded-full bg-[#8fb184] transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
          <div className="mt-4 flex w-fit rounded-full bg-[#f8f6f3] p-1">
            {(["checklist", "focus"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setViewMode(mode)}
                className={`rounded-full px-5 py-3 text-sm font-black ${
                  viewMode === mode ? "bg-white shadow-sm" : "text-[#2d2a26]/55"
                }`}
              >
                {mode === "checklist" ? "Checklist" : "Focus"}
              </button>
            ))}
          </div>
        </header>

        {isPaused && (
          <p className="rounded-[1.1rem] border border-[#ead7a6] bg-[#fff8e3] p-4 text-sm font-black text-[#7a5a18]">
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
            />
            <ProductionTaskGroup
              title="Halffabricaten"
              tasks={tasks.filter((task) => task.group === "semi")}
              checkedTasks={checkedTasks}
              onToggle={toggleTask}
            />
            <ProductionTaskGroup
              title="Stappen"
              tasks={tasks.filter((task) => task.group === "steps")}
              checkedTasks={checkedTasks}
              onToggle={toggleTask}
            />
            <ProductionTaskGroup
              title="Afwerking"
              tasks={tasks.filter((task) => task.group === "finishing")}
              checkedTasks={checkedTasks}
              onToggle={toggleTask}
            />
          </div>
        ) : (
          <section className="rounded-[1.4rem] bg-white p-6 text-center shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[#2d2a26]/42">
              Huidige stap
            </p>
            {focusTask ? (
              <>
                <p className="mt-5 text-3xl font-black leading-tight">
                  {focusTask.label}
                </p>
                <button
                  type="button"
                  onClick={() => toggleTask(focusTask.id)}
                  className={`mt-6 rounded-full px-8 py-4 text-lg font-black shadow-sm ${
                    checkedTasks[focusTask.id]
                      ? "bg-[#dce8d6] text-[#45663b]"
                      : "bg-[#c3d3bc] text-[#2d2a26]"
                  }`}
                >
                  {checkedTasks[focusTask.id] ? "Gedaan" : "Afvinken"}
                </button>
                <div className="mt-6 flex justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => setFocusIndex((current) => Math.max(0, current - 1))}
                    className="rounded-full bg-[#f8f6f3] px-5 py-3 text-sm font-black shadow-sm"
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
                    className="rounded-full bg-[#c3d3bc] px-5 py-3 text-sm font-black shadow-sm"
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
}: Readonly<{
  title: string;
  tasks: ProductionTask[];
  checkedTasks: Record<string, boolean>;
  onToggle: (taskId: string) => void;
}>) {
  return (
    <section className="rounded-[1.25rem] bg-white p-4 shadow-sm">
      <h3 className="text-xl font-black">{title}</h3>
      <div className="mt-3 grid gap-2">
        {tasks.length ? (
          tasks.map((task) => (
            <button
              key={task.id}
              type="button"
              onClick={() => onToggle(task.id)}
              className={`flex gap-3 rounded-2xl p-4 text-left text-base font-black shadow-sm transition ${
                checkedTasks[task.id]
                  ? "bg-[#dce8d6] text-[#45663b]"
                  : "bg-[#fffdf8] text-[#2d2a26]"
              }`}
            >
              <span
                className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border-2 ${
                  checkedTasks[task.id]
                    ? "border-[#45663b] bg-[#45663b] text-white"
                    : "border-[#c3d3bc]"
                }`}
              >
                {checkedTasks[task.id] ? "OK" : ""}
              </span>
              <span>{task.label}</span>
            </button>
          ))
        ) : (
          <p className="rounded-2xl bg-[#f8f6f3] p-4 text-sm font-bold text-[#2d2a26]/50">
            Geen taken in deze categorie.
          </p>
        )}
      </div>
    </section>
  );
}
