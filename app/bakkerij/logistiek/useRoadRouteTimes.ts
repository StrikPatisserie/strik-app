"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cleanRoad, roadLegMinutes, roadStopAddress, DEPOT_ID, type AddressLocation, type RoadRoute } from "./roadRouting";

type Stop = { id: string; label: string; detail: string; learningTarget?: string; location?: AddressLocation };
type Round = { id: string; stops: Stop[]; road?: RoadRoute };

export function roadRouteKey(route: Round) {
  return JSON.stringify(route.stops.map(stop => [stop.id, roadStopAddress(stop), stop.location || null])
    .sort((a, b) => String(a[0]).localeCompare(String(b[0]))));
}

export function useRoadRouteTimes<T extends Round>(routes: T[], enabled: boolean) {
  const [calculated, setCalculated] = useState<Record<string, RoadRoute>>({});
  const [message, setMessage] = useState("");
  const cache = useRef(new Map<string, RoadRoute>());
  const snapshot = useRef(routes);
  const signature = JSON.stringify(routes.map(roadRouteKey));
  useEffect(() => { snapshot.current = routes; }, [routes]);

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    const current = snapshot.current;
    async function calculate() {
      let unresolved = 0;
      try {
        for (const route of current) {
          if (!route.stops.length || route.stops.length > 40) continue;
          const key = roadRouteKey(route);
          if (cache.current.has(key)) continue;
          const locations = route.stops.map(stop => ({
            id: stop.id,
            address: roadStopAddress(stop),
            location: stop.location,
          }));
          if (locations.every(stop => roadLegMinutes(route.road, DEPOT_ID, stop.id, undefined, stop.location) !== null)) continue;
          setMessage("Rijtijden berekenen…");
          // Rounds run sequentially to share the provider's request limit.
          const response = await fetch("/api/bakkerij-logistiek/route-times", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ stops: locations }), signal: controller.signal,
          });
          const data = await response.json();
          if (!response.ok) throw Error("Rijtijden tijdelijk niet beschikbaar · schattingen zichtbaar");
          if (controller.signal.aborted) return;
          const road = cleanRoad(data.road);
          unresolved += Array.isArray(data.unresolved) ? data.unresolved.length : 0;
          if (road) {
            if (cache.current.size >= 40) cache.current.clear();
            cache.current.set(key, road);
            setCalculated(Object.fromEntries(cache.current));
          }
          await new Promise<void>(resolve => {
            const timer = setTimeout(resolve, 1100);
            controller.signal.addEventListener("abort", () => { clearTimeout(timer); resolve(); }, { once: true });
          });
          if (controller.signal.aborted) return;
        }
        if (!controller.signal.aborted) setMessage(unresolved ? "Enkele adressen controleren · schattingen zichtbaar" : "");
      } catch {
        if (!controller.signal.aborted) setMessage("Rijtijden tijdelijk niet beschikbaar · schattingen zichtbaar");
      }
    }
    void calculate();
    return () => controller.abort();
  }, [signature, enabled]);

  const enriched = useMemo(() => routes.map(route => {
    const road = calculated[roadRouteKey(route)];
    return road ? { ...route, road, stops: route.stops.map(stop => ({ ...stop, location: road.locations[stop.id] || stop.location })) } as T : route;
  }), [routes, calculated]);
  return {
    message,
    routes: enriched,
  };
}
