const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

function load(file, imports = {}, expose = '') {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  new Function('require', 'exports', code + '\n' + expose)(name =>
    (name === './routeHistory' || name === '@/app/bakkerij/logistiek/routeHistory') ? load('app/bakkerij/logistiek/routeHistory.ts') : name.endsWith('.module.css') ? {default:{}} : name === 'server-only' ? {} : name === '@/app/bakkerij/logistiek/roadRouting' ? load('app/bakkerij/logistiek/roadRouting.ts') : imports[name] || require(name), exports);
  return exports;
}

const delivery = load('app/bakkerij/logistiek/receiptDelivery.ts');
const parser = load('app/bakkerij/logistiek/bakeItContantbonParser.ts', {
  './receiptDelivery': delivery,
}, 'exports.page = parsePage; exports.merge = mergePageIntoDraft; exports.receipt = createReceipt;');

const header = `Contantbon
Postbus 9101
6500 HB
024-3611111
Nijmegen
62000
Week 43 woensdag 21 oktober 2026
Voorbeeld ziekenhuis
Levering 000
Artikelomschrijving\tAantal Totaalprijs`;
const firstTable = `Gesorteerd gebak € 3.533\t35
Appelkanjer € 2.750\t20
Bezorgkosten Standaard € 10.000\t1
KOSTENPL. / INKOOPNR. /REF.NR. € 0.000\t1
Kostenplaats: 661250\t1
NAAM AANVRAGER € 3.000\t1
Voorbeeld Aanvrager\t1`;
const repeatedTable = `Gesorteerd gebak € 3.533\t35 10000
Appelkanjer € 2.750\t20 50103
Bezorgkosten Standaard € 10.000\t1 310100
KOSTENPL. / INKOOPNR. /REF.NR. € 0.000\t1 310401
Kostenplaats: 661250\t1
NAAM AANVRAGER € 3.000\t1 310402
Voorbeeld Aanvrager\t1`;
const totals = `Totaalprijs excl.btw € 175,841
Btw laag € 15,826
€ 191,67`;
const address = `Voorbeeld ziekenhuis
T.a.v. Voorbeeld Aanvrager
Voorbeeldlaan 2
6525 GJ NIJMEGEN
Route 233/234 tegenover de toiletten.`;
const footer = 'Voorbeeld ziekenhuis Volgnr. Verdeler 0 Route\nAfdrukdatum 20 oktober 2026 20:15:24 Pagina 1 van 2';

function parsedReceipt(pickupFirst = false) {
  const page = parser.page(`${header}\n${firstTable}\n${totals}\n${repeatedTable}\n${totals}\nAfleveradres:\n${address}\nAfleveradres:\n${address}\n${footer}`);
  const pickup = parser.page(`${header}\nHEYENDAALSEWEG\nWordt gehaald\n${footer.replace('1 van 2', '2 van 2')}`);
  const first = pickupFirst ? pickup : page;
  const draft = { ...first, pageCount: 1 };
  parser.merge(draft, pickupFirst ? page : pickup);
  return parser.receipt(draft, 0);
}

test('pickup plus a real delivery address and positive delivery charge becomes delivery with a warning, across pages', () => {
  for (const pickupFirst of [false, true]) {
    const receipt = parsedReceipt(pickupFirst);
    assert.equal(receipt.fulfillment, 'bezorgen');
    assert.match(receipt.deliveryWarning, /Controleer bezorgadres/);
    assert.equal(receipt.deliveryAddress, address);
    assert.equal(receipt.alternativeAddress, address);
    assert(!receipt.tags.includes('afhalen'));
    assert(receipt.tags.includes('bezorgen'));
    assert.equal(receipt.value, 191.67);
  }
});

