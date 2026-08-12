import "server-only";

import type {
  LogisticsBatch,
  LogisticsDayFeedback,
  LogisticsDayOperations,
  LogisticsFixedCustomer,
  LogisticsTeamMember,
  LogisticsLoadPressure,
  LogisticsReceiptOverride,
  LogisticsRouteDraft,
  LogisticsRouteDraftRound,
  LogisticsRouteDraftStop,
  LogisticsRouteLearning,
  LogisticsRouteLearningObservation,
  LogisticsRouteLearningObservationStop,
  LogisticsRouteLearningPair,
  LogisticsRouteLearningStop,
  LogisticsWebshopImage,
} from "@/app/bakkerij/logistiek/logisticsTypes";
import { createAdminClient } from "./supabase/admin";
import type { Json } from "./supabase/types";

const LOGISTICS_BATCHES_SETTING_KEY = "bakery_logistics_batches";
const LOGISTICS_WEBSHOP_IMAGES_SETTING_KEY = "bakery_logistics_webshop_images";
const LOGISTICS_RECEIPT_OVERRIDES_SETTING_KEY =
  "bakery_logistics_receipt_overrides";
const LOGISTICS_DAY_FEEDBACK_SETTING_KEY = "bakery_logistics_day_feedback";
const LOGISTICS_ROUTE_DRAFTS_SETTING_KEY = "bakery_logistics_route_drafts";
const LOGISTICS_ROUTE_LEARNING_SETTING_KEY = "bakery_logistics_route_learning";
const LOGISTICS_FIXED_CUSTOMERS_SETTING_KEY = "bakery_logistics_fixed_customers";
const MAX_STORED_BATCHES = 80;
const MAX_STORED_WEBSHOP_IMAGES = 1200;
const MAX_STORED_WEBSHOP_IMAGES_JSON_BYTES = 5_500_000;
const WEBSHOP_IMAGE_RETENTION_DAYS = 14;
const MAX_STORED_RECEIPT_OVERRIDES = 3000;
const MAX_STORED_DAY_FEEDBACK = 1200;
const MAX_STORED_ROUTE_DRAFTS = 180;
const MAX_STORED_ROUTE_LEARNING_OBSERVATIONS = 180;
const MAX_ROUTE_LEARNING_STOPS = 500;
const MAX_ROUTE_LEARNING_PAIRS = 800;
const MAX_STORED_FIXED_CUSTOMERS = 1000;

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

type LogisticsRouteDraftsState = {
  drafts: LogisticsRouteDraft[];
};

type LogisticsRouteLearningState = {
  observations: LogisticsRouteLearningObservation[];
};

type LogisticsFixedCustomersState = {
  customers: LogisticsFixedCustomer[];
  updatedAt: string;
};

const DEFAULT_LOGISTICS_FIXED_CUSTOMER_UPDATED_AT =
  "2026-08-07T00:00:00.000Z";

