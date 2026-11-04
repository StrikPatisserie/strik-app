import {loadWeeklyOffers} from "@/app/weeklyOffers.server";
import { getCurrentProfile } from "@/app/lib/auth/session";
import { productionDepartments } from "@/app/productie/access";
import { readProductionImage } from "@/app/productie/media.server";
export const dynamic = "force-dynamic";
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}) {
  const profile=await getCurrentProfile();
  if(!profile?.active)return new Response("Geen toegang",{status:403});
  try {
    const {id}=await params;
    if(!productionDepartments(profile).length) {
      const offers=await loadWeeklyOffers();
      if(!offers.some(offer=>offer.imageUrl===`/api/recepturen/media/${id}`))return new Response("Geen toegang",{status:403});
    }
    const image = await readProductionImage(id);
    if (!image) return new Response("Niet gevonden",{status:404});
    return new Response(new Uint8Array(image.bytes),{headers:{"Content-Type":image.contentType,"Cache-Control":"private, max-age=3600, immutable",Vary:"Cookie","X-Content-Type-Options":"nosniff"}});
  } catch { return new Response("Foto tijdelijk niet bereikbaar",{status:503}); }
}
