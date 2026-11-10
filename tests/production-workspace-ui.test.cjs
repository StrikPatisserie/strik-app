const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const jsx=require('react/jsx-runtime');
function load(file,imports={},globals={}) {
 const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,{exports,require:name=>{assert(name in imports,`Unmocked ${name}`);return imports[name];},Date,Intl,Error,Map,Set,structuredClone,AbortController,setTimeout,clearTimeout,FormData:class{constructor(fields){const data=new FormData();for(const [name,value]of Object.entries(fields))data.set(name,value);return data;}},crypto:require('node:crypto').webcrypto,...globals});return exports;
}
const planning=load('app/productie/planning.ts');
const sample=load('app/preview/productie/sampleData.ts',{'../../productie/planning':planning});
const recipePlanning=load('app/productie/recipePlanning.ts',{'./planning':planning});
const recipeGrouping=load('app/productie/recipeGroups.ts');
const taskOperations=load('app/productie/taskOperations.ts');
const weddingPlanning=load('app/productie/weddingPlanning.ts',{'./planning':planning,'../bruidstaart-studio/pricing':{}});
const productionWork=load('app/productie/productionWork.ts',{'./planning':planning,'./recipePlanning':recipePlanning}),workCommands=load('app/productie/workCommands.ts',{'./productionWork':productionWork});
function harness({fetchImpl,timerApi={}}={}) {
 // Exercise the component's real handlers and render state without a browser,
 // network, effects or live data. Each component retains its own hook storage.
 const records=new Map();let current,index,context;
 const slot=initial=>{const i=index++;if(!(i in current))current[i]=typeof initial==='function'?initial():initial;return i;};
 const react={Fragment:jsx.Fragment,createContext:value=>({Provider:'workspace-provider',defaultValue:value}),useContext:c=>context || c.defaultValue,useEffect:()=>{},useMemo:fn=>fn(),useRef:value=>current[slot(()=>({current:value}))],useState:initial=>{const i=slot(initial),store=current;return[store[i],next=>{store[i]=typeof next==='function'?next(store[i]):next;}];}};
 const navigation={__esModule:true,default:function Navigation(){},ProductionMobileNavigation:function MobileNavigation(){}};
 const offerWidget={__esModule:true,default:function ProductionWeekOffer(){}};
 const pickerWidget={__esModule:true,default:function ProductionItemPicker(){}};
 const component=load('app/preview/productie/ProductionPreview.tsx',{'react':react,'react/jsx-runtime':jsx,'next/link':'a','../../productie/ProductionIcon':{__esModule:true,default:()=>null},'../../productie/ProductionNavigation':navigation,'../../productie/navigation':load('app/productie/navigation.ts',{'./planning':planning}),'../../productie/dayRhythm':load('app/productie/dayRhythm.ts',{'./planning':planning}),'next/dynamic':()=>()=>null,'../../productie/WeddingWeekLane':{__esModule:true,default:()=>null},'../../productie/useProductionUpdates':{__esModule:true,default:()=>false},'../../productie/usePhysicalKeyboard':{__esModule:true,default:()=>({physicalKeyboard:false,setPhysicalKeyboard(){},storageError:false})},'../../productie/useTaskDrag':{__esModule:true,default:()=>({getHandleProps:()=>({onClick(){}}),cancelDrag(){}})},'../../productie/productionUpdates':{},'../../productie/useScreenLayout':{__esModule:true,default:()=>({frameRef:{current:null},workspaceRef:{current:null}})},'../../productie/TaskWorkPanel':{__esModule:true,default:function TaskWorkPanel(){},WorkClock:function WorkClock(){},PreparationControl:function PreparationControl(){},RecipeWorkHistory:function RecipeWorkHistory(){}},'../../productie/workCommands':workCommands,'../../productie/QuickRecipeForm':{__esModule:true,default:()=>null},'../../productie/ProductionRequests':{__esModule:true,default:()=>null},'../../productie/ProductionWeekOffer':offerWidget,'../../productie/ProductionItemPicker':pickerWidget,'../../productie/SearchableChoice':{__esModule:true,default:function SearchableChoice(){}},'../../productie/recipeGroups':recipeGrouping,'../../productie/taskOperations':taskOperations,'../../productie/CleaningWeekLane':{__esModule:true,default:()=>null},'../../productie/weddingPlanning':weddingPlanning,'../../productie/planning':planning,'./sampleData':sample,'./production.module.css':{__esModule:true,default:new Proxy({},{get:(_,key)=>key})},'../../productie/workspaceData':{},'../../productie/recipePlanning':recipePlanning},{fetch:fetchImpl||(()=>assert.fail('Unexpected live request in the UI harness')),...timerApi});
 const render=(fn,props={},value)=>{if(!records.has(fn))records.set(fn,[]);current=records.get(fn);index=0;context=value;return fn(props);};
 return{render,Component:component.default,navigation,offerWidget:offerWidget.default,pickerWidget:pickerWidget.default};
}
function nodes(tree) {if(!tree || typeof tree!=='object')return[];if(Array.isArray(tree))return tree.flatMap(nodes);return[tree,...nodes(tree.props?.children)];}
function visibleNodes(tree) {
 if(!tree||typeof tree!=='object')return [];
 if(Array.isArray(tree))return tree.flatMap(visibleNodes);
 const children=tree.type==='details'&&!tree.props.open
  ?nodes(tree.props.children).filter(node=>node.type==='summary')
  :tree.props?.children;
 return [tree,...visibleNodes(children)];
}
function text(tree){if(typeof tree==='string' || typeof tree==='number')return String(tree);if(Array.isArray(tree))return tree.map(text).join('');return tree?.props?text(tree.props.children):'';}
function find(tree,predicate){const node=nodes(tree).find(predicate);assert(node,'Expected rendered control');return node;}
function button(tree,label){return find(tree,n=>n.type==='button' && (text(n)===label || n.props['aria-label']===label));}
function xl(h,props={}) {let tree=h.render(h.Component,props);button(tree,'XL weergave').props.onClick();return h.render(h.Component,props);}

function movingTaskHarness(state=sample.initialPreviewState()){
 const requests=[],timers=new Map();let timerId=0;
 const timerApi={setTimeout:(callback,delay)=>{timers.set(++timerId,{callback,delay});return timerId;},clearTimeout:id=>timers.delete(id)};
 const h=harness({timerApi,fetchImpl:(url,init)=>new Promise((resolve,reject)=>{requests.push({url,init,resolve,reject});init.signal?.addEventListener('abort',()=>reject(Error('Request aborted')));})});
 const live={state,today:sample.DEMO_TODAY,recipes:sample.demoRecipes,ingredients:[],canManage:true,departments:planning.DEPARTMENTS.map(department=>department.id),revision:7};
 let refreshes=0;
 const props={live,onRefresh:async()=>{refreshes++;}};
 const render=()=>h.render(h.Component,props);
 const cell=(tree,label)=>find(tree,node=>node.props?.onDrop&&node.props['aria-label']===label);
 const card=(tree)=>find(tree,node=>node.type==='article'&&node.key==='f5');
 const located=(tree,label)=>nodes(cell(tree,label)).some(node=>node.type==='article'&&node.key==='f5');
 const drag=()=>{const tree=render();card(tree).props.onDragStart({dataTransfer:{setData(){}}});return render();};
 return{h,props,live,state,requests,render,cell,card,located,drag,timers,expireSaves:()=>[...timers.values()].forEach(timer=>timer.callback()),get refreshes(){return refreshes;},flush:()=>new Promise(resolve=>setImmediate(resolve))};
}

