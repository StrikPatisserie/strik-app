import { useMemo, useState } from "react";
import type { Ingredient, Recipe, RecipeUnit } from "./types";
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
  quantityLabel,
  recipesUsingIngredient,
} from "./utils";

const ingredientUnits: RecipeUnit[] = ["gram", "kg", "ml", "liter", "stuk"];

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
  onDeleteIngredient,
  onMergeIngredient,
}: Readonly<{
  ingredients: Ingredient[];
  recipes: Recipe[];
  onUpdateIngredient: (ingredient: Ingredient) => void;
  onDeleteIngredient: (ingredient: Ingredient) => void;
  onMergeIngredient: (sourceIngredient: Ingredient, targetIngredient: Ingredient) => void;
  onDeleteIngredients?: (ingredients: Ingredient[]) => void;
}>) {
  const [search, setSearch] = useState("");
  const [supplier, setSupplier] = useState("all");
  const [allergen, setAllergen] = useState("all");
  const [priceChange, setPriceChange] = useState("all");
  const [selectedIngredient, setSelectedIngredient] = useState<Ingredient | null>(
    null
  );
  const [linkedIngredient, setLinkedIngredient] = useState<Ingredient | null>(
    null
  );
  const suppliers = Array.from(
    new Set(ingredients.map((item) => item.supplier))
  ).filter(Boolean);
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
        <button
          type="button"
          onClick={() => setSelectedIngredient(createBlankIngredient())}
          className="w-fit border border-[#c3d3bc] bg-[#c3d3bc] px-4 py-2.5 text-sm font-black shadow-sm"
        >
          Nieuwe grondstof
        </button>

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
          <div className="overflow-x-auto border border-[#e7e0d8]">
            <div className="hidden grid-cols-[minmax(12rem,1.25fr)_7rem_7rem_6.5rem_7rem_6.5rem_7rem_7rem] gap-3 bg-[#f8f6f3] px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-[#2d2a26]/45 lg:grid lg:min-w-[65rem]">
              <span>Ingredient</span>
              <span>Leverancier</span>
              <span>Artikel</span>
              <span>Eenheid</span>
              <span>Prijs /kg</span>
              <span>Wijziging</span>
              <span>Gekoppeld aan</span>
              <span>Factuur</span>
            </div>
            <div className="divide-y divide-[#e7e0d8] bg-white">
              {filteredIngredients.map((ingredient) => {
                const linkedRecipes = recipesUsingIngredient(recipes, ingredient.id);

                return (
                  <div
                    key={ingredient.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedIngredient(ingredient)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelectedIngredient(ingredient);
                      }
                    }}
                    className="grid w-full cursor-pointer grid-cols-[minmax(0,1fr)_4.8rem_3.7rem] items-center gap-2 px-2.5 py-1.5 text-left transition hover:bg-[#fffdf8] lg:min-w-[65rem] lg:grid-cols-[minmax(12rem,1.25fr)_7rem_7rem_6.5rem_7rem_6.5rem_7rem_7rem] lg:gap-3 lg:px-4 lg:py-2.5"
                  >
                    <div className="min-w-0">
                      <div className="flex min-w-0 items-baseline gap-1.5">
                        <p className="truncate text-[0.82rem] font-black leading-5 lg:text-base lg:leading-normal">
                          {ingredient.name}
                        </p>
                        {ingredient.supplierArticleNumber && (
                          <span className="hidden shrink-0 text-[0.68rem] font-bold leading-none text-[#2d2a26]/35 sm:inline lg:hidden">
                            {ingredient.supplierArticleNumber}
                          </span>
                        )}
                      </div>
                      <p className="hidden text-xs font-bold text-[#2d2a26]/45 lg:block">
                        {ingredient.allergens.length
                          ? ingredient.allergens.join(", ")
                          : "Geen allergenen"}
                      </p>
                    </div>
                    <p className="hidden text-sm font-bold text-[#2d2a26]/62 lg:block">
                      {ingredient.supplier}
                    </p>
                    <p className="hidden text-sm font-bold lg:block">
                      {ingredient.supplierArticleNumber}
                    </p>
                    <p className="hidden text-sm font-bold lg:block">
                      {ingredient.packageSize}
                    </p>
                    <p className="text-right text-[0.78rem] font-black leading-5 tabular-nums lg:text-left lg:text-sm lg:leading-normal">
                      {formatEuro(ingredientPackagePrice(ingredient))}
                    </p>
                    <span
                      className={`w-fit justify-self-end rounded-full px-1.5 py-0.5 text-[0.66rem] font-black leading-4 lg:justify-self-start lg:px-2.5 lg:py-1 lg:text-xs ${changeBadgeClass(
                        ingredientPriceChange(ingredient)
                      )}`}
                    >
                      {formatSignedPercent(ingredientPriceChange(ingredient), 1)}
                    </span>
                    <button
                      type="button"
                      disabled={!linkedRecipes.length}
                      onClick={(event) => {
                        event.stopPropagation();
                        setLinkedIngredient(ingredient);
                      }}
                      className={`hidden w-fit text-left text-xs font-black underline-offset-4 lg:block ${
                        linkedRecipes.length
                          ? "text-[#45663b] hover:underline"
                          : "cursor-default text-[#2d2a26]/35"
                      }`}
                    >
                      {linkedRecipes.length
                        ? `${linkedRecipes.length} recept${
                            linkedRecipes.length === 1 ? "" : "en"
                          }`
                        : "geen"}
                    </button>
                    <p className="hidden text-xs font-bold text-[#2d2a26]/45 lg:block">
                      {ingredient.lastInvoice}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <EmptyState text="Geen ingredienten gevonden met deze filters." />
        )}
      </div>

      {selectedIngredient && (
        <IngredientDetail
          key={selectedIngredient.id}
          ingredient={selectedIngredient}
          ingredients={ingredients}
          recipes={recipes}
          onUpdateIngredient={(ingredient) => {
            onUpdateIngredient(ingredient);
            setSelectedIngredient(ingredient);
          }}
          onMergeIngredient={(sourceIngredient, targetIngredient) => {
            onMergeIngredient(sourceIngredient, targetIngredient);
            setSelectedIngredient(null);
          }}
          onDeleteIngredient={(ingredient) => {
            onDeleteIngredient(ingredient);
            setSelectedIngredient(null);
          }}
          onClose={() => setSelectedIngredient(null)}
        />
      )}

      {linkedIngredient && (
        <IngredientRecipeLinks
          ingredient={linkedIngredient}
          recipes={recipesUsingIngredient(recipes, linkedIngredient.id)}
          onClose={() => setLinkedIngredient(null)}
        />
      )}
    </Panel>
  );
}

