import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireCurrentProfile } from "../../lib/auth/session";
import { hasFullAccess } from "../../lib/auth/access";
import { productionDepartments } from "../../productie/access";
import ProductionClient from "../../productie/ProductionClient";
import { DEPARTMENTS,mondayOf } from "../../productie/planning";
import { productionBoard, productionView } from "../../productie/navigation";
export const dynamic="force-dynamic";
export const metadata:Metadata={title:"Strik Productie",robots:{index:false,follow:false}};
export default async function ProductionPage({searchParams}:{searchParams:Promise<{view?:string;board?:string;department?:string;date?:string}>}) {
  const profile=await requireCurrentProfile();
  if(!productionDepartments(profile).length)notFound();
  const query=await searchParams;
  const selectedDepartment=DEPARTMENTS.find(d=>d.id===query.department && productionDepartments(profile).includes(d.id));
  let initialWeek:string|undefined;try{if(query.date)initialWeek=mondayOf(query.date);}catch{}
  return <ProductionClient key={`${query.view || "planning"}:${query.board || ""}:${query.department || ""}:${initialWeek || ""}`} canManage={hasFullAccess(profile)} initialWeek={initialWeek} initialView={productionView(query.view)} initialBoard={productionBoard(query.board) || selectedDepartment?.board} initialDepartment={selectedDepartment?.id}/>;
}
