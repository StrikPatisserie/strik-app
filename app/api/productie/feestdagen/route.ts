import { createHash } from "node:crypto";
import { getCurrentProfile } from "@/app/lib/auth/session";
import { productionDepartments } from "@/app/productie/access";
import { loadProductionB2BOrders,saveProductionB2BProgress } from "@/app/sinterklaas/sinterklaasServerApi";
import { GET as readLetters,POST as saveLetters } from "@/app/api/sinterklaas-letter-production/route";
import { holidayOrder,productionHolidayOrders,PRODUCTION_HOLIDAYS } from "@/app/productie/holidayPlanning";
const headers={"Cache-Control":"private, no-store"};
export const dynamic="force-dynamic";
export const maxDuration=60;
function parameters(request:Request){const query=new URL(request.url).searchParams,season=query.get("season") || "sint",year=query.get("year") || new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Amsterdam",year:"numeric"}).format(new Date());if(!PRODUCTION_HOLIDAYS.some(h=>h.id===season) || !/^20\d{2}$/.test(year))throw Error("Kies een geldig feestdagenseizoen en jaar.");return{season,year};}
// Canonical responses include full recipient metadata. Only the success flag
// or a user-facing error may cross this operational adapter after writing.
async function letterResult(response:Response){const data=await response.json();return Response.json(response.ok?{ok:true}:{message:data.message || "Productie opslaan is mislukt."},{status:response.status,headers});}
export async function GET(request:Request){
 const profile=await getCurrentProfile();if(!productionDepartments(profile).length)return Response.json({message:"Geen toegang tot productie."},{status:403,headers});
 try{const {season,year}=parameters(request);const [orders,letters]=await Promise.all([loadProductionB2BOrders(year),season==="sint"?readLetters(new Request(`https://app.strik-patisserie.nl/api/sinterklaas-letter-production?season=${year}`)):Promise.resolve(Response.json({batches:[]}))]);
 const source=await letters.json();const batches=letters.ok?source.batches:[];
 const projectedOrders=productionHolidayOrders(orders,season).map(order=>{const plan=source.b2bPlanning?.find((p:{id:string;batchId:string})=>p.id===order.id),batch=batches.find((b:{id:string})=>b.id===plan?.batchId);return {...order,...(batch?{letterProductionDate:batch.startDate || batch.date,letterProductionEnd:batch.date}:{})};});
 return Response.json({orders:projectedOrders,batches:batches.map((b:{id:string;startDate:string;date:string;status:string;deadlineAt?:string;checklist?:{revision:number;planVersion:string;changes:{key:string;label:string;before:number;after:number}[]};rows:{key:string;label:string;orders:number;stock:number;produced:number;recipients?:{customerName:string;quantity:number}[]}[]})=>({id:b.id,startDate:b.startDate,date:b.date,status:b.status,deadlineAt:b.deadlineAt,checklist:b.checklist?{revision:b.checklist.revision,changes:b.checklist.changes.map(c=>({key:c.key,label:c.label,before:c.before,after:c.after})),planToken:createHash("sha256").update(b.checklist.planVersion).digest("hex")}:undefined,rows:b.rows.map(r=>({key:r.key,label:r.label,orders:r.orders,stock:r.stock,produced:r.produced,recipients:r.recipients?.map(v=>({customerName:v.customerName,quantity:v.quantity}))}))})),letterError:letters.ok?"":source.message || "Letterproductie niet bereikbaar.",unplannedCount:(source.unplanned?.length || 0)+(source.centralUnplannedCount || 0),updatedAt:new Date().toISOString()},{headers});
 }catch(e){return Response.json({message:(e as Error).message || "Feestdagen laden is mislukt."},{status:503,headers});}
}
export async function POST(request:Request){
 const profile=await getCurrentProfile();if(!productionDepartments(profile).length)return Response.json({message:"Geen toegang tot productie."},{status:403,headers});
 const origin=request.headers.get("origin");if(origin && origin!==new URL(request.url).origin)return Response.json({message:"Ongeldige website."},{status:403,headers});
 try{const {season,year}=parameters(request);const raw=await request.text();if(raw.length>100000)return Response.json({message:"De wijziging is te groot."},{status:413,headers});const input=JSON.parse(raw);
 if(!input || typeof input!=="object" || Array.isArray(input))return Response.json({message:"Ongeldige wijziging."},{status:400,headers});
 if(input.kind && (season!=="sint" || !["letters","letters-revise"].includes(input.kind)))return Response.json({message:"Kies de Sinterklaas-letterproductie voor deze wijziging."},{status:400,headers});
 if(input.kind==="letters-revise"){const current=await readLetters(new Request(`https://app.strik-patisserie.nl/api/sinterklaas-letter-production?season=${year}`)),data=await current.json();if(!current.ok)return Response.json({message:data.message},{status:current.status,headers});const batch=data.batches.find((b:{id:string})=>b.id===input.batchId);if(!batch?.checklist || input.planToken!==createHash("sha256").update(batch.checklist.planVersion).digest("hex"))return Response.json({message:"De bestellingen zijn opnieuw gewijzigd. Bekijk de nieuwe verschillen eerst."},{status:409,headers});return letterResult(await saveLetters(new Request(request.url,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({batchId:input.batchId,revision:input.revision,planVersion:batch.checklist.planVersion,action:"revise"})})));}
 if(input.kind==="letters")return letterResult(await saveLetters(new Request(request.url,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({batchId:input.batchId,revision:input.revision,action:"quantity",key:input.key,quantity:input.quantity})})));
 if(typeof input.id!=="string" || !["productionDone","letterProductionDone"].includes(input.field) || typeof input.done!=="boolean")return Response.json({message:"Controleer de productiestatus."},{status:400,headers});
 const orders=await loadProductionB2BOrders(year),order=orders.find(o=>o.id===input.id && (o.season===season || o.season==="sint-kerst"));
 if(!order || order.status!=="akkoord" || order.cancelled || order.delivered)return Response.json({message:"Deze bestelling is niet beschikbaar voor productie."},{status:409,headers});
 if(input.version!==holidayOrder(order).version)return Response.json({message:"De bestelling is intussen gewijzigd. Ververs en controleer de nieuwe versie eerst."},{status:409,headers});
 if(input.field==="letterProductionDone" && !order.letterLines.length)return Response.json({message:"Deze bestelling heeft geen losse chocoladeletters."},{status:400,headers});
 const saved=await saveProductionB2BProgress(order.id,input.field,input.done);return Response.json({order:holidayOrder(saved)},{headers});
 }catch(e){return Response.json({message:(e as Error).message || "Opslaan is mislukt."},{status:400,headers});}
}
