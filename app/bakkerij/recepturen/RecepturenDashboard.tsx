import { MetricCard, Panel, SectionTitle, MarginBadge } from "./RecepturenShared";
import type { Ingredient, InvoiceImport, Recipe } from "./types";
import {
  changeBadgeClass,
  formatDate,
  formatSignedPercent,
  ingredientPriceChange,
  marginStatusForRecipe,
  recipeCostChange,
} from "./utils";

export default function RecepturenDashboard({
  recipes,
  ingredients,
  invoice,
}: Readonly<{
  recipes: Recipe[];
  ingredients: Ingredient[];
  invoice: InvoiceImport;
}>) {
  const finalProducts = recipes.filter((recipe) => recipe.type === "finalProduct");
  const semiFinished = recipes.filter((recipe) => recipe.type === "semiFinished");
  const underMargin = finalProducts.filter(
    (recipe) => marginStatusForRecipe(recipe) !== "good"
  );
  const latestIngredientDate = ingredients
    .map((ingredient) => ingredient.lastUpdated)
    .sort()
    .at(-1);
  const biggestIngredientChanges = [...ingredients]
    .sort((first, second) => ingredientPriceChange(second) - ingredientPriceChange(first))
    .slice(0, 4);
  const biggestRecipeChanges = [...finalProducts]
    .sort((first, second) => recipeCostChange(second) - recipeCostChange(first))
    .slice(0, 4);

  return (
    <div className="grid gap-4">
      <Panel className="border-[#e7cfc7] bg-[#fff4f1]">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[#a83e31]">
              Prijsupdate waarschuwing
            </p>
            <h2 className="mt-2 text-2xl font-black leading-tight">
              Na laatste Beko factuur zijn 14 ingredienten gewijzigd.
            </h2>
            <p className="mt-2 text-sm font-bold leading-relaxed text-[#2d2a26]/62">
              Impact op 36 recepten. 8 producten zitten onder gewenste marge.
              Controleer eerst de prijsupdates voordat verkoopprijzen worden
              aangepast.
            </p>
          </div>
          <div className="rounded-[1rem] border border-[#efc2bb] bg-white/70 p-3 text-sm font-black text-[#a83e31]">
            {invoice.supplier} {invoice.invoiceNumber}
            <span className="block text-xs text-[#2d2a26]/45">
              {formatDate(invoice.invoiceDate)}
            </span>
          </div>
        </div>
      </Panel>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Eindproducten"
          value={finalProducts.length}
          detail="Actieve verkooprecepten en concepten"
          tone="good"
        />
        <MetricCard
          label="Halffabricaten"
          value={semiFinished.length}
          detail="Losse basisrecepten gekoppeld aan eindproducten"
        />
        <MetricCard
          label="Ingredienten"
          value={ingredients.length}
          detail="Grondstoffen met leverancier en prijshistorie"
        />
        <MetricCard
          label="Laatst bijgewerkt"
          value={latestIngredientDate ? formatDate(latestIngredientDate) : "-"}
          detail="Via factuurimport en handmatige controle"
          tone="pressure"
        />
        <MetricCard
          label="Onder margegrens"
          value={underMargin.length}
          detail="Producten met krappe of kritische marge"
          tone="critical"
        />
        <MetricCard
          label="Prijsupdates open"
          value={invoice.lines.filter((line) => line.reviewStatus === "pending").length}
          detail="Regels wachten op goedkeuring"
          tone="pressure"
        />
        <MetricCard
          label="Nieuwe artikelen"
          value={invoice.lines.filter((line) => !line.matchedIngredientId).length}
          detail="Moeten nog gekoppeld worden"
        />
        <MetricCard
          label="Gemiddelde doelmarge"
          value="80%"
          detail="Standaard voor eindproducten"
          tone="good"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel>
          <SectionTitle
            eyebrow="Ingredienten"
            title="Grootste prijsstijgingen"
            description="Deze grondstoffen veroorzaken de meeste spanning in gekoppelde recepten."
          />
          <div className="mt-4 grid gap-2">
            {biggestIngredientChanges.map((ingredient) => (
              <div
                key={ingredient.id}
                className="flex items-center justify-between gap-3 rounded-2xl border border-[#e7e0d8] bg-[#fffdf8] p-3"
              >
                <div className="min-w-0">
                  <p className="font-black leading-tight">{ingredient.name}</p>
                  <p className="text-xs font-bold text-[#2d2a26]/45">
                    {ingredient.supplier} · {ingredient.lastInvoice}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-3 py-1 text-sm font-black ${changeBadgeClass(
                    ingredientPriceChange(ingredient)
                  )}`}
                >
                  {formatSignedPercent(ingredientPriceChange(ingredient), 1)}
                </span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel>
          <SectionTitle
            eyebrow="Recepten"
            title="Grootste kostprijsstijgingen"
            description="Kostprijsverschil ten opzichte van de vorige opgeslagen calculatie."
          />
          <div className="mt-4 grid gap-2">
            {biggestRecipeChanges.map((recipe) => {
              const status = marginStatusForRecipe(recipe);

              return (
                <div
                  key={recipe.id}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-[#e7e0d8] bg-[#fffdf8] p-3"
                >
                  <div className="min-w-0">
                    <p className="font-black leading-tight">{recipe.name}</p>
                    <p className="text-xs font-bold text-[#2d2a26]/45">
                      {recipe.productGroup}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-3 py-1 text-sm font-black ${changeBadgeClass(
                      recipeCostChange(recipe)
                    )}`}
                  >
                    {formatSignedPercent(recipeCostChange(recipe), 1)}
                  </span>
                  <MarginBadge status={status} />
                </div>
              );
            })}
          </div>
        </Panel>
      </div>
    </div>
  );
}
