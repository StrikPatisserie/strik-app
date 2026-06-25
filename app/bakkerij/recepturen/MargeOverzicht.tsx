import { useMemo, useState } from "react";
import type { Recipe } from "./types";
import { EmptyState, FilterSelect } from "./RecepturenShared";
import {
  formatEuro,
  formatPercent,
  formatSignedPercent,
  marginStatusForRecipe,
  normalizeSearch,
  recipeCostChange,
  recipeCurrentMargin,
  recipeCostDelta,
  targetSalesPrice,
} from "./utils";

export default function MargeOverzicht({
  recipes,
  onOpenRecipe,
}: Readonly<{
  recipes: Recipe[];
  onOpenRecipe: (recipe: Recipe) => void;
}>) {
  const [riskFilter, setRiskFilter] = useState("all");
  const [groupFilter, setGroupFilter] = useState("all");
  const [supplierImpact, setSupplierImpact] = useState("all");
  const finalProductRecipes = useMemo(
    () => recipes.filter((recipe) => recipe.type === "finalProduct"),
    [recipes]
  );
  const groupOptions = useMemo(
    () => {
      const groups = new Map<string, string>();

      finalProductRecipes.forEach((recipe) => {
        const label = recipe.productGroup.trim();
        const value = normalizeSearch(label);
        if (!value || groups.has(value)) return;

        groups.set(value, label);
      });

      return Array.from(groups, ([value, label]) => ({ value, label })).sort(
        (first, second) => first.label.localeCompare(second.label, "nl-NL")
      );
    },
    [finalProductRecipes]
  );

  const filteredRecipes = useMemo(
    () =>
      finalProductRecipes.filter((recipe) => {
        const matchesRisk =
          riskFilter === "all" ||
          (riskFilter === "under" && marginStatusForRecipe(recipe) !== "good") ||
          (riskFilter === "increase" && recipe.costPrice > recipe.previousCostPrice);
        const matchesGroup =
          groupFilter === "all" ||
          normalizeSearch(recipe.productGroup) === groupFilter;
        const matchesSupplier =
          supplierImpact === "all" ||
          causeForRecipe(recipe).toLocaleLowerCase("nl-NL").includes(
            supplierImpact.toLocaleLowerCase("nl-NL")
          );

        return matchesRisk && matchesGroup && matchesSupplier;
      }),
    [finalProductRecipes, groupFilter, riskFilter, supplierImpact]
  );
  const printRows = useMemo(
    () => filteredRecipes.map((recipe) => createMarginPrintRow(recipe)),
    [filteredRecipes]
  );

  function printMarginOverview() {
    const printWindow = window.open("", "_blank", "width=1100,height=800");
    if (!printWindow) return;

    printWindow.document.write(
      createMarginPrintHtml({
        filters: [
          selectedOptionLabel(riskOptions, riskFilter),
          selectedOptionLabel([{ value: "all", label: "Alle groepen" }, ...groupOptions], groupFilter),
          selectedOptionLabel(causeOptions, supplierImpact),
        ],
        rows: printRows,
        totalCount: finalProductRecipes.length,
      })
    );
    printWindow.document.close();
    printWindow.focus();
    window.setTimeout(() => printWindow.print(), 150);
  }

  return (
    <section className="grid min-h-[calc(100dvh-13rem)] grid-rows-[auto_auto_minmax(0,1fr)] gap-3 border border-[#c3d3bc] bg-white p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#8c8c8c]">
            Marge
          </p>
          <h2 className="text-xl font-black">Marge eindproducten</h2>
          <p className="mt-1 max-w-2xl text-xs font-bold leading-relaxed text-[#707070]">
            Verkoopprijzen zijn incl. 9% btw. Kostprijzen en marges rekenen ex btw.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs font-bold text-[#707070]">
            {filteredRecipes.length} van {finalProductRecipes.length} eindproducten
          </p>
          <button
            type="button"
            onClick={printMarginOverview}
            className="rounded-full border border-[#c3d3bc] bg-[#ecf4ed] px-4 py-2 text-xs font-black text-[#30462f] shadow-sm hover:bg-[#dce8d6]"
          >
            Print
          </button>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <FilterSelect
          label="Risico"
          value={riskFilter}
          onChange={setRiskFilter}
          options={riskOptions}
        />
        <FilterSelect
          label="Productgroep"
          value={groupFilter}
          onChange={setGroupFilter}
          options={[
            { value: "all", label: "Alle groepen" },
            ...groupOptions,
          ]}
        />
        <FilterSelect
          label="Oorzaak"
          value={supplierImpact}
          onChange={setSupplierImpact}
          options={causeOptions}
        />
      </div>

      {filteredRecipes.length ? (
        <div className="min-h-0 overflow-auto border border-[#d8d8d4]">
          <div className="min-w-[42rem]">
            <div className="grid grid-cols-[minmax(12rem,1.35fr)_6rem_6rem_6rem_6rem_minmax(8rem,1fr)] gap-3 border-b border-[#d8d8d4] bg-[#f5f5f3] px-3 py-2 text-[0.68rem] font-black uppercase tracking-[0.12em] text-[#8c8c8c]">
              <span>Product</span>
              <span>Kost ex.</span>
              <span>Verkoop incl.</span>
              <span>Marge ex.</span>
              <span>Advies incl.</span>
              <span>Oorzaak</span>
            </div>
            <div className="divide-y divide-[#d8d8d4]">
              {filteredRecipes.map((recipe) => {
                const currentMargin = recipeCurrentMargin(recipe);

                return (
                  <button
                    key={recipe.id}
                    type="button"
                    onClick={() => onOpenRecipe(recipe)}
                    className="grid w-full grid-cols-[minmax(12rem,1.35fr)_6rem_6rem_6rem_6rem_minmax(8rem,1fr)] gap-3 px-3 py-2 text-left text-sm hover:bg-[#f8f8f6]"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-[0.82rem] font-black leading-tight md:text-[1rem] lg:text-[1.05rem]">
                        {recipe.name}
                      </span>
                    </span>
                    <span className="font-black">{formatEuro(recipe.costPrice)}</span>
                    <span className="font-black">
                      {recipe.salesPrice ? formatEuro(recipe.salesPrice) : "-"}
                    </span>
                    <span>
                      <span
                        className={`inline-flex h-6 min-w-[3.4rem] items-center justify-center rounded-full px-2 text-[0.68rem] font-black ${marginBadgeClass(
                          currentMargin
                        )}`}
                      >
                        {Number.isFinite(currentMargin)
                          ? formatPercent(currentMargin)
                          : "-"}
                      </span>
                    </span>
                    <span className="font-black">
                      {formatEuro(targetSalesPrice(recipe))}
                    </span>
                    <span className="truncate font-bold text-[#707070]">
                      {causeForRecipe(recipe)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <EmptyState text="Geen eindproducten gevonden met deze margefilters." />
      )}
    </section>
  );
}

const riskOptions = [
  { value: "all", label: "Alles" },
  { value: "under", label: "Onder adviesprijs" },
  { value: "increase", label: "Kostprijsstijging" },
];

const causeOptions = [
  { value: "all", label: "Alle oorzaken" },
  { value: "Room", label: "Room" },
  { value: "Pistache", label: "Pistache" },
  { value: "Roomkaas", label: "Roomkaas" },
  { value: "Chocolade", label: "Chocolade" },
];

function marginBadgeClass(currentMargin: number) {
  if (!Number.isFinite(currentMargin)) return "bg-[#f1eee9] text-[#707070]";
  if (currentMargin < 73) return "bg-[#ffe0dc] text-[#9f4035]";
  if (currentMargin < 80) return "bg-[#eef0c7] text-[#6a631d]";

  return "bg-[#dce8d6] text-[#45663b]";
}

function causeForRecipe(recipe: Recipe) {
  if (recipe.name.includes("Nougatine")) return "Room +12%";
  if (recipe.name.includes("Pistache")) return "Pistachepasta +18%";
  if (recipe.name.includes("Slagroomtruffels")) return "Stabiel";
  if (recipe.name.includes("Red Velvet")) return "Roomkaas +6%";
  if (recipe.name.includes("Cheesecake")) return "Roomkaas +6%";
  if (recipe.name.includes("chocolade") || recipe.name.includes("Brownie")) {
    return "Chocolade +7%";
  }

  return recipe.costPrice > recipe.previousCostPrice ? "Ingredientmix" : "Stabiel";
}

function createMarginPrintRow(recipe: Recipe) {
  const currentMargin = recipeCurrentMargin(recipe);

  return {
    name: recipe.name,
    cost: formatEuro(recipe.costPrice),
    sales: recipe.salesPrice ? formatEuro(recipe.salesPrice) : "-",
    margin: currentMargin ? formatPercent(currentMargin) : "-",
    advice: formatEuro(targetSalesPrice(recipe)),
    cause: causeForRecipe(recipe),
    change: `${formatEuro(recipeCostDelta(recipe))} / ${formatSignedPercent(
      recipeCostChange(recipe),
      1
    )}`,
    isLowMargin: Boolean(currentMargin && currentMargin < 80),
  };
}

function createMarginPrintHtml({
  filters,
  rows,
  totalCount,
}: {
  filters: string[];
  rows: ReturnType<typeof createMarginPrintRow>[];
  totalCount: number;
}) {
  const rowHtml = rows
    .map(
      (row) => `<tr>
        <td><strong>${escapeHtml(row.name)}</strong><br><small>${escapeHtml(row.change)}</small></td>
        <td>${escapeHtml(row.cost)}</td>
        <td>${escapeHtml(row.sales)}</td>
        <td class="${row.isLowMargin ? "low" : "good"}">${escapeHtml(row.margin)}</td>
        <td>${escapeHtml(row.advice)}</td>
        <td>${escapeHtml(row.cause)}</td>
      </tr>`
    )
    .join("");

  return `<!doctype html>
<html lang="nl">
<head>
  <meta charset="utf-8" />
  <title>Marge eindproducten</title>
  <style>
    @page { margin: 16mm; }
    body { color: #1a1815; font-family: Arial, sans-serif; margin: 0; }
    header { align-items: flex-start; border-bottom: 2px solid #1a1815; display: flex; justify-content: space-between; gap: 24px; padding-bottom: 12px; }
    h1 { font-size: 24px; margin: 0 0 6px; }
    p { margin: 0; }
    .meta { color: #666; font-size: 11px; font-weight: 700; line-height: 1.5; text-align: right; }
    table { border-collapse: collapse; margin-top: 14px; width: 100%; }
    th, td { border-bottom: 1px solid #ddd5ca; font-size: 11px; padding: 7px 6px; text-align: left; vertical-align: top; }
    th { background: #f4f0ea; color: #555; font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase; }
    td:not(:first-child), th:not(:first-child) { text-align: right; white-space: nowrap; }
    small { color: #777; font-weight: 700; }
    .good { color: #45663b; font-weight: 800; }
    .low { color: #d75a48; font-weight: 800; }
  </style>
</head>
<body>
  <header>
    <div>
      <p style="font-size:10px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:#777;">Marge</p>
      <h1>Marge eindproducten</h1>
      <p style="font-size:12px;color:#555;">${rows.length} van ${totalCount} eindproducten</p>
    </div>
    <div class="meta">${filters.map(escapeHtml).join("<br>")}</div>
  </header>
  <table>
    <thead><tr><th>Product</th><th>Kost ex.</th><th>Verkoop incl.</th><th>Marge ex.</th><th>Advies incl.</th><th>Oorzaak</th></tr></thead>
    <tbody>${rowHtml || "<tr><td colspan=\"6\">Geen eindproducten gevonden.</td></tr>"}</tbody>
  </table>
</body>
</html>`;
}

function selectedOptionLabel(
  options: Array<{ value: string; label: string }>,
  value: string
) {
  return options.find((option) => option.value === value)?.label || value;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
