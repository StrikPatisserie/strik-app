const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
function loader(globals={}){const cache={};return function load(file){file=path.resolve(file);if(cache[file])return cache[file];const exports=cache[file]={};let source=fs.readFileSync(file,'utf8');if(file.endsWith('SinterklaasB2BClient.tsx'))source+='\nexport {workOverviewEntry};';vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,Intl,Date,Map,Set,URL,URLSearchParams,process:{env:{}},...globals,require(name){if(name.endsWith('.css'))return{default:{}};if(name==='next/link'||name==='next/image')return{default:'a'};if(name.startsWith('.')||name.startsWith('@/')){const base=name.startsWith('@/')?path.resolve(name.slice(2)):path.resolve(path.dirname(file),name),target=['.ts','.tsx'].map(ext=>base+ext).find(fs.existsSync);if(target)return load(target);}return require(name);}});return exports;};}
const load=loader(),work=load('app/sinterklaas/b2b/workOverview.ts'),api=load('app/sinterklaas/sinterklaasApi.ts');
const {workOverviewEntry}=load('app/sinterklaas/b2b/SinterklaasB2BClient.tsx');

const distribution=load('app/sinterklaas/b2b/distributionList.ts');
const options={from:'2026-11-30',to:'2026-12-02',year:'2026',season:'all',generatedAt:'2026-11-27T12:00:00Z'};
function order(fields={}){return api.normalizeB2BOrder({id:'one',year:'2026',season:'sint',customerName:'Test klant',status:'akkoord',deliveryWindowType:'date',deliveryDate:'2026-11-30',orderText:'PRODUCTEN EN PRIJS\n20 × Pakket op maat · € 20,00 p.s. ex btw · € 400,00',...fields});}
const days=items=>distribution.distributionDays(items.map(workOverviewEntry),options);
test('one fixed day per group, inclusive dates, no ranges, cancelled, historical or delivered orders',()=>{
 const input=[order(),order({id:'last',deliveryDate:'2026-12-02'}),order({id:'packed',packed:true}),order({id:'delivered',delivered:true}),order({id:'cancelled',cancelled:true}),order({id:'unconfirmed',status:'offerte'}),order({id:'later',deliveryDate:'2026-12-03'}),order({id:'range',deliveryWindowType:'range',deliveryDateEnd:'2026-12-02'}),order({id:'legacy',sourceSheet:'__STRIK_LEVERPERIODE__range|2026-12-02|'}),order({id:'week',deliveryWindowType:'week',deliveryWeek:'2026-W49'}),order({id:'unknown',deliveryDate:''}),order({id:'historie-test'})];
 const before=JSON.stringify(input),result=days(input);
 assert.deepEqual(Array.from(result,d=>d.date),['2026-11-30','2026-12-02']);
 assert.deepEqual(Array.from(result.flatMap(d=>d.rows),r=>r.id),['one','packed','last']);
 assert.equal(JSON.stringify(input),before);
 assert.equal(distribution.distributionDays(input.map(workOverviewEntry),{...options,to:'2026-11-29'}).length,0);
});
test('package letter quantities are labelled as included and all diet/wrapping exceptions survive',()=>{
 const result=days([order({letterLines:[{id:'package:a',letter:'G',quantity:20,chocolate:'wit',size:'klein',style:'spuit',exceptions:['notenvrij'],withLogo:true}],packaging:'Elk pakket apart in cadeaupapier. Rood lint.',importantNotes:'Graag zonder noten wegens allergie. Factuur naar administratie.',deliveryMethod:'Bezorgen',deliveryAddress:'Voorbeeldstraat 3'})])[0].rows[0];
 assert.equal(result.products.length,2);
 assert(result.products[1].startsWith('In pakket:'));
 for(const text of ['20×G','notenvrij','logo'])assert(result.products[1].includes(text));
 assert(result.notes.some(x=>x.includes('cadeaupapier')));assert(result.notes.some(x=>x.includes('Rood lint')));
 assert(result.notes.some(x=>x.includes('zonder noten')));assert(!result.notes.some(x=>x.includes('Factuur')));
 assert.equal(result.locationLabel,'BEZORGEN');assert.equal(result.address,'Voorbeeldstraat 3');
});
test('different diets, negative instructions and custom unknown text are not conflated',()=>{
 const letters=['A','B','C'].map((letter,i)=>({id:letter,letter,quantity:1,chocolate:'puur',size:'groot',style:'spuit',exceptions:i===2?['vegan']:[],withLogo:false}));
 const result=days([order({letterLines:letters,textInstructions:'NIET glutenvrij. Gebruik bijzondere uitvoering X9.',importantNotes:'Geen marsepein onder het logo; allergie.',packaging:'Blauw lint'})])[0].rows[0];
 assert(result.products.some(x=>x.includes('1× C')&&x.includes('vegan')));
 assert(result.notes.some(x=>x.includes('NIET glutenvrij')));assert(result.notes.some(x=>x.includes('X9')));
 assert(result.notes.some(x=>x.includes('Geen marsepein')));
});
test('full custom package contents survive an earlier introductory sentence and logo stays on the correct variant',()=>{
 const result=days([order({
  orderText:'PRODUCTEN EN PRIJS\n80 × Pakket op maat · € 19,75 p.s. ex btw · € 1580,00\nOVERIGE ORDERAFSPRAKEN\n80 kleine Sintpakketten uit de folder. Pakketinhoud per pakket: kleine speculaaspop, 150 gram gevuld speculaas, 200 gram naturel kruidnoten en 50 gram massieve chocoladelettertjes.',
  packaging:'80 kleine Sintpakketten; per pakket één kleine chocoladeletter G.',
  letterLines:[{id:'a',letter:'A',quantity:1,chocolate:'melk',size:'klein',style:'spuit',exceptions:[],withLogo:true},{id:'b',letter:'B',quantity:1,chocolate:'melk',size:'klein',style:'spuit',exceptions:[],withLogo:false}]
 })])[0].rows[0];
 for(const content of ['speculaaspop','150 g gevuld speculaas','200 g naturel kruidnoten','50 g massieve']) assert(result.notes.join(' ').includes(content),content);
 assert(result.products.some(x=>x.includes('1× A')&&x.includes('eigen logo')));
 assert(result.products.some(x=>x.includes('1× B')&&!x.includes('eigen logo')));
});
const {createCanvas}=require('@napi-rs/canvas');
const {PDFDocument}=require('pdf-lib');
let drawings=[];
const canvasDocument={createElement(){const c=createCanvas(1,1),ctx=c.getContext('2d'),fill=ctx.fillText.bind(ctx);ctx.fillText=(text,x,y)=>{drawings.push({text,x,y});fill(text,x,y);};return c;}};
const renderer={};
new Function('exports','require','document',ts.transpileModule(fs.readFileSync('app/sinterklaas/b2b/distributionPdf.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(renderer,name=>name==='./distributionList'?distribution:require(name),canvasDocument);
test('each selected delivery day has exactly its own A4 and all rows are drawn once',async()=>{
 drawings=[];
 const input=Array.from({length:38},(_,i)=>order({id:String(i),customerName:`Klant-${i}`,deliveryDate:i<16?'2026-11-30':i<28?'2026-12-01':'2026-12-02',packaging:'Apart in cadeaupapier'}));
 const result=await renderer.createDistributionPdf(days(input),options),pdf=await PDFDocument.load(await result.blob.arrayBuffer());
 assert.equal(result.pages,3);assert.equal(pdf.getPageCount(),3);
 for(const p of pdf.getPages()){assert(Math.abs(p.getWidth()-210*72/25.4)<.01);assert(Math.abs(p.getHeight()-297*72/25.4)<.01);}
 for(let i=0;i<38;i++)assert.equal(drawings.filter(x=>x.text===`Klant-${i}`).length,1);
 assert(result.layout.every(x=>x.fontSize>=7.5));
});
test('a day that cannot fit is rejected rather than clipping, shrinking indefinitely or mixing dates',async()=>{
 const many=Array.from({length:100},(_,i)=>order({id:String(i),customerName:`Klant-${i}`,textInstructions:'Een omvangrijke speciale opdracht '.repeat(40)+'LAATSTE INSTRUCTIE'}));
 await assert.rejects(()=>renderer.createDistributionPdf(days(many),options),/past.*niet leesbaar op één A4/);
});
