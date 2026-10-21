const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, imports = {}, globals = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022}}).outputText,
    {exports, URL, Request, Response, ...globals, require: name => name in imports ? imports[name] : require(name)});
  return exports;
}
const access = load('app/lib/auth/access.ts');
const stores = load('app/sinterklaas/letterStoreAccess.ts', {'../lib/auth/access': access});
const profile = (store = 'heyendaal') => ({active: true, role: 'winkel', email: `strikpatisserie${store}@gmail.com`, store, permissions: {}});
const row = (id, shop, source = 'winkel') => ({id, shop, pickupLocation: shop, source, customerName: `Klant ${id}`, year: '2026', lines: [{letter: 'S', quantity: 1}]});
function server(who, initial = [row('own', 'Heyendaal'), row('foreign', 'Lent'), row('online', 'Heyendaal', 'online')]) {
  let records = structuredClone(initial);
  const calls = [];
  const loaded = load('app/sinterklaas/sinterklaasServerApi.ts', {
    'server-only': {}, 'next/server': {NextResponse: {json: (data, init) => Response.json(data, init)}},
    '../lib/auth/access': access, '../lib/auth/session': {getCurrentProfile: async () => who}, './letterStoreAccess': stores,
  }, {process: {env: {WORDPRESS_SINTERKLAAS_API_BASE: 'https://example.invalid/wp-json/strik/v1', WORDPRESS_SINTERKLAAS_API_KEY: 'test-only'}}, fetch: async (url, options = {}) => {
    const method = options.method || 'GET';
    calls.push({url: new URL(url), method, body: options.body});
    if (method === 'GET') return Response.json({orders: structuredClone(records), total: records.length, generatedAt: 'test'});
    const body = options.body ? JSON.parse(options.body) : {};
    if (method === 'DELETE') { records = records.filter(order => order.id !== (new URL(url).searchParams.get('id') || body.id)); return Response.json({deleted: true}); }
    const found = records.find(order => order.id === body.id);
    const saved = {...found, ...body}; records = [...records.filter(order => order.id !== saved.id), saved];
    return Response.json(saved);
  }});
  const endpoint = 'sinterklaas-letter-orders';
  return {calls,
    get: (query = '') => loaded.proxySinterklaasGet(new Request('https://app.example.invalid/api/sinterklaas-letter-orders' + query), endpoint),
    mutate: (method, data, query = '') => loaded.proxySinterklaasMutation(new Request('https://app.example.invalid/api/sinterklaas-letter-orders' + query, {method, ...(data === undefined ? {} : {body: typeof data === 'string' ? data : JSON.stringify(data)})}), endpoint, method),
  };
}

test('each store iPad is fixed to its own location, including older generic store profiles', () => {
  for (const {id} of stores.LETTER_ORDER_SHOPS) {
    assert.equal(JSON.stringify(stores.getLetterStoreScope({...profile(id), store: 'winkel', permissions: {'stores.lent': true}})), JSON.stringify([id]));
    assert.equal(JSON.stringify(stores.getLetterStoreScope({...profile(id), role: 'admin'})), JSON.stringify([id]));
  }
  assert.equal(stores.getLetterStoreScope({active: true, role: 'admin', email: 'beheer@example.invalid'}), null);
  assert.equal(stores.getLetterStoreScope({...profile(), email: 'staff@example.invalid', store: 'winkel'}).length, 0);
  assert.equal(stores.normalizeLetterShop('Strik Brakkenstein · Heyendaalseweg 217'), 'heyendaal');
  assert.equal(stores.normalizeLetterShop('Strik Nijmegen-Oost · Daalseweg 254'), 'daalseweg');
});

test('store GET responses never include another store or online imports, even with manipulated filters', async () => {
  const api = server(profile());
  const response = await api.get('?year=2026&shop=Lent&id=foreign&source=online');
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.orders.map(order => order.id).join(','), 'own');
  assert.equal(data.total, 1);
  assert.ok(!JSON.stringify(data).includes('Klant foreign'));
});

