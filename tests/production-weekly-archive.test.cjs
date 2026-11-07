const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const crypto = require('node:crypto');
const zlib = require('node:zlib');

function load(file, imports = {}, globals = {}) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { exports, require: name => { assert(name in imports, `Missing ${name}`); return imports[name]; }, Date, Intl, Buffer, structuredClone, Request, Response, URL, process: { env: {} }, ...globals });
  return exports;
}
const planning = load('app/productie/planning.ts');
const archive = load('app/productie/weeklyArchive.ts', { './planning': planning });
class StoreError extends Error { constructor(message, status = 503) { super(message); this.status = status; } }
const server = load('app/productie/weeklyArchive.server.ts', {
  'server-only': {}, 'node:crypto': crypto, 'node:zlib': zlib,
  '../lib/weddingServer': { weddingWordPress: () => { throw Error('No real mail in tests'); } },
  './documents.server': { ProductionStoreError: StoreError },
  './operationalStore.server': {}, './planning': planning, './weeklyArchive': archive,
});

function sources() {
  const task = { id: 'cake', itemId: 'cake', departmentId: 'dessert', date: '2026-11-06', operation: 'Afwerken', status: 'done', quantity: 100, completedQuantity: 97, source: 'manual', note: 'Controleer verpakking', batchId: 'batch-cake', recordsOutput: true, requires: ['prep'] };
  return {
    planner: { key: 'planner', revision: 14, updated_at: '2026-11-07T17:00:00Z', updated_by: 'baker-id', data: {
      version: 1,
      items: [{ id: 'cake', name: 'Citroen-meringuetaart', recipeId: 'r-cake', unit: 'stuks', kind: 'product', stock: 0, departmentId: 'dessert', note: '' }],
      tasks: [task, { ...task, id: 'prep', requires: [], date: '2026-10-31', recordsOutput: false }, { ...task, id: 'next', date: '2026-11-08', requires: [], status: 'planned' }, { ...task, id: 'stock', date: '2026-11-07', requires: [], completedQuantity: undefined, stockFulfillmentId: 'stock-1' }],
      productionWork: { overrides: {}, preparation: { 'r-cake': 2 }, history: [{ id: 'change', who: 'Bakker A', at: '2026-11-06T08:00:00Z', kind: 'time', summary: 'Afgerond' }], work: [{ id: 'work', taskId: 'cake', quantity: 97, minutes: 25, crewSize: 2, laborMinutes: 50 }], timers: {}, completions: { cake: { id: 'work', who: 'Bakker A', minutes: 25, quantity: 97, plannedQuantity: 100, crewSize: 2, laborMinutes: 50 } }, stockFulfillments: { stock: { id: 'stock-1', who: 'Bakker B', countedQuantity: 150, quantity: 100, remainingQuantity: 50 } } },
    } },
    recipes: { key: 'recipes', revision: 9, updated_at: '2026-11-06T10:00:00Z', updated_by: 'manager-id', data: { recipes: [{ id: 'r-cake', name: 'Citroen-meringuetaart', ingredients: [{ ingredientId: 'flour', quantity: 500 }], semiFinishedItems: [{ semiFinishedRecipeId: 'r-prep', quantity: 1 }] }, { id: 'r-prep', name: 'Meringue', ingredients: [] }], ingredients: [{ id: 'flour', name: 'Bloem' }], packagingItems: [{ id: 'box', name: 'Doos' }], invoiceImports: [{ invoiceNumber: 'unrelated-invoice' }], hefeOrderHistory: [{ subject: 'unrelated-order' }] } },
  };
}

