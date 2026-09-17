import Link from "next/link";
import { requireAdminProfile } from "@/app/lib/auth/session";
import { createAdminClient } from "@/app/lib/supabase/admin";
import { StrikPageHeader, StrikShell, strikIcons } from "@/app/StrikUI";
import { formatPickupDate } from "@/app/lettershop/formatPickupDate";

export const dynamic = "force-dynamic";

type Product = { letter: string; flavour: string; size: string; style: string };
type Item = { id: string; quantity: number; letter_products: Product | Product[] | null; letter_orders: { order_number: string; channel: string; customer_name: string; requested_date: string; fulfillment_status: string } | null };
type Allocation = { id: string; batch_id: string; planned_quantity: number; letter_order_items: Item | null };
type StockTarget = { id: string; batch_id: string; planned_quantity: number; letter_products: Product | Product[] | null };
type Part = { allocation_id: string | null; stock_target_id: string | null; quantity: number };
type Batch = { id: string; production_date: string; status: string };

function productOf(value: Product | Product[] | null) {
  return Array.isArray(value) ? value[0] : value;
}

function productKey(product: Product | undefined | null) {
  return product ? `${product.flavour} · ${product.letter} · ${product.size} · ${product.style}` : "Onbekend product";
}

export default async function CentralLetterProductionPage() {
  await requireAdminProfile();
  const db = createAdminClient();
  const [batchesResult, allocationsResult, targetsResult, partsResult, itemsResult] = await Promise.all([
    db.from("letter_production_batches").select("id,production_date,status").order("production_date"),
    db.from("letter_production_allocations").select("id,batch_id,planned_quantity,letter_order_items(id,quantity,letter_products(letter,flavour,size,style),letter_orders(order_number,channel,customer_name,requested_date,fulfillment_status))"),
    db.from("letter_stock_targets").select("id,batch_id,planned_quantity,letter_products(letter,flavour,size,style)"),
    db.from("letter_production_registration_parts").select("allocation_id,stock_target_id,quantity"),
    db.from("letter_order_items").select("id,quantity,letter_orders(order_number,channel,customer_name,requested_date,fulfillment_status)").order("created_at", { ascending: false }),
  ]);
  const error = [batchesResult, allocationsResult, targetsResult, partsResult, itemsResult].find((result) => result.error)?.error;
  const batches = (batchesResult.data || []) as Batch[];
  const allocations = (allocationsResult.data || []) as unknown as Allocation[];
  const targets = (targetsResult.data || []) as unknown as StockTarget[];
  const parts = (partsResult.data || []) as Part[];
  const items = (itemsResult.data || []) as unknown as { id: string; quantity: number; letter_orders: Item["letter_orders"] }[];
  const producedForAllocation = new Map<string, number>();
  const producedForStock = new Map<string, number>();
  for (const part of parts) {
    if (part.allocation_id) producedForAllocation.set(part.allocation_id, (producedForAllocation.get(part.allocation_id) || 0) + part.quantity);
    if (part.stock_target_id) producedForStock.set(part.stock_target_id, (producedForStock.get(part.stock_target_id) || 0) + part.quantity);
  }
  const plannedByItem = new Map<string, number>();
  for (const allocation of allocations) {
    const itemId = allocation.letter_order_items?.id;
    if (itemId) plannedByItem.set(itemId, (plannedByItem.get(itemId) || 0) + allocation.planned_quantity);
  }
  const unplanned = items.filter((item) => item.letter_orders?.fulfillment_status !== "CANCELLED" && (plannedByItem.get(item.id) || 0) < item.quantity);

  return <StrikShell wide>
    <StrikPageHeader title="Centrale letterproductie" icon={strikIcons.sinterklaasProductie} />
    <p className="mb-5 text-sm text-[#776a5f]">Eerste interne inzage in de centrale bestellingen. Dit is nog geen definitieve bakkerij-productielijst: productie registreren en klaarzetten worden hier nog aangesloten. Het <Link href="/sinterklaas/letters/productie" className="underline">oude productiescherm</Link> toont voorlopig nog de bestaande WordPress-bestellingen.</p>
    {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-800">Productiegegevens laden is mislukt: {error.message}</p>}
    {!error && <>
      {unplanned.length > 0 && <section className="mb-5 rounded-2xl border border-amber-300 bg-amber-50 p-4"><h2 className="font-black">⚠ {unplanned.length} orderregels nog niet volledig ingepland</h2><div className="mt-2 space-y-1 text-sm">{unplanned.slice(0, 20).map((item) => <p key={item.id}>{item.letter_orders?.order_number} · {item.letter_orders?.customer_name} · besteld {item.quantity}, gepland {plannedByItem.get(item.id) || 0}</p>)}</div>{unplanned.length > 20 && <p className="mt-2 text-xs">En nog {unplanned.length - 20} regels.</p>}</section>}
      {batches.length === 0 && <p className="rounded-xl bg-white p-5">Er zijn nog geen centrale productiedagen ingesteld. Nieuwe bestellingen blijven zichtbaar bij <Link href="/sinterklaas/letters/online" className="underline">Online bestellingen</Link>, maar kunnen nog niet automatisch worden ingepland.</p>}
      <div className="space-y-5">{batches.map((batch) => {
        const batchAllocations = allocations.filter((allocation) => allocation.batch_id === batch.id && allocation.letter_order_items?.letter_orders?.fulfillment_status !== "CANCELLED");
        const batchTargets = targets.filter((target) => target.batch_id === batch.id);
        const rows = new Map<string, { orders: number; stock: number; producedOrders: number; producedStock: number }>();
        for (const allocation of batchAllocations) {
          const key = productKey(productOf(allocation.letter_order_items?.letter_products || null));
          const row = rows.get(key) || { orders: 0, stock: 0, producedOrders: 0, producedStock: 0 };
          row.orders += allocation.planned_quantity;
          row.producedOrders += producedForAllocation.get(allocation.id) || 0;
          rows.set(key, row);
        }
        for (const target of batchTargets) {
          const key = productKey(productOf(target.letter_products));
          const row = rows.get(key) || { orders: 0, stock: 0, producedOrders: 0, producedStock: 0 };
          row.stock += target.planned_quantity;
          row.producedStock += producedForStock.get(target.id) || 0;
          rows.set(key, row);
        }
        const totals = [...rows.values()].reduce((sum, row) => ({ orders: sum.orders + row.orders, stock: sum.stock + row.stock, producedOrders: sum.producedOrders + row.producedOrders, producedStock: sum.producedStock + row.producedStock }), { orders: 0, stock: 0, producedOrders: 0, producedStock: 0 });
        return <section key={batch.id} className="overflow-hidden rounded-2xl border border-[#e9ddd1] bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#eee3d8] p-4"><h2 className="text-xl font-black">{formatPickupDate(batch.production_date)}</h2><span className="rounded-full bg-[#edf4ec] px-3 py-1 text-xs font-black">{batch.status}</span></div>
          <div className="grid gap-2 p-4 text-sm sm:grid-cols-4"><p>Besteld <strong>{totals.orders}</strong></p><p>Extra voorraad <strong>{totals.stock}</strong></p><p>Totaal te maken <strong>{totals.orders + totals.stock}</strong></p><p>Gemaakt <strong>{totals.producedOrders + totals.producedStock}</strong></p></div>
          <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-left text-sm"><thead className="bg-[#faf5ee]"><tr><th className="p-3">Letter</th><th className="p-3">Orders</th><th className="p-3">Voorraad</th><th className="p-3">Totaal</th><th className="p-3">Gemaakt</th></tr></thead><tbody>{[...rows.entries()].sort(([a], [b]) => a.localeCompare(b, "nl")).map(([key, row]) => <tr key={key} className="border-t border-[#eee3d8]"><td className="p-3 font-bold">{key}</td><td className="p-3">{row.orders}</td><td className="p-3">{row.stock}</td><td className="p-3 font-black">{row.orders + row.stock}</td><td className="p-3">{row.producedOrders + row.producedStock}</td></tr>)}</tbody></table></div>
          {batchAllocations.length > 0 && <details className="border-t border-[#eee3d8] p-4 text-sm"><summary className="cursor-pointer font-bold">Onderliggende orders ({batchAllocations.length} regels)</summary><div className="mt-2 space-y-1">{batchAllocations.map((allocation) => <p key={allocation.id}>{allocation.letter_order_items?.letter_orders?.order_number} · {allocation.letter_order_items?.letter_orders?.channel} · {allocation.letter_order_items?.letter_orders?.customer_name} · {productKey(productOf(allocation.letter_order_items?.letter_products || null))}: {producedForAllocation.get(allocation.id) || 0}/{allocation.planned_quantity}</p>)}</div></details>}
        </section>;
      })}</div>
    </>}
  </StrikShell>;
}
