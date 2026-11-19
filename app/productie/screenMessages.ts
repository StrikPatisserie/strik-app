export type ScreenMessage={id:string;version:number;title:string;body:string;startDate:string;endDate:string;enabled:boolean;startTime?:string;endTime?:string;variant?:"welcome-baby";repeatAfterIdleMinutes?:number;updatedAt?:string;updatedBy?:string;actorId?:string};
export type ScreenMessageDocument={revision:number;messages:ScreenMessage[]};
export type ScreenMessageView=Pick<ScreenMessage,"id"|"version"|"title"|"body"|"startDate"|"endDate"|"startTime"|"endTime"|"variant"|"repeatAfterIdleMinutes">;
export const SCREEN_MESSAGES_KEY="production_screen_messages_v1";
export const initialScreenMessages=():ScreenMessageDocument=>({revision:0,messages:[{
 id:"welkom-strak-2026",version:1,title:"Klaar voor de start!",body:"De software is klaar voor gebruik.\nVolgende week volgt de uitleg en gaan we ermee werken!",startDate:"2026-11-06",endDate:"2026-11-08",enabled:true,
}]});
export function screenDate(now:string|number|Date){return new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Amsterdam",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(now));}
function validDate(value:unknown):value is string{return typeof value==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(new Date(value).getTime())&&new Date(value).toISOString().slice(0,10)===value;}
/** Times are Amsterdam wall-clock times. Timed end boundaries are exclusive. */
export function isScreenMessageActive(message:ScreenMessageView,now:string|number|Date):boolean{
 const date=screenDate(now);
 if(date<message.startDate||date>message.endDate)return false;
 const time=new Intl.DateTimeFormat("en-GB",{timeZone:"Europe/Amsterdam",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).format(new Date(now));
 return !(date===message.startDate&&message.startTime&&time<message.startTime)&&!(date===message.endDate&&message.endTime&&time>=message.endTime);
}
export function activeScreenMessages(messages:ScreenMessage[],now:string|number|Date):ScreenMessageView[]{
 return messages.filter(message=>message.enabled&&isScreenMessageActive(message,now)).map(({id,version,title,body,startDate,endDate,startTime,endTime,variant,repeatAfterIdleMinutes})=>({id,version,title,body,startDate,endDate,...(startTime?{startTime}:{}),...(endTime?{endTime}:{}),...(variant?{variant}:{}),...(repeatAfterIdleMinutes?{repeatAfterIdleMinutes}:{})}));
}
export function saveScreenMessage(doc:ScreenMessageDocument,input:unknown,actor:{id:string;name:string},now:string):ScreenMessageDocument{
 if(!input||typeof input!=="object")throw Error("Vul het schermbericht in.");
 const message=input as ScreenMessage;
 if(typeof message.id!=="string"||!/^[a-zA-Z0-9-]{1,100}$/.test(message.id))throw Error("Ongeldig schermbericht.");
 if(typeof message.title!=="string"||!message.title.trim()||message.title.length>120||typeof message.body!=="string"||!message.body.trim()||message.body.length>1600)throw Error("Vul een titel en bericht in (maximaal 120 en 1.600 tekens).");
 if(!validDate(message.startDate)||!validDate(message.endDate)||message.startDate>message.endDate)throw Error("Kies een geldige begin- en einddatum.");
 const validTime=(time:unknown)=>time===undefined||time===""||(typeof time==="string"&&/^([01]\d|2[0-3]):[0-5]\d$/.test(time));
 if(!validTime(message.startTime)||!validTime(message.endTime)||(message.startDate===message.endDate&&message.startTime&&message.endTime&&message.startTime>=message.endTime))throw Error("Kies een geldige begin- en eindtijd.");
 if(message.variant!==undefined&&message.variant!=="welcome-baby")throw Error("Onbekende berichtstijl.");
 if(message.repeatAfterIdleMinutes!==undefined&&(!Number.isInteger(message.repeatAfterIdleMinutes)||message.repeatAfterIdleMinutes<1||message.repeatAfterIdleMinutes>60))throw Error("Kies 1 tot 60 minuten rust voor opnieuw tonen.");
 if(typeof message.enabled!=="boolean")throw Error("Kies of het bericht zichtbaar mag zijn.");
 const old=doc.messages.find(row=>row.id===message.id);
 if(!old&&doc.messages.length>=50)throw Error("Er zijn maximaal 50 schermberichten mogelijk.");
 const next:ScreenMessage={id:message.id,version:(old?.version||0)+1,title:message.title.trim(),body:message.body.trim(),startDate:message.startDate,endDate:message.endDate,enabled:message.enabled,...(message.startTime?{startTime:message.startTime}:{}),...(message.endTime?{endTime:message.endTime}:{}),...(message.variant?{variant:message.variant}:{}),...(message.repeatAfterIdleMinutes?{repeatAfterIdleMinutes:message.repeatAfterIdleMinutes}:{}),updatedAt:now,updatedBy:actor.name,actorId:actor.id};
 return{revision:doc.revision+1,messages:old?doc.messages.map(row=>row.id===next.id?next:row):[...doc.messages,next]};
}
export const screenMessageToken=(message:ScreenMessageView)=>`${message.id}:${message.version}`;
export const SCREEN_SEEN_KEY="strik-production-screen-seen-v1";
export function readScreenSeen(raw:string|null):string[]{try{const data=JSON.parse(raw||"[]");return Array.isArray(data)?data.filter((value):value is string=>typeof value==="string"&&/^[a-zA-Z0-9-]{1,100}:\d{1,9}$/.test(value)).slice(-100):[];}catch{return[];}}
