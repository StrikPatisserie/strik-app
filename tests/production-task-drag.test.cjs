const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');

function harness({enabled=true,scale=1,scrollable=false}={}){
 const slots=[],frames=new Map(),windowListeners=new Map(),timers=new Map(),moves=[],changes=[];
 let cursor=0,nextId=0,pointTarget;
 const same=(before,after)=>before&&after&&before.length===after.length&&before.every((value,index)=>value===after[index]);
 const hooks={
  useRef(value){const index=cursor++;return slots[index]??=( {current:value});},
  useCallback(callback,deps){const index=cursor++;if(!same(slots[index]?.deps,deps))slots[index]={deps,callback};return slots[index].callback;},
  useEffect(callback,deps){const index=cursor++;if(!same(slots[index]?.deps,deps)){slots[index]?.cleanup?.();slots[index]={deps,cleanup:callback()};}},
  useLayoutEffect(callback){cursor++;callback();},
 };
 function element(parent=null,dataset={},rect={left:0,top:0,right:300,bottom:100}){
  const children=[],listeners=new Map(),attributes=new Map();let scrollTop=0,scrollLeft=0;
  const node={parentElement:parent,dataset:{...dataset},style:{setProperty(name,value){this[name]=value;}},children,
   offsetWidth:300,offsetHeight:100,clientWidth:300,clientHeight:100,scrollWidth:300,scrollHeight:100,
   get scrollTop(){return scrollTop;},set scrollTop(value){scrollTop=Math.max(0,Math.min(value,this.scrollHeight-this.clientHeight));},
   get scrollLeft(){return scrollLeft;},set scrollLeft(value){scrollLeft=Math.max(0,Math.min(value,this.scrollWidth-this.clientWidth));},
   getBoundingClientRect:()=>({...rect,width:rect.right-rect.left,height:rect.bottom-rect.top}),
   contains(other){return other===this||children.some(child=>child.contains(other));},
   closest(selector){if(selector==='[data-task-id]'&&this.dataset.taskId)return this;if(selector==='[data-task-date]'&&this.dataset.taskDate)return this;return this.parentElement?.closest(selector)||null;},
   querySelectorAll(){return children.flatMap(child=>[child,...child.querySelectorAll()]);},
   cloneNode(){const clone=element(null,this.dataset,rect);clone.offsetWidth=this.offsetWidth;clone.offsetHeight=this.offsetHeight;for(const child of children)clone.appendChild(child.cloneNode(true));return clone;},
   appendChild(child){child.parentElement=this;children.push(child);return child;},
   remove(){const index=this.parentElement?.children.indexOf(this);if(index>=0)this.parentElement.children.splice(index,1);this.parentElement=null;},
   setAttribute(name,value){attributes.set(name,value);},removeAttribute(name){attributes.delete(name);},getAttribute:name=>attributes.get(name)??null,
   setPointerCapture(id){this.captured=id;},hasPointerCapture(id){return this.captured===id;},releasePointerCapture(){this.captured=null;},
   addEventListener:(name,callback)=>listeners.set(name,callback),removeEventListener:name=>listeners.delete(name),
   fire:(name,event)=>listeners.get(name)?.(event),
  };
  if(parent)parent.appendChild(node);
  return node;
 }
 const html=element(null,{}, {left:0,top:0,right:1000,bottom:800});
 const body=element(html),frame=element(body,{}, {left:0,top:0,right:1000,bottom:800});
 frame.clientWidth=1000;frame.clientHeight=800;frame.scrollWidth=1000;frame.scrollHeight=scrollable?1600:800;frame.overflowY=scrollable?'auto':'visible';
 const origin=element(frame,{taskDate:'2026-11-10',taskDepartment:'dessert'});
 const destination=element(frame,{taskDate:'2026-11-11',taskDepartment:'luxe'}, {left:300,top:0,right:600,bottom:800});
 const card=element(origin,{taskId:'task-1',taskDepartment:'dessert'}, {left:30,top:50,right:30+300*scale,bottom:50+100*scale});
 const dateTab=element(frame,{taskDate:'2026-11-12'});
 const handle=element(card);pointTarget=destination;
 const window={innerWidth:1000,innerHeight:800,
  addEventListener(name,callback,options){const values=windowListeners.get(name)||[];values.push({callback,capture:options===true});windowListeners.set(name,values);},
  removeEventListener(name,callback){const values=(windowListeners.get(name)||[]).filter(value=>value.callback!==callback);if(values.length)windowListeners.set(name,values);else windowListeners.delete(name);},
  setTimeout(callback){timers.set(++nextId,callback);return nextId;},clearTimeout:id=>timers.delete(id),
 };
 const exports={};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync('app/productie/useTaskDrag.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{
  exports,require:()=>hooks,window,document:{body,scrollingElement:html,elementFromPoint:()=>pointTarget},
  getComputedStyle:node=>({length:0,overflowY:node.overflowY||'visible',overflowX:'visible'}),
  requestAnimationFrame:callback=>{frames.set(++nextId,callback);return nextId;},cancelAnimationFrame:id=>frames.delete(id),
 });
 let options={frameRef:{current:frame},enabled,onMove:(...args)=>moves.push(args),onDragChange:value=>changes.push(value)},api;
 function render(changes={}){options={...options,...changes};cursor=0;api=exports.default(options);return api;}
 render();
 function event(changes={}){return {pointerId:1,pointerType:'touch',button:0,isPrimary:true,detail:1,nativeEvent:{pointerId:1},clientX:55,clientY:70,currentTarget:handle,preventDefault(){this.prevented=true;},stopPropagation(){this.stopped=true;},...changes};}
 function fire(name,changes={}){const value=event(changes);if(Object.hasOwn(changes,'pointerId')&&changes.pointerId===undefined)delete value.pointerId;for(const listener of [...(windowListeners.get(name)||[])])listener.callback(value);return value;}
 return {frame,body,origin,destination,dateTab,card,handle,moves,changes,render,event,fire,
  start:changes=>api.getHandleProps('task-1').onPointerDown(event(changes)),
  move:changes=>fire('pointermove',changes),end:changes=>fire('pointerup',changes),
  flush(){for(const [id,callback]of [...frames]){frames.delete(id);callback();}},
  target(value){pointTarget=value;},
  get ghost(){return body.children.find(child=>'taskDragGhost' in child.dataset);},
  get pending(){return frames.size;},get listenerCount(){return [...windowListeners.values()].reduce((count,values)=>count+values.length,0);},
  click:(changes={})=>{const value=event(changes);api.getHandleProps('task-1').onClick(value);return value;},
  expireClicks(){for(const callback of [...timers.values()])callback();},
  close(){for(const slot of slots)slot?.cleanup?.();},
 };
}