function fixture(start = '2026-11-08T06:00:00Z') {
  let index = null;
  let now = new Date(start);
  const records = new Map(), receipts = new Map(), sent = [], writes = [];
  const current = sources();
  const controls = { mailFails: false, loseMailAcknowledgement: false, loseIndexUpdateAfterSend: false, indexFailsAfterArchive: false };
  const deps = {
    readIndex: async () => structuredClone(index),
    saveIndex: async (revision, next) => {
      await Promise.resolve();
      if (revision !== (index?.revision || 0)) throw new StoreError('Concurrent change', 409);
      if (controls.indexFailsAfterArchive && records.size) { controls.indexFailsAfterArchive = false; throw new StoreError('Index unavailable'); }
      if (controls.loseIndexUpdateAfterSend && sent.length) { controls.loseIndexUpdateAfterSend = false; throw new StoreError('Index unavailable'); }
      index = structuredClone(next); writes.push({ kind: 'index', revision });
    },
    readArchive: async week => structuredClone(records.get(week) || null),
    insertArchive: async (week, record) => {
      await Promise.resolve();
      if (records.has(week)) throw new StoreError('Already archived', 409);
      records.set(week, structuredClone(record)); writes.push({ kind: 'archive', week });
    },
    readSources: async () => structuredClone(current),
    sendMail: async mail => {
      if (controls.mailFails) throw Error('Mail unavailable');
      if (receipts.has(mail.id)) { assert.equal(receipts.get(mail.id), mail.html); return; }
      assert.equal(mail.email, 'feline@strik-patisserie.nl');
      assert.equal(mail.template, 'CUSTOMER_CONFIRMATION');
      receipts.set(mail.id, mail.html); sent.push(structuredClone(mail));
      if (controls.loseMailAcknowledgement) { controls.loseMailAcknowledgement = false; throw Error('Connection lost after delivery'); }
    },
    now: () => new Date(now), makeId: crypto.randomUUID,
  };
  return { service: server.createWeeklyArchiveService(deps), deps, controls, records, receipts, sent, writes, current, index: () => index, setNow: at => { now = new Date(at); } };
}

test('Amsterdam Sunday closure handles summer/winter time and never archives Saturday or future weeks early', () => {
  for (const [before, after, week] of [
    ['2026-11-08T05:59:59Z', '2026-11-08T06:00:00Z', '2026-11-02'],
    ['2027-07-04T04:59:59Z', '2027-07-04T05:00:00Z', '2027-06-28'],
  ]) {
    assert.equal(archive.lastDueArchiveWeek(new Date(before)), planning.addDays(week, -7));
    assert.equal(archive.lastDueArchiveWeek(new Date(after)), week);
  }
  assert.equal(archive.lastDueArchiveWeek(new Date('2026-11-07T22:59:59Z')), '2026-10-26');
  assert.equal(archive.validArchiveWeek('2026-11-02'), true);
  assert.equal(archive.validArchiveWeek('2026-11-03'), false);
  assert.equal(archive.validArchiveWeek('2026-02-30'), false);
});

test('first activation starts with the current week and sends no historical backlog', async () => {
  const f = fixture('2026-11-11T06:00:00Z');
  assert.equal((await f.service.list()).enabledFromWeek, null);
  assert.equal(f.writes.length, 0, 'listing is read only');
  await f.service.run();
  assert.equal(f.index().enabledFromWeek, '2026-11-09');
  assert.equal(f.records.size, 0); assert.equal(f.sent.length, 0);
  f.setNow('2026-11-15T06:00:00Z'); await f.service.run();
  assert.deepEqual([...f.records.keys()], ['2026-11-09']);
  assert.equal(f.sent.length, 1);
});

test('week backup preserves exact planner/work/stock and canonical recipe sources across week boundaries', async () => {
  const f = fixture(); await f.service.run();
  const { record, snapshot } = await f.service.read('2026-11-02');
  assert.equal(snapshot.summary.weekEnd, '2026-11-07');
  assert.equal(snapshot.summary.taskCount, 2); assert.equal(snapshot.summary.doneCount, 2);
  assert.equal(snapshot.summary.outputTaskCount, 1, 'stock does not count as manufactured output');
  assert.equal(JSON.stringify(snapshot.planner), JSON.stringify(f.current.planner));
  assert.equal(snapshot.recipes.revision, 9);
  assert.deepEqual(Array.from(snapshot.recipes.data.recipes, row => row.id), ['r-cake', 'r-prep']);
  assert.equal(snapshot.recipes.data.ingredients[0].id, 'flour');
  assert.equal(snapshot.recipes.data.packagingItems[0].id, 'box');
  assert.equal(snapshot.recipes.data.invoiceImports.length, 0);
  assert.equal(snapshot.recipes.data.hefeOrderHistory, undefined);
  assert.equal(record.encoding, 'gzip-base64'); assert.match(record.sha256, /^[a-f0-9]{64}$/);
  const list = await f.service.list(); assert.equal(list.weeks[0].mailStatus, 'sent'); assert(!('claimId' in list.weeks[0]));
});

