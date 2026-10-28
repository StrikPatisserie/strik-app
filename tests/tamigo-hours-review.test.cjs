const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
function loader(mocks={},globals={}){
  const cache=new Map();
  function load(file){
    file=path.resolve(file);
    if(cache.has(file))return cache.get(file);
    const exports={};cache.set(file,exports);
    const source=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
    vm.runInNewContext(source,{exports,require:name=>{
      if(Object.hasOwn(mocks,name))return mocks[name];
      if(name==='server-only')return {};
      if(name.startsWith('.')||name.startsWith('@/')){
        const resolved=name.startsWith('@/')?path.resolve(name.slice(2)):path.resolve(path.dirname(file),name);
        return load([resolved,resolved+'.ts',resolved+'.tsx'].find(p=>fs.existsSync(p)&&fs.statSync(p).isFile()));
      }
      return require(name);
    },URL,Response,Request,Date,Intl,Map,Set,AbortSignal,process,structuredClone,...globals});
    return exports;
  }
  return load;
}
const load=loader();
const base='app/management/urencontrole/';
const rules=load(base+'reviewRules.ts'),time=load(base+'reviewTime.ts'),source=load(base+'reviewSource.ts'),types=load(base+'reviewTypes.ts');
const instant=(clock,day='05')=>`2026-10-${day}T${clock}:00+02:00`;
function shift(id,start='08:00',end='16:00',options={}){
  const day=options.day||'05';
  return source.normalizeReviewShift({ShiftId:id,EmployeeId:'employee-1',EmployeeName:'Testpersoon',DepartmentId:'department-a',DepartmentName:'Winkel A',StartDateTime:start===null?null:start.includes('T')?start:instant(start,day),EndDateTime:end===null?null:end.includes('T')?end:instant(end,day),BreakCodeHours:0,Comments:'',Comments2:'',IsProductive:true,PlanStatusCodeId:id.startsWith('p')?2:3,...options},options.requestedDepartment||'department-a',0);
}
function dataset(planned,actual,options={}){return {month:'2026-10',generatedAt:'2026-11-02T12:00:00Z',sourceVersion:'test',departments:[{id:'department-a',name:'Winkel A'}],planned,actual,coverage:{planned:['department-a','department-b'],actual:['department-a','department-b']},checks:[],...options};}
function result(p,a,config=types.DEFAULT_REVIEW_CONFIG){return rules.buildHoursReview(dataset(p?[p]:[],a?[a]:[]),config).find(row=>row.actual);}
function flags(row,type){return row.flags.filter(flag=>flag.type===type);}
function times(row){return [time.formatTime(row.proposal?.start),time.formatTime(row.proposal?.end)];}

