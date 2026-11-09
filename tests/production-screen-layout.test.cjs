const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');

function harness({width=1920,height=1080,contentHeight=1800,xl=false,wordWidth=320,labelWidth=150,paddingLeft=0,paddingRight=0,reflow=false,pixelRatio=1}={}){
 const frames=new Map(),events=new Map(),observed=[];
 const metrics={wordReads:0,fontReads:0,heightReads:0,widthReads:0,styleWrites:0};
 let cleanup,mutation,resize,id=0,currentHeight=contentHeight,currentWordWidth=wordWidth;
 const style=()=>new Proxy({setProperty(k,v){this[k]=v;},removeProperty(k){delete this[k];}}, {set(target,key,value){if(target[key]!==value)metrics.styleWrites++;target[key]=value;return true;}});
 const label={style:style(),clientWidth:labelWidth,textContent:'50× Chocoladeganache',isConnected:true,
  querySelectorAll:selector=>selector==='[data-fit-text]'?[]:[{get offsetWidth(){metrics.wordReads++;return currentWordWidth*(parseFloat(label.style.fontSize)||15)/15;},getBoundingClientRect:()=>({width:currentWordWidth*(parseFloat(label.style.fontSize)||15)/15*Number(workspace.style['--screen-fit-scale']||1)})}],
  closest:selector=>selector==='[data-fit-text]'?label:null};
 const workspace={style:style(),dataset:{},closest:()=>null,querySelectorAll:()=>[label],
  get scrollHeight(){metrics.heightReads++;const lines=reflow?.5+.5*Math.min(1,width/(parseFloat(this.style.width)||width)):1;return currentHeight*lines*(this.dataset.screenDensity==='dense'?.65:this.dataset.screenDensity==='compact'?.85:1);},
  get scrollWidth(){metrics.widthReads++;return parseFloat(this.style.width)||width;},
  addEventListener:(name,fn)=>events.set(`content:${name}`,fn),removeEventListener:name=>events.delete(`content:${name}`)};
 const frame={style:style(),clientWidth:width,getBoundingClientRect:()=>({top:0})};
 let ref=0;const react={useRef:initial=>({current:ref++===0?frame:ref===2?workspace:initial}),useLayoutEffect:fn=>{cleanup=fn();}};
 const window={innerWidth:width,outerWidth:width,innerHeight:height,devicePixelRatio:pixelRatio,
  visualViewport:{scale:1,offsetTop:0,height,addEventListener:(n,fn)=>events.set(`visual:${n}`,fn),removeEventListener:n=>events.delete(`visual:${n}`)},
  addEventListener:(n,fn)=>events.set(n,fn),removeEventListener:n=>events.delete(n)};
 const exports={};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync('app/productie/useScreenLayout.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{
  exports,require:()=>react,window,
  document:{fonts:{addEventListener:(n,fn)=>events.set(`fonts:${n}`,fn),removeEventListener:n=>events.delete(`fonts:${n}`),ready:{then(){}}}},
  getComputedStyle:()=>{metrics.fontReads++;return {fontSize:label.style.fontSize||'15px',paddingLeft:`${paddingLeft}px`,paddingRight:`${paddingRight}px`};},
  MutationObserver:class{constructor(fn){mutation=fn;}observe(){}disconnect(){mutation=null;}},
  ResizeObserver:class{constructor(fn){resize=fn;}observe(target){observed.push(target);}disconnect(){resize=null;}},
  requestAnimationFrame:fn=>{frames.set(++id,fn);return id;},cancelAnimationFrame:id=>frames.delete(id),
 });
 exports.default(xl);
 function flush(){for(const [i,fn]of [...frames]){frames.delete(i);fn();}}
 return {frame,workspace,label,events,metrics,observed,flush,
  mutate(records){mutation?.(records);},
  notifyResize(){resize?.();},
  get scale(){return Number(workspace.style['--screen-fit-scale']||1);},
  changeContent(value){currentHeight=value;mutation?.([{type:'childList',target:workspace}]);flush();},
  changeText(value,nextWordWidth){label.textContent=value;currentWordWidth=nextWordWidth;mutation?.([{type:'characterData',target:label}]);flush();},
  resize(w,h){frame.clientWidth=w;window.innerWidth=w;window.outerWidth=w;window.innerHeight=h;window.visualViewport.height=h;events.get('resize')?.();flush();},
  changePixelRatio(value){window.devicePixelRatio=value;events.get('resize')?.();flush();},
  zoom(factor){window.devicePixelRatio=factor;window.innerWidth=width/factor;frame.clientWidth=width/factor;window.innerHeight=height/factor;window.visualViewport.height=height/factor;events.get('resize')?.();flush();},
  pinch(factor){window.visualViewport.scale=factor;window.visualViewport.height=window.innerHeight/factor;events.get('visual:resize')?.();flush();},
  close(){cleanup?.();},get pending(){return frames.size;}};
}

