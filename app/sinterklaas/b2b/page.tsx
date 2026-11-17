import { StrikShell } from "../../StrikUI";
import SinterklaasB2BClient from "./SinterklaasB2BClient";
import { getCurrentProfile } from "../../lib/auth/session";
import { canAccessLogistiek } from "../../lib/auth/access";

export default async function B2BOrdersPage({ searchParams }: { searchParams?: Promise<{ q?: string }> }) {
  const { q } = await (searchParams || Promise.resolve({ q: undefined }));
  const canViewProduction = canAccessLogistiek(await getCurrentProfile());
  return <StrikShell extraWide tone="default"><SinterklaasB2BClient initialSearch={typeof q === "string" ? q : ""} canViewProduction={canViewProduction} /></StrikShell>;
}
