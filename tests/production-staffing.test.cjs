const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function load(file,imports={},globals={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,require:name=>{if(!(name in imports))throw Error(`Unmocked ${name}`);return imports[name];},Date,Intl,Error,Map,Set,URL,Request,Response,AbortSignal,structuredClone,...globals});return exports;}
const planning=load('app/productie/planning.ts'),time=load('app/management/urencontrole/reviewTime.ts',{'./reviewTypes':{TIME_ZONE:'Europe/Amsterdam'}}),staff=load('app/productie/staffing.ts',{'./planning':planning,'../management/urencontrole/reviewTime':time});
const access=load('app/lib/auth/access.ts'),rights=load('app/productie/access.ts',{'../lib/auth/access':access,'./planning':planning});
const employeeId='11111111-1111-4111-8111-111111111111',departmentId='22222222-2222-4222-8222-222222222222',other='33333333-3333-4333-8333-333333333333',week='2026-11-02',department={id:departmentId,name:'Patisserie'},person={employeeId,name:'Voorbeeld Marit',weekdays:[1,2,3,4,5],weeklyHours:37.5,tasks:'Keizer Karels en vlaaibodems op voorraad brengen.'},settings={departmentIds:[departmentId],people:[person]};
const raw=(extra={})=>({ShiftId:'shift-1',EmployeeId:employeeId,EmployeeName:'Voorbeeld Marit',DepartmentId:departmentId,DepartmentName:'Patisserie',StartDateTime:'2026-11-09T05:30:00+01:00',EndDateTime:'2026-11-09T14:00:00+01:00',IsProductive:false,PlanStatusCodeId:2,ShiftActivityName:'Vakantie',ShiftHours:7.5,Comments:'private-note',WageSystemKey:'private-payroll-key',...extra});
function leave(date,extra={}){return staff.normalizeRosterShifts([raw({ShiftId:`shift-${date}`,...extra,StartDateTime:`${date}T05:30:00+01:00`,EndDateTime:`${date}T14:00:00+01:00`})],department).entries[0];}
const vacation=()=>Array.from({length:5},(_,i)=>leave(planning.addDays(week,7+i)));

