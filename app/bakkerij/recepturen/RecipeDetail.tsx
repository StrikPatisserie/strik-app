import { useState } from "react";
import type {
  Ingredient,
  PackagingItem,
  ProductionLogEntry,
  ProductionRequest,
  Recipe,
  RecipeImportCandidate,
  RecipeImportCandidateKind,
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
  calculateMargin,
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
  RECIPE_SALES_VAT_RATE,
  salesPeriodLabel,
  normalizeRecipePackagingLines,
  selectedRecipePackagingUnitCost,
  syncRecipeProductionMetadata,
  targetSalesPrice,
} from "./utils";
import {
  recipeGroupOptionsForRecipes,
} from "./workCategories";
import { WorkRecipeDetail } from "./RecepturenWorkMode";

const recipeUnits: RecipeUnit[] = ["gram", "kg", "ml", "liter", "stuk"];
const recipeStatuses: RecipeStatus[] = ["active", "draft", "old"];
const salesPeriods: SalesPeriod[] = ["week", "month", "year"];
type RecipePrintVariant = "work" | "calculation";
const RECIPE_PHOTO_MAX_SOURCE_BYTES = 12 * 1024 * 1024;
const RECIPE_PHOTO_MAX_SIDE = 360;
const RECIPE_PHOTO_MIN_SIDE = 180;
const RECIPE_PHOTO_MAX_DATA_URL_LENGTH = 45000;
const RECIPE_PHOTO_QUALITIES = [0.3, 0.22, 0.16, 0.1];
const RECIPE_IMPORT_TIMEOUT_MS = 30000;
const EMPTY_PREPARATION_STEP_TEXT = "Vul hier de eerste productiestap in.";
const RECIPE_IMPORT_FILE_ACCEPT =
  ".xlsx,.xls,.csv,.txt,.tsv,.pdf,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv,text/tab-separated-values,text/plain";
const recipeEditSections: Array<{
  id: RecipeEditSection;
  label: string;
  hint: string;
}> = [
  { id: "basis", label: "Verpakking", hint: "Verpakking en foto" },
  { id: "productie", label: "Productie", hint: "Logboek en planning" },
  { id: "stappen", label: "Stappen", hint: "Bereiding" },
  { id: "notities", label: "Notities", hint: "Allergenen" },
];

type RecipeEditSection =
  | "basis"
  | "productie"
  | "stappen"
  | "notities";

type RecipeImportResponse = {
  recipes?: Recipe[];
  ingredients?: Ingredient[];
  unresolvedItems?: RecipeImportCandidate[];
  warnings?: string[];
  message?: string;
};

