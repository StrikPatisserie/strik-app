const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function load(file,imports={}) {const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:name=>{if(!(name in imports))throw Error(`Unmocked ${name}`);return imports[name];},Request,Response,URL,Date,Intl,JSON,Number,Set,Map,Error});return exports;}
const planning=load('app/productie/planning.ts');
const workspace=load('app/productie/workspaceData.ts',{'./planning':planning});
const rules=load('app/productie/recipePlanning.ts',{'./planning':planning,'./materialPlanning':load('app/productie/materialPlanning.ts',{'./planning':planning})});
function fixture(){
 const r=(id,name,yieldAmount,lines=[],type='semiFinished',unit='kg')=>({id,name,type,yield:yieldAmount,unit,ingredients:[],steps:[],allergens:[],semiFinishedItems:lines});
 const line=(recipeId,quantity,unit='gram')=>({recipeId,quantity,unit});
 const recipes=[r('pie','Caramel Pecan Pie',50,[line('base',9500),line('pecan',8450),line('mousse',8750),line('foam',8120)],'finalProduct','stuks'),r('base','Bodem',14.785),r('pecan','Caramel-pecan',8.45),r('mousse','Mousse',8.75,[line('caramel',2000)]),r('foam','Schuim',8.12),r('caramel','Caramel',23.5)];
 const state={version:1,items:recipes.map(r=>({id:`recipe:${r.id}`,recipeId:r.id,name:r.name,kind:r.type==='finalProduct'?'product':'component',unit:r.unit,departmentId:r.id==='base'?'bak':'dessert',stock:0,stockKnown:false,note:''})),tasks:[]};
 const command={task:{id:'order-1',itemId:'recipe:pie',departmentId:'dessert',date:'2026-11-02',operation:'Afwerken',status:'planned',note:'',source:'manual',batchId:'batch-1',recordsOutput:true},amount:100,amountMode:'quantity',preparation:{daysBefore:1,choices:{}}};
 return{recipes,state,command};
}
test('100 pies scale the 50-piece recipe twice, convert grams to kg and include nested caramel',()=>{
 const {state,recipes,command}=fixture(),proposal=rules.preparationProposal(state,recipes,command);
 assert.equal(proposal.errors.length,0);assert.equal(proposal.quantity,100);assert.equal(proposal.recipeCount,2);
 const rows=new Map(proposal.rows.map(r=>[r.recipeId,r]));
 for(const [id,quantity] of [['base',19],['pecan',16.9],['mousse',17.5],['foam',16.24],['caramel',4]])assert.equal(rows.get(id).quantity,quantity);
 assert.equal(rows.get('base').date,'2026-11-01');assert.equal(rows.get('caramel').date,'2026-10-31');assert.equal(rows.get('base').departmentId,'bak');
 const next=rules.buildRecipePlan(state,recipes,command);assert.equal(next.tasks.length,6);assert.equal(state.tasks.length,0);assert(workspace.validWorkspace(next,recipes));
 assert.equal(next.tasks.find(t=>t.id==='order-1').requires.length,4);
});
test('one base recipe selects its actual yield, while unchecked automatic preparation creates only the parent',()=>{
 const {state,recipes,command}=fixture();command.amount=1;command.amountMode='batches';delete command.preparation;
 const next=rules.buildRecipePlan(state,recipes,command);assert.equal(next.tasks.length,1);assert.equal(next.tasks[0].quantity,50);
});
test('preparation operations and estimated minutes persist through build, reload and recipe refresh',()=>{
 const {state,recipes,command}=fixture();
 command.task.minutes=45;
 command.preparation.choices={
  base:{operation:'Bereiden + storten',minutes:30},
  caramel:{operation:'Bereiden + portioneren',minutes:12.5},
 };
 const proposal=rules.preparationProposal(state,recipes,command);
 assert.equal(proposal.errors.length,0);
 assert.equal(proposal.rows.find(row=>row.recipeId==='base').operation,'Bereiden + storten');
 assert.equal(proposal.rows.find(row=>row.recipeId==='base').minutes,30);
 const original=rules.buildRecipePlan(state,recipes,command);
 const root=original.tasks.find(task=>task.id==='order-1');
 const base=original.tasks.find(task=>task.itemId==='recipe:base');
 assert.equal(root.minutes,45);
 assert.equal(base.operation,'Bereiden + storten');
 assert.equal(base.minutes,30);
 assert.equal(root.recipePlan.preparation.choices.base.operation,'Bereiden + storten');
 assert.equal(root.recipePlan.preparation.choices.caramel.minutes,12.5);
 const current=rules.currentPlanCommand(original,root);
 assert.equal(current.preparation.choices.base.operation,'Bereiden + storten');
 assert.equal(current.preparation.choices.base.minutes,30);
 recipes[0].semiFinishedItems[0].quantity=10000;
 const refreshed=rules.refreshRecipePlan(original,recipes,root.id,current);
 const updated=refreshed.tasks.find(task=>task.id===base.id);
 assert.equal(updated.quantity,20);
 assert.equal(updated.operation,'Bereiden + storten');
 assert.equal(updated.minutes,30);
 assert.equal(refreshed.tasks.find(task=>task.itemId==='recipe:caramel').minutes,12.5);
 assert(workspace.validWorkspace(refreshed,recipes));
 const clear=rules.currentPlanCommand(refreshed,refreshed.tasks.find(task=>task.id===root.id));
 clear.preparation.choices.base={...clear.preparation.choices.base,operation:'Bereiden',minutes:null};
 const cleared=rules.refreshRecipePlan(refreshed,recipes,root.id,clear);
 assert.equal(cleared.tasks.find(task=>task.id===base.id).operation,'Bereiden');
 assert.equal(cleared.tasks.find(task=>task.id===base.id).minutes,undefined);
 assert.equal(cleared.tasks.find(task=>task.id===root.id).recipePlan.preparation.choices.base.minutes,null);
 assert.equal(rules.currentPlanCommand(cleared,cleared.tasks.find(task=>task.id===root.id)).preparation.choices.base.minutes,null);
 assert(workspace.validWorkspace(cleared,recipes));
});
test('legacy preparations keep their defaults and existing work details when choices omit the new fields',()=>{
 const {state,recipes,command}=fixture();
 const proposal=rules.preparationProposal(state,recipes,command);
 assert(proposal.rows.every(row=>row.operation==='Bereiden'&&row.minutes===undefined));
 const original=rules.buildRecipePlan(state,recipes,command);
 const base=original.tasks.find(task=>task.itemId==='recipe:base');
 base.operation='Bereiden + storten';base.minutes=25;
 recipes[0].semiFinishedItems[0].quantity=10000;
 const refreshed=rules.refreshRecipePlan(original,recipes,'order-1',command);
 const updated=refreshed.tasks.find(task=>task.id===base.id);
 assert.equal(updated.quantity,20);
 assert.equal(updated.operation,'Bereiden + storten');
 assert.equal(updated.minutes,25);
 assert(refreshed.tasks.filter(task=>task.generatedFor==='order-1'&&task.id!==base.id).every(task=>task.operation==='Bereiden'&&task.minutes===undefined));
 assert.equal(refreshed.tasks.find(task=>task.id==='order-1').minutes,undefined);
});
test('invalid preparation work details reject the whole plan without partial tasks',()=>{
 for(const choice of [{operation:''},{operation:'x'.repeat(101)},{operation:12},{minutes:-1},{minutes:1441},{minutes:Infinity},{minutes:'30'}]){
  const {state,recipes,command}=fixture();
  command.preparation.choices={base:choice};
  assert(rules.preparationProposal(state,recipes,command).errors.length>0);
  assert.throws(()=>rules.buildRecipePlan(state,recipes,command));
  assert.equal(state.tasks.length,0);
 }
});
test('dates and departments are reviewable and excluding an available mousse omits its nested caramel',()=>{
 const {state,recipes,command}=fixture();command.preparation.choices={mousse:{include:false},base:{date:'2026-10-30',departmentId:'brood'}};
 const proposal=rules.preparationProposal(state,recipes,command);assert.equal(proposal.errors.length,0);assert(!proposal.rows.some(r=>r.recipeId==='caramel'));
 const next=rules.buildRecipePlan(state,recipes,command);assert.equal(next.tasks.length,4);assert(!next.tasks.some(t=>t.itemId==='recipe:mousse'));
 const base=next.tasks.find(t=>t.itemId==='recipe:base');assert.equal(base.date,'2026-10-30');assert.equal(base.departmentId,'brood');
});
test('shared nested preparations are summed by recipe ID and placed before their earliest consumer',()=>{
 const {state,recipes,command}=fixture();recipes.find(r=>r.id==='foam').semiFinishedItems=[{recipeId:'caramel',quantity:1,unit:'kg'}];
 command.preparation.choices={mousse:{date:'2026-10-29'}};
 const proposal=rules.preparationProposal(state,recipes,command);assert.equal(proposal.errors.length,0);
 const caramel=proposal.rows.filter(r=>r.recipeId==='caramel');assert.equal(caramel.length,1);assert.equal(caramel[0].quantity,6);assert.equal(caramel[0].date,'2026-10-28');
 const next=rules.buildRecipePlan(state,recipes,command);assert.equal(next.tasks.filter(t=>t.itemId==='recipe:caramel').length,1);assert(workspace.validWorkspace(next,recipes));
});
test('a late preparation stays visible with its original choice and can be repaired without losing the proposal',()=>{
 const {state,recipes,command}=fixture();command.preparation.choices={mousse:{date:'2026-11-03',departmentId:'slagroom'}};
 const proposal=rules.preparationProposal(state,recipes,command),mousse=proposal.rows.find(r=>r.recipeId==='mousse');
 assert.match(proposal.errors[0],/Mousse.*ma 2 nov/);assert.equal(proposal.rows.length,5);
 assert.equal(mousse.date,'2026-11-03');assert.equal(mousse.latestDate,'2026-11-02');assert.equal(mousse.departmentId,'slagroom');assert.equal(mousse.quantity,17.5);
 assert.throws(()=>rules.buildRecipePlan(state,recipes,command),/gebruiksdatum/);assert.equal(state.tasks.length,0);
 command.preparation.choices.mousse.date=mousse.latestDate;
 const repaired=rules.preparationProposal(state,recipes,command);assert.equal(repaired.errors.length,0);assert.equal(repaired.rows.length,5);
 assert.equal(rules.buildRecipePlan(state,recipes,command).tasks.length,6);
});
test('nested and shared preparations expose their earliest use and each invalid date can be corrected',()=>{
 const {state,recipes,command}=fixture();recipes.find(r=>r.id==='foam').semiFinishedItems=[{recipeId:'caramel',quantity:1,unit:'kg'}];
 command.preparation.choices={mousse:{date:'2026-10-29'},caramel:{date:'2026-10-30'}};
 const proposal=rules.preparationProposal(state,recipes,command),caramel=proposal.rows.find(r=>r.recipeId==='caramel');
 assert.equal(proposal.errors.length,1);assert.equal(proposal.rows.length,5);
 assert.equal(caramel.latestDate,'2026-10-29');assert.equal(caramel.date,'2026-10-30');assert.equal(caramel.quantity,6);
 command.preparation.choices.caramel.date=caramel.latestDate;
 assert.equal(rules.preparationProposal(state,recipes,command).errors.length,0);
 assert(workspace.validWorkspace(rules.buildRecipePlan(state,recipes,command),recipes));
});
test('a preparation explicitly marked already available is exempt from the date restriction and creates no task',()=>{
 const {state,recipes,command}=fixture();command.preparation.choices={mousse:{include:false,date:'2026-11-03'}};
 const proposal=rules.preparationProposal(state,recipes,command);assert.equal(proposal.errors.length,0);
 assert.equal(proposal.rows.find(r=>r.recipeId==='mousse').included,false);
 const next=rules.buildRecipePlan(state,recipes,command);assert(!next.tasks.some(t=>t.itemId==='recipe:mousse' || t.itemId==='recipe:caramel'));
});
test('missing yields, missing references, cycles, zero amounts and incompatible mass/volume units block the whole plan',()=>{
 for(const change of [
  f=>{f.recipes[0].yield=0;},
  f=>{f.recipes[0].semiFinishedItems[0].recipeId='missing';},
  f=>{f.recipes[1].semiFinishedItems=[{recipeId:'pie',quantity:1,unit:'stuks'}];},
  f=>{f.recipes[0].semiFinishedItems[0].quantity=0;},
  f=>{f.recipes[0].semiFinishedItems[0].unit='liter';},
  f=>{f.command.preparation.choices={mousse:{date:'2026-11-03'}};},
  f=>{f.command.amount=NaN;},
  f=>{f.command.preparation.daysBefore=-1;},
 ]){const f=fixture();change(f);assert(rules.preparationProposal(f.state,f.recipes,f.command).errors.length>0);assert.throws(()=>rules.buildRecipePlan(f.state,f.recipes,f.command));assert.equal(f.state.tasks.length,0);}
});
test('cross-item dependencies block premature completion, late moves and undoing consumed preparation',()=>{
 const {state,recipes,command}=fixture(),next=rules.buildRecipePlan(state,recipes,command);
 const base=next.tasks.find(t=>t.itemId==='recipe:base');
 assert.throws(()=>planning.transitionTask(next.tasks,'order-1','active',next.items),/Wacht op/);
 assert.throws(()=>planning.moveTask(next.tasks,base.id,'2026-11-03','bak'),/volgende stap/);
 let tasks=next.tasks;
 for(const task of next.tasks)tasks=planning.transitionTask(tasks,task.id,'done',next.items);
 assert.throws(()=>planning.transitionTask(tasks,base.id,'planned',next.items),/volgende stap/);
 assert.equal(planning.completedOutput(next.items,tasks).get('recipe:pie'),100);
 const corrupt={...next,tasks:next.tasks.map(t=>t.id===base.id?{...t,requires:['order-1']}:t)};assert.equal(workspace.validWorkspace(corrupt,recipes),false);
});
test('removing an unstarted root also removes unused planned preparation but preserves actual work',()=>{
 const {state,recipes,command}=fixture(),next=rules.buildRecipePlan(state,recipes,command);
 assert.equal(planning.removePlannedTask(next.tasks,'order-1').length,0);
 const caramel=next.tasks.find(t=>t.itemId==='recipe:caramel');
 const started=planning.transitionTask(next.tasks,caramel.id,'active',next.items);
 const remaining=planning.removePlannedTask(started,'order-1');assert.equal(remaining.length,1);assert.equal(remaining[0].id,caramel.id);
 assert.throws(()=>planning.removePlannedTask(next.tasks,caramel.id),/vervolgstap/);
});
test('whole production deletion follows explicit ownership and batches from a nested preparation or final follow-up, without touching another order of the same recipe',()=>{
 const {state,recipes,command}=fixture(),first=rules.buildRecipePlan(state,recipes,command),second=rules.buildRecipePlan(first,recipes,{...command,task:{...command.task,id:'order-2',batchId:'batch-2'}});
 const tasks=[...second.tasks,{...second.tasks.find(t=>t.id==='order-1'),id:'finish',dependsOn:'order-1',requires:[],recordsOutput:false}];
 const nested=tasks.find(t=>t.generatedFor==='order-1' && t.itemId==='recipe:caramel');
 for(const id of [nested.id,'finish','order-1']){const group=planning.recipeProductionTasks(tasks,id);assert.equal(group.length,7);const remaining=planning.removeRecipeProduction(tasks,id);assert.equal(remaining.length,6);assert(remaining.every(t=>t.id==='order-2'||t.generatedFor==='order-2'));}
 assert.equal(tasks.length,13);assert.equal(state.tasks.length,0);assert.throws(()=>planning.removeRecipeProduction(tasks,'missing'),/niet gevonden/);
});
test('whole production deletion never removes actual work or preparations still needed by another production',()=>{
 const {state,recipes,command}=fixture(),next=rules.buildRecipePlan(state,recipes,command),prep=next.tasks.find(t=>t.itemId==='recipe:caramel');
 for(const status of ['active','done','blocked'])assert.throws(()=>planning.removeRecipeProduction(next.tasks.map(t=>t.id===prep.id?{...t,status}:t),'order-1'),/volledig geplande/);
 const other={...next.tasks.find(t=>t.id==='order-1'),id:'other-order',batchId:'batch-other',requires:[prep.id]};
 assert.equal(planning.recipeProductionTasks([...next.tasks,other],prep.id).length,6);
 assert.throws(()=>planning.removeRecipeProduction([...next.tasks,other],prep.id),/andere productie/);
});
class StoreError extends Error{constructor(message,status=503){super(message);this.status=status;}}
function api(profile,options={}){
 const f=fixture();const source={ingredients:[],recipes:f.recipes.map(r=>({id:r.id,name:r.name,type:r.type,standardBatchQuantity:r.yield,standardBatchUnit:r.unit==='stuks'?'stuk':r.unit,ingredients:[],semiFinishedItems:r.semiFinishedItems.map(l=>({semiFinishedRecipeId:l.recipeId,quantity:l.quantity,unit:l.unit})),allergens:[]}))};
 let writes=0;const route=load('app/api/productie/plan/route.ts',{'@/app/lib/auth/session':{getCurrentProfile:async()=>profile},'@/app/lib/auth/access':load('app/lib/auth/access.ts'),'@/app/productie/access':load('app/productie/access.ts',{'../lib/auth/access':load('app/lib/auth/access.ts'),'./planning':planning}),'@/app/productie/documents.server':{ProductionStoreError:StoreError,readDocument:async key=>key==='recipes'?{data:source,revision:7}:{data:f.state,revision:3},saveRecipePlanDocument:async(revision,recipeRevision,state)=>{assert.equal(revision,3);assert.equal(recipeRevision,7);assert(workspace.validWorkspace(state,workspace.recipeViews(source)));if(options.conflict)throw new StoreError('revision-conflict',409);writes++;return 4;}},'@/app/productie/workspaceData':workspace,'@/app/productie/materialPlanning':load('app/productie/materialPlanning.ts',{'./planning':planning}),'@/app/productie/recipePlanning':rules});
 return{route,...f,source,writes:()=>writes};
}
function request(command,revision=3,recipeRevision=7){return new Request('https://app.invalid/api/productie/plan',{method:'POST',body:JSON.stringify({command,revision,recipeRevision})});}
test('the guarded command endpoint recalculates from canonical recipes and commits the entire plan once',async()=>{
 const baker=api({id:'baker',active:true,role:'bakkerij'});assert.equal((await baker.route.POST(request(baker.command))).status,200);
 const a=api({id:'manager',active:true,role:'manager'}),response=await a.route.POST(request(a.command));assert.equal(response.status,200);assert.equal((await response.json()).state.tasks.length,6);assert.equal(a.writes(),1);
 for(const profile of [null,{active:false,role:'manager'},{active:true,role:'winkel'}]){const b=api(profile);assert.equal((await b.route.POST(request(b.command))).status,403);assert.equal(b.writes(),0);}
});
test('stale recipe/planner revisions and a concurrent database conflict cannot leave a partial preparation plan',async()=>{
 for(const [revision,recipeRevision] of [[2,7],[3,6]]){const a=api({id:'manager',active:true,role:'manager'});assert.equal((await a.route.POST(request(a.command,revision,recipeRevision))).status,409);assert.equal(a.writes(),0);}
 const a=api({id:'manager',active:true,role:'manager'},{conflict:true});assert.equal((await a.route.POST(request(a.command))).status,409);assert.equal(a.writes(),0);
});
test('a late preparation cannot be saved through the API, even though the proposal remains editable',async()=>{
 const a=api({id:'manager',active:true,role:'manager'});a.command.preparation.choices={mousse:{date:'2026-11-03'}};
 const response=await a.route.POST(request(a.command));assert.equal(response.status,400);assert.equal(a.writes(),0);
 assert.match((await response.json()).message,/gebruiksdatum/);
});

