import type { SupabaseClient } from "@supabase/supabase-js";
import { getCurrentProfile } from "@/app/lib/auth/session";
import { canAccessSinterklaasPath } from "@/app/lib/auth/access";
import { createAdminClient } from "@/app/lib/supabase/admin";
import { loadCentralProduction } from "@/app/sinterklaas/letters/productie/productionData.server";
import { loadProductionWordPressOrders } from "@/app/sinterklaas/sinterklaasServerApi";
import { b2bProductionPlan, batchReadyDate, eligibleB2BLetterOrder } from "@/app/sinterklaas/letters/productie/b2bProductionPlanning";
export const runtime="nodejs";
export const maxDuration=60;
const error=(message:string,status=400)=>Response.json({message},{status});
export async function POST(request:Request){
  const profile=await getCurrentProfile();
  if(!canAccessSinterklaasPath(profile,"/sinterklaas/letters/productie"))return error("Geen toegang tot productie.",403);
  if(request.headers.get("origin")!==new URL(request.url).origin)return error("Ongeldige website.",403);
  let input;try{const raw=await request.text();if(Buffer.byteLength(raw)>16000)return error("De invoer is te groot.",413);input=JSON.parse(raw);}catch{return error("Ongeldig verzoek.");}
  if(!input||typeof input!=="object"||typeof input.orderId!=="string"||input.orderId.length>180||!/^20\d{2}$/.test(input.season||"")||!Number.isInteger(input.revision)||input.revision<0||!(input.batchId===null||/^[0-9a-f-]{36}$/i.test(input.batchId||"")))return error("Controleer de planning.");
  try{
    const [central,wordpress]=await Promise.all([loadCentralProduction(input.season),loadProductionWordPressOrders(input.season)]);
    const order=wordpress.b2b.find(item=>item.id===input.orderId);
    if(!order||!eligibleB2BLetterOrder(order))return error("Alleen definitieve bestellingen met losse chocoladeletters kunnen worden ingepland. Combinatieartikelen horen hier niet bij.",409);
    const plan=b2bProductionPlan(order,central.batches,central.assignments);
    if(input.version!==plan.version||input.revision!==plan.revision)return error("De bestelling of planning is intussen gewijzigd. Ververs de lijst.",409);
    const target=central.batches.find(batch=>batch.id===input.batchId);
    if(input.batchId&&!target)return error("Productieronde niet gevonden.",404);
    if(target&&order.deliveryDate&&batchReadyDate(target)>order.deliveryDate)return error("Deze ronde is te laat voor de gewenste leverdatum.",409);
    const db=createAdminClient() as unknown as SupabaseClient;
    const {error:saveError}=await db.rpc("letter_plan_b2b_order",{p_order_id:order.id,p_season:Number(input.season),p_batch_id:input.batchId,p_previous_batch_id:plan.batchId,p_revision:input.revision,p_actor_id:profile?.id||null});
    if(saveError)return error(saveError.code==="P0001"?saveError.message:"De planning kon niet worden opgeslagen.",409);
    return Response.json({saved:true},{headers:{"Cache-Control":"no-store"}});
  }catch{return error("De planning kon niet worden gecontroleerd. Er is geen bevestigde wijziging.",503);}
}