type ImportCandidateChoice = {
  kind: RecipeImportCandidateKind;
  targetId: string;
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
  onMarkProduced,
  onOpenRecipe,
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
  onSaveIngredients?: (ingredients: Ingredient[], message?: string) => void;
  onMarkProduced: (
    recipe: Recipe,
    quantity: number,
    requestId?: string,
    date?: string
  ) => void;
  onOpenRecipe?: (recipe: Recipe) => void;
}>) {
  const [isEditing, setIsEditing] = useState(startInEditMode);
  const [activeEditSection, setActiveEditSection] =
    useState<RecipeEditSection>("basis");
  const [feedback, setFeedback] = useState("");
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [isImportingRecipe, setIsImportingRecipe] = useState(false);
  const [recipeImportWarnings, setRecipeImportWarnings] = useState<string[]>([]);
  const [recipeImportCandidates, setRecipeImportCandidates] = useState<
    RecipeImportCandidate[]
  >([]);
  const [importCandidateChoices, setImportCandidateChoices] = useState<
    Record<string, ImportCandidateChoice>
  >({});
  const [draft, setDraft] = useState(() => createRecipeDraft(recipe));
  const [cardQuantity, setCardQuantity] = useState(
    () => recipe.standardBatchQuantity || getBatchInfo(recipe)?.quantity || 1
  );
  const [isRecipeStarted, setIsRecipeStarted] = useState(false);
  const [productionStart, setProductionStart] = useState<{
    quantity: number;
    token: number;
  } | null>(null);
  const [isProductionShortcutOpen, setIsProductionShortcutOpen] =
    useState(false);
  const [isPrintChoiceOpen, setIsPrintChoiceOpen] = useState(false);
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
  const [draggedIngredientLineId, setDraggedIngredientLineId] = useState("");
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
  const visiblePreparationSteps = cleanRecipeSteps(previewRecipe.preparationSteps);
  const productionHistory = productionLogForRecipe(previewRecipe)
    .filter((entry) => entry.source !== "stock")
    .slice(0, 6);
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
    setRecipeImportCandidates([]);
    setImportCandidateChoices({});

    try {
      const formData = new FormData();
      formData.set("file", file);
      formData.set("kind", "recipes");
      formData.set("ingredients", JSON.stringify(availableIngredients));
      formData.set("recipes", JSON.stringify(recipes));
      const controller = new AbortController();
      const timeout = window.setTimeout(
        () => controller.abort(),
        RECIPE_IMPORT_TIMEOUT_MS
      );

      const response = await fetch("/api/recepturen/data-import", {
        method: "POST",
        body: formData,
        signal: controller.signal,
      }).finally(() => window.clearTimeout(timeout));
      const data = (await readImportResponse(response)) as RecipeImportResponse;

      if (!response.ok) {
        throw new Error(data.message || "Bestand kon niet gelezen worden.");
      }

      const importedRecipe = data.recipes?.[0];
      if (!importedRecipe) {
        throw new Error("Geen recept herkend in dit bestand.");
      }

      const unresolvedItems = data.unresolvedItems || [];
      setDraft((current) => recipeDraftFromImportedRecipe(current, importedRecipe));
      setActiveEditSection("basis");
      setRecipeImportWarnings(data.warnings || []);
      setRecipeImportCandidates(unresolvedItems);
      setImportCandidateChoices(
        Object.fromEntries(
          unresolvedItems.map((item) => [
            item.id,
            { kind: item.suggestedKind, targetId: "" },
          ])
        )
      );
      showFeedback(data.message || "Receptbestand ingelezen.");
    } catch (error) {
      showFeedback(
        error instanceof DOMException && error.name === "AbortError"
          ? "Bestand lezen duurt te lang. Probeer een kleiner PDF- of Excelbestand."
          : error instanceof Error
            ? error.message
            : "Bestand kon niet gelezen worden."
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

  function moveIngredientLine(lineId: string, direction: -1 | 1) {
    setDraft((current) => {
      const fromIndex = current.ingredients.findIndex((line) => line.id === lineId);
      const toIndex = fromIndex + direction;

      if (
        fromIndex < 0 ||
        toIndex < 0 ||
        toIndex >= current.ingredients.length
      ) {
        return current;
      }

      const ingredients = [...current.ingredients];
      const [movedLine] = ingredients.splice(fromIndex, 1);
      ingredients.splice(toIndex, 0, movedLine);

      return { ...current, ingredients };
    });
  }

  function moveIngredientLineTo(lineId: string, targetLineId: string) {
    if (!lineId || lineId === targetLineId) return;

    setDraft((current) => {
      const fromIndex = current.ingredients.findIndex((line) => line.id === lineId);
      const toIndex = current.ingredients.findIndex(
        (line) => line.id === targetLineId
      );

      if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) {
        return current;
      }

      const ingredients = [...current.ingredients];
      const [movedLine] = ingredients.splice(fromIndex, 1);
      ingredients.splice(toIndex, 0, movedLine);

      return { ...current, ingredients };
    });
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

  function moveSemiFinishedLine(lineId: string, direction: -1 | 1) {
    setDraft((current) => {
      const fromIndex = current.semiFinishedItems.findIndex(
        (line) => line.id === lineId
      );
      const toIndex = fromIndex + direction;

      if (
        fromIndex < 0 ||
        toIndex < 0 ||
        toIndex >= current.semiFinishedItems.length
      ) {
        return current;
      }

      const semiFinishedItems = [...current.semiFinishedItems];
      const [movedLine] = semiFinishedItems.splice(fromIndex, 1);
      semiFinishedItems.splice(toIndex, 0, movedLine);

      return { ...current, semiFinishedItems };
    });
  }

  function updateImportCandidateChoice(
    candidateId: string,
    changes: Partial<ImportCandidateChoice>
  ) {
    setImportCandidateChoices((current) => {
      const previous = current[candidateId] || {
        kind: "ingredient" as const,
        targetId: "",
      };
      const kind = changes.kind || previous.kind;

      return {
        ...current,
        [candidateId]: {
          kind,
          targetId:
            changes.kind && changes.kind !== previous.kind
              ? ""
              : changes.targetId ?? previous.targetId,
        },
      };
    });
  }

  function removeImportCandidate(candidateId: string) {
    setRecipeImportCandidates((current) =>
      current.filter((candidate) => candidate.id !== candidateId)
    );
    setImportCandidateChoices((current) => {
      const next = { ...current };
      delete next[candidateId];
      return next;
    });
  }

  function addIngredientFromImportCandidate(
    candidate: RecipeImportCandidate,
    ingredientId: string
  ) {
    const ingredient = findIngredient(availableIngredients, ingredientId);

    setDraft((current) => ({
      ...current,
      ingredients: [
        ...current.ingredients,
        {
          id: createLocalId("ingredient-line"),
          ingredientId,
          quantity: formatInputNumber(candidate.quantity),
          unit: candidate.unit || ingredient?.recipeUnit || "gram",
          costContribution: 0,
        },
      ],
    }));
    removeImportCandidate(candidate.id);
  }

  function addSemiFinishedFromImportCandidate(
    candidate: RecipeImportCandidate,
    recipeId: string
  ) {
    setDraft((current) => ({
      ...current,
      semiFinishedItems: [
        ...current.semiFinishedItems,
        {
          id: createLocalId("semi-line"),
          semiFinishedRecipeId: recipeId,
          quantity: formatInputNumber(candidate.quantity),
          unit: candidate.unit,
          costContribution: 0,
        },
      ],
    }));
    removeImportCandidate(candidate.id);
  }

  function createIngredientFromImportCandidate(
    candidate: RecipeImportCandidate
  ) {
    const recipeUnit = baseRecipeUnitForImport(candidate.unit);
    const packagePrice = averagePackagePriceForUnit(ingredients, recipeUnit);
    const normalizedPrice = normalizePackagePrice(packagePrice, recipeUnit);
    const ingredient: Ingredient = {
      id: uniqueIngredientId(candidate.name, ingredients),
      name: candidate.name,
      supplier: "Receptimport",
      supplierArticleNumber: "-",
      packageSize:
        recipeUnit === "stuk" ? "1 stuk" : recipeUnit === "ml" ? "1 liter" : "1 kg",
      recipeUnit,
      lastPrice: normalizedPrice,
      previousPrice: normalizedPrice,
      pricePerBaseUnit: pricePerBaseUnitFromPackagePrice(
        normalizedPrice,
        recipeUnit
      ),
      allergens: [],
      lastUpdated: todayIsoDate(),
      status: "active",
      lastInvoice: "Gemiddelde prijs - later controleren",
      aliases: [candidate.name],
    };

    onSaveIngredient(ingredient);
    addIngredientFromImportCandidate(candidate, ingredient.id);
    showFeedback("Nieuwe grondstof aangemaakt met gemiddelde prijs.");
  }

  function createSemiFinishedFromImportCandidate(
    candidate: RecipeImportCandidate
  ) {
    const semiFinishedRecipe = createBlankSemiFinishedRecipe(
      candidate.name,
      recipes,
      baseRecipeUnitForImport(candidate.unit)
    );

    onSaveRecipe(semiFinishedRecipe);
    addSemiFinishedFromImportCandidate(candidate, semiFinishedRecipe.id);
    showFeedback("Halffabricaat als concept aangemaakt.");
  }

  function resolveImportCandidate(candidate: RecipeImportCandidate) {
    const choice = importCandidateChoices[candidate.id] || {
      kind: candidate.suggestedKind,
      targetId: "",
    };

    if (!choice.targetId) {
      showFeedback("Kies eerst een bestaande kaart.");
      return;
    }

    if (choice.kind === "semiFinished") {
      addSemiFinishedFromImportCandidate(candidate, choice.targetId);
      showFeedback("Halffabricaat gekoppeld.");
      return;
    }

    addIngredientFromImportCandidate(candidate, choice.targetId);
    showFeedback("Grondstof gekoppeld.");
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

  function createQuickIngredient(nameValue: string, lineId?: string) {
    const name = nameValue.trim();
    if (!name) {
      showFeedback("Typ eerst de grondstofnaam.");
      return;
    }

    const recipeUnit: RecipeUnit = "gram";
    const packagePrice = averagePackagePriceForUnit(ingredients, recipeUnit);
    const normalizedPrice = normalizePackagePrice(packagePrice, recipeUnit);
    const ingredient: Ingredient = {
      id: uniqueIngredientId(name, ingredients),
      name,
      supplier: "Snel toegevoegd",
      supplierArticleNumber: "-",
      packageSize: "1 kg",
      recipeUnit,
      lastPrice: normalizedPrice,
      previousPrice: normalizedPrice,
      pricePerBaseUnit: pricePerBaseUnitFromPackagePrice(
        normalizedPrice,
        recipeUnit
      ),
      allergens: [],
      lastUpdated: todayIsoDate(),
      status: "active",
      lastInvoice: "Gemiddelde prijs - later controleren",
      aliases: [name],
    };

    onSaveIngredient(ingredient);
    setDraft((current) => ({
      ...current,
      ingredients: lineId
        ? current.ingredients.map((line) =>
            line.id === lineId
              ? {
                  ...line,
                  ingredientId: ingredient.id,
                  unit: ingredient.recipeUnit,
                }
              : line
          )
        : [
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
    showFeedback("Grondstof aangemaakt met gemiddelde prijs.");
  }

  function createQuickSemiFinished(nameValue: string, lineId?: string) {
    const name = nameValue.trim();
    if (!name) {
      showFeedback("Typ eerst de naam van het halffabricaat.");
      return;
    }

    const semiFinishedRecipe = createBlankSemiFinishedRecipe(name, recipes);

    onSaveRecipe(semiFinishedRecipe);
    setDraft((current) => ({
      ...current,
      semiFinishedItems: lineId
        ? current.semiFinishedItems.map((line) =>
            line.id === lineId
              ? {
                  ...line,
                  semiFinishedRecipeId: semiFinishedRecipe.id,
                  unit: semiFinishedRecipe.standardBatchUnit || line.unit,
                }
              : line
          )
        : [
            ...current.semiFinishedItems,
            {
              id: createLocalId("semi-line"),
              semiFinishedRecipeId: semiFinishedRecipe.id,
              quantity: "0",
              unit: semiFinishedRecipe.standardBatchUnit || "gram",
              costContribution: 0,
            },
          ],
    }));
    showFeedback("Halffabricaat als concept aangemaakt.");
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

  function printProductionCard(variant: RecipePrintVariant) {
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
        previewBatchQuantity,
        variant
      )
    );
    printWindow.document.close();
    printWindow.focus();
    window.setTimeout(() => printWindow.print(), 150);
    showFeedback(
      variant === "calculation"
        ? "Calculatie printvenster geopend."
        : "Werkkaart printvenster geopend."
    );
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
    const quantity = cardQuantity || previewBatchQuantity || 1;

    setIsRecipeStarted(true);
    setProductionStart({ quantity, token: Date.now() });
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

  const importCandidateReview = recipeImportCandidates.length ? (
    <div className="rounded-2xl border border-[#ead7a6] bg-[#fff8e3] p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.12em] text-[#7a5a18]">
            Nog kiezen uit import
          </p>
          <p className="mt-1 text-sm font-black">
            {recipeImportCandidates.length} regel
            {recipeImportCandidates.length === 1 ? "" : "s"} vragen om jouw keuze
          </p>
        </div>
        <p className="max-w-md text-xs font-bold leading-snug text-[#2d2a26]/55">
          Onbekend wordt niet meer automatisch grondstof. Kies bestaand, maak
          een nieuwe grondstof of maak een halffabricaat-concept.
        </p>
      </div>
      <div className="mt-3 grid gap-2">
        {recipeImportCandidates.map((candidate) => {
          const choice = importCandidateChoices[candidate.id] || {
            kind: candidate.suggestedKind,
            targetId: "",
          };

          return (
            <div
              key={candidate.id}
              className="grid gap-2 rounded-xl border border-[#ead7a6] bg-white p-2 lg:grid-cols-[minmax(13rem,1fr)_7rem_minmax(13rem,1.2fr)_auto_auto_auto_auto] lg:items-end"
            >
              <div>
                <p className="text-sm font-black">{candidate.name}</p>
                <p className="mt-1 text-xs font-bold text-[#2d2a26]/50">
                  {formatInputNumber(candidate.quantity)}{" "}
                  {unitLabelText(candidate.unit)}
                  {candidate.recipeName ? ` · ${candidate.recipeName}` : ""}
                </p>
              </div>
              <SelectField
                label="Soort"
                value={choice.kind}
                onChange={(value) =>
                  updateImportCandidateChoice(candidate.id, {
                    kind: value as RecipeImportCandidateKind,
                  })
                }
                options={[
                  { value: "ingredient", label: "Grondstof" },
                  { value: "semiFinished", label: "Halffabricaat" },
                ]}
              />
              {choice.kind === "semiFinished" ? (
                <SelectField
                  label="Bestaand"
                  value={choice.targetId}
                  onChange={(value) =>
                    updateImportCandidateChoice(candidate.id, {
                      targetId: value,
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
              ) : (
                <IngredientSearchField
                  ingredients={availableIngredients}
                  value={choice.targetId}
                  onChange={(value) =>
                    updateImportCandidateChoice(candidate.id, {
                      targetId: value,
                    })
                  }
                />
              )}
              <button
                type="button"
                onClick={() => resolveImportCandidate(candidate)}
                className="rounded-full bg-[#c3d3bc] px-3 py-2 text-xs font-black shadow-sm"
              >
                Koppel
              </button>
              <button
                type="button"
                onClick={() => createIngredientFromImportCandidate(candidate)}
                className="rounded-full bg-white px-3 py-2 text-xs font-black text-[#45663b] shadow-sm"
              >
                Nieuwe grondstof
              </button>
              <button
                type="button"
                onClick={() => createSemiFinishedFromImportCandidate(candidate)}
                className="rounded-full bg-white px-3 py-2 text-xs font-black text-[#7a5a18] shadow-sm"
              >
                Nieuw halffab
              </button>
              <button
                type="button"
                onClick={() => removeImportCandidate(candidate.id)}
                className="rounded-full bg-white px-3 py-2 text-xs font-black text-[#a83e31] shadow-sm"
              >
                Negeer
              </button>
            </div>
          );
        })}
      </div>
    </div>
  ) : null;

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
        onPrint={() => setIsPrintChoiceOpen(true)}
        onEdit={() => startEditing("basis")}
        onClose={onClose}
        onOpenRecipe={onOpenRecipe}
      />
      {isPrintChoiceOpen && (
        <RecipePrintChoiceDialog
          recipe={previewRecipe}
          onCancel={() => setIsPrintChoiceOpen(false)}
          onChoose={(variant) => {
            setIsPrintChoiceOpen(false);
            printProductionCard(variant);
          }}
        />
      )}
      {isProductionShortcutOpen && (
        <ProductionShortcutDialog
          recipe={previewRecipe}
          quantity={cardQuantity || previewBatchQuantity || 1}
          onCancel={() => setIsProductionShortcutOpen(false)}
          onConfirm={confirmRecipeCardMade}
        />
      )}
      {productionStart && (
        <WorkRecipeDetail
          key={`${previewRecipe.id}-production-${productionStart.token}`}
          recipe={previewRecipe}
          recipes={recipes}
          ingredients={ingredients}
          startInProduction
          initialQuantity={productionStart.quantity}
          closeOnBackFromProduction
          onSelectRecipe={(linkedRecipe) => {
            setProductionStart(null);
            onOpenRecipe?.(linkedRecipe);
          }}
          onMarkProduced={onMarkProduced}
          onClose={() => setProductionStart(null)}
        />
      )}
      </>
    );
  }

  return (
    <div className="fixed inset-0 z-[70] overflow-y-auto bg-white/70 px-2 py-4 backdrop-blur-[1px]">
      <div className="mx-auto w-[min(64rem,calc(100vw-1rem))] border border-[#111111] bg-white p-3 shadow-2xl">
        <div className="flex flex-wrap items-start justify-between gap-3 bg-white p-2">
          <div>
            <p className="text-sm italic text-[#111111]">
              Recept kaart
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
            className="text-4xl font-light leading-none text-[#111111]"
            aria-label="Sluit receptkaart"
          >
            ×
          </button>
        </div>

        {isEditing && (
          <Panel className="mt-2 rounded-none border-[#cfdcc8] bg-[#efefef] p-2">
            <div className="grid gap-2 border border-[#c3d3bc] bg-[#f7fbf5] p-2 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-xl font-black leading-tight">Ingredienten</h3>
                  <p className="mt-1 text-xs italic text-[#2d2a26]/45">
                    {draft.type === "finalProduct"
                      ? `kost ${formatEuro(previewCostPrice)}/stuk · batch ${formatEuro(previewBatchCost)}`
                      : `kost ${formatEuro(previewCostPrice)}/kg · batch ${formatEuro(previewBatchCost)}`}
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <RecipeTypeToggle
                    value={draft.type}
                    onChange={(value) => {
                      updateDraft({ type: value });
                      if (
                        value === "semiFinished" &&
                        (activeEditSection === "productie" ||
                          activeEditSection === "basis")
                      ) {
                        setActiveEditSection("stappen");
                      }
                    }}
                  />
                  <label className="cursor-pointer rounded-full bg-white px-3 py-2 text-xs font-black text-[#2d2a26]/70 shadow-sm">
                    {isImportingRecipe ? "Lezen..." : "Bestand inlezen"}
                    <input
                      type="file"
                      accept={RECIPE_IMPORT_FILE_ACCEPT}
                      disabled={isImportingRecipe}
                      className="sr-only"
                      onChange={(event) => {
                        void importRecipeFile(event.target.files?.[0] || null);
                        event.currentTarget.value = "";
                      }}
                    />
                  </label>
                </div>
              </div>

              {recipeImportWarnings.length > 0 && (
                <div className="rounded-2xl border border-[#ead7a6] bg-[#fff8e3] p-3">
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

              {importCandidateReview}

              <div
                className={`grid gap-2 ${
                  draft.type === "finalProduct"
                    ? "md:grid-cols-[minmax(12rem,1.3fr)_minmax(9rem,0.8fr)_6.5rem_6.5rem_7rem]"
                    : "md:grid-cols-[minmax(12rem,1fr)_9rem]"
                }`}
              >
                <EditTextField
                  label="Naam"
                  value={draft.name}
                  onChange={(value) => updateDraft({ name: value })}
                />
                {draft.type === "finalProduct" && (
                  <>
                    <GroupComboField
                      label="Groep"
                      value={draft.productGroup}
                      onChange={(value) => updateDraft({ productGroup: value })}
                      options={recipeGroupOptionsForRecipes(recipes, [
                        draft.productGroup,
                      ]).map((option) => option.label)}
                    />
                    <EditTextField
                      label="Batch"
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
                    <EditTextField
                      label="Verkoopprijs"
                      value={draft.salesPrice}
                      onChange={(value) => updateDraft({ salesPrice: value })}
                      inputMode="decimal"
                      info={`Winkelprijs incl. ${Math.round(
                        RECIPE_SALES_VAT_RATE * 100
                      )}% btw. Alle kostprijzen blijven ex btw.`}
                    />
                  </>
                )}
                {draft.type === "semiFinished" && (
                  <Metric
                    label="Batch"
                    value={formatBatchWeight(previewMadeWeightKg)}
                    className="bg-white"
                  />
                )}
              </div>

              <div className="grid gap-0 border border-[#d7e4d1] bg-white">
                <div className="grid gap-0 divide-y divide-[#d7e4d1]">
                  {draft.ingredients.map((line, index) => {
                    const ingredient = findIngredient(
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
                        draggable
                        onDragStart={() => setDraggedIngredientLineId(line.id)}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={() => {
                          moveIngredientLineTo(draggedIngredientLineId, line.id);
                          setDraggedIngredientLineId("");
                        }}
                        onDragEnd={() => setDraggedIngredientLineId("")}
                        className={`grid cursor-move gap-1.5 bg-white px-2 py-1.5 md:grid-cols-[4.2rem_minmax(12rem,1fr)_5.5rem_5.8rem_5rem_auto] md:items-end ${
                          draggedIngredientLineId === line.id ? "opacity-55" : ""
                        }`}
                      >
                        <span className="self-center text-[0.65rem] font-black uppercase tracking-[0.08em] text-[#45663b]">
                          grondstof
                        </span>
                        <IngredientSearchField
                          ingredients={availableIngredients}
                          value={line.ingredientId}
                          onCreateFromQuery={(name) =>
                            createQuickIngredient(name, line.id)
                          }
                          onChange={(value) => {
                            const selectedIngredient = findIngredient(
                              availableIngredients,
                              value
                            );
                            updateIngredientLine(line.id, {
                              ingredientId: value,
                              unit: selectedIngredient?.recipeUnit || line.unit,
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
                        <div className="flex items-end gap-1">
                          <button
                            type="button"
                            onClick={() => moveIngredientLine(line.id, -1)}
                            disabled={index === 0}
                            className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-xs font-black text-[#45663b] shadow-sm disabled:opacity-30"
                            aria-label="Grondstof omhoog"
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            onClick={() => moveIngredientLine(line.id, 1)}
                            disabled={index === draft.ingredients.length - 1}
                            className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-xs font-black text-[#45663b] shadow-sm disabled:opacity-30"
                            aria-label="Grondstof omlaag"
                          >
                            ↓
                          </button>
                          <button
                            type="button"
                            onClick={() => removeIngredientLine(line.id)}
                            className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-xs font-black text-[#a83e31] shadow-sm"
                            aria-label="Grondstof verwijderen"
                          >
                            ×
                          </button>
                        </div>
                        {ingredient?.lastInvoice ===
                          "Gemiddelde prijs - later controleren" && (
                          <p className="text-[0.7rem] font-black text-[#a83e31] md:col-span-6">
                            ! gemiddelde prijs gebruikt, later echte inkoopprijs
                            controleren
                          </p>
                        )}
                      </div>
                    );
                  })}

                  {draft.semiFinishedItems.map((line, index) => {
                    const normalizedLine = normalizeSemiFinishedDraft(
                      line,
                      recipes
                    );

                    return (
                      <div
                        key={line.id}
                        className="grid gap-1.5 bg-[#fffdf4] px-2 py-1.5 md:grid-cols-[4.2rem_minmax(12rem,1fr)_5.5rem_5.8rem_5rem_auto] md:items-end"
                      >
                        <span className="self-center text-[0.65rem] font-black uppercase tracking-[0.08em] text-[#7a5a18]">
                          halffab
                        </span>
                        <SemiFinishedSearchField
                          recipes={semiFinishedOptions}
                          value={line.semiFinishedRecipeId}
                          onCreateFromQuery={(name) =>
                            createQuickSemiFinished(name, line.id)
                          }
                          onChange={(value) =>
                            updateSemiFinishedLine(line.id, {
                              semiFinishedRecipeId: value,
                              unit:
                                getBatchInfo(findRecipe(recipes, value))?.unit ||
                                line.unit,
                            })
                          }
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
                        <div className="flex items-end gap-1">
                          <button
                            type="button"
                            onClick={() => moveSemiFinishedLine(line.id, -1)}
                            disabled={index === 0}
                            className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-xs font-black text-[#7a5a18] shadow-sm disabled:opacity-30"
                            aria-label="Halffabricaat omhoog"
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            onClick={() => moveSemiFinishedLine(line.id, 1)}
                            disabled={index === draft.semiFinishedItems.length - 1}
                            className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-xs font-black text-[#7a5a18] shadow-sm disabled:opacity-30"
                            aria-label="Halffabricaat omlaag"
                          >
                            ↓
                          </button>
                          <button
                            type="button"
                            onClick={() => removeSemiFinishedLine(line.id)}
                            className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-xs font-black text-[#a83e31] shadow-sm"
                            aria-label="Halffabricaat verwijderen"
                          >
                            ×
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex flex-wrap items-center gap-2 border-t border-[#d7e4d1] bg-[#fbfcf9] px-2 py-2">
                  <button
                    type="button"
                    onClick={() => addIngredientLine()}
                    className="rounded-full bg-[#c3d3bc] px-3 py-2 text-xs font-black shadow-sm"
                  >
                    + grondstofregel
                  </button>
                  <button
                    type="button"
                    onClick={() => addSemiFinishedLine()}
                    className="rounded-full bg-[#f2d58d] px-3 py-2 text-xs font-black shadow-sm"
                  >
                    + halffabricaat
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-xs font-black text-[#2d2a26]/55">
                {feedback && (
                  <span className="text-[#45663b]">{feedback}</span>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                if (
                  !isAdvancedOpen &&
                  draft.type !== "finalProduct" &&
                  activeEditSection === "basis"
                ) {
                  setActiveEditSection("productie");
                }
                setIsAdvancedOpen((current) => !current);
              }}
              className="mt-2 w-fit rounded-full border border-[#c3d3bc] bg-white px-4 py-2 text-sm font-black text-[#2d2a26] shadow-sm"
            >
              {isAdvancedOpen ? "Verberg uitgebreid" : "Uitgebreid"}
            </button>

            {isAdvancedOpen && (
              <div className="mt-2 border border-[#dfe9d8] bg-white/75 p-2">

            <div className="grid grid-cols-2 border border-[#c3d3bc] bg-white sm:grid-cols-3 lg:grid-cols-6">
              {recipeEditSections.map((section) => {
                if (
                  draft.type !== "finalProduct" &&
                  section.id === "basis"
                ) {
                  return null;
                }

                const isActive = activeEditSection === section.id;

                return (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => setActiveEditSection(section.id)}
                    className={`min-w-0 border-r border-[#c3d3bc] px-3 py-2 text-center uppercase tracking-[0.12em] transition last:border-r-0 ${
                      isActive
                        ? "bg-[#c3d3bc] text-[#111111]"
                        : "bg-white text-[#111111]"
                    }`}
                  >
                    <span className="block truncate text-xs font-light sm:text-sm">
                      {section.label}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="mt-3 grid gap-3">
              {activeEditSection === "basis" && draft.type === "finalProduct" && (
                <EditorBlock title="Verpakking">
                  <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_18rem]">
                    <div className="grid content-start gap-3">
                        <div className="border border-[#dfe9d8] bg-white p-2">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-black">
                                Verpakking
                              </p>
                            </div>
                            <Metric
                              label="Per stuk"
                              value={formatEuro(packagingUnitCost)}
                            />
                          </div>

                          <div className="mt-2 divide-y divide-[#dfe9d8] border border-[#dfe9d8]">
                            {draft.packagingItems.map((line) => {
                              const normalizedLine = previewPackagingItems.find(
                                (item) => item.id === line.id
                              );

                              return (
                                <div
                                  key={line.id}
                                  className="grid gap-2 bg-white px-2 py-1.5 lg:grid-cols-[minmax(12rem,1fr)_7rem_7rem_auto]"
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
                                    className="flex h-9 w-9 items-center justify-center self-end rounded-full bg-[#fff4f1] text-sm font-black text-[#a83e31]"
                                    aria-label="Verpakking verwijderen"
                                  >
                                    ×
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
                            <p className="text-xs italic text-[#2d2a26]/45">
                              Lijst: {formatEuro(selectedPackagingUnitCost)} +
                              eigen: {formatEuro(manualPackagingUnitCost)}
                            </p>
                          </div>
                        </div>

                    </div>

                    <div className="grid content-start gap-2 border border-[#dfe9d8] bg-white/76 p-2">
                      <div
                        className={`flex aspect-[4/3] items-center justify-center border border-[#dfe9d8] bg-[#eadfcf] bg-cover bg-center p-3 text-center ${
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
                  </div>
                </EditorBlock>
              )}

              {activeEditSection === "productie" && (
              <EditorBlock title="Productieplanning">
                {draft.type === "finalProduct" && (
                  <>
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

                    <div className="mt-4 grid gap-3 border border-[#c3d3bc] bg-white p-3 md:grid-cols-[minmax(8rem,0.75fr)_minmax(8rem,0.75fr)_minmax(8rem,0.75fr)_minmax(9rem,1fr)]">
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
                          updateDraft({ averageSalesPeriod: value as SalesPeriod })
                        }
                        options={salesPeriods.map((period) => ({
                          value: period,
                          label: salesPeriodText(period),
                        }))}
                      />
                      <EditTextField
                        label="Vaste batch"
                        value={draft.desiredProductionBatchQuantity}
                        onChange={(value) =>
                          updateDraft({ desiredProductionBatchQuantity: value })
                        }
                        inputMode="decimal"
                      />
                      <label className="flex items-center gap-3 self-end border border-[#cfdcc8] bg-[#f7faf5] px-3 py-2.5 text-xs font-black uppercase tracking-[0.08em] text-[#2d2a26]/60">
                        <input
                          type="checkbox"
                          checked={draft.canProduceAhead}
                          onChange={(event) =>
                            updateDraft({ canProduceAhead: event.target.checked })
                          }
                          className="h-4 w-4 accent-[#8fb184]"
                        />
                        elke{" "}
                        <input
                          value={draft.desiredProductionFrequencyDays}
                          onChange={(event) =>
                            updateDraft({
                              desiredProductionFrequencyDays: event.target.value,
                            })
                          }
                          inputMode="decimal"
                          className="h-8 w-14 border border-[#cfdcc8] bg-white px-2 text-center text-sm font-black tracking-normal outline-none"
                        />
                        dagen
                      </label>
                    </div>
                  </>
                )}

                <div className="mt-3 grid gap-3 xl:grid-cols-2">
                  <div className="border border-[#dfe9d8] bg-white p-2">
                    <p className="text-sm font-black">Productielogboek</p>
                    <div className="mt-2 grid gap-2 sm:grid-cols-[9rem_8rem_minmax(0,1fr)_auto]">
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
                    <div className="mt-3 divide-y divide-[#dfe9d8] border border-[#dfe9d8]">
                      {draft.productionLog.length ? (
                        draft.productionLog.map((entry) => (
                          <div
                            key={entry.id}
                            className="grid gap-2 bg-white px-2 py-1.5 sm:grid-cols-[9rem_8rem_minmax(0,1fr)_auto] sm:items-center"
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
                              className="flex h-8 w-8 items-center justify-center rounded-full bg-[#fff4f1] text-xs font-black text-[#a83e31]"
                              aria-label="Productieregel verwijderen"
                            >
                              ×
                            </button>
                          </div>
                        ))
                      ) : (
                        <p className="bg-[#f8f6f3] p-2 text-sm font-bold text-[#2d2a26]/50">
                          Nog geen producties geregistreerd.
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="border border-[#ead7a6] bg-[#fff8e3] p-2">
                    <p className="text-sm font-black">Extra productie plannen</p>
                    <div className="mt-2 grid gap-2 sm:grid-cols-[9rem_8rem_minmax(0,1fr)_auto]">
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
                    <div className="mt-3 divide-y divide-[#ead7a6] border border-[#ead7a6] bg-white">
                      {draft.productionRequests.length ? (
                        draft.productionRequests.map((request) => (
                          <div
                            key={request.id}
                            className="grid gap-2 px-2 py-1.5 sm:grid-cols-[8rem_8rem_minmax(0,1fr)_auto] sm:items-center"
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
                              className="flex h-8 w-8 items-center justify-center rounded-full bg-[#fff4f1] text-xs font-black text-[#a83e31]"
                              aria-label="Geplande productie verwijderen"
                            >
                              ×
                            </button>
                          </div>
                        ))
                      ) : (
                        <p className="p-2 text-sm font-bold text-[#2d2a26]/50">
                          Geen extra geplande producties.
                        </p>
                      )}
                    </div>
                  </div>
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
              </div>
            )}

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[#d8d0c4] pt-2">
              <div className="min-h-6 text-xs font-black text-[#45663b]">
                {feedback || ""}
              </div>
              <div className="flex items-center gap-2">
                {isConfirmingDelete && (
                  <>
                    <span className="text-xs font-black text-[#a83e31]">
                      Weet je zeker?
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsConfirmingDelete(false)}
                      className="flex h-9 w-9 items-center justify-center rounded-full border border-[#d8d0c4] bg-white text-[#2d2a26]/55 shadow-sm"
                      aria-label="Verwijderen annuleren"
                    >
                      <XIcon />
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={saveRecipeDraft}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-[#c3d3bc] text-[#111111] shadow-sm"
                  aria-label="Recept opslaan"
                >
                  <CheckIcon />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDraft(createRecipeDraft(recipe));
                    setIsEditing(false);
                  }}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-[#d8d0c4] bg-white text-[#2d2a26]/60 shadow-sm"
                  aria-label="Annuleren"
                >
                  <XIcon />
                </button>
                <button
                  type="button"
                  onClick={requestDeleteRecipe}
                  title={
                    recipeUsageCount
                      ? `Wordt in ${recipeUsageCount} ander recept gebruikt`
                      : "Recept verwijderen"
                  }
                  className={`flex h-9 w-9 items-center justify-center rounded-full shadow-sm ${
                    isConfirmingDelete
                      ? "bg-[#a83e31] text-white"
                      : "bg-[#fff4f1] text-[#a83e31]"
                  }`}
                  aria-label={
                    isConfirmingDelete
                      ? "Verwijderen bevestigen"
                      : "Recept verwijderen"
                  }
                >
                  <TrashIcon />
                </button>
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
                  label="Verkoop incl. btw"
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
                    label="Marge ex. btw"
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
                    Adviesprijs incl. btw volgens marge-instellingen:{" "}
                    {formatEuro(targetPrice)}
                  </p>
                  <p className="mt-1 text-xs font-bold text-[#2d2a26]/55">
                    Basisrecept rekent ex btw met {formatPercent(previewRecipe.targetMargin)} marge
                    en verpakking tegen kostprijs. Daardoor is de totale
                    doelmarge hier {formatPercent(effectiveMarginTarget, 1)}.
                    Winkelprijs moet met{" "}
                    {formatEuro(Math.max(0, targetPrice - previewRecipe.salesPrice))}{" "}
                    omhoog om de doelmarge te halen.
                  </p>
                </div>
              )}
            </Panel>

            <div className="grid gap-4 xl:grid-cols-2">
              <Panel className="border-[#c3d3bc] bg-[#edf5ea]">
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

              <Panel className="border-[#c3d3bc] bg-[#f5faf2]">
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
              {visiblePreparationSteps.length > 0 && (
                <Panel>
                  <SectionTitle title="Bereidingswijze" />
                  <ol className="mt-3 grid gap-2">
                    {visiblePreparationSteps.map((step, index) => (
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
              )}

              <ProductionHistoryPanel
                history={productionHistory}
                nextProductionDate={
                  previewRecipe.type === "finalProduct"
                    ? productionPreview.nextProductionDate
                    : ""
                }
                recipe={previewRecipe}
              />

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
            onClick={() => setIsPrintChoiceOpen(true)}
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
  canProduceAhead: boolean;
  desiredProductionFrequencyDays: string;
  desiredProductionBatchQuantity: string;
  productionLog: ProductionLogEntry[];
  productionRequests: ProductionRequest[];
  version: string;
  photoHint: string;
  photoPreviewDataUrl: string;
  photoFileName: string;
  photoUpdatedAt: string;
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

function createRecipeDraft(recipe: Recipe): RecipeDraft {
  const preparationSteps = cleanRecipeSteps(recipe.preparationSteps);

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
    canProduceAhead: Boolean(recipe.canProduceAhead),
    desiredProductionFrequencyDays: formatInputNumber(
      recipe.desiredProductionFrequencyDays || 7
    ),
    desiredProductionBatchQuantity: formatInputNumber(
      recipe.desiredProductionBatchQuantity ||
        recipe.standardBatchQuantity ||
        getBatchInfo(recipe)?.quantity ||
        0
    ),
    productionLog: productionLogForRecipe(recipe),
    productionRequests: normalizeProductionRequests(recipe.productionRequests || []),
    version: recipe.version,
    photoHint: recipe.photoHint,
    photoPreviewDataUrl: recipe.photoPreviewDataUrl || "",
    photoFileName: recipe.photoFileName || "",
    photoUpdatedAt: recipe.photoUpdatedAt || "",
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
    preparationSteps,
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
  const preparationSteps = cleanRecipeSteps(importedRecipe.preparationSteps);

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
    canProduceAhead:
      importedRecipe.canProduceAhead ?? current.canProduceAhead,
    desiredProductionFrequencyDays: importedRecipe.desiredProductionFrequencyDays
      ? formatInputNumber(importedRecipe.desiredProductionFrequencyDays)
      : current.desiredProductionFrequencyDays,
    desiredProductionBatchQuantity: importedRecipe.desiredProductionBatchQuantity
      ? formatInputNumber(importedRecipe.desiredProductionBatchQuantity)
      : current.desiredProductionBatchQuantity,
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
    preparationSteps: preparationSteps.length
      ? preparationSteps
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
  const latestProductionEntry = draft.productionLog.find(
    (entry) => entry.source !== "stock"
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
    preparationSteps: cleanRecipeSteps(draft.preparationSteps),
    finishingSteps: isSemiFinished ? [] : cleanList(draft.finishingSteps),
    equipment: cleanList(draft.equipment),
    allergens: parseList(draft.allergens),
    internalNotes: draft.internalNotes.trim(),
    isWorkModeVisible: true,
    workCategories: [],
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
    canProduceAhead: isSemiFinished ? false : draft.canProduceAhead,
    desiredProductionFrequencyDays: isSemiFinished
      ? 0
      : Math.max(0, Math.round(parseDutchNumber(draft.desiredProductionFrequencyDays))),
    desiredProductionBatchQuantity: isSemiFinished
      ? 0
      : parseDutchNumber(draft.desiredProductionBatchQuantity),
    lastProducedAt: latestProductionEntry?.date || "",
    lastProducedQuantity: latestProductionEntry?.quantity || 0,
    productionLog: draft.productionLog,
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

function formatRecipeCardQuantity(value: number) {
  if (!value) return "0";

  const decimals = Math.abs(value) < 10 ? 2 : 1;

  return value.toLocaleString("nl-NL", {
    maximumFractionDigits: decimals,
    minimumFractionDigits: 0,
  });
}

async function readImportResponse(response: Response) {
  try {
    return await response.json();
  } catch {
    return {
      message: response.ok
        ? "Bestand kon niet gelezen worden."
        : "Import duurde te lang of gaf geen geldige reactie.",
    };
  }
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

function parseTextLines(value: string) {
  const lines = value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);

  return lines.length ? lines : [""];
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

function uniqueRecipeId(name: string, recipes: Recipe[]) {
  const base =
    name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 32) || "halffabricaat";
  let id = `recipe-${base}`;
  let counter = 1;

  while (recipes.some((recipe) => recipe.id === id)) {
    counter += 1;
    id = `recipe-${base}-${counter}`;
  }

  return id;
}

function createBlankSemiFinishedRecipe(
  name: string,
  recipes: Recipe[],
  batchUnit: RecipeUnit = "gram"
): Recipe {
  return {
    id: uniqueRecipeId(name, recipes),
    name,
    type: "semiFinished",
    productGroup: "Halffabricaat",
    standardBatchQuantity: batchUnit === "stuk" ? 1 : undefined,
    standardBatchUnit: batchUnit,
    salesPrice: 0,
    costPrice: 0,
    previousCostPrice: 0,
    targetMargin: 0,
    currentMargin: 0,
    status: "draft",
    ingredients: [],
    semiFinishedItems: [],
    packagingItems: [],
    workInstructions: [],
    preparationSteps: [],
    finishingSteps: [],
    equipment: [],
    allergens: [],
    internalNotes: "Aangemaakt als halffabricaat-concept. Vul later de receptuur aan.",
    isWorkModeVisible: true,
    workCategories: [],
    version: "concept",
    lastUpdated: todayIsoDate(),
    portionLabel: `per ${unitLabelText(batchUnit)}`,
    batchSize: batchUnit === "stuk" ? "1 stuk" : "",
    photoHint: "",
    photoPreviewDataUrl: "",
    photoFileName: "",
    photoUpdatedAt: "",
    notes: "",
    linkedFinalProductIds: [],
    packagingCost: 0,
    decorationCost: 0,
    decorationMargin: 0,
    averageSalesQuantity: 0,
    averageSalesPeriod: "week",
    canProduceAhead: false,
    desiredProductionFrequencyDays: 0,
    desiredProductionBatchQuantity: 0,
    productionLog: [],
    productionRequests: [],
  };
}

function baseRecipeUnitForImport(unit: RecipeUnit): RecipeUnit {
  if (unit === "kg" || unit === "gram") return "gram";
  if (unit === "liter" || unit === "ml") return "ml";

  return "stuk";
}

function averagePackagePriceForUnit(ingredients: Ingredient[], unit: RecipeUnit) {
  const pricesForUnit = ingredients
    .filter((ingredient) => ingredient.recipeUnit === unit)
    .map((ingredient) => ingredient.lastPrice || ingredient.pricePerBaseUnit)
    .filter((price) => Number.isFinite(price) && price > 0);
  const fallbackPrices = ingredients
    .map((ingredient) => ingredient.lastPrice || ingredient.pricePerBaseUnit)
    .filter((price) => Number.isFinite(price) && price > 0);
  const prices = pricesForUnit.length ? pricesForUnit : fallbackPrices;

  if (!prices.length) return unit === "stuk" ? 1 : 5;

  return Math.round(
    (prices.reduce((total, price) => total + price, 0) / prices.length) * 100
  ) / 100;
}

function recipeStatusText(status: RecipeStatus) {
  if (status === "active") return "Actief";
  if (status === "draft") return "Concept";

  return "Oud recept";
}

function isEmptyPreparationStep(value: string) {
  const normalized = value.trim();

  return !normalized || normalized === EMPTY_PREPARATION_STEP_TEXT;
}

function cleanRecipeSteps(steps: string[] = []) {
  return steps
    .map((step) => step.trim())
    .filter((step) => !isEmptyPreparationStep(step));
}

function weekLabelForDate(value: string) {
  const week = isoWeekNumber(value);

  return week ? `week ${week}` : formatDate(value);
}

function isoWeekNumber(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return 0;

  const target = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
  );
  const dayNumber = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - dayNumber);

  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));

  return Math.ceil(((target.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
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
    `Kostprijs ex btw: ${formatEuro(recipe.costPrice)}`,
    `Verkoopprijs incl btw: ${recipe.salesPrice ? formatEuro(recipe.salesPrice) : "-"}`,
    "",
    "Ingredienten",
    ingredientLines.length ? ingredientLines.join("\n") : "-",
    "",
    "Halffabricaten",
    semiFinishedLines.length ? semiFinishedLines.join("\n") : "-",
    "",
    "Bereiding",
    cleanRecipeSteps(recipe.preparationSteps)
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
  batchQuantity = recipe.standardBatchQuantity || getBatchInfo(recipe)?.quantity || 1,
  variant: RecipePrintVariant = "work"
) {
  const multiplier = batchQuantity > 0 ? quantity / batchQuantity : 1;
  const isCalculation = variant === "calculation";
  const calculationRows = recipeCalculationPrintRows(
    recipe,
    ingredients,
    recipes,
    multiplier
  );
  const ingredientRows = calculationRows
    .map(
      (item) =>
        `<tr><td>${escapeHtml(item.name)}</td><td>${escapeHtml(
          formatRecipeCardQuantity(item.quantity)
        )}</td><td>${escapeHtml(shortUnitLabel(item.unit))}</td><td>${escapeHtml(
          item.isSemiFinished ? "halffabricaat" : ""
        )}</td>${
          isCalculation
            ? `<td>${escapeHtml(formatEuro(item.costContribution))}</td>`
            : ""
        }</tr>`
    )
    .join("");
  const cleanPreparationSteps = cleanRecipeSteps(recipe.preparationSteps);
  const steps = (cleanPreparationSteps.length
    ? cleanPreparationSteps
    : recipe.workInstructions || []
  )
    .map((step) => `<li>${escapeHtml(step)}</li>`)
    .join("");
  const unit = getBatchInfo(recipe)?.unit || recipe.standardBatchUnit || "stuk";
  const selectedTotalCost = roundMoney(recipe.costPrice * quantity);
  const selectedTotalSales =
    recipe.type === "finalProduct" && recipe.salesPrice
      ? roundMoney(recipe.salesPrice * quantity)
      : 0;
  const currentMargin = recipe.salesPrice
    ? calculateMargin(recipe.salesPrice, recipe.costPrice)
    : 0;
  const printTitle =
    variant === "calculation" ? "Calculatiekaart" : "Recept / werkkaart";
  const summaryCards = isCalculation
    ? `<section class="summary">
        <div><span>Kostprijs ex.</span><strong>${escapeHtml(
          formatEuro(recipe.costPrice)
        )}</strong></div>
        <div><span>Verkoop incl.</span><strong>${escapeHtml(
          recipe.salesPrice ? formatEuro(recipe.salesPrice) : "-"
        )}</strong></div>
        <div><span>Marge ex.</span><strong>${escapeHtml(
          currentMargin ? formatPercent(currentMargin) : "-"
        )}</strong></div>
        <div><span>Totale kost ex.</span><strong>${escapeHtml(
          formatEuro(selectedTotalCost)
        )}</strong></div>
        <div><span>Totale verkoop incl.</span><strong>${escapeHtml(
          selectedTotalSales ? formatEuro(selectedTotalSales) : "-"
        )}</strong></div>
        <div><span>Doelmarge</span><strong>${escapeHtml(
          recipe.targetMargin ? formatPercent(recipe.targetMargin, 1) : "-"
        )}</strong></div>
      </section>`
    : "";
  const tableHeader = isCalculation
    ? "<thead><tr><th>Naam</th><th>Aantal</th><th>Eenheid</th><th>Soort</th><th>Kost</th></tr></thead>"
    : "";
  const costFooter = isCalculation
    ? `<tfoot><tr><td colspan="4">Totaal calculatie</td><td>${escapeHtml(
        formatEuro(selectedTotalCost)
      )}</td></tr></tfoot>`
    : "";

  return `<!doctype html>
<html lang="nl">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(recipe.name)} ${escapeHtml(printTitle)}</title>
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
    .summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin: 18px 0; }
    .summary div { border: 1px solid #c3d3bc; padding: 10px 12px; }
    .summary span { display: block; color: #666; font-size: 11px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
    .summary strong { display: block; margin-top: 5px; font-size: 17px; }
    table { width: 100%; border-collapse: collapse; }
    th { padding: 0 0 8px; color: #666; font-size: 11px; letter-spacing: .08em; text-align: left; text-transform: uppercase; }
    td { border-top: 1px solid #d8d8d8; padding: 6px 0; font-size: 16px; font-weight: 700; }
    td:nth-child(n+2), th:nth-child(n+2) { text-align: right; }
    tfoot td { border-top: 2px solid #111; font-size: 17px; }
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
    <p class="eyebrow">${escapeHtml(printTitle)}</p>
    <div class="layout">
      <div class="stripe"></div>
      <main>
        <h1>${escapeHtml(recipe.name)}</h1>
        <p class="type">${escapeHtml(recipe.productGroup || recipeTypeLabel(recipe.type))}</p>
        <p class="qty">${escapeHtml(formatInputNumber(quantity))} ${escapeHtml(unitLabelText(unit))}</p>
        ${summaryCards}
        <section class="box">
          <h2>Ingredienten</h2>
          <table>${tableHeader}<tbody>${
            ingredientRows ||
            `<tr><td colspan="${isCalculation ? "5" : "4"}">Nog geen ingredienten.</td></tr>`
          }</tbody>${costFooter}</table>
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
  onOpenRecipe,
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
  onOpenRecipe?: (recipe: Recipe) => void;
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
  const cleanPreparationSteps = cleanRecipeSteps(recipe.preparationSteps);
  const steps = cleanPreparationSteps.length
    ? cleanPreparationSteps
    : recipe.workInstructions || [];
  const madeToday = productionLogForRecipe(recipe).some(
    (entry) => entry.date === todayIsoDate()
  );
  const latestMadeEntry = productionLogForRecipe(recipe).find(
    (entry) => entry.source !== "stock"
  );
  const batchInfo = getBatchInfo(recipe);
  const productionUnit = batchInfo?.unit || recipe.standardBatchUnit || "stuk";
  const cardMargin = recipe.salesPrice
    ? calculateMargin(recipe.salesPrice, recipe.costPrice)
    : 0;

  return (
    <div className="fixed inset-0 z-[70] overflow-y-auto bg-white/70 px-2 py-2 backdrop-blur-[1px] sm:py-4">
      <div className="mx-auto w-[min(60rem,calc(100vw-0.75rem))] border border-[#d7d2cb] bg-white px-3 py-3 shadow-2xl sm:px-5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-7 items-center gap-1 border border-[#c3d3bc] bg-white px-2 text-[0.68rem] font-black"
            >
              <img src="/UI-apps_terug.svg" alt="" className="h-4 w-4" />
              Terug
            </button>
            <p className="text-xs italic text-[#111111]/60">Recept kaart</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-3xl font-light leading-none text-[#111111]"
            aria-label="Sluit receptkaart"
          >
            ×
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-[0.65rem_minmax(0,1fr)]">
          <div className={`hidden sm:block ${recipeCardStripeClass(recipe)}`} />
          <div
            className={`grid gap-3 ${
              recipe.type === "finalProduct"
                ? "lg:grid-cols-[minmax(0,1.4fr)_10rem]"
                : ""
            }`}
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="truncate text-[clamp(1.25rem,3.2vw,1.8rem)] font-light leading-none">
                    {recipe.name}
                  </h2>
                  <p className="mt-1 text-xs italic text-[#555555]">
                    {recipe.productGroup || recipeTypeLabel(recipe.type)}
                  </p>
                </div>

                <div className="grid grid-cols-[3.35rem_2.35rem_2.6rem_2.35rem] border border-[#c3d3bc] text-center text-[0.58rem] uppercase tracking-[0.08em]">
                  <button
                    type="button"
                    onClick={onStart}
                    className={`border-r border-[#c3d3bc] px-1.5 py-2 ${
                      isStarted ? "bg-[#c3d3bc]" : "bg-white"
                    }`}
                  >
                    Start
                  </button>
                  <button
                    type="button"
                    onClick={onMarkMade}
                    className={`border-r border-[#c3d3bc] px-1.5 py-1.5 text-xl leading-none ${
                      madeToday ? "bg-[#c3d3bc]" : "bg-white"
                    }`}
                    aria-label="Gemaakt"
                  >
                    ✓
                  </button>
                  <button
                    type="button"
                    onClick={onPrint}
                    className="border-r border-[#c3d3bc] px-1.5 py-2 text-[0.58rem] font-black tracking-normal"
                  >
                    Print
                  </button>
                  <button
                    type="button"
                    onClick={onEdit}
                    className="px-1.5 py-2 text-xl leading-none"
                    aria-label="Aanpassen"
                  >
                    ✎
                  </button>
                </div>
              </div>

              <div className="mt-2 flex items-center gap-1.5 pl-0.5">
                <button
                  type="button"
                  onClick={() => onQuantityStep(-1)}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-xl shadow"
                  aria-label="Hoeveelheid verlagen"
                >
                  -
                </button>
                <input
                  value={formatInputNumber(quantity)}
                  onChange={(event) => onQuantityChange(event.target.value)}
                  inputMode="decimal"
                  className="h-8 w-20 rounded-lg border border-[#e4d8cb] bg-white text-center text-xs font-black outline-none"
                  aria-label="Hoeveelheid"
                />
                <span className="text-xs font-black text-[#707070]">
                  {unitLabelText(getBatchInfo(recipe)?.unit || recipe.standardBatchUnit || "stuk")}
                </span>
                <button
                  type="button"
                  onClick={() => onQuantityStep(1)}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-xl shadow"
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

              <div className="mt-3 grid grid-cols-3 gap-1.5 rounded-[0.95rem] border border-[#dfe9d8] bg-white p-2">
                <div className="rounded-lg bg-[#f8fbf5] px-2 py-1.5">
                  <p className="text-[0.58rem] font-black uppercase tracking-[0.1em] text-[#2d2a26]/45">
                    Winkelprijs incl.
                  </p>
                  <p className="mt-0.5 text-sm font-black text-[#1a1815]">
                    {recipe.salesPrice ? formatEuro(recipe.salesPrice) : "-"}
                  </p>
                </div>
                <div className="rounded-lg bg-[#f8fbf5] px-2 py-1.5">
                  <p className="text-[0.58rem] font-black uppercase tracking-[0.1em] text-[#2d2a26]/45">
                    Kostprijs ex.
                  </p>
                  <p className="mt-0.5 text-sm font-black text-[#1a1815]">
                    {formatEuro(recipe.costPrice)}
                  </p>
                </div>
                <div className="rounded-lg bg-[#f8fbf5] px-2 py-1.5">
                  <p className="text-[0.58rem] font-black uppercase tracking-[0.1em] text-[#2d2a26]/45">
                    Marge ex.
                  </p>
                  <p className="mt-0.5 text-sm font-black text-[#1a1815]">
                    {cardMargin ? formatPercent(cardMargin) : "-"}
                  </p>
                </div>
              </div>

              <div className="mt-3 rounded-[0.95rem] border border-[#c3d3bc] bg-[#edf5ea] p-2.5">
                <h3 className="text-[0.72rem] font-black uppercase tracking-[0.12em] text-[#30462f]">
                  Ingredienten
                </h3>
                <div className="mt-2 grid gap-1.5">
                  {rows.length ? (
                    rows.map((row) => (
                      <div
                        key={row.id}
                        className="grid grid-cols-[minmax(0,1fr)_3.3rem_2.35rem_minmax(4.5rem,auto)] items-center gap-2 rounded-lg bg-white/78 px-2 py-1.5 text-xs sm:grid-cols-[minmax(0,1fr)_4rem_2.8rem_minmax(5.7rem,auto)] sm:text-sm"
                      >
                        <span className="truncate font-black text-[#1a1815]">{row.name}</span>
                        <span className="text-right font-black text-[#30462f]">
                          {formatRecipeCardQuantity(row.quantity)}
                        </span>
                        <span className="font-black text-[#30462f]/80">{shortUnitLabel(row.unit)}</span>
                        <span className="flex min-w-0 justify-end">
                          {row.linkedRecipe && onOpenRecipe ? (
                            <button
                              type="button"
                              onClick={() => onOpenRecipe(row.linkedRecipe!)}
                              className="inline-flex min-w-0 items-center justify-end gap-1 text-right text-[0.68rem] italic text-[#555555] sm:text-xs"
                            >
                              <span className="truncate">halffabricaat</span>
                              <img
                                src="/UI-apps_ga naar.svg"
                                alt=""
                              className="h-3.5 w-3.5 shrink-0"
                              />
                            </button>
                          ) : row.isSemiFinished ? (
                            <span className="truncate text-right text-[0.68rem] italic text-[#555555] sm:text-xs">
                              halffabricaat
                            </span>
                          ) : null}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="rounded-lg bg-white/70 p-2 text-xs font-bold text-[#707070]">
                      Nog geen ingredienten.
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-3 rounded-[0.95rem] bg-[#f3f2ef] p-2.5">
                <h3 className="text-[0.72rem] font-black uppercase tracking-[0.12em] text-[#2d2a26]/55">Stappen</h3>
                <ol className="mt-2 grid gap-1.5 text-xs font-semibold leading-snug text-[#2d2a26]/72 sm:text-sm">
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
            <aside className="grid max-w-40 content-start gap-2 justify-self-end text-right text-[0.72rem] italic text-[#555555]">
              {recipe.photoPreviewDataUrl ? (
                <img
                  src={recipe.photoPreviewDataUrl}
                  alt={recipe.photoHint || recipe.name}
                  className="aspect-square w-full rounded-lg object-cover"
                />
              ) : (
                <div className="flex aspect-square w-full items-center justify-center rounded-lg bg-[#efefef] text-2xl font-black not-italic text-[#8c8c8c]">
                  R
                </div>
              )}
              <p>
                categorie: <strong>{recipe.productGroup || recipeTypeLabel(recipe.type)}</strong>
              </p>
              <p>
                laatst gewijzigd: <strong>{formatDate(recipe.lastUpdated)}</strong>
              </p>
              {latestMadeEntry ? (
                <p>
                  laatst gemaakt op:{" "}
                  <strong>
                    {formatDate(latestMadeEntry.date)}
                  </strong>
                </p>
              ) : null}
              {latestMadeEntry ? (
                <p>
                  hoeveelheid:{" "}
                  <strong>
                    {quantityLabel(latestMadeEntry.quantity, productionUnit)}
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

function recipeCardStripeClass(recipe: Recipe) {
  if (recipe.type === "semiFinished") return "bg-[#f6f2a4]";

  const normalizedGroup = recipe.productGroup.toLocaleLowerCase("nl-NL");
  if (normalizedGroup.includes("ijs")) return "bg-[#9fd0dc]";
  if (normalizedGroup.includes("taart")) return "bg-[#e9c5dc]";

  return "bg-[#c3d3bc]";
}

function ProductionHistoryPanel({
  history,
  nextProductionDate,
  recipe,
}: Readonly<{
  history: ProductionLogEntry[];
  nextProductionDate: string;
  recipe: Recipe;
}>) {
  const unit = getBatchInfo(recipe)?.unit || recipe.standardBatchUnit || "stuk";

  return (
    <Panel>
      <SectionTitle title="Productie geschiedenis" />
      <div className="mt-3 grid gap-2">
        {history.length ? (
          history.map((entry) => (
            <LineItem
              key={entry.id}
              title={formatDate(entry.date)}
              meta={entry.note || "Gemaakt"}
              value={quantityLabel(entry.quantity, unit)}
            />
          ))
        ) : (
          <p className="rounded-2xl bg-[#f8f6f3] p-3 text-sm font-bold text-[#2d2a26]/45">
            Nog geen productie geregistreerd.
          </p>
        )}
      </div>
      <p className="mt-3 rounded-full bg-[#f4f8f2] px-3 py-2 text-xs font-black italic text-[#45663b]">
        Verwacht weer maken:{" "}
        {nextProductionDate ? weekLabelForDate(nextProductionDate) : "nog onbekend"}
      </p>
    </Panel>
  );
}

function RecipePrintChoiceDialog({
  recipe,
  onCancel,
  onChoose,
}: Readonly<{
  recipe: Recipe;
  onCancel: () => void;
  onChoose: (variant: RecipePrintVariant) => void;
}>) {
  return (
    <div className="fixed inset-0 z-[96] flex items-center justify-center bg-[#111111]/35 px-4">
      <div className="grid w-full max-w-md gap-3 rounded-[1.1rem] border border-[#d7d2cb] bg-white p-4 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs italic text-[#2d2a26]/55">Printen</p>
            <h3 className="mt-1 text-xl font-black leading-tight">
              {recipe.name}
            </h3>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="text-3xl font-light leading-none"
            aria-label="Sluit printkeuze"
          >
            ×
          </button>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => onChoose("work")}
            className="rounded-2xl border border-[#c3d3bc] bg-[#edf5ea] p-4 text-left shadow-sm"
          >
            <span className="block text-sm font-black">Recept / werkkaart</span>
            <span className="mt-1 block text-xs font-bold leading-snug text-[#2d2a26]/55">
              Ingredienten en stappen voor productie, zonder uitgebreide kosten.
            </span>
          </button>
          <button
            type="button"
            onClick={() => onChoose("calculation")}
            className="rounded-2xl border border-[#ead7a6] bg-[#fff8e3] p-4 text-left shadow-sm"
          >
            <span className="block text-sm font-black">Calculatie</span>
            <span className="mt-1 block text-xs font-bold leading-snug text-[#2d2a26]/55">
              Kostprijs, verkoopprijs, marge en kostenregels.
            </span>
          </button>
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
  linkedRecipe?: Recipe;
};

type RecipeCalculationPrintRow = RecipeCardIngredientRow & {
  costContribution: number;
};

function recipeCardIngredientRows(
  recipe: Recipe,
  ingredients: Ingredient[],
  recipes: Recipe[],
  multiplier: number
): RecipeCardIngredientRow[] {
  const directRows = recipe.ingredients.map((item) => {
    const ingredient = findIngredient(ingredients, item.ingredientId);

    return {
      id: `ingredient-${item.ingredientId}`,
      name: ingredient?.name || item.ingredientId,
      quantity: Math.round(item.quantity * multiplier * 10000) / 10000,
      unit: item.unit,
      isSemiFinished: false,
      linkedRecipe: undefined,
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
      linkedRecipe: linkedRecipe || undefined,
    };
  });

  return [...directRows, ...semiRows];
}

function recipeCalculationPrintRows(
  recipe: Recipe,
  ingredients: Ingredient[],
  recipes: Recipe[],
  multiplier: number
): RecipeCalculationPrintRow[] {
  const directRows = recipe.ingredients.map((item) => {
    const ingredient = findIngredient(ingredients, item.ingredientId);

    return {
      id: `ingredient-${item.ingredientId}`,
      name: ingredient?.name || item.ingredientId,
      quantity: Math.round(item.quantity * multiplier * 10000) / 10000,
      unit: item.unit,
      isSemiFinished: false,
      linkedRecipe: undefined,
      costContribution: roundMoney(item.costContribution * multiplier),
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
      linkedRecipe: linkedRecipe || undefined,
      costContribution: roundMoney(item.costContribution * multiplier),
    };
  });

  return [...directRows, ...semiRows];
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
    <div className="border border-[#dfe9d8] bg-white/72 p-2">
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
              className="min-h-16 flex-1 rounded-xl border border-[#cfdcc8] bg-white px-3 py-2 text-sm font-bold text-[#2d2a26] placeholder:text-[#2d2a26]/35 focus:outline-none focus:ring-2 focus:ring-[#8fb184]"
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
  info,
}: Readonly<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  inputMode?: "decimal";
  info?: string;
}>) {
  return (
    <label className="grid gap-1 text-xs font-black uppercase tracking-[0.12em] text-[#2d2a26]/45">
      <span className="flex items-center gap-1">
        {label}
        {info && (
          <span
            className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-[#c3d3bc] bg-[#f4f8f2] text-[0.58rem] font-black normal-case tracking-normal text-[#45663b]"
            title={info}
            aria-label={info}
          >
            i
          </span>
        )}
      </span>
      <input
        value={value}
        inputMode={inputMode}
        onChange={(event) => onChange(event.target.value)}
        className="min-w-0 rounded-xl border border-[#cfdcc8] bg-white px-3 py-2 text-sm font-bold normal-case tracking-normal text-[#2d2a26] focus:outline-none focus:ring-2 focus:ring-[#8fb184]"
      />
    </label>
  );
}

function GroupComboField({
  label,
  value,
  onChange,
  options,
}: Readonly<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
}>) {
  const listId = "recipe-product-group-options";
  const uniqueOptions = Array.from(new Set(options.filter(Boolean)));

  return (
    <label className="grid gap-1 text-xs font-black uppercase tracking-[0.12em] text-[#2d2a26]/45">
      {label}
      <input
        list={listId}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-w-0 rounded-xl border border-[#cfdcc8] bg-white px-3 py-2 text-sm font-bold normal-case tracking-normal text-[#2d2a26] focus:outline-none focus:ring-2 focus:ring-[#8fb184]"
      />
      <datalist id={listId}>
        {uniqueOptions.map((option) => (
          <option key={option} value={option} />
        ))}
      </datalist>
    </label>
  );
}

function RecipeTypeToggle({
  value,
  onChange,
}: Readonly<{
  value: RecipeType;
  onChange: (value: RecipeType) => void;
}>) {
  return (
    <div className="grid grid-cols-2 overflow-hidden rounded-full border border-[#c3d3bc] bg-white p-0.5 shadow-sm">
      {[
        { value: "finalProduct" as const, label: "Eindrecept" },
        { value: "semiFinished" as const, label: "Halffabricaat" },
      ].map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`rounded-full px-3 py-1.5 text-xs font-black transition ${
            value === option.value
              ? "bg-[#c3d3bc] text-[#2d2a26]"
              : "text-[#2d2a26]/55"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
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
        className="min-w-0 rounded-xl border border-[#cfdcc8] bg-white px-3 py-2 text-sm font-bold normal-case tracking-normal text-[#2d2a26] focus:outline-none focus:ring-2 focus:ring-[#8fb184]"
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
        className="min-h-20 rounded-xl border border-[#cfdcc8] bg-white px-3 py-2 text-sm font-bold normal-case tracking-normal text-[#2d2a26] focus:outline-none focus:ring-2 focus:ring-[#8fb184]"
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
        className="min-w-0 rounded-xl border border-[#cfdcc8] bg-white px-3 py-2 text-sm font-bold normal-case tracking-normal text-[#2d2a26] focus:outline-none focus:ring-2 focus:ring-[#8fb184]"
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
  onCreateFromQuery,
}: Readonly<{
  ingredients: Ingredient[];
  value: string;
  onChange: (value: string) => void;
  onCreateFromQuery?: (name: string) => void;
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
  const canCreate = Boolean(onCreateFromQuery && query.trim());

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
        className="min-w-0 rounded-xl border border-[#cfdcc8] bg-white px-3 py-2 text-sm font-bold normal-case tracking-normal text-[#2d2a26] placeholder:text-[#2d2a26]/35 focus:outline-none focus:ring-2 focus:ring-[#8fb184]"
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
              Geen grondstof gevonden.
            </p>
          )}
          {canCreate && (
            <button
              type="button"
              onMouseDown={(event) => {
                event.preventDefault();
                onCreateFromQuery?.(query);
                setQuery(query.trim());
                setIsOpen(false);
              }}
              className="mt-1 flex w-full items-center gap-2 border-t border-[#dfe9d8] px-3 py-2 text-left text-sm font-black text-[#45663b] hover:bg-[#f8f6f3]"
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#c3d3bc] text-[#111111]">
                +
              </span>
              grondstof toevoegen
            </button>
          )}
        </div>
      )}
    </label>
  );
}

function SemiFinishedSearchField({
  recipes,
  value,
  onChange,
  onCreateFromQuery,
}: Readonly<{
  recipes: Recipe[];
  value: string;
  onChange: (value: string) => void;
  onCreateFromQuery?: (name: string) => void;
}>) {
  const selectedRecipe = findRecipe(recipes, value);
  const [query, setQuery] = useState(selectedRecipe?.name || value || "");
  const [isOpen, setIsOpen] = useState(false);
  const normalizedQuery = normalizeIngredientQuery(query);
  const suggestions = recipes
    .map((recipe) => ({
      recipe,
      score: semiFinishedSearchScore(recipe, normalizedQuery),
    }))
    .filter(({ score }) => !normalizedQuery || score > 0)
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;

      return left.recipe.name.localeCompare(right.recipe.name, "nl-NL");
    })
    .map(({ recipe }) => recipe);
  const canCreate = Boolean(onCreateFromQuery && query.trim());

  return (
    <label className="relative grid gap-1 text-xs font-black uppercase tracking-[0.12em] text-[#2d2a26]/45">
      Halffabricaat
      <input
        value={query}
        onBlur={() => window.setTimeout(() => setIsOpen(false), 140)}
        onChange={(event) => {
          setQuery(event.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        placeholder="Typ halffabricaat"
        className="min-w-0 rounded-xl border border-[#ead7a6] bg-white px-3 py-2 text-sm font-bold normal-case tracking-normal text-[#2d2a26] placeholder:text-[#2d2a26]/35 focus:outline-none focus:ring-2 focus:ring-[#f2d58d]"
      />
      {isOpen && (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-2xl border border-[#ead7a6] bg-white p-1.5 text-left normal-case tracking-normal shadow-xl">
          {suggestions.length ? (
            suggestions.map((recipe) => (
              <button
                key={recipe.id}
                type="button"
                onMouseDown={(event) => {
                  event.preventDefault();
                  onChange(recipe.id);
                  setQuery(recipe.name);
                  setIsOpen(false);
                }}
                className={`grid w-full gap-0.5 rounded-xl px-3 py-2 text-left text-sm hover:bg-[#fff8e3] ${
                  recipe.id === value ? "bg-[#fff8e3]" : ""
                }`}
              >
                <span className="font-black text-[#2d2a26]">{recipe.name}</span>
                <span className="truncate text-xs font-bold text-[#2d2a26]/45">
                  {recipe.batchSize || recipeTypeLabel(recipe.type)}
                </span>
              </button>
            ))
          ) : (
            <p className="px-3 py-2 text-sm font-bold text-[#2d2a26]/45">
              Geen halffabricaat gevonden.
            </p>
          )}
          {canCreate && (
            <button
              type="button"
              onMouseDown={(event) => {
                event.preventDefault();
                onCreateFromQuery?.(query);
                setQuery(query.trim());
                setIsOpen(false);
              }}
              className="mt-1 flex w-full items-center gap-2 border-t border-[#ead7a6] px-3 py-2 text-left text-sm font-black text-[#7a5a18] hover:bg-[#fff8e3]"
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#f2d58d] text-[#111111]">
                +
              </span>
              halffabricaat toevoegen
            </button>
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
        className="min-w-0 rounded-xl border border-[#cfdcc8] bg-white px-3 py-2 text-sm font-bold normal-case tracking-normal text-[#2d2a26] placeholder:text-[#2d2a26]/35 focus:outline-none focus:ring-2 focus:ring-[#8fb184]"
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
    <div className={`rounded-xl p-2 ${className}`}>
      <p className="text-[0.65rem] font-black uppercase tracking-[0.12em] opacity-60">
        {label}
      </p>
      <p className="text-sm font-black">{value}</p>
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

function semiFinishedSearchScore(recipe: Recipe, normalizedQuery: string) {
  if (!normalizedQuery) return 1;

  const queryWords = ingredientQueryWords(normalizedQuery);
  if (!queryWords.length) return 1;

  const haystack = [
    recipe.name,
    recipe.productGroup,
    recipe.batchSize,
    recipe.version,
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
    <div className="flex items-center justify-between gap-3 rounded-xl border border-[#d9e5d4] bg-white/80 p-2">
      <div className="min-w-0">
        <p className="truncate text-xs font-black sm:text-sm">{title}</p>
        <p className="text-[0.62rem] font-bold text-[#2d2a26]/45 sm:text-xs">{meta}</p>
      </div>
      <p className="shrink-0 text-xs font-black sm:text-sm">{value}</p>
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

function CheckIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2.4"
      viewBox="0 0 24 24"
    >
      <path d="M5 12.5l4.2 4.2L19 7" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2.4"
      viewBox="0 0 24 24"
    >
      <path d="M6 6l12 12" />
      <path d="M18 6L6 18" />
    </svg>
  );
}
