import type { ReactNode } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireCurrentProfile } from "@/app/lib/auth/session";
import { hasFullAccess } from "@/app/lib/auth/access";
import { ProductionSessionProvider } from "@/app/productie/ProductionSession";
import { productionDepartments } from "@/app/productie/access";
import "@/app/productie/production-surfaces.css";
export const metadata: Metadata = { title: "Strik Productie", robots: { index: false, follow: false } };
export default async function ProductionLayout({children}:{children:ReactNode}) {
  const profile=await requireCurrentProfile();
  if(!productionDepartments(profile).length) notFound();
  return <ProductionSessionProvider value={{canManage:hasFullAccess(profile),departments:productionDepartments(profile)}}><div data-production-workspace>{children}</div></ProductionSessionProvider>;
}