test('early start is capped at planned start; end is rounded down',()=>{
 const original=shift('a1','07:50','16:09');const row=result(shift('p1'),original);
 assert.deepEqual(times(row),['08:00','16:00']);assert.equal(row.proposal.netMinutes,480);assert.equal(row.originalNetMinutes,499);assert.equal(original.start.raw,instant('07:50'));assert.equal(row.deltaMinutes,-19);
});
test('late start rounds up and continued work rounds down without a planned-end cap',()=>{
 const row=result(shift('p1'),shift('a1','08:07','16:24'));
 assert.deepEqual(times(row),['08:15','16:15']);assert.equal(row.proposal.netMinutes,480);assert.equal(flags(row,'einde_laat').length,1);
});
test('exact quarters remain unchanged',()=>{
 const row=result(shift('p1'),shift('a1','08:15','16:15'));
 assert.deepEqual(times(row),['08:15','16:15']);assert.equal(flags(row,'afronding').length,0);
});
test('an early start capped to a non-quarter plan is not rounded a second time',()=>{
 assert.equal(times(result(shift('p1','08:07'),shift('a1','07:50')))[0],'08:07');
});
test('an equal non-quarter planned start remains unchanged',()=>{
 assert.equal(times(result(shift('p1','08:07'),shift('a1','08:07')))[0],'08:07');
});
test('no planning preserves original start and requests review',()=>{
 const row=result(null,shift('a1','08:07','16:09'));
 assert.deepEqual(times(row),['08:07','16:00']);assert.equal(flags(row,'planning_ontbreekt').length,1);
});
test('exactly eight planned hours does not invoke the pause check',()=>{
 const row=result(shift('p1'),shift('a1'));
 assert.equal(row.proposal.breakMinutes,0);assert(!row.flags.some(flag=>flag.type.startsWith('pauze_')));assert.equal(row.status,'geen_melding');
});
test('strictly more than eight planned hours proposes thirty minutes when missing',()=>{
 const row=result(shift('p1','08:00','16:01'),shift('a1','08:00','16:01'));
 assert.equal(row.proposal.breakMinutes,30);assert.equal(flags(row,'pauze_ontbreekt').length,1);
});
test('pause trigger uses planned gross duration, not actual duration or planned net',()=>{
 const p=shift('p1','08:00','17:00',{BreakCodeHours:1});
 assert.equal(result(p,shift('a1','08:00','15:00')).proposal.breakMinutes,30);
 assert.equal(result(shift('p1'),shift('a1','08:00','17:00')).proposal.breakMinutes,0);
});
test('existing thirty-minute pause is retained and deducted exactly once',()=>{
 const row=result(shift('p1','08:00','17:00'),shift('a1','08:00','17:00',{BreakCodeHours:.5,ShiftHours:8.5,BreakCode:'P'}));
 assert.equal(row.originalNetMinutes,510);assert.equal(row.proposal.netMinutes,510);assert.equal(row.deltaMinutes,0);assert.equal(row.proposal.breakMinutes,30);assert(!row.flags.some(flag=>flag.type.startsWith('pauze_')));
});
test('a fifteen-minute registered pause is flagged but not increased',()=>{
 const row=result(shift('p1','08:00','17:00'),shift('a1','08:00','17:00',{BreakCodeHours:.25}));
 assert.equal(row.proposal.breakMinutes,15);assert.equal(flags(row,'pauze_kort').length,1);assert.equal(row.proposal.netMinutes,525);
});
test('explicit no-break exception retains zero and original comment',()=>{
 const a=shift('a1','08:00','17:00',{Comments:'  Geen pauze want druk.  '});const row=result(shift('p1','08:00','17:00'),a);
 assert.equal(row.proposal.breakMinutes,0);assert.equal(row.status,'uitzondering');assert.equal(row.actual.comments[0],'  Geen pauze want druk.  ');
});
test('no-break forms and Dutch compounds are recognized conservatively',()=>{
 for(const text of ['Pauze niet genomen','Zonder pauze doorgewerkt','Geen tijd gehad voor een pauze','Geen lunchpauze gehad'])assert.equal(rules.interpretBreakComment([text,null]),'explicit_no_break',text);
});
test('negations, doubt, registration notes and conflicting comments never cause automatic deduction',()=>{
 const examples=['Misschien geen pauze genomen','Geen pauze?','Niet geen pauze genomen','Het klopt niet dat ik geen pauze genomen heb','Ik heb niet zonder pauze gewerkt','Geen pauze genoteerd, wel pauze gehad','Geen pauze, maar later alsnog genomen','De opmerking geen pauze klopt niet','Geen pauze gepland','Pauze vergeten in te voeren','Wel pauze genomen'];
 for(const comment of examples){
  assert.equal(rules.interpretBreakComment([comment,null]),'uncertain',comment);
  const row=result(shift('p1','08:00','17:00'),shift('a1','08:00','17:00',{Comments:comment}));
  assert.equal(row.proposal.breakMinutes,0,comment);assert.equal(flags(row,'pauze_onduidelijk').length,1,comment);
 }
 assert.equal(rules.interpretBreakComment(['Geen pauze genomen','Wel 30 min pauze genomen']),'uncertain');
});
test('unavailable pause data is never assumed to mean zero',()=>{
 const row=result(shift('p1','08:00','17:00'),shift('a1','08:00','17:00',{BreakCodeHours:null}));
 assert.equal(row.proposal,null);assert(flags(row,'pauze_onduidelijk').length>0);assert.equal(row.originalNetMinutes,null);
});
test('shared employee references do not duplicate a shift across departments',()=>{
 const p=shift('p1');const a=shift('a1');const borrowed={...a,sourceDepartments:['department-b']};
 const rows=rules.buildHoursReview(dataset([p,{...p,sourceDepartments:['department-b']}],[a,borrowed]));
 assert.equal(rows.length,1);assert.equal(rows[0].actual.sourceDepartments.length,2);assert.equal(rows[0].actual.departmentId,'department-a');
});
test('same name with different employee IDs never matches or deduplicates',()=>{
 const p=shift('p1');const a=shift('a1','08:00','16:00',{EmployeeId:'employee-2'});
 const rows=rules.buildHoursReview(dataset([p],[a]));assert.equal(rows.length,2);assert.equal(rows.find(row=>row.actual).planned,null);
});
test('conflicting repeated shift IDs remain one flagged source, without a correction',()=>{
 const a=shift('a1');const rows=rules.buildHoursReview(dataset([shift('p1')],[a,{...shift('a1','08:07'),sourceDepartments:['department-b']} ]));
 assert.equal(rows.filter(row=>row.actual).length,1);assert.equal(rows.find(row=>row.actual).proposal,null);assert(flags(rows.find(row=>row.actual),'bron_onduidelijk').length);
});
test('adjacent multiple shifts on one day are paired separately without daily collapsing',()=>{
 const rows=rules.buildHoursReview(dataset([shift('p1','08:00','12:00'),shift('p2','12:00','16:00')],[shift('a1','08:00','12:00'),shift('a2','12:00','16:00')]));
 assert.equal(rows.length,2);assert(rows.every(row=>row.planned&&row.proposal));assert(!rows.some(row=>flags(row,'overlap').length));
});
test('ambiguous planning does not invent a start cap',()=>{
 const rows=rules.buildHoursReview(dataset([shift('p1','08:00','16:00'),shift('p2','08:15','16:00')],[shift('a1','07:50','16:00')]));const row=rows.find(row=>row.actual);
 assert.equal(row.planned,null);assert.equal(flags(row,'planning_onduidelijk').length,1);assert.equal(times(row)[0],'07:50');assert(!rows.filter(row=>!row.actual).some(row=>flags(row,'uren_ontbreken').length));
});
test('missing or invalid planning end cannot justify a start cap or pause',()=>{
 const row=result(shift('p1','08:00',null),shift('a1','07:50','17:00'));
 assert.equal(times(row)[0],'07:50');assert.equal(row.proposal.breakMinutes,0);assert.equal(flags(row,'planning_onduidelijk').length,1);
});
test('planned work with no actual registration is flagged, unless the actual source is unavailable',()=>{
 let rows=rules.buildHoursReview(dataset([shift('p1')],[]));assert.equal(flags(rows[0],'uren_ontbreken').length,1);assert.equal(rows[0].originalNetMinutes,null);
 rows=rules.buildHoursReview(dataset([shift('p1')],[],{coverage:{planned:['department-a'],actual:[]}}));assert.equal(flags(rows[0],'uren_ontbreken').length,0);assert.equal(flags(rows[0],'toegang').length,1);
});
test('future or ongoing planned shifts are not treated as missing worked hours',()=>{
 const rows=rules.buildHoursReview(dataset([shift('p1')],[],{generatedAt:'2026-10-05T09:00:00Z'}));assert.equal(rows[0].status,'nog_gepland');assert.equal(rows[0].flags.length,0);
});
test('missing end including Tamigo 1900 sentinel blocks a proposal',()=>{
 for(const end of [null,'1900-01-01T00:00:00','/Date(-2208988800000)/']){
  const row=result(shift('p1'),shift('a1','08:00',end));assert.equal(row.proposal,null);assert.equal(flags(row,'eindtijd_ontbreekt').length,1);
 }
});
test('overnight shifts keep their dates and elapsed duration',()=>{
 const row=result(shift('p1',instant('22:00'),instant('06:00','06')),shift('a1',instant('21:50'),instant('06:09','06')));
 assert.deepEqual(times(row),['22:00','06:00']);assert.equal(row.proposal.netMinutes,480);assert.equal(row.proposal.breakMinutes,0);assert.equal(time.localDate(Date.parse(row.proposal.end)),'2026-10-06');
});
test('month-boundary early start remains attached to the planned month',()=>{
 const row=rules.buildHoursReview(dataset([shift('p1','2026-10-01T00:00:00+02:00','2026-10-01T06:00:00+02:00')],[shift('a1','2026-09-30T23:50:00+02:00','2026-10-01T06:00:00+02:00')]))[0];
 assert.equal(row.date,'2026-10-01');assert.equal(row.proposal.netMinutes,360);
});
test('DST spring and fall durations use elapsed Amsterdam time, independent of the host timezone',()=>{
 for(const [month,day,startOffset,endOffset,expected] of [['2026-03','29','+01:00','+02:00',120],['2026-10','25','+02:00','+01:00',240]]){
  const p=shift('p1',`${month}-${day}T01:00:00${startOffset}`,`${month}-${day}T04:00:00${endOffset}`);
  const a=shift('a1',`${month}-${day}T01:07:00${startOffset}`,`${month}-${day}T04:24:00${endOffset}`);
  const row=rules.buildHoursReview(dataset([p],[a],{month}))[0];assert.equal(row.proposal.netMinutes,expected);assert.equal(row.proposal.breakMinutes,0);
 }
});
test('naive ambiguous autumn and nonexistent spring timestamps are held for review',()=>{
 assert.equal(time.parseTime('2026-10-25T02:30:00').issue,'ambiguous');assert.equal(time.parseTime('2026-03-29T02:15:00').issue,'nonexistent');
 const row=result(shift('p1','2026-10-25T01:00:00','2026-10-25T05:00:00'),shift('a1','2026-10-25T02:30:00','2026-10-25T05:00:00'));assert.equal(row.proposal,null);assert(flags(row,'bron_onduidelijk').length);
});
test('normal naive local and Microsoft timestamps keep correct instant including fractions',()=>{
 assert.equal(time.parseTime('2026-10-05T08:00:00.123').iso,'2026-10-05T06:00:00.123Z');
 const ms=Date.parse('2026-10-05T06:00:00Z');assert.equal(time.parseTime(`/Date(${ms}+0200)/`).ms,ms);
});
test('overlap is detected by employee ID across departments and midnight',()=>{
 const a=shift('a1',instant('22:00'),instant('02:00','06'));
 const b=shift('a2',instant('01:00','06'),instant('03:00','06'),{DepartmentId:'department-b',DepartmentName:'Andere locatie'});
 const rows=rules.buildHoursReview(dataset([], [a,b]));assert.equal(rows.length,2);assert(rows.every(row=>flags(row,'overlap').length===1));
});
test('absence, sickness and unknown activities do not become paid work corrections',()=>{
 for(const fields of [{IsProductive:false,ShiftActivityName:'Ziek'},{IsProductive:false,ShiftActivityName:'Verlof'},{IsProductive:false,ShiftActivityName:'Andere activiteit'},{IsProductive:undefined}]){
  const row=result(null,shift('a1','08:00','17:00',fields));assert.equal(row.proposal,null);assert.equal(flags(row,'activiteit').length,1);
 }
});
test('unlikely durations and invalid chronology are visible without silently moving dates',()=>{
 let row=result(null,shift('a1','08:00','08:30'));assert.equal(flags(row,'dienst_kort').length,1);assert(row.proposal);
 row=result(null,shift('a1','06:00','20:00'));assert.equal(flags(row,'dienst_lang').length,1);
 row=result(null,shift('a1','16:00','08:00'));assert.equal(row.proposal,null);assert(flags(row,'bron_onduidelijk').length);
});
test('rounding cannot invent negative or zero-length shifts',()=>{
 const row=result(shift('p1','08:00','09:00'),shift('a1','08:07','08:09'));assert.equal(row.proposal,null);assert(flags(row,'bron_onduidelijk').length);
});
test('an inconsistent Tamigo net total remains visible and blocks an invented correction',()=>{
 const row=result(shift('p1'),shift('a1','08:00','16:00',{ShiftHours:7}));assert.equal(row.originalNetMinutes,420);assert.equal(row.proposal,null);assert(flags(row,'bron_onduidelijk').length);
});
test('thresholds are validated, visible in proposals and can differ by actual department',()=>{
 const config=rules.validateConfig({...types.DEFAULT_REVIEW_CONFIG,departmentOverrides:{'department-a':{fullDayMinutes:600,shortMinutes:30}}});
 const row=result(shift('p1','08:00','17:00'),shift('a1','08:00','17:00'),config);assert.equal(row.proposal.breakMinutes,0);assert.equal(row.proposal.rules.fullDayMinutes,600);
 assert.throws(()=>rules.validateConfig({...types.DEFAULT_REVIEW_CONFIG,shortMinutes:800,longMinutes:700}));assert.throws(()=>rules.validateConfig({...types.DEFAULT_REVIEW_CONFIG,deviationMinutes:-1}));
});
test('all original fields remain unchanged and no-alert rows are never automatically approved',()=>{
 const data=dataset([shift('p1')],[shift('a1')]);const before=JSON.stringify(data);
 const rows=rules.buildHoursReview(data);assert.equal(JSON.stringify(data),before);assert.equal(rows[0].status,'geen_melding');assert.notEqual(rows[0].status,'approved');
});
test('rows with alerts sort before quiet rows; employee names are not used as keys',()=>{
 const p1=shift('p1', '08:00','16:00',{EmployeeId:'e1',EmployeeName:'Zelfde naam'}),p2=shift('p2','08:00','16:00',{EmployeeId:'e2',EmployeeName:'Zelfde naam'});
 const a1=shift('a1','08:00','16:00',{EmployeeId:'e1',EmployeeName:'Zelfde naam'}),a2=shift('a2','08:07','16:00',{EmployeeId:'e2',EmployeeName:'Zelfde naam'});
 const rows=rules.buildHoursReview(dataset([p1,p2],[a1,a2]));assert.equal(rows.length,2);assert.equal(rows[0].actual.employeeId,'e2');assert.equal(rows[1].status,'geen_melding');
});
test('malformed source shapes are not accepted as a successful empty API result',()=>{
 assert.equal(source.sourceRecords({Message:'no access'}),null);assert.equal(source.sourceRecords(['invalid']),null);assert.equal(source.sourceRecords([]).length,0);
});

