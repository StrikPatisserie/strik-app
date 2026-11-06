const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function load(file,imports={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:name=>{assert(name in imports,`Missing ${name}`);return imports[name];},Date,Intl,Map,Set,Error,structuredClone});return exports;}
const planning=load('app/productie/planning.ts'),recipes=load('app/productie/recipePlanning.ts',{'./planning':planning}),sample=load('app/preview/productie/sampleData.ts',{'../../productie/planning':planning});
const work=load('app/productie/productionWork.ts',{'./planning':planning,'./recipePlanning':recipes});
const model=load('app/preview/productie/scherm/model.ts',{'../../../productie/planning':planning,'../../../productie/productionWork':work,'../sampleData':sample});
const now='2026-11-06T09:00:00.000Z';
function edit(state,scope='once',taskId='f6',name='Proefbakker'){
 const task=state.planner.tasks.find(t=>t.id===taskId),recipe=structuredClone(model.taskRecipe(state,task));recipe.ingredients[0].quantity=99;recipe.steps=['Aangepaste voorbeeldwerkwijze.'];
 return model.saveRecipeChange(state,{itemId:task.itemId,taskId,scope,who:name,recipe},'change-1',now);
}
test('one-off recipe changes stay with one task and preserve the source and before/after history',()=>{
 const state=model.initialScreenState(),before=JSON.stringify(state),next=edit(state);
 assert.equal(model.taskRecipe(next,next.planner.tasks.find(t=>t.id==='f6')).ingredients[0].quantity,99);
 assert.equal(model.taskRecipe(next,next.planner.tasks.find(t=>t.id==='f7')).ingredients[0].quantity,12);
 assert.equal(next.recipes.find(r=>r.id==='demo-fruit').ingredients[0].quantity,12);
 assert.equal(next.history[0].who,'Proefbakker');assert.equal(next.history[0].at,now);assert.equal(next.history[0].scope,'once');assert.equal(next.history[0].before.ingredients[0].quantity,12);
 assert.equal(JSON.stringify(state),before);assert.equal(JSON.stringify(next.planner),JSON.stringify(state.planner));
});
test('permanent edits update the fixed recipe but do not move or reschedule existing tasks',()=>{
 const state=model.initialScreenState(),next=edit(state,'permanent');
 assert.equal(next.recipes.find(r=>r.id==='demo-fruit').ingredients[0].quantity,99);assert.equal(Object.keys(next.overrides).length,0);
 assert.equal(JSON.stringify(next.planner.tasks),JSON.stringify(state.planner.tasks));assert.equal(next.history[0].scope,'permanent');
 assert.equal(next.history[0].after.semiFinishedItems.length,2);assert.equal(next.history[0].before.ingredients[0].quantity,12);
});
test('a new item without a recipe is schedulable and can receive a fixed recipe later',()=>{
 let state=model.planScreenTask(model.initialScreenState(),{name:'Nieuwe proefslof',departmentId:'luxe',quantity:24,date:'2026-11-06',id:'new',prepare:true});
 const task=state.planner.tasks.find(t=>t.id==='new'),item=state.planner.items.find(i=>i.id===task.itemId);
 assert.equal(item.recipeId,undefined);assert.equal(task.quantity,24);assert.equal(model.taskRecipe(state,task),undefined);
 state=model.saveRecipeChange(state,{itemId:item.id,scope:'permanent',who:'Proefbakker',recipe:{id:'draft',name:'ignored',yield:24,unit:'stuks',ingredients:[{name:'Proefgrondstof',quantity:1000,unit:'gram'}],steps:['Voorbeeldwerkwijze.'],allergens:[]}},'recipe',now);
 assert.equal(model.taskRecipe(state,task).yield,24);assert.equal(state.planner.tasks.filter(t=>t.id==='new').length,1);assert.equal(state.history[0].before,undefined);
});
test('required names and invalid measurements/preparation days are rejected',()=>{
 const state=model.initialScreenState();assert.throws(()=>edit(state,'once','f6',' '),/naam/);
 for(const minutes of [0,-1,1.5,1441,NaN])assert.throws(()=>model.recordWorkTime(state,'f6',minutes,'Bakker','time',now));
 for(const days of [-1,1.5,31])assert.throws(()=>model.setPreparation(state,'demo-kapsel',days,'Bakker','prep',now));
 assert.throws(()=>model.setPreparation(state,'demo-fruit',1,'Bakker','prep',now),/halffabricaat/);
});
test('work measurements preserve quantities, actors and timestamps and produce weighted estimates per operation',()=>{
 let state=model.initialScreenState();state=model.recordWorkTime(state,'f6',60,'Bakker A','a',now);state=model.recordWorkTime(state,'f6',30,'Bakker B','b',now);
 const estimate=model.workEstimate(state,'fruit','Afwerken',96);assert.equal(estimate.minutes,90);assert.equal(estimate.measurements,2);
 assert.equal(model.workEstimate(state,'fruit','Vullen',96),null);assert.equal(state.work[0].quantity,48);assert.equal(state.work[1].who,'Bakker B');assert.equal(state.work[1].at,now);assert.equal(state.history.length,2);
});
test('zero and two-day preparation rules drive new child tasks and keep earlier productions untouched',()=>{
 let state=model.initialScreenState(),tasks=JSON.stringify(state.planner.tasks);
 state=model.setPreparation(state,'demo-kapsel',2,'Bakker','k',now);state=model.setPreparation(state,'demo-creme',0,'Bakker','c',now);
 assert.equal(JSON.stringify(state.planner.tasks),tasks);
 state=model.planScreenTask(state,{itemId:'fruit',departmentId:'dessert',quantity:24,date:'2026-11-06',id:'fresh',prepare:true});
 const children=state.planner.tasks.filter(t=>t.generatedFor==='fresh');
 assert.equal(children.find(t=>t.itemId==='kapsels').date,'2026-11-04');assert.equal(children.find(t=>t.itemId==='creme').date,'2026-11-06');
 assert.equal(children.find(t=>t.itemId==='kapsels').quantity,24);assert.equal(children.find(t=>t.itemId==='creme').quantity,4.8);
 assert.equal(state.history[0].who,'Bakker');assert.equal(state.history[1].scope,'permanent');
});

