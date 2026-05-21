"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useState } from "react";
import StrikBackButton from "../../StrikBackButton";
import StrikPageTitle from "../../StrikPageTitle";
import FactuurImport from "./FactuurImport";
import HalffabricatenList from "./HalffabricatenList";
import IngredientsList from "./IngredientsList";
import MargeOverzicht from "./MargeOverzicht";
import { bakeryIcons, ingredients, invoiceImports, recipes } from "./mockData";
import ProductieCalculator from "./ProductieCalculator";
import RecipeDetail from "./RecipeDetail";
import RecipesList from "./RecipesList";
import RecepturenDashboard from "./RecepturenDashboard";
import {
  fetchRecepturenData,
  saveRecepturenData,
  type RecepturenData,
} from "./recepturenApi";
import type { Ingredient, InvoiceImport, InvoiceLine, Recipe } from "./types";
import {
  ingredientPackagePrice,
  normalizePackagePrice,
  pricePerBaseUnitFromPackagePrice,
} from "./utils";

const tabs = [
  { id: "dashboard", label: "Dashboard" },
  { id: "recepten", label: "Recepten" },
  { id: "halffabricaten", label: "Halffabricaten" },
  { id: "ingredienten", label: "Ingredienten" },
  { id: "factuurimport", label: "Factuurimport" },
  { id: "marge", label: "Marge-overzicht" },
  { id: "productie", label: "Productiecalculator" },
] as const;

type TabId = (typeof tabs)[number]["id"];

function hasStoredRecepturenData(data: RecepturenData) {
  return Boolean(
    data.ingredients.length || data.recipes.length || data.invoiceImports.length
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
      item.articleNumber === line.articleNumber &&
      item.description === line.description
        ? { ...item, ...changes }
        : item
    );
    const hasPending = nextLines.some((item) => item.reviewStatus === "pending");
    const nextStatus: InvoiceImport["status"] = hasPending
      ? "review"
      : "processed";

    return {
      ...invoice,
      status: nextStatus,
      lines: nextLines,
    };
  });
}

export default function RecepturenApp() {
  const [activeTab, setActiveTab] = useState<TabId>("dashboard");
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
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

  function updateRecipe(updatedRecipe: Recipe) {
    const nextRecipes = recipeItems.map((recipe) =>
      recipe.id === updatedRecipe.id ? updatedRecipe : recipe
    );

    setRecipeItems(nextRecipes);
    setSelectedRecipe((current) =>
      current?.id === updatedRecipe.id ? updatedRecipe : current
    );
    persistRecepturenData({
      ingredients: ingredientItems,
      recipes: nextRecipes,
      invoiceImports: invoiceItems,
    });
  }

  function updateIngredient(updatedIngredient: Ingredient) {
    const nextIngredients = ingredientItems.map((ingredient) =>
      ingredient.id === updatedIngredient.id ? updatedIngredient : ingredient
    );

    setIngredientItems(nextIngredients);
    persistRecepturenData({
      ingredients: nextIngredients,
      recipes: recipeItems,
      invoiceImports: invoiceItems,
    });
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
    const nextInvoices = replaceInvoiceLine(invoiceItems, invoiceId, line, {
      reviewStatus: "approved",
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

    setInvoiceItems(nextInvoices);
    setIngredientItems(nextIngredients);
    persistRecepturenData(
      {
        ingredients: nextIngredients,
        recipes: recipeItems,
        invoiceImports: nextInvoices,
      },
      "Prijsupdate goedgekeurd en opgeslagen."
    );
  }

  function ignoreInvoiceLine(invoiceId: string, line: InvoiceLine) {
    updateInvoiceLine(invoiceId, line, { reviewStatus: "ignored" });
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
    const nextInvoices = [invoice, ...invoiceItems].slice(0, 100);

    setInvoiceItems(nextInvoices);
    persistRecepturenData(
      {
        ingredients: ingredientItems,
        recipes: recipeItems,
        invoiceImports: nextInvoices,
      },
      "Beko factuur opgeslagen in WordPress."
    );
  }

  return (
    <main className="min-h-screen bg-[#f4f0ea] px-4 py-6 pb-28 text-[#2d2a26]">
      <div className="mx-auto w-full max-w-7xl">
        <StrikBackButton />

        <header className="mb-5 grid gap-4 rounded-[1.75rem] border border-[#e7e0d8] bg-white/85 p-5 shadow-sm lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-center">
          <div>
            <div className="mb-2 flex items-center justify-center gap-3 lg:justify-start">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#dce8d6]">
                <img
                  src={bakeryIcons.recepturen}
                  alt=""
                  className="h-9 w-9 object-contain"
                />
              </span>
              <span className="rounded-full bg-[#fff0bd] px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-[#8a5b10]">
                Bakkerij
              </span>
            </div>
            <div className="lg:text-left">
              <StrikPageTitle title="Recepturen" />
            </div>
            <p className="mx-auto mt-3 max-w-3xl text-center text-sm font-semibold leading-relaxed text-[#2d2a26]/58 lg:mx-0 lg:text-left">
              Interne receptenbank voor eindproducten, halffabricaten,
              ingredienten, factuurprijsupdates, marges en productiecalculatie.
            </p>
          </div>

          <div className="rounded-[1.2rem] border border-[#efc2bb] bg-[#fff4f1] p-4">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[#a83e31]">
              Actie nodig
            </p>
            <p className="mt-2 text-2xl font-black">8</p>
            <p className="mt-1 text-xs font-bold leading-relaxed text-[#2d2a26]/55">
              producten onder gewenste marge na laatste {latestInvoice.supplier}
              -factuur.
            </p>
          </div>
        </header>

        <div className="mb-4 rounded-[1.1rem] border border-[#e7e0d8] bg-white/80 px-4 py-3 text-sm font-bold text-[#2d2a26]/58 shadow-sm">
          {isLoadingData ? "Recepturen laden..." : syncStatus}
        </div>

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

        {activeTab === "dashboard" && (
          <RecepturenDashboard
            recipes={recipeItems}
            ingredients={ingredientItems}
            invoice={latestInvoice}
          />
        )}
        {activeTab === "recepten" && (
          <RecipesList recipes={recipeItems} onOpenRecipe={setSelectedRecipe} />
        )}
        {activeTab === "halffabricaten" && (
          <HalffabricatenList
            recipes={recipeItems}
            onOpenRecipe={setSelectedRecipe}
          />
        )}
        {activeTab === "ingredienten" && (
          <IngredientsList
            ingredients={ingredientItems}
            recipes={recipeItems}
            onUpdateIngredient={updateIngredient}
          />
        )}
        {activeTab === "factuurimport" && (
          <FactuurImport
            invoice={latestInvoice}
            ingredients={ingredientItems}
            recipes={recipeItems}
            onApproveLine={approveInvoiceLine}
            onIgnoreLine={ignoreInvoiceLine}
            onMatchLine={matchInvoiceLine}
            onImportInvoice={importInvoice}
          />
        )}
        {activeTab === "marge" && (
          <MargeOverzicht
            recipes={recipeItems}
            onOpenRecipe={setSelectedRecipe}
          />
        )}
        {activeTab === "productie" && (
          <ProductieCalculator
            recipes={recipeItems}
            ingredients={ingredientItems}
          />
        )}

        {selectedRecipe && (
          <RecipeDetail
            key={selectedRecipe.id}
            recipe={selectedRecipe}
            ingredients={ingredientItems}
            recipes={recipeItems}
            onClose={() => setSelectedRecipe(null)}
            onSaveRecipe={updateRecipe}
          />
        )}
      </div>
    </main>
  );
}
