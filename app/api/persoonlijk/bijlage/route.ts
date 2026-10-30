import { personalFileType } from "../../../persoonlijk/fileTypes";
import { personalContext,personalHeaders } from "../../../persoonlijk/access.server";
import { PERSONAL_BUCKET } from "../../../persoonlijk/model";
export async function GET(request:Request) {
  const context=await personalContext();if(context.error)return context.error;
  const params=new URL(request.url).searchParams,path=params.get("path"),name=(params.get("name")||"bijlage").slice(0,500).replace(/[\r\n\0]/g," ");
  if(!path||!path.startsWith(`${context.profile.id}/`)||path.includes(".."))return Response.json({message:"Bijlage niet gevonden."},{status:404,headers:personalHeaders});
  const result=await context.db.storage.from(PERSONAL_BUCKET).download(path);
  if(result.error)return Response.json({message:"De bijlage kon niet worden geladen."},{status:404,headers:personalHeaders});
  if(params.get("view")==="1"){
    const bytes=new Uint8Array(await result.data.arrayBuffer()),type=personalFileType(bytes);
    if(type)return new Response(bytes,{headers:{...personalHeaders,"Content-Type":type,"Content-Disposition":`inline; filename="bijlage"; filename*=UTF-8''${encodeURIComponent(name)}`,"Content-Security-Policy":"sandbox; default-src 'none'; style-src 'unsafe-inline'; img-src data: blob:"}});
  }
  // Imported HTML/SVG/XML always downloads as an inert file.
  return new Response(result.data,{headers:{...personalHeaders,"Content-Type":"application/octet-stream","Content-Disposition":`attachment; filename="bijlage"; filename*=UTF-8''${encodeURIComponent(name)}`,"Content-Security-Policy":"sandbox; default-src 'none'"}});
}

export async function POST(request:Request){
 const context=await personalContext();if(context.error)return context.error;
 const fail=(message:string,status=400)=>Response.json({message},{status,headers:personalHeaders});
 if(request.headers.get("origin")!==new URL(request.url).origin)return fail("Deze upload is niet toegestaan.",403);
 if(Number(request.headers.get("content-length"))>4*1024*1024+65536)return fail("Kies een bestand van maximaal 4 MB.",413);
 try{
  const form=await request.formData(),file=form.get("file");
  if(!(file instanceof File)||!file.size||file.size>4*1024*1024)return fail("Kies een afbeelding of pdf van maximaal 4 MB.");
  const bytes=new Uint8Array(await file.arrayBuffer()),type=personalFileType(bytes);
  if(!type)return fail("Kies een jpg-, png-, webp-afbeelding of pdf-bestand.");
  const ext=({"application/pdf":"pdf","image/png":"png","image/jpeg":"jpg","image/webp":"webp"} as Record<string,string>)[type];
  const path=`${context.profile.id}/tasks/${crypto.randomUUID()}.${ext}`;
  const result=await context.db.storage.from(PERSONAL_BUCKET).upload(path,bytes,{contentType:type,upsert:false});
  if(result.error)return fail("Uploaden is mislukt. Probeer het opnieuw.",502);
  return Response.json({attachment:{path,name:file.name.slice(0,500).replace(/[\r\n\0]/g," ")||`bijlage.${ext}`,type,size:file.size}},{headers:personalHeaders});
 }catch{return fail("Het bestand kon niet worden geüpload. Probeer het opnieuw.");}
}

export async function DELETE(request:Request){
 const context=await personalContext();if(context.error)return context.error;
 const fail=(message:string,status=400)=>Response.json({message},{status,headers:personalHeaders});
 if(request.headers.get("origin")!==new URL(request.url).origin)return fail("Deze actie is niet toegestaan.",403);
 try{
  const raw=await request.text();if(raw.length>70000)return fail("Te veel bijlagen.");
  const {paths}=JSON.parse(raw);
  if(!Array.isArray(paths)||!paths.length||paths.length>200||paths.some(path=>typeof path!=="string"||!path.startsWith(`${context.profile.id}/tasks/`)||!/^[-a-zA-Z0-9/_\.]+$/.test(path)||path.includes("..")))return fail("Ongeldige bijlagen.");
  // Storage RLS additionally refuses files referenced by any saved note.
  const result=await context.db.storage.from(PERSONAL_BUCKET).remove([...new Set(paths)]);
  if(result.error||result.data?.length!==new Set(paths).size)return fail("Niet alle bijlagen konden worden opgeruimd.",409);
  return Response.json({deleted:result.data.length},{headers:personalHeaders});
 }catch{return fail("Het opruimen van de bijlagen is mislukt.",503);}
}
