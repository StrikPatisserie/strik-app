import { rememberB2BContacts } from "@/app/lib/businessFolderContacts";
import {withLogoCounts} from "@/app/sinterklaas/b2b/logos/counts.server";
import { withProductionReadiness } from "@/app/sinterklaas/letters/productie/productionReadiness.server";
import {
  proxySinterklaasGet,
  proxySinterklaasMutation,
} from "@/app/sinterklaas/sinterklaasServerApi";
import { NextResponse } from "next/server";
import { b2bOrderHistory } from "../sinterklaas-mailing/orderHistory";
import { b2bOrderHistoryExtra } from "../sinterklaas-mailing/orderHistoryExtra";
import { historicalBusinessDeliveryDate } from "@/app/lib/businessDeliveryMoment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ENDPOINT = "sinterklaas-b2b-orders";

export async function GET(request: Request) {
  const response = await withProductionReadiness(await proxySinterklaasGet(request, ENDPOINT), new URL(request.url).searchParams.get("year") || String(new Date().getFullYear()), "b2b");
  if (!response.ok) return response;
  const data = await response.clone().json().catch(() => ({}));
  const year = new URL(request.url).searchParams.get("year") || String(new Date().getFullYear());
  const existing = await withLogoCounts(Array.isArray(data.orders) ? data.orders : [],year);
  const existingIds = new Set(existing.map((order: { id?: string }) => order.id));
  const historical = [...b2bOrderHistory, ...b2bOrderHistoryExtra]
    .filter((order) => order.year === year && !existingIds.has(order.id))
    .map((order) => {
      const deliveryDate = historicalBusinessDeliveryDate(order.date, order.year);
      const sourceDeliveryDate = deliveryDate ? "" : order.date.trim();
      return { id:order.id,year:order.year,season:order.season,customerName:order.customerName,contactName:"",customerEmail:"",phone:"",deliveryDate,sourceDeliveryDate,productionDate:"",department:"beide",orderText:order.orderText,logo:"",packaging:"",importantNotes:order.notes,priceAgreement:order.price,totalExVat:order.total,deliveryMethod:order.delivery,deliveryAddress:"",invoiceInfo:"",source:"excel",sourceSheet:order.sourceSheet,entered:true,productionDone:true,packed:true,delivered:true,cancelled:false,productionDoneAt:"",packedAt:"",deliveredAt:"",reminderEmailedAt:"",reminderEmailError:"",createdAt:"",updatedAt:"" };
    });
  return NextResponse.json({ ...data, orders: [...existing, ...historical], total: existing.length + historical.length });
}

async function saveWithContact(request: Request, method: "POST" | "PATCH") {
  const response = await proxySinterklaasMutation(request, ENDPOINT, method);
  if (!response.ok) return response;
  const data = await response.clone().json().catch(() => null);
  const order = data?.order || data;
  try {
    if (order?.id && order?.customerEmail) await rememberB2BContacts([order]);
  } catch {
    // The order is already saved; do not invite a duplicate order/mail retry.
    // Loading the mailing list retries contact capture from canonical orders.
    console.error("B2B-contact wordt opnieuw bewaard bij het laden van de mailinglijst.");
  }
  return response;
}

export async function POST(request: Request) {
  return saveWithContact(request, "POST");
}

export async function PATCH(request: Request) {
  return saveWithContact(request, "PATCH");
}

export async function DELETE(request: Request) {
  return proxySinterklaasMutation(request, ENDPOINT, "DELETE");
}
