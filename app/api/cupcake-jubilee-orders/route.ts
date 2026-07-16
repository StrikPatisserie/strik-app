import { NextResponse } from "next/server";
import {
  getPersonnelMailOrderGroups,
  getPersonnelMailOrderSettings,
  getWordPressPersonnelMailOrdersUrl,
} from "../../strik-agenda/personnelMailOrders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function readWordPressResponse(response: Response) {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function getWordPressErrorMessage(status: number) {
  if (status === 403) {
    return "Geen toegang tot WordPress cupcake-mail. Controleer de API sleutel.";
  }

  if (status === 404) {
    return "WordPress cupcake-route is nog niet beschikbaar. Activeer de cupcake snippet.";
  }

  return "Cupcake-mail versturen via WordPress lukt nog niet.";
}

export async function GET(request: Request) {
  try {
    const groups = await getPersonnelMailOrderGroups(request);

    return NextResponse.json({
      orders: groups.cupcakes,
      count: groups.cupcakes.length,
      lookaheadDays: getPersonnelMailOrderSettings().cupcakeLookaheadDays,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Cupcake jubilea ophalen is mislukt.",
      },
      { status: 502 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const groups = await getPersonnelMailOrderGroups(request);
    const orders = groups.cupcakes;

    if (orders.length === 0) {
      return NextResponse.json({
        orders,
        sent: [],
        skipped: [],
        message: "Geen cupcake-jubilea om te bestellen.",
      });
    }

    const response = await fetch(getWordPressPersonnelMailOrdersUrl("cupcake"), {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ orders }),
    });
    const data = await readWordPressResponse(response);

    if (!response.ok) {
      return NextResponse.json(
        {
          orders,
          message: getWordPressErrorMessage(response.status),
          wordpressStatus: response.status,
        },
        { status: response.status === 403 ? 403 : 502 }
      );
    }

    return NextResponse.json({
      orders,
      wordpress: data,
      sent: (data as { sent?: unknown[] } | null)?.sent || [],
      skipped: (data as { skipped?: unknown[] } | null)?.skipped || [],
      failed: (data as { failed?: unknown[] } | null)?.failed || [],
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Cupcake jubilea bestellen is mislukt.",
      },
      { status: 502 }
    );
  }
}
