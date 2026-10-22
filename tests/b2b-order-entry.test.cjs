const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
function load(file, imports = {}, globals = {}, expose = '') {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText + expose,
    { exports, console, ...globals, require: name => name in imports ? imports[name] : name === 'react/jsx-runtime' ? require(name) : { default: name } });
  return exports;
}
function nodes(node, predicate) {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap(child => nodes(child, predicate));
  return [...(predicate(node) ? [node] : []), ...nodes(node.props?.children, predicate)];
}
function label(node) {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  return Array.isArray(node) ? node.map(label).join('') : node && typeof node === 'object' ? label(node.props?.children) : '';
}
const pricing = load('app/lib/business-folder-pricing.ts');
const sint = load('app/sint-voor-bedrijven/sintProducts.ts', { '@/app/lib/business-folder-pricing': pricing });
const kerst = load('app/kerst-voor-bedrijven/christmasProducts.ts', { '@/app/lib/business-folder-pricing': pricing });
const letters = load('app/sinterklaas/b2bLetterLines.ts');
const folderOrderText = load('app/lib/businessFolderOrderText.ts');
const quoteBuilder = load('app/lib/businessFolderQuote.ts', {
  'node:crypto': require('node:crypto'),
  '@/app/sint-voor-bedrijven/sintProducts': sint,
  '@/app/kerst-voor-bedrijven/christmasProducts': kerst,
  '@/app/lib/letter-pricing': load('app/lib/letter-pricing.ts'),
}, { Buffer }).buildBusinessFolderQuote;
function entry(season = 'sint', initialOrder = null) {
  const state = [], refs = [], effects = [], calls = [], updated = [], storage = new Map();
  let cursor = 0, refCursor = 0;
  const loaded = load('app/sinterklaas/b2b/SinterklaasB2BClient.tsx', {
    react: { ...React, useEffect(callback) { effects.push(callback); }, useMemo(callback) { return callback(); },
      useState(initial) { const i = cursor++; if (!(i in state)) state[i] = typeof initial === 'function' ? initial() : initial; return [state[i], next => { state[i] = typeof next === 'function' ? next(state[i]) : next; }]; },
      useRef(initial) { return refs[refCursor++] ||= { current: initial }; } },
    '../../sint-voor-bedrijven/sintProducts': sint, '../../kerst-voor-bedrijven/christmasProducts': kerst, '../../lib/business-folder-pricing': pricing,
    '../../lib/businessFolderOrderText': folderOrderText,
    '../b2bLetterLines': letters,
    '../sinterklaasApi': { saveB2BOrder: async data => { calls.push(data); return { ...data, id: 'saved' }; } },
    './B2BOrders.module.css': { default: new Proxy({}, { get: (_, key) => key }) },
  }, { crypto: require('node:crypto').webcrypto, sessionStorage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) }, HTMLInputElement: class {}, HTMLSelectElement: class {}, HTMLTextAreaElement: class {} }, '\nexports.Form = B2BOrderForm; exports.blank = createFormState; exports.parse = parseOrderText; exports.prices = lines => { const priced = repriceProductLines(lines); return {ex: productLinesTotal(priced), incl: productLinesTotalIncl(priced), lines: priced}; };');
  function render() { cursor = refCursor = 0; return loaded.Form({ season, initialOrder, onSaved: order => updated.push(order), onCancel() {} }); }
  render(); effects.splice(0).forEach(effect => effect()); render(); effects.length = 0;
  function field(name) {
    const tree = render();
    return nodes(tree, n => ['input','select','textarea'].includes(n.type) && n.props['aria-label'] === name)[0]
      || nodes(nodes(tree, n => n.type === 'label' && label(n.props.children).startsWith(name))[0], n => ['input','select','textarea'].includes(n.type))[0];
  }
  return { render, calls, updated, blank: loaded.blank, parse: loaded.parse, prices: loaded.prices,
    check(name, checked) { const input = field(name); assert.ok(input, `Checkbox: ${name}`); input.props.onChange({ target: { checked } }); },
    field(name, value) { const input = field(name); assert.ok(input, `Field: ${name}`); input.props.onChange({ target: { value } }); },
    button(name) { const button = nodes(render(), n => n.type === 'button' && label(n) === name)[0]; assert.ok(button, `Button: ${name}`); const event = { defaultPrevented: false, preventDefault() { this.defaultPrevented = true; } }; button.props.onClick?.(event); return event; },
    step() { return nodes(render(), n => n.props?.['aria-current'] === 'step').map(label)[0]; },
    submit() { return nodes(render(), n => n.type === 'form')[0].props.onSubmit({ preventDefault() {}, currentTarget: { elements: [] } }); },
  };
}
test('Enter and step navigation never save before review, and missing customer stays on the first step', async () => {
  const ui = entry(); await ui.submit();
  assert.match(ui.step(), /Klant & levering/); assert.equal(ui.calls.length, 0);
  assert.ok(nodes(ui.render(), n => n.props?.role === 'alert').length);
  ui.field('Bedrijfsnaam / klantnaam *', 'Voorbeeld BV'); await ui.submit();
  assert.match(ui.step(), /Producten/); assert.equal(ui.calls.length, 0);
  const event = ui.button('Bestelling controleren →'); assert.equal(event.defaultPrevented, true); assert.match(ui.step(), /Controleren/); assert.equal(ui.calls.length, 0);
  assert.equal(nodes(ui.render(), n => n.type === 'button' && label(n) === 'Bestelling opslaan')[0].props.type, 'submit');
});
test('Christmas products, manual prices and customer details survive back/forward navigation and save in the correct season', async () => {
  const ui = entry('kerst');
  ui.field('Bedrijfsnaam / klantnaam *', 'Kerstbedrijf'); ui.field('E-mailadres', 'voorbeeld@example.invalid');
  ui.field('Vaste leverdatum', '2026-12-18'); ui.button('Verder naar producten →');
  // Use the real published catalogue identity and its only variant.
  const product = kerst.christmasProducts[0];
  ui.field('Product', `kerst-${product.id}`); ui.field('Variant', product.detail); ui.field('Aantal producten', '25');
  ui.field('Prijs p.s. excl. btw', '14.25'); ui.button('+ Product toevoegen');
  ui.button('Bestelling controleren →'); ui.button('Vorige stap'); ui.button('Vorige stap');
  assert.ok(nodes(ui.render(), n => n.type === 'input' && n.props.value === 'Kerstbedrijf').length);
  ui.button('Verder naar producten →'); ui.button('Bestelling controleren →');
  await ui.submit(); assert.equal(ui.calls.length, 1); assert.equal(ui.updated.length, 1);
  assert.equal(ui.calls[0].season, 'kerst'); assert.equal(ui.calls[0].customerEmail, 'voorbeeld@example.invalid');
  assert.equal(ui.calls[0].totalExVat, '€ 356,25'); assert.match(ui.calls[0].orderText, /14,25/);
});
test('Sint letter rules retain quantities and pricing when review is revisited', async () => {
  const ui = entry(); ui.field('Bedrijfsnaam / klantnaam *', 'Letterbedrijf'); ui.button('Verder naar producten →');
  ui.field('Letter', 'S'); ui.field('Chocolade', 'melk'); ui.field('Soort', 'spuit'); ui.field('Formaat', 'groot'); ui.field('Aantal letters', '25');
  ui.button('+ Letter toevoegen'); ui.button('Bestelling controleren →'); ui.button('Vorige stap'); ui.button('Bestelling controleren →'); await ui.submit();
  assert.equal(ui.calls.length, 1); assert.equal(ui.calls[0].season, 'sint');
  assert.equal(ui.calls[0].letterLines.length, 1); assert.equal(ui.calls[0].letterLines[0].quantity, 25);
  assert.ok(ui.calls[0].totalExVat); assert.match(ui.calls[0].orderText, /25/);
});

