import {
  getTamigoStatusCode,
  getWeekLaborCostSchedule,
} from "../../tamigoApi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getWeekOffset(request: Request) {
  const url = new URL(request.url);
  const value = Number(url.searchParams.get("weekOffset") || "0");

  if (!Number.isFinite(value)) return 0;

  return Math.max(-12, Math.min(26, Math.trunc(value)));
}

function getErrorMessage(error: unknown, status: number) {
  if (status === 403) {
    return "Tamigo gaf 403 op de loonkosten-route. Controleer de API-rechten voor diensten en medewerkersgegevens.";
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Tamigo loonkosten ophalen is mislukt.";
}

export async function GET(request: Request) {
  try {
    return Response.json(await getWeekLaborCostSchedule(getWeekOffset(request)), {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const status = getTamigoStatusCode(error);

    return Response.json(
      { message: getErrorMessage(error, status) },
      { status }
    );
  }
}
