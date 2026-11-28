const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');
function load(file,imports={},extra='') {
 const exports={};
 const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 vm.runInNewContext(code+'\n'+extra,{exports,require:name=>name==='next/dynamic'?{default:()=>()=>null}:imports[name]||{},Date,Map,Set,URL,Intl,Response,Error,AbortSignal,console,process:{env:{VERCEL_ENV:'production'}}});
 return exports;
}
const road=load('app/bakkerij/logistiek/roadRouting.ts');
const history=load('app/bakkerij/logistiek/routeHistory.ts');
const model=load('app/winkel/lentEmballage.ts',{'../bakkerij/logistiek/roadRouting':road,'../bakkerij/logistiek/routeHistory':history});
const at=time=>new Date(`2026-11-26T${time}:00+01:00`);
const location=(id)=>({id,label:'Testlocatie',lat:51.8,lon:5.8});
const stop=(id,sourceId,extra={})=>({id,sourceId,label:'Teststop',detail:'',badges:[],location:location(id),...extra});
const lent=stop('shop-lent-emballage','shop:lent:emballage',{label:'Winkel Lent · emballage',learningKind:'shop',badges:['emballage','indien tijd']});
const delivery=stop('shop-lent','shop:lent',{label:'Winkel Lent',learningKind:'shop'});
function round(id,stops,legs,vehicle='Bus B',departure='08:05'){
 const ids=['__depot',...stops.map(s=>s.id),'__depot'];
 return {id,vehicle,title:'Ronde',departure,stops,road:{provider:'OSRM',calculatedAt:'2026-11-26T06:00:00Z',locations:Object.fromEntries(ids.map(id=>[id,location(id)])),seconds:Object.fromEntries(legs.map((minutes,i)=>[road.roadPair(ids[i],ids[i+1]),minutes*60]))}};
}
const draft=routes=>({id:'2026-11-26',date:'2026-11-26',isFinal:true,updatedAt:'2026-11-26T06:13:00Z',routes,excludedSourceIds:[]});
const plan=draft([round('b1',[delivery,lent],[20,10,15])]);
const plain=x=>JSON.parse(JSON.stringify(x));

