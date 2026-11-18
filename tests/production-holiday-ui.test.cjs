const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const jsx = require('react/jsx-runtime');
const { renderToStaticMarkup } = require('react-dom/server');

function load(file, imports, globals = {}) {
  const exports = {};
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8') + (file.endsWith('HolidayProduction.tsx') ? '\nexport { HolidayProductionTotals };' : ''), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(source, {
    exports, Date, Intl, Error,
    require(name) { assert(name in imports, `Unmocked import ${name}`); return imports[name]; },
    ...globals,
  });
  return exports;
}

const planning = load('app/productie/planning.ts', {});
const folder = load('app/lib/businessFolderOrderText.ts', {});
const seasons = load('app/lib/businessSeasons.ts', {});
const deliveries = load('app/lib/businessOrderDeliveries.ts', { './businessSeasons': seasons });
const lines = load('app/sinterklaas/b2bLetterLines.ts', {});
const combinations = load('app/sinterklaas/b2bCombinationLetters.ts', { '../lib/businessFolderOrderText': folder, './b2bLetterLines': lines });
const productionTotals = load('app/sinterklaas/b2b/productionTotals.ts', {
  '../../lib/businessFolderOrderText': folder, '../../lib/businessOrderDeliveries': deliveries,
  '../../lib/businessSeasons': seasons, '../b2bCombinationLetters': combinations,
});
const totalFixture = { products: [{ key: 'brok', product: 'Speculaasbrok zonder amandel', quantity: 32, unit: 'stuks', allocations: [
  { orderId: 'single', customer: 'Klant A', quantity: 20, date: '2026-11-23', end: '2026-11-23' },
  { orderId: 'mixed', customer: 'Klant B', quantity: 12, date: '2026-11-23', end: '2026-11-25' },
] }], orderCount: 2, skippedLetters: 10, issues: [] };

const baseOrder = {
  id: 'single', name: 'Klant A', season: 'sint', date: '2026-11-23', dateEnd: '2026-11-23',
  productionDate: '2026-11-20', department: 'bakkerij', products: '20× Speculaasbrok zonder amandel\n5× Kruidcake',
  letters: [], packaging: 'Per stuk in een doosje', instructions: 'Rood lint en apart klaarzetten', logo: '',
  productionDone: false, letterProductionDone: false, hasLetters: false, delivered: false, version: 'version-single',
};
const orders = [
  baseOrder,
  {
    ...baseOrder, id: 'mixed', name: 'Klant B', dateEnd: '2026-11-25', department: 'beide',
    products: '12× Speculaasbrok met letter', hasLetters: true, letters: ['12× Spuitletter Q · melk · groot · eigen logo'],
    logo: 'https://images.invalid/logo-b.png', version: 'version-mixed',
  },
  { ...baseOrder, id: 'delivered', name: 'Klant geleverd', delivered: true, version: 'version-delivered' },
];

function nodes(tree) {
  if (!tree || typeof tree !== 'object') return [];
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  return [tree, ...nodes(tree.props?.children)];
}
function text(tree) {
  if (typeof tree === 'string' || typeof tree === 'number') return String(tree);
  if (Array.isArray(tree)) return tree.map(text).join('');
  return tree?.props ? text(tree.props.children) : '';
}
function find(tree, predicate) {
  const found = nodes(tree).find(predicate);
  assert(found, 'Expected holiday production control');
  return found;
}
function orderRow(tree, id) {
  return find(tree, node => node.type === 'tr' && node.key === id);
}
function checkboxes(tree) {
  return nodes(tree).filter(node => node.type === 'input' && node.props.type === 'checkbox');
}

