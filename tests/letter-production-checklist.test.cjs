const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, stubs={}) {
 const compiled={exports:{}};
 const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(code,{module:compiled,exports:compiled.exports,require(name){if(name in stubs)return stubs[name];if(name.startsWith('.'))return load(path.resolve(path.dirname(file),name)+'.ts',stubs);return require(name)},Response,Request,URL,Buffer,process:stubs.__process||process,AbortSignal});
 return compiled.exports;
}
const helper=load('app/sinterklaas/letters/productie/productionChecklist.ts');
const presentation=load('app/sinterklaas/letters/productie/productionPresentation.ts');
const row=(more={})=>({key:'s|melk|groot|spuit',label:'S · melk · groot · spuit',orders:20,stock:8,produced:0,orderSources:{online:10,winkel:4,b2b:6},...more});
const id='d8c0af2e-a725-4ef0-a435-6b5f2838784a';
const batch=(more={})=>({id,startDate:'2026-11-02',date:'2026-11-03',deadlineAt:'2026-11-01T20:00:00+01:00',status:'OPEN',minimumLeadDays:2,storeOrders:[],rows:[row()],...more});
const plain=value=>JSON.parse(JSON.stringify(value));

const b2bLetterOrder = (more = {}) => ({
 id: 'b2b-history', customerName: 'Testbedrijf', status: 'akkoord',
 department: 'chocolade', deliveryDate: '2026-11-06', productionDate: '',
 orderText: '', logo: '', packaging: '', importantNotes: '',
 letterLines: [{letter: 'S', chocolate: 'melk', size: 'groot', style: 'spuit', quantity: 20, exceptions: [], withLogo: true}],
 ...more,
});
const historicalB2BOrders = () => [
 b2bLetterOrder({letterLines: ['melk', 'puur', 'wit'].map((chocolate) => ({
  letter: 'S', chocolate, size: 'groot', style: 'spuit',
  quantity: chocolate === 'melk' ? 20 : 10, exceptions: [], withLogo: true,
 }))}),
 b2bLetterOrder({id: 'b2b-history-second', customerName: 'Tweede testbedrijf',
  letterLines: ['R', 'L', 'N', 'D'].map((letter) => ({
   letter, chocolate: 'melk', size: 'groot', style: 'spuit',
   quantity: 1, exceptions: [], withLogo: true,
  })),
 }),
];

test('a round is complete only when every required letter is finished and no order changes await review',()=>{
 const finished=row({produced:28});
 assert.equal(presentation.productionRoundIsComplete([finished]),true);
 assert.equal(presentation.productionRoundIsComplete([finished],true),false);
 assert.equal(presentation.productionRoundIsComplete([finished,row({key:'a',orders:1,stock:0,produced:0})]),false);
 assert.equal(presentation.productionRoundIsComplete([row({produced:50}),row({key:'a',orders:1,stock:0,produced:0})]),false);
 assert.equal(presentation.productionRoundIsComplete([finished,row({key:'cancelled',orders:0,stock:0,produced:4})]),true);
 assert.equal(presentation.productionRoundIsComplete([]),false);
 assert.equal(presentation.productionRoundIsComplete([row({orders:0,stock:0,produced:4})]),false);
 assert.equal(presentation.productionRoundIsComplete([row({orders:29,produced:28})]),false);
});

