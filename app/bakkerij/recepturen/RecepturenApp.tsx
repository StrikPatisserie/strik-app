"use client";

/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
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
import type { Ingredient, InvoiceLine, Recipe } from "./types";

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

export default function RecepturenApp() {
  const [activeTab, setActiveTab] = useState<TabId>("dashboard");
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [recipeItems, setRecipeItems] = useState(recipes);
  const [ingredientItems, setIngredientItems] = useState(ingredients);
  const [invoiceItems, setInvoiceItems] = useState(invoiceImports);
  const latestInvoice = invoiceItems[0];

  function updateRecipe(updatedRecipe: Recipe) {
    setRecipeItems((current) =>
      current.map((recipe) =>
        recipe.id === updatedRecipe.id ? updatedRecipe : recipe
      )
    );
    setSelectedRecipe((current) =>
      current?.id === updatedRecipe.id ? updatedRecipe : current
    );
  }

  function updateIngredient(updatedIngredient: Ingredient) {
    setIngredientItems((current) =>
      current.map((ingredient) =>
        ingredient.id === updatedIngredient.id ? updatedIngredient : ingredient
      )
    );
  }

  function updateInvoiceLine(
    invoiceId: string,
    line: InvoiceLine,
    changes: Partial<InvoiceLine>
  ) {
    setInvoiceItems((current) =>
      current.map((invoice) => {
        if (invoice.id !== invoiceId) return invoice;

        const nextLines = invoice.lines.map((item) =>
          item.articleNumber === line.articleNumber &&
          item.description === line.description
            ? { ...item, ...changes }
            : item
        );
        const hasPending = nextLines.some(
          (item) => item.reviewStatus === "pending"
        );

        return {
          ...invoice,
          status: hasPending ? "review" : "processed",
          lines: nextLines,
        };
      })
    );
  }

  function approveInvoiceLine(invoiceId: string, line: InvoiceLine) {
    updateInvoiceLine(invoiceId, line, { reviewStatus: "approved" });

    if (!line.matchedIngredientId) return;

    setIngredientItems((current) =>
      current.map((ingredient) =>
        ingredient.id === line.matchedIngredientId
          ? {
              ...ingredient,
              previousPrice: line.oldPrice,
              lastPrice: line.newPrice,
              pricePerBaseUnit: line.newPrice,
              lastUpdated: new Date().toISOString().slice(0, 10),
              lastInvoice: latestInvoice.invoiceNumber,
            }
          : ingredient
      )
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
