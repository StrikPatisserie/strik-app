import { useState } from "react";
import type {
  Ingredient,
  PackagingItem,
  ProductionLogEntry,
  ProductionRequest,
  Recipe,
  RecipeIngredient,
  RecipePackagingLine,
  RecipeStatus,
  RecipeType,
  RecipeUnit,
  SalesPeriod,
  SemiFinishedUsage,
} from "./types";
import {
  Panel,
  MarginBadge,
  RecipeStatusBadge,
  SectionTitle,
} from "./RecepturenShared";
import {
  changeBadgeClass,
  directIngredientCost,
  effectiveTargetMargin,
  findIngredient,
  findRecipe,
  formatBatchWeight,
  formatDate,
  formatEuro,
  formatPercent,
  marginStatusForRecipe,
  normalizePackagePrice,
  normalizeProductionLog,
  normalizeProductionRequests,
  pricePerBaseUnitFromPackagePrice,
  productionLogForRecipe,
  productionNeedClass,
  productionNeedForRecipe,
  productionNeedLabel,
  quantityLabel,
  recipeTypeLabel,
  recipeCostChange,
  recipeCostDelta,
  salesPeriodLabel,
  normalizeRecipePackagingLines,
  selectedRecipePackagingUnitCost,
  syncRecipeProductionMetadata,
  targetSalesPrice,
} from "./utils";
import {
  defaultWorkCategoryOptions,
  normalizeWorkCategory,
  workCategoriesForRecipe,
  workCategoryLabel,
} from "./workCategories";

const recipeUnits: RecipeUnit[] = ["gram", "kg", "ml", "liter", "stuk"];
const recipeStatuses: RecipeStatus[] = ["active", "draft", "old"];
const salesPeriods: SalesPeriod[] = ["week", "month", "year"];
const RECIPE_PHOTO_MAX_SOURCE_BYTES = 12 * 1024 * 1024;
const RECIPE_PHOTO_MAX_SIDE = 360;
const RECIPE_PHOTO_MIN_SIDE = 180;
const RECIPE_PHOTO_MAX_DATA_URL_LENGTH = 45000;
const RECIPE_PHOTO_QUALITIES = [0.3, 0.22, 0.16, 0.1];
const recipeEditSections: Array<{
  id: RecipeEditSection;
  label: string;
  hint: string;
}> = [
  { id: "basis", label: "Basis", hint: "Naam, batch, prijs en foto" },
  { id: "productie", label: "Productie", hint: "Logboek en planning" },
  { id: "grondstoffen", label: "Grondstoffen", hint: "Wat gaat erin" },
  { id: "halffabricaten", label: "Halffabricaten", hint: "Voorwerk" },
  { id: "stappen", label: "Stappen", hint: "Bereiding" },
  { id: "notities", label: "Notities", hint: "Allergenen" },
];

type RecipeEditSection =
  | "basis"
  | "productie"
  | "grondstoffen"
  | "halffabricaten"
  | "stappen"
  | "notities";

type RecipeImportResponse = {
  recipes?: Recipe[];
  warnings?: string[];
  message?: string;
};