test('the two PDF text copies produce five article rows, without treating cost centres as article numbers or duplicating note text', () => {
  const receipt = parsedReceipt();
  assert.equal(receipt.lines.length, 5);
  assert.deepEqual(receipt.lines.map(line => line.articleNumber), ['10000', '50103', '310100', '310401', '310402']);
  assert.equal(receipt.lines[3].description, 'KOSTENPL. / INKOOPNR. /REF.NR.');
  assert.equal(receipt.lines[3].note, 'Kostenplaats: 661250');
  assert.equal(receipt.lines[4].description, 'NAAM AANVRAGER');
  assert.equal(receipt.lines[4].note, 'Voorbeeld Aanvrager');
  assert.equal(receipt.originalNotes, '', 'Already displayed article rows must not appear again in the note section');
});

test('original free text retains references, phone numbers, email, punctuation and line breaks', () => {
  const notes = 'Referentie 20261021, kostenplaats 661250.\nBel 024-1234567, intern 1930.\ncontact@example.com\nRoute 233/234 tegenover de toiletten.';
  const page = parser.page(`${header}\nGesorteerd gebak € 3.533\t35\n${totals}\n${notes}\n${footer}`);
  const receipt = parser.receipt({ ...page, pageCount: 1 }, 0);
  assert.equal(receipt.originalNotes, notes);
  assert.equal(receipt.customerNote, notes);
});

test('wrapped product captions and a reclame price stay in their article row, without leaking duplicated table text into notes', () => {
  const page = parser.page(`${header}\nBossche Bol € 2.243\t6\nSeizoens Cheesecake (Appel-Bitterkoek) 12 pers.\nDV Horeca\n€ 26.705\treclame\t1\n${totals}\nBossche Bol € 2.243\t6 10100\nSeizoens Cheesecake (Appel-Bitterkoek) 12 pers.\nDV Horeca\n€ 26.705\treclame\t1 20106.690\n${totals}\n${footer}`);
  const receipt = parser.receipt({ ...page, pageCount: 1 }, 0);
  assert.equal(receipt.lines.length, 2);
  assert.equal(receipt.lines[0].description, 'Bossche Bol');
  assert.equal(receipt.lines[1].description, 'Seizoens Cheesecake (Appel-Bitterkoek) 12 pers. DV Horeca');
  assert.equal(receipt.lines[1].quantity, '1');
  assert.equal(receipt.lines[1].articleNumber, '20106');
  assert.equal(receipt.lines[1].unitPrice, 26.705);
  assert.equal(receipt.originalNotes, '');
});

test('ordinary pickup, a billing address alone, zero fees and refunds are never silently changed to delivery', () => {
  const base = { ...parsedReceipt(), fulfillment: 'afhalen', deliveryWarning: undefined, tags: ['afhalen'], originalNotes: '' };
  const noCharge = { ...base, lines: base.lines.filter(line => !/bezorgkosten/i.test(line.description)) };
  assert.equal(delivery.normalizeReceiptDelivery(noCharge), noCharge);
  for (const unitPrice of [0, -10, undefined]) {
    const receipt = { ...base, lines: [{ quantity: '1', description: 'Bezorgkosten', unitPrice }] };
    assert.equal(delivery.normalizeReceiptDelivery(receipt), receipt);
  }
  for (const alternativeAddress of ['', 'Voorbeeld ziekenhuis, 6525 GJ NIJMEGEN', 'Voorbeeld ziekenhuis, route 233, 6525 GJ NIJMEGEN']) {
    const receipt = { ...base, alternativeAddress, customerNote: '', lines: [{ quantity: '1', description: 'Bezorgkosten', unitPrice: 10 }] };
    assert.equal(delivery.normalizeReceiptDelivery(receipt), receipt);
  }
});

test('already stored receipts can recover an explicit delivery address without using their billing address', () => {
  const receipt = { ...parsedReceipt(), fulfillment: 'afhalen', tags: ['afhalen'], originalNotes: undefined, alternativeAddress: 'Voorbeeld ziekenhuis, 6525 GJ NIJMEGEN', customerNote: 'Afleveradres: ' + address };
  const normalized = delivery.normalizeReceiptDelivery(receipt);
  assert.equal(normalized.deliveryAddress, address);
  assert.equal(normalized.fulfillment, 'bezorgen');
  assert.deepEqual(delivery.normalizeReceiptDelivery(normalized), normalized, 'Normalization is idempotent');
});

