import type { Recipe } from "./types";
import { EmptyState, Panel, SectionTitle } from "./RecepturenShared";
import {
  formatDate,
  openProductionRequests,
  productionForecasts,
  productionNeedClass,
  productionNeedForRequest,
  productionNeedLabel,
  productionNeeds,
  salesPeriodLabel,
  type ProductionNeed,
} from "./utils";

export default function ProductionPlanningPanel({
  recipes,
  onOpenRecipe,
  onMarkProduced,
  compact = false,
}: Readonly<{
  recipes: Recipe[];
  onOpenRecipe?: (recipe: Recipe) => void;
  onMarkProduced?: (recipe: Recipe, quantity: number, requestId?: string) => void;
  compact?: boolean;
}>) {
  const needs = productionNeeds(recipes);
  const forecasts = productionForecasts(recipes);
  const plannedRequests = recipes
    .flatMap((recipe) =>
      openProductionRequests(recipe).map((request) =>
        productionNeedForRequest(recipe, request)
      )
    )
    .sort(
      (first, second) =>
        first.daysUntilProduction - second.daysUntilProduction ||
        first.recipe.name.localeCompare(second.recipe.name, "nl-NL")
    );
  const visibleNeeds = needs.slice(0, compact ? 4 : 8);

  if (compact) {
    return (
      <Panel className="border-[#ead7a6] bg-[#fff8e3]">
        <PlanningHeader
          actionCount={needs.length}
          description="Gebaseerd op gemiddelde verkoop, extra geplande batches en laatste productie."
        />

        {visibleNeeds.length ? (
          <div className="mt-4 grid gap-2">
            {visibleNeeds.map((need) => (
              <NeedRow
                key={needKey(need)}
                need={need}
                onOpenRecipe={onOpenRecipe}
                onMarkProduced={onMarkProduced}
              />
            ))}
          </div>
        ) : (
          <div className="mt-4">
            <EmptyState text="Geen producten die nu of binnenkort opnieuw gemaakt moeten worden." />
          </div>
        )}
      </Panel>
    );
  }

  return (
    <div className="grid gap-4">
      <Panel className="border-[#ead7a6] bg-[#fff8e3]">
        <PlanningHeader
          actionCount={needs.length}
          description="Een planningsoverzicht voor alle eindproducten: wat is er ongeveer over, wanneer is bijmaken nodig en welke extra batches staan handmatig gepland."
        />

        <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
          <div>
            <h3 className="text-base font-black">Weekplanning</h3>
            <p className="mt-1 text-xs font-bold text-[#2d2a26]/50">
              Nu, te laat of binnen 7 dagen.
            </p>
            <div className="mt-3 grid gap-2">
              {visibleNeeds.length ? (
                visibleNeeds.map((need) => (
                  <NeedRow
                    key={needKey(need)}
                    need={need}
                    onOpenRecipe={onOpenRecipe}
                    onMarkProduced={onMarkProduced}
                  />
                ))
              ) : (
                <EmptyState text="Geen productie voor deze week." />
              )}
            </div>
          </div>

          <div>
            <h3 className="text-base font-black">Prognosevoorraad</h3>
            <p className="mt-1 text-xs font-bold text-[#2d2a26]/50">
              Alle eindproducten met hun geschatte voorraad en volgende productiemoment.
            </p>
            <div className="mt-3 grid gap-2">
              {forecasts.length ? (
                forecasts.map((need) => (
                  <ForecastRow
                    key={need.recipe.id}
                    need={need}
                    onOpenRecipe={onOpenRecipe}
                    onMarkProduced={onMarkProduced}
                  />
                ))
              ) : (
                <EmptyState text="Nog geen eindproducten voor planning." />
              )}
            </div>
          </div>
        </div>
        {plannedRequests.length > 0 && (
          <div className="mt-4">
            <h3 className="text-base font-black">Extra geplande batches</h3>
            <p className="mt-1 text-xs font-bold text-[#2d2a26]/50">
              Handmatig ingepland, bijvoorbeeld door aanbieding of grote bestelling.
            </p>
            <div className="mt-3 grid gap-2 lg:grid-cols-2">
              {plannedRequests.map((need) => (
                <NeedRow
                  key={needKey(need)}
                  need={need}
                  onOpenRecipe={onOpenRecipe}
                  onMarkProduced={onMarkProduced}
                />
              ))}
            </div>
          </div>
        )}
      </Panel>
    </div>
  );
}

function PlanningHeader({
  actionCount,
  description,
}: Readonly<{ actionCount: number; description: string }>) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <SectionTitle
        eyebrow="Productieplanning"
        title="Voorraad en bijmaken"
        description={description}
      />
      <span className="rounded-full bg-white px-3 py-1.5 text-sm font-black text-[#7a5a18] shadow-sm">
        {actionCount} acties
      </span>
    </div>
  );
}

