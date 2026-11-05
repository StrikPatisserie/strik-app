import "server-only";
import { getCurrentProfile } from "@/app/lib/auth/session";
import { canAccessPath } from "@/app/lib/auth/access";
export const roadHeaders = { "Cache-Control": "private, no-store", Vary: "Cookie" };
export async function roadAccess(request: Request, mutate = false) {
    const profile = await getCurrentProfile();
    if (!canAccessPath(profile, "/bakkerij/logistiek"))
        return Response.json({ message: "Geen toegang tot logistiek." }, { status: 403, headers: roadHeaders });
    if (mutate && request.headers.get("origin") !== new URL(request.url).origin)
        return Response.json({ message: "Ongeldige website." }, { status: 403, headers: roadHeaders });
    return null;
}