test('a live task moves immediately while one save retains its identity and blocks a competing stale drop',async()=>{
 const m=movingTaskHarness(),before=JSON.stringify(m.state),original=m.state.tasks.find(task=>task.id==='f5');
 const dragged=m.drag(),destination=m.cell(dragged,'Luxe gebak · vr 30 okt'),competing=m.cell(dragged,'Desserttaart & fruit · za 31 okt');
 destination.props.onDrop({preventDefault(){}});
 assert.equal(m.requests.length,1);
 let tree=m.render();assert(m.located(tree,'Luxe gebak · vr 30 okt'),'The card reaches the destination before the server answers');assert(!m.located(tree,'Desserttaart & fruit · do 29 okt'));
 assert.equal(m.card(tree).props['data-task-saving'],true);assert.equal(m.card(tree).props.draggable,false);
 assert.equal(find(tree,node=>node.props?.['data-task-date']==='2026-10-30'&&node.props['aria-pressed']!==undefined).props['aria-pressed'],true);
 const request=m.requests[0],body=JSON.parse(request.init.body),moved=body.state.tasks.find(task=>task.id===original.id);
 assert.equal(request.url,'/api/productie');assert.equal(request.init.method,'PUT');assert.equal(body.revision,7);
 assert.equal(m.timers.size,1);assert.equal([...m.timers.values()][0].delay,15000);assert.equal(request.init.signal.aborted,false);
 assert.deepEqual(moved,{...original,date:'2026-10-30',departmentId:'luxe'});
 assert.equal(JSON.stringify(body.state.items),JSON.stringify(m.state.items));assert.equal(JSON.stringify(body.state.tasks.filter(task=>task.id!==original.id)),JSON.stringify(m.state.tasks.filter(task=>task.id!==original.id)));
 assert.equal(JSON.stringify(m.state),before,'The supplied workspace remains immutable');
 competing.props.onDrop({preventDefault(){}});tree=m.render();assert.equal(m.requests.length,1);assert(m.located(tree,'Luxe gebak · vr 30 okt'),'A stale second handler cannot roll back or replace the pending move');
 request.resolve({ok:true,json:async()=>({state:body.state,revision:8,updatedAt:'2026-11-10T09:00:00.000Z'})});await m.flush();
 tree=m.render();assert(m.located(tree,'Luxe gebak · vr 30 okt'));assert.equal(m.card(tree).props.draggable,true);assert.equal(m.card(tree).props['data-task-saving'],undefined);assert.equal(m.refreshes,0);assert.equal(m.timers.size,0,'Successful saves clear their timeout');
 m.cell(m.drag(),'Desserttaart & fruit · vr 30 okt').props.onDrop({preventDefault(){}});
 assert.equal(m.requests.length,2);assert.equal(JSON.parse(m.requests[1].init.body).revision,8,'The next move uses the confirmed revision even while parent polling still has revision 7');
 m.requests[1].resolve({ok:true,json:async()=>({state:JSON.parse(m.requests[1].init.body).state,revision:9,updatedAt:'2026-11-10T09:01:00.000Z'})});await m.flush();
});

test('a rejected or unconfirmed live move rolls back once, refreshes read-only and never resends the write',async()=>{
 for(const failure of ['conflict','forbidden','network']){
  const m=movingTaskHarness(),before=JSON.stringify(m.state),dragged=m.drag();
  m.cell(dragged,'Luxe gebak · vr 30 okt').props.onDrop({preventDefault(){}});
  assert(m.located(m.render(),'Luxe gebak · vr 30 okt'));
  const request=m.requests[0];
  if(failure==='network')request.reject(Error('Verbinding verbroken'));
  else request.resolve({ok:false,status:failure==='conflict'?409:403,json:async()=>({message:failure==='conflict'?'Intussen gewijzigd':'Geen rechten'})});
  await m.flush();const tree=m.render();
  assert(m.located(tree,'Desserttaart & fruit · do 29 okt'));assert(!m.located(tree,'Luxe gebak · vr 30 okt'));
  assert.equal(m.refreshes,1);assert.equal(m.requests.length,1);assert.equal(JSON.stringify(m.state),before);assert.equal(m.card(tree).props.draggable,true);assert.equal(m.card(tree).props['data-task-saving'],undefined);
  assert.equal(find(tree,node=>node.props?.['data-task-date']===sample.DEMO_TODAY&&node.props['aria-pressed']!==undefined).props['aria-pressed'],true,'A failed move restores the selected mobile day');
  assert(text(tree).includes(failure==='network'?'Verbinding verbroken':failure==='conflict'?'Intussen gewijzigd':'Geen rechten'));
 }
});

test('a stalled optimistic move aborts after fifteen seconds and restores an idle, refreshable board without retrying',async()=>{
 const m=movingTaskHarness(),before=JSON.stringify(m.state);
 m.cell(m.drag(),'Luxe gebak · vr 30 okt').props.onDrop({preventDefault(){}});
 assert(m.located(m.render(),'Luxe gebak · vr 30 okt'));assert.equal(m.requests.length,1);assert.equal(m.timers.size,1);
 const request=m.requests[0];assert.equal(request.init.signal.aborted,false);
 m.expireSaves();await m.flush();
 const tree=m.render();assert.equal(request.init.signal.aborted,true);assert.equal(m.timers.size,0);
 assert(m.located(tree,'Desserttaart & fruit · do 29 okt'));assert(!m.located(tree,'Luxe gebak · vr 30 okt'));
 assert.equal(m.card(tree).props.draggable,true);assert.equal(m.card(tree).props['data-task-saving'],undefined);assert.equal(m.refreshes,1);assert.equal(m.requests.length,1);assert.equal(JSON.stringify(m.state),before);
 assert(text(tree).includes('Opslaan duurt te lang. De planning wordt opnieuw opgehaald.'));
 m.expireSaves();await m.flush();assert.equal(m.refreshes,1);assert.equal(m.requests.length,1,'Timeout recovery only refreshes and never resends the move');
});

test('cleaning moves immediately through its dedicated endpoint and a failed save restores the original checklist',async()=>{
 for(const succeeds of [true,false]){
  const state=sample.initialPreviewState();
  state.cleaning=planning.applyCleaningCommand([],{kind:'plan',date:'2026-10-29',main:'Koeling reinigen',daily:['Werkbank schoon'],repeatDates:[]},'test-baker','2026-10-28T09:00:00.000Z',(()=>{let id=0;return()=>`clean-test-${++id}`;})());
  const before=JSON.stringify(state),m=movingTaskHarness(state),lane=tree=>find(tree,node=>typeof node.type==='function'&&Array.isArray(node.props.rows)&&!!node.props.onCommand);
  const command={kind:'move',date:'2026-10-29',to:'2026-10-30'};
  const result=lane(m.render()).props.onCommand(command);
  assert.equal(m.requests.length,1);const request=m.requests[0];
  assert.equal(request.url,'/api/productie/schoonmaak');assert.equal(request.init.method,'POST');assert.deepEqual(JSON.parse(request.init.body),{command,revision:7});assert.equal(m.timers.size,1);
  let tree=m.render();assert.equal(lane(tree).props.saving,true);assert.equal(lane(tree).props.rows[0].date,'2026-10-30');assert.equal(lane(tree).props.rows[0].id,'cleaning:2026-10-30');
  assert.equal(lane(tree).props.rows[0].main.id,state.cleaning[0].main.id);assert.equal(lane(tree).props.rows[0].daily[0].id,state.cleaning[0].daily[0].id);
  assert.equal(JSON.stringify(state),before);
  const saved={...state,cleaning:planning.applyCleaningCommand(state.cleaning,command,'server','2026-10-28T10:00:00.000Z',()=>assert.fail('Moving must preserve check identities'))};
  request.resolve({ok:succeeds,status:succeeds?200:409,json:async()=>succeeds?{state:saved,revision:8,updatedAt:'2026-10-28T10:00:00.000Z'}:{message:'Schoonmaak intussen gewijzigd'}});
  assert.equal(await result,succeeds?undefined:'Schoonmaak intussen gewijzigd');await m.flush();tree=m.render();
  assert.equal(lane(tree).props.saving,false);assert.equal(lane(tree).props.rows[0].date,succeeds?'2026-10-30':'2026-10-29');assert.equal(m.refreshes,succeeds?0:1);assert.equal(m.requests.length,1);assert.equal(m.timers.size,0);
  assert.equal(find(tree,node=>node.props?.['data-task-date']===(succeeds?'2026-10-30':sample.DEMO_TODAY)&&node.props['aria-pressed']!==undefined).props['aria-pressed'],true);
 }
});

