const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function load(file,imports={}){
 const exports={};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},
 }).outputText,{exports,require:name=>{assert(name in imports,`Missing ${name}`);return imports[name];},Map,Number,Set,Date,JSON,structuredClone});
 return exports;
}
const planning=load('app/productie/planning.ts');
const recipePlanning=load('app/productie/recipePlanning.ts',{'./planning':planning});
const productionWork=load('app/productie/productionWork.ts',{'./planning':planning,'./recipePlanning':recipePlanning});
const {taskWorkSummary,departmentDayWork}=load('app/productie/workSummary.ts',{'./productionWork':productionWork});
const task=(id,changes={})=>({id,itemId:'mousse',departmentId:'dessert',date:'2026-11-10',quantity:10,operation:'Maken',status:'planned',note:'',source:'manual',batchId:id,recordsOutput:true,...changes});
const state=(tasks=[],completions={},timers={})=>({version:1,items:[],tasks,productionWork:{overrides:{},preparation:{},history:[],work:[],completions,timers}});
const normal=value=>JSON.parse(JSON.stringify(value));

test('a current completion exposes its duration, crew and productive person-minutes',()=>{
 const done=task('complete',{status:'done'}),workspace=state([done],{complete:{minutes:30,crewSize:2,laborMinutes:60}});
 assert.deepEqual(normal(taskWorkSummary(workspace,done)),{minutes:30,crewSize:2,laborMinutes:60,fromStock:false});
 assert.deepEqual(normal(departmentDayWork(workspace).get('dessert:2026-11-10')),{totalTaskCount:1,doneCount:1,doneLaborMinutes:60,doneMissingCount:0,plannedLaborMinutes:0,plannedMissingCount:0});
 const inconsistent=state([done],{complete:{minutes:30,crewSize:2,laborMinutes:600}});
 assert.equal(taskWorkSummary(inconsistent,done).laborMinutes,60,'Duration and crew take precedence over an inconsistent cached total');
});

test('legacy completions retain unknown crew and never silently count as one person',()=>{
 const legacy=task('legacy',{status:'done'}),missing=task('missing',{status:'done'});
 const workspace=state([legacy,missing],{legacy:{minutes:45}});
 workspace.productionWork.work.push({taskId:'missing',minutes:50,crewSize:2,laborMinutes:100});
 assert.deepEqual(normal(taskWorkSummary(workspace,legacy)),{minutes:45,fromStock:false});
 assert.deepEqual(normal(taskWorkSummary(workspace,missing)),{fromStock:false});
 const total=departmentDayWork(workspace).get('dessert:2026-11-10');
 assert.equal(total.doneLaborMinutes,0);assert.equal(total.doneMissingCount,2);
 const stored=state([legacy],{legacy:{minutes:45,laborMinutes:90}});
 assert.equal(taskWorkSummary(stored,legacy).crewSize,undefined);
 assert.equal(taskWorkSummary(stored,legacy).laborMinutes,90,'A recorded person-minute total can remain usable when legacy crew metadata is absent');
});

test('stock fulfillment accounts for zero production work without inventing a duration or crew',()=>{
 const stock=task('stock',{status:'done',stockFulfillmentId:'stock-check',minutes:60});
 const workspace=state([stock],{stock:{minutes:50,crewSize:2,laborMinutes:100}});
 assert.deepEqual(normal(taskWorkSummary(workspace,stock)),{fromStock:true,laborMinutes:0});
 const total=departmentDayWork(workspace).get('dessert:2026-11-10');
 assert.equal(total.doneCount,1);assert.equal(total.doneLaborMinutes,0);assert.equal(total.doneMissingCount,0);assert.equal(total.plannedLaborMinutes,0);
});

test('reopened tasks ignore stale completions and historical measurements',()=>{
 for(const status of ['planned','active','blocked']){
  const reopened=task('reopened',{status,minutes:20});
  const workspace=state([reopened],{reopened:{minutes:90,crewSize:3,laborMinutes:270}});
  workspace.productionWork.work.push({taskId:'reopened',minutes:90,crewSize:3,laborMinutes:270});
  assert.deepEqual(normal(taskWorkSummary(workspace,reopened)),{fromStock:false});
  const total=departmentDayWork(workspace).get('dessert:2026-11-10');
  assert.equal(total.doneCount,0);assert.equal(total.doneLaborMinutes,0);assert.equal(total.plannedLaborMinutes,20);
 }
});

test('remaining estimates multiply an active recorded crew and accept an explicit zero estimate',()=>{
 const tasks=[task('planned',{minutes:30}),task('active',{status:'active',minutes:15}),task('zero',{minutes:0}),task('unknown'),task('blocked',{status:'blocked',minutes:10})];
 const workspace=state(tasks,{}, {active:{crewSize:3},planned:{crewSize:5}});
 const before=JSON.stringify(workspace),totals=departmentDayWork(workspace),total=totals.get('dessert:2026-11-10');
 assert.equal(total.totalTaskCount,5);assert.equal(total.plannedLaborMinutes,85);assert.equal(total.plannedMissingCount,1);
 assert.equal(total.doneCount,0);assert.equal(JSON.stringify(workspace),before,'Summarizing is read-only');
});

