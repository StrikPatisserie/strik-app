import { personalContext,personalHeaders } from "../../../persoonlijk/access.server";
import { PERSONAL_BUCKET } from "../../../persoonlijk/model";
export async function GET(request:Request) {
  const context=await personalContext();if(context.error)return context.error;
  const params=new URL(request.url).searchParams,path=params.get("path"),name=(params.get("name")||"bijlage").slice(0,500).replace(/[\r\n\0]/g," ");
  if(!path||!path.startsWith(`${context.profile.id}/`)||path.includes(".."))return Response.json({message:"Bijlage niet gevonden."},{status:404,headers:personalHeaders});
  const result=await context.db.storage.from(PERSONAL_BUCKET).download(path);
  if(result.error)return Response.json({message:"De bijlage kon niet worden geladen."},{status:404,headers:personalHeaders});
  // Downloads never render imported HTML/SVG/XML on the app's origin.
  return new Response(result.data,{headers:{...personalHeaders,"Content-Type":"application/octet-stream","Content-Disposition":`attachment; filename="bijlage"; filename*=UTF-8''${encodeURIComponent(name)}`,"Content-Security-Policy":"sandbox; default-src 'none'"}});
}
