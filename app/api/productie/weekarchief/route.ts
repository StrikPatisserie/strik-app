import { hasFullAccess } from "@/app/lib/auth/access";
import { getCurrentProfile } from "@/app/lib/auth/session";
import { ProductionStoreError } from "@/app/productie/documents.server";
import { weeklyArchiveService } from "@/app/productie/weeklyArchive.server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store" };

export async function GET() {
  if (!hasFullAccess(await getCurrentProfile())) return Response.json({ message: "Geen toegang tot het weekarchief." }, { status: 403, headers });
  try { return Response.json(await weeklyArchiveService().list(), { headers }); }
  catch (error) { return Response.json({ message: "Het weekarchief is tijdelijk niet bereikbaar." }, { status: error instanceof ProductionStoreError ? error.status : 503, headers }); }
}
