import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { requireCurrentProfile } from "@/app/lib/auth/session";
import { canAccessBakkerijPatisserie, canAccessBakkerijIjsChocolade, hasFullAccess } from "@/app/lib/auth/access";
import { productionDepartments } from "@/app/productie/access";
import ProductionResourceFrame from "@/app/productie/ProductionResourceFrame";
import s from "@/app/preview/productie/production.module.css";
export default async function ProductionHaccpLayout({params,children}:{params:Promise<{department:string}>;children:ReactNode}){
 const profile=await requireCurrentProfile(),{department}=await params;
 const departments=[{id:"bakkerij",label:"Bakkerij",allowed:canAccessBakkerijPatisserie(profile)},{id:"ijs",label:"IJs & chocolade",allowed:canAccessBakkerijIjsChocolade(profile)}].filter(d=>d.allowed);
 if(!departments.some(d=>d.id===department))notFound();
 return <ProductionResourceFrame title="HACCP & registraties" active="haccp" departments={productionDepartments(profile)} canManage={hasFullAccess(profile)}>
   <nav className={s.resourceTabs} aria-label="HACCP-afdeling">{departments.map(d=><Link key={d.id} href={`/bakkerij/productie/haccp/${d.id}`} aria-current={department===d.id?"page":undefined}>{d.label}</Link>)}</nav>
   {children}
 </ProductionResourceFrame>;
}
