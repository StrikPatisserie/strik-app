"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { StrikPageHeader, StrikShell, strikIcons } from "../../StrikUI";
import type {
  LogisticsBatch,
  LogisticsBatchStatus,
  LogisticsDayFeedback,
  LogisticsFulfillment,
  LogisticsReceipt,
  LogisticsReceiptLine,
  LogisticsReceiptOverride,
  LogisticsWebshopImage,
} from "./logisticsTypes";

type DashboardTab = "routes" | "bonnen" | "leren";
type BatchStatus = LogisticsBatchStatus;
type BatchLoadState = "idle" | "loading" | "ready" | "error";
type OrdersFilter =
  | "all"
  | "delivery"
  | "pickup-heyendaalseweg"
  | "pickup-daalseweg"
  | "pickup-ziekerstraat"
  | "pickup-lent";

type FileSnapshot = {
  name: string;
  size: number;
  uploadedAt: string;
};

type DateState = {
  today: string;
  tomorrow: string;
  selectedDate: string;
  hour: number;
};

type DayPlan = {
  date: string;
  title: string;
  status: BatchStatus;
  sourceLabel: string;
  batchLabel: string;
  orderCount: number;
  orderValue: number;
  orderPressure: string;
  iceTubs: number;
  tempexBoxes: number;
  criticalWindows: number;
  criticalDetail: string;
  isFuture: boolean;
};

type DayStat = {
  label: string;
  value?: string;
  lines?: string[];
};

type BakeryProductionTotals = {
  assortedPastry: number;
  petitFours: number;
  marzipanAndCreamCakes: number;
};

type RouteRound = {
  id: string;
  title: string;
  vehicle: string;
  departure: string;
  badge: string;
  tone: string;
  stops: RouteStop[];
  reason: string;
  load: string;
};

type RouteStop = {
  id: string;
  label: string;
  detail: string;
  badges: string[];
};

type BusId = "A" | "B";

type DayLoadProfile = {
  pressure: string;
  deliveryReceipts: number;
  deliveryStops: number;
  largeReceipts: number;
  pastryUnits: number;
  criticalReceipts: number;
};

type ReceiptLine = LogisticsReceiptLine;
type ReceiptSummary = LogisticsReceipt;
type DayFeedbackSummary = LogisticsDayFeedback;
type ReceiptOverrideSummary = LogisticsReceiptOverride;
type WebshopImageSummary = LogisticsWebshopImage;

type MarzipanPrintShape = "square" | "round";

type PhotoProductPlan = {
  product: string;
  shape: MarzipanPrintShape;
  sizeCm: number;
  copies: number;
  needsCheck: boolean;
};

type MarzipanPrintItem = {
  id: string;
  photoUrl: string;
  customerName: string;
  customerLastName: string;
  product: string;
  receiptNumber: string;
  orderNumber: string;
  shape: MarzipanPrintShape;
  sizeCm: number;
  copyNumber: number;
  copyTotal: number;
  confidence: string;
  needsCheck: boolean;
};

type ReceiptOverrideDraft = {
  time: string;
  fulfillment: LogisticsFulfillment | "";
  deliveryAddress: string;
  alternativeAddress: string;
  pickupLocation: string;
  routeNote: string;
};

type ReceiptSeed = Omit<
  ReceiptSummary,
  "receiptNumber" | "deliveryAddress" | "customerNote" | "internalNote" | "lines"
> & {
  receiptNumber?: string;
  deliveryAddress?: string;
  alternativeAddress?: string;
  customerNote?: string;
  internalNote?: string;
};

const tabs: { id: DashboardTab; label: string }[] = [
  { id: "routes", label: "Routes" },
  { id: "bonnen", label: "Bonnen" },
  { id: "leren", label: "Leren" },
];

const ordersFilters: {
  id: OrdersFilter;
  label: string;
  location?: string;
  fulfillment?: LogisticsFulfillment;
}[] = [
  { id: "all", label: "ALL" },
  { id: "delivery", label: "BEZ", fulfillment: "bezorgen" },
  { id: "pickup-heyendaalseweg", label: "HEY", location: "Heyendaalseweg" },
  { id: "pickup-daalseweg", label: "DAAL", location: "Daalseweg" },
  { id: "pickup-ziekerstraat", label: "ZIEK", location: "Ziekerstraat" },
  { id: "pickup-lent", label: "LENT", location: "Lent" },
];

function toInputDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function createDateState(): DateState {
  const now = new Date();
  const today = toInputDate(now);

  return {
    today,
    tomorrow: toInputDate(addDays(now, 1)),
    selectedDate: today,
    hour: now.getHours(),
  };
}

function formatDateLabel(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return value;

  return new Intl.DateTimeFormat("nl-NL", {
    day: "2-digit",
    month: "2-digit",
  }).format(new Date(year, month - 1, day));
}

function formatCurrency(value: number) {
  return `EUR ${Math.round(value).toLocaleString("nl-NL")}`;
}

function formatCompactNumber(value: number) {
  return Math.round(value).toLocaleString("nl-NL");
}

function formatMoney(value: number) {
  return `EUR ${value.toLocaleString("nl-NL", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 3,
  })}`;
}

function formatBytes(bytes: number) {
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  if (bytes >= 1_000) return `${Math.round(bytes / 1_000)} KB`;
  return `${bytes} B`;
}

