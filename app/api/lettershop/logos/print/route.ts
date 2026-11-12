import { createCanvas, ImageData } from "@napi-rs/canvas";
import { logoAccess, logoHeaders, uuid } from "@/app/sinterklaas/letters/online/logos/access.server";
import { loadLogoReceipts, logoOrderSelect } from "@/app/sinterklaas/letters/online/logos/data.server";
import { logoItemPrinted, logoItems, logoOrderSummary, type LogoPrintSnapshot } from "@/app/sinterklaas/letters/online/logos/model";
import { onlineItemLabel, type OnlineLetterOrder } from "@/app/sinterklaas/letters/online/onlineOrders";
import { createLogoPrint } from "@/app/sinterklaas/b2b/logos/print.server";
import { packedLogoPrintLayout } from "@/app/sinterklaas/b2b/logos/packedLayout";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const context = await logoAccess(request, true);
  if (context.error) return context.error;
  try {
    const raw = await request.text();
    if (raw.length > 20000) throw new Error("Kies minder bestellingen tegelijk.");
    const input = JSON.parse(raw);
    if (!Array.isArray(input.itemIds) || !input.itemIds.length || input.itemIds.length > 100
      || input.itemIds.some((id: unknown) => typeof id !== "string" || !uuid.test(id))
      || new Set(input.itemIds).size !== input.itemIds.length
      || !Array.isArray(input.orders) || input.orders.length > 100) throw new Error("Selecteer eerst de bestellingen.");
    const selectedIds = new Set<string>(input.itemIds);
    const lookup = await context.db.from("letter_order_items").select("id,order_id").in("id", [...selectedIds]);
    if (lookup.error || lookup.data?.length !== selectedIds.size) throw new Error("Een bestelregel is gewijzigd. Open de lijst opnieuw.");
    const orderIds = [...new Set(lookup.data.map(item => item.order_id))];
    const result = await context.db.from("letter_orders").select(logoOrderSelect).eq("channel", "ONLINE")
      .neq("fulfillment_status", "CANCELLED").in("id", orderIds);
    if (result.error || result.data?.length !== orderIds.length) throw new Error("Een bestelling is niet meer beschikbaar.");
    const orders = result.data as unknown as OnlineLetterOrder[];
    const receipts = await loadLogoReceipts(context.db, [...selectedIds]);
    const snapshots: LogoPrintSnapshot[] = [];
    const files = [];
    const choices = [];
    for (const order of orders) {
      if (!input.orders.some((expected: { id: string; revision: number }) => expected.id === order.id && expected.revision === order.revision)) {
        throw new Error("Een bestelling is intussen gewijzigd. Open de lijst opnieuw.");
      }
      for (const item of logoItems(order).filter(item => selectedIds.has(item.id))) {
        if (!item.logo_storage_path || !item.product_id) throw new Error(`Logo ontbreekt bij ${order.customer_name}.`);
        if (logoItemPrinted(order, item, receipts) && input.confirmReprint !== true) throw new Error("Een logo is inmiddels geprint. Vernieuw de lijst of kies bewust voor herdrukken.");
        snapshots.push({ item_id: item.id, order_id: order.id, revision: order.revision, quantity: item.quantity,
          product_id: item.product_id, logo_storage_path: item.logo_storage_path });
        choices.push({ id: item.id, quantity: item.quantity, width_cm: input.widthCm, height_cm: input.heightCm });
        files.push({ id: item.id, customer: order.customer_name, summary: `${onlineItemLabel(item)} — ${logoOrderSummary(order)}`,
          printSummary: `${order.order_number} · ${onlineItemLabel(item).replace(/ · foto\/logo$/, "")}`,
          content_type: "", bytes_base64: "", path: item.logo_storage_path });
      }
    }
    if (snapshots.length !== selectedIds.size) throw new Error("Selecteer alleen bestelregels met logo.");
    if (choices.length > 30) throw new Error("Kies maximaal 30 verschillende logoregels per afdruk.");
    packedLogoPrintLayout(choices);
    // Sequential downloads bound memory usage for large photo selections.
    for (const file of files) {
      const { data, error } = await context.db.storage.from("lettershop-logos").download(file.path);
      if (error || !data) throw new Error(`Logo van ${file.customer} kon niet worden geladen.`);
      if (data.size > 10 * 1024 * 1024) throw new Error("Een logo is te groot.");
      const extension = file.path.split(".").pop()?.toLowerCase();
      file.content_type = ({ jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", heic: "image/heic", heif: "image/heif" } as Record<string, string>)[extension || ""] || data.type;
      let imageBytes: Buffer = Buffer.from(await data.arrayBuffer());
      if (["image/heic", "image/heif"].includes(file.content_type)) {
        const decode = (await import("heic-decode")).default;
        const images = await decode.all({ buffer: imageBytes });
        try {
          const first = images[0];
          if (!first || first.width * first.height > 25000000) throw new Error("De foto is te groot om te printen.");
          const image = await first.decode();
          const canvas = createCanvas(image.width, image.height);
          canvas.getContext("2d").putImageData(new ImageData(new Uint8ClampedArray(image.data), image.width, image.height), 0, 0);
          imageBytes = canvas.toBuffer("image/png");
          file.content_type = "image/png";
        } finally { images.dispose(); }
      }
      file.bytes_base64 = imageBytes.toString("base64");
    }
    const bytes = await createLogoPrint(choices, files, "Lettershop", { packGroups: true });
    const job = await context.db.from("letter_logo_print_jobs").insert({ created_by: context.profile.id, items: snapshots,
      width_cm: input.widthCm, height_cm: input.heightCm }).select("id").single();
    if (job.error || !job.data) throw new Error("Afdruk vastleggen is mislukt. Probeer opnieuw.");
    return new Response(new Uint8Array(bytes), { headers: { ...logoHeaders, "Content-Type": "application/pdf",
      "Content-Disposition": 'inline; filename="Strik-Lettershop-logos.pdf"', "X-Print-Job": job.data.id,
      "X-Content-Type-Options": "nosniff" } });
  } catch (error) {
    return Response.json({ message: error instanceof Error ? error.message : "Afdruk maken is mislukt." }, { status: 400, headers: logoHeaders });
  }
}
