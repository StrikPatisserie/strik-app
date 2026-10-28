const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),crypto=require('node:crypto');
function load(file,imports={},extra=''){
 const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText+extra,{exports,require:name=>{if(!(name in imports))throw Error(`Unmocked ${name}`);return imports[name];},Response,Request,URL,Buffer,Date,Intl,structuredClone,AbortSignal});return exports;
}
const access=load('app/lib/auth/access.ts'),planning=load('app/productie/planning.ts');
const workspace=load('app/productie/workspaceData.ts',{'./planning':planning});
const rights=load('app/productie/access.ts',{'../lib/auth/access':access,'./planning':planning});
const migration=load('app/productie/recipeMigration.ts');
class StoreError extends Error{constructor(message,status=503){super(message);this.status=status;}}
const manager={id:'manager',role:'manager',active:true,permissions:{}},bakery={id:'baker',role:'bakkerij',active:true,permissions:{'bakkerij.patisserie':true}};
function fixture(){return {ingredients:[{id:'flour',name:'Fictieve bloem',recipeUnit:'gram',supplier:'Test',lastPrice:999,allergens:[]}],recipes:[{id:'r1',name:'Testrecept',type:'finalProduct',standardBatchQuantity:10,standardBatchUnit:'stuk',productGroup:'Gebak',ingredients:[{ingredientId:'flour',quantity:100,unit:'gram',costContribution:123}],semiFinishedItems:[],preparationSteps:['Testinstructie'],allergens:[],costPrice:888,salesPrice:999}],invoiceImports:[],manualProductionPlanningItems:[],allergenLists:[]};}
function plannerFixture(){const state=workspace.seedWorkspace(fixture());state.tasks.push({id:'task1',itemId:'recipe:r1',departmentId:'dessert',date:'2026-10-28',quantity:10,operation:'Maken',status:'planned',source:'manual',batchId:'batch1',recordsOutput:true,note:''});return state;}
function route(profile,options={}){
 const store={recipes:{data:fixture(),revision:4,updated_at:'2026-10-28T09:00:00Z'},planner:{data:plannerFixture(),revision:2,updated_at:'2026-10-28T09:00:00Z'}};let writes=0,reads=0;
 const docs={ProductionStoreError:StoreError,readDocument:async key=>{reads++;if(options.failRead)throw new StoreError('storage-down');return store[key];},saveDocument:async(key,revision,data)=>{if(options.conflict)throw new StoreError('conflict',409);assert.equal(revision,store[key].revision);writes++;store[key]={...store[key],data,revision:revision+1};return revision+1;}};
 const api=load('app/api/productie/route.ts',{'@/app/lib/auth/session':{getCurrentProfile:async()=>profile},'@/app/lib/auth/access':access,'@/app/productie/access':rights,'@/app/productie/documents.server':docs,'@/app/productie/workspaceData':workspace,'@/app/productie/planning':planning});
 return {api,store,counts:()=>({writes,reads})};
}
function put(state,revision=2){return new Request('https://app.example.invalid/api/productie',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({state,revision})});}
test('production API rejects anonymous, store-only and inactive accounts before reading documents',async()=>{
 for(const profile of [null,{...manager,active:false},{id:'shop',role:'winkel',active:true,permissions:{}}]){const r=route(profile);assert.equal((await r.api.GET()).status,403);assert.equal((await r.api.PUT(put(plannerFixture()))).status,403);assert.equal(r.counts().reads,0);}
});
test('live workspace exposes operational recipes without invoice prices, costs or fake stock',async()=>{
 const r=route(manager),response=await r.api.GET(),data=await response.json();assert.equal(response.status,200);assert.match(response.headers.get('Cache-Control'),/no-store/);
 assert.equal(data.state.items[0].stockKnown,false);assert.equal(data.state.items[0].departmentUnconfirmed,true);assert.equal(data.recipes[0].yield,10);
 const text=JSON.stringify(data);for(const secret of ['lastPrice','costPrice','costContribution','salesPrice','invoiceImports'])assert(!text.includes(secret));
});
test('a baker can finish own department tasks, while changing other fields, other departments or catalog is rejected',async()=>{
 let r=route(bakery),state=structuredClone(r.store.planner.data);state.tasks[0].status='done';assert.equal((await r.api.PUT(put(state))).status,200);assert.equal(r.counts().writes,1);
 for(const change of [s=>{s.items[0].name='Changed';},s=>{s.tasks[0].quantity=999;},s=>{s.tasks=[];}]){r=route(bakery);state=structuredClone(r.store.planner.data);change(state);assert.equal((await r.api.PUT(put(state))).status,403);assert.equal(r.counts().writes,0);}
 r=route(bakery);r.store.planner.data.tasks[0].departmentId='ijs';state=structuredClone(r.store.planner.data);state.tasks[0].status='done';assert.equal((await r.api.PUT(put(state))).status,403);
});
test('stale revisions, storage outages and duplicate output cannot overwrite the last shared state',async()=>{
 let r=route(manager);assert.equal((await r.api.PUT(put(r.store.planner.data,1))).status,409);assert.equal(r.counts().writes,0);
 r=route(manager,{failRead:true});assert.equal((await r.api.GET()).status,503);
 r=route(manager);const state=structuredClone(r.store.planner.data);state.tasks.push({...state.tasks[0],id:'duplicate'});assert.equal((await r.api.PUT(put(state))).status,400);assert.equal(r.counts().writes,0);
});
test('managers can remove planned tasks and restore originals while recovery records cannot be erased or rewritten',async()=>{
 const r=route(manager),original=structuredClone(r.store.planner.data.tasks[0]);
 let response=await r.api.PUT(put({...r.store.planner.data,tasks:[],removedTasks:[]}));
 assert.equal(response.status,200);let data=await response.json();
 assert.equal(data.state.tasks.length,0);assert.deepEqual(data.state.removedTasks[0].task,original);assert.equal(data.state.removedTasks[0].removedBy,manager.id);
 response=await r.api.PUT(put({...data.state,removedTasks:[]},3));assert.equal(response.status,200);data=await response.json();assert.equal(data.state.removedTasks.length,1);
 response=await r.api.PUT(put({...data.state,tasks:[{...original,quantity:999}]},4));assert.equal(response.status,400);
 response=await r.api.PUT(put({...data.state,tasks:[original]},4));assert.equal(response.status,200);data=await response.json();assert.equal(data.state.tasks[0].id,original.id);assert.equal(data.state.removedTasks.length,0);
});
test('started, completed and dependency-linked tasks cannot disappear from a bulk update',async()=>{
 for(const status of ['active','done','blocked']){const r=route(manager);r.store.planner.data.tasks[0].status=status;assert.equal((await r.api.PUT(put({...r.store.planner.data,tasks:[]}))).status,400);assert.equal(r.counts().writes,0);}
 const r=route(manager),state=r.store.planner.data;state.tasks.push({...state.tasks[0],id:'next',dependsOn:'task1',recordsOutput:false});
 assert.equal((await r.api.PUT(put({...state,tasks:state.tasks.filter(t=>t.id!=='task1')}))).status,400);assert.equal(r.counts().writes,0);
});
test('an existing recipe without known yield keeps unscaled quantities and unknown department/stock explicit',()=>{
 const data=fixture();delete data.recipes[0].standardBatchQuantity;const views=workspace.recipeViews(data);assert.equal(views[0].yield,0);assert.equal(views[0].ingredients[0].quantity,100);
 const state=workspace.seedWorkspace(data);assert(workspace.validWorkspace(state,views));assert.equal(state.items[0].stockKnown,false);
 const renamed=structuredClone(data);renamed.recipes[0].name='Nieuwe naam';const next=workspace.syncRecipeCatalog(state,renamed);assert.equal(next.items[0].id,state.items[0].id);assert.equal(next.items[0].name,'Nieuwe naam');
});
test('source transfer validates, locks, compares, preserves full snapshot, commits once and then retires WordPress',async()=>{
 const source={data:fixture(),allergenLists:[],locked:true,retired:false};let active=null;const calls=[];
 const api=load('app/api/productie/transfer/route.ts',{'node:crypto':crypto,'@/app/lib/auth/session':{getCurrentProfile:async()=>manager},'@/app/lib/auth/access':access,'@/app/productie/documents.server':{ProductionStoreError:StoreError,readDocument:async()=>active,importWordPressDocument:async input=>{calls.push('commit');assert.equal(JSON.stringify(input.snapshot),JSON.stringify(source));active={data:input.data,revision:1};}},'@/app/productie/wordpress.server':{wordpressTransfer:async action=>{calls.push(action);return structuredClone(source);}},'@/app/productie/media.server':{copyWordPressImages:async data=>({data,images:0})},'@/app/productie/recipeMigration':migration,'@/app/productie/workspaceData':workspace});
 const req=()=>new Request('https://app.example.invalid/api/productie/transfer',{method:'POST',body:JSON.stringify({action:'migrate'})});
 const response=await api.POST(req());assert.equal(response.status,200);assert.equal((await response.json()).verified,true);assert.deepEqual(calls,['lock','snapshot','commit','retire']);
 const repeat=await api.POST(req());assert.equal((await repeat.json()).alreadyImported,true);assert.equal(calls.filter(c=>c==='commit').length,1);
});
test('source changes during export stop cutover and unlock WordPress without importing partial data',async()=>{
 const source={data:fixture(),allergenLists:[],locked:true,retired:false};let imports=0;const calls=[];
 const api=load('app/api/productie/transfer/route.ts',{'node:crypto':crypto,'@/app/lib/auth/session':{getCurrentProfile:async()=>manager},'@/app/lib/auth/access':access,'@/app/productie/documents.server':{ProductionStoreError:StoreError,readDocument:async()=>null,importWordPressDocument:async()=>{imports++;}},'@/app/productie/wordpress.server':{wordpressTransfer:async action=>{calls.push(action);const result=structuredClone(source);if(action==='snapshot')result.data.recipes[0].name='Concurrent change';return result;}},'@/app/productie/media.server':{copyWordPressImages:async data=>({data,images:0})},'@/app/productie/recipeMigration':migration,'@/app/productie/workspaceData':workspace});
 const response=await api.POST(new Request('https://app.example.invalid/api/productie/transfer',{method:'POST',body:JSON.stringify({action:'migrate'})}));assert.equal(response.status,409);assert.equal(imports,0);assert.deepEqual(calls,['lock','snapshot','unlock']);
});
test('recipe save preserves financial and invoice history for production accounts and protects missing revisions',async()=>{
 const projections=load('app/bakkerij/recepturen/recipeAccess.ts');let calls=0;
 const store=load('app/productie/recipeStore.server.ts',{'server-only':{},'../bakkerij/recepturen/recipeAccess':projections,'../lib/auth/access':access,'./documents.server':{ProductionStoreError:StoreError,saveDocument:async()=>{calls++;return 5;},readDocument:async()=>null}});
 const current=fixture();current.invoiceImports=[{id:'history',lines:[{totalPrice:123}]}];const incoming=projections.recipeDataForProduction(current);incoming.recipes[0].costPrice=0;incoming.storageRevision=4;
 const merged=store.mergeRecipeSave(current,incoming,bakery);assert.equal(merged.recipes[0].costPrice,888);assert.equal(merged.invoiceImports.length,1);
 await assert.rejects(store.saveSharedRecipes({data:current,revision:4},{...incoming,storageRevision:undefined},manager),/verouderd/);assert.equal(calls,0);
});
test('image downloads are private and unavailable to anonymous users',async()=>{
 let reads=0;const api=load('app/api/recepturen/media/[id]/route.ts',{'@/app/lib/auth/session':{getCurrentProfile:async()=>null},'@/app/productie/access':rights,'@/app/productie/media.server':{readProductionImage:async()=>{reads++;return null;}}});
 assert.equal((await api.GET(new Request('https://example.invalid'),{params:Promise.resolve({id:'a'.repeat(64)})})).status,403);assert.equal(reads,0);
});
test('a legacy recipe with a missing ingredient stays visible but cannot generate or finish production tasks',async()=>{
 const r=route(manager);r.store.recipes.data.recipes[0].ingredients[0].ingredientId='missing';
 const response=await r.api.GET(),data=await response.json();assert.equal(data.recipes[0].reviewRequired,true);assert.equal(data.state.items[0].productionBlocked,true);
 const incoming=structuredClone(data.state);incoming.items[0].productionBlocked=false;incoming.tasks[0].status='done';
 assert.equal((await r.api.PUT(put(incoming))).status,400);assert.equal(r.counts().writes,0);
 assert.throws(()=>planning.addTask(data.state,{...data.state.tasks[0],id:'new',batchId:'new'}),/ontbrekende/);
});


