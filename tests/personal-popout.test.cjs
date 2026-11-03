const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const uuid='00000000-0000-4000-8000-000000000001';
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function load(file,imports,globals={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,require:n=>{assert(n in imports,n);return imports[n];},URL,...globals});return exports;}
function popout(browser){const messages=[];const jsx=(type,props)=>({type,...props});const Component=load('app/persoonlijk/PersonalPopoutButton.tsx',{'react':{useState:()=>['',v=>messages.push(v)]},'react/jsx-runtime':{jsx,jsxs:jsx,Fragment:'fragment'},'./model':{UUID:/^[0-9a-f-]{36}$/}},{window:browser}).default;return {button:Component({noteId:uuid}).children[0],messages,Component};}
function child(){const nodes=[],events={};return {closed:false,focused:0,focus(){this.focused++;},document:{body:{style:{},append:n=>nodes.push(n)},createElement:()=>({style:{}})},addEventListener:(name,cb)=>events[name]=cb,nodes,events};}
test('floating todos use a same-origin authenticated mini page and reuse the existing topmost window',async()=>{
 const w=child(),calls=[],browser={location:{origin:'https://app.example.invalid'},documentPictureInPicture:{requestWindow:async opts=>{calls.push(opts);return w;}}};const {button}=popout(browser);button.onClick();await tick();assert.equal(calls.length,1);assert.equal(w.nodes.length,1);assert.equal(w.nodes[0].src,`https://app.example.invalid/persoonlijk/mini?note=${uuid}`);assert.equal(w.nodes[0].title,'Mijn persoonlijke to-do’s');button.onClick();await tick();assert.equal(calls.length,1);assert.equal(w.focused,1);w.closed=true;w.events.pagehide();button.onClick();await tick();assert.equal(calls.length,2);
});
test('fallback popup reports blocking rather than navigating away from the app',async()=>{
 const calls=[],{button,messages}=popout({location:{origin:'https://app.example.invalid'},open:(...args)=>{calls.push(args);return null;}});button.onClick();await tick();assert.equal(calls[0][1],'strik-personal-todos');assert.match(calls[0][2],/resizable=yes/);assert.match(messages.at(-1),/Sta pop-ups toe/);
});
test('disabled popup cannot open an unsaved note',async()=>{
 let calls=0;const {Component}=popout({location:{origin:'https://app.example.invalid'},open:()=>calls++});Component({disabled:true}).children[0].onClick();await tick();assert.equal(calls,0);
});
test('cross-window save signals contain no private note data and use separate owner channels',()=>{
 const sent=[],closed=[];class Channel{constructor(name){this.name=name;}postMessage(value){sent.push([this.name,value]);}close(){closed.push(this.name);}}
 const sync=load('app/persoonlijk/usePersonalSync.ts',{'react':{}},{BroadcastChannel:Channel});sync.announcePersonalSave(uuid);sync.announcePersonalSave('another-owner');assert.deepEqual(sent,[[`strik-personal-sync:${uuid}`,'changed'],['strik-personal-sync:another-owner','changed']]);assert.equal(closed.length,2);
});
test('sync coalesces overlapping events, skips hidden documents and cleans up listeners',async()=>{
 const callbacks=[],events={},document={visibilityState:'visible',addEventListener:(n,f)=>events[n]=f,removeEventListener:n=>delete events[n]};let interval,cleaned=false,channel,release,refreshes=0;
 class Channel{constructor(){channel=this;}close(){cleaned=true;}}
 const window={setInterval:f=>{interval=f;return 1;},addEventListener:(n,f)=>events[n]=f,removeEventListener:n=>delete events[n]};
 const react={useRef:v=>({current:v}),useEffect:f=>callbacks.push(f)};const sync=load('app/persoonlijk/usePersonalSync.ts',{react},{window,document,BroadcastChannel:Channel,clearInterval:()=>{}});
 sync.usePersonalSync(uuid,false,()=>{refreshes++;return new Promise(r=>release=r);});callbacks[0]();const cleanup=callbacks[1]();events.focus();interval();channel.onmessage({data:'changed'});assert.equal(refreshes,1);release();await tick();document.visibilityState='hidden';interval();assert.equal(refreshes,1);document.visibilityState='visible';interval();assert.equal(refreshes,2);release();await tick();cleanup();assert(cleaned);assert.deepEqual(Object.keys(events),[]);
});