test('recap and CSV show real completed quantities and crew while preventing HTML/Excel injection', async () => {
  const f = fixture();
  f.current.planner.data.items[0].name = '<script>bad</script>';
  f.current.planner.data.tasks[0].note = '=HYPERLINK("bad")';
  await f.service.run();
  const { snapshot } = await f.service.read('2026-11-02');
  const html = archive.weeklyArchiveHtml(snapshot, 'https://app.invalid');
  assert(!html.includes('<script>')); assert(html.includes('&lt;script&gt;'));
  assert.match(html, /2 van 2 taken klaar/);
  assert.match(html, /weekarchief\/2026-11-02\?format=json/);
  const csv = archive.weeklyArchiveCsv(snapshot);
  assert.match(csv, /"97";"25";"2";"50";"Bakker A"/);
  assert.match(csv, /"'=HYPERLINK\(""bad""\)"/);
  assert.match(csv, /"Uit voorraad";"";"";"";"";"Bakker B"/);
});

test('duplicate and overlapping cron runs preserve the first immutable archive and send only once', async () => {
  const f = fixture(); await Promise.all([f.service.run(), f.service.run()]);
  const original = JSON.stringify(f.records.get('2026-11-02'));
  f.current.planner.revision++;
  f.current.planner.data.tasks[0].quantity = 999;
  await f.service.run();
  assert.equal(JSON.stringify(f.records.get('2026-11-02')), original);
  assert.equal(f.writes.filter(row => row.kind === 'archive').length, 1);
  assert.equal(f.sent.length, 1); assert.equal(f.index().weeks[0].mailStatus, 'sent');
});

test('mail outage never loses a week backup and later retry reuses the frozen message', async () => {
  const f = fixture(); f.controls.mailFails = true;
  const result = await f.service.run();
  assert.equal(result.archived, 1); assert.equal(result.sent, 0); assert.equal(result.pending, 1);
  assert.equal(f.index().weeks[0].mailStatus, 'checking');
  const originalMail = JSON.stringify(f.records.get('2026-11-02').mail);
  assert.equal((await f.service.read('2026-11-02')).snapshot.planner.revision, 14);
  f.controls.mailFails = false; f.setNow('2026-11-09T06:00:00Z'); await f.service.run();
  assert.equal(f.sent.length, 1); assert.equal(JSON.stringify(f.sent[0]), originalMail);
  assert.equal(f.index().weeks[0].mailStatus, 'sent');
});

test('lost transport receipt or local acknowledgement never creates a new physical mail', async () => {
  const f = fixture(); f.controls.loseMailAcknowledgement = true;
  await f.service.run(); assert.equal(f.sent.length, 1); assert.equal(f.index().weeks[0].mailStatus, 'checking');
  await f.service.run(); assert.equal(f.sent.length, 1); assert.equal(f.index().weeks[0].mailStatus, 'sent');
  const g = fixture(); g.controls.loseIndexUpdateAfterSend = true;
  await assert.rejects(g.service.run(), /Index unavailable/);
  assert.equal(g.index().weeks[0].mailStatus, 'sending');
  await g.service.run(); assert.equal(g.sent.length, 1, 'live claim is not stolen');
  g.setNow('2026-11-08T06:11:00Z'); await g.service.run();
  assert.equal(g.sent.length, 1); assert.equal(g.index().weeks[0].mailStatus, 'sent');
});

test('two uncertain old messages cannot starve a new Sunday recap and old retries rotate fairly', async () => {
  const f = fixture(); f.controls.mailFails = true;
  await f.service.run();
  f.setNow('2026-11-15T06:00:00Z'); await f.service.run();
  assert.equal(f.index().weeks.filter(row => row.mailStatus === 'checking').length, 2);
  const stuck = new Set([...f.records.values()].map(row => row.mail.id));
  const send = f.deps.sendMail;
  f.controls.mailFails = false;
  f.deps.sendMail = async mail => { if (stuck.has(mail.id)) throw Error('Uncertain old receipt'); return send(mail); };
  f.setNow('2026-11-22T06:00:00Z'); await f.service.run();
  assert.equal(f.sent.length, 1);
  assert.equal(f.index().weeks.find(row => row.weekStart === '2026-11-16').mailStatus, 'sent');
  assert.equal(f.index().weeks.filter(row => row.mailStatus === 'checking').length, 2);
  const attempts = f.index().weeks.filter(row => row.mailStatus === 'checking').map(row => row.attempts);
  f.setNow('2026-11-23T06:00:00Z'); await f.service.run();
  assert(f.index().weeks.filter(row => row.mailStatus === 'checking').every((row, i) => row.attempts > attempts[i]));
});

