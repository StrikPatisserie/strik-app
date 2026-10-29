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
export const TASK_FALLBACK_CATEGORY="Dagelijkse to do’s";
export const DEFAULT_TASK_CATEGORIES=["Administratie to do’s","Winkel to do’s","Dagelijkse to do’s"];
export function isTodoNotebook(notebook:string){return /^to[\s-]*do(?:[’']?s)?$/i.test(notebook.trim());}
export function taskCategories(body:string){
  const raw=body.split("\n").flatMap(line=>/^## (.+)$/.exec(line)?.[1]||[]),names=raw.map(name=>name==="Algemeen"?TASK_FALLBACK_CATEGORY:name);
  return [...new Set([...(names.includes(TASK_FALLBACK_CATEGORY)?[]:DEFAULT_TASK_CATEGORIES),...names])].filter(name=>name!==TASK_FALLBACK_CATEGORY);
}
export function removeTaskCategory(body:string,name:string){
  const categories=taskCategories(body);if(name===TASK_FALLBACK_CATEGORY||!categories.includes(name))throw Error("Deze categorie kan niet worden verwijderd.");
  body=body.split("\n").map(line=>line==="## Algemeen"?`## ${TASK_FALLBACK_CATEGORY}`:line).join("\n");
  const kept:string[]=[],moved:string[]=[];let removing=false;
  for(const line of body.split("\n")){
    const heading=/^## (.+)$/.exec(line);
    if(heading){removing=heading[1]===name;if(!removing)kept.push(line);}
    else (removing?moved:kept).push(line);
  }
  // An explicit fallback heading preserves the chosen category set.
  let next=kept.includes(`## ${TASK_FALLBACK_CATEGORY}`)?kept.join("\n"):`## ${TASK_FALLBACK_CATEGORY}\n${kept.join("\n")}`;
  for(const remaining of categories.filter(category=>category!==name))next=addTaskCategory(next,remaining);
  return moved.length?appendTaskBlock(next,moved,TASK_FALLBACK_CATEGORY):next;
}
export function addTaskCategory(body:string,name:string){const clean=name.trim();if(!clean||clean.length>100||/[\r\n\0]/.test(clean)||clean==="Algemeen")throw Error("Kies een categorienaam van 1 tot 100 tekens.");return body.split("\n").includes(`## ${clean}`)?body:`${body}${body?"\n\n":""}## ${clean}`;}
export function taskLines(body:string) {
  let category=TASK_FALLBACK_CATEGORY;
  return body.split("\n").flatMap((line,index)=>{
    const heading=/^## (.+)$/.exec(line);if(heading)category=heading[1]==="Algemeen"?TASK_FALLBACK_CATEGORY:heading[1];
    const match=/^([\t ]*)(?:[-*]\s*)?\[([ xX])\]\s*(.*)$/.exec(line);
    if(!match)return [];
    const marker=/^\[(prioriteit|later)\]\s*/.exec(match[3]);
    return [{index,category,done:match[2].toLowerCase()==="x",text:match[3].slice(marker?.[0].length||0),depth:Math.floor(match[1].replace(/\t/g,"  ").length/2),priority:(marker?.[1]==="prioriteit"?"priority":marker?"later":"normal") as TaskPriority}];
  });
}
export function taskPriorityGroups(body:string){
 const groups:{priority:TaskPriority;label:string;tasks:ReturnType<typeof taskLines>}[]=[{priority:"priority",label:"Prioriteit",tasks:[]},{priority:"normal",label:"To do’s",tasks:[]},{priority:"later",label:"Voor later",tasks:[]}];
 let root:TaskPriority="normal",category="";
 for(const task of taskLines(body)){
  if(task.depth===0||task.category!==category)root=task.priority;
  category=task.category;groups.find(group=>group.priority===root)!.tasks.push(task);
 }
 return groups;
}
export function setTaskPriority(body:string,index:number,priority:TaskPriority) {
  if(!["normal","priority","later"].includes(priority))throw Error("Ongeldige prioriteit.");
  const task=taskLines(body).find(t=>t.index===index);if(!task)throw Error("Deze taak bestaat niet meer.");
  const lines=body.split("\n");lines[index]=lines[index].replace(/(\[[ xX]\]\s*)(?:\[(?:prioriteit|later)\]\s*)?/,`$1${priority==="normal"?"":priority==="priority"?"[prioriteit] ":"[later] "}`);return lines.join("\n");
}
export function editTaskText(body:string,index:number,text:string){
  const clean=text.trim();if(!clean||clean.length>2000||/[\r\n\0]/.test(clean))throw Error("Vul één taak in van maximaal 2.000 tekens.");
  if(!taskLines(body).some(task=>task.index===index))throw Error("Deze taak bestaat niet meer.");
  const lines=body.split("\n"),prefix=/^[\t ]*(?:[-*]\s*)?\[[ xX]\]\s*(?:\[(?:prioriteit|later)\]\s*)?/.exec(lines[index])![0];
  lines[index]=prefix+clean;return lines.join("\n");
}
export function resolveTask(body:string,index:number){
  const tasks=taskLines(body),task=tasks.find(t=>t.index===index);if(!task)throw Error("Deze taak bestaat niet meer.");
  const lines=body.split("\n"),remove=new Set([index]),byIndex=new Map(tasks.map(t=>[t.index,t]));
  for(let next=index+1;next<lines.length;next++){
    if(/^## .+/.test(lines[next]))break;
    const child=byIndex.get(next);if(!child)continue;if(child.depth<=task.depth)break;remove.add(next);
  }
  return lines.filter((_,line)=>!remove.has(line)).join("\n");
}
function appendTaskBlock(body:string,block:string[],category:string){
  if(category===TASK_FALLBACK_CATEGORY){
    const lines=body?body.split("\n"):[],general=lines.indexOf(`## ${TASK_FALLBACK_CATEGORY}`);
    const boundary=lines.findIndex((line,index)=>index>general&&/^## .+/.test(line));
    lines.splice(boundary<0?lines.length:boundary,0,...block);return lines.join("\n");
  }
  const lines=addTaskCategory(body,category).split("\n"),start=lines.indexOf(`## ${category}`),next=lines.findIndex((line,i)=>i>start&&/^## .+/.test(line));lines.splice(next<0?lines.length:next,0,...block);return lines.join("\n");
}
export function moveTaskCategory(body:string,index:number,category:string){
  const tasks=taskLines(body),task=tasks.find(t=>t.index===index);if(!task||task.depth!==0)throw Error("Verplaats de hoofdtaak om ook de subtaken mee te nemen.");
  if(task.category===category)return body;
  const lines=body.split("\n");let end=index+1;for(const child of tasks.filter(t=>t.index>index)){if(child.depth===0||child.category!==task.category)break;end=child.index+1;}
  const block=lines.splice(index,end-index);return appendTaskBlock(lines.join("\n"),block,category);
}
export function addTask(body:string,text:string,parentIndex?:number,category=TASK_FALLBACK_CATEGORY,priority:TaskPriority="normal") {
  const clean=text.trim();if(!clean||clean.length>2000||/[\r\n\0]/.test(clean))throw Error("Vul één taak in van maximaal 2.000 tekens.");
  const lines=body?body.split("\n"):[],tasks=taskLines(body);
  if(!["normal","priority","later"].includes(priority))throw Error("Ongeldige prioriteit.");
  const marker=priority==="normal"?"":priority==="priority"?"[prioriteit] ":"[later] ";
  if(parentIndex===undefined)return appendTaskBlock(body,[`[ ] ${marker}${clean}`],category);
  const parent=tasks.find(t=>t.index===parentIndex);if(!parent||parent.depth>=8)throw Error("Deze taak kan geen extra subtaak krijgen.");
  let at=parent.index+1;for(const next of tasks.filter(t=>t.index>parent.index)){if(next.depth<=parent.depth||next.category!==parent.category)break;at=next.index+1;}
  lines.splice(at,0,`${"  ".repeat(parent.depth+1)}[ ] ${marker}${clean}`);return lines.join("\n");
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
