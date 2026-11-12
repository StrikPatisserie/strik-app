const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
const {createCanvas}=require('@napi-rs/canvas'),{PDFDocument,PDFName}=require('pdf-lib');
const prints={};
let drawnText=[];
const code=ts.transpileModule(fs.readFileSync('app/sinterklaas/b2b/orderPrint.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
new Function('exports','require','fetch','document',code)(prints,require,async url=>{assert.equal(url,'/STRIK_LOGO_2021_BW.png');return new Response(fs.readFileSync('public/STRIK_LOGO_2021_BW.png'));},{createElement(tag){assert.equal(tag,'canvas');const canvas=createCanvas(1,1);const context=canvas.getContext('2d'),fillText=context.fillText.bind(context);context.fillText=(text,x,y)=>{drawnText.push({text,x,y});fillText(text,x,y);};canvas.toBlob=fn=>fn(new Blob([canvas.toBuffer('image/png')],{type:'image/png'}));return canvas;}});
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
test('long orders paginate before the bottom print margin and retain all product lines',async()=>{
 drawnText=[];
 const lines=Array.from({length:85},(_,i)=>({quantity:i+1,description:`Product ${i+1} met een volledige lange omschrijving van het bestelde product en de verpakking.`}));
 const blob=await prints.createOrderPrint({...source,lines},{format:'a4',copies:1,products:true});const bytes=new Uint8Array(await blob.arrayBuffer());const pdf=await PDFDocument.load(bytes);assert(pdf.getPageCount()>2);assert(pdf.getPageCount()<12);
 for(let i=1;i<=85;i++)assert(drawnText.some(row=>row.text.includes(`Product ${i} `)),`Product ${i} retained`);
 for(const row of drawnText.filter(row=>row.text.includes('Product ')))assert(row.y+17<=297*72/25.4-18*72/25.4,'Product line clears the bottom margin');
 if(process.env.PRINT_QA_OUTPUT)fs.writeFileSync('/tmp/strik-b2b-lang.pdf',bytes);
});
test('every A4 sheet starts 10 mm lower and preserves the footer clearance', async () => {
  drawnText = [];
  const lines = Array.from({ length: 85 }, (_, index) => ({
    quantity: index + 1,
    description: `Product ${index + 1} met een volledige lange omschrijving van het bestelde product en de verpakking.`,
  }));
  const blob = await prints.createOrderPrint({ ...source, lines }, {
    format: 'a4', copies: 1, products: true,
  });
  const pdf = await PDFDocument.load(await blob.arrayBuffer());
  const headings = drawnText.filter(row => row.text === 'VERDEELVEL' || row.text === 'VERDEELVEL · VERVOLG');
  assert.equal(headings.length, pdf.getPageCount());
  for (const heading of headings) {
    assert(Math.abs(heading.y - 22 * 72 / 25.4) < .001, 'Every A4 heading starts at 22 mm');
  }
  for (const row of drawnText.filter(row => row.text.includes('Product '))) {
    assert(row.y + 21 <= 261 * 72 / 25.4, 'Products stay above the reserved footer area');
  }
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
