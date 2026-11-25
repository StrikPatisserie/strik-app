const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
function loader(globals={}){const cache={};return function load(file){file=path.resolve(file);if(cache[file])return cache[file];const exports=cache[file]={};let source=fs.readFileSync(file,'utf8');if(file.endsWith('SinterklaasB2BClient.tsx'))source+='\nexport {workOverviewEntry};';vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,Intl,Date,Map,Set,URL,URLSearchParams,process:{env:{}},...globals,require(name){if(name.endsWith('.css'))return{default:{}};if(name==='next/link'||name==='next/image')return{default:'a'};if(name.startsWith('.')||name.startsWith('@/')){const base=name.startsWith('@/')?path.resolve(name.slice(2)):path.resolve(path.dirname(file),name),target=['.ts','.tsx'].map(ext=>base+ext).find(fs.existsSync);if(target)return load(target);}return require(name);}});return exports;};}
const load=loader(),work=load('app/sinterklaas/b2b/workOverview.ts'),api=load('app/sinterklaas/sinterklaasApi.ts');
const {workOverviewEntry}=load('app/sinterklaas/b2b/SinterklaasB2BClient.tsx');
const options={from:'2026-11-25',year:'2026',season:'all',generatedAt:'2026-11-25T09:30:00Z',includeUndated:true,internalNotes:true};
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
 const compact=work.compactWorkRow(rows([o])[0],options),text=JSON.stringify(compact);
 for(const label of ['Gemaakt','Ingepakt','Letters'])assert(compact.states.some(state=>state.label===label&&!state.done));
 for(const expected of ['cadeaupapier','Eén doos apart houden','rood lint','Voorbeeldstraat 3','G · wit spuit · klein','notenvrij','Inbegrepen in de pakketten'])assert(text.includes(expected),expected);
 assert.equal(JSON.stringify(o),before);
});

test('inclusive end dates, invalid ranges, undated opt-in and overlapping weeks are handled explicitly',()=>{
 const orders=[order({id:'first'}),order({id:'last',deliveryDate:'2026-11-27'}),order({id:'after',deliveryDate:'2026-11-28'}),order({id:'undated',deliveryDate:''}),order({id:'overlap',deliveryWindowType:'range',deliveryDate:'2026-11-23',deliveryDateEnd:'2026-11-26'})];
 assert.deepEqual(Array.from(rows(orders,{to:'2026-11-27',includeUndated:false}),row=>row.order.id),['overlap','first','last']);
 assert.equal(rows(orders,{to:'2026-11-24'}).length,0);
 assert.equal(rows(orders,{to:'invalid'}).length,0);
 assert.equal(rows(orders,{from:'2026-02-30'}).length,0);
 assert.equal(work.workOverviewEnd('2026-11-25'),'2026-12-01');
 assert.equal(rows(orders,{to:'2026-11-27',includeUndated:true}).at(-1).order.id,'undated');
});

test('equal letter variants collapse without merging different diets, decorations or instructions',()=>{
 const o=order({letterLines:['A','B','C'].map((letter,i)=>({id:String(i),letter,quantity:i+1,chocolate:'melk',style:'spuit',size:'klein',exceptions:i===2?['vegan']:[],withLogo:true,decoration:i===2?'Pure chocolade':''})),packaging:'Alles apart in cadeaupapier verpakken.'});
 const entry=rows([o])[0];const compact=work.compactWorkRow(entry,options);
 assert(compact.products.some(text=>text.includes('3× melk spuit · klein · eigen logo: 1× A, 2× B')));
 assert(compact.products.some(text=>text.includes('vegan')&&text.includes('3× C')&&text.includes('Pure chocolade')));
 assert.equal(compact.notes.filter(text=>text==='Apart in cadeaupapier').length,1);
 assert(!compact.products.some(text=>text.includes('Apart in cadeaupapier')));
 entry.data.lines.find(line=>line.description.startsWith('A ·')).instructions=['Rood lint'];entry.data.lines.find(line=>line.description.startsWith('B ·')).instructions=['Blauw lint'];
 const split=work.compactWorkRow(entry,options);
 assert(split.products.some(text=>text.includes('1× A')&&text.includes('Rood lint')));
 assert(split.products.some(text=>text.includes('2× B')&&text.includes('Blauw lint')));
});

