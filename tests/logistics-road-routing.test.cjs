const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
function load(file,imports={},extra=''){
 const exports={};
 const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 new Function('require','exports',code+'\n'+extra)(name=>name==='server-only'?{}:imports[name]||require(name),exports);return exports;
}
const road=load('app/bakkerij/logistiek/roadRouting.ts');
const loc=id=>({id,label:`Straat ${id}, Nijmegen`,lat:51.8,lon:5.8});
const stop=id=>({id,label:id,address:`Straat 1 Nijmegen`,location:loc(id),serviceMinutes:5});
function matrix(ids,overrides={}){
 const seconds={};for(const a of ids)for(const b of ids)seconds[road.roadPair(a,b)]=a===b?0:600;
 for(const [pair,value] of Object.entries(overrides))seconds[pair]=value;
 return{provider:'OSRM',calculatedAt:new Date().toISOString(),locations:Object.fromEntries(ids.map(id=>[id,loc(id)])),seconds};
}
test('insertion uses directed road times and retains existing relative order',()=>{
 const m=matrix(['__depot','a','b','__new'],{[road.roadPair('a','__new')]:60,[road.roadPair('__new','b')]:60});
 const best=road.bestRoadInsertion([stop('a'),stop('b')],stop('__new'),m,480);
 assert.equal(best.index,1);assert.equal(best.extraMinutes,-3);assert.equal(best.returnMinute,517);
 assert.equal(road.roadLegMinutes(m,'a','__new',loc('a'),loc('__new')),1);
 assert.equal(road.roadLegMinutes(m,'__new','a',loc('__new'),loc('a')),10);
});
test('a tight existing deadline outranks a cheaper insertion',()=>{
 const m=matrix(['__depot','a','__new'],{[road.roadPair('__depot','__new')]:60,[road.roadPair('__new','a')]:60});
 const best=road.bestRoadInsertion([{...stop('a'),deadlineMinute:490}],{...stop('__new'),serviceMinutes:20},m,480);
 assert.equal(best.index,1);assert.equal(best.lateStops,0);
});
test('missing routes fail instead of inventing zero minutes; known zero is valid',()=>{
 const m=matrix(['__depot','a','__new']);delete m.seconds[road.roadPair('__new','a')];
 assert.throws(()=>road.bestRoadInsertion([stop('a')],stop('__new'),m,480),/autoroute/);
 assert.equal(road.roadLegMinutes(m,'__new','a',loc('__new'),loc('a')),null);
 m.seconds[road.roadPair('__new','a')]=0;assert.equal(road.roadLegMinutes(m,'__new','a',loc('__new'),loc('a')),0);
 assert.equal(road.roadLegMinutes(m,'__new','a',{...loc('__new'),lat:52},loc('a')),null);
});
test('matrix and verified coordinates survive JSON, renaming and validation',()=>{
 const m=matrix(['__depot','a','__new']);const renamed=road.renameRoadPoint(m,'__new','manual-1');
 const restored=road.cleanRoad(JSON.parse(JSON.stringify(renamed)));
 assert.equal(road.roadLegMinutes(restored,'a','manual-1',loc('a'),loc('__new')),10);
 assert.equal(restored.locations.__new,undefined);
 assert.equal(road.cleanLocation({...loc('a'),lat:0}),undefined);
 assert.equal(road.cleanRoad({...m,seconds:{'bad pair':10}}),undefined);
 assert.equal(road.cleanRoad({...m,seconds:{[road.roadPair('a','__new')]:-1}}),undefined);
 assert.equal(road.cleanRoad({...m,locations:JSON.parse('{"__proto__":{"id":"a","label":"a","lat":51,"lon":5}}')}),undefined);
 assert.notEqual(road.routeFingerprint([{id:'a',label:'a',detail:'old'}]),road.routeFingerprint([{id:'a',label:'a',detail:'new'}]));
});
function service(fetch,gate=true){return load('app/bakkerij/logistiek/roadRouting.server.ts',{'./roadRouting':road,'@/app/lib/supabase/admin':{createAdminClient:()=>({rpc:async()=>({data:gate})})}},'');}
test('PDOK resolution refuses generic names, ambiguous addresses and a different house number',async()=>{
 const original=global.fetch;let calls=0;
 global.fetch=async()=>{calls++;return Response.json({response:{docs:[{id:'a',weergavenaam:'Straat 10, Nijmegen'},{id:'b',weergavenaam:'Straat 10, Nijmegen'}]}});};
 try{const s=service();assert.equal(await s.resolveAddress('Gasterij Nijmegen'),null);assert.equal(calls,0);assert.equal(await s.resolveAddress('Straat 1 Nijmegen'),null);assert.equal(await s.resolveAddress('Straat 10 Nijmegen'),null);}finally{global.fetch=original;}
});
test('shared rate gate stops network requests and a successful matrix is cached',async()=>{
 const original=global.fetch;let calls=0;global.fetch=async()=>{calls++;return Response.json({code:'Ok',durations:[[0,60],[120,0]]});};
 try{
  const locations={__depot:loc('depot'),a:loc('a')};
  await assert.rejects(()=>service(undefined,false).roadMatrix(locations),/seconden/);assert.equal(calls,0);
  const s=service();const result=await s.roadMatrix(locations);assert.equal(result.seconds[road.roadPair('a','__depot')],120);
  await s.roadMatrix(locations);assert.equal(calls,1);
 }finally{global.fetch=original;}
});
test('address APIs require logistics access and reject foreign mutation origins',async()=>{
 let allowed=false;
 const access=load('app/bakkerij/logistiek/roadAccess.server.ts',{'@/app/lib/auth/session':{getCurrentProfile:async()=>({})},'@/app/lib/auth/access':{canAccessPath:()=>allowed}});
 assert.equal((await access.roadAccess(new Request('https://app.test/api'))).status,403);
 allowed=true;assert.equal((await access.roadAccess(new Request('https://app.test/api',{headers:{origin:'https://else.test'}}),true)).status,403);
 assert.equal(await access.roadAccess(new Request('https://app.test/api',{headers:{origin:'https://app.test'}}),true),null);
});
function api(serviceOverrides={}){
 return load('app/api/bakkerij-logistiek/route-insertion/route.ts',{'@/app/bakkerij/logistiek/roadRouting':road,'@/app/bakkerij/logistiek/roadAccess.server':{roadAccess:async()=>null,roadHeaders:{}},'@/app/bakkerij/logistiek/roadRouting.server':{lookupAddress:async id=>loc(id),resolveAddress:async address=>address==='Ambachtsweg 4 Malden'?loc('depot'):null,roadMatrix:async locations=>matrix(Object.keys(locations)),...serviceOverrides}});
}
const request=body=>new Request('https://app.test/api',{method:'POST',body:JSON.stringify({location:loc('new'),departureMinute:480,serviceMinutes:5,stops:[],...body})});
test('an unresolved existing stop asks for confirmation before any matrix request',async()=>{
 let called=false;const res=await api({roadMatrix:async()=>{called=true;}}).POST(request({stops:[{...stop('a'),location:undefined}]}));
 assert.equal(res.status,200);assert.equal((await res.json()).needsAddresses[0].id,'a');assert.equal(called,false);
});
test('successful calculation returns a canonical address and insertion; provider failure is explicit',async()=>{
 const res=await api().POST(request({stops:[stop('a')]}));assert.equal(res.status,200);const data=await res.json();assert.equal(data.location.id,'new');assert.equal(typeof data.suggestion.index,'number');assert(data.road);
 const failed=await api({roadMatrix:async()=>{throw Error('Rijtijden tijdelijk niet beschikbaar');}}).POST(request({}));assert.equal(failed.status,503);assert.match((await failed.json()).message,/niet beschikbaar/);
});

