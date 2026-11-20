const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const ts = require('typescript');

function loader(overrides = {}) {
  const cache = new Map();
  function load(file) {
    file = path.normalize(file);
    if (Object.hasOwn(overrides, file)) return overrides[file];
    if (cache.has(file)) return cache.get(file);
    const exports = {};
    cache.set(file, exports);
    const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    vm.runInNewContext(code, {
      exports, require: name => {
        if (name === 'server-only') return {};
        if (name.startsWith('@/')) return load(name.slice(2) + '.ts');
        if (name.startsWith('.')) return load(path.join(path.dirname(file), name) + '.ts');
        throw Error(`Unexpected import ${name}`);
      }, Error, Map, Set, Date, Intl, JSON, structuredClone, Request, Response, URL, Buffer,
      crypto: require('node:crypto').webcrypto,
    });
    return exports;
  }
  return load;
}
const load = loader();
const planning = load('app/productie/planning.ts');
const recipes = load('app/productie/recipePlanning.ts');
const inventory = load('app/productie/inventory.ts');
const workspace = load('app/productie/workspaceData.ts');
const ids = {
  sausage: 'recipe-new-1782226444084', truffles: 'recipe-new-1782249922037',
  raspberry: 'recipe-new-1783603930205', dough: 'hf030',
};
function recipe(id, yieldAmount, unit = 'stuks', lines = [], type = 'finalProduct') {
  return { id, name: id, yield: yieldAmount, unit, type, ingredients: [], steps: [], allergens: [], semiFinishedItems: lines };
}
function stateFor(catalog) {
  return { version: 1, items: catalog.map(row => ({ id: `recipe:${row.id}`, recipeId: row.id, name: row.name,
    kind: row.type === 'semiFinished' ? 'component' : 'product', unit: row.unit,
    departmentId: 'dessert', stock: 0, stockKnown: false, productionSteps: row.productionSteps, note: '' })), tasks: [] };
}
function command(id, recipeId, quantity, stepId, sources = [], date = '2026-11-17') {
  return { task: { id, itemId: `recipe:${recipeId}`, departmentId: 'dessert', date, operation: stepId || 'Maken',
    status: 'planned', source: 'manual', note: '', batchId: `batch:${id}`, recordsOutput: true },
    amount: quantity, amountMode: 'quantity', ...(stepId ? { stage: { stepId, sources } } : {}) };
}
function finish(state, id, actual) {
  const tasks = planning.transitionTask(state.tasks, id, 'done', state.items);
  return { ...state, tasks: tasks.map(task => task.id === id ? { ...task, completedQuantity: actual ?? task.quantity } : task) };
}
const task = (state, id) => state.tasks.find(row => row.id === id);

test('one sausage batch supports daily bake-offs and counts only baked output', () => {
  const catalog = [recipe(ids.sausage, 225)];
  let state = recipes.buildRecipePlan(stateFor(catalog), catalog, command('make', ids.sausage, 1500, 'Produceren'));
  state = finish(state, 'make');
  for (const [id, date] of [['bake1', '2026-11-18'], ['bake2', '2026-11-19']]) {
    state = recipes.buildRecipePlan(state, catalog, command(id, ids.sausage, 250, 'Afbakken', [{ taskId: 'make', quantity: 250 }], date));
    state = finish(state, id);
  }
  assert.equal(planning.remainingParty(state, task(state, 'make')), 1000);
  assert.equal(state.tasks.filter(row => row.recordsOutput).length, 2);
  assert.equal(state.tasks.filter(row => row.recordsOutput).reduce((sum, row) => sum + row.completedQuantity, 0), 500);
  assert(planning.validProductionStages(state));
  assert.throws(() => recipes.buildRecipePlan(state, catalog, command('over', ids.sausage, 1001, 'Afbakken', [{ taskId: 'make', quantity: 1001 }], '2026-11-20')), /al meer ingepland/);
  assert.throws(() => planning.transitionTask(state.tasks, 'make', 'planned', state.items), /volgende stap/);
});

