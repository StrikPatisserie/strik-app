import { NextResponse } from "next/server";
import { canAccessLogisticsRequest } from "@/app/lib/bakeryLogisticsAuth";
import {
  getLogisticsBatchForDate,
  getLogisticsWebshopImagesForDate,
} from "@/app/lib/bakeryLogisticsStorage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ message }, { status });
}

export async function GET(request: Request) {
  if (!(await canAccessLogisticsRequest(request))) {
    return jsonError("Geen toegang tot bakkerij logistiek.", 403);
  }

  const url = new URL(request.url);
  const date = url.searchParams.get("date") || "";

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return jsonError("Geen geldige logistiekdatum ontvangen.");
  }

  try {
    const [batch, webshopImages] = await Promise.all([
      getLogisticsBatchForDate(date),
      getLogisticsWebshopImagesForDate(date),
    ]);

    return NextResponse.json({
      batch,
      webshopImages,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Logistiekbatch ophalen is mislukt.",
      },
      { status: 502 }
    );
  }
}
