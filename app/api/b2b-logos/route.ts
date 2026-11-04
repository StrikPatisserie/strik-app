import {logoContext,logoHeaders} from "@/app/sinterklaas/b2b/logos/access.server";
import {LOGO_COLUMNS,MAX_LOGO_SIZE,validLogoPrint,type OrderLogo} from "@/app/sinterklaas/b2b/logos/model";
import {personalFileType} from "@/app/persoonlijk/fileTypes";
export const dynamic="force-dynamic";
export const runtime="nodejs";
const fail=(message:string,status=400)=>Response.json({message},{status,headers:logoHeaders});
const validId=(id:unknown)=>typeof id==="string"&&/^[a-f0-9-]{36}$/i.test(id);
export async function GET(request:Request) {
 const c=await logoContext(request);if(c.error)return c.error;
 const params=new URL(request.url).searchParams,id=params.get("id");
 if(id&&!validId(id))return fail("Logo niet gevonden.",404);
 const query=c.db.from("b2b_order_logos").select(id?`${LOGO_COLUMNS},bytes_base64`:LOGO_COLUMNS).eq("order_id",c.orderId).eq("season",c.year);
 const result=id?await query.eq("id",id).maybeSingle():await query.order("created_at");
 if(result.error)return fail("Logo’s konden niet worden geladen.",503);
 if(!id)return Response.json({logos:result.data||[]},{headers:logoHeaders});
 const row=result.data as unknown as (OrderLogo & {bytes_base64:string})|null;if(!row)return fail("Logo niet gevonden.",404);
 const download=params.get("download")==="1",name=String(row.name).replace(/[\r\n\x00]/g," ");
 return new Response(Buffer.from(row.bytes_base64,"base64"),{headers:{...logoHeaders,"Content-Type":download?"application/octet-stream":row.content_type,"Content-Disposition":`${download?"attachment":"inline"}; filename="logo"; filename*=UTF-8''${encodeURIComponent(name)}`,"X-Content-Type-Options":"nosniff","Content-Security-Policy":"sandbox; default-src 'none'"}});
}
export async function POST(request:Request) {
 const c=await logoContext(request,true);if(c.error)return c.error;
 if(Number(request.headers.get("content-length"))>MAX_LOGO_SIZE+65536)return fail("Kies een logo van maximaal 4 MB.",413);
 try {
  const form=await request.formData(),file=form.get("file"),id=form.get("id"),version=form.get("updatedAt");
  if(!(file instanceof File)||!file.size||file.size>MAX_LOGO_SIZE)return fail("Kies een afbeelding of pdf van maximaal 4 MB.");
  const bytes=new Uint8Array(await file.arrayBuffer()),type=personalFileType(bytes);
  if(!type)return fail("Kies een JPG, PNG, WebP of PDF. Exporteer een EPS/SVG eerst naar PNG of PDF.");
  if(id&&(!validId(id)||typeof version!=="string"))return fail("Ongeldig logo.");
  const data={name:file.name.slice(0,180).replace(/[\r\n\x00]/g," ")||"logo",content_type:type,bytes_base64:Buffer.from(bytes).toString("base64"),size:file.size,updated_at:new Date().toISOString(),updated_by:c.profile.id};
  const result=id?await c.db.from("b2b_order_logos").update(data).eq("id",id).eq("order_id",c.orderId).eq("season",c.year).eq("updated_at",version).select(LOGO_COLUMNS).maybeSingle():await c.db.from("b2b_order_logos").insert({...data,order_id:c.orderId,season:c.year,created_by:c.profile.id}).select(LOGO_COLUMNS).single();
  if(result.error)return fail("Uploaden is mislukt. Probeer opnieuw.",503);
  if(!result.data)return fail("Het logo is intussen gewijzigd. Vernieuw eerst de lijst.",409);
  return Response.json({logo:result.data},{headers:logoHeaders});
 }catch{return fail("Het bestand kon niet worden geüpload.");}
}
export async function PATCH(request:Request) {
 const c=await logoContext(request,true);if(c.error)return c.error;
 try {
  const item=await request.json() as OrderLogo;
  if(!validLogoPrint(item)||typeof item.updated_at!=="string"||typeof item.name!=="string"||!item.name.trim()||item.name.length>180)return fail("Controleer naam, aantal en formaat.");
  const result=await c.db.from("b2b_order_logos").update({name:item.name.trim(),quantity:item.quantity,width_cm:item.width_cm,height_cm:item.height_cm,updated_at:new Date().toISOString(),updated_by:c.profile.id}).eq("id",item.id).eq("order_id",c.orderId).eq("season",c.year).eq("updated_at",item.updated_at).select(LOGO_COLUMNS).maybeSingle();
  if(result.error)return fail("Opslaan is mislukt.",503);if(!result.data)return fail("Dit logo is intussen gewijzigd. Vernieuw eerst de lijst.",409);
  return Response.json({logo:result.data},{headers:logoHeaders});
 }catch{return fail("Het logo kon niet worden opgeslagen.");}
}
export async function DELETE(request:Request) {
 const c=await logoContext(request,true);if(c.error)return c.error;
 try {
  const item=await request.json();if(!validId(item.id)||typeof item.updated_at!=="string")return fail("Ongeldig logo.");
  const result=await c.db.from("b2b_order_logos").delete().eq("id",item.id).eq("order_id",c.orderId).eq("season",c.year).eq("updated_at",item.updated_at).select("id").maybeSingle();
  if(result.error)return fail("Verwijderen is mislukt.",503);if(!result.data)return fail("Het logo is intussen gewijzigd of verwijderd. Vernieuw de lijst.",409);
  return Response.json({deleted:true},{headers:logoHeaders});
 }catch{return fail("Het logo kon niet worden verwijderd.");}
}
