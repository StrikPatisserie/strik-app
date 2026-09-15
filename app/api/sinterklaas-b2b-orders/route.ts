import {
  proxySinterklaasGet,
  proxySinterklaasMutation,
} from "@/app/sinterklaas/sinterklaasServerApi";
import { NextResponse } from "next/server";
import { b2bOrderHistory } from "../sinterklaas-mailing/orderHistory";
import { b2bOrderHistoryExtra } from "../sinterklaas-mailing/orderHistoryExtra";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ENDPOINT = "sinterklaas-b2b-orders";

export async function GET(request: Request) {
  const response = await proxySinterklaasGet(request, ENDPOINT);
  if (!response.ok) return response;
  const data = await response.clone().json().catch(() => ({}));
  const year = new URL(request.url).searchParams.get("year") || String(new Date().getFullYear());
  const existing = Array.isArray(data.orders) ? data.orders : [];
  const existingIds = new Set(existing.map((order: { id?: string }) => order.id));
  const historical = [...b2bOrderHistory, ...b2bOrderHistoryExtra]
    .filter((order) => order.season === "sint" && order.year === year && !existingIds.has(order.id))
    .map((order) => {
      const match = order.date.match(/(\d{1,2})\D+(\d{1,2})/);
      const deliveryDate = match ? `${order.year}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}` : "";
      return { id:order.id,year:order.year,season:"sint",customerName:order.customerName,contactName:"",customerEmail:"",phone:"",deliveryDate,productionDate:"",department:"beide",orderText:order.orderText,logo:"",packaging:"",importantNotes:order.notes,priceAgreement:order.price,totalExVat:order.total,deliveryMethod:order.delivery,deliveryAddress:"",invoiceInfo:"",source:"excel",sourceSheet:order.sourceSheet,entered:true,productionDone:true,packed:true,delivered:true,cancelled:false,productionDoneAt:"",packedAt:"",deliveredAt:"",reminderEmailedAt:"",reminderEmailError:"",createdAt:"",updatedAt:"" };
    });
  return NextResponse.json({ ...data, orders: [...existing, ...historical], total: existing.length + historical.length });
}

export async function POST(request: Request) {
  return proxySinterklaasMutation(request, ENDPOINT, "POST");
}

export async function PATCH(request: Request) {
  return proxySinterklaasMutation(request, ENDPOINT, "PATCH");
}

export async function DELETE(request: Request) {
  return proxySinterklaasMutation(request, ENDPOINT, "DELETE");
}
