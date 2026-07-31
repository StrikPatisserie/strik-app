import "server-only";

import type {
  LogisticsBatch,
  LogisticsDayFeedback,
  LogisticsReceiptOverride,
  LogisticsWebshopImage,
} from "@/app/bakkerij/logistiek/logisticsTypes";
import { createAdminClient } from "./supabase/admin";
import type { Json } from "./supabase/types";

const LOGISTICS_BATCHES_SETTING_KEY = "bakery_logistics_batches";
const LOGISTICS_WEBSHOP_IMAGES_SETTING_KEY = "bakery_logistics_webshop_images";
const LOGISTICS_RECEIPT_OVERRIDES_SETTING_KEY =
  "bakery_logistics_receipt_overrides";
const LOGISTICS_DAY_FEEDBACK_SETTING_KEY = "bakery_logistics_day_feedback";
const MAX_STORED_BATCHES = 80;
const MAX_STORED_WEBSHOP_IMAGES = 1200;
const MAX_STORED_WEBSHOP_IMAGES_JSON_BYTES = 5_500_000;
const MAX_STORED_RECEIPT_OVERRIDES = 3000;
const MAX_STORED_DAY_FEEDBACK = 1200;

type LogisticsState = {
  batches: LogisticsBatch[];
};

type LogisticsWebshopImagesState = {
  images: LogisticsWebshopImage[];
};

type LogisticsReceiptOverridesState = {
  overrides: LogisticsReceiptOverride[];
};

type LogisticsDayFeedbackState = {
  feedback: LogisticsDayFeedback[];
};

function emptyLogisticsState(): LogisticsState {
  return { batches: [] };
}

function emptyLogisticsWebshopImagesState(): LogisticsWebshopImagesState {
  return { images: [] };
}

function emptyLogisticsReceiptOverridesState(): LogisticsReceiptOverridesState {
  return { overrides: [] };
}

function emptyLogisticsDayFeedbackState(): LogisticsDayFeedbackState {
  return { feedback: [] };
}

function isLogisticsBatch(value: unknown): value is LogisticsBatch {
  return Boolean(
    value &&
      typeof value === "object" &&
      typeof (value as LogisticsBatch).id === "string" &&
      typeof (value as LogisticsBatch).date === "string" &&
      Array.isArray((value as LogisticsBatch).receipts)
  );
}

function isLogisticsWebshopImage(value: unknown): value is LogisticsWebshopImage {
  return Boolean(
    value &&
      typeof value === "object" &&
      typeof (value as LogisticsWebshopImage).id === "string" &&
      typeof (value as LogisticsWebshopImage).deliveryDate === "string" &&
      typeof (value as LogisticsWebshopImage).photoUrl === "string"
  );
}

function isLogisticsReceiptOverride(
  value: unknown
): value is LogisticsReceiptOverride {
  return Boolean(
    value &&
      typeof value === "object" &&
      typeof (value as LogisticsReceiptOverride).id === "string" &&
      typeof (value as LogisticsReceiptOverride).date === "string" &&
      typeof (value as LogisticsReceiptOverride).receiptId === "string"
  );
}

function isLogisticsDayFeedback(value: unknown): value is LogisticsDayFeedback {
  return Boolean(
    value &&
      typeof value === "object" &&
      typeof (value as LogisticsDayFeedback).id === "string" &&
      typeof (value as LogisticsDayFeedback).date === "string" &&
      typeof (value as LogisticsDayFeedback).text === "string" &&
      Array.isArray((value as LogisticsDayFeedback).signals)
  );
}

function normalizeLogisticsState(value: unknown): LogisticsState {
  if (!value || typeof value !== "object") return emptyLogisticsState();

  const batches = (value as { batches?: unknown }).batches;
  if (!Array.isArray(batches)) return emptyLogisticsState();

  return {
    batches: batches.filter(isLogisticsBatch),
  };
}

function normalizeLogisticsWebshopImagesState(
  value: unknown
): LogisticsWebshopImagesState {
  if (!value || typeof value !== "object") {
    return emptyLogisticsWebshopImagesState();
  }

  const images = (value as { images?: unknown }).images;
  if (!Array.isArray(images)) return emptyLogisticsWebshopImagesState();

  return {
    images: images.filter(isLogisticsWebshopImage),
  };
}

