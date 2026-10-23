const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
function loader(mocks={},globals={}){
 const cache=new Map();
 function load(file){
  file=path.resolve(file);if(cache.has(file))return cache.get(file);
  const exports={};cache.set(file,exports);
  const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  vm.runInNewContext(code,{exports,require:name=>{
   if(Object.hasOwn(mocks,name))return mocks[name];if(name==='server-only')return {};
   if(name.startsWith('.')||name.startsWith('@/')){const target=name.startsWith('@/')?path.resolve(name.slice(2)):path.resolve(path.dirname(file),name);return load([target,target+'.ts',target+'.tsx'].find(p=>fs.existsSync(p)&&fs.statSync(p).isFile()));}
   return require(name);
  },URL,Response,Request,TextEncoder,Date,Intl,Map,Set,AbortSignal,structuredClone,process,...globals});
  return exports;
 }
 return load;
}
const base='app/management/urencontrole/',load=loader();
const rules=load(base+'correctionRules.ts'),types=load(base+'reviewTypes.ts'),source=load(base+'reviewSource.ts');
const {correctionRevision}=load(base+'correctionRevision.ts');
const {createCorrectionService}=load(base+'correctionServer.ts');
const employee='11111111-1111-4111-8111-111111111111',department='22222222-2222-4222-8222-222222222222',shiftId='33333333-3333-4333-8333-333333333333',actor='44444444-4444-4444-8444-444444444444',intentId='55555555-5555-4555-8555-555555555555';
const clock='2026-11-02T12:00:00Z';
const rawShift=(extra={})=>({ShiftId:shiftId,EmployeeId:employee,EmployeeName:'Fictieve collega',DepartmentId:department,DepartmentName:'Testwinkel',StartDateTime:'2026-10-05T07:50:00+02:00',EndDateTime:'2026-10-05T17:09:00+02:00',BreakCode:'',BreakCodeHours:0,ShiftHours:559/60,Comments:'  Oorspronkelijke notitie  ',Comments2:null,IsProductive:true,PlanStatusCodeId:3,IsAvailable:false,IsExchange:false,ShiftActivityId:null,ShiftActivities:[],Tasks:[],...extra});
const rawBreaks=[{Code:'1',Hours:.25,MinimumHours:6,Disabled:false,OverridenByWageRateTypeConfig:false,SubBreakConfigs:[]},{Code:'2',Hours:.5,MinimumHours:8,Disabled:false,OverridenByWageRateTypeConfig:false,SubBreakConfigs:[]}];
const options=rules.breakOptions(rawBreaks);
function normalized(raw){const item=source.normalizeReviewShift(raw,department,0);item.sourceRevision=correctionRevision(raw);return item;}
function fixture(settings={}){
 let raw=rawShift(settings.raw),enabled=true,storeReady=true;
 const attempts=[],records=new Map(),transitions=[];
 const planned=normalized(rawShift({ShiftId:'66666666-6666-4666-8666-666666666666',StartDateTime:'2026-10-05T08:00:00+02:00',EndDateTime:'2026-10-05T17:00:00+02:00',ShiftHours:9,Comments:'',PlanStatusCodeId:2}));
 const getContext=()=>{const before=normalized(raw);return {raw:structuredClone(raw),before,options,dataset:{month:'2026-10',generatedAt:clock,sourceVersion:'test',departments:[{id:department,name:'Testwinkel'}],actual:[before,...(settings.others||[])],planned:[planned],coverage:{actual:[department],planned:[department]},checks:[]},complete:settings.complete!==false};};
 const reference={shiftId,departmentId:department,date:'2026-10-05',reviewMonth:'2026-10',revision:normalized(raw).sourceRevision};
 const store={
  ready:async()=>storeReady,
  create:async r=>{if(settings.archiveFails)throw Error('archive unavailable');const saved=structuredClone(r);if(settings.jsonbOrder)saved.payload=Object.fromEntries(Object.entries(saved.payload).reverse());records.set(r.id,saved);transitions.push('prepared');},
  get:async id=>structuredClone(records.get(id)||null),
  claim:async(id,who)=>{const r=records.get(id);if(!r||r.actorId!==who)throw Error('wrong actor');if(r.state!=='prepared')return {record:structuredClone(r),acquired:false};if([...records.values()].some(x=>x.reference.shiftId===r.reference.shiftId&&['applying','unknown'].includes(x.state)))throw Error('already locked');r.state='applying';transitions.push('applying');return {record:structuredClone(r),acquired:true};},
  finish:async(id,state,message,observed,expectedState='applying',checkedBy)=>{const r=records.get(id);assert.equal(r.state,expectedState);r.checkedBy=checkedBy;r.state=state;r.message=message;r.observed=observed;transitions.push(state);},
  history:async()=>[],
 };
 const deps={read:async ref=>{if(ref.revision==='verify'&&settings.verifyFails)throw Error('read failed');return getContext();},day:async(_,date)=>({state:settings.closedDate===date?'closed':settings.dayState||'open',httpStatus:settings.dayState==='unknown'?401:undefined,message:'test',employeeApprovalIsNotManagerApproval:true}),store,enabled:()=>enabled,now:()=>Date.parse(clock),id:()=>intentId,write:async payload=>{
  attempts.push(structuredClone(payload));if(settings.timeout)throw Error('timeout');
  if(settings.responseFalse)return {Success:false,Message:'private upstream text'};
  if(!settings.ignoreWrite){const ms=value=>Number(value.match(/Date\((-?\d+)(?:[+-]\d{4})?\)/)[1]);const option=options.find(x=>x.code===payload.BreakCode);raw={...raw,StartDateTime:new Date(ms(payload.StartTime)).toISOString(),EndDateTime:new Date(ms(payload.EndTime)).toISOString(),BreakCode:payload.BreakCode,BreakCodeHours:option.minutes/60,ShiftHours:(ms(payload.EndTime)-ms(payload.StartTime))/3600000-option.minutes/60};}
  if(settings.commentLoss)raw.Comments='';if(settings.timeoutAfterWrite)throw Error('timeout after processing');
  return settings.malformedResponse?null:{Success:true};
 }};
 const service=createCorrectionService(deps);
 return {service,reference,attempts,records,transitions,getContext,setRaw:extra=>{raw={...raw,...extra};},disable:()=>{enabled=false;},noStore:()=>{storeReady=false;},deps};
}
const draft=(extra={})=>({start:'2026-10-05T08:00',end:'2026-10-05T17:00',breakCode:'2',reason:'Afronding en pauze gecontroleerd',mode:'manual',...extra});

