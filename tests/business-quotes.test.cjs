const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const ts = require('typescript');
const FixedDate = class extends Date { constructor(...args) { super(...(args.length ? args : ['2026-11-25T09:00:00Z'])); } };
function load(file, overrides = {}, globals = {}) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { exports, Error, SyntaxError, URL, Buffer, Request, Response, AbortSignal, Date: FixedDate, process: { env: {} }, ...globals, require(name) {
    if (name in overrides) return overrides[name];
    if (name.startsWith('@/')) return load(`${name.slice(2)}.ts`);
    if (name.startsWith('.')) return load(path.resolve(path.dirname(file), `${name}.ts`));
    return require(name);
  } });
  return exports;
}
const { buildBusinessFolderQuote: build } = load('app/lib/businessFolderQuote.ts');
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aXioAAAAASUVORK5CYII=', 'base64');
function logoFixture(season = 'kerst') {
  const input = fixture(season);
  input.logoRequested = true;
  if (season === 'sint') input.selection = { lines: [{ productId: 'chocoladeletter', quantity: 25, withLogo: true, letter: { letter: 'S', size: 'groot', chocolate: 'melk', exceptions: [] } }] };
  return input;
}
function logoRequest(input, bytes = png, name = 'logo.png', origin = 'https://app.example.invalid') {
  const form = new FormData();
  form.set('quote', JSON.stringify(input));
  if (bytes) form.set('logo', new File([bytes], name));
  return new Request('https://app.example.invalid/api/business-folder-quote', { method: 'POST', headers: { origin }, body: form });
}

test('logo choices are required for both folders; verified uploads and email promises survive in order and year snapshot', () => {
  for (const season of ['sint', 'kerst']) {
    const input = logoFixture(season);
    assert.throws(() => build(input), /Kies of je het logo/);
    input.logoDelivery = 'upload';
    input.uploadedLogo = { name: 'forged.png', sha256: 'fake' };
    assert.throws(() => build(input), /Voeg je logobestand/);
    input.logoDelivery = 'email';
    const later = build(input, 2027);
    assert.equal(later.order.year, '2027');
    assert.match(later.order.logo, /later per mail/);
    assert.match(later.quoteText, /LOGO\nEigen logo.*later per mail/);
    assert.equal(later.snapshot.logoDelivery.method, 'email');
    input.logoDelivery = 'upload';
    const uploaded = { name: 'voorbeeld.png', size: png.length, sha256: 'a'.repeat(64) };
    const quote = build(input, 2027, uploaded);
    assert.match(quote.order.logo, /voorbeeld.png/);
    assert.match(quote.reference, /27-/);
    assert.equal(quote.snapshot.logoDelivery.file.sha256, uploaded.sha256);
    assert.notEqual(quote.payloadHash, later.payloadHash);
    assert.notEqual(quote.payloadHash, build(input, 2027, { ...uploaded, sha256: 'b'.repeat(64) }).payloadHash, 'different bytes cannot reuse an accepted receipt');
    assert.equal(quote.order.totalExVat, later.order.totalExVat, 'upload method never changes the product price');
  }
  assert.throws(() => build(fixture(), 2026, { name: 'extra.png' }), /aanvraag met logo/);
});