test('only active Lent accounts receive the notice, never management or other stores',()=>{
 for(const profile of [null,{active:false,store:'lent',email:''},{active:true,store:'heyendaal',email:''},{active:true,store:'',role:'admin',email:'admin@strik.nl',permissions:{'stores.lent':true}}])assert.equal(model.canReceiveLentEmballage(profile),false);
 assert.equal(model.canReceiveLentEmballage({active:true,store:'lent',email:'lent@example.nl'}),true);
 assert.equal(model.canReceiveLentEmballage({active:true,store:'winkel',email:'strikpatisserielent@gmail.com'}),true);
});
test('08:00 Amsterdam boundary works in winter and summer; yesterday never appears',()=>{
 assert.equal(model.buildLentEmballageNotice(plan,at('07:59')),null);
 assert.equal(model.buildLentEmballageNotice(plan,at('08:00')).date,'2026-11-26');
 const summer={...plan,date:'2027-06-01'};
 assert.equal(model.buildLentEmballageNotice(summer,new Date('2027-06-01T05:59:59Z')),null);
 assert.ok(model.buildLentEmballageNotice(summer,new Date('2027-06-01T06:00:00Z')));
 assert.equal(model.buildLentEmballageNotice(plan,new Date('2026-11-26T23:01:00Z')),null);
});
test('regular delivery, missing route and explicitly removed emballage do not show a collection notice',()=>{
 assert.equal(model.buildLentEmballageNotice(null,at('09:00')),null);
 assert.equal(model.buildLentEmballageNotice(draft([round('b1',[delivery],[20,20])]),at('09:00')),null);
 assert.equal(model.buildLentEmballageNotice({...plan,excludedSourceIds:['shop:lent:emballage']},at('09:00')),null);
});
test('ETA includes driving and unloading, and conditional/concept status remains honest',()=>{
 const result=model.buildLentEmballageNotice(plan,at('08:00'));
 assert.equal(result.expectedTime,'08:50');assert.equal(result.conditional,true);assert.equal(result.provisional,false);
 assert.equal(model.buildLentEmballageNotice({...plan,isFinal:false},at('08:00')).provisional,true);
 assert.deepEqual(Object.keys(result).sort(),['conditional','date','expectedTime','provisional','routeUpdatedAt']);
});
test('moving or removing the pickup changes the next result, rather than retaining the 08:00 snapshot',()=>{
 const moved=draft([round('b1',[lent,delivery],[10,5,20])]);
 assert.equal(model.buildLentEmballageNotice(moved,at('08:01')).expectedTime,'08:15');
 assert.equal(model.buildLentEmballageNotice(draft([]),at('08:02')),null);
 assert.equal(plan.routes[0].stops[0].id,delivery.id);
});
test('second rounds start after return and loading; vehicles remain independent',()=>{
 const rounds=[round('b1',[delivery],[10,10]),round('a1',[delivery],[60,60],'Bus A'),round('b2',[lent],[5,5],'Bus B','na ronde 1')];
 assert.equal(model.buildLentEmballageNotice(draft(rounds),at('08:00')).expectedTime,'08:55');
 rounds[2].departure='vertrek 10:00';
 assert.equal(model.buildLentEmballageNotice(draft(rounds),at('08:00')).expectedTime,'10:05');
});
test('missing or changed road data leaves the time unknown instead of publishing a guessed 09:30',()=>{
 const missing=plain(plan);delete missing.routes[0].road;
 assert.equal(model.buildLentEmballageNotice(missing,at('08:00')).expectedTime,null);
 const changed=plain(plan);changed.routes[0].stops[0].location.lat=51.9;
 assert.equal(model.buildLentEmballageNotice(changed,at('08:00')).expectedTime,null);
});
test('manual Lent emballage stops work, cancellation wording and delivery notes do not',()=>{
 assert.ok(model.isLentEmballage(stop('m','manual:m',{label:'Emballage Lent'})));
 assert.equal(model.isLentEmballage(stop('m','manual:m',{label:'Geen emballage Lent'})),false);
 assert.equal(model.isLentEmballage({...delivery,detail:'Lent emballage besproken'}),false);
});
test('saved road ETA matches the existing driver print calculation, including service overrides',()=>{
 const dashboard=load('app/bakkerij/logistiek/BakkerijLogistiekDashboard.tsx',{'./roadRouting':road,'./routeHistory':history},'exports.timing=buildRouteGroupTimings;');
 const extra=stop('extra','manual:extra',{serviceMinutes:11});
 for(const routes of [[round('b1',[delivery,lent],[20,10,10])],[round('b1',[delivery,extra,lent],[12,5,4,15]),round('b2',[extra,lent],[12,6,10],'Bus B','na ronde 1')]]){
  const expected=dashboard.timing(routes),actual=model.savedRouteArrivals(routes);
  for(const r of routes)assert.deepEqual(plain(actual.get(r.id)),plain(expected.get(r.id).stops.map(s=>s.arrivalMinute)));
 }
});
test('store API blocks other stores before reading logistics data and reports read failures',async()=>{
 let reads=0,profile={active:true,store:'heyendaal',email:''},fail=false;
 const api=load('app/api/winkel/lent-emballage/route.ts',{
  '@/app/lib/auth/session':{getCurrentProfile:async()=>profile},
  '@/app/winkel/lentEmballage':model,
  '@/app/winkel/lentEmballage.server':{checkLentEmballage:async()=>{reads++;if(fail)throw Error('offline');return{notice:model.buildLentEmballageNotice(plan,at('09:00'))};}},
 });
 assert.equal((await api.GET()).status,403);assert.equal(reads,0);
 profile={active:true,store:'lent',email:''};const response=await api.GET();assert.equal(response.status,200);assert.equal(response.headers.get('Cache-Control'),'private, no-store');
 assert.equal((await response.json()).notice.expectedTime,'08:50');fail=true;assert.equal((await api.GET()).status,503);
});
test('no-pickup status requires a current successfully read route and follows added/removed stops',async()=>{
 let current=draft([round('b1',[delivery],[20,20])]),reads=0,fail=false;
 const server=load('app/winkel/lentEmballage.server.ts',{
  './lentEmballage':model,
  '../lib/bakeryLogisticsStorage':{getLogisticsRouteDraftForDate:async(date,strict)=>{reads++;assert.equal(strict,true);if(fail)throw Error('offline');return current;}},
 });
 assert.equal((await server.checkLentEmballage(at('07:59'))).noPickup,null);assert.equal(reads,0);
 const absent=await server.checkLentEmballage(at('08:00'));
 assert.equal(absent.notice,null);assert.deepEqual(plain(absent.noPickup),{date:'2026-11-26',provisional:false});
 current={...current,isFinal:false};assert.equal((await server.checkLentEmballage(at('08:01'))).noPickup.provisional,true);
 current=plan;const added=await server.checkLentEmballage(at('08:02'));assert.equal(added.noPickup,null);assert.equal(added.notice.expectedTime,'08:50');
 current={...plan,excludedSourceIds:['shop:lent:emballage']};assert.ok((await server.checkLentEmballage(at('08:03'))).noPickup);
 current={...plan,date:'2026-11-25'};assert.equal((await server.checkLentEmballage(at('08:04'))).noPickup,null);
 current=null;assert.equal((await server.checkLentEmballage(at('08:05'))).noPickup,null);
 fail=true;await assert.rejects(server.checkLentEmballage(at('08:06')),/offline/);
});
test('no-pickup card shows the date-safe message without an arrival time or pickup instructions',()=>{
 const {renderToStaticMarkup}=require('react-dom/server');
 const cards=load('app/winkel/LentEmballageNotice.tsx',{'./lentEmballage':model,'react/jsx-runtime':require('react/jsx-runtime')});
 const props={notice:{date:'2026-11-26',provisional:false},now:at('08:00')};
 const html=renderToStaticMarkup(cards.LentNoEmballageCard(props));
 assert.match(html,/Geen emballage vandaag/);assert.doesNotMatch(html,/Verwacht rond|Zet de emballage klaar|nog bijgewerkt/);
 assert.match(renderToStaticMarkup(cards.LentNoEmballageCard({...props,notice:{...props.notice,provisional:true}})),/De route wordt nog bijgewerkt/);
 assert.equal(cards.LentNoEmballageCard({...props,now:at('07:59')}),null);
 assert.equal(cards.LentNoEmballageCard({...props,now:new Date('2026-11-27T08:00:00+01:00')}),null);
});
test('morning job uses strict reads, stores only store-safe data and skips the wrong DST hour',async()=>{
 const writes=[];let reads=0;
 const server=load('app/winkel/lentEmballage.server.ts',{
  './lentEmballage':model,
  '../lib/bakeryLogisticsStorage':{getLogisticsRouteDraftForDate:async(date,strict)=>{reads++;assert.equal(strict,true);return{...plan,date};}},
  '../lib/supabase/admin':{createAdminClient:()=>({from:()=>({upsert:async(row)=>{writes.push(row);return{error:null};}})})},
 });
 assert.equal((await server.recordLentMorningCheck(at('07:00'))).skipped,true);assert.equal(reads,0);
 assert.equal((await server.recordLentMorningCheck(at('08:00'))).planned,true);
 assert.equal(writes[0].key,'lent-emballage-morning-check');assert.equal(writes[0].value.notice.expectedTime,'08:50');
 assert.equal((await server.recordLentMorningCheck(new Date('2027-06-01T07:00:00Z'))).skipped,true);
 assert.equal((await server.recordLentMorningCheck(new Date('2027-06-01T06:00:00Z'))).planned,true);
});
test('cron requires the configured secret and middleware exempts only authenticated cron requests',async()=>{
 let calls=0,allowed=false;
 const api=load('app/api/winkel/lent-emballage/cron/route.ts',{'@/app/lib/auth/cron':{hasCronAuthorization:()=>allowed},'@/app/winkel/lentEmballage.server':{recordLentMorningCheck:async()=>{calls++;return{ok:true};}}});
 assert.equal((await api.GET({})).status,403);assert.equal(calls,0);allowed=true;assert.equal((await api.GET({})).status,200);assert.equal(calls,1);
 const schedule=JSON.parse(fs.readFileSync('vercel.json')).crons.find(x=>x.path==='/api/winkel/lent-emballage/cron');assert.equal(schedule.schedule,'0 6,7 * * *');
 const middleware=fs.readFileSync('app/lib/supabase/middleware.ts','utf8');assert.match(middleware,/pathname === "\/api\/winkel\/lent-emballage\/cron"\) && request.method === "GET" && hasCronAuthorization\(request\)/);
});

