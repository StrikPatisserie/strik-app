import {getCurrentProfile} from "@/app/lib/auth/session";
import {canManageScreenMessages,isBakeryScreenAccount} from "@/app/lib/auth/access";
import {readOperational,saveOperational} from "@/app/productie/operationalStore.server";
import {ProductionStoreError} from "@/app/productie/documents.server";
import {SCREEN_MESSAGES_KEY,initialScreenMessages,activeScreenMessages,saveScreenMessage,type ScreenMessageDocument} from "@/app/productie/screenMessages";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"private, no-store"};
export async function GET(){
 const profile=await getCurrentProfile(),canEdit=canManageScreenMessages(profile);
 if(!canEdit&&!isBakeryScreenAccount(profile))return Response.json({message:"Geen toegang tot deze schermberichten."},{status:403,headers});
 try{
  const doc=await readOperational<ScreenMessageDocument>(SCREEN_MESSAGES_KEY,initialScreenMessages()),now=new Date().toISOString();
  return Response.json({canEdit,revision:doc.revision,now,messages:canEdit?doc.messages:activeScreenMessages(doc.messages,now)},{headers});
 }catch{return Response.json({message:"Schermberichten konden niet worden geladen."},{status:503,headers});}
}
export async function POST(request:Request){
 const profile=await getCurrentProfile();if(!profile||!canManageScreenMessages(profile))return Response.json({message:"Alleen Feline kan schermberichten klaarzetten."},{status:403,headers});
 if(request.headers.get("origin")!==new URL(request.url).origin)return Response.json({message:"Ongeldige herkomst."},{status:403,headers});
 try{
  const raw=await request.text();if(raw.length>10000)throw Error("Het schermbericht is te groot.");const input=JSON.parse(raw);
  const doc=await readOperational<ScreenMessageDocument>(SCREEN_MESSAGES_KEY,initialScreenMessages());
  if(input.revision!==doc.revision)throw new ProductionStoreError("De schermberichten zijn intussen gewijzigd. Ververs eerst; er is niets overschreven.",409);
  const now=new Date().toISOString(),next=saveScreenMessage(doc,input.message,{id:profile.id,name:profile.full_name||profile.email},now);
  await saveOperational(SCREEN_MESSAGES_KEY,doc.revision,next,profile.id);
  return Response.json({canEdit:true,revision:next.revision,now,messages:next.messages},{headers});
 }catch(error){return Response.json({message:error instanceof Error?error.message:"Opslaan mislukt."},{status:error instanceof ProductionStoreError?error.status:400,headers});}
}