test('a changed half-finished recipe is detected and rebuilt with stable task IDs and preserved scheduling',()=>{
 const f=fixture(),original=rules.buildRecipePlan(f.state,f.recipes,f.command),root=original.tasks.find(t=>t.id==='order-1');
 const caramel=original.tasks.find(t=>t.itemId==='recipe:caramel');
 f.recipes.find(r=>r.id==='mousse').semiFinishedItems[0].quantity=3000;
 const review=rules.recipePlanChanges(original,f.recipes,root);assert(review.changed);assert.equal(review.changes.find(c=>c.name==='Caramel').after,6);
 const next=rules.refreshRecipePlan(original,f.recipes,root.id,rules.currentPlanCommand(original,root));
 assert(workspace.validWorkspace(next,f.recipes));assert.equal(next.tasks.length,6);
 const updated=next.tasks.find(t=>t.itemId==='recipe:caramel');assert.equal(updated.id,caramel.id);assert.equal(updated.date,caramel.date);assert.equal(updated.quantity,6);
 assert.equal(original.tasks.find(t=>t.id===caramel.id).quantity,4);
 assert.equal(rules.recipePlanChanges(next,f.recipes,next.tasks.find(t=>t.id===root.id)).changed,false);
});
test('replacing a semi-finished ingredient adds the new requirement and removes only unused unstarted preparation',()=>{
 const f=fixture(),original=rules.buildRecipePlan(f.state,f.recipes,f.command),root=original.tasks.find(t=>t.id==='order-1'),oldIds=original.tasks.map(t=>t.id);
 f.recipes[0].semiFinishedItems[1]={recipeId:'caramel',quantity:8450,unit:'gram'};
 const review=rules.recipePlanChanges(original,f.recipes,root);assert(review.changes.some(c=>c.name==='Caramel-pecan' && c.after===undefined));
 const next=rules.refreshRecipePlan(original,f.recipes,root.id,rules.currentPlanCommand(original,root));assert(workspace.validWorkspace(next,f.recipes));
 assert(!next.tasks.some(t=>t.itemId==='recipe:pecan'));assert.equal(next.tasks.find(t=>t.itemId==='recipe:caramel').quantity,20.9);
 assert(next.tasks.every(t=>oldIds.includes(t.id)));assert.equal(new Set(next.tasks.map(t=>t.id)).size,next.tasks.length);
});
test('saved exclusions and manual preparation dates survive recalculation, including a legacy plan without metadata',()=>{
 const f=fixture();f.command.preparation.choices={mousse:{include:false},base:{date:'2026-10-29',departmentId:'brood'}};
 const original=rules.buildRecipePlan(f.state,f.recipes,f.command),root=original.tasks.find(t=>t.id==='order-1');
 assert.equal(rules.recipePlanChanges(original,f.recipes,root).changed,false);
 f.recipes[0].semiFinishedItems[0].quantity=10000;
 const next=rules.refreshRecipePlan(original,f.recipes,root.id,rules.currentPlanCommand(original,root));assert(!next.tasks.some(t=>t.itemId==='recipe:mousse'));
 const base=next.tasks.find(t=>t.itemId==='recipe:base');assert.equal(base.quantity,20);assert.equal(base.date,'2026-10-29');assert.equal(base.departmentId,'brood');
 const legacy=fixture(),old=rules.buildRecipePlan(legacy.state,legacy.recipes,legacy.command);old.tasks.forEach(t=>delete t.recipePlan);legacy.recipes[0].semiFinishedItems[0].quantity=11000;
 const legacyRoot=old.tasks.find(t=>t.id==='order-1');assert(rules.recipePlanChanges(old,legacy.recipes,legacyRoot).changed);
 assert(workspace.validWorkspace(rules.refreshRecipePlan(old,legacy.recipes,legacyRoot.id,rules.currentPlanCommand(old,legacyRoot)),legacy.recipes));
});
test('recalculation distinguishes a requested quantity from a requested number of base recipes',()=>{
 for(const mode of ['quantity','batches']){
  const f=fixture();f.command.amountMode=mode;f.command.amount=mode==='batches'?1:50;
  const old=rules.buildRecipePlan(f.state,f.recipes,f.command),root=old.tasks.find(t=>t.id==='order-1');f.recipes[0].yield=60;
  const next=rules.refreshRecipePlan(old,f.recipes,root.id,rules.currentPlanCommand(old,root));assert.equal(next.tasks.find(t=>t.id===root.id).quantity,mode==='batches'?60:50);
  assert(workspace.validWorkspace(next,f.recipes));
 }
});
test('started, completed, blocked and externally used preparation cannot be overwritten by a recipe refresh',()=>{
 for(const status of ['active','done','blocked']){
  const f=fixture(),old=rules.buildRecipePlan(f.state,f.recipes,f.command),root=old.tasks.find(t=>t.id==='order-1');old.tasks.find(t=>t.itemId==='recipe:caramel').status=status;
  const before=JSON.stringify(old);assert.throws(()=>rules.refreshRecipePlan(old,f.recipes,root.id,rules.currentPlanCommand(old,root)),/al gestart/);assert.equal(JSON.stringify(old),before);
 }
 const f=fixture(),old=rules.buildRecipePlan(f.state,f.recipes,f.command),root=old.tasks.find(t=>t.id==='order-1'),caramel=old.tasks.find(t=>t.itemId==='recipe:caramel');
 old.tasks.push({...root,id:'external',batchId:'external-batch',requires:[caramel.id]});assert.throws(()=>rules.refreshRecipePlan(old,f.recipes,root.id,rules.currentPlanCommand(old,root)),/andere productie/);
});

