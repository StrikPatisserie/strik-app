"use client";

/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { strikIcons } from "../../StrikUI";
import { canAccessWeddingCakes, filterAllowedItems } from "../../lib/auth/access";
import type { UserProfile } from "../../lib/supabase/types";
import FactuurImport from "./FactuurImport";
import HalffabricatenList from "./HalffabricatenList";
import IngredientsList, { IngredientDetail } from "./IngredientsList";
import MargeOverzicht from "./MargeOverzicht";
import {
  ingredients,
  invoiceImports,
  packagingItems as defaultPackagingItems,
  recipes,
} from "./mockData";
import PackagingList from "./PackagingList";
import RecipeDetail from "./RecipeDetail";
import RecipeDataImport, { type ImportKind } from "./RecipeDataImport";
import RecipesList from "./RecipesList";
import RecepturenDashboard from "./RecepturenDashboard";
import RecepturenWorkMode from "./RecepturenWorkMode";
import { CakeVisualizer } from "../../bruidstaart-studio/BruidstaartStudioConfigurator";
import { cakeSizes } from "../../bruidstaart-studio/data";
import {
  calculateWeddingCakePrice,
  createProductionForm,
  findOption,
  formatEuro,
  getDecorationColorNotes,
  getDecorationNoteTexts,
  getDecorationSurcharges,
  getSelectedWeddingCakeLabels,
  getTopperNoteTexts,
  getTopperSurcharges,
} from "../../bruidstaart-studio/pricing";
import {
  getWeddingCakeStudioUrl,
  normalizeDraftList,
  type WeddingCakeDraft,
} from "../../bruidstaart-studio/studioApi";
import {
  emptyBakeryHomeData,
  fetchRecepturenData,
  pruneInvoiceImports,
  saveRecepturenData,
  type RecepturenData,
} from "./recepturenApi";
import type {
  BakeryHomeData,
  BakeryHomeNote,
  BakeryHomeOffer,
  HefeOrderHistoryEntry,
  Ingredient,
  InvoiceImport,
  InvoiceLine,
  ManualProductionPlanningItem,
  PackagingItem,
  ProductionLogEntry,
  ProductionRequest,
  Recipe,
  RecipeType,
  RecipeUnit,
} from "./types";
import { hefeIngredients } from "./hefeOrderData";
import {
  ingredientPackagePrice,
  normalizeSearch,
  normalizePackagePrice,
  normalizeProductionRequests,
  pricePerBaseUnitFromPackagePrice,
  productionLogForRecipe,
  quantityLabel,
  recalculateAllRecipeCosts,
  registerRecipeProduction,
  registerRecipeStockAdjustment,
  recipeBatchWeightKg,
  recipeCurrentMargin,
  recipeTypeLabel,
  syncRecipeProductionMetadata,
} from "./utils";

const beheerViewIds = [
  "dashboard",
  "voorpagina",
  "recepten",
  "halffabricaten",
  "ingredienten",
  "verpakkingen",
  "import",
  "factuurimport",
  "marge",
] as const;

type TabId = (typeof beheerViewIds)[number];
type MainTabId = "start" | "recepten" | "planning" | "beheer";
type BeheerView = TabId | "menu";
type RecepturenScope = "all" | "bakery" | "iceChocolate";

type RecepturenAppProps = {
  scope?: RecepturenScope;
  initialTab?: MainTabId;
  lockedTab?: MainTabId;
  hideTopNav?: boolean;
  initialBeheerView?: BeheerView;
  showProductionLinks?: boolean;
  profile?: UserProfile | null;
};

type PersonnelDashboardEvent = {
  id: string;
  type: "birthday" | "anniversary";
  employeeName: string;
  title: string;
  occurrenceDate: string;
  daysUntil: number;
  years?: number;
};

const importantDashboardJubileeYears = [5, 10, 12.5, 25, 40, 50] as const;

function mainTabForPath(pathname: string): MainTabId {
  if (pathname.startsWith("/bakkerij/management")) return "beheer";
  if (pathname.startsWith("/bakkerij/productieplanning")) return "planning";
  if (
    pathname.startsWith("/bakkerij/recepten") ||
    pathname.startsWith("/bakkerij/recepturen") ||
    pathname.startsWith("/bakkerij/ijs-chocolade/recepten")
  ) {
    return "recepten";
  }

  return "start";
}

function recipeMatchesScope(recipe: Recipe, scope: RecepturenScope) {
  if (scope === "all") return true;

  const group = normalizeSearch(recipe.productGroup);
  const isIceChocolate =
    group.includes("ijs") ||
    group.includes("choco") ||
    group.includes("chocolade") ||
    group.includes("bonbon");

  return scope === "iceChocolate" ? isIceChocolate : !isIceChocolate;
}

function hasStoredRecepturenData(data: RecepturenData) {
  return Boolean(
    data.ingredients.length ||
      data.recipes.length ||
      data.invoiceImports.length ||
      (data.packagingItems?.length || 0) ||
      (data.manualProductionPlanningItems?.length || 0)
  );
}

function hasMeaningfulInvoicePriceChange(line: InvoiceLine) {
  if (!line.oldPrice) return true;

  const absoluteChange = Math.abs(line.newPrice - line.oldPrice);
  const percentageChange = Math.abs(line.percentageChange);

  return absoluteChange >= 0.005 && percentageChange >= 0.1;
}

function reviewStatusForInvoiceLine(line: InvoiceLine) {
  if (!line.matchedIngredientId) return "pending" as const;

  return hasMeaningfulInvoicePriceChange(line) ? "pending" as const : "ignored" as const;
}

function invoiceStatusForLines(lines: InvoiceLine[]): InvoiceImport["status"] {
  if (lines.some((item) => item.reviewStatus === "pending")) return "review";
  if (lines.length && lines.every((item) => item.reviewStatus === "ignored")) {
    return "ignored";
  }
  if (lines.some((item) => item.reviewStatus === "reverted")) return "reverted";

  return "processed";
}

function normalizeInvoiceArticle(value: string) {
  return normalizeSearch(value).replace(/[^a-z0-9]/g, "").replace(/^0+/, "");
}

const invoiceMatchStopWords = new Set([
  "bak",
  "beker",
  "blik",
  "doos",
  "ds",
  "emmer",
  "fles",
  "g",
  "gr",
  "gram",
  "hk",
  "kg",
  "kilo",
  "kilogram",
  "l",
  "li",
  "liter",
  "ltr",
  "ml",
  "pak",
  "per",
  "st",
  "stuk",
  "stuks",
  "tray",
  "verpakt",
  "verse",
  "zak",
]);

const broadInvoiceMatchWords = new Set([
  "appel",
  "boter",
  "brood",
  "choco",
  "kaas",
  "melk",
  "room",
  "suiker",
]);

function invoiceMatchTokens(value: string) {
  return normalizeSearch(value)
    .replace(/(\d+)(kg|g|gr|gram|l|li|ltr|liter|ml|st|stuk|stuks)\b/g, " ")
    .split(/[^a-z0-9]+/g)
    .map((token) => token.trim())
    .filter((token) => token.length > 1 && !invoiceMatchStopWords.has(token));
}

function uniqueInvoiceTokens(value: string) {
  return Array.from(new Set(invoiceMatchTokens(value)));
}

function invoiceNameMatchScore(description: string, alias: string) {
  const descriptionTokens = uniqueInvoiceTokens(description);
  const aliasTokens = uniqueInvoiceTokens(alias);

  if (!descriptionTokens.length || !aliasTokens.length) return 0;

  const descriptionSet = new Set(descriptionTokens);
  const sharedTokens = aliasTokens.filter((token) => descriptionSet.has(token));
  if (!sharedTokens.length) return 0;

  if (aliasTokens.length === 1) {
    const [token] = aliasTokens;
    const exactDescription =
      descriptionTokens.length === 1 && descriptionTokens[0] === token;
    const distinctiveToken =
      token.length >= 6 && !broadInvoiceMatchWords.has(token);

    return exactDescription || distinctiveToken ? sharedTokens.length : 0;
  }

  const aliasCoverage = sharedTokens.length / aliasTokens.length;
  const descriptionCoverage = sharedTokens.length / descriptionTokens.length;

  if (
    sharedTokens.length >= 2 &&
    aliasCoverage >= 0.6 &&
    descriptionCoverage >= 0.45
  ) {
    return sharedTokens.length + aliasCoverage + descriptionCoverage;
  }

  return 0;
}

function invoiceLineMatchesIngredient(
  line: InvoiceLine,
  ingredient?: Ingredient
) {
  if (!ingredient) return false;

  const lineArticle = normalizeInvoiceArticle(line.articleNumber);
  const ingredientArticle = normalizeInvoiceArticle(
    ingredient.supplierArticleNumber
  );
  const articleMatches = Boolean(
    lineArticle && ingredientArticle && lineArticle === ingredientArticle
  );
  const articleMismatches = Boolean(
    lineArticle && ingredientArticle && lineArticle !== ingredientArticle
  );

  if (articleMatches) return true;
  if (articleMismatches) return false;

  return [ingredient.name, ...ingredient.aliases].some(
    (alias) => invoiceNameMatchScore(line.description, alias) > 0
  );
}

function normalizeInvoiceReviewStatuses(
  invoice: InvoiceImport,
  ingredientsForMatching: Ingredient[]
): InvoiceImport {
  const lines = invoice.lines.map((line) => {
    const matchedIngredient = line.matchedIngredientId
      ? ingredientsForMatching.find(
          (ingredient) => ingredient.id === line.matchedIngredientId
        )
      : undefined;
    const safeLine =
      line.matchedIngredientId &&
      !invoiceLineMatchesIngredient(line, matchedIngredient)
        ? {
            ...line,
            matchedIngredientId: undefined,
            oldPrice: 0,
            percentageChange: 0,
            reviewStatus: "pending" as const,
          }
        : line;

    return safeLine.reviewStatus === "pending"
      ? { ...safeLine, reviewStatus: reviewStatusForInvoiceLine(safeLine) }
      : safeLine;
  });

  return { ...invoice, lines, status: invoiceStatusForLines(lines) };
}

function sameInvoiceLine(item: InvoiceLine, selectedLine: InvoiceLine) {
  if (item.id || selectedLine.id) return item.id === selectedLine.id;

  return (
    item.articleNumber === selectedLine.articleNumber &&
    item.description === selectedLine.description &&
    item.quantity === selectedLine.quantity &&
    item.unit === selectedLine.unit &&
    item.totalPrice === selectedLine.totalPrice
  );
}

function replaceInvoiceLine(
  invoices: InvoiceImport[],
  invoiceId: string,
  line: InvoiceLine,
  changes: Partial<InvoiceLine>
): InvoiceImport[] {
  return invoices.map((invoice) => {
    if (invoice.id !== invoiceId) return invoice;

    const nextLines = invoice.lines.map((item) =>
      sameInvoiceLine(item, line)
        ? { ...item, ...changes }
        : item
    );

    return {
      ...invoice,
      status: invoiceStatusForLines(nextLines),
      lines: nextLines,
    };
  });
}

function invoiceLineRecipeUnit(line: InvoiceLine): RecipeUnit {
  const unit = line.unit.toLowerCase();
  const description = line.description.toLowerCase();
  const source = `${unit} ${description}`;

  if (/(kg|kilo|kilogram|g|gr|gram)/i.test(source)) return "gram";
  if (/(ml|liter|ltr|\bli\b|\bl\b)/i.test(source)) return "ml";

  return "stuk";
}

function invoiceLinePackageSize(line: InvoiceLine, recipeUnit: RecipeUnit) {
  const match = line.description.match(
    /(\d+(?:[.,]\d+)?)\s*(kg|kilo|kilogram|g|gr|gram|ml|liter|ltr|li|l|stuks|stuk|st)\b/i
  );

  if (match) {
    const amount = match[1].replace(".", ",");
    const rawUnit = match[2].toLowerCase();
    const unit =
      rawUnit === "kg" || rawUnit === "kilo" || rawUnit === "kilogram"
        ? "kg"
        : rawUnit === "g" || rawUnit === "gr" || rawUnit === "gram"
          ? "g"
          : rawUnit === "ml"
            ? "ml"
            : rawUnit === "liter" ||
                rawUnit === "ltr" ||
                rawUnit === "li" ||
                rawUnit === "l"
              ? "l"
              : "stuks";

    return `${amount} ${unit}`;
  }

  if (recipeUnit === "gram") return "1 kg";
  if (recipeUnit === "ml") return "1 l";

  return "1 stuk";
}

function sameSupplierArticle(
  ingredient: Ingredient,
  articleNumber: string,
  supplier: string
) {
  const normalizedArticle = articleNumber.replace(/^0+/, "").trim();
  if (!normalizedArticle) return false;

  return (
    ingredient.supplierArticleNumber.replace(/^0+/, "").trim() ===
      normalizedArticle &&
    (!supplier ||
      normalizeSearch(ingredient.supplier) === normalizeSearch(supplier))
  );
}

function mergeRecipeIngredientLines(lines: Recipe["ingredients"]) {
  const mergedLines: Recipe["ingredients"] = [];

  lines.forEach((line) => {
    const existingLine = mergedLines.find(
      (item) =>
        item.ingredientId === line.ingredientId &&
        item.unit === line.unit &&
        (item.wastePercentage || 0) === (line.wastePercentage || 0)
    );

    if (existingLine) {
      existingLine.quantity += line.quantity;
      existingLine.costContribution += line.costContribution;
      return;
    }

    mergedLines.push({ ...line });
  });

  return mergedLines;
}

function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function dateFromKey(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return new Date();

  return new Date(year, month - 1, day);
}

function addDays(value: string, days: number) {
  const date = dateFromKey(value);
  date.setDate(date.getDate() + days);

  return dateKey(date);
}

function weekStartForDate(date = new Date()) {
  const nextDate = new Date(date);
  const day = nextDate.getDay() || 7;
  nextDate.setHours(0, 0, 0, 0);
  nextDate.setDate(nextDate.getDate() - day + 1);

  return dateKey(nextDate);
}

function formatWeekRange(weekStart: string) {
  const start = dateFromKey(weekStart);
  const end = dateFromKey(addDays(weekStart, 6));
  const formatter = new Intl.DateTimeFormat("nl-NL", {
    day: "numeric",
    month: "long",
  });

  return `${formatter.format(start)} t/m ${formatter.format(end)}`;
}

function formatBakeryDate(value?: string, fallback = "geen datum") {
  if (!value) return fallback;

  const date = dateFromKey(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("nl-NL", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  }).format(date);
}