function normalizeLogisticsReceiptOverridesState(
  value: unknown
): LogisticsReceiptOverridesState {
  if (!value || typeof value !== "object") {
    return emptyLogisticsReceiptOverridesState();
  }

  const overrides = (value as { overrides?: unknown }).overrides;
  if (!Array.isArray(overrides)) return emptyLogisticsReceiptOverridesState();

  return {
    overrides: overrides.filter(isLogisticsReceiptOverride),
  };
}

function normalizeLogisticsDayFeedbackState(
  value: unknown
): LogisticsDayFeedbackState {
  if (!value || typeof value !== "object") {
    return emptyLogisticsDayFeedbackState();
  }

  const feedback = (value as { feedback?: unknown }).feedback;
  if (!Array.isArray(feedback)) return emptyLogisticsDayFeedbackState();

  return {
    feedback: feedback.filter(isLogisticsDayFeedback),
  };
}

function toJson(
  value:
    | LogisticsState
    | LogisticsWebshopImagesState
    | LogisticsReceiptOverridesState
    | LogisticsDayFeedbackState
): Json {
  return JSON.parse(JSON.stringify(value)) as Json;
}

function sortBatches(batches: LogisticsBatch[]) {
  return [...batches].sort((first, second) => {
    const dateCompare = second.date.localeCompare(first.date);
    if (dateCompare !== 0) return dateCompare;

    return second.importedAt.localeCompare(first.importedAt);
  });
}

function sortWebshopImages(images: LogisticsWebshopImage[]) {
  return [...images].sort((first, second) => {
    const dateCompare = second.deliveryDate.localeCompare(first.deliveryDate);
    if (dateCompare !== 0) return dateCompare;

    return second.importedAt.localeCompare(first.importedAt);
  });
}

function limitWebshopImages(images: LogisticsWebshopImage[]) {
  const limited = sortWebshopImages(images).slice(0, MAX_STORED_WEBSHOP_IMAGES);

  while (
    limited.length > 1 &&
    JSON.stringify({ images: limited }).length >
      MAX_STORED_WEBSHOP_IMAGES_JSON_BYTES
  ) {
    limited.pop();
  }

  return limited;
}

function mergeStoredWebshopImage(
  image: LogisticsWebshopImage,
  existing: LogisticsWebshopImage | undefined,
  options: { preserveManualMatch?: boolean }
): LogisticsWebshopImage {
  if (
    !existing ||
    !options.preserveManualMatch ||
    (!existing.matchedReceiptId && !existing.matchedReceiptNumber)
  ) {
    return image;
  }

  return {
    ...image,
    matchedReceiptId: existing.matchedReceiptId,
    matchedReceiptNumber: existing.matchedReceiptNumber,
    matchedReceiptCustomer: existing.matchedReceiptCustomer,
    matchedAt: existing.matchedAt,
    matchSource: existing.matchSource,
  };
}

function sortReceiptOverrides(overrides: LogisticsReceiptOverride[]) {
  return [...overrides].sort((first, second) => {
    const dateCompare = second.date.localeCompare(first.date);
    if (dateCompare !== 0) return dateCompare;

    return second.updatedAt.localeCompare(first.updatedAt);
  });
}

function sortDayFeedback(feedback: LogisticsDayFeedback[]) {
  return [...feedback].sort((first, second) => {
    const dateCompare = second.date.localeCompare(first.date);
    if (dateCompare !== 0) return dateCompare;

    return second.updatedAt.localeCompare(first.updatedAt);
  });
}

export async function readLogisticsState() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", LOGISTICS_BATCHES_SETTING_KEY)
    .maybeSingle();

  if (error || !data) return emptyLogisticsState();

  return normalizeLogisticsState(data.value);
}

export async function readLogisticsWebshopImagesState() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", LOGISTICS_WEBSHOP_IMAGES_SETTING_KEY)
    .maybeSingle();

  if (error || !data) return emptyLogisticsWebshopImagesState();

  return normalizeLogisticsWebshopImagesState(data.value);
}

export async function readLogisticsReceiptOverridesState() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", LOGISTICS_RECEIPT_OVERRIDES_SETTING_KEY)
    .maybeSingle();

  if (error || !data) return emptyLogisticsReceiptOverridesState();

  return normalizeLogisticsReceiptOverridesState(data.value);
}

export async function readLogisticsDayFeedbackState() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", LOGISTICS_DAY_FEEDBACK_SETTING_KEY)
    .maybeSingle();

  if (error || !data) return emptyLogisticsDayFeedbackState();

  return normalizeLogisticsDayFeedbackState(data.value);
}