test('speculaas packages retain a chosen letter through entry, review and reopening; old packages retain S', async () => {
  const ui = entry(); ui.field('Bedrijfsnaam / klantnaam *', 'Voorbeeld pakket'); ui.button('Verder naar producten →');
  const product = sint.products.find(item => item.id === 'speculaasbrok-met-letter');
  ui.field('Product', product.id); ui.field('Variant', product.variants[1].label);
  ui.field('Letter bij speculaasbrok', 'M'); ui.field('Aantal producten', '60'); ui.button('+ Product toevoegen');
  ui.button('Bestelling controleren →'); await ui.submit();
  assert.equal(ui.calls.length, 1); assert.match(ui.calls[0].orderText, /letter M/);
  const saved = { ...ui.calls[0], id: 'existing', folderQuote: null };
  const reopened = entry('sint', saved);
  const selectedLetter = nodes(reopened.render(), node => node.type === 'select' && node.props['aria-label']?.startsWith('Letter in '))[0];
  assert.equal(selectedLetter.props.value, 'M');
  const old = { ...saved, orderText: saved.orderText.replace(' · letter M', '') };
  const original = old.orderText;
  const legacy = entry('sint', old);
  assert.equal(nodes(legacy.render(), node => node.type === 'select' && node.props['aria-label']?.startsWith('Letter in '))[0].props.value, 'S');
  assert.equal(old.orderText, original, 'opening an old request does not rewrite the stored order');
});