function formatDateTimeLabel(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;

  return new Intl.DateTimeFormat("nl-NL", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getUploadTime() {
  return new Intl.DateTimeFormat("nl-NL", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());
}

function tomorrowStatus(hour: number): BatchStatus {
  if (hour >= 22) return "definitief";
  return "prognose";
}

function receiptOverrideId(date: string, receipt: ReceiptSummary) {
  return `${date}:${receipt.receiptNumber || receipt.id}`;
}

function emptyReceiptOverrideDraft(): ReceiptOverrideDraft {
  return {
    time: "",
    fulfillment: "",
    deliveryAddress: "",
    alternativeAddress: "",
    pickupLocation: "",
    routeNote: "",
  };
}

function draftForReceiptOverride(
  override: ReceiptOverrideSummary | null | undefined
): ReceiptOverrideDraft {
  if (!override) return emptyReceiptOverrideDraft();

  return {
    time: override.time,
    fulfillment: override.fulfillment,
    deliveryAddress: override.deliveryAddress,
    alternativeAddress: override.alternativeAddress,
    pickupLocation: override.pickupLocation,
    routeNote: override.routeNote,
  };
}

function overrideHasValue(override: ReceiptOverrideDraft) {
  return Boolean(
    override.time ||
      override.fulfillment ||
      override.deliveryAddress ||
      override.alternativeAddress ||
      override.pickupLocation ||
      override.routeNote
  );
}

function applyReceiptOverrides(
  receipts: ReceiptSummary[],
  overrides: ReceiptOverrideSummary[],
  date: string
): ReceiptSummary[] {
  const byId = new Map(overrides.map((override) => [override.id, override]));

  return receipts.map((receipt) => {
    const override = byId.get(receiptOverrideId(date, receipt));
    if (!override) return receipt;

    const nextTags = receipt.tags.includes("aangepast")
      ? receipt.tags
      : [...receipt.tags, "aangepast"];
    const nextInternalNote = override.routeNote
      ? `Regie: ${override.routeNote}`
      : receipt.internalNote;

    return {
      ...receipt,
      time: override.time || receipt.time,
      fulfillment: override.fulfillment || receipt.fulfillment,
      deliveryAddress: override.deliveryAddress || receipt.deliveryAddress,
      alternativeAddress:
        override.alternativeAddress || receipt.alternativeAddress,
      pickupLocation: override.pickupLocation || receipt.pickupLocation,
      tags: nextTags,
      note: override.routeNote || receipt.note,
      customerNote: override.routeNote
        ? `${receipt.customerNote} Regie: ${override.routeNote}`.trim()
        : receipt.customerNote,
      internalNote: nextInternalNote,
    };
  });
}

function buildDayPlan(
  dateState: DateState,
  fileSnapshot: FileSnapshot | null,
  importedBatch: LogisticsBatch | null
): DayPlan {
  const { selectedDate, today, tomorrow, hour } = dateState;
  const isToday = selectedDate === today;
  const isTomorrow = selectedDate === tomorrow;
  const status = fileSnapshot
    ? "handmatig"
    : importedBatch
      ? importedBatch.status
      : isToday
        ? "definitief"
        : isTomorrow
          ? tomorrowStatus(hour)
          : "historie";

  const isFuture = selectedDate > today;
  const importedIceTubs = importedBatch
    ? calculateIceTubTotal(importedBatch.receipts)
    : null;
  const iceTubs = importedIceTubs !== null
    ? importedIceTubs
    : 0;
  const orderValue = importedBatch
    ? importedBatch.orderValue
    : 0;
  const orderPressure = importedBatch
    ? importedBatch.orderPressure
    : orderValue >= 3500
      ? "hoog"
      : orderValue >= 2000
        ? "middel"
        : "laag";

  return {
    date: selectedDate,
    title: isToday ? "Vandaag" : isTomorrow ? "Morgen" : formatDateLabel(selectedDate),
    status,
    sourceLabel: sourceLabelFor(status),
    batchLabel: batchLabelFor(status),
    orderCount: importedBatch ? importedBatch.orderCount : 0,
    orderValue,
    orderPressure,
    iceTubs,
    tempexBoxes: Math.ceil(iceTubs / 3),
    criticalWindows: importedBatch ? importedBatch.criticalWindows : 0,
    criticalDetail: importedBatch
      ? importedBatch.status === "prognose"
        ? "voorbereiden"
        : "uit batch"
      : isTomorrow
        ? "voorbereiden"
        : "voor 10:00",
    isFuture,
  };
}

function sourceLabelFor(status: BatchStatus) {
  if (status === "prognose") return "prognose ingelezen";
  if (status === "definitief") return "bonnen ingelezen";
  if (status === "handmatig") return "handmatig geladen";
  if (status === "historie") return "dagarchief";
  return "wacht op 10:00";
}

function batchLabelFor(status: BatchStatus) {
  if (status === "prognose") return "Orbak 10:00";
  if (status === "definitief") return "Orbak 22:00";
  if (status === "handmatig") return "Upload";
  if (status === "historie") return "Archief";
  return "Nog niet";
}

function buildStats(
  plan: DayPlan,
  loadProfile: DayLoadProfile,
  productionTotals: BakeryProductionTotals
): DayStat[] {
  return [
    {
      label: "Bonwaarde",
      value: formatCurrency(plan.orderValue),
    },
    { label: "Pakbonnen", value: String(plan.orderCount) },
    {
      label: "IJs/tempex",
      value: `${plan.iceTubs} / ${plan.tempexBoxes}`,
    },
    {
      label: "Banket",
      lines: [
        `Ges. gebak ${formatCompactNumber(productionTotals.assortedPastry)}`,
        `Petit fours ${formatCompactNumber(productionTotals.petitFours)}`,
        `M/slagroom ${formatCompactNumber(
          productionTotals.marzipanAndCreamCakes
        )}`,
      ],
    },
    {
      label: "Drukte",
      value: loadProfile.pressure,
    },
  ];
}

function statusToneFor(status: BatchStatus) {
  if (status === "prognose") {
    return "border-[#eadb8b] bg-[#fff8d8] text-[#6f5212]";
  }
  if (status === "definitief") {
    return "border-[#d6e5d8] bg-[#f6faf4] text-[#315641]";
  }
  if (status === "handmatig") {
    return "border-[#efc7b8] bg-[#fff3ed] text-[#8f3d27]";
  }

  return "border-[#e8e4de] bg-[#faf8f5] text-[#6b645b]";
}

function headerMetaLine(
  plan: DayPlan,
  importedBatch: LogisticsBatch | null,
  fallback: string
) {
  if (importedBatch) {
    const source = importedBatch.source === "gmail" ? "Gmail" : "upload";

    return `ingelezen op ${formatDateTimeLabel(importedBatch.importedAt)} · via ${source}`;
  }

  if (fallback) return fallback;
  return plan.sourceLabel;
}

function receiptFulfillment(receipt: ReceiptSummary): LogisticsFulfillment {
  if (receipt.fulfillment) return receipt.fulfillment;
  if (receipt.tags.includes("afhalen") || /wordt gehaald|afhalen/i.test(receipt.internalNote)) {
    return "afhalen";
  }
  if (receipt.tags.includes("bezorgen") || /bezorgen|bezorging/i.test(receipt.internalNote)) {
    return "bezorgen";
  }

  return "onbekend";
}

function pickupLocationFor(receipt: ReceiptSummary) {
  if (receipt.pickupLocation) return receipt.pickupLocation;

  const haystack = [
    receipt.deliveryAddress,
    receipt.alternativeAddress || "",
    receipt.customerNote,
    receipt.internalNote,
    receipt.tags.join(" "),
  ]
    .join(" ")
    .toLowerCase();

  if (haystack.includes("heyendaalseweg")) return "Heyendaalseweg";
  if (haystack.includes("daalseweg")) return "Daalseweg";
  if (haystack.includes("ziekerstraat")) return "Ziekerstraat";
  if (haystack.includes("lent")) return "Lent";

  return "";
}

function receiptMatchesFilter(receipt: ReceiptSummary, filter: OrdersFilter) {
  if (filter === "all") return true;

  const fulfillment = receiptFulfillment(receipt);
  if (filter === "delivery") return fulfillment === "bezorgen";

  const option = ordersFilters.find((item) => item.id === filter);
  return fulfillment === "afhalen" && pickupLocationFor(receipt) === option?.location;
}

function receiptFilterCount(receipts: ReceiptSummary[], filter: OrdersFilter) {
  return receipts.filter((receipt) => receiptMatchesFilter(receipt, filter)).length;
}

function receiptTargetLine(receipt: ReceiptSummary) {
  const fulfillment = receiptFulfillment(receipt);
  if (fulfillment === "afhalen") {
    return pickupLocationFor(receipt) || receipt.deliveryAddress || "Afhaalplek controleren";
  }

  return receipt.alternativeAddress || receipt.deliveryAddress || receipt.address;
}

function fulfillmentLabel(receipt: ReceiptSummary) {
  const fulfillment = receiptFulfillment(receipt);
  if (fulfillment === "afhalen") return "Afhalen";
  if (fulfillment === "bezorgen") return "Bezorgen";

  return "Check";
}

function normalizeMatchText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function significantWords(value: string) {
  return normalizeMatchText(value)
    .split(" ")
    .filter((word) => word.length >= 4 && !["strik", "patisserie"].includes(word));
}

function imageSignificantWords(image: WebshopImageSummary) {
  const genericWords = new Set([
    "afbeelding",
    "bestand",
    "bestelling",
    "foto",
    "image",
    "logo",
    "marsepein",
    "photo",
    "plaatje",
    "petit",
    "png",
    "slagroom",
    "taart",
    "webshop",
  ]);
  const words = [
    ...significantWords(image.customerName),
    ...significantWords(image.fileName.replace(/\.[^.]+$/, "")),
    ...significantWords(image.subject),
  ];

  return Array.from(new Set(words.filter((word) => !genericWords.has(word))));
}

function imageMatchesReceipt(
  image: WebshopImageSummary,
  receipt: ReceiptSummary
) {
  if (image.matchedReceiptId || image.matchedReceiptNumber) {
    return Boolean(
      (image.matchedReceiptId && image.matchedReceiptId === receipt.id) ||
        (image.matchedReceiptNumber &&
          image.matchedReceiptNumber === receipt.receiptNumber)
    );
  }

  const haystack = normalizeMatchText(
    [
      receipt.id,
      receipt.receiptNumber,
      receipt.customer,
      receipt.customerNote,
      receipt.internalNote,
      receipt.lines.map((line) => line.description).join(" "),
    ]
      .filter(Boolean)
      .join(" ")
  );

  if (image.orderNumber && haystack.includes(normalizeMatchText(image.orderNumber))) {
    return true;
  }

  const imageName = normalizeMatchText(image.customerName);
  const receiptName = normalizeMatchText(receipt.customer);
  if (imageName && receiptName && (imageName.includes(receiptName) || receiptName.includes(imageName))) {
    return true;
  }

  const imageWords = imageSignificantWords(image);
  if (imageWords.length === 0) return false;

  return imageWords.some((word) => haystack.includes(word));
}

function imageMatchesForReceipt(
  receipt: ReceiptSummary,
  webshopImages: WebshopImageSummary[]
) {
  return webshopImages.filter((image) => imageMatchesReceipt(image, receipt));
}

function imageHasReceiptMatch(
  image: WebshopImageSummary,
  receipts: ReceiptSummary[]
) {
  return receipts.some((receipt) => imageMatchesReceipt(image, receipt));
}

function receiptSearchText(receipt: ReceiptSummary) {
  return [
    receipt.customer,
    receipt.address,
    receipt.deliveryAddress,
    receipt.alternativeAddress || "",
    receipt.customerNote,
    receipt.internalNote,
    receipt.note,
    receipt.tags.join(" "),
    receipt.lines.map((line) => `${line.quantity} ${line.description}`).join(" "),
  ]
    .join(" ")
    .toLowerCase();
}

function numericQuantity(value: string) {
  const parsed = Number.parseFloat(value.replace(",", ".").replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizedLineDescription(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isAssortedPastryLine(line: ReceiptLine) {
  const description = normalizedLineDescription(line.description);

  return /\bgesorteerd\b.*\bgebak\b/.test(description);
}

function isPetitFourLine(line: ReceiptLine) {
  const description = normalizedLineDescription(line.description);

  return /\bpetit\s*-?\s*fours?\b/.test(description);
}

function lineSearchDescription(line: ReceiptLine) {
  return normalizedLineDescription(
    [line.description, line.note || ""].filter(Boolean).join(" ")
  );
}

function hasLargeCakeSize(text: string) {
  const rangeMatch = text.match(
    /\b(\d{1,2})\s*(?:-|\/|tot|a|t\/m)\s*(\d{1,2})\s*(?:p|pers\.?|personen|persoons)\b/
  );
  if (rangeMatch) {
    return Number(rangeMatch[1]) >= 10;
  }

  const sizeMatch = text.match(/\b(\d{1,2})\s*(?:p|pers\.?|personen|persoons)\b/);
  if (!sizeMatch) return false;

  return Number(sizeMatch[1]) >= 10;
}

function isMarzipanOrCreamCakeLine(line: ReceiptLine) {
  const description = lineSearchDescription(line);
  const isCake =
    (/\bmarsepein/.test(description) && /taart(?:en)?\b/.test(description)) ||
    (/\bslagroom/.test(description) && /taart(?:en)?\b/.test(description));

  return isCake && hasLargeCakeSize(description);
}

function escapeHtml(value: string) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttribute(value: string) {
  return escapeHtml(value).replace(/`/g, "&#96;");
}

function cleanProductLabel(value: string) {
  return value.replace(/\s+/g, " ").trim() || "Product controleren";
}

function customerLastNameFor(value: string) {
  const clean = value
    .replace(/\b(fam\.?|familie|dhr\.?|mevr\.?|mevrouw|meneer)\b/gi, "")
    .replace(/[|,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!clean) return "Klant";

  const parts = clean.split(" ").filter(Boolean);
  const last = parts.at(-1) || clean;
  const before = parts.at(-2)?.toLowerCase() || "";
  const beforeSecond = parts.at(-3)?.toLowerCase() || "";
  const particles = ["de", "den", "der", "van", "vd", "ter", "ten", "te"];

  if (
    parts.length >= 3 &&
    beforeSecond === "van" &&
    ["de", "den", "der"].includes(before)
  ) {
    return parts.slice(-3).join(" ");
  }
  if (particles.includes(before)) return parts.slice(-2).join(" ");

  return last;
}

function printCopiesForLine(line: ReceiptLine) {
  const quantity = numericQuantity(line.quantity);
  if (!Number.isFinite(quantity) || quantity <= 0) return 1;

  return Math.min(240, Math.max(1, Math.round(quantity)));
}

function isPhotoSignalLine(line: ReceiptLine) {
  return /foto|photo|afbeeld|print|logo|plaatje|opdruk/i.test(
    lineSearchDescription(line)
  );
}

function photoProductPlansForReceipt(
  receipt: ReceiptSummary,
  options: { requirePhotoSignal?: boolean } = {}
): PhotoProductPlan[] {
  const plans: PhotoProductPlan[] = [];

  receipt.lines.forEach((line) => {
    const description = lineSearchDescription(line);
    const hasPhotoSignal = isPhotoSignalLine(line);
    const product = cleanProductLabel(line.description);
    const copies = printCopiesForLine(line);

    if (
      (!options.requirePhotoSignal || hasPhotoSignal) &&
      (isPetitFourLine(line) ||
        (hasPhotoSignal && /\bpetit\s*-?\s*fours?\b/.test(description)))
    ) {
      plans.push({
        product,
        shape: "square",
        sizeCm: 4,
        copies,
        needsCheck: false,
      });
      return;
    }

    if (
      (!options.requirePhotoSignal || hasPhotoSignal) &&
      (isMarzipanOrCreamCakeLine(line) ||
        (hasPhotoSignal &&
          /taart|marsepein|slagroom/.test(description) &&
          hasLargeCakeSize(description)))
    ) {
      plans.push({
        product,
        shape: "round",
        sizeCm: 12,
        copies,
        needsCheck: false,
      });
    }
  });

  return plans;
}

function fallbackPhotoProductPlan(needsCheck = true): PhotoProductPlan {
  return {
    product: needsCheck ? "Foto controleren" : "Marsepeinfoto",
    shape: "round",
    sizeCm: 12,
    copies: 1,
    needsCheck,
  };
}

function distributedCopyCount(
  copies: number,
  imageIndex: number,
  imageCount: number
) {
  if (imageCount <= 1 || copies <= 1) return copies;

  const base = Math.floor(copies / imageCount);
  const remainder = copies % imageCount;

  return Math.max(1, base + (imageIndex < remainder ? 1 : 0));
}

function pushMarzipanPrintCopies(input: {
  items: MarzipanPrintItem[];
  image: WebshopImageSummary;
  plan: PhotoProductPlan;
  receipt?: ReceiptSummary;
  copyTotal: number;
  planIndex: number;
  needsCheck?: boolean;
}) {
  const customerName =
    input.image.customerName || input.receipt?.customer || "Klant controleren";
  const receiptNumber = input.receipt?.receiptNumber || input.receipt?.id || "";

  for (let copy = 1; copy <= input.copyTotal; copy += 1) {
    input.items.push({
      id: [
        receiptNumber || "zonder-bon",
        input.image.id,
        input.planIndex,
        copy,
      ].join("-"),
      photoUrl: input.image.photoUrl,
      customerName,
      customerLastName: customerLastNameFor(customerName),
      product: input.plan.product,
      receiptNumber,
      orderNumber: input.image.orderNumber,
      shape: input.plan.shape,
      sizeCm: input.plan.sizeCm,
      copyNumber: copy,
      copyTotal: input.copyTotal,
      confidence: input.image.confidence,
      needsCheck: input.needsCheck || input.plan.needsCheck,
    });
  }
}

function addMarzipanPrintItemsForReceipt(input: {
  items: MarzipanPrintItem[];
  receipt: ReceiptSummary;
  images: WebshopImageSummary[];
  inferredMatch?: boolean;
}) {
  const productPlans = photoProductPlansForReceipt(input.receipt);
  if (input.images.length === 1 && productPlans.length > 1) {
    productPlans.forEach((plan, planIndex) => {
      pushMarzipanPrintCopies({
        items: input.items,
        image: input.images[0],
        plan,
        receipt: input.receipt,
        copyTotal: plan.copies,
        planIndex,
        needsCheck: input.inferredMatch,
      });
    });
    return;
  }

  input.images.forEach((image, imageIndex) => {
    const plan =
      productPlans[Math.min(imageIndex, productPlans.length - 1)] ||
      fallbackPhotoProductPlan();
    const copyTotal =
      productPlans.length === 1
        ? distributedCopyCount(plan.copies, imageIndex, input.images.length)
        : plan.copies;

    pushMarzipanPrintCopies({
      items: input.items,
      image,
      plan,
      receipt: input.receipt,
      copyTotal,
      planIndex: imageIndex,
      needsCheck: input.inferredMatch,
    });
  });
}

function buildMarzipanPrintItems(
  receipts: ReceiptSummary[],
  webshopImages: WebshopImageSummary[]
) {
  const items: MarzipanPrintItem[] = [];
  const claimedImageIds = new Set<string>();
  const receiptIdsWithImages = new Set<string>();

  receipts.forEach((receipt) => {
    const matchedImages = imageMatchesForReceipt(receipt, webshopImages).filter(
      (image) => !claimedImageIds.has(image.id)
    );
    if (matchedImages.length === 0) return;

    addMarzipanPrintItemsForReceipt({
      items,
      receipt,
      images: matchedImages,
    });
    receiptIdsWithImages.add(receipt.id);
    matchedImages.forEach((image) => claimedImageIds.add(image.id));
  });

  const unclaimedImages = webshopImages.filter(
    (image) => !claimedImageIds.has(image.id)
  );
  const photoReceiptsWithoutImage = receipts.filter(
    (receipt) =>
      !receiptIdsWithImages.has(receipt.id) &&
      photoProductPlansForReceipt(receipt, { requirePhotoSignal: true }).length > 0
  );

  if (unclaimedImages.length > 0 && photoReceiptsWithoutImage.length === 1) {
    addMarzipanPrintItemsForReceipt({
      items,
      receipt: photoReceiptsWithoutImage[0],
      images: unclaimedImages,
      inferredMatch: true,
    });
    unclaimedImages.forEach((image) => claimedImageIds.add(image.id));
  } else if (
    unclaimedImages.length > 1 &&
    unclaimedImages.length === photoReceiptsWithoutImage.length
  ) {
    unclaimedImages.forEach((image, index) => {
      const receipt = photoReceiptsWithoutImage[index];
      if (!receipt) return;

      addMarzipanPrintItemsForReceipt({
        items,
        receipt,
        images: [image],
        inferredMatch: true,
      });
      claimedImageIds.add(image.id);
    });
  }

  webshopImages
    .filter((image) => !claimedImageIds.has(image.id))
    .forEach((image, imageIndex) => {
      pushMarzipanPrintCopies({
        items,
        image,
        plan: fallbackPhotoProductPlan(),
        copyTotal: 1,
        planIndex: imageIndex,
      });
    });

  return items;
}

function marzipanPrintSizeLabel(item: MarzipanPrintItem) {
  return item.shape === "square" ? "4 cm vierkant" : "12 cm rond";
}

function createMarzipanPhotoPrintHtml(input: {
  items: MarzipanPrintItem[];
  plan: DayPlan;
}) {
  const title = `Marsepeinfoto's ${formatDateLabel(input.plan.date)}`;
  const itemHtml = input.items
    .map((item) => {
      const copyLabel =
        item.copyTotal > 1 ? ` · ${item.copyNumber}/${item.copyTotal}` : "";
      const sourceLabel = [
        item.receiptNumber ? `bon ${item.receiptNumber}` : "",
        item.orderNumber ? `order ${item.orderNumber}` : "",
        item.needsCheck ? "check" : "",
      ]
        .filter(Boolean)
        .join(" · ");

      return `
        <article class="print-item ${item.shape} ${item.needsCheck ? "needs-check" : ""}" style="--item-size:${item.sizeCm}cm">
          <div class="photo-frame">
            <img src="${escapeAttribute(item.photoUrl)}" alt="${escapeAttribute(item.customerName)}">
          </div>
          <div class="label">
            <strong>${escapeHtml(item.customerLastName)}</strong>
            <span>${escapeHtml(item.product)}</span>
            <small>${escapeHtml(marzipanPrintSizeLabel(item))}${escapeHtml(copyLabel)}</small>
            ${sourceLabel ? `<small>${escapeHtml(sourceLabel)}</small>` : ""}
          </div>
        </article>
      `;
    })
    .join("");

  return `<!doctype html>
<html lang="nl">
  <head>
    <meta charset="utf-8">
    <title>${escapeHtml(title)}</title>
    <style>
      @page { margin: 8mm 8mm 60mm 8mm; size: A4 portrait; }
      * { box-sizing: border-box; }
      body {
        background: #fff;
        color: #000;
        font-family: Arial, Helvetica, sans-serif;
        margin: 0;
      }
      .screen-actions {
        align-items: center;
        border-bottom: 1px solid #ddd;
        display: flex;
        gap: 8px;
        justify-content: space-between;
        padding: 10px 12px;
      }
      .screen-actions h1 {
        font-size: 15px;
        margin: 0;
      }
      .screen-actions button {
        background: #111;
        border: 0;
        color: #fff;
        cursor: pointer;
        font-size: 12px;
        font-weight: 800;
        padding: 8px 12px;
      }
      .sheet-header {
        align-items: baseline;
        border-bottom: 1px solid #111;
        display: flex;
        justify-content: space-between;
        margin-bottom: 5mm;
        padding-bottom: 2mm;
      }
      .sheet-header h1 {
        font-size: 13px;
        margin: 0;
      }
      .sheet-header p {
        font-size: 9px;
        font-weight: 700;
        margin: 0;
      }
      .sheet {
        align-items: flex-start;
        display: flex;
        flex-wrap: wrap;
        gap: 5mm;
      }
      .print-item {
        break-inside: avoid;
        page-break-inside: avoid;
        width: var(--item-size);
      }
      .photo-frame {
        background: #fff;
        border: 0.25mm dashed #888;
        height: var(--item-size);
        overflow: hidden;
        width: var(--item-size);
      }
      .round .photo-frame {
        border-radius: 999px;
      }
      .photo-frame img {
        display: block;
        height: 100%;
        object-fit: cover;
        width: 100%;
      }
      .label {
        font-size: 7.5px;
        line-height: 1.18;
        margin-top: 1.5mm;
        overflow-wrap: anywhere;
      }
      .label strong,
      .label span,
      .label small {
        display: block;
      }
      .label strong {
        font-size: 8.5px;
      }
      .label span {
        margin-top: 0.6mm;
      }
      .label small {
        color: #444;
        margin-top: 0.4mm;
      }
      .needs-check .photo-frame {
        border-color: #111;
        border-style: solid;
      }
      @media print {
        .screen-actions { display: none; }
      }
    </style>
  </head>
  <body>
    <div class="screen-actions">
      <h1>${escapeHtml(title)} · ${input.items.length} printstukken</h1>
      <button type="button" onclick="window.print()">Print</button>
    </div>
    <main>
      <div class="sheet-header">
        <h1>${escapeHtml(title)}</h1>
        <p>${input.items.length} printstukken · petit four 4 cm vierkant · taart 12 cm rond</p>
      </div>
      <section class="sheet">
        ${itemHtml}
      </section>
    </main>
    <script>
      const images = Array.from(document.images);
      Promise.all(images.map((image) => (
        image.complete
          ? Promise.resolve()
          : new Promise((resolve) => {
              image.onload = resolve;
              image.onerror = resolve;
            })
      ))).then(() => window.setTimeout(() => window.print(), 250));
    </script>
  </body>
</html>`;
}

function printMarzipanPhotoSheet(plan: DayPlan, items: MarzipanPrintItem[]) {
  if (items.length === 0) {
    window.alert("Geen webshopfoto's gevonden voor deze dag.");
    return;
  }

  const printWindow = window.open("", "_blank", "width=1100,height=800");
  if (!printWindow) {
    window.alert("Printvenster kon niet geopend worden.");
    return;
  }

  printWindow.document.write(createMarzipanPhotoPrintHtml({ items, plan }));
  printWindow.document.close();
  printWindow.focus();
}

function buildBakeryProductionTotals(
  receipts: ReceiptSummary[]
): BakeryProductionTotals {
  return receipts.reduce(
    (totals, receipt) => {
      receipt.lines.forEach((line) => {
        const quantity = numericQuantity(line.quantity);

        if (isAssortedPastryLine(line)) {
          totals.assortedPastry += quantity;
        }
        if (isPetitFourLine(line)) {
          totals.petitFours += quantity;
        }
        if (isMarzipanOrCreamCakeLine(line)) {
          totals.marzipanAndCreamCakes += quantity;
        }
      });

      return totals;
    },
    {
      assortedPastry: 0,
      petitFours: 0,
      marzipanAndCreamCakes: 0,
    }
  );
}

function isIceTubLineDescription(description: string) {
  const text = normalizedLineDescription(description);

  if (/\bijstaart\b|\bijs\s+taart\b|\bijsgebak\b/.test(text)) return false;

  return (
    /\bijssalon\b/.test(text) ||
    /\bschepijs\b/.test(text) ||
    /\broomijs\b/.test(text) ||
    /\bijs\s*(?:bak|bakken|5\s*l|5l|liter|ltr|smaak|smaken)\b/.test(text)
  );
}

function calculateIceTubTotal(receipts: ReceiptSummary[]) {
  return receipts.reduce(
    (total, receipt) => total + iceTubCountForReceipt(receipt),
    0
  );
}

function isInternalReceiptSummary(receipt: ReceiptSummary) {
  return receipt.tags.includes("intern") || receipt.tags.includes("winkel");
}

function isIceReceiptSummary(receipt: ReceiptSummary) {
  if (iceTubCountForReceipt(receipt) > 0) return true;

  const text = receiptSearchText(receipt);
  return (
    receipt.tags.includes("ijs") &&
    /\bijssalon\b|\bijsbon\b|\bijs\s*bestelling\b|\bijs\s+5\s*l\b/i.test(text)
  );
}

function isShopReceipt(receipt: ReceiptSummary) {
  return receipt.tags.includes("winkel") || /^winkel\b/i.test(receipt.customer);
}

function shopKeyForText(value: string) {
  const text = value.toLowerCase();
  if (text.includes("heyendaalseweg") || text.includes("heyendaal")) {
    return "heyendaalseweg";
  }
  if (text.includes("daalseweg")) return "daalseweg";
  if (text.includes("ziekerstraat")) return "ziekerstraat";
  if (text.includes("lent")) return "lent";

  return "";
}

function shopKeyForReceipt(receipt: ReceiptSummary) {
  return shopKeyForText(
    [
      receipt.customer,
      receipt.address,
      receipt.deliveryAddress,
      receipt.alternativeAddress || "",
      receipt.pickupLocation || "",
      receipt.customerNote,
      receipt.internalNote,
    ].join(" ")
  );
}

function shopLabelForKey(key: string) {
  if (key === "heyendaalseweg") return "Winkel Heyendaalseweg";
  if (key === "daalseweg") return "Winkel Daalseweg";
  if (key === "ziekerstraat") return "Winkel Ziekerstraat";
  if (key === "lent") return "Winkel Lent";

  return "Winkel";
}

function routeDeadlineMinutes(receipt: ReceiptSummary) {
  const matches = [...receipt.time.matchAll(/\b(\d{1,2}):(\d{2})\b/g)];
  const deadline = matches.at(-1);
  if (!deadline) return 9999;

  return Number(deadline[1]) * 60 + Number(deadline[2]);
}

function routeTimeLabel(receipt: ReceiptSummary) {
  const matches = [...receipt.time.matchAll(/\b(\d{1,2}):(\d{2})\b/g)];
  if (matches.length >= 2) {
    const deadline = matches.at(-1);

    return deadline ? `voor ${deadline[1].padStart(2, "0")}:${deadline[2]}` : receipt.time;
  }

  return receipt.time === "Geen tijd" ? "tijd check" : receipt.time;
}

function hasExplicitEarlyInstruction(receipt: ReceiptSummary) {
  return /extra vroeg|voor winkelopening|voor opening|v[oó]or 8|v[oó]or 08|07:\d{2}/i.test(
    receiptSearchText(receipt)
  );
}

function isRouteDelivery(receipt: ReceiptSummary) {
  if (isInternalReceiptSummary(receipt) || isIceReceiptSummary(receipt)) return false;
  return receiptFulfillment(receipt) !== "afhalen";
}

function isEarlyException(receipt: ReceiptSummary) {
  return isRouteDelivery(receipt) && hasExplicitEarlyInstruction(receipt);
}

function receiptPastryUnits(receipt: ReceiptSummary) {
  return receipt.lines.reduce((total, line) => {
    if (!/gebak|petit|taart|vlaai|tompouce|soes|cake/i.test(line.description)) {
      return total;
    }

    return total + numericQuantity(line.quantity);
  }, 0);
}

function isLargeReceipt(receipt: ReceiptSummary) {
  return (
    receipt.tags.includes("groot") ||
    receiptPastryUnits(receipt) >= 30 ||
    receipt.lines.some((line) => numericQuantity(line.quantity) >= 30)
  );
}

function isCriticalReceipt(receipt: ReceiptSummary) {
  return (
    routeDeadlineMinutes(receipt) < 600 ||
    receipt.tags.includes("zorg") ||
    receipt.tags.some((tag) => tag.startsWith("levering ")) ||
    hasExplicitEarlyInstruction(receipt)
  );
}

function receiptStopBadges(receipt: ReceiptSummary) {
  const badges: string[] = [];
  const fulfillment = receiptFulfillment(receipt);
  const iceTubs = iceTubCountForReceipt(receipt);

  if (fulfillment === "afhalen") badges.push("afhaal");
  if (isIceReceiptSummary(receipt)) badges.push("ijs");
  if (iceTubs > 0) badges.push(`${iceTubs} ijs`);
  if (isLargeReceipt(receipt)) badges.push("groot");
  if (isCriticalReceipt(receipt)) badges.push("tijd");
  if (receipt.tags.includes("zorg")) badges.push("zorg");
  if (receipt.value) badges.push(formatCurrency(receipt.value));

  return badges.slice(0, 3);
}

function routeStopForReceipt(receipt: ReceiptSummary, prefix = ""): RouteStop {
  const target = receiptTargetLine(receipt);
  const time = routeTimeLabel(receipt);

  return {
    id: `${prefix}${receipt.id}`,
    label: receipt.customer,
    detail: `${time} · ${target}`,
    badges: receiptStopBadges(receipt),
  };
}

function groupShopStops(
  receipts: ReceiptSummary[],
  shopKeys: string[],
  pairedIceReceipts: ReceiptSummary[]
): RouteStop[] {
  return shopKeys
    .map((shopKey) => {
      const shopReceipts = receipts.filter(
        (receipt) =>
          isShopReceipt(receipt) &&
          !isIceReceiptSummary(receipt) &&
          shopKeyForReceipt(receipt) === shopKey
      );
      const pickupReceipts = receipts.filter(
        (receipt) =>
          receiptFulfillment(receipt) === "afhalen" &&
          shopKeyForReceipt(receipt) === shopKey
      );
      const iceReceipts = pairedIceReceipts.filter(
        (receipt) => shopKeyForReceipt(receipt) === shopKey
      );
      const iceTubs = iceReceipts.reduce(
        (total, receipt) => total + iceTubCountForReceipt(receipt),
        0
      );

      if (!shopReceipts.length && !pickupReceipts.length && !iceTubs) return null;

      const detailParts = [];
      if (shopReceipts.length) detailParts.push(`${shopReceipts.length} winkelbon`);
      if (pickupReceipts.length) detailParts.push(`${pickupReceipts.length} afhaal`);
      if (iceTubs) detailParts.push(`${iceTubs} ijs / ${Math.ceil(iceTubs / 3)} tempex`);

      return {
        id: `shop-${shopKey}`,
        label: shopLabelForKey(shopKey),
        detail: detailParts.join(" · "),
        badges: ["winkel"],
      };
    })
    .filter((stop): stop is RouteStop => Boolean(stop));
}

function busForShopKey(key: string): BusId | "" {
  if (key === "heyendaalseweg" || key === "daalseweg") return "A";
  if (key === "ziekerstraat" || key === "lent") return "B";

  return "";
}

function preferredBusForReceipt(receipt: ReceiptSummary): BusId | "" {
  const shopBus = busForShopKey(shopKeyForReceipt(receipt));
  if (shopBus) return shopBus;

  const text = receiptSearchText(receipt);
  if (
    /radboud|heyendaal|han\b|kapittelweg|geert groote|maartenskliniek|brakkenstein|berg en dal|beek|ubbergen|groesbeek|malden|molenhoek|oost/.test(
      text
    )
  ) {
    return "A";
  }
  if (
    /ziekerstraat|centrum|lent|waalkade|jonkerbos|sanadome|cwz|goffert|crematorium|thermen|berendonck|wijchen|beuningen|oosterhout|bemmel|elst|arnhem|noord/.test(
      text
    )
  ) {
    return "B";
  }

  return "";
}

function outsideClusterKeyForReceipt(receipt: ReceiptSummary) {
  const text = receiptSearchText(receipt);

  if (/jonkerbos|sanadome|cwz|goffert|crematorium/.test(text)) {
    return "jonkerbos";
  }
  if (/thermen|berendonck|wijchen|beuningen/.test(text)) {
    return "west-buiten";
  }
  if (/berg en dal|beek|ubbergen|groesbeek|malden|molenhoek/.test(text)) {
    return "oost-buiten";
  }
  if (/bemmel|elst|arnhem|oosterhout/.test(text)) {
    return "noord-buiten";
  }

  return "";
}

function isOutsideRouteReceipt(receipt: ReceiptSummary) {
  return outsideClusterKeyForReceipt(receipt) !== "";
}

function iceTubCountForReceipt(receipt: ReceiptSummary) {
  return receipt.lines.reduce((total, line) => {
    if (!isIceTubLineDescription(line.description)) return total;

    return total + numericQuantity(line.quantity);
  }, 0);
}

function receiptLoadScore(receipt: ReceiptSummary) {
  return (
    1 +
    Number(isCriticalReceipt(receipt)) * 0.8 +
    Number(isLargeReceipt(receipt)) * 2.4 +
    Number(isOutsideRouteReceipt(receipt)) * 1.4 +
    Math.min(4, receiptPastryUnits(receipt) / 45) +
    Math.min(4, iceTubCountForReceipt(receipt) / 3)
  );
}

function fitsNaturalFirstLoop(receipt: ReceiptSummary, bus: PlannedBus) {
  const shopKey = shopKeyForReceipt(receipt);
  if (shopKey && bus.shopKeys.includes(shopKey)) return true;

  const text = receiptSearchText(receipt);
  const clusterKey = outsideClusterKeyForReceipt(receipt);

  if (bus.id === "A") {
    return (
      clusterKey === "oost-buiten" ||
      /radboud|heyendaal|han\b|kapittelweg|geert groote|maartenskliniek|brakkenstein|berg en dal|beek|ubbergen|groesbeek|malden|molenhoek|oost/.test(
        text
      )
    );
  }

  return (
    clusterKey === "jonkerbos" ||
    clusterKey === "west-buiten" ||
    clusterKey === "noord-buiten" ||
    /ziekerstraat|centrum|lent|waalkade|jonkerbos|sanadome|cwz|goffert|crematorium|thermen|berendonck|wijchen|beuningen|oosterhout|bemmel|elst|arnhem|noord/.test(
      text
    )
  );
}

function sortDeliveryReceipts(receipts: ReceiptSummary[]) {
  return [...receipts].sort((first, second) => {
    const earlyCompare =
      Number(isEarlyException(second)) - Number(isEarlyException(first));
    if (earlyCompare !== 0) return earlyCompare;

    const timeCompare =
      routeDeadlineMinutes(first) - routeDeadlineMinutes(second);
    if (timeCompare !== 0) return timeCompare;

    const largeCompare = Number(isLargeReceipt(second)) - Number(isLargeReceipt(first));
    if (largeCompare !== 0) return largeCompare;

    return receiptTargetLine(first).localeCompare(receiptTargetLine(second));
  });
}

function buildDayLoadProfile(plan: DayPlan, receipts: ReceiptSummary[]): DayLoadProfile {
  const deliveryReceipts = receipts.filter(isRouteDelivery);
  const deliveryStops = new Set(
    deliveryReceipts.map((receipt) => normalizeMatchText(receiptTargetLine(receipt)))
  ).size;
  const largeReceipts = receipts.filter(isLargeReceipt).length;
  const pastryUnits = receipts.reduce(
    (total, receipt) => total + receiptPastryUnits(receipt),
    0
  );
  const criticalReceipts = receipts.filter(isCriticalReceipt).length;
  const score =
    deliveryReceipts.length * 1.2 +
    deliveryStops * 0.9 +
    largeReceipts * 4 +
    criticalReceipts * 1.4 +
    Math.floor(pastryUnits / 45) +
    Math.floor(plan.iceTubs / 9) +
    Math.floor(plan.orderValue / 900);
  const pressure = score >= 32 ? "hoog" : score >= 17 ? "middel" : "laag";

  return {
    pressure,
    deliveryReceipts: deliveryReceipts.length,
    deliveryStops,
    largeReceipts,
    pastryUnits,
    criticalReceipts,
  };
}

function routeBadgeFor(stopCount: number, loadProfile: DayLoadProfile) {
  if (stopCount === 0) return "geen stops";
  if (loadProfile.pressure === "hoog") return `${stopCount} stops · strak`;

  return `${stopCount} stops`;
}

function buildRouteRound(input: {
  id: string;
  title: string;
  vehicle: string;
  departure: string;
  tone: string;
  stops: RouteStop[];
  reason: string;
  load: string;
  loadProfile: DayLoadProfile;
}): RouteRound {
  return {
    id: input.id,
    title: input.title,
    vehicle: input.vehicle,
    departure: input.departure,
    badge: routeBadgeFor(input.stops.length, input.loadProfile),
    tone: input.tone,
    stops: input.stops,
    reason: input.reason,
    load: input.load,
  };
}

type PlannedBus = {
  id: BusId;
  title: string;
  tone: string;
  shopKeys: string[];
  early: ReceiptSummary[];
  first: ReceiptSummary[];
  firstIce: ReceiptSummary[];
  second: ReceiptSummary[];
  ice: ReceiptSummary[];
  firstScore: number;
  secondScore: number;
};

function createPlannedBus(input: {
  id: BusId;
  title: string;
  tone: string;
  shopKeys: string[];
}): PlannedBus {
  return {
    ...input,
    early: [],
    first: [],
    firstIce: [],
    second: [],
    ice: [],
    firstScore: 0,
    secondScore: 0,
  };
}

function chooseLightestBus(
  buses: Record<BusId, PlannedBus>,
  round: "first" | "second"
): BusId {
  const scoreKey = round === "first" ? "firstScore" : "secondScore";

  return buses.A[scoreKey] <= buses.B[scoreKey] ? "A" : "B";
}

function chooseBusForReceipt(input: {
  buses: Record<BusId, PlannedBus>;
  clusterAssignments: Map<string, BusId>;
  receipt: ReceiptSummary;
  round: "first" | "second";
}) {
  const preferredBus = preferredBusForReceipt(input.receipt);
  if (preferredBus) return preferredBus;

  const clusterKey = outsideClusterKeyForReceipt(input.receipt);
  const assignedClusterBus = clusterKey
    ? input.clusterAssignments.get(clusterKey)
    : null;
  if (assignedClusterBus) return assignedClusterBus;

  const bus = chooseLightestBus(input.buses, input.round);
  if (clusterKey) input.clusterAssignments.set(clusterKey, bus);

  return bus;
}

function shouldUseSecondRound(
  receipt: ReceiptSummary,
  bus: PlannedBus,
  loadProfile: DayLoadProfile
) {
  if (isEarlyException(receipt)) return false;

  const minutes = routeDeadlineMinutes(receipt);
  if (minutes < 600) return false;

  const maxFirstStops =
    loadProfile.pressure === "hoog" ? 9 : loadProfile.pressure === "middel" ? 11 : 13;
  const maxFirstScore =
    loadProfile.pressure === "hoog" ? 22 : loadProfile.pressure === "middel" ? 27 : 34;
  const projectedStops = bus.early.length + bus.first.length + 1;
  const projectedScore = bus.firstScore + receiptLoadScore(receipt);
  const canRideFirstLoop =
    fitsNaturalFirstLoop(receipt, bus) &&
    projectedStops <= maxFirstStops &&
    projectedScore <= maxFirstScore;

  if (canRideFirstLoop) return false;

  if (projectedStops > maxFirstStops && minutes >= 660) return true;
  if (projectedScore > maxFirstScore && minutes >= 660) return true;

  return (
    isLargeReceipt(receipt) &&
    minutes >= 720 &&
    (projectedStops >= maxFirstStops - 1 || projectedScore >= maxFirstScore * 0.85)
  );
}

function addReceiptToBus(
  bus: PlannedBus,
  receipt: ReceiptSummary,
  round: "early" | "first" | "firstIce" | "second" | "ice"
) {
  const score = receiptLoadScore(receipt);

  bus[round].push(receipt);
  if (round === "second" || round === "ice") {
    bus.secondScore += score;
  } else {
    bus.firstScore += score;
  }
}

function shouldDeliverIceWithShopReceipt(
  receipt: ReceiptSummary,
  loadProfile: DayLoadProfile
) {
  const iceTubs = iceTubCountForReceipt(receipt);
  if (!shopKeyForReceipt(receipt) || iceTubs <= 0) return false;
  if (loadProfile.pressure === "hoog") return false;

  return iceTubs <= (loadProfile.pressure === "middel" ? 6 : 9);
}

function iceStopForReceipt(receipt: ReceiptSummary): RouteStop {
  const target = receiptTargetLine(receipt);
  const time = routeTimeLabel(receipt);
  const iceTubs = iceTubCountForReceipt(receipt);
  const tempexBoxes = Math.ceil(iceTubs / 3);
  const detailParts = [
    time,
    target,
    iceTubs > 0 ? `${iceTubs} ijsbakken` : "ijsbon",
    tempexBoxes > 0 ? `${tempexBoxes} tempex` : "",
  ].filter(Boolean);

  return {
    id: `ice-${receipt.id}`,
    label: receipt.customer,
    detail: detailParts.join(" · "),
    badges: receiptStopBadges(receipt),
  };
}

function busLoadLine(bus: PlannedBus, round: "first" | "second") {
  const receipts =
    round === "first"
      ? [...bus.early, ...bus.first, ...bus.firstIce]
      : [...bus.second, ...bus.ice];
  const largeCount = receipts.filter(isLargeReceipt).length;
  const iceTubs = receipts.reduce(
    (total, receipt) => total + iceTubCountForReceipt(receipt),
    0
  );
  const detailParts = [
    `${receipts.length} bonnen`,
    largeCount ? `${largeCount} groot` : "",
    iceTubs ? `${iceTubs} ijs / ${Math.ceil(iceTubs / 3)} tempex` : "",
  ].filter(Boolean);

  return detailParts.join(" · ");
}

function buildRouteRounds(
  plan: DayPlan,
  receipts: ReceiptSummary[],
  loadProfile: DayLoadProfile
): RouteRound[] {
  const buses: Record<BusId, PlannedBus> = {
    A: createPlannedBus({
      id: "A",
      title: "Bus A",
      tone: "border-[#d6e5d8] bg-[#f6faf4]",
      shopKeys: ["heyendaalseweg", "daalseweg"],
    }),
    B: createPlannedBus({
      id: "B",
      title: "Bus B",
      tone: "border-[#eadb8b] bg-[#fff8d8]",
      shopKeys: ["ziekerstraat", "lent"],
    }),
  };
  const clusterAssignments = new Map<string, BusId>();
  const deliveryReceipts = sortDeliveryReceipts(receipts.filter(isRouteDelivery));
  const iceReceipts = sortDeliveryReceipts(receipts.filter(isIceReceiptSummary));
  const rounds: RouteRound[] = [];

  deliveryReceipts.forEach((receipt) => {
    const firstChoiceBus = chooseBusForReceipt({
      buses,
      clusterAssignments,
      receipt,
      round: "first",
    });
    const round = shouldUseSecondRound(
      receipt,
      buses[firstChoiceBus],
      loadProfile
    )
      ? "second"
      : isEarlyException(receipt)
        ? "early"
        : "first";
    const bus =
      round === "second"
        ? chooseBusForReceipt({
            buses,
            clusterAssignments,
            receipt,
            round: "second",
          })
        : firstChoiceBus;

    addReceiptToBus(buses[bus], receipt, round);
  });

  iceReceipts.forEach((receipt) => {
    const bus = chooseBusForReceipt({
      buses,
      clusterAssignments,
      receipt,
      round: "second",
    });
    const round = shouldDeliverIceWithShopReceipt(receipt, loadProfile)
      ? "firstIce"
      : "ice";

    addReceiptToBus(buses[bus], receipt, round);
  });

  ([buses.A, buses.B] as PlannedBus[]).forEach((bus) => {
    const shopStops = groupShopStops(receipts, bus.shopKeys, bus.firstIce);
    const looseFirstIceStops = sortDeliveryReceipts(
      bus.firstIce.filter((receipt) => !shopKeyForReceipt(receipt))
    ).map(iceStopForReceipt);
    const firstStops = [
      ...sortDeliveryReceipts(bus.early).map((receipt) =>
        routeStopForReceipt(receipt, `${bus.id}-early-`)
      ),
      ...shopStops,
      ...looseFirstIceStops,
      ...sortDeliveryReceipts(bus.first).map((receipt) =>
        routeStopForReceipt(receipt, `${bus.id}-first-`)
      ),
    ];
    const secondStops = [
      ...sortDeliveryReceipts(bus.second).map((receipt) =>
        routeStopForReceipt(receipt, `${bus.id}-second-`)
      ),
      ...sortDeliveryReceipts(bus.ice).map(iceStopForReceipt),
    ];

    if (firstStops.length) {
      rounds.push(
        buildRouteRound({
          id: `bus-${bus.id}-1`,
          title: "Ronde 1",
          vehicle: bus.title,
          departure: plan.isFuture ? "advies 08:00" : "08:00",
          tone: bus.tone,
          stops: firstStops,
          reason: "Winkels eerst, daarna leveringen op tijd, volume en logische bundeling.",
          load: busLoadLine(bus, "first"),
          loadProfile,
        })
      );
    }

    if (secondStops.length) {
      rounds.push(
        buildRouteRound({
          id: `bus-${bus.id}-2`,
          title: "Ronde 2",
          vehicle: bus.title,
          departure: plan.isFuture ? "beslissen" : "na ronde 1",
          tone: "border-[#efc7b8] bg-[#fff3ed]",
          stops: secondStops,
          reason:
            "Tweede ronde voor ijs, grote of latere bonnen zodra ronde 1 lucht moet houden.",
          load: busLoadLine(bus, "second"),
          loadProfile,
        })
      );
    }
  });

  if (plan.iceTubs > 0 && iceReceipts.length === 0) {
    const bus = chooseLightestBus(buses, "second");
    rounds.push(
      buildRouteRound({
        id: `bus-${bus}-ice-check`,
        title: "IJs check",
        vehicle: `Bus ${bus}`,
        departure: plan.isFuture ? "beslissen" : "na ronde 1",
        tone: "border-[#efc7b8] bg-[#fff3ed]",
        stops: [
          {
            id: "ijs-check",
            label: "IJsbonnen controleren",
            detail: `${plan.iceTubs} bakken ijs · ${plan.tempexBoxes} zwarte tempexbakken`,
            badges: ["ijs", `${plan.tempexBoxes} tempex`],
          },
        ],
        reason:
          "Er is ijsvolume herkend, maar geen losse ijssalonbon; controleer de bronbonnen.",
        load: `${plan.iceTubs} ijsbakken per 3 in een zwarte tempexbak.`,
        loadProfile,
      })
    );
  }

  return rounds.filter((round) => round.stops.length > 0);
}

function buildReceiptLines(receipt: ReceiptSeed, plan: DayPlan): ReceiptLine[] {
  if (receipt.tags.includes("ijs")) {
    return [
      {
        quantity: String(plan.iceTubs),
        description: "IJs 5L bak",
        note: `${plan.tempexBoxes} zwarte tempexbakken klaarzetten.`,
      },
      {
        quantity: "1",
        description: "Koelcontrole",
        note: "IJs apart laden en ronde 2 beoordelen.",
      },
    ];
  }

  if (receipt.tags.includes("winkel")) {
    return [
      {
        quantity: "1",
        description: "Winkelvoorraad volgens interne paklijst",
        note: "Brood en gebak per winkel bij elkaar houden.",
      },
      {
        quantity: "1",
        description: "Retour fust controleren",
        note: "Lege kratten direct scheiden bij terugkomst.",
      },
    ];
  }

  if (receipt.customer === "Sanadome") {
    return [
      { quantity: "120", description: "Gesorteerd gebak" },
      { quantity: "30", description: "Petit fours" },
      {
        quantity: "1",
        description: "Presentatiedozen",
        note: "Achter winkelbakken houden, tenzij bon expliciet vroeg meldt.",
      },
    ];
  }

  if (receipt.customer === "Bruidsproeverij") {
    return [
      { quantity: "1", description: "Proeverijbox" },
      { quantity: "1", description: "Presentatiemap" },
      {
        quantity: "1",
        description: "Koel/fragiel",
        note: "Niet onder winkelkratten plaatsen.",
      },
    ];
  }

  if (receipt.tags.includes("zorg")) {
    return [
      { quantity: "8", description: "Taart/gebak assorti" },
      { quantity: "60", description: "Petit fours" },
      {
        quantity: "1",
        description: "Afdelingcheck",
        note: "Naam en afdeling op bon controleren.",
      },
    ];
  }

  if (receipt.tags.includes("campus")) {
    return [
      { quantity: "10", description: "Luxe gebak assorti" },
      { quantity: "2", description: "Doos petit fours" },
      {
        quantity: "1",
        description: "Campuslevering",
        note: "Samen plannen met Heyendaal/Radboud.",
      },
    ];
  }

  if (receipt.tags.includes("groot")) {
    return [
      { quantity: "200", description: "Gesorteerd gebak" },
      {
        quantity: "1",
        description: "Transportkrat breekbaar",
        note: "Volume checken voor tweede ronde.",
      },
    ];
  }

  if (receipt.tags.includes("check")) {
    return [
      { quantity: "1", description: "Contantbon assortiment" },
      {
        quantity: "1",
        description: "Adres en tijd controleren",
        note: "Pas route vastzetten na controle.",
      },
    ];
  }

  const assortedQuantity = receipt.value && receipt.value >= 150 ? "18" : "8";

  return [
    { quantity: assortedQuantity, description: "Gesorteerd gebak" },
    {
      quantity: "1",
      description: "Bezorging contantbon",
      note: `Tijdvak ${receipt.time}.`,
    },
  ];
}

function buildReceiptCustomerNote(receipt: ReceiptSeed) {
  if (receipt.customerNote) return receipt.customerNote;
  if (receipt.tags.includes("zorg")) {
    return "Afgeven bij receptie of afdeling, naam op bon controleren.";
  }
  if (receipt.tags.includes("winkel")) {
    return "Interne levering voor winkel, buiten externe dagwaarde.";
  }
  if (receipt.tags.includes("ijs")) {
    return "Tempex dicht laten tot lossen, ijs niet tussen gebak zetten.";
  }
  if (receipt.tags.includes("check")) {
    return "Adres, alternatief afleveradres en bezorgtijd controleren voor vertrek.";
  }

  return "Geen aparte klantopmerking.";
}

function buildReceiptAlternativeAddress(receipt: ReceiptSeed) {
  if (receipt.alternativeAddress) return receipt.alternativeAddress;
  if (receipt.route === "Check") return "Alternatief adres in Orbak controleren";
  if (receipt.customer === "Radboud") return "Campus hoofdingang / receptie";
  if (receipt.customer === "Sint Maartenskliniek") return "Hoofdreceptie bij dichte afdeling";

  return undefined;
}

function hydrateReceipt(receipt: ReceiptSeed, plan: DayPlan): ReceiptSummary {
  return {
    ...receipt,
    receiptNumber: receipt.receiptNumber || receipt.id,
    deliveryAddress: receipt.deliveryAddress || receipt.address,
    alternativeAddress: buildReceiptAlternativeAddress(receipt),
    customerNote: buildReceiptCustomerNote(receipt),
    internalNote: receipt.internalNote || receipt.note,
    lines: buildReceiptLines(receipt, plan),
  };
}

function buildReceiptSummaries(
  plan: DayPlan,
  importedBatch: LogisticsBatch | null
): ReceiptSummary[] {
  if (importedBatch?.receipts.length) return importedBatch.receipts;

  const sharedReceipts: ReceiptSeed[] = [
    {
      id: "CB-001",
      time: "08:00",
      customer: "Hinke",
      address: "Afhalen / winkel",
      route: "Bus A",
      tags: ["tijd", "check"],
      value: 68,
      note: "Vroegste bon, eerst klaarzetten.",
    },
    {
      id: "CB-002",
      time: "08:00-09:00",
      customer: "Janssen",
      address: "Nijmegen",
      route: "Bus A",
      tags: ["tijd"],
      value: 94,
      note: "Voor vertrekcontrole bellen bij vertraging.",
    },
    {
      id: "CB-003",
      time: "08:30",
      customer: "Sanadome",
      address: "Weg door Jonkerbos",
      route: "Bus B",
      tags: ["groot", "gebak"],
      value: 420,
      note: "Grote gebaksorder na winkelstops, tenzij expliciet vroeg.",
    },
    {
      id: "CB-004",
      time: "09:00-09:30",
      customer: "Sint Maartenskliniek",
      address: "Hengstdal",
      route: "Bus A",
      tags: ["zorg", "tijd"],
      value: 310,
      note: "Niet achter winkelvoorraad laten verdwijnen.",
    },
    {
      id: "CB-005",
      time: "09:00-10:00",
      customer: "Radboud",
      address: "Heyendaal",
      route: "Bus A",
      tags: ["tijd", "campus"],
      value: 280,
      note: "Combineren met Heyendaal/Daalseweg als dat tijd wint.",
    },
    {
      id: "CB-006",
      time: "09:30",
      customer: "Winkel Heyendaalseweg",
      address: "interne levering",
      route: "Bus A",
      tags: ["winkel", "intern"],
      note: "Niet meetellen in externe waarde.",
    },
    {
      id: "CB-007",
      time: "09:40",
      customer: "Winkel Daalseweg",
      address: "interne levering",
      route: "Bus A",
      tags: ["winkel", "intern"],
      note: "Niet meetellen in externe waarde.",
    },
    {
      id: "CB-008",
      time: "09:45",
      customer: "IJssalons",
      address: "ijssalonbonnen controleren",
      route: "Ronde 2",
      tags: ["ijs", "intern", `${plan.tempexBoxes} tempex`],
      note: `${plan.iceTubs} bakken ijs, apart laden.`,
    },
    {
      id: "CB-009",
      time: "10:00",
      customer: "Winkel Ziekerstraat",
      address: "interne levering",
      route: "Bus B",
      tags: ["winkel", "intern"],
      note: "Eerste vaste centrum/winkelstop.",
    },
    {
      id: "CB-010",
      time: "10:15",
      customer: "Winkel Lent",
      address: "interne levering",
      route: "Bus B",
      tags: ["winkel", "intern"],
      note: "Laatste vaste winkelstop.",
    },
    {
      id: "CB-011",
      time: "10:30",
      customer: "Van der Valk",
      address: "Lent",
      route: "Bus B",
      tags: ["extern"],
      value: 185,
      note: "Na Lent logisch meenemen.",
    },
    {
      id: "CB-012",
      time: "10:45",
      customer: "HAN",
      address: "Kapittelweg",
      route: "Bus A",
      tags: ["campus"],
      value: 156,
      note: "Combineren met Radboud/Heyendaal.",
    },
    {
      id: "CB-013",
      time: "11:00",
      customer: "Gemeente Nijmegen",
      address: "Centrum",
      route: "Bus B",
      tags: ["extern"],
      value: 225,
      note: "Centrumrit niet voor Ziekerstraat blokkeren.",
    },
    {
      id: "CB-014",
      time: "11:15",
      customer: "Tandartspraktijk",
      address: "Daalseweg",
      route: "Bus A",
      tags: ["extern"],
      value: 78,
      note: "Kleine bon, kan met Daalseweg mee.",
    },
    {
      id: "CB-015",
      time: "11:30",
      customer: "Bouwbedrijf",
      address: "Nijmegen west",
      route: "Check",
      tags: ["check"],
      value: 134,
      note: "Adres checken voor routevastzetting.",
    },
    {
      id: "CB-016",
      time: "12:00",
      customer: "Lunchkamer",
      address: "Centrum",
      route: "Bus B",
      tags: ["extern"],
      value: 96,
      note: "Bij centrumblok houden.",
    },
    {
      id: "CB-017",
      time: "12:15",
      customer: "Kantoororder",
      address: "Heyendaal",
      route: "Bus A",
      tags: ["extern"],
      value: 146,
      note: "Past na campusblok.",
    },
    {
      id: "CB-018",
      time: "12:30",
      customer: "Particulier",
      address: "Lent",
      route: "Bus B",
      tags: ["extern"],
      value: 42,
      note: "Klein, niet apart voor rijden.",
    },
    {
      id: "CB-019",
      time: "13:00",
      customer: "Bedrijfscatering",
      address: "Nijmegen",
      route: "Check",
      tags: ["groot", "check"],
      value: 380,
      note: "Volume controleren voor tweede ronde.",
    },
    {
      id: "CB-020",
      time: "13:15",
      customer: "Jarige klant",
      address: "Daalseweg buurt",
      route: "Bus A",
      tags: ["extern"],
      value: 64,
      note: "Breekbaar gebak, bovenop houden.",
    },
    {
      id: "CB-021",
      time: "13:30",
      customer: "School",
      address: "Oost",
      route: "Bus A",
      tags: ["extern", "groot"],
      value: 295,
      note: "Grote aantallen geven productiedruk.",
    },
    {
      id: "CB-022",
      time: "14:00",
      customer: "Receptieorder",
      address: "Centrum",
      route: "Bus B",
      tags: ["extern"],
      value: 115,
      note: "Kan in centrumblok.",
    },
    {
      id: "CB-023",
      time: "14:30",
      customer: "Ziekenhuis afdeling",
      address: "Radboud",
      route: "Bus A",
      tags: ["zorg", "extern"],
      value: 236,
      note: "Niet vergeten bij ochtend-campus.",
    },
    {
      id: "CB-024",
      time: "15:00",
      customer: "Bruidsproeverij",
      address: "Ziekerstraat",
      route: "Bus B",
      tags: ["extern", "check"],
      value: 210,
      note: "Presentatie netjes apart houden.",
    },
    {
      id: "CB-025",
      time: "15:30",
      customer: "Laatste losse bon",
      address: "Nijmegen",
      route: "Check",
      tags: ["check"],
      value: 61,
      note: "Alleen meenemen als route logisch blijft.",
    },
  ];

  const visibleReceipts = sharedReceipts
    .slice(0, plan.orderCount)
    .map((receipt) => hydrateReceipt(receipt, plan));

  if (plan.isFuture) {
    return visibleReceipts.map((receipt, index) => ({
      ...receipt,
      id: `P-${String(index + 1).padStart(3, "0")}`,
      note: receipt.tags.includes("intern")
        ? receipt.note
        : "Prognosebon, definitieve aantallen na 22:00.",
      internalNote: receipt.tags.includes("intern")
        ? receipt.internalNote
        : "Prognosebon, definitieve aantallen na 22:00.",
      customerNote: receipt.tags.includes("intern")
        ? receipt.customerNote
        : "Nog prognose: controleer na de definitieve batch.",
    }));
  }

  return visibleReceipts;
}

function learningSignalsFor(feedback: string) {
  const text = feedback.toLowerCase();
  const signals: string[] = [];

  if (text.includes("rustig")) signals.push("rustig label bewaren");
  if (text.includes("druk")) signals.push("drukte hoger wegen");
  if (text.includes("grote") || text.includes("200")) signals.push("grote order = laadtijd");
  if (text.includes("gebak") || text.includes("petit")) signals.push("gebakspiek herkennen");
  if (text.includes("ijs")) signals.push("ijsvolume apart plannen");
  if (text.includes("08:10") || text.includes("laat") || text.includes("vertraging")) {
    signals.push("vertrekbuffer verhogen");
  }

  return signals.length ? signals : ["nog geen signaal"];
}

export default function BakkerijLogistiekDashboard() {
  const [activeTab, setActiveTab] = useState<DashboardTab>("routes");
  const [dateState, setDateState] = useState<DateState>(createDateState);
  const [fileSnapshot, setFileSnapshot] = useState<FileSnapshot | null>(null);
  const [importedBatch, setImportedBatch] = useState<LogisticsBatch | null>(null);
  const [webshopImages, setWebshopImages] = useState<WebshopImageSummary[]>([]);
  const [receiptOverrides, setReceiptOverrides] = useState<
    ReceiptOverrideSummary[]
  >([]);
  const [batchLoadState, setBatchLoadState] = useState<BatchLoadState>("idle");
  const [batchReloadCounter, setBatchReloadCounter] = useState(0);
  const [isImporting, setIsImporting] = useState(false);
  const [importMessage, setImportMessage] = useState("");
  const [overrideMessage, setOverrideMessage] = useState("");
  const [photoLinkMessage, setPhotoLinkMessage] = useState("");
  const [feedbackByDate, setFeedbackByDate] = useState<Record<string, string>>(
    {}
  );
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [isSavingFeedback, setIsSavingFeedback] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const manualBatchRefreshRef = useRef(false);
  const activeImportedBatch =
    importedBatch?.date === dateState.selectedDate ? importedBatch : null;

  const selectedPlan = useMemo(
    () => buildDayPlan(dateState, fileSnapshot, activeImportedBatch),
    [dateState, fileSnapshot, activeImportedBatch]
  );
  const baseReceiptSummaries = useMemo(
    () => buildReceiptSummaries(selectedPlan, activeImportedBatch),
    [selectedPlan, activeImportedBatch]
  );
  const receiptSummaries = useMemo(
    () =>
      applyReceiptOverrides(
        baseReceiptSummaries,
        receiptOverrides,
        selectedPlan.date
      ),
    [baseReceiptSummaries, receiptOverrides, selectedPlan.date]
  );
  const loadProfile = useMemo(
    () => buildDayLoadProfile(selectedPlan, receiptSummaries),
    [selectedPlan, receiptSummaries]
  );
  const productionTotals = useMemo(
    () => buildBakeryProductionTotals(receiptSummaries),
    [receiptSummaries]
  );
  const stats = useMemo(
    () => buildStats(selectedPlan, loadProfile, productionTotals),
    [loadProfile, productionTotals, selectedPlan]
  );
  const routeRounds = useMemo(
    () => buildRouteRounds(selectedPlan, receiptSummaries, loadProfile),
    [loadProfile, receiptSummaries, selectedPlan]
  );
  const marzipanPrintItems = useMemo(
    () => buildMarzipanPrintItems(receiptSummaries, webshopImages),
    [receiptSummaries, webshopImages]
  );
  const feedback = feedbackByDate[selectedPlan.date] || "";
  const learningSignals = useMemo(() => learningSignalsFor(feedback), [feedback]);
  const headerTone = statusToneFor(selectedPlan.status);

  const uploadStatus = useMemo(() => {
    if (isImporting) return "batch wordt ingelezen...";
    if (!fileSnapshot) return selectedPlan.sourceLabel;

    return `${fileSnapshot.name} · ${formatBytes(fileSnapshot.size)} · ${fileSnapshot.uploadedAt}`;
  }, [fileSnapshot, isImporting, selectedPlan.sourceLabel]);

  const batchStatusLine = useMemo(() => {
    if (importMessage) return importMessage;
    if (activeImportedBatch) {
      return `${activeImportedBatch.fileName} · ${activeImportedBatch.orderCount} bonnen · ${formatDateTimeLabel(activeImportedBatch.importedAt)}`;
    }
    if (batchLoadState === "loading") return "mailbatch controleren...";
    if (batchLoadState === "error") return "mailbatch kon niet worden opgehaald";

    return "nog geen echte batch voor deze dag";
  }, [activeImportedBatch, batchLoadState, importMessage]);
  const headerStatusLine = headerMetaLine(
    selectedPlan,
    activeImportedBatch,
    batchStatusLine
  );

  useEffect(() => {
    let ignoreResult = false;
    const manualRefresh = manualBatchRefreshRef.current;

    async function loadBatch() {
      setBatchLoadState("loading");
      setImportMessage(manualRefresh ? "bonnen opnieuw ophalen..." : "");

      try {
        const response = await fetch(
          `/api/bakkerij-logistiek?date=${encodeURIComponent(dateState.selectedDate)}`,
          { cache: "no-store" }
        );
        const data = (await response.json()) as {
          batch?: LogisticsBatch | null;
          dayFeedback?: DayFeedbackSummary | null;
          webshopImages?: WebshopImageSummary[];
          receiptOverrides?: ReceiptOverrideSummary[];
          message?: string;
        };

        if (ignoreResult) return;

        if (!response.ok) {
          setBatchLoadState("error");
          setWebshopImages([]);
          setReceiptOverrides([]);
          if (manualRefresh) {
            setImportMessage(data.message || "Opnieuw ophalen is niet gelukt.");
          }
          return;
        }

        setImportedBatch(data.batch || null);
        setWebshopImages(data.webshopImages || []);
        setReceiptOverrides(data.receiptOverrides || []);
        setFeedbackByDate((current) => ({
          ...current,
          [dateState.selectedDate]: data.dayFeedback?.text || "",
        }));
        setBatchLoadState("ready");
        if (manualRefresh) {
          setImportMessage(
            data.batch
              ? `Bijgewerkt om ${getUploadTime()}.`
              : `Geen mailbatch gevonden voor ${formatDateLabel(dateState.selectedDate)}.`
          );
        }
      } catch {
        if (!ignoreResult) {
          setBatchLoadState("error");
          setReceiptOverrides([]);
          if (manualRefresh) setImportMessage("Opnieuw ophalen is niet gelukt.");
        }
      } finally {
        if (manualRefresh) manualBatchRefreshRef.current = false;
      }
    }

    loadBatch();

    return () => {
      ignoreResult = true;
    };
  }, [dateState.selectedDate, batchReloadCounter]);

  function selectDate(date: string) {
    setDateState((current) => ({ ...current, selectedDate: date }));
    setFileSnapshot(null);
    setImportMessage("");
    setOverrideMessage("");
    setPhotoLinkMessage("");
    setFeedbackMessage("");
  }

  function refreshBatch() {
    manualBatchRefreshRef.current = true;
    setFileSnapshot(null);
    setImportMessage("bonnen opnieuw ophalen...");
    if (fileInputRef.current) fileInputRef.current.value = "";
    setBatchReloadCounter((current) => current + 1);
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setImportMessage("PDF wordt gelezen...");

    try {
      const formData = new FormData();
      formData.set("file", file);
      formData.set("source", "manual");
      formData.set("status", "handmatig");

      const response = await fetch("/api/bakkerij-logistiek/import", {
        method: "POST",
        body: formData,
      });
      const data = (await response.json()) as {
        batch?: LogisticsBatch;
        message?: string;
      };

      if (!response.ok || !data.batch) {
        throw new Error(data.message || "Batch inlezen is niet gelukt.");
      }

      setImportedBatch(data.batch);
      setDateState((current) => ({ ...current, selectedDate: data.batch!.date }));
      setFileSnapshot({
        name: file.name,
        size: file.size,
        uploadedAt: getUploadTime(),
      });
      setImportMessage(`${data.batch.orderCount} bonnen ingelezen.`);
    } catch (error) {
      setImportMessage(
        error instanceof Error ? error.message : "Batch inlezen is niet gelukt."
      );
    } finally {
      setIsImporting(false);
    }
  }

  async function saveReceiptOverride(
    receipt: ReceiptSummary,
    draft: ReceiptOverrideDraft
  ) {
    setOverrideMessage("bonaanpassing opslaan...");

    try {
      const response = await fetch("/api/bakkerij-logistiek/receipt-overrides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: selectedPlan.date,
          receiptId: receipt.id,
          receiptNumber: receipt.receiptNumber,
          ...draft,
        }),
      });
      const data = (await response.json()) as {
        deleted?: boolean;
        message?: string;
        override?: ReceiptOverrideSummary;
      };

      if (!response.ok || !data.override) {
        throw new Error(data.message || "Bonaanpassing opslaan is niet gelukt.");
      }

      setReceiptOverrides((current) => {
        const withoutCurrent = current.filter(
          (item) => item.id !== data.override!.id
        );

        return data.deleted
          ? withoutCurrent
          : [data.override!, ...withoutCurrent];
      });
      setOverrideMessage(
        data.deleted ? "Bonaanpassing gewist." : "Bonaanpassing opgeslagen."
      );
    } catch (error) {
      setOverrideMessage(
        error instanceof Error
          ? error.message
          : "Bonaanpassing opslaan is niet gelukt."
      );
    }
  }

  async function linkWebshopImageToReceipt(
    image: WebshopImageSummary,
    receipt: ReceiptSummary
  ) {
    setPhotoLinkMessage("foto koppelen...");

    try {
      const response = await fetch("/api/bakkerij-logistiek/webshop-images/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageId: image.id,
          receiptId: receipt.id,
          receiptNumber: receipt.receiptNumber,
          receiptCustomer: receipt.customer,
        }),
      });
      const data = (await response.json()) as {
        image?: WebshopImageSummary;
        message?: string;
      };

      if (!response.ok || !data.image) {
        throw new Error(data.message || "Foto koppelen is niet gelukt.");
      }

      setWebshopImages((current) =>
        current.map((item) => (item.id === data.image!.id ? data.image! : item))
      );
      setPhotoLinkMessage(`Foto gekoppeld aan ${receipt.customer}.`);
    } catch (error) {
      setPhotoLinkMessage(
        error instanceof Error ? error.message : "Foto koppelen is niet gelukt."
      );
    }
  }

  function updateFeedback(value: string) {
    setFeedbackByDate((current) => ({
      ...current,
      [selectedPlan.date]: value,
    }));
  }

  async function saveFeedback() {
    setIsSavingFeedback(true);
    setFeedbackMessage("feedback opslaan...");

    try {
      const response = await fetch("/api/bakkerij-logistiek/day-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: selectedPlan.date,
          text: feedback,
        }),
      });
      const data = (await response.json()) as {
        feedback?: DayFeedbackSummary;
        message?: string;
      };

      if (!response.ok || !data.feedback) {
        throw new Error(data.message || "Feedback opslaan is niet gelukt.");
      }

      setFeedbackByDate((current) => ({
        ...current,
        [data.feedback!.date]: data.feedback!.text,
      }));
      setFeedbackMessage("Feedback opgeslagen en verwerkt.");
    } catch (error) {
      setFeedbackMessage(
        error instanceof Error ? error.message : "Feedback opslaan is niet gelukt."
      );
    } finally {
      setIsSavingFeedback(false);
    }
  }

  return (
    <StrikShell wide>
      <StrikPageHeader
        title="Bakkerij logistiek"
        icon={strikIcons.logistiek}
        kicker="Productie"
        description="Ochtendregie, pakbonnen, routes en tweede rondes."
      />

      <section className={`relative border p-2.5 shadow-sm sm:p-3 ${headerTone}`}>
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="text-[0.68rem] font-black uppercase tracking-normal opacity-75">
              {selectedPlan.title} · {formatDateLabel(selectedPlan.date)}
            </p>
            <div className="mt-1 flex min-w-0 flex-wrap items-center gap-2">
              <span className="border border-current bg-white/65 px-2 py-1 text-xs font-black uppercase tracking-normal text-[#1a1815]">
                {selectedPlan.status}
              </span>
              <span className="min-w-0 truncate text-xs font-bold tracking-normal text-[#4a4540]">
                {headerStatusLine}
              </span>
            </div>
            {fileSnapshot && (
              <p className="mt-1 truncate text-[0.68rem] font-bold tracking-normal opacity-75">
                {uploadStatus}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => selectDate(dateState.today)}
              className={`min-h-10 border px-3 text-sm font-black tracking-normal transition ${
                selectedPlan.date === dateState.today
                  ? "border-[#1a1815] bg-[#1a1815] text-white"
                  : "border-[#e8e4de] bg-white text-[#1a1815] hover:bg-[#faf8f5]"
              }`}
            >
              Vandaag
            </button>
            <button
              type="button"
              onClick={() => selectDate(dateState.tomorrow)}
              className={`min-h-10 border px-3 text-sm font-black tracking-normal transition ${
                selectedPlan.date === dateState.tomorrow
                  ? "border-[#1a1815] bg-[#1a1815] text-white"
                  : "border-[#e8e4de] bg-white text-[#1a1815] hover:bg-[#faf8f5]"
              }`}
            >
              Morgen
            </button>
            <label
              className={`min-h-10 border px-3 text-sm font-black tracking-normal transition ${
                selectedPlan.date !== dateState.today &&
                selectedPlan.date !== dateState.tomorrow
                  ? "border-[#1a1815] bg-[#1a1815] text-white"
                  : "border-[#e8e4de] bg-white text-[#1a1815] hover:bg-[#faf8f5]"
              } relative flex cursor-pointer items-center`}
            >
              Datum
              <input
                type="date"
                value={selectedPlan.date}
                aria-label="Datum kiezen"
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                onChange={(event) => selectDate(event.target.value)}
              />
            </label>
            <RefreshButton
              disabled={batchLoadState === "loading" || isImporting}
              loading={batchLoadState === "loading"}
              onClick={refreshBatch}
            />
            <MarzipanPhotoPrintButton
              count={marzipanPrintItems.length}
              disabled={marzipanPrintItems.length === 0}
              onClick={() =>
                printMarzipanPhotoSheet(selectedPlan, marzipanPrintItems)
              }
            />
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.xls,.xlsx,.csv"
              className="sr-only"
              onChange={handleFileChange}
            />
            {fileSnapshot && (
              <button
                type="button"
                aria-label="Batch wissen"
                title="Batch wissen"
                onClick={() => {
                  setFileSnapshot(null);
                  setImportMessage("");
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
                className="flex h-10 w-10 items-center justify-center border border-[#e8e4de] bg-white text-sm font-black text-[#6b645b] shadow-sm transition hover:bg-[#faf8f5]"
              >
                X
              </button>
            )}
          </div>
        </div>
      </section>

      <section className="mt-3 grid grid-cols-2 border border-[#e8e4de] bg-white shadow-sm sm:grid-cols-5">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="min-h-12 border-l border-[#efe7dd] px-2 py-2 first:border-l-0 sm:px-3"
          >
            <p className="text-[0.65rem] font-black uppercase tracking-normal text-[#6b645b]">
              {stat.label}
            </p>
            {stat.lines ? (
              <div className="mt-0.5 grid gap-px">
                {stat.lines.map((line) => (
                  <p
                    key={`${stat.label}-${line}`}
                    className="truncate text-[0.65rem] font-bold leading-tight tracking-normal text-[#1a1815]"
                  >
                    {line}
                  </p>
                ))}
              </div>
            ) : (
              <p className="mt-0.5 truncate text-sm font-black leading-tight tracking-normal text-[#1a1815] sm:text-base">
                {stat.value}
              </p>
            )}
          </div>
        ))}
      </section>

      <div className="mt-3 grid grid-cols-3 border border-[#e8e4de] bg-white p-1 shadow-sm">
        {tabs.map((tab) => {
          const active = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              type="button"
              aria-pressed={active}
              onClick={() => setActiveTab(tab.id)}
              className={`min-h-10 px-2 text-sm font-black tracking-normal transition ${
                active
                  ? "bg-[#1a1815] text-white"
                  : "bg-white text-[#6b645b] hover:bg-[#faf8f5]"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="mt-3">
        {activeTab === "routes" && <RoutesPanel routeRounds={routeRounds} />}
        {activeTab === "bonnen" && (
          <OrdersPanel
            receiptSummaries={receiptSummaries}
            receiptOverrides={receiptOverrides}
            onSaveReceiptOverride={saveReceiptOverride}
            onLinkWebshopImageToReceipt={linkWebshopImageToReceipt}
            overrideMessage={overrideMessage}
            photoLinkMessage={photoLinkMessage}
            selectedPlan={selectedPlan}
            webshopImages={webshopImages}
          />
        )}
        {activeTab === "leren" && (
          <LearningPanel
            feedback={feedback}
            isSaving={isSavingFeedback}
            message={feedbackMessage}
            learningSignals={learningSignals}
            onFeedbackChange={updateFeedback}
            onSave={saveFeedback}
            selectedPlan={selectedPlan}
          />
        )}
      </div>
    </StrikShell>
  );
}

function routeGroupsFor(routeRounds: RouteRound[]) {
  const groups = new Map<string, RouteRound[]>();

  routeRounds.forEach((route) => {
    const routes = groups.get(route.vehicle) || [];
    routes.push(route);
    groups.set(route.vehicle, routes);
  });

  return ["Bus A", "Bus B"]
    .filter((vehicle) => groups.has(vehicle))
    .map((vehicle) => ({
      vehicle,
      routes: groups.get(vehicle) || [],
    }));
}

function RoutesPanel({
  routeRounds,
}: Readonly<{ routeRounds: RouteRound[] }>) {
  const routeGroups = routeGroupsFor(routeRounds);

  return (
    <section className="grid gap-3 lg:grid-cols-2">
      {routeGroups.map((group) => (
        <article
          key={group.vehicle}
          className="rounded-lg border border-[#e8e4de] bg-white p-2.5 shadow-sm sm:p-3"
        >
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-black tracking-normal text-[#1a1815]">
              {group.vehicle}
            </h2>
            <span className="border border-[#e8e4de] bg-[#faf8f5] px-2 py-1 text-[0.68rem] font-black tracking-normal text-[#6b645b]">
              {group.routes.length} ronde{group.routes.length === 1 ? "" : "s"}
            </span>
          </div>
          <div className="mt-2 grid gap-2">
            {group.routes.map((route) => (
              <section
                key={route.id}
                className={`border p-2 ${route.tone}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="text-xs font-black uppercase tracking-normal text-[#1a1815]">
                      {route.title}
                    </h3>
                    <p className="mt-0.5 text-[0.68rem] font-bold tracking-normal text-[#6b645b]">
                      {route.departure} · {route.badge}
                    </p>
                  </div>
                  <span className="shrink-0 border border-white/80 bg-white px-1.5 py-0.5 text-[0.62rem] font-black tracking-normal text-[#6b645b]">
                    {route.load}
                  </span>
                </div>
                <ol className="mt-2 grid gap-1">
                  {route.stops.map((stop, index) => (
                    <li
                      key={stop.id}
                      className="grid grid-cols-[1.45rem_minmax(0,1fr)] gap-1.5 border border-white/80 bg-white px-1.5 py-1"
                    >
                      <span className="flex h-5 w-5 items-center justify-center bg-[#1a1815] text-[0.62rem] font-black tabular-nums tracking-normal text-white">
                        {index + 1}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-xs font-black tracking-normal text-[#1a1815]">
                          {stop.label}
                        </span>
                        <span className="mt-0.5 block truncate text-[0.65rem] font-normal tracking-normal text-[#6b645b]">
                          {stop.detail}
                        </span>
                        {stop.badges.length > 0 && (
                          <span className="mt-1 flex flex-wrap gap-1">
                            {stop.badges.map((badge) => (
                              <span
                                key={`${stop.id}-${badge}`}
                                className="border border-[#e8e4de] bg-white px-1 py-0.5 text-[0.58rem] font-black tracking-normal text-[#6b645b]"
                              >
                                {badge}
                              </span>
                            ))}
                          </span>
                        )}
                      </span>
                    </li>
                  ))}
                </ol>
                <p className="mt-2 text-[0.68rem] font-normal leading-snug tracking-normal text-[#4a4540]">
                  {route.reason}
                </p>
              </section>
            ))}
          </div>
        </article>
      ))}
    </section>
  );
}

