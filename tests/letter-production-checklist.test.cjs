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
const supplements=load('app/sinterklaas/letters/productie/productionSupplements.ts');
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
  '@/app/sinterklaas/letters/productie/productionSupplements':supplements,
 });
 const request=body=>new Request('https://app.strik-patisserie.nl/api/sinterklaas-letter-production',{method:'POST',headers:{'content-type':'application/json',origin:'https://app.strik-patisserie.nl'},body:JSON.stringify(body)});
 return {api,writes,request,get saved(){return saved},setSaved(value){saved=value},setCurrent(value){current=value},setWordPressOrders(value){wordpress=value}};
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
test('freezing reconciles current demand once and later removals cannot revise the production record',async()=>{
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
 assert.equal(changed.checklist.changes.length,0);
 assert.equal(changed.checklist.orderChanges.length,0);
 assert.equal(changed.checklist.pendingOrderChanges.length,0);
 assert.equal((await f.api.POST(f.request({batchId:id,revision:2,action:'revise',planVersion:changed.checklist.planVersion}))).status,409);
 assert.equal(f.saved.rows[0].orders,40);assert.equal(f.saved.rows[0].produced,28);
 assert.equal(helper.productionRemaining(f.saved.rows),12);
 assert.equal(f.writes.length,writes);
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
test('even an exact live plan cannot replace a frozen paper list',async()=>{
 const f=endpointFixture();f.setCurrent(batch({status:'IN_PRODUCTION',rows:[row({orders:30})]}));
 const payload={batchId:id,revision:1,action:'revise',planVersion:helper.productionPlanVersion([row()])};
 assert.equal((await f.api.POST(f.request(payload))).status,409);assert.equal(f.writes.length,0);
 payload.planVersion=helper.productionPlanVersion([row({orders:30})]);
 assert.equal((await f.api.POST(f.request(payload))).status,409);assert.equal(f.saved.rows[0].orders,20);assert.equal(f.saved.plan_revision,1);
 assert.equal(f.writes.length,0);
});

test('frozen historical lists retain delivered letters and queue only additional demand', async () => {
 const fixture = endpointFixture({existing: false});
 const central = batch({status: 'IN_PRODUCTION', rows: [row({orders: 2, stock: 8, orderSources: {online: 2}, recipients: [{id: 'central-online', source: 'online', customerName: 'Bestaande klant', quantity: 2, date: '2026-11-06'}]})]});
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
 assert.equal(review.checklist.changes.length, 0);
 assert.equal(review.checklist.orderChanges.length, 0);
 assert.equal(review.checklist.pendingOrderChanges.length, 1);
 assert.equal(review.checklist.pendingOrderChanges[0].customerName, additional.customerName);
 assert.equal(review.checklist.pendingOrderChanges[0].extra, 2);
 assert.equal(review.checklist.pendingOrderChanges[0].items[0].before, 0);
 assert.equal(review.checklist.pendingOrderChanges[0].items[0].after, 2);
 const revised = await fixture.api.POST(fixture.request({
  batchId: id, revision: fixture.saved.revision, action: 'revise',
  planVersion: review.checklist.planVersion,
 }));
 assert.equal(revised.status, 409);
 assert.equal(helper.productionTotals(fixture.saved.rows).orders, 46);
 assert.equal(helper.productionTotals(fixture.saved.rows).produced, 54);
 assert.equal(helper.productionRemaining(fixture.saved.rows), 0);
 assert.deepEqual(plain(fixture.saved), frozen);
 assert.equal(fixture.writes.length, writesBeforeRead);
 for (const row of frozen.rows.filter((row) => row.key.endsWith('|logo'))) {
  assert.deepEqual(plain(fixture.saved.rows.find((next) => next.key === row.key)), row);
 }
 const final = (await (await get()).json()).batches[0];
 assert.equal(final.checklist.changes.length, 0);
 assert.equal(final.checklist.planRevision, 1);
 assert.equal(final.checklist.pendingOrderChanges[0].extra, 2);
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


test('decoration creates separate production variants and frozen revisions retain made quantities', () => {
 const source=b2bLetterOrder({letterLines:[
  {letter:'S',chocolate:'melk',size:'groot',style:'spuit',quantity:4,exceptions:[],withLogo:false},
  {letter:'S',chocolate:'melk',size:'groot',style:'spuit',quantity:3,exceptions:[],withLogo:false,decoration:'Blauwe balletjes'},
  {letter:'S',chocolate:'melk',size:'groot',style:'spuit',quantity:2,exceptions:[],withLogo:false,decoration:'Gouden balletjes'},
 ]});
 const combined=helper.combineProductionOrders([batch({rows:[]})],[],[source]);
 const rows=combined.batches[0].rows.filter(row=>row.orderSources?.b2b>0);
 assert.equal(rows.length,3);assert.equal(rows.reduce((sum,row)=>sum+row.orders,0),9);
 assert(rows.some(row=>row.key==='s|melk|groot|spuit'&&row.orders===4));
 const blue=rows.find(row=>row.label.includes('Blauwe balletjes'));
 assert(blue);assert.equal(blue.orders,3);assert(presentation.productionVariant(blue.label).extras.includes('decoratie: Blauwe balletjes'));
 const revised=helper.reviseProductionRows(rows.map(row=>({...row,produced:row.key===blue.key?3:0})),rows.filter(row=>row.key!==blue.key));
 assert.equal(revised.find(row=>row.key===blue.key).produced,3);
});

const recipient=(id,quantity,more={})=>({id,source:'b2b',customerName:id,quantity,date:'2099-12-03',...more});
const customerRow=(people,more={})=>row({orders:people.reduce((sum,p)=>sum+p.quantity,0),stock:0,orderSources:{b2b:people.reduce((sum,p)=>sum+p.quantity,0)},recipients:people,...more});
const extraDetails=(more={})=>({id:'extra-1',date:'2099-11-20',createdAt:'2099-11-17T08:00:00Z',createdBy:null,createdByName:'Test',...more});

test('additional lists consume only selected customer increases and retain the printed original',()=>{
 const original=[customerRow([recipient('A',10)],{produced:10})];
 const current=[customerRow([recipient('A',12),recipient('B',7)])];
 const savedOriginal=JSON.stringify(original);
 const extra=supplements.createProductionSupplement(original,[],current,['b2b:A'],extraDetails());
 assert.equal(extra.rows[0].orders,2);assert.equal(extra.rows[0].produced,0);
 assert.equal(extra.rows[0].recipients[0].id,'A');
 assert.equal(JSON.stringify(original),savedOriginal);
 const changes=supplements.productionCustomerChanges(supplements.combinedProductionRows(original,[extra]),current);
 assert.deepEqual(plain(changes.map(item=>[item.id,item.extra])),[['b2b:B',7]]);
 assert.throws(()=>supplements.createProductionSupplement(original,[extra],current,['b2b:A'],extraDetails()),/Kies klanten/);
 const second=supplements.createProductionSupplement(original,[extra],current,['b2b:B'],extraDetails({id:'extra-2',date:'2099-11-21'}));
 assert.equal(second.name,'Aanvulling 2');
 const combined=supplements.combinedProductionRows(original,[extra,second]);
 assert.equal(combined[0].orders,19);assert.equal(combined[0].produced,10);
 assert.equal(helper.productionChanges(combined,supplements.combinedProductionRows(current)).length,0);
});

test('reviewed cancellation keeps actual production and exposes surplus in its own additional run',()=>{
 const original=[customerRow([recipient('A',10)],{produced:10})];
 const extra={...extraDetails(),name:'Aanvulling 1',planRevision:1,rows:[customerRow([recipient('B',7)],{produced:7})]};
 const revised=supplements.reviseProductionAllocations(original,[extra],[customerRow([recipient('A',10),recipient('B',3)])]);
 assert.equal(revised.rows[0].orders,10);assert.equal(revised.rows[0].produced,10);
 assert.equal(revised.supplements[0].rows[0].orders,3);assert.equal(revised.supplements[0].rows[0].produced,7);
 assert.equal(helper.productionSurplus(revised.supplements[0].rows),4);
 assert.equal(helper.productionChanges(supplements.combinedProductionRows(revised.rows,revised.supplements),[customerRow([recipient('A',10),recipient('B',3)])]).length,0);
 const cancelled=supplements.reviseProductionAllocations(revised.rows,revised.supplements,[customerRow([recipient('A',10)])]);
 assert.equal(cancelled.supplements[0].rows[0].orders,0);assert.equal(cancelled.supplements[0].rows[0].produced,7);
});

test('date and customer validation reject stale choices, past dates and production after delivery',()=>{
 const current=[customerRow([recipient('A',3,{date:'2099-11-22'})])];
 const create=(ids,details)=>supplements.createProductionSupplement([],[],current,ids,extraDetails(details));
 assert.throws(()=>create(['b2b:missing'],{}),/Kies klanten/);
 assert.throws(()=>create(['b2b:A','b2b:A'],{}),/Kies klanten/);
 assert.throws(()=>create(['b2b:A'],{date:'2099-11-16'}),/geldige productiedag/);
 assert.throws(()=>create(['b2b:A'],{date:'2099-11-23'}),/uiterlijk op de leverdatum/);
 assert.throws(()=>create(['b2b:A'],{date:'2099-02-31'}),/geldige productiedag/);
});

test('missing historical customer allocations cannot be guessed for supplemental planning',()=>{
 const changes=supplements.productionCustomerChanges([row({orders:20,stock:0})],[customerRow([recipient('A',25)])]);
 assert.equal(changes.length,0);
});

test('combined recipient quantities support original customer readiness independently of later extras',()=>{
 const readiness=load('app/sinterklaas/letters/productie/productionReadiness.ts');
 const original=[customerRow([recipient('A',10)],{produced:10})];
 const extra={...extraDetails(),name:'Aanvulling 1',planRevision:1,rows:[customerRow([recipient('B',5)])]};
 const current=[customerRow([recipient('A',10),recipient('B',5)])];
 let ready=readiness.readyProductionRecipients([{id,rows:current}],[{batch_id:id,rows:original,locked_at:'now',supplements:[extra]}]);
 assert.equal(ready.has('A'),true);assert.equal(ready.has('B'),false);
 extra.rows[0].produced=5;
 ready=readiness.readyProductionRecipients([{id,rows:current}],[{batch_id:id,rows:original,locked_at:'now',supplements:[extra]}]);
 assert.equal(ready.has('B'),true);
});

test('supplement API uses a revision guard and cannot schedule the same increment twice',async()=>{
 const f=endpointFixture();
 const original=[customerRow([recipient('A',10)],{produced:10})];
 f.setSaved({...f.saved,rows:original});
 // Current recipient data is supplied through the existing B2B source adapter.
 const order=b2bLetterOrder({id:'new',customerName:'New',deliveryDate:'2026-11-06',letterLines:[{letter:'S',chocolate:'melk',size:'groot',style:'spuit',quantity:5,exceptions:[],withLogo:false}]});
 f.setCurrent(batch({rows:original,status:'IN_PRODUCTION'}));
 f.setWordPressOrders({letters:[],b2b:[order]});
 const view=(await (await f.api.GET(new Request('https://app.strik-patisserie.nl/api/sinterklaas-letter-production?season=2026'))).json()).batches[0];
 const payload={batchId:id,revision:1,action:'supplement',planVersion:view.checklist.planVersion,date:'2026-11-20',customerIds:['b2b:b2b:new']};
 // The delivery is already past. Server validation must reject before writing.
 const rejected=await f.api.POST(f.request(payload));assert.equal(rejected.status,400);assert.equal(f.writes.length,0);
 order.deliveryDate='2026-12-03';
 f.setWordPressOrders({letters:[],b2b:[order]});
 const fresh=(await (await f.api.GET(new Request('https://app.strik-patisserie.nl/api/sinterklaas-letter-production?season=2026'))).json()).batches[0];
 payload.planVersion=fresh.checklist.planVersion;
 payload.date=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Amsterdam'}).format(new Date());
 // Keep the date valid as time moves on, without writing real production data.
 order.deliveryDate='2099-12-03';
 f.setWordPressOrders({letters:[],b2b:[order]});
 const latest=(await (await f.api.GET(new Request('https://app.strik-patisserie.nl/api/sinterklaas-letter-production?season=2026'))).json()).batches[0];
 payload.planVersion=latest.checklist.planVersion;
 const response=await f.api.POST(f.request(payload));assert.equal(response.status,200,await response.clone().text());
 assert.equal(f.saved.supplements.length,1);assert.equal(f.saved.rows[0].produced,10);
 assert.equal(f.saved.supplements[0].rows[0].orders,5);assert.equal(f.saved.plan_revision,1);
 assert.equal((await f.api.POST(f.request(payload))).status,409);
 const quantity=await f.api.POST(f.request({batchId:id,revision:2,action:'quantity',supplementId:f.saved.supplements[0].id,key:row().key,quantity:3}));
 assert.equal(quantity.status,200);assert.equal(f.saved.supplements[0].rows[0].produced,3);assert.equal(f.saved.rows[0].produced,10);
 const updatedView=(await (await f.api.GET(new Request('https://app.strik-patisserie.nl/api/sinterklaas-letter-production?season=2026'))).json()).batches[0];
 const duplicate=await f.api.POST(f.request({...payload,revision:3,planVersion:updatedView.checklist.planVersion}));
 assert.equal(duplicate.status,400);assert.equal(f.saved.supplements.length,1);
});


test('same-date extra lists combine demand and actual production without mixing variants or other dates',()=>{
 const first={...extraDetails(),name:'Aanvulling 1',planRevision:2,rows:[customerRow([recipient('A',4)],{produced:3}),customerRow([recipient('A',2)],{key:row().key+'|logo',label:row().label+' · logo',produced:1})]};
 const second={...extraDetails({id:'extra-2'}),name:'Aanvulling 2',planRevision:1,rows:[customerRow([recipient('A',2),recipient('B',6)],{produced:4}),customerRow([recipient('B',3)],{key:row().key+'|decoratie:blauw',label:row().label+' · decoratie: blauw',produced:2})]};
 const other={...extraDetails({id:'extra-3',date:'2099-11-21'}),name:'Aanvulling 3',planRevision:1,rows:[customerRow([recipient('C',5)])]};
 const before=JSON.stringify([first,second,other]);
 const merged=supplements.mergeProductionSupplementsByDate([first,second,other]);
 assert.equal(merged.length,2);assert.equal(merged[0].id,first.id);assert.equal(merged[0].createdAt,first.createdAt);assert.equal(merged[0].planRevision,3);
 assert.equal(merged[0].rows.length,3);assert.equal(merged[0].rows.reduce((sum,r)=>sum+r.orders,0),17);
 const common=merged[0].rows.find(r=>r.key===row().key);
 assert.equal(common.orders,12);assert.equal(common.produced,7);assert.equal(common.orderSources.b2b,12);
 assert.deepEqual(plain(common.recipients.map(r=>[r.id,r.quantity])),[['A',6],['B',6]]);
 assert.equal(merged[0].rows.find(r=>r.key.endsWith('|logo')).produced,1);
 assert.equal(merged[0].rows.find(r=>r.key.endsWith('|decoratie:blauw')).produced,2);
 assert.equal(merged[1],other);assert.equal(JSON.stringify([first,second,other]),before);
 assert.deepEqual(plain(merged[0].mergedLists),plain([first,second]));
 assert.deepEqual(plain(supplements.mergeProductionSupplementsByDate(merged)),plain(merged),'normalizing twice never doubles the quantities or history');
 const third={...extraDetails({id:'extra-4'}),name:'Aanvulling 4',planRevision:1,rows:[customerRow([recipient('D',2)])]};
 const again=supplements.mergeProductionSupplementsByDate([...merged,third]);
 assert.equal(again[0].rows.find(r=>r.key===row().key).orders,14);assert.equal(again[0].rows.find(r=>r.key===row().key).produced,7);
 assert.deepEqual(plain(again[0].mergedLists.map(item=>item.id)),['extra-1','extra-2','extra-4']);
});

test('legacy same-date lists are read as one run and quantity changes preserve the printed main round',async()=>{
 const f=endpointFixture();
 const original=[customerRow([recipient('A',10)],{produced:10})];
 const first={...extraDetails(),name:'Aanvulling 1',planRevision:1,rows:[customerRow([recipient('B',4)],{produced:2})]};
 const second={...extraDetails({id:'extra-2'}),name:'Aanvulling 2',planRevision:1,rows:[customerRow([recipient('C',6)],{produced:3})]};
 f.setSaved({...f.saved,rows:original,supplements:[first,second]});
 f.setCurrent(batch({rows:[customerRow([recipient('A',10),recipient('B',4),recipient('C',6)])],status:'IN_PRODUCTION'}));
 const get=()=>f.api.GET(new Request('https://app.strik-patisserie.nl/api/sinterklaas-letter-production?season=2026'));
 const view=(await (await get()).json()).batches[0];
 assert.equal(view.checklist.supplements.length,1);assert.equal(view.checklist.supplements[0].rows[0].orders,10);assert.equal(view.checklist.supplements[0].rows[0].produced,5);
 assert.equal(view.checklist.changes.length,0);assert.equal(view.checklist.orderChanges.length,0);
 assert.equal(f.writes.length,0,'reading legacy duplicates does not rewrite production');assert.equal(f.saved.supplements.length,2);
 const response=await f.api.POST(f.request({batchId:id,revision:1,action:'quantity',supplementId:first.id,key:row().key,quantity:8}));
 assert.equal(response.status,200);assert.equal(f.saved.supplements.length,1);assert.equal(f.saved.supplements[0].rows[0].produced,8);assert.equal(f.saved.supplements[0].rows[0].orders,10);
 assert.deepEqual(plain(f.saved.rows),plain(original));assert.equal(f.saved.plan_revision,1);
 assert.equal((await f.api.POST(f.request({batchId:id,revision:1,action:'quantity',supplementId:first.id,key:row().key,quantity:9}))).status,409);
});

test('adding another customer on the same date reuses the extra list and retains already-made quantities',async()=>{
 const f=endpointFixture();
 const original=[customerRow([recipient('A',10)],{produced:10})];
 f.setSaved({...f.saved,rows:original});f.setCurrent(batch({rows:original,status:'IN_PRODUCTION'}));
 const order=(id,quantity)=>b2bLetterOrder({id,customerName:id,deliveryDate:'2099-12-03',letterLines:[{letter:'S',chocolate:'melk',size:'groot',style:'spuit',quantity,exceptions:[],withLogo:false}]});
 const b=order('B',5),c=order('C',7);
 f.setWordPressOrders({letters:[],b2b:[b]});
 const get=async()=> (await (await f.api.GET(new Request('https://app.strik-patisserie.nl/api/sinterklaas-letter-production?season=2026'))).json()).batches[0];
 const date=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Amsterdam'}).format(new Date());
 let view=await get();
 const first=await f.api.POST(f.request({batchId:id,revision:1,action:'supplement',planVersion:view.checklist.planVersion,date,customerIds:['b2b:b2b:B']}));
 assert.equal(first.status,200,await first.clone().text());
 const extraId=f.saved.supplements[0].id;
 assert.equal((await f.api.POST(f.request({batchId:id,revision:2,action:'quantity',supplementId:extraId,key:row().key,quantity:3}))).status,200);
 f.setWordPressOrders({letters:[],b2b:[b,c]});view=await get();
 const addition={batchId:id,revision:3,action:'supplement',planVersion:view.checklist.planVersion,date,customerIds:['b2b:b2b:C']};
 const added=await f.api.POST(f.request(addition));assert.equal(added.status,200,await added.clone().text());
 assert.equal(f.saved.supplements.length,1);assert.equal(f.saved.supplements[0].id,extraId);assert.equal(f.saved.supplements[0].rows[0].orders,12);assert.equal(f.saved.supplements[0].rows[0].produced,3);
 assert.deepEqual(plain(f.saved.rows),plain(original));assert.equal(f.saved.supplements[0].mergedLists.length,2);assert.equal(f.saved.plan_revision,1);
 assert.equal((await f.api.POST(f.request(addition))).status,409);
 view=await get();assert.equal(view.checklist.orderChanges.length,0);
 const duplicate=await f.api.POST(f.request({...addition,revision:4,planVersion:view.checklist.planVersion}));
 assert.equal(duplicate.status,400);assert.equal(f.saved.supplements[0].rows[0].orders,12);
});


test('frozen customer assignments survive new rounds and fulfillment without hiding real edits', () => {
 const old = batch({rows: []});
 const order = b2bLetterOrder({deliveryDate: '2026-11-25'});
 const before = helper.combineProductionOrders([old], [], [order]).batches[0].rows;
 const history = [{batch_id: old.id, locked_at: '2026-11-01T20:00:00Z', rows: before}];
 const newer = batch({id: 'new-round', date: '2026-11-24', startDate: '2026-11-23', rows: [], status: 'CLOSED', minimumLeadDays: 0});
 for (const flags of [{}, {productionDone: true}, {packed: true}, {delivered: true}, {productionDone:true,packed:true,delivered:true}]) {
  const result = helper.combineProductionOrders([old,newer], [], [{...order,...flags}], [], history);
  assert.equal(helper.productionChanges(before,result.batches[0].rows).length,0);
  assert.equal(result.batches[1].rows.length,0);
 }
 const edited = {...order,delivered:true,letterLines:[{...order.letterLines[0],quantity:25}]};
 const changed = helper.combineProductionOrders([old,newer], [], [edited], [], history);
 assert.deepEqual(plain(helper.productionChanges(before,changed.batches[0].rows)).map(c=>[c.before,c.after]),[[20,25]]);
 const cancelled=helper.combineProductionOrders([old,newer],[],[{...order,cancelled:true}],[],history);
 assert.equal(cancelled.batches[0].rows.length,0);
 const reassigned=helper.combineProductionOrders([old,newer],[],[order],[{order_id:order.id,batch_id:newer.id,season:2026,revision:1}],history);
 assert.equal(reassigned.batches[0].rows.length,0); assert.equal(reassigned.batches[1].rows[0].orders,20);
 const explicit=helper.combineProductionOrders([old,newer],[],[{...order,productionDate:newer.startDate}],[],history);
 assert.equal(explicit.batches[1].rows[0].orders,20);
 const provisional=helper.combineProductionOrders([old,newer],[],[order],[],[{...history[0],locked_at:null}]);
 assert.equal(provisional.batches[1].rows[0].orders,20);
});

test('shop and supplementary recipients keep their frozen production round', () => {
 const old=batch({rows:[]});
 const order={id:'shop-history',code:'CL26-test',customerName:'Test',status:'besteld',source:'online',pickupDate:'2026-11-25',lines:[{letter:'S',chocolate:'melk',size:'klein',style:'spuit',quantity:3,notes:'',specialRequests:[]}]};
 const before=helper.combineProductionOrders([old],[order],[]).batches[0].rows;
 const newer=batch({id:'new-round',date:'2026-11-24',startDate:'2026-11-23',minimumLeadDays:0,rows:[]});
 const history=[{batch_id:old.id,locked_at:'2026-11-01',rows:[],supplements:[{rows:before}]}];
 const result=helper.combineProductionOrders([old,newer],[{...order,status:'opgehaald',productionDone:true}],[],[],history);
 assert.equal(result.batches[0].rows[0].orders,3); assert.equal(result.batches[1].rows.length,0);
});


test('revising extra production counts shop stock once, alongside customer orders',()=>{
 const stock=recipient('stock:ZIEK',4,{source:'voorraad',customerName:'Winkelvoorraad'});
 const original=[customerRow([recipient('A',10),stock],{orders:10,stock:4,orderSources:{b2b:10},produced:9})];
 const extra={...extraDetails(),name:'Aanvulling 1',planRevision:1,rows:[customerRow([recipient('B',3)],{produced:2})]};
 const current=[customerRow([recipient('A',10),recipient('B',3),stock],{orders:13,stock:4,orderSources:{b2b:13}})];
 const revised=supplements.reviseProductionAllocations(original,[extra],current);
 assert.equal(revised.rows[0].orders,10);assert.equal(revised.rows[0].stock,4);assert.equal(revised.rows[0].produced,9);
 assert.deepEqual(plain(revised.rows[0].orderSources),{b2b:10});
 assert.equal(revised.supplements[0].rows[0].orders,3);assert.equal(revised.supplements[0].rows[0].produced,2);
 const combined=supplements.combinedProductionRows(revised.rows,revised.supplements);
 assert.equal(combined[0].orders+combined[0].stock,17);
 assert.equal(helper.productionChanges(combined,current).length,0);
 const twice=supplements.reviseProductionAllocations(revised.rows,revised.supplements,current);
 assert.deepEqual(plain(twice.rows),plain(revised.rows),'repeated review never duplicates shop stock');
});

test('stock recipients do not hide genuinely unattributed customer quantities',()=>{
 const stock=recipient('stock:LENT',5,{source:'voorraad',customerName:'Winkelvoorraad'});
 const original=[customerRow([recipient('A',10),stock],{orders:13,stock:5,orderSources:{b2b:10,onbekend:3},produced:8})];
 const extra={...extraDetails(),name:'Aanvulling 1',planRevision:1,rows:[customerRow([recipient('B',2)])]};
 const current=[customerRow([recipient('A',10),recipient('B',2),stock],{orders:15,stock:5,orderSources:{b2b:12,onbekend:3}})];
 const revised=supplements.reviseProductionAllocations(original,[extra],current);
 const combined=supplements.combinedProductionRows(revised.rows,revised.supplements);
 assert.equal(combined[0].orders,15);assert.equal(combined[0].stock,5);assert.equal(combined[0].produced,8);
 assert.equal(combined[0].orderSources.onbekend,3);
 assert.equal(helper.productionChanges(combined,current).length,0);
});


test('Doornik pickup and source disappearance never undo a frozen production day', async () => {
 for (const source of ['winkel', 'online']) {
  const f=endpointFixture({existing:false});
  f.setCurrent(batch({status:'IN_PRODUCTION',rows:[]}));
  const order={id:'doornik',code:'CL26-010',customerName:'Doornik',source,status:'besteld',pickupDate:'2026-11-06',lines:['J','L','F','P','R'].map(letter=>({letter,chocolate:'melk',size:'klein',style:'spuit',quantity:1,logo:false,notes:'',specialRequests:[]}))};
  order.lines.push({...order.lines[1],chocolate:'puur'});
  f.setWordPressOrders({letters:[order],b2b:[]});
  const get=async()=> (await (await f.api.GET(new Request('https://app.strik-patisserie.nl/api/sinterklaas-letter-production'))).json()).batches[0];
  const initial=await get();
  assert.equal(helper.productionTotals(initial.rows).orders,6);
  for (const item of initial.rows) assert.equal((await f.api.POST(f.request({batchId:id,revision:f.saved.revision,action:'quantity',key:item.key,quantity:1}))).status,200);
  const saved=plain(f.saved), writes=f.writes.length;
  for (const letters of [[{...order,status:'opgehaald',pickedUp:true}],[]]) {
   f.setWordPressOrders({letters,b2b:[]});
   const next=await get();
   assert.deepEqual(plain(next.rows),saved.rows);
   assert.equal(helper.productionTotals(next.rows).produced,6);
   assert.equal(next.checklist.changes.length,0);
   assert.equal(next.checklist.orderChanges.length,0);
   assert.equal(next.checklist.pendingOrderChanges.length,0);
   assert.equal(f.writes.length,writes);
   assert.deepEqual(plain(f.saved),saved);
  }
 }
});

test('the extra-demand queue excludes fulfilment, reductions and metadata-only changes', () => {
 const saved=[customerRow([recipient('A',10),recipient('B',4)])];
 const current=[customerRow([recipient('A',7,{customerName:'Updated name'}),recipient('C',3)])];
 const changes=plain(supplements.pendingProductionOrders(saved,current));
 assert.equal(changes.length,1);assert.equal(changes[0].id,'b2b:C');assert.equal(changes[0].extra,3);
 const extra={...extraDetails(),name:'Extra',planRevision:1,rows:[customerRow([recipient('C',3)])]};
 assert.equal(supplements.pendingProductionOrders(supplements.combinedProductionRows(saved,[extra]),current).length,0);
 assert.equal(supplements.pendingProductionOrders(saved,[customerRow([recipient('A',10,{customerName:'Updated name'}),recipient('B',4)])]).length,0);
});
