import { getCurrentProfile } from "@/app/lib/auth/session";
import { hasFullAccess } from "@/app/lib/auth/access";
import { getTamigoHoursDayStatus, getTamigoHoursReviewMonth } from "@/app/management/urencontrole/reviewServer";
import { monthBounds } from "@/app/management/urencontrole/reviewTime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
const headers = { "Cache-Control": "private, no-store", Pragma: "no-cache" };
export async function GET(request: Request) {
  if (!hasFullAccess(await getCurrentProfile())) return Response.json({ message: "Alleen bevoegde beheerders kunnen urenregistraties inzien." }, { status: 403, headers });
  const url = new URL(request.url);
  try {
    if (url.searchParams.get("mode") === "day-status") {
      const department = url.searchParams.get("department") || "", date = url.searchParams.get("date") || "";
      if (!/^[0-9a-f-]{36}$/i.test(department) || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date) return Response.json({ message: "Ongeldige afdeling of datum." }, { status: 400, headers });
      return Response.json(await getTamigoHoursDayStatus(department, date), { headers });
    }
    const month = url.searchParams.get("month") || "";
    const period = url.searchParams.get("period") || "calendar";
    if (period !== "calendar" && period !== "payroll") return Response.json({ message: "Kies kalendermaand of loonperiode." }, { status: 400, headers });
    try { monthBounds(month); } catch { return Response.json({ message: "Kies een geldige maand." }, { status: 400, headers }); }
    return Response.json(await getTamigoHoursReviewMonth(month, period), { headers });
  } catch {
    return Response.json({ message: "De urencontrole kon niet geladen worden. Er zijn geen registraties gewijzigd." }, { status: 502, headers });
  }
}
