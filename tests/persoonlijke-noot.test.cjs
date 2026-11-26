const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function load(file,imports={},globals={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{esModuleInterop:true,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,Date,Map,Set,Intl,console,Buffer,Request,Response,...globals,require:n=>{assert(n in imports,n);return imports[n];}});return exports;}
const base='app/winkel/persoonlijke-noot/';
const model=load(base+'model.ts');
const csv=load(base+'csv.ts',{'papaparse':require('papaparse'),'./model':model});
const access=load('app/lib/auth/access.ts');
const policy=load(base+'access.ts',{'../../lib/auth/access':access,'./model':model});
const input=(patch={})=>({edition:'2026',orderNumber:'PN001',lineNumber:'',name:'Voorbeeld klant',product:'Kerststol',quantity:2,store:'lent',pickupDate:'2026-12-23',reference:'26-11-2026',notes:'',unitPriceEx:9.95,...patch});
const order=(patch={})=>({...input(),id:'a'.repeat(64),revision:1,importedAt:'2026-11-26T08:00:00Z',sourceName:'voorbeeld.csv',collectedAt:null,collectedBy:'',cancelled:false,invoiceNumber:'',invoicedAt:null,events:[],...patch});
const profile=(patch={})=>({id:'u1',active:true,role:'winkel',store:'lent',email:'winkel@example.test',permissions:{},full_name:'Winkel Lent',...patch});
test('CSV handles Dutch separator, quoted multiline text and comma prices without inventing dates',()=>{
 const parsed=csv.parseCsv('\uFEFFBestelnummer;Naam;Product;Aantal;Afhaalwinkel;Opmerkingen;Stuksprijs excl btw\r\n001;Test;"Stol; luxe";2;Lent;"Regel 1\nRegel 2";9,95');
 const result=csv.mapCsv(parsed,csv.suggestMapping(parsed.headers),{edition:'2026',reference:'26-11-2026',store:''});
 assert.equal(result.errors.length,0);assert.equal(result.orders[0].orderNumber,'001');assert.equal(result.orders[0].notes,'Regel 1\nRegel 2');assert.equal(result.orders[0].pickupDate,'');assert.equal(result.orders[0].unitPriceEx,9.95);
});
test('CSV refuses invalid quantities/dates, unknown stores and ambiguous duplicate lines',()=>{
 for(const values of [['0','Lent',''],['2','Onbekend',''],['2','Lent','31-02-2026']]){
 const data=csv.parseCsv('Bestelnummer;Naam;Product;Aantal;Winkel;Afhaaldatum\n1;Test;Stol;'+values.join(';'));
 assert.equal(csv.mapCsv(data,csv.suggestMapping(data.headers),{edition:'2026',reference:'26-11-2026',store:''}).errors.length,1);
 }
 const data=csv.parseCsv('Bestelnummer;Naam;Product;Aantal\n1;A;Stol;1\n1;A;Stol;1');
 assert.match(csv.mapCsv(data,csv.suggestMapping(data.headers),{edition:'2026',reference:'x',store:''}).errors[0],/Dubbel/);
 assert.throws(()=>csv.parseCsv('<html>link expired</html>'),/geen CSV/);
 assert.throws(()=>csv.parseCsv('A;A\nx;y'),/unieke kolomkop/);
});
test('collection is idempotent, audited, reversible and protected after invoicing',()=>{
 const picked=model.changePickup(order(),'collect','Winkel Lent','2026-11-26T09:10:00Z');
 assert.equal(picked.events.length,1);assert.equal(picked.collectedBy,'Winkel Lent');
 assert.equal(model.changePickup(picked,'collect','Other','later'),picked);
 assert.equal(model.changePickup(picked,'undo','Winkel Lent','later').collectedAt,null);
 assert.throws(()=>model.changePickup({...picked,invoiceNumber:'F001'},'undo','x','later'),/factuur/);
 assert.throws(()=>model.changePickup(order({store:''}),'collect','x','later'),/winkel/);
 assert.throws(()=>model.changePickup(order({cancelled:true}),'collect','x','later'),/annulering/);
});
test('invoice counts only actual pickups and distinguishes units from complete orders',()=>{
 const rows=[order({collectedAt:'2026-11-26T09:10:00Z'}),order({id:'b',product:'Bonbons'}),order({orderNumber:'PN002',quantity:50,cancelled:true,collectedAt:'2026-11-26T09:10:00Z'})];
 const result=model.totals(rows);assert.equal(result.orders,1);assert.equal(result.collectedOrders,0);assert.equal(result.collectedUnits,2);assert.equal(result.toInvoice,2);assert.equal(result.totalEx,19.9);
 const exported=model.invoiceCsv(rows);assert.equal(exported.split('\r\n').length,2);assert(!exported.includes('PN002'));assert(exported.includes('19,90'));
 assert.equal(model.csvCell('=HYPERLINK("evil")'),'"\'=HYPERLINK(""evil"")"');
 assert.equal(model.localDate('2026-11-30T23:30:00Z'),'2026-12-01');
});
test('only authorized stores can read; management/logistics can coordinate',()=>{
 assert.equal(policy.canViewNo(profile({active:false})),false);
 assert.equal(policy.canViewNo(profile({role:'medewerker',store:''})),false);
 assert.equal(policy.canManageNo(profile()),false);
 assert.deepEqual([...policy.allowedNoStores(profile())],['lent']);
 assert.equal(policy.canManageNo(profile({role:'logistiek'})),true);
 assert.equal(access.canAccessPath(profile({role:'logistiek'}),'/winkel/persoonlijke-noot'),true);
});
function server(db){return load(base+'server.ts',{'server-only':{},'node:crypto':require('node:crypto'),'../../lib/supabase/admin':{createAdminClient:()=>db},'../../lib/auth/access':access,'./access':policy,'./model':model});}
test('repeat imports do not overwrite pickup, invoice or edited store data',async()=>{
 const rows=new Map(),db={from:()=>({upsert:(list,options)=>({select:async()=>{assert.equal(options.ignoreDuplicates,true);const data=[];for(const r of list){if(!rows.has(r.id)){rows.set(r.id,r);data.push({id:r.id});}}return {data,error:null};}}),select:()=>({in:async(_,ids)=>({data:ids.map(id=>rows.get(id)),error:null})})})};
 const s=server(db),manager=profile({role:'admin'});const first=await s.importOrders(manager,[input()],'a.csv');assert.equal(first.added,1);
 const row=[...rows.values()][0];row.data.collectedAt='2026-11-26T09:10:00Z';row.data.invoiceNumber='F001';
 const second=await s.importOrders(manager,[input()],'b.csv');assert.equal(second.added,0);assert.equal(second.unchanged,1);assert.equal(row.data.invoiceNumber,'F001');
 const changed=await s.importOrders(manager,[input({quantity:3})],'c.csv');assert.equal(changed.conflicts.length,1);assert.equal(row.data.quantity,2);
 await assert.rejects(s.importOrders(profile(),[input()],'x'),/management/);
});
test('pickup API checks store authorization and detects stale revisions before writing',async()=>{
 const db={from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:{id:'a'.repeat(64),revision:2,data:order()},error:null})})})})};const s=server(db);
 await assert.rejects(s.updateOrder(profile({store:'heyendaal'}),{id:'a'.repeat(64),revision:2,action:'collect'}),/Geen toegang/);
 await assert.rejects(s.updateOrder(profile(),{id:'a'.repeat(64),revision:1,action:'collect'}),/zojuist aangepast/);
});
const supplier=load(base+'supplierCsv.ts',{'./csv':csv,'./model':model});
const supplierExample=fs.readFileSync('tests/fixtures/persoonlijke-noot-voorbeeld.csv','utf8');
const realCsv=(patch={})=>{
 const row={order_number:'000123',code:'C0001',firstname:'Anne',middlename:'van',lastname:'Dijk',email:'anne@example.test',sku:'Strik Patisserie cadeaukaart t.w.v. 50',qty:'1',product:'Strik Patisserie cadeaukaart',option:'E: Strik Patisserie Heyendaalseweg',ean:'',...patch};
 return supplier.supplierHeaders.join(';')+'\n'+supplier.supplierHeaders.map(k=>model.csvCell(row[k])).join(';');
};
const supplierOptions={edition:'2026',orderDate:'2026-11-26',sourceName:'bestelling.csv'};
test('actual supplier attachment is recognized as a sample with correct card and agreed invoice price',()=>{
 const result=supplier.parseSupplierCsv(supplierExample,supplierOptions);
 assert.equal(result.errors.length,0);assert.equal(result.sample,true);assert.equal(result.orders.length,1);
 const o=result.orders[0];assert.equal(o.product,'Cadeaukaart €50,00');assert.equal(o.store,'heyendaal');assert.equal(o.quantity,1);assert.equal(o.unitPriceEx,36.7);assert.equal(o.pickupDate,'2026-11-30');assert.equal(o.pickupDateKind,'from');
});
test('supplier combines names, preserves identifiers, maps addresses and does not guess unknown stores',()=>{
 const cases=[['A: Strik Patisserie Ziekerstraat','ziekerstraat'],['Oranje Marieplein 11','lent'],['Daalseweg 254','daalseweg'],['Heyendaalseweg 217','heyendaal']];
 for(const [option,store] of cases){const r=supplier.parseSupplierCsv(realCsv({option}),supplierOptions);assert.equal(r.errors.length,0);assert.equal(r.orders[0].store,store);assert.equal(r.orders[0].name,'Anne van Dijk');assert.equal(r.orders[0].orderNumber,'000123');assert.equal(r.orders[0].customerCode,'C0001');assert.equal(r.sample,false);}
 assert.equal(supplier.parseSupplierCsv(realCsv({option:'Markt 1A Wijchen'}),supplierOptions).errors.length,1);
 assert.equal(supplier.parseSupplierCsv(realCsv({qty:'1,5'}),supplierOptions).errors.length,1);
 assert.equal(supplier.parseSupplierCsv(realCsv({sku:'Onbekende bon'}),supplierOptions).errors.length,1);
});
test('invoice rates are season-specific and separate from face value',()=>{
 for(const [value,price] of [['17,50',12.84],['25',18.35],['45',33.03],['50',36.7]])assert.equal(supplier.parseSupplierCsv(realCsv({sku:'Strik Patisserie cadeaukaart t.w.v. '+value}),supplierOptions).orders[0].unitPriceEx,price);
 for(const opts of [{...supplierOptions,edition:'2027'},supplierOptions]){const r=supplier.parseSupplierCsv(realCsv({sku:'Strik Patisserie cadeaukaart t.w.v. 60'}),opts);assert.equal(r.orders[0].unitPriceEx,null);assert.equal(r.warnings.length,1);}
 assert.equal(supplier.parseSupplierCsv(realCsv(),{...supplierOptions,edition:'2027'}).orders[0].unitPriceEx,null);
});
test('pickup starts two working days later and January-April remains the previous season',()=>{
 assert.equal(supplier.availableFrom('2026-11-27'),'2026-12-01');
 assert.equal(supplier.availableFrom('2026-12-24'),'2026-12-29');
 assert.equal(supplier.availableFrom('2026-12-31'),'2027-01-05');
 assert.equal(supplier.seasonForDate('2027-01-07'),'2026');assert.equal(supplier.seasonForDate('2027-04-30'),'2026');assert.equal(supplier.seasonForDate('2027-11-01'),'2027');
});
test('stable source IDs survive row reordering but ambiguous duplicate source lines are rejected',()=>{
 const first=realCsv();const second=realCsv({code:'C0002'}).split('\n')[1];
 const r=supplier.parseSupplierCsv(first+'\n'+second,supplierOptions),reversed=supplier.parseSupplierCsv(first.split('\n')[0]+'\n'+second+'\n'+first.split('\n')[1],supplierOptions);
 assert.equal(r.orders.length,2);assert.equal(model.identity(r.orders[0]),model.identity(reversed.orders[1]));
 assert.equal(supplier.parseSupplierCsv(first+'\n'+first.split('\n')[1],supplierOptions).errors.length,1);
});
function mailRoute(persist,saveStatus,env={LOGISTICS_IMPORT_KEY:'private-test-key'}) {
 return load('app/api/persoonlijke-noot/mail-import/route.ts',{'node:crypto':require('node:crypto'),'../../../winkel/persoonlijke-noot/supplierCsv':supplier,'../../../winkel/persoonlijke-noot/model':model,'../../../winkel/persoonlijke-noot/server':{PickupError:class extends Error{},importMailOrders:persist},'../../../winkel/persoonlijke-noot/importStatus':{writeImportStatus:saveStatus}},{process:{env}});
}
const request=(body,key='private-test-key')=>new Request('https://example.test/api/persoonlijke-noot/mail-import',{method:'POST',headers:{'content-type':'application/json','x-strik-logistics-key':key},body:JSON.stringify(body)});
test('mail endpoint fails closed without configured key, and never persists sample or dry-run data',async()=>{
 let persisted=0;const statuses=[];const route=mailRoute(async()=>{persisted++;return {added:1,unchanged:0,conflicts:[]};},async s=>statuses.push(s));
 for(const key of ['','wrong'])assert.equal((await route.POST(request({},key))).status,403);
 assert.equal((await mailRoute(()=>assert.fail(),()=>assert.fail(),{}).POST(request({}))).status,403);
 const sample=await (await route.POST(request({csv:supplierExample,sourceName:'any.csv',orderDate:'2026-11-26'}))).json();
 assert.equal(sample.sample,true);assert.equal(sample.dryRun,true);assert.equal(persisted,0);assert.equal(statuses[0].testPassed,true);
 const dry=await (await route.POST(request({csv:realCsv(),sourceName:'orders.csv',orderDate:'2026-11-26',dryRun:true}))).json();assert.equal(dry.dryRun,true);assert.equal(persisted,0);
 const real=await (await route.POST(request({csv:realCsv(),sourceName:'orders.csv',orderDate:'2026-11-26'}))).json();assert.equal(real.added,1);assert.equal(persisted,1);
 const invalid=await route.POST(request({csv:realCsv({option:'Unknown'}),sourceName:'orders.csv',orderDate:'2026-11-26'}));assert.equal(invalid.status,422);assert.equal(persisted,1);
});
test('Gmail importer retries, preserves review state, labels sample and never follows links',()=>{
 const props=new Map(),calls=[],labels=new Set();let archived=0,inbox=0,mode='fail';
 const file={getName:()=> 'order.csv',getBytes:()=>[1],getDataAsString:()=>realCsv()};
 const message={getFrom:()=> 'Orders <bestellingen@persoonlijkenoot.nl>',getId:()=> 'm1',getSubject:()=> 'Nieuwe bestelling 26-11-2026',getDate:()=>new Date('2026-11-26T10:00:00Z'),getPlainBody:()=> 'Bestelling',getAttachments:()=>[file]};
 const thread={getMessages:()=>[message],addLabel:l=>labels.add(l),removeLabel:l=>labels.delete(l),moveToArchive:()=>archived++,moveToInbox:()=>inbox++};
 const context={console,Date,Logger:{log:()=>{}},WEBSHOP_IMAGE_CONFIG:{IMPORT_KEY:'private-test-key'},LockService:{getScriptLock:()=>({tryLock:()=>true,releaseLock:()=>{}})},PropertiesService:{getScriptProperties:()=>({getProperty:k=>props.get(k),setProperty:(k,v)=>props.set(k,v)})},Utilities:{formatDate:()=> '2026-11-26'},GmailApp:{search:()=>[thread],getUserLabelByName:n=>n,createLabel:n=>n},UrlFetchApp:{fetch:(url,options)=>{const body=JSON.parse(options.payload);calls.push(body);if(body.action==='check')return {getResponseCode:()=>200,getContentText:()=>JSON.stringify({ok:true})};if(mode==='fail')throw Error('Tijdelijke netwerkfout');return {getResponseCode:()=>200,getContentText:()=>JSON.stringify({ok:true,complete:true,sample:mode==='sample',added:1,unchanged:0})};}}};
 vm.createContext(context);vm.runInContext(fs.readFileSync('app/scripts/gmail-persoonlijke-noot-import.gs','utf8'),context);
 context.importPersoonlijkeNoot();assert.equal(inbox,1);assert.equal(archived,0);assert(labels.has('Persoonlijke Noot controleren'));
 const retryKey='pn-csv-v1:m1';assert.equal(JSON.parse(props.get(retryKey)).attempts,1);
 context.importPersoonlijkeNoot();assert.equal(calls.filter(b=>b.csv).length,1);
 props.set(retryKey,JSON.stringify({attempts:1,next:0}));mode='ok';context.importPersoonlijkeNoot();assert.equal(archived,1);assert.equal(props.get(retryKey),'done');assert(!labels.has('Persoonlijke Noot controleren'));
 context.importPersoonlijkeNoot();assert.equal(calls.filter(b=>b.csv).length,2);
 props.delete(retryKey);mode='sample';context.importPersoonlijkeNoot();assert.equal(archived,1);assert(labels.has('Persoonlijke Noot test'));
 props.delete(retryKey);message.getAttachments=()=>[];message.getPlainBody=()=> 'Download CSV';context.importPersoonlijkeNoot();assert.equal(props.get(retryKey),'review');assert.equal(calls.filter(b=>b.csv).length,3);
});
