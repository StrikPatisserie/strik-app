const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const exportsMap = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('app/sinterklaas/letters/productie/productionSources.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { exports: exportsMap });
const { productionOrderSource, addProductionOrderQuantity, productionSourceBreakdown, aggregateProductionRows } = exportsMap;
const row = (overrides = {}) => ({key: 's|melk|groot|spuit', label: 'S · melk · groot · spuit', orders: 0, stock: 0, produced: 0, ...overrides});
const breakdown = (row) => Object.fromEntries(productionSourceBreakdown(row).map(item => [item.id, item.quantity]));

test('stored channels and WordPress sources are mapped explicitly without guessing unknown channels', () => {
  for (const [input, expected] of [['STORE', 'winkel'], ['winkel', 'winkel'], ['ONLINE', 'online'], ['B2B', 'b2b'], [null, 'onbekend'], ['other', 'onbekend']]) {
    assert.equal(productionOrderSource(input), expected);
  }
});

test('one letter preserves separate store, online, B2B and stock counts without changing the original seed', () => {
  const initial = row({orders: 7, stock: 4, produced: 3, orderSources: {online: 7}});
  const storeAdded = addProductionOrderQuantity(initial, 'winkel', 5);
  const mixed = addProductionOrderQuantity(storeAdded, 'b2b', 20);
  assert.deepEqual(breakdown(mixed), {winkel: 5, online: 7, b2b: 20, voorraad: 4});
  assert.equal(mixed.orders + mixed.stock, 36);
  assert.equal(mixed.produced, 3);
  assert.deepEqual(initial.orderSources, {online: 7});
  assert.equal(initial.orders, 7);
});

test('editing or clearing shop stock changes only its source count', () => {
  const initial = row({orders: 9, stock: 12, orderSources: {winkel: 4, online: 5}});
  assert.deepEqual(breakdown({...initial, stock: 30}), {winkel: 4, online: 5, voorraad: 30});
  assert.deepEqual(breakdown({...initial, stock: 0}), {winkel: 4, online: 5});
  assert.deepEqual(breakdown(row({stock: 12})), {voorraad: 12});
});

test('grand overview combines sources across rounds and keeps special variants separate', () => {
  const input = [row({orders: 5, stock: 3, produced: 8, orderSources: {online: 5}}), row({orders: 7, stock: 2, orderSources: {winkel: 2, b2b: 5}}), row({key: 's|melk|groot|spuit|foto', orders: 4, orderSources: {online: 4}})];
  const before = JSON.stringify(input);
  const combined = aggregateProductionRows(input);
  assert.equal(combined.length, 2);
  assert.deepEqual(breakdown(combined[0]), {winkel: 2, online: 5, b2b: 5, voorraad: 5});
  assert.equal(combined[0].orders + combined[0].stock, 17);
  assert.equal(combined[0].produced, 8);
  assert.equal(JSON.stringify(input), before);
});

test('unattributed historical quantities stay visible and are never labelled as online orders', () => {
  const mixed = addProductionOrderQuantity(row({orders: 6}), 'winkel', 3);
  assert.deepEqual(breakdown(mixed), {winkel: 3, onbekend: 6});
  const [combined] = aggregateProductionRows([mixed, row({orders: 4, orderSources: {online: 4}})]);
  assert.deepEqual(breakdown(combined), {winkel: 3, online: 4, onbekend: 6});
  assert.equal(productionSourceBreakdown(combined).reduce((sum, item) => sum + item.quantity, 0), combined.orders + combined.stock);
});
