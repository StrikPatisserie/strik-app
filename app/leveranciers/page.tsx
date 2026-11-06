import {notFound} from "next/navigation";
import {requireCurrentProfile} from "../lib/auth/session";
import {canAccessSuppliers} from "../lib/auth/access";
import {productionDepartments} from "../productie/access";
import {StrikShell,StrikPageHeader,strikIcons} from "../StrikUI";
import Suppliers from "./Suppliers";
export default async function SuppliersPage(){const profile=await requireCurrentProfile();if(!canAccessSuppliers(profile))notFound();return <StrikShell><StrikPageHeader kicker="Strik" title="Grondstoffen bestellen" description="" icon={strikIcons.logistiek}/><Suppliers hefePath={productionDepartments(profile).length?"/bakkerij/productie/bestellen/hefe":undefined}/></StrikShell>;}