test('the plan locks exactly at the Amsterdam deadline, independently of early production',()=>{
 const b=batch();
 assert.equal(helper.productionDeadlinePassed(b,Date.parse('2026-11-01T18:59:59Z')),false);
 assert.equal(helper.productionDeadlinePassed(b,Date.parse('2026-11-01T19:00:00Z')),true);
 assert.equal(helper.productionDeadlinePassed(batch({deadlineAt:undefined})),false);
 assert.equal(helper.productionDeadlinePassed(batch({status:'IN_PRODUCTION',deadlineAt:undefined})),true);
});
test('partial production remains open, can be corrected, and never changes requested counts or sources',()=>{
 const original=[row()];const partial=helper.setProductionQuantity(original,original[0].key,10);
 assert.equal(helper.productionRemaining(partial),18);
 assert.equal(helper.productionTotals(partial).produced,10);
 assert.equal(original[0].produced,0);
 assert.deepEqual(plain(partial[0].orderSources),original[0].orderSources);
 const complete=helper.setProductionQuantity(partial,original[0].key,28);
 assert.equal(helper.productionRemaining(complete),0);
 assert.equal(helper.productionRemaining(helper.setProductionQuantity(complete,original[0].key,0)),28);
 for(const q of [-1,1.5,NaN,Number.MAX_SAFE_INTEGER+1])assert.throws(()=>helper.setProductionQuantity(original,original[0].key,q));
 assert.throws(()=>helper.setProductionQuantity(original,'unknown',1));
});
test('frozen list differences ignore checkmarks but include changed stock and origin even when totals match',()=>{
 const original=[row()];
 assert.equal(helper.productionChanges(original,[row({produced:28})]).length,0);
 assert.equal(helper.productionChanges(original,[row({orders:18,stock:10})]).length,1);
 assert.equal(helper.productionChanges(original,[row({orderSources:{online:14,b2b:6}})]).length,1);
 assert.equal(helper.productionPlanVersion(original),helper.productionPlanVersion([row({produced:28})]));
 assert.notEqual(helper.productionPlanVersion(original),helper.productionPlanVersion([row({stock:9})]));
});
test('a later increase reopens only the extra quantity, while cancelled already-made letters stay recorded',()=>{
 const old=[row({produced:28}),row({key:'a|puur|groot|spuit',label:'A · puur · groot · spuit',orders:4,stock:0,produced:4})];
 const current=[row({orders:25}),row({key:'m|wit|klein|spuit',label:'M · wit · klein · spuit',orders:10,stock:0})];
 const revised=helper.reviseProductionRows(old,current);
 assert.equal(revised.find(r=>r.key===old[0].key).produced,28);
 assert.equal(revised.find(r=>r.key===old[1].key).orders,0);
 assert.equal(revised.find(r=>r.key===old[1].key).produced,4);
 assert.equal(helper.productionRemaining(revised),15); // cancelled surplus must not hide the 5 + 10 still needed
 assert.equal(helper.productionChanges(revised,current).length,0);
});
test('all actual order channels retain completed orders, exclude cancellations and separate special variants',()=>{
 const base=batch({rows:[row({orders:2,stock:8,orderSources:{online:2}})]});
 const letter=(more={})=>({id:'1',code:'CL1',customerName:'Test',pickupDate:'2026-11-06',source:'winkel',status:'besteld',lines:[{letter:'S',chocolate:'melk',size:'groot',style:'spuit',quantity:3,logo:false,notes:'',specialRequests:[]}],...more});
 const b2b={id:'b',customerName:'Bedrijf',status:'akkoord',department:'banket',deliveryDate:'2026-11-06',productionDate:'',letterLines:[{letter:'S',chocolate:'melk',size:'groot',style:'spuit',quantity:5,exceptions:['notenvrij']}],logo:false};
 const result=helper.combineProductionOrders([base],[letter(),letter({id:'2',productionDone:true}),letter({id:'3',status:'geannuleerd'})],[b2b]);
 assert.equal(result.batches[0].rows.length,2);
 const regular=result.batches[0].rows.find(r=>r.key==='s|melk|groot|spuit');
 assert.equal(regular.orders,8);assert.equal(regular.stock,8);
 assert.deepEqual(plain(regular.orderSources),{online:2,winkel:6});
 assert.equal(result.batches[0].rows.find(r=>r.key.endsWith('notenvrij')).orderSources.b2b,5);
 assert.equal(base.rows[0].orders,2);
});