function serverModule(overrides={}){
 const department='11111111-1111-1111-1111-111111111111';
 const raw={ShiftId:'a1',EmployeeId:'e1',EmployeeName:'Fictief',DepartmentId:department,DepartmentName:'Testwinkel',StartDateTime:'2026-10-05T08:00:00',EndDateTime:'2026-10-05T16:00:00',BreakCodeHours:0,ShiftHours:8,IsProductive:true,PlanStatusCodeId:3,Comments:'Geen bijzondere opmerking',Email:'private@example.invalid',HistoricalWages:[1234]};
 const calls=[];
 const api={
  getKnownTamigoHoursReviewDepartments:()=>[{id:department,name:'Testwinkel'}],getTamigoStatusCode:error=>error.status||500,
  fetchTamigoHoursReviewSource:async input=>{
   calls.push(input);
   if(overrides.read)return overrides.read(input,raw);
   if(input.kind==='departments')return [{DepartmentId:department,Name:'Testwinkel'}];
   if(input.kind==='breakcodes')return [{Code:'P',Hours:.5}];
   if(input.kind==='day-status')return [{Date:`${input.date}T00:00:00`,Open:true,Status:1}];
   return [{...raw,ShiftId:'p1',PlanStatusCodeId:2},raw,{...raw,PlanStatusCodeId:5},{...raw,ShiftId:'original',PlanStatusCodeId:4},{...raw,ShiftId:'attendance',PlanStatusCodeId:6}];
  }
 };
 return {server:loader({'../../tamigoApi':api})(base+'reviewServer.ts'),calls,department};
}
test('server combines department references, includes closed shift types and excludes original/clock copies',async()=>{
 const {server,calls}=serverModule();const data=await server.getTamigoHoursReviewMonth('2026-10');
 assert.equal(data.departments.length,1);assert.equal(data.actual.length,1);assert.equal(data.planned.length,1);assert(data.coverage.actual.length);
 assert(calls.filter(call=>call.kind==='departments').length===2);
 const json=JSON.stringify(data);assert(!json.includes('private@example.invalid'));assert(!json.includes('HistoricalWages'));
 assert(!data.actual.some(item=>item.id==='attendance'||item.id==='original'));
});
test('a distinct closed record is included and not confused with a managers approval',async()=>{
 const {server}=serverModule({read:(input,raw)=>input.kind==='departments'?[{DepartmentId:raw.DepartmentId,Name:'Testwinkel'}]:input.kind==='breakcodes'?[]:[{...raw,PlanStatusCodeId:5}]});
 const data=await server.getTamigoHoursReviewMonth('2026-10');assert.equal(data.actual.length,1);assert.equal(data.actual[0].planStatusCode,'5');assert.equal(data.actual[0].employeeApproved,null);assert(data.checks.some(check=>check.key==='approval'&&check.state==='unknown'));
});
test('failed and unknown API data remain explicit and cannot become missing-hours evidence',async()=>{
 const {server}=serverModule({read:(input,raw)=>{
  if(input.kind==='departments')return [{DepartmentId:raw.DepartmentId,Name:'Testwinkel'}];
  if(input.kind==='breakcodes')throw Object.assign(Error('Forbidden'),{status:403});
  throw Object.assign(Error('Forbidden'),{status:403});
 }});
 const data=await server.getTamigoHoursReviewMonth('2026-10');assert.equal(data.actual.length,0);assert.equal(data.coverage.actual.length,0);assert(data.checks.some(check=>check.state==='unavailable'&&check.httpStatus===403));
});
test('unknown status codes and truncated replies are explicitly partial, never complete',async()=>{
 const {server}=serverModule({read:(input,raw)=>input.kind==='departments'?[{DepartmentId:raw.DepartmentId,Name:'Testwinkel'}]:input.kind==='breakcodes'?[]:{Data:[{...raw,PlanStatusCodeId:999}],TotalCount:2}});
 const data=await server.getTamigoHoursReviewMonth('2026-10');assert.equal(data.coverage.actual.length,0);assert.equal(data.actual[0].kind,'unknown');assert(data.checks.some(check=>check.state==='partial'));
});
test('v2 day status selects the requested Amsterdam day, never the first period row',async()=>{
 const fixture=serverModule();assert.equal((await fixture.server.getTamigoHoursDayStatus(fixture.department,'2026-10-05')).state,'open');
 const rows=[{Date:'2026-10-06T00:00:00',Open:true,Status:1},{Date:'2026-10-05T00:00:00',Open:false,Status:2}];
 const {server,department}=serverModule({read:()=>rows});
 assert.equal((await server.getTamigoHoursDayStatus(department,'2026-10-05')).state,'closed');
 assert.equal((await server.getTamigoHoursDayStatus(department,'2026-10-07')).state,'unknown');
});
test('closed, signed-off and validated days remain closed; contradictory or malformed statuses never open a day',()=>{
 for(const status of [2,3,4])assert.equal(source.normalizeDayStatus([{Date:'2026-10-05T00:00:00',Open:false,Status:status}],'2026-10-05').state,'closed');
 const valid={Date:'2026-10-05T00:00:00',Open:true,Status:1};
 for(const rows of [[],null,{},[null],[{...valid,Open:'true'}],[{...valid,Status:'1'}],[{...valid,Status:2}],[{...valid,Open:false}],[{...valid,Status:99}],[{...valid,Date:null}],[valid,valid],[valid,{...valid,Open:false,Status:2}],{Success:true,Message:'false'}])assert.equal(source.normalizeDayStatus(rows,'2026-10-05').state,'unknown',JSON.stringify(rows));
});
test('day status handles explicit offsets and calendar dates around daylight-saving and month boundaries',()=>{
 assert.equal(source.normalizeDayStatus([{Date:'2026-10-24T22:00:00Z',Open:true,Status:1}],'2026-10-25').state,'open');
 assert.equal(source.normalizeDayStatus([{Date:'2026-10-25',Open:false,Status:2}],'2026-10-25').state,'closed');
 assert.equal(source.normalizeDayStatus([{Date:'2026-02-30T00:00:00',Open:true,Status:1}],'2026-02-30').state,'unknown');
 for(const [date,next]of [['2026-10-25','2026-10-26'],['2026-03-29','2026-03-30'],['2026-12-31','2027-01-01'],['2028-02-28','2028-02-29'],['2026-02-28','2026-03-01']])assert.equal(time.nextCalendarDate(date),next);
 for(const date of ['2026-02-30','2026-13-01','invalid'])assert.throws(()=>time.nextCalendarDate(date),/datum/);
});
test('day access errors distinguish request rejection from missing permissions without exposing upstream replies',async()=>{
 for(const status of [401,403]){
  const {server,department}=serverModule({read:()=>{throw Object.assign(Error('private token and personnel reply'),{status});}});
  const result=await server.getTamigoHoursDayStatus(department,'2026-10-05');
  assert.equal(result.state,'unknown');assert.equal(result.httpStatus,status);
  assert.match(result.message,/versie-2-dagstatus/);assert.match(result.message,/opslaan geblokkeerd/);
  assert.match(result.message,status===401?/aanvraagparameters/:/rechten/);
  assert(!JSON.stringify(result).includes('private token'));
 }
});
test('day access failure does not suggest incomplete shift data or missing worked hours',()=>{
 const {reviewAccessSummary}=load('app/management/urencontrole/reviewAccess.ts');
 const result=reviewAccessSummary([
  {key:'shifts-test',label:'Testwinkel',state:'available',message:'Diensten opgehaald'},
  {key:'day-status-access',label:'Dagstatus',state:'unavailable',httpStatus:401,message:'Toegang ontbreekt'},
 ]);
 assert.equal(result.incompleteSources.length,0);assert.equal(result.dayBlocked,true);
 assert.equal(result.notice.title,'Correcties nog geblokkeerd');assert.match(result.notice.message,/Rooster en uren zijn opgehaald/);
 assert(!result.notice.message.includes('Bronnen onvolledig'));
});
test('incomplete shift access remains explicit even if day access is also blocked',()=>{
 const {reviewAccessSummary}=load('app/management/urencontrole/reviewAccess.ts');
 const result=reviewAccessSummary([
  {key:'shifts-test',label:'Testwinkel',state:'partial',message:'Diensten onvolledig'},
  {key:'day-status-access',label:'Dagstatus',state:'unavailable',httpStatus:403,message:'Toegang ontbreekt'},
 ]);
 assert.equal(result.incompleteSources.length,1);assert.equal(result.dayBlocked,true);
 assert.equal(result.notice.title,'Bronnen onvolledig');assert.match(result.notice.message,/Testwinkel/);
 assert(!result.notice.message.includes('uren zijn opgehaald'));
});
test('unconfirmed approval is not an access failure; absent day probes do not imply write permission',()=>{
 const {reviewAccessSummary}=load('app/management/urencontrole/reviewAccess.ts');
 assert.equal(reviewAccessSummary([{key:'approval',label:'Goedkeuring',state:'unknown',message:'Niet bevestigd'}]).notice,null);
 assert.equal(reviewAccessSummary([]).notice,null);
 assert.equal(reviewAccessSummary([{key:'day-status-access',label:'Dagstatus',state:'available',message:'Steekproef beschikbaar'}]).notice,null);
 const unknown=reviewAccessSummary([{key:'day-status-access',label:'Dagstatus',state:'unknown',message:'Onbekend antwoord'}]);
 assert.equal(unknown.dayBlocked,true);assert.match(unknown.notice.message,/nog niet bevestigd/);
});
const access=load('app/lib/auth/access.ts');
function apiRoute(profile){
 const calls=[];
 const route=loader({'@/app/lib/auth/session':{getCurrentProfile:async()=>profile},'@/app/lib/auth/access':access,'@/app/management/urencontrole/reviewServer':{getTamigoHoursReviewMonth:async month=>{calls.push(month);return {month,actual:[]};},getTamigoHoursDayStatus:async()=>{calls.push('status');return {state:'unknown'};}}})('app/api/tamigo-hours-review/route.ts');
 return {route,calls};
}
test('API denies non-managers before reading any employee data and exposes no write methods',async()=>{
 for(const profile of [null,{active:false,role:'admin'},{active:true,role:'winkel',permissions:{'management.view':true}},{active:true,role:'bakkerij',permissions:{'app.all':true}}]){
  const {route,calls}=apiRoute(profile);const response=await route.GET(new Request('https://example.test/api/tamigo-hours-review?month=2026-10'));
  assert.equal(response.status,403);assert.equal(calls.length,0);assert.match(response.headers.get('Cache-Control'),/no-store/);
  for(const method of ['POST','PATCH','PUT','DELETE'])assert.equal(route[method],undefined);
 }
});
test('manager read API validates month and date inputs and prevents shared caching',async()=>{
 const {route,calls}=apiRoute({active:true,role:'manager'});
 for(const query of ['month=2026-13','month=2026-02-01','mode=day-status&department=x&date=2026-10-05','mode=day-status&department=11111111-1111-1111-1111-111111111111&date=2026-02-30'])assert.equal((await route.GET(new Request('https://example.test/api/tamigo-hours-review?'+query))).status,400);
 assert.equal(calls.length,0);
 const response=await route.GET(new Request('https://example.test/api/tamigo-hours-review?month=2026-10'));assert.equal(response.status,200);assert.match(response.headers.get('Cache-Control'),/private, no-store/);assert.equal(calls[0],'2026-10');
});
test('zero-duration absence is kept separate from typo warnings for work',()=>{
 const a=shift('a1','08:00','08:00',{IsProductive:false,ShiftActivityName:'Ziek'});assert.equal(a.issues.length,0);assert.equal(result(null,a).status,'niet_werk');
});
test('impossible ISO dates and oversized Microsoft timestamps cannot crash or silently move a service',()=>{
 assert.equal(time.parseTime('2026-02-30T08:00:00+01:00').issue,'invalid');assert.equal(time.parseTime('/Date(9999999999999999999999)/').issue,'invalid');
});
test('a declared API failure is not treated as an empty successful dataset',()=>{
 assert.equal(source.sourceRecords({Success:false,Data:[]}),null);
});
test('malformed records inside an API envelope cannot silently imply a complete month',()=>{
 assert.equal(source.sourceRecords({Data:[{ShiftId:'a1'},null]}),null);
});
test('an invalid fallback date keeps an undated registration visible for review',()=>{
 const actual=source.normalizeReviewShift({ShiftId:'a1',EmployeeId:'e1',DepartmentId:'d1',IsProductive:true,Date:'2026-10-99',StartDateTime:null,EndDateTime:null},'d1',0);
 assert.equal(actual.date,'');assert.equal(result(null,actual).status,'te_beoordelen');
});
test('conflicting source versions are preserved for inspection',()=>{
 const sources=source.dedupeReviewShifts([shift('a1'),shift('a1','08:07')]);assert.equal(sources.length,1);assert.equal(sources[0].alternatives.length,1);assert.equal(sources[0].alternatives[0].start.raw,instant('08:07'));
});
test('the new Tamigo source adapter only uses GET and never calls a wage or mutation endpoint',async()=>{
 const calls=[];
 const api=loader({}, {process:{env:{TAMIGO_API_KEY:'test-token'}},fetch:async(url,options)=>{calls.push({url:String(url),method:options.method,headers:options.headers,body:options.body});return Response.json([]);}})('app/tamigoApi.ts');
 for(const input of [{kind:'departments',includeParents:true},{kind:'breakcodes'},{kind:'shifts',departmentId:'d1',from:'2026-10-01',to:'2026-11-01'},{kind:'day-status',departmentId:'d1',date:'2026-10-05'}])await api.fetchTamigoHoursReviewSource(input);
 assert.equal(calls.length,4);assert(calls.every(call=>call.method==='GET'));assert(calls.every(call=>!/(?:close\/day|open\/day|employee|payroll|wage|export)/i.test(call.url)));
 assert(!calls.find(call=>call.url.includes('/v2/Shifts/')).url.includes('shiftStatus='));
 const day=calls.find(call=>call.url.includes('/ActualShifts/'));
 assert.equal(new URL(day.url).pathname,'/v2/ActualShifts/status/period/2026-10-05/2026-10-06/');
 assert.equal(new URL(day.url).searchParams.get('departmentId'),'d1');
 assert.equal(day.headers['Content-Type'],'application/json');assert.equal(day.body,undefined);
 assert(calls.some(call=>call.url.includes('/v2/Departments/application/')));
});

