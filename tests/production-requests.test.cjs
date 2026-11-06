const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function load(file,imports={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:name=>{assert(name in imports,`Unmocked ${name}`);return imports[name];},Date,Intl,Set,Map,structuredClone,Request,Response,URL,crypto:require('node:crypto').webcrypto});return exports;}
const planning=load('app/productie/planning.ts'),recipe=load('app/productie/recipePlanning.ts',{'./planning':planning}),requests=load('app/productie/requestPlanning.ts',{'./planning':planning,'./recipePlanning':recipe}),access=load('app/lib/auth/access.ts'),rights=load('app/productie/access.ts',{'../lib/auth/access':access,'./planning':planning});
const state=()=>({version:1,items:[{id:'cake',name:'Testtaart',kind:'product',departmentId:'dessert',unit:'stuks',note:'',stock:0}],tasks:[]});
const now='2026-11-01T12:00:00.000Z',create={kind:'create',itemId:'cake',quantity:20,neededBy:'2026-11-06',note:'Voor de winkels'};
const apply=(s,c,id='request-1')=>requests.applyProductionRequest(s,[],c,'actor',now,id);
test('logistics requests do not create tasks or alter stock until a baker plans them',()=>{
 const initial=state(),next=apply(initial,create);assert.equal(next.tasks.length,0);assert.equal(next.items[0].stock,0);assert.equal(initial.productionRequests,undefined);assert(planning.validProductionRequests(next.productionRequests));assert.equal(next.productionRequests[0].createdBy,'actor');
 const planned=apply(next,{kind:'plan',id:'request-1',date:'2026-11-05',departmentId:'dessert'},'task-1');assert.equal(planned.tasks.length,1);assert.equal(planned.tasks[0].quantity,20);assert.equal(planned.tasks[0].dueDate,'2026-11-06');assert.equal(planned.productionRequests[0].plannedTaskId,'task-1');assert.equal(planned.items[0].stock,0);
 assert.throws(()=>apply(planned,{kind:'plan',id:'request-1',date:'2026-11-05',departmentId:'dessert'}),/al in de planning/);
 assert.throws(()=>apply(planned,{kind:'cancel',id:'request-1'}),/al in de planning/);
 const reopened={...planned,tasks:[]};assert.equal(apply(reopened,{kind:'plan',id:'request-1',date:'2026-11-06',departmentId:'dessert'},'task-2').tasks.length,1);
});
test('invalid quantities, missing products, blocked recipes, bad dates and late planning are rejected atomically',()=>{
 for(const changes of [{quantity:0},{quantity:-1},{quantity:Infinity},{quantity:1000001},{itemId:'unknown'},{note:'x'.repeat(2001)},{neededBy:'2026-02-30'}])assert.throws(()=>apply(state(),{...create,...changes}));
 const blocked=state();blocked.items[0].productionBlocked=true;assert.throws(()=>apply(blocked,create));
 const current=apply(state(),create),before=JSON.stringify(current);assert.throws(()=>apply(current,{kind:'plan',id:'request-1',date:'2026-11-07',departmentId:'dessert'}),/uiterlijk/);assert.equal(JSON.stringify(current),before);
 const cancelled=apply(current,{kind:'cancel',id:'request-1'});assert.equal(cancelled.productionRequests[0].cancelledAt,now);assert.throws(()=>apply(cancelled,{kind:'plan',id:'request-1',date:'2026-11-05',departmentId:'dessert'}));
});
class StoreError extends Error{constructor(message,status=503){super(message);this.status=status;}}
const manager={id:'manager',role:'manager',active:true,permissions:{}},logistics={id:'logistics',role:'logistiek',active:true,permissions:{}},baker={id:'baker',role:'bakkerij',active:true,permissions:{'bakkerij.patisserie':true}},shop={id:'shop',role:'winkel',active:true,permissions:{}};
function harness(profile,initial=state()){
 const saves=[];const workspace={recipeViews:()=>[],syncRecipeCatalog:s=>s,validWorkspace:()=>true};
 const route=load('app/api/productie/verzoeken/route.ts',{'@/app/lib/auth/session':{getCurrentProfile:async()=>profile},'@/app/lib/auth/access':access,'@/app/productie/access':rights,'@/app/productie/documents.server':{ProductionStoreError:StoreError,readDocument:async key=>({data:key==='planner'?initial:{},revision:3}),saveDocument:async(...args)=>{saves.push(args);return 4;},saveRecipePlanDocument:async(...args)=>{saves.push(args);return 4;}},'@/app/productie/workspaceData':workspace,'@/app/productie/productionRequests':requests,'@/app/productie/requestPlanning':requests});
 return {route,saves};
}
function post(command,revision=3,origin='https://app.invalid'){return new Request('https://app.invalid/api/productie/verzoeken',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({revision,command})});}
test('only logistics/management create; bakers plan only in their allowed departments; shops and cross-origin calls are rejected',async()=>{
 for(const profile of [null,shop,{...logistics,active:false}])assert.equal((await harness(profile).route.GET()).status,403);
 for(const profile of [logistics,manager]){const h=harness(profile);assert.equal((await h.route.POST(post(create))).status,200);assert.equal(h.saves.length,1);}
 assert.equal((await harness(baker).route.POST(post(create))).status,403);
 const current=apply(state(),create),command={kind:'plan',id:'request-1',date:'2026-11-05',departmentId:'dessert'};
 assert.equal((await harness(logistics,current).route.POST(post(command))).status,403);
 assert.equal((await harness(baker,current).route.POST(post({...command,departmentId:'ijs'}))).status,403);
 const h=harness(baker,current);assert.equal((await h.route.POST(post(command))).status,200);assert.equal(h.saves[0][1],3);assert.equal(h.saves[0][2].tasks.length,1);
 assert.equal((await harness(manager).route.POST(post(create,3,'https://foreign.invalid'))).status,403);
});
test('a stale revision cannot overwrite another request or plan; logistics receives a minimal catalog, not recipes or ingredients',async()=>{
 const h=harness(logistics);assert.equal((await h.route.POST(post(create,2))).status,409);assert.equal(h.saves.length,0);
 const response=await h.route.GET(),data=await response.json();assert.equal(response.headers.get('Cache-Control'),'private, no-store');assert(data.canCreate);assert(!('recipes'in data));assert(!('ingredients'in data));assert(!('stock'in data.items[0]));
});
test('logistics can introduce a new recipe-free part atomically; duplicates and malformed requests never add an orphan item',()=>{
 const initial=state(),command={...create,itemId:'__new',newItem:{name:'Nieuw beslag',kind:'component',unit:'kg',departmentId:'bak'}};
 const next=apply(initial,command);assert.equal(next.items.length,2);assert.equal(next.items[1].recipeId,undefined);assert.equal(next.items[1].stockKnown,false);assert.equal(next.productionRequests[0].itemId,next.items[1].id);assert.equal(next.items[1].departmentId,'bak');
 const planned=apply(next,{kind:'plan',id:'request-1',date:'2026-11-04',departmentId:'bak'},'new-task');assert.equal(planned.tasks[0].itemId,next.items[1].id);
 assert.throws(()=>apply(initial,{...command,newItem:{...command.newItem,name:'Testtaart'}}),/bestaat al/);
 assert.throws(()=>apply(initial,{...command,quantity:0}));assert.equal(initial.items.length,1);
});
const quick=load('app/productie/quickRecipe.ts');
const workspace=load('app/productie/workspaceData.ts',{'./planning':planning});
const recipeData=()=>({ingredients:[{id:'flour',name:'Bloem',recipeUnit:'gram',allergens:['gluten'],lastPrice:123}],recipes:[],invoiceImports:[],manualProductionPlanningItems:[],allergenLists:[]});
const quickInput={itemId:'cake',yield:10,instructions:'Mengen\nBakken',ingredients:[{ingredientId:'flour',quantity:500,unit:'gram'}]};
test('quick entry creates one canonical draft recipe linked to the existing item, preserving tasks, requests and financial data',()=>{
 const data=recipeData(),initial=apply(state(),create);const next=quick.quickRecipe(initial,data,quickInput,'new-recipe',now);
 assert.equal(data.recipes.length,0);assert.equal(next.recipes.recipes.length,1);assert.equal(next.recipes.recipes[0].status,'draft');assert.equal(next.recipes.recipes[0].name,'Testtaart');assert.equal(next.recipes.recipes[0].ingredients[0].ingredientId,'flour');assert.equal(next.planner.items[0].id,'cake');assert.equal(next.planner.items[0].recipeId,'new-recipe');assert.equal(next.recipes.ingredients[0].lastPrice,123);assert.equal(next.planner.productionRequests.length,1);
 const synced=workspace.syncRecipeCatalog(next.planner,next.recipes);assert.equal(synced.items.length,1,'A linked manual item must not get a second recipe catalog item');assert(workspace.validWorkspace(synced,workspace.recipeViews(next.recipes)));
 assert.throws(()=>quick.quickRecipe(next.planner,next.recipes,quickInput,'another',now),/al een recept/);
});
test('quick recipes reject missing/duplicate ingredients, invalid amounts and empty instructions',()=>{
 for(const changes of [{yield:0},{instructions:''},{ingredients:[]},{ingredients:[{ingredientId:'missing',quantity:1,unit:'gram'}]},{ingredients:[quickInput.ingredients[0],quickInput.ingredients[0]]}])assert.throws(()=>quick.quickRecipe(state(),recipeData(),{...quickInput,...changes},'r',now));
});
test('quick-recipe endpoint checks both revisions and department rights before the atomic save',async()=>{
 function endpoint(profile){let saves=0;return {get saves(){return saves;},route:load('app/api/productie/snel-recept/route.ts',{'@/app/lib/auth/session':{getCurrentProfile:async()=>profile},'@/app/productie/access':rights,'@/app/productie/documents.server':{ProductionStoreError:StoreError,readDocument:async key=>({revision:3,data:key==='planner'?state():recipeData()}),saveQuickRecipeDocument:async()=>{saves++;}},'@/app/productie/quickRecipe':quick,'@/app/productie/workRecipe':load('app/productie/workRecipe.ts'),'@/app/productie/productionWork':load('app/productie/productionWork.ts',{'./planning':planning,'./recipePlanning':load('app/productie/recipePlanning.ts',{'./planning':planning})}),'@/app/lib/auth/access':access,'@/app/productie/workspaceData':workspace})};}
 function req(revision=3){return new Request('https://app.invalid/api/productie/snel-recept',{method:'POST',headers:{Origin:'https://app.invalid','Content-Type':'application/json'},body:JSON.stringify({who:"Proefbakker",revision,recipeRevision:3,command:quickInput})});}
 const denied=endpoint(logistics);assert.equal((await denied.route.POST(req())).status,403);assert.equal(denied.saves,0);
 const good=endpoint(baker);assert.equal((await good.route.POST(req())).status,200);assert.equal(good.saves,1);
 const stale=endpoint(baker);assert.equal((await stale.route.POST(req(2))).status,409);assert.equal(stale.saves,0);
});