test('refreshing through the API uses canonical new recipe data and commits atomically with both revisions',async()=>{
 const a=api({id:'manager',active:true,role:'manager'});a.state.tasks=rules.buildRecipePlan(a.state,a.recipes,a.command).tasks;
 const root=a.state.tasks.find(t=>t.id==='order-1');a.source.recipes.find(r=>r.id==='mousse').semiFinishedItems[0].quantity=3000;
 const refresh=()=>new Request('https://app.invalid/api/productie/plan',{method:'POST',body:JSON.stringify({replaceTaskId:root.id,command:rules.currentPlanCommand(a.state,root),revision:3,recipeRevision:7})});
 const response=await a.route.POST(refresh());assert.equal(response.status,200);const result=await response.json();assert.equal(result.state.tasks.find(t=>t.itemId==='recipe:caramel').quantity,6);assert.equal(a.writes(),1);
 const b=api({id:'manager',active:true,role:'manager'});b.state.tasks=rules.buildRecipePlan(b.state,b.recipes,b.command).tasks;b.state.tasks.find(t=>t.itemId==='recipe:caramel').status='active';
 const blocked=await b.route.POST(new Request('https://app.invalid/api/productie/plan',{method:'POST',body:JSON.stringify({replaceTaskId:'order-1',command:rules.currentPlanCommand(b.state,b.state.tasks.find(t=>t.id==='order-1')),revision:3,recipeRevision:7})}));assert.equal(blocked.status,400);assert.equal(b.writes(),0);
});
test('newly introduced preparations use unique identities and stale recipe or planner revisions cannot refresh a plan',async()=>{
 const f=fixture(),old=rules.buildRecipePlan(f.state,f.recipes,f.command),root=old.tasks.find(t=>t.id==='order-1');
 f.recipes.push({...f.recipes[1],id:'new',name:'Nieuw halffabricaat',semiFinishedItems:[]});old.items.push({...old.items[1],id:'recipe:new',recipeId:'new',name:'Nieuw halffabricaat'});f.recipes[0].semiFinishedItems.push({recipeId:'new',quantity:1,unit:'kg'});
 const next=rules.refreshRecipePlan(old,f.recipes,root.id,rules.currentPlanCommand(old,root));assert(workspace.validWorkspace(next,f.recipes));assert.equal(next.tasks.length,7);assert.equal(new Set(next.tasks.map(t=>t.id)).size,7);
 for(const [revision,recipeRevision] of [[2,7],[3,6]]){const a=api({id:'manager',active:true,role:'manager'});a.state.tasks=rules.buildRecipePlan(a.state,a.recipes,a.command).tasks;const response=await a.route.POST(new Request('https://app.invalid/api/productie/plan',{method:'POST',body:JSON.stringify({replaceTaskId:'order-1',command:a.command,revision,recipeRevision})}));assert.equal(response.status,409);assert.equal(a.writes(),0);}
});