test('postcode and exact house number resolve a misspelled street, without choosing a different house',async()=>{
 const original=global.fetch;const queries=[];
 global.fetch=async url=>{
  const parsed=new URL(url);
  if(parsed.pathname.endsWith('/suggest')){
   queries.push(parsed.searchParams.get('q'));
   return Response.json({response:{docs:[{id:'arend',weergavenaam:'Notaris Stephanus Roesstraat 28, 6645AJ Winssen'},{id:'other',weergavenaam:'Notaris Stephanus Roesstraat 2, 6645AJ Winssen'}]}});
  }
  return Response.json({response:{docs:[{id:'arend',weergavenaam:'Notaris Stephanus Roesstraat 28, 6645AJ Winssen',centroide_ll:'POINT(5.70871001 51.88322774)'}]}});
 };
 try{
  const result=await service().resolveAddress('Notaris Stefanus Roesstr 28, 6645 AJ WINSSEN');
  assert.equal(result.id,'arend');assert.equal(result.lat,51.88322774);assert.deepEqual(queries,['6645AJ 28']);
 }finally{global.fetch=original;}
});

test('Lent route instructions cannot move a Winssen delivery into Lent',()=>{
 const imports=new Proxy({'./roadRouting':road,'next/dynamic':{default:()=>()=>null}},{get:(target,key)=>target[key]||{}});
 const dashboard=load('app/bakkerij/logistiek/BakkerijLogistiekDashboard.tsx',imports,'exports.timing=buildRouteTiming;exports.point=receiptRoutePoint;exports.packaging=shopEmballageStop;');
 const address='Notaris Stefanus Roesstr 28, 6645 AJ WINSSEN';
 const arend={id:'arend',sourceId:'receipt:arend',label:'Gasterij de Arend',learningTarget:address,detail:`voor 14:00 · ${address} · vast: Wordt altijd na winkel Lent bezorgd`,badges:[]};
 const lent=dashboard.packaging('lent');
 const estimated=dashboard.timing({stops:[lent,arend]},480);
 assert(estimated.stops[1].travelMinutes>=15);assert.equal(estimated.stops[1].roadBased,false);
 const receipt={customer:'Gasterij de Arend',address,deliveryAddress:address,customerNote:'Altijd na winkel Lent',internalNote:'via Lent',tags:[],lines:[]};
 assert(dashboard.point(receipt).x< -4);
 const lentLocation={id:'lent',label:'Oranje Marieplein 11, 6663RL Lent',lat:51.86481178,lon:5.85371297};
 const arendLocation={id:'arend',label:address,lat:51.88322774,lon:5.70871001};
 const m=matrix(['__depot',lent.id,'arend'],{[road.roadPair(lent.id,'arend')]:1376.3});
 m.locations[lent.id]=lentLocation;m.locations.arend=arendLocation;
 const real=dashboard.timing({road:m,stops:[{...lent,location:lentLocation},{...arend,location:arendLocation}]},480);
 assert.equal(real.stops[1].travelMinutes,23);assert.equal(real.stops[1].roadBased,true);
 assert.equal(real.stops[1].arrivalMinute,real.stops[0].arrivalMinute+real.stops[0].serviceMinutes+23);
});