const DEFAULT_LOGISTICS_FIXED_CUSTOMERS: LogisticsFixedCustomer[] = [
  {
    id: "fixed:60001",
    customerNumbers: ["60001"],
    customerName: "Bakkerij Koenen anna molen",
    deliveryWindow: "08:00 - 13:00",
    address: "Hatertseweg 14 Nijmegen",
    routeNote: "Wordt meestal meegenomen door de stadroute",
    updatedAt: DEFAULT_LOGISTICS_FIXED_CUSTOMER_UPDATED_AT,
  },
  {
    id: "fixed:60067",
    customerNumbers: ["60067"],
    customerName: "Scandic Sanadome",
    deliveryWindow: "08:00 - 13:00",
    address: "Weg door jonkerbos",
    routeNote:
      "Wordt meestal meegenomen door de buitenroute aan het einde van de route richting Malden",
    updatedAt: DEFAULT_LOGISTICS_FIXED_CUSTOMER_UPDATED_AT,
  },
  {
    id: "fixed:60090-60696-61116",
    customerNumbers: ["60090", "60696", "61116"],
    customerName: "Sint Maartenskliniek",
    deliveryWindow: "08:30 - 09:30",
    address: "Hengstdal 3",
    routeNote: "Wordt meestal direct na Ziekerstraat of Daalseweg bezorgd",
    updatedAt: DEFAULT_LOGISTICS_FIXED_CUSTOMER_UPDATED_AT,
  },
  {
    id: "fixed:60248-60249",
    customerNumbers: ["60248", "60249"],
    customerName: "Radboud UMC",
    deliveryWindow: "09:30 - 10:30",
    address: "Hoofdingang Raboud UMC",
    routeNote: "Wordt meestal na de Maartenskliniek geleverd",
    updatedAt: DEFAULT_LOGISTICS_FIXED_CUSTOMER_UPDATED_AT,
  },
  {
    id: "fixed:60918",
    customerNumbers: ["60918"],
    customerName: "Crematorium Jonkerbos",
    deliveryWindow:
      "09:00 - 10:00 (afhankelijk van de dienst, staat op de bon)",
    address: "Weg door jonkerbos",
    routeNote:
      "Wordt meestal voor Sanadome bezorgd, tenzij het heel vroeg moet vanwege en dienst dan direct na winkel Lent",
    updatedAt: DEFAULT_LOGISTICS_FIXED_CUSTOMER_UPDATED_AT,
  },
  {
    id: "fixed:60988",
    customerNumbers: ["60988"],
    customerName: "Konings Maters",
    deliveryWindow: "09:30 - 11:00",
    address: "Keizer Karelplein 1",
    routeNote:
      "Wordt meestal direct na winkel ziekerstraat bezorgd of na 2e ronde ziekerstraat want hebben vaak warme producten die in de ziekerstraat opgewarmd moeten worden.",
    updatedAt: DEFAULT_LOGISTICS_FIXED_CUSTOMER_UPDATED_AT,
  },
  {
    id: "fixed:61654",
    customerNumbers: ["61654"],
    customerName: "De ontdekking",
    deliveryWindow: "10:00 - 13:00",
    address: "Oude Kleefsebaan 425",
    routeNote:
      "Wordt soms na Maartenskliniek bezorgd, maar ook vaak in combinatie met groesbeek leveringen, want hoeft nooit vroeg",
    updatedAt: DEFAULT_LOGISTICS_FIXED_CUSTOMER_UPDATED_AT,
  },
  {
    id: "fixed:61771",
    customerNumbers: ["61771"],
    customerName: "Gasterij de Arend",
    deliveryWindow: "10:00 - 14:00",
    address: "Notaris Stefanus roesstr 28 Winssen",
    routeNote:
      "Wordt altijd na winkel Lent bezorgd in Winssen, geen specifieke tijd maar wel bevroren producten dus niet te lang in de bus",
    updatedAt: DEFAULT_LOGISTICS_FIXED_CUSTOMER_UPDATED_AT,
  },
  {
    id: "fixed:61956",
    customerNumbers: ["61956"],
    customerName: "Pret Inn",
    deliveryWindow: "07:00 - 10:00",
    address: "Bolder 18 Malden",
    routeNote:
      "Wordt vaak direct na 1e ronde winkels bezorgd bij route Malden (Ah malden, jachtslot, etc)",
    updatedAt: DEFAULT_LOGISTICS_FIXED_CUSTOMER_UPDATED_AT,
  },
  {
    id: "fixed:62705",
    customerNumbers: ["62705"],
    customerName: "Vermaat",
    deliveryWindow: "08:30 - 09:15",
    address: "Geert Groteplein Zuid",
    routeNote: "Wordt direct na winkel Heyendaal of Daal bezorgd want moet vroeg",
    updatedAt: DEFAULT_LOGISTICS_FIXED_CUSTOMER_UPDATED_AT,
  },
  {
    id: "fixed:63840-63872-64126",
    customerNumbers: ["63840", "63872", "64126"],
    customerName: "Buren, Stadsherberg en Koffiehuis Gennep",
    deliveryWindow: "10:00 - 14:00",
    address: "Zandstraat 1 Gennep",
    routeNote:
      "Liggen alle 3 naast elkaar, worden altijd als 2e ronde bezorgd op vaste dagen dat ze bestellen met AH gennep ivt",
    updatedAt: DEFAULT_LOGISTICS_FIXED_CUSTOMER_UPDATED_AT,
  },
  {
    id: "fixed:64042",
    customerNumbers: ["64042"],
    customerName: "Dries en Co",
    deliveryWindow: "08:00 - 11:00",
    address: "Valburgseweg 18C Elst",
    routeNote: "Wordt1e ronde na winkel Lent bezorgd",
    updatedAt: DEFAULT_LOGISTICS_FIXED_CUSTOMER_UPDATED_AT,
  },
  {
    id: "fixed:64105",
    customerNumbers: ["64105"],
    customerName: "Jachtslot Mookerheide",
    deliveryWindow:
      "09:00 - 10:30 doordeweeks en 09:00 - 10:00 in het weekend",
    address: "Heumensebaan 2 Molenhoek",
    routeNote:
      "Wordt direct na de 1e ronde bezorgd, als eerste van de 2e ronde (soms aan het einde van 1e ronde) vanwege vroege levering",
    updatedAt: DEFAULT_LOGISTICS_FIXED_CUSTOMER_UPDATED_AT,
  },
  {
    id: "fixed:64398",
    customerNumbers: ["64398"],
    customerName: "Restaurant Steven",
    deliveryWindow: "10:00 - 14:00",
    address: "Stikke Hezelstraat 54 Nijmegen",
    routeNote:
      "Wordt met stadroute bezorgd, mag 2e ronde, meestal gecombineerd met Ziekerstraat, Credible, Brasserie Jan en andere centrum adressen",
    updatedAt: DEFAULT_LOGISTICS_FIXED_CUSTOMER_UPDATED_AT,
  },
  {
    id: "fixed:64404",
    customerNumbers: ["64404"],
    customerName: "Brasserie Jan",
    deliveryWindow: "10:00 - 14:00",
    address: "Grote Markt 32",
    routeNote:
      "Wordt met stadroute bezorgd, mag 2e ronde, meestal gecombineerd met Ziekerstraat, Credible, Restaurant Steven en andere centrum adressen",
    updatedAt: DEFAULT_LOGISTICS_FIXED_CUSTOMER_UPDATED_AT,
  },
  {
    id: "fixed:64408",
    customerNumbers: ["64408"],
    customerName: "Hotel Credible",
    deliveryWindow: "08:00 - 14:00",
    address: "Hertogstraat 1",
    routeNote:
      "Wordt met stadroute bezorgd, mag 2e ronde, meestal gecombineerd met Ziekerstraat, Brasserie Jan, Restaurant Steven en andere centrum adressen",
    updatedAt: DEFAULT_LOGISTICS_FIXED_CUSTOMER_UPDATED_AT,
  },
  {
    id: "fixed:64466",
    customerNumbers: ["64466"],
    customerName: "Food&I Locatie NXP",
    deliveryWindow: "08:00 - 10:00",
    address: "Gerstweg 2",
    routeNote: "Wordt na winkel Lent bezorgd op 1e route",
    updatedAt: DEFAULT_LOGISTICS_FIXED_CUSTOMER_UPDATED_AT,
  },
  {
    id: "fixed:64542",
    customerNumbers: ["64542"],
    customerName: "Blue by MANNA",
    deliveryWindow: "10:00 - 14:00",
    address: "Oranjesingel 14-20",
    routeNote:
      "Wordt met stadroute bezorgd, mag 2e ronde, meestal gecombineerd met Ziekerstraat, Brasserie Jan, Restaurant Steven en andere centrum adressen",
    updatedAt: DEFAULT_LOGISTICS_FIXED_CUSTOMER_UPDATED_AT,
  },
];

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

