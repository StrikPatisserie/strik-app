import { NextResponse } from "next/server";
import { getLeatInsights } from "@/app/management/leatInsightsServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const month = new URL(request.url).searchParams.get("month") || "";

  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    return NextResponse.json(
      { message: "Ongeldige maand. Gebruik JJJJ-MM." },
      { status: 400 }
    );
  }

  const insights = await getLeatInsights(month);

  return NextResponse.json(insights, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
