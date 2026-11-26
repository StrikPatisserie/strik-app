const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function load(file,imports={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{esModuleInterop:true,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,Date,Map,Set,Intl,console,Buffer,require:n=>{assert(n in imports,n);return imports[n];}});return exports;}
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