test('timer survives serialization and excludes paused time when resumed',()=>{
 let state=model.startWorkTimer(model.initialScreenState(),'f6','Bakker A','timer-a',now);
 assert.equal(state.planner.tasks.find(t=>t.id==='f6').status,'active');
 state=JSON.parse(JSON.stringify(state));assert.equal(model.elapsedMilliseconds(state.timers.f6,Date.parse('2026-11-06T09:05:00Z')),300000);
 const repeated=model.startWorkTimer(state,'f6','Bakker A','another-id','2026-11-06T09:04:00Z');assert.equal(repeated,state);
 state=model.pauseWorkTimer(state,'f6','2026-11-06T09:05:00Z');assert.equal(state.timers.f6.elapsedMs,300000);assert.equal(state.timers.f6.runningSince,undefined);
 state=model.startWorkTimer(state,'f6','Bakker A','ignored-id','2026-11-06T09:15:00Z');assert.equal(state.timers.f6.id,'timer-a');
 state=model.pauseWorkTimer(state,'f6','2026-11-06T09:20:00Z');assert.equal(state.timers.f6.elapsedMs,600000);
 assert.equal(state.work.length,0);assert.equal(state.planner.tasks.find(t=>t.id==='f6').status,'active');
});
test('finishing freezes the clock but commits only after time, actual amount and name are confirmed',()=>{
 let state=model.startWorkTimer(model.initialScreenState(),'f6','Bakker A','timer-a',now);
 assert.throws(()=>model.confirmTaskCompletion(state,{taskId:'f6',who:'Bakker A',minutes:10,quantity:45,timerId:'timer-a'},'finish',now),/Stop de timer/);
 state=model.pauseWorkTimer(state,'f6','2026-11-06T09:10:00Z');const before=JSON.stringify(state);
 assert.equal(state.planner.tasks.find(t=>t.id==='f6').status,'active');assert.equal(state.work.length,0);
 const next=model.confirmTaskCompletion(state,{taskId:'f6',who:'Bakker B',minutes:8.5,quantity:45,timerId:'timer-a'},'finish','2026-11-06T09:12:00Z');
 assert.equal(JSON.stringify(state),before);assert.equal(next.planner.tasks.find(t=>t.id==='f6').status,'done');
 assert.equal(next.planner.tasks.find(t=>t.id==='f6').quantity,48);assert.equal(next.completions.f6.quantity,45);assert.equal(next.completions.f6.plannedQuantity,48);
 assert.equal(next.work.at(-1).minutes,8.5);assert.equal(next.work.at(-1).measuredMs,600000);assert.equal(next.work.at(-1).who,'Bakker B');assert.equal(next.history.at(-1).at,'2026-11-06T09:12:00Z');
 const duplicate=model.confirmTaskCompletion(next,{taskId:'f6',who:'Bakker B',minutes:8.5,quantity:45,timerId:'timer-a'},'repeat','2026-11-06T09:12:01Z');assert.equal(duplicate,next);assert.equal(duplicate.work.length,1);
});
test('cancelled completion can resume, and reopening preserves audit without carrying over a finished timer',()=>{
 let state=model.startWorkTimer(model.initialScreenState(),'f6','Bakker','t',now);
 state=model.pauseWorkTimer(state,'f6','2026-11-06T09:01:00Z');state=model.startWorkTimer(state,'f6','Bakker','unused','2026-11-06T09:02:00Z');
 state=model.pauseWorkTimer(state,'f6','2026-11-06T09:03:00Z');assert.equal(state.timers.f6.elapsedMs,120000);
 state=model.confirmTaskCompletion(state,{taskId:'f6',who:'Bakker',minutes:2,quantity:48,timerId:'t'},'finished','2026-11-06T09:04:00Z');
 assert.throws(()=>model.startWorkTimer(state,'f6','Bakker','new','2026-11-06T09:05:00Z'),/Heropen/);
 state=model.reopenTimedTask(state,'f6');assert.equal(state.timers.f6,undefined);assert.equal(state.completions.f6,undefined);assert.equal(state.work.length,1);assert.equal(state.history.length,1);
});
test('completion rejects missing names, invalid quantities, stale timers and invalid manual times',()=>{
 const state=model.initialScreenState(),valid={taskId:'f6',who:'Bakker',minutes:30,quantity:48};
 for(const patch of [{who:' '},{minutes:0},{minutes:1441},{minutes:NaN},{quantity:0},{quantity:1000001},{timerId:'unknown'}])assert.throws(()=>model.confirmTaskCompletion(state,{...valid,...patch},'finish',now));
 const done=model.confirmTaskCompletion(state,valid,'manual',now);assert.equal(done.work[0].measuredMs,undefined);assert.equal(done.work[0].quantity,48);
 assert.equal(model.timerLabel(3599000),'59:59');assert.equal(model.timerLabel(3601000),'01:00:01');
});
