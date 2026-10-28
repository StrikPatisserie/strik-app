const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function load(file,imports={},globals={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:n=>{if(!(n in imports))throw Error(`Unmocked ${n}`);return imports[n];},Date,Intl,Error,Map,Set,URL,Request,Response,AbortSignal,...globals});return exports;}
const planning=load('app/productie/planning.ts'),data=load('app/bruidstaart-studio/data.ts'),pricing=load('app/bruidstaart-studio/pricing.ts',{'./data':data});
const wedding=load('app/productie/weddingPlanning.ts',{'./planning':planning,'../bruidstaart-studio/pricing':pricing}),workspace=load('app/productie/workspaceData.ts',{'./planning':planning});
const access=load('app/lib/auth/access.ts');
function draft(code='TEST-1',date='2026-10-31'){const config=structuredClone(data.initialWeddingCakeConfig);Object.assign(config,{completed:true,sizeId:data.cakeSizes[0].id,styleId:'klassiek',paymentRequestLinkId:'secret-link',paymentRequestAmount:999});Object.assign(config.contact,{names:'Fictief bruidspaar',deliveryDate:date,deliveryMethod:'delivery_far',deliveryTimeType:'range',deliveryTimeStart:'12:00',deliveryTimeEnd:'13:00',deliveryAddress:'Testlocatie',notes:'Zonder bloemen',invoiceEmail:'private@invalid.example'});config.additionalProducts=[{id:'extra',description:'Extra gebak',amount:123}];return{id:code,code,names:'Fictief bruidspaar',surname:'',config,createdAt:'2026-10-01',updatedAt:'2026-10-28'};}
const state=()=>({version:1,items:[],tasks:[]});
test('definitive bridal orders are deduplicated by code with their latest design and expose production details without finance',()=>{
 const old=draft(),latest=draft('test-1');latest.updatedAt='2026-10-29';latest.config.contact.notes='Laatste afspraak';const concept=draft('concept');concept.config.completed=false;
 const orders=wedding.weddingOrders([old,latest,concept]);assert.equal(orders.length,1);assert.equal(orders[0].lines.find(l=>l.label==='Opmerking klant').value,'Laatste afspraak');assert.equal(orders[0].lines.find(l=>l.label==='Overige producten').value,'Extra gebak');assert.match(orders[0].lines.find(l=>l.label==='Levering').value,/ver/i);
 const text=JSON.stringify(orders);for(const secret of ['secret-link','private@invalid.example','paymentRequestAmount','123'])assert(!text.includes(secret));
});
test('bridal production can be moved and completed once without changing the agreed delivery date or duplicating orders',()=>{
 const order=wedding.weddingOrders([draft()])[0];let next=wedding.scheduleWedding(state(),order,'2026-10-30','planned');
 next=wedding.scheduleWedding(next,order,'2026-10-29','active');next=wedding.scheduleWedding(next,order,'2026-10-29','done');next=wedding.scheduleWedding(next,order,'2026-10-29','done');
 assert.equal(next.tasks.length,1);assert.equal(next.items.length,1);assert.equal(next.tasks[0].date,'2026-10-29');assert.equal(next.tasks[0].dueDate,'2026-10-31');assert.equal(next.tasks[0].recordsOutput,false);assert(workspace.validWorkspace(next,[]));
 assert.throws(()=>wedding.scheduleWedding(next,order,'2026-11-01','planned'),/leverdatum/);
 const changed={...order,date:'2026-11-02'};assert.throws(()=>wedding.scheduleWedding(next,changed,'2026-10-29','done'),/al gestart/);
});
class StoreError extends Error{constructor(message,status=503){super(message);this.status=status;}}
const manager={id:'m',active:true,role:'manager',permissions:{}},baker={id:'b',active:true,role:'bakkerij',permissions:{'bakkerij.patisserie':true}};
function api(profile,fail=false){let doc={data:state(),revision:1},writes=0,fetches=0;const studio=load('app/bruidstaart-studio/studioApi.ts');const route=load('app/api/productie/weddings/route.ts',{'@/app/lib/auth/session':{getCurrentProfile:async()=>profile},'@/app/lib/auth/access':access,'@/app/productie/documents.server':{ProductionStoreError:StoreError,readDocument:async()=>doc,saveDocument:async(key,revision,next)=>{assert.equal(revision,doc.revision);writes++;doc={data:next,revision:revision+1};return revision+1;}},'@/app/bruidstaart-studio/studioApi':studio,'@/app/productie/weddingPlanning':wedding,'@/app/productie/planning':planning},{fetch:async()=>{fetches++;return fail?new Response('',{status:503}):Response.json({drafts:[draft(),draft()]});}});return{route,doc:()=>doc,writes:()=>writes,fetches:()=>fetches};}
function request(code='TEST-1',date='2026-10-31',status='planned',revision=1){return new Request('https://test.invalid/api/productie/weddings',{method:'POST',body:JSON.stringify({code,date,status,revision})});}
test('bridal API rejects unauthorized callers before fetching and never creates tasks while reading a week',async()=>{
 for(const profile of [null,{...manager,active:false},{...baker,permissions:{'bakkerij.ijs_chocolade':true}},{active:true,role:'winkel',permissions:{}}]){const a=api(profile);assert.equal((await a.route.GET(new Request('https://test.invalid?week=2026-10-26'))).status,403);assert.equal((await a.route.POST(request())).status,403);assert.equal(a.fetches(),0);assert.equal(a.writes(),0);}
 const a=api(baker),response=await a.route.GET(new Request('https://test.invalid?week=2026-10-26'));assert.equal(response.status,200);assert.equal((await response.json()).orders.length,1);assert.equal(a.writes(),0);
});
test('bridal API uses the canonical source, permits operational status changes and reserves date changes for managers',async()=>{
 const a=api(baker);assert.equal((await a.route.POST(request('TEST-1','2026-10-30'))).status,403);assert.equal(a.writes(),0);
 assert.equal((await a.route.POST(request('TEST-1','2026-10-31','done'))).status,200);assert.equal(a.doc().data.tasks.length,1);
 assert.equal((await a.route.POST(request('TEST-1','2026-10-31','done',2))).status,200);assert.equal(a.doc().data.tasks.length,1);
 assert.equal((await a.route.POST(request('TEST-1','2026-10-31','planned',1))).status,409);assert.equal(a.writes(),2);
 const m=api(manager);assert.equal((await m.route.POST(request('TEST-1','2026-10-30'))).status,200);assert.equal(m.doc().data.tasks[0].date,'2026-10-30');
 const f=api(manager,true);assert.equal((await f.route.GET(new Request('https://test.invalid?week=2026-10-26'))).status,503);assert.equal((await f.route.POST(request())).status,503);assert.equal(f.writes(),0);
});
