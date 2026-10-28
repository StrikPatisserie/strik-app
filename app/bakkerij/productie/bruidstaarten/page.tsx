import { notFound } from "next/navigation";
import { requireCurrentProfile } from "@/app/lib/auth/session";
import { canAccessBakkerijPatisserie, hasFullAccess } from "@/app/lib/auth/access";
import { productionDepartments } from "@/app/productie/access";
import ProductionResourceFrame from "@/app/productie/ProductionResourceFrame";
import { BakkerijWeddingCakeAgendaPanel } from "@/app/bakkerij/recepturen/RecepturenApp";
export default async function ProductionWeddingsPage(){
 const profile=await requireCurrentProfile();if(!canAccessBakkerijPatisserie(profile))notFound();
 return <ProductionResourceFrame title="Bruidstaartproductie" active="weddings" departments={productionDepartments(profile)} canManage={hasFullAccess(profile)}><BakkerijWeddingCakeAgendaPanel canOpenWeddingCakeAgenda compact defaultOpen title="Weekplanning bruidstaarten"/></ProductionResourceFrame>;
}
