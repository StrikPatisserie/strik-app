export type PersonalAttachment = { path:string; name:string; type:string; size:number };
export type PersonalNote = {
  id:string; title:string; notebook:string; body:string; tags:string[];
  pinned:boolean; archived:boolean; attachments:PersonalAttachment[];
  source_hash:string|null; source_created_at:string|null; source_updated_at:string|null;
  revision:number; created_at:string; updated_at:string;
};
export type PersonalNoteInput = Pick<PersonalNote,"id"|"title"|"notebook"|"body"|"tags"|"pinned"|"archived"|"attachments"|"source_hash"|"source_created_at"|"source_updated_at">;
export const PERSONAL_BUCKET="personal-notes";
export const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export type TaskPriority="normal"|"priority"|"later";
export function taskLines(body:string) {
  return body.split("\n").flatMap((line,index)=>{
    const match=/^([\t ]*)(?:[-*]\s*)?\[([ xX])\]\s*(.*)$/.exec(line);
    if(!match)return [];
    const marker=/^\[(prioriteit|later)\]\s*/.exec(match[3]);
    return [{index,done:match[2].toLowerCase()==="x",text:match[3].slice(marker?.[0].length||0),depth:Math.floor(match[1].replace(/\t/g,"  ").length/2),priority:(marker?.[1]==="prioriteit"?"priority":marker?"later":"normal") as TaskPriority}];
  });
}
export function setTaskPriority(body:string,index:number,priority:TaskPriority) {
  if(!["normal","priority","later"].includes(priority))throw Error("Ongeldige prioriteit.");
  const task=taskLines(body).find(t=>t.index===index);if(!task)throw Error("Deze taak bestaat niet meer.");
  const lines=body.split("\n");lines[index]=lines[index].replace(/(\[[ xX]\]\s*)(?:\[(?:prioriteit|later)\]\s*)?/,`$1${priority==="normal"?"":priority==="priority"?"[prioriteit] ":"[later] "}`);return lines.join("\n");
}
export function addTask(body:string,text:string,parentIndex?:number) {
  const clean=text.trim();if(!clean||clean.length>2000||/[\r\n\0]/.test(clean))throw Error("Vul één taak in van maximaal 2.000 tekens.");
  const lines=body?body.split("\n"):[],tasks=taskLines(body);
  if(parentIndex===undefined)return [...lines,`[ ] ${clean}`].join("\n");
  const parent=tasks.find(t=>t.index===parentIndex);if(!parent||parent.depth>=8)throw Error("Deze taak kan geen extra subtaak krijgen.");
  let at=parent.index+1;for(const next of tasks.filter(t=>t.index>parent.index)){if(next.depth<=parent.depth)break;at=next.index+1;}
  lines.splice(at,0,`${"  ".repeat(parent.depth+1)}[ ] ${clean}`);return lines.join("\n");
}
export function toggleTask(body:string,index:number) {
  const lines=body.split("\n");
  if(!Number.isInteger(index)||!taskLines(body).some(task=>task.index===index))throw Error("Deze taak bestaat niet meer.");
  lines[index]=lines[index].replace(/\[([ xX])\]/,(_,state:string)=>state===" "?"[x]":"[ ]");
  return lines.join("\n");
}
export function personalInput(value:unknown,ownerId:string):PersonalNoteInput {
  if(!value||typeof value!=="object")throw Error("De notitie is niet geldig.");
  const v=value as Record<string,unknown>;
  const str=(key:string,max:number,fallback="")=>{const text=v[key]??fallback;if(typeof text!=="string"||text.length>max||text.includes("\0"))throw Error(`Controleer ${key}.`);return text;};
  const id=str("id",36);if(!UUID.test(id))throw Error("Ongeldig notitie-ID.");
  const title=str("title",500).trim()||"Zonder titel",notebook=str("notebook",200,"Mijn notities").trim()||"Mijn notities",body=str("body",500000);
  if(!Array.isArray(v.tags)||v.tags.length>100||v.tags.some(t=>typeof t!=="string"||t.length>200))throw Error("Controleer de labels.");
  if(typeof v.pinned!=="boolean"||typeof v.archived!=="boolean")throw Error("Controleer de notitiestatus.");
  if(!Array.isArray(v.attachments)||v.attachments.length>200)throw Error("Controleer de bijlagen.");
  const attachments=v.attachments.map((file:unknown):PersonalAttachment=>{
    if(!file||typeof file!=="object")throw Error("Ongeldige bijlage.");
    const f=file as Record<string,unknown>;
    if(typeof f.path!=="string"||!f.path.startsWith(`${ownerId}/`)||f.path.includes("..")||!/^[-a-zA-Z0-9/_\.]+$/.test(f.path)||f.path.length>300||typeof f.name!=="string"||f.name.length>500||/[\r\n\0]/.test(f.name)||typeof f.type!=="string"||!/^[-\w.+]+\/[-\w.+]+$/.test(f.type)||typeof f.size!=="number"||!Number.isSafeInteger(f.size)||f.size<0||f.size>100*1024*1024)throw Error("Ongeldige bijlage.");
    return{path:f.path,name:f.name,type:f.type,size:f.size};
  });
  const source_hash=v.source_hash??null;if(source_hash!==null&&(typeof source_hash!=="string"||!(/^[a-f0-9]{64}$/.test(source_hash))))throw Error("Ongeldige importverwijzing.");
  const date=(key:string)=>{const text=v[key]??null;if(text!==null&&(typeof text!=="string"||text.length>40||!Number.isFinite(Date.parse(text))))throw Error("Ongeldige brondatum.");return text as string|null;};
  return{id,title,notebook,body,tags:[...new Set(v.tags as string[])],pinned:v.pinned,archived:v.archived,attachments,source_hash,source_created_at:date("source_created_at"),source_updated_at:date("source_updated_at")};
}
export function newPersonalNote(notebook="Mijn notities"):PersonalNote {
  const now=new Date().toISOString();return{id:crypto.randomUUID(),title:"Nieuwe notitie",notebook,body:"",tags:[],pinned:false,archived:false,attachments:[],source_hash:null,source_created_at:null,source_updated_at:null,revision:0,created_at:now,updated_at:now};
}
