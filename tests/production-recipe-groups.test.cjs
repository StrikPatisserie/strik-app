const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const exportsObject = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('app/productie/recipeGroups.ts', 'utf8'), {
 compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { exports: exportsObject, Map });
const { recipeGroups, recipeLinks, recipeTaskClusters, recipeDayClusters } = exportsObject;

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


test('edge links follow nested preparations and keep recipe colours stable across batches and task order', () => {
 const tasks = [task('root'), task('cream', { itemId: 'cream', generatedFor: 'root' }),
  task('nested', { generatedFor: 'cream' }), task('follow-up', { batchId: 'batch-root', dependsOn: 'root' }),
  task('second'), task('second-cream', { itemId: 'cream', generatedFor: 'second' }), task('single')];
 const before = structuredClone(tasks);
 const links = recipeLinks(tasks, items);
 for (const id of ['root', 'cream', 'nested', 'follow-up']) {
  assert.equal(links.get(id).length, 1);
  assert.equal(links.get(id)[0].rootId, 'root');
  assert.equal(links.get(id)[0].tone, links.get('root')[0].tone);
 }
 assert.equal(links.get('second')[0].tone, links.get('root')[0].tone);
 assert.equal(links.has('single'), false);
 const reordered = recipeLinks([...tasks].reverse(), items);
 const extended = recipeLinks([...tasks, task('unrelated', { itemId: 'cream' })], items);
 for (const [id, group] of links) {
  assert.deepEqual(reordered.get(id), group);
  assert.deepEqual(extended.get(id), group);
 }
 assert.deepEqual(tasks, before);
});

test('shared batches link to every original recipe without assigning the consumers to each other', () => {
 const tasks = [task('root', { requires: ['shared'] }),
  task('other', { itemId: 'other-cake', requires: ['shared'] }),
  task('shared', { itemId: 'cream', generatedFor: 'root', requires: ['nested'] }),
  task('nested', { itemId: 'cream', generatedFor: 'root' })];
 const links = recipeLinks(tasks, [...items, { id: 'other-cake', name: 'Ander gebak' }]);
 for (const id of ['shared', 'nested']) {
  assert.equal(links.get(id).map(link => link.rootId).sort().join(','), 'other,root');
 }
 assert.equal(links.get('root').map(link => link.rootId).join(','), 'root');
 assert.equal(links.get('other').map(link => link.rootId).join(','), 'other');
 assert.equal(tasks.length, 4);
});

test('missing and circular recipe relationships do not invent a recipe link', () => {
 const links = recipeLinks([task('orphan', { generatedFor: 'missing' }),
  task('cycle-a', { generatedFor: 'cycle-b' }), task('cycle-b', { generatedFor: 'cycle-a' })], items);
 assert.equal(links.size, 0);
});

test('recipe clusters keep shared batches once and keep separate recipes and unlinked work separate', () => {
 const tasks = [task('finish', { batchId: 'batch-root', dependsOn: 'root' }),
  task('root', { requires: ['cream'] }), task('other', { requires: ['cream'] }),
  task('cream', { itemId: 'cream', requires: ['nested'] }),
  task('nested', { itemId: 'cream' }), task('unlinked')];
 const before = JSON.stringify(tasks);
 const clusters = recipeTaskClusters(tasks, recipeLinks(tasks, items));
 assert.equal(clusters.length, 4);
 const shared = clusters.find(cluster => cluster.links.length === 2);
 assert.equal(shared.tasks.map(row => row.id).join(','), 'nested,cream');
 assert.equal(clusters.find(cluster => cluster.links.length === 1 && cluster.links[0].rootId === 'root').tasks.map(row => row.id).join(','), 'root,finish');
 assert.equal(clusters.find(cluster => !cluster.links.length).tasks[0].id, 'unlinked');
 const flattened = clusters.flatMap(cluster => cluster.tasks);
 assert.equal(flattened.length, tasks.length);
 assert.equal(new Set(flattened.map(row => row.id)).size, tasks.length);
 assert.equal(JSON.stringify(tasks), before);
 assert(flattened.every(row => tasks.includes(row)), 'Grouping retains the actual tasks, quantities and statuses');
});

test('two batches of the same recipe remain separate even with the same displayed name', () => {
 const tasks = [task('first'), task('first-prep', { generatedFor: 'first', itemId: 'cream' }),
  task('second'), task('second-prep', { generatedFor: 'second', itemId: 'cream' })];
 const clusters = recipeTaskClusters(tasks, recipeLinks(tasks, items));
 assert.equal(clusters.length, 2);
 assert.equal(new Set(clusters.map(cluster => cluster.key)).size, 2);
 assert(clusters.every(cluster => cluster.tasks.length === 2));
});


test('day bundles hide only automatic batches, keeping manual work, follow-ups, orphans and every true task unchanged', () => {
 const tasks = [
  task('root', { date: '2026-11-06', requires: ['auto'] }),
  task('other', { date: '2026-11-07', requires: ['auto'] }),
  task('auto', { itemId: 'cream', date: '2026-11-05', generatedFor: 'root', quantity: 8, status: 'done' }),
  task('auto-follow', { itemId: 'cream', batchId: 'batch-auto', dependsOn: 'auto' }),
  task('manual', { itemId: 'cream' }),
  task('orphan', { itemId: 'cream', generatedFor: 'absent' }),
 ];
 const before = JSON.stringify(tasks), links = recipeLinks(tasks, items);
 const groups = recipeDayClusters(tasks.filter(row => row.date === '2026-11-05'), tasks, links);
 const bundled = groups.flatMap(group => group.preparations);
 assert.equal(bundled.map(row => row.id).sort().join(','), 'auto,auto-follow');
 const shared = groups.find(group => group.preparations.includes(tasks[2]));
 assert.equal(shared.links.length, 2);
 assert.equal(shared.preparations[0].quantity, 8);
 assert.equal(shared.preparations[0].status, 'done');
 assert.equal(groups.flatMap(group => group.tasks).map(row => row.id).sort().join(','), 'manual,orphan');
 const all = [...groups.flatMap(group => [...group.tasks, ...group.preparations])];
 assert.equal(new Set(all.map(row => row.id)).size, 4);
 assert(all.every(row => tasks.includes(row)));
 assert.equal(JSON.stringify(tasks), before);
 const filtered = recipeDayClusters([tasks[3]], tasks, links);
 assert.equal(filtered[0].preparations[0].id, 'auto-follow', 'A generated follow-up remains bundled when its first step is outside the current filter');
 const old = recipeTaskClusters(tasks, links);
 assert.equal(old.flatMap(group => group.tasks).length, tasks.length, 'Existing non-bundled grouping stays available');
});
