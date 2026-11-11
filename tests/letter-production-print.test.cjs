const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');

const cache = new Map();
function load(file) {
  if (cache.has(file)) return cache.get(file);
  const exports = {};
  cache.set(file, exports);
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, {
    exports,
    require(name) {
      if (name.endsWith('.module.css')) return { default: new Proxy({}, { get: (_, key) => key }) };
      if (name.startsWith('.')) return load(path.resolve(path.dirname(file), name + '.ts'));
      return require(name);
    },
  });
  return exports;
}
const { ProductionPrintSheet } = load(path.resolve('app/sinterklaas/letters/productie/ProductionPrintPreview.tsx'));
const { combineProductionOrders } = load(path.resolve('app/sinterklaas/letters/productie/productionChecklist.ts'));
const batch = { id: 'test', startDate: '2026-11-02', date: '2026-11-03', deadlineAt: '2026-11-01T19:00:00Z', status: 'OPEN', minimumLeadDays: 2, rows: [], storeOrders: [] };
const row = (overrides = {}) => ({ key: 's|melk|groot|spuit', label: 'S · melk · groot · spuit', orders: 0, stock: 0, produced: 0, ...overrides });
function elements(node, predicate) {
  if (Array.isArray(node)) return node.flatMap(child => elements(child, predicate));
  if (!React.isValidElement(node)) return [];
  return [...(predicate(node) ? [node] : []), ...elements(node.props.children, predicate)];
}
function text(node) {
  if (Array.isArray(node)) return node.map(text).join('');
  return React.isValidElement(node) ? text(node.props.children) : node == null ? '' : String(node);
}
function printedRows(sheet) {
  return elements(sheet, node => node.type === 'tr' && node.props['data-special'] !== undefined).map(node => ({
    text: text(node),
    sources: Object.fromEntries(elements(node, child => child.type === 'td' && child.props['data-source']).map(cell => [cell.props['data-source'], Number(text(cell).replace('—', '0'))])),
    total: Number(text(elements(node, child => child.type === 'td')[4])),
  }));
}

test('printed crate quantities reconcile across actual order channels and keep logo / nut-free letters on their own row', () => {
  const line = { letter: 'S', chocolate: 'melk', size: 'groot', style: 'spuit', notes: '', logo: false, specialRequests: [], quantity: 5 };
  const order = { code: 'test', customerName: 'Voorbeeld', pickupDate: '2026-11-05', status: 'nieuw', source: 'winkel', lines: [line] };
  const result = combineProductionOrders([{ ...batch, rows: [row({ stock: 4 })] }], [order, { ...order, source: 'online', lines: [{ ...line, quantity: 7 }] }], [
    { customerName: 'B2B', status: 'akkoord', deliveryDate: '2026-11-05', department: 'bakkerij', letterLines: [{ ...line, quantity: 20, exceptions: [] }] },
    { customerName: 'B2B logo', status: 'akkoord', deliveryDate: '2026-11-05', department: 'bakkerij', logo: true, letterLines: [{ ...line, quantity: 3, exceptions: ['notenvrij'] }] },
  ]).batches[0];
  const before = JSON.stringify(result);
  const rows = printedRows(ProductionPrintSheet({ batch: result }));
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0].sources, { winkel: 5, voorraad: 4, online: 7, b2b: 20 });
  assert.equal(rows[0].total, 36);
  assert.deepEqual(rows[1].sources, { winkel: 0, voorraad: 0, online: 0, b2b: 3 });
  assert.equal(rows[1].total, 3);
  assert.match(rows[1].text, /LET OP.*logo.*notenvrij/);
  for (const printed of rows) assert.equal(Object.values(printed.sources).reduce((sum, quantity) => sum + quantity, 0), printed.total);
  assert.equal(JSON.stringify(result), before, 'printing must never mark production or change the plan');
});

test('historical quantities without a known origin are explicitly held for checking instead of assigned to a crate', () => {
  const sheet = ProductionPrintSheet({ batch: { ...batch, rows: [row({ orders: 9, stock: 2, orderSources: { winkel: 3 } })] } });
  const [printed] = printedRows(sheet);
  assert.deepEqual(printed.sources, { winkel: 3, voorraad: 2, online: 0, b2b: 0 });
  assert.equal(printed.total, 11);
  assert.match(printed.text, /Herkomst onbekend: 6 stuks/);
  assert.match(text(sheet), /HERKOMST CONTROLEREN:.*6 stuks/);
});