test('an existing folder request opens as editable products and preserves its original S, quantity and quoted price on save', async () => {
  const raw = ['BEDRIJF EN CONTACT', 'Bedrijf: Voorbeeld BV', '', 'GEKOZEN SINTERKLAASPRODUCTEN', '60 × Speculaasbrok met letter · Speculaasbrok zonder amandel · kleine spuitletter', '  € 11,51 p.s. excl. btw · € 690,60 totaal excl. btw', '', 'PRIJSINDICATIE', '€ 690,60 excl. btw / € 752,75 incl. btw', '', 'GEWENSTE LEVERING', '2026-12-01', 'Bezorgen in/rondom Nijmegen', '', 'WENSEN', 'Geen aanvullende wensen', '', 'Vrijblijvende aanvraag; beschikbaarheid, levermoment en definitieve prijs moeten nog worden bevestigd.'].join('\n');
  const order = { ...entry().blank(), id: 'existing-folder', year: '2026', season: 'sint', customerName: 'Voorbeeld BV', deliveryDate: '2026-12-01', department: 'bakkerij', totalExVat: '690.60', orderText: raw, updatedAt: '2026-10-22' };
  const ui = entry('sint', order);
  const parsed = ui.parse(raw);
  assert.equal(parsed.productLines.length, 1);
  assert.equal(parsed.productLines[0].productId, 'speculaasbrok-met-letter');
  assert.equal(parsed.productLines[0].quantity, 60);
  assert.equal(parsed.productLines[0].unitPriceEx, '11.51');
  const letter = nodes(ui.render(), n => n.type === 'select' && n.props['aria-label']?.startsWith('Letter in '))[0];
  assert.equal(letter.props.value, 'S');
  ui.button('Verder naar producten →'); ui.button('Bestelling controleren →'); await ui.submit();
  assert.equal(ui.calls.length, 1);
  assert.match(ui.calls[0].orderText, /60 × Speculaasbrok met letter.*letter S.*11,51/);
  assert.doesNotMatch(ui.calls[0].orderText, /BEDRIJF EN CONTACT|PRIJSINDICATIE|GEWENSTE LEVERING/);
  assert.equal(ui.calls[0].totalExVat.replace(/\s/g,''), '€690,60');
  assert.equal(ui.calls[0].status, 'aanvraag');
  assert.equal(order.orderText, raw, 'opening/editing never mutates the original inquiry object');
});

function addLetters(ui, quantity, withLogo, character='S', chocolate='melk', vegan=false) {
  ui.field('Letter', character); ui.field('Chocolade', chocolate); ui.field('Soort', 'spuit'); ui.field('Formaat', 'groot'); ui.field('Aantal letters', String(quantity));
  if(vegan) ui.check('Vegan',true);
  ui.check('Eigen logo op deze letters', withLogo); ui.button('+ Letter toevoegen');
}
function addPackage(ui, quantity, withLogo=false) {
  ui.button('Overige producten toevoegen');
  const product=sint.products.find(item=>item.id==='stafwerk');
  ui.field('Product',product.id);ui.field('Variant',sint.productChoiceCandidates(product)[0]);ui.field('Aantal producten',String(quantity));
  ui.check('Eigen logo op dit product',withLogo);ui.button('+ Product toevoegen');
}

