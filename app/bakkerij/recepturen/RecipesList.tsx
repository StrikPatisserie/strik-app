import { useMemo, useState } from "react";
import { productGroups } from "./mockData";
import type { Recipe } from "./types";
import {
  EmptyState,
  MarginBadge,
  RecipeStatusBadge,
} from "./RecepturenShared";
import {
  formatDate,
  formatEuro,
  linkedFinalProducts,
  marginStatusForRecipe,
  normalizeSearch,
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
    <section className="grid gap-5 lg:grid-cols-[17rem_minmax(0,1fr)] xl:grid-cols-[19rem_minmax(0,1fr)]">
      <aside className="grid h-fit gap-4 lg:sticky lg:top-5">
        <button
          type="button"
          onClick={onCreateRecipe}
          className="grid h-14 grid-cols-[3.5rem_minmax(0,1fr)] items-center border border-[#c3d3bc] bg-white text-left text-lg font-black text-[#111111]"
        >
          <span className="flex h-full items-center justify-center bg-[#c3d3bc] text-4xl font-light">
            +
          </span>
          <span className="px-4">Nieuw recept</span>
        </button>

        <div className="border border-[#c3d3bc] bg-white">
          <div className="border-b border-[#c3d3bc] px-5 py-5">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#8c8c8c]">
              Sorteren
            </p>
            <h2 className="mt-1 text-2xl font-black leading-tight">Recepten</h2>
          </div>

          <label className="grid grid-cols-[3.5rem_minmax(0,1fr)] border-b border-[#c3d3bc]">
            <span className="flex h-14 items-center justify-center bg-[#c3d3bc] text-3xl font-light">
              ⌕
            </span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="zoek"
              className="min-w-0 px-4 text-lg font-light outline-none placeholder:text-[#9a9a9a]"
            />
          </label>

          <div className="grid gap-3 px-4 py-5">
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
          {onCreateSemiFinished && (
            <button
              type="button"
              onClick={onCreateSemiFinished}
              className="border border-[#c3d3bc] bg-[#c3d3bc] px-4 py-3 text-left text-sm font-black text-[#252525]"
            >
              Nieuw halffabricaat
            </button>
          )}
          <button
            type="button"
            onClick={onRecalculateAll}
            className="border border-[#c3d3bc] bg-white px-4 py-3 text-left text-sm font-black text-[#707070]"
          >
            Herbereken alles
          </button>
        </div>
      </aside>

      <div className="min-w-0 border border-[#c3d3bc] bg-white">
        {filteredRecipes.length ? (
          <div>
            <div className="hidden grid-cols-[minmax(15rem,1fr)_7rem_6rem_6rem] border-b border-[#c3d3bc] bg-[#f5f5f3] px-4 py-3 text-xs font-black uppercase tracking-[0.16em] text-[#8c8c8c] md:grid">
              <span>Recept</span>
              <span>Soort</span>
              <span>Kost</span>
              <span>Status</span>
            </div>
            <div className="bg-white">
              {filteredRecipes.map((recipe) => (
                <button
                  key={recipe.id}
                  type="button"
                  onClick={() => onOpenRecipe(recipe)}
                  className="grid w-full grid-cols-[3rem_minmax(0,1fr)_4rem] items-center border-b border-[#c3d3bc] text-left transition hover:bg-[#f8f8f6] md:grid-cols-[3rem_minmax(15rem,1fr)_7rem_6rem_6rem_4rem]"
                >
                  <span className={`h-full min-h-[4.6rem] ${recipeStripeClass(recipe)}`} />
                  <div className="min-w-0 px-4 py-3">
                    <p className="truncate text-[clamp(1.25rem,2.8vw,2rem)] font-light leading-tight text-[#111111]">
                      {recipe.name}
                    </p>
                    <p className="mt-1 truncate text-xs font-bold text-[#707070]">
                      {recipe.productGroup || "geen groep"} - gewijzigd {formatDate(recipe.lastUpdated)}
                    </p>
                    {recipe.type === "semiFinished" && (
                      <SemiFinishedQuickLink recipe={recipe} recipes={recipes} />
                    )}
                  </div>
                  <p className="hidden px-3 text-right text-sm italic text-[#8c8c8c] md:block">
                    {recipeTypeLabel(recipe.type)}
                  </p>
                  <p className="hidden px-3 text-right text-sm font-black md:block">
                    {formatEuro(recipe.costPrice)}
                  </p>
                  <div className="hidden px-3 md:block">
                    <RecipeStatusBadge status={recipe.status} />
                    {recipe.type === "finalProduct" && (
                      <span className="mt-1 block">
                        <MarginBadge status={marginStatusForRecipe(recipe)} />
                      </span>
                    )}
                  </div>
                  <span className="flex h-full min-h-[4.6rem] items-center justify-center bg-[#ededeb]">
                    <RecipeRowThumb recipe={recipe} />
                  </span>
                </button>
              ))}
            </div>
          </div>
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
    <label className="grid gap-2 text-center text-xl font-light">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-w-0 rounded-full border-0 bg-[#c3d3bc] px-5 py-3 text-left text-lg font-light text-white outline-none"
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
      className="grid grid-cols-[2.5rem_minmax(0,1fr)] items-center border border-[#c3d3bc] text-left text-sm"
    >
      <span className="flex h-10 items-center justify-center border-r border-[#c3d3bc]">
        <span className="flex h-6 w-6 items-center justify-center border border-[#111111] text-xl leading-none">
          {checked ? "✓" : ""}
        </span>
      </span>
      <span className="px-3">{label}</span>
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
        className="block h-14 w-14 bg-[#efefed] bg-cover bg-center"
        style={{ backgroundImage: `url("${recipe.photoPreviewDataUrl}")` }}
      />
    );
  }

  return (
    <span className="flex h-14 w-14 items-center justify-center bg-[#efefed] text-lg font-black text-[#8c8c8c]">
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