test('PATCH, DELETE and POST upsert cannot modify orders belonging to another store', async () => {
  for (const method of ['PATCH', 'DELETE', 'POST']) {
    const api = server(profile());
    const response = await api.mutate(method, {id: 'foreign', shop: 'Heyendaal', pickupLocation: 'Heyendaal'}, '?year=2099&search=hidden');
    assert.equal(response.status, 403, method);
    assert.equal(api.calls.filter(call => call.method !== 'GET').length, 0);
    assert.equal(api.calls[0].url.searchParams.has('year'), false);
    assert.equal(api.calls[0].url.searchParams.has('search'), false);
  }
});

test('a store can accept a new order for another store but cannot subsequently read or edit it', async () => {
  const api = server(profile());
  const response = await api.mutate('POST', row('new-lent', 'Lent', 'online'));
  assert.equal(response.status, 200);
  const saved = await response.json();
  assert.equal(saved.id, 'new-lent'); assert.equal(saved.source, 'winkel'); assert.equal(saved.shop, 'Lent');
  assert.ok(!(await (await api.get()).json()).orders.some(order => order.id === 'new-lent'));
  assert.equal((await api.mutate('PATCH', {id: 'new-lent', notes: 'change'})).status, 403);
});

test('moving an own order transfers visibility and further updates require the receiving store', async () => {
  const api = server(profile());
  assert.equal((await api.mutate('PATCH', {id: 'own', shop: 'Lent', pickupLocation: 'Lent'})).status, 200);
  assert.equal((await (await api.get()).json()).orders.length, 0);
  assert.equal((await api.mutate('POST', row('own', 'Heyendaal'))).status, 403);
  const receiving = server(profile('lent'), [row('own', 'Lent')]);
  assert.equal((await receiving.mutate('PATCH', {id: 'own', notes: 'Aanpassing door Lent'})).status, 200);
});

test('management keeps all-store access and invalid/mismatched IDs fail without writing', async () => {
  const admin = server({active: true, role: 'admin', email: 'beheer@example.invalid'});
  assert.equal((await (await admin.get()).json()).orders.length, 3);
  assert.equal((await admin.mutate('PATCH', {id: 'foreign', notes: 'beheer'})).status, 200);
  for (const [data, query] of [[{id: 'own'}, '?id=foreign'], [{id: 'foreign!'}, ''], ['broken-json', '']]) {
    const api = server(profile());
    assert.equal((await api.mutate('PATCH', data, query)).status, 400);
    assert.equal(api.calls.filter(call => call.method !== 'GET').length, 0);
  }
  const unassigned = server({...profile(), email: 'staff@example.invalid', store: 'winkel'});
  assert.equal((await unassigned.mutate('POST', row('new', 'Heyendaal'))).status, 403);
});

test('cross-store warning is present only when the destination will become inaccessible', () => {
  assert.match(stores.crossStoreLetterNotice(['heyendaal'], 'Lent'), /voor Lent.*niet meer inzien of wijzigen/);
  assert.equal(stores.crossStoreLetterNotice(['heyendaal'], 'Heyendaal'), '');
  assert.equal(stores.crossStoreLetterNotice(null, 'Lent'), '');
});

test('duplicate or extra query IDs cannot change the store-checked mutation target', async () => {
  const duplicate = server(profile());
  assert.equal((await duplicate.mutate('DELETE', undefined, '?id=own&id=foreign')).status, 400);
  assert.equal(duplicate.calls.length, 0);
  const api = server(profile());
  assert.equal((await api.mutate('DELETE', undefined, '?id=own&id[]=foreign&shop=Lent')).status, 200);
  const sent = api.calls.find(call => call.method === 'DELETE');
  assert.equal(sent.url.searchParams.get('id'), 'own');
  assert.equal(sent.url.searchParams.has('id[]'), false);
  assert.equal(sent.url.searchParams.has('shop'), false);
});
