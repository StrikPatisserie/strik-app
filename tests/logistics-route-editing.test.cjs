const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, imports = {}, expose = '') {
 const exports = {};
 const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 vm.runInNewContext(code+'\n'+expose,{exports,require:name=>name==='next/dynamic'?{default:()=>()=>null}:imports[name]||{},Date,Map,Set,URL,Intl});
 return exports;
}
const {createRouteSaveQueue}=load('app/bakkerij/logistiek/routeSaveQueue.ts');
const dashboard=load('app/bakkerij/logistiek/BakkerijLogistiekDashboard.tsx',{'./roadRouting':load('app/bakkerij/logistiek/roadRouting.ts')},'exports.plan=buildRouteRounds;exports.move=moveRouteStopInRounds;exports.reconcile=reconcileRouteDraftRounds;exports.serialize=serializeRouteRounds;exports.shops=shopRouteMeta;exports.group=groupShopStops;exports.packaging=shopEmballageStop;');
const plain=value=>JSON.parse(JSON.stringify(value));
const profile={pressure:'normaal'};
const round=(id,stops)=>({id,title:'Ronde 1',vehicle:'Bus B',departure:'08:05',stops,badge:'',tone:'',load:'',reason:''});
const arend={id:'arend',sourceId:'receipt:arend',learningKind:'receipt',label:'Gasterij de Arend',detail:'Gendt',badges:[]};
const lent=dashboard.packaging('lent');
const automatic=[round('bus-B-1',[arend,lent])];
test('Gasterij de Arend stays after Emballage Lent after saving and reloading',()=>{
 const moved=dashboard.move(automatic,{sourceRouteId:'bus-B-1',targetRouteId:'bus-B-1',stopId:'arend',targetStopId: lent.id,position:'after'},profile);
 const draft={date:'2026-11-04',routes:dashboard.serialize(moved),excludedSourceIds:[]};
 for(let i=0;i<3;i++){
   const restored=dashboard.reconcile(draft,automatic,profile);
   assert.deepEqual(plain(restored[0].stops.map(s=>s.sourceId)),['shop:lent:emballage','receipt:arend']);
   draft.routes=dashboard.serialize(restored);
 }
});
test('manual position within another round survives reconciliation',()=>{
 const routes=[...automatic,round('bus-B-2',[])];
 const moved=dashboard.move(routes,{sourceRouteId:'bus-B-1',targetRouteId:'bus-B-2',stopId:'arend',position:'end'},profile);
 const restored=dashboard.reconcile({routes:dashboard.serialize(moved),excludedSourceIds:[]},routes,profile);
 assert.equal(restored[1].stops[0].sourceId,'receipt:arend');
 assert.equal(restored.flatMap(r=>r.stops).filter(s=>s.sourceId==='receipt:arend').length,1);
});
test('packaging pickups can be removed without returning after refresh',()=>{
 const draft={routes:[round('bus-B-1',[arend])],excludedSourceIds:['shop:lent:emballage']};
 assert.equal(dashboard.reconcile(draft,automatic,profile).flatMap(r=>r.stops).some(s=>s.sourceId==='shop:lent:emballage'),false);
});
test('every shop has one combined delivery and one optional packaging stop, weekdays and Saturday',()=>{
 for(const date of ['2026-11-04','2026-11-07','2026-11-08']){
  const rounds=dashboard.plan({date,isFuture:false},[],profile,null),stops=rounds.flatMap(r=>r.stops);
  for(const key of Object.keys(dashboard.shops)){
   const deliveries=stops.filter(s=>s.sourceId===`shop:${key}`),packaging=stops.filter(s=>s.sourceId===`shop:${key}:emballage`);
   assert.equal(deliveries.length,1,`${date} delivery ${key}`);assert.equal(packaging.length,1,`${date} packaging ${key}`);
   assert(packaging[0].badges.includes('indien tijd'));
  }
  assert(!stops.some(s=>/\bvers\b|\bhoudbaar\b/.test(s.label)));
  assert(!stops.some(s=>s.sourceId.endsWith(':shelf')));
 }
});
test('legacy fresh and shelf drafts become combined shop plus packaging without duplicating customers',()=>{
 const routes=dashboard.plan({date:'2026-11-04'},[],profile,null);
 const draft=plain(routes);
 draft[0].stops.push({id:'old-shelf',sourceId:'shop:heyendaalseweg:shelf',label:'Winkel Heyendaalseweg houdbaar',detail:'',badges:[]});
 const restored=dashboard.reconcile({routes:draft,excludedSourceIds:[]},routes,profile);
 assert(!restored.flatMap(r=>r.stops).some(s=>/houdbaar/.test(s.label)));
 assert.equal(restored.flatMap(r=>r.stops).filter(s=>s.sourceId==='shop:heyendaalseweg').length,1);
});
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};};
test('rapid saves serialize, coalesce pending concepts and ignore stale responses',async()=>{
 const q=createRouteSaveQueue(),gate=deferred(),writes=[];let active=0,maximum=0;
 const write=async(value,wait)=>{active++;maximum=Math.max(active,maximum);if(wait)await wait;writes.push(value);active--;return value;};
 const first=q.enqueue(()=>write('old',gate.promise));await Promise.resolve();
 const middle=q.enqueue(()=>write('middle'));const latest=q.enqueue(()=>write('latest'));
 assert.equal(first.isLatest(),false);gate.resolve();
 assert.equal(await first.promise,'old');assert.equal(await middle.promise,undefined);assert.equal(await latest.promise,'latest');
 assert.deepEqual(writes,['old','latest']);assert.equal(maximum,1);assert.equal(latest.isLatest(),true);
});
test('a failed write does not block the latest route; final saves are not coalesced',async()=>{
 const q=createRouteSaveQueue(),gate=deferred(),writes=[];
 const first=q.enqueue(async()=>{await gate.promise;throw Error('offline');});await Promise.resolve();
 const handled=first.promise.catch(e=>e.message);
 const final=q.enqueue(async()=>{writes.push('final');return true;},false);
 const latest=q.enqueue(async()=>{writes.push('newer concept');return true;});gate.resolve();
 assert.equal(await handled,'offline');assert.equal(await final.promise,true);assert.equal(await latest.promise,true);
 assert.deepEqual(writes,['final','newer concept']);
});
test('reset invalidates queued concepts and waits for in-flight writes before deleting',async()=>{
 const q=createRouteSaveQueue(),gate=deferred(),writes=[];
 const first=q.enqueue(async()=>{await gate.promise;writes.push('old');});await Promise.resolve();
 const pending=q.enqueue(async()=>writes.push('pending'));q.invalidate();gate.resolve();await q.settled();writes.push('reset');
 await first.promise;await pending.promise;assert.deepEqual(writes,['old','reset']);assert.equal(first.isLatest(),false);
});