test('wedding moves immediately through its dedicated endpoint and rejection restores the same linked production task',async()=>{
 const order={code:'DEMO-OPT-MOVE',name:'Voorbeeld bruidspaar',date:'2026-10-31',updatedAt:'2026-10-28T09:00:00.000Z',size:'Voorbeeldformaat',time:'12:00',lines:[],config:{}};
 for(const succeeds of [true,false]){
  const state=weddingPlanning.scheduleWedding(sample.initialPreviewState(),order,'2026-10-29','planned'),before=JSON.stringify(state),original=state.tasks.find(task=>task.weddingCode===order.code);
  const m=movingTaskHarness(state),lane=tree=>find(tree,node=>typeof node.type==='function'&&!!node.props.onUpdate&&!!node.props.state);
  const result=lane(m.render()).props.onUpdate(order,'2026-10-30','planned');
  assert.equal(m.requests.length,1);const request=m.requests[0];
  assert.equal(request.url,'/api/productie/weddings');assert.equal(request.init.method,'POST');assert.deepEqual(JSON.parse(request.init.body),{code:order.code,date:'2026-10-30',status:'planned',revision:7});assert.equal(m.timers.size,1);
  let tree=m.render(),task=lane(tree).props.state.tasks.find(task=>task.id===original.id);
  assert.equal(lane(tree).props.saving,true);assert.equal(task.date,'2026-10-30');assert.equal(task.itemId,original.itemId);assert.equal(task.batchId,original.batchId);assert.equal(task.weddingCode,original.weddingCode);assert.equal(task.weddingDeliveryDate,original.weddingDeliveryDate);assert.equal(JSON.stringify(state),before);
  request.resolve({ok:succeeds,status:succeeds?200:403,json:async()=>succeeds?{state:weddingPlanning.scheduleWedding(state,order,'2026-10-30','planned'),revision:8,updatedAt:'2026-10-28T10:00:00.000Z'}:{message:'Bruidstaart verplaatsen geweigerd'}});
  assert.equal(await result,succeeds?undefined:'Bruidstaart verplaatsen geweigerd');await m.flush();tree=m.render();task=lane(tree).props.state.tasks.find(task=>task.id===original.id);
  assert.equal(lane(tree).props.saving,false);assert.equal(task.date,succeeds?'2026-10-30':'2026-10-29');assert.equal(task.id,original.id);assert.equal(m.refreshes,succeeds?0:1);assert.equal(m.requests.length,1);assert.equal(m.timers.size,0);
  assert.equal(find(tree,node=>node.props?.['data-task-date']===(succeeds?'2026-10-30':sample.DEMO_TODAY)&&node.props['aria-pressed']!==undefined).props['aria-pressed'],true);
 }
});

test('dropping in the original cell or after the required date never changes state or sends a write',async()=>{
 const same=movingTaskHarness(),before=JSON.stringify(same.state);
 same.cell(same.drag(),'Desserttaart & fruit · do 29 okt').props.onDrop({preventDefault(){}});await same.flush();
 assert.equal(same.requests.length,0);assert.equal(same.refreshes,0);assert(same.located(same.render(),'Desserttaart & fruit · do 29 okt'));assert.equal(JSON.stringify(same.state),before);
 const late=movingTaskHarness(),initial=late.render();
 find(initial,node=>node.type==='article'&&node.key==='f6').props.onDragStart({dataTransfer:{setData(){}}});
 late.cell(late.render(),'Desserttaart & fruit · za 31 okt').props.onDrop({preventDefault(){}});await late.flush();
 assert.equal(late.requests.length,0);assert.equal(late.refreshes,0);assert.equal(JSON.stringify(late.state),before);assert(text(late.render()).includes('benodigde datum'));
});

test('live synchronization respects the synchronous save lock and the newest confirmed revision',()=>{
 const source=fs.readFileSync('app/preview/productie/ProductionPreview.tsx','utf8');
 const guard=source.indexOf('live.revision>=revisionRef.current');assert(guard>0);
 const effect=source.slice(source.lastIndexOf('useEffect',guard),source.indexOf('},[',guard));
 assert.match(effect,/!savingRef\.current/);assert.match(effect,/!saving\b/);assert.match(effect,/!dragged\b/);assert.match(effect,/live\.revision>=revisionRef\.current/);
});

test('a day-cell plus uses its date and department without asking for either again',async()=>{
 const h=harness();
 let tree=xl(h);
 button(tree,'Taak toevoegen · Luxe gebak · do 29 okt').props.onClick();
 tree=h.render(h.Component);
 const form=find(tree,node=>typeof node.type==='function'&&!!node.props.onPlan);
 const submitted=[];
 const props={...form.props,onPlan:async command=>{submitted.push(command);}};
 const render=()=>h.render(form.type,props,tree.props.value);
 let view=render();
 find(view,node=>node.type===h.pickerWidget).props.onChange('creme');
 view=render();
 assert.equal(view.props.subtitle,'Luxe gebak · '+planning.dateLabel('2026-10-29',true));
 const date=find(find(view,node=>node.type==='label'&&text(node)==='Productiedatum'),node=>node.type==='input');
 assert.equal(date.props.value,'2026-10-29');
 assert(!visibleNodes(view).includes(date),'The chosen date is shown as context, with its input tucked under More options');
 const quantity=find(view,node=>node.type==='input'&&node.props.type==='number');
 quantity.props.onChange({target:{value:'7'}});
 view=render();
 await find(view,node=>node.type==='form').props.onSubmit({preventDefault:()=>{},currentTarget:{source:'manual',note:'',dueDate:'',output:'on'}});
 assert.equal(submitted[0].task.date,'2026-10-29');
 assert.equal(submitted[0].task.departmentId,'luxe');
 assert.equal(submitted[0].amount,7);

 form.props.onNewItem();
 tree=h.render(h.Component);
 const itemForm=find(tree,node=>typeof node.type==='function'&&!!node.props.onSave);
 const state={...itemForm.props.state,items:[...itemForm.props.state.items,{id:'cell-temporary',name:'Tijdelijk onderdeel',kind:'component',unit:'kg',departmentId:'bak',stock:0,note:''}]};
 await itemForm.props.onSave(state);
 tree=h.render(h.Component);
 const returned=find(tree,node=>typeof node.type==='function'&&!!node.props.onPlan);
 assert.equal(returned.props.initial.fromCell,true);
 assert.equal(returned.props.initial.date,'2026-10-29');
 assert.equal(returned.props.initial.departmentId,'luxe');
});

test('the current calendar offer stays independent of the selected board week and opens a fixed image',()=>{
 const h=harness(),calendarWeek=planning.mondayOf(sample.DEMO_TODAY),boardWeek=planning.addDays(calendarWeek,14);
 const currentOffer={weekStart:calendarWeek,label:'Voorbeeldtaart',imageUrl:'/voorbeeldtaart.png'};
 const live={state:sample.initialPreviewState(),today:sample.DEMO_TODAY,recipes:sample.demoRecipes,ingredients:[],canManage:true,departments:['dessert'],revision:1,weeklyOffers:[currentOffer]};
 const props={live,initialWeek:boardWeek};
 let tree=xl(h,props);
 const actions=find(tree,n=>n.type==='header' && n.props['aria-label']==='Planningacties');
 const labels=nodes(actions).filter(n=>n.type==='button').map(n=>n.props['aria-label'] || text(n));
 assert.deepEqual(labels,['XL weergave','Volledig scherm','Inplannen']);
 let offer=find(tree,n=>n.type===h.offerWidget);
 assert.equal(offer.props.week,calendarWeek);
 assert.equal(offer.props.paused,false);
 offer.props.onOpen(calendarWeek,currentOffer);
 tree=h.render(h.Component,{...props,live:{...live,weeklyOffers:[{...currentOffer,imageUrl:'/nieuw.png'}]}});
 const dialog=find(tree,n=>typeof n.type==='function' && n.props.title===`Weekaanbieding · week ${planning.weekNumber(calendarWeek)}`);
 assert.equal(find(dialog,n=>n.type==='img').props.src,'/voorbeeldtaart.png');
 assert.equal(find(tree,n=>n.type===h.offerWidget).props.paused,true);
 dialog.props.onClose();
 tree=h.render(h.Component,props);button(tree,'Volgende week').props.onClick();tree=h.render(h.Component,props);
 offer=find(tree,n=>n.type===h.offerWidget);
 assert.equal(offer.props.week,calendarWeek);
 const nextWeek=planning.addDays(calendarWeek,7);
 offer.props.onManage(nextWeek);tree=h.render(h.Component,props);
 assert(find(tree,n=>typeof n.type==='function' && n.props.initialOfferWeek===nextWeek));
 assert(button(tree,'XL weergave'));assert(button(tree,'Inplannen'));
});

