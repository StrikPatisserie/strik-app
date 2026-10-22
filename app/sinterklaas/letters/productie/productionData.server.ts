import "server-only";
import { createAdminClient } from "@/app/lib/supabase/admin";
import { addProductionOrderQuantity, productionOrderSource } from "./productionSources";
import type { ProductionBatchSeed, ProductionSeedRow, StoreOrderRow, StoreStockOrder } from "./ProductionPlanningClient";

type Product = {
  letter: string;
  flavour: string;
  size: string;
  style: string;
};

type OrderInfo = {
  channel: "ONLINE" | "STORE" | "B2B";
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


export async function loadCentralProduction(season: string) {
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
      .select("id,batch_id,planned_quantity,letter_order_items(id,quantity,logo,notes,letter_products(letter,flavour,size,style),letter_orders(requested_date,fulfillment_status,channel))"),
    db
      .from("letter_stock_targets")
      .select("id,batch_id,planned_quantity,letter_products(letter,flavour,size,style)"),
    db
      .from("letter_production_registration_parts")
      .select("allocation_id,stock_target_id,quantity"),
    db
      .from("letter_order_items")
      .select("id,quantity,letter_orders(requested_date,fulfillment_status,channel)"),
    db
      .from("letter_store_stock_order_items")
      .select("batch_id,location_code,quantity,letter_products(letter,flavour,size,style)"),
  ]);
  const loadError = [batchesResult, allocationsResult, targetsResult, partsResult, itemsResult, storeOrdersResult]
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
        const updated = addProductionOrderQuantity(current, productionOrderSource(item?.letter_orders?.channel), allocation.planned_quantity);
        updated.produced += producedForAllocation.get(allocation.id) || 0;
        rows.set(identity.key, updated);
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

  if (loadError) throw new Error(loadError.message);
  return { batches: batchSeeds, centralUnplannedCount };
}
