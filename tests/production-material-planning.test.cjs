const {productionConcurrencyImports}=require('./helpers/production-concurrency.cjs');
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function load(file,imports={}){
 imports={...productionConcurrencyImports(imports), './BatchOutputsFields':{__esModule:true,default:()=>null},...imports};
const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:key=>{if(!(key in imports))throw Error(`Unmocked ${key}`);return imports[key]},Date,Intl,Map,Set,Error,structuredClone});return exports;}
const p=load('app/productie/planning.ts'),m=load('app/productie/materialPlanning.ts',{'./planning':p}),r=load('app/productie/recipePlanning.ts',{'./planning':p,'./materialPlanning':m}),w=load('app/productie/workspaceData.ts',{'./planning':p});
function fixture(){
 const recipe=(id,yieldValue,parts=[],type='semiFinished')=>({id,name:id,yield:yieldValue,unit:type==='finalProduct'?'stuks':'kg',type,ingredients:[],steps:[],allergens:[],semiFinishedItems:parts});
 const recipes=[recipe('a',10,[{recipeId:'cream',quantity:4.8,unit:'kg'}],'finalProduct'),recipe('b',10,[{recipeId:'cream',quantity:3200,unit:'gram'}],'finalProduct'),recipe('cream',8,[{recipeId:'base',quantity:2,unit:'kg'}]),recipe('base',2)];
 const state={version:1,items:recipes.map(recipe=>({id:recipe.id,recipeId:recipe.id,name:recipe.name,unit:recipe.unit,kind:recipe.type==='finalProduct'?'product':'component',stock:0,stockKnown:false,note:'',departmentId:'dessert'})),tasks:[]};
 const command=(id,combine=true)=>({task:{id,itemId:id,departmentId:'dessert',date:'2026-11-20',operation:'Afwerken',status:'planned',note:'',source:'manual',batchId:id,recordsOutput:true},amount:10,amountMode:'quantity',preparation:{daysBefore:1,combine,choices:{}}});
 return{recipes,state,command};
}
test('two products reserve 4.8 + 3.2 kg from a single 8 kg output, including a shared nested base',()=>{
 const {state,recipes,command}=fixture();const first=r.buildRecipePlan(state,recipes,command('a')),next=r.buildRecipePlan(first,recipes,command('b'));
 assert.equal(state.tasks.length,0);assert.equal(first.tasks.length,3);assert.equal(next.tasks.length,4);assert(w.validWorkspace(next,recipes));
 const cream=next.tasks.find(t=>t.itemId==='cream'),base=next.tasks.find(t=>t.itemId==='base');assert.equal(cream.quantity,8);assert.equal(base.quantity,2);
 assert.equal(cream.materialNeeds[base.id],2);assert.equal(next.tasks.find(t=>t.id==='a').materialNeeds[cream.id],4.8);assert.equal(next.tasks.find(t=>t.id==='b').materialNeeds[cream.id],3.2);
 assert.deepEqual(Array.from(m.materialConsumers(next,recipes,cream.id),row=>row.quantity),[4.8,3.2]);assert.equal(next.tasks.filter(t=>t.itemId==='cream'&&t.recordsOutput).length,1);
 const done={...next,tasks:next.tasks.map(t=>({...t,status:'done',completedQuantity:t.quantity}))};assert.equal(p.completedOutput(done.items,done.tasks).get('cream'),8);
});
test('a short batch stays a dependency shortage even when its step is checked done',()=>{
 const {state,recipes,command}=fixture();let next=r.buildRecipePlan(r.buildRecipePlan(state,recipes,command('a')),recipes,command('b'));const cream=next.tasks.find(t=>t.itemId==='cream');
 next={...next,tasks:next.tasks.map(t=>t.id===cream.id?{...t,status:'done',completedQuantity:7}:t)};
 for(const id of ['a','b']){assert(p.taskIssues(next.tasks.find(t=>t.id===id),next.tasks,next.items).some(s=>s.includes('minder beschikbaar')));assert.throws(()=>p.transitionTask(next.tasks,id,'active',next.items),/minder beschikbaar/);}
 next={...next,tasks:next.tasks.map(t=>t.id===cream.id?{...t,completedQuantity:8}:t)};assert.equal(p.taskIssues(next.tasks.find(t=>t.id==='a'),next.tasks,next.items).length,0);
});
test('different production days, operations and explicitly separate batches are retained',()=>{
 for(const modify of [c=>c.preparation.combine=false,c=>c.preparation.choices.cream={date:'2026-11-18'},c=>c.preparation.choices.cream={operation:'Bereiden + storten'}]){
  const {state,recipes,command}=fixture();const first=r.buildRecipePlan(state,recipes,command('a'));const second=command('b');modify(second);const next=r.buildRecipePlan(first,recipes,second);assert.equal(next.tasks.filter(t=>t.itemId==='cream').length,2);assert(w.validWorkspace(next,recipes));
 }
});
test('explicit combination is reviewed and rejects active tasks and unknown legacy quantities',()=>{
 const {state,recipes,command}=fixture();const a=command('a',false),b=command('b',false);let next=r.buildRecipePlan(r.buildRecipePlan(state,recipes,a),recipes,b);
 for(const task of next.tasks)if(task.recipePlan)delete task.recipePlan.preparation.combine;
 const cream=next.tasks.filter(t=>t.itemId==='cream'),ids=cream.map(t=>t.id);assert.equal(m.combineMaterialTasks(next,recipes,ids).tasks.filter(t=>t.itemId==='cream').length,1);
 const running={...next,tasks:next.tasks.map(t=>t.id===ids[1]?{...t,status:'active'}:t)};assert.throws(()=>m.combineMaterialTasks(running,recipes,ids),/ongestarte/);
 const legacy=structuredClone(next);for(const task of legacy.tasks)delete task.materialNeeds;recipes.find(r=>r.id==='a').semiFinishedItems[0].unit='platen';assert.throws(()=>m.combineMaterialTasks(legacy,recipes,ids),/recepthoeveelheden/);
});
test('recipe refresh remaps material reservations along with task IDs',()=>{
 const {state,recipes,command}=fixture();const initial=r.buildRecipePlan(state,recipes,command('a',false));recipes[0].semiFinishedItems[0].quantity=5;
 const next=r.refreshRecipePlan(initial,recipes,'a',command('a',false));assert(w.validWorkspace(next,recipes));for(const task of next.tasks)for(const id of Object.keys(task.materialNeeds||{}))assert(task.requires.includes(id));
});