test('delegated plan management retains XL add/delete and work-recipe editing without management data links',()=>{
 const h=harness(),live={state:sample.initialPreviewState(),today:sample.DEMO_TODAY,recipes:sample.demoRecipes,ingredients:[],canManage:true,canManageData:false,departments:planning.DEPARTMENTS.map(d=>d.id),revision:1,recipeRevision:1};
 let tree=xl(h,{live});assert(button(tree,'Inplannen'));assert(!nodes(tree).some(n=>n.props?.['aria-label']==='Aanbieding beheren'));assert.equal(find(tree,n=>n.type===h.offerWidget).props.onManage,undefined);
 assert(nodes(tree).some(n=>n.type==='button'&&n.props['aria-label']?.startsWith('Taak toevoegen ·')));
 button(tree,'Open 48 stuks Fruitdesserttaart · Afwerken').props.onClick();tree=h.render(h.Component,{live});
 const detail=find(tree,n=>typeof n.type==='function'&&n.props?.task&&n.props?.onRemove);
 const detailTree=h.render(detail.type,detail.props,tree.props.value);assert(button(detailTree,'Geplande taak verwijderen'));assert(button(detailTree,'Werkrecept aanpassen'));
 const list=harness(),recipeTree=list.render(list.Component,{live,initialView:'recipes'});assert(button(recipeTree,'Los onderdeel toevoegen'));assert(!nodes(recipeTree).some(n=>n.props?.href?.startsWith('/bakkerij/productie/beheer/')));
});

test('XL keeps planning controls, drag/drop and task editing while hiding the navigation',async()=>{
 const h=harness();let tree=xl(h);
 assert(!nodes(tree).some(n=>n.type===h.navigation.default));
 assert(button(tree,'Inplannen'));assert(find(tree,n=>n.type==='select' && text(n).includes('Nog te doen')));
 const card=find(tree,n=>n.type==='article' && n.props.draggable && n.props.className.includes('task_planned') && nodes(n).some(c=>c.type==='button' && c.props['aria-label']?.startsWith('Open ')));
 const taskId=card.key,open=nodes(card).find(n=>n.props?.className==='taskOpen');
 const dt={setData:(format,value)=>{assert.equal(format,'text/plain');assert.equal(value,taskId);}};
 card.props.onDragStart({dataTransfer:dt});tree=h.render(h.Component);
 const target=find(tree,n=>n.props?.onDrop && n.props['aria-label']==='Desserttaart & fruit · za 31 okt');
 let accepted=false;target.props.onDragOver({preventDefault:()=>{accepted=true;},dataTransfer:dt});assert(accepted);assert.equal(dt.dropEffect,'move');
 target.props.onDrop({preventDefault:()=>{}});tree=h.render(h.Component);
 const moved=find(tree,n=>n.props?.onDrop && n.props['aria-label']==='Desserttaart & fruit · za 31 okt');assert(nodes(moved).some(n=>n.key===taskId));
 open.props.onClick();tree=h.render(h.Component);
 const detail=find(tree,n=>typeof n.type==='function' && !!n.props.onMove),detailTree=h.render(detail.type,detail.props,tree.props.value);
 for(const label of ['Verplaatsen','Geplande taak verwijderen'])assert(button(detailTree,label));
 assert(find(detailTree,n=>n.type==='summary' && text(n).includes('volgende stap')));
 await find(detailTree,n=>typeof n.type==='function' && n.props.onCommand && n.props.task).props.onCommand({kind:'start',taskId,who:'Proefbakker'});tree=h.render(h.Component);
 assert.equal(find(tree,n=>typeof n.type==='function' && !!n.props.onMove).props.task.status,'active');
});

test('XL does not grant planning or deletion permissions to a production employee',()=>{
 const h=harness(),live={state:sample.initialPreviewState(),today:sample.DEMO_TODAY,recipes:sample.demoRecipes,ingredients:[],canManage:false,departments:['dessert'],revision:1};
 let tree=xl(h,{live});assert(!nodes(tree).some(n=>n.type==='article' && n.props.draggable));assert(!nodes(tree).some(n=>n.type==='button' && text(n)==='Inplannen'));
 find(tree,n=>n.props?.className==='taskOpen').props.onClick();tree=h.render(h.Component,{live});
 const detail=find(tree,n=>typeof n.type==='function' && !!n.props.onMove),detailTree=h.render(detail.type,detail.props,tree.props.value);
 assert(nodes(detailTree).some(n=>typeof n.type==='function' && n.props.onCommand && n.props.task));assert(!nodes(detailTree).some(n=>n.type==='form' || n.props?.className==='deleteButton'));
});
test('cleaning is a blue integrated lane on the Patisserie board and remains editable in XL without a new department or stock task',async()=>{
 const h=harness();let tree=xl(h),lane=find(tree,n=>typeof n.type==='function' && Array.isArray(n.props.rows) && !!n.props.onCommand);
 assert(lane.props.canManage);assert(lane.props.canCheck);assert.equal(lane.props.rows.length,0);
 lane.props.onOpen({date:sample.DEMO_TODAY,edit:true});tree=h.render(h.Component);lane=find(tree,n=>typeof n.type==='function' && !!n.props.onCommand);assert.equal(lane.props.selected.date,sample.DEMO_TODAY);
 await lane.props.onCommand({kind:'plan',date:sample.DEMO_TODAY,main:'Voorbeeld hoofdtaak',daily:['Voorbeeld dagelijks'],repeatDates:[]});tree=h.render(h.Component);lane=find(tree,n=>typeof n.type==='function' && !!n.props.onCommand);assert.equal(lane.props.rows.length,1);assert.equal(lane.props.rows[0].main.label,'Voorbeeld hoofdtaak');
 assert(!nodes(h.render(h.Component)).some(n=>n.type===h.navigation.default));
 assert(!planning.DEPARTMENTS.some(d=>d.id==='cleaning'));
 const select=find(tree,n=>n.type==='select' && nodes(n).some(c=>c.type==='option' && c.props.value==='bak'));select.props.onChange({target:{value:'bak'}});tree=h.render(h.Component);assert(!nodes(tree).some(n=>typeof n.type==='function' && !!n.props.onCommand));
});

test('planned task details foreground the recipe, hide output/allergen noise and use labelled icon actions',()=>{
 const h=harness();let tree=h.render(h.Component);
 find(tree,n=>n.props?.['aria-label']==='Open 48 stuks Fruitdesserttaart · Afwerken').props.onClick();tree=h.render(h.Component);
 const detail=find(tree,n=>typeof n.type==='function' && !!n.props.onMove),detailTree=h.render(detail.type,detail.props,tree.props.value);
 assert(!text(detailTree).includes('Afronden voegt'));assert(!text(detailTree).includes('productieregistratie'));
 const recipe=find(detailTree,n=>typeof n.type==='function' && n.props.hideAllergens===true),recipeTree=h.render(recipe.type,recipe.props,tree.props.value);
 assert(text(recipeTree).includes('Taartbodem'));assert(!nodes(recipeTree).some(n=>n.props?.className==='allergenNote'));
 for(const label of ['Geplande taak verwijderen','Terug naar het bord']){const control=button(detailTree,label);assert.equal(control.props.title,label);assert.equal(text(control),'');}
 assert(!nodes(detailTree).some(n=>n.props?.className==='deleteTask'));
 assert(nodes(detailTree).some(n=>n.type==='details' && !n.props.open));
});

