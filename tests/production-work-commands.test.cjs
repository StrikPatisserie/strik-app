const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function load(file,imports={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:name=>{assert(name in imports,`Missing ${name}`);return imports[name];},Date,Intl,Map,Set,structuredClone,Request,Response,URL});return exports;}
const planning=load('app/productie/planning.ts'),recipePlanning=load('app/productie/recipePlanning.ts',{'./planning':planning}),work=load('app/productie/productionWork.ts',{'./planning':planning,'./recipePlanning':recipePlanning}),commands=load('app/productie/workCommands.ts',{'./productionWork':work}),workspace=load('app/productie/workspaceData.ts',{'./planning':planning}),access=load('app/lib/auth/access.ts'),rights=load('app/productie/access.ts',{'../lib/auth/access':access,'./planning':planning});
const recipeData={ingredients:[],recipes:[],manualProductionPlanningItems:[]},recipes=[];
const fixture=()=>({version:1,items:[{id:'cake',name:'Taart zonder recept',kind:'product',departmentId:'dessert',unit:'stuks',stock:0,note:''}],tasks:[{id:'task',itemId:'cake',date:'2026-11-06',departmentId:'dessert',operation:'Maken',status:'planned',quantity:1000,source:'manual',note:'',batchId:'batch',recordsOutput:true}],productionRequests:[]});
const baker={id:'account-baker',active:true,role:'bakkerij',permissions:{'bakkerij.patisserie':true}},at='2026-11-06T08:00:00Z';
const apply=(state,command,id='action-100',time=at)=>commands.applyWorkCommand(state,recipes,command,['dessert'],'account-baker',id,time);
test('shared start/pause/completion preserves planned output and stores confirmed amount plus server identity and raw timing',()=>{
 let state=fixture(),before=JSON.stringify(state);state=apply(state,{kind:'start',taskId:'task',who:'Bakker A'});assert.equal(state.tasks[0].status,'active');assert.equal(JSON.stringify(fixture()),before);assert.equal(state.productionWork.timers.task.actorId,baker.id);
 state=apply(JSON.parse(JSON.stringify(state)),{kind:'pause',taskId:'task'},'pause-100','2026-11-06T08:12:00Z');assert.equal(state.productionWork.timers.task.elapsedMs,720000);assert(!state.productionWork.timers.task.runningSince);
 state=apply(state,{kind:'complete',taskId:'task',who:'Bakker A',minutes:15,quantity:980,timerId:'action-100'},'finish-100','2026-11-06T08:13:00Z');
 assert.equal(state.tasks[0].quantity,1000);assert.equal(state.tasks[0].completedQuantity,980);assert.equal(planning.completedOutput(state.items,state.tasks).get("cake"),980);assert.equal(state.productionWork.work[0].actorId,baker.id);assert.equal(state.productionWork.work[0].measuredMs,720000);assert.equal(state.productionWork.completions.task.plannedQuantity,1000);assert.equal(state.productionWork.history[0].who,'Bakker A');
 const reopened=apply(state,{kind:'reopen',taskId:'task'},'reopen-100');assert.equal(reopened.tasks[0].completedQuantity,undefined);assert.equal(reopened.productionWork.work.length,1);assert(!reopened.productionWork.timers.task);
});
test('cross-department writes, missing names, running or replaced timers and forged generic work are rejected',()=>{
 const state=fixture();assert.throws(()=>commands.applyWorkCommand(state,[],{kind:'start',taskId:'task',who:'Bakker'},['ijs'],'actor','abc',at),/toegang/);assert.throws(()=>apply(state,{kind:'start',taskId:'task',who:' '}),/naam/);
 const running=apply(state,{kind:'start',taskId:'task',who:'Bakker'});assert.throws(()=>apply(running,{kind:'complete',taskId:'task',who:'Bakker',minutes:12,quantity:1000,timerId:'action-100'}),/Stop/);
 const paused=apply(running,{kind:'pause',taskId:'task'});assert.throws(()=>apply(paused,{kind:'complete',taskId:'task',who:'Bakker',minutes:12,quantity:1000,timerId:'old'}),/gewijzigd/);
 for(const edit of [s=>s.productionWork.history.push({who:'forged'}),s=>s.tasks[0].completedQuantity=1000,s=>s.tasks[0].status='done']){const next=structuredClone(paused);edit(next);assert.throws(()=>commands.assertWorkUnchanged(paused,next));}
});
class StoreError extends Error{constructor(message,status=503){super(message);this.status=status;}}
function endpoint(profile=baker,fail=false){const store={planner:{data:fixture(),revision:1,updated_at:at},recipes:{data:recipeData,revision:1}},writes=[];const route=load('app/api/productie/werk/route.ts',{'@/app/lib/auth/session':{getCurrentProfile:async()=>profile},'@/app/productie/access':rights,'@/app/productie/workspaceData':workspace,'@/app/productie/workCommands':commands,'@/app/productie/documents.server':{ProductionStoreError:StoreError,readDocument:async key=>store[key],saveDocument:async(key,revision,data,actor)=>{if(fail||revision!==store[key].revision)throw new StoreError('Conflict',409);writes.push({data,actor});store[key]={data,revision:revision+1,updated_at:new Date().toISOString()};return revision+1;}}});return{route,store,writes};}
const post=(command,id='action-test-100',revision=1,origin='https://app.invalid')=>new Request('https://app.invalid/api/productie/werk',{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify({command,id,revision})});
test('command API requires an active production account, own department, valid origin and current revision',async()=>{
 for(const profile of [null,{...baker,active:false},{...baker,role:'winkel'},{...baker,permissions:{'bakkerij.ijs_chocolade':true}}]){const e=endpoint(profile),response=await e.route.POST(post({kind:'start',taskId:'task',who:'Bakker'}));assert([400,403].includes(response.status));assert.equal(e.writes.length,0);}
 for(const request of [post({kind:'start',taskId:'task',who:'Bakker'},'action-test-100',0),post({kind:'start',taskId:'task',who:'Bakker'},'action-test-100',1,'https://foreign.invalid')]){const e=endpoint();assert.notEqual((await e.route.POST(request)).status,200);assert.equal(e.writes.length,0);}
 const e=endpoint(baker,true);assert.equal((await e.route.POST(post({kind:'start',taskId:'task',who:'Bakker'}))).status,409);assert.equal(e.store.planner.data.tasks[0].status,'planned');
});
test('a retried action never duplicates work and a competing stale action cannot overwrite the stored timer',async()=>{
 const e=endpoint(),command={kind:'start',taskId:'task',who:'Bakker'};let response=await e.route.POST(post(command));assert.equal(response.status,200);assert.match(response.headers.get('Cache-Control'),/no-store/);const data=await response.json();assert.equal(data.state.productionWork.timers.task.actorId,baker.id);
 response=await e.route.POST(post(command));assert.equal(response.status,200);assert.equal(e.writes.length,1);
 response=await e.route.POST(post({kind:'pause',taskId:'task'},'different-action-100'));assert.equal(response.status,409);assert.equal(e.writes.length,1);assert(e.store.planner.data.productionWork.timers.task.runningSince);
});

