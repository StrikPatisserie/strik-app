import { hasFullAccess } from "@/app/lib/auth/access";
import { getCurrentProfile } from "@/app/lib/auth/session";
import { ProductionStoreError } from "@/app/productie/documents.server";
import { weeklyArchiveService } from "@/app/productie/weeklyArchive.server";
import { weeklyArchiveCsv, weeklyArchiveHtml } from "@/app/productie/weeklyArchive";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };

export async function GET(request: Request, context: { params: Promise<{ weekStart: string }> }) {
  if (!hasFullAccess(await getCurrentProfile())) return Response.json({ message: "Geen toegang tot het weekarchief." }, { status: 403, headers });
  try {
    const { weekStart } = await context.params;
    const format = new URL(request.url).searchParams.get("format") || "json";
    if (!["json", "csv", "html"].includes(format)) throw new ProductionStoreError("Kies JSON, CSV of het weekoverzicht.", 400);
    const { snapshot, record } = await weeklyArchiveService().read(weekStart);
    const fileHeaders = { ...headers, "X-Archive-SHA256": record.sha256 };
    if (format === "html") return new Response(weeklyArchiveHtml(snapshot, new URL(request.url).origin, Infinity), { headers: {
      ...fileHeaders, "Content-Type": "text/html; charset=utf-8", "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'",
    } });
    if (format === "csv") return new Response(weeklyArchiveCsv(snapshot), { headers: { ...fileHeaders, "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="strak-gepland-${weekStart}.csv"` } });
    return new Response(new Uint8Array(Buffer.from(record.payload, "base64")), { headers: {
      ...fileHeaders, "Content-Type": "application/json; charset=utf-8", "Content-Encoding": "gzip", "Content-Disposition": `attachment; filename="strak-gepland-${weekStart}.json"`,
    } });
  } catch (error) {
    return Response.json({ message: error instanceof ProductionStoreError ? error.message : "Deze weekkopie kon niet worden geopend." }, { status: error instanceof ProductionStoreError ? error.status : 503, headers });
  }
}
