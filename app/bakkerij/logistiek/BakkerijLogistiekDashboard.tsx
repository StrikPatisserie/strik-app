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
  LogisticsRouteDraft,
  LogisticsWebshopImage,
} from "./logisticsTypes";

type DashboardTab = "routes" | "bonnen" | "leren";
type BatchStatus = LogisticsBatchStatus;
type BatchLoadState = "idle" | "loading" | "ready" | "error";
type RouteSaveState = "idle" | "saving" | "saved" | "error";
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

type RouteGroup = {
  vehicle: string;
  routes: RouteRound[];
};

type RouteStop = {
  id: string;
  sourceId: string;
  label: string;
  detail: string;
  badges: string[];
};

type RouteDragState = {
  sourceRouteId: string;
  stopId: string;
};

type RouteStopMove = RouteDragState & {
  targetRouteId: string;
  targetStopId?: string;
  position: "before" | "after" | "end";
};

type BusId = "A" | "B";
type ShopKey = "heyendaalseweg" | "daalseweg" | "ziekerstraat" | "lent";
type ReceiptTone =
  | "neutral"
  | "delivery"
  | "heyendaalseweg"
  | "daalseweg"
  | "ziekerstraat"
  | "lent";

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
type RouteDraftSummary = LogisticsRouteDraft;

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

const routeDepot = {
  name: "Strik Patisserie",
  address: "Ambachtsweg 4, 6581 AX Malden",
};

type RoutePoint = {
  x: number;
  y: number;
};

const depotRoutePoint: RoutePoint = { x: 0, y: 0 };

const shopRouteMeta: Record<
  ShopKey,
  {
    label: string;
    shortLabel: string;
    address: string;
    point: RoutePoint;
  }
> = {
  heyendaalseweg: {
    label: "Winkel Heyendaalseweg",
    shortLabel: "Heyendaal",
    address: "Heyendaalseweg 217, Nijmegen",
    point: { x: 0.8, y: 2.5 },
  },
  daalseweg: {
    label: "Winkel Daalseweg",
    shortLabel: "Daalseweg",
    address: "Daalseweg 254, Nijmegen",
    point: { x: 0.9, y: 3.6 },
  },
  ziekerstraat: {
    label: "Winkel Ziekerstraat",
    shortLabel: "Ziekerstraat",
    address: "Ziekerstraat 124, Nijmegen",
    point: { x: -0.1, y: 3.3 },
  },
  lent: {
    label: "Winkel Lent",
    shortLabel: "Lent",
    address: "Oranje Marieplein 11, Lent",
    point: { x: 0.1, y: 5.7 },
  },
};

const shopRouteKeys = Object.keys(shopRouteMeta) as ShopKey[];

const busRouteMeta: Record<
  BusId,
  {
    title: string;
    capacity: number;
    description: string;
    tone: string;
  }
> = {
  A: {
    title: "Bus A",
    capacity: 1.3,
    description: "Renault Master elektrisch · grootste bus",
    tone: "border-[#d6e5d8] bg-[#f6faf4]",
  },
  B: {
    title: "Bus B",
    capacity: 1,
    description: "Renault Trafic",
    tone: "border-[#eadb8b] bg-[#fff8d8]",
  },
};

const saturdayRouteShopPlan: Record<
  BusId,
  {
    firstShopKeys: ShopKey[];
    secondShopKeys: ShopKey[];
    firstShopLabel: string;
    secondShopLabel: string;
  }
