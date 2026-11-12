const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),jsx=require('react/jsx-runtime');
function harness(){
 const slots=[],requests=[],intervals=new Map(),timeouts=new Map();let index=0,intervalId=0,timeoutId=0;
 const documentState={hidden:false},network={onLine:true};
 const slot=initial=>{const i=index++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return i;};
 const same=(a,b)=>a?.length===b?.length&&a.every((x,i)=>Object.is(x,b[i]));
 const react={useRef:v=>slots[slot(()=>({current:v}))],useState:initial=>{const i=slot(initial);return[slots[i],value=>{slots[i]=typeof value==='function'?value(slots[i]):value;}];},useCallback:(fn,deps)=>{const i=slot(()=>({fn,deps}));if(!same(slots[i].deps,deps))slots[i]={fn,deps};return slots[i].fn;},useEffect:(fn,deps)=>{const i=slot(()=>({deps:undefined}));if(!same(slots[i].deps,deps)){slots[i].deps=deps;fn();}}};
 const imports={'./useProductionUpdates':{pageIsBeingEdited:()=>documentState.editing===true},'react':react,'react/jsx-runtime':jsx,'./ProductionLoading':{__esModule:true,default:function Loading(){}},'./ProductionResourceFrame':{__esModule:true,default:function Frame(){}},'./ProductionSession':{useProductionSession:()=>({canManageData:false})},'../preview/productie/ProductionPreview':{__esModule:true,default:function Preview(){}},'../preview/productie/production.module.css':{__esModule:true,default:{}}};
 const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('app/productie/ProductionClient.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,{exports,require:name=>{assert(name in imports,`Missing ${name}`);return imports[name];},fetch:(url,init)=>new Promise((resolve,reject)=>{requests.push({url,init,resolve});init.signal?.addEventListener('abort',()=>reject(Error('Request aborted')));}),AbortController,setTimeout:callback=>{timeouts.set(++timeoutId,callback);return timeoutId;},clearTimeout:id=>timeouts.delete(id),setInterval:callback=>{intervals.set(++intervalId,callback);return intervalId;},clearInterval:id=>intervals.delete(id),document:documentState,navigator:network});
 const render=()=>{index=0;return exports.default({canManage:false,appVersion:'release-on-page'});};
 const view=()=>render().props.children.at(-1).props;
 const respond=(i,data)=>requests[i].resolve({ok:true,json:async()=>data});
 const flush=()=>new Promise(resolve=>setImmediate(resolve));
 return{requests,render,view,respond,flush,tick:()=>[...intervals.values()].forEach(callback=>callback()),expireReads:()=>[...timeouts.values()].forEach(callback=>callback()),document:documentState,network};
}
const workspace=(revision,appVersion='release-on-page')=>({revision,appVersion,state:{version:1,items:[],tasks:[]},recipeRevision:1,recipes:[],ingredients:[],departments:['dessert'],canManage:false});
test('data polling is read-only, retains the original code release, and ignores out-of-order or older planner responses',async()=>{
 const h=harness();h.render();assert.equal(h.requests.length,1);h.respond(0,workspace(5));await h.flush();let v=h.view();assert.equal(v.live.revision,5);assert.equal(v.releaseVersion,'release-on-page');
 const first=v.onRefresh(),second=v.onRefresh();h.respond(2,workspace(7,'new-server-release'));await second;h.respond(1,workspace(6));await first;
 v=h.view();assert.equal(v.live.revision,7);assert.equal(v.live.appVersion,'new-server-release');assert.equal(v.releaseVersion,'release-on-page','must compare the code loaded at page render, not use the newest API release as the baseline');
 const stale=v.onRefresh();h.respond(3,workspace(4));await stale;assert.equal(h.view().live.revision,7);
 for(const request of h.requests){assert.equal(request.url,'/api/productie');assert.equal(request.init.cache,'no-store');assert(!request.init.method||request.init.method==='GET');assert.equal(request.init.body,undefined);}
});
test('unchanged polls retain workspace identity while source revisions and all independent metadata still refresh',async()=>{
 const h=harness();h.render();let previous={...workspace(5),today:'2026-11-09',updatedAt:'2026-11-09T08:00:00Z',canManageData:false,canManageScreenMessages:false,screenAccount:false,weeklyOffers:[]};h.respond(0,previous);await h.flush();
 let refresh=h.view().onRefresh();h.respond(1,structuredClone(previous));await refresh;assert.equal(h.view().live,previous,'an identical response must not replace child props or rerun board calculations');
 const changes=[['recipeRevision',2],['revision',6],['today','2026-11-10'],['appVersion','new-release'],['canManage',true],['canManageData',true],['canManageScreenMessages',true],['screenAccount',true],['departments',['dessert','ijs']],['weeklyOffers',[{id:'offer',weekStart:'2026-11-09',weekEnd:'2026-11-14',label:'Nieuwe aanbieding',imageUrl:'/new.jpg'}]],['updatedAt','2026-11-09T09:00:00Z'],['holidayStatus','changed']];
 for(const [key,value] of changes){const next={...structuredClone(previous),[key]:value};refresh=h.view().onRefresh();h.respond(h.requests.length-1,next);await refresh;assert.equal(h.view().live,next,`${key} must remain visible even with otherwise equal data`);previous=next;}
});
test('background refresh skips overlapping requests, hidden/offline tabs and still allows an immediate manual refresh',async()=>{
 const h=harness();h.render();h.respond(0,workspace(5));await h.flush();h.view();
 h.tick();assert.equal(h.requests.length,2);h.tick();assert.equal(h.requests.length,2,'a slow poll must not accumulate background requests');
 const manual=h.view().onRefresh();assert.equal(h.requests.length,3,'an explicit refresh remains immediate');h.respond(2,workspace(6));await manual;h.tick();assert.equal(h.requests.length,3,'the older request is still in flight');
 h.respond(1,workspace(5));await h.flush();assert.equal(h.view().live.revision,6);
 h.document.hidden=true;h.tick();assert.equal(h.requests.length,3);h.document.hidden=false;h.network.onLine=false;h.tick();assert.equal(h.requests.length,3);
 h.network.onLine=true;h.tick();assert.equal(h.requests.length,4);h.respond(3,workspace(6));await h.flush();
});
test('a stalled read times out without losing the last workspace and later background polls recover',async()=>{
 const h=harness();h.render();h.respond(0,workspace(5));await h.flush();const initial=h.view().live;
 h.tick();assert.equal(h.requests.length,2);h.expireReads();await h.flush();assert.equal(h.requests[1].init.signal.aborted,true);assert.equal(h.view().live,initial);
 h.tick();assert.equal(h.requests.length,3,'timed-out reads must not keep automatic polling blocked');h.respond(2,workspace(6));await h.flush();assert.equal(h.view().live.revision,6);
});


test('background refresh preserves an open form including a response already in flight',async()=>{
 const h=harness();h.render();h.respond(0,workspace(5));await h.flush();h.view();
 h.document.editing=true;h.tick();assert.equal(h.requests.length,1);
 h.document.editing=false;h.tick();assert.equal(h.requests.length,2);
 h.document.editing=true;h.respond(1,workspace(6));await h.flush();assert.equal(h.view().live.revision,5);
 h.document.editing=false;h.tick();h.respond(2,workspace(7));await h.flush();assert.equal(h.view().live.revision,7);
});