function harness() {
  const slots = [], effects = [], calls = [], posts = [], timers = new Set();
  let cursor = 0, pending = [], sequence = 0;
  let source = { orders: structuredClone(orders), productionTotals: structuredClone(totalFixture), batches: [], updatedAt: '2026-11-05T08:00:00Z', unplannedCount: 0 };
  const sameDeps = (first, second) => first?.length === second?.length && first.every((value, index) => Object.is(value, second[index]));
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
      return [slots[index], value => { slots[index] = typeof value === 'function' ? value(slots[index]) : value; }];
    },
    useRef(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = { current: initial };
      return slots[index];
    },
    useCallback(callback, dependencies) {
      const index = cursor++;
      if (!sameDeps(slots[index]?.dependencies, dependencies)) slots[index] = { callback, dependencies };
      return slots[index].callback;
    },
    useEffect(effect, dependencies) {
      const index = cursor++;
      if (!sameDeps(effects[index]?.dependencies, dependencies)) pending.push(() => {
        effects[index]?.cleanup?.();
        effects[index] = { dependencies, cleanup: effect() };
      });
    },
  };
  const productText = function B2BProductText() {};
  const component = load('app/productie/HolidayProduction.tsx', {
    react, 'react/jsx-runtime': jsx, 'next/link': 'a', './planning': planning,
    './ProductionIcon': { __esModule: true, default: () => null },
    '../sinterklaas/b2b/productionTotals': productionTotals,
    '../sinterklaas/b2b/B2BProductText': { __esModule: true, default: productText },
    '../preview/productie/production.module.css': { __esModule: true, default: new Proxy({}, { get: (_, key) => key }) },
  }, {
    document: { hidden: false },
    setInterval(callback, delay) { assert.equal(delay, 15000); timers.add(callback); return callback; },
    clearInterval(callback) { timers.delete(callback); },
    async fetch(url, options) {
      calls.push({ url, options });
      if (options?.method === 'POST') {
        const input = JSON.parse(options.body); posts.push(input);
        const order = source.orders.find(order => order.id === input.id);
        const updated = { ...order, [input.field]: input.done, version: `updated-${++sequence}` };
        source = { ...source, orders: source.orders.map(order => order.id === input.id ? updated : order) };
        return Response.json({ order: updated });
      }
      return Response.json(source);
    },
  }).default;
  return {
    productText, calls, posts,
    render() {
      cursor = 0; pending = [];
      const tree = component({ season: 'sint', initialYear: '2026' });
      pending.forEach(effect => effect());
      return tree;
    },
    flush: () => new Promise(setImmediate),
    unmount() { effects.forEach(effect => effect?.cleanup?.()); assert.equal(timers.size, 0); },
  };
}

test('the compact holiday table keeps delivery, customer and products in three aligned columns with secondary information collapsed', async () => {
  const h = harness(); h.render(); await h.flush();
  const tree = h.render();
  assert.equal(h.calls[0].url, '/api/productie/feestdagen?season=sint&year=2026');
  assert.equal(h.calls[0].options.cache, 'no-store');
  const table = find(tree, node => node.type === 'table' && node.props['aria-label'] === 'B2B-productie');
  assert.deepEqual(nodes(table).filter(node => node.type === 'th' && node.props.scope === 'col').map(text), ['Levering / klant', 'Bestelling', 'Klaar']);
  const row = orderRow(table, 'single');
  assert.equal(row.props['aria-label'], 'Klant A');
  const cells = nodes(row).filter(node => node.type === 'td' || node.type === 'th');
  assert.equal(cells.length, 3);
  assert(text(cells[0]).includes(planning.dateLabel(baseOrder.date, true)));
  assert(text(cells[0]).includes('Klant A'));
  assert.deepEqual(nodes(cells[1]).filter(node => node.type === h.productText).map(node => node.props.text), baseOrder.products.split('\n'));
  assert.equal(nodes(cells[1]).filter(node => node.type === 'li').length, 2);
  const details = find(cells[1], node => node.type === 'details' && text(find(node, child => child.type === 'summary')) === 'Details');
  assert(!details.props.open);
  assert(text(details).includes(baseOrder.packaging));
  assert(text(details).includes(baseOrder.instructions));
  assert(text(details).includes(planning.dateLabel(baseOrder.productionDate, true)));
  const visibleText = node => {
    if (node?.type === 'details') return '';
    if (node?.type === h.productText) return node.props.text;
    if (typeof node === 'string' || typeof node === 'number') return String(node);
    if (Array.isArray(node)) return node.map(visibleText).join('');
    return node?.props ? visibleText(node.props.children) : '';
  };
  assert(!visibleText(cells[1]).includes(baseOrder.packaging));
  assert(!visibleText(cells[1]).includes(baseOrder.instructions));
  for (const line of baseOrder.products.split('\n')) assert(visibleText(cells[1]).includes(line));
  h.unmount();
});

test('letter distribution and the order logo remain accessible from the compact order row', async () => {
  const h = harness(); h.render(); await h.flush();
  let tree = h.render();
  const row = orderRow(tree, 'mixed');
  const letters = find(row, node => node.type === 'details' && nodes(node).some(child => child.type === 'summary' && text(child).includes('Letterverdeling')));
  assert(!letters.props.open);
  assert(text(letters).includes(orders[1].letters[0]));
  find(row, node => node.type === 'button' && node.props['aria-label'] === 'Logo bekijken: Klant B').props.onClick();
  tree = h.render();
  const dialog = find(tree, node => typeof node.type === 'function' && node.props.label === 'Eigen logo');
  assert.equal(find(dialog, node => node.type === 'img').props.src, orders[1].logo);
  dialog.props.onClose(); tree = h.render();
  assert(!nodes(tree).some(node => typeof node.type === 'function' && node.props.label === 'Eigen logo'));
  assert.equal(h.posts.length, 0);
  h.unmount();
});

