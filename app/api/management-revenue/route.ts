import { NextResponse } from "next/server";
import {
  getStoredRevenueData,
  getMergedRevenueData,
  saveRevenueData,
} from "../../management/revenueServer";
import { normalizeRevenueData } from "../../management/revenueData";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const data = await getMergedRevenueData();

  return NextResponse.json(data, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

export async function PUT(request: Request) {
  const body = (await request.json().catch(() => null)) as unknown;
  const normalized = normalizeRevenueData(body);

  if (
    !body ||
    typeof body !== "object" ||
    !Array.isArray((body as { dailyRecords?: unknown }).dailyRecords)
  ) {
    const stored = await getStoredRevenueData();
    normalized.dailyRecords = stored.data.dailyRecords || [];
  }

  const result = await saveRevenueData(normalized);

  if (!result.ok) {
    return NextResponse.json(
      { message: result.message, wordpressStatus: result.status },
      { status: result.status === 403 ? 403 : 502 }
    );
  }

  return NextResponse.json(await getMergedRevenueData(), {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

export async function POST(request: Request) {
  return PUT(request);
}
