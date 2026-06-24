import { type ReactNode, useMemo, useState } from "react";
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
  onOpenImport,
  onRecalculateAll,
}: Readonly<{
  recipes: Recipe[];
  onOpenRecipe: (recipe: Recipe) => void;
  onCreateRecipe: () => void;
  onOpenImport: () => void;
  onRecalculateAll: () => void;
}>) {
  const [search, setSearch] = useState("");
  const [group, setGroup] = useState("all");
  const [status, setStatus] = useState("all");
  const [type, setType] = useState("all");
  const [sortBy, setSortBy] = useState("name");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [recalculateStatus, setRecalculateStatus] = useState("");

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

    return recipes
      .filter((recipe) => {
        const matchesSearch = !query || normalizeSearch(recipe.name).includes(query);
        const matchesGroup = group === "all" || recipe.productGroup === group;
        const matchesStatus = status === "all" || recipe.status === status;
        const matchesType = type === "all" || recipe.type === type;

        return matchesSearch && matchesGroup && matchesStatus && matchesType;
      })
      .sort((a, b) => {
        if (sortBy === "updated") {
          return dateValue(b.lastUpdated) - dateValue(a.lastUpdated);
        }

        if (sortBy === "group") {
          return `${a.productGroup || ""} ${a.name}`.localeCompare(
            `${b.productGroup || ""} ${b.name}`,
            "nl"
          );
        }

        if (sortBy === "type") {
          return `${recipeTypeLabel(a.type)} ${a.name}`.localeCompare(
            `${recipeTypeLabel(b.type)} ${b.name}`,
            "nl"
          );
        }

        return a.name.localeCompare(b.name, "nl");
      });
  }, [group, recipes, search, sortBy, status, type]);

  return (
    <section className="flex h-full min-h-0 flex-col gap-2 overflow-hidden">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[0.62rem] font-black uppercase tracking-[0.18em] text-[#8c8c8c]">
            Recept
          </p>
          <h2 className="truncate text-2xl font-black leading-none text-[#111111] md:text-3xl">
            Recepten
          </h2>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <ToolbarButton label="Nieuw recept" onClick={onCreateRecipe}>
            <PlusIcon />
          </ToolbarButton>
          <ToolbarButton label="Bestand uploaden" onClick={onOpenImport}>
            <UploadIcon />
          </ToolbarButton>
          <ToolbarButton
            label="Sorteren en filteren"
            onClick={() => setFiltersOpen((current) => !current)}
            active={filtersOpen}
          >
            <SlidersIcon />
          </ToolbarButton>
        </div>
      </div>

      {filtersOpen && (
        <div className="grid gap-2 border border-[#c3d3bc] bg-white p-2 shadow-sm md:ml-auto md:w-[min(100%,48rem)] md:grid-cols-[1.2fr_1fr_1fr_auto] md:items-end">
          <label className="grid gap-1">
            <span className="text-[0.58rem] font-black uppercase tracking-[0.14em] text-[#8c8c8c]">
              Zoek
            </span>
            <span className="grid h-9 grid-cols-[2.2rem_minmax(0,1fr)] border border-[#c3d3bc]">
              <span className="flex items-center justify-center bg-[#c3d3bc] text-base">
                <SearchIcon />
              </span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="zoek"
                className="min-w-0 px-2 text-sm font-light outline-none placeholder:text-[#9a9a9a]"
              />
            </span>
          </label>

          <CompactSelect
            label="Categorie"
            value={group}
            onChange={setGroup}
            options={[
              { value: "all", label: "Alle categorieen" },
              ...groupOptions.map((item) => ({ value: item, label: item })),
            ]}
          />
          <CompactSelect
            label="Sorteer"
            value={sortBy}
            onChange={setSortBy}
            options={[
              { value: "name", label: "Naam" },
              { value: "updated", label: "Laatst gewijzigd" },
              { value: "group", label: "Categorie" },
              { value: "type", label: "Soort" },
            ]}
          />

          <div className="grid grid-cols-3 gap-1 md:w-64">
            <TinyToggle
              active={type === "finalProduct"}
              label="Eind"
              onClick={() => setType(type === "finalProduct" ? "all" : "finalProduct")}
            />
            <TinyToggle
              active={type === "semiFinished"}
              label="Half"
              onClick={() => setType(type === "semiFinished" ? "all" : "semiFinished")}
            />
            <TinyToggle
              active={status === "active"}
              label="Actief"
              onClick={() => setStatus(status === "active" ? "all" : "active")}
            />
          </div>

          <div className="flex items-center justify-between gap-2 md:col-span-4">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setGroup("all");
                  setStatus("all");
                  setType("all");
                  setSortBy("name");
                }}
                className="h-8 border border-[#e7e0d8] bg-[#fffdf8] px-3 text-xs font-black text-[#707070]"
              >
                Reset
              </button>
              <button
                type="button"
                onClick={() => setFiltersOpen(false)}
                className="h-8 border border-[#c3d3bc] bg-[#c3d3bc] px-4 text-xs font-black text-[#24401f]"
              >
                Ga
              </button>
            </div>
            <div className="flex items-center gap-2">
              {recalculateStatus && (
                <span className="text-[0.62rem] font-black uppercase tracking-[0.12em] text-[#8c8c8c]">
                  {recalculateStatus}
                </span>
              )}
              <button
                type="button"
                onClick={() => {
                  setRecalculateStatus("bezig...");
                  onRecalculateAll();
                  window.setTimeout(() => setRecalculateStatus("herberekend"), 80);
                  window.setTimeout(() => setRecalculateStatus(""), 2200);
                }}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-[#c3d3bc] bg-white text-sm font-black text-[#45663b] shadow-sm transition active:scale-95"
                aria-label="Herbereken alle kostprijzen"
                title="Herbereken alles"
              >
                <RefreshIcon />
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex min-h-0 min-w-0 flex-1 flex-col border border-[#c3d3bc] bg-white">
        {filteredRecipes.length ? (
          <>
            <div className="hidden shrink-0 grid-cols-[1.5rem_minmax(16rem,1.6fr)_9rem_8rem_7rem_7.5rem] border-b border-[#c3d3bc] bg-[#f5f5f3] text-[0.6rem] font-black uppercase tracking-[0.14em] text-[#8c8c8c] md:grid">
              <span />
              <span>Recept</span>
              <span>Soort</span>
              <span>Categorie</span>
              <span>Batch</span>
              <span>Gewijzigd</span>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto bg-white">
              {filteredRecipes.map((recipe) => {
                return (
                  <button
                    key={recipe.id}
                    type="button"
                    onClick={() => onOpenRecipe(recipe)}
                    className="grid w-full grid-cols-[1.25rem_minmax(0,1fr)] items-center border-b border-[#c3d3bc] text-left transition hover:bg-[#f8f8f6] md:grid-cols-[1.5rem_minmax(16rem,1.6fr)_9rem_8rem_7rem_7.5rem]"
                  >
                    <span className={`h-full min-h-[3rem] md:min-h-[2.6rem] ${recipeStripeClass(recipe)}`} />
                    <div className="min-w-0 px-2 py-1.5 md:py-1">
                      <p className="truncate text-[clamp(0.72rem,1.55vw,1rem)] font-light leading-tight text-[#111111]">
                        {recipe.name}
                      </p>
                      <p className="mt-0.5 truncate text-[0.5rem] font-bold text-[#707070] sm:text-[0.6rem]">
                        {compactRecipeMeta(recipe)}
                      </p>
                    </div>
                    <p className="hidden truncate px-2 text-[0.72rem] font-black text-[#707070] md:block">
                      {recipeTypeLabel(recipe.type)}
                    </p>
                    <p className="hidden truncate px-2 text-[0.72rem] font-bold text-[#707070] md:block">
                      {recipe.productGroup || "-"}
                    </p>
                    <p className="hidden truncate px-2 text-[0.72rem] font-bold text-[#707070] md:block">
                      {recipe.batchSize || "-"}
                    </p>
                    <p className="hidden truncate px-2 text-[0.72rem] font-bold text-[#707070] md:block">
                      {formatDate(recipe.lastUpdated)}
                    </p>
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

function dateValue(value: string) {
  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function compactRecipeMeta(recipe: Recipe) {
  return [
    recipe.productGroup || recipeTypeLabel(recipe.type),
    recipe.batchSize,
    `gewijzigd ${formatDate(recipe.lastUpdated)}`,
  ]
    .filter(Boolean)
    .join(" · ");
}

function ToolbarButton({
  active = false,
  children,
  label,
  onClick,
}: Readonly<{
  active?: boolean;
  children: ReactNode;
  label: string;
  onClick: () => void;
}>) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`flex h-9 w-9 items-center justify-center border text-[#111111] shadow-sm transition active:scale-95 md:h-10 md:w-10 ${
        active
          ? "border-[#ef4d37] bg-[#ef4d37] text-white"
          : "border-[#c3d3bc] bg-white hover:bg-[#f8f8f6]"
      }`}
    >
      {children}
    </button>
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
    <label className="grid gap-1 text-[0.58rem] font-black uppercase tracking-[0.14em] text-[#8c8c8c]">
      <span>{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 min-w-0 border border-[#c3d3bc] bg-white px-2 text-sm font-bold normal-case tracking-normal text-[#111111] outline-none"
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

function TinyToggle({
  active,
  label,
  onClick,
}: Readonly<{
  active: boolean;
  label: string;
  onClick: () => void;
}>) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-9 border px-2 text-xs font-black transition active:scale-[0.98] ${
        active
          ? "border-[#c3d3bc] bg-[#c3d3bc] text-[#24401f]"
          : "border-[#e7e0d8] bg-[#fffdf8] text-[#707070]"
      }`}
    >
      {label}
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

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <path d="M12 16V5M8 9l4-4 4 4M5 19h14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SlidersIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <path d="M4 7h9M17 7h3M4 17h3M11 17h9M13 5v4M9 15v4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path d="M10.5 18a7.5 7.5 0 1 1 5.3-2.2L20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path d="M20 6v5h-5M4 18v-5h5M18.3 10A7 7 0 0 0 6.7 7M5.7 14A7 7 0 0 0 17.3 17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
