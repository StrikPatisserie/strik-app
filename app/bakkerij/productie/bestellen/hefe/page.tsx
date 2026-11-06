import Link from "next/link";
import {requireCurrentProfile} from "@/app/lib/auth/session";
import {hasFullAccess} from "@/app/lib/auth/access";
import {productionDepartments} from "@/app/productie/access";
import ProductionResourceFrame from "@/app/productie/ProductionResourceFrame";
import HefeOrders from "@/app/bakkerij/ijs-chocolade/bestellen/HefeOrders";
export default async function HefePage(){const profile=await requireCurrentProfile();return <ProductionResourceFrame title="Hefe · ijsgrondstoffen" active="orders" departments={productionDepartments(profile)} canManage={hasFullAccess(profile)}><Link href="/bakkerij/productie/bestellen">← Leveranciers</Link><HefeOrders embedded/></ProductionResourceFrame>;}
