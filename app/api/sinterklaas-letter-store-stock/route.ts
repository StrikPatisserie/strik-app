import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { canAccessSinterklaas } from "@/app/lib/auth/access";
import { getCurrentProfile } from "@/app/lib/auth/session";
import {
  requireSupabasePublicConfig,
  requireSupabaseServiceRoleKey,
} from "@/app/lib/supabase/config";

export const runtime = "nodejs";

const FLAVOURS = new Set(["melk", "puur", "wit"]);
const SIZES = new Set(["klein", "groot"]);
const STYLES = new Set(["spuit", "vorm"]);
const SHOPS = new Set(["ziekerstraat", "heyendaal", "daalseweg", "lent"]);

type Product = {
  id: string;
  letter: string;
  flavour: string;
  size: string;
  style: string;
};

type StoreOrderItem = {
  batch_id: string;
  location_code: string;
  quantity: number;
  letter_products: Product | Product[] | null;
};

type StockTarget = {
  batch_id: string;
  planned_quantity: number;
  letter_products: Product | Product[] | null;
};

function jsonError(message: string, status = 400) {
  return Response.json({ message }, { status });
}

function productOf(value: Product | Product[] | null) {
  return Array.isArray(value) ? value[0] : value;
}

function productRow(product: Product, quantity: number) {
  const values = [product.letter, product.flavour, product.size, product.style];
  return {
    key: values.join("|").toLocaleLowerCase("nl-NL"),
    label: values.join(" · "),
    letter: product.letter,
    flavour: product.flavour,
    size: product.size,
    style: product.style,
    quantity,
  };
}

async function readSnapshot(db: SupabaseClient, batchId: string) {
  const [batchResult, orderResult, targetResult] = await Promise.all([
    db
      .from("letter_production_batches")
      .select("id,status,production_date,order_deadline_at")
      .eq("id", batchId)
      .maybeSingle(),
    db
      .from("letter_store_stock_order_items")
      .select("batch_id,location_code,quantity,letter_products(id,letter,flavour,size,style)")
      .eq("batch_id", batchId)
      .order("location_code"),
    db
      .from("letter_stock_targets")
      .select("batch_id,planned_quantity,letter_products(id,letter,flavour,size,style)")
      .eq("batch_id", batchId),
  ]);

  const error = batchResult.error || orderResult.error || targetResult.error;
  if (error) throw error;
  if (!batchResult.data) throw new Error("Productieronde niet gevonden.");

  const byShop = new Map<string, ReturnType<typeof productRow>[]>();
  ((orderResult.data || []) as unknown as StoreOrderItem[]).forEach((item) => {
    const product = productOf(item.letter_products);
    if (!product) return;
    const rows = byShop.get(item.location_code) || [];
    rows.push(productRow(product, item.quantity));
    byShop.set(item.location_code, rows);
  });

  const orders = [...byShop.entries()].map(([shop, rows]) => ({
    shop,
    rows: rows.sort((a, b) => a.label.localeCompare(b.label, "nl")),
  }));
  const aggregateRows = ((targetResult.data || []) as unknown as StockTarget[])
    .flatMap((target) => {
      const product = productOf(target.letter_products);
      return product ? [productRow(product, target.planned_quantity)] : [];
    })
    .sort((a, b) => a.label.localeCompare(b.label, "nl"));
  const deadlineAt = String(batchResult.data.order_deadline_at || "");
  const locked = !["OPEN", "PLANNED"].includes(String(batchResult.data.status))
    || Boolean(deadlineAt && Date.now() > new Date(deadlineAt).getTime());

  return { batchId, deadlineAt, locked, orders, aggregateRows };
}

