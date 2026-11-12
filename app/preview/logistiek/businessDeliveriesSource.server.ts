import "server-only";

import { readFile } from "node:fs/promises";
import { getSupabasePublicConfig } from "../../lib/supabase/config";
import { businessWeek, validBusinessDate, type BusinessDelivery } from "../../lib/businessOrderDeliveries";

export async function readLocalBusinessDeliveries(request: Request) {
  const source = process.env.STRIK_PLANNING_PREVIEW_SOURCE;
  const url = new URL(request.url);
  if (
    process.env.NODE_ENV !== "development"
    || !source
    || getSupabasePublicConfig().isConfigured
    || request.method !== "GET"
    || !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
  ) return null;

  const date = url.searchParams.get("date") || "";
  if (!validBusinessDate(date)) return null;

  try {
    const documents = JSON.parse(await readFile(source, "utf8")) as {
      key: string;
      data?: BusinessDelivery[];
      updated_at?: string;
    }[];
    const snapshot = documents.find(document => document.key === "logistics-business-deliveries");
    if (!Array.isArray(snapshot?.data) || !snapshot.updated_at) return null;
    const week = businessWeek(date);
    const planning = url.searchParams.get("planning") === "1";
    const orders = snapshot.data.filter(order => {
      if (!validBusinessDate(order.start) || !validBusinessDate(order.end)) return false;
      if (planning) return true;
      const pickup = /afhal|afhaal|ophal|gehaald|haalt|halen/i.test(order.deliveryMethod);
      return order.start <= week.end && !(pickup && !order.deliveryUnclear);
    }).map(order => ({
      ...order,
      overdue: order.end < date,
      onSelectedDay: order.start <= date && order.end >= date,
    }));
    return {
      selectedDate: date,
      week,
      orders,
      canManage: { sint: false, kerst: false },
      previewUpdatedAt: snapshot.updated_at,
    };
  } catch {
    return null;
  }
}