function emptyLogisticsRouteDraftsState(): LogisticsRouteDraftsState {
  return { drafts: [] };
}

function emptyLogisticsRouteLearningState(): LogisticsRouteLearningState {
  return { observations: [] };
}

function emptyLogisticsFixedCustomersState(): LogisticsFixedCustomersState {
  return {
    customers: DEFAULT_LOGISTICS_FIXED_CUSTOMERS,
    updatedAt: DEFAULT_LOGISTICS_FIXED_CUSTOMER_UPDATED_AT,
  };
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

function logisticsWebshopImageDuplicateKey(image: LogisticsWebshopImage) {
  const photoKey = image.photoUrl.startsWith("data:")
    ? image.photoUrl.slice(0, 4000)
    : image.photoUrl;

  return [
    image.deliveryDate,
    image.matchedReceiptId || image.matchedReceiptNumber || image.orderNumber,
    image.customerName,
    image.fileName,
    image.productSummary || "",
    photoKey,
  ]
    .filter(Boolean)
    .map((part) => part.trim().toLowerCase())
    .join("|");
}

function shouldPreferWebshopImageCandidate(
  candidate: LogisticsWebshopImage,
  existing: LogisticsWebshopImage
) {
  if (candidate.matchSource === "manual" && existing.matchSource !== "manual") {
    return true;
  }
  if (
    (candidate.matchedReceiptId || candidate.matchedReceiptNumber) &&
    !existing.matchedReceiptId &&
    !existing.matchedReceiptNumber
  ) {
    return true;
  }

  return candidate.importedAt > existing.importedAt;
}

function dedupeLogisticsWebshopImages(images: LogisticsWebshopImage[]) {
  const imageByKey = new Map<string, LogisticsWebshopImage>();

  images.forEach((image) => {
    const key = logisticsWebshopImageDuplicateKey(image) || image.id;
    const existing = imageByKey.get(key);

    if (!existing || shouldPreferWebshopImageCandidate(image, existing)) {
      imageByKey.set(key, image);
    }
  });

  return Array.from(imageByKey.values());
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

function isLogisticsLoadPressure(value: unknown): value is LogisticsLoadPressure {
  return value === "laag" || value === "middel" || value === "hoog";
}

function cleanStoredTime(value: unknown) {
  if (typeof value !== "string") return "";
  const match = value.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return "";

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return "";

  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function normalizeLogisticsTeamMembers(value: unknown): LogisticsTeamMember[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((member, index) => {
      if (!member || typeof member !== "object") return null;

      const record = member as { id?: unknown; name?: unknown };
      const name = typeof record.name === "string" ? record.name.trim() : "";
      if (!name) return null;

      const id = typeof record.id === "string" ? record.id.trim() : "";

      return {
        id: id || `persoon-${index + 1}`,
        name: name.slice(0, 80),
      };
    })
    .filter((member): member is LogisticsTeamMember => Boolean(member))
    .slice(0, 12);
}

function normalizeLogisticsDayOperations(
  value: unknown
): LogisticsDayOperations | undefined {
  if (!value || typeof value !== "object") return undefined;

  const record = value as {
    busDepartures?: Record<string, unknown>;
    teamStartTime?: unknown;
    teamEndTime?: unknown;
    teamMembers?: unknown;
  };
  const busA = cleanStoredTime(record.busDepartures?.A);
  const busB = cleanStoredTime(record.busDepartures?.B);
  const teamStartTime = cleanStoredTime(record.teamStartTime);
  const teamEndTime = cleanStoredTime(record.teamEndTime);
  const teamMembers = normalizeLogisticsTeamMembers(record.teamMembers);
  const operations: LogisticsDayOperations = {
    busDepartures: {
      ...(busA ? { A: busA } : {}),
      ...(busB ? { B: busB } : {}),
    },
    ...(teamStartTime ? { teamStartTime } : {}),
    ...(teamEndTime ? { teamEndTime } : {}),
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

function isLogisticsRouteDraftStop(
  value: unknown
): value is LogisticsRouteDraftStop {
  return Boolean(
    value &&
      typeof value === "object" &&
      typeof (value as LogisticsRouteDraftStop).id === "string" &&
      typeof (value as LogisticsRouteDraftStop).sourceId === "string" &&
      typeof (value as LogisticsRouteDraftStop).label === "string" &&
      typeof (value as LogisticsRouteDraftStop).detail === "string" &&
      Array.isArray((value as LogisticsRouteDraftStop).badges)
  );
}

function isLogisticsRouteDraftRound(
  value: unknown
): value is LogisticsRouteDraftRound {
  return Boolean(
    value &&
      typeof value === "object" &&
      typeof (value as LogisticsRouteDraftRound).id === "string" &&
      typeof (value as LogisticsRouteDraftRound).title === "string" &&
      typeof (value as LogisticsRouteDraftRound).vehicle === "string" &&
      Array.isArray((value as LogisticsRouteDraftRound).stops)
  );
}

function isLogisticsRouteDraft(value: unknown): value is LogisticsRouteDraft {
  return Boolean(
    value &&
      typeof value === "object" &&
      typeof (value as LogisticsRouteDraft).id === "string" &&
      typeof (value as LogisticsRouteDraft).date === "string" &&
      Array.isArray((value as LogisticsRouteDraft).routes)
  );
}

function isLogisticsRouteLearningKind(
  value: unknown
): value is LogisticsRouteLearningObservationStop["kind"] {
  return (
    value === "shop" ||
    value === "receipt" ||
    value === "ice" ||
    value === "check"
  );
}

function isLogisticsRouteLearningObservationStop(
  value: unknown
): value is LogisticsRouteLearningObservationStop {
  return Boolean(
    value &&
      typeof value === "object" &&
      typeof (value as LogisticsRouteLearningObservationStop).key === "string" &&
      typeof (value as LogisticsRouteLearningObservationStop).label ===
        "string" &&
      typeof (value as LogisticsRouteLearningObservationStop).target ===
        "string" &&
      isLogisticsRouteLearningKind(
        (value as LogisticsRouteLearningObservationStop).kind
      ) &&
      typeof (value as LogisticsRouteLearningObservationStop).vehicle ===
        "string" &&
      typeof (value as LogisticsRouteLearningObservationStop).routeId ===
        "string" &&
      typeof (value as LogisticsRouteLearningObservationStop).routeTitle ===
        "string" &&
      typeof (value as LogisticsRouteLearningObservationStop).position ===
        "number" &&
      Array.isArray((value as LogisticsRouteLearningObservationStop).badges)
  );
}

function isLogisticsRouteLearningObservation(
  value: unknown
): value is LogisticsRouteLearningObservation {
  return Boolean(
    value &&
      typeof value === "object" &&
      typeof (value as LogisticsRouteLearningObservation).id === "string" &&
      typeof (value as LogisticsRouteLearningObservation).date === "string" &&
      Array.isArray((value as LogisticsRouteLearningObservation).stops)
  );
}

function isLogisticsFixedCustomer(value: unknown): value is LogisticsFixedCustomer {
  return Boolean(
    value &&
      typeof value === "object" &&
      typeof (value as LogisticsFixedCustomer).id === "string" &&
      Array.isArray((value as LogisticsFixedCustomer).customerNumbers) &&
      typeof (value as LogisticsFixedCustomer).customerName === "string" &&
      typeof (value as LogisticsFixedCustomer).deliveryWindow === "string" &&
      typeof (value as LogisticsFixedCustomer).address === "string" &&
      typeof (value as LogisticsFixedCustomer).routeNote === "string" &&
      typeof (value as LogisticsFixedCustomer).updatedAt === "string"
  );
}

function cleanFixedCustomerText(value: unknown, maxLength = 500) {
  return String(value || "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function cleanFixedCustomerNumbers(value: unknown) {
  const rawValues = Array.isArray(value) ? value : String(value || "").split(",");
  const numbers = rawValues
    .flatMap((item) => String(item || "").match(/\d{2,}/g) || [])
    .map((item) => item.trim())
    .filter(Boolean);

  return Array.from(new Set(numbers));
}

function normalizeLogisticsFixedCustomer(
  value: unknown
): LogisticsFixedCustomer | null {
  if (!value || typeof value !== "object") return null;

  const raw = value as Partial<LogisticsFixedCustomer>;
  const customerNumbers = cleanFixedCustomerNumbers(raw.customerNumbers);
  const customerName = cleanFixedCustomerText(raw.customerName, 200);
  const deliveryWindow = cleanFixedCustomerText(raw.deliveryWindow, 180);
  const address = cleanFixedCustomerText(raw.address, 240);
  const routeNote = cleanFixedCustomerText(raw.routeNote, 800);
  const updatedAt = cleanFixedCustomerText(raw.updatedAt, 80) || new Date().toISOString();
  const id =
    cleanFixedCustomerText(raw.id, 160) ||
    `fixed:${customerNumbers.join("-") || customerName.toLowerCase()}`;

  if (!customerName && customerNumbers.length === 0) return null;

  return {
    id,
    customerNumbers,
    customerName,
    deliveryWindow,
    address,
    routeNote,
    updatedAt,
  };
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
    images: pruneExpiredWebshopImages(
      dedupeLogisticsWebshopImages(images.filter(isLogisticsWebshopImage))
    ),
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
    feedback: feedback.filter(isLogisticsDayFeedback).map((item) => ({
      ...item,
      pressureOverride: isLogisticsLoadPressure(item.pressureOverride)
        ? item.pressureOverride
        : "",
      operations: normalizeLogisticsDayOperations(item.operations),
    })),
  };
}

function normalizeLogisticsRouteDraftsState(
  value: unknown
): LogisticsRouteDraftsState {
  if (!value || typeof value !== "object") {
    return emptyLogisticsRouteDraftsState();
  }

  const drafts = (value as { drafts?: unknown }).drafts;
  if (!Array.isArray(drafts)) return emptyLogisticsRouteDraftsState();

  return {
    drafts: drafts
      .filter(isLogisticsRouteDraft)
      .map((draft) => ({
        ...draft,
        excludedSourceIds: Array.isArray(draft.excludedSourceIds)
          ? Array.from(
              new Set(
                draft.excludedSourceIds.filter(
                  (sourceId): sourceId is string => typeof sourceId === "string"
                )
              )
            )
          : [],
        routes: draft.routes.filter(isLogisticsRouteDraftRound).map((route) => ({
          ...route,
          stops: route.stops.filter(isLogisticsRouteDraftStop).map((stop) => ({
            ...stop,
            learningKey:
              typeof stop.learningKey === "string" ? stop.learningKey : undefined,
            learningLabel:
              typeof stop.learningLabel === "string"
                ? stop.learningLabel
                : undefined,
            learningTarget:
              typeof stop.learningTarget === "string"
                ? stop.learningTarget
                : undefined,
            learningKind: isLogisticsRouteLearningKind(stop.learningKind)
              ? stop.learningKind
              : undefined,
            badges: stop.badges.filter((badge): badge is string =>
              typeof badge === "string"
            ),
          })),
        })),
      })),
  };
}

function normalizeLogisticsRouteLearningState(
  value: unknown
): LogisticsRouteLearningState {
  if (!value || typeof value !== "object") {
    return emptyLogisticsRouteLearningState();
  }

  const observations = (value as { observations?: unknown }).observations;
  if (!Array.isArray(observations)) return emptyLogisticsRouteLearningState();

  return {
    observations: observations
      .filter(isLogisticsRouteLearningObservation)
      .map((observation) => ({
        ...observation,
        stops: observation.stops
          .filter(isLogisticsRouteLearningObservationStop)
          .map((stop) => ({
            ...stop,
            originalVehicle:
              typeof stop.originalVehicle === "string"
                ? stop.originalVehicle
                : undefined,
            originalRouteId:
              typeof stop.originalRouteId === "string"
                ? stop.originalRouteId
                : undefined,
            originalRouteTitle:
              typeof stop.originalRouteTitle === "string"
                ? stop.originalRouteTitle
                : undefined,
            originalPosition:
              typeof stop.originalPosition === "number" &&
              Number.isFinite(stop.originalPosition)
                ? stop.originalPosition
                : undefined,
            moved: stop.moved === true,
            badges: stop.badges.filter((badge): badge is string =>
              typeof badge === "string"
            ),
          })),
      })),
  };
}

function normalizeLogisticsFixedCustomersState(
  value: unknown
): LogisticsFixedCustomersState {
  if (!value || typeof value !== "object") {
    return emptyLogisticsFixedCustomersState();
  }

  const rawCustomers = (value as { customers?: unknown }).customers;
  const rawUpdatedAt = (value as { updatedAt?: unknown }).updatedAt;
  if (!Array.isArray(rawCustomers)) return emptyLogisticsFixedCustomersState();

  const customerById = new Map<string, LogisticsFixedCustomer>();
  rawCustomers
    .map((customer) =>
      isLogisticsFixedCustomer(customer)
        ? normalizeLogisticsFixedCustomer(customer)
        : normalizeLogisticsFixedCustomer(customer)
    )
    .forEach((customer) => {
      if (!customer) return;
      customerById.set(customer.id, customer);
    });
  const customers = Array.from(customerById.values()).slice(
    0,
    MAX_STORED_FIXED_CUSTOMERS
  );
  const updatedAt =
    cleanFixedCustomerText(rawUpdatedAt, 80) ||
    customers.reduce(
      (latest, customer) =>
        customer.updatedAt > latest ? customer.updatedAt : latest,
      ""
    ) ||
    new Date(0).toISOString();

  return { customers, updatedAt };
}

function toJson(
  value:
    | LogisticsState
    | LogisticsWebshopImagesState
    | LogisticsReceiptOverridesState
    | LogisticsDayFeedbackState
    | LogisticsRouteDraftsState
    | LogisticsRouteLearningState
    | LogisticsFixedCustomersState
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

function logisticsBatchStatusPriority(status: LogisticsBatch["status"]) {
  if (status === "definitief") return 4;
  if (status === "prognose") return 3;
  if (status === "handmatig") return 2;
  if (status === "historie") return 1;
  return 0;
}

function selectLogisticsBatchForDate(
  batches: LogisticsBatch[],
  date: string
) {
  return (
    batches
      .filter((batch) => batch.date === date)
      .sort((first, second) => {
        const statusCompare =
          logisticsBatchStatusPriority(second.status) -
          logisticsBatchStatusPriority(first.status);
        if (statusCompare !== 0) return statusCompare;

        return second.importedAt.localeCompare(first.importedAt);
      })[0] || null
  );
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

function sortRouteDrafts(drafts: LogisticsRouteDraft[]) {
  return [...drafts].sort((first, second) => {
    const dateCompare = second.date.localeCompare(first.date);
    if (dateCompare !== 0) return dateCompare;

    return second.updatedAt.localeCompare(first.updatedAt);
  });
}

function sortRouteLearningObservations(
  observations: LogisticsRouteLearningObservation[]
) {
  return [...observations].sort((first, second) => {
    const dateCompare = second.date.localeCompare(first.date);
    if (dateCompare !== 0) return dateCompare;

    return second.updatedAt.localeCompare(first.updatedAt);
  });
}

function mostCommonText(counts: Map<string, number>) {
  let bestValue = "";
  let bestCount = -1;

  counts.forEach((count, value) => {
    if (count > bestCount || (count === bestCount && value < bestValue)) {
      bestValue = value;
      bestCount = count;
    }
  });

  return bestValue;
}

function routeLearningKeyForDraftStop(stop: LogisticsRouteDraftStop) {
  if (stop.learningKey) return stop.learningKey;

  return normalizedReceiptText(`${stop.label} ${stop.detail}`)
    .replace(/\b(?:voor\s+)?\d{1,2}:\d{2}\b/g, " ")
    .replace(/\beur\s+\d+(?:[,.]\d+)?\b/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 220);
}

function routeLearningKindForDraftStop(
  stop: LogisticsRouteDraftStop
): LogisticsRouteLearningObservationStop["kind"] {
  if (isLogisticsRouteLearningKind(stop.learningKind)) return stop.learningKind;
  if (stop.badges.includes("winkel")) return "shop";
  if (stop.badges.includes("ijs")) return "ice";
  if (stop.sourceId.startsWith("check:")) return "check";

  return "receipt";
}

function routeLearningCorrectionWeight(
  stop: LogisticsRouteLearningObservationStop
) {
  return stop.moved ? 4 : 1;
}

function routeLearningObservationFromStoredDraft(
  draft: LogisticsRouteDraft
): LogisticsRouteLearningObservation {
  return {
    id: draft.date,
    date: draft.date,
    updatedAt: draft.updatedAt,
    stops: draft.routes.flatMap((route, routeIndex) =>
      route.stops
        .map((stop, stopIndex) => {
          const key = routeLearningKeyForDraftStop(stop);
          if (!key) return null;

          return {
            key,
            label: stop.learningLabel || stop.label,
            target: stop.learningTarget || stop.detail,
            kind: routeLearningKindForDraftStop(stop),
            vehicle: route.vehicle,
            routeId: route.id,
            routeTitle: route.title,
            position: routeIndex * 100 + stopIndex,
            badges: stop.badges,
          };
        })
        .filter(
          (stop): stop is LogisticsRouteLearningObservationStop =>
            Boolean(stop)
        )
    ),
  };
}

function summarizeLogisticsRouteLearning(
  state: LogisticsRouteLearningState
): LogisticsRouteLearning {
  type StopAggregate = {
    key: string;
    label: string;
    target: string;
    kind: LogisticsRouteLearningStop["kind"];
    samples: number;
    positionTotal: number;
    lastSeenAt: string;
    vehicleCounts: Map<string, number>;
    routeCounts: Map<string, number>;
  };
  type PairAggregate = {
    key: string;
    fromKey: string;
    toKey: string;
    fromLabel: string;
    toLabel: string;
    samples: number;
    lastSeenAt: string;
  };

  const stopAggregates = new Map<string, StopAggregate>();
  const pairAggregates = new Map<string, PairAggregate>();
  const observations = sortRouteLearningObservations(state.observations);

  observations.forEach((observation) => {
    observation.stops.forEach((stop) => {
      const existing = stopAggregates.get(stop.key);
      const correctionWeight = routeLearningCorrectionWeight(stop);
      const aggregate =
        existing ||
        ({
          key: stop.key,
          label: stop.label,
          target: stop.target,
          kind: stop.kind,
          samples: 0,
          positionTotal: 0,
          lastSeenAt: stop.routeId ? observation.updatedAt : "",
          vehicleCounts: new Map<string, number>(),
          routeCounts: new Map<string, number>(),
        } satisfies StopAggregate);

      aggregate.label = stop.label || aggregate.label;
      aggregate.target = stop.target || aggregate.target;
      aggregate.kind = stop.kind || aggregate.kind;
      aggregate.samples += 1;
      aggregate.positionTotal += Number.isFinite(stop.position)
        ? stop.position
        : 0;
      aggregate.lastSeenAt =
        observation.updatedAt > aggregate.lastSeenAt
          ? observation.updatedAt
          : aggregate.lastSeenAt;
      aggregate.vehicleCounts.set(
        stop.vehicle,
        (aggregate.vehicleCounts.get(stop.vehicle) || 0) + correctionWeight
      );
      aggregate.routeCounts.set(
        stop.routeId,
        (aggregate.routeCounts.get(stop.routeId) || 0) + correctionWeight
      );

      stopAggregates.set(stop.key, aggregate);
    });

    const stopsByRoute = new Map<string, LogisticsRouteLearningObservationStop[]>();
    observation.stops.forEach((stop) => {
      const routeStops = stopsByRoute.get(stop.routeId) || [];
      routeStops.push(stop);
      stopsByRoute.set(stop.routeId, routeStops);
    });

    stopsByRoute.forEach((routeStops) => {
      const sortedStops = [...routeStops].sort(
        (first, second) => first.position - second.position
      );

      sortedStops.forEach((stop, index) => {
        const nextStop = sortedStops[index + 1];
        if (!nextStop) return;

        const key = `${stop.key}->${nextStop.key}`;
        const pairWeight = stop.moved || nextStop.moved ? 2 : 1;
        const existing = pairAggregates.get(key);
        const aggregate =
          existing ||
          ({
            key,
            fromKey: stop.key,
            toKey: nextStop.key,
            fromLabel: stop.label,
            toLabel: nextStop.label,
            samples: 0,
            lastSeenAt: observation.updatedAt,
          } satisfies PairAggregate);

        aggregate.fromLabel = stop.label || aggregate.fromLabel;
        aggregate.toLabel = nextStop.label || aggregate.toLabel;
        aggregate.samples += pairWeight;
        aggregate.lastSeenAt =
          observation.updatedAt > aggregate.lastSeenAt
            ? observation.updatedAt
            : aggregate.lastSeenAt;

        pairAggregates.set(key, aggregate);
      });
    });
  });

  const stops: LogisticsRouteLearningStop[] = Array.from(
    stopAggregates.values()
  )
    .map((aggregate) => ({
      key: aggregate.key,
      label: aggregate.label,
      target: aggregate.target,
      kind: aggregate.kind,
      preferredVehicle: mostCommonText(aggregate.vehicleCounts),
      preferredRouteId: mostCommonText(aggregate.routeCounts),
      averagePosition: aggregate.samples
        ? aggregate.positionTotal / aggregate.samples
        : 0,
      samples: aggregate.samples,
      lastSeenAt: aggregate.lastSeenAt,
    }))
    .sort((first, second) => {
      const samplesCompare = second.samples - first.samples;
      if (samplesCompare !== 0) return samplesCompare;

      return second.lastSeenAt.localeCompare(first.lastSeenAt);
    })
    .slice(0, MAX_ROUTE_LEARNING_STOPS);

  const pairs: LogisticsRouteLearningPair[] = Array.from(
    pairAggregates.values()
  )
    .sort((first, second) => {
      const samplesCompare = second.samples - first.samples;
      if (samplesCompare !== 0) return samplesCompare;

      return second.lastSeenAt.localeCompare(first.lastSeenAt);
    })
    .slice(0, MAX_ROUTE_LEARNING_PAIRS);
  const updatedAt =
    observations.reduce(
      (latest, observation) =>
        observation.updatedAt > latest ? observation.updatedAt : latest,
      ""
    ) || new Date(0).toISOString();

  return {
    id: "system",
    stops,
    pairs,
    observationCount: observations.length,
    updatedAt,
  };
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

export async function readLogisticsRouteDraftsState() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", LOGISTICS_ROUTE_DRAFTS_SETTING_KEY)
    .maybeSingle();

  if (error || !data) return emptyLogisticsRouteDraftsState();

  return normalizeLogisticsRouteDraftsState(data.value);
}

export async function readLogisticsRouteLearningState() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", LOGISTICS_ROUTE_LEARNING_SETTING_KEY)
    .maybeSingle();

  if (error || !data) return emptyLogisticsRouteLearningState();

  return normalizeLogisticsRouteLearningState(data.value);
}

async function writeLogisticsFixedCustomersState(
  state: LogisticsFixedCustomersState
) {
  const supabase = createAdminClient();
  const { error } = await supabase.from("app_settings").upsert(
    {
      key: LOGISTICS_FIXED_CUSTOMERS_SETTING_KEY,
      value: toJson(state),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" }
  );

  if (error) throw new Error(error.message);
}

export async function readLogisticsFixedCustomersState() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", LOGISTICS_FIXED_CUSTOMERS_SETTING_KEY)
    .maybeSingle();

  if (error || !data) return emptyLogisticsFixedCustomersState();

  return normalizeLogisticsFixedCustomersState(data.value);
}

export async function getLogisticsBatchForDate(date: string) {
  const state = await readLogisticsState();

  return selectLogisticsBatchForDate(state.batches, date);
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

export async function getRecentLogisticsDayFeedback(
  beforeDate: string,
  limit = 8
) {
  const state = await readLogisticsDayFeedbackState();

  return sortDayFeedback(state.feedback)
    .filter((feedback) => feedback.date < beforeDate)
    .slice(0, Math.max(1, Math.min(30, limit)));
}

export async function getLogisticsRouteDraftForDate(date: string) {
  const state = await readLogisticsRouteDraftsState();

  return (
    sortRouteDrafts(state.drafts).find((draft) => draft.date === date) || null
  );
}

export async function getLogisticsRouteLearning() {
  const [state, routeDraftsState] = await Promise.all([
    readLogisticsRouteLearningState(),
    readLogisticsRouteDraftsState(),
  ]);
  const observedDates = new Set(
    state.observations.map((observation) => observation.date)
  );
  const draftObservations = routeDraftsState.drafts
    .filter((draft) => draft.isFinal === true && !observedDates.has(draft.date))
    .map(routeLearningObservationFromStoredDraft)
    .filter((observation) => observation.stops.length > 0);

  return summarizeLogisticsRouteLearning({
    observations: [...state.observations, ...draftObservations],
  });
}

export async function getLogisticsFixedCustomers() {
  const state = await readLogisticsFixedCustomersState();

  return state.customers;
}

export async function replaceLogisticsFixedCustomers(
  customers: LogisticsFixedCustomer[]
) {
  const updatedAt = new Date().toISOString();
  const state = normalizeLogisticsFixedCustomersState({
    customers: customers.map((customer) => ({
      ...customer,
      updatedAt: customer.updatedAt || updatedAt,
    })),
    updatedAt,
  });

  await writeLogisticsFixedCustomersState(state);

  return state.customers;
}

export async function upsertLogisticsBatch(batch: LogisticsBatch) {
  const state = await readLogisticsState();
  const compatibleBatches = state.batches.filter(
    (item) => item.date === batch.date && item.status === batch.status
  );
  const sameWaveCandidates = batch.importWaveId
    ? compatibleBatches.filter(
        (item) => item.importWaveId === batch.importWaveId
      )
    : [];
  const mergeCandidates =
    batch.importWaveId && sameWaveCandidates.length > 0
      ? sameWaveCandidates
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
        logisticsWebshopImageDuplicateKey(item) ===
        logisticsWebshopImageDuplicateKey(image)
    ) ||
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

export async function deleteLogisticsWebshopImage(imageId: string) {
  const state = await readLogisticsWebshopImagesState();
  const images = state.images.filter((item) => item.id !== imageId);

  await writeLogisticsWebshopImagesState({ images });
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

export async function upsertLogisticsRouteDraft(draft: LogisticsRouteDraft) {
  const state = await readLogisticsRouteDraftsState();
  const drafts = sortRouteDrafts([
    draft,
    ...state.drafts.filter((item) => item.id !== draft.id),
  ]).slice(0, MAX_STORED_ROUTE_DRAFTS);

  const nextState = { drafts };
  const supabase = createAdminClient();
  const { error } = await supabase.from("app_settings").upsert(
    {
      key: LOGISTICS_ROUTE_DRAFTS_SETTING_KEY,
      value: toJson(nextState),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" }
  );

  if (error) throw new Error(error.message);

  return draft;
}

export async function deleteLogisticsRouteDraft(date: string) {
  const state = await readLogisticsRouteDraftsState();
  const drafts = state.drafts.filter((item) => item.date !== date);

  const nextState = { drafts };
  const supabase = createAdminClient();
  const { error } = await supabase.from("app_settings").upsert(
    {
      key: LOGISTICS_ROUTE_DRAFTS_SETTING_KEY,
      value: toJson(nextState),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" }
  );

  if (error) throw new Error(error.message);
}

export async function upsertLogisticsRouteLearningObservation(
  observation: LogisticsRouteLearningObservation
) {
  const state = await readLogisticsRouteLearningState();
  const observations = sortRouteLearningObservations([
    observation,
    ...state.observations.filter((item) => item.id !== observation.id),
  ]).slice(0, MAX_STORED_ROUTE_LEARNING_OBSERVATIONS);

  const nextState = { observations };
  const supabase = createAdminClient();
  const { error } = await supabase.from("app_settings").upsert(
    {
      key: LOGISTICS_ROUTE_LEARNING_SETTING_KEY,
      value: toJson(nextState),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" }
  );

  if (error) throw new Error(error.message);

  return observation;
}

export async function deleteLogisticsRouteLearningObservation(date: string) {
  const state = await readLogisticsRouteLearningState();
  const observations = state.observations.filter((item) => item.date !== date);

  const nextState = { observations };
  const supabase = createAdminClient();
  const { error } = await supabase.from("app_settings").upsert(
    {
      key: LOGISTICS_ROUTE_LEARNING_SETTING_KEY,
      value: toJson(nextState),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" }
  );

  if (error) throw new Error(error.message);
}
