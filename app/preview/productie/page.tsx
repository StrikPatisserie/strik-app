import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ProductionPreview from "./ProductionPreview";
import ScreenPreview from "./scherm/ScreenPreview";
import {productionBoard} from "../../productie/navigation";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "STRAK gepland · preview",
  icons: { icon: "/strak-gepland/mark.svg", apple: "/strak-gepland/apple-touch-icon.png" }, robots: { index: false, follow: false },
};

export default async function ProductionPreviewPage({searchParams}:{searchParams:Promise<{scherm?:string;view?:string;board?:string}>}) {
  if (process.env.NODE_ENV !== "development") notFound();
  const params=await searchParams;
  if(params.scherm==="1")return <ScreenPreview/>;
  return <ProductionPreview initialView={params.view} initialBoard={productionBoard(params.board)}/>;
}
