import { NextResponse } from "next/server";
import { hasFullAccess } from "@/app/lib/auth/access";
import { getCurrentProfile } from "@/app/lib/auth/session";
import { SpecsPlazaClient, SpecsPlazaError } from "@/app/lib/specsplaza/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 90;

export async function POST() {
  const profile = await getCurrentProfile();
  if (!hasFullAccess(profile)) {
    return NextResponse.json({ message: "Alleen managers kunnen de SpecsPlaza-koppeling testen." }, { status: 403 });
  }
  try {
    const result = await new SpecsPlazaClient().testConnection();
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({
      message: error instanceof SpecsPlazaError ? error.message : "De SpecsPlaza-verbindingstest is mislukt. Probeer opnieuw.",
    }, { status: error instanceof SpecsPlazaError ? error.status : 502, headers: { "Cache-Control": "no-store" } });
  }
}
