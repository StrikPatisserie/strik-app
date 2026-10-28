import type { WeddingCakeDraft } from "../bruidstaart-studio/studioApi";
import type { WeddingCakeConfig } from "../bruidstaart-studio/types";
import { getSelectedWeddingCakeLabels, getDecorationColorNotes, getDecorationNoteTexts, getTopperNoteTexts, getDeliveryTimeLabel, getDeliveryMethodLabel } from "../bruidstaart-studio/pricing";
import { addDays, addItem, addTask, moveTask, transitionTask, type PreviewState, type TaskStatus } from "./planning";
export type WeddingProductionOrder={code:string;name:string;date:string;updatedAt:string;size:string;time:string;lines:{label:string;value:string}[];config:WeddingCakeConfig};
export function weddingOrders(drafts:WeddingCakeDraft[]):WeddingProductionOrder[] {
  const unique=new Map<string,WeddingCakeDraft>();
  for(const draft of drafts){if(!draft.config.completed)continue;const key=draft.code.trim().toLowerCase(),prior=unique.get(key);if(key && (!prior || prior.updatedAt<draft.updatedAt))unique.set(key,draft);}
  return [...unique.values()].flatMap(draft=>{
    const c=draft.config,contact=c.contact,date=contact.deliveryDate || contact.weddingDate;
    try{addDays(date,0);}catch{return [];}
    const labels=getSelectedWeddingCakeLabels(c);
    const name=[contact.names || draft.names,contact.surname || draft.surname].filter(Boolean).join(" ").trim() || draft.code;
    // Send only operational details to the production workspace, including
    // design notes. Payment links, invoice details and prices stay in the Studio.
    const config:WeddingCakeConfig={styleId:c.styleId,sizeId:c.sizeId,fillingId:c.fillingId,layerFillingIds:c.layerFillingIds,colorId:c.colorId,layerColorIds:c.layerColorIds,layoutId:c.layoutId,layerLayoutIds:c.layerLayoutIds,decorationIds:c.decorationIds,decorationQuantities:c.decorationQuantities,decorationColorNotes:c.decorationColorNotes,decorationNotes:c.decorationNotes,decorationExtraNotes:c.decorationExtraNotes,decorationSurcharges:[],topperIds:c.topperIds,topperInitialsText:c.topperInitialsText,topperNotes:c.topperNotes,topperSurcharges:[],additionalProducts:[],customCakeDescription:c.customCakeDescription,customCakePersons:c.customCakePersons,paid:false,completed:true,contact:{names:contact.names,surname:contact.surname,recognitionCode:draft.code,email:"",phone:contact.phone,weddingDate:contact.weddingDate,deliveryDate:date,deliveryMethod:contact.deliveryMethod,deliveryAddress:contact.deliveryAddress,deliveryTimeType:contact.deliveryTimeType,deliveryTimeStart:contact.deliveryTimeStart,deliveryTimeEnd:contact.deliveryTimeEnd,invoiceName:"",invoiceEmail:"",notes:contact.notes}};
    const lines=[
      ["Formaat / opbouw",labels.size],["Stijl",labels.style],["Smaak / vulling",labels.filling],["Kleur",labels.color],["Layout",labels.layout],
      ["Decoratie",labels.decorations.join(", ") || "Geen"],["Decoratie kleuren",getDecorationColorNotes(c).map(n=>`${n.label}: ${n.color}`).join(" · ")],
      ["Decoratie opmerkingen",getDecorationNoteTexts(c).join(" · ")],["Extra decoratie",c.decorationSurcharges.map(n=>n.description).filter(Boolean).join(" · ")],
      ["Topper",labels.topper],["Topper tekst",c.topperInitialsText],["Topper opmerkingen",getTopperNoteTexts(c).join(" · ")],["Extra topper",c.topperSurcharges.map(n=>n.description).filter(Boolean).join(" · ")],
      ["Overige producten",c.additionalProducts.map(n=>n.description).filter(Boolean).join(" · ")],["Maatwerk",c.customCakeDescription],
      ["Levering",getDeliveryMethodLabel(contact.deliveryMethod)],["Tijd",getDeliveryTimeLabel(contact)],["Adres",contact.deliveryAddress],["Telefoon",contact.phone],["Opmerking klant",contact.notes],
    ].filter((line):line is [string,string]=>!!line[1]).map(([label,value])=>({label,value}));
    return [{code:draft.code,name,date,updatedAt:draft.updatedAt,size:labels.size,time:getDeliveryTimeLabel(contact),lines,config}];
  }).sort((a,b)=>a.date.localeCompare(b.date) || a.code.localeCompare(b.code));
}
export function scheduleWedding(state:PreviewState,order:WeddingProductionOrder,date:string,status:TaskStatus):PreviewState {
  addDays(date,0);if(date>order.date)throw Error("Plan de bruidstaart op of vóór de leverdatum.");
  const matching=state.tasks.filter(t=>t.weddingCode?.toLowerCase()===order.code.toLowerCase());
  if(matching.length>1)throw Error("Deze bruidstaart heeft meerdere gekoppelde taken. Controleer de planning eerst.");
  const existing=matching[0];
  if(existing){
    if(existing.weddingDeliveryDate!==order.date && existing.status!=="planned")throw Error("De leverdatum is gewijzigd terwijl de productie al gestart is. Controleer dit eerst met de manager.");
    const updated=state.tasks.map(t=>t.id===existing.id?{...t,dueDate:order.date,weddingDeliveryDate:order.date}:t);
    const tasks=date===existing.date?updated:moveTask(updated,existing.id,date,"bruidstaarten");
    return {...state,tasks:transitionTask(tasks,existing.id,status,state.items)};
  }
  const id=`wedding:${order.code.toLowerCase()}`;
  let next=state.items.some(i=>i.id===id)?state:addItem(state,{id,name:`Bruidstaart · ${order.name} · ${order.code}`,kind:"activity",departmentId:"bruidstaarten",unit:"taak",stock:0,stockKnown:false,note:"Gekoppeld aan de definitieve bruidstaart in de Studio."});
  next=addTask(next,{id,itemId:id,departmentId:"bruidstaarten",date,quantity:1,operation:"Bruidstaart afmaken",status:"planned",note:"",source:"order",batchId:`batch:${id}`,recordsOutput:false,weddingCode:order.code,weddingDeliveryDate:order.date,dueDate:order.date});
  return {...next,tasks:transitionTask(next.tasks,id,status,next.items)};
}
