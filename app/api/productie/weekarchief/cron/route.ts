import { hasCronAuthorization } from "@/app/lib/auth/cron";
import { weeklyArchiveService } from "@/app/productie/weeklyArchive.server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;
const headers = { "Cache-Control": "private, no-store" };

export async function GET(request: Request) {
  if (!hasCronAuthorization(request)) return Response.json({ message: "Geen toegang." }, { status: 403, headers });
  if (process.env.VERCEL_ENV !== "production") return Response.json({ message: "Automatisch archiveren is alleen beschikbaar in de productieomgeving." }, { status: 409, headers });
  try { return Response.json(await weeklyArchiveService().run(), { headers }); }
  catch { return Response.json({ message: "De weekcontrole is nog niet afgerond. De volgende controle hervat veilig." }, { status: 503, headers }); }
}