const dashboard = load('app/bakkerij/logistiek/BakkerijLogistiekDashboard.tsx', {
  './useRoadRouteTimes': {}, './photoPrintEditor': {},
  'next/dynamic':{default:()=>()=>null}, './roadRouting':load('app/bakkerij/logistiek/roadRouting.ts'), "../../productie/ProductionRequests":{}, react: React, 'react/jsx-runtime': require('react/jsx-runtime'),
  './routeSaveQueue': load('app/bakkerij/logistiek/routeSaveQueue.ts'),
  './sinterklaasAcquisitionCampaign': load('app/bakkerij/logistiek/sinterklaasAcquisitionCampaign.ts'),
  '../../StrikUI': {}, './routePrintWindow': {}, './routePrintPagination': {}, './arendPrintSession': {},
  './specialSchoolDelivery': {}, './specialProCollegeDelivery': {}, './receiptDelivery': delivery,
  './webshopPhotoIdentity': load('app/bakkerij/logistiek/webshopPhotoIdentity.ts'), './BusinessDeliveries': {}, './PhotoPrintChoiceModal': {}, './usePhotoPrintHistory': {}, './photoPrintTracking': {},
}, 'exports.normalize = normalizeImportedReceipt; exports.notes = visibleReceiptNotes; exports.print = createReceiptPrintHtml; exports.Row = ReceiptRow; exports.fulfillment = receiptFulfillment; exports.filter = receiptMatchesFilter; exports.overrides = applyReceiptOverrides; exports.defaults = applyFixedCustomerDefaults; exports.stop = routeStopForReceipt; exports.timing = buildRouteTiming; exports.listTime = receiptListTimeLabel; exports.serialize = serializeRouteRounds; exports.reconcile = reconcileRouteDraftRounds; exports.isShop = isShopReceipt; exports.isDelivery = isRouteDelivery; exports.plan = buildRouteRounds; exports.profile = buildDayLoadProfile; exports.day = dayPlanWithReceiptTotals;');

test('screen and print retain original note lines and show the delivery warning in the delivery list', () => {
  const originalNotes = 'Kostenplaats 661250\nReferentie 20261021, kamer 233/234\ncontact@example.com\n<script>geen HTML</script>';
  const receipt = { ...parsedReceipt(), originalNotes, customerNote: originalNotes };
  const normalized = dashboard.normalize(receipt);
  assert.equal(normalized.customerNote, originalNotes);
  assert.deepEqual(dashboard.notes(normalized, normalized.lines), [originalNotes]);
  assert.equal(dashboard.filter(normalized, 'delivery'), true);
  assert.equal(dashboard.filter(normalized, 'pickup-heyendaalseweg'), false);
  const row = renderToStaticMarkup(React.createElement(dashboard.Row, { receipt: normalized, active: true, bus: '', imageCount: 0, onSelect() {} }));
  assert.match(row, /! Controleer bezorgadres/);
  const html = dashboard.print({ receipt: normalized, notes: dashboard.notes(normalized, normalized.lines), selectedPlan: { date: '2026-10-21' } });
  assert.match(html, /Kostenplaats 661250<br \/>Referentie 20261021, kamer 233\/234<br \/>contact@example.com/);
  assert.match(html, /! Controleer bezorgadres/);
  assert.match(html, /Route 233\/234 tegenover de toiletten/);
  assert.match(html, /&lt;script&gt;geen HTML&lt;\/script&gt;/);
  assert(!html.includes('<script>geen HTML</script>'));
});

