import { type ReactNode, useMemo, useState } from "react";
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
const compactInputClass =
  "h-8 w-full min-w-0 bg-transparent text-sm font-bold text-[#2d2a26] outline-none placeholder:text-[#2d2a26]/35 focus:ring-0";

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
  onOpenImport,
  onDeleteIngredient,
  onMergeIngredient,
}: Readonly<{
  ingredients: Ingredient[];
  recipes: Recipe[];
  onUpdateIngredient: (ingredient: Ingredient) => void;
  onOpenImport: () => void;
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
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setSelectedIngredient(createBlankIngredient())}
            className="border border-[#c3d3bc] bg-[#c3d3bc] px-4 py-2.5 text-sm font-black shadow-sm"
          >
            Nieuwe grondstof
          </button>
          <button
            type="button"
            onClick={onOpenImport}
            className="border border-[#ead7a6] bg-[#fff8e3] px-4 py-2.5 text-sm font-black text-[#7a5a18] shadow-sm"
          >
            Bestand uploaden
          </button>
        </div>

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
  const [isMergeOpen, setIsMergeOpen] = useState(false);
  const [isUsedInOpen, setIsUsedInOpen] = useState(false);
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

  function saveIngredient() {
    const nextPackagePrice = parseDutchPriceInput(priceInput);
    const currentPackagePrice = ingredientPackagePrice(ingredient);
    const effectivePackagePrice =
      nextPackagePrice > 0 ? nextPackagePrice : currentPackagePrice;
    const pastedAliases = ingredientAliasesInput
      .split(/[\n,;]+/)
      .map((item) => item.trim())
      .filter(Boolean);
    const nextAliases = Array.from(
      new Set([...pastedAliases, alias.trim()].filter(Boolean))
    );
    const priceChanged =
      effectivePackagePrice > 0 &&
      Math.abs(effectivePackagePrice - currentPackagePrice) > 0.0001;
    const updatedIngredient = {
      ...ingredient,
      name: name.trim() || ingredient.name,
      supplier: supplierName.trim() || ingredient.supplier,
      supplierArticleNumber:
        articleNumber.trim() || ingredient.supplierArticleNumber,
      packageSize: packageSize.trim() || ingredient.packageSize,
      recipeUnit,
      previousPrice: priceChanged ? currentPackagePrice : ingredient.previousPrice,
      lastPrice: effectivePackagePrice,
      allergens: allergensInput
        .split(/[\n,;]+/)
        .map((item) => item.trim())
        .filter(Boolean),
      aliases: nextAliases,
      lastUpdated: new Date().toISOString().slice(0, 10),
      lastInvoice: priceChanged ? "Handmatig aangepast" : ingredient.lastInvoice,
    };

    onUpdateIngredient({
      ...updatedIngredient,
      pricePerBaseUnit: pricePerBaseUnitFromPackagePrice(
        effectivePackagePrice,
        updatedIngredient.recipeUnit
      ),
    });
    setAlias("");
    setIngredientAliasesInput(nextAliases.join("\n"));
    setIsLinking(false);
    setFeedback("Grondstof opgeslagen.");
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
      <div className="mx-auto max-w-3xl border border-[#d9d2c9] bg-[#f4f0ea] p-3 shadow-2xl">
        <div className="sticky top-3 z-10 border border-[#d9d2c9] bg-white px-3 py-2 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[0.62rem] font-black uppercase tracking-[0.18em] text-[#2d2a26]/45">
                Grondstof
              </p>
              <h2 className="truncate text-2xl font-black leading-tight">
                {ingredient.name}
              </h2>
              <p className="truncate text-xs font-bold text-[#2d2a26]/50">
                {[ingredient.supplier, ingredient.supplierArticleNumber]
                  .filter(Boolean)
                  .join(" · ") || "Nieuwe grondstof"}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <DetailIconButton label="Opslaan" onClick={saveIngredient}>
                <SaveIcon />
              </DetailIconButton>
              <DetailIconButton
                label="Samenvoegen"
                onClick={() => setIsMergeOpen((current) => !current)}
                active={isMergeOpen}
                disabled={!mergeCandidates.length}
              >
                <MergeIcon />
              </DetailIconButton>
              <DetailIconButton
                label="Verwijderen"
                onClick={requestDeleteIngredient}
                danger
              >
                <TrashIcon />
              </DetailIconButton>
              <DetailIconButton label="Sluiten" onClick={onClose}>
                <CloseIcon />
              </DetailIconButton>
            </div>
          </div>
          {feedback && (
            <p className="mt-2 border-t border-[#e7e0d8] pt-2 text-xs font-black text-[#45663b]">
              {feedback}
            </p>
          )}
        </div>

        <section className="mt-3 border border-[#d9d2c9] bg-white">
          <div className="grid border-b border-[#d9d2c9] bg-[#f8f6f3] px-3 py-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
            <h3 className="text-base font-black">Prijs en leverancier</h3>
            <p className="text-xs font-bold text-[#2d2a26]/50">
              Bijgewerkt {formatDate(ingredient.lastUpdated)}
            </p>
          </div>
          <div className="grid divide-y divide-[#e7e0d8] lg:grid-cols-2 lg:divide-x lg:divide-y-0">
            <div className="divide-y divide-[#e7e0d8]">
              <CompactInputRow label="Naam">
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className={compactInputClass}
                />
              </CompactInputRow>
              <CompactInputRow label="Leverancier">
                <input
                  value={supplierName}
                  onChange={(event) => setSupplierName(event.target.value)}
                  className={compactInputClass}
                />
              </CompactInputRow>
              <CompactInputRow label="Artikelnummer">
                <input
                  value={articleNumber}
                  onChange={(event) => setArticleNumber(event.target.value)}
                  className={compactInputClass}
                />
              </CompactInputRow>
              <CompactInputRow label="Verpakking">
                <input
                  value={packageSize}
                  onChange={(event) => setPackageSize(event.target.value)}
                  className={compactInputClass}
                />
              </CompactInputRow>
            </div>
            <div className="divide-y divide-[#e7e0d8]">
              <CompactInputRow label={packagePriceLabel(recipeUnit)}>
                <input
                  value={priceInput}
                  onChange={(event) => setPriceInput(event.target.value)}
                  inputMode="decimal"
                  className={`${compactInputClass} font-black`}
                />
              </CompactInputRow>
              <CompactInfoRow
                label={`Vorige ${packagePriceLabel(ingredient.recipeUnit).toLowerCase()}`}
                value={formatEuro(ingredientPreviousPackagePrice(ingredient))}
              />
              <CompactInfoRow
                label="Wijziging"
                value={formatSignedPercent(ingredientPriceChange(ingredient), 1)}
                valueClassName={changeBadgeClass(ingredientPriceChange(ingredient))}
              />
              <CompactInputRow label="Rekeneenheid">
                <select
                  value={recipeUnit}
                  onChange={(event) => setRecipeUnit(event.target.value as RecipeUnit)}
                  className={compactInputClass}
                >
                  {ingredientUnits.map((unit) => (
                    <option key={unit} value={unit}>
                      {unit}
                    </option>
                  ))}
                </select>
              </CompactInputRow>
              <CompactInputRow label="Allergenen">
                <input
                  value={allergensInput}
                  onChange={(event) => setAllergensInput(event.target.value)}
                  placeholder="melk, gluten"
                  className={compactInputClass}
                />
              </CompactInputRow>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#d9d2c9] px-3 py-2">
            <div className="flex flex-wrap gap-1">
              {ingredient.aliases.length ? (
                ingredient.aliases.slice(0, 6).map((item) => (
                  <span
                    key={item}
                    className="bg-[#f1eee9] px-2 py-1 text-[0.65rem] font-black text-[#2d2a26]/55"
                  >
                    {item}
                  </span>
                ))
              ) : (
                <span className="text-xs font-bold text-[#2d2a26]/40">
                  Nog geen aliases
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => setIsLinking((current) => !current)}
              className={`inline-flex h-8 items-center gap-2 border px-3 text-xs font-black ${
                isLinking
                  ? "border-[#c3d3bc] bg-[#c3d3bc] text-[#24401f]"
                  : "border-[#d9d2c9] bg-white text-[#2d2a26]"
              }`}
            >
              <LinkIcon />
              Koppelen
            </button>
          </div>
          {isLinking && (
            <div className="grid gap-2 border-t border-[#d9d2c9] bg-[#fffdf8] p-3 sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
              <CompactInputRow label="Extra alias" boxed>
                <input
                  value={alias}
                  onChange={(event) => setAlias(event.target.value)}
                  placeholder="Naam zoals op factuur"
                  className={compactInputClass}
                />
              </CompactInputRow>
              <label className="grid gap-1 text-[0.6rem] font-black uppercase tracking-[0.14em] text-[#2d2a26]/45">
                Aliases
                <textarea
                  value={ingredientAliasesInput}
                  onChange={(event) => setIngredientAliasesInput(event.target.value)}
                  placeholder="Plak ingredientnamen uit Beko, elk op een nieuwe regel"
                  className="min-h-24 resize-y border border-[#d9d2c9] bg-white px-3 py-2 text-sm font-bold normal-case tracking-normal text-[#2d2a26] placeholder:text-[#2d2a26]/35 focus:outline-none focus:ring-2 focus:ring-[#8fb184]"
                />
              </label>
            </div>
          )}
        </section>

        <section className="mt-3 border border-[#d9d2c9] bg-white">
          <button
            type="button"
            onClick={() => setIsUsedInOpen((current) => !current)}
            className="grid w-full grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 px-3 py-2 text-left"
          >
            <span className="text-base font-black">Komt voor in</span>
            <span className="text-xs font-black text-[#2d2a26]/50">
              {linkedRecipes.length} recept{linkedRecipes.length === 1 ? "" : "en"}
            </span>
            <ChevronIcon open={isUsedInOpen} />
          </button>
          {isUsedInOpen && (
            <div className="divide-y divide-[#e7e0d8] border-t border-[#d9d2c9]">
              {linkedRecipes.length ? (
                linkedRecipes.map((recipe) => (
                  <div
                    key={recipe.id}
                    className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black">{recipe.name}</p>
                      <p className="text-[0.68rem] font-bold text-[#2d2a26]/45">
                        {recipe.productGroup} · {recipe.version}
                      </p>
                    </div>
                    <p className="text-sm font-black">
                      {formatEuro(recipe.costPrice)}
                    </p>
                  </div>
                ))
              ) : (
                <p className="px-3 py-2 text-sm font-bold text-[#2d2a26]/45">
                  Deze grondstof staat nog niet in recepten.
                </p>
              )}
            </div>
          )}
        </section>

        {isMergeOpen && (
          <section className="mt-3 border border-[#d9d2c9] bg-[#fffdf8] p-3">
            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
              <label className="grid gap-1 text-[0.6rem] font-black uppercase tracking-[0.14em] text-[#2d2a26]/45">
                Samenvoegen met
                <select
                  value={mergeTargetId}
                  onChange={(event) => setMergeTargetId(event.target.value)}
                  className="h-9 border border-[#d9d2c9] bg-white px-3 text-sm font-bold normal-case tracking-normal text-[#2d2a26] focus:outline-none focus:ring-2 focus:ring-[#8fb184]"
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
                className="h-9 border border-[#c3d3bc] bg-[#c3d3bc] px-4 text-xs font-black shadow-sm disabled:cursor-not-allowed disabled:opacity-45"
              >
                Samenvoegen
              </button>
            </div>
          </section>
        )}
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

function DetailIconButton({
  active = false,
  danger = false,
  disabled = false,
  children,
  label,
  onClick,
}: Readonly<{
  active?: boolean;
  danger?: boolean;
  disabled?: boolean;
  children: ReactNode;
  label: string;
  onClick: () => void;
}>) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`flex h-9 w-9 items-center justify-center border text-sm shadow-sm transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-35 ${
        danger
          ? "border-[#efc2bb] bg-[#fff4f1] text-[#a83e31]"
          : active
            ? "border-[#c3d3bc] bg-[#c3d3bc] text-[#24401f]"
            : "border-[#d9d2c9] bg-white text-[#2d2a26] hover:bg-[#f8f6f3]"
      }`}
    >
      {children}
    </button>
  );
}

