import {
  PlanType,
  flattenTasks,
  getTakenLijst,
  getTaskLabelAliases,
  planOptions,
} from "./tasks";

export const CLEANING_API_URL =
  "/api/cleaning";
const WORDPRESS_CLEANING_API_URL =
  "https://strik-patisserie.nl/wp-json/strik/v1/cleaning";
const WORDPRESS_CLEANING_API_KEY = "schoonmaak-ijs-strik";

const PLAN_MARKER_PREFIX = "__strik_plan:";
const PHOTO_MARKER_PREFIX = "__strik_photo:";
const PHOTO_MARKER_V2_PREFIX = "__strik_photo_v2:";
const PHOTO_TEMPERATURE_PREFIX = "__strik_photo_temperature:";

export type CleaningTemperatureRegistration = {
  id?: string;
  naam: string;
  temperatuur: string;
};

export type CleaningPhotoUpload = {
  id?: string;
  label: string;
  fileName: string;
  dataUrl?: string;
  url?: string;
  mediaId?: number;
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

type CleaningApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; message: string; status?: number };

export function isInternalTemperatureRegistration(
  registratie: CleaningTemperatureRegistration
) {
  return registratie.naam.startsWith(PHOTO_TEMPERATURE_PREFIX);
}

export function stripInternalTemperatureRegistrations(
  registraties: CleaningTemperatureRegistration[] = []
) {
  return registraties.filter(
    (registratie) => !isInternalTemperatureRegistration(registratie)
  );
}

export function getCleaningUrl() {
  return CLEANING_API_URL;
}

function getWordPressCleaningUrl() {
  const url = new URL(WORDPRESS_CLEANING_API_URL);
  url.searchParams.set("key", WORDPRESS_CLEANING_API_KEY);

  return url.toString();
}

async function readJson(response: Response) {
  return (await response.json().catch(() => null)) as unknown;
}

function getApiMessage(data: unknown, fallback: string) {
  if (
    data &&
    typeof data === "object" &&
    "message" in data &&
    typeof data.message === "string" &&
    data.message.trim()
  ) {
    return data.message;
  }

  return fallback;
}

async function fetchCleaningItemsFrom(url: string) {
  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      Accept: "application/json",
    },
  });
  const data = await readJson(response);

  if (response.ok && Array.isArray(data)) {
    return { ok: true as const, data: data as CleaningItem[] };
  }

  return {
    ok: false as const,
    status: response.status,
    message: getApiMessage(data, "Eerdere antwoorden konden niet geladen worden."),
  };
}

export async function fetchCleaningItems(): Promise<
  CleaningApiResult<CleaningItem[]>
> {
  try {
    const appResult = await fetchCleaningItemsFrom(CLEANING_API_URL);
    if (appResult.ok) return appResult;
  } catch {
    // Probeer WordPress direct als de app-route in de browser hapert.
  }

  try {
    return await fetchCleaningItemsFrom(getWordPressCleaningUrl());
  } catch {
    return {
      ok: false,
      message: "Kan geen verbinding maken met WordPress schoonmaakopslag.",
    };
  }
}

async function saveCleaningItemTo(url: string, payload: unknown) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const data = await readJson(response);

  if (response.ok) {
    return { ok: true as const, data: data as CleaningItem };
  }

  return {
    ok: false as const,
    status: response.status,
    message: getApiMessage(
      data,
      "WordPress schoonmaakopslag is tijdelijk niet bereikbaar."
    ),
  };
}

export async function saveCleaningItem(
  payload: unknown
): Promise<CleaningApiResult<CleaningItem>> {
  try {
    const appResult = await saveCleaningItemTo(CLEANING_API_URL, payload);
    if (appResult.ok) return appResult;
  } catch {
    // Probeer WordPress direct als de app-route in de browser hapert.
  }

  try {
    return await saveCleaningItemTo(getWordPressCleaningUrl(), payload);
  } catch {
    return {
      ok: false,
      message: "Kan geen verbinding maken met WordPress schoonmaakopslag.",
    };
  }
}

export function getPlanMarker(planType: PlanType) {
  return `${PLAN_MARKER_PREFIX}${planType}`;
}

export function isInternalCleaningTask(taak: string) {
  return (
    taak.startsWith(PLAN_MARKER_PREFIX) ||
    taak.startsWith(PHOTO_MARKER_PREFIX) ||
    taak.startsWith(PHOTO_MARKER_V2_PREFIX)
  );
}

