import { notFound } from "next/navigation";
import { requireCurrentProfile } from "@/app/lib/auth/session";
import { productionDepartments } from "@/app/productie/access";
import ChristmasStockPreview from "@/app/preview/productie/kerstvoorraad/ChristmasStockPreview";
import { christmasProductionSource } from "@/app/preview/productie/kerstvoorraad/liveSource.server";
import { readForecastSales, readForecastSettings } from "@/app/preview/productie/kerstvoorraad/store.server";
import { todayInAmsterdam } from "@/app/preview/productie/kerstvoorraad/campaignNeed";

export const dynamic = "force-dynamic";
export default async function ChristmasForecastPage() {
  if (!productionDepartments(await requireCurrentProfile()).length) notFound();
  const [sales, settings, production] = await Promise.all([
    readForecastSales().catch(() => null), readForecastSettings(), christmasProductionSource(),
  ]);
  return <ChristmasStockPreview products={sales?.products || []} today={todayInAmsterdam()}
    error={sales ? undefined : "De verkoopbasis voor kerst is nu niet bereikbaar. Ververs om opnieuw te proberen."}
    sharedSettings={settings} {...production}
    returnHref="/bakkerij/productie/feestdagen" planningHref="/bakkerij/productie" />;
}
