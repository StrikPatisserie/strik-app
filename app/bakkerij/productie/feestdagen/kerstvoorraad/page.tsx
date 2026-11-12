import { notFound } from "next/navigation";
import ChristmasStockPreview from "@/app/preview/productie/kerstvoorraad/ChristmasStockPreview";
import { christmasForecastSource } from "@/app/preview/productie/kerstvoorraad/source.server";
import { christmasProductionSource } from "@/app/preview/productie/kerstvoorraad/liveSource.server";

export const dynamic = "force-dynamic";

export default async function ChristmasForecastPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  const [sales, production] = await Promise.all([christmasForecastSource(), christmasProductionSource()]);
  return <ChristmasStockPreview {...sales} {...production}
    returnHref="/bakkerij/productie/feestdagen" planningHref="/bakkerij/productie" />;
}
