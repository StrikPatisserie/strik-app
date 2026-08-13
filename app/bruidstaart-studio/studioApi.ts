import { WeddingCakeConfig } from "./types";

export const WEDDING_CAKE_API_URL =
  "https://strik-patisserie.nl/wp-json/strik/v1/wedding-cakes";
export const WEDDING_CAKE_API_KEY = "schoonmaak-ijs-strik";

const LOCAL_STORAGE_KEY = "strik-wedding-cake-drafts";
const CHOCOLATE_INITIALS_TOPPER_ID = "chocolade-initialen-geschreven";
const REMOVED_TOPPER_IDS = new Set(["chocolade-initialen-schildje"]);

export type WeddingCakeDraft = {
  id: string;
  code: string;
  surname: string;
  names: string;
  config: WeddingCakeConfig;
  createdAt: string;
  updatedAt: string;
};

export function getWeddingCakeStudioUrl(search?: string, deliveryDate?: string) {
  const url = new URL(WEDDING_CAKE_API_URL);
  url.searchParams.set("key", WEDDING_CAKE_API_KEY);

  if (search?.trim()) {
    url.searchParams.set("search", search.trim());
  }

  if (deliveryDate?.trim()) {
    url.searchParams.set("deliveryDate", deliveryDate.trim());
  }

  return url;
}

export function getWeddingCakeDeleteUrl(code: string) {
  const url = getWeddingCakeStudioUrl();
  url.searchParams.set("code", code.trim());

  return url;
}

export function getWeddingCakeYearOverviewUrl(year: string) {
  const url = getWeddingCakeStudioUrl();
  url.searchParams.set("year", year.trim());
  url.searchParams.set("limit", "all");

  return url;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function textFrom(value: unknown) {
  return typeof value === "string" ? value : "";
}

function numericRecordFrom(value: unknown) {
  if (!isRecord(value)) return {};

  return Object.fromEntries(
    Object.entries(value).flatMap(([key, entry]) => {
      const quantity = Number(entry);
      return Number.isFinite(quantity) ? [[key, quantity]] : [];
    })
  );
}

function decorationExtraNotesFrom(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item, index) => {
    if (!isRecord(item)) return [];

    const text = textFrom(item.text);
    if (!text.trim()) return [];

    return [
      {
        id: textFrom(item.id) || `note-${index + 1}`,
        text,
      },
    ];
  });
}

function decorationSurchargesFrom(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item, index) => {
    if (!isRecord(item)) return [];

    const description = textFrom(item.description);
    const amount = Number(item.amount);

    if (!description.trim() && (!Number.isFinite(amount) || amount <= 0)) {
      return [];
    }

    return [
      {
        id: textFrom(item.id) || `surcharge-${index + 1}`,
        description,
        amount: Number.isFinite(amount) ? Math.max(0, amount) : 0,
      },
    ];
  });
}

function topperIdsFrom(value: unknown) {
  return Array.isArray(value)
    ? value.filter(
        (id): id is string =>
          typeof id === "string" && id !== "geen" && !REMOVED_TOPPER_IDS.has(id)
      )
    : [];
}

function decorationIdsFrom(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value
    .filter((id): id is string => typeof id === "string")
    .map((id) => (id === "gipskruid" ? "gipskruid-strik" : id))
    .filter((id, index, ids) => ids.indexOf(id) === index);
}

function deliveryMethodFrom(
  value: unknown
): WeddingCakeConfig["contact"]["deliveryMethod"] {
  if (value === "delivery_far") return "delivery_far";
  if (value === "delivery") return "delivery";

  return "pickup";
}

function normalizedTopperInitialsText(value: unknown, topperIds: string[]) {
  if (!topperIds.includes(CHOCOLATE_INITIALS_TOPPER_ID)) return "";

  return textFrom(value)
    .toUpperCase()
    .replace(/[^A-Z\s]/g, "");
}