test('truffle quantities are boxes of ten and two piping parties combine for coating', () => {
  const catalog = [recipe(ids.truffles, 167, 'stuk')];
  let state = stateFor(catalog);
  assert.equal(planning.productionUnit(state.items[0]), 'doosjes');
  assert.equal(planning.productionRoute(state.items[0]).packSize, 10);
  for (const id of ['fri', 'tue']) {
    state = recipes.buildRecipePlan(state, catalog, command(id, ids.truffles, 167, 'Spuiten'));
    state = finish(state, id);
  }
  const coat = command('coat', ids.truffles, 300, 'Doorhalen', [{ taskId: 'fri', quantity: 167 }, { taskId: 'tue', quantity: 133 }], '2026-11-18');
  state = recipes.buildRecipePlan(state, catalog, coat);
  assert.equal(planning.remainingParty(state, task(state, 'tue')), 34);
  assert.equal(task(state, 'coat').recordsOutput, true);
  assert.equal(state.tasks.filter(row => row.recordsOutput).length, 1);
  assert.equal(recipes.buildRecipePlan(state, catalog, coat), state, 'identical retry adds no reservation');
  state = finish(state, 'coat');
  const invalid = structuredClone(state);
  task(invalid, 'coat').completedQuantity = 301;
  assert.equal(planning.validProductionStages(invalid), false);
});

test('raspberry unmoulding uses an existing filled party without adding another finished output', () => {
  const catalog = [recipe(ids.raspberry, 480)];
  let state = recipes.buildRecipePlan(stateFor(catalog), catalog, command('fill', ids.raspberry, 480, 'Interieur vullen', [], '2026-11-12'));
  state = finish(state, 'fill');
  state = recipes.buildRecipePlan(state, catalog, command('pour', ids.raspberry, 480, 'Storten', [{ taskId: 'fill', quantity: 480 }], '2026-11-13'));
  state = finish(state, 'pour');
  state = recipes.buildRecipePlan(state, catalog, command('unmould', ids.raspberry, 480, 'Lossen', [{ taskId: 'pour', quantity: 480 }]));
  assert.throws(() => recipes.buildRecipePlan(state, catalog, command('extra', ids.raspberry, 20, 'Lossen', [{ taskId: 'pour', quantity: 20 }])), /al meer ingepland/);
  state = finish(state, 'unmould');
  assert.equal(state.tasks.filter(row => row.recordsOutput).length, 1);
  const bad = structuredClone(state);
  task(bad, 'unmould').materialNeeds.fill = 1;
  assert.equal(planning.validProductionStages(bad), false, 'unrelated source links are refused');
  task(state, 'pour').completedQuantity = 400;
  assert.match(planning.taskIssues(task(state, 'unmould'), state.tasks, state.items).join(' '), /minder beschikbaar/);
});

function sharedDough() {
  const catalog = [recipe(ids.dough, 30, 'kg', [], 'semiFinished'),
    recipe('bossche', 100, 'stuks', [{ recipeId: ids.dough, quantity: 3900, unit: 'gram' }]),
    recipe('saucijs', 552, 'stuks', [{ recipeId: ids.dough, quantity: 4000, unit: 'gram' }]),
    recipe(ids.sausage, 225, 'stuks', [{ recipeId: ids.dough, quantity: 1000, unit: 'gram' }])];
  let state = recipes.buildRecipePlan(stateFor(catalog), catalog, command('dough', ids.dough, 90, 'Beslag maken'));
  state = finish(state, 'dough');
  return { catalog, state };
}
function useDough(id, recipeId, quantity) {
  return { ...command(id, recipeId, quantity), preparation: { daysBefore: 0, choices: { [ids.dough]: { sourceTaskId: 'dough' } } } };
}
test('shared dough is allocated by actual recipe weights with no duplicate or nested production', () => {
  let { state, catalog } = sharedDough();
  for (const [id, recipeId, quantity, expected] of [['bossche1', 'bossche', 100, 3.9], ['saucijs1', 'saucijs', 552, 4], ['sausage1', ids.sausage, 225, 1]]) {
    state = recipes.buildRecipePlan(state, catalog, useDough(id, recipeId, quantity));
    assert.equal(task(state, id).materialNeeds.dough, expected);
  }
  assert.equal(state.tasks.filter(row => row.itemId === `recipe:${ids.dough}`).length, 1);
  assert.equal(planning.remainingParty(state, task(state, 'dough')), 81.1);
  const current = recipes.currentPlanCommand(state, task(state, 'bossche1'));
  state = recipes.refreshRecipePlan(state, catalog, 'bossche1', current);
  assert.equal(task(state, 'bossche1').requires[0], 'dough');
  assert.equal(task(state, 'bossche1').recipePlan.preparation.choices[ids.dough].sourceTaskId, 'dough');
  assert.equal(planning.remainingParty(state, task(state, 'dough')), 81.1);
  const repeated = useDough('over', 'bossche', 1200);
  repeated.dates = ['2026-11-17', '2026-11-18'];
  assert.throws(() => recipes.buildRecipePlan(state, catalog, repeated), /al aan andere producties/);
});

