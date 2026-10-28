import "server-only";
import { fetchTamigoProductionRosterSource,getTamigoStatusCode } from "../tamigoApi";
import { addDays,mondayOf,normalizeStaffingSettings,validStaffingSettings,type ProductionStaffingSettings } from "./planning";
import { readDocument,ProductionStoreError } from "./documents.server";
import type { PreviewState } from "./planning";
import { rosterDepartments,productionDepartmentCandidate,normalizeRosterShifts,normalizeRosterAbsences,dedupeRoster,vacationWarnings,type RosterCheck,type RosterEntry,type ProductionRoster } from "./staffing";

function failure(source:RosterCheck["source"],error:unknown,departmentId?:string):RosterCheck{
 const status=getTamigoStatusCode(error);
 return {source,departmentId,available:false,message:status===401?"Tamigo heeft de roosteraanvraag afgewezen (401). Controleer de sessie en aanvraagparameters.":status===403?"Tamigo geeft geen toegang tot deze roosterbron (403). Controleer de API-bevoegdheden.":"Deze Tamigo-roosterbron is niet bereikbaar of onvolledig. Ontbrekende gegevens zijn niet als vrije dagen geteld."};
}
export async function getProductionRoster(week:string,canManage:boolean):Promise<ProductionRoster>{
 week=mondayOf(week);const planner=await readDocument<PreviewState>("planner");if(!planner)throw new ProductionStoreError("De productieopslag is nog niet ingericht.");
 const checks:RosterCheck[]=[],entries:RosterEntry[]=[];let availableDepartments:ProductionRoster["departments"]=[];
 try{availableDepartments=rosterDepartments(await fetchTamigoProductionRosterSource({kind:"departments"}));checks.push({source:"departments",available:true,message:"Afdelingen rechtstreeks uit Tamigo."});}catch(e){checks.push(failure("departments",e));}
 if(planner.data.staffing && !validStaffingSettings(planner.data.staffing))throw new ProductionStoreError("De roosterinstellingen moeten door management worden gecontroleerd.");
 const settings:ProductionStaffingSettings=normalizeStaffingSettings(planner.data.staffing || {departmentIds:availableDepartments.filter(d=>productionDepartmentCandidate(d.name)).map(d=>d.id).slice(0,12),people:[]});
 const departments=settings.departmentIds.map(id=>availableDepartments.find(d=>d.id===id) || {id,name:"Opgeslagen productieafdeling"});
 if(!departments.length)checks.push({source:"data",available:false,message:canManage?"Kies de Tamigo-productieafdelingen bij Roosterinstellingen.":"De productieafdelingen zijn nog niet gekoppeld. Vraag een manager dit bij Rooster in te stellen."});
 // Include a boundary night and enough lookahead for a full workweek of leave
 // starting midweek. All source operations remain GET, without wages/comments.
 for(let offset=0;offset<departments.length;offset+=3){
  await Promise.all(departments.slice(offset,offset+3).map(async department=>{
   await Promise.all((["planned","absences"] as const).map(async kind=>{
    try{const raw=await fetchTamigoProductionRosterSource({kind,departmentId:department.id,from:addDays(week,-1),to:addDays(week,21)}),result=kind==="planned"?normalizeRosterShifts(raw,department):normalizeRosterAbsences(raw,department);
     entries.push(...result.entries);checks.push({source:kind,departmentId:department.id,available:!result.skipped,message:result.skipped?`${result.skipped} bronregels hebben geen betrouwbare identiteit, locatie of datum; controleer de volledigheid.`:kind==="planned"?"Geplande diensten gelezen.":"Geplande afwezigheid gelezen; vrije tekst blijft in Tamigo."});
    }catch(e){checks.push(failure(kind,e,department.id));}
   }));
  }));
 }
 const normalized=dedupeRoster(entries).filter(e=>e.date>=week && e.date<addDays(week,21));
 const coverageComplete=departments.length>0 && checks.every(c=>c.available);
 const warnings=vacationWarnings(week,normalized,settings,coverageComplete);
 return {week,generatedAt:new Date().toISOString(),entries:normalized,departments,availableDepartments:canManage?[...availableDepartments,...departments.filter(d=>!availableDepartments.some(a=>a.id===d.id))]:departments,settings,revision:planner.revision,checks,coverageComplete,...warnings};
}
