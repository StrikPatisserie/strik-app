import "server-only";
import type {SupabaseClient} from "@supabase/supabase-js";
import {createAdminClient} from "@/app/lib/supabase/admin";
/** Called only after the B2B response has passed its existing access check. */
export async function withLogoCounts<T extends {id:string}>(orders:T[],year:string) {
 if(!orders.length)return orders;
 try {
  const db=createAdminClient() as unknown as SupabaseClient;
  const counts=new Map<string,number>();
  for(let offset=0;;offset+=500){
   const result=await db.from("b2b_order_logos").select("order_id").eq("season",Number(year)).in("order_id",orders.map(order=>order.id)).order("id").range(offset,offset+499);
   if(result.error)throw Error("unavailable");
   for(const row of result.data||[])counts.set(row.order_id,(counts.get(row.order_id)||0)+1);
   if(!result.data||result.data.length<500)break;
  }
  return orders.map(order=>({...order,logoAttachmentCount:counts.get(order.id)||0}));
 }catch{return orders.map(order=>({...order,logoAttachmentCount:null}));}
}
