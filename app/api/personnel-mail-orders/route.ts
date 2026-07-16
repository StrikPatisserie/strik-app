import { NextResponse } from "next/server";
import {
  flattenPersonnelMailOrderGroups,
  getPersonnelMailOrderGroups,
  getPersonnelMailOrderSettings,
  sendPersonnelMailOrders,
} from "../../strik-agenda/personnelMailOrders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getErrorStatus(error: unknown) {
  return typeof error === "object" &&
    error !== null &&
    "status" in error &&
    typeof error.status === "number"
    ? error.status
    : 502;
}

export async function GET(request: Request) {
  try {
    const groups = await getPersonnelMailOrderGroups(request);
    const orders = flattenPersonnelMailOrderGroups(groups);

    return NextResponse.json({
      groups,
      orders,
      count: orders.length,
      settings: getPersonnelMailOrderSettings(),
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Personeelsmails ophalen is mislukt.",
      },
      { status: 502 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const groups = await getPersonnelMailOrderGroups(request);
    const orders = flattenPersonnelMailOrderGroups(groups);
    const result = await sendPersonnelMailOrders(orders);

    return NextResponse.json({
      groups,
      orders,
      ...result,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Personeelsmails versturen is mislukt.",
      },
      { status: getErrorStatus(error) === 403 ? 403 : 502 }
    );
  }
}
