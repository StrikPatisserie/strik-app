const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const jsx=require('react/jsx-runtime');
function load(file,imports={}) {
 const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,{exports,require:name=>{assert(name in imports,`Unmocked ${name}`);return imports[name];},Date,Intl,Error,Map,Set,structuredClone,crypto:require('node:crypto').webcrypto});return exports;
}
const planning=load('app/productie/planning.ts');
const sample=load('app/preview/productie/sampleData.ts',{'../../productie/planning':planning});
const recipePlanning=load('app/productie/recipePlanning.ts',{'./planning':planning});
function harness() {
 // Exercise the component's real handlers and render state without a browser,
 // network, effects or live data. Each component retains its own hook storage.
 const records=new Map();let current,index,context;
 const slot=initial=>{const i=index++;if(!(i in current))current[i]=typeof initial==='function'?initial():initial;return i;};
 const react={createContext:value=>({Provider:'workspace-provider',defaultValue:value}),useContext:c=>context || c.defaultValue,useEffect:()=>{},useMemo:fn=>fn(),useRef:value=>current[slot(()=>({current:value}))],useState:initial=>{const i=slot(initial),store=current;return[store[i],next=>{store[i]=typeof next==='function'?next(store[i]):next;}];}};
 const navigation={__esModule:true,default:function Navigation(){},ProductionMobileNavigation:function MobileNavigation(){}};
 const component=load('app/preview/productie/ProductionPreview.tsx',{'react':react,'react/jsx-runtime':jsx,'next/link':'a','../../productie/ProductionIcon':{__esModule:true,default:()=>null},'../../productie/ProductionNavigation':navigation,'../../productie/navigation':load('app/productie/navigation.ts',{'./planning':planning}),'../../productie/dayRhythm':load('app/productie/dayRhythm.ts',{'./planning':planning}),'../../productie/planning':planning,'./sampleData':sample,'./production.module.css':{__esModule:true,default:new Proxy({},{get:(_,key)=>key})},'../../productie/workspaceData':{},'../../productie/recipePlanning':recipePlanning});
 const render=(fn,props={},value)=>{if(!records.has(fn))records.set(fn,[]);current=records.get(fn);index=0;context=value;return fn(props);};
 return{render,Component:component.default,navigation};
}
function nodes(tree) {if(!tree || typeof tree!=='object')return[];if(Array.isArray(tree))return tree.flatMap(nodes);return[tree,...nodes(tree.props?.children)];}
function text(tree){if(typeof tree==='string' || typeof tree==='number')return String(tree);if(Array.isArray(tree))return tree.map(text).join('');return tree?.props?text(tree.props.children):'';}
function find(tree,predicate){const node=nodes(tree).find(predicate);assert(node,'Expected rendered control');return node;}
function button(tree,label){return find(tree,n=>n.type==='button' && text(n)===label);}
function xl(h,props={}) {let tree=h.render(h.Component,props);button(tree,'XL-scherm').props.onClick();return h.render(h.Component,props);}

test('XL keeps planning controls, drag/drop and task editing while hiding the navigation',async()=>{
 const h=harness();let tree=xl(h);
 assert(!nodes(tree).some(n=>n.type===h.navigation.default));
 assert(button(tree,'Taak toevoegen'));assert(find(tree,n=>n.type==='select' && text(n).includes('Nog te doen')));
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
 for(const label of ['Gepland','Bezig','Klaar','Geblokkeerd','Verplaatsen','Geplande taak verwijderen'])assert(button(detailTree,label));
 assert(find(detailTree,n=>n.type==='summary' && text(n).includes('volgende stap')));
 await button(detailTree,'Bezig').props.onClick();tree=h.render(h.Component);
 assert.equal(find(tree,n=>typeof n.type==='function' && !!n.props.onMove).props.task.status,'active');
});

test('XL does not grant planning or deletion permissions to a production employee',()=>{
 const h=harness(),live={state:sample.initialPreviewState(),today:sample.DEMO_TODAY,recipes:sample.demoRecipes,ingredients:[],canManage:false,departments:['dessert'],revision:1};
 let tree=xl(h,{live});assert(!nodes(tree).some(n=>n.type==='article' && n.props.draggable));assert(!nodes(tree).some(n=>n.type==='button' && text(n)==='Taak toevoegen'));
 find(tree,n=>n.props?.className==='taskOpen').props.onClick();tree=h.render(h.Component,{live});
 const detail=find(tree,n=>typeof n.type==='function' && !!n.props.onMove),detailTree=h.render(detail.type,detail.props,tree.props.value);
 assert(button(detailTree,'Bezig'));assert(!nodes(detailTree).some(n=>n.type==='form' || n.props?.className==='deleteButton'));
});

test('a late preparation can be repaired or cancelled in XL and its input never disappears',async()=>{
 const h=harness();let tree=xl(h);button(tree,'Taak toevoegen').props.onClick();tree=h.render(h.Component);
 const form=find(tree,n=>typeof n.type==='function' && !!n.props.onPlan),render=()=>h.render(form.type,form.props,tree.props.value);
 let formTree=render();const select=find(formTree,n=>n.type==='select' && nodes(n).some(c=>c.type==='optgroup'));
 select.props.onChange({target:{value:'fruit'}});formTree=render();
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
