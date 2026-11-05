import "server-only";
import {logosPrintComplete,type LogoPrintState} from "./model";
import type {SupabaseClient} from "@supabase/supabase-js";
import {createAdminClient} from "@/app/lib/supabase/admin";
/** Called only after the B2B response has passed its existing access check. */
export async function withLogoCounts<T extends {id:string}>(orders:T[],year:string) {
 if(!orders.length)return orders;
 try {
  const db=createAdminClient() as unknown as SupabaseClient;
  const grouped=new Map<string,LogoPrintState[]>();
  for(let offset=0;;offset+=500){
   const result=await db.from("b2b_order_logos").select("order_id,quantity,width_cm,height_cm,printed_at,printed_quantity,printed_width_cm,printed_height_cm").eq("season",Number(year)).in("order_id",orders.map(order=>order.id)).order("id").range(offset,offset+499);
   if(result.error)throw Error("unavailable");
   for(const row of result.data||[]){const logos=grouped.get(row.order_id)||[];logos.push(row);grouped.set(row.order_id,logos);}
   if(!result.data||result.data.length<500)break;
  }
  return orders.map(order=>({...order,logoAttachmentCount:grouped.get(order.id)?.length||0,logoPrintComplete:logosPrintComplete(grouped.get(order.id)||[])}));
 }catch{return orders.map(order=>({...order,logoAttachmentCount:null,logoPrintComplete:null}));}
}
