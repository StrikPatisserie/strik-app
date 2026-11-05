const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), ts = require('typescript');
const { renderToStaticMarkup } = require('react-dom/server');
function loader(overrides = {}, globals = {}) {
  const cache = {};
  function load(file) {
    file = path.resolve(file); if (cache[file]) return cache[file];
    const exports = cache[file] = {};
    let source = fs.readFileSync(file, 'utf8');
    if (file.endsWith('SinterklaasB2BClient.tsx')) source += '\nexport { B2BOrderRow };';
    const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
    vm.runInNewContext(code, { exports, Date, Intl, URL, URLSearchParams, Map, Set, process: { env: {} }, ...globals, require(name) {
      if (name in overrides) return overrides[name];
      if (name.endsWith('.css')) return { default: new Proxy({}, { get: (_, key) => key }) };
      if (name === 'next/link' || name === 'next/image') return { default: 'a' };
      if (name.startsWith('@/') || name.startsWith('.')) {
        const base = name.startsWith('@/') ? path.resolve(name.slice(2)) : path.resolve(path.dirname(file), name);
        const target = ['.ts', '.tsx'].map(ext => base + ext).find(fs.existsSync); if (target) return load(target);
      }
      return require(name);
    } });
    return exports;
  }
  return load;
}
const load = loader(), totals = load('app/sinterklaas/b2b/productionTotals.ts'), api = load('app/sinterklaas/sinterklaasApi.ts');
function order(input = {}) { return api.normalizeB2BOrder({ id: 'a', year: '2026', season: 'sint', status: 'akkoord', customerName: 'Klant A', deliveryDate: '2026-12-01', deliveryWindowType: 'date', orderText: 'PRODUCTEN EN PRIJS\n30 × Speculaasbrok met letter · Speculaasbrok zonder amandel · kleine spuitletter · letter S · € 10,00 p.s. ex btw · € 300,00', ...input }); }
function result(orders, season = 'sint', year = '2026') { return totals.buildProductionTotals(orders, season, year); }

