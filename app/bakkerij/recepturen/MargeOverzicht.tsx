import { useMemo, useState } from "react";
import { productGroups } from "./mockData";
import type { Recipe } from "./types";
import {
  EmptyState,
  FilterSelect,
} from "./RecepturenShared";
import {
  changeBadgeClass,
  formatEuro,
  formatPercent,
  formatSignedPercent,
  marginStatusForRecipe,
  recipeCostChange,
  recipeCostDelta,
  recipeTypeLabel,
  targetSalesPrice,
} from "./utils";

export default function MargeOverzicht({
  recipes,
  onOpenRecipe,
}: Readonly<{
  recipes: Recipe[];
  onOpenRecipe: (recipe: Recipe) => void;
}>) {
  const [typeFilter, setTypeFilter] = useState("both");
  const [riskFilter, setRiskFilter] = useState("all");
  const [groupFilter, setGroupFilter] = useState("all");
  const [supplierImpact, setSupplierImpact] = useState("all");
  const groupOptions = useMemo(
    () =>
      Array.from(
        new Set([
          ...productGroups,
          "Basis",
          "Vullingen",
          "Mousses",
          "Afwerking",
          ...recipes
            .map((recipe) => recipe.productGroup)
            .filter((group): group is string => Boolean(group?.trim())),
        ])
      ),
    [recipes]
  );

  const filteredRecipes = useMemo(
    () =>
      recipes.filter((recipe) => {
        const matchesType =
          typeFilter === "both" ||
          (typeFilter === "finalProduct" && recipe.type === "finalProduct") ||
          (typeFilter === "semiFinished" && recipe.type === "semiFinished");
        const matchesRisk =
          riskFilter === "all" ||
          (riskFilter === "under" && marginStatusForRecipe(recipe) !== "good") ||
          (riskFilter === "increase" && recipe.costPrice > recipe.previousCostPrice);
        const matchesGroup =
          groupFilter === "all" || recipe.productGroup === groupFilter;
        const matchesSupplier =
          supplierImpact === "all" ||
          causeForRecipe(recipe).toLocaleLowerCase("nl-NL").includes(
            supplierImpact.toLocaleLowerCase("nl-NL")
          );

        return matchesType && matchesRisk && matchesGroup && matchesSupplier;
      }),
    [groupFilter, recipes, riskFilter, supplierImpact, typeFilter]
  );

  return (
    <section className="grid gap-3 border border-[#c3d3bc] bg-white p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#8c8c8c]">
            Marge
          </p>
          <h2 className="text-xl font-black">Marge-overzicht</h2>
        </div>
        <p className="text-xs font-bold text-[#707070]">
          {filteredRecipes.length} regels
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <FilterSelect
          label="Type"
          value={typeFilter}
          onChange={setTypeFilter}
          options={[
            { value: "both", label: "Allebei" },
            { value: "finalProduct", label: "Eindproducten" },
            { value: "semiFinished", label: "Halffabricaten" },
          ]}
        />
        <FilterSelect
          label="Risico"
          value={riskFilter}
          onChange={setRiskFilter}
          options={[
            { value: "all", label: "Alles" },
            { value: "under", label: "Onder adviesprijs" },
            { value: "increase", label: "Kostprijsstijging" },
          ]}
        />
        <FilterSelect
          label="Productgroep"
          value={groupFilter}
          onChange={setGroupFilter}
          options={[
            { value: "all", label: "Alle groepen" },
            ...groupOptions.map((item) => ({ value: item, label: item })),
          ]}
        />
        <FilterSelect
          label="Oorzaak"
          value={supplierImpact}
          onChange={setSupplierImpact}
          options={[
            { value: "all", label: "Alle oorzaken" },
            { value: "Room", label: "Room" },
            { value: "Pistache", label: "Pistache" },
            { value: "Roomkaas", label: "Roomkaas" },
            { value: "Chocolade", label: "Chocolade" },
          ]}
        />
      </div>

      {filteredRecipes.length ? (
        <div className="max-h-[34rem] overflow-auto border border-[#d8d8d4]">
          <div className="min-w-[48rem]">
            <div className="grid grid-cols-[minmax(12rem,1.25fr)_7rem_6rem_6rem_6rem_6rem_minmax(8rem,1fr)] gap-3 border-b border-[#d8d8d4] bg-[#f5f5f3] px-3 py-2 text-[0.68rem] font-black uppercase tracking-[0.12em] text-[#8c8c8c]">
              <span>Product</span>
              <span>Type</span>
              <span>Kost</span>
              <span>Verkoop</span>
              <span>Marge</span>
              <span>Advies</span>
              <span>Oorzaak</span>
            </div>
            <div className="divide-y divide-[#d8d8d4]">
              {filteredRecipes.map((recipe) => (
                <button
                  key={recipe.id}
                  type="button"
                  onClick={() => onOpenRecipe(recipe)}
                  className="grid w-full grid-cols-[minmax(12rem,1.25fr)_7rem_6rem_6rem_6rem_6rem_minmax(8rem,1fr)] gap-3 px-3 py-2 text-left text-sm hover:bg-[#f8f8f6]"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-black">{recipe.name}</span>
                    <span
                      className={`mt-0.5 inline-flex px-1.5 py-0.5 text-[0.65rem] font-black ${changeBadgeClass(
                        recipeCostChange(recipe)
                      )}`}
                    >
                      {formatEuro(recipeCostDelta(recipe))} ·{" "}
                      {formatSignedPercent(recipeCostChange(recipe), 1)}
                    </span>
                  </span>
                  <span className="font-bold text-[#707070]">
                    {recipeTypeLabel(recipe.type)}
                  </span>
                  <span className="font-black">{formatEuro(recipe.costPrice)}</span>
                  <span className="font-black">
                    {recipe.salesPrice ? formatEuro(recipe.salesPrice) : "-"}
                  </span>
                  <span className={`font-black ${marginTextClass(recipe)}`}>
                    {recipe.currentMargin ? formatPercent(recipe.currentMargin) : "-"}
                  </span>
                  <span className="font-black">
                    {recipe.type === "finalProduct"
                      ? formatEuro(targetSalesPrice(recipe))
                      : "-"}
                  </span>
                  <span className="truncate font-bold text-[#707070]">
                    {causeForRecipe(recipe)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <EmptyState text="Geen marge-items gevonden met deze filters." />
      )}
    </section>
  );
}

function marginTextClass(recipe: Recipe) {
  if (!recipe.currentMargin) return "text-[#707070]";

  return recipe.currentMargin >= 80 ? "text-[#45663b]" : "text-[#d75a48]";
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
