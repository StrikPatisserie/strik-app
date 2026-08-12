"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { StrikPageHeader, StrikShell, strikIcons } from "../../StrikUI";
import type {
  LogisticsBatch,
  LogisticsBatchStatus,
  LogisticsDayFeedback,
  LogisticsDayOperations,
  LogisticsFixedCustomer,
  LogisticsFulfillment,
  LogisticsLoadPressure,
  LogisticsReceipt,
  LogisticsReceiptLine,
  LogisticsReceiptOverride,
  LogisticsRouteDraft,
  LogisticsRouteLearning,
  LogisticsWebshopImage,
} from "./logisticsTypes";

type DashboardTab = "routes" | "bonnen" | "leren";
type BatchStatus = LogisticsBatchStatus;
type ManualUploadStatus = Extract<BatchStatus, "prognose" | "definitief">;
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
  status: BatchStatus;
  uploadedAt: string;
};

type DateState = {
  today: string;
  tomorrow: string;
  selectedDate: string;
  hour: number;
  minute: number;
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
  learningKey?: string;
  learningLabel?: string;
  learningTarget?: string;
  learningKind?: "shop" | "receipt" | "ice" | "check";
  label: string;
  detail: string;
  badges: string[];
};

type RouteDragState = {
  sourceRouteId: string;
  stopId: string;
};

type RouteDropIndicator = {
  routeId: string;
  stopId?: string;
  position: "before" | "after" | "end";
};

type RouteStopMove = RouteDragState & {
  targetRouteId: string;
  targetStopId?: string;
  position: "before" | "after" | "end";
};

type DeletedRouteStopSnapshot = {
  stopLabel: string;
  routeRounds: RouteRound[];
  excludedSourceIds: string[];
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
  pressure: LogisticsLoadPressure;
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
type RouteLearningSummary = LogisticsRouteLearning;
type FixedCustomerSummary = LogisticsFixedCustomer;
type OperationsDraft = Required<
  Pick<LogisticsDayOperations, "teamStartTime" | "teamEndTime" | "teamMembers">
> & {
  busDepartures: Record<BusId, string>;
};

type LogisticsAdvice = {
  teamStartTime: string;
  teamSize: number;
  reason: string;
};

type MarzipanPrintShape = "square" | "round";

type PhotoProductPlan = {
  product: string;
  shape: MarzipanPrintShape;
  sizeCm: number;
  minimumSizeCm: number;
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
  minimumSizeCm: number;
  copyNumber: number;
  copyTotal: number;
  confidence: string;
  needsCheck: boolean;
};

type WrittenTextPrintItem = {
  id: string;
  customerName: string;
  customerLastName: string;
  receiptNumber: string;
  product: string;
  quantity: string;
  text: string;
  sourceLabel: string;
  needsCheck: boolean;
};

type PreparationCategory = "bakkerij" | "logistiek";

type PreparationRule = {
  category: PreparationCategory;
  code: string;
  label: string;
  articleNumber?: string;
  subcode?: string;
};

type PreparationSource = {
  receiptNumber: string;
  customerName: string;
  quantity: number;
};

type PreparationItem = {
  id: string;
  category: PreparationCategory;
  rule: PreparationRule;
  articleNumber: string;
  subcode: string;
  description: string;
  quantity: number;
  sources: PreparationSource[];
};

type WeddingCakeReceiptReference = {
  search: string;
  code: string;
  href: string;
};

type ReceiptOverrideDraft = {
  time: string;
  fulfillment: LogisticsFulfillment | "";
  deliveryAddress: string;
  alternativeAddress: string;
  pickupLocation: string;
  routeNote: string;
};

const MAX_MANUAL_PHOTO_UPLOAD_BYTES = 1_250_000;

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
    secondShopKeys: ["daalseweg", "ziekerstraat"],
    firstShopLabel: "Heyendaal",
    secondShopLabel: "Daalseweg + Ziekerstraat",
  },
  B: {
    firstShopKeys: ["lent"],
    secondShopKeys: [],
    firstShopLabel: "Lent",
    secondShopLabel: "resterende stops",
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

const preparationCategories: Record<
  PreparationCategory,
  { label: string; shortLabel: string; emptyLabel: string }
> = {
  bakkerij: {
    label: "Voorbereiden bakkerij",
    shortLabel: "Bakkerij",
    emptyLabel: "Geen bakkerij-voorbereiding gevonden voor deze dag.",
  },
  logistiek: {
    label: "Voorbereiden logistiek",
    shortLabel: "Logistiek",
    emptyLabel: "Geen logistieke voorbereiding gevonden voor deze dag.",
  },
};

const preparationRules: PreparationRule[] = [
  {
    category: "logistiek",
    code: ".686",
    label: "6-8 pers.",
    subcode: "686",
  },
  {
    category: "bakkerij",
    code: ".690",
    label: "12 pers. DV Horeca",
    subcode: "690",
  },
  {
    category: "bakkerij",
    code: "550",
    label: "Petit four (p.s.)",
    articleNumber: "550",
  },
  {
    category: "bakkerij",
    code: "551",
    label: "Petit Four met tekst",
    articleNumber: "551",
  },
  {
    category: "bakkerij",
    code: "552",
    label: "Petit Four met logo",
    articleNumber: "552",
  },
  {
    category: "bakkerij",
    code: "509.611",
    label: "Petit gateau Lemon Merengue",
    articleNumber: "509",
    subcode: "611",
  },
  {
    category: "bakkerij",
    code: "509.612",
    label: "Petit gateau Choco Mousse",
    articleNumber: "509",
    subcode: "612",
  },
  {
    category: "bakkerij",
    code: "509.613",
    label: "Petit gateau Blueberry Cheese",
    articleNumber: "509",
    subcode: "613",
  },
  {
    category: "bakkerij",
    code: "509.614",
    label: "Petit gateau Passie/Mango",
    articleNumber: "509",
    subcode: "614",
  },
];

const pressureOptions: {
  value: LogisticsLoadPressure | "";
  label: string;
}[] = [
  { value: "", label: "Auto" },
  { value: "laag", label: "Rustig" },
  { value: "middel", label: "Middel" },
  { value: "hoog", label: "Hoog" },
];

function pressureLabelFor(pressure: LogisticsLoadPressure | "") {
  if (pressure === "laag") return "rustig";
  if (pressure === "middel") return "middel";
  if (pressure === "hoog") return "hoog";

  return "auto";
}

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

function emptyOperationsDraft(): OperationsDraft {
  return {
    busDepartures: { A: "", B: "" },
    teamStartTime: "",
    teamEndTime: "",
    teamMembers: [{ id: "persoon-1", name: "" }],
  };
}

function operationsDraftFromFeedback(
  operations?: LogisticsDayOperations
): OperationsDraft {
  const members = operations?.teamMembers?.length
    ? operations.teamMembers
    : emptyOperationsDraft().teamMembers;

  return {
    busDepartures: {
      A: operations?.busDepartures?.A || "",
      B: operations?.busDepartures?.B || "",
    },
    teamStartTime: operations?.teamStartTime || "",
    teamEndTime: operations?.teamEndTime || "",
    teamMembers: members.map((member, index) => ({
      id: member.id || `persoon-${index + 1}`,
      name: member.name,
    })),
  };
}

function operationsDraftToPayload(
  draft: OperationsDraft
): LogisticsDayOperations | undefined {
  const teamMembers = draft.teamMembers
    .map((member, index) => ({
      id: member.id || `persoon-${index + 1}`,
      name: member.name.trim(),
    }))
    .filter((member) => member.name);
  const operations: LogisticsDayOperations = {
    busDepartures: {
      ...(draft.busDepartures.A ? { A: draft.busDepartures.A } : {}),
      ...(draft.busDepartures.B ? { B: draft.busDepartures.B } : {}),
    },
    ...(draft.teamStartTime ? { teamStartTime: draft.teamStartTime } : {}),
    ...(draft.teamEndTime ? { teamEndTime: draft.teamEndTime } : {}),
    ...(teamMembers.length ? { teamMembers } : {}),
  };

  if (
    !operations.busDepartures?.A &&
    !operations.busDepartures?.B &&
    !operations.teamStartTime &&
    !operations.teamEndTime &&
    !operations.teamMembers?.length
  ) {
    return undefined;
  }

  return operations;
}

const DEFINITIVE_BATCH_START_MINUTE_OF_DAY = 20 * 60;

function minuteOfDay(hour: number, minute: number) {
  return hour * 60 + minute;
}

function createDateState(): DateState {
  const now = new Date();
  const today = toInputDate(now);

  return {
    today,
    tomorrow: toInputDate(addDays(now, 1)),
    selectedDate: today,
    hour: now.getHours(),
    minute: now.getMinutes(),
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
    current.minute === next.minute &&
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

function dayOfWeekForDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return 1;

  return new Date(year, month - 1, day).getDay();
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

function tomorrowStatus(hour: number, minute: number): BatchStatus {
  if (
    minuteOfDay(hour, minute) >= DEFINITIVE_BATCH_START_MINUTE_OF_DAY
  ) {
    return "definitief";
  }

  return "prognose";
}

function defaultManualUploadStatus(
  dateState: DateState,
  importedBatch: LogisticsBatch | null
): ManualUploadStatus {
  if (
    importedBatch?.status === "prognose" ||
    importedBatch?.status === "definitief"
  ) {
    return importedBatch.status;
  }

  if (dateState.selectedDate === dateState.tomorrow) {
    return tomorrowStatus(dateState.hour, dateState.minute) === "definitief"
      ? "definitief"
      : "prognose";
  }

  return dateState.selectedDate > dateState.today ? "prognose" : "definitief";
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
      customerNote: receipt.customerNote,
      internalNote: nextInternalNote,
    };
  });
}

function fixedCustomerNumbersForReceipt(receipt: ReceiptSummary) {
  const values = [
    receipt.receiptNumber,
    /^\d{2,}$/.test(receipt.id) ? receipt.id : "",
  ]
    .flatMap((value) => String(value || "").match(/\d{2,}/g) || [])
    .map((value) => value.trim())
    .filter(Boolean);

  return Array.from(new Set(values));
}

function fieldLooksMissing(value: string | undefined) {
  const clean = String(value || "").trim();

  return (
    !clean ||
    /^adres controleren$/i.test(clean) ||
    /^alternatief adres/i.test(clean)
  );
}

function fixedCustomerMatchesByText(
  receipt: ReceiptSummary,
  fixedCustomer: FixedCustomerSummary
) {
  const receiptCustomer = normalizeMatchText(receipt.customer);
  const receiptAddress = normalizeMatchText(
    [receipt.address, receipt.deliveryAddress, receipt.alternativeAddress || ""].join(
      " "
    )
  );
  const fixedName = normalizeMatchText(fixedCustomer.customerName);
  const fixedAddress = normalizeMatchText(fixedCustomer.address);
  if (receiptCustomer.length < 3 || fixedName.length < 5) return false;

  const nameWords = significantWords(fixedCustomer.customerName);
  const addressWords = significantWords(fixedCustomer.address);
  const nameMatch =
    receiptCustomer.includes(fixedName) ||
    fixedName.includes(receiptCustomer) ||
    nameWords.some((word) => hasNormalizedWord(receiptCustomer, word));
  const addressMatch =
    !fixedAddress ||
    receiptAddress.includes(fixedAddress) ||
    addressWords.some((word) => hasNormalizedWord(receiptAddress, word));

  return Boolean(nameMatch && addressMatch);
}

function fixedCustomerForReceipt(
  receipt: ReceiptSummary,
  fixedCustomers: FixedCustomerSummary[]
) {
  if (!fixedCustomers.length) return null;

  const receiptNumbers = new Set(fixedCustomerNumbersForReceipt(receipt));
  const numberMatch = fixedCustomers.find((fixedCustomer) =>
    fixedCustomer.customerNumbers.some((number) => receiptNumbers.has(number))
  );
  if (numberMatch) return numberMatch;

  return (
    fixedCustomers.find((fixedCustomer) =>
      fixedCustomerMatchesByText(receipt, fixedCustomer)
    ) || null
  );
}

function receiptHasBonDeliveryWindow(receipt: ReceiptSummary) {
  return Boolean(receiptOperationalTime(receipt));
}

function appendRouteNote(base: string, addition: string) {
  const cleanBase = String(base || "").trim();
  const cleanAddition = addition.replace(/\s+/g, " ").trim();
  if (!cleanAddition) return cleanBase;
  if (!cleanBase) return cleanAddition;
  if (/^geen aparte/i.test(cleanBase)) return cleanAddition;

  const normalizedBase = normalizeMatchText(cleanBase);
  const normalizedAddition = normalizeMatchText(cleanAddition);
  if (
    normalizedAddition &&
    normalizedBase.includes(normalizedAddition.slice(0, 80))
  ) {
    return cleanBase;
  }

  return `${cleanBase} · ${cleanAddition}`;
}

function applyFixedCustomerDefaults(
  receipts: ReceiptSummary[],
  fixedCustomers: FixedCustomerSummary[]
): ReceiptSummary[] {
  if (!fixedCustomers.length) return receipts;

  return receipts.map((receipt) => {
    const fixedCustomer = fixedCustomerForReceipt(receipt, fixedCustomers);
    if (!fixedCustomer) return receipt;

    const hasBonTime = receiptHasBonDeliveryWindow(receipt);
    const fixedDeliveryNote =
      !hasBonTime && fixedCustomer.deliveryWindow
        ? `Vaste levertijd ${fixedCustomer.deliveryWindow}`
        : "";
    const fixedRouteNote = fixedCustomer.routeNote
      ? `Vaste route: ${fixedCustomer.routeNote}`
      : "";
    const fixedNotes = [fixedDeliveryNote, fixedRouteNote].filter(Boolean);
    const tags = receipt.tags.includes("vaste klant")
      ? receipt.tags
      : [...receipt.tags, "vaste klant"];

    return {
      ...receipt,
      time:
        hasBonTime || !fixedCustomer.deliveryWindow
          ? receipt.time
          : fixedCustomer.deliveryWindow,
      address: fieldLooksMissing(receipt.address)
        ? fixedCustomer.address || receipt.address
        : receipt.address,
      deliveryAddress: fieldLooksMissing(receipt.deliveryAddress)
        ? fixedCustomer.address || receipt.deliveryAddress
        : receipt.deliveryAddress,
      tags,
      internalNote: fixedNotes.reduce(
        (note, fixedNote) => appendRouteNote(note, fixedNote),
        receipt.internalNote
      ),
    };
  });
}