function OrdersPanel({
  onLinkWebshopImageToReceipt,
  onSaveReceiptOverride,
  overrideMessage,
  photoLinkMessage,
  receiptOverrides,
  receiptSummaries,
  selectedPlan,
  webshopImages,
}: Readonly<{
  onLinkWebshopImageToReceipt: (
    image: WebshopImageSummary,
    receipt: ReceiptSummary
  ) => Promise<void>;
  onSaveReceiptOverride: (
    receipt: ReceiptSummary,
    draft: ReceiptOverrideDraft
  ) => Promise<void>;
  overrideMessage: string;
  photoLinkMessage: string;
  receiptOverrides: ReceiptOverrideSummary[];
  receiptSummaries: ReceiptSummary[];
  selectedPlan: DayPlan;
  webshopImages: WebshopImageSummary[];
}>) {
  const [selectedReceiptId, setSelectedReceiptId] = useState("");
  const [activeFilter, setActiveFilter] = useState<OrdersFilter>("all");
  const filteredReceipts = useMemo(
    () =>
      receiptSummaries.filter((receipt) =>
        receiptMatchesFilter(receipt, activeFilter)
      ),
    [activeFilter, receiptSummaries]
  );
  const selectedReceipt =
    filteredReceipts.find((receipt) => receipt.id === selectedReceiptId) ||
    filteredReceipts[0] ||
    null;
  const activeReceiptId = selectedReceipt?.id || "";
  const selectedOverride = selectedReceipt
    ? receiptOverrides.find(
        (override) =>
          override.id === receiptOverrideId(selectedPlan.date, selectedReceipt)
      ) || null
    : null;
  const selectedImageMatches = selectedReceipt
    ? imageMatchesForReceipt(selectedReceipt, webshopImages)
    : [];
  const unmatchedImages = useMemo(
    () =>
      webshopImages.filter(
        (image) => !imageHasReceiptMatch(image, receiptSummaries)
      ),
    [receiptSummaries, webshopImages]
  );

  return (
    <section className="grid gap-3 lg:grid-cols-[minmax(16rem,0.5fr)_minmax(0,1fr)]">
      <div className="rounded-lg border border-[#e8e4de] bg-white p-2.5 shadow-sm sm:p-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-black tracking-normal text-[#1a1815]">
            Bonnen
          </h2>
          <span className="w-fit border border-[#e8e4de] bg-[#faf8f5] px-2 py-1 text-[0.68rem] font-black tracking-normal text-[#6b645b]">
            {filteredReceipts.length}/{receiptSummaries.length} · foto {webshopImages.length}
          </span>
        </div>
        <div className="mt-2 flex gap-1 overflow-x-auto pb-1">
          {ordersFilters.map((filter) => {
            const active = activeFilter === filter.id;
            const count = receiptFilterCount(receiptSummaries, filter.id);

            return (
              <button
                key={filter.id}
                type="button"
                aria-pressed={active}
                onClick={() => setActiveFilter(filter.id)}
                className={`shrink-0 border px-1.5 py-0.5 text-[0.62rem] font-normal tracking-normal transition ${
                  active
                    ? "border-[#1a1815] bg-[#1a1815] text-white"
                    : "border-[#e8e4de] bg-white text-[#6b645b] hover:bg-[#faf8f5]"
                }`}
              >
                {filter.label} {count}
              </button>
            );
          })}
        </div>
        <div className="mt-2 h-[30rem] overflow-y-auto pr-1">
          <div className="grid gap-1.5">
            {filteredReceipts.map((receipt, index) => (
              <ReceiptRow
                key={receipt.id}
                active={receipt.id === activeReceiptId}
                imageCount={imageMatchesForReceipt(receipt, webshopImages).length}
                index={index}
                onSelect={() => setSelectedReceiptId(receipt.id)}
                receipt={receipt}
              />
            ))}
            {filteredReceipts.length === 0 && (
              <div className="border border-[#efe7dd] bg-[#faf8f5] p-3 text-sm font-bold tracking-normal text-[#6b645b]">
                Geen bonnen voor deze dag.
              </div>
            )}
            {unmatchedImages.length > 0 && (
              <div className="mt-1 border border-[#eadb8b] bg-[#fff8d8] p-2">
                <p className="text-[0.62rem] font-black uppercase tracking-normal text-[#6f5212]">
                  Foto check {unmatchedImages.length}
                </p>
                {photoLinkMessage && (
                  <p className="mt-1 truncate text-[0.64rem] font-bold tracking-normal text-[#6f5212]">
                    {photoLinkMessage}
                  </p>
                )}
                <div className="mt-1 grid gap-1">
                  {unmatchedImages.map((image) => (
                    <div
                      key={image.id}
                      className="grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-1.5 border border-[#eadb8b] bg-white/75 p-1"
                    >
                      <a
                        href={image.photoUrl}
                        target="_blank"
                        rel="noreferrer"
                        aria-label="Webshopfoto openen"
                        className="block h-8 w-8 bg-[#faf8f5] bg-cover bg-center"
                        style={thumbnailStyleFor(image)}
                      />
                      <a
                        href={image.photoUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="min-w-0 text-[0.64rem] font-normal leading-tight tracking-normal text-[#1a1815] underline-offset-2 hover:underline"
                      >
                        <span className="block truncate font-bold">
                          {image.fileName ||
                            image.customerName ||
                            "Klant onbekend"}
                        </span>
                        <span className="block truncate text-[#6f5212]">
                          {image.orderNumber || "geen bestelnummer"} ·{" "}
                          {image.customerName || "naam check"}
                        </span>
                      </a>
                      {selectedReceipt && (
                        <button
                          type="button"
                          onClick={() =>
                            void onLinkWebshopImageToReceipt(
                              image,
                              selectedReceipt
                            )
                          }
                          className="min-h-7 border border-[#1a1815] bg-[#1a1815] px-1.5 text-[0.6rem] font-black uppercase tracking-normal text-white transition hover:bg-[#3b352f]"
                        >
                          Koppel
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <ReceiptDetail
        imageMatches={selectedImageMatches}
        onSaveReceiptOverride={onSaveReceiptOverride}
        override={selectedOverride}
        overrideMessage={overrideMessage}
        receipt={selectedReceipt}
        selectedPlan={selectedPlan}
      />
    </section>
  );
}

function ReceiptRow({
  active,
  imageCount,
  index,
  onSelect,
  receipt,
}: Readonly<{
  active: boolean;
  imageCount: number;
  index: number;
  onSelect: () => void;
  receipt: ReceiptSummary;
}>) {
  const fulfillment = fulfillmentLabel(receipt);
  const target = receiptTargetLine(receipt);
  const time = routeTimeLabel(receipt);

  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onSelect}
      className={`grid w-full grid-cols-[2rem_minmax(0,1fr)] gap-2 border p-1.5 text-left transition ${
        active
          ? "border-[#1a1815] bg-[#fff3ed]"
          : "border-[#efe7dd] bg-[#faf8f5] hover:border-[#efc7b8] hover:bg-white"
      }`}
    >
      <span className="flex h-7 w-7 items-center justify-center bg-[#1a1815] text-[0.68rem] font-black tabular-nums tracking-normal text-white">
        {index + 1}
      </span>
      <div className="min-w-0">
        <div className="flex min-w-0 items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-xs font-black tracking-normal text-[#1a1815]">
              {receipt.customer}
            </p>
            <p className="truncate text-[0.68rem] font-bold tracking-normal text-[#6b645b]">
              {time} · {target}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-[0.68rem] font-black tracking-normal text-[#1a1815]">
              {receipt.route}
            </p>
            {receipt.value ? (
              <p className="text-[0.68rem] font-normal tracking-normal text-[#6b645b]">
                {formatCurrency(receipt.value)}
              </p>
            ) : (
              <p className="text-[0.68rem] font-normal tracking-normal text-[#8b8278]">
                intern
              </p>
            )}
          </div>
        </div>
        <div className="mt-1 flex items-center gap-1">
          <span className="border border-[#e8e4de] bg-white px-1.5 py-0.5 text-[0.62rem] font-black tracking-normal text-[#6b645b]">
            {fulfillment}
          </span>
          {imageCount > 0 && (
            <span className="border border-[#d6e5d8] bg-white px-1.5 py-0.5 text-[0.62rem] font-black tracking-normal text-[#315641]">
              foto {imageCount}
            </span>
          )}
          <span className="truncate text-[0.65rem] font-normal tracking-normal text-[#8b8278]">
            {receipt.lines.length} regels
          </span>
        </div>
      </div>
    </button>
  );
}

function ReceiptAddressBlock({ receipt }: Readonly<{ receipt: ReceiptSummary }>) {
  const fulfillment = receiptFulfillment(receipt);
  const pickupLocation = pickupLocationFor(receipt);
  const focusLabel =
    fulfillment === "afhalen"
      ? "Afhaalwinkel"
      : receipt.alternativeAddress
        ? "Alternatief afleveradres"
        : "Afleveradres";
  const focusValue =
    fulfillment === "afhalen"
      ? pickupLocation || receipt.deliveryAddress || "Afhaalplek controleren"
      : receipt.alternativeAddress || receipt.deliveryAddress || receipt.address;
  const showAlternativeForPickup =
    fulfillment === "afhalen" &&
    receipt.alternativeAddress &&
    receipt.alternativeAddress !== focusValue;

  return (
    <div className="grid gap-2 border-b border-dashed border-[#d7d7d7] bg-white p-3">
      <div>
        <p className="text-[0.62rem] font-black uppercase tracking-normal text-[#555]">
          Origineel adres
        </p>
        <p className="mt-0.5 text-xs font-normal leading-snug tracking-normal text-[#111]">
          {receipt.address}
        </p>
      </div>
      <div
        className={`border px-2.5 py-2 ${
          fulfillment === "afhalen"
            ? "border-[#111] bg-[#f4f4f4]"
            : "border-[#d7d7d7] bg-[#f4f4f4]"
        }`}
      >
        <p className="text-[0.62rem] font-black uppercase tracking-normal text-[#555]">
          {focusLabel}
        </p>
        <p className="mt-0.5 text-sm font-black leading-snug tracking-normal text-[#111]">
          {focusValue}
        </p>
      </div>
      {showAlternativeForPickup && (
        <div>
          <p className="text-[0.62rem] font-black uppercase tracking-normal text-[#555]">
            Afleveradres op bon
          </p>
          <p className="mt-0.5 text-xs font-bold leading-snug tracking-normal text-[#111]">
            {receipt.alternativeAddress}
          </p>
        </div>
      )}
    </div>
  );
}

function thumbnailStyleFor(image: WebshopImageSummary) {
  return {
    backgroundImage: `url("${image.photoUrl.replace(/"/g, "%22")}")`,
  };
}

function WebshopImageBlock({
  images,
  receipt,
}: Readonly<{ images: WebshopImageSummary[]; receipt: ReceiptSummary }>) {
  if (images.length === 0) return null;

  return (
    <div className="border-b border-dashed border-[#d7d7d7] bg-white p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-black uppercase tracking-normal text-[#111]">
          Marsepeinfoto
        </p>
        <span className="text-[0.68rem] font-black tracking-normal text-[#555]">
          {images.length}
        </span>
      </div>
      <div className="mt-2 grid gap-1.5">
        {images.map((image) => {
          const displayCustomerName =
            image.customerName ||
            image.matchedReceiptCustomer ||
            receipt.customer ||
            "Klant controleren";
          const notes = image.notes.filter(
            (note) =>
              displayCustomerName === "Klant controleren" ||
              !/geen klantnaam gevonden/i.test(note)
          );

          return (
            <a
              key={image.id}
              href={image.photoUrl}
              target="_blank"
              rel="noreferrer"
              className="grid grid-cols-[3rem_minmax(0,1fr)] gap-2 border border-[#d7d7d7] bg-white p-1.5 text-left transition hover:border-[#111]"
            >
              <span
                aria-hidden="true"
                className="h-12 w-12 bg-[#faf8f5] bg-cover bg-center"
                style={thumbnailStyleFor(image)}
              />
              <span className="min-w-0">
                <span className="block truncate text-xs font-black tracking-normal text-[#111]">
                  {displayCustomerName}
                </span>
                <span className="mt-0.5 block truncate text-[0.68rem] font-normal tracking-normal text-[#555]">
                  {image.orderNumber || "zonder bestelnummer"} · match{" "}
                  {image.matchSource === "manual" ? "handmatig" : image.confidence}
                </span>
                {image.fileName && (
                  <span className="mt-0.5 block truncate text-[0.65rem] font-normal tracking-normal text-[#555]">
                    {image.fileName}
                  </span>
                )}
                {!image.customerName && displayCustomerName !== "Klant controleren" && (
                  <span className="mt-0.5 block truncate text-[0.65rem] font-normal tracking-normal text-[#555]">
                    klant uit gekoppelde bon
                  </span>
                )}
                {notes.length > 0 && (
                  <span className="mt-0.5 block truncate text-[0.65rem] font-normal tracking-normal text-[#555]">
                    {notes.join(" ")}
                  </span>
                )}
              </span>
            </a>
          );
        })}
      </div>
    </div>
  );
}

function ReceiptOverrideEditor({
  message,
  onSave,
  override,
  receipt,
}: Readonly<{
  message: string;
  onSave: (
    receipt: ReceiptSummary,
    draft: ReceiptOverrideDraft
  ) => Promise<void>;
  override: ReceiptOverrideSummary | null;
  receipt: ReceiptSummary;
}>) {
  const [draft, setDraft] = useState(() => draftForReceiptOverride(override));
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const hasSavedOverride = overrideHasValue(draftForReceiptOverride(override));

  async function saveDraft(nextDraft = draft) {
    setSaving(true);
    try {
      await onSave(receipt, nextDraft);
    } finally {
      setSaving(false);
    }
  }

  async function clearDraft() {
    const emptyDraft = emptyReceiptOverrideDraft();
    setDraft(emptyDraft);
    await saveDraft(emptyDraft);
  }

  return (
    <div className="border-b border-dashed border-[#d7d7d7] bg-white p-2">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          aria-expanded={open}
          aria-label="Bon aanpassen"
          title="Bon aanpassen"
          onClick={() => setOpen((current) => !current)}
          className="flex h-8 w-8 items-center justify-center border border-[#d7d7d7] bg-white text-[#111] transition hover:bg-[#f5f5f5]"
        >
          <PencilIcon />
        </button>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {hasSavedOverride && (
            <span className="border border-[#111] bg-white px-1.5 py-0.5 text-[0.6rem] font-black uppercase tracking-normal text-[#111]">
              aangepast
            </span>
          )}
          {message && (
            <span className="truncate text-[0.64rem] font-normal tracking-normal text-[#555]">
              {message}
            </span>
          )}
        </div>
        {open && (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={saving}
              onClick={() => saveDraft()}
              className="min-h-8 border border-[#111] bg-[#111] px-2 text-[0.68rem] font-black tracking-normal text-white transition hover:bg-[#333] disabled:cursor-not-allowed disabled:opacity-50"
            >
              OK
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={clearDraft}
              className="min-h-8 border border-[#d7d7d7] bg-white px-2 text-[0.68rem] font-black tracking-normal text-[#111] transition hover:bg-[#f5f5f5] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Wis
            </button>
          </div>
        )}
      </div>

      {open && (
        <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
          <label className="grid gap-1">
            <span className="text-[0.58rem] font-black uppercase tracking-normal text-[#555]">
              Tijd
            </span>
            <input
              value={draft.time}
              onChange={(event) =>
                setDraft((current) => ({ ...current, time: event.target.value }))
              }
              placeholder={receipt.time}
              className="h-8 border border-[#d7d7d7] bg-white px-2 text-xs font-bold tracking-normal text-[#111] outline-none focus:border-[#111]"
            />
          </label>
          <label className="grid gap-1">
            <span className="text-[0.58rem] font-black uppercase tracking-normal text-[#555]">
              Soort
            </span>
            <select
              value={draft.fulfillment}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  fulfillment: event.target.value as LogisticsFulfillment | "",
                }))
              }
              className="h-8 border border-[#d7d7d7] bg-white px-2 text-xs font-bold tracking-normal text-[#111] outline-none focus:border-[#111]"
            >
              <option value="">bon</option>
              <option value="bezorgen">bezorgen</option>
              <option value="afhalen">afhalen</option>
              <option value="onbekend">check</option>
            </select>
          </label>
          <label className="grid gap-1">
            <span className="text-[0.58rem] font-black uppercase tracking-normal text-[#555]">
              Adres
            </span>
            <input
              value={draft.deliveryAddress}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  deliveryAddress: event.target.value,
                }))
              }
              placeholder={receipt.deliveryAddress}
              className="h-8 border border-[#d7d7d7] bg-white px-2 text-xs font-bold tracking-normal text-[#111] outline-none focus:border-[#111]"
            />
          </label>
          <label className="grid gap-1">
            <span className="text-[0.58rem] font-black uppercase tracking-normal text-[#555]">
              Alternatief
            </span>
            <input
              value={draft.alternativeAddress}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  alternativeAddress: event.target.value,
                }))
              }
              placeholder={receipt.alternativeAddress || "geen alternatief"}
              className="h-8 border border-[#d7d7d7] bg-white px-2 text-xs font-bold tracking-normal text-[#111] outline-none focus:border-[#111]"
            />
          </label>
          <label className="grid gap-1">
            <span className="text-[0.58rem] font-black uppercase tracking-normal text-[#555]">
              Afhaal
            </span>
            <select
              value={draft.pickupLocation}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  pickupLocation: event.target.value,
                }))
              }
              className="h-8 border border-[#d7d7d7] bg-white px-2 text-xs font-bold tracking-normal text-[#111] outline-none focus:border-[#111]"
            >
              <option value="">winkel</option>
              <option value="Heyendaalseweg">HEY</option>
              <option value="Daalseweg">DAAL</option>
              <option value="Ziekerstraat">ZIEK</option>
              <option value="Lent">LENT</option>
            </select>
          </label>
          <label className="grid gap-1">
            <span className="text-[0.58rem] font-black uppercase tracking-normal text-[#555]">
              Notitie
            </span>
            <input
              value={draft.routeNote}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  routeNote: event.target.value,
                }))
              }
              placeholder="let op ophalen in die winkel"
              className="h-8 border border-[#d7d7d7] bg-white px-2 text-xs font-bold tracking-normal text-[#111] outline-none focus:border-[#111]"
            />
          </label>
        </div>
      )}
    </div>
  );
}

