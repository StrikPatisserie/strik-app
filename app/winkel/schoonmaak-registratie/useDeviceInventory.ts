"use client";

import { useCallback, useEffect, useState } from "react";
import type { InventoryChange } from "./deviceInventory";
import type { TemperatureDeviceConfig } from "./temperatureRegistrationShared";

export function useDeviceInventory(enabled: boolean) {
  const [changes, setChanges] = useState<InventoryChange[]>([]);
  const [ready, setReady] = useState(!enabled);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    fetch("/api/temperature-devices", { cache: "no-store" }).then(async (response) => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Apparatenlijst laden mislukt.");
      if (!cancelled) { setChanges(data.changes); setReady(true); }
    }).catch((err) => { if (!cancelled) setError(err.message); });
    return () => { cancelled = true; };
  }, [enabled]);

  const save = useCallback(async (deviceId: string, device: Exclude<TemperatureDeviceConfig, string> | null) => {
    const response = await fetch("/api/temperature-devices", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ deviceId, device }) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "Apparatenlijst opslaan mislukt.");
    setChanges(data.changes);
  }, []);
  return { changes, ready, error, save };
}