const presentation=load(base+'reviewPresentation.ts');
const demo=load(base+'demo.ts');
test('the review opens on work alerts only; other registrations remain available without approval',()=>{
 const rows=rules.buildHoursReview(demo.createHoursReviewDemo('2026-10'),types.DEFAULT_REVIEW_CONFIG);
 const before=JSON.stringify(rows);
 const selection=presentation.selectReviewRows(rows);
 assert.equal(presentation.DEFAULT_REVIEW_VIEW,'attention');
 assert.equal(selection.rows.length,8);
 assert(selection.rows.every(row=>row.flags.length&&row.status!=='niet_werk'));
 const noFlags=presentation.selectReviewRows(rows,{view:'no_flags'});
 assert.equal(noFlags.rows.length,2);assert(noFlags.rows.every(row=>row.status==='geen_melding'));
 assert.equal(presentation.selectReviewRows(rows,{view:'all'}).rows.length,10);
 assert.equal(presentation.selectReviewRows(rows,{view:'all',showNonWork:true}).rows.length,11);
 assert.equal(JSON.stringify(rows),before);
});
test('blocking missing data is placed before routine rounding, and every explanation is retained',()=>{
 const rows=rules.buildHoursReview(demo.createHoursReviewDemo('2026-10'),types.DEFAULT_REVIEW_CONFIG);
 const selected=presentation.selectReviewRows(rows).rows;
 assert.equal(presentation.focusFlags(selected[0])[0].type,'eindtijd_ontbreekt');
 const early=selected.find(row=>row.actual?.id==='a1');
 assert.equal(presentation.focusFlags(early)[0].type,'pauze_ontbreekt');
 assert.equal(presentation.focusFlags(early).length,early.flags.length);
 assert.equal(early.actual.start.raw,'2026-10-05T07:50:00');
 const exception=selected.find(row=>row.actual?.id==='a2');
 assert.equal(exception.actual.comments[0],'Geen pauze want druk');
 assert.equal(exception.proposal.breakMinutes,0);assert.equal(exception.status,'uitzondering');
});
test('department, employee and alert filters combine using IDs and counts follow the selected location',()=>{
 const rows=rules.buildHoursReview(demo.createHoursReviewDemo('2026-10'),types.DEFAULT_REVIEW_CONFIG);
 const other='22222222-2222-2222-2222-222222222222';
 const selection=presentation.selectReviewRows(rows,{department:other});
 assert.equal(selection.counts.all,2);assert(selection.rows.some(row=>row.actual.id==='a8'));
 assert.equal(presentation.selectReviewRows(rows,{employee:'demo-2',flagType:'pauze_uitzondering'}).rows[0].actual.id,'a2');
 assert.equal(presentation.selectReviewRows(rows,{department:other,employee:'demo-2'}).rows.length,0);
 assert.deepEqual(Array.from(presentation.selectReviewRows(rows,{flagType:'pauze_ontbreekt'}).rows,row=>row.actual.id),['a6','a1']);
});

