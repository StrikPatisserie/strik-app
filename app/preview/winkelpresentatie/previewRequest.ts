import { HEYENDAAL_TOUCHPOINT_BY_ID, isPresentationCategory } from "../../winkel/presentatie/presentationData";
import type { StorePresentationPlacement, StorePresentationState } from "../../winkel/presentatie/types";

const KEY = "strik-winkelpresentatie-demo-v1";

// Demo requests stay in this browser and never reach the store API.
export const previewRequest: typeof fetch = async (input, options) => {
  const stored = localStorage.getItem(KEY);
  const state: StorePresentationState = stored ? JSON.parse(stored) : { plans: [], completions: [], updatedAt: "" };
  const url = new URL(String(input), window.location.origin);
  const body = options?.body ? JSON.parse(String(options.body)) : null;
  const weekStart: string = body?.weekStart || url.searchParams.get("weekStart");
  const now = new Date().toISOString();
  const error = (message: string) => Response.json({ message }, { status: 400 });
  let plan = state.plans.find((item) => item.weekStart === weekStart) || null;

  if (body?.action === "save-plan") {
    if (!body.title.trim()) return error("Vul een naam voor de aanbieding in.");
    if (!isPresentationCategory(body.category)) return error("Kies een productgroep.");
    const placements: StorePresentationPlacement[] = body.placements.filter((item: StorePresentationPlacement) => HEYENDAAL_TOUCHPOINT_BY_ID.has(item.touchpointId));
    if (!placements.length) return error("Kies minimaal één presentatieplek.");
    if (placements.filter((item) => item.role === "hoofdplek").length !== 1) return error("Kies precies één hoofdplek.");
    plan = { id: `demo-${weekStart}`, storeId: "heyendaal", weekStart, title: body.title.trim(), category: body.category, generalInstruction: body.generalInstruction, placements, updatedAt: now, updatedByName: "Management (voorbeeld)" };
    state.plans = [...state.plans.filter((item) => item.weekStart !== weekStart), plan];
    state.completions = state.completions.filter((item) => item.weekStart !== weekStart);
  } else if (body?.action === "copy-previous") {
    const source = state.plans.find((item) => item.weekStart === body.sourceWeekStart);
    if (!source) return error("In de vorige week staat nog geen plaatsingsplan.");
    plan = { ...source, id: `demo-${weekStart}`, weekStart, updatedAt: now };
    state.plans = [...state.plans.filter((item) => item.weekStart !== weekStart), plan];
    state.completions = state.completions.filter((item) => item.weekStart !== weekStart);
  } else if (body?.action === "set-completion") {
    if (!plan?.placements.some((item) => item.touchpointId === body.touchpointId)) return error("Deze plek hoort niet bij de opdracht.");
    state.completions = [...state.completions.filter((item) => !(item.weekStart === weekStart && item.touchpointId === body.touchpointId)), { storeId: "heyendaal", weekStart, touchpointId: body.touchpointId, completed: body.completed === true, completedAt: now, completedBy: "demo", completedByName: "Winkel (voorbeeld)" }];
  }
  if (body) {
    state.updatedAt = now;
    localStorage.setItem(KEY, JSON.stringify(state));
  }
  return Response.json({ plan, completions: state.completions.filter((item) => item.weekStart === weekStart) });
};