test('public multipart uploads validate files before saving and do not confirm receipt until the logo is saved', async () => {
  const saved = [], backendCalls = [];
  let storageFails = false, backendStatus = 200, mismatch = false, backendSaved = true;
  const api = load('app/api/business-folder-quote/route.ts', {
    '@/app/feestdagen/server': { getActiveSeason: async () => ({ year: 2027, config: { business: true, startDate: '2027-01-01', endDate: '2027-12-31' } }) },
    'next/server': { NextResponse: Response },
    '@/app/lib/businessFolderQuote': { buildBusinessFolderQuote: build },
    '@/app/lib/businessFolderLogo.server': { saveBusinessFolderLogo: async (order, logo) => { if (storageFails) throw Error('test'); saved.push({ order, logo }); } },
  }, { fetch: async (_url, options) => {
    const quote = JSON.parse(options.body); backendCalls.push(quote);
    return Response.json({ ok: true, saved: backendSaved, mailSent: true, reference: mismatch ? 'wrong' : quote.reference }, { status: backendStatus });
  } });
  const input = { ...logoFixture(), logoDelivery: 'upload' }; input.delivery.date = '2027-12-18';
  for (const [bytes, name, status] of [[null, 'logo.png', 400], [Buffer.from('<svg>test</svg>'), 'logo.png', 400], [png, 'logo.svg', 400], [Buffer.alloc(4 * 1024 * 1024 + 1), 'logo.png', 413]]) {
    assert.equal((await api.POST(logoRequest(input, bytes, name))).status, status);
  }
  assert.equal((await api.POST(logoRequest(input, png, 'logo.png', 'https://other.invalid'))).status, 403);
  assert.equal(backendCalls.length, 0);
  assert.equal((await api.POST(logoRequest(input))).status, 200);
  assert.equal(saved.length, 1);
  assert.equal(saved[0].order.id, `folder-${input.requestId}`);
  assert.equal(saved[0].order.year, '2027');
  assert.equal(saved[0].logo.contentType, 'image/png');
  assert.equal(saved[0].logo.bytes.toString('base64'), png.toString('base64'));
  assert.equal(backendCalls[0].snapshot.logoDelivery.file.sha256, saved[0].logo.sha256);
  assert.ok(!JSON.stringify(backendCalls[0]).includes(png.toString('base64')), 'file bytes stay out of email/order metadata');
  storageFails = true;
  const failed = await api.POST(logoRequest(input));
  assert.equal(failed.status, 503); assert.match((await failed.json()).message, /logo nog niet/);
  storageFails = false;
  assert.equal((await api.POST(logoRequest(input))).status, 200);
  assert.equal(backendCalls[0].payloadHash, backendCalls[2].payloadHash);
  const count = saved.length;
  mismatch = true;
  assert.notEqual((await api.POST(logoRequest(input))).status, 200);
  mismatch = false; backendStatus = 409;
  assert.notEqual((await api.POST(logoRequest(input))).status, 200);
  backendStatus = 200; backendSaved = false;
  assert.notEqual((await api.POST(logoRequest(input))).status, 200);
  assert.equal(saved.length, count, 'no upload on conflicting, unconfirmed or mismatched request');
});

test('logo storage retries never overwrite staff edits or print status, and retain the exact order and edition', async () => {
  const rows = new Map();
  const db = { from(table) {
    assert.equal(table, 'b2b_order_logos');
    return { upsert(row, options) {
      assert.equal(options.onConflict, 'id'); assert.equal(options.ignoreDuplicates, true);
      if (!rows.has(row.id)) rows.set(row.id, row);
      return { abortSignal: async () => ({ error: null }) };
    } };
  } };
  const storage = load('app/lib/businessFolderLogo.server.ts', { 'server-only': {}, './supabase/admin': { createAdminClient: () => db } });
  const logo = { name: 'logo.png', bytes: png, size: png.length, sha256: 'a'.repeat(64), contentType: 'image/png' };
  await storage.saveBusinessFolderLogo({ id: 'folder-test', year: '2027' }, logo);
  const first = [...rows.values()][0];
  assert.equal(first.order_id, 'folder-test'); assert.equal(first.season, 2027); assert.equal(first.quantity, 0);
  assert.equal(first.bytes_base64, png.toString('base64'));
  first.quantity = 125; first.width_cm = 5; first.printed_at = '2027-11-10';
  await storage.saveBusinessFolderLogo({ id: 'folder-test', year: '2027' }, logo);
  assert.equal(rows.size, 1); assert.equal(first.quantity, 125); assert.equal(first.printed_at, '2027-11-10');
  await storage.saveBusinessFolderLogo({ id: 'folder-test', year: '2028' }, logo);
  assert.equal(rows.size, 2);
});
function fixture(season = 'kerst') {
  return { requestId: 'f1234567-1234-4567-8123-123456789abc', season, company: 'Voorbeeld & Co', contactName: 'Testpersoon', email: 'TEST@example.invalid', phone: '0612345678', wishes: 'Een kaartje per pakket', consent: false,
    delivery: { method: 'delivery', address: 'Voorbeeldstraat 1', momentType: 'date', date: '2026-12-18' },
    selection: { singles: { bonbons: 25 }, contents: { 'stol-klein': 1, kerstchocolade: 3 }, packageCount: 25, vegan: false } };
}
test('full Christmas requests preserve package contents and server-calculated indicative prices', () => {
  const input = fixture();
  input.totalEx = 0.01; input.quoteText = 'forged';
  const quote = build(input);
  assert.equal(quote.order.status, 'aanvraag');
  assert.equal(quote.order.season, 'kerst');
  assert.equal(quote.order.totalExVat, '839.50');
  for (const text of ['25 × Bonbondoosje', '25 gelijke pakketten', '3 × Kerstchocolade', '0612345678', 'Voorbeeldstraat 1', 'vr 18 dec 2026', 'Een kaartje per pakket', '915,00']) assert.ok(quote.quoteText.includes(text), text);
  assert.doesNotMatch(quote.quoteText,/Vrijblijvende aanvraag;|nog worden bevestigd/);
  assert.equal(quote.snapshot.email, 'test@example.invalid');
  assert.equal(quote.snapshot.consent, false);
  assert.equal(quote.snapshot.selection.contents.kerstchocolade, 3);
  assert.equal(quote.payloadHash, build(JSON.parse(JSON.stringify(input))).payloadHash);
  input.wishes = 'Gewijzigd';
  assert.notEqual(build(input).payloadHash, quote.payloadHash);
});
test('Sint letter prices share the quantity tier and retain logo, gift wrap, exceptions and requested week', () => {
  const input = fixture('sint');
  input.logoDelivery = 'email';
  input.delivery = { method: 'pickup', momentType: 'week', weekStart: '2026-11-23' };
  input.selection = { lines: [
    { productId: 'chocoladeletter', quantity: 10, withLogo: true, withGiftWrap: true, letter: { letter: 'A', size: 'klein', chocolate: 'melk', exceptions: [] } },
    { productId: 'chocoladeletter', quantity: 15, withLogo: true, withGiftWrap: true, letter: { letter: 'B', size: 'groot', chocolate: 'puur', exceptions: ['vegan'] } },
  ] };
  const quote = build(input);
  assert.equal(quote.order.totalExVat, '278.65');
  assert.equal(quote.order.letterLines.length, 2);
  assert.equal(quote.order.department, 'chocolade');
  assert.equal(quote.order.letterLines[1].exceptions[0], 'vegan');
  assert.equal(quote.order.deliveryWindowType, 'range');
  assert.equal(quote.order.deliveryDateEnd, '2026-11-29');
  assert.match(quote.quoteText, /Tussen ma 23 nov en zo 29 nov 2026/);
  assert.match(quote.quoteText, /inclusief eigen logo/);
  assert.match(quote.quoteText, /cadeaupapier.*0,25/);
  input.selection.lines[0].letter.exceptions = [['vegan']];
  assert.throws(() => build(input), /bijzondere wensen/);
});

