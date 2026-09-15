import { proxySinterklaasGet, proxySinterklaasMutation } from "@/app/sinterklaas/sinterklaasServerApi";
import { NextResponse } from "next/server";
import { b2bCustomers2024 } from "./seed2024";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const ENDPOINT = "sinterklaas-mailing";

export async function GET(request: Request) {
  const response = await proxySinterklaasGet(request, ENDPOINT);
  if (!response.ok) return response;
  const data = await response.clone().json().catch(() => ({}));
  if (Array.isArray(data.customers) && data.customers.length) return response;
  return NextResponse.json({ ...data, customers: b2bCustomers2024, needsImport: true });
}
export async function POST(request: Request) { return proxySinterklaasMutation(request, ENDPOINT, "POST"); }
export async function PATCH(request: Request) { return proxySinterklaasMutation(request, ENDPOINT, "PATCH"); }
export async function DELETE(request: Request) { return proxySinterklaasMutation(request, ENDPOINT, "DELETE"); }
