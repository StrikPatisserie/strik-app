export type ScreenMessage={id:string;version:number;title:string;body:string;startDate:string;endDate:string;enabled:boolean;updatedAt?:string;updatedBy?:string;actorId?:string};
export type ScreenMessageDocument={revision:number;messages:ScreenMessage[]};
export type ScreenMessageView=Pick<ScreenMessage,"id"|"version"|"title"|"body"|"startDate"|"endDate">;
export const SCREEN_MESSAGES_KEY="production_screen_messages_v1";
export const initialScreenMessages=():ScreenMessageDocument=>({revision:0,messages:[{
 id:"welkom-strak-2026",version:1,title:"Klaar voor de start!",body:"De software is klaar voor gebruik.\nVolgende week volgt de uitleg en gaan we ermee werken!",startDate:"2026-11-06",endDate:"2026-11-08",enabled:true,
}]});
export function screenDate(now:string|number|Date){return new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Amsterdam",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(now));}
function validDate(value:unknown):value is string{return typeof value==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(new Date(value).getTime())&&new Date(value).toISOString().slice(0,10)===value;}
export function activeScreenMessages(messages:ScreenMessage[],now:string|number|Date):ScreenMessageView[]{
 const date=screenDate(now);return messages.filter(message=>message.enabled&&message.startDate<=date&&date<=message.endDate).map(({id,version,title,body,startDate,endDate})=>({id,version,title,body,startDate,endDate}));
}
export function saveScreenMessage(doc:ScreenMessageDocument,input:unknown,actor:{id:string;name:string},now:string):ScreenMessageDocument{
 if(!input||typeof input!=="object")throw Error("Vul het schermbericht in.");
 const message=input as ScreenMessage;
 if(typeof message.id!=="string"||!/^[a-zA-Z0-9-]{1,100}$/.test(message.id))throw Error("Ongeldig schermbericht.");
 if(typeof message.title!=="string"||!message.title.trim()||message.title.length>120||typeof message.body!=="string"||!message.body.trim()||message.body.length>1600)throw Error("Vul een titel en bericht in (maximaal 120 en 1.600 tekens).");
 if(!validDate(message.startDate)||!validDate(message.endDate)||message.startDate>message.endDate)throw Error("Kies een geldige begin- en einddatum.");
 if(typeof message.enabled!=="boolean")throw Error("Kies of het bericht zichtbaar mag zijn.");
 const old=doc.messages.find(row=>row.id===message.id);
 if(!old&&doc.messages.length>=50)throw Error("Er zijn maximaal 50 schermberichten mogelijk.");
 const next:ScreenMessage={id:message.id,version:(old?.version||0)+1,title:message.title.trim(),body:message.body.trim(),startDate:message.startDate,endDate:message.endDate,enabled:message.enabled,updatedAt:now,updatedBy:actor.name,actorId:actor.id};
 return{revision:doc.revision+1,messages:old?doc.messages.map(row=>row.id===next.id?next:row):[...doc.messages,next]};
}
export const screenMessageToken=(message:ScreenMessageView)=>`${message.id}:${message.version}`;
export const SCREEN_SEEN_KEY="strik-production-screen-seen-v1";
export function readScreenSeen(raw:string|null):string[]{try{const data=JSON.parse(raw||"[]");return Array.isArray(data)?data.filter((value):value is string=>typeof value==="string"&&/^[a-zA-Z0-9-]{1,100}:\d{1,9}$/.test(value)).slice(-100):[];}catch{return[];}}
