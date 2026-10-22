import type { SinterklaasB2BOrder } from "../../types";
import type { ProductionBatchSeed } from "./ProductionPlanningClient";

export type B2BProductionAssignment = {order_id:string;season:number;batch_id:string|null;revision:number};
export type B2BProductionPlan = {id:string;customerName:string;deliveryDate:string;letters:string;quantity:number;batchId:string|null;manual:boolean;revision:number;version:string};
export function eligibleB2BLetterOrder(order:SinterklaasB2BOrder) {
  const done=order.department==="beide"||order.department==="bakkerij"?order.letterProductionDone:order.productionDone;
  return order.status==="akkoord"&&!order.cancelled&&!order.delivered&&!done&&order.letterLines.some(line=>line.quantity>0);
}
export function batchReadyDate(batch:ProductionBatchSeed) {
  if(batch.pickupFrom)return batch.pickupFrom;
  const day=new Date(`${batch.date}T12:00:00Z`);day.setUTCDate(day.getUTCDate()+batch.minimumLeadDays);return day.toISOString().slice(0,10);
}
export function b2bProductionPlan(order:SinterklaasB2BOrder,batches:ProductionBatchSeed[],assignments:B2BProductionAssignment[]=[]):B2BProductionPlan {
  const saved=assignments.find(item=>item.order_id===order.id);
  const suggested=batches.find(batch=>order.productionDate&&(batch.startDate===order.productionDate||batch.date===order.productionDate))||[...batches].filter(batch=>order.deliveryDate&&batchReadyDate(batch)<=order.deliveryDate).sort((a,b)=>a.date.localeCompare(b.date)).at(-1);
  return {id:order.id,customerName:order.customerName,deliveryDate:order.deliveryDate,letters:order.letterLines.map(line=>`${line.quantity}× ${line.letter} · ${line.chocolate} · ${line.size} · ${line.style}${line.exceptions.length?` · ${line.exceptions.join(", ")}`:""}`).join(" / "),quantity:order.letterLines.reduce((sum,line)=>sum+line.quantity,0),batchId:saved?saved.batch_id:suggested?.id||null,manual:Boolean(saved),revision:saved?.revision||0,version:JSON.stringify([order.id,order.status,order.cancelled,order.delivered,doneForVersion(order),order.deliveryDate,order.productionDate,order.letterLines,order.logo,order.packaging])};
}
function doneForVersion(order:SinterklaasB2BOrder){return [order.productionDone,order.letterProductionDone];}
