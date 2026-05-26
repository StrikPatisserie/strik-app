import { useMemo, useState } from "react";
import { productGroups } from "./mockData";
import type { Recipe } from "./types";
import {
  EmptyState,
  FilterSelect,
  MarginBadge,
  Panel,
  RecipeStatusBadge,
  SearchInput,
  SectionTitle,
} from "./RecepturenShared";
import {
  formatDate,
  formatBatchWeight,
  formatEuro,
  formatPercent,
  linkedFinalProducts,
  marginStatusForRecipe,
  normalizeSearch,
  recipeBatchWeightKg,
  recipeTypeLabel,
} from "./utils";

export default function RecipesList({
  recipes,
  onOpenRecipe,
  onCreateRecipe,
  onOpenPlanning,
  onRecalculateAll,
}: Readonly<{
  recipes: Recipe[];
  onOpenRecipe: (recipe: Recipe) => void;
  onCreateRecipe: () => void;
  onOpenPlanning: () => void;
  onRecalculateAll: () => void;
}>) {
  const [search, setSearch] = useState("");
  const [group, setGroup] = useState("all");
  const [status, setStatus] = useState("all");
  const [margin, setMargin] = useState("all");

  const finalProducts = recipes.filter((recipe) => recipe.type === "finalProduct");
  const filteredRecipes = useMemo(() => {
    const query = normalizeSearch(search);

    return finalProducts.filter((recipe) => {
      const matchesSearch = !query || normalizeSearch(recipe.name).includes(query);
      const matchesGroup = group === "all" || recipe.productGroup === group;
      const matchesStatus = status === "all" || recipe.status === status;
      const matchesMargin =
        margin === "all" || marginStatusForRecipe(recipe) === margin;

      return matchesSearch && matchesGroup && matchesStatus && matchesMargin;
    });
  }, [finalProducts, group, margin, search, status]);

  return (
    <Panel>
      <div className="grid gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <SectionTitle
            eyebrow="Eindproducten"
            title="Recepten"
            description="Zoek, filter en open eindproducten met actuele kostprijs en marge."
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onOpenPlanning}
              className="rounded-full bg-[#fff0bd] px-4 py-2.5 text-sm font-black text-[#7a5a18] shadow-sm transition active:scale-[0.98]"
            >
              Productieplanning
            </button>
            <button
              type="button"
              onClick={onRecalculateAll}
              className="rounded-full bg-[#2d2a26] px-4 py-2.5 text-sm font-black text-white shadow-sm transition active:scale-[0.98]"
            >
              Herbereken alles
            </button>
            <button
              type="button"
              onClick={onCreateRecipe}
              className="rounded-full bg-[#c3d3bc] px-4 py-2.5 text-sm font-black shadow-sm transition active:scale-[0.98]"
            >
              Nieuw recept
            </button>
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-[minmax(0,1.3fr)_repeat(3,minmax(10rem,0.7fr))]">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Zoek op receptnaam"
          />
          <FilterSelect
            label="Productgroep"
            value={group}
            onChange={setGroup}
            options={[
              { value: "all", label: "Alle groepen" },
              ...productGroups.map((item) => ({ value: item, label: item })),
            ]}
          />
          <FilterSelect
            label="Status"
            value={status}
            onChange={setStatus}
            options={[
              { value: "all", label: "Alle statussen" },
              { value: "active", label: "Actief" },
              { value: "draft", label: "Concept" },
              { value: "old", label: "Oud recept" },
            ]}
          />
          <FilterSelect
            label="Marge"
            value={margin}
            onChange={setMargin}
            options={[
              { value: "all", label: "Alle marges" },
              { value: "good", label: "Goed" },
              { value: "pressure", label: "Onder druk" },
              { value: "critical", label: "Kritisch" },
            ]}
          />
        </div>

        {filteredRecipes.length ? (
          <div className="overflow-hidden rounded-[1.15rem] border border-[#e7e0d8]">
            <div className="hidden grid-cols-[minmax(14rem,1.4fr)_8rem_8rem_8rem_8rem_8rem_8rem_8rem] gap-3 bg-[#f8f6f3] px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-[#2d2a26]/45 xl:grid">
              <span>Recept</span>
              <span>Groep</span>
              <span>Gewicht</span>
              <span>Verkoop</span>
              <span>Kostprijs</span>
              <span>Marge</span>
              <span>Status</span>
              <span>Halffab.</span>
            </div>
            <div className="divide-y divide-[#e7e0d8] bg-white">
              {filteredRecipes.map((recipe) => (
                <button
                  key={recipe.id}
                  type="button"
                  onClick={() => onOpenRecipe(recipe)}
                  className="grid w-full gap-3 px-4 py-4 text-left transition hover:bg-[#fffdf8] xl:grid-cols-[minmax(14rem,1.4fr)_8rem_8rem_8rem_8rem_8rem_8rem_8rem] xl:items-center"
                >
                  <div className="min-w-0">
                    <p className="truncate text-base font-black">{recipe.name}</p>
                    <p className="text-xs font-bold text-[#2d2a26]/45">
                      {recipeTypeLabel(recipe.type)} · gewijzigd {formatDate(recipe.lastUpdated)}
                    </p>
                  </div>
                  <p className="text-sm font-bold text-[#2d2a26]/62">{recipe.productGroup}</p>
                  <p className="text-sm font-black">
                    {formatBatchWeight(recipeBatchWeightKg(recipe))}
                  </p>
                  <p className="text-sm font-black">{formatEuro(recipe.salesPrice)}</p>
                  <p className="text-sm font-black">{formatEuro(recipe.costPrice)}</p>
                  <div>
                    <p className="mb-1 text-sm font-black">
                      {formatPercent(recipe.currentMargin)}
                    </p>
                    <MarginBadge status={marginStatusForRecipe(recipe)} />
                  </div>
                  <RecipeStatusBadge status={recipe.status} />
                  <p className="text-sm font-black">
                    {recipe.semiFinishedItems.length}
                  </p>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <EmptyState text="Geen recepten gevonden met deze filters." />
        )}
      </div>
    </Panel>
  );
}

export function SemiFinishedQuickLink({
  recipe,
  recipes,
}: Readonly<{ recipe: Recipe; recipes: Recipe[] }>) {
  return (
    <span className="text-xs font-bold text-[#2d2a26]/45">
      Gekoppeld aan {linkedFinalProducts(recipes, recipe.id).length} eindproducten
    </span>
  );
}