function formatShortBakeryDate(value?: string) {
  if (!value) return "";

  const date = dateFromKey(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("nl-NL", {
    day: "numeric",
    month: "long",
  }).format(date);
}

function eventDaysLabel(daysUntil: number) {
  if (daysUntil === 0) return "vandaag";
  if (daysUntil === 1) return "morgen";

  return `over ${daysUntil} dagen`;
}

function formatPersonnelYears(years: number) {
  return Number.isInteger(years) ? String(years) : String(years).replace(".", ",");
}

function isImportantDashboardJubilee(years: number | undefined) {
  return typeof years === "number"
    ? importantDashboardJubileeYears.some(
        (importantYear) => Math.abs(importantYear - years) < 0.01
      )
    : false;
}

function personnelDashboardEventText(event: PersonnelDashboardEvent) {
  if (event.type === "anniversary") {
    return `${event.employeeName} ${
      event.years ? `${formatPersonnelYears(event.years)} jaar` : "jubileum"
    }`;
  }

  return `${event.employeeName} jarig`;
}

function getWeddingCakeDeliveryDate(draft: WeddingCakeDraft) {
  return draft.config.contact.deliveryDate || draft.config.contact.weddingDate || "";
}

function uniqueWeddingCakeDrafts(drafts: WeddingCakeDraft[]) {
  const draftsByCode = new Map<string, WeddingCakeDraft>();

  drafts.forEach((draft) => {
    const key = draft.code.trim().toLowerCase();
    if (!key) return;

    const existing = draftsByCode.get(key);
    if (!existing || draft.updatedAt > existing.updatedAt) {
      draftsByCode.set(key, draft);
    }
  });

  return Array.from(draftsByCode.values()).sort((first, second) => {
    const dateCompare = getWeddingCakeDeliveryDate(first).localeCompare(
      getWeddingCakeDeliveryDate(second)
    );

    if (dateCompare) return dateCompare;

    return first.code.localeCompare(second.code, "nl-NL");
  });
}

function weekDatesFor(weekStart: string) {
  return Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
}

function weddingCakeCustomerName(draft: WeddingCakeDraft) {
  const name = [draft.config.contact.names, draft.config.contact.surname]
    .filter(Boolean)
    .join(" ")
    .trim();

  return name || [draft.names, draft.surname].filter(Boolean).join(" ").trim();
}

function normalizeBakeryHomeData(value?: BakeryHomeData): BakeryHomeData {
  return {
    notes: Array.isArray(value?.notes) ? value.notes : [],
    offers: Array.isArray(value?.offers) ? value.offers : [],
  };
}

function createBlankHomeNote(): BakeryHomeNote {
  return {
    id: `note-${Date.now()}`,
    text: "",
    updatedAt: new Date().toISOString(),
  };
}

function offerForWeek(home: BakeryHomeData, weekStart: string) {
  return home.offers.find((offer) => offer.weekStart === weekStart);
}

function clampOfferWeekCount(value: number) {
  if (!Number.isFinite(value)) return 1;

  return Math.max(1, Math.min(4, Math.round(value)));
}

export default function RecepturenApp({
  scope = "all",
  initialTab,
  lockedTab,
  hideTopNav = false,
  initialBeheerView = "menu",
  showProductionLinks = false,
  profile = null,
}: Readonly<RecepturenAppProps> = {}) {
  const pathname = usePathname();
  const [mainTab, setMainTab] = useState<MainTabId>(() =>
    lockedTab || initialTab || mainTabForPath(pathname)
  );
  const [beheerView, setBeheerView] =
    useState<BeheerView>(initialBeheerView);
  const [importKind, setImportKind] = useState<ImportKind>("recipes");
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [recipeEditorStartsOpen, setRecipeEditorStartsOpen] = useState(false);
  const [, setRecipeNavigationStack] = useState<string[]>([]);
  const [recipeItems, setRecipeItems] = useState(recipes);
  const [ingredientItems, setIngredientItems] = useState(() =>
    mergeHefeSeedIngredients(ingredients)
  );
  const [invoiceIngredientEditor, setInvoiceIngredientEditor] =
    useState<Ingredient | null>(null);
  const [packagingItems, setPackagingItems] = useState(defaultPackagingItems);
  const [invoiceItems, setInvoiceItems] = useState(invoiceImports);
  const [hefeOrderHistory, setHefeOrderHistory] = useState<
    HefeOrderHistoryEntry[]
  >([]);
  const [manualPlanningItems, setManualPlanningItems] = useState<
    ManualProductionPlanningItem[]
  >([]);
  const [bakeryHome, setBakeryHome] =
    useState<BakeryHomeData>(emptyBakeryHomeData);
  const [selectedOfferWeek, setSelectedOfferWeek] = useState(weekStartForDate);
  const [bakeryHomeStatus, setBakeryHomeStatus] = useState("");
  const [offerUploadStatus, setOfferUploadStatus] = useState("");
  const [syncStatus, setSyncStatus] = useState("Lokale receptuurdata geladen.");
  const [isLoadingData, setIsLoadingData] = useState(true);
  const latestInvoice = invoiceItems[0] || invoiceImports[0];
  const scopedRecipeItems = useMemo(
    () => recipeItems.filter((recipe) => recipeMatchesScope(recipe, scope)),
    [recipeItems, scope]
  );

  function persistRecepturenData(
    nextData: RecepturenData,
    successMessage = "Recepturen opgeslagen in WordPress."
  ) {
    const completeData: RecepturenData = {
      ...nextData,
      packagingItems: nextData.packagingItems ?? packagingItems,
      hefeOrderHistory: nextData.hefeOrderHistory ?? hefeOrderHistory,
      bakeryHome: nextData.bakeryHome ?? bakeryHome,
      manualProductionPlanningItems:
        nextData.manualProductionPlanningItems ?? manualPlanningItems,
    };

    setSyncStatus("Opslaan naar WordPress...");

    void saveRecepturenData(completeData).then((result) => {
      setSyncStatus(
        result.ok ? successMessage : `Lokaal bijgewerkt. ${result.message}`
      );
    });
  }

  function persistBakeryHome(
    nextHome: BakeryHomeData,
    successMessage = "Bakkerij voorpagina opgeslagen."
  ) {
    const normalizedHome = normalizeBakeryHomeData(nextHome);

    setBakeryHome(normalizedHome);
    setBakeryHomeStatus("Opslaan naar WordPress...");

    void saveRecepturenData({
      ingredients: ingredientItems,
      recipes: recipeItems,
      packagingItems,
      invoiceImports: invoiceItems,
      hefeOrderHistory,
      bakeryHome: normalizedHome,
      manualProductionPlanningItems: manualPlanningItems,
    }).then((result) => {
      const message = result.ok ? successMessage : `Lokaal bijgewerkt. ${result.message}`;
      setBakeryHomeStatus(message);
      setSyncStatus(message);
    });
  }

  function persistBakeryHomeUpdate(
    update: (current: BakeryHomeData) => BakeryHomeData,
    successMessage = "Bakkerij voorpagina opgeslagen."
  ) {
    setBakeryHome((current) => {
      const normalizedHome = normalizeBakeryHomeData(update(current));

      setBakeryHomeStatus("Opslaan naar WordPress...");
      void saveRecepturenData({
        ingredients: ingredientItems,
        recipes: recipeItems,
        packagingItems,
        invoiceImports: invoiceItems,
        hefeOrderHistory,
        bakeryHome: normalizedHome,
        manualProductionPlanningItems: manualPlanningItems,
      }).then((result) => {
        const message = result.ok
          ? successMessage
          : `Lokaal bijgewerkt. ${result.message}`;
        setBakeryHomeStatus(message);
        setSyncStatus(message);
      });

      return normalizedHome;
    });
  }

  function syncSelectedRecipe(nextRecipes: Recipe[]) {
    setSelectedRecipe((current) =>
      current ? nextRecipes.find((recipe) => recipe.id === current.id) || current : null
    );
  }

  function recalculateRecipesWithIngredients(
    nextIngredients: Ingredient[],
    nextInvoices: InvoiceImport[] = invoiceItems,
    successMessage = "Alle kostprijzen opnieuw berekend en opgeslagen."
  ) {
    const nextRecipes = recalculateAllRecipeCosts(
      recipeItems,
      nextIngredients,
      {
        markAsUpdated: true,
      },
      packagingItems
    );

    setIngredientItems(nextIngredients);
    setInvoiceItems(nextInvoices);
    setRecipeItems(nextRecipes);
    syncSelectedRecipe(nextRecipes);
    persistRecepturenData(
      {
        ingredients: nextIngredients,
        recipes: nextRecipes,
        invoiceImports: nextInvoices,
      },
      successMessage
    );

    return nextRecipes;
  }

  function recalculateAllRecipes() {
    recalculateRecipesWithIngredients(ingredientItems);
  }

  useEffect(() => {
    let ignoreResult = false;

    async function loadRecepturenData() {
      setIsLoadingData(true);

      const result = await fetchRecepturenData();
      if (ignoreResult) return;

      if (result.ok && hasStoredRecepturenData(result.data)) {
        const loadedIngredients = result.data.ingredients.length
          ? mergeHefeSeedIngredients(result.data.ingredients)
          : mergeHefeSeedIngredients(ingredients);
        const loadedInvoices = result.data.invoiceImports.length
          ? result.data.invoiceImports
          : invoiceImports;
        const loadedRecipes = (
          result.data.recipes.length ? result.data.recipes : recipes
        ).map(syncRecipeProductionMetadata);

        setIngredientItems(loadedIngredients);
        setRecipeItems(loadedRecipes);
        setPackagingItems(
          Array.isArray(result.data.packagingItems)
            ? result.data.packagingItems
            : defaultPackagingItems
        );
        setInvoiceItems(
          loadedInvoices.map((invoice) =>
            normalizeInvoiceReviewStatuses(invoice, loadedIngredients)
          )
        );
        setHefeOrderHistory(result.data.hefeOrderHistory || []);
        setBakeryHome(normalizeBakeryHomeData(result.data.bakeryHome));
        setManualPlanningItems(result.data.manualProductionPlanningItems || []);
        setSyncStatus("Recepturen uit WordPress geladen.");
      } else if (result.ok) {
        setHefeOrderHistory(result.data.hefeOrderHistory || []);
        setBakeryHome(normalizeBakeryHomeData(result.data.bakeryHome));
        setManualPlanningItems(result.data.manualProductionPlanningItems || []);
        setSyncStatus(
          "Lokale startdata geladen. Eerste wijziging wordt in WordPress opgeslagen."
        );
      } else {
        setSyncStatus(`Lokale startdata geladen. ${result.message}`);
      }

      setIsLoadingData(false);
    }

    void loadRecepturenData();

    return () => {
      ignoreResult = true;
    };
  }, []);

  function saveRecipe(updatedRecipe: Recipe) {
    const exists = recipeItems.some((recipe) => recipe.id === updatedRecipe.id);
    const nextRecipes = exists
      ? recipeItems.map((recipe) =>
          recipe.id === updatedRecipe.id ? updatedRecipe : recipe
        )
      : [updatedRecipe, ...recipeItems];
    const recalculatedRecipes = recalculateAllRecipeCosts(
      nextRecipes,
      ingredientItems,
      { markAsUpdated: true },
      packagingItems
    );

    setRecipeItems(recalculatedRecipes);
    setSelectedRecipe((current) =>
      current?.id === updatedRecipe.id
        ? recalculatedRecipes.find((recipe) => recipe.id === updatedRecipe.id) ||
          updatedRecipe
        : current
    );
    setRecipeEditorStartsOpen(false);
    persistRecepturenData({
      ingredients: ingredientItems,
      recipes: recalculatedRecipes,
      invoiceImports: invoiceItems,
    });
  }

  function deleteRecipe(recipeToDelete: Recipe) {
    const nextRecipes = recipeItems
      .filter((recipe) => recipe.id !== recipeToDelete.id)
      .map((recipe) => ({
        ...recipe,
        semiFinishedItems: recipe.semiFinishedItems.filter(
          (item) => item.semiFinishedRecipeId !== recipeToDelete.id
        ),
        linkedFinalProductIds: recipe.linkedFinalProductIds?.filter(
          (id) => id !== recipeToDelete.id
        ),
      }));
    const recalculatedRecipes = recalculateAllRecipeCosts(
      nextRecipes,
      ingredientItems,
      { markAsUpdated: true },
      packagingItems
    );

    setRecipeItems(recalculatedRecipes);
    setSelectedRecipe(null);
    setRecipeEditorStartsOpen(false);
    setRecipeNavigationStack([]);
    persistRecepturenData(
      {
        ingredients: ingredientItems,
        recipes: recalculatedRecipes,
        invoiceImports: invoiceItems,
      },
      "Recept verwijderd en kostprijzen opnieuw berekend."
    );
  }

  function markRecipeProduced(
    recipeToProduce: Recipe,
    quantity: number,
    requestId?: string,
    date?: string
  ) {
    const producedAt = date ? localDateFromInput(date) : new Date();
    const nextRecipes = recipeItems.map((recipe) => {
      if (recipe.id !== recipeToProduce.id) return recipe;

      const recipeWithRequestClosed = requestId
        ? {
            ...recipe,
            productionRequests: recipe.productionRequests?.map((request) =>
              request.id === requestId
                ? { ...request, status: "done" as const }
                : request
            ),
          }
        : recipe;

      return registerRecipeProduction(recipeWithRequestClosed, quantity, producedAt);
    });

    setRecipeItems(nextRecipes);
    syncSelectedRecipe(nextRecipes);
    persistRecepturenData(
      {
        ingredients: ingredientItems,
        recipes: nextRecipes,
        invoiceImports: invoiceItems,
      },
      `${recipeToProduce.name} staat als gemaakt geregistreerd.`
    );
  }

  function planRecipeProduction(
    recipeToPlan: Recipe,
    quantity: number,
    date: string,
    reason?: string
  ) {
    const cleanDate = date.trim();
    const cleanQuantity = Math.max(0, quantity);

    if (!cleanDate || cleanQuantity <= 0) {
      persistRecepturenData(
        {
          ingredients: ingredientItems,
          recipes: recipeItems,
          invoiceImports: invoiceItems,
        },
        "Vul een datum en hoeveelheid in om productie te plannen."
      );
      return;
    }

    const request: ProductionRequest = {
      id: createRecepturenLocalId("request"),
      date: cleanDate,
      quantity: cleanQuantity,
      reason: reason?.trim() || "Handmatige weekplanning",
      status: "open",
    };
    const nextRecipes = recipeItems.map((recipe) =>
      recipe.id === recipeToPlan.id
        ? {
            ...recipe,
            productionRequests: normalizeProductionRequests([
              request,
              ...(recipe.productionRequests || []),
            ]),
          }
        : recipe
    );

    setRecipeItems(nextRecipes);
    syncSelectedRecipe(nextRecipes);
    persistRecepturenData(
      {
        ingredients: ingredientItems,
        recipes: nextRecipes,
        invoiceImports: invoiceItems,
      },
      `${recipeToPlan.name} is toegevoegd aan de weekplanning.`
    );
  }

  function deleteRecipeProductionRequest(
    recipeToUpdate: Recipe,
    requestId: string
  ) {
    const nextRecipes = recipeItems.map((recipe) =>
      recipe.id === recipeToUpdate.id
        ? {
            ...recipe,
            productionRequests: (recipe.productionRequests || []).filter(
              (request) => request.id !== requestId
            ),
          }
        : recipe
    );

    setRecipeItems(nextRecipes);
    syncSelectedRecipe(nextRecipes);
    persistRecepturenData(
      {
        ingredients: ingredientItems,
        recipes: nextRecipes,
        invoiceImports: invoiceItems,
      },
      `${recipeToUpdate.name} is uit de weekplanning gehaald.`
    );
  }

  function persistManualPlanningItems(
    nextItems: ManualProductionPlanningItem[],
    successMessage: string
  ) {
    setManualPlanningItems(nextItems);
    persistRecepturenData(
      {
        ingredients: ingredientItems,
        recipes: recipeItems,
        invoiceImports: invoiceItems,
        manualProductionPlanningItems: nextItems,
      },
      successMessage
    );
  }

  function planManualProductionItem(
    title: string,
    quantity: number,
    unit: string,
    date: string,
    note?: string
  ) {
    const cleanTitle = title.trim();
    const cleanDate = date.trim();
    const cleanQuantity = Math.max(0, quantity);

    if (!cleanTitle || !cleanDate || cleanQuantity <= 0) {
      persistRecepturenData(
        {
          ingredients: ingredientItems,
          recipes: recipeItems,
          invoiceImports: invoiceItems,
          manualProductionPlanningItems: manualPlanningItems,
        },
        "Vul een product, datum en hoeveelheid in om productie te plannen."
      );
      return;
    }

    const item: ManualProductionPlanningItem = {
      id: createRecepturenLocalId("manual-plan"),
      date: cleanDate,
      title: cleanTitle,
      quantity: cleanQuantity,
      unit: unit.trim() || "stuks",
      note: note?.trim() || "Handmatige weekplanning",
      status: "open",
      createdAt: new Date().toISOString(),
    };

    persistManualPlanningItems(
      [item, ...manualPlanningItems],
      `${cleanTitle} is toegevoegd aan de weekplanning.`
    );
  }

  function markManualPlanningItemDone(itemId: string) {
    const item = manualPlanningItems.find((current) => current.id === itemId);
    const nextItems = manualPlanningItems.map((current) =>
      current.id === itemId
        ? {
            ...current,
            status: "done" as const,
            completedAt: current.completedAt || current.date,
          }
        : current
    );

    persistManualPlanningItems(
      nextItems,
      `${item?.title || "Planningregel"} is afgevinkt.`
    );
  }

  function deleteManualPlanningItem(itemId: string) {
    const item = manualPlanningItems.find((current) => current.id === itemId);
    const nextItems = manualPlanningItems.filter(
      (current) => current.id !== itemId
    );

    persistManualPlanningItems(
      nextItems,
      `${item?.title || "Planningregel"} is uit de weekplanning gehaald.`
    );
  }

  function adjustRecipeStock(recipeToAdjust: Recipe, quantity: number, date: string) {
    const adjustedAt = date ? localDateFromInput(date) : new Date();
    const nextRecipes = recipeItems.map((recipe) =>
      recipe.id === recipeToAdjust.id
        ? registerRecipeStockAdjustment(recipe, quantity, adjustedAt)
        : recipe
    );

    setRecipeItems(nextRecipes);
    syncSelectedRecipe(nextRecipes);
    persistRecepturenData(
      {
        ingredients: ingredientItems,
        recipes: nextRecipes,
        invoiceImports: invoiceItems,
      },
      `${recipeToAdjust.name} voorraad aangepast.`
    );
  }

  function updateProductionLogEntry(
    recipeToUpdate: Recipe,
    entryId: string,
    changes: Partial<Pick<ProductionLogEntry, "date" | "quantity" | "note">>
  ) {
    const nextRecipes = recipeItems.map((recipe) => {
      if (recipe.id !== recipeToUpdate.id) return recipe;

      return syncRecipeProductionMetadata({
        ...recipe,
        productionLog: (recipe.productionLog || []).map((entry) =>
          entry.id === entryId
            ? {
                ...entry,
                ...changes,
                quantity:
                  changes.quantity !== undefined
                    ? Math.max(0, changes.quantity)
                    : entry.quantity,
              }
            : entry
        ),
      });
    });

    setRecipeItems(nextRecipes);
    syncSelectedRecipe(nextRecipes);
    persistRecepturenData(
      {
        ingredients: ingredientItems,
        recipes: nextRecipes,
        invoiceImports: invoiceItems,
      },
      "Productieregistratie aangepast."
    );
  }

  function deleteProductionLogEntry(recipeToUpdate: Recipe, entryId: string) {
    const nextRecipes = recipeItems.map((recipe) => {
      if (recipe.id !== recipeToUpdate.id) return recipe;

      return syncRecipeProductionMetadata({
        ...recipe,
        productionLog: (recipe.productionLog || []).filter(
          (entry) => entry.id !== entryId
        ),
      });
    });

    setRecipeItems(nextRecipes);
    syncSelectedRecipe(nextRecipes);
    persistRecepturenData(
      {
        ingredients: ingredientItems,
        recipes: nextRecipes,
        invoiceImports: invoiceItems,
      },
      "Productieregistratie verwijderd."
    );
  }

  function openRecipe(
    recipe: Recipe,
    options: { fromRecipeId?: string } = {}
  ) {
    setRecipeEditorStartsOpen(false);
    setRecipeNavigationStack((current) =>
      options.fromRecipeId ? [...current, options.fromRecipeId] : []
    );
    setSelectedRecipe(recipe);
  }

  function closeSelectedRecipe() {
    setRecipeEditorStartsOpen(false);
    setRecipeNavigationStack((current) => {
      const previousRecipeId = current[current.length - 1];

      if (!previousRecipeId) {
        setSelectedRecipe(null);
        return [];
      }

      setSelectedRecipe(
        recipeItems.find((recipe) => recipe.id === previousRecipeId) || null
      );

      return current.slice(0, -1);
    });
  }

  function createRecipe(type: RecipeType) {
    const blankRecipe = createBlankRecipe(type);

    if (scope === "iceChocolate") {
      blankRecipe.productGroup = "IJs";
      blankRecipe.workCategories = ["IJs"];
      blankRecipe.photoHint = type === "semiFinished" ? "" : "Nieuw ijsrecept";
    }

    setRecipeEditorStartsOpen(true);
    setRecipeNavigationStack([]);
    setSelectedRecipe(blankRecipe);
  }

  function duplicateRecipe(recipeToDuplicate: Recipe) {
    const now = new Date().toISOString().slice(0, 10);
    const idPrefix =
      recipeToDuplicate.type === "semiFinished" ? "hf-new" : "recipe-new";
    const duplicate: Recipe = {
      ...recipeToDuplicate,
      id: uniqueNewRecipeId(idPrefix, recipeItems),
      name: `${recipeToDuplicate.name} kopie`,
      createdAt: now,
      lastUpdated: now,
      previousCostPrice: recipeToDuplicate.costPrice,
      ingredients: recipeToDuplicate.ingredients.map((line, index) => ({
        ...line,
        sortOrder: Number.isFinite(line.sortOrder)
          ? line.sortOrder
          : index,
      })),
      semiFinishedItems: recipeToDuplicate.semiFinishedItems.map(
        (line, index) => ({
          ...line,
          sortOrder: Number.isFinite(line.sortOrder)
            ? line.sortOrder
            : recipeToDuplicate.ingredients.length + index,
        })
      ),
      packagingItems: (recipeToDuplicate.packagingItems || []).map((line) => ({
        ...line,
      })),
      linkedFinalProductIds: [],
      lastProducedAt: "",
      lastProducedQuantity: 0,
      productionLog: [],
      productionRequests: [],
    };
    const nextRecipes = recalculateAllRecipeCosts(
      [duplicate, ...recipeItems],
      ingredientItems,
      { markAsUpdated: true },
      packagingItems
    );
    const nextDuplicate =
      nextRecipes.find((recipe) => recipe.id === duplicate.id) || duplicate;

    setRecipeItems(nextRecipes);
    setSelectedRecipe(nextDuplicate);
    setRecipeEditorStartsOpen(true);
    setRecipeNavigationStack([]);
    persistRecepturenData(
      {
        ingredients: ingredientItems,
        recipes: nextRecipes,
        invoiceImports: invoiceItems,
      },
      "Recept gedupliceerd en opgeslagen."
    );
  }

  function saveIngredient(updatedIngredient: Ingredient) {
    const exists = ingredientItems.some(
      (ingredient) => ingredient.id === updatedIngredient.id
    );
    const nextIngredients = exists
      ? ingredientItems.map((ingredient) =>
          ingredient.id === updatedIngredient.id
            ? updatedIngredient
            : ingredient
        )
      : [updatedIngredient, ...ingredientItems];

    recalculateRecipesWithIngredients(
      nextIngredients,
      invoiceItems,
      "Ingredient opgeslagen en kostprijzen opnieuw berekend."
    );
    setInvoiceIngredientEditor((current) =>
      current?.id === updatedIngredient.id ? updatedIngredient : current
    );
  }

  function saveIngredients(
    updatedIngredients: Ingredient[],
    successMessage = "Grondstoffen opgeslagen en kostprijzen opnieuw berekend."
  ) {
    if (!updatedIngredients.length) return;

    const nextIngredients = mergeIngredients(ingredientItems, updatedIngredients);

    recalculateRecipesWithIngredients(
      nextIngredients,
      invoiceItems,
      successMessage
    );
  }

  function deleteIngredients(
    ingredientsToDelete: Ingredient[],
    successMessage?: string
  ) {
    const deleteIds = new Set(ingredientsToDelete.map((ingredient) => ingredient.id));
    if (!deleteIds.size) return;

    const nextIngredients = ingredientItems.filter(
      (ingredient) => !deleteIds.has(ingredient.id)
    );
    const recipesWithoutDeletedIngredients = recipeItems.map((recipe) => ({
      ...recipe,
      ingredients: recipe.ingredients.filter(
        (line) => !deleteIds.has(line.ingredientId)
      ),
    }));
    const nextRecipes = recalculateAllRecipeCosts(
      recipesWithoutDeletedIngredients,
      nextIngredients,
      { markAsUpdated: true },
      packagingItems
    );
    const nextInvoices = invoiceItems.map((invoice) => {
      const lines = invoice.lines.map((line) =>
        line.matchedIngredientId && deleteIds.has(line.matchedIngredientId)
          ? { ...line, matchedIngredientId: undefined }
          : line
      );

      return {
        ...invoice,
        status: invoiceStatusForLines(lines),
        lines,
      };
    });

    setIngredientItems(nextIngredients);
    setRecipeItems(nextRecipes);
    setInvoiceItems(nextInvoices);
    syncSelectedRecipe(nextRecipes);
    persistRecepturenData(
      {
        ingredients: nextIngredients,
        recipes: nextRecipes,
        invoiceImports: nextInvoices,
      },
      successMessage ||
        `${ingredientsToDelete.length} grondstof${
          ingredientsToDelete.length === 1 ? "" : "fen"
        } verwijderd en kostprijzen opnieuw berekend.`
    );
  }

  function deleteIngredient(ingredient: Ingredient) {
    deleteIngredients([ingredient], `${ingredient.name} verwijderd.`);
  }

  function mergeDuplicateIngredient(
    sourceIngredient: Ingredient,
    targetIngredient: Ingredient
  ) {
    if (sourceIngredient.id === targetIngredient.id) return;

    const source = ingredientItems.find(
      (ingredient) => ingredient.id === sourceIngredient.id
    );
    const target = ingredientItems.find(
      (ingredient) => ingredient.id === targetIngredient.id
    );

    if (!source || !target) return;

    const aliasByKey = new Map<string, string>();
    [
      ...target.aliases,
      source.name,
      source.supplierArticleNumber,
      ...source.aliases,
    ].forEach((alias) => {
      const cleanAlias = alias.trim();
      const key = normalizeSearch(cleanAlias);

      if (cleanAlias && key && key !== normalizeSearch(target.name)) {
        aliasByKey.set(key, cleanAlias);
      }
    });

    const mergedTarget: Ingredient = {
      ...target,
      aliases: Array.from(aliasByKey.values()),
      lastUpdated: new Date().toISOString().slice(0, 10),
    };
    const nextIngredients = ingredientItems
      .map((ingredient) =>
        ingredient.id === target.id ? mergedTarget : ingredient
      )
      .filter((ingredient) => ingredient.id !== source.id);
    const recipesWithMergedIngredient = recipeItems.map((recipe) => ({
      ...recipe,
      ingredients: mergeRecipeIngredientLines(
        recipe.ingredients.map((line) =>
          line.ingredientId === source.id
            ? { ...line, ingredientId: target.id }
            : line
        )
      ),
    }));
    const nextRecipes = recalculateAllRecipeCosts(
      recipesWithMergedIngredient,
      nextIngredients,
      { markAsUpdated: true },
      packagingItems
    );
    const nextInvoices = invoiceItems.map((invoice) => ({
      ...invoice,
      lines: invoice.lines.map((line) =>
        line.matchedIngredientId === source.id
          ? { ...line, matchedIngredientId: target.id }
          : line
      ),
    }));

    setIngredientItems(nextIngredients);
    setRecipeItems(nextRecipes);
    setInvoiceItems(nextInvoices);
    syncSelectedRecipe(nextRecipes);
    persistRecepturenData(
      {
        ingredients: nextIngredients,
        recipes: nextRecipes,
        invoiceImports: nextInvoices,
      },
      `${source.name} samengevoegd met ${target.name}.`
    );
  }

  function updateInvoiceLine(
    invoiceId: string,
    line: InvoiceLine,
    changes: Partial<InvoiceLine>
  ) {
    const nextInvoices = replaceInvoiceLine(invoiceItems, invoiceId, line, changes);

    setInvoiceItems(nextInvoices);
    persistRecepturenData({
      ingredients: ingredientItems,
      recipes: recipeItems,
      invoiceImports: nextInvoices,
    });
  }

  function approveInvoiceLine(invoiceId: string, line: InvoiceLine) {
    const invoice = invoiceItems.find((item) => item.id === invoiceId);
    const currentIngredient = line.matchedIngredientId
      ? ingredientItems.find((ingredient) => ingredient.id === line.matchedIngredientId)
      : undefined;
    const nextInvoices = replaceInvoiceLine(invoiceItems, invoiceId, line, {
      reviewStatus: "approved",
      previousLastInvoice: currentIngredient?.lastInvoice,
      appliedAt: new Date().toISOString(),
    });

    if (!line.matchedIngredientId) {
      setInvoiceItems(nextInvoices);
      persistRecepturenData(
        {
          ingredients: ingredientItems,
          recipes: recipeItems,
          invoiceImports: nextInvoices,
        },
        "Factuurregel goedgekeurd en opgeslagen."
      );
      return;
    }

    const nextIngredients = ingredientItems.map((ingredient) => {
      if (ingredient.id !== line.matchedIngredientId) return ingredient;

      const nextPackagePrice = normalizePackagePrice(
        line.newPrice,
        ingredient.recipeUnit
      );

      return {
        ...ingredient,
        previousPrice: ingredientPackagePrice(ingredient),
        lastPrice: nextPackagePrice,
        pricePerBaseUnit: pricePerBaseUnitFromPackagePrice(
          nextPackagePrice,
          ingredient.recipeUnit
        ),
        lastUpdated: new Date().toISOString().slice(0, 10),
        lastInvoice: invoice?.invoiceNumber || ingredient.lastInvoice,
      };
    });

    recalculateRecipesWithIngredients(
      nextIngredients,
      nextInvoices,
      "Prijsupdate goedgekeurd en alle kostprijzen herberekend."
    );
  }

  function ignoreInvoiceLine(invoiceId: string, line: InvoiceLine) {
    updateInvoiceLine(invoiceId, line, { reviewStatus: "ignored" });
  }

  function ignoreInvoice(invoiceId: string) {
    const invoice = invoiceItems.find((item) => item.id === invoiceId);
    if (!invoice) return;

    const hasApprovedLines = invoice.lines.some(
      (line) => line.reviewStatus === "approved"
    );
    const confirmed = window.confirm(
      hasApprovedLines
        ? "Deze factuur heeft al goedgekeurde regels. Niet-goedgekeurde regels negeren? Gebruik terugdraaien om goedgekeurde prijsupdates terug te zetten."
        : "Hele factuur negeren? Er worden geen ingredientprijzen aangepast."
    );

    if (!confirmed) return;

    const nextInvoices = invoiceItems.map((item) => {
      if (item.id !== invoiceId) return item;

      const lines = item.lines.map((line) =>
        line.reviewStatus === "approved"
          ? line
          : { ...line, reviewStatus: "ignored" as const }
      );

      return {
        ...item,
        status: invoiceStatusForLines(lines),
        lines,
      };
    });

    setInvoiceItems(nextInvoices);
    persistRecepturenData(
      {
        ingredients: ingredientItems,
        recipes: recipeItems,
        invoiceImports: nextInvoices,
      },
      "Factuur genegeerd en opgeslagen."
    );
  }

  function revertInvoice(invoiceId: string) {
    const invoice = invoiceItems.find((item) => item.id === invoiceId);
    if (!invoice) return;

    const approvedLines = invoice.lines.filter(
      (line) => line.reviewStatus === "approved" && line.matchedIngredientId
    );
    if (!approvedLines.length) return;

    const confirmed = window.confirm(
      `Prijsupdates uit factuur ${invoice.invoiceNumber} terugdraaien? ${approvedLines.length} gekoppelde ingredientprijzen worden teruggezet naar hun oude prijs.`
    );

    if (!confirmed) return;

    const revertedAt = new Date().toISOString();
    const revertLinesByIngredient = new Map<string, InvoiceLine>();
    approvedLines.forEach((line) => {
      if (!line.matchedIngredientId || !line.oldPrice) return;
      if (!revertLinesByIngredient.has(line.matchedIngredientId)) {
        revertLinesByIngredient.set(line.matchedIngredientId, line);
      }
    });

    const nextIngredients = ingredientItems.map((ingredient) => {
      const line = revertLinesByIngredient.get(ingredient.id);
      if (!line) return ingredient;

      const currentPackagePrice = ingredientPackagePrice(ingredient);
      const restoredPackagePrice = normalizePackagePrice(
        line.oldPrice,
        ingredient.recipeUnit
      );

      return {
        ...ingredient,
        previousPrice: currentPackagePrice,
        lastPrice: restoredPackagePrice,
        pricePerBaseUnit: pricePerBaseUnitFromPackagePrice(
          restoredPackagePrice,
          ingredient.recipeUnit
        ),
        lastUpdated: revertedAt.slice(0, 10),
        lastInvoice:
          line.previousLastInvoice ||
          `Teruggedraaid: ${invoice.invoiceNumber}`,
      };
    });

    const nextInvoices = invoiceItems.map((item) => {
      if (item.id !== invoiceId) return item;

      const lines = item.lines.map((line) => {
        if (line.reviewStatus === "approved") {
          return { ...line, reviewStatus: "reverted" as const, revertedAt };
        }

        return line.reviewStatus === "pending"
          ? { ...line, reviewStatus: "ignored" as const }
          : line;
      });

      return {
        ...item,
        status: "reverted" as const,
        lines,
      };
    });

    recalculateRecipesWithIngredients(
      nextIngredients,
      nextInvoices,
      "Factuur teruggedraaid en kostprijzen opnieuw berekend."
    );
  }

  function deleteInvoice(invoiceId: string) {
    const invoice = invoiceItems.find((item) => item.id === invoiceId);
    if (!invoice) return;

    const confirmed = window.confirm(
      `Factuur ${invoice.invoiceNumber} uit de opslag verwijderen? Reeds goedgekeurde ingredientprijzen blijven staan. Gebruik eerst terugdraaien als je die prijsupdates wilt herstellen.`
    );

    if (!confirmed) return;

    const nextInvoices = invoiceItems.filter((item) => item.id !== invoiceId);

    setInvoiceItems(nextInvoices);
    persistRecepturenData(
      {
        ingredients: ingredientItems,
        recipes: recipeItems,
        invoiceImports: nextInvoices,
      },
      "Factuur verwijderd uit de opslag."
    );
  }

  function matchInvoiceLine(
    invoiceId: string,
    line: InvoiceLine,
    ingredientId: string
  ) {
    const matchedIngredient = ingredientItems.find(
      (ingredient) => ingredient.id === ingredientId
    );
    const oldPrice = matchedIngredient ? ingredientPackagePrice(matchedIngredient) : 0;
    const percentageChange = oldPrice
      ? ((line.newPrice - oldPrice) / oldPrice) * 100
      : 0;
    const nextLine = {
      ...line,
      matchedIngredientId: ingredientId,
      oldPrice,
      percentageChange,
    };

    updateInvoiceLine(invoiceId, line, {
      matchedIngredientId: ingredientId,
      oldPrice,
      percentageChange,
      reviewStatus: reviewStatusForInvoiceLine(nextLine),
    });
  }

  function openInvoiceIngredientEditor(ingredient: Ingredient) {
    setInvoiceIngredientEditor(
      ingredientItems.find((item) => item.id === ingredient.id) || ingredient
    );
  }

  function createIngredientFromInvoiceLine(
    invoiceId: string,
    line: InvoiceLine,
    options?: { forceNew?: boolean; openEditor?: boolean }
  ) {
    const invoice = invoiceItems.find((item) => item.id === invoiceId);
    const supplier = invoice?.supplier || "Onbekend";
    const existingIngredient = options?.forceNew
      ? undefined
      : ingredientItems.find((ingredient) =>
          sameSupplierArticle(ingredient, line.articleNumber, supplier)
        );
    const isSameInvoiceArticle = (item: InvoiceLine) =>
      item.articleNumber === line.articleNumber &&
      normalizeSearch(item.description) === normalizeSearch(line.description) &&
      item.reviewStatus === "pending" &&
      (options?.forceNew || !item.matchedIngredientId);

    if (existingIngredient) {
      const nextInvoices = invoiceItems.map((item) => {
        if (item.id !== invoiceId) return item;

        const lines = item.lines.map((invoiceLine) =>
          isSameInvoiceArticle(invoiceLine) || sameInvoiceLine(invoiceLine, line)
            ? {
                ...invoiceLine,
                matchedIngredientId: existingIngredient.id,
                reviewStatus: "pending" as const,
              }
            : invoiceLine
        );

        return { ...item, status: invoiceStatusForLines(lines), lines };
      });

      setInvoiceItems(nextInvoices);
      if (options?.openEditor) {
        setInvoiceIngredientEditor(existingIngredient);
      }
      persistRecepturenData(
        {
          ingredients: ingredientItems,
          recipes: recipeItems,
          invoiceImports: nextInvoices,
        },
        `${existingIngredient.name} bestond al en is gekoppeld.`
      );
      return;
    }

    const recipeUnit = invoiceLineRecipeUnit(line);
    const packagePrice = normalizePackagePrice(
      line.newPrice ||
        line.pricePerUnit ||
        (line.quantity ? line.totalPrice / line.quantity : 0),
      recipeUnit
    );
    const now = new Date().toISOString();
    const idBase =
      normalizeSearch(line.description)
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || "factuur-artikel";
    const newIngredient: Ingredient = {
      id: `ingredient-${idBase}-${Date.now()}`,
      name: line.description || `Artikel ${line.articleNumber}`,
      supplier,
      supplierArticleNumber: line.articleNumber || "-",
      packageSize: invoiceLinePackageSize(line, recipeUnit),
      recipeUnit,
      lastPrice: packagePrice,
      previousPrice: 0,
      pricePerBaseUnit: pricePerBaseUnitFromPackagePrice(
        packagePrice,
        recipeUnit
      ),
      allergens: [],
      lastUpdated: now.slice(0, 10),
      status: "active",
      lastInvoice: invoice?.invoiceNumber || "",
      aliases: [line.description, line.articleNumber].filter(Boolean),
    };

    const nextIngredients = [newIngredient, ...ingredientItems];
    const nextInvoices = invoiceItems.map((item) => {
      if (item.id !== invoiceId) return item;

      const lines = item.lines.map((invoiceLine) =>
        isSameInvoiceArticle(invoiceLine) || sameInvoiceLine(invoiceLine, line)
          ? {
              ...invoiceLine,
              matchedIngredientId: newIngredient.id,
              reviewStatus: "approved" as const,
              previousLastInvoice: undefined,
              appliedAt: now,
            }
          : invoiceLine
      );

      return { ...item, status: invoiceStatusForLines(lines), lines };
    });

    recalculateRecipesWithIngredients(
      nextIngredients,
      nextInvoices,
      `${newIngredient.name} toegevoegd als nieuwe grondstof en prijs toegepast.`
    );
    if (options?.openEditor) {
      setInvoiceIngredientEditor(newIngredient);
    }
  }

  function importInvoice(invoice: InvoiceImport) {
    const normalizedInvoice = normalizeInvoiceReviewStatuses(
      invoice,
      ingredientItems
    );
    const nextInvoices = pruneInvoiceImports([normalizedInvoice, ...invoiceItems]);

    setInvoiceItems(nextInvoices);
    persistRecepturenData(
      {
        ingredients: ingredientItems,
        recipes: recipeItems,
        invoiceImports: nextInvoices,
      },
      "Factuur opgeslagen in WordPress; het bestand zelf is niet bewaard."
    );
  }

  function importIngredients(importedIngredients: Ingredient[]) {
    if (!importedIngredients.length) return;

    const nextIngredients = mergeIngredients(ingredientItems, importedIngredients);

    recalculateRecipesWithIngredients(
      nextIngredients,
      invoiceItems,
      `${importedIngredients.length} grondstoffen ingeladen; kostprijzen herberekend.`
    );
  }

  function importRecipes(
    importedRecipes: Recipe[],
    importedIngredients: Ingredient[] = []
  ) {
    if (!importedRecipes.length) return;

    const nextIngredients = importedIngredients.length
      ? mergeIngredients(ingredientItems, importedIngredients)
      : ingredientItems;
    const mergedRecipes = mergeRecipes(recipeItems, importedRecipes);
    const nextRecipes = recalculateAllRecipeCosts(
      mergedRecipes,
      nextIngredients,
      {
        markAsUpdated: true,
      },
      packagingItems
    );

    setIngredientItems(nextIngredients);
    setRecipeItems(nextRecipes);
    syncSelectedRecipe(nextRecipes);
    persistRecepturenData(
      {
        ingredients: nextIngredients,
        recipes: nextRecipes,
        invoiceImports: invoiceItems,
      },
      `${importedRecipes.length} recepten ingeladen${
        importedIngredients.length
          ? ` met ${importedIngredients.length} nieuwe grondstof${
              importedIngredients.length === 1 ? "" : "fen"
            }`
          : ""
      } en kostprijzen berekend.`
    );
  }

  function savePackagingItem(updatedPackaging: PackagingItem) {
    const exists = packagingItems.some((item) => item.id === updatedPackaging.id);
    const normalizedPackaging = {
      ...updatedPackaging,
      unitPrice:
        updatedPackaging.quantityPerPackage > 0
          ? Math.round(
              (updatedPackaging.packagePrice / updatedPackaging.quantityPerPackage) *
                10000
            ) / 10000
          : updatedPackaging.unitPrice,
      lastUpdated: new Date().toISOString().slice(0, 10),
    };
    const nextPackagingItems = exists
      ? packagingItems.map((item) =>
          item.id === updatedPackaging.id ? normalizedPackaging : item
        )
      : [normalizedPackaging, ...packagingItems];
    const nextRecipes = recalculateAllRecipeCosts(
      recipeItems,
      ingredientItems,
      { markAsUpdated: true },
      nextPackagingItems
    );

    setPackagingItems(nextPackagingItems);
    setRecipeItems(nextRecipes);
    syncSelectedRecipe(nextRecipes);
    persistRecepturenData(
      {
        ingredients: ingredientItems,
        recipes: nextRecipes,
        packagingItems: nextPackagingItems,
        invoiceImports: invoiceItems,
      },
      "Verpakking opgeslagen en kostprijzen opnieuw berekend."
    );
  }

  function deletePackagingItem(packagingToDelete: PackagingItem) {
    const nextPackagingItems = packagingItems.filter(
      (item) => item.id !== packagingToDelete.id
    );
    const recipesWithoutPackaging = recipeItems.map((recipe) => ({
      ...recipe,
      packagingItems: (recipe.packagingItems || []).filter(
        (line) => line.packagingId !== packagingToDelete.id
      ),
    }));
    const nextRecipes = recalculateAllRecipeCosts(
      recipesWithoutPackaging,
      ingredientItems,
      { markAsUpdated: true },
      nextPackagingItems
    );

    setPackagingItems(nextPackagingItems);
    setRecipeItems(nextRecipes);
    syncSelectedRecipe(nextRecipes);
    persistRecepturenData(
      {
        ingredients: ingredientItems,
        recipes: nextRecipes,
        packagingItems: nextPackagingItems,
        invoiceImports: invoiceItems,
      },
      `${packagingToDelete.name} verwijderd uit verpakkingen.`
    );
  }

  function currentRecepturenData(): RecepturenData {
    return {
      ingredients: ingredientItems,
      recipes: recipeItems,
      packagingItems,
      invoiceImports: invoiceItems,
      bakeryHome,
    };
  }

  function downloadJsonBackup() {
    downloadRecepturenJsonBackup(currentRecepturenData());
    setSyncStatus("Volledig herstelbestand gedownload.");
  }

  function downloadExcelBackup() {
    void downloadRecepturenExcelBackup(currentRecepturenData())
      .then(() => setSyncStatus("Excel-backup gedownload."))
      .catch(() => setSyncStatus("Excel-backup kon niet worden gemaakt."));
  }

  function openMainTab(nextTab: MainTabId) {
    setMainTab(nextTab);
    if (nextTab === "beheer") setBeheerView("menu");
  }

  function openBeheerView(nextView: TabId) {
    setMainTab("beheer");
    setBeheerView(nextView);
  }

  function openDataImport(kind: ImportKind) {
    setImportKind(kind);
    setMainTab("beheer");
    setBeheerView("import");
  }

  function selectOfferWeek(weekStart: string) {
    setSelectedOfferWeek(weekStart);
  }

  function addBakeryNote() {
    persistBakeryHomeUpdate(
      (current) => ({
        ...current,
        notes: [...current.notes, createBlankHomeNote()],
      }),
      "Nieuwe notitie opgeslagen."
    );
  }

  function updateBakeryNoteText(noteId: string, text: string) {
    setBakeryHome((current) => ({
      ...current,
      notes: current.notes.map((note) =>
        note.id === noteId ? { ...note, text } : note
      ),
    }));
  }

  function saveBakeryNote(noteId: string, text: string) {
    persistBakeryHomeUpdate(
      (current) => ({
        ...current,
        notes: current.notes.map((note) =>
          note.id === noteId
            ? { ...note, text, updatedAt: new Date().toISOString() }
            : note
        ),
      }),
      "Notitie opgeslagen."
    );
  }

  function deleteBakeryNote(noteId: string) {
    persistBakeryHomeUpdate(
      (current) => ({
        ...current,
        notes: current.notes.filter((note) => note.id !== noteId),
      }),
      "Notitie verwijderd."
    );
  }

  async function uploadBakeryOfferImage(
    file: File | null,
    label: string,
    weekCount = 1
  ) {
    if (!file) return;

    setOfferUploadStatus("Aanbieding uploaden naar WordPress...");

    const targetWeekCount = clampOfferWeekCount(weekCount);
    const targetWeeks = Array.from({ length: targetWeekCount }, (_, index) =>
      addDays(selectedOfferWeek, index * 7)
    );
    const formData = new FormData();
    formData.set("file", file);
    formData.set("weekStart", selectedOfferWeek);
    formData.set("label", label);

    const response = await fetch("/api/recepturen/home-photo", {
      method: "POST",
      body: formData,
    }).catch(() => null);

    const data = (await response?.json().catch(() => null)) as
      | { id?: number; url?: string; fileName?: string; message?: string }
      | null;

    if (!response?.ok || !data?.url) {
      setOfferUploadStatus(
        data?.message || "Aanbieding uploaden is niet gelukt."
      );
      return;
    }

    const now = new Date().toISOString();
    const cleanLabel = label.trim();
    const imageUrl = data.url;
    const targetWeekSet = new Set(targetWeeks);
    const nextOfferByWeek = new Map(
      targetWeeks.map((weekStart, index) => {
        const currentOffer = offerForWeek(bakeryHome, weekStart);
        const nextOffer: BakeryHomeOffer = {
          id: currentOffer?.id || `offer-${weekStart}-${Date.now()}-${index + 1}`,
          weekStart,
          weekEnd: addDays(weekStart, 6),
          label: cleanLabel || formatWeekRange(weekStart),
          imageUrl,
          mediaId: data.id || 0,
          fileName: data.fileName || file.name,
          createdAt: currentOffer?.createdAt || now,
          updatedAt: now,
        };

        return [weekStart, nextOffer];
      })
    );
    const nextOffers = [
      ...targetWeeks.map((weekStart) => nextOfferByWeek.get(weekStart)!),
      ...bakeryHome.offers.filter((offer) => !targetWeekSet.has(offer.weekStart)),
    ];

    persistBakeryHome(
      {
        ...bakeryHome,
        offers: nextOffers,
      },
      targetWeekCount > 1
        ? `Aanbieding opgeslagen voor ${targetWeekCount} weken.`
        : "Aanbieding opgeslagen."
    );
    setOfferUploadStatus(
      targetWeekCount > 1
        ? `Aanbieding opgeslagen voor ${targetWeekCount} weken.`
        : "Aanbieding opgeslagen."
    );
  }

  function renderBeheerContent() {
    if (beheerView === "menu") {
      return (
        <BeheerHome
          syncStatus={syncStatus}
          isLoadingData={isLoadingData}
          latestInvoiceNumber={latestInvoice?.invoiceNumber || ""}
          onOpen={openBeheerView}
          onDownloadExcel={downloadExcelBackup}
          onDownloadJson={downloadJsonBackup}
        />
      );
    }

    return (
      <section className="grid gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setBeheerView("menu")}
            className="inline-flex items-center gap-2 border border-[#c3d3bc] bg-white px-4 py-3 text-sm font-black text-[#252525]"
          >
            <img src="/UI-apps_terug.svg" alt="" className="h-5 w-5" />
            Terug naar data
          </button>
          <p className="text-xs font-bold text-[#707070]">
            {isLoadingData ? "Laden..." : syncStatus}
          </p>
        </div>

        {beheerView === "dashboard" && (
          <RecepturenDashboard
            recipes={recipeItems}
            ingredients={ingredientItems}
            invoice={latestInvoice}
          />
        )}
        {beheerView === "voorpagina" && (
          <BakeryHomeManager
            home={bakeryHome}
            selectedWeek={selectedOfferWeek}
            status={bakeryHomeStatus}
            uploadStatus={offerUploadStatus}
            onSelectWeek={selectOfferWeek}
            onUploadOfferImage={uploadBakeryOfferImage}
          />
        )}
        {beheerView === "recepten" && (
          <RecipesList
            recipes={recipeItems}
            onOpenRecipe={openRecipe}
            onCreateRecipe={() => createRecipe("finalProduct")}
            onOpenImport={() => openDataImport("recipes")}
            onRecalculateAll={recalculateAllRecipes}
          />
        )}
        {beheerView === "halffabricaten" && (
          <HalffabricatenList
            recipes={recipeItems}
            onOpenRecipe={openRecipe}
            onCreateRecipe={() => createRecipe("semiFinished")}
          />
        )}
        {beheerView === "ingredienten" && (
          <IngredientsList
            ingredients={ingredientItems}
            recipes={recipeItems}
            onUpdateIngredient={saveIngredient}
            onDeleteIngredient={deleteIngredient}
            onMergeIngredient={mergeDuplicateIngredient}
            onOpenImport={() => openDataImport("ingredients")}
            onDeleteIngredients={(ingredientsToDelete) =>
              deleteIngredients(
                ingredientsToDelete,
                `${ingredientsToDelete.length} HF-grondstoffen opgeruimd.`
              )
            }
          />
        )}
        {beheerView === "verpakkingen" && (
          <PackagingList
            packagingItems={packagingItems}
            recipes={recipeItems}
            onSavePackagingItem={savePackagingItem}
            onDeletePackagingItem={deletePackagingItem}
          />
        )}
        {beheerView === "import" && (
          <RecipeDataImport
            ingredients={ingredientItems}
            initialKind={importKind}
            recipes={recipeItems}
            onImportIngredients={importIngredients}
            onImportRecipes={importRecipes}
          />
        )}
        {beheerView === "factuurimport" && (
          <FactuurImport
            invoice={latestInvoice}
            ingredients={ingredientItems}
            onApproveLine={approveInvoiceLine}
            onIgnoreLine={ignoreInvoiceLine}
            onIgnoreInvoice={ignoreInvoice}
            onRevertInvoice={revertInvoice}
            onDeleteInvoice={deleteInvoice}
            onMatchLine={matchInvoiceLine}
            onCreateIngredientFromLine={createIngredientFromInvoiceLine}
            onEditIngredient={openInvoiceIngredientEditor}
            onImportInvoice={importInvoice}
          />
        )}
        {beheerView === "marge" && (
          <MargeOverzicht recipes={recipeItems} onOpenRecipe={openRecipe} />
        )}
      </section>
    );
  }

  return (
    <main className="h-[calc(100dvh-8.5rem)] overflow-hidden bg-[#faf8f5] text-[#111111] md:h-screen md:h-[100dvh]">
      <div className="flex h-[calc(100dvh-8.5rem)] min-w-0 flex-col overflow-hidden md:h-screen md:h-[100dvh]">
        {!hideTopNav && (
          <BakkerijTopNav active={mainTab} onSelect={openMainTab} />
        )}

        <div className="min-h-0 flex-1 overflow-hidden">
          {mainTab === "start" && (
            <BakkerijStartScreen
              home={bakeryHome}
              selectedWeek={selectedOfferWeek}
              status={bakeryHomeStatus}
              onSelectWeek={selectOfferWeek}
              onAddNote={addBakeryNote}
              onUpdateNoteText={updateBakeryNoteText}
              onSaveNote={saveBakeryNote}
              onDeleteNote={deleteBakeryNote}
              showProductionLinks={showProductionLinks}
              profile={profile}
            />
          )}

          {mainTab === "recepten" && (
            <div className="h-full w-full px-2 py-2 sm:px-4 sm:py-3 lg:px-6">
              <RecipesList
                recipes={scopedRecipeItems}
                scope={scope}
                onOpenRecipe={openRecipe}
                onCreateRecipe={() => createRecipe("finalProduct")}
                onOpenImport={() => openDataImport("recipes")}
                onRecalculateAll={recalculateAllRecipes}
              />
            </div>
          )}

          {mainTab === "planning" && (
            <div className="h-full w-full overflow-y-auto px-2 py-2 sm:px-4 sm:py-3 lg:px-6">
              <div className="w-full">
                <RecepturenWorkMode
                  recipes={scopedRecipeItems}
                  ingredients={ingredientItems}
                  manualPlanningItems={manualPlanningItems}
                  lockedView="planning"
                  onOpenRecipeCard={openRecipe}
                  onMarkProduced={markRecipeProduced}
                  onPlanProduction={planRecipeProduction}
                  onDeleteProductionRequest={deleteRecipeProductionRequest}
                  onPlanManualProduction={planManualProductionItem}
                  onMarkManualPlanningItemDone={markManualPlanningItemDone}
                  onDeleteManualPlanningItem={deleteManualPlanningItem}
                  onAdjustStock={adjustRecipeStock}
                  onUpdateProductionLog={updateProductionLogEntry}
                  onDeleteProductionLog={deleteProductionLogEntry}
                />
              </div>
            </div>
          )}

          {mainTab === "beheer" && (
            <div className="h-full w-full overflow-y-auto px-2 py-2 sm:px-4 sm:py-3 lg:px-6">
              <div
                className={
                  beheerView === "menu" ? "mx-auto w-full max-w-6xl" : "w-full"
                }
              >
                {renderBeheerContent()}
              </div>
            </div>
          )}
        </div>

        {selectedRecipe && (
          <RecipeDetail
            key={selectedRecipe.id}
            recipe={selectedRecipe}
            ingredients={ingredientItems}
            recipes={recipeItems}
            packagingItems={packagingItems}
            startInEditMode={recipeEditorStartsOpen}
            onClose={closeSelectedRecipe}
            onSaveRecipe={saveRecipe}
            onDeleteRecipe={deleteRecipe}
            onDuplicateRecipe={duplicateRecipe}
            onSaveIngredient={saveIngredient}
            onSaveIngredients={saveIngredients}
            onMarkProduced={markRecipeProduced}
            onOpenRecipe={(recipe) =>
              openRecipe(recipe, { fromRecipeId: selectedRecipe.id })
            }
          />
        )}
        {invoiceIngredientEditor && (
          <IngredientDetail
            key={invoiceIngredientEditor.id}
            ingredient={invoiceIngredientEditor}
            ingredients={ingredientItems}
            recipes={recipeItems}
            onUpdateIngredient={saveIngredient}
            onMergeIngredient={(sourceIngredient, targetIngredient) => {
              mergeDuplicateIngredient(sourceIngredient, targetIngredient);
              setInvoiceIngredientEditor(null);
            }}
            onDeleteIngredient={(ingredient) => {
              deleteIngredient(ingredient);
              setInvoiceIngredientEditor(null);
            }}
            onClose={() => setInvoiceIngredientEditor(null)}
          />
        )}
      </div>
    </main>
  );
}

function BakkerijTopNav({
  active,
  onSelect,
}: Readonly<{
  active: MainTabId;
  onSelect: (tab: MainTabId) => void;
}>) {
  if (active === "start") {
    return (
      <header className="flex h-[clamp(4.8rem,7vw,6.2rem)] shrink-0 items-center justify-center border-b border-[#e8e4de] bg-[#faf8f5] px-4">
        <button
          type="button"
          onClick={() => onSelect("start")}
          className="flex min-w-0 items-center justify-center gap-4"
        >
          <span className="bakkerij-page-heading-icon shrink-0" aria-hidden="true" />
          <h1 className="bakkerij-page-heading min-w-0 text-[#ef5737]">
            Bakkerij overzicht
          </h1>
        </button>
      </header>
    );
  }

  const tabs: Array<{ id: MainTabId; label: string }> = [
    { id: "recepten", label: "RECEPTEN" },
    { id: "planning", label: "PLANNING" },
    { id: "beheer", label: "DATA" },
  ];

  return (
    <header className="flex h-[clamp(4.6rem,6vw,5.8rem)] shrink-0 items-center border-b border-[#e8e4de] bg-[#faf8f5] px-4">
      <div className="flex min-w-0 gap-2 rounded-full border border-[#d6e5d8] bg-white/85 p-1 shadow-sm">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onSelect(tab.id)}
          className={`min-w-0 rounded-full px-4 py-2.5 text-center text-[clamp(0.62rem,1.35vw,0.9rem)] uppercase tracking-[0.11em] transition ${
            active === tab.id
              ? "bg-[#ef5737] font-black text-white shadow-sm"
              : "font-bold text-[#2d2a26]/55 hover:bg-[#f6faf4] hover:text-[#2d2a26]"
          }`}
        >
          {tab.label}
        </button>
      ))}
      </div>
    </header>
  );
}

