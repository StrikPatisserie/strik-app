const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
const {createCanvas}=require('@napi-rs/canvas'),{PDFDocument,PDFName}=require('pdf-lib');
const prints={};
let drawnText=[];
const code=ts.transpileModule(fs.readFileSync('app/sinterklaas/b2b/orderPrint.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
new Function('exports','require','fetch','document',code)(prints,require,async url=>{assert.equal(url,'/STRIK_LOGO_2021_BW.png');return new Response(fs.readFileSync('public/STRIK_LOGO_2021_BW.png'));},{createElement(tag){assert.equal(tag,'canvas');const canvas=createCanvas(1,1);const context=canvas.getContext('2d'),fillText=context.fillText.bind(context);context.fillText=(text,x,y)=>{drawnText.push({text,x,y,font:context.font});fillText(text,x,y);};canvas.toBlob=fn=>fn(new Blob([canvas.toBuffer('image/png')],{type:'image/png'}));return canvas;}});
const source={customer:'Tandartspraktijk Kuipers',reference:'PRINT-QA',delivery:'20 nov · Daalseweg',lines:[{quantity:13,description:'Grote spuitletters · 3 puur en 10 melk'},{description:'M puur · E melk · H puur 2× · Z melk 2× · W melk · L melk · N melk 2× · A melk · D melk · I melk'}],notes:['Per stuk in cadeaupapier, met letter en smaak op de sticker.']};
test('A4 copies repeat the complete actual-format order on 210 x 297 mm pages',async()=>{
 const blob=await prints.createOrderPrint(source,{format:'a4',copies:3,products:true});const bytes=new Uint8Array(await blob.arrayBuffer());const pdf=await PDFDocument.load(bytes);
 assert.equal(pdf.getPageCount(),3);for(const page of pdf.getPages()){assert(Math.abs(page.getWidth()-210*72/25.4)<.001);assert(Math.abs(page.getHeight()-297*72/25.4)<.001);}
 assert.equal(pdf.catalog.get(PDFName.of('ViewerPreferences')).toString().includes('/PrintScaling /None'),true);
 if(process.env.PRINT_QA_OUTPUT)fs.writeFileSync('/tmp/strik-b2b-a4.pdf',bytes);
});
test('six Zebra labels are exactly 76 x 51 mm, with a separate page per copy',async()=>{
 const blob=await prints.createOrderPrint(source,{format:'zebra',copies:6,products:true});const bytes=new Uint8Array(await blob.arrayBuffer());const pdf=await PDFDocument.load(bytes);
 assert.equal(pdf.getPageCount(),6);for(const page of pdf.getPages()){assert(Math.abs(page.getWidth()-76*72/25.4)<.001);assert(Math.abs(page.getHeight()-51*72/25.4)<.001);}
 if(process.env.PRINT_QA_OUTPUT)fs.writeFileSync('/tmp/strik-b2b-zebra.pdf',bytes);
});
test('long orders fit one A4 and retain all product lines above the footer',async()=>{
 drawnText=[];
 const lines=Array.from({length:85},(_,i)=>({quantity:i+1,description:`Product ${i+1} met een volledige lange omschrijving van het bestelde product en de verpakking.`}));
 const blob=await prints.createOrderPrint({...source,lines},{format:'a4',copies:1,products:true});const bytes=new Uint8Array(await blob.arrayBuffer());const pdf=await PDFDocument.load(bytes);assert.equal(pdf.getPageCount(),1);
 for(let i=1;i<=85;i++)assert(drawnText.some(row=>row.text.includes(`Product ${i} `)),`Product ${i} retained`);
 assert(!drawnText.some(row=>row.text==='BIJZONDERHEDEN / VERPAKKING'));
 const lastProduct=drawnText.filter(row=>row.text.includes('Product ')).at(-1);
 assert(lastProduct.y>650,'Long orders use the available A4 height before shrinking');
 for(const row of drawnText.filter(row=>row.text.includes('Product ')))assert(row.y+17<=297*72/25.4-18*72/25.4,'Product line clears the bottom margin');
 if(process.env.PRINT_QA_OUTPUT)fs.writeFileSync('/tmp/strik-b2b-lang.pdf',bytes);
});
test('the compact A4 heading retains the 22 mm top inset', async () => {
  drawnText = [];
  await prints.createOrderPrint(source, { format: 'a4', copies: 1, products: true });
  assert.equal(drawnText[0].text, source.customer);
  assert(Math.abs(drawnText[0].y - 22 * 72 / 25.4) < .001);
});

test('Zebra customer headings keep their 3 mm top inset', async () => {
  drawnText = [];
  await prints.createOrderPrint(source, { format: 'zebra', copies: 1, products: true });
  assert(Math.abs(drawnText[0].y - 3 * 72 / 25.4) < .001);
});

test('invalid copies and unknown/prototype format keys are rejected before rendering',()=>{
 for(const copies of [0,-1,1.5,101,NaN])assert.throws(()=>prints.validatePrintOptions({format:'a4',copies,products:true}));
 assert.throws(()=>prints.validatePrintOptions({format:'toString',copies:1,products:true}));
});

test('print layout highlights explicit exceptions and keeps the actual delivery and all order information',async()=>{
 drawnText=[];
 const data={...source,reference:'folder-db47d681-37df-465a-9e54-072a7fce7b90',lines:[{quantity:20,description:'Speculaasbrok met letter · kleine spuitletter S · eigen logo'},{quantity:2,description:'Letter C · puur · groot',attention:['vegan','notenvrij']}],notes:['Per stuk in cadeaupapier.']};
 const blob=await prints.createOrderPrint(data,{format:'a4',copies:1,products:true});
 const pdf=await PDFDocument.load(await blob.arrayBuffer());
 assert(drawnText.some(row=>row.text==='EIGEN LOGO'));
 assert(drawnText.some(row=>row.text==='VEGAN'));
 assert(drawnText.some(row=>row.text==='NOTENVRIJ'));
 assert(drawnText.some(row=>row.text==='Levering · 20 nov · Daalseweg'));
 assert(!drawnText.some(row=>row.text.includes('folder-db47')));
 assert(drawnText.some(row=>row.text==='Per stuk in cadeaupapier.'));
 // Each sheet draws both the order artwork and the original Strik logo.
 for(const page of pdf.getPages())assert.equal(page.node.Resources().lookup(PDFName.of('XObject')).keys().length,2);
 if(process.env.PRINT_QA_OUTPUT)fs.writeFileSync('/tmp/strik-b2b-designed.pdf',new Uint8Array(await blob.arrayBuffer()));
});


test('negative dietary instructions retain their meaning in attention blocks',async()=>{
 drawnText=[];
 await prints.createOrderPrint({...source,lines:[{quantity:1,description:'Product op bestelling'}],notes:['Dit product is niet glutenvrij.']},{format:'a4',copies:1,products:true});
 assert(drawnText.some(row=>row.text==='Dit product is niet glutenvrij.'));
 assert(drawnText.some(row=>row.text==='ALLERGIE / DIEET'));
 assert(!drawnText.some(row=>row.text==='GLUTENVRIJ'));
});


const path = require('node:path');
function loadTs(filename) {
  const loaded = {};
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  new Function('exports', 'require', compiled)(loaded, id => id.startsWith('.')
    ? loadTs(path.resolve(path.dirname(filename), id) + '.ts') : require(id));
  return loaded;
}
const { buildB2BOrderPrintData } = loadTs('app/sinterklaas/b2b/orderPrintData.ts');
const letters = [
  ['J', 2, 'groot', ['glutenvrij']], ['A', 1, 'groot', []],
  ['G', 1, 'groot', []], ['E', 1, 'groot', []], ['L', 1, 'groot', []],
  ['L', 2, 'klein', []], ['K', 1, 'groot', []],
].map(([letter, quantity, size, exceptions], index) => ({
  id: `letter-${index}`, letter, quantity, size, exceptions,
  chocolate: 'wit', style: 'spuit', withLogo: true,
}));
const wrappingNotes = letters.map(letter =>
  `Bij ${letter.quantity} × Chocolade spuitletters · spuitletter ${letter.letter} ${letter.size} · wit${letter.exceptions.length ? ' · glutenvrij' : ''} · eigen logo: inclusief cadeaupapier (€ 0,25 incl. btw per letter)`);
const order = {
  customerName: 'Mondzorg Lindenholt', id: 'folder-test', deliveryMethod: 'Afhalen bij Strik Daalseweg',
  deliveryAddress: '', letterOrderText: '', letterLines: letters,
  orderText: '', packaging: 'Verpakking aangevraagd; zie aanvraag voor inhoud en cadeaupapier.',
  logo: 'Eigen logo aangevraagd; bestand en uitvoering nog afstemmen.', textInstructions: '',
};
function printOrder(overrides = {}, parsedOverrides = {}) {
  return buildB2BOrderPrintData({ ...order, ...overrides }, {
    delivery: '30 nov – 6 dec', productLines: [], otherText: wrappingNotes.join('\n'), ...parsedOverrides,
  });
}

test('folder wrapping moves to each matching order row without duplicating the order', async () => {
  const before = JSON.stringify(order);
  const data = printOrder();
  assert.equal(data.lines.length, 7);
  assert.equal(data.lines.reduce((sum, row) => sum + row.quantity, 0), 9);
  for (const row of data.lines) assert.deepEqual(row.instructions, ['Apart in cadeaupapier']);
  assert.equal(data.notes.length, 0);
  assert.deepEqual(data.location, { label: 'Afhaaladres', address: 'Strik Nijmegen-Oost · Daalseweg 254' });
  assert.equal(JSON.stringify(order), before);

  drawnText = [];
  const blob = await prints.createOrderPrint(data, { format: 'a4', copies: 1, products: true });
  const bytes = new Uint8Array(await blob.arrayBuffer());
  assert.equal((await PDFDocument.load(bytes)).getPageCount(), 1);
  assert.equal(drawnText.filter(row => row.text === 'Apart in cadeaupapier').length, 7);
  assert.equal(drawnText.filter(row => row.text === 'GLUTENVRIJ').length, 1);
  assert.equal(drawnText.filter(row => row.text === 'EIGEN LOGO').length, 7);
  assert(!drawnText.some(row => row.text.includes('Bij 2 ×') || row.text.includes('0,25')));
  assert(drawnText.some(row => row.text === 'AFHAALADRES'));
  assert(drawnText.some(row => row.text.includes('Daalseweg 254')));
  if (process.env.PRINT_QA_OUTPUT) fs.writeFileSync('/tmp/strik-b2b-compact-mondzorg.pdf', bytes);
});

test('whole-order wrapping and unique instructions survive with the actual delivery address', async () => {
  const data = printOrder({
    packaging: 'Alles apart in cadeaupapier verpakken.\nPer smaak in een aparte krat.',
    deliveryMethod: 'Bezorgen', deliveryAddress: 'Raadhuisstraat 3A\n6581 AL Malden',
    textInstructions: 'Sticker met letter en smaak.',
  }, { otherText: 'Kratten bij de receptie afgeven.' });
  for (const row of data.lines) assert.deepEqual(row.instructions, ['Apart in cadeaupapier']);
  assert(data.notes.includes('Per smaak in een aparte krat.'));
  assert(data.notes.includes('Sticker met letter en smaak.'));
  assert(data.notes.includes('Kratten bij de receptie afgeven.'));
  assert.deepEqual(data.location, { label: 'Bezorgadres', address: 'Raadhuisstraat 3A\n6581 AL Malden' });

  drawnText = [];
  await prints.createOrderPrint(data, { format: 'a4', copies: 1, products: true });
  const customer = drawnText.find(row => row.text === data.customer);
  const address = drawnText.find(row => row.text === 'BEZORGADRES');
  const lastProduct = Math.max(...drawnText.filter(row => row.text.includes('wit spuit')).map(row => row.y));
  assert(customer.y < lastProduct && lastProduct < address.y);
  assert(drawnText.some(row => row.text === 'Raadhuisstraat 3A'));
});

test('packaging stays attached to the correct product when logo and allergy choices differ', () => {
  const base = letters[0];
  const data = printOrder({ letterLines: [
    { ...base, quantity: 1, exceptions: [], withLogo: false },
    { ...base, quantity: 1, exceptions: ['glutenvrij'], withLogo: true },
  ] }, { otherText: 'Bij 1 × Chocolade spuitletters · spuitletter J groot · wit · glutenvrij · eigen logo: inclusief cadeaupapier (€ 0,25 incl. btw per letter)' });
  assert.deepEqual(data.lines[0].instructions, []);
  assert.deepEqual(data.lines[1].instructions, ['Apart in cadeaupapier']);
});

test('unmatched old instructions are retained for checking and unknown pickup addresses are not invented', () => {
  const text = 'Bij 3 × Chocolade spuitletters · spuitletter X groot · wit · eigen logo: rode verpakking';
  const data = printOrder({ deliveryMethod: 'Afhalen bij Strik', packaging: '' }, { otherText: text });
  assert(data.notes.includes(text));
  assert.deepEqual(data.location, { label: 'Afhaaladres', address: 'Afhalen bij Strik' });
});

test('group orders print the company breakdown once with the correct logo choices', () => {
  const groupModel = loadTs('app/sinterklaas/b2b/groupedLetterOrders.ts');
  const group = { rows: [
    { company: 'Bedrijf A', melk: 5, wit: 2, puur: 0, withLogo: true },
    { company: 'Bedrijf B', melk: 0, wit: 3, puur: 4, withLogo: false },
  ], letterCostCents: 770, logoCostCents: 30 };
  const data = printOrder({
    letterOrderText: groupModel.serializeLetterGroup(group),
    letterLines: groupModel.groupLetterLines(group), packaging: '', logo: '',
  }, { otherText: '' });
  assert.equal(data.lines.length, 2);
  assert.equal(data.lines.reduce((sum, row) => sum + row.quantity, 0), 14);
  assert.deepEqual(data.lines[0].attention, ['EIGEN LOGO']);
  assert.deepEqual(data.lines[1].attention, []);
  assert(data.lines[0].description.includes('5 melk Q'));
});


test('decoration prints against its own letter row without borrowing another line’s instructions', async () => {
 const decorated={...order,letterLines:[{...letters[0],quantity:2,decoration:'Blauwe balletjes'}, {...letters[0],id:'standard',quantity:3}],packaging:'',logo:'',textInstructions:''};
 const data=buildB2BOrderPrintData(decorated,{delivery:'30 nov',productLines:[],otherText:''});
 assert.equal(data.lines.length,2);assert(data.lines[0].attention.includes('DECO · Blauwe balletjes'));
 assert(!data.lines[1].attention.some(value=>value.includes('Blauwe')));
 drawnText=[];await prints.createOrderPrint(data,{format:'a4',copies:1,products:true});
 assert(drawnText.some(row=>/BLAUWE BALLETJES/i.test(row.text)));
});
