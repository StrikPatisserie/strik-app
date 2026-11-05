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
