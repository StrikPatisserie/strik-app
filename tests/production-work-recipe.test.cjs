const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function load(file,imports={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:name=>{assert(name in imports,`Unmocked ${name}`);return imports[name];},Set,Map,Date,Intl,structuredClone,Request,Response,URL,crypto:require('node:crypto').webcrypto});return exports;}
const access=load('app/lib/auth/access.ts'),planning=load('app/productie/planning.ts');
const rights=load('app/productie/access.ts',{'../lib/auth/access':access,'./planning':planning});
const workspace=load('app/productie/workspaceData.ts',{'./planning':planning});
const recipePlanning=load('app/productie/recipePlanning.ts',{'./planning':planning});
const productionWork=load('app/productie/productionWork.ts',{'./planning':planning,'./recipePlanning':recipePlanning});
const work=load('app/productie/workRecipe.ts'),quick=load('app/productie/quickRecipe.ts');
const baker={id:'baker',active:true,role:'bakkerij',permissions:{'bakkerij.patisserie':true}};
const editor={...baker,permissions:{...baker.permissions,'productie.manage':true}};
const recipe=(more={})=>({id:'r',name:'Recept',type:'finalProduct',standardBatchQuantity:10,standardBatchUnit:'stuk',ingredients:[{ingredientId:'flour',quantity:100,unit:'gram',costContribution:45}],semiFinishedItems:[],preparationSteps:['Mengen'],workInstructions:['Klaarzetten'],finishingSteps:['Afwerken'],allergens:['ei'],costPrice:77,salesPrice:99,photoPreviewDataUrl:'private-photo',productionLog:[{id:'log'}],...more});
function fixture(){const data={ingredients:[{id:'flour',name:'Bloem',lastPrice:123,allergens:['gluten']}],recipes:[recipe(),recipe({id:'semi',name:'Beslag',type:'semiFinished',standardBatchQuantity:1,standardBatchUnit:'kg'})],invoiceImports:[{id:'invoice',amount:456}],manualProductionPlanningItems:[]};return {data,state:workspace.seedWorkspace(data)};}
const plain=value=>JSON.parse(JSON.stringify(value));
test('work-recipe edits preserve canonical identities, prices, history and tasks while changing only operational fields',()=>{
 const {data,state}=fixture(),before=JSON.stringify(data),input=work.editableWorkRecipe(state,data,'recipe:r');
 assert(!JSON.stringify(input).includes('costPrice'));input.ingredients[0].quantity=150;input.yield=15;input.instructions='Mengen\nBakken';input.costPrice=0;input.salesPrice=0;
 const result=work.updateWorkRecipe(state,data,input,'2026-11-05T12:00:00Z'),saved=result.recipes.recipes[0];
 assert.equal(saved.id,'r');assert.equal(saved.name,'Recept');assert.equal(saved.standardBatchQuantity,15);assert.equal(saved.ingredients[0].quantity,150);assert.equal(saved.costPrice,77);assert.equal(saved.salesPrice,99);assert.equal(saved.photoPreviewDataUrl,'private-photo');assert.equal(saved.productionLog[0].id,'log');assert.equal(saved.status,'draft');assert.deepEqual(plain(saved.allergens),['ei','gluten']);assert.equal(result.recipes.invoiceImports[0].amount,456);assert.equal(result.planner,state);assert.equal(JSON.stringify(data),before);
});
test('invalid references, circular preparations, wrong recipe identities and empty recipes are rejected',()=>{
 const {data,state}=fixture(),input=work.editableWorkRecipe(state,data,'recipe:r');
 for(const patch of [{recipeId:'wrong'},{yield:0},{instructions:'',workInstructions:'',finishingInstructions:''},{ingredients:[],semiFinishedItems:[]},{ingredients:[{ingredientId:'missing',quantity:1,unit:'gram'}]},{ingredients:[input.ingredients[0],input.ingredients[0]]}])assert.throws(()=>work.updateWorkRecipe(state,data,{...input,...patch},'now'));
 const withSemi={...input,semiFinishedItems:[{recipeId:'semi',quantity:2,unit:'kg'}]};
 assert.equal(work.updateWorkRecipe(state,data,withSemi,'now').recipes.recipes[0].semiFinishedItems[0].semiFinishedRecipeId,'semi');
 data.recipes[1].semiFinishedItems=[{semiFinishedRecipeId:'r',quantity:1,unit:'stuk'}];assert.throws(()=>work.updateWorkRecipe(state,data,withSemi,'now'),/kring/);
});
class StoreError extends Error{constructor(message,status=503){super(message);this.status=status;}}
function endpoint(profile){const {data,state}=fixture(),writes=[];let reads=0;const route=load('app/api/productie/snel-recept/route.ts',{'@/app/lib/auth/session':{getCurrentProfile:async()=>profile},'@/app/lib/auth/access':access,'@/app/productie/access':rights,'@/app/productie/documents.server':{ProductionStoreError:StoreError,readDocument:async key=>{reads++;return{revision:key==='recipes'?5:3,data:key==='recipes'?data:state};},saveQuickRecipeDocument:async(...args)=>{writes.push(args);}},'@/app/productie/quickRecipe':quick,'@/app/productie/workRecipe':work,'@/app/productie/productionWork':productionWork,'@/app/productie/workspaceData':workspace});return{route,writes,data,state,reads:()=>reads};}
const read=()=>new Request('https://app.invalid/api/productie/snel-recept?itemId=recipe%3Ar');
const post=(command,revision=3,origin='https://app.invalid')=>new Request('https://app.invalid/api/productie/snel-recept',{method:'POST',headers:{'Content-Type':'application/json',origin},body:JSON.stringify({command,revision,recipeRevision:5,who:"Proefbakker"})});
test('the editor reads no financial data and atomically saves both documents using trusted permissions and revisions',async()=>{
 const e=endpoint(editor),response=await e.route.GET(read()),view=await response.json();assert.equal(response.status,200);assert.match(response.headers.get('Cache-Control'),/no-store/);
 for(const secret of ['costPrice','salesPrice','costContribution','invoice','private-photo','123'])assert(!JSON.stringify(view).includes(secret),secret);
 view.draft.ingredients[0].quantity=200;assert.equal((await e.route.POST(post(view.draft))).status,200);assert.equal(e.writes.length,1);assert.equal(e.writes[0][0],3);assert.equal(e.writes[0][1],5);assert.equal(e.writes[0][4],editor.id);assert.equal(e.writes[0][3].recipes[0].ingredients[0].quantity,200);assert.equal(e.writes[0][3].recipes[0].costPrice,77);
 for(const profile of [null,{...editor,active:false},{...editor,role:'winkel'}]){const denied=endpoint(profile);assert.equal((await denied.route.GET(read())).status,403);assert.equal((await denied.route.POST(post(view.draft))).status,403);assert.equal(denied.writes.length,0);assert.equal(denied.reads(),0);}
 const ordinary=endpoint(baker);assert.equal((await ordinary.route.GET(read())).status,200);assert.equal((await ordinary.route.POST(post(view.draft))).status,200);assert.equal(ordinary.writes[0][3].recipes[0].costPrice,77);
 const stale=endpoint(editor);assert.equal((await stale.route.POST(post(view.draft,2))).status,409);assert.equal(stale.writes.length,0);
 assert.equal((await endpoint(editor).route.POST(post(view.draft,3,'https://foreign.invalid'))).status,403);
});
test('one-off recipe API stores a task snapshot and named audit, leaving source recipes and earlier tasks intact',async()=>{
 const e=endpoint(editor);e.state.tasks.push({id:'production-1',itemId:'recipe:r',departmentId:'dessert',date:'2026-11-06',quantity:10,operation:'Maken',status:'planned',source:'manual',note:'',batchId:'batch-1',recordsOutput:true});
 const draft=work.editableWorkRecipe(e.state,e.data,'recipe:r');draft.ingredients[0].quantity=250;
 // Extend the store boundary only: both canonical recipe and work logic remain real.
 const writes=[],route=load('app/api/productie/snel-recept/route.ts',{'@/app/lib/auth/session':{getCurrentProfile:async()=>editor},'@/app/lib/auth/access':access,'@/app/productie/access':rights,'@/app/productie/documents.server':{ProductionStoreError:StoreError,readDocument:async key=>({revision:key==='recipes'?5:3,data:key==='recipes'?e.data:e.state}),saveRecipePlanDocument:async(...args)=>writes.push(args),saveQuickRecipeDocument:async()=>assert.fail('A one-off edit must never replace canonical recipes')},'@/app/productie/quickRecipe':quick,'@/app/productie/workRecipe':work,'@/app/productie/workspaceData':workspace,'@/app/productie/productionWork':productionWork});
 const request=more=>new Request('https://app.invalid/api/productie/snel-recept',{method:'POST',headers:{origin:'https://app.invalid','Content-Type':'application/json'},body:JSON.stringify({revision:3,recipeRevision:5,command:draft,scope:'once',taskId:'production-1',who:'Bakker B',...more})});
 const response=await route.POST(request({}));assert.equal(response.status,200,JSON.stringify(await response.json()));assert.equal(writes.length,1);
 const saved=writes[0][2];assert.equal(saved.productionWork.overrides['production-1'].ingredients[0].quantity,250);assert.equal(e.data.recipes[0].ingredients[0].quantity,100);assert.equal(saved.tasks[0].quantity,10);assert.equal(saved.productionWork.history[0].actorId,editor.id);assert.equal(saved.productionWork.history[0].who,'Bakker B');assert.equal(saved.productionWork.history[0].before.ingredients[0].quantity,100);assert.equal(saved.productionWork.recipeDrafts['production-1'].ingredients[0].ingredientId,'flour');
 assert.equal((await route.POST(request({who:''}))).status,400);assert.equal((await route.POST(request({taskId:'missing'}))).status,400);assert.equal(writes.length,1);
});
