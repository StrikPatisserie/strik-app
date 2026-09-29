import { StrikPageHeader, StrikShell, strikIcons } from "@/app/StrikUI";
import { createAdminClient } from "@/app/lib/supabase/admin";
import ProductionPlanningClient, {
  type ProductionBatchSeed,
  type ProductionSeedRow,
  type StoreOrderRow,
  type StoreStockOrder,
} from "./ProductionPlanningClient";

export const dynamic = "force-dynamic";

type Product = {
  letter: string;
  flavour: string;
  size: string;
  style: string;
};

type OrderInfo = {
  requested_date: string;
  fulfillment_status: string;
};

type Item = {
  id: string;
  quantity: number;
  logo: boolean;
  notes: string;
  letter_products: Product | Product[] | null;
  letter_orders: OrderInfo | null;
};

type Allocation = {
  id: string;
  batch_id: string;
  planned_quantity: number;
  letter_order_items: Item | null;
};

type StockTarget = {
  id: string;
  batch_id: string;
  planned_quantity: number;
  letter_products: Product | Product[] | null;
};

type StoreStockOrderItem = {
  batch_id: string;
  location_code: string;
  quantity: number;
  letter_products: Product | Product[] | null;
};

type RegistrationPart = {
  allocation_id: string | null;
  stock_target_id: string | null;
  quantity: number;
};

type Batch = {
  id: string;
  production_start_date: string | null;
  production_date: string;
  pickup_from_date: string | null;
  order_deadline_at: string | null;
  status: string;
  minimum_lead_days: number;
};

function productOf(value: Product | Product[] | null) {
  return Array.isArray(value) ? value[0] : value;
}

function productIdentity(product: Product | null | undefined, logo = false, notes = "") {
  if (!product) return { key: "onbekend", label: "Onbekend product" };
  const extras = [logo ? "logo" : "", notes.trim()].filter(Boolean);
  const values = [product.letter, product.flavour, product.size, product.style, ...extras];
  return {
    key: values.join("|").toLocaleLowerCase("nl-NL"),
    label: values.join(" · "),
  };
}

function storeOrderRow(letter: string, flavour: string, size: string, style: string, quantity: number): StoreOrderRow {
  const values = [letter, flavour, size, style];
  return {
    key: values.join("|").toLocaleLowerCase("nl-NL"),
    label: values.join(" · "),
    letter,
    flavour,
    size,
    style,
    quantity,
  };
}

