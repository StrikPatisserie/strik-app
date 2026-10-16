import { type ReactNode, useMemo, useState } from "react";
import { productGroups } from "./mockData";
import type { Recipe } from "./types";
import { EmptyState } from "./RecepturenShared";
import styles from "./RecipeScreens.module.css";
import {
  formatDate,
  normalizeSearch,
  productionLogForRecipe,
  recipeHasMissingQuantities,
  recipeTypeLabel,
} from "./utils";

export default function RecipesList({
  recipes,
  canManage = true,
  scope = "all",
  onOpenRecipe,
  onCreateRecipe,
  onOpenImport,
  onRecalculateAll,
}: Readonly<{
  recipes: Recipe[];
  canManage?: boolean;
  scope?: RecipeListScope;
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

  const allGroupOptions = useMemo(
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
  const groupOptions = useMemo(() => {
    if (scope === "iceChocolate") return iceChocolateFilterGroups;
    if (scope === "bakery") {
      return allGroupOptions.filter((item) => !isIceChocolateCategory(item));
    }

    return allGroupOptions;
  }, [allGroupOptions, scope]);

  const activeGroup = useMemo(() => {
    const allowedGroups = new Set([
      "all",
      ...groupOptions.map((item) => normalizeSearch(item)),
    ]);

    return allowedGroups.has(normalizeSearch(group)) ? group : "all";
  }, [group, groupOptions]);

  const filteredRecipes = useMemo(() => {
    const query = normalizeSearch(search);

    return recipes
      .filter((recipe) => {
        const matchesSearch =
          !query ||
          normalizeSearch(recipe.name).includes(query) ||
          normalizeSearch(recipe.strikArticleNumber || "").includes(query);
        const matchesGroup = recipeMatchesGroupFilter(recipe, activeGroup);
        const matchesStatus = status === "all" || recipe.status === status;
        const matchesType = type === "all" || recipe.type === type;

        return matchesSearch && matchesGroup && matchesStatus && matchesType;
      })
      .sort((a, b) => {
        if (sortBy === "updated") {
          return (
            latestProductionValue(b) - latestProductionValue(a) ||
            a.name.localeCompare(b.name, "nl")
          );
        }

        if (sortBy === "created") {
          return (
            recipeCreatedValue(b) - recipeCreatedValue(a) ||
            a.name.localeCompare(b.name, "nl")
          );
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
  }, [activeGroup, recipes, search, sortBy, status, type]);

  return (
    <section className={styles.list}>
      <div className={styles.listHeader}>
        <div className="min-w-0">
          <h2 className="truncate">
            Recepten
          </h2>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {canManage && <ToolbarButton label="Nieuw recept" onClick={onCreateRecipe}>
            <PlusIcon />
          </ToolbarButton>}
          {canManage && <ToolbarButton label="Bestand uploaden" onClick={onOpenImport}>
            <UploadIcon />
          </ToolbarButton>}
          <ToolbarButton
            label="Sorteren en filteren"
            onClick={() => setFiltersOpen((current) => !current)}
            active={filtersOpen}
          >
            <SlidersIcon />
          </ToolbarButton>
        </div>
      </div>

      <label className={styles.search}>
        <SearchIcon />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Zoek recept of artikelnummer"
          aria-label="Zoek recept of artikelnummer"
        />
      </label>

      {filtersOpen && (
        <div className={styles.filterPanel}>
          <CompactSelect
            label="Categorie"
            value={activeGroup}
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
              { value: "updated", label: "Laatste productie" },
              { value: "created", label: "Datum toegevoegd" },
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

          <div className="flex items-center justify-between gap-2 md:col-span-3">
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
                className="h-8 rounded-lg border border-[#e7e0d8] bg-white px-3 text-xs font-bold text-[#756b60]"
              >
                Reset
              </button>
              <button
                type="button"
                onClick={() => setFiltersOpen(false)}
                className="h-8 rounded-lg bg-[#315e42] px-3 text-xs font-bold text-white"
              >
                Sluiten
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

      <div className={styles.table}>
        {filteredRecipes.length ? (
          <>
            <div className={styles.tableHeader}>
              <span />
              <span>Recept</span>
              <span>Artikel</span>
              <span className={styles.kind}>Soort</span>
              <span>Categorie</span>
              <span>Batch</span>
              <span>Laatste productie</span>
            </div>
            <div className={styles.rows}>
              {filteredRecipes.map((recipe) => {
                return (
                  <button
                    key={recipe.id}
                    type="button"
                    onClick={() => onOpenRecipe(recipe)}
                    className={styles.row}
                  >
                    <span className={`${styles.stripe} ${recipeStripeClass(recipe)}`} />
                    <div className={styles.recipeName}>
                      <p title={recipe.name}>
                        {recipe.name}
                      </p>
                      <p className={styles.mobileMeta}>
                        {compactRecipeMeta(recipe)}
                      </p>
                    </div>
                    <p className={styles.cell}>
                      {recipe.strikArticleNumber || "-"}
                    </p>
                    <p className={`${styles.cell} ${styles.kind}`}>
                      {recipeTypeLabel(recipe.type)}
                    </p>
                    <p className={styles.cell}>
                      {recipe.productGroup || "-"}
                    </p>
                    <p className={styles.cell}>
                      {recipeHasMissingQuantities(recipe) ? "Concept" : recipe.batchSize || "-"}
                    </p>
                    <p className={styles.cell}>
                      {latestProductionLabel(recipe)}
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

type RecipeListScope = "all" | "bakery" | "iceChocolate";

const iceChocolateFilterGroups = ["IJs", "Chocolade", "Bonbons"];

function isIceCategory(value: string) {
  return normalizeSearch(value).includes("ijs");
}

function isChocolateCategory(value: string) {
  const normalized = normalizeSearch(value);

  return normalized.includes("choco") || normalized.includes("chocolade");
}

function isBonbonCategory(value: string) {
  return normalizeSearch(value).includes("bonbon");
}

function isIceChocolateCategory(value: string) {
  return isIceCategory(value) || isChocolateCategory(value) || isBonbonCategory(value);
}

function recipeMatchesGroupFilter(recipe: Recipe, group: string) {
  if (group === "all") return true;

  const recipeGroup = recipe.productGroup || "";

  if (group === "IJs") return isIceCategory(recipeGroup);
  if (group === "Chocolade") return isChocolateCategory(recipeGroup);
  if (group === "Bonbons") return isBonbonCategory(recipeGroup);

  return normalizeSearch(recipeGroup) === normalizeSearch(group);
}

function dateValue(value: string) {
  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function latestProductionEntry(recipe: Recipe) {
  return productionLogForRecipe(recipe).find((entry) => entry.source !== "stock");
}

function latestProductionValue(recipe: Recipe) {
  const entry = latestProductionEntry(recipe);

  return entry ? dateValue(entry.date) : 0;
}

function recipeCreatedValue(recipe: Recipe) {
  if (recipe.createdAt) return dateValue(recipe.createdAt);

  const timestampMatch = recipe.id.match(/(?:recipe-new|hf-new)-(\d{10,})/);
  if (timestampMatch) {
    const timestamp = Number(timestampMatch[1]);

    return Number.isFinite(timestamp) ? timestamp : 0;
  }

  return dateValue(recipe.lastUpdated);
}

function latestProductionLabel(recipe: Recipe) {
  const entry = latestProductionEntry(recipe);

  return entry ? formatDate(entry.date) : "-";
}

function compactRecipeMeta(recipe: Recipe) {
  const latestProduction = latestProductionLabel(recipe);

  return [
    recipe.productGroup || recipeTypeLabel(recipe.type),
    recipe.strikArticleNumber ? `art. ${recipe.strikArticleNumber}` : "",
    recipe.batchSize,
    latestProduction === "-"
      ? "nog niet gemaakt"
      : `laatste productie ${latestProduction}`,
  ]
    .filter(Boolean)
    .join(" · ");
}

function ToolbarButton({
  active,
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
      className={styles.toolbarButton}
      aria-pressed={active}
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
    <label className={styles.selectLabel}>
      <span>{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
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
      aria-pressed={active}
      className={`${styles.tinyToggle} ${
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
