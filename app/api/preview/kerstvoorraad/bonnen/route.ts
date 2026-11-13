import { getCurrentProfile } from "@/app/lib/auth/session";
import { productionDepartments } from "@/app/productie/access";
import { inventoryDispatchDays } from "@/app/productie/inventorySource.server";
import { CAMPAIGN_START, CAMPAIGN_END, validCampaignDays } from "@/app/preview/productie/kerstvoorraad/campaignNeed";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
export async function GET() {
  if (!productionDepartments(await getCurrentProfile()).length) return Response.json({ message: "Geen toegang tot de productiebonnen." }, { status: 403, headers });
  try {
    const days = (await inventoryDispatchDays()).filter(day => day.date >= CAMPAIGN_START && day.date <= CAMPAIGN_END);
    if (!validCampaignDays(days)) throw new Error("Controleer de bonnenbron.");
    // Anonymous article/day totals only; reuse the archive's deduplication.
    return Response.json({ days, checkedAt: new Date().toISOString() }, { headers });
  } catch {
    return Response.json({ message: "Productiebonnen zijn nu niet bereikbaar." }, { status: 503, headers });
  }
}
