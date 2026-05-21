import { useState } from "react";
import type { Ingredient, Recipe, RecipeUnit } from "./types";
import { EmptyState, FilterSelect, Panel, SectionTitle } from "./RecepturenShared";
import {
  findIngredient,
  findRecipe,
  formatEuro,
  quantityLabel,
  scaledRecipeIngredients,
  scaledSemiFinishedItems,
} from "./utils";

export default function ProductieCalculator({
  recipes,
  ingredients,
}: Readonly<{ recipes: Recipe[]; ingredients: Ingredient[] }>) {
  const finalProducts = recipes.filter((recipe) => recipe.type === "finalProduct");
  const [recipeId, setRecipeId] = useState(finalProducts[0]?.id || "");
  const [desiredAmount, setDesiredAmount] = useState(30);
  const [stockIngredientId, setStockIngredientId] = useState("slagroom-35");
  const [stockQuantity, setStockQuantity] = useState(20);
  const selectedRecipe = findRecipe(recipes, recipeId) || finalProducts[0];
  const selectedIngredient = findIngredient(ingredients, stockIngredientId);

  const productionRows = selectedRecipe
    ? [
        ...scaledRecipeIngredients(selectedRecipe, desiredAmount).map((item) => ({
          id: `ingredient-${item.ingredientId}`,
          type: "Ingredient",
          name:
            findIngredient(ingredients, item.ingredientId)?.name ||
            item.ingredientId,
          quantity: quantityLabel(item.quantity, item.unit),
          cost: item.costContribution,
        })),
        ...scaledSemiFinishedItems(selectedRecipe, desiredAmount).map((item) => ({
          id: `semi-${item.semiFinishedRecipeId}`,
          type: "Halffabricaat",
          name:
            findRecipe(recipes, item.semiFinishedRecipeId)?.name ||
            item.semiFinishedRecipeId,
          quantity: quantityLabel(item.quantity, item.unit),
          cost: item.costContribution,
        })),
      ]
    : [];
  const stockBasedPieces =
    selectedRecipe && selectedIngredient
      ? calculateStockBasedPieces(
          selectedRecipe,
          selectedIngredient.id,
          recipes,
          stockQuantity,
          selectedIngredient.recipeUnit
        )
      : 0;

  const totalCost = selectedRecipe ? selectedRecipe.costPrice * desiredAmount : 0;

  return (
    <div className="grid gap-4">
      <Panel>
        <SectionTitle
          eyebrow="Productie"
          title="Productiecalculator"
          description="Schaal recepten op, bereken beperkende grondstoffen en maak alvast een productiekaart."
        />
      </Panel>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel>
          <SectionTitle
            title="A. Ik wil X stuks maken"
            description="Kies een recept en vul het gewenste aantal in."
          />
          <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_9rem]">
            <FilterSelect
              label="Recept"
              value={recipeId}
              onChange={setRecipeId}
              options={finalProducts.map((recipe) => ({
                value: recipe.id,
                label: recipe.name,
              }))}
            />
            <label className="grid gap-1 text-xs font-black uppercase tracking-[0.12em] text-[#2d2a26]/45">
              Aantal
              <input
                type="number"
                min="1"
                value={desiredAmount}
                onChange={(event) =>
                  setDesiredAmount(Math.max(1, Number(event.target.value) || 1))
                }
                className="rounded-2xl border border-[#e7e0d8] bg-white px-3 py-3 text-sm font-bold normal-case tracking-normal text-[#2d2a26]"
              />
            </label>
          </div>

          <div className="mt-4 grid gap-2">
            {productionRows.length ? (
              productionRows.map((row) => (
                <div
                  key={row.id}
                  className="grid gap-2 rounded-2xl border border-[#e7e0d8] bg-[#fffdf8] p-3 sm:grid-cols-[7rem_minmax(0,1fr)_7rem_7rem] sm:items-center"
                >
                  <span className="rounded-full bg-[#f8f6f3] px-2.5 py-1 text-xs font-black text-[#2d2a26]/55">
                    {row.type}
                  </span>
                  <p className="truncate text-sm font-black">{row.name}</p>
                  <p className="text-sm font-bold text-[#2d2a26]/60">{row.quantity}</p>
                  <p className="text-sm font-black">{formatEuro(row.cost)}</p>
                </div>
              ))
            ) : (
              <EmptyState text="Kies een recept om de productiekaart te vullen." />
            )}
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <MiniMetric label="Totale kostprijs" value={formatEuro(totalCost)} />
            <MiniMetric
              label="Kostprijs per stuk"
              value={selectedRecipe ? formatEuro(selectedRecipe.costPrice) : "-"}
            />
            <MiniMetric
              label="Productiekaart"
              value={selectedRecipe ? selectedRecipe.batchSize : "-"}
            />
          </div>
        </Panel>

        <Panel>
          <SectionTitle
            title="B. Ik heb nog X kg/liter"
            description="Bereken hoeveel stuks maximaal haalbaar zijn op basis van één grondstof."
          />
          <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_9rem]">
            <FilterSelect
              label="Ingredient"
              value={stockIngredientId}
              onChange={setStockIngredientId}
              options={ingredients.map((ingredient) => ({
                value: ingredient.id,
                label: ingredient.name,
              }))}
            />
            <label className="grid gap-1 text-xs font-black uppercase tracking-[0.12em] text-[#2d2a26]/45">
              Voorraad
              <input
                type="number"
                min="0"
                value={stockQuantity}
                onChange={(event) =>
                  setStockQuantity(Math.max(0, Number(event.target.value) || 0))
                }
                className="rounded-2xl border border-[#e7e0d8] bg-white px-3 py-3 text-sm font-bold normal-case tracking-normal text-[#2d2a26]"
              />
            </label>
          </div>
          <div className="mt-4 rounded-[1.15rem] border border-[#cfdcc8] bg-[#f7faf5] p-4">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[#45663b]">
              Maximale productie
            </p>
            <p className="mt-2 text-3xl font-black">
              {stockBasedPieces || "Geen directe match"} stuks
            </p>
            <p className="mt-2 text-sm font-bold text-[#2d2a26]/58">
              Op basis van {stockQuantity} kg/liter {selectedIngredient?.name || "ingredient"} voor {selectedRecipe?.name || "recept"}.
            </p>
          </div>
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel>
          <SectionTitle
            title="C. Beperkende grondstof"
            description="Voorraadscenario op basis van mockdata."
          />
          <div className="mt-4 grid gap-2">
            {[
              { name: "Pure chocolade", pieces: 120, status: "good" },
              { name: "Biscuit", pieces: 95, status: "pressure" },
              { name: "Room", pieces: 80, status: "critical" },
            ].map((item) => (
              <div
                key={item.name}
                className="flex items-center justify-between gap-3 rounded-2xl bg-[#fffdf8] p-3"
              >
                <p className="text-sm font-black">{item.name}</p>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-black ${
                    item.status === "critical"
                      ? "bg-[#ffe0dc] text-[#a83e31]"
                      : item.status === "pressure"
                        ? "bg-[#fff0bd] text-[#8a5b10]"
                        : "bg-[#dce8d6] text-[#45663b]"
                  }`}
                >
                  genoeg voor {item.pieces} stuks
                </span>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-2xl border border-[#efc2bb] bg-[#fff4f1] p-3">
            <p className="text-sm font-black text-[#a83e31]">
              Maximaal mogelijk: 80 stuks. Beperkende grondstof: room.
            </p>
          </div>
        </Panel>

        <Panel>
          <SectionTitle
            title="D. Wat kan ik maken met voorraad?"
            description="Mockup voor restvoorraad-suggesties."
          />
          <div className="mt-4 rounded-2xl bg-[#f8f6f3] p-3">
            <p className="text-sm font-black">Restvoorraad</p>
            <p className="mt-1 text-sm font-bold text-[#2d2a26]/58">
              20 kg room · 5 kg chocolade · 3 kg pistachepasta
            </p>
          </div>
          <div className="mt-3 grid gap-2">
            {[
              ["80 petit gateaux pistache", "Room wordt beperkend"],
              ["45 pistache sloffen", "Pistachepasta bijna op"],
              ["120 slagroomtruffels", "Extra cacao controleren"],
            ].map(([title, detail]) => (
              <div
                key={title}
                className="rounded-2xl border border-[#e7e0d8] bg-[#fffdf8] p-3"
              >
                <p className="text-sm font-black">{title}</p>
                <p className="mt-1 text-xs font-bold text-[#2d2a26]/45">
                  {detail}
                </p>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function ingredientNeedPerPiece(
  recipe: Recipe,
  ingredientId: string,
  recipes: Recipe[]
) {
  const directNeed = recipe.ingredients
    .filter((item) => item.ingredientId === ingredientId)
    .reduce((total, item) => total + toBaseQuantity(item.quantity, item.unit), 0);
  const semiNeed = recipe.semiFinishedItems.reduce((total, usage) => {
    const semiRecipe = findRecipe(recipes, usage.semiFinishedRecipeId);
    if (!semiRecipe) return total;

    const batchSize = estimateBatchBaseQuantity(semiRecipe.batchSize);
    const ratio = toBaseQuantity(usage.quantity, usage.unit) / batchSize;
    const ingredientNeed = semiRecipe.ingredients
      .filter((item) => item.ingredientId === ingredientId)
      .reduce(
        (sum, item) => sum + toBaseQuantity(item.quantity, item.unit) * ratio,
        0
      );

    return total + ingredientNeed;
  }, 0);

  return directNeed + semiNeed;
}

function calculateStockBasedPieces(
  recipe: Recipe,
  ingredientId: string,
  recipes: Recipe[],
  stockQuantity: number,
  unit: RecipeUnit
) {
  const need = ingredientNeedPerPiece(recipe, ingredientId, recipes);
  const available = convertStockToRecipeUnit(stockQuantity, unit);

  return need > 0 ? Math.floor(available / need) : 0;
}

function toBaseQuantity(quantity: number, unit: RecipeUnit) {
  if (unit === "kg" || unit === "liter") return quantity * 1000;

  return quantity;
}

function convertStockToRecipeUnit(quantity: number, unit: RecipeUnit) {
  if (unit === "kg" || unit === "liter") return quantity * 1000;

  return quantity;
}

function estimateBatchBaseQuantity(batchSize: string) {
  const match = batchSize.replace(",", ".").match(/[\d.]+/);
  if (!match) return 1000;

  const value = Number(match[0]);
  if (!Number.isFinite(value) || value <= 0) return 1000;
  if (batchSize.includes("kg")) return value * 1000;

  return value * 1000;
}

function MiniMetric({
  label,
  value,
}: Readonly<{ label: string; value: string }>) {
  return (
    <div className="rounded-2xl bg-[#f8f6f3] p-3">
      <p className="text-[0.65rem] font-black uppercase tracking-[0.12em] text-[#2d2a26]/40">
        {label}
      </p>
      <p className="mt-1 truncate text-sm font-black">{value}</p>
    </div>
  );
}
