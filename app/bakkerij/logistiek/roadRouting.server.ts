import "server-only";
import { createAdminClient } from "@/app/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cleanLocation, roadPair, type AddressLocation, type RoadRoute } from "./roadRouting";
const ROOT = "https://api.pdok.nl/bzk/locatieserver/search/v3_1";
const headers = { "User-Agent": "StrikTeam/1.0 (https://app.strik-patisserie.nl)", Accept: "application/json" };
export async function findAddresses(query: string) {
    const url = new URL(`${ROOT}/suggest`);
    url.searchParams.set("q", query);
    url.searchParams.set("fq", "type:adres");
    url.searchParams.set("rows", "6");
    const response = await fetch(url, { headers, next: { revalidate: 86400 }, signal: AbortSignal.timeout(10000) });
    if (!response.ok)
        throw Error("Adreszoeken is tijdelijk niet beschikbaar.");
    const data = await response.json();
    return (data.response?.docs || []).flatMap((doc: {
        id?: string;
        weergavenaam?: string;
    }) => doc.id && doc.weergavenaam ? [{ id: doc.id, label: doc.weergavenaam }] : []);
}
export async function lookupAddress(id: string): Promise<AddressLocation> {
    const url = new URL(`${ROOT}/lookup`);
    url.searchParams.set("id", id);
    const response = await fetch(url, { headers, next: { revalidate: 2592000 }, signal: AbortSignal.timeout(10000) });
    if (!response.ok)
        throw Error("Dit adres kon niet worden gecontroleerd.");
    const doc = (await response.json()).response?.docs?.[0];
    const point = String(doc?.centroide_ll || "").match(/POINT\s*\(\s*([\d.]+)\s+([\d.]+)\s*\)/);
    const location = point && cleanLocation({ id: doc.id, label: doc.weergavenaam, lon: Number(point[1]), lat: Number(point[2]) });
    if (!location)
        throw Error("Kies een volledig Nederlands adres met huisnummer.");
    return location;
}
export async function resolveAddress(query: string) {
    // Never resolve a company name or a generic town to a guessed address.
    const postcode = query.match(/\b\d{4}\s?[a-z]{2}\b/i)?.[0].replace(/\s/g, "").toUpperCase();
    const street = query.replace(/\b\d{4}\s?[a-z]{2}\b/gi, " ");
    const house = street.match(/\b\d{1,5}[a-z]?\b/i)?.[0];
    if (!house)
        return null;
    const candidates = await findAddresses(postcode ? `${postcode} ${house}` : query);
    if (!candidates.length)
        return null;
    const normalize = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
    const wanted = normalize(query), matches = candidates.filter((item: {
        label: string;
    }) => {
        const actual = normalize(item.label);
        if (!actual.split(" ").includes(normalize(house))) return false;
        if (postcode) return actual.replace(/\s/g, "").includes(postcode.toLowerCase());
        return wanted.split(" ").filter(word => word.length > 2 && !/^\d+$/.test(word)).every(word => actual.includes(word));
    });
    return matches.length === 1 ? lookupAddress(matches[0].id) : null;
}
const cache = new Map<string, {
    until: number;
    road: RoadRoute;
}>();
export async function roadMatrix(locations: Record<string, AddressLocation>): Promise<RoadRoute> {
    const entries = Object.entries(locations);
    if (entries.length > 42)
        throw Error("Deze ronde bevat te veel adressen voor één berekening.");
    const coordinates = entries.map(([, point]) => `${point.lon},${point.lat}`).join(";"), key = JSON.stringify(entries);
    const cached = cache.get(key);
    if (cached && cached.until > Date.now())
        return cached.road;
    // Shared database gate enforces the public routing service's one-request-per-second policy across instances.
    const gate = await (createAdminClient() as unknown as SupabaseClient).rpc("logistics_claim_road_request");
    if (gate.error || !gate.data)
        throw Error("Er loopt net een routeberekening. Probeer het over enkele seconden opnieuw.");
    const response = await fetch(`https://routing.openstreetmap.de/routed-car/table/v1/driving/${coordinates}?annotations=duration`, { headers, signal: AbortSignal.timeout(20000) });
    if (!response.ok)
        throw Error("Rijtijden zijn tijdelijk niet beschikbaar. Er is niets aan de route gewijzigd.");
    const data = await response.json();
    if (data.code !== "Ok" || data.durations?.length !== entries.length)
        throw Error("Voor deze adressen kon geen autoroute worden gevonden.");
    const seconds: Record<string, number> = {};
    entries.forEach(([from], i) => entries.forEach(([to], j) => { const duration = data.durations[i]?.[j]; if (typeof duration === "number" && Number.isFinite(duration) && duration >= 0)
        seconds[roadPair(from, to)] = duration; }));
    const road: RoadRoute = { provider: "OSRM", calculatedAt: new Date().toISOString(), locations, seconds };
    if (cache.size > 40)
        cache.clear();
    cache.set(key, { until: Date.now() + 3600000, road });
    return road;
}