test('fulfillment keeps B2B quantities and customers on their original production day', () => {
 const early = batch({rows: []});
 const later = batch({id: 'later-round', date: '2026-11-17', startDate: '2026-11-16', rows: []});
 const orders = historicalB2BOrders();
 const assignments = orders.map((order) => ({order_id: order.id, season: 2026, batch_id: id, revision: 1}));
 const initial = helper.combineProductionOrders([early, later], [], orders, assignments);
 const rows = initial.batches[0].rows;
 assert.equal(rows.length, 7);
 assert.equal(helper.productionTotals(rows).orders, 44);
 for (const department of ['chocolade', 'beide', 'bakkerij']) {
  for (const flags of [
   department === 'chocolade' ? {productionDone: true} : {letterProductionDone: true},
   {packed: true}, {delivered: true},
   {productionDone: true, letterProductionDone: true, packed: true, delivered: true},
  ]) {
   const fulfilled = orders.map((order) => ({...order, department, ...flags}));
   const result = helper.combineProductionOrders([early, later], [], fulfilled, assignments);
   assert.deepEqual(plain(result.batches[0].rows), plain(rows));
   assert.equal(result.batches[1].rows.length, 0);
   assert.equal(result.b2bPlanning.length, 0);
   assert.equal(result.unplanned.length, 0);
   assert.equal(helper.productionChanges(rows, result.batches[0].rows).length, 0);
   assert.equal(helper.productionPlanVersion(result.batches[0].rows), helper.productionPlanVersion(rows));
  }
 }
});

test('shop and legacy online fulfillment also preserves production history', () => {
 const order = {
  id: 'legacy-history', code: 'CL1', customerName: 'Testklant',
  pickupDate: '2026-11-06', status: 'besteld', notes: '',
  lines: [{letter: 'S', chocolate: 'melk', size: 'groot', style: 'spuit', quantity: 3, logo: false, notes: '', specialRequests: []}],
 };
 for (const source of ['winkel', 'online']) {
  const initial = helper.combineProductionOrders([batch({rows: []})], [{...order, source}], []).batches[0].rows;
  for (const flags of [{productionDone: true}, {pickedUp: true}, {status: 'opgehaald'}]) {
   const result = helper.combineProductionOrders([batch({rows: []})], [{...order, source, ...flags}], []);
   assert.deepEqual(plain(result.batches[0].rows), plain(initial));
   assert.equal(helper.productionChanges(initial, result.batches[0].rows).length, 0);
   assert.equal(result.unplanned.length, 0);
  }
 }
});

test('completed orders without a matching round stay out of the unfinished queue', () => {
 const b2b = historicalB2BOrders().map((order) => ({...order, delivered: true}));
 const result = helper.combineProductionOrders([], [], b2b);
 assert.equal(result.unplanned.length, 0);
 assert.equal(result.b2bPlanning.length, 0);
 const pending = helper.combineProductionOrders([], [], historicalB2BOrders());
 assert.equal(pending.unplanned.length, 2);
 assert.equal(pending.b2bPlanning.length, 2);
 const unknownPackage = b2bLetterOrder({letterLines: [], department: 'beide',
  delivered: true, orderText: 'PRODUCTEN EN PRIJS\n30 × Speculaasbrok met letter · Speculaasbrok zonder amandel · kleine spuitletter · letter M',
 });
 assert.equal(helper.combineProductionOrders([], [], [unknownPackage]).unplanned.length, 0);
});

test('actual cancellations and quantity changes still require review after fulfillment', () => {
 const original = b2bLetterOrder({delivered: true});
 const rows = helper.combineProductionOrders([batch({rows: []})], [], [original]).batches[0].rows;
 const changed = {...original, letterLines: [{...original.letterLines[0], quantity: 22}]};
 const changedRows = helper.combineProductionOrders([batch({rows: []})], [], [changed]).batches[0].rows;
 assert.deepEqual(plain(helper.productionChanges(rows, changedRows)).map(({before, after}) => [before, after]), [[20, 22]]);
 const cancelled = helper.combineProductionOrders([batch({rows: []})], [], [{...original, cancelled: true}]);
 assert.equal(cancelled.batches[0].rows.length, 0);
 assert.deepEqual(plain(helper.productionChanges(rows, cancelled.batches[0].rows)).map(({before, after, detail}) => [before, after, detail]), [[20, 0, 'Vervallen']]);
 for (const status of ['aanvraag', 'offerte', 'afgewezen']) {
  assert.equal(helper.combineProductionOrders([batch({rows: []})], [], [{...original, status}]).batches[0].rows.length, 0);
 }
});