test('missing actual hours show the unchanged planned service without inventing actual hours or a delta',()=>{
 const p=shift('p-original','08:07','17:43',{BreakCodeHours:.5});
 const before=JSON.stringify(p);const row=rules.buildHoursReview(dataset([p],[]))[0];
 assert.deepEqual(times(row),['08:07','17:43']);assert.equal(row.proposal.breakMinutes,30);assert.equal(row.proposal.netMinutes,546);
 assert.equal(row.proposal.basis,'planning');assert.equal(row.actual,null);assert.equal(row.originalNetMinutes,null);assert.equal(row.deltaMinutes,null);
 assert.equal(flags(row,'uren_ontbreken').length,1);assert.equal(JSON.stringify(p),before);
 const future=rules.buildHoursReview(dataset([p],[],{generatedAt:'2026-10-01T00:00:00Z'}))[0];
 assert.equal(future.status,'nog_gepland');assert.equal(future.proposal.basis,'planning');
 const unknownPause=rules.buildHoursReview(dataset([shift('p-unknown','08:00','17:00',{BreakCodeHours:null})],[]))[0];
 assert.equal(unknownPause.proposal,null);
});

test('unassigned services have their own view and never inflate employee attention counts',()=>{
 const known=shift('p-known');
 const open=shift('p-open','08:00','16:00',{EmployeeId:'00000000-0000-0000-0000-000000000000',EmployeeName:null});
 const unnamed=shift('p-unnamed','08:00','16:00',{EmployeeId:'employee-2',EmployeeName:'  '});
 const rows=rules.buildHoursReview(dataset([known,open,unnamed],[]));
 const normal=presentation.selectReviewRows(rows);
 assert.equal(normal.rows.length,1);assert.equal(normal.counts.all,1);assert.equal(normal.counts.unassigned,2);
 const separate=presentation.selectReviewRows(rows,{view:'unassigned'});
 assert.equal(separate.rows.length,2);assert(separate.rows.every(row=>presentation.missingReviewEmployee(row.planned)));
 assert.equal(presentation.selectReviewRows(rows,{view:'unassigned',employee:'employee-2'}).rows.length,1);
});

