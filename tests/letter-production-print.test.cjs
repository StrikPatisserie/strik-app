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