test('the complete workspace fits Full HD, 4K and reduced desktop heights in both modes',()=>{
 for(const xl of [false,true])for(const [width,height]of [[1920,1080],[3840,2160],[1366,650],[1024,600]])for(const contentHeight of [700,1800,4200,12000]){
  const h=harness({xl,width,height,contentHeight});
  assert(h.scale>0&&h.scale<=Math.max(1,width/1920));
  assert(h.workspace.scrollHeight*h.scale<=height-2+.001);
  assert(h.workspace.scrollWidth*h.scale<=width+.5);
  if(width===3840&&contentHeight===700)assert(h.scale>1.5);
  assert(h.metrics.wordReads<=3,'Natural words are measured once per density, not for every scale probe');
  h.close();
 }
});
test('whole-word fitting reserves title padding and does not compound font shrinking under an existing transform',()=>{
 const h=harness({labelWidth:140,paddingRight:34,wordWidth:480,contentHeight:700});
 const wordWidth=()=>h.label.querySelectorAll()[0].getBoundingClientRect().width;
 assert(wordWidth()<=105.01);assert(wordWidth()>104.9);
 h.changeContent(6000);const fittedFont=h.label.style.fontSize,scale=h.scale;
 for(let i=0;i<5;i++)h.changeContent(6000);
 assert.equal(h.label.style.fontSize,fittedFont);assert.equal(h.scale,scale);assert(wordWidth()<=105.01);
 h.changeText('80× Nieuwe lange grondstof',700);assert(wordWidth()<=105.01);
 h.close();
});
test('natural word metrics stay independent of 4K scaling and reflow refinement reuses those measurements',()=>{
 const h=harness({width:3840,height:2160,contentHeight:700,labelWidth:140,paddingRight:34,wordWidth:480});
 assert.equal(h.scale,2);
 h.changeText('Nieuw lang product',700);
 assert(Math.abs(parseFloat(h.label.style.fontSize)-2.25)<.001,'105 layout pixels remain available regardless of the 2x workspace transform');
 h.close();
 const wrapped=harness({contentHeight:6000,reflow:true});
 const expected=(-1+Math.sqrt(1+8*1078/(6000*.65)))/2;
 assert(wrapped.scale<=expected);assert(expected-wrapped.scale<.015);
 assert(wrapped.workspace.scrollHeight*wrapped.scale<=1078.001);
 assert(wrapped.metrics.wordReads<=3,'Scale refinement must not re-read every word at every candidate width');
 wrapped.close();
});
test('ordinary status/content updates keep the fitted scale and density stable until real overflow or viewport resize',()=>{
 const h=harness({contentHeight:6000});
 const scale=h.scale,density=h.workspace.dataset.screenDensity,reads=h.metrics.wordReads,writes=h.metrics.styleWrites;
 h.changeContent(6000);h.changeContent(600);
 assert.equal(h.scale,scale);assert.equal(h.workspace.dataset.screenDensity,density);
 assert.equal(h.metrics.wordReads,reads);assert.equal(h.metrics.styleWrites,writes);
 h.changeContent(12000);assert(h.scale<scale);assert(h.workspace.scrollHeight*h.scale<=1078.001);
 h.changeContent(600);h.resize(1921,1080);
 assert(h.scale>scale);assert.equal(h.workspace.dataset.screenDensity,'comfortable');h.close();
});
test('observing the frame avoids resize feedback from the transformed workspace and callbacks are batched',()=>{
 const h=harness();assert.deepEqual(h.observed,[h.frame]);
 const reads=h.metrics.heightReads,writes=h.metrics.styleWrites;
 for(let i=0;i<10;i++)h.notifyResize();
 assert.equal(h.pending,0);assert.equal(h.metrics.heightReads,reads);assert.equal(h.metrics.styleWrites,writes);
 h.events.get('content:load')();h.events.get('content:load')();assert.equal(h.pending,1);h.flush();assert.equal(h.pending,0);
 h.close();assert.equal(h.events.size,0);assert.equal(h.pending,0);
 assert.equal(h.workspace.style.transform,'');assert.equal(h.workspace.style.width,'');assert.equal(h.label.style.fontSize,'');
});
test('clock character and child-list mutations never trigger workspace measurements, while font loading still does',()=>{
 const h=harness();const clock={closest:()=>true};const reads=h.metrics.heightReads;
 h.mutate([{type:'characterData',target:{textContent:'100:00:00',parentElement:clock}}]);
 h.mutate([{type:'childList',target:clock}]);
 assert.equal(h.pending,0);assert.equal(h.metrics.heightReads,reads);
 h.events.get('fonts:loadingdone')();assert.equal(h.pending,1);h.flush();h.close();
});
test('browser zoom uses unscaled scrollable content, pinch zoom is left untouched and normal sizing returns after zoom reset',()=>{
 const h=harness({contentHeight:1800}),originalScale=h.scale;
 const originalTransform=h.workspace.style.transform,writes=h.metrics.styleWrites;
 h.pinch(1.5);assert.equal(h.workspace.style.transform,originalTransform);assert.equal(h.metrics.styleWrites,writes);
 h.pinch(1);assert.equal(h.scale,originalScale);
 h.zoom(1.25);assert.equal(h.workspace.style.transform,'');assert.equal(h.workspace.style.width,'');
 assert.equal(h.frame.style.height,'auto');assert.equal(h.frame.style.overflow,'visible');
 h.zoom(1);assert(h.workspace.style.transform.startsWith('scale('));assert.equal(h.scale,originalScale);
 h.resize(700,800);assert.equal(h.workspace.style.transform,'');assert.equal(h.workspace.dataset.screenDensity,undefined);
 h.resize(1920,1080);assert(h.workspace.style.transform.startsWith('scale('));h.close();
});

