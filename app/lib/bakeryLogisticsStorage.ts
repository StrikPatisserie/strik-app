import "server-only";

import type {
  LogisticsBatch,
  LogisticsWebshopImage,
} from "@/app/bakkerij/logistiek/logisticsTypes";
import { createAdminClient } from "./supabase/admin";
import type { Json } from "./supabase/types";

const LOGISTICS_BATCHES_SETTING_KEY = "bakery_logistics_batches";
const LOGISTICS_WEBSHOP_IMAGES_SETTING_KEY = "bakery_logistics_webshop_images";
const MAX_STORED_BATCHES = 80;
const MAX_STORED_WEBSHOP_IMAGES = 1200;

type LogisticsState = {
  batches: LogisticsBatch[];
};

type LogisticsWebshopImagesState = {
  images: LogisticsWebshopImage[];
};

function emptyLogisticsState(): LogisticsState {
  return { batches: [] };
}

function emptyLogisticsWebshopImagesState(): LogisticsWebshopImagesState {
  return { images: [] };
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

function toJson(value: LogisticsState | LogisticsWebshopImagesState): Json {
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

export async function upsertLogisticsWebshopImage(image: LogisticsWebshopImage) {
  const state = await readLogisticsWebshopImagesState();
  const images = sortWebshopImages([
    image,
    ...state.images.filter((item) => item.id !== image.id),
  ]).slice(0, MAX_STORED_WEBSHOP_IMAGES);

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

  return image;
}
