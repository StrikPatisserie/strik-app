"use client";
import { usePathname } from "next/navigation";
import ProductionResourceFrame from "./ProductionResourceFrame";
import { useProductionSession } from "./ProductionSession";
import s from "../preview/productie/production.module.css";
export default function ProductionLoading(){
 const {canManage,departments}=useProductionSession(),path=usePathname();
 const active=path.includes("/rooster")?"roster":path.includes("/feestdagen")?"holidays":path.includes("/beheer/")?"data":path.includes("/haccp")?"haccp":path.endsWith("/bestellen")?"orders":"planning";
 const title=active==="roster"?"Personeelsrooster":active==="holidays"?"Feestdagen":active==="data"?"Receptuurbeheer":active==="haccp"?"HACCP & registraties":active==="orders"?"IJsgrondstoffen bestellen":"Weekplanning";
 return <ProductionResourceFrame title={title} active={active} canManage={canManage} departments={departments}><div className={s.loadingInline} role="status" aria-live="polite"><span className={s.spinner} aria-hidden="true"/>Gegevens laden…</div></ProductionResourceFrame>;
}
