import { getCurrentProfile } from '@/app/lib/auth/session';
import { canReceiveLentEmballage } from '@/app/winkel/lentEmballage';
import { checkLentEmballage } from '@/app/winkel/lentEmballage.server';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
const headers = { 'Cache-Control': 'private, no-store' };
export async function GET() {
  const profile = await getCurrentProfile();
  if (!canReceiveLentEmballage(profile)) return Response.json({ message: 'Geen toegang.' }, { status: 403, headers });
  try { return Response.json(await checkLentEmballage(), { headers }); }
  catch { return Response.json({ message: 'De emballageroute kon niet worden gecontroleerd.' }, { status: 503, headers }); }
}
