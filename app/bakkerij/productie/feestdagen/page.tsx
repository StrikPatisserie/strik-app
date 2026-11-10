import { notFound } from "next/navigation";
import { requireCurrentProfile } from "@/app/lib/auth/session";
import { hasFullAccess } from "@/app/lib/auth/access";
import { productionDepartments } from "@/app/productie/access";
import ProductionResourceFrame from "@/app/productie/ProductionResourceFrame";
import HolidayMenu from "@/app/productie/HolidayMenu";

export default async function Holidays() {
  const profile = await requireCurrentProfile();
  const departments = productionDepartments(profile);
  if (!departments.length) notFound();
  return <ProductionResourceFrame title="Feestdagen" active="holidays" departments={departments} canManage={hasFullAccess(profile)}>
    <HolidayMenu forecastHref={process.env.NODE_ENV === "development" ? "/bakkerij/productie/feestdagen/kerstvoorraad" : undefined} />
  </ProductionResourceFrame>;
}
