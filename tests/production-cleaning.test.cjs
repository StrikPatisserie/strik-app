const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function load(file,imports={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:name=>{assert(name in imports,`Unmocked ${name}`);return imports[name];},Date,Intl,Set,Map,Response,Request,URL,crypto:require('node:crypto').webcrypto});return exports;}
const planning=load('app/productie/planning.ts'),access=load('app/lib/auth/access.ts'),workspace=load('app/productie/workspaceData.ts',{'./planning':planning});
let sequence=0;const now='2026-10-28T10:00:00.000Z',make=()=>`check-${++sequence}`;
const plan=(date='2026-10-28',extra={})=>({kind:'plan',date,main:'Koelcel reinigen',daily:['Werkbanken reinigen','Vloer schoonmaken'],repeatDates:[],...extra});
const apply=(current,command,actor='baker')=>planning.applyCleaningCommand(current,command,actor,now,make);
test('a cleaning day has one main task, optional daily checks and no recipe or stock side effects',()=>{
 const current=[],next=apply(current,plan());assert.equal(current.length,0);assert.equal(next.length,1);assert(planning.validCleaningDays(next));assert.equal(next[0].main.label,'Koelcel reinigen');assert.equal(next[0].daily.length,2);assert.equal(planning.cleaningProgress(next[0]).total,3);assert.equal(planning.cleaningProgress(next[0]).done,0);
 assert(workspace.validWorkspace({version:1,items:[],tasks:[],cleaning:next},[]));assert(!JSON.stringify(next).includes('recordsOutput'));
 assert.equal(apply([],plan('2026-10-28',{main:'',daily:['Alleen dagelijkse taak']}))[0].main,null);
});
test('daily checks repeat only on selected same-week dates and preserve other days main tasks and checked entries',()=>{
 let days=apply([],plan('2026-10-29',{main:'Vriezer reinigen',daily:['Werkbanken reinigen','Extra taak']}));days=apply(days,{kind:'check',date:'2026-10-29',checkId:days[0].daily[0].id,done:true});const checked=days[0].daily[0];
 days=apply(days,plan('2026-10-28',{repeatDates:['2026-10-26','2026-10-29','2026-10-30']}));assert.equal(days.length,4);assert.equal(days.find(d=>d.date==='2026-10-29').main.label,'Vriezer reinigen');assert.equal(days.find(d=>d.date==='2026-10-26').main,null);assert.deepEqual(days.find(d=>d.date==='2026-10-29').daily[0],checked);assert(days.find(d=>d.date==='2026-10-29').daily.some(c=>c.label==='Extra taak'));
 assert.throws(()=>apply(days,plan('2026-10-28',{repeatDates:['2026-11-02']})),/dezelfde week/);assert.throws(()=>apply(days,plan('2026-10-28',{repeatDates:['2026-10-28']})),/unieke/);
 assert.throws(()=>apply(days,plan('2026-10-28',{daily:[],repeatDates:['2026-10-29']})),/dagelijkse taken/);
});
test('checking records the real actor and timestamp, is idempotent and can be reopened without editing task identity',()=>{
 let days=apply([],plan()),id=days[0].main.id;days=apply(days,{kind:'check',date:days[0].date,checkId:id,done:true});const original=days[0].main;assert.equal(original.completedBy,'baker');assert.equal(original.completedAt,now);
 assert.deepEqual(apply(days,{kind:'check',date:days[0].date,checkId:id,done:true},'other-baker')[0].main,original);
 const reopened=apply(days,{kind:'check',date:days[0].date,checkId:id,done:false});assert.equal(reopened[0].main.id,id);assert.equal(reopened[0].main.done,false);assert.equal(reopened[0].main.completedAt,undefined);assert.equal(original.done,true);
 assert.throws(()=>apply(days,{kind:'check',date:days[0].date,checkId:'foreign-check',done:true}),/bestaande/);
});
test('completed cleaning cannot silently disappear, change wording or move to another day; an invalid repeat is atomic',()=>{
 let days=apply([],plan('2026-10-29'));days=apply(days,{kind:'check',date:'2026-10-29',checkId:days[0].daily[0].id,done:true});const before=JSON.stringify(days);
 for(const command of [{kind:'remove',date:'2026-10-29'},{kind:'move',date:'2026-10-29',to:'2026-10-30'},plan('2026-10-29',{daily:['Andere dagelijkse taak']})])assert.throws(()=>apply(days,command),/afgevinkt/);
 assert.equal(JSON.stringify(days),before);assert.equal(days.length,1);
 const mainDone=apply(days,{kind:'check',date:'2026-10-29',checkId:days[0].main.id,done:true});assert.throws(()=>apply(mainDone,plan('2026-10-29',{main:'Nieuwe hoofdtaak'})),/hoofdtaak/);
});
test('unstarted cleaning can be moved or removed without overwriting an existing day and calendar dates handle clock changes',()=>{
 let days=apply([],plan('2026-10-24'));const id=days[0].main.id;days=apply(days,{kind:'move',date:'2026-10-24',to:'2026-10-25'});assert.equal(days[0].id,'cleaning:2026-10-25');assert.equal(days[0].main.id,id);
 days=apply(days,plan('2026-10-26'));assert.throws(()=>apply(days,{kind:'move',date:'2026-10-25',to:'2026-10-26'}),/al een schoonmaaklijst/);assert.equal(apply(days,{kind:'remove',date:'2026-10-25'}).length,1);
 assert.throws(()=>apply(days,plan('2026-02-30')));assert.throws(()=>apply(days,plan('2026-10-28',{daily:['Dubbel','dubbel']})),/dubbel/);
});
test('persisted cleaning rejects duplicate dates or check IDs, forged timestamps and oversized entries',()=>{
 const good=apply([],plan());assert(!planning.validCleaningDays([good[0],good[0]]));assert(!planning.validCleaningDays([{...good[0],daily:[good[0].main]}]));assert(!planning.validCleaningDays([{...good[0],main:{...good[0].main,done:true,completedAt:'invalid',completedBy:'baker'}}]));
 assert(!planning.validCleaningDays([{...good[0],daily:Array(41).fill(good[0].daily[0])}]));assert.throws(()=>apply([],plan('2026-10-28',{main:'x'.repeat(301)})),/300/);
 assert(!workspace.validWorkspace({version:1,items:[],tasks:[],cleaning:[{...good[0],date:'invalid'}]},[]));
});
class StoreError extends Error{constructor(message,status=503){super(message);this.status=status;}}
const manager={id:'manager',active:true,role:'manager',permissions:{}},baker={id:'baker',active:true,role:'bakkerij',permissions:{'bakkerij.patisserie':true}};
function api(profile,options={}){let writes=0,reads=0;const store={planner:{data:{version:1,items:[],tasks:[],cleaning:apply([],plan()),staffing:{departmentIds:[],people:[]}},revision:4},recipes:{data:{recipes:[],ingredients:[]}}};const route=load('app/api/productie/schoonmaak/route.ts',{'@/app/lib/auth/session':{getCurrentProfile:async()=>profile},'@/app/lib/auth/access':access,'@/app/productie/documents.server':{ProductionStoreError:StoreError,readDocument:async key=>{reads++;return store[key];},saveDocument:async(key,revision,state)=>{assert.equal(key,'planner');assert.equal(revision,4);if(options.conflict)throw new StoreError('conflict',409);writes++;store.planner={data:state,revision:5};return 5;}},'@/app/productie/planning':planning,'@/app/productie/workspaceData':workspace});return{route,store,writes:()=>writes,reads:()=>reads};}
const request=(command,revision=4,origin)=>new Request('https://test.invalid/api/productie/schoonmaak',{method:'POST',headers:{'Content-Type':'application/json',...(origin?{origin}:{})},body:JSON.stringify({revision,command})});
test('only active Patisserie accounts can check cleaning; only management plans, removes or moves it',async()=>{
 for(const profile of [null,{...manager,active:false},{...baker,permissions:{'bakkerij.ijs_chocolade':true}},{id:'shop',active:true,role:'winkel',permissions:{}}]){const a=api(profile);assert.equal((await a.route.POST(request(plan()))).status,403);assert.equal(a.reads(),0);assert.equal(a.writes(),0);}
 const a=api(baker);for(const command of [plan(),{kind:'remove',date:'2026-10-28'},{kind:'move',date:'2026-10-28',to:'2026-10-29'}])assert.equal((await a.route.POST(request(command))).status,403);assert.equal(a.reads(),0);
 const checkId=a.store.planner.data.cleaning[0].main.id,response=await a.route.POST(request({kind:'check',date:'2026-10-28',checkId,done:true,completedBy:'forged',completedAt:'forged'}));assert.equal(response.status,200);const result=await response.json();assert.equal(result.state.cleaning[0].main.completedBy,'baker');assert.notEqual(result.state.cleaning[0].main.completedAt,'forged');assert.equal(result.state.staffing.people.length,0);assert.equal(result.state.tasks.length,0);
});
test('origin, stale revisions and storage conflicts prevent partial cleaning updates',async()=>{
 for(const [revision,origin] of [[3,undefined],[4,'https://foreign.invalid']]){const a=api(manager),response=await a.route.POST(request(plan(),revision,origin));assert.equal(response.status,origin?403:409);assert.equal(a.writes(),0);}
 const a=api(manager,{conflict:true});assert.equal((await a.route.POST(request(plan()))).status,409);assert.equal(a.writes(),0);
 const b=api(manager),response=await b.route.POST(request(plan('2026-10-28',{repeatDates:['2026-10-29','2026-10-30']})));assert.equal(response.status,200);assert.equal((await response.json()).state.cleaning.length,3);assert.equal(b.writes(),1);
});
