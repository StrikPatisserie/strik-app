const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),jsx=require('react/jsx-runtime');
function load(file,imports={},globals={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,{exports,require:name=>{assert(name in imports,`Unmocked ${name}`);return imports[name];},Date,Intl,Request,Response,URL,...globals});return exports;}
const model=load('app/productie/screenMessages.ts'),access=load('app/lib/auth/access.ts');
const feline={id:'feline',role:'manager',active:true,permissions:{},email:'feline@strik-patisserie.nl',full_name:'Feline'},bakery={id:'bakery-screen',role:'bakkerij',active:true,permissions:{'bakkerij.patisserie':true},email:'strikpatisserie1937@gmail.com'};
const message=model.initialScreenMessages().messages[0],plain=value=>JSON.parse(JSON.stringify(value));
class StoreError extends Error{constructor(message,status=503){super(message);this.status=status;}}
function clock(initial){let now=Date.parse(initial);class FixedDate extends Date{constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}}return{Date:FixedDate,advance:ms=>now+=ms};}

test('only Feline manages notices and only the exact active bakery screen account receives them',()=>{
 assert(access.canManageScreenMessages(feline));assert(access.isBakeryScreenAccount(bakery));
 for(const profile of [null,{...feline,active:false},{...feline,email:'other-manager@example.invalid'},bakery])assert(!access.canManageScreenMessages(profile));
 for(const profile of [null,{...bakery,active:false},{...bakery,email:'other-baker@example.invalid'},{...bakery,role:'winkel',permissions:{}},feline])assert(!access.isBakeryScreenAccount(profile));
});
test('end date includes all of Sunday in Amsterdam and expires exactly at local midnight, including DST dates',()=>{
 const doc=model.initialScreenMessages();assert.equal(doc.messages[0].endDate,'2026-11-08');
 assert.equal(model.activeScreenMessages(doc.messages,'2026-11-08T22:59:59.999Z').length,1);
 assert.equal(model.activeScreenMessages(doc.messages,'2026-11-08T23:00:00.000Z').length,0);
 assert.equal(model.activeScreenMessages(doc.messages,'2026-11-05T22:59:59Z').length,0);
 assert.equal(model.activeScreenMessages(doc.messages,'2026-11-05T23:00:00Z').length,1);
 const summer={...message,startDate:'2026-03-29',endDate:'2026-03-29'};
 assert.equal(model.activeScreenMessages([summer],'2026-03-29T21:59:59Z').length,1);assert.equal(model.activeScreenMessages([summer],'2026-03-29T22:00:00Z').length,0);
});
test('scheduled and disabled notices stay hidden; target DTOs contain no author IDs, disabled flags or future messages',()=>{
 const rows=[{...message,actorId:'PRIVATE-ACTOR',updatedBy:'PRIVATE-EMAIL'},{...message,id:'future',startDate:'2026-12-01',endDate:'2026-12-02'},{...message,id:'disabled',enabled:false}];
 const active=model.activeScreenMessages(rows,'2026-11-06T12:00:00Z');assert.equal(active.length,1);assert(!JSON.stringify(active).includes('PRIVATE'));assert(!('enabled'in active[0]));
});
test('notice updates validate dates and lengths, preserve other messages and use trusted actor and version metadata',()=>{
 const initial=model.initialScreenMessages(),next=model.saveScreenMessage(initial,{...message,title:'Nieuwe titel',version:999,actorId:'forged',updatedBy:'forged'},{id:feline.id,name:'Feline'},'2026-11-06T11:00:00Z');
 assert.equal(next.revision,1);assert.equal(next.messages[0].version,2);assert.equal(next.messages[0].actorId,'feline');assert.equal(next.messages[0].updatedBy,'Feline');assert.equal(initial.messages[0].version,1);
 const added=model.saveScreenMessage(next,{...message,id:'new-message'},{id:'feline',name:'Feline'},'2026-11-06T12:00:00Z');assert.equal(added.messages.length,2);assert.equal(added.messages[1].version,1);
 for(const change of [{title:''},{body:''},{title:'x'.repeat(121)},{body:'x'.repeat(1601)},{startDate:'2026-02-30'},{endDate:'invalid'},{startDate:'2026-12-01',endDate:'2026-11-01'},{enabled:'true'},{id:'<script>'}])assert.throws(()=>model.saveScreenMessage(initial,{...message,...change},{id:'feline',name:'Feline'},'now'));
});
test('seen storage keeps only bounded version tokens so edited notices reopen without storing message text',()=>{
 assert.equal(model.screenMessageToken(message),'welkom-strak-2026:1');assert.equal(model.screenMessageToken({...message,version:2}),'welkom-strak-2026:2');
 assert.deepEqual(plain(model.readScreenSeen('invalid')),[]);assert.deepEqual(plain(model.readScreenSeen(JSON.stringify(['valid-id:1','bad token',{},'<script>:1']))),['valid-id:1']);
 assert.equal(model.readScreenSeen(JSON.stringify(Array.from({length:200},(_,i)=>`id-${i}:1`))).length,100);
});

