const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const operations = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('app/productie/taskOperations.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { exports: operations, Set });
const plain = value => JSON.parse(JSON.stringify(value));

test('extra operations form a stable combined operation without duplicate selections', () => {
  assert.equal(operations.combineTaskOperation('Bereiden', ['storten']), 'Bereiden + storten');
  assert.equal(operations.combineTaskOperation('Bereiden', ['verpakken', 'storten', 'storten']), 'Bereiden + storten + verpakken');
  assert.equal(operations.combineTaskOperation('Storten', ['storten']), 'Storten');
  assert.equal(operations.combineTaskOperation('Bereiden + storten', []), 'Bereiden');
});

test('editing a legacy custom operation preserves unknown operation text and recognized extras', () => {
  for (const operation of ['Mousse opkloppen', 'Maken + eigen handeling', 'Maken + storten + eigen handeling']) {
    const split = operations.splitTaskOperation(operation);
    assert.equal(split.base, operation);
    assert.deepEqual(plain(split.extras), []);
    assert.equal(operations.combineTaskOperation(split.base, split.extras), operation);
  }
  const split = operations.splitTaskOperation('Mousse opkloppen + STORTEN + verpakken');
  assert.equal(split.base, 'Mousse opkloppen');
  assert.deepEqual(plain(split.extras), ['storten', 'verpakken']);
  assert.equal(operations.combineTaskOperation(split.base, split.extras), 'Mousse opkloppen + storten + verpakken');
});
