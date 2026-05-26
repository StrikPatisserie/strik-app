import { useMemo, useState } from "react";
import type { Ingredient, Recipe } from "./types";
import {
  EmptyState,
  FilterSelect,
  Panel,
  SearchInput,
  SectionTitle,
} from "./RecepturenShared";
import {
  changeBadgeClass,
  formatDate,
  formatEuro,
  formatSignedPercent,
  ingredientPackagePrice,
  ingredientPreviousPackagePrice,
  ingredientPriceChange,
  normalizeSearch,
  packagePriceLabel,
  pricePerBaseUnitFromPackagePrice,
  recipesUsingIngredient,
} from "./utils";

function formatEditablePrice(value: number) {
  return value.toLocaleString("nl-NL", {
    maximumFractionDigits: 4,
    minimumFractionDigits: 2,
  });
}

function parseDutchPriceInput(value: string) {
  const normalized = value
    .trim()
    .replace(/\s/g, "")
    .replace(/€|\u00a0/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const parsed = Number.parseFloat(normalized.replace(/[^\d.-]/g, ""));

  return Number.isFinite(parsed) ? parsed : 0;
}

export default function IngredientsList({
  ingredients,
  recipes,
  onUpdateIngredient,
}: Readonly<{
  ingredients: Ingredient[];
  recipes: Recipe[];
  onUpdateIngredient: (ingredient: Ingredient) => void;
}>) {
  const [search, setSearch] = useState("");
  const [supplier, setSupplier] = useState("all");
  const [allergen, setAllergen] = useState("all");
  const [priceChange, setPriceChange] = useState("all");
  const [selectedIngredient, setSelectedIngredient] = useState<Ingredient | null>(
    null
  );
  const suppliers = Array.from(new Set(ingredients.map((item) => item.supplier)));
  const allergens = Array.from(
    new Set(ingredients.flatMap((item) => item.allergens))
  ).sort((first, second) => first.localeCompare(second, "nl-NL"));

  const filteredIngredients = useMemo(() => {
    const query = normalizeSearch(search);

    return ingredients.filter((ingredient) => {
      const matchesSearch =
        !query ||
        normalizeSearch(ingredient.name).includes(query) ||
        normalizeSearch(ingredient.supplierArticleNumber).includes(query) ||
        ingredient.aliases.some((alias) => normalizeSearch(alias).includes(query));
      const matchesSupplier =
        supplier === "all" || ingredient.supplier === supplier;
      const matchesAllergen =
        allergen === "all" || ingredient.allergens.includes(allergen);
      const change = ingredientPriceChange(ingredient);
      const matchesPrice =
        priceChange === "all" ||
        (priceChange === "up" && change > 0) ||
        (priceChange === "high" && change >= 8) ||
        (priceChange === "stable" && Math.abs(change) < 2);

      return (
        matchesSearch && matchesSupplier && matchesAllergen && matchesPrice
      );
    });
  }, [allergen, ingredients, priceChange, search, supplier]);

  return (
    <Panel>
      <div className="grid gap-4">
        <SectionTitle
          eyebrow="Grondstoffen"
          title="Ingredienten"
          description="Database met leveranciersartikelen, prijshistorie, allergenen en recept-impact."
        />

        <div className="grid gap-3 lg:grid-cols-[minmax(0,1.2fr)_repeat(3,minmax(10rem,0.7fr))]">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Zoek ingredient, artikelnummer of alias"
          />
          <FilterSelect
            label="Leverancier"
            value={supplier}
            onChange={setSupplier}
            options={[
              { value: "all", label: "Alle leveranciers" },
              ...suppliers.map((item) => ({ value: item, label: item })),
            ]}
          />
          <FilterSelect
            label="Allergeen"
            value={allergen}
            onChange={setAllergen}
            options={[
              { value: "all", label: "Alle allergenen" },
              ...allergens.map((item) => ({ value: item, label: item })),
            ]}
          />
          <FilterSelect
            label="Prijs"
            value={priceChange}
            onChange={setPriceChange}
            options={[
              { value: "all", label: "Alle wijzigingen" },
              { value: "up", label: "Prijsstijging" },
              { value: "high", label: "Sterke stijging" },
              { value: "stable", label: "Stabiel" },
            ]}
          />
        </div>

        {filteredIngredients.length ? (
          <div className="overflow-hidden rounded-[1.15rem] border border-[#e7e0d8]">
            <div className="hidden grid-cols-[minmax(13rem,1.2fr)_8rem_8rem_7rem_8rem_7rem_8rem] gap-3 bg-[#f8f6f3] px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-[#2d2a26]/45 xl:grid">
              <span>Ingredient</span>
              <span>Leverancier</span>
              <span>Artikel</span>
              <span>Eenheid</span>
              <span>Prijs /kg</span>
              <span>Wijziging</span>
              <span>Factuur</span>
            </div>
            <div className="divide-y divide-[#e7e0d8] bg-white">
              {filteredIngredients.map((ingredient) => (
                <button
                  key={ingredient.id}
                  type="button"
                  onClick={() => setSelectedIngredient(ingredient)}
                  className="grid w-full gap-3 px-4 py-4 text-left transition hover:bg-[#fffdf8] xl:grid-cols-[minmax(13rem,1.2fr)_8rem_8rem_7rem_8rem_7rem_8rem] xl:items-center"
                >
                  <div className="min-w-0">
                    <p className="truncate text-base font-black">{ingredient.name}</p>
                    <p className="text-xs font-bold text-[#2d2a26]/45">
                      {ingredient.allergens.length
                        ? ingredient.allergens.join(", ")
                        : "Geen allergenen"}
                    </p>
                  </div>
                  <p className="text-sm font-bold text-[#2d2a26]/62">
                    {ingredient.supplier}
                  </p>
                  <p className="text-sm font-bold">{ingredient.supplierArticleNumber}</p>
                  <p className="text-sm font-bold">{ingredient.packageSize}</p>
                  <p className="text-sm font-black">
                    {formatEuro(ingredientPackagePrice(ingredient))}
                  </p>
                  <span
                    className={`w-fit rounded-full px-2.5 py-1 text-xs font-black ${changeBadgeClass(
                      ingredientPriceChange(ingredient)
                    )}`}
                  >
                    {formatSignedPercent(ingredientPriceChange(ingredient), 1)}
                  </span>
                  <p className="text-xs font-bold text-[#2d2a26]/45">
                    {ingredient.lastInvoice}
                  </p>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <EmptyState text="Geen ingredienten gevonden met deze filters." />
        )}
      </div>

      {selectedIngredient && (
        <IngredientDetail
          ingredient={selectedIngredient}
          recipes={recipes}
          onUpdateIngredient={(ingredient) => {
            onUpdateIngredient(ingredient);
            setSelectedIngredient(ingredient);
          }}
          onClose={() => setSelectedIngredient(null)}
        />
      )}
    </Panel>
  );
}

function IngredientDetail({
  ingredient,
  recipes,
  onUpdateIngredient,
  onClose,
}: Readonly<{
  ingredient: Ingredient;
  recipes: Recipe[];
  onUpdateIngredient: (ingredient: Ingredient) => void;
  onClose: () => void;
}>) {
  const linkedRecipes = recipesUsingIngredient(recipes, ingredient.id);
  const [isLinking, setIsLinking] = useState(false);
  const [articleNumber, setArticleNumber] = useState(
    ingredient.supplierArticleNumber
  );
  const [priceInput, setPriceInput] = useState(
    formatEditablePrice(ingredientPackagePrice(ingredient))
  );
  const [alias, setAlias] = useState("");
  const [feedback, setFeedback] = useState("");

  function saveSupplierLink() {
    const nextAliases = Array.from(
      new Set([...ingredient.aliases, alias.trim()].filter(Boolean))
    );
    const updatedIngredient = {
      ...ingredient,
      supplierArticleNumber:
        articleNumber.trim() || ingredient.supplierArticleNumber,
      aliases: nextAliases,
      lastUpdated: new Date().toISOString().slice(0, 10),
    };

    onUpdateIngredient(updatedIngredient);
    setAlias("");
    setIsLinking(false);
    setFeedback("Koppeling opgeslagen.");
    window.setTimeout(() => setFeedback(""), 2000);
  }

  function saveManualPrice() {
    const nextPackagePrice = parseDutchPriceInput(priceInput);

    if (nextPackagePrice <= 0) {
      setFeedback("Vul een geldige prijs groter dan 0 in.");
      return;
    }

    const currentPackagePrice = ingredientPackagePrice(ingredient);
    const updatedIngredient = {
      ...ingredient,
      previousPrice: currentPackagePrice,
      lastPrice: nextPackagePrice,
      pricePerBaseUnit: pricePerBaseUnitFromPackagePrice(
        nextPackagePrice,
        ingredient.recipeUnit
      ),
      lastUpdated: new Date().toISOString().slice(0, 10),
      lastInvoice: "Handmatig aangepast",
    };

    onUpdateIngredient(updatedIngredient);
    setPriceInput(formatEditablePrice(nextPackagePrice));
    setFeedback("Prijs handmatig aangepast.");
    window.setTimeout(() => setFeedback(""), 2000);
  }

  return (
    <div className="fixed inset-0 z-[70] overflow-y-auto bg-[#2d2a26]/35 px-3 py-5 backdrop-blur-sm">
      <div className="mx-auto max-w-3xl rounded-[1.5rem] border border-[#e7e0d8] bg-[#f4f0ea] p-4 shadow-2xl">
        <div className="flex flex-wrap items-start justify-between gap-3 rounded-[1.25rem] bg-white/88 p-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[#2d2a26]/45">
              Ingredient detail
            </p>
            <h2 className="mt-1 text-3xl font-black leading-tight">
              {ingredient.name}
            </h2>
            <p className="mt-2 text-sm font-bold text-[#2d2a26]/55">
              {ingredient.supplier} · {ingredient.supplierArticleNumber}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-white px-4 py-2 text-sm font-black shadow-sm"
          >
            Sluit
          </button>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Panel>
            <SectionTitle title="Prijs en leverancier" />
            <div className="mt-3 grid grid-cols-2 gap-2">
              <MiniMetric
                label={packagePriceLabel(ingredient.recipeUnit)}
                value={formatEuro(ingredientPackagePrice(ingredient))}
              />
              <MiniMetric
                label={`Vorige ${packagePriceLabel(ingredient.recipeUnit).toLowerCase()}`}
                value={formatEuro(ingredientPreviousPackagePrice(ingredient))}
              />
              <MiniMetric
                label="Per basiseenheid"
                value={formatEuro(ingredient.pricePerBaseUnit)}
              />
              <MiniMetric
                label="Wijziging"
                value={formatSignedPercent(ingredientPriceChange(ingredient), 1)}
                className={changeBadgeClass(ingredientPriceChange(ingredient))}
              />
              <MiniMetric label="Verpakking" value={ingredient.packageSize} />
              <MiniMetric label="Bijgewerkt" value={formatDate(ingredient.lastUpdated)} />
            </div>
            <div className="mt-4 grid gap-3 rounded-2xl border border-[#cfdcc8] bg-[#f7faf5] p-3">
              <label className="grid gap-1 text-xs font-black uppercase tracking-[0.12em] text-[#2d2a26]/45">
                Handmatige {packagePriceLabel(ingredient.recipeUnit).toLowerCase()}
                <input
                  value={priceInput}
                  onChange={(event) => setPriceInput(event.target.value)}
                  inputMode="decimal"
                  className="rounded-2xl border border-[#cfdcc8] bg-white px-3 py-3 text-sm font-bold normal-case tracking-normal text-[#2d2a26] focus:outline-none focus:ring-2 focus:ring-[#8fb184]"
                />
              </label>
              <button
                type="button"
                onClick={saveManualPrice}
                className="w-fit rounded-full bg-[#c3d3bc] px-4 py-2.5 text-sm font-black shadow-sm"
              >
                Prijs opslaan
              </button>
            </div>
          </Panel>

          <Panel>
            <SectionTitle title="Koppelingen en aliases" />
            <div className="mt-3 flex flex-wrap gap-2">
              {ingredient.aliases.map((alias) => (
                <span
                  key={alias}
                  className="rounded-full bg-[#f8f6f3] px-3 py-1 text-xs font-black text-[#2d2a26]/55"
                >
                  {alias}
                </span>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setIsLinking((current) => !current)}
              className="mt-4 rounded-full bg-[#c3d3bc] px-4 py-2.5 text-sm font-black shadow-sm"
            >
              {isLinking ? "Koppeling sluiten" : "Koppelen aan leveranciersartikel"}
            </button>
            {isLinking && (
              <div className="mt-4 grid gap-3 rounded-2xl border border-[#cfdcc8] bg-[#f7faf5] p-3">
                <label className="grid gap-1 text-xs font-black uppercase tracking-[0.12em] text-[#2d2a26]/45">
                  Artikelnummer
                  <input
                    value={articleNumber}
                    onChange={(event) => setArticleNumber(event.target.value)}
                    className="rounded-2xl border border-[#cfdcc8] bg-white px-3 py-3 text-sm font-bold normal-case tracking-normal text-[#2d2a26] focus:outline-none focus:ring-2 focus:ring-[#8fb184]"
                  />
                </label>
                <label className="grid gap-1 text-xs font-black uppercase tracking-[0.12em] text-[#2d2a26]/45">
                  Extra alias
                  <input
                    value={alias}
                    onChange={(event) => setAlias(event.target.value)}
                    placeholder="Naam zoals op factuur"
                    className="rounded-2xl border border-[#cfdcc8] bg-white px-3 py-3 text-sm font-bold normal-case tracking-normal text-[#2d2a26] placeholder:text-[#2d2a26]/35 focus:outline-none focus:ring-2 focus:ring-[#8fb184]"
                  />
                </label>
                <button
                  type="button"
                  onClick={saveSupplierLink}
                  className="w-fit rounded-full bg-[#c3d3bc] px-4 py-2.5 text-sm font-black shadow-sm"
                >
                  Koppeling opslaan
                </button>
              </div>
            )}
            {feedback && (
              <p className="mt-3 text-xs font-black text-[#45663b]">
                {feedback}
              </p>
            )}
          </Panel>
        </div>

        <Panel className="mt-4">
          <SectionTitle
            title="Impact op recepten"
            description="Recepten waarin dit ingredient direct voorkomt. Halffabricaat-impact wordt later verdiept via de calculatie-engine."
          />
          <div className="mt-3 grid gap-2">
            {linkedRecipes.length ? (
              linkedRecipes.map((recipe) => (
                <div
                  key={recipe.id}
                  className="flex items-center justify-between gap-3 rounded-2xl bg-[#fffdf8] p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black">{recipe.name}</p>
                    <p className="text-xs font-bold text-[#2d2a26]/45">
                      {recipe.productGroup} · {recipe.version}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-black">
                    {formatEuro(recipe.costPrice)}
                  </p>
                </div>
              ))
            ) : (
              <p className="rounded-2xl bg-[#f8f6f3] p-3 text-sm font-bold text-[#2d2a26]/45">
                Nog niet direct gekoppeld aan een recept.
              </p>
            )}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function MiniMetric({
  label,
  value,
  className = "bg-[#f8f6f3]",
}: Readonly<{ label: string; value: string; className?: string }>) {
  return (
    <div className={`rounded-2xl p-3 ${className}`}>
      <p className="text-[0.65rem] font-black uppercase tracking-[0.12em] opacity-60">
        {label}
      </p>
      <p className="mt-1 truncate text-sm font-black">{value}</p>
    </div>
  );
}