test('inventory consumes explicit material once and recipe-less article dispatches still work', () => {
  let { state, catalog } = sharedDough();
  state = recipes.buildRecipePlan(state, catalog, useDough('bossche1', 'bossche', 100));
  state = finish(state, 'bossche1');
  state.tasks.push({ ...task(state, 'bossche1'), id: 'finish1', recordsOutput: false });
  const loose = { id: 'loose', name: 'Zonder recept', unit: 'stuks', kind: 'product', departmentId: 'bak', stock: 0, note: '' };
  state.items.push(loose);
  const counts = { revision: 1, counts: [
    { id: 'd', itemId: `recipe:${ids.dough}`, unit: 'kg', date: '2026-11-16', quantity: 0, at: '2026-11-16T20:00:00Z' },
    { id: 'l', itemId: 'loose', unit: 'stuks', date: '2026-11-16', quantity: 20, at: '2026-11-16T20:00:00Z' },
  ], links: [{ itemId: 'loose', unit: 'stuks', article: '1234', factor: 1, leadDays: 0 }], actions: [] };
  const days = [{ date: '2026-11-17', importedAt: '2026-11-17T19:00:00Z', unknownLines: 0, lines: [{ article: '1234', description: 'Zonder recept', quantity: 7 }] }];
  const rows = inventory.inventoryOverview(state, counts, days, '2026-11-17').rows;
  assert.equal(rows.find(row => row.itemId === `recipe:${ids.dough}`).balance, 86.1);
  assert.equal(rows.find(row => row.itemId === `recipe:${ids.dough}`).used, 3.9);
  assert.equal(rows.find(row => row.itemId === 'loose').balance, 13);
  assert.equal(rows.find(row => row.itemId === 'loose').known, true);
  assert.equal(inventory.mergeDispatchDays(days, days).length, 1, 'repeat imports replace a day');
});

test('unavailable stages and forged dependencies are rejected', () => {
  const catalog = [recipe(ids.sausage, 225)];
  const state = stateFor(catalog);
  for (const stage of ['Afbakken', 'Onbekend']) {
    assert.throws(() => recipes.buildRecipePlan(state, catalog, command('bad', ids.sausage, 10, stage, [{ taskId: 'missing', quantity: 10 }])));
  }
  const first = command('first', ids.sausage, 10, 'Produceren');
  first.task.dependsOn = 'missing';
  assert.throws(() => recipes.buildRecipePlan(state, catalog, first));
  const malformed = command('bad', ids.sausage, 10, 'Afbakken');
  malformed.stage.sources = {};
  assert.throws(() => recipes.buildRecipePlan(state, catalog, malformed), /gemaakte partij/);
});

