import { addDays,type ProductionStaffingSettings } from "./planning";
import type { ProductionRoster,RosterEntry } from "./staffing";
export function demoProductionRoster(week:string):ProductionRoster{
 const department={id:"00000000-0000-4000-8000-000000000001",name:"Patisserie · voorbeeld"},employeeId="00000000-0000-4000-8000-000000000002",second="00000000-0000-4000-8000-000000000003";
 const settings:ProductionStaffingSettings={departmentIds:[department.id],people:[{employeeId,name:"Voorbeeld Marit",weekdays:[1,2,3,4,5],weeklyHours:37.5,tasks:"Keizer Karels en vlaaibodems op voorraad brengen."}]};
 const entries:RosterEntry[]=Array.from({length:12},(_,index):RosterEntry=>{const vacation=index>=7,date=addDays(week,index);return{id:`demo-${index}`,employeeId,name:"Voorbeeld Marit",departmentId:department.id,department:department.name,date,start:`${date}T05:30:00+01:00`,end:`${date}T14:00:00+01:00`,minutes:450,kind:vacation?"vacation":"work",uncertain:false,source:"shift"};}).filter(e=>![0,6].includes(new Date(`${e.date}T12:00:00Z`).getUTCDay()));
 entries.push(...entries.filter(e=>e.kind==="work").map(e=>({...e,id:`second-${e.id}`,employeeId:second,name:"Voorbeeld bakker"})));
 return{week,generatedAt:"2026-10-28T10:00:00Z",entries,settings,revision:1,departments:[department],availableDepartments:[department],coverageComplete:true,checks:[],reviewNames:[],alerts:[{employeeId,name:"Voorbeeld Marit",from:addDays(week,7),to:addDays(week,11),hours:37.5,tasks:settings.people[0].tasks}]};
}