test('a blocked preparation links directly to its consumer and can remove the explicit whole recipe production',async()=>{
 const h=harness(),source=sample.initialPreviewState(),command={task:{id:'auto',itemId:'fruit',date:sample.DEMO_TODAY,departmentId:'dessert',operation:'Afmaken',status:'planned',note:'',source:'manual',batchId:'batch-auto',recordsOutput:true},amount:12,amountMode:'quantity',preparation:{daysBefore:1,choices:{}}};
 const state=recipePlanning.buildRecipePlan(source,sample.demoRecipes,command),preparation=state.tasks.find(t=>t.generatedFor==='auto');
 const live={state,today:sample.DEMO_TODAY,recipes:sample.demoRecipes,ingredients:[],canManage:true,departments:['dessert','kapsel'],revision:1};
 let tree=h.render(h.Component,{live});find(tree,n=>n.props?.['aria-label']?.startsWith(`Open ${preparation.quantity} `) && n.props['aria-label'].includes('Bereiden')).props.onClick();tree=h.render(h.Component,{live});
 const detail=find(tree,n=>typeof n.type==='function' && !!n.props.onMove),opened=[],removed=[],props={...detail.props,onOpenTask:id=>opened.push(id),onRemove:async whole=>{removed.push(whole);}};
 let detailTree=h.render(detail.type,props,tree.props.value);assert.equal(button(detailTree,'Geplande taak verwijderen').props.disabled,false);
 await button(detailTree,'Geplande taak verwijderen').props.onClick();detailTree=h.render(detail.type,props,tree.props.value);
 assert.equal(button(detailTree,'Alleen deze taak verwijderen').props.disabled,true);
 const link=find(detailTree,n=>n.props?.['aria-label']?.startsWith('Open gekoppelde vervolgstap: Fruitdesserttaart'));link.props.onClick();assert.deepEqual(opened,['auto']);
 assert.equal(button(detailTree,'Hele receptproductie verwijderen').props.disabled,false);await button(detailTree,'Hele receptproductie verwijderen').props.onClick();assert.deepEqual(removed,[true]);
});

test('a late preparation can be repaired or cancelled in XL and its input never disappears',async()=>{
 const h=harness();let tree=xl(h);button(tree,'Inplannen').props.onClick();tree=h.render(h.Component);
 const form=find(tree,n=>typeof n.type==='function' && !!n.props.onPlan),render=()=>h.render(form.type,form.props,tree.props.value);
 let formTree=render();
 find(formTree,n=>n.type===h.pickerWidget).props.onChange('fruit');formTree=render();
 const dateInput=find(formTree,n=>n.type==='input' && n.props['aria-label']?.startsWith('Productiedatum '));
 const label=dateInput.props['aria-label'];dateInput.props.onChange({target:{value:'2026-11-05'}});formTree=render();
 const invalid=find(formTree,n=>n.props?.['aria-label']===label);assert.equal(invalid.props['aria-invalid'],true);assert.equal(invalid.props.value,'2026-11-05');assert.equal(find(formTree,n=>n.props?.type==='submit').props.disabled,true);
 // Submitting an invalid proposal must not call through; then the repair also
 // clears the stale submit error while retaining the editable row.
 await find(formTree,n=>n.type==='form').props.onSubmit({preventDefault:()=>{}});formTree=render();assert(find(formTree,n=>n.props?.role==='alert'));
 button(formTree,`Zet op ${planning.dateLabel(invalid.props.max,true)}`).props.onClick();formTree=render();
 const repaired=find(formTree,n=>n.props?.['aria-label']===label);assert.equal(repaired.props.value,invalid.props.max);assert(!repaired.props['aria-invalid']);assert(!nodes(formTree).some(n=>n.props?.role==='alert'));assert.equal(find(formTree,n=>n.props?.type==='submit').props.disabled,false);
 button(formTree,'Annuleren').props.onClick();tree=h.render(h.Component);assert(!nodes(tree).some(n=>typeof n.type==='function' && !!n.props.onPlan));
});

test('adding through a department keeps that department and preserves the draft while editing its recipe',()=>{
 const h=harness();
 const live={state:sample.initialPreviewState(),today:sample.DEMO_TODAY,recipes:sample.demoRecipes,ingredients:[],canManage:true,departments:planning.DEPARTMENTS.map(d=>d.id),revision:1};
 let tree=xl(h,{live});
 find(tree,n=>n.type==='button' && n.props['aria-label']?.startsWith('Taak toevoegen · Luxe gebak ·')).props.onClick();
 tree=h.render(h.Component,{live});
 let form=find(tree,n=>typeof n.type==='function' && !!n.props.onPlan);
 const render=()=>h.render(form.type,form.props,tree.props.value);
 const field=(view,label,type)=>find(find(view,n=>n.type==='label' && text(n).startsWith(label) && (label!=='Afdeling'||nodes(n).some(child=>child.type==='select'&&!child.props['aria-label']))),n=>n.type===type);
 let view=render();
 const picker=find(view,n=>n.type===h.pickerWidget);
 assert(picker.props.items.some(item=>item.id==='fruit' && item.searchValues.includes('Vers fruit')));
 picker.props.onChange('fruit');
 view=render();
 assert.equal(field(view,'Afdeling','select').props.value,'luxe');
 field(view,'Aantal (','input').props.onChange({target:{value:'100'}});
 field(view,'Productiedatum','input').props.onChange({target:{value:'2026-11-05'}});
 find(view,n=>n.type==='input'&&n.props.name==='minutes').props.onChange({target:{value:'45'}});
 const extraOptions=find(view,n=>typeof n.type==='function'&&n.type.name==='TaskOperationOptions'&&!n.props.label);
 const options=h.render(extraOptions.type,extraOptions.props,tree.props.value);
 find(find(options,n=>n.type==='label'&&text(n)==='Storten'),n=>n.type==='input').props.onChange({target:{checked:true}});
 view=render();
 button(view,'Recept aanpassen').props.onClick();
 tree=h.render(h.Component,{live});
 // The draft must remain mounted underneath the recipe editor. The hook harness
 // deliberately does not simulate unmounting, so assert the mounting explicitly.
 assert(find(tree,n=>n.type===form.type && !!n.props.onPlan));
 const editor=find(tree,n=>typeof n.type==='function' && n.props.item?.id==='fruit' && !!n.props.getRevision);
 editor.props.onClose();
 tree=h.render(h.Component,{live});
 form=find(tree,n=>n.type===form.type && !!n.props.onPlan);
 view=render();
 assert.equal(find(view,n=>n.type===h.pickerWidget).props.value,'fruit');
 assert.equal(field(view,'Afdeling','select').props.value,'luxe');
 assert.equal(field(view,'Aantal (','input').props.value,'100');
 assert.equal(field(view,'Productiedatum','input').props.value,'2026-11-05');
 assert.equal(find(view,n=>n.type==='input'&&n.props.name==='minutes').props.value,'45');
 const restored=find(view,n=>typeof n.type==='function'&&n.type.name==='TaskOperationOptions'&&!n.props.label);
 const restoredOptions=h.render(restored.type,restored.props,tree.props.value);
 assert.equal(find(find(restoredOptions,n=>n.type==='label'&&text(n)==='Storten'),n=>n.type==='input').props.checked,true);
});

test('normal task creation submits checked extra operations and an optional total time',async()=>{
 const h=harness();let tree=xl(h);
 button(tree,'Inplannen').props.onClick();tree=h.render(h.Component);
 const form=find(tree,n=>typeof n.type==='function'&&!!n.props.onPlan),submitted=[];
 const props={...form.props,onPlan:async command=>{submitted.push(command);}};
 const render=()=>h.render(form.type,props,tree.props.value);
 let view=render();
 find(view,n=>n.type===h.pickerWidget).props.onChange('creme');view=render();
 const time=find(view,n=>n.type==='input'&&n.props.name==='minutes');
 const more=find(view,n=>n.type==='details'&&nodes(n).some(child=>child.type==='summary'&&text(child)==='Meer opties'));
 assert.equal(more.props.open,undefined);assert(nodes(more).includes(time),'Time stays mounted inside the closed optional controls');
 assert.equal(time.props.required,undefined);
 const options=find(view,n=>typeof n.type==='function'&&n.type.name==='TaskOperationOptions'&&!n.props.label);
 const optionsView=h.render(options.type,options.props,tree.props.value);
 find(find(optionsView,n=>n.type==='label'&&text(n)==='Storten'),n=>n.type==='input').props.onChange({target:{checked:true}});
 time.props.onChange({target:{value:'45'}});view=render();
 const submit=()=>find(view,n=>n.type==='form').props.onSubmit({preventDefault:()=>{},currentTarget:{source:'manual',note:'',dueDate:'',output:'on'}});
 await submit();
 assert.equal(submitted[0].task.operation,'Bereiden + storten');
 assert.equal(submitted[0].task.minutes,45);
 find(view,n=>n.type==='input'&&n.props.name==='minutes').props.onChange({target:{value:''}});view=render();
 await submit();
 assert.equal(submitted[1].task.operation,'Bereiden + storten');
 assert.equal(Object.hasOwn(submitted[1].task,'minutes'),false);
});

