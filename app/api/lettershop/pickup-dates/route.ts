import { getLettershopPickupDateOptions } from "@/app/lettershop/getPickupDates";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const options = await getLettershopPickupDateOptions();
    const dates = options.map((option) => option.date);
    const deadlines = Object.fromEntries(
      options.map((option) => [option.date, option.deadlineAt])
    );
    return Response.json(
      { dates, deadlines },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return Response.json(
      { message: "Beschikbare afhaaldatums konden niet worden geladen." },
      { status: 503 }
    );
  }
}
