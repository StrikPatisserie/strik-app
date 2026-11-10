import { roadAccess, roadHeaders } from "@/app/bakkerij/logistiek/roadAccess.server";
import { resolveAddress, roadMatrix } from "@/app/bakkerij/logistiek/roadRouting.server";
import { cleanLocation, DEPOT_ID, type AddressLocation } from "@/app/bakkerij/logistiek/roadRouting";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const denied = await roadAccess(request, true);
  if (denied) return denied;
  try {
    const raw = await request.text();
    if (raw.length > 80000) throw Error("De route is te groot voor deze berekening.");
    const body = JSON.parse(raw);
    if (!Array.isArray(body.stops) || body.stops.length > 40) throw Error("Controleer de routeadressen.");
    const ids = new Set<string>();
    const stops = body.stops.map((stop: { id: string; address: string; location?: AddressLocation }) => {
      if (!stop || typeof stop.id !== "string" || !stop.id || stop.id.length > 180
        || [DEPOT_ID, "__new", "__proto__", "constructor"].includes(stop.id) || ids.has(stop.id)
        || typeof stop.address !== "string" || stop.address.length > 500) throw Error("Controleer de routeadressen.");
      ids.add(stop.id);
      return { id: stop.id, address: stop.address, location: cleanLocation(stop.location) };
    });
    const depot = await resolveAddress("Ambachtsweg 4 Malden");
    if (!depot) throw Error("Het vertrekadres kon niet worden herkend.");
    const locations: Record<string, AddressLocation> = { [DEPOT_ID]: depot };
    const unresolved: string[] = [];
    // Resolve complete addresses only. A missing address keeps its labelled estimate.
    for (let offset = 0; offset < stops.length; offset += 4) {
      await Promise.all(stops.slice(offset, offset + 4).map(async (stop: { id: string; address: string; location?: AddressLocation }) => {
        const location = stop.location || await resolveAddress(stop.address);
        if (location) locations[stop.id] = location;
        else unresolved.push(stop.id);
      }));
    }
    const road = Object.keys(locations).length > 1 ? await roadMatrix(locations) : undefined;
    return Response.json({ road, unresolved }, { headers: roadHeaders });
  } catch (error) {
    return Response.json({ message: error instanceof Error ? error.message : "Rijtijden zijn tijdelijk niet beschikbaar." }, { status: 503, headers: roadHeaders });
  }
}
