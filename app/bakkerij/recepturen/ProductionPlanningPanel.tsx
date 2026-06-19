import { useMemo, useState, type ReactNode } from "react";
import type {
  ManualProductionPlanningItem,
  ProductionLogEntry,
  Recipe,
} from "./types";
import { EmptyState, Panel, SectionTitle } from "./RecepturenShared";
import {
  formatDate,
  normalizeSearch,
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

type WeekPlanningRow =
  | {
      type: "recipe";
      sortDate: string;
      sortTitle: string;
      need: ProductionNeed;
    }
  | {
      type: "manual";
      sortDate: string;
      sortTitle: string;
      item: ManualProductionPlanningItem;
    };

type ProductionHistoryRow = {
  id: string;
  date: string;
  title: string;
  quantity: number;
  unit?: string;
  note: string;
  label: string;
};

export default function ProductionPlanningPanel({
  recipes,
  manualPlanningItems = [],
  onOpenRecipe,
  onMarkProduced,
  onPlanProduction,
  onDeleteProductionRequest,
  onPlanManualProduction,
  onMarkManualPlanningItemDone,
  onDeleteManualPlanningItem,
  onAdjustStock,
  onUpdateProductionLog,
  onDeleteProductionLog,
  compact = false,
}: Readonly<{
  recipes: Recipe[];
  manualPlanningItems?: ManualProductionPlanningItem[];
  onOpenRecipe?: (recipe: Recipe) => void;
  onMarkProduced?: (
    recipe: Recipe,
    quantity: number,
    requestId?: string,
    date?: string
  ) => void;
  onPlanProduction?: (
    recipe: Recipe,
    quantity: number,
    date: string,
    reason?: string
  ) => void;
  onDeleteProductionRequest?: (recipe: Recipe, requestId: string) => void;
  onPlanManualProduction?: (
    title: string,
    quantity: number,
    unit: string,
    date: string,
    note?: string
  ) => void;
  onMarkManualPlanningItemDone?: (itemId: string) => void;
  onDeleteManualPlanningItem?: (itemId: string) => void;
  onAdjustStock?: (recipe: Recipe, quantity: number, date: string) => void;
  onUpdateProductionLog?: (
    recipe: Recipe,
    entryId: string,
    changes: { date?: string; quantity?: number; note?: string }
  ) => void;
  onDeleteProductionLog?: (recipe: Recipe, entryId: string) => void;
  compact?: boolean;
}>) {
  const [selectedWeek, setSelectedWeek] = useState(weekStartForDate());
  const [stockSearch, setStockSearch] = useState("");
  const [stockFilter, setStockFilter] = useState<"all" | "attention">("all");
  const [pendingProduction, setPendingProduction] = useState<{
    recipe: Recipe;
    quantity: number;
    requestId?: string;
  } | null>(null);
  const [pendingStock, setPendingStock] = useState<{
    recipe: Recipe;
    quantity: number;
  } | null>(null);
  const [manualProductionOpen, setManualProductionOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [editingLog, setEditingLog] = useState<{
    recipe: Recipe;
    entry: ProductionLogEntry;
  } | null>(null);
  const needs = productionNeeds(recipes);
  const forecasts = productionForecasts(recipes);
  const weekPlanningRows = useMemo<WeekPlanningRow[]>(
    () => {
      const recipeRows: WeekPlanningRow[] = [
        ...recipes.flatMap((recipe) =>
          openProductionRequests(recipe).map((request) =>
            productionNeedForRequest(recipe, request)
          )
        ),
        ...forecasts,
      ]
        .filter((need) => isDateInWeek(need.nextProductionDate, selectedWeek))
        .map((need) => ({
          type: "recipe" as const,
          sortDate: need.nextProductionDate || "",
          sortTitle: need.recipe.name,
          need,
        }));

      const manualRows: WeekPlanningRow[] = manualPlanningItems
        .filter(
          (item) => item.status !== "done" && isDateInWeek(item.date, selectedWeek)
        )
        .map((item) => ({
          type: "manual" as const,
          sortDate: item.date,
          sortTitle: item.title,
          item,
        }));

      return [...recipeRows, ...manualRows].sort(
        (first, second) =>
          first.sortDate.localeCompare(second.sortDate) ||
          first.sortTitle.localeCompare(second.sortTitle, "nl-NL")
      );
    },
    [forecasts, manualPlanningItems, recipes, selectedWeek]
  );
  const filteredForecasts = useMemo(() => {
    const query = normalizeSearch(stockSearch);

    return forecasts.filter((need) => {
      const matchesSearch =
        !query ||
        normalizeSearch(need.recipe.name).includes(query) ||
        normalizeSearch(need.recipe.productGroup).includes(query);
      const matchesFilter =
        stockFilter === "all" ||
        need.status === "overdue" ||
        need.status === "due" ||
        need.status === "soon";

      return matchesSearch && matchesFilter;
    });
  }, [forecasts, stockFilter, stockSearch]);
  const historyRows = useMemo<ProductionHistoryRow[]>(
    () => {
      const recipeRows = recipes.flatMap((recipe) =>
        productionLogForRecipe(recipe)
          .filter((entry) => isDateInWeek(entry.date, selectedWeek))
          .map((entry) => ({
            id: `${recipe.id}-${entry.id}`,
            date: entry.date,
            title: recipe.name,
            quantity: entry.quantity,
            unit: recipe.standardBatchUnit,
            note: entry.note || "",
            label: "Recept",
          }))
      );

      const manualRows = manualPlanningItems
        .filter(
          (item) =>
            item.status === "done" &&
            isDateInWeek(item.completedAt || item.date, selectedWeek)
        )
        .map((item) => ({
          id: item.id,
          date: item.completedAt || item.date,
          title: item.title,
          quantity: item.quantity,
          unit: item.unit,
          note: item.note,
          label: "Los product",
        }));

      return [...recipeRows, ...manualRows].sort(
        (first, second) =>
          first.date.localeCompare(second.date) ||
          first.title.localeCompare(second.title, "nl-NL")
      );
    },
    [manualPlanningItems, recipes, selectedWeek]
  );
  const compactNeeds = needs.slice(0, 4);

  if (compact) {
    return (
      <Panel className="border-[#ead7a6] bg-[#fff8e3]">
        <PlanningHeader
          actionCount={needs.length}
          description="Gebaseerd op gemiddelde verkoop, extra geplande batches en laatste productie."
        />

        {compactNeeds.length ? (
          <div className="mt-4 grid gap-2">
            {compactNeeds.map((need) => (
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
      <section className="grid gap-5 border border-[#c3d3bc] bg-white p-3 sm:p-4 lg:grid-cols-[minmax(17rem,0.78fr)_minmax(23rem,1.22fr)] lg:p-5">
        <div>
          <h3 className="text-lg font-black">Weekplanning</h3>
          <div className="mt-3 grid max-w-[22rem] grid-cols-[2.45rem_2.45rem_minmax(0,1fr)] border border-[#4b4b4b] bg-[#f5f5f3]">
            <button
              type="button"
              onClick={() => setSelectedWeek(addDays(selectedWeek, -7))}
              className="h-9 border-r border-[#4b4b4b] text-2xl font-light leading-none"
              aria-label="Vorige week"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={() => setSelectedWeek(addDays(selectedWeek, 7))}
              className="h-9 border-r border-[#4b4b4b] text-2xl font-light leading-none"
              aria-label="Volgende week"
            >
              ›
            </button>
            <div className="flex items-center justify-end px-3 text-xs font-light">
              {formatPlanningWeek(selectedWeek)}
            </div>
          </div>

          <div className="mt-0 max-w-[22rem] border-x border-b border-[#8c8c8c]">
            {weekPlanningRows.length ? (
              weekPlanningRows.map((row) =>
                row.type === "recipe" ? (
                  <PlanningListRow
                    key={needKey(row.need)}
                    need={row.need}
                    onOpenRecipe={onOpenRecipe}
                    onMarkProduced={
                      onMarkProduced
                        ? (recipe, quantity, requestId) =>
                            setPendingProduction({ recipe, quantity, requestId })
                        : undefined
                    }
                    onDeleteProductionRequest={onDeleteProductionRequest}
                  />
                ) : (
                  <ManualPlanningListRow
                    key={row.item.id}
                    item={row.item}
                    onMarkDone={onMarkManualPlanningItemDone}
                    onDelete={onDeleteManualPlanningItem}
                  />
                )
              )
            ) : (
              <p className="p-4 text-sm font-bold text-[#707070]">
                Geen productie voor deze week.
              </p>
            )}
          </div>

          <div className="mt-5 flex max-w-[22rem] gap-2">
            <button
              type="button"
              onClick={() => setManualProductionOpen(true)}
              disabled={!onPlanProduction && !onPlanManualProduction}
              className="grid h-10 flex-1 grid-cols-[3rem_minmax(0,1fr)] items-center border border-[#c3d3bc] bg-white text-left text-sm font-black disabled:opacity-45"
            >
              <span className="flex h-full items-center justify-center bg-[#c3d3bc] text-3xl font-light">
                +
              </span>
              <span className="px-4">handmatig toevoegen</span>
            </button>
            <button
              type="button"
              onClick={() => setHistoryOpen(true)}
              className="h-10 rounded-full bg-[#f8f6f3] px-4 text-xs font-black text-[#2d2a26]/72 shadow-sm"
            >
              geschiedenis
            </button>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-black">Huidige voorraad</h3>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <label className="grid h-9 grid-cols-[2.5rem_minmax(0,1fr)] items-center rounded-full border-2 border-[#111111] bg-white">
              <span className="text-center text-2xl leading-none">⌕</span>
              <input
                value={stockSearch}
                onChange={(event) => setStockSearch(event.target.value)}
                placeholder="zoek"
                className="min-w-0 bg-transparent pr-3 text-sm font-light outline-none placeholder:text-[#9a9a9a]"
              />
            </label>
            <button
              type="button"
              onClick={() =>
                setStockFilter((current) =>
                  current === "all" ? "attention" : "all"
                )
              }
              className="flex h-9 items-center gap-3 rounded-full border-2 border-[#111111] bg-white px-5 text-sm font-light"
            >
              filter
              <span className="text-2xl leading-none">⌄</span>
            </button>
          </div>

          <div className="mt-3 max-h-[30rem] overflow-y-auto border border-[#8c8c8c] bg-white p-3">
            <div className="grid grid-cols-[minmax(0,1fr)_5rem_6rem] gap-3 border-b border-[#8c8c8c] pb-2 text-sm italic text-[#9a9a9a]">
              <span>product</span>
              <span className="text-right">voorraad</span>
              <span className="text-right">laatste prod.</span>
            </div>
            {filteredForecasts.length ? (
              filteredForecasts.map((need) => (
                <InventoryListRow
                  key={need.recipe.id}
                  need={need}
                  onOpenRecipe={onOpenRecipe}
                  onAdjustStock={
                    onAdjustStock
                      ? (recipe, quantity) => setPendingStock({ recipe, quantity })
                      : undefined
                  }
                />
              ))
            ) : (
              <p className="p-4 text-sm font-bold text-[#707070]">
                Geen voorraadregels gevonden.
              </p>
            )}
          </div>
        </div>
      </section>
      {manualProductionOpen && (onPlanProduction || onPlanManualProduction) && (
        <ManualProductionDialog
          recipes={recipes}
          defaultDate={selectedWeek}
          onCancel={() => setManualProductionOpen(false)}
          onConfirmRecipe={(recipe, quantity, date, reason) => {
            if (!onPlanProduction) return;
            onPlanProduction(recipe, quantity, date, reason);
            setSelectedWeek(weekStartForDate(dateFromKey(date)));
            setManualProductionOpen(false);
          }}
          onConfirmManual={(title, quantity, unit, date, note) => {
            if (!onPlanManualProduction) return;
            onPlanManualProduction(title, quantity, unit, date, note);
            setSelectedWeek(weekStartForDate(dateFromKey(date)));
            setManualProductionOpen(false);
          }}
        />
      )}
      {historyOpen && (
        <ProductionHistoryDialog
          weekStart={selectedWeek}
          rows={historyRows}
          onPreviousWeek={() => setSelectedWeek(addDays(selectedWeek, -7))}
          onNextWeek={() => setSelectedWeek(addDays(selectedWeek, 7))}
          onCancel={() => setHistoryOpen(false)}
        />
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

function ManualProductionDialog({
  recipes,
  defaultDate,
  onCancel,
  onConfirmRecipe,
  onConfirmManual,
}: Readonly<{
  recipes: Recipe[];
  defaultDate: string;
  onCancel: () => void;
  onConfirmRecipe: (
    recipe: Recipe,
    quantity: number,
    date: string,
    reason: string
  ) => void;
  onConfirmManual: (
    title: string,
    quantity: number,
    unit: string,
    date: string,
    note: string
  ) => void;
}>) {
  const availableRecipes = recipes
    .filter((recipe) => recipe.status !== "old")
    .sort((first, second) => first.name.localeCompare(second.name, "nl-NL"));
  const [mode, setMode] = useState<"recipe" | "manual">("recipe");
  const [recipeId, setRecipeId] = useState(availableRecipes[0]?.id || "");
  const [date, setDate] = useState(defaultDate || todayIsoDate());
  const [manualTitle, setManualTitle] = useState("");
  const [quantityValue, setQuantityValue] = useState("");
  const [manualUnit, setManualUnit] = useState("stuks");
  const [reason, setReason] = useState("");
  const selectedRecipe =
    availableRecipes.find((recipe) => recipe.id === recipeId) ||
    availableRecipes[0];
  const fallbackQuantity =
    selectedRecipe?.standardBatchQuantity ||
    selectedRecipe?.lastProducedQuantity ||
    1;
  const quantity = parsePlanningNumber(quantityValue) || fallbackQuantity;

  return (
    <PlanningDialog title="Handmatig toevoegen" onCancel={onCancel}>
      <div className="grid grid-cols-2 rounded-full bg-[#f8f6f3] p-1">
        {[
          { id: "recipe" as const, label: "Recept" },
          { id: "manual" as const, label: "Los product" },
        ].map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              setMode(item.id);
              setQuantityValue("");
            }}
            className={`rounded-full px-4 py-2 text-sm font-black ${
              mode === item.id
                ? "bg-[#f2533d] text-white shadow-sm"
                : "text-[#2d2a26]/55"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
      {mode === "recipe" ? (
        <label className="block">
          <span className="text-[0.62rem] font-black uppercase tracking-[0.12em] text-[#2d2a26]/45">
            Recept
          </span>
          <select
            value={selectedRecipe?.id || ""}
            onChange={(event) => {
              setRecipeId(event.target.value);
              setQuantityValue("");
            }}
            className="mt-1 w-full rounded-2xl border border-[#d8d0c4] bg-[#fffdf8] px-4 py-3 text-sm font-black outline-none focus:ring-2 focus:ring-[#8fb184]"
          >
            {availableRecipes.map((recipe) => (
              <option key={recipe.id} value={recipe.id}>
                {recipe.name}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_7rem]">
          <label className="block">
            <span className="text-[0.62rem] font-black uppercase tracking-[0.12em] text-[#2d2a26]/45">
              Product
            </span>
            <input
              value={manualTitle}
              onChange={(event) => setManualTitle(event.target.value)}
              placeholder="Koningsdag chocolaatjes"
              className="mt-1 w-full rounded-2xl border border-[#d8d0c4] bg-[#fffdf8] px-4 py-3 text-sm font-black outline-none focus:ring-2 focus:ring-[#8fb184]"
            />
          </label>
          <label className="block">
            <span className="text-[0.62rem] font-black uppercase tracking-[0.12em] text-[#2d2a26]/45">
              Eenheid
            </span>
            <input
              value={manualUnit}
              onChange={(event) => setManualUnit(event.target.value)}
              className="mt-1 w-full rounded-2xl border border-[#d8d0c4] bg-[#fffdf8] px-4 py-3 text-sm font-black outline-none focus:ring-2 focus:ring-[#8fb184]"
            />
          </label>
        </div>
      )}
      <DateInput value={date} onChange={setDate} />
      <NumberInput
        label="Hoeveelheid"
        value={quantityValue}
        onChange={setQuantityValue}
      />
      <label className="block">
        <span className="text-[0.62rem] font-black uppercase tracking-[0.12em] text-[#2d2a26]/45">
          Notitie
        </span>
        <input
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Bijv. aanbieding, bestelling of voorraad"
          className="mt-1 w-full rounded-2xl border border-[#d8d0c4] bg-[#fffdf8] px-4 py-3 text-sm font-black outline-none focus:ring-2 focus:ring-[#8fb184]"
        />
      </label>
      {mode === "recipe" && selectedRecipe && (
        <p className="rounded-2xl bg-[#f8f6f3] p-3 text-sm font-black text-[#2d2a26]/65">
          Wordt opgeslagen als {quantityText(quantity, selectedRecipe.standardBatchUnit)}.
        </p>
      )}
      {mode === "manual" && manualTitle.trim() && (
        <p className="rounded-2xl bg-[#f8f6f3] p-3 text-sm font-black text-[#2d2a26]/65">
          Wordt opgeslagen als {quantityText(quantity, manualUnit)} voor{" "}
          {manualTitle.trim()}.
        </p>
      )}
      <DialogActions
        onCancel={onCancel}
        onSave={() => {
          if (mode === "manual") {
            if (!manualTitle.trim()) return;
            onConfirmManual(manualTitle, quantity || 1, manualUnit, date, reason);
            return;
          }

          if (!selectedRecipe) return;
          onConfirmRecipe(selectedRecipe, quantity, date, reason);
        }}
      />
    </PlanningDialog>
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

function PlanningListRow({
  need,
  onOpenRecipe,
  onMarkProduced,
  onDeleteProductionRequest,
}: Readonly<{
  need: ProductionNeed;
  onOpenRecipe?: (recipe: Recipe) => void;
  onMarkProduced?: (recipe: Recipe, quantity: number, requestId?: string) => void;
  onDeleteProductionRequest?: (recipe: Recipe, requestId: string) => void;
}>) {
  const batchQuantity =
    need.requestedQuantity ||
    need.recipe.standardBatchQuantity ||
    need.lastProducedQuantity ||
    1;
  const manualRequestId = need.manualRequestId;

  return (
    <div className="grid min-h-[2.75rem] grid-cols-[2.3rem_minmax(0,1fr)_4.9rem] border-b border-[#8c8c8c] last:border-b-0">
      <span className={planningStripeClass(need.recipe)} />
      <button
        type="button"
        onClick={() => onOpenRecipe?.(need.recipe)}
        className="min-w-0 px-3 py-1 text-left"
      >
        <span className="block truncate text-[clamp(0.95rem,1.65vw,1.2rem)] font-light">
          {need.recipe.name}
        </span>
        <span className="block truncate text-[0.62rem] font-black uppercase tracking-[0.08em] text-[#707070]">
          {need.requestReason || productionNeedLabel(need)} ·{" "}
          {quantityText(batchQuantity, need.recipe.standardBatchUnit)}
        </span>
      </button>
      <div className="flex items-center justify-center gap-1 px-1">
        <button
          type="button"
          onClick={() =>
            onMarkProduced?.(need.recipe, batchQuantity, need.manualRequestId)
          }
          className="flex h-7 w-7 items-center justify-center rounded-full bg-[#c3d3bc] text-sm font-black leading-none text-[#1f2d1a]"
          aria-label={`${need.recipe.name} als gemaakt opslaan`}
          title="Markeer als gemaakt"
        >
          ✓
        </button>
        {manualRequestId && onDeleteProductionRequest && (
          <button
            type="button"
            onClick={() =>
              onDeleteProductionRequest(need.recipe, manualRequestId)
            }
            className="flex h-7 w-7 items-center justify-center rounded-full bg-[#fff4f1] text-sm font-black leading-none text-[#a83e31]"
            aria-label={`${need.recipe.name} uit planning verwijderen`}
            title="Uit planning verwijderen"
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
}

function ManualPlanningListRow({
  item,
  onMarkDone,
  onDelete,
}: Readonly<{
  item: ManualProductionPlanningItem;
  onMarkDone?: (itemId: string) => void;
  onDelete?: (itemId: string) => void;
}>) {
  return (
    <div className="grid min-h-[2.75rem] grid-cols-[2.3rem_minmax(0,1fr)_4.9rem] border-b border-[#8c8c8c] last:border-b-0">
      <span className="bg-[#f3d48d]" />
      <div className="min-w-0 px-3 py-1 text-left">
        <span className="block truncate text-[clamp(0.95rem,1.65vw,1.2rem)] font-light">
          {item.title}
        </span>
        <span className="block truncate text-[0.62rem] font-black uppercase tracking-[0.08em] text-[#707070]">
          {item.note || "Los product"} · {quantityText(item.quantity, item.unit)} ·{" "}
          {formatDate(item.date)}
        </span>
      </div>
      <div className="flex items-center justify-center gap-1 px-1">
        <button
          type="button"
          onClick={() => onMarkDone?.(item.id)}
          className="flex h-7 w-7 items-center justify-center rounded-full bg-[#c3d3bc] text-sm font-black leading-none text-[#1f2d1a]"
          aria-label={`${item.title} als gemaakt markeren`}
          title="Markeer als gemaakt"
        >
          ✓
        </button>
        <button
          type="button"
          onClick={() => onDelete?.(item.id)}
          className="flex h-7 w-7 items-center justify-center rounded-full bg-[#fff4f1] text-sm font-black leading-none text-[#a83e31]"
          aria-label={`${item.title} uit planning verwijderen`}
          title="Uit planning verwijderen"
        >
          ×
        </button>
      </div>
    </div>
  );
}

function InventoryListRow({
  need,
  onOpenRecipe,
  onAdjustStock,
}: Readonly<{
  need: ProductionNeed;
  onOpenRecipe?: (recipe: Recipe) => void;
  onAdjustStock?: (recipe: Recipe, quantity: number) => void;
}>) {
  const attention =
    need.status === "overdue" || need.status === "due" || need.status === "soon";
  const lastProduction = need.lastProducedAt
    ? `week ${weekNumberForDate(need.lastProducedAt)}`
    : "-";

  return (
    <div
      className={`grid grid-cols-[minmax(0,1fr)_5rem_6rem] gap-3 border-b border-[#8c8c8c] py-1.5 text-base last:border-b-0 ${
        attention ? "text-[#d75a48]" : "text-[#111111]"
      }`}
    >
      <button
        type="button"
        onClick={() => onOpenRecipe?.(need.recipe)}
        className="truncate text-left font-light"
      >
        {need.recipe.name}
      </button>
      <button
        type="button"
        onClick={() =>
          onAdjustStock?.(need.recipe, need.estimatedRemainingQuantity)
        }
        className="text-right font-light italic"
      >
        {quantityText(need.estimatedRemainingQuantity, need.recipe.standardBatchUnit)}
      </button>
      <button
        type="button"
        onClick={() =>
          onAdjustStock?.(need.recipe, need.estimatedRemainingQuantity)
        }
        className="text-right font-light italic text-[#9a9a9a]"
      >
        {lastProduction}
      </button>
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

function ProductionHistoryDialog({
  weekStart,
  rows,
  onPreviousWeek,
  onNextWeek,
  onCancel,
}: Readonly<{
  weekStart: string;
  rows: ProductionHistoryRow[];
  onPreviousWeek: () => void;
  onNextWeek: () => void;
  onCancel: () => void;
}>) {
  return (
    <PlanningDialog title="Geschiedenis" onCancel={onCancel}>
      <div className="grid grid-cols-[2.5rem_minmax(0,1fr)_2.5rem] items-center rounded-2xl border border-[#d8d0c4] bg-[#fffdf8]">
        <button
          type="button"
          onClick={onPreviousWeek}
          className="h-10 border-r border-[#d8d0c4] text-2xl font-light"
          aria-label="Week eerder"
        >
          ‹
        </button>
        <p className="px-3 text-center text-xs font-black uppercase tracking-[0.08em] text-[#2d2a26]/62">
          {formatPlanningWeek(weekStart)}
        </p>
        <button
          type="button"
          onClick={onNextWeek}
          className="h-10 border-l border-[#d8d0c4] text-2xl font-light"
          aria-label="Week verder"
        >
          ›
        </button>
      </div>
      <div className="max-h-[22rem] overflow-y-auto rounded-2xl border border-[#e7e0d8] bg-white">
        {rows.length ? (
          rows.map((row) => (
            <div
              key={row.id}
              className="grid grid-cols-[4.2rem_minmax(0,1fr)_4.8rem] gap-2 border-b border-[#eee7dd] px-3 py-2 last:border-b-0"
            >
              <span className="text-xs font-black text-[#8c8c8c]">
                {formatDate(row.date)}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-black">
                  {row.title}
                </span>
                <span className="block truncate text-[0.68rem] font-bold text-[#2d2a26]/48">
                  {row.label}
                  {row.note ? ` · ${row.note}` : ""}
                </span>
              </span>
              <span className="text-right text-xs font-black">
                {quantityText(row.quantity, row.unit)}
              </span>
            </div>
          ))
        ) : (
          <p className="p-4 text-sm font-bold text-[#707070]">
            Nog niets geproduceerd in deze week.
          </p>
        )}
      </div>
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
  return `${need.recipe.id}-${need.manualRequestId || "forecast"}-${
    need.nextProductionDate || ""
  }`;
}

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(date.getDate()).padStart(2, "0")}`;
}

function dateFromKey(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return new Date();

  return new Date(year, month - 1, day);
}

function addDays(value: string, days: number) {
  const date = dateFromKey(value);
  date.setDate(date.getDate() + days);

  return dateKey(date);
}

function weekStartForDate(date = new Date()) {
  const nextDate = new Date(date);
  const day = nextDate.getDay() || 7;
  nextDate.setHours(0, 0, 0, 0);
  nextDate.setDate(nextDate.getDate() - day + 1);

  return dateKey(nextDate);
}

function isDateInWeek(value: string | undefined, weekStart: string) {
  if (!value) return false;

  return value >= weekStart && value <= addDays(weekStart, 6);
}

function weekNumberForDate(value: string) {
  const date = dateFromKey(value);
  const target = new Date(date.valueOf());
  const dayNumber = (date.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNumber + 3);
  const firstThursday = new Date(target.getFullYear(), 0, 4);
  const firstDayNumber = (firstThursday.getDay() + 6) % 7;
  firstThursday.setDate(firstThursday.getDate() - firstDayNumber + 3);

  return (
    1 +
    Math.round(
      (target.getTime() - firstThursday.getTime()) / (7 * 24 * 60 * 60 * 1000)
    )
  );
}

function formatPlanningWeek(weekStart: string) {
  const start = dateFromKey(weekStart);
  const end = dateFromKey(addDays(weekStart, 6));
  const formatter = new Intl.DateTimeFormat("nl-NL", {
    day: "numeric",
    month: "long",
  });

  return `week ${weekNumberForDate(weekStart)} - ${formatter.format(start)} t/m ${formatter.format(end)}`;
}

function planningStripeClass(recipe: Recipe) {
  const group = normalizeSearch(recipe.productGroup);
  if (group.includes("ijs")) return "bg-[#9ccfdd]";
  if (group.includes("taart")) return "bg-[#e9cadd]";

  return "bg-[#c3d3bc]";
}
