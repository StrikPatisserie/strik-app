import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/app/lib/supabase/admin";
import { amsterdamYear, type ArchiveSources, type HolidayId, type Season, type SeasonArchive } from "./model";
export const seasonDb = () => createAdminClient() as unknown as SupabaseClient;
export async function getSeasons(): Promise<Season[]> {
  const {data,error}=await seasonDb().from("holiday_seasons").select("*").order("year",{ascending:false});
  if(error) throw Error("De seizoenen konden niet worden geladen. Probeer opnieuw.");
  return data || [];
}
export async function getSeason(id: string, year: number): Promise<Season|null> {
  const {data,error}=await seasonDb().from("holiday_seasons").select("*").eq("season",id).eq("year",year).maybeSingle();
  if(error) throw Error("De seizoensinstellingen konden niet worden gecontroleerd.");
  return data;
}
export async function getActiveSeason(id: HolidayId): Promise<Season|null> {
  const {data,error}=await seasonDb().from("holiday_seasons").select("*").eq("season",id).eq("state","active").maybeSingle();
  if(error) throw Error("De seizoensinstellingen konden niet worden gecontroleerd.");
  return data;
}
export async function requireOpenSeason(id: HolidayId, year: number, module?: "letters"|"business"|"mailing") {
  const season=await getSeason(id,year);
  if(!season || season.state!=="active" || (module && !season.config[module])) throw Error("Dit seizoen of onderdeel staat uit. Open het eerst via Feestdagen.");
  return season;
}
export async function getSeasonArchive(id: string,year: number): Promise<SeasonArchive|null> {
  const {data,error}=await seasonDb().from("holiday_archives").select("*").eq("season",id).eq("year",year).maybeSingle();
  if(error) throw Error("Het bewaarde seizoen kon niet worden geladen.");
  return data;
}
export async function getPreviousArchive(id: string,year: number): Promise<SeasonArchive|null> {
  const {data,error}=await seasonDb().from("holiday_archives").select("*").eq("season",id).lt("year",year).order("year",{ascending:false}).limit(1).maybeSingle();
  if(error) throw Error("De vorige evaluatie kon niet worden geladen.");
  return data;
}
export async function wordpressSeason(id: HolidayId,year: number,action:"read"|"open"|"close",config?: Season["config"]): Promise<ArchiveSources> {
  if(!["sint","kerst"].includes(id)) return {complete:true,capturedAt:new Date().toISOString(),letters:[],b2b:[],mailing:[]};
  const url=new URL(`${process.env.WORDPRESS_SINTERKLAAS_API_BASE||"https://strik-patisserie.nl/wp-json/strik/v1"}/holiday-season`);
  url.searchParams.set("key",process.env.WORDPRESS_SINTERKLAAS_API_KEY||process.env.WORDPRESS_STRIK_API_KEY||"schoonmaak-ijs-strik");
  const response=await fetch(url,{method:"POST",cache:"no-store",headers:{"Content-Type":"application/json"},body:JSON.stringify({season:id,year,action,config}),signal:AbortSignal.timeout(25000)});
  const data=await response.json().catch(()=>null);
  if(!response.ok||data?.complete!==true||![data.letters,data.b2b,data.mailing].every(Array.isArray)) throw Error("De bestelopslag heeft de seizoensactie nog niet bevestigd. Probeer opnieuw; de voortgang blijft bewaard.");
  return data;
}
export async function previewCentral(year: number) {
  const db=seasonDb();
  async function all(make:()=>{range:(from:number,to:number)=>PromiseLike<{data:Record<string,unknown>[]|null;error:unknown}>}){
    const result:Record<string,unknown>[]=[];
    for(let from=0;;from+=500){const r=await make().range(from,from+499);if(r.error)throw Error("Niet alle productiegegevens konden worden gecontroleerd.");result.push(...(r.data||[]));if((r.data||[]).length<500)return result;}
  }
  const [orders,items,batches]=await Promise.all([
    all(()=>db.from("letter_orders").select("id,channel,fulfillment_status,order_number,gift_wrap,gift_wrap_price_cents").gte("requested_date",`${year}-01-01`).lt("requested_date",`${year+1}-01-01`).order("id")),
    all(()=>db.from("letter_order_items").select("id,order_id,quantity,unit_price_cents,logo_price_cents,letter_orders!inner(requested_date)").gte("letter_orders.requested_date",`${year}-01-01`).lt("letter_orders.requested_date",`${year+1}-01-01`).order("id")),
    all(()=>db.from("letter_production_batches").select("id,status").eq("season",year).order("id")),
  ]);
  return {orders,items,batches};
}
export async function defaultBusinessYear(id:"sint"|"kerst") { return (await getActiveSeason(id))?.year || amsterdamYear(); }

export async function checkSeasonMutation(endpoint:string,params:Record<string,unknown>,existing?:Record<string,unknown>){
  const part=endpoint==="sinterklaas-letter-orders"?"letters":endpoint==="sinterklaas-mailing"?"mailing":"business";
  async function check(input:Record<string,unknown>){
    const date=String(input.pickupDate||input.deliveryDate||"");
    const year=Number(input.year||date.slice(0,4)||amsterdamYear());
    const selection=part==="letters"?"sint":String(input.selection||input.season||"sint");
    if(year<2026)return;
    const ids=selection==="sint-kerst"?["sint","kerst"]:[selection];
    const states=await Promise.all(ids.map(id=>getSeason(id,year)));
    const isOpen=(s:Season|null)=>s?.state==="active"&&s.config[part];
    if(part==="business"&&selection==="sint-kerst"? !states.some(isOpen):!states.every(isOpen))throw Error("Dit seizoen of onderdeel staat uit. Open het eerst via Feestdagen.");
  }
  if(existing)await check(existing);
  await check({...existing,...params});
}