function ReceiptDetail({
  imageMatches,
  onSaveReceiptOverride,
  override,
  overrideMessage,
  receipt,
  selectedPlan,
}: Readonly<{
  imageMatches: WebshopImageSummary[];
  onSaveReceiptOverride: (
    receipt: ReceiptSummary,
    draft: ReceiptOverrideDraft
  ) => Promise<void>;
  override: ReceiptOverrideSummary | null;
  overrideMessage: string;
  receipt: ReceiptSummary | null;
  selectedPlan: DayPlan;
}>) {
  if (!receipt) {
    return (
      <div className="flex h-[30rem] items-center justify-center rounded-lg border border-[#e8e4de] bg-white p-4 text-sm font-bold tracking-normal text-[#6b645b] shadow-sm">
        Geen contantbon geselecteerd.
      </div>
    );
  }

  const fulfillment = fulfillmentLabel(receipt);

  return (
    <article className="h-[30rem] overflow-y-auto rounded-lg border border-[#111] bg-white text-[#111] shadow-sm">
      <div className="border-b border-dashed border-[#d7d7d7] bg-white p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[0.65rem] font-black uppercase tracking-normal text-[#555]">
              Contantbon · {receipt.id}
            </p>
            <h2 className="mt-1 truncate text-base font-black tracking-normal text-[#111]">
              {receipt.customer}
            </h2>
          </div>
          <span className="shrink-0 border border-[#111] bg-white px-2 py-1 text-[0.68rem] font-black tracking-normal text-[#111]">
            {fulfillment}
          </span>
        </div>
        <div className="mt-2 flex flex-wrap gap-1">
          {receipt.tags.map((tag) => (
            <span
              key={tag}
              className="border border-[#d7d7d7] bg-white px-1.5 py-0.5 text-[0.65rem] font-black tracking-normal text-[#555]"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>

      <dl className="grid gap-2 border-b border-dashed border-[#d7d7d7] bg-white p-3 sm:grid-cols-3">
        <div>
          <dt className="text-[0.65rem] font-black uppercase tracking-normal text-[#555]">
            Tijd
          </dt>
          <dd className="mt-0.5 text-xs font-black tracking-normal text-[#111]">
            {receipt.time}
          </dd>
        </div>
        <div>
          <dt className="text-[0.65rem] font-black uppercase tracking-normal text-[#555]">
            Route
          </dt>
          <dd className="mt-0.5 text-xs font-black tracking-normal text-[#111]">
            {receipt.route}
          </dd>
        </div>
        <div>
          <dt className="text-[0.65rem] font-black uppercase tracking-normal text-[#555]">
            Dag
          </dt>
          <dd className="mt-0.5 text-xs font-black tracking-normal text-[#111]">
            {selectedPlan.title}
          </dd>
        </div>
      </dl>

      <ReceiptAddressBlock receipt={receipt} />
      <ReceiptOverrideEditor
        key={`${receipt.id}-${override?.updatedAt || "nieuw"}`}
        message={overrideMessage}
        onSave={onSaveReceiptOverride}
        override={override}
        receipt={receipt}
      />
      <WebshopImageBlock images={imageMatches} receipt={receipt} />

      <div className="bg-white p-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-xs font-black uppercase tracking-normal text-[#111]">
            Regels
          </h3>
          <span className="text-[0.68rem] font-black tracking-normal text-[#555]">
            {receipt.lines.length}
          </span>
        </div>
        <div className="mt-2 grid gap-1">
          {receipt.lines.map((line, index) => (
            <div
              key={`${receipt.id}-line-${index}`}
              className="grid grid-cols-[2.8rem_minmax(0,1fr)_4.3rem] gap-2 border-t border-[#e1e1e1] pt-1 first:border-t-0 first:pt-0"
            >
              <span className="font-mono text-xs font-black tabular-nums tracking-normal text-[#111]">
                {line.quantity}
              </span>
              <div className="min-w-0">
                <p className="text-xs font-bold leading-snug tracking-normal text-[#111]">
                  {line.description}
                </p>
                {line.note && (
                  <p className="mt-0.5 text-[0.68rem] font-normal leading-snug tracking-normal text-[#555]">
                    {line.note}
                  </p>
                )}
              </div>
              <span className="text-right text-[0.68rem] font-normal tabular-nums tracking-normal text-[#555]">
                {line.unitPrice !== undefined ? formatMoney(line.unitPrice) : ""}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="border-y border-dashed border-[#d7d7d7] bg-white p-3">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-black uppercase tracking-normal text-[#111]">
            Bonwaarde
          </span>
          <span className="text-sm font-normal tracking-normal text-[#111]">
            {receipt.value ? formatMoney(receipt.value) : "intern"}
          </span>
        </div>
      </div>

      <div className="grid gap-2 bg-white p-3">
        <div>
          <p className="text-[0.65rem] font-black uppercase tracking-normal text-[#555]">
            Opmerking bon
          </p>
          <p className="mt-0.5 text-xs font-normal leading-snug tracking-normal text-[#111]">
            {receipt.customerNote}
          </p>
        </div>
      </div>
    </article>
  );
}

function LearningPanel({
  feedback,
  isSaving,
  learningSignals,
  message,
  onFeedbackChange,
  onSave,
  selectedPlan,
}: Readonly<{
  feedback: string;
  isSaving: boolean;
  learningSignals: string[];
  message: string;
  onFeedbackChange: (value: string) => void;
  onSave: () => void;
  selectedPlan: DayPlan;
}>) {
  return (
    <section className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.7fr)]">
      <div className="rounded-lg border border-[#e8e4de] bg-white p-3 shadow-sm sm:p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-black tracking-normal text-[#1a1815]">
            Dagfeedback
          </h2>
          <button
            type="button"
            aria-label="Feedback opslaan"
            title="Feedback opslaan"
            disabled={isSaving}
            onClick={onSave}
            className="flex h-9 w-9 items-center justify-center border border-[#d6e5d8] bg-[#f6faf4] text-sm font-black text-[#1a1815] shadow-sm transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            OK
          </button>
        </div>
        <textarea
          value={feedback}
          onChange={(event) => onFeedbackChange(event.target.value)}
          placeholder="Vandaag was rustig, maar de grote gebaksorder duurde lang..."
          className="mt-3 min-h-36 w-full resize-y border border-[#e8e4de] bg-[#faf8f5] p-3 text-sm font-bold leading-snug tracking-normal text-[#1a1815] outline-none focus:border-[#ef5737]"
        />
        {message && (
          <p className="mt-2 text-xs font-bold tracking-normal text-[#6b645b]">
            {message}
          </p>
        )}
      </div>

      <div className="rounded-lg border border-[#d6e5d8] bg-[#f6faf4] p-3 shadow-sm sm:p-4">
        <p className="text-xs font-black uppercase tracking-normal text-[#4a6d5a]">
          Leersignalen · {selectedPlan.title}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {learningSignals.map((signal) => (
            <span
              key={signal}
              className="border border-[#d6e5d8] bg-white px-2 py-1 text-xs font-black tracking-normal text-[#1a1815]"
            >
              {signal}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

function PencilIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2.2"
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4 11.5-11.5z" />
    </svg>
  );
}

function RefreshButton({
  disabled,
  loading,
  onClick,
}: Readonly<{
  disabled: boolean;
  loading: boolean;
  onClick: () => void;
}>) {
  return (
    <button
      type="button"
      aria-label="Bonnen opnieuw ophalen"
      title="Bonnen opnieuw ophalen"
      disabled={disabled}
      onClick={onClick}
      className="flex h-10 w-10 items-center justify-center border border-[#e8e4de] bg-white text-[#1a1815] shadow-sm transition hover:bg-[#faf8f5] disabled:cursor-not-allowed disabled:opacity-50"
    >
      <RefreshIcon spinning={loading} />
    </button>
  );
}

function MarzipanPhotoPrintButton({
  count,
  disabled,
  onClick,
}: Readonly<{
  count: number;
  disabled: boolean;
  onClick: () => void;
}>) {
  return (
    <button
      type="button"
      aria-label="Marsepeinfoto's printen"
      title="Marsepeinfoto's printen"
      disabled={disabled}
      onClick={onClick}
      className="relative flex h-10 w-10 items-center justify-center border border-[#e8e4de] bg-white text-[#1a1815] shadow-sm transition hover:bg-[#faf8f5] disabled:cursor-not-allowed disabled:opacity-40"
    >
      <PhotoPrintIcon />
      {count > 0 && (
        <span className="absolute -right-1 -top-1 min-w-4 border border-[#1a1815] bg-[#1a1815] px-1 text-center text-[0.56rem] font-black leading-4 tracking-normal text-white">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </button>
  );
}

function PhotoPrintIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
    >
      <path d="M6 9V4h12v5" />
      <path d="M6 18H5a3 3 0 0 1-3-3v-3a3 3 0 0 1 3-3h14a3 3 0 0 1 3 3v3a3 3 0 0 1-3 3h-1" />
      <path d="M7 14h10v6H7z" />
      <path d="M8.5 17.5 10 16l1.5 1.5 1-1 2 2" />
    </svg>
  );
}

function RefreshIcon({ spinning }: Readonly<{ spinning: boolean }>) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`h-5 w-5 ${spinning ? "animate-spin" : ""}`}
      aria-hidden="true"
    >
      <path
        d="M20 6v5h-5M4 18v-5h5M18.3 10A7 7 0 0 0 6.7 7M5.7 14A7 7 0 0 0 17.3 17"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}
