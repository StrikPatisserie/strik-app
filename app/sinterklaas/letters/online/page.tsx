import { createClient } from "@supabase/supabase-js";
import { requireAdminProfile } from "@/app/lib/auth/session";
import { requireSupabasePublicConfig, requireSupabaseServiceRoleKey } from "@/app/lib/supabase/config";
import { StrikShell } from "@/app/StrikUI";
import OnlineLetterOrdersClient from "./OnlineLetterOrdersClient";
import type { OnlineLetterOrder } from "./onlineOrders";

export const dynamic = "force-dynamic";

export default async function OnlineLetterOrdersPage() {
  await requireAdminProfile();
  const { url } = requireSupabasePublicConfig();
  const supabase = createClient(url, requireSupabaseServiceRoleKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await supabase.from("letter_orders")
    .select("id,order_number,customer_name,customer_email,phone,notes,requested_date,pickup_location,gift_wrap,gift_wrap_price_cents,fulfillment_status,created_at,letter_order_items(quantity,logo,logo_storage_path,unit_price_cents,logo_price_cents,letter_products(letter,flavour,size,style))")
    .eq("channel", "ONLINE").order("created_at", { ascending: false }).limit(100);
  const orders = (data || []) as unknown as OnlineLetterOrder[];
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
    <OnlineLetterOrdersClient orders={orders} photoUrls={Object.fromEntries(photoUrls)} error={error?.message} />
  </StrikShell>;
}