test('the plan API rechecks a shared party after a simultaneous save', async () => {
  class StoreError extends Error { constructor(message, status = 503) { super(message); this.status = status; } }
  class RevisionError extends StoreError { constructor() { super('Concurrent write', 409); } }
  const raw = { recipes: [{ id: ids.sausage, name: 'Worstenbroodje', type: 'finalProduct', productGroup: 'Brood',
    standardBatchQuantity: 225, standardBatchUnit: 'stuk', ingredients: [], semiFinishedItems: [],
    preparationSteps: [], finishingSteps: [], workInstructions: [], allergens: [] }], ingredients: [], invoiceImports: [] };
  const views = workspace.recipeViews(raw);
  let initial = workspace.seedWorkspace(raw);
  initial = recipes.buildRecipePlan(initial, views, command('make', ids.sausage, 1500, 'Produceren'));
  initial = finish(initial, 'make');
  const current = { planner: { key: 'planner', data: initial, revision: 1 }, recipes: { key: 'recipes', data: raw, revision: 1 } };
  const history = new Map([[1, structuredClone(initial)]]);
  let races = 0;
  const docs = { ProductionStoreError: StoreError, ProductionRevisionError: RevisionError,
    readDocument: async key => structuredClone(current[key]),
    readDocumentRevision: async (key, revision) => key === 'planner' ? structuredClone(history.get(revision)) : raw,
    saveRecipePlanDocument: async (revision, recipeRevision, data) => {
      if (revision !== current.planner.revision) { races++; throw new RevisionError(); }
      current.planner = { key: 'planner', data: structuredClone(data), revision: revision + 1 };
      history.set(revision + 1, structuredClone(data));
      return revision + 1;
    } };
  const api = loader({ 'app/productie/documents.server.ts': docs,
    'app/lib/auth/session.ts': { getCurrentProfile: async () => ({ id: 'manager', email: 'manager@example.invalid', active: true, role: 'manager', permissions: {} }) },
  })('app/api/productie/plan/route.ts');
  const request = id => new Request('https://example.invalid/api/productie/plan', { method: 'POST', headers: { origin: 'https://example.invalid' },
    body: JSON.stringify({ revision: 1, recipeRevision: 1, command: command(id, ids.sausage, 1000, 'Afbakken', [{ taskId: 'make', quantity: 1000 }]) }) });
  const responses = await Promise.all([api.POST(request('one')), api.POST(request('two'))]);
  const statuses = responses.map(row => row.status).sort();
  if (statuses[0] !== 200) assert.fail(JSON.stringify(await Promise.all(responses.map(row => row.json()))));
  assert.equal(statuses[0], 200);
  assert.equal(statuses[1], 400);
  assert(races > 0);
  assert.equal(planning.reservedMaterial(current.planner.data, 'make'), 1000);
});


test('speculaas products get dough and bake stages without changing unrelated recipes', () => {
  for (const name of ['Speculaasbrok naturel', 'Speculaasplakken', 'Speculaasjes met amandel', 'Gevulde speculaas', 'Gevuld speculaas', 'Speculaaspopje']) {
    assert.equal(planning.defaultProductionSteps({name}).join('|'), 'Deeg zetten|Product maken & afbakken');
  }
  for (const name of ['Stol Speculaas', 'Speculaas Boterkoek', 'Vanille Mousse']) assert.equal(planning.defaultProductionSteps({name}), undefined);
  assert.equal(planning.defaultProductionSteps({name:'Speculaasdeeg'}).join('|'), 'Deeg zetten');
});

test('the normal recipe entry starts at dough and only baked speculaas increases finished stock', () => {
  const catalog = [{...recipe('spec', 120), name:'Speculaasbrok naturel'}];
  let state = recipes.buildRecipePlan(stateFor(catalog), catalog, command('dough', 'spec', 120));
  assert.equal(task(state, 'dough').operation, 'Deeg zetten');
  assert.equal(task(state, 'dough').recordsOutput, false);
  state = finish(state, 'dough');
  state = recipes.buildRecipePlan(state, catalog, command('bake', 'spec', 40, 'Product maken & afbakken', [{taskId:'dough',quantity:40}]));
  assert.equal(planning.productionStageStock(state, state.items[0], 'Deeg zetten', '2026-11-17').onHand, 120);
  assert.equal(planning.productionStageStock(state, state.items[0], 'Deeg zetten', '2026-11-17').reserved, 40);
  state = finish(state, 'bake');
  assert.equal(planning.productionStageStock(state, state.items[0], 'Deeg zetten', '2026-11-17').onHand, 80);
  const counts = {revision:1,counts:[{id:'zero',itemId:'recipe:spec',unit:'stuks',date:'2026-11-16',quantity:0,at:'2026-11-16T20:00:00Z'}],links:[],actions:[]};
  assert.equal(inventory.inventoryOverview(state, counts, [], '2026-11-17').rows[0].balance, 40);
});

