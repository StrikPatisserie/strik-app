const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function load(file,imports={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:name=>{assert(name in imports,`Unmocked ${name}`);return imports[name];},Set,Map,Date,Intl,structuredClone,Request,Response,URL,crypto:require('node:crypto').webcrypto});return exports;}
const access=load('app/lib/auth/access.ts'),planning=load('app/productie/planning.ts');
const rights=load('app/productie/access.ts',{'../lib/auth/access':access,'./planning':planning});
const workspace=load('app/productie/workspaceData.ts',{'./planning':planning});
const recipePlanning=load('app/productie/recipePlanning.ts',{'./planning':planning,'./materialPlanning':load('app/productie/materialPlanning.ts',{'./planning':planning})});
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
test('broken component links remain editable and replacing them releases the repaired recipe for planning',()=>{
 const {data}=fixture();
 data.recipes[0].ingredients=[{ingredientId:'deleted-ingredient',quantity:100,unit:'gram',costContribution:0}];
 data.recipes[0].semiFinishedItems=[{semiFinishedRecipeId:'deleted-preparation',quantity:2,unit:'kg',costContribution:0}];
 const state=workspace.seedWorkspace(data),input=work.editableWorkRecipe(state,data,'recipe:r'),suppliers=JSON.stringify(data.ingredients);
 assert.equal(state.items[0].productionBlocked,true);assert.equal(input.ingredients[0].ingredientId,'deleted-ingredient');assert.equal(input.semiFinishedItems[0].recipeId,'deleted-preparation');
 assert.throws(()=>work.updateWorkRecipe(state,data,input,'2026-11-07T12:00:00Z'),/Grondstof 1/);
 input.ingredients[0].ingredientId='flour';input.semiFinishedItems[0].recipeId='semi';
 const result=work.updateWorkRecipe(state,data,input,'2026-11-07T12:00:00Z'),saved=result.recipes.recipes[0];
 assert.equal(result.planner.items[0].productionBlocked,false);assert.equal(saved.id,'r');assert.equal(saved.costPrice,77);assert.equal(saved.salesPrice,99);assert.equal(saved.productionLog[0].id,'log');assert.equal(JSON.stringify(result.recipes.ingredients),suppliers);
 assert.deepEqual(plain(saved.preparationSteps),['Mengen']);assert.deepEqual(plain(saved.workInstructions),['Klaarzetten']);assert.deepEqual(plain(saved.finishingSteps),['Afwerken']);
 const command={task:{id:'repair-plan',itemId:'recipe:r',departmentId:'dessert',date:'2026-11-10',operation:'Afwerken',status:'planned',note:'',source:'manual',batchId:'repair-batch',recordsOutput:true},amount:10,amountMode:'quantity',preparation:{daysBefore:1,choices:{}}};
 const plan=recipePlanning.buildRecipePlan(result.planner,workspace.recipeViews(result.recipes),command);
 assert.equal(plan.tasks.length,2);assert.equal(plan.tasks.find(task=>task.generatedFor==='repair-plan').itemId,'recipe:semi');assert.equal(state.items[0].productionBlocked,true);
});
test('component validation distinguishes missing IDs, duplicate links, quantities and unsupported units',()=>{
 const ingredient={kind:'ingredient',linkedId:'flour',quantity:100,unit:'gram'};
 assert.equal(work.workRecipeComponentError(ingredient,['flour']),undefined);
 assert.match(work.workRecipeComponentError({...ingredient,linkedId:'deleted'},['flour']),/bestaande grondstof/);
 assert.match(work.workRecipeComponentError({...ingredient,kind:'semiFinished'},['semi']),/bestaande halffabricaat/);
 assert.match(work.workRecipeComponentError(ingredient,['flour'],true),/staat al/);
 assert.match(work.workRecipeComponentError({...ingredient,quantity:0},['flour']),/groter dan nul/);
 assert.match(work.workRecipeComponentError({...ingredient,unit:'zak'},['flour']),/eenheid/);
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
test('changing a mislinked ingredient to a supplier record with the same name is saved and audited',async()=>{
 const e=endpoint(editor);
 e.data.ingredients.push({...e.data.ingredients[0],id:'correct-flour',supplier:'Andere leverancier',supplierArticleNumber:'correct-supplier-code'});
 const input=work.editableWorkRecipe(e.state,e.data,'recipe:r');input.ingredients[0].ingredientId='correct-flour';
 const response=await e.route.POST(post(input));assert.equal(response.status,200,JSON.stringify(await response.json()));assert.equal(e.writes.length,1);
 const saved=e.writes[0][3];assert.equal(saved.recipes[0].ingredients[0].ingredientId,'correct-flour');assert.equal(saved.ingredients.length,2);assert.equal(saved.ingredients[1].supplierArticleNumber,'correct-supplier-code');assert.equal(saved.recipes[0].id,'r');assert.match(e.writes[0][2].productionWork.history[0].summary,/koppeling aangepast/);
});
test('an ordinary baker can replace, remove and add canonical ingredients and preparations without financial permissions',async()=>{
 const e=endpoint(baker);e.data.ingredients.push({id:'sugar',name:'Suiker',supplier:'Bestaande leverancier',supplierArticleNumber:'sugar-42',lastPrice:200,allergens:[]});
 const suppliers=JSON.stringify(e.data.ingredients),response=await e.route.GET(read()),view=await response.json();
 assert.equal(access.canManageProduction(baker),true);assert.equal(access.hasFullAccess(baker),false);assert.equal(response.status,200);
 for(const secret of ['costPrice','salesPrice','costContribution','invoice','private-photo'])assert(!JSON.stringify(view).includes(secret),secret);
 view.draft.ingredients=[{ingredientId:'sugar',quantity:80,unit:'gram'}];view.draft.semiFinishedItems=[{recipeId:'semi',quantity:1,unit:'kg'}];
 view.draft.instructions='Suiker mengen met beslag';view.draft.workInstructions='Klaarzetten';view.draft.finishingInstructions='Afwerken';view.draft.costPrice=0;view.draft.salesPrice=0;
 const savedResponse=await e.route.POST(post(view.draft));assert.equal(savedResponse.status,200,JSON.stringify(await savedResponse.json()));assert.equal(e.writes.length,1);
 const planner=e.writes[0][2],data=e.writes[0][3],saved=data.recipes.find(recipe=>recipe.id==='r'),audit=planner.productionWork.history[0];
 assert.equal(saved.id,'r');assert.equal(saved.name,'Recept');assert.equal(data.recipes.length,2);assert.deepEqual(plain(saved.ingredients.map(line=>line.ingredientId)),['sugar']);assert.deepEqual(plain(saved.semiFinishedItems.map(line=>line.semiFinishedRecipeId)),['semi']);assert.equal(JSON.stringify(data.ingredients),suppliers);
 assert.equal(saved.costPrice,77);assert.equal(saved.salesPrice,99);assert.equal(saved.productionLog[0].id,'log');assert.equal(data.invoiceImports[0].amount,456);assert.equal(audit.actorId,baker.id);assert.match(audit.summary,/koppeling aangepast/);assert(audit.before.ingredients.some(line=>line.name==='Bloem'));assert(audit.after.ingredients.some(line=>line.name==='Suiker'));assert(audit.after.ingredients.some(line=>line.name==='Beslag'));
 const foreign=endpoint(baker);foreign.state.items[0].departmentId='ijs';const command=work.editableWorkRecipe(foreign.state,foreign.data,'recipe:r');command.ingredients[0].quantity=200;
 assert.equal((await foreign.route.POST(post(command))).status,403);assert.equal(foreign.writes.length,0);
});
test('a disconnected canonical child repairs its source unit and link while preserving historical task amounts and source audit',async()=>{
 const e=endpoint(editor);
 e.data.recipes[0].semiFinishedItems=[{semiFinishedRecipeId:'semi',quantity:2,unit:'kg',costContribution:0}];
 const child=e.state.items.find(item=>item.id==='recipe:semi');child.unit='gram';child.recipeId=undefined;
 e.state.tasks.push({id:'older-preparation',itemId:child.id,departmentId:'dessert',date:'2026-11-06',quantity:750,operation:'Bereiden',status:'planned',source:'manual',note:'Bestaande hoeveelheid',batchId:'older-batch',recordsOutput:true});
 const beforeTasks=JSON.stringify(e.state.tasks),beforeSuppliers=JSON.stringify(e.data.ingredients);
 const response=await e.route.GET(new Request('https://app.invalid/api/productie/snel-recept?itemId=recipe%3Asemi')),view=await response.json();
 assert.equal(response.status,200);assert.equal(view.draft.recipeId,'semi');assert.equal(view.draft.yield,1000);assert.equal(view.requiresPermanent,true);assert.match(view.notice,/omgerekend/);assert.match(view.notice,/gram/);
 assert.equal((await e.route.POST(post({...view.draft,recipeId:'r'}))).status,400);assert.equal(e.writes.length,0);
 const save=await e.route.POST(post(view.draft));assert.equal(save.status,200,JSON.stringify(await save.json()));assert.equal(e.writes.length,1);
 const planner=e.writes[0][2],data=e.writes[0][3],saved=data.recipes.find(recipe=>recipe.id==='semi'),audit=planner.productionWork.history[0];
 assert.equal(saved.id,'semi');assert.equal(saved.standardBatchQuantity,1000);assert.equal(saved.standardBatchUnit,'gram');assert.equal(data.recipes.length,2);assert.equal(saved.costPrice,77);assert.equal(saved.productionLog[0].id,'log');assert.equal(JSON.stringify(data.ingredients),beforeSuppliers);
 assert.equal(planner.items.find(item=>item.id===child.id).recipeId,'semi');assert.equal(planner.items.find(item=>item.id===child.id).unit,'gram');assert.equal(JSON.stringify(planner.tasks),beforeTasks);
 assert.equal(audit.before.id,'semi');assert.equal(audit.before.yield,1);assert.equal(audit.before.unit,'kg');assert.equal(audit.after.id,'semi');assert.equal(audit.after.yield,1000);assert.equal(audit.after.unit,'gram');assert.match(audit.summary,/1 kg → 1000 gram/);
 const command={task:{id:'repaired-child-plan',itemId:'recipe:r',departmentId:'dessert',date:'2026-11-12',operation:'Afwerken',status:'planned',note:'',source:'manual',batchId:'new-repair-batch',recordsOutput:true},amount:10,amountMode:'quantity',preparation:{daysBefore:1,choices:{}}};
 const planned=recipePlanning.buildRecipePlan(planner,workspace.recipeViews(data),command);
 assert.equal(planned.tasks.find(task=>task.generatedFor==='repaired-child-plan').quantity,2000);assert.equal(planned.tasks.find(task=>task.id==='older-preparation').quantity,750);
});
test('incompatible canonical source units require an explicit new yield and cannot create a clone or a one-off repair',async()=>{
 const e=endpoint(editor),child=e.state.items.find(item=>item.id==='recipe:semi');child.unit='stuks';child.recipeId=undefined;
 e.state.tasks.push({id:'existing-child-task',itemId:child.id,departmentId:'dessert',date:'2026-11-06',quantity:3,operation:'Bereiden',status:'planned',source:'manual',note:'',batchId:'existing-child-batch',recordsOutput:true});
 const response=await e.route.GET(new Request('https://app.invalid/api/productie/snel-recept?itemId=recipe%3Asemi')),view=await response.json();
 assert.equal(response.status,200);assert.equal(view.draft.yield,0);assert.match(view.notice,/Vul zelf/);assert.match(view.notice,/stuks/);
 assert.equal((await e.route.POST(post(view.draft))).status,400);assert.equal(e.writes.length,0);
 const create={...view.draft,yield:12};delete create.recipeId;assert.equal((await e.route.POST(post(create))).status,400);assert.equal(e.writes.length,0);
 const once=new Request('https://app.invalid/api/productie/snel-recept',{method:'POST',headers:{origin:'https://app.invalid','Content-Type':'application/json'},body:JSON.stringify({command:{...view.draft,yield:12},revision:3,recipeRevision:5,scope:'once',taskId:'existing-child-task',who:'Proefbakker'})});
 assert.equal((await e.route.POST(once)).status,400);assert.equal(e.writes.length,0);
 const save=await e.route.POST(post({...view.draft,yield:12}));assert.equal(save.status,200,JSON.stringify(await save.json()));assert.equal(e.writes[0][3].recipes.find(recipe=>recipe.id==='semi').standardBatchUnit,'stuk');assert.equal(e.writes[0][3].recipes.length,2);assert.equal(e.writes[0][2].tasks[0].quantity,3);
 const unrelated={...e.state,items:e.state.items.map(item=>item.id===child.id?{...item,id:'free-component',recipeId:undefined}:item)};
 assert.throws(()=>work.editableWorkRecipe(unrelated,e.data,'free-component'),/geen gekoppeld/);
});
test('canonical unit repair detaches an incompatible alias while retaining every item unit and planned quantity',async()=>{
 const e=endpoint(editor),child=e.state.items.find(item=>item.id==='recipe:semi');child.unit='gram';child.recipeId=undefined;
 e.state.items.push({...child,id:'manual-semi',name:'Beslag in kilo',unit:'kg',recipeId:'semi'});
 for(const [id,itemId,quantity] of [['canonical-task','recipe:semi',750],['alias-task','manual-semi',2.5]])e.state.tasks.push({id,itemId,departmentId:'dessert',date:'2026-11-06',quantity,operation:'Bereiden',status:'planned',source:'manual',note:'Bestaande hoeveelheid',batchId:`batch:${id}`,recordsOutput:true});
 const beforeTasks=JSON.stringify(e.state.tasks),response=await e.route.GET(new Request('https://app.invalid/api/productie/snel-recept?itemId=recipe%3Asemi')),view=await response.json();
 assert.equal(response.status,200);assert.equal(view.draft.yield,1000);
 const save=await e.route.POST(post(view.draft));assert.equal(save.status,200,JSON.stringify(await save.json()));assert.equal(e.writes.length,1);
 const planner=e.writes[0][2],data=e.writes[0][3],canonical=planner.items.find(item=>item.id==='recipe:semi'),alias=planner.items.find(item=>item.id==='manual-semi');
 assert.equal(canonical.recipeId,'semi');assert.equal(canonical.unit,'gram');assert.equal(alias.recipeId,undefined);assert.equal(alias.unit,'kg');assert.match(alias.note,/bronrecept of eenheid gewijzigd/);assert.equal(JSON.stringify(planner.tasks),beforeTasks);assert.equal(data.recipes.length,2);assert(workspace.validWorkspace(planner,workspace.recipeViews(data)));
 assert.equal(e.state.items.find(item=>item.id==='manual-semi').recipeId,'semi');assert.equal(e.data.recipes.find(recipe=>recipe.id==='semi').standardBatchUnit,'kg');
});
test('canonical unit repair prefills only known mass and volume conversions',()=>{
 for(const [sourceUnit,targetUnit,expected] of [['kg','gram',1000],['gram','kg',.001],['liter','ml',1000],['ml','liter',.001],['kg','liter',0],['stuk','kg',0]]){
  const {data,state}=fixture();data.recipes[1].standardBatchUnit=sourceUnit;const item=state.items.find(item=>item.id==='recipe:semi');item.unit=targetUnit;item.recipeId=undefined;
  assert.equal(work.editableWorkRecipe(state,data,item.id).yield,expected,`${sourceUnit} → ${targetUnit}`);
 }
});
test('one-off recipe API stores a task snapshot and named audit, leaving source recipes and earlier tasks intact',async()=>{
 const e=endpoint(editor);e.state.tasks.push({id:'production-1',itemId:'recipe:r',departmentId:'dessert',date:'2026-11-06',quantity:10,operation:'Maken',status:'planned',source:'manual',note:'',batchId:'batch-1',recordsOutput:true});
 const draft=work.editableWorkRecipe(e.state,e.data,'recipe:r');draft.ingredients[0].quantity=250;
 // Extend the store boundary only: both canonical recipe and work logic remain real.
 const writes=[],route=load('app/api/productie/snel-recept/route.ts',{'@/app/lib/auth/session':{getCurrentProfile:async()=>editor},'@/app/lib/auth/access':access,'@/app/productie/access':rights,'@/app/productie/documents.server':{ProductionStoreError:StoreError,readDocument:async key=>({revision:key==='recipes'?5:3,data:key==='recipes'?e.data:e.state}),saveRecipePlanDocument:async(...args)=>writes.push(args),saveQuickRecipeDocument:async()=>assert.fail('A one-off edit must never replace canonical recipes')},'@/app/productie/quickRecipe':quick,'@/app/productie/workRecipe':work,'@/app/productie/workspaceData':workspace,'@/app/productie/productionWork':productionWork});
 const request=more=>new Request('https://app.invalid/api/productie/snel-recept',{method:'POST',headers:{origin:'https://app.invalid','Content-Type':'application/json'},body:JSON.stringify({revision:3,recipeRevision:5,command:draft,scope:'once',taskId:'production-1',who:'Bakker B',...more})});
 const response=await route.POST(request({}));assert.equal(response.status,200,JSON.stringify(await response.json()));assert.equal(writes.length,1);
 const saved=writes[0][2];assert.equal(saved.productionWork.overrides['production-1'].ingredients[0].quantity,250);assert.equal(e.data.recipes[0].ingredients[0].quantity,100);assert.equal(saved.tasks[0].quantity,10);assert.equal(saved.productionWork.history[0].actorId,editor.id);assert.equal(saved.productionWork.history[0].who,'Bakker B');assert.equal(saved.productionWork.history[0].before.ingredients[0].quantity,100);assert.equal(saved.productionWork.recipeDrafts['production-1'].ingredients[0].ingredientId,'flour');
 Object.assign(e.state,saved);assert.equal((await route.POST(request({}))).status,400);assert.equal(writes.length,1);
 assert.equal((await route.POST(request({who:''}))).status,400);assert.equal((await route.POST(request({taskId:'missing'}))).status,400);assert.equal(writes.length,1);
});
