const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function load(file,imports={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:name=>{if(!(name in imports))throw Error(`Unmocked ${name}`);return imports[name];},Request,Response,URL,Date,Intl,Buffer,structuredClone,crypto:require('node:crypto').webcrypto});return exports;}
const plain=value=>JSON.parse(JSON.stringify(value));
const access=load('app/lib/auth/access.ts'),planning=load('app/productie/planning.ts');
const rights=load('app/productie/access.ts',{'../lib/auth/access':access,'./planning':planning});
const inventory=load('app/productie/inventory.ts',{'./planning':planning}),suppliers=load('app/leveranciers/model.ts');
const workspace=load('app/productie/workspaceData.ts',{'./planning':planning});
const manager={id:'manager',role:'manager',active:true,permissions:{},email:'manager@example.invalid'},baker={id:'baker',role:'bakkerij',active:true,permissions:{'bakkerij.patisserie':true},email:'baker@example.invalid'},logistics={id:'logistics',role:'logistiek',active:true,permissions:{'bakkerij.logistiek':true},email:'logistics@example.invalid'},shop={id:'shop',role:'winkel',active:true,permissions:{}};
class StoreError extends Error{constructor(message,status=503){super(message);this.status=status;}}
const post=(path,body,origin='https://app.invalid')=>new Request(`https://app.invalid${path}`,{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify(body)});
const item={id:'cake',name:'Testtaart',unit:'stuks',kind:'product',departmentId:'dessert',stock:0,note:''};
const planner=()=>({version:1,items:[structuredClone(item)],tasks:[]});
const batch=(date='2026-11-05',quantity='10',extra={})=>({date,status:'definitief',importedAt:'2026-11-05T19:00:00Z',receipts:[{id:'receipt',receiptNumber:'1001',customerName:'PRIVATE CUSTOMER',lines:[{articleNumber:'101.01',quantity,description:'Testtaart',price:'PRIVATE PRICE'}]}],...extra});
const day=(date,quantity=1)=>({date,importedAt:`${date}T19:00:00Z`,unknownLines:0,lines:[{article:'101.01',description:'Testtaart',quantity}]});
const days28=()=>Array.from({length:28},(_,i)=>day(planning.addDays('2026-10-09',i)));
const counted=(quantity=50)=>({revision:1,counts:[{id:'count',itemId:item.id,unit:item.unit,date:'2026-10-08',quantity,who:'Proefbakker',actorId:'trusted-baker',at:'2026-10-08T20:00:00Z'}],links:[{itemId:item.id,unit:item.unit,article:'101.01',factor:1,leadDays:2}],actions:['action-0']});

