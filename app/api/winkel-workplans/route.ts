import { NextResponse } from "next/server";
import { canAccessWinkelStore } from "../../lib/auth/access";
import { getCurrentProfile } from "../../lib/auth/session";
import {
  getWinkelWorkPlanPeriodChecks,
  getWinkelWorkPlanPeriodNote,
  readWinkelWorkPlanState,
  upsertWinkelWorkPlanCheck,
  upsertWinkelWorkPlanNote,
  writeWinkelWorkPlanState,
} from "../../lib/winkelWorkPlansStorage";
import {
  flattenWinkelWorkPlanItems,
  getWinkelWorkPlanDefinition,
  isWinkelWorkPlanId,
  isWinkelWorkPlanStoreId,
} from "../../winkel/haccp/workPlans";

export const dynamic = "force-dynamic";

function getRequestContext(request: Request) {
  const url = new URL(request.url);
  const storeId = url.searchParams.get("storeId") || "";
  const planId = url.searchParams.get("planId") || "";
  const periodKey = url.searchParams.get("periodKey") || "";

  return { storeId, planId, periodKey };
}

function isValidPeriodKey(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) || /^\d{4}-W\d{2}$/.test(value);
}

function badRequest(message: string) {
  return NextResponse.json({ message }, { status: 400 });
}

async function authorize(
  storeId: string,
  planId: string,
  periodKey: string
) {
  const profile = await getCurrentProfile();

  if (!profile?.active) {
    return {
      ok: false as const,
      response: NextResponse.json({ message: "Niet ingelogd." }, { status: 401 }),
    };
  }

  if (
    !isWinkelWorkPlanStoreId(storeId) ||
    !isWinkelWorkPlanId(planId) ||
    !isValidPeriodKey(periodKey)
  ) {
    return {
      ok: false as const,
      response: badRequest("Ongeldige winkel, lijst of datum."),
    };
  }

  if (!canAccessWinkelStore(profile, storeId)) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { message: "Deze winkel hoort niet bij je account." },
        { status: 403 }
      ),
    };
  }

  const definition = getWinkelWorkPlanDefinition(storeId, planId);
  if (!definition) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { message: "Voor deze winkel is deze lijst nog niet ingericht." },
        { status: 404 }
      ),
    };
  }

  return { ok: true as const, profile, definition };
}

function getProfileName(profile: { full_name?: string; email?: string }) {
  return profile.full_name?.trim() || profile.email?.trim() || "Onbekend";
}

export async function GET(request: Request) {
  const { storeId, planId, periodKey } = getRequestContext(request);
  const auth = await authorize(storeId, planId, periodKey);

  if (!auth.ok) return auth.response;

  const state = await readWinkelWorkPlanState();

  return NextResponse.json({
    checks: getWinkelWorkPlanPeriodChecks(state, storeId, planId, periodKey),
    note: getWinkelWorkPlanPeriodNote(state, storeId, planId, periodKey),
    updatedAt: state.updatedAt,
  });
}

export async function POST(request: Request) {
  const { storeId, planId, periodKey } = getRequestContext(request);
  const auth = await authorize(storeId, planId, periodKey);

  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("Werkplan kon niet gelezen worden.");
  }

  if (!body || typeof body !== "object") {
    return badRequest("Werkplan kon niet gelezen worden.");
  }

  const payload = body as {
    itemId?: unknown;
    checked?: unknown;
    note?: unknown;
  };
  const now = new Date().toISOString();
  const state = await readWinkelWorkPlanState();
  let nextState = state;

  if (typeof payload.itemId === "string") {
    const allowedItemIds = new Set(
      flattenWinkelWorkPlanItems(auth.definition).map((item) => item.id)
    );

    if (!allowedItemIds.has(payload.itemId)) {
      return badRequest("Deze taak hoort niet bij dit werkplan.");
    }

    nextState = upsertWinkelWorkPlanCheck(nextState, {
      storeId,
      planId,
      periodKey,
      itemId: payload.itemId,
      checked: payload.checked === true,
      checkedAt: now,
      checkedBy: auth.profile.id,
      checkedByName: getProfileName(auth.profile),
    });
  }

  if (typeof payload.note === "string") {
    nextState = upsertWinkelWorkPlanNote(nextState, {
      storeId,
      planId,
      periodKey,
      note: payload.note.slice(0, 800),
      updatedAt: now,
      updatedBy: auth.profile.id,
      updatedByName: getProfileName(auth.profile),
    });
  }

  if (nextState === state) {
    return badRequest("Geen wijziging ontvangen.");
  }

  await writeWinkelWorkPlanState(nextState);

  return NextResponse.json({
    checks: getWinkelWorkPlanPeriodChecks(nextState, storeId, planId, periodKey),
    note: getWinkelWorkPlanPeriodNote(nextState, storeId, planId, periodKey),
    updatedAt: nextState.updatedAt,
  });
}
