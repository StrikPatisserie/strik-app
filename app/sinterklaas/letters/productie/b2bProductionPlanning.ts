import { b2bLetterHasLogo, b2bLetterLineLabel } from "../../b2bLetterLines";
import type { SinterklaasB2BOrder } from "../../types";
import type { ProductionBatchSeed } from "./ProductionPlanningClient";
import { b2bProductionLetters } from "../../b2bCombinationLetters";

export type B2BProductionAssignment = {order_id:string;season:number;batch_id:string|null;revision:number};
export type B2BProductionPlan = {id:string;customerName:string;deliveryDate:string;letters:string;quantity:number;batchId:string|null;manual:boolean;revision:number;version:string;combinationQuantity?:number;issues?:string[]};
export function eligibleB2BLetterOrder(order:SinterklaasB2BOrder) {
  const done=order.department==="beide"||order.department==="bakkerij"?order.letterProductionDone:order.productionDone;
  return order.status==="akkoord"&&!order.cancelled&&!order.packed&&!order.delivered&&!done&&b2bProductionLetters(order).requiredQuantity>0;
}
export function batchReadyDate(batch:ProductionBatchSeed) {
  if(batch.pickupFrom)return batch.pickupFrom;
  const day=new Date(`${batch.date}T12:00:00Z`);day.setUTCDate(day.getUTCDate()+batch.minimumLeadDays);return day.toISOString().slice(0,10);
}
export function b2bProductionPlan(order:SinterklaasB2BOrder,batches:ProductionBatchSeed[],assignments:B2BProductionAssignment[]=[]):B2BProductionPlan {
  const production=b2bProductionLetters(order);
  const saved=assignments.find(item=>item.order_id===order.id);
  const suggested=batches.find(batch=>order.productionDate&&(batch.startDate===order.productionDate||batch.date===order.productionDate))||[...batches].filter(batch=>order.deliveryDate&&batchReadyDate(batch)<=order.deliveryDate).sort((a,b)=>a.date.localeCompare(b.date)).at(-1);
  return {id:order.id,customerName:order.customerName,deliveryDate:order.deliveryDate,letters:production.lines.map(line=>`${b2bLetterLineLabel({...line,withLogo:b2bLetterHasLogo(order,line)})}${line.combinationProduct?` · combinatie: ${line.combinationProduct}`:""}`).join(" / "),quantity:production.requiredQuantity,combinationQuantity:production.packageQuantity,issues:production.issues.map(issue=>`${issue.quantity}× ${issue.product}: ${issue.message}`),batchId:saved?saved.batch_id:suggested?.id||null,manual:Boolean(saved),revision:saved?.revision||0,version:JSON.stringify([order.id,order.status,order.cancelled,order.packed,order.delivered,doneForVersion(order),order.deliveryDate,order.productionDate,order.letterLines,production.lines.filter(line=>line.combinationProduct),production.issues,order.logo,order.packaging])};
}
function doneForVersion(order:SinterklaasB2BOrder){return [order.productionDone,order.letterProductionDone];}
