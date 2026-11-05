import { StrikShell } from "../../StrikUI";
import SinterklaasB2BClient from "../../sinterklaas/b2b/SinterklaasB2BClient";
import { getCurrentProfile } from "../../lib/auth/session";
import { canAccessLogistiek } from "../../lib/auth/access";

export default async function B2BOrdersPage() {
  const canViewProduction = canAccessLogistiek(await getCurrentProfile());
  return <StrikShell extraWide tone="default"><SinterklaasB2BClient season="kerst" canViewProduction={canViewProduction} /></StrikShell>;
}