test('a deliberate manager override to pickup takes precedence over the automatic suggestion', () => {
  const receipt = parsedReceipt();
  const [overridden] = dashboard.overrides([receipt], [{ id: '2026-10-21:62000', fulfillment: 'afhalen', routeNote: 'Gecontroleerd met klant', updatedAt: '', date: '2026-10-21', removed: false }], '2026-10-21');
  assert.equal(dashboard.fulfillment(overridden), 'afhalen');
  assert.equal(overridden.deliveryWarning, undefined);
});

test('reimporting the corrected source replaces legacy parsing artifacts even when they inflated the old line count', () => {
  const { merge } = load('app/lib/bakeryLogisticsStorage.ts', {
    '@/app/bakkerij/logistiek/sinterklaasAcquisitionCampaign': {}, './supabase/admin': {}, '@/app/bakkerij/logistiek/webshopPhotoIdentity': load('app/bakkerij/logistiek/webshopPhotoIdentity.ts'),
  }, 'exports.merge = mergeReceipt;');
  const incoming = parsedReceipt();
  const existing = { ...incoming, originalNotes: undefined, fulfillment: 'afhalen', deliveryWarning: undefined, lines: [...incoming.lines, { quantity: '1', description: 'Onjuist extra artikel' }], customerNote: 'Onjuist samengevoegde tekst' };
  const merged = merge(existing, incoming);
  assert.equal(merged.lines.length, 5);
  assert.equal(merged.lines[3].note, 'Kostenplaats: 661250');
  assert.equal(merged.originalNotes, '');
  assert.equal(merged.fulfillment, 'bezorgen');
  assert(!merged.tags.includes('afhalen'));
  const correctedPickup = { ...incoming, fulfillment: 'afhalen', deliveryWarning: undefined, alternativeAddress: undefined, tags: ['afhalen'] };
  const mergedPickup = merge(merged, correctedPickup);
  assert.equal(mergedPickup.deliveryWarning, undefined);
  assert.equal(mergedPickup.alternativeAddress, undefined);
  assert(!mergedPickup.tags.includes('bezorgen'));
});

test('two equal cake rows with different photos stay two cakes while the repeated PDF table is merged once per occurrence',()=>{
 const first='Cremetaart Confetti 10-12p € 30.000\t1\nFOTO/LOGO: foto-een.jpeg € 7.500\t1\nVULLING: witte chocolade framboos € 1.000\t1\nCremetaart Confetti 10-12p € 30.000\t1\nFOTO/LOGO: foto-twee.jpeg € 7.500\t1\nVULLING: witte chocolade framboos € 1.000\t1';
 const repeated=first.replace(/30.000\t1/g,'30.000\t1 25250');
 const page=parser.page(`${header}\n${first}\n${totals}\n${repeated}\n${totals}\n${footer}`);
 for(const pickupFirst of [false,true]){
  const draft=pickupFirst?{...parser.page(`${header}\nWordt gehaald\n${footer}`),pageCount:1}:{...page,lines:page.lines.map(line=>({...line})),pageCount:1};
  parser.merge(draft,page);const receipt=parser.receipt(draft,0);
  assert.equal(receipt.lines.filter(line=>line.description.startsWith('Cremetaart')).length,2);assert.equal(receipt.lines.filter(line=>line.description.startsWith('VULLING')).length,2);assert.equal(receipt.lines.filter(line=>line.description.startsWith('FOTO')).length,2);
 }
});