test('10 letters with a logo and 3 packages without retain separate charges through save and reopening',async()=>{
  const ui=entry();ui.field('Bedrijfsnaam / klantnaam *','Logo voorbeeld');ui.button('Verder naar producten →');
  addLetters(ui,10,true);addPackage(ui,3,false);
  ui.button('Bestelling controleren →');await ui.submit();
  const saved=ui.calls[0],parsed=ui.parse(saved.orderText);
  assert.equal(saved.letterLines[0].withLogo,true);
  const letterPrice=parsed.productLines.find(line=>line.productId==='chocoladeletter'),packagePrice=parsed.productLines.find(line=>line.productId==='stafwerk');
  assert.equal(letterPrice.quantity,10);assert.equal(letterPrice.withLogo,true);assert.equal(packagePrice.withLogo,false);
  assert.equal(Number(letterPrice.unitPriceEx),13.26); // 12.80 ex VAT + 0.46 logo
  assert.equal(Number(packagePrice.unitPriceEx),Number(sint.productUnitPrice(sint.products.find(p=>p.id==='stafwerk'),sint.tierFor(sint.products.find(p=>p.id==='stafwerk'),3),false)));
  const reopened=entry('sint',{...saved,id:'logo-saved',updatedAt:'2026-10-22'});
  const checkbox=nodes(reopened.render(),n=>n.type==='input'&&n.props['aria-label']?.startsWith('Logo op letterregel'))[0];
  assert.equal(checkbox.props.checked,true);
  reopened.button('Verder naar producten →');reopened.button('Bestelling controleren →');await reopened.submit();
  assert.equal(reopened.calls[0].orderText,saved.orderText);assert.equal(reopened.calls[0].totalExVat,saved.totalExVat);
});

test('the same letter can be split into quantities with and without logos, while staffels still use the full product quantity',async()=>{
  const ui=entry();ui.field('Bedrijfsnaam / klantnaam *','Gemengd');ui.button('Verder naar producten →');
  addLetters(ui,20,true);addLetters(ui,5,false);
  ui.button('Bestelling controleren →');await ui.submit();
  const saved=ui.calls[0],prices=ui.parse(saved.orderText).productLines;
  assert.equal(saved.letterLines.length,2);
  assert.deepEqual(JSON.parse(JSON.stringify(saved.letterLines.map(line=>[line.quantity,line.withLogo]))),[[20,true],[5,false]]);
  assert.equal(prices.length,2);
  const plain=prices.find(line=>!line.withLogo),logo=prices.find(line=>line.withLogo);
  assert.equal(Math.round((Number(logo.unitPriceEx)-Number(plain.unitPriceEx))*100),46);
  const configured={...sint.products.find(p=>p.id==='chocoladeletter'),retailPriceIncl:13.95};
  assert.equal(Number(plain.unitPriceEx),sint.productUnitPrice(configured,sint.tierFor(configured,25),false));
});

test('bulk logos remain reversible per article and manually agreed unit prices change only by the logo surcharge',async()=>{
  const ui=entry();ui.field('Bedrijfsnaam / klantnaam *','Alle artikelen');ui.button('Verder naar producten →');
  addLetters(ui,10,false);addPackage(ui,3,false);
  ui.field('Prijs Stafwerk pakket','20');
  ui.button('Logo bij alle geschikte artikelen');
  ui.check('Logo op Stafwerk pakket',false);
  ui.button('Bestelling controleren →');await ui.submit();
  let saved=ui.calls[0],prices=ui.parse(saved.orderText).productLines;
  assert.equal(saved.letterLines[0].withLogo,true);assert.equal(prices.find(p=>p.productId==='stafwerk').withLogo,false);
  assert.equal(prices.find(p=>p.productId==='stafwerk').unitPriceEx,'20.00');
  const reopened=entry('sint',{...saved,id:'manual',updatedAt:'2026-10-22'});reopened.button('Verder naar producten →');
  reopened.check('Logo op Stafwerk pakket',true);
  reopened.button('Bestelling controleren →');await reopened.submit();
  assert.equal(reopened.parse(reopened.calls[0].orderText).productLines.find(p=>p.productId==='stafwerk').unitPriceEx,'20.46');
});

test('removing all logos clears only the generated logo agreement',async()=>{
  const ui=entry();ui.field('Bedrijfsnaam / klantnaam *','Geen logos');ui.button('Verder naar producten →');addLetters(ui,10,true);
  ui.button('Bestelling controleren →');await ui.submit();
  const saved={...ui.calls[0],id:'remove',updatedAt:'2026-10-22'};
  const reopened=entry('sint',saved);reopened.button('Verder naar producten →');reopened.button('Alle logo’s uit');reopened.button('Bestelling controleren →');await reopened.submit();
  assert.equal(reopened.calls[0].logo,'');assert.equal(reopened.calls[0].letterLines[0].withLogo,false);assert.doesNotMatch(reopened.calls[0].orderText,/eigen logo/);
});

