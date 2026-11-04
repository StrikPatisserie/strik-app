import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/app/lib/auth/session";
import { hasFullAccess } from "@/app/lib/auth/access";
import { getStoredRevenueData } from "@/app/management/revenueServer";
import { latestHomeDayRevenue } from "@/app/management/homeDayRevenue";
import { getRevenueComparisonHistory } from "@/app/management/revenueHistoryServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = {"Cache-Control":"private, no-store, max-age=0",Vary:"Cookie"};
export async function GET(request?: Request) {
  const profile = await getCurrentProfile();
  if (!hasFullAccess(profile)) return NextResponse.json({message:"Geen toegang tot dagomzet."},{status:403,headers});
  const date=request ? new URL(request.url).searchParams.get("date") : null;
  if(date && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0,10)!==date))return NextResponse.json({message:"Ongeldige datum."},{status:400,headers});
  try {
    const [{data,storage},history] = await Promise.all([getStoredRevenueData(),getRevenueComparisonHistory()]);
    if (storage.status !== "wordpress") return NextResponse.json({message:"Dagomzet tijdelijk niet beschikbaar."},{status:503,headers});
    return NextResponse.json(latestHomeDayRevenue(data.dailyRecords || [],new Date(),history,date),{headers});
  } catch {
    return NextResponse.json({message:"Dagomzet tijdelijk niet beschikbaar."},{status:503,headers});
  }
}
