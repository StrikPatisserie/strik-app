import { type ReactNode, useState } from "react";
import IngredientSpecificationEditor from "./IngredientSpecificationEditor";
import IngredientsOverview from "./IngredientsOverview";
import type { RecipeReplacement } from "./ingredientReplacement";
import type { Ingredient, IngredientSpecificationSaver, Recipe, RecipeUnit } from "./types";
import {
  changeBadgeClass,
  formatDate,
  formatEuro,
  formatSignedPercent,
  ingredientPackagePrice,
  ingredientPreviousPackagePrice,
  ingredientPriceChange,
  packagePriceLabel,
  pricePerBaseUnitFromPackagePrice,
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
  onUpdateSpecification,
  onOpenImport,
  onDeleteIngredient,
  onMergeIngredient,
  onReplaceIngredient,
}: Readonly<{
  ingredients: Ingredient[];
  recipes: Recipe[];
  onUpdateIngredient: (ingredient: Ingredient) => void;
  onUpdateSpecification: IngredientSpecificationSaver;
  onOpenImport: () => void;
  onDeleteIngredient: (ingredient: Ingredient) => void;
  onMergeIngredient: (sourceIngredient: Ingredient, targetIngredient: Ingredient) => void;
  onReplaceIngredient: (sourceIngredient: Ingredient, replacement: RecipeReplacement) => void;
  onDeleteIngredients?: (ingredients: Ingredient[]) => void;
}>) {
  const [editingIngredient, setEditingIngredient] = useState<Ingredient | null>(null);

  return (
    <>
      <IngredientsOverview
        ingredients={ingredients}
        recipes={recipes}
        onEditIngredient={(ingredient) => setEditingIngredient(ingredient || createBlankIngredient())}
        onOpenImport={onOpenImport}
        onUpdateSpecification={onUpdateSpecification}
      />
      {editingIngredient && (
        <IngredientDetail
          key={editingIngredient.id}
          ingredient={editingIngredient}
          ingredients={ingredients}
          recipes={recipes}
          onUpdateSpecification={async (updated, expected, mode) => {
            const stored = await onUpdateSpecification(updated, expected, mode);
            setEditingIngredient(stored);
            return stored;
          }}
          onUpdateIngredient={(ingredient) => {
            onUpdateIngredient(ingredient);
            setEditingIngredient(ingredient);
          }}
          onMergeIngredient={(source, target) => {
            onMergeIngredient(source, target);
            setEditingIngredient(null);
          }}
          onReplaceIngredient={(source, replacement) => {
            onReplaceIngredient(source, replacement);
            setEditingIngredient(null);
          }}
          onDeleteIngredient={(ingredient) => {
            onDeleteIngredient(ingredient);
            setEditingIngredient(null);
          }}
          onClose={() => setEditingIngredient(null)}
        />
      )}
    </>
  );
}