function apiHarness(profile,options={}){
 let doc=model.initialScreenMessages(),reads=0,writes=0;const time=clock(options.now||'2026-11-06T11:00:00Z');
 const api=load('app/api/productie/schermberichten/route.ts',{'@/app/lib/auth/session':{getCurrentProfile:async()=>profile},'@/app/lib/auth/access':access,'@/app/productie/screenMessages':model,'@/app/productie/documents.server':{ProductionStoreError:StoreError},'@/app/productie/operationalStore.server':{readOperational:async key=>{reads++;assert.equal(key,model.SCREEN_MESSAGES_KEY);return doc;},saveOperational:async(key,revision,next,actor)=>{if(options.conflict)throw new StoreError('conflict',409);assert.equal(key,model.SCREEN_MESSAGES_KEY);assert.equal(revision,doc.revision);assert.equal(actor,feline.id);doc=next;writes++;}}},{Date:time.Date});
 return{api,doc:()=>doc,reads:()=>reads,writes:()=>writes};
}
const post=(body={revision:0,message},origin='https://app.invalid')=>new Request('https://app.invalid/api/productie/schermberichten',{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify(body)});
test('announcement API rejects other accounts before storage access and permits only Feline to write',async()=>{
 for(const profile of [null,{...bakery,email:'other-baker@example.invalid'},{...feline,email:'other-manager@example.invalid'},{...bakery,active:false},{id:'shop',active:true,role:'winkel',permissions:{}}]){const h=apiHarness(profile);assert.equal((await h.api.GET()).status,403);assert.equal((await h.api.POST(post())).status,403);assert.equal(h.reads(),0);}
 const bakeryApi=apiHarness(bakery),response=await bakeryApi.api.GET();assert.equal(response.status,200);assert.match(response.headers.get('Cache-Control'),/no-store/);const data=await response.json();assert.equal(data.canEdit,false);assert.equal(data.messages.length,1);assert(!('actorId'in data.messages[0]));assert.equal((await bakeryApi.api.POST(post())).status,403);assert.equal(bakeryApi.writes(),0);
 const expired=apiHarness(bakery,{now:'2026-11-08T23:00:00Z'});assert.equal((await(await expired.api.GET()).json()).messages.length,0);
});
test('Feline can schedule, change or turn off a notice, with CAS and origin checks and no planning writes',async()=>{
 const h=apiHarness(feline),get=await h.api.GET();assert.equal((await get.json()).canEdit,true);assert.equal(h.writes(),0);
 assert.equal((await h.api.POST(post(undefined,'https://evil.invalid'))).status,403);assert.equal(h.writes(),0);
 assert.equal((await h.api.POST(post({revision:9,message}))).status,409);assert.equal(h.writes(),0);
 const saved=await h.api.POST(post());assert.equal(saved.status,200);assert.equal(h.doc().messages[0].actorId,feline.id);assert.equal(h.doc().messages[0].version,2);assert.equal(h.writes(),1);
 assert.equal((await h.api.POST(post({revision:1,message:{...message,enabled:false}}))).status,200);assert.equal(model.activeScreenMessages(h.doc().messages,'2026-11-06T11:00:00Z').length,0);
 assert.equal((await apiHarness(feline,{conflict:true}).api.POST(post())).status,409);
});

