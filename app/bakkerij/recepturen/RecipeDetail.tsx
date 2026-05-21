import type { Ingredient, Recipe } from "./types";
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
}: Readonly<{
  recipe: Recipe;
  ingredients: Ingredient[];
  recipes: Recipe[];
  onClose: () => void;
}>) {
  const semiFinishedTotal = recipe.semiFinishedItems.reduce(
    (total, item) => total + item.costContribution,
    0
  );
  const directTotal = directIngredientCost(recipe.ingredients);
  const extraTotal = (recipe.packagingCost || 0) + (recipe.decorationCost || 0);
  const targetPrice = targetSalesPrice(recipe);

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
          {["Recept bewerken", "Recept kopieren", "Productiekaart printen", "Kostprijs herberekenen"].map(
            (action) => (
              <button
                key={action}
                type="button"
                className="rounded-full bg-[#c3d3bc] px-4 py-2.5 text-sm font-black shadow-sm"
              >
                {action}
              </button>
            )
          )}
        </div>
      </div>
    </div>
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
