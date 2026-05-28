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
  onCreateSemiFinished,
  onRecalculateAll,
}: Readonly<{
  recipes: Recipe[];
  onOpenRecipe: (recipe: Recipe) => void;
  onCreateRecipe: () => void;
  onCreateSemiFinished?: () => void;
  onRecalculateAll: () => void;
}>) {
  const [search, setSearch] = useState("");
  const [group, setGroup] = useState("all");
  const [status, setStatus] = useState("all");
  const [margin, setMargin] = useState("all");
  const [type, setType] = useState("all");

  const groupOptions = useMemo(
    () =>
      Array.from(
        new Set([
          ...productGroups,
          ...recipes
            .map((recipe) => recipe.productGroup)
            .filter((group): group is string => Boolean(group?.trim())),
        ])
      ),
    [recipes]
  );
  const filteredRecipes = useMemo(() => {
    const query = normalizeSearch(search);

    return recipes.filter((recipe) => {
      const matchesSearch = !query || normalizeSearch(recipe.name).includes(query);
      const matchesGroup = group === "all" || recipe.productGroup === group;
      const matchesStatus = status === "all" || recipe.status === status;
      const matchesType = type === "all" || recipe.type === type;
      const matchesMargin =
        recipe.type !== "finalProduct" ||
        margin === "all" || marginStatusForRecipe(recipe) === margin;

      return matchesSearch && matchesGroup && matchesStatus && matchesType && matchesMargin;
    });
  }, [group, margin, recipes, search, status, type]);

  return (
    <section className="grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
      <Panel className="h-fit">
        <SectionTitle
          eyebrow="Sorteren"
          title="Recepten"
          description="Zoek en filter de receptkaart die je wilt openen."
        />
        <div className="mt-5 grid gap-4">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Zoek op receptnaam"
          />
          <FilterSelect
            label="Type"
            value={type}
            onChange={setType}
            options={[
              { value: "all", label: "Alle recepten" },
              { value: "finalProduct", label: "Eindproducten" },
              { value: "semiFinished", label: "Halffabricaten" },
            ]}
          />
          <FilterSelect
            label="Productgroep"
            value={group}
            onChange={setGroup}
            options={[
              { value: "all", label: "Alle groepen" },
              ...groupOptions.map((item) => ({ value: item, label: item })),
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
            label="Margestatus"
            value={margin}
            onChange={setMargin}
            options={[
              { value: "all", label: "Alle statussen" },
              { value: "good", label: "Marge ok" },
              { value: "pressure", label: "Bijna" },
              { value: "critical", label: "Te laag" },
            ]}
          />
        </div>
        <div className="mt-5 grid gap-2">
          <button
            type="button"
            onClick={onCreateRecipe}
            className="rounded-lg bg-[#252525] px-4 py-3 text-left text-sm font-black text-white shadow-sm transition active:scale-[0.98]"
          >
            Nieuw recept
          </button>
          {onCreateSemiFinished && (
            <button
              type="button"
              onClick={onCreateSemiFinished}
              className="rounded-lg border border-[#c3d3bc] bg-[#c3d3bc] px-4 py-3 text-left text-sm font-black text-[#252525] shadow-sm transition active:scale-[0.98]"
            >
              Nieuw halffabricaat
            </button>
          )}
          <button
            type="button"
            onClick={onRecalculateAll}
            className="rounded-lg border border-[#d8d8d4] bg-white px-4 py-3 text-left text-sm font-black text-[#707070] shadow-sm transition active:scale-[0.98]"
          >
            Herbereken alles
          </button>
        </div>
      </Panel>

      <Panel className="p-0">
        {filteredRecipes.length ? (
          <div className="overflow-hidden rounded-lg">
            <div className="hidden grid-cols-[minmax(16rem,1.6fr)_8rem_7rem_7rem_7rem_8rem_3rem] gap-4 border-b border-[#d8d8d4] bg-[#f5f5f3] px-5 py-4 text-xs font-black uppercase tracking-[0.12em] text-[#8c8c8c] xl:grid">
              <span>Recept</span>
              <span>Soort</span>
              <span>Gewicht</span>
              <span>Verkoop</span>
              <span>Kost</span>
              <span>Status</span>
              <span />
            </div>
            <div className="divide-y divide-[#d8d8d4] bg-white">
              {filteredRecipes.map((recipe) => (
                <button
                  key={recipe.id}
                  type="button"
                  onClick={() => onOpenRecipe(recipe)}
                  className="grid w-full gap-3 px-5 py-4 text-left transition hover:bg-[#f8f8f6] xl:grid-cols-[minmax(16rem,1.6fr)_8rem_7rem_7rem_7rem_8rem_3rem] xl:items-center"
                >
                  <div className="grid min-w-0 grid-cols-[0.45rem_3.8rem_minmax(0,1fr)] items-center gap-3">
                    <span className="h-full min-h-14 rounded-full bg-[#c3d3bc]" />
                    <RecipeRowThumb recipe={recipe} />
                    <div className="min-w-0">
                      <p className="truncate text-lg font-black text-[#252525]">{recipe.name}</p>
                      <p className="text-xs font-bold text-[#707070]">
                        {recipe.productGroup || "Geen groep"} - gewijzigd {formatDate(recipe.lastUpdated)}
                      </p>
                      {recipe.type === "semiFinished" && (
                        <SemiFinishedQuickLink recipe={recipe} recipes={recipes} />
                      )}
                    </div>
                  </div>
                  <p className="text-sm font-black text-[#707070]">{recipeTypeLabel(recipe.type)}</p>
                  <p className="text-sm font-black">
                    {formatBatchWeight(recipeBatchWeightKg(recipe))}
                  </p>
                  <p className="text-sm font-black">
                    {recipe.type === "finalProduct" ? formatEuro(recipe.salesPrice) : "-"}
                  </p>
                  <p className="text-sm font-black">{formatEuro(recipe.costPrice)}</p>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <RecipeStatusBadge status={recipe.status} />
                    {recipe.type === "finalProduct" && (
                      <>
                        <MarginBadge status={marginStatusForRecipe(recipe)} />
                        <span className="text-xs font-black text-[#707070]">
                          {formatPercent(recipe.currentMargin)}
                        </span>
                      </>
                    )}
                  </div>
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#c3d3bc] text-lg font-black text-[#252525]">
                    ›
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <EmptyState text="Geen recepten gevonden met deze filters." />
        )}
      </Panel>
    </section>
  );
}

function RecipeRowThumb({ recipe }: Readonly<{ recipe: Recipe }>) {
  if (recipe.type === "finalProduct" && recipe.photoPreviewDataUrl) {
    return (
      <span
        className="block aspect-square overflow-hidden rounded-lg bg-[#efefed] bg-cover bg-center"
        style={{ backgroundImage: `url("${recipe.photoPreviewDataUrl}")` }}
      />
    );
  }

  return (
    <span className="flex aspect-square items-center justify-center rounded-lg bg-[#efefed] text-lg font-black text-[#8c8c8c]">
      {recipe.type === "semiFinished" ? "HF" : "R"}
    </span>
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
