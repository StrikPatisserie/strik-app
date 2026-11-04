import {getCurrentProfile} from "@/app/lib/auth/session";
import {loadWeeklyOffers} from "@/app/weeklyOffers.server";
export const dynamic="force-dynamic";
export async function GET() {
  const profile=await getCurrentProfile();
  if(!profile?.active)return Response.json({message:"Geen toegang."},{status:403});
  try {return Response.json({offers:await loadWeeklyOffers()},{headers:{"Cache-Control":"private, no-store",Vary:"Cookie"}});}
  catch {return Response.json({message:"Aanbiedingen tijdelijk niet beschikbaar."},{status:503});}
}