function endpointFixture({allowed=true,locked=true,existing=true,wpFailure=false,race=false,cron=false,freezeRace=false,insertRace=false}={}) {
 let current=batch({status:locked?'IN_PRODUCTION':'OPEN',deadlineAt:locked?'2020-01-01T19:00:00Z':'2099-01-01T19:00:00Z'});
 let wordpress={letters:[],b2b:[]};
 let saved=existing?{batch_id:id,rows:[row()],revision:1,plan_revision:1,locked_at:locked?'2020-01-01T19:00:00Z':null,updated_at:'2020-01-01T19:00:00Z'}:null;
 const writes=[];
 let raceOccurred=false;
 const db={from(table){let action='read',values,filters={};const q={select(){return q},eq(k,v){filters[k]=v;return q},in(){return q},maybeSingle(){return q},single(){return q},insert(v){action='insert';values=v;return q},update(v){action='update';values=v;return q},then(resolve){let data,error=null;
 if(table==='letter_production_batches')data={status:current.status,order_deadline_at:current.deadlineAt,season:2026};
 else if(table==='letter_production_checklists'){
  if(action==='insert'){
   if(insertRace&&!saved)saved={batch_id:id,rows:[row({produced:12})],revision:1,plan_revision:1,locked_at:null,updated_at:'now'};
   if(saved)error={code:'23505'};
   else{saved={revision:1,plan_revision:1,locked_at:'now',updated_at:'now',...values};writes.push({table,action,values});}
  }
  if(action==='update'){
   if(freezeRace&&!raceOccurred&&values.locked_at){raceOccurred=true;saved={...saved,revision:saved.revision+1,rows:[row({produced:18})]};}
   if(!race&&saved?.revision===filters.revision){saved={...saved,...values};writes.push({table,action,values});data=saved}else data=null;
  }else data=action==='insert'||filters.batch_id?saved:saved?[saved]:[];
 }else throw Error('Unexpected write or table: '+table);
 return Promise.resolve({data,error}).then(resolve)}};return q;}};
 const api=load('app/api/sinterklaas-letter-production/route.ts',{
  '@/app/lib/auth/access':{canAccessSinterklaasPath:(_profile,p)=>allowed&&p==='/sinterklaas/letters/productie'},
  '@/app/lib/auth/cron':{hasCronAuthorization:()=>cron},
  '@/app/lib/auth/session':{getCurrentProfile:async()=>({id:null})},
  '@/app/lib/supabase/admin':{createAdminClient:()=>db},
  '@/app/sinterklaas/sinterklaasServerApi':{loadProductionWordPressOrders:async()=>{if(wpFailure)throw Error('Source unavailable');return wordpress}},
  '@/app/sinterklaas/letters/productie/productionData.server':{loadCentralProduction:async()=>({batches:[current],centralUnplannedCount:0})},
  '@/app/sinterklaas/letters/productie/productionChecklist':helper,
 });
 const request=body=>new Request('https://app.strik-patisserie.nl/api/sinterklaas-letter-production',{method:'POST',headers:{'content-type':'application/json',origin:'https://app.strik-patisserie.nl'},body:JSON.stringify(body)});
 return {api,writes,request,get saved(){return saved},setCurrent(value){current=value},setWordPressOrders(value){wordpress=value}};
}
test('unauthorized or shop-only accounts cannot read or mark the global production list',async()=>{
 const f=endpointFixture({allowed:false});assert.equal((await f.api.GET(new Request('https://app.strik-patisserie.nl/api/sinterklaas-letter-production'))).status,403);
 assert.equal((await f.api.POST(f.request({}))).status,403);assert.equal(f.writes.length,0);
});
test('an open production day accepts early production without freezing orders',async()=>{
 const f=endpointFixture({locked:false,existing:false});
 const get=()=>f.api.GET(new Request('https://app.strik-patisserie.nl/api/sinterklaas-letter-production'));
 assert.equal((await (await get()).json()).batches[0].checklist,undefined);
 const payload={batchId:id,revision:0,action:'quantity',key:row().key,quantity:12};
 const response=await f.api.POST(f.request(payload));assert.equal(response.status,200);
 assert.equal(f.saved.rows[0].produced,12);assert.equal(f.saved.locked_at,null);
 assert.equal(f.saved.revision,1);assert.equal(f.saved.plan_revision,1);
 const view=(await (await get()).json()).batches[0];
 assert.equal(view.rows[0].produced,12);assert.equal(view.checklist.lockedAt,null);
 assert.equal(view.checklist.changes.length,0);assert.equal(helper.productionRemaining(view.rows),16);
 assert.equal((await f.api.POST(f.request(payload))).status,409,'retry never adds production twice');
 assert.equal(f.saved.rows[0].produced,12);
});
test('live orders can increase, shrink or disappear while actual production and logo variants survive',async()=>{
 const f=endpointFixture({locked:false,existing:false});
 const key=row().key,logo=row({key:key+'|logo',label:row().label+' · logo',orders:70,stock:0});
 const open=rows=>batch({deadlineAt:'2099-01-01T19:00:00Z',rows});
 const get=()=>f.api.GET(new Request('https://app.strik-patisserie.nl/api/sinterklaas-letter-production'));
 f.setCurrent(open([row({orders:370,stock:0}),logo]));
 assert.equal((await f.api.POST(f.request({batchId:id,revision:0,action:'quantity',key,quantity:370}))).status,200);
 for(const [demand,remaining,surplus] of [[400,100,0],[360,70,10],[0,70,370]]){
  f.setCurrent(open([...(demand?[row({orders:demand,stock:0})]:[]),logo]));
  const view=(await (await get()).json()).batches[0];
  assert.equal(view.rows.find(r=>r.key===key).produced,370);
  assert.equal(view.rows.find(r=>r.key===logo.key).produced,0);
  assert.equal(helper.productionRemaining(view.rows),remaining);
  assert.equal(helper.productionSurplus(view.rows),surplus);
  assert.equal(view.checklist.changes.length,0);
  assert.equal(view.checklist.lockedAt,null);
 }
 assert.equal(f.saved.revision,1,'reading changed demand does not rewrite actual production');
});
test('freezing reconciles the latest order totals and preserves early-made and cancelled quantities',async()=>{
 const f=endpointFixture({locked:false,existing:false});
 const key=row().key;
 assert.equal((await f.api.POST(f.request({batchId:id,revision:0,action:'quantity',key,quantity:28}))).status,200);
 f.setCurrent(batch({status:'IN_PRODUCTION',rows:[row({orders:40,stock:0})]}));
 const get=()=>f.api.GET(new Request('https://app.strik-patisserie.nl/api/sinterklaas-letter-production'));
 const locked=(await (await get()).json()).batches[0];
 assert(locked.checklist.lockedAt);assert.equal(locked.checklist.revision,2);
 assert.equal(locked.checklist.planRevision,1);assert.equal(locked.rows[0].produced,28);
 assert.equal(helper.productionRemaining(locked.rows),12);
 assert.equal(locked.checklist.changes.length,0);
 const writes=f.writes.length;await get();assert.equal(f.writes.length,writes);
 f.setCurrent(batch({status:'IN_PRODUCTION',rows:[]}));
 const changed=(await (await get()).json()).batches[0];
 assert.equal(changed.checklist.changes[0].after,0);
 assert.equal((await f.api.POST(f.request({batchId:id,revision:2,action:'revise',planVersion:changed.checklist.planVersion}))).status,200);
 assert.equal(f.saved.rows[0].produced,28);assert.equal(helper.productionSurplus(f.saved.rows),28);
});
test('freezing cannot overwrite a simultaneous production correction',async()=>{
 const f=endpointFixture({locked:false,existing:true,freezeRace:true});
 f.setCurrent(batch({status:'IN_PRODUCTION'}));
 const response=await f.api.GET(new Request('https://app.strik-patisserie.nl/api/sinterklaas-letter-production'));
 assert.equal(response.status,200);assert.equal(f.saved.rows[0].produced,18);
 assert.equal(f.saved.revision,3);assert(f.saved.locked_at);
});
test('simultaneous first registrations conflict and source failures never create partial snapshots',async()=>{
 const f=endpointFixture({locked:false,existing:false,insertRace:true});
 const payload={batchId:id,revision:0,action:'quantity',key:row().key,quantity:28};
 assert.equal((await f.api.POST(f.request(payload))).status,409);
 assert.equal(f.saved.rows[0].produced,12);assert.equal(f.saved.locked_at,null);
 const unavailable=endpointFixture({locked:false,existing:false,wpFailure:true});
 assert.notEqual((await unavailable.api.POST(unavailable.request(payload))).status,200);
 assert.equal(unavailable.saved,null);assert.equal(unavailable.writes.length,0);
});
test('a quantity save crossing the deadline freezes with its new count and absolute corrections persist',async()=>{
 const f=endpointFixture({locked:false,existing:true});
 f.setCurrent(batch({status:'IN_PRODUCTION',rows:[row({produced:28})]}));
 assert.equal((await f.api.POST(f.request({batchId:id,revision:1,action:'quantity',key:row().key,quantity:10}))).status,200);
 assert(f.saved.locked_at);assert.equal(f.saved.rows[0].produced,10);
 assert.equal(helper.reviseProductionRows(f.saved.rows,[row({produced:28})])[0].produced,10);
 assert.equal((await f.api.POST(f.request({batchId:id,revision:2,action:'quantity',key:row().key,quantity:40}))).status,200);
 assert.equal(helper.productionSurplus(f.saved.rows),12);
 assert.equal(helper.productionRemaining(f.saved.rows),0);
});
test('post-deadline first load freezes the complete plan once and incomplete sources never freeze a list',async()=>{
 const f=endpointFixture({existing:false});const request=()=>new Request('https://app.strik-patisserie.nl/api/sinterklaas-letter-production');
 assert.equal((await f.api.GET(request())).status,200);assert.equal((await f.api.GET(request())).status,200);
 assert.equal(f.writes.length,1);assert.equal(f.saved.rows[0].orders,20);
 const fail=endpointFixture({existing:false,wpFailure:true});assert.equal((await fail.api.GET(request())).status,503);assert.equal(fail.writes.length,0);
});
test('checkmarks persist absolute quantities, and stale or simultaneous writes cannot overwrite progress',async()=>{
 const f=endpointFixture();const payload={batchId:id,revision:1,action:'quantity',key:row().key,quantity:10};
 const response=await f.api.POST(f.request(payload));assert.equal(response.status,200);assert.equal(f.saved.rows[0].produced,10);assert.equal(f.saved.revision,2);assert.equal(f.saved.plan_revision,1);
 assert.equal((await f.api.POST(f.request({...payload,quantity:28}))).status,409);assert.equal(f.saved.rows[0].produced,10);
 const race=endpointFixture({race:true});assert.equal((await race.api.POST(race.request(payload))).status,409);assert.equal(race.writes.length,0);
 assert.equal(f.writes.every(w=>w.table==='letter_production_checklists'),true);
});
test('revising requires the exact reviewed live plan and keeps progress while advancing the paper version',async()=>{
 const f=endpointFixture();f.setCurrent(batch({status:'IN_PRODUCTION',rows:[row({orders:30})]}));
 const payload={batchId:id,revision:1,action:'revise',planVersion:helper.productionPlanVersion([row()])};
 assert.equal((await f.api.POST(f.request(payload))).status,409);assert.equal(f.writes.length,0);
 payload.planVersion=helper.productionPlanVersion([row({orders:30})]);
 assert.equal((await f.api.POST(f.request(payload))).status,200);assert.equal(f.saved.rows[0].orders,30);assert.equal(f.saved.plan_revision,2);
});

