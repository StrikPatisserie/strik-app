import { requireCurrentProfile } from "@/app/lib/auth/session";
import { hasFullAccess, canManageProduction } from "@/app/lib/auth/access";
import { productionDepartments } from "@/app/productie/access";
import ProductionResourceFrame from "@/app/productie/ProductionResourceFrame";
import ProductionStaffing from "@/app/productie/ProductionStaffing";
import { mondayOf } from "@/app/productie/planning";
import { todayAmsterdam } from "@/app/productie/workspaceData";
export default async function ProductionRosterPage({searchParams}:{searchParams:Promise<{week?:string}>}){
 const profile=await requireCurrentProfile(),query=await searchParams;let week;try{week=mondayOf(query.week || todayAmsterdam());}catch{week=mondayOf(todayAmsterdam());}
 return <ProductionResourceFrame title="Personeelsrooster" active="roster" canManageData={hasFullAccess(profile)} departments={productionDepartments(profile)} canManage={canManageProduction(profile)}><ProductionStaffing week={week} canManage={canManageProduction(profile)} standalone/></ProductionResourceFrame>;
}
