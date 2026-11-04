import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/app/lib/auth/session";
import { hasFullAccess } from "@/app/lib/auth/access";
import { getStoredRevenueData } from "@/app/management/revenueServer";
import { latestHomeDayRevenue } from "@/app/management/homeDayRevenue";
import { getRevenueComparisonHistory } from "@/app/management/revenueHistoryServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = {"Cache-Control":"private, no-store, max-age=0",Vary:"Cookie"};
export async function GET() {
  const profile = await getCurrentProfile();
  if (!hasFullAccess(profile)) return NextResponse.json({message:"Geen toegang tot dagomzet."},{status:403,headers});
  try {
    const [{data,storage},history] = await Promise.all([getStoredRevenueData(),getRevenueComparisonHistory()]);
    if (storage.status !== "wordpress") return NextResponse.json({message:"Dagomzet tijdelijk niet beschikbaar."},{status:503,headers});
    return NextResponse.json(latestHomeDayRevenue(data.dailyRecords || [],new Date(),history),{headers});
  } catch {
    return NextResponse.json({message:"Dagomzet tijdelijk niet beschikbaar."},{status:503,headers});
  }
}