test('the compact planning form foregrounds product, quantity and day while optional inputs stay mounted in closed details',async()=>{
 const h=harness();let tree=xl(h);
 button(tree,'Inplannen').props.onClick();tree=h.render(h.Component);
 const form=find(tree,node=>typeof node.type==='function'&&!!node.props.onPlan),submitted=[];
 const props={...form.props,onPlan:async command=>{submitted.push(command);}},render=()=>h.render(form.type,props,tree.props.value);
 let view=render(),visible=visibleNodes(view);
 const picker=find(view,node=>node.type===h.pickerWidget);
 assert.equal(picker.props.label,'Wat wil je maken?');assert.equal(picker.props.required,true);
 assert.deepEqual(visible.filter(node=>node.type==='input').map(node=>node.props.type),['number','date']);
 assert(button(view,'Zonder recept toevoegen'));
 picker.props.onChange('fruit');view=render();visible=visibleNodes(view);
 const more=find(view,node=>node.type==='details'&&nodes(node).some(child=>child.type==='summary'&&text(child)==='Meer opties'));
 const parts=find(view,node=>node.type==='details'&&nodes(node).some(child=>child.type==='summary'&&text(child)==='Onderdelen aanpassen'));
 for(const details of [more,parts])assert.equal(details.props.open,undefined,'Optional sections start closed');
 for(const name of ['dueDate','operation','minutes','source','note','output']){
  const field=find(more,node=>node.props?.name===name);
  assert(!visible.includes(field),`${name} is optional and stays outside the initial compact form`);
 }
 assert(visible.some(node=>node.type==='select'&&node.props.value==='quantity'),'The explicit Recept × choice remains available');
 assert(visible.some(node=>node.type==='label'&&text(node)==='Onderdelen meeplannen'));
 const outline=find(view,node=>node.props?.['aria-label']==='Productiestappen Fruitdesserttaart');
 assert(visible.includes(outline));assert(text(outline).includes('Vanillecrème'));assert(text(outline).includes(sample.demoRecipes.find(recipe=>recipe.id==='demo-kapsel').name));assert(text(outline).includes('Fruitdesserttaart afwerken'));
 const preparationDate=find(parts,node=>node.type==='input'&&node.props['aria-label']?.startsWith('Productiedatum '));
 assert(!visible.includes(preparationDate));assert(preparationDate.props.value);
 const primaryDate=find(view,node=>node.type==='label'&&text(node)==='Productiedatum').props.children.find(node=>node?.type==='input');
 assert.equal(primaryDate.props.value,sample.DEMO_TODAY);
 const submit=find(view,node=>node.type==='button'&&node.props.type==='submit');assert.equal(text(submit),'Inplannen');assert.equal(submit.props.disabled,false);
 await find(view,node=>node.type==='form').props.onSubmit({preventDefault:()=>{},currentTarget:{source:'manual',note:'',dueDate:'',output:'on'}});
 assert.equal(submitted[0].task.operation,'Afwerken');assert.equal(submitted[0].task.date,sample.DEMO_TODAY);assert.equal(submitted[0].preparation.daysBefore,1);
 const result=recipePlanning.buildRecipePlan(form.props.state,sample.demoRecipes,submitted[0]);
 assert(result.tasks.some(task=>task.generatedFor===submitted[0].task.id),'The compact outline still schedules actual preparation tasks');
});

test('global planning follows the selected product department while a day-cell plus keeps its chosen day and row',()=>{
 const live={state:sample.initialPreviewState(),today:sample.DEMO_TODAY,recipes:sample.demoRecipes,ingredients:[],canManage:true,departments:planning.DEPARTMENTS.map(department=>department.id),revision:1};
 for(const clicked of [false,true]){
  const h=harness();let tree=xl(h,{live});
  if(clicked)find(tree,node=>node.type==='button'&&node.props['aria-label']==='Taak toevoegen · Luxe gebak · do 29 okt').props.onClick();
  else button(tree,'Inplannen').props.onClick();
  tree=h.render(h.Component,{live});
  const form=find(tree,node=>typeof node.type==='function'&&!!node.props.onPlan),render=()=>h.render(form.type,form.props,tree.props.value);
  let view=render();find(view,node=>node.type===h.pickerWidget).props.onChange('creme');view=render();
  const more=find(view,node=>node.type==='details'&&nodes(node).some(child=>child.type==='summary'&&text(child)==='Meer opties'));
  const department=find(find(more,node=>node.type==='label'&&text(node).startsWith('Afdeling')),node=>node.type==='select');
  assert.equal(department.props.value,clicked?'luxe':live.state.items.find(item=>item.id==='creme').departmentId);
  const date=find(find(view,node=>node.type==='label'&&text(node)==='Productiedatum'),node=>node.type==='input');
  assert.equal(date.props.value,clicked?'2026-10-29':sample.DEMO_TODAY);
 }
});

test('blocked recipes remain selectable and repair actions open the specific linked recipe',()=>{
 const h=harness(),state=sample.initialPreviewState();
 state.items.find(item=>item.id==='creme').productionBlocked=true;
 const live={state,today:sample.DEMO_TODAY,recipes:sample.demoRecipes,ingredients:[],canManage:true,departments:planning.DEPARTMENTS.map(d=>d.id),revision:1};
 let tree=h.render(h.Component,{live});
 button(tree,'Inplannen').props.onClick();tree=h.render(h.Component,{live});
 const form=find(tree,n=>typeof n.type==='function' && !!n.props.onPlan);
 const render=()=>h.render(form.type,form.props,tree.props.value);
 let view=render();
 const picker=find(view,n=>n.type===h.pickerWidget);
 assert.equal(picker.props.items.find(item=>item.id==='creme').productionBlocked,true);
 assert.equal(picker.props.disabled,false);
 picker.props.onChange('fruit');view=render();
 const error=find(view,n=>n.props?.role==='alert');
 assert(text(error).includes('Vanillecrème'));
 assert.equal(find(view,n=>n.props?.type==='submit').props.disabled,true);
 button(error,'Vanillecrème').props.onClick();tree=h.render(h.Component,{live});
 assert(find(tree,n=>n.type===form.type && !!n.props.onPlan));
 assert(find(tree,n=>typeof n.type==='function' && n.props.item?.id==='creme' && !!n.props.getRevision));
});

