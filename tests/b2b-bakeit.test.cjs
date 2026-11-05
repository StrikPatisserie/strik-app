const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), ts = require('typescript');
function loader(overrides = {}) {
  const cache = {};
  function load(file) {
    file = path.resolve(file); if (cache[file]) return cache[file];
    const exports = cache[file] = {};
    vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
      { exports, Date, Intl, URL, Response, Map, Set, require(name) {
        if (name in overrides) return overrides[name];
        if (name === 'server-only') return {};
        if (name.startsWith('.')) return load(path.resolve(path.dirname(file), name + '.ts'));
        return require(name);
      } }); return exports;
  } return load;
}
const load = loader(), model = load('app/sinterklaas/b2b/bakeItRegistrations.ts');
const group = (allocations = [{ orderId: 'a', quantity: 100 }]) => ({ key: 'brok', product: 'Speculaasbrok · zonder amandel', quantity: allocations.reduce((sum, item) => sum + item.quantity, 0), unit: 'stuks', allocations: allocations.map(item => ({ customer: 'Klant', date: '2026-12-01', end: '', ...item })) });
const totals = g => ({ products: [g], issues: [], orderCount: g.allocations.length, skippedLetters: 0 });
let counter = 0;
function command(g, quantity, extra = {}) { return { operationId: `00000000-0000-4000-8000-${String(++counter).padStart(12, '0')}`, productKey: g.key, quantity, date: '2026-11-03', demandVersion: model.bakeItDemandVersion(g), ...extra }; }
function save(state, g, quantity, extra) { return model.applyBakeItCommand(state, command(g, quantity, extra), totals(g), 'Feline', '2026-11-05T13:00:00Z'); }

test('100 in Bake-it then 30 extra: increase the same entry or register another production date', () => {
  const initial = group(), next = group([{ orderId: 'a', quantity: 100 }, { orderId: 'b', quantity: 30 }]);
  const state = save(model.emptyBakeItState(), initial, 100), before = JSON.stringify(state);
  assert.equal(model.bakeItProgress(next, state).remaining, 30);
  const increased = save(state, next, 130, { registrationId: state.registrations[0].id });
  assert.equal(increased.registrations.length, 1); assert.equal(model.bakeItProgress(next, increased).remaining, 0);
  const extra = save(state, next, 30, { date: '2026-11-09' });
  assert.equal(extra.registrations.length, 2); assert.equal(extra.registrations[1].date, '2026-11-09'); assert.equal(model.bakeItProgress(next, extra).planned, 130);
  assert.equal(JSON.stringify(state), before); assert.equal(extra.history.length, 2); assert.equal(extra.history[0].by, 'Feline');
});
test('completed or cancelled orders do not turn old planned quantities into credit for new customers', () => {
  const initial = group(), state = save(model.emptyBakeItState(), initial, 100);
  const later = group([{ orderId: 'new', quantity: 30 }]);
  assert.equal(model.bakeItProgress(later, state).planned, 0); assert.equal(model.bakeItProgress(later, state).remaining, 30);
  const extra = save(state, later, 30); assert.equal(model.bakeItProgress(later, extra).remaining, 0);
  assert.equal(extra.registrations[0].allocations[0].orderId, 'a');
  assert.equal(model.bakeItProgress(initial, state).remaining, 0, 'reopened original orders retain their own allocation');
});
test('quantity growth on the same order is visible; reductions and variant changes are never silently reassigned', () => {
  const state = save(model.emptyBakeItState(), group(), 100);
  assert.equal(model.bakeItProgress(group([{ orderId: 'a', quantity: 130 }]), state).remaining, 30);
  const reduced = group([{ orderId: 'a', quantity: 70 }, { orderId: 'b', quantity: 30 }]);
  assert.equal(model.bakeItProgress(reduced, state).remaining, 30);
  assert.equal(model.bakeItProgress({ ...reduced, key: 'almond' }, state).remaining, 100);
  assert.equal(model.bakeItProgress(reduced, save(state, reduced, 30)).remaining, 0);
});
test('dates, quantities, stale demand, overplanning and duplicate retries are validated', () => {
  const g = group(), empty = model.emptyBakeItState();
  for (const bad of [0, -2, 1.5, NaN, Infinity, 1000001]) assert.throws(() => save(empty, g, bad), /heel aantal/);
  for (const date of ['2026-02-30', '', '2026-13-01']) assert.throws(() => save(empty, g, 50, { date }), /geldige productiedatum/);
  assert.throws(() => save(empty, g, 101), /meer dan/);
  assert.throws(() => save(empty, g, 50, { demandVersion: 'stale' }), /bestellingen zijn intussen/);
  const c = command(g, 100), first = model.applyBakeItCommand(empty, c, totals(g), 'Feline', 'now');
  assert.equal(model.applyBakeItCommand(first, c, totals(g), 'Other', 'later'), first);
});
test('editing and removing keep history and immediately restore the correct outstanding amount', () => {
  const g = group(), initial = save(model.emptyBakeItState(), g, 100), id = initial.registrations[0].id;
  const reduced = save(initial, g, 60, { registrationId: id, date: '2026-11-04' });
  assert.equal(model.bakeItProgress(g, reduced).remaining, 40); assert.equal(reduced.registrations[0].createdBy, 'Feline');
  const removed = save(reduced, g, 0, { registrationId: id, remove: true });
  assert.equal(model.bakeItProgress(g, removed).remaining, 100); assert.equal(removed.history.length, 3);
  assert.equal(removed.registrations[0].removed, true); assert.throws(() => save(removed, g, 20, { registrationId: id }), /verwijderd/);
});
test('invalid stored documents fail closed instead of displaying a fabricated empty planning', () => {
  assert.equal(model.readBakeItState(null).revision, 0);
  for (const input of [{}, { version: 1, revision: 1, registrations: [{}], history: [] }]) assert.throws(() => model.readBakeItState(input), /veilig worden gelezen/);
});