export function IngredientDetail({
  ingredient,
  ingredients,
  recipes,
  onUpdateIngredient,
  onMergeIngredient,
  onDeleteIngredient,
  onClose,
}: Readonly<{
  ingredient: Ingredient;
  ingredients: Ingredient[];
  recipes: Recipe[];
  onUpdateIngredient: (ingredient: Ingredient) => void;
  onMergeIngredient: (
    sourceIngredient: Ingredient,
    targetIngredient: Ingredient
  ) => void;
  onDeleteIngredient: (ingredient: Ingredient) => void;
  onClose: () => void;
}>) {
  const linkedRecipes = recipesUsingIngredient(recipes, ingredient.id);
  const mergeCandidates = ingredients
    .filter((item) => item.id !== ingredient.id)
    .sort((first, second) => first.name.localeCompare(second.name, "nl-NL"));
  const [isLinking, setIsLinking] = useState(false);
  const [mergeTargetId, setMergeTargetId] = useState(
    mergeCandidates[0]?.id || ""
  );
  const [name, setName] = useState(ingredient.name);
  const [supplierName, setSupplierName] = useState(ingredient.supplier);
  const [packageSize, setPackageSize] = useState(ingredient.packageSize);
  const [recipeUnit, setRecipeUnit] = useState<RecipeUnit>(ingredient.recipeUnit);
  const [allergensInput, setAllergensInput] = useState(
    ingredient.allergens.join(", ")
  );
  const [articleNumber, setArticleNumber] = useState(
    ingredient.supplierArticleNumber
  );
  const [priceInput, setPriceInput] = useState(
    formatEditablePrice(ingredientPackagePrice(ingredient))
  );
  const [alias, setAlias] = useState("");
  const [ingredientAliasesInput, setIngredientAliasesInput] = useState(
    ingredient.aliases.join("\n")
  );
  const [feedback, setFeedback] = useState("");

  function saveBasics() {
    const updatedIngredient = {
      ...ingredient,
      name: name.trim() || ingredient.name,
      supplier: supplierName.trim() || ingredient.supplier,
      packageSize: packageSize.trim() || ingredient.packageSize,
      recipeUnit,
      allergens: allergensInput
        .split(/[\n,;]+/)
        .map((item) => item.trim())
        .filter(Boolean),
      lastUpdated: new Date().toISOString().slice(0, 10),
    };

    onUpdateIngredient({
      ...updatedIngredient,
      pricePerBaseUnit: pricePerBaseUnitFromPackagePrice(
        ingredientPackagePrice(updatedIngredient),
        updatedIngredient.recipeUnit
      ),
    });
    setFeedback("Grondstof opgeslagen.");
    window.setTimeout(() => setFeedback(""), 2000);
  }

  function saveSupplierLink() {
    const pastedAliases = ingredientAliasesInput
      .split(/[\n,;]+/)
      .map((item) => item.trim())
      .filter(Boolean);
    const nextAliases = Array.from(
      new Set([...ingredient.aliases, ...pastedAliases, alias.trim()].filter(Boolean))
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
    setIngredientAliasesInput(nextAliases.join("\n"));
    setIsLinking(false);
    setFeedback("Ingredientnamen opgeslagen.");
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
        recipeUnit
      ),
      recipeUnit,
      lastUpdated: new Date().toISOString().slice(0, 10),
      lastInvoice: "Handmatig aangepast",
    };

    onUpdateIngredient(updatedIngredient);
    setPriceInput(formatEditablePrice(nextPackagePrice));
    setFeedback("Prijs handmatig aangepast.");
    window.setTimeout(() => setFeedback(""), 2000);
  }

  function requestDeleteIngredient() {
    const confirmed = window.confirm(
      linkedRecipes.length
        ? `${ingredient.name} verwijderen? Deze grondstof staat in ${linkedRecipes.length} recepten. De regels worden daar ook verwijderd en kostprijzen worden opnieuw berekend.`
        : `${ingredient.name} verwijderen uit de grondstoffenlijst?`
    );

    if (confirmed) onDeleteIngredient(ingredient);
  }

  function requestMergeIngredient() {
    const targetIngredient = mergeCandidates.find(
      (item) => item.id === mergeTargetId
    );

    if (!targetIngredient) {
      setFeedback("Kies eerst de grondstof waarmee je wilt samenvoegen.");
      window.setTimeout(() => setFeedback(""), 2000);
      return;
    }

    const confirmed = window.confirm(
      `${ingredient.name} samenvoegen met ${targetIngredient.name}? Alle receptregels en factuurkoppelingen gaan daarna naar ${targetIngredient.name}.`
    );

    if (confirmed) onMergeIngredient(ingredient, targetIngredient);
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
              <MiniMetric label="Verpakking" value={packageSize} />
              <MiniMetric label="Bijgewerkt" value={formatDate(ingredient.lastUpdated)} />
            </div>
            <div className="mt-4 grid gap-3 border border-[#cfdcc8] bg-[#f7faf5] p-3">
              <label className="grid gap-1 text-xs font-black uppercase tracking-[0.12em] text-[#2d2a26]/45">
                Naam
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="border border-[#cfdcc8] bg-white px-3 py-2.5 text-sm font-bold normal-case tracking-normal text-[#2d2a26] focus:outline-none focus:ring-2 focus:ring-[#8fb184]"
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1 text-xs font-black uppercase tracking-[0.12em] text-[#2d2a26]/45">
                  Leverancier
                  <input
                    value={supplierName}
                    onChange={(event) => setSupplierName(event.target.value)}
                    className="border border-[#cfdcc8] bg-white px-3 py-2.5 text-sm font-bold normal-case tracking-normal text-[#2d2a26] focus:outline-none focus:ring-2 focus:ring-[#8fb184]"
                  />
                </label>
                <label className="grid gap-1 text-xs font-black uppercase tracking-[0.12em] text-[#2d2a26]/45">
                  Verpakking
                  <input
                    value={packageSize}
                    onChange={(event) => setPackageSize(event.target.value)}
                    className="border border-[#cfdcc8] bg-white px-3 py-2.5 text-sm font-bold normal-case tracking-normal text-[#2d2a26] focus:outline-none focus:ring-2 focus:ring-[#8fb184]"
                  />
                </label>
                <label className="grid gap-1 text-xs font-black uppercase tracking-[0.12em] text-[#2d2a26]/45">
                  Rekeneenheid
                  <select
                    value={recipeUnit}
                    onChange={(event) => setRecipeUnit(event.target.value as RecipeUnit)}
                    className="border border-[#cfdcc8] bg-white px-3 py-2.5 text-sm font-bold normal-case tracking-normal text-[#2d2a26] focus:outline-none focus:ring-2 focus:ring-[#8fb184]"
                  >
                    {ingredientUnits.map((unit) => (
                      <option key={unit} value={unit}>
                        {unit}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1 text-xs font-black uppercase tracking-[0.12em] text-[#2d2a26]/45">
                  Allergenen
                  <input
                    value={allergensInput}
                    onChange={(event) => setAllergensInput(event.target.value)}
                    placeholder="melk, gluten"
                    className="border border-[#cfdcc8] bg-white px-3 py-2.5 text-sm font-bold normal-case tracking-normal text-[#2d2a26] placeholder:text-[#2d2a26]/35 focus:outline-none focus:ring-2 focus:ring-[#8fb184]"
                  />
                </label>
              </div>
              <button
                type="button"
                onClick={saveBasics}
                className="w-fit border border-[#c3d3bc] bg-[#c3d3bc] px-4 py-2.5 text-sm font-black shadow-sm"
              >
                Basis opslaan
              </button>
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
            <label className="mt-4 grid gap-1 text-xs font-black uppercase tracking-[0.12em] text-[#2d2a26]/45">
              Ingredienten
              <textarea
                value={ingredientAliasesInput}
                onChange={(event) => setIngredientAliasesInput(event.target.value)}
                placeholder="Plak ingredientnamen uit Beko, elk op een nieuwe regel"
                className="min-h-28 resize-y rounded-2xl border border-[#cfdcc8] bg-white px-3 py-3 text-sm font-bold normal-case tracking-normal text-[#2d2a26] placeholder:text-[#2d2a26]/35 focus:outline-none focus:ring-2 focus:ring-[#8fb184]"
              />
            </label>
            <button
              type="button"
              onClick={saveSupplierLink}
              className="mt-3 w-fit rounded-full bg-[#c3d3bc] px-4 py-2.5 text-sm font-black shadow-sm"
            >
              Ingredienten opslaan
            </button>
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
            description="Recepten waarin dit ingredient direct voorkomt."
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

        <Panel className="mt-4 border-[#d9cfbf] bg-[#fffdf8]">
          <SectionTitle
            title="Grondstof samenvoegen"
            description="Gebruik dit voor dubbele grondstoffen, zoals dezelfde roomboter die meerdere keren is ingelezen."
          />
          <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
            <label className="grid gap-1 text-xs font-black uppercase tracking-[0.12em] text-[#2d2a26]/45">
              Samenvoegen met
              <select
                value={mergeTargetId}
                onChange={(event) => setMergeTargetId(event.target.value)}
                className="border border-[#cfdcc8] bg-white px-3 py-2.5 text-sm font-bold normal-case tracking-normal text-[#2d2a26] focus:outline-none focus:ring-2 focus:ring-[#8fb184]"
              >
                {mergeCandidates.length ? (
                  mergeCandidates.map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                      {candidate.name}
                      {candidate.supplier ? ` - ${candidate.supplier}` : ""}
                    </option>
                  ))
                ) : (
                  <option value="">Geen andere grondstoffen</option>
                )}
              </select>
            </label>
            <button
              type="button"
              disabled={!mergeCandidates.length}
              onClick={requestMergeIngredient}
              className="border border-[#c3d3bc] bg-[#c3d3bc] px-4 py-2.5 text-sm font-black shadow-sm disabled:cursor-not-allowed disabled:opacity-45"
            >
              Samenvoegen
            </button>
          </div>
        </Panel>

        <Panel className="mt-4 border-[#efc2bb] bg-[#fff4f1]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-black text-[#a83e31]">
                Grondstof verwijderen
              </p>
              <p className="mt-1 text-xs font-bold leading-snug text-[#2d2a26]/55">
                Gebruik dit voor dubbele artikelen of HF-items die eigenlijk
                halffabricaten zijn.
              </p>
            </div>
            <button
              type="button"
              onClick={requestDeleteIngredient}
              className="rounded-full bg-white px-4 py-2.5 text-sm font-black text-[#a83e31] shadow-sm"
            >
              Verwijder grondstof
            </button>
          </div>
        </Panel>
      </div>
    </div>
  );
}

function createBlankIngredient(): Ingredient {
  const now = new Date().toISOString().slice(0, 10);

  return {
    id: `ingredient-new-${Date.now()}`,
    name: "Nieuwe grondstof",
    supplier: "",
    supplierArticleNumber: "",
    packageSize: "1 kg",
    recipeUnit: "gram",
    lastPrice: 0,
    previousPrice: 0,
    pricePerBaseUnit: 0,
    allergens: [],
    lastUpdated: now,
    status: "active",
    lastInvoice: "Handmatig toegevoegd",
    aliases: [],
  };
}

function IngredientRecipeLinks({
  ingredient,
  recipes,
  onClose,
}: Readonly<{
  ingredient: Ingredient;
  recipes: Recipe[];
  onClose: () => void;
}>) {
  return (
    <div className="fixed inset-0 z-[80] overflow-y-auto bg-[#2d2a26]/35 px-3 py-5 backdrop-blur-sm">
      <div className="mx-auto max-w-2xl border border-[#111111] bg-white p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[#2d2a26]/45">
              Gekoppeld aan
            </p>
            <h2 className="mt-1 text-2xl font-black leading-tight">
              {ingredient.name}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-3xl font-light leading-none"
            aria-label="Sluit"
          >
            ×
          </button>
        </div>

        <div className="mt-5 divide-y divide-[#d9d2c9] border-y border-[#d9d2c9]">
          {recipes.length ? (
            recipes.map((recipe) => {
              const linkedLines = recipe.ingredients.filter(
                (line) => line.ingredientId === ingredient.id
              );
              const linkedQuantity = linkedLines
                .map((line) => quantityLabel(line.quantity, line.unit))
                .join(" + ");

              return (
                <div
                  key={recipe.id}
                  className="grid gap-2 py-3 sm:grid-cols-[minmax(0,1fr)_9rem_8rem] sm:items-center"
                >
                  <div className="min-w-0">
                    <p className="truncate text-base font-black">
                      {recipe.name}
                    </p>
                    <p className="text-xs font-bold text-[#2d2a26]/45">
                      {recipe.productGroup || "Geen categorie"} ·{" "}
                      {recipe.type === "semiFinished"
                        ? "halffabricaat"
                        : "eindproduct"}
                    </p>
                  </div>
                  <p className="text-sm font-bold text-[#2d2a26]/60">
                    {linkedQuantity || "-"}
                  </p>
                  <p className="text-sm font-black">
                    {formatEuro(recipe.costPrice)}
                  </p>
                </div>
              );
            })
          ) : (
            <p className="py-4 text-sm font-bold text-[#2d2a26]/45">
              Deze grondstof staat nog niet in recepten.
            </p>
          )}
        </div>
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