export function normalizeDraft(value: unknown): WeddingCakeDraft | null {
  if (!isRecord(value) || !isRecord(value.config)) return null;

  const code = textFrom(value.code || value.id).trim();
  if (!code) return null;

  const config = value.config as WeddingCakeConfig;
  const contact: Record<string, unknown> = isRecord(config.contact)
    ? config.contact
    : {};
  const now = new Date().toISOString();
  const topperIds = topperIdsFrom(config.topperIds);
  const decorationIds = decorationIdsFrom(config.decorationIds);

  return {
    id: textFrom(value.id) || code,
    code,
    surname: textFrom(value.surname || contact.surname),
    names: textFrom(value.names || contact.names),
    config: {
      ...config,
      layerFillingIds: isRecord(config.layerFillingIds)
        ? (config.layerFillingIds as Record<string, string>)
        : {},
      layerColorIds: isRecord(config.layerColorIds)
        ? (config.layerColorIds as Record<string, string>)
        : {},
      layerLayoutIds: isRecord(config.layerLayoutIds)
        ? (config.layerLayoutIds as Record<string, string>)
        : {},
      decorationQuantities: numericRecordFrom(config.decorationQuantities),
      decorationColorNotes: isRecord(config.decorationColorNotes)
        ? Object.fromEntries(
            Object.entries(config.decorationColorNotes).flatMap(
              ([key, value]) => {
                const text = textFrom(value);
                return text ? [[key, text]] : [];
              }
            )
          )
        : {},
      decorationNotes: textFrom(config.decorationNotes),
      decorationExtraNotes: decorationExtraNotesFrom(
        config.decorationExtraNotes
      ),
      decorationSurcharges: decorationSurchargesFrom(
        config.decorationSurcharges
      ),
      topperNotes: textFrom(config.topperNotes),
      topperSurcharges: decorationSurchargesFrom(config.topperSurcharges),
      topperInitialsText: normalizedTopperInitialsText(
        config.topperInitialsText,
        topperIds
      ),
      paid: Boolean(config.paid),
      completed: Boolean(config.completed),
      decorationIds,
      topperIds,
      contact: {
        ...config.contact,
        recognitionCode: textFrom(contact.recognitionCode) || code,
        surname: textFrom(contact.surname || value.surname),
        deliveryDate:
          textFrom(contact.deliveryDate) || textFrom(contact.weddingDate),
        deliveryMethod: deliveryMethodFrom(contact.deliveryMethod),
      },
    },
    createdAt: textFrom(value.createdAt) || now,
    updatedAt: textFrom(value.updatedAt) || now,
  };
}

export function normalizeDraftList(value: unknown): WeddingCakeDraft[] {
  const items = isRecord(value) && Array.isArray(value.drafts) ? value.drafts : [];

  return items.flatMap((item) => {
    const draft = normalizeDraft(item);
    return draft ? [draft] : [];
  });
}

export function hasWeddingCakeYearOverviewMeta(value: unknown, year: string) {
  return (
    isRecord(value) &&
    value.year === year &&
    typeof value.total === "number"
  );
}

export function loadLocalDrafts() {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];

    return Array.isArray(parsed)
      ? parsed.flatMap((item) => {
          const draft = normalizeDraft(item);
          return draft ? [draft] : [];
        })
      : [];
  } catch {
    return [];
  }
}

export function saveLocalDraft(draft: WeddingCakeDraft) {
  if (typeof window === "undefined") return;

  const drafts = loadLocalDrafts();
  const nextDrafts = [
    draft,
    ...drafts.filter(
      (item) => item.code.toLowerCase() !== draft.code.toLowerCase()
    ),
  ].slice(0, 100);

  window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(nextDrafts));
}

export function deleteLocalDraft(code: string) {
  if (typeof window === "undefined") return;

  const normalizedCode = code.trim().toLowerCase();
  const nextDrafts = loadLocalDrafts().filter(
    (item) => item.code.toLowerCase() !== normalizedCode
  );

  window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(nextDrafts));
}

export function searchLocalDrafts(search: string, deliveryDate = "") {
  const term = search.trim().toLowerCase();
  const dateTerm = deliveryDate.trim();
  if (!term && !dateTerm) return [];

  return loadLocalDrafts().filter((draft) => {
    const contact = draft.config.contact;
    const matchesTerm =
      !term ||
      draft.code.toLowerCase().includes(term) ||
      draft.surname.toLowerCase().includes(term) ||
      draft.names.toLowerCase().includes(term);
    const matchesDeliveryDate =
      !dateTerm ||
      contact.deliveryDate === dateTerm ||
      contact.weddingDate === dateTerm;

    return matchesTerm && matchesDeliveryDate;
  });
}

export function searchLocalDraftsByYear(year: string) {
  const yearTerm = year.trim();
  if (!yearTerm) return loadLocalDrafts();

  return loadLocalDrafts().filter((draft) => {
    const contact = draft.config.contact;
    const overviewDate = contact.deliveryDate || contact.weddingDate || "";

    return overviewDate.startsWith(yearTerm);
  });
}

export function createDraftFromConfig(config: WeddingCakeConfig) {
  const now = new Date().toISOString();
  const code = config.contact.recognitionCode.trim();
  const topperIds = topperIdsFrom(config.topperIds);

  return {
    id: code,
    code,
    surname: config.contact.surname.trim(),
    names: config.contact.names.trim(),
    config: {
      ...config,
      topperIds,
      topperInitialsText: normalizedTopperInitialsText(
        config.topperInitialsText,
        topperIds
      ),
    },
    createdAt: now,
    updatedAt: now,
  };
}