function apiHarness(profile = { id: 'u', active: true, role: 'manager', full_name: 'Feline' }) {
  let state = model.emptyBakeItState(), reads = 0, writes = 0, sourceReads = 0;
  const g = group();
  const route = loader({
    '../../lib/auth/session': { getCurrentProfile: async () => profile },
    '../../lib/auth/access': { canAccessLogistiek: p => p && ['manager', 'logistiek'].includes(p.role) },
    '../../sinterklaas/sinterklaasServerApi': { loadProductionB2BOrders: async () => { sourceReads++; return []; } },
    '../../sinterklaas/b2b/productionTotals': { buildProductionTotals: () => totals(g) },
    '../../sinterklaas/b2b/bakeItStore.server': {
      readBakeItDocument: async () => { reads++; return state; },
      saveBakeItDocument: async (_season, _year, _previous, next) => { writes++; state = next; },
    },
  })('app/api/b2b-bakeit/route.ts');
  const url = 'https://app.strik-patisserie.nl/api/b2b-bakeit?season=sint&year=2026';
  const post = (input, origin = 'https://app.strik-patisserie.nl') => route.POST(new Request(url, { method: 'POST', headers: { origin }, body: JSON.stringify(input) }));
  return { route, url, post, g, counts: () => ({ reads, writes, sourceReads }) };
}
test('API gates manager/logistics access and request origin before any source or storage access', async () => {
  for (const profile of [null, { id: 'x', active: true, role: 'winkel' }, { id: 'x', active: false, role: 'manager' }]) {
    const h = apiHarness(profile);
    assert.equal((await h.route.GET(new Request(h.url))).status, 403); assert.equal((await h.post({})).status, 403);
    assert.deepEqual(h.counts(), { reads: 0, writes: 0, sourceReads: 0 });
  }
  const h = apiHarness(); assert.equal((await h.post({}, 'https://other.invalid')).status, 403); assert.equal(h.counts().reads, 0);
});
test('API is revision-safe and acknowledges a lost-response retry only once, including after a later save', async () => {
  const h = apiHarness(), c = command(h.g, 60);
  assert.equal((await h.post({ revision: 0, command: c })).status, 200);
  assert.equal((await h.post({ revision: 0, command: command(h.g, 40) })).status, 409);
  assert.equal((await h.post({ revision: 1, command: command(h.g, 40) })).status, 200);
  assert.equal((await h.post({ revision: 0, command: c })).status, 200);
  assert.equal(h.counts().writes, 2); assert.equal(h.counts().sourceReads, 2);
  assert.equal((await (await h.route.GET(new Request(h.url))).json()).state.revision, 2);
});
test('shared store uses conditional insert and compare-and-swap, never an unconditional upsert', async () => {
  let document = null;
  const db = { from() {
    let action = 'read', row, filters = [];
    const query = {
      select() { return query; }, eq(k, v) { filters.push([k, v]); return query; },
      insert(value) { action = 'insert'; row = value; return query; }, update(value) { action = 'update'; row = value; return query; },
      async maybeSingle() {
        if (action === 'read') return { data: document, error: null };
        if (action === 'insert' && document) return { data: null, error: { code: '23505' } };
        if (action === 'update' && filters.find(([k]) => k === 'value->>revision')?.[1] !== String(document?.value.revision)) return { data: null, error: null };
        document = { ...document, ...row }; return { data: { key: document.key }, error: null };
      },
    }; return query;
  } };
  const store = loader({ '../../lib/supabase/admin': { createAdminClient: () => db } })('app/sinterklaas/b2b/bakeItStore.server.ts');
  const empty = model.emptyBakeItState(), first = save(empty, group(), 60);
  await store.saveBakeItDocument('sint', '2026', empty, first, 'u');
  await assert.rejects(store.saveBakeItDocument('sint', '2026', empty, first, 'v'), /intussen gewijzigd/);
  const next = save(first, group(), 40);
  await store.saveBakeItDocument('sint', '2026', first, next, 'u');
  await assert.rejects(store.saveBakeItDocument('sint', '2026', first, next, 'v'), /intussen gewijzigd/);
  assert.equal((await store.readBakeItDocument('sint', '2026')).revision, 2);
});