test('Wijchen and the Winkels parent are hidden from selections, other departments and source data stay intact',()=>{
 const rows=rules.buildHoursReview(dataset([], [shift('a-wijchen','08:00','16:00',{DepartmentName:'Winkel - Wijchen'}),shift('a-parent','08:00','16:00',{EmployeeId:'employee-2',DepartmentName:'Winkels'}),shift('a-visible','08:00','16:00',{EmployeeId:'employee-3',DepartmentName:'Winkel - Daalseweg'})]));
 const snapshot=JSON.stringify(rows);const selection=presentation.selectReviewRows(rows,{view:'all'});
 assert.equal(selection.rows.length,1);assert.equal(selection.rows[0].actual.id,'a-visible');assert.equal(selection.counts.all,1);
 assert.equal(presentation.visibleReviewDepartment(' Winkel – Wijchen '),false);assert.equal(presentation.visibleReviewDepartment('Strik Patisserie'),true);
 assert.equal(JSON.stringify(rows),snapshot);
});

test('overlap names the other service, interval and duplicate possibility; touching services are not overlaps',()=>{
 const a=shift('a-one','08:00','12:00');const b=shift('a-two','11:00','13:00',{DepartmentId:'department-b',DepartmentName:'Winkel B'});
 const row=rules.buildHoursReview(dataset([], [a,b])).find(row=>row.actual.id==='a-one');
 assert.equal(row.overlaps[0].shift.id,'a-two');assert.equal(row.overlaps[0].minutes,60);assert.equal(row.overlaps[0].duplicate,false);assert.match(flags(row,'overlap')[0].message,/1u 00 tegelijk/);assert.match(flags(row,'overlap')[0].message,/Winkel B/);assert.match(flags(row,'overlap')[0].message,/niet de planning/);
 const duplicate=rules.buildHoursReview(dataset([], [a,shift('a-copy','08:00','12:00',{DepartmentId:'department-b'})]));
 assert(duplicate.every(row=>flags(row,'overlap')[0].message.includes('mogelijk een dubbele registratie')));
 const touching=rules.buildHoursReview(dataset([], [a,shift('a-next','12:00','16:00')]));
 assert(touching.every(row=>!flags(row,'overlap').length));
 const open=rules.buildHoursReview(dataset([], [shift('a-open-1','08:00','12:00',{EmployeeId:'00000000-0000-0000-0000-000000000000'}),shift('a-open-2','09:00','13:00',{EmployeeId:'00000000-0000-0000-0000-000000000000'})]));
 assert(open.every(row=>!flags(row,'overlap').length));
 const deduped=rules.buildHoursReview(dataset([], [a,{...a,sourceDepartments:['department-b']}]));
 assert.equal(deduped.length,1);assert.equal(flags(deduped[0],'overlap').length,0);
});

