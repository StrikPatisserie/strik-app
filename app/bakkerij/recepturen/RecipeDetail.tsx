import { useState } from "react";
import type { Ingredient, Recipe, RecipeStatus } from "./types";
import { Panel, MarginBadge, RecipeStatusBadge, SectionTitle } from "./RecepturenShared";
import {
  directIngredientCost,
  findIngredient,
  findRecipe,
  formatDate,
  formatEuro,
  formatPercent,
  marginStatusForRecipe,
  quantityLabel,
  recipeCostDelta,
  recipeCostChange,
  targetSalesPrice,
} from "./utils";

export default function RecipeDetail({
  recipe,
  ingredients,
  recipes,
  onClose,
  onSaveRecipe,
}: Readonly<{
  recipe: Recipe;
  ingredients: Ingredient[];
  recipes: Recipe[];
  onClose: () => void;
  onSaveRecipe: (recipe: Recipe) => void;
}>) {
  const [isEditing, setIsEditing] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [draft, setDraft] = useState(() => createRecipeDraft(recipe));
  const semiFinishedTotal = recipe.semiFinishedItems.reduce(
    (total, item) => total + item.costContribution,
    0
  );
  const directTotal = directIngredientCost(recipe.ingredients);
  const extraTotal = (recipe.packagingCost || 0) + (recipe.decorationCost || 0);
  const targetPrice = targetSalesPrice(recipe);

  function showFeedback(message: string) {
    setFeedback(message);
    window.setTimeout(() => setFeedback(""), 2200);
  }

  function saveRecipeDraft() {
    const salesPrice = parseDutchNumber(draft.salesPrice);
    const targetMargin = parseDutchNumber(draft.targetMargin);
    const updatedRecipe = {
      ...recipe,
      name: draft.name.trim() || recipe.name,
      productGroup: draft.productGroup.trim() || recipe.productGroup,
      salesPrice,
      targetMargin,
      currentMargin: calculateMargin(salesPrice, recipe.costPrice),
      status: draft.status,
      portionLabel: draft.portionLabel.trim() || recipe.portionLabel,
      batchSize: draft.batchSize.trim() || recipe.batchSize,
      notes: draft.notes,
      lastUpdated: todayIsoDate(),
    };

    onSaveRecipe(updatedRecipe);
    setDraft(createRecipeDraft(updatedRecipe));
    setIsEditing(false);
    showFeedback("Recept aangepast.");
  }

  async function copyRecipe() {
    try {
      await navigator.clipboard.writeText(
        createRecipeText(recipe, ingredients, recipes)
      );
      showFeedback("Recept gekopieerd.");
    } catch {
      showFeedback("Kopieren lukt nu niet.");
    }
  }

  function printProductionCard() {
    const printWindow = window.open("", "_blank", "width=980,height=760");

    if (!printWindow) {
      showFeedback("Printvenster is geblokkeerd.");
      return;
    }

    printWindow.document.write(
      createRecipePrintHtml(recipe, ingredients, recipes)
    );
    printWindow.document.close();
    printWindow.focus();
    window.setTimeout(() => printWindow.print(), 150);
    showFeedback("Printvenster geopend.");
  }

  function recalculateRecipeCost() {
    const nextCostPrice =
      Math.round((directTotal + semiFinishedTotal + extraTotal) * 100) / 100;
    const updatedRecipe = {
      ...recipe,
      previousCostPrice: recipe.costPrice,
      costPrice: nextCostPrice,
      currentMargin: calculateMargin(recipe.salesPrice, nextCostPrice),
      lastUpdated: todayIsoDate(),
    };

    onSaveRecipe(updatedRecipe);
    showFeedback("Kostprijs opnieuw berekend.");
  }

  return (
    <div className="fixed inset-0 z-[70] overflow-y-auto bg-[#2d2a26]/35 px-3 py-5 backdrop-blur-sm">
      <div className="mx-auto max-w-5xl rounded-[1.5rem] border border-[#e7e0d8] bg-[#f4f0ea] p-4 shadow-2xl">
        <div className="flex flex-wrap items-start justify-between gap-3 rounded-[1.25rem] bg-white/88 p-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[#2d2a26]/45">
              {recipe.type === "finalProduct" ? "Recept detail" : "Halffabricaat detail"}
            </p>
            <h2 className="mt-1 text-3xl font-black leading-tight">{recipe.name}</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              <RecipeStatusBadge status={recipe.status} />
              <MarginBadge status={marginStatusForRecipe(recipe)} />
              <span className="rounded-full bg-[#f8f6f3] px-2.5 py-1 text-xs font-black text-[#2d2a26]/55">
                {recipe.productGroup}
              </span>
              <span className="rounded-full bg-[#f8f6f3] px-2.5 py-1 text-xs font-black text-[#2d2a26]/55">
                {recipe.version}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-white px-4 py-2 text-sm font-black shadow-sm"
          >
            Sluit
          </button>
        </div>

        {isEditing && (
          <Panel className="mt-4 border-[#cfdcc8] bg-[#f7faf5]">
            <SectionTitle
              eyebrow="Bewerken"
              title="Receptgegevens aanpassen"
              description="Wijzigingen worden direct in dit scherm opgeslagen. Dit is nog lokale app-state, geen database-opslag."
            />
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              <EditTextField
                label="Naam"
                value={draft.name}
                onChange={(value) => setDraft((current) => ({ ...current, name: value }))}
              />
              <EditTextField
                label="Productgroep"
                value={draft.productGroup}
                onChange={(value) =>
                  setDraft((current) => ({ ...current, productGroup: value }))
                }
              />
              <EditTextField
                label="Verkoopprijs"
                value={draft.salesPrice}
                onChange={(value) =>
                  setDraft((current) => ({ ...current, salesPrice: value }))
                }
                inputMode="decimal"
              />
              <EditTextField
                label="Doelmarge"
                value={draft.targetMargin}
                onChange={(value) =>
                  setDraft((current) => ({ ...current, targetMargin: value }))
                }
                inputMode="decimal"
              />
              <EditTextField
                label="Portie"
                value={draft.portionLabel}
                onChange={(value) =>
                  setDraft((current) => ({ ...current, portionLabel: value }))
                }
              />
              <EditTextField
                label="Batch"
                value={draft.batchSize}
                onChange={(value) =>
                  setDraft((current) => ({ ...current, batchSize: value }))
                }
              />
              <label className="grid gap-1 text-xs font-black uppercase tracking-[0.12em] text-[#2d2a26]/45">
                Status
                <select
                  value={draft.status}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      status: event.target.value as RecipeStatus,
                    }))
                  }
                  className="min-w-0 rounded-2xl border border-[#cfdcc8] bg-white px-3 py-3 text-sm font-bold normal-case tracking-normal text-[#2d2a26] focus:outline-none focus:ring-2 focus:ring-[#8fb184]"
                >
                  <option value="active">Actief</option>
                  <option value="draft">Concept</option>
                  <option value="old">Oud recept</option>
                </select>
              </label>
              <label className="grid gap-1 text-xs font-black uppercase tracking-[0.12em] text-[#2d2a26]/45 lg:col-span-2">
                Notities
                <textarea
                  value={draft.notes}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      notes: event.target.value,
                    }))
                  }
                  className="min-h-24 rounded-2xl border border-[#cfdcc8] bg-white px-3 py-3 text-sm font-bold normal-case tracking-normal text-[#2d2a26] focus:outline-none focus:ring-2 focus:ring-[#8fb184]"
                />
              </label>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={saveRecipeDraft}
                className="rounded-full bg-[#c3d3bc] px-4 py-2.5 text-sm font-black shadow-sm"
              >
                Wijzigingen opslaan
              </button>
              <button
                type="button"
                onClick={() => {
                  setDraft(createRecipeDraft(recipe));
                  setIsEditing(false);
                }}
                className="rounded-full bg-white px-4 py-2.5 text-sm font-black text-[#2d2a26]/60 shadow-sm"
              >
                Annuleer
              </button>
            </div>
          </Panel>
        )}

        <div className="mt-4 grid gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
          <Panel className="bg-[#fffdf8]">
            <div className="flex aspect-[4/3] items-center justify-center rounded-[1.1rem] border border-[#e7e0d8] bg-[#eadfcf] p-4 text-center">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-[#2d2a26]/45">
                  Foto placeholder
                </p>
                <p className="mt-2 text-lg font-black">{recipe.photoHint}</p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
              <Metric label="Verkoopprijs" value={recipe.salesPrice ? formatEuro(recipe.salesPrice) : "-"} />
              <Metric label="Kostprijs" value={formatEuro(recipe.costPrice)} />
              <Metric label="Marge" value={recipe.currentMargin ? formatPercent(recipe.currentMargin) : "-"} />
              <Metric label="Doelmarge" value={recipe.targetMargin ? formatPercent(recipe.targetMargin) : "-"} />
              <Metric label="Portie" value={recipe.portionLabel} />
              <Metric label="Batch" value={recipe.batchSize} />
            </div>
          </Panel>

          <div className="grid gap-4">
            <Panel>
              <SectionTitle
                title="Kostprijsopbouw"
                description="Opgebouwd uit directe ingredienten, halffabricaten, decoratie en verpakking."
              />
              <div className="mt-4 grid gap-3 sm:grid-cols-4">
                <Metric label="Direct" value={formatEuro(directTotal)} />
                <Metric label="Halffabricaten" value={formatEuro(semiFinishedTotal)} />
                <Metric label="Extra" value={formatEuro(extraTotal)} />
                <Metric label="Verschil" value={`${formatEuro(recipeCostDelta(recipe))} · ${formatPercent(recipeCostChange(recipe), 1)}`} />
              </div>
              {recipe.type === "finalProduct" && (
                <div className="mt-4 rounded-2xl border border-[#ead7a6] bg-[#fff8e3] p-3">
                  <p className="text-sm font-black text-[#7a5a18]">
                    Adviesprijs bij {formatPercent(recipe.targetMargin)} marge:{" "}
                    {formatEuro(targetPrice)}
                  </p>
                  <p className="mt-1 text-xs font-bold text-[#2d2a26]/55">
                    Verkoopprijs moet met {formatEuro(Math.max(0, targetPrice - recipe.salesPrice))} omhoog om de doelmarge te halen.
                  </p>
                </div>
              )}
            </Panel>

            <div className="grid gap-4 xl:grid-cols-2">
              <Panel>
                <SectionTitle title="Ingredienten direct in recept" />
                <div className="mt-3 grid gap-2">
                  {recipe.ingredients.map((item) => {
                    const ingredient = findIngredient(ingredients, item.ingredientId);

                    return (
                      <LineItem
                        key={`${item.ingredientId}-${item.quantity}`}
                        title={ingredient?.name || item.ingredientId}
                        meta={quantityLabel(item.quantity, item.unit)}
                        value={formatEuro(item.costContribution)}
                      />
                    );
                  })}
                </div>
              </Panel>

              <Panel>
                <SectionTitle title="Gekoppelde halffabricaten" />
                <div className="mt-3 grid gap-2">
                  {recipe.semiFinishedItems.length ? (
                    recipe.semiFinishedItems.map((item) => {
                      const linkedRecipe = findRecipe(recipes, item.semiFinishedRecipeId);

                      return (
                        <LineItem
                          key={`${item.semiFinishedRecipeId}-${item.quantity}`}
                          title={linkedRecipe?.name || item.semiFinishedRecipeId}
                          meta={quantityLabel(item.quantity, item.unit)}
                          value={formatEuro(item.costContribution)}
                        />
                      );
                    })
                  ) : (
                    <p className="rounded-2xl bg-[#f8f6f3] p-3 text-sm font-bold text-[#2d2a26]/45">
                      Geen gekoppelde halffabricaten.
                    </p>
                  )}
                </div>
              </Panel>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <Panel>
                <SectionTitle title="Bereidingswijze" />
                <ol className="mt-3 grid gap-2">
                  {recipe.preparationSteps.map((step, index) => (
                    <li key={step} className="flex gap-3 rounded-2xl bg-[#fffdf8] p-3">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#c3d3bc] text-sm font-black">
                        {index + 1}
                      </span>
                      <span className="text-sm font-semibold leading-relaxed text-[#2d2a26]/70">
                        {step}
                      </span>
                    </li>
                  ))}
                </ol>
              </Panel>

              <Panel>
                <SectionTitle title="Allergenen en interne notities" />
                <div className="mt-3 flex flex-wrap gap-2">
                  {recipe.allergens.map((allergen) => (
                    <span
                      key={allergen}
                      className="rounded-full bg-[#f8f6f3] px-3 py-1 text-xs font-black text-[#2d2a26]/55"
                    >
                      {allergen}
                    </span>
                  ))}
                </div>
                <p className="mt-4 rounded-2xl bg-[#fffdf8] p-3 text-sm font-semibold leading-relaxed text-[#2d2a26]/65">
                  {recipe.notes}
                </p>
                <div className="mt-4 rounded-2xl border border-[#e7e0d8] bg-white p-3">
                  <p className="text-sm font-black">Versiegeschiedenis</p>
                  <p className="mt-1 text-xs font-bold text-[#2d2a26]/50">
                    {recipe.version} · laatst gewijzigd op {formatDate(recipe.lastUpdated)}
                  </p>
                  <p className="mt-1 text-xs font-bold text-[#2d2a26]/50">
                    Vorige calculatie: {formatEuro(recipe.previousCostPrice)}
                  </p>
                </div>
              </Panel>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2 rounded-[1.25rem] bg-white/88 p-3">
          <button
            type="button"
            onClick={() => setIsEditing((current) => !current)}
            className="rounded-full bg-[#c3d3bc] px-4 py-2.5 text-sm font-black shadow-sm"
          >
            {isEditing ? "Bewerken sluiten" : "Recept bewerken"}
          </button>
          <button
            type="button"
            onClick={() => void copyRecipe()}
            className="rounded-full bg-[#c3d3bc] px-4 py-2.5 text-sm font-black shadow-sm"
          >
            Recept kopieren
          </button>
          <button
            type="button"
            onClick={printProductionCard}
            className="rounded-full bg-[#c3d3bc] px-4 py-2.5 text-sm font-black shadow-sm"
          >
            Productiekaart printen
          </button>
          <button
            type="button"
            onClick={recalculateRecipeCost}
            className="rounded-full bg-[#c3d3bc] px-4 py-2.5 text-sm font-black shadow-sm"
          >
            Kostprijs herberekenen
          </button>
          {feedback && (
            <p className="self-center text-sm font-black text-[#45663b]">
              {feedback}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

type RecipeDraft = {
  name: string;
  productGroup: string;
  salesPrice: string;
  targetMargin: string;
  status: RecipeStatus;
  portionLabel: string;
  batchSize: string;
  notes: string;
};

function createRecipeDraft(recipe: Recipe): RecipeDraft {
  return {
    name: recipe.name,
    productGroup: recipe.productGroup,
    salesPrice: String(recipe.salesPrice).replace(".", ","),
    targetMargin: String(recipe.targetMargin).replace(".", ","),
    status: recipe.status,
    portionLabel: recipe.portionLabel,
    batchSize: recipe.batchSize,
    notes: recipe.notes,
  };
}

function parseDutchNumber(value: string) {
  const number = Number(value.replace(",", ".").replace(/[^\d.]/g, ""));

  if (!Number.isFinite(number)) return 0;

  return Math.max(0, Math.round(number * 100) / 100);
}

function calculateMargin(salesPrice: number, costPrice: number) {
  if (!salesPrice) return 0;

  return Math.round(((salesPrice - costPrice) / salesPrice) * 1000) / 10;
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function createRecipeText(
  recipe: Recipe,
  ingredients: Ingredient[],
  recipes: Recipe[]
) {
  const ingredientLines = recipe.ingredients.map((item) => {
    const ingredient = findIngredient(ingredients, item.ingredientId);

    return `- ${ingredient?.name || item.ingredientId}: ${quantityLabel(
      item.quantity,
      item.unit
    )}`;
  });
  const semiFinishedLines = recipe.semiFinishedItems.map((item) => {
    const linkedRecipe = findRecipe(recipes, item.semiFinishedRecipeId);

    return `- ${linkedRecipe?.name || item.semiFinishedRecipeId}: ${quantityLabel(
      item.quantity,
      item.unit
    )}`;
  });

  return [
    recipe.name,
    `Groep: ${recipe.productGroup}`,
    `Batch: ${recipe.batchSize}`,
    `Portie: ${recipe.portionLabel}`,
    `Kostprijs: ${formatEuro(recipe.costPrice)}`,
    `Verkoopprijs: ${recipe.salesPrice ? formatEuro(recipe.salesPrice) : "-"}`,
    "",
    "Ingredienten",
    ingredientLines.length ? ingredientLines.join("\n") : "-",
    "",
    "Halffabricaten",
    semiFinishedLines.length ? semiFinishedLines.join("\n") : "-",
    "",
    "Bereiding",
    recipe.preparationSteps
      .map((step, index) => `${index + 1}. ${step}`)
      .join("\n"),
    "",
    "Notities",
    recipe.notes || "-",
  ].join("\n");
}

function createRecipePrintHtml(
  recipe: Recipe,
  ingredients: Ingredient[],
  recipes: Recipe[]
) {
  const ingredientRows = recipe.ingredients
    .map((item) => {
      const ingredient = findIngredient(ingredients, item.ingredientId);

      return `<tr><td>${escapeHtml(ingredient?.name || item.ingredientId)}</td><td>${escapeHtml(
        quantityLabel(item.quantity, item.unit)
      )}</td><td>${escapeHtml(formatEuro(item.costContribution))}</td></tr>`;
    })
    .join("");
  const semiRows = recipe.semiFinishedItems
    .map((item) => {
      const linkedRecipe = findRecipe(recipes, item.semiFinishedRecipeId);

      return `<tr><td>${escapeHtml(
        linkedRecipe?.name || item.semiFinishedRecipeId
      )}</td><td>${escapeHtml(quantityLabel(item.quantity, item.unit))}</td><td>${escapeHtml(
        formatEuro(item.costContribution)
      )}</td></tr>`;
    })
    .join("");
  const steps = recipe.preparationSteps
    .map((step) => `<li>${escapeHtml(step)}</li>`)
    .join("");

  return `<!doctype html>
<html lang="nl">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(recipe.name)} productiekaart</title>
  <style>
    body { font-family: Arial, sans-serif; color: #2d2a26; margin: 32px; }
    h1 { font-size: 28px; margin: 0 0 6px; }
    h2 { font-size: 16px; margin: 24px 0 8px; }
    p { margin: 4px 0; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th, td { border-bottom: 1px solid #ddd5ca; padding: 8px; text-align: left; font-size: 13px; }
    th { background: #f4f0ea; }
    .meta { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-top: 16px; }
    .box { border: 1px solid #ddd5ca; border-radius: 10px; padding: 10px; }
    ol { padding-left: 22px; }
  </style>
</head>
<body>
  <h1>${escapeHtml(recipe.name)}</h1>
  <p>${escapeHtml(recipe.productGroup)} · ${escapeHtml(recipe.version)}</p>
  <div class="meta">
    <div class="box"><strong>Batch</strong><br />${escapeHtml(recipe.batchSize)}</div>
    <div class="box"><strong>Portie</strong><br />${escapeHtml(recipe.portionLabel)}</div>
    <div class="box"><strong>Kostprijs</strong><br />${escapeHtml(formatEuro(recipe.costPrice))}</div>
    <div class="box"><strong>Marge</strong><br />${escapeHtml(formatPercent(recipe.currentMargin))}</div>
  </div>
  <h2>Ingredienten</h2>
  <table><thead><tr><th>Naam</th><th>Hoeveelheid</th><th>Kostprijs</th></tr></thead><tbody>${ingredientRows || "<tr><td colspan=\"3\">Geen directe ingredienten.</td></tr>"}</tbody></table>
  <h2>Halffabricaten</h2>
  <table><thead><tr><th>Naam</th><th>Hoeveelheid</th><th>Kostprijs</th></tr></thead><tbody>${semiRows || "<tr><td colspan=\"3\">Geen halffabricaten.</td></tr>"}</tbody></table>
  <h2>Bereidingswijze</h2>
  <ol>${steps}</ol>
  <h2>Notities</h2>
  <p>${escapeHtml(recipe.notes || "-")}</p>
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

function EditTextField({
  label,
  value,
  onChange,
  inputMode,
}: Readonly<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  inputMode?: "decimal";
}>) {
  return (
    <label className="grid gap-1 text-xs font-black uppercase tracking-[0.12em] text-[#2d2a26]/45">
      {label}
      <input
        value={value}
        inputMode={inputMode}
        onChange={(event) => onChange(event.target.value)}
        className="min-w-0 rounded-2xl border border-[#cfdcc8] bg-white px-3 py-3 text-sm font-bold normal-case tracking-normal text-[#2d2a26] focus:outline-none focus:ring-2 focus:ring-[#8fb184]"
      />
    </label>
  );
}

function Metric({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div className="rounded-2xl bg-[#f8f6f3] p-3">
      <p className="text-[0.65rem] font-black uppercase tracking-[0.12em] text-[#2d2a26]/40">
        {label}
      </p>
      <p className="mt-1 text-sm font-black">{value}</p>
    </div>
  );
}

function LineItem({
  title,
  meta,
  value,
}: Readonly<{ title: string; meta: string; value: string }>) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-[#e7e0d8] bg-[#fffdf8] p-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-black">{title}</p>
        <p className="text-xs font-bold text-[#2d2a26]/45">{meta}</p>
      </div>
      <p className="shrink-0 text-sm font-black">{value}</p>
    </div>
  );
}
