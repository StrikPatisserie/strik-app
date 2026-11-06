import { NextResponse } from "next/server";
import {
  getStoredRevenueData,
  getMergedRevenueData,
  saveRevenueData,
  savePatisserieDayCorrection,
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
  const source = body && typeof body === "object" ? body : {};
  const shouldPreserveDailyRecords = !Array.isArray(
    (source as { dailyRecords?: unknown }).dailyRecords
  );
  const shouldPreserveCashRecords = !Array.isArray(
    (source as { cashRecords?: unknown }).cashRecords
  );
  const shouldPreserveCashDeposits = !Array.isArray(
    (source as { cashDeposits?: unknown }).cashDeposits
  );

  if (
    shouldPreserveDailyRecords ||
    shouldPreserveCashRecords ||
    shouldPreserveCashDeposits
  ) {
    const stored = await getStoredRevenueData();

    if (shouldPreserveDailyRecords) {
      normalized.dailyRecords = stored.data.dailyRecords || [];
    }
    if (shouldPreserveCashRecords) {
      normalized.cashRecords = stored.data.cashRecords || [];
    }
    if (shouldPreserveCashDeposits) {
      normalized.cashDeposits = stored.data.cashDeposits || [];
    }
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

export async function PATCH(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ message: "De dagtelling ontbreekt." }, { status: 400 });
  }
  const result = await savePatisserieDayCorrection(body);
  if (!result.ok) return NextResponse.json({ message: result.message }, { status: result.status });
  return NextResponse.json({ record: result.record }, { headers: { "Cache-Control": "no-store" } });
}