test('unbaked physical stock stays distinct from reservations and future productions', () => {
  const catalog = [recipe(ids.sausage, 225)];
  let state = recipes.buildRecipePlan(stateFor(catalog), catalog, command('make', ids.sausage, 1500));
  state = finish(state, 'make');
  state = recipes.buildRecipePlan(state, catalog, command('future', ids.sausage, 2000, undefined, [], '2026-11-18'));
  state = finish(state, 'future');
  state = recipes.buildRecipePlan(state, catalog, command('bake', ids.sausage, 250, 'Afbakken', [{taskId:'make',quantity:250}]));
  const item=state.items[0], route=planning.productionRoute(item);
  const before=planning.productionStageStock(state,item,'Produceren','2026-11-17',route);
  assert.equal(before.onHand,1500);assert.equal(before.reserved,250);assert.equal(before.available,1250);
  state=finish(state,'bake');
  const after=planning.productionStageStock(state,item,'Produceren','2026-11-17',route);
  assert.equal(after.onHand,1250);assert.equal(after.reserved,0);
  assert.equal(planning.stageParties(state,item,route,1,'2026-11-17').length,1);
});

test('configured recipe steps and quantities work for an item without a recipe', () => {
  const item={id:'loose',name:'Nieuw product',unit:'stuks',kind:'product',departmentId:'bak',stock:0,note:'',productionSteps:['Produceren','Afbakken']};
  const cmd=command('make','unused',500);cmd.task.itemId='loose';
  let state=recipes.buildRecipePlan({version:1,items:[item],tasks:[]},[],cmd);
  assert.equal(task(state,'make').recordsOutput,false);
  state=finish(state,'make');
  const bake=command('bake','unused',100,'Afbakken',[{taskId:'make',quantity:100}]);bake.task.itemId='loose';
  state=recipes.buildRecipePlan(state,[],bake);state=finish(state,'bake');
  assert.equal(task(state,'bake').recordsOutput,true);assert(planning.validProductionStages(state));
});

test('saved parties retain their stage sequence when recipe settings change', () => {
  const catalog=[{...recipe('cake',100),productionSteps:['Produceren','Storten','Afwerken']}];
  let state=recipes.buildRecipePlan(stateFor(catalog),catalog,command('make','cake',100));
  state=finish(state,'make');
  state.items[0].productionSteps=['Produceren','Afbakken'];
  assert.equal(planning.productionRoute(state.items[0],task(state,'make')).steps.join('|'),'Produceren|Storten|Afwerken');
  state=recipes.buildRecipePlan(state,catalog,command('pour','cake',30,'Storten',[{taskId:'make',quantity:30}]));
  assert.equal(task(state,'pour').recordsOutput,false);
  assert.throws(()=>recipes.buildRecipePlan(state,catalog,command('wrong','cake',20,'Afbakken',[{taskId:'make',quantity:20}])));
});

test('recipe refresh preserves legacy output and new clients cannot forge a shortened route', () => {
  const catalog=[recipe(ids.sausage,225)];
  const legacy={...command('old',ids.sausage,1500).task,quantity:1500,operation:'Produceren'};
  const state={...stateFor(catalog),tasks:[legacy]};
  const refreshed=recipes.refreshRecipePlan(state,catalog,'old',command('old',ids.sausage,1500));
  assert.equal(task(refreshed,'old').productionStage,undefined);assert.equal(task(refreshed,'old').recordsOutput,true);
  const forged=command('new',ids.sausage,1500);forged.task.productionStage={stepId:'Produceren',steps:['Produceren'],sources:[]};
  const next=recipes.buildRecipePlan(state,catalog,forged);
  assert.equal(task(next,'new').recordsOutput,false);
  assert.equal(task(next,'new').productionStage.steps.join('|'),'Produceren|Afbakken');
  assert.equal(planning.stageParties(next,next.items[0],planning.productionRoute(next.items[0]),1,'2026-11-17').some(t=>t.id==='old'),false);
});


