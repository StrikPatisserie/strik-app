const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm'), ts = require('typescript');
function load(file, imports = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports, require: name => { assert(name in imports, name); return imports[name]; }, Request, Response, URL, Date });
  return exports;
}
const thickness = load('app/productie/rolloutThicknesses.ts');
const plain = value => JSON.parse(JSON.stringify(value));
test('shared thickness changes add, edit and remove original and new rows without altering the input', () => {
  const original = thickness.initialThicknessDocument(), before = JSON.stringify(original);
  const added = thickness.changeThickness(original, { action: 'save', id: 'new', product: ' Test ', thickness: ' 3,5 ', note: ' Gaatjes ' }, 'Bakker', 'now');
  assert.equal(added.revision, 1);
  assert.equal(added.rows.length, original.rows.length + 1);
  assert.equal(added.rows.find(row => row.id === 'new').note, 'Gaatjes');
  const edited = thickness.changeThickness(added, { action: 'save', id: 'sloffen', product: 'Sloffen nieuw', thickness: '10', note: '' }, 'Feline', 'later');
  assert.deepEqual(plain(edited.rows.find(row => row.id === 'sloffen').aliases), ['slof']);
  const removed = thickness.changeThickness(edited, { action: 'delete', id: 'sloffen' }, 'Feline', 'later');
  assert(!removed.rows.some(row => row.id === 'sloffen'));
  assert.equal(removed.history.at(-1).product, 'Sloffen nieuw');
  assert.equal(JSON.stringify(original), before);
  assert.equal(thickness.changeThickness({ revision: 4, rows: [{ id: 'one', product: 'Een', thickness: '1' }], history: [] }, { action: 'delete', id: 'one' }, 'Bakker', 'now').rows.length, 0);
});
test('thickness validation rejects incomplete or oversized records and unknown deletion', () => {
  for (const input of [null, {}, { action: 'save', id: '../bad' }, { action: 'save', id: 'x', product: '', thickness: '1' }, { action: 'save', id: 'x', product: 'X', thickness: '' }, { action: 'save', id: 'x', product: 'X', thickness: '1', note: 'x'.repeat(501) }, { action: 'delete', id: 'missing' }]) assert.throws(() => thickness.changeThickness(thickness.initialThicknessDocument(), input, 'B', 'now'));
});
class StoreError extends Error { constructor(message, status) { super(message); this.status = status; } }
const profile = { id: 'baker', full_name: 'Bakker', email: 'baker@example.invalid' };
function endpoint(user = profile) {
  let doc = thickness.initialThicknessDocument(); const writes = [];
  const store = { readOperational: async () => doc, saveOperational: async (...args) => { writes.push(args); doc = args[2]; } };
  const route = load('app/api/productie/uitroldiktes/route.ts', {
    '@/app/lib/auth/session': { getCurrentProfile: async () => user },
    '@/app/productie/access': { productionDepartments: user => user?.id === 'baker' ? ['dessert'] : [] },
    '@/app/productie/operationalStore.server': store,
    '@/app/productie/documents.server': { ProductionStoreError: StoreError },
    '@/app/productie/rolloutThicknesses': thickness,
  }); return { route, writes, store };
}
const request = (revision = 0, origin = 'https://app.invalid') => new Request('https://app.invalid/api/productie/uitroldiktes', { method: 'POST', headers: { origin }, body: JSON.stringify({ action: 'save', id: 'new', product: 'Nieuw', thickness: '2', revision, who: 'Spoof' }) });
test('bakery users save shared audited thicknesses; stale and concurrent edits cannot overwrite', async () => {
  const e = endpoint(); assert.equal((await e.route.GET()).status, 200);
  assert.equal((await e.route.POST(request())).status, 200);
  assert.equal(e.writes.length, 1); assert.equal(e.writes[0][0], thickness.ROLLOUT_THICKNESSES_KEY); assert.equal(e.writes[0][3], profile.id);
  assert.equal(e.writes[0][2].history.at(-1).who, 'Bakker');
  assert.equal((await e.route.POST(request())).status, 409); assert.equal(e.writes.length, 1);
  e.store.saveOperational = async () => { throw new StoreError('Concurrent edit', 409); };
  assert.equal((await e.route.POST(request(1))).status, 409);
});
test('anonymous, non-production and cross-origin thickness changes are denied', async () => {
  for (const user of [null, { id: 'shop' }]) { const e = endpoint(user); assert.equal((await e.route.GET()).status, 403); assert.equal((await e.route.POST(request())).status, 403); assert.equal(e.writes.length, 0); }
  const e = endpoint(); assert.equal((await e.route.POST(request(0, 'https://evil.invalid'))).status, 403); assert.equal(e.writes.length, 0);
});