test('a touch handle responds immediately, a tap does not move a task and tap/keyboard clicks remain available',()=>{
 const h=harness();
 h.start({pointerType:'mouse'});assert.equal(h.handle.dataset.taskDragPressed,undefined);assert.equal(h.listenerCount,0);
 h.start();assert.equal(h.handle.dataset.taskDragPressed,'true');assert.equal(h.handle.captured,1);assert.equal(h.ghost,undefined);
 h.move({clientX:58,clientY:72});assert.equal(h.pending,0);
 h.end();assert.equal(h.moves.length,0);assert.equal(h.listenerCount,0);assert.equal(h.handle.captured,null);
 assert.equal(h.handle.dataset.taskDragPressed,undefined);assert.equal(h.card.dataset.taskDragging,undefined);
 assert(!h.click().prevented);assert(!h.click({detail:0}).prevented);h.close();
});

test('dragging uses one animation frame, a body ghost and the final drop target without React updates per move',()=>{
 const h=harness({scale:.5});h.start();
 h.move({clientX:340,clientY:160});h.move({clientX:350,clientY:170});
 assert.equal(h.pending,1);assert.deepEqual(h.changes,['task-1']);assert(h.ghost);assert(!h.frame.contains(h.ghost));
 assert.equal(h.ghost.getAttribute('aria-hidden'),'true');assert.equal(h.ghost.getAttribute('inert'),'');
 for(const node of [h.ghost,...h.ghost.querySelectorAll()])assert.equal(node.style.pointerEvents,'none');
 h.flush();assert.match(h.ghost.style.transform,/translate3d\(325px,150px,0\) scale\(0.5\)/);
 assert.equal(h.destination.dataset.taskDragOver,'true');assert.equal(h.card.dataset.taskDragging,'true');
 h.end({clientX:351,clientY:171});
 assert.deepEqual(h.moves,[['task-1','2026-11-11','luxe']]);assert.deepEqual(h.changes,['task-1',null]);
 assert.equal(h.ghost,undefined);assert.equal(h.destination.dataset.taskDragOver,undefined);assert.equal(h.pending,0);
 const nextTouch=h.fire('click',{pointerId:2});assert(!nextTouch.prevented);
 assert(!h.click({detail:0}).prevented,'Keyboard activation remains available after a drag');
 assert(!h.click({nativeEvent:{pointerId:2}}).prevented,'A different touch keeps its ordinary click');
 const click=h.fire('click');assert(click.prevented&&click.stopped);assert.equal(h.listenerCount,0);h.close();
});

