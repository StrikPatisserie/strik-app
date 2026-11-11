import { readFile } from "node:fs/promises";
import { notFound } from "next/navigation";
import ProductionPreview from "../ProductionPreview";
import { recipeViews, syncRecipeCatalog, ingredientViews, todayAmsterdam } from "../../../productie/workspaceData";
import type { RecepturenData } from "../../../bakkerij/recepturen/recepturenApi";
import type { PreviewState } from "../../../productie/planning";

export const dynamic = "force-dynamic";
type SourceDocument = { key: string; data: unknown; revision: number; updated_at: string };

export default async function LivePlanningPreview() {
  const source = process.env.STRIK_PLANNING_PREVIEW_SOURCE;
  if (process.env.NODE_ENV !== "development" || !source) notFound();

  const documents = JSON.parse(await readFile(source, "utf8")) as SourceDocument[];
  const recipes = documents.find(row => row.key === "recipes");
  const planner = documents.find(row => row.key === "planner");
  if (!recipes || !planner) throw Error("Geen productiegegevens beschikbaar voor de lokale preview.");

  const recipeData = recipes.data as RecepturenData;
  const views = recipeViews(recipeData);
  return <ProductionPreview initialLayout="new" live={{
    state: syncRecipeCatalog(planner.data as PreviewState, recipeData, views),
    recipes: views,
    ingredients: ingredientViews(recipeData),
    revision: planner.revision,
    recipeRevision: recipes.revision,
    updatedAt: planner.updated_at,
    today: todayAmsterdam(),
    canManage: false,
    readOnlyPreview: true,
    departments: ["dessert", "luxe", "kapsel", "slagroom", "bruidstaarten", "bak", "brood", "ijs", "chocolade"],
  }}/>;
}