test('the document validator also rejects a forged active consumer with insufficient shared output',()=>{
 const {state,recipes,command}=fixture();const next=r.buildRecipePlan(r.buildRecipePlan(state,recipes,command('a')),recipes,command('b'));
 const forged={...next,tasks:next.tasks.map(t=>t.itemId==='cream'?{...t,status:'done',completedQuantity:7}:t.itemId==='base'?{...t,status:'done',completedQuantity:2}:t.id==='a'?{...t,status:'active'}:t)};
 assert.equal(w.validWorkspace(forged,recipes),false);
});

test('earlier preparations follow nested, shared and legacy links once, across departments and week boundaries', () => {
 const task = (id, date, extra = {}) => ({ id, itemId: id, batchId: id, date, status: 'planned', departmentId: 'dessert', ...extra });
 const end = task('end', '2026-11-20', { requires: ['cream', 'shared'] });
 const state = { items: [], tasks: [end, task('cream', '2026-11-19', { requires: ['base', 'shared'] }), task('base', '2026-11-16', { departmentId: 'bak' }), task('shared', '2026-11-17'), task('legacy', '2026-11-15', { generatedFor: 'cream' }), task('same-day', '2026-11-20', { generatedFor: 'end' }), task('unrelated', '2026-11-14')] };
 const before = JSON.stringify(state);
 assert.deepEqual(Array.from(m.earlierPreparations(state, end), row => row.id), ['legacy', 'base', 'shared', 'cream']);
 state.tasks.find(row => row.id === 'base').requires = ['end'];
 assert.equal(m.earlierPreparations(state, end).length, 4, 'A cycle cannot duplicate or hang the overview');
 state.tasks.find(row => row.id === 'cream').status = 'done';
 state.tasks.find(row => row.id === 'cream').stockFulfillmentId = 'stock-check';
 assert.deepEqual(Array.from(m.earlierPreparations(state, end), row => row.id), ['shared', 'cream']);
 const stable = JSON.parse(before);
 m.earlierPreparations(stable, stable.tasks[0]);
 assert.equal(JSON.stringify(stable), before);
});


