import { roadAccess, roadHeaders } from "@/app/bakkerij/logistiek/roadAccess.server";
import { lookupAddress, resolveAddress, roadMatrix } from "@/app/bakkerij/logistiek/roadRouting.server";
import { bestRoadInsertion, cleanLocation, DEPOT_ID, NEW_STOP_ID, type RoadStop, type AddressLocation } from "@/app/bakkerij/logistiek/roadRouting";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: Request) {
    const denied = await roadAccess(request, true);
    if (denied)
        return denied;
    try {
        const raw = await request.text();
        if (raw.length > 80000)
            throw Error("De route is te groot voor deze berekening.");
        const body = JSON.parse(raw), location = cleanLocation(body.location);
        if (!location || !Array.isArray(body.stops) || body.stops.length > 40 || !Number.isFinite(body.departureMinute) || body.departureMinute < 0 || body.departureMinute > 2880)
            throw Error("Controleer de route en het geselecteerde adres.");
        const stops: RoadStop[] = body.stops.map((stop: RoadStop) => {
            if (!stop || typeof stop.id !== "string" || !stop.id || stop.id.length > 180 || [DEPOT_ID, NEW_STOP_ID, "__proto__", "constructor"].includes(stop.id) || typeof stop.label !== "string" || stop.label.length > 180 || typeof stop.address !== "string" || stop.address.length > 500 || !Number.isFinite(stop.serviceMinutes) || stop.serviceMinutes < 0 || stop.serviceMinutes > 90)
                throw Error("Ongeldige routegegevens.");
            if (stop.deadlineMinute !== undefined && (!Number.isFinite(stop.deadlineMinute) || stop.deadlineMinute < 0 || stop.deadlineMinute > 2880))
                throw Error("Ongeldige levertijd.");
            return { ...stop, location: cleanLocation(stop.location) };
        });
        if (new Set(stops.map(stop => stop.id)).size !== stops.length)
            throw Error("De route bevat dubbele stop-ID’s.");
        const locations: Record<string, AddressLocation> = {};
        const depot = await resolveAddress("Ambachtsweg 4 Malden");
        if (!depot)
            throw Error("Het vertrekadres van de bakkerij kon niet worden herkend.");
        locations[DEPOT_ID] = depot;
        locations[NEW_STOP_ID] = await lookupAddress(location.id);
        const needsAddresses: {
            id: string;
            label: string;
            query: string;
        }[] = [];
        // Small batches keep provider load bounded; never send customer names to routing.
        for (let i = 0; i < stops.length; i += 4)
            await Promise.all(stops.slice(i, i + 4).map(async (stop) => {
                const found = stop.location || await resolveAddress(stop.address);
                if (found)
                    locations[stop.id] = found;
                else
                    needsAddresses.push({ id: stop.id, label: stop.label, query: stop.address });
            }));
        if (needsAddresses.length)
            return Response.json({ needsAddresses }, { headers: roadHeaders });
        const serviceMinutes = Number(body.serviceMinutes ?? 5);
        if (!Number.isFinite(serviceMinutes) || serviceMinutes < 0 || serviceMinutes > 90)
            throw Error("Controleer de stoptijd.");
        const deadline = body.deadlineMinute;
        if (deadline !== undefined && (!Number.isFinite(deadline) || deadline < 0 || deadline > 2880))
            throw Error("Controleer de uiterste aankomsttijd.");
        const road = await roadMatrix(locations), added: RoadStop = { id: NEW_STOP_ID, label: "Nieuwe stop", address: locations[NEW_STOP_ID].label, location: locations[NEW_STOP_ID], serviceMinutes, deadlineMinute: deadline };
        return Response.json({ suggestion: bestRoadInsertion(stops, added, road, body.departureMinute), road, location: locations[NEW_STOP_ID] }, { headers: roadHeaders });
    }
    catch (error) {
        return Response.json({ message: error instanceof Error ? error.message : "De route kon niet worden berekend." }, { status: 503, headers: roadHeaders });
    }
}
