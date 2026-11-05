"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { BusinessSeason } from "../../lib/businessSeasons";
import type { ProductionTotals } from "./productionTotals";
import { applyBakeItCommand, emptyBakeItState, readBakeItState, type BakeItCommand, type BakeItState } from "./bakeItRegistrations";

export function useBakeItRegistrations(season: BusinessSeason, year: string, totals: ProductionTotals, preview: boolean) {
  const [state, setState] = useState<BakeItState>(emptyBakeItState);
  const [ready, setReady] = useState(false), [error, setError] = useState("");
  const current = useRef(state), mounted = useRef(true);
  const storageKey = `strik-preview-b2b-bakeit:${season}:${year}`;
  const endpoint = `/api/b2b-bakeit?season=${season}&year=${year}`;
  const accept = useCallback((next: BakeItState) => {
    if (!mounted.current) return;
    if (next.revision >= current.current.revision) { current.current = next; setState(next); }
    setReady(true);
  }, []);
  const refresh = useCallback(async () => {
    try {
      if (preview) accept(readBakeItState(JSON.parse(localStorage.getItem(storageKey) || "null")));
      else {
        const response = await fetch(endpoint, { cache: "no-store" });
        const body = await response.json();
        if (!response.ok) throw Error(body.message || "Bake-it-registraties laden is mislukt.");
        accept(readBakeItState(body.state));
      }
      if (mounted.current) setError("");
    } catch (e) { if (mounted.current) setError(e instanceof Error ? e.message : "Laden mislukt."); }
  }, [accept, endpoint, preview, storageKey]);
  useEffect(() => {
    mounted.current = true;
    void refresh();
    const update = () => { if (!document.hidden) void refresh(); };
    const changed = (event: StorageEvent) => { if (event.key === storageKey) update(); };
    window.addEventListener("focus", update);
    window.addEventListener("storage", changed);
    const timer = setInterval(update, 20000);
    return () => { mounted.current = false; window.removeEventListener("focus", update); window.removeEventListener("storage", changed); clearInterval(timer); };
  }, [refresh, storageKey]);
  async function save(command: BakeItCommand, revision: number) {
    if (!ready || error) throw Error("Laad eerst de actuele Bake-it-registraties.");
    const previous = current.current;
    if (previous.history.some(item => item.operationId === command.operationId)) return;
    if (revision !== previous.revision) throw Error("De Bake-it-registraties zijn intussen gewijzigd. Sluit deze invoer en open hem opnieuw.");
    if (preview) {
      const latest = readBakeItState(JSON.parse(localStorage.getItem(storageKey) || "null"));
      if (latest.revision !== previous.revision) { accept(latest); throw Error("De lokale proefregistratie is gewijzigd. Controleer het aantal en probeer opnieuw."); }
      const next = applyBakeItCommand(previous, command, totals, "Lokale proef", new Date().toISOString());
      localStorage.setItem(storageKey, JSON.stringify(next));
      accept(next);
      return;
    }
    try {
      const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ revision: previous.revision, command }) });
      const body = await response.json();
      if (!response.ok) throw Error(body.message || "Registreren is mislukt.");
      accept(readBakeItState(body.state));
    } catch (e) {
      // Re-read an ambiguous response before offering another save. The same
      // operation ID is also idempotent on the server.
      await refresh();
      if (current.current.history.some(item => item.operationId === command.operationId)) return;
      throw e;
    }
  }
  return { state, ready, error, refresh, save };
}