test('weekly material notices count consuming batches once, convert units and keep real preparation dates', () => {
 const { state, recipes, command } = fixture();
 let next = r.buildRecipePlan(r.buildRecipePlan(state, recipes, command('a')), recipes, command('b'));
 next.tasks.push({ ...next.tasks.find(task => task.id === 'a'), id: 'finish-a', batchId: 'a', dependsOn: 'a', recordsOutput: false });
 const before = JSON.stringify(next);
 const uses = m.materialUsesByRecipe(next, recipes);
 assert.deepEqual(Array.from(uses.get('cream'), use => [use.task.id, use.quantity, use.unit, use.week, Array.from(use.dates)]), [
  ['a', 4.8, 'kg', '2026-11-16', ['2026-11-19']],
  ['b', 3.2, 'kg', '2026-11-16', ['2026-11-19']],
 ]);
 assert.equal(uses.get('base').length, 1, 'A shared nested batch is a single consumer');
 assert.equal(uses.get('base')[0].quantity, 2);
 assert.equal(JSON.stringify(next), before);
});

test('separate dates remain visible and matching uses recipe identity across item aliases', () => {
 const { state, recipes, command } = fixture();
 let next = r.buildRecipePlan(state, recipes, command('a'));
 const second = command('b'); second.preparation.choices.cream = { date: '2026-11-18' };
 next = r.buildRecipePlan(next, recipes, second);
 const creamB = next.tasks.find(task => task.generatedFor === 'b' && task.itemId === 'cream');
 next.items.push({ ...next.items.find(item => item.id === 'cream'), id: 'cream-alias', unit: 'gram', name: 'Andere zichtbare naam' });
 creamB.itemId = 'cream-alias'; creamB.quantity *= 1000;
 next.tasks.find(task => task.id === 'b').materialNeeds[creamB.id] = 3200;
 let uses = m.materialUsesByRecipe(next, recipes).get('cream');
 assert.deepEqual(Array.from(uses, use => [use.task.id, use.quantity, use.dates[0]]), [['a', 4.8, '2026-11-19'], ['b', 3.2, '2026-11-18']]);
 creamB.date = '2026-11-23';
 uses = m.materialUsesByRecipe(next, recipes).get('cream');
 assert.equal(uses.find(use => use.task.id === 'b').week, '2026-11-23');
 next.items.find(item => item.id === 'cream-alias').recipeId = 'different-recipe';
 assert.equal(m.materialUsesByRecipe(next, recipes).get('different-recipe')[0].quantity, 3200);
});

test('unplanned ingredients use scaled recipe demand and incompatible units stay unknown', () => {
 const { state, recipes, command } = fixture();
 const a = command('a'); a.preparation.choices.cream = { include: false };
 const next = r.buildRecipePlan(state, recipes, a);
 assert.equal(next.tasks.length, 1);
 let use = m.materialUsesByRecipe(next, recipes).get('cream')[0];
 assert.equal(use.quantity, 4.8); assert.equal(use.producerIds.length, 0); assert.equal(use.dates[0], '2026-11-20');
 recipes[0].semiFinishedItems[0].unit = 'platen';
 use = m.materialUsesByRecipe(next, recipes).get('cream')[0];
 assert.equal(use.quantity, null);
});

test('saved material allocations survive recipe changes and split batches are never counted twice', () => {
 const { state, recipes, command } = fixture();
 const next = r.buildRecipePlan(state, recipes, command('a'));
 const root = next.tasks.find(task => task.id === 'a'), first = next.tasks.find(task => task.itemId === 'cream');
 const second = { ...first, id: 'cream-second', batchId: 'cream-second', date: '2026-11-18' };
 next.tasks.push(second);
 root.requires.push(second.id);
 root.materialNeeds[first.id] = 3;
 root.materialNeeds[second.id] = 1.8;
 recipes[0].semiFinishedItems = [];
 const use = m.materialUsesByRecipe(next, recipes).get('cream')[0];
 assert.equal(use.quantity, 4.8);
 assert.deepEqual(Array.from(use.dates), ['2026-11-18', '2026-11-19']);
 assert.equal(use.producerIds.length, 2);
 delete root.materialNeeds[second.id];
 assert.equal(m.materialUsesByRecipe(next, recipes).get('cream')[0].quantity, null);
});
