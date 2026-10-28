import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireCurrentProfile } from "@/app/lib/auth/session";
import { hasFullAccess } from "@/app/lib/auth/access";
import { productionDepartments } from "@/app/productie/access";
import ProductionResourceFrame from "@/app/productie/ProductionResourceFrame";
import { DATA_SECTIONS, PRODUCTION_HOME } from "@/app/productie/navigation";
import RecepturenApp from "@/app/bakkerij/recepturen/RecepturenApp";
import s from "@/app/preview/productie/production.module.css";
export default async function ProductionDataPage({params}:{params:Promise<{section:string}>}) {
  const profile=await requireCurrentProfile(), {section}=await params;
  if(section==="voorpagina"){if(!hasFullAccess(profile))notFound();redirect(PRODUCTION_HOME);}
  const selected=DATA_SECTIONS.find(item=>item.id===section);
  if(!hasFullAccess(profile)||!selected) notFound();
  return <ProductionResourceFrame title="Receptuurbeheer" active="data" departments={productionDepartments(profile)} canManage>
    <nav aria-label="Receptuurgegevens" className={s.resourceTabs}>{DATA_SECTIONS.map(item=><Link key={item.id} href={`${PRODUCTION_HOME}/beheer/${item.id}`} aria-current={section===item.id?"page":undefined}>{item.label}</Link>)}</nav>
    <div className={s.embeddedData}><RecepturenApp key={section} embedded scope="all" initialTab="beheer" lockedTab="beheer" hideTopNav initialBeheerView={selected.id} profile={profile}/></div>
  </ProductionResourceFrame>;
}
