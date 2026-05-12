import { WeddingCakeConfig } from "./types";

export const WEDDING_CAKE_API_URL =
  "https://strik-patisserie.nl/wp-json/strik/v1/wedding-cakes";
export const WEDDING_CAKE_API_KEY = "schoonmaak-ijs-strik";

const LOCAL_STORAGE_KEY = "strik-wedding-cake-drafts";

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function textFrom(value: unknown) {
  return typeof value === "string" ? value : "";
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
      topperIds: Array.isArray(config.topperIds)
        ? config.topperIds.filter((id): id is string => typeof id === "string")
        : ["geen"],
      contact: {
        ...config.contact,
        recognitionCode: textFrom(contact.recognitionCode) || code,
        surname: textFrom(contact.surname || value.surname),
        deliveryDate:
          textFrom(contact.deliveryDate) || textFrom(contact.weddingDate),
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

export function createDraftFromConfig(config: WeddingCakeConfig) {
  const now = new Date().toISOString();
  const code = config.contact.recognitionCode.trim();

  return {
    id: code,
    code,
    surname: config.contact.surname.trim(),
    names: config.contact.names.trim(),
    config,
    createdAt: now,
    updatedAt: now,
  };
}
