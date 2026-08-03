import { NextResponse } from "next/server";
import type {
  LogisticsRouteDraft,
  LogisticsRouteDraftRound,
  LogisticsRouteDraftStop,
} from "@/app/bakkerij/logistiek/logisticsTypes";
import { canAccessLogisticsRequest } from "@/app/lib/bakeryLogisticsAuth";
import {
  deleteLogisticsRouteDraft,
  upsertLogisticsRouteDraft,
} from "@/app/lib/bakeryLogisticsStorage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, message }, { status });
}

function cleanText(value: unknown, maxLength = 500) {
  return String(value || "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function cleanBadges(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => cleanText(item, 80))
    .filter(Boolean)
    .slice(0, 8);
}

function cleanRouteStop(value: unknown): LogisticsRouteDraftStop | null {
  if (!value || typeof value !== "object") return null;

  const candidate = value as Partial<LogisticsRouteDraftStop>;
  const id = cleanText(candidate.id, 180);
  const sourceId = cleanText(candidate.sourceId, 180) || id;
  const label = cleanText(candidate.label, 180);
  const detail = cleanText(candidate.detail, 500);

  if (!id || !sourceId || !label) return null;

  return {
    id,
    sourceId,
    label,
    detail,
    badges: cleanBadges(candidate.badges),
  };
}

function cleanRouteRound(value: unknown): LogisticsRouteDraftRound | null {
  if (!value || typeof value !== "object") return null;

  const candidate = value as Partial<LogisticsRouteDraftRound>;
  const id = cleanText(candidate.id, 120);
  const vehicle = cleanText(candidate.vehicle, 80);
  const stops = Array.isArray(candidate.stops)
    ? candidate.stops.map(cleanRouteStop).filter(Boolean)
    : [];

  if (!id || !vehicle) return null;

  return {
    id,
    title: cleanText(candidate.title, 80) || "Ronde",
    vehicle,
    departure: cleanText(candidate.departure, 80),
    badge: cleanText(candidate.badge, 80),
    tone: cleanText(candidate.tone, 160),
    stops: stops as LogisticsRouteDraftStop[],
    reason: cleanText(candidate.reason, 500),
    load: cleanText(candidate.load, 160),
  };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;

    if (!(await canAccessLogisticsRequest(request, cleanText(body.key, 200)))) {
      return jsonError("Geen toegang tot bakkerij logistiek.", 403);
    }

    const date = cleanText(body.date, 20);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return jsonError("Geen geldige routedatum ontvangen.");
    }

    if (body.reset === true) {
      await deleteLogisticsRouteDraft(date);

      return NextResponse.json({
        ok: true,
        deleted: true,
        routeDraft: null,
        generatedAt: new Date().toISOString(),
      });
    }

    const routes = Array.isArray(body.routes)
      ? body.routes.map(cleanRouteRound).filter(Boolean)
      : [];

    const draft: LogisticsRouteDraft = {
      id: date,
      date,
      routes: routes as LogisticsRouteDraftRound[],
      updatedAt: new Date().toISOString(),
    };

    await upsertLogisticsRouteDraft(draft);

    return NextResponse.json({
      ok: true,
      deleted: false,
      routeDraft: draft,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "Routeplanning opslaan is mislukt.",
      },
      { status: 502 }
    );
  }
}
