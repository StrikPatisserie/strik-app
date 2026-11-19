const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const {productionConcurrencyImports}=require('./helpers/production-concurrency.cjs');
function load(file,imports={}) {imports={...productionConcurrencyImports(imports),...imports};const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:name=>{assert(name in imports,`Missing ${name}`);return imports[name];},Date,Intl,JSON,Number,Set,Map,Error,structuredClone});return exports;}
const outputs=load('app/productie/batchOutputs.ts');
const departments=load('app/productie/planningDepartments.ts');
const planning=load('app/productie/planning.ts');
const materials=load('app/productie/materialPlanning.ts',{'./planning':planning});
const recipes=load('app/productie/recipePlanning.ts',{'./planning':planning,'./materialPlanning':materials});
const work=load('app/productie/productionWork.ts',{'./planning':planning,'./recipePlanning':recipes});
const workspace=load('app/productie/workspaceData.ts',{'./planning':planning});
const normal=v=>JSON.parse(JSON.stringify(v));
const yieldA={hazelnutChoux:280,bosscheBollen:920,remainingBatterKg:15};
function fixture(){const items=[{id:'batter',recipeId:'hf030',name:'Soezenbeslag',kind:'component',departmentId:'bak',unit:'kg',stock:0,note:''}];return{version:1,planner:{version:1,items,tasks:['a','b'].map(id=>({id,itemId:'batter',date:'2026-11-19',departmentId:'bak',quantity:90,operation:'Maken',status:'planned',recordsOutput:true,batchId:id,note:'',source:'manual'}))},recipes:[],overrides:{},preparation:{},history:[],work:[],timers:{},completions:{},stockFulfillments:{}};}
const complete=(s,id='a',batchOutputs=yieldA)=>work.confirmTaskCompletion(s,{taskId:id,quantity:90,unmeasured:true,...(batchOutputs===undefined?{}:{batchOutputs})},`done-${id}`,'2026-11-19T09:00:00Z');
test('soezen yield accepts explicit zero and Dutch decimal kg but never infers pieces',()=>{
 assert.deepEqual(normal(outputs.parseBatchOutputDraft({hazelnutChoux:'0',bosscheBollen:'920',remainingBatterKg:'15,25'})),{hazelnutChoux:0,bosscheBollen:920,remainingBatterKg:15.25});
 for(const draft of [{hazelnutChoux:'',bosscheBollen:'920',remainingBatterKg:'15'},{hazelnutChoux:'1.5',bosscheBollen:'920',remainingBatterKg:'15'},{hazelnutChoux:'1',bosscheBollen:'-1',remainingBatterKg:'15'},{hazelnutChoux:'1',bosscheBollen:'2',remainingBatterKg:'abc'}])assert.equal(outputs.parseBatchOutputDraft(draft),undefined);
 for(const value of [null,{},[280,920,15],{...yieldA,extra:1},{...yieldA,hazelnutChoux:NaN},{...yieldA,bosscheBollen:1.5},{...yieldA,remainingBatterKg:-1}])assert.equal(outputs.validBatchOutputs(value),false);
 assert(outputs.validBatchOutputs({hazelnutChoux:0,bosscheBollen:0,remainingBatterKg:0}));
});
test('each completed soezen batch requires three outputs and stores a separate immutable yield',()=>{
 const s=fixture();assert.throws(()=>work.confirmTaskCompletion(s,{taskId:'a',quantity:90,unmeasured:true},'missing','2026-11-19T09:00:00Z'),/drie opbrengsten/);
 const first=complete(s);const second=complete(first,'b',{hazelnutChoux:100,bosscheBollen:0,remainingBatterKg:8.5});
 assert.deepEqual(normal(second.completions.a.batchOutputs),yieldA);assert.equal(second.completions.b.batchOutputs.hazelnutChoux,100);
 assert.equal(s.planner.tasks[0].status,'planned');assert.equal(second.planner.tasks[0].completedQuantity,90);
 assert(second.history[0].summary.includes('920 Bossche bollen'));assert.equal(second.planner.items[0].stock,0,'No guessed piece-to-kg inventory conversion');
});
test('yield capture is limited to actual soezen output tasks',()=>{
 assert(outputs.needsSoezenOutputs({recipeId:'hf030',name:'Choux'},{recordsOutput:true}));
 assert(!outputs.needsSoezenOutputs({recipeId:'hf030',name:'Soezenbeslag'},{recordsOutput:false}));
 const s=fixture();s.planner.items[0].recipeId='other';s.planner.items[0].name='Vanillecreme';assert.throws(()=>complete(s),/alleen bij soezenbeslag/);
});
test('soezen output corrections preserve prior audit and reject concurrent stale yield edits',()=>{
 const done=complete(fixture()),before=normal(done.history),input={taskId:'a',who:'Feline',quantity:90,expectedQuantity:90,expectedBatchOutputs:yieldA,batchOutputs:{...yieldA,bosscheBollen:930}};
 const changed=work.correctCompletedQuantity(done,input,'correction-1','2026-11-19T10:00:00Z');
 assert.equal(changed.completions.a.batchOutputs.bosscheBollen,930);assert.equal(done.completions.a.batchOutputs.bosscheBollen,920);assert.deepEqual(normal(changed.history.slice(0,-1)),before);
 assert.throws(()=>work.correctCompletedQuantity(changed,input,'correction-2','2026-11-19T10:01:00Z'),/intussen gewijzigd/);
});
test('three departments preserve task identity, quantities, completion data and historical snapshots',()=>{
 const history=[{before:{departmentId:'luxe'},after:{departmentId:'slagroom'}}];
 const state={items:[{id:'i',departmentId:'luxe'}],tasks:[{id:'t',itemId:'i',departmentId:'slagroom',quantity:84,status:'done',completedQuantity:84}],recipe:{production:{departmentIds:['dessert','luxe','kapsel','slagroom']}},productionWork:{history,completions:{t:{quantity:84}}}};
 const merged=departments.normalizePlanningDepartments(state);
 assert.equal(merged.items[0].departmentId,'luxe');assert.equal(merged.tasks[0].departmentId,'kapsel');assert.deepEqual(normal(merged.recipe.production.departmentIds),['dessert','luxe','kapsel']);
 assert.deepEqual(normal(merged.tasks[0]),{...state.tasks[0],departmentId:'kapsel'});assert.equal(merged.productionWork,state.productionWork);assert.equal(merged.productionWork.history,history);
 assert.deepEqual(Array.from(planning.DEPARTMENTS.filter(d=>['dessert','luxe','kapsel'].includes(d.id)).map(d=>d.name)),['Fruit','Gebak','Kapsel']);
 assert.equal(state.items[0].departmentId,'luxe');assert.equal(departments.normalizePlanningDepartments(merged),merged);
 assert.deepEqual(Array.from(planning.DEPARTMENTS.filter(d=>d.board==='patisserie').map(d=>d.id)),['dessert','luxe','kapsel','bruidstaarten']);
});
test('workspace validation keeps old completions readable and rejects malformed persisted yield',()=>{
 const s=fixture(),base={...s.planner,productionWork:{overrides:{},preparation:{},history:[],work:[],completions:{a:{id:'old',quantity:90}},timers:{}}};
 assert(workspace.validWorkspace(base,[{id:'hf030',unit:'kg'}]));base.productionWork.completions.a.batchOutputs=yieldA;assert(workspace.validWorkspace(base,[{id:'hf030',unit:'kg'}]));base.productionWork.completions.a.batchOutputs={...yieldA,bosscheBollen:-1};assert(!workspace.validWorkspace(base,[{id:'hf030',unit:'kg'}]));
});