test('petit gateau routes reserve parties between steps and count finished stock only once', () => {
 for (const recipeId of ['gateau-mango','gateau-choco','gateau-framboos','gateau-yoghurt-framboos','gateau-lemon','gateau-hazelnoot']) {
  const expected=['gateau-lemon','gateau-hazelnoot'].includes(recipeId)?['Opspuiten','Afwerken']:[recipeId==='gateau-yoghurt-framboos'?'Opspuiten & aanzetten':'Opspuiten','Doorhalen en afwerken','Afwerken'];
  const catalog=[recipe(recipeId,1)]; let state=stateFor(catalog);
  assert.deepEqual(JSON.parse(JSON.stringify(planning.productionRoute(state.items[0]).steps)),expected);
  let previous;
  expected.forEach((operation,index)=>{
   const id='gateau:'+index;
   state=recipes.buildRecipePlan(state,catalog,command(id,recipeId,300,operation,previous?[{taskId:previous,quantity:300}]:[]));
   assert.equal(task(state,id).recordsOutput,index===expected.length-1);
   if(previous)assert.throws(()=>finish(state,id),/Wacht op/);
   // The preceding step is finished before starting the next production.
   if(previous)state=finish(state,previous);
   previous=id;
  });
  state=finish(state,previous);
  assert.equal(state.tasks.filter(t=>t.recordsOutput&&t.status==='done').reduce((n,t)=>n+t.completedQuantity,0),300);
  assert(planning.validProductionStages(state));
 }
});


test('Steventje stages keep monthly sheets available for weekly filling and finishing', () => {
  const id = 'recipe-new-1783508863145';
  const steps = ['Storten', 'Vullen', 'Rollen & afmaken'];
  const catalog = [{ ...recipe(id, 630), productionSteps: steps }];
  let state = recipes.buildRecipePlan(stateFor(catalog), catalog, command('sheets', id, 630, 'Storten'));
  assert(planning.validProductionSteps(steps));
  assert.equal(task(state, 'sheets').recordsOutput, false);
  state = finish(state, 'sheets');
  state = recipes.buildRecipePlan(state, catalog, command('fill', id, 126, 'Vullen', [{ taskId: 'sheets', quantity: 126 }], '2026-11-18'));
  assert.equal(task(state, 'fill').recordsOutput, false);
  state = finish(state, 'fill');
  state = recipes.buildRecipePlan(state, catalog, command('roll', id, 126, 'Rollen & afmaken', [{ taskId: 'fill', quantity: 126 }], '2026-11-19'));
  assert.equal(task(state, 'roll').recordsOutput, true);
  state = finish(state, 'roll');
  assert.equal(planning.remainingParty(state, task(state, 'sheets')), 504);
  assert.equal(state.tasks.filter(row => row.recordsOutput && row.status === 'done').reduce((sum, row) => sum + row.completedQuantity, 0), 126);
  assert(planning.validProductionStages(state));
});


test('bakery sheet operations carry partly finished cream pastries forward without counting them twice', () => {
  const id = 'recipe-new-1782996258758';
  const catalog = [{ ...recipe(id, 100), productionSteps: ['Inslaan', 'Doorhalen', 'Afwerken'] }];
  let state = recipes.buildRecipePlan(stateFor(catalog), catalog, command('cream', id, 100, 'Inslaan'));
  state = finish(state, 'cream');
  state = recipes.buildRecipePlan(state, catalog, command('coat', id, 60, 'Doorhalen', [{ taskId: 'cream', quantity: 60 }]));
  state = finish(state, 'coat');
  state = recipes.buildRecipePlan(state, catalog, command('decorate', id, 40, 'Afwerken', [{ taskId: 'coat', quantity: 40 }]));
  state = finish(state, 'decorate');
  assert.equal(planning.remainingParty(state, task(state, 'cream')), 40);
  assert.equal(planning.remainingParty(state, task(state, 'coat')), 20);
  assert.equal(state.tasks.filter(row => row.recordsOutput).reduce((sum, row) => sum + row.completedQuantity, 0), 40);
  assert(planning.validProductionStages(state));
});