test('logo instructions list the actual company and quantity for each order sharing a letter row', () => {
  const line = {letter: 'H', chocolate: 'melk', size: 'groot', style: 'spuit', quantity: 5, exceptions: [], withLogo: true};
  const order = {id: 'company-a', customerName: 'Bedrijf A', status: 'akkoord', deliveryDate: '2026-11-06', department: 'chocolade', letterLines: [line]};
  const online = {
    id: 'online-logo', code: 'CL123', customerName: 'Bedrijf C', source: 'online',
    pickupDate: '2026-11-06', status: 'besteld', notes: '',
    lines: [{...line, quantity: 2, logo: true, notes: '', specialRequests: []}],
  };
  const planned = combineProductionOrders([{...batch}], [online], [
    order,
    {...order, id: 'company-b', customerName: 'Bedrijf B', delivered: true, letterLines: [{...line, quantity: 3}]},
  ]).batches[0];
  const before = JSON.stringify(planned);
  const sheet = ProductionPrintSheet({batch: planned});
  const [printed] = printedRows(sheet);
  assert.equal(printed.total, 10);
  assert.deepEqual(printed.sources, {winkel: 0, voorraad: 0, online: 2, b2b: 8});
  const list = elements(sheet, node => node.type === 'ul' && node.props['aria-label'] === 'Logo per klant of bedrijf')[0];
  assert(list);
  assert.deepEqual(elements(list, node => node.type === 'li').map(text), ['2× Bedrijf C', '5× Bedrijf A', '3× Bedrijf B']);
  assert.match(printed.text, /LET OPlogo/);
  assert.equal(JSON.stringify(planned), before);
});

test('repeated logo lines of one order are summed under that company without losing another order', () => {
  const recipient = {id: 'order-a', source: 'b2b', customerName: 'Bedrijf A', code: 'A1', quantity: 2};
  const sheet = ProductionPrintSheet({batch: {...batch, rows: [row({
    label: 'S · melk · groot · spuit · logo', orders: 9, orderSources: {b2b: 9},
    recipients: [recipient, {...recipient, quantity: 3}, {...recipient, id: 'order-b', customerName: 'Bedrijf B', code: 'B1', quantity: 4}],
  })]}});
  const list = elements(sheet, node => node.type === 'ul')[0];
  assert.deepEqual(elements(list, node => node.type === 'li').map(text), ['5× Bedrijf A', '4× Bedrijf B']);
});

test('missing or conflicting historical logo recipients are explicitly left for checking', () => {
  const recipient = {id: 'known', source: 'b2b', customerName: 'Bekend bedrijf', quantity: 5};
  const logoRow = row({label: 'S · melk · groot · spuit · logo', orders: 8, orderSources: {b2b: 8}, recipients: [recipient]});
  const partial = ProductionPrintSheet({batch: {...batch, rows: [logoRow]}});
  assert.deepEqual(elements(partial, node => node.type === 'li').map(text), ['5× Bekend bedrijf', '3× Bedrijf controleren']);
  const conflicting = ProductionPrintSheet({batch: {...batch, rows: [{...logoRow, recipients: [{...recipient, quantity: 10}]}]}});
  assert.deepEqual(elements(conflicting, node => node.type === 'li').map(text), ['8× Bedrijf controleren']);
  assert.doesNotMatch(text(conflicting), /Bekend bedrijf/);
  const missing = ProductionPrintSheet({batch: {...batch, rows: [{...logoRow, recipients: undefined}]}});
  assert.deepEqual(elements(missing, node => node.type === 'li').map(text), ['8× Bedrijf controleren']);
});

test('regular letter rows keep their compact notes without logo customer details', () => {
  const sheet = ProductionPrintSheet({batch: {...batch, rows: [row({
    orders: 2, orderSources: {b2b: 2},
    recipients: [{id: 'no-logo', source: 'b2b', quantity: 2, customerName: 'Regulier bedrijf'}],
  })]}});
  assert.equal(elements(sheet, node => node.type === 'ul').length, 0);
  assert.doesNotMatch(text(sheet), /Regulier bedrijf/);
});