test('a display DPI change keeps the complete workspace fitted when browser and layout widths still agree',()=>{
 for(const [width,height]of [[1920,1080],[3840,2160]]){
  const h=harness({width,height,contentHeight:4200,pixelRatio:2});
  const originalScale=h.scale;
  for(const ratio of [1,1.5,2]){
   h.changePixelRatio(ratio);
   assert(h.workspace.style.transform.startsWith('scale('));
   assert.equal(h.scale,originalScale);
   assert(h.workspace.scrollHeight*h.scale<=height-2+.001);
   assert.notEqual(h.frame.style.overflow,'visible');
  }
  h.zoom(1.25);
  assert.equal(h.workspace.style.transform,'');
  assert.equal(h.frame.style.height,'auto');
  h.zoom(1);
  assert.equal(h.scale,originalScale);
  assert(h.workspace.style.transform.startsWith('scale('));
  h.close();
 }
});

test('worksheet task names and request rail use readable desktop sizes while keeping whole words intact',()=>{
 const css=fs.readFileSync('app/preview/productie/production.module.css','utf8');
 const requests=fs.readFileSync('app/productie/requests.module.css','utf8');
 assert.match(requests,/\.compact\s+\.row\s+strong\s*\{[^}]*font-size\s*:\s*18px\b/);
 assert.match(requests,/\.compact\s+\.row\s+span\s*\{[^}]*font-size\s*:\s*12px\b/);
 assert.match(requests,/\.compact\s+\.row\s+\.requestQuantity\s*\{[^}]*font-size\s*:\s*13px\b/);
 assert.match(requests,/\.compact\s+h2\s*\{[^}]*font-size\s*:\s*18px\b/);
 assert.match(requests,/\.compact\s+\.row\s+strong\s*\{[^}]*overflow-wrap\s*:\s*normal\s*;\s*word-break\s*:\s*normal\s*;\s*hyphens\s*:\s*none\b/);
 assert.match(css,/\.worksheetRoot\s+\.plannerWithRequests\s*\{[^}]*grid-template-columns\s*:\s*minmax\(0,\s*1fr\)\s+280px\b/);
 assert.match(css,/\.worksheetRoot\s+\.taskOpen\s+strong\s*\{[^}]*font-size\s*:\s*16px\b/);
 assert.match(css,/\.worksheetRoot\s+\.taskStep\s*\{[^}]*font-size\s*:\s*12px\b/);
 const large=css.match(/@media\s*\(\s*min-width\s*:\s*1600px\s*\)\s*\{([^@]*)/)?.[1];
 assert(large,'Large desktop sizes must remain scoped to the 1600px breakpoint');
 assert.match(large,/\.worksheetRoot\s+\.taskOpen\s+strong\s*\{[^}]*font-size\s*:\s*18px\b/);
 assert.match(large,/\.worksheetRoot\s+\.plannerWithRequests\s*\{[^}]*grid-template-columns\s*:\s*minmax\(0,\s*1fr\)\s+320px\b/);
 const words=css.match(/\.worksheetRoot\s+\[data-fit-word\]\s*\{([^}]*)\}/)?.[1];
 assert(words);
 for(const property of ['white-space:nowrap','overflow-wrap:normal','word-break:normal','hyphens:none'])assert(words.replace(/\s+/g,'').includes(property),property);
});

