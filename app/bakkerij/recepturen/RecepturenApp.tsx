"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useState } from "react";
import StrikBackButton from "../../StrikBackButton";
import FactuurImport from "./FactuurImport";
import HalffabricatenList from "./HalffabricatenList";
import IngredientsList from "./IngredientsList";
import MargeOverzicht from "./MargeOverzicht";
import { bakeryIcons, ingredients, invoiceImports, recipes } from "./mockData";
import RecipeDetail from "./RecipeDetail";
import RecipeDataImport from "./RecipeDataImport";
import RecipesList from "./RecipesList";
import RecepturenDashboard from "./RecepturenDashboard";
import RecepturenWorkMode from "./RecepturenWorkMode";
import {
  fetchRecepturenData,
  pruneInvoiceImports,
  saveRecepturenData,
  type RecepturenData,
} from "./recepturenApi";
import type {
  Ingredient,
  InvoiceImport,
  InvoiceLine,
  ProductionLogEntry,
  Recipe,
  RecipeType,
} from "./types";
import {
  ingredientPackagePrice,
  normalizeSearch,
  normalizePackagePrice,
  pricePerBaseUnitFromPackagePrice,
  productionLogForRecipe,
  quantityLabel,
  recalculateAllRecipeCosts,
  registerRecipeProduction,
  registerRecipeStockAdjustment,
  recipeBatchWeightKg,
  recipeTypeLabel,
  syncRecipeProductionMetadata,
} from "./utils";

const tabs = [
  { id: "dashboard", label: "Dashboard" },
  { id: "recepten", label: "Recepten" },
  { id: "halffabricaten", label: "Halffabricaten" },
  { id: "ingredienten", label: "Ingredienten" },
  { id: "import", label: "Bestand import" },
  { id: "factuurimport", label: "Factuurimport" },
  { id: "marge", label: "Marge-overzicht" },
] as const;

type TabId = (typeof tabs)[number]["id"];
type RecepturenMode = "work" | "management";

function hasStoredRecepturenData(data: RecepturenData) {
  return Boolean(
    data.ingredients.length || data.recipes.length || data.invoiceImports.length
  );
}

