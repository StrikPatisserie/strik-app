import { getLettershopPickupDates } from "@/app/lettershop/getPickupDates";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const dates = await getLettershopPickupDates();
    return Response.json({ dates }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json(
      { message: "Beschikbare afhaaldatums konden niet worden geladen." },
      { status: 503 }
    );
  }
}