test('unconfirmed preparation departments inherit the clicked category while confirmed departments and explicit choices remain', () => {
 const { state, recipes, command } = fixture();
 command.task.departmentId = 'luxe';
 state.items.find(item => item.recipeId === 'mousse').departmentUnconfirmed = true;
 state.items.find(item => item.recipeId === 'caramel').departmentUnconfirmed = true;
 command.preparation.choices = { caramel: { departmentId: 'slagroom' } };
 const proposal = rules.preparationProposal(state, recipes, command);
 assert.equal(proposal.errors.length, 0);
 assert.equal(proposal.rows.find(row => row.recipeId === 'mousse').departmentId, 'luxe');
 assert.equal(proposal.rows.find(row => row.recipeId === 'caramel').departmentId, 'slagroom');
 assert.equal(proposal.rows.find(row => row.recipeId === 'base').departmentId, 'bak');
 const next = rules.buildRecipePlan(state, recipes, command);
 assert.equal(next.tasks.find(task => task.id === 'order-1').departmentId, 'luxe');
 assert.equal(next.tasks.find(task => task.itemId === 'recipe:mousse').departmentId, 'luxe');
 assert(workspace.validWorkspace(next, recipes));
});

test('component workstation defaults stay narrow and leave unrelated recipes unassigned', () => {
 for (const name of ['Sloffendeeg', 'Sloffen deeg', 'Slof-deeg', 'Sloffendeeg (basis)']) assert.equal(planning.defaultComponentDepartment(name), 'bak');
 for (const name of ['Decoratie', 'Decoraties', 'Chocolade decoratie', 'Chocoladedecoratie', 'Choco-versiering', 'Decoratie van chocolade']) assert.equal(planning.defaultComponentDepartment(name), 'chocolade');
 for (const name of ['Fruitdecoratie', 'Decoratie fruit', 'Mousse met chocolade decoratie', 'Chocolademousse', 'Chocoladeganache', 'Slagroom', 'Sloffen']) assert.equal(planning.defaultComponentDepartment(name), undefined);
});