test('frozen historical lists retain delivered letters and their checkmarks through GET and reviewed revisions', async () => {
 const fixture = endpointFixture({existing: false});
 const central = batch({status: 'IN_PRODUCTION', rows: [row({orders: 2, stock: 8, orderSources: {online: 2}})]});
 const orders = historicalB2BOrders();
 fixture.setCurrent(central);
 fixture.setWordPressOrders({letters: [], b2b: orders});
 const get = () => fixture.api.GET(new Request('https://app.strik-patisserie.nl/api/sinterklaas-letter-production?season=2026'));
 const initialResponse = await get();
 assert.equal(initialResponse.status, 200);
 const initial = (await initialResponse.json()).batches[0];
 assert.equal(helper.productionTotals(initial.rows).orders, 46);
 assert.equal(initial.checklist.changes.length, 0);
 for (const row of initial.rows) {
  const response = await fixture.api.POST(fixture.request({
   batchId: id, revision: fixture.saved.revision, action: 'quantity',
   key: row.key, quantity: row.orders + row.stock,
  }));
  assert.equal(response.status, 200);
 }
 const frozen = plain(fixture.saved);
 const writesBeforeRead = fixture.writes.length;
 fixture.setWordPressOrders({letters: [], b2b: orders.map((order) => ({...order, delivered: true}))});
 for (let read = 0; read < 2; read++) {
  const response = await get();
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.deepEqual(result.batches[0].rows, frozen.rows);
  assert.equal(result.batches[0].checklist.planVersion, initial.checklist.planVersion);
  assert.equal(result.batches[0].checklist.changes.length, 0);
  assert.equal(result.b2bPlanning.length, 0);
  assert.equal(result.unplanned.length, 0);
  assert.equal(fixture.writes.length, writesBeforeRead);
 }
 assert.deepEqual(plain(fixture.saved), frozen);
 const obsoleteRemoval = await fixture.api.POST(fixture.request({
  batchId: id, revision: fixture.saved.revision, action: 'revise',
  planVersion: helper.productionPlanVersion(central.rows),
 }));
 assert.equal(obsoleteRemoval.status, 409);
 assert.deepEqual(plain(fixture.saved), frozen);
 assert.equal(fixture.writes.length, writesBeforeRead);
 const additional = b2bLetterOrder({id: 'new-order', letterLines: [{
  letter: 'S', chocolate: 'melk', size: 'groot', style: 'spuit',
  quantity: 2, exceptions: [], withLogo: false,
 }]});
 fixture.setWordPressOrders({letters: [], b2b: [...orders.map((order) => ({...order, delivered: true})), additional]});
 const review = (await (await get()).json()).batches[0];
 assert.equal(review.checklist.changes.length, 1);
 assert.equal(review.checklist.changes[0].before, 10);
 assert.equal(review.checklist.changes[0].after, 12);
 const revised = await fixture.api.POST(fixture.request({
  batchId: id, revision: fixture.saved.revision, action: 'revise',
  planVersion: review.checklist.planVersion,
 }));
 assert.equal(revised.status, 200);
 assert.equal(helper.productionTotals(fixture.saved.rows).orders, 48);
 assert.equal(helper.productionTotals(fixture.saved.rows).produced, 54);
 assert.equal(helper.productionRemaining(fixture.saved.rows), 2);
 for (const row of frozen.rows.filter((row) => row.key.endsWith('|logo'))) {
  assert.deepEqual(plain(fixture.saved.rows.find((next) => next.key === row.key)), row);
 }
 const final = (await (await get()).json()).batches[0];
 assert.equal(final.checklist.changes.length, 0);
 assert.equal(final.checklist.planRevision, 2);
});