test('invalid times and crew sizes remain unknown rather than producing NaN or negative totals',()=>{
 const tasks=[...[-10,NaN,Infinity].map((minutes,index)=>task(`bad-${index}`,{minutes})),task('active',{status:'active',minutes:10}),task('done',{status:'done'})];
 for(const crewSize of [0,-2,1.5,21,NaN,Infinity]){
  const workspace=state(tasks,{done:{minutes:-5,crewSize,laborMinutes:NaN}},{active:{crewSize}});
  assert.deepEqual(normal(taskWorkSummary(workspace,tasks.at(-1))),{fromStock:false});
  const total=departmentDayWork(workspace).get('dessert:2026-11-10');
  assert.equal(total.plannedLaborMinutes,10);assert.equal(total.plannedMissingCount,3);assert.equal(total.doneMissingCount,1);
 }
});

test('daily department totals include every status and isolate date/department boundaries',()=>{
 const tasks=[task('done',{status:'done'}),task('planned',{minutes:40}),task('active',{status:'active',minutes:20}),task('other-day',{date:'2026-11-11',minutes:15}),task('other-department',{departmentId:'bak',minutes:35})];
 const workspace=state(tasks,{done:{minutes:30,crewSize:2}},{active:{crewSize:2}}),totals=departmentDayWork(workspace);
 assert.equal(totals.size,3);
 const today=totals.get('dessert:2026-11-10');
 assert.equal(today.totalTaskCount,3);assert.equal(today.doneCount,1);assert.equal(today.doneLaborMinutes,60);assert.equal(today.plannedLaborMinutes,80);
 assert.equal(totals.get('dessert:2026-11-11').plannedLaborMinutes,15);
 assert.equal(totals.get('bak:2026-11-10').plannedLaborMinutes,35);
 assert.equal(departmentDayWork(state()).size,0);
});


function learnedFixture(){
 const recipes=[{id:'recipe-mousse',name:'Mousse',yield:10,unit:'kg',ingredients:[{name:'Melk',quantity:10,unit:'kg'}],steps:['Maken'],allergens:[]}];
 const workspace=state([task('previous',{date:'2026-11-03'})]);
 workspace.items.push({id:'mousse',name:'Mousse',kind:'component',departmentId:'dessert',unit:'kg',recipeId:'recipe-mousse',stock:0,note:''});
 const completed=productionWork.confirmTaskCompletion(productionWork.workView(workspace,recipes),{taskId:'previous',who:'Bakker',minutes:30,quantity:10,crewSize:2},'completion-previous','2026-11-03T10:00:00.000Z');
 return {workspace:productionWork.storeWork(completed,workspace.productionWork),recipes};
}

test('recorded recipe work supplies open estimates when explicit time is absent and recipes are supplied',()=>{
 const {workspace,recipes}=learnedFixture();
 workspace.tasks.push(task('future',{quantity:20}),task('active-future',{quantity:20,status:'active'}));
 workspace.productionWork.timers['active-future']={crewSize:3};
 const withoutRecipes=departmentDayWork(workspace).get('dessert:2026-11-10');
 assert.equal(withoutRecipes.plannedMissingCount,2);assert.equal(withoutRecipes.plannedLaborMinutes,0);
 const summary=departmentDayWork(workspace,recipes).get('dessert:2026-11-10');
 assert.equal(summary.plannedMissingCount,0);assert.equal(summary.plannedLaborMinutes,240,'Each task requires 120 person-minutes; an active crew does not multiply an already learned labor estimate');
 assert.equal(departmentDayWork(workspace,recipes).get('dessert:2026-11-03').doneLaborMinutes,60);
});

test('explicit estimates override learned norms and one-off recipe changes do not use ordinary learned times',()=>{
 const {workspace,recipes}=learnedFixture();
 workspace.tasks.push(task('explicit',{minutes:15}),task('explicit-active',{minutes:10,status:'active'}),task('zero-explicit',{minutes:0}),task('one-off'),task('invalid-explicit',{minutes:-1}));
 workspace.productionWork.timers['explicit-active']={crewSize:2};
 workspace.productionWork.overrides['one-off']=recipes[0];
 const summary=departmentDayWork(workspace,recipes).get('dessert:2026-11-10');
 assert.equal(summary.plannedLaborMinutes,95,'15 explicit + 20 active explicit + 0 explicit + 60 learned fallback');
 assert.equal(summary.plannedMissingCount,1,'The one-off task has no reliable matching norm');
 const changedRecipes=structuredClone(recipes);changedRecipes[0].yield=11;
 const afterRecipeEdit=departmentDayWork(workspace,changedRecipes).get('dessert:2026-11-10');
 assert.equal(afterRecipeEdit.plannedLaborMinutes,35);assert.equal(afterRecipeEdit.plannedMissingCount,2,'An edited recipe requires its own confirmed measurements');
 delete workspace.productionWork.completions.previous;
 const reopenedHistory=departmentDayWork(workspace,recipes).get('dessert:2026-11-10');
 assert.equal(reopenedHistory.plannedLaborMinutes,35);assert.equal(reopenedHistory.plannedMissingCount,2,'Reopened historical measurements are excluded by the shared estimator');
});
