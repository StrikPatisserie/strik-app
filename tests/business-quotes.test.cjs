const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const ts = require('typescript');
function load(file, overrides = {}, globals = {}) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { exports, URL, Buffer, Request, Response, AbortSignal, process: { env: {} }, ...globals, require(name) {
    if (name in overrides) return overrides[name];
    if (name.startsWith('@/')) return load(`${name.slice(2)}.ts`);
    if (name.startsWith('.')) return load(path.resolve(path.dirname(file), `${name}.ts`));
    return require(name);
  } });
  return exports;
}
const { buildBusinessFolderQuote: build } = load('app/lib/businessFolderQuote.ts');
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
  for (const text of ['25 × Bonbondoosje', '25 gelijke pakketten', '3 × Kerstchocolade', '0612345678', 'Voorbeeldstraat 1', '2026-12-18', 'Een kaartje per pakket', '915,00', 'nog worden bevestigd']) assert.ok(quote.quoteText.includes(text), text);
  assert.equal(quote.snapshot.email, 'test@example.invalid');
  assert.equal(quote.snapshot.consent, false);
  assert.equal(quote.snapshot.selection.contents.kerstchocolade, 3);
  assert.equal(quote.payloadHash, build(JSON.parse(JSON.stringify(input))).payloadHash);
  input.wishes = 'Gewijzigd';
  assert.notEqual(build(input).payloadHash, quote.payloadHash);
});
test('Sint letter prices share the quantity tier and retain logo, gift wrap, exceptions and requested week', () => {
  const input = fixture('sint');
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
  assert.match(quote.quoteText, /inclusief eigen logo/);
  assert.match(quote.quoteText, /cadeaupapier.*0,25/);
  input.selection.lines[0].letter.exceptions = [['vegan']];
  assert.throws(() => build(input), /bijzondere wensen/);
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
  const api = load('app/api/business-folder-quote/route.ts', { 'next/server': { NextResponse: Response }, '@/app/lib/businessFolderQuote': { buildBusinessFolderQuote: build } }, {
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
  assert.match(editable, /25 × Bonbondoosje Fijne Feestdagen · 16 stuks · in een luxe doosje/);
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
