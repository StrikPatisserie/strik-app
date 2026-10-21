import { NextResponse } from "next/server";
import { canAccessLogisticsRequest } from "@/app/lib/bakeryLogisticsAuth";
import { getPhotoPrintHistory, savePhotoPrintJob } from "@/app/lib/bakeryPhotoPrintStorage";
import { parsePhotoPrintJob } from "@/app/bakkerij/logistiek/photoPrintTracking";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!(await canAccessLogisticsRequest(request))) return NextResponse.json({ message: "Geen toegang." }, { status: 403 });
  const date = new URL(request.url).searchParams.get("date") || "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ message: "Ongeldige datum." }, { status: 400 });
  try {
    return NextResponse.json({ history: await getPhotoPrintHistory(date) });
  } catch {
    return NextResponse.json({ message: "Printstatus ophalen is niet gelukt." }, { status: 502 });
  }
}

export async function POST(request: Request) {
  if (!(await canAccessLogisticsRequest(request))) return NextResponse.json({ message: "Geen toegang." }, { status: 403 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ message: "Ongeldige printregistratie." }, { status: 400 }); }
  const job = parsePhotoPrintJob(body);
  if (!job) return NextResponse.json({ message: "Ongeldige printregistratie." }, { status: 400 });
  try {
    await savePhotoPrintJob({ ...job, printedAt: new Date().toISOString() });
    return NextResponse.json({ ok: true, history: await getPhotoPrintHistory(job.date) });
  } catch {
    return NextResponse.json({ message: "Printstatus opslaan is niet gelukt." }, { status: 502 });
  }
}
