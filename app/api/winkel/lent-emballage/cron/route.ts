import { hasCronAuthorization } from '@/app/lib/auth/cron';
import { recordLentMorningCheck } from '@/app/winkel/lentEmballage.server';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;
const headers = { 'Cache-Control': 'private, no-store' };
export async function GET(request: Request) {
  if (!hasCronAuthorization(request)) return Response.json({ message: 'Geen toegang.' }, { status: 403, headers });
  if (process.env.VERCEL_ENV !== 'production') return Response.json({ message: 'Alleen actief in productie.' }, { status: 409, headers });
  try { return Response.json(await recordLentMorningCheck(), { headers }); }
  catch { return Response.json({ message: 'De emballagecontrole is niet gelukt.' }, { status: 503, headers }); }
}
