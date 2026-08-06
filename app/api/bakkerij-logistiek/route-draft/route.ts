import { NextResponse } from "next/server";
import type {
  LogisticsRouteDraft,
  LogisticsRouteDraftRound,
  LogisticsRouteDraftStop,
  LogisticsRouteLearningObservation,
  LogisticsRouteLearningObservationStop,
} from "@/app/bakkerij/logistiek/logisticsTypes";
import { canAccessLogisticsRequest } from "@/app/lib/bakeryLogisticsAuth";
import {
  deleteLogisticsRouteDraft,
  deleteLogisticsRouteLearningObservation,
  getLogisticsRouteLearning,
  upsertLogisticsRouteLearningObservation,
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

function cleanStringList(value: unknown, maxItems = 200) {
  if (!Array.isArray(value)) return [];

  return Array.from(
    new Set(value.map((item) => cleanText(item, 180)).filter(Boolean))
  ).slice(0, maxItems);
}

function cleanLearningKind(
  value: unknown
): LogisticsRouteLearningObservationStop["kind"] | "" {
  if (
    value === "shop" ||
    value === "receipt" ||
    value === "ice" ||
    value === "check"
  ) {
    return value;
  }

  return "";
}

function inferLearningKind(
  stop: LogisticsRouteDraftStop
): LogisticsRouteLearningObservationStop["kind"] {
  const kind = cleanLearningKind(stop.learningKind);
  if (kind) return kind;
  if (stop.badges.includes("winkel")) return "shop";
  if (stop.badges.includes("ijs")) return "ice";
  if (stop.badges.includes("tijd") || stop.badges.includes("groot")) {
    return "receipt";
  }

  return stop.sourceId.startsWith("check:") ? "check" : "receipt";
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
    learningKey: cleanText(candidate.learningKey, 220),
    learningLabel: cleanText(candidate.learningLabel, 180),
    learningTarget: cleanText(candidate.learningTarget, 500),
    learningKind: cleanLearningKind(candidate.learningKind) || undefined,
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

function routeLearningObservationFromDraft(
  date: string,
  draft: LogisticsRouteDraft,
  updatedAt: string
): LogisticsRouteLearningObservation {
  const stops = draft.routes.flatMap((route, routeIndex) =>
    route.stops
      .map((stop, stopIndex) => {
        const key =
          cleanText(stop.learningKey, 220) ||
          cleanText(`${stop.label} ${stop.detail}`, 220);
        if (!key) return null;

        return {
          key,
          label: cleanText(stop.learningLabel, 180) || stop.label,
          target: cleanText(stop.learningTarget, 500) || stop.detail,
          kind: inferLearningKind(stop),
          vehicle: route.vehicle,
          routeId: route.id,
          routeTitle: route.title,
          position: routeIndex * 100 + stopIndex,
          badges: stop.badges,
        };
      })
      .filter(
        (stop): stop is LogisticsRouteLearningObservationStop => Boolean(stop)
      )
  );

  return {
    id: date,
    date,
    stops,
    updatedAt,
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
      if (body.forgetLearning === true) {
        await deleteLogisticsRouteLearningObservation(date);
      }
      const routeLearning = await getLogisticsRouteLearning();

      return NextResponse.json({
        ok: true,
        deleted: true,
        routeDraft: null,
        routeLearning,
        generatedAt: new Date().toISOString(),
      });
    }

    const routes = Array.isArray(body.routes)
      ? body.routes.map(cleanRouteRound).filter(Boolean)
      : [];
    const excludedSourceIds = cleanStringList(body.excludedSourceIds);
    const shouldLearn = body.learn === true;
    const updatedAt = new Date().toISOString();

    const draft: LogisticsRouteDraft = {
      id: date,
      date,
      routes: routes as LogisticsRouteDraftRound[],
      excludedSourceIds,
      isFinal: shouldLearn,
      finalizedAt: shouldLearn ? updatedAt : "",
      updatedAt,
    };

    await upsertLogisticsRouteDraft(draft);
    if (shouldLearn) {
      await upsertLogisticsRouteLearningObservation(
        routeLearningObservationFromDraft(date, draft, draft.updatedAt)
      );
    }
    const routeLearning = await getLogisticsRouteLearning();

    return NextResponse.json({
      ok: true,
      deleted: false,
      routeDraft: draft,
      routeLearning,
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
