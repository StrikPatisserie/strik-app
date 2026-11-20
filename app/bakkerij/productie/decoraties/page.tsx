import { notFound } from "next/navigation";
import { requireCurrentProfile } from "@/app/lib/auth/session";
import { hasFullAccess, canManageProduction } from "@/app/lib/auth/access";
import { productionDepartments } from "@/app/productie/access";
import { sharedRecipes } from "@/app/productie/recipeStore.server";
import ProductionResourceFrame from "@/app/productie/ProductionResourceFrame";
import DecorationsList from "@/app/bakkerij/recepturen/DecorationsList";
import Link from "next/link";
export default async function DecorationsPage(){
  const profile=await requireCurrentProfile(),departments=productionDepartments(profile);
  if(!departments.length)notFound();
  const data=await sharedRecipes(profile);if(!data)notFound();
  return <ProductionResourceFrame title="Chocoladedecoraties" active="ingredients" departments={departments} canManage={canManageProduction(profile)} canManageData={hasFullAccess(profile)}>
    {hasFullAccess(profile)&&<p style={{marginBottom:12}}><Link href="/bakkerij/productie/beheer/decoraties">Decoraties beheren ↗</Link></p>}
    <DecorationsList ingredients={data.ingredients} recipes={data.recipes} readOnly financialAccess={hasFullAccess(profile)}/>
  </ProductionResourceFrame>;
}
