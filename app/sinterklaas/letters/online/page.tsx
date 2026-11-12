import { loadReadyProductionRecipients } from "../productie/productionReadiness.server";
import { createClient } from "@supabase/supabase-js";
import { requireAdminProfile } from "@/app/lib/auth/session";
import { requireSupabasePublicConfig, requireSupabaseServiceRoleKey } from "@/app/lib/supabase/config";
import { StrikShell } from "@/app/StrikUI";
import OnlineLetterOrdersClient from "./OnlineLetterOrdersClient";
import { loadLogoReceipts } from "./logos/data.server";
import type { OnlineLetterOrder } from "./onlineOrders";

export const dynamic = "force-dynamic";

export default async function OnlineLetterOrdersPage() {
  await requireAdminProfile();
  const { url } = requireSupabasePublicConfig();
  const supabase = createClient(url, requireSupabaseServiceRoleKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await supabase.from("letter_orders")
    .select("id,revision,order_number,customer_name,customer_email,phone,notes,requested_date,pickup_location,gift_wrap,gift_wrap_price_cents,fulfillment_status,created_at,letter_order_items(id,product_id,quantity,logo,logo_storage_path,unit_price_cents,logo_price_cents,letter_products(letter,flavour,size,style))")
    .eq("channel", "ONLINE").order("created_at", { ascending: false }).limit(100);
  const orders = (data || []) as unknown as OnlineLetterOrder[];
  if (orders.length) {
    const { data: states, error: stateError } = await supabase.rpc("lettershop_order_edit_states", { p_order_ids: orders.map(order => order.id) });
    const blocked = new Map<string, string | null>((states || []).map((row: { order_id: string; block_reason: string | null }) => [row.order_id, row.block_reason]));
    for (const order of orders) order.edit_block_reason = stateError || !blocked.has(order.id)
      ? "Wijzigen is nog niet beschikbaar. De productiecontrole kon niet worden geladen." : blocked.get(order.id);
  }
  const seasons=[...new Set(orders.map(order=>order.requested_date.slice(0,4)))];
  const ready=new Set((await Promise.all(seasons.map(season=>loadReadyProductionRecipients(season).catch(()=>new Set<string>())))).flatMap(set=>[...set]));
  for(const order of orders)if(order.fulfillment_status==="NEW" && ready.has(`central:${order.id}`))order.fulfillment_status="READY";
  const receipts = await loadLogoReceipts(supabase, orders.flatMap(order => order.letter_order_items.filter(item => item.logo).map(item => item.id)));
  const photoUrls = new Map<string, string>();
  for (const order of orders) {
    for (const item of order.letter_order_items) {
      if (!item.logo_storage_path || photoUrls.has(item.logo_storage_path)) continue;
      const { data: signed } = await supabase.storage.from("lettershop-logos")
        .createSignedUrl(item.logo_storage_path, 3600);
      if (signed?.signedUrl) photoUrls.set(item.logo_storage_path, signed.signedUrl);
    }
  }

  return <StrikShell wide>
    <OnlineLetterOrdersClient orders={orders} receipts={receipts} photoUrls={Object.fromEntries(photoUrls)} error={error?.message} />
  </StrikShell>;
}
