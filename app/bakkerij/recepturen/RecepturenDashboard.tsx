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
  compact = false,
}: Readonly<{
  recipes: Recipe[];
  ingredients: Ingredient[];
  invoice: InvoiceImport;
  compact?: boolean;
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
  const pendingInvoiceLines = invoice.lines.filter(
    (line) => line.reviewStatus === "pending"
  ).length;
  const newInvoiceArticles = invoice.lines.filter(
    (line) => !line.matchedIngredientId
  ).length;

  if (compact) {
    return (
      <section className="rounded-lg border border-[#e8e4de] bg-white/90 p-3 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[0.65rem] font-black uppercase tracking-[0.16em] text-[#8b8278]">
              Dashboard
            </p>
            <h2 className="mt-1 text-lg font-black leading-tight text-[#1a1815]">
              Recepturen in het kort
            </h2>
          </div>
          <div className="rounded-lg border border-[#e8e4de] bg-[#faf8f5] px-3 py-2 text-right text-xs font-black text-[#2d2a26]">
            {invoice.invoiceNumber}
            <span className="block text-[0.65rem] text-[#2d2a26]/45">
              {formatDate(invoice.invoiceDate)}
            </span>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
          <CompactMetric label="Eindproducten" value={finalProducts.length} />
          <CompactMetric label="Onder marge" value={underMargin.length} tone="critical" />
          <CompactMetric label="Prijsupdates" value={pendingInvoiceLines} tone="pressure" />
          <CompactMetric label="Nieuwe artikelen" value={newInvoiceArticles} />
        </div>

        <div className="mt-3 grid gap-2 lg:grid-cols-2">
          <CompactChangeList
            title="Grootste grondstofstijgingen"
            items={biggestIngredientChanges.slice(0, 3).map((ingredient) => ({
              id: ingredient.id,
              title: ingredient.name,
              detail: ingredient.supplier,
              value: ingredientPriceChange(ingredient),
            }))}
          />
          <CompactChangeList
            title="Grootste kostprijsstijgingen"
            items={biggestRecipeChanges.slice(0, 3).map((recipe) => ({
              id: recipe.id,
              title: recipe.name,
              detail: recipe.productGroup,
              value: recipeCostChange(recipe),
              marginStatus: marginStatusForRecipe(recipe),
            }))}
          />
        </div>
      </section>
    );
  }

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
          value={pendingInvoiceLines}
          detail="Regels wachten op goedkeuring"
          tone="pressure"
        />
        <MetricCard
          label="Nieuwe artikelen"
          value={newInvoiceArticles}
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

function CompactMetric({
  label,
  value,
  tone = "neutral",
}: Readonly<{
  label: string;
  value: string | number;
  tone?: "neutral" | "pressure" | "critical";
}>) {
  const toneClass =
    tone === "critical"
      ? "border-[#fee2e2] bg-[#fff6f4] text-[#a83e31]"
      : tone === "pressure"
        ? "border-[#f3d4a4] bg-[#fffaf1] text-[#7a5a18]"
        : "border-[#dbe9ee] bg-[#f4f9fb] text-[#1a1815]";

  return (
    <div className={`rounded-lg border px-3 py-2 ${toneClass}`}>
      <p className="text-[0.58rem] font-black uppercase tracking-[0.12em] opacity-60">
        {label}
      </p>
      <p className="mt-1 text-xl font-black leading-none">{value}</p>
    </div>
  );
}

function CompactChangeList({
  title,
  items,
}: Readonly<{
  title: string;
  items: Array<{
    id: string;
    title: string;
    detail: string;
    value: number;
    marginStatus?: ReturnType<typeof marginStatusForRecipe>;
  }>;
}>) {
  return (
    <div className="rounded-lg border border-[#e8e4de] bg-[#fffdf8] p-3">
      <p className="text-[0.65rem] font-black uppercase tracking-[0.14em] text-[#8b8278]">
        {title}
      </p>
      <div className="mt-2 grid gap-1.5">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between gap-2 rounded-md bg-[#faf8f5] px-2.5 py-2"
          >
            <div className="min-w-0">
              <p className="truncate text-xs font-black leading-tight text-[#1a1815]">
                {item.title}
              </p>
              <p className="truncate text-[0.65rem] font-bold text-[#2d2a26]/45">
                {item.detail}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <span
                className={`rounded-full px-2 py-0.5 text-[0.65rem] font-black ${changeBadgeClass(
                  item.value
                )}`}
              >
                {formatSignedPercent(item.value, 1)}
              </span>
              {item.marginStatus && <MarginBadge status={item.marginStatus} />}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
