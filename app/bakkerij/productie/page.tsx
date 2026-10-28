import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireCurrentProfile } from "../../lib/auth/session";
import { hasFullAccess } from "../../lib/auth/access";
import { productionDepartments } from "../../productie/access";
import ProductionClient from "../../productie/ProductionClient";
import { productionBoard, productionView } from "../../productie/navigation";
export const dynamic="force-dynamic";
export const metadata:Metadata={title:"Strik Productie",robots:{index:false,follow:false}};
export default async function ProductionPage({searchParams}:{searchParams:Promise<{view?:string;board?:string}>}) {
  const profile=await requireCurrentProfile();
  if(!productionDepartments(profile).length)notFound();
  const query=await searchParams;
  return <ProductionClient key={`${query.view || "planning"}:${query.board || ""}`} canManage={hasFullAccess(profile)} initialView={productionView(query.view)} initialBoard={productionBoard(query.board)}/>;
}
