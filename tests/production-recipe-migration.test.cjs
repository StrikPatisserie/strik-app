const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const model = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('app/productie/recipeMigration.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports: model, structuredClone });
function source() { return {
  ingredients: [{ id: 'legacy-text-id', name: 'Testgrondstof', lastPrice: 12.34, specification: { specsPlazaId: 'test-only', specsPlazaLink: { environment: 'test', product: { id: 'test-only' } } } }],
  recipes: [
    { id: 'semi', name: 'Testbodem', type: 'semiFinished', ingredients: [{ ingredientId: 'legacy-text-id', quantity: 500 }], semiFinishedItems: [], linkedFinalProductIds: ['product'], costPrice: 1.23 },
    { id: 'product', name: 'Testproduct', type: 'finalProduct', ingredients: [], semiFinishedItems: [{ semiFinishedRecipeId: 'semi', quantity: 0 }], packagingItems: [{ packagingId: 'box', quantity: 1 }], productionLog: [{ id: 'old-production', quantity: 10 }], photoPreviewDataUrl: 'data:image/png;base64,VEVTVA==', version: '3', futureField: { preserve: 'exactly' } },
  ],
  packagingItems: [{ id: 'box' }], invoiceImports: [{ id: 'invoice', lines: [{ totalPrice: 123.45 }] }],
  manualProductionPlanningItems: [{ id: 'task' }], bakeryHome: { offers: [{ imageUrl: 'https://example.invalid/photo.png' }] },
  allergenLists: [{ id: 'test-allergen-list' }], hefeOrderHistory: [{ id: 'test-history' }], updatedAt: '2026-10-28T09:00:00Z',
}; }
test('dry run accounts for all entities and warns about concept quantities and media without inventing values', () => {
  const input = source(), before = JSON.stringify(input), report = model.inspectRecipeTransfer(input);
  assert.equal(report.ready, true);
  assert.equal(report.counts.recipes, 2); assert.equal(report.counts.semiFinished, 1); assert.equal(report.counts.finalProducts, 1);
  assert.equal(report.counts.productionEntries, 1); assert.equal(report.counts.specsPlazaLinks, 1); assert.equal(report.counts.recipePhotos, 1); assert.equal(report.counts.manualTasks, 1);
  assert(report.warnings.some(w => w.code === 'quantity-not-yet-filled'));
  assert(report.warnings.some(w => w.code === 'verify-linked-wordpress-media'));
  assert.equal(JSON.stringify(input), before);
});
test('a snapshot retains original IDs, financial history, metadata, pictures and unknown future fields losslessly', () => {
  const input = source(), snapshot = model.recipeTransferSnapshot(input);
  assert.equal(JSON.stringify(snapshot.data), JSON.stringify(input));
  input.recipes[1].futureField.preserve = 'changed';
  assert.equal(snapshot.data.recipes[1].futureField.preserve, 'exactly');
  assert.equal(snapshot.data.ingredients[0].id, 'legacy-text-id');
  assert.equal(snapshot.data.invoiceImports[0].lines[0].totalPrice, 123.45);
  assert.equal(snapshot.data.recipes[1].semiFinishedItems[0].quantity, 0);
});
test('invalid roots, empty exports, duplicate identifiers and broken references prevent a snapshot', () => {
  for (const mutate of [
    data => { data.recipes = []; },
    data => { data.ingredients.push({ ...data.ingredients[0] }); },
    data => { data.recipes[1].semiFinishedItems[0].semiFinishedRecipeId = 'gone'; },
    data => { data.recipes[0].ingredients[0].ingredientId = 'gone'; },
    data => { data.recipes[1].packagingItems[0].packagingId = 'gone'; },
    data => { data.ingredients[0].recipeReplacement = { kind: 'semiFinished', id: 'gone' }; },
    data => { data.recipes[0].linkedFinalProductIds = ['gone']; },
    data => { data.recipes[1].semiFinishedItems[0].quantity = NaN; },
  ]) { const data = source(); mutate(data); assert.equal(model.inspectRecipeTransfer(data).ready, false); assert.throws(() => model.recipeTransferSnapshot(data), /geblokkeerd/); }
  assert.equal(model.inspectRecipeTransfer(null).ready, false);
});
test('cyclic and incorrectly typed semi-finished references block transfer', () => {
  const data = source();
  data.recipes[0].semiFinishedItems = [{ semiFinishedRecipeId: 'semi', quantity: 1 }];
  assert(model.inspectRecipeTransfer(data).errors.some(e => e.code === 'cyclic-semi-finished-reference'));
  data.recipes[0].semiFinishedItems = [{ semiFinishedRecipeId: 'product', quantity: 1 }];
  assert(model.inspectRecipeTransfer(data).errors.some(e => e.code === 'reference-is-not-semi-finished'));
});
test('reports contain only counts and issue locations, never recipe names or financial values', () => {
  const data = source(); const report = JSON.stringify(model.inspectRecipeTransfer(data));
  for (const sensitive of ['Testproduct', 'Testgrondstof', 'Testbodem', '123.45', '12.34', 'data:image', 'test-only']) assert(!report.includes(sensitive));
});
