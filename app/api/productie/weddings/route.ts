import { getCurrentProfile } from "@/app/lib/auth/session";
import { canAccessBakkerijPatisserie, hasFullAccess } from "@/app/lib/auth/access";
import { ProductionStoreError, readDocument, saveDocument } from "@/app/productie/documents.server";
import { getWeddingCakeStudioUrl, normalizeDraftList } from "@/app/bruidstaart-studio/studioApi";
import { weddingOrders, scheduleWedding } from "@/app/productie/weddingPlanning";
import { addDays, mondayOf, type PreviewState } from "@/app/productie/planning";
const headers={"Cache-Control":"private, no-store"};
export const dynamic="force-dynamic";
async function readCakes(search?:string,date?:string){
  const response=await fetch(getWeddingCakeStudioUrl(search,date),{cache:"no-store",signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw new ProductionStoreError("De bruidstaartgegevens zijn tijdelijk niet bereikbaar; controleer de Studio.");
  return normalizeDraftList(await response.json());
}
export async function GET(request:Request){
 const profile=await getCurrentProfile();if(!profile?.active || !canAccessBakkerijPatisserie(profile))return Response.json({message:"Geen toegang tot bruidstaartproductie."},{status:403,headers});
 try{
  const week=mondayOf(new URL(request.url).searchParams.get("week") || ""),end=addDays(week,6);
  const planner=await readDocument<PreviewState>("planner");
  const results=await Promise.all(Array.from({length:7},(_,i)=>readCakes(undefined,addDays(week,i))));
  let orders=weddingOrders(results.flat()).filter(o=>o.date>=week && o.date<=end);
  const linked=[...new Set(planner?.data.tasks.filter(t=>t.weddingCode && t.date>=week && t.date<=end).map(t=>t.weddingCode!) || [])].filter(code=>!orders.some(o=>o.code.toLowerCase()===code.toLowerCase()));
  if(linked.length>100)throw new ProductionStoreError("Te veel bruidstaarten in één week; controleer de planning.");
  // Bound concurrent requests when moved tasks fall outside the delivery week.
  for(let offset=0;offset<linked.length;offset+=7){const extra=await Promise.all(linked.slice(offset,offset+7).map(async code=>weddingOrders(await readCakes(code)).find(o=>o.code.toLowerCase()===code.toLowerCase())));orders.push(...extra.filter((o):o is NonNullable<typeof o>=>!!o));}
  orders=orders.filter((o,index)=>orders.findIndex(n=>n.code.toLowerCase()===o.code.toLowerCase())===index);
  return Response.json({orders},{headers});
 }catch(error){return Response.json({message:error instanceof Error?error.message:"Bruidstaarten laden is mislukt."},{status:error instanceof ProductionStoreError?error.status:400,headers});}
}
export async function POST(request:Request){
 const profile=await getCurrentProfile();if(!profile?.active || !canAccessBakkerijPatisserie(profile))return Response.json({message:"Geen toegang tot bruidstaartproductie."},{status:403,headers});
 const origin=request.headers.get("origin");if(origin && origin!==new URL(request.url).origin)return Response.json({message:"Ongeldige website."},{status:403,headers});
 try{
  const text=await request.text();if(text.length>10000)throw new ProductionStoreError("De wijziging is te groot.",413);
  const incoming=JSON.parse(text);if(typeof incoming.code!=="string" || incoming.code.length>100)throw new ProductionStoreError("Kies een geldige bruidstaart.",400);
  const planner=await readDocument<PreviewState>("planner");if(!planner)throw new ProductionStoreError("De productieplanning is niet beschikbaar.");
  if(incoming.revision!==planner.revision)throw new ProductionStoreError("De planning is intussen gewijzigd. Ververs eerst; er is niets opgeslagen.",409);
  const order=weddingOrders(await readCakes(incoming.code)).find(o=>o.code.toLowerCase()===incoming.code.toLowerCase());
  if(!order)throw new ProductionStoreError("Deze definitieve bruidstaart is niet meer beschikbaar. Ververs de planning.",409);
  const current=planner.data.tasks.find(t=>t.weddingCode?.toLowerCase()===order.code.toLowerCase());
  if(!hasFullAccess(profile) && (incoming.date!==(current?.date || order.date) || (current && current.departmentId!=="bruidstaarten")))throw new ProductionStoreError("Alleen managers kunnen de productiedatum wijzigen.",403);
  const next=scheduleWedding(planner.data,order,incoming.date,incoming.status);
  const revision=await saveDocument("planner",planner.revision,next,profile.id,`Bruidstaart ${order.code}: productieplanning bijgewerkt`);
  return Response.json({state:next,revision,updatedAt:new Date().toISOString()},{headers});
 }catch(error){return Response.json({message:error instanceof Error?error.message:"Opslaan is mislukt."},{status:error instanceof ProductionStoreError?error.status:400,headers});}
}
