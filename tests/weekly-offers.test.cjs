const {productionConcurrencyImports}=require('./helpers/production-concurrency.cjs');
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function load(file,imports={},globals={}){imports={...productionConcurrencyImports(imports),...imports};const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,Date,JSON,URL,Response,Request,File,Buffer,process,console,...globals,require:name=>imports[name]||{}});return exports;}
const access=load('app/lib/auth/access.ts');
const rights=load('app/lib/auth/weeklyOffers.ts',{'./access':access});
const owner={id:'owner',email:'feline@strik-patisserie.nl',active:true,role:'admin'};
const other={id:'other',email:'manager@strik-patisserie.nl',active:true,role:'manager'};
const original={ingredients:[],recipes:[],invoiceImports:[],bakeryHome:{notes:[],offers:[{id:'one',weekStart:'2026-11-09',imageUrl:'original'}]}};
class StoreError extends Error{constructor(message,status=503){super(message);this.status=status;}}
test('only active Feline management account can edit offers',()=>{
 for(const profile of [null,other,{...owner,active:false},{...owner,role:'winkel'}])assert.equal(rights.canManageWeeklyOffers(profile),false);
 assert.equal(rights.canManageWeeklyOffers(owner),true);assert.equal(rights.canManageWeeklyOffers({...owner,email:' Feline@Strik-Patisserie.nl '}),true);
});
test('shared recipe save rejects changed offers for other managers but preserves ordinary recipe edits',async()=>{
 let writes=0;
 const store=load('app/productie/recipeStore.server.ts',{'../lib/auth/weeklyOffers':rights,'../lib/auth/access':access,'./documents.server':{ProductionStoreError:StoreError,saveDocument:async()=>{writes++;return 2;}},'../bakkerij/recepturen/recipeAccess':{}});
 const current={data:original,revision:1};
 await assert.rejects(store.saveSharedRecipes(current,{...original,storageRevision:1,bakeryHome:{notes:[],offers:[]}},other),error=>error.status===403);assert.equal(writes,0);
 const saved=await store.saveSharedRecipes(current,{...original,storageRevision:1,recipes:[{id:'recipe'}]},other);assert.equal(saved.recipes.length,1);assert.equal(saved.bakeryHome.offers[0].imageUrl,'original');
 await store.saveSharedRecipes(current,{...original,storageRevision:1,bakeryHome:{notes:[],offers:[]}},owner);assert.equal(writes,2);
 await assert.rejects(store.saveSharedRecipes(current,{...original,storageRevision:0},owner),error=>error.status===409);
});
test('legacy storage also rejects offer changes, preserves offers for older clients and accepts Feline',async()=>{
 async function run(profile,incoming){let writes=0;const api=load('app/api/recepturen/route.ts',{
  'next/server':{NextResponse:{json:(body,init)=>Response.json(body,init)}},'@/app/lib/auth/session':{getCurrentProfile:async()=>profile},'@/app/lib/auth/access':{...access,canAccessBakkerijPatisserie:()=>true},'@/app/lib/auth/weeklyOffers':rights,
  '@/app/lib/recipeStorageAuth':{recipeStorageAuthHeaders:async()=>({})},'@/app/productie/documents.server':{ProductionStoreError:StoreError,readDocument:async()=>null},'../../bakkerij/recepturen/legacyHalfFabricates':{removeLegacyHalfFabricateIngredients:data=>data},
 },{fetch:async(url,options)=>{if(options.method==='PUT'){writes++;return Response.json(JSON.parse(options.body));}return Response.json(original);}});
 const response=await api.PUT(new Request('https://app.test/api/recepturen?force=1',{method:'PUT',body:JSON.stringify(incoming)}));return{response,writes};}
 let result=await run(other,{...original,bakeryHome:{notes:[],offers:[]}});assert.equal(result.response.status,403);assert.equal(result.writes,0);
 result=await run(other,{ingredients:[],recipes:[],invoiceImports:[]});assert.equal(result.response.status,200);assert.equal((await result.response.json()).bakeryHome.offers[0].imageUrl,'original');
 result=await run(owner,{...original,bakeryHome:{notes:[],offers:[]}});assert.equal(result.response.status,200);assert.equal(result.writes,1);
});
test('photo upload denies other accounts before reading a file or touching storage',async()=>{
 for(const profile of [null,other,{...owner,active:false}]){
  const api=load('app/api/recepturen/home-photo/route.ts',{'@/app/lib/auth/session':{getCurrentProfile:async()=>profile},'@/app/lib/auth/weeklyOffers':rights},{Response});
  assert.equal((await api.POST(new Request('https://app.test/api/recepturen/home-photo',{method:'POST'}))).status,403);
 }
});
test('photo loading hides images until loaded and resets on week identity; neighbors are prefetched',()=>{
 const source=fs.readFileSync('app/WelcomeHighlights.tsx','utf8');assert.match(source,/key=\{`\$\{selectedWeek\}:\$\{offer.imageUrl\}`\}/);assert.match(source,/new Image\(\)/);assert.match(source,/canEditOffers&&editingOffer/);
 const jsx=require('react/jsx-runtime');let states=[false,false],i=0;
 const component=load('app/WeekOfferImage.tsx',{'react':{useState:initial=>[states[i++]??initial,()=>{}]},'react/jsx-runtime':jsx});
 const render=()=>{i=0;return require('react-dom/server').renderToStaticMarkup(component.default({src:'/new-image',alt:'Nieuwe week'}));};
 let html=render();assert.match(html,/role="status"/);assert.match(html,/opacity-0/);assert.match(html,/Foto laden/);
 states=[true,false];html=render();assert.doesNotMatch(html,/Foto laden/);assert.match(html,/opacity-100/);
 states=[false,true];html=render();assert.match(html,/Foto kon niet geladen/);assert.doesNotMatch(html,/<img/);
});