function demoProductionBatches(): ProductionBatchSeed[] {
  return [
    {
      id: "demo-2026-11-03",
      startDate: "2026-11-02",
      date: "2026-11-03",
      pickupFrom: "2026-11-05",
      deadlineAt: "2026-11-01T20:00:00+01:00",
      status: "PLANNED",
      minimumLeadDays: 2,
      storeOrders: [
        { shop: "ziekerstraat", rows: [storeOrderRow("S", "melk", "groot", "spuit", 3), storeOrderRow("A", "puur", "groot", "spuit", 4), storeOrderRow("M", "wit", "klein", "spuit", 2)] },
        { shop: "heyendaal", rows: [storeOrderRow("S", "melk", "groot", "spuit", 2), storeOrderRow("A", "puur", "groot", "spuit", 3), storeOrderRow("M", "wit", "klein", "spuit", 2)] },
        { shop: "daalseweg", rows: [storeOrderRow("S", "melk", "groot", "spuit", 2), storeOrderRow("A", "puur", "groot", "spuit", 3), storeOrderRow("M", "wit", "klein", "spuit", 2)] },
        { shop: "lent", rows: [storeOrderRow("S", "melk", "groot", "spuit", 1), storeOrderRow("A", "puur", "groot", "spuit", 2), storeOrderRow("M", "wit", "klein", "spuit", 2)] },
      ],
      rows: [
        { key: "s|melk|groot|spuit", label: "S · melk · groot · spuit", orders: 18, stock: 8, produced: 6 },
        { key: "s|melk|groot|spuit|notenvrij", label: "S · melk · groot · spuit · notenvrij", orders: 10, stock: 0, produced: 0 },
        { key: "s|melk|groot|spuit|notenvrij|foto", label: "S · melk · groot · spuit · notenvrij · foto", orders: 3, stock: 0, produced: 0 },
        { key: "s|melk|groot|spuit|foto", label: "S · melk · groot · spuit · foto", orders: 19, stock: 0, produced: 4 },
        { key: "a|puur|groot|spuit", label: "A · puur · groot · spuit", orders: 24, stock: 12, produced: 18 },
        { key: "m|wit|klein|spuit", label: "M · wit · klein · spuit", orders: 14, stock: 8, produced: 0 },
        { key: "p|puur|groot|spuit|vegan", label: "P · puur · groot · spuit · vegan", orders: 6, stock: 0, produced: 0 },
      ],
    },
    {
      id: "demo-2026-11-17",
      startDate: "2026-11-16",
      date: "2026-11-17",
      pickupFrom: "2026-11-19",
      deadlineAt: "2026-11-15T20:00:00+01:00",
      status: "OPEN",
      minimumLeadDays: 2,
      storeOrders: [
        { shop: "ziekerstraat", rows: [storeOrderRow("S", "melk", "groot", "spuit", 6), storeOrderRow("B", "puur", "klein", "spuit", 3), storeOrderRow("S", "melk", "groot", "vorm", 2)] },
        { shop: "heyendaal", rows: [storeOrderRow("S", "melk", "groot", "spuit", 5), storeOrderRow("B", "puur", "klein", "spuit", 3), storeOrderRow("S", "melk", "groot", "vorm", 2)] },
        { shop: "daalseweg", rows: [storeOrderRow("S", "melk", "groot", "spuit", 4), storeOrderRow("B", "puur", "klein", "spuit", 2), storeOrderRow("S", "melk", "groot", "vorm", 1)] },
        { shop: "lent", rows: [storeOrderRow("S", "melk", "groot", "spuit", 3), storeOrderRow("B", "puur", "klein", "spuit", 2), storeOrderRow("S", "melk", "groot", "vorm", 1)] },
      ],
      rows: [
        { key: "s|melk|groot|spuit", label: "S · melk · groot · spuit", orders: 42, stock: 18, produced: 0 },
        { key: "s|melk|groot|spuit|foto", label: "S · melk · groot · spuit · foto", orders: 12, stock: 0, produced: 0 },
        { key: "b|puur|klein|spuit", label: "B · puur · klein · spuit", orders: 21, stock: 10, produced: 0 },
        { key: "l|wit|groot|spuit|glutenvrij", label: "L · wit · groot · spuit · glutenvrij", orders: 5, stock: 0, produced: 0 },
        { key: "s|melk|groot|vorm", label: "S · melk · groot · vorm", orders: 16, stock: 6, produced: 0 },
      ],
    },
    {
      id: "demo-2026-12-01",
      startDate: "2026-11-30",
      date: "2026-12-01",
      pickupFrom: "2026-12-03",
      deadlineAt: "2026-11-29T20:00:00+01:00",
      status: "OPEN",
      minimumLeadDays: 2,
      storeOrders: [
        { shop: "ziekerstraat", rows: [storeOrderRow("S", "melk", "groot", "spuit", 7), storeOrderRow("R", "puur", "groot", "spuit", 4), storeOrderRow("E", "wit", "klein", "spuit", 3)] },
        { shop: "heyendaal", rows: [storeOrderRow("S", "melk", "groot", "spuit", 6), storeOrderRow("R", "puur", "groot", "spuit", 4), storeOrderRow("E", "wit", "klein", "spuit", 3)] },
        { shop: "daalseweg", rows: [storeOrderRow("S", "melk", "groot", "spuit", 6), storeOrderRow("R", "puur", "groot", "spuit", 3), storeOrderRow("E", "wit", "klein", "spuit", 2)] },
        { shop: "lent", rows: [storeOrderRow("S", "melk", "groot", "spuit", 5), storeOrderRow("R", "puur", "groot", "spuit", 3), storeOrderRow("E", "wit", "klein", "spuit", 2)] },
      ],
      rows: [
        { key: "s|melk|groot|spuit", label: "S · melk · groot · spuit", orders: 55, stock: 24, produced: 0 },
        { key: "s|melk|groot|spuit|foto", label: "S · melk · groot · spuit · foto", orders: 17, stock: 0, produced: 0 },
        { key: "r|puur|groot|spuit", label: "R · puur · groot · spuit", orders: 28, stock: 14, produced: 0 },
        { key: "e|wit|klein|spuit", label: "E · wit · klein · spuit", orders: 19, stock: 10, produced: 0 },
        { key: "k|puur|groot|spuit|lactosevrij|foto", label: "K · puur · groot · spuit · lactosevrij · foto", orders: 4, stock: 0, produced: 0 },
      ],
    },
  ];
}