function NeedRow({
  need,
  onOpenRecipe,
  onMarkProduced,
}: Readonly<{
  need: ProductionNeed;
  onOpenRecipe?: (recipe: Recipe) => void;
  onMarkProduced?: (recipe: Recipe, quantity: number, requestId?: string) => void;
}>) {
  const batchQuantity =
    need.requestedQuantity ||
    need.recipe.standardBatchQuantity ||
    need.lastProducedQuantity ||
    1;

  return (
    <div className="grid gap-3 rounded-2xl border border-[#ead7a6] bg-white/82 p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
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
          {need.manualRequestId && (
            <span className="rounded-full bg-[#dce8d6] px-2.5 py-1 text-xs font-black text-[#45663b]">
              Extra
            </span>
          )}
        </div>
        <p className="mt-1 text-xs font-bold leading-snug text-[#2d2a26]/52">
          {need.manualRequestId
            ? `${need.requestReason || "Extra productie"} · ${quantityText(
                batchQuantity,
                need.recipe.standardBatchUnit
              )}`
            : `Nog ongeveer ${quantityText(
                need.estimatedRemainingQuantity,
                need.recipe.standardBatchUnit
              )} · gemiddeld ${need.averageSalesQuantity.toLocaleString(
                "nl-NL"
              )} per ${salesPeriodLabel(need.averageSalesPeriod)}`}
          {" · "}
          laatste productie{" "}
          {need.lastProducedAt ? formatDate(need.lastProducedAt) : "nog niet bekend"}
          {" · "}
          nodig {need.nextProductionDate ? formatDate(need.nextProductionDate) : "-"}
        </p>
      </button>

      {onMarkProduced && (
        <button
          type="button"
          onClick={() =>
            onMarkProduced(need.recipe, batchQuantity, need.manualRequestId)
          }
          className="rounded-full bg-[#c3d3bc] px-4 py-2.5 text-sm font-black shadow-sm"
        >
          Gemaakt
        </button>
      )}
    </div>
  );
}

function ForecastRow({
  need,
  onOpenRecipe,
  onMarkProduced,
}: Readonly<{
  need: ProductionNeed;
  onOpenRecipe?: (recipe: Recipe) => void;
  onMarkProduced?: (recipe: Recipe, quantity: number, requestId?: string) => void;
}>) {
  const batchQuantity =
    need.recipe.standardBatchQuantity || need.lastProducedQuantity || 1;
  const hasForecast = need.status !== "none";

  return (
    <div className="grid gap-3 rounded-2xl border border-[#e7e0d8] bg-white/86 p-3 md:grid-cols-[minmax(0,1fr)_10rem_auto] md:items-center">
      <button
        type="button"
        onClick={() => onOpenRecipe?.(need.recipe)}
        className="min-w-0 text-left"
      >
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-base font-black">{need.recipe.name}</p>
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-black ${productionNeedClass(
              need.status
            )}`}
          >
            {hasForecast ? productionNeedLabel(need) : "Geen tempo"}
          </span>
        </div>
        <p className="mt-1 text-xs font-bold leading-snug text-[#2d2a26]/50">
          {hasForecast
            ? `Gemiddeld ${need.averageSalesQuantity.toLocaleString(
                "nl-NL"
              )} per ${salesPeriodLabel(need.averageSalesPeriod)} · batch ${
                need.lastProducedQuantity || batchQuantity
              }`
            : "Vul gemiddelde verkoop in of registreer producties om prognose te starten."}
        </p>
      </button>

      <div className="rounded-2xl bg-[#f8f6f3] p-3">
        <p className="text-[0.62rem] font-black uppercase tracking-[0.12em] text-[#2d2a26]/45">
          Geschat over
        </p>
        <p className="mt-1 text-sm font-black">
          {hasForecast
            ? quantityText(need.estimatedRemainingQuantity, need.recipe.standardBatchUnit)
            : "-"}
        </p>
        <p className="mt-1 text-[0.68rem] font-bold text-[#2d2a26]/42">
          {need.nextProductionDate ? formatDate(need.nextProductionDate) : "Nog onbekend"}
        </p>
      </div>

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
}

function quantityText(value: number, unit?: string) {
  const label =
    unit === "stuk" || !unit
      ? "stuks"
      : unit === "gram"
        ? "g"
        : unit === "liter"
          ? "l"
          : unit;

  return `${value.toLocaleString("nl-NL", {
    maximumFractionDigits: value < 10 ? 1 : 0,
  })} ${label}`;
}

function needKey(need: ProductionNeed) {
  return `${need.recipe.id}-${need.manualRequestId || "forecast"}`;
}