export async function getLogisticsBatchForDate(date: string) {
  const state = await readLogisticsState();

  return (
    sortBatches(state.batches).find((batch) => batch.date === date) || null
  );
}

export async function getLogisticsWebshopImagesForDate(date: string) {
  const state = await readLogisticsWebshopImagesState();

  return sortWebshopImages(state.images).filter(
    (image) => image.deliveryDate === date
  );
}

export async function getLogisticsReceiptOverridesForDate(date: string) {
  const state = await readLogisticsReceiptOverridesState();

  return sortReceiptOverrides(state.overrides).filter(
    (override) => override.date === date
  );
}

export async function getLogisticsDayFeedbackForDate(date: string) {
  const state = await readLogisticsDayFeedbackState();

  return (
    sortDayFeedback(state.feedback).find((feedback) => feedback.date === date) ||
    null
  );
}

export async function upsertLogisticsBatch(batch: LogisticsBatch) {
  const state = await readLogisticsState();
  const batches = sortBatches([
    batch,
    ...state.batches.filter(
      (item) => !(item.date === batch.date && item.status === batch.status)
    ),
  ]).slice(0, MAX_STORED_BATCHES);

  const nextState = { batches };
  const supabase = createAdminClient();
  const { error } = await supabase.from("app_settings").upsert(
    {
      key: LOGISTICS_BATCHES_SETTING_KEY,
      value: toJson(nextState),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" }
  );

  if (error) throw new Error(error.message);

  return batch;
}

export async function upsertLogisticsWebshopImage(
  image: LogisticsWebshopImage,
  options: { preserveManualMatch?: boolean } = {}
) {
  const state = await readLogisticsWebshopImagesState();
  const existing =
    state.images.find((item) => item.id === image.id) ||
    state.images.find(
      (item) =>
        item.messageId === image.messageId &&
        item.photoUrl === image.photoUrl &&
        item.deliveryDate === image.deliveryDate
    ) ||
    state.images.find(
      (item) =>
        item.messageId === image.messageId &&
        item.deliveryDate === image.deliveryDate
    );
  const nextImage = mergeStoredWebshopImage(image, existing, options);
  const images = limitWebshopImages([
    nextImage,
    ...state.images.filter(
      (item) => item.id !== image.id && item.id !== existing?.id
    ),
  ]);

  const nextState = { images };
  const supabase = createAdminClient();
  const { error } = await supabase.from("app_settings").upsert(
    {
      key: LOGISTICS_WEBSHOP_IMAGES_SETTING_KEY,
      value: toJson(nextState),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" }
  );

  if (error) throw new Error(error.message);

  return nextImage;
}

export async function upsertLogisticsReceiptOverride(
  override: LogisticsReceiptOverride
) {
  const state = await readLogisticsReceiptOverridesState();
  const overrides = sortReceiptOverrides([
    override,
    ...state.overrides.filter((item) => item.id !== override.id),
  ]).slice(0, MAX_STORED_RECEIPT_OVERRIDES);

  const nextState = { overrides };
  const supabase = createAdminClient();
  const { error } = await supabase.from("app_settings").upsert(
    {
      key: LOGISTICS_RECEIPT_OVERRIDES_SETTING_KEY,
      value: toJson(nextState),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" }
  );

  if (error) throw new Error(error.message);

  return override;
}

export async function deleteLogisticsReceiptOverride(overrideId: string) {
  const state = await readLogisticsReceiptOverridesState();
  const overrides = state.overrides.filter((item) => item.id !== overrideId);

  const nextState = { overrides };
  const supabase = createAdminClient();
  const { error } = await supabase.from("app_settings").upsert(
    {
      key: LOGISTICS_RECEIPT_OVERRIDES_SETTING_KEY,
      value: toJson(nextState),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" }
  );

  if (error) throw new Error(error.message);
}

export async function upsertLogisticsDayFeedback(
  feedback: LogisticsDayFeedback
) {
  const state = await readLogisticsDayFeedbackState();
  const nextFeedback = sortDayFeedback([
    feedback,
    ...state.feedback.filter((item) => item.id !== feedback.id),
  ]).slice(0, MAX_STORED_DAY_FEEDBACK);

  const nextState = { feedback: nextFeedback };
  const supabase = createAdminClient();
  const { error } = await supabase.from("app_settings").upsert(
    {
      key: LOGISTICS_DAY_FEEDBACK_SETTING_KEY,
      value: toJson(nextState),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" }
  );

  if (error) throw new Error(error.message);

  return feedback;
}
