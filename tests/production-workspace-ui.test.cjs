const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const jsx=require('react/jsx-runtime');
function load(file,imports={}) {
 const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,{exports,require:name=>{assert(name in imports,`Unmocked ${name}`);return imports[name];},Date,Intl,Error,Map,Set,structuredClone,crypto:require('node:crypto').webcrypto});return exports;
}
const planning=load('app/productie/planning.ts');
const sample=load('app/preview/productie/sampleData.ts',{'../../productie/planning':planning});
const recipePlanning=load('app/productie/recipePlanning.ts',{'./planning':planning});
const recipeGrouping=load('app/productie/recipeGroups.ts');
const productionWork=load('app/productie/productionWork.ts',{'./planning':planning,'./recipePlanning':recipePlanning}),workCommands=load('app/productie/workCommands.ts',{'./productionWork':productionWork});
function harness() {
 // Exercise the component's real handlers and render state without a browser,
 // network, effects or live data. Each component retains its own hook storage.
 const records=new Map();let current,index,context;
 const slot=initial=>{const i=index++;if(!(i in current))current[i]=typeof initial==='function'?initial():initial;return i;};
 const react={createContext:value=>({Provider:'workspace-provider',defaultValue:value}),useContext:c=>context || c.defaultValue,useEffect:()=>{},useMemo:fn=>fn(),useRef:value=>current[slot(()=>({current:value}))],useState:initial=>{const i=slot(initial),store=current;return[store[i],next=>{store[i]=typeof next==='function'?next(store[i]):next;}];}};
 const navigation={__esModule:true,default:function Navigation(){},ProductionMobileNavigation:function MobileNavigation(){}};
 const offerWidget={__esModule:true,default:function ProductionWeekOffer(){}};
 const pickerWidget={__esModule:true,default:function ProductionItemPicker(){}};
 const component=load('app/preview/productie/ProductionPreview.tsx',{'react':react,'react/jsx-runtime':jsx,'next/link':'a','../../productie/ProductionIcon':{__esModule:true,default:()=>null},'../../productie/ProductionNavigation':navigation,'../../productie/navigation':load('app/productie/navigation.ts',{'./planning':planning}),'../../productie/dayRhythm':load('app/productie/dayRhythm.ts',{'./planning':planning}),'next/dynamic':()=>()=>null,'../../productie/WeddingWeekLane':{__esModule:true,default:()=>null},'../../productie/useProductionUpdates':{__esModule:true,default:()=>false},'../../productie/productionUpdates':{},'../../productie/useScreenLayout':{__esModule:true,default:()=>({frameRef:{current:null},workspaceRef:{current:null}})},'../../productie/TaskWorkPanel':{__esModule:true,default:function TaskWorkPanel(){},WorkClock:function WorkClock(){},PreparationControl:function PreparationControl(){},RecipeWorkHistory:function RecipeWorkHistory(){}},'../../productie/workCommands':workCommands,'../../productie/QuickRecipeForm':{__esModule:true,default:()=>null},'../../productie/ProductionRequests':{__esModule:true,default:()=>null},'../../productie/ProductionWeekOffer':offerWidget,'../../productie/ProductionItemPicker':pickerWidget,'../../productie/recipeGroups':recipeGrouping,'../../productie/CleaningWeekLane':{__esModule:true,default:()=>null},'../../productie/weddingPlanning':{},'../../productie/planning':planning,'./sampleData':sample,'./production.module.css':{__esModule:true,default:new Proxy({},{get:(_,key)=>key})},'../../productie/workspaceData':{},'../../productie/recipePlanning':recipePlanning});
 const render=(fn,props={},value)=>{if(!records.has(fn))records.set(fn,[]);current=records.get(fn);index=0;context=value;return fn(props);};
 return{render,Component:component.default,navigation,offerWidget:offerWidget.default,pickerWidget:pickerWidget.default};
}
function nodes(tree) {if(!tree || typeof tree!=='object')return[];if(Array.isArray(tree))return tree.flatMap(nodes);return[tree,...nodes(tree.props?.children)];}
function text(tree){if(typeof tree==='string' || typeof tree==='number')return String(tree);if(Array.isArray(tree))return tree.map(text).join('');return tree?.props?text(tree.props.children):'';}
function find(tree,predicate){const node=nodes(tree).find(predicate);assert(node,'Expected rendered control');return node;}
function button(tree,label){return find(tree,n=>n.type==='button' && (text(n)===label || n.props['aria-label']===label));}
function xl(h,props={}) {let tree=h.render(h.Component,props);button(tree,'XL weergave').props.onClick();return h.render(h.Component,props);}

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
 const field=(view,label,type)=>find(find(view,n=>n.type==='label' && text(n).startsWith(label)),n=>n.type===type);
 let view=render();
 const picker=find(view,n=>n.type===h.pickerWidget);
 assert(picker.props.items.some(item=>item.id==='fruit' && item.searchValues.includes('Vers fruit')));
 picker.props.onChange('fruit');
 view=render();
 assert.equal(field(view,'Afdeling','select').props.value,'luxe');
 field(view,'Aantal (','input').props.onChange({target:{value:'100'}});
 field(view,'Productiedatum','input').props.onChange({target:{value:'2026-11-05'}});
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
 assert.equal(new Set(badges.map(text)).size,1);
 const preparation=state.tasks.find(task=>task.generatedFor==='group-root');
 const card=find(tree,n=>n.type==='article' && n.key===preparation.id);
 find(card,n=>n.type==='button' && n.props['aria-label']?.includes('Hoort bij Fruitdesserttaart')).props.onClick();
 tree=h.render(h.Component,{live});
 assert.equal(find(tree,n=>typeof n.type==='function' && !!n.props.onMove).props.task.id,'group-root');
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
