import { NextResponse } from "next/server";
import { canAccessStorePresentation, hasFullAccess } from "../../lib/auth/access";
import { getCurrentProfile } from "../../lib/auth/session";
import {
  getStorePresentationCompletions,
  getStorePresentationPlan,
  readStorePresentationState,
  upsertStorePresentationCompletion,
  upsertStorePresentationPlan,
  writeStorePresentationState,
} from "../../lib/storePresentationStorage";
import {
  HEYENDAAL_TOUCHPOINT_BY_ID,
  isPresentationCategory,
  normalizeWeekStart,
} from "../../winkel/presentatie/presentationData";
import type {
  PresentationPlacementRole,
  StorePresentationPlacement,
  StorePresentationPlan,
} from "../../winkel/presentatie/types";

export const dynamic = "force-dynamic";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ message }, { status });
}

function text(value: unknown, maxLength = 500) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function getProfileName(profile: { full_name?: string; email?: string }) {
  return profile.full_name?.trim() || profile.email?.trim() || "Onbekend";
}

async function authorize(storeId: string) {
  const profile = await getCurrentProfile();
  if (!profile?.active) {
    return {
      ok: false as const,
      response: jsonError("Niet ingelogd.", 401),
    };
  }

  if (storeId !== "heyendaal") {
    return {
      ok: false as const,
      response: jsonError("Deze pilot is alleen voor Heyendaalseweg.", 404),
    };
  }

  if (!canAccessStorePresentation(profile)) {
    return {
      ok: false as const,
      response: jsonError("Deze winkel hoort niet bij je account.", 403),
    };
  }

  return { ok: true as const, profile };
}

function normalizePlacements(value: unknown): StorePresentationPlacement[] {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  return value.flatMap((raw): StorePresentationPlacement[] => {
    if (!raw || typeof raw !== "object") return [];
    const record = raw as Record<string, unknown>;
    const touchpointId = text(record.touchpointId, 80);
    if (!HEYENDAAL_TOUCHPOINT_BY_ID.has(touchpointId) || seen.has(touchpointId)) return [];
    seen.add(touchpointId);

    const role: PresentationPlacementRole =
      record.role === "hoofdplek" ? "hoofdplek" : "ondersteuning";
    return [{
      touchpointId,
      role,
      instruction: text(record.instruction, 500),
    }];
  });
}

function responseForWeek(
  state: Awaited<ReturnType<typeof readStorePresentationState>>,
  weekStart: string
) {
  return NextResponse.json({
    storeId: "heyendaal",
    weekStart,
    plan: getStorePresentationPlan(state, "heyendaal", weekStart),
    completions: getStorePresentationCompletions(state, "heyendaal", weekStart),
    updatedAt: state.updatedAt,
  });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const storeId = url.searchParams.get("storeId") || "heyendaal";
  const weekStart = normalizeWeekStart(url.searchParams.get("weekStart") || "");
  const auth = await authorize(storeId);
  if (!auth.ok) return auth.response;

  const state = await readStorePresentationState();
  return responseForWeek(state, weekStart);
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("De wijziging kon niet worden gelezen.");
  }

  if (!body || typeof body !== "object") {
    return jsonError("De wijziging kon niet worden gelezen.");
  }

  const payload = body as Record<string, unknown>;
  const storeId = text(payload.storeId, 40) || "heyendaal";
  const weekStart = normalizeWeekStart(text(payload.weekStart, 10));
  const auth = await authorize(storeId);
  if (!auth.ok) return auth.response;

  const action = text(payload.action, 40);
  const state = await readStorePresentationState();

  if (action === "save-plan") {
    if (!hasFullAccess(auth.profile)) {
      return jsonError("Alleen management kan de winkelplaatsing wijzigen.", 403);
    }

    const title = text(payload.title, 160);
    const rawCategory = text(payload.category, 40);
    const placements = normalizePlacements(payload.placements);
    if (!title) return jsonError("Vul een naam voor de aanbieding in.");
    if (!isPresentationCategory(rawCategory)) return jsonError("Kies een geldige productgroep.");
    if (!placements.length) return jsonError("Kies minimaal één presentatieplek.");
    if (placements.filter((placement) => placement.role === "hoofdplek").length !== 1) {
      return jsonError("Kies precies één hoofdplek.");
    }

    const now = new Date().toISOString();
    const plan: StorePresentationPlan = {
      id: `heyendaal-${weekStart}`,
      storeId: "heyendaal",
      weekStart,
      title,
      category: rawCategory,
      generalInstruction: text(payload.generalInstruction, 800),
      placements,
      updatedAt: now,
      updatedByName: getProfileName(auth.profile),
    };
    const nextState = upsertStorePresentationPlan(state, plan);
    await writeStorePresentationState(nextState);
    return responseForWeek(nextState, weekStart);
  }

  if (action === "copy-previous") {
    if (!hasFullAccess(auth.profile)) {
      return jsonError("Alleen management kan een winkelplaatsing kopiëren.", 403);
    }

    const sourceWeekStart = normalizeWeekStart(text(payload.sourceWeekStart, 10));
    const source = getStorePresentationPlan(state, "heyendaal", sourceWeekStart);
    if (!source) return jsonError("In de vorige week staat nog geen plaatsingsplan.", 404);

    const now = new Date().toISOString();
    const copied: StorePresentationPlan = {
      ...source,
      id: `heyendaal-${weekStart}`,
      weekStart,
      updatedAt: now,
      updatedByName: getProfileName(auth.profile),
    };
    const nextState = upsertStorePresentationPlan(state, copied);
    await writeStorePresentationState(nextState);
    return responseForWeek(nextState, weekStart);
  }

  if (action === "set-completion") {
    const touchpointId = text(payload.touchpointId, 80);
    const plan = getStorePresentationPlan(state, "heyendaal", weekStart);
    if (!plan?.placements.some((placement) => placement.touchpointId === touchpointId)) {
      return jsonError("Deze plek hoort niet bij het plaatsingsplan.");
    }

    const now = new Date().toISOString();
    const nextState = upsertStorePresentationCompletion(state, {
      storeId: "heyendaal",
      weekStart,
      touchpointId,
      completed: payload.completed === true,
      completedAt: now,
      completedBy: auth.profile.id,
      completedByName: getProfileName(auth.profile),
    });
    await writeStorePresentationState(nextState);
    return responseForWeek(nextState, weekStart);
  }

  return jsonError("Onbekende wijziging.");
}