test('single and mixed progress controls retain the narrow versioned write contract and delivered rows remain readonly', async () => {
  const h = harness(); h.render(); await h.flush();
  let tree = h.render();
  find(tree, node => node.type === 'select' && node.props['aria-label'] === 'Voortgang').props.onChange({ target: { value: 'all' } });
  tree = h.render();
  const delivered = checkboxes(orderRow(tree, 'delivered'));
  assert.equal(delivered.length, 1);
  assert.equal(delivered[0].props.disabled, true);
  assert.equal(delivered[0].props['aria-label'], 'Gemaakt: Klant geleverd');
  const single = checkboxes(orderRow(tree, 'single'));
  assert.equal(single.length, 1);
  assert.equal(single[0].props['aria-label'], 'Gemaakt: Klant A');
  single[0].props.onChange({ target: { checked: true } });
  tree = h.render();
  assert(checkboxes(find(tree, node => node.type === 'table')).every(node => node.props.disabled));
  single[0].props.onChange({ target: { checked: false } });
  assert.equal(h.posts.length, 1, 'An in-flight save must not be duplicated');
  await h.flush(); tree = h.render();
  assert.deepEqual(h.posts[0], { id: 'single', field: 'productionDone', done: true, version: 'version-single' });
  assert.equal(checkboxes(orderRow(tree, 'single'))[0].props.checked, true);
  let mixed = orderRow(tree, 'mixed');
  find(mixed, node => node.type === 'input' && node.props['aria-label'] === 'Letters gemaakt: Klant B').props.onChange({ target: { checked: true } });
  await h.flush(); tree = h.render(); mixed = orderRow(tree, 'mixed');
  assert.deepEqual(h.posts[1], { id: 'mixed', field: 'letterProductionDone', done: true, version: 'version-mixed' });
  find(mixed, node => node.type === 'input' && node.props['aria-label'] === 'Overig gemaakt: Klant B').props.onChange({ target: { checked: true } });
  await h.flush(); tree = h.render();
  assert.deepEqual(h.posts[2], { id: 'mixed', field: 'productionDone', done: true, version: 'updated-2' });
  assert(checkboxes(orderRow(tree, 'mixed')).every(node => node.props.checked));
  assert(checkboxes(orderRow(tree, 'delivered')).every(node => node.props.disabled));
  h.unmount();
});

test('the opteller opens the canonical product totals independently of the list filters, and closes without saving', async () => {
  const h = harness(); h.render(); await h.flush();
  let tree = h.render();
  const button = find(tree, node => node.type === 'button' && node.props['aria-label'] === 'Producten optellen');
  assert.equal(button.props.disabled, false);
  find(tree, node => node.type === 'input' && node.props.type === 'search').props.onChange({ target: { value: 'geleverd' } });
  tree = h.render();
  assert.equal(nodes(tree).filter(node => node.type === 'tr' && node.props['aria-label']).length, 1);
  button.props.onClick(); tree = h.render();
  const modal = find(tree, node => typeof node.type === 'function' && node.type.name === 'HolidayProductionTotals');
  assert.deepEqual(JSON.parse(JSON.stringify(modal.props.totals)), totalFixture);
  assert.equal(modal.props.year, '2026');
  modal.props.onClose(); tree = h.render();
  assert(!nodes(tree).some(node => typeof node.type === 'function' && node.type.name === 'HolidayProductionTotals'));
  assert.equal(h.posts.length, 0);
  h.unmount();
});

test('the opteller shows expandable quantities with customer and date and provides a copy action', () => {
  const module = load('app/productie/HolidayProduction.tsx', {
    react: require('react'), 'react/jsx-runtime': jsx, 'next/link': 'a', './planning': planning,
    './ProductionIcon': { __esModule: true, default: () => null },
    '../sinterklaas/b2b/productionTotals': productionTotals,
    '../sinterklaas/b2b/B2BProductText': { __esModule: true, default: () => null },
    '../preview/productie/production.module.css': { __esModule: true, default: new Proxy({}, { get: (_, key) => key }) },
  });
  const markup = renderToStaticMarkup(require('react').createElement(module.HolidayProductionTotals, { totals: totalFixture, season: 'sint', year: '2026', onClose() {} }));
  assert.match(markup, /aria-label="Productie opteller"/);
  assert.match(markup, /<details/);
  assert.match(markup, /32 <small>stuks/);
  assert.match(markup, /20×/);
  assert.match(markup, /Klant A/);
  assert.match(markup, /23 nov t\/m 25 nov/);
  assert.match(markup, /Klant B/);
  assert.match(markup, /Kopieer lijst/);
  assert.match(markup, /Losse chocoladeletters staan in de letterplanning/);
});