export function IngredientDetail({
  ingredient,
  ingredients,
  recipes,
  onUpdateIngredient,
  onUpdateSpecification,
  onMergeIngredient,
  onReplaceIngredient,
  onDeleteIngredient,
  onClose,
}: Readonly<{
  ingredient: Ingredient;
  ingredients: Ingredient[];
  recipes: Recipe[];
  onUpdateIngredient: (ingredient: Ingredient) => void;
  onUpdateSpecification: IngredientSpecificationSaver;
  onMergeIngredient: (
    sourceIngredient: Ingredient,
    targetIngredient: Ingredient
  ) => void;
  onReplaceIngredient: (sourceIngredient: Ingredient, replacement: RecipeReplacement) => void;
  onDeleteIngredient: (ingredient: Ingredient) => void;
  onClose: () => void;
}>) {
  const linkedRecipes = recipesUsingIngredient(recipes, ingredient.id);
  const [isReplacementOpen, setIsReplacementOpen] = useState(false);
  const [replacementKind, setReplacementKind] = useState<RecipeReplacement["kind"]>("ingredient");
  const [replacementId, setReplacementId] = useState("");
  const [isActive, setIsActive] = useState(ingredient.status !== "inactive");
  const replacementOptions = replacementKind === "ingredient"
    ? ingredients.filter((item) => item.id !== ingredient.id && item.status !== "inactive")
    : recipes.filter((item) => item.type === "semiFinished");
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
      status: isActive ? "active" as const : "inactive" as const,
      recipeReplacement: isActive ? undefined : ingredient.recipeReplacement,
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
        <IngredientSpecificationEditor key={ingredient.id} ingredient={ingredient} onSave={onUpdateSpecification} />
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
              Zoeknamen
            </button>
          </div>
          {isLinking && (
            <div className="grid gap-2 border-t border-[#d9d2c9] bg-[#fffdf8] p-3 sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
              <CompactInputRow label="Extra zoeknaam" boxed>
                <input
                  value={alias}
                  onChange={(event) => setAlias(event.target.value)}
                  placeholder="Naam zoals op factuur"
                  className={compactInputClass}
                />
              </CompactInputRow>
              <label className="grid gap-1 text-[0.6rem] font-black uppercase tracking-[0.14em] text-[#2d2a26]/45">
                Herkennen bij receptinvoer
                <textarea
                  value={ingredientAliasesInput}
                  onChange={(event) => setIngredientAliasesInput(event.target.value)}
                  placeholder="Bijvoorbeeld slagroom of room, elk op een nieuwe regel"
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

        <section className="mt-3 rounded-xl border border-[#d9d2c9] bg-white p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="flex items-center gap-2 text-xs font-bold"><input type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} />In gebruik voor recepten</label>
            <button type="button" onClick={() => setIsReplacementOpen((current) => !current)} className="rounded-lg border border-[#d9d2c9] px-3 py-2 text-xs font-bold">Vervangen in recepten</button>
          </div>
          {ingredient.recipeReplacement && <p className="mt-2 text-xs text-[#82786e]">Vervangen door {ingredient.recipeReplacement.kind === "ingredient" ? ingredients.find((item) => item.id === ingredient.recipeReplacement?.id)?.name : recipes.find((item) => item.id === ingredient.recipeReplacement?.id)?.name}. Factuurgegevens blijven bij deze grondstof.</p>}
          {isReplacementOpen && <div className="mt-3 grid gap-2 sm:grid-cols-[9rem_minmax(0,1fr)_auto]">
            <label className="grid gap-1 text-xs font-bold">Vervangen door<select aria-label="Soort vervanging" value={replacementKind} onChange={(event) => { setReplacementKind(event.target.value as RecipeReplacement["kind"]); setReplacementId(""); }} className="min-h-9 rounded-lg border border-[#d9d2c9] bg-white px-2"><option value="ingredient">Grondstof</option><option value="semiFinished">Halffabricaat</option></select></label>
            <label className="grid min-w-0 gap-1 text-xs font-bold">Nieuwe keuze<select aria-label="Nieuwe grondstof of halffabricaat" value={replacementId} onChange={(event) => setReplacementId(event.target.value)} className="min-h-9 min-w-0 rounded-lg border border-[#d9d2c9] bg-white px-2"><option value="">Kies een vervanging</option>{replacementOptions.slice().sort((a,b) => a.name.localeCompare(b.name, "nl-NL")).map((item) => <option key={item.id} value={item.id}>{item.name}{"supplier" in item ? ` · ${item.supplier}` : ""}</option>)}</select></label>
            <button type="button" disabled={!replacementId} onClick={() => { try { onReplaceIngredient(ingredient, { kind: replacementKind, id: replacementId }); } catch (error) { setFeedback(error instanceof Error ? error.message : "Vervangen is niet gelukt."); } }} className="min-h-9 self-end rounded-lg bg-[#315e42] px-3 text-xs font-bold text-white disabled:opacity-40">Vervang in {linkedRecipes.length} recepten</button>
            <p className="text-xs text-[#82786e] sm:col-span-3">Hoeveelheden blijven gelijk. De oude grondstof wordt inactief; facturen blijven bewaard. Nieuwe receptimports herkennen de vervanging.</p>
          </div>}
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