export function stripInternalCleaningTasks(taken: string[] = []) {
  return taken.filter((taak) => !isInternalCleaningTask(taak));
}

export function withCleaningMetaMarkers(
  taken: string[],
  planType: PlanType,
  fotoUploads: CleaningPhotoUpload[] = []
) {
  const fotoMarkers = fotoUploads
    .filter((upload) => upload.url || upload.dataUrl)
    .map((upload) =>
      `${PHOTO_MARKER_V2_PREFIX}${encodePhotoUploadForStorage(upload)}`
    );

  return [
    ...stripInternalCleaningTasks(taken),
    getPlanMarker(planType),
    ...fotoMarkers,
  ];
}

export function createPhotoTemperatureRegistrations(
  fotoUploads: CleaningPhotoUpload[] = []
): CleaningTemperatureRegistration[] {
  return fotoUploads
    .filter((upload) => upload.url || upload.dataUrl)
    .map((upload) => ({
      naam: `${PHOTO_TEMPERATURE_PREFIX}${upload.label}`,
      temperatuur: encodePhotoUploadForStorage(upload),
    }));
}

function photoUploadForStorage(upload: CleaningPhotoUpload) {
  return {
    label: upload.label,
    fileName: upload.fileName,
    url: upload.url,
    dataUrl: upload.url ? undefined : upload.dataUrl,
    mediaId: upload.mediaId,
  };
}

function encodeBase64Url(value: string) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";

  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function decodeBase64Url(value: string) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const paddedBase64 = base64.padEnd(
    Math.ceil(base64.length / 4) * 4,
    "="
  );
  const binary = atob(paddedBase64);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));

  return new TextDecoder().decode(bytes);
}

function encodePhotoUploadForStorage(upload: CleaningPhotoUpload) {
  return encodeBase64Url(JSON.stringify(photoUploadForStorage(upload)));
}

function decodePhotoUploadFromStorage(value: string) {
  const upload = JSON.parse(decodeBase64Url(value)) as CleaningPhotoUpload;

  if (!upload.label || !upload.fileName || (!upload.url && !upload.dataUrl)) {
    return null;
  }

  return upload;
}

function extractPhotoUploadsFromTemperatureRegistrations(
  registraties: CleaningTemperatureRegistration[] = []
) {
  return registraties.flatMap((registratie) => {
    if (!isInternalTemperatureRegistration(registratie)) return [];

    try {
      const upload = decodePhotoUploadFromStorage(registratie.temperatuur);
      return upload ? [upload] : [];
    } catch {
      return [];
    }
  });
}

export function extractPhotoUploadsFromTasks(taken: string[] = []) {
  return taken.flatMap((taak) => {
    if (taak.startsWith(PHOTO_MARKER_V2_PREFIX)) {
      try {
        const upload = decodePhotoUploadFromStorage(
          taak.slice(PHOTO_MARKER_V2_PREFIX.length)
        );
        return upload ? [upload] : [];
      } catch {
        return [];
      }
    }

    if (!taak.startsWith(PHOTO_MARKER_PREFIX)) return [];

    try {
      const upload = JSON.parse(
        decodeURIComponent(taak.slice(PHOTO_MARKER_PREFIX.length))
      ) as CleaningPhotoUpload;

      if (!upload.label || !upload.fileName || (!upload.url && !upload.dataUrl)) {
        return [];
      }

      return [upload];
    } catch {
      return [];
    }
  });
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
    flattenTasks(getTakenLijst(planType, winkel)).flatMap(getTaskLabelAliases)
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

export function getCleaningItemPhotos(item: CleaningItem) {
  const uploadsByLabel = new Map<string, CleaningPhotoUpload>();

  item.fotoUploads?.forEach((upload) => {
    if (upload.url || upload.dataUrl) {
      uploadsByLabel.set(upload.label, upload);
    }
  });

  extractPhotoUploadsFromTasks(item.taken).forEach((upload) => {
    uploadsByLabel.set(upload.label, upload);
  });

  extractPhotoUploadsFromTemperatureRegistrations(
    item.temperatuurRegistraties
  ).forEach((upload) => {
    uploadsByLabel.set(upload.label, upload);
  });

  return Array.from(uploadsByLabel.values());
}
