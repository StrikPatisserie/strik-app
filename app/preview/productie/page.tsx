import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ProductionPreview from "./ProductionPreview";
import ScreenPreview from "./scherm/ScreenPreview";
import OperationalPreview from "./OperationalPreview";
import ScreenMessagesPreview from "./ScreenMessagesPreview";
import ChristmasStockPreview from "./kerstvoorraad/ChristmasStockPreview";
import { christmasForecastSource } from "./kerstvoorraad/source.server";
import {productionBoard} from "../../productie/navigation";
import ProductionResourceFrame from "../../productie/ProductionResourceFrame";
import HolidayMenu from "../../productie/HolidayMenu";
import { DEPARTMENTS } from "../../productie/planning";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "STRAK gepland · preview",
  icons: { icon: "/strak-gepland/mark.svg", apple: "/strak-gepland/apple-touch-icon.png" }, robots: { index: false, follow: false },
};

export default async function ProductionPreviewPage({searchParams}:{searchParams:Promise<{scherm?:string;view?:string;board?:string}>}) {
  if (process.env.NODE_ENV !== "development") notFound();
  const params=await searchParams;
  if(params.view==="feestdagen")return <ProductionResourceFrame title="Feestdagen" active="holidays" departments={DEPARTMENTS.map(department=>department.id)} canManage demo>
    <HolidayMenu forecastHref="/preview/productie?view=kerstvoorraad"/>
  </ProductionResourceFrame>;
  if(params.view==="kerstvoorraad")return <ChristmasStockPreview {...await christmasForecastSource()}/>;
  if(params.view==="schermbericht"||params.view==="schermberichten")return <ScreenMessagesPreview editor={params.view==="schermberichten"}/>;
  if(params.view==="leveranciers"||params.view==="voorraad")return <OperationalPreview view={params.view}/>;
  if(params.scherm==="1")return <ScreenPreview/>;
  return <ProductionPreview initialView={params.view} initialBoard={productionBoard(params.board)}/>;
}