function createDatabaseClient() {
  const { url } = requireSupabasePublicConfig();
  return createClient(url, requireSupabaseServiceRoleKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function validOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}

export async function GET(request: Request) {
  const profile = await getCurrentProfile();
  if (!canAccessSinterklaas(profile)) return jsonError("Geen toegang.", 403);

  const batchId = new URL(request.url).searchParams.get("batchId") || "";
  if (!/^[0-9a-f-]{36}$/i.test(batchId)) return jsonError("Ongeldige productieronde.");

  try {
    return Response.json(await readSnapshot(createDatabaseClient(), batchId));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Winkelbestellingen konden niet worden geladen.";
    return jsonError(message, 503);
  }
}

export async function POST(request: Request) {
  const profile = await getCurrentProfile();
  if (!canAccessSinterklaas(profile)) return jsonError("Geen toegang.", 403);
  if (!validOrigin(request)) return jsonError("Ongeldige website.", 403);

  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return jsonError("Ongeldig verzoek.");
  }

  const data = input && typeof input === "object" ? input as Record<string, unknown> : {};
  const batchId = typeof data.batchId === "string" ? data.batchId : "";
  const shop = typeof data.shop === "string" ? data.shop.toLocaleLowerCase("nl-NL") : "";
  const rawLines = Array.isArray(data.lines) ? data.lines : [];

  if (!/^[0-9a-f-]{36}$/i.test(batchId)) return jsonError("Ongeldige productieronde.");
  if (!SHOPS.has(shop)) return jsonError("Kies een geldige winkel.");
  if (rawLines.length > 250) return jsonError("Deze winkelbestelling bevat te veel regels.");

  const normalizedLines: Array<{
    letter: string;
    flavour: string;
    size: string;
    style: string;
    quantity: number;
  }> = [];
  for (const rawLine of rawLines) {
    const line = rawLine && typeof rawLine === "object" ? rawLine as Record<string, unknown> : {};
    const letter = typeof line.letter === "string" ? line.letter.toUpperCase() : "";
    const flavour = typeof line.flavour === "string" ? line.flavour : "";
    const size = typeof line.size === "string" ? line.size : "";
    const style = typeof line.style === "string" ? line.style : "";
    const quantity = Number(line.quantity);
    if (!/^[A-Z]$/.test(letter) || !FLAVOURS.has(flavour) || !SIZES.has(size) || !STYLES.has(style)) {
      return jsonError("Kies voor iedere regel een geldige chocoladeletter.");
    }
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10000) {
      return jsonError("Kies per regel een aantal tussen 1 en 10.000.");
    }
    if (style === "vorm" && (letter !== "S" || size !== "groot")) {
      return jsonError("De vormletter is alleen beschikbaar als grote S.");
    }
    normalizedLines.push({ letter, flavour, size, style, quantity });
  }
  if (normalizedLines.reduce((sum, line) => sum + line.quantity, 0) > 50000) {
    return jsonError("Deze winkelbestelling is groter dan 50.000 letters.");
  }

  try {
    const db = createDatabaseClient();
    const { data: products, error: productsError } = await db
      .from("letter_products")
      .select("id,letter,flavour,size,style")
      .eq("active", true);
    if (productsError) return jsonError("Letterproducten konden niet worden gecontroleerd.", 503);

    const productMap = new Map(
      ((products || []) as Product[]).map((product) => [
        [product.letter, product.flavour, product.size, product.style].join("|").toLocaleLowerCase("nl-NL"),
        product,
      ])
    );
    const quantities = new Map<string, { product: Product; quantity: number }>();
    for (const line of normalizedLines) {
      const key = [line.letter, line.flavour, line.size, line.style].join("|").toLocaleLowerCase("nl-NL");
      const product = productMap.get(key);
      if (!product) return jsonError(`Letteruitvoering ${line.letter} · ${line.flavour} is niet beschikbaar.`);
      const current = quantities.get(product.id);
      quantities.set(product.id, { product, quantity: (current?.quantity || 0) + line.quantity });
    }

    const { error: saveError } = await db.rpc("letter_replace_store_stock_order", {
      p_batch_id: batchId,
      p_location_code: shop,
      p_lines: [...quantities.values()].map(({ product, quantity }) => ({
        product_id: product.id,
        quantity,
      })),
      p_actor_id: profile?.id || null,
    });
    if (saveError) return jsonError(saveError.message || "Opslaan is niet gelukt.", 409);

    return Response.json(await readSnapshot(db, batchId));
  } catch (error) {
    const message = error instanceof Error ? error.message : "De winkelbestelling kon niet worden opgeslagen.";
    return jsonError(message, 503);
  }
}
