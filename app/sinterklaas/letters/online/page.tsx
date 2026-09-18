import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { requireAdminProfile } from "@/app/lib/auth/session";
import { requireSupabasePublicConfig, requireSupabaseServiceRoleKey } from "@/app/lib/supabase/config";
import { StrikPageHeader, StrikShell, strikIcons } from "@/app/StrikUI";
import DeleteOnlineLetterOrderButton from "./DeleteOnlineLetterOrderButton";
import { formatPickupDate } from "@/app/lettershop/formatPickupDate";

export const dynamic = "force-dynamic";

type OrderItem = {
  quantity: number;
  logo: boolean;
  logo_storage_path: string | null;
  unit_price_cents: number | null;
  logo_price_cents: number;
  letter_products: { letter: string; flavour: string; size: string } | { letter: string; flavour: string; size: string }[] | null;
};
type OnlineOrder = {
  id: string;
  order_number: string;
  customer_name: string;
  customer_email: string;
  phone: string;
  requested_date: string;
  pickup_location: string;
  fulfillment_status: string;
  created_at: string;
  letter_order_items: OrderItem[];
};

function money(cents: number) {
  return new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(cents / 100);
}

export default async function OnlineLetterOrdersPage() {
  await requireAdminProfile();
  const { url } = requireSupabasePublicConfig();
  const supabase = createClient(url, requireSupabaseServiceRoleKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await supabase.from("letter_orders")
    .select("id,order_number,customer_name,customer_email,phone,requested_date,pickup_location,fulfillment_status,created_at,letter_order_items(quantity,logo,logo_storage_path,unit_price_cents,logo_price_cents,letter_products(letter,flavour,size))")
    .eq("channel", "ONLINE").order("created_at", { ascending: false }).limit(100);
  const orders = (data || []) as unknown as OnlineOrder[];
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
    <StrikPageHeader title="Online chocoladeletterbestellingen" icon={strikIcons.sinterklaasLetter} />
    <p className="mb-5 text-sm text-[#776a5f]">Nieuwste 100 bestellingen uit de centrale database. <Link href="/sinterklaas/letters/verkoop" className="underline">Terug naar verkoop</Link></p>
    {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-800">Bestellingen laden is mislukt: {error.message}</p>}
    {!error && orders.length === 0 && <p className="rounded-xl bg-white p-5">Er zijn nog geen online letterbestellingen.</p>}
    <div className="space-y-3">{orders.map((order) => {
      const total = order.letter_order_items.reduce((sum, item) => sum + item.quantity * ((item.unit_price_cents || 0) + item.logo_price_cents), 0);
      return <article key={order.id} className="rounded-2xl border border-[#e9ddd1] bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-black">{order.order_number} · {order.customer_name}</h2><p className="text-sm">{formatPickupDate(order.requested_date)} · {order.pickup_location} · {order.fulfillment_status}</p><p className="text-xs text-[#776a5f]">{order.customer_email} · {order.phone}</p></div><strong>{money(total)}</strong></div>
        <ul className="mt-3 space-y-1 border-t border-[#eee3d8] pt-3 text-sm">{order.letter_order_items.map((item, index) => {
          const product = Array.isArray(item.letter_products) ? item.letter_products[0] : item.letter_products;
          return <li key={index}>{item.quantity} × {product?.letter} · {product?.flavour} · {product?.size}{item.logo ? " · foto/logo" : ""}{item.logo_storage_path && photoUrls.has(item.logo_storage_path) && <> · <a href={photoUrls.get(item.logo_storage_path)} target="_blank" rel="noreferrer" className="font-bold text-[#547762] underline">Bekijk afbeelding</a></>}</li>;
        })}</ul>
        {order.fulfillment_status === "NEW" && <DeleteOnlineLetterOrderButton orderId={order.id} orderNumber={order.order_number} />}
      </article>;
    })}</div>
  </StrikShell>;
}
