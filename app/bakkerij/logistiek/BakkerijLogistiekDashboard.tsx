"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { StrikPageHeader, StrikShell, strikIcons } from "../../StrikUI";
import type {
  LogisticsBatch,
  LogisticsBatchStatus,
  LogisticsFulfillment,
  LogisticsReceipt,
  LogisticsReceiptLine,
} from "./logisticsTypes";

type DashboardTab = "vandaag" | "routes" | "bonnen" | "leren";
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

type RouteRound = {
  id: string;
  title: string;
  vehicle: string;
  departure: string;
  badge: string;
  tone: string;
  stops: string[];
  reason: string;
  load: string;
};

type ReceiptLine = LogisticsReceiptLine;
type ReceiptSummary = LogisticsReceipt;

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

const feedbackStorageKey = "strik-logistiek-dagfeedback-v1";

const tabs: { id: DashboardTab; label: string }[] = [
  { id: "vandaag", label: "Plan" },
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
  { id: "all", label: "Alles" },
  { id: "delivery", label: "Bezorgen", fulfillment: "bezorgen" },
  { id: "pickup-heyendaalseweg", label: "H'weg", location: "Heyendaalseweg" },
  { id: "pickup-daalseweg", label: "D'weg", location: "Daalseweg" },
  { id: "pickup-ziekerstraat", label: "Z'straat", location: "Ziekerstraat" },
  { id: "pickup-lent", label: "Lent", location: "Lent" },
];

