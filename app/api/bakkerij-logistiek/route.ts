import { NextResponse } from "next/server";
import { canAccessLogisticsRequest } from "@/app/lib/bakeryLogisticsAuth";
import {
  getLogisticsBatchForDate,
  getLogisticsDayFeedbackForDate,
  getLogisticsReceiptOverridesForDate,
  getLogisticsRouteDraftForDate,
  getLogisticsRouteLearning,
  getLogisticsWebshopImagesForDate,
  readLogisticsState,
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
    const debug = url.searchParams.get("debug") === "1";
    const [
      batch,
      webshopImages,
      receiptOverrides,
      dayFeedback,
      routeDraft,
      routeLearning,
    ] =
      await Promise.all([
        getLogisticsBatchForDate(date),
        getLogisticsWebshopImagesForDate(date),
        getLogisticsReceiptOverridesForDate(date),
        getLogisticsDayFeedbackForDate(date),
        getLogisticsRouteDraftForDate(date),
        getLogisticsRouteLearning(),
      ]);

    if (debug) {
      const state = await readLogisticsState();
      const batchesForDate = state.batches
        .filter((item) => item.date === date)
        .map((item) => ({
          id: item.id,
          status: item.status,
          fileName: item.fileName,
          subject: item.subject,
          receivedAt: item.receivedAt,
          importedAt: item.importedAt,
          importWaveId: item.importWaveId,
          pageCount: item.pageCount,
          orderCount: item.orderCount,
          receiptNumbers: item.receipts
            .map((receipt) => receipt.receiptNumber)
            .filter(Boolean),
        }));

      return NextResponse.json({
        batch: batch
          ? {
              id: batch.id,
              status: batch.status,
              fileName: batch.fileName,
              subject: batch.subject,
              receivedAt: batch.receivedAt,
              importedAt: batch.importedAt,
              importWaveId: batch.importWaveId,
              pageCount: batch.pageCount,
              orderCount: batch.orderCount,
            }
          : null,
        batchesForDate,
        batchCount: batchesForDate.length,
        generatedAt: new Date().toISOString(),
      });
    }

    return NextResponse.json({
      batch,
      webshopImages,
      receiptOverrides,
      dayFeedback,
      routeDraft,
      routeLearning,
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
