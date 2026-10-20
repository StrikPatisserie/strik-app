const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');

function load(file, imports = {}, globals = {}) {
  const exports = {};
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText;
  vm.runInNewContext(source, { exports, ...globals, require(name) {
    if (name in imports) return imports[name];
    if (name === 'react/jsx-runtime') return require(name);
    return { default: name };
  } });
  return exports;
}
function find(node, predicate) {
  if (!node || typeof node !== 'object') return undefined;
  if (Array.isArray(node)) return node.map(child => find(child, predicate)).find(Boolean);
  return predicate(node) ? node : find(node.props?.children, predicate);
}
function component(file, imports, globals) {
  const states = [];
  let cursor = 0;
  let refCursor = 0;
  const refs = [];
  const hooks = { ...React, useEffect() {}, useMemo(callback) { return callback(); }, useRef(initial) { const index = refCursor++; return refs[index] ||= { current: initial }; },
    useState(initial) { const index = cursor++; if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial; return [states[index], value => { states[index] = typeof value === 'function' ? value(states[index]) : value; }]; },
  };
  const loaded = load(file, { "./sintProducts": sintCatalog, ...imports, react: hooks }, { crypto: require("node:crypto").webcrypto, ...globals });
  return { render(props = {}) { cursor = 0; refCursor = 0; return loaded.default(props); } };
}
const pricing = load('app/lib/business-folder-pricing.ts');
const wrapping = load('app/lib/letter-pricing.ts');
const sintCatalog = load('app/sint-voor-bedrijven/sintProducts.ts', { '@/app/lib/business-folder-pricing': pricing });
const catalog = load('app/kerst-voor-bedrijven/christmasProducts.ts', { '@/app/lib/business-folder-pricing': pricing });

test('letter gift wrapping is EUR 0.25 including VAT and is not reduced by product staffels', () => {
  assert.equal(wrapping.LETTER_GIFT_WRAP_PRICE_CENTS, 25);
  assert.equal(wrapping.letterGiftWrapPrice(true), 0.25);
  assert.equal(wrapping.letterGiftWrapPrice(false), 0.23);
  const sint = component('app/sint-voor-bedrijven/SintB2BConcept.tsx', {
    '@/app/lib/business-folder-pricing': pricing, '@/app/lib/letter-pricing': wrapping,
    './B2BChocolateLetters': { default: 'Letters', describeB2BLetter: line => `spuitletter ${line.letter} ${line.size}` },
  });
  let card = find(sint.render(), node => node.type === 'Letters' && node.props.style === 'spuit');
  card.props.onChange([{ id: 'test', style: 'spuit', chocolate: 'melk', letter: 'S', size: 'groot', quantity: 25, specialRequests: [] }]);
  card = find(sint.render(), node => node.type === 'Letters' && node.props.style === 'spuit');
  const withoutWrap = card.props.total;
  card.props.onGiftWrapChange(true);
  card = find(sint.render(), node => node.type === 'Letters' && node.props.style === 'spuit');
  assert.equal(card.props.total, 338.75);
  assert.equal(card.props.total - withoutWrap, 6.25, '25 letters add exactly 25 x EUR 0.25');
  find(sint.render(), node => node.type === 'button' && node.props.children === 'Bekijk offerteaanvraag').props.onClick();
  const offer = find(sint.render(), node => node.type === 'pre').props.children;
  assert.match(offer, /In cadeaupapier:.*0,23.*0,25/);
  assert.match(offer, /338,75.*incl\. btw/);
});

function christmasQuote(response = { ok: true, json: async () => ({ ok: true, reference: "KERST26-TEST" }) }) {
  const calls = [];
  const ui = component('app/kerst-voor-bedrijven/KerstB2BConcept.tsx', {
    './christmasProducts': catalog, '@/app/lib/business-folder-pricing': pricing,
  }, { fetch: async (url, options) => { calls.push({ url, body: JSON.parse(options.body) }); return response; } });
  function counter(label, value) { find(ui.render(), node => node.props?.label === label && node.props?.onChange).props.onChange(value); }
  function field(label, value) {
    const input = find(find(ui.render(), node => node.type === 'label' && Array.isArray(node.props.children) && node.props.children[0] === label), node => node.type === 'input' || node.type === 'textarea' || node.type === 'select');
    assert.ok(input, label);
    input.props.onChange({ target: { value } });
  }
  counter('Aantal Bonbondoosje Fijne Feestdagen los', 25);
  counter('Aantal Kleine kerststol per pakket', 1);
  counter('Aantal Kerstchocolade per pakket', 3);
  counter('Aantal gelijke pakketten', 25);
  find(ui.render(), node => node.type === 'button' && Array.isArray(node.props.children) && node.props.children[0] === 'Bekijk aanvraag ').props.onClick();
  field('Bedrijf', 'Voorbeeld BV');
  field('Contactpersoon', 'Testpersoon');
  field('E-mailadres', 'test@example.invalid');
  field('Telefoon · optioneel', '0612345678');
  field('Gewenste datum · of in overleg', '2026-12-18');
  field('Afhalen of bezorgen', 'delivery');
  field('Afleveradres', 'Voorbeeldstraat 1');
  field('Wensen · verpakking, logo of kaartje', 'Een kaartje per pakket');
  return { ...ui, calls, field, submit: () => find(ui.render(), node => node.type === 'form').props.onSubmit({ preventDefault() {} }) };
}

