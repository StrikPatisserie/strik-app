import { getCurrentProfile } from "@/app/lib/auth/session";
import { productionDepartments } from "@/app/productie/access";
import { readProductionImage } from "@/app/productie/media.server";
export const dynamic = "force-dynamic";
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}) {
  if (!productionDepartments(await getCurrentProfile()).length) return new Response("Geen toegang",{status:403});
  try {
    const image = await readProductionImage((await params).id);
    if (!image) return new Response("Niet gevonden",{status:404});
    return new Response(new Uint8Array(image.bytes),{headers:{"Content-Type":image.contentType,"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
  } catch { return new Response("Foto tijdelijk niet bereikbaar",{status:503}); }
}