export default function RecipeDetail({
  recipe,
  ingredients,
  packagingItems,
  recipes,
  startInEditMode = false,
  onClose,
  onSaveRecipe,
  onDeleteRecipe,
  onSaveIngredient,
  onStartProduction,
}: Readonly<{
  recipe: Recipe;
  ingredients: Ingredient[];
  packagingItems: PackagingItem[];
  recipes: Recipe[];
  startInEditMode?: boolean;
  onClose: () => void;
  onSaveRecipe: (recipe: Recipe) => void;
  onDeleteRecipe: (recipe: Recipe) => void;
  onSaveIngredient: (ingredient: Ingredient) => void;
  onStartProduction?: (recipe: Recipe, quantity: number) => void;
}>) {
  const [isEditing, setIsEditing] = useState(startInEditMode);
  const [activeEditSection, setActiveEditSection] =
    useState<RecipeEditSection>("basis");
  const [feedback, setFeedback] = useState("");
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [isImportingRecipe, setIsImportingRecipe] = useState(false);
  const [isAddingNewIngredient, setIsAddingNewIngredient] = useState(false);
  const [recipeImportWarnings, setRecipeImportWarnings] = useState<string[]>([]);
  const [draft, setDraft] = useState(() => createRecipeDraft(recipe));
  const [cardQuantity, setCardQuantity] = useState(
    () => recipe.standardBatchQuantity || getBatchInfo(recipe)?.quantity || 1
  );
  const [isRecipeStarted, setIsRecipeStarted] = useState(false);
  const [isProductionShortcutOpen, setIsProductionShortcutOpen] =
    useState(false);
  const [newIngredient, setNewIngredient] = useState(createIngredientDraft());
  const [newWorkCategory, setNewWorkCategory] = useState("");
  const [newProductionEntry, setNewProductionEntry] = useState(() => ({
    date: todayIsoDate(),
    quantity: formatInputNumber(
      recipe.standardBatchQuantity || getBatchInfo(recipe)?.quantity || 1
    ),
    note: "",
  }));
  const [newProductionRequest, setNewProductionRequest] = useState(() => ({
    date: todayIsoDate(),
    quantity: formatInputNumber(
      recipe.standardBatchQuantity || getBatchInfo(recipe)?.quantity || 1
    ),
    reason: "",
  }));
  const isSemiFinishedDraft = draft.type === "semiFinished";
  const availableIngredients = ingredients;
  const activePackagingOptions = packagingItems.filter(
    (item) =>
      item.status === "active" ||
      draft.packagingItems.some((line) => line.packagingId === item.id)
  );
  const semiFinishedOptions = recipes.filter(
    (item) => item.type === "semiFinished" && item.id !== recipe.id
  );
  const previewIngredients = normalizeIngredientDrafts(
    draft.ingredients,
    availableIngredients
  );
  const previewSemiFinished = normalizeSemiFinishedDrafts(
    draft.semiFinishedItems,
    recipes
  );
  const previewPackagingItems = normalizePackagingDrafts(
    draft.packagingItems,
    packagingItems
  );
  const directTotal = directIngredientCost(previewIngredients);
  const semiFinishedTotal = previewSemiFinished.reduce(
    (total, item) => total + item.costContribution,
    0
  );
  const previewMadeWeightKg = recipeMadeWeightKg(
    previewIngredients,
    previewSemiFinished
  );
  const previewBatchQuantity = isSemiFinishedDraft
    ? previewMadeWeightKg || getBatchInfo(recipe)?.quantity || 1
    : parseDutchNumber(draft.standardBatchQuantity) ||
      getBatchInfo(recipe)?.quantity ||
      1;
  const manualPackagingUnitCost = parseDutchNumber(draft.packagingCost);
  const selectedPackagingUnitCost =
    selectedRecipePackagingUnitCost(previewPackagingItems);
  const packagingUnitCost = manualPackagingUnitCost + selectedPackagingUnitCost;
  const packagingTotal =
    !isSemiFinishedDraft
      ? packagingUnitCost * previewBatchQuantity
      : 0;
  const extraTotal = packagingTotal;
  const previewBatchCost =
    Math.round((directTotal + semiFinishedTotal + extraTotal) * 100) / 100;
  const previewCostPrice = costPriceFromBatchCost(
    draft.type,
    previewBatchCost,
    previewBatchQuantity
  );
  const salesPrice = parseDutchNumber(draft.salesPrice);
  const previewRecipe = buildRecipeFromDraft(
    recipe,
    draft,
    previewIngredients,
    previewSemiFinished,
    previewPackagingItems,
    previewCostPrice
  );
  const productionPreview = productionNeedForRecipe(previewRecipe);
  const targetPrice = targetSalesPrice(previewRecipe);
  const effectiveMarginTarget = effectiveTargetMargin(previewRecipe);
  const recipeUsageCount = recipes.filter((item) =>
    item.semiFinishedItems.some(
      (usage) => usage.semiFinishedRecipeId === recipe.id
    )
  ).length;

  function showFeedback(message: string) {
    setFeedback(message);
    window.setTimeout(() => setFeedback(""), 2200);
  }

  function updateDraft(changes: Partial<RecipeDraft>) {
    setDraft((current) => ({ ...current, ...changes }));
  }

  function toggleWorkCategory(categoryId: string) {
    const normalized = normalizeWorkCategory(categoryId);
    if (!normalized) return;

    setDraft((current) => {
      const exists = current.workCategories.includes(normalized);

      return {
        ...current,
        workCategories: exists
          ? current.workCategories.filter((category) => category !== normalized)
          : [...current.workCategories, normalized],
      };
    });
  }

  function addCustomWorkCategory() {
    const normalized = normalizeWorkCategory(newWorkCategory);
    if (!normalized) return;

    setDraft((current) => ({
      ...current,
      workCategories: Array.from(
        new Set([...current.workCategories, normalized])
      ),
    }));
    setNewWorkCategory("");
  }

  function removeWorkCategory(categoryId: string) {
    setDraft((current) => ({
      ...current,
      workCategories: current.workCategories.filter(
        (category) => category !== categoryId
      ),
    }));
  }

  function startEditing(section: RecipeEditSection = "basis") {
    setActiveEditSection(section);
    setIsEditing(true);
  }

  async function updateRecipePhoto(file: File | null) {
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      showFeedback("Kies een afbeeldingsbestand.");
      return;
    }

    if (file.size > RECIPE_PHOTO_MAX_SOURCE_BYTES) {
      showFeedback("Foto is te groot. Kies maximaal 12 MB.");
      return;
    }

    try {
      const preview = await createSmallRecipePhotoPreview(file);

      setDraft((current) => ({
        ...current,
        photoPreviewDataUrl: preview.dataUrl,
        photoFileName: preview.fileName,
        photoUpdatedAt: todayIsoDate(),
        photoHint:
          current.photoHint.trim() ||
          file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " "),
      }));
      showFeedback("Foto verkleind toegevoegd.");
    } catch {
      showFeedback("Foto kon niet worden verkleind.");
    }
  }

  function removeRecipePhoto() {
    updateDraft({
      photoPreviewDataUrl: "",
      photoFileName: "",
      photoUpdatedAt: "",
    });
    showFeedback("Foto verwijderd.");
  }

  async function importRecipeFile(file: File | null) {
    if (!file) return;

    setIsImportingRecipe(true);
    setRecipeImportWarnings([]);

    try {
      const formData = new FormData();
      formData.set("file", file);
      formData.set("kind", "recipes");
      formData.set("ingredients", JSON.stringify(availableIngredients));
      formData.set("recipes", JSON.stringify(recipes));

      const response = await fetch("/api/recepturen/data-import", {
        method: "POST",
        body: formData,
      });
      const data = (await response.json()) as RecipeImportResponse;

      if (!response.ok) {
        throw new Error(data.message || "Bestand kon niet gelezen worden.");
      }

      const importedRecipe = data.recipes?.[0];
      if (!importedRecipe) {
        throw new Error("Geen recept herkend in dit bestand.");
      }

      setDraft((current) => recipeDraftFromImportedRecipe(current, importedRecipe));
      setActiveEditSection("grondstoffen");
      setRecipeImportWarnings(data.warnings || []);
      showFeedback(data.message || "Receptbestand ingelezen.");
    } catch (error) {
      showFeedback(
        error instanceof Error ? error.message : "Bestand kon niet gelezen worden."
      );
    } finally {
      setIsImportingRecipe(false);
    }
  }

  function saveRecipeDraft() {
    const updatedRecipe = buildRecipeFromDraft(
      recipe,
      draft,
      previewIngredients,
      previewSemiFinished,
      previewPackagingItems,
      previewCostPrice
    );

    onSaveRecipe(updatedRecipe);
    setDraft(createRecipeDraft(updatedRecipe));
    setIsEditing(false);
    showFeedback("Recept opgeslagen.");
  }

  function requestDeleteRecipe() {
    if (!isConfirmingDelete) {
      setIsConfirmingDelete(true);
      showFeedback("Klik nog een keer op verwijderen om te bevestigen.");
      return;
    }

    onDeleteRecipe(recipe);
  }

  function addIngredientLine(ingredientId = availableIngredients[0]?.id || "") {
    setDraft((current) => ({
      ...current,
      ingredients: [
        ...current.ingredients,
        {
          id: createLocalId("ingredient-line"),
          ingredientId,
          quantity: "0",
          unit: findIngredient(availableIngredients, ingredientId)?.recipeUnit || "gram",
          costContribution: 0,
        },
      ],
    }));
  }

  function updateIngredientLine(
    lineId: string,
    changes: Partial<RecipeIngredientDraft>
  ) {
    setDraft((current) => ({
      ...current,
      ingredients: current.ingredients.map((line) =>
        line.id === lineId ? { ...line, ...changes } : line
      ),
    }));
  }

  function removeIngredientLine(lineId: string) {
    setDraft((current) => ({
      ...current,
      ingredients: current.ingredients.filter((line) => line.id !== lineId),
    }));
  }

  function addSemiFinishedLine(recipeId = semiFinishedOptions[0]?.id || "") {
    setDraft((current) => ({
      ...current,
      semiFinishedItems: [
        ...current.semiFinishedItems,
        {
          id: createLocalId("semi-line"),
          semiFinishedRecipeId: recipeId,
          quantity: "0",
          unit: getBatchInfo(findRecipe(recipes, recipeId))?.unit || "kg",
          costContribution: 0,
        },
      ],
    }));
  }

  function updateSemiFinishedLine(
    lineId: string,
    changes: Partial<SemiFinishedDraft>
  ) {
    setDraft((current) => ({
      ...current,
      semiFinishedItems: current.semiFinishedItems.map((line) =>
        line.id === lineId ? { ...line, ...changes } : line
      ),
    }));
  }

  function removeSemiFinishedLine(lineId: string) {
    setDraft((current) => ({
      ...current,
      semiFinishedItems: current.semiFinishedItems.filter(
        (line) => line.id !== lineId
      ),
    }));
  }

  function addPackagingLine(packagingId = activePackagingOptions[0]?.id || "") {
    const packaging = packagingItems.find((item) => item.id === packagingId);

    setDraft((current) => ({
      ...current,
      packagingItems: [
        ...current.packagingItems,
        {
          id: createLocalId("packaging-line"),
          packagingId,
          quantity: "1",
          unitPrice: packaging?.unitPrice || 0,
          costContribution: packaging?.unitPrice || 0,
          nameSnapshot: packaging?.name || "",
        },
      ],
    }));
  }

  function updatePackagingLine(
    lineId: string,
    changes: Partial<RecipePackagingDraft>
  ) {
    setDraft((current) => ({
      ...current,
      packagingItems: current.packagingItems.map((line) => {
        if (line.id !== lineId) return line;

        const nextLine = { ...line, ...changes };
        const packaging = packagingItems.find(
          (item) => item.id === nextLine.packagingId
        );

        if (changes.packagingId !== undefined) {
          nextLine.unitPrice = packaging?.unitPrice || 0;
          nextLine.nameSnapshot = packaging?.name || "";
        }

        return nextLine;
      }),
    }));
  }

  function removePackagingLine(lineId: string) {
    setDraft((current) => ({
      ...current,
      packagingItems: current.packagingItems.filter((line) => line.id !== lineId),
    }));
  }

  function createNewIngredient() {
    const name = newIngredient.name.trim();
    const packagePrice = parseDutchNumber(newIngredient.packagePrice);

    if (!name) {
      showFeedback("Vul eerst een ingredientnaam in.");
      return;
    }

    if (packagePrice <= 0) {
      showFeedback("Vul een geldige prijs in.");
      return;
    }

    const recipeUnit = newIngredient.recipeUnit;
    const normalizedPrice = normalizePackagePrice(packagePrice, recipeUnit);
    const ingredient: Ingredient = {
      id: uniqueIngredientId(name, ingredients),
      name,
      supplier: newIngredient.supplier.trim() || "Handmatig",
      supplierArticleNumber: newIngredient.supplierArticleNumber.trim() || "-",
      packageSize: newIngredient.packageSize.trim() || "1 kg",
      recipeUnit,
      lastPrice: normalizedPrice,
      previousPrice: normalizedPrice,
      pricePerBaseUnit: pricePerBaseUnitFromPackagePrice(
        normalizedPrice,
        recipeUnit
      ),
      allergens: parseList(newIngredient.allergens),
      lastUpdated: todayIsoDate(),
      status: "active",
      lastInvoice: "Handmatig toegevoegd",
      aliases: Array.from(new Set([name, ...parseList(newIngredient.aliases)])),
    };

    onSaveIngredient(ingredient);
    setDraft((current) => ({
      ...current,
      ingredients: [
        ...current.ingredients,
        {
          id: createLocalId("ingredient-line"),
          ingredientId: ingredient.id,
          quantity: "0",
          unit: ingredient.recipeUnit,
          costContribution: 0,
        },
      ],
    }));
    setNewIngredient(createIngredientDraft());
    setIsAddingNewIngredient(false);
    showFeedback("Ingredient toegevoegd.");
  }

  function addProductionLogEntry() {
    const quantity = parseDutchNumber(newProductionEntry.quantity);
    const date = newProductionEntry.date.trim();

    if (!date || quantity <= 0) {
      showFeedback("Vul een datum en hoeveelheid in.");
      return;
    }

    const entry: ProductionLogEntry = {
      id: createLocalId("production"),
      date,
      quantity,
      note: newProductionEntry.note.trim(),
      source: "manual",
    };

    setDraft((current) => ({
      ...current,
      productionLog: normalizeProductionLog([entry, ...current.productionLog]),
    }));
    setNewProductionEntry({
      date: todayIsoDate(),
      quantity: formatInputNumber(previewBatchQuantity || 1),
      note: "",
    });
    showFeedback("Productie toegevoegd aan logboek.");
  }

  function removeProductionLogEntry(entryId: string) {
    setDraft((current) => ({
      ...current,
      productionLog: current.productionLog.filter((entry) => entry.id !== entryId),
    }));
    showFeedback("Productieregistratie verwijderd.");
  }

  function updateProductionLogEntry(
    entryId: string,
    changes: Partial<ProductionLogEntry>
  ) {
    setDraft((current) => ({
      ...current,
      productionLog: normalizeProductionLog(
        current.productionLog.map((entry) =>
          entry.id === entryId ? { ...entry, ...changes } : entry
        )
      ),
    }));
  }

  function addProductionRequest() {
    const quantity = parseDutchNumber(newProductionRequest.quantity);
    const date = newProductionRequest.date.trim();

    if (!date || quantity <= 0) {
      showFeedback("Vul een datum en hoeveelheid in.");
      return;
    }

    const request: ProductionRequest = {
      id: createLocalId("request"),
      date,
      quantity,
      reason: newProductionRequest.reason.trim() || "Extra productie",
      status: "open",
    };

    setDraft((current) => ({
      ...current,
      productionRequests: normalizeProductionRequests([
        request,
        ...current.productionRequests,
      ]),
    }));
    setNewProductionRequest({
      date: todayIsoDate(),
      quantity: formatInputNumber(previewBatchQuantity || 1),
      reason: "",
    });
    showFeedback("Extra productie gepland.");
  }

  function removeProductionRequest(requestId: string) {
    setDraft((current) => ({
      ...current,
      productionRequests: current.productionRequests.filter(
        (request) => request.id !== requestId
      ),
    }));
    showFeedback("Geplande productie verwijderd.");
  }

  async function copyRecipe() {
    try {
      await navigator.clipboard.writeText(
        createRecipeText(previewRecipe, ingredients, recipes)
      );
      showFeedback("Recept gekopieerd.");
    } catch {
      showFeedback("Kopieren lukt nu niet.");
    }
  }

  function printProductionCard() {
    const printWindow = window.open("", "_blank", "width=980,height=760");

    if (!printWindow) {
      showFeedback("Printvenster is geblokkeerd.");
      return;
    }

    printWindow.document.write(
      createRecipePrintHtml(
        previewRecipe,
        ingredients,
        recipes,
        cardQuantity,
        previewBatchQuantity
      )
    );
    printWindow.document.close();
    printWindow.focus();
    window.setTimeout(() => printWindow.print(), 150);
    showFeedback("Printvenster geopend.");
  }

  function changeCardQuantity(delta: number) {
    setCardQuantity((current) => Math.max(0.1, Math.round((current + delta) * 10) / 10));
  }

  function updateCardQuantity(value: string) {
    const parsed = parseDutchNumber(value);
    if (parsed > 0) setCardQuantity(parsed);
  }

  function scaleCardFromIngredient(rowId: string, desiredQuantity: number) {
    const baseQuantity = previewBatchQuantity || getBatchInfo(previewRecipe)?.quantity || 1;
    const baseRows = recipeCardIngredientRows(
      previewRecipe,
      ingredients,
      recipes,
      1
    );
    const selectedRow = baseRows.find((row) => row.id === rowId);

    if (!selectedRow || selectedRow.quantity <= 0 || desiredQuantity <= 0) return;

    setCardQuantity(
      Math.max(
        0.1,
        Math.round(((baseQuantity * desiredQuantity) / selectedRow.quantity) * 1000) /
          1000
      )
    );
  }

  function startRecipeCard() {
    setIsRecipeStarted(true);
    onStartProduction?.(previewRecipe, cardQuantity || previewBatchQuantity || 1);
    showFeedback("Recept gestart.");
  }

  function markRecipeCardMade() {
    setIsProductionShortcutOpen(true);
  }

  function confirmRecipeCardMade(date: string) {
    const entry: ProductionLogEntry = {
      id: createLocalId("production"),
      date,
      quantity: cardQuantity || previewBatchQuantity || 1,
      note: "Gemaakt via receptkaart",
      source: "work",
    };
    const updatedRecipe = syncRecipeProductionMetadata({
      ...previewRecipe,
      productionLog: normalizeProductionLog([
        entry,
        ...productionLogForRecipe(previewRecipe),
      ]),
    });

    onSaveRecipe(updatedRecipe);
    setDraft(createRecipeDraft(updatedRecipe));
    setIsProductionShortcutOpen(false);
    showFeedback("Gemarkeerd als gemaakt.");
  }

  function recalculateRecipeCost() {
    const updatedRecipe: Recipe = {
      ...previewRecipe,
      previousCostPrice: recipe.costPrice,
      lastUpdated: todayIsoDate(),
    };

    onSaveRecipe(updatedRecipe);
    showFeedback("Kostprijs opnieuw berekend.");
  }

  if (!isEditing) {
    return (
      <>
      <BakkerRecipeCard
        recipe={previewRecipe}
        ingredients={ingredients}
        recipes={recipes}
        quantity={cardQuantity}
        batchQuantity={previewBatchQuantity}
        isStarted={isRecipeStarted}
        feedback={feedback}
        onQuantityChange={updateCardQuantity}
        onQuantityStep={changeCardQuantity}
        onScaleFromIngredient={scaleCardFromIngredient}
        onStart={startRecipeCard}
        onMarkMade={markRecipeCardMade}
        onPrint={printProductionCard}
        onEdit={() => startEditing("basis")}
        onClose={onClose}
      />
      {isProductionShortcutOpen && (
        <ProductionShortcutDialog
          recipe={previewRecipe}
          quantity={cardQuantity || previewBatchQuantity || 1}
          onCancel={() => setIsProductionShortcutOpen(false)}
          onConfirm={confirmRecipeCardMade}
        />
      )}
      </>
    );
  }

  return (
    <div className="fixed inset-0 z-[70] overflow-y-auto bg-[#252525]/35 px-3 py-5 backdrop-blur-sm">
      <div className="mx-auto max-w-[88rem] rounded-lg border border-[#d8d8d4] bg-[#f5f5f3] p-3 shadow-2xl">
        <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg bg-white p-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[#2d2a26]/45">
              {isEditing
                ? "Recept aanpassen"
                : recipe.type === "finalProduct"
                ? "Recept detail"
                : "Halffabricaat detail"}
            </p>
            <h2 className="mt-1 text-2xl font-black leading-tight sm:text-3xl">
              {isEditing ? draft.name || recipe.name : recipe.name}
            </h2>
            <div className="mt-2 flex flex-wrap gap-2">
              <RecipeStatusBadge status={recipe.status} />
              {!isEditing && recipe.type === "finalProduct" && (
                <MarginBadge status={marginStatusForRecipe(previewRecipe)} />
              )}
              <span className="rounded-full bg-[#f8f6f3] px-2.5 py-1 text-xs font-black text-[#2d2a26]/55">
                {isEditing ? draft.productGroup || recipe.productGroup : recipe.productGroup}
              </span>
              {!isEditing && (
                <span className="rounded-full bg-[#f8f6f3] px-2.5 py-1 text-xs font-black text-[#2d2a26]/55">
                  {recipe.version}
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[#d8d8d4] bg-white px-4 py-2 text-sm font-black shadow-sm"
          >
            Sluit
          </button>
        </div>

        {isEditing && (
          <Panel className="mt-3 border-[#cfdcc8] bg-[#f7faf5] p-3">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <p className="text-[0.68rem] font-black uppercase tracking-[0.15em] text-[#2d2a26]/42">
                  Aanpassen
                </p>
                <h3 className="text-lg font-black leading-tight">
                  Kies onderdeel
                </h3>
              </div>
              <p className="text-xs font-bold text-[#2d2a26]/45">
                Per tabje aanpassen. Rustig en overzichtelijk.
              </p>
            </div>

            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              {recipeEditSections.map((section) => {
                if (section.id === "productie" && draft.type !== "finalProduct") {
                  return null;
                }

                const isActive = activeEditSection === section.id;

                return (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => setActiveEditSection(section.id)}
                    className={`min-w-max rounded-full border px-4 py-2 text-left shadow-sm transition ${
                      isActive
                        ? "border-[#8fb184] bg-[#c3d3bc] text-[#2d2a26]"
                        : "border-[#dfe9d8] bg-white text-[#2d2a26]/65"
                    }`}
                  >
                    <span className="block text-sm font-black">
                      {section.label}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="mt-3 grid gap-3">
              {activeEditSection === "basis" && (
                <EditorBlock title="Basis en foto">
                  <div
                    className={
                      draft.type === "finalProduct"
                        ? "grid gap-3 xl:grid-cols-[minmax(0,1fr)_18rem]"
                        : "grid gap-3"
                    }
                  >
                    <div className="grid content-start gap-3">
                      <div className="rounded-2xl border border-[#dfe9d8] bg-[#fffdf8] p-3">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-black">
                              Receptbestand inlezen
                            </p>
                            <p className="mt-1 text-xs font-bold leading-snug text-[#2d2a26]/50">
                              Upload PDF, Excel of CSV. Daarna kun je alles nog
                              controleren en aanpassen. Het bestand zelf wordt
                              niet opgeslagen.
                            </p>
                          </div>
                          <label className="cursor-pointer rounded-full bg-[#c3d3bc] px-4 py-2.5 text-sm font-black shadow-sm">
                            {isImportingRecipe ? "Lezen..." : "Bestand kiezen"}
                            <input
                              type="file"
                              accept=".xlsx,.xls,.csv,.txt,.tsv,.pdf"
                              disabled={isImportingRecipe}
                              className="sr-only"
                              onChange={(event) => {
                                void importRecipeFile(
                                  event.target.files?.[0] || null
                                );
                                event.currentTarget.value = "";
                              }}
                            />
                          </label>
                        </div>
                        {recipeImportWarnings.length > 0 && (
                          <div className="mt-3 rounded-2xl border border-[#ead7a6] bg-[#fff8e3] p-3">
                            <p className="text-xs font-black uppercase tracking-[0.12em] text-[#7a5a18]">
                              Controlepunten
                            </p>
                            <ul className="mt-2 grid gap-1 text-xs font-bold text-[#2d2a26]/60">
                              {recipeImportWarnings.slice(0, 6).map((warning) => (
                                <li key={warning}>{warning}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>

                      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                        <EditTextField
                          label="Naam"
                          value={draft.name}
                          onChange={(value) => updateDraft({ name: value })}
                        />
                        <EditTextField
                          label="Groep"
                          value={draft.productGroup}
                          onChange={(value) =>
                            updateDraft({ productGroup: value })
                          }
                        />
                        <SelectField
                          label="Soort"
                          value={draft.type}
                          onChange={(value) =>
                            updateDraft({ type: value as RecipeType })
                          }
                          options={[
                            { value: "finalProduct", label: "Eindproduct" },
                            { value: "semiFinished", label: "Halffabricaat" },
                          ]}
                        />
                        <SelectField
                          label="Status"
                          value={draft.status}
                          onChange={(value) =>
                            updateDraft({ status: value as RecipeStatus })
                          }
                          options={recipeStatuses.map((status) => ({
                            value: status,
                            label: recipeStatusText(status),
                          }))}
                        />
                      </div>

                      <div className="rounded-2xl bg-white/70 p-3">
                        <div
                          className={`grid gap-3 ${
                            draft.type === "semiFinished"
                              ? "md:grid-cols-[minmax(10rem,1fr)_8rem_minmax(8rem,0.8fr)]"
                              : "md:grid-cols-[minmax(10rem,1fr)_8rem_minmax(8rem,0.8fr)_8rem]"
                          }`}
                        >
                          <div>
                            <p className="text-xs font-black uppercase tracking-[0.12em] text-[#2d2a26]/45">
                              Batch
                            </p>
                            <p className="mt-1 text-xs font-bold leading-snug text-[#2d2a26]/55">
                              {draft.type === "semiFinished"
                                ? "Automatisch totaalgewicht uit grondstoffen."
                                : "Hoeveel maak je in één keer?"}
                            </p>
                          </div>
                          {draft.type === "semiFinished" ? (
                            <>
                              <Metric
                                label="Gemaakt gewicht"
                                value={`${formatInputNumber(previewBatchQuantity)} kg`}
                              />
                              <Metric
                                label="Inkoop/kg"
                                value={formatEuro(previewCostPrice)}
                              />
                            </>
                          ) : (
                            <>
                              <EditTextField
                                label="Aantal"
                                value={draft.standardBatchQuantity}
                                onChange={(value) =>
                                  updateDraft({ standardBatchQuantity: value })
                                }
                                inputMode="decimal"
                              />
                              <SelectField
                                label="Eenheid"
                                value={draft.standardBatchUnit}
                                onChange={(value) =>
                                  updateDraft({ standardBatchUnit: value as RecipeUnit })
                                }
                                options={recipeUnits.map((unit) => ({
                                  value: unit,
                                  label: unitLabelText(unit),
                                }))}
                              />
                              <Metric
                                label="Batchgewicht"
                                value={formatBatchWeight(previewMadeWeightKg)}
                              />
                            </>
                          )}
                        </div>
                        {draft.type === "finalProduct" && (
                          <p className="mt-2 text-xs font-bold text-[#2d2a26]/45">
                            Telt alle g/kg en l/ml uit de grondstoffen en
                            halffabricaten mee.
                          </p>
                        )}
                      </div>

                      {draft.type === "finalProduct" && (
                        <div className="grid gap-3 md:grid-cols-2">
                          <EditTextField
                            label="Verkoop"
                            value={draft.salesPrice}
                            onChange={(value) =>
                              updateDraft({ salesPrice: value })
                            }
                            inputMode="decimal"
                          />
                          <EditTextField
                            label="Basis marge %"
                            value={draft.targetMargin}
                            onChange={(value) =>
                              updateDraft({ targetMargin: value })
                            }
                            inputMode="decimal"
                          />
                        </div>
                      )}

                      {draft.type === "finalProduct" && (
                        <div className="rounded-2xl border border-[#dfe9d8] bg-white p-3">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-black">
                                Verpakking
                              </p>
                              <p className="mt-1 text-xs font-bold text-[#2d2a26]/50">
                                Kies uit de verpakkingslijst of vul een eigen
                                bedrag per stuk in.
                              </p>
                            </div>
                            <Metric
                              label="Per stuk"
                              value={formatEuro(packagingUnitCost)}
                            />
                          </div>

                          <div className="mt-3 grid gap-2">
                            {draft.packagingItems.map((line) => {
                              const normalizedLine = previewPackagingItems.find(
                                (item) => item.id === line.id
                              );

                              return (
                                <div
                                  key={line.id}
                                  className="grid gap-2 rounded-2xl border border-[#dfe9d8] bg-[#fffdf8] p-3 lg:grid-cols-[minmax(12rem,1fr)_7rem_7rem_auto]"
                                >
                                  <PackagingSearchField
                                    packagingItems={activePackagingOptions}
                                    value={line.packagingId}
                                    onChange={(value) =>
                                      updatePackagingLine(line.id, {
                                        packagingId: value,
                                      })
                                    }
                                  />
                                  <EditTextField
                                    label="Aantal/stuk"
                                    value={line.quantity}
                                    onChange={(value) =>
                                      updatePackagingLine(line.id, {
                                        quantity: value,
                                      })
                                    }
                                    inputMode="decimal"
                                  />
                                  <Metric
                                    label="Kost/stuk"
                                    value={formatEuro(
                                      normalizedLine?.costContribution || 0
                                    )}
                                  />
                                  <button
                                    type="button"
                                    onClick={() => removePackagingLine(line.id)}
                                    className="self-end rounded-full bg-[#fff4f1] px-3 py-2 text-sm font-black text-[#a83e31]"
                                  >
                                    Verwijder
                                  </button>
                                </div>
                              );
                            })}
                          </div>

                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => addPackagingLine()}
                              className="rounded-full bg-[#c3d3bc] px-4 py-2.5 text-sm font-black shadow-sm"
                            >
                              Verpakking toevoegen
                            </button>
                            <EditTextField
                              label="Eigen bedrag/stuk"
                              value={draft.packagingCost}
                              onChange={(value) =>
                                updateDraft({ packagingCost: value })
                              }
                              inputMode="decimal"
                            />
                            <p className="text-xs font-bold text-[#2d2a26]/45">
                              Lijst: {formatEuro(selectedPackagingUnitCost)} +
                              eigen: {formatEuro(manualPackagingUnitCost)}
                            </p>
                          </div>
                        </div>
                      )}

                      {draft.type === "finalProduct" && (
                        <div className="rounded-2xl border border-[#ead7a6] bg-[#fff8e3] p-3">
                          <p className="text-sm font-black">
                            Productieplanning
                          </p>
                          <p className="mt-1 text-xs font-bold text-[#2d2a26]/50">
                            Vul de gemiddelde verkoop in. Na “product gemaakt”
                            leert het systeem van het vorige interval en stelt
                            dit gemiddelde automatisch bij.
                          </p>
                          <div className="mt-3 grid gap-3 md:grid-cols-[minmax(9rem,0.8fr)_minmax(9rem,0.8fr)_minmax(12rem,1fr)]">
                            <EditTextField
                              label="Gemiddeld verkocht"
                              value={draft.averageSalesQuantity}
                              onChange={(value) =>
                                updateDraft({ averageSalesQuantity: value })
                              }
                              inputMode="decimal"
                            />
                            <SelectField
                              label="Periode"
                              value={draft.averageSalesPeriod}
                              onChange={(value) =>
                                updateDraft({
                                  averageSalesPeriod: value as SalesPeriod,
                                })
                              }
                              options={salesPeriods.map((period) => ({
                                value: period,
                                label: salesPeriodText(period),
                              }))}
                            />
                            <Metric
                              label="Leren uit productie"
                              value={
                                recipe.lastProducedAt
                                  ? `Sinds ${formatDate(recipe.lastProducedAt)} · ${
                                      recipe.lastProducedQuantity || "-"
                                    } stuks`
                                  : "Start na eerste registratie"
                              }
                            />
                          </div>
                        </div>
                      )}

                      <label className="flex items-center gap-3 rounded-2xl border border-[#cfdcc8] bg-white px-3 py-2.5 text-sm font-black">
                        <input
                          type="checkbox"
                          checked={draft.isWorkModeVisible}
                          onChange={(event) =>
                            updateDraft({
                              isWorkModeVisible: event.target.checked,
                            })
                          }
                          className="h-5 w-5 accent-[#8fb184]"
                        />
                        Toon in werkmodus
                      </label>

                      {draft.type === "finalProduct" && (
                        <div className="rounded-2xl border border-[#dfe9d8] bg-white p-3">
                          <p className="text-sm font-black">
                            Werkmodus categorieën
                          </p>
                          <p className="mt-1 text-xs font-bold text-[#2d2a26]/45">
                            Kies waar bakkers dit recept onder terugvinden.
                          </p>
                          <div className="mt-3 flex flex-wrap gap-1.5">
                            {defaultWorkCategoryOptions.map((category) => {
                              const selected = draft.workCategories.includes(
                                category.id
                              );

                              return (
                                <button
                                  key={category.id}
                                  type="button"
                                  onClick={() => toggleWorkCategory(category.id)}
                                  className={`rounded-full px-3 py-2 text-xs font-black shadow-sm ${
                                    selected
                                      ? "bg-[#c3d3bc] text-[#2d2a26]"
                                      : "bg-[#f8f6f3] text-[#2d2a26]/55"
                                  }`}
                                >
                                  {category.label}
                                </button>
                              );
                            })}
                          </div>
                          {draft.workCategories.length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-1.5">
                              {draft.workCategories.map((category) => (
                                <button
                                  key={category}
                                  type="button"
                                  onClick={() => removeWorkCategory(category)}
                                  className="rounded-full bg-[#dce8d6] px-3 py-1.5 text-xs font-black text-[#45663b]"
                                >
                                  {workCategoryLabel(category)} x
                                </button>
                              ))}
                            </div>
                          )}
                          <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                            <input
                              value={newWorkCategory}
                              onChange={(event) =>
                                setNewWorkCategory(event.target.value)
                              }
                              placeholder="Nieuwe categorie"
                              className="rounded-2xl border border-[#d8d0c4] bg-[#fffdf8] px-4 py-3 text-sm font-black outline-none focus:ring-2 focus:ring-[#8fb184]"
                            />
                            <button
                              type="button"
                              onClick={addCustomWorkCategory}
                              className="rounded-full bg-[#c3d3bc] px-4 py-2.5 text-sm font-black shadow-sm"
                            >
                              Voeg toe
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {draft.type === "finalProduct" && (
                    <div className="grid content-start gap-2 rounded-2xl border border-[#dfe9d8] bg-white/76 p-3">
                      <div
                        className={`flex aspect-[4/3] items-center justify-center rounded-2xl border border-[#dfe9d8] bg-[#eadfcf] bg-cover bg-center p-3 text-center ${
                          draft.photoPreviewDataUrl ? "shadow-inner" : ""
                        }`}
                        style={
                          draft.photoPreviewDataUrl
                            ? {
                                backgroundImage: `url("${draft.photoPreviewDataUrl}")`,
                              }
                            : undefined
                        }
                      >
                        {!draft.photoPreviewDataUrl && (
                          <div>
                            <p className="text-xs font-black uppercase tracking-[0.16em] text-[#2d2a26]/45">
                              Geen foto
                            </p>
                            <p className="mt-2 text-sm font-black">
                              {draft.photoHint || "Receptfoto"}
                            </p>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <label className="cursor-pointer rounded-full bg-[#c3d3bc] px-3 py-2 text-xs font-black shadow-sm">
                          Foto toevoegen
                          <input
                            type="file"
                            accept="image/*"
                            className="sr-only"
                            onChange={(event) => {
                              void updateRecipePhoto(event.target.files?.[0] || null);
                              event.currentTarget.value = "";
                            }}
                          />
                        </label>
                        {draft.photoPreviewDataUrl && (
                          <button
                            type="button"
                            onClick={removeRecipePhoto}
                            className="rounded-full bg-white px-3 py-2 text-xs font-black text-[#a83e31] shadow-sm"
                          >
                            Verwijder
                          </button>
                        )}
                      </div>
                      <p className="text-xs font-bold leading-snug text-[#2d2a26]/50">
                        Alleen een kleine preview wordt opgeslagen.
                      </p>
                      <EditTextField
                        label="Foto tekst"
                        value={draft.photoHint}
                        onChange={(value) => updateDraft({ photoHint: value })}
                      />
                      {draft.photoFileName && (
                        <p className="truncate text-[0.65rem] font-black uppercase tracking-[0.1em] text-[#2d2a26]/40">
                          {draft.photoFileName}
                          {draft.photoUpdatedAt ? ` - ${draft.photoUpdatedAt}` : ""}
                        </p>
                      )}
                    </div>
                    )}
                  </div>
                </EditorBlock>
              )}

              {activeEditSection === "productie" && draft.type === "finalProduct" && (
              <EditorBlock title="Productieplanning">
                <div className="grid gap-3 lg:grid-cols-4">
                  <Metric
                    label="Geschat over"
                    value={
                      productionPreview.status === "none"
                        ? "-"
                        : planningQuantityLabel(
                            productionPreview.estimatedRemainingQuantity,
                            draft.standardBatchUnit
                          )
                    }
                  />
                  <Metric
                    label="Volgende productie"
                    value={
                      productionPreview.nextProductionDate
                        ? formatDate(productionPreview.nextProductionDate)
                        : "Nog onbekend"
                    }
                    className={productionNeedClass(productionPreview.status)}
                  />
                  <Metric
                    label="Status"
                    value={
                      productionPreview.status === "none"
                        ? "Geen prognose"
                        : productionNeedLabel(productionPreview)
                    }
                    className={productionNeedClass(productionPreview.status)}
                  />
                  <Metric
                    label="Verkooptempo"
                    value={
                      productionPreview.averageSalesQuantity
                        ? `${productionPreview.averageSalesQuantity.toLocaleString(
                            "nl-NL"
                          )} per ${salesPeriodLabel(
                            productionPreview.averageSalesPeriod
                          )}`
                        : "Nog invullen"
                    }
                  />
                </div>

                <div className="mt-4 grid gap-3 xl:grid-cols-2">
                  <div className="rounded-2xl border border-[#dfe9d8] bg-white p-3">
                    <p className="text-sm font-black">Productielogboek</p>
                    <p className="mt-1 text-xs font-bold text-[#2d2a26]/50">
                      Wanneer is dit recept gemaakt en hoeveel? Dit voedt de prognose.
                    </p>
                    <div className="mt-3 grid gap-2 sm:grid-cols-[9rem_8rem_minmax(0,1fr)_auto]">
                      <DateField
                        label="Datum"
                        value={newProductionEntry.date}
                        onChange={(value) =>
                          setNewProductionEntry((current) => ({
                            ...current,
                            date: value,
                          }))
                        }
                      />
                      <EditTextField
                        label="Aantal"
                        value={newProductionEntry.quantity}
                        onChange={(value) =>
                          setNewProductionEntry((current) => ({
                            ...current,
                            quantity: value,
                          }))
                        }
                        inputMode="decimal"
                      />
                      <EditTextField
                        label="Notitie"
                        value={newProductionEntry.note}
                        onChange={(value) =>
                          setNewProductionEntry((current) => ({
                            ...current,
                            note: value,
                          }))
                        }
                      />
                      <button
                        type="button"
                        onClick={addProductionLogEntry}
                        className="self-end rounded-full bg-[#c3d3bc] px-4 py-2.5 text-sm font-black shadow-sm"
                      >
                        Toevoegen
                      </button>
                    </div>
                    <div className="mt-3 grid gap-2">
                      {draft.productionLog.length ? (
                        draft.productionLog.map((entry) => (
                          <div
                            key={entry.id}
                            className="grid gap-2 rounded-2xl bg-[#fffdf8] p-3 sm:grid-cols-[9rem_8rem_minmax(0,1fr)_auto] sm:items-center"
                          >
                            <DateField
                              label="Datum"
                              value={entry.date}
                              onChange={(value) =>
                                updateProductionLogEntry(entry.id, {
                                  date: value,
                                })
                              }
                            />
                            <EditTextField
                              label="Aantal"
                              value={formatInputNumber(entry.quantity)}
                              onChange={(value) =>
                                updateProductionLogEntry(entry.id, {
                                  quantity: parseDutchNumber(value),
                                })
                              }
                              inputMode="decimal"
                            />
                            <EditTextField
                              label={
                                entry.source === "stock"
                                  ? "Notitie voorraad"
                                  : "Notitie"
                              }
                              value={entry.note || ""}
                              onChange={(value) =>
                                updateProductionLogEntry(entry.id, {
                                  note: value,
                                })
                              }
                            />
                            <button
                              type="button"
                              onClick={() => removeProductionLogEntry(entry.id)}
                              className="rounded-full bg-[#fff4f1] px-3 py-2 text-xs font-black text-[#a83e31]"
                            >
                              Verwijder
                            </button>
                          </div>
                        ))
                      ) : (
                        <p className="rounded-2xl bg-[#f8f6f3] p-3 text-sm font-bold text-[#2d2a26]/50">
                          Nog geen producties geregistreerd.
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-[#ead7a6] bg-[#fff8e3] p-3">
                    <p className="text-sm font-black">Extra productie plannen</p>
                    <p className="mt-1 text-xs font-bold text-[#2d2a26]/50">
                      Bijvoorbeeld voor een aanbieding, grote bestelling of drukke week.
                    </p>
                    <div className="mt-3 grid gap-2 sm:grid-cols-[9rem_8rem_minmax(0,1fr)_auto]">
                      <DateField
                        label="Datum"
                        value={newProductionRequest.date}
                        onChange={(value) =>
                          setNewProductionRequest((current) => ({
                            ...current,
                            date: value,
                          }))
                        }
                      />
                      <EditTextField
                        label="Aantal"
                        value={newProductionRequest.quantity}
                        onChange={(value) =>
                          setNewProductionRequest((current) => ({
                            ...current,
                            quantity: value,
                          }))
                        }
                        inputMode="decimal"
                      />
                      <EditTextField
                        label="Reden"
                        value={newProductionRequest.reason}
                        onChange={(value) =>
                          setNewProductionRequest((current) => ({
                            ...current,
                            reason: value,
                          }))
                        }
                      />
                      <button
                        type="button"
                        onClick={addProductionRequest}
                        className="self-end rounded-full bg-[#c3d3bc] px-4 py-2.5 text-sm font-black shadow-sm"
                      >
                        Plan
                      </button>
                    </div>
                    <div className="mt-3 grid gap-2">
                      {draft.productionRequests.length ? (
                        draft.productionRequests.map((request) => (
                          <div
                            key={request.id}
                            className="grid gap-2 rounded-2xl bg-white p-3 sm:grid-cols-[8rem_8rem_minmax(0,1fr)_auto] sm:items-center"
                          >
                            <p className="text-sm font-black">
                              {formatDate(request.date)}
                            </p>
                            <p className="text-sm font-black">
                              {planningQuantityLabel(
                                request.quantity,
                                draft.standardBatchUnit
                              )}
                            </p>
                            <p className="text-xs font-bold text-[#2d2a26]/50">
                              {request.reason} ·{" "}
                              {request.status === "done" ? "gemaakt" : "open"}
                            </p>
                            <button
                              type="button"
                              onClick={() => removeProductionRequest(request.id)}
                              className="rounded-full bg-[#fff4f1] px-3 py-2 text-xs font-black text-[#a83e31]"
                            >
                              Verwijder
                            </button>
                          </div>
                        ))
                      ) : (
                        <p className="rounded-2xl bg-white p-3 text-sm font-bold text-[#2d2a26]/50">
                          Geen extra geplande producties.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </EditorBlock>
              )}

              {activeEditSection === "grondstoffen" && (
              <EditorBlock title="Grondstoffen">
                <div className="grid gap-2">
                  {draft.ingredients.map((line) => {
                    const selectedIngredient = findIngredient(
                      availableIngredients,
                      line.ingredientId
                    );
                    const normalizedLine = normalizeIngredientDraft(
                      line,
                      availableIngredients
                    );

                    return (
                      <div
                        key={line.id}
                        className="grid gap-2 rounded-2xl border border-[#dfe9d8] bg-white p-3 lg:grid-cols-[minmax(12rem,1fr)_7rem_7rem_7rem_auto]"
                      >
                        <IngredientSearchField
                          ingredients={availableIngredients}
                          value={line.ingredientId}
                          onChange={(value) => {
                            const ingredient = findIngredient(
                              availableIngredients,
                              value
                            );
                            updateIngredientLine(line.id, {
                              ingredientId: value,
                              unit: ingredient?.recipeUnit || line.unit,
                            });
                          }}
                        />
                        <EditTextField
                          label="Aantal"
                          value={line.quantity}
                          onChange={(value) =>
                            updateIngredientLine(line.id, { quantity: value })
                          }
                          inputMode="decimal"
                        />
                        <SelectField
                          label="Eenheid"
                          value={line.unit}
                          onChange={(value) =>
                            updateIngredientLine(line.id, {
                              unit: value as RecipeUnit,
                            })
                          }
                          options={recipeUnits.map((unit) => ({
                            value: unit,
                            label: unitLabelText(unit),
                          }))}
                        />
                        <Metric
                          label="Kost"
                          value={formatEuro(normalizedLine.costContribution)}
                        />
                        <button
                          type="button"
                          onClick={() => removeIngredientLine(line.id)}
                          className="self-end rounded-full bg-[#fff4f1] px-3 py-2 text-sm font-black text-[#a83e31]"
                        >
                          Verwijder
                        </button>
                        {selectedIngredient && (
                          <p className="text-xs font-bold text-[#2d2a26]/45 lg:col-span-5">
                            {selectedIngredient.supplier} -{" "}
                            {selectedIngredient.packageSize} -{" "}
                            {formatEuro(selectedIngredient.pricePerBaseUnit)} per
                            basiseenheid
                          </p>
                        )}
                      </div>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => addIngredientLine()}
                    className="w-fit rounded-full bg-[#c3d3bc] px-4 py-2.5 text-sm font-black shadow-sm"
                  >
                    Grondstofregel toevoegen
                  </button>
                </div>

                <div className="mt-4 rounded-2xl border border-[#e7e0d8] bg-[#fffdf8] p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-black">Nieuwe grondstof</p>
                      <p className="mt-1 text-xs font-bold text-[#2d2a26]/45">
                        Gebruik dit alleen als de grondstof nog niet in de lijst staat.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsAddingNewIngredient((current) => !current)}
                      className="rounded-full bg-[#c3d3bc] px-4 py-2.5 text-sm font-black shadow-sm"
                    >
                      {isAddingNewIngredient ? "Sluit invoer" : "Nieuwe grondstof toevoegen"}
                    </button>
                  </div>

                  {isAddingNewIngredient && (
                    <div className="mt-3 grid gap-2 lg:grid-cols-3">
                      <EditTextField
                        label="Naam"
                        value={newIngredient.name}
                        onChange={(value) =>
                          setNewIngredient((current) => ({
                            ...current,
                            name: value,
                          }))
                        }
                      />
                      <EditTextField
                        label="Leverancier"
                        value={newIngredient.supplier}
                        onChange={(value) =>
                          setNewIngredient((current) => ({
                            ...current,
                            supplier: value,
                          }))
                        }
                      />
                      <EditTextField
                        label="Artikelnummer"
                        value={newIngredient.supplierArticleNumber}
                        onChange={(value) =>
                          setNewIngredient((current) => ({
                            ...current,
                            supplierArticleNumber: value,
                          }))
                        }
                      />
                      <EditTextField
                        label="Verpakking"
                        value={newIngredient.packageSize}
                        onChange={(value) =>
                          setNewIngredient((current) => ({
                            ...current,
                            packageSize: value,
                          }))
                        }
                      />
                      <SelectField
                        label="Rekeneenheid"
                        value={newIngredient.recipeUnit}
                        onChange={(value) =>
                          setNewIngredient((current) => ({
                            ...current,
                            recipeUnit: value as RecipeUnit,
                          }))
                        }
                        options={recipeUnits.map((unit) => ({
                          value: unit,
                          label: unitLabelText(unit),
                        }))}
                      />
                      <EditTextField
                        label="Prijs /kg, /l of /st"
                        value={newIngredient.packagePrice}
                        onChange={(value) =>
                          setNewIngredient((current) => ({
                            ...current,
                            packagePrice: value,
                          }))
                        }
                        inputMode="decimal"
                      />
                      <EditTextField
                        label="Allergenen"
                        value={newIngredient.allergens}
                        onChange={(value) =>
                          setNewIngredient((current) => ({
                            ...current,
                            allergens: value,
                          }))
                        }
                      />
                      <EditTextField
                        label="Aliases"
                        value={newIngredient.aliases}
                        onChange={(value) =>
                          setNewIngredient((current) => ({
                            ...current,
                            aliases: value,
                          }))
                        }
                      />
                      <button
                        type="button"
                        onClick={createNewIngredient}
                        className="self-end rounded-full bg-[#c3d3bc] px-4 py-3 text-sm font-black shadow-sm"
                      >
                        Toevoegen en gebruiken
                      </button>
                    </div>
                  )}
                </div>
              </EditorBlock>
              )}

              {activeEditSection === "halffabricaten" && (
              <EditorBlock title="Halffabricaten">
                <div className="grid gap-2">
                  {draft.semiFinishedItems.map((line) => {
                    const normalizedLine = normalizeSemiFinishedDraft(
                      line,
                      recipes
                    );

                    return (
                      <div
                        key={line.id}
                        className="grid gap-2 rounded-2xl border border-[#dfe9d8] bg-white p-3 lg:grid-cols-[minmax(12rem,1fr)_7rem_7rem_7rem_auto]"
                      >
                        <SelectField
                          label="Halffabricaat"
                          value={line.semiFinishedRecipeId}
                          onChange={(value) =>
                            updateSemiFinishedLine(line.id, {
                              semiFinishedRecipeId: value,
                              unit:
                                getBatchInfo(findRecipe(recipes, value))?.unit ||
                                line.unit,
                            })
                          }
                          options={[
                            { value: "", label: "Kies halffabricaat" },
                            ...semiFinishedOptions.map((item) => ({
                              value: item.id,
                              label: item.name,
                            })),
                          ]}
                        />
                        <EditTextField
                          label="Aantal"
                          value={line.quantity}
                          onChange={(value) =>
                            updateSemiFinishedLine(line.id, { quantity: value })
                          }
                          inputMode="decimal"
                        />
                        <SelectField
                          label="Eenheid"
                          value={line.unit}
                          onChange={(value) =>
                            updateSemiFinishedLine(line.id, {
                              unit: value as RecipeUnit,
                            })
                          }
                          options={recipeUnits.map((unit) => ({
                            value: unit,
                            label: unitLabelText(unit),
                          }))}
                        />
                        <Metric
                          label="Kost"
                          value={formatEuro(normalizedLine.costContribution)}
                        />
                        <button
                          type="button"
                          onClick={() => removeSemiFinishedLine(line.id)}
                          className="self-end rounded-full bg-[#fff4f1] px-3 py-2 text-sm font-black text-[#a83e31]"
                        >
                          Verwijder
                        </button>
                      </div>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => addSemiFinishedLine()}
                    className="w-fit rounded-full bg-[#c3d3bc] px-4 py-2.5 text-sm font-black shadow-sm"
                  >
                    Halffabricaat toevoegen
                  </button>
                </div>
              </EditorBlock>
              )}

              {activeEditSection === "stappen" && (
              <div className="grid gap-4 xl:grid-cols-2">
                <ArrayEditor
                  title="Productiestappen"
                  values={draft.preparationSteps}
                  onChange={(values) => updateDraft({ preparationSteps: values })}
                  placeholder="Beschrijf de volgende stap"
                />
                <ArrayEditor
                  title="Werkmodus stappen"
                  values={draft.workInstructions}
                  onChange={(values) => updateDraft({ workInstructions: values })}
                  placeholder="Stap voor bakkers op de werkvloer"
                />
                {draft.type === "finalProduct" && (
                  <ArrayEditor
                    title="Afwerking"
                    values={draft.finishingSteps}
                    onChange={(values) => updateDraft({ finishingSteps: values })}
                    placeholder="Laatste controle of afwerking"
                  />
                )}
                <ArrayEditor
                  title="Benodigd materiaal"
                  values={draft.equipment}
                  onChange={(values) => updateDraft({ equipment: values })}
                  placeholder="Bijv. ring, spatel, thermomixer"
                />
              </div>
              )}

              {activeEditSection === "notities" && (
              <EditorBlock title="Allergenen en opmerkingen">
                <div className="grid gap-3 lg:grid-cols-2">
                  <EditTextField
                    label="Allergenen"
                    value={draft.allergens}
                    onChange={(value) => updateDraft({ allergens: value })}
                  />
                  <TextAreaField
                    label="Interne opmerkingen"
                    value={draft.internalNotes}
                    onChange={(value) => updateDraft({ internalNotes: value })}
                  />
                  <TextAreaField
                    label="Managementnotities"
                    value={draft.notes}
                    onChange={(value) => updateDraft({ notes: value })}
                  />
                </div>
              </EditorBlock>
              )}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={saveRecipeDraft}
                className="rounded-full bg-[#c3d3bc] px-4 py-2.5 text-sm font-black shadow-sm"
              >
                Recept opslaan
              </button>
              <button
                type="button"
                onClick={() => {
                  setDraft(createRecipeDraft(recipe));
                  setIsEditing(false);
                }}
                className="rounded-full bg-white px-4 py-2.5 text-sm font-black text-[#2d2a26]/60 shadow-sm"
              >
                Annuleer
              </button>
              <p className="text-sm font-black text-[#45663b]">
                {draft.type === "finalProduct"
                  ? `Nieuwe kostprijs/stuk: ${formatEuro(previewCostPrice)}`
                  : `Nieuwe kostprijs/kg: ${formatEuro(previewCostPrice)}`}
              </p>
              {draft.type === "finalProduct" && (
                <p className="text-sm font-black text-[#2d2a26]/55">
                  Batch totaal: {formatEuro(previewBatchCost)}
                </p>
              )}
              {feedback && (
                <p className="text-sm font-black text-[#45663b]">
                  {feedback}
                </p>
              )}
            </div>

            <div className="mt-3 rounded-2xl border border-[#efc2bb] bg-[#fff4f1] p-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-black text-[#a83e31]">
                    Recept verwijderen
                  </p>
                  <p className="mt-1 text-xs font-bold leading-snug text-[#2d2a26]/55">
                    {recipeUsageCount
                      ? `Dit recept wordt in ${recipeUsageCount} ander recept gebruikt. Die koppeling wordt ook verwijderd.`
                      : "Dit haalt het recept uit het management- en werkoverzicht."}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {isConfirmingDelete && (
                    <button
                      type="button"
                      onClick={() => setIsConfirmingDelete(false)}
                      className="rounded-full bg-white px-4 py-2.5 text-sm font-black text-[#2d2a26]/60 shadow-sm"
                    >
                      Toch houden
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={requestDeleteRecipe}
                    className={`inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-black shadow-sm ${
                      isConfirmingDelete
                        ? "bg-[#a83e31] text-white"
                        : "bg-white text-[#a83e31]"
                    }`}
                  >
                    <TrashIcon />
                    {isConfirmingDelete
                      ? "Ja, definitief verwijderen"
                      : "Verwijder recept"}
                  </button>
                </div>
              </div>
            </div>
          </Panel>
        )}

        {!isEditing && (
        <div
          className={`mt-4 grid gap-4 ${
            previewRecipe.type === "finalProduct"
              ? "lg:grid-cols-[18rem_minmax(0,1fr)]"
              : "lg:grid-cols-[16rem_minmax(0,1fr)]"
          }`}
        >
          <Panel className="bg-[#fffdf8]">
            {previewRecipe.type === "finalProduct" && (
            <div
              className="relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-[1.1rem] border border-[#e7e0d8] bg-[#eadfcf] bg-cover bg-center p-4 text-center"
              style={
                previewRecipe.photoPreviewDataUrl
                  ? {
                      backgroundImage: `url("${previewRecipe.photoPreviewDataUrl}")`,
                    }
                  : undefined
              }
            >
              {previewRecipe.photoPreviewDataUrl ? (
                <div className="absolute inset-x-3 bottom-3 rounded-2xl bg-white/88 px-3 py-2 text-left shadow-sm">
                  <p className="text-[0.65rem] font-black uppercase tracking-[0.14em] text-[#2d2a26]/45">
                    Foto preview
                  </p>
                  <p className="truncate text-sm font-black">
                    {previewRecipe.photoHint || previewRecipe.photoFileName || recipe.name}
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-[#2d2a26]/45">
                    Foto placeholder
                  </p>
                  <p className="mt-2 text-lg font-black">
                    {previewRecipe.photoHint}
                  </p>
                </div>
              )}
            </div>
            )}
            <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
              {previewRecipe.type === "finalProduct" && (
                <Metric
                  label="Verkoopprijs"
                  value={salesPrice ? formatEuro(salesPrice) : "-"}
                />
              )}
              <Metric
                label={previewRecipe.type === "finalProduct" ? "Kost/stuk" : "Kost/kg"}
                value={formatEuro(previewCostPrice)}
              />
              {previewRecipe.type === "finalProduct" && (
                <>
                  <Metric
                    label="Marge"
                    value={
                      calculateMargin(salesPrice, previewCostPrice)
                        ? formatPercent(calculateMargin(salesPrice, previewCostPrice))
                        : "-"
                    }
                  />
                  <Metric
                    label="Doelmarge totaal"
                    value={
                      effectiveMarginTarget
                        ? formatPercent(effectiveMarginTarget, 1)
                        : "-"
                    }
                  />
                  <Metric
                    label="Verkooptempo"
                    value={
                      previewRecipe.averageSalesQuantity
                        ? `${previewRecipe.averageSalesQuantity.toLocaleString(
                            "nl-NL"
                          )} ${salesPeriodText(
                            previewRecipe.averageSalesPeriod || "week"
                          )}`
                        : "-"
                    }
                  />
                </>
              )}
              <Metric label="Portie" value={draft.portionLabel} />
              <Metric label="Batch" value={draft.batchSize} />
              <Metric
                label="Batchgewicht"
                value={formatBatchWeight(previewMadeWeightKg)}
              />
              {previewRecipe.type === "finalProduct" && (
                <Metric label="Batch totaal" value={formatEuro(previewBatchCost)} />
              )}
            </div>
          </Panel>

          <div className="grid gap-4">
            <Panel>
              <SectionTitle
                title="Kostprijsopbouw"
                description={
                  previewRecipe.type === "finalProduct"
                    ? "Verpakking staat per stuk in de invoer en wordt voor de batch automatisch doorgerekend."
                    : "Totaalgewicht komt automatisch uit de grondstoffen. Kostprijs is de inkoopprijs per kg."
                }
              />
              <div
                className={`mt-4 grid gap-3 sm:grid-cols-2 ${
                  previewRecipe.type === "finalProduct"
                    ? "xl:grid-cols-6"
                    : "xl:grid-cols-4"
                }`}
              >
                <Metric label="Direct batch" value={formatEuro(directTotal)} />
                <Metric
                  label="Halffab. batch"
                  value={formatEuro(semiFinishedTotal)}
                />
                {previewRecipe.type === "finalProduct" && (
                  <>
                    <Metric label="Verpakking" value={formatEuro(packagingTotal)} />
                  </>
                )}
                {previewRecipe.type === "finalProduct" && (
                  <Metric
                    label="Batchgewicht"
                    value={formatBatchWeight(previewMadeWeightKg)}
                  />
                )}
                <Metric
                  label={
                    previewRecipe.type === "finalProduct"
                      ? "Batch totaal"
                      : "Gewicht"
                  }
                  value={
                    previewRecipe.type === "finalProduct"
                      ? formatEuro(previewBatchCost)
                      : `${formatInputNumber(previewBatchQuantity)} kg`
                  }
                />
                <Metric
                  label={previewRecipe.type === "finalProduct" ? "Per stuk" : "Per kg"}
                  value={formatEuro(previewCostPrice)}
                />
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <Metric
                  label="Verschil"
                  value={`${formatEuro(recipeCostDelta(previewRecipe))} - ${formatPercent(
                    recipeCostChange(previewRecipe),
                    1
                  )}`}
                  className={changeBadgeClass(recipeCostChange(previewRecipe))}
                />
                {previewRecipe.type === "finalProduct" && (
                  <Metric
                    label="Rekenregel"
                    value={`${formatEuro(previewBatchCost)} / ${previewBatchQuantity.toLocaleString(
                      "nl-NL"
                    )}`}
                  />
                )}
              </div>
              {previewRecipe.type === "finalProduct" && (
                <div className="mt-4 rounded-2xl border border-[#ead7a6] bg-[#fff8e3] p-3">
                  <p className="text-sm font-black text-[#7a5a18]">
                    Adviesprijs volgens marge-instellingen:{" "}
                    {formatEuro(targetPrice)}
                  </p>
                  <p className="mt-1 text-xs font-bold text-[#2d2a26]/55">
                    Basisrecept rekent met {formatPercent(previewRecipe.targetMargin)} marge
                    en verpakking tegen kostprijs. Daardoor is de totale
                    doelmarge hier {formatPercent(effectiveMarginTarget, 1)}.
                    Verkoopprijs moet met{" "}
                    {formatEuro(Math.max(0, targetPrice - previewRecipe.salesPrice))}{" "}
                    omhoog om de doelmarge te halen.
                  </p>
                </div>
              )}
            </Panel>

            <div className="grid gap-4 xl:grid-cols-2">
              <Panel>
                <SectionTitle title="Ingredienten direct in recept" />
                <div className="mt-3 grid gap-2">
                  {previewRecipe.ingredients.length ? (
                    previewRecipe.ingredients.map((item, index) => {
                      const ingredient = findIngredient(
                        availableIngredients,
                        item.ingredientId
                      );

                      return (
                        <LineItem
                          key={`${item.ingredientId}-${index}`}
                          title={ingredient?.name || item.ingredientId}
                          meta={quantityLabel(item.quantity, item.unit)}
                          value={formatEuro(item.costContribution)}
                        />
                      );
                    })
                  ) : (
                    <p className="rounded-2xl bg-[#f8f6f3] p-3 text-sm font-bold text-[#2d2a26]/45">
                      Nog geen directe ingredienten.
                    </p>
                  )}
                </div>
              </Panel>

              <Panel>
                <SectionTitle title="Gekoppelde halffabricaten" />
                <div className="mt-3 grid gap-2">
                  {previewRecipe.semiFinishedItems.length ? (
                    previewRecipe.semiFinishedItems.map((item, index) => {
                      const linkedRecipe = findRecipe(
                        recipes,
                        item.semiFinishedRecipeId
                      );

                      return (
                        <LineItem
                          key={`${item.semiFinishedRecipeId}-${index}`}
                          title={linkedRecipe?.name || item.semiFinishedRecipeId}
                          meta={quantityLabel(item.quantity, item.unit)}
                          value={formatEuro(item.costContribution)}
                        />
                      );
                    })
                  ) : (
                    <p className="rounded-2xl bg-[#f8f6f3] p-3 text-sm font-bold text-[#2d2a26]/45">
                      Geen gekoppelde halffabricaten.
                    </p>
                  )}
                </div>
              </Panel>
            </div>

            {previewRecipe.type === "finalProduct" && (
              <Panel>
                <SectionTitle
                  title="Verpakking in recept"
                  description="Deze kosten tellen mee in de volledige kostprijs per stuk."
                />
                <div className="mt-3 grid gap-2">
                  {previewRecipe.packagingItems?.length ? (
                    previewRecipe.packagingItems.map((item, index) => (
                      <LineItem
                        key={`${item.packagingId}-${index}`}
                        title={
                          item.nameSnapshot || item.packagingId || "Verpakking"
                        }
                        meta={`${formatInputNumber(item.quantity)} per stuk`}
                        value={formatEuro(item.costContribution)}
                      />
                    ))
                  ) : (
                    <p className="rounded-2xl bg-[#f8f6f3] p-3 text-sm font-bold text-[#2d2a26]/45">
                      Geen verpakkingen uit de lijst gekoppeld.
                    </p>
                  )}
                  {manualPackagingUnitCost > 0 && (
                    <LineItem
                      title="Eigen verpakkingsbedrag"
                      meta="Handmatig per stuk"
                      value={formatEuro(manualPackagingUnitCost)}
                    />
                  )}
                </div>
              </Panel>
            )}

            <div className="grid gap-4 xl:grid-cols-2">
              <Panel>
                <SectionTitle title="Bereidingswijze" />
                <ol className="mt-3 grid gap-2">
                  {previewRecipe.preparationSteps.map((step, index) => (
                    <li
                      key={`${step}-${index}`}
                      className="flex gap-3 rounded-2xl bg-[#fffdf8] p-3"
                    >
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#c3d3bc] text-sm font-black">
                        {index + 1}
                      </span>
                      <span className="text-sm font-semibold leading-relaxed text-[#2d2a26]/70">
                        {step}
                      </span>
                    </li>
                  ))}
                </ol>
              </Panel>

              <Panel>
                <SectionTitle title="Allergenen en interne notities" />
                <div className="mt-3 flex flex-wrap gap-2">
                  {previewRecipe.allergens.length ? (
                    previewRecipe.allergens.map((allergen) => (
                      <span
                        key={allergen}
                        className="rounded-full bg-[#f8f6f3] px-3 py-1 text-xs font-black text-[#2d2a26]/55"
                      >
                        {allergen}
                      </span>
                    ))
                  ) : (
                    <span className="rounded-full bg-[#f8f6f3] px-3 py-1 text-xs font-black text-[#2d2a26]/45">
                      Geen allergenen ingevuld
                    </span>
                  )}
                </div>
                <p className="mt-4 rounded-2xl bg-[#fffdf8] p-3 text-sm font-semibold leading-relaxed text-[#2d2a26]/65">
                  {previewRecipe.internalNotes || previewRecipe.notes || "-"}
                </p>
                <div className="mt-4 rounded-2xl border border-[#e7e0d8] bg-white p-3">
                  <p className="text-sm font-black">Versiegeschiedenis</p>
                  <p className="mt-1 text-xs font-bold text-[#2d2a26]/50">
                    {previewRecipe.version} - laatst gewijzigd op{" "}
                    {formatDate(previewRecipe.lastUpdated)}
                  </p>
                  <p className="mt-1 text-xs font-bold text-[#2d2a26]/50">
                    Vorige calculatie: {formatEuro(previewRecipe.previousCostPrice)}
                  </p>
                </div>
              </Panel>
            </div>
          </div>
        </div>
        )}

        {!isEditing && (
        <div className="mt-4 flex flex-wrap gap-2 rounded-[1.25rem] bg-white/88 p-3">
          <button
            type="button"
            onClick={() => startEditing("basis")}
            className="rounded-full bg-[#c3d3bc] px-4 py-2.5 text-sm font-black shadow-sm"
          >
            Recept bewerken
          </button>
          <button
            type="button"
            onClick={() => void copyRecipe()}
            className="rounded-full bg-[#c3d3bc] px-4 py-2.5 text-sm font-black shadow-sm"
          >
            Recept kopieren
          </button>
          <button
            type="button"
            onClick={printProductionCard}
            className="rounded-full bg-[#c3d3bc] px-4 py-2.5 text-sm font-black shadow-sm"
          >
            Productiekaart printen
          </button>
          <button
            type="button"
            onClick={recalculateRecipeCost}
            className="rounded-full bg-[#c3d3bc] px-4 py-2.5 text-sm font-black shadow-sm"
          >
            Kostprijs herberekenen
          </button>
          {feedback && (
            <p className="self-center text-sm font-black text-[#45663b]">
              {feedback}
            </p>
          )}
        </div>
        )}
      </div>
    </div>
  );
}

type RecipeIngredientDraft = {
  id: string;
  ingredientId: string;
  quantity: string;
  unit: RecipeUnit;
  costContribution: number;
};

type SemiFinishedDraft = {
  id: string;
  semiFinishedRecipeId: string;
  quantity: string;
  unit: RecipeUnit;
  costContribution: number;
};

type RecipePackagingDraft = {
  id: string;
  packagingId: string;
  quantity: string;
  unitPrice: number;
  costContribution: number;
  nameSnapshot: string;
};

type RecipeDraft = {
  name: string;
  type: RecipeType;
  productGroup: string;
  salesPrice: string;
  targetMargin: string;
  status: RecipeStatus;
  portionLabel: string;
  batchSize: string;
  standardBatchQuantity: string;
  standardBatchUnit: RecipeUnit;
  packagingCost: string;
  decorationCost: string;
  decorationMargin: string;
  averageSalesQuantity: string;
  averageSalesPeriod: SalesPeriod;
  productionLog: ProductionLogEntry[];
  productionRequests: ProductionRequest[];
  version: string;
  photoHint: string;
  photoPreviewDataUrl: string;
  photoFileName: string;
  photoUpdatedAt: string;
  isWorkModeVisible: boolean;
  workCategories: string[];
  ingredients: RecipeIngredientDraft[];
  semiFinishedItems: SemiFinishedDraft[];
  packagingItems: RecipePackagingDraft[];
  preparationSteps: string[];
  workInstructions: string[];
  finishingSteps: string[];
  equipment: string[];
  allergens: string;
  internalNotes: string;
  notes: string;
};

type NewIngredientDraft = {
  name: string;
  supplier: string;
  supplierArticleNumber: string;
  packageSize: string;
  recipeUnit: RecipeUnit;
  packagePrice: string;
  allergens: string;
  aliases: string;
};

function createRecipeDraft(recipe: Recipe): RecipeDraft {
  return {
    name: recipe.name,
    type: recipe.type,
    productGroup: recipe.productGroup,
    salesPrice: formatInputNumber(recipe.salesPrice),
    targetMargin: formatInputNumber(recipe.targetMargin),
    status: recipe.status,
    portionLabel: recipe.portionLabel,
    batchSize: recipe.batchSize,
    standardBatchQuantity: formatInputNumber(
      recipe.standardBatchQuantity || getBatchInfo(recipe)?.quantity || 0
    ),
    standardBatchUnit:
      recipe.standardBatchUnit || getBatchInfo(recipe)?.unit || "stuk",
    packagingCost: formatInputNumber(recipe.packagingCost || 0),
    decorationCost: formatInputNumber(recipe.decorationCost || 0),
    decorationMargin: formatInputNumber(recipe.decorationMargin ?? 30),
    averageSalesQuantity: formatInputNumber(recipe.averageSalesQuantity || 0),
    averageSalesPeriod: recipe.averageSalesPeriod || "week",
    productionLog: productionLogForRecipe(recipe),
    productionRequests: normalizeProductionRequests(recipe.productionRequests || []),
    version: recipe.version,
    photoHint: recipe.photoHint,
    photoPreviewDataUrl: recipe.photoPreviewDataUrl || "",
    photoFileName: recipe.photoFileName || "",
    photoUpdatedAt: recipe.photoUpdatedAt || "",
    isWorkModeVisible: recipe.isWorkModeVisible ?? true,
    workCategories:
      recipe.type === "finalProduct" ? workCategoriesForRecipe(recipe) : [],
    ingredients: recipe.ingredients.map((item) => ({
      id: createLocalId("ingredient-line"),
      ingredientId: item.ingredientId,
      quantity: formatInputNumber(item.quantity),
      unit: item.unit,
      costContribution: item.costContribution,
    })),
    semiFinishedItems: recipe.semiFinishedItems.map((item) => ({
      id: createLocalId("semi-line"),
      semiFinishedRecipeId: item.semiFinishedRecipeId,
      quantity: formatInputNumber(item.quantity),
      unit: item.unit,
      costContribution: item.costContribution,
    })),
    packagingItems: (recipe.packagingItems || []).map((item) => ({
      id: item.id || createLocalId("packaging-line"),
      packagingId: item.packagingId,
      quantity: formatInputNumber(item.quantity),
      unitPrice: item.unitPrice,
      costContribution: item.costContribution,
      nameSnapshot: item.nameSnapshot || "",
    })),
    preparationSteps: recipe.preparationSteps.length
      ? recipe.preparationSteps
      : [""],
    workInstructions: recipe.workInstructions?.length
      ? recipe.workInstructions
      : [""],
    finishingSteps: recipe.finishingSteps?.length ? recipe.finishingSteps : [""],
    equipment: recipe.equipment?.length ? recipe.equipment : [""],
    allergens: recipe.allergens.join(", "),
    internalNotes: recipe.internalNotes || "",
    notes: recipe.notes,
  };
}

function recipeDraftFromImportedRecipe(
  current: RecipeDraft,
  importedRecipe: Recipe
): RecipeDraft {
  return {
    ...current,
    name: importedRecipe.name || current.name,
    type: current.type,
    productGroup: importedRecipe.productGroup || current.productGroup,
    standardBatchQuantity: formatInputNumber(
      importedRecipe.standardBatchQuantity ||
        getBatchInfo(importedRecipe)?.quantity ||
        parseDutchNumber(current.standardBatchQuantity)
    ),
    standardBatchUnit:
      importedRecipe.standardBatchUnit ||
      getBatchInfo(importedRecipe)?.unit ||
      current.standardBatchUnit,
    batchSize: importedRecipe.batchSize || current.batchSize,
    portionLabel: importedRecipe.portionLabel || current.portionLabel,
    averageSalesQuantity: importedRecipe.averageSalesQuantity
      ? formatInputNumber(importedRecipe.averageSalesQuantity)
      : current.averageSalesQuantity,
    averageSalesPeriod:
      importedRecipe.averageSalesPeriod || current.averageSalesPeriod,
    workCategories:
      importedRecipe.type === "finalProduct" && importedRecipe.workCategories?.length
        ? importedRecipe.workCategories
        : current.workCategories,
    ingredients: importedRecipe.ingredients.length
      ? importedRecipe.ingredients.map((item) => ({
          id: createLocalId("ingredient-line"),
          ingredientId: item.ingredientId,
          quantity: formatInputNumber(item.quantity),
          unit: item.unit,
          costContribution: item.costContribution,
        }))
      : current.ingredients,
    semiFinishedItems: importedRecipe.semiFinishedItems.length
      ? importedRecipe.semiFinishedItems.map((item) => ({
          id: createLocalId("semi-line"),
          semiFinishedRecipeId: item.semiFinishedRecipeId,
          quantity: formatInputNumber(item.quantity),
          unit: item.unit,
          costContribution: item.costContribution,
        }))
      : current.semiFinishedItems,
    packagingItems: importedRecipe.packagingItems?.length
      ? importedRecipe.packagingItems.map((item) => ({
          id: item.id || createLocalId("packaging-line"),
          packagingId: item.packagingId,
          quantity: formatInputNumber(item.quantity),
          unitPrice: item.unitPrice,
          costContribution: item.costContribution,
          nameSnapshot: item.nameSnapshot || "",
        }))
      : current.packagingItems,
    preparationSteps: importedRecipe.preparationSteps.length
      ? importedRecipe.preparationSteps
      : current.preparationSteps,
    workInstructions: importedRecipe.workInstructions?.length
      ? importedRecipe.workInstructions
      : current.workInstructions,
    finishingSteps: importedRecipe.finishingSteps?.length
      ? importedRecipe.finishingSteps
      : current.finishingSteps,
    equipment: importedRecipe.equipment?.length
      ? importedRecipe.equipment
      : current.equipment,
    allergens: importedRecipe.allergens.length
      ? importedRecipe.allergens.join(", ")
      : current.allergens,
    internalNotes: importedRecipe.internalNotes || current.internalNotes,
    notes: importedRecipe.notes || current.notes,
    photoHint: importedRecipe.photoHint || current.photoHint,
  };
}

function createIngredientDraft(): NewIngredientDraft {
  return {
    name: "",
    supplier: "",
    supplierArticleNumber: "",
    packageSize: "1 kg",
    recipeUnit: "gram",
    packagePrice: "",
    allergens: "",
    aliases: "",
  };
}

function buildRecipeFromDraft(
  recipe: Recipe,
  draft: RecipeDraft,
  recipeIngredients: RecipeIngredient[],
  semiFinishedItems: SemiFinishedUsage[],
  packagingItems: RecipePackagingLine[],
  costPrice: number
): Recipe {
  const isSemiFinished = draft.type === "semiFinished";
  const salesPrice = isSemiFinished ? 0 : parseDutchNumber(draft.salesPrice);
  const autoWeightKg = recipeMadeWeightKg(recipeIngredients, semiFinishedItems);
  const standardBatchQuantity = isSemiFinished
    ? autoWeightKg || parseDutchNumber(draft.standardBatchQuantity) || undefined
    : parseDutchNumber(draft.standardBatchQuantity) || undefined;
  const standardBatchUnit: RecipeUnit = isSemiFinished
    ? "kg"
    : draft.standardBatchUnit;
  const batchSize = batchLabelFromValues(
    standardBatchQuantity,
    standardBatchUnit,
    draft.batchSize || recipe.batchSize
  );

  const updatedRecipe: Recipe = {
    ...recipe,
    name: draft.name.trim() || recipe.name,
    type: draft.type,
    productGroup: draft.productGroup.trim() || recipe.productGroup,
    standardBatchQuantity,
    standardBatchUnit,
    salesPrice,
    costPrice,
    previousCostPrice: recipe.costPrice,
    targetMargin: isSemiFinished ? 0 : parseDutchNumber(draft.targetMargin),
    currentMargin: isSemiFinished ? 0 : calculateMargin(salesPrice, costPrice),
    status: draft.status,
    ingredients: recipeIngredients,
    semiFinishedItems,
    packagingItems: isSemiFinished ? [] : packagingItems,
    workInstructions: cleanList(draft.workInstructions),
    preparationSteps: cleanList(draft.preparationSteps),
    finishingSteps: isSemiFinished ? [] : cleanList(draft.finishingSteps),
    equipment: cleanList(draft.equipment),
    allergens: parseList(draft.allergens),
    internalNotes: draft.internalNotes.trim(),
    isWorkModeVisible: draft.isWorkModeVisible,
    workCategories: isSemiFinished
      ? []
      : Array.from(new Set(draft.workCategories.map(normalizeWorkCategory).filter(Boolean))),
    version: draft.version.trim() || recipe.version || "v1",
    lastUpdated: todayIsoDate(),
    portionLabel: portionLabelFromValues(draft.type, standardBatchUnit),
    batchSize,
    photoHint: isSemiFinished
      ? ""
      : draft.photoHint.trim() || draft.name.trim() || recipe.photoHint,
    photoPreviewDataUrl: isSemiFinished ? "" : draft.photoPreviewDataUrl,
    photoFileName: isSemiFinished ? "" : draft.photoFileName.trim(),
    photoUpdatedAt: isSemiFinished ? "" : draft.photoUpdatedAt,
    notes: draft.notes.trim(),
    packagingCost: isSemiFinished ? 0 : parseDutchNumber(draft.packagingCost),
    decorationCost: 0,
    decorationMargin: 0,
    averageSalesQuantity: isSemiFinished
      ? 0
      : parseDutchNumber(draft.averageSalesQuantity),
    averageSalesPeriod: isSemiFinished ? "week" : draft.averageSalesPeriod,
    lastProducedAt: isSemiFinished ? "" : draft.productionLog[0]?.date || "",
    lastProducedQuantity: isSemiFinished
      ? 0
      : draft.productionLog[0]?.quantity || 0,
    productionLog: isSemiFinished ? [] : draft.productionLog,
    productionRequests: isSemiFinished ? [] : draft.productionRequests,
  };

  return isSemiFinished
    ? updatedRecipe
    : syncRecipeProductionMetadata(updatedRecipe);
}

function costPriceFromBatchCost(
  type: RecipeType,
  batchCost: number,
  batchQuantity: number
) {
  if ((type === "finalProduct" || type === "semiFinished") && batchQuantity > 0) {
    return roundMoney(batchCost / batchQuantity);
  }

  return roundMoney(batchCost);
}

function batchLabelFromValues(
  quantity: number | undefined,
  unit: RecipeUnit,
  fallback: string
) {
  if (!quantity) return fallback || `1 ${unitLabelText(unit)}`;

  return `${formatInputNumber(quantity)} ${unitLabelText(unit)}`;
}

function portionLabelFromValues(type: RecipeType, unit: RecipeUnit) {
  if (type === "semiFinished") return `per ${unitLabelText(unit)}`;

  return unit === "stuk" ? "per stuk" : `per ${unitLabelText(unit)}`;
}

function normalizeIngredientDrafts(
  lines: RecipeIngredientDraft[],
  ingredients: Ingredient[]
): RecipeIngredient[] {
  return lines
    .map((line) => normalizeIngredientDraft(line, ingredients))
    .filter((line) => line.ingredientId && line.quantity > 0);
}

function normalizeIngredientDraft(
  line: RecipeIngredientDraft,
  ingredients: Ingredient[]
): RecipeIngredient {
  const ingredient = findIngredient(ingredients, line.ingredientId);
  const quantity = parseDutchNumber(line.quantity);

  return {
    ingredientId: line.ingredientId,
    quantity,
    unit: line.unit,
    costContribution: ingredient
      ? ingredientCostForQuantity(ingredient, quantity, line.unit)
      : 0,
  };
}

function normalizeSemiFinishedDrafts(
  lines: SemiFinishedDraft[],
  recipes: Recipe[]
): SemiFinishedUsage[] {
  return lines
    .map((line) => normalizeSemiFinishedDraft(line, recipes))
    .filter((line) => line.semiFinishedRecipeId && line.quantity > 0);
}

function normalizeSemiFinishedDraft(
  line: SemiFinishedDraft,
  recipes: Recipe[]
): SemiFinishedUsage {
  const linkedRecipe = findRecipe(recipes, line.semiFinishedRecipeId);
  const quantity = parseDutchNumber(line.quantity);

  return {
    semiFinishedRecipeId: line.semiFinishedRecipeId,
    quantity,
    unit: line.unit,
    costContribution: linkedRecipe
      ? semiFinishedCostForQuantity(linkedRecipe, quantity, line.unit)
      : 0,
  };
}

function normalizePackagingDrafts(
  lines: RecipePackagingDraft[],
  packagingItems: PackagingItem[]
): RecipePackagingLine[] {
  return normalizeRecipePackagingLines(
    lines.map((line) => {
      const packaging = packagingItems.find((item) => item.id === line.packagingId);

      return {
        id: line.id,
        packagingId: line.packagingId,
        quantity: parseDutchNumber(line.quantity),
        unitPrice: packaging?.unitPrice ?? line.unitPrice ?? 0,
        costContribution: line.costContribution,
        nameSnapshot: packaging?.name || line.nameSnapshot,
      };
    }),
    packagingItems
  );
}

function ingredientCostForQuantity(
  ingredient: Ingredient,
  quantity: number,
  unit: RecipeUnit
) {
  const baseQuantity = convertQuantityToUnit(quantity, unit, ingredient.recipeUnit);

  return roundMoney(baseQuantity * ingredient.pricePerBaseUnit);
}

function semiFinishedCostForQuantity(
  recipe: Recipe,
  quantity: number,
  unit: RecipeUnit
) {
  const batch = getBatchInfo(recipe);
  if (!batch || batch.quantity <= 0) return roundMoney(recipe.costPrice * quantity);

  const requested = convertQuantityToUnit(quantity, unit, batch.unit);

  if (recipe.type === "semiFinished") {
    return roundMoney(requested * recipe.costPrice);
  }

  return roundMoney((requested / batch.quantity) * recipe.costPrice);
}

function recipeLineWeightKg(quantity: number, unit: RecipeUnit) {
  if (unit === "kg") return quantity;
  if (unit === "gram") return quantity / 1000;
  if (unit === "liter") return quantity;
  if (unit === "ml") return quantity / 1000;

  return 0;
}

function recipeMadeWeightKg(
  recipeIngredients: RecipeIngredient[],
  semiFinishedItems: SemiFinishedUsage[]
) {
  const directWeight = recipeIngredients.reduce(
    (total, item) => total + recipeLineWeightKg(item.quantity, item.unit),
    0
  );
  const semiFinishedWeight = semiFinishedItems.reduce(
    (total, item) => total + recipeLineWeightKg(item.quantity, item.unit),
    0
  );

  return roundMoney(directWeight + semiFinishedWeight);
}

function getBatchInfo(recipe?: Recipe | null) {
  if (!recipe) return null;

  if (recipe.standardBatchQuantity && recipe.standardBatchUnit) {
    return {
      quantity: recipe.standardBatchQuantity,
      unit: recipe.standardBatchUnit,
    };
  }

  const match = recipe.batchSize.match(
    /(\d+(?:[.,]\d+)?)\s*(kg|kilo|kilogram|g|gr|gram|l|ltr|liter|ml|st|stuk|stuks)\b/i
  );
  if (!match) return null;

  return {
    quantity: parseDutchNumber(match[1]),
    unit: unitFromText(match[2]),
  };
}

function unitFromText(value: string): RecipeUnit {
  const normalized = value.toLowerCase();
  if (["kg", "kilo", "kilogram"].includes(normalized)) return "kg";
  if (["g", "gr", "gram"].includes(normalized)) return "gram";
  if (["l", "ltr", "liter"].includes(normalized)) return "liter";
  if (normalized === "ml") return "ml";

  return "stuk";
}

function convertQuantityToUnit(
  quantity: number,
  fromUnit: RecipeUnit,
  toUnit: RecipeUnit
) {
  if (fromUnit === toUnit) return quantity;
  if (isWeightUnit(fromUnit) && isWeightUnit(toUnit)) {
    const grams = fromUnit === "kg" ? quantity * 1000 : quantity;
    return toUnit === "kg" ? grams / 1000 : grams;
  }
  if (isVolumeUnit(fromUnit) && isVolumeUnit(toUnit)) {
    const ml = fromUnit === "liter" ? quantity * 1000 : quantity;
    return toUnit === "liter" ? ml / 1000 : ml;
  }

  return quantity;
}

function isWeightUnit(unit: RecipeUnit) {
  return unit === "gram" || unit === "kg";
}

function isVolumeUnit(unit: RecipeUnit) {
  return unit === "ml" || unit === "liter";
}

function parseDutchNumber(value: string) {
  const number = Number(
    value
      .trim()
      .replace(/\s/g, "")
      .replace(/\./g, "")
      .replace(",", ".")
      .replace(/[^\d.-]/g, "")
  );

  if (!Number.isFinite(number)) return 0;

  return Math.max(0, Math.round(number * 10000) / 10000);
}

function calculateMargin(salesPrice: number, costPrice: number) {
  if (!salesPrice) return 0;

  return Math.round(((salesPrice - costPrice) / salesPrice) * 1000) / 10;
}

function roundMoney(value: number) {
  return Math.round(value * 1000) / 1000;
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function formatInputNumber(value: number) {
  if (!value) return "";

  return String(Math.round(value * 10000) / 10000).replace(".", ",");
}

async function createSmallRecipePhotoPreview(file: File) {
  const sourceDataUrl = await readFileAsDataUrl(file);
  const image = await loadImage(sourceDataUrl);
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Canvas wordt niet ondersteund.");
  }

  let bestDataUrl = "";

  for (
    let maxSide = RECIPE_PHOTO_MAX_SIDE;
    maxSide >= RECIPE_PHOTO_MIN_SIDE;
    maxSide -= 40
  ) {
    const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    context.fillStyle = "#fffdf8";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    for (const quality of RECIPE_PHOTO_QUALITIES) {
      const dataUrl = canvas.toDataURL("image/jpeg", quality);
      bestDataUrl =
        !bestDataUrl || dataUrl.length < bestDataUrl.length ? dataUrl : bestDataUrl;

      if (dataUrl.length <= RECIPE_PHOTO_MAX_DATA_URL_LENGTH) {
        return {
          dataUrl,
          fileName: smallJpegFileName(file.name),
        };
      }
    }
  }

  if (bestDataUrl && bestDataUrl.length <= RECIPE_PHOTO_MAX_DATA_URL_LENGTH) {
    return {
      dataUrl: bestDataUrl,
      fileName: smallJpegFileName(file.name),
    };
  }

  throw new Error("Foto blijft te groot.");
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      typeof reader.result === "string"
        ? resolve(reader.result)
        : reject(new Error("Foto kon niet gelezen worden."));
    reader.onerror = () => reject(new Error("Foto kon niet gelezen worden."));
    reader.readAsDataURL(file);
  });
}

function loadImage(dataUrl: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Foto kon niet geopend worden."));
    image.src = dataUrl;
  });
}

function smallJpegFileName(fileName: string) {
  const cleanName = fileName
    .replace(/\.[^.]+$/, "")
    .replace(/[^A-Za-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 42);

  return `${cleanName || "receptfoto"}-preview.jpg`;
}

function parseList(value: string) {
  return value
    .split(/[,;\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function cleanList(values: string[]) {
  return values.map((item) => item.trim()).filter(Boolean);
}

function createLocalId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

function uniqueIngredientId(name: string, ingredients: Ingredient[]) {
  const base =
    name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 32) || "ingredient";
  let id = `ing-${base}`;
  let counter = 1;

  while (ingredients.some((ingredient) => ingredient.id === id)) {
    counter += 1;
    id = `ing-${base}-${counter}`;
  }

  return id;
}

function recipeStatusText(status: RecipeStatus) {
  if (status === "active") return "Actief";
  if (status === "draft") return "Concept";

  return "Oud recept";
}

function unitLabelText(unit: RecipeUnit) {
  if (unit === "gram") return "gram";
  if (unit === "kg") return "kg";
  if (unit === "ml") return "ml";
  if (unit === "liter") return "liter";

  return "stuk";
}

function salesPeriodText(period: SalesPeriod) {
  if (period === "month") return "per maand";
  if (period === "year") return "per jaar";

  return "per week";
}

function planningQuantityLabel(quantity: number, unit: RecipeUnit) {
  const label =
    unit === "stuk"
      ? "stuks"
      : unit === "gram"
        ? "g"
        : unit === "liter"
          ? "l"
          : unit;

  return `${quantity.toLocaleString("nl-NL", {
    maximumFractionDigits: quantity < 10 ? 1 : 0,
  })} ${label}`;
}

function createRecipeText(
  recipe: Recipe,
  ingredients: Ingredient[],
  recipes: Recipe[]
) {
  const batchWeight = formatBatchWeight(
    recipeMadeWeightKg(recipe.ingredients, recipe.semiFinishedItems)
  );
  const ingredientLines = recipe.ingredients.map((item) => {
    const ingredient = findIngredient(ingredients, item.ingredientId);

    return `- ${ingredient?.name || item.ingredientId}: ${quantityLabel(
      item.quantity,
      item.unit
    )}`;
  });
  const semiFinishedLines = recipe.semiFinishedItems.map((item) => {
    const linkedRecipe = findRecipe(recipes, item.semiFinishedRecipeId);

    return `- ${linkedRecipe?.name || item.semiFinishedRecipeId}: ${quantityLabel(
      item.quantity,
      item.unit
    )}`;
  });

  return [
    recipe.name,
    `Groep: ${recipe.productGroup}`,
    `Batch: ${recipe.batchSize}`,
    `Batchgewicht: ${batchWeight}`,
    `Portie: ${recipe.portionLabel}`,
    `Kostprijs: ${formatEuro(recipe.costPrice)}`,
    `Verkoopprijs: ${recipe.salesPrice ? formatEuro(recipe.salesPrice) : "-"}`,
    "",
    "Ingredienten",
    ingredientLines.length ? ingredientLines.join("\n") : "-",
    "",
    "Halffabricaten",
    semiFinishedLines.length ? semiFinishedLines.join("\n") : "-",
    "",
    "Bereiding",
    recipe.preparationSteps
      .map((step, index) => `${index + 1}. ${step}`)
      .join("\n"),
    "",
    "Afwerking",
    recipe.finishingSteps?.length ? recipe.finishingSteps.join("\n") : "-",
    "",
    "Notities",
    recipe.internalNotes || recipe.notes || "-",
  ].join("\n");
}

function createRecipePrintHtml(
  recipe: Recipe,
  ingredients: Ingredient[],
  recipes: Recipe[],
  quantity = recipe.standardBatchQuantity || getBatchInfo(recipe)?.quantity || 1,
  batchQuantity = recipe.standardBatchQuantity || getBatchInfo(recipe)?.quantity || 1
) {
  const multiplier = batchQuantity > 0 ? quantity / batchQuantity : 1;
  const ingredientRows = recipeCardIngredientRows(
    recipe,
    ingredients,
    recipes,
    multiplier
  )
    .map(
      (item) =>
        `<tr><td>${escapeHtml(item.name)}</td><td>${escapeHtml(
          formatInputNumber(item.quantity)
        )}</td><td>${escapeHtml(shortUnitLabel(item.unit))}</td><td>${escapeHtml(
          item.isSemiFinished ? "halffabricaat" : ""
        )}</td></tr>`
    )
    .join("");
  const steps = (recipe.preparationSteps.length
    ? recipe.preparationSteps
    : recipe.workInstructions || []
  )
    .map((step) => `<li>${escapeHtml(step)}</li>`)
    .join("");
  const unit = getBatchInfo(recipe)?.unit || recipe.standardBatchUnit || "stuk";

  return `<!doctype html>
<html lang="nl">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(recipe.name)} receptkaart</title>
  <style>
    body { font-family: Arial, sans-serif; color: #111; margin: 28px; }
    .card { border: 1px solid #111; padding: 24px; }
    .eyebrow { font-style: italic; margin: 0 0 24px; }
    .layout { display: grid; grid-template-columns: 14px 1fr; gap: 24px; }
    .stripe { background: #c3d3bc; }
    h1 { font-size: 36px; font-weight: 300; margin: 0; }
    .type { font-style: italic; margin: 4px 0 12px; }
    .qty { margin: 14px 0 18px; font-weight: 700; }
    .box { background: #efefef; padding: 18px 24px; margin-top: 18px; }
    h2 { font-size: 17px; margin: 0 0 12px; }
    table { width: 100%; border-collapse: collapse; }
    td { padding: 4px 0; font-size: 17px; font-weight: 700; }
    td:nth-child(2), td:nth-child(3), td:nth-child(4) { text-align: right; }
    ol { padding-left: 22px; margin: 0; }
    li { margin: 8px 0; font-size: 17px; font-weight: 700; }
    .meta { margin-top: 18px; text-align: right; font-style: italic; }
    .screen-actions { margin: 0 0 16px; }
    .screen-actions button { border: 1px solid #c3d3bc; background: white; padding: 10px 16px; font-weight: 700; }
    @media print { .screen-actions { display: none; } }
  </style>
</head>
<body>
  <div class="screen-actions">
    <button type="button" onclick="window.close()">Terug naar overzicht</button>
  </div>
  <div class="card">
    <p class="eyebrow">Recept kaart</p>
    <div class="layout">
      <div class="stripe"></div>
      <main>
        <h1>${escapeHtml(recipe.name)}</h1>
        <p class="type">${escapeHtml(recipe.productGroup || recipeTypeLabel(recipe.type))}</p>
        <p class="qty">${escapeHtml(formatInputNumber(quantity))} ${escapeHtml(unitLabelText(unit))}</p>
        <section class="box">
          <h2>Ingredienten</h2>
          <table><tbody>${ingredientRows || "<tr><td colspan=\"4\">Nog geen ingredienten.</td></tr>"}</tbody></table>
        </section>
        <section class="box">
          <h2>Stappen</h2>
          <ol>${steps || "<li>Nog geen stappen ingevuld.</li>"}</ol>
        </section>
        <p class="meta">laatst gewijzigd: <strong>${escapeHtml(formatDate(recipe.lastUpdated))}</strong></p>
      </main>
    </div>
  </div>
</body>
</html>`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function BakkerRecipeCard({
  recipe,
  ingredients,
  recipes,
  quantity,
  batchQuantity,
  isStarted,
  feedback,
  onQuantityChange,
  onQuantityStep,
  onScaleFromIngredient,
  onStart,
  onMarkMade,
  onPrint,
  onEdit,
  onClose,
}: Readonly<{
  recipe: Recipe;
  ingredients: Ingredient[];
  recipes: Recipe[];
  quantity: number;
  batchQuantity: number;
  isStarted: boolean;
  feedback: string;
  onQuantityChange: (value: string) => void;
  onQuantityStep: (delta: number) => void;
  onScaleFromIngredient: (rowId: string, desiredQuantity: number) => void;
  onStart: () => void;
  onMarkMade: () => void;
  onPrint: () => void;
  onEdit: () => void;
  onClose: () => void;
}>) {
  const baseQuantity = batchQuantity || getBatchInfo(recipe)?.quantity || 1;
  const multiplier = baseQuantity > 0 ? quantity / baseQuantity : 1;
  const rows = recipeCardIngredientRows(recipe, ingredients, recipes, multiplier);
  const baseRows = recipeCardIngredientRows(recipe, ingredients, recipes, 1);
  const scalableRows = recipe.type === "semiFinished" ? baseRows : [];
  const [scaleIngredientId, setScaleIngredientId] = useState(
    () => scalableRows[0]?.id || ""
  );
  const [scaleAmount, setScaleAmount] = useState("");
  const selectedScaleRow =
    scalableRows.find((row) => row.id === scaleIngredientId) || scalableRows[0];
  const steps = recipe.preparationSteps.length
    ? recipe.preparationSteps
    : recipe.workInstructions || [];
  const madeToday = productionLogForRecipe(recipe).some(
    (entry) => entry.date === todayIsoDate()
  );

  return (
    <div className="fixed inset-0 z-[70] overflow-y-auto bg-white/70 px-3 py-4 backdrop-blur-[1px]">
      <div className="mx-auto w-[min(61rem,calc(100vw-1rem))] border border-[#111111] bg-white px-4 py-4 shadow-2xl sm:px-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-8 items-center gap-1 border border-[#c3d3bc] bg-white px-2 text-xs font-black"
            >
              <img src="/UI-apps_terug.svg" alt="" className="h-5 w-5" />
              Terug
            </button>
            <p className="text-sm italic text-[#111111]">Recept kaart</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-4xl font-light leading-none text-[#111111]"
            aria-label="Sluit receptkaart"
          >
            ×
          </button>
        </div>

        <div className="grid gap-5 sm:grid-cols-[1rem_minmax(0,1fr)]">
          <div className="hidden bg-[#c3d3bc] sm:block" />
          <div
            className={`grid gap-4 ${
              recipe.type === "finalProduct"
                ? "lg:grid-cols-[minmax(0,1.35fr)_18rem]"
                : ""
            }`}
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="truncate text-[clamp(1.8rem,4vw,2.7rem)] font-light leading-none">
                    {recipe.name}
                  </h2>
                  <p className="mt-1 text-base italic text-[#555555]">
                    {recipe.productGroup || recipeTypeLabel(recipe.type)}
                  </p>
                </div>

                <div className="grid grid-cols-[4.25rem_3rem_3rem_3rem] border border-[#c3d3bc] text-center text-xs uppercase tracking-[0.12em]">
                  <button
                    type="button"
                    onClick={onStart}
                    className={`border-r border-[#c3d3bc] px-2 py-3 ${
                      isStarted ? "bg-[#c3d3bc]" : "bg-white"
                    }`}
                  >
                    Start
                  </button>
                  <button
                    type="button"
                    onClick={onMarkMade}
                    className={`border-r border-[#c3d3bc] px-2 py-2.5 text-2xl leading-none ${
                      madeToday ? "bg-[#c3d3bc]" : "bg-white"
                    }`}
                    aria-label="Gemaakt"
                  >
                    ✓
                  </button>
                  <button
                    type="button"
                    onClick={onPrint}
                    className="border-r border-[#c3d3bc] px-2 py-2.5 text-xs font-black tracking-normal"
                  >
                    Print
                  </button>
                  <button
                    type="button"
                    onClick={onEdit}
                    className="px-2 py-3 text-2xl leading-none"
                    aria-label="Aanpassen"
                  >
                    ✎
                  </button>
                </div>
              </div>

              <div className="mt-4 flex items-center gap-2 pl-1">
                <button
                  type="button"
                  onClick={() => onQuantityStep(-1)}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-2xl shadow"
                  aria-label="Hoeveelheid verlagen"
                >
                  -
                </button>
                <input
                  value={formatInputNumber(quantity)}
                  onChange={(event) => onQuantityChange(event.target.value)}
                  inputMode="decimal"
                  className="h-9 w-24 rounded-xl border border-[#e4d8cb] bg-white text-center text-sm font-black outline-none"
                  aria-label="Hoeveelheid"
                />
                <span className="text-sm font-black text-[#707070]">
                  {unitLabelText(getBatchInfo(recipe)?.unit || recipe.standardBatchUnit || "stuk")}
                </span>
                <button
                  type="button"
                  onClick={() => onQuantityStep(1)}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-2xl shadow"
                  aria-label="Hoeveelheid verhogen"
                >
                  +
                </button>
              </div>

              {recipe.type === "semiFinished" && scalableRows.length > 0 && (
                <div className="mt-3 grid gap-2 border border-[#c3d3bc] bg-white p-3 sm:grid-cols-[minmax(0,1.15fr)_9rem_auto] sm:items-end">
                  <label className="grid gap-1 text-xs font-black uppercase tracking-[0.12em] text-[#8c8c8c]">
                    Stuur op ingredient
                    <select
                      value={selectedScaleRow?.id || ""}
                      onChange={(event) => {
                        setScaleIngredientId(event.target.value);
                        const parsed = parseDutchNumber(scaleAmount);
                        if (parsed > 0) onScaleFromIngredient(event.target.value, parsed);
                      }}
                      className="min-w-0 border border-[#c3d3bc] bg-white px-2 py-2 text-sm font-black normal-case tracking-normal text-[#111111]"
                    >
                      {scalableRows.map((row) => (
                        <option key={row.id} value={row.id}>
                          {row.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-1 text-xs font-black uppercase tracking-[0.12em] text-[#8c8c8c]">
                    Hoeveelheid
                    <input
                      value={scaleAmount}
                      onChange={(event) => {
                        const value = event.target.value;
                        setScaleAmount(value);
                        onScaleFromIngredient(
                          selectedScaleRow?.id || "",
                          parseDutchNumber(value)
                        );
                      }}
                      inputMode="decimal"
                      placeholder={
                        selectedScaleRow
                          ? formatInputNumber(selectedScaleRow.quantity)
                          : "0"
                      }
                      className="min-w-0 border border-[#c3d3bc] bg-white px-2 py-2 text-sm font-black normal-case tracking-normal text-[#111111] outline-none"
                    />
                  </label>
                  <span className="pb-2 text-xs font-black text-[#707070]">
                    {selectedScaleRow ? shortUnitLabel(selectedScaleRow.unit) : ""}
                  </span>
                </div>
              )}

              <div className="mt-5 bg-[#efefef] p-4">
                <h3 className="text-base font-black">Ingredienten</h3>
                <div className="mt-3 grid gap-1">
                  {rows.length ? (
                    rows.map((row) => (
                      <div
                        key={row.id}
                        className="grid grid-cols-[minmax(0,1fr)_4.2rem_3rem_minmax(5.5rem,auto)] gap-3 text-sm sm:text-base"
                      >
                        <span className="truncate font-black">{row.name}</span>
                        <span className="text-right font-black">
                          {formatInputNumber(row.quantity)}
                        </span>
                        <span className="font-black">{shortUnitLabel(row.unit)}</span>
                        <span className="truncate text-right text-sm italic text-[#555555]">
                          {row.isSemiFinished ? "halffabricaat ↪" : ""}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm font-bold text-[#707070]">
                      Nog geen ingredienten.
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-4 bg-[#efefef] p-4">
                <h3 className="text-base font-black">Stappen</h3>
                <ol className="mt-3 grid gap-2 text-sm font-black sm:text-base">
                  {steps.length ? (
                    steps.map((step, index) => (
                      <li key={`${step}-${index}`}>
                        {index + 1}. {step}
                      </li>
                    ))
                  ) : (
                    <li>Nog geen stappen ingevuld.</li>
                  )}
                </ol>
              </div>
              {recipe.type === "semiFinished" && feedback && (
                <p className="mt-3 text-xs font-black text-[#45663b]">
                  {feedback}
                </p>
              )}
            </div>

            {recipe.type === "finalProduct" && (
            <aside className="grid content-start gap-3 text-right text-sm italic">
              {recipe.photoPreviewDataUrl ? (
                <img
                  src={recipe.photoPreviewDataUrl}
                  alt={recipe.photoHint || recipe.name}
                  className="aspect-square w-full object-cover"
                />
              ) : (
                <div className="flex aspect-square w-full items-center justify-center bg-[#efefef] text-3xl font-black not-italic text-[#8c8c8c]">
                  R
                </div>
              )}
              <p>
                categorie: <strong>{recipe.productGroup || recipeTypeLabel(recipe.type)}</strong>
              </p>
              <p>
                laatst gewijzigd: <strong>{formatDate(recipe.lastUpdated)}</strong>
              </p>
              {recipe.lastProducedQuantity ? (
                <p>
                  laatste gemaakt:{" "}
                  <strong>
                    {quantityLabel(
                      recipe.lastProducedQuantity,
                      getBatchInfo(recipe)?.unit || recipe.standardBatchUnit || "stuk"
                    )}
                  </strong>
                </p>
              ) : null}
              {recipe.averageSalesQuantity ? (
                <p>
                  gemiddeld per periode:{" "}
                  <strong>
                    {formatInputNumber(recipe.averageSalesQuantity)}/
                    {salesPeriodText(recipe.averageSalesPeriod || "week")}
                  </strong>
                </p>
              ) : null}
              {feedback && (
                <p className="mt-2 text-left text-xs font-black not-italic text-[#45663b]">
                  {feedback}
                </p>
              )}
            </aside>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ProductionShortcutDialog({
  recipe,
  quantity,
  onCancel,
  onConfirm,
}: Readonly<{
  recipe: Recipe;
  quantity: number;
  onCancel: () => void;
  onConfirm: (date: string) => void;
}>) {
  const [date, setDate] = useState(todayIsoDate());
  const unit = getBatchInfo(recipe)?.unit || recipe.standardBatchUnit || "stuk";

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-[#111111]/35 px-4">
      <div className="grid w-full max-w-sm gap-3 border border-[#111111] bg-white p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm italic">Productie afronden</p>
            <h3 className="mt-1 text-2xl font-light leading-tight">
              {recipe.name}
            </h3>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="text-3xl font-light leading-none"
            aria-label="Sluit"
          >
            ×
          </button>
        </div>
        <label className="grid gap-1 text-xs font-black uppercase tracking-[0.12em] text-[#8c8c8c]">
          Datum
          <input
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            className="border border-[#c3d3bc] bg-white px-3 py-2 text-sm font-black normal-case tracking-normal text-[#111111]"
          />
        </label>
        <div className="border border-[#c3d3bc] bg-[#f5f5f3] p-3">
          <p className="text-xs font-black uppercase tracking-[0.12em] text-[#8c8c8c]">
            Hoeveelheid
          </p>
          <p className="mt-1 text-lg font-black">
            {formatInputNumber(quantity)} {unitLabelText(unit)}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="border border-[#c3d3bc] bg-white px-4 py-3 text-sm font-black text-[#707070]"
          >
            Terug
          </button>
          <button
            type="button"
            onClick={() => onConfirm(date)}
            className="border border-[#c3d3bc] bg-[#c3d3bc] px-4 py-3 text-sm font-black"
          >
            Opslaan
          </button>
        </div>
      </div>
    </div>
  );
}

type RecipeCardIngredientRow = {
  id: string;
  name: string;
  quantity: number;
  unit: RecipeUnit;
  isSemiFinished: boolean;
};

function recipeCardIngredientRows(
  recipe: Recipe,
  ingredients: Ingredient[],
  recipes: Recipe[],
  multiplier: number
): RecipeCardIngredientRow[] {
  const directRows = recipe.ingredients.map((item) => {
    const ingredient = findIngredient(ingredients, item.ingredientId);
    const linkedSemiFinished = ingredient
      ? semiFinishedRecipeForIngredient(ingredient, recipes)
      : null;

    return {
      id: `ingredient-${item.ingredientId}`,
      name: ingredient?.name || item.ingredientId,
      quantity: Math.round(item.quantity * multiplier * 10000) / 10000,
      unit: item.unit,
      isSemiFinished: Boolean(linkedSemiFinished),
    };
  });
  const semiRows = recipe.semiFinishedItems.map((item) => {
    const linkedRecipe = findRecipe(recipes, item.semiFinishedRecipeId);

    return {
      id: `semi-${item.semiFinishedRecipeId}`,
      name: linkedRecipe?.name || item.semiFinishedRecipeId,
      quantity: Math.round(item.quantity * multiplier * 10000) / 10000,
      unit: item.unit,
      isSemiFinished: true,
    };
  });

  return [...directRows, ...semiRows];
}

function semiFinishedRecipeForIngredient(ingredient: Ingredient, recipes: Recipe[]) {
  const possibleNames = [ingredient.name, ...ingredient.aliases]
    .map(normalizeHfRecipeName)
    .filter(Boolean);

  return recipes.find((recipe) => {
    if (recipe.type !== "semiFinished") return false;
    const recipeName = normalizeHfRecipeName(recipe.name);

    return possibleNames.some(
      (name) =>
        recipeName === name ||
        recipeName.includes(name) ||
        name.includes(recipeName)
    );
  });
}

function normalizeHfRecipeName(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/^hf\s+/, "")
    .replace(/^halffabricaat\s+/, "")
    .trim();
}

function shortUnitLabel(unit: RecipeUnit) {
  if (unit === "gram") return "gr";
  if (unit === "liter") return "l";

  return unit;
}

function EditorBlock({
  title,
  children,
}: Readonly<{ title: string; children: React.ReactNode }>) {
  return (
    <div className="rounded-2xl border border-[#dfe9d8] bg-white/72 p-3">
      <p className="mb-2 text-sm font-black">{title}</p>
      {children}
    </div>
  );
}

function ArrayEditor({
  title,
  values,
  onChange,
  placeholder,
}: Readonly<{
  title: string;
  values: string[];
  onChange: (values: string[]) => void;
  placeholder: string;
}>) {
  const lines = values.length ? values : [""];

  return (
    <EditorBlock title={title}>
      <div className="grid gap-2">
        {lines.map((value, index) => (
          <div key={`${title}-${index}`} className="flex gap-2">
            <textarea
              value={value}
              onChange={(event) => {
                const next = [...lines];
                next[index] = event.target.value;
                onChange(next);
              }}
              placeholder={placeholder}
              className="min-h-20 flex-1 rounded-2xl border border-[#cfdcc8] bg-white px-3 py-3 text-sm font-bold text-[#2d2a26] placeholder:text-[#2d2a26]/35 focus:outline-none focus:ring-2 focus:ring-[#8fb184]"
            />
            <button
              type="button"
              onClick={() => onChange(lines.filter((_, itemIndex) => itemIndex !== index))}
              className="h-fit rounded-full bg-[#fff4f1] px-3 py-2 text-xs font-black text-[#a83e31]"
            >
              Weg
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => onChange([...lines, ""])}
          className="w-fit rounded-full bg-[#c3d3bc] px-4 py-2 text-sm font-black shadow-sm"
        >
          Regel toevoegen
        </button>
      </div>
    </EditorBlock>
  );
}

function EditTextField({
  label,
  value,
  onChange,
  inputMode,
}: Readonly<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  inputMode?: "decimal";
}>) {
  return (
    <label className="grid gap-1 text-xs font-black uppercase tracking-[0.12em] text-[#2d2a26]/45">
      {label}
      <input
        value={value}
        inputMode={inputMode}
        onChange={(event) => onChange(event.target.value)}
        className="min-w-0 rounded-2xl border border-[#cfdcc8] bg-white px-3 py-2.5 text-sm font-bold normal-case tracking-normal text-[#2d2a26] focus:outline-none focus:ring-2 focus:ring-[#8fb184]"
      />
    </label>
  );
}

function DateField({
  label,
  value,
  onChange,
}: Readonly<{
  label: string;
  value: string;
  onChange: (value: string) => void;
}>) {
  return (
    <label className="grid gap-1 text-xs font-black uppercase tracking-[0.12em] text-[#2d2a26]/45">
      {label}
      <input
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-w-0 rounded-2xl border border-[#cfdcc8] bg-white px-3 py-2.5 text-sm font-bold normal-case tracking-normal text-[#2d2a26] focus:outline-none focus:ring-2 focus:ring-[#8fb184]"
      />
    </label>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
}: Readonly<{
  label: string;
  value: string;
  onChange: (value: string) => void;
}>) {
  return (
    <label className="grid gap-1 text-xs font-black uppercase tracking-[0.12em] text-[#2d2a26]/45">
      {label}
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-24 rounded-2xl border border-[#cfdcc8] bg-white px-3 py-2.5 text-sm font-bold normal-case tracking-normal text-[#2d2a26] focus:outline-none focus:ring-2 focus:ring-[#8fb184]"
      />
    </label>
  );
}

function SelectField({
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
    <label className="grid gap-1 text-xs font-black uppercase tracking-[0.12em] text-[#2d2a26]/45">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-w-0 rounded-2xl border border-[#cfdcc8] bg-white px-3 py-2.5 text-sm font-bold normal-case tracking-normal text-[#2d2a26] focus:outline-none focus:ring-2 focus:ring-[#8fb184]"
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

function IngredientSearchField({
  ingredients,
  value,
  onChange,
}: Readonly<{
  ingredients: Ingredient[];
  value: string;
  onChange: (value: string) => void;
}>) {
  const selectedIngredient = findIngredient(ingredients, value);
  const [query, setQuery] = useState(selectedIngredient?.name || value || "");
  const [isOpen, setIsOpen] = useState(false);

  const normalizedQuery = normalizeIngredientQuery(query);
  const suggestions = ingredients
    .map((ingredient) => ({
      ingredient,
      score: ingredientSearchScore(ingredient, normalizedQuery),
    }))
    .filter(({ score }) => !normalizedQuery || score > 0)
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;

      return left.ingredient.name.localeCompare(right.ingredient.name, "nl-NL");
    })
    .map(({ ingredient }) => ingredient);

  return (
    <label className="relative grid gap-1 text-xs font-black uppercase tracking-[0.12em] text-[#2d2a26]/45">
      Grondstof
      <input
        value={query}
        onBlur={() => window.setTimeout(() => setIsOpen(false), 140)}
        onChange={(event) => {
          setQuery(event.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        placeholder="Typ bijvoorbeeld slagroom"
        className="min-w-0 rounded-2xl border border-[#cfdcc8] bg-white px-3 py-2.5 text-sm font-bold normal-case tracking-normal text-[#2d2a26] placeholder:text-[#2d2a26]/35 focus:outline-none focus:ring-2 focus:ring-[#8fb184]"
      />
      {isOpen && (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-2xl border border-[#dfe9d8] bg-white p-1.5 text-left normal-case tracking-normal shadow-xl">
          {suggestions.length ? (
            suggestions.map((ingredient) => (
              <button
                key={ingredient.id}
                type="button"
                onMouseDown={(event) => {
                  event.preventDefault();
                  onChange(ingredient.id);
                  setQuery(ingredient.name);
                  setIsOpen(false);
                }}
                className={`grid w-full gap-0.5 rounded-xl px-3 py-2 text-left text-sm hover:bg-[#f8f6f3] ${
                  ingredient.id === value ? "bg-[#dce8d6]" : ""
                }`}
              >
                <span className="font-black text-[#2d2a26]">
                  {ingredient.name}
                </span>
                <span className="truncate text-xs font-bold text-[#2d2a26]/45">
                  {ingredient.supplier} - {ingredient.packageSize}
                </span>
              </button>
            ))
          ) : (
            <p className="px-3 py-2 text-sm font-bold text-[#2d2a26]/45">
              Geen grondstof gevonden. Typ bijvoorbeeld alleen een deel van de
              naam.
            </p>
          )}
        </div>
      )}
    </label>
  );
}

function PackagingSearchField({
  packagingItems,
  value,
  onChange,
}: Readonly<{
  packagingItems: PackagingItem[];
  value: string;
  onChange: (value: string) => void;
}>) {
  const selectedPackaging = packagingItems.find((item) => item.id === value);
  const [query, setQuery] = useState(selectedPackaging?.name || value || "");
  const [isOpen, setIsOpen] = useState(false);
  const normalizedQuery = normalizeIngredientQuery(query);
  const suggestions = packagingItems
    .map((item) => ({
      item,
      score: packagingSearchScore(item, normalizedQuery),
    }))
    .filter(({ score }) => !normalizedQuery || score > 0)
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;

      return left.item.name.localeCompare(right.item.name, "nl-NL");
    })
    .map(({ item }) => item);

  return (
    <label className="relative grid gap-1 text-xs font-black uppercase tracking-[0.12em] text-[#2d2a26]/45">
      Verpakking
      <input
        value={query}
        onBlur={() => window.setTimeout(() => setIsOpen(false), 140)}
        onChange={(event) => {
          setQuery(event.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        placeholder="Typ doos, deksel of bodem"
        className="min-w-0 rounded-2xl border border-[#cfdcc8] bg-white px-3 py-2.5 text-sm font-bold normal-case tracking-normal text-[#2d2a26] placeholder:text-[#2d2a26]/35 focus:outline-none focus:ring-2 focus:ring-[#8fb184]"
      />
      {isOpen && (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-2xl border border-[#dfe9d8] bg-white p-1.5 text-left normal-case tracking-normal shadow-xl">
          {suggestions.length ? (
            suggestions.map((item) => (
              <button
                key={item.id}
                type="button"
                onMouseDown={(event) => {
                  event.preventDefault();
                  onChange(item.id);
                  setQuery(item.name);
                  setIsOpen(false);
                }}
                className={`grid w-full gap-0.5 rounded-xl px-3 py-2 text-left text-sm hover:bg-[#f8f6f3] ${
                  item.id === value ? "bg-[#dce8d6]" : ""
                }`}
              >
                <span className="font-black text-[#2d2a26]">{item.name}</span>
                <span className="truncate text-xs font-bold text-[#2d2a26]/45">
                  {item.supplier} - {item.packageSize} - {formatEuro(item.unitPrice)}
                </span>
              </button>
            ))
          ) : (
            <p className="px-3 py-2 text-sm font-bold text-[#2d2a26]/45">
              Geen verpakking gevonden.
            </p>
          )}
        </div>
      )}
    </label>
  );
}

function Metric({
  label,
  value,
  className = "bg-[#f8f6f3]",
}: Readonly<{ label: string; value: string; className?: string }>) {
  return (
    <div className={`rounded-2xl p-3 ${className}`}>
      <p className="text-[0.65rem] font-black uppercase tracking-[0.12em] opacity-60">
        {label}
      </p>
      <p className="mt-1 text-sm font-black">{value}</p>
    </div>
  );
}

function normalizeIngredientQuery(value: string) {
  return value
    .toLocaleLowerCase("nl-NL")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function ingredientQueryWords(value: string) {
  return normalizeIngredientQuery(value).split(/\s+/).filter(Boolean);
}

function ingredientSearchScore(ingredient: Ingredient, normalizedQuery: string) {
  if (!normalizedQuery) return 1;

  const queryWords = ingredientQueryWords(normalizedQuery);
  if (!queryWords.length) return 1;

  const haystack = [
    ingredient.name,
    ingredient.supplier,
    ingredient.supplierArticleNumber,
    ingredient.packageSize,
    ...ingredient.aliases,
  ]
    .map(normalizeIngredientQuery)
    .join(" ");
  const compactHaystack = haystack.replace(/\s+/g, "");
  const compactQuery = normalizedQuery.replace(/\s+/g, "");

  if (haystack === normalizedQuery) return 120;
  if (haystack.split(/\s+/).includes(normalizedQuery)) return 95;
  if (queryWords.every((word) => haystack.includes(word))) return 80;
  if (compactQuery.length >= 4 && compactHaystack.includes(compactQuery)) {
    return 62;
  }

  return 0;
}

function packagingSearchScore(item: PackagingItem, normalizedQuery: string) {
  if (!normalizedQuery) return 1;

  const queryWords = ingredientQueryWords(normalizedQuery);
  if (!queryWords.length) return 1;

  const haystack = [
    item.name,
    item.supplier,
    item.articleNumber,
    item.packageSize,
  ]
    .map(normalizeIngredientQuery)
    .join(" ");
  const compactHaystack = haystack.replace(/\s+/g, "");
  const compactQuery = normalizedQuery.replace(/\s+/g, "");

  if (haystack === normalizedQuery) return 120;
  if (haystack.split(/\s+/).includes(normalizedQuery)) return 95;
  if (queryWords.every((word) => haystack.includes(word))) return 80;
  if (compactQuery.length >= 4 && compactHaystack.includes(compactQuery)) {
    return 62;
  }

  return 0;
}

function LineItem({
  title,
  meta,
  value,
}: Readonly<{ title: string; meta: string; value: string }>) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-[#e7e0d8] bg-[#fffdf8] p-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-black">{title}</p>
        <p className="text-xs font-bold text-[#2d2a26]/45">{meta}</p>
      </div>
      <p className="shrink-0 text-sm font-black">{value}</p>
    </div>
  );
}

function TrashIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2.2"
      viewBox="0 0 24 24"
    >
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v5" />
      <path d="M14 11v5" />
    </svg>
  );
}
