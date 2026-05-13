import {
  getTamigoStatusCode,
  getTodayStaffSchedule,
} from "../../tamigoApi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getErrorMessage(error: unknown, status: number) {
  if (status === 403) {
    return "Tamigo gaf 403 op de rooster-route. Controleer of de API key shift/rooster rechten heeft.";
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Tamigo rooster ophalen is mislukt.";
}

export async function GET() {
  try {
    return Response.json(await getTodayStaffSchedule(), {
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
