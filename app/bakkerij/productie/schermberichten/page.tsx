import {notFound} from "next/navigation";
import {requireCurrentProfile} from "@/app/lib/auth/session";
import {canManageScreenMessages,hasFullAccess} from "@/app/lib/auth/access";
import {productionDepartments} from "@/app/productie/access";
import ProductionResourceFrame from "@/app/productie/ProductionResourceFrame";
import ScreenMessagesEditor from "@/app/productie/ScreenMessagesEditor";
export const dynamic="force-dynamic";
export default async function ScreenMessagesPage(){
 const profile=await requireCurrentProfile();if(!canManageScreenMessages(profile))notFound();
 return <ProductionResourceFrame title="Schermberichten" active="settings" departments={productionDepartments(profile)} canManage={hasFullAccess(profile)}><ScreenMessagesEditor/></ProductionResourceFrame>;
}