test('date-only mobile tabs retain the task department and use the card department ahead of its original cell',()=>{
 const h=harness();h.card.dataset.taskDepartment='ijs';h.start();h.move({clientX:350});h.target(h.dateTab);h.flush();
 assert.equal(h.dateTab.dataset.taskDragOver,'true');h.end({clientX:350});
 assert.deepEqual(h.moves,[['task-1','2026-11-12','ijs']]);h.close();
 const fallback=harness();delete fallback.card.dataset.taskDepartment;fallback.start();fallback.move({clientX:350});fallback.target(fallback.dateTab);fallback.end({clientX:350});
 assert.deepEqual(fallback.moves,[['task-1','2026-11-12','dessert']]);fallback.close();
});

test('a new pointer gesture clears click suppression before a legacy Safari MouseEvent without a pointer ID',()=>{
 const original=harness();original.start();original.move({clientX:350});original.end({clientX:350});
 const compatibilityClick=original.fire('click',{pointerId:undefined});
 assert(compatibilityClick.prevented,'The compatibility click from the completed drag is suppressed');
 assert.equal(original.listenerCount,0);original.close();
 const next=harness();next.start();next.move({clientX:350});next.end({clientX:350});
 next.fire('pointerdown',{pointerId:2});
 assert.equal(next.listenerCount,0,'A new gesture removes both pending capture listeners');
 const ordinaryClick=next.fire('click',{pointerId:undefined});assert(!ordinaryClick.prevented);
 assert(!next.click({nativeEvent:{}}).prevented);next.close();
});

test('the global compatibility-click guard lets keyboard activation through in older Safari',()=>{
 const h=harness();h.start();h.move({clientX:350});h.end({clientX:350});
 const keyboardClick=h.fire('click',{pointerId:undefined,detail:0});
 assert(!keyboardClick.prevented);assert(!keyboardClick.stopped);
 const compatibilityClick=h.fire('click',{pointerId:undefined,detail:1});
 assert(compatibilityClick.prevented,'Allowing Enter must not release the pending compatibility-click guard');
 assert.equal(h.listenerCount,0);h.close();
});

