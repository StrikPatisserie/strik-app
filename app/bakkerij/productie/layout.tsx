import type { ReactNode } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireCurrentProfile } from "@/app/lib/auth/session";
import { productionDepartments } from "@/app/productie/access";
export const metadata: Metadata = { title: "Strik Productie", robots: { index: false, follow: false } };
export default async function ProductionLayout({children}:{children:ReactNode}) {
  const profile=await requireCurrentProfile();
  if(!productionDepartments(profile).length) notFound();
  return children;
}
