const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const exportsObject = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('app/productie/recipeGroups.ts', 'utf8'), {
 compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { exports: exportsObject, Map });
const { recipeGroups } = exportsObject;

function task(id, changes = {}) {
 return { id, itemId: 'cake', batchId: `batch-${id}`, date: '2026-11-05', operation: 'Afmaken', ...changes };
}
const items = [{ id: 'cake', name: 'Fruitdesserttaart' }, { id: 'cream', name: 'Vanillecrème' }];

test('legacy generatedFor links and same-batch follow-ups share one root badge', () => {
 const tasks = [
  task('root'),
  task('preparation', { itemId: 'cream', generatedFor: 'root' }),
  task('nested', { generatedFor: 'preparation' }),
  task('follow-up', { batchId: 'batch-root', dependsOn: 'root' }),
  task('orphan', { generatedFor: 'missing-task' }),
 ];
 const original = structuredClone(tasks);
 const groups = recipeGroups(tasks, items);
 for (const id of ['root', 'preparation', 'nested', 'follow-up']) {
  assert.equal(groups.get(id).rootId, 'root');
  assert.equal(groups.get(id).name, 'Fruitdesserttaart');
  assert.equal(groups.get(id), groups.get('root'));
 }
 assert.equal(groups.has('orphan'), false);
 assert.deepEqual(tasks, original);
});

test('separate batches of the same product keep distinct and stable family badges', () => {
 const tasks = [
  task('second', { date: '2026-11-06' }),
  task('second-preparation', { itemId: 'cream', generatedFor: 'second', requires: ['first-preparation'] }),
  task('first'),
  task('first-preparation', { itemId: 'cream', generatedFor: 'first' }),
  task('single'),
 ];
 const groups = recipeGroups(tasks, items);
 assert.equal(groups.get('first').label, 'R1');
 assert.equal(groups.get('second').label, 'R2');
 assert.equal(groups.get('first-preparation').rootId, 'first');
 assert.equal(groups.get('second-preparation').rootId, 'second');
 assert.equal(groups.has('single'), false);
 const reordered = recipeGroups([...tasks].reverse(), items);
 for (const [id, group] of groups) assert.deepEqual(reordered.get(id), group);
});