test('Christmas quote submits the complete mixed selection directly and confirms receipt', async () => {
  const quote = christmasQuote();
  const preview = find(quote.render(), node => node.type === 'pre').props.children;
  assert.match(preview, /25 × Bonbondoosje/);
  assert.match(preview, /25 gelijke pakketten/);
  assert.match(preview, /3 × Kerstchocolade/);
  assert.match(preview, /18 december 2026/);
  assert.match(preview, /0612345678/);
  assert.match(preview, /Bezorgen op aanvraag: Voorbeeldstraat 1/);
  assert.match(preview, /Een kaartje per pakket/);
  await quote.submit();
  assert.equal(quote.calls.length, 1);
  assert.equal(quote.calls[0].url, '/api/business-folder-quote');
  assert.equal(quote.calls[0].body.season, 'kerst');
  assert.equal(quote.calls[0].body.selection.singles.bonbons, 25);
  assert.equal(quote.calls[0].body.selection.contents.kerstchocolade, 3);
  assert.equal(quote.calls[0].body.selection.packageCount, 25);
  assert.equal(quote.calls[0].body.delivery.address, 'Voorbeeldstraat 1');
  assert.equal(quote.calls[0].body.phone, '0612345678');
  assert.equal(quote.calls[0].body.wishes, 'Een kaartje per pakket');
  assert.equal(quote.calls[0].body.consent, false);
  const status = find(quote.render(), node => node.props?.role === 'status');
  assert.match(status.props.children.join(''), /Aanvraag ontvangen!.*KERST26-TEST/);
  await quote.submit();
  assert.equal(quote.calls.length, 1, 'a successfully submitted request cannot be sent again');
  quote.field('Telefoon · optioneel', '0699999999');
  assert.equal(find(quote.render(), node => node.props?.role === 'status'), undefined, 'all quote details participate in the submission signature');
});

test('a failed quote remains editable and retry uses the same idempotency key', async () => {
  const quote = christmasQuote({ ok: false, json: async () => ({ saved: true, message: 'Aanvraag opgeslagen; mail nog niet verstuurd.' }) });
  await quote.submit();
  assert.ok(find(quote.render(), node => node.props?.role === 'alert'));
  assert.equal(find(quote.render(), node => node.props?.role === 'status'), undefined);
  await quote.submit();
  assert.equal(quote.calls[0].body.requestId, quote.calls[1].body.requestId);
  quote.field('Wensen · verpakking, logo of kaartje', 'Gewijzigde wens');
  await quote.submit();
  assert.notEqual(quote.calls[0].body.requestId, quote.calls[2].body.requestId);
});

test('newsletter signup remains independent and legacy contact-only quotes ask to refresh', async () => {
  const saved = [], requests = [];
  let failStorage = false;
  const api = load('app/api/business-folder-signup/route.ts', {
    'next/server': { NextResponse: Response },
    '@/app/api/sinterklaas-mailing/seed2024': { b2bCustomers2024: [] },
    '@/app/lib/businessFolderContacts': { saveFolderContact: async (...args) => { if (failStorage) throw new Error('storage test failure'); saved.push(args); } },
  }, { URL, process: { env: {} }, crypto: require('node:crypto').webcrypto, console: { error() {} },
    fetch: async (url, options) => { requests.push(options); return Response.json(options.method === 'POST' ? { ok: true } : { customers: [] }); },
  });
  const input = { company: 'Voorbeeld BV', contactName: 'Testpersoon', email: 'TEST@example.invalid', season: 'kerst', consent: true };
  const request = () => new Request('https://app.example.test/api/business-folder-signup', { method: 'POST', headers: { origin: 'https://app.example.test', 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
  const result = await api.POST(request());
  assert.equal(result.status, 200);
  assert.equal((await result.json()).ok, true);
  assert.equal(saved[0][1], 'test@example.invalid');
  assert.equal(saved[0][2], true);
  const campaign = JSON.parse(requests.find(options => options.method === 'POST').body);
  assert.match(campaign.customers[0].notes, /Website-aanmelding Sint/);
  assert.equal(campaign.customers[0].recipients[0].doNotEmail, false);
  input.kind = 'quote';
  assert.equal((await api.POST(request())).status, 410);
  delete input.kind;
  failStorage = true;
  assert.equal((await api.POST(request())).status, 502);
});

test('the corrected bonbon video has portrait display dimensions and only one silent video track', () => {
  const bytes = fs.readFileSync('public/Kerst/bonbons-zo-maken-we-ze.mp4');
  function boxes(start, end) {
    const result = [];
    for (let at = start; at + 8 <= end;) {
      const size = bytes.readUInt32BE(at);
      assert.ok(size >= 8 && at + size <= end);
      result.push({ type: bytes.toString('ascii', at + 4, at + 8), start: at + 8, end: at + size });
      at += size;
    }
    return result;
  }
  const moov = boxes(0, bytes.length).find(box => box.type === 'moov');
  const tracks = boxes(moov.start, moov.end).filter(box => box.type === 'trak');
  assert.equal(tracks.length, 1);
  const header = boxes(tracks[0].start, tracks[0].end).find(box => box.type === 'tkhd');
  assert.equal(bytes.readUInt32BE(header.end - 8) / 65536, 540);
  assert.equal(bytes.readUInt32BE(header.end - 4) / 65536, 960);
});