> = {
  A: {
    firstShopKeys: ["heyendaalseweg"],
    secondShopKeys: ["daalseweg"],
    firstShopLabel: "Heyendaal",
    secondShopLabel: "Daalseweg",
  },
  B: {
    firstShopKeys: ["lent"],
    secondShopKeys: ["ziekerstraat"],
    firstShopLabel: "Lent",
    secondShopLabel: "Ziekerstraat",
  },
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

function syncDateState(current: DateState): DateState {
  const next = createDateState();
  let selectedDate = current.selectedDate;

  if (
    current.selectedDate === current.today ||
    (current.selectedDate === current.tomorrow && current.selectedDate < next.today)
  ) {
    selectedDate = next.today;
  }

  if (
    current.today === next.today &&
    current.tomorrow === next.tomorrow &&
    current.hour === next.hour &&
    current.selectedDate === selectedDate
  ) {
    return current;
  }

  return {
    ...next,
    selectedDate,
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

function isoWeekNumber(date: Date) {
  const target = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
  );
  const dayNumber = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - dayNumber);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));

  return Math.ceil(((target.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

function formatReceiptDateLabel(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return value;

  const date = new Date(year, month - 1, day);
  const dateLabel = new Intl.DateTimeFormat("nl-NL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);

  return `Week ${isoWeekNumber(date)} ${dateLabel}`;
}

function formatCurrency(value: number) {
  return `EUR ${Math.round(value).toLocaleString("nl-NL")}`;
}

function formatCompactNumber(value: number) {
  return Math.round(value).toLocaleString("nl-NL");
}

function formatReceiptMoney(value: number) {
  return `€ ${value.toLocaleString("nl-NL", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
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
        `Feesttaart ${formatCompactNumber(
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

function pickupAbbreviationForKey(key: string) {
  if (key === "heyendaalseweg") return "HEY";
  if (key === "daalseweg") return "DAAL";
  if (key === "ziekerstraat") return "ZIEK";
  if (key === "lent") return "LENT";

  return "";
}

function receiptToneFor(receipt: ReceiptSummary): ReceiptTone {
  if (receiptFulfillment(receipt) === "bezorgen") return "delivery";

  const shopKey = shopKeyForText(pickupLocationFor(receipt)) || shopKeyForReceipt(receipt);
  if (
    shopKey === "heyendaalseweg" ||
    shopKey === "daalseweg" ||
    shopKey === "ziekerstraat" ||
    shopKey === "lent"
  ) {
    return shopKey;
  }

  return "neutral";
}

function receiptToneForFilter(filter: OrdersFilter): ReceiptTone {
  if (filter === "delivery") return "delivery";
  if (filter === "pickup-heyendaalseweg") return "heyendaalseweg";
  if (filter === "pickup-daalseweg") return "daalseweg";
  if (filter === "pickup-ziekerstraat") return "ziekerstraat";
  if (filter === "pickup-lent") return "lent";

  return "neutral";
}

function receiptToneBadgeClasses(tone: ReceiptTone) {
  if (tone === "lent") return "border-[#8fbc8c] bg-[#eef8ed] text-[#285631]";
  if (tone === "heyendaalseweg") {
    return "border-[#e5cf68] bg-[#fff7cf] text-[#685711]";
  }
  if (tone === "ziekerstraat") {
    return "border-[#eeaaa3] bg-[#fff0ef] text-[#82352f]";
  }
  if (tone === "daalseweg") {
    return "border-[#8dbde9] bg-[#eef7ff] text-[#1b517c]";
  }
  if (tone === "delivery") {
    return "border-[#c8c3bb] bg-[#f2f1ee] text-[#4f4a44]";
  }

  return "border-[#1a1815] bg-[#1a1815] text-white";
}

function receiptFilterClasses(tone: ReceiptTone, active: boolean) {
  if (active) {
    if (tone === "neutral") return "border-[#1a1815] bg-[#1a1815] text-white";
    if (tone === "lent") return "border-[#4f8d55] bg-[#4f8d55] text-white";
    if (tone === "heyendaalseweg") {
      return "border-[#d6bd3e] bg-[#fff0a7] text-[#1a1815]";
    }
    if (tone === "ziekerstraat") return "border-[#d4695f] bg-[#d4695f] text-white";
    if (tone === "daalseweg") return "border-[#4f95d2] bg-[#4f95d2] text-white";

    return "border-[#8a8580] bg-[#8a8580] text-white";
  }

  return receiptToneBadgeClasses(tone);
}

function receiptAccentClasses(tone: ReceiptTone) {
  if (tone === "lent") return "border-l-[#8fbc8c] bg-[#fbfffb]";
  if (tone === "heyendaalseweg") return "border-l-[#e5cf68] bg-[#fffdf5]";
  if (tone === "ziekerstraat") return "border-l-[#eeaaa3] bg-[#fffafa]";
  if (tone === "daalseweg") return "border-l-[#8dbde9] bg-[#fbfdff]";
  if (tone === "delivery") return "border-l-[#c8c3bb] bg-[#fbfaf8]";

  return "border-l-[#1a1815]";
}

function receiptLocationBadge(receipt: ReceiptSummary) {
  if (receiptFulfillment(receipt) === "bezorgen") return "BEZ";

  const shopKey = shopKeyForText(pickupLocationFor(receipt)) || shopKeyForReceipt(receipt);
  return pickupAbbreviationForKey(shopKey) || "CHK";
}

function timeLooksLikePhotoTimestamp(receipt: ReceiptSummary, time: string) {
  if (!/^\d{1,2}:\d{2}$/.test(time)) return false;

  const dotted = time.replace(":", ".");
  const haystack = [
    receipt.id,
    receipt.receiptNumber,
    receipt.customer,
    receipt.note,
    receipt.customerNote,
    receipt.internalNote,
    receipt.lines
      .map((line) => `${line.description} ${line.note || ""}`)
      .join(" "),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return /\.(?:jpe?g|png|webp)\b/i.test(haystack) && haystack.includes(dotted);
}

function hasValidClockTimes(value: string) {
  const matches = [...value.matchAll(/\b(\d{1,2}):(\d{2})\b/g)];
  if (!matches.length) return false;

  return matches.every((match) => {
    const hour = Number(match[1]);
    const minute = Number(match[2]);

    return (
      Number.isInteger(hour) &&
      Number.isInteger(minute) &&
      hour >= 0 &&
      hour <= 23 &&
      minute >= 0 &&
      minute <= 59
    );
  });
}

function receiptOperationalTime(receipt: ReceiptSummary) {
  const time = receipt.time.trim();
  if (!time || /^geen tijd$/i.test(time)) return "";
  if (timeLooksLikePhotoTimestamp(receipt, time)) return "";
  if (!hasValidClockTimes(time)) return "";

  return time;
}

function receiptListTimeLabel(receipt: ReceiptSummary) {
  const time = receiptOperationalTime(receipt);
  if (!time) return "";

  const matches = [...time.matchAll(/\b(\d{1,2}):(\d{2})\b/g)];
  if (matches.length >= 2) {
    const first = matches[0];
    const last = matches.at(-1);

    return last
      ? `${first[1].padStart(2, "0")}:${first[2]}-${last[1].padStart(2, "0")}:${last[2]}`
      : time;
  }

  return time;
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
    .filter(
      (word) =>
        word.length >= 4 &&
        !/^\d+$/.test(word) &&
        !["strik", "patisserie"].includes(word)
    );
}

function hasNormalizedWord(text: string, word: string) {
  const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  return new RegExp(`(?:^| )${escapedWord}(?: |$)`).test(text);
}

function imageProductWords(image: WebshopImageSummary) {
  const genericWords = new Set([
    "afbeelding",
    "bestand",
    "bestelling",
    "foto",
    "image",
    "photo",
    "plaatje",
    "png",
    "jpeg",
    "jpg",
    "webp",
    "whatsapp",
    "webshop",
  ]);
  const words = [
    ...significantWords(image.fileName.replace(/\.[^.]+$/, "")),
    ...significantWords(image.productSummary || ""),
    ...significantWords(image.subject),
  ];

  return Array.from(new Set(words.filter((word) => !genericWords.has(word))));
}

function receiptPhotoMatchText(receipt: ReceiptSummary) {
  return normalizeMatchText(
    [
      receipt.id,
      receipt.receiptNumber,
      receipt.customer,
      receipt.note,
      receipt.customerNote,
      receipt.internalNote,
      receipt.lines
        .map((line) => `${line.description} ${line.note || ""}`)
        .join(" "),
    ]
      .filter(Boolean)
      .join(" ")
  );
}

function receiptProductMatchText(receipt: ReceiptSummary) {
  return normalizeMatchText(
    receipt.lines
      .map((line) => `${line.quantity} ${line.description} ${line.note || ""}`)
      .join(" ")
  );
}

function imageFileBaseMatchText(image: WebshopImageSummary) {
  return normalizeMatchText(image.fileName.replace(/\.[^.]+$/, ""));
}

function isStoreReceiptCustomer(receipt: ReceiptSummary) {
  return ["daalseweg", "heyendaalseweg", "lent", "ziekerstraat"].includes(
    normalizeMatchText(receipt.customer)
  );
}

function customerMatchesReceipt(
  image: WebshopImageSummary,
  receipt: ReceiptSummary,
  haystack: string
) {
  if (isStoreReceiptCustomer(receipt)) return false;

  const imageName = normalizeMatchText(image.customerName);
  const receiptName = normalizeMatchText(receipt.customer);
  const imageLastName = normalizeMatchText(customerLastNameFor(image.customerName));
  const receiptLastName = normalizeMatchText(customerLastNameFor(receipt.customer));

  if (!imageName || !receiptName) return false;

  if (imageLastName.length >= 4 && hasNormalizedWord(haystack, imageLastName)) {
    return true;
  }

  if (
    receiptLastName.length >= 4 &&
    hasNormalizedWord(imageName, receiptLastName)
  ) {
    return true;
  }

  const imageNameWords = significantWords(image.customerName);
  return (
    imageNameWords.length > 0 &&
    imageNameWords.every((word) => hasNormalizedWord(receiptName, word))
  );
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

  const haystack = receiptPhotoMatchText(receipt);
  const orderNumber = normalizeMatchText(image.orderNumber);
  if (orderNumber && hasNormalizedWord(haystack, orderNumber)) {
    return true;
  }

  const fileBase = imageFileBaseMatchText(image);
  if (fileBase.length >= 10 && haystack.includes(fileBase)) {
    return true;
  }

  const hasCustomerMatch = customerMatchesReceipt(image, receipt, haystack);
  if (!hasCustomerMatch) return false;

  const receiptProductText = receiptProductMatchText(receipt);
  const productWords = imageProductWords(image);
  const productOverlap = productWords.filter((word) =>
    hasNormalizedWord(receiptProductText, word)
  ).length;

  return (
    productWords.length === 0 ||
    productOverlap > 0 ||
    image.confidence === "hoog"
  );
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

function isProductOptionLine(line: ReceiptLine) {
  const description = normalizedLineDescription(line.description);

  return /^(?:ja,\s*)?(?:kleur\b|foto\s*\/\s*logo\b|foto\b|logo\b|tekst\b|vulling\b|voorsnijden\b)/.test(
    description
  );
}

function productOptionKind(value: string) {
  const description = normalizedLineDescription(value);

  if (/^kleur\b/.test(description)) return "kleur";
  if (/^(?:foto\s*\/\s*logo|foto|logo)\b/.test(description)) return "foto";
  if (/^tekst\b/.test(description)) return "tekst";
  if (/^vulling\b/.test(description)) return "vulling";
  if (/^voorsnijden\b/.test(description)) return "voorsnijden";

  return "overig";
}

function normalizedProductOptionDescription(value: string) {
  return normalizedLineDescription(value)
    .replace(/^ja,\s*/, "")
    .replace(/\s+\d+(?:[.,]\d+)?$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function productOptionQuantityScore(quantity: string) {
  const value = numericQuantity(quantity);

  if (!Number.isFinite(value) || value <= 0) return 0;
  if (/[,.]\d/.test(quantity) && value > 1) return 0;
  if (value >= 1 && value <= 300) return 2;

  return 1;
}

function normalizeProductOptionQuantity(line: ReceiptLine, fallbackQuantity: string) {
  const kind = productOptionKind(line.description);

  if (kind === "tekst" || kind === "vulling" || kind === "voorsnijden") {
    return fallbackQuantity || "1";
  }
  if (/[,.]\d/.test(line.quantity) && numericQuantity(line.quantity) > 1) {
    return fallbackQuantity || "1";
  }

  return line.quantity;
}

function cleanProductOptionCandidate(value: string) {
  let clean = value.replace(/\s+/g, " ").trim();
  if (!clean) return "";

  const optionIndex = clean.search(
    /\b(?:kleur\s+petit\s*fours?|foto\s*\/\s*logo|foto|logo|tekst|vulling|voorsnijden)\s*:?/i
  );

  if (optionIndex > 0) {
    const prefix = clean.slice(0, optionIndex).trim();
    const suffix = clean.slice(optionIndex).trim();
    const prefixLooksLikePriceNoise =
      /^(?:€?\s*\d+[.,]\d{2,3}\s*)+$/.test(prefix);
    const prefixLooksLikeShortNoise =
      /^\d{1,2}$/.test(prefix) && /\s+\d+(?:[.,]\d+)?\s*$/.test(suffix);

    if (prefixLooksLikePriceNoise || prefixLooksLikeShortNoise) {
      clean = suffix;
    }
  }

  return clean;
}

function isPriceOnlyReceiptDescription(value: string) {
  const description = normalizedLineDescription(value).replace(/^eur\s+/, "€ ");

  return /^€?\s*[\d.,:]*\s*€?$/.test(description) && /[€\d]/.test(description);
}

function parseReceiptMoneyText(value: string) {
  const clean = value
    .replace(/(\d):(\d{2})(?!\d)/g, "$1,$2")
    .replace(/[^\d,.-]/g, "")
    .trim();
  if (!clean) return undefined;

  const normalized = clean.includes(",")
    ? clean.replace(/\./g, "").replace(",", ".")
    : clean;
  const number = Number.parseFloat(normalized);

  return Number.isFinite(number) ? number : undefined;
}

function cleanReceiptLineDescription(value: string) {
  return cleanProductOptionCandidate(value)
    .replace(
      /\s+€\s*[\d.,:]+(?:\s+€\s*[\d.,:]+|\s+\d+(?:[.,]\d+)?)*.*$/i,
      ""
    )
    .replace(/trial mode\s*[–-]\s*click here for more information/gi, "")
    .replace(/\btrial mode\b\s*[–-]?/gi, "")
    .replace(/click here for more information/gi, "")
    .replace(/^€\s*$/g, "")
    .replace(/\s+(?:€\s*)?[\d.,:]+\s*$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function textOptionContinuationFromNote(value: string, quantity: string) {
  const clean = value
    .replace(/trial mode\s*[–-]\s*click here for more information/gi, "")
    .replace(/\btrial mode\b\s*[–-]?/gi, "")
    .replace(/click here for more information/gi, "")
    .replace(/(?:€\s*)?[\d.,:]+\s*€/g, " ")
    .replace(/€\s*[\d.,:]+/g, " ")
    .replace(/&euro;\s*[\d.,:]+/g, " ")
    .replace(/\b(?:niet\s+)?betaald\s*!+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  const quantityText = quantity.replace(/[^\d]/g, "");
  const explicit = clean.match(/\b(\d{1,2}\s+jaar!?)\b/i);
  if (explicit) return explicit[1];
  if (quantityText && quantityText !== "1" && /\bjaar!?/i.test(clean)) {
    return `${quantityText} jaar!`;
  }

  return "";
}

function receiptTextContinuationSource(receipt: ReceiptSummary) {
  return [
    receipt.customerNote,
    receipt.note,
    receipt.internalNote,
    ...receipt.lines.map((line) =>
      [line.quantity, line.description, line.note || ""].filter(Boolean).join(" ")
    ),
  ]
    .filter(Boolean)
    .join(" ");
}

function repairTextOptionContinuations(lines: ReceiptLine[], receipt: ReceiptSummary) {
  const sourceText = receiptTextContinuationSource(receipt);

  lines.forEach((line) => {
    if (
      productOptionKind(line.description) !== "tekst" ||
      /\bjaar\b/i.test(line.description)
    ) {
      return;
    }

    const continuation = textOptionContinuationFromNote(sourceText, line.quantity);
    if (continuation) {
      line.description = `${line.description} ${continuation}`;
    }

    line.quantity = "1";
  });
}

function receiptLineIdentity(line: ReceiptLine) {
  return `${line.quantity}|${normalizedLineDescription(line.description)}`;
}

function pushUniqueReceiptLine(target: ReceiptLine[], line: ReceiptLine) {
  if (isProductOptionLine(line)) {
    const optionKey = normalizedProductOptionDescription(line.description);
    const existingOption = target.find(
      (item) =>
        isProductOptionLine(item) &&
        normalizedProductOptionDescription(item.description) === optionKey
    );

    if (existingOption) {
      const existingScore = productOptionQuantityScore(existingOption.quantity);
      const lineScore = productOptionQuantityScore(line.quantity);

      if (lineScore > existingScore) {
        existingOption.quantity = line.quantity;
      }
      if (
        line.description.length > existingOption.description.length &&
        !existingOption.description
          .toLowerCase()
          .includes(line.description.toLowerCase())
      ) {
        existingOption.description = line.description;
      }
      if (existingOption.unitPrice === undefined && line.unitPrice !== undefined) {
        existingOption.unitPrice = line.unitPrice;
      }

      return;
    }
  }

  const identity = receiptLineIdentity(line);
  const exists = target.some((item) => {
    const itemIdentity = receiptLineIdentity(item);
    const itemDescription = normalizedLineDescription(item.description);
    const lineDescription = normalizedLineDescription(line.description);

    return (
      itemIdentity === identity ||
      (item.quantity === line.quantity &&
        (itemDescription.includes(lineDescription) ||
          lineDescription.includes(itemDescription)))
    );
  });

  if (!exists) target.push(line);
}

function recoveredReceiptLinesFromNote(value: string) {
  const lines: ReceiptLine[] = [];
  const patterns = [
    /\b(?:(\d+(?:[.,]\d+)?)\s+)?((?:strik's\s+)?(?:marsepeintaart|slagroomtaart|cremetaart)[^€]{4,180})\s+€\s*([\d.,:]+)/gi,
    /\b(?:(\d+(?:[.,]\d+)?)\s+)?((?:petit\s+four)[^€]{4,180})\s+€\s*([\d.,:]+)/gi,
    /\b(?:(\d+(?:[.,]\d+)?)\s+)?((?:kleur\s+petit\s*fours?|foto\s*\/\s*logo|foto|logo|tekst|vulling|voorsnijden)\s*:?\s*[^€]{1,180})\s+€\s*([\d.,:]+)/gi,
    /(?:€\s*[\d.,:]+\s+)+((?:kleur\s+petit\s*fours?|foto\s*\/\s*logo|foto|logo|tekst|vulling|voorsnijden)\s*:?\s*.+?)\s+(\d+(?:[.,]\d+)?)\b/gi,
  ];

  patterns.slice(0, 3).forEach((pattern) => {
    for (const match of value.matchAll(pattern)) {
      const description = cleanReceiptLineDescription(match[2] || "");
      if (!description || isPriceOnlyReceiptDescription(description)) continue;

      pushUniqueReceiptLine(lines, {
        quantity: (match[1] || "1").replace(".", ","),
        description,
        ...(parseReceiptMoneyText(match[3] || "") !== undefined
          ? { unitPrice: parseReceiptMoneyText(match[3] || "") }
          : {}),
      });
    }
  });
  for (const match of value.matchAll(patterns[3])) {
    const description = cleanReceiptLineDescription(match[1] || "");
    if (!description || isPriceOnlyReceiptDescription(description)) continue;

    pushUniqueReceiptLine(lines, {
      quantity: (match[2] || "1").replace(".", ","),
      description,
    });
  }

  return lines;
}

function normalizeImportedReceiptLines(receipt: ReceiptSummary) {
  const lines: ReceiptLine[] = [];
  let fallbackQuantity = "1";
  const sourceText = receiptTextContinuationSource(receipt);

  recoveredReceiptLinesFromNote(receipt.customerNote || "").forEach((line) =>
    pushUniqueReceiptLine(lines, line)
  );

  receipt.lines.forEach((line) => {
    const description = cleanReceiptLineDescription(line.description);
    const note = line.note ? cleanReceiptLineDescription(line.note) : "";

    if (
      isPriceOnlyReceiptDescription(line.description) ||
      isPriceOnlyReceiptDescription(description) ||
      (!description && note && isProductOptionLine({ quantity: line.quantity, description: note }))
    ) {
      if (note && isProductOptionLine({ quantity: line.quantity, description: note })) {
        const optionLine: ReceiptLine = {
          quantity: line.quantity,
          description: note,
          ...(line.unitPrice !== undefined ? { unitPrice: line.unitPrice } : {}),
        };

        optionLine.quantity = normalizeProductOptionQuantity(optionLine, fallbackQuantity);
        pushUniqueReceiptLine(lines, optionLine);
      }
      return;
    }

    if (!description) return;

    const normalizedLine: ReceiptLine = {
      ...line,
      description,
      ...(note && note !== description ? { note } : { note: undefined }),
    };

    if (isProductOptionLine(normalizedLine)) {
      const kind = productOptionKind(normalizedLine.description);
      if (
        kind === "tekst" &&
        /^[\d.,]+$/.test(normalizedLine.quantity) &&
        !/\bjaar\b/i.test(normalizedLine.description)
      ) {
        const continuation = textOptionContinuationFromNote(
          sourceText,
          normalizedLine.quantity
        );

        if (continuation) {
          normalizedLine.description = `${normalizedLine.description} ${continuation}`;
        }
      }
      normalizedLine.quantity = normalizeProductOptionQuantity(
        normalizedLine,
        fallbackQuantity
      );
    } else {
      fallbackQuantity = normalizedLine.quantity || fallbackQuantity;
    }

    pushUniqueReceiptLine(lines, normalizedLine);
  });

  repairTextOptionContinuations(lines, receipt);

  return lines;
}

function normalizeImportedReceipt(receipt: ReceiptSummary): ReceiptSummary {
  const lines = normalizeImportedReceiptLines(receipt);
  const customerNote = cleanReceiptDisplayNote(receipt.customerNote || "", lines);

  return {
    ...receipt,
    customerNote: customerNote || "Geen aparte opmerking.",
    lines,
  };
}

function isAssortedPastryLine(line: ReceiptLine) {
  if (isProductOptionLine(line)) return false;

  const description = normalizedLineDescription(line.description);

  return /\bgesorteerd\b.*\bgebak\b/.test(description);
}

function isPetitFourLine(line: ReceiptLine) {
  if (isProductOptionLine(line)) return false;

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
  if (isProductOptionLine(line)) return false;

  const description = lineSearchDescription(line);
  const isCake =
    (/\bmarsepein/.test(description) && /taart(?:en)?\b/.test(description)) ||
    (/\bslagroom/.test(description) && /taart(?:en)?\b/.test(description));

  return isCake && hasLargeCakeSize(description);
}

function isLikelyCakePhotoLine(line: ReceiptLine) {
  if (isProductOptionLine(line)) return false;

  const description = lineSearchDescription(line);

  if (isMarzipanOrCreamCakeLine(line)) return true;
  if (isPetitFourLine(line) || isAssortedPastryLine(line)) return false;
  if (/\b(cupcake|cakepop|macaron|soes|slof|vlaai|gebak)\b/.test(description)) {
    return false;
  }

  return /\b(foto\s*taart|fototaart|plaatjes\s*taart|plaatjestaart|marsepein|slagroom|taart(?:en)?|kindertaart)\b/.test(
    description
  );
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
        sizeCm: 3.5,
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

function inferredPhotoProductPlansForReceipt(
  receipt: ReceiptSummary
): PhotoProductPlan[] {
  const plans: PhotoProductPlan[] = [];

  receipt.lines.forEach((line) => {
    if (!isLikelyCakePhotoLine(line)) return;

    const description = lineSearchDescription(line);
    const isCertainCakeLine = isMarzipanOrCreamCakeLine(line);

    plans.push({
      product: cleanProductLabel(line.description),
      shape: "round",
      sizeCm: 12,
      copies: printCopiesForLine(line),
      needsCheck: !isCertainCakeLine && !hasLargeCakeSize(description),
    });
  });

  return plans.slice(0, 4);
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
  const strictProductPlans = photoProductPlansForReceipt(input.receipt);
  const productPlans =
    strictProductPlans.length > 0
      ? strictProductPlans
      : inferredPhotoProductPlansForReceipt(input.receipt);

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
    matchedImages.forEach((image) => claimedImageIds.add(image.id));
  });

  const unclaimedImages = webshopImages.filter(
    (image) => !claimedImageIds.has(image.id)
  );

  unclaimedImages.forEach((image, imageIndex) => {
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
  return item.shape === "square" ? "ca. 3,8 cm vierkant" : "12 cm rond";
}

function createMarzipanPhotoPrintHtml(input: {
  items: MarzipanPrintItem[];
  plan: DayPlan;
}) {
  const title = `Marsepeinfoto's ${formatDateLabel(input.plan.date)}`;
  const squareGroups: {
    key: string;
    labelItem: MarzipanPrintItem;
    items: MarzipanPrintItem[];
  }[] = [];
  const squareGroupByKey = new Map<string, (typeof squareGroups)[number]>();
  const roundItems: MarzipanPrintItem[] = [];

  const labelKeyFor = (item: MarzipanPrintItem) =>
    [
      item.receiptNumber,
      item.orderNumber,
      item.customerLastName,
      item.product,
      item.shape,
      item.photoUrl,
    ].join("|");

  input.items.forEach((item) => {
    if (item.shape !== "square") {
      roundItems.push(item);
      return;
    }

    const labelKey = labelKeyFor(item);
    const existingGroup = squareGroupByKey.get(labelKey);
    if (existingGroup) {
      existingGroup.items.push(item);
      return;
    }

    const group = { key: labelKey, labelItem: item, items: [item] };
    squareGroupByKey.set(labelKey, group);
    squareGroups.push(group);
  });

  const sourceLabelFor = (item: MarzipanPrintItem) =>
    [
      item.receiptNumber ? `bon ${item.receiptNumber}` : "",
      item.orderNumber ? `order ${item.orderNumber}` : "",
      item.needsCheck ? "check" : "",
    ]
      .filter(Boolean)
      .join(" · ");

  const printItemHtmlFor = (item: MarzipanPrintItem, includeLabel = false) => {
    const copyLabel = item.copyTotal > 1 ? ` · ${item.copyTotal}x totaal` : "";
    const sourceLabel = sourceLabelFor(item);

    return `
      <article class="print-item ${item.shape} ${includeLabel ? "" : "no-label"} ${item.needsCheck ? "needs-check" : ""}" style="--item-size:${item.sizeCm}cm">
        <div class="photo-frame">
          <img src="${escapeAttribute(item.photoUrl)}" alt="${escapeAttribute(item.customerName)}">
        </div>
        ${
          includeLabel
            ? `<div class="label">
                <strong>${escapeHtml(item.customerLastName)}</strong>
                <span>${escapeHtml(item.product)}</span>
                <small>${escapeHtml(marzipanPrintSizeLabel(item))}${escapeHtml(copyLabel)}</small>
                ${sourceLabel ? `<small>${escapeHtml(sourceLabel)}</small>` : ""}
              </div>`
            : ""
        }
      </article>
    `;
  };

  const squareHtml = squareGroups
    .map((group) => {
      return `
        <section class="square-group">
          <div class="square-group-label">
            <strong>${escapeHtml(group.labelItem.customerLastName)}</strong>
          </div>
          <div class="square-grid">
            ${group.items.map((item) => printItemHtmlFor(item)).join("")}
          </div>
        </section>
      `;
    })
    .join("");
  const roundHtml =
    roundItems.length > 0
      ? `<section class="round-grid">
          ${roundItems.map((item) => printItemHtmlFor(item, true)).join("")}
        </section>`
      : "";
  const itemHtml = `${squareHtml}${roundHtml}`;

  return `<!doctype html>
<html lang="nl">
  <head>
    <meta charset="utf-8">
    <title>${escapeHtml(title)}</title>
    <style>
      @page { margin: 8mm 10mm 60mm 10mm; size: A4 portrait; }
      * { box-sizing: border-box; }
      :root {
        --petit-four-size: 37.8mm;
      }
      body {
        background: #fff;
        color: #000;
        font-family: Arial, Helvetica, sans-serif;
        margin: 0;
        print-color-adjust: exact;
        -webkit-print-color-adjust: exact;
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
      .screen-actions .action-buttons {
        display: flex;
        gap: 8px;
      }
      .screen-actions .secondary {
        background: #fff;
        border: 1px solid #111;
        color: #111;
      }
      main {
        margin: 0 auto;
        max-width: 210mm;
        padding: 8mm 10mm 60mm;
        width: 100%;
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
        display: block;
      }
      .square-group {
        margin-bottom: 1mm;
      }
      .square-group-label {
        align-items: baseline;
        display: flex;
        font-size: 6px;
        gap: 1mm;
        height: 2.4mm;
        line-height: 1;
        margin: 0 0 0.4mm;
      }
      .square-group-label strong {
        font-size: 6.5px;
      }
      .square-group-label span {
        color: #444;
      }
      .square-grid {
        display: grid;
        gap: 0;
        grid-template-columns: repeat(5, var(--petit-four-size));
        justify-content: start;
        width: 189mm;
      }
      .round-grid {
        align-items: flex-start;
        display: flex;
        flex-wrap: wrap;
        gap: 5mm;
        margin-top: 6mm;
      }
      .print-item {
        break-inside: avoid;
        page-break-inside: avoid;
        position: relative;
        width: var(--item-size);
      }
      .square {
        margin-bottom: 0;
        width: var(--petit-four-size);
      }
      .photo-frame {
        background: #fff;
        border: 0.25mm dashed #888;
        height: var(--item-size);
        overflow: hidden;
        width: var(--item-size);
      }
      .square .photo-frame {
        aspect-ratio: 1 / 1;
        background: #000;
        border: 0;
        box-shadow:
          inset -0.25mm 0 0 #fff,
          inset 0 -0.25mm 0 #fff;
        height: var(--petit-four-size);
        padding: 0;
        width: var(--petit-four-size);
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
      .square .photo-frame img {
        object-fit: contain;
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
        main {
          max-width: none;
          padding: 0;
          width: 190mm;
        }
        .square-grid {
          gap: 0 !important;
          grid-template-columns: repeat(5, 37.8mm) !important;
          width: 189mm !important;
        }
        .square,
        .square .photo-frame {
          height: 37.8mm !important;
          width: 37.8mm !important;
        }
      }
    </style>
  </head>
  <body>
    <div class="screen-actions">
      <h1>${escapeHtml(title)} · ${input.items.length} printstukken</h1>
      <div class="action-buttons">
        <button type="button" class="secondary" onclick="if (window.opener) window.close(); else window.history.back();">Terug</button>
        <button type="button" onclick="window.print()">Afdrukken</button>
      </div>
    </div>
    <main>
      <div class="sheet-header">
        <h1>${escapeHtml(title)}</h1>
        <p>${input.items.length} printstukken · petit four ca. 3,8 cm vierkant · taart 12 cm rond</p>
      </div>
      <section class="sheet">
        ${itemHtml}
      </section>
    </main>
  </body>
</html>`;
}

function openMarzipanPhotoSheet(plan: DayPlan, items: MarzipanPrintItem[]) {
  if (items.length === 0) {
    window.alert("Geen webshopfoto's gevonden voor deze dag.");
    return;
  }

  const printWindow = window.open("", "_blank", "width=1100,height=800");
  if (!printWindow) {
    window.alert("Controlevenster kon niet geopend worden.");
    return;
  }

  printWindow.document.write(createMarzipanPhotoPrintHtml({ items, plan }));
  printWindow.document.close();
  printWindow.focus();
}

function createBusRoutePrintHtml(input: {
  plan: DayPlan;
  routeGroup: RouteGroup;
}) {
  const printableRoutes = input.routeGroup.routes.filter(
    (route) => route.stops.length > 0
  );
  const stopCount = printableRoutes.reduce(
    (total, route) => total + route.stops.length,
    0
  );
  const title = `${input.routeGroup.vehicle} route ${formatDateLabel(
    input.plan.date
  )}`;
  const routesHtml = printableRoutes
    .map((route) => {
      const rowsHtml = route.stops
        .map((stop, index) => {
          const badges = stop.badges.length
            ? `<small class="badges">${escapeHtml(stop.badges.join(" · "))}</small>`
            : "";

          return `
            <tr>
              <td class="check"><span></span></td>
              <td class="nr">${index + 1}</td>
              <td class="stop">
                <strong>${escapeHtml(stop.label)}</strong>
                <small>${escapeHtml(stop.detail)}</small>
                ${badges}
              </td>
              <td class="arrival"></td>
              <td class="note"></td>
            </tr>
          `;
        })
        .join("");

      return `
        <section class="route-block">
          <div class="route-title">
            <div>
              <h2>${escapeHtml(route.title)}</h2>
              <p>${escapeHtml(route.departure)} · ${escapeHtml(route.badge)}</p>
            </div>
            <strong>${escapeHtml(route.load)}</strong>
          </div>
          <div class="depot-line">
            Start: ${escapeHtml(routeDepot.name)} · ${escapeHtml(
              routeDepot.address
            )} <span>Terug naar ${escapeHtml(routeDepot.address)}</span>
          </div>
          <table>
            <thead>
              <tr>
                <th class="check">OK</th>
                <th class="nr">#</th>
                <th>Stop</th>
                <th class="arrival">Aankomst</th>
                <th class="note">Opmerking</th>
              </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
          </table>
        </section>
      `;
    })
    .join("");

  return `<!doctype html>
<html lang="nl">
  <head>
    <meta charset="utf-8">
    <title>${escapeHtml(title)}</title>
    <style>
      @page { margin: 7mm; size: A4 portrait; }
      * { box-sizing: border-box; }
      body {
        background: #f7f4ef;
        color: #111;
        font-family: Arial, Helvetica, sans-serif;
        margin: 0;
        print-color-adjust: exact;
        -webkit-print-color-adjust: exact;
      }
      .screen-actions {
        align-items: center;
        background: #fff;
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
      .screen-actions .action-buttons {
        display: flex;
        gap: 8px;
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
      .screen-actions .secondary {
        background: #fff;
        border: 1px solid #111;
        color: #111;
      }
      main {
        background: #fff;
        margin: 0 auto;
        min-height: 297mm;
        padding: 8mm;
        width: 210mm;
      }
      .sheet-header {
        align-items: flex-start;
        border-bottom: 2px solid #111;
        display: flex;
        justify-content: space-between;
        margin-bottom: 4mm;
        padding-bottom: 3mm;
      }
      .sheet-header h1 {
        font-size: 18px;
        margin: 0;
      }
      .sheet-header p {
        font-size: 10px;
        font-weight: 700;
        margin: 1mm 0 0;
      }
      .driver-fields {
        display: grid;
        gap: 2mm;
        min-width: 62mm;
      }
      .driver-fields span {
        border-bottom: 1px solid #111;
        display: block;
        font-size: 9px;
        font-weight: 700;
        height: 6mm;
        padding-top: 1mm;
      }
      .route-block {
        break-inside: avoid;
        margin-bottom: 4mm;
      }
      .route-title {
        align-items: center;
        background: #f1eee8;
        border: 1px solid #111;
        display: flex;
        justify-content: space-between;
        padding: 1.5mm 2mm;
      }
      .route-title h2 {
        font-size: 12px;
        margin: 0;
        text-transform: uppercase;
      }
      .route-title p,
      .route-title strong {
        font-size: 8px;
        margin: 0.5mm 0 0;
      }
      .depot-line {
        border-left: 1px solid #111;
        border-right: 1px solid #111;
        font-size: 7.5px;
        font-weight: 800;
        padding: 1.2mm 2mm;
      }
      .depot-line span {
        float: right;
      }
      table {
        border-collapse: collapse;
        table-layout: fixed;
        width: 100%;
      }
      th,
      td {
        border: 1px solid #111;
        font-size: 8px;
        padding: 1.2mm;
        text-align: left;
        vertical-align: top;
      }
      th {
        background: #f8f8f8;
        font-size: 7px;
        text-transform: uppercase;
      }
      .check {
        text-align: center;
        width: 9mm;
      }
      .check span {
        border: 1.5px solid #111;
        display: inline-block;
        height: 4mm;
        width: 4mm;
      }
      .nr {
        text-align: center;
        width: 7mm;
      }
      .stop {
        width: auto;
      }
      .stop strong,
      .stop small {
        display: block;
      }
      .stop strong {
        font-size: 8.5px;
      }
      .stop small {
        color: #333;
        font-size: 7px;
        margin-top: 0.5mm;
      }
      .badges {
        font-weight: 700;
      }
      .arrival {
        width: 22mm;
      }
      .note {
        width: 38mm;
      }
      .general-notes {
        border: 1px solid #111;
        margin-top: 3mm;
        min-height: 28mm;
        padding: 2mm;
      }
      .general-notes h2 {
        font-size: 10px;
        margin: 0 0 2mm;
        text-transform: uppercase;
      }
      .general-notes div {
        border-bottom: 1px solid #888;
        height: 6mm;
      }
      @media print {
        body { background: #fff; }
        .screen-actions { display: none; }
        main {
          min-height: auto;
          padding: 0;
          width: auto;
        }
      }
    </style>
  </head>
  <body>
    <div class="screen-actions">
      <h1>${escapeHtml(title)} · ${stopCount} stops</h1>
      <div class="action-buttons">
        <button type="button" class="secondary" onclick="if (window.opener) window.close(); else window.history.back();">Terug</button>
        <button type="button" onclick="window.print()">Afdrukken</button>
      </div>
    </div>
    <main>
      <header class="sheet-header">
        <div>
          <h1>${escapeHtml(title)}</h1>
          <p>${escapeHtml(input.plan.title)} · ${escapeHtml(
            input.plan.status
          )} · ${stopCount} stops</p>
          <p>Start/eind: ${escapeHtml(routeDepot.address)}</p>
        </div>
        <div class="driver-fields">
          <span>Chauffeur</span>
          <span>Vertrek</span>
          <span>Terug</span>
        </div>
      </header>
      ${routesHtml}
      <section class="general-notes">
        <h2>Algemene opmerkingen</h2>
        <div></div>
        <div></div>
        <div></div>
      </section>
    </main>
  </body>
</html>`;
}

function openBusRouteSheet(plan: DayPlan, routeGroup: RouteGroup) {
  if (!routeGroup.routes.some((route) => route.stops.length > 0)) {
    window.alert("Geen routes gevonden voor deze bus.");
    return;
  }

  const printWindow = window.open("", "_blank", "width=950,height=800");
  if (!printWindow) {
    window.alert("Routevenster kon niet geopend worden.");
    return;
  }

  printWindow.document.write(createBusRoutePrintHtml({ plan, routeGroup }));
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

function shopKeyForText(value: string): ShopKey | "" {
  const text = value.toLowerCase();
  if (text.includes("heyendaalseweg") || text.includes("heyendaal")) {
    return "heyendaalseweg";
  }
  if (text.includes("daalseweg")) return "daalseweg";
  if (text.includes("ziekerstraat")) return "ziekerstraat";
  if (text.includes("lent")) return "lent";

  return "";
}

function shopKeyForReceipt(receipt: ReceiptSummary): ShopKey | "" {
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
  const meta = shopRouteMeta[key as ShopKey];
  if (meta) return meta.label;

  return "Winkel";
}

function routeDeadlineMinutes(receipt: ReceiptSummary) {
  const time = receiptOperationalTime(receipt);
  const matches = [...time.matchAll(/\b(\d{1,2}):(\d{2})\b/g)];
  const deadline = matches.at(-1);
  if (!deadline) return 9999;

  return Number(deadline[1]) * 60 + Number(deadline[2]);
}

function routeTimeLabel(receipt: ReceiptSummary) {
  const time = receiptOperationalTime(receipt);
  if (!time) return "tijd check";

  const matches = [...time.matchAll(/\b(\d{1,2}):(\d{2})\b/g)];
  if (matches.length >= 2) {
    const deadline = matches.at(-1);

    return deadline ? `voor ${deadline[1].padStart(2, "0")}:${deadline[2]}` : time;
  }

  return time;
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
    isPriorityEarlyDelivery(receipt) ||
    (receipt.tags.includes("zorg") && !isFlexibleLateDelivery(receipt)) ||
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
  if (isPriorityEarlyDelivery(receipt)) badges.push("vroeg");
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
    sourceId: `receipt:${receipt.id}`,
    label: receipt.customer,
    detail: `${time} · ${target}`,
    badges: receiptStopBadges(receipt),
  };
}

function groupShopStops(
  receipts: ReceiptSummary[],
  shopKeys: ShopKey[],
  pairedIceReceipts: ReceiptSummary[]
): RouteStop[] {
  return shopKeys
    .map((shopKey) => {
      const shopMeta = shopRouteMeta[shopKey];
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
      const pastryUnits = shopReceipts.reduce(
        (total, receipt) => total + receiptPastryUnits(receipt),
        0
      );

      const detailParts = [shopMeta.address];
      if (shopReceipts.length) detailParts.push(`${shopReceipts.length} winkelbon`);
      if (pastryUnits) detailParts.push(`${formatCompactNumber(pastryUnits)} gebak/taart`);
      if (pickupReceipts.length) detailParts.push(`${pickupReceipts.length} afhaal`);
      if (iceTubs) detailParts.push(`${iceTubs} ijs / ${Math.ceil(iceTubs / 3)} tempex`);
      if (!shopReceipts.length && !pickupReceipts.length && !iceTubs) {
        detailParts.push("vaste winkelstop");
      }

      return {
        id: `shop-${shopKey}`,
        sourceId: `shop:${shopKey}`,
        label: shopMeta.label,
        detail: detailParts.join(" · "),
        badges: [
          "winkel",
          ...(pastryUnits >= 80 || shopReceipts.length >= 2 ? ["druk"] : []),
        ],
      };
    })
    .filter((stop): stop is RouteStop => Boolean(stop));
}

function busForShopKey(key: string): BusId | "" {
  if (key === "heyendaalseweg" || key === "daalseweg") return "A";
  if (key === "ziekerstraat" || key === "lent") return "B";

  return "";
}

function isCenterRouteText(text: string) {
  const normalizedText = normalizeMatchText(text);

  return /(?:^| )(centrum|credible|restaurant steven|hertogstraat|grote markt|plein 1944|marienburg|molenstraat|burchtstraat|broerstraat|koningstraat|houtstraat|waalkade|kelfkensbos|ganzenheuvel|augustijnenstraat|van welderenstraat|in de betouwstraat|lange hezelstraat|stikke hezelstraat|bloemerstraat|smetiusstraat|oranjesingel|oranje singel|keizer karelplein)(?: |$)/.test(
    normalizedText
  );
}

function preferredBusForReceipt(receipt: ReceiptSummary): BusId | "" {
  const text = receiptSearchText(receipt);
  if (isCenterRouteText(text)) return "B";

  const clusterKey = outsideClusterKeyForReceipt(receipt);
  if (
    clusterKey === "molenhoek-groesbeek" ||
    clusterKey === "berg-en-dal" ||
    clusterKey === "oost-buiten"
  ) {
    return "A";
  }
  if (
    clusterKey === "jonkerbos" ||
    clusterKey === "west-buiten" ||
    clusterKey === "noord-buiten"
  ) {
    return "B";
  }

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
  const normalizedText = normalizeMatchText(text);

  if (/jonkerbos|sanadome|cwz|goffert|crematorium/.test(text)) {
    return "jonkerbos";
  }
  if (/thermen|berendonck|wijchen|beuningen/.test(text)) {
    return "west-buiten";
  }
  if (
    /(?:^| )(jachtslot|mookerheide|molenhoek|heumensebaan|groesbeek|hopmans|hoge horst)(?: |$)/.test(
      normalizedText
    )
  ) {
    return "molenhoek-groesbeek";
  }
  if (/berg en dal|oude kleefsebaan|beek|ubbergen/.test(text)) {
    return "berg-en-dal";
  }
  if (/malden|heumen/.test(text)) {
    return "oost-buiten";
  }
  if (/gendt|huigensstraat|bemmel|elst|arnhem|oosterhout/.test(text)) {
    return "noord-buiten";
  }

  return "";
}

function weekdayForIsoDate(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  if (!year || !month || !day) return -1;

  return new Date(year, month - 1, day).getDay();
}

function isMondayOrThursday(date: string) {
  const weekday = weekdayForIsoDate(date);

  return weekday === 1 || weekday === 4;
}

function routeDistance(first: RoutePoint, second: RoutePoint) {
  return Math.hypot(first.x - second.x, first.y - second.y);
}

function routePointForShopKey(shopKey: ShopKey | "") {
  if (!shopKey) return null;

  return shopRouteMeta[shopKey].point;
}

function receiptRoutePoint(receipt: ReceiptSummary): RoutePoint {
  const shopPoint = routePointForShopKey(shopKeyForReceipt(receipt));
  if (shopPoint) return shopPoint;

  const text = normalizeMatchText(receiptSearchText(receipt));

  if (/dries|elst/.test(text)) return { x: -0.2, y: 8.1 };
  if (/gendt|huigensstraat|bemmel|arnhem/.test(text)) return { x: 1.1, y: 8.8 };
  if (/lent|oosterhout/.test(text)) return { x: 0.1, y: 5.9 };
  if (/credible|restaurant steven|centrum|hertogstraat|grote markt|waalkade/.test(text)) {
    return { x: -0.1, y: 3.7 };
  }
  if (/ziekerstraat|molenstraat|burchtstraat|marienburg|plein 1944/.test(text)) {
    return { x: -0.1, y: 3.4 };
  }
  if (/radboud|vermaat|umc|kapittelweg|geert groote|heyendaal/.test(text)) {
    return { x: 0.8, y: 2.7 };
  }
  if (/maartenskliniek|sint maartens|berg en dal|beek|ubbergen|oude kleefsebaan/.test(text)) {
    return { x: 1.7, y: 3.8 };
  }
  if (/sanadome|jonkerbos|cwz|goffert/.test(text)) return { x: -0.8, y: 2.1 };
  if (/jachtslot|mookerheide|molenhoek|heumensebaan/.test(text)) {
    return { x: 0.8, y: -1.0 };
  }
  if (/groesbeek|hopmans|hoge horst/.test(text)) return { x: 2.2, y: 1.4 };
  if (/gennep|cuijk|ottersum|heijen/.test(text)) return { x: 3.4, y: -7.2 };
  if (/malden|heumen/.test(text)) return { x: 0.2, y: 0.3 };
  if (/wijchen|beuningen|berendonck|thermen/.test(text)) {
    return { x: -2.5, y: 2.0 };
  }

  return { x: 0.4, y: 3.0 };
}

function isRadboudReceipt(receipt: ReceiptSummary) {
  return /radboud|vermaat|umc|kapittelweg|geert groote/i.test(
    receiptSearchText(receipt)
  );
}

function isSintMaartenskliniekReceipt(receipt: ReceiptSummary) {
  return /maartenskliniek|sint\s+maartens/i.test(receiptSearchText(receipt));
}

function isDriesElstReceipt(receipt: ReceiptSummary) {
  return /dries\s*(?:en|&)\s*co|dries|elst/i.test(receiptSearchText(receipt));
}

function isSanadomeReceipt(receipt: ReceiptSummary) {
  return /sanadome/i.test(receiptSearchText(receipt));
}

function isGennepRouteReceipt(receipt: ReceiptSummary) {
  return /gennep|cuijk|ottersum|heijen/i.test(receiptSearchText(receipt));
}

function isPriorityEarlyDelivery(receipt: ReceiptSummary) {
  const deadline = routeDeadlineMinutes(receipt);

  return (
    hasExplicitEarlyInstruction(receipt) ||
    deadline < 600 ||
    isRadboudReceipt(receipt) ||
    isSintMaartenskliniekReceipt(receipt) ||
    isDriesElstReceipt(receipt)
  );
}

function isFlexibleLateDelivery(receipt: ReceiptSummary, date = "") {
  const deadline = routeDeadlineMinutes(receipt);

  return (
    isSanadomeReceipt(receipt) ||
    (isGennepRouteReceipt(receipt) && (!date || isMondayOrThursday(date))) ||
    deadline >= 780
  );
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
      clusterKey === "molenhoek-groesbeek" ||
      clusterKey === "berg-en-dal" ||
      /radboud|heyendaal|han\b|kapittelweg|geert groote|maartenskliniek|brakkenstein|berg en dal|beek|ubbergen|groesbeek|malden|molenhoek|oost/.test(
        text
      )
    );
  }

  return (
    clusterKey === "jonkerbos" ||
    clusterKey === "west-buiten" ||
    clusterKey === "noord-buiten" ||
    isCenterRouteText(text) ||
    /ziekerstraat|centrum|lent|waalkade|jonkerbos|sanadome|cwz|goffert|crematorium|thermen|berendonck|wijchen|beuningen|oosterhout|bemmel|elst|arnhem|noord/.test(
      text
    )
  );
}

function routeAreaOrderForReceipt(receipt: ReceiptSummary) {
  const shopKey = shopKeyForReceipt(receipt);
  if (shopKey === "heyendaalseweg") return 10;
  if (shopKey === "daalseweg") return 20;
  if (shopKey === "lent") return 30;
  if (shopKey === "ziekerstraat") return 40;

  const text = receiptSearchText(receipt);
  if (isCenterRouteText(text)) return 45;

  const clusterKey = outsideClusterKeyForReceipt(receipt);
  if (clusterKey === "jonkerbos") return 50;
  if (clusterKey === "west-buiten") return 60;
  if (clusterKey === "molenhoek-groesbeek") return 70;
  if (clusterKey === "berg-en-dal") return 72;
  if (clusterKey === "oost-buiten") return 74;
  if (clusterKey === "noord-buiten") return 86;

  return 90;
}

function routeDeadlinePriorityForReceipt(receipt: ReceiptSummary) {
  if (isEarlyException(receipt)) return 0;

  const minutes = routeDeadlineMinutes(receipt);
  if (minutes < 600) return 0;
  if (minutes < 720) return 1;
  if (minutes >= 780 && minutes < 9999) return 3;

  return 2;
}

function sortShopKeysByRoutePath(shopKeys: ShopKey[]) {
  const remaining = [...shopKeys];
  const sorted: ShopKey[] = [];
  let currentPoint = depotRoutePoint;

  while (remaining.length) {
    let bestIndex = 0;
    let bestScore = Number.POSITIVE_INFINITY;

    remaining.forEach((shopKey, index) => {
      const score = routeDistance(currentPoint, shopRouteMeta[shopKey].point);
      if (score < bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    });

    const [nextShopKey] = remaining.splice(bestIndex, 1);
    sorted.push(nextShopKey);
    currentPoint = shopRouteMeta[nextShopKey].point;
  }

  return sorted;
}

function lastShopRoutePoint(shopKeys: ShopKey[]) {
  const sortedShopKeys = sortShopKeysByRoutePath(shopKeys);
  const lastShopKey = sortedShopKeys.at(-1);

  return lastShopKey ? shopRouteMeta[lastShopKey].point : depotRoutePoint;
}

function sortReceiptsAlongRoute(
  receipts: ReceiptSummary[],
  startPoint: RoutePoint
) {
  const remaining = [...receipts];
  const sorted: ReceiptSummary[] = [];
  let currentPoint = startPoint;

  while (remaining.length) {
    let bestIndex = 0;
    let bestScore = Number.POSITIVE_INFINITY;

    remaining.forEach((receipt, index) => {
      const distanceScore = routeDistance(currentPoint, receiptRoutePoint(receipt));
      const deadline = routeDeadlineMinutes(receipt);
      const latePenalty = deadline >= 780 ? 1.8 : 0;
      const score = distanceScore + latePenalty;

      if (score < bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    });

    const [nextReceipt] = remaining.splice(bestIndex, 1);
    sorted.push(nextReceipt);
    currentPoint = receiptRoutePoint(nextReceipt);
  }

  return sorted;
}

function sortReceiptsForRoute(
  receipts: ReceiptSummary[],
  shopKeys: ShopKey[],
  date: string
) {
  const startPoint = lastShopRoutePoint(shopKeys);
  const early = receipts.filter(isPriorityEarlyDelivery).sort((first, second) => {
    const deadlineCompare = routeDeadlineMinutes(first) - routeDeadlineMinutes(second);
    if (deadlineCompare !== 0) return deadlineCompare;

    return (
      routeDistance(startPoint, receiptRoutePoint(first)) -
      routeDistance(startPoint, receiptRoutePoint(second))
    );
  });
  const normal = receipts.filter(
    (receipt) =>
      !isPriorityEarlyDelivery(receipt) && !isFlexibleLateDelivery(receipt, date)
  );
  const late = receipts.filter(
    (receipt) =>
      !isPriorityEarlyDelivery(receipt) && isFlexibleLateDelivery(receipt, date)
  );
  const afterEarlyPoint = early.length
    ? receiptRoutePoint(early.at(-1)!)
    : startPoint;
  const normalSorted = sortReceiptsAlongRoute(normal, afterEarlyPoint);
  const afterNormalPoint = normalSorted.length
    ? receiptRoutePoint(normalSorted.at(-1)!)
    : afterEarlyPoint;

  return [
    ...early,
    ...normalSorted,
    ...sortReceiptsAlongRoute(late, afterNormalPoint),
  ];
}

function shouldRideAfterLentOnSaturday(receipt: ReceiptSummary) {
  return outsideClusterKeyForReceipt(receipt) === "noord-buiten";
}

function sortDeliveryReceipts(receipts: ReceiptSummary[]) {
  return [...receipts].sort((first, second) => {
    const earlyCompare =
      Number(isEarlyException(second)) - Number(isEarlyException(first));
    if (earlyCompare !== 0) return earlyCompare;

    const firstDeadlinePriority = routeDeadlinePriorityForReceipt(first);
    const secondDeadlinePriority = routeDeadlinePriorityForReceipt(second);
    const timeCompare = routeDeadlineMinutes(first) - routeDeadlineMinutes(second);
    const firstHardDeadlinePriority =
      firstDeadlinePriority <= 1 ? firstDeadlinePriority : 2;
    const secondHardDeadlinePriority =
      secondDeadlinePriority <= 1 ? secondDeadlinePriority : 2;
    const hardDeadlineCompare =
      firstHardDeadlinePriority - secondHardDeadlinePriority;
    if (hardDeadlineCompare !== 0) return hardDeadlineCompare;
    if (firstHardDeadlinePriority <= 1 && timeCompare !== 0) return timeCompare;

    const areaCompare =
      routeAreaOrderForReceipt(first) - routeAreaOrderForReceipt(second);
    if (areaCompare !== 0) return areaCompare;

    const priorityCompare = firstDeadlinePriority - secondDeadlinePriority;
    if (priorityCompare !== 0) return priorityCompare;

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
  shopKeys: ShopKey[];
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
  shopKeys: ShopKey[];
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

function shopLoadScore(receipts: ReceiptSummary[], shopKey: ShopKey) {
  const shopReceipts = receipts.filter(
    (receipt) => isShopReceipt(receipt) && shopKeyForReceipt(receipt) === shopKey
  );
  const pastryUnits = shopReceipts.reduce(
    (total, receipt) => total + receiptPastryUnits(receipt),
    0
  );
  const orderValue = shopReceipts.reduce(
    (total, receipt) => total + (receipt.value || 0),
    0
  );
  const iceTubs = shopReceipts.reduce(
    (total, receipt) => total + iceTubCountForReceipt(receipt),
    0
  );

  return (
    4 +
    shopReceipts.length * 2.8 +
    pastryUnits / 12 +
    orderValue / 220 +
    iceTubs / 2
  );
}

function shopRouteDistance(shopKeys: ShopKey[]) {
  const sortedShopKeys = sortShopKeysByRoutePath(shopKeys);
  let currentPoint = depotRoutePoint;
  let distance = 0;

  sortedShopKeys.forEach((shopKey) => {
    const nextPoint = shopRouteMeta[shopKey].point;
    distance += routeDistance(currentPoint, nextPoint);
    currentPoint = nextPoint;
  });

  return distance + routeDistance(currentPoint, depotRoutePoint);
}

function routeAssignmentCostForReceipt(
  receipt: ReceiptSummary,
  shopKeys: ShopKey[],
  date: string
) {
  const point = receiptRoutePoint(receipt);
  const nearestShopDistance = Math.min(
    ...shopKeys.map((shopKey) => routeDistance(point, shopRouteMeta[shopKey].point))
  );
  let cost = nearestShopDistance + routeDeadlinePriorityForReceipt(receipt) * 0.45;

  if (isRadboudReceipt(receipt) && shopKeys.includes("heyendaalseweg")) {
    cost -= 2.2;
  }
  if (
    isSintMaartenskliniekReceipt(receipt) &&
    (shopKeys.includes("heyendaalseweg") || shopKeys.includes("daalseweg"))
  ) {
    cost -= 1.5;
  }
  if (isDriesElstReceipt(receipt) && shopKeys.includes("lent")) {
    cost -= 1.8;
  }
  if (
    outsideClusterKeyForReceipt(receipt) === "noord-buiten" &&
    shopKeys.includes("lent")
  ) {
    cost -= 1.4;
  }
  if (isCenterRouteText(receiptSearchText(receipt)) && shopKeys.includes("ziekerstraat")) {
    cost -= 1.2;
  }
  if (isFlexibleLateDelivery(receipt, date)) {
    cost += 0.8;
  }

  return cost;
}

function buildShopAssignmentCandidates() {
  const candidates: { A: ShopKey[]; B: ShopKey[] }[] = [];
  const maxMask = 1 << shopRouteKeys.length;

  for (let mask = 1; mask < maxMask - 1; mask += 1) {
    const aShopKeys = shopRouteKeys.filter((_, index) => mask & (1 << index));
    if (aShopKeys.length < 1 || aShopKeys.length > 3) continue;

    const bShopKeys = shopRouteKeys.filter((shopKey) => !aShopKeys.includes(shopKey));
    if (bShopKeys.length < 1 || bShopKeys.length > 3) continue;

    candidates.push({
      A: sortShopKeysByRoutePath(aShopKeys),
      B: sortShopKeysByRoutePath(bShopKeys),
    });
  }

  return candidates;
}

function chooseShopAssignment(
  plan: DayPlan,
  receipts: ReceiptSummary[],
  loadProfile: DayLoadProfile
) {
  const deliveryReceipts = receipts.filter(isRouteDelivery);
  const candidates = buildShopAssignmentCandidates();
  let bestCandidate = candidates[0] || {
    A: ["heyendaalseweg", "daalseweg"] as ShopKey[],
    B: ["ziekerstraat", "lent"] as ShopKey[],
  };
  let bestScore = Number.POSITIVE_INFINITY;

  candidates.forEach((candidate) => {
    const loads: Record<BusId, number> = {
      A: candidate.A.reduce(
        (total, shopKey) => total + shopLoadScore(receipts, shopKey),
        0
      ),
      B: candidate.B.reduce(
        (total, shopKey) => total + shopLoadScore(receipts, shopKey),
        0
      ),
    };
    let score =
      shopRouteDistance(candidate.A) * 1.4 +
      shopRouteDistance(candidate.B) * 1.4 +
      Math.max(0, candidate.B.length - 2) * 2.8 +
      Math.max(0, candidate.A.length - 2) * 1.2;

    deliveryReceipts.forEach((receipt) => {
      const costA = routeAssignmentCostForReceipt(receipt, candidate.A, plan.date);
      const costB = routeAssignmentCostForReceipt(receipt, candidate.B, plan.date);
      const bus = costA <= costB ? "A" : "B";

      loads[bus] += receiptLoadScore(receipt);
      score += Math.min(costA, costB);
    });

    const normalizedA = loads.A / busRouteMeta.A.capacity;
    const normalizedB = loads.B / busRouteMeta.B.capacity;
    score += Math.abs(normalizedA - normalizedB) * 0.65;
    if (loads.B > loads.A) score += (loads.B - loads.A) * 0.45;
    if (loadProfile.pressure === "hoog" && candidate.B.length > 2) score += 4;

    if (score < bestScore) {
      bestScore = score;
      bestCandidate = candidate;
    }
  });

  return bestCandidate;
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
  date: string;
  receipt: ReceiptSummary;
  round: "first" | "second";
}) {
  const shopKey = shopKeyForReceipt(input.receipt);
  if (shopKey) {
    const shopBus = (["A", "B"] as BusId[]).find((bus) =>
      input.buses[bus].shopKeys.includes(shopKey)
    );
    if (shopBus) return shopBus;
  }

  const routeCostA = routeAssignmentCostForReceipt(
    input.receipt,
    input.buses.A.shopKeys,
    input.date
  );
  const routeCostB = routeAssignmentCostForReceipt(
    input.receipt,
    input.buses.B.shopKeys,
    input.date
  );
  if (Math.abs(routeCostA - routeCostB) >= 1.2) {
    return routeCostA < routeCostB ? "A" : "B";
  }

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
  loadProfile: DayLoadProfile,
  date: string
) {
  if (isPriorityEarlyDelivery(receipt)) return false;

  const minutes = routeDeadlineMinutes(receipt);
  if (minutes < 600) return false;
  if (
    isFlexibleLateDelivery(receipt, date) &&
    loadProfile.pressure !== "laag" &&
    bus.firstScore + receiptLoadScore(receipt) > 10
  ) {
    return true;
  }

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
    sourceId: `ice:${receipt.id}`,
    label: receipt.customer,
    detail: detailParts.join(" · "),
    badges: receiptStopBadges(receipt),
  };
}

function routeLoadLineForReceipts(receipts: ReceiptSummary[]) {
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

function routeLoadLineForStops(stops: RouteStop[]) {
  const shopCount = stops.filter((stop) => stop.badges.includes("winkel")).length;
  const largeCount = stops.filter((stop) => stop.badges.includes("groot")).length;
  const iceTubs = stops.reduce((total, stop) => {
    const stopIceTubs = stop.badges.reduce((badgeTotal, badge) => {
      const match = badge.match(/^(\d+)\s+ijs$/i);

      return badgeTotal + (match ? Number(match[1]) : 0);
    }, 0);

    return total + stopIceTubs;
  }, 0);
  const detailParts = [
    `${stops.length} stops`,
    shopCount ? `${shopCount} winkel` : "",
    largeCount ? `${largeCount} groot` : "",
    iceTubs ? `${iceTubs} ijs / ${Math.ceil(iceTubs / 3)} tempex` : "",
  ].filter(Boolean);

  return detailParts.join(" · ");
}

function busLoadLine(bus: PlannedBus, round: "first" | "second" | "ice") {
  if (round === "first") {
    return routeLoadLineForReceipts([
      ...bus.early,
      ...bus.first,
      ...bus.firstIce,
    ]);
  }
  if (round === "ice") return routeLoadLineForReceipts(bus.ice);

  return routeLoadLineForReceipts([...bus.second, ...bus.ice]);
}

function routeLoadLineWithFallback(loadLine: string, fallback: string) {
  if (loadLine === "0 bonnen") return fallback;

  return `${loadLine} · ${fallback}`;
}

function isSaturdayDate(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  if (!year || !month || !day) return false;

  return new Date(Date.UTC(year, month - 1, day)).getUTCDay() === 6;
}

function buildRouteRounds(
  plan: DayPlan,
  receipts: ReceiptSummary[],
  loadProfile: DayLoadProfile
): RouteRound[] {
  if (isSaturdayDate(plan.date)) {
    return buildSaturdayRouteRounds(plan, receipts, loadProfile);
  }

  const shopAssignment = chooseShopAssignment(plan, receipts, loadProfile);
  const buses: Record<BusId, PlannedBus> = {
    A: createPlannedBus({
      id: "A",
      title: busRouteMeta.A.title,
      tone: busRouteMeta.A.tone,
      shopKeys: shopAssignment.A,
    }),
    B: createPlannedBus({
      id: "B",
      title: busRouteMeta.B.title,
      tone: busRouteMeta.B.tone,
      shopKeys: shopAssignment.B,
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
      date: plan.date,
      receipt,
      round: "first",
    });
    const round = shouldUseSecondRound(
      receipt,
      buses[firstChoiceBus],
      loadProfile,
      plan.date
    )
      ? "second"
      : isPriorityEarlyDelivery(receipt)
        ? "early"
        : "first";
    const bus =
      round === "second"
        ? chooseBusForReceipt({
            buses,
            clusterAssignments,
            date: plan.date,
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
      date: plan.date,
      receipt,
      round: "second",
    });
    const round = shouldDeliverIceWithShopReceipt(receipt, loadProfile)
      ? "firstIce"
      : "ice";

    addReceiptToBus(buses[bus], receipt, round);
  });

  ([buses.A, buses.B] as PlannedBus[]).forEach((bus) => {
    const shopStops = groupShopStops(
      receipts,
      sortShopKeysByRoutePath(bus.shopKeys),
      bus.firstIce
    );
    const looseFirstIceStops = sortDeliveryReceipts(
      bus.firstIce.filter((receipt) => !shopKeyForReceipt(receipt))
    ).map(iceStopForReceipt);
    const firstStops = [
      ...shopStops,
      ...sortReceiptsForRoute(bus.early, bus.shopKeys, plan.date).map((receipt) =>
        routeStopForReceipt(receipt, `${bus.id}-early-`)
      ),
      ...looseFirstIceStops,
      ...sortReceiptsForRoute(bus.first, bus.shopKeys, plan.date).map((receipt) =>
        routeStopForReceipt(receipt, `${bus.id}-first-`)
      ),
    ];
    const secondStops = [
      ...sortReceiptsForRoute(bus.second, bus.shopKeys, plan.date).map((receipt) =>
        routeStopForReceipt(receipt, `${bus.id}-second-`)
      ),
      ...sortReceiptsForRoute(bus.ice, bus.shopKeys, plan.date).map(iceStopForReceipt),
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
          reason:
            `${busRouteMeta[bus.id].description}. Eerst vaste winkels (${bus.shopKeys
              .map((shopKey) => shopRouteMeta[shopKey].shortLabel)
              .join(", ")}), daarna vroege en logische bezorgstops. Start/eind Ambachtsweg 4.`,
          load: routeLoadLineForStops(firstStops),
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
            "Tweede ronde voor ijs, Sanadome/Gennep/late bonnen of volume dat niet logisch in de eerste ronde past.",
          load: routeLoadLineForStops(secondStops),
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
            sourceId: "check:ijs",
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

function buildSaturdayRouteRounds(
  plan: DayPlan,
  receipts: ReceiptSummary[],
  loadProfile: DayLoadProfile
): RouteRound[] {
  const buses: Record<BusId, PlannedBus> = {
    A: createPlannedBus({
      id: "A",
      title: busRouteMeta.A.title,
      tone: busRouteMeta.A.tone,
      shopKeys: ["heyendaalseweg", "daalseweg"],
    }),
    B: createPlannedBus({
      id: "B",
      title: busRouteMeta.B.title,
      tone: busRouteMeta.B.tone,
      shopKeys: ["lent", "ziekerstraat"],
    }),
  };
  const clusterAssignments = new Map<string, BusId>();
  const deliveryReceipts = sortDeliveryReceipts(receipts.filter(isRouteDelivery));
  const iceReceipts = sortDeliveryReceipts(receipts.filter(isIceReceiptSummary));
  const rounds: RouteRound[] = [];

  deliveryReceipts.forEach((receipt) => {
    const bus = chooseBusForReceipt({
      buses,
      clusterAssignments,
      date: plan.date,
      receipt,
      round: "second",
    });
    const round = isPriorityEarlyDelivery(receipt)
      ? "early"
      : bus === "B" && shouldRideAfterLentOnSaturday(receipt)
        ? "first"
        : "second";

    addReceiptToBus(buses[bus], receipt, round);
  });

  iceReceipts.forEach((receipt) => {
    const bus = chooseBusForReceipt({
      buses,
      clusterAssignments,
      date: plan.date,
      receipt,
      round: "second",
    });

    addReceiptToBus(buses[bus], receipt, "ice");
  });

  ([buses.A, buses.B] as PlannedBus[]).forEach((bus) => {
    const routePlan = saturdayRouteShopPlan[bus.id];
    const firstStops = [
      ...groupShopStops(receipts, routePlan.firstShopKeys, []),
      ...sortReceiptsForRoute(bus.early, bus.shopKeys, plan.date).map((receipt) =>
        routeStopForReceipt(receipt, `${bus.id}-early-`)
      ),
      ...sortReceiptsForRoute(bus.first, bus.shopKeys, plan.date).map((receipt) =>
        routeStopForReceipt(receipt, `${bus.id}-first-`)
      ),
    ];
    const secondStops = [
      ...groupShopStops(receipts, routePlan.secondShopKeys, []),
      ...sortReceiptsForRoute(bus.second, bus.shopKeys, plan.date).map((receipt) =>
        routeStopForReceipt(receipt, `${bus.id}-second-`)
      ),
    ];
    const iceStops = sortReceiptsForRoute(bus.ice, bus.shopKeys, plan.date).map(
      iceStopForReceipt
    );

    if (firstStops.length) {
      rounds.push(
        buildRouteRound({
          id: `bus-${bus.id}-1-saturday`,
          title: "Ronde 1",
          vehicle: bus.title,
          departure: plan.isFuture ? "advies 08:00" : "08:00",
          tone: bus.tone,
          stops: firstStops,
          reason:
            bus.id === "B"
              ? "Zaterdag: eerst Lent, daarna Gendt/noordkant als die erbij zit; start/eind Ambachtsweg 4."
              : `Zaterdag: eerst ${routePlan.firstShopLabel}, bus vol laden door drukte; start/eind Ambachtsweg 4.`,
          load: routeLoadLineWithFallback(
            routeLoadLineForStops(firstStops),
            "volle bus"
          ),
          loadProfile,
        })
      );
    }

    if (secondStops.length) {
      rounds.push(
        buildRouteRound({
          id: `bus-${bus.id}-2-saturday`,
          title: "Ronde 2",
          vehicle: bus.title,
          departure: plan.isFuture ? "na ronde 1" : "na ronde 1",
          tone: "border-[#efc7b8] bg-[#fff3ed]",
          stops: secondStops,
          reason: `Zaterdag: daarna ${routePlan.secondShopLabel} en de resterende stops; late deadlines blijven later.`,
          load: routeLoadLineWithFallback(
            routeLoadLineForStops(secondStops),
            "winkel + rest"
          ),
          loadProfile,
        })
      );
    }

    if (iceStops.length) {
      rounds.push(
        buildRouteRound({
          id: `bus-${bus.id}-3-ice-saturday`,
          title: "Ronde 3 · IJs",
          vehicle: bus.title,
          departure: plan.isFuture ? "na ronde 2" : "na ronde 2",
          tone: "border-[#b8ddea] bg-[#eefaff]",
          stops: iceStops,
          reason: "Zaterdag: ijs apart houden tot na de vaste winkelrondes.",
          load: busLoadLine(bus, "ice"),
          loadProfile,
        })
      );
    }
  });

  if (plan.iceTubs > 0 && iceReceipts.length === 0) {
    const bus = chooseLightestBus(buses, "second");
    rounds.push(
      buildRouteRound({
        id: `bus-${bus}-3-ice-check-saturday`,
        title: "Ronde 3 · IJs check",
        vehicle: `Bus ${bus}`,
        departure: plan.isFuture ? "na ronde 2" : "na ronde 2",
        tone: "border-[#b8ddea] bg-[#eefaff]",
        stops: [
          {
            id: "ijs-check",
            sourceId: "check:ijs",
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

function refreshRouteRoundAfterManualMove(
  route: RouteRound,
  loadProfile: DayLoadProfile
): RouteRound {
  return {
    ...route,
    badge: routeBadgeFor(route.stops.length, loadProfile),
    load: routeLoadLineForStops(route.stops),
    reason: "Handmatig samengesteld; print gebruikt deze volgorde.",
  };
}

function moveRouteStopInRounds(
  routeRounds: RouteRound[],
  move: RouteStopMove,
  loadProfile: DayLoadProfile
) {
  if (
    move.sourceRouteId === move.targetRouteId &&
    move.stopId === move.targetStopId
  ) {
    return routeRounds;
  }

  const draft = routeRounds.map((route) => ({
    ...route,
    stops: [...route.stops],
  }));
  const sourceRoute = draft.find((route) => route.id === move.sourceRouteId);
  const targetRoute = draft.find((route) => route.id === move.targetRouteId);
  if (!sourceRoute || !targetRoute) return routeRounds;

  const sourceStopIndex = sourceRoute.stops.findIndex(
    (stop) => stop.id === move.stopId
  );
  if (sourceStopIndex < 0) return routeRounds;

  const [stop] = sourceRoute.stops.splice(sourceStopIndex, 1);
  const targetStopIndex = move.targetStopId
    ? targetRoute.stops.findIndex((item) => item.id === move.targetStopId)
    : -1;
  const insertIndex =
    move.position === "end" || targetStopIndex < 0
      ? targetRoute.stops.length
      : targetStopIndex + (move.position === "after" ? 1 : 0);

  targetRoute.stops.splice(insertIndex, 0, stop);

  return draft.map((route) =>
    refreshRouteRoundAfterManualMove(route, loadProfile)
  );
}

function routeStopSourceKey(stop: RouteStop) {
  return stop.sourceId || stop.id;
}

function serializeRouteRounds(routeRounds: RouteRound[]) {
  return routeRounds.map((route) => ({
    id: route.id,
    title: route.title,
    vehicle: route.vehicle,
    departure: route.departure,
    badge: route.badge,
    tone: route.tone,
    reason: route.reason,
    load: route.load,
    stops: route.stops.map((stop) => ({
      id: stop.id,
      sourceId: routeStopSourceKey(stop),
      label: stop.label,
      detail: stop.detail,
      badges: stop.badges,
    })),
  }));
}

function reconcileRouteDraftRounds(
  routeDraft: RouteDraftSummary,
  automaticRouteRounds: RouteRound[],
  loadProfile: DayLoadProfile
): RouteRound[] {
  const automaticStopBySourceKey = new Map<string, RouteStop>();
  const automaticRouteById = new Map(
    automaticRouteRounds.map((route) => [route.id, route])
  );

  automaticRouteRounds.forEach((route) => {
    route.stops.forEach((stop) => {
      automaticStopBySourceKey.set(routeStopSourceKey(stop), stop);
    });
  });

  const usedSourceKeys = new Set<string>();
  const reconciledRoutes = routeDraft.routes.map((draftRoute) => {
    const automaticRoute = automaticRouteById.get(draftRoute.id);
    const stops = draftRoute.stops
      .map((draftStop) => {
        const sourceKey = draftStop.sourceId || draftStop.id;
        const stop = automaticStopBySourceKey.get(sourceKey);
        if (!stop) return null;

        usedSourceKeys.add(sourceKey);
        return stop;
      })
      .filter((stop): stop is RouteStop => Boolean(stop));

    return refreshRouteRoundAfterManualMove(
      {
        ...(automaticRoute || draftRoute),
        stops,
      },
      loadProfile
    );
  });

  automaticRouteRounds.forEach((automaticRoute) => {
    const unassignedStops = automaticRoute.stops.filter(
      (stop) => !usedSourceKeys.has(routeStopSourceKey(stop))
    );
    if (!unassignedStops.length) return;

    const existingRoute = reconciledRoutes.find(
      (route) => route.id === automaticRoute.id
    );

    if (existingRoute) {
      existingRoute.stops.push(...unassignedStops);
      const refreshedRoute = refreshRouteRoundAfterManualMove(
        existingRoute,
        loadProfile
      );
      Object.assign(existingRoute, refreshedRoute);
      return;
    }

    reconciledRoutes.push(
      refreshRouteRoundAfterManualMove(
        {
          ...automaticRoute,
          stops: unassignedStops,
        },
        loadProfile
      )
    );
  });

  return reconciledRoutes.filter((route) => route.stops.length > 0);
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
  if (importedBatch?.receipts.length) {
    return importedBatch.receipts.map(normalizeImportedReceipt);
  }

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
  const [routeDraft, setRouteDraft] = useState<RouteDraftSummary | null>(null);
  const [batchLoadState, setBatchLoadState] = useState<BatchLoadState>("idle");
  const [batchReloadCounter, setBatchReloadCounter] = useState(0);
  const [routeSaveState, setRouteSaveState] = useState<RouteSaveState>("idle");
  const [routeSaveMessage, setRouteSaveMessage] = useState("");
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
  const dateStateRef = useRef(dateState);
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
  const automaticRouteRounds = useMemo(
    () => buildRouteRounds(selectedPlan, receiptSummaries, loadProfile),
    [loadProfile, receiptSummaries, selectedPlan]
  );
  const [manualRouteRounds, setManualRouteRounds] = useState<
    RouteRound[] | null
  >(null);
  const [routesEdited, setRoutesEdited] = useState(false);
  const routeRounds = manualRouteRounds || automaticRouteRounds;
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
    dateStateRef.current = dateState;
  }, [dateState]);

  useEffect(() => {
    function syncOpenAppDate() {
      const current = dateStateRef.current;
      const next = syncDateState(current);

      if (next === current) return;

      const selectedDateChanged = next.selectedDate !== current.selectedDate;
      const calendarChanged =
        next.today !== current.today || next.tomorrow !== current.tomorrow;
      const definitiveWindowStarted = current.hour < 22 && next.hour >= 22;

      dateStateRef.current = next;
      setDateState(next);

      if (selectedDateChanged) {
        setFileSnapshot(null);
      }

      if (calendarChanged || definitiveWindowStarted) {
        setImportMessage("");
        setBatchReloadCounter((value) => value + 1);
      }
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        syncOpenAppDate();
      }
    }

    syncOpenAppDate();

    const intervalId = window.setInterval(syncOpenAppDate, 60 * 1000);
    window.addEventListener("focus", syncOpenAppDate);
    window.addEventListener("pageshow", syncOpenAppDate);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", syncOpenAppDate);
      window.removeEventListener("pageshow", syncOpenAppDate);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    if (routeDraft?.date === selectedPlan.date) {
      setManualRouteRounds(
        reconcileRouteDraftRounds(routeDraft, automaticRouteRounds, loadProfile)
      );
      setRoutesEdited(true);
      return;
    }

    setManualRouteRounds(null);
    setRoutesEdited(false);
  }, [automaticRouteRounds, loadProfile, routeDraft, selectedPlan.date]);

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
          routeDraft?: RouteDraftSummary | null;
          message?: string;
        };

        if (ignoreResult) return;

        if (!response.ok) {
          setBatchLoadState("error");
          setWebshopImages([]);
          setReceiptOverrides([]);
          setRouteDraft(null);
          if (manualRefresh) {
            setImportMessage(data.message || "Opnieuw ophalen is niet gelukt.");
          }
          return;
        }

        setImportedBatch(data.batch || null);
        setWebshopImages(data.webshopImages || []);
        setReceiptOverrides(data.receiptOverrides || []);
        setRouteDraft(data.routeDraft || null);
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
          setRouteDraft(null);
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
    setRouteSaveMessage("");
    setRouteSaveState("idle");
  }

  function refreshBatch() {
    manualBatchRefreshRef.current = true;
    setFileSnapshot(null);
    setImportMessage("bonnen opnieuw ophalen...");
    if (fileInputRef.current) fileInputRef.current.value = "";
    setBatchReloadCounter((current) => current + 1);
  }

  async function saveRouteDraft(routeRoundsToSave: RouteRound[]) {
    setRouteSaveState("saving");
    setRouteSaveMessage("route opslaan...");

    try {
      const response = await fetch("/api/bakkerij-logistiek/route-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: selectedPlan.date,
          routes: serializeRouteRounds(routeRoundsToSave),
        }),
      });
      const data = (await response.json()) as {
        ok?: boolean;
        routeDraft?: RouteDraftSummary | null;
        message?: string;
      };

      if (!response.ok || !data.ok || !data.routeDraft) {
        throw new Error(data.message || "Route opslaan is niet gelukt.");
      }

      setRouteDraft(data.routeDraft);
      setRouteSaveState("saved");
      setRouteSaveMessage(`handmatige route bewaard om ${getUploadTime()}`);
    } catch (error) {
      setRouteSaveState("error");
      setRouteSaveMessage(
        error instanceof Error ? error.message : "Route opslaan is niet gelukt."
      );
    }
  }

  function moveRouteStop(move: RouteStopMove) {
    const currentRoutes = manualRouteRounds || automaticRouteRounds;
    const nextRoutes = moveRouteStopInRounds(currentRoutes, move, loadProfile);
    if (nextRoutes === currentRoutes) return;

    setManualRouteRounds(nextRoutes);
    setRoutesEdited(true);
    void saveRouteDraft(nextRoutes);
  }

  async function resetRouteDraft() {
    setManualRouteRounds(null);
    setRoutesEdited(false);
    setRouteDraft(null);
    setRouteSaveState("saving");
    setRouteSaveMessage("route opnieuw berekenen...");

    try {
      const response = await fetch("/api/bakkerij-logistiek/route-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: selectedPlan.date,
          reset: true,
        }),
      });
      const data = (await response.json()) as {
        ok?: boolean;
        message?: string;
      };

      if (!response.ok || !data.ok) {
        throw new Error(data.message || "Route opnieuw berekenen is niet gelukt.");
      }

      setRouteSaveState("idle");
      setRouteSaveMessage("berekende route actief");
    } catch (error) {
      setRouteSaveState("error");
      setRouteSaveMessage(
        error instanceof Error
          ? error.message
          : "Route opnieuw berekenen is niet gelukt."
      );
    }
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
      setRouteDraft(null);
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
                openMarzipanPhotoSheet(selectedPlan, marzipanPrintItems)
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
        {activeTab === "routes" && (
          <RoutesPanel
            onRouteStopMove={moveRouteStop}
            onRoutesReset={resetRouteDraft}
            routeRounds={routeRounds}
            routeSaveMessage={routeSaveMessage}
            routeSaveState={routeSaveState}
            routesEdited={routesEdited}
            selectedPlan={selectedPlan}
          />
        )}
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

function routeGroupsFor(routeRounds: RouteRound[]): RouteGroup[] {
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

const routeDragMimeType = "application/x-strik-route-stop";

function isRouteDragState(value: unknown): value is RouteDragState {
  if (!value || typeof value !== "object") return false;

  const candidate = value as Partial<RouteDragState>;
  return (
    typeof candidate.sourceRouteId === "string" &&
    typeof candidate.stopId === "string"
  );
}

function routeDragStateFromEvent(
  event: React.DragEvent<HTMLElement>,
  fallback: RouteDragState | null
) {
  const raw =
    event.dataTransfer.getData(routeDragMimeType) ||
    event.dataTransfer.getData("text/plain");
  if (!raw) return fallback;

  try {
    const data: unknown = JSON.parse(raw);
    if (isRouteDragState(data)) return data;
  } catch {
    return fallback;
  }

  return fallback;
}

function eventHasRouteDragState(
  event: React.DragEvent<HTMLElement>,
  fallback: RouteDragState | null
) {
  if (fallback) return true;

  return Array.from(event.dataTransfer.types).includes(routeDragMimeType);
}

function RoutesPanel({
  onRouteStopMove,
  onRoutesReset,
  routeRounds,
  routeSaveMessage,
  routeSaveState,
  routesEdited,
  selectedPlan,
}: Readonly<{
  onRouteStopMove: (move: RouteStopMove) => void;
  onRoutesReset: () => void;
  routeRounds: RouteRound[];
  routeSaveMessage: string;
  routeSaveState: RouteSaveState;
  routesEdited: boolean;
  selectedPlan: DayPlan;
}>) {
  const [dragging, setDragging] = useState<RouteDragState | null>(null);
  const routeGroups = routeGroupsFor(routeRounds);

  function handleStopDragStart(
    event: React.DragEvent<HTMLLIElement>,
    sourceRouteId: string,
    stopId: string
  ) {
    const dragState = { sourceRouteId, stopId };
    setDragging(dragState);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData(routeDragMimeType, JSON.stringify(dragState));
    event.dataTransfer.setData("text/plain", JSON.stringify(dragState));
  }

  function handleRouteDragOver(event: React.DragEvent<HTMLElement>) {
    if (!eventHasRouteDragState(event, dragging)) return;

    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }

  function handleStopDrop(
    event: React.DragEvent<HTMLLIElement>,
    targetRouteId: string,
    targetStopId: string
  ) {
    event.preventDefault();
    event.stopPropagation();

    const dragState = routeDragStateFromEvent(event, dragging);
    if (!dragState) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const position = event.clientY < rect.top + rect.height / 2
      ? "before"
      : "after";

    onRouteStopMove({
      ...dragState,
      targetRouteId,
      targetStopId,
      position,
    });
    setDragging(null);
  }

  function handleRouteDrop(
    event: React.DragEvent<HTMLElement>,
    targetRouteId: string
  ) {
    event.preventDefault();

    const dragState = routeDragStateFromEvent(event, dragging);
    if (!dragState) return;

    onRouteStopMove({
      ...dragState,
      targetRouteId,
      position: "end",
    });
    setDragging(null);
  }

  return (
    <section className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2 border border-[#e8e4de] bg-white p-2.5 shadow-sm sm:p-3">
        <div className="min-w-0">
          <h2 className="text-base font-black tracking-normal text-[#1a1815]">
            Routeplanning
          </h2>
          <div className="mt-1 flex min-w-0 flex-wrap items-center gap-2">
            <span className="inline-flex border border-[#e8e4de] bg-[#faf8f5] px-2 py-1 text-[0.68rem] font-black uppercase tracking-normal text-[#6b645b]">
              {routesEdited ? "Handmatig" : "Auto"}
            </span>
            {(routeSaveMessage || routeSaveState === "saving") && (
              <span
                className={`min-w-0 truncate text-[0.68rem] font-bold tracking-normal ${
                  routeSaveState === "error" ? "text-[#9b2d1f]" : "text-[#6b645b]"
                }`}
              >
                {routeSaveMessage || "route opslaan..."}
              </span>
            )}
          </div>
        </div>
        <RouteResetButton
          disabled={!routesEdited || routeSaveState === "saving"}
          onClick={onRoutesReset}
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {routeGroups.map((group) => {
          const activeRouteCount = group.routes.filter(
            (route) => route.stops.length > 0
          ).length;

          return (
            <article
              key={group.vehicle}
              className="rounded-lg border border-[#e8e4de] bg-white p-2.5 shadow-sm sm:p-3"
            >
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-base font-black tracking-normal text-[#1a1815]">
                  {group.vehicle}
                </h2>
                <div className="flex items-center gap-2">
                  <RoutePrintButton
                    disabled={activeRouteCount === 0}
                    label={`Route printen voor ${group.vehicle}`}
                    onClick={() => openBusRouteSheet(selectedPlan, group)}
                  />
                  <span className="border border-[#e8e4de] bg-[#faf8f5] px-2 py-1 text-[0.68rem] font-black tracking-normal text-[#6b645b]">
                    {activeRouteCount} ronde
                    {activeRouteCount === 1 ? "" : "s"}
                  </span>
                </div>
              </div>
              <div className="mt-2 grid gap-2">
                {group.routes.map((route) => (
                  <section
                    key={route.id}
                    onDragOver={handleRouteDragOver}
                    onDrop={(event) => handleRouteDrop(event, route.id)}
                    className={`border p-2 transition ${
                      route.tone
                    } ${
                      dragging
                        ? "outline outline-1 outline-offset-1 outline-[#d7cec4]"
                        : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="text-xs font-black uppercase tracking-normal text-[#1a1815]">
                          {route.title}
                        </h3>
                        <p className="mt-0.5 text-[0.68rem] font-bold tracking-normal text-[#6b645b]">
                          {route.departure} · {route.badge}
                        </p>
                        <p className="mt-0.5 text-[0.62rem] font-bold tracking-normal text-[#7a736c]">
                          Start/eind: {routeDepot.address}
                        </p>
                      </div>
                      <span className="shrink-0 border border-white/80 bg-white px-1.5 py-0.5 text-[0.62rem] font-black tracking-normal text-[#6b645b]">
                        {route.load}
                      </span>
                    </div>
                    <ol className="mt-2 grid min-h-12 gap-1">
                      {route.stops.length === 0 && (
                        <li className="border border-dashed border-white/90 bg-white/70 px-2 py-2 text-xs font-black tracking-normal text-[#8b8278]">
                          Leeg
                        </li>
                      )}
                      {route.stops.map((stop, index) => (
                        <li
                          key={stop.id}
                          draggable
                          aria-grabbed={dragging?.stopId === stop.id}
                          onDragStart={(event) =>
                            handleStopDragStart(event, route.id, stop.id)
                          }
                          onDragEnd={() => setDragging(null)}
                          onDragOver={handleRouteDragOver}
                          onDrop={(event) =>
                            handleStopDrop(event, route.id, stop.id)
                          }
                          className={`grid cursor-grab grid-cols-[1rem_1.45rem_minmax(0,1fr)] gap-1.5 border border-white/80 bg-white px-1.5 py-1 transition hover:border-[#d7cec4] hover:shadow-sm active:cursor-grabbing ${
                            dragging?.stopId === stop.id ? "opacity-45" : ""
                          }`}
                        >
                          <span
                            title="Versleep"
                            className="flex h-5 w-4 items-center justify-center text-[#8b8278]"
                          >
                            <GripIcon />
                          </span>
                          <span
                            className="flex h-5 w-5 items-center justify-center bg-[#1a1815] text-[0.62rem] font-black tabular-nums tracking-normal text-white"
                          >
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
          );
        })}
        {routeGroups.length === 0 && (
          <div className="border border-[#e8e4de] bg-white p-3 text-sm font-bold tracking-normal text-[#6b645b] shadow-sm">
            Geen routes gevonden voor deze dag.
          </div>
        )}
      </div>
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
            const tone = receiptToneForFilter(filter.id);

            return (
              <button
                key={filter.id}
                type="button"
                aria-pressed={active}
                onClick={() => setActiveFilter(filter.id)}
                className={`shrink-0 border px-1.5 py-0.5 text-[0.62rem] font-normal tracking-normal transition ${
                  receiptFilterClasses(tone, active)
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
                        {image.productSummary && (
                          <span className="block truncate text-[#555]">
                            {image.productSummary}
                          </span>
                        )}
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
  const time = receiptListTimeLabel(receipt);
  const tone = receiptToneFor(receipt);
  const locationBadge = receiptLocationBadge(receipt);

  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onSelect}
      className={`grid w-full grid-cols-[1.75rem_minmax(0,1fr)] gap-1.5 border border-l-4 p-1.5 text-left transition ${
        active
          ? "border-[#1a1815] bg-white"
          : "border-[#efe7dd] bg-[#faf8f5] hover:border-[#d7cec4] hover:bg-white"
      } ${receiptAccentClasses(tone)}`}
    >
      <span className="flex h-6 w-6 items-center justify-center bg-[#1a1815] text-[0.62rem] font-bold tabular-nums tracking-normal text-white">
        {index + 1}
      </span>
      <div className="min-w-0">
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-1.5">
          <div className="min-w-0">
            <p className="truncate text-[0.72rem] font-bold leading-tight tracking-normal text-[#1a1815]">
              {receipt.customer}
            </p>
            {time && (
              <p className="mt-0.5 truncate text-[0.62rem] font-normal leading-tight tracking-normal text-[#6b645b]">
                {time}
              </p>
            )}
          </div>
          <div className="shrink-0 text-right">
            <span
              className={`inline-flex min-w-8 justify-center border px-1.5 py-0.5 text-[0.58rem] font-bold leading-none tracking-normal ${receiptToneBadgeClasses(
                tone
              )}`}
            >
              {locationBadge}
            </span>
            {receipt.value ? (
              <p className="mt-1 text-[0.62rem] font-normal leading-none tracking-normal text-[#6b645b]">
                {formatCurrency(receipt.value)}
              </p>
            ) : (
              <p className="mt-1 text-[0.62rem] font-normal leading-none tracking-normal text-[#8b8278]">
                intern
              </p>
            )}
          </div>
        </div>
        <div className="mt-1 flex items-center gap-1 overflow-hidden">
          <span
            className={`border px-1.5 py-0.5 text-[0.58rem] font-normal leading-none tracking-normal ${receiptToneBadgeClasses(
              tone
            )}`}
          >
            {fulfillment}
          </span>
          {imageCount > 0 && (
            <span className="border border-[#d6e5d8] bg-white px-1.5 py-0.5 text-[0.58rem] font-bold leading-none tracking-normal text-[#315641]">
              foto {imageCount}
            </span>
          )}
          <span className="truncate text-[0.6rem] font-normal leading-none tracking-normal text-[#8b8278]">
            {receipt.lines.length} regels
          </span>
        </div>
      </div>
    </button>
  );
}

function ReceiptAddressBlock({
  receipt,
  selectedPlan,
}: Readonly<{ receipt: ReceiptSummary; selectedPlan: DayPlan }>) {
  const fulfillment = receiptFulfillment(receipt);
  const mainAddress =
    fulfillment === "bezorgen"
      ? receipt.alternativeAddress || receipt.deliveryAddress || receipt.address
      : receipt.address;
  const showOriginalAddress =
    fulfillment === "bezorgen" &&
    receipt.address &&
    mainAddress &&
    receipt.address !== mainAddress;
  const receiptNumber = receipt.receiptNumber || receipt.id;

  return (
    <div className="bg-white px-3 py-3">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
        <div className="pl-3">
          <p className="text-sm font-black leading-tight tracking-normal text-[#000] sm:text-base">
            {receiptNumber} {receipt.customer}
          </p>
          {mainAddress && (
            <p className="mt-1 max-w-md whitespace-pre-line text-xs font-bold leading-snug tracking-normal text-[#111]">
              {mainAddress}
            </p>
          )}
          {showOriginalAddress && (
            <p className="mt-1 max-w-md text-[0.62rem] font-normal leading-snug tracking-normal text-[#666]">
              Origineel adres: {receipt.address}
            </p>
          )}
        </div>
        <div className="text-left sm:min-w-56 sm:text-right">
          <p className="text-sm font-black leading-tight tracking-normal text-[#000]">
            {formatReceiptDateLabel(selectedPlan.date)}
          </p>
        </div>
      </div>
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
                {image.productSummary && (
                  <span className="mt-0.5 block truncate text-[0.65rem] font-normal tracking-normal text-[#555]">
                    {image.productSummary}
                  </span>
                )}
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

function receiptLineTotal(line: ReceiptLine) {
  if (line.unitPrice === undefined) return undefined;

  const quantity = numericQuantity(line.quantity);
  return line.unitPrice * (quantity > 0 ? quantity : 1);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function cleanReceiptDisplayNote(value: string, lines: ReceiptLine[] = []) {
  const lineDescriptions = lines
    .map((line) => cleanReceiptLineDescription(line.description))
    .filter((description) => description.length >= 4)
    .sort((first, second) => second.length - first.length);
  let clean = value;

  lineDescriptions.forEach((description) => {
    clean = clean.replace(
      new RegExp(
        `(?:\\d+(?:[.,]\\d+)?\\s+)?${escapeRegExp(description)}\\s*(?:€\\s*[\\d.,:]+\\s*){0,2}(?:\\d+(?:[.,]\\d+)?\\s*)?`,
        "gi"
      ),
      " "
    );
  });

  const cleaned = clean
    .replace(
      /\b(?:\d+(?:[.,]\d+)?\s+)?(?:(?:strik's\s+)?(?:marsepeintaart|slagroomtaart|cremetaart)|petit\s+four)[^€]{4,180}\s+€\s*[\d.,:]+(?:\s+\d+(?:[.,]\d+)?\s+€\s*[\d.,:]+(?:\s+€\s*[\d.,:]+)*)?/gi,
      ""
    )
    .replace(
      /\b(?:kleur\s+petit\s*fours?|foto\s*\/\s*logo|foto|logo|tekst|vulling|voorsnijden)\s*:.*?(?=\s+(?:kleur\s+petit\s*fours?|foto\s*\/\s*logo|foto|logo|tekst|vulling|voorsnijden)\s*:|\s+(?:\d+(?:[.,]\d+)?\s+)?(?:betaald|niet betaald|gewenste betaling|trial mode|click here|&euro;|€\s*[\d.,:]+\s+met referentie)\b|$)/gi,
      ""
    )
    .replace(/(?:€\s*)?[\d.,:]+\s*€/g, "")
    .replace(/\b(?:\d+(?:[.,]\d+)?\s+)?€\s*[\d.,:]+\b/g, "")
    .replace(/€+/g, "")
    .replace(/trial mode\s*[–-]\s*click here for more information/gi, "")
    .replace(/\btrial mode\b\s*[–-]?/gi, "")
    .replace(/click here for more information/gi, "")
    .replace(/betaald via\s+\[[^\]]+\]\.?/gi, "")
    .replace(/&euro;\s*[\d.,:]+\s+met referentie\s+\S+/gi, "")
    .replace(/€\s*[\d.,:]+\s+met referentie\s+\S+/gi, "")
    .replace(/\b(?:niet\s+)?betaald\s*!+/gi, "")
    .replace(/[–—-]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (isReceiptNoteRemainder(cleaned)) return "";

  return cleaned;
}

function isReceiptNoteRemainder(value: string) {
  const normalized = value
    .normalize("NFKC")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/[\u2010-\u2015\u2212]/g, "-")
    .replace(/\s+/g, " ")
    .trim();

  return (
    /^(?:\d+\s*)?jaar!?\s*-?$/i.test(normalized) ||
    /^\d+(?:[.,]\d+)?\s*-?$/.test(normalized) ||
    /^-+$/.test(normalized)
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

function fulfillmentSentenceFor(receipt: ReceiptSummary) {
  const fulfillment = receiptFulfillment(receipt);
  const time = receiptListTimeLabel(receipt);
  const rangeMatch = time.match(/^(\d{1,2}:\d{2})-(\d{1,2}:\d{2})$/);

  if (fulfillment === "afhalen") {
    if (rangeMatch) {
      return `Wordt gehaald tussen ${rangeMatch[1]} en ${rangeMatch[2]}`;
    }
    if (time) return `Wordt gehaald om ${time}`;

    return "Wordt gehaald";
  }

  if (fulfillment === "bezorgen") {
    if (rangeMatch) {
      return `Wordt bezorgd voor ${rangeMatch[2]}`;
    }
    if (time) return `Wordt bezorgd om ${time}`;

    return "Wordt bezorgd";
  }

  return time ? `Tijd controleren: ${time}` : "Afhalen of bezorgen controleren";
}

function fulfillmentTargetFor(receipt: ReceiptSummary) {
  if (receiptFulfillment(receipt) === "afhalen") {
    return pickupLocationFor(receipt) || "Winkel controleren";
  }

  return receipt.alternativeAddress || receipt.deliveryAddress || receipt.address;
}

function ReceiptFulfillmentBlock({
  receipt,
}: Readonly<{ receipt: ReceiptSummary }>) {
  const tone = receiptToneFor(receipt);
  const target = fulfillmentTargetFor(receipt);
  const panelTone =
    tone === "lent"
      ? "border-[#8fbc8c] bg-[#eef8ed]"
      : tone === "heyendaalseweg"
        ? "border-[#e5cf68] bg-[#fff7cf]"
        : tone === "ziekerstraat"
          ? "border-[#eeaaa3] bg-[#fff0ef]"
          : tone === "daalseweg"
            ? "border-[#8dbde9] bg-[#eef7ff]"
            : "border-[#c8c3bb] bg-[#f2f1ee]";

  return (
    <div className={`mt-5 border border-l-4 px-3 py-3 text-center ${panelTone}`}>
      <p className="text-lg font-black leading-tight tracking-normal text-[#111] sm:text-xl">
        {fulfillmentSentenceFor(receipt)}
      </p>
      {target && (
        <p className="mt-1 text-xl font-black uppercase leading-tight tracking-normal text-[#111] sm:text-2xl">
          {target}
        </p>
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

  const receiptNumber = receipt.receiptNumber || receipt.id;
  const visibleNotes = [
    receipt.customerNote,
    overrideMessage,
  ]
    .map((note) => (note ? cleanReceiptDisplayNote(note, receipt.lines) : ""))
    .filter(
      (note) =>
        note &&
        !/^geen aparte opmerking\.?$/i.test(note) &&
        !/^geen aparte logistieke waarschuwing\.?$/i.test(note)
    );

  return (
    <article className="h-[30rem] overflow-y-auto rounded-sm border border-[#111] bg-[#f3f1ed] p-2 text-[#000] shadow-sm">
      <div className="min-h-full bg-white px-2 py-2 font-sans text-[#000] sm:px-3">
        <div className="border-2 border-[#111] border-b-8 bg-white px-3 py-2">
          <div className="grid items-start gap-3 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
            <div className="text-left">
              <p className="text-sm font-black leading-tight tracking-normal">
                Strik Patisserie BV
              </p>
              <p className="mt-1 text-xs font-black leading-tight tracking-normal">
                Ambachtsweg 4
              </p>
              <p className="text-xs font-black leading-tight tracking-normal">
                6581 AX&nbsp;&nbsp; MALDEN
              </p>
            </div>
            <div className="text-center">
              <h2 className="text-2xl font-black leading-none tracking-normal sm:text-3xl">
                Contantbon
              </h2>
              <p className="mt-1 text-[0.62rem] font-black uppercase tracking-normal">
                bon {receiptNumber}
              </p>
            </div>
            <div className="text-left sm:text-right">
              <p className="text-sm font-black leading-tight tracking-normal">
                info@strik-patisserie.nl
              </p>
              <p className="mt-4 text-xs font-black leading-tight tracking-normal">
                NL36RABO0167935798
              </p>
            </div>
          </div>
        </div>

        <ReceiptAddressBlock receipt={receipt} selectedPlan={selectedPlan} />

        <ReceiptOverrideEditor
          key={`${receipt.id}-${override?.updatedAt || "nieuw"}`}
          message={overrideMessage}
          onSave={onSaveReceiptOverride}
          override={override}
          receipt={receipt}
        />

        <div className="bg-white px-3 pb-3 pt-6">
          <table className="w-full border-collapse text-[0.72rem] tracking-normal text-[#000]">
            <thead>
              <tr className="border-b-2 border-[#c9c9c9] text-left font-normal">
                <th className="w-14 pb-1 font-normal">Aantal</th>
                <th className="pb-1 font-normal">Artikelomschrijving</th>
                <th className="w-20 pb-1 text-right font-normal">Prijs incl.</th>
                <th className="w-24 pb-1 text-right font-normal">Totaal</th>
              </tr>
            </thead>
            <tbody>
              {receipt.lines.map((line, index) => {
                const total = receiptLineTotal(line);
                const optionLine = isProductOptionLine(line);

                return (
                  <tr
                    key={`${receipt.id}-line-${index}`}
                    className={`align-top ${
                      optionLine ? "font-normal italic" : "font-bold"
                    }`}
                  >
                    <td className="py-0.5 pr-2 text-right tabular-nums">
                      {line.quantity}
                    </td>
                    <td className="py-0.5 pr-2">
                      <span>{line.description}</span>
                      {line.note && (
                        <span className="mt-0.5 block text-[0.64rem] font-normal leading-tight text-[#333]">
                          {line.note}
                        </span>
                      )}
                    </td>
                    <td className="py-0.5 text-right font-normal tabular-nums">
                      {line.unitPrice !== undefined
                        ? formatReceiptMoney(line.unitPrice)
                        : ""}
                    </td>
                    <td className="py-0.5 text-right font-normal tabular-nums">
                      {total !== undefined ? formatReceiptMoney(total) : ""}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="mt-2 border-t-2 border-[#c9c9c9] pt-2">
            <div className="ml-auto grid w-full max-w-xs grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1 text-sm tracking-normal">
              <span className="font-bold">Totaalprijs</span>
              <span className="text-right font-normal tabular-nums">
                {receipt.value ? formatReceiptMoney(receipt.value) : "intern"}
              </span>
            </div>
          </div>

          {visibleNotes.length > 0 && (
            <div className="mt-4 border-t border-[#d0d0d0] px-2 py-2 text-center">
              {visibleNotes.map((note, index) => (
                <p
                  key={`${receipt.id}-note-${index}`}
                  className="text-xs font-normal italic leading-snug tracking-normal text-[#333]"
                >
                  {note}
                </p>
              ))}
            </div>
          )}
          <ReceiptFulfillmentBlock receipt={receipt} />
          <WebshopImageBlock images={imageMatches} receipt={receipt} />
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
      aria-label="Marsepeinfoto's controleren"
      title="Marsepeinfoto's controleren"
      disabled={disabled}
      onClick={onClick}
      className="relative flex h-10 w-10 items-center justify-center border border-[#e8e4de] bg-white text-[#1a1815] shadow-sm transition hover:bg-[#faf8f5] disabled:cursor-not-allowed disabled:opacity-40"
    >
      <PhotoSheetIcon />
      {count > 0 && (
        <span className="absolute -right-1 -top-1 min-w-4 border border-[#1a1815] bg-[#1a1815] px-1 text-center text-[0.56rem] font-black leading-4 tracking-normal text-white">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </button>
  );
}

function RouteResetButton({
  disabled,
  onClick,
}: Readonly<{
  disabled: boolean;
  onClick: () => void;
}>) {
  return (
    <button
      type="button"
      aria-label="Bereken route"
      title="Bereken route"
      disabled={disabled}
      onClick={onClick}
      className="flex h-8 w-8 items-center justify-center border border-[#e8e4de] bg-white text-[#1a1815] shadow-sm transition hover:bg-[#faf8f5] disabled:cursor-not-allowed disabled:opacity-40"
    >
      <RefreshIcon spinning={false} />
    </button>
  );
}

function RoutePrintButton({
  disabled,
  label,
  onClick,
}: Readonly<{
  disabled?: boolean;
  label: string;
  onClick: () => void;
}>) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="flex h-8 w-8 items-center justify-center border border-[#e8e4de] bg-white text-[#1a1815] shadow-sm transition hover:bg-[#faf8f5] disabled:cursor-not-allowed disabled:opacity-40"
    >
      <PrintIcon />
    </button>
  );
}

function GripIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="h-3.5 w-3.5"
      aria-hidden="true"
      fill="currentColor"
    >
      <circle cx="5" cy="3" r="1" />
      <circle cx="11" cy="3" r="1" />
      <circle cx="5" cy="8" r="1" />
      <circle cx="11" cy="8" r="1" />
      <circle cx="5" cy="13" r="1" />
      <circle cx="11" cy="13" r="1" />
    </svg>
  );
}

function PhotoSheetIcon() {
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
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="8.5" cy="10" r="1.5" />
      <path d="m21 15-4.5-4.5L7 19" />
      <path d="m14 19-3.5-3.5" />
    </svg>
  );
}

function PrintIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
    >
      <path d="M6 9V3h12v6" />
      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
      <path d="M6 14h12v7H6z" />
      <path d="M18 12h.01" />
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