test('shared supplier access is limited to active management, bakery and logistics, with production department scope retained',()=>{
 for(const who of [manager,baker,logistics,{...baker,permissions:{'bakkerij.ijs_chocolade':true}}])assert.equal(access.canAccessSuppliers(who),true);
 for(const who of [null,shop,{...manager,active:false},{...logistics,active:false}])assert.equal(access.canAccessSuppliers(who),false);
 assert(!rights.productionDepartments(baker).includes('ijs'));
 assert(rights.productionDepartments({...baker,permissions:{...baker.permissions,'productie.manage':true}}).includes('ijs'));
 assert(!access.canAccessPath(baker,'/bakkerij/productie/beheer/marge'));
 assert(access.canAccessPath(baker,'/bakkerij/productie/haccp/bakkerij'));
 assert(access.canAccessPath(logistics,'/leveranciers'));
 assert(!access.canAccessPath(shop,'/leveranciers'));
});
test('the active bakery screen can operate every production board without gaining management access',()=>{
 const screen={...baker,email:' STRIKPATISSERIE1937@gmail.com '};
 const all=Array.from(planning.DEPARTMENTS,department=>department.id);
 assert.deepEqual(Array.from(rights.productionDepartments(screen)),all);
 assert.deepEqual(Array.from(rights.productionDepartments(manager)),all);
 const iceBaker={...baker,permissions:{'bakkerij.ijs_chocolade':true}};
 assert.deepEqual(Array.from(rights.productionDepartments(iceBaker)),['ijs','chocolade']);
 assert(!rights.productionDepartments(baker).includes('ijs'));
 assert(!rights.productionDepartments(baker).includes('chocolade'));
 for(const denied of [{...screen,active:false},{...screen,role:'winkel',permissions:{}},logistics,shop])assert.equal(rights.productionDepartments(denied).length,0);
 assert.equal(access.hasFullAccess(screen),false);
 assert.equal(access.canAccessPath(screen,'/bakkerij/productie/beheer/recepten'),false);
 assert.equal(access.canAccessPath(screen,'/management/dashboard'),false);
 const current=planner(),incoming=structuredClone(current);
 incoming.items.push({...item,id:'ice',name:'IJs',departmentId:'ijs'});
 incoming.tasks.push({id:'ice-task',itemId:'ice',departmentId:'ijs',date:'2026-11-09',quantity:10,status:'planned',batchId:'ice-batch',operation:'Maken',source:'manual',recordsOutput:true,note:''});
 assert.equal(rights.mergeWorkspaceForEmployee(current,incoming,rights.productionDepartments(screen)),incoming);
 assert.throws(()=>rights.mergeWorkspaceForEmployee(current,incoming,rights.productionDepartments(baker)),/eigen productieafdeling/);
});
function supplierApi(who,options={}){
 let doc={revision:1,suppliers:[{...suppliers.defaultSuppliers[0],username:'shared-user',password:'TEST-PRIVATE-SECRET'}]},reads=0,writes=0;
 const api=load('app/api/leveranciers/route.ts',{'@/app/lib/auth/session':{getCurrentProfile:async()=>who},'@/app/lib/auth/access':access,'@/app/productie/documents.server':{ProductionStoreError:StoreError},'@/app/productie/operationalStore.server':{readOperational:async()=>{reads++;return doc;},saveOperational:async(key,revision,next,actor)=>{assert.equal(key,suppliers.SUPPLIER_KEY);assert.equal(revision,doc.revision);assert.equal(actor,who.id);if(options.conflict)throw new StoreError('conflict',409);doc=next;writes++;}},'@/app/leveranciers/model':suppliers});
 return{api,doc:()=>doc,reads:()=>reads,writes:()=>writes};
}
test('supplier ordinary responses redact passwords; revealing one credential requires the same approved authenticated role',async()=>{
 for(const who of [manager,baker,logistics]){const h=supplierApi(who),response=await h.api.GET();assert.equal(response.status,200);assert.match(response.headers.get('Cache-Control'),/no-store/);const text=await response.text();assert(!text.includes('TEST-PRIVATE-SECRET'));assert(text.includes('hasPassword'));
 const reveal=await h.api.POST(post('/api/leveranciers',{kind:'reveal',id:'beko'}));assert.equal(reveal.status,200);assert.equal((await reveal.json()).password,'TEST-PRIVATE-SECRET');assert.equal(h.writes(),0);}
 for(const who of [null,shop,{...baker,active:false}]){const h=supplierApi(who);assert.equal((await h.api.GET()).status,403);assert.equal((await h.api.POST(post('/api/leveranciers',{kind:'reveal',id:'beko'}))).status,403);assert.equal(h.reads(),0);}
});
test('supplier updates preserve a blank password, redact save responses, reject stale/origin conflicts and support clearing/archiving',async()=>{
 const h=supplierApi(baker),input={...h.doc().suppliers[0],password:'',name:'Beko gewijzigd'};
 let response=await h.api.POST(post('/api/leveranciers',{kind:'save',revision:1,supplier:input}));assert.equal(response.status,200);assert(!JSON.stringify(await response.json()).includes('TEST-PRIVATE-SECRET'));assert.equal(h.doc().suppliers[0].password,'TEST-PRIVATE-SECRET');assert.equal(h.doc().suppliers[0].updatedBy,baker.email);
 assert.equal((await h.api.POST(post('/api/leveranciers',{kind:'save',revision:1,supplier:input}))).status,409);assert.equal(h.writes(),1);
 assert.equal((await h.api.POST(post('/api/leveranciers',{kind:'reveal',id:'beko'},'https://elsewhere.invalid'))).status,403);
 response=await h.api.POST(post('/api/leveranciers',{kind:'save',revision:2,supplier:{...input,clearPassword:true,archived:true}}));assert.equal(response.status,200);assert.equal(h.doc().suppliers[0].password,'');assert.equal((await h.api.POST(post('/api/leveranciers',{kind:'reveal',id:'beko'}))).status,400);
 const conflict=supplierApi(baker,{conflict:true});assert.equal((await conflict.api.POST(post('/api/leveranciers',{kind:'save',revision:1,supplier:input}))).status,409);assert.equal(conflict.writes(),0);
});
test('supplier links allow HTTPS SPA login pages while refusing embedded credentials, scripts and credential query parameters',()=>{
 assert.equal(suppliers.supplierUrl('https://supplier.invalid/#/login'),'https://supplier.invalid/#/login');
 for(const url of ['javascript:alert(1)','http://supplier.invalid/','https://user:password@supplier.invalid/','https://supplier.invalid/?Password=secret'])assert.throws(()=>suppliers.supplierUrl(url));
 assert(suppliers.defaultSuppliers.every(s=>!s.username&&!s.password));
});
test('Hefe always opens the existing local mail-order page, including older saved webshop links',()=>{
 const old={revision:1,suppliers:[{...suppliers.defaultSuppliers.find(s=>s.id==='hefe'),url:'https://restaurant.chefslist.de/'}]};
 assert.equal(suppliers.supplierViews(old)[0].url,suppliers.HEFE_ORDER_PATH);
 assert.equal(old.suppliers[0].url,'https://restaurant.chefslist.de/');
 const next=suppliers.changeSupplier(old,{...old.suppliers[0],url:'https://other.invalid/'},'baker','now');
 assert.equal(next.suppliers[0].url,suppliers.HEFE_ORDER_PATH);
});
test('inventory import accepts final snapshots only, deduplicates receipts, preserves exact article variants and stores no customer or price data',()=>{
 assert.equal(inventory.dispatchDay(batch(undefined,undefined,{status:'prognose'})),null);
 const source=batch();source.receipts.push(structuredClone(source.receipts[0]));source.receipts[0].lines.push({articleNumber:'101.02',quantity:'1,5',description:'Variant'});
 const data=inventory.dispatchDay(source);assert.equal(data.lines.find(l=>l.article==='101.01').quantity,10);assert.equal(data.lines.find(l=>l.article==='101.02').quantity,1.5);assert(!JSON.stringify(data).includes('PRIVATE'));
 const corrected=inventory.dispatchDay(batch('2026-11-05','12',{importedAt:'2026-11-06T09:00:00Z'}));
 const merged=inventory.mergeDispatchDays([data],[corrected,data]);assert.equal(merged.length,1);assert.equal(merged[0].lines[0].quantity,12);
});
test('unreadable quantities and missing article numbers are explicit gaps, while negative correction lines remain signed',()=>{
 for(const value of ['?','1.000','', '1000001']){const data=inventory.dispatchDay(batch('2026-11-05',value));assert.equal(data.unknownLines,1);assert.equal(data.lines.length,0);}
 assert.equal(inventory.dispatchDay(batch('2026-11-05','-2')).lines[0].quantity,-2);
 const source=batch();source.receipts[0].lines[0].articleNumber='';assert.equal(inventory.dispatchDay(source).unknownLines,1);
});
test('quarterly counts accept zero, preserve audit and history, reject invalid data, and repeated action IDs are idempotent',()=>{
 const command={kind:'count',date:'2026-11-05',who:' Proefbakker ',entries:[{itemId:item.id,quantity:0}]};
 const first=inventory.applyInventory(inventory.emptyInventory(),command,[item],'trusted-id','action-1','2026-11-05T20:00:00Z','2026-11-06');
 assert.equal(first.counts[0].quantity,0);assert.equal(first.counts[0].who,'Proefbakker');assert.equal(first.counts[0].actorId,'trusted-id');assert.equal(first.counts[0].unit,'stuks');
 assert.equal(inventory.applyInventory(first,command,[item],'forged','action-1','later','2026-11-06'),first);
 const second=inventory.applyInventory(first,{...command,entries:[{itemId:item.id,quantity:12}]},[item],'trusted-id','action-2','2026-11-05T21:00:00Z','2026-11-06');assert.equal(second.counts.length,2);
 assert.equal(inventory.inventoryOverview(planner(),second,[],'2026-11-06').rows[0].count.quantity,12);
 for(const override of [{date:'2026-11-07'},{who:''},{entries:[]},{entries:[{itemId:item.id,quantity:-1}]},{entries:[{itemId:'missing',quantity:1}]},{entries:[command.entries[0],command.entries[0]]}])assert.throws(()=>inventory.applyInventory(first,{...command,...override},[item],'trusted','new-id','2026-11-06T10:00:00Z','2026-11-06'));
});
test('article mapping is exact, uses an explicit unit conversion and disallows double deductions from one article',()=>{
 const state=inventory.applyInventory(inventory.emptyInventory(),{kind:'link',itemId:item.id,article:' 101.01 ',factor:2,leadDays:3},[item],'a','map-1','now','2026-11-06');assert.equal(state.links[0].article,'101.01');
 const other={...item,id:'other'};assert.throws(()=>inventory.applyInventory(state,{kind:'link',itemId:'other',article:'101.01',factor:1,leadDays:0},[item,other],'a','map-2','now','2026-11-06'),/ander voorraadproduct/);
 const count=counted();count.links[0].factor=2;const row=inventory.inventoryOverview(planner(),count,days28(),'2026-11-06').rows[0];assert.equal(row.issued,56);assert.equal(row.balance,-6);
});
test('stock uses confirmed actual output once per batch after an end-of-day baseline, and reopening removes that output',()=>{
 const p=planner(),task={id:'t1',itemId:item.id,departmentId:'dessert',batchId:'b1',quantity:100,completedQuantity:8,recordsOutput:true,status:'done',date:'2026-10-20'};p.tasks=[task,{...task,id:'t2'}];
 p.productionWork={completions:{t1:{at:'2026-10-21T06:00:00Z'}}};
 let row=inventory.inventoryOverview(p,counted(),days28(),'2026-11-06').rows[0];assert.equal(row.made,8);assert.equal(row.balance,30);assert.equal(row.latest.date,'2026-10-21');
 p.tasks.forEach(t=>t.status='planned');row=inventory.inventoryOverview(p,counted(),days28(),'2026-11-06').rows[0];assert.equal(row.made,0);assert.equal(row.latest,null);
});
test('forecast requires a count, exact mapping and 28 complete days; it still works before today\'s closing report arrives',()=>{
 const row=inventory.inventoryOverview(planner(),counted(),days28(),'2026-11-06').rows[0];assert.equal(row.through,'2026-11-05');assert.equal(row.known,true);assert.equal(row.balance,22);assert.equal(row.productionWeek.date,'2026-11-25');
 for(const missing of [days28().slice(1),days28().map((d,i)=>i===10?{...d,unknownLines:1}:d)]){const r=inventory.inventoryOverview(planner(),counted(),missing,'2026-11-06').rows[0];assert.equal(r.known,false);assert.equal(r.productionWeek,null);assert(r.missingDays>0);}
 for(const state of [{...counted(),counts:[]},{...counted(),links:[]},{...counted(),counts:counted().counts.map(c=>({...c,unit:'kg'}))}])assert.equal(inventory.inventoryOverview(planner(),state,days28(),'2026-11-06').rows[0].productionWeek,null);
});
test('stock-use checkpoints expose the remaining physical stock and never count as manufactured output or a day-total forecast',()=>{
 const p=planner(),stockAt='2026-11-06T08:00:00Z';
 p.tasks=[{id:'stock-task',itemId:item.id,departmentId:'dessert',batchId:'stock-batch',quantity:10,recordsOutput:true,status:'done',date:'2026-11-06',stockFulfillmentId:'stock-action'}];
 p.productionWork={stockFulfillments:{'stock-task':{id:'stock-action',taskId:'stock-task',itemId:item.id,unit:item.unit,countedQuantity:25,quantity:10,remainingQuantity:15,who:'Bakker A',actorId:baker.id,at:stockAt}}};
 let row=inventory.inventoryOverview(p,counted(),[...days28(),day('2026-11-06',20)],'2026-11-06').rows[0];
 assert.equal(row.count.quantity,15);assert.equal(row.balance,15);assert.equal(row.issued,0,'the checkpoint day report includes goods already counted and is not subtracted in full');assert.equal(row.made,0);assert.equal(row.latest,null);assert.equal(row.checkpoint,true);assert.equal(row.known,false);assert.equal(row.productionWeek,null);
 assert.equal(inventory.inventoryCounts(p,counted()).at(-1).stockUse.countedQuantity,25);
 p.tasks.push({...p.tasks[0],id:'made-before',batchId:'before',stockFulfillmentId:undefined,quantity:100},{...p.tasks[0],id:'made-after',batchId:'after',stockFulfillmentId:undefined,quantity:3});
 p.productionWork.completions={'made-before':{at:'2026-11-06T07:00:00Z'},'made-after':{at:'2026-11-06T09:00:00Z'}};
 row=inventory.inventoryOverview(p,counted(),[],'2026-11-06').rows[0];assert.equal(row.made,3);assert.equal(row.balance,18);
 const backfilled=counted(999);backfilled.counts[0].at='2026-11-07T20:00:00Z';
 assert.equal(inventory.inventoryOverview(p,backfilled,[],'2026-11-06').rows[0].count.quantity,15,'an older end-of-day count entered later must not overwrite a newer physical checkpoint');
 const closing=counted(18);closing.counts[0].date='2026-11-06';closing.counts[0].at='2026-11-07T20:00:00Z';
 row=inventory.inventoryOverview(p,closing,[],'2026-11-06').rows[0];assert.equal(row.count.quantity,18);assert.equal(row.balance,18);assert.equal(row.checkpoint,false);assert.equal(row.known,true,'a later end-of-day baseline resolves the intraday reporting gap');
});
test('equal-time stock checkpoints use durable history order even after JSONB reorders map keys',()=>{
 const p=planner(),at='2026-11-06T08:00:00.000Z';
 const older={id:'stock-old',taskId:'zz',itemId:item.id,unit:item.unit,countedQuantity:100,quantity:10,remainingQuantity:90,who:'Bakker A',actorId:baker.id,at};
 const newer={...older,id:'stock-new',taskId:'aa',countedQuantity:90,remainingQuantity:80};
 p.productionWork={stockFulfillments:{aa:newer,zz:older},history:[{id:older.id},{id:newer.id}]};
 const row=inventory.inventoryOverview(p,inventory.emptyInventory(),[],'2026-11-06').rows[0];
 assert.equal(row.count.id,newer.id);assert.equal(row.count.quantity,80);
});
function inventoryApi(who,options={}){
 const p=planner();let doc=inventory.emptyInventory(),writes=0,archives=0,reads=0;
 const api=load('app/api/productie/voorraad/route.ts',{'@/app/lib/auth/session':{getCurrentProfile:async()=>who},'@/app/productie/access':rights,'@/app/productie/documents.server':{ProductionStoreError:StoreError,readDocument:async key=>{reads++;return{data:key==='planner'?p:{ingredients:[],recipes:[]}};}},'@/app/productie/operationalStore.server':{readOperational:async()=>doc,saveOperational:async(key,revision,next,actor)=>{assert.equal(key,inventory.INVENTORY_KEY);assert.equal(actor,who.id);if(options.conflict)throw new StoreError('conflict',409);assert.equal(revision,doc.revision);doc=next;writes++;}},'@/app/productie/inventory':inventory,'@/app/productie/inventorySource.server':{inventoryDispatchDays:async()=>days28(),archiveInventoryDays:async days=>{archives++;assert.equal(days.length,28);}},'@/app/productie/workspaceData':{...workspace,todayAmsterdam:()=>'2026-11-06'}});
 return{api,writes:()=>writes,archives:()=>archives,reads:()=>reads,planner:p,doc:()=>doc};
}
const countBody={id:'count-action-1',revision:0,command:{kind:'count',date:'2026-11-05',who:'Proefbakker',entries:[{itemId:item.id,quantity:20}]}};
test('stock API guards roles/origin and saves only its own document with history, CAS and retry protection',async()=>{
 for(const who of [null,shop,logistics,{...baker,active:false}]){const h=inventoryApi(who);assert.equal((await h.api.GET()).status,403);assert.equal((await h.api.POST(post('/api/productie/voorraad',countBody))).status,403);assert.equal(h.reads(),0);}
 const h=inventoryApi(baker),before=plain(h.planner);let response=await h.api.GET();assert.equal(response.status,200);assert.equal(h.writes(),0);assert.equal(h.archives(),0,'GET stays read-only');
 response=await h.api.POST(post('/api/productie/voorraad',countBody));assert.equal(response.status,200);assert.equal(h.writes(),1);assert.equal(h.archives(),1);assert.deepEqual(plain(h.planner),before);assert.equal(h.doc().counts[0].actorId,baker.id);
 assert.equal((await h.api.POST(post('/api/productie/voorraad',countBody))).status,200);assert.equal(h.writes(),1);assert.equal(h.archives(),1);
 assert.equal((await h.api.POST(post('/api/productie/voorraad',{...countBody,id:'new-action-2'}))).status,409);assert.equal((await h.api.POST(post('/api/productie/voorraad',countBody,'https://foreign.invalid'))).status,403);
 const conflict=inventoryApi(baker,{conflict:true});assert.equal((await conflict.api.POST(post('/api/productie/voorraad',countBody))).status,409);assert.equal(conflict.writes(),0);
});
test('the inventory API reads task stock-use checkpoints directly from the atomic planner ledger',async()=>{
 const h=inventoryApi(baker);
 h.planner.productionWork={stockFulfillments:{task:{id:'stock-100',taskId:'task',itemId:item.id,unit:item.unit,countedQuantity:25,quantity:10,remainingQuantity:15,who:'Bakker A',actorId:baker.id,at:'2026-11-06T08:00:00Z'}}};
 const response=await h.api.GET(),data=await response.json();
 assert.equal(response.status,200);assert.equal(data.rows[0].count.quantity,15);assert.equal(data.rows[0].checkpoint,true);assert.equal(data.history[0].stockUse.quantity,10);assert.equal(data.history[0].actorId,baker.id);assert.equal(h.writes(),0);assert.equal(h.archives(),0);
});
test('monthly dispatch archive preserves corrected days, retries CAS conflicts and backfills once without storing raw receipts',async()=>{
 const docs=new Map();let conflicts=1,writes=0;
 const source=load('app/productie/inventorySource.server.ts',{'server-only':{},'../lib/supabase/admin':{},'./inventory':inventory,'./documents.server':{ProductionStoreError:StoreError},'./operationalStore.server':{readOperational:async(key,empty)=>docs.get(key)||empty,saveOperational:async(key,revision,next)=>{if(conflicts-->0)throw new StoreError('conflict',409);docs.set(key,next);writes++;}}});
 await source.archiveInventoryDispatch(batch());assert.equal(writes,1);await source.archiveInventoryDispatch(batch());assert.equal(writes,1);
 await source.archiveInventoryDispatch(batch('2026-11-05','12',{importedAt:'2026-11-06T09:00:00Z'}));assert.equal(writes,2);assert.equal(docs.get(inventory.DISPATCH_PREFIX+'2026-11').days[0].lines[0].quantity,12);
 await source.archiveInventoryDays(days28());assert.equal(docs.size,2);const after=writes;await source.archiveInventoryDays(days28());assert.equal(writes,after);assert(!JSON.stringify([...docs.values()]).includes('PRIVATE'));
});

