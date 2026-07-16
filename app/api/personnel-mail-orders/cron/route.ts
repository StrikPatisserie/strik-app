import { NextResponse } from "next/server";
import {
  flattenPersonnelMailOrderGroups,
  getPersonnelMailOrderGroups,
  sendPersonnelMailOrders,
} from "../../../strik-agenda/personnelMailOrders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CRON_KEY =
  process.env.PERSONNEL_MAIL_CRON_KEY ||
  process.env.WORDPRESS_PERSONNEL_MAIL_ORDERS_API_KEY ||
  process.env.WORDPRESS_CUPCAKE_ORDERS_API_KEY ||
  process.env.WORDPRESS_STRIK_API_KEY ||
  "schoonmaak-ijs-strik";

function isAllowedCronRequest(request: Request) {
  const url = new URL(request.url);
  const key = url.searchParams.get("key");
  if (key && key === CRON_KEY) return true;

  const userAgent = request.headers.get("user-agent") || "";
  const schedule = request.headers.get("x-vercel-cron-schedule") || "";

  return userAgent.includes("vercel-cron/1.0") && Boolean(schedule);
}

function getErrorStatus(error: unknown) {
  return typeof error === "object" &&
    error !== null &&
    "status" in error &&
    typeof error.status === "number"
    ? error.status
    : 502;
}

export async function GET(request: Request) {
  if (!isAllowedCronRequest(request)) {
    return NextResponse.json(
      { message: "Geen toegang tot personeelsmail cron." },
      { status: 403 }
    );
  }

  try {
    const groups = await getPersonnelMailOrderGroups(request);
    const orders = flattenPersonnelMailOrderGroups(groups);
    const result = await sendPersonnelMailOrders(orders);

    return NextResponse.json({
      ok: true,
      groups,
      orders,
      ...result,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "Personeelsmail cron is mislukt.",
      },
      { status: getErrorStatus(error) === 403 ? 403 : 502 }
    );
  }
}
