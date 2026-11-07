const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');

// Simulate measured content, including navigation + header height. Unlike a
// task-count estimate, the hook must fit late-rendered arbitrary DOM heights.
function harness({width=1920,height=1080,contentHeight=1800,xl=false,wordWidth=320,labelWidth=150,paddingLeft=0,paddingRight=0}={}){
 const frames=new Map(),events=new Map();let cleanup,mutation,resize,id=0,currentHeight=contentHeight;
 const style=()=>({setProperty(k,v){this[k]=v;},removeProperty(k){delete this[k];}});
 const label={style:style(),clientWidth:labelWidth,querySelectorAll:()=>[{getBoundingClientRect:()=>({width:wordWidth*(parseFloat(label.style.fontSize)||15)/15})}]};
 const workspace={style:style(),dataset:{},querySelectorAll:()=>[label],get scrollHeight(){return currentHeight*(this.dataset.screenDensity==='dense'?.65:this.dataset.screenDensity==='compact'?.85:1);},get scrollWidth(){return parseFloat(this.style.width)||width;},addEventListener:(name,fn)=>events.set(`content:${name}`,fn),removeEventListener:name=>events.delete(`content:${name}`)};
 const frame={clientWidth:width,getBoundingClientRect:()=>({top:0})};
 let ref=0;const react={useRef:()=>({current:ref++===0?frame:workspace}),useLayoutEffect:fn=>{cleanup=fn();}};
 const window={innerWidth:width,innerHeight:height,visualViewport:{offsetTop:0,height,addEventListener:(n,fn)=>events.set(`visual:${n}`,fn),removeEventListener:n=>events.delete(`visual:${n}`)},scrollTo(){},addEventListener:(n,fn)=>events.set(n,fn),removeEventListener:n=>events.delete(n)};
 const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('app/productie/useScreenLayout.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:()=>react,window,document:{fonts:{addEventListener:(n,fn)=>events.set(`fonts:${n}`,fn),removeEventListener:n=>events.delete(`fonts:${n}`),ready:{then(){}}}},getComputedStyle:()=>({fontSize:'15px',paddingLeft:`${paddingLeft}px`,paddingRight:`${paddingRight}px`}),MutationObserver:class{constructor(fn){mutation=fn;}observe(){}disconnect(){mutation=null;}},ResizeObserver:class{constructor(fn){resize=fn;}observe(){}disconnect(){resize=null;}},requestAnimationFrame:fn=>{frames.set(++id,fn);return id;},cancelAnimationFrame:id=>frames.delete(id)});
 exports.default(xl);
 function flush(){for(const [i,fn]of [...frames]){frames.delete(i);fn();}}
 return {frame,workspace,label,events,mutate(records){mutation?.(records);},get scale(){return Number(workspace.style['--screen-fit-scale']||1);},changeContent(h){currentHeight=h;mutation?.([{type:'childList'}]);flush();},resize(w,h){frame.clientWidth=w;window.innerWidth=w;window.innerHeight=h;window.visualViewport.height=h;resize?.();flush();},close(){cleanup?.();},get pending(){return frames.size;}};
}

test('all desktop content, including navigation and headers, fits Full HD/4K and reduced browser height in both modes',()=>{
 for(const xl of [false,true])for(const [width,height]of [[1920,1080],[3840,2160],[1366,650],[1024,600]])for(const contentHeight of [700,1800,4200,12000]){
  const h=harness({xl,width,height,contentHeight});assert(h.scale>0&&h.scale<=Math.max(1,width/1920));assert(h.workspace.scrollHeight*h.scale<=height-2+.001);assert(h.workspace.scrollWidth*h.scale<=width+.5);if(width===3840&&contentHeight===700)assert(h.scale>1.5);h.close();
 }
});
test('long complete words are reduced to available width without removing text, and late content refits',()=>{
 const h=harness({wordWidth:480,labelWidth:140,contentHeight:700});assert(parseFloat(h.label.style.fontSize)<15);assert(480*parseFloat(h.label.style.fontSize)/15<=139.01);
 h.changeContent(6000);assert.equal(h.workspace.dataset.screenDensity,'dense');assert(h.workspace.scrollHeight*h.scale<=1078);h.changeContent(600);assert.equal(h.scale,1);h.close();
});
test('word fitting reserves the title padding used by warning and recipe indicators',()=>{
 const h=harness({labelWidth:140,paddingRight:34,wordWidth:480,contentHeight:700});
 const width=()=>h.label.querySelectorAll()[0].getBoundingClientRect().width;
 assert(width()<=105.01,'140px clientWidth leaves 105px for words after 34px reserved padding and a 1px safety margin');
 assert(width()>104.9,'Use the available content width without repeatedly compounding the font reduction');
 h.changeContent(6000);assert(width()<=105.01);h.close();
});
test('uses the largest fitting scale and leaves mobile scrollable; cleanup removes only its own styles/listeners',()=>{
 const h=harness({width:1366,height:650,contentHeight:1800});const expected=(650-2)/(1800*.65);assert(h.scale<=expected);assert(expected-h.scale<.001);
 h.resize(700,800);assert.equal(h.workspace.style.transform,'');assert.equal(h.workspace.dataset.screenDensity,undefined);h.resize(1920,1080);assert(h.workspace.style.transform.startsWith('scale('));h.close();assert.equal(h.workspace.style.transform,'');assert.equal(h.label.style.fontSize,'');assert.equal(h.events.size,0);assert.equal(h.pending,0);
});
test('same-length tabular timer ticks do not remeasure the workspace',()=>{
 const h=harness();const mutation={type:'characterData',oldValue:'00:01',target:{textContent:'00:02',parentElement:{closest:()=>true}}};
 // DOM resize/font/image events remain active even when clock ticks are quiet.
 h.mutate([mutation]);assert.equal(h.pending,0);h.events.get('fonts:loadingdone')();assert.equal(h.pending,1);h.close();
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
 assert.match(css,/\.worksheetRoot\s+\.taskOpen\s*>\s*span\s*\{[^}]*font-size\s*:\s*12px\b/);
 const large=css.match(/@media\s*\(\s*min-width\s*:\s*1600px\s*\)\s*\{([^@]*)/)?.[1];
 assert(large,'Large desktop sizes must remain scoped to the 1600px breakpoint');
 assert.match(large,/\.worksheetRoot\s+\.taskOpen\s+strong\s*\{[^}]*font-size\s*:\s*18px\b/);
 assert.match(large,/\.worksheetRoot\s+\.plannerWithRequests\s*\{[^}]*grid-template-columns\s*:\s*minmax\(0,\s*1fr\)\s+320px\b/);
 const words=css.match(/\.worksheetRoot\s+\[data-fit-word\]\s*\{([^}]*)\}/)?.[1];
 assert(words);
 for(const property of ['white-space:nowrap','overflow-wrap:normal','word-break:normal','hyphens:none'])assert(words.replace(/\s+/g,'').includes(property),property);
});

test('recipe group badges and warnings stay readable without adding a blank line to every task',()=>{
 const css=fs.readFileSync('app/preview/productie/production.module.css','utf8');
 assert(!/\.taskOpen\s*\{[^}]*padding-bottom\s*:\s*18px\b/.test(css),'Group badges must not reserve an extra 18px task row');
 const badge=css.match(/(?:^|\n)\.recipeGroup\s*\{([^}]*)\}/)?.[1];
 assert(badge);
 for(const property of [/position\s*:\s*absolute/,/right\s*:\s*\d+px/,/bottom\s*:\s*\d+px/,/white-space\s*:\s*nowrap/])assert.match(badge,property);
 assert.match(css,/\.taskCard:has\(\.recipeGroup\)\s+\.taskOpen\s*>\s*span\s*\{[^}]*padding-right\s*:\s*42px\b/);
 const warning=css.match(/\.taskOpen\s+small\[data-warning-only\]\s*\{([^}]*)\}/)?.[1];
 assert(warning,'A warning-only metadata row should be taken out of normal task flow');
 for(const property of [/position\s*:\s*absolute/,/top\s*:\s*\d+px/,/right\s*:\s*\d+px/,/margin\s*:\s*0\b/])assert.match(warning,property);
 assert(!/small:has\([^}]*taskWarning:only-child/.test(css),'A warning element can share its metadata row with visible status text');
 assert.match(css,/\.taskOpen\s+small:empty\s*\{[^}]*display\s*:\s*none\b/);
});
