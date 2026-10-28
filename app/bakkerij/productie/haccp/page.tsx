import { redirect } from "next/navigation";
import { requireCurrentProfile } from "@/app/lib/auth/session";
import { canAccessBakkerijPatisserie } from "@/app/lib/auth/access";
export default async function ProductionHaccpPage(){
 const profile=await requireCurrentProfile();
 redirect(`/bakkerij/productie/haccp/${canAccessBakkerijPatisserie(profile)?"bakkerij":"ijs"}`);
}
