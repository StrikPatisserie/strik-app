import {
  PersonnelAgendaEvent,
  PersonnelCupcakeDeliveryShift,
  getLastEmployeeShiftOnOrBeforeDate,
  getPersonnelAgenda,
} from "../tamigoApi";
import {
  TeamAgendaEvent,
  normalizeTeamAgenda,
} from "./teamAgendaApi";
import {
  formatJubileeYears,
  getAnniversaryYears,
  getPersonnelEventOccurrenceDate,
  isCupcakeJubileeYear,
  isImportantJubileeYear,
} from "./personnelJubilees";

export type PersonnelMailOrderType =
  | "cupcake-jubilee"
  | "major-jubilee"
  | "birthday-cake"
  | "cash-deposit-summary"
  | "wedding-cake-payment-request";

export type PersonnelMailOrder = {
  id: string;
  mailType: PersonnelMailOrderType;
  employeeName: string;
  firstName: string;
  years?: number;
  yearsLabel?: string;
  anniversaryDate?: string;
  anniversaryDateLabel?: string;
  birthdayDate?: string;
  birthdayDateLabel?: string;
  eventDate: string;
  eventDateLabel: string;
  daysUntil: number;
  source: "tamigo" | "drive";
  recipients: string[];
  ccRecipients?: string[];
  subject: string;
  body: string;
  deliveryShop: string;
  deliveryDate: string;
  deliveryDateLabel: string;
  deliveryTimeLabel: string;
  note: string;
};

export type PersonnelMailOrderKind = "cupcakes" | "majorJubilees" | "birthdays";

export type PersonnelMailOrderGroups = Record<
  PersonnelMailOrderKind,
  PersonnelMailOrder[]
>;

export const WORDPRESS_PERSONNEL_MAIL_ORDERS_API_URL =
  "https://strik-patisserie.nl/wp-json/strik/v1/personnel-mail-orders";
export const WORDPRESS_CUPCAKE_ORDERS_API_URL =
  "https://strik-patisserie.nl/wp-json/strik/v1/cupcake-orders";

const WORDPRESS_PERSONNEL_MAIL_ORDERS_API_KEY =
  process.env.WORDPRESS_PERSONNEL_MAIL_ORDERS_API_KEY ||
  process.env.WORDPRESS_CUPCAKE_ORDERS_API_KEY ||
  process.env.WORDPRESS_STRIK_API_KEY ||
  "schoonmaak-ijs-strik";
const CUPCAKE_RECIPIENTS = splitRecipients(
  process.env.CUPCAKE_JUBILEE_RECIPIENTS || "info@strik-patisserie.nl"
);
const BIRTHDAY_CAKE_RECIPIENTS = splitRecipients(
  process.env.BIRTHDAY_CAKE_RECIPIENTS || "info@strik-patisserie.nl"
);
const MANAGEMENT_RECIPIENTS = splitRecipients(
  process.env.PERSONNEL_CELEBRATION_RECIPIENTS ||
    "roos@strik-patisserie.nl,feline@strik-patisserie.nl,eva@strik-patisserie.nl"
);
const CUPCAKE_LOOKAHEAD_DAYS = getPositiveNumber(
  process.env.CUPCAKE_JUBILEE_LOOKAHEAD_DAYS,
  14
);
const MAJOR_JUBILEE_LOOKAHEAD_DAYS = getPositiveNumber(
  process.env.MAJOR_JUBILEE_MAIL_LOOKAHEAD_DAYS,
  14
);
const BIRTHDAY_LOOKAHEAD_DAYS = getPositiveNumber(
  process.env.BIRTHDAY_CAKE_MAIL_LOOKAHEAD_DAYS,
  5
);
const WORK_SHIFT_LOOKBACK_DAYS = getPositiveNumber(
  process.env.PERSONNEL_EVENT_SHIFT_LOOKBACK_DAYS,
  2
);

function getPositiveNumber(value: string | undefined, fallback: number) {
  const numberValue = Number(value);

  return Number.isFinite(numberValue) && numberValue > 0
    ? numberValue
    : fallback;
}

function splitRecipients(value: string) {
  return value
    .split(",")
    .map((recipient) => recipient.trim())
    .filter(Boolean);
}

