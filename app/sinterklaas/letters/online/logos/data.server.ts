import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { OnlineLetterOrder } from "../onlineOrders";
import type { LogoReceipt } from "./model";

export const logoOrderSelect = "id,revision,order_number,customer_name,customer_email,phone,notes,requested_date,pickup_location,gift_wrap,gift_wrap_price_cents,fulfillment_status,created_at,letter_order_items(id,product_id,quantity,logo,logo_storage_path,unit_price_cents,logo_price_cents,letter_products(letter,flavour,size,style))";
export async function loadLogoReceipts(db: SupabaseClient, itemIds: string[]): Promise<LogoReceipt[]> {
  const receipts: LogoReceipt[] = [];
  for (let offset = 0; offset < itemIds.length; offset += 200) {
    const { data, error } = await db.from("letter_logo_print_receipts")
      .select("item_id,order_revision,quantity,logo_storage_path,printed_at").in("item_id", itemIds.slice(offset, offset + 200));
    if (error) throw new Error("Printstatus laden is mislukt. Probeer opnieuw.");
    receipts.push(...(data || []));
  }
  return receipts;
}
export async function loadLogoOrders(db: SupabaseClient) {
  const orders: OnlineLetterOrder[] = [];
  for (let offset = 0; ; offset += 200) {
    const { data, error } = await db.from("letter_orders")
      .select(`${logoOrderSelect},logo_items:letter_order_items!inner(id)`)
      .eq("channel", "ONLINE").neq("fulfillment_status", "CANCELLED").eq("logo_items.logo", true)
      .order("requested_date").order("id").range(offset, offset + 199);
    if (error) throw new Error("Logobestellingen laden is mislukt. Probeer opnieuw.");
    orders.push(...(data || []) as unknown as OnlineLetterOrder[]);
    if (!data || data.length < 200) break;
  }
  const receipts = await loadLogoReceipts(db, orders.flatMap(order => order.letter_order_items.map(item => item.id)));
  return orders.map(order => ({ ...order, receipts: receipts.filter(receipt => order.letter_order_items.some(item => item.id === receipt.item_id)) }));
}
