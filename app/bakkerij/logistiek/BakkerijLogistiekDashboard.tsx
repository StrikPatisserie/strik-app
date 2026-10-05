"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { StrikPageHeader, StrikShell, strikIcons } from "../../StrikUI";
import {
  AREND_PRINT_SESSION_KEY,
  AREND_PRINT_SQUARES_PER_SHEET,
  type ArendPrintSessionBreakdown,
  type ArendPrintSession,
} from "./arendPrintSession";
import {
  applySpecialSchoolDeliverySplit,
  isSpecialSchoolChildReceipt,
  isSpecialSchoolSourceReceipt,
  specialSchoolDeliveryCakeCount,
  specialSchoolDeliveryDate,
  specialSchoolDeliveryRouteId,
  specialSchoolDeliveryRouteIndex,
  specialSchoolDeliveryStops,
  specialSchoolDeliveryVehicle,
  specialSchoolDeliveryVehicleForReceipt,
  specialSchoolDeliveryVehicleRouteIndex,
} from "./specialSchoolDelivery";
import {
  applySpecialProCollegeDeliverySplit,
  isSpecialProCollegeChildReceipt,
  isSpecialProCollegeSourceReceipt,
  specialProCollegeDeliveryDate,
  specialProCollegeDeliveryPieceCount,
  specialProCollegeDeliveryStops,
  specialProCollegeRoundForReceipt,
  specialProCollegeRouteIndex,
  specialProCollegeVehicleForReceipt,
} from "./specialProCollegeDelivery";
import type {
  LogisticsBatch,
  LogisticsBatchStatus,
  LogisticsDayFeedback,
  LogisticsDayOperations,
  LogisticsFixedCustomer,
  LogisticsFulfillment,
  LogisticsLoadPressure,
  LogisticsPreparationProduct,
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
  alert?: boolean;
  metrics?: {
    label: string;
    value: string;
    alert: boolean;
  }[];
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

type RouteStopDeleteChoice = {
  receiptId: string;
  routeId: string;
  routeTitle: string;
  stopId: string;
  stopLabel: string;
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
type PreparationProductSummary = LogisticsPreparationProduct;
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
  imageId: string;
  imageImportedAt: string;
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
  printKey: string;
};

type MarzipanPhotoPrintGroup = {
  customerName: string;
  imageId: string;
  itemCount: number;
  newItemCount: number;
  photoUrl: string;
  products: string[];
  receiptNumbers: string[];
};

type MarzipanPhotoPrintHistory = {
  printedAt: string;
  printedKeys: string[];
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

type ArendNumberPrintOrder = {
  id: string;
  receiptNumber: string;
  customerName: string;
  lineDescription: string;
  sheetQuantity: number;
  defaultSquareCount: number;
  inferredNumber: string;
};

type ArendNumberPrintItem = {
  id: string;
  number: string;
  displayNumber: string;
  copyNumber: number;
  sourceLabel: string;
};

type ArendNumberPrintParseResult = {
  error?: string;
  items: ArendNumberPrintItem[];
  orderedCount: number;
  printBreakdown: ArendPrintSessionBreakdown[];
  printCapacity: number;
  requestedCount: number;
  requestedBreakdown: ArendPrintSessionBreakdown[];
  reserveCount: number;
};

const AREND_ORDERED_SQUARES_PER_SHEET = 50;
const legacyProCollegeFullDeleteDate = "2026-10-06";

type PreparationCategory = "bakkerij" | "logistiek";

type PreparationRule = {
  category: PreparationCategory;
  code: string;
  label: string;
  articleNumber?: string;
  subcode?: string;
  textPatterns?: RegExp[];
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
const MARZIPAN_PHOTO_PRINT_HISTORY_STORAGE_KEY =
  "strik-logistiek-marsepeinfoto-print-history-v1";

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
];

const weddingCakeArticleNumbers = new Set(["25400", "25401", "25402", "25403"]);

const ordersFilters: {
  id: OrdersFilter;
  label: string;
  location?: string;
  fulfillment?: LogisticsFulfillment;
}[] = [
  { id: "all", label: "Alles" },
  { id: "delivery", label: "Bezorgen", fulfillment: "bezorgen" },
  { id: "pickup-heyendaalseweg", label: "Heyendaalseweg", location: "Heyendaalseweg" },
  { id: "pickup-daalseweg", label: "Daalseweg", location: "Daalseweg" },
  { id: "pickup-ziekerstraat", label: "Ziekerstraat", location: "Ziekerstraat" },
  { id: "pickup-lent", label: "Lent", location: "Lent" },
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
    label: "Verdeellijst logistiek",
    shortLabel: "Logistiek",
    emptyLabel: "Geen logistieke producten gevonden voor deze dag.",
  },
};

function preparationRulesFor(
  category: PreparationCategory,
  products: PreparationProductSummary[]
) {
  const managedRules = products
    .filter((product) => product.category === category)
    .map((product) => {
    const [articleNumber, subcode] = product.articleNumber.split(".", 2);

    return {
      category,
      code: product.articleNumber,
      label: product.articleName,
      articleNumber,
      subcode: subcode || undefined,
    };
  });

  return managedRules;
}

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

function dateFromInputDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return new Date(Number.NaN);

  return new Date(year, month - 1, day);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function nextLogisticsDateFor(date: Date) {
  const weekday = date.getDay();
  if (weekday === 6) return addDays(date, 2);
  if (weekday === 0) return addDays(date, 1);

  return addDays(date, 1);
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

const DEFINITIVE_BATCH_START_MINUTE_OF_DAY = 20 * 60 + 30;
const TOMORROW_PROGNOSE_START_MINUTE_OF_DAY = 12 * 60 + 30;
const SATURDAY_MONDAY_PROGNOSE_START_MINUTE_OF_DAY = 7 * 60 + 15;

function minuteOfDay(hour: number, minute: number) {
  return hour * 60 + minute;
}

function createDateState(): DateState {
  const now = new Date();
  const today = toInputDate(now);
  const nextLogisticsDate = toInputDate(nextLogisticsDateFor(now));

  return {
    today,
    tomorrow: nextLogisticsDate,
    selectedDate: today,
    hour: now.getHours(),
    minute: now.getMinutes(),
  };
}

function syncDateState(current: DateState): DateState {
  const next = createDateState();
  let selectedDate = current.selectedDate;

  if (current.today !== next.today && current.selectedDate === current.today) {
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

function formatWeekdayDateLabel(value: string) {
  const date = dateFromInputDate(value);
  if (!Number.isFinite(date.getTime())) return value;

  return new Intl.DateTimeFormat("nl-NL", {
    weekday: "long",
  }).format(date);
}

function nextLogisticsDateLabel(dateState: DateState) {
  if (isNextLogisticsDateCalendarTomorrow(dateState)) return "Morgen";

  const weekday = formatWeekdayDateLabel(dateState.tomorrow);
  return weekday.charAt(0).toUpperCase() + weekday.slice(1);
}

function isNextLogisticsDateCalendarTomorrow(dateState: DateState) {
  const todayDate = dateFromInputDate(dateState.today);
  const calendarTomorrow = Number.isFinite(todayDate.getTime())
    ? toInputDate(addDays(todayDate, 1))
    : "";

  return dateState.tomorrow === calendarTomorrow;
}

function tomorrowPrognoseGate(dateState: DateState) {
  if (dateState.selectedDate !== dateState.tomorrow) return null;

  const weekday = dayOfWeekForDate(dateState.today);
  if (weekday === 0) return null;

  const saturday = weekday === 6;
  const releaseMinute = saturday
    ? SATURDAY_MONDAY_PROGNOSE_START_MINUTE_OF_DAY
    : TOMORROW_PROGNOSE_START_MINUTE_OF_DAY;

  if (minuteOfDay(dateState.hour, dateState.minute) >= releaseMinute) return null;

  return saturday
    ? "De voorlopige prognose voor maandag is zaterdag vanaf 07:15 beschikbaar."
    : "De voorlopige prognose voor morgen wordt rond 12:30 verwacht.";
}

function futurePlanGateMessage(dateState: DateState, hasBatch: boolean) {
  if (dateState.selectedDate <= dateState.today || hasBatch) return null;

  if (dateState.selectedDate === dateState.tomorrow) {
    return tomorrowPrognoseGate(dateState) ||
      "Voor deze datum is nog geen prognose ingeladen. Probeer het straks opnieuw.";
  }

  return "Voor deze toekomstige datum is nog geen prognose ingeladen. De planning verschijnt zodra de bonnen binnen zijn.";
}

function WaitingPlanBackdrop() {
  return <div aria-hidden="true" className="pointer-events-none select-none space-y-3 opacity-30 blur-[1px]">
    <div className="flex flex-wrap items-center justify-between gap-3 border border-[#e8e4de] bg-[#faf8f5] p-3">
      <div className="space-y-2"><div className="h-3 w-28 rounded bg-[#8d968b]" /><div className="h-5 w-44 rounded bg-[#8d968b]" /></div>
      <div className="flex gap-2"><div className="h-9 w-20 rounded bg-white" /><div className="h-9 w-20 rounded bg-white" /><div className="h-9 w-20 rounded bg-white" /></div>
    </div>
    <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-5">{Array.from({ length: 5 }, (_, index) => <div key={index} className="h-20 border border-[#e8e4de] bg-white p-3"><div className="h-2 w-16 rounded bg-[#b5c2b3]" /><div className="mt-4 h-5 w-24 max-w-full rounded bg-[#8d968b]" /></div>)}</div>
    <div className="grid gap-3 lg:grid-cols-2">{[0, 1].map((column) => <div key={column} className="min-h-72 border border-[#e8e4de] bg-white p-4"><div className="h-5 w-36 rounded bg-[#8d968b]" />{[0, 1, 2, 3].map((row) => <div key={row} className="mt-4 flex items-center gap-3 border-b border-[#e8e4de] pb-3"><div className="h-8 w-8 rounded-full bg-[#b5c2b3]" /><div className="h-3 flex-1 rounded bg-[#d5ded3]" /><div className="h-3 w-12 rounded bg-[#d5ded3]" /></div>)}</div>)}</div>
  </div>;
}

function planTitleForDate(dateState: DateState) {
  if (dateState.selectedDate === dateState.today) return "Vandaag";
  if (dateState.selectedDate === dateState.tomorrow) {
    return nextLogisticsDateLabel(dateState);
  }

  return formatDateLabel(dateState.selectedDate);
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

function formatCompactCurrency(value: number) {
  return `€ ${Math.round(value).toLocaleString("nl-NL")}`;
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
    if (!isNextLogisticsDateCalendarTomorrow(dateState)) return "prognose";

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

  return receipts.flatMap((receipt) => {
    const override = byId.get(receiptOverrideId(date, receipt));
    if (!override) return [receipt];
    if (override.removed) return [];

    const nextTags = receipt.tags.includes("aangepast")
      ? receipt.tags
      : [...receipt.tags, "aangepast"];
    const nextInternalNote = override.routeNote
      ? `Regie: ${override.routeNote}`
      : receipt.internalNote;

    return [
      {
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
      },
    ];
  });
}

function applyLegacyProCollegeFullDeletion(
  receipts: ReceiptSummary[],
  date: string,
  excludedSourceIds: string[]
) {
  if (date !== legacyProCollegeFullDeleteDate) return receipts;

  const excludedReceiptIds = new Set(
    excludedSourceIds
      .filter((sourceId) => sourceId.startsWith("receipt:"))
      .map((sourceId) => sourceId.slice("receipt:".length))
  );
  if (excludedReceiptIds.size === 0) return receipts;

  return receipts.filter(
    (receipt) =>
      !(
        excludedReceiptIds.has(receipt.id) &&
        normalizeMatchText(receipt.customer).includes("pro college")
      )
  );
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

    const bonTime = receiptBonOperationalTime(receipt);
    const hasBonTime = Boolean(bonTime);
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
          ? bonTime || receipt.time
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
  const shouldUseTomorrowStatus =
    isTomorrow && isNextLogisticsDateCalendarTomorrow(dateState);
  const status = fileSnapshot
    ? fileSnapshot.status
    : importedBatch
      ? importedBatch.status
      : isToday
        ? "definitief"
        : isTomorrow
          ? shouldUseTomorrowStatus
            ? tomorrowStatus(hour, minute)
            : "prognose"
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
    title: planTitleForDate(dateState),
    status,
    sourceLabel: sourceLabelFor(status),
    batchLabel:
      status === "prognose" && dayOfWeekForDate(selectedDate) === 1
        ? "Prognose zaterdag 07:00"
        : batchLabelFor(status),
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

function dayPlanWithReceiptTotals(
  plan: DayPlan,
  receipts: ReceiptSummary[]
): DayPlan {
  const orderValue = receipts
    .filter(
      (receipt) =>
        !receipt.tags.includes("intern") && !receipt.tags.includes("ijs")
    )
    .reduce((total, receipt) => total + (receipt.value || 0), 0);
  const orderCount = receipts.length;
  const iceTubs = calculateIceTubTotal(receipts);
  const orderPressure =
    orderValue >= 3500 || orderCount >= 35
      ? "hoog"
      : orderValue >= 2000 || orderCount >= 18
        ? "middel"
        : "laag";

  return {
    ...plan,
    orderCount,
    orderValue,
    orderPressure,
    iceTubs,
    tempexBoxes: Math.ceil(iceTubs / 3),
    criticalWindows: receipts.filter(isCriticalReceipt).length,
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
  if (status === "prognose") return "Prognose 12:30";
  if (status === "definitief") return "Definitief 20:00";
  if (status === "handmatig") return "Upload";
  if (status === "historie") return "Archief";
  return "Nog niet";
}

function buildStats(
  plan: DayPlan,
  productionTotals: BakeryProductionTotals
): DayStat[] {
  const weekday = dayOfWeekForDate(plan.date);
  const showPressureSignals = weekday >= 1 && weekday <= 5;

  return [
    {
      label: "Bonwaarde",
      value: formatCompactCurrency(plan.orderValue),
      alert: showPressureSignals && plan.orderValue >= 2500,
    },
    {
      label: "Pakbonnen",
      value: String(plan.orderCount),
      alert: showPressureSignals && plan.orderCount > 35,
    },
    {
      label: "IJs/tempex",
      value: `${plan.iceTubs} / ${plan.tempexBoxes}`,
    },
    {
      label: "Banket",
      metrics: [
        {
          label: "Ges. gebak",
          value: formatCompactNumber(productionTotals.assortedPastry),
          alert:
            showPressureSignals && productionTotals.assortedPastry > 100,
        },
        {
          label: "Petit fours",
          value: formatCompactNumber(productionTotals.petitFours),
          alert: showPressureSignals && productionTotals.petitFours > 100,
        },
        {
          label: "Feesttaarten",
          value: formatCompactNumber(productionTotals.marzipanAndCreamCakes),
          alert:
            showPressureSignals &&
            productionTotals.marzipanAndCreamCakes > 5,
        },
      ],
    },
  ];
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

function pickupAbbreviationForKey(key: string) {
  if (key === "heyendaalseweg") return "H";
  if (key === "daalseweg") return "D";
  if (key === "ziekerstraat") return "Z";
  if (key === "lent") return "L";

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

function receiptBusForRoutes(
  receipt: ReceiptSummary,
  routeRounds: RouteRound[]
): BusId | "" {
  if (
    isSpecialSchoolSourceReceipt(receipt) ||
    isSpecialProCollegeSourceReceipt(receipt)
  ) {
    return "";
  }

  const sourceIds = new Set([
    `receipt:${receipt.id}`,
    `ice:${receipt.id}`,
  ]);
  const assignedRoute = routeRounds.find((route) =>
    route.stops.some((stop) => sourceIds.has(stop.sourceId))
  );
  const assignedBus = assignedRoute
    ? busIdFromVehicleName(assignedRoute.vehicle)
    : "";
  if (assignedBus) return assignedBus;

  const shopKey = shopKeyForReceipt(receipt);
  if (shopKey) return busForShopKey(shopKey);

  return busIdFromVehicleName(receipt.route || "") || preferredBusForReceipt(receipt);
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

function normalizeReceiptClockTime(value: string) {
  const match = value.trim().match(/^(\d{1,2})[:.](\d{2})$/);
  if (!match) return "";

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (
    !Number.isInteger(hour) ||
    !Number.isInteger(minute) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return "";
  }

  return `${String(hour).padStart(2, "0")}:${match[2]}`;
}

function extractOperationalTimeFromFreeText(value: string) {
  const text = value.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
  if (!text) return "";

  const range = text.match(
    /\b(?:tussen|van)\s+(\d{1,2}[:.]\d{2})\s*(?:uur)?\s*(?:en|tot|-)\s*(\d{1,2}[:.]\d{2})\s*(?:uur)?\b/i
  );
  if (range) {
    const start = normalizeReceiptClockTime(range[1]);
    const end = normalizeReceiptClockTime(range[2]);

    return start && end ? `${start}-${end}` : "";
  }

  const preferred = text.match(
    /\b(?:graag\s+)?(?:v[oó]or|uiterlijk|om|vanaf|bezorgen|bezorging|leveren|levering|tijd|bezorgtijd)\b[^.?!;\n]{0,80}?(\d{1,2}[:.]\d{2})\s*(?:uur)?\b/i
  );
  if (preferred) return normalizeReceiptClockTime(preferred[1]);

  const deliveryAfterTime = text.match(
    /\b(\d{1,2}[:.]\d{2})\s*(?:uur)?\s+(?:bezorgen|leveren|brengen|klaar)\b/i
  );
  if (deliveryAfterTime) return normalizeReceiptClockTime(deliveryAfterTime[1]);

  return "";
}

function receiptOperationalTime(receipt: ReceiptSummary) {
  const time = receipt.time.trim();
  if (!time || /^geen tijd$/i.test(time)) return "";
  if (timeLooksLikePhotoTimestamp(receipt, time)) return "";
  if (!hasValidClockTimes(time)) return "";

  return time;
}

function receiptNoteOperationalTime(receipt: ReceiptSummary) {
  const source = [
    receipt.customerNote,
    receipt.note,
    receipt.lines.map((line) => line.note || "").join(" "),
  ]
    .filter(Boolean)
    .join(" ");

  if (!/\b(?:graag|bezorg|lever|v[oó]or|om|vanaf|tijd|uur)\b/i.test(source)) {
    return "";
  }

  const time = extractOperationalTimeFromFreeText(source);
  if (!time || timeLooksLikePhotoTimestamp(receipt, time)) return "";

  return time;
}

function receiptBonOperationalTime(receipt: ReceiptSummary) {
  return receiptNoteOperationalTime(receipt) || receiptOperationalTime(receipt);
}

function receiptListTimeLabel(receipt: ReceiptSummary) {
  const time = receiptBonOperationalTime(receipt);
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

  const imageCustomerName =
    image.customerName || image.matchedReceiptCustomer || "";
  const imageName = normalizeMatchText(imageCustomerName);
  const receiptName = normalizeMatchText(receipt.customer);
  const imageLastName = normalizeMatchText(
    customerLastNameFor(imageCustomerName)
  );
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

  const imageNameWords = significantWords(imageCustomerName);
  return (
    imageNameWords.length > 0 &&
    imageNameWords.every((word) => hasNormalizedWord(receiptName, word))
  );
}

function isBeterVoorLogoImage(image: WebshopImageSummary) {
  const text = normalizeMatchText(
    [image.fileName, image.productSummary || "", image.subject]
      .filter(Boolean)
      .join(" ")
  );

  return (
    text.includes("beter voor logo") ||
    (hasNormalizedWord(text, "beter") &&
      hasNormalizedWord(text, "voor") &&
      hasNormalizedWord(text, "logo"))
  );
}

function isArendBeterVoorPetitFourReceipt(receipt: ReceiptSummary) {
  if (!isGasterijDeArendReceipt(receipt)) return false;

  return receipt.lines.some(
    (line) =>
      isPetitFourLine(line) &&
      isPhotoSignalLine(line) &&
      Math.round(numericQuantity(line.quantity)) === 100
  );
}

function imageMatchesReceipt(
  image: WebshopImageSummary,
  receipt: ReceiptSummary
) {
  if (image.matchedReceiptId || image.matchedReceiptNumber) {
    const directMatch = Boolean(
      (image.matchedReceiptId && image.matchedReceiptId === receipt.id) ||
        (image.matchedReceiptNumber &&
          image.matchedReceiptNumber === receipt.receiptNumber)
    );
    if (directMatch) return true;

    // Een handmatig gekoppelde foto kan nog het bon-ID uit de prognose hebben,
    // terwijl de definitieve import voor dezelfde klant een nieuw ID gebruikt.
    // Laat zo'n foto daarom ook nog op klantnaam en product proberen te koppelen.
    if (!isManualUploadedWebshopImage(image)) return false;
  }

  if (
    image.deliveryDate === "2026-10-06" &&
    isBeterVoorLogoImage(image) &&
    isArendBeterVoorPetitFourReceipt(receipt)
  ) {
    return true;
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

function receiptRouteIdentityText(receipt: ReceiptSummary) {
  return normalizeMatchText(
    [
      receipt.customer,
      receipt.address,
      receipt.deliveryAddress,
      receipt.alternativeAddress || "",
      receipt.pickupLocation || "",
    ].join(" ")
  );
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

function hasArendMarzipanLogoSignal(value: string) {
  return /\blogo\s+op\s+marsepein\b/i.test(value.trim());
}

function isStandaloneMarzipanLogoProduct(value: string) {
  return hasArendMarzipanLogoSignal(value);
}

function isProductOptionLine(line: ReceiptLine) {
  const description = normalizedLineDescription(line.description);
  if (isStandaloneMarzipanLogoProduct(description)) return false;

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

function isPetitGateauLine(line: ReceiptLine) {
  if (isProductOptionLine(line)) return false;

  const articleNumber = String(
    line.catalogArticleNumber || line.articleNumber || ""
  ).trim();
  const description = normalizedLineDescription(line.description);

  return (
    /^509\.61[1-4]\b/.test(articleNumber) ||
    /\bpetit\s*-?\s*gateau(?:x)?\b/.test(description)
  );
}

function isWeddingCakeLine(line: ReceiptLine) {
  const hasWeddingCakeArticleNumber = [
    line.articleNumber,
    line.catalogArticleNumber,
  ].some((value) => {
    const articleNumber = String(value || "")
      .trim()
      .match(/^\d+/)?.[0];

    return Boolean(articleNumber && weddingCakeArticleNumbers.has(articleNumber));
  });
  if (hasWeddingCakeArticleNumber) return true;

  const description = normalizedLineDescription(line.description);

  return /^bruidstaart\b/.test(description) && /\bpp\b/.test(description);
}

function isWeddingCakeReceipt(receipt: ReceiptSummary) {
  return receipt.lines.some(isWeddingCakeLine);
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
  const isSmallSquarePhotoProduct =
    isPetitFourLine(input.line) || isPetitGateauLine(input.line);
  const isRoundProduct =
    input.forceRound ||
    isMarzipanOrCreamCakeProductLine(input.line) ||
    Boolean(cakeServingSizeForText(description));
  if (!isSmallSquarePhotoProduct && !isRoundProduct) return;

  const shape: MarzipanPrintShape = isSmallSquarePhotoProduct
    ? "square"
    : "round";
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
        isPetitGateauLine(line) ||
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

function marzipanPhotoPrintKeyFor(input: {
  imageId: string;
  planIndex: number;
  copyNumber: number;
  version?: string;
}) {
  return [
    ...(input.version ? [input.version] : []),
    input.imageId,
    input.planIndex,
    input.copyNumber,
  ].join(":");
}

function marzipanPhotoPrintVersionForImage(image: WebshopImageSummary) {
  if (image.deliveryDate === specialProCollegeDeliveryDate) {
    return "print-reset-2026-10-05-v4";
  }

  return "";
}

const specialProCollegeLogoReserveCopies = 10;

function isProCollegeLogoPrintItem(item: MarzipanPrintItem) {
  return (
    item.shape === "square" &&
    normalizeMatchText(item.customerName).includes("pro college")
  );
}

function isSpecialProCollegeLogoPrintItem(item: MarzipanPrintItem) {
  return (
    isProCollegeLogoPrintItem(item) &&
    item.printKey.startsWith("print-reset-2026-10-05-v4:")
  );
}

function addSpecialProCollegeLogoReserveCopies(items: MarzipanPrintItem[]) {
  const proCollegeItems = items.filter(isSpecialProCollegeLogoPrintItem);
  const template = proCollegeItems[0];
  if (!template) return;

  const copyTotal =
    proCollegeItems.length + specialProCollegeLogoReserveCopies;
  proCollegeItems.forEach((item) => {
    item.copyTotal = copyTotal;
  });

  for (
    let reserveCopy = 1;
    reserveCopy <= specialProCollegeLogoReserveCopies;
    reserveCopy += 1
  ) {
    const copyNumber = proCollegeItems.length + reserveCopy;
    items.push({
      ...template,
      id: `${template.id}-reserve-${reserveCopy}`,
      copyNumber,
      copyTotal,
      printKey: `${template.printKey}:reserve-v1:${reserveCopy}`,
    });
  }
}

function imageImportedAtForPrint(image: WebshopImageSummary) {
  return image.importedAt || image.receivedAt || "";
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
  const imageImportedAt = imageImportedAtForPrint(input.image);

  for (let copy = 1; copy <= copyTotal; copy += 1) {
    const printKey = marzipanPhotoPrintKeyFor({
      imageId: input.image.id,
      planIndex: input.planIndex,
      copyNumber: copy,
      version: marzipanPhotoPrintVersionForImage(input.image),
    });

    input.items.push({
      id: [
        receiptNumber || "zonder-bon",
        input.image.id,
        input.planIndex,
        copy,
      ].join("-"),
      imageId: input.image.id,
      imageImportedAt,
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
      printKey,
    });
  }
}

function addMarzipanPrintItemsForReceipt(input: {
  items: MarzipanPrintItem[];
  receipt: ReceiptSummary;
  images: WebshopImageSummary[];
  inferredMatch?: boolean;
}) {
  const strictProductPlans = photoProductPlansForReceipt(input.receipt, {
    requirePhotoSignal: true,
  });
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

function douglasDefaultLogoForReceipt(
  receipt: ReceiptSummary
): WebshopImageSummary | null {
  const text = normalizeMatchText(receiptSearchText(receipt));
  const isDouglas = /\b60716\b/.test(text) || /\bparfumerie\s+douglas\b/.test(text);
  const hasLogoCake =
    /marsepein\s*-?\s*taart/.test(text) &&
    /foto|photo|afbeeld|print|logo|plaatje|opdruk/.test(text);

  if (!isDouglas || !hasLogoCake) return null;

  return {
    id: `vaste-klantfoto-douglas-60716-${receipt.id}`,
    messageId: "vaste-klantfoto:douglas-60716",
    orderNumber: receipt.receiptNumber,
    deliveryDate: "",
    customerName: receipt.customer || "Parfumerie Douglas",
    photoUrl: "/klantlogos/douglas-60716.jpg",
    sourceUrl: "",
    fileName: "douglas-60716.jpg",
    productSummary: "Vaste afbeelding voor marsepeintaart met logo",
    matchedReceiptId: receipt.id,
    matchedReceiptNumber: receipt.receiptNumber,
    matchedReceiptCustomer: receipt.customer,
    matchedAt: "vast klantprofiel",
    matchSource: "auto",
    subject: "Vaste klantafbeelding Parfumerie Douglas",
    from: "",
    receivedAt: "",
    importedAt: "",
    confidence: "hoog",
    notes: ["Vaste klantafbeelding voor debiteur 60716."],
  };
}

function buildMarzipanPrintItems(
  receipts: ReceiptSummary[],
  webshopImages: WebshopImageSummary[]
) {
  const items: MarzipanPrintItem[] = [];
  const claimedImageIds = new Set<string>();

  receipts.forEach((receipt) => {
    let matchedImages = imageMatchesForReceipt(receipt, webshopImages).filter(
      (image) => !claimedImageIds.has(image.id)
    );
    const douglasDefaultLogo = douglasDefaultLogoForReceipt(receipt);
    const manuallyMatchedImages = matchedImages.filter(
      (image) => image.matchSource === "manual"
    );
    if (douglasDefaultLogo && manuallyMatchedImages.length === 0) {
      matchedImages = [douglasDefaultLogo];
    }
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

  addSpecialProCollegeLogoReserveCopies(items);

  return items;
}

function buildMarzipanPhotoPrintGroups(
  items: MarzipanPrintItem[],
  printedKeys: Set<string>
): MarzipanPhotoPrintGroup[] {
  const groups = new Map<
    string,
    MarzipanPhotoPrintGroup & {
      productSet: Set<string>;
      receiptNumberSet: Set<string>;
    }
  >();

  items.forEach((item) => {
    let group = groups.get(item.imageId);
    if (!group) {
      group = {
        customerName: item.customerName || "Klant controleren",
        imageId: item.imageId,
        itemCount: 0,
        newItemCount: 0,
        photoUrl: item.photoUrl,
        products: [],
        productSet: new Set<string>(),
        receiptNumbers: [],
        receiptNumberSet: new Set<string>(),
      };
      groups.set(item.imageId, group);
    }

    group.itemCount += 1;
    if (!printedKeys.has(item.printKey)) group.newItemCount += 1;
    if (item.product) group.productSet.add(item.product);
    if (item.receiptNumber) group.receiptNumberSet.add(item.receiptNumber);
  });

  return Array.from(groups.values())
    .map(({ productSet, receiptNumberSet, ...group }) => ({
      ...group,
      products: Array.from(productSet),
      receiptNumbers: Array.from(receiptNumberSet),
    }))
    .sort((left, right) =>
      left.customerName.localeCompare(right.customerName, "nl")
    );
}

function readMarzipanPhotoPrintHistory() {
  try {
    const raw = window.localStorage.getItem(
      MARZIPAN_PHOTO_PRINT_HISTORY_STORAGE_KEY
    );
    if (!raw) return {};

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }

    return Object.fromEntries(
      Object.entries(parsed).flatMap(([date, value]) => {
        if (!value || typeof value !== "object" || Array.isArray(value)) {
          return [];
        }

        const history = value as Partial<MarzipanPhotoPrintHistory>;
        const printedKeys = Array.isArray(history.printedKeys)
          ? history.printedKeys.filter(
              (key): key is string => typeof key === "string" && key.length > 0
            )
          : [];

        return [
          [
            date,
            {
              printedAt:
                typeof history.printedAt === "string" ? history.printedAt : "",
              printedKeys,
            },
          ],
        ];
      })
    ) as Record<string, MarzipanPhotoPrintHistory>;
  } catch {
    return {};
  }
}

function writeMarzipanPhotoPrintHistory(
  history: Record<string, MarzipanPhotoPrintHistory>
) {
  try {
    window.localStorage.setItem(
      MARZIPAN_PHOTO_PRINT_HISTORY_STORAGE_KEY,
      JSON.stringify(history)
    );
  } catch {
    // Niet kritisch: printen moet blijven werken, ook zonder opslag.
  }
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

function isGasterijDeArendReceipt(receipt: ReceiptSummary) {
  const text = normalizeMatchText(
    [
      receipt.receiptNumber,
      receipt.customer,
      receipt.address,
      receipt.deliveryAddress,
      receipt.alternativeAddress || "",
    ].join(" ")
  );

  return /\b61771\b/.test(text) || /\bgasterij de arend\b/.test(text);
}

function isArendMarzipanLogoLine(line: ReceiptLine) {
  return hasArendMarzipanLogoSignal(
    [line.description, line.note || ""].filter(Boolean).join(" ")
  );
}

function arendNumberFromText(value: string) {
  const text = normalizeMatchText(value);
  const explicit = text.match(/\bcijfer\s+(\d{1,3})\b/);
  if (explicit) return explicit[1];

  const loose = text.match(/\b(?:nummer|getal)\s+(\d{1,3})\b/);
  if (loose) return loose[1];

  return "";
}

function arendMarzipanSheetQuantityFor(
  line: ReceiptLine,
  receipt: ReceiptSummary
) {
  const parsedQuantity = Math.max(1, Math.round(numericQuantity(line.quantity) || 1));
  const sources = [
    line.description,
    line.note || "",
    receipt.note,
    receipt.customerNote,
    receipt.internalNote,
  ];
  const recoveredQuantity = sources
    .map((source) =>
      source.match(/(?:^|\s)(\d{1,3})\s+logo\s+op\s+marsepein\b/i)
    )
    .map((match) => Number(match?.[1] || 0))
    .find((quantity) => Number.isFinite(quantity) && quantity > 0);

  return Math.max(parsedQuantity, recoveredQuantity || 0);
}

function arendMarzipanSheetQuantityFromSource(value: string) {
  const match = value.match(/(?:^|\s)(\d{1,3})\s+logo\s+op\s+marsepein\b/i);
  const quantity = Number(match?.[1] || 0);

  return Number.isFinite(quantity) && quantity > 0 ? quantity : 1;
}

function arendFallbackNumberPrintOrder(
  receipt: ReceiptSummary,
  receiptNumber: string
): ArendNumberPrintOrder | null {
  const source = [receipt.note, receipt.customerNote, receipt.internalNote]
    .filter(Boolean)
    .find((value) => hasArendMarzipanLogoSignal(value));
  if (!source) return null;

  const sheetQuantity = arendMarzipanSheetQuantityFromSource(source);

  return {
    id: `${receipt.id || receiptNumber || "arend"}-note`,
    receiptNumber,
    customerName: receipt.customer || "Gasterij de Arend",
    lineDescription: "Logo op Marsepein",
    sheetQuantity,
    defaultSquareCount: sheetQuantity * 50,
    inferredNumber: arendNumberFromText(source),
  };
}

function buildArendNumberPrintOrders(receipts: ReceiptSummary[]) {
  const orders: ArendNumberPrintOrder[] = [];

  receipts.forEach((receipt) => {
    if (!isGasterijDeArendReceipt(receipt)) return;

    const receiptNumber = receipt.receiptNumber || receipt.id || "";
    const receiptOrders: ArendNumberPrintOrder[] = [];

    receipt.lines
      .map(normalizeKnownReceiptLine)
      .filter((line) => !shouldDropReceiptLine(line))
      .forEach((line, lineIndex) => {
        if (!isArendMarzipanLogoLine(line)) return;

        const sheetQuantity = arendMarzipanSheetQuantityFor(line, receipt);
        receiptOrders.push({
          id: `${receipt.id || receiptNumber || "arend"}-${lineIndex}`,
          receiptNumber,
          customerName: receipt.customer || "Gasterij de Arend",
          lineDescription: cleanProductLabel(line.description),
          sheetQuantity,
          defaultSquareCount: sheetQuantity * 50,
          inferredNumber: arendNumberFromText(
            [line.description, line.note || "", receipt.note, receipt.customerNote]
              .filter(Boolean)
              .join(" ")
          ),
        });
      });

    if (receiptOrders.length === 0) {
      const fallbackOrder = arendFallbackNumberPrintOrder(receipt, receiptNumber);
      if (fallbackOrder) receiptOrders.push(fallbackOrder);
    }

    orders.push(...receiptOrders);
  });

  return orders;
}

function normalizeArendNumber(value: string) {
  const clean = value.replace(/[^\d]/g, "").slice(0, 3);
  if (!clean) return "";

  return String(Math.min(100, Number(clean)));
}

function arendPrintNumberFor(value: string) {
  return normalizeArendNumber(value).replace(/0/g, "O");
}

function summarizeArendNumbers(numbers: string[]) {
  const countByNumber = new Map<string, number>();
  const order: string[] = [];

  numbers.forEach((number) => {
    if (!countByNumber.has(number)) order.push(number);
    countByNumber.set(number, (countByNumber.get(number) || 0) + 1);
  });

  return order.map((number) => ({
    count: countByNumber.get(number) || 0,
    displayNumber: arendPrintNumberFor(number),
    number,
  }));
}

function arendOrderedSquareCountFor(orders: ArendNumberPrintOrder[]) {
  const sheetCount = orders.reduce((sum, order) => sum + order.sheetQuantity, 0);

  return Math.max(
    AREND_ORDERED_SQUARES_PER_SHEET,
    sheetCount * AREND_ORDERED_SQUARES_PER_SHEET
  );
}

function arendPrintCapacityFor(orders: ArendNumberPrintOrder[]) {
  const sheetCount = orders.reduce((sum, order) => sum + order.sheetQuantity, 0);

  return Math.max(
    AREND_PRINT_SQUARES_PER_SHEET,
    sheetCount * AREND_PRINT_SQUARES_PER_SHEET
  );
}

function parseArendNumberPrintItems(
  input: string,
  orders: ArendNumberPrintOrder[]
): ArendNumberPrintParseResult {
  const sourceLabel =
    orders
      .map((order) =>
        [order.receiptNumber ? `bon ${order.receiptNumber}` : "", order.customerName]
          .filter(Boolean)
          .join(" · ")
      )
      .filter(Boolean)
      .join(" | ") || "Gasterij de Arend";
  const orderedCount = arendOrderedSquareCountFor(orders);
  const printCapacity = arendPrintCapacityFor(orders);
  const chunks = input
    .split(/(?:[,\n;]+|\s+en\s+)/i)
    .map((chunk) => chunk.trim())
    .filter(Boolean);
  const parsed: { count: number; number: string }[] = [];

  if (chunks.length === 0) {
    return {
      error: "Geen cijfers ingevuld. Gebruik bijvoorbeeld 40x20, 10x50.",
      items: [],
      orderedCount,
      printBreakdown: [],
      printCapacity,
      requestedCount: 0,
      requestedBreakdown: [],
      reserveCount: 0,
    };
  }

  chunks.forEach((chunk) => {
    const repeated = chunk.match(/^(\d{1,3})\s*(?:x|×|\*)\s*(\d{1,3})$/i);
    if (repeated) {
      const count = Math.max(1, Number(repeated[1]));
      const number = normalizeArendNumber(repeated[2]);
      if (number) parsed.push({ count, number });
      return;
    }

    const number = normalizeArendNumber(chunk);
    if (number) {
      parsed.push({
        count: chunks.length === 1 ? orderedCount : 1,
        number,
      });
    }
  });

  const requestedNumbers = parsed.flatMap((entry) =>
    Array.from({ length: entry.count }, () => entry.number)
  );
  const requestedCount = requestedNumbers.length;

  if (requestedCount === 0) {
    return {
      error: "Geen geldige cijfers gevonden. Gebruik bijvoorbeeld 40x20, 10x50.",
      items: [],
      orderedCount,
      printBreakdown: [],
      printCapacity,
      requestedCount,
      requestedBreakdown: [],
      reserveCount: 0,
    };
  }

  if (requestedCount > orderedCount) {
    return {
      error: `Let op, meer dan ${orderedCount}: je hebt ${requestedCount} vakjes ingevuld. Links van de x is het aantal, rechts is het cijfer. Voorbeeld: 10x8 = 10 vakjes met cijfer 8.`,
      items: [],
      orderedCount,
      printBreakdown: [],
      printCapacity,
      requestedCount,
      requestedBreakdown: summarizeArendNumbers(requestedNumbers),
      reserveCount: 0,
    };
  }

  const fallbackNumbers =
    requestedNumbers.length > 0
      ? requestedNumbers
      : orders
          .flatMap((order) =>
            Array.from({ length: order.defaultSquareCount }, () => order.inferredNumber)
          )
          .filter(Boolean);
  const reserveNumbers =
    fallbackNumbers.length > 0
      ? Array.from(
          { length: printCapacity - requestedCount },
          (_, index) => fallbackNumbers[index % fallbackNumbers.length]
        )
      : [];
  const numbers = [...requestedNumbers, ...reserveNumbers];

  return {
    items: numbers.slice(0, printCapacity).map((number, index) => ({
      id: `arend-${index}-${number}`,
      number,
      displayNumber: arendPrintNumberFor(number),
      copyNumber: index + 1,
      sourceLabel,
    })),
    orderedCount,
    printBreakdown: summarizeArendNumbers(numbers.slice(0, printCapacity)),
    printCapacity,
    requestedCount,
    requestedBreakdown: summarizeArendNumbers(requestedNumbers),
    reserveCount: Math.max(0, printCapacity - requestedCount),
  };
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
  if (item.photoUrl.includes("douglas-60716")) {
    return `${formatPrintCm(printSizeCm)} cm rechthoekig`;
  }

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
    const preserveRectangle = item.photoUrl.includes("douglas-60716");
    const proCollegeLogo = isProCollegeLogoPrintItem(item);

    return `
      <article class="print-item ${item.shape} ${preserveRectangle ? "keep-rectangular" : ""} ${proCollegeLogo ? "pro-college-logo" : ""} ${includeLabel ? "" : "no-label"} ${item.needsCheck ? "needs-check" : ""}" style="--item-size:${printSizeCm}cm;${layoutStyle}">
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
      const proCollegeLogoGroup = isProCollegeLogoPrintItem(group.labelItem);
      const includesProCollegeReserve = group.items.some(
        isSpecialProCollegeLogoPrintItem
      );
      return `
        <section class="square-group ${proCollegeLogoGroup ? "rectangular-logo-group" : ""}">
          <div class="square-group-label">
            <strong>${escapeHtml(group.labelItem.customerLastName)}</strong>
            ${
              includesProCollegeReserve
                ? `<span>${group.items.length} stuks · inclusief ${specialProCollegeLogoReserveCopies} reserve</span>`
                : ""
            }
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
      ? `<section class="round-grid ${diagonalRoundLayout?.className || ""} ${diagonalRoundLayout && squareGroups.length > 0 ? "new-print-page" : ""}" style="${diagonalRoundLayout?.sectionStyle || ""}">
          ${roundItems.map((item) => printItemHtmlFor(item, true)).join("")}
        </section>`
      : "";
  const itemHtml = `${squareHtml}${roundHtml}`;
  const printSizeSummary = [
    input.items.some(isProCollegeLogoPrintItem)
      ? "Pro College-logo max. 3,5 cm breed"
      : "",
    input.items.some(
      (item) => item.shape === "square" && !isProCollegeLogoPrintItem(item)
    )
      ? "petit four/gateau ca. 3,8 cm"
      : "",
    roundItems.length > 0 ? "taart 6-12 cm rond" : "",
  ]
    .filter(Boolean)
    .join(" · ");

  return `<!doctype html>
<html lang="nl">
  <head>
    <meta charset="utf-8">
    <title>${escapeHtml(title)}</title>
    <style>
      @page { margin: 3mm 3mm 60mm; size: A4 portrait; }
      @page:first { margin-top: 8mm; }
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
        align-items: center;
        display: flex;
        gap: 8px;
      }
      .print-registration-note {
        color: #666;
        font-size: 10px;
        font-weight: 700;
        max-width: 230px;
        text-align: right;
      }
      .print-registration-note.confirmed {
        color: #2d6b43;
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
      .rectangular-logo-group .square-grid {
        grid-template-columns: repeat(5, 35mm);
        width: 175mm;
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
        break-inside: avoid-page;
        display: block;
        page-break-inside: avoid;
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
        background: #fff;
        border: 0;
        box-shadow:
          inset -0.25mm 0 0 #ddd,
          inset 0 -0.25mm 0 #ddd;
        height: var(--petit-four-size);
        padding: 0;
        width: var(--petit-four-size);
      }
      .rectangular-logo-group .square,
      .rectangular-logo-group .square .photo-frame {
        height: 14mm;
        width: 35mm;
      }
      .rectangular-logo-group .square .photo-frame img {
        object-fit: contain;
      }
      .round .photo-frame {
        border-radius: 999px;
      }
      .round.keep-rectangular .photo-frame {
        border-radius: 0;
      }
      .round.keep-rectangular .photo-frame img {
        object-fit: contain;
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
        .sheet-header {
          display: none;
        }
        .round-grid {
          margin-top: 1mm;
          row-gap: 1mm;
        }
        .round-grid.diagonal {
          break-inside: avoid-page !important;
          page-break-inside: avoid !important;
        }
        .round-grid.diagonal.new-print-page {
          break-before: page !important;
          page-break-before: always !important;
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
        .rectangular-logo-group .square-grid {
          grid-template-columns: repeat(5, 35mm) !important;
          width: 175mm !important;
        }
        .rectangular-logo-group .square,
        .rectangular-logo-group .square .photo-frame {
          height: 14mm !important;
          width: 35mm !important;
        }
      }
    </style>
    <script>
      function printAndConfirmMarzipanSheet() {
        window.print();
        window.setTimeout(function () {
          var didPrint = window.confirm(
            "Is de afdruk daadwerkelijk gelukt?\\n\\nKlik OK om deze foto’s als geprint te registreren.\\nKlik Annuleren als je alleen hebt gekeken of niet hebt afgedrukt."
          );
          var status = document.getElementById("print-registration-note");

          if (!didPrint) {
            if (status) {
              status.textContent = "Niet geregistreerd · je kunt later opnieuw printen";
              status.classList.remove("confirmed");
            }
            return;
          }

          if (typeof window.confirmMarzipanPrint !== "function") {
            if (status) {
              status.textContent = "Afdruk niet geregistreerd · open de dagstart opnieuw";
              status.classList.remove("confirmed");
            }
            return;
          }

          window.confirmMarzipanPrint();
          if (status) {
            status.textContent = "Geregistreerd als geprint";
            status.classList.add("confirmed");
          }
        }, 100);
      }
    </script>
  </head>
  <body>
    <div class="screen-actions">
      <h1>${escapeHtml(title)} · ${input.items.length} printstukken</h1>
      <div class="action-buttons">
        <span id="print-registration-note" class="print-registration-note">Bekijken telt niet als print</span>
        <button type="button" class="secondary" onclick="if (window.opener) window.close(); else window.history.back();">Terug</button>
        <button type="button" onclick="printAndConfirmMarzipanSheet()">Afdrukken</button>
      </div>
    </div>
    <main>
      <div class="sheet-header">
        <h1>${escapeHtml(title)}</h1>
        <p>${input.items.length} printstukken${printSizeSummary ? ` · ${printSizeSummary}` : ""}</p>
      </div>
      <section class="sheet">
        ${itemHtml}
      </section>
    </main>
  </body>
</html>`;
}

function openMarzipanPhotoSheet(
  plan: DayPlan,
  items: MarzipanPrintItem[],
  onPrinted?: (items: MarzipanPrintItem[]) => void
) {
  if (items.length === 0) {
    window.alert("Geen webshopfoto's gevonden voor deze dag.");
    return;
  }

  const printWindow = window.open("", "_blank", "width=1100,height=800");
  if (!printWindow) {
    window.alert(
      "Controlevenster kon niet geopend worden. Sta pop-ups voor deze app toe."
    );
    return;
  }

  printWindow.document.open();
  printWindow.document.write(createMarzipanPhotoPrintHtml({ items, plan }));
  printWindow.document.close();
  const trackedPrintWindow = printWindow as Window & {
    confirmMarzipanPrint?: () => void;
  };
  trackedPrintWindow.confirmMarzipanPrint = () => onPrinted?.(items);
  printWindow.focus();
}

function arendPromptDefaultFor(orders: ArendNumberPrintOrder[]) {
  const inferred = orders.find((order) => order.inferredNumber)?.inferredNumber || "";
  const total = arendOrderedSquareCountFor(orders);

  return inferred && total > 0 ? `${total}x${inferred}` : "";
}

function arendPromptLabelFor(orders: ArendNumberPrintOrder[]) {
  const orderLabel = orders
    .map((order) => `${order.sheetQuantity} sheet(s) = ${order.defaultSquareCount} vakjes`)
    .join(", ");

  return [
    "Welke cijfers moeten op de Arend-marsepeinsheet?",
    "Vul in als: aantal x cijfer.",
    "Voorbeeld: 10x8 = 10 vakjes met cijfer 8.",
    "Combineren kan zo: 40x10, 10x8.",
    orderLabel ? `Bon: ${orderLabel}.` : "",
    "Het totaal links van de x mag maximaal 50 per sheet zijn; de print maakt automatisch 4 reservevakjes.",
  ]
    .filter(Boolean)
    .join("\n");
}

function openArendPrintPreview(session: ArendPrintSession) {
  try {
    window.sessionStorage.setItem(
      AREND_PRINT_SESSION_KEY,
      JSON.stringify(session)
    );
  } catch (error) {
    console.error(error);
    window.alert("Arend-printdata kon niet klaargezet worden.");
    return;
  }

  window.location.assign("/bakkerij/logistiek/arend-print");
}

function openArendNumberSheet(plan: DayPlan, orders: ArendNumberPrintOrder[]) {
  if (orders.length === 0) {
    window.alert("Geen Arend-cijferprint gevonden voor deze dag.");
    return;
  }

  const answer = window.prompt(
    arendPromptLabelFor(orders),
    arendPromptDefaultFor(orders)
  );
  if (answer === null) {
    return;
  }

  const result = parseArendNumberPrintItems(answer, orders);
  if (result.error || result.items.length === 0) {
    window.alert(result.error || "Geen cijfers ingevuld. Gebruik bijvoorbeeld 40x20, 10x50.");
    return;
  }

  openArendPrintPreview({
    createdAt: new Date().toISOString(),
    date: plan.date,
    items: result.items.map((item) => ({
      displayNumber: item.displayNumber,
      id: item.id,
      number: item.number,
      sourceLabel: item.sourceLabel,
    })),
    orderedCount: result.orderedCount,
    printBreakdown: result.printBreakdown,
    requestedCount: result.requestedCount,
    requestedBreakdown: result.requestedBreakdown,
    reserveCount: result.reserveCount,
    title: `Arend cijfers ${formatDateLabel(plan.date)}`,
  });
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

function receiptLineArticleParts(
  line: ReceiptLine,
  rules: PreparationRule[]
) {
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
  const compactRule =
    articleNumber && !subcode
      ? rules.find(
          (rule) =>
            rule.articleNumber &&
            rule.subcode &&
            articleNumber ===
              normalizePreparationCode(`${rule.articleNumber}${rule.subcode}`)
        )
      : null;

  if (compactRule?.articleNumber && compactRule.subcode) {
    return {
      articleNumber: normalizePreparationCode(compactRule.articleNumber),
      subcode: normalizePreparationCode(compactRule.subcode),
    };
  }

  return { articleNumber, subcode };
}

function preparationLineText(line: ReceiptLine) {
  return normalizeMatchText(
    [line.articleNumber || "", line.description, line.note || ""]
      .filter(Boolean)
      .join(" ")
  );
}

function preparationRuleMatchesText(rule: PreparationRule, line: ReceiptLine) {
  if (!rule.textPatterns?.length) return false;

  const text = preparationLineText(line);

  return rule.textPatterns.some((pattern) => pattern.test(text));
}

function preparationRuleMatchesLine(
  rule: PreparationRule,
  line: ReceiptLine,
  rules: PreparationRule[]
) {
  const { articleNumber, subcode } = receiptLineArticleParts(line, rules);
  const catalogArticle = normalizePreparationCode(line.catalogArticleNumber || "");
  const ruleArticle = normalizePreparationCode(rule.articleNumber || "");
  const ruleSubcode = normalizePreparationCode(rule.subcode || "");
  const textMatched = preparationRuleMatchesText(rule, line);

  if (ruleArticle && ruleSubcode) {
    return (
      (articleNumber === ruleArticle && subcode === ruleSubcode) ||
      (catalogArticle === ruleArticle && subcode === ruleSubcode) ||
      articleNumber === `${ruleArticle}${ruleSubcode}` ||
      textMatched
    );
  }
  if (ruleArticle) return articleNumber === ruleArticle || catalogArticle === ruleArticle || textMatched;
  if (ruleSubcode) return subcode === ruleSubcode || textMatched;

  return textMatched;
}

function preparationItemKeyFor(
  rule: PreparationRule,
  line: ReceiptLine,
  rules: PreparationRule[]
) {
  const { articleNumber, subcode } = receiptLineArticleParts(line, rules);
  const description = cleanProductLabel(cleanReceiptLineDescription(line.description));
  const productKey =
    rule.articleNumber
      ? rule.code
      : rule.subcode && !rule.articleNumber
        ? `${articleNumber}|${subcode}|${normalizeMatchText(description)}`
        : `${rule.code}|${normalizeMatchText(description)}`;

  return `${rule.category}|${rule.code}|${productKey}`;
}

function buildPreparationItems(
  receipts: ReceiptSummary[],
  category: PreparationCategory,
  products: PreparationProductSummary[]
) {
  const rules = preparationRulesFor(category, products);
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
        if (!preparationRuleMatchesLine(rule, line, rules)) return;

        const key = preparationItemKeyFor(rule, line, rules);
        const { articleNumber, subcode } = receiptLineArticleParts(line, rules);
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
          articleNumber: line.catalogArticleNumber || articleNumber,
          subcode,
          description:
            rule.articleNumber
              ? rule.label
              : cleanProductLabel(cleanReceiptLineDescription(line.description)) ||
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
  category: PreparationCategory,
  products: PreparationProductSummary[]
) {
  const items = buildPreparationItems(receipts, category, products);
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
  const title = `${routeGroupDisplayTitle(input.routeGroup.vehicle)} · ${formatDateLabel(
    input.plan.date
  )}`;
  const printPages = printableRoutes.reduce<RouteRound[][]>((pages, route) => {
    const currentPage = pages.at(-1);
    const routePrintUnits = (routes: RouteRound[]) =>
      routes.reduce(
        (total, pageRoute) => total + pageRoute.stops.length + 2,
        0
      );

    // A full round always stays together. Two rounds only share one side when
    // all stops plus both round headings fit comfortably on that A4.
    if (
      currentPage &&
      currentPage.length < 2 &&
      routePrintUnits([...currentPage, route]) <= 17
    ) {
      currentPage.push(route);
    } else {
      pages.push([route]);
    }

    return pages;
  }, []);
  const routesHtml = printPages
    .map((pageRoutes, pageIndex) => {
      const nextPage = printPages[pageIndex + 1];
      const routeSectionsHtml = pageRoutes
        .map((route) => {
          const rowsHtml = route.stops
            .map((stop, index) => {
              const detailParts = routePrintTimeParts(stop);
              const timeBadge = routePrintTimeBadgeHtml(stop);

              return `
                <article class="stop-card">
                  <div class="stop-number">${index + 1}</div>
                  <div class="stop-content">
                    <div class="stop-heading">
                      <strong>${escapeHtml(stop.label)}</strong>
                      ${timeBadge}
                    </div>
                    <p>${escapeHtml(detailParts.detail || "Adres controleren")}</p>
                    <div class="write-fields">
                      <span><b>Aankomst</b></span>
                      <span class="note-line"><b>Opmerking</b></span>
                    </div>
                  </div>
                  <div class="stop-check"><span></span><small>GEREED</small></div>
                </article>
              `;
            })
            .join("");

          return `
            <section class="route-block">
              <div class="route-title">
                <div>
                  <h2>${escapeHtml(route.title)}</h2>
                  <p>${escapeHtml(route.departure)} · ${escapeHtml(route.badge)} · ${route.stops.length} stops</p>
                </div>
                <strong>${escapeHtml(route.load)}</strong>
              </div>
              <div class="depot-line">
                <b>START EN EINDE</b> · ${escapeHtml(routeDepot.address)}
              </div>
              <div class="stops">${rowsHtml}</div>
            </section>
          `;
        })
        .join("");

      return `
        <section class="route-page" data-route-count="${pageRoutes.length}">
          <header class="sheet-header">
            <div class="bus-heading">
              <span class="bus-letter">${escapeHtml(
                busIdFromVehicleName(input.routeGroup.vehicle) ||
                  (input.routeGroup.vehicle === specialSchoolDeliveryVehicle
                    ? "S"
                    : "•")
              )}</span>
              <div>
                <h1>${escapeHtml(routeGroupDisplayTitle(input.routeGroup.vehicle))}</h1>
                <p>${escapeHtml(formatDateLabel(input.plan.date))} · ${stopCount} stops totaal</p>
              </div>
            </div>
            <div class="driver-fields">
              <span>Chauffeur</span>
              <span>Vertrek</span>
              <span>Terug</span>
            </div>
          </header>

          <div class="route-sections">${routeSectionsHtml}</div>

          <section class="general-notes">
            <h2>Algemene opmerkingen</h2>
            <div></div>
            <div></div>
          </section>

          <footer class="page-footer">
            <span>Pagina ${pageIndex + 1} van ${printPages.length}</span>
            ${
              nextPage
                ? `<strong>Z.O.Z. — ${escapeHtml(nextPage[0]?.title || "VOLGENDE RONDE")}</strong>`
                : `<strong class="route-end">EINDE ROUTE</strong>`
            }
          </footer>
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
        background: #e9e9e9;
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
      .route-page {
        background: #fff;
        display: flex;
        flex-direction: column;
        margin: 0 auto;
        min-height: 280mm;
        padding: 7mm;
        width: 210mm;
      }
      .route-page + .route-page {
        margin-top: 8mm;
      }
      .sheet-header {
        align-items: center;
        border-bottom: 3px solid #111;
        display: flex;
        justify-content: space-between;
        margin-bottom: 2mm;
        padding-bottom: 2mm;
      }
      .bus-heading {
        align-items: center;
        display: flex;
        gap: 3mm;
      }
      .bus-letter {
        align-items: center;
        border: 2px solid #111;
        border-radius: 50%;
        display: flex;
        font-size: 17px;
        font-weight: 900;
        height: 9mm;
        justify-content: center;
        width: 9mm;
      }
      .sheet-header h1 {
        font-size: 20px;
        line-height: 1;
        margin: 0;
      }
      .sheet-header p {
        font-size: 11px;
        font-weight: 700;
        margin: 0.8mm 0 0;
      }
      .driver-fields {
        display: grid;
        gap: 1.2mm;
        min-width: 55mm;
      }
      .driver-fields span {
        border-bottom: 1px solid #111;
        display: block;
        font-size: 10px;
        font-weight: 700;
        height: 4.5mm;
        padding-top: 0.6mm;
      }
      .route-sections {
        display: grid;
        gap: 2mm;
      }
      .route-block {
        break-inside: avoid;
        page-break-inside: avoid;
      }
      .route-title {
        align-items: center;
        background: #e8e8e8;
        border: 2px solid #111;
        border-radius: 3mm 3mm 0 0;
        display: flex;
        justify-content: space-between;
        padding: 1.5mm 2.5mm;
      }
      .route-title h2 {
        font-size: 16px;
        line-height: 1;
        margin: 0;
      }
      .route-title p,
      .route-title strong {
        font-size: 11px;
        margin: 0.6mm 0 0;
      }
      .route-title > strong {
        margin: 0;
        max-width: 48%;
        text-align: right;
      }
      .depot-line {
        border: 2px solid #111;
        border-top: 0;
        font-size: 10px;
        padding: 1.1mm 2.5mm;
      }
      .stops {
        display: grid;
        gap: 1mm;
        margin-top: 1.4mm;
      }
      .stop-card {
        align-items: stretch;
        border: 1.5px solid #111;
        border-left-width: 4px;
        border-radius: 2.5mm;
        display: grid;
        grid-template-columns: 10mm minmax(0, 1fr) 17mm;
        min-height: 12.5mm;
        overflow: hidden;
        page-break-inside: avoid;
      }
      .stop-number {
        align-items: center;
        border-right: 1px solid #aaa;
        display: flex;
        font-size: 15px;
        font-weight: 900;
        justify-content: center;
      }
      .stop-content {
        min-width: 0;
        padding: 1.1mm 2mm 0.8mm;
      }
      .stop-heading {
        align-items: flex-start;
        display: flex;
        gap: 2mm;
        justify-content: space-between;
      }
      .stop-heading strong {
        font-size: 14.5px;
        line-height: 1.05;
      }
      .stop-content p {
        font-size: 11.5px;
        font-weight: 700;
        line-height: 1.2;
        margin: 0.4mm 0 0;
      }
      .time-badge {
        background: #111;
        border: 2px solid #111;
        border-radius: 2mm;
        color: #fff;
        flex: none;
        font-size: 12px;
        font-weight: 900;
        line-height: 1;
        padding: 0.9mm 1.5mm;
        white-space: nowrap;
      }
      .time-badge.urgent {
        background: #fff;
        border: 3px double #111;
        color: #111;
      }
      .write-fields {
        display: grid;
        font-size: 9px;
        gap: 3mm;
        grid-template-columns: 35mm minmax(0, 1fr);
        margin-top: 0.8mm;
      }
      .write-fields span {
        border-bottom: 1px solid #777;
        min-height: 2.7mm;
      }
      .write-fields b {
        background: #fff;
        padding-right: 1.5mm;
      }
      .stop-check {
        align-items: center;
        border-left: 1px solid #aaa;
        display: flex;
        flex-direction: column;
        gap: 1mm;
        justify-content: center;
      }
      .stop-check span {
        border: 2px solid #111;
        height: 7mm;
        width: 7mm;
      }
      .stop-check small {
        font-size: 7px;
        font-weight: 900;
      }
      .general-notes {
        border: 1.5px solid #111;
        border-radius: 2.5mm;
        margin-top: 1.8mm;
        padding: 1.2mm 2.5mm;
      }
      .general-notes h2 {
        font-size: 11px;
        margin: 0 0 0.5mm;
      }
      .general-notes div {
        border-bottom: 1px solid #888;
        height: 3.5mm;
      }
      .page-footer {
        align-items: flex-end;
        border-top: 3px solid #111;
        display: flex;
        justify-content: space-between;
        margin-top: auto;
        padding-top: 1.5mm;
      }
      .page-footer span {
        font-size: 11px;
        font-weight: 800;
      }
      .page-footer strong {
        font-size: 20px;
        font-weight: 900;
        letter-spacing: 0.04em;
      }
      .page-footer .route-end {
        font-size: 13px;
      }
      @media print {
        body { background: #fff; }
        .screen-actions { display: none; }
        .route-page {
          break-inside: avoid;
          break-after: page;
          display: block;
          height: auto;
          margin: 0;
          min-height: 0;
          page-break-after: always;
          page-break-inside: avoid;
          padding: 0;
          width: auto;
        }
        .page-footer {
          margin-top: 3mm;
        }
        .route-page:last-child {
          break-after: auto;
          page-break-after: auto;
        }
        .route-page + .route-page {
          margin-top: 0;
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
    ${routesHtml}
  </body>
</html>`;
}

function openBusRouteSheet(plan: DayPlan, routeGroup: RouteGroup) {
  if (!routeGroup.routes.some((route) => route.stops.length > 0)) {
    window.alert("Geen routes gevonden voor deze bus.");
    return;
  }

  const printHtml = createBusRoutePrintHtml({ plan, routeGroup });
  const printUrl = URL.createObjectURL(
    new Blob([printHtml], { type: "text/html;charset=utf-8" })
  );
  const printWindow = window.open(printUrl, "_blank", "width=950,height=800");
  if (!printWindow) {
    URL.revokeObjectURL(printUrl);
    window.alert("Routevenster kon niet geopend worden.");
    return;
  }

  printWindow.focus();
  window.setTimeout(() => URL.revokeObjectURL(printUrl), 60_000);
}

function createSpecialSchoolDeliveryPrintHtml(input: {
  plan: DayPlan;
  sourceReceipt: ReceiptSummary | null;
}) {
  const sourceNumber =
    input.sourceReceipt?.receiptNumber || input.sourceReceipt?.id || "wordt zondag gekoppeld";
  const rows = specialSchoolDeliveryStops
    .map(
      (stop, index) => `
        <tr>
          <td class="number">${index + 1}</td>
          <td>
            <strong>${escapeHtml(stop.name)}</strong>
            <span>${escapeHtml(stop.address)} · ${escapeHtml(stop.postalCity)}</span>
          </td>
          <td>${stop.cakes.map((cake) => escapeHtml(cake)).join(" · ")}</td>
          <td>${escapeHtml(stop.vehicle)}</td>
          <td class="card"><span></span> kaart</td>
          <td class="check"><span></span></td>
        </tr>`
    )
    .join("");

  return `<!doctype html>
<html lang="nl">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>St Josephschool · 15 afleveradressen</title>
    <style>
      * { box-sizing: border-box; }
      body { background:#efefef; color:#111; font-family:Arial,Helvetica,sans-serif; margin:0; }
      .screen-actions { align-items:center; background:#fff; border-bottom:1px solid #ccc; display:flex; justify-content:space-between; padding:14px 18px; }
      .screen-actions h1 { font-size:18px; margin:0; }
      button { background:#111; border:0; border-radius:10px; color:#fff; cursor:pointer; font-size:14px; font-weight:800; padding:11px 18px; }
      button.secondary { background:#fff; border:1px solid #aaa; color:#111; margin-right:8px; }
      main { background:#fff; margin:18px auto; max-width:1120px; min-height:190mm; padding:10mm; }
      header { align-items:flex-end; border-bottom:3px solid #111; display:flex; justify-content:space-between; padding-bottom:4mm; }
      header h1 { font-size:20pt; line-height:1; margin:0; }
      header p { font-size:9pt; font-weight:700; margin:1.5mm 0 0; }
      .totals { text-align:right; }
      .totals strong { display:block; font-size:15pt; }
      .totals span { font-size:9pt; font-weight:800; }
      table { border-collapse:collapse; margin-top:4mm; table-layout:fixed; width:100%; }
      th { border-bottom:2px solid #111; font-size:8pt; padding:1.5mm; text-align:left; text-transform:uppercase; }
      td { border-bottom:1px solid #aaa; font-size:8.5pt; line-height:1.15; padding:1.35mm 1.5mm; vertical-align:middle; }
      td.number { font-size:10pt; font-weight:900; text-align:center; width:8mm; }
      td strong { display:block; font-size:9.5pt; line-height:1.1; }
      td span { display:block; font-size:8pt; margin-top:.5mm; }
      th:nth-child(1) { width:8mm; }
      th:nth-child(2) { width:66mm; }
      th:nth-child(4) { width:27mm; }
      th:nth-child(5) { width:25mm; }
      th:nth-child(6) { width:13mm; text-align:center; }
      td.card { font-size:8pt; font-weight:800; white-space:nowrap; }
      td.card span, td.check span { border:1.5px solid #111; display:inline-block; height:5mm; margin:0 1mm 0 0; vertical-align:middle; width:5mm; }
      td.check { text-align:center; }
      .note { border:1.5px solid #111; font-size:9pt; font-weight:800; margin-top:4mm; padding:2.5mm 3mm; }
      @media print {
        @page { margin:7mm; size:A4 landscape; }
        body { background:#fff; }
        .screen-actions { display:none; }
        main { margin:0; max-width:none; min-height:0; padding:0; }
      }
    </style>
  </head>
  <body>
    <div class="screen-actions">
      <h1>St Josephschool · 15 afleveradressen</h1>
      <div>
        <button type="button" class="secondary" onclick="if (window.opener) window.close(); else window.history.back();">Terug</button>
        <button type="button" onclick="window.print()">Afdrukken</button>
      </div>
    </div>
    <main>
      <header>
        <div>
          <h1>St Josephschool · schoolleveringen</h1>
          <p>${escapeHtml(formatReceiptDateLabel(input.plan.date))} · hoofd-bon ${escapeHtml(sourceNumber)}</p>
        </div>
        <div class="totals">
          <strong>15 adressen · ${specialSchoolDeliveryCakeCount()} taarten</strong>
          <span>Iedere levering heeft een kaart</span>
        </div>
      </header>
      <table>
        <thead><tr><th>#</th><th>School en adres</th><th>Taarten</th><th>Route</th><th>Kaart</th><th>Klaar</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <p class="note">Let op: dit zijn logistieke deelbonnen. Omzet en productie blijven uitsluitend op de hoofd-bon St Josephschool staan.</p>
    </main>
  </body>
</html>`;
}

function openSpecialSchoolDeliverySheet(
  plan: DayPlan,
  sourceReceipt: ReceiptSummary | null
) {
  const printHtml = createSpecialSchoolDeliveryPrintHtml({ plan, sourceReceipt });
  const printUrl = URL.createObjectURL(
    new Blob([printHtml], { type: "text/html;charset=utf-8" })
  );
  const printWindow = window.open(printUrl, "_blank", "width=1100,height=800");
  if (!printWindow) {
    URL.revokeObjectURL(printUrl);
    window.alert("Overzicht kon niet geopend worden.");
    return;
  }

  printWindow.focus();
  window.setTimeout(() => URL.revokeObjectURL(printUrl), 60_000);
}

function createSpecialProCollegeDeliveryPrintHtml(input: {
  plan: DayPlan;
  sourceReceipt: ReceiptSummary | null;
}) {
  const sourceNumber =
    input.sourceReceipt?.receiptNumber ||
    input.sourceReceipt?.id ||
    "wordt aan Pro College gekoppeld";
  const rows = specialProCollegeDeliveryStops
    .map(
      (stop, index) => `
        <tr>
          <td class="number">${index + 1}</td>
          <td>
            <strong>${escapeHtml(stop.name)}</strong>
            <span>${escapeHtml(stop.address)} · ${escapeHtml(stop.postalCity)}</span>
          </td>
          <td class="quantity">${stop.quantity}</td>
          <td>${escapeHtml(stop.vehicle)}${stop.vehicle === "Bus B" ? ` · ronde ${stop.round}` : ""}</td>
          <td class="check"><span></span></td>
        </tr>`
    )
    .join("");

  return `<!doctype html>
<html lang="nl">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Pro College · 4 afleveradressen</title>
    <style>
      * { box-sizing:border-box; }
      body { background:#efefef; color:#111; font-family:Arial,Helvetica,sans-serif; margin:0; }
      .screen-actions { align-items:center; background:#fff; border-bottom:1px solid #ccc; display:flex; justify-content:space-between; padding:14px 18px; }
      .screen-actions h1 { font-size:18px; margin:0; }
      button { background:#111; border:0; border-radius:10px; color:#fff; cursor:pointer; font-size:14px; font-weight:800; padding:11px 18px; }
      button.secondary { background:#fff; border:1px solid #aaa; color:#111; margin-right:8px; }
      main { background:#fff; margin:18px auto; max-width:820px; min-height:190mm; padding:12mm; }
      header { align-items:flex-end; border-bottom:3px solid #111; display:flex; justify-content:space-between; padding-bottom:5mm; }
      header h1 { font-size:22pt; line-height:1; margin:0; }
      header p { font-size:9pt; font-weight:700; margin:2mm 0 0; }
      .totals { text-align:right; }
      .totals strong { display:block; font-size:16pt; }
      .totals span { font-size:9pt; font-weight:800; }
      table { border-collapse:collapse; margin-top:6mm; table-layout:fixed; width:100%; }
      th { border-bottom:2px solid #111; font-size:8pt; padding:2mm; text-align:left; text-transform:uppercase; }
      td { border-bottom:1px solid #aaa; font-size:9pt; line-height:1.2; padding:3mm 2mm; vertical-align:middle; }
      td.number { font-size:11pt; font-weight:900; text-align:center; width:10mm; }
      td strong { display:block; font-size:11pt; }
      td span { display:block; font-size:8.5pt; margin-top:1mm; }
      th:nth-child(1) { width:10mm; }
      th:nth-child(3) { width:24mm; }
      th:nth-child(4) { width:38mm; }
      th:nth-child(5) { width:16mm; text-align:center; }
      td.quantity { font-size:13pt; font-weight:900; }
      td.check { text-align:center; }
      td.check span { border:1.5px solid #111; display:inline-block; height:6mm; width:6mm; }
      .note { border:1.5px solid #111; font-size:9pt; font-weight:800; margin-top:6mm; padding:3mm; }
      @media print {
        @page { margin:10mm; size:A4 portrait; }
        body { background:#fff; }
        .screen-actions { display:none; }
        main { margin:0; max-width:none; min-height:0; padding:0; }
      }
    </style>
  </head>
  <body>
    <div class="screen-actions">
      <h1>Pro College · 4 afleveradressen</h1>
      <div>
        <button type="button" class="secondary" onclick="if (window.opener) window.close(); else window.history.back();">Terug</button>
        <button type="button" onclick="window.print()">Afdrukken</button>
      </div>
    </div>
    <main>
      <header>
        <div>
          <h1>Pro College · deelleveringen</h1>
          <p>${escapeHtml(formatReceiptDateLabel(input.plan.date))} · hoofd-bon ${escapeHtml(sourceNumber)}</p>
        </div>
        <div class="totals">
          <strong>${specialProCollegeDeliveryPieceCount()} petit gateaux</strong>
          <span>verdeeld over 4 adressen</span>
        </div>
      </header>
      <table>
        <thead><tr><th>#</th><th>Locatie en adres</th><th>Aantal</th><th>Route</th><th>Klaar</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <p class="note">De originele Pro College-bon blijft intact. Deze vier deelbonnen zijn alleen voor laden en afleveren en tellen niet opnieuw mee in omzet of productie.</p>
    </main>
  </body>
</html>`;
}

function openSpecialProCollegeDeliverySheet(
  plan: DayPlan,
  sourceReceipt: ReceiptSummary | null
) {
  const printHtml = createSpecialProCollegeDeliveryPrintHtml({
    plan,
    sourceReceipt,
  });
  const printUrl = URL.createObjectURL(
    new Blob([printHtml], { type: "text/html;charset=utf-8" })
  );
  const printWindow = window.open(printUrl, "_blank", "width=900,height=800");
  if (!printWindow) {
    URL.revokeObjectURL(printUrl);
    window.alert("Overzicht kon niet geopend worden.");
    return;
  }

  printWindow.focus();
  window.setTimeout(() => URL.revokeObjectURL(printUrl), 60_000);
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
          <span>${
            receipt.value
              ? escapeHtml(formatReceiptMoney(receipt.value))
              : isSpecialSchoolChildReceipt(receipt)
                ? "via hoofd-bon"
                : "intern"
          }</span>
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
        if (!isWeddingCakeLine(line) && isMarzipanOrCreamCakeLine(line)) {
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

type FixedShopLoad = "fresh" | "shelf";

function isFreshShopLine(line: ReceiptLine) {
  if (isProductOptionLine(line) || isIceTubLineDescription(line.description)) {
    return false;
  }

  const description = lineSearchDescription(line);

  return (
    isAssortedPastryLine(line) ||
    isPetitFourLine(line) ||
    isMarzipanOrCreamCakeProductLine(line) ||
    /\b(?:gebak|taart|vlaai|tompouce|soes|slof|tartelette|bavarois|mousse|slagroom|creme|cupcake|cakepop|macaron|croissant|broodje|worstenbrood|saucijzen|appelflap|appelbol)\b/.test(
      description
    )
  );
}

function fixedShopStop(input: {
  receipts: ReceiptSummary[];
  shopKey: ShopKey;
  load: FixedShopLoad;
  label: string;
}): RouteStop {
  const shopMeta = shopRouteMeta[input.shopKey];
  const lines = input.receipts
    .filter(
      (receipt) =>
        isShopReceipt(receipt) &&
        !isIceReceiptSummary(receipt) &&
        shopKeyForReceipt(receipt) === input.shopKey
    )
    .flatMap((receipt) => receipt.lines)
    .filter(
      (line) =>
        !isProductOptionLine(line) &&
        !isIceTubLineDescription(line.description) &&
        (input.load === "fresh" ? isFreshShopLine(line) : !isFreshShopLine(line))
    );
  const units = lines.reduce(
    (total, line) => total + numericQuantity(line.quantity),
    0
  );
  const loadLabel = input.load === "fresh" ? "vers" : "houdbaar";
  const detailParts = [shopMeta.address];

  if (lines.length) {
    detailParts.push(
      units > 0
        ? `${formatCompactNumber(units)} ${loadLabel}`
        : `${lines.length} regels ${loadLabel}`
    );
  } else {
    detailParts.push(
      input.load === "fresh" ? "vaste verse stop" : "vaste houdbare stop"
    );
  }

  return {
    id: `shop-${input.shopKey}-${input.load}`,
    sourceId:
      input.load === "fresh"
        ? `shop:${input.shopKey}`
        : `shop:${input.shopKey}:shelf`,
    learningKey: `shop:${input.shopKey}:${input.load}`,
    learningLabel: input.label,
    learningTarget: shopMeta.address,
    learningKind: "shop",
    label: input.label,
    detail: detailParts.join(" · "),
    badges: ["winkel", loadLabel],
  };
}

function fixedShopIceStop(input: {
  receipts: ReceiptSummary[];
  shopKey: ShopKey;
  label: string;
}): RouteStop {
  const shopMeta = shopRouteMeta[input.shopKey];
  const iceReceipts = input.receipts.filter(
    (receipt) =>
      isIceReceiptSummary(receipt) &&
      shopKeyForReceipt(receipt) === input.shopKey
  );
  const iceTubs = iceReceipts.reduce(
    (total, receipt) => total + iceTubCountForReceipt(receipt),
    0
  );
  const detail = iceTubs
    ? `${shopMeta.address} · ${iceTubs} ijs / ${Math.ceil(iceTubs / 3)} tempex`
    : `${shopMeta.address} · vaste ijsstop`;

  return {
    id: `shop-${input.shopKey}-ice`,
    sourceId: `shop:${input.shopKey}:ice`,
    learningKey: `shop:${input.shopKey}:ice`,
    learningLabel: input.label,
    learningTarget: shopMeta.address,
    learningKind: "ice",
    label: input.label,
    detail,
    badges: ["winkel", "ijs", ...(iceTubs ? [`${iceTubs} ijs`] : [])],
  };
}

function isVermaatReceipt(receipt: ReceiptSummary) {
  return /(?:^| )vermaat(?: |$)/.test(receiptRouteIdentityText(receipt));
}

function isRadboudUniversityReceipt(receipt: ReceiptSummary) {
  return /(?:^| )(?:radboud universiteit|universiteit radboud|ru|aula|berchmanianum|catering refter|refter|coffeecorner ub|coffee corner ub|cultuur cafe|giga bite|grand cafe de iris|de iris|het gerecht|huize heyendael|panama|sportsbar the yard|the yard)(?: |$)/.test(
    receiptRouteIdentityText(receipt)
  );
}

function isRadboudUmcReceipt(receipt: ReceiptSummary) {
  const text = receiptRouteIdentityText(receipt);

  return (
    !isVermaatReceipt(receipt) &&
    !isRadboudUniversityReceipt(receipt) &&
    /(?:^| )(?:radboud umc|raboud umc|umc radboud|umc)(?: |$)/.test(text)
  );
}

function isHanReceipt(receipt: ReceiptSummary) {
  return /(?:^| )(?:hogeschool arnhem nijmegen|hoge school arnhem nijmegen|han|academie paramedische studies)(?: |$)/.test(
    receiptRouteIdentityText(receipt)
  );
}

function routeStopForRadboudUniversity(
  receipt: ReceiptSummary,
  prefix = ""
): RouteStop {
  const stop = routeStopForReceipt(receipt, prefix);
  const fixedRouteHint = receiptFixedRouteHint(receipt);

  return {
    ...stop,
    detail: [
      "voor 09:30",
      receiptTargetLine(receipt),
      fixedRouteHint ? `vast: ${fixedRouteHint}` : "",
    ]
      .filter(Boolean)
      .join(" · "),
    badges: Array.from(new Set(["vroeg", "tijd", ...stop.badges])).slice(0, 3),
  };
}

function isWeekdayOutsideSecondRoundReceipt(receipt: ReceiptSummary) {
  const cluster = outsideClusterKeyForReceipt(receipt);

  return Boolean(cluster && cluster !== "jonkerbos" && cluster !== "noord-buiten");
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
  return (
    isVermaatReceipt(receipt) ||
    isRadboudUniversityReceipt(receipt) ||
    isRadboudUmcReceipt(receipt)
  );
}

function isSintMaartenskliniekReceipt(receipt: ReceiptSummary) {
  return /(?:^| )(?:maartenskliniek|sint maartens)(?: |$)/.test(
    receiptRouteIdentityText(receipt)
  );
}

function isDriesElstReceipt(receipt: ReceiptSummary) {
  return /(?:^| )(?:dries en co|dries co|dries|elst)(?: |$)/.test(
    receiptRouteIdentityText(receipt)
  );
}

function isSanadomeReceipt(receipt: ReceiptSummary) {
  return /(?:^| )sanadome(?: |$)/.test(receiptRouteIdentityText(receipt));
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
    const firstSchoolRouteIndex = specialSchoolDeliveryRouteIndex(first);
    const secondSchoolRouteIndex = specialSchoolDeliveryRouteIndex(second);
    if (firstSchoolRouteIndex >= 0 && secondSchoolRouteIndex >= 0) {
      return firstSchoolRouteIndex - secondSchoolRouteIndex;
    }
    const firstProCollegeRouteIndex = specialProCollegeRouteIndex(first);
    const secondProCollegeRouteIndex = specialProCollegeRouteIndex(second);
    if (firstProCollegeRouteIndex >= 0 && secondProCollegeRouteIndex >= 0) {
      return firstProCollegeRouteIndex - secondProCollegeRouteIndex;
    }

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
  if (date === specialSchoolDeliveryDate) return 3;

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
    reason:
      date === specialSchoolDeliveryDate
        ? `Eenmalig 3 bezorgers voor de scholen- en Pro College-routes · drukte ${pressureLabelFor(
            loadProfile.pressure
          )} · rustig 06:30 · normaal 06:00 · druk 05:45`
        : `Drukte ${pressureLabelFor(
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
    detail: routeStopAddressLabel(stop),
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

function buildWeekdayFixedRouteRounds(
  plan: DayPlan,
  receipts: ReceiptSummary[],
  loadProfile: DayLoadProfile
): RouteRound[] {
  const deliveryReceipts = sortDeliveryReceipts(receipts.filter(isRouteDelivery));
  const assignedReceiptIds = new Set<string>();
  const takeReceipts = (predicate: (receipt: ReceiptSummary) => boolean) =>
    deliveryReceipts.filter((receipt) => {
      if (assignedReceiptIds.has(receipt.id) || !predicate(receipt)) return false;

      assignedReceiptIds.add(receipt.id);
      return true;
    });
  const asStops = (items: ReceiptSummary[], prefix: string) =>
    items.map((receipt) => routeStopForReceipt(receipt, prefix));

  const schoolReceipts = takeReceipts(
    (receipt) =>
      plan.date === specialSchoolDeliveryDate &&
      isSpecialSchoolChildReceipt(receipt)
  ).sort(
    (first, second) =>
      specialSchoolDeliveryRouteIndex(first) -
      specialSchoolDeliveryRouteIndex(second)
  );
  const schoolReceiptsFor = (vehicle: string) =>
    schoolReceipts.filter(
      (receipt) => specialSchoolDeliveryVehicleForReceipt(receipt) === vehicle
    ).sort(
      (first, second) =>
        specialSchoolDeliveryVehicleRouteIndex(first) -
        specialSchoolDeliveryVehicleRouteIndex(second)
    );
  const busASchoolReceipts = schoolReceiptsFor("Bus A");
  const busBSchoolReceipts = schoolReceiptsFor("Bus B");
  const dedicatedSchoolReceipts = schoolReceiptsFor(
    specialSchoolDeliveryVehicle
  );
  const proCollegeReceipts = takeReceipts(
    (receipt) =>
      plan.date === specialProCollegeDeliveryDate &&
      isSpecialProCollegeChildReceipt(receipt)
  ).sort(
    (first, second) =>
      specialProCollegeRouteIndex(first) -
      specialProCollegeRouteIndex(second)
  );
  const proCollegeReceiptsFor = (vehicle: string, round: 1 | 2) =>
    proCollegeReceipts.filter(
      (receipt) =>
        specialProCollegeVehicleForReceipt(receipt) === vehicle &&
        specialProCollegeRoundForReceipt(receipt) === round
    );
  const busAProCollegeReceipts = proCollegeReceiptsFor("Bus A", 1);
  const busBFirstProCollegeReceipts = proCollegeReceiptsFor("Bus B", 1);
  const busBSecondProCollegeReceipts = proCollegeReceiptsFor("Bus B", 2);
  const dedicatedProCollegeReceipts = proCollegeReceiptsFor(
    specialSchoolDeliveryVehicle,
    1
  );
  const vermaatReceipts = takeReceipts(isVermaatReceipt);
  const sintMaartenskliniekReceipts = takeReceipts(
    isSintMaartenskliniekReceipt
  );
  const radboudUniversityReceipts = takeReceipts(
    isRadboudUniversityReceipt
  );
  const radboudUmcReceipts = takeReceipts(isRadboudUmcReceipt);
  const hanReceipts = takeReceipts(isHanReceipt);
  const driesReceipts = takeReceipts(isDriesElstReceipt);
  const sanadomeReceipts = takeReceipts(isSanadomeReceipt);
  const cityReceipts = takeReceipts(
    (receipt) => !isOutsideRouteReceipt(receipt)
  );
  const outsideSecondRoundReceipts = takeReceipts(
    isWeekdayOutsideSecondRoundReceipt
  );
  const remainingOutsideReceipts = takeReceipts(() => true);

  const looseIceReceipts = sortDeliveryReceipts(
    receipts.filter(
      (receipt) =>
        isIceReceiptSummary(receipt) &&
        !(["heyendaalseweg", "daalseweg", "lent"] as ShopKey[]).includes(
          shopKeyForReceipt(receipt) as ShopKey
        )
    )
  );
  const busBSecondIceReceipts = looseIceReceipts.filter(
    isWeekdayOutsideSecondRoundReceipt
  );
  const busBFirstIceReceipts = looseIceReceipts.filter((receipt) => {
    const cluster = outsideClusterKeyForReceipt(receipt);

    return (
      !busBSecondIceReceipts.includes(receipt) &&
      (shopKeyForReceipt(receipt) === "ziekerstraat" ||
        cluster === "jonkerbos" ||
        cluster === "noord-buiten")
    );
  });
  const busACityIceReceipts = looseIceReceipts.filter(
    (receipt) =>
      !busBSecondIceReceipts.includes(receipt) &&
      !busBFirstIceReceipts.includes(receipt)
  );

  const busAFirstStops: RouteStop[] = [
    ...asStops(busAProCollegeReceipts, "A-pro-college-"),
    fixedShopStop({
      receipts,
      shopKey: "heyendaalseweg",
      load: "fresh",
      label: "Winkel Heyendaalseweg vers",
    }),
    ...asStops(busASchoolReceipts.slice(0, 1), "A-school-south-"),
    ...asStops(vermaatReceipts, "A-vermaat-"),
    ...asStops(busASchoolReceipts.slice(1), "A-school-east-"),
    fixedShopStop({
      receipts,
      shopKey: "daalseweg",
      load: "fresh",
      label: "Winkel Daalseweg vers",
    }),
    ...asStops(sintMaartenskliniekReceipts, "A-maartens-"),
    ...radboudUniversityReceipts.map((receipt) =>
      routeStopForRadboudUniversity(receipt, "A-ru-")
    ),
    ...asStops(radboudUmcReceipts, "A-umc-"),
    ...asStops(hanReceipts, "A-han-"),
  ];
  const busASecondStops: RouteStop[] = [
    fixedShopStop({
      receipts,
      shopKey: "heyendaalseweg",
      load: "shelf",
      label: "Winkel Heyendaalseweg houdbaar",
    }),
    fixedShopIceStop({
      receipts,
      shopKey: "heyendaalseweg",
      label: "IJs Heyendaal",
    }),
    fixedShopStop({
      receipts,
      shopKey: "daalseweg",
      load: "shelf",
      label: "Winkel Daalseweg houdbaar",
    }),
    fixedShopIceStop({
      receipts,
      shopKey: "daalseweg",
      label: "IJs Daalseweg",
    }),
    ...asStops(cityReceipts, "A-city-"),
    ...busACityIceReceipts.map(iceStopForReceipt),
  ];
  const busBFirstStops: RouteStop[] = [
    fixedShopStop({
      receipts,
      shopKey: "ziekerstraat",
      load: "fresh",
      label: "Winkel Ziekerstraat vers",
    }),
    fixedShopStop({
      receipts,
      shopKey: "lent",
      load: "fresh",
      label: "Winkel Lent vers",
    }),
    fixedShopStop({
      receipts,
      shopKey: "lent",
      load: "shelf",
      label: "Winkel Lent houdbaar",
    }),
    fixedShopIceStop({
      receipts,
      shopKey: "lent",
      label: "Winkel Lent ijs",
    }),
    ...asStops(busBSchoolReceipts, "B-school-north-"),
    ...asStops(busBFirstProCollegeReceipts, "B-pro-college-north-"),
    ...asStops(driesReceipts, "B-dries-"),
    ...asStops(sanadomeReceipts, "B-sanadome-"),
    ...asStops(remainingOutsideReceipts, "B-rest-"),
    ...busBFirstIceReceipts.map(iceStopForReceipt),
  ];
  const busBSecondStops: RouteStop[] = [
    ...asStops(outsideSecondRoundReceipts, "B-outside-"),
    ...asStops(busBSecondProCollegeReceipts, "B-pro-college-south-"),
    ...busBSecondIceReceipts.map(iceStopForReceipt),
  ];
  const dedicatedSchoolRouteStops = [
    ...asStops(dedicatedSchoolReceipts, "school-"),
    ...asStops(dedicatedProCollegeReceipts, "school-pro-college-"),
  ];

  return [
    buildRouteRound({
      id: "bus-A-1",
      title: "Ronde 1",
      vehicle: "Bus A",
      departure: plan.isFuture ? "advies 08:00" : "08:00",
      tone: busRouteMeta.A.tone,
      stops: busAFirstStops,
      reason: "Vaste stadroute: verse winkels en vroege vaste adressen.",
      load: routeLoadLineForStops(busAFirstStops),
      loadProfile,
    }),
    buildRouteRound({
      id: "bus-A-2",
      title: "Ronde 2",
      vehicle: "Bus A",
      departure: "na ronde 1",
      tone: "border-[#efc7b8] bg-[#fff3ed]",
      stops: busASecondStops,
      reason: "Vaste stadroute: houdbaar, winkelijs en resterende stadsbonnen.",
      load: routeLoadLineForStops(busASecondStops),
      loadProfile,
    }),
    buildRouteRound({
      id: "bus-B-1",
      title: "Ronde 1",
      vehicle: "Bus B",
      departure: plan.isFuture ? "advies 08:00" : "08:00",
      tone: busRouteMeta.B.tone,
      stops: busBFirstStops,
      reason: "Vaste buitenroute: Ziekerstraat, Lent en vaste adressen onderweg.",
      load: routeLoadLineForStops(busBFirstStops),
      loadProfile,
    }),
    buildRouteRound({
      id: "bus-B-2",
      title: "Ronde 2",
      vehicle: "Bus B",
      departure: "na ronde 1",
      tone: "border-[#efc7b8] bg-[#fff3ed]",
      stops: busBSecondStops,
      reason: "Buitenronde voor Malden, Molenhoek, Grave, Groesbeek, Gennep en vergelijkbare adressen.",
      load: routeLoadLineForStops(busBSecondStops),
      loadProfile,
    }),
    ...(dedicatedSchoolRouteStops.length
      ? [
          buildRouteRound({
            id: specialSchoolDeliveryRouteId,
            title: "Scholenroute",
            vehicle: specialSchoolDeliveryVehicle,
            departure: plan.isFuture ? "advies 08:00" : "08:00",
            tone: "border-[#cdb6c1] bg-[#f7f0f4]",
            stops: dedicatedSchoolRouteStops,
            reason:
              "Eenmalige west-/stadsroute. De overige scholen rijden geografisch mee met Bus A en Bus B; alle deelbonnen blijven aan hun hoofd-bon gekoppeld en tellen niet dubbel mee.",
            load: `${dedicatedSchoolReceipts.length} scholen · ${dedicatedProCollegeReceipts.reduce(
              (total, receipt) => total + receiptPastryUnits(receipt),
              0
            )} petit gateaux · ${dedicatedSchoolReceipts.length} kaarten`,
            loadProfile,
          }),
        ]
      : []),
  ];
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

  const weekday = dayOfWeekForDate(plan.date);
  if (weekday >= 1 && weekday <= 5) {
    return buildWeekdayFixedRouteRounds(plan, receipts, loadProfile);
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

function isStandardRouteRound(route: RouteRound) {
  return (
    /^bus-[ab]-[12](?:-saturday)?$/i.test(route.id) ||
    route.id === specialSchoolDeliveryRouteId
  );
}

function isUserAddedRouteRound(route: RouteRound) {
  return /-extra-\d+/i.test(route.id);
}

function shouldShowRouteRound(route: RouteRound) {
  return (
    isStandardRouteRound(route) ||
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
  if (!routeToDelete || isStandardRouteRound(routeToDelete)) return routeRounds;

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

function receiptIdForRouteStop(stop: RouteStop) {
  const sourceKey = routeStopSourceKey(stop);

  if (sourceKey.startsWith("receipt:")) {
    return sourceKey.slice("receipt:".length);
  }
  if (sourceKey.startsWith("ice:")) {
    return sourceKey.slice("ice:".length);
  }

  return "";
}

function routeStopBelongsToReceipt(stop: RouteStop, receiptId: string) {
  return receiptIdForRouteStop(stop) === receiptId;
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
  const migrateSpecialDeliveryPlan =
    automaticRouteById.has(specialSchoolDeliveryRouteId) &&
    !routeDraft.routes.some(
      (route) => route.id === specialSchoolDeliveryRouteId
    );

  if (migrateSpecialDeliveryPlan) {
    return automaticRouteRounds.map((route) =>
      refreshRouteRoundAfterManualMove(route, loadProfile)
    );
  }

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
      address: "Berg en Dalseweg 45, Nijmegen",
      route: "Bus A",
      tags: ["tijd", "bezorgen"],
      fulfillment: "bezorgen",
      value: 68,
      note: "Vroegste bon, eerst klaarzetten.",
    },
    {
      id: "CB-002",
      time: "09:00-10:00",
      customer: "Janssen",
      address: "St. Annastraat 20, Nijmegen",
      route: "Bus A",
      tags: ["tijd", "bezorgen"],
      fulfillment: "bezorgen",
      value: 94,
      note: "Voor vertrekcontrole bellen bij vertraging.",
    },
    {
      id: "CB-003",
      time: "09:15-10:00",
      customer: "Sanadome",
      address: "Weg door Jonkerbos 90, Nijmegen",
      route: "Bus B",
      tags: ["groot", "gebak", "bezorgen"],
      fulfillment: "bezorgen",
      value: 420,
      note: "Grote gebaksorder na winkelstops, tenzij expliciet vroeg.",
    },
    {
      id: "CB-004",
      time: "09:30-10:00",
      customer: "Sint Maartenskliniek",
      address: "Hengstdal 3, Ubbergen",
      route: "Bus A",
      tags: ["zorg", "tijd", "bezorgen"],
      fulfillment: "bezorgen",
      value: 310,
      note: "Niet achter winkelvoorraad laten verdwijnen.",
    },
    {
      id: "CB-005",
      time: "09:00-10:00",
      customer: "Radboud",
      address: "Heyendaalseweg 141, Nijmegen",
      route: "Bus A",
      tags: ["tijd", "campus", "bezorgen"],
      fulfillment: "bezorgen",
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
      fulfillment: "afhalen",
      pickupLocation: "Heyendaalseweg",
      note: "Niet meetellen in externe waarde.",
    },
    {
      id: "CB-007",
      time: "09:40",
      customer: "Winkel Daalseweg",
      address: "interne levering",
      route: "Bus A",
      tags: ["winkel", "intern"],
      fulfillment: "afhalen",
      pickupLocation: "Daalseweg",
      note: "Niet meetellen in externe waarde.",
    },
    {
      id: "CB-008",
      time: "09:45",
      customer: "IJssalons",
      address: "ijssalonbonnen controleren",
      route: "Ronde 2",
      tags: ["ijs", "intern", "bezorgen", `${plan.tempexBoxes} tempex`],
      fulfillment: "bezorgen",
      note: `${plan.iceTubs} bakken ijs, apart laden.`,
    },
    {
      id: "CB-009",
      time: "10:00",
      customer: "Winkel Ziekerstraat",
      address: "interne levering",
      route: "Bus B",
      tags: ["winkel", "intern"],
      fulfillment: "afhalen",
      pickupLocation: "Ziekerstraat",
      note: "Eerste vaste centrum/winkelstop.",
    },
    {
      id: "CB-010",
      time: "10:15",
      customer: "Winkel Lent",
      address: "interne levering",
      route: "Bus B",
      tags: ["winkel", "intern"],
      fulfillment: "afhalen",
      pickupLocation: "Lent",
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

  const visibleReceiptCount =
    process.env.NODE_ENV === "development" && plan.orderCount === 0
      ? 10
      : plan.orderCount;
  const visibleReceipts = sharedReceipts
    .slice(0, visibleReceiptCount)
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
  const [batchByDate, setBatchByDate] = useState<
    Record<string, LogisticsBatch | null>
  >({});
  const [webshopImages, setWebshopImages] = useState<WebshopImageSummary[]>([]);
  const [photoPrintHistoryByDate, setPhotoPrintHistoryByDate] = useState<
    Record<string, MarzipanPhotoPrintHistory>
  >({});
  const [receiptOverrides, setReceiptOverrides] = useState<
    ReceiptOverrideSummary[]
  >([]);
  const [routeDraft, setRouteDraft] = useState<RouteDraftSummary | null>(null);
  const [routeLearning, setRouteLearning] =
    useState<RouteLearningSummary | null>(null);
  const [fixedCustomers, setFixedCustomers] = useState<FixedCustomerSummary[]>(
    []
  );
  const [preparationProducts, setPreparationProducts] = useState<
    PreparationProductSummary[]
  >([]);
  const [preparationProductManagerCategory, setPreparationProductManagerCategory] =
    useState<PreparationCategory | null>(null);
  const [preparationProductMessage, setPreparationProductMessage] = useState("");
  const [isSavingPreparationProducts, setIsSavingPreparationProducts] =
    useState(false);
  const [batchLoadState, setBatchLoadState] = useState<BatchLoadState>("idle");
  const [batchReloadCounter, setBatchReloadCounter] = useState(0);
  const [routeSaveState, setRouteSaveState] = useState<RouteSaveState>("idle");
  const [routeSaveMessage, setRouteSaveMessage] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [isOpeningTomorrow, setIsOpeningTomorrow] = useState(false);
  const [importMessage, setImportMessage] = useState("");
  const [overrideMessage, setOverrideMessage] = useState("");
  const [photoLinkMessage, setPhotoLinkMessage] = useState("");
  const [advancePhotoOpen, setAdvancePhotoOpen] = useState(false);
  const [marzipanPrintChoiceOpen, setMarzipanPrintChoiceOpen] =
    useState(false);
  const [routeStopDeleteChoice, setRouteStopDeleteChoice] =
    useState<RouteStopDeleteChoice | null>(null);
  const [receiptDeleteRequest, setReceiptDeleteRequest] =
    useState<ReceiptSummary | null>(null);
  const [routeStopDeleteError, setRouteStopDeleteError] = useState("");
  const [isDeletingReceipt, setIsDeletingReceipt] = useState(false);
  const [schoolDeliveryOverviewOpen, setSchoolDeliveryOverviewOpen] =
    useState(false);
  const [proCollegeDeliveryOverviewOpen, setProCollegeDeliveryOverviewOpen] =
    useState(false);
  const [advancePhotoDate, setAdvancePhotoDate] = useState(() =>
    toInputDate(addDays(new Date(), 14))
  );
  const [advancePhotoCustomer, setAdvancePhotoCustomer] = useState("");
  const [advancePhotoFile, setAdvancePhotoFile] = useState<File | null>(null);
  const [isUploadingAdvancePhoto, setIsUploadingAdvancePhoto] = useState(false);
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
  const tomorrowPrefetchRef = useRef<{
    date: string;
    promise: Promise<LogisticsBatch | null>;
  } | null>(null);
  const activeImportedBatch =
    importedBatch?.date === dateState.selectedDate ? importedBatch : null;
  const futureGateMessage = futurePlanGateMessage(
    dateState,
    Boolean(activeImportedBatch || fileSnapshot)
  );
  const futureGateLoading = Boolean(futureGateMessage && batchLoadState === "loading");
  const futureGateError = Boolean(futureGateMessage && batchLoadState === "error");

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
      const receiptsAfterLegacyDeletion = applyLegacyProCollegeFullDeletion(
        overriddenReceipts,
        selectedPlan.date,
        routeDraft?.excludedSourceIds || []
      );

      return applyFixedCustomerDefaults(
        receiptsAfterLegacyDeletion,
        fixedCustomers
      );
    },
    [
      baseReceiptSummaries,
      fixedCustomers,
      receiptOverrides,
      routeDraft,
      selectedPlan.date,
    ]
  );
  const operationalPlan = useMemo(
    () => dayPlanWithReceiptTotals(selectedPlan, receiptSummaries),
    [receiptSummaries, selectedPlan]
  );
  const logisticsReceiptSummaries = useMemo(
    () =>
      applySpecialProCollegeDeliverySplit(
        applySpecialSchoolDeliverySplit(receiptSummaries, selectedPlan.date),
        selectedPlan.date
      ),
    [receiptSummaries, selectedPlan.date]
  );
  const proCollegeDeliverySourceReceipt = useMemo(
    () => receiptSummaries.find(isSpecialProCollegeSourceReceipt) || null,
    [receiptSummaries]
  );
  const orderReceiptSummaries = useMemo(
    () =>
      proCollegeDeliverySourceReceipt
        ? [...logisticsReceiptSummaries, proCollegeDeliverySourceReceipt]
        : logisticsReceiptSummaries,
    [logisticsReceiptSummaries, proCollegeDeliverySourceReceipt]
  );
  const schoolDeliverySourceReceipt = useMemo(
    () => receiptSummaries.find(isSpecialSchoolSourceReceipt) || null,
    [receiptSummaries]
  );
  const showSpecialSchoolDelivery =
    selectedPlan.date === specialSchoolDeliveryDate;
  const showSpecialProCollegeDelivery =
    selectedPlan.date === specialProCollegeDeliveryDate;
  const pressureOverride = pressureByDate[selectedPlan.date] || "";
  const loadProfile = useMemo(
    () =>
      buildDayLoadProfile(
        operationalPlan,
        logisticsReceiptSummaries,
        pressureOverride
      ),
    [logisticsReceiptSummaries, operationalPlan, pressureOverride]
  );
  const productionTotals = useMemo(
    () => buildBakeryProductionTotals(receiptSummaries),
    [receiptSummaries]
  );
  const weddingCakeReferences = useMemo(
    () =>
      receiptSummaries.flatMap((receipt) => {
        if (isInternalReceiptSummary(receipt) || !isWeddingCakeReceipt(receipt)) {
          return [];
        }

        const reference = weddingCakeReferenceForReceipt(
          receipt,
          selectedPlan.date
        );

        return reference
          ? [{ receiptId: receipt.id, reference }]
          : [];
      }),
    [receiptSummaries, selectedPlan.date]
  );
  const stats = useMemo(
    () => buildStats(operationalPlan, productionTotals),
    [operationalPlan, productionTotals]
  );
  const automaticRouteRounds = useMemo(
    () =>
      buildRouteRounds(
        operationalPlan,
        logisticsReceiptSummaries,
        loadProfile,
        routeLearning
      ),
    [loadProfile, logisticsReceiptSummaries, operationalPlan, routeLearning]
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
  const photoPrintHistory = photoPrintHistoryByDate[selectedPlan.date] || null;
  const printedPhotoKeys = useMemo(
    () => new Set(photoPrintHistory?.printedKeys || []),
    [photoPrintHistory]
  );
  const newMarzipanPrintItems = useMemo(
    () =>
      marzipanPrintItems.filter((item) => !printedPhotoKeys.has(item.printKey)),
    [marzipanPrintItems, printedPhotoKeys]
  );
  const marzipanPhotoPrintGroups = useMemo(
    () => buildMarzipanPhotoPrintGroups(marzipanPrintItems, printedPhotoKeys),
    [marzipanPrintItems, printedPhotoKeys]
  );
  const writtenTextPrintItems = useMemo(
    () => buildWrittenTextPrintItems(receiptSummaries),
    [receiptSummaries]
  );
  const arendNumberPrintOrders = useMemo(
    () => buildArendNumberPrintOrders(receiptSummaries),
    [receiptSummaries]
  );
  const arendNumberPrintCount = useMemo(
    () =>
      arendNumberPrintOrders.reduce(
        (sum, order) => sum + order.defaultSquareCount,
        0
      ),
    [arendNumberPrintOrders]
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
  const todayBatch = dateState.selectedDate === dateState.today
    ? activeImportedBatch
    : batchByDate[dateState.today];
  const tomorrowBatch = dateState.selectedDate === dateState.tomorrow
    ? activeImportedBatch
    : batchByDate[dateState.tomorrow];
  const todayBatchStatus =
    selectedPlan.date === dateState.today && fileSnapshot
      ? fileSnapshot.status
      : todayBatch?.status;
  const tomorrowBatchStatus =
    selectedPlan.date === dateState.tomorrow && fileSnapshot
      ? fileSnapshot.status
      : tomorrowBatch?.status;
  const tomorrowDefinitiveBatchMissing =
    isNextLogisticsDateCalendarTomorrow(dateState) &&
    minuteOfDay(dateState.hour, dateState.minute) >=
      DEFINITIVE_BATCH_START_MINUTE_OF_DAY &&
    tomorrowBatchStatus !== "definitief";
  const selectedBatch = activeImportedBatch || batchByDate[selectedPlan.date] || null;
  const selectedBatchStatus = fileSnapshot?.status || selectedBatch?.status;
  const definitiveBatchExpected =
    selectedPlan.date === dateState.today ||
    (selectedPlan.date === dateState.tomorrow &&
      isNextLogisticsDateCalendarTomorrow(dateState) &&
      minuteOfDay(dateState.hour, dateState.minute) >=
        DEFINITIVE_BATCH_START_MINUTE_OF_DAY);
  const definitiveBatchMissing =
    definitiveBatchExpected &&
    selectedBatchStatus !== "definitief" &&
    batchLoadState !== "loading" &&
    !isImporting;
  const showManualBatchUpload = definitiveBatchMissing || isImporting;
  const compactBatchStatus = useMemo(() => {
    if (isImporting) return "Mailbatch wordt ingeladen...";
    if (batchLoadState === "loading") return "Mailbatch controleren...";
    if (definitiveBatchMissing) {
      return "Let op: geen definitieve batch ingeladen. Controleer.";
    }
    if (selectedBatch) {
      const label = selectedBatch.status === "definitief"
        ? "Definitief"
        : selectedBatch.status === "prognose"
          ? "Prognose"
          : "Handmatig";
      return `${label} ingeladen op ${formatDateTimeLabel(selectedBatch.importedAt)}`;
    }
    if (fileSnapshot) {
      const label = fileSnapshot.status === "definitief" ? "Definitief" : "Prognose";
      return `${label} handmatig ingeladen om ${fileSnapshot.uploadedAt}`;
    }
    if (importMessage && batchLoadState === "error") return importMessage;
    if (batchLoadState === "error") {
      return "Mailbatch kon niet worden opgehaald. Controleer.";
    }
    if (selectedPlan.date < dateState.today) {
      return `Dagarchief van ${formatDateLabel(selectedPlan.date)}`;
    }
    return "Nog geen mailbatch ingeladen.";
  }, [
    batchLoadState,
    dateState.today,
    definitiveBatchMissing,
    fileSnapshot,
    importMessage,
    isImporting,
    selectedBatch,
    selectedPlan.date,
  ]);

  useEffect(() => {
    dateStateRef.current = dateState;
  }, [dateState]);

  useEffect(() => {
    setPhotoPrintHistoryByDate(readMarzipanPhotoPrintHistory());
  }, []);

  useEffect(() => {
    const date = dateState.tomorrow;
    const controller = new AbortController();
    let cancelled = false;
    const promise = fetch(
      `/api/bakkerij-logistiek?date=${encodeURIComponent(date)}`,
      { cache: "no-store", signal: controller.signal }
    )
      .then(async (response) => {
        if (!response.ok) return null;
        const data = (await response.json()) as { batch?: LogisticsBatch | null };
        return data.batch || null;
      })
      .catch(() => null);

    void promise.then((batch) => {
      if (cancelled) return;
      setBatchByDate((current) => ({ ...current, [date]: batch }));
    });

    tomorrowPrefetchRef.current = { date, promise };
    return () => {
      cancelled = true;
      controller.abort();
      if (tomorrowPrefetchRef.current?.date === date) {
        tomorrowPrefetchRef.current = null;
      }
    };
  }, [batchReloadCounter, dateState.tomorrow]);

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

      const forecastWindowOpened =
        Boolean(tomorrowPrognoseGate(current)) && !tomorrowPrognoseGate(next);

      if (calendarChanged || definitiveWindowStarted || forecastWindowOpened) {
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
          preparationProducts?: PreparationProductSummary[];
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
          setPreparationProducts([]);
          if (manualRefresh) {
            setImportMessage(data.message || "Opnieuw ophalen is niet gelukt.");
          }
          return;
        }

        setImportedBatch(data.batch || null);
        setBatchByDate((current) => ({
          ...current,
          [dateState.selectedDate]: data.batch || null,
        }));
        setWebshopImages(data.webshopImages || []);
        setReceiptOverrides(data.receiptOverrides || []);
        setRouteDraft(data.routeDraft || null);
        setRouteLearning(data.routeLearning || null);
        setFixedCustomers(data.fixedCustomers || []);
        setPreparationProducts(data.preparationProducts || []);
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
    const { today, tomorrow } = dateStateRef.current;
    if (!date || (date > today && date !== tomorrow)) return;

    if (date !== dateStateRef.current.selectedDate) setBatchLoadState("loading");
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

  async function openTomorrow() {
    const date = dateStateRef.current.tomorrow;
    if (dateStateRef.current.selectedDate === date || isOpeningTomorrow) return;

    setIsOpeningTomorrow(true);
    try {
      const prefetch = tomorrowPrefetchRef.current;
      const prefetchedBatch = prefetch?.date === date
        ? await prefetch.promise
        : null;
      const batch = prefetchedBatch || await fetch(`/api/bakkerij-logistiek?date=${encodeURIComponent(date)}`, {
            cache: "no-store",
          })
            .then(async (response) => {
              if (!response.ok) return null;
              const data = (await response.json()) as { batch?: LogisticsBatch | null };
              return data.batch || null;
            })
            .catch(() => null);

      setImportedBatch(batch);
      setBatchByDate((current) => ({ ...current, [date]: batch }));
      selectDate(date);
    } finally {
      setIsOpeningTomorrow(false);
    }
  }

  function refreshBatch() {
    manualBatchRefreshRef.current = true;
    setBatchLoadState("loading");
    setFileSnapshot(null);
    setImportMessage("bonnen opnieuw ophalen...");
    setDeletedRouteStopSnapshot(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setBatchReloadCounter((current) => current + 1);
  }

  function rememberMarzipanPhotoPrint(items: MarzipanPrintItem[]) {
    if (items.length === 0) return;

    const date = selectedPlan.date;
    const printedAt = new Date().toISOString();

    setPhotoPrintHistoryByDate((current) => {
      const previous = current[date];
      const printedKeys = new Set(previous?.printedKeys || []);

      items.forEach((item) => printedKeys.add(item.printKey));

      const next = {
        ...current,
        [date]: {
          printedAt,
          printedKeys: Array.from(printedKeys),
        },
      };

      writeMarzipanPhotoPrintHistory(next);
      return next;
    });
  }

  function openMarzipanPrintMenu() {
    setMarzipanPrintChoiceOpen(true);
  }

  function printMarzipanPhotos(items: MarzipanPrintItem[]) {
    setMarzipanPrintChoiceOpen(false);
    openMarzipanPhotoSheet(selectedPlan, items, rememberMarzipanPhotoPrint);
  }

  function printArendNumbers() {
    setMarzipanPrintChoiceOpen(false);
    openArendNumberSheet(selectedPlan, arendNumberPrintOrders);
  }

  function printSelectedMarzipanPhotos(imageIds: string[]) {
    const selectedImageIds = new Set(imageIds);
    const selectedItems = marzipanPrintItems.filter((item) =>
      selectedImageIds.has(item.imageId)
    );

    printMarzipanPhotos(selectedItems);
  }

  async function saveRouteDraft(
    routeRoundsToSave: RouteRound[],
    learn = true,
    excludedSourceIds = excludedRouteStopSourceIds
  ) {
    setRouteSaveState("saving");
    setRouteSaveMessage(
      learn
        ? "route opslaan en routegeheugen bijwerken..."
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
          ? `route opgeslagen om ${getUploadTime()}`
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

  function removeRouteStopOnly(routeId: string, stopId: string) {
    const currentRoutes = manualRouteRounds || automaticRouteRounds;
    const sourceRoute = currentRoutes.find((route) => route.id === routeId);
    const stop = sourceRoute?.stops.find((item) => item.id === stopId);
    if (!sourceRoute || !stop) return;

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
    setRouteStopDeleteChoice(null);
    setRouteStopDeleteError("");
    void saveRouteDraft(nextRoutes, false, nextExcludedSourceIds);
  }

  function deleteRouteStop(routeId: string, stopId: string) {
    const currentRoutes = manualRouteRounds || automaticRouteRounds;
    const sourceRoute = currentRoutes.find((route) => route.id === routeId);
    const stop = sourceRoute?.stops.find((item) => item.id === stopId);
    if (!sourceRoute || !stop) return;

    const receiptId = receiptIdForRouteStop(stop);
    const canDeleteReceipt = receiptSummaries.some(
      (receipt) => receipt.id === receiptId
    );

    if (!receiptId || !canDeleteReceipt) {
      const confirmed = window.confirm(
        `Weet je zeker dat je "${stop.label}" alleen uit ${sourceRoute.title} wil verwijderen?`
      );
      if (confirmed) removeRouteStopOnly(routeId, stopId);
      return;
    }

    setRouteStopDeleteError("");
    setRouteStopDeleteChoice({
      receiptId,
      routeId,
      routeTitle: sourceRoute.title,
      stopId,
      stopLabel: stop.label,
    });
  }

  async function deleteReceiptFromDayStart(receiptId: string) {
    const receipt = receiptSummaries.find(
      (item) => item.id === receiptId
    );
    if (!receipt || isDeletingReceipt) return;

    const existingOverride = receiptOverrides.find(
      (override) =>
        override.id === receiptOverrideId(selectedPlan.date, receipt)
    );
    const currentRoutes = manualRouteRounds || automaticRouteRounds;
    const nextRoutes = compactEmptyRouteRounds(
      currentRoutes.map((route) =>
        refreshRouteRoundAfterManualMove(
          {
            ...route,
            stops: route.stops.filter(
              (stop) => !routeStopBelongsToReceipt(stop, receipt.id)
            ),
          },
          loadProfile
        )
      )
    );

    setIsDeletingReceipt(true);
    setRouteStopDeleteError("");

    try {
      const response = await fetch("/api/bakkerij-logistiek/receipt-overrides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: selectedPlan.date,
          receiptId: receipt.id,
          receiptNumber: receipt.receiptNumber,
          ...draftForReceiptOverride(existingOverride),
          removed: true,
        }),
      });
      const data = (await response.json()) as {
        override?: ReceiptOverrideSummary;
        message?: string;
      };

      if (!response.ok || !data.override?.removed) {
        throw new Error(data.message || "De volledige bon verwijderen is niet gelukt.");
      }

      setReceiptOverrides((current) => [
        data.override!,
        ...current.filter((item) => item.id !== data.override!.id),
      ]);
      setManualRouteRounds(nextRoutes);
      setDeletedRouteStopSnapshot(null);
      setRoutesEdited(true);
      setRouteHasUnsavedChanges(true);
      setRouteSaveState("idle");
      setRouteSaveMessage(
        `${receipt.customer} volledig uit de dagstart verwijderd`
      );
      setRouteStopDeleteChoice(null);
      setReceiptDeleteRequest(null);
      void saveRouteDraft(nextRoutes, false);
    } catch (error) {
      setRouteStopDeleteError(
        error instanceof Error
          ? error.message
          : "De volledige bon verwijderen is niet gelukt."
      );
    } finally {
      setIsDeletingReceipt(false);
    }
  }

  function deleteRouteRound(routeId: string) {
    const currentRoutes = manualRouteRounds || automaticRouteRounds;
    const route = currentRoutes.find((item) => item.id === routeId);
    if (!route || isStandardRouteRound(route)) return;

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
    const files = Array.from(event.target.files || []);
    if (!files.length) return;

    setIsImporting(true);
    setImportMessage("PDF wordt gelezen...");

    try {
      const formData = new FormData();
      files.forEach((file) => formData.append("file", file));
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
      setBatchByDate((current) => ({
        ...current,
        [data.batch!.date]: data.batch!,
      }));
      setRouteDraft(null);
      setRouteHasUnsavedChanges(false);
      setDateState((current) => ({ ...current, selectedDate: data.batch!.date }));
      setFileSnapshot({
        name: files.length === 1 ? files[0].name : `${files.length} PDF-delen`,
        size: files.reduce((total, file) => total + file.size, 0),
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

  async function uploadAdvanceWebshopImage() {
    if (!advancePhotoDate || !advancePhotoCustomer.trim() || !advancePhotoFile) {
      setPhotoLinkMessage("Vul leverdatum en klantnaam in en kies een afbeelding.");
      return;
    }

    setIsUploadingAdvancePhoto(true);
    setPhotoLinkMessage("Afbeelding vooruit opslaan...");
    try {
      const uploadFile = await prepareManualPhotoUploadFile(advancePhotoFile);
      const formData = new FormData();
      formData.set("file", uploadFile);
      formData.set("date", advancePhotoDate);
      formData.set("receiptCustomer", advancePhotoCustomer.trim());
      formData.set("productSummary", "Vooruit ontvangen klantlogo of klantfoto");

      const response = await fetch(
        "/api/bakkerij-logistiek/webshop-images/manual",
        { method: "POST", body: formData }
      );
      const data = (await response.json()) as {
        image?: WebshopImageSummary;
        message?: string;
      };
      if (!response.ok || !data.image) {
        throw new Error(data.message || "Afbeelding opslaan is niet gelukt.");
      }

      if (advancePhotoDate === selectedPlan.date) {
        setWebshopImages((current) => [
          data.image!,
          ...current.filter((item) => item.id !== data.image!.id),
        ]);
      }
      setPhotoLinkMessage(
        `Afbeelding bewaard voor ${advancePhotoCustomer.trim()} op ${formatReceiptDateLabel(advancePhotoDate)}.`
      );
      setAdvancePhotoOpen(false);
      setAdvancePhotoCustomer("");
      setAdvancePhotoFile(null);
    } catch (error) {
      setPhotoLinkMessage(
        error instanceof Error ? error.message : "Afbeelding opslaan is niet gelukt."
      );
    } finally {
      setIsUploadingAdvancePhoto(false);
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

  async function savePreparationProducts(
    category: PreparationCategory,
    products: PreparationProductSummary[]
  ) {
    const categoryLabel = category === "bakkerij" ? "Bakkerijlijst" : "Logistieklijst";
    const allProducts = [
      ...preparationProducts.filter((product) => product.category !== category),
      ...products,
    ];
    setIsSavingPreparationProducts(true);
    setPreparationProductMessage(`${categoryLabel.toLowerCase()} opslaan...`);

    try {
      const response = await fetch(
        "/api/bakkerij-logistiek/preparation-products",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ products: allProducts }),
        }
      );
      const data = (await response.json()) as {
        ok?: boolean;
        products?: PreparationProductSummary[];
        message?: string;
      };

      if (!response.ok || !data.ok || !data.products) {
        throw new Error(
          data.message || `${categoryLabel} opslaan is niet gelukt.`
        );
      }

      setPreparationProducts(data.products);
      const savedCount = data.products.filter(
        (product) => product.category === category
      ).length;
      setPreparationProductMessage(
        `${savedCount} producten in de ${categoryLabel.toLowerCase()} opgeslagen.`
      );
      return true;
    } catch (error) {
      setPreparationProductMessage(
        error instanceof Error
          ? error.message
          : `${categoryLabel} opslaan is niet gelukt.`
      );
      return false;
    } finally {
      setIsSavingPreparationProducts(false);
    }
  }

  return (
    <StrikShell wide>
      <StrikPageHeader
        title="Dagstart"
        icon={strikIcons.logistiekDagstart}
        kicker="Bakkerij logistiek"
        description="Ochtendregie, pakbonnen, routes en tweede rondes."
      />

      {futureGateMessage ? (
        <div className="relative mt-5 min-h-[35rem]">
          <WaitingPlanBackdrop />
          <section
            role="status"
            aria-labelledby="tomorrow-prognose-title"
            aria-describedby="tomorrow-prognose-message"
            className="absolute left-1/2 top-10 z-10 w-[min(100%,36rem)] -translate-x-1/2 border border-[#d7cec4] bg-[#fbf7ef] p-6 text-center shadow-lg"
          >
          <p className="text-xs font-black uppercase tracking-[0.2em] text-[#a85a3f]">
            {futureGateLoading ? "Even geduld" : "Let op"}
          </p>
          <h2 id="tomorrow-prognose-title" className="mt-2 text-xl font-black text-[#1a1815]">
            {futureGateLoading
              ? `Planning voor ${planTitleForDate(dateState).toLowerCase()} laden...`
              : tomorrowPrognoseGate(dateState)
                ? `Planning voor ${planTitleForDate(dateState).toLowerCase()} verwacht vanaf ${dayOfWeekForDate(dateState.today) === 6 ? "07:15" : "circa 12:30"}`
                : `De planning voor ${planTitleForDate(dateState).toLowerCase()} is nog niet beschikbaar`}
          </h2>
          <p id="tomorrow-prognose-message" className="mt-3 text-sm font-semibold text-[#6b645b]">
            {futureGateLoading
              ? "We controleren of de prognose al is ingeladen."
              : futureGateError
                ? "Ophalen is niet gelukt. Probeer het opnieuw."
                : futureGateMessage}
          </p>
          <div className="mt-5 flex flex-wrap items-end justify-center gap-2">
            <label className="text-left text-xs font-black text-[#4a4540]">
              Eerdere datum
              <input
                type="date"
                value={dateState.selectedDate > dateState.today ? dateState.today : dateState.selectedDate}
                max={dateState.today}
                aria-label="Eerdere leverdatum kiezen"
                onChange={(event) => selectDate(event.target.value)}
                className="mt-1 block min-h-10 border border-[#d7cec4] bg-white px-2 text-sm font-bold text-[#1a1815]"
              />
            </label>
            <button
              type="button"
              onClick={() => selectDate(dateState.today)}
              className="min-h-10 bg-[#1a1815] px-4 text-sm font-black text-white"
            >
              Terug naar vandaag
            </button>
            <button
              type="button"
              disabled={batchLoadState === "loading"}
              onClick={refreshBatch}
              className="min-h-10 border border-[#d7cec4] bg-white px-4 text-sm font-black text-[#1a1815] disabled:opacity-50"
            >
              Opnieuw controleren
            </button>
          </div>
          </section>
        </div>
      ) : (
      <>
      <section className="relative rounded-2xl border border-[#e8e4de] bg-white/95 p-2.5 shadow-sm sm:p-3">
        <div className="grid gap-3 md:grid-cols-[minmax(17rem,1fr)_auto] md:items-start">
          <div className="min-w-0">
            <div className="flex items-stretch gap-2">
              <BatchDayButton
                active={selectedPlan.date === dateState.today}
                date={dateState.today}
                label="Vandaag"
                onClick={() => selectDate(dateState.today)}
                status={todayBatchStatus}
              />
              <BatchDayButton
                active={selectedPlan.date === dateState.tomorrow}
                alert={tomorrowDefinitiveBatchMissing}
                date={dateState.tomorrow}
                disabled={isOpeningTomorrow}
                label={nextLogisticsDateLabel(dateState)}
                loading={isOpeningTomorrow}
                onClick={() => void openTomorrow()}
                status={tomorrowBatchStatus}
              />
              <label
                aria-label="Eerdere datum kiezen"
                title="Eerdere datum kiezen"
                className={`relative flex h-12 w-10 shrink-0 cursor-pointer items-center justify-center self-center rounded-xl border shadow-sm transition ${
                  selectedPlan.date !== dateState.today &&
                  selectedPlan.date !== dateState.tomorrow
                    ? "border-[#1a1815] bg-[#1a1815] text-white"
                    : "border-[#e8e4de] bg-[#faf8f5] text-[#6b645b] hover:bg-white"
                }`}
              >
                <CalendarIcon />
                <input
                  type="date"
                  value={selectedPlan.date > dateState.today ? dateState.today : selectedPlan.date}
                  max={dateState.today}
                  aria-label="Eerdere leverdatum kiezen"
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                  onChange={(event) => selectDate(event.target.value)}
                />
              </label>
            </div>
            <div
              className={`mt-2 flex min-h-5 flex-wrap items-center gap-x-2 gap-y-1 pl-0.5 text-[0.68rem] font-semibold italic tracking-normal ${
                definitiveBatchMissing || batchLoadState === "error"
                  ? "text-[#a43d28]"
                  : "text-[#7b746c]"
              }`}
            >
              <span className="flex min-w-0 items-center gap-1.5">
                {(definitiveBatchMissing || batchLoadState === "error") && (
                  <WarningIcon />
                )}
                <span className="truncate">{compactBatchStatus}</span>
              </span>
              {showManualBatchUpload && (
                <button
                  type="button"
                  disabled={isImporting}
                  onClick={() => fileInputRef.current?.click()}
                  className="shrink-0 rounded-full border border-[#c95a46] bg-[#fff1ed] px-2.5 py-1 text-[0.62rem] font-black not-italic leading-none text-[#a43d28] transition hover:bg-[#ffe5de] disabled:cursor-wait disabled:opacity-60"
                >
                  {isImporting ? "Uploaden..." : "Handmatig uploaden"}
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 md:h-full md:flex-col md:items-end">
            <div className="flex flex-wrap items-center justify-end gap-1.5">
              {showSpecialSchoolDelivery && (
                <button
                  type="button"
                  onClick={() => setSchoolDeliveryOverviewOpen(true)}
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#9fb6c8] bg-[#eaf4fb] px-2.5 text-[0.64rem] font-black leading-none text-[#244c67] shadow-sm transition hover:bg-[#dceef9] sm:px-3 sm:text-[0.7rem]"
                >
                  <SchoolIcon />
                  <span className="sm:hidden">15 scholen</span>
                  <span className="hidden sm:inline">
                    St Josephschool · 15 adressen
                  </span>
                </button>
              )}
              {showSpecialProCollegeDelivery && (
                <button
                  type="button"
                  onClick={() => setProCollegeDeliveryOverviewOpen(true)}
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#d0b7c4] bg-[#f6edf2] px-2.5 text-[0.64rem] font-black leading-none text-[#654454] shadow-sm transition hover:bg-[#efdee7] sm:px-3 sm:text-[0.7rem]"
                >
                  <SchoolIcon />
                  <span className="sm:hidden">4 Pro College</span>
                  <span className="hidden sm:inline">
                    Pro College · 4 adressen
                  </span>
                </button>
              )}
              <RefreshButton
                disabled={batchLoadState === "loading" || isImporting}
                loading={batchLoadState === "loading"}
                onClick={refreshBatch}
              />
              <MarzipanPhotoPrintButton
                count={marzipanPrintItems.length + arendNumberPrintCount}
                disabled={
                  marzipanPrintItems.length === 0 &&
                  arendNumberPrintOrders.length === 0
                }
                onClick={openMarzipanPrintMenu}
              />
              <WrittenTextPrintButton
                count={writtenTextPrintItems.length}
                disabled={writtenTextPrintItems.length === 0}
                onClick={() =>
                  openWrittenTextSheet(selectedPlan, writtenTextPrintItems)
                }
              />
              <span className="ml-1 border-l border-[#e8e4de] pl-2">
                <PreparationPrintButton
                  printDisabled={receiptSummaries.length === 0}
                  onManage={(category) => {
                    setPreparationProductMessage("");
                    setPreparationProductManagerCategory(category);
                  }}
                  onSelect={(category) =>
                    openPreparationSheet(
                      selectedPlan,
                      receiptSummaries,
                      category,
                      preparationProducts
                    )
                  }
                />
              </span>
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
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#e8e4de] bg-white text-sm font-black text-[#6b645b] shadow-sm transition hover:bg-[#faf8f5]"
                >
                  X
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => setAdvancePhotoOpen(true)}
              className="rounded-full border border-[#e2ddd6] bg-[#faf8f5] px-2.5 py-1 text-[0.6rem] font-semibold italic leading-none text-[#7b746c] transition hover:border-[#cfc7bd] hover:bg-white hover:text-[#4a4540] sm:px-3 sm:text-[0.66rem]"
            >
              <span className="sm:hidden">Foto/logo opslaan</span>
              <span className="hidden sm:inline">Foto of logo vooruit opslaan</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.xls,.xlsx,.csv"
              multiple
              className="sr-only"
              onChange={handleFileChange}
            />
          </div>
        </div>
      </section>

      <section className="mt-2 grid grid-cols-3 overflow-hidden rounded-xl border border-[#e8e4de] bg-white/95 shadow-sm sm:grid-cols-[minmax(7.5rem,0.9fr)_minmax(6.5rem,0.72fr)_minmax(7rem,0.75fr)_minmax(21rem,2.35fr)]">
        {stats.map((stat, index) => (
          <div
            key={stat.label}
            className={`min-h-9 border-l border-t border-[#efe7dd] px-2 py-1.5 sm:border-t-0 sm:px-3 last:col-span-3 sm:last:col-span-1 ${
              index < 3 ? "border-t-0" : "border-l-0 sm:border-l"
            } ${index === 0 ? "border-l-0" : ""}`}
          >
            {stat.metrics ? (
              <div className="flex h-full min-w-0 items-center gap-2">
                <p className="shrink-0 text-[0.58rem] font-bold uppercase tracking-[0.08em] text-[#8b8278]">
                  {stat.label}
                </p>
                <div className="grid min-w-0 flex-1 grid-cols-3 divide-x divide-[#efe7dd]">
                  {stat.metrics.map((metric) => (
                    <div
                      key={metric.label}
                      className={`min-w-0 px-2 first:pl-0 last:pr-0 ${
                        metric.alert ? "text-[#b43e2b]" : "text-[#1a1815]"
                      }`}
                    >
                      <p className="truncate text-[0.55rem] font-semibold leading-none tracking-normal opacity-70">
                        {metric.label}
                      </p>
                      <p className="mt-1 flex items-center gap-1 text-xs font-black leading-none tabular-nums">
                        {metric.alert && <WarningIcon />}
                        {metric.value}
                        {metric.label === "Feesttaarten" &&
                          weddingCakeReferences.map(
                            ({ receiptId, reference }, weddingCakeIndex) => (
                              <a
                                key={receiptId}
                                href={reference.href}
                                target="_blank"
                                rel="noreferrer"
                                aria-label={`Open definitieve bruidstaart ${
                                  reference.code || reference.search
                                }`}
                                title={`Definitieve bruidstaart ${
                                  reference.code || reference.search
                                } openen`}
                                className="relative ml-0.5 inline-flex h-6 w-7 shrink-0 items-center justify-center rounded-lg border border-[#b9cdb4] bg-[#edf5ea] text-[#315641] shadow-sm transition hover:bg-[#dcebd8]"
                              >
                                <span
                                  aria-hidden="true"
                                  className="h-4 w-4 bg-current"
                                  style={{
                                    WebkitMask: `url("${strikIcons.bruidstaart}") center / contain no-repeat`,
                                    mask: `url("${strikIcons.bruidstaart}") center / contain no-repeat`,
                                  }}
                                />
                                <span className="absolute -right-1 -top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-[#1f4f35] px-0.5 text-[0.48rem] font-black leading-none text-white">
                                  {weddingCakeIndex + 1}
                                </span>
                              </a>
                            )
                          )}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div
                className={`flex h-full items-center justify-between gap-2 ${
                  stat.alert ? "text-[#b43e2b]" : "text-[#1a1815]"
                }`}
              >
                <p className="truncate text-[0.58rem] font-bold uppercase tracking-[0.08em] opacity-65">
                  {stat.label}
                </p>
                <p className="flex shrink-0 items-center gap-1 text-sm font-black leading-none tabular-nums">
                  {stat.alert && <WarningIcon />}
                  {stat.value}
                </p>
              </div>
            )}
          </div>
        ))}
      </section>

      <div className="mt-2 grid grid-cols-2 rounded-2xl border border-[#e8e4de] bg-white p-1 shadow-sm">
        {tabs.map((tab) => {
          const active = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              type="button"
              aria-pressed={active}
              onClick={() => setActiveTab(tab.id)}
              className={`min-h-9 rounded-xl px-2 text-xs font-black tracking-normal transition ${
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

      <div className="mt-2">
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
            receiptSummaries={orderReceiptSummaries}
            receiptOverrides={receiptOverrides}
            onSaveReceiptOverride={saveReceiptOverride}
            onLinkWebshopImageToReceipt={linkWebshopImageToReceipt}
            onUnlinkWebshopImageFromReceipt={unlinkWebshopImageFromReceipt}
            onDeleteWebshopImage={deleteWebshopImage}
            onDeleteReceipt={(receipt) => {
              setRouteStopDeleteError("");
              setReceiptDeleteRequest(receipt);
            }}
            onUploadManualWebshopImageForReceipt={
              uploadManualWebshopImageForReceipt
            }
            overrideMessage={overrideMessage}
            photoLinkMessage={photoLinkMessage}
            routeRounds={routeRounds}
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
        {routeStopDeleteChoice && (
          <RouteStopDeleteModal
            choice={routeStopDeleteChoice}
            error={routeStopDeleteError}
            isDeletingReceipt={isDeletingReceipt}
            onClose={() => {
              if (isDeletingReceipt) return;
              setRouteStopDeleteChoice(null);
              setRouteStopDeleteError("");
            }}
            onDeleteReceipt={() =>
              void deleteReceiptFromDayStart(routeStopDeleteChoice.receiptId)
            }
            onRemoveFromRoute={() =>
              removeRouteStopOnly(
                routeStopDeleteChoice.routeId,
                routeStopDeleteChoice.stopId
              )
            }
          />
        )}
        {receiptDeleteRequest && (
          <ReceiptDeleteModal
            error={routeStopDeleteError}
            isDeleting={isDeletingReceipt}
            onClose={() => {
              if (isDeletingReceipt) return;
              setReceiptDeleteRequest(null);
              setRouteStopDeleteError("");
            }}
            onConfirm={() =>
              void deleteReceiptFromDayStart(receiptDeleteRequest.id)
            }
            receipt={receiptDeleteRequest}
          />
        )}
        {advancePhotoOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
            <section className="w-full max-w-lg border border-[#d7cec4] bg-white p-5 shadow-2xl">
              <h2 className="text-xl font-black text-[#1a1815]">
                Foto of logo vooruit opslaan
              </h2>
              <p className="mt-1 text-sm font-bold text-[#6b645b]">
                Nog geen bon nodig. De app koppelt later op leverdatum en klantnaam.
              </p>
              <label className="mt-4 block text-xs font-black uppercase text-[#4a4540]">
                Leverdatum
                <input
                  type="date"
                  value={advancePhotoDate}
                  onChange={(event) => setAdvancePhotoDate(event.target.value)}
                  className="mt-1 h-11 w-full border border-[#d7cec4] px-3 text-sm font-bold"
                />
              </label>
              <label className="mt-3 block text-xs font-black uppercase text-[#4a4540]">
                Klantnaam of achternaam
                <input
                  value={advancePhotoCustomer}
                  onChange={(event) => setAdvancePhotoCustomer(event.target.value)}
                  placeholder="Bijvoorbeeld Kemp"
                  className="mt-1 h-11 w-full border border-[#d7cec4] px-3 text-sm font-bold"
                />
              </label>
              <label className="mt-3 block text-xs font-black uppercase text-[#4a4540]">
                Afbeelding
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/*"
                  onChange={(event) =>
                    setAdvancePhotoFile(event.target.files?.[0] || null)
                  }
                  className="mt-1 block w-full border border-[#d7cec4] bg-[#faf8f5] p-2 text-sm font-bold"
                />
              </label>
              {photoLinkMessage && (
                <p className="mt-3 text-sm font-bold text-[#6f5212]">
                  {photoLinkMessage}
                </p>
              )}
              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setAdvancePhotoOpen(false)}
                  className="min-h-10 border border-[#d7cec4] bg-white px-4 text-sm font-black"
                >
                  Annuleren
                </button>
                <button
                  type="button"
                  disabled={
                    isUploadingAdvancePhoto ||
                    !advancePhotoDate ||
                    !advancePhotoCustomer.trim() ||
                    !advancePhotoFile
                  }
                  onClick={() => void uploadAdvanceWebshopImage()}
                  className="min-h-10 bg-[#1a1815] px-4 text-sm font-black text-white disabled:opacity-40"
                >
                  {isUploadingAdvancePhoto ? "Opslaan..." : "In archief opslaan"}
                </button>
              </div>
            </section>
          </div>
        )}
        {marzipanPrintChoiceOpen && (
          <MarzipanPrintChoiceModal
            allPhotoCount={marzipanPrintItems.length}
            arendCount={arendNumberPrintCount}
            hasPrintHistory={Boolean(photoPrintHistory?.printedAt)}
            lastPrintAt={photoPrintHistory?.printedAt || ""}
            newPhotoCount={newMarzipanPrintItems.length}
            onClose={() => setMarzipanPrintChoiceOpen(false)}
            onPrintAll={() => printMarzipanPhotos(marzipanPrintItems)}
            onPrintArend={printArendNumbers}
            onPrintNew={() => printMarzipanPhotos(newMarzipanPrintItems)}
            onPrintSelection={printSelectedMarzipanPhotos}
            photoGroups={marzipanPhotoPrintGroups}
          />
        )}
        {preparationProductManagerCategory && (
          <PreparationProductsModal
            category={preparationProductManagerCategory}
            isSaving={isSavingPreparationProducts}
            message={preparationProductMessage}
            onClose={() => setPreparationProductManagerCategory(null)}
            onSave={savePreparationProducts}
            products={preparationProducts}
          />
        )}
        {schoolDeliveryOverviewOpen && showSpecialSchoolDelivery && (
          <SpecialSchoolDeliveryModal
            onClose={() => setSchoolDeliveryOverviewOpen(false)}
            plan={selectedPlan}
            sourceReceipt={schoolDeliverySourceReceipt}
          />
        )}
        {proCollegeDeliveryOverviewOpen && showSpecialProCollegeDelivery && (
          <SpecialProCollegeDeliveryModal
            onClose={() => setProCollegeDeliveryOverviewOpen(false)}
            plan={selectedPlan}
            sourceReceipt={proCollegeDeliverySourceReceipt}
          />
        )}
      </div>
      </>
      )}
    </StrikShell>
  );
}

function ReceiptDeleteModal({
  error,
  isDeleting,
  onClose,
  onConfirm,
  receipt,
}: Readonly<{
  error: string;
  isDeleting: boolean;
  onClose: () => void;
  onConfirm: () => void;
  receipt: ReceiptSummary;
}>) {
  const receiptNumber = receipt.receiptNumber || receipt.id;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 p-4">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="receipt-delete-title"
        className="w-full max-w-md rounded-3xl border border-[#d7cec4] bg-[#f8f6f1] p-5 shadow-2xl"
      >
        <p className="text-[0.62rem] font-black uppercase tracking-[0.14em] text-[#8a8178]">
          Extra controle
        </p>
        <h2
          id="receipt-delete-title"
          className="mt-1 text-xl font-black tracking-normal text-[#1a1815]"
        >
          Hele bon verwijderen?
        </h2>
        <p className="mt-1 text-sm font-bold text-[#6b645b]">
          {receipt.customer} · bon {receiptNumber}
        </p>
        <p className="mt-3 rounded-xl bg-[#fff2ef] px-3 py-2 text-xs font-semibold leading-relaxed text-[#805047]">
          De bon verdwijnt uit de bonnenlijst en alle routes. Bonwaarde,
          aantallen, petit fours en overige producttotalen worden direct
          gecorrigeerd.
        </p>

        {error && (
          <p className="mt-3 rounded-xl bg-[#fff0ed] px-3 py-2 text-xs font-bold text-[#a73d2e]">
            {error}
          </p>
        )}

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={isDeleting}
            onClick={onClose}
            className="min-h-11 rounded-xl border border-[#d7cec4] bg-white px-4 text-xs font-black text-[#554d45] disabled:opacity-40"
          >
            Annuleren
          </button>
          <button
            type="button"
            disabled={isDeleting}
            onClick={onConfirm}
            className="min-h-11 rounded-xl bg-[#d75a48] px-4 text-xs font-black text-white transition hover:bg-[#bb4939] disabled:cursor-wait disabled:opacity-55"
          >
            {isDeleting ? "Verwijderen..." : "Hele bon verwijderen"}
          </button>
        </div>
      </section>
    </div>
  );
}

function RouteStopDeleteModal({
  choice,
  error,
  isDeletingReceipt,
  onClose,
  onDeleteReceipt,
  onRemoveFromRoute,
}: Readonly<{
  choice: RouteStopDeleteChoice;
  error: string;
  isDeletingReceipt: boolean;
  onClose: () => void;
  onDeleteReceipt: () => void;
  onRemoveFromRoute: () => void;
}>) {
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 p-4">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="route-stop-delete-title"
        className="w-full max-w-md rounded-3xl border border-[#d7cec4] bg-[#f8f6f1] p-5 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[0.62rem] font-black uppercase tracking-[0.14em] text-[#8a8178]">
              Extra controle
            </p>
            <h2
              id="route-stop-delete-title"
              className="mt-1 text-xl font-black tracking-normal text-[#1a1815]"
            >
              Wat wil je verwijderen?
            </h2>
            <p className="mt-1 text-sm font-bold text-[#6b645b]">
              {choice.stopLabel} · {choice.routeTitle}
            </p>
          </div>
          <button
            type="button"
            aria-label="Sluiten"
            disabled={isDeletingReceipt}
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#d7cec4] bg-white text-lg font-black text-[#554d45] disabled:opacity-40"
          >
            ×
          </button>
        </div>

        <div className="mt-4 grid gap-2">
          <button
            type="button"
            disabled={isDeletingReceipt}
            onClick={onRemoveFromRoute}
            className="rounded-2xl border border-[#bfd0b8] bg-[#edf5ea] px-4 py-3 text-left transition hover:bg-[#e5f0e1] disabled:opacity-40"
          >
            <strong className="block text-sm font-black text-[#1a1815]">
              Alleen uit de logistiek verwijderen
            </strong>
            <small className="mt-1 block text-xs font-semibold leading-snug text-[#62705d]">
              De bon en alle totalen blijven staan; alleen deze routestop verdwijnt.
            </small>
          </button>

          <button
            type="button"
            disabled={isDeletingReceipt}
            onClick={onDeleteReceipt}
            className="rounded-2xl border border-[#e1aa9f] bg-[#fff2ef] px-4 py-3 text-left transition hover:bg-[#ffe9e4] disabled:cursor-wait disabled:opacity-55"
          >
            <strong className="block text-sm font-black text-[#a73d2e]">
              {isDeletingReceipt ? "Bon verwijderen..." : "Hele bon verwijderen"}
            </strong>
            <small className="mt-1 block text-xs font-semibold leading-snug text-[#805047]">
              Verwijdert de bon uit de dagstart en corrigeert bonwaarde, aantallen en producttotalen.
            </small>
          </button>
        </div>

        {error && (
          <p className="mt-3 rounded-xl bg-[#fff0ed] px-3 py-2 text-xs font-bold text-[#a73d2e]">
            {error}
          </p>
        )}

        <button
          type="button"
          disabled={isDeletingReceipt}
          onClick={onClose}
          className="mt-4 min-h-10 w-full rounded-xl border border-[#d7cec4] bg-white px-4 text-xs font-black text-[#554d45] disabled:opacity-40"
        >
          Annuleren
        </button>
      </section>
    </div>
  );
}

function MarzipanPrintChoiceModal({
  allPhotoCount,
  arendCount,
  hasPrintHistory,
  lastPrintAt,
  newPhotoCount,
  onClose,
  onPrintAll,
  onPrintArend,
  onPrintNew,
  onPrintSelection,
  photoGroups,
}: Readonly<{
  allPhotoCount: number;
  arendCount: number;
  hasPrintHistory: boolean;
  lastPrintAt: string;
  newPhotoCount: number;
  onClose: () => void;
  onPrintAll: () => void;
  onPrintArend: () => void;
  onPrintNew: () => void;
  onPrintSelection: (imageIds: string[]) => void;
  photoGroups: MarzipanPhotoPrintGroup[];
}>) {
  const [selectedImageIds, setSelectedImageIds] = useState<string[]>([]);
  const parsedLastPrintAt = lastPrintAt ? new Date(lastPrintAt) : null;
  const lastPrintLabel =
    parsedLastPrintAt && !Number.isNaN(parsedLastPrintAt.getTime())
      ? parsedLastPrintAt.toLocaleString("nl-NL", {
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          month: "long",
        })
      : "";
  const selectedImageIdSet = new Set(selectedImageIds);
  const selectedItemCount = photoGroups.reduce(
    (count, group) =>
      count + (selectedImageIdSet.has(group.imageId) ? group.itemCount : 0),
    0
  );

  function toggleImage(imageId: string) {
    setSelectedImageIds((current) =>
      current.includes(imageId)
        ? current.filter((id) => id !== imageId)
        : [...current, imageId]
    );
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 p-4">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="marzipan-print-choice-title"
        className="flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-3xl border border-[#d7cec4] bg-[#f8f6f1] p-4 shadow-2xl sm:p-5"
      >
        <header className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[0.62rem] font-black uppercase tracking-[0.14em] text-[#7d746b]">
              Printkeuze
            </p>
            <h2
              id="marzipan-print-choice-title"
              className="mt-0.5 text-xl font-black tracking-normal text-[#1a1815]"
            >
              Foto’s en logo’s printen
            </h2>
            {hasPrintHistory && (
              <p className="mt-1 text-xs font-semibold text-[#776f66]">
                Laatste print{lastPrintLabel ? `: ${lastPrintLabel}` : ""}
              </p>
            )}
          </div>
          <button
            type="button"
            aria-label="Sluiten"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#d7cec4] bg-white text-lg font-black text-[#554d45]"
          >
            ×
          </button>
        </header>

        <div className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1">
          <div className="grid gap-2">
            {arendCount > 0 && (
              <button
                type="button"
                onClick={onPrintArend}
                className="flex min-h-16 items-center justify-between gap-3 rounded-2xl border border-[#c9d8c2] bg-white px-4 py-3 text-left shadow-sm transition hover:bg-[#f3f8f1]"
              >
                <span>
                  <strong className="block text-sm font-black text-[#1a1815]">
                    Arend-cijfers printen
                  </strong>
                  <small className="mt-0.5 block text-xs font-semibold text-[#776f66]">
                    Open de cijfersheet voor de Arend-bestelling.
                  </small>
                </span>
                <span className="rounded-full bg-[#c3d3bc] px-2.5 py-1 text-xs font-black text-[#253822]">
                  {arendCount}
                </span>
              </button>
            )}

            {hasPrintHistory && (
              <button
                type="button"
                disabled={newPhotoCount === 0}
                onClick={onPrintNew}
                className="flex min-h-16 items-center justify-between gap-3 rounded-2xl border border-[#c9d8c2] bg-[#edf5ea] px-4 py-3 text-left shadow-sm transition hover:bg-[#e5f0e1] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span>
                  <strong className="block text-sm font-black text-[#1a1815]">
                    Alleen nieuw sinds laatste print
                  </strong>
                  <small className="mt-0.5 block text-xs font-semibold text-[#62705d]">
                    {newPhotoCount > 0
                      ? "Print alleen later toegevoegde foto’s."
                      : "Er zijn geen nieuwe foto’s bijgekomen."}
                  </small>
                </span>
                <span className="rounded-full bg-[#2d6b43] px-2.5 py-1 text-xs font-black text-white">
                  {newPhotoCount}
                </span>
              </button>
            )}

            {allPhotoCount > 0 && (
              <button
                type="button"
                onClick={onPrintAll}
                className="flex min-h-16 items-center justify-between gap-3 rounded-2xl border border-[#d5c0ca] bg-white px-4 py-3 text-left shadow-sm transition hover:bg-[#f8f1f5]"
              >
                <span>
                  <strong className="block text-sm font-black text-[#1a1815]">
                    {hasPrintHistory
                      ? "Alles opnieuw printen"
                      : "Alle foto’s printen"}
                  </strong>
                  <small className="mt-0.5 block text-xs font-semibold text-[#776f66]">
                    {hasPrintHistory
                      ? "Open ook alle eerder geprinte foto’s opnieuw."
                      : "Open alle foto’s voor deze dag."}
                  </small>
                </span>
                <span className="rounded-full bg-[#a27a8e] px-2.5 py-1 text-xs font-black text-white">
                  {allPhotoCount}
                </span>
              </button>
            )}
          </div>

          {photoGroups.length > 0 && (
            <section className="mt-4 border-t border-[#ddd5cc] pt-4">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <h3 className="text-sm font-black tracking-normal text-[#1a1815]">
                    Handmatig foto’s kiezen
                  </h3>
                  <p className="mt-0.5 text-[0.68rem] font-semibold text-[#776f66]">
                    Selecteer klantnamen die je nogmaals wilt openen.
                  </p>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedImageIds(
                        photoGroups.map((group) => group.imageId)
                      )
                    }
                    className="rounded-lg border border-[#d7cec4] bg-white px-2 py-1 text-[0.62rem] font-black text-[#554d45]"
                  >
                    Alles
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedImageIds([])}
                    className="rounded-lg border border-[#d7cec4] bg-white px-2 py-1 text-[0.62rem] font-black text-[#554d45]"
                  >
                    Geen
                  </button>
                </div>
              </div>

              <div className="mt-2 grid gap-1.5">
                {photoGroups.map((group) => {
                  const selected = selectedImageIdSet.has(group.imageId);
                  const productLabel = group.products.join(" · ");
                  const receiptLabel = group.receiptNumbers.join(", ");

                  return (
                    <label
                      key={group.imageId}
                      className={`grid cursor-pointer grid-cols-[auto_2.75rem_minmax(0,1fr)_auto] items-center gap-2 rounded-xl border px-2.5 py-2 transition ${
                        selected
                          ? "border-[#88a881] bg-[#edf5ea]"
                          : "border-[#ddd5cc] bg-white hover:border-[#b8aea4]"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleImage(group.imageId)}
                        className="h-4 w-4 accent-[#2d6b43]"
                      />
                      <span
                        aria-hidden="true"
                        className="h-11 w-11 rounded-lg border border-[#e5ddd4] bg-white bg-contain bg-center bg-no-repeat"
                        style={{
                          backgroundImage: `url("${group.photoUrl.replace(/"/g, "%22")}")`,
                        }}
                      />
                      <span className="min-w-0">
                        <strong className="block truncate text-xs font-black text-[#1a1815]">
                          {group.customerName}
                        </strong>
                        {productLabel && (
                          <small className="mt-0.5 block truncate text-[0.64rem] font-semibold text-[#776f66]">
                            {productLabel}
                          </small>
                        )}
                        {receiptLabel && (
                          <small className="mt-0.5 block truncate text-[0.6rem] font-medium text-[#948a80]">
                            bon {receiptLabel}
                          </small>
                        )}
                      </span>
                      <span className="text-right">
                        <strong className="block text-xs font-black text-[#1a1815]">
                          {group.itemCount}x
                        </strong>
                        <small
                          className={`mt-0.5 block whitespace-nowrap text-[0.58rem] font-black ${
                            group.newItemCount > 0
                              ? "text-[#2d6b43]"
                              : "text-[#948a80]"
                          }`}
                        >
                          {group.newItemCount > 0
                            ? `${group.newItemCount} nieuw`
                            : "geprint"}
                        </small>
                      </span>
                    </label>
                  );
                })}
              </div>

              <button
                type="button"
                disabled={selectedImageIds.length === 0}
                onClick={() => onPrintSelection(selectedImageIds)}
                className="mt-3 min-h-11 w-full rounded-xl bg-[#1a1815] px-4 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                Selectie printen
                {selectedItemCount > 0 ? ` · ${selectedItemCount} stuks` : ""}
              </button>
            </section>
          )}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-4 min-h-10 w-full rounded-xl border border-[#d7cec4] bg-white px-4 text-xs font-black text-[#554d45]"
        >
          Annuleren
        </button>
      </section>
    </div>
  );
}

function SpecialSchoolDeliveryModal({
  onClose,
  plan,
  sourceReceipt,
}: Readonly<{
  onClose: () => void;
  plan: DayPlan;
  sourceReceipt: ReceiptSummary | null;
}>) {
  const sourceNumber = sourceReceipt?.receiptNumber || sourceReceipt?.id || "";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-2 sm:p-4">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="school-delivery-title"
        className="flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-[#cad8e1] bg-[#f8fbfd] shadow-2xl"
      >
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-[#dce6ec] bg-white px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <p className="text-[0.62rem] font-black uppercase tracking-[0.14em] text-[#527187]">
              Eenmalige schoollevering · maandag
            </p>
            <h2
              id="school-delivery-title"
              className="mt-0.5 text-xl font-black tracking-normal text-[#17232b] sm:text-2xl"
            >
              St Josephschool · 15 afleveradressen
            </h2>
            <p className="mt-1 text-xs font-semibold text-[#61717c]">
              {specialSchoolDeliveryCakeCount()} taarten · bij ieder adres een kaart
              {sourceNumber
                ? ` · gekoppeld aan hoofd-bon ${sourceNumber}`
                : " · koppelt automatisch zodra de hoofd-bon binnenkomt"}
            </p>
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => openSpecialSchoolDeliverySheet(plan, sourceReceipt)}
              className="inline-flex h-9 items-center gap-2 rounded-xl bg-[#244c67] px-3 text-xs font-black text-white"
            >
              <PrintIcon />
              Overzicht printen
            </button>
            <button
              type="button"
              aria-label="Sluiten"
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-[#cfd9df] bg-white text-base font-black text-[#435762]"
            >
              ×
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
          {!sourceReceipt && (
            <div className="mb-3 flex items-start gap-2 rounded-xl border border-[#e9c876] bg-[#fff7d9] px-3 py-2 text-xs font-bold text-[#6f5212]">
              <WarningIcon />
              <span>
                De 15 logistieke deelbonnen staan al klaar. De financiële
                hoofd-bon “St Josephschool” wordt na de definitieve import
                automatisch gekoppeld; deze adressen worden daarbij niet
                overschreven.
              </span>
            </div>
          )}
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {specialSchoolDeliveryStops.map((stop, index) => (
              <article
                key={stop.id}
                className="grid grid-cols-[2rem_minmax(0,1fr)] gap-2 rounded-2xl border border-[#dbe5ea] bg-white p-2.5 shadow-sm"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#244c67] text-xs font-black text-white">
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-black leading-tight tracking-normal text-[#17232b]">
                    {stop.name}
                  </h3>
                  <p className="mt-0.5 text-[0.68rem] font-semibold leading-tight text-[#687985]">
                    {stop.address} · {stop.postalCity}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    <span className="rounded-full bg-[#244c67] px-2 py-1 text-[0.58rem] font-black leading-none text-white">
                      {stop.vehicle}
                    </span>
                    {stop.cakes.map((cake) => (
                      <span
                        key={cake}
                        className="rounded-full bg-[#edf3f6] px-2 py-1 text-[0.58rem] font-bold leading-none text-[#3d5666]"
                      >
                        {cake}
                      </span>
                    ))}
                    <span className="rounded-full border border-[#d8b760] bg-[#fff7d9] px-2 py-1 text-[0.58rem] font-black leading-none text-[#6f5212]">
                      + kaart
                    </span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-[#dce6ec] bg-white px-4 py-2.5 sm:px-5">
          <p className="text-[0.68rem] font-semibold text-[#61717c]">
            De hoofd-bon telt één keer mee voor omzet en productie; deze 15
            deelbonnen alleen voor route, laden en afleveren.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="h-9 rounded-xl border border-[#cfd9df] bg-white px-4 text-xs font-black text-[#435762]"
          >
            Sluiten
          </button>
        </footer>
      </section>
    </div>
  );
}

function SpecialProCollegeDeliveryModal({
  onClose,
  plan,
  sourceReceipt,
}: Readonly<{
  onClose: () => void;
  plan: DayPlan;
  sourceReceipt: ReceiptSummary | null;
}>) {
  const sourceNumber = sourceReceipt?.receiptNumber || sourceReceipt?.id || "";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-2 sm:p-4">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="pro-college-delivery-title"
        className="flex max-h-[94vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-[#d8c6cf] bg-[#fbf7f9] shadow-2xl"
      >
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-[#eadfe4] bg-white px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <p className="text-[0.62rem] font-black uppercase tracking-[0.14em] text-[#8a6074]">
              Eenmalige deellevering · maandag
            </p>
            <h2
              id="pro-college-delivery-title"
              className="mt-0.5 text-xl font-black tracking-normal text-[#32232a] sm:text-2xl"
            >
              Pro College · 4 afleveradressen
            </h2>
            <p className="mt-1 text-xs font-semibold text-[#75646c]">
              {specialProCollegeDeliveryPieceCount()} petit gateaux
              {sourceNumber
                ? ` · gekoppeld aan hoofd-bon ${sourceNumber}`
                : " · koppelt automatisch zodra de hoofd-bon binnenkomt"}
            </p>
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() =>
                openSpecialProCollegeDeliverySheet(plan, sourceReceipt)
              }
              className="inline-flex h-9 items-center gap-2 rounded-xl bg-[#7b5367] px-3 text-xs font-black text-white"
            >
              <PrintIcon />
              Overzicht printen
            </button>
            <button
              type="button"
              aria-label="Sluiten"
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-[#ddd0d6] bg-white text-base font-black text-[#654f59]"
            >
              ×
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
          {!sourceReceipt && (
            <div className="mb-3 flex items-start gap-2 rounded-xl border border-[#e9c876] bg-[#fff7d9] px-3 py-2 text-xs font-bold text-[#6f5212]">
              <WarningIcon />
              <span>
                De vier logistieke deelbonnen staan klaar. Zodra de hoofd-bon
                “Pro College” is ingeladen, koppelt de app die automatisch.
              </span>
            </div>
          )}
          <div className="grid gap-2 sm:grid-cols-2">
            {specialProCollegeDeliveryStops.map((stop, index) => (
              <article
                key={stop.id}
                className="grid grid-cols-[2rem_minmax(0,1fr)] gap-2 rounded-2xl border border-[#e5d9df] bg-white p-3 shadow-sm"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#a27a8e] text-xs font-black text-white">
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="truncate text-sm font-black leading-tight tracking-normal text-[#32232a]">
                      {stop.name}
                    </h3>
                    <span className="shrink-0 rounded-full bg-[#f2e9ee] px-2 py-1 text-[0.58rem] font-black leading-none text-[#6e4d5d]">
                      {stop.vehicle}
                      {stop.vehicle === "Bus B" ? ` · ronde ${stop.round}` : ""}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[0.68rem] font-semibold leading-tight text-[#75646c]">
                    {stop.address} · {stop.postalCity}
                  </p>
                  <p className="mt-2 text-base font-black leading-none text-[#32232a]">
                    {stop.quantity} petit gateaux
                  </p>
                </div>
              </article>
            ))}
          </div>
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-[#eadfe4] bg-white px-4 py-2.5 sm:px-5">
          <p className="text-[0.68rem] font-semibold text-[#75646c]">
            De originele bon blijft zichtbaar en telt één keer mee; de vier
            deelbonnen zijn alleen voor route, laden en afleveren.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="h-9 rounded-xl border border-[#ddd0d6] bg-white px-4 text-xs font-black text-[#654f59]"
          >
            Sluiten
          </button>
        </footer>
      </section>
    </div>
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

  const preferredVehicleOrder = [
    "Bus A",
    "Bus B",
    specialSchoolDeliveryVehicle,
  ];
  const vehicles = [
    ...preferredVehicleOrder.filter((vehicle) => groups.has(vehicle)),
    ...Array.from(groups.keys()).filter(
      (vehicle) => !preferredVehicleOrder.includes(vehicle)
    ),
  ];

  return vehicles
    .map((vehicle) => ({
      vehicle,
      routes: groups.get(vehicle) || [],
    }));
}

function routeGroupDisplayTitle(vehicle: string) {
  if (vehicle === "Bus A") return "Bus A · Stadroute";
  if (vehicle === "Bus B") return "Bus B · Buitenroute";
  if (vehicle === specialSchoolDeliveryVehicle) {
    return "Extra bezorger · Scholenroute";
  }

  return vehicle;
}

function routeStopDeliveryTime(stop: RouteStop) {
  return stop.detail
    .split(" · ")
    .map((part) => part.trim())
    .find((part) => /\b\d{1,2}:\d{2}\b/.test(part)) || "";
}

function routeStopAddressLabel(stop: RouteStop) {
  if (stop.learningTarget?.trim()) return stop.learningTarget.trim();

  const time = routeStopDeliveryTime(stop);
  return stop.detail
    .split(" · ")
    .map((part) => part.trim())
    .find((part) => part && part !== time && !/^vast:/i.test(part)) || "Adres controleren";
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
      <div className="flex min-h-8 flex-wrap items-center justify-between gap-2 px-1">
        <h2 className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-[#52654f]">
          Routeplanning
        </h2>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {deletedRouteStopLabel && (
            <button
              type="button"
              onClick={onRouteStopUndo}
              className="min-h-8 rounded-lg border border-white/70 bg-white/55 px-2.5 text-xs font-bold tracking-normal text-[#4a4540] transition hover:bg-white"
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
        {(routeSaveState === "error" || routeSaveState === "saving") && (
          <span
            aria-live="polite"
            className={`basis-full text-right text-[0.62rem] font-semibold italic ${
              routeSaveState === "error" ? "text-[#9b2d1f]" : "text-[#6b645b]"
            }`}
          >
            {routeSaveMessage || "Route opslaan..."}
          </span>
        )}
      </div>

      <div
        className={`grid gap-2.5 md:grid-cols-2 ${
          routeGroups.length >= 3 ? "xl:grid-cols-3" : ""
        }`}
      >
        {routeGroups.map((group) => {
          const printableRouteCount = group.routes.filter(
            (route) => route.stops.length > 0
          ).length;
          const visibleRouteCount = group.routes.length;
          const isElectricBus = group.vehicle === "Bus A";
          const isSchoolRoute =
            group.vehicle === specialSchoolDeliveryVehicle;
          const groupTone = isSchoolRoute
            ? "border-[#cdb6c1] bg-[#f7f0f4]"
            : isElectricBus
              ? busRouteMeta.A.tone
              : busRouteMeta.B.tone;
          const groupIconTone = isSchoolRoute
            ? "border-[#c4a4b4] bg-[#eadde4] text-[#6a4358]"
            : isElectricBus
              ? "border-[#abc6a8] bg-[#e4eee0] text-[#315641]"
              : "border-[#ead178] bg-[#fff0b8] text-[#6f5212]";

          return (
            <article
              key={group.vehicle}
              className="rounded-lg border border-[#e8e4de] bg-white p-2.5 shadow-sm sm:p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md border ${groupIconTone}`}>
                    <DeliveryVanIcon electric={isElectricBus} />
                  </span>
                  <p className="min-w-0 truncate text-[0.96rem] font-black leading-none tracking-normal text-[#1a1815]">
                    {routeGroupDisplayTitle(group.vehicle)}
                    <span className="ml-1 text-[0.82rem] font-medium italic text-[#7b746c]">
                      · {visibleRouteCount} ronde
                      {visibleRouteCount === 1 ? "" : "s"}
                    </span>
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {!isSchoolRoute && (
                    <button
                      type="button"
                      aria-label={`Ronde toevoegen aan ${group.vehicle}`}
                      title="Ronde toevoegen"
                      onClick={() => onRouteAdd(group.vehicle)}
                      className={`flex h-[1.6rem] w-[1.6rem] shrink-0 items-center justify-center rounded-full border text-sm font-black shadow-sm transition hover:bg-white ${groupIconTone}`}
                    >
                      +
                    </button>
                  )}
                  <RoutePrintButton
                    disabled={printableRouteCount === 0}
                    label={`Route printen voor ${group.vehicle}`}
                    onClick={() => openBusRouteSheet(selectedPlan, group)}
                    tone={
                      isSchoolRoute
                        ? "purple"
                        : isElectricBus
                          ? "green"
                          : "yellow"
                    }
                  />
                </div>
              </div>
              <div className="mt-2 grid gap-2">
                {group.routes.map((route) => (
                  <section
                    key={route.id}
                    onDragOver={(event) => handleRouteDragOver(event, route.id)}
                    onDrop={(event) => handleRouteDrop(event, route.id)}
                    className={`rounded-lg border p-2 transition ${
                      groupTone
                    } ${
                      dragging
                        ? "outline outline-1 outline-offset-1 outline-[#d7cec4]"
                        : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="min-w-0 text-[0.68rem] font-bold italic leading-none tracking-normal text-[#4a4540]">
                        {route.title}
                      </p>
                      {!isStandardRouteRound(route) && (
                        <button
                          type="button"
                          aria-label={`${route.title} verwijderen`}
                          title="Ronde verwijderen"
                          onClick={() => onRouteDelete(route.id)}
                          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-white/80 bg-white/80 text-xs font-black text-[#6b645b] transition hover:border-[#9b2d1f] hover:text-[#9b2d1f]"
                        >
                          X
                        </button>
                      )}
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
                          className={`relative grid cursor-grab grid-cols-[1rem_1.45rem_minmax(0,1fr)_auto_1.5rem] items-center gap-1.5 rounded-md border border-white/80 bg-white px-1.5 py-1.5 transition hover:border-[#d7cec4] hover:shadow-sm active:cursor-grabbing ${
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
                            className={`flex h-5 w-5 items-center justify-center rounded-full border text-[0.62rem] font-black tabular-nums tracking-normal ${groupIconTone}`}
                          >
                            {index + 1}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-[0.8rem] font-black leading-tight tracking-normal text-[#1a1815]">
                              {stop.label}
                            </span>
                            <span className="mt-0.5 block truncate text-[0.72rem] font-normal leading-tight tracking-normal text-[#6b645b]">
                              {routeStopAddressLabel(stop)}
                            </span>
                          </span>
                          <span className="whitespace-nowrap text-right text-[0.68rem] font-black tabular-nums tracking-normal text-[#4a4540]">
                            {routeStopDeliveryTime(stop) || "—"}
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
                    <button
                      type="button"
                      aria-label={`Adres toevoegen aan ${route.title}`}
                      title="Adres handmatig toevoegen"
                      onClick={() => addManualStop(route.id)}
                      className="mt-1.5 flex min-h-7 w-full items-center gap-2 rounded-md border border-dashed border-white/90 bg-white/55 px-2 text-left text-[0.65rem] font-semibold italic tracking-normal text-[#6b645b] transition hover:border-[#b9b1a8] hover:bg-white"
                    >
                      <span className={`flex h-4 w-4 items-center justify-center rounded-full border text-xs font-black not-italic ${groupIconTone}`}>
                        +
                      </span>
                      Adres toevoegen
                    </button>
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
  onDeleteReceipt,
  onDeleteWebshopImage,
  onLinkWebshopImageToReceipt,
  onUnlinkWebshopImageFromReceipt,
  onUploadManualWebshopImageForReceipt,
  onSaveReceiptOverride,
  overrideMessage,
  photoLinkMessage,
  receiptOverrides,
  receiptSummaries,
  routeRounds,
  selectedPlan,
  webshopImages,
}: Readonly<{
  onDeleteReceipt: (receipt: ReceiptSummary) => void;
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
  routeRounds: RouteRound[];
  selectedPlan: DayPlan;
  webshopImages: WebshopImageSummary[];
}>) {
  const [selectedReceiptId, setSelectedReceiptId] = useState("");
  const [activeFilter, setActiveFilter] = useState<OrdersFilter>("all");
  const filteredReceipts = useMemo(
    () =>
      receiptSummaries
        .filter((receipt) => receiptMatchesFilter(receipt, activeFilter))
        .sort((first, second) =>
          first.customer.localeCompare(second.customer, "nl", {
            sensitivity: "base",
          })
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
    <section className="grid gap-3">
      <div className="flex min-h-8 flex-wrap items-center justify-between gap-2 px-1">
        <h2 className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-[#52654f]">
          Bonnen
        </h2>
        <div className="flex items-center gap-1.5">
          <span className="w-fit rounded-lg border border-white/70 bg-white/55 px-2.5 py-1 text-[0.65rem] font-bold tracking-normal text-[#6b645b]">
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

      <div className="grid gap-3 md:grid-cols-[minmax(15rem,0.48fr)_minmax(0,1fr)]">
        <div className="rounded-lg border border-[#e8e4de] bg-white p-2.5 shadow-sm sm:p-3">
          <label className="flex items-center gap-2" htmlFor="receipt-location-filter">
            <span className="shrink-0 text-[0.62rem] font-bold uppercase tracking-[0.1em] text-[#8b8278]">
              Toon
            </span>
            <select
              id="receipt-location-filter"
              value={activeFilter}
              onChange={(event) => setActiveFilter(event.target.value as OrdersFilter)}
              className="h-8 min-w-0 flex-1 rounded-lg border border-[#ddd7cf] bg-[#faf8f5] px-2.5 text-[0.72rem] font-bold tracking-normal text-[#1a1815] outline-none transition focus:border-[#8ba287] focus:bg-white"
            >
              {ordersFilters.map((filter) => (
                <option key={filter.id} value={filter.id}>
                  {filter.label} ({receiptFilterCount(receiptSummaries, filter.id)})
                </option>
              ))}
            </select>
          </label>
          <div className="mt-2 h-[24rem] overflow-y-auto pr-1 sm:h-[28rem]">
          <div className="grid gap-1.5">
            {filteredReceipts.map((receipt) => (
              <ReceiptRow
                key={receipt.id}
                active={receipt.id === activeReceiptId}
                bus={receiptBusForRoutes(receipt, routeRounds)}
                imageCount={imageMatchesForReceipt(receipt, webshopImages).length}
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
          onDeleteReceipt={onDeleteReceipt}
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
      </div>
    </section>
  );
}

function ReceiptRow({
  active,
  bus,
  imageCount,
  onSelect,
  receipt,
}: Readonly<{
  active: boolean;
  bus: BusId | "";
  imageCount: number;
  onSelect: () => void;
  receipt: ReceiptSummary;
}>) {
  const time = receiptListTimeLabel(receipt);
  const tone = receiptToneFor(receipt);
  const locationBadge = receiptLocationBadge(receipt);

  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onSelect}
      className={`grid w-full grid-cols-[minmax(0,1fr)_auto] items-start gap-2 rounded-lg border border-l-4 px-2.5 py-2 text-left transition ${
        active
          ? "border-[#1a1815] bg-white shadow-sm"
          : "border-[#efe7dd] bg-[#faf8f5] hover:border-[#d7cec4] hover:bg-white"
      } ${receiptAccentClasses(tone)}`}
    >
      <div className="min-w-0">
        <p className="truncate text-[0.88rem] font-black leading-tight tracking-normal text-[#1a1815] sm:text-[0.94rem]">
          {receipt.customer}
        </p>
        {time && (
          <p className="mt-0.5 truncate text-[0.68rem] font-medium leading-tight tracking-normal text-[#6b645b]">
            {time}
          </p>
        )}
        <div className="mt-1.5 flex items-center gap-1.5 overflow-hidden text-[0.6rem] font-medium leading-none tracking-normal text-[#8b8278]">
          <span>{receipt.lines.length} regels</span>
          {imageCount > 0 && (
            <span className="rounded-full border border-[#d6e5d8] bg-white px-1.5 py-0.5 font-bold text-[#315641]">
              foto {imageCount}
            </span>
          )}
        </div>
      </div>
      <div className="shrink-0 text-right">
        <div className="flex items-center justify-end gap-1">
          <span
            className={`inline-flex min-w-7 justify-center rounded-md border px-1.5 py-1 text-[0.58rem] font-black leading-none tracking-normal ${receiptToneBadgeClasses(
              tone
            )}`}
          >
            {locationBadge}
          </span>
          {bus && (
            <span
              aria-label={`Bus ${bus}`}
              title={`Bus ${bus}`}
              className={`flex h-6 w-6 items-center justify-center rounded-full border text-[0.62rem] font-black leading-none ${
                bus === "A"
                  ? "border-[#abc6a8] bg-[#e4eee0] text-[#315641]"
                  : "border-[#ead178] bg-[#fff0b8] text-[#6f5212]"
              }`}
            >
              {bus}
            </span>
          )}
        </div>
        {receipt.value ? (
          <p className="mt-1.5 text-[0.62rem] font-medium leading-none tracking-normal text-[#6b645b]">
            {formatCompactCurrency(receipt.value)}
          </p>
        ) : isSpecialSchoolChildReceipt(receipt) ? (
          <p className="mt-1.5 text-[0.58rem] font-bold leading-none tracking-normal text-[#527187]">
            deelbon
          </p>
        ) : (
          <p className="mt-1.5 text-[0.62rem] font-medium leading-none tracking-normal text-[#8b8278]">
            intern
          </p>
        )}
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
              Definitieve bruidstaart {weddingCakeReference.code || weddingCakeReference.search}
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
  params.set("open", search);
  params.set("datum", date);

  return {
    search,
    code,
    href: `/bruidstaarten/overzicht?${params.toString()}`,
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
  onDeleteReceipt,
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
  onDeleteReceipt: (receipt: ReceiptSummary) => void;
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
    receiptNeedsManualPhotoUpload(receipt) &&
    !douglasDefaultLogoForReceipt(receipt);
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

        {!isSpecialSchoolChildReceipt(receipt) &&
          !isSpecialProCollegeChildReceipt(receipt) && (
            <div className="flex justify-end border-b border-dashed border-[#e0dbd4] bg-white px-3 py-2">
              <button
                type="button"
                onClick={() => onDeleteReceipt(receipt)}
                className="min-h-8 rounded-lg border border-[#e1aa9f] bg-[#fff2ef] px-2.5 text-[0.62rem] font-black text-[#a73d2e] transition hover:bg-[#ffe9e4]"
              >
                Hele bon verwijderen
              </button>
            </div>
          )}

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
                      {line.catalogArticleNumber || line.articleNumber || ""}
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
                <div>
                  <p className="text-xs font-black uppercase tracking-normal text-[#6f5212]">
                    Logo of foto uit e-mail
                  </p>
                  <p className="mt-0.5 text-[0.65rem] font-bold tracking-normal text-[#6f5212]">
                    Wordt gekoppeld aan {receipt.customer} · levering {formatReceiptDateLabel(selectedPlan.date)}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={isUploadingManualPhoto}
                  onClick={() => manualPhotoInputRef.current?.click()}
                  className="min-h-8 border border-[#1a1815] bg-[#1a1815] px-2.5 text-[0.62rem] font-black uppercase tracking-normal text-white transition hover:bg-[#3b352f] disabled:cursor-wait disabled:opacity-60"
                >
                  {isUploadingManualPhoto ? "Uploaden" : "Handmatig uploaden"}
                </button>
              </div>
              {photoLinkMessage && (
                <p className="mt-1 truncate text-[0.65rem] font-bold tracking-normal text-[#6f5212]">
                  {photoLinkMessage}
                </p>
              )}
            </div>
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
    <section className="grid gap-3 md:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.85fr)]">
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

function BatchDayButton({
  active,
  alert = false,
  date,
  disabled = false,
  label,
  loading = false,
  onClick,
  status,
}: Readonly<{
  active: boolean;
  alert?: boolean;
  date: string;
  disabled?: boolean;
  label: string;
  loading?: boolean;
  onClick: () => void;
  status?: BatchStatus;
}>) {
  const tone = alert
    ? "border-[#dc8c7b] bg-[#fde5df] text-[#923a2a]"
    : status === "definitief"
      ? "border-[#a8c4a6] bg-[#e4eee0] text-[#244b32]"
      : status === "prognose"
        ? "border-[#9ebbd4] bg-[#e4f0fa] text-[#244f70]"
        : "border-[#ddd8d1] bg-[#f1efec] text-[#6b645b]";

  return (
    <button
      type="button"
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={`min-w-[6.75rem] rounded-xl border px-3 py-2 text-left shadow-sm transition hover:brightness-[0.99] disabled:cursor-wait disabled:opacity-60 ${tone} ${
        active ? "ring-2 ring-[#1a1815] ring-offset-1" : ""
      }`}
    >
      <span className="block text-sm font-black leading-none tracking-normal">
        {loading ? "Ophalen..." : label}
      </span>
      <span className="mt-1 block text-[0.62rem] font-bold leading-none opacity-70">
        {formatDateLabel(date)}
      </span>
    </button>
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
      className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#e8e4de] bg-white text-[#1a1815] shadow-sm transition hover:bg-[#faf8f5] disabled:cursor-not-allowed disabled:opacity-50"
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
      className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-[#e8e4de] bg-white text-[#1a1815] shadow-sm transition hover:bg-[#faf8f5] disabled:cursor-not-allowed disabled:opacity-40"
    >
      <PhotoSheetIcon />
      {count > 0 && (
        <span className="absolute -right-1 -top-1 min-w-4 rounded-full border border-[#1a1815] bg-[#1a1815] px-1 text-center text-[0.56rem] font-black leading-4 tracking-normal text-white">
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
      className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-[#e8e4de] bg-white text-[#1a1815] shadow-sm transition hover:bg-[#faf8f5] disabled:cursor-not-allowed disabled:opacity-40"
    >
      <TextSheetIcon />
      {count > 0 && (
        <span className="absolute -right-1 -top-1 min-w-4 rounded-full border border-[#1a1815] bg-[#1a1815] px-1 text-center text-[0.56rem] font-black leading-4 tracking-normal text-white">
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
      className="flex h-8 items-center gap-1.5 rounded-lg border border-white/70 bg-white/55 px-2.5 text-xs font-bold tracking-normal text-[#4a4540] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
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
      aria-label="Route opslaan"
      title="Route opslaan en routegeheugen bijwerken"
      disabled={disabled}
      onClick={onClick}
      className="flex h-8 items-center gap-1.5 rounded-lg border border-[#abc6a8] bg-[#e4eee0] px-2.5 text-xs font-bold tracking-normal text-[#315641] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
    >
      <SaveIcon />
      <span>Route opslaan</span>
    </button>
  );
}

function RoutePrintButton({
  disabled,
  label,
  onClick,
  tone,
}: Readonly<{
  disabled?: boolean;
  label: string;
  onClick: () => void;
  tone: "green" | "yellow" | "purple";
}>) {
  const toneClasses =
    tone === "green"
      ? "border-[#abc6a8] bg-[#e4eee0] text-[#315641]"
      : tone === "purple"
        ? "border-[#c4a4b4] bg-[#eadde4] text-[#6a4358]"
        : "border-[#ead178] bg-[#fff0b8] text-[#6f5212]";

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={`flex h-[1.6rem] w-[1.6rem] items-center justify-center rounded-full border shadow-sm transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40 ${toneClasses}`}
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

function cleanManagedPreparationArticleNumber(value: string) {
  return value
    .toUpperCase()
    .replace(/,/g, ".")
    .replace(/\s+/g, "")
    .replace(/[^A-Z0-9.]/g, "")
    .slice(0, 24);
}

function PreparationProductsModal({
  category,
  isSaving,
  message,
  onClose,
  onSave,
  products,
}: Readonly<{
  category: PreparationCategory;
  isSaving: boolean;
  message: string;
  onClose: () => void;
  onSave: (
    category: PreparationCategory,
    products: PreparationProductSummary[]
  ) => Promise<boolean>;
  products: PreparationProductSummary[];
}>) {
  const [draft, setDraft] = useState<PreparationProductSummary[]>(() =>
    products.filter((product) => product.category === category)
  );
  const [articleNumber, setArticleNumber] = useState("");
  const [articleName, setArticleName] = useState("");
  const [validationMessage, setValidationMessage] = useState("");
  const listLabel = category === "bakkerij" ? "Bakkerijlijst" : "Logistieklijst";

  useEffect(() => {
    setDraft(products.filter((product) => product.category === category));
  }, [category, products]);

  function addProduct() {
    const number = cleanManagedPreparationArticleNumber(articleNumber);
    const name = articleName.replace(/\s+/g, " ").trim();

    if (!/^(?:(?:\d{3,9}|[A-Z]{1,4}\d{3,9})(?:\.[A-Z0-9]{1,8})?|\.[A-Z0-9]{1,8})$/.test(number)) {
      setValidationMessage("Vul een geldig, volledig artikelnummer in.");
      return;
    }
    if (!name) {
      setValidationMessage("Vul ook de artikelnaam in.");
      return;
    }
    if (draft.some((product) => product.articleNumber === number)) {
      setValidationMessage(`${number} staat al in de ${listLabel.toLowerCase()}.`);
      return;
    }

    setDraft((current) =>
      [
        ...current,
        {
          id: `preparation:${category}:${number}`,
          category,
          articleNumber: number,
          articleName: name,
          updatedAt: new Date().toISOString(),
        },
      ].sort((first, second) =>
        first.articleNumber.localeCompare(second.articleNumber, "nl-NL", {
          numeric: true,
        })
      )
    );
    setArticleNumber("");
    setArticleName("");
    setValidationMessage("");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-3 sm:p-4">
      <section
        aria-labelledby="preparation-products-title"
        className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-[#d7cec4] bg-[#fbf9f5] shadow-2xl"
      >
        <header className="flex items-start justify-between gap-3 border-b border-[#e8e1d8] px-4 py-3 sm:px-5">
          <div>
            <p className="text-[0.62rem] font-black uppercase tracking-[0.14em] text-[#6f836b]">
              Voorbereidingslijst
            </p>
            <h2
              id="preparation-products-title"
              className="mt-0.5 text-xl font-black tracking-normal text-[#1a1815] sm:text-2xl"
            >
              {listLabel} beheren
            </h2>
            <p className="mt-1 text-xs font-semibold leading-snug text-[#6b645b]">
              Het artikelnummer wordt exact gematcht. De naam is alleen een
              extra controle en mag op de bon iets afwijken.
            </p>
          </div>
          <button
            type="button"
            aria-label="Sluiten"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#d7cec4] bg-white text-base font-black text-[#4a4540]"
          >
            ×
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 sm:px-5">
          <div className="grid gap-1.5">
            {draft.map((product) => (
              <div
                key={product.articleNumber}
                className="grid grid-cols-[6.8rem_minmax(0,1fr)_2rem] items-center gap-2 rounded-xl border border-[#e6dfd6] bg-white px-2.5 py-2"
              >
                <span className="text-[0.7rem] font-black tabular-nums text-[#31523b]">
                  {product.articleNumber}
                </span>
                <span className="truncate text-[0.76rem] font-bold tracking-normal text-[#1a1815]">
                  {product.articleName}
                </span>
                <button
                  type="button"
                  aria-label={`${product.articleName} verwijderen`}
                  title={`Uit de ${listLabel.toLowerCase()} verwijderen`}
                  onClick={() => {
                    setDraft((current) =>
                      current.filter((item) => item.id !== product.id)
                    );
                    setValidationMessage("");
                  }}
                  className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-black text-[#9b2d1f] transition hover:bg-[#fff0eb]"
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          <div className="mt-3 rounded-2xl border border-[#cfdacb] bg-[#eef4eb] p-3">
            <p className="text-[0.62rem] font-black uppercase tracking-[0.12em] text-[#52654f]">
              Artikel toevoegen
            </p>
            <div className="mt-2 grid gap-2 sm:grid-cols-[9rem_minmax(0,1fr)_auto]">
              <input
                aria-label="Artikelnummer"
                inputMode="text"
                value={articleNumber}
                onChange={(event) => {
                  setArticleNumber(
                    cleanManagedPreparationArticleNumber(event.target.value)
                  );
                  setValidationMessage("");
                }}
                placeholder="Bijv. 20100.686"
                className="h-10 min-w-0 rounded-xl border border-[#c9d2c5] bg-white px-3 text-sm font-black tabular-nums outline-none focus:border-[#6f836b]"
              />
              <input
                aria-label="Artikelnaam"
                value={articleName}
                onChange={(event) => {
                  setArticleName(event.target.value);
                  setValidationMessage("");
                }}
                onKeyDown={(event) => {
                  if (event.key !== "Enter") return;
                  event.preventDefault();
                  addProduct();
                }}
                placeholder="Artikelnaam ter controle"
                className="h-10 min-w-0 rounded-xl border border-[#c9d2c5] bg-white px-3 text-sm font-bold outline-none focus:border-[#6f836b]"
              />
              <button
                type="button"
                onClick={addProduct}
                className="h-10 rounded-xl bg-[#31523b] px-4 text-xs font-black text-white"
              >
                + Toevoegen
              </button>
            </div>
            {validationMessage && (
              <p className="mt-2 text-xs font-bold text-[#a43d28]">
                {validationMessage}
              </p>
            )}
          </div>
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-[#e8e1d8] bg-white px-4 py-3 sm:px-5">
          <p className="text-xs font-semibold text-[#6b645b]">
            {message || `${draft.length} producten in de ${listLabel.toLowerCase()}`}
          </p>
          <div className="ml-auto flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="h-10 rounded-xl border border-[#d7cec4] bg-white px-4 text-xs font-black text-[#4a4540]"
            >
              Annuleren
            </button>
            <button
              type="button"
              disabled={isSaving || draft.length === 0}
              onClick={() => void onSave(category, draft)}
              className="h-10 rounded-xl bg-[#1a1815] px-4 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isSaving ? "Opslaan..." : "Lijst opslaan"}
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}

function PreparationPrintButton({
  printDisabled,
  onManage,
  onSelect,
}: Readonly<{
  printDisabled?: boolean;
  onManage: (category: PreparationCategory) => void;
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
        onClick={() => setOpen((current) => !current)}
        className="relative flex h-8 w-8 items-center justify-center rounded-lg border border-[#e8e4de] bg-[#faf8f5] text-[#6b645b] shadow-sm transition hover:bg-white"
      >
        <PreparationIcon />
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-1 grid min-w-48 gap-1 rounded-xl border border-[#d7d1c8] bg-white p-1 shadow-lg">
          {(["bakkerij", "logistiek"] as PreparationCategory[]).map(
            (category) => (
              <button
                key={category}
                type="button"
                disabled={printDisabled}
                onClick={() => {
                  setOpen(false);
                  onSelect(category);
                }}
                className="min-h-8 rounded-lg px-2 text-left text-[0.68rem] font-black uppercase tracking-normal text-[#1a1815] transition hover:bg-[#faf8f5] disabled:cursor-not-allowed disabled:opacity-35"
              >
                {preparationCategories[category].shortLabel}
              </button>
            )
          )}
          {(["bakkerij", "logistiek"] as PreparationCategory[]).map(
            (category, index) => (
              <button
                key={`manage-${category}`}
                type="button"
                onClick={() => {
                  setOpen(false);
                  onManage(category);
                }}
                className={`min-h-8 rounded-lg px-2 text-left text-[0.68rem] font-bold tracking-normal text-[#6b645b] transition hover:bg-[#faf8f5] hover:text-[#1a1815] ${
                  index === 0 ? "border-t border-[#eee9e2]" : ""
                }`}
              >
                {category === "bakkerij"
                  ? "Bakkerijlijst beheren"
                  : "Logistieklijst beheren"}
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

function CalendarIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-[1.1rem] w-[1.1rem]"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.9"
    >
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
      <path d="M8 3v4M16 3v4M3.5 9.5h17" />
      <path d="M8 13h.01M12 13h.01M16 13h.01M8 17h.01M12 17h.01" />
    </svg>
  );
}

function SchoolIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4 shrink-0"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.9"
    >
      <path d="M3 21h18M5 21V9h14v12M3 9l9-6 9 6" />
      <path d="M9 21v-5h6v5M8 12h.01M12 12h.01M16 12h.01" />
    </svg>
  );
}

function DeliveryVanIcon({ electric }: Readonly<{ electric: boolean }>) {
  return (
    <svg
      viewBox="0 0 32 24"
      className="h-[1.05rem] w-[1.45rem]"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.7"
    >
      <path d="M2.5 5.5h17v13h-17z" />
      <path d="M19.5 10h5.2l4.2 4.6v3.9h-9.4z" />
      <path d="M22 10v4.5h6.4" />
      <circle cx="8" cy="19" r="2.3" fill="white" />
      <circle cx="24.5" cy="19" r="2.3" fill="white" />
      {electric && (
        <path
          d="m11.2 6.2-3.5 6h3l-2.1 5.1 6.2-7.1h-3.1l2.2-4z"
          fill="currentColor"
          stroke="none"
        />
      )}
    </svg>
  );
}

function WarningIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-3.5 w-3.5 shrink-0"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2.2"
    >
      <path d="M10.2 4.2 2.6 18a2 2 0 0 0 1.8 3h15.2a2 2 0 0 0 1.8-3L13.8 4.2a2 2 0 0 0-3.6 0Z" />
      <path d="M12 9v5M12 18h.01" />
    </svg>
  );
}

function PhotoSheetIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-[1.35rem] w-[1.35rem]"
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
      className="h-[1.35rem] w-[1.35rem]"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.5"
    >
      <text
        x="4"
        y="17"
        fill="currentColor"
        stroke="none"
        fontFamily="Snell Roundhand, Apple Chancery, Segoe Script, cursive"
        fontSize="18"
        fontStyle="italic"
        fontWeight="600"
      >
        A
      </text>
      <path d="M6 19.2c3.4-1.1 7.3-.2 11.6-1.5 1.1-.3 1.9-.8 2.4-1.4" />
    </svg>
  );
}

function PreparationIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-[1.35rem] w-[1.35rem]"
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
      className={`h-[1.35rem] w-[1.35rem] ${spinning ? "animate-spin" : ""}`}
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
