const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),React=require('react');
function load(file,imports={},globals={}){
 const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,...globals,require:name=>name==='server-only'?{}:imports[name]||require(name)});return exports;
}
const access=load('app/lib/auth/access.ts');
const fake={username:'shared@example.invalid',password:'example-shared-access'};
function reader(value=fake,error=null){let reads=0;
 const db={from:table=>{reads++;assert.equal(table,'app_settings');return{select:columns=>{assert.equal(columns,'value');return{eq:(column,key)=>{assert.equal(column,'key');assert.equal(key,'winkel_lokaalverhaal_access_v1');return{maybeSingle:async()=>({data:{value},error})};}};}};}};
 const api=load('app/winkel/lokaalVerhaal.server.ts',{'../lib/auth/access':access,'../lib/supabase/admin':{createAdminClient:()=>db}});
 return{get:api.getLokaalVerhaalCredentials,reads:()=>reads};
}
test('shared credentials require store access before any database read and work for all four stores',async()=>{
 const r=reader();for(const profile of [null,{active:false,role:'winkel'},{active:true,role:'bakkerij',permissions:{}}]){assert.equal(await r.get(profile),null);}
 assert.equal(r.reads(),0);
 for(const store of ['ziekerstraat','heyendaal','daalseweg','lent'])assert.deepEqual(JSON.parse(JSON.stringify(await r.get({active:true,role:'winkel',permissions:{},store}))),fake);
 assert.equal(r.reads(),4);
});
test('an unavailable or malformed setting never returns partial or fabricated credentials',async()=>{
 const profile={active:true,role:'winkel',permissions:{}};
 for(const value of [null,[],{username:fake.username},{username:fake.username,password:''},'raw text'])assert.equal(await reader(value).get(profile),null);
 await assert.rejects(()=>reader(fake,{}).get(profile),/gedeelde inlog/);
});
test('the small logo opens registration while credentials are inside the closed info dialog',()=>{
 const Card=load('app/winkel/LokaalVerhaalCard.tsx',{'react':React,'react/jsx-runtime':require('react/jsx-runtime'),'next/image':{default:props=>React.createElement('img',props)}}).default;
 const html=require('react-dom/server').renderToStaticMarkup(React.createElement(Card,{credentials:fake}));
 assert.match(html,/https:\/\/beheer\.lokaalverhaal\.com\/Sales\/DeliveryRegistration/);assert.match(html,/target="_blank"/);assert.match(html,/noopener noreferrer/);assert.match(html,/lokaalverhaal-transparent\.png/);assert.match(html,/shared@example.invalid/);assert.match(html,/example-shared-access/);assert.match(html,/E-mailadres kopiëren/);assert.match(html,/Wachtwoord kopiëren/);
 const outside=html.replace(/<dialog[\s\S]*?<\/dialog>/g,'');assert.doesNotMatch(outside,/example-shared-access|shared@example.invalid|<h2/);assert.match(html,/aria-expanded="false"/);assert.doesNotMatch(html,/<dialog[^>]*\sopen(?:=|\s|>)/);
 const absent=require('react-dom/server').renderToStaticMarkup(React.createElement(Card,{credentials:null}));assert.doesNotMatch(absent,/example-shared-access/);assert.match(absent,/kan momenteel niet worden geladen/);
});
test('the server section keeps credentials off unauthorized store pages and handles a temporary outage',async()=>{
 let reads=0;const section=load('app/winkel/LokaalVerhaalAccess.tsx',{'../lib/auth/access':access,'react/jsx-runtime':require('react/jsx-runtime'),'../lib/supabase/types':{},'./LokaalVerhaalCard':{default:()=>null},'./lokaalVerhaal.server':{getLokaalVerhaalCredentials:async()=>{reads++;throw Error('Unavailable');}}}).default;
 assert.equal(await section({profile:null}),null);assert.equal(reads,0);assert.equal((await section({profile:{active:true,role:'winkel',permissions:{}}})).props.credentials,null);assert.equal(reads,1);
});


test('the info icon opens and closes the login dialog, with working copy controls',async()=>{
 const states=[],copied=[];let cursor=0,opened=0,closed=0;
 const ref={current:{showModal(){opened++;},close(){closed++;}}};
 const hooks={useId:()=>"lokaal-info",useRef:()=>ref,useState(initial){const i=cursor++;if(!(i in states))states[i]=initial;return[states[i],v=>{states[i]=v;}];}};
 const Card=load('app/winkel/LokaalVerhaalCard.tsx',{'react':hooks,'react/jsx-runtime':require('react/jsx-runtime'),'next/image':{default:'img'}},{navigator:{clipboard:{writeText:async text=>copied.push(text)}}}).default;
 const nodes=tree=>Array.isArray(tree)?tree.flatMap(nodes):tree&&typeof tree==='object'?[tree,...nodes(tree.props?.children)]:[];
 const render=()=>{cursor=0;return Card({credentials:fake});};
 const button=(tree,label)=>nodes(tree).find(n=>n.type==='button'&&n.props['aria-label']===label);
 let tree=render();button(tree,'Inloggegevens Lokaal Verhaal').props.onClick();assert.equal(opened,1);tree=render();assert.equal(button(tree,'Inloggegevens Lokaal Verhaal').props['aria-expanded'],true);
 button(tree,'Wachtwoord kopiëren').props.onClick();await new Promise(setImmediate);assert.deepEqual(copied,[fake.password]);tree=render();assert(nodes(tree).some(n=>n.props?.role==='status'));
 button(tree,'Inloggegevens sluiten').props.onClick();assert.equal(closed,1);nodes(tree).find(n=>n.type==='dialog').props.onClose();tree=render();assert.equal(button(tree,'Inloggegevens Lokaal Verhaal').props['aria-expanded'],false);assert(!nodes(tree).some(n=>n.props?.role==='status'));
});
