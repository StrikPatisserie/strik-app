import { logoAccess, logoHeaders } from "@/app/sinterklaas/letters/online/logos/access.server";
import { loadLogoOrders } from "@/app/sinterklaas/letters/online/logos/data.server";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const context = await logoAccess(request);
  if (context.error) return context.error;
  try {
    const orders = await loadLogoOrders(context.db);
    const paths = [...new Set(orders.flatMap(order => order.letter_order_items.map(item => item.logo_storage_path).filter((path): path is string => !!path)))];
    const previews: Record<string, string> = {};
    for (let offset = 0; offset < paths.length; offset += 100) {
      const { data } = await context.db.storage.from("lettershop-logos").createSignedUrls(paths.slice(offset, offset + 100), 3600);
      for (const entry of data || []) if (entry.path && entry.signedUrl) previews[entry.path] = entry.signedUrl;
    }
    return Response.json({ orders, previews }, { headers: logoHeaders });
  } catch (error) {
    return Response.json({ message: error instanceof Error ? error.message : "Logo’s laden is mislukt." }, { status: 503, headers: logoHeaders });
  }
}
