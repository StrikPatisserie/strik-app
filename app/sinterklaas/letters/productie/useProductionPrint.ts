"use client";

import { useRef, useState } from "react";
import { flushSync } from "react-dom";
import type { ProductionBatchSeed } from "./ProductionPlanningClient";

export type PrepareProductionPrint = (batch: ProductionBatchSeed) => Promise<ProductionBatchSeed>;

// Print only the snapshot confirmed by the server, never the stale preview.
export function useProductionPrint(initial: ProductionBatchSeed, prepare?: PrepareProductionPrint) {
  const [batch, setBatch] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef(false);
  const unconfirmed = Boolean(batch.supplementId && !batch.checklist?.lockedAt);
  async function print() {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      if (batch.supplementId && !prepare) throw new Error("Vastzetten is niet beschikbaar. Sluit dit voorbeeld en ververs de planning.");
      const confirmed = prepare ? await prepare(batch) : batch;
      if (confirmed.supplementId && !confirmed.checklist?.lockedAt) throw new Error("Vastzetten is niet bevestigd. Er is niets geprint.");
      flushSync(() => setBatch(confirmed));
      window.print();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Printen is mislukt. Controleer de planning opnieuw.");
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return { batch, busy, error, unconfirmed, print };
}
