import { notFound } from "next/navigation";
import ChristmasStockPreview from "@/app/preview/productie/kerstvoorraad/ChristmasStockPreview";
import { christmasForecastSource } from "@/app/preview/productie/kerstvoorraad/source.server";

export const dynamic = "force-dynamic";

export default async function ChristmasForecastPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <ChristmasStockPreview {...await christmasForecastSource()}
    returnHref="/bakkerij/productie/feestdagen" planningHref="/bakkerij/productie" />;
}