test('bulk logos skip catalogue articles that do not support a logo',async()=>{
  const ui=entry();ui.field('Bedrijfsnaam / klantnaam *','Ondersteunde producten');ui.button('Verder naar producten →');addLetters(ui,10,false);
  ui.button('Overige producten toevoegen');const product=sint.products.find(item=>item.id==='marsepein-letter');
  ui.field('Product',product.id);ui.field('Variant',product.variants[0].label);ui.field('Aantal producten','3');ui.button('+ Product toevoegen');
  ui.button('Logo bij alle geschikte artikelen');ui.button('Bestelling controleren →');await ui.submit();
  assert.equal(ui.calls[0].letterLines[0].withLogo,true);
  assert.equal(ui.parse(ui.calls[0].orderText).productLines.find(line=>line.productId==='marsepein-letter').withLogo,false);
});

test('the API normalizer retains explicit true/false line choices while older orders keep their general logo fallback',()=>{
  const api=load('app/sinterklaas/sinterklaasApi.ts',{'./b2bLetterLines':letters});
  const base={id:'logo-roundtrip',customerName:'Voorbeeld',status:'aanvraag',logo:'Alleen op de pakketten',letterLines:[{id:'a',letter:'S',chocolate:'melk',style:'spuit',size:'groot',quantity:10,exceptions:[],withLogo:true},{id:'b',letter:'S',chocolate:'melk',style:'spuit',size:'groot',quantity:3,exceptions:[],withLogo:false}]};
  const result=api.normalizeB2BOrder(base);
  assert.equal(letters.b2bLetterHasLogo(result,result.letterLines[0]),true);
  assert.equal(letters.b2bLetterHasLogo(result,result.letterLines[1]),false);
  const legacy=api.normalizeB2BOrder({...base,letterLines:[{...base.letterLines[1],withLogo:null}]});
  assert.equal(letters.b2bLetterHasLogo(legacy,legacy.letterLines[0]),true);
});

function legacyLogoRequest() {
  return {...entry().blank(), id:'legacy-logo',year:'2026',season:'sint',customerName:'Voorbeeld 30 letters',status:'aanvraag',department:'chocolade',deliveryDate:'2026-11-24',updatedAt:'2026-10-22T12:04:23Z',logo:'Ja',totalExVat:'€ 366,00',orderText:'PRODUCTEN EN PRIJS\n30 × Chocolade spuitletters · Groot · € 12,20 p.s. ex btw · € 366,00',letterLines:[
    {id:'milk',letter:'P',chocolate:'melk',style:'spuit',size:'groot',quantity:29,exceptions:[]},
    {id:'vegan',letter:'P',chocolate:'puur',style:'spuit',size:'groot',quantity:1,exceptions:['vegan']},
  ]};
}

test('an older general logo agreement is priced immediately when editing: 366.00 products plus 13.80 logos',async()=>{
  const original=legacyLogoRequest(),before=JSON.stringify(original),ui=entry('sint',original);
  ui.button('Verder naar producten →');
  const cart=nodes(ui.render(),n=>n.props?.['aria-label']==='Bestelling aanpassen')[0];
  const rows=nodes(cart,n=>n.props?.['data-order-item']==='letter');
  assert.equal(rows.length,2,'show the 29 milk and 1 vegan letters exactly once');
  assert.equal(nodes(cart,n=>n.type==='input'&&n.props.type==='checkbox').length,2,'one logo control per actual letter row');
  assert.match(label(rows[0]),/Spuitletter PMelk.*29 × €\s?12,20 \+ €\s?13,34 logo/);
  assert.match(label(rows[1]),/Puur.*Vegan/);assert.doesNotMatch(label(rows[1]),/Vrij van/i);
  assert.equal(nodes(ui.render(),n=>n.props?.['aria-label']==='Afgesproken totaal excl. btw')[0].props.value,'379.80');
  const inclusive=nodes(ui.render(),n=>n.props?.['data-price-part']==='inclusive-total')[0];
  assert.match(label(inclusive),/Totaal incl\. 9% btw€\s?414,00/,'show the same inclusive total as the public folder, without a reverse-conversion rounding loss');
  assert.equal(nodes(ui.render(),n=>n.props?.className==='builderPanel')[0].props.hidden,true,'adding controls stay folded while editing the current order');
  ui.check('Logo op letterregel 2: P · puur · groot',false);
  assert.equal(nodes(ui.render(),n=>n.props?.['aria-label']==='Afgesproken totaal excl. btw')[0].props.value,'379.34');
  ui.check('Logo op letterregel 2: P · puur · groot',true);ui.button('Bestelling controleren →');await ui.submit();
  assert.equal(ui.calls[0].totalExVat.replace(/\s/g,''),'€379,80');
  assert.equal(JSON.stringify(original),before,'opening and changing the draft never overwrites the saved request');
  const again=entry('sint',{...ui.calls[0],id:'reopened'});
  assert.equal(nodes(again.render(),n=>n.props?.['aria-label']==='Afgesproken totaal excl. btw')[0].props.value,'379.80','logos must not be charged again when reopened');
});