test('an archive insert recovered after index failure keeps the original snapshot and mail ID', async () => {
  const f = fixture(); f.controls.indexFailsAfterArchive = true;
  await assert.rejects(f.service.run(), /Index unavailable/);
  const original = JSON.stringify(f.records.get('2026-11-02'));
  f.current.planner.revision++;
  await f.service.run();
  assert.equal(JSON.stringify(f.records.get('2026-11-02')), original);
  assert.equal(f.sent.length, 1); assert.equal(f.index().weeks.length, 1);
});

test('tampered compressed backups are rejected and never mailed', async () => {
  const f = fixture(); f.controls.indexFailsAfterArchive = true;
  await assert.rejects(f.service.run());
  const record = f.records.get('2026-11-02');
  const raw = JSON.parse(zlib.gunzipSync(Buffer.from(record.payload, 'base64')).toString());
  raw.planner.revision = 999;
  record.payload = zlib.gzipSync(Buffer.from(JSON.stringify(raw))).toString('base64');
  await assert.rejects(f.service.run(), /archiefcontrole/);
  assert.equal(f.sent.length, 0);
  await assert.rejects(f.service.read('2026-11-03'), error => error.status === 400);
  await assert.rejects(f.service.read('2026-10-26'), error => error.status === 404);
});

function route(file, profile, service, environment = 'production', cronAllowed = true) {
  const rights = load('app/lib/auth/access.ts');
  return load(file, {
    '@/app/lib/auth/access': rights,
    '@/app/lib/auth/session': { getCurrentProfile: async () => profile },
    '@/app/lib/auth/cron': { hasCronAuthorization: () => cronAllowed },
    '@/app/productie/documents.server': { ProductionStoreError: StoreError },
    '@/app/productie/weeklyArchive.server': { weeklyArchiveService: () => service },
    '@/app/productie/weeklyArchive': archive,
  }, { process: { env: { VERCEL_ENV: environment } } });
}
const manager = { id: 'manager', active: true, role: 'management' };

test('index and export use management guards and private responses, including compressed complete JSON', async () => {
  const f = fixture(); await f.service.run();
  const listPath = 'app/api/productie/weekarchief/route.ts';
  const exportPath = 'app/api/productie/weekarchief/[weekStart]/route.ts';
  const params = { params: Promise.resolve({ weekStart: '2026-11-02' }) };
  for (const denied of [null, { ...manager, active: false }, { active: true, role: 'bakkerij', permissions: { 'productie.manage': true } }, { active: true, role: 'logistiek' }]) {
    const forbidden = { list: () => { throw Error('must not read'); }, read: () => { throw Error('must not read'); } };
    assert.equal((await route(listPath, denied, forbidden).GET()).status, 403);
    assert.equal((await route(exportPath, denied, forbidden).GET(new Request('https://app.invalid/a'), params)).status, 403);
  }
  const response = await route(listPath, manager, f.service).GET();
  assert.equal(response.status, 200); assert.match(response.headers.get('Cache-Control'), /private, no-store/);
  const download = await route(exportPath, manager, f.service).GET(new Request('https://app.invalid/a?format=json'), params);
  assert.match(download.headers.get('Content-Disposition'), /strak-gepland-2026-11-02.json/);
  assert.equal(download.headers.get('Content-Encoding'), 'gzip');
  const snapshot = JSON.parse(zlib.gunzipSync(Buffer.from(await download.arrayBuffer())).toString());
  assert.equal(JSON.stringify(snapshot.planner), JSON.stringify(f.current.planner));
  assert.equal((await route(exportPath, manager, f.service).GET(new Request('https://app.invalid/a?format=bad'), params)).status, 400);
});

test('cron requires its secret and production environment and never permits an ordinary manager session', async () => {
  let calls = 0;
  const service = { run: async () => { calls++; return { archived: 0 }; } };
  const file = 'app/api/productie/weekarchief/cron/route.ts';
  const request = new Request('https://app.invalid/api/productie/weekarchief/cron');
  assert.equal((await route(file, manager, service, 'production', false).GET(request)).status, 403);
  assert.equal((await route(file, manager, service, 'preview', true).GET(request)).status, 409);
  assert.equal(calls, 0);
  assert.equal((await route(file, null, service, 'production', true).GET(request)).status, 200); assert.equal(calls, 1);
  const cron = JSON.parse(fs.readFileSync('vercel.json', 'utf8')).crons.find(row => row.path === '/api/productie/weekarchief/cron');
  assert.equal(cron.schedule, '0 5,6 * * *');
});