test('deadline automation requires the exact existing cron secret; missing or malformed credentials are rejected',()=>{
 const auth=load('app/lib/auth/cron.ts',{__process:{env:{CRON_SECRET:'test-only-secret'}}});
 const request=value=>new Request('https://app.strik-patisserie.nl/api/sinterklaas-letter-production',{headers:value?{authorization:value}:{}});
 for(const header of ['', 'Bearer wrong', 'test-only-secret', 'Bearer test-only-secreé'])assert.equal(auth.hasCronAuthorization(request(header)),false);
 assert.equal(auth.hasCronAuthorization(request('Bearer test-only-secret')),true);
 const unconfigured=load('app/lib/auth/cron.ts',{__process:{env:{}}});
 assert.equal(unconfigured.hasCronAuthorization(request('Bearer test-only-secret')),false);
});
test('the authorized deadline task can freeze lists but cannot mark production without an authorized employee',async()=>{
 const f=endpointFixture({allowed:false,existing:false,cron:true});
 assert.equal((await f.api.GET(new Request('https://app.strik-patisserie.nl/api/sinterklaas-letter-production'))).status,200);
 assert.equal(f.saved.rows[0].produced,0);
 assert.equal((await f.api.POST(f.request({batchId:id,revision:1,action:'quantity',key:row().key,quantity:28}))).status,403);
 assert.equal(f.saved.rows[0].produced,0);
});
