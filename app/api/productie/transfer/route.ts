import { createHash, randomUUID } from "node:crypto";
import { getCurrentProfile } from "@/app/lib/auth/session";
import { hasFullAccess } from "@/app/lib/auth/access";
import { ProductionStoreError, readDocument, importWordPressDocument } from "@/app/productie/documents.server";
import { wordpressTransfer } from "@/app/productie/wordpress.server";
import { copyWordPressImages } from "@/app/productie/media.server";
import { inspectRecipeTransfer, canonicalJson } from "@/app/productie/recipeMigration";
import { seedWorkspace, recipeViews, validWorkspace } from "@/app/productie/workspaceData";
import type { RecepturenData } from "@/app/bakkerij/recepturen/recepturenApi";
export const dynamic="force-dynamic";
export const maxDuration=300;
const headers={"Cache-Control":"private, no-store"};
function hash(value:unknown) { return createHash("sha256").update(canonicalJson(value)).digest("hex"); }
function fullData(source:{data:Record<string,unknown>;allergenLists:unknown[]}) {
  return {...source.data,wordpressEmbeddedAllergenLists:source.data.allergenLists,allergenLists:source.allergenLists} as unknown as RecepturenData;
}
export async function GET() {
  if (!hasFullAccess(await getCurrentProfile())) return Response.json({message:"Alleen managers kunnen de overdracht controleren."},{status:403,headers});
  try {
    const active=await readDocument<RecepturenData>("recipes");
    if (active) return Response.json({active:true,revision:active.revision,report:inspectRecipeTransfer(active.data,{preserveUnresolved:true})},{headers});
    const source=await wordpressTransfer("inspect"), data=fullData(source);
    return Response.json({active:false,locked:source.locked,report:inspectRecipeTransfer(data,{preserveUnresolved:true}),sourceHash:hash(source),bytes:Buffer.byteLength(JSON.stringify(source))},{headers});
  } catch(error) { return Response.json({message:error instanceof ProductionStoreError?error.message:"De overdracht kon niet worden gecontroleerd."},{status:503,headers}); }
}
export async function POST(request:Request) {
  const profile=await getCurrentProfile();
  if (!profile || !hasFullAccess(profile)) return Response.json({message:"Alleen managers kunnen de recepten overzetten."},{status:403,headers});
  const body=await request.json().catch(()=>null);
  if (body?.action!=="migrate") return Response.json({message:"Ongeldige overdrachtsactie."},{status:400,headers});
  if (await readDocument("recipes")) return Response.json({active:true,alreadyImported:true},{headers});
  const lockId=randomUUID(); let locked=false, committed=false;
  try {
    const snapshot=await wordpressTransfer("lock",lockId); locked=true;
    const data=fullData(snapshot), report=inspectRecipeTransfer(data,{preserveUnresolved:true});
    if (!report.ready) { await wordpressTransfer("unlock",lockId); locked=false; return Response.json({message:"De bron bevat gegevens die eerst gecontroleerd moeten worden.",report},{status:422,headers}); }
    const copied=await copyWordPressImages(data), planner=seedWorkspace(copied.data);
    if (!validWorkspace(planner,recipeViews(copied.data))) throw new ProductionStoreError("De bestaande planning kan niet zonder fouten worden overgenomen.",422);
    const check=await wordpressTransfer("snapshot",lockId);
    // Ignore the lock metadata; compare the exact original source documents.
    if (hash({data:check.data,allergenLists:check.allergenLists})!==hash({data:snapshot.data,allergenLists:snapshot.allergenLists})) throw new ProductionStoreError("De WordPress-bron is tijdens de overdracht veranderd. Er is niet omgeschakeld.",409);
    await importWordPressDocument({data:copied.data,planner,snapshot,hash:hash(snapshot),report,actor:profile.id}); committed=true;
    const stored=await readDocument<RecepturenData>("recipes");
    if (!stored || hash(stored.data)!==hash(copied.data)) throw new ProductionStoreError("De overdracht is opgeslagen maar de eindcontrole is niet geslaagd. De oude bron blijft geblokkeerd; neem contact op met beheer.");
    let sourceRetired=true;
    try { await wordpressTransfer("retire",lockId); } catch { sourceRetired=false; }
    return Response.json({active:true,verified:true,report,images:copied.images,sourceRetired},{headers});
  } catch(error) {
    if (locked && !committed) { try { await wordpressTransfer("unlock",lockId); } catch { /* Keep the source locked rather than risk two writable stores. */ } }
    return Response.json({message:error instanceof ProductionStoreError?error.message:"De overdracht is niet afgerond; de bestaande gegevens zijn behouden.",committed},{status:error instanceof ProductionStoreError?error.status:503,headers});
  }
}
