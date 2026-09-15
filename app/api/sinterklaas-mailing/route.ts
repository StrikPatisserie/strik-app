import { proxySinterklaasGet, proxySinterklaasMutation } from "@/app/sinterklaas/sinterklaasServerApi";
import { NextResponse } from "next/server";
import { b2bCustomers2024 } from "./seed2024";
import { b2bOrderHistory } from "./orderHistory";
import { b2bOrderHistoryExtra } from "./orderHistoryExtra";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const ENDPOINT = "sinterklaas-mailing";

export async function GET(request: Request) {
  const response = await proxySinterklaasGet(request, ENDPOINT);
  if (!response.ok) return response;
  const data = await response.clone().json().catch(() => ({}));
  const history = [...b2bOrderHistory, ...b2bOrderHistoryExtra];
  if (Array.isArray(data.customers) && data.customers.length) return NextResponse.json({ ...data, history });
  return NextResponse.json({ ...data, customers: b2bCustomers2024, history, needsImport: true });
}
export async function POST(request: Request) { return proxySinterklaasMutation(request, ENDPOINT, "POST"); }
export async function PATCH(request: Request) { return proxySinterklaasMutation(request, ENDPOINT, "PATCH"); }
export async function DELETE(request: Request) { return proxySinterklaasMutation(request, ENDPOINT, "DELETE"); }
