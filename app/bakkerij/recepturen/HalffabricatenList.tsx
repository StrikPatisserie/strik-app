import { useMemo, useState } from "react";
import type { Recipe } from "./types";
import {
  EmptyState,
  FilterSelect,
  Panel,
  RecipeStatusBadge,
  SearchInput,
  SectionTitle,
} from "./RecepturenShared";
import {
  formatDate,
  formatEuro,
  linkedFinalProducts,
  normalizeSearch,
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
  const [search, setSearch] = useState("");
  const [group, setGroup] = useState("all");
  const [status, setStatus] = useState("all");
  const semiFinished = useMemo(
    () => recipes.filter((recipe) => recipe.type === "semiFinished"),
    [recipes]
  );
  const groups = useMemo(
    () =>
      Array.from(
        new Set(
          semiFinished
            .map((recipe) => recipe.productGroup)
            .filter((group): group is string => Boolean(group?.trim()))
        )
      ).sort((first, second) => first.localeCompare(second, "nl-NL")),
    [semiFinished]
  );
  const summary = useMemo(() => {
    const usedCount = semiFinished.filter(
      (recipe) => linkedFinalProducts(recipes, recipe.id).length > 0
    ).length;
    const averageCostPrice = semiFinished.length
      ? semiFinished.reduce((total, recipe) => total + recipe.costPrice, 0) /
        semiFinished.length
      : 0;

    return {
      total: semiFinished.length,
      usedCount,
      draftCount: semiFinished.filter((recipe) => recipe.status === "draft")
        .length,
      averageCostPrice,
    };
  }, [recipes, semiFinished]);
  const filteredRecipes = useMemo(() => {
    const query = normalizeSearch(search);

    return semiFinished.filter((recipe) => {
      const linkedProducts = linkedFinalProducts(recipes, recipe.id);
      const matchesSearch =
        !query ||
        normalizeSearch(recipe.name).includes(query) ||
        normalizeSearch(recipe.productGroup).includes(query) ||
        linkedProducts.some((product) =>
          normalizeSearch(product.name).includes(query)
        );
      const matchesGroup = group === "all" || recipe.productGroup === group;
      const matchesStatus = status === "all" || recipe.status === status;

      return matchesSearch && matchesGroup && matchesStatus;
    });
  }, [group, recipes, search, semiFinished, status]);

  return (
    <Panel>
      <div className="grid gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <SectionTitle
            eyebrow="Basisrecepten"
            title="Halffabricaten"
            description="Kostprijscontrole voor vullingen, mousses, bodems en andere bouwstenen."
          />
          <button
            type="button"
            onClick={onCreateRecipe}
            className="rounded-full bg-[#c3d3bc] px-4 py-2.5 text-sm font-black shadow-sm transition active:scale-[0.98]"
          >
            Nieuw halffabricaat
          </button>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <HalffabricatenMetric
            label="Halffabricaten"
            value={summary.total}
            detail="Alle basisrecepten"
          />
          <HalffabricatenMetric
            label="In gebruik"
            value={summary.usedCount}
            detail="Gekoppeld aan eindproduct"
          />
          <HalffabricatenMetric
            label="Concept"
            value={summary.draftCount}
            detail="Nog aanvullen of controleren"
          />
          <HalffabricatenMetric
            label="Gem. kostprijs"
            value={formatEuro(summary.averageCostPrice)}
            detail="Gemiddelde per rekeneenheid"
          />
        </div>

        <div className="grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_repeat(2,minmax(10rem,0.8fr))]">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Zoek halffabricaat, groep of gekoppeld product"
          />
          <FilterSelect
            label="Groep"
            value={group}
            onChange={setGroup}
            options={[
              { value: "all", label: "Alle groepen" },
              ...groups.map((item) => ({ value: item, label: item })),
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
        </div>

        {filteredRecipes.length ? (
          <div className="overflow-x-auto border border-[#e7e0d8]">
            <div className="hidden grid-cols-[minmax(14rem,1.4fr)_9rem_9rem_9rem_8rem_8rem] gap-3 bg-[#f8f6f3] px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-[#2d2a26]/45 lg:grid lg:min-w-[55rem]">
              <span>Halffabricaat</span>
              <span>Groep</span>
              <span>Gewicht</span>
              <span>Kostprijs/kg</span>
              <span>Gekoppeld</span>
              <span>Status</span>
            </div>
            <div className="divide-y divide-[#e7e0d8] bg-white">
              {filteredRecipes.map((recipe) => {
                const linkedProducts = linkedFinalProducts(recipes, recipe.id);
                const firstIngredient = recipe.ingredients[0];

                return (
                  <button
                    key={recipe.id}
                    type="button"
                    onClick={() => onOpenRecipe(recipe)}
                    className="grid w-full gap-3 px-4 py-2.5 text-left transition hover:bg-[#fffdf8] lg:min-w-[55rem] lg:grid-cols-[minmax(14rem,1.4fr)_9rem_9rem_9rem_8rem_8rem] lg:items-center"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-base font-black">
                        {recipe.name}
                      </p>
                      <p className="text-xs font-bold text-[#2d2a26]/45">
                        {firstIngredient
                          ? `${quantityLabel(
                              firstIngredient.quantity,
                              firstIngredient.unit
                            )} hoofdgrondstof`
                          : "Geen grondstoffen"}{" "}
                        · gewijzigd {formatDate(recipe.lastUpdated)}
                      </p>
                    </div>
                    <p className="text-sm font-bold text-[#2d2a26]/62">
                      {recipe.productGroup}
                    </p>
                    <p className="text-sm font-black">{recipe.batchSize}</p>
                    <p className="text-sm font-black">
                      {formatEuro(recipe.costPrice)}
                    </p>
                    <p className="text-sm font-black">
                      {linkedProducts.length} producten
                    </p>
                    <RecipeStatusBadge status={recipe.status} />
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <EmptyState text="Geen halffabricaten gevonden met deze filters." />
        )}
      </div>
    </Panel>
  );
}

function HalffabricatenMetric({
  label,
  value,
  detail,
}: Readonly<{
  label: string;
  value: string | number;
  detail: string;
}>) {
  return (
    <div className="rounded-lg border border-[#eadfcb] bg-[#fffdf8] px-3 py-2">
      <p className="text-[0.65rem] font-black uppercase tracking-[0.12em] text-[#7a5a18]/70">
        {label}
      </p>
      <p className="mt-1 text-lg font-black leading-none text-[#2d2a26]">
        {value}
      </p>
      <p className="mt-1 text-[0.7rem] font-bold leading-snug text-[#2d2a26]/45">
        {detail}
      </p>
    </div>
  );
}
