import { NextResponse } from "next/server";
import { hasFullAccess } from "@/app/lib/auth/access";
import { getCurrentProfile } from "@/app/lib/auth/session";
import { SpecsPlazaClient, SpecsPlazaError } from "@/app/lib/specsplaza/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
const headers = { "Cache-Control": "no-store" };

export async function GET(request: Request) {
  const profile = await getCurrentProfile();
  if (!hasFullAccess(profile)) {
    return NextResponse.json({ message: "Alleen managers kunnen SpecsPlaza-specificaties bekijken." }, { status: 403, headers });
  }
  const id = new URL(request.url).searchParams.get("id") || "";
  if (!/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(id)) {
    return NextResponse.json({ message: "Kies een geldig SpecsPlaza-product uit de zoekresultaten." }, { status: 400, headers });
  }
  try {
    const result = await new SpecsPlazaClient().getProductSpecification(id);
    return NextResponse.json(result, { headers });
  } catch (error) {
    return NextResponse.json({ message: error instanceof SpecsPlazaError ? error.message : "De productspecificatie kon niet worden opgehaald. Probeer opnieuw." }, { status: error instanceof SpecsPlazaError ? error.status : 502, headers });
  }
}
