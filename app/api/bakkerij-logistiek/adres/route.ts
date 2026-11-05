import { roadAccess, roadHeaders } from "@/app/bakkerij/logistiek/roadAccess.server";
import { findAddresses, lookupAddress } from "@/app/bakkerij/logistiek/roadRouting.server";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
    const denied = await roadAccess(request);
    if (denied)
        return denied;
    const params = new URL(request.url).searchParams, id = params.get("id"), q = params.get("q")?.trim() || "";
    if (id ? (!id || id.length > 200) : q.length < 3 || q.length > 200)
        return Response.json({ message: "Vul straat, huisnummer en plaats in." }, { status: 400, headers: roadHeaders });
    try {
        return Response.json(id ? { location: await lookupAddress(id) } : { suggestions: await findAddresses(q) }, { headers: roadHeaders });
    }
    catch (error) {
        return Response.json({ message: error instanceof Error ? error.message : "Adreszoeken is tijdelijk niet beschikbaar." }, { status: 503, headers: roadHeaders });
    }
}