const morningSteps = [
  {
    time: "06:30",
    title: "Pakzones",
    detail: "Bus A, Bus B, IJsronde en Check.",
  },
  {
    time: "07:10",
    title: "Grote bonnen",
    detail: "Petit fours, gesorteerd gebak en ijs tellen als druksignaal.",
  },
  {
    time: "07:25",
    title: "Laden",
    detail: "Tijdkritisch vooraan, winkels per route bij elkaar.",
  },
  {
    time: "08:00",
    title: "Vertrekcheck",
    detail: "Bij vertraging eerst vroegste tijdsbonnen bellen.",
  },
  {
    time: "09:45",
    title: "IJsronde",
    detail: "Hoog ijsvolume apart houden van gebak.",
  },
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

function readStoredFeedback() {
  if (typeof window === "undefined") return {};

  try {
    const raw = window.localStorage.getItem(feedbackStorageKey);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveStoredFeedback(feedback: Record<string, string>) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(feedbackStorageKey, JSON.stringify(feedback));
  } catch {
    return;
  }
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
  const iceTubs = importedBatch ? importedBatch.iceTubs : isTomorrow ? 18 : 34;
  const orderValue = importedBatch
    ? importedBatch.orderValue
    : isTomorrow
      ? 2400
      : isToday
        ? 3180
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
    orderCount: importedBatch
      ? importedBatch.orderCount
      : isTomorrow
        ? 18
        : isToday
          ? 25
          : 0,
    orderValue,
    orderPressure,
    iceTubs,
    tempexBoxes: Math.ceil(iceTubs / 3),
    criticalWindows: importedBatch
      ? importedBatch.criticalWindows
      : isTomorrow
        ? 4
        : 6,
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

function buildStats(plan: DayPlan) {
  return [
    {
      label: "Externe waarde",
      value: formatCurrency(plan.orderValue),
      detail: `${plan.orderPressure} · excl. winkel/ijs`,
    },
    { label: "Pakbonnen", value: String(plan.orderCount), detail: plan.batchLabel },
    {
      label: "IJs / tempex",
      value: `${plan.iceTubs} / ${plan.tempexBoxes}`,
      detail: "3 bakken per tempex",
    },
    { label: "Tijdkritisch", value: String(plan.criticalWindows), detail: plan.criticalDetail },
  ];
}

function buildAttentionItems(plan: DayPlan) {
  return [
    {
      label: "Status",
      value: plan.status,
      detail: plan.sourceLabel,
    },
    {
      label: "Drukte",
      value: plan.orderPressure,
      detail: "Exclusief winkel- en ijsbonnen.",
    },
    {
      label: "Tempex",
      value: `${plan.tempexBoxes}`,
      detail: `${plan.iceTubs} ijsbakken, 3 per zwarte bak.`,
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

function buildRouteRounds(plan: DayPlan): RouteRound[] {
  return [
    {
      id: "bus-a",
      title: "Oost spoed",
      vehicle: "Bus A",
      departure: plan.isFuture ? "advies" : "07:40",
      badge: "eerst weg",
      tone: "border-[#d6e5d8] bg-[#f6faf4]",
      stops: [
        "Winkel Heyendaalseweg",
        "Winkel Daalseweg",
        "Sint Maartenskliniek",
        "Radboud",
      ],
      reason: "Afhaal 08:00 en zorg/Radboud vensters rond 09:00.",
      load: "Tijdkritisch vooraan; winkelvoorraad per stop bij elkaar.",
    },
    {
      id: "bus-b",
      title: "Centrum noord",
      vehicle: "Bus B",
      departure: plan.isFuture ? "advies" : "07:40",
      badge: "lucht houden",
      tone: "border-[#eadb8b] bg-[#fff8d8]",
      stops: ["Sanadome", "Winkel Ziekerstraat", "Winkel Lent"],
      reason: "Grote order eerst uit de bus, daarna winkels vrijmaken.",
      load: "Grote gebaksbon vooraan; winkelbakken compact achterin.",
    },
    {
      id: "ijs",
      title: "IJsronde",
      vehicle: "Ronde 2",
      departure: plan.isFuture ? "beslissen" : "09:45",
      badge: `${plan.tempexBoxes} tempex`,
      tone: "border-[#efc7b8] bg-[#fff3ed]",
      stops: [
        "Heyendaalseweg ijs",
        "Daalseweg ijs",
        "Ziekerstraat ijs",
        "Lent ijs",
      ],
      reason: "IJs neemt volume en koeling; apart beoordelen.",
      load: `${plan.iceTubs} bakken ijs = ${plan.tempexBoxes} zwarte tempexbakken.`,
    },
  ];
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
        note: "Grote order vooraan in Bus B.",
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
      note: "Grote gebaksorder vooraan in bus.",
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
      customer: "IJsronde winkels",
      address: "4 winkels",
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
      note: "Na Sanadome lossen.",
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
  const [activeTab, setActiveTab] = useState<DashboardTab>("vandaag");
  const [dateState, setDateState] = useState<DateState>(createDateState);
  const [fileSnapshot, setFileSnapshot] = useState<FileSnapshot | null>(null);
  const [importedBatch, setImportedBatch] = useState<LogisticsBatch | null>(null);
  const [batchLoadState, setBatchLoadState] = useState<BatchLoadState>("idle");
  const [batchReloadCounter, setBatchReloadCounter] = useState(0);
  const [isImporting, setIsImporting] = useState(false);
  const [importMessage, setImportMessage] = useState("");
  const [feedbackByDate, setFeedbackByDate] =
    useState<Record<string, string>>(readStoredFeedback);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const manualBatchRefreshRef = useRef(false);
  const activeImportedBatch =
    importedBatch?.date === dateState.selectedDate ? importedBatch : null;

  const selectedPlan = useMemo(
    () => buildDayPlan(dateState, fileSnapshot, activeImportedBatch),
    [dateState, fileSnapshot, activeImportedBatch]
  );
  const stats = useMemo(() => buildStats(selectedPlan), [selectedPlan]);
  const attentionItems = useMemo(() => buildAttentionItems(selectedPlan), [selectedPlan]);
  const routeRounds = useMemo(() => buildRouteRounds(selectedPlan), [selectedPlan]);
  const receiptSummaries = useMemo(
    () => buildReceiptSummaries(selectedPlan, activeImportedBatch),
    [selectedPlan, activeImportedBatch]
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
          message?: string;
        };

        if (ignoreResult) return;

        if (!response.ok) {
          setBatchLoadState("error");
          if (manualRefresh) {
            setImportMessage(data.message || "Opnieuw ophalen is niet gelukt.");
          }
          return;
        }

        setImportedBatch(data.batch || null);
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

  function updateFeedback(value: string) {
    setFeedbackByDate((current) => ({
      ...current,
      [selectedPlan.date]: value,
    }));
  }

  function saveFeedback() {
    saveStoredFeedback(feedbackByDate);
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

      <section className="mt-3 grid gap-2 sm:grid-cols-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="min-h-20 rounded-lg border border-[#efe7dd] bg-white p-3 shadow-sm"
          >
            <p className="text-xs font-black uppercase tracking-normal text-[#6b645b]">
              {stat.label}
            </p>
            <p className="mt-1 text-2xl font-black leading-none tracking-normal text-[#1a1815]">
              {stat.value}
            </p>
            <p className="mt-1 text-xs font-bold tracking-normal text-[#8b8278]">
              {stat.detail}
            </p>
          </div>
        ))}
      </section>

      <section className="mt-3 rounded-lg border border-[#d6e5d8] bg-[#f6faf4] p-3 shadow-sm sm:p-4">
        <div className="grid gap-2 md:grid-cols-3">
          {attentionItems.map((item) => (
            <div
              key={item.label}
              className="border-t border-[#d6e5d8] pt-2 first:border-t-0 first:pt-0 md:border-l md:border-t-0 md:pl-3 md:pt-0 md:first:border-l-0 md:first:pl-0"
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-xs font-black uppercase tracking-normal text-[#4a6d5a]">
                  {item.label}
                </span>
                <span className="shrink-0 text-sm font-black tracking-normal text-[#1a1815]">
                  {item.value}
                </span>
              </div>
              <p className="mt-0.5 text-xs leading-snug tracking-normal text-[#6b645b]">
                {item.detail}
              </p>
            </div>
          ))}
        </div>
      </section>

      <div className="mt-3 grid grid-cols-4 border border-[#e8e4de] bg-white p-1 shadow-sm">
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
        {activeTab === "vandaag" && (
          <TodayPanel routeRounds={routeRounds} selectedPlan={selectedPlan} />
        )}
        {activeTab === "routes" && <RoutesPanel routeRounds={routeRounds} />}
        {activeTab === "bonnen" && (
          <OrdersPanel
            receiptSummaries={receiptSummaries}
            selectedPlan={selectedPlan}
          />
        )}
        {activeTab === "leren" && (
          <LearningPanel
            feedback={feedback}
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

function TodayPanel({
  routeRounds,
  selectedPlan,
}: Readonly<{ routeRounds: RouteRound[]; selectedPlan: DayPlan }>) {
  return (
    <section className="grid gap-3 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <div className="rounded-lg border border-[#e8e4de] bg-white p-3 shadow-sm sm:p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-black tracking-normal text-[#1a1815]">
            Stappenplan
          </h2>
          <span className="border border-[#efc7b8] bg-[#fff3ed] px-2 py-1 text-xs font-black tracking-normal text-[#1a1815]">
            {selectedPlan.batchLabel}
          </span>
        </div>
        <div className="mt-3 grid gap-2">
          {morningSteps.map((step) => (
            <div
              key={`${step.time}-${step.title}`}
              className="grid grid-cols-[3.4rem_minmax(0,1fr)] gap-3 border-t border-[#efe7dd] pt-2 first:border-t-0 first:pt-0"
            >
              <span className="text-sm font-black tabular-nums tracking-normal text-[#ef5737]">
                {step.time}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-black tracking-normal text-[#1a1815]">
                  {step.title}
                </p>
                <p className="mt-0.5 text-xs leading-snug tracking-normal text-[#6b645b]">
                  {step.detail}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-[#e8e4de] bg-white p-3 shadow-sm sm:p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-black tracking-normal text-[#1a1815]">
            Routekeuze
          </h2>
          <span className="border border-[#d6e5d8] bg-[#f6faf4] px-2 py-1 text-xs font-black tracking-normal text-[#4a6d5a]">
            voorstel
          </span>
        </div>
        <div className="mt-3 grid gap-2">
          {routeRounds.map((route) => (
            <RouteSummaryRow key={route.id} route={route} />
          ))}
        </div>
      </div>
    </section>
  );
}

function RoutesPanel({
  routeRounds,
}: Readonly<{ routeRounds: RouteRound[] }>) {
  return (
    <section className="grid gap-3 lg:grid-cols-3">
      {routeRounds.map((route) => (
        <article
          key={route.id}
          className={`rounded-lg border p-3 shadow-sm sm:p-4 ${route.tone}`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-normal text-[#6b645b]">
                {route.vehicle} · {route.departure}
              </p>
              <h2 className="mt-1 text-xl font-black tracking-normal text-[#1a1815]">
                {route.title}
              </h2>
            </div>
            <span className="shrink-0 border border-white/80 bg-white px-2 py-1 text-xs font-black tracking-normal text-[#1a1815] shadow-sm">
              {route.badge}
            </span>
          </div>
          <ol className="mt-3 grid gap-1.5">
            {route.stops.map((stop, index) => (
              <li
                key={stop}
                className="grid grid-cols-[1.7rem_minmax(0,1fr)] items-center gap-2 border border-white/80 bg-white/85 px-2 py-1.5"
              >
                <span className="flex h-6 w-6 items-center justify-center bg-[#1a1815] text-xs font-black tabular-nums tracking-normal text-white">
                  {index + 1}
                </span>
                <span className="truncate text-sm font-black tracking-normal text-[#1a1815]">
                  {stop}
                </span>
              </li>
            ))}
          </ol>
          <p className="mt-3 text-xs leading-snug tracking-normal text-[#4a4540]">
            <strong>Waarom:</strong> {route.reason}
          </p>
          <p className="mt-1 text-xs leading-snug tracking-normal text-[#4a4540]">
            <strong>Laden:</strong> {route.load}
          </p>
        </article>
      ))}
    </section>
  );
}

function OrdersPanel({
  receiptSummaries,
  selectedPlan,
}: Readonly<{
  receiptSummaries: ReceiptSummary[];
  selectedPlan: DayPlan;
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

  return (
    <section className="grid gap-3 lg:grid-cols-[minmax(16rem,0.5fr)_minmax(0,1fr)]">
      <div className="rounded-lg border border-[#e8e4de] bg-white p-2.5 shadow-sm sm:p-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-black tracking-normal text-[#1a1815]">
            Bonnen
          </h2>
          <span className="w-fit border border-[#e8e4de] bg-[#faf8f5] px-2 py-1 text-[0.68rem] font-black tracking-normal text-[#6b645b]">
            {filteredReceipts.length}/{receiptSummaries.length}
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
                className={`shrink-0 border px-2 py-1 text-[0.68rem] font-black tracking-normal transition ${
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
          </div>
        </div>
      </div>

      <ReceiptDetail receipt={selectedReceipt} selectedPlan={selectedPlan} />
    </section>
  );
}

function ReceiptRow({
  active,
  index,
  onSelect,
  receipt,
}: Readonly<{
  active: boolean;
  index: number;
  onSelect: () => void;
  receipt: ReceiptSummary;
}>) {
  const fulfillment = fulfillmentLabel(receipt);
  const target = receiptTargetLine(receipt);

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
              {receipt.time} · {target}
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
    <div className="grid gap-2 border-b border-dashed border-[#cfc6bc] p-3">
      <div>
        <p className="text-[0.62rem] font-black uppercase tracking-normal text-[#8b8278]">
          Origineel adres
        </p>
        <p className="mt-0.5 text-xs font-normal leading-snug tracking-normal text-[#4a4540]">
          {receipt.address}
        </p>
      </div>
      <div
        className={`border px-2.5 py-2 ${
          fulfillment === "afhalen"
            ? "border-[#eadb8b] bg-[#fff8d8]"
            : "border-[#d6e5d8] bg-[#f6faf4]"
        }`}
      >
        <p className="text-[0.62rem] font-black uppercase tracking-normal text-[#6b645b]">
          {focusLabel}
        </p>
        <p className="mt-0.5 text-sm font-black leading-snug tracking-normal text-[#1a1815]">
          {focusValue}
        </p>
      </div>
      {showAlternativeForPickup && (
        <div>
          <p className="text-[0.62rem] font-black uppercase tracking-normal text-[#8b8278]">
            Afleveradres op bon
          </p>
          <p className="mt-0.5 text-xs font-bold leading-snug tracking-normal text-[#1a1815]">
            {receipt.alternativeAddress}
          </p>
        </div>
      )}
    </div>
  );
}

function ReceiptDetail({
  receipt,
  selectedPlan,
}: Readonly<{ receipt: ReceiptSummary | null; selectedPlan: DayPlan }>) {
  if (!receipt) {
    return (
      <div className="flex h-[30rem] items-center justify-center rounded-lg border border-[#e8e4de] bg-white p-4 text-sm font-bold tracking-normal text-[#6b645b] shadow-sm">
        Geen contantbon geselecteerd.
      </div>
    );
  }

  const fulfillment = fulfillmentLabel(receipt);

  return (
    <article className="h-[30rem] overflow-y-auto rounded-lg border border-[#1a1815] bg-[#fffdf8] shadow-sm">
      <div className="border-b border-dashed border-[#cfc6bc] p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[0.65rem] font-black uppercase tracking-normal text-[#6b645b]">
              Contantbon · {receipt.id}
            </p>
            <h2 className="mt-1 truncate text-lg font-black tracking-normal text-[#1a1815]">
              {receipt.customer}
            </h2>
          </div>
          <span className="shrink-0 border border-[#e8e4de] bg-white px-2 py-1 text-[0.68rem] font-black tracking-normal text-[#6b645b]">
            {fulfillment}
          </span>
        </div>
        <div className="mt-2 flex flex-wrap gap-1">
          {receipt.tags.map((tag) => (
            <span
              key={tag}
              className="border border-[#e8e4de] bg-white px-1.5 py-0.5 text-[0.65rem] font-black tracking-normal text-[#6b645b]"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>

      <dl className="grid gap-2 border-b border-dashed border-[#cfc6bc] p-3 sm:grid-cols-3">
        <div>
          <dt className="text-[0.65rem] font-black uppercase tracking-normal text-[#8b8278]">
            Tijd
          </dt>
          <dd className="mt-0.5 text-xs font-black tracking-normal text-[#1a1815]">
            {receipt.time}
          </dd>
        </div>
        <div>
          <dt className="text-[0.65rem] font-black uppercase tracking-normal text-[#8b8278]">
            Route
          </dt>
          <dd className="mt-0.5 text-xs font-black tracking-normal text-[#1a1815]">
            {receipt.route}
          </dd>
        </div>
        <div>
          <dt className="text-[0.65rem] font-black uppercase tracking-normal text-[#8b8278]">
            Dag
          </dt>
          <dd className="mt-0.5 text-xs font-black tracking-normal text-[#1a1815]">
            {selectedPlan.title}
          </dd>
        </div>
      </dl>

      <ReceiptAddressBlock receipt={receipt} />

      <div className="p-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-xs font-black uppercase tracking-normal text-[#1a1815]">
            Regels
          </h3>
          <span className="text-[0.68rem] font-black tracking-normal text-[#6b645b]">
            {receipt.lines.length}
          </span>
        </div>
        <div className="mt-2 grid gap-1">
          {receipt.lines.map((line, index) => (
            <div
              key={`${receipt.id}-line-${index}`}
              className="grid grid-cols-[2.8rem_minmax(0,1fr)_4.3rem] gap-2 border-t border-[#efe7dd] pt-1 first:border-t-0 first:pt-0"
            >
              <span className="font-mono text-xs font-black tabular-nums tracking-normal text-[#1a1815]">
                {line.quantity}
              </span>
              <div className="min-w-0">
                <p className="text-xs font-bold leading-snug tracking-normal text-[#1a1815]">
                  {line.description}
                </p>
                {line.note && (
                  <p className="mt-0.5 text-[0.68rem] font-normal leading-snug tracking-normal text-[#6b645b]">
                    {line.note}
                  </p>
                )}
              </div>
              <span className="text-right text-[0.68rem] font-normal tabular-nums tracking-normal text-[#6b645b]">
                {line.unitPrice !== undefined ? formatMoney(line.unitPrice) : ""}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="border-y border-dashed border-[#cfc6bc] bg-white/70 p-3">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-black uppercase tracking-normal text-[#1a1815]">
            Bonwaarde
          </span>
          <span className="text-sm font-normal tracking-normal text-[#1a1815]">
            {receipt.value ? formatMoney(receipt.value) : "intern"}
          </span>
        </div>
      </div>

      <div className="grid gap-2 p-3">
        <div>
          <p className="text-[0.65rem] font-black uppercase tracking-normal text-[#8b8278]">
            Opmerking bon
          </p>
          <p className="mt-0.5 text-xs font-normal leading-snug tracking-normal text-[#1a1815]">
            {receipt.customerNote}
          </p>
        </div>
        <div className="border-t border-[#efe7dd] pt-2">
          <p className="text-[0.65rem] font-black uppercase tracking-normal text-[#8b8278]">
            Ochtendregie
          </p>
          <p className="mt-0.5 text-xs font-normal leading-snug tracking-normal text-[#1a1815]">
            {receipt.internalNote}
          </p>
        </div>
      </div>
    </article>
  );
}

function LearningPanel({
  feedback,
  learningSignals,
  onFeedbackChange,
  onSave,
  selectedPlan,
}: Readonly<{
  feedback: string;
  learningSignals: string[];
  onFeedbackChange: (value: string) => void;
  onSave: () => void;
  selectedPlan: DayPlan;
}>) {
  return (
    <section className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.7fr)]">
      <div className="rounded-lg border border-[#e8e4de] bg-white p-3 shadow-sm sm:p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-black tracking-normal text-[#1a1815]">
            Dagfeedback
          </h2>
          <button
            type="button"
            aria-label="Feedback opslaan"
            title="Feedback opslaan"
            onClick={onSave}
            className="flex h-10 w-10 items-center justify-center border border-[#d6e5d8] bg-[#f6faf4] text-sm font-black text-[#1a1815] shadow-sm transition hover:bg-white"
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

function RouteSummaryRow({ route }: Readonly<{ route: RouteRound }>) {
  return (
    <article className="border-t border-[#efe7dd] pt-2 first:border-t-0 first:pt-0">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-normal text-[#6b645b]">
            {route.vehicle} · {route.departure}
          </p>
          <h3 className="truncate text-base font-black tracking-normal text-[#1a1815]">
            {route.title}
          </h3>
        </div>
        <span className="shrink-0 text-xs font-black tracking-normal text-[#6b645b]">
          {route.stops.length} stops
        </span>
      </div>
      <p className="mt-2 truncate text-sm font-bold tracking-normal text-[#4a4540]">
        {route.stops.join(" -> ")}
      </p>
    </article>
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
