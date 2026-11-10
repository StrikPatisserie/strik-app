import {addDays,BOARDS,DEPARTMENTS,canonicalBoardId,type BoardId,type DepartmentId} from './planning';

export const RELOAD_VIEW_KEY='strik-production-update-view-v1';
export const UPDATE_IDLE_MS=60000;
export type PlanningView={week:string;day:string;board:BoardId;department:DepartmentId|'all';statusFilter:string;wall:boolean;weekend:boolean;period?:'week'|'day'};
export function newerRelease(client?:string,server?:string){return !!client&&!!server&&client!=='development'&&server!=='development'&&client!==server;}
export function updateIsSafe(input:{pending:boolean;blocked:boolean;visible:boolean;online:boolean;editing:boolean;idleMs:number}){
 return input.pending&&!input.blocked&&input.visible&&input.online&&!input.editing&&input.idleMs>=UPDATE_IDLE_MS;
}
/** View preferences only: never store or restore planner/tasks/recipes here. */
export function decodeReloadView(raw:string|null,route:string,now:number):PlanningView|null{
 try{
  if(!raw)return null;const input=JSON.parse(raw),v=input.view as PlanningView;
  if(input.route!==route||!Number.isFinite(input.at)||now<input.at||now-input.at>1800000||!v)return null;
  addDays(v.week,0);addDays(v.day,0);
  const board=canonicalBoardId(v.board);
  if(!BOARDS.some(b=>b.id===board)||!(v.department==='all'||DEPARTMENTS.some(d=>d.id===v.department))||!['all','open','active','attention','done'].includes(v.statusFilter)||typeof v.wall!=='boolean'||typeof v.weekend!=='boolean')return null;
  if(v.period!==undefined&&v.period!=='week'&&v.period!=='day')return null;
  return{week:v.week,day:v.day,board,department:v.department,statusFilter:v.statusFilter,wall:v.wall,weekend:v.weekend,...(v.period!==undefined?{period:v.period}:{})};
 }catch{return null;}
}
export function encodeReloadView(view:PlanningView,route:string,now:number){
 const {week,day,board,department,statusFilter,wall,weekend,period}=view;
 const raw=JSON.stringify({route,at:now,view:{week,day,board,department,statusFilter,wall,weekend,period}});
 if(!decodeReloadView(raw,route,now))throw Error('Ongeldige scherminstellingen.');
 return raw;
}
