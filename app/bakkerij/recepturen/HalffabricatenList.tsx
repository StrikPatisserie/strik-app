import type { Recipe } from "./types";
import {
  EmptyState,
  Panel,
  RecipeStatusBadge,
  SectionTitle,
} from "./RecepturenShared";
import {
  formatDate,
  formatEuro,
  linkedFinalProducts,
  quantityLabel,
} from "./utils";

export default function HalffabricatenList({
  recipes,
  onOpenRecipe,
  onCreateRecipe,
}: Readonly<{
  recipes: Recipe[];
  onOpenRecipe: (recipe: Recipe) => void;
  onCreateRecipe: () => void;
}>) {
  const semiFinished = recipes.filter((recipe) => recipe.type === "semiFinished");

  return (
    <Panel>
      <div className="grid gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <SectionTitle
            eyebrow="Basisrecepten"
            title="Halffabricaten"
            description="Losse recepten die als bouwstenen gekoppeld worden aan eindproducten."
          />
          <button
            type="button"
            onClick={onCreateRecipe}
            className="rounded-full bg-[#c3d3bc] px-4 py-2.5 text-sm font-black shadow-sm transition active:scale-[0.98]"
          >
            Nieuw halffabricaat
          </button>
        </div>

        {semiFinished.length ? (
          <div className="grid gap-3 lg:grid-cols-2">
            {semiFinished.map((recipe) => {
              const linkedProducts = linkedFinalProducts(recipes, recipe.id);
              const firstIngredient = recipe.ingredients[0];

              return (
                <button
                  key={recipe.id}
                  type="button"
                  onClick={() => onOpenRecipe(recipe)}
                  className="rounded-[1.15rem] border border-[#e7e0d8] bg-[#fffdf8] p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md active:scale-[0.99]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-lg font-black">{recipe.name}</p>
                      <p className="mt-1 text-xs font-bold text-[#2d2a26]/45">
                        {recipe.batchSize} · gewijzigd {formatDate(recipe.lastUpdated)}
                      </p>
                    </div>
                    <RecipeStatusBadge status={recipe.status} />
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <MiniMetric label="Kostprijs batch" value={formatEuro(recipe.costPrice)} />
                    <MiniMetric
                      label="Kostprijs per kg"
                      value={formatEuro(recipe.costPrice / Math.max(1, parseFloat(recipe.batchSize.replace(",", "."))))}
                    />
                    <MiniMetric
                      label="Gekoppeld"
                      value={`${linkedProducts.length} producten`}
                    />
                    <MiniMetric
                      label="Allergenen"
                      value={recipe.allergens.length ? recipe.allergens.join(", ") : "Geen"}
                    />
                  </div>
                  <div className="mt-4 rounded-2xl bg-white p-3">
                    <p className="text-xs font-black uppercase tracking-[0.12em] text-[#2d2a26]/40">
                      Basis
                    </p>
                    <p className="mt-1 text-sm font-bold text-[#2d2a26]/65">
                      {firstIngredient
                        ? `${quantityLabel(firstIngredient.quantity, firstIngredient.unit)} hoofdgrondstof`
                        : "Geen ingredienten"}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <EmptyState text="Nog geen halffabricaten beschikbaar." />
        )}
      </div>
    </Panel>
  );
}

function MiniMetric({
  label,
  value,
}: Readonly<{ label: string; value: string }>) {
  return (
    <div className="rounded-2xl bg-white p-3">
      <p className="text-[0.65rem] font-black uppercase tracking-[0.12em] text-[#2d2a26]/40">
        {label}
      </p>
      <p className="mt-1 truncate text-sm font-black">{value}</p>
    </div>
  );
}
