import type { Recipe } from "./types";
import { EmptyState, Panel, SectionTitle } from "./RecepturenShared";
import {
  formatDate,
  productionNeedClass,
  productionNeedLabel,
  productionNeeds,
  salesPeriodLabel,
} from "./utils";

export default function ProductionPlanningPanel({
  recipes,
  onOpenRecipe,
  onMarkProduced,
  compact = false,
}: Readonly<{
  recipes: Recipe[];
  onOpenRecipe?: (recipe: Recipe) => void;
  onMarkProduced?: (recipe: Recipe, quantity: number) => void;
  compact?: boolean;
}>) {
  const needs = productionNeeds(recipes);

  return (
    <Panel className="border-[#ead7a6] bg-[#fff8e3]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <SectionTitle
          eyebrow="Productieplanning"
          title="Producten die geproduceerd moeten worden"
          description={
            compact
              ? "Gebaseerd op gemiddelde verkoop en laatste productie."
              : "Hardlopers komen hier automatisch terug zodra de laatste batch waarschijnlijk bijna op is."
          }
        />
        <span className="rounded-full bg-white px-3 py-1.5 text-sm font-black text-[#7a5a18] shadow-sm">
          {needs.length} acties
        </span>
      </div>

      {needs.length ? (
        <div className="mt-4 grid gap-2">
          {needs.slice(0, compact ? 4 : 8).map((need) => {
            const batchQuantity =
              need.recipe.standardBatchQuantity || need.lastProducedQuantity || 1;

            return (
              <div
                key={need.recipe.id}
                className="grid gap-3 rounded-2xl border border-[#ead7a6] bg-white/82 p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
              >
                <button
                  type="button"
                  onClick={() => onOpenRecipe?.(need.recipe)}
                  className="min-w-0 text-left"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-base font-black leading-tight">
                      {need.recipe.name}
                    </p>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-black ${productionNeedClass(
                        need.status
                      )}`}
                    >
                      {productionNeedLabel(need)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs font-bold leading-snug text-[#2d2a26]/52">
                    Gemiddeld {need.averageSalesQuantity.toLocaleString("nl-NL")} per{" "}
                    {salesPeriodLabel(need.averageSalesPeriod)} · leert mee · laatste productie{" "}
                    {need.lastProducedAt ? formatDate(need.lastProducedAt) : "nog niet bekend"} ·
                    verwacht nodig {need.nextProductionDate ? formatDate(need.nextProductionDate) : "-"}
                  </p>
                </button>

                {onMarkProduced && (
                  <button
                    type="button"
                    onClick={() => onMarkProduced(need.recipe, batchQuantity)}
                    className="rounded-full bg-[#c3d3bc] px-4 py-2.5 text-sm font-black shadow-sm"
                  >
                    Gemaakt
                  </button>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="mt-4">
          <EmptyState text="Geen producten die nu of binnenkort opnieuw gemaakt moeten worden." />
        </div>
      )}
    </Panel>
  );
}
