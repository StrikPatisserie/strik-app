import { NextResponse } from "next/server";
import type { LogisticsFixedCustomer } from "@/app/bakkerij/logistiek/logisticsTypes";
import { canAccessLogisticsRequest } from "@/app/lib/bakeryLogisticsAuth";
import {
  getLogisticsFixedCustomers,
  replaceLogisticsFixedCustomers,
} from "@/app/lib/bakeryLogisticsStorage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, message }, { status });
}

function cleanText(value: unknown, maxLength = 500) {
  return String(value || "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function cleanCustomerNumbers(value: unknown) {
  const rawValues = Array.isArray(value) ? value : String(value || "").split(",");
  const numbers = rawValues
    .flatMap((item) => String(item || "").match(/\d{2,}/g) || [])
    .map((item) => item.trim())
    .filter(Boolean);

  return Array.from(new Set(numbers));
}

function stableCustomerId(customerNumbers: string[], customerName: string) {
  if (customerNumbers.length) return `fixed:${customerNumbers.join("-")}`;

  return `fixed:${customerName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}

function cleanFixedCustomer(value: unknown): LogisticsFixedCustomer | null {
  if (!value || typeof value !== "object") return null;

  const raw = value as Record<string, unknown>;
  const customerNumbers = cleanCustomerNumbers(
    raw.customerNumbers || raw.customerNumber || raw["Afleveradres nummer"]
  );
  const customerName = cleanText(raw.customerName || raw.Klantnaam, 200);
  const deliveryWindow = cleanText(
    raw.deliveryWindow || raw["Levertijd (tenzij op de bon anders aangegeven)"],
    180
  );
  const address = cleanText(raw.address || raw.Adres, 240);
  const routeNote = cleanText(raw.routeNote || raw["Opmerking route"], 800);
  const updatedAt = new Date().toISOString();
  const id = cleanText(raw.id, 160) || stableCustomerId(customerNumbers, customerName);

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

export async function GET(request: Request) {
  if (!(await canAccessLogisticsRequest(request))) {
    return jsonError("Geen toegang tot bakkerij logistiek.", 403);
  }

  try {
    const customers = await getLogisticsFixedCustomers();

    return NextResponse.json({
      ok: true,
      customers,
      count: customers.length,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "Vaste klanten ophalen is mislukt.",
      },
      { status: 502 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;

    if (!(await canAccessLogisticsRequest(request, cleanText(body.key, 200)))) {
      return jsonError("Geen toegang tot bakkerij logistiek.", 403);
    }

    const rawCustomers = body.customers;
    if (!Array.isArray(rawCustomers)) {
      return jsonError("Geen geldige vaste-klantenlijst ontvangen.");
    }

    const customerById = new Map<string, LogisticsFixedCustomer>();
    rawCustomers
      .map(cleanFixedCustomer)
      .forEach((customer) => {
        if (!customer) return;
        customerById.set(customer.id, customer);
      });
    const customers = await replaceLogisticsFixedCustomers(
      Array.from(customerById.values())
    );

    return NextResponse.json({
      ok: true,
      customers,
      count: customers.length,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "Vaste klanten opslaan is mislukt.",
      },
      { status: 502 }
    );
  }
}