test('a changed bakery recipe reaches the planner while existing party steps stay intact', () => {
  const id = 'cake';
  const original = [{ ...recipe(id, 100), productionSteps: ['Opspuiten', 'Afwerken'] }];
  let state = recipes.buildRecipePlan(stateFor(original), original, command('original', id, 100, 'Opspuiten'));
  state = finish(state, 'original');
  const savedTasks = JSON.stringify(state.tasks);
  const changed = [{ ...recipe(id, 100), productionSteps: ['Inslaan', 'Doorhalen', 'Afwerken'] }];
  state = workspace.syncRecipeCatalog(state, { recipes: [], manualProductionPlanningItems: [] }, changed);
  assert.equal(JSON.stringify(state.tasks), savedTasks);
  assert.equal(planning.productionRoute(state.items[0]).steps.join('|'), 'Inslaan|Doorhalen|Afwerken');
  assert.equal(planning.productionRoute(state.items[0], task(state, 'original')).steps.join('|'), 'Opspuiten|Afwerken');
  state = recipes.buildRecipePlan(state, changed, command('finish-original', id, 40, 'Afwerken', [{ taskId: 'original', quantity: 40 }]));
  state = finish(state, 'finish-original');
  assert.equal(task(state, 'finish-original').productionStage.steps.join('|'), 'Opspuiten|Afwerken');
  assert(planning.validProductionStages(state));
});


test('planned time and crew survive saving, refreshing and follow-up production steps', () => {
  const catalog = [{ ...recipe('team-cake', 100), productionSteps: ['Storten', 'Afwerken'] }];
  const first = command('team-make', 'team-cake', 100, 'Storten');
  first.task.minutes = 30; first.task.plannedCrewSize = 3;
  let state = recipes.buildRecipePlan(stateFor(catalog), catalog, first);
  assert.equal(task(state, 'team-make').minutes, 30);
  assert.equal(task(state, 'team-make').plannedCrewSize, 3);
  state = JSON.parse(JSON.stringify(state));
  assert(workspace.validWorkspace(state, catalog));
  const update = recipes.currentPlanCommand(state, task(state, 'team-make'));
  update.task.plannedCrewSize = 2;
  state = recipes.refreshRecipePlan(state, catalog, 'team-make', update);
  assert.equal(task(state, 'team-make').plannedCrewSize, 2);
  state = finish(state, 'team-make');
  assert.equal(task(state, 'team-make').recordsOutput, false);
  const next = command('team-finish', 'team-cake', 60, 'Afwerken', [{ taskId: 'team-make', quantity: 60 }]);
  next.task.minutes = 20; next.task.plannedCrewSize = 4;
  state = recipes.buildRecipePlan(state, catalog, next);
  assert.equal(task(state, 'team-finish').plannedCrewSize, 4);
  assert.equal(task(state, 'team-finish').minutes, 20);
  assert.equal(task(state, 'team-finish').status, 'planned');
  assert(workspace.validWorkspace(state, catalog));
  for (const crew of [0, -1, 1.5, 21, NaN]) {
    const invalid = structuredClone(state);
    task(invalid, 'team-finish').plannedCrewSize = crew;
    assert.equal(workspace.validWorkspace(invalid, catalog), false);
    const invalidPlan = command('invalid', 'team-cake', 100, 'Storten');
    invalidPlan.task.plannedCrewSize = crew;
    assert.throws(() => recipes.buildRecipePlan(stateFor(catalog), catalog, invalidPlan), /personen/);
  }
  const legacy = recipes.buildRecipePlan(stateFor(catalog), catalog, command('legacy-team', 'team-cake', 100, 'Storten'));
  assert(workspace.validWorkspace(legacy, catalog));
  assert.equal(task(legacy, 'legacy-team').plannedCrewSize, undefined);
});