function BakkerijStartScreen({
  home,
  selectedWeek,
  status,
  onSelectWeek,
  onAddNote,
  onUpdateNoteText,
  onSaveNote,
  onDeleteNote,
  showProductionLinks,
  profile,
}: Readonly<{
  home: BakeryHomeData;
  selectedWeek: string;
  status: string;
  onSelectWeek: (weekStart: string) => void;
  onAddNote: () => void;
  onUpdateNoteText: (noteId: string, text: string) => void;
  onSaveNote: (noteId: string, text: string) => void;
  onDeleteNote: (noteId: string) => void;
  showProductionLinks?: boolean;
  profile?: UserProfile | null;
}>) {
  const offer = offerForWeek(home, selectedWeek);
  const canOpenWeddingCakeAgenda = canAccessWeddingCakes(profile);
  const [isWeddingCakeAgendaOpen, setIsWeddingCakeAgendaOpen] = useState(false);

  return (
    <section className="mx-auto h-full w-full max-w-[76rem] overflow-y-auto px-3 py-3 sm:px-6 sm:py-5">
      <div className="grid gap-4 lg:grid-cols-[minmax(18rem,0.9fr)_minmax(0,1.55fr)] lg:gap-7">
        {showProductionLinks && (
          <header className="flex min-w-0 items-center gap-3 pb-1 sm:gap-4 lg:col-span-2">
            <span
              className="productie-page-heading-icon shrink-0"
              aria-hidden="true"
            />
            <h1 className="winkel-page-heading min-w-0 text-[#ef5737]">
              Productie overzicht
            </h1>
          </header>
        )}

        <section className="min-w-0">
          <div className="flex h-[34rem] flex-col sm:h-[38rem]">
            <div className="mb-1 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3">
              <div className="min-w-0">
                <h2 className="winkel-card-heading text-[clamp(1.2rem,3.2vw,1.9rem)]">
                  aanbieding
                </h2>
              </div>
              <p className="pb-1 text-right text-[0.72rem] font-semibold italic leading-tight text-[#2d2a26] sm:text-sm">
                {formatWeekRange(selectedWeek)}
              </p>
            </div>

            <div className="relative min-h-0 flex-1 overflow-hidden border border-[#b9d1ae] bg-[#eef6ea] p-3">
              <button
                type="button"
                onClick={() => onSelectWeek(addDays(selectedWeek, -7))}
                className="absolute left-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/85 text-2xl font-black leading-none text-[#111111] shadow-sm"
                aria-label="Vorige week"
              >
                ‹
              </button>
              <button
                type="button"
                onClick={() => onSelectWeek(addDays(selectedWeek, 7))}
                className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/85 text-2xl font-black leading-none text-[#111111] shadow-sm"
                aria-label="Volgende week"
              >
                ›
              </button>

              <div className="flex h-full w-full items-center justify-center">
                {offer?.imageUrl ? (
                  <img
                    src={offer.imageUrl}
                    alt={offer.label || "Aanbieding van de week"}
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <p className="px-4 text-center text-xs font-black uppercase tracking-[0.14em] text-[#2d2a26]/35">
                    Geen aanbieding ingesteld
                  </p>
                )}
              </div>
            </div>
          </div>
        </section>

        <div className="grid h-[34rem] min-w-0 grid-rows-[minmax(0,1fr)_minmax(0,1fr)] gap-4 sm:h-[38rem]">
          <section className="flex min-h-0 flex-col">
            <div className="mb-1 flex items-end justify-between gap-3">
              <h2 className="winkel-card-heading text-[clamp(1.2rem,3.2vw,1.9rem)]">
                notities
              </h2>
              <button
                type="button"
                onClick={onAddNote}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#9bc79c] text-2xl font-black leading-none text-[#1a1815] shadow-sm"
                aria-label="Notitie toevoegen"
              >
                +
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto rounded-[1.65rem] bg-[#e8e0d9] p-3">
              <div className="grid gap-2">
                {home.notes.map((note) => (
                  <label key={note.id} className="relative block">
                    <textarea
                      value={note.text}
                      onChange={(event) =>
                        onUpdateNoteText(note.id, event.target.value)
                      }
                      onBlur={(event) =>
                        onSaveNote(note.id, event.currentTarget.value)
                      }
                      placeholder="Schrijf notitie..."
                      className="min-h-[4.3rem] w-full resize-none rounded-[1rem] border border-transparent bg-white/85 px-3 py-2.5 text-sm font-semibold leading-snug text-[#2d2a26] outline-none placeholder:text-[#8d8881] focus:border-[#9bc79c]"
                    />
                    <button
                      type="button"
                      onClick={() => onDeleteNote(note.id)}
                      className="absolute -right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-[#d75a48] text-lg font-black leading-none text-white"
                      aria-label="Notitie verwijderen"
                    >
                      -
                    </button>
                  </label>
                ))}
                {!home.notes.length && (
                  <button
                    type="button"
                    onClick={onAddNote}
                    className="min-h-[8rem] rounded-[1rem] bg-white/85 px-3 py-2.5 text-left text-sm font-semibold text-[#8d8881]"
                  >
                    Schrijf notitie...
                  </button>
                )}
              </div>
              {status && (
                <p className="mt-2 text-xs font-bold text-[#707070]">{status}</p>
              )}
            </div>
          </section>

          <PersonnelMilestonesPanel />
        </div>

        {showProductionLinks && (
          <ProductionOverviewTiles
            canOpenWeddingCakeAgenda={canOpenWeddingCakeAgenda}
            onOpenWeddingCakeAgenda={() => setIsWeddingCakeAgendaOpen(true)}
            profile={profile}
          />
        )}
        {canOpenWeddingCakeAgenda && (
          <BakkerijWeddingCakeAgendaModal
            open={isWeddingCakeAgendaOpen}
            onClose={() => setIsWeddingCakeAgendaOpen(false)}
          />
        )}
      </div>
    </section>
  );
}

const productionOverviewLinks = [
  {
    href: "/bakkerij/bakkerij",
    label: "Bakkerij",
    icon: strikIcons.bakkerij,
  },
  {
    href: "/bakkerij/logistiek",
    label: "Logistiek",
    icon: strikIcons.logistiek,
  },
  {
    href: "/bakkerij/ijs-chocolade",
    label: "Chocola & ijs",
    icon: strikIcons.ijsChocolade,
  },
  {
    href: "/bakkerij/management",
    label: "Data",
    icon: strikIcons.data,
  },
];

function PersonnelMilestonesPanel() {
  const [events, setEvents] = useState<PersonnelDashboardEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [todayKey, setTodayKey] = useState(() => dateKey(new Date()));

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setTodayKey(dateKey(new Date()));
    }, 60 * 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    let ignoreResult = false;

    async function loadEvents() {
      setIsLoading(true);
      setStatus("");

      try {
        const response = await fetch("/api/tamigo-employees?view=shop", {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error(`Tamigo gaf status ${response.status}.`);
        }

        const data = (await response.json()) as {
          personnelEvents?: PersonnelDashboardEvent[];
        };
        if (ignoreResult) return;

        const upcomingEvents = (data.personnelEvents || [])
          .filter((event) => {
            const isUpcoming =
              Number.isFinite(event.daysUntil) &&
              event.daysUntil >= 0 &&
              event.daysUntil <= 14;
            const isShownType =
              event.type === "birthday" ||
              (event.type === "anniversary" &&
                isImportantDashboardJubilee(event.years));

            return isUpcoming && isShownType;
          })
          .sort((first, second) => {
            const dateDiff = first.occurrenceDate.localeCompare(
              second.occurrenceDate
            );
            if (dateDiff !== 0) return dateDiff;

            return first.employeeName.localeCompare(second.employeeName);
          });

        setEvents(upcomingEvents);
      } catch (error) {
        if (ignoreResult) return;
        setEvents([]);
        setStatus(
          error instanceof Error
            ? `Agenda niet beschikbaar. ${error.message}`
            : "Agenda niet beschikbaar."
        );
      } finally {
        if (!ignoreResult) setIsLoading(false);
      }
    }

    void loadEvents();

    return () => {
      ignoreResult = true;
    };
  }, [todayKey]);

  return (
    <section className="flex min-h-0 flex-col">
      <div className="mb-1 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3">
        <h2 className="winkel-card-heading text-[clamp(1.2rem,3.2vw,1.9rem)]">
          agenda
        </h2>
        <p className="pb-1 text-right text-[0.72rem] font-semibold italic leading-tight text-[#2d2a26] sm:text-sm">
          vandaag: {formatShortBakeryDate(todayKey)}
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto rounded-[1.65rem] bg-[#e8e0d9] px-5 py-4">
        {isLoading ? (
          <p className="text-sm font-bold italic text-[#2d2a26]/45">
            Agenda laden...
          </p>
        ) : events.length ? (
          <ul className="grid gap-2 text-[clamp(0.92rem,1.9vw,1.25rem)] font-semibold italic leading-snug text-[#111111]">
            {events.map((event) => (
              <li key={event.id} className="grid gap-0.5">
                <span>
                  {formatShortBakeryDate(event.occurrenceDate)}:{" "}
                  {personnelDashboardEventText(event)}
                </span>
                <span className="text-xs font-bold not-italic text-[#2d2a26]/45">
                  {eventDaysLabel(event.daysUntil)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm font-bold italic text-[#2d2a26]/45">
            {status || "Geen verjaardagen of grote jubilea."}
          </p>
        )}
      </div>
    </section>
  );
}

function ProductionOverviewTile({
  href,
  icon,
  label,
  onClick,
}: Readonly<{
  href?: string;
  icon: string;
  label: string;
  onClick?: () => void;
}>) {
  const className =
    "group flex min-h-[5.8rem] items-center gap-5 rounded-full bg-[#b9cbb0] px-3 py-3 text-left shadow-sm ring-1 ring-[#a9bea1] transition hover:-translate-y-0.5 hover:bg-[#c4d5bc] hover:shadow-md active:translate-y-0 sm:min-h-[6.25rem] sm:px-4";
  const content = (
    <>
      <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-white shadow-sm sm:h-[4.4rem] sm:w-[4.4rem]">
        <img src={icon} alt="" className="h-9 w-9 object-contain" />
      </span>
      <span className="min-w-0 text-[clamp(1rem,2.1vw,1.35rem)] font-black uppercase leading-tight text-[#111111]">
        {label}
      </span>
    </>
  );

  if (href) {
    return (
      <Link href={href} className={className}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={className}>
      {content}
    </button>
  );
}

function ProductionOverviewTiles({
  profile,
  canOpenWeddingCakeAgenda,
  onOpenWeddingCakeAgenda,
}: Readonly<{
  profile?: UserProfile | null;
  canOpenWeddingCakeAgenda: boolean;
  onOpenWeddingCakeAgenda: () => void;
}>) {
  const visibleLinks = filterAllowedItems(productionOverviewLinks, profile);

  if (visibleLinks.length === 0 && !canOpenWeddingCakeAgenda) return null;

  return (
    <section className="mt-5 grid gap-3 sm:grid-cols-2 lg:col-span-2 xl:grid-cols-3">
      {canOpenWeddingCakeAgenda && (
        <ProductionOverviewTile
          icon={strikIcons.bruidstaart}
          label="Bruidstaart agenda"
          onClick={onOpenWeddingCakeAgenda}
        />
      )}
      {visibleLinks.map((item) => (
        <ProductionOverviewTile
          key={item.href}
          href={item.href}
          icon={item.icon}
          label={item.label}
        />
      ))}
    </section>
  );
}

function BakkerijWeddingCakeAgendaModal({
  open,
  onClose,
}: Readonly<{ open: boolean; onClose: () => void }>) {
  const [weekStart, setWeekStart] = useState(weekStartForDate);
  const [drafts, setDrafts] = useState<WeddingCakeDraft[]>([]);
  const [selectedDraft, setSelectedDraft] = useState<WeddingCakeDraft | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState("");
  const weekDates = weekDatesFor(weekStart);

  useEffect(() => {
    if (!open) return;

    let ignoreResult = false;

    async function loadAgenda() {
      const agendaDates = weekDatesFor(weekStart);

      setIsLoading(true);
      setStatus("Bruidstaart agenda laden...");

      try {
        const results = await Promise.all(
          agendaDates.map(async (date) => {
            const response = await fetch(getWeddingCakeStudioUrl("", date), {
              cache: "no-store",
            });

            if (!response.ok) {
              throw new Error(`WordPress gaf status ${response.status}.`);
            }

            return normalizeDraftList(await response.json());
          })
        );
        if (ignoreResult) return;

        const definitiveDrafts = uniqueWeddingCakeDrafts(results.flat()).filter(
          (draft) => draft.config.completed
        );

        setDrafts(definitiveDrafts);
        setSelectedDraft((current) =>
          current &&
          definitiveDrafts.some((draft) => draft.code === current.code)
            ? current
            : null
        );
        setStatus(
          definitiveDrafts.length
            ? `${definitiveDrafts.length} definitieve bruidstaart${
                definitiveDrafts.length === 1 ? "" : "en"
              } gevonden.`
            : "Geen definitieve bruidstaarten in deze week."
        );
      } catch (error) {
        if (ignoreResult) return;
        setDrafts([]);
        setSelectedDraft(null);
        setStatus(
          error instanceof Error
            ? `Bruidstaart agenda niet beschikbaar. ${error.message}`
            : "Bruidstaart agenda niet beschikbaar."
        );
      } finally {
        if (!ignoreResult) setIsLoading(false);
      }
    }

    void loadAgenda();

    return () => {
      ignoreResult = true;
    };
  }, [open, weekStart]);

  useEffect(() => {
    if (!open) return;

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", closeOnEscape);

    return () => {
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [onClose, open]);

  const groupedDrafts = weekDates.map((date) => ({
    date,
    drafts: drafts.filter((draft) => getWeddingCakeDeliveryDate(draft) === date),
  }));

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#1a1815]/35 p-3"
      role="dialog"
      aria-modal="true"
      aria-label="Bruidstaart agenda"
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute inset-0 cursor-default"
        aria-label="Bruidstaart agenda sluiten"
      />
      <section className="relative flex max-h-[calc(100vh-1.5rem)] w-full max-w-[78rem] flex-col overflow-hidden rounded-[1.6rem] bg-[#f6faf4] shadow-2xl">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#d6e5d8] bg-white/85 px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <p className="text-[0.8rem] font-black uppercase tracking-[0.14em] text-[#30462f]">
              bruidstaart agenda
            </p>
            <p className="mt-0.5 text-xs font-semibold italic text-[#30462f]/60">
              {formatWeekRange(weekStart)}
            </p>
            <p className="mt-1 text-xs font-bold text-[#30462f]/55">
              {isLoading ? "Laden..." : status}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex overflow-hidden rounded-full border border-[#bdd2b6] bg-white shadow-sm">
              <button
                type="button"
                onClick={() => setWeekStart(addDays(weekStart, -7))}
                className="flex h-9 w-10 items-center justify-center border-r border-[#d6e5d8] text-2xl leading-none text-[#30462f]"
                aria-label="Vorige week bruidstaarten"
              >
                ‹
              </button>
              <button
                type="button"
                onClick={() => setWeekStart(weekStartForDate())}
                className="px-3 text-xs font-bold text-[#30462f]"
              >
                deze week
              </button>
              <button
                type="button"
                onClick={() => setWeekStart(addDays(weekStart, 7))}
                className="flex h-9 w-10 items-center justify-center border-l border-[#d6e5d8] text-2xl leading-none text-[#30462f]"
                aria-label="Volgende week bruidstaarten"
              >
                ›
              </button>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-[#ef5737] text-xl font-black leading-none text-white shadow-sm"
              aria-label="Sluiten"
            >
              ×
            </button>
          </div>
        </header>

        <div className="min-h-0 overflow-y-auto p-3 sm:p-4">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,30rem)]">
            <div className="rounded-[1.25rem] bg-white/75 p-3">
              <div className="grid gap-2 md:grid-cols-7">
                {groupedDrafts.map((group) => (
                  <div
                    key={group.date}
                    className="min-h-[8.5rem] rounded-[1rem] bg-[#faf8f5] p-3 ring-1 ring-[#d6e5d8]"
                  >
                    <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#30462f]/45">
                      {formatBakeryDate(group.date).split(" ")[0]}
                    </p>
                    <p className="text-sm font-black text-[#30462f]">
                      {formatBakeryDate(group.date).replace(/^[^ ]+\s/, "")}
                    </p>
                    <div className="mt-3 grid gap-2">
                      {group.drafts.map((draft) => {
                        const size = findOption(cakeSizes, draft.config.sizeId);
                        const isSelected = selectedDraft?.code === draft.code;

                        return (
                          <button
                            key={draft.code}
                            type="button"
                            onClick={() => setSelectedDraft(draft)}
                            className={`rounded-[0.9rem] p-2 text-left text-xs transition ${
                              isSelected
                                ? "bg-[#ef5737] text-white shadow-sm"
                                : "bg-white text-[#2d2a26] hover:bg-[#fff4ee]"
                            }`}
                          >
                            <span className="block font-black">
                              {weddingCakeCustomerName(draft) || draft.code}
                            </span>
                            <span
                              className={`mt-1 block font-bold ${
                                isSelected
                                  ? "text-white/80"
                                  : "text-[#2d2a26]/50"
                              }`}
                            >
                              {size
                                ? `${size.code} · ${size.personsLabel}`
                                : draft.code}
                            </span>
                          </button>
                        );
                      })}
                      {!group.drafts.length && (
                        <p className="text-xs text-[#30462f]/35">
                          Geen taarten
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="min-w-0 rounded-[1.25rem] bg-white/85 p-4 shadow-sm">
              {selectedDraft ? (
                <BakkerijWeddingCakeDetail draft={selectedDraft} />
              ) : (
                <div className="flex min-h-[18rem] items-center justify-center rounded-[1rem] border border-dashed border-[#bdd2b6] px-5 text-center text-sm font-bold leading-relaxed text-[#30462f]/55">
                  Klik op een definitieve bruidstaart om de productiekaart en
                  printversie te openen.
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function BakkerijWeddingCakeDetail({
  draft,
}: Readonly<{ draft: WeddingCakeDraft }>) {
  const config = draft.config;
  const labels = getSelectedWeddingCakeLabels(config);
  const price = calculateWeddingCakePrice(config);
  const productionForm = createProductionForm(config);
  const decorationNoteTexts = getDecorationNoteTexts(config);
  const decorationColorNotes = getDecorationColorNotes(config);
  const decorationSurcharges = getDecorationSurcharges(config);
  const topperNoteTexts = getTopperNoteTexts(config);
  const topperSurcharges = getTopperSurcharges(config);
  const customerName = weddingCakeCustomerName(draft) || draft.code;
  const deliveryDate = getWeddingCakeDeliveryDate(draft);

  return (
    <article className="min-w-0">
      <div className="studio-no-print mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#ef5737]">
            definitieve bestelling
          </p>
          <h3 className="mt-1 text-2xl font-black leading-tight text-[#2d2a26]">
            {customerName}
          </h3>
          <p className="mt-1 text-sm font-bold text-[#2d2a26]/55">
            {formatBakeryDate(deliveryDate)} · code {draft.code}
          </p>
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-full bg-[#ef5737] px-5 py-3 text-sm font-black text-white shadow-sm"
        >
          Print
        </button>
      </div>

      <div className="studio-no-print grid gap-4">
        <CakeVisualizer config={config} />

        <div className="grid gap-2 text-sm text-[#2d2a26]">
          <BakkerijWeddingCakeRow label="Formaat">
            {labels.size || "-"}
          </BakkerijWeddingCakeRow>
          <BakkerijWeddingCakeRow label="Stijl">
            {labels.style || "-"}
          </BakkerijWeddingCakeRow>
          <BakkerijWeddingCakeRow label="Smaak">
            {labels.filling || "-"}
          </BakkerijWeddingCakeRow>
          <BakkerijWeddingCakeRow label="Kleur">
            {labels.color || "-"}
          </BakkerijWeddingCakeRow>
          <BakkerijWeddingCakeRow label="Layout">
            {labels.layout || "-"}
          </BakkerijWeddingCakeRow>
          <BakkerijWeddingCakeRow label="Decoratie">
            {labels.decorations.length ? labels.decorations.join(", ") : "geen"}
          </BakkerijWeddingCakeRow>
          {decorationColorNotes.length > 0 && (
            <BakkerijWeddingCakeRow label="Decoratie kleuren">
              {decorationColorNotes
                .map((item) => `${item.label}: ${item.color}`)
                .join(" | ")}
            </BakkerijWeddingCakeRow>
          )}
          {decorationNoteTexts.length > 0 && (
            <BakkerijWeddingCakeRow label="Decoratie opmerkingen">
              {decorationNoteTexts.join(" | ")}
            </BakkerijWeddingCakeRow>
          )}
          {decorationSurcharges.length > 0 && (
            <BakkerijWeddingCakeRow label="Decoratie toeslagen">
              {decorationSurcharges
                .map(
                  (surcharge) =>
                    `${surcharge.description || "extra wens"} (${formatEuro(
                      surcharge.amount
                    )})`
                )
                .join(" | ")}
            </BakkerijWeddingCakeRow>
          )}
          <BakkerijWeddingCakeRow label="Topper">
            {labels.topper || "Geen topper"}
          </BakkerijWeddingCakeRow>
          {config.topperInitialsText && (
            <BakkerijWeddingCakeRow label="Topper tekst">
              {config.topperInitialsText}
            </BakkerijWeddingCakeRow>
          )}
          {topperNoteTexts.length > 0 && (
            <BakkerijWeddingCakeRow label="Topper opmerkingen">
              {topperNoteTexts.join(" | ")}
            </BakkerijWeddingCakeRow>
          )}
          {topperSurcharges.length > 0 && (
            <BakkerijWeddingCakeRow label="Topper toeslagen">
              {topperSurcharges
                .map(
                  (surcharge) =>
                    `${surcharge.description || "extra wens"} (${formatEuro(
                      surcharge.amount
                    )})`
                )
                .join(" | ")}
            </BakkerijWeddingCakeRow>
          )}
          <BakkerijWeddingCakeRow label="Levering">
            {config.contact.deliveryMethod === "delivery" ? "Bezorgen" : "Afhalen"}
            {config.contact.deliveryAddress
              ? ` · ${config.contact.deliveryAddress}`
              : ""}
          </BakkerijWeddingCakeRow>
          {config.contact.notes && (
            <BakkerijWeddingCakeRow label="Opmerking klant">
              {config.contact.notes}
            </BakkerijWeddingCakeRow>
          )}
        </div>

        <p className="rounded-[1rem] bg-[#faf8f5] px-4 py-3 text-sm font-bold text-[#2d2a26]/60">
          Indicatie: {formatEuro(price.total)}
          {price.hasQuoteItems ? " + onderdelen op aanvraag" : ""}
        </p>
      </div>

      <section className="studio-print-report hidden bg-white text-black">
        <div className="mb-5 flex items-start justify-between gap-6 border-b border-black/20 pb-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em]">
              Strik Team app
            </p>
            <h1 className="mt-2 text-3xl font-black">
              Bruidstaart productie
            </h1>
            <p className="mt-1 text-sm">
              {formatBakeryDate(deliveryDate)} · {customerName}
            </p>
          </div>
          <div className="text-right text-sm">
            <p className="font-bold">Code</p>
            <p className="text-2xl font-black">{draft.code}</p>
          </div>
        </div>
        <div className="grid gap-5 print:grid-cols-[15rem_minmax(0,1fr)]">
          <CakeVisualizer config={config} />
          <pre className="whitespace-pre-wrap rounded-none border-0 bg-white p-0 text-[11px] leading-relaxed">
            {productionForm}
          </pre>
        </div>
      </section>
    </article>
  );
}

function BakkerijWeddingCakeRow({
  label,
  children,
}: Readonly<{ label: string; children: ReactNode }>) {
  return (
    <p className="rounded-[0.9rem] bg-[#faf8f5] px-3 py-2 leading-relaxed">
      <span className="font-black text-[#2d2a26]">{label}:</span>{" "}
      <span className="text-[#2d2a26]/75">{children}</span>
    </p>
  );
}

function BeheerHome({
  syncStatus,
  isLoadingData,
  latestInvoiceNumber,
  onOpen,
  onDownloadExcel,
  onDownloadJson,
}: Readonly<{
  syncStatus: string;
  isLoadingData: boolean;
  latestInvoiceNumber: string;
  onOpen: (view: TabId) => void;
  onDownloadExcel: () => void;
  onDownloadJson: () => void;
}>) {
  const [downloadsOpen, setDownloadsOpen] = useState(false);
  const dataTiles = [
    {
      title: "Grondstoffen",
      icon: "/UI-apps_data.svg",
      onClick: () => onOpen("ingredienten" as TabId),
    },
    {
      title: "Halffabricaten",
      icon: "/UI-apps_productie.svg",
      onClick: () => onOpen("halffabricaten" as TabId),
    },
    {
      title: "Verpakkingen",
      icon: "/UI-apps_data.svg",
      onClick: () => onOpen("verpakkingen" as TabId),
    },
  ];

  return (
    <section className="grid gap-2.5 sm:gap-3">
      <header className="mb-1 flex min-w-0 items-center gap-3 pb-1 sm:gap-4">
        <span
          aria-hidden="true"
          className="block h-[clamp(0.9rem,3.2vw,1.5rem)] w-[clamp(0.9rem,3.2vw,1.5rem)] shrink-0 bg-[#ef5737]"
          style={{
            WebkitMask: `url("${strikIcons.data}") center / contain no-repeat`,
            mask: `url("${strikIcons.data}") center / contain no-repeat`,
          }}
        />
        <h1 className="min-w-0 text-[clamp(2rem,6vw,3.4rem)] font-black uppercase leading-none tracking-[0.16em] text-[#ef5737]">
          Data
        </h1>
      </header>

      <div className="grid gap-2.5">
        <button
          type="button"
          onClick={() => onOpen("marge" as TabId)}
          className="group flex min-h-14 items-center justify-between gap-3 rounded-lg border border-[#ef5737]/30 bg-[#fff4f1] px-3 py-2.5 text-left shadow-sm transition hover:bg-[#fff0eb] active:scale-[0.99] sm:min-h-16 sm:px-4"
        >
          <span className="flex min-w-0 items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[#ef5737] sm:h-10 sm:w-10">
              <span
                aria-hidden="true"
                className="block h-5 w-5 bg-white"
                style={{
                  WebkitMask: `url("${strikIcons.data}") center / contain no-repeat`,
                  mask: `url("${strikIcons.data}") center / contain no-repeat`,
                }}
              />
            </span>
            <span className="truncate text-xl font-black leading-tight text-[#1a1815] sm:text-2xl">
              Marge overzicht
            </span>
          </span>
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[#ef5737] text-xl font-black text-white shadow-sm transition group-active:scale-[0.96] sm:h-10 sm:w-10">
            &gt;
          </span>
        </button>

        <div className="grid gap-2 sm:grid-cols-3">
          {dataTiles.map((tile) => (
            <DataTileButton
              key={tile.title}
              title={tile.title}
              icon={tile.icon}
              onClick={tile.onClick}
            />
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
          <div className="relative min-w-0 sm:w-[12rem]">
            <DataIconButton
              title="Download recepten"
              icon={<DownloadIcon />}
              onClick={() => setDownloadsOpen((current) => !current)}
            />
            {downloadsOpen && (
              <div className="absolute left-0 right-0 z-20 mt-2 grid gap-1 rounded-lg border border-[#dbe9ee] bg-white p-1.5 shadow-lg sm:left-auto sm:right-0 sm:top-full sm:w-[13rem]">
                <button
                  type="button"
                  onClick={() => {
                    setDownloadsOpen(false);
                    onDownloadExcel();
                  }}
                  className="rounded-md px-3 py-2 text-left text-xs font-black text-[#1a1815] hover:bg-[#f4f9fb]"
                >
                  Excel downloaden
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDownloadsOpen(false);
                    onDownloadJson();
                  }}
                  className="rounded-md px-3 py-2 text-left text-xs font-black text-[#1a1815] hover:bg-[#f4f9fb]"
                >
                  Herstelbestand
                </button>
              </div>
            )}
          </div>
          <div className="min-w-0 sm:w-[12rem]">
            <DataIconButton
              title="Facturen inladen"
              icon={<UploadIcon />}
              onClick={() => onOpen("factuurimport" as TabId)}
            />
          </div>
        </div>
      </div>

      <p className="text-xs font-bold leading-relaxed text-[#707070]">
        {isLoadingData ? "Laden..." : syncStatus}
        {latestInvoiceNumber ? ` Laatste factuur: ${latestInvoiceNumber}.` : ""}
      </p>
    </section>
  );
}

function DataTileButton({
  title,
  icon,
  onClick,
}: Readonly<{
  title: string;
  icon: string;
  onClick: () => void;
}>) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex min-h-10 items-center justify-between gap-2 rounded-lg border border-[#dbe9ee] bg-white px-2.5 py-2 text-left shadow-sm transition hover:bg-[#f4f9fb] active:scale-[0.99] sm:min-h-11"
    >
      <span className="flex min-w-0 items-center gap-2">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[#b9d7ea] sm:h-8 sm:w-8">
          <img src={icon} alt="" className="h-4 w-4 object-contain sm:h-5 sm:w-5" />
        </span>
        <span className="truncate text-sm font-black leading-tight text-[#1a1815] sm:text-base">
          {title}
        </span>
      </span>
      <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[#e8f3f8] text-sm font-black transition group-active:scale-[0.96]">
        &gt;
      </span>
    </button>
  );
}

function DataIconButton({
  title,
  icon,
  onClick,
}: Readonly<{
  title: string;
  icon: ReactNode;
  onClick: () => void;
}>) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-h-11 w-full min-w-0 items-center justify-center gap-2 rounded-lg border border-[#dbe9ee] bg-white px-2.5 py-2 text-xs font-black text-[#1a1815] shadow-sm transition hover:bg-[#f4f9fb] active:scale-[0.99]"
    >
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[#b9d7ea] text-[#1a1815]">
        {icon}
      </span>
      <span className="truncate">{title}</span>
    </button>
  );
}

function DownloadIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path
        d="M12 4v10m0 0 4-4m-4 4-4-4M5 18h14"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.2"
      />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path
        d="M12 20V10m0 0 4 4m-4-4-4 4M5 6h14"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.2"
      />
    </svg>
  );
}

function BakeryHomeManager({
  home,
  selectedWeek,
  status,
  uploadStatus,
  onSelectWeek,
  onUploadOfferImage,
}: Readonly<{
  home: BakeryHomeData;
  selectedWeek: string;
  status: string;
  uploadStatus: string;
  onSelectWeek: (weekStart: string) => void;
  onUploadOfferImage: (
    file: File | null,
    label: string,
    weekCount?: number
  ) => void;
}>) {
  const [label, setLabel] = useState("");
  const [appliesMultipleWeeks, setAppliesMultipleWeeks] = useState(false);
  const [weekCount, setWeekCount] = useState(2);
  const selectedOffer = offerForWeek(home, selectedWeek);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setLabel(selectedOffer?.label || "");
    }, 0);

    return () => window.clearTimeout(timer);
  }, [selectedOffer?.label, selectedWeek]);

  return (
    <div className="border border-[#c3d3bc] bg-white p-6 lg:col-span-2">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-[#8c8c8c]">
        Voorpagina
      </p>
      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <div className="grid gap-4">
          <div className="grid gap-3 sm:grid-cols-[2.5rem_minmax(0,1fr)_2.5rem]">
            <button
              type="button"
              onClick={() => onSelectWeek(addDays(selectedWeek, -7))}
              className="border border-[#c3d3bc] bg-[#c3d3bc] text-3xl leading-none"
              aria-label="Vorige week"
            >
              ‹
            </button>
            <div className="flex items-center justify-center border border-[#c3d3bc] px-3 py-2 text-sm font-black uppercase tracking-[0.08em]">
              {formatWeekRange(selectedWeek)}
            </div>
            <button
              type="button"
              onClick={() => onSelectWeek(addDays(selectedWeek, 7))}
              className="border border-[#c3d3bc] bg-[#c3d3bc] text-3xl leading-none"
              aria-label="Volgende week"
            >
              ›
            </button>
          </div>

          <label className="grid gap-1 text-xs font-black uppercase tracking-[0.12em] text-[#8c8c8c]">
            Label
            <input
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="Bijvoorbeeld Vaderdag aanbieding"
              className="min-w-0 border border-[#c3d3bc] bg-white px-3 py-3 text-sm font-bold normal-case tracking-normal text-[#252525] outline-none focus:ring-2 focus:ring-[#c3d3bc]"
            />
          </label>

          <label className="grid gap-2 text-xs font-black uppercase tracking-[0.12em] text-[#8c8c8c]">
            Aanbiedingfoto
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(event) => {
                void onUploadOfferImage(
                  event.currentTarget.files?.[0] || null,
                  label,
                  appliesMultipleWeeks ? weekCount : 1
                );
                event.currentTarget.value = "";
              }}
              className="min-w-0 border border-[#c3d3bc] bg-white px-3 py-3 text-sm font-bold normal-case tracking-normal text-[#252525]"
            />
          </label>

          <div className="flex flex-wrap items-center gap-3 border border-[#c3d3bc] bg-[#f8f8f6] px-3 py-2">
            <label className="inline-flex min-w-0 items-center gap-2 text-xs font-black uppercase tracking-[0.08em] text-[#252525]">
              <input
                type="checkbox"
                checked={appliesMultipleWeeks}
                onChange={(event) => setAppliesMultipleWeeks(event.target.checked)}
                className="h-4 w-4 border-[#c3d3bc] accent-[#9bc79c]"
              />
              Geldt voor meerdere weken
            </label>
            {appliesMultipleWeeks && (
              <label className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.08em] text-[#8c8c8c]">
                Aantal
                <select
                  value={weekCount}
                  onChange={(event) => setWeekCount(Number(event.target.value))}
                  className="border border-[#c3d3bc] bg-white px-2 py-1 text-xs font-black text-[#252525]"
                >
                  {[2, 3, 4].map((count) => (
                    <option key={count} value={count}>
                      {count} weken
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>

          <p className="text-xs font-bold leading-relaxed text-[#707070]">
            Foto&apos;s worden als WordPress media opgeslagen; de app bewaart alleen de link bij de juiste week.
          </p>
          {(uploadStatus || status) && (
            <p className="text-xs font-bold text-[#707070]">
              {uploadStatus || status}
            </p>
          )}
        </div>

        <div className="border border-[#c3d3bc] bg-[#f8f8f6] p-3">
          <p className="mb-2 text-xs font-black uppercase tracking-[0.12em] text-[#8c8c8c]">
            Huidige foto
          </p>
          <div className="flex aspect-[4/5] items-center justify-center overflow-hidden bg-white">
            {selectedOffer?.imageUrl ? (
              <img
                src={selectedOffer.imageUrl}
                alt=""
                className="h-full w-full object-contain"
              />
            ) : (
              <p className="px-4 text-center text-xs font-black uppercase tracking-[0.14em] text-[#2d2a26]/35">
                Nog geen foto voor deze week
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function createBlankRecipe(type: RecipeType): Recipe {
  const now = new Date().toISOString().slice(0, 10);
  const idPrefix = type === "semiFinished" ? "hf-new" : "recipe-new";

  return {
    id: `${idPrefix}-${Date.now()}`,
    name: type === "semiFinished" ? "Nieuw halffabricaat" : "Nieuw recept",
    type,
    productGroup: type === "semiFinished" ? "Vullingen" : "Gebak",
    strikArticleNumber: "",
    createdAt: now,
    standardBatchQuantity: type === "semiFinished" ? 1 : 40,
    standardBatchUnit: type === "semiFinished" ? "kg" : "stuk",
    salesPrice: type === "semiFinished" ? 0 : 0,
    costPrice: 0,
    previousCostPrice: 0,
    targetMargin: type === "semiFinished" ? 0 : 80,
    currentMargin: 0,
    status: "active",
    ingredients: [],
    semiFinishedItems: [],
    workInstructions: [],
    preparationSteps: [],
    finishingSteps: [],
    equipment: [],
    allergens: [],
    internalNotes: "",
    isWorkModeVisible: true,
    workCategories: [],
    version: "v1",
    lastUpdated: now,
    portionLabel: type === "semiFinished" ? "1 kg" : "1 stuk",
    batchSize: type === "semiFinished" ? "1 kg" : "40 stuks",
    photoHint: type === "semiFinished" ? "" : "Nieuw recept",
    photoPreviewDataUrl: "",
    photoFileName: "",
    photoUpdatedAt: "",
    notes: "",
    linkedFinalProductIds: [],
    packagingItems: [],
    packagingCost: 0,
    decorationCost: 0,
    decorationMargin: 0,
    averageSalesQuantity: 0,
    averageSalesPeriod: "week",
    canProduceAhead: false,
    desiredProductionFrequencyDays: 7,
    desiredProductionBatchQuantity: type === "semiFinished" ? 0 : 40,
    lastProducedAt: "",
    lastProducedQuantity: 0,
    productionLog: [],
    productionRequests: [],
  };
}

function uniqueNewRecipeId(prefix: string, currentRecipes: Recipe[]) {
  const baseId = `${prefix}-${Date.now()}`;
  let id = baseId;
  let counter = 1;

  while (currentRecipes.some((recipe) => recipe.id === id)) {
    counter += 1;
    id = `${baseId}-${counter}`;
  }

  return id;
}

function localDateFromInput(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return new Date(value);

  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function createRecepturenLocalId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

function backupStamp() {
  const date = new Date();
  const parts = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
    String(date.getHours()).padStart(2, "0"),
    String(date.getMinutes()).padStart(2, "0"),
  ];

  return `${parts[0]}-${parts[1]}-${parts[2]}_${parts[3]}-${parts[4]}`;
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function downloadRecepturenJsonBackup(data: RecepturenData) {
  const backup = {
    exportedAt: new Date().toISOString(),
    source: "Strik recepturen",
    version: 1,
    ...data,
  };
  const blob = new Blob([JSON.stringify(backup, null, 2)], {
    type: "application/json",
  });

  downloadBlob(blob, `strik-recepturen-backup-${backupStamp()}.json`);
}

async function downloadRecepturenExcelBackup(data: RecepturenData) {
  const XLSX = await import("xlsx");
  const workbook = XLSX.utils.book_new();
  const ingredientById = new Map(
    data.ingredients.map((ingredient) => [ingredient.id, ingredient])
  );
  const recipeById = new Map(data.recipes.map((recipe) => [recipe.id, recipe]));

  appendSheet(
    XLSX,
    workbook,
    "Recepten",
    data.recipes.map((recipe) => ({
      id: recipe.id,
      naam: recipe.name,
      strikArtikelnummer: recipe.strikArticleNumber || "",
      soort: recipeTypeLabel(recipe.type),
      groep: recipe.productGroup,
      status: recipe.status,
      batch: recipe.standardBatchQuantity || "",
      batchEenheid: recipe.standardBatchUnit || "",
      batchTekst: recipe.batchSize,
      batchgewichtKg: recipeBatchWeightKg(recipe),
      verkoopprijsInclBtw: recipe.salesPrice,
      kostprijsExBtw: recipe.costPrice,
      margeExBtw: recipeCurrentMargin(recipe),
      doelmarge: recipe.targetMargin,
      laatstGewijzigd: recipe.lastUpdated,
      opmerkingen: recipe.internalNotes || recipe.notes || "",
    }))
  );

  appendSheet(
    XLSX,
    workbook,
    "Grondstoffen",
    data.ingredients.map((ingredient) => ({
      id: ingredient.id,
      naam: ingredient.name,
      leverancier: ingredient.supplier,
      artikelnummer: ingredient.supplierArticleNumber,
      verpakking: ingredient.packageSize,
      rekeneenheid: ingredient.recipeUnit,
      laatstePrijs: ingredient.lastPrice,
      prijsPerBasiseenheid: ingredient.pricePerBaseUnit,
      allergenen: ingredient.allergens.join(", "),
      aliases: ingredient.aliases.join(", "),
      status: ingredient.status,
      laatsteFactuur: ingredient.lastInvoice,
      laatstGewijzigd: ingredient.lastUpdated,
    }))
  );

  appendSheet(
    XLSX,
    workbook,
    "Verpakkingen",
    (data.packagingItems || []).map((packaging) => ({
      id: packaging.id,
      naam: packaging.name,
      leverancier: packaging.supplier,
      artikelnummer: packaging.articleNumber,
      verpakking: packaging.packageSize,
      aantalPerVerpakking: packaging.quantityPerPackage,
      prijsPerVerpakking: packaging.packagePrice,
      prijsPerStuk: packaging.unitPrice,
      status: packaging.status,
      laatstGewijzigd: packaging.lastUpdated,
    }))
  );

  appendSheet(
    XLSX,
    workbook,
    "Recept grondstoffen",
    data.recipes.flatMap((recipe) =>
      recipe.ingredients.map((line) => {
        const ingredient = ingredientById.get(line.ingredientId);

        return {
          receptId: recipe.id,
          recept: recipe.name,
          receptSoort: recipeTypeLabel(recipe.type),
          grondstofId: line.ingredientId,
          grondstof: ingredient?.name || line.ingredientId,
          hoeveelheid: line.quantity,
          eenheid: line.unit,
          hoeveelheidTekst: quantityLabel(line.quantity, line.unit),
          kost: line.costContribution,
        };
      })
    )
  );

  const packagingById = new Map(
    (data.packagingItems || []).map((packaging) => [packaging.id, packaging])
  );

  appendSheet(
    XLSX,
    workbook,
    "Recept verpakkingen",
    data.recipes.flatMap((recipe) =>
      (recipe.packagingItems || []).map((line) => {
        const packaging = packagingById.get(line.packagingId);

        return {
          receptId: recipe.id,
          recept: recipe.name,
          verpakkingId: line.packagingId,
          verpakking: packaging?.name || line.nameSnapshot || line.packagingId,
          aantalPerProduct: line.quantity,
          prijsPerStuk: line.unitPrice,
          kostPerProduct: line.costContribution,
        };
      })
    )
  );

  appendSheet(
    XLSX,
    workbook,
    "Halffabricaten in recept",
    data.recipes.flatMap((recipe) =>
      recipe.semiFinishedItems.map((line) => {
        const semiFinished = recipeById.get(line.semiFinishedRecipeId);

        return {
          receptId: recipe.id,
          recept: recipe.name,
          halffabricaatId: line.semiFinishedRecipeId,
          halffabricaat: semiFinished?.name || line.semiFinishedRecipeId,
          hoeveelheid: line.quantity,
          eenheid: line.unit,
          hoeveelheidTekst: quantityLabel(line.quantity, line.unit),
          kost: line.costContribution,
        };
      })
    )
  );

  appendSheet(
    XLSX,
    workbook,
    "Stappen",
    data.recipes.flatMap((recipe) => [
      ...recipe.preparationSteps.map((step, index) => ({
        receptId: recipe.id,
        recept: recipe.name,
        soort: "Bereiding",
        stap: index + 1,
        tekst: step,
      })),
      ...(recipe.workInstructions || []).map((step, index) => ({
        receptId: recipe.id,
        recept: recipe.name,
        soort: "Werkmodus",
        stap: index + 1,
        tekst: step,
      })),
      ...(recipe.finishingSteps || []).map((step, index) => ({
        receptId: recipe.id,
        recept: recipe.name,
        soort: "Afwerking",
        stap: index + 1,
        tekst: step,
      })),
    ])
  );

  appendSheet(
    XLSX,
    workbook,
    "Productielog",
    data.recipes.flatMap((recipe) =>
      productionLogForRecipe(recipe).map((entry) => ({
        receptId: recipe.id,
        recept: recipe.name,
        datum: entry.date,
        hoeveelheid: entry.quantity,
        eenheid: recipe.standardBatchUnit || "",
        bron: entry.source || "",
        notitie: entry.note || "",
      }))
    )
  );

  appendSheet(
    XLSX,
    workbook,
    "Facturen",
    data.invoiceImports.map((invoice) => ({
      id: invoice.id,
      leverancier: invoice.supplier,
      factuurnummer: invoice.invoiceNumber,
      factuurdatum: invoice.invoiceDate,
      geupload: invoice.uploadedAt,
      status: invoice.status,
      regels: invoice.lines.length,
    }))
  );

  appendSheet(
    XLSX,
    workbook,
    "Factuurregels",
    data.invoiceImports.flatMap((invoice) =>
      invoice.lines.map((line) => ({
        factuurId: invoice.id,
        leverancier: invoice.supplier,
        factuurnummer: invoice.invoiceNumber,
        artikelnummer: line.articleNumber,
        omschrijving: line.description,
        aantal: line.quantity,
        eenheid: line.unit,
        totaalprijs: line.totalPrice,
        prijsPerEenheid: line.pricePerUnit,
        gekoppeldeGrondstof: line.matchedIngredientId
          ? ingredientById.get(line.matchedIngredientId)?.name ||
            line.matchedIngredientId
          : "",
        status: line.reviewStatus,
      }))
    )
  );

  const buffer = XLSX.write(workbook, {
    bookType: "xlsx",
    type: "array",
  }) as ArrayBuffer;

  downloadBlob(
    new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    `strik-recepturen-overzicht-${backupStamp()}.xlsx`
  );
}

function appendSheet(
  XLSX: typeof import("xlsx"),
  workbook: import("xlsx").WorkBook,
  sheetName: string,
  rows: Array<Record<string, string | number | boolean>>
) {
  const sheet = XLSX.utils.json_to_sheet(rows.length ? rows : [{ leeg: true }]);
  XLSX.utils.book_append_sheet(workbook, sheet, sheetName.slice(0, 31));
}

function mergeIngredients(
  currentIngredients: Ingredient[],
  importedIngredients: Ingredient[]
) {
  const merged = [...currentIngredients];

  importedIngredients.forEach((importedIngredient) => {
    const existingIndex = merged.findIndex((ingredient) => {
      const sameArticle =
        importedIngredient.supplierArticleNumber !== "-" &&
        ingredient.supplierArticleNumber !== "-" &&
        normalizeSearch(ingredient.supplierArticleNumber) ===
          normalizeSearch(importedIngredient.supplierArticleNumber);

      return (
        sameArticle ||
        normalizeSearch(ingredient.name) === normalizeSearch(importedIngredient.name)
      );
    });

    if (existingIndex >= 0) {
      merged[existingIndex] = {
        ...merged[existingIndex],
        ...importedIngredient,
        id: merged[existingIndex].id,
        aliases: Array.from(
          new Set([
            ...merged[existingIndex].aliases,
            ...importedIngredient.aliases,
            importedIngredient.name,
          ])
        ),
      };
    } else {
      merged.unshift(importedIngredient);
    }
  });

  return merged;
}

function mergeHefeSeedIngredients(currentIngredients: Ingredient[]) {
  const merged = [...currentIngredients];

  hefeIngredients.forEach((hefeIngredient) => {
    const existingIndex = merged.findIndex((ingredient) => {
      const sameArticle =
        hefeIngredient.supplierArticleNumber !== "-" &&
        ingredient.supplierArticleNumber !== "-" &&
        normalizeSearch(ingredient.supplierArticleNumber) ===
          normalizeSearch(hefeIngredient.supplierArticleNumber);
      const sameName =
        normalizeSearch(ingredient.name) === normalizeSearch(hefeIngredient.name);

      return sameArticle || sameName;
    });

    if (existingIndex >= 0) {
      merged[existingIndex] = {
        ...merged[existingIndex],
        aliases: Array.from(
          new Set([
            ...merged[existingIndex].aliases,
            ...hefeIngredient.aliases,
            hefeIngredient.name,
          ])
        ),
      };
    } else {
      merged.push(hefeIngredient);
    }
  });

  return merged;
}

function mergeRecipes(currentRecipes: Recipe[], importedRecipes: Recipe[]) {
  const merged = [...currentRecipes];

  importedRecipes.forEach((importedRecipe) => {
    const normalizedImportedRecipe = stripSemiFinishedPhoto(importedRecipe);
    const existingIndex = merged.findIndex(
      (recipe) =>
        normalizeSearch(recipe.name) === normalizeSearch(normalizedImportedRecipe.name)
    );

    if (existingIndex >= 0) {
      merged[existingIndex] = {
        ...merged[existingIndex],
        ...normalizedImportedRecipe,
        id: merged[existingIndex].id,
        photoPreviewDataUrl:
          normalizedImportedRecipe.type === "semiFinished"
            ? ""
            : normalizedImportedRecipe.photoPreviewDataUrl ||
              merged[existingIndex].photoPreviewDataUrl,
        photoFileName:
          normalizedImportedRecipe.type === "semiFinished"
            ? ""
            : normalizedImportedRecipe.photoFileName ||
              merged[existingIndex].photoFileName,
        photoUpdatedAt:
          normalizedImportedRecipe.type === "semiFinished"
            ? ""
            : normalizedImportedRecipe.photoUpdatedAt ||
              merged[existingIndex].photoUpdatedAt,
      };
    } else {
      merged.unshift(normalizedImportedRecipe);
    }
  });

  return merged;
}

function stripSemiFinishedPhoto(recipe: Recipe): Recipe {
  if (recipe.type !== "semiFinished") return recipe;

  return {
    ...recipe,
    photoHint: "",
    photoPreviewDataUrl: "",
    photoFileName: "",
    photoUpdatedAt: "",
    packagingCost: 0,
    decorationCost: 0,
    decorationMargin: 0,
    targetMargin: 0,
    salesPrice: 0,
  };
}
