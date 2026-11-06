import { notFound } from "next/navigation";
import { requireCurrentProfile } from "@/app/lib/auth/session";
import { hasFullAccess } from "@/app/lib/auth/access";
import { productionDepartments } from "@/app/productie/access";
import ProductionResourceFrame from "@/app/productie/ProductionResourceFrame";
import Suppliers from "@/app/leveranciers/Suppliers";
export default async function ProductionOrdersPage(){
 const profile=await requireCurrentProfile();if(!productionDepartments(profile).length)notFound();
 return <ProductionResourceFrame title="Grondstoffen bestellen" active="orders" departments={productionDepartments(profile)} canManage={hasFullAccess(profile)}><Suppliers hefePath="/bakkerij/productie/bestellen/hefe"/></ProductionResourceFrame>;
}
