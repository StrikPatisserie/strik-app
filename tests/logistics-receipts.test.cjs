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
    name === 'server-only' ? {} : imports[name] || require(name), exports);
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
  react: React, 'react/jsx-runtime': require('react/jsx-runtime'),
  '../../StrikUI': {}, './routePrintWindow': {}, './routePrintPagination': {}, './arendPrintSession': {},
  './specialSchoolDelivery': {}, './specialProCollegeDelivery': {}, './receiptDelivery': delivery,
  './BusinessDeliveries': {}, './PhotoPrintChoiceModal': {}, './usePhotoPrintHistory': {}, './photoPrintTracking': {},
}, 'exports.normalize = normalizeImportedReceipt; exports.notes = visibleReceiptNotes; exports.print = createReceiptPrintHtml; exports.Row = ReceiptRow; exports.fulfillment = receiptFulfillment; exports.filter = receiptMatchesFilter; exports.overrides = applyReceiptOverrides;');

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
    '@/app/bakkerij/logistiek/sinterklaasAcquisitionCampaign': {}, './supabase/admin': {},
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