function buildDayPlan(
  dateState: DateState,
  fileSnapshot: FileSnapshot | null,
  importedBatch: LogisticsBatch | null
): DayPlan {
  const { selectedDate, today, tomorrow, hour, minute } = dateState;
  const isToday = selectedDate === today;
  const isTomorrow = selectedDate === tomorrow;
  const status = fileSnapshot
    ? fileSnapshot.status
    : importedBatch
      ? importedBatch.status
      : isToday
        ? "definitief"
        : isTomorrow
          ? tomorrowStatus(hour, minute)
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
  if (status === "prognose") return "Prognose 08:20";
  if (status === "definitief") return "Definitief 20:00";
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
      value: pressureLabelFor(loadProfile.pressure),
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

function webshopImageDuplicateKey(image: WebshopImageSummary) {
  const photoKey = image.photoUrl.startsWith("data:")
    ? image.photoUrl.slice(0, 4000)
    : image.photoUrl;

  return normalizeMatchText(
    [
      image.deliveryDate,
      image.matchedReceiptId || image.matchedReceiptNumber || image.orderNumber,
      image.customerName,
      image.fileName,
      image.productSummary || "",
      photoKey,
    ]
      .filter(Boolean)
      .join(" ")
  );
}

function uniqueWebshopImages(images: WebshopImageSummary[]) {
  const seen = new Set<string>();

  return images.filter((image) => {
    const key = webshopImageDuplicateKey(image) || image.id;
    if (seen.has(key)) return false;

    seen.add(key);
    return true;
  });
}

function imageMatchesForReceipt(
  receipt: ReceiptSummary,
  webshopImages: WebshopImageSummary[]
) {
  return uniqueWebshopImages(
    webshopImages.filter((image) => imageMatchesReceipt(image, receipt))
  );
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
  if (isArticleSubcodeQuantity(value)) return 0;

  const parsed = Number.parseFloat(value.replace(",", ".").replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function isArticleSubcodeQuantity(value: string) {
  return /^(?:\d{3,9}|[A-Z]{1,4}\d{3,9})[.,][A-Z0-9]{1,8}$/i.test(
    value.trim()
  );
}

function shouldDropReceiptLine(line: ReceiptLine) {
  return isArticleSubcodeQuantity(line.quantity);
}

function deliveryCostDescriptionFrom(value: string) {
  const description = cleanReceiptLineDescription(value);
  const match = description.match(/\bbezorgkosten\b.*$/i);
  if (!match) return "";

  return match[0]
    .replace(/^bezorgkosten\b/i, "Bezorgkosten")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeKnownReceiptLine(line: ReceiptLine): ReceiptLine {
  const deliveryCostDescription = deliveryCostDescriptionFrom(line.description);
  if (!deliveryCostDescription) return line;

  return {
    ...line,
    articleNumber: line.articleNumber || "990010",
    description: deliveryCostDescription,
  };
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

  return /^(?:ja,\s*)?(?:kleur\b|foto\s*\/\s*logo\b|foto\b|logo\b|geschreven\s+tekst\b|tekst\s+op\s+(?:taart|gebak|cake|product)\b|tekst\b|vulling\b|voorsnijden\b)/.test(description);
}

function productOptionKind(value: string) {
  const description = normalizedLineDescription(value);

  if (/^kleur\b/.test(description)) return "kleur";
  if (/^(?:foto\s*\/\s*logo|foto|logo)\b/.test(description)) return "foto";
  if (
    /^(?:geschreven\s+tekst|tekst\s+op\s+(?:taart|gebak|cake|product)|tekst)\b/.test(
      description
    )
  ) {
    return "tekst";
  }
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
    /\b(?:kleur\s+petit\s*fours?|foto\s*\/\s*logo|foto|logo|geschreven\s+tekst|tekst\s+op\s+(?:taart|gebak|cake|product)|tekst|vulling|voorsnijden)\s*:?/i
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

const customerInstructionCuePattern =
  /\b(?:het\s+liefst|graag|s\.?v\.?p\.?|t\.?\s*a\.?\s*v\.?|tav|ter\s+attentie\s+van|opstelling|cr[eè]me\s+stippen|creme\s+stippen|bellen|contact|ceremoniemeester|afdeling|hoofdingang|receptie|ingang|route|voor\s+\d{1,2}[:.]\d{2}\s+(?:leveren|bezorgen|brengen|klaar))\b/i;
const productResidueRemarkPattern =
  /\b(?:gesorteerd|glutenvrij|schuim|taart|tartelette|gebak|bombe|slofje|slof|hazelino|hazelnootbol|bossche\s+bol|tompouce|appel\s+royale|lente\s+parel|steventje|nougatine|pistache|passievol|cheese\s+punt|cremetaart|slagroom|vulling|kleur|bezorgkosten|betaalverzoek|mailen)\b/i;

function isProductResidueDisplayNote(value: string) {
  const clean = value.replace(/\s+/g, " ").trim();
  if (!clean || customerInstructionCuePattern.test(clean)) return false;

  return (
    productResidueRemarkPattern.test(clean) &&
    (/^\d+(?:[.,]\d+)?\s+/.test(clean) ||
      /\s+\d+(?:[.,]\d+)?\.?$/.test(clean) ||
      /(?:^|\s)€\s*[\d.,:]+/.test(clean) ||
      /\b(?:excl\.?\s*btw|btw|totaalprijs|factuurkorting)\b/i.test(clean))
  );
}

function trimDisplayNoteToCustomerInstruction(value: string) {
  const clean = value.replace(/\s+/g, " ").trim();
  const instructionMatch = clean.match(customerInstructionCuePattern);
  if (!instructionMatch || instructionMatch.index === undefined) return clean;
  if (instructionMatch.index <= 0) return clean;

  const prefix = clean.slice(0, instructionMatch.index).trim();
  if (
    isProductResidueDisplayNote(prefix) ||
    productResidueRemarkPattern.test(prefix) ||
    /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(prefix) ||
    /\b(?:btw|totaalprijs|factuurkorting|bezorgkosten)\b/i.test(prefix) ||
    /(?:^|\s)€\s*[\d.,:]+/.test(prefix)
  ) {
    return clean.slice(instructionMatch.index).trim();
  }

  return clean;
}

function stripEmbeddedDisplayDeliveryNoise(value: string) {
  return value
    .replace(
      /\b(?:bezorgen|bezorging|afleveren|aflevering|leveren|levering)\s*[:;]\s*(?=\bt\.?\s*a\.?\s*v\.?\b|\btav\b|\bter\s+attentie\s+van\b)/gi,
      " "
    )
    .replace(
      /\b(?:bezorging|bezorgen|levering|leveren)\s+(?!tussen\b|voor\b|om\b|vanaf\b|kosten\b).*?(?=\bvoor\s+\d{1,2}[:.]\d{2}\s+(?:leveren|bezorgen|brengen)\b)/gi,
      " "
    )
    .replace(
      /\b(?:bezorgen|bezorging|afleveren|aflevering|leveren|levering)\s+(?:tussen|voor|om|vanaf)\s+\d{1,2}[:.]\d{2}(?:\s+(?:en|tot|-)\s+\d{1,2}[:.]\d{2})?.*$/i,
      " "
    )
    .replace(
      /\s+\d+(?:[.,]\s*)?cr[eè]me\s+stippen\s*\([^)]*\)\s+\d+(?=\s*\bvoor\s+\d{1,2}[:.]\d{2}\b)/gi,
      " "
    )
    .replace(
      /\s+cr[eè]me\s+stippen\s*\([^)]*\)\s+\d+(?=\s*\bvoor\s+\d{1,2}[:.]\d{2}\b)/gi,
      " "
    )
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

function pushUniqueReceiptLine(target: ReceiptLine[], incomingLine: ReceiptLine) {
  const line = normalizeKnownReceiptLine(incomingLine);
  if (shouldDropReceiptLine(line)) return;

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
    /\b(?:(\d+(?:[.,]\d+)?)\s+)?((?:kleur\s+petit\s*fours?|foto\s*\/\s*logo|foto|logo|geschreven\s+tekst|tekst\s+op\s+(?:taart|gebak|cake|product)|tekst|vulling|voorsnijden)\s*:?\s*[^€]{1,180})\s+€\s*([\d.,:]+)/gi,
    /(?:€\s*[\d.,:]+\s+)+((?:kleur\s+petit\s*fours?|foto\s*\/\s*logo|foto|logo|geschreven\s+tekst|tekst\s+op\s+(?:taart|gebak|cake|product)|tekst|vulling|voorsnijden)\s*:?\s*.+?)\s+(\d+(?:[.,]\d+)?)\b/gi,
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

    if (shouldDropReceiptLine(normalizedLine)) return;

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
  const size = cakeServingSizeForText(text);
  if (!size) return false;

  return size.min >= 10;
}

function cakeServingSizeForText(text: string) {
  const rangeMatch = text.match(
    /\b(\d{1,2})\s*(?:-|\/|tot|a|t\/m)\s*(\d{1,2})\s*(?:p|pers\.?|personen|persoons)\b/
  );
  if (rangeMatch) {
    return {
      min: Number(rangeMatch[1]),
      max: Number(rangeMatch[2]),
    };
  }

  const sizeMatch = text.match(/\b(\d{1,2})\s*(?:p|pers\.?|personen|persoons)\b/);
  if (!sizeMatch) return null;

  const size = Number(sizeMatch[1]);
  return {
    min: size,
    max: size,
  };
}

function isMarzipanOrCreamCakeDescription(description: string) {
  return (
    (/\bmarsepein/.test(description) && /taart(?:en)?\b/.test(description)) ||
    (/\bslagroom/.test(description) && /taart(?:en)?\b/.test(description)) ||
    /\bcremetaart\b/.test(description) ||
    (/\bcreme\b/.test(description) && /taart(?:en)?\b/.test(description))
  );
}

function isMarzipanOrCreamCakeProductLine(line: ReceiptLine) {
  if (isProductOptionLine(line)) return false;

  return isMarzipanOrCreamCakeDescription(lineSearchDescription(line));
}

function isMarzipanOrCreamCakeLine(line: ReceiptLine) {
  if (!isMarzipanOrCreamCakeProductLine(line)) return false;

  return hasLargeCakeSize(lineSearchDescription(line));
}

function roundPhotoSizePlanForCakeText(text: string) {
  const size = cakeServingSizeForText(text);
  if (!size) {
    return {
      sizeCm: 12,
      minimumSizeCm: 6,
    };
  }

  if (size.max <= 8) {
    return {
      sizeCm: 8,
      minimumSizeCm: 8,
    };
  }

  return {
    sizeCm: 12,
    minimumSizeCm: 6,
  };
}

function isLikelyCakePhotoLine(line: ReceiptLine) {
  if (isProductOptionLine(line)) return false;

  const description = lineSearchDescription(line);

  if (isMarzipanOrCreamCakeProductLine(line)) return true;
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

function escapeHtmlLines(value: string) {
  return escapeHtml(value).replace(/\n/g, "<br />");
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

function isReceiptProductLineForPhoto(line: ReceiptLine) {
  if (isProductOptionLine(line)) return false;
  if (shouldDropReceiptLine(line)) return false;
  if (isPriceOnlyReceiptDescription(line.description)) return false;

  const description = normalizedLineDescription(line.description);
  if (/^bezorgkosten\b/.test(description)) return false;

  return true;
}

function nearbyProductLineForPhoto(
  lines: ReceiptLine[],
  index: number,
  currentProduct: ReceiptLine | null
) {
  if (currentProduct) return currentProduct;

  for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
    if (isReceiptProductLineForPhoto(lines[cursor])) return lines[cursor];
  }
  for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
    if (isReceiptProductLineForPhoto(lines[cursor])) return lines[cursor];
  }

  return null;
}

function addPhotoProductPlan(input: {
  plans: PhotoProductPlan[];
  seen: Set<string>;
  line: ReceiptLine;
  forceRound?: boolean;
  needsCheck?: boolean;
}) {
  const description = lineSearchDescription(input.line);
  const product = cleanProductLabel(input.line.description);
  const copies = printCopiesForLine(input.line);
  const isPetitFourProduct = isPetitFourLine(input.line);
  const isRoundProduct =
    input.forceRound ||
    isMarzipanOrCreamCakeProductLine(input.line) ||
    Boolean(cakeServingSizeForText(description));
  if (!isPetitFourProduct && !isRoundProduct) return;

  const shape: MarzipanPrintShape = isPetitFourProduct ? "square" : "round";
  const cakeSizePlan = roundPhotoSizePlanForCakeText(description);
  const plan: PhotoProductPlan =
    shape === "square"
      ? {
          product,
          shape,
          sizeCm: 3.5,
          minimumSizeCm: 3.5,
          copies,
          needsCheck: Boolean(input.needsCheck),
        }
      : {
          product,
          shape,
          sizeCm: cakeSizePlan.sizeCm,
          minimumSizeCm: cakeSizePlan.minimumSizeCm,
          copies,
          needsCheck: Boolean(input.needsCheck),
        };
  const key = normalizeMatchText(
    [plan.shape, plan.product, plan.sizeCm, plan.copies].join(" ")
  );

  if (input.seen.has(key)) return;
  input.seen.add(key);
  input.plans.push(plan);
}

function photoProductPlansForReceipt(
  receipt: ReceiptSummary,
  options: { requirePhotoSignal?: boolean } = {}
): PhotoProductPlan[] {
  const plans: PhotoProductPlan[] = [];
  const seen = new Set<string>();
  let currentProduct: ReceiptLine | null = null;

  receipt.lines.forEach((line, index) => {
    const description = lineSearchDescription(line);
    const hasPhotoSignal = isPhotoSignalLine(line);
    if (isReceiptProductLineForPhoto(line)) currentProduct = line;

    if (hasPhotoSignal) {
      const productLine = nearbyProductLineForPhoto(
        receipt.lines,
        index,
        currentProduct
      );
      if (productLine && productLine !== line) {
        addPhotoProductPlan({
          plans,
          seen,
          line: productLine,
          forceRound: Boolean(cakeServingSizeForText(lineSearchDescription(productLine))),
        });
      }
    }

    if (
      (!options.requirePhotoSignal || hasPhotoSignal) &&
      (isPetitFourLine(line) ||
        (hasPhotoSignal && /\bpetit\s*-?\s*fours?\b/.test(description)))
    ) {
      addPhotoProductPlan({
        plans,
        seen,
        line,
      });
      return;
    }

    if (
      (!options.requirePhotoSignal || hasPhotoSignal) &&
      (isMarzipanOrCreamCakeProductLine(line) ||
        (hasPhotoSignal &&
          /taart|marsepein|slagroom/.test(description)))
    ) {
      addPhotoProductPlan({
        plans,
        seen,
        line,
        needsCheck: !isMarzipanOrCreamCakeProductLine(line),
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
    const isCertainCakeLine = isMarzipanOrCreamCakeProductLine(line);
    const cakeSizePlan = roundPhotoSizePlanForCakeText(description);

    plans.push({
      product: cleanProductLabel(line.description),
      shape: "round",
      sizeCm: cakeSizePlan.sizeCm,
      minimumSizeCm: cakeSizePlan.minimumSizeCm,
      copies: printCopiesForLine(line),
      needsCheck: !isCertainCakeLine && !cakeServingSizeForText(description),
    });
  });

  return plans.slice(0, 4);
}

function fallbackPhotoProductPlan(needsCheck = true): PhotoProductPlan {
  return {
    product: needsCheck ? "Foto controleren" : "Marsepeinfoto",
    shape: "round",
    sizeCm: 12,
    minimumSizeCm: 6,
    copies: 1,
    needsCheck,
  };
}

function photoProductSummaryForReceipt(receipt: ReceiptSummary) {
  const strictPlans = photoProductPlansForReceipt(receipt, {
    requirePhotoSignal: true,
  });
  const plans =
    strictPlans.length > 0 ? strictPlans : inferredPhotoProductPlansForReceipt(receipt);

  return plans
    .map((plan) => `${plan.copies}x ${plan.product}`)
    .join(" · ")
    .slice(0, 500);
}

function receiptNeedsManualPhotoUpload(receipt: ReceiptSummary) {
  return (
    photoProductPlansForReceipt(receipt, { requirePhotoSignal: true }).length > 0
  );
}

function isManualUploadedWebshopImage(image: WebshopImageSummary) {
  return (
    image.messageId.startsWith("manual-mail-photo:") ||
    image.id.startsWith("manual-mail-photo-")
  );
}

function imageElementForFile(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Foto kon niet worden gelezen."));
    };
    image.src = objectUrl;
  });
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number
) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Foto kon niet worden voorbereid."));
      },
      type,
      quality
    );
  });
}

async function prepareManualPhotoUploadFile(file: File) {
  if (!file.type.startsWith("image/")) {
    throw new Error("Kies een JPG, PNG of WEBP foto.");
  }

  const acceptedType = ["image/jpeg", "image/png", "image/webp"].includes(
    file.type.toLowerCase()
  );
  if (acceptedType && file.size <= MAX_MANUAL_PHOTO_UPLOAD_BYTES) return file;

  const image = await imageElementForFile(file);
  const maxSide = 1600;
  const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Foto kon niet worden voorbereid.");

  canvas.width = width;
  canvas.height = height;
  context.fillStyle = "#fff";
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);

  const baseName = file.name.replace(/\.[^.]+$/, "") || "mailfoto";
  let smallestBlob = await canvasToBlob(canvas, "image/jpeg", 0.88);

  for (const quality of [0.78, 0.68]) {
    if (smallestBlob.size <= MAX_MANUAL_PHOTO_UPLOAD_BYTES) break;
    smallestBlob = await canvasToBlob(canvas, "image/jpeg", quality);
  }

  if (smallestBlob.size > MAX_MANUAL_PHOTO_UPLOAD_BYTES) {
    throw new Error("Foto is te groot. Maak hem iets kleiner en probeer opnieuw.");
  }

  return new File([smallestBlob], `${baseName}.jpg`, {
    type: "image/jpeg",
  });
}