export function getWordPressPersonnelMailOrdersUrl(
  endpoint: "personnel" | "cupcake" = "personnel"
) {
  const url = new URL(
    endpoint === "cupcake"
      ? WORDPRESS_CUPCAKE_ORDERS_API_URL
      : WORDPRESS_PERSONNEL_MAIL_ORDERS_API_URL
  );
  url.searchParams.set("key", WORDPRESS_PERSONNEL_MAIL_ORDERS_API_KEY);

  return url;
}

function parseDate(value: string | undefined) {
  const match = value?.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (!match) return null;

  const date = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3])
  );
  date.setHours(0, 0, 0, 0);

  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatDateLabel(value: string) {
  const date = parseDate(value);
  if (!date) return value;

  return date.toLocaleDateString("nl-NL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function getToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return today;
}

function getDaysUntil(date: Date, today = getToday()) {
  const millisecondsPerDay = 24 * 60 * 60 * 1000;

  return Math.round((date.getTime() - today.getTime()) / millisecondsPerDay);
}

function isWithinWindow(daysUntil: number, lookaheadDays: number) {
  return daysUntil >= 0 && daysUntil <= lookaheadDays;
}

function normalizeKeyPart(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getFirstName(employeeName: string) {
  return employeeName.trim().split(/\s+/)[0] || employeeName;
}

function createCupcakeOrderId(
  employeeName: string,
  years: number,
  anniversaryDate: string
) {
  return `cupcake-${normalizeKeyPart(employeeName)}-${anniversaryDate}-${formatJubileeYears(
    years
  ).replace(",", "-")}`;
}

function createMailOrderId(
  mailType: PersonnelMailOrderType,
  employeeName: string,
  eventDate: string,
  qualifier: string
) {
  return `personnel-${mailType}-${normalizeKeyPart(
    employeeName
  )}-${eventDate}-${normalizeKeyPart(qualifier)}`;
}

function toDeliveryFields(deliveryShift: PersonnelCupcakeDeliveryShift | null) {
  if (!deliveryShift) {
    return {
      deliveryShop: "Onbekend",
      deliveryDate: "",
      deliveryDateLabel: "Geen dienst gevonden",
      deliveryTimeLabel: "",
    };
  }

  return {
    deliveryShop: deliveryShift.shop,
    deliveryDate: deliveryShift.date,
    deliveryDateLabel: deliveryShift.dateLabel,
    deliveryTimeLabel: deliveryShift.timeLabel,
  };
}

function getWorkNote(
  deliveryShift: PersonnelCupcakeDeliveryShift | null,
  eventLabel: "verjaardag" | "jubileum"
) {
  if (!deliveryShift) {
    return `Let op: mogelijk niet aan het werk op of rondom ${eventLabel}. Er is geen geplande dienst gevonden op de dag zelf of maximaal ${WORK_SHIFT_LOOKBACK_DAYS} dagen ervoor.`;
  }

  return `Werkmoment gevonden op of voor de ${eventLabel}.`;
}

function formatWorkBlock(
  order: Pick<
    PersonnelMailOrder,
    | "deliveryShop"
    | "deliveryDateLabel"
    | "deliveryTimeLabel"
    | "deliveryDate"
    | "note"
  >
) {
  const workLine = order.deliveryDate
    ? `${order.deliveryDateLabel} - ${order.deliveryShop}${
        order.deliveryTimeLabel ? ` (${order.deliveryTimeLabel})` : ""
      }`
    : "Geen geplande dienst gevonden.";

  return ["Werkmoment:", workLine, order.note].filter(Boolean).join("\n");
}

function createCupcakeBody(order: PersonnelMailOrder) {
  return [
    "Graag een jubileumcupcake maken.",
    "",
    `Naam: ${order.employeeName}`,
    `Jubileum: ${order.yearsLabel} jaar in dienst`,
    `Cupcake foto/tekst: ${order.yearsLabel}`,
    `Jubileumdatum: ${order.eventDateLabel}`,
    `Meegeven/bezorgen naar: ${order.deliveryShop || "Onbekend"}`,
    `Voor dienst op: ${order.deliveryDateLabel || "Geen dienst gevonden"}`,
    order.deliveryTimeLabel ? `Diensttijd: ${order.deliveryTimeLabel}` : "",
    "",
    order.note,
    "",
    "Automatisch verstuurd vanuit de Strik Team app.",
    `Order-id: ${order.id}`,
  ]
    .filter((line) => line !== "")
    .join("\n");
}

function createMajorJubileeBody(order: PersonnelMailOrder) {
  return [
    `Let op: over 2 weken is het jubileum van ${order.employeeName}.`,
    "",
    `${order.employeeName} is op ${order.eventDateLabel} ${order.yearsLabel} jaar in dienst bij Strik.`,
    "",
    formatWorkBlock(order),
    "",
    "Automatische herinnering vanuit de Strik Team app.",
    `Order-id: ${order.id}`,
  ].join("\n");
}

function createBirthdayBody(order: PersonnelMailOrder) {
  return [
    "Verjaardags nougatinetaartje bestellen.",
    "",
    `Naam: ${order.employeeName}`,
    `Verjaardag: ${order.eventDateLabel}`,
    `Tekst op taartje: Gefeliciteerd ${order.firstName}`,
    "Afzender: liefs van Strik",
    "",
    formatWorkBlock(order),
    "",
    "Automatisch verstuurd vanuit de Strik Team app.",
    `Order-id: ${order.id}`,
  ].join("\n");
}

async function findDeliveryShift(
  employeeId: string | undefined,
  employeeName: string,
  eventDate: string
) {
  return getLastEmployeeShiftOnOrBeforeDate(
    employeeId,
    employeeName,
    eventDate,
    WORK_SHIFT_LOOKBACK_DAYS
  );
}

async function fetchDriveEvents(request: Request) {
  const origin = new URL(request.url).origin;
  const response = await fetch(
    `${origin}/api/personnel-sheet-agenda?view=management`,
    { cache: "no-store" }
  );
  const data = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) return [];

  return normalizeTeamAgenda(data).events.filter(
    (event) => event.source === "sheet"
  );
}

function getDriveEventDate(event: TeamAgendaEvent) {
  const occurrenceDate = getPersonnelEventOccurrenceDate(event);
  if (!occurrenceDate) return null;

  return {
    date: event.occurrenceDate || formatDateKey(occurrenceDate),
    occurrenceDate,
    daysUntil: getDaysUntil(occurrenceDate),
  };
}

function getDriveEmployeeName(event: TeamAgendaEvent) {
  if (event.employeeName) return event.employeeName;

  return event.title
    .replace(/\s+(is jarig|\d+(?:[,.]5)?\s*jaar.*)$/i, "")
    .trim();
}

async function toCupcakeOrderFromPersonnelEvent(
  event: PersonnelAgendaEvent
): Promise<PersonnelMailOrder | null> {
  if (
    !isCupcakeJubileeYear(event.years) ||
    !isWithinWindow(event.daysUntil, CUPCAKE_LOOKAHEAD_DAYS)
  ) {
    return null;
  }

  const years = event.years || 0;
  const deliveryShift = await findDeliveryShift(
    event.employeeId,
    event.employeeName,
    event.occurrenceDate
  );
  const deliveryFields = toDeliveryFields(deliveryShift);
  const order: PersonnelMailOrder = {
    id: createCupcakeOrderId(event.employeeName, years, event.occurrenceDate),
    mailType: "cupcake-jubilee",
    employeeName: event.employeeName,
    firstName: getFirstName(event.employeeName),
    years,
    yearsLabel: formatJubileeYears(years),
    anniversaryDate: event.occurrenceDate,
    anniversaryDateLabel: formatDateLabel(event.occurrenceDate),
    eventDate: event.occurrenceDate,
    eventDateLabel: formatDateLabel(event.occurrenceDate),
    daysUntil: event.daysUntil,
    source: "tamigo",
    recipients: CUPCAKE_RECIPIENTS,
    subject: `Cupcake jubileum - ${event.employeeName} - ${formatJubileeYears(
      years
    )} jaar`,
    body: "",
    ...deliveryFields,
    note: getWorkNote(deliveryShift, "jubileum"),
  };

  return { ...order, body: createCupcakeBody(order) };
}

async function toMajorJubileeOrderFromPersonnelEvent(
  event: PersonnelAgendaEvent
): Promise<PersonnelMailOrder | null> {
  if (
    !isImportantJubileeYear(event.years) ||
    !isWithinWindow(event.daysUntil, MAJOR_JUBILEE_LOOKAHEAD_DAYS)
  ) {
    return null;
  }

  const years = event.years || 0;
  const deliveryShift = await findDeliveryShift(
    event.employeeId,
    event.employeeName,
    event.occurrenceDate
  );
  const deliveryFields = toDeliveryFields(deliveryShift);
  const yearsLabel = formatJubileeYears(years);
  const order: PersonnelMailOrder = {
    id: createMailOrderId(
      "major-jubilee",
      event.employeeName,
      event.occurrenceDate,
      yearsLabel
    ),
    mailType: "major-jubilee",
    employeeName: event.employeeName,
    firstName: getFirstName(event.employeeName),
    years,
    yearsLabel,
    anniversaryDate: event.occurrenceDate,
    anniversaryDateLabel: formatDateLabel(event.occurrenceDate),
    eventDate: event.occurrenceDate,
    eventDateLabel: formatDateLabel(event.occurrenceDate),
    daysUntil: event.daysUntil,
    source: "tamigo",
    recipients: MANAGEMENT_RECIPIENTS,
    subject: `Let op: jubileum ${event.employeeName} - ${yearsLabel} jaar`,
    body: "",
    ...deliveryFields,
    note: getWorkNote(deliveryShift, "jubileum"),
  };

  return { ...order, body: createMajorJubileeBody(order) };
}

async function toBirthdayOrderFromPersonnelEvent(
  event: PersonnelAgendaEvent
): Promise<PersonnelMailOrder | null> {
  if (!isWithinWindow(event.daysUntil, BIRTHDAY_LOOKAHEAD_DAYS)) {
    return null;
  }

  const deliveryShift = await findDeliveryShift(
    event.employeeId,
    event.employeeName,
    event.occurrenceDate
  );
  const deliveryFields = toDeliveryFields(deliveryShift);
  const order: PersonnelMailOrder = {
    id: createMailOrderId(
      "birthday-cake",
      event.employeeName,
      event.occurrenceDate,
      "verjaardag"
    ),
    mailType: "birthday-cake",
    employeeName: event.employeeName,
    firstName: getFirstName(event.employeeName),
    birthdayDate: event.occurrenceDate,
    birthdayDateLabel: formatDateLabel(event.occurrenceDate),
    eventDate: event.occurrenceDate,
    eventDateLabel: formatDateLabel(event.occurrenceDate),
    daysUntil: event.daysUntil,
    source: "tamigo",
    recipients: BIRTHDAY_CAKE_RECIPIENTS,
    subject: `Verjaardagstaartje - ${event.employeeName}`,
    body: "",
    ...deliveryFields,
    note: getWorkNote(deliveryShift, "verjaardag"),
  };

  return { ...order, body: createBirthdayBody(order) };
}

async function toCupcakeOrderFromDriveEvent(
  event: TeamAgendaEvent
): Promise<PersonnelMailOrder | null> {
  const years = getAnniversaryYears(event);
  if (!isCupcakeJubileeYear(years)) return null;

  const eventDate = getDriveEventDate(event);
  if (!eventDate || !isWithinWindow(eventDate.daysUntil, CUPCAKE_LOOKAHEAD_DAYS)) {
    return null;
  }

  const employeeName = getDriveEmployeeName(event);
  const deliveryShift = await findDeliveryShift(
    event.employeeId,
    employeeName,
    eventDate.date
  );
  const deliveryFields = toDeliveryFields(deliveryShift);
  const order: PersonnelMailOrder = {
    id: createCupcakeOrderId(employeeName, years || 0, eventDate.date),
    mailType: "cupcake-jubilee",
    employeeName,
    firstName: getFirstName(employeeName),
    years: years || 0,
    yearsLabel: formatJubileeYears(years || 0),
    anniversaryDate: eventDate.date,
    anniversaryDateLabel: formatDateLabel(eventDate.date),
    eventDate: eventDate.date,
    eventDateLabel: formatDateLabel(eventDate.date),
    daysUntil: eventDate.daysUntil,
    source: "drive",
    recipients: CUPCAKE_RECIPIENTS,
    subject: `Cupcake jubileum - ${employeeName} - ${formatJubileeYears(
      years || 0
    )} jaar`,
    body: "",
    ...deliveryFields,
    note: deliveryShift
      ? getWorkNote(deliveryShift, "jubileum")
      : "Medewerker komt uit de Drive personeelslijst; geen Tamigo-dienst gevonden op de dag zelf of maximaal 2 dagen ervoor.",
  };

  return { ...order, body: createCupcakeBody(order) };
}

async function toMajorJubileeOrderFromDriveEvent(
  event: TeamAgendaEvent
): Promise<PersonnelMailOrder | null> {
  const years = getAnniversaryYears(event);
  if (!isImportantJubileeYear(years)) return null;

  const eventDate = getDriveEventDate(event);
  if (
    !eventDate ||
    !isWithinWindow(eventDate.daysUntil, MAJOR_JUBILEE_LOOKAHEAD_DAYS)
  ) {
    return null;
  }

  const employeeName = getDriveEmployeeName(event);
  const deliveryShift = await findDeliveryShift(
    event.employeeId,
    employeeName,
    eventDate.date
  );
  const deliveryFields = toDeliveryFields(deliveryShift);
  const yearsLabel = formatJubileeYears(years || 0);
  const order: PersonnelMailOrder = {
    id: createMailOrderId(
      "major-jubilee",
      employeeName,
      eventDate.date,
      yearsLabel
    ),
    mailType: "major-jubilee",
    employeeName,
    firstName: getFirstName(employeeName),
    years: years || 0,
    yearsLabel,
    anniversaryDate: eventDate.date,
    anniversaryDateLabel: formatDateLabel(eventDate.date),
    eventDate: eventDate.date,
    eventDateLabel: formatDateLabel(eventDate.date),
    daysUntil: eventDate.daysUntil,
    source: "drive",
    recipients: MANAGEMENT_RECIPIENTS,
    subject: `Let op: jubileum ${employeeName} - ${yearsLabel} jaar`,
    body: "",
    ...deliveryFields,
    note: deliveryShift
      ? getWorkNote(deliveryShift, "jubileum")
      : "Medewerker komt uit de Drive personeelslijst; geen Tamigo-dienst gevonden op de dag zelf of maximaal 2 dagen ervoor.",
  };

  return { ...order, body: createMajorJubileeBody(order) };
}

async function toBirthdayOrderFromDriveEvent(
  event: TeamAgendaEvent
): Promise<PersonnelMailOrder | null> {
  if (event.type !== "birthday") return null;

  const eventDate = getDriveEventDate(event);
  if (!eventDate || !isWithinWindow(eventDate.daysUntil, BIRTHDAY_LOOKAHEAD_DAYS)) {
    return null;
  }

  const employeeName = getDriveEmployeeName(event);
  const deliveryShift = await findDeliveryShift(
    event.employeeId,
    employeeName,
    eventDate.date
  );
  const deliveryFields = toDeliveryFields(deliveryShift);
  const order: PersonnelMailOrder = {
    id: createMailOrderId(
      "birthday-cake",
      employeeName,
      eventDate.date,
      "verjaardag"
    ),
    mailType: "birthday-cake",
    employeeName,
    firstName: getFirstName(employeeName),
    birthdayDate: eventDate.date,
    birthdayDateLabel: formatDateLabel(eventDate.date),
    eventDate: eventDate.date,
    eventDateLabel: formatDateLabel(eventDate.date),
    daysUntil: eventDate.daysUntil,
    source: "drive",
    recipients: BIRTHDAY_CAKE_RECIPIENTS,
    subject: `Verjaardagstaartje - ${employeeName}`,
    body: "",
    ...deliveryFields,
    note: deliveryShift
      ? getWorkNote(deliveryShift, "verjaardag")
      : "Medewerker komt uit de Drive personeelslijst; geen Tamigo-dienst gevonden op de dag zelf of maximaal 2 dagen ervoor.",
  };

  return { ...order, body: createBirthdayBody(order) };
}

function dedupeOrders(orders: PersonnelMailOrder[]) {
  const ordersByKey = new Map<string, PersonnelMailOrder>();

  for (const order of orders) {
    const key = `${order.mailType}-${normalizeKeyPart(order.employeeName)}-${
      order.eventDate
    }-${order.yearsLabel || ""}`;
    const existing = ordersByKey.get(key);

    if (!existing || existing.source === "drive") {
      ordersByKey.set(key, order);
    }
  }

  return [...ordersByKey.values()].sort((first, second) => {
    const dateDiff = first.eventDate.localeCompare(second.eventDate);
    if (dateDiff !== 0) return dateDiff;

    const typeDiff = first.mailType.localeCompare(second.mailType);
    if (typeDiff !== 0) return typeDiff;

    return first.employeeName.localeCompare(second.employeeName);
  });
}

export async function getPersonnelMailOrderGroups(
  request: Request
): Promise<PersonnelMailOrderGroups> {
  const [tamigoAgenda, driveEvents] = await Promise.all([
    getPersonnelAgenda(),
    fetchDriveEvents(request),
  ]);

  const [
    tamigoCupcakes,
    tamigoMajorJubilees,
    tamigoBirthdays,
    driveCupcakes,
    driveMajorJubilees,
    driveBirthdays,
  ] = await Promise.all([
    Promise.all(tamigoAgenda.anniversaries.map(toCupcakeOrderFromPersonnelEvent)),
    Promise.all(
      tamigoAgenda.anniversaries.map(toMajorJubileeOrderFromPersonnelEvent)
    ),
    Promise.all(tamigoAgenda.birthdays.map(toBirthdayOrderFromPersonnelEvent)),
    Promise.all(
      driveEvents
        .filter((event) => event.type === "anniversary")
        .map(toCupcakeOrderFromDriveEvent)
    ),
    Promise.all(
      driveEvents
        .filter((event) => event.type === "anniversary")
        .map(toMajorJubileeOrderFromDriveEvent)
    ),
    Promise.all(
      driveEvents
        .filter((event) => event.type === "birthday")
        .map(toBirthdayOrderFromDriveEvent)
    ),
  ]);

  return {
    cupcakes: dedupeOrders(
      [...tamigoCupcakes, ...driveCupcakes].filter(
        (order): order is PersonnelMailOrder => order !== null
      )
    ),
    majorJubilees: dedupeOrders(
      [...tamigoMajorJubilees, ...driveMajorJubilees].filter(
        (order): order is PersonnelMailOrder => order !== null
      )
    ),
    birthdays: dedupeOrders(
      [...tamigoBirthdays, ...driveBirthdays].filter(
        (order): order is PersonnelMailOrder => order !== null
      )
    ),
  };
}

export function flattenPersonnelMailOrderGroups(groups: PersonnelMailOrderGroups) {
  return [...groups.cupcakes, ...groups.majorJubilees, ...groups.birthdays];
}

export function getPersonnelMailOrderSettings() {
  return {
    cupcakeLookaheadDays: CUPCAKE_LOOKAHEAD_DAYS,
    majorJubileeLookaheadDays: MAJOR_JUBILEE_LOOKAHEAD_DAYS,
    birthdayLookaheadDays: BIRTHDAY_LOOKAHEAD_DAYS,
    workShiftLookbackDays: WORK_SHIFT_LOOKBACK_DAYS,
    cupcakeRecipients: CUPCAKE_RECIPIENTS,
    birthdayCakeRecipients: BIRTHDAY_CAKE_RECIPIENTS,
    managementRecipients: MANAGEMENT_RECIPIENTS,
  };
}

async function readWordPressResponse(response: Response) {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

export function getWordPressPersonnelMailErrorMessage(status: number) {
  if (status === 403) {
    return "Geen toegang tot WordPress personeelsmail. Controleer de API sleutel.";
  }

  if (status === 404) {
    return "WordPress personeelsmail-route is nog niet beschikbaar. Werk de snippet bij.";
  }

  return "Personeelsmail versturen via WordPress lukt nog niet.";
}

export async function sendPersonnelMailOrders(orders: PersonnelMailOrder[]) {
  if (orders.length === 0) {
    return {
      wordpress: null,
      sent: [],
      skipped: [],
      failed: [],
    };
  }

  const response = await fetch(getWordPressPersonnelMailOrdersUrl(), {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ orders }),
  });
  const wordpress = await readWordPressResponse(response);

  if (!response.ok) {
    const error = new Error(getWordPressPersonnelMailErrorMessage(response.status));
    (error as Error & { status?: number }).status = response.status;
    (error as Error & { wordpress?: unknown }).wordpress = wordpress;
    throw error;
  }

  return {
    wordpress,
    sent: (wordpress as { sent?: unknown[] } | null)?.sent || [],
    skipped: (wordpress as { skipped?: unknown[] } | null)?.skipped || [],
    failed: (wordpress as { failed?: unknown[] } | null)?.failed || [],
  };
}