function uiHarness(options={}){
 const slots=[],timers=[],storage=new Map(),time=clock(options.now||'2026-11-06T12:00:00Z');let index=0,otherDialog=!!options.otherDialog;
 const slot=init=>{const i=index++;if(!(i in slots))slots[i]=typeof init==='function'?init():init;return i;};
 const same=(a,b)=>a?.length===b?.length&&a.every((x,i)=>Object.is(x,b[i]));
 const react={useRef:value=>slots[slot(()=>({current:value}))],useState:init=>{const i=slot(init);return[slots[i],next=>{slots[i]=typeof next==='function'?next(slots[i]):next;}];},useEffect:(fn,deps)=>{const i=slot(()=>({deps:undefined}));if(!same(slots[i].deps,deps)){slots[i].deps=deps;fn();}}};
 const doc={hidden:false,querySelector:()=>otherDialog?{}:null,activeElement:{matches:()=>false},addEventListener:()=>{},removeEventListener:()=>{}};
 const component=load('app/productie/BakeryScreenMessages.tsx',{'react':react,'react/jsx-runtime':jsx,'./ProductionIcon':{__esModule:true,default:'icon'},'./ScreenMessageCard':{__esModule:true,default:'notice-card'},'./screenMessages':model,'./screenMessages.module.css':{__esModule:true,default:{}}},{Date:time.Date,document:doc,localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)},setInterval:(fn,ms)=>{timers.push({fn,ms});return timers.length;},clearInterval:()=>{}}).default;
 let messages=[{...message}],request=async()=>({now:new time.Date().toISOString(),messages:plain(messages)});
 const render=(blocked=false)=>{index=0;return component({blocked,request});};
 const nodes=tree=>!tree||typeof tree!=='object'?[]:Array.isArray(tree)?tree.flatMap(nodes):[tree,...nodes(tree.props?.children)];
 const card=tree=>nodes(tree).find(n=>n.type==='notice-card');
 return{render,card,storage,flush:()=>new Promise(resolve=>setImmediate(resolve)),advance:ms=>{time.advance(ms);timers.filter(t=>t.ms===1000).forEach(t=>t.fn());},poll:()=>timers.filter(t=>t.ms===60000).forEach(t=>t.fn()),setMessages:value=>messages=value,setDialog:value=>otherDialog=value,nodes};
}
test('popup waits for editing to finish, can be dismissed and reread, and an edited version is shown again',async()=>{
 const h=uiHarness({otherDialog:true});h.render();await h.flush();h.render();assert.equal(h.card(h.render()),undefined);
 h.setDialog(false);h.render(true);assert.equal(h.card(h.render(true)),undefined);h.render();let card=h.card(h.render());assert(card);assert.equal(card.props.message.title,message.title);
 card.props.onClose();assert.equal(h.card(h.render()),undefined);assert(h.storage.get(model.SCREEN_SEEN_KEY).includes('welkom-strak-2026:1'));
 h.nodes(h.render()).find(n=>n.type==='button').props.onClick();assert(h.card(h.render()));h.card(h.render()).props.onClose();h.render();
 h.setMessages([{...message,version:2,title:'Bijgewerkt'}]);h.poll();await h.flush();h.render();card=h.card(h.render());assert.equal(card.props.message.title,'Bijgewerkt');
});
test('an already open popup and its reopen button disappear at Amsterdam midnight without any network refresh',async()=>{
 const h=uiHarness({now:'2026-11-08T22:59:59Z'});h.render();await h.flush();h.render();assert(h.card(h.render()));h.advance(1000);assert.equal(h.render(),null);
});
test('multiple active messages can be read consecutively instead of losing access after dismissing them',async()=>{
 const h=uiHarness();h.setMessages([{...message},{...message,id:'second',title:'Tweede bericht'}]);h.render();await h.flush();h.render();let card=h.card(h.render());assert.equal(card.props.message.id,message.id);card.props.onClose();card=h.card(h.render());assert.equal(card.props.message.id,'second');card.props.onClose();assert.equal(h.card(h.render()),undefined);
});
