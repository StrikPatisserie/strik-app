import { addDays,mondayOf,type ProductionStaffingSettings } from "./planning";
import { parseTime,localDate,formatTime } from "../management/urencontrole/reviewTime";

export type RosterDepartment={id:string;name:string};
export type RosterEntry={id:string;employeeId:string;name:string;departmentId:string;department:string;date:string;start:string|null;end:string|null;minutes:number|null;kind:"work"|"vacation"|"away"|"other";uncertain:boolean;source:"shift"|"absence"};
export type RosterCheck={departmentId?:string;source:"departments"|"planned"|"absences"|"data";available:boolean;message:string};
export type VacationAlert={employeeId:string;name:string;from:string;to:string;tasks:string;hours:number};
export type ProductionRoster={week:string;generatedAt:string;entries:RosterEntry[];departments:RosterDepartment[];availableDepartments:RosterDepartment[];settings:ProductionStaffingSettings;revision:number;checks:RosterCheck[];alerts:VacationAlert[];reviewNames:string[];coverageComplete:boolean};
type Row=Record<string,unknown>;
const text=(v:unknown)=>typeof v==="string"?v.trim():"";
export function rosterRows(value:unknown,keys=["Data","data","Result","result","Shifts","Departments"]):Row[]{
 if(value && typeof value==="object" && ((value as Row).Success===false || (value as Row).success===false))throw Error("Tamigo bevestigde deze bron niet.");
 const rows=Array.isArray(value)?value:value && typeof value==="object"?keys.map(k=>(value as Row)[k]).find(Array.isArray):null;
 if(!Array.isArray(rows) || rows.some(v=>!v || typeof v!=="object" || Array.isArray(v)))throw Error("Onbekend Tamigo-antwoord; volledigheid is niet bevestigd.");
 if(value && !Array.isArray(value) && typeof value==="object" && typeof (value as Row).TotalCount==="number" && Number((value as Row).TotalCount)>rows.length)throw Error("Het Tamigo-antwoord is afgekapt; volledigheid is niet bevestigd.");
 return rows;
}
export function rosterDepartments(value:unknown):RosterDepartment[]{return rosterRows(value).filter(r=>r.Enabled!==false).flatMap(r=>text(r.DepartmentId)&&text(r.Name)?[{id:text(r.DepartmentId).toLowerCase(),name:text(r.Name)}]:[]);}
export function productionDepartmentCandidate(name:string){return /bakkerij|bakkant|bakafdeling|patisserie|banket|brood|chocolade|ijsbereiding|ijsproductie|productie|^ijs$/i.test(name) && !/winkel|loket|salon/i.test(name);}
function dateOnly(raw:unknown){const value=text(raw).slice(0,10);try{return addDays(value,0);}catch{return "";}}
function kind(activity:string,productive:unknown):RosterEntry["kind"]{
 if(/\b(vakantie|vacation|annual leave|vak|holiday)\b/i.test(activity) && !/geen|annule|cancel|verzoek|request|bank holiday|public holiday|feestdag/i.test(activity))return "vacation";
 if(/ziek|verlof|afwezig|absence|sick|maternity|parental/i.test(activity))return "away";
 return productive===true?"work":"other";
}
function entry(row:Row,department:RosterDepartment,source:"shift"|"absence",id:string):RosterEntry|null {
 const employeeId=text(row.EmployeeId).toLowerCase(),start=parseTime(row.StartDateTime),end=parseTime(row.EndDateTime);
 if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(employeeId) || /^0{8}-0{4}-0{4}-0{4}-0{12}$/.test(employeeId))return null;
 const date=start.ms!==null?localDate(start.ms):dateOnly(row.Date);if(!date)return null;
 const actualDepartment=(text(row.DepartmentId) || (source==="absence"?text(row.StoreId):"")).toLowerCase();
 if(!actualDepartment || actualDepartment.toLowerCase()!==department.id.toLowerCase())return null;
 const activity=text(row.ShiftActivityName)||text(row.ShiftActivityShortName)||text(row.AbsenceName);
 const hours=typeof row.ShiftHours==="number" && Number.isFinite(row.ShiftHours) && row.ShiftHours>0?row.ShiftHours:null;
 const gross=start.ms!==null && end.ms!==null?(end.ms-start.ms)/60000:null;
 const breakHours=typeof row.BreakCodeHours==="number" && row.BreakCodeHours>=0?row.BreakCodeHours:0;
 const minutes=hours!==null?hours*60:gross!==null && gross>0?Math.max(0,gross-breakHours*60):null;
 const multiDay=start.ms!==null && end.ms!==null && localDate(start.ms)!==localDate(end.ms-1);
 return {id,employeeId,name:text(row.EmployeeName)||text(row.Name)||"Naam ontbreekt",departmentId:actualDepartment,department:department.name,date,start:start.iso,end:end.iso,minutes:multiDay&&source==="absence"?null:minutes,kind:kind(activity,source==="absence"?false:row.IsProductive),uncertain:(source==="shift" && Number(row.PlanStatusCodeId)!==2) || Boolean(row.AbsencePercentage && Number(row.AbsencePercentage)<100) || Boolean(gross!==null && (gross<=0 || gross>1440 || (minutes!==null && minutes>gross+0.001))) || Boolean((start.issue && start.issue!=="missing") || (end.issue && end.issue!=="missing")),source};
}
export function normalizeRosterShifts(value:unknown,department:RosterDepartment){
 const rows=rosterRows(value),entries:RosterEntry[]=[];let skipped=0;
 for(const row of rows){if(row.PlanStatusCodeId!==undefined && [3,4,5,6].includes(Number(row.PlanStatusCodeId)))continue;const id=text(row.ShiftId).toLowerCase();const found=id?entry(row,department,"shift",id):null;if(found)entries.push(found);else if(text(row.DepartmentId).toLowerCase()===department.id.toLowerCase() || !text(row.DepartmentId))skipped++;}
 return {entries,skipped};
}
export function normalizeRosterAbsences(value:unknown,department:RosterDepartment){
 const entries:RosterEntry[]=[];let skipped=0;
 for(const parent of rosterRows(value,["Data","data","Result","result","Absences"])){
  if(parent.Deleted===true)continue;
  // Planned applied absences only. Never turn requested or actual records into
  // next week's approved leave, and never join on an employee's name.
  if(!Array.isArray(parent.Planned)){skipped++;continue;}
  for(const [index,raw] of parent.Planned.entries()){
   if(!raw || typeof raw!=="object" || Array.isArray(raw)){skipped++;continue;}
   const row={...parent,...raw} as Row;if(row.Deleted===true || row.IsActual===true)continue;
   const id=`absence:${text(row.EmployeeId)}:${text(row.StartDateTime)}:${text(row.EndDateTime)}:${text(row.AbsenceTypeId)}:${index}`;
   const found=entry(row,department,"absence",id);if(found)entries.push(found);else skipped++;
  }
 }
 return {entries,skipped};
}
export function dedupeRoster(entries:RosterEntry[]){
 const byId=new Map<string,RosterEntry>();const fingerprint=(e:RosterEntry)=>JSON.stringify([e.employeeId,e.departmentId,e.date,e.start,e.end,e.minutes,e.kind]);
 for(const row of entries){const key=row.source==="shift"?row.id:`${row.employeeId}:${row.date}:${row.start}:${row.end}:${row.kind}:${row.minutes}`;const old=byId.get(key);byId.set(key,old?{...old,uncertain:old.uncertain||row.uncertain||fingerprint(old)!==fingerprint(row)}:row);}
 return [...byId.values()].sort((a,b)=>a.date.localeCompare(b.date)||(a.start||"").localeCompare(b.start||"")||a.name.localeCompare(b.name,"nl"));
}
export function rosterTime(entry:RosterEntry){return entry.start?`${formatTime(entry.start)}–${entry.end?formatTime(entry.end):"eindtijd ontbreekt"}${entry.end && localDate(Date.parse(entry.end))!==entry.date?" (+1)":""}`:"Tijd niet beschikbaar";}
function vacationSourceMinutes(rows:RosterEntry[]):number|null{
 const unique=[...new Map(rows.map(e=>[`${e.start}:${e.end}`,e])).values()];
 if(unique.some(e=>!e.start || !e.end))return Math.max(0,...unique.map(e=>e.minutes || 0));
 unique.sort((a,b)=>Date.parse(a.start!)-Date.parse(b.start!));
 if(unique.some((e,index)=>index>0 && Date.parse(e.start!)<Date.parse(unique[index-1].end!)))return null;
 return unique.reduce((sum,e)=>sum+(e.minutes || 0),0);
}
export function vacationWarnings(week:string,entries:RosterEntry[],settings:ProductionStaffingSettings,coverageComplete:boolean){
 const next=addDays(mondayOf(week),7),last=addDays(next,6),limit=addDays(next,13),alerts:VacationAlert[]=[],reviewNames:string[]=[];
 for(const entry of entries.filter(e=>e.kind==="vacation" && e.date>=next && e.date<=last))if(!settings.people.some(p=>p.employeeId===entry.employeeId) && !reviewNames.includes(entry.name))reviewNames.push(entry.name);
 for(const person of settings.people){
  const own=entries.filter(e=>e.employeeId===person.employeeId),vacation=own.filter(e=>e.kind==="vacation" && e.date>=next && e.date<=last);
  if(!vacation.length)continue;
  if(!coverageComplete || !person.weekdays.length || !person.weeklyHours){reviewNames.push(person.name);continue;}
  const days=Array.from({length:14},(_,i)=>addDays(next,i)).filter(d=>person.weekdays.includes(new Date(`${d}T12:00:00Z`).getUTCDay()));
  for(let index=0;index<days.length && days[index]<=last;index++){
   const block=days.slice(index,index+person.weekdays.length);if(block.length<person.weekdays.length || block[block.length-1]>limit)continue;
   let minutes=0,valid=true;
   for(const day of block){
    const daily=own.filter(e=>e.date===day),leave=daily.filter(e=>e.kind==="vacation");
    if(!leave.length || daily.some(e=>e.kind==="work" || e.uncertain) || leave.some(e=>e.minutes===null)){valid=false;break;}
    // The same absence can appear both as a planned shift and in the absence
    // report. Take the greater source total; never add these two sources.
    const shiftMinutes=vacationSourceMinutes(leave.filter(e=>e.source==="shift")),absenceMinutes=vacationSourceMinutes(leave.filter(e=>e.source==="absence"));
    if(shiftMinutes===null || absenceMinutes===null){valid=false;break;}
    minutes+=Math.max(shiftMinutes,absenceMinutes);
   }
   if(valid && minutes+0.001>=person.weeklyHours*60){alerts.push({employeeId:person.employeeId,name:person.name,from:block[0],to:block.at(-1)!,tasks:person.tasks,hours:minutes/60});break;}
  }
 }
 return {alerts,reviewNames};
}
