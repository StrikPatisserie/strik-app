import type { Metadata } from "next";
import type { ComponentProps } from "react";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { loadProductionB2BOrders } from "../../sinterklaas/sinterklaasServerApi";
import { buildProductionTotals } from "../../sinterklaas/b2b/productionTotals";
import { orderBelongsToSeason } from "../../lib/businessSeasons";
import { businessDeliveryWindow } from "../../lib/businessOrderDeliveries";
import ProductionTotalsPreview from "./ProductionTotalsPreview";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Productie opteller · B2B preview · Strik",
  robots: { index: false, follow: false },
};

export default async function B2BProductionPreviewPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  // This owner-operated prototype never exists on a production deployment.
  // Run next dev on 127.0.0.1. No write API or server action is exposed here.
  if (process.env.NODE_ENV !== "development") notFound();
  const host = (await headers()).get("host") || "";
  if (!/^(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(host)) notFound();
  const season = (await searchParams).season === "kerst" ? "kerst" : "sint";
  let preview: ComponentProps<typeof ProductionTotalsPreview>;
  try {
    const orders = (await loadProductionB2BOrders("2026")).filter(order => order.status === "akkoord" && !order.cancelled && !order.id.startsWith("historie-") && orderBelongsToSeason(order, season));
    const totals = buildProductionTotals(orders, season, "2026");
    const rows = orders.map(order => {
      const window = businessDeliveryWindow(order as unknown as Record<string, unknown>);
      const summary = totals.products.flatMap(product => product.allocations.filter(item => item.orderId === order.id).map(item => `${item.quantity}× ${product.product}`)).join(" · ");
      return { id: order.id, customer: order.customerName, date: window?.start || "", end: window?.end || "", complete: order.productionDone || order.packed || order.delivered, summary: summary || (order.letterLines.length ? `${order.letterLines.reduce((sum, line) => sum + line.quantity, 0)} chocoladeletters · letterplanning` : "Producten bekijken in de bestelling") };
    }).sort((a, b) => (a.date || "9999").localeCompare(b.date || "9999") || a.customer.localeCompare(b.customer, "nl"));
    preview = { rows, totals, season };
  } catch {
    preview = { rows: [], totals: { products: [], orderCount: 0, skippedLetters: 0, issues: [] }, season, error: "De definitieve B2B-orders konden niet worden ingelezen. Probeer opnieuw." };
  }
  return <ProductionTotalsPreview {...preview} />;
}