test('logos adjust a manually agreed total instead of disappearing into an unchanged override',async()=>{
  const original=legacyLogoRequest();original.logo='';original.letterLines=original.letterLines.map(line=>({...line,withLogo:false}));
  const ui=entry('sint',original);ui.button('Verder naar producten →');
  ui.field('Afgesproken totaal excl. btw','350');ui.button('Logo bij alle geschikte artikelen');
  assert.equal(nodes(ui.render(),n=>n.props?.['aria-label']==='Afgesproken totaal excl. btw')[0].props.value,'363.80');
  const priceParts=nodes(ui.render(),n=>n.props?.className==='priceBreakdown')[0];
  assert.match(label(priceParts),/Producten€\s?366,00Logo’s30 × €\s?0,46€\s?13,80Prijsafspraak€\s?-16,00/);
  ui.check('Logo op letterregel 2: P · puur · groot',false);
  assert.equal(nodes(ui.render(),n=>n.props?.['aria-label']==='Afgesproken totaal excl. btw')[0].props.value,'363.34');
  assert.match(label(nodes(ui.render(),n=>n.props?.['data-price-part']==='inclusive-total')[0]),/€\s?396,04/,'a genuine total agreement uses its own VAT total');
  ui.button('Bestelling controleren →');await ui.submit();
  assert.equal(ui.calls[0].totalExVat.replace(/\s/g,''),'€363,34');
  const again=entry('sint',{...ui.calls[0],id:'manual-reopen'});
  assert.equal(nodes(again.render(),n=>n.props?.['aria-label']==='Afgesproken totaal excl. btw')[0].props.value,'363.34');
});

function folderQuote(lines) {
  return quoteBuilder({ requestId:'f1234567-1234-4567-8123-123456789abc',season:'sint',company:'Prijscontrole',contactName:'',email:'prijs@example.invalid',phone:'',wishes:'',consent:false,
    delivery:{method:'pickup',momentType:'date',date:'2026-11-24'},selection:{lines} });
}

test('30 letters with logos have identical folder and B2B totals, including a split milk/vegan order',async()=>{
  const ui=entry();ui.field('Bedrijfsnaam / klantnaam *','Prijscontrole');ui.button('Verder naar producten →');
  addLetters(ui,29,true,'P');addLetters(ui,1,true,'P','puur',true);
  const quote=folderQuote([
    {productId:'chocoladeletter',quantity:29,withLogo:true,letter:{letter:'P',chocolate:'melk',size:'groot',exceptions:[]}},
    {productId:'chocoladeletter',quantity:1,withLogo:true,letter:{letter:'P',chocolate:'puur',size:'groot',exceptions:['vegan']}},
  ]);
  assert.equal(quote.order.totalExVat,'379.80');assert.match(quote.order.priceAgreement,/414,00 incl/);
  assert.match(label(nodes(ui.render(),n=>n.props?.['data-price-part']==='inclusive-total')[0]),/414,00/);
  ui.button('Bestelling controleren →');await ui.submit();
  assert.equal(ui.calls[0].totalExVat.replace(/\s/g,''),'€379,80');
  assert.equal(ui.calls[0].letterLines.length,2);
  assert.equal(ui.calls[0].letterLines[1].exceptions[0],'vegan');
});