test('session middleware passes only the exact archive cron GET with its valid bearer secret', async () => {
  const cron = load('app/lib/auth/cron.ts', { 'node:crypto': crypto }, { process: { env: { CRON_SECRET: 'test-only-cron-secret' } } });
  const cookies = { getAll: () => [], set: () => {} };
  const middleware = load('app/lib/supabase/middleware.ts', {
    '@supabase/ssr': { createServerClient: () => ({ auth: { getClaims: async () => ({ data: { claims: null } }) } }) },
    'next/server': { NextResponse: {
      next: () => ({ kind: 'next', headers: new Headers(), cookies }),
      json: (...args) => Object.assign(Response.json(...args), { cookies }),
    } },
    './config': { getSupabasePublicConfig: () => ({ isConfigured: true, url: 'https://example.invalid', publishableKey: 'test' }) },
    '../auth/access': load('app/lib/auth/access.ts'), '../auth/mfa': {}, '../auth/cron': cron,
  }, { Headers, process: { env: { NODE_ENV: 'production' } } });
  async function check(path, authorization, method = 'GET') {
    const nextUrl = new URL(path, 'https://app.invalid');
    const request = { method, url: nextUrl.href, nextUrl, cookies, headers: new Headers(authorization ? { authorization } : {}) };
    return middleware.updateSession(request);
  }
  assert.equal((await check('/api/productie/weekarchief/cron', 'Bearer test-only-cron-secret')).kind, 'next');
  for (const value of ['', 'test-only-cron-secret', 'Bearer incorrect']) assert.equal((await check('/api/productie/weekarchief/cron', value)).status, 401);
  for (const path of ['/api/productie/weekarchief', '/api/productie/weekarchief/2026-11-02', '/api/productie/weekarchief/cron/', '/api/productie/weekarchief/cron-more']) assert.equal((await check(path, 'Bearer test-only-cron-secret')).status, 401, path);
  assert.equal((await check('/api/productie/weekarchief/cron', 'Bearer test-only-cron-secret', 'POST')).status, 401);
});

test('real adapter uses existing operational CAS, insert-only archive keys, stable source revisions and the existing mail transport', async () => {
  const values = new Map(), writes = [], mails = [], reads = { planner: 0, recipes: 0 };
  const current = sources();
  class SundayDate extends Date { constructor(...args) { super(...(args.length ? args : ['2026-11-08T06:00:00Z'])); } }
  const adapter = load('app/productie/weeklyArchive.server.ts', {
    'server-only': {}, 'node:crypto': crypto, 'node:zlib': zlib,
    '../lib/weddingServer': { weddingWordPress: async (path, mail) => { assert.equal(path, 'mail'); mails.push(mail); return { sent: true }; } },
    './documents.server': { ProductionStoreError: StoreError, readDocument: async key => {
      reads[key]++;
      return { ...structuredClone(current[key]), revision: key === 'planner' && reads[key] === 1 ? 1 : current[key].revision };
    } },
    './operationalStore.server': {
      readOperational: async (key, empty) => structuredClone(values.get(key) || empty),
      saveOperational: async (key, previous, next, actor) => {
        assert.equal(actor, null);
        if ((values.get(key)?.revision || 0) !== previous) throw new StoreError('Concurrent change', 409);
        values.set(key, structuredClone(next)); writes.push({ key, previous });
      },
    },
    './planning': planning, './weeklyArchive': archive,
  }, { Date: SundayDate });
  await adapter.weeklyArchiveService().run();
  assert.equal(reads.planner, 4); assert.equal(reads.recipes, 4, 'changing source revisions trigger a fresh consistent snapshot');
  const archived = writes.filter(row => row.key.startsWith('production_week_archive_v1:'));
  assert.equal(archived.length, 1); assert.equal(archived[0].previous, 0);
  const frozen = await adapter.weeklyArchiveService().read('2026-11-02');
  assert.equal(frozen.snapshot.planner.revision, 14);
  assert.equal(mails.length, 1); assert.equal(mails[0].email, 'feline@strik-patisserie.nl');
  await adapter.weeklyArchiveService().run();
  assert.equal(writes.filter(row => row.key.startsWith('production_week_archive_v1:')).length, 1);
  assert.equal(mails.length, 1);
});