function invoiceStatusForLines(lines: InvoiceLine[]): InvoiceImport["status"] {
  if (lines.some((item) => item.reviewStatus === "pending")) return "review";
  if (lines.length && lines.every((item) => item.reviewStatus === "ignored")) {
    return "ignored";
  }
  if (lines.some((item) => item.reviewStatus === "reverted")) return "reverted";

  return "processed";
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

export default function RecepturenApp() {
  const [mode, setMode] = useState<RecepturenMode>("work");
  const [activeTab, setActiveTab] = useState<TabId>("dashboard");
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [recipeEditorStartsOpen, setRecipeEditorStartsOpen] = useState(false);
  const [recipeItems, setRecipeItems] = useState(recipes);
  const [ingredientItems, setIngredientItems] = useState(ingredients);
  const [invoiceItems, setInvoiceItems] = useState(invoiceImports);
  const [syncStatus, setSyncStatus] = useState("Lokale receptuurdata geladen.");
  const [isLoadingData, setIsLoadingData] = useState(true);
  const latestInvoice = invoiceItems[0] || invoiceImports[0];

  function persistRecepturenData(
    nextData: RecepturenData,
    successMessage = "Recepturen opgeslagen in WordPress."
  ) {
    setSyncStatus("Opslaan naar WordPress...");

    void saveRecepturenData(nextData).then((result) => {
      setSyncStatus(
        result.ok ? successMessage : `Lokaal bijgewerkt. ${result.message}`
      );
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
    const nextRecipes = recalculateAllRecipeCosts(recipeItems, nextIngredients, {
      markAsUpdated: true,
    });

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
        setIngredientItems(
          result.data.ingredients.length ? result.data.ingredients : ingredients
        );
        setRecipeItems(result.data.recipes.length ? result.data.recipes : recipes);
        setInvoiceItems(
          result.data.invoiceImports.length
            ? result.data.invoiceImports
            : invoiceImports
        );
        setSyncStatus("Recepturen uit WordPress geladen.");
      } else if (result.ok) {
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
      { markAsUpdated: true }
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
      { markAsUpdated: true }
    );

    setRecipeItems(recalculatedRecipes);
    setSelectedRecipe(null);
    setRecipeEditorStartsOpen(false);
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

  function openRecipe(recipe: Recipe) {
    setRecipeEditorStartsOpen(false);
    setSelectedRecipe(recipe);
  }

  function createRecipe(type: RecipeType) {
    setRecipeEditorStartsOpen(true);
    setSelectedRecipe(createBlankRecipe(type));
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
      { markAsUpdated: true }
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
    updateInvoiceLine(invoiceId, line, {
      matchedIngredientId: ingredientId,
      reviewStatus: "pending",
    });
  }

  function importInvoice(invoice: InvoiceImport) {
    const nextInvoices = pruneInvoiceImports([invoice, ...invoiceItems]);

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

  function importRecipes(importedRecipes: Recipe[]) {
    if (!importedRecipes.length) return;

    const mergedRecipes = mergeRecipes(recipeItems, importedRecipes);
    const nextRecipes = recalculateAllRecipeCosts(mergedRecipes, ingredientItems, {
      markAsUpdated: true,
    });

    setRecipeItems(nextRecipes);
    syncSelectedRecipe(nextRecipes);
    persistRecepturenData(
      {
        ingredients: ingredientItems,
        recipes: nextRecipes,
        invoiceImports: invoiceItems,
      },
      `${importedRecipes.length} recepten ingeladen en kostprijzen berekend.`
    );
  }

  function currentRecepturenData(): RecepturenData {
    return {
      ingredients: ingredientItems,
      recipes: recipeItems,
      invoiceImports: invoiceItems,
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

  return (
    <main className="min-h-screen bg-[#f4f0ea] px-3 py-4 pb-24 text-[#2d2a26] sm:px-4 sm:py-5">
      <div className="mx-auto w-full max-w-7xl">
        <StrikBackButton />

        <header className="mb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#dce8d6] sm:h-12 sm:w-12">
                <img
                  src={bakeryIcons.recepturen}
                  alt=""
                  className="h-7 w-7 object-contain sm:h-8 sm:w-8"
                />
              </span>
              <div className="min-w-0">
                <p className="text-[0.68rem] font-black uppercase tracking-[0.16em] text-[#8a5b10]">
                  Bakkerij
                </p>
                <h1
                  className="truncate text-4xl leading-none text-[#050505] sm:text-5xl"
                  style={{
                    fontFamily: "Butterscotch, Marker Felt, cursive",
                    letterSpacing: "0",
                  }}
                >
                  Recepturen
                </h1>
              </div>
            </div>

            {mode === "management" && (
              <div className="rounded-2xl border border-[#efc2bb] bg-[#fff4f1] px-3 py-2 text-right">
                <p className="text-[0.65rem] font-black uppercase tracking-[0.14em] text-[#a83e31]">
                  Actie
                </p>
                <p className="text-lg font-black leading-none">8 marge</p>
              </div>
            )}
          </div>
        </header>

        <div className="mb-4 grid gap-2 sm:grid-cols-[minmax(0,24rem)_minmax(0,1fr)] sm:items-center">
          <div className="relative rounded-full bg-[#2d2a26] p-1.5 shadow-sm">
            <span
              className={`absolute inset-y-1.5 left-1.5 w-[calc(50%-0.375rem)] rounded-full bg-[#c3d3bc] transition-transform duration-200 ${
                mode === "management" ? "translate-x-full" : "translate-x-0"
              }`}
            />
            <div className="relative grid grid-cols-2">
              <button
                type="button"
                onClick={() => setMode("work")}
                className={`rounded-full px-4 py-2.5 text-sm font-black transition ${
                  mode === "work" ? "text-[#2d2a26]" : "text-white/68"
                }`}
              >
                Werk
              </button>
              <button
                type="button"
                onClick={() => setMode("management")}
                className={`rounded-full px-4 py-2.5 text-sm font-black transition ${
                  mode === "management" ? "text-[#2d2a26]" : "text-white/68"
                }`}
              >
                Management
              </button>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-start gap-2 sm:justify-end">
            {mode === "management" && (
              <>
                <button
                  type="button"
                  onClick={downloadExcelBackup}
                  className="rounded-full bg-white px-3 py-2 text-xs font-black text-[#2d2a26]/70 shadow-sm"
                >
                  Download Excel
                </button>
                <button
                  type="button"
                  onClick={downloadJsonBackup}
                  className="rounded-full bg-[#fff0bd] px-3 py-2 text-xs font-black text-[#7a5a18] shadow-sm"
                >
                  Herstelbestand
                </button>
              </>
            )}
            <p className="text-xs font-bold leading-snug text-[#2d2a26]/50 sm:text-right">
              {isLoadingData
                ? "Laden..."
                : mode === "work"
                  ? "Recepten klaar."
                  : syncStatus}
            </p>
          </div>
        </div>

        {mode === "work" && (
          <RecepturenWorkMode
            recipes={recipeItems}
            ingredients={ingredientItems}
            onMarkProduced={markRecipeProduced}
            onAdjustStock={adjustRecipeStock}
            onUpdateProductionLog={updateProductionLogEntry}
            onDeleteProductionLog={deleteProductionLogEntry}
          />
        )}

        {mode === "management" && (
          <nav className="sticky top-2 z-20 mb-5 overflow-x-auto rounded-[1.25rem] border border-[#e7e0d8] bg-white/95 p-2 shadow-sm backdrop-blur">
            <div className="flex min-w-max gap-2">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`rounded-full px-4 py-2.5 text-sm font-black transition active:scale-[0.98] ${
                    activeTab === tab.id
                      ? "bg-[#c3d3bc] text-[#2d2a26]"
                      : "bg-[#f8f6f3] text-[#2d2a26]/55 hover:text-[#2d2a26]"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </nav>
        )}

        {mode === "management" && activeTab === "dashboard" && (
          <div className="grid gap-4">
            <RecepturenDashboard
              recipes={recipeItems}
              ingredients={ingredientItems}
              invoice={latestInvoice}
            />
          </div>
        )}
        {mode === "management" && activeTab === "recepten" && (
          <RecipesList
            recipes={recipeItems}
            onOpenRecipe={openRecipe}
            onCreateRecipe={() => createRecipe("finalProduct")}
            onRecalculateAll={recalculateAllRecipes}
          />
        )}
        {mode === "management" && activeTab === "halffabricaten" && (
          <HalffabricatenList
            recipes={recipeItems}
            onOpenRecipe={openRecipe}
            onCreateRecipe={() => createRecipe("semiFinished")}
          />
        )}
        {mode === "management" && activeTab === "ingredienten" && (
          <IngredientsList
            ingredients={ingredientItems}
            recipes={recipeItems}
            onUpdateIngredient={saveIngredient}
            onDeleteIngredient={deleteIngredient}
            onDeleteIngredients={(ingredientsToDelete) =>
              deleteIngredients(
                ingredientsToDelete,
                `${ingredientsToDelete.length} HF-grondstoffen opgeruimd.`
              )
            }
          />
        )}
        {mode === "management" && activeTab === "import" && (
          <RecipeDataImport
            ingredients={ingredientItems}
            recipes={recipeItems}
            onImportIngredients={importIngredients}
            onImportRecipes={importRecipes}
          />
        )}
        {mode === "management" && activeTab === "factuurimport" && (
          <FactuurImport
            invoice={latestInvoice}
            ingredients={ingredientItems}
            recipes={recipeItems}
            onApproveLine={approveInvoiceLine}
            onIgnoreLine={ignoreInvoiceLine}
            onIgnoreInvoice={ignoreInvoice}
            onRevertInvoice={revertInvoice}
            onDeleteInvoice={deleteInvoice}
            onMatchLine={matchInvoiceLine}
            onImportInvoice={importInvoice}
          />
        )}
        {mode === "management" && activeTab === "marge" && (
          <MargeOverzicht
            recipes={recipeItems}
            onOpenRecipe={openRecipe}
          />
        )}
        {mode === "management" && selectedRecipe && (
          <RecipeDetail
            key={selectedRecipe.id}
            recipe={selectedRecipe}
            ingredients={ingredientItems}
            recipes={recipeItems}
            startInEditMode={recipeEditorStartsOpen}
            onClose={() => setSelectedRecipe(null)}
            onSaveRecipe={saveRecipe}
            onDeleteRecipe={deleteRecipe}
            onSaveIngredient={saveIngredient}
          />
        )}
      </div>
    </main>
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
    standardBatchQuantity: type === "semiFinished" ? 1 : 40,
    standardBatchUnit: type === "semiFinished" ? "kg" : "stuk",
    salesPrice: type === "semiFinished" ? 0 : 0,
    costPrice: 0,
    previousCostPrice: 0,
    targetMargin: type === "semiFinished" ? 0 : 75,
    currentMargin: 0,
    status: "draft",
    ingredients: [],
    semiFinishedItems: [],
    workInstructions: [],
    preparationSteps: ["Vul hier de eerste productiestap in."],
    finishingSteps: [],
    equipment: [],
    allergens: [],
    internalNotes: "",
    isWorkModeVisible: true,
    workCategories: type === "semiFinished" ? [] : ["gebak"],
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
    packagingCost: 0,
    decorationCost: 0,
    decorationMargin: 30,
    averageSalesQuantity: 0,
    averageSalesPeriod: "week",
    lastProducedAt: "",
    lastProducedQuantity: 0,
    productionLog: [],
    productionRequests: [],
  };
}

function localDateFromInput(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return new Date(value);

  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
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
      soort: recipeTypeLabel(recipe.type),
      groep: recipe.productGroup,
      status: recipe.status,
      batch: recipe.standardBatchQuantity || "",
      batchEenheid: recipe.standardBatchUnit || "",
      batchTekst: recipe.batchSize,
      batchgewichtKg: recipeBatchWeightKg(recipe),
      verkoopprijs: recipe.salesPrice,
      kostprijs: recipe.costPrice,
      marge: recipe.currentMargin,
      doelmarge: recipe.targetMargin,
      zichtbaarWerkmodus: recipe.isWorkModeVisible !== false,
      categorieen: recipe.workCategories?.join(", ") || "",
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
