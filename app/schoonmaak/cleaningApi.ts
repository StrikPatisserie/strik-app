import { PlanType, flattenTasks, getTakenLijst, planOptions } from "./tasks";

export const CLEANING_API_URL =
  "https://strik-patisserie.nl/wp-json/strik/v1/cleaning";
export const CLEANING_API_KEY = "schoonmaak-ijs-strik";

const PLAN_MARKER_PREFIX = "__strik_plan:";

export type CleaningTemperatureRegistration = {
  id?: string;
  naam: string;
  temperatuur: string;
};

export type CleaningPhotoUpload = {
  id?: string;
  label: string;
  fileName: string;
  dataUrl: string;
};

export type CleaningItem = {
  id: number;
  titel?: string;
  winkel: string;
  naam: string;
  datum: string;
  taken: string[];
  opmerking: string;
  temperatuurRegistraties?: CleaningTemperatureRegistration[];
  fotoUploads?: CleaningPhotoUpload[];
};

export function getCleaningUrl() {
  const url = new URL(CLEANING_API_URL);
  url.searchParams.set("key", CLEANING_API_KEY);

  return url;
}

export function getPlanMarker(planType: PlanType) {
  return `${PLAN_MARKER_PREFIX}${planType}`;
}

export function isInternalCleaningTask(taak: string) {
  return taak.startsWith(PLAN_MARKER_PREFIX);
}

export function stripInternalCleaningTasks(taken: string[] = []) {
  return taken.filter((taak) => !isInternalCleaningTask(taak));
}

export function withPlanMarker(taken: string[], planType: PlanType) {
  return [
    ...stripInternalCleaningTasks(taken),
    getPlanMarker(planType),
  ];
}

function planFromMarker(taken: string[] = []): PlanType | null {
  const marker = taken.find((taak) => taak.startsWith(PLAN_MARKER_PREFIX));
  const planType = marker?.slice(PLAN_MARKER_PREFIX.length);

  return planOptions.some((option) => option.value === planType)
    ? (planType as PlanType)
    : null;
}

function taakLabelsVoorPlan(planType: PlanType, winkel: string) {
  return new Set(
    flattenTasks(getTakenLijst(planType, winkel)).map((taak) => taak.label)
  );
}

function inferPlanTypeFromTasks(taken: string[] = [], winkel: string) {
  const zichtbareTaken = stripInternalCleaningTasks(taken);
  if (zichtbareTaken.length === 0) return null;

  const scores = planOptions.map((option) => {
    const labels = taakLabelsVoorPlan(option.value, winkel);
    const score = zichtbareTaken.filter((taak) => labels.has(taak)).length;

    return { planType: option.value, score };
  });

  const [beste, tweede] = scores.sort((a, b) => b.score - a.score);

  if (!beste || beste.score === 0 || beste.score === tweede?.score) {
    return null;
  }

  return beste.planType;
}

export function getCleaningItemPlanType(item: CleaningItem) {
  const markerPlanType = planFromMarker(item.taken);
  if (markerPlanType) return markerPlanType;

  if (item.titel === "Opstartplan" || item.titel === "Afsluitplan") {
    return item.titel;
  }

  if (!item.titel) {
    return "Opstartplan";
  }

  return inferPlanTypeFromTasks(item.taken, item.winkel);
}

export function itemMatchesCleaningSelection(
  item: CleaningItem,
  winkel: string,
  datum: string,
  planType: PlanType
) {
  return (
    item.winkel === winkel &&
    item.datum === datum &&
    getCleaningItemPlanType(item) === planType
  );
}

export function getCleaningItemKey(item: CleaningItem) {
  const planType = getCleaningItemPlanType(item) ?? "Onbekend";

  return `${item.datum}-${item.winkel}-${planType}`;
}
