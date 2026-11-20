import {getCurrentProfile} from "@/app/lib/auth/session";
import {hasFullAccess} from "@/app/lib/auth/access";
import {getSeasonArchive} from "@/app/feestdagen/server";
import {holiday} from "@/app/feestdagen/model";
export async function GET(request:Request){
 if(!hasFullAccess(await getCurrentProfile()))return Response.json({message:"Geen toegang."},{status:403});
 const q=new URL(request.url).searchParams,id=q.get("season")||"",year=Number(q.get("year"));
 if(!holiday(id)||!Number.isInteger(year)||year<2020||year>2100)return Response.json({message:"Controleer seizoen en jaar."},{status:400});
 const archive=await getSeasonArchive(id,year);if(!archive)return Response.json({message:"Archief niet gevonden."},{status:404});
 return new Response(JSON.stringify(archive,null,2),{headers:{"Content-Type":"application/json; charset=utf-8","Content-Disposition":`attachment; filename="strik-${id}-${year}-jaararchief.json"`,"Cache-Control":"private, no-store"}});
}