const stockCommand={kind:'stock',taskId:'task',who:'Bakker A',countedQuantity:1200,confirmed:true};
test('physical stock fulfillment completes the planned amount atomically without manufacturing output or work measurements',()=>{
 const original=fixture();
 original.items.push({...original.items[0],id:'ingredient',kind:'component'},{...original.items[0],id:'assembled'});
 original.tasks[0].requires=['preparation'];
 original.tasks.push({...original.tasks[0],id:'preparation',itemId:'ingredient',date:'2026-11-05',batchId:'prep',requires:[]},{...original.tasks[0],id:'consumer',itemId:'assembled',date:'2026-11-07',batchId:'assembled',requires:['task']});
 const before=JSON.stringify(original),next=apply(original,stockCommand,'stock-action-100');
 assert.equal(JSON.stringify(original),before);
 assert.equal(next.tasks[0].status,'done');assert.equal(next.tasks[0].quantity,1000);assert.equal(next.tasks[0].completedQuantity,undefined);assert.equal(next.tasks[0].stockFulfillmentId,'stock-action-100');
 const stock=next.productionWork.stockFulfillments.task;
 assert.equal(stock.countedQuantity,1200);assert.equal(stock.quantity,1000);assert.equal(stock.remainingQuantity,200);assert.equal(stock.unit,'stuks');assert.equal(stock.actorId,baker.id);assert.equal(stock.who,'Bakker A');assert.equal(stock.at,at);
 assert.equal(next.productionWork.work.length,0);assert.equal(Object.keys(next.productionWork.completions).length,0);assert.equal(Object.keys(next.productionWork.timers).length,0);assert.equal(next.productionWork.history[0].kind,'stock');
 assert.equal(planning.completedOutput(next.items,next.tasks).has('cake'),false);
 assert.equal(workspace.validWorkspace(next,recipes),true);
 assert.equal(planning.transitionTask(next.tasks,'consumer','active',next.items).find(row=>row.id==='consumer').status,'active');
 assert.equal(planning.removePlannedTask(next.tasks,'preparation').some(row=>row.id==='preparation'),false,'manufacturing dependencies are no longer needed for stock fulfillment');
 assert.equal(workspace.validWorkspace({...next,tasks:planning.removePlannedTask(next.tasks,'preparation')},recipes),true);
 assert.equal(work.learnedWorkEstimate(work.workView(next,recipes),'cake','Maken',1000),null);
});
test('stock requires enough physically counted stock, a name, explicit confirmation and an unstarted output task',()=>{
 for(const override of [{countedQuantity:999},{countedQuantity:-1},{countedQuantity:Infinity},{countedQuantity:NaN},{countedQuantity:1000001},{who:' '},{confirmed:false}])assert.throws(()=>apply(fixture(),{...stockCommand,...override},'stock-invalid'));
 for(const edit of [state=>state.tasks[0].status='active',state=>state.tasks[0].status='done',state=>state.tasks[0].recordsOutput=false,state=>state.items[0].kind='activity']){
  const state=fixture();edit(state);assert.throws(()=>apply(state,stockCommand,'stock-invalid'));
 }
 const started=apply(fixture(),{kind:'start',taskId:'task',who:'Bakker A'});assert.throws(()=>apply(started,stockCommand,'stock-invalid'),/gestart/);
 assert.throws(()=>commands.applyWorkCommand(fixture(),[],stockCommand,['ijs'],'wrong-account','stock-invalid',at),/toegang/);
 const wedding=fixture();wedding.tasks[0].weddingCode='wedding';assert.throws(()=>apply(wedding,stockCommand,'stock-invalid'),/bruidstaart/);
});
test('stock fulfillment is replay safe and its ledger, quantity, identity and completed state cannot be forged or reopened',()=>{
 const next=apply(fixture(),stockCommand,'stock-action-100');
 assert.equal(apply(next,stockCommand,'stock-action-100'),next);
 const older={...next,productionWork:{...next.productionWork,receipts:[]}};
 assert.equal(apply(older,stockCommand,'stock-action-100'),older,'persistent ledger deduplicates even after the receipt window');
 assert.throws(()=>apply(next,stockCommand,'stock-action-101'),/afgerond/);
 assert.throws(()=>apply(next,{kind:'reopen',taskId:'task'},'reopen-stock'),/Voorraadbeheer/);
 for(const edit of [state=>state.productionWork.stockFulfillments.task.remainingQuantity=1200,state=>state.tasks[0].stockFulfillmentId=undefined,state=>state.tasks[0].status='planned',state=>state.tasks[0].quantity=10,state=>state.tasks=[]]){
  const forged=structuredClone(next);edit(forged);assert.throws(()=>commands.assertWorkUnchanged(next,forged));
 }
 for(const edit of [state=>state.productionWork.stockFulfillments.task.unit='kg',state=>state.tasks[0].quantity=10,state=>state.productionWork.stockFulfillments={},state=>state.productionWork.stockFulfillments.task.remainingQuantity=1200]){
  const forged=structuredClone(next);edit(forged);assert.equal(workspace.validWorkspace(forged,recipes),false);
 }
});
test('stock API uses one planner write, rejects concurrent stale counts and deduplicates a completed stock action',async()=>{
 const e=endpoint();e.store.planner.data.tasks.push({...e.store.planner.data.tasks[0],id:'second-task',batchId:'second-batch'});
 const responses=await Promise.all([e.route.POST(post(stockCommand,'stock-request-100')),e.route.POST(post({...stockCommand,taskId:'second-task'},'stock-request-200'))]);
 assert.deepEqual(responses.map(response=>response.status).sort(),[200,409]);assert.equal(e.writes.length,1);
 assert.equal(e.store.planner.data.productionWork.stockFulfillments.task.remainingQuantity,200);assert.equal(e.store.planner.data.tasks.find(row=>row.id==='second-task').status,'planned');
 assert.equal((await e.route.POST(post(stockCommand,'stock-request-100'))).status,200);assert.equal(e.writes.length,1);
 e.store.planner.data.productionWork.receipts=[];
 assert.equal((await e.route.POST(post(stockCommand,'stock-request-100'))).status,200);assert.equal(e.writes.length,1);
 const failed=endpoint(baker,true);assert.equal((await failed.route.POST(post(stockCommand,'stock-fail-100'))).status,409);assert.equal(failed.store.planner.data.tasks[0].status,'planned');assert.equal(failed.store.planner.data.productionWork,undefined);
 for(const profile of [null,{...baker,active:false},{...baker,role:'winkel'},{...baker,permissions:{'bakkerij.ijs_chocolade':true}}]){
  const denied=endpoint(profile);assert.notEqual((await denied.route.POST(post(stockCommand,'stock-denied-100'))).status,200);assert.equal(denied.writes.length,0);
 }
});
