import { StrikShell } from "@/app/StrikUI";
import ProductionPlanningHeader from "./ProductionPlanningHeader";
import styles from "./ProductionPlanning.module.css";
import { loadCentralProduction } from "./productionData.server";
import ProductionPlanningClient, {
  type ProductionBatchSeed,
  type StoreOrderRow,
} from "./ProductionPlanningClient";

export const dynamic = "force-dynamic";

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
  ].map((batch) => ({
    ...batch,
    rows: batch.rows.map((row) => {
      const winkel = Math.floor(row.orders / 3);
      const b2b = Math.floor(row.orders / 3);
      return { ...row, orderSources: { winkel, b2b, online: row.orders - winkel - b2b } };
    }),
  }));
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
        <div className={styles.page}>
          <ProductionPlanningHeader season={season} />
          <ProductionPlanningClient
            season={season}
            batches={demoProductionBatches()}
            centralUnplannedCount={0}
            demoMode
          />
        </div>
      </StrikShell>
    );
  }

  let batchSeeds: ProductionBatchSeed[] = [];
  let centralUnplannedCount = 0;
  let loadError: Error | null = null;
  try {
    const result = await loadCentralProduction(season);
    batchSeeds = result.batches;
    centralUnplannedCount = result.centralUnplannedCount;
  } catch (error) {
    loadError = error instanceof Error ? error : new Error("Productiegegevens laden is mislukt.");
  }
  return (
    <StrikShell wide>
      <div className={styles.page}>
        <ProductionPlanningHeader season={season} />
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
      </div>
    </StrikShell>
  );
}