test('production resource routes enforce management and HACCP department access before rendering',async()=>{
 const jsx=require('react/jsx-runtime');
 const nav=load('app/productie/navigation.ts',{'./planning':planning});
 const common={
  'react/jsx-runtime':jsx,'next/link':{default:'a'},'next/navigation':{notFound:()=>{throw Error('not-found');}},
  '@/app/lib/auth/access':access,'@/app/productie/access':rights,
  '@/app/productie/ProductionResourceFrame':{default:'production-frame'},
  '@/app/preview/productie/production.module.css':{default:{}},
 };
 const ice={...bakery,permissions:{'bakkerij.ijs_chocolade':true}};
 for(const who of [manager,bakery,ice]){
  const auth={'@/app/lib/auth/session':{requireCurrentProfile:async()=>who}};
  const data=load('app/bakkerij/productie/beheer/[section]/page.tsx',{
   ...common,...auth,'@/app/productie/navigation':nav,'@/app/bakkerij/recepturen/RecepturenApp':{default:'recipe-editor'},
  });
  const open=()=>data.default({params:Promise.resolve({section:'verpakkingen'})});
  if(who===manager)assert.equal((await open()).props.canManage,true);
  else await assert.rejects(open(),/not-found/);
  const haccp=load('app/bakkerij/productie/haccp/[department]/layout.tsx',{...common,...auth});
  const own=who===ice?'ijs':'bakkerij';
  const page=await haccp.default({params:Promise.resolve({department:own}),children:'registration'});
  assert.equal(page.props.active,'haccp');
  assert.equal(page.props.children[1],'registration');
  if(who!==manager)await assert.rejects(haccp.default({params:Promise.resolve({department:own==='ijs'?'bakkerij':'ijs'}),children:'registration'}),/not-found/);
  await assert.rejects(haccp.default({params:Promise.resolve({department:'unknown'}),children:'registration'}),/not-found/);
 }
});
