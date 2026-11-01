const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function harness({width=1920,height=1080,contentHeight=1600,contentWidth=0,enabled=true,top=0}={}){
 let currentHeight=contentHeight,currentWidth=width,cleanup,mutation,resize,frameId=0;const frames=new Map(),events=new Map();
 const style=()=>({setProperty(key,value){this[key]=value;},removeProperty(key){delete this[key];}});
 const root={style:style(),getBoundingClientRect:()=>({top})};
 const viewport={style:style(),parentElement:root,get clientWidth(){return currentWidth;},getBoundingClientRect:()=>({top})};
 const canvas={style:style(),dataset:{},get scrollHeight(){const density=this.dataset.screenDensity;return currentHeight*(density==='dense'?.6:density==='compact'?.8:1);},get scrollWidth(){return Math.max(contentWidth,(currentWidth-20)*((parseFloat(this.style.width)||100)/100));},addEventListener:(name,fn)=>events.set(`canvas:${name}`,fn),removeEventListener:(name)=>events.delete(`canvas:${name}`)};
 let ref=0;const react={useRef:()=>({current:ref++===0?viewport:canvas}),useLayoutEffect:fn=>{cleanup=fn();}};
 const window={innerWidth:width,innerHeight:height,visualViewport:{offsetTop:0,height,addEventListener:(name,fn)=>events.set(`visual:${name}`,fn),removeEventListener:name=>events.delete(`visual:${name}`)},scrollTo(){},addEventListener:(name,fn)=>events.set(name,fn),removeEventListener:name=>events.delete(name)};
 const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('app/productie/usePlanningScreenFit.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:()=>react,window,document:{fonts:{addEventListener:(name,fn)=>events.set(`fonts:${name}`,fn),removeEventListener:name=>events.delete(`fonts:${name}`),ready:{then(){}}}},getComputedStyle:()=>({paddingLeft:'10px',paddingRight:'10px'}),MutationObserver:class{constructor(fn){mutation=fn;}observe(){}disconnect(){mutation=null;}},ResizeObserver:class{constructor(fn){resize=fn;}observe(){}disconnect(){resize=null;}},requestAnimationFrame:fn=>{frames.set(++frameId,fn);return frameId;},cancelAnimationFrame:id=>frames.delete(id)});
 exports.default(enabled);
 const flush=()=>{for(const [id,fn]of [...frames]){frames.delete(id);fn();}};
 return {canvas,viewport,root,events,get scale(){return Number(canvas.style['--screen-fit-scale']||1);},height,top,flush,changeContent(next){currentHeight=next;mutation?.();flush();},resize(nextWidth,nextHeight){currentWidth=nextWidth;window.innerWidth=nextWidth;window.innerHeight=nextHeight;window.visualViewport.height=nextHeight;resize?.();flush();},close:()=>cleanup?.(),get pending(){return frames.size;}};
}
test('65-inch Full HD and 4K layouts fit every rendered card within the actual available viewport',()=>{
 for(const [width,height]of [[1920,1080],[3840,2160]])for(const contentHeight of [500,1400,4200,12000]){
  const h=harness({width,height,contentHeight,top:28});assert(h.scale>0&&h.scale<=1);assert(h.canvas.scrollHeight*h.scale<=height-28);assert(h.canvas.scrollWidth*h.scale<=width-19);assert.equal(parseFloat(h.viewport.style.height),height-32);h.close();
 }
});
test('density increases before shrinking, and late-loaded requests/tasks trigger fitting again without dropping content',()=>{
 const h=harness({contentHeight:700});assert.equal(h.canvas.dataset.screenDensity,'comfortable');assert.equal(h.scale,1);
 h.changeContent(1300);assert.equal(h.canvas.dataset.screenDensity,'compact');
 h.changeContent(4000);assert.equal(h.canvas.dataset.screenDensity,'dense');assert(h.scale<1);assert(h.canvas.scrollHeight*h.scale<=1080);
 h.changeContent(600);assert.equal(h.scale,1);assert.equal(h.canvas.dataset.screenDensity,'comfortable');h.close();
});
test('screen resizing, font loading and image loading refit; leaving XL restores normal layout and disconnects everything',()=>{
 const h=harness({contentHeight:2400});h.resize(3840,2160);assert(h.canvas.scrollHeight*h.scale<=2160);
 h.events.get('fonts:loadingdone')();h.events.get('canvas:load')();assert.equal(h.pending,1);h.flush();h.close();assert.equal(h.canvas.style.transform,'');assert.equal(h.canvas.style.width,'');assert.equal(h.canvas.dataset.screenDensity,undefined);assert.equal(h.viewport.style.height,'');assert.equal(h.root.style.height,'');assert.equal(h.events.size,0);assert.equal(h.pending,0);
});
test('ordinary planning and mobile views retain their original layout',()=>{
 const disabled=harness({enabled:false});assert.equal(disabled.canvas.style.transform,undefined);
 const mobile=harness({width:700});assert.equal(mobile.canvas.style.transform,'');mobile.resize(1920,1080);assert(mobile.canvas.style.transform.startsWith('scale('));mobile.resize(700,900);assert.equal(mobile.canvas.style.transform,'');mobile.close();
});
