import { NextResponse } from "next/server";
import {
  sinterklaasAcquisitionEndDate,
  sinterklaasAcquisitionStartDate,
  sinterklaasAcquisitionStops,
} from "@/app/bakkerij/logistiek/sinterklaasAcquisitionCampaign";
import { canAccessLogisticsRequest } from "@/app/lib/bakeryLogisticsAuth";
import {
  getLogisticsAcquisitionCampaign,
  markLogisticsAcquisitionDelivered,
  undoLogisticsAcquisitionDelivery,
} from "@/app/lib/bakeryLogisticsStorage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, message }, { status });
}

function cleanText(value: unknown, maxLength = 200) {
  return String(value || "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

export async function GET(request: Request) {
  if (!(await canAccessLogisticsRequest(request))) {
    return jsonError("Geen toegang tot bakkerij logistiek.", 403);
  }

  try {
    return NextResponse.json({
      ok: true,
      campaign: await getLogisticsAcquisitionCampaign(),
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return jsonError(
      error instanceof Error
        ? error.message
        : "Acquisitiecampagne ophalen is mislukt.",
      502
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    if (!(await canAccessLogisticsRequest(request, cleanText(body.key)))) {
      return jsonError("Geen toegang tot bakkerij logistiek.", 403);
    }

    const action = cleanText(body.action, 20);
    const stopId = cleanText(body.stopId, 180);
    if (!sinterklaasAcquisitionStops.some((stop) => stop.id === stopId)) {
      return jsonError("Onbekend acquisitieadres ontvangen.");
    }

    if (action === "undo") {
      return NextResponse.json({
        ok: true,
        campaign: await undoLogisticsAcquisitionDelivery(stopId),
        generatedAt: new Date().toISOString(),
      });
    }

    if (action !== "deliver") {
      return jsonError("Onbekende campagneactie ontvangen.");
    }

    const date = cleanText(body.date, 20);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return jsonError("Geen geldige bezorgdatum ontvangen.");
    }
    if (
      date < sinterklaasAcquisitionStartDate ||
      date > sinterklaasAcquisitionEndDate
    ) {
      return jsonError("Deze datum valt buiten de Sinterklaascampagne.");
    }

    const campaign = await markLogisticsAcquisitionDelivered({
      stopId,
      date,
      routeId: cleanText(body.routeId, 120),
      routeTitle: cleanText(body.routeTitle, 120),
      vehicle: cleanText(body.vehicle, 80),
      deliveredAt: new Date().toISOString(),
    });

    return NextResponse.json({
      ok: true,
      campaign,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return jsonError(
      error instanceof Error
        ? error.message
        : "Acquisitiecampagne bijwerken is mislukt.",
      502
    );
  }
}
