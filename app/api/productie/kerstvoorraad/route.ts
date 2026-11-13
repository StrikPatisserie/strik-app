import { getCurrentProfile } from "@/app/lib/auth/session";
import { productionDepartments } from "@/app/productie/access";
import { ProductionStoreError } from "@/app/productie/documents.server";
import { christmasProductionSource } from "@/app/preview/productie/kerstvoorraad/liveSource.server";
import { readForecastSettings, saveForecastCommand } from "@/app/preview/productie/kerstvoorraad/store.server";
import { ForecastConflictError } from "@/app/preview/productie/kerstvoorraad/sharedSettings";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
export async function GET(request: Request) {
  if (!productionDepartments(await getCurrentProfile()).length) return Response.json({ message: "Geen toegang tot kerstvoorraad." }, { status: 403, headers });
  try {
    const sharedSettings = await readForecastSettings();
    if (new URL(request.url).searchParams.get("settings") === "1") return Response.json({ sharedSettings }, { headers });
    return Response.json({ sharedSettings, ...await christmasProductionSource() }, { headers });
  } catch {
    return Response.json({ message: "Kerstvoorraad is nu niet bereikbaar." }, { status: 503, headers });
  }
}
export async function PATCH(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile || !productionDepartments(profile).length) return Response.json({ message: "Geen toegang tot kerstvoorraad." }, { status: 403, headers });
  if (request.headers.get("origin") !== new URL(request.url).origin) return Response.json({ message: "Ongeldige herkomst." }, { status: 403, headers });
  try {
    const raw = await request.text();
    if (raw.length > 10000) return Response.json({ message: "Deze bijstelling is te groot." }, { status: 413, headers });
    const sharedSettings = await saveForecastCommand(JSON.parse(raw), profile.id);
    return Response.json({ sharedSettings }, { headers });
  } catch (error) {
    return Response.json({ message: error instanceof Error ? error.message : "Opslaan mislukt." }, {
      status: error instanceof ForecastConflictError ? 409 : error instanceof ProductionStoreError ? error.status : 400, headers,
    });
  }
}
