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
const WEBSHOP_IMAGE_RETENTION_DAYS = 14;
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

function dateStamp(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;

  return Date.UTC(year, month - 1, day);
}

function todayAmsterdamIsoDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Europe/Amsterdam",
    year: "numeric",
  }).formatToParts(new Date());
  const partByType = new Map(parts.map((part) => [part.type, part.value]));
  const year = partByType.get("year");
  const month = partByType.get("month");
  const day = partByType.get("day");

  return year && month && day ? `${year}-${month}-${day}` : "";
}

function isWebshopImageWithinRetention(image: LogisticsWebshopImage) {
  const todayStamp = dateStamp(todayAmsterdamIsoDate());
  const deliveryStamp = dateStamp(image.deliveryDate);

  if (todayStamp === null || deliveryStamp === null) return true;

  const cutoffStamp =
    todayStamp - WEBSHOP_IMAGE_RETENTION_DAYS * 24 * 60 * 60 * 1000;

  return deliveryStamp >= cutoffStamp;
}

function pruneExpiredWebshopImages(images: LogisticsWebshopImage[]) {
  return images.filter(isWebshopImageWithinRetention);
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
    images: pruneExpiredWebshopImages(images.filter(isLogisticsWebshopImage)),
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

function parseReceiptQuantity(quantity: string) {
  const clean = String(quantity || "")
    .replace(/[^\d,.-]/g, "")
    .replace(",", ".");
  const parsed = Number.parseFloat(clean);

  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizedReceiptText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function receiptMergeKey(receipt: LogisticsBatch["receipts"][number]) {
  const receiptNumber = receipt.receiptNumber || receipt.id;
  if (receiptNumber && /^\d{2,}$/.test(receiptNumber)) {
    return `bon:${receiptNumber}`;
  }

  return [
    "fallback",
    normalizedReceiptText(receipt.customer),
    normalizedReceiptText(receipt.address),
    normalizedReceiptText(receipt.deliveryAddress),
    String(receipt.value || ""),
  ].join(":");
}

function receiptQualityScore(receipt: LogisticsBatch["receipts"][number]) {
  return [
    receipt.receiptNumber ? 20 : 0,
    receipt.lines.length * 8,
    receipt.value ? 6 : 0,
    receipt.time && receipt.time !== "Geen tijd" ? 5 : 0,
    receipt.customer && receipt.customer !== "Onbekende klant" ? 4 : 0,
    receipt.address && receipt.address !== "Adres controleren" ? 4 : 0,
    receipt.customerNote && receipt.customerNote !== "Geen aparte opmerking."
      ? 3
      : 0,
    receipt.tags.length,
  ].reduce((total, value) => total + value, 0);
}

function mergeReceipt(
  existing: LogisticsBatch["receipts"][number],
  incoming: LogisticsBatch["receipts"][number]
) {
  const primary =
    receiptQualityScore(incoming) >= receiptQualityScore(existing)
      ? incoming
      : existing;
  const fallback = primary === incoming ? existing : incoming;

  return {
    ...fallback,
    ...primary,
    id: primary.id || fallback.id,
    receiptNumber: primary.receiptNumber || fallback.receiptNumber,
    time:
      primary.time && primary.time !== "Geen tijd"
        ? primary.time
        : fallback.time,
    customer:
      primary.customer && primary.customer !== "Onbekende klant"
        ? primary.customer
        : fallback.customer,
    address:
      primary.address && primary.address !== "Adres controleren"
        ? primary.address
        : fallback.address,
    deliveryAddress: primary.deliveryAddress || fallback.deliveryAddress,
    alternativeAddress: primary.alternativeAddress || fallback.alternativeAddress,
    pickupLocation: primary.pickupLocation || fallback.pickupLocation,
    value: primary.value ?? fallback.value,
    note: primary.note || fallback.note,
    customerNote:
      primary.customerNote && primary.customerNote !== "Geen aparte opmerking."
        ? primary.customerNote
        : fallback.customerNote,
    internalNote: primary.internalNote || fallback.internalNote,
    lines: primary.lines.length ? primary.lines : fallback.lines,
    tags: Array.from(new Set([...fallback.tags, ...primary.tags])),
  };
}

function mergeReceipts(
  existingReceipts: LogisticsBatch["receipts"],
  incomingReceipts: LogisticsBatch["receipts"]
) {
  const receiptByKey = new Map<string, LogisticsBatch["receipts"][number]>();
  const orderedKeys: string[] = [];

  for (const receipt of [...existingReceipts, ...incomingReceipts]) {
    const key = receiptMergeKey(receipt);
    const existing = receiptByKey.get(key);

    if (existing) {
      receiptByKey.set(key, mergeReceipt(existing, receipt));
    } else {
      orderedKeys.push(key);
      receiptByKey.set(key, receipt);
    }
  }

  return orderedKeys
    .map((key) => receiptByKey.get(key))
    .filter(Boolean) as LogisticsBatch["receipts"];
}

function isMergedFileLabel(value: string) {
  return /^\d+\s+bestanden:/.test(value) || value.includes(" + ");
}

function splitMergedFileLabel(value: string) {
  if (!value) return [];
  if (!isMergedFileLabel(value)) return [value];

  return value
    .replace(/^\d+\s+bestanden:\s*/i, "")
    .replace(/\s+\+\s+\.\.\.$/, "")
    .split(/\s+\+\s+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function mergeFileLabels(labels: string[]) {
  const uniqueLabels = Array.from(
    new Set(labels.flatMap(splitMergedFileLabel).filter(Boolean))
  );
  if (uniqueLabels.length <= 1) return uniqueLabels[0] || "";

  const joined = uniqueLabels.join(" + ");
  if (joined.length <= 240) return joined;

  return `${uniqueLabels.length} bestanden: ${uniqueLabels
    .slice(0, 2)
    .join(" + ")} + ...`;
}

function latestIso(...values: string[]) {
  return values.filter(Boolean).sort().at(-1) || "";
}

function isExternalValueReceipt(
  receipt: LogisticsBatch["receipts"][number]
) {
  return !receipt.tags.includes("intern") && !receipt.tags.includes("ijs");
}

function isIceTubLineDescription(description: string) {
  const text = normalizedReceiptText(description);

  if (/\bijstaart\b|\bijs\s+taart\b|\bijsgebak\b/.test(text)) return false;

  return (
    /\bijssalon\b/.test(text) ||
    /\bschepijs\b/.test(text) ||
    /\broomijs\b/.test(text) ||
    /\bijs\s*(?:bak|bakken|5\s*l|5l|liter|ltr|smaak|smaken)\b/.test(text)
  );
}

function calculateIceTubs(receipts: LogisticsBatch["receipts"]) {
  return receipts.reduce((total, receipt) => {
    const receiptIceTubs = receipt.lines.reduce((lineTotal, line) => {
      if (!isIceTubLineDescription(line.description)) return lineTotal;
      return lineTotal + parseReceiptQuantity(line.quantity);
    }, 0);

    return total + receiptIceTubs;
  }, 0);
}

function orderPressureFor(orderValue: number, receiptCount: number) {
  if (orderValue >= 3500 || receiptCount >= 35) return "hoog";
  if (orderValue >= 2000 || receiptCount >= 18) return "middel";
  return "laag";
}

function recalculateBatchTotals(batch: LogisticsBatch): LogisticsBatch {
  const orderValue = batch.receipts
    .filter(isExternalValueReceipt)
    .reduce((total, receipt) => total + (receipt.value || 0), 0);
  const iceTubs = calculateIceTubs(batch.receipts);
  const criticalWindows = batch.receipts.filter(
    (receipt) =>
      receipt.time !== "Geen tijd" ||
      receipt.tags.includes("zorg") ||
      receipt.tags.some((tag) => tag.startsWith("levering "))
  ).length;

  return {
    ...batch,
    orderCount: batch.receipts.length,
    orderValue,
    orderPressure: orderPressureFor(orderValue, batch.receipts.length),
    iceTubs,
    tempexBoxes: Math.ceil(iceTubs / 3),
    criticalWindows,
  };
}

export function mergeLogisticsBatches(
  existing: LogisticsBatch,
  incoming: LogisticsBatch
): LogisticsBatch {
  if (existing.id === incoming.id) {
    return recalculateBatchTotals(incoming);
  }

  const receipts = mergeReceipts(existing.receipts, incoming.receipts);
  const existingFileNames = splitMergedFileLabel(existing.fileName);
  const incomingFileNames = splitMergedFileLabel(incoming.fileName);
  const hasNewFile = incomingFileNames.some(
    (fileName) => fileName && !existingFileNames.includes(fileName)
  );
  const fileName = mergeFileLabels([existing.fileName, incoming.fileName]);
  const subject = mergeFileLabels([existing.subject, incoming.subject]);
  const warnings = Array.from(
    new Set([...existing.warnings, ...incoming.warnings].filter(Boolean))
  );

  return recalculateBatchTotals({
    ...incoming,
    id: `${incoming.date}-${incoming.status}-merged`,
    fileName,
    subject,
    from: incoming.from || existing.from,
    receivedAt: latestIso(existing.receivedAt, incoming.receivedAt),
    importedAt: latestIso(existing.importedAt, incoming.importedAt),
    importWaveId: incoming.importWaveId || existing.importWaveId,
    pageCount: hasNewFile
      ? existing.pageCount + incoming.pageCount
      : Math.max(existing.pageCount, incoming.pageCount),
    receipts,
    warnings,
  });
}

function mergeCompatibleBatches(
  existingBatches: LogisticsBatch[],
  incomingBatch: LogisticsBatch
) {
  return existingBatches.reduce(
    (mergedBatch, existingBatch) =>
      mergeLogisticsBatches(existingBatch, mergedBatch),
    incomingBatch
  );
}

function sortWebshopImages(images: LogisticsWebshopImage[]) {
  return [...images].sort((first, second) => {
    const dateCompare = second.deliveryDate.localeCompare(first.deliveryDate);
    if (dateCompare !== 0) return dateCompare;

    return second.importedAt.localeCompare(first.importedAt);
  });
}

function limitWebshopImages(images: LogisticsWebshopImage[]) {
  const limited = sortWebshopImages(pruneExpiredWebshopImages(images)).slice(
    0,
    MAX_STORED_WEBSHOP_IMAGES
  );

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

async function writeLogisticsWebshopImagesState(
  state: LogisticsWebshopImagesState
) {
  const supabase = createAdminClient();
  const { error } = await supabase.from("app_settings").upsert(
    {
      key: LOGISTICS_WEBSHOP_IMAGES_SETTING_KEY,
      value: toJson(state),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" }
  );

  if (error) throw new Error(error.message);
}

export async function readLogisticsWebshopImagesState() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", LOGISTICS_WEBSHOP_IMAGES_SETTING_KEY)
    .maybeSingle();

  if (error || !data) return emptyLogisticsWebshopImagesState();

  const rawImages =
    data.value &&
    typeof data.value === "object" &&
    Array.isArray((data.value as { images?: unknown }).images)
      ? (data.value as { images: unknown[] }).images
      : [];
  const validStoredImageCount = rawImages.filter(isLogisticsWebshopImage).length;
  const normalized = normalizeLogisticsWebshopImagesState(data.value);

  if (validStoredImageCount !== normalized.images.length) {
    try {
      await writeLogisticsWebshopImagesState(normalized);
    } catch {
      // Opruimen mag het dashboard niet blokkeren.
    }
  }

  return normalized;
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
  const compatibleBatches = state.batches.filter(
    (item) => item.date === batch.date && item.status === batch.status
  );
  const mergeCandidates = batch.importWaveId
    ? compatibleBatches.filter(
        (item) => item.importWaveId === batch.importWaveId
      )
    : compatibleBatches;
  const nextBatch = mergeCompatibleBatches(mergeCandidates, batch);
  const batches = sortBatches([
    nextBatch,
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

  return nextBatch;
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
  await writeLogisticsWebshopImagesState(nextState);

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
