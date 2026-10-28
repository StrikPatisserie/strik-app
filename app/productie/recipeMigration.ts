// Read-only inspection of a complete WordPress export. No API client or write
// adapter belongs in this module. Preserve the full source, including fields
// not yet understood by Strik Productie, until transfer parity is proven.
type RecordValue = Record<string, unknown>;
export type TransferIssue = { code: string; collection: string; index?: number; field?: string };
export type RecipeTransferReport = {
  ready: boolean;
  counts: { recipes: number; finalProducts: number; semiFinished: number; ingredients: number; packaging: number; manualTasks: number; productionEntries: number; specsPlazaLinks: number; recipePhotos: number; invoices: number };
  errors: TransferIssue[];
  warnings: TransferIssue[];
};
function record(value: unknown): value is RecordValue { return !!value && typeof value === "object" && !Array.isArray(value); }
function text(value: unknown): value is string { return typeof value === "string" && !!value.trim(); }

export function inspectRecipeTransfer(source: unknown): RecipeTransferReport {
  const result: RecipeTransferReport = {
    ready: false,
    counts: { recipes: 0, finalProducts: 0, semiFinished: 0, ingredients: 0, packaging: 0, manualTasks: 0, productionEntries: 0, specsPlazaLinks: 0, recipePhotos: 0, invoices: 0 },
    errors: [], warnings: [],
  };
  if (!record(source)) { result.errors.push({ code: "invalid-export", collection: "root" }); return result; }
  function list(key: string, required = false) {
    if (!Array.isArray((source as RecordValue)[key])) {
      if (required || (source as RecordValue)[key] !== undefined) result.errors.push({ code: "missing-or-invalid-array", collection: key });
      return [];
    }
    return (source as RecordValue)[key] as unknown[];
  }
  const recipes = list("recipes", true), ingredients = list("ingredients", true), packaging = list("packagingItems"), manual = list("manualProductionPlanningItems"), invoices = list("invoiceImports", true);
  const byCollection = { recipes, ingredients, packagingItems: packaging, manualProductionPlanningItems: manual };
  const ids: Record<string, Set<string>> = {};
  for (const [collection, entries] of Object.entries(byCollection)) {
    const known = new Set<string>(); ids[collection] = known;
    entries.forEach((entry, index) => {
      if (!record(entry) || !text(entry.id)) { result.errors.push({ code: "missing-id", collection, index }); return; }
      if (known.has(entry.id)) result.errors.push({ code: "duplicate-id", collection, index });
      known.add(entry.id);
    });
  }
  result.counts.recipes = recipes.length;
  result.counts.ingredients = ingredients.length;
  result.counts.packaging = packaging.length;
  result.counts.manualTasks = manual.length;
  result.counts.invoices = invoices.length;
  if (!recipes.length) result.errors.push({ code: "empty-recipe-export", collection: "recipes" });
  const recipeMap = new Map(recipes.filter(record).map(r => [r.id, r]));
  recipes.forEach((recipe, index) => {
    if (!record(recipe)) return;
    if (recipe.type === "finalProduct") result.counts.finalProducts++;
    else if (recipe.type === "semiFinished") result.counts.semiFinished++;
    else result.errors.push({ code: "unknown-recipe-type", collection: "recipes", index, field: "type" });
    if (!text(recipe.name)) result.errors.push({ code: "missing-name", collection: "recipes", index });
    if (Array.isArray(recipe.productionLog)) result.counts.productionEntries += recipe.productionLog.length;
    if (text(recipe.photoPreviewDataUrl)) result.counts.recipePhotos++;
    for (const [field, target, idField] of [["ingredients", "ingredients", "ingredientId"], ["semiFinishedItems", "recipes", "semiFinishedRecipeId"], ["packagingItems", "packagingItems", "packagingId"]] as const) {
      const lines = recipe[field];
      if (!Array.isArray(lines)) {
        if (field !== "packagingItems" || lines !== undefined) result.errors.push({ code: "missing-or-invalid-lines", collection: "recipes", index, field });
        continue;
      }
      for (const line of lines) {
        if (!record(line) || !text(line[idField]) || !ids[target].has(String(line[idField]))) { result.errors.push({ code: "broken-reference", collection: "recipes", index, field }); continue; }
        if (target === "recipes" && recipeMap.get(line[idField])?.type !== "semiFinished") result.errors.push({ code: "reference-is-not-semi-finished", collection: "recipes", index, field });
        if (typeof line.quantity !== "number" || !Number.isFinite(line.quantity) || line.quantity < 0) result.errors.push({ code: "invalid-quantity", collection: "recipes", index, field });
        else if (line.quantity === 0) result.warnings.push({ code: "quantity-not-yet-filled", collection: "recipes", index, field });
      }
    }
    if (Array.isArray(recipe.linkedFinalProductIds)) for (const id of recipe.linkedFinalProductIds) if (!text(id) || recipeMap.get(id)?.type !== "finalProduct") result.errors.push({ code: "broken-final-product-reference", collection: "recipes", index, field: "linkedFinalProductIds" });
  });
  ingredients.forEach((ingredient, index) => {
    if (!record(ingredient)) return;
    if (!text(ingredient.name)) result.errors.push({ code: "missing-name", collection: "ingredients", index });
    if (record(ingredient.specification) && (text(ingredient.specification.specsPlazaId) || record(ingredient.specification.specsPlazaLink))) result.counts.specsPlazaLinks++;
    if (record(ingredient.recipeReplacement)) {
      const replacement = ingredient.recipeReplacement;
      const valid = replacement.kind === "ingredient" ? ids.ingredients.has(String(replacement.id)) : replacement.kind === "semiFinished" && recipeMap.get(replacement.id)?.type === "semiFinished";
      if (!valid) result.errors.push({ code: "broken-replacement-reference", collection: "ingredients", index, field: "recipeReplacement" });
    }
  });
  const visiting = new Set<unknown>(), visited = new Set<unknown>();
  function visit(id: unknown) {
    if (visiting.has(id)) return false;
    if (visited.has(id)) return true;
    visiting.add(id);
    const value = recipeMap.get(id);
    for (const line of Array.isArray(value?.semiFinishedItems) ? value.semiFinishedItems : []) if (record(line) && recipeMap.has(line.semiFinishedRecipeId) && !visit(line.semiFinishedRecipeId)) return false;
    visiting.delete(id); visited.add(id); return true;
  }
  for (const id of recipeMap.keys()) if (!visit(id)) { result.errors.push({ code: "cyclic-semi-finished-reference", collection: "recipes" }); break; }
  if (result.counts.recipePhotos) result.warnings.push({ code: "verify-photo-bytes-and-storage-backup", collection: "recipes", field: "photoPreviewDataUrl" });
  if (record(source.bakeryHome) && Array.isArray(source.bakeryHome.offers) && source.bakeryHome.offers.length) result.warnings.push({ code: "verify-linked-wordpress-media", collection: "bakeryHome", field: "offers" });
  // JSON cannot represent NaN/Infinity. Reject these before serializing so a
  // snapshot cannot silently turn original numbers into null.
  function finite(value: unknown): boolean {
    if (typeof value === "number") return Number.isFinite(value);
    if (Array.isArray(value)) return value.every(finite);
    if (record(value)) return Object.values(value).every(finite);
    return value === null || ["string", "boolean", "undefined"].includes(typeof value);
  }
  if (!finite(source)) result.errors.push({ code: "non-json-or-non-finite-value", collection: "root" });
  result.ready = result.errors.length === 0;
  return result;
}

export function recipeTransferSnapshot(source: unknown) {
  const report = inspectRecipeTransfer(source);
  if (!report.ready) throw Error("Overdracht geblokkeerd: controleer de bronexport.");
  return { schemaVersion: 1, source: "wordpress" as const, report, data: structuredClone(source) };
}

export function canonicalJson(value:unknown):string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value==="object") return `{${Object.keys(value).sort().filter(k=>(value as Record<string,unknown>)[k]!==undefined).map(k=>`${JSON.stringify(k)}:${canonicalJson((value as Record<string,unknown>)[k])}`).join(",")}}`;
  return JSON.stringify(value);
}
