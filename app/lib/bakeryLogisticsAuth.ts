import "server-only";

import { getCurrentProfile } from "./auth/session";

const LOGISTICS_IMPORT_KEY =
  process.env.BAKERY_LOGISTICS_IMPORT_KEY ||
  process.env.LOGISTICS_IMPORT_KEY ||
  process.env.WORDPRESS_STRIK_API_KEY ||
  "schoonmaak-ijs-strik";

export function getLogisticsRequestKey(request: Request, bodyKey = "") {
  const url = new URL(request.url);

  return (
    bodyKey ||
    request.headers.get("x-strik-logistics-key") ||
    url.searchParams.get("key") ||
    ""
  );
}

export async function canAccessLogisticsRequest(request: Request, bodyKey = "") {
  const key = getLogisticsRequestKey(request, bodyKey);
  if (key && key === LOGISTICS_IMPORT_KEY) return true;

  const profile = await getCurrentProfile();

  return Boolean(profile?.active);
}
