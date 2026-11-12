const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const path = require('node:path');
const { changes } = require('./helpers/production-concurrency.cjs');
const { mergeConcurrentChanges: merge, sameData, applyVersionPatch, ConcurrentChangeError } = changes;
function loader(overrides = {}) {
    const cache = new Map();
    function load(file) {
        file = path.normalize(file);
        if (Object.hasOwn(overrides, file))
            return overrides[file];
        if (cache.has(file))
            return cache.get(file);
        const exports = {};
        cache.set(file, exports);
        const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
            compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
        }).outputText;
        vm.runInNewContext(code, { exports, require: name => {
                if (name === 'server-only')
                    return {};
                if (name.startsWith('@/'))
                    return load(name.slice(2) + '.ts');
                if (name.startsWith('.'))
                    return load(path.join(path.dirname(file), name) + '.ts');
                throw Error(`Unexpected import ${name}`);
            }, Error, Map, Set, Date, Intl, JSON, structuredClone, Request, Response, URL, Buffer, crypto: require('node:crypto').webcrypto });
        return exports;
    }
    return load;
}
const pure = loader();
const workspace = pure('app/productie/workspaceData.ts');
const workRecipe = pure('app/productie/workRecipe.ts');
const manager = { id: 'manager-1', email: 'feline@strik-patisserie.nl', active: true, role: 'manager', permissions: {} };
const baker = { id: 'baker-1', active: true, role: 'bakkerij', permissions: { 'bakkerij.patisserie': true } };
const recipe = id => ({ id, name: `Recept ${id}`, type: 'finalProduct', productGroup: 'Gebak', standardBatchQuantity: 10, standardBatchUnit: 'stuk', ingredients: [{ ingredientId: 'flour', quantity: 100, unit: 'gram', costContribution: 20 }], semiFinishedItems: [], preparationSteps: ['Mengen'], workInstructions: ['Maken'], finishingSteps: ['Afwerken'], allergens: [], salesPrice: 99, costPrice: 42 });
function initial() {
    const recipes = { ingredients: [{ id: 'flour', name: 'Bloem', recipeUnit: 'gram', allergens: [], lastPrice: 123 }], recipes: [recipe('a'), recipe('b')], invoiceImports: [], hefeOrderHistory: [], manualProductionPlanningItems: [], allergenLists: [] };
    const planner = workspace.seedWorkspace(recipes);
    planner.tasks = ['a', 'b'].map(id => ({ id: `task-${id}`, itemId: `recipe:${id}`, departmentId: 'dessert', date: '2026-11-12', quantity: 10, operation: 'Maken', status: 'planned', source: 'manual', batchId: `batch-${id}`, recordsOutput: true, note: '' }));
    return { recipes, planner };
}
class StoreError extends Error {
    constructor(message, status = 503) { super(message); this.status = status; }
}
class RevisionError extends StoreError {
    constructor() { super('Concurrent write', 409); }
}
function sharedStore() {
    const source = initial(), current = {}, history = { planner: new Map(), recipes: new Map() };
    for (const key of ['planner', 'recipes']) {
        current[key] = { key, data: structuredClone(source[key]), revision: 1, updated_at: '2026-11-12T08:00:00Z' };
        history[key].set(1, structuredClone(source[key]));
    }
    let races = 0, writes = 0;
    function check(key, revision) { if (current[key].revision !== revision) {
        races++;
        throw new RevisionError();
    } }
    function commit(key, data) { const revision = current[key].revision + 1; current[key] = { ...current[key], data: structuredClone(data), revision }; history[key].set(revision, structuredClone(data)); writes++; return revision; }
    const docs = { ProductionStoreError: StoreError, ProductionRevisionError: RevisionError,
        readDocument: async (key) => structuredClone(current[key]),
        readDocumentRevision: async (key, revision) => structuredClone(history[key].get(revision) || null),
        saveDocument: async (key, revision, data) => { check(key, revision); return commit(key, data); },
        saveRecipePlanDocument: async (revision, recipeRevision, data) => { check('planner', revision); check('recipes', recipeRevision); return commit('planner', data); },
        saveQuickRecipeDocument: async (revision, recipeRevision, planner, recipes) => { check('planner', revision); check('recipes', recipeRevision); commit('recipes', recipes); return commit('planner', planner); }
    };
    function app(profile = manager) { return loader({ 'app/productie/documents.server.ts': docs, 'app/lib/auth/session.ts': { getCurrentProfile: async () => profile }, 'app/productie/release.server.ts': { productionRelease: () => 'test' } }); }
    return { current, history, docs, app, stats: () => ({ races, writes }) };
}
function request(url, body, method = 'POST') { return new Request(`https://example.invalid${url}`, { method, headers: { Origin: 'https://example.invalid', 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); }
async function expectOK(response) { assert.equal(response.status, 200, JSON.stringify(await response.clone().json())); return response.json(); }
function workBody(taskId, id) { return { revision: 1, id, command: { kind: 'complete', taskId, who: id, minutes: 20, quantity: 10, crewSize: 1 } }; }
function recipeBody(store, id) { const command = workRecipe.editableWorkRecipe(store.current.planner.data, store.current.recipes.data, `recipe:${id}`); command.ingredients[0].quantity = 150; return { revision: 1, recipeRevision: 1, scope: 'permanent', who: 'Feline', command }; }
test('merge preserves unrelated records and never resurrects deleted records', () => {
    const base = { tasks: [{ id: 'a', n: 1 }, { id: 'b', n: 2 }], history: [] };
    const mine = { ...base, tasks: [{ id: 'a', n: 3 }, base.tasks[1]] };
    const live = { tasks: [base.tasks[0], { id: 'c', n: 4 }], history: [{ id: 'log', who: 'Bakker' }] };
    const result = merge(base, mine, live);
    assert.deepEqual(JSON.parse(JSON.stringify(result)), { tasks: [{ id: 'a', n: 3 }, { id: 'c', n: 4 }], history: [{ id: 'log', who: 'Bakker' }] });
    assert.equal(base.tasks[0].n, 1);
    assert.equal(live.tasks[0].n, 1);
    assert.throws(() => merge(base, mine, { ...base, tasks: base.tasks.slice(1) }), ConcurrentChangeError);
    assert.throws(() => merge(base, mine, { ...base, tasks: [{ id: 'a', n: 9 }, base.tasks[1]] }), ConcurrentChangeError);
    assert(sameData({ a: 1, b: undefined }, { a: 1 }));
});
test('stored patches replay nested edits, array additions/deletions, null and root replacement safely', () => {
    let data = { tasks: [{ id: 'a', n: 1 }, { id: 'b', n: 2 }], note: null };
    data = applyVersionPatch(data, [{ op: 'set', path: ['tasks', '0', 'n'], value: 3 }, { op: 'remove', path: ['tasks', '1'] }, { op: 'set', path: ['tasks', '1'], value: { id: 'c', n: 4 } }, { op: 'remove', path: ['note'] }, { op: 'set', path: ['new'], value: null }]);
    assert.deepEqual(data, { tasks: [{ id: 'a', n: 3 }, { id: 'c', n: 4 }], new: null });
    assert.deepEqual(applyVersionPatch(data, [{ op: 'set', path: [], value: { new: [] } }]), { new: [] });
    assert.throws(() => applyVersionPatch({}, [{ op: 'set', path: ['__proto__', 'polluted'], value: true }]));
    assert.equal({}.polluted, undefined);
});
test('two users can complete different tasks at exactly the same time with both audit entries retained', async () => {
    const store = sharedStore(), a = store.app(baker)('app/api/productie/werk/route.ts'), b = store.app({ ...baker, id: 'baker-2' })('app/api/productie/werk/route.ts');
    const responses = await Promise.all([a.POST(request('/api/productie/werk', workBody('task-a', 'finish-a-0001'))), b.POST(request('/api/productie/werk', workBody('task-b', 'finish-b-0001')))]);
    for (const response of responses)
        await expectOK(response);
    assert(store.stats().races >= 1, 'the test must exercise the actual compare-and-swap race');
    assert(store.current.planner.data.tasks.every(task => task.status === 'done'));
    assert.equal(store.current.planner.data.productionWork.work.length, 2);
    assert.deepEqual(new Set(store.current.planner.data.productionWork.work.map(row => row.actorId)), new Set(['baker-1', 'baker-2']));
    const response = await a.POST(request('/api/productie/werk', workBody('task-a', 'finish-a-0001')));
    await expectOK(response);
    assert.equal(store.current.planner.data.productionWork.work.length, 2, 'retrying an acknowledged completion is idempotent');
});
test('two stale planner editors can move different tasks while retaining concurrent work logs', async () => {
    const store = sharedStore(), base = structuredClone(store.current.planner.data), a = store.app()('app/api/productie/route.ts'), b = store.app()('app/api/productie/route.ts');
    const first = structuredClone(base), second = structuredClone(base);
    first.tasks[0].date = '2026-11-13';
    second.tasks[1].date = '2026-11-14';
    const responses = await Promise.all([a.PUT(request('/api/productie', { revision: 1, state: first }, 'PUT')), b.PUT(request('/api/productie', { revision: 1, state: second }, 'PUT'))]);
    for (const response of responses)
        await expectOK(response);
    assert.equal(store.current.planner.data.tasks[0].date, '2026-11-13');
    assert.equal(store.current.planner.data.tasks[1].date, '2026-11-14');
    const stale = structuredClone(base);
    stale.tasks[0].date = '2026-11-15';
    assert.equal((await a.PUT(request('/api/productie', { revision: 1, state: stale }, 'PUT'))).status, 409);
    const beforeWork = structuredClone(store.current.planner.data), work = store.app(baker)('app/api/productie/werk/route.ts');
    await expectOK(await work.POST(request('/api/productie/werk', { ...workBody('task-b', 'finished-b-02'), revision: 3 })));
    beforeWork.tasks[0].note = 'Door Feline gewijzigd';
    const saved = await expectOK(await a.PUT(request('/api/productie', { revision: 3, state: beforeWork }, 'PUT')));
    assert.equal(saved.state.tasks[1].status, 'done');
    assert.equal(saved.state.productionWork.work.length, 1);
    assert.equal(saved.state.tasks[0].note, 'Door Feline gewijzigd');
});
test('editing a fixed recipe and completing another task concurrently preserves recipes, times and quantities', async () => {
    const store = sharedStore(), body = recipeBody(store, 'a'), recipes = store.app()('app/api/productie/snel-recept/route.ts'), work = store.app(baker)('app/api/productie/werk/route.ts');
    const responses = await Promise.all([recipes.POST(request('/api/productie/snel-recept', body)), work.POST(request('/api/productie/werk', workBody('task-b', 'finished-b-03')))]);
    for (const response of responses)
        await expectOK(response);
    assert.equal(store.current.recipes.data.recipes[0].ingredients[0].quantity, 150);
    assert.equal(store.current.recipes.data.recipes[0].costPrice, 42);
    assert.equal(store.current.planner.data.tasks[1].status, 'done');
    assert.equal(store.current.planner.data.productionWork.work.length, 1);
    assert.equal(store.current.planner.data.productionWork.history.length, 2);
});
test('different fixed recipes can be edited concurrently, including their separate audit entries', async () => {
    const store = sharedStore(), a = store.app()('app/api/productie/snel-recept/route.ts'), b = store.app()('app/api/productie/snel-recept/route.ts');
    const responses = await Promise.all([a.POST(request('/api/productie/snel-recept', recipeBody(store, 'a'))), b.POST(request('/api/productie/snel-recept', recipeBody(store, 'b')))]);
    for (const response of responses)
        await expectOK(response);
    assert(store.current.recipes.data.recipes.every(recipe => recipe.ingredients[0].quantity === 150));
    assert.equal(store.current.planner.data.productionWork.history.length, 2);
    const stale = recipeBody(store, 'a');
    stale.command.ingredients[0].quantity = 200;
    assert.equal((await a.POST(request('/api/productie/snel-recept', stale))).status, 409);
    assert.equal(store.current.recipes.data.recipes[0].ingredients[0].quantity, 150);
});
test('full recipe administration merges separate recipes without erasing financial fields or offers', async () => {
    const store = sharedStore(), base = structuredClone(store.current.recipes), a = store.app()('app/productie/recipeStore.server.ts'), b = store.app()('app/productie/recipeStore.server.ts');
    const first = { ...structuredClone(base.data), storageRevision: 1 }, second = { ...structuredClone(base.data), storageRevision: 1 };
    first.recipes[0].name = 'Nieuw A';
    second.recipes[1].name = 'Nieuw B';
    await Promise.all([a.saveSharedRecipes(base, first, manager), b.saveSharedRecipes(base, second, manager)]);
    assert.equal(store.current.recipes.data.recipes[0].name, 'Nieuw A');
    assert.equal(store.current.recipes.data.recipes[1].name, 'Nieuw B');
    assert.equal(store.current.recipes.data.ingredients[0].lastPrice, 123);
    await assert.rejects(a.saveSharedRecipes(store.current.recipes, { ...first, recipes: [{ ...first.recipes[0], name: 'Overschrijving' }, first.recipes[1]] }, manager), error => error.status === 409);
});
test('stale completion cannot overwrite a moved task or a newly running timer', async () => {
    const store = sharedStore(), edit = store.app()('app/api/productie/route.ts'), work = store.app(baker)('app/api/productie/werk/route.ts');
    const next = structuredClone(store.current.planner.data);
    next.tasks[0].date = '2026-11-13';
    await expectOK(await edit.PUT(request('/api/productie', { revision: 1, state: next }, 'PUT')));
    assert.equal((await work.POST(request('/api/productie/werk', workBody('task-a', 'finished-a-04')))).status, 409);
    await expectOK(await work.POST(request('/api/productie/werk', { revision: 2, id: 'started-b-004', command: { kind: 'start', taskId: 'task-b', who: 'Bakker' } })));
    assert.equal((await work.POST(request('/api/productie/werk', { ...workBody('task-b', 'finished-b-04'), revision: 2 }))).status, 409);
    assert(store.current.planner.data.productionWork.timers['task-b'].runningSince);
});
test('separate recipe plans can be added concurrently using stable task identities', async () => {
    const store = sharedStore(), a = store.app()('app/api/productie/plan/route.ts'), b = store.app()('app/api/productie/plan/route.ts');
    function body(id) { return { revision: 1, recipeRevision: 1, command: { amount: 20, amountMode: 'quantity', task: { ...store.current.planner.data.tasks.find(task => task.itemId === `recipe:${id}`), id: `new-${id}`, batchId: `new-batch-${id}` } } }; }
    const responses = await Promise.all([a.POST(request('/api/productie/plan', body('a'))), b.POST(request('/api/productie/plan', body('b')))]);
    for (const response of responses)
        await expectOK(response);
    assert.equal(store.current.planner.data.tasks.length, 4);
    assert.equal(new Set(store.current.planner.data.tasks.map(task => task.id)).size, 4);
});
test('genuine concurrent edits and stale authorization never become an unconditional retry', async () => {
    const store = sharedStore(), helpers = store.app()('app/productie/concurrentEditing.server.ts');
    let attempts = 0;
    await assert.rejects(helpers.retryConcurrentSave(async () => { attempts++; throw new StoreError('Unavailable'); }));
    assert.equal(attempts, 1);
    attempts = 0;
    await assert.rejects(helpers.retryConcurrentSave(async () => { attempts++; throw new RevisionError(); }));
    assert.equal(attempts, 4);
    const api = store.app({ ...baker, active: false })('app/api/productie/werk/route.ts');
    assert.equal((await api.POST(request('/api/productie/werk', workBody('task-a', 'finished-a-05')))).status, 403);
    assert.equal(store.stats().writes, 0);
});
test('document history loads across API page boundaries and rejects missing revisions', async () => {
    const rows = Array.from({ length: 503 }, (_, index) => ({ revision: index + 1, data: index === 0 ? { format: 'snapshot-v1', value: { n: 1 } } : { format: 'patch-v1', changes: [{ op: 'set', path: ['n'], value: index + 1 }] } }));
    let calls = 0;
    const database = { from: () => {
            let after = 0, end = 0;
            const query = { select: () => query, eq: () => query, gt: (_, value) => { after = value; return query; }, lte: (_, value) => { end = value; return query; }, order: () => query, limit: async (count) => { calls++; return { data: rows.filter(row => row.revision > after && row.revision <= end).slice(0, count) }; } };
            return query;
        } };
    const docs = loader({ 'app/lib/supabase/admin.ts': { createAdminClient: () => database } })('app/productie/documents.server.ts');
    assert.equal((await docs.readDocumentRevision('planner', 503)).n, 503);
    assert.equal(calls, 2);
    assert.equal((await docs.readDocumentRevision('planner', 503)).n, 503);
    assert.equal(calls, 2, 'immutable revision is cached');
    rows.splice(300, 1);
    assert.equal(await docs.readDocumentRevision('recipes', 503), null);
});
test('the recipe screen retains remote edits in subsequent saves and queues rapid local changes', async () => {
    const store = sharedStore();
    const server = store.app()('app/productie/recipeStore.server.ts');
    const sync = pure('app/productie/recipeSynchronization.ts');
    const initialData = { ...structuredClone(store.current.recipes.data), storageRevision: 1 };
    const displayed = [];
    const queue = sync.createRecipeSaveQueue(async (data) => {
        const result = await server.saveSharedRecipes(structuredClone(store.current.recipes), data, manager);
        return { ok: true, data: result };
    }, data => displayed.push(structuredClone(data)));
    queue.initialize(initialData);
    const otherEditor = structuredClone(initialData);
    otherEditor.recipes[1].name = 'B door andere medewerker';
    await server.saveSharedRecipes(structuredClone(store.current.recipes), otherEditor, manager);
    const first = structuredClone(initialData);
    first.recipes[0].name = 'A eerste wijziging';
    const second = structuredClone(first);
    second.recipes[0].name = 'A volgende wijziging';
    const responses = await Promise.all([queue.save(first), queue.save(second)]);
    assert(responses.every(response => response.ok));
    assert.equal(store.current.recipes.data.recipes[0].name, 'A volgende wijziging');
    assert.equal(store.current.recipes.data.recipes[1].name, 'B door andere medewerker');
    assert.equal(displayed.at(-1).recipes[0].name, 'A volgende wijziging');
    assert.equal(displayed.at(-1).recipes[1].name, 'B door andere medewerker');
    const third = structuredClone(displayed.at(-1));
    third.recipes[0].name = 'A derde wijziging';
    assert((await queue.save(third)).ok);
    assert.equal(store.current.recipes.data.recipes[1].name, 'B door andere medewerker');
});
test('a rejected recipe save keeps the local draft and a later save includes earlier unsaved changes', async () => {
    const sync = pure('app/productie/recipeSynchronization.ts');
    const data = { ...initial().recipes, storageRevision: 1 };
    const saved = [], displayed = [];
    let attempts = 0;
    const queue = sync.createRecipeSaveQueue(async (payload) => {
        attempts++;
        if (attempts === 1)
            return { ok: false, message: 'Tijdelijk offline' };
        saved.push(structuredClone(payload));
        return { ok: true, data: { ...payload, storageRevision: 2 } };
    }, value => displayed.push(value));
    queue.initialize(data);
    const first = structuredClone(data);
    first.recipes[0].name = 'Nog niet opgeslagen';
    const second = structuredClone(first);
    second.recipes[1].name = 'Ook bewaren';
    assert.equal((await queue.save(first)).ok, false);
    assert.equal(displayed.length, 0);
    assert((await queue.save(second)).ok);
    assert.equal(saved[0].recipes[0].name, 'Nog niet opgeslagen');
    assert.equal(saved[0].recipes[1].name, 'Ook bewaren');
});
test('two physical stock counts for the same product require a fresh count after the first use', async () => {
    const store = sharedStore();
    store.current.planner.data.tasks[1].itemId = 'recipe:a';
    store.history.planner.set(1, structuredClone(store.current.planner.data));
    const api = store.app(baker)('app/api/productie/werk/route.ts');
    const stock = taskId => ({ revision: 1, id: `stock-count-${taskId}`, command: { kind: 'stock', taskId, who: 'Bakker', countedQuantity: 30, confirmed: true } });
    await expectOK(await api.POST(request('/api/productie/werk', stock('task-a'))));
    assert.equal((await api.POST(request('/api/productie/werk', stock('task-b')))).status, 409);
    assert.equal(Object.keys(store.current.planner.data.productionWork.stockFulfillments).length, 1);
});
test('production accounts merge registrations for separate recipes while preserving hidden financial data', async () => {
    const store = sharedStore();
    const api = store.app(baker);
    const server = api('app/productie/recipeStore.server.ts');
    const projection = api('app/bakkerij/recepturen/recipeAccess.ts');
    const data = { ...projection.recipeDataForProduction(store.current.recipes.data), storageRevision: 1 };
    const first = structuredClone(data);
    const second = structuredClone(data);
    first.recipes[0].lastProducedQuantity = 50;
    second.recipes[1].lastProducedQuantity = 60;
    const responses = await Promise.all([
        server.saveSharedRecipes(structuredClone(store.current.recipes), first, baker),
        server.saveSharedRecipes(structuredClone(store.current.recipes), second, baker),
    ]);
    assert.equal(store.current.recipes.data.recipes[0].lastProducedQuantity, 50);
    assert.equal(store.current.recipes.data.recipes[1].lastProducedQuantity, 60);
    assert.equal(store.current.recipes.data.recipes[0].salesPrice, 99);
    assert.equal(store.current.recipes.data.ingredients[0].lastPrice, 123);
    assert(responses.every(result => result.recipes.every(recipe => recipe.salesPrice === 0)));
});
test('two people changing the same recipe retain the second draft and the first saved version', async () => {
    const store = sharedStore();
    const server = store.app()('app/productie/recipeStore.server.ts');
    const sync = pure('app/productie/recipeSynchronization.ts');
    const data = { ...structuredClone(store.current.recipes.data), storageRevision: 1 };
    const displayed = [];
    const queue = sync.createRecipeSaveQueue(async (payload) => {
        try {
            return { ok: true, data: await server.saveSharedRecipes(structuredClone(store.current.recipes), payload, manager) };
        }
        catch (error) {
            return { ok: false, message: error.message, status: error.status };
        }
    }, value => displayed.push(value));
    queue.initialize(data);
    const first = structuredClone(data);
    first.recipes[0].name = 'Eerste medewerker';
    await server.saveSharedRecipes(structuredClone(store.current.recipes), first, manager);
    const second = structuredClone(data);
    second.recipes[0].name = 'Tweede medewerker';
    const result = await queue.save(second);
    assert.equal(result.ok, false);
    assert.equal(result.status, 409);
    assert.match(result.message, /invoer blijft bewaard/);
    assert.equal(displayed.length, 0);
    assert.equal(second.recipes[0].name, 'Tweede medewerker');
    assert.equal(store.current.recipes.data.recipes[0].name, 'Eerste medewerker');
});
