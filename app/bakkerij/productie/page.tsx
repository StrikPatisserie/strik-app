import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireCurrentProfile } from "../../lib/auth/session";
import { hasFullAccess } from "../../lib/auth/access";
import { productionDepartments } from "../../productie/access";
import ProductionClient from "../../productie/ProductionClient";
export const dynamic="force-dynamic";
export const metadata:Metadata={title:"Strik Productie",robots:{index:false,follow:false}};
export default async function ProductionPage() {
  const profile=await requireCurrentProfile();
  if(!productionDepartments(profile).length)notFound();
  return <ProductionClient canManage={hasFullAccess(profile)}/>;
}