function CompactInputRow({
  boxed = false,
  children,
  label,
}: Readonly<{
  boxed?: boolean;
  children: ReactNode;
  label: string;
}>) {
  if (boxed) {
    return (
      <label className="grid gap-1 border border-[#d9d2c9] bg-white p-2 text-[0.6rem] font-black uppercase tracking-[0.14em] text-[#2d2a26]/45">
        <span>{label}</span>
        {children}
      </label>
    );
  }

  return (
    <label className="grid min-h-10 grid-cols-[7.25rem_minmax(0,1fr)] items-center gap-2 px-3 py-1.5 text-left">
      <span className="text-[0.6rem] font-black uppercase tracking-[0.14em] text-[#2d2a26]/45">
        {label}
      </span>
      <span className="min-w-0">{children}</span>
    </label>
  );
}

function CompactInfoRow({
  label,
  value,
  valueClassName = "",
}: Readonly<{
  label: string;
  value: string;
  valueClassName?: string;
}>) {
  return (
    <div className="grid min-h-10 grid-cols-[7.25rem_minmax(0,1fr)] items-center gap-2 px-3 py-1.5">
      <span className="text-[0.6rem] font-black uppercase tracking-[0.14em] text-[#2d2a26]/45">
        {label}
      </span>
      <span
        className={`inline-flex w-fit items-center px-2 py-0.5 text-xs font-black ${
          valueClassName || "text-[#2d2a26]"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function SaveIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="2.3"
    >
      <path d="M5 4.5h12l2 2v13H5z" />
      <path d="M8 4.5v6h7v-6" />
      <path d="M8.5 19.5v-6h7v6" />
    </svg>
  );
}

function MergeIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="2.3"
    >
      <path d="M4 7h5c3 0 4.5 2 6.5 5S19 17 22 17" />
      <path d="M4 17h5c1.7 0 3-0.6 4.2-1.8" />
      <path d="M18 13l4 4-4 4" />
      <path d="M18 3l4 4-4 4" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="2.3"
    >
      <path d="M4 7h16" />
      <path d="M9 7V5h6v2" />
      <path d="M7 7l1 13h8l1-13" />
      <path d="M10 11v5" />
      <path d="M14 11v5" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="2.4"
    >
      <path d="M6 6l12 12" />
      <path d="M18 6L6 18" />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-3.5 w-3.5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="2.4"
    >
      <path d="M10 13a5 5 0 0 0 7.1 0l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1" />
      <path d="M14 11a5 5 0 0 0-7.1 0l-2 2a5 5 0 0 0 7.1 7.1l1.1-1.1" />
    </svg>
  );
}

function ChevronIcon({ open }: Readonly<{ open: boolean }>) {
  return (
    <svg
      aria-hidden="true"
      className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="2.4"
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}