test('recipe group links flow beside task metadata while warnings retain their own space',()=>{
 const css=fs.readFileSync('app/preview/productie/production.module.css','utf8');
 assert(!/\.taskOpen\s*\{[^}]*padding-bottom\s*:\s*18px\b/.test(css),'Group badges must not reserve an extra 18px task row');
 const metadata=css.match(/\.worksheetRoot\s+\.taskMeta\s*\{([^}]*)\}/)?.[1];
 assert(metadata);
 for(const property of [/display\s*:\s*flex/,/flex-wrap\s*:\s*wrap/,/gap\s*:\s*2px\s+8px/])assert.match(metadata,property);
 const badge=css.match(/\.worksheetRoot\s+\.taskMeta\s+\.recipeGroup\s*\{([^}]*)\}/)?.[1];
 assert(badge);
 for(const property of [/position\s*:\s*static/,/max-width\s*:\s*100%/,/white-space\s*:\s*normal/,/word-break\s*:\s*normal/])assert.match(badge,property);
 const warning=css.match(/\.taskStep\s+small\[data-warning-only\]\s*\{([^}]*)\}/)?.[1];
 assert(warning,'A warning-only metadata row should be taken out of normal task flow');
 for(const property of [/position\s*:\s*absolute/,/top\s*:\s*\d+px/,/right\s*:\s*\d+px/,/margin\s*:\s*0\b/])assert.match(warning,property);
 assert(!/small:has\([^}]*taskWarning:only-child/.test(css),'A warning element can share its metadata row with visible status text');
 assert.match(css,/\.taskCard:has\(\.recipeNudge\)\s+\.taskStep\s+small\[data-warning-only\]\s*\{[^}]*right\s*:\s*25px\b/);
 assert.match(css,/\.taskStep\s+small:empty\s*\{[^}]*display\s*:\s*none\b/);
});
