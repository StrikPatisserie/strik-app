import { personalContext,personalHeaders } from "../../persoonlijk/access.server";
import { personalInput,taskLines,isTodoNotebook } from "../../persoonlijk/model";
const fields="id,title,notebook,body,tags,pinned,archived,attachments,source_hash,source_created_at,source_updated_at,revision,created_at,updated_at";
export async function GET(request:Request) {
  const context=await personalContext();if(context.error)return context.error;
  const {db,profile}=context,url=new URL(request.url),id=url.searchParams.get("id");
  if(id){const result=await db.from("personal_notes").select(fields).eq("owner_id",profile.id).eq("id",id).maybeSingle();return result.error?Response.json({message:"De notitie kon niet worden geladen."},{status:503,headers:personalHeaders}):result.data?Response.json({note:result.data},{headers:personalHeaders}):Response.json({message:"De notitie bestaat niet."},{status:404,headers:personalHeaders});}
  const offset=Math.max(0,Math.min(100000,Number(url.searchParams.get("offset"))||0));
  let query=db.from("personal_notes").select(fields,{count:"exact"}).eq("owner_id",profile.id).eq("archived",url.searchParams.get("view")==="archive");
  const search=url.searchParams.get("search")?.trim().slice(0,200),notebook=url.searchParams.get("notebook");
  if(search)query=query.ilike("search_text",`%${search.replace(/[\\%_]/g,"\\$&")}%`);
  if(notebook)query=query.eq("notebook",notebook);
  if(url.searchParams.get("view")==="pinned")query=query.eq("pinned",true);
  if(url.searchParams.get("view")==="tasks")query=query.gt("open_tasks",0).ilike("notebook","to%do%");
  const [result,books]=await Promise.all([query.order("pinned",{ascending:false}).order("updated_at",{ascending:false}).order("id").range(offset,offset+49),db.rpc("personal_notebook_names")]);
  if(result.error||books.error)return Response.json({message:"Je persoonlijke opslag is nog niet bereikbaar. Er is niets gewijzigd."},{status:503,headers:personalHeaders});
  return Response.json({notes:(result.data||[]).map(note=>({...note,body:undefined,excerpt:note.body.slice(0,180),tasks:isTodoNotebook(note.notebook)?taskLines(note.body):[],attachmentCount:note.attachments.length})),total:result.count||0,notebooks:books.data||[]},{headers:personalHeaders});
}
async function write(request:Request,update:boolean) {
  const context=await personalContext();if(context.error)return context.error;
  if(request.headers.get("origin")!==new URL(request.url).origin)return Response.json({message:"Ongeldige herkomst."},{status:403,headers:personalHeaders});
  try{
    const raw=await request.text();if(raw.length>1500000)throw Error("De notitie is te groot om in één keer op te slaan.");
    const value=JSON.parse(raw),input=personalInput(value,context.profile.id),open_tasks=isTodoNotebook(input.notebook)?taskLines(input.body).filter(task=>!task.done).length:0;
    let result;
    if(update){
      if(!Number.isSafeInteger(value.revision)||value.revision<1)throw Error("Ververs eerst de notitie.");
      const {id,...changes}=input;
      result=await context.db.from("personal_notes").update({...changes,open_tasks,revision:value.revision+1,updated_at:new Date().toISOString()}).eq("id",id).eq("owner_id",context.profile.id).eq("revision",value.revision).select(fields).maybeSingle();
      if(!result.error&&!result.data)return Response.json({message:"Deze notitie is intussen gewijzigd. Je tekst blijft staan; ververs voordat je opnieuw opslaat."},{status:409,headers:personalHeaders});
    }else{
      result=await context.db.from("personal_notes").insert({...input,owner_id:context.profile.id,open_tasks,revision:1}).select(fields).single();
      if(result.error?.code==="23505"&&input.source_hash){const existing=await context.db.from("personal_notes").select(fields).eq("owner_id",context.profile.id).eq("source_hash",input.source_hash).maybeSingle();if(!existing.error&&existing.data)return Response.json({note:existing.data,duplicate:true},{headers:personalHeaders});}
    }
    if(result.error)return Response.json({message:"Opslaan is niet gelukt. Je tekst blijft in dit scherm staan."},{status:503,headers:personalHeaders});
    return Response.json({note:result.data,duplicate:false},{headers:personalHeaders});
  }catch(error){return Response.json({message:error instanceof Error?error.message:"Controleer de notitie."},{status:400,headers:personalHeaders});}
}
export async function POST(request:Request){return write(request,false);}
export async function PUT(request:Request){return write(request,true);}
