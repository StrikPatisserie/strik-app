import { useMemo, useState, type ReactNode } from "react";
import type { ProductionLogEntry, Recipe } from "./types";
import { EmptyState, Panel, SectionTitle } from "./RecepturenShared";
import {
  formatDate,
  openProductionRequests,
  productionLogForRecipe,
  productionForecasts,
  productionNeedClass,
  productionNeedForRequest,
  productionNeedLabel,
  productionNeeds,
  salesPeriodLabel,
  todayIsoDate,
  type ProductionNeed,
} from "./utils";

export default function ProductionPlanningPanel({
  recipes,
  onOpenRecipe,
  onMarkProduced,
  onAdjustStock,
  onUpdateProductionLog,
  onDeleteProductionLog,
  compact = false,
}: Readonly<{
  recipes: Recipe[];
  onOpenRecipe?: (recipe: Recipe) => void;
  onMarkProduced?: (
    recipe: Recipe,
    quantity: number,
    requestId?: string,
    date?: string
  ) => void;
  onAdjustStock?: (recipe: Recipe, quantity: number, date: string) => void;
  onUpdateProductionLog?: (
    recipe: Recipe,
    entryId: string,
    changes: { date?: string; quantity?: number; note?: string }
  ) => void;
  onDeleteProductionLog?: (recipe: Recipe, entryId: string) => void;
  compact?: boolean;
}>) {
  const [pendingProduction, setPendingProduction] = useState<{
    recipe: Recipe;
    quantity: number;
    requestId?: string;
  } | null>(null);
  const [pendingStock, setPendingStock] = useState<{
    recipe: Recipe;
    quantity: number;
  } | null>(null);
  const [editingLog, setEditingLog] = useState<{
    recipe: Recipe;
    entry: ProductionLogEntry;
  } | null>(null);
  const needs = productionNeeds(recipes);
  const forecasts = productionForecasts(recipes);
  const recentLogs = useMemo(
    () =>
      recipes
        .filter((recipe) => recipe.type === "finalProduct")
        .flatMap((recipe) =>
          productionLogForRecipe(recipe).map((entry) => ({ recipe, entry }))
        )
        .sort((first, second) => {
          const dateCompare = second.entry.date.localeCompare(first.entry.date);

          return (
            dateCompare ||
            first.recipe.name.localeCompare(second.recipe.name, "nl-NL")
          );
        })
        .slice(0, 24),
    [recipes]
  );
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
                onMarkProduced={
                  onMarkProduced
                    ? (recipe, quantity, requestId) =>
                        setPendingProduction({ recipe, quantity, requestId })
                    : undefined
                }
              />
            ))}
          </div>
        ) : (
          <div className="mt-4">
            <EmptyState text="Geen producten die nu of binnenkort opnieuw gemaakt moeten worden." />
          </div>
        )}
        {pendingProduction && onMarkProduced && (
          <ProductionDateDialog
            title="Productie opslaan"
            recipe={pendingProduction.recipe}
            quantity={pendingProduction.quantity}
            onCancel={() => setPendingProduction(null)}
            onConfirm={(date) => {
              onMarkProduced(
                pendingProduction.recipe,
                pendingProduction.quantity,
                pendingProduction.requestId,
                date
              );
              setPendingProduction(null);
            }}
          />
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
                    onMarkProduced={
                      onMarkProduced
                        ? (recipe, quantity, requestId) =>
                            setPendingProduction({ recipe, quantity, requestId })
                        : undefined
                    }
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
                    onMarkProduced={
                      onMarkProduced
                        ? (recipe, quantity, requestId) =>
                            setPendingProduction({ recipe, quantity, requestId })
                        : undefined
                    }
                    onAdjustStock={
                      onAdjustStock
                        ? (recipe, quantity) => setPendingStock({ recipe, quantity })
                        : undefined
                    }
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
                  onMarkProduced={
                    onMarkProduced
                      ? (recipe, quantity, requestId) =>
                          setPendingProduction({ recipe, quantity, requestId })
                      : undefined
                  }
                />
              ))}
            </div>
          </div>
        )}
        {recentLogs.length > 0 && (
          <div className="mt-4">
            <h3 className="text-base font-black">Productielogboek</h3>
            <p className="mt-1 text-xs font-bold text-[#2d2a26]/50">
              Laatste registraties. Hier kun je foutjes aanpassen of verwijderen.
            </p>
            <div className="mt-3 grid gap-2">
              {recentLogs.map(({ recipe, entry }) => (
                <div
                  key={`${recipe.id}-${entry.id}`}
                  className="grid gap-2 rounded-2xl border border-[#e7e0d8] bg-white/86 p-3 md:grid-cols-[minmax(0,1fr)_8rem_8rem_auto] md:items-center"
                >
                  <div>
                    <p className="text-sm font-black">{recipe.name}</p>
                    <p className="mt-1 text-xs font-bold text-[#2d2a26]/48">
                      {entry.note ||
                        (entry.source === "stock"
                          ? "Voorraadcorrectie"
                          : entry.source === "work"
                            ? "Werkmodus"
                            : "Handmatig")}
                    </p>
                  </div>
                  <p className="text-sm font-black">{formatDate(entry.date)}</p>
                  <p className="text-sm font-black">
                    {quantityText(entry.quantity, recipe.standardBatchUnit)}
                  </p>
                  <div className="flex flex-wrap gap-2 md:justify-end">
                    {onUpdateProductionLog && (
                      <button
                        type="button"
                        onClick={() => setEditingLog({ recipe, entry })}
                        className="rounded-full bg-[#f8f6f3] px-3 py-2 text-xs font-black shadow-sm"
                      >
                        Pas aan
                      </button>
                    )}
                    {onDeleteProductionLog && (
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm("Deze productieregistratie verwijderen?")) {
                            onDeleteProductionLog(recipe, entry.id);
                          }
                        }}
                        className="rounded-full bg-[#fff4f1] px-3 py-2 text-xs font-black text-[#a83e31]"
                      >
                        Verwijder
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Panel>
      {pendingProduction && onMarkProduced && (
        <ProductionDateDialog
          title="Productie opslaan"
          recipe={pendingProduction.recipe}
          quantity={pendingProduction.quantity}
          onCancel={() => setPendingProduction(null)}
          onConfirm={(date) => {
            onMarkProduced(
              pendingProduction.recipe,
              pendingProduction.quantity,
              pendingProduction.requestId,
              date
            );
            setPendingProduction(null);
          }}
        />
      )}
      {pendingStock && onAdjustStock && (
        <StockAdjustmentDialog
          recipe={pendingStock.recipe}
          quantity={pendingStock.quantity}
          onCancel={() => setPendingStock(null)}
          onConfirm={(quantity, date) => {
            onAdjustStock(pendingStock.recipe, quantity, date);
            setPendingStock(null);
          }}
        />
      )}
      {editingLog && onUpdateProductionLog && (
        <ProductionLogEditDialog
          recipe={editingLog.recipe}
          entry={editingLog.entry}
          onCancel={() => setEditingLog(null)}
          onSave={(changes) => {
            onUpdateProductionLog(editingLog.recipe, editingLog.entry.id, changes);
            setEditingLog(null);
          }}
        />
      )}
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
  onAdjustStock,
}: Readonly<{
  need: ProductionNeed;
  onOpenRecipe?: (recipe: Recipe) => void;
  onMarkProduced?: (recipe: Recipe, quantity: number, requestId?: string) => void;
  onAdjustStock?: (recipe: Recipe, quantity: number) => void;
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

      <div className="flex flex-wrap gap-2 md:justify-end">
        {onAdjustStock && (
          <button
            type="button"
            onClick={() =>
              onAdjustStock(need.recipe, need.estimatedRemainingQuantity)
            }
            className="rounded-full bg-white px-4 py-2.5 text-sm font-black shadow-sm"
          >
            Voorraad
          </button>
        )}
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
    </div>
  );
}

function ProductionDateDialog({
  title,
  recipe,
  quantity,
  onCancel,
  onConfirm,
}: Readonly<{
  title: string;
  recipe: Recipe;
  quantity: number;
  onCancel: () => void;
  onConfirm: (date: string) => void;
}>) {
  const [date, setDate] = useState(todayIsoDate());

  return (
    <PlanningDialog title={title} onCancel={onCancel}>
      <p className="text-sm font-bold text-[#2d2a26]/55">
        {recipe.name} wordt pas opgeslagen na datumcontrole.
      </p>
      <DateInput value={date} onChange={setDate} />
      <div className="rounded-2xl bg-[#f8f6f3] p-3">
        <p className="text-[0.62rem] font-black uppercase tracking-[0.12em] text-[#2d2a26]/45">
          Hoeveelheid
        </p>
        <p className="mt-1 text-lg font-black">
          {quantityText(quantity, recipe.standardBatchUnit)}
        </p>
      </div>
      <DialogActions onCancel={onCancel} onSave={() => onConfirm(date)} />
    </PlanningDialog>
  );
}

function StockAdjustmentDialog({
  recipe,
  quantity,
  onCancel,
  onConfirm,
}: Readonly<{
  recipe: Recipe;
  quantity: number;
  onCancel: () => void;
  onConfirm: (quantity: number, date: string) => void;
}>) {
  const [date, setDate] = useState(todayIsoDate());
  const [quantityValue, setQuantityValue] = useState(
    quantity ? String(quantity).replace(".", ",") : ""
  );

  return (
    <PlanningDialog title="Voorraad aanpassen" onCancel={onCancel}>
      <p className="text-sm font-bold text-[#2d2a26]/55">
        Vul in hoeveel er nu echt op voorraad is voor {recipe.name}.
      </p>
      <DateInput value={date} onChange={setDate} />
      <NumberInput
        label="Huidige voorraad"
        value={quantityValue}
        onChange={setQuantityValue}
      />
      <DialogActions
        onCancel={onCancel}
        onSave={() => onConfirm(parsePlanningNumber(quantityValue), date)}
      />
    </PlanningDialog>
  );
}

function ProductionLogEditDialog({
  recipe,
  entry,
  onCancel,
  onSave,
}: Readonly<{
  recipe: Recipe;
  entry: ProductionLogEntry;
  onCancel: () => void;
  onSave: (changes: { date: string; quantity: number; note: string }) => void;
}>) {
  const [date, setDate] = useState(entry.date || todayIsoDate());
  const [quantityValue, setQuantityValue] = useState(
    String(entry.quantity).replace(".", ",")
  );
  const [note, setNote] = useState(entry.note || "");

  return (
    <PlanningDialog title="Registratie aanpassen" onCancel={onCancel}>
      <p className="text-sm font-bold text-[#2d2a26]/55">{recipe.name}</p>
      <DateInput value={date} onChange={setDate} />
      <NumberInput label="Aantal" value={quantityValue} onChange={setQuantityValue} />
      <label className="block">
        <span className="text-[0.62rem] font-black uppercase tracking-[0.12em] text-[#2d2a26]/45">
          Notitie
        </span>
        <input
          value={note}
          onChange={(event) => setNote(event.target.value)}
          className="mt-1 w-full rounded-2xl border border-[#d8d0c4] bg-[#fffdf8] px-4 py-3 text-sm font-black outline-none focus:ring-2 focus:ring-[#8fb184]"
        />
      </label>
      <DialogActions
        onCancel={onCancel}
        onSave={() =>
          onSave({
            date,
            quantity: parsePlanningNumber(quantityValue),
            note,
          })
        }
      />
    </PlanningDialog>
  );
}

function PlanningDialog({
  title,
  onCancel,
  children,
}: Readonly<{
  title: string;
  onCancel: () => void;
  children: ReactNode;
}>) {
  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-[#2d2a26]/42 px-4 backdrop-blur-sm">
      <div className="grid w-full max-w-md gap-3 rounded-[1.4rem] border border-[#ded6ca] bg-white p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[0.68rem] font-black uppercase tracking-[0.14em] text-[#45663b]">
              Productieplanning
            </p>
            <h3 className="mt-1 text-2xl font-black">{title}</h3>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full bg-[#f8f6f3] px-3 py-2 text-xs font-black"
          >
            Sluit
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function DateInput({
  value,
  onChange,
}: Readonly<{ value: string; onChange: (value: string) => void }>) {
  return (
    <label className="block">
      <span className="text-[0.62rem] font-black uppercase tracking-[0.12em] text-[#2d2a26]/45">
        Datum
      </span>
      <input
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-2xl border border-[#d8d0c4] bg-[#fffdf8] px-4 py-3 text-sm font-black outline-none focus:ring-2 focus:ring-[#8fb184]"
      />
    </label>
  );
}

function NumberInput({
  label,
  value,
  onChange,
}: Readonly<{
  label: string;
  value: string;
  onChange: (value: string) => void;
}>) {
  return (
    <label className="block">
      <span className="text-[0.62rem] font-black uppercase tracking-[0.12em] text-[#2d2a26]/45">
        {label}
      </span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        inputMode="decimal"
        className="mt-1 w-full rounded-2xl border border-[#d8d0c4] bg-[#fffdf8] px-4 py-3 text-sm font-black outline-none focus:ring-2 focus:ring-[#8fb184]"
      />
    </label>
  );
}

function DialogActions({
  onCancel,
  onSave,
}: Readonly<{ onCancel: () => void; onSave: () => void }>) {
  return (
    <div className="flex flex-wrap justify-end gap-2">
      <button
        type="button"
        onClick={onCancel}
        className="rounded-full bg-[#f8f6f3] px-4 py-2.5 text-sm font-black text-[#2d2a26]/60"
      >
        Annuleer
      </button>
      <button
        type="button"
        onClick={onSave}
        className="rounded-full bg-[#c3d3bc] px-4 py-2.5 text-sm font-black shadow-sm"
      >
        Opslaan
      </button>
    </div>
  );
}

function parsePlanningNumber(value: string) {
  const number = Number.parseFloat(
    value.trim().replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, "")
  );

  return Number.isFinite(number) ? Math.max(0, number) : 0;
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
