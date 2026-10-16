import { NextResponse } from "next/server";
import { hasFullAccess } from "@/app/lib/auth/access";
import { getCurrentProfile } from "@/app/lib/auth/session";
import { SpecsPlazaClient, SpecsPlazaError } from "@/app/lib/specsplaza/client";
import type { SpecsPlazaSearchField } from "@/app/lib/specsplaza/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 90;
const headers = { "Cache-Control": "no-store" };

export async function GET(request: Request) {
  const profile = await getCurrentProfile();
  if (!hasFullAccess(profile)) {
    return NextResponse.json({ message: "Alleen managers kunnen in SpecsPlaza zoeken." }, { status: 403, headers });
  }
  const params = new URL(request.url).searchParams;
  const query = (params.get("q") || "").trim();
  const field = params.get("field") || "name";
  const skip = params.get("skip") || "0";
  if (query.length < 2 || query.length > 120 ||
      !["name", "articleNumber", "supplierCompanyName"].includes(field) ||
      !/^\d{1,6}$/.test(skip) || Number(skip) > 100_000) {
    return NextResponse.json({ message: "Vul een zoekterm van 2 tot 120 tekens in en kies een geldig zoekveld." }, { status: 400, headers });
  }
  try {
    const result = await new SpecsPlazaClient().searchProducts(query, field as SpecsPlazaSearchField, Number(skip));
    return NextResponse.json(result, { headers });
  } catch (error) {
    return NextResponse.json({ message: error instanceof SpecsPlazaError ? error.message : "Zoeken in SpecsPlaza is mislukt. Probeer opnieuw." }, { status: error instanceof SpecsPlazaError ? error.status : 502, headers });
  }
}
