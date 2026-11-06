const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function load(file,imports={},globals={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:name=>{assert(name in imports,`Missing ${name}`);return imports[name];},Date,Intl,Map,Set,...globals});return exports;}
const planning=load('app/productie/planning.ts'),updates=load('app/productie/productionUpdates.ts',{'./planning':planning});
const view={week:'2026-11-02',day:'2026-11-06',board:'patisserie',department:'all',statusFilter:'open',wall:true,weekend:false};
function harness(){
 let now=100000,reloads=0,tick,editing=false,dialog=false,focused=false,storageFails=false;
 const listeners=new Map(),storage=new Map(),cleanups=[];
 const doc={visibilityState:'visible',querySelector:()=>dialog?{}:null,querySelectorAll:()=>editing?[{getClientRects:()=>[{}]}]:[],activeElement:{matches:()=>focused}};
 const win={addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener:name=>listeners.delete(name),location:{reload:()=>reloads++}};
 const navigator={onLine:true},options={enabled:true,clientVersion:'old-release',serverVersion:'new-release',blocked:false,view};
 const react={useRef:v=>({current:v}),useEffect:fn=>{const clean=fn();if(clean)cleanups.push(clean);}};
 const hook=load('app/productie/useProductionUpdates.ts',{'react':react,'./productionUpdates':updates},{window:win,document:doc,navigator,location:{pathname:'/bakkerij/productie',search:'?board=patisserie'},sessionStorage:{setItem:(key,value)=>{if(storageFails)throw Error('Denied');storage.set(key,value);}},Date:class extends Date{static now(){return now;}},setInterval:fn=>{tick=fn;return 1;},clearInterval:()=>{tick=null;},fetch:()=>assert.fail('Auto-updating must not write planner data or make independent data requests')});
 const pending=hook.default(options);
 return{options,doc,navigator,listeners,storage,pending,get reloads(){return reloads;},advance:ms=>now+=ms,tick:()=>tick?.(),set editing(v){editing=v;},set dialog(v){dialog=v;},set focused(v){focused=v;},set storageFails(v){storageFails=v;},close(){cleanups.forEach(fn=>fn());}};
}
test('a newer release reloads once after a quiet minute, carrying only week/filter/XL preferences',()=>{
 const h=harness();assert(h.pending);h.advance(59999);h.tick();assert.equal(h.reloads,0);h.advance(1);h.tick();assert.equal(h.reloads,1);h.tick();assert.equal(h.reloads,1);
 const raw=h.storage.get(updates.RELOAD_VIEW_KEY),saved=JSON.parse(raw);assert.deepEqual(saved.view,view);assert.equal(saved.route,'/bakkerij/productie?board=patisserie');for(const key of ['tasks','planner','recipes','productionWork'])assert(!raw.includes(key));h.close();assert.equal(h.listeners.size,0);
});
test('dialogs, forms, focus, pending saves, offline/hidden pages and recent activity postpone the update',()=>{
 for(const block of [h=>h.dialog=true,h=>h.editing=true,h=>h.focused=true,h=>h.options.blocked=true,h=>h.navigator.onLine=false,h=>h.doc.visibilityState='hidden',h=>h.storageFails=true]){const h=harness();h.advance(120000);block(h);h.tick();assert.equal(h.reloads,0);h.close();}
 const h=harness();h.advance(120000);h.listeners.get('input')();h.tick();assert.equal(h.reloads,0);h.advance(60000);h.tick();assert.equal(h.reloads,1);h.close();
 const saving=harness();saving.options.blocked=true;saving.advance(120000);saving.tick();saving.options.blocked=false;saving.tick();assert.equal(saving.reloads,1);saving.close();
});
test('same/missing/development releases never refresh; reconnecting and finishing input can safely resume',()=>{
 for(const [clientVersion,serverVersion]of [['same','same'],['development','new'],['old',undefined],[undefined,'new']]){const h=harness();h.options.clientVersion=clientVersion;h.options.serverVersion=serverVersion;h.advance(120000);h.tick();assert.equal(h.reloads,0);h.close();}
 const h=harness();h.dialog=true;h.advance(120000);h.tick();h.dialog=false;h.tick();assert.equal(h.reloads,1);h.close();
});
test('restoration rejects expired/corrupt/foreign preferences and never restores planner snapshots',()=>{
 const route='/bakkerij/productie',now=10000000,raw=updates.encodeReloadView({...view,tasks:[{id:'private-task'}],planner:{tasks:[]}},route,now);
 assert(!raw.includes('private-task'));const restored=updates.decodeReloadView(raw,route,now+10);assert.deepEqual(JSON.parse(JSON.stringify(restored)),view);
 for(const input of [null,'bad',JSON.stringify({route,at:now+1,view}),JSON.stringify({route,at:now-1800001,view}),JSON.stringify({route,at:now,view:{...view,day:'2026-02-30'}}),JSON.stringify({route,at:now,view:{...view,board:'unknown'}})])assert.equal(updates.decodeReloadView(input,route,now),null);
 assert.equal(updates.decodeReloadView(raw,'/other',now),null);
});