test('payroll October covers September 26 through October 25 with one-day read margins',()=>{
 const b=time.reviewPeriodBounds('2026-10','payroll');
 assert.equal(b.from,'2026-09-26');assert.equal(b.to,'2026-10-26');assert.equal(b.fetchFrom,'2026-09-25');assert.equal(b.fetchTo,'2026-10-27');
 const jan=time.reviewPeriodBounds('2026-01','payroll');assert.equal(jan.from,'2025-12-26');assert.equal(jan.to,'2026-01-26');
 const march=time.reviewPeriodBounds('2028-03','payroll');assert.equal(march.from,'2028-02-26');assert.equal(march.to,'2028-03-26');
 assert.equal(time.reviewPeriodBounds('2026-10','calendar').from,'2026-10-01');assert.equal(time.reviewPeriodBounds('2026-10','calendar').to,'2026-11-01');
 assert.throws(()=>time.reviewPeriodBounds('2026-13','payroll'));assert.throws(()=>time.reviewPeriodBounds('2026-10','other'));
 const make=(id,date)=>shift(id,`${date}T08:00:00+02:00`,`${date}T16:00:00+02:00`,{EmployeeId:id});
 const data=dataset([], [make('a-before','2026-09-25'),make('a-first','2026-09-26'),make('a-last','2026-10-25'),make('a-after','2026-10-26')],{period:'payroll'});
 assert.deepEqual(Array.from(rules.buildHoursReview(data),row=>row.actual.id),['a-first','a-last']);
 assert.deepEqual(Array.from(rules.buildHoursReview({...data,period:'calendar'}),row=>row.actual.id),['a-last','a-after']);
});

test('server fetches the full payroll range instead of fetching only the selected calendar month',async()=>{
 const {server,calls}=serverModule();const data=await server.getTamigoHoursReviewMonth('2026-10','payroll');
 assert.equal(data.period,'payroll');const request=calls.find(call=>call.kind==='shifts');
 assert.equal(request.from,'2026-09-25');assert.equal(request.to,'2026-10-27');
});

test('read API rejects unsupported period modes before calling Tamigo',async()=>{
 const {route,calls}=apiRoute({active:true,role:'manager'});
 const response=await route.GET(new Request('https://example.test/api/tamigo-hours-review?month=2026-10&period=other'));
 assert.equal(response.status,400);assert.equal(calls.length,0);
});
