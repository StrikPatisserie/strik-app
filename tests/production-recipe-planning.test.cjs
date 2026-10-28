const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function load(file,imports={}) {const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:name=>{if(!(name in imports))throw Error(`Unmocked ${name}`);return imports[name];},Request,Response,Date,Intl,JSON,Number,Set,Map});return exports;}
const planning=load('app/productie/planning.ts');
const workspace=load('app/productie/workspaceData.ts',{'./planning':planning});
const rules=load('app/productie/recipePlanning.ts',{'./planning':planning});
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
class StoreError extends Error{constructor(message,status=503){super(message);this.status=status;}}
function api(profile,options={}){
 const f=fixture();const source={ingredients:[],recipes:f.recipes.map(r=>({id:r.id,name:r.name,type:r.type,standardBatchQuantity:r.yield,standardBatchUnit:r.unit==='stuks'?'stuk':r.unit,ingredients:[],semiFinishedItems:r.semiFinishedItems.map(l=>({semiFinishedRecipeId:l.recipeId,quantity:l.quantity,unit:l.unit})),allergens:[]}))};
 let writes=0;const route=load('app/api/productie/plan/route.ts',{'@/app/lib/auth/session':{getCurrentProfile:async()=>profile},'@/app/lib/auth/access':{hasFullAccess:p=>p?.role==='manager'},'@/app/productie/documents.server':{ProductionStoreError:StoreError,readDocument:async key=>key==='recipes'?{data:source,revision:7}:{data:f.state,revision:3},saveRecipePlanDocument:async(revision,recipeRevision,state)=>{assert.equal(revision,3);assert.equal(recipeRevision,7);assert(workspace.validWorkspace(state,workspace.recipeViews(source)));if(options.conflict)throw new StoreError('revision-conflict',409);writes++;return 4;}},'@/app/productie/workspaceData':workspace,'@/app/productie/recipePlanning':rules});
 return{route,...f,writes:()=>writes};
}
function request(command,revision=3,recipeRevision=7){return new Request('https://app.invalid/api/productie/plan',{method:'POST',body:JSON.stringify({command,revision,recipeRevision})});}
test('the guarded command endpoint recalculates from canonical recipes and commits the entire plan once',async()=>{
 const a=api({id:'manager',active:true,role:'manager'}),response=await a.route.POST(request(a.command));assert.equal(response.status,200);assert.equal((await response.json()).state.tasks.length,6);assert.equal(a.writes(),1);
 for(const profile of [null,{active:false,role:'manager'},{active:true,role:'bakkerij'}]){const b=api(profile);assert.equal((await b.route.POST(request(b.command))).status,403);assert.equal(b.writes(),0);}
});
test('stale recipe/planner revisions and a concurrent database conflict cannot leave a partial preparation plan',async()=>{
 for(const [revision,recipeRevision] of [[2,7],[3,6]]){const a=api({id:'manager',active:true,role:'manager'});assert.equal((await a.route.POST(request(a.command,revision,recipeRevision))).status,409);assert.equal(a.writes(),0);}
 const a=api({id:'manager',active:true,role:'manager'},{conflict:true});assert.equal((await a.route.POST(request(a.command))).status,409);assert.equal(a.writes(),0);
});
