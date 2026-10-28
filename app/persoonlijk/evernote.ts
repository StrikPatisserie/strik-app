import { type PersonalNoteInput } from "./model";
export type EvernoteResource={name:string;type:string;bytes:Uint8Array<ArrayBuffer>;hash:string};
export type EvernoteImport={name:string;notebook:string;hash:string;notes:{note:PersonalNoteInput;resources:EvernoteResource[]}[];warnings:string[];file:File};
const LIMIT=100*1024*1024;
export async function sha256(bytes:BufferSource){return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",bytes)),b=>b.toString(16).padStart(2,"0")).join("");}
function xmlDocument(source:string,root:string) {
  // Standard external Evernote DTD declarations are inert; internal entities
  // are rejected before parsing to prevent entity expansion or file lookups.
  if(/<!ENTITY|<!DOCTYPE[^>]*\[/i.test(source))throw Error("Dit exportbestand bevat niet-ondersteunde XML-entiteiten.");
  const safe=source.replace(/&(?!amp;|lt;|gt;|quot;|apos;|#\d+;|#x[\da-f]+;)([\w]+);/gi,(_,name:string)=>name==="nbsp"?"&#160;":`&amp;${name};`);
  const doc=new DOMParser().parseFromString(safe,"application/xml");
  if(doc.querySelector("parsererror")||doc.documentElement.localName!==root)throw Error(`Het ${root==="en-export"?"Evernote-exportbestand":"notitieformaat"} kon niet volledig worden gelezen. Er is niets geïmporteerd.`);
  return doc;
}
function date(text:string) {
  if(!text)return null;
  const match=/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(text);
  if(!match)throw Error("Een Evernote-notitie heeft een ongeldige datum.");
  const iso=`${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}Z`;
  if(!Number.isFinite(Date.parse(iso))||new Date(iso).toISOString().slice(0,19)!==iso.slice(0,19))throw Error("Een Evernote-notitie heeft een ongeldige datum.");
  return new Date(iso).toISOString();
}
function textContent(source:string,warnings:Set<string>) {
  const doc=xmlDocument(source,"en-note");
  function walk(node:Node):string {
    if(node.nodeType===Node.TEXT_NODE||node.nodeType===Node.CDATA_SECTION_NODE)return node.textContent||"";
    if(node.nodeType!==Node.ELEMENT_NODE)return "";
    const element=node as Element,name=element.localName.toLowerCase();
    if(["script","style","iframe","object","embed"].includes(name)){warnings.add("Actieve HTML-inhoud wordt niet uitgevoerd. De oorspronkelijke export blijft bewaard.");return "";}
    if(name==="en-crypt"){warnings.add("Er is versleutelde Evernote-inhoud. Deze blijft in de bronexport bewaard en wordt niet ontsleuteld.");return "[Versleutelde inhoud · zie oorspronkelijke Evernote-export]";}
    if(name==="en-todo")return element.getAttribute("checked")==="true"?"\n[x] ":"\n[ ] ";
    if(name==="en-media")return `[Bijlage: ${element.getAttribute("type")||"bestand"}]`;
    if(name==="br")return "\n";
    const content=Array.from(element.childNodes).map(walk).join("");
    if(name==="a"){const href=element.getAttribute("href")||"";return /^(https?:\/\/|mailto:)/i.test(href)&&href!==content?`${content} (${href})`:content;}
    if(name==="td"||name==="th")return `${content}\t`;
    if(["div","p","li","tr","h1","h2","h3","blockquote"].includes(name))return `${content}\n`;
    return content;
  }
  return walk(doc.documentElement).replace(/[\t ]+\n/g,"\n").replace(/\n{3,}/g,"\n\n").trim();
}
export async function readEvernote(file:File,notebook=file.name.replace(/\.enex$/i,"")):Promise<EvernoteImport> {
  if(!/\.enex$/i.test(file.name))throw Error("Kies een Evernote-exportbestand (.enex).");
  if(file.size>LIMIT)throw Error("Deze export is groter dan 100 MB. Exporteer kleinere notitieboeken of deelbestanden; er wordt niets overgeslagen.");
  const bytes=new Uint8Array(await file.arrayBuffer()),hash=await sha256(bytes),doc=xmlDocument(new TextDecoder("utf-8",{fatal:true}).decode(bytes),"en-export");
  const elements=Array.from(doc.documentElement.children);
  if(elements.some(e=>e.localName!=="note"))throw Error("Deze export bevat onderdelen die nog niet volledig kunnen worden ingelezen.");
  if(!elements.length||elements.length>5000)throw Error("Kies een export met 1 tot 5.000 notities.");
  const warnings=new Set<string>(),notes:EvernoteImport["notes"]=[],occurrences=new Map<string,number>();
  for(const element of elements){
    const get=(name:string)=>Array.from(element.children).find(e=>e.localName===name)?.textContent||"";
    const title=get("title")||"Zonder titel",enml=get("content"),body=textContent(enml,warnings),resources:EvernoteResource[]=[];
    const tags=Array.from(element.children).filter(e=>e.localName==="tag").map(e=>e.textContent||"").filter(Boolean);
    for(const resource of Array.from(element.children).filter(e=>e.localName==="resource")){
      const data=resource.querySelector("data"),encoded=data?.textContent?.replace(/\s/g,"")||"";
      if(!data||data.getAttribute("encoding")!=="base64"||!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded))throw Error(`Een bijlage bij ‘${title}’ kon niet volledig worden gelezen. De import is gestopt.`);
      const content=Uint8Array.from(atob(encoded),c=>c.charCodeAt(0));
      const declared=Number(data.getAttribute("size"));if(data.hasAttribute("size")&&(!Number.isSafeInteger(declared)||declared!==content.length))throw Error(`De grootte van een bijlage bij ‘${title}’ klopt niet.`);
      const name=resource.querySelector("resource-attributes > file-name")?.textContent||`Bijlage ${resources.length+1}`;
      resources.push({name,type:resource.querySelector("mime")?.textContent||"application/octet-stream",bytes:content,hash:await sha256(content)});
    }
    if(element.querySelector("task,task-group"))warnings.add("Deze export bevat aanvullende Evernote-taakgegevens. Controleer de bronexport; alleen afvinkvakjes in de notitietekst worden als taken overgenomen.");
    const source_created_at=date(get("created")),source_updated_at=date(get("updated"));
    const base=await sha256(new TextEncoder().encode(JSON.stringify({notebook,title,enml,tags,created:source_created_at,resources:resources.map(r=>r.hash)}))),occurrence=(occurrences.get(base)||0)+1;occurrences.set(base,occurrence);
    const source_hash=await sha256(new TextEncoder().encode(`${base}:${occurrence}`)),id=`${source_hash.slice(0,8)}-${source_hash.slice(8,12)}-4${source_hash.slice(13,16)}-a${source_hash.slice(17,20)}-${source_hash.slice(20,32)}`;
    notes.push({note:{id,title,notebook,body,tags,pinned:false,archived:false,attachments:[],source_hash,source_created_at,source_updated_at},resources});
  }
  return{name:file.name,notebook,hash,notes,warnings:[...warnings],file};
}