test('Dutch delivery labels retain actual weekdays and years, without empty or repeated quote boilerplate', () => {
  const {formatBusinessDeliveryMoment:format}=load('app/lib/businessDeliveryMoment.ts');
  assert.equal(format('2026-11-23'),'ma 23 nov 2026');
  assert.equal(format('2026-11-30','2026-12-06'),'Tussen ma 30 nov en zo 6 dec 2026');
  assert.equal(format('2026-12-28','2027-01-03'),'Tussen ma 28 dec 2026 en zo 3 jan 2027');
  assert.equal(format(''),'In overleg');
  const input=fixture();input.phone='';input.contactName='';input.wishes='';
  const quote=build(input);
  assert.doesNotMatch(quote.quoteText,/Niet opgegeven|Geen aanvullende wensen|\nWENSEN\n|Vrijblijvende aanvraag/);
  assert.equal(quote.order.deliveryDate,'2026-12-18','machine-readable dates are unchanged');
});
test('Sint variants retain fixed personalization surcharges and reject unknown selections', () => {
  const input = fixture('sint');
  input.selection = { lines: [{ productId: 'speculaasplak-gedicht', quantity: 25, choice: 'Zonder amandel · met gedicht (+ € 2)', withLogo: true }] };
  const quote = build(input);
  // 4.95 minus 5%, rounded up to 4.75, plus the unchanged EUR 2 poem.
  assert.equal(quote.order.totalExVat, '154.75');
  assert.equal(quote.order.logo, '');
  input.selection.lines[0].choice = 'Unknown';
  assert.throws(() => build(input), /productuitvoering/);
});
test('invalid payloads cannot create orders, including malformed dates, nonfinite counts and header injection', () => {
  for (const mutate of [
    input => input.email = 'a@example.invalid\r\nBcc: other@example.invalid',
    input => input.selection.singles.bonbons = -1,
    input => input.selection.singles.bonbons = Infinity,
    input => input.selection.singles.unknown = 1,
    input => input.delivery.date = '2026-02-30',
    input => input.requestId = 'bad',
    input => input.wishes = 'a'.repeat(2001),
    input => input.selection = { singles: {}, contents: {}, packageCount: 1 },
  ]) { const input = fixture(); mutate(input); assert.throws(() => build(input)); }
});
test('public API validates origin and actual body size, and confirms success only after storage and mail', async () => {
  const calls = [];
  let backend = { ok: true, saved: true, mailSent: true, reference: build(fixture()).reference };
  const api = load('app/api/business-folder-quote/route.ts', { '@/app/feestdagen/server': {getActiveSeason:async()=>({year:2026,config:{business:true,startDate:'2026-01-01',endDate:'2026-12-31'}})}, 'next/server': { NextResponse: Response }, '@/app/lib/businessFolderQuote': { buildBusinessFolderQuote: build } }, {
    fetch: async (url, options) => { calls.push(JSON.parse(options.body)); return Response.json(backend); },
  });
  const request = (input = fixture(), origin = 'https://app.example.invalid') => new Request('https://app.example.invalid/api/business-folder-quote', { method: 'POST', headers: { origin, 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
  assert.equal((await api.POST(request(fixture(), 'https://other.example.invalid'))).status, 403);
  assert.equal((await api.POST(request({ ...fixture(), wishes: 'a'.repeat(64000) }))).status, 413);
  assert.equal((await api.POST(request({ ...fixture(), email: 'invalid' }))).status, 400);
  assert.equal((await api.POST(request({ ...fixture(), website: 'autofilled.example' }))).status, 400);
  assert.equal(calls.length, 0);
  assert.equal((await api.POST(request())).status, 200);
  assert.equal(calls[0].order.status, 'aanvraag');
  backend = { saved: true, mailSent: false };
  const failed = await api.POST(request());
  assert.equal(failed.status, 503);
  assert.equal((await failed.json()).saved, true);
  assert.equal(calls[0].requestId, calls[1].requestId);
  backend = { ok: true, saved: false, mailSent: true };
  assert.equal((await api.POST(request())).status, 502);
});

const { editableFolderOrderText } = load('app/lib/businessFolderOrderText.ts');
test('real folder requests convert both Christmas singles and complete packages without losing contents or double-counting', () => {
  const quote = build(fixture());
  const editable = editableFolderOrderText(quote.quoteText);
  assert.ok(editable.startsWith('PRODUCTEN EN PRIJS\n'));
  assert.match(editable, /25 × Bonbondoosje Fijne Feestdagen · 9 stuks · in een luxe doosje/);
  assert.match(editable, /25 × Kerstpakket op maat · per pakket: 1 × Kleine kerststol .*3 × Kerstchocolade/);
  assert.match(editable, /Wensen uit aanvraag: Een kaartje per pakket/);
  assert.match(editable, /Passende tas of doos/);
  const rows = editable.split('\n').filter(row => /^\d+ ×/.test(row));
  assert.equal(rows.length, 2, 'package contents remain one package, not extra separately charged products');
  const total = rows.reduce((sum,row) => {
    const match = row.match(/ · €\s*([\d.,]+)$/);
    return sum + Number(match[1].replace(/\./g,'').replace(',','.'));
  },0);
  assert.equal(total.toFixed(2), quote.order.totalExVat);
});
test('folder conversion preserves letter charges, logo, dietary requirements, wrapping and custom product details', () => {
  const input = fixture('sint');
  input.logoDelivery = 'email';
  input.selection = { lines: [
    { productId: 'chocoladeletter', quantity: 25, withLogo: true, withGiftWrap: true, letter: { letter: 'M', size: 'groot', chocolate: 'puur', exceptions: ['vegan','notenvrij'] } },
    { productId: 'speculaasbrok-met-letter', quantity: 60 },
  ] };
  const quote = build(input);
  const editable = editableFolderOrderText(quote.quoteText);
  assert.match(editable, /25 × Chocolade spuitletters · spuitletter M groot · puur · vegan, notenvrij · eigen logo/);
  assert.match(editable, /inclusief cadeaupapier.*0,25/);
  assert.match(editable, /60 × Speculaasbrok met letter.*letter S/);
  assert.equal(editableFolderOrderText('Handmatige bestelling met eigen afspraken'), null);
  assert.equal(editableFolderOrderText('BEDRIJF EN CONTACT\nGEKOZEN SINTERKLAASPRODUCTEN\nOnbekende invoer\nPRIJSINDICATIE\n€ 10,00'), null);
});

test('all four shops and Malden are canonical pickup options in quote, snapshot and original order',()=>{
 const {BUSINESS_PICKUP_LOCATIONS}=load('app/lib/businessPickupLocations.ts');assert.equal(BUSINESS_PICKUP_LOCATIONS.length,5);
 for(const location of BUSINESS_PICKUP_LOCATIONS){const input=fixture();input.delivery={method:'pickup',pickupLocation:location.id,momentType:'date',date:'2026-12-18'};const result=build(input);assert.equal(result.snapshot.delivery.pickupLocation,location.id);assert.match(result.order.deliveryMethod,new RegExp(location.label.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));assert(result.quoteText.includes(location.label));}
 const input=fixture();input.delivery={method:'pickup',pickupLocation:'malden',momentType:'date',date:'2026-12-18'};
 assert.match(build(input).order.deliveryMethod,/Bakkerij Malden · Ambachtsweg 4/);
 const total=build(input).order.totalExVat;
 input.delivery.pickupLocation='lent';assert.equal(build(input).order.totalExVat,total);
 for(const value of ['', 'forged', '<script>']){input.delivery.pickupLocation=value;assert.throws(()=>build(input),/afhaalvestiging/);}
 input.delivery={method:'pickup',momentType:'date',date:'2026-12-18'};assert.equal(build(input).order.deliveryMethod,'Afhalen bij Strik','old requests remain compatible');
});

test('new edition quotes use their own year and retry identity',()=>{
 const input=fixture();input.delivery.date='2027-12-17';const next=build(input,2027);
 assert.equal(next.order.year,'2027');assert.match(next.reference,/KERST27-/);assert.notEqual(next.payloadHash,build(fixture(),2026).payloadHash);
});

const deliveryPolicy = load('app/lib/businessFolderDelivery.ts');
test('three working days exclude ordering day and weekends using the Amsterdam calendar', () => {
  for (const [ordered, earliest] of [
    ['2026-11-25T09:00:00Z', '2026-11-30'],
    ['2026-11-26T09:00:00Z', '2026-12-01'],
    ['2026-11-27T09:00:00Z', '2026-12-02'],
    ['2026-11-28T09:00:00Z', '2026-12-02'],
    ['2026-11-29T09:00:00Z', '2026-12-02'],
    ['2026-11-30T09:00:00Z', '2026-12-03'],
    ['2026-11-25T23:30:00Z', '2026-12-01'],
    ['2026-03-27T23:30:00Z', '2026-04-01'],
    ['2026-12-31T09:00:00Z', '2027-01-05'],
  ]) assert.equal(deliveryPolicy.earliestBusinessFolderDelivery(new Date(ordered)), earliest, ordered);
});
test('folder API rejects short-notice dates and weeks before saving or mailing, for both folders and delivery methods', async () => {
  const calls = [];
  const api = load('app/api/business-folder-quote/route.ts', {
    '@/app/feestdagen/server': { getActiveSeason: async () => ({ year: 2026, config: { business: true, startDate: '2026-01-01', endDate: '2026-12-31' } }) },
    'next/server': { NextResponse: Response },
  }, { fetch: async (url, options) => { const body = JSON.parse(options.body); calls.push(body); return Response.json({ok: true, saved: true, mailSent: true, reference: body.reference}); } });
  const post = input => api.POST(new Request('https://app.example.invalid/api/business-folder-quote', { method: 'POST', headers: { origin: 'https://app.example.invalid', 'Content-Type': 'application/json' }, body: JSON.stringify(input) }));
  for (const season of ['sint', 'kerst']) for (const method of ['pickup', 'delivery']) {
    const input = fixture(season);
    if (season === 'sint') input.selection = { lines: [{ productId: 'speculaasbrok-met-letter', quantity: 20 }] };
    input.delivery.method = method;
    for (const date of ['2026-11-24', '2026-11-25', '2026-11-26', '2026-11-27', '2026-11-28', '2026-11-29']) {
      input.delivery.date = date;
      const before = calls.length, response = await post(input);
      assert.equal(response.status, 400);
      assert.match((await response.json()).message, /3 werkdagen/);
      assert.equal(calls.length, before, 'no save or email for rejected dates');
    }
    input.delivery.date = '2026-11-30';
    assert.equal((await post(input)).status, 200);
    input.delivery = { ...input.delivery, momentType: 'week', weekStart: '2026-11-23' };
    const before = calls.length;
    assert.equal((await post(input)).status, 400);
    assert.equal(calls.length, before);
    input.delivery.weekStart = '2026-11-30';
    assert.equal((await post(input)).status, 200);
  }
  const consultation = fixture(); consultation.delivery.date = '';
  assert.equal((await post(consultation)).status, 200, 'Christmas can still request consultation');
});