test('production, bridal and cleaning drags only highlight and enter their own lane while mobile day tabs accept each kind',()=>{
 const kinds=['production','wedding','cleaning'];
 for(const kind of kinds){
  const own=harness();own.card.dataset.taskDragKind=kind;own.destination.dataset.taskDragKind=kind;
  own.start();own.move({clientX:350});own.flush();assert.equal(own.destination.dataset.taskDragOver,'true');
  own.end({clientX:350});assert.equal(own.moves.length,1);own.close();
  for(const foreignKind of kinds.filter(candidate=>candidate!==kind)){
   const foreign=harness();
   if(kind!=='production')foreign.card.dataset.taskDragKind=kind;
   foreign.destination.dataset.taskDragKind=foreignKind;
   foreign.start();foreign.move({clientX:350});foreign.flush();
   assert.equal(foreign.destination.dataset.taskDragOver,undefined);
   foreign.end({clientX:350});assert.equal(foreign.moves.length,0);foreign.close();
  }
  const mobile=harness();mobile.card.dataset.taskDragKind=kind;mobile.target(mobile.dateTab);
  mobile.start();mobile.move({clientX:350});mobile.flush();assert.equal(mobile.dateTab.dataset.taskDragOver,'true');
  mobile.end({clientX:350});assert.deepEqual(mobile.moves,[['task-1','2026-11-12','dessert']]);mobile.close();
 }
});

test('final hit testing avoids stale destinations, ignores outside targets and skips the original cell',()=>{
 for(const target of ['outside','origin']){
  const h=harness();h.start();h.move({clientX:350});h.flush();
  h.target(target==='origin'?h.origin:null);h.end({clientX:350});assert.equal(h.moves.length,0);
  h.expireClicks();assert.equal(h.listenerCount,0);h.close();
 }
 const h=harness();h.start();h.move({clientX:350});h.flush();
 h.target(h.origin);h.move({clientX:100});h.flush();assert.equal(h.destination.dataset.taskDragOver,undefined);
 assert.equal(h.origin.dataset.taskDragOver,'true');h.end({clientX:100});assert.equal(h.moves.length,0);h.close();
});

test('cancel, escape, secondary touches, lost capture, permission changes and unmount clean up without a move',()=>{
 for(const cancel of [h=>h.fire('pointercancel'),h=>h.fire('keydown',{key:'Escape'}),h=>h.fire('pointerdown',{pointerId:2,isPrimary:false}),h=>h.handle.fire('lostpointercapture',{pointerId:1}),h=>h.fire('blur'),h=>h.render({enabled:false}),h=>{h.card.remove();h.end();},h=>h.close()]){
  const h=harness();h.start();h.move({clientX:350});h.flush();cancel(h);
  assert.equal(h.moves.length,0);assert.equal(h.ghost,undefined);assert.equal(h.listenerCount,0);assert.equal(h.pending,0);
  assert.equal(h.handle.dataset.taskDragPressed,undefined);assert.equal(h.destination.dataset.taskDragOver,undefined);
  assert.deepEqual(h.changes,['task-1',null]);h.close();
 }
 const disabled=harness({enabled:false});disabled.start();assert.equal(disabled.listenerCount,0);disabled.close();
});

test('only overflowing containers scroll near an edge, and cancelling stops their animation',()=>{
 const h=harness({scrollable:true});h.start();h.move({clientX:350,clientY:790});h.flush();
 assert(h.frame.scrollTop>0);assert.equal(h.pending,1);
 h.move({clientX:350,clientY:400});h.flush();assert.equal(h.pending,0);
 h.move({clientX:350,clientY:790});h.flush();h.fire('pointercancel');assert.equal(h.pending,0);h.close();
 const fitted=harness();fitted.start();fitted.move({clientX:350,clientY:790});fitted.flush();
 assert.equal(fitted.frame.scrollTop,0);assert.equal(fitted.pending,0);fitted.close();
});

test('an overflowing frame scrolls toward mobile day tabs even when no drop cell is under the finger',()=>{
 const h=harness({scrollable:true});h.frame.scrollTop=200;h.target(null);
 h.start();h.move({clientX:350,clientY:10});h.flush();
 assert(h.frame.scrollTop<200);assert.equal(h.pending,1);
 assert.equal(h.destination.dataset.taskDragOver,undefined);
 h.end({clientX:350,clientY:10});
 assert.equal(h.moves.length,0,'Scrolling through a header must not create an outside-target drop');
 assert.equal(h.pending,0);h.close();
});
