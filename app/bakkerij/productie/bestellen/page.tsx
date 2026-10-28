import { notFound } from "next/navigation";
import { requireCurrentProfile } from "@/app/lib/auth/session";
import { canAccessBakkerijIjsChocolade, hasFullAccess } from "@/app/lib/auth/access";
import { productionDepartments } from "@/app/productie/access";
import ProductionResourceFrame from "@/app/productie/ProductionResourceFrame";
import HefeOrders from "@/app/bakkerij/ijs-chocolade/bestellen/HefeOrders";
export default async function ProductionOrdersPage(){
 const profile=await requireCurrentProfile();if(!canAccessBakkerijIjsChocolade(profile))notFound();
 return <ProductionResourceFrame title="IJsgrondstoffen bestellen" active="orders" departments={productionDepartments(profile)} canManage={hasFullAccess(profile)}><HefeOrders embedded/></ProductionResourceFrame>;
}