test('home offers expose only offer fields, and unauthorized users do not trigger storage reads',async()=>{
 let reads=0;
 const server=load('app/weeklyOffers.server.ts',{'./productie/documents.server':{readDocument:async()=>{reads++;return{data:{...original,bakeryHome:{offers:[{...original.bakeryHome.offers[0],managerSecret:'hidden'}]},invoiceImports:[{cost:'secret'}]}};}}});
 const offers=await server.loadWeeklyOffers();assert.equal(offers[0].managerSecret,undefined);assert(!JSON.stringify(offers).includes('secret'));
 for(const profile of [null,{...owner,active:false}]){
  const api=load('app/api/weekly-offers/route.ts',{'@/app/lib/auth/session':{getCurrentProfile:async()=>profile},'@/app/weeklyOffers.server':{loadWeeklyOffers:async()=>{reads++;return offers;}}});
  const before=reads;assert.equal((await api.GET()).status,403);assert.equal(reads,before);
 }
 const api=load('app/api/weekly-offers/route.ts',{'@/app/lib/auth/session':{getCurrentProfile:async()=>({active:true,role:'winkel'})},'@/app/weeklyOffers.server':{loadWeeklyOffers:async()=>offers}});assert.equal((await api.GET()).status,200);
});
test('shop viewers may cache published offer images privately but cannot read unrelated recipe photos',async()=>{
 let reads=0;
 const api=load('app/api/recepturen/media/[id]/route.ts',{
  '@/app/lib/auth/session':{getCurrentProfile:async()=>({active:true,role:'winkel'})},'@/app/productie/access':{productionDepartments:()=>[]},
  '@/app/weeklyOffers.server':{loadWeeklyOffers:async()=>[{imageUrl:'/api/recepturen/media/offer'}]},
  '@/app/productie/media.server':{readProductionImage:async()=>{reads++;return{bytes:Buffer.from('image'),contentType:'image/png'};}},
 });
 let response=await api.GET(new Request('https://app.test/api/recepturen/media/other'),{params:Promise.resolve({id:'other'})});assert.equal(response.status,403);assert.equal(reads,0);
 response=await api.GET(new Request('https://app.test/api/recepturen/media/offer'),{params:Promise.resolve({id:'offer'})});assert.equal(response.status,200);assert.equal(reads,1);assert.match(response.headers.get('Cache-Control'),/^private, max-age=3600, immutable$/);assert.equal(response.headers.get('vary'),'Cookie');
});
