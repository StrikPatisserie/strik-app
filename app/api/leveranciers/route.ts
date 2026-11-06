import {getCurrentProfile} from "@/app/lib/auth/session";
import {canAccessSuppliers} from "@/app/lib/auth/access";
import {ProductionStoreError} from "@/app/productie/documents.server";
import {readOperational,saveOperational} from "@/app/productie/operationalStore.server";
import {SUPPLIER_KEY,defaultSuppliers,supplierViews,changeSupplier,type SupplierDocument} from "@/app/leveranciers/model";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store"};
const read=()=>readOperational<SupplierDocument>(SUPPLIER_KEY,{revision:0,suppliers:defaultSuppliers});
export async function GET(){
 if(!canAccessSuppliers(await getCurrentProfile()))return Response.json({message:"Geen toegang tot leveranciers."},{status:403,headers});
 try{const doc=await read();return Response.json({revision:doc.revision,suppliers:supplierViews(doc)},{headers});}catch{return Response.json({message:"Leveranciers konden niet worden geladen."},{status:503,headers});}
}
export async function POST(request:Request){
 const profile=await getCurrentProfile();if(!profile||!canAccessSuppliers(profile))return Response.json({message:"Geen toegang tot leveranciers."},{status:403,headers});
 if(request.headers.get("origin")!==new URL(request.url).origin)return Response.json({message:"Ongeldige herkomst."},{status:403,headers});
 try{
  const raw=await request.text();if(raw.length>8000)throw Error("De invoer is te groot.");
  const input=JSON.parse(raw),doc=await read();
  if(input.kind==="reveal"){
   const supplier=doc.suppliers.find(s=>s.id===input.id&&!s.archived);if(!supplier)throw Error("Leverancier niet gevonden.");
   return Response.json({username:supplier.username,password:supplier.password},{headers});
  }
  if(input.kind!=="save")throw Error("Onbekende actie.");
  if(input.revision!==doc.revision)throw new ProductionStoreError("De leveranciers zijn intussen aangepast. Ververs eerst.",409);
  const next=changeSupplier(doc,input.supplier,profile.full_name||profile.email,new Date().toISOString());
  await saveOperational(SUPPLIER_KEY,doc.revision,next,profile.id);
  return Response.json({revision:next.revision,suppliers:supplierViews(next)},{headers});
 }catch(error){return Response.json({message:error instanceof Error?error.message:"Opslaan mislukt."},{status:error instanceof ProductionStoreError?error.status:400,headers});}
}
