const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
function loader(){const cache={};return function load(file){file=path.resolve(file);if(cache[file])return cache[file];const exports=cache[file]={};let source=fs.readFileSync(file,'utf8');if(file.endsWith('SinterklaasB2BClient.tsx'))source+='\nexport {workOverviewEntry};';vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,Intl,Date,Map,Set,URL,URLSearchParams,process:{env:{}},require(name){if(name.endsWith('.css'))return{default:{}};if(name==='next/link'||name==='next/image')return{default:'a'};if(name.startsWith('.')||name.startsWith('@/')){const base=name.startsWith('@/')?path.resolve(name.slice(2)):path.resolve(path.dirname(file),name),target=['.ts','.tsx'].map(ext=>base+ext).find(fs.existsSync);if(target)return load(target);}return require(name);}});return exports;};}
const load=loader(),work=load('app/sinterklaas/b2b/workOverview.ts'),api=load('app/sinterklaas/sinterklaasApi.ts');
const {workOverviewEntry}=load('app/sinterklaas/b2b/SinterklaasB2BClient.tsx');
const options={from:'2026-11-25',year:'2026',season:'all',generatedAt:'2026-11-25T09:30:00Z'};
function order(fields={}){return api.normalizeB2BOrder({id:'one',year:'2026',season:'sint',customerName:'Bakkerij klant',status:'akkoord',deliveryWindowType:'date',deliveryDate:'2026-11-25',orderText:'PRODUCTEN EN PRIJS\n20 × Pakket op maat · € 20,00 p.s. ex btw · € 400,00',...fields});}
const rows=(orders,opts={})=>work.workOverviewRows(orders.map(workOverviewEntry),{...options,...opts});
test('includes today, made and packed orders until delivered; excludes older dates and unconfirmed orders',()=>{
 const variants=[{}, {id:'made',productionDone:true}, {id:'packed',packed:true}, {id:'future',deliveryDate:'2026-12-01'},
 {id:'past',deliveryDate:'2026-11-24'},{id:'delivered',delivered:true},{id:'cancelled',cancelled:true},{id:'quote',status:'offerte'},
 {id:'request',status:'aanvraag'},{id:'rejected',status:'afgewezen'},{id:'historie-test'},{id:'old-year',year:'2025'}].map(order);
 assert.deepEqual(Array.from(rows(variants),x=>x.order.id),['made','one','packed','future']);
});
test('ongoing ranges and ISO weeks are included; unknown dates are separate and all seasons are supported',()=>{
 const orders=[order({id:'range',deliveryWindowType:'range',deliveryDate:'2026-11-23',deliveryDateEnd:'2026-11-27'}),
 order({id:'week',deliveryWindowType:'week',deliveryDate:'',deliveryWeek:'2026-W48'}),
 order({id:'past-week',deliveryWindowType:'week',deliveryWeek:'2026-W47'}),order({id:'unknown',deliveryDate:''}),
 order({id:'christmas',season:'kerst'}),order({id:'both',season:'sint-kerst'})];
 const found=rows(orders);assert.equal(found.length,5);assert.equal(found.at(-1).order.id,'unknown');
 assert.equal(found.find(row=>row.order.id==='week').window.end,'2026-11-29');
 assert.deepEqual(Array.from(rows(orders,{season:'kerst'}),row=>row.order.id),['both','christmas']);
 assert.equal(rows(orders,{from:'invalid'}).length,0);
 assert.equal(work.workOverviewToday(new Date('2026-11-24T23:30:00Z')),'2026-11-25');
});
test('package and separate chocolate production retain independent progress and packing instructions',()=>{
 const o=order({department:'beide',productionDone:true,letterProductionDone:false,packed:false,
 letterLines:[{id:'package:1',letter:'G',quantity:20,chocolate:'wit',style:'spuit',size:'klein',exceptions:['notenvrij'],withLogo:true}],
 packaging:'Ieder pakket apart in cadeaupapier',importantNotes:'Eén doos apart houden',textInstructions:'Graag rood lint',deliveryMethod:'Bezorgen',deliveryAddress:'Voorbeeldstraat 3'});
 const before=JSON.stringify(o),entry=workOverviewEntry(o);
 assert.equal(entry.made,false);assert.equal(entry.hasLetters,true);assert.equal(entry.lettersMade,false);
 const ready=workOverviewEntry({...o,productionChecklistReady:true});assert.equal(ready.made,true);assert.equal(ready.lettersMade,true);
 const html=work.workOverviewHtml(rows([o]),options);
 for(const expected of ['Gemaakt <b>open','Ingepakt <b>open','Letters <b>open','cadeaupapier','Eén doos apart houden','rood lint','Voorbeeldstraat 3','G · wit spuit · klein','notenvrij','Inbegrepen in de pakketten'])assert(html.includes(expected),expected);
 assert.equal(JSON.stringify(o),before);
});
test('print keeps long descriptions, escapes markup and labels the snapshot and undated orders',()=>{
 const o=order({customerName:'<img src=x onerror=alert(1)> & Klant',deliveryDate:'',importantNotes:'<script>bad()</script>\nLaatste instructie',packed:true,productionDone:true});
 const entry=workOverviewEntry(o);entry.data.lines=[{quantity:80,description:'Pakket met chocolade-kruidnoten '.repeat(40)+'Laatste product',instructions:['Lint <rood>'],attention:['VEGAN']}];
 const selected=work.workOverviewRows([entry],options);const html=work.workOverviewHtml(selected,options);
 assert(!html.includes('<script>'));assert(!html.includes('<img src='));assert(html.includes('&lt;img'));assert(html.includes('&lt;script&gt;'));
 for(const expected of ['Laatste product','Laatste instructie','Lint &lt;rood&gt;','Leverdatum nog afspreken','Momentopname','1 bestellingen · 0 nog maken · 0 nog inpakken','Gemaakt <b>klaar','Ingepakt <b>klaar','table-header-group','A4 portrait'])assert(html.includes(expected),expected);
 assert(!html.includes('private-email'));
});