test('roster normalization uses stable identities and actual departments, deduplicates references and strips payroll/comments/health labels',()=>{
 const first=staff.normalizeRosterShifts([raw()],department).entries[0];assert.equal(first.kind,'vacation');assert(!JSON.stringify(first).includes('private'));
 assert.equal(staff.normalizeRosterShifts([raw({EmployeeId:''})],department).skipped,1);assert.equal(staff.normalizeRosterShifts([raw({DepartmentId:other})],department).entries.length,0);
 assert.equal(staff.dedupeRoster([first,first]).length,1);assert.equal(staff.dedupeRoster([first,{...first,minutes:120}])[0].uncertain,true);
 const sick=staff.normalizeRosterShifts([raw({ShiftActivityName:'Ziek, private diagnosis'})],department).entries[0];assert.equal(sick.kind,'away');assert(!JSON.stringify(sick).includes('diagnosis'));
 const published=staff.normalizeRosterShifts([raw({PlanStatusCodeId:1})],department).entries[0];assert.equal(published.uncertain,true);assert.equal(staff.normalizeRosterShifts([raw({PlanStatusCodeId:3})],department).entries.length,0);
});
test('planned absences keep employee IDs, ignore actual/request-only rows and never match on names',()=>{
 const source=[{EmployeeId:employeeId,Name:'Voorbeeld Marit',AbsenceName:'Vakantie',Planned:[{DepartmentId:departmentId,StartDateTime:'2026-11-09T05:30:00+01:00',EndDateTime:'2026-11-09T14:00:00+01:00',ShiftHours:7.5,Comment:'private'}],Actual:[{private:'not a future vacation'}]}];
 const result=staff.normalizeRosterAbsences(source,department);assert.equal(result.entries.length,1);assert.equal(result.entries[0].employeeId,employeeId);assert.equal(result.entries[0].kind,'vacation');assert(!JSON.stringify(result).includes('private'));
 assert.equal(staff.normalizeRosterAbsences([{Name:'Voorbeeld Marit',Planned:[{DepartmentId:departmentId,StartDateTime:'2026-11-09T05:30:00+01:00'}]}],department).entries.length,0);
 assert.equal(staff.normalizeRosterAbsences([{EmployeeId:employeeId,Requested:[source[0].Planned[0]]}],department).skipped,1);
});
test('work times preserve midnight crossings and Amsterdam DST; ambiguous local times stay uncertain',()=>{
 const night=staff.normalizeRosterShifts([raw({IsProductive:true,ShiftActivityName:'Productie',StartDateTime:'2026-10-24T22:00:00+02:00',EndDateTime:'2026-10-25T06:00:00+01:00',ShiftHours:8.5})],department).entries[0];assert.equal(night.date,'2026-10-24');assert.equal(staff.rosterTime(night),'22:00–06:00 (+1)');assert.equal(night.minutes,510);
 const ambiguous=staff.normalizeRosterShifts([raw({StartDateTime:'2026-10-25T02:30:00',EndDateTime:'2026-10-25T04:30:00',Date:'2026-10-25'})],department).entries[0];assert.equal(ambiguous.uncertain,true);assert.equal(ambiguous.start,null);
});
test('stock reminders require a complete normal workweek and include the assigned products',()=>{
 const result=staff.vacationWarnings(week,vacation(),settings,true);assert.equal(result.alerts.length,1);assert.equal(result.alerts[0].from,'2026-11-09');assert.match(result.alerts[0].tasks,/vlaaibodems/);
 assert.equal(staff.vacationWarnings(week,vacation().slice(0,4),settings,true).alerts.length,0);
 const parttime={departmentIds:[departmentId],people:[{...person,weekdays:[1,3,5],weeklyHours:22.5}]};assert.equal(staff.vacationWarnings(week,[leave('2026-11-09'),leave('2026-11-11'),leave('2026-11-13')],parttime,true).alerts.length,1);
 const crossing=[leave('2026-11-11'),leave('2026-11-12'),leave('2026-11-13'),leave('2026-11-16'),leave('2026-11-17')];assert.equal(staff.vacationWarnings(week,crossing,settings,true).alerts[0].to,'2026-11-17');
});
test('unknown norms, incomplete APIs, work during leave, partial leave and overlapping duplicate absences cannot produce a full-week alert',()=>{
 assert.equal(staff.vacationWarnings(week,vacation(),{...settings,people:[{...person,weeklyHours:null,weekdays:[]}]},true).alerts.length,0);
 assert.equal(staff.vacationWarnings(week,vacation(),settings,false).reviewNames.length,1);
 assert.equal(staff.vacationWarnings(week,[...vacation(),{...vacation()[0],id:'work',kind:'work'}],settings,true).alerts.length,0);
 assert.equal(staff.vacationWarnings(week,vacation().map((e,i)=>i===0?{...e,uncertain:true,minutes:240}:e),settings,true).alerts.length,0);
 assert.equal(staff.vacationWarnings(week,[...vacation(),...vacation().map(e=>({...e,id:`absence-${e.id}`,source:'absence'}))],{...settings,people:[{...person,weeklyHours:75}]},true).alerts.length,0);
 const overlapping=[...vacation(),{...vacation()[0],id:'overlap',start:'2026-11-09T07:00:00Z',end:'2026-11-09T15:00:00Z',minutes:480}];assert.equal(staff.vacationWarnings(week,overlapping,settings,true).alerts.length,0);
});
test('roster settings are bounded and keyed by employee IDs instead of names',()=>{
 assert(planning.validStaffingSettings(settings));for(const value of [{...settings,people:[person,person]},{...settings,people:[{...person,employeeId:'Marit'}]},{...settings,people:[{...person,weekdays:[1,1]}]},{...settings,people:[{...person,weeklyHours:100}]},{...settings,departmentIds:['name']}])assert(!planning.validStaffingSettings(value));
});
test('roster settings whitelist their stored fields and canonicalize UUID casing without leaking added personnel fields',()=>{
 const value={...settings,salary:'private',people:[{...person,employeeId:employeeId.toUpperCase(),name:' Voorbeeld Marit ',tasks:' Voorraad aanvullen ',salary:'private',bsn:'private'}]};
 const normalized=planning.normalizeStaffingSettings(value);assert.equal(normalized.people[0].employeeId,employeeId);assert.equal(normalized.people[0].name,'Voorbeeld Marit');assert.equal(normalized.people[0].tasks,'Voorraad aanvullen');assert(!JSON.stringify(normalized).includes('private'));
 assert.throws(()=>staff.rosterRows({Success:false,Data:[]}));assert.throws(()=>staff.rosterRows({Data:[],TotalCount:2}));
});
class StoreError extends Error{constructor(message,status=503){super(message);this.status=status;}}
const manager={id:'m',active:true,role:'manager',permissions:{}},baker={id:'b',active:true,role:'bakkerij',permissions:{'bakkerij.patisserie':true}};
function api(profile){let writes=0,reads=0;const planner={data:{version:1,items:[],tasks:[]},revision:4};const route=load('app/api/productie/rooster/route.ts',{'@/app/lib/auth/session':{getCurrentProfile:async()=>profile},'@/app/lib/auth/access':access,'@/app/productie/access':rights,'@/app/productie/staffing.server':{getProductionRoster:async()=>{reads++;return{entries:[]};}},'@/app/productie/documents.server':{ProductionStoreError:StoreError,readDocument:async()=>planner,saveDocument:async(key,revision,state)=>{assert.equal(key,'planner');assert.equal(revision,4);assert.deepEqual(JSON.parse(JSON.stringify(state.staffing)),settings);writes++;return 5;}},'@/app/productie/planning':planning,'@/app/productie/workspaceData':{todayAmsterdam:()=>week}});return{route,writes:()=>writes,reads:()=>reads};}
const put=(revision=4,origin)=>new Request('https://test.invalid/api/productie/rooster',{method:'PUT',headers:{'Content-Type':'application/json',...(origin?{origin}:{})},body:JSON.stringify({settings,revision})});
test('only active production accounts read staff; only managers save settings with revision and origin checks',async()=>{
 for(const profile of [null,{...manager,active:false},{id:'shop',active:true,role:'winkel',permissions:{}}]){const a=api(profile);assert.equal((await a.route.GET(new Request('https://test.invalid'))).status,403);assert.equal(a.reads(),0);assert.equal((await a.route.PUT(put())).status,403);assert.equal(a.writes(),0);}
 const b=api(baker);assert.equal((await b.route.GET(new Request('https://test.invalid?week=2026-11-02'))).status,200);assert.equal((await b.route.PUT(put())).status,403);
 const a=api(manager);assert.equal((await a.route.PUT(put(3))).status,409);assert.equal(a.writes(),0);assert.equal((await a.route.PUT(put(4,'https://elsewhere.invalid'))).status,403);assert.equal((await a.route.PUT(put())).status,200);assert.equal(a.writes(),1);
});
test('the production roster reads only selected production departments and reports unavailable leave without inventing vacations',async()=>{
 const calls=[];const service=load('app/productie/staffing.server.ts',{'server-only':{},'../tamigoApi':{fetchTamigoProductionRosterSource:async input=>{calls.push(input);if(input.kind==='departments')return[{DepartmentId:departmentId,Name:'Patisserie',Enabled:true},{DepartmentId:other,Name:'Winkel Lent',Enabled:true}];if(input.kind==='absences')throw Error('403');return[raw()];},getTamigoStatusCode:()=>403},'./planning':planning,'./documents.server':{ProductionStoreError:StoreError,readDocument:async()=>({data:{version:1,items:[],tasks:[],staffing:settings},revision:1})},'./staffing':staff});
 const data=await service.getProductionRoster(week,false);assert.equal(data.availableDepartments.length,1);assert(calls.filter(c=>c.kind!=='departments').every(c=>c.departmentId===departmentId));assert.equal(data.coverageComplete,false);assert.equal(data.alerts.length,0);assert.match(data.checks.find(c=>c.source==='absences').message,/403/);assert(!JSON.stringify(data).includes('private'));
});
test('Tamigo production access is GET-only, uses the planned filter and can use the second authorized key',async()=>{
 const requests=[];const source=load('app/tamigoApi.ts',{'server-only':{},'./management/urencontrole/reviewTime':time,'./strik-agenda/personnelJubilees':{}},{process:{env:{TAMIGO_API_KEY:'default-test-key',TAMIGO_LOON_API_KEY:'second-test-key'}},fetch:async(url,options)=>{requests.push({url:new URL(url),options});return options.headers['x-tamigo-token']==='default-test-key'?Response.json({}, {status:403}):Response.json([]);}});
 await source.fetchTamigoProductionRosterSource({kind:'planned',departmentId,from:week,to:'2026-11-23'});assert.equal(requests.length,2);for(const r of requests){assert.equal(r.options.method,'GET');assert.equal(r.url.pathname,'/v2/Shifts/');assert.equal(r.url.searchParams.get('shiftStatus'),'planned');assert.equal(r.url.searchParams.get('departmentId'),departmentId);assert(!('body' in r.options));}
 await source.fetchTamigoProductionRosterSource({kind:'absences',departmentId,from:week,to:'2026-11-23'});assert.equal(requests.at(-1).url.pathname,'/v2/Absences/AbsenceOverview/');
});
