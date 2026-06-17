import { useMemo, useState } from "react";
import { productGroups } from "./mockData";
import type { Recipe } from "./types";
import { EmptyState } from "./RecepturenShared";
import {
  formatDate,
  normalizeSearch,
  recipeTypeLabel,
} from "./utils";

export default function RecipesList({
  recipes,
  onOpenRecipe,
  onCreateRecipe,
  onRecalculateAll,
}: Readonly<{
  recipes: Recipe[];
  onOpenRecipe: (recipe: Recipe) => void;
  onCreateRecipe: () => void;
  onRecalculateAll: () => void;
}>) {
  const [search, setSearch] = useState("");
  const [group, setGroup] = useState("all");
  const [status, setStatus] = useState("all");
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

      return matchesSearch && matchesGroup && matchesStatus && matchesType;
    });
  }, [group, recipes, search, status, type]);

  return (
    <section className="grid h-full min-h-0 gap-2 overflow-hidden lg:grid-cols-[minmax(12rem,16rem)_minmax(0,1fr)]">
      <aside className="grid max-h-[13.5rem] gap-1.5 overflow-y-auto pb-2 lg:max-h-full lg:gap-2">
        <button
          type="button"
          onClick={onCreateRecipe}
          className="grid h-9 grid-cols-[2.35rem_minmax(0,1fr)] items-center border border-[#c3d3bc] bg-white text-left text-sm font-black text-[#111111] lg:h-10 lg:grid-cols-[2.6rem_minmax(0,1fr)]"
        >
          <span className="flex h-full items-center justify-center bg-[#c3d3bc] text-2xl font-light">
            +
          </span>
          <span className="px-2.5">Nieuw recept</span>
        </button>

        <div className="border border-[#c3d3bc] bg-white">
          <div className="border-b border-[#c3d3bc] px-2.5 py-2 lg:px-3 lg:py-2.5">
            <p className="text-[0.6rem] font-black uppercase tracking-[0.14em] text-[#8c8c8c] lg:text-[0.65rem]">
              Sorteren
            </p>
            <h2 className="mt-0.5 text-base font-black leading-tight lg:text-lg">Recepten</h2>
          </div>

          <label className="grid grid-cols-[2.35rem_minmax(0,1fr)] border-b border-[#c3d3bc] lg:grid-cols-[2.6rem_minmax(0,1fr)]">
            <span className="flex h-9 items-center justify-center bg-[#c3d3bc] text-xl font-light lg:h-10">
              ⌕
            </span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="zoek"
              className="min-w-0 px-2.5 text-sm font-light outline-none placeholder:text-[#9a9a9a]"
            />
          </label>

          <div className="grid gap-1.5 px-2 py-2 lg:gap-2 lg:px-2.5 lg:py-2.5">
            <CompactSelect
              label="per categorie"
              value={group}
              onChange={setGroup}
              options={[
                { value: "all", label: "kies" },
                ...groupOptions.map((item) => ({ value: item, label: item })),
              ]}
            />
            <CompactCheckbox
              checked={type === "finalProduct"}
              onChange={() => setType(type === "finalProduct" ? "all" : "finalProduct")}
              label="toon alleen eindrecepten"
            />
            <CompactCheckbox
              checked={type === "semiFinished"}
              onChange={() => setType(type === "semiFinished" ? "all" : "semiFinished")}
              label="toon alleen halffabricaten"
            />
            <CompactCheckbox
              checked={status === "active"}
              onChange={() => setStatus(status === "active" ? "all" : "active")}
              label="toon alleen actief"
            />
          </div>
        </div>

        <div className="grid gap-2">
          <button
            type="button"
            onClick={onRecalculateAll}
            className="border border-[#c3d3bc] bg-white px-3 py-2 text-left text-xs font-black text-[#707070]"
          >
            Herbereken alles
          </button>
        </div>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-col border border-[#c3d3bc] bg-white">
        {filteredRecipes.length ? (
          <>
            <div className="hidden shrink-0 grid-cols-[minmax(14rem,1fr)_7rem_4rem] border-b border-[#c3d3bc] bg-[#f5f5f3] px-4 py-2.5 text-xs font-black uppercase tracking-[0.16em] text-[#8c8c8c] md:grid">
              <span>Recept</span>
              <span>Soort</span>
              <span />
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto bg-white">
              {filteredRecipes.map((recipe) => {
                const hasThumb = recipe.type === "finalProduct";

                return (
                  <button
                    key={recipe.id}
                    type="button"
                    onClick={() => onOpenRecipe(recipe)}
                    className={`grid w-full items-center border-b border-[#c3d3bc] text-left transition hover:bg-[#f8f8f6] ${
                      hasThumb
                        ? "grid-cols-[2.35rem_minmax(0,1fr)_3rem] md:grid-cols-[2.6rem_minmax(14rem,1fr)_7rem_3.4rem]"
                        : "grid-cols-[2.35rem_minmax(0,1fr)] md:grid-cols-[2.6rem_minmax(14rem,1fr)_7rem]"
                    }`}
                  >
                    <span className={`h-full min-h-[3.35rem] ${recipeStripeClass(recipe)}`} />
                    <div className="min-w-0 px-3 py-2">
                      <p className="truncate text-[clamp(0.82rem,2vw,1.3rem)] font-light leading-tight text-[#111111]">
                        {recipe.name}
                      </p>
                      <p className="mt-0.5 truncate text-[0.6rem] font-bold text-[#707070] sm:text-[0.68rem]">
                        {recipe.productGroup || "geen groep"} - gewijzigd {formatDate(recipe.lastUpdated)}
                      </p>
                    </div>
                    <p className="hidden px-3 text-right text-xs italic text-[#8c8c8c] md:block">
                      {recipeTypeLabel(recipe.type)}
                    </p>
                    {hasThumb && (
                      <span className="flex h-full min-h-[3.35rem] items-center justify-center bg-[#ededeb]">
                        <RecipeRowThumb recipe={recipe} />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <EmptyState text="Geen recepten gevonden met deze filters." />
        )}
      </div>
    </section>
  );
}

function CompactSelect({
  label,
  value,
  onChange,
  options,
}: Readonly<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}>) {
  return (
    <label className="grid gap-1 text-center text-xs font-light lg:gap-1.5 lg:text-sm">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-w-0 rounded-full border-0 bg-[#c3d3bc] px-3 py-1.5 text-left text-xs font-light text-white outline-none lg:text-sm"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function CompactCheckbox({
  checked,
  onChange,
  label,
}: Readonly<{
  checked: boolean;
  onChange: () => void;
  label: string;
}>) {
  return (
    <button
      type="button"
      onClick={onChange}
      className="grid grid-cols-[1.85rem_minmax(0,1fr)] items-center border border-[#c3d3bc] text-left text-[0.68rem] lg:grid-cols-[2rem_minmax(0,1fr)] lg:text-[0.72rem]"
    >
      <span className="flex h-6 items-center justify-center border-r border-[#c3d3bc] lg:h-7">
        <span className="flex h-4 w-4 items-center justify-center border border-[#111111] text-sm leading-none">
          {checked ? "✓" : ""}
        </span>
      </span>
      <span className="px-2">{label}</span>
    </button>
  );
}

function recipeStripeClass(recipe: Recipe) {
  const group = normalizeSearch(recipe.productGroup);
  if (recipe.type === "semiFinished") return "bg-[#f6f5ad]";
  if (group.includes("ijs")) return "bg-[#b9dce6]";
  if (group.includes("taart")) return "bg-[#e9cadd]";

  return "bg-[#c3d3bc]";
}

function RecipeRowThumb({ recipe }: Readonly<{ recipe: Recipe }>) {
  if (recipe.type === "finalProduct" && recipe.photoPreviewDataUrl) {
    return (
      <span
        className="block h-10 w-10 bg-[#efefed] bg-cover bg-center"
        style={{ backgroundImage: `url("${recipe.photoPreviewDataUrl}")` }}
      />
    );
  }

  return (
    <span className="flex h-10 w-10 items-center justify-center bg-[#efefed] text-sm font-black text-[#8c8c8c]">
      R
    </span>
  );
}