test('work instructions are retained while internal notes are optional, and no text is treated as HTML',()=>{
 const entry=rows([order({customerName:'<img src=x> & Klant',importantNotes:'Interne administratie',textInstructions:'Niet glutenvrij. Laatste instructie',packaging:'Rood lint'})])[0];
 const compact=work.compactWorkRow(entry,{...options,internalNotes:false});
 assert.equal(compact.customer,'<img src=x> & Klant');
 assert(compact.notes.some(text=>text.includes('Niet glutenvrij. Laatste instructie')));
 assert(compact.notes.includes('Rood lint'));
 assert(!compact.notes.some(text=>text.includes('Interne administratie')));
 assert(work.compactWorkRow(entry,options).notes.includes('Intern: Interne administratie'));
});

const {createCanvas}=require('@napi-rs/canvas');
const {PDFDocument,PDFName}=require('pdf-lib');
let drawn=[];
const canvasDocument={createElement(tag){assert.equal(tag,'canvas');const canvas=createCanvas(1,1),ctx=canvas.getContext('2d'),draw=ctx.fillText.bind(ctx);ctx.fillText=(text,x,y)=>{drawn.push({text,x,y});draw(text,x,y);};return canvas;}};
const pdfPrint={};
new Function('exports','require','document',ts.transpileModule(fs.readFileSync('app/sinterklaas/b2b/workOverviewPdf.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(pdfPrint,name=>name==='./workOverview'?work:require(name),canvasDocument);
test('a representative delivery range fits in two fixed A4 pages with complete instructions',async()=>{
 drawn=[];
 const entries=rows(Array.from({length:22},(_,i)=>order({id:`order-${i}`,customerName:`Klant ${i+1}`,packaging:'Ieder pakket apart in cadeaupapier',textInstructions:'Graag een rood lint',letterLines:[{id:'letter',letter:'G',quantity:20,chocolate:'melk',style:'spuit',size:'klein',exceptions:[],withLogo:true}]})));
 const result=await pdfPrint.createWorkOverviewPdf(entries,{...options,to:'2026-12-01',internalNotes:false});
 const bytes=new Uint8Array(await result.blob.arrayBuffer()),pdf=await PDFDocument.load(bytes);
 assert(result.pages<=2);assert.equal(result.pages,pdf.getPageCount());assert.equal(result.previews.length,result.pages);assert(result.fontSize>=8);
 for(const page of pdf.getPages()){assert(Math.abs(page.getWidth()-210*72/25.4)<.001);assert(Math.abs(page.getHeight()-297*72/25.4)<.001);}
 assert.equal(pdf.catalog.get(PDFName.of('ViewerPreferences')).toString().includes('/PrintScaling /None'),true);
 for(let i=1;i<=22;i++)assert(drawn.some(line=>line.text===`Klant ${i}`));
 assert(drawn.some(line=>line.text.includes('rood lint')));
 assert(drawn.some(line=>line.text.includes('cadeaupapier')));
 if(process.env.PRINT_QA_OUTPUT)fs.writeFileSync('/private/tmp/b2b-range-qa.pdf',bytes);
});
test('long custom orders continue across pages with no clipping or lost final instructions',async()=>{
 drawn=[];
 const entry=rows([order({customerName:'Lang maatwerk'})])[0];
 entry.data.lines=Array.from({length:180},(_,i)=>({quantity:i+1,description:`Onderdeel-${i} met speciale samenstelling voor het pakket en een lange productomschrijving.`}));
 entry.data.notes=['Laatste instructie ALTIJD apart verpakken'];
 const result=await pdfPrint.createWorkOverviewPdf([entry],options);
 assert(result.pages>2);assert(result.fontSize>=8);
 for(let i=0;i<180;i++)assert(drawn.some(line=>line.text.includes(`Onderdeel-${i} `)),`item ${i}`);
 assert(drawn.some(line=>line.text.includes('Laatste instructie ALTIJD apart verpakken')));
 assert(drawn.some(line=>line.text.includes('(vervolg)')));
 for(const line of drawn.filter(line=>line.text.includes('Onderdeel-')))assert(line.y+10<297*72/25.4-35);
});