test('recipe group badges connect each preparation to the root production task',()=>{
 const h=harness(),command={task:{id:'group-root',itemId:'fruit',date:sample.DEMO_TODAY,departmentId:'dessert',operation:'Afmaken',status:'planned',note:'',source:'manual',batchId:'group-batch',recordsOutput:true},amount:12,amountMode:'quantity',preparation:{daysBefore:1,choices:{}}};
 const state=recipePlanning.buildRecipePlan(sample.initialPreviewState(),sample.demoRecipes,command);
 const live={state,today:sample.DEMO_TODAY,recipes:sample.demoRecipes,ingredients:[],canManage:true,departments:planning.DEPARTMENTS.map(d=>d.id),revision:1};
 let tree=xl(h,{live});
 const badges=nodes(tree).filter(n=>n.type==='button' && n.props['aria-label']?.includes('Hoort bij Fruitdesserttaart'));
 const family=state.tasks.filter(task=>task.id==='group-root' || task.generatedFor==='group-root');
 assert.equal(badges.length,family.length);
 assert(badges.some(badge=>text(badge)==='Recept Fruitdesserttaart'));
 assert.equal(badges.filter(badge=>text(badge)==='Voor Fruitdesserttaart').length,family.length-1);
 for(const task of family){
  const card=find(tree,node=>node.type==='article'&&node.key===task.id);
  const metadata=find(card,node=>node.props?.className==='taskMeta');
  const badge=find(metadata,node=>node.type==='button'&&node.props['aria-label']?.includes('Hoort bij Fruitdesserttaart'));
  const open=find(card,node=>node.props?.className==='taskOpen');
  assert(!nodes(open).includes(badge),'The recipe badge follows the task title in metadata instead of overlapping it');
  const step=find(metadata,node=>node.props?.className==='taskStep');assert.equal(step.props.type,'button');assert(step.props['aria-label'].startsWith('Stap '));
 }
 const preparation=state.tasks.find(task=>task.generatedFor==='group-root');
 const card=find(tree,n=>n.type==='article' && n.key===preparation.id);
 find(card,n=>n.type==='button' && n.props['aria-label']?.includes('Hoort bij Fruitdesserttaart')).props.onClick();
 tree=h.render(h.Component,{live});
 assert.equal(find(tree,n=>typeof n.type==='function' && !!n.props.onMove).props.task.id,'group-root');
});

test('complete task names keep wrapping spaces outside the nonbreaking word spans in normal and XL views',()=>{
 const name='Citroen-meringuetaart met gekaramelliseerde Italiaanse hazelnoten';
 function inlineParts(node){
  if(typeof node==='string')return [{space:node}];
  if(!node||typeof node!=='object')return [];
  if(Array.isArray(node))return Array.from(node).flatMap(inlineParts);
  if(node.type==='span'&&node.props['data-fit-word'])return [{word:text(node)}];
  return inlineParts(node.props?.children);
 }
 for(const large of [false,true]){
  const h=harness(),state=sample.initialPreviewState();
  const task=state.tasks.find(task=>task.departmentId==='dessert'&&task.status==='planned');
  const item=state.items.find(item=>item.id===task.itemId);
  item.name=name;item.unit='stuks';task.quantity=42;
  const live={state,today:sample.DEMO_TODAY,recipes:sample.demoRecipes,ingredients:[],canManage:true,departments:['dessert'],revision:1};
  const tree=large?xl(h,{live}):h.render(h.Component,{live});
  const card=find(tree,node=>node.type==='article'&&node.key===task.id);
  const title=find(card,node=>node.type==='strong'&&node.props['data-fit-text']);
  const words=nodes(title).filter(node=>node.type==='span'&&node.props['data-fit-word']);
  assert.deepEqual(words.map(text),['42×',...name.split(' ')]);
  for(const word of words)assert.equal(text(word).trim(),text(word),'A nowrap word span must not contain surrounding whitespace');
  assert.equal(text(title),`42× ${name}`,'The full product name and every normal word separator remain visible');
  const expected=['42×',...name.split(' ')].flatMap((word,index)=>[...(index?[{space:' '}]:[]),{word}]);
  assert.deepEqual(inlineParts(title),expected,'Wrapping opportunities sit between the spans, outside their nowrap boxes');
 }
});

test('warning-only positioning never removes active, blocked or stock metadata from normal task flow',()=>{
 for(const status of ['planned','active','blocked','stock','no-issue']){
  const h=harness(),state=sample.initialPreviewState();
  const task=state.tasks.find(task=>task.departmentId==='dessert'&&task.status==='planned');
  task.status=status==='stock'?'done':status==='no-issue'?'planned':status;
  task.dependsOn=undefined;task.requires=undefined;task.dueDate=status==='no-issue'?undefined:planning.addDays(task.date,-1);
  if(status==='stock')task.stockFulfillmentId='stock-fulfillment';
  const live={state,today:sample.DEMO_TODAY,recipes:sample.demoRecipes,ingredients:[],canManage:true,departments:['dessert'],revision:1};
  const tree=h.render(h.Component,{live}),card=find(tree,node=>node.type==='article'&&node.key===task.id);
  const step=find(card,node=>node.props?.className==='taskStep'),metadata=find(step,node=>node.type==='small');
  assert.equal(metadata.props['data-warning-only'],status==='planned'?true:undefined,status);
  if(['planned','active','blocked'].includes(status))assert(nodes(metadata).some(node=>node.props?.className==='taskWarning'));
  if(status==='active')assert.match(text(metadata),/Bezig/);
  if(status==='blocked')assert.match(text(metadata),/Controleren/);
  if(status==='stock')assert.match(text(metadata),/Uit voorraad/);
  if(status==='no-issue')assert.equal(text(metadata),'');
 }
});

test('the operational recipe list combines parts with token search and excludes financial management for bakers',()=>{
 const h=harness(),live={state:sample.initialPreviewState(),today:sample.DEMO_TODAY,recipes:sample.demoRecipes,ingredients:[],canManage:false,departments:['dessert'],revision:1};
 let tree=h.render(h.Component,{live,initialView:'recipes'});assert(!nodes(tree).some(n=>n.type==='button' && text(n)==='Los onderdeel toevoegen'));assert(!nodes(tree).some(n=>n.props?.href==='/bakkerij/productie/beheer/recepten'));
 const search=find(tree,n=>typeof n.type==='function' && n.props.placeholder?.startsWith('Zoek naam, artikel'));search.props.onChange('fruit des');tree=h.render(h.Component,{live,initialView:'recipes'});
 const rows=nodes(tree).filter(n=>n.props?.className==='workRecipeRow');assert.equal(rows.length,1);assert(text(rows[0]).includes('Fruitdesserttaart'));
});
test('recalculation and the selected week offer remain available in XL with an explicit review step',()=>{
 const h=harness(),source=sample.initialPreviewState(),command={task:{id:'auto',itemId:'fruit',date:sample.DEMO_TODAY,departmentId:'dessert',operation:'Afmaken',status:'planned',note:'',source:'manual',batchId:'batch-auto',recordsOutput:true},amount:12,amountMode:'quantity',preparation:{daysBefore:1,choices:{}}};
 const state=recipePlanning.buildRecipePlan(source,sample.demoRecipes,command),recipes=structuredClone(sample.demoRecipes);recipes.find(r=>r.id==='demo-fruit').semiFinishedItems[0].quantity=24;
 const live={state,today:sample.DEMO_TODAY,recipes,ingredients:[],canManage:true,departments:['dessert'],revision:1,weeklyOffers:[{weekStart:sample.DEMO_WEEK,label:'Testaanbieding',imageUrl:'/test-aanbieding.png'}]};
 let tree=xl(h,{live});assert(find(tree,n=>n.type===h.offerWidget));
 find(tree,n=>n.props?.['aria-label']==='Open 12 stuks Fruitdesserttaart · Afmaken').props.onClick();tree=h.render(h.Component,{live});
 const detail=find(tree,n=>typeof n.type==='function' && !!n.props.onMove),detailTree=h.render(detail.type,detail.props,tree.props.value);assert(text(detailTree).includes('Recept gewijzigd'));
 button(detailTree,'Met actueel recept bijwerken').props.onClick();tree=h.render(h.Component,{live});const form=find(tree,n=>typeof n.type==='function' && !!n.props.onPlan),formTree=h.render(form.type,form.props,tree.props.value);assert.equal(formTree.props.title,'Planning bijwerken');assert(button(formTree,'Planning bijwerken'));assert(find(formTree,n=>typeof n.type==='function' && !!n.props.changes));
});

