import { getCurrentProfile } from "@/app/lib/auth/session";
import { productionDepartments } from "@/app/productie/access";
import { readDocument, saveQuickRecipeDocument, ProductionStoreError } from "@/app/productie/documents.server";
import { retryConcurrentSave } from "@/app/productie/concurrentEditing.server";
import { ConcurrentChangeError } from "@/app/productie/concurrentChanges";
import { createProductionRecipe, type NewRecipeInput } from "@/app/productie/newRecipe";
import { saveRecipeChange, storeWork, workView } from "@/app/productie/productionWork";
import { recipeViews, syncRecipeCatalog, validWorkspace } from "@/app/productie/workspaceData";
import type { PreviewState } from "@/app/productie/planning";
import type { RecepturenData } from "@/app/bakkerij/recepturen/recepturenApi";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
function failure(error: unknown) {
  return Response.json({ message: error instanceof Error ? error.message : "Opslaan mislukt." }, {
    status: error instanceof ProductionStoreError ? error.status : error instanceof ConcurrentChangeError ? 409 : 400, headers,
  });
}

export async function GET() {
  const profile = await getCurrentProfile(), departments = productionDepartments(profile);
  if (!departments.length) return Response.json({ message: "Geen toegang tot STRAK Gepland." }, { status: 403, headers });
  try {
    const recipes = await readDocument<RecepturenData>("recipes");
    if (!recipes) throw new ProductionStoreError("De receptenopslag is nog niet ingericht.");
    // Explicit catalog projection: no supplier prices, invoices or margins.
    return Response.json({
      departments,
      ingredients: recipes.data.ingredients.map(row => ({ id: row.id, name: row.name, supplier: row.supplier, articleNumber: row.supplierArticleNumber, unit: row.recipeUnit, allergens: row.allergens || [] })),
      semiFinished: recipes.data.recipes.filter(row => row.type === "semiFinished" && row.status !== "old").map(row => ({ id: row.id, name: row.name, unit: row.standardBatchUnit, articleNumber: row.strikArticleNumber, allergens: row.allergens || [] })),
      productGroups: [...new Set(recipes.data.recipes.map(row => row.productGroup).filter(Boolean))].sort(),
    }, { headers });
  } catch (error) { return failure(error); }
}

export async function POST(request: Request) {
  const profile = await getCurrentProfile(), allowed = productionDepartments(profile);
  if (!profile?.active || !allowed.length) return Response.json({ message: "Geen toegang tot STRAK Gepland." }, { status: 403, headers });
  if (request.headers.get("origin") !== new URL(request.url).origin) return Response.json({ message: "Ongeldige herkomst." }, { status: 403, headers });
  try {
    const raw = await request.text();
    if (raw.length > 2000000) throw new ProductionStoreError("Het recept of de foto is te groot.", 413);
    const input = JSON.parse(raw) as { command: NewRecipeInput; who: string; commandId: string };
    if (typeof input.who !== "string" || input.who.trim().length < 2 || input.who.trim().length > 80) throw Error("Vul je naam in (2–80 tekens).");
    if (typeof input.commandId !== "string" || !/^[a-f0-9-]{36}$/i.test(input.commandId)) throw Error("Heropen het formulier en probeer opnieuw.");
    if (!allowed.includes(input.command?.departmentId)) throw new ProductionStoreError("Kies een eigen productieafdeling.", 403);
    const id = `recipe-production-${input.commandId}`;
    return await retryConcurrentSave(async () => {
      const [planner, recipes] = await Promise.all([readDocument<PreviewState>("planner"), readDocument<RecepturenData>("recipes")]);
      if (!planner || !recipes) throw new ProductionStoreError("De productieopslag is nog niet ingericht.");
      // Retrying a completed submission must not create a second recipe.
      if (recipes.data.recipes.some(recipe => recipe.id === id)) return Response.json({ saved: true, recipeId: id }, { headers });
      const now = new Date().toISOString(), current = syncRecipeCatalog(planner.data, recipes.data);
      const next = createProductionRecipe(current, recipes.data, input.command, id, now);
      const draft = recipeViews(next.recipes).find(recipe => recipe.id === id)!;
      const audit = saveRecipeChange(workView(next.planner, recipeViews(recipes.data)), { itemId: `recipe:${id}`, scope: "permanent", who: input.who, recipe: draft }, crypto.randomUUID(), now);
      audit.history = audit.history.map(change => change.after?.id === id ? { ...change, actorId: profile.id } : change);
      next.planner = syncRecipeCatalog(storeWork(audit, current.productionWork), next.recipes);
      if (!validWorkspace(next.planner, recipeViews(next.recipes))) throw Error("Controleer het recept en de eenheden; er is niets opgeslagen.");
      await saveQuickRecipeDocument(planner.revision, recipes.revision, next.planner, next.recipes, profile.id);
      return Response.json({ saved: true, recipeId: id }, { headers });
    });
  } catch (error) { return failure(error); }
}
