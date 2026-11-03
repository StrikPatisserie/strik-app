import {formatTime,localDate} from "./reviewTime";
import type { ReviewShift } from "./reviewTypes";
export type AuditValues={start:string|null;end:string|null;breakMinutes:number|null;netMinutes:number|null};
export type ReviewCorrection={id:string;actorName?:string;shiftId:string;observedShiftId:string|null;employeeId:string;departmentId:string;date:string;state:"applied"|"applying"|"unknown";createdAt:string;finishedAt:string|null;reason:string;message:string;before:AuditValues;after:AuditValues};
export type CorrectionAuditOverview={available:boolean;corrections:ReviewCorrection[]};
export function correctionAuditForShift(shift:ReviewShift|null,overview?:CorrectionAuditOverview){
 if(!shift||!overview?.available)return null;
 const candidates=overview.corrections.filter(record=>record.employeeId===shift.employeeId&&record.departmentId===shift.departmentId&&record.date===shift.date);
 const linked=new Set([shift.id]);let changed=true;
 while(changed){changed=false;for(const record of candidates){if(linked.has(record.shiftId)||(record.observedShiftId&&linked.has(record.observedShiftId))){for(const id of [record.shiftId,record.observedShiftId])if(id&&!linked.has(id)){linked.add(id);changed=true;}}}}
 const records=candidates.filter(record=>linked.has(record.shiftId)||(record.observedShiftId&&linked.has(record.observedShiftId))).sort((a,b)=>a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id));
 if(!records.length)return null;
 const applied=records.filter(record=>record.state==="applied"),latest=applied.at(-1),pending=records.filter(record=>record.state!=="applied"&&(!latest||record.createdAt>=latest.createdAt));
 const matches=!!latest&&latest.after.start===shift.start.iso&&latest.after.end===shift.end.iso&&latest.after.breakMinutes===shift.breakMinutes&&latest.after.netMinutes!==null&&shift.reportedNetMinutes!==null&&Math.abs(latest.after.netMinutes-shift.reportedNetMinutes)<.01;
 return {records,original:(applied[0]||records[0]).before,latest,status:pending.length?"uncertain" as const:matches?"corrected" as const:"changed" as const};
}

export function correctionChangeText(record:ReviewCorrection){
 const changes:string[]=[];
 const time=(value:string|null,other:string|null)=>!value?"onbekend":other&&localDate(Date.parse(value))!==localDate(Date.parse(other))?new Intl.DateTimeFormat("nl-NL",{timeZone:"Europe/Amsterdam",day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}).format(new Date(value)):formatTime(value);
 for(const [key,label] of [["start","Start"],["end","Einde"]] as const)if(record.before[key]!==record.after[key])changes.push(`${label} ${time(record.before[key],record.after[key])} → ${time(record.after[key],record.before[key])}`);
 if(record.before.breakMinutes!==record.after.breakMinutes)changes.push(`Pauze ${record.before.breakMinutes??"onbekend"} → ${record.after.breakMinutes??"onbekend"} min`);
 return changes.join(" · ")||"Registratie bijgewerkt";
}