test('working recipe multiplier accepts decimal commas, scales all ingredients and stays synced with quantity',()=>{
 const h=harness(),state=sample.initialPreviewState();
 const base=sample.demoRecipes[0];
 const recipe={...base,yield:4.804,unit:'kg',ingredients:[{name:'Melk',quantity:1000,unit:'gram'}]};
 const item={...state.items[0],recipeId:recipe.id,unit:'kg'};
 const live={state:{...state,items:[item],tasks:[]},today:sample.DEMO_TODAY,recipes:[recipe],ingredients:[],canManage:false,departments:['dessert'],revision:1};
 let tree=h.render(h.Component,{live,initialView:'recipes'});
 find(tree,n=>n.props?.className==='workRecipeRow').props.onClick();tree=h.render(h.Component,{live,initialView:'recipes'});
 const detail=find(tree,n=>typeof n.type==='function' && n.props.item?.id===item.id && !!n.props.onLink);
 const render=()=>h.render(detail.type,detail.props,tree.props.value);
 const input=(t,label)=>find(t,n=>n.type==='input' && n.props['aria-label']===label);
 const content=t=>find(t,n=>typeof n.type==='function' && n.props.recipeId===recipe.id && 'amount' in n.props);
 let view=render();input(view,'Aantal keer basisrecept').props.onChange({target:{value:'1,5'}});view=render();
 assert.equal(content(view).props.amount,7.206);
 assert.equal(input(view,'Hoeveelheid werkrecept').props.value,'7.206');
 const ingredients=h.render(content(view).type,content(view).props,tree.props.value);assert(text(ingredients).includes('1.500 gram'));
 input(view,'Aantal keer basisrecept').props.onChange({target:{value:'6'}});view=render();assert.equal(content(view).props.amount,28.824);
 input(view,'Hoeveelheid werkrecept').props.onChange({target:{value:'9.608'}});view=render();assert.equal(input(view,'Aantal keer basisrecept').props.value,'2');
 input(view,'Aantal keer basisrecept').props.onChange({target:{value:'0'}});view=render();assert(nodes(view).some(n=>n.props?.role==='status'));assert(!nodes(view).some(n=>n.props?.recipeId===recipe.id && 'amount' in n.props));
 button(view,'1 basisrecept · 4,8 kg').props.onClick();view=render();assert.equal(content(view).props.amount,4.804);assert.equal(input(view,'Aantal keer basisrecept').props.value,'1');
 assert.equal(recipe.yield,4.804);
});


test('disconnected canonical children open their existing recipe while deleted sources are repaired through the parent', () => {
 for (const existing of [true, false]) {
  const h = harness(), state = sample.initialPreviewState();
  const child = state.items.find(item => item.id === 'creme');
  child.id = 'recipe:demo-creme';
  delete child.recipeId;
  const recipes = existing ? sample.demoRecipes : sample.demoRecipes.filter(recipe => recipe.id !== 'demo-creme');
  const live = {state, today:sample.DEMO_TODAY, recipes, ingredients:[], canManage:true, departments:planning.DEPARTMENTS.map(d=>d.id), revision:1};
  let tree = h.render(h.Component, {live});
  button(tree, 'Inplannen').props.onClick();
  tree = h.render(h.Component, {live});
  const form = find(tree, node => typeof node.type === 'function' && !!node.props.onPlan);
  let view = h.render(form.type, form.props, tree.props.value);
  find(view, node => node.type === h.pickerWidget).props.onChange('fruit');
  view = h.render(form.type, form.props, tree.props.value);
  const error = find(view, node => node.props?.role === 'alert');
  if (existing) {
   button(error, 'Vanillecrème').props.onClick();
   tree = h.render(h.Component, {live});
   const editor = find(tree, node => typeof node.type === 'function' && node.props.item?.id === child.id && !!node.props.getRevision);
   assert.equal(editor.props.item.recipeId, 'demo-creme');
   assert.equal(editor.props.item.unit, 'kg');
  } else {
   assert(!nodes(error).some(node => node.type === 'button' && text(node) === 'Vanillecrème'));
   assert(button(error, 'Fruitdesserttaart'));
  }
 }
});

test('a fulfilled stock task is visible as stock use and cannot be reopened from its card', () => {
 const h = harness(), state = sample.initialPreviewState();
 const task = state.tasks.find(task => task.itemId === 'ganache' && task.status === 'planned');
 task.status = 'done';
 task.stockFulfillmentId = 'stock-proof';
 const live = {state, today:sample.DEMO_TODAY, recipes:sample.demoRecipes, ingredients:[], canManage:true, departments:planning.DEPARTMENTS.map(d=>d.id), revision:1};
 const tree = xl(h, {live});
 const card = find(tree, node => node.type === 'article' && node.key === task.id);
 assert(text(card).includes('Uit voorraad'));
 assert.equal(find(card, node => node.type === 'button' && node.props.className === 'taskCheck').props.disabled, true);
});

test('temporary parts can be renamed and linked later without creating an empty recipe or rewriting tasks',async()=>{
 const h=harness();
 let tree=h.render(h.Component,{initialView:'recipes'});
 button(tree,'Los onderdeel toevoegen').props.onClick();tree=h.render(h.Component,{initialView:'recipes'});
 const form=find(tree,n=>typeof n.type==='function'&&!!n.props.onSave&&n.props.state);
 const temporary={id:'temporary-test',name:'Tijdelijk beslag',kind:'component',unit:'kg',departmentId:'dessert',stock:0,note:''};
 const next=planning.addItem(form.props.state,temporary),tasksBefore=JSON.stringify(next.tasks);
 await form.props.onSave(next);tree=h.render(h.Component,{initialView:'recipes'});
 assert.equal(tree.props.value.recipes.length,sample.demoRecipes.length);
 const row=find(tree,n=>n.props?.className==='workRecipeRow'&&text(n).includes('Tijdelijk beslag'));
 assert(text(row).includes('Zonder recept'));
 row.props.onClick();tree=h.render(h.Component,{initialView:'recipes'});
 let detail=find(tree,n=>typeof n.type==='function'&&!!n.props.onLink&&n.props.item.id===temporary.id);
 let view=h.render(detail.type,detail.props,tree.props.value);
 assert(button(view,'Nieuw recept maken'));
 assert(find(view,n=>n.type==='input'&&n.props.name==='name'));
 const picker=find(view,n=>typeof n.type==='function'&&n.props.label==='Bestaand recept koppelen');
 assert(picker.props.choices.length);assert(picker.props.choices.every(choice=>sample.demoRecipes.some(recipe=>recipe.id===choice.id&&recipe.unit==='kg')));
 assert(await detail.props.onUpdate({name:'  Fruitdesserttaart  '}));
 assert.equal(await detail.props.onUpdate({name:'  Tijdelijke mousse  ',departmentId:'dessert',note:'Later uitwerken'}),undefined);
 tree=h.render(h.Component,{initialView:'recipes'});detail=find(tree,n=>typeof n.type==='function'&&!!n.props.onLink&&n.props.item.id===temporary.id);
 assert.equal(detail.props.item.name,'Tijdelijke mousse');assert.equal(detail.props.item.recipeId,undefined);
 assert.equal(JSON.stringify(detail.props.state.tasks),tasksBefore);
 assert.equal(await detail.props.onLink(picker.props.choices[0].id),undefined);
 tree=h.render(h.Component,{initialView:'recipes'});detail=find(tree,n=>typeof n.type==='function'&&!!n.props.onLink&&n.props.item.id===temporary.id);
 assert.equal(detail.props.item.recipeId,picker.props.choices[0].id);
 assert.equal(JSON.stringify(detail.props.state.tasks),tasksBefore);
 view=h.render(detail.type,detail.props,tree.props.value);
 assert(button(view,'Recept aanpassen'));assert(!nodes(view).some(n=>n.type==='input'&&n.props.name==='name'));
});

test('a recipe-free planning task opens its name, recipe link and explicit creation controls',()=>{
 const h=harness(),state=sample.initialPreviewState(),task=state.tasks.find(task=>task.status==='planned');
 const item=state.items.find(item=>item.id===task.itemId);delete item.recipeId;
 const live={state,today:sample.DEMO_TODAY,recipes:sample.demoRecipes,ingredients:[],canManage:true,departments:planning.DEPARTMENTS.map(d=>d.id),revision:1};
 let tree=h.render(h.Component,{live,initialTask:task.id});
 const detail=find(tree,n=>typeof n.type==='function'&&n.props.task?.id===task.id&&!!n.props.onItem);
 const view=h.render(detail.type,detail.props,tree.props.value);
 button(view,'Naam of recept koppelen').props.onClick();tree=h.render(h.Component,{live,initialTask:task.id});
 const part=find(tree,n=>typeof n.type==='function'&&!!n.props.onLink&&n.props.item.id===item.id);
 assert.equal(part.props.item.id,task.itemId);
});
