const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, imports = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports, Buffer, Response, Request, URL, Set, Map, console, require: name => name in imports ? imports[name] : require(name) });
  return exports;
}
const base = 'app/sinterklaas/letters/online/';
const online = load(base + 'onlineOrders.ts');
const model = load(base + 'logos/model.ts', { '../onlineOrders': online });
const printModel = load('app/sinterklaas/b2b/logos/model.ts');
const packedLayout = load('app/sinterklaas/b2b/logos/packedLayout.ts', { './model': printModel });
const id = '11111111-1111-4111-8111-111111111111';
const second = '22222222-2222-4222-8222-222222222222';
const orderId = '33333333-3333-4333-8333-333333333333';
const actor = '44444444-4444-4444-8444-444444444444';
const jobId = '55555555-5555-4555-8555-555555555555';
function fixture() {
  return { id: orderId, revision: 2, order_number: 'CL26-9999', customer_name: 'Testklant', requested_date: '2026-11-20',
    fulfillment_status: 'NEW', letter_order_items: [{ id, order_id: orderId, product_id: second, quantity: 3, logo: true,
      logo_storage_path: 'example/0.png', letter_products: { letter: 'S', flavour: 'melk', size: 'groot', style: 'spuit' } }], receipts: [] };
}
function receipt(order) {
  return { item_id: id, quantity: 3, order_revision: order.revision, logo_storage_path: 'example/0.png', printed_at: '2026-11-12T10:00:00Z' };
}
test('a logo is printed only for the exact current order revision, quantity and image', () => {
  const order = fixture();
  assert.equal(model.orderLogosPrinted(order, []), false);
  assert.equal(model.orderLogosPrinted(order, [receipt(order)]), true);
  for (const change of [{ quantity: 4 }, { order_revision: 1 }, { logo_storage_path: 'example/1.png' }]) {
    assert.equal(model.orderLogosPrinted(order, [{ ...receipt(order), ...change }]), false);
  }
  order.letter_order_items.push({ ...order.letter_order_items[0], id: second });
  assert.equal(model.orderLogosPrinted(order, [receipt(order)]), false);
  assert.equal(model.orderLogosPrinted({ ...order, letter_order_items: [] }, []), false);
});
test('pending queue excludes printed lines, retains partial orders and supports deliberate reprints', () => {
  const order = fixture(); order.receipts = [receipt(order)];
  order.letter_order_items.push({ ...order.letter_order_items[0], id: second, quantity: 2 });
  assert.equal(model.pendingLogoItems(order).length, 1);
  assert.equal(model.pendingLogoItems(order)[0].id, second);
  assert.equal(model.pendingLogoItems(order, true).length, 2);
  assert.match(model.logoOrderSummary(order), /CL26-9999.*3× S melk groot.*2× S melk groot/);
});
function repository(order = fixture()) {
  return { order, receipts: [], jobs: [], reads: 0,
    from(table) {
      this.reads++;
      const db = this;
      let inserted;
      return {
        select() { return this; }, eq() { return this; }, neq() { return this; }, in() { return this; },
        insert(value) { inserted = value; return this; },
        async single() { db.jobs.push(inserted); return { data: { id: jobId }, error: null }; },
        then(resolve) {
          const orders = db.orders || [db.order];
          const data = table === 'letter_order_items' ? orders.flatMap(order => order.letter_order_items) : table === 'letter_orders' ? orders : [];
          return Promise.resolve({ data, error: null }).then(resolve);
        },
      };
    },
    storage: { from() { return { download: async () => ({ data: new Blob(['test'], { type: 'image/png' }) }) }; } },
  };
}
const accessPath = '@/app/sinterklaas/letters/online/logos/access.server';
const dataPath = '@/app/sinterklaas/letters/online/logos/data.server';
const modelPath = '@/app/sinterklaas/letters/online/logos/model';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function printRoute(db) {
  return load('app/api/lettershop/logos/print/route.ts', {
    [accessPath]: { uuid, logoHeaders: {}, logoAccess: async () => ({ db, profile: { id: actor } }) },
    [dataPath]: { logoOrderSelect: '', loadLogoReceipts: async () => db.receipts },
    [modelPath]: model, '@/app/sinterklaas/letters/online/onlineOrders': online,
    '@/app/sinterklaas/b2b/logos/print.server': { createLogoPrint: async (choices, files, customer, options) => { db.choices = choices; db.files = files; db.printOptions = options; return Buffer.from('%PDF-test'); } },
    '@/app/sinterklaas/b2b/logos/packedLayout': packedLayout,
  });
}
const selection = () => ({ itemIds: [id], orders: [{ id: orderId, revision: 2 }], widthCm: 3, heightCm: 3 });
const request = input => new Request('https://app.test/api/lettershop/logos/print', { method: 'POST', headers: { origin: 'https://app.test' }, body: JSON.stringify(input) });
test('PDF generation uses authoritative quantities, customer and order grouping, and records no print receipt', async () => {
  const db = repository();
  const response = await printRoute(db).POST(request({ ...selection(), quantity: 999, customer: 'forged' }));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('X-Print-Job'), jobId);
  assert.equal(db.choices[0].quantity, 3);
  assert.equal(db.files[0].customer, 'Testklant');
  assert.equal(db.files[0].orderId, orderId);
  assert.equal(db.files[0].printSummary, undefined);
  assert.equal(db.printOptions.packGroups, true);
  assert.equal(db.jobs[0].created_by, actor);
  assert.equal(db.jobs[0].items[0].quantity, 3);
  assert.equal(db.jobs[0].confirmed_at, undefined);
  assert.equal(db.receipts.length, 0);
});
test('multiple customer selections reach one packed document with their own authoritative counts and identifiers', async () => {
  const db = repository();
  const uniqueId = index => `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`;
  db.orders = Array.from({ length: 9 }, (_, index) => {
    const order = fixture();
    order.id = uniqueId(index + 10);
    order.customer_name = `Klant ${index + 1}`;
    order.order_number = `CL26-${index + 1}`;
    order.letter_order_items[0].id = uniqueId(index + 30);
    order.letter_order_items[0].order_id = order.id;
    order.letter_order_items[0].quantity = index + 1;
    return order;
  });
  const response = await printRoute(db).POST(request({ ...selection(),
    itemIds: db.orders.map(order => order.letter_order_items[0].id),
    orders: db.orders.map(order => ({ id: order.id, revision: order.revision })),
  }));
  assert.equal(response.status, 200);
  assert.equal(db.printOptions.packGroups, true);
  assert.equal(db.jobs.length, 1);
  assert.equal(db.jobs[0].items.length, 9);
  for (let index = 0; index < 9; index++) {
    assert.equal(db.choices[index].quantity, index + 1);
    assert.equal(db.files[index].customer, `Klant ${index + 1}`);
    assert.equal(db.files[index].orderId, db.orders[index].id);
  }
});
test('one customer with matching logo files retains one confirmation snapshot per original product line', async () => {
  const db = repository();
  db.order.letter_order_items.push({ ...db.order.letter_order_items[0], id: second, quantity: 7, logo_storage_path: 'example/copy.png' });
  const response = await printRoute(db).POST(request({ ...selection(), itemIds: [id, second] }));
  assert.equal(response.status, 200);
  assert.equal(db.files.length, 2);
  assert.equal(db.files[0].orderId, db.files[1].orderId);
  assert.equal(db.files[0].bytes_base64, db.files[1].bytes_base64);
  assert.equal(db.jobs[0].items.length, 2);
  assert.equal(db.jobs[0].items[0].item_id, id);
  assert.equal(db.jobs[0].items[1].item_id, second);
  assert.equal(db.jobs[0].items[0].quantity + db.jobs[0].items[1].quantity, 10);
  assert.equal(db.receipts.length, 0);
});
test('server refuses stale selections, missing images, invalid sizes and unintended reprints', async () => {
  for (const variant of ['stale', 'missing', 'size', 'printed']) {
    const db = repository(); const input = selection();
    if (variant === 'stale') input.orders[0].revision = 1;
    if (variant === 'missing') db.order.letter_order_items[0].logo_storage_path = null;
    if (variant === 'size') input.widthCm = 30;
    if (variant === 'printed') db.receipts = [receipt(db.order)];
    const response = await printRoute(db).POST(request(input));
    assert.equal(response.status, 400, variant);
    assert.equal(db.jobs.length, 0, variant);
  }
  const db = repository(); db.receipts = [receipt(db.order)];
  assert.equal((await printRoute(db).POST(request({ ...selection(), confirmReprint: true }))).status, 200);
});
test('every endpoint rejects unauthorized requests before inspecting private files or input', async () => {
  for (const name of ['route', 'print/route', 'confirm/route']) {
    const imports = {
      [accessPath]: { uuid, logoHeaders: {}, logoAccess: async () => ({ error: new Response('Forbidden', { status: 403 }) }) },
      [dataPath]: {}, [modelPath]: model, '@/app/sinterklaas/letters/online/onlineOrders': online,
      '@/app/sinterklaas/b2b/logos/print.server': {}, '@/app/sinterklaas/b2b/logos/packedLayout': {},
    };
    const api = load('app/api/lettershop/logos/' + name + '.ts', imports);
    const response = await (api.GET || api.POST)(request({}));
    assert.equal(response.status, 403, name);
  }
});
test('confirmation requires an explicit answer and delegates selected IDs and trusted actor atomically', async () => {
  let calls = 0, parameters;
  const db = { rpc: async (name, values) => { calls++; parameters = values; return { data: 'confirmed', error: null }; } };
  const api = load('app/api/lettershop/logos/confirm/route.ts', {
    [accessPath]: { uuid, logoHeaders: {}, logoAccess: async () => ({ db, profile: { id: actor } }) },
  });
  assert.equal((await api.POST(request({ jobId, itemIds: [id] }))).status, 400);
  assert.equal(calls, 0);
  assert.equal((await api.POST(request({ jobId, itemIds: [id], confirmed: true, actorId: 'forged' }))).status, 200);
  assert.equal(calls, 1);
  assert.equal(parameters.p_actor_id, actor);
  assert.equal(parameters.p_item_ids[0], id);
});
test('access checks enforce the existing management role and same-origin confirmation', async () => {
  let current = { id: actor, active: true }, opened = 0;
  const access = load(base + 'logos/access.server.ts', {
    'server-only': {}, '@supabase/supabase-js': { createClient: () => { opened++; return {}; } },
    '@/app/lib/auth/session': { getCurrentProfile: async () => current }, '@/app/lib/auth/access': { hasFullAccess: value => value?.role === 'manager' },
    '@/app/lib/supabase/config': { requireSupabasePublicConfig: () => ({ url: 'https://example.invalid' }), requireSupabaseServiceRoleKey: () => 'not-a-key' },
  });
  assert.equal((await access.logoAccess(request({}), true)).error.status, 403);
  current.role = 'manager';
  const foreign = new Request('https://app.test/api/test', { headers: { origin: 'https://foreign.test' } });
  assert.equal((await access.logoAccess(foreign, true)).error.status, 403);
  assert.equal(opened, 0);
  assert.equal((await access.logoAccess(request({}), true)).profile.id, actor);
});
