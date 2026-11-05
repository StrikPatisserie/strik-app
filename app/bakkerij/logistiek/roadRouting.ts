export type AddressLocation = {
    id: string;
    label: string;
    lat: number;
    lon: number;
};
export type RoadRoute = {
    provider: "OSRM";
    calculatedAt: string;
    locations: Record<string, AddressLocation>;
    seconds: Record<string, number>;
};
export type RoadStop = {
    id: string;
    label: string;
    address: string;
    location?: AddressLocation;
    serviceMinutes: number;
    deadlineMinute?: number;
};
export type SmartStopInsertion = {
    index: number;
    snapshot: string;
    serviceMinutes: number;
    location: AddressLocation;
    road?: RoadRoute;
};
export const DEPOT_ID = "__depot", NEW_STOP_ID = "__new";
export function cleanLocation(value: unknown): AddressLocation | undefined {
    if (!value || typeof value !== "object")
        return;
    const v = value as AddressLocation;
    if (typeof v.id !== "string" || !v.id || v.id.length > 200 || typeof v.label !== "string" || !v.label || v.label.length > 350 || !Number.isFinite(v.lat) || !Number.isFinite(v.lon) || v.lat < 50 || v.lat > 54 || v.lon < 3 || v.lon > 8)
        return;
    return { id: v.id, label: v.label, lat: v.lat, lon: v.lon };
}
export const roadPair = (from: string, to: string) => JSON.stringify([from, to]);
export function cleanRoad(value: unknown): RoadRoute | undefined {
    if (!value || typeof value !== "object")
        return;
    const v = value as RoadRoute;
    if (v.provider !== "OSRM" || typeof v.calculatedAt !== "string" || !Number.isFinite(Date.parse(v.calculatedAt)) || !v.locations || !v.seconds)
        return;
    const locations: Record<string, AddressLocation> = {}, seconds: Record<string, number> = {};
    const entries = Object.entries(v.locations);
    if (entries.length > 42)
        return;
    for (const [id, raw] of entries) {
        const location = cleanLocation(raw);
        if (!location || id.length > 180 || id === "__proto__" || id === "constructor")
            return;
        locations[id] = location;
    }
    const pairs = Object.entries(v.seconds);
    if (pairs.length > 1764)
        return;
    for (const [key, duration] of pairs) {
        let pair;
        try {
            pair = JSON.parse(key);
        }
        catch {
            return;
        }
        if (!Array.isArray(pair) || pair.length !== 2 || !pair.every(id => typeof id === "string" && Object.hasOwn(locations, id)) || !Number.isFinite(duration) || duration < 0 || duration > 86400)
            return;
        seconds[key] = duration;
    }
    return { provider: "OSRM", calculatedAt: v.calculatedAt, locations, seconds };
}
export function routeFingerprint(stops: {
    id: string;
    label: string;
    detail: string;
    location?: AddressLocation;
}[]) { return JSON.stringify(stops.map(stop => [stop.id, stop.label, stop.detail, stop.location || null])); }
export function roadLegMinutes(road: RoadRoute | undefined, from: string, to: string, fromLocation?: AddressLocation, toLocation?: AddressLocation) {
    if (!road || !road.locations[from] || !road.locations[to])
        return null;
    for (const [id, location] of [[from, fromLocation], [to, toLocation]] as const) {
        if (id !== DEPOT_ID && (!location || location.lat !== road.locations[id].lat || location.lon !== road.locations[id].lon))
            return null;
    }
    const seconds = road.seconds[roadPair(from, to)];
    return Number.isFinite(seconds) ? Math.ceil(seconds / 60) : null;
}
export function renameRoadPoint(road: RoadRoute, from: string, to: string): RoadRoute {
    return { ...road, locations: Object.fromEntries(Object.entries(road.locations).map(([key, value]) => [key === from ? to : key, value])), seconds: Object.fromEntries(Object.entries(road.seconds).map(([key, value]) => { const pair = JSON.parse(key) as string[]; return [roadPair(pair[0] === from ? to : pair[0], pair[1] === from ? to : pair[1]), value]; })) };
}
function schedule(stops: RoadStop[], road: RoadRoute, departure: number) {
    let previous = DEPOT_ID, minute = departure, lateMinutes = 0, lateStops = 0;
    for (const stop of stops) {
        const seconds = road.seconds[roadPair(previous, stop.id)];
        if (!Number.isFinite(seconds))
            throw Error("Voor een adres is geen autoroute gevonden.");
        minute += Math.ceil(seconds / 60);
        if (stop.deadlineMinute !== undefined && minute > stop.deadlineMinute) {
            lateMinutes += minute - stop.deadlineMinute;
            lateStops++;
        }
        minute += stop.serviceMinutes;
        previous = stop.id;
    }
    const back = road.seconds[roadPair(previous, DEPOT_ID)];
    if (!Number.isFinite(back))
        throw Error("De terugreis kon niet worden berekend.");
    return { end: minute + Math.ceil(back / 60), lateMinutes, lateStops };
}
export function bestRoadInsertion(stops: RoadStop[], added: RoadStop, road: RoadRoute, departure: number) {
    const baseline = schedule(stops, road, departure);
    return Array.from({ length: stops.length + 1 }, (_, index) => { const next = [...stops.slice(0, index), added, ...stops.slice(index)], timing = schedule(next, road, departure); return { index, extraMinutes: timing.end - baseline.end, lateStops: timing.lateStops, lateMinutes: timing.lateMinutes, returnMinute: timing.end, score: (timing.lateStops - baseline.lateStops) * 100000 + (timing.lateMinutes - baseline.lateMinutes) * 100 + timing.end - baseline.end }; }).sort((a, b) => a.score - b.score || a.index - b.index)[0];
}
