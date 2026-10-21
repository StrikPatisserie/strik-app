const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, imports = {}, expose = '') {
  const exports = {};
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(source + '\n' + expose, { exports, require: name => imports[name] || {}, URL, Request, Response, Intl, Date });
  return exports;
}
const campaignModule = load('app/bakkerij/logistiek/sinterklaasAcquisitionCampaign.ts');
const dashboard = load('app/bakkerij/logistiek/BakkerijLogistiekDashboard.tsx', {}, 'exports.suggest = buildAcquisitionSuggestions; exports.inPeriod = isAcquisitionCampaignDate; exports.print = createBusRoutePrintHtml;');
const stop = (id, label, detail) => ({ id, sourceId: id, label, detail, badges: [] });
const routes = [{ id: 'r1', vehicle: 'Bus A', title: 'Ronde 1', stops: [
  stop('west', 'Bedrijf', '6541 AA Nijmegen'),
  stop('shop:ziekerstraat', 'Ziekerstraat', 'Nijmegen'),
  stop('shop:lent', 'Lent', 'Nijmegen'),
] }];

test('the photo restores exactly 15 packages, using the existing addresses', () => {
  const campaign = campaignModule.emptySinterklaasAcquisitionCampaign();
  assert.equal(campaign.stops.length, 15);
  assert.equal(new Set(campaign.stops.map(s => s.id)).size, 15);
  assert.deepEqual(Array.from(campaign.stops, s => s.company).sort(), [
    'DFDS Logistics Nijmegen B.V.', 'Duynie Group', 'De Variabele Groep', 'KlokGroep', 'Dar N.V.',
    'Batenburg Installatietechniek', 'BCTN Nijmegen', 'HKS Metals Nijmegen', 'Technische Unie Nijmegen',
    'ANAC Nijmegen', 'Pluryn', 'HORNBACH Nijmegen', 'Holland Casino Nijmegen', 'Mercure Hotel Nijmegen Centre', 'ARN B.V.',
  ].sort());
  for (const item of campaign.stops) assert(item.street && item.postalCode && item.city && item.attention);
  assert.equal(campaign.deliveries.length, 0);
});

test('remaining stock stays plannable after the old deadline and suggested stops disappear only after placement', () => {
  const campaign = campaignModule.emptySinterklaasAcquisitionCampaign();
  assert.equal(dashboard.inPeriod('2026-10-20', campaign), false);
  for (const date of ['2026-10-21', '2026-10-28', '2026-11-10']) assert.equal(dashboard.inPeriod(date, campaign), true);
  const routed = structuredClone(routes), placed = new Set();
  while (placed.size < 15) {
    const suggestions = dashboard.suggest(campaign, routed, '2026-10-28');
    assert(suggestions.length > 0, 'All remaining packages should eventually get a route suggestion');
    for (const item of suggestions) {
      assert(!placed.has(item.stop.id));
      assert(routed[0].stops.some(s => s.id === item.afterStopId));
      placed.add(item.stop.id);
      routed[0].stops.push(stop('acquisition:' + item.stop.id, item.stop.company, item.stop.street));
    }
  }
  assert.equal(dashboard.suggest(campaign, routed, '2026-10-28').length, 0);
  campaign.deliveries = [{ stopId: campaign.stops[0].id }];
  assert(!dashboard.suggest(campaign, routes, '2026-10-28').some(item => item.stop.id === campaign.stops[0].id));
});

test('planning the remaining packages leaves original campaign history untouched and can be undone', async () => {
  const original = { campaignId: 'sinterklaas-folder-bedrijven-2026', deliveries: [{ stopId: 'old' }] };
  const values = new Map([['bakery_logistics_acquisition_campaign', original]]);
  const storage = load('app/lib/bakeryLogisticsStorage.ts', {
    '@/app/bakkerij/logistiek/sinterklaasAcquisitionCampaign': campaignModule,
    './supabase/admin': { createAdminClient: () => ({ from: () => ({
      select: () => ({ eq: (_, key) => ({ maybeSingle: async () => ({ data: values.has(key) ? { value: values.get(key) } : null }) }) }),
      upsert: async row => { values.set(row.key, row.value); return {}; },
    }) }) },
  });
  assert.equal((await storage.getLogisticsAcquisitionCampaign()).deliveries.length, 0);
  const stopId = campaignModule.sinterklaasAcquisitionStops[0].id;
  const delivery = { stopId, date: '2026-10-28', routeId: 'r1', routeTitle: 'Ronde 1', vehicle: 'Bus A', deliveredAt: '2026-10-21T12:00:00Z' };
  assert.equal((await storage.markLogisticsAcquisitionDelivered(delivery)).deliveries.length, 1);
  assert.equal(values.get('bakery_logistics_acquisition_campaign'), original);
  assert.equal((await storage.undoLogisticsAcquisitionDelivery(stopId)).deliveries.length, 0);
  assert.equal(values.get('bakery_logistics_acquisition_campaign'), original);
});

test('the API accepts planning after 17 October and still rejects dates before the stock count', async () => {
  let saved = 0;
  const api = load('app/api/bakkerij-logistiek/acquisition-campaign/route.ts', {
    'next/server': { NextResponse: { json: (body, init = {}) => Response.json(body, init) } },
    '@/app/bakkerij/logistiek/sinterklaasAcquisitionCampaign': campaignModule,
    '@/app/lib/bakeryLogisticsAuth': { canAccessLogisticsRequest: async () => true },
    '@/app/lib/bakeryLogisticsStorage': { markLogisticsAcquisitionDelivered: async () => { saved++; return campaignModule.emptySinterklaasAcquisitionCampaign(); } },
  });
  for (const [date, expected] of [['2026-10-17', 400], ['2026-10-21', 200], ['2026-11-10', 200]]) {
    const response = await api.POST(new Request('https://example.test/api', { method: 'POST', body: JSON.stringify({ action: 'deliver', stopId: campaignModule.sinterklaasAcquisitionStops[0].id, date }) }));
    assert.equal(response.status, expected);
  }
  assert.equal(saved, 2);
});

test('package stops remain prominent and complete on the route print', () => {
  const item = campaignModule.sinterklaasAcquisitionStops.find(s => s.company === 'Duynie Group');
  const html = dashboard.print({ plan: { date: '2026-10-21' }, routeGroup: { vehicle: 'Bus A', routes: [{
    ...routes[0], departure: '08:05', badge: '1 stop', load: '1 stop', stops: [{
      ...stop('acquisition:' + item.id, 'Brievenbuspakketje · ' + item.company, `${item.street}, ${item.postalCode} ${item.city} · t.a.v. HR / Personeelszaken`), badges: ['acquisitie', 'sinterklaasfolder'],
    }],
  }] } });
  for (const value of ['BRIEVENBUSPAKKETJE', item.company, item.street, item.postalCode, 'HR / Personeelszaken']) assert(html.includes(value), value);
});