test('both sizes and styles of letters match folder prices at every tier boundary, with and without logos',()=>{
  const ui=entry();
  for(const productId of ['chocoladeletter','chocolade-vormletter']) for(const size of ['klein','groot']) for(const quantity of [1,24,25,50,51,100,101,200,201]) for(const withLogo of [false,true]) {
    if(productId==='chocolade-vormletter'&&size==='klein') continue;
    const quote=folderQuote([{productId,quantity,withLogo,letter:{letter:'S',chocolate:'melk',size,exceptions:[]}}]);
    const result=ui.prices([{id:'letter',productId,choice:productId==='chocolade-vormletter'?'':size==='groot'?'Groot':'Klein',description:'Letter',quantity,unitPriceEx:'0',manualPrice:false,withLogo}]);
    assert.equal(result.ex,Number(quote.order.totalExVat));
    assert.ok(quote.order.priceAgreement.includes(`${new Intl.NumberFormat('nl-NL',{style:'currency',currency:'EUR'}).format(result.incl)} incl. btw`));
  }
});

test('all automatic Sint variants and tier boundaries match the folder, including fixed poem options and logos',()=>{
  const ui=entry();
  let comparisons=0;
  for(const product of sint.products.filter(product=>!['chocoladeletter','chocolade-vormletter'].includes(product.id))) {
    const choices=sint.productChoiceCandidates(product);
    // Cover every variant; package letter choice does not change its price.
    const variants=product.id==='speculaasbrok-met-letter'?choices.filter(choice=>/letter M$/.test(choice)):choices;
    for(const choice of variants) for(const quantity of [1,24,25,50,51,100,101,200,201]) for(const withLogo of [false,true]) {
      if(withLogo&&!sint.productSupportsLogo(product,choice)) continue;
      const quote=folderQuote([{productId:product.id,choice,quantity,withLogo}]);
      const result=ui.prices([{id:'compare',productId:product.id,choice,description:product.name,quantity,unitPriceEx:'0',manualPrice:false,withLogo}]);
      const context=`${product.id}: ${choice}, ${quantity}, logo=${withLogo}`;
      assert.equal(result.ex,Number(quote.order.totalExVat),context);
      assert.ok(quote.order.priceAgreement.includes(`${new Intl.NumberFormat('nl-NL',{style:'currency',currency:'EUR'}).format(result.incl)} incl. btw`),context);
      comparisons++;
    }
  }
  assert.ok(comparisons>200);
});

test('Christmas automatic inclusive prices also match its folder; manual prices stay unchanged',()=>{
  const ui=entry('kerst');
  for(const product of kerst.christmasProducts) for(const quantity of [1,25,51,101,201]) {
    const result=ui.prices([{id:'kerst',productId:`kerst-${product.id}`,choice:product.detail,description:product.name,quantity,unitPriceEx:'0',manualPrice:false,withLogo:false}]);
    assert.equal(result.ex,kerst.roundMoney(quantity*kerst.christmasUnitPrice(product,quantity,false)));
    assert.equal(result.incl,kerst.roundMoney(quantity*kerst.christmasUnitPrice(product,quantity,true)));
  }
  const agreed=ui.prices([{id:'custom',productId:'anders',choice:'',description:'Prijsafspraak',quantity:3,unitPriceEx:'20.00',manualPrice:true,withLogo:false}]);
  assert.equal(agreed.ex,60);assert.equal(agreed.incl,65.4);assert.equal(agreed.lines[0].unitPriceEx,'20.00');
});

test('adding fields collapse after adding a product, and an empty agreed unit price cannot save a free product accidentally',async()=>{
  const ui=entry();ui.field('Bedrijfsnaam / klantnaam *','Nieuwe bestelling');ui.button('Verder naar producten →');
  addLetters(ui,10,false);addPackage(ui,3,false);
  assert.equal(nodes(ui.render(),n=>n.props?.className==='builderPanel')[0].props.hidden,true);
  ui.field('Prijs Stafwerk pakket','');
  nodes(ui.render(),n=>n.props?.['aria-label']==='Prijs Stafwerk pakket')[0].props.onBlur();
  ui.button('Bestelling controleren →');await ui.submit();
  assert.equal(ui.calls.length,0);assert.match(label(ui.render()),/Vul een geldige stukprijs in/);
});
