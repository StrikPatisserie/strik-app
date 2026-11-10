import type { DemoRecipe } from "../../../productie/planning";
import { emptyChoice, type ProductChoice, type SalesProduct } from "./forecast";

// All yields, formulas, stock counts and preparation goals are illustrative.
// Source sales are read separately from the owner's local workbook.
export const exampleRecipes: DemoRecipe[] = [
  { id: "demo-passievol", name: "Passievol bombe", type: "finalProduct", yield: 100, unit: "stuks", ingredients: [], steps: ["Maken en storten. Later afwerken."], allergens: [], semiFinishedItems: [{ recipeId: "demo-vanille", quantity: 15, unit: "kg" }, { recipeId: "demo-passie", quantity: 8, unit: "kg" }, { recipeId: "demo-bodem", quantity: 100, unit: "stuks" }] },
  { id: "demo-hazelnoot", name: "Hazelnootbol", type: "finalProduct", yield: 80, unit: "stuks", ingredients: [], steps: ["Maken en storten. Later afwerken."], allergens: [], semiFinishedItems: [{ recipeId: "demo-vanille", quantity: 8, unit: "kg" }, { recipeId: "demo-hazel", quantity: 5, unit: "kg" }, { recipeId: "demo-bodem", quantity: 80, unit: "stuks" }] },
  { id: "demo-bossche", name: "Bossche bol", type: "finalProduct", yield: 100, unit: "stuks", ingredients: [], steps: ["Soesjes voorbereiden. Later vullen."], allergens: [], semiFinishedItems: [{ recipeId: "demo-soes", quantity: 100, unit: "stuks" }] },
  { id: "demo-stol", name: "Kerststol", type: "finalProduct", yield: 40, unit: "stuks", ingredients: [{ name: "Voorbeeldgrondstoffen stol", quantity: 1, unit: "recept" }], steps: ["Voorbeeldbereiding"], allergens: [] },
  { id: "demo-tulband", name: "Tulband", type: "finalProduct", yield: 24, unit: "stuks", ingredients: [{ name: "Voorbeeldgrondstoffen tulband", quantity: 1, unit: "recept" }], steps: ["Voorbeeldbereiding"], allergens: [] },
  { id: "demo-vanille", name: "Vanillemousse", type: "semiFinished", yield: 10, unit: "kg", ingredients: [{ name: "Voorbeeld moussebasis", quantity: 10, unit: "kg" }], steps: ["Voorbeeldbereiding"], allergens: [] },
  { id: "demo-passie", name: "Passievruchtinleg", type: "semiFinished", yield: 8, unit: "kg", ingredients: [{ name: "Voorbeeld fruitbasis", quantity: 8, unit: "kg" }], steps: ["Voorbeeldbereiding"], allergens: [] },
  { id: "demo-hazel", name: "Hazelnootvulling", type: "semiFinished", yield: 5, unit: "kg", ingredients: [{ name: "Voorbeeld vulling", quantity: 5, unit: "kg" }], steps: ["Voorbeeldbereiding"], allergens: [] },
  { id: "demo-bodem", name: "Biscuitbodempjes", type: "semiFinished", yield: 100, unit: "stuks", ingredients: [{ name: "Voorbeeld biscuitbeslag", quantity: 1, unit: "recept" }], steps: ["Voorbeeldbereiding"], allergens: [] },
  { id: "demo-soes", name: "Soesjes", type: "semiFinished", yield: 100, unit: "stuks", ingredients: [{ name: "Voorbeeld soesbeslag", quantity: 1, unit: "recept" }], steps: ["Voorbeeldbereiding"], allergens: [] },
];
export function exampleChoices(products: SalesProduct[]): Record<string, ProductChoice> {
  const examples: Record<string, [string, number, number, "whole" | "components"]> = {
    "bakery:passievol bombe": ["demo-passievol", 600, 120, "components"],
    "bakery:hazelnootbol": ["demo-hazelnoot", 800, 160, "components"],
    "bakery:bossche bol": ["demo-bossche", 1000, 200, "components"],
    "folder:stol-groot": ["demo-stol", 600, 80, "whole"],
    "folder:tulband": ["demo-tulband", 120, 24, "whole"],
  };
  return Object.fromEntries(products.map(product => {
    const example = examples[product.id];
    return [product.id, example ? { target: example[1], stock: example[2], recipeId: example[0], checked: true, storageChecked: true, phase: example[3] } : emptyChoice()];
  }));
}
export const exampleStocks: Record<string, number | null> = { "demo-vanille": 20, "demo-passie": 8, "demo-hazel": 5, "demo-bodem": 200, "demo-soes": 100, "demo-stol": 0, "demo-tulband": 0 };