function distributedCopyCount(
  copies: number,
  imageIndex: number,
  imageCount: number
) {
  if (imageCount <= 1) return copies;
  if (copies <= 0) return 0;

  const base = Math.floor(copies / imageCount);
  const remainder = copies % imageCount;

  return Math.max(0, base + (imageIndex < remainder ? 1 : 0));
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
  const copyTotal = Math.max(0, Math.round(input.copyTotal));
  if (copyTotal <= 0) return;

  const customerName =
    input.image.customerName || input.receipt?.customer || "Klant controleren";
  const receiptNumber = input.receipt?.receiptNumber || input.receipt?.id || "";

  for (let copy = 1; copy <= copyTotal; copy += 1) {
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
      minimumSizeCm: input.plan.minimumSizeCm,
      copyNumber: copy,
      copyTotal,
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

function cleanWrittenTextSource(value: string) {
  return value
    .replace(/trial mode\s*[–-]\s*click here for more information/gi, "")
    .replace(/\btrial mode\b\s*[–-]?/gi, "")
    .replace(/click here for more information/gi, "")
    .replace(/(?:€\s*)?[\d.,:]+\s*€/g, " ")
    .replace(/€\s*[\d.,:]+/g, " ")
    .replace(/&euro;\s*[\d.,:]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function writtenTextSignalMatch(value: string) {
  return cleanWrittenTextSource(value).match(
    /(?:^|[\s'"“”‘’])((?:geschreven\s+tekst|tekst\s+op\s+(?:taart|gebak|cake|product)|tekst)\b)/i
  );
}

function writtenTextValueFromSource(value: string) {
  const clean = cleanWrittenTextSource(value);
  const match = writtenTextSignalMatch(clean);
  if (!match || match.index === undefined) return null;

  const labelStart = match.index + match[0].indexOf(match[1]);
  const afterLabel = clean.slice(labelStart + match[1].length);
  const text = afterLabel
    .replace(/^\s*[,;:.-]\s*/, "")
    .replace(/^ja\b\s*[,;:.-]?\s*/i, "")
    .replace(
      /\s+(?:kleur\s+petit\s*fours?|foto\s*\/\s*logo|foto|logo|vulling|voorsnijden|bezorgkosten)\b.*$/i,
      ""
    )
    .replace(/\s+/g, " ")
    .trim();
  const needsCheck = !text || /^(?:ja|nee|nvt|n\.v\.t\.|-)?$/i.test(text);

  return {
    text: needsCheck ? "Tekst controleren" : text,
    needsCheck,
  };
}

function isWrittenTextSignalLine(value: string) {
  return Boolean(writtenTextSignalMatch(value));
}

function isReceiptProductLineForWrittenText(line: ReceiptLine) {
  if (isProductOptionLine(line)) return false;
  if (shouldDropReceiptLine(line)) return false;
  if (isPriceOnlyReceiptDescription(line.description)) return false;

  const description = normalizedLineDescription(line.description);
  if (/^bezorgkosten\b/.test(description)) return false;

  return true;
}

function writtenTextProductLabel(line: ReceiptLine | null | undefined) {
  if (!line) return "Product controleren";

  return (
    cleanProductLabel(line.description)
      .replace(
        /\b(?:geschreven\s+tekst|tekst\s+op\s+(?:taart|gebak|cake|product)|tekst)\b.*$/i,
        ""
      )
      .replace(/\s+/g, " ")
      .trim() || "Product controleren"
  );
}

function nearbyProductLineForWrittenText(
  lines: ReceiptLine[],
  index: number,
  currentProduct: ReceiptLine | null
) {
  if (currentProduct) return currentProduct;

  for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
    if (isReceiptProductLineForWrittenText(lines[cursor])) return lines[cursor];
  }
  for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
    if (isReceiptProductLineForWrittenText(lines[cursor])) return lines[cursor];
  }

  return null;
}

function pushWrittenTextPrintItem(input: {
  items: WrittenTextPrintItem[];
  seen: Set<string>;
  receipt: ReceiptSummary;
  productLine: ReceiptLine | null;
  sourceIndex: number;
  text: string;
  needsCheck: boolean;
}) {
  const product = writtenTextProductLabel(input.productLine);
  const quantity = input.productLine?.quantity || "1";
  const receiptNumber = input.receipt.receiptNumber || input.receipt.id || "";
  const sourceLabel = [
    receiptNumber ? `bon ${receiptNumber}` : "",
    receiptListTimeLabel(input.receipt),
  ]
    .filter(Boolean)
    .join(" · ");
  const key = normalizeMatchText(
    [
      input.receipt.id,
      receiptNumber,
      input.receipt.customer,
      product,
      input.text,
    ].join(" ")
  );

  if (input.seen.has(key)) return;
  input.seen.add(key);

  input.items.push({
    id: `${input.receipt.id || receiptNumber || "bon"}-tekst-${input.sourceIndex}`,
    customerName: input.receipt.customer || "Klant controleren",
    customerLastName: customerLastNameFor(input.receipt.customer),
    receiptNumber,
    product,
    quantity,
    text: input.text,
    sourceLabel,
    needsCheck: input.needsCheck,
  });
}

function buildWrittenTextPrintItems(receipts: ReceiptSummary[]) {
  const items: WrittenTextPrintItem[] = [];
  const seen = new Set<string>();

  receipts.forEach((receipt) => {
    const lines = receipt.lines
      .map(normalizeKnownReceiptLine)
      .filter((line) => !shouldDropReceiptLine(line));
    let currentProduct: ReceiptLine | null = null;

    lines.forEach((line, index) => {
      const lineIsTextOption =
        isProductOptionLine(line) || isWrittenTextSignalLine(line.description);
      if (!lineIsTextOption && isReceiptProductLineForWrittenText(line)) {
        currentProduct = line;
      }

      const productLine = lineIsTextOption
        ? nearbyProductLineForWrittenText(lines, index, currentProduct)
        : line;
      const sources = [line.description, line.note || ""].filter(Boolean);

      sources.forEach((source, sourceIndex) => {
        const textResult = writtenTextValueFromSource(source);
        if (!textResult) return;

        pushWrittenTextPrintItem({
          items,
          seen,
          receipt,
          productLine,
          sourceIndex: index * 10 + sourceIndex,
          text: textResult.text,
          needsCheck: textResult.needsCheck,
        });
      });
    });

    const fallbackProduct =
      lines.find(isMarzipanOrCreamCakeLine) ||
      lines.find(isPetitFourLine) ||
      lines.find(isReceiptProductLineForWrittenText) ||
      null;
    [receipt.customerNote, receipt.internalNote, receipt.note]
      .filter(Boolean)
      .forEach((source, sourceIndex) => {
        const textResult = writtenTextValueFromSource(source);
        if (!textResult) return;

        pushWrittenTextPrintItem({
          items,
          seen,
          receipt,
          productLine: fallbackProduct,
          sourceIndex: 1000 + sourceIndex,
          text: textResult.text,
          needsCheck: true,
        });
      });
  });

  return items;
}

function formatPrintCm(value: number) {
  return Number.isInteger(value)
    ? String(value)
    : String(Number(value.toFixed(1))).replace(".", ",");
}

function roundPrintSizeCmForItem(
  item: MarzipanPrintItem,
  roundItems: MarzipanPrintItem[]
) {
  if (item.shape !== "round") return item.sizeCm;
  if (item.minimumSizeCm >= item.sizeCm) return item.sizeCm;

  const scalableRoundCount = roundItems.filter(
    (roundItem) => roundItem.minimumSizeCm < roundItem.sizeCm
  ).length;
  if (scalableRoundCount >= 5) return Math.max(item.minimumSizeCm, 6);
  if (scalableRoundCount >= 3) return Math.max(item.minimumSizeCm, 10);

  return item.sizeCm;
}

function formatCssCm(value: number) {
  return `${Number(value.toFixed(2))}cm`;
}

function diagonalRoundLayoutFor(
  roundItems: MarzipanPrintItem[],
  printSizeCmById: Map<string, number>
) {
  if (roundItems.length !== 2) return null;

  const [first, second] = roundItems;
  const firstSize = printSizeCmById.get(first.id) || first.sizeCm;
  const secondSize = printSizeCmById.get(second.id) || second.sizeCm;
  const pageWidth = 20;
  if (firstSize + secondSize <= pageWidth) return null;

  const secondLeft = Math.max(0, pageWidth - secondSize);
  const centerDistanceX = Math.abs(
    secondLeft + secondSize / 2 - firstSize / 2
  );
  const requiredCenterDistance = (firstSize + secondSize) / 2;
  const secondTop =
    Math.sqrt(
      Math.max(
        0,
        requiredCenterDistance * requiredCenterDistance -
          centerDistanceX * centerDistanceX
      )
    ) +
    firstSize / 2 -
    secondSize / 2 +
    0.3;
  const labelHeight = 1.9;
  const height = Math.max(
    firstSize + labelHeight,
    secondTop + secondSize + labelHeight
  );

  return {
    className: "diagonal",
    sectionStyle: `height:${formatCssCm(height)}`,
    itemStyleById: new Map<string, string>([
      [first.id, "left:0;top:0;"],
      [
        second.id,
        `left:${formatCssCm(secondLeft)};top:${formatCssCm(secondTop)};`,
      ],
    ]),
  };
}

function marzipanPrintSizeLabel(
  item: MarzipanPrintItem,
  printSizeCm = item.sizeCm
) {
  if (item.shape === "square") return "ca. 3,8 cm vierkant";

  const printLabel = `${formatPrintCm(printSizeCm)} cm rond`;
  if (printSizeCm < item.sizeCm) {
    return `${printLabel} · geschaald vanaf ${formatPrintCm(item.sizeCm)} cm`;
  }

  return printLabel;
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

  const roundPrintSizeCmById = new Map(
    roundItems.map((item) => [item.id, roundPrintSizeCmForItem(item, roundItems)])
  );
  const diagonalRoundLayout = diagonalRoundLayoutFor(
    roundItems,
    roundPrintSizeCmById
  );

  const printItemHtmlFor = (item: MarzipanPrintItem, includeLabel = false) => {
    const copyLabel = item.copyTotal > 1 ? ` · ${item.copyTotal}x totaal` : "";
    const sourceLabel = sourceLabelFor(item);
    const printSizeCm =
      item.shape === "round"
        ? roundPrintSizeCmById.get(item.id) || item.sizeCm
        : item.sizeCm;
    const layoutStyle =
      item.shape === "round"
        ? diagonalRoundLayout?.itemStyleById.get(item.id) || ""
        : "";

    return `
      <article class="print-item ${item.shape} ${includeLabel ? "" : "no-label"} ${item.needsCheck ? "needs-check" : ""}" style="--item-size:${printSizeCm}cm;${layoutStyle}">
        <div class="photo-frame">
          <img src="${escapeAttribute(item.photoUrl)}" alt="${escapeAttribute(item.customerName)}">
        </div>
        ${
          includeLabel
            ? `<div class="label">
                <strong>${escapeHtml(item.customerLastName)}</strong>
                <span>${escapeHtml(item.product)}</span>
                <small>${escapeHtml(marzipanPrintSizeLabel(item, printSizeCm))}${escapeHtml(copyLabel)}</small>
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
      ? `<section class="round-grid ${diagonalRoundLayout?.className || ""}" style="${diagonalRoundLayout?.sectionStyle || ""}">
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
      @page { margin: 5mm; size: A4 portrait; }
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
        padding: 6mm 5mm 10mm;
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
        column-gap: 0;
        row-gap: 4mm;
        margin-top: 4mm;
      }
      .round-grid.diagonal {
        display: block;
        position: relative;
        width: 200mm;
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
      .round-grid.diagonal .round {
        position: absolute;
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
        margin-top: 1mm;
        overflow-wrap: anywhere;
        padding-right: 2mm;
      }
      .round-grid.diagonal .label {
        max-width: 76mm;
        padding-right: 0;
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
          width: 200mm;
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
        <p>${input.items.length} printstukken · petit four ca. 3,8 cm · taart 6-12 cm rond</p>
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

function createWrittenTextPrintHtml(input: {
  items: WrittenTextPrintItem[];
  plan: DayPlan;
}) {
  const title = `Geschreven teksten ${formatDateLabel(input.plan.date)}`;
  const itemsHtml = input.items
    .map((item, index) => {
      const quantityLabel =
        item.quantity && item.quantity !== "1" ? `${item.quantity}x ` : "";

      return `
        <article class="text-item ${item.needsCheck ? "needs-check" : ""}">
          <div class="item-top">
            <span class="number">${index + 1}</span>
            <div>
              <strong>${escapeHtml(item.customerLastName)}</strong>
              <small>${escapeHtml(item.sourceLabel || item.customerName)}</small>
            </div>
          </div>
          <div class="written-text">${escapeHtml(item.text)}</div>
          <div class="product-line">
            <strong>${escapeHtml(`${quantityLabel}${item.product}`)}</strong>
            <span>${escapeHtml(item.customerName)}</span>
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
      @page { margin: 10mm; size: A4 portrait; }
      * { box-sizing: border-box; }
      body {
        background: #fff;
        color: #111;
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
      .screen-actions .secondary {
        background: #fff;
        border: 1px solid #111;
        color: #111;
      }
      main {
        margin: 0 auto;
        max-width: 210mm;
        padding: 8mm 10mm;
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
        font-size: 18px;
        margin: 0;
      }
      .sheet-header p {
        font-size: 10px;
        font-weight: 700;
        margin: 0;
      }
      .text-grid {
        display: grid;
        gap: 4mm;
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
      .text-item {
        border: 0.35mm solid #111;
        break-inside: avoid;
        min-height: 48mm;
        padding: 4mm;
        page-break-inside: avoid;
      }
      .text-item.needs-check {
        border-style: dashed;
      }
      .item-top {
        align-items: center;
        display: flex;
        gap: 3mm;
      }
      .number {
        align-items: center;
        background: #111;
        color: #fff;
        display: inline-flex;
        font-size: 12px;
        font-weight: 900;
        height: 8mm;
        justify-content: center;
        width: 8mm;
      }
      .item-top strong,
      .item-top small,
      .product-line strong,
      .product-line span {
        display: block;
      }
      .item-top strong {
        font-size: 13px;
      }
      .item-top small,
      .product-line span {
        color: #444;
        font-size: 9px;
        font-weight: 700;
        margin-top: 0.7mm;
      }
      .written-text {
        align-items: center;
        border-bottom: 0.25mm solid #ddd;
        border-top: 0.25mm solid #ddd;
        display: flex;
        font-size: 22px;
        font-weight: 900;
        line-height: 1.14;
        margin: 4mm 0;
        min-height: 18mm;
        overflow-wrap: anywhere;
        padding: 3mm 0;
      }
      .product-line strong {
        font-size: 12px;
        line-height: 1.2;
      }
      @media print {
        .screen-actions { display: none; }
        main {
          max-width: none;
          padding: 0;
        }
      }
    </style>
  </head>
  <body>
    <div class="screen-actions">
      <h1>${escapeHtml(title)} · ${input.items.length} tekst${input.items.length === 1 ? "" : "en"}</h1>
      <div>
        <button type="button" class="secondary" onclick="if (window.opener) window.close(); else window.history.back();">Terug</button>
        <button type="button" onclick="window.print()">Afdrukken</button>
      </div>
    </div>
    <main>
      <div class="sheet-header">
        <h1>${escapeHtml(title)}</h1>
        <p>${input.items.length} geschreven tekst${input.items.length === 1 ? "" : "en"}</p>
      </div>
      <section class="text-grid">
        ${itemsHtml}
      </section>
    </main>
  </body>
</html>`;
}

function openWrittenTextSheet(plan: DayPlan, items: WrittenTextPrintItem[]) {
  if (items.length === 0) {
    window.alert("Geen geschreven teksten gevonden voor deze dag.");
    return;
  }

  const printWindow = window.open("", "_blank", "width=1000,height=800");
  if (!printWindow) {
    window.alert("Tekstvenster kon niet geopend worden.");
    return;
  }

  printWindow.document.write(createWrittenTextPrintHtml({ items, plan }));
  printWindow.document.close();
  printWindow.focus();
}

function normalizePreparationCode(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function receiptLineArticleParts(line: ReceiptLine) {
  const article = String(line.articleNumber || "").trim();
  const articleMatch = article.match(
    /^([A-Z]{0,4}\d{3,9})(?:[.,]([A-Z0-9]{1,8}))?$/i
  );
  const descriptionMatch = String(line.description || "")
    .trim()
    .match(/^([A-Z]{0,4}\d{3,9})(?:[.,]([A-Z0-9]{1,8}))?\s+/i);
  const noteSubcodeMatch = String(line.note || "").match(
    /\bsubcode\s*[:#-]?\s*([A-Z0-9]{1,8})\b/i
  );
  const articleNumber = normalizePreparationCode(
    articleMatch?.[1] || descriptionMatch?.[1] || article
  );
  const subcode = normalizePreparationCode(
    articleMatch?.[2] || descriptionMatch?.[2] || noteSubcodeMatch?.[1] || ""
  );

  return { articleNumber, subcode };
}

function preparationRuleMatchesLine(rule: PreparationRule, line: ReceiptLine) {
  const { articleNumber, subcode } = receiptLineArticleParts(line);
  const ruleArticle = normalizePreparationCode(rule.articleNumber || "");
  const ruleSubcode = normalizePreparationCode(rule.subcode || "");

  if (ruleArticle && ruleSubcode) {
    return (
      (articleNumber === ruleArticle && subcode === ruleSubcode) ||
      articleNumber === `${ruleArticle}${ruleSubcode}`
    );
  }
  if (ruleArticle && articleNumber !== ruleArticle) return false;
  if (ruleSubcode && subcode !== ruleSubcode) return false;

  return Boolean(ruleArticle || ruleSubcode);
}

function preparationItemKeyFor(rule: PreparationRule, line: ReceiptLine) {
  const { articleNumber, subcode } = receiptLineArticleParts(line);
  const description = cleanProductLabel(cleanReceiptLineDescription(line.description));
  const productKey = rule.subcode && !rule.articleNumber
    ? `${articleNumber}|${subcode}|${normalizeMatchText(description)}`
    : `${rule.code}|${normalizeMatchText(description)}`;

  return `${rule.category}|${rule.code}|${productKey}`;
}

function buildPreparationItems(
  receipts: ReceiptSummary[],
  category: PreparationCategory
) {
  const rules = preparationRules.filter((rule) => rule.category === category);
  const ruleIndex = new Map(rules.map((rule, index) => [rule.code, index]));
  const itemsByKey = new Map<string, PreparationItem>();

  receipts.forEach((receipt) => {
    const displayLines = receipt.lines
      .map(normalizeKnownReceiptLine)
      .filter((line) => !shouldDropReceiptLine(line));

    displayLines.forEach((line) => {
      if (isProductOptionLine(line)) return;

      const quantity = numericQuantity(line.quantity);
      if (quantity <= 0) return;

      rules.forEach((rule) => {
        if (!preparationRuleMatchesLine(rule, line)) return;

        const key = preparationItemKeyFor(rule, line);
        const { articleNumber, subcode } = receiptLineArticleParts(line);
        const source = {
          receiptNumber: receipt.receiptNumber || receipt.id,
          customerName: receipt.customer || "Klant controleren",
          quantity,
        };
        const existing = itemsByKey.get(key);

        if (existing) {
          existing.quantity += quantity;
          existing.sources.push(source);
          return;
        }

        itemsByKey.set(key, {
          id: key,
          category,
          rule,
          articleNumber,
          subcode,
          description:
            cleanProductLabel(cleanReceiptLineDescription(line.description)) ||
            rule.label,
          quantity,
          sources: [source],
        });
      });
    });
  });

  return Array.from(itemsByKey.values()).sort((first, second) => {
    const ruleCompare =
      (ruleIndex.get(first.rule.code) ?? 999) -
      (ruleIndex.get(second.rule.code) ?? 999);

    if (ruleCompare) return ruleCompare;

    return first.description.localeCompare(second.description, "nl-NL");
  });
}

function formatPreparationQuantity(value: number) {
  return value.toLocaleString("nl-NL", {
    maximumFractionDigits: Number.isInteger(value) ? 0 : 1,
    minimumFractionDigits: 0,
  });
}

function preparationCodeLabelFor(item: PreparationItem) {
  if (item.rule.articleNumber && item.rule.subcode) {
    return `${item.rule.articleNumber}.${item.rule.subcode}`;
  }

  const parts = [
    item.articleNumber,
    item.subcode ? `.${item.subcode}` : "",
  ].filter(Boolean);

  return parts.join("") || item.rule.code;
}

function preparationSourcesFor(item: PreparationItem) {
  const sourceByKey = new Map<string, PreparationSource>();

  item.sources.forEach((source) => {
    const key = `${source.receiptNumber}|${source.customerName}`;
    const existing = sourceByKey.get(key);
    if (existing) {
      existing.quantity += source.quantity;
      return;
    }

    sourceByKey.set(key, { ...source });
  });

  return Array.from(sourceByKey.values()).sort((first, second) =>
    first.customerName.localeCompare(second.customerName, "nl-NL")
  );
}

function createPreparationPrintHtml(input: {
  category: PreparationCategory;
  items: PreparationItem[];
  plan: DayPlan;
}) {
  const category = preparationCategories[input.category];
  const title = `${category.label} ${formatDateLabel(input.plan.date)}`;
  const rowsHtml = input.items
    .map((item, index) => {
      const sources = preparationSourcesFor(item);
      const sourceHtml = sources
        .slice(0, 8)
        .map(
          (source) =>
            `<span>${escapeHtml(formatPreparationQuantity(source.quantity))}x ${escapeHtml(
              source.customerName
            )}${source.receiptNumber ? ` · bon ${escapeHtml(source.receiptNumber)}` : ""}</span>`
        )
        .join("");
      const moreLabel =
        sources.length > 8
          ? `<span>+ ${sources.length - 8} extra bon${sources.length - 8 === 1 ? "" : "nen"}</span>`
          : "";

      return `
        <tr>
          <td class="check"><span></span></td>
          <td class="number">${index + 1}</td>
          <td class="quantity">${escapeHtml(formatPreparationQuantity(item.quantity))}</td>
          <td>
            <strong>${escapeHtml(item.description)}</strong>
            <small>${escapeHtml(item.rule.label)} · ${escapeHtml(preparationCodeLabelFor(item))}</small>
          </td>
          <td class="sources">${sourceHtml}${moreLabel}</td>
        </tr>
      `;
    })
    .join("");

  return `<!doctype html>
<html lang="nl">
  <head>
    <meta charset="utf-8">
    <title>${escapeHtml(title)}</title>
    <style>
      @page { margin: 10mm; size: A4 portrait; }
      * { box-sizing: border-box; }
      body {
        background: #fff;
        color: #111;
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
      .screen-actions .secondary {
        background: #fff;
        border: 1px solid #111;
        color: #111;
      }
      main {
        margin: 0 auto;
        max-width: 210mm;
        padding: 8mm 10mm;
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
        font-size: 18px;
        margin: 0;
      }
      .sheet-header p {
        font-size: 10px;
        font-weight: 700;
        margin: 0;
      }
      table {
        border-collapse: collapse;
        font-size: 10pt;
        width: 100%;
      }
      th {
        border-bottom: 2px solid #111;
        font-size: 8pt;
        padding: 0 2mm 2mm;
        text-align: left;
        text-transform: uppercase;
      }
      td {
        border-bottom: 1px solid #ddd;
        padding: 2mm;
        vertical-align: top;
      }
      .check {
        width: 9mm;
      }
      .check span {
        border: 1.4px solid #111;
        display: block;
        height: 5mm;
        width: 5mm;
      }
      .number {
        color: #666;
        font-size: 8pt;
        font-weight: 800;
        width: 10mm;
      }
      .quantity {
        font-size: 15pt;
        font-weight: 900;
        text-align: right;
        width: 18mm;
      }
      strong {
        display: block;
        font-size: 11pt;
        line-height: 1.15;
      }
      small {
        color: #555;
        display: block;
        font-size: 8pt;
        font-weight: 700;
        margin-top: 1mm;
      }
      .sources {
        color: #333;
        font-size: 8pt;
        line-height: 1.28;
        width: 58mm;
      }
      .sources span {
        display: block;
      }
      @media print {
        .screen-actions { display: none; }
        main {
          max-width: none;
          padding: 0;
        }
      }
    </style>
  </head>
  <body>
    <div class="screen-actions">
      <h1>${escapeHtml(title)} · ${input.items.length} regel${input.items.length === 1 ? "" : "s"}</h1>
      <div>
        <button type="button" class="secondary" onclick="if (window.opener) window.close(); else window.history.back();">Terug</button>
        <button type="button" onclick="window.print()">Afdrukken</button>
      </div>
    </div>
    <main>
      <div class="sheet-header">
        <h1>${escapeHtml(title)}</h1>
        <p>${input.items.length} voorbereidregel${input.items.length === 1 ? "" : "s"}</p>
      </div>
      <table>
        <thead>
          <tr>
            <th></th>
            <th>#</th>
            <th>Aantal</th>
            <th>Product</th>
            <th>Bonnen</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </main>
  </body>
</html>`;
}

function openPreparationSheet(
  plan: DayPlan,
  receipts: ReceiptSummary[],
  category: PreparationCategory
) {
  const items = buildPreparationItems(receipts, category);
  if (items.length === 0) {
    window.alert(preparationCategories[category].emptyLabel);
    return;
  }

  const printWindow = window.open("", "_blank", "width=1000,height=800");
  if (!printWindow) {
    window.alert("Voorbereidingslijst kon niet geopend worden.");
    return;
  }

  printWindow.document.write(
    createPreparationPrintHtml({ category, items, plan })
  );
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
          const detailParts = routePrintTimeParts(stop);
          const timeBadge = routePrintTimeBadgeHtml(stop);
          const badges = stop.badges.length
            ? `<small class="badges">${escapeHtml(stop.badges.join(" · "))}</small>`
            : "";

          return `
            <tr>
              <td class="check"><span></span></td>
              <td class="nr">${index + 1}</td>
              <td class="stop">
                <strong>${escapeHtml(stop.label)}</strong>
                ${timeBadge}
                <small>${escapeHtml(detailParts.detail)}</small>
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
      .time-badge {
        background: #111;
        color: #fff;
        display: inline-block;
        font-size: 11px;
        font-weight: 900;
        letter-spacing: 0;
        margin: 0.8mm 0;
        padding: 0.7mm 1.4mm;
        text-transform: uppercase;
      }
      .time-badge.urgent {
        background: #b42318;
        font-size: 12px;
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

function createReceiptPrintHtml(input: {
  notes: string[];
  receipt: ReceiptSummary;
  selectedPlan: DayPlan;
}) {
  const { notes, receipt, selectedPlan } = input;
  const receiptNumber = receipt.receiptNumber || receipt.id;
  const displayLines = receipt.lines
    .map(normalizeKnownReceiptLine)
    .filter((line) => !shouldDropReceiptLine(line));
  const title = `Contantbon ${receiptNumber}`;
  const rowsHtml = displayLines
    .map((line) => {
      const total = receiptLineTotal(line);
      const optionClass = isProductOptionLine(line) ? " option" : "";

      return `<tr class="${optionClass}">
        <td>${escapeHtml(line.quantity)}</td>
        <td>${escapeHtml(line.articleNumber || "")}</td>
        <td>
          <strong>${escapeHtml(line.description)}</strong>
          ${line.note ? `<small>${escapeHtml(line.note)}</small>` : ""}
        </td>
        <td>${line.unitPrice !== undefined ? escapeHtml(formatReceiptMoney(line.unitPrice)) : ""}</td>
        <td>${total !== undefined ? escapeHtml(formatReceiptMoney(total)) : ""}</td>
      </tr>`;
    })
    .join("");
  const notesHtml = notes.length
    ? `<section class="notes">${notes.map((note) => `<p>${escapeHtml(note)}</p>`).join("")}</section>`
    : "";
  const target = fulfillmentTargetFor(receipt);

  return `<!doctype html>
<html lang="nl">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <style>
      * { box-sizing: border-box; }
      body {
        background: #f4f1ec;
        color: #111;
        font-family: Arial, Helvetica, sans-serif;
        margin: 0;
      }
      .screen-actions {
        align-items: center;
        background: #171512;
        color: #fff;
        display: flex;
        gap: 12px;
        justify-content: space-between;
        padding: 12px 16px;
      }
      .screen-actions h1 {
        font-size: 16px;
        margin: 0;
      }
      .action-buttons {
        display: flex;
        gap: 8px;
      }
      button {
        background: #fff;
        border: 1px solid #fff;
        color: #171512;
        cursor: pointer;
        font: 800 12px Arial, Helvetica, sans-serif;
        padding: 8px 12px;
        text-transform: uppercase;
      }
      button.secondary {
        background: transparent;
        color: #fff;
      }
      main {
        margin: 0 auto;
        max-width: 210mm;
        min-height: 297mm;
        padding: 12mm;
      }
      .receipt {
        background: #fff;
        border: 1px solid #111;
        box-shadow: 0 12px 36px rgba(0,0,0,0.12);
        min-height: 270mm;
        padding: 10mm;
      }
      .top {
        border: 2px solid #111;
        border-bottom-width: 7px;
        display: grid;
        gap: 10mm;
        grid-template-columns: 1fr auto 1fr;
        padding: 4mm 6mm;
      }
      .top h1 {
        font-size: 28pt;
        line-height: 1;
        margin: 0;
        text-align: center;
      }
      .top p {
        font-size: 10pt;
        font-weight: 800;
        line-height: 1.15;
        margin: 0;
      }
      .top .right {
        text-align: right;
      }
      .meta {
        display: grid;
        gap: 8mm;
        grid-template-columns: minmax(0,1fr) auto;
        padding: 8mm 2mm 7mm;
      }
      .customer {
        font-size: 17pt;
        font-weight: 900;
        line-height: 1.1;
        margin: 0;
      }
      .address {
        font-size: 11pt;
        font-weight: 800;
        line-height: 1.3;
        margin: 2mm 0 0;
        white-space: pre-line;
      }
      .date {
        font-size: 14pt;
        font-weight: 900;
        margin: 0;
        text-align: right;
      }
      table {
        border-collapse: collapse;
        font-size: 11pt;
        width: 100%;
      }
      th {
        border-bottom: 2px solid #bdbdbd;
        font-weight: 400;
        padding: 0 2mm 2mm;
        text-align: left;
      }
      td {
        padding: 1.1mm 2mm;
        vertical-align: top;
      }
      td:first-child {
        font-weight: 900;
        text-align: right;
        width: 16mm;
      }
      td:nth-child(2) {
        color: #333;
        width: 24mm;
      }
      th:nth-child(4),
      th:nth-child(5),
      td:nth-child(4),
      td:nth-child(5) {
        text-align: right;
        white-space: nowrap;
        width: 28mm;
      }
      tr.option td,
      tr.option strong {
        font-style: italic;
        font-weight: 400;
      }
      small {
        color: #333;
        display: block;
        font-size: 9pt;
        font-weight: 400;
        line-height: 1.25;
        margin-top: 1mm;
      }
      .total {
        border-top: 2px solid #bdbdbd;
        display: grid;
        font-size: 15pt;
        font-weight: 400;
        gap: 16mm;
        grid-template-columns: minmax(0,1fr) auto;
        margin-left: auto;
        margin-top: 5mm;
        max-width: 82mm;
        padding-top: 4mm;
      }
      .total strong {
        font-weight: 900;
      }
      .notes {
        border-top: 1px solid #d0d0d0;
        margin-top: 8mm;
        padding: 5mm 10mm 0;
        text-align: center;
      }
      .notes p {
        color: #333;
        font-size: 11pt;
        font-style: italic;
        line-height: 1.35;
        margin: 0 0 1.5mm;
      }
      .fulfillment {
        background: #f2f1ee;
        border: 1px solid #bfbcb5;
        border-left: 4px solid #bfbcb5;
        margin-top: 12mm;
        padding: 7mm;
        text-align: center;
      }
      .fulfillment h2 {
        font-size: 20pt;
        line-height: 1.1;
        margin: 0;
      }
      .fulfillment p {
        font-size: 22pt;
        font-weight: 900;
        line-height: 1.12;
        margin: 2mm 0 0;
        text-transform: uppercase;
      }
      @media print {
        @page { margin: 8mm; size: A4 portrait; }
        body { background: #fff; }
        .screen-actions { display: none; }
        main {
          max-width: none;
          min-height: auto;
          padding: 0;
        }
        .receipt {
          border: 0;
          box-shadow: none;
          min-height: auto;
          padding: 0;
        }
      }
    </style>
  </head>
  <body>
    <div class="screen-actions">
      <h1>${escapeHtml(title)} · ${escapeHtml(receipt.customer)}</h1>
      <div class="action-buttons">
        <button type="button" class="secondary" onclick="if (window.opener) window.close(); else window.history.back();">Terug</button>
        <button type="button" onclick="window.print()">Afdrukken</button>
      </div>
    </div>
    <main>
      <article class="receipt">
        <header class="top">
          <div>
            <p>Strik Patisserie BV</p>
            <p>Ambachtsweg 4</p>
            <p>6581 AX&nbsp;&nbsp; MALDEN</p>
          </div>
          <div>
            <h1>Contantbon</h1>
            <p style="text-align:center;margin-top:2mm;">BON ${escapeHtml(receiptNumber)}</p>
          </div>
          <div class="right">
            <p>info@strik-patisserie.nl</p>
            <p style="margin-top:7mm;">NL36RABO0167935798</p>
          </div>
        </header>
        <section class="meta">
          <div>
            <p class="customer">${escapeHtml(receiptNumber)} ${escapeHtml(receipt.customer)}</p>
            <p class="address">${escapeHtmlLines(
              receipt.alternativeAddress || receipt.deliveryAddress || receipt.address
            )}</p>
            ${
              receipt.address &&
              receipt.address !== (receipt.alternativeAddress || receipt.deliveryAddress || receipt.address)
                ? `<p class="address" style="color:#666;font-size:9pt;font-weight:400;">Origineel adres: ${escapeHtml(receipt.address)}</p>`
                : ""
            }
          </div>
          <p class="date">${escapeHtml(formatReceiptDateLabel(selectedPlan.date))}</p>
        </section>
        <table>
          <thead>
            <tr>
              <th>Aantal</th>
              <th>Artikel</th>
              <th>Artikelomschrijving</th>
              <th>Prijs incl.</th>
              <th>Totaal</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
        <div class="total">
          <strong>Totaalprijs</strong>
          <span>${receipt.value ? escapeHtml(formatReceiptMoney(receipt.value)) : "intern"}</span>
        </div>
        ${notesHtml}
        <section class="fulfillment">
          <h2>${escapeHtml(fulfillmentSentenceFor(receipt))}</h2>
          ${target ? `<p>${escapeHtmlLines(target)}</p>` : ""}
        </section>
      </article>
    </main>
  </body>
</html>`;
}

function openReceiptPrintSheet(receipt: ReceiptSummary, selectedPlan: DayPlan) {
  const printWindow = window.open("", "_blank", "width=900,height=850");
  if (!printWindow) {
    window.alert("Bonvenster kon niet geopend worden.");
    return;
  }

  const displayLines = receipt.lines
    .map(normalizeKnownReceiptLine)
    .filter((line) => !shouldDropReceiptLine(line));

  printWindow.document.write(
    createReceiptPrintHtml({
      notes: visibleReceiptNotes(receipt, displayLines),
      receipt,
      selectedPlan,
    })
  );
  printWindow.document.close();
  printWindow.focus();
}

function buildBakeryProductionTotals(
  receipts: ReceiptSummary[]
): BakeryProductionTotals {
  return receipts.reduce(
    (totals, receipt) => {
      if (isInternalReceiptSummary(receipt)) return totals;

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
  if (receipt.tags.includes("vaste klant")) badges.push("vast");
  if (isIceReceiptSummary(receipt)) badges.push("ijs");
  if (iceTubs > 0) badges.push(`${iceTubs} ijs`);
  if (isLargeReceipt(receipt)) badges.push("groot");
  if (isPriorityEarlyDelivery(receipt)) badges.push("vroeg");
  if (isCriticalReceipt(receipt)) badges.push("tijd");
  if (receipt.tags.includes("zorg")) badges.push("zorg");
  if (receipt.value) badges.push(formatCurrency(receipt.value));

  return badges.slice(0, 3);
}

function receiptFixedRouteHint(receipt: ReceiptSummary) {
  const match = [receipt.internalNote, receipt.customerNote]
    .join(" · ")
    .match(/Vaste route:\s*([^·]+)/i);
  if (!match) return "";

  return match[1].replace(/\s+/g, " ").trim().slice(0, 110);
}

function receiptInternalRouteNotes(receipt: ReceiptSummary) {
  const source = [receipt.internalNote, receipt.customerNote]
    .join(" · ")
    .split(/\s+·\s+/)
    .map((part) => part.replace(/^Regie:\s*/i, "").trim())
    .filter((part) => /^Vaste\s+(?:route|levertijd)\s*:?/i.test(part));
  const seen = new Set<string>();

  return source.filter((part) => {
    const key = normalizeMatchText(part);
    if (!key || seen.has(key)) return false;

    seen.add(key);
    return true;
  });
}

function routeLearningKeyPart(value: string) {
  return normalizeMatchText(value)
    .replace(/\b(?:voor\s+)?\d{1,2}:\d{2}\b/g, " ")
    .replace(/\beur\s+\d+(?:[,.]\d+)?\b/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 90);
}

function routeLearningKeyForReceipt(receipt: ReceiptSummary, kind = "receipt") {
  const customer = routeLearningKeyPart(receipt.customer);
  const target = routeLearningKeyPart(receiptTargetLine(receipt));
  const receiptKind =
    kind === "ice" || isIceReceiptSummary(receipt) ? "ice" : "receipt";

  return `${receiptKind}:${customer || "klant"}:${target || "adres-check"}`;
}

function routeLearningStopForKey(
  routeLearning: RouteLearningSummary | null,
  key: string
) {
  if (!routeLearning) return null;

  return routeLearning.stops.find((stop) => stop.key === key) || null;
}

function routeLearningStopForReceipt(
  routeLearning: RouteLearningSummary | null,
  receipt: ReceiptSummary,
  kind = "receipt"
) {
  const exactStop = routeLearningStopForKey(
    routeLearning,
    routeLearningKeyForReceipt(receipt, kind)
  );
  if (exactStop || !routeLearning) return exactStop;

  const customer = routeLearningKeyPart(receipt.customer);
  const receiptKind =
    kind === "ice" || isIceReceiptSummary(receipt) ? "ice" : "receipt";
  const customerPrefix = `${receiptKind}:${customer || "klant"}:`;
  const matches = routeLearning.stops
    .filter((stop) => stop.key.startsWith(customerPrefix))
    .sort((first, second) => {
      const samplesCompare = second.samples - first.samples;
      if (samplesCompare !== 0) return samplesCompare;

      return second.lastSeenAt.localeCompare(first.lastSeenAt);
    });

  return matches[0] || null;
}

function busIdFromVehicleName(vehicle: string): BusId | "" {
  const text = vehicle.toLowerCase();
  if (/\bbus\s*a\b/.test(text)) return "A";
  if (/\bbus\s*b\b/.test(text)) return "B";

  return "";
}

function learnedBusForReceipt(
  routeLearning: RouteLearningSummary | null,
  receipt: ReceiptSummary
) {
  const learnedStop = routeLearningStopForReceipt(routeLearning, receipt);
  if (!learnedStop) return null;

  const bus = busIdFromVehicleName(learnedStop.preferredVehicle);
  if (!bus) return null;

  return {
    bus,
    samples: learnedStop.samples,
  };
}

function routeLearningPairSamples(
  routeLearning: RouteLearningSummary | null,
  fromKey: string,
  toKey: string
) {
  if (!routeLearning || !fromKey || !toKey) return 0;

  const key = `${fromKey}->${toKey}`;
  return routeLearning.pairs.find((pair) => pair.key === key)?.samples || 0;
}

function routeStopForReceipt(receipt: ReceiptSummary, prefix = ""): RouteStop {
  const target = receiptTargetLine(receipt);
  const time = routeTimeLabel(receipt);
  const fixedRouteHint = receiptFixedRouteHint(receipt);

  return {
    id: `${prefix}${receipt.id}`,
    sourceId: `receipt:${receipt.id}`,
    learningKey: routeLearningKeyForReceipt(receipt),
    learningLabel: receipt.customer,
    learningTarget: target,
    learningKind: "receipt",
    label: receipt.customer,
    detail: [time, target, fixedRouteHint ? `vast: ${fixedRouteHint}` : ""]
      .filter(Boolean)
      .join(" · "),
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
        learningKey: `shop:${shopKey}`,
        learningLabel: shopMeta.label,
        learningTarget: shopMeta.address,
        learningKind: "shop" as const,
        label: shopMeta.label,
        detail: detailParts.join(" · "),
        badges: [
          "winkel",
          ...(pastryUnits >= 80 || shopReceipts.length >= 2 ? ["druk"] : []),
        ],
      };
    });
}

function busForShopKey(key: string): BusId | "" {
  if (key === "daalseweg" || key === "lent") return "A";
  if (key === "heyendaalseweg" || key === "ziekerstraat") return "B";

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
    clusterKey === "oost-buiten" ||
    clusterKey === "land-van-cuijk"
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

  if (/jonkerbos|sanadome|cwz|goffert|crematorium|nxp|novio tech|douglas/.test(text)) {
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
  if (/grave|cuijk|gennep|ottersum|heijen/.test(text)) {
    return "land-van-cuijk";
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
  if (/sanadome|jonkerbos|cwz|goffert|nxp|novio tech|douglas/.test(text)) {
    return { x: -0.8, y: 2.1 };
  }
  if (/jachtslot|mookerheide|molenhoek|heumensebaan/.test(text)) {
    return { x: 0.8, y: -1.0 };
  }
  if (/groesbeek|hopmans|hoge horst/.test(text)) return { x: 2.2, y: 1.4 };
  if (/grave/.test(text)) return { x: -1.8, y: -3.8 };
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
  return /grave|gennep|cuijk|ottersum|heijen/i.test(receiptSearchText(receipt));
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

function isLentOutsideRouteReceipt(receipt: ReceiptSummary) {
  const clusterKey = outsideClusterKeyForReceipt(receipt);

  return (
    clusterKey === "jonkerbos" ||
    clusterKey === "west-buiten" ||
    clusterKey === "noord-buiten"
  );
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
      clusterKey === "land-van-cuijk" ||
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
  if (clusterKey === "land-van-cuijk") return 78;
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
  startPoint: RoutePoint,
  routeLearning: RouteLearningSummary | null,
  startLearningKey = ""
) {
  const remaining = [...receipts];
  const sorted: ReceiptSummary[] = [];
  let currentPoint = startPoint;
  let currentLearningKey = startLearningKey;

  while (remaining.length) {
    let bestIndex = 0;
    let bestScore = Number.POSITIVE_INFINITY;

    remaining.forEach((receipt, index) => {
      const distanceScore = routeDistance(currentPoint, receiptRoutePoint(receipt));
      const deadline = routeDeadlineMinutes(receipt);
      const latePenalty = deadline >= 780 ? 1.8 : 0;
      const receiptLearningKey = routeLearningKeyForReceipt(receipt);
      const learnedPairBoost = Math.min(
        6,
        routeLearningPairSamples(
          routeLearning,
          currentLearningKey,
          receiptLearningKey
        ) * 1.25
      );
      const learnedReversePenalty = Math.min(
        4,
        routeLearningPairSamples(
          routeLearning,
          receiptLearningKey,
          currentLearningKey
        ) * 1
      );
      const score =
        distanceScore + latePenalty - learnedPairBoost + learnedReversePenalty;

      if (score < bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    });

    const [nextReceipt] = remaining.splice(bestIndex, 1);
    sorted.push(nextReceipt);
    currentPoint = receiptRoutePoint(nextReceipt);
    currentLearningKey = routeLearningKeyForReceipt(nextReceipt);
  }

  return sorted;
}

function sortReceiptsForRoute(
  receipts: ReceiptSummary[],
  shopKeys: ShopKey[],
  date: string,
  routeLearning: RouteLearningSummary | null
) {
  const startPoint = lastShopRoutePoint(shopKeys);
  const lastShopKey = sortShopKeysByRoutePath(shopKeys).at(-1);
  const startLearningKey = lastShopKey ? `shop:${lastShopKey}` : "";
  const early = receipts.filter(isPriorityEarlyDelivery).sort((first, second) => {
    const deadlineCompare = routeDeadlineMinutes(first) - routeDeadlineMinutes(second);
    if (deadlineCompare !== 0) return deadlineCompare;

    const firstPairBoost = routeLearningPairSamples(
      routeLearning,
      startLearningKey,
      routeLearningKeyForReceipt(first)
    );
    const secondPairBoost = routeLearningPairSamples(
      routeLearning,
      startLearningKey,
      routeLearningKeyForReceipt(second)
    );
    const pairCompare = secondPairBoost - firstPairBoost;
    if (pairCompare !== 0) return pairCompare;

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
  const afterEarlyLearningKey = early.length
    ? routeLearningKeyForReceipt(early.at(-1)!)
    : startLearningKey;
  const normalSorted = sortReceiptsAlongRoute(
    normal,
    afterEarlyPoint,
    routeLearning,
    afterEarlyLearningKey
  );
  const afterNormalPoint = normalSorted.length
    ? receiptRoutePoint(normalSorted.at(-1)!)
    : afterEarlyPoint;
  const afterNormalLearningKey = normalSorted.length
    ? routeLearningKeyForReceipt(normalSorted.at(-1)!)
    : afterEarlyLearningKey;

  return [
    ...early,
    ...normalSorted,
    ...sortReceiptsAlongRoute(
      late,
      afterNormalPoint,
      routeLearning,
      afterNormalLearningKey
    ),
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

function buildDayLoadProfile(
  plan: DayPlan,
  receipts: ReceiptSummary[],
  pressureOverride: LogisticsLoadPressure | ""
): DayLoadProfile {
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
  const calculatedPressure: LogisticsLoadPressure =
    score >= 32 ? "hoog" : score >= 17 ? "middel" : "laag";
  const pressure = pressureOverride || calculatedPressure;

  return {
    pressure,
    deliveryReceipts: deliveryReceipts.length,
    deliveryStops,
    largeReceipts,
    pastryUnits,
    criticalReceipts,
  };
}

function teamStartTimeForPressure(pressure: LogisticsLoadPressure) {
  if (pressure === "laag") return "06:30";
  if (pressure === "hoog") return "05:45";

  return "06:00";
}

function teamSizeForDate(date: string) {
  const dayOfWeek = dayOfWeekForDate(date);

  if (dayOfWeek === 1 || dayOfWeek === 2) return 1;
  if (dayOfWeek >= 3 && dayOfWeek <= 6) return 2;

  return 1;
}

function buildLogisticsAdvice(
  loadProfile: DayLoadProfile,
  date: string
): LogisticsAdvice {
  return {
    teamStartTime: teamStartTimeForPressure(loadProfile.pressure),
    teamSize: teamSizeForDate(date),
    reason: `Drukte ${pressureLabelFor(
      loadProfile.pressure
    )} · rustig 06:30 · normaal 06:00 · druk 05:45 · ma/di 1, wo-za 2`,
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
  date: string,
  routeLearning: RouteLearningSummary | null = null,
  busId: BusId | "" = ""
) {
  const point = receiptRoutePoint(receipt);
  const nearestShopDistance = Math.min(
    ...shopKeys.map((shopKey) => routeDistance(point, shopRouteMeta[shopKey].point))
  );
  let cost = nearestShopDistance + routeDeadlinePriorityForReceipt(receipt) * 0.45;
  const learnedBus = learnedBusForReceipt(routeLearning, receipt);

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
  if (isLentOutsideRouteReceipt(receipt) && shopKeys.includes("lent")) {
    cost -= 3.2;
  }
  if (isLentOutsideRouteReceipt(receipt) && !shopKeys.includes("lent")) {
    cost += 0.9;
  }
  if (isCenterRouteText(receiptSearchText(receipt)) && shopKeys.includes("ziekerstraat")) {
    cost -= 1.2;
  }
  if (isFlexibleLateDelivery(receipt, date)) {
    cost += 0.8;
  }
  if (learnedBus && busId) {
    const learningWeight = Math.min(7, 2.2 + learnedBus.samples * 0.85);
    cost += learnedBus.bus === busId ? -learningWeight : learningWeight * 1.1;
  }

  return cost;
}

function shouldShiftDaalsewegToHeyendaalRoute(
  deliveryReceipts: ReceiptSummary[],
  loadProfile: DayLoadProfile
) {
  const outsideReceipts = deliveryReceipts.filter(isLentOutsideRouteReceipt);
  const outsideStops = new Set(
    outsideReceipts.map((receipt) => normalizeMatchText(receiptTargetLine(receipt)))
  ).size;
  const outsideLoadScore = outsideReceipts.reduce(
    (total, receipt) => total + receiptLoadScore(receipt),
    0
  );
  const outsideLargeReceipts = outsideReceipts.filter(isLargeReceipt).length;

  return (
    outsideStops >= 3 ||
    outsideReceipts.length >= 4 ||
    outsideLoadScore >= 10 ||
    outsideLargeReceipts >= 2 ||
    (loadProfile.pressure === "hoog" && outsideStops >= 2)
  );
}

function shopAssignmentCandidate(
  first: ShopKey[],
  second: ShopKey[]
): { A: ShopKey[]; B: ShopKey[] }[] {
  return [
    {
      A: sortShopKeysByRoutePath(first),
      B: sortShopKeysByRoutePath(second),
    },
    {
      A: sortShopKeysByRoutePath(second),
      B: sortShopKeysByRoutePath(first),
    },
  ];
}

function buildShopAssignmentCandidates(
  deliveryReceipts: ReceiptSummary[],
  loadProfile: DayLoadProfile
) {
  if (shouldShiftDaalsewegToHeyendaalRoute(deliveryReceipts, loadProfile)) {
    return shopAssignmentCandidate(
      ["lent"],
      ["heyendaalseweg", "daalseweg", "ziekerstraat"]
    );
  }

  return shopAssignmentCandidate(
    ["daalseweg", "lent"],
    ["heyendaalseweg", "ziekerstraat"]
  );
}

function chooseShopAssignment(
  plan: DayPlan,
  receipts: ReceiptSummary[],
  loadProfile: DayLoadProfile,
  routeLearning: RouteLearningSummary | null
) {
  const deliveryReceipts = receipts.filter(isRouteDelivery);
  const candidates = buildShopAssignmentCandidates(deliveryReceipts, loadProfile);
  let bestCandidate = candidates[0] || {
    A: ["daalseweg", "lent"] as ShopKey[],
    B: ["heyendaalseweg", "ziekerstraat"] as ShopKey[],
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
      const costA = routeAssignmentCostForReceipt(
        receipt,
        candidate.A,
        plan.date,
        routeLearning,
        "A"
      );
      const costB = routeAssignmentCostForReceipt(
        receipt,
        candidate.B,
        plan.date,
        routeLearning,
        "B"
      );
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
  routeLearning: RouteLearningSummary | null;
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
    input.date,
    input.routeLearning,
    "A"
  );
  const routeCostB = routeAssignmentCostForReceipt(
    input.receipt,
    input.buses.B.shopKeys,
    input.date,
    input.routeLearning,
    "B"
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
    learningKey: routeLearningKeyForReceipt(receipt, "ice"),
    learningLabel: receipt.customer,
    learningTarget: target,
    learningKind: "ice",
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
  if (/^0\s+/i.test(loadLine)) return loadLine;

  return `${loadLine} · ${fallback}`;
}

function routePrintTimeParts(stop: RouteStop) {
  const detailParts = stop.detail.split(" · ");
  const firstPart = detailParts[0] || "";
  const firstPartLooksLikeTime =
    /\b(?:voor\s+)?\d{1,2}:\d{2}\b/i.test(firstPart) ||
    /tijd\s+check/i.test(firstPart);

  return {
    time: firstPartLooksLikeTime ? firstPart : "",
    detail: firstPartLooksLikeTime ? detailParts.slice(1).join(" · ") : stop.detail,
  };
}

function routePrintTimeMinutes(value: string) {
  const matches = [...value.matchAll(/\b(\d{1,2}):(\d{2})\b/g)];
  const match = matches.at(-1);
  if (!match) return 9999;

  return Number(match[1]) * 60 + Number(match[2]);
}

function routePrintTimeBadgeHtml(stop: RouteStop) {
  const { time } = routePrintTimeParts(stop);
  if (!time) return "";

  const urgent = routePrintTimeMinutes(time) < 10 * 60;

  return `<span class="time-badge ${urgent ? "urgent" : ""}">${urgent ? "! " : ""}${escapeHtml(
    time
  )}</span>`;
}

function isSaturdayDate(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  if (!year || !month || !day) return false;

  return new Date(Date.UTC(year, month - 1, day)).getUTCDay() === 6;
}

function buildRouteRounds(
  plan: DayPlan,
  receipts: ReceiptSummary[],
  loadProfile: DayLoadProfile,
  routeLearning: RouteLearningSummary | null
): RouteRound[] {
  if (isSaturdayDate(plan.date)) {
    return buildSaturdayRouteRounds(plan, receipts, loadProfile, routeLearning);
  }

  const shopAssignment = chooseShopAssignment(
    plan,
    receipts,
    loadProfile,
    routeLearning
  );
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
      routeLearning,
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
            routeLearning,
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
      routeLearning,
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
      ...sortReceiptsForRoute(
        bus.early,
        bus.shopKeys,
        plan.date,
        routeLearning
      ).map((receipt) => routeStopForReceipt(receipt, `${bus.id}-early-`)),
      ...looseFirstIceStops,
      ...sortReceiptsForRoute(
        bus.first,
        bus.shopKeys,
        plan.date,
        routeLearning
      ).map((receipt) => routeStopForReceipt(receipt, `${bus.id}-first-`)),
    ];
    const secondStops = [
      ...sortReceiptsForRoute(
        bus.second,
        bus.shopKeys,
        plan.date,
        routeLearning
      ).map((receipt) => routeStopForReceipt(receipt, `${bus.id}-second-`)),
      ...sortReceiptsForRoute(
        bus.ice,
        bus.shopKeys,
        plan.date,
        routeLearning
      ).map(iceStopForReceipt),
    ];

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
            learningKey: "check:ijs",
            learningLabel: "IJsbonnen controleren",
            learningTarget: "ijsvolume zonder losse ijssalonbon",
            learningKind: "check",
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

  return rounds;
}

function buildSaturdayRouteRounds(
  plan: DayPlan,
  receipts: ReceiptSummary[],
  loadProfile: DayLoadProfile,
  routeLearning: RouteLearningSummary | null
): RouteRound[] {
  const buses: Record<BusId, PlannedBus> = {
    A: createPlannedBus({
      id: "A",
      title: busRouteMeta.A.title,
      tone: busRouteMeta.A.tone,
      shopKeys: ["heyendaalseweg", "daalseweg", "ziekerstraat"],
    }),
    B: createPlannedBus({
      id: "B",
      title: busRouteMeta.B.title,
      tone: busRouteMeta.B.tone,
      shopKeys: ["lent"],
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
      routeLearning,
      round: "second",
    });
    const round =
      bus === "B" &&
      (isPriorityEarlyDelivery(receipt) ||
        shouldRideAfterLentOnSaturday(receipt) ||
        !isFlexibleLateDelivery(receipt, plan.date))
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
      routeLearning,
      round: "second",
    });

    addReceiptToBus(buses[bus], receipt, "ice");
  });

  ([buses.A, buses.B] as PlannedBus[]).forEach((bus) => {
    const routePlan = saturdayRouteShopPlan[bus.id];
    const firstRouteReceipts =
      bus.id === "A" ? [] : [...bus.early, ...bus.first];
    const secondRouteReceipts =
      bus.id === "A"
        ? [...bus.early, ...bus.first, ...bus.second]
        : bus.second;
    const firstStops = [
      ...groupShopStops(receipts, routePlan.firstShopKeys, []),
      ...sortReceiptsForRoute(
        firstRouteReceipts,
        bus.shopKeys,
        plan.date,
        routeLearning
      ).map((receipt) => routeStopForReceipt(receipt, `${bus.id}-first-`)),
    ];
    const secondStops = [
      ...groupShopStops(receipts, routePlan.secondShopKeys, []),
      ...sortReceiptsForRoute(
        secondRouteReceipts,
        bus.shopKeys,
        plan.date,
        routeLearning
      ).map((receipt) => routeStopForReceipt(receipt, `${bus.id}-second-`)),
    ];
    const iceStops = sortReceiptsForRoute(
      bus.ice,
      bus.shopKeys,
      plan.date,
      routeLearning
    ).map(iceStopForReceipt);

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
            : `Zaterdag: alleen ${routePlan.firstShopLabel}; geen externe adressen in deze ronde, daarna terug naar Ambachtsweg 4.`,
        load: routeLoadLineWithFallback(
          routeLoadLineForStops(firstStops),
          "volle bus"
        ),
        loadProfile,
      })
    );

    rounds.push(
      buildRouteRound({
        id: `bus-${bus.id}-2-saturday`,
        title: "Ronde 2",
        vehicle: bus.title,
        departure: plan.isFuture ? "na ronde 1" : "na ronde 1",
        tone: "border-[#efc7b8] bg-[#fff3ed]",
        stops: secondStops,
        reason:
          bus.id === "A"
            ? `Zaterdag: daarna ${routePlan.secondShopLabel}, daarna alle overige adressen.`
            : `Zaterdag: daarna ${routePlan.secondShopLabel}; late deadlines blijven later.`,
        load: routeLoadLineWithFallback(
          routeLoadLineForStops(secondStops),
          "winkel + rest"
        ),
        loadProfile,
      })
    );

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
            learningKey: "check:ijs",
            learningLabel: "IJsbonnen controleren",
            learningTarget: "ijsvolume zonder losse ijssalonbon",
            learningKind: "check",
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

  return rounds;
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

function routeRoundNumber(route: RouteRound) {
  const titleMatch = route.title.match(/\bronde\s+(\d+)\b/i);
  if (titleMatch) return Number(titleMatch[1]) || 1;

  const idMatch = route.id.match(/\bbus-[ab]-(\d+)\b/i);
  if (idMatch) return Number(idMatch[1]) || 1;

  return 0;
}

function isPrimaryRouteRound(route: RouteRound) {
  return routeRoundNumber(route) === 1;
}

function isUserAddedRouteRound(route: RouteRound) {
  return /-extra-\d+/i.test(route.id);
}

function shouldShowRouteRound(route: RouteRound) {
  return (
    isPrimaryRouteRound(route) ||
    route.stops.length > 0 ||
    isUserAddedRouteRound(route)
  );
}

function compactEmptyRouteRounds(routeRounds: RouteRound[]) {
  return routeRounds.filter(shouldShowRouteRound);
}

function routeRoundsForPersistence(routeRounds: RouteRound[]) {
  return routeRounds.filter(shouldShowRouteRound);
}

function busIdFromRouteVehicle(vehicle: string): BusId | "" {
  const match = vehicle.match(/\bbus\s+([ab])\b/i);

  return match ? (match[1].toUpperCase() as BusId) : "";
}

function routeToneForRoundNumber(roundNumber: number, fallbackTone: string) {
  if (roundNumber <= 1) return fallbackTone;
  if (roundNumber >= 3) return "border-[#b8ddea] bg-[#eefaff]";

  return "border-[#efc7b8] bg-[#fff3ed]";
}

function addRouteRoundForVehicle(
  routeRounds: RouteRound[],
  vehicle: string,
  loadProfile: DayLoadProfile
) {
  const busId = busIdFromRouteVehicle(vehicle);
  const primaryRoute =
    routeRounds.find(
      (route) => route.vehicle === vehicle && isPrimaryRouteRound(route)
    ) || routeRounds.find((route) => route.vehicle === vehicle);
  if (!busId || !primaryRoute) return routeRounds;

  const visibleRouteNumbers = routeRounds
    .filter((route) => route.vehicle === vehicle && shouldShowRouteRound(route))
    .map(routeRoundNumber);
  const nextRoundNumber = Math.max(1, ...visibleRouteNumbers) + 1;
  const hiddenSameNumberRoute = routeRounds.find(
    (route) =>
      route.vehicle === vehicle &&
      routeRoundNumber(route) === nextRoundNumber &&
      !shouldShowRouteRound(route)
  );
  const routeId = `bus-${busId}-${nextRoundNumber}-extra-${Date.now()}`;
  const routeToAdd = {
    ...refreshRouteRoundAfterManualMove(
      {
        ...(hiddenSameNumberRoute || primaryRoute),
        id: routeId,
        title: `Ronde ${nextRoundNumber}`,
        vehicle,
        departure: `na ronde ${nextRoundNumber - 1}`,
        tone: routeToneForRoundNumber(nextRoundNumber, primaryRoute.tone),
        stops: [],
        reason: "",
        load: routeLoadLineForStops([]),
      },
      loadProfile
    ),
    reason: "Handmatig toegevoegde ronde; sleep stops hierheen.",
  };

  return [
    ...routeRounds.filter((route) => route !== hiddenSameNumberRoute),
    routeToAdd,
  ];
}

function deleteRouteRoundFromRounds(
  routeRounds: RouteRound[],
  routeId: string,
  loadProfile: DayLoadProfile
) {
  const routeToDelete = routeRounds.find((route) => route.id === routeId);
  if (!routeToDelete || isPrimaryRouteRound(routeToDelete)) return routeRounds;

  const primaryRoute = routeRounds.find(
    (route) =>
      route.vehicle === routeToDelete.vehicle && isPrimaryRouteRound(route)
  );
  if (!primaryRoute || primaryRoute.id === routeToDelete.id) return routeRounds;

  const nextRoutes = routeRounds
    .filter((route) => route.id !== routeToDelete.id)
    .map((route) => ({
      ...route,
      stops:
        route.id === primaryRoute.id
          ? [...route.stops, ...routeToDelete.stops]
          : [...route.stops],
    }))
    .map((route) => refreshRouteRoundAfterManualMove(route, loadProfile));

  return compactEmptyRouteRounds(nextRoutes);
}

function cloneRouteRounds(routeRounds: RouteRound[]): RouteRound[] {
  return routeRounds.map((route) => ({
    ...route,
    stops: route.stops.map((stop) => ({
      ...stop,
      badges: [...stop.badges],
    })),
  }));
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
      learningKey: stop.learningKey,
      learningLabel: stop.learningLabel,
      learningTarget: stop.learningTarget,
      learningKind: stop.learningKind,
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
  const excludedSourceIds = new Set(routeDraft.excludedSourceIds || []);
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
        if (excludedSourceIds.has(sourceKey)) return null;
        if (sourceKey.startsWith("manual:")) {
          usedSourceKeys.add(sourceKey);
          return draftStop;
        }

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
      (stop) =>
        !usedSourceKeys.has(routeStopSourceKey(stop)) &&
        !excludedSourceIds.has(routeStopSourceKey(stop))
    );

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

  return reconciledRoutes;
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
        : "Prognosebon, definitieve aantallen na 20:00.",
      internalNote: receipt.tags.includes("intern")
        ? receipt.internalNote
        : "Prognosebon, definitieve aantallen na 20:00.",
      customerNote: receipt.tags.includes("intern")
        ? receipt.customerNote
        : "Nog prognose: controleer na de definitieve batch.",
    }));
  }

  return visibleReceipts;
}

function learningSignalsFor(
  feedback: string,
  pressureOverride: LogisticsLoadPressure | "",
  operations?: LogisticsDayOperations
) {
  const text = feedback.toLowerCase();
  const signals: string[] = [];

  if (pressureOverride) {
    signals.push(`drukte handmatig: ${pressureLabelFor(pressureOverride)}`);
  }
  if (operations?.teamStartTime) signals.push(`team startte ${operations.teamStartTime}`);
  if (operations?.teamEndTime) signals.push(`team klaar ${operations.teamEndTime}`);
  if (operations?.teamMembers?.length) {
    signals.push(`${operations.teamMembers.length} mensen logistiek`);
  }
  if (operations?.busDepartures?.A) signals.push(`bus A weg ${operations.busDepartures.A}`);
  if (operations?.busDepartures?.B) signals.push(`bus B weg ${operations.busDepartures.B}`);
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
  const [routeLearning, setRouteLearning] =
    useState<RouteLearningSummary | null>(null);
  const [fixedCustomers, setFixedCustomers] = useState<FixedCustomerSummary[]>(
    []
  );
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
  const [pressureByDate, setPressureByDate] = useState<
    Record<string, LogisticsLoadPressure | "">
  >({});
  const [operationsByDate, setOperationsByDate] = useState<
    Record<string, OperationsDraft>
  >({});
  const [recentDayFeedback, setRecentDayFeedback] = useState<
    DayFeedbackSummary[]
  >([]);
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
    () => {
      const overriddenReceipts = applyReceiptOverrides(
        baseReceiptSummaries,
        receiptOverrides,
        selectedPlan.date
      );

      return applyFixedCustomerDefaults(overriddenReceipts, fixedCustomers);
    },
    [baseReceiptSummaries, fixedCustomers, receiptOverrides, selectedPlan.date]
  );
  const pressureOverride = pressureByDate[selectedPlan.date] || "";
  const loadProfile = useMemo(
    () =>
      buildDayLoadProfile(selectedPlan, receiptSummaries, pressureOverride),
    [pressureOverride, selectedPlan, receiptSummaries]
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
    () =>
      buildRouteRounds(selectedPlan, receiptSummaries, loadProfile, routeLearning),
    [loadProfile, receiptSummaries, routeLearning, selectedPlan]
  );
  const [manualRouteRounds, setManualRouteRounds] = useState<
    RouteRound[] | null
  >(null);
  const [excludedRouteStopSourceIds, setExcludedRouteStopSourceIds] = useState<
    string[]
  >([]);
  const [deletedRouteStopSnapshot, setDeletedRouteStopSnapshot] =
    useState<DeletedRouteStopSnapshot | null>(null);
  const [routesEdited, setRoutesEdited] = useState(false);
  const [routeHasUnsavedChanges, setRouteHasUnsavedChanges] = useState(false);
  const routeRounds = manualRouteRounds || automaticRouteRounds;
  const routeCanSave =
    routeHasUnsavedChanges || (routesEdited && routeDraft?.isFinal !== true);
  const marzipanPrintItems = useMemo(
    () => buildMarzipanPrintItems(receiptSummaries, webshopImages),
    [receiptSummaries, webshopImages]
  );
  const writtenTextPrintItems = useMemo(
    () => buildWrittenTextPrintItems(receiptSummaries),
    [receiptSummaries]
  );
  const feedback = feedbackByDate[selectedPlan.date] || "";
  const operationsDraft =
    operationsByDate[selectedPlan.date] || emptyOperationsDraft();
  const logisticsAdvice = useMemo(
    () => buildLogisticsAdvice(loadProfile, selectedPlan.date),
    [loadProfile, selectedPlan.date]
  );
  const learningSignals = useMemo(
    () =>
      learningSignalsFor(
        feedback,
        pressureOverride,
        operationsDraftToPayload(operationsDraft)
      ),
    [feedback, operationsDraft, pressureOverride]
  );
  const headerTone = statusToneFor(selectedPlan.status);

  const uploadStatus = useMemo(() => {
    if (isImporting) return "batch wordt ingelezen...";
    if (!fileSnapshot) return selectedPlan.sourceLabel;

    return `${batchLabelFor(fileSnapshot.status)} · ${fileSnapshot.name} · ${formatBytes(fileSnapshot.size)} · ${fileSnapshot.uploadedAt}`;
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
      const definitiveWindowStarted =
        minuteOfDay(current.hour, current.minute) <
          DEFINITIVE_BATCH_START_MINUTE_OF_DAY &&
        minuteOfDay(next.hour, next.minute) >= DEFINITIVE_BATCH_START_MINUTE_OF_DAY;

      dateStateRef.current = next;
      setDateState(next);

      if (selectedDateChanged) {
        setFileSnapshot(null);
        setDeletedRouteStopSnapshot(null);
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
      setExcludedRouteStopSourceIds(routeDraft.excludedSourceIds || []);
      setRoutesEdited(true);
      setRouteHasUnsavedChanges(false);
      return;
    }

    setManualRouteRounds(null);
    setExcludedRouteStopSourceIds([]);
    setRoutesEdited(false);
    setRouteHasUnsavedChanges(false);
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
          recentDayFeedback?: DayFeedbackSummary[];
          webshopImages?: WebshopImageSummary[];
          receiptOverrides?: ReceiptOverrideSummary[];
          routeDraft?: RouteDraftSummary | null;
          routeLearning?: RouteLearningSummary | null;
          fixedCustomers?: FixedCustomerSummary[];
          message?: string;
        };

        if (ignoreResult) return;

        if (!response.ok) {
          setBatchLoadState("error");
          setWebshopImages([]);
          setReceiptOverrides([]);
          setRouteDraft(null);
          setRouteLearning(null);
          setFixedCustomers([]);
          if (manualRefresh) {
            setImportMessage(data.message || "Opnieuw ophalen is niet gelukt.");
          }
          return;
        }

        setImportedBatch(data.batch || null);
        setWebshopImages(data.webshopImages || []);
        setReceiptOverrides(data.receiptOverrides || []);
        setRouteDraft(data.routeDraft || null);
        setRouteLearning(data.routeLearning || null);
        setFixedCustomers(data.fixedCustomers || []);
        setRecentDayFeedback(data.recentDayFeedback || []);
        setFeedbackByDate((current) => ({
          ...current,
          [dateState.selectedDate]: data.dayFeedback?.text || "",
        }));
        setPressureByDate((current) => ({
          ...current,
          [dateState.selectedDate]: data.dayFeedback?.pressureOverride || "",
        }));
        setOperationsByDate((current) => ({
          ...current,
          [dateState.selectedDate]: operationsDraftFromFeedback(
            data.dayFeedback?.operations
          ),
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
          setRouteLearning(null);
          setFixedCustomers([]);
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
    setRouteHasUnsavedChanges(false);
    setDeletedRouteStopSnapshot(null);
  }

  function refreshBatch() {
    manualBatchRefreshRef.current = true;
    setFileSnapshot(null);
    setImportMessage("bonnen opnieuw ophalen...");
    setDeletedRouteStopSnapshot(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setBatchReloadCounter((current) => current + 1);
  }

  async function saveRouteDraft(
    routeRoundsToSave: RouteRound[],
    learn = true,
    excludedSourceIds = excludedRouteStopSourceIds
  ) {
    setRouteSaveState("saving");
    setRouteSaveMessage(
      learn
        ? "definitieve route opslaan en leren..."
        : "routeconcept opslaan..."
    );

    try {
      const response = await fetch("/api/bakkerij-logistiek/route-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: selectedPlan.date,
          routes: serializeRouteRounds(
            routeRoundsForPersistence(routeRoundsToSave)
          ),
          baselineRoutes: learn
            ? serializeRouteRounds(automaticRouteRounds)
            : undefined,
          excludedSourceIds,
          learn,
        }),
      });
      const data = (await response.json()) as {
        ok?: boolean;
        routeDraft?: RouteDraftSummary | null;
        routeLearning?: RouteLearningSummary | null;
        message?: string;
      };

      if (!response.ok || !data.ok || !data.routeDraft) {
        throw new Error(data.message || "Route opslaan is niet gelukt.");
      }

      setRouteDraft(data.routeDraft);
      setRouteLearning(data.routeLearning || null);
      setRouteHasUnsavedChanges(false);
      setRouteSaveState("saved");
      setRouteSaveMessage(
        learn
          ? `definitieve route opgeslagen en geleerd om ${getUploadTime()}`
          : `routeconcept bewaard om ${getUploadTime()}`
      );
    } catch (error) {
      setRouteSaveState("error");
      setRouteSaveMessage(
        error instanceof Error ? error.message : "Route opslaan is niet gelukt."
      );
    }
  }

  function moveRouteStop(move: RouteStopMove) {
    const currentRoutes = manualRouteRounds || automaticRouteRounds;
    const movedRoutes = moveRouteStopInRounds(currentRoutes, move, loadProfile);
    if (movedRoutes === currentRoutes) return;

    const nextRoutes = compactEmptyRouteRounds(movedRoutes);

    setManualRouteRounds(nextRoutes);
    setDeletedRouteStopSnapshot(null);
    setRoutesEdited(true);
    setRouteHasUnsavedChanges(true);
    setRouteSaveState("idle");
    setRouteSaveMessage("concept gewijzigd · nog niet definitief opgeslagen");
    void saveRouteDraft(nextRoutes, false);
  }

  function addRouteRound(vehicle: string) {
    const currentRoutes = manualRouteRounds || automaticRouteRounds;
    const nextRoutes = addRouteRoundForVehicle(currentRoutes, vehicle, loadProfile);
    if (nextRoutes === currentRoutes) return;

    setManualRouteRounds(nextRoutes);
    setDeletedRouteStopSnapshot(null);
    setRoutesEdited(true);
    setRouteHasUnsavedChanges(true);
    setRouteSaveState("idle");
    setRouteSaveMessage("ronde toegevoegd · nog niet definitief opgeslagen");
    void saveRouteDraft(nextRoutes, false);
  }

  function addManualRouteStop(routeId: string, label: string, detail: string) {
    const cleanLabel = label.replace(/\s+/g, " ").trim();
    const cleanDetail = detail.replace(/\s+/g, " ").trim();
    if (!cleanLabel) return;

    const currentRoutes = manualRouteRounds || automaticRouteRounds;
    const stopId = `manual-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;
    const manualStop: RouteStop = {
      id: stopId,
      sourceId: `manual:${stopId}`,
      learningKey: `manual:${cleanLabel}:${cleanDetail}`.slice(0, 220),
      learningLabel: cleanLabel,
      learningTarget: cleanDetail,
      learningKind: "check",
      label: cleanLabel,
      detail: cleanDetail || "Handmatige stop",
      badges: ["handmatig"],
    };
    const nextRoutes = currentRoutes.map((route) =>
      route.id === routeId
        ? refreshRouteRoundAfterManualMove(
            {
              ...route,
              stops: [...route.stops, manualStop],
            },
            loadProfile
          )
        : route
    );

    setManualRouteRounds(nextRoutes);
    setDeletedRouteStopSnapshot(null);
    setRoutesEdited(true);
    setRouteHasUnsavedChanges(true);
    setRouteSaveState("idle");
    setRouteSaveMessage(
      "handmatige stop toegevoegd · nog niet definitief opgeslagen"
    );
    void saveRouteDraft(nextRoutes, false);
  }

  function deleteRouteStop(routeId: string, stopId: string) {
    const currentRoutes = manualRouteRounds || automaticRouteRounds;
    const sourceRoute = currentRoutes.find((route) => route.id === routeId);
    const stop = sourceRoute?.stops.find((item) => item.id === stopId);
    if (!sourceRoute || !stop) return;

    const confirmed = window.confirm(
      `Weet je zeker dat je "${stop.label}" uit ${sourceRoute.title} wil verwijderen?`
    );
    if (!confirmed) return;

    const sourceKey = routeStopSourceKey(stop);
    const nextExcludedSourceIds = sourceKey.startsWith("manual:")
      ? excludedRouteStopSourceIds
      : Array.from(new Set([...excludedRouteStopSourceIds, sourceKey]));
    const nextRoutes = compactEmptyRouteRounds(
      currentRoutes.map((route) =>
        route.id === routeId
          ? refreshRouteRoundAfterManualMove(
              {
                ...route,
                stops: route.stops.filter((item) => item.id !== stopId),
              },
              loadProfile
            )
          : route
      )
    );

    setManualRouteRounds(nextRoutes);
    setExcludedRouteStopSourceIds(nextExcludedSourceIds);
    setDeletedRouteStopSnapshot({
      stopLabel: stop.label,
      routeRounds: cloneRouteRounds(currentRoutes),
      excludedSourceIds: [...excludedRouteStopSourceIds],
    });
    setRoutesEdited(true);
    setRouteHasUnsavedChanges(true);
    setRouteSaveState("idle");
    setRouteSaveMessage("stop verwijderd · nog niet definitief opgeslagen");
    void saveRouteDraft(nextRoutes, false, nextExcludedSourceIds);
  }

  function deleteRouteRound(routeId: string) {
    const currentRoutes = manualRouteRounds || automaticRouteRounds;
    const route = currentRoutes.find((item) => item.id === routeId);
    if (!route || isPrimaryRouteRound(route)) return;

    const nextRoutes = deleteRouteRoundFromRounds(
      currentRoutes,
      routeId,
      loadProfile
    );
    if (nextRoutes === currentRoutes) return;

    setManualRouteRounds(nextRoutes);
    setDeletedRouteStopSnapshot(null);
    setRoutesEdited(true);
    setRouteHasUnsavedChanges(true);
    setRouteSaveState("idle");
    setRouteSaveMessage(
      route.stops.length
        ? `${route.title} verwijderd · stops naar ronde 1 gezet`
        : `${route.title} verwijderd`
    );
    void saveRouteDraft(nextRoutes, false);
  }

  function undoRouteStopDelete() {
    if (!deletedRouteStopSnapshot) return;

    const restoredRoutes = cloneRouteRounds(deletedRouteStopSnapshot.routeRounds);
    const restoredExcludedSourceIds = [
      ...deletedRouteStopSnapshot.excludedSourceIds,
    ];

    setManualRouteRounds(restoredRoutes);
    setExcludedRouteStopSourceIds(restoredExcludedSourceIds);
    setDeletedRouteStopSnapshot(null);
    setRoutesEdited(true);
    setRouteHasUnsavedChanges(true);
    setRouteSaveState("idle");
    setRouteSaveMessage(
      `${deletedRouteStopSnapshot.stopLabel} teruggezet · nog niet definitief opgeslagen`
    );
    void saveRouteDraft(restoredRoutes, false, restoredExcludedSourceIds);
  }

  function saveCurrentRouteDraft() {
    void saveRouteDraft(routeRounds, true);
  }

  async function resetRouteDraft() {
    setManualRouteRounds(null);
    setExcludedRouteStopSourceIds([]);
    setDeletedRouteStopSnapshot(null);
    setRoutesEdited(false);
    setRouteHasUnsavedChanges(false);
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
        routeLearning?: RouteLearningSummary | null;
        message?: string;
      };

      if (!response.ok || !data.ok) {
        throw new Error(data.message || "Route opnieuw berekenen is niet gelukt.");
      }

      setRouteLearning(data.routeLearning || null);
      setRouteSaveState("idle");
      setRouteSaveMessage("automatische route actief · leerdata bewaard");
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
      formData.set("status", defaultManualUploadStatus(dateState, activeImportedBatch));

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
      setRouteHasUnsavedChanges(false);
      setDateState((current) => ({ ...current, selectedDate: data.batch!.date }));
      setFileSnapshot({
        name: file.name,
        size: file.size,
        status: data.batch.status,
        uploadedAt: getUploadTime(),
      });
      setImportMessage(
        `${batchLabelFor(data.batch.status)} · ${data.batch.orderCount} bonnen ingelezen.`
      );
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

  async function uploadManualWebshopImageForReceipt(
    receipt: ReceiptSummary,
    file: File
  ) {
    setPhotoLinkMessage("foto voorbereiden...");

    try {
      const uploadFile = await prepareManualPhotoUploadFile(file);
      const formData = new FormData();
      formData.set("file", uploadFile);
      formData.set("date", selectedPlan.date);
      formData.set("receiptId", receipt.id);
      formData.set("receiptNumber", receipt.receiptNumber);
      formData.set("receiptCustomer", receipt.customer);
      formData.set("productSummary", photoProductSummaryForReceipt(receipt));

      setPhotoLinkMessage("foto uploaden...");
      const response = await fetch(
        "/api/bakkerij-logistiek/webshop-images/manual",
        {
          method: "POST",
          body: formData,
        }
      );
      const data = (await response.json()) as {
        image?: WebshopImageSummary;
        message?: string;
      };

      if (!response.ok || !data.image) {
        throw new Error(data.message || "Foto uploaden is niet gelukt.");
      }

      setWebshopImages((current) => [
        data.image!,
        ...current.filter((item) => item.id !== data.image!.id),
      ]);
      setPhotoLinkMessage(`Foto gekoppeld aan ${receipt.customer}.`);
    } catch (error) {
      setPhotoLinkMessage(
        error instanceof Error ? error.message : "Foto uploaden is niet gelukt."
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

  async function unlinkWebshopImageFromReceipt(image: WebshopImageSummary) {
    setPhotoLinkMessage("foto loskoppelen...");

    try {
      const response = await fetch("/api/bakkerij-logistiek/webshop-images/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "unlink",
          imageId: image.id,
        }),
      });
      const data = (await response.json()) as {
        image?: WebshopImageSummary;
        message?: string;
      };

      if (!response.ok || !data.image) {
        throw new Error(data.message || "Foto loskoppelen is niet gelukt.");
      }

      setWebshopImages((current) =>
        current.map((item) => (item.id === data.image!.id ? data.image! : item))
      );
      setPhotoLinkMessage("Foto is losgekoppeld.");
    } catch (error) {
      setPhotoLinkMessage(
        error instanceof Error
          ? error.message
          : "Foto loskoppelen is niet gelukt."
      );
    }
  }

  async function deleteWebshopImage(image: WebshopImageSummary) {
    setPhotoLinkMessage("foto verwijderen...");

    try {
      const response = await fetch("/api/bakkerij-logistiek/webshop-images/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "delete",
          imageId: image.id,
        }),
      });
      const data = (await response.json()) as {
        deleted?: boolean;
        imageId?: string;
        message?: string;
      };

      if (!response.ok || !data.deleted) {
        throw new Error(data.message || "Foto verwijderen is niet gelukt.");
      }

      setWebshopImages((current) =>
        current.filter((item) => item.id !== (data.imageId || image.id))
      );
      setPhotoLinkMessage("Foto verwijderd.");
    } catch (error) {
      setPhotoLinkMessage(
        error instanceof Error
          ? error.message
          : "Foto verwijderen is niet gelukt."
      );
    }
  }

  function updateFeedback(value: string) {
    setFeedbackByDate((current) => ({
      ...current,
      [selectedPlan.date]: value,
    }));
  }

  function updatePressureOverride(value: LogisticsLoadPressure | "") {
    setPressureByDate((current) => ({
      ...current,
      [selectedPlan.date]: value,
    }));
  }

  function updateOperationsDraft(updater: (draft: OperationsDraft) => OperationsDraft) {
    setOperationsByDate((current) => ({
      ...current,
      [selectedPlan.date]: updater(
        current[selectedPlan.date] || emptyOperationsDraft()
      ),
    }));
  }

  function updateBusDeparture(bus: BusId, value: string) {
    updateOperationsDraft((draft) => ({
      ...draft,
      busDepartures: {
        ...draft.busDepartures,
        [bus]: value,
      },
    }));
  }

  function updateTeamTime(field: "teamStartTime" | "teamEndTime", value: string) {
    updateOperationsDraft((draft) => ({
      ...draft,
      [field]: value,
    }));
  }

  function updateTeamMemberName(memberId: string, value: string) {
    updateOperationsDraft((draft) => ({
      ...draft,
      teamMembers: draft.teamMembers.map((member) =>
        member.id === memberId ? { ...member, name: value } : member
      ),
    }));
  }

  function addTeamMember() {
    updateOperationsDraft((draft) => ({
      ...draft,
      teamMembers: [
        ...draft.teamMembers,
        {
          id: `persoon-${Date.now()}`,
          name: "",
        },
      ],
    }));
  }

  function removeTeamMember(memberId: string) {
    updateOperationsDraft((draft) => {
      const nextMembers = draft.teamMembers.filter(
        (member) => member.id !== memberId
      );

      return {
        ...draft,
        teamMembers: nextMembers.length
          ? nextMembers
          : emptyOperationsDraft().teamMembers,
      };
    });
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
          pressureOverride,
          operations: operationsDraftToPayload(operationsDraft),
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
      setPressureByDate((current) => ({
        ...current,
        [data.feedback!.date]: data.feedback!.pressureOverride || "",
      }));
      setOperationsByDate((current) => ({
        ...current,
        [data.feedback!.date]: operationsDraftFromFeedback(
          data.feedback!.operations
        ),
      }));
      setRecentDayFeedback((current) => [
        data.feedback!,
        ...current.filter((item) => item.date !== data.feedback!.date),
      ]);
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
            <label
              className={`relative flex min-h-8 cursor-pointer items-center border px-2 text-[0.68rem] font-black tracking-normal transition ${
                selectedPlan.date !== dateState.today &&
                selectedPlan.date !== dateState.tomorrow
                  ? "border-[#1a1815] bg-[#1a1815] text-white"
                  : "border-[#e8e4de] bg-white/70 text-[#8b8278] hover:bg-white"
              }`}
            >
              Eerder
              <input
                type="date"
                value={
                  selectedPlan.date <= dateState.today
                    ? selectedPlan.date
                    : dateState.today
                }
                max={dateState.today}
                aria-label="Eerdere datum kiezen"
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                onChange={(event) => selectDate(event.target.value)}
              />
            </label>
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
            <WrittenTextPrintButton
              count={writtenTextPrintItems.length}
              disabled={writtenTextPrintItems.length === 0}
              onClick={() =>
                openWrittenTextSheet(selectedPlan, writtenTextPrintItems)
              }
            />
            <PreparationPrintButton
              disabled={receiptSummaries.length === 0}
              onSelect={(category) =>
                openPreparationSheet(selectedPlan, receiptSummaries, category)
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
            deletedRouteStopLabel={deletedRouteStopSnapshot?.stopLabel || ""}
            onRouteAdd={addRouteRound}
            onRouteDelete={deleteRouteRound}
            onRouteStopAdd={addManualRouteStop}
            onRouteStopDelete={deleteRouteStop}
            onRouteStopMove={moveRouteStop}
            onRouteStopUndo={undoRouteStopDelete}
            onRoutesReset={resetRouteDraft}
            onRoutesSave={saveCurrentRouteDraft}
            routeCanSave={routeCanSave}
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
            onUnlinkWebshopImageFromReceipt={unlinkWebshopImageFromReceipt}
            onDeleteWebshopImage={deleteWebshopImage}
            onUploadManualWebshopImageForReceipt={
              uploadManualWebshopImageForReceipt
            }
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
            logisticsAdvice={logisticsAdvice}
            message={feedbackMessage}
            learningSignals={learningSignals}
            operationsDraft={operationsDraft}
            routeLearning={routeLearning}
            onAddTeamMember={addTeamMember}
            onBusDepartureChange={updateBusDeparture}
            onFeedbackChange={updateFeedback}
            onPressureChange={updatePressureOverride}
            onRemoveTeamMember={removeTeamMember}
            onSave={saveFeedback}
            onTeamMemberNameChange={updateTeamMemberName}
            onTeamTimeChange={updateTeamTime}
            pressureOverride={pressureOverride}
            recentDayFeedback={recentDayFeedback}
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
    if (!shouldShowRouteRound(route)) return;

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
  deletedRouteStopLabel,
  onRouteAdd,
  onRouteDelete,
  onRouteStopAdd,
  onRouteStopDelete,
  onRouteStopMove,
  onRouteStopUndo,
  onRoutesReset,
  onRoutesSave,
  routeCanSave,
  routeRounds,
  routeSaveMessage,
  routeSaveState,
  routesEdited,
  selectedPlan,
}: Readonly<{
  deletedRouteStopLabel: string;
  onRouteAdd: (vehicle: string) => void;
  onRouteDelete: (routeId: string) => void;
  onRouteStopAdd: (routeId: string, label: string, detail: string) => void;
  onRouteStopDelete: (routeId: string, stopId: string) => void;
  onRouteStopMove: (move: RouteStopMove) => void;
  onRouteStopUndo: () => void;
  onRoutesReset: () => void;
  onRoutesSave: () => void;
  routeCanSave: boolean;
  routeRounds: RouteRound[];
  routeSaveMessage: string;
  routeSaveState: RouteSaveState;
  routesEdited: boolean;
  selectedPlan: DayPlan;
}>) {
  const [dragging, setDragging] = useState<RouteDragState | null>(null);
  const [dropIndicator, setDropIndicator] =
    useState<RouteDropIndicator | null>(null);
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

  function handleRouteDragOver(
    event: React.DragEvent<HTMLElement>,
    targetRouteId?: string
  ) {
    if (!eventHasRouteDragState(event, dragging)) return;

    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "move";
    if (targetRouteId) {
      setDropIndicator({
        routeId: targetRouteId,
        position: "end",
      });
    }
  }

  function handleStopDragOver(
    event: React.DragEvent<HTMLLIElement>,
    targetRouteId: string,
    targetStopId: string
  ) {
    if (!eventHasRouteDragState(event, dragging)) return;

    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "move";

    const rect = event.currentTarget.getBoundingClientRect();
    setDropIndicator({
      routeId: targetRouteId,
      stopId: targetStopId,
      position: event.clientY < rect.top + rect.height / 2 ? "before" : "after",
    });
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
    setDropIndicator(null);
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
    setDropIndicator(null);
  }

  function addManualStop(routeId: string) {
    const label = window.prompt("Stopnaam", "");
    if (!label) return;

    const detail = window.prompt("Adres/opmerking", "") || "";
    onRouteStopAdd(routeId, label, detail);
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
        <div className="flex flex-wrap items-center justify-end gap-2">
          {deletedRouteStopLabel && (
            <button
              type="button"
              onClick={onRouteStopUndo}
              className="min-h-9 border border-[#d7cec4] bg-white px-3 py-2 text-xs font-black tracking-normal text-[#1a1815] transition hover:border-[#111]"
            >
              Ongedaan
            </button>
          )}
          <RouteConfirmButton
            disabled={!routeCanSave || routeSaveState === "saving"}
            onClick={onRoutesSave}
          />
          <RouteRecalculateButton
            disabled={!routesEdited || routeSaveState === "saving"}
            onClick={onRoutesReset}
          />
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {routeGroups.map((group) => {
          const printableRouteCount = group.routes.filter(
            (route) => route.stops.length > 0
          ).length;
          const visibleRouteCount = group.routes.length;

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
                  <button
                    type="button"
                    aria-label={`Ronde toevoegen aan ${group.vehicle}`}
                    title="Ronde toevoegen"
                    onClick={() => onRouteAdd(group.vehicle)}
                    className="flex h-8 w-8 shrink-0 items-center justify-center border border-[#e8e4de] bg-white text-base font-black text-[#1a1815] shadow-sm transition hover:border-[#111] hover:bg-[#faf8f5]"
                  >
                    +
                  </button>
                  <RoutePrintButton
                    disabled={printableRouteCount === 0}
                    label={`Route printen voor ${group.vehicle}`}
                    onClick={() => openBusRouteSheet(selectedPlan, group)}
                  />
                  <span className="border border-[#e8e4de] bg-[#faf8f5] px-2 py-1 text-[0.68rem] font-black tracking-normal text-[#6b645b]">
                    {visibleRouteCount} ronde
                    {visibleRouteCount === 1 ? "" : "s"}
                  </span>
                </div>
              </div>
              <div className="mt-2 grid gap-2">
                {group.routes.map((route) => (
                  <section
                    key={route.id}
                    onDragOver={(event) => handleRouteDragOver(event, route.id)}
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
                      {!isPrimaryRouteRound(route) && (
                        <button
                          type="button"
                          aria-label={`${route.title} verwijderen`}
                          title="Ronde verwijderen"
                          onClick={() => onRouteDelete(route.id)}
                          className="flex h-6 w-6 shrink-0 items-center justify-center border border-white/80 bg-white text-xs font-black text-[#6b645b] transition hover:border-[#9b2d1f] hover:text-[#9b2d1f]"
                        >
                          X
                        </button>
                      )}
                      <button
                        type="button"
                        aria-label={`Stop toevoegen aan ${route.title}`}
                        title="Stop toevoegen"
                        onClick={() => addManualStop(route.id)}
                        className="flex h-6 w-6 shrink-0 items-center justify-center border border-white/80 bg-white text-sm font-black text-[#1a1815] transition hover:border-[#111]"
                      >
                        +
                      </button>
                    </div>
                    <ol className="mt-2 grid min-h-12 gap-1">
                      {route.stops.length === 0 && (
                        <li className="relative border border-dashed border-white/90 bg-white/70 px-2 py-2 text-xs font-black tracking-normal text-[#8b8278]">
                          {dropIndicator?.routeId === route.id &&
                            dropIndicator.position === "end" && (
                              <RouteDropLine />
                            )}
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
                          onDragEnd={() => {
                            setDragging(null);
                            setDropIndicator(null);
                          }}
                          onDragOver={(event) =>
                            handleStopDragOver(event, route.id, stop.id)
                          }
                          onDrop={(event) =>
                            handleStopDrop(event, route.id, stop.id)
                          }
                          className={`relative grid cursor-grab grid-cols-[1rem_1.45rem_minmax(0,1fr)_1.5rem] gap-1.5 border border-white/80 bg-white px-1.5 py-1 transition hover:border-[#d7cec4] hover:shadow-sm active:cursor-grabbing ${
                            dragging?.stopId === stop.id ? "opacity-45" : ""
                          }`}
                        >
                          {dropIndicator?.routeId === route.id &&
                            dropIndicator.stopId === stop.id &&
                            dropIndicator.position !== "end" && (
                              <RouteDropLine position={dropIndicator.position} />
                            )}
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
                          <button
                            type="button"
                            aria-label={`${stop.label} uit route halen`}
                            title="Stop verwijderen"
                            onClick={(event) => {
                              event.stopPropagation();
                              onRouteStopDelete(route.id, stop.id);
                            }}
                            className="flex h-5 w-5 items-center justify-center border border-[#e8e4de] bg-white text-[0.6rem] font-black text-[#6b645b] transition hover:border-[#9b2d1f] hover:text-[#9b2d1f]"
                          >
                            X
                          </button>
                        </li>
                      ))}
                      {route.stops.length > 0 &&
                        dropIndicator?.routeId === route.id &&
                        dropIndicator.position === "end" && (
                          <li className="relative h-3 list-none">
                            <RouteDropLine position="after" />
                          </li>
                        )}
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
  onDeleteWebshopImage,
  onLinkWebshopImageToReceipt,
  onUnlinkWebshopImageFromReceipt,
  onUploadManualWebshopImageForReceipt,
  onSaveReceiptOverride,
  overrideMessage,
  photoLinkMessage,
  receiptOverrides,
  receiptSummaries,
  selectedPlan,
  webshopImages,
}: Readonly<{
  onDeleteWebshopImage: (image: WebshopImageSummary) => Promise<void>;
  onLinkWebshopImageToReceipt: (
    image: WebshopImageSummary,
    receipt: ReceiptSummary
  ) => Promise<void>;
  onUnlinkWebshopImageFromReceipt: (image: WebshopImageSummary) => Promise<void>;
  onUploadManualWebshopImageForReceipt: (
    receipt: ReceiptSummary,
    file: File
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
          <div className="flex items-center gap-1.5">
            <span className="w-fit border border-[#e8e4de] bg-[#faf8f5] px-2 py-1 text-[0.68rem] font-black tracking-normal text-[#6b645b]">
              {filteredReceipts.length}/{receiptSummaries.length} · foto {webshopImages.length}
            </span>
            <ReceiptPrintButton
              disabled={!selectedReceipt}
              label={
                selectedReceipt
                  ? `Contantbon ${selectedReceipt.receiptNumber || selectedReceipt.id} printen`
                  : "Contantbon printen"
              }
              onClick={() => {
                if (!selectedReceipt) return;
                openReceiptPrintSheet(selectedReceipt, selectedPlan);
              }}
            />
          </div>
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
        onDeleteWebshopImage={onDeleteWebshopImage}
        onUnlinkWebshopImageFromReceipt={onUnlinkWebshopImageFromReceipt}
        onUploadManualWebshopImageForReceipt={
          onUploadManualWebshopImageForReceipt
        }
        onSaveReceiptOverride={onSaveReceiptOverride}
        override={selectedOverride}
        overrideMessage={overrideMessage}
        photoLinkMessage={photoLinkMessage}
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
  const weddingCakeReference = weddingCakeReferenceForReceipt(
    receipt,
    selectedPlan.date
  );

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
          {weddingCakeReference && (
            <a
              href={weddingCakeReference.href}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex border border-[#ead8aa] bg-[#fff7df] px-2 py-1 text-[0.62rem] font-black uppercase tracking-normal text-[#5c4921] underline-offset-2 hover:underline"
            >
              Design {weddingCakeReference.code || weddingCakeReference.search}
            </a>
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
  onDelete,
  onUnlink,
  receipt,
}: Readonly<{
  images: WebshopImageSummary[];
  onDelete: (image: WebshopImageSummary) => Promise<void>;
  onUnlink: (image: WebshopImageSummary) => Promise<void>;
  receipt: ReceiptSummary;
}>) {
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
          const manualUpload = isManualUploadedWebshopImage(image);
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
            <div
              key={image.id}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border border-[#d7d7d7] bg-white p-1.5 text-left transition hover:border-[#111]"
            >
              <a
                href={image.photoUrl}
                target="_blank"
                rel="noreferrer"
                className="grid min-w-0 grid-cols-[3rem_minmax(0,1fr)] gap-2"
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
                    {image.matchSource === "manual"
                      ? "handmatig"
                      : image.confidence}
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
              {manualUpload ? (
                <button
                  type="button"
                  onClick={() => void onDelete(image)}
                  className="min-h-8 border border-[#d4695f] bg-white px-2 text-[0.62rem] font-black uppercase tracking-normal text-[#9a2f28] transition hover:bg-[#fff1ef]"
                >
                  Verwijder
                </button>
              ) : image.matchSource === "manual" ? (
                <button
                  type="button"
                  onClick={() => void onUnlink(image)}
                  className="min-h-8 border border-[#d4695f] bg-white px-2 text-[0.62rem] font-black uppercase tracking-normal text-[#9a2f28] transition hover:bg-[#fff1ef]"
                >
                  Ontkoppel
                </button>
              ) : null}
            </div>
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
        `(?:\\d+(?:[.,]\\d+)?\\s+)?${escapeRegExp(description)}\\s*(?:€\\s*[\\d.,:]+\\s*|\\d{1,9}(?:[.,]\\d{1,3})?\\s*){0,5}`,
        "gi"
      ),
      " "
    );
  });

  const withoutNoise = clean
    .replace(/\b(?:\d{3,9}|[A-Z]{1,4}\d{3,9})(?:[.,][A-Z0-9]{1,8})?\b/gi, " ")
    .replace(
      /\b(?:\d+(?:[.,]\d+)?\s+)?(?:(?:strik's\s+)?(?:marsepeintaart|slagroomtaart|cremetaart)|petit\s+four)[^€]{4,180}\s+€\s*[\d.,:]+(?:\s+\d+(?:[.,]\d+)?\s+€\s*[\d.,:]+(?:\s+€\s*[\d.,:]+)*)?/gi,
      ""
    )
    .replace(
      /\b(?:kleur\s+petit\s*fours?|foto\s*\/\s*logo|foto|logo|geschreven\s+tekst|tekst\s+op\s+(?:taart|gebak|cake|product)|tekst|vulling|voorsnijden)\s*:.*?(?=\s+(?:kleur\s+petit\s*fours?|foto\s*\/\s*logo|foto|logo|geschreven\s+tekst|tekst\s+op\s+(?:taart|gebak|cake|product)|tekst|vulling|voorsnijden)\s*:|\s+(?:\d+(?:[.,]\d+)?\s+)?(?:betaald|niet betaald|gewenste betaling|trial mode|click here|&euro;|€\s*[\d.,:]+\s+met referentie)\b|$)/gi,
      ""
    )
    .replace(/(?:€\s*)?[\d.,:]+\s*€/g, "")
    .replace(/\b(?:\d+(?:[.,]\d+)?\s+)?€\s*[\d.,:]+\b/g, "")
    .replace(/€+/g, "")
    .replace(/trial mode\s*[–-]\s*click here for more information/gi, "")
    .replace(/\btrial mode\b\s*[–-]?/gi, "")
    .replace(/click here for more information/gi, "")
    .replace(/betaald via\s+\[[^\]]+\]\.?/gi, "")
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, " ")
    .replace(/&euro;\s*[\d.,:]+\s+met referentie\s+\S+/gi, "")
    .replace(/€\s*[\d.,:]+\s+met referentie\s+\S+/gi, "")
    .replace(/\b(?:niet\s+)?betaald\s*!+/gi, "")
    .replace(/^\d+(?:[.,]\d+)?\s+/g, "")
    .replace(/\s+\d+(?:[.,]\d+)?$/g, "")
    .replace(/[–—-]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const cleaned = stripEmbeddedDisplayDeliveryNoise(
    trimDisplayNoteToCustomerInstruction(withoutNoise)
  );

  if (isProductResidueDisplayNote(cleaned) || isReceiptNoteRemainder(cleaned)) {
    return "";
  }

  return cleaned;
}

function stripInternalRouteNotesFromDisplayNote(value: string) {
  return value
    .split(/\s+·\s+/)
    .filter(
      (part) => !/^\s*Vaste\s+(?:route|levertijd)\s*:?/i.test(part.trim())
    )
    .join(" · ")
    .replace(/\s+/g, " ")
    .trim();
}

function visibleReceiptNotes(receipt: ReceiptSummary, lines: ReceiptLine[]) {
  return [receipt.customerNote]
    .map((note) =>
      note
        ? stripInternalRouteNotesFromDisplayNote(
            cleanReceiptDisplayNote(note, lines)
          )
        : ""
    )
    .filter(
      (note) =>
        note &&
        !/^geen aparte opmerking\.?$/i.test(note) &&
        !/^geen aparte logistieke waarschuwing\.?$/i.test(note)
    );
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
                  pickupLocation:
                    event.target.value === "bezorgen"
                      ? ""
                      : current.pickupLocation,
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
              Wordt gehaald bij
            </span>
            <select
              value={draft.pickupLocation}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  pickupLocation: event.target.value,
                  fulfillment: event.target.value ? "afhalen" : current.fulfillment,
                }))
              }
              className="h-8 border border-[#d7d7d7] bg-white px-2 text-xs font-bold tracking-normal text-[#111] outline-none focus:border-[#111]"
            >
              <option value="">geen winkel</option>
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

function weddingCakeReferenceForReceipt(
  receipt: ReceiptSummary,
  date: string
): WeddingCakeReceiptReference | null {
  const haystack = [
    receipt.customer,
    receipt.customerNote,
    receipt.internalNote,
    receipt.note,
    receipt.lines
      .map((line) => [line.articleNumber, line.description, line.note].join(" "))
      .join(" "),
  ].join(" ");
  const hasWeddingSignal =
    /\b(?:bruidstaart|bruidstaarten|bruids|bruidspaar|trouwtaart|trouwen)\b/i.test(
      haystack
    );
  const explicitCodeMatch = haystack.match(
    /\b(?:herkenningscode|bruidstaart\s*code|bruidstaartcode|trouwtaart\s*code|code)\s*[:#-]?\s*([A-Z0-9][A-Z0-9-]{2,24})\b/i
  );
  const compactCodeMatch = hasWeddingSignal
    ? haystack.match(/\b((?:BT|BR|BRUID|TAART|WED)[-\s]?\d{2,8})\b/i)
    : null;
  const code = (explicitCodeMatch?.[1] || compactCodeMatch?.[1] || "")
    .replace(/\s+/g, "-")
    .trim();
  const fallbackName = customerLastNameFor(receipt.customer);
  const search = code || (hasWeddingSignal ? fallbackName || receipt.customer : "");

  if (!search) return null;

  const params = new URLSearchParams();
  params.set("zoek", search);
  params.set("datum", date);

  return {
    search,
    code,
    href: `/bruidstaarten/studio?${params.toString()}`,
  };
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
  onDeleteWebshopImage,
  onUnlinkWebshopImageFromReceipt,
  onUploadManualWebshopImageForReceipt,
  onSaveReceiptOverride,
  override,
  overrideMessage,
  photoLinkMessage,
  receipt,
  selectedPlan,
}: Readonly<{
  imageMatches: WebshopImageSummary[];
  onDeleteWebshopImage: (image: WebshopImageSummary) => Promise<void>;
  onUnlinkWebshopImageFromReceipt: (
    image: WebshopImageSummary
  ) => Promise<void>;
  onUploadManualWebshopImageForReceipt: (
    receipt: ReceiptSummary,
    file: File
  ) => Promise<void>;
  onSaveReceiptOverride: (
    receipt: ReceiptSummary,
    draft: ReceiptOverrideDraft
  ) => Promise<void>;
  override: ReceiptOverrideSummary | null;
  overrideMessage: string;
  photoLinkMessage: string;
  receipt: ReceiptSummary | null;
  selectedPlan: DayPlan;
}>) {
  const manualPhotoInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingManualPhoto, setIsUploadingManualPhoto] = useState(false);

  async function handleManualPhotoChange(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];
    if (!file || !receipt) return;

    setIsUploadingManualPhoto(true);
    try {
      await onUploadManualWebshopImageForReceipt(receipt, file);
    } finally {
      setIsUploadingManualPhoto(false);
      event.target.value = "";
    }
  }

  if (!receipt) {
    return (
      <div className="flex h-[30rem] items-center justify-center rounded-lg border border-[#e8e4de] bg-white p-4 text-sm font-bold tracking-normal text-[#6b645b] shadow-sm">
        Geen contantbon geselecteerd.
      </div>
    );
  }

  const receiptNumber = receipt.receiptNumber || receipt.id;
  const displayLines = receipt.lines
    .map(normalizeKnownReceiptLine)
    .filter((line) => !shouldDropReceiptLine(line));
  const visibleNotes = visibleReceiptNotes(receipt, displayLines);
  const internalRouteNotes = receiptInternalRouteNotes(receipt);
  const showManualPhotoUpload =
    receiptNeedsManualPhotoUpload(receipt) && imageMatches.length === 0;

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
                <th className="w-20 pb-1 font-normal">Artikel</th>
                <th className="pb-1 font-normal">Artikelomschrijving</th>
                <th className="w-20 pb-1 text-right font-normal">Prijs incl.</th>
                <th className="w-24 pb-1 text-right font-normal">Totaal</th>
              </tr>
            </thead>
            <tbody>
              {displayLines.map((line, index) => {
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
                    <td className="py-0.5 pr-2 font-normal tabular-nums text-[#333]">
                      {line.articleNumber || ""}
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
          {internalRouteNotes.length > 0 && (
            <div className="mt-2 border border-dashed border-[#d7d1c8] bg-[#faf8f5] px-2 py-1.5 text-[0.62rem] font-bold leading-snug tracking-normal text-[#8a8178]">
              <span className="mr-1 font-black uppercase text-[#6b645b]">
                Route
              </span>
              {internalRouteNotes.join(" · ")}
            </div>
          )}
          <WebshopImageBlock
            images={imageMatches}
            onDelete={onDeleteWebshopImage}
            onUnlink={onUnlinkWebshopImageFromReceipt}
            receipt={receipt}
          />
          {showManualPhotoUpload && (
            <div className="border-b border-dashed border-[#d7d7d7] bg-[#fff8d8] p-3">
              <input
                ref={manualPhotoInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/*"
                className="hidden"
                onChange={(event) => void handleManualPhotoChange(event)}
              />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-black uppercase tracking-normal text-[#6f5212]">
                  Marsepeinfoto ontbreekt
                </p>
                <button
                  type="button"
                  disabled={isUploadingManualPhoto}
                  onClick={() => manualPhotoInputRef.current?.click()}
                  className="min-h-8 border border-[#1a1815] bg-[#1a1815] px-2.5 text-[0.62rem] font-black uppercase tracking-normal text-white transition hover:bg-[#3b352f] disabled:cursor-wait disabled:opacity-60"
                >
                  {isUploadingManualPhoto ? "Uploaden" : "Foto uploaden"}
                </button>
              </div>
              {photoLinkMessage && (
                <p className="mt-1 truncate text-[0.65rem] font-bold tracking-normal text-[#6f5212]">
                  {photoLinkMessage}
                </p>
              )}
            </div>
          )}
          {!showManualPhotoUpload && photoLinkMessage && (
            <p className="border-b border-dashed border-[#d7d7d7] bg-white px-3 py-2 text-[0.65rem] font-bold tracking-normal text-[#315641]">
              {photoLinkMessage}
            </p>
          )}
        </div>
      </div>
    </article>
  );
}

function LearningPanel({
  feedback,
  isSaving,
  learningSignals,
  logisticsAdvice,
  message,
  onAddTeamMember,
  onBusDepartureChange,
  onFeedbackChange,
  onPressureChange,
  onRemoveTeamMember,
  onSave,
  onTeamMemberNameChange,
  onTeamTimeChange,
  operationsDraft,
  pressureOverride,
  recentDayFeedback,
  routeLearning,
  selectedPlan,
}: Readonly<{
  feedback: string;
  isSaving: boolean;
  learningSignals: string[];
  logisticsAdvice: LogisticsAdvice;
  message: string;
  onAddTeamMember: () => void;
  onBusDepartureChange: (bus: BusId, value: string) => void;
  onFeedbackChange: (value: string) => void;
  onPressureChange: (value: LogisticsLoadPressure | "") => void;
  onRemoveTeamMember: (memberId: string) => void;
  onSave: () => void;
  onTeamMemberNameChange: (memberId: string, value: string) => void;
  onTeamTimeChange: (field: "teamStartTime" | "teamEndTime", value: string) => void;
  operationsDraft: OperationsDraft;
  pressureOverride: LogisticsLoadPressure | "";
  recentDayFeedback: DayFeedbackSummary[];
  routeLearning: RouteLearningSummary | null;
  selectedPlan: DayPlan;
}>) {
  const learnedStops = routeLearning?.stops.slice(0, 6) || [];
  const learnedPairs = routeLearning?.pairs.slice(0, 4) || [];
  const savedOperationsCount = recentDayFeedback.filter(
    (item) => item.operations
  ).length;

  return (
    <section className="grid gap-3 xl:grid-cols-[minmax(0,1.15fr)_minmax(20rem,0.85fr)]">
      <div className="grid gap-3">
        <div className="rounded-lg border border-[#d6e5d8] bg-[#f6faf4] p-3 shadow-sm sm:p-4">
          <p className="text-[0.68rem] font-black uppercase tracking-normal text-[#6f7d68]">
            Richtlijn startteam · {selectedPlan.title}
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <AdviceMetric label="Start" value={logisticsAdvice.teamStartTime} />
            <AdviceMetric
              label="Bezetting"
              value={`${logisticsAdvice.teamSize} pers`}
            />
          </div>
          <p className="mt-3 text-xs font-bold tracking-normal text-[#6f7d68]">
            {logisticsAdvice.reason}
          </p>
        </div>

        <div className="rounded-lg border border-[#e8e4de] bg-white p-3 shadow-sm sm:p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-black tracking-normal text-[#1a1815]">
                Logistiek logboek
              </h2>
              <p className="text-xs font-bold tracking-normal text-[#8a8178]">
                {savedOperationsCount} dag(en) met teamdata in geheugen
              </p>
            </div>
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

          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <div className="grid gap-2">
              <p className="text-[0.68rem] font-black uppercase tracking-normal text-[#8a8178]">
                Vertrek
              </p>
              {(["A", "B"] as BusId[]).map((bus) => (
                <label
                  key={bus}
                  className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-2 text-xs font-black tracking-normal text-[#6b645b]"
                >
                  Bus {bus}
                  <input
                    type="time"
                    value={operationsDraft.busDepartures[bus]}
                    onChange={(event) =>
                      onBusDepartureChange(bus, event.target.value)
                    }
                    className="min-h-10 border border-[#e8e4de] bg-[#faf8f5] px-2 text-sm font-black tracking-normal text-[#1a1815] outline-none focus:border-[#ef5737]"
                  />
                </label>
              ))}
            </div>

            <div className="grid gap-2">
              <p className="text-[0.68rem] font-black uppercase tracking-normal text-[#8a8178]">
                Team
              </p>
              <label className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-2 text-xs font-black tracking-normal text-[#6b645b]">
                Start
                <input
                  type="time"
                  value={operationsDraft.teamStartTime}
                  onChange={(event) =>
                    onTeamTimeChange("teamStartTime", event.target.value)
                  }
                  className="min-h-10 border border-[#e8e4de] bg-[#faf8f5] px-2 text-sm font-black tracking-normal text-[#1a1815] outline-none focus:border-[#ef5737]"
                />
              </label>
              <label className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-2 text-xs font-black tracking-normal text-[#6b645b]">
                Klaar
                <input
                  type="time"
                  value={operationsDraft.teamEndTime}
                  onChange={(event) =>
                    onTeamTimeChange("teamEndTime", event.target.value)
                  }
                  className="min-h-10 border border-[#e8e4de] bg-[#faf8f5] px-2 text-sm font-black tracking-normal text-[#1a1815] outline-none focus:border-[#ef5737]"
                />
              </label>
            </div>
          </div>

          <div className="mt-3 border-t border-[#e8e4de] pt-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[0.68rem] font-black uppercase tracking-normal text-[#8a8178]">
                Personen
              </p>
              <button
                type="button"
                onClick={onAddTeamMember}
                className="border border-[#d6e5d8] bg-[#f6faf4] px-2 py-1 text-xs font-black tracking-normal text-[#1a1815] transition hover:bg-white"
              >
                + persoon
              </button>
            </div>
            <div className="mt-2 grid gap-2">
              {operationsDraft.teamMembers.map((member, index) => (
                <div
                  key={member.id}
                  className="grid grid-cols-[minmax(0,1fr)_2rem] gap-2"
                >
                  <input
                    type="text"
                    value={member.name}
                    onChange={(event) =>
                      onTeamMemberNameChange(member.id, event.target.value)
                    }
                    placeholder={`Pers ${index + 1}`}
                    className="min-h-10 border border-[#e8e4de] bg-[#faf8f5] px-2 text-sm font-black tracking-normal text-[#1a1815] outline-none focus:border-[#ef5737]"
                  />
                  <button
                    type="button"
                    aria-label="Persoon verwijderen"
                    title="Persoon verwijderen"
                    onClick={() => onRemoveTeamMember(member.id)}
                    className="flex h-10 items-center justify-center border border-[#e8e4de] bg-white text-sm font-black text-[#8a8178] transition hover:border-[#1a1815] hover:text-[#1a1815]"
                  >
                    -
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-3 grid grid-cols-4 border border-[#e8e4de] bg-[#faf8f5] p-1">
            {pressureOptions.map((option) => {
              const active = pressureOverride === option.value;

              return (
                <button
                  key={option.label}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onPressureChange(option.value)}
                  className={`min-h-9 px-1 text-xs font-black tracking-normal transition ${
                    active
                      ? "bg-[#1a1815] text-white"
                      : "bg-white text-[#6b645b] hover:bg-[#f6faf4]"
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>

          <textarea
            value={feedback}
            onChange={(event) => onFeedbackChange(event.target.value)}
            placeholder="Bijv. bus B moest later weg door ijsvolume..."
            className="mt-3 min-h-24 w-full resize-y border border-[#e8e4de] bg-[#faf8f5] p-3 text-sm font-bold leading-snug tracking-normal text-[#1a1815] outline-none focus:border-[#ef5737]"
          />
          {message && (
            <p className="mt-2 text-xs font-bold tracking-normal text-[#6b645b]">
              {message}
            </p>
          )}
        </div>
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

        <div className="mt-4 border-t border-[#d6e5d8] pt-3">
          <p className="text-xs font-black uppercase tracking-normal text-[#4a6d5a]">
            Routegeheugen · {routeLearning?.observationCount || 0} routes
          </p>
          <div className="mt-2 grid gap-2">
            {learnedStops.length ? (
              learnedStops.map((stop) => (
                <div
                  key={stop.key}
                  className="border border-[#d6e5d8] bg-white px-2 py-1.5"
                >
                  <p className="truncate text-xs font-black tracking-normal text-[#1a1815]">
                    {stop.label}
                  </p>
                  <p className="truncate text-[0.68rem] font-bold tracking-normal text-[#6b645b]">
                    {stop.preferredVehicle || "bus check"} · {stop.samples}x
                  </p>
                </div>
              ))
            ) : (
              <p className="text-xs font-bold tracking-normal text-[#6b645b]">
                Nog geen handmatige routevolgordes opgeslagen.
              </p>
            )}
          </div>
          {learnedPairs.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {learnedPairs.map((pair) => (
                <span
                  key={pair.key}
                  className="border border-[#d6e5d8] bg-white px-2 py-1 text-[0.68rem] font-black tracking-normal text-[#1a1815]"
                >
                  {pair.fromLabel}
                  {" -> "}
                  {pair.toLabel}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function AdviceMetric({
  label,
  value,
}: Readonly<{
  label: string;
  value: string;
}>) {
  return (
    <div className="rounded-md border border-[#d6e5d8] bg-white px-2 py-2">
      <p className="text-[0.62rem] font-black uppercase tracking-normal text-[#8a8178]">
        {label}
      </p>
      <p className="mt-1 text-lg font-black tracking-normal text-[#1a1815]">
        {value}
      </p>
    </div>
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

function WrittenTextPrintButton({
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
      aria-label="Geschreven teksten controleren"
      title="Geschreven teksten controleren"
      disabled={disabled}
      onClick={onClick}
      className="relative flex h-10 w-10 items-center justify-center border border-[#e8e4de] bg-white text-[#1a1815] shadow-sm transition hover:bg-[#faf8f5] disabled:cursor-not-allowed disabled:opacity-40"
    >
      <TextSheetIcon />
      {count > 0 && (
        <span className="absolute -right-1 -top-1 min-w-4 border border-[#1a1815] bg-[#1a1815] px-1 text-center text-[0.56rem] font-black leading-4 tracking-normal text-white">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </button>
  );
}

function RouteRecalculateButton({
  disabled,
  onClick,
}: Readonly<{
  disabled: boolean;
  onClick: () => void;
}>) {
  return (
    <button
      type="button"
      aria-label="Herbereken automatisch"
      title="Herbereken automatisch"
      disabled={disabled}
      onClick={onClick}
      className="flex h-8 items-center gap-1.5 border border-[#e8e4de] bg-white px-2 text-xs font-black tracking-normal text-[#1a1815] shadow-sm transition hover:bg-[#faf8f5] disabled:cursor-not-allowed disabled:opacity-40"
    >
      <RefreshIcon spinning={false} />
      <span>Herbereken</span>
    </button>
  );
}

function RouteConfirmButton({
  disabled,
  onClick,
}: Readonly<{
  disabled: boolean;
  onClick: () => void;
}>) {
  return (
    <button
      type="button"
      aria-label="Definitieve route opslaan"
      title="Definitieve route opslaan en routegeheugen bijwerken"
      disabled={disabled}
      onClick={onClick}
      className="flex h-8 items-center gap-1.5 border border-[#bfe3c8] bg-[#f6faf4] px-2 text-xs font-black tracking-normal text-[#1a1815] shadow-sm transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
    >
      <SaveIcon />
      <span className="sm:hidden">Definitief</span>
      <span className="hidden sm:inline">Definitieve route opslaan</span>
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

function ReceiptPrintButton({
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
      className="flex h-8 w-8 items-center justify-center border border-[#d7d1c8] bg-white text-[#1a1815] shadow-sm transition hover:border-[#1a1815] hover:bg-[#faf8f5] disabled:cursor-not-allowed disabled:opacity-40"
    >
      <PrintIcon />
    </button>
  );
}

function PreparationPrintButton({
  disabled,
  onSelect,
}: Readonly<{
  disabled?: boolean;
  onSelect: (category: PreparationCategory) => void;
}>) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-label="Voorbereidingslijst openen"
        title="Voorbereidingslijst openen"
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        className="relative flex h-10 w-10 items-center justify-center border border-[#e8e4de] bg-white text-[#1a1815] shadow-sm transition hover:bg-[#faf8f5] disabled:cursor-not-allowed disabled:opacity-40"
      >
        <PreparationIcon />
      </button>
      {open && !disabled && (
        <div className="absolute right-0 z-30 mt-1 grid min-w-36 gap-1 border border-[#d7d1c8] bg-white p-1 shadow-lg">
          {(["bakkerij", "logistiek"] as PreparationCategory[]).map(
            (category) => (
              <button
                key={category}
                type="button"
                onClick={() => {
                  setOpen(false);
                  onSelect(category);
                }}
                className="min-h-8 px-2 text-left text-[0.68rem] font-black uppercase tracking-normal text-[#1a1815] transition hover:bg-[#faf8f5]"
              >
                {preparationCategories[category].shortLabel}
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}

function RouteDropLine({
  position = "before",
}: Readonly<{
  position?: "before" | "after";
}>) {
  return (
    <span
      aria-hidden="true"
      className={`pointer-events-none absolute left-0 right-0 z-10 h-1 rounded-full bg-[#2fbf71] shadow-[0_0_0_2px_rgba(47,191,113,0.22)] ${
        position === "after" ? "-bottom-1" : "-top-1"
      }`}
    >
      <span className="absolute -left-1 -top-1 h-3 w-3 rounded-full border-2 border-white bg-[#2fbf71]" />
    </span>
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

function SaveIcon() {
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
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
      <path d="M17 21v-8H7v8" />
      <path d="M7 3v5h8" />
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

function TextSheetIcon() {
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
      <path d="M5 4h14v16H5z" />
      <path d="M8 8h8" />
      <path d="M8 12h8" />
      <path d="M8 16h5" />
      <path d="M15.5 15.5 18 18" />
    </svg>
  );
}

function PreparationIcon() {
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
      <path d="M9 3h6l1 2h3v16H5V5h3l1-2z" />
      <path d="M9 8h6" />
      <path d="M8 13h3" />
      <path d="M8 17h3" />
      <path d="m15 13 1.5 1.5L20 11" />
      <path d="m15 17 1.5 1.5L20 15" />
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