function timesApi(overrides={}){
 return load('app/api/bakkerij-logistiek/route-times/route.ts',{
  '@/app/bakkerij/logistiek/roadRouting':road,
  '@/app/bakkerij/logistiek/roadAccess.server':{roadAccess:async()=>null,roadHeaders:{}},
  '@/app/bakkerij/logistiek/roadRouting.server':{resolveAddress:async address=>address==='Ambachtsweg 4 Malden'?loc('depot'):address.includes('Winssen')?loc('arend'):null,roadMatrix:async locations=>matrix(Object.keys(locations)),...overrides},
 });
}
const timesRequest=stops=>new Request('https://app.test/api',{method:'POST',body:JSON.stringify({stops})});
test('existing route times resolve addresses and keep unresolved stops separate',async()=>{
 let supplied;
 const api=timesApi({roadMatrix:async locations=>{supplied=locations;return matrix(Object.keys(locations));}});
 const response=await api.POST(timesRequest([{id:'lent',address:'Oranje Marieplein 11 Lent',location:loc('lent')},{id:'arend',address:'Roesstraat 28 Winssen'},{id:'unknown',address:'Adres controleren'}]));
 assert.equal(response.status,200);const data=await response.json();
 assert.deepEqual(data.unresolved,['unknown']);assert.deepEqual(Object.keys(supplied),['__depot','lent','arend']);
 assert.equal(data.road.locations.arend.id,'arend');assert.equal(data.road.locations.unknown,undefined);
});
test('invalid and duplicate stop IDs are rejected before external lookups',async()=>{
 let calls=0;const api=timesApi({resolveAddress:async()=>{calls++;return loc('depot');}});
 for(const stops of [[{id:'__proto__',address:'Street 1'}],[{id:'a',address:'Street 1'},{id:'a',address:'Street 2'}]]){
  assert.equal((await api.POST(timesRequest(stops))).status,503);
 }
 assert.equal(calls,0);
});
test('route calculation cache survives reorder and notes, and invalidates an address change',()=>{
 const hook=load('app/bakkerij/logistiek/useRoadRouteTimes.ts',{'./roadRouting':road});
 const a={id:'a',label:'Klant',learningTarget:'Straat 1 Nijmegen',detail:'via Lent'};
 const b={id:'b',label:'Klant B',learningTarget:'Straat 2 Winssen',detail:''};
 assert.equal(hook.roadRouteKey({stops:[a,b]}),hook.roadRouteKey({stops:[{...b,detail:'nieuwe instructie'},a]}));
 assert.notEqual(hook.roadRouteKey({stops:[a,b]}),hook.roadRouteKey({stops:[{...a,learningTarget:'Straat 3 Nijmegen'},b]}));
 assert.equal(road.roadStopAddress({detail:'voor 14:00 · Straat 28 Winssen · vast: via Lent'}),'Straat 28 Winssen');
});

test('a late route response is discarded after switching to another route',async()=>{
 const original=global.fetch,effects=[],updates=[];let resolve;
 global.fetch=()=>new Promise(done=>{resolve=done;});
 const react={useEffect:fn=>effects.push(fn),useMemo:fn=>fn(),useRef:value=>({current:value}),useState:value=>[value,update=>updates.push(update)]};
 try{
  const hook=load('app/bakkerij/logistiek/useRoadRouteTimes.ts',{'./roadRouting':road,react});
  hook.useRoadRouteTimes([{id:'route',stops:[{id:'a',label:'A',detail:'Straat 1 Nijmegen'}]}],true);
  effects[0]();const cleanup=effects[1]();cleanup();
  resolve(Response.json({road:matrix(['__depot','a']),unresolved:[]}));
  await new Promise(done=>setImmediate(done));
  assert.deepEqual(updates,['Rijtijden berekenen…']);
 }finally{global.fetch=original;}
});