test('fixed customer times remain visible guidelines without delaying the route; bon and manual times stay binding',()=>{
 const fixed={id:'fixed:61654',customerNumbers:['61654'],customerName:'De Ontdekking',deliveryWindow:'10:00 - 13:00',address:'Oude Kleefsebaan 425, Berg en Dal',routeNote:'',updatedAt:''};
 const receipt={...dashboard.normalize(parsedReceipt()),id:'61654',receiptNumber:'61654',customer:'De Ontdekking',time:'Geen tijd',note:'',customerNote:'',internalNote:'',lines:[]};
 const original=JSON.stringify(receipt);
 const apply=r=>dashboard.defaults([r],[fixed])[0];
 const guideline=apply(receipt);
 assert.equal(guideline.time,'Richttijd 10:00 - 13:00');
 assert.equal(dashboard.listTime(guideline),'Richttijd 10:00 - 13:00');
 assert.deepEqual(apply(guideline),guideline,'reapplying profiles cannot turn a guideline into an appointment');
 const planned={id:'test',stops:[dashboard.stop(guideline)]};
 const timing=dashboard.timing(planned,480).stops[0];
 assert.equal(timing.waitingMinutes,0);
 assert.equal(timing.departureMinute,timing.arrivalMinute+timing.serviceMinutes);
 assert.match(dashboard.serialize([planned])[0].stops[0].detail,/^Richttijd 10:00 - 13:00/);
 for(const specified of [{time:'10:00–13:00'},{customerNote:'Graag leveren vanaf 10:00'},{note:'Graag bezorgen vanaf 10:00'}]){
  const explicit=apply({...receipt,...specified});
  assert.doesNotMatch(explicit.time,/Richttijd/);
  const real=dashboard.timing({stops:[dashboard.stop(explicit)]},480).stops[0];
  assert.equal(real.serviceStartMinute,600);assert(real.waitingMinutes>0);
 }
 const override={id:'2026-11-28:61654',receiptId:'61654',receiptNumber:'61654',time:'10:30–12:00',date:'2026-11-28',removed:false,routeNote:''};
 const manual=apply(dashboard.overrides([receipt],[override],'2026-11-28')[0]);
 assert.equal(manual.time,'10:30–12:00');
 assert.equal(dashboard.timing({stops:[dashboard.stop(manual)]},480).stops[0].serviceStartMinute,630);
 assert.equal(JSON.stringify(receipt),original);
});


test('only complete Strik shop names are internal; external customers named after Lent or a shop street stay deliveries', () => {
  for (const customer of ['Lent', 'Winkel Ziekerstraat', 'Heyendaalseweg', 'Daalseweg', 'Strik Lent', 'Strik Patisserie Lent', 'Strik ijs Lent', 'Strik ijs Daalseweg']) {
    const page = parser.page(`${header.replace('Voorbeeld ziekenhuis', customer)}\n${firstTable}\n${totals}\n${footer.replace('Voorbeeld ziekenhuis', customer)}`);
    const receipt = parser.receipt({ ...page, pageCount: 1 }, 0);
    assert(receipt.tags.includes('intern'), customer);
    assert(receipt.tags.includes('winkel'), customer);
  }
  for (const customer of ['Café de Zon Lent', 'Restaurant Lent', 'Brasserie Daalseweg', 'Praktijk Heyendaalseweg', 'Salon Ziekerstraat', 'Talent', 'Winkel De Zon Lent']) {
    const page = parser.page(`${header.replace('Voorbeeld ziekenhuis', customer)}\n${firstTable}\n${totals}\n${footer.replace('Voorbeeld ziekenhuis', customer)}`);
    const receipt = parser.receipt({ ...page, pageCount: 1 }, 0);
    assert(!receipt.tags.includes('intern'), customer);
    assert(!receipt.tags.includes('winkel'), customer);
    assert.equal(dashboard.isShop(receipt), false, customer);
    assert.equal(dashboard.isDelivery(receipt), true, customer);
  }
});

