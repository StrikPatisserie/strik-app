import { useMemo, useState } from "react";
import { productGroups } from "./mockData";
import type { Recipe } from "./types";
import {
  EmptyState,
  FilterSelect,
  MarginBadge,
  Panel,
  SectionTitle,
} from "./RecepturenShared";
import {
  changeBadgeClass,
  formatEuro,
  formatPercent,
  formatSignedPercent,
  marginGap,
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
    <Panel>
      <div className="grid gap-4">
        <SectionTitle
          eyebrow="Marge"
          title="Marge-overzicht"
          description="Totaalmarge naast de adviesprijs. Decoratie loopt voortaan mee als gewone grondstof."
        />

        <div className="grid gap-3 lg:grid-cols-4">
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
            label="Leverancier-impact"
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
          <div className="overflow-hidden rounded-[1.15rem] border border-[#e7e0d8]">
            <div className="hidden grid-cols-[minmax(13rem,1.2fr)_8rem_8rem_8rem_8rem_6rem_7rem_minmax(10rem,1fr)] gap-3 bg-[#f8f6f3] px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-[#2d2a26]/45 xl:grid">
              <span>Product</span>
              <span>Type</span>
              <span>Kost oud</span>
              <span>Kost nu</span>
              <span>Verkoop</span>
              <span>Totaalmarge</span>
              <span>Margestatus</span>
              <span>Grootste oorzaak</span>
            </div>
            <div className="divide-y divide-[#e7e0d8] bg-white">
              {filteredRecipes.map((recipe) => (
                <button
                  key={recipe.id}
                  type="button"
                  onClick={() => onOpenRecipe(recipe)}
                  className="grid w-full gap-3 px-4 py-4 text-left transition hover:bg-[#fffdf8] xl:grid-cols-[minmax(13rem,1.2fr)_8rem_8rem_8rem_8rem_6rem_7rem_minmax(10rem,1fr)] xl:items-center"
                >
                  <div className="min-w-0">
                    <p className="truncate text-base font-black">{recipe.name}</p>
                    <span
                      className={`mt-1 inline-flex w-fit rounded-full px-2.5 py-1 text-xs font-black ${changeBadgeClass(
                        recipeCostChange(recipe)
                      )}`}
                    >
                      {formatEuro(recipeCostDelta(recipe))} ·{" "}
                      {formatSignedPercent(recipeCostChange(recipe), 1)}
                    </span>
                  </div>
                  <p className="text-sm font-bold text-[#2d2a26]/62">
                    {recipeTypeLabel(recipe.type)}
                  </p>
                  <p className="text-sm font-black">
                    {formatEuro(recipe.previousCostPrice)}
                  </p>
                  <p className="text-sm font-black">{formatEuro(recipe.costPrice)}</p>
                  <p className="text-sm font-black">
                    {recipe.salesPrice ? formatEuro(recipe.salesPrice) : "-"}
                  </p>
                  <div>
                    <p className="text-sm font-black">
                      {recipe.currentMargin ? formatPercent(recipe.currentMargin) : "-"}
                    </p>
                    {recipe.type === "finalProduct" && (
                      <span
                        className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[0.65rem] font-black ${changeBadgeClass(
                          marginGap(recipe),
                          true
                        )}`}
                      >
                        {marginGap(recipe) >= 0 ? "marge ok" : "te laag"}
                      </span>
                    )}
                  </div>
                  <MarginBadge status={marginStatusForRecipe(recipe)} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold">{causeForRecipe(recipe)}</p>
                    {recipe.type === "finalProduct" && (
                      <p className="text-xs font-bold text-[#2d2a26]/45">
                        Adviesprijs: {formatEuro(targetSalesPrice(recipe))}
                      </p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <EmptyState text="Geen marge-items gevonden met deze filters." />
        )}

        <div className="rounded-[1.15rem] border border-[#ead7a6] bg-[#fff8e3] p-4">
          <p className="text-sm font-black text-[#7a5a18]">
            Voorbeeldadvies: verkoopprijs moet met €0,70 omhoog om doelmarge te
            halen.
          </p>
          <p className="mt-1 text-xs font-bold text-[#2d2a26]/55">
            Klik een product voor ingredient-impact, halffabricaat-impact,
            margeval en adviesprijs.
          </p>
        </div>
      </div>
    </Panel>
  );
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
