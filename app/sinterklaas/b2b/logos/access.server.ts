import "server-only";
import type {SupabaseClient} from "@supabase/supabase-js";
import {createAdminClient} from "@/app/lib/supabase/admin";
import {getAuthorizedSinterklaasProfile,loadProductionB2BOrders} from "../../sinterklaasServerApi";
export const logoHeaders={"Cache-Control":"private, no-store",Vary:"Cookie"};
export async function logoContext(request:Request,mutate=false) {
  const profile=await getAuthorizedSinterklaasProfile("sinterklaas-b2b-orders");
  if(!profile)return{error:Response.json({message:"Geen toegang tot B2B-logo’s."},{status:403,headers:logoHeaders})};
  if(mutate&&request.headers.get("origin")!==new URL(request.url).origin)return{error:Response.json({message:"Ongeldige website."},{status:403,headers:logoHeaders})};
  const params=new URL(request.url).searchParams,orderId=params.get("orderId")||"",year=params.get("year")||"";
  if(!orderId||orderId.length>180||/[\x00-\x1f]/.test(orderId)||!/^20\d{2}$/.test(year))return{error:Response.json({message:"Ongeldige bestelling."},{status:400,headers:logoHeaders})};
  try {
    const orders=await loadProductionB2BOrders(year);
    if(!orders.some(order=>order.id===orderId))return{error:Response.json({message:"Bestelling niet gevonden."},{status:404,headers:logoHeaders})};
    return{profile,orderId,year:Number(year),db:createAdminClient() as unknown as SupabaseClient};
  } catch {return{error:Response.json({message:"De bestelling kon niet worden gecontroleerd. Probeer opnieuw."},{status:503,headers:logoHeaders})};}
}