test('preparation archives the immutable original and never writes to Tamigo',async()=>{
 const f=fixture(),original=JSON.stringify(f.getContext().before);
 const preview=await f.service.prepare(actor,f.reference,draft(),types.DEFAULT_REVIEW_CONFIG);
 assert.equal(preview.id,intentId);assert.equal(preview.after.netMinutes,510);assert.equal(preview.deltaMinutes,-49);assert.equal(f.attempts.length,0);
 assert.equal(JSON.stringify(f.records.get(intentId).before),original);assert.equal(f.records.get(intentId).before.comments[0],'  Oorspronkelijke notitie  ');
});
test('confirmation updates exactly one actual shift and only reports success after readback',async()=>{
 const f=fixture();await f.service.prepare(actor,f.reference,draft(),types.DEFAULT_REVIEW_CONFIG);
 const result=await f.service.commit(actor,intentId,true);
 assert.equal(result.state,'applied');assert.equal(f.attempts.length,1);assert.equal(f.attempts[0].ShiftId,shiftId);assert.equal(f.attempts[0].EmployeeId,employee);
 assert.equal(f.attempts[0].Comment,'  Oorspronkelijke notitie  ');assert.equal(f.attempts[0].BreakCode,'2');
 assert(!Object.hasOwn(f.attempts[0],'ShiftHours'));assert(!Object.hasOwn(f.attempts[0],'DepartmentId'));
 assert.deepEqual(f.transitions,['prepared','applying','applied']);assert.equal(f.records.get(intentId).before.start.raw,'2026-10-05T07:50:00+02:00');
});
test('double clicks, concurrent requests and later retries submit only once',async()=>{
 const f=fixture();await f.service.prepare(actor,f.reference,draft(),types.DEFAULT_REVIEW_CONFIG);
 await Promise.all([f.service.commit(actor,intentId,true),f.service.commit(actor,intentId,true)]);
 await f.service.commit(actor,intentId,true);assert.equal(f.attempts.length,1);
});
test('only the preparing manager can confirm; explicit confirmation and expiry are enforced',async()=>{
 const f=fixture();await f.service.prepare(actor,f.reference,draft(),types.DEFAULT_REVIEW_CONFIG);
 await assert.rejects(()=>f.service.commit(employee,intentId,true),/controlesessie/);
 await assert.rejects(()=>f.service.commit(actor,intentId,false),/Bevestig/);
 f.records.get(intentId).expiresAt='2026-01-01T00:00:00Z';await assert.rejects(()=>f.service.commit(actor,intentId,true),/verlopen/);assert.equal(f.attempts.length,0);
});
test('missing day access, closed days, disabled writes and missing archive all block preparation',async()=>{
 for(const settings of [{dayState:'unknown'},{dayState:'closed'},{complete:false}]){const f=fixture(settings);const result=await f.service.prepare(actor,f.reference,draft(),types.DEFAULT_REVIEW_CONFIG);assert.equal(result.id,null);assert(result.blockers.length);assert.equal(f.attempts.length,0);}
 for(const setting of ['disable','noStore']){const f=fixture();f[setting]();const result=await f.service.prepare(actor,f.reference,draft(),types.DEFAULT_REVIEW_CONFIG);assert.equal(result.id,null);assert(result.blockers.length);}
});
test('archive failure prevents all writes',async()=>{
 const f=fixture({archiveFails:true});await assert.rejects(()=>f.service.prepare(actor,f.reference,draft(),types.DEFAULT_REVIEW_CONFIG));assert.equal(f.attempts.length,0);
});
test('source changes between preview and confirmation stop the correction without writing',async()=>{
 const f=fixture();await f.service.prepare(actor,f.reference,draft(),types.DEFAULT_REVIEW_CONFIG);f.setRaw({Comments:'Later aangepast in Tamigo'});
 const result=await f.service.commit(actor,intentId,true);assert.equal(result.state,'rejected');assert.equal(f.attempts.length,0);
});
test('a day closed after preparation is rechecked before writing',async()=>{
 const f=fixture();await f.service.prepare(actor,f.reference,draft(),types.DEFAULT_REVIEW_CONFIG);f.deps.day=async()=>({state:'closed'});
 assert.equal((await f.service.commit(actor,intentId,true)).state,'rejected');assert.equal(f.attempts.length,0);
});
test('a timeout is uncertain and cannot trigger an automatic resend',async()=>{
 const f=fixture({timeout:true});await f.service.prepare(actor,f.reference,draft(),types.DEFAULT_REVIEW_CONFIG);
 assert.equal((await f.service.commit(actor,intentId,true)).state,'unknown');await f.service.commit(actor,intentId,true);assert.equal(f.attempts.length,1);
});
test('HTTP 200, unreadable replies, missing readback and unexpected comment loss are not success',async()=>{
 for(const settings of [{ignoreWrite:true},{malformedResponse:true},{verifyFails:true},{commentLoss:true}]){const f=fixture(settings);await f.service.prepare(actor,f.reference,draft(),types.DEFAULT_REVIEW_CONFIG);const result=await f.service.commit(actor,intentId,true);assert.equal(result.state,'unknown');assert.equal(f.attempts.length,1);}
});
test('an explicit rejection is only released after the unchanged source is read back',async()=>{
 const f=fixture({responseFalse:true});await f.service.prepare(actor,f.reference,draft(),types.DEFAULT_REVIEW_CONFIG);const result=await f.service.commit(actor,intentId,true);assert.equal(result.state,'rejected');assert(!result.message.includes('private upstream'));
});
test('server recomputes proposals instead of trusting amounts supplied by the browser',async()=>{
 const f=fixture();const preview=await f.service.prepare(actor,f.reference,draft({mode:'proposal'}),types.DEFAULT_REVIEW_CONFIG);assert.equal(preview.id,intentId);assert.equal(f.records.get(intentId).rules.fullDayMinutes,480);
 const changed=fixture();await assert.rejects(()=>changed.service.prepare(actor,changed.reference,draft({mode:'proposal',end:'2026-10-05T16:00'}),types.DEFAULT_REVIEW_CONFIG),/voorstel/);
});
test('explicit no-break comments remain unchanged and a proposal retains zero pause',async()=>{
 const f=fixture({raw:{Comments:'Geen pauze want druk'}});
 const result=await f.service.prepare(actor,f.reference,draft({mode:'proposal',breakCode:''}),types.DEFAULT_REVIEW_CONFIG);
 assert.equal(result.after.breakMinutes,0);assert.equal(result.before.comments[0],'Geen pauze want druk');
});
test('extra comments, activities, absence, closed source and unknown fields cannot be silently lost',async()=>{
 for(const raw of [{Comments2:'Extra notitie'},{ShiftActivities:[{id:'test'}]},{Tasks:[{}]},{CompetencyId:employee},{IsProductive:false,ShiftActivityName:'Ziek'},{PlanStatusCodeId:5},{IsExchange:undefined}]){
  const f=fixture({raw});const result=await f.service.prepare(actor,f.reference,draft(),types.DEFAULT_REVIEW_CONFIG);assert.equal(result.id,null);assert(result.blockers.length);
 }
});
test('overlap across locations and incomplete neighbouring shifts block a correction',async()=>{
 for(const other of [normalized(rawShift({ShiftId:employee,DepartmentId:actor,StartDateTime:'2026-10-05T16:30:00+02:00',EndDateTime:'2026-10-05T18:00:00+02:00'})),normalized(rawShift({ShiftId:employee,EndDateTime:null}))]){
  const f=fixture({others:[other]});const result=await f.service.prepare(actor,f.reference,draft(),types.DEFAULT_REVIEW_CONFIG);assert.equal(result.id,null);assert(result.blockers.some(x=>/overlap|andere dienst/.test(x)));
 }
});
test('overnight edits keep both dates and check both open timesheet days',async()=>{
 const f=fixture({raw:{StartDateTime:'2026-10-05T22:00:00+02:00',EndDateTime:'2026-10-06T06:12:00+02:00',ShiftHours:8.2},closedDate:'2026-10-06'});
 const preview=await f.service.prepare(actor,f.reference,draft({start:'2026-10-05T22:00',end:'2026-10-06T06:00',breakCode:''}),types.DEFAULT_REVIEW_CONFIG);
 assert.equal(preview.after.netMinutes,480);assert.equal(preview.id,null);assert(preview.blockers.some(x=>x.includes('2026-10-06')));
});
test('manual missing-end correction keeps the unknown original end and original net',async()=>{
 const f=fixture({raw:{EndDateTime:null,ShiftHours:null}});const result=await f.service.prepare(actor,f.reference,draft(),types.DEFAULT_REVIEW_CONFIG);assert.equal(result.before.end.iso,null);assert.equal(result.originalNetMinutes,null);assert.equal(result.after.netMinutes,510);
});
test('pause codes obey Tamigo thresholds and are deducted exactly once',()=>{
 const before=normalized(rawShift());assert.equal(rules.correctionValues(draft(),before,options).netMinutes,510);
 assert.throws(()=>rules.correctionValues(draft({end:'2026-10-05T15:00'}),before,options),/pauzecode/);
 assert.throws(()=>rules.correctionValues(draft({breakCode:'made-up'}),before,options),/pauzecode/);
 const unsafe=rules.breakOptions([{...rawBreaks[0],SubBreakConfigs:[{}]},{...rawBreaks[1],OverridenByWageRateTypeConfig:true}]);assert.equal(unsafe.length,1);
});
test('manual date errors, backwards times, other dates and ambiguous wintertime are rejected',()=>{
 const before=normalized(rawShift());for(const d of [{start:'2026-10-04T08:00'},{end:'2026-10-05T07:00'},{end:'2026-10-07T08:00'},{start:'2026-02-30T08:00'}])assert.throws(()=>rules.correctionValues(draft(d),before,options));
 const winter=normalized(rawShift({StartDateTime:'2026-10-25T00:00:00+02:00',EndDateTime:'2026-10-25T04:00:00+01:00'}));assert.throws(()=>rules.correctionValues(draft({start:'2026-10-25T02:15',end:'2026-10-25T04:00',breakCode:''}),winter,options),/dubbelzinnig/);
 const spring=normalized(rawShift({StartDateTime:'2026-03-29T00:00:00+01:00',EndDateTime:'2026-03-29T08:00:00+02:00'}));assert.equal(rules.correctionValues(draft({start:'2026-03-29T00:00',end:'2026-03-29T08:00',breakCode:''}),spring,options).netMinutes,420);
});
test('reference revisions cover operational changes, not employee names or payroll fields',()=>{
 const raw=rawShift();assert.equal(correctionRevision(raw),correctionRevision({...raw,EmployeeName:'Andere schrijfwijze',WageSystemKey:'not-for-the-app'}));assert.notEqual(correctionRevision(raw),correctionRevision({...raw,IsExchange:true}));assert.notEqual(correctionRevision(raw),correctionRevision({...raw,Comments2:'extra'}));
 assert.throws(()=>rules.correctionReference({shiftId:'name'}));assert.throws(()=>rules.correctionDraft(draft({reason:' '})));
});
function routeFixture(profile){
 const calls=[];
 const route=loader({'@/app/lib/auth/session':{getCurrentProfile:async()=>profile},'@/app/lib/auth/access':load('app/lib/auth/access.ts'),'@/app/tamigoApi':{tamigoHoursWritesEnabled:()=>false,fetchTamigoHoursReviewSource:async()=>{calls.push('read');return rawBreaks;}},'@/app/management/urencontrole/correctionServer':{corrections:{prepare:async()=>{calls.push('prepare');return {};},commit:async()=>{calls.push('commit');return {};}}},'@/app/management/urencontrole/correctionStorage':{correctionStore:{ready:async()=>false,history:async()=>[]}}})('app/api/tamigo-hours-review/corrections/route.ts');
 return {route,calls};
}
const request=(body,extra={})=>new Request('https://example.test/api/tamigo-hours-review/corrections',{method:'POST',headers:{origin:'https://example.test','Content-Type':'application/json',...extra},body:JSON.stringify(body)});
test('correction API denies staff and inactive managers before reading or writing personnel data',async()=>{
 for(const profile of [null,{active:false,role:'admin'},{active:true,role:'winkel',permissions:{'app.all':true}},{active:true,role:'bakkerij',permissions:{'management.view':true}}]){
  const {route,calls}=routeFixture(profile);assert.equal((await route.POST(request({action:'prepare'}))).status,403);assert.equal((await route.GET(new Request('https://example.test/api/tamigo-hours-review/corrections?shift='+shiftId))).status,403);assert.equal(calls.length,0);
 }
});
test('correction API requires same-origin JSON, rejects oversized input and never accepts direct shift writes',async()=>{
 const {route,calls}=routeFixture({id:actor,active:true,role:'manager'});
 for(const headers of [{origin:'https://external.test'},{origin:''},{'sec-fetch-site':'cross-site'}])assert.equal((await route.POST(request({action:'commit',id:intentId},headers))).status,403);
 assert.equal((await route.POST(request({action:'commit'},{'Content-Type':'text/plain'}))).status,415);
 assert.equal((await route.POST(request({action:'prepare',data:'x'.repeat(20000)}))).status,413);
 assert.equal((await route.POST(request({action:'update',ShiftId:shiftId}))).status,400);assert.equal(calls.length,0);
 const answer=await route.GET(new Request('https://example.test/api/tamigo-hours-review/corrections?shift='+shiftId));assert.match(answer.headers.get('Cache-Control'),/no-store/);assert.equal((await answer.json()).enabled,false);
});
test('write adapter is explicitly gated and sends only one documented PUT without retries',async()=>{
 const calls=[],env={TAMIGO_API_KEY:'fixture-token'};
 const api=loader({}, {process:{env},fetch:async(url,options)=>{calls.push({url:String(url),...options});return Response.json({Success:true});}})('app/tamigoApi.ts');
 const payload=rules.updatePayload(rawShift(),normalized(rawShift()),rules.correctionValues(draft(),normalized(rawShift()),options));
 await assert.rejects(()=>api.updateTamigoActualShift(payload));assert.equal(calls.length,0);
 env.TAMIGO_HOURS_WRITE_ENABLED='1';await api.updateTamigoActualShift(payload);assert.equal(calls.length,1);assert.equal(calls[0].method,'PUT');assert(calls[0].url.endsWith('/Shifts/'+shiftId+'/'));assert.equal(JSON.parse(calls[0].body).Comment,'  Oorspronkelijke notitie  ');
});
test('an uncertain applied request can be reconciled by reading only, with no resend',async()=>{
 const f=fixture({timeoutAfterWrite:true});await f.service.prepare(actor,f.reference,draft(),types.DEFAULT_REVIEW_CONFIG);
 assert.equal((await f.service.commit(actor,intentId,true)).state,'unknown');
 assert.equal((await f.service.reconcile(employee,intentId)).state,'applied');assert.equal(f.attempts.length,1);assert.equal(f.records.get(intentId).checkedBy,employee);
});
test('an uncertain unchanged result stays locked, including when a different correction is prepared',async()=>{
 const f=fixture({timeout:true});await f.service.prepare(actor,f.reference,draft(),types.DEFAULT_REVIEW_CONFIG);await f.service.commit(actor,intentId,true);
 assert.equal((await f.service.reconcile(actor,intentId)).state,'unknown');
 f.deps.id=()=>employee;await f.service.prepare(actor,f.reference,draft(),types.DEFAULT_REVIEW_CONFIG);await assert.rejects(()=>f.service.commit(actor,employee,true),/locked/);assert.equal(f.attempts.length,1);
});
test('disabling the gate after preview still prevents a write',async()=>{
 const f=fixture();await f.service.prepare(actor,f.reference,draft(),types.DEFAULT_REVIEW_CONFIG);f.disable();await assert.rejects(()=>f.service.commit(actor,intentId,true),/ingeschakeld/);assert.equal(f.attempts.length,0);
});
function contextReader(settings={}){
 const calls=[],raw=rawShift(settings.raw),other='77777777-7777-4777-8777-777777777777';
 const reader=loader({'../../tamigoApi':{fetchTamigoHoursReviewSource:async input=>{
  calls.push(input);
  if(input.kind==='departments')return [{DepartmentId:department,Name:'Testwinkel'},{DepartmentId:other,Name:'Testafdeling'}];
  if(input.kind==='breakcodes')return rawBreaks;
  if(settings.missingDepartment&&input.departmentId===other)throw Error('Forbidden');
  return [{...raw,...(settings.conflicting&&input.departmentId===other?{Comments:'Tegenstrijdige versie'}:{})},...(!settings.unknownStatus?[]:[{...raw,ShiftId:other,PlanStatusCodeId:999}]),{...raw,ShiftId:actor,PlanStatusCodeId:4},{...raw,ShiftId:employee,PlanStatusCodeId:6}];
 }}})(base+'correctionContext.ts');
 return {read:reader.readCorrectionContext,calls,reference:{shiftId,departmentId:department,date:'2026-10-05',reviewMonth:'2026-10',revision:normalized(raw).sourceRevision}};
}
test('fresh correction context deduplicates department references and excludes clock/original copies',async()=>{
 const f=contextReader();const context=await f.read(f.reference);assert.equal(context.before.id,shiftId);assert.equal(context.dataset.actual.length,1);assert.equal(context.before.sourceDepartments.length,2);assert.equal(context.complete,true);
 const reads=f.calls.filter(x=>x.kind==='shifts');assert.equal(reads.length,2);assert.equal(reads[0].from,'2026-10-04');assert.equal(reads[0].to,'2026-10-07');
});
test('fresh correction context rejects conflicting copies and marks partial access explicitly',async()=>{
 const conflicting=contextReader({conflicting:true});await assert.rejects(()=>conflicting.read(conflicting.reference),/tegenstrijdige/);
 for(const setting of [{missingDepartment:true},{unknownStatus:true}]){const f=contextReader(setting);assert.equal((await f.read(f.reference)).complete,false);}
});
test('only internal readback skips the old revision; a browser cannot request that bypass',async()=>{
 const f=contextReader();await assert.rejects(()=>f.read({...f.reference,revision:'a'.repeat(64)}),/gewijzigd/);
 assert.equal((await f.read({...f.reference,revision:'verify'})).before.id,shiftId);assert.throws(()=>rules.correctionReference({...f.reference,revision:'verify'}));
});
test('missing write permission is a rejection only after an unchanged source is independently confirmed',async()=>{
 const f=fixture();
 const factory=loader({'../../tamigoApi':{getTamigoStatusCode:()=>403}})(base+'correctionServer.ts').createCorrectionService;
 f.deps.write=async payload=>{f.attempts.push(payload);throw Error('Forbidden');};
 const service=factory(f.deps);await service.prepare(actor,f.reference,draft(),types.DEFAULT_REVIEW_CONFIG);
 const result=await service.commit(actor,intentId,true);assert.equal(result.state,'rejected');assert.match(result.message,/schrijfrechten/);assert.equal(f.attempts.length,1);
});
test('write timestamps include the Amsterdam offset for each side of a DST boundary',()=>{
 const raw=rawShift({StartDateTime:'2026-03-29T00:00:00+01:00',EndDateTime:'2026-03-29T08:00:00+02:00',ShiftHours:7});
 const before=normalized(raw),after=rules.correctionValues(draft({start:'2026-03-29T00:00',end:'2026-03-29T08:00',breakCode:''}),before,options);
 const payload=rules.updatePayload(raw,before,after);assert(payload.StartTime.endsWith('+0100)/'));assert(payload.EndTime.endsWith('+0200)/'));
 assert.equal(load(base+'reviewTime.ts').parseTime(payload.StartTime).iso,after.start);assert.equal(load(base+'reviewTime.ts').parseTime(payload.EndTime).iso,after.end);
});
test('JSONB key ordering does not create a false source-change conflict',async()=>{
 const f=fixture({jsonbOrder:true});await f.service.prepare(actor,f.reference,draft(),types.DEFAULT_REVIEW_CONFIG);assert.equal((await f.service.commit(actor,intentId,true)).state,'applied');assert.equal(f.attempts.length,1);
});
