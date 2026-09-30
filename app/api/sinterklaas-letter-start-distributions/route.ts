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

type Distribution = {
  id: string;
  season: number;
  distribution_date: string;
  created_at: string;
  updated_at: string;
};

type DistributionItem = {
  distribution_id: string;
  location_code: string;
  quantity: number;
  letter_products: Product | Product[] | null;
};

function jsonError(message: string, status = 400) {
  return Response.json({ message }, { status });
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

function productOf(value: Product | Product[] | null) {
  return Array.isArray(value) ? value[0] : value;
}

function rowFor(product: Product, quantity: number) {
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

function databaseMessage(error: { code?: string; message?: string } | null | undefined, fallback: string) {
  if (error?.code === "42P01" || error?.code === "PGRST205" || error?.code === "PGRST202") {
    return "De Supabase-migratie voor startverdelingen is nog niet uitgevoerd.";
  }
  return error?.message || fallback;
}

async function readSnapshot(db: SupabaseClient, season: number) {
  const distributionsResult = await db
    .from("letter_store_start_distributions")
    .select("id,season,distribution_date,created_at,updated_at")
    .eq("season", season)
    .order("distribution_date", { ascending: true });
  if (distributionsResult.error) throw new Error(databaseMessage(distributionsResult.error, "Startverdelingen konden niet worden geladen."));

  const distributions = (distributionsResult.data || []) as Distribution[];
  const ids = distributions.map((distribution) => distribution.id);
  let items: DistributionItem[] = [];
  if (ids.length > 0) {
    const itemsResult = await db
      .from("letter_store_start_distribution_items")
      .select("distribution_id,location_code,quantity,letter_products(id,letter,flavour,size,style)")
      .in("distribution_id", ids)
      .order("location_code");
    if (itemsResult.error) throw new Error(databaseMessage(itemsResult.error, "Startverdelingen konden niet worden geladen."));
    items = (itemsResult.data || []) as unknown as DistributionItem[];
  }

  return {
    season: String(season),
    distributions: distributions.map((distribution) => {
      const byShop = new Map<string, ReturnType<typeof rowFor>[]>();
      items
        .filter((item) => item.distribution_id === distribution.id)
        .forEach((item) => {
          const product = productOf(item.letter_products);
          if (!product) return;
          const rows = byShop.get(item.location_code) || [];
          rows.push(rowFor(product, item.quantity));
          byShop.set(item.location_code, rows);
        });
      return {
        id: distribution.id,
        date: distribution.distribution_date,
        createdAt: distribution.created_at,
        updatedAt: distribution.updated_at,
        orders: [...byShop.entries()].map(([shop, rows]) => ({
          shop,
          rows: rows.sort((a, b) => a.label.localeCompare(b.label, "nl")),
        })),
      };
    }),
  };
}

function readSeason(request: Request, value?: unknown) {
  const candidate = typeof value === "string" || typeof value === "number"
    ? String(value)
    : new URL(request.url).searchParams.get("season") || String(new Date().getFullYear());
  const season = Number(candidate);
  return Number.isInteger(season) && season >= 2020 && season <= 2100 ? season : 0;
}

export async function GET(request: Request) {
  const profile = await getCurrentProfile();
  if (!canAccessSinterklaas(profile)) return jsonError("Geen toegang.", 403);
  const season = readSeason(request);
  if (!season) return jsonError("Ongeldig seizoen.");

  try {
    return Response.json(await readSnapshot(createDatabaseClient(), season));
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Startverdelingen konden niet worden geladen.", 503);
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
  const id = typeof data.id === "string" ? data.id : "";
  const season = readSeason(request, data.season);
  const date = typeof data.date === "string" ? data.date : "";
  const rawOrders = Array.isArray(data.orders) ? data.orders : [];
  if (id && !/^[0-9a-f-]{36}$/i.test(id)) return jsonError("Ongeldige startverdeling.");
  if (!season || !/^\d{4}-\d{2}-\d{2}$/.test(date) || date.slice(0, 4) !== String(season)) return jsonError("Kies een geldige datum binnen dit seizoen.");
  if (rawOrders.length > SHOPS.size) return jsonError("Er zijn te veel winkels ingestuurd.");

  const normalized = new Map<string, { shop: string; letter: string; flavour: string; size: string; style: string; quantity: number }>();
  for (const rawOrder of rawOrders) {
    const order = rawOrder && typeof rawOrder === "object" ? rawOrder as Record<string, unknown> : {};
    const shop = typeof order.shop === "string" ? order.shop.toLocaleLowerCase("nl-NL") : "";
    if (!SHOPS.has(shop)) return jsonError("Kies een geldige winkel.");
    const rawLines = Array.isArray(order.rows) ? order.rows : [];
    if (rawLines.length > 250) return jsonError("Een winkel bevat te veel regels.");
    for (const rawLine of rawLines) {
      const line = rawLine && typeof rawLine === "object" ? rawLine as Record<string, unknown> : {};
      const letter = typeof line.letter === "string" ? line.letter.toUpperCase() : "";
      const flavour = typeof line.flavour === "string" ? line.flavour : "";
      const size = typeof line.size === "string" ? line.size : "";
      const style = typeof line.style === "string" ? line.style : "";
      const quantity = Number(line.quantity);
      if (!/^[A-Z]$/.test(letter) || !FLAVOURS.has(flavour) || !SIZES.has(size) || !STYLES.has(style)) return jsonError("Controleer iedere letteruitvoering.");
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10000) return jsonError("Kies per regel een aantal tussen 1 en 10.000.");
      if (style === "vorm" && (letter !== "S" || size !== "groot")) return jsonError("De vormletter is alleen beschikbaar als grote S.");
      const key = [shop, letter, flavour, size, style].join("|").toLocaleLowerCase("nl-NL");
      const current = normalized.get(key);
      normalized.set(key, { shop, letter, flavour, size, style, quantity: (current?.quantity || 0) + quantity });
    }
  }
  const total = [...normalized.values()].reduce((sum, line) => sum + line.quantity, 0);
  if (total < 1) return jsonError("Voeg minimaal één letter aan de startverdeling toe.");
  if (total > 50000) return jsonError("Deze startverdeling is groter dan 50.000 letters.");

  try {
    const db = createDatabaseClient();
    const productsResult = await db.from("letter_products").select("id,letter,flavour,size,style").eq("active", true);
    if (productsResult.error) return jsonError("Letterproducten konden niet worden gecontroleerd.", 503);
    const productMap = new Map(((productsResult.data || []) as Product[]).map((product) => [
      [product.letter, product.flavour, product.size, product.style].join("|").toLocaleLowerCase("nl-NL"),
      product,
    ]));
    const lines = [...normalized.values()].map((line) => {
      const product = productMap.get([line.letter, line.flavour, line.size, line.style].join("|").toLocaleLowerCase("nl-NL"));
      if (!product) throw new Error(`Letteruitvoering ${line.letter} · ${line.flavour} is niet beschikbaar.`);
      return { location_code: line.shop, product_id: product.id, quantity: line.quantity };
    });

    const saveResult = await db.rpc("letter_replace_store_start_distribution", {
      p_distribution_id: id || null,
      p_season: season,
      p_distribution_date: date,
      p_lines: lines,
      p_actor_id: profile?.id || null,
    });
    if (saveResult.error) return jsonError(databaseMessage(saveResult.error, "Startverdeling opslaan is mislukt."), 409);
    return Response.json(await readSnapshot(db, season));
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Startverdeling opslaan is mislukt.", 503);
  }
}

export async function DELETE(request: Request) {
  const profile = await getCurrentProfile();
  if (!canAccessSinterklaas(profile)) return jsonError("Geen toegang.", 403);
  if (!validOrigin(request)) return jsonError("Ongeldige website.", 403);
  const url = new URL(request.url);
  const id = url.searchParams.get("id") || "";
  const season = readSeason(request);
  if (!/^[0-9a-f-]{36}$/i.test(id) || !season) return jsonError("Ongeldige startverdeling.");

  try {
    const db = createDatabaseClient();
    const distributionResult = await db
      .from("letter_store_start_distributions")
      .select("id,distribution_date")
      .eq("id", id)
      .eq("season", season)
      .maybeSingle();
    if (distributionResult.error) return jsonError(databaseMessage(distributionResult.error, "Startverdeling kon niet worden gevonden."), 503);
    if (!distributionResult.data) return jsonError("Startverdeling niet gevonden.", 404);

    const auditResult = await db.from("letter_audit_events").insert({
      entity_type: "store_start_distribution",
      entity_id: id,
      action: "deleted",
      details: { season, distribution_date: distributionResult.data.distribution_date },
      actor_id: profile?.id || null,
    });
    if (auditResult.error) return jsonError("Verwijderen is gestopt omdat de historie niet kon worden vastgelegd.", 503);
    const deleteResult = await db.from("letter_store_start_distributions").delete().eq("id", id).eq("season", season);
    if (deleteResult.error) return jsonError(databaseMessage(deleteResult.error, "Startverdeling verwijderen is mislukt."), 409);
    return Response.json(await readSnapshot(db, season));
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Startverdeling verwijderen is mislukt.", 503);
  }
}
