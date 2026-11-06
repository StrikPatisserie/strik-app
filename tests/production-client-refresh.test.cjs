const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),jsx=require('react/jsx-runtime');
function harness(){
 const slots=[],requests=[];let index=0;
 const slot=initial=>{const i=index++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return i;};
 const same=(a,b)=>a?.length===b?.length&&a.every((x,i)=>Object.is(x,b[i]));
 const react={useRef:v=>slots[slot(()=>({current:v}))],useState:initial=>{const i=slot(initial);return[slots[i],value=>{slots[i]=typeof value==='function'?value(slots[i]):value;}];},useCallback:(fn,deps)=>{const i=slot(()=>({fn,deps}));if(!same(slots[i].deps,deps))slots[i]={fn,deps};return slots[i].fn;},useEffect:(fn,deps)=>{const i=slot(()=>({deps:undefined}));if(!same(slots[i].deps,deps)){slots[i].deps=deps;fn();}}};
 const imports={'react':react,'react/jsx-runtime':jsx,'./ProductionLoading':{__esModule:true,default:function Loading(){}},'./ProductionResourceFrame':{__esModule:true,default:function Frame(){}},'./ProductionSession':{useProductionSession:()=>({canManageData:false})},'../preview/productie/ProductionPreview':{__esModule:true,default:function Preview(){}},'../preview/productie/production.module.css':{__esModule:true,default:{}}};
 const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('app/productie/ProductionClient.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,{exports,require:name=>{assert(name in imports,`Missing ${name}`);return imports[name];},fetch:(url,init)=>new Promise(resolve=>requests.push({url,init,resolve})),setInterval:()=>1,clearInterval:()=>{},document:{hidden:false}});
 const render=()=>{index=0;return exports.default({canManage:false,appVersion:'release-on-page'});};
 const view=()=>render().props.children.at(-1).props;
 const respond=(i,data)=>requests[i].resolve({ok:true,json:async()=>data});
 const flush=()=>new Promise(resolve=>setImmediate(resolve));
 return{requests,render,view,respond,flush};
}
const workspace=(revision,appVersion='release-on-page')=>({revision,appVersion,state:{version:1,items:[],tasks:[]},recipeRevision:1,recipes:[],ingredients:[],departments:['dessert'],canManage:false});
test('data polling is read-only, retains the original code release, and ignores out-of-order or older planner responses',async()=>{
 const h=harness();h.render();assert.equal(h.requests.length,1);h.respond(0,workspace(5));await h.flush();let v=h.view();assert.equal(v.live.revision,5);assert.equal(v.releaseVersion,'release-on-page');
 const first=v.onRefresh(),second=v.onRefresh();h.respond(2,workspace(7,'new-server-release'));await second;h.respond(1,workspace(6));await first;
 v=h.view();assert.equal(v.live.revision,7);assert.equal(v.live.appVersion,'new-server-release');assert.equal(v.releaseVersion,'release-on-page','must compare the code loaded at page render, not use the newest API release as the baseline');
 const stale=v.onRefresh();h.respond(3,workspace(4));await stale;assert.equal(h.view().live.revision,7);
 for(const request of h.requests){assert.equal(request.url,'/api/productie');assert.equal(request.init.cache,'no-store');assert(!request.init.method||request.init.method==='GET');assert.equal(request.init.body,undefined);}
});
