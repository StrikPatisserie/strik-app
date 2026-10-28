import { requireCurrentProfile } from "@/app/lib/auth/session";
import { hasFullAccess } from "@/app/lib/auth/access";
import { productionDepartments } from "@/app/productie/access";
import ProductionResourceFrame from "@/app/productie/ProductionResourceFrame";
import ProductionStaffing from "@/app/productie/ProductionStaffing";
import { mondayOf } from "@/app/productie/planning";
import { todayAmsterdam } from "@/app/productie/workspaceData";
export default async function ProductionRosterPage({searchParams}:{searchParams:Promise<{week?:string}>}){
 const profile=await requireCurrentProfile(),query=await searchParams;let week;try{week=mondayOf(query.week || todayAmsterdam());}catch{week=mondayOf(todayAmsterdam());}
 return <ProductionResourceFrame title="Personeelsrooster" active="roster" departments={productionDepartments(profile)} canManage={hasFullAccess(profile)}><ProductionStaffing week={week} canManage={hasFullAccess(profile)} standalone/></ProductionResourceFrame>;
}