test('unassigned sloffendeeg and chocolate decorations use their workstations while saved and per-plan departments win', () => {
 const {state, recipes, command} = fixture();
 command.task.departmentId = 'luxe';
 for (const [id, name] of [['base', 'Sloffendeeg'], ['mousse', 'Decoratie']]) {
  recipes.find(recipe => recipe.id === id).name = name;
  Object.assign(state.items.find(item => item.recipeId === id), {name, departmentUnconfirmed: true});
 }
 state.items.find(item => item.recipeId === 'caramel').departmentUnconfirmed = true;
 const before = JSON.stringify(state);
 const proposal = rules.preparationProposal(state, recipes, command);
 assert.equal(proposal.errors.length, 0);
 assert.equal(proposal.rows.find(row => row.recipeId === 'base').departmentId, 'bak');
 assert.equal(proposal.rows.find(row => row.recipeId === 'mousse').departmentId, 'chocolade');
 assert.equal(proposal.rows.find(row => row.recipeId === 'caramel').departmentId, 'luxe');
 assert.equal(proposal.rows.find(row => row.recipeId === 'base').departmentUnconfirmed, false);
 const next = rules.buildRecipePlan(state, recipes, command);
 assert.equal(next.tasks.find(task => task.itemId === 'recipe:base').departmentId, 'bak');
 assert.equal(next.tasks.find(task => task.itemId === 'recipe:mousse').departmentId, 'chocolade');
 assert.equal(next.tasks.find(task => task.id === 'order-1').departmentId, 'luxe');
 assert.equal(JSON.stringify(state), before);
 state.items.find(item => item.recipeId === 'base').departmentId = 'brood';
 state.items.find(item => item.recipeId === 'base').departmentUnconfirmed = false;
 command.preparation.choices.mousse = {departmentId: 'slagroom'};
 const overridden = rules.preparationProposal(state, recipes, command);
 assert.equal(overridden.rows.find(row => row.recipeId === 'base').departmentId, 'brood');
 assert.equal(overridden.rows.find(row => row.recipeId === 'mousse').departmentId, 'slagroom');
});

