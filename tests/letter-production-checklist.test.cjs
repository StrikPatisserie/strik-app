const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, stubs={}) {
 const module={exports:{}};
 const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(code,{module,exports:module.exports,require(name){if(name in stubs)return stubs[name];if(name.startsWith('.'))return load(path.resolve(path.dirname(file),name)+'.ts',stubs);return require(name)},Response,Request,URL,Buffer,process:stubs.__process||process,AbortSignal});
 return module.exports;
}
const helper=load('app/sinterklaas/letters/productie/productionChecklist.ts');
const row=(more={})=>({key:'s|melk|groot|spuit',label:'S · melk · groot · spuit',orders:20,stock:8,produced:0,orderSources:{online:10,winkel:4,b2b:6},...more});
const id='d8c0af2e-a725-4ef0-a435-6b5f2838784a';
const batch=(more={})=>({id,startDate:'2026-11-02',date:'2026-11-03',deadlineAt:'2026-11-01T20:00:00+01:00',status:'OPEN',minimumLeadDays:2,storeOrders:[],rows:[row()],...more});
const plain=value=>JSON.parse(JSON.stringify(value));

test('checkmarks become available exactly at the Amsterdam deadline, never through printing',()=>{
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
 for(const q of [-1,29,1.5,NaN])assert.throws(()=>helper.setProductionQuantity(original,original[0].key,q));
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
test('all actual order channels are included, completed/cancelled orders excluded, and special variants stay separate',()=>{
 const base=batch({rows:[row({orders:2,stock:8,orderSources:{online:2}})]});
 const letter=(more={})=>({id:'1',code:'CL1',customerName:'Test',pickupDate:'2026-11-06',source:'winkel',status:'besteld',lines:[{letter:'S',chocolate:'melk',size:'groot',style:'spuit',quantity:3,logo:false,notes:'',specialRequests:[]}],...more});
 const b2b={id:'b',customerName:'Bedrijf',status:'akkoord',department:'banket',deliveryDate:'2026-11-06',productionDate:'',letterLines:[{letter:'S',chocolate:'melk',size:'groot',style:'spuit',quantity:5,exceptions:['notenvrij']}],logo:false};
 const result=helper.combineProductionOrders([base],[letter(),letter({productionDone:true}),letter({status:'geannuleerd'})],[b2b]);
 assert.equal(result.batches[0].rows.length,2);
 const regular=result.batches[0].rows.find(r=>r.key==='s|melk|groot|spuit');
 assert.equal(regular.orders,5);assert.equal(regular.stock,8);
 assert.deepEqual(plain(regular.orderSources),{online:2,winkel:3});
 assert.equal(result.batches[0].rows.find(r=>r.key.endsWith('notenvrij')).orderSources.b2b,5);
 assert.equal(base.rows[0].orders,2);
});

function endpointFixture({allowed=true,locked=true,existing=true,wpFailure=false,race=false,cron=false}={}) {
 let current=batch({status:locked?'IN_PRODUCTION':'OPEN',deadlineAt:locked?'2020-01-01T19:00:00Z':'2099-01-01T19:00:00Z'});
 let saved=existing?{batch_id:id,rows:[row()],revision:1,plan_revision:1,locked_at:'2020-01-01T19:00:00Z',updated_at:'2020-01-01T19:00:00Z'}:null;
 const writes=[];
 const db={from(table){let action='read',values,filters={};const q={select(){return q},eq(k,v){filters[k]=v;return q},in(){return q},maybeSingle(){return q},single(){return q},insert(v){action='insert';values=v;return q},update(v){action='update';values=v;return q},then(resolve){let data,error=null;
 if(table==='letter_production_batches')data={status:current.status,order_deadline_at:current.deadlineAt,season:2026};
 else if(table==='letter_production_checklists'){
  if(action==='insert'){writes.push({table,action,values});if(saved)error={code:'23505'};else saved={...values,revision:1,plan_revision:1,locked_at:'now',updated_at:'now'};}
  if(action==='update'){
   if(!race&&saved?.revision===filters.revision){saved={...saved,...values};writes.push({table,action,values});data=saved}else data=null;
  }else data=filters.batch_id?saved:saved?[saved]:[];
 }else throw Error('Unexpected write or table: '+table);
 return Promise.resolve({data,error}).then(resolve)}};return q;}};
 const api=load('app/api/sinterklaas-letter-production/route.ts',{
  '@/app/lib/auth/access':{canAccessSinterklaasPath:(_profile,p)=>allowed&&p==='/sinterklaas/letters/productie'},
  '@/app/lib/auth/cron':{hasCronAuthorization:()=>cron},
  '@/app/lib/auth/session':{getCurrentProfile:async()=>({id:null})},
  '@/app/lib/supabase/admin':{createAdminClient:()=>db},
  '@/app/sinterklaas/sinterklaasServerApi':{loadProductionWordPressOrders:async()=>{if(wpFailure)throw Error('Source unavailable');return{letters:[],b2b:[]}}},
  '@/app/sinterklaas/letters/productie/productionData.server':{loadCentralProduction:async()=>({batches:[current],centralUnplannedCount:0})},
  '@/app/sinterklaas/letters/productie/productionChecklist':helper,
 });
 const request=body=>new Request('https://app.strik-patisserie.nl/api/sinterklaas-letter-production',{method:'POST',headers:{'content-type':'application/json',origin:'https://app.strik-patisserie.nl'},body:JSON.stringify(body)});
 return {api,writes,request,get saved(){return saved},setCurrent(value){current=value}};
}
test('unauthorized or shop-only accounts cannot read or mark the global production list',async()=>{
 const f=endpointFixture({allowed:false});assert.equal((await f.api.GET(new Request('https://app.strik-patisserie.nl/api/sinterklaas-letter-production'))).status,403);
 assert.equal((await f.api.POST(f.request({}))).status,403);assert.equal(f.writes.length,0);
});
test('before deadline a list stays editable and cannot be marked produced',async()=>{
 const f=endpointFixture({locked:false,existing:false});
 const get=await f.api.GET(new Request('https://app.strik-patisserie.nl/api/sinterklaas-letter-production'));
 assert.equal(get.status,200);assert.equal((await get.json()).batches[0].checklist,undefined);
 assert.equal((await f.api.POST(f.request({batchId:id,revision:1,action:'quantity',key:row().key,quantity:28}))).status,409);
 assert.equal(f.writes.length,0);
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
