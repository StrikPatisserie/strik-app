const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function load(file,imports={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:name=>{assert(name in imports,`Missing ${name}`);return imports[name];},Date,Intl,Map,Set,structuredClone});return exports;}
const planning=load('app/productie/planning.ts'),recipePlanning=load('app/productie/recipePlanning.ts',{'./planning':planning}),work=load('app/productie/productionWork.ts',{'./planning':planning,'./recipePlanning':recipePlanning});
const fixture=()=>({version:1,planner:{version:1,items:[{id:'cake',name:'Taart',kind:'product',departmentId:'dessert',unit:'stuks',stock:0,note:'',recipeId:'recipe'}],tasks:[{id:'one',itemId:'cake',quantity:100,operation:'Vullen',date:'2026-11-06',departmentId:'dessert',status:'planned',source:'manual',note:'',batchId:'one',recordsOutput:true}]},recipes:[{id:'recipe',name:'Taart',unit:'stuks',yield:100,ingredients:[{name:'Bloem',quantity:1000,unit:'gram'}],steps:['Vullen'],allergens:[]}],overrides:{},preparation:{},history:[],work:[],timers:{},completions:{}});
const at='2026-11-06T08:00:00Z';
function finish(s,id='one',crewSize=2,minutes=30,quantity=100){return work.confirmTaskCompletion(s,{taskId:id,who:'Bakker',crewSize,minutes,quantity},`done-${id}`,at);}
test('30 elapsed minutes with two staff stores 60 labor minutes and preserves raw timer/team measurements',()=>{
 let s=work.startWorkTimer(fixture(),'one','Bakker','clock',at,2);s=work.pauseWorkTimer(s,'one','2026-11-06T08:30:00Z');s=work.confirmTaskCompletion(s,{taskId:'one',who:'Bakker',minutes:30,quantity:100,crewSize:2,timerId:'clock'},'done-one','2026-11-06T08:31:00Z');
 assert.equal(s.completions.one.crewSize,2);assert.equal(s.completions.one.laborMinutes,60);assert.equal(s.completions.one.measuredCrewSize,2);assert.equal(s.work[0].measuredMs,1800000);assert(s.history[0].summary.includes('60 arbeidsmin'));
 const estimate=work.learnedWorkEstimate(s,'cake','Vullen',200,2);assert.equal(estimate.laborMinutes,120);assert.equal(estimate.minutes,60);assert.equal(estimate.measurements,1);assert.equal(work.learnedWorkEstimate(s,'cake','Vullen',200,1).minutes,120);
});
test('new quantities are weighted by actual output, and multiple crew sizes remain comparable as labor',()=>{
 let s=finish(fixture(),'one',2,30,100);s.planner.tasks.push({...s.planner.tasks[0],id:'two',batchId:'two',status:'planned'});s=finish(s,'two',3,40,200);
 const estimate=work.learnedWorkEstimate(s,'cake','Vullen',150,2);assert.equal(estimate.laborMinutes,90);assert.equal(estimate.minutes,45);assert.equal(estimate.measurements,2);assert.equal(s.planner.tasks[1].quantity,100);assert.equal(s.planner.tasks[1].completedQuantity,200);
});
test('old unknown staffing, corrected/reopened productions, other operations and one-off recipes do not inflate norms',()=>{
 let s=work.confirmTaskCompletion(fixture(),{taskId:'one',who:'Bakker',minutes:30,quantity:100},'legacy',at);assert.equal(s.work[0].crewSize,undefined);assert.equal(work.learnedWorkEstimate(s,'cake','Vullen',100),null);
 s=finish(fixture());assert.equal(work.learnedWorkEstimate(s,'cake','Bakken',100),null);const reopened=work.reopenTimedTask(s,'one');assert.equal(work.learnedWorkEstimate(reopened,'cake','Vullen',100),null);const corrected=finish(reopened,'one',1,10,100);assert.equal(work.learnedWorkEstimate(corrected,'cake','Vullen',100).laborMinutes,10);assert.equal(corrected.work.length,2);
 const once=fixture();once.overrides.one=once.recipes[0];assert.equal(work.learnedWorkEstimate(finish(once),'cake','Vullen',100),null);
});
test('recipe/unit changes and edits during measurement start a new estimate group; crew values are validated on the server model',()=>{
 const s=finish(fixture());for(const patch of [x=>x.recipes[0].ingredients[0].quantity++,x=>x.recipes[0].steps.push('Nieuwe stap'),x=>x.planner.items[0].unit='kg']){const changed=structuredClone(s);patch(changed);assert.equal(work.learnedWorkEstimate(changed,'cake','Vullen',100),null);}
 let changed=work.startWorkTimer(fixture(),'one','Bakker','clock',at,2);changed.recipes[0].yield=150;changed=work.pauseWorkTimer(changed,'one','2026-11-06T08:30:00Z');changed=work.confirmTaskCompletion(changed,{taskId:'one',who:'Bakker',minutes:30,quantity:100,crewSize:2,timerId:'clock'},'edited',at);assert.equal(work.learnedWorkEstimate(changed,'cake','Vullen',100),null);
 for(const crew of [0,-1,1.5,21,NaN,Infinity,'2']){assert.throws(()=>finish(fixture(),'one',crew),/medewerkers/);assert.throws(()=>work.startWorkTimer(fixture(),'one','Bakker','clock',at,crew),/medewerkers/);}
});
test('combined operations record their own confirmed work and learn separately from preparing alone',()=>{
 let state=fixture();state.planner.tasks[0].operation='Bereiden';state=finish(state,'one',1,10,100);
 state.planner.tasks.push({...state.planner.tasks[0],id:'moulded',batchId:'moulded',status:'planned',operation:'Bereiden + storten',minutes:45});
 assert.equal(work.learnedWorkEstimate(state,'cake','Bereiden + storten',100),null);
 state=work.startWorkTimer(state,'moulded','Bakker','mould-timer',at,2);state=work.pauseWorkTimer(state,'moulded','2026-11-06T08:20:00Z');
 state=work.confirmTaskCompletion(state,{taskId:'moulded',who:'Bakker',minutes:20,quantity:100,crewSize:2,timerId:'mould-timer'},'done-moulded','2026-11-06T08:21:00Z');
 assert.equal(state.work.at(-1).operation,'Bereiden + storten');assert.equal(state.work.at(-1).laborMinutes,40);assert.equal(state.planner.tasks.find(task=>task.id==='moulded').minutes,45);
 assert.equal(work.learnedWorkEstimate(state,'cake','Bereiden',100).laborMinutes,10);assert.equal(work.learnedWorkEstimate(state,'cake','Bereiden',100).measurements,1);
 assert.equal(work.learnedWorkEstimate(state,'cake','Bereiden + storten',100,2).minutes,20);assert.equal(work.learnedWorkEstimate(state,'cake','Bereiden + storten',100).measurements,1);assert.equal(work.learnedWorkEstimate(state,'cake','Bereiden + vullen',100),null);
});
test('changed operations and legacy timers without an operation snapshot do not train a combined-operation norm',()=>{
 let changed=fixture();changed.planner.tasks[0].operation='Bereiden';changed=work.startWorkTimer(changed,'one','Bakker','timer',at,2);
 assert.equal(changed.timers.one.operation,'Bereiden');changed.planner.tasks[0].operation='Bereiden + storten';changed=work.pauseWorkTimer(changed,'one','2026-11-06T08:20:00Z');
 changed=work.confirmTaskCompletion(changed,{taskId:'one',who:'Bakker',minutes:20,quantity:100,crewSize:2,timerId:'timer'},'changed-operation','2026-11-06T08:21:00Z');
 assert.equal(changed.work[0].operation,'Bereiden + storten');assert.equal(changed.work[0].estimateEligible,false);assert.equal(work.learnedWorkEstimate(changed,'cake','Bereiden + storten',100),null);assert.equal(work.learnedWorkEstimate(changed,'cake','Bereiden',100),null);
 let legacy=work.startWorkTimer(fixture(),'one','Bakker','legacy-timer',at,1);delete legacy.timers.one.operation;
 legacy=work.pauseWorkTimer(legacy,'one','2026-11-06T08:10:00Z');legacy=work.startWorkTimer(legacy,'one','Bakker','ignored-new-id','2026-11-06T08:11:00Z',1);assert.equal(legacy.timers.one.operation,undefined);
 legacy=work.pauseWorkTimer(legacy,'one','2026-11-06T08:20:00Z');legacy=work.confirmTaskCompletion(legacy,{taskId:'one',who:'Bakker',minutes:19,quantity:100,crewSize:1,timerId:'legacy-timer'},'legacy-operation','2026-11-06T08:21:00Z');
 assert.equal(legacy.work[0].estimateEligible,false);assert.equal(work.learnedWorkEstimate(legacy,'cake','Vullen',100),null);
});