export default async function SinterklaasLettersProductiePage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{ demo?: string | string[] }>;
}>) {
  const query = await searchParams;
  const demoMode = query.demo === "1";
  const season = String(new Date().getFullYear());

  if (demoMode) {
    return (
      <StrikShell wide>
        <StrikPageHeader
          title="Productie chocoladeletters"
          description={`Tijdelijke preview van de productierondes van ${season}.`}
          icon={strikIcons.sinterklaasProductie}
        />
        <ProductionPlanningClient
          season={season}
          batches={demoProductionBatches()}
          centralUnplannedCount={0}
          demoMode
        />
      </StrikShell>
    );
  }

  const db = createAdminClient();
  const batchesRequest = (async () => {
    const extendedResult = await db
      .from("letter_production_batches")
      .select("id,production_start_date,production_date,pickup_from_date,order_deadline_at,status,minimum_lead_days")
      .eq("season", Number(season))
      .neq("status", "CLOSED")
      .order("production_date");

    if (!extendedResult.error) return extendedResult;

    return db
      .from("letter_production_batches")
      .select("id,production_date,status,minimum_lead_days")
      .eq("season", Number(season))
      .neq("status", "CLOSED")
      .order("production_date");
  })();
  const [batchesResult, allocationsResult, targetsResult, partsResult, itemsResult, storeOrdersResult] = await Promise.all([
    batchesRequest,
    db
      .from("letter_production_allocations")
      .select("id,batch_id,planned_quantity,letter_order_items(id,quantity,logo,notes,letter_products(letter,flavour,size,style),letter_orders(requested_date,fulfillment_status))"),
    db
      .from("letter_stock_targets")
      .select("id,batch_id,planned_quantity,letter_products(letter,flavour,size,style)"),
    db
      .from("letter_production_registration_parts")
      .select("allocation_id,stock_target_id,quantity"),
    db
      .from("letter_order_items")
      .select("id,quantity,letter_orders(requested_date,fulfillment_status)"),
    db
      .from("letter_store_stock_order_items")
      .select("batch_id,location_code,quantity,letter_products(letter,flavour,size,style)"),
  ]);
  const loadError = [batchesResult, allocationsResult, targetsResult, partsResult, itemsResult]
    .find((result) => result.error)?.error;
  const batchRows = (batchesResult.data || []) as unknown as Array<{
    id: string;
    production_start_date?: string | null;
    production_date: string;
    pickup_from_date?: string | null;
    order_deadline_at?: string | null;
    status: string;
    minimum_lead_days: number;
  }>;
  const batches = batchRows.map((batch) => ({
    id: batch.id,
    production_start_date: batch.production_start_date || null,
    production_date: batch.production_date,
    pickup_from_date: batch.pickup_from_date || null,
    order_deadline_at: batch.order_deadline_at || null,
    status: batch.status,
    minimum_lead_days: batch.minimum_lead_days,
  })) as Batch[];
  const allocations = (allocationsResult.data || []) as unknown as Allocation[];
  const targets = (targetsResult.data || []) as unknown as StockTarget[];
  const parts = (partsResult.data || []) as RegistrationPart[];
  const items = (itemsResult.data || []) as unknown as Pick<Item, "id" | "quantity" | "letter_orders">[];
  const storeOrderItems = (storeOrdersResult.data || []) as unknown as StoreStockOrderItem[];
  const currentBatchIds = new Set(batches.map((batch) => batch.id));
  const currentAllocations = allocations.filter((allocation) => currentBatchIds.has(allocation.batch_id));
  const currentTargets = targets.filter((target) => currentBatchIds.has(target.batch_id));
  const producedForAllocation = new Map<string, number>();
  const producedForStock = new Map<string, number>();

  for (const part of parts) {
    if (part.allocation_id) {
      producedForAllocation.set(
        part.allocation_id,
        (producedForAllocation.get(part.allocation_id) || 0) + part.quantity
      );
    }
    if (part.stock_target_id) {
      producedForStock.set(
        part.stock_target_id,
        (producedForStock.get(part.stock_target_id) || 0) + part.quantity
      );
    }
  }

  const plannedByItem = new Map<string, number>();
  currentAllocations.forEach((allocation) => {
    const itemId = allocation.letter_order_items?.id;
    if (itemId) plannedByItem.set(itemId, (plannedByItem.get(itemId) || 0) + allocation.planned_quantity);
  });
  const centralUnplannedCount = items.filter((item) =>
    item.letter_orders?.requested_date.startsWith(season) &&
    item.letter_orders.fulfillment_status !== "CANCELLED" &&
    (plannedByItem.get(item.id) || 0) < item.quantity
  ).length;

  const batchSeeds: ProductionBatchSeed[] = batches.map((batch) => {
    const rows = new Map<string, ProductionSeedRow>();
    const storeOrdersByShop = new Map<string, StoreOrderRow[]>();
    storeOrderItems
      .filter((item) => item.batch_id === batch.id)
      .forEach((item) => {
        const product = productOf(item.letter_products);
        if (!product) return;
        const row = storeOrderRow(product.letter, product.flavour, product.size, product.style, item.quantity);
        const shopRows = storeOrdersByShop.get(item.location_code) || [];
        shopRows.push(row);
        storeOrdersByShop.set(item.location_code, shopRows);
      });
    currentAllocations
      .filter((allocation) => allocation.batch_id === batch.id && allocation.letter_order_items?.letter_orders?.fulfillment_status !== "CANCELLED")
      .forEach((allocation) => {
        const item = allocation.letter_order_items;
        const identity = productIdentity(productOf(item?.letter_products || null), item?.logo, item?.notes);
        const current = rows.get(identity.key) || {
          ...identity,
          orders: 0,
          stock: 0,
          produced: 0,
        };
        current.orders += allocation.planned_quantity;
        current.produced += producedForAllocation.get(allocation.id) || 0;
        rows.set(identity.key, current);
      });
    currentTargets
      .filter((target) => target.batch_id === batch.id)
      .forEach((target) => {
        const identity = productIdentity(productOf(target.letter_products));
        const current = rows.get(identity.key) || {
          ...identity,
          orders: 0,
          stock: 0,
          produced: 0,
        };
        current.stock += target.planned_quantity;
        current.produced += producedForStock.get(target.id) || 0;
        rows.set(identity.key, current);
      });

    return {
      id: batch.id,
      startDate: batch.production_start_date || batch.production_date,
      date: batch.production_date,
      pickupFrom: batch.pickup_from_date || undefined,
      deadlineAt: batch.order_deadline_at || undefined,
      status: batch.status,
      minimumLeadDays: batch.minimum_lead_days,
      rows: [...rows.values()],
      storeOrders: [...storeOrdersByShop.entries()].map(([shop, shopRows]) => ({
        shop,
        rows: shopRows.sort((a, b) => a.label.localeCompare(b.label, "nl")),
      })) as StoreStockOrder[],
    };
  });
  return (
    <StrikShell wide>
      <StrikPageHeader
        title="Productie chocoladeletters"
        description={`Totaaloverzicht en verdeling over de drie centrale productierondes van ${season}.`}
        icon={strikIcons.sinterklaasProductie}
      />
      {loadError ? (
        <p role="alert" className="border border-[#efb8aa] bg-[#fff4ef] p-4 font-bold text-[#9a3412]">
          De centrale productiegegevens konden niet worden geladen: {loadError.message}
        </p>
      ) : batchSeeds.length === 0 ? (
        <p className="border border-[#d8d1c8] bg-white p-4 font-bold text-[#6b645b]">
          Voor {season} zijn nog geen centrale productierondes ingesteld.
        </p>
      ) : (
        <ProductionPlanningClient
          season={season}
          batches={batchSeeds}
          centralUnplannedCount={centralUnplannedCount}
        />
      )}
    </StrikShell>
  );
}
