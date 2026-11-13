import "server-only";
import { notFound } from "next/navigation";
import { requireCurrentProfile } from "@/app/lib/auth/session";
import { productionDepartments } from "@/app/productie/access";
import { readDocument } from "@/app/productie/documents.server";
import { readOperational } from "@/app/productie/operationalStore.server";
import { inventoryDispatchDays } from "@/app/productie/inventorySource.server";
import { emptyInventory, INVENTORY_KEY, inventoryOverview } from "@/app/productie/inventory";
import { recipeViews, syncRecipeCatalog, todayAmsterdam } from "@/app/productie/workspaceData";
import type { RecepturenData } from "@/app/bakkerij/recepturen/recepturenApi";
import type { PreviewState } from "@/app/productie/planning";
import { CAMPAIGN_END, CAMPAIGN_START, validCampaignDays, type CampaignReceipts } from "./campaignNeed";
import type { ProductionReading } from "./productionOverview";

type ProductionSource = { production: ProductionReading; campaignReceipts: CampaignReceipts; productionError?: string };

/** The authenticated overview reads the same recipes, output and stock
 * as the bakery. Missing source data stays unavailable, without sample totals. */
export async function christmasProductionSource(): Promise<ProductionSource> {
  if (!productionDepartments(await requireCurrentProfile()).length) notFound();
  const today = todayAmsterdam();
  const emptyPlanner: PreviewState = { version: 1, items: [], tasks: [] };
  const unavailable: ProductionSource = {
    production: { mode: "live", items: [], recipes: [], overview: inventoryOverview(emptyPlanner, emptyInventory(), [], today) },
    campaignReceipts: { mode: "live", available: false, days: [] },
  };
  try {
    const [planner, recipes, inventory, days] = await Promise.all([
      readDocument<PreviewState>("planner"),
      readDocument<RecepturenData>("recipes"),
      readOperational(INVENTORY_KEY, emptyInventory()),
      inventoryDispatchDays().catch(() => null),
    ]);
    if (!planner || !recipes) throw Error("Productiegegevens ontbreken.");
    const views = recipeViews(recipes.data);
    const state = syncRecipeCatalog(planner.data, recipes.data, views);
    const campaignDays = days?.filter(day => day.date >= CAMPAIGN_START && day.date <= CAMPAIGN_END);
    const receiptsAvailable = validCampaignDays(campaignDays);
    return {
      production: { mode: "live", items: state.items, recipes: views, overview: inventoryOverview(state, inventory, days || [], today) },
      campaignReceipts: receiptsAvailable
        ? { mode: "live", available: true, days: campaignDays, checkedAt: new Date().toISOString() }
        : unavailable.campaignReceipts,
      ...(days === null ? { productionError: "Productie ingelezen · bonnen zijn nog niet bereikbaar" } : {}),
    };
  } catch {
    return { ...unavailable, productionError: "Productiegegevens zijn nu niet bereikbaar. Probeer ‘Productie ophalen’." };
  }
}