test('catalog defaults apply to unassigned legacy components without relocating existing tasks or explicit departments', () => {
 const data = {ingredients: [], recipes: [
  {id: 'dough', name: 'Sloffendeeg', type: 'semiFinished', standardBatchQuantity: 5, standardBatchUnit: 'kg'},
  {id: 'decoration', name: 'Decoratie', type: 'semiFinished', standardBatchQuantity: 5, standardBatchUnit: 'kg'},
  {id: 'mousse', name: 'Chocolademousse', type: 'semiFinished', standardBatchQuantity: 5, standardBatchUnit: 'kg'},
  {id: 'ice', name: 'Decoratie', type: 'semiFinished', productGroup: 'IJs', standardBatchQuantity: 5, standardBatchUnit: 'kg'},
  {id: 'final', name: 'Sloffendeeg', type: 'finalProduct', standardBatchQuantity: 5, standardBatchUnit: 'kg'},
 ]};
 const seeded = workspace.seedWorkspace(data);
 assert.equal(seeded.items.find(item => item.recipeId === 'dough').departmentId, 'bak');
 assert.equal(seeded.items.find(item => item.recipeId === 'decoration').departmentId, 'chocolade');
 assert.equal(seeded.items.find(item => item.recipeId === 'mousse').departmentUnconfirmed, true);
 assert.equal(seeded.items.find(item => item.recipeId === 'ice').departmentId, 'ijs');
 assert.equal(seeded.items.find(item => item.recipeId === 'final').departmentUnconfirmed, true);
 const legacy = {...seeded, items: seeded.items.map(item => item.recipeId === 'dough' || item.recipeId === 'decoration' ? {...item, departmentId: 'dessert', departmentUnconfirmed: true} : item), tasks: [{id: 'existing', itemId: 'recipe:dough', departmentId: 'luxe'}]};
 const before = JSON.stringify(legacy);
 const current = workspace.syncRecipeCatalog(legacy, data);
 assert.equal(current.items.find(item => item.recipeId === 'dough').departmentId, 'bak');
 assert.equal(current.items.find(item => item.recipeId === 'decoration').departmentId, 'chocolade');
 assert.equal(current.items.find(item => item.recipeId === 'dough').departmentUnconfirmed, false);
 assert.equal(current.tasks, legacy.tasks);
 assert.equal(current.tasks[0].departmentId, 'luxe');
 assert.equal(JSON.stringify(legacy), before);
 current.items.find(item => item.recipeId === 'dough').departmentId = 'brood';
 const reloaded = workspace.syncRecipeCatalog(current, data);
 assert.equal(reloaded.items.find(item => item.recipeId === 'dough').departmentId, 'brood');
});

test('combining batches uses current recipes and one revision-protected server save',async()=>{
 const a=api({id:'manager',active:true,role:'manager'});
 const one=rules.buildRecipePlan(a.state,a.recipes,a.command);
 const two=rules.buildRecipePlan(one,a.recipes,{...a.command,task:{...a.command.task,id:'order-2',batchId:'batch-2'}});
 a.state.tasks.push(...two.tasks);
 const ids=a.state.tasks.filter(t=>t.itemId==='recipe:foam').map(t=>t.id);
 const send=(revision=3,recipeRevision=7)=>a.route.POST(new Request('https://app.invalid/api/productie/plan',{method:'POST',headers:{origin:'https://app.invalid'},body:JSON.stringify({action:'combine',taskIds:ids,revision,recipeRevision})}));
 assert.equal((await send(2)).status,409);assert.equal(a.writes(),0);
 assert.equal((await send(3,6)).status,409);assert.equal(a.writes(),0);
 const response=await send();assert.equal(response.status,200);const result=await response.json();assert.equal(result.state.tasks.filter(t=>t.itemId==='recipe:foam').length,1);assert.equal(a.writes(),1);
});