test('shop ETA includes a preceding customer wait, matching screen and print arrival',()=>{
 const dashboard=load('app/bakkerij/logistiek/BakkerijLogistiekDashboard.tsx',{'./roadRouting':road,'./routeHistory':history},'exports.timing=buildRouteGroupTimings;');
 const timed=stop('timed','receipt:timed',{detail:'10:00–12:00 · Nijmegen',learningKind:'receipt'});
 const routes=[round('b1',[timed,lent],[10,10,10])];
 const expected=dashboard.timing(routes).get('b1');
 assert.equal(expected.stops[0].arrivalMinute,495);
 assert.equal(expected.stops[0].waitingMinutes,105);
 assert.equal(expected.stops[1].arrivalMinute,615);
 assert.deepEqual(plain(model.savedRouteArrivals(routes).get('b1')),plain(expected.stops.map(s=>s.arrivalMinute)));
 assert.equal(model.buildLentEmballageNotice(draft(routes),at('08:00')).expectedTime,'10:15');
});

test('saved guideline times never postpone the Lent pickup ETA',()=>{
 const preferred=stop('preferred','receipt:preferred',{detail:'Richttijd 10:00 - 13:00 · Nijmegen',learningKind:'receipt'});
 const rounds=[round('b1',[preferred,lent],[10,10,10])];
 assert.equal(model.buildLentEmballageNotice(draft(rounds),at('08:00')).expectedTime,'08:30');
});
