import { NextResponse } from "next/server";
import {
  PersonnelAgendaEvent,
  PersonnelCupcakeDeliveryShift,
  getLastEmployeeShiftOnOrBeforeDate,
  getPersonnelAgenda,
} from "../../tamigoApi";
import type { TeamAgendaEvent } from "../../strik-agenda/teamAgendaApi";
import { normalizeTeamAgenda } from "../../strik-agenda/teamAgendaApi";
import {
  formatJubileeYears,
  getAnniversaryYears,
  getPersonnelEventOccurrenceDate,
  isCupcakeJubileeYear,
} from "../../strik-agenda/personnelJubilees";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WORDPRESS_CUPCAKE_ORDERS_API_URL =
  "https://strik-patisserie.nl/wp-json/strik/v1/cupcake-orders";
const WORDPRESS_CUPCAKE_ORDERS_API_KEY =
  process.env.WORDPRESS_CUPCAKE_ORDERS_API_KEY ||
  process.env.WORDPRESS_STRIK_API_KEY ||
  "schoonmaak-ijs-strik";
const ORDER_LOOKAHEAD_DAYS = getPositiveNumber(
  process.env.CUPCAKE_JUBILEE_LOOKAHEAD_DAYS,
  14
);
const SHIFT_LOOKBACK_DAYS = getPositiveNumber(
  process.env.CUPCAKE_JUBILEE_SHIFT_LOOKBACK_DAYS,
  21
);

type CupcakeJubileeOrder = {
  id: string;
  employeeName: string;
  years: number;
  yearsLabel: string;
  anniversaryDate: string;
  anniversaryDateLabel: string;
  daysUntil: number;
  source: "tamigo" | "drive";
  deliveryShop: string;
  deliveryDate: string;
  deliveryDateLabel: string;
  deliveryTimeLabel: string;
  note: string;
};

function getPositiveNumber(value: string | undefined, fallback: number) {
  const numberValue = Number(value);

  return Number.isFinite(numberValue) && numberValue > 0
    ? numberValue
    : fallback;
}

function getWordPressCupcakeOrdersUrl() {
  const url = new URL(WORDPRESS_CUPCAKE_ORDERS_API_URL);
  url.searchParams.set("key", WORDPRESS_CUPCAKE_ORDERS_API_KEY);

  return url;
}

function parseDate(value: string) {
  const match = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (!match) return null;

  const date = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3])
  );
  date.setHours(0, 0, 0, 0);

  return Number.isNaN(date.getTime()) ? null : date;
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

function formatDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(date.getDate()).padStart(2, "0")}`;
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

function normalizeOrderKeyPart(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function createOrderId(
  employeeName: string,
  years: number,
  anniversaryDate: string
) {
  return `cupcake-${normalizeOrderKeyPart(employeeName)}-${anniversaryDate}-${formatJubileeYears(
    years
  ).replace(",", "-")}`;
}

function isWithinOrderWindow(daysUntil: number) {
  return daysUntil >= 0 && daysUntil <= ORDER_LOOKAHEAD_DAYS;
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

async function toTamigoCupcakeOrder(
  event: PersonnelAgendaEvent
): Promise<CupcakeJubileeOrder | null> {
  if (!isCupcakeJubileeYear(event.years) || !isWithinOrderWindow(event.daysUntil)) {
    return null;
  }

  const deliveryShift = await getLastEmployeeShiftOnOrBeforeDate(
    event.employeeId,
    event.employeeName,
    event.occurrenceDate,
    SHIFT_LOOKBACK_DAYS
  );
  const years = event.years || 0;

  return {
    id: createOrderId(event.employeeName, years, event.occurrenceDate),
    employeeName: event.employeeName,
    years,
    yearsLabel: formatJubileeYears(years),
    anniversaryDate: event.occurrenceDate,
    anniversaryDateLabel: formatDateLabel(event.occurrenceDate),
    daysUntil: event.daysUntil,
    source: "tamigo",
    ...toDeliveryFields(deliveryShift),
    note: deliveryShift
      ? "Laatste geplande dienst op of voor het jubileum gevonden in Tamigo."
      : "Geen geplande dienst gevonden op of voor het jubileum.",
  };
}

async function fetchDriveAgendaEvents(request: Request) {
  const origin = new URL(request.url).origin;
  const response = await fetch(
    `${origin}/api/personnel-sheet-agenda?view=management`,
    { cache: "no-store" }
  );
  const data = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) return [];

  return normalizeTeamAgenda(data).events.filter(
    (event) => event.source === "sheet" && event.type === "anniversary"
  );
}

function toDriveCupcakeOrder(event: TeamAgendaEvent): CupcakeJubileeOrder | null {
  const years = getAnniversaryYears(event);
  if (!isCupcakeJubileeYear(years)) return null;

  const occurrenceDate = getPersonnelEventOccurrenceDate(event);
  if (!occurrenceDate) return null;

  const daysUntil = getDaysUntil(occurrenceDate);
  if (!isWithinOrderWindow(daysUntil)) return null;

  const anniversaryDate =
    event.occurrenceDate || formatDateKey(occurrenceDate);
  const employeeName = event.employeeName || event.title.split(/\s+\d/)[0].trim();

  return {
    id: createOrderId(employeeName, years || 0, anniversaryDate),
    employeeName,
    years: years || 0,
    yearsLabel: formatJubileeYears(years || 0),
    anniversaryDate,
    anniversaryDateLabel: formatDateLabel(anniversaryDate),
    daysUntil,
    source: "drive",
    deliveryShop: "Onbekend",
    deliveryDate: "",
    deliveryDateLabel: "Niet in Tamigo",
    deliveryTimeLabel: "",
    note: "Medewerker komt uit de Drive personeelslijst; geen Tamigo-dienst gevonden.",
  };
}

function dedupeOrders(orders: CupcakeJubileeOrder[]) {
  const ordersByKey = new Map<string, CupcakeJubileeOrder>();

  for (const order of orders) {
    const key = `${normalizeOrderKeyPart(order.employeeName)}-${
      order.anniversaryDate
    }-${order.yearsLabel}`;
    const existing = ordersByKey.get(key);

    if (!existing || existing.deliveryShop === "Onbekend") {
      ordersByKey.set(key, order);
    }
  }

  return [...ordersByKey.values()].sort((first, second) => {
    const dateDiff = first.anniversaryDate.localeCompare(second.anniversaryDate);
    if (dateDiff !== 0) return dateDiff;

    return first.employeeName.localeCompare(second.employeeName);
  });
}

async function getCupcakeOrders(request: Request) {
  const [tamigoAgenda, driveEvents] = await Promise.all([
    getPersonnelAgenda(),
    fetchDriveAgendaEvents(request),
  ]);
  const tamigoOrders = await Promise.all(
    tamigoAgenda.anniversaries.map(toTamigoCupcakeOrder)
  );
  const driveOrders = driveEvents.map(toDriveCupcakeOrder);

  return dedupeOrders(
    [...tamigoOrders, ...driveOrders].filter(
      (order): order is CupcakeJubileeOrder => order !== null
    )
  );
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

function getWordPressErrorMessage(status: number) {
  if (status === 403) {
    return "Geen toegang tot WordPress cupcake-mail. Controleer de API sleutel.";
  }

  if (status === 404) {
    return "WordPress cupcake-route is nog niet beschikbaar. Activeer de cupcake snippet.";
  }

  return "Cupcake-mail versturen via WordPress lukt nog niet.";
}

export async function GET(request: Request) {
  try {
    const orders = await getCupcakeOrders(request);

    return NextResponse.json({
      orders,
      count: orders.length,
      lookaheadDays: ORDER_LOOKAHEAD_DAYS,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Cupcake jubilea ophalen is mislukt.",
      },
      { status: 502 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const orders = await getCupcakeOrders(request);

    if (orders.length === 0) {
      return NextResponse.json({
        orders,
        sent: [],
        skipped: [],
        message: "Geen cupcake-jubilea om te bestellen.",
      });
    }

    const response = await fetch(getWordPressCupcakeOrdersUrl(), {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ orders }),
    });
    const data = await readWordPressResponse(response);

    if (!response.ok) {
      return NextResponse.json(
        {
          orders,
          message: getWordPressErrorMessage(response.status),
          wordpressStatus: response.status,
        },
        { status: response.status === 403 ? 403 : 502 }
      );
    }

    return NextResponse.json({
      orders,
      wordpress: data,
      sent: (data as { sent?: unknown[] } | null)?.sent || [],
      skipped: (data as { skipped?: unknown[] } | null)?.skipped || [],
      failed: (data as { failed?: unknown[] } | null)?.failed || [],
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Cupcake jubilea bestellen is mislukt.",
      },
      { status: 502 }
    );
  }
}