test('an already imported Café de Zon receipt returns to deliveries and totals, without changing its order or saved stop order', () => {
  const raw = { ...parsedReceipt(), id: '63030', receiptNumber: '63030', customer: 'Café de Zon Lent',
    address: 'Oosterhoutsedijk 16, 6663 KS, NIJMEGEN', deliveryAddress: 'Oosterhoutsedijk 16, 6663 KS, NIJMEGEN',
    alternativeAddress: undefined, time: 'Geen tijd', tags: ['winkel', 'intern', 'gebak', 'bezorgen'],
    note: 'Interne winkelbon: niet meetellen in externe waarde.', internalNote: 'bezorgen · winkel · intern · gebak · bezorgen',
    value: 101.05, originalNotes: '', customerNote: 'Geen aparte opmerking.',
    lines: [{ quantity: '1', description: 'Slagroomtaart 10-12p feestelijke taart' }, { quantity: '1', description: 'Ja, foto: zie mail 26/11' }, { quantity: '1', description: 'Kersenvlaai 10-12 pers.' }, { quantity: '1', description: 'Herfstvlaai Caramel-Hazelnoot 10-12 pers.' }] };
  const receipt = dashboard.normalize(raw);
  assert.deepEqual(receipt.tags, ['gebak', 'bezorgen']);
  assert.equal(receipt.fulfillment, 'bezorgen');
  assert.equal(receipt.deliveryAddress, raw.deliveryAddress);
  assert.deepEqual(receipt.lines, raw.lines);
  assert.equal(receipt.originalNotes, raw.originalNotes);
  assert.equal(receipt.value, raw.value);
  assert.equal(dashboard.isShop(receipt), false);
  assert.equal(dashboard.isDelivery(receipt), true);
  assert.equal(dashboard.normalize(receipt), receipt, 'Existing corrections are stable');
  assert(raw.tags.includes('intern'), 'Raw source is not mutated');
  assert(!receipt.internalNote.includes('intern'));
  const day = dashboard.day({ date: '2026-11-28', iceTubs: 0, isFuture: false }, [receipt]);
  assert.equal(day.orderValue, 101.05);
  const profile = dashboard.profile(day, [receipt], '');
  const routes = dashboard.plan(day, [receipt], profile, null);
  assert.equal(routes.flatMap(route => route.stops).filter(stop => stop.sourceId === 'receipt:63030').length, 1);
  const saved = { date: day.date, excludedSourceIds: [], routes: routes.map(route => ({ ...route,
    stops: route.stops.filter(stop => stop.sourceId !== 'receipt:63030').reverse() })) };
  const restored = dashboard.reconcile(saved, routes, profile);
  assert.equal(restored.flatMap(route => route.stops).filter(stop => stop.sourceId === 'receipt:63030').length, 1);
  for (const route of saved.routes) {
    assert.deepEqual(restored.find(item => item.id === route.id).stops.filter(stop => stop.sourceId !== 'receipt:63030').map(stop => stop.sourceId), route.stops.map(stop => stop.sourceId));
  }
  const excluded = dashboard.reconcile({ ...saved, excludedSourceIds: ['receipt:63030'] }, routes, profile);
  assert(!excluded.flatMap(route => route.stops).some(stop => stop.sourceId === 'receipt:63030'));
});

test('legacy shop correction keeps real shop/ice receipts, unrelated internal records and customer instructions', () => {
  const base = { ...parsedReceipt(), tags: ['winkel', 'intern', 'ijs'], note: 'Apart verpakken', internalNote: 'bezorgen · winkel · intern · instructie behouden' };
  for (const customer of ['Lent', 'Winkel Ziekerstraat', 'Strik ijs Lent', 'Strik ijs Daalseweg']) {
    const receipt = { ...base, customer };
    assert.equal(delivery.normalizeReceiptDelivery(receipt), receipt);
  }
  const internal = { ...base, customer: 'Interne administratie', tags: ['intern'] };
  assert.equal(delivery.normalizeReceiptDelivery(internal), internal);
  const corrected = delivery.normalizeReceiptDelivery({ ...base, customer: 'Café de Zon Lent', fulfillment: 'afhalen', lines: [], originalNotes: '' });
  assert.equal(corrected.fulfillment, 'afhalen', 'Pickup is not changed by the shop correction');
  assert.deepEqual(corrected.tags, ['ijs']);
  assert.equal(corrected.note, 'Apart verpakken');
  assert.equal(corrected.internalNote, 'bezorgen · instructie behouden');
});
