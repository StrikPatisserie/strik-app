const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');
function load(file,imports={},globals={}){
 const exports={};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,Request,Response,URL,Date,...globals,require:name=>{assert.ok(name in imports,name);return imports[name];}});
 return exports;
}
const eligibility=load('app/sinterklaas/mailing/reminderEligibility.ts');
const customer=(changes={})=>({id:'c1',company:'Voorbeeld BV',ordered:false,recipients:[{id:'r1',email:'team@example.test',doNotEmail:false,sent:[{kind:'folder',sentAt:'2026-10-01'}]}],...changes});
const order=(changes={})=>({id:'o1',year:'2026',season:'sint',customerName:'Ander bedrijf',customerEmail:'team@example.test',status:'aanvraag',cancelled:false,...changes});
const status=(orders,contact=customer(),season='sint')=>eligibility.createReminderMatcher(orders,'2026',season)(contact);
test('current quotes and final/manual orders match email or exact normalized company, without domain/fuzzy matches',()=>{
 for(const stage of ['aanvraag','offerte','akkoord'])assert.equal(status([order({status:stage})]).status,stage==='akkoord'?'ordered':'quote');
 assert.equal(status([order({customerEmail:' TEAM@EXAMPLE.TEST '})]).matchedBy,'email');
 assert.equal(status([order({status:undefined})]).status,'ordered','legacy imports use the same final-order default as B2B');
 assert.equal(status([order({customerEmail:'someone@other.test',customerName:'  VOORBEELD B.V.  '})]).matchedBy,'company');
 assert.equal(status([order({customerEmail:'other@example.test'})]),null);
 assert.equal(status([order({customerEmail:'',customerName:'Voorbeeld BV Zorg'})]),null);
 assert.equal(status([order({customerEmail:''})],customer({company:''})),null);
 assert.equal(status([order({status:'offerte'}),order({status:'akkoord',customerEmail:'different@example.test',customerName:'Voorbeeld BV'})]).status,'ordered');
});
test('matching is scoped to year and season, mixed campaign excludes either selected season',()=>{
 assert.equal(status([order({year:'2025'})]),null);
 assert.equal(status([order({season:'kerst'})]),null);
 assert.equal(status([order({season:'sint'})],customer(),'kerst'),null);
 assert.ok(status([order({season:'sint-kerst'})],customer(),'kerst'));
 assert.ok(status([order({season:'kerst'})],customer(),'sint-kerst'));
 for(const changes of [{cancelled:true},{status:'afgewezen'},{status:'unknown'},{season:'unknown'}])assert.equal(status([order(changes)]),null);
});
test('manual ordered flags and automatic matches filter contacts without changing their data',()=>{
 const open=customer(),quoted=customer({reminderExclusion:{status:'quote',matchedBy:'email'}}),ordered=customer({ordered:true});
 for(const item of [quoted,ordered]){
  assert.equal(eligibility.reminderExcluded(item),true);
  assert.equal(eligibility.contactMatchesFilter(item,'open'),false);
  assert.equal(eligibility.contactMatchesFilter(item,'responded'),true);
 }
 assert.equal(eligibility.contactMatchesFilter(open,'open'),true);
 assert.equal(eligibility.contactMatchesFilter(open,'responded'),false);
 for(const item of [open,quoted,ordered])assert.equal(eligibility.contactMatchesFilter(item,'all'),true);
 assert.equal(open.ordered,false);
});
function app(options={}){
 const calls=[],campaign={year:'2026',selection:'sint',customers:[customer()],...options.campaign};
 let orders=options.orders||[];
 const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
 const server={
  proxySinterklaasGet:async(req,endpoint)=>{
   calls.push({method:'GET',endpoint,url:req.url});
   if(options.denied)return json({message:'Geen toegang'},403);
   if(endpoint==='sinterklaas-b2b-orders')return options.failed?json({message:'bron niet bereikbaar'},502):json({orders});
   return json(campaign);
  },
  proxySinterklaasMutation:async(req,endpoint,method)=>{
   const body=await req.json();calls.push({method,endpoint,body});
   const next=method==='PATCH'?body.campaign:body;
   if(method==='PATCH')next.customers[0].recipients[0].sent.push({kind:body.kind,sentAt:'now'});
   return json(next);
  },
 };
 const route=load('app/api/sinterklaas-mailing/route.ts',{
  '@/app/sinterklaas/sinterklaasServerApi':server,
  'next/server':{NextResponse:{json:(data,init={})=>json(data,init.status||200)}},
  './seed2024':{b2bCustomers2024:[]},
  '@/app/lib/businessFolderContacts':{addPersistentFolderContacts:async rows=>rows,syncFolderContactPreferences:async()=>{}},
  '@/app/sinterklaas/mailing/reminderEligibility':eligibility,
 });
 const request=(method='GET',body)=>new Request('https://app.example.test/api/sinterklaas-mailing?year=2026&season=sint&status=akkoord&search=not-this-order',{method,headers:{'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
 const mail=(kind='reminder1',changes={})=>({kind,customerId:'c1',recipientId:'r1',campaign:structuredClone(campaign),...changes});
 return{route,calls,request,mail,campaign,setOrders:value=>{orders=value;}};
}
test('GET decorates readonly status and removes all optional filters from canonical order lookup',async()=>{
 const a=app({orders:[order()]});const response=await a.route.GET(a.request());
 assert.equal(response.status,200);assert.equal((await response.json()).customers[0].reminderExclusion.status,'quote');
 const url=new URL(a.calls.find(call=>call.endpoint==='sinterklaas-b2b-orders').url);
 assert.equal(url.search,'?year=2026');assert.equal(a.calls.filter(call=>call.method!=='GET').length,0);
});
test('each reminder is rechecked, newly received quotes skip without transport or sent stamps, batch can continue',async()=>{
 const a=app();await a.route.GET(a.request());a.setOrders([order()]);
 for(const kind of ['reminder1','reminder2']){
  const response=await a.route.PATCH(a.request('PATCH',a.mail(kind)));
  const data=await response.json();assert.equal(response.status,200);assert.equal(data.skipped,true);
  assert.equal(data.customers[0].recipients[0].sent.length,1);assert.equal(data.customers[0].ordered,false);
 }
 assert.equal(a.calls.filter(call=>call.method==='PATCH').length,0);
});
test('omitting exclusion, editing draft identity or unknown source cannot bypass server suppression',async()=>{
 const a=app({orders:[order()]});
 const draft=structuredClone(a.campaign);draft.customers[0].company='Edited';draft.customers[0].recipients[0].email='new@unrelated.test';
 assert.equal((await (await a.route.PATCH(a.request('PATCH',a.mail('reminder1',{campaign:draft})))).json()).skipped,true);
 assert.equal(a.calls.filter(call=>call.method==='PATCH').length,0);
 for(const options of [{failed:true},{denied:true}]){
  const b=app(options);assert.equal((await b.route.PATCH(b.request('PATCH',b.mail()))).status,options.denied?403:502);
  assert.equal(b.calls.filter(call=>call.method==='PATCH').length,0);
 }
});
test('eligible reminders and initial newsletters keep normal transport and ignore forged derived fields',async()=>{
 const a=app();const input=a.mail();input.campaign.customers[0].reminderExclusion={status:'ordered',matchedBy:'email'};
 const response=await a.route.PATCH(a.request('PATCH',input));const data=await response.json();
 assert.equal(response.status,200);assert.equal(data.skipped,undefined);assert.equal(data.customers[0].reminderExclusion,null);
 assert.equal(a.calls.find(call=>call.method==='PATCH').body.campaign.customers[0].reminderExclusion,undefined);
 const b=app({orders:[order()]});await b.route.PATCH(b.request('PATCH',b.mail('folder')));
 assert.equal(b.calls.filter(call=>call.method==='PATCH').length,1);
});
test('saving recalculates readonly status, never persists it, and rejects year mismatch',async()=>{
 const a=app({orders:[order({status:'akkoord'})]});
 const input=structuredClone(a.campaign);input.customers[0].reminderExclusion={status:'quote',matchedBy:'company'};
 const data=await (await a.route.POST(a.request('POST',input))).json();
 assert.equal(data.customers[0].reminderExclusion.status,'ordered');
 assert.equal(a.calls.find(call=>call.method==='POST').body.customers[0].reminderExclusion,undefined);
 const b=app();const bad=b.mail();bad.campaign.year='2025';
 assert.equal((await b.route.PATCH(b.request('PATCH',bad))).status,400);
 assert.equal(b.calls.filter(call=>call.method==='PATCH').length,0);
});
function uiHarness({confirm=false}={}){
 const jsx=require('react/jsx-runtime');
 const contacts=[customer({id:'open',company:'Open klant',notes:''}),customer({id:'quote',company:'Offerte klant',notes:'',reminderExclusion:{status:'quote',matchedBy:'email'}}),customer({id:'ordered',company:'Besteld klant',notes:'',ordered:true})];
 let index=0;const slots=[],requests=[];
 const react={useEffect:()=>{},useMemo:fn=>fn(),useCallback:fn=>fn,useState:initial=>{
  const i=index++;if(!(i in slots)){
   const value=typeof initial==='function'?initial():initial;
   slots[i]=i===1?{...value,customers:contacts}:i===2?true:i===9?['open','quote','ordered']:i===10&&confirm?{requestId:'test',customerIds:['open','quote','ordered'],kind:'reminder1',subject:'Reminder',body:'Test',phase:'confirm',includePreviouslySent:false}:value;
  }
  return[slots[i],next=>{slots[i]=typeof next==='function'?next(slots[i]):next;}];
 }};
 const component=load('app/sinterklaas/mailing/SinterklaasMailingClient.tsx',{
  'react':react,'react/jsx-runtime':jsx,'next/image':{default:'img'},
  '../../lib/businessSeasons':load('app/lib/businessSeasons.ts'),
  './reminderEligibility':eligibility,
 },{fetch:async(url,init)=>{requests.push({url,init});const input=JSON.parse(init.body);return{ok:true,json:async()=>({...input.campaign,skipped:true})};}});
 const render=()=>{index=0;return component.default({season:'sint'});};
 return{render,slots,requests};
}
function collect(node,predicate){
 if(!node||typeof node!=='object')return[];
 if(Array.isArray(node))return node.flatMap(child=>collect(child,predicate));
 return[...(predicate(node)?[node]:[]),...collect(node.props?.children,predicate)];
}
const text=node=>typeof node==='string'||typeof node==='number'?String(node):Array.isArray(node)?node.map(text).join(''):node&&typeof node==='object'?text(node.props?.children):'';
test('mailing UI starts filtered, shows automatic quote status, and disables reminder buttons even with all contacts selected',()=>{
 const h=uiHarness();let view=h.render();
 assert.equal(collect(view,node=>node.type==='article').length,1);
 const filter=collect(view,node=>node.props?.['aria-label']==='Klantenfilter')[0];filter.props.onChange({target:{value:'all'}});view=h.render();
 assert.equal(h.slots[9].length,0,'changing a filter clears hidden selections');
 const rows=collect(view,node=>node.type==='article');assert.equal(rows.length,3);
 for(const row of rows.slice(1))for(const button of collect(row,node=>node.type==='button'&&/^Reminder/.test(text(node))))assert.equal(button.props.disabled,true);
 const quote=rows.find(row=>text(row).includes('Offerte klant'));assert.match(text(quote),/Offerte\/aanvraag/);
 assert.match(collect(quote,node=>node.type==='span'&&node.props.title)[0].props.title,/Automatisch uit de B2B-lijst/);
 const open=rows.find(row=>text(row).includes('Open klant'));
 assert.equal(collect(open,node=>node.type==='button'&&text(node)==='Reminder 1')[0].props.disabled,false);
 filter.props.onChange({target:{value:'responded'}});view=h.render();assert.equal(collect(view,node=>node.type==='article').length,2);
});
test('a server skip is reported as skipped, never as sent, while the UI filters existing matches from the batch',async()=>{
 const h=uiHarness({confirm:true});const view=h.render();
 const send=collect(view,node=>node.type==='button'&&text(node).startsWith('Definitief naar'))[0];
 assert.match(text(send),/1 adres/);
 await send.props.onClick();await new Promise(resolve=>setImmediate(resolve));
 assert.equal(h.requests.length,1);assert.equal(JSON.parse(h.requests[0].init.body).customerId,'open');
 assert.match(h.slots[3],/verstuurd naar 0 adressen/);assert.match(h.slots[3],/1 overgeslagen/);
});