test('logistics imports archive the saved merged batch; dry runs and denied callers never mutate inventory, and archive failure requests a safe retry',async()=>{
 function harness(options={}){let writes=0,archives=0,parses=0;
  const api=load('app/api/bakkerij-logistiek/import/route.ts',{
   'next/server':{NextResponse:{json:Response.json}},'@/app/bakkerij/logistiek/bakeItContantbonParser':{parseBakeItContantbonPdf:async()=>{parses++;return batch();}},
   '@/app/bakkerij/logistiek/catalogMatching':{withCatalogArticleNumbers:value=>value},'@/app/lib/bakeryLogisticsAuth':{canAccessLogisticsRequest:async()=>!options.denied},
   '@/app/productie/inventorySource.server':{archiveInventoryDispatch:async value=>{archives++;assert.equal(value.merged,true);if(options.failArchive)throw Error('archive down');}},
   '@/app/lib/bakeryLogisticsStorage':{mergeLogisticsBatches:a=>a,upsertLogisticsBatch:async value=>{writes++;return{...value,merged:true};}},
  });return{api,writes:()=>writes,archives:()=>archives,parses:()=>parses};
 }
 const request=(dry=false)=>post('/api/bakkerij-logistiek/import'+(dry?'?dryRun=1':''),{fileName:'bon.pdf',attachmentBase64:Buffer.from('test-pdf').toString('base64')});
 const dry=harness();assert.equal((await dry.api.POST(request(true))).status,200);assert.equal(dry.writes(),0);assert.equal(dry.archives(),0);
 const denied=harness({denied:true});assert.equal((await denied.api.POST(request())).status,403);assert.equal(denied.parses(),0);assert.equal(denied.archives(),0);
 const good=harness();assert.equal((await good.api.POST(request())).status,200);assert.equal(good.writes(),1);assert.equal(good.archives(),1);
 const failure=harness({failArchive:true}),response=await failure.api.POST(request());assert.equal(response.status,502);assert.match((await response.json()).message,/Bonnen zijn opgeslagen.*opnieuw in/);assert.equal(failure.writes(),1);
});
