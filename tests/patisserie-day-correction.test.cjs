const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const crypto = require('node:crypto');

function load(file, imports = {}, globals = {}) {
  const exports = {};
  const source = fs.readFileSync(file, 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
  vm.runInNewContext(js.outputText, { exports, URL, Date, Buffer, setTimeout, ...globals,
    require(name) { assert.ok(name in imports, name); return imports[name]; } });
  return exports;
}
const rev = load('app/management/revenueData.ts');
const fixture = { shop: 'Lent', date: '2025-03-10', checkedAt: '2025-03-15T11:00:00.000Z' };
function setup(legacy) {
  // Use a synthetic grant while exercising the production eligibility and storage paths.
  const fingerprint = fs.readFileSync('app/management/patisserieDayCorrection.ts', 'utf8').match(/approvedRevision = "([a-f0-9]{64})"/)[1];
  const correction = load('app/management/patisserieDayCorrection.ts', { 'node:crypto': {
    createHash(algorithm) { return { update(key) {
      return key === ['patisserie', fixture.shop, fixture.date, fixture.checkedAt].join('|')
        ? { digest: () => fingerprint } : crypto.createHash(algorithm).update(key);
    } }; },
  } });
  const record = rev.normalizeRevenueCashRecord({ ...fixture, countedCash: 2, startCash: 10, safeCash: 8,
    cashRevenue: 11, expectedCash: 19, note: 'orig', iceSafeCash: 7, cashImportKind: 'patisserie' });
  const day = rev.normalizeRevenueDayRecord({ ...fixture, amount: 600 });
  const deposit = rev.normalizeRevenueCashDeposit({ ...record, id: 'sample-deposit', amount: 40, patisserieReportedAt: fixture.checkedAt });
  const neighbour = rev.normalizeRevenueCashRecord({ ...record, date: '2025-03-11', id: 'other' });
  let raw = JSON.parse(JSON.stringify(rev.embedRevenueCashDataInNotes({
    records: [], cashRecords: [record, neighbour], cashDeposits: [deposit], dailyRecords: [day],
  })));
  if (legacy) { delete raw.cashRecords; delete raw.cashDeposits; }
  const original = structuredClone(raw);
  let writes = 0;
  const server = load('app/management/revenueServer.ts', { 'server-only': {}, './revenueSeed': { excelRevenueSeed: [] },
    './revenueData': rev, './patisserieDayCorrection': correction }, { process: {env:{}}, fetch: async (_url, options) => {
      if (options.method === 'PUT') { raw = JSON.parse(options.body); writes++; }
      const body = structuredClone(raw);
      return { ok: true, status: 200, json: async () => body };
    } });
  return { server, record, original, raw: () => raw, writes: () => writes };
}

for (const legacy of [true, false]) test('one correction, frozen deposits, retries and stale screens; legacy=' + legacy, async () => {
  const h = setup(legacy);
  const draft = { ...fixture, till: '23,10', start: '12', counted: '22,50', note: 'Natelling' };
  assert.equal((await h.server.getMergedRevenueData()).openDayCorrectionId, h.record.id);
  for (const override of [{shop:'Heyendaal'}, {date:'2025-03-11'}, {counted:'veel'}, {counted:'1'}, {checkedAt:'wrong'}]) {
    assert.equal((await h.server.savePatisserieDayCorrection({...draft, ...override})).ok, false);
  }
  assert.equal(h.writes(), 0);
  const result = await h.server.savePatisserieDayCorrection(draft);
  assert.equal(result.ok, true, result.message);
  const r = result.record;
  assert.equal(r.cashRevenue,11); assert.equal(r.safeCash,10.5); assert.equal(r.expectedCash,21);
  assert.equal(r.safeDifference,1.5); assert.equal(r.difference,2.1); assert.equal(r.iceSafeCash,7);
  assert.match(r.note, /orig.*Natelling/);
  assert.deepEqual(h.raw().records,h.original.records);
  assert.deepEqual(h.raw().cashDeposits,h.original.cashDeposits);
  assert.deepEqual(h.raw().dailyRecords.find(d=>d.date!==fixture.date),h.original.dailyRecords.find(d=>d.date!==fixture.date));
  assert.equal((await h.server.savePatisserieDayCorrection(draft)).ok,false);
  assert.equal(h.writes(),1);
  const stale = rev.normalizeRevenueData(h.original);
  const staleDay = stale.cashRecords.find(c => c.id === r.id);
  staleDay.cashRevenue = 99;
  staleDay.cashOut = 7;
  await h.server.saveRevenueData(stale);
  const fresh = await h.server.getMergedRevenueData();
  assert.equal(fresh.openDayCorrectionId,undefined);
  const finalDay = fresh.cashRecords.find(c => c.id === r.id);
  assert.equal(finalDay.safeCash, 10.5);
  assert.equal(finalDay.cashRevenue, r.cashRevenue);
  assert.equal(finalDay.cashOut, r.cashOut);
});
