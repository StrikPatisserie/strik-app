import { useMemo, useState } from "react";
import type { Recipe } from "./types";
import styles from "./ManagementScreens.module.css";
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
      <div className="grid gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <SectionTitle title="Halffabricaten" />
          <button
            type="button"
            onClick={onCreateRecipe}
            className={`${styles.action} ${styles.primaryAction}`}
          >
            Nieuw halffabricaat
          </button>
        </div>

        <div className={styles.metrics}>
          <HalffabricatenMetric
            label="Halffabricaten"
            value={summary.total}
          />
          <HalffabricatenMetric
            label="In gebruik"
            value={summary.usedCount}
          />
          <HalffabricatenMetric
            label="Concept"
            value={summary.draftCount}
          />
          <HalffabricatenMetric
            label="Gem. kostprijs"
            value={formatEuro(summary.averageCostPrice)}
          />
        </div>

        <div className="grid gap-2 lg:grid-cols-[minmax(0,1.4fr)_repeat(2,minmax(10rem,0.8fr))]">
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
          <div className={styles.table}>
            <div className={`${styles.tableHeading} hidden grid-cols-[minmax(14rem,1.4fr)_9rem_9rem_9rem_8rem_8rem] gap-3 lg:grid lg:min-w-[55rem]`}>
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

                return (
                  <button
                    key={recipe.id}
                    type="button"
                    onClick={() => onOpenRecipe(recipe)}
                    className={`${styles.tableRow} grid w-full grid-cols-[minmax(0,1fr)_auto] text-left transition lg:min-w-[55rem] lg:grid-cols-[minmax(14rem,1.4fr)_9rem_9rem_9rem_8rem_8rem] lg:items-center`}
                  >
                    <div className="min-w-0">
                      <p className={`${styles.rowTitle} truncate`}>
                        {recipe.name}
                      </p>
                      <p className={`${styles.rowMeta} hidden lg:block`}>Gewijzigd {formatDate(recipe.lastUpdated)}</p>
                      <p className={`${styles.rowMeta} lg:hidden`}>{recipe.productGroup} · {recipe.batchSize} · {formatEuro(recipe.costPrice)}</p>
                    </div>
                    <p className="hidden text-sm font-bold text-[#2d2a26]/62 lg:block">
                      {recipe.productGroup}
                    </p>
                    <p className="hidden text-sm font-black lg:block">{recipe.batchSize}</p>
                    <p className="hidden text-sm font-black lg:block">
                      {formatEuro(recipe.costPrice)}
                    </p>
                    <p className="hidden text-sm font-black lg:block">
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
}: Readonly<{
  label: string;
  value: string | number;
}>) {
  return (
    <div className={styles.metric}>
      <p>{label}</p>
      <p>{value}</p>
    </div>
  );
}
