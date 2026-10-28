import type { ReactNode } from "react";
import ProductionNavigation, { ProductionMobileNavigation } from "./ProductionNavigation";
import { BOARDS, departmentsFor, type DepartmentId } from "./planning";
import s from "../preview/productie/production.module.css";

export default function ProductionResourceFrame({ title, active, departments, canManage, children }: {
  title: string; active: string; departments: DepartmentId[]; canManage: boolean; children: ReactNode;
}) {
  const boards = BOARDS.filter(board => departmentsFor(board.id).some(department => departments.includes(department.id)));
  const canBakery = departments.some(department => department !== "ijs" && department !== "chocolade");
  return <div className={s.root}><ProductionNavigation active={active} boards={boards} canManage={canManage} canBakery={canBakery} /><main className={s.main}>
    <div className={s.previewBar}><span><i />Strik Productie</span></div>
    <header className={s.header}><div className={s.heading}><span className={s.eyebrow}>STRIK PRODUCTIE</span><h1>{title}</h1></div></header>
    <ProductionMobileNavigation active={active} canManage={canManage} canBakery={canBakery} />
    <div className={s.resourceSurface} data-production-content>{children}</div>
  </main></div>;
}
