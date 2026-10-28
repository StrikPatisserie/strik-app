import { notFound } from "next/navigation";
import { requireCurrentProfile } from "@/app/lib/auth/session";
import { hasFullAccess } from "@/app/lib/auth/access";
import { productionDepartments } from "@/app/productie/access";
import ProductionResourceFrame from "@/app/productie/ProductionResourceFrame";
import HolidayProduction from "@/app/productie/HolidayProduction";
import { todayAmsterdam } from "@/app/productie/workspaceData";
export default async function HolidayPage({params,searchParams}:{params:Promise<{season:string}>;searchParams:Promise<{year?:string}>}){
 const profile=await requireCurrentProfile(),{season}=await params,query=await searchParams;if(!productionDepartments(profile).length || !["sint","kerst"].includes(season))notFound();const year=/^20\d{2}$/.test(query.year || "")?query.year!:todayAmsterdam().slice(0,4);
 return <ProductionResourceFrame title="Feestdagen" active="holidays" departments={productionDepartments(profile)} canManage={hasFullAccess(profile)}><HolidayProduction key={`${season}:${year}`} season={season as "sint"|"kerst"} initialYear={year}/></ProductionResourceFrame>;
}
