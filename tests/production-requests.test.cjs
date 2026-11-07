const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function load(file,imports={},globals={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,{exports,require:name=>{assert(name in imports,`Unmocked ${name}`);return imports[name];},Date,Intl,Set,Map,structuredClone,Request,Response,URL,URLSearchParams,crypto:require('node:crypto').webcrypto,...globals});return exports;}
const planning=load('app/productie/planning.ts'),recipe=load('app/productie/recipePlanning.ts',{'./planning':planning}),requests=load('app/productie/requestPlanning.ts',{'./planning':planning,'./recipePlanning':recipe,'./taskOperations':load('app/productie/taskOperations.ts')}),access=load('app/lib/auth/access.ts'),rights=load('app/productie/access.ts',{'../lib/auth/access':access,'./planning':planning});
const state=()=>({version:1,items:[{id:'cake',name:'Testtaart',kind:'product',departmentId:'dessert',unit:'stuks',note:'',stock:0}],tasks:[]});
const now='2026-11-01T12:00:00.000Z',create={kind:'create',itemId:'cake',quantity:20,neededBy:'2026-11-06',note:'Voor de winkels'};
const apply=(s,c,id='request-1')=>requests.applyProductionRequest(s,[],c,'actor',now,id);
test('logistics requests do not create tasks or alter stock until a baker plans them',()=>{
 const initial=state(),next=apply(initial,create);assert.equal(next.tasks.length,0);assert.equal(next.items[0].stock,0);assert.equal(initial.productionRequests,undefined);assert(planning.validProductionRequests(next.productionRequests));assert.equal(next.productionRequests[0].createdBy,'actor');
 const planned=apply(next,{kind:'plan',id:'request-1',date:'2026-11-05',departmentId:'dessert'},'task-1');assert.equal(planned.tasks.length,1);assert.equal(planned.tasks[0].quantity,20);assert.equal(planned.tasks[0].dueDate,'2026-11-06');assert.equal(planned.productionRequests[0].plannedTaskId,'task-1');assert.equal(planned.items[0].stock,0);
 assert.throws(()=>apply(planned,{kind:'plan',id:'request-1',date:'2026-11-05',departmentId:'dessert'}),/al in de planning/);
 assert.throws(()=>apply(planned,{kind:'cancel',id:'request-1'}),/al in de planning/);
 const reopened={...planned,tasks:[]};assert.equal(apply(reopened,{kind:'plan',id:'request-1',date:'2026-11-06',departmentId:'dessert'},'task-2').tasks.length,1);
});
test('invalid quantities, missing products, blocked recipes, bad dates and late planning are rejected atomically',()=>{
 for(const changes of [{quantity:0},{quantity:-1},{quantity:Infinity},{quantity:1000001},{itemId:'unknown'},{note:'x'.repeat(2001)},{neededBy:'2026-02-30'}])assert.throws(()=>apply(state(),{...create,...changes}));
 const blocked=state();blocked.items[0].productionBlocked=true;assert.throws(()=>apply(blocked,create));
 const current=apply(state(),create),before=JSON.stringify(current);assert.throws(()=>apply(current,{kind:'plan',id:'request-1',date:'2026-11-07',departmentId:'dessert'}),/uiterlijk/);assert.equal(JSON.stringify(current),before);
 const cancelled=apply(current,{kind:'cancel',id:'request-1'});assert.equal(cancelled.productionRequests[0].cancelledAt,now);assert.throws(()=>apply(cancelled,{kind:'plan',id:'request-1',date:'2026-11-05',departmentId:'dessert'}));
});
test('request planning supports optional storten and a validated total time while omitted fields retain legacy behavior',()=>{
 const current=apply(state(),create),command={kind:'plan',id:'request-1',date:'2026-11-05',departmentId:'dessert'};
 const planned=apply(current,{...command,pour:true,minutes:45},'task-1');
 assert.equal(planned.tasks[0].operation,'Produceren + storten');
 assert.equal(planned.tasks[0].minutes,45);
 const legacy=apply(current,command,'task-2');
 assert.equal(legacy.tasks[0].operation,'Produceren');
 assert.equal(Object.hasOwn(legacy.tasks[0],'minutes'),false);
 for(const minutes of [0,12.5,1440]){
  const timed=apply(current,{...command,minutes,pour:false},'task-timed');
  assert.equal(timed.tasks[0].minutes,minutes);
  assert.equal(timed.tasks[0].operation,'Produceren');
 }
 const before=JSON.stringify(current);
 for(const fields of [{pour:'true'},{pour:1},{pour:null},{minutes:-1},{minutes:1441},{minutes:Infinity},{minutes:'45'},{minutes:null}]){
  assert.throws(()=>apply(current,{...command,...fields}));
  assert.equal(JSON.stringify(current),before);
 }
 assert.throws(()=>apply(current,{...command,kind:'unknown'}));
});
test('unassigned requests remain visible on every board while legacy requests inherit their product department',()=>{
 const initial=state();
 const unassigned=apply(initial,{...create,departmentId:null}).productionRequests[0];
 const legacy={...unassigned,id:'legacy'};delete legacy.departmentId;
 const assigned={...unassigned,id:'assigned',departmentId:'bak'};
 const cancelled={...unassigned,id:'cancelled',cancelledAt:now};
 const all=[unassigned,legacy,assigned,cancelled];
 assert.equal(requests.requestDepartmentId(unassigned,initial.items[0]),null);
 assert.equal(requests.requestDepartmentId(legacy,initial.items[0]),'dessert');
 assert.deepEqual(Array.from(requests.requestsForBoard(all,initial.items,'patisserie'),r=>r.id),['request-1','legacy']);
 assert.deepEqual(Array.from(requests.requestsForBoard(all,initial.items,'bak'),r=>r.id),['request-1','assigned']);
 assert.deepEqual(Array.from(requests.requestsForBoard(all,initial.items,'ijs'),r=>r.id),['request-1']);
 assert.equal(requests.requestsForBoard(all,initial.items).length,3);
 const planned=apply({...initial,productionRequests:[unassigned]},{kind:'plan',id:unassigned.id,date:'2026-11-05',departmentId:'bak'},'task-bak');
 assert.equal(planned.productionRequests[0].departmentId,'bak');
 assert.equal(planned.tasks[0].departmentId,'bak');
 assert.equal(planned.items[0].departmentId,'dessert','Assigning a request must retain an established product category');
});
test('new recipe-free requests can defer their department until planning without orphaning a product',()=>{
 const initial=state(),command={...create,itemId:'__new',departmentId:null,newItem:{name:'Nog in te delen beslag',kind:'component',unit:'kg'}};
 const next=apply(initial,command);
 const item=next.items.find(item=>item.id==='item:request-1');
 assert.equal(next.productionRequests[0].departmentId,null);
 assert.equal(item.departmentUnconfirmed,true);
 assert.equal(item.stockKnown,false);
 assert.equal(next.tasks.length,0);
 assert.equal(requests.requestsForBoard(next.productionRequests,next.items,'bak').length,1);
 const planned=apply(next,{kind:'plan',id:'request-1',date:'2026-11-05',departmentId:'bak'},'task-bak');
 assert.equal(planned.items.find(item=>item.id==='item:request-1').departmentId,'bak');
 assert.equal(planned.items.find(item=>item.id==='item:request-1').departmentUnconfirmed,false);
 assert.equal(planned.tasks[0].departmentId,'bak');
 for(const departmentId of ['unknown','',false,12,{}]){
  assert.throws(()=>apply(initial,{...command,departmentId}),/afdeling/);
 }
 assert.throws(()=>apply(initial,{...command,quantity:0}));
 assert.equal(initial.items.length,1);
 assert.equal(initial.productionRequests,undefined);
 assert.equal(apply(initial,create).productionRequests[0].departmentId,null);
});
class StoreError extends Error{constructor(message,status=503){super(message);this.status=status;}}
const manager={id:'manager',role:'manager',active:true,permissions:{}},logistics={id:'logistics',role:'logistiek',active:true,permissions:{}},baker={id:'baker',role:'bakkerij',active:true,permissions:{'bakkerij.patisserie':true}},shop={id:'shop',role:'winkel',active:true,permissions:{}};
function harness(profile,initial=state(),saveError){
 const saves=[];const workspace={recipeViews:()=>[],syncRecipeCatalog:s=>s,validWorkspace:()=>true};
 const save=async(...args)=>{if(saveError)throw saveError;saves.push(args);return 4;};
 const route=load('app/api/productie/verzoeken/route.ts',{'@/app/lib/auth/session':{getCurrentProfile:async()=>profile},'@/app/lib/auth/access':access,'@/app/productie/access':rights,'@/app/productie/documents.server':{ProductionStoreError:StoreError,readDocument:async key=>({data:key==='planner'?initial:{},revision:3}),saveDocument:save,saveRecipePlanDocument:save},'@/app/productie/workspaceData':workspace,'@/app/productie/productionRequests':requests,'@/app/productie/requestPlanning':requests});
 return {route,saves};
}
function post(command,revision=3,origin='https://app.invalid'){return new Request('https://app.invalid/api/productie/verzoeken',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({revision,command})});}
test('logistics and production accounts create; bakers plan only in their allowed departments; shops and cross-origin calls are rejected',async()=>{
 for(const profile of [null,shop,{...logistics,active:false}])assert.equal((await harness(profile).route.GET()).status,403);
 for(const profile of [logistics,manager]){const h=harness(profile);assert.equal((await h.route.POST(post(create))).status,200);assert.equal(h.saves.length,1);}
 assert.equal((await harness(baker).route.POST(post(create))).status,200);
 const current=apply(state(),create),command={kind:'plan',id:'request-1',date:'2026-11-05',departmentId:'dessert'};
 assert.equal((await harness(logistics,current).route.POST(post(command))).status,403);
 assert.equal((await harness(baker,current).route.POST(post({...command,departmentId:'ijs'}))).status,403);
 const h=harness(baker,current);assert.equal((await h.route.POST(post(command))).status,200);assert.equal(h.saves[0][1],3);assert.equal(h.saves[0][2].tasks.length,1);
 assert.equal((await harness(manager).route.POST(post(create,3,'https://foreign.invalid'))).status,403);
});
test('a stale revision cannot overwrite another request or plan; logistics receives a minimal catalog, not recipes or ingredients',async()=>{
 const h=harness(logistics);assert.equal((await h.route.POST(post(create,2))).status,409);assert.equal(h.saves.length,0);
 const response=await h.route.GET(),data=await response.json();assert.equal(response.headers.get('Cache-Control'),'private, no-store');assert(data.canCreate);assert(!('recipes'in data));assert(!('ingredients'in data));assert(!('stock'in data.items[0]));
});
test('the endpoint validates optional departments and retains conflict protection for unassigned requests',async()=>{
 const command={...create,departmentId:null};
 const created=harness(logistics);
 assert.equal((await created.route.POST(post(command))).status,200);
 assert.equal(created.saves[0][2].productionRequests[0].departmentId,null);
 const current=created.saves[0][2];
 const data=await (await harness(baker,current).route.GET()).json();
 assert.equal(data.requests[0].departmentId,null);
 for(const departmentId of ['unknown','',false,12,{}]){
  const rejected=harness(logistics);
  assert.equal((await rejected.route.POST(post({...command,departmentId}))).status,400);
  assert.equal(rejected.saves.length,0);
 }
 const concurrent=harness(logistics,state(),new StoreError('Intussen gewijzigd',409));
 assert.equal((await concurrent.route.POST(post(command))).status,409);
 assert.equal(concurrent.saves.length,0);
 assert.equal((await harness(shop).route.POST(post(command))).status,403);
 assert.equal((await harness(baker,current).route.POST(post({kind:'plan',id:current.productionRequests[0].id,date:'2026-11-05',departmentId:'ijs'}))).status,403);
});
test('the request endpoint validates pour and minutes before saving the fixed production operation',async()=>{
 const current=apply(state(),create),command={kind:'plan',id:'request-1',date:'2026-11-05',departmentId:'dessert'};
 const h=harness(baker,current);
 assert.equal((await h.route.POST(post({...command,pour:true,minutes:45}))).status,200);
 assert.equal(h.saves[0][2].tasks[0].operation,'Produceren + storten');
 assert.equal(h.saves[0][2].tasks[0].minutes,45);
 for(const fields of [{pour:'true'},{pour:1},{pour:null},{minutes:-1},{minutes:1441},{minutes:'45'},{minutes:null},{kind:'unknown'}]){
  const rejected=harness(baker,current);
  assert.equal((await rejected.route.POST(post({...command,...fields}))).status,400);
  assert.equal(rejected.saves.length,0);
 }
 const unauthorized=harness(baker,current);
 assert.equal((await unauthorized.route.POST(post({...command,departmentId:'ijs',pour:true,minutes:45}))).status,403);
 assert.equal(unauthorized.saves.length,0);
});
test('logistics can introduce a new recipe-free part atomically; duplicates and malformed requests never add an orphan item',()=>{
 const initial=state(),command={...create,itemId:'__new',newItem:{name:'Nieuw beslag',kind:'component',unit:'kg',departmentId:'bak'}};
 const next=apply(initial,command);assert.equal(next.items.length,2);assert.equal(next.items[1].recipeId,undefined);assert.equal(next.items[1].stockKnown,false);assert.equal(next.productionRequests[0].itemId,next.items[1].id);assert.equal(next.items[1].departmentId,'bak');
 const planned=apply(next,{kind:'plan',id:'request-1',date:'2026-11-04',departmentId:'bak'},'new-task');assert.equal(planned.tasks[0].itemId,next.items[1].id);
 assert.throws(()=>apply(initial,{...command,newItem:{...command.newItem,name:'Testtaart'}}),/bestaat al/);
 assert.throws(()=>apply(initial,{...command,quantity:0}));assert.equal(initial.items.length,1);
});
test('unplanned request edits preserve identity and creator, update every requested field and record the authenticated editor',()=>{
 const initial=apply(state(),create),before=JSON.stringify(initial);
 initial.items.push({...initial.items[0],id:'bread',name:'Brood',departmentId:'brood'});
 const edited=requests.applyProductionRequest(initial,[],{kind:'edit',id:'request-1',itemId:'bread',quantity:35,departmentId:'brood',neededBy:'2026-11-12',note:'Andere hoeveelheid'},'second-actor','2026-11-03T09:00:00.000Z','unused-new-id');
 const row=edited.productionRequests[0];
 assert.equal(row.id,'request-1');assert.equal(row.createdBy,'actor');assert.equal(row.createdAt,now);
 assert.equal(row.updatedBy,'second-actor');assert.equal(row.updatedAt,'2026-11-03T09:00:00.000Z');
 assert.equal(row.itemId,'bread');assert.equal(row.quantity,35);assert.equal(row.departmentId,'brood');assert.equal(row.neededBy,'2026-11-12');assert.equal(row.note,'Andere hoeveelheid');
 assert.equal(edited.tasks.length,0);assert.equal(edited.items.length,2);assert.equal(edited.items[1].stock,0);
 assert.equal(initial.productionRequests[0].quantity,20);assert.equal(JSON.stringify(initial.productionRequests),JSON.stringify(JSON.parse(before).productionRequests));
 const cleared=apply(edited,{kind:'edit',id:row.id,itemId:'cake',quantity:10,departmentId:null,note:''});
 assert.equal(cleared.productionRequests[0].neededBy,undefined);assert.equal(cleared.productionRequests[0].departmentId,null);
});
test('editing may select a new recipe-free component atomically and invalid edits never leave orphan products',()=>{
 const current=apply(state(),create),command={...create,kind:'edit',id:'request-1',itemId:'__new',departmentId:null,newItem:{name:'Tijdelijk beslag',kind:'component',unit:'kg'}};
 const edited=apply(current,command,'request-edit');
 assert.equal(edited.productionRequests.length,1);assert.equal(edited.productionRequests[0].id,'request-1');
 assert.equal(edited.productionRequests[0].itemId,'item:request-edit');
 assert.equal(edited.items[1].name,'Tijdelijk beslag');assert.equal(edited.items[1].recipeId,undefined);assert.equal(edited.items[1].departmentUnconfirmed,true);
 assert.equal(edited.tasks.length,0);
 const before=JSON.stringify(current);
 for(const change of [{quantity:0},{quantity:Infinity},{departmentId:'missing'},{note:'x'.repeat(2001)},{neededBy:'2026-02-30'},{neededBy:12},{id:'missing'}])assert.throws(()=>apply(current,{...command,...change},'invalid-edit'));
 assert.equal(JSON.stringify(current),before);
});
test('planned requests and their generated preparations or actual work cannot be edited or cancelled through the request list',()=>{
 const current=apply(state(),create),planned=apply(current,{kind:'plan',id:'request-1',date:'2026-11-05',departmentId:'dessert'},'task-1');
 const command={...create,kind:'edit',id:'request-1',quantity:40};
 for(const status of ['planned','active','done','blocked']){
  const source=structuredClone(planned);source.tasks[0].status=status;const before=JSON.stringify(source);
  assert.equal(requests.canEditProductionRequest(source,source.productionRequests[0]),false);
  assert.throws(()=>apply(source,command),/weekplanning/);assert.equal(JSON.stringify(source),before);
 }
 const orphaned={...planned,tasks:[{...planned.tasks[0],id:'task-1:prep:0',generatedFor:'task-1'}]};
 assert.throws(()=>apply(orphaned,command),/weekplanning/);
 for(const productionWork of [{timers:{'task-1':{id:'timer'}}},{completions:{'task-1':{id:'completion'}}},{stockFulfillments:{'task-1':{id:'stock'}}},{work:[{taskId:'task-1:prep:0'}]}]){
  const source={...planned,tasks:[],productionWork};
  assert.throws(()=>apply(source,command),/productieregistraties/);
  assert.throws(()=>apply(source,{kind:'cancel',id:'request-1'}),/productieregistraties/);
 }
 const removed={...planned,tasks:[]};
 assert.equal(requests.canEditProductionRequest(removed,removed.productionRequests[0]),true);
 assert.equal(apply(removed,command).productionRequests[0].plannedTaskId,undefined);
 const url=new URL(requests.requestPlanningUrl(planned,planned.productionRequests[0]),'https://app.invalid');
 assert.equal(url.pathname,'/bakkerij/productie');assert.equal(url.searchParams.get('date'),'2026-11-05');assert.equal(url.searchParams.get('department'),'dessert');assert.equal(url.searchParams.get('task'),'task-1');
});
test('edit API retains create rights, origin and CAS checks and ignores forged creator/editor fields',async()=>{
 const current=apply(state(),create),command={...create,kind:'edit',id:'request-1',quantity:35,createdBy:'forged',createdAt:'2020-01-01',updatedBy:'forged',updatedAt:'2020-01-01'};
 for(const profile of [manager,logistics,baker]){
  const h=harness(profile,current);assert.equal((await h.route.POST(post(command))).status,200);
  const saved=h.saves[0][2].productionRequests[0];
  assert.equal(saved.createdBy,'actor');assert.equal(saved.createdAt,now);assert.equal(saved.updatedBy,profile.id);assert(saved.updatedAt>'2020-01-01');assert.equal(h.saves[0][4],'Productieverzoek gewijzigd');
 }
 for(const profile of [null,shop,{...baker,active:false}]){const h=harness(profile,current);assert.equal((await h.route.POST(post(command))).status,403);assert.equal(h.saves.length,0);}
 const foreign=harness(manager,current);assert.equal((await foreign.route.POST(post(command,3,'https://foreign.invalid'))).status,403);assert.equal(foreign.saves.length,0);
 const stale=harness(logistics,current);assert.equal((await stale.route.POST(post(command,2))).status,409);assert.equal(stale.saves.length,0);
 const conflict=harness(logistics,current,new StoreError('Intussen gewijzigd',409));assert.equal((await conflict.route.POST(post(command))).status,409);assert.equal(conflict.saves.length,0);
 const planned=apply(current,{kind:'plan',id:'request-1',date:'2026-11-05',departmentId:'dessert'},'task-1'),blocked=harness(logistics,planned);
 assert.equal((await blocked.route.POST(post(command))).status,400);assert.equal(blocked.saves.length,0);
 const data=await (await blocked.route.GET()).json();
 assert.equal(data.requests[0].canEdit,false);assert.equal(data.requests[0].plannedTask.id,'task-1');assert.match(data.requests[0].planningUrl,/task=task-1/);
});
test('the request form explicitly supports no department and asks the baker to assign one when planning',async()=>{
 const data={revision:3,canCreate:true,departments:['dessert','bak'],items:state().items,requests:apply(state(),{...create,departmentId:null}).productionRequests};
 const slots=[data],posted=[];let index=0;
 const useState=initial=>{
  const position=index++;
  if(!(position in slots))slots[position]=typeof initial==='function'?initial():initial;
  return [slots[position],next=>{slots[position]=typeof next==='function'?next(slots[position]):next;}];
 };
 const react={useState,useCallback:callback=>callback,useEffect:()=>{},useRef:initial=>useState(()=>({current:initial}))[0]};
 const component=load('app/productie/ProductionRequests.tsx',{
  react,'react/jsx-runtime':require('react/jsx-runtime'),'./planning':planning,'./requestPlanning':requests,
  './ProductionIcon':{__esModule:true,default:()=>null},
  './SearchableChoice':{__esModule:true,default:()=>null},
  './requests.module.css':{__esModule:true,default:new Proxy({},{get:(_,key)=>key})},
 },{
  FormData:class {constructor(form){this.form=form;}get(name){return this.form[name]??null;}},
  fetch:async(url,options)=>{if(options?.method==='POST')posted.push(JSON.parse(options.body).command);return Response.json(options?.method==='POST'?{revision:4}:data);},
 }).default;
 const render=()=>{index=0;return component({board:'patisserie'});};
 const nodes=tree=>!tree||typeof tree!=='object'?[]:Array.isArray(tree)?tree.flatMap(nodes):[tree,...nodes(tree.props?.children)];
 const find=(tree,predicate)=>{const found=nodes(tree).find(predicate);assert(found,'Expected request form control');return found;};
 let tree=render();
 find(tree,node=>node.props?.['aria-label']==='Inplannen: Testtaart').props.onClick();tree=render();
 const planningDepartment=find(tree,node=>node.type==='select'&&node.props.name==='departmentId');
 assert.equal(planningDepartment.props.required,true);
 assert.equal(planningDepartment.props.defaultValue,'');
 const time=find(tree,node=>node.type==='input'&&node.props.name==='minutes');
 assert.equal(time.props.min,'0');assert.equal(time.props.max,'1440');assert.equal(time.props.required,undefined);
 assert.equal(find(tree,node=>node.type==='input'&&node.props.name==='pour').props.type,'checkbox');
 find(tree,node=>node.props?.['aria-label']==='Productieverzoek toevoegen').props.onClick();tree=render();
 find(tree,node=>node.props?.name==='itemId').props.onChange('__new');tree=render();
 const createForm=find(tree,node=>node.type==='form'&&nodes(node).some(child=>child.props?.name==='itemId'));
 const department=find(createForm,node=>node.type==='select'&&node.props.name==='departmentId');
 assert.equal(department.props.defaultValue,'');
 assert(nodes(department).some(node=>node.type==='option'&&node.props.value===''&&node.props.children==='Nog geen afdeling'));
 assert(!nodes(createForm).some(node=>node.props?.name==='newDepartment'));
 createForm.props.onSubmit({preventDefault:()=>{},currentTarget:{itemId:'__new',name:'Los beslag',kind:'component',unit:'kg',quantity:'20',departmentId:'',neededBy:'',note:''}});
 await new Promise(setImmediate);
 assert.equal(posted.length,1);
 assert.equal(posted[0].departmentId,null);
 assert.equal(posted[0].newItem.name,'Los beslag');
 assert.equal(posted[0].newItem.departmentId,undefined);
 for(const [index,fields] of [{minutes:'45',pour:'on'},{minutes:''}].entries()){
  tree=render();find(tree,node=>node.props?.['aria-label']==='Inplannen: Testtaart').props.onClick();tree=render();
  const planForm=find(tree,node=>node.type==='form'&&nodes(node).some(child=>child.props?.name==='date'));
  planForm.props.onSubmit({preventDefault:()=>{},currentTarget:{date:'2026-11-05',departmentId:'dessert',...fields}});
  await new Promise(setImmediate);
  assert.equal(posted[index+1].kind,'plan');
 }
 assert.equal(posted[1].minutes,45);assert.equal(posted[1].pour,true);
 assert.equal(Object.hasOwn(posted[2],'minutes'),false);assert.equal(Object.hasOwn(posted[2],'pour'),false);
});
function requestUi(initial){
 const slots=[initial],posted=[];let index=0,remote=initial,refresh;
 const useState=value=>{const position=index++;if(!(position in slots))slots[position]=typeof value==='function'?value():value;return[slots[position],next=>{slots[position]=typeof next==='function'?next(slots[position]):next;}];};
 const component=load('app/productie/ProductionRequests.tsx',{
  react:{useState,useCallback:callback=>{refresh=callback;return callback;},useEffect:()=>{},useRef:initial=>useState(()=>({current:initial}))[0]},
  'react/jsx-runtime':require('react/jsx-runtime'),'./planning':planning,'./requestPlanning':requests,
  './ProductionIcon':{__esModule:true,default:()=>null},'./SearchableChoice':{__esModule:true,default:()=>null},
  './requests.module.css':{__esModule:true,default:new Proxy({},{get:(_,key)=>key})},
 },{
  FormData:class{constructor(form){this.form=form;}get(name){return this.form[name]??null;}},
  fetch:async(url,options)=>{if(options?.method==='POST')posted.push(JSON.parse(options.body));return Response.json(options?.method==='POST'?{revision:remote.revision+1}:remote);},
 }).default;
 const nodes=tree=>!tree||typeof tree!=='object'?[]:Array.isArray(tree)?tree.flatMap(nodes):[tree,...nodes(tree.props?.children)];
 const render=props=>{index=0;return component(props||{});};
 const find=(tree,predicate)=>{const found=nodes(tree).find(predicate);assert(found,'Expected request control');return found;};
 return{render,nodes,find,posted,refresh:async next=>{remote=next;await refresh();}};
}
test('request editing pre-fills the shared searchable picker and all fields, then keeps its original revision across refreshes',async()=>{
 const source=apply(state(),create);
 const data={revision:3,canCreate:true,departments:['dessert'],items:[...source.items,{...source.items[0],id:'bread',name:'Brood'}],requests:source.productionRequests};
 const ui=requestUi(data);let tree=ui.render();
 ui.find(tree,node=>node.props?.['aria-label']==='Bewerk verzoek: Testtaart').props.onClick();tree=ui.render();
 assert.equal(tree.props['data-production-update-block'],true);
 const picker=ui.find(tree,node=>node.props?.name==='itemId');
 assert.equal(picker.props.value,'cake');assert.equal(picker.props.label,'Product');assert.equal(picker.props.required,true);
 assert(picker.props.choices.some(row=>row.id==='__new'));
 assert.equal(ui.find(tree,node=>node.props?.name==='quantity').props.defaultValue,20);
 assert.equal(ui.find(tree,node=>node.props?.name==='neededBy').props.defaultValue,'2026-11-06');
 assert.equal(ui.find(tree,node=>node.props?.name==='note').props.defaultValue,'Voor de winkels');
 picker.props.onChange('bread');tree=ui.render();
 assert.equal(ui.find(tree,node=>node.props?.name==='itemId').props.value,'bread');
 await ui.refresh({...data,revision:4,requests:[{...source.productionRequests[0],quantity:999}]});tree=ui.render();
 assert.equal(ui.find(tree,node=>node.props?.name==='quantity').props.defaultValue,20,'a refreshed server request cannot silently replace an editing draft');
 const form=ui.find(tree,node=>node.type==='form'&&ui.nodes(node).some(child=>child.props?.name==='itemId'));
 form.props.onSubmit({preventDefault:()=>{},currentTarget:{itemId:'bread',quantity:'35',departmentId:'dessert',neededBy:'2026-11-12',note:'Gewijzigd'}});
 await new Promise(setImmediate);
 assert.equal(ui.posted.length,1);assert.equal(ui.posted[0].revision,3,'the stale draft must be rejected by normal server CAS instead of overwriting revision four');
 assert.equal(ui.posted[0].command.kind,'edit');assert.equal(ui.posted[0].command.id,'request-1');assert.equal(ui.posted[0].command.itemId,'bread');assert.equal(ui.posted[0].command.quantity,35);
});
test('scheduled requests link to their exact task without an edit form, and logistics retains its existing access boundary',()=>{
 const source=apply(apply(state(),create),{kind:'plan',id:'request-1',date:'2026-11-05',departmentId:'dessert'},'task-1');
 const row={...source.productionRequests[0],canEdit:false,plannedTask:source.tasks[0],planningUrl:requests.requestPlanningUrl(source,source.productionRequests[0])};
 const data={revision:3,canCreate:true,departments:['dessert'],items:source.items,requests:[row]};
 const ui=requestUi(data),tree=ui.render();
 assert(!ui.nodes(tree).some(node=>node.props?.['aria-label']?.startsWith('Bewerk verzoek')));
 const link=ui.find(tree,node=>node.type==='a');
 assert.equal(new URL(link.props.href,'https://app.invalid').searchParams.get('task'),'task-1');
 const logisticsUi=requestUi({...data,departments:[]}),logisticsTree=logisticsUi.render({logistics:true});
 assert(!logisticsUi.nodes(logisticsTree).some(node=>node.type==='a'));
 assert(logisticsUi.nodes(logisticsTree).some(node=>node.type==='small'&&node.props.children==='Wijzigen via de bakkerijplanning.'));
 const readonly=requestUi({...data,canCreate:false,requests:[{...row,canEdit:true,plannedTask:undefined}]});
 assert(!readonly.nodes(readonly.render()).some(node=>node.props?.['aria-label']==='Productieverzoek toevoegen'||node.props?.['aria-label']?.startsWith('Bewerk verzoek')));
});
function requestText(node){
 if(typeof node==='string'||typeof node==='number')return String(node);
 if(!node||typeof node!=='object')return '';
 return Array.isArray(node)?node.map(requestText).join(''):requestText(node.props?.children);
}
test('compact requests keep quantities beside the product name, omit stuks and retain meaningful kg/platen units',()=>{
 const source=apply(state(),create);
 const items=[source.items[0],{...source.items[0],id:'ganache',name:'Chocoladeganache',unit:'kg'},{...source.items[0],id:'kapsel',name:'Vanillekapsel',unit:'platen'}];
 const rows=items.map((item,index)=>({...source.productionRequests[0],id:`request-${index}`,itemId:item.id,quantity:[20,2.5,3][index],departmentId:'dessert',neededBy:undefined,note:''}));
 const ui=requestUi({revision:3,canCreate:true,departments:['dessert'],items,requests:rows});
 const tree=ui.render({compact:true,board:'patisserie'}),articles=ui.nodes(tree).filter(node=>node.type==='article');
 assert.equal(articles.length,3);
 for(const [index,article] of articles.entries()){
  const title=ui.find(article,node=>node.type==='strong'),amount=ui.find(title,node=>node.type==='small');
  assert(requestText(title).startsWith(items[index].name));
  assert.equal(requestText(amount),['20','2,5 kg','3 platen'][index]);
  assert(!/\bstuks\b/i.test(requestText(article)));
  const row=ui.find(article,node=>node.props?.className==='row');
  const buttons=ui.nodes(row).filter(node=>node.type==='button');
  assert.equal(buttons.length,3,'edit, cancel and plan stay together on the request row');
  assert.deepEqual(buttons.map(button=>button.props['aria-label']),[`Bewerk verzoek: ${items[index].name}`,`Verzoek intrekken: ${items[index].name}`,`Inplannen: ${items[index].name}`]);
  for(const button of buttons){assert.equal(requestText(button),'','row actions stay icon-only');assert(button.props.title);assert.equal(button.props.type,'button');}
 }
});
test('compact edit/cancel/plan icons still execute their actions and planning retains the complete requested quantity',async()=>{
 const source=apply(state(),create),data={revision:3,canCreate:true,departments:['dessert'],items:source.items,requests:source.productionRequests};
 const props={compact:true,board:'patisserie'};
 const editUi=requestUi(data);let tree=editUi.render(props);
 editUi.find(tree,node=>node.props?.['aria-label']==='Bewerk verzoek: Testtaart').props.onClick();tree=editUi.render(props);
 assert.equal(editUi.find(tree,node=>node.props?.name==='quantity').props.defaultValue,20);
 const editForm=editUi.find(tree,node=>node.type==='form'&&editUi.nodes(node).some(child=>child.props?.name==='itemId'));
 editForm.props.onSubmit({preventDefault:()=>{},currentTarget:{itemId:'cake',quantity:'25',departmentId:'dessert',neededBy:'2026-11-06',note:'Aangepast'}});
 await new Promise(setImmediate);
 assert.equal(editUi.posted[0].command.kind,'edit');assert.equal(editUi.posted[0].command.id,'request-1');assert.equal(editUi.posted[0].command.quantity,25);
 const cancelUi=requestUi(data);tree=cancelUi.render(props);
 cancelUi.find(tree,node=>node.props?.['aria-label']==='Verzoek intrekken: Testtaart').props.onClick();await new Promise(setImmediate);
 assert.equal(cancelUi.posted[0].command.kind,'cancel');assert.equal(cancelUi.posted[0].command.id,'request-1');
 let refreshed=0;
 const planProps={...props,onPlanned:async()=>{refreshed++;}},planUi=requestUi(data);tree=planUi.render(planProps);
 planUi.find(tree,node=>node.props?.['aria-label']==='Inplannen: Testtaart').props.onClick();tree=planUi.render(planProps);
 const article=planUi.find(tree,node=>node.type==='article');
 assert.equal(requestText(planUi.find(article,node=>node.props?.className==='requestQuantity')),'20');
 const planForm=planUi.find(tree,node=>node.type==='form'&&planUi.nodes(node).some(child=>child.props?.name==='date'));
 assert(!planUi.nodes(planForm).some(node=>node.props?.name==='quantity'),'planning uses the full request amount through its ID');
 planForm.props.onSubmit({preventDefault:()=>{},currentTarget:{date:'2026-11-05',departmentId:'dessert',minutes:'45',pour:'on'}});
 await new Promise(setImmediate);
 assert.equal(planUi.posted[0].command.kind,'plan');assert.equal(planUi.posted[0].command.id,'request-1');assert.equal(refreshed,1);
 const planned=apply(source,planUi.posted[0].command,'compact-task');
 assert.equal(planned.tasks[0].quantity,20);assert.equal(planned.tasks[0].minutes,45);assert.equal(planned.tasks[0].operation,'Produceren + storten');
});
test('compact action icons preserve logistics and read-only permissions',()=>{
 const source=apply(state(),create),data={revision:3,canCreate:true,departments:[],items:source.items,requests:source.productionRequests};
 const logisticsUi=requestUi(data),tree=logisticsUi.render({compact:true,logistics:true});
 const article=logisticsUi.find(tree,node=>node.type==='article');
 assert(logisticsUi.nodes(article).some(node=>node.props?.['aria-label']==='Bewerk verzoek: Testtaart'));
 assert(logisticsUi.nodes(article).some(node=>node.props?.['aria-label']==='Verzoek intrekken: Testtaart'));
 assert(!logisticsUi.nodes(article).some(node=>node.props?.['aria-label']==='Inplannen: Testtaart'));
 const readonlyUi=requestUi({...data,canCreate:false}),readonly=readonlyUi.render({compact:true,logistics:true});
 assert(!readonlyUi.nodes(readonlyUi.find(readonly,node=>node.type==='article')).some(node=>node.type==='button'));
});
const quick=load('app/productie/quickRecipe.ts');
const workspace=load('app/productie/workspaceData.ts',{'./planning':planning});
const recipeData=()=>({ingredients:[{id:'flour',name:'Bloem',recipeUnit:'gram',allergens:['gluten'],lastPrice:123}],recipes:[],invoiceImports:[],manualProductionPlanningItems:[],allergenLists:[]});
const quickInput={itemId:'cake',yield:10,instructions:'Mengen\nBakken',ingredients:[{ingredientId:'flour',quantity:500,unit:'gram'}]};
test('quick entry creates one canonical draft recipe linked to the existing item, preserving tasks, requests and financial data',()=>{
 const data=recipeData(),initial=apply(state(),create);const next=quick.quickRecipe(initial,data,quickInput,'new-recipe',now);
 assert.equal(data.recipes.length,0);assert.equal(next.recipes.recipes.length,1);assert.equal(next.recipes.recipes[0].status,'draft');assert.equal(next.recipes.recipes[0].name,'Testtaart');assert.equal(next.recipes.recipes[0].ingredients[0].ingredientId,'flour');assert.equal(next.planner.items[0].id,'cake');assert.equal(next.planner.items[0].recipeId,'new-recipe');assert.equal(next.recipes.ingredients[0].lastPrice,123);assert.equal(next.planner.productionRequests.length,1);
 const synced=workspace.syncRecipeCatalog(next.planner,next.recipes);assert.equal(synced.items.length,1,'A linked manual item must not get a second recipe catalog item');assert(workspace.validWorkspace(synced,workspace.recipeViews(next.recipes)));
 assert.throws(()=>quick.quickRecipe(next.planner,next.recipes,quickInput,'another',now),/al een recept/);
});
test('quick recipes reject missing/duplicate ingredients, invalid amounts and empty instructions',()=>{
 for(const changes of [{yield:0},{instructions:''},{ingredients:[]},{ingredients:[{ingredientId:'missing',quantity:1,unit:'gram'}]},{ingredients:[quickInput.ingredients[0],quickInput.ingredients[0]]}])assert.throws(()=>quick.quickRecipe(state(),recipeData(),{...quickInput,...changes},'r',now));
});
test('quick-recipe endpoint checks both revisions and department rights before the atomic save',async()=>{
 function endpoint(profile){let saves=0;return {get saves(){return saves;},route:load('app/api/productie/snel-recept/route.ts',{'@/app/lib/auth/session':{getCurrentProfile:async()=>profile},'@/app/productie/access':rights,'@/app/productie/documents.server':{ProductionStoreError:StoreError,readDocument:async key=>({revision:3,data:key==='planner'?state():recipeData()}),saveQuickRecipeDocument:async()=>{saves++;}},'@/app/productie/quickRecipe':quick,'@/app/productie/workRecipe':load('app/productie/workRecipe.ts'),'@/app/productie/productionWork':load('app/productie/productionWork.ts',{'./planning':planning,'./recipePlanning':load('app/productie/recipePlanning.ts',{'./planning':planning})}),'@/app/lib/auth/access':access,'@/app/productie/workspaceData':workspace})};}
 function req(revision=3){return new Request('https://app.invalid/api/productie/snel-recept',{method:'POST',headers:{Origin:'https://app.invalid','Content-Type':'application/json'},body:JSON.stringify({who:"Proefbakker",revision,recipeRevision:3,command:quickInput})});}
 const denied=endpoint(logistics);assert.equal((await denied.route.POST(req())).status,403);assert.equal(denied.saves,0);
 const good=endpoint(baker);assert.equal((await good.route.POST(req())).status,200);assert.equal(good.saves,1);
 const stale=endpoint(baker);assert.equal((await stale.route.POST(req(2))).status,409);assert.equal(stale.saves,0);
});