// Execute the actual client save function with a controlled network and setters.
function saveHarness() {
 const file='app/bakkerij/logistiek/BakkerijLogistiekDashboard.tsx',source=fs.readFileSync(file,'utf8');
 const ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let node;
 function visit(n){if(ts.isFunctionDeclaration(n)&&n.name?.text==='saveRouteDraft')node=n;ts.forEachChild(n,visit);}visit(ast);
 const code=ts.transpileModule(source.slice(node.pos,node.end),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
 const calls=[],changes=[],requests=[],dateRef={current:{selectedDate:'2026-11-04'}},pending={current:''};
 const context={selectedPlan:{date:'2026-11-04'},dateStateRef:dateRef,pendingRouteDateRef:pending,routeSaveQueueRef:{current:createRouteSaveQueue()},excludedRouteStopSourceIds:[],automaticRouteRounds:automatic,
 serializeRouteRounds:dashboard.serialize,routeRoundsForPersistence:routes=>routes,getUploadTime:()=> '09:00',
 fetch:async(url,options)=>{const gate=deferred();requests.push({url,payload:JSON.parse(options.body),gate});return gate.promise;},
 setRouteSaveState:value=>calls.push(['state',value]),setRouteSaveMessage:value=>calls.push(['message',value]),setRouteDraft:value=>changes.push(value),setRouteLearning:value=>calls.push(['learning',value]),setRouteHasUnsavedChanges:value=>calls.push(['dirty',value]),};
 vm.runInNewContext(code+'\nthis.save=saveRouteDraft;',context);
 const respond=(index,ok=true)=>{const request=requests[index];request.gate.resolve({ok,json:async()=>({ok,routeDraft:{date:request.payload.date,routes:request.payload.routes,excludedSourceIds:request.payload.excludedSourceIds},message:'Netwerkfout'})});};
 return{save:context.save,requests,calls,changes,dateRef,pending,respond};
}
test('client ignores an old response while the newest manual move is still saving',async()=>{
 const h=saveHarness();const first=h.save(automatic,false);await Promise.resolve();
 const latestRoutes=[round('bus-B-1',[lent,arend])];const last=h.save(latestRoutes,false);
 h.respond(0);await first;assert.equal(h.changes.length,0);assert.equal(h.pending.current,'2026-11-04');
 await Promise.resolve();h.respond(1);assert.equal(await last,true);
 assert.deepEqual(plain(h.changes[0].routes[0].stops.map(s=>s.sourceId)),['shop:lent:emballage','receipt:arend']);
 assert.equal(h.pending.current,'');assert(!h.calls.some(([type])=>type==='learning'),'Concept saves do not replace route learning');
});
test('a failed save retains local edits and does not load the previous stored route',async()=>{
 const h=saveHarness();const save=h.save(automatic,false);await Promise.resolve();h.respond(0,false);
 assert.equal(await save,false);assert.equal(h.changes.length,0);assert(h.calls.some(([type,value])=>type==='dirty'&&value===true));
 assert.equal(h.pending.current,'2026-11-04');
});
test('a response for yesterday cannot overwrite the currently selected day',async()=>{
 const h=saveHarness();const save=h.save(automatic,false);await Promise.resolve();h.dateRef.current.selectedDate='2026-11-05';h.respond(0);
 assert.equal(await save,false);assert.equal(h.changes.length,0);assert.equal(h.pending.current,'');
});
function apiHarness(allowed=true) {
 const writes=[],observations=[];let learningReads=0;
 const api=load('app/api/bakkerij-logistiek/route-draft/route.ts',{
 '@/app/bakkerij/logistiek/roadRouting':load('app/bakkerij/logistiek/roadRouting.ts'),
 'next/server':{NextResponse:{json:(data,init)=>Response.json(data,init)}},
 '@/app/lib/bakeryLogisticsAuth':{canAccessLogisticsRequest:async()=>allowed},
 '@/app/lib/bakeryLogisticsStorage':{
  upsertLogisticsRouteDraft:async draft=>writes.push(plain(draft)),
  upsertLogisticsRouteLearningObservation:async value=>observations.push(value),
  getLogisticsRouteLearning:async()=>{learningReads++;return{stops:[],pairs:[]};},
 },
 });
 return{writes,observations,learningReads:()=>learningReads,post:body=>api.POST(new Request('http://local/api/bakkerij-logistiek/route-draft',{method:'POST',body:JSON.stringify(body)}))};
}
test('route API preserves the manual order and excluded packaging without loading learning for each drag',async()=>{
 const h=apiHarness(),body={date:'2026-11-04',routes:[round('bus-B-1',[lent,arend])],excludedSourceIds:['shop:daalseweg:emballage'],learn:false};
 const response=await h.post(body);assert.equal(response.status,200);const data=await response.json();
 assert.deepEqual(data.routeDraft.routes[0].stops.map(s=>s.sourceId),['shop:lent:emballage','receipt:arend']);
 assert.deepEqual(data.routeDraft.excludedSourceIds,['shop:daalseweg:emballage']);assert.equal(h.learningReads(),0);assert.equal(h.writes.length,1);
 assert.equal(data.routeDraft.isFinal,false);
});
test('only an explicit final save updates route learning; unauthorized writes are blocked',async()=>{
 const h=apiHarness(),body={date:'2026-11-04',routes:automatic,baselineRoutes:automatic,learn:true};
 assert.equal((await h.post(body)).status,200);assert.equal(h.learningReads(),1);assert.equal(h.observations.length,1);assert.equal(h.writes[0].isFinal,true);
 const denied=apiHarness(false);assert.equal((await denied.post(body)).status,403);assert.equal(denied.writes.length,0);
});
test('verified road times survive route API save, reconciliation and a manual reorder',async()=>{
 const road=load('app/bakkerij/logistiek/roadRouting.ts');
 const location={id:'pdok-a',label:'Teststraat 1, Nijmegen',lat:51.8,lon:5.8};
 const manual={id:'manual-a',sourceId:'manual:manual-a',label:'Teststop',detail:location.label,badges:['handmatig'],location,serviceMinutes:8};
 const matrix={provider:'OSRM',calculatedAt:new Date().toISOString(),locations:{__depot:location,'manual-a':location},seconds:{[road.roadPair('__depot','manual-a')]:120,[road.roadPair('manual-a','__depot')]:180}};
 const route={...round('bus-B-1',[manual]),road:matrix};const h=apiHarness();
 const response=await h.post({date:'2026-11-05',routes:dashboard.serialize([route]),excludedSourceIds:[],learn:false});
 assert.equal(response.status,200);const saved=(await response.json()).routeDraft;
 const restored=dashboard.reconcile(saved,[round('bus-B-1',[])],profile);
 assert.equal(restored[0].stops[0].location.id,'pdok-a');assert.equal(restored[0].stops[0].serviceMinutes,8);
 assert.equal(road.roadLegMinutes(restored[0].road,'__depot','manual-a',undefined,restored[0].stops[0].location),2);
});
