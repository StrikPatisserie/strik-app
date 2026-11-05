import { StrikShell } from "../../StrikUI";
import SinterklaasB2BClient from "./SinterklaasB2BClient";
import { getCurrentProfile } from "../../lib/auth/session";
import { canAccessLogistiek } from "../../lib/auth/access";

export default async function B2BOrdersPage() {
  const canViewProduction = canAccessLogistiek(await getCurrentProfile());
  return <StrikShell extraWide tone="default"><SinterklaasB2BClient canViewProduction={canViewProduction} /></StrikShell>;
}