test('one product total spans weeks, with a sorted quantity/customer/date breakdown', () => {
  const values = [order({ id: 'b', customerName: 'Klant B', deliveryDate: '2026-12-02', orderText: order().orderText.replace('30 ×', '70 ×').replace('kleine', 'grote').replace('letter S ·', 'letter M · eigen logo ·') }), order({ id: 'c', customerName: 'Klant C', deliveryDate: '2026-12-03', orderText: order().orderText.replace('30 ×', '40 ×') }), order()];
  const before = JSON.stringify(values), data = result(values);
  assert.equal(data.products.length, 1); assert.equal(data.products[0].product, 'Speculaasbrok · zonder amandel'); assert.equal(data.products[0].quantity, 140);
  assert.deepEqual(Array.from(data.products[0].allocations, a => [a.quantity, a.customer, a.date]), [[30, 'Klant A', '2026-12-01'], [70, 'Klant B', '2026-12-02'], [40, 'Klant C', '2026-12-03']]);
  assert.equal(JSON.stringify(values), before);
  assert.match(totals.productionTotalsText(data), /140 stuks Speculaasbrok · zonder amandel\n  30 · 1 dec · Klant A\n  70 · 2 dec · Klant B/);
});
test('finished, packed, delivered, cancelled, unconfirmed, historical, wrong-year and wrong-season orders are excluded', () => {
  const values = [order(), ...[{ id: 'done', productionDone: true }, { id: 'packed', packed: true }, { id: 'delivered', delivered: true }, { id: 'cancel', cancelled: true }, { id: 'quote', status: 'offerte' }, { id: 'request', status: 'aanvraag' }, { id: 'no', status: 'afgewezen' }, { id: 'historie-old' }, { id: 'old', year: '2025' }, { id: 'xmas', season: 'kerst' }].map(order)];
  assert.equal(result(values).products[0].quantity, 30); assert.equal(result(values).orderCount, 1);
  assert.equal(result([order({ delivered: true })]).products.length, 0);
  assert.equal(result([order({ season: 'sint-kerst' })], 'kerst').products[0].quantity, 30);
});
test('almond variants and unknown package variants remain separate rather than guessing their recipe', () => {
  const data = result([order(), order({ id: 'almond', orderText: order().orderText.replace('zonder amandel', 'met amandel') }), order({ id: 'custom', orderText: 'PRODUCTEN EN PRIJS\n20 × Speculaasbrok met letter · speciale uitvoering · € 12,00 p.s. ex btw · € 240,00' })]);
  assert.equal(data.products.length, 3); assert(data.products.some(p => p.product === 'Speculaasbrok · met amandel'));
  assert(data.products.some(p => p.product.includes('speciale uitvoering') && p.quantity === 20));
});
test('DUO bags are counted separately, equal choices accumulate once per customer, and shipping never counts', () => {
  const o = order({ orderText: 'PRODUCTEN EN PRIJS\n5 × Strik DUO · Naturel kruidnoten · ca. 200 g + Naturel kruidnoten · ca. 200 g · € 7,00 p.s. ex btw · € 35,00\n1 × Bezorgkosten · postcode 6000 AA · € 9,00 p.s. ex btw · € 9,00' });
  const data = result([o]); assert.equal(data.products.length, 1); assert.equal(data.products[0].quantity, 10); assert.equal(data.products[0].unit, 'zakjes'); assert.equal(data.products[0].allocations.length, 1); assert.equal(data.products[0].allocations[0].quantity, 10);
});
test('legacy folder orders are read, while loose letters stay in the existing letter planning', () => {
  const folder = order({ orderText: 'BEDRIJF EN CONTACT\nContact: private@example.invalid\n\nGEKOZEN SINTERKLAASPRODUCTEN\n60 × Speculaasbrok met letter · Speculaasbrok zonder amandel · kleine spuitletter\n  € 11,51 p.s. excl. btw · € 690,60 totaal excl. btw\n\nPRIJSINDICATIE\n€ 690,60\n\nWENSEN\nGeen aanvullende wensen' });
  const data = result([folder, order({ id: 'letters', orderText: 'PRODUCTEN EN PRIJS\n50 × Chocolade spuitletters · Groot · eigen logo · € 12,00 p.s. ex btw · € 600,00' }), order({ id: 'group', orderText: '20 grote chocolade vormletters Q. Deadline week 47.', letterLines: [{ id: 'l', letter: 'Q', style: 'vorm', size: 'groot', chocolate: 'melk', quantity: 20 }] })]);
  assert.equal(data.products.length, 1); assert.equal(data.products[0].quantity, 60); assert.equal(data.skippedLetters, 70); assert.equal(data.issues.length, 0);
  const text = JSON.stringify(data); for (const privateValue of ['690,60', '11,51', 'private@', '€']) assert(!text.includes(privateValue));
});
test('other product variants and portion weights are added exactly as ordered, with no fabricated conversions', () => {
  const data = result([order({ orderText: 'PRODUCTEN EN PRIJS\n13 × chocolade kruidnoten · € 4,54 p.s. ex btw · € 59,02\n2 × Naturel kruidnoten · € 3,62 p.s. ex btw · € 7,24\n7 × Speculaasplak (met gedicht) · Met amandel · € 7,00 p.s. ex btw · € 49,00' })]);
  assert.equal(data.products.length, 3); assert.equal(data.products.find(p => p.product === 'chocolade kruidnoten').quantity, 13);
  assert(!JSON.stringify(data).includes('250 g'));
});
test('delivery ranges and missing dates remain explicit; unreadable rows also appear in copied output', () => {
  const ranged = order({ deliveryWindowType: 'week', deliveryWeek: '2026-W49' });
  assert.equal(totals.productionTotalDate(result([ranged]).products[0].allocations[0]), '30 nov t/m 6 dec');
  const missing = result([order({ deliveryDate: '', orderText: order().orderText + '\nNiet leesbare aanvullende regel' })]);
  assert.equal(totals.productionTotalDate(missing.products[0].allocations[0]), 'Datum nog afspreken');
  assert.equal(missing.issues.length, 1); assert.match(totals.productionTotalsText(missing), /Nog controleren:\nKlant A/);
});
test('existing B2B statuses and completion labels remain unchanged', () => {
  const { B2BOrderRow } = load('app/sinterklaas/b2b/SinterklaasB2BClient.tsx');
  const markup = renderToStaticMarkup(require('react').createElement(B2BOrderRow, { order: order({ delivered: true }), updatingId: '', onToggle() {}, onEdit() {}, onDelete() {}, onRetryConfirmation() {}, onCustomerConfirmation() {}, onQuotation() {}, onApprove() {}, onLogoCount() {} }));
  assert.match(markup, /data-status="akkoord">Definitief/); assert(!markup.includes("✓ Klaar"));
  const source = fs.readFileSync('app/sinterklaas/b2b/SinterklaasB2BClient.tsx', 'utf8');
  assert.match(source, /\["delivered", "Geleverd", true\]/);
  assert.match(source, /"Overig geproduceerd" : "Geproduceerd"/);
});
test('production button permission is resolved on the server for both seasons', async () => {
  const access = load('app/lib/auth/access.ts');
  for (const file of ['app/sinterklaas/b2b/page.tsx', 'app/kerst/b2b/page.tsx']) for (const role of ['manager', 'logistiek', 'winkel']) {
    const dummy = () => null, current = { id: 'u', active: true, role, permissions: {} };
    const page = loader({ '../../lib/auth/session': { getCurrentProfile: async () => current }, '../../lib/auth/access': access, './SinterklaasB2BClient': { default: dummy }, '../../sinterklaas/b2b/SinterklaasB2BClient': { default: dummy } })(file);
    const tree = await page.default(); assert.equal(tree.props.children.props.canViewProduction, role !== 'winkel');
  }
});
test('the existing B2B button opens current totals and the existing production checkbox immediately removes an order without changing its other fields', async () => {
  const states = [], effects = [], pending = [], writes = [];
  let cursor = 0, effectCursor = 0, source = [order()];
  const react = { ...require('react'), useState(initial) { const i = cursor++; if (!(i in states)) states[i] = typeof initial === 'function' ? initial() : initial; return [states[i], v => { states[i] = typeof v === 'function' ? v(states[i]) : v; }]; }, useRef(initial) { const i = cursor++; return states[i] ||= { current: initial }; }, useMemo: fn => fn(), useEffect(fn, deps) { const i = effectCursor++, before = effects[i]; if (!before || deps.some((v, j) => v !== before.deps[j])) pending.push(() => { before?.cleanup?.(); effects[i] = { deps, cleanup: fn() }; }); } };
  class FixedDate extends Date { constructor(...args) { super(...(args.length ? args : ['2026-11-05T12:00:00Z'])); } }
  const component = loader({ react, '../sinterklaasApi': { fetchB2BOrders: async () => structuredClone(source), updateB2BOrder: async (id, patch) => { writes.push({ id, patch }); source = source.map(o => o.id === id ? { ...o, ...patch } : o); return source.find(o => o.id === id); } } }, { Date: FixedDate, window: { addEventListener() {}, removeEventListener() {} }, document: { hidden: false }, setInterval: () => 1, clearInterval() {} })('app/sinterklaas/b2b/SinterklaasB2BClient.tsx').default;
  function nodes(n) { if (!n || typeof n !== 'object') return []; return Array.isArray(n) ? n.flatMap(nodes) : [n, ...nodes(n.props?.children)]; }
  function text(n) { return typeof n === 'string' ? n : Array.isArray(n) ? n.map(text).join('') : text(n?.props?.children || ''); }
  function render(allowed = true) { cursor = effectCursor = 0; const tree = component({ season: 'sint', canViewProduction: allowed }); pending.splice(0).forEach(fn => fn()); return nodes(tree); }
  render(); await new Promise(resolve => setImmediate(resolve));
  let tree = render(); const button = tree.find(n => n.type === 'button' && text(n) === 'Productie opteller'); assert(button); assert.equal(button.props.disabled, false);
  button.props.onClick(); tree = render();
  assert.equal(tree.find(n => n.props?.totals).props.totals.products[0].quantity, 30);
  const row = tree.find(n => n.props?.order?.id === 'a'); await row.props.onToggle(row.props.order, 'productionDone'); tree = render();
  assert.equal(tree.find(n => n.props?.totals).props.totals.products.length, 0);
  assert.equal(writes.length, 1); assert.equal(writes[0].patch.productionDone, true); assert(writes[0].patch.productionDoneAt); assert.deepEqual(Object.keys(writes[0].patch).sort(), ['productionDone', 'productionDoneAt']);
  assert(!render(false).some(n => n.type === 'button' && text(n) === 'Productie opteller'));
  assert(!render(false).some(n => n.props?.totals));
  effects.forEach(effect => effect.cleanup?.());
});
