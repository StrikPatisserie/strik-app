import { StrikPageHeader, StrikShell, strikIcons } from "@/app/StrikUI";
import { createAdminClient } from "@/app/lib/supabase/admin";
import ProductionPlanningClient, {
  type ProductionBatchSeed,
  type ProductionSeedRow,
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

type RegistrationPart = {
  allocation_id: string | null;
  stock_target_id: string | null;
  quantity: number;
};

type Batch = {
  id: string;
  production_date: string;
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

export default async function SinterklaasLettersProductiePage() {
  const season = String(new Date().getFullYear());
  const db = createAdminClient();
  const [batchesResult, allocationsResult, targetsResult, partsResult, itemsResult] = await Promise.all([
    db
      .from("letter_production_batches")
      .select("id,production_date,status,minimum_lead_days")
      .eq("season", Number(season))
      .order("production_date"),
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
  ]);
  const loadError = [batchesResult, allocationsResult, targetsResult, partsResult, itemsResult]
    .find((result) => result.error)?.error;
  const batches = (batchesResult.data || []) as Batch[];
  const allocations = (allocationsResult.data || []) as unknown as Allocation[];
  const targets = (targetsResult.data || []) as unknown as StockTarget[];
  const parts = (partsResult.data || []) as RegistrationPart[];
  const items = (itemsResult.data || []) as unknown as Pick<Item, "id" | "quantity" | "letter_orders">[];
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
      date: batch.production_date,
      status: batch.status,
      minimumLeadDays: batch.minimum_lead_days,
      rows: [...rows.values()],
    };
  });

  return (
    <StrikShell wide>
      <StrikPageHeader
        title="Productie chocoladeletters"
        description={`Totaaloverzicht en verdeling over de centrale productiedagen van ${season}.`}
        icon={strikIcons.sinterklaasProductie}
      />
      {loadError ? (
        <p role="alert" className="border border-[#efb8aa] bg-[#fff4ef] p-4 font-bold text-[#9a3412]">
          De centrale productiegegevens konden niet worden geladen: {loadError.message}
        </p>
      ) : batchSeeds.length === 0 ? (
        <p className="border border-[#d8d1c8] bg-white p-4 font-bold text-[#6b645b]">
          Voor {season} zijn nog geen centrale productiedagen ingesteld.
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
