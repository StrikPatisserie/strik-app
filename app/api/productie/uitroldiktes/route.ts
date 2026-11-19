import { getCurrentProfile } from "@/app/lib/auth/session";
import { productionDepartments } from "@/app/productie/access";
import { readOperational, saveOperational } from "@/app/productie/operationalStore.server";
import { ProductionStoreError } from "@/app/productie/documents.server";
import { ROLLOUT_THICKNESSES_KEY, initialThicknessDocument, changeThickness, type ThicknessDocument } from "@/app/productie/rolloutThicknesses";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
export async function GET() {
  const profile = await getCurrentProfile();
  if (!profile || !productionDepartments(profile).length) return Response.json({ message: "Geen toegang tot de bakkerij." }, { status: 403, headers });
  try { return Response.json(await readOperational<ThicknessDocument>(ROLLOUT_THICKNESSES_KEY, initialThicknessDocument()), { headers }); }
  catch { return Response.json({ message: "Uitroldiktes konden niet worden geladen." }, { status: 503, headers }); }
}
export async function POST(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile || !productionDepartments(profile).length) return Response.json({ message: "Geen toegang tot de bakkerij." }, { status: 403, headers });
  if (request.headers.get("origin") !== new URL(request.url).origin) return Response.json({ message: "Ongeldige herkomst." }, { status: 403, headers });
  try {
    const raw = await request.text();
    if (raw.length > 5000) throw Error("De wijziging is te groot.");
    const input = JSON.parse(raw);
    const doc = await readOperational<ThicknessDocument>(ROLLOUT_THICKNESSES_KEY, initialThicknessDocument());
    if (input.revision !== doc.revision) throw new ProductionStoreError("Iemand heeft de lijst intussen gewijzigd. Controleer de vernieuwde lijst en sla opnieuw op.", 409);
    const next = changeThickness(doc, input, profile.full_name || profile.email, new Date().toISOString());
    await saveOperational(ROLLOUT_THICKNESSES_KEY, doc.revision, next, profile.id);
    return Response.json(next, { headers });
  } catch (error) { return Response.json({ message: error instanceof Error ? error.message : "Opslaan mislukt." }, { status: error instanceof ProductionStoreError ? error.status : 400, headers }); }
}
