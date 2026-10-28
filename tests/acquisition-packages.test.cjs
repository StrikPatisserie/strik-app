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
const dashboard = load('app/bakkerij/logistiek/BakkerijLogistiekDashboard.tsx', {'./routePrintPagination':load('app/bakkerij/logistiek/routePrintPagination.ts')}, 'exports.suggest = buildAcquisitionSuggestions; exports.inPeriod = isAcquisitionCampaignDate; exports.print = createBusRoutePrintHtml; exports.iceStops = fixedShopIceStops; exports.reconcile = reconcileRouteDraftRounds;');
const stop = (id, label, detail) => ({ id, sourceId: id, label, detail, badges: [] });
const routes = [{ id: 'r1', vehicle: 'Bus A', title: 'Ronde 1', stops: [
  stop('west', 'Bedrijf', '6541 AA Nijmegen'),
  stop('shop:ziekerstraat', 'Ziekerstraat', 'Nijmegen'),
  stop('shop:lent', 'Lent', 'Nijmegen'),
] }];

test('the two photos list exactly 23 packages, using the existing addresses', () => {
  const campaign = campaignModule.emptySinterklaasAcquisitionCampaign();
  assert.equal(campaign.stops.length, 23);
  assert.equal(new Set(campaign.stops.map(s => s.id)).size, 23);
  assert.deepEqual(Array.from(campaign.stops, s => s.company).sort(), [
    'DFDS Logistics Nijmegen B.V.', 'Duynie Group', 'De Variabele Groep', 'KlokGroep', 'Dar N.V.',
    'Batenburg Installatietechniek', 'BCTN Nijmegen', 'HKS Metals Nijmegen', 'Technische Unie Nijmegen',
    'ANAC Nijmegen', 'Pluryn', 'HORNBACH Nijmegen', 'Holland Casino Nijmegen', 'Mercure Hotel Nijmegen Centre', 'ARN B.V.',
    'Stichting De Waalboog', 'Synthon B.V.', 'Byondis B.V.', 'XPO Logistics Nijmegen', 'KION', 'GX Software',
    'Royal SMIT Transformers B.V.', 'Lamers High Tech Systems',
  ].sort());
  for (const item of campaign.stops) assert(item.street && item.postalCode && item.city && item.attention);
  assert.equal(campaign.deliveries.length, 0);
});

test('remaining stock stays plannable after the old deadline and suggested stops disappear only after placement', () => {
  const campaign = campaignModule.emptySinterklaasAcquisitionCampaign();
  assert.equal(dashboard.inPeriod('2026-10-20', campaign), false);
  for (const date of ['2026-10-21', '2026-10-28', '2026-11-10']) assert.equal(dashboard.inPeriod(date, campaign), true);
  const routed = structuredClone(routes), placed = new Set();
  while (placed.size < 23) {
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
  const existingStopId = campaignModule.sinterklaasAcquisitionStops.find(s => s.company === 'Duynie Group').id;
  const existingDelivery = { stopId: existingStopId, date: '2026-10-21', routeId: 'r2', routeTitle: 'Ronde 2', vehicle: 'Bus B', deliveredAt: '2026-10-21T10:00:00Z' };
  values.set(campaignModule.sinterklaasAcquisitionSettingKey, { campaignId: campaignModule.sinterklaasAcquisitionCampaignId, deliveries: [existingDelivery], updatedAt: existingDelivery.deliveredAt });
  const expanded = await storage.getLogisticsAcquisitionCampaign();
  assert.equal(expanded.stops.length, 23);
  assert.equal(expanded.deliveries[0].stopId, existingStopId, 'Adding stock must retain the already planned package');
  const stopId = campaignModule.sinterklaasAcquisitionStops[0].id;
  const delivery = { stopId, date: '2026-10-28', routeId: 'r1', routeTitle: 'Ronde 1', vehicle: 'Bus A', deliveredAt: '2026-10-21T12:00:00Z' };
  assert.equal((await storage.markLogisticsAcquisitionDelivered(delivery)).deliveries.length, 2);
  assert.equal(values.get('bakery_logistics_acquisition_campaign'), original);
  assert.equal((await storage.undoLogisticsAcquisitionDelivery(stopId)).deliveries.length, 1);
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

test('fixed shop ice stops require an actual matching ice receipt, not a fixed schedule or pastry receipt', () => {
  const receipt = { id: 'ice-real', receiptNumber: '123', customer: 'Winkel Heyendaalseweg', address: 'Heyendaalseweg', deliveryAddress: '', pickupLocation: '', customerNote: '', internalNote: '', note: '', time: '', route: '', tags: [], lines: [{ quantity: '4', description: 'IJs 5L bak' }] };
  const options = { shopKey: 'heyendaalseweg', label: 'IJs Heyendaal' };
  assert.equal(dashboard.iceStops({ ...options, receipts: [] }).length, 0);
  assert.equal(dashboard.iceStops({ ...options, receipts: [{ ...receipt, lines: [{ quantity: '4', description: 'Slagroomgebak' }] }] }).length, 0);
  assert.equal(dashboard.iceStops({ ...options, receipts: [{ ...receipt, customer: 'Winkel Lent', address: 'Lent' }] }).length, 0);
  const ice = dashboard.iceStops({ ...options, receipts: [receipt] });
  assert.equal(ice.length, 1);assert.match(ice[0].detail, /4 ijs \/ 2 tempex/);assert.equal(ice[0].sourceId, 'shop:heyendaalseweg:ice');
  assert.equal(dashboard.iceStops({ ...options, receipts: [{ ...receipt, tags: ['ijs'], customerNote: 'ijsbon aanwezig', lines: [] }] }).length, 1);
});

test('reconciling a saved tomorrow plan retains manual stops, ordering, exclusions and departure without changing the saved draft', () => {
  const manual = { ...stop('manual:parcel', 'Brievenbuspakketje · Testbedrijf', 'Teststraat 1'), badges: ['handmatig','acquisitie'] };
  const draft = { routes: [{ id: 'r1', vehicle: 'Bus A', title: 'Ronde 1', departure: 'vertrek 08:20', stops: [manual, routes[0].stops[0]] }], excludedSourceIds: ['shop:heyendaalseweg:ice'] };
  const before=JSON.stringify(draft);
  const result=dashboard.reconcile(draft,[{...draft.routes[0],stops:[routes[0].stops[0]]}],{pressure:'laag'});
  assert.equal(result[0].stops[0].id,manual.id);assert.equal(result[0].departure,'vertrek 08:20');assert.equal(result[0].stops.length,2);assert.equal(JSON.stringify(draft),before);
});

test('manual package selection can place an unsuggested campaign package or a custom parcel in the chosen round', () => {
  const campaign=campaignModule.emptySinterklaasAcquisitionCampaign();
  const selected=campaign.stops[0];
  function formFor(values, handlers) {
    let index=0;
    const { Form }=load('app/bakkerij/logistiek/BakkerijLogistiekDashboard.tsx', {
      react: {useState: initial=>[values[index++] ?? initial,()=>{}]},
      'react/jsx-runtime':require('react/jsx-runtime'),
    }, 'exports.Form = ManualPackageForm;');
    return Form({campaign,routes,busy:false,...handlers}).props.children[1];
  }
  let placement,custom;
  formFor([selected.id,'r1','',''],{onAdd:value=>{placement=value;return Promise.resolve();},onCustomAdd(){}}).props.onSubmit({preventDefault(){}});
  assert.equal(placement.stop.id,selected.id);assert.equal(placement.routeId,'r1');assert.equal(placement.afterStopId,'shop:lent');
  formFor(['custom','r1',' Extra bedrijf ',' Adres 8 '],{onAdd(){},onCustomAdd:(...args)=>{custom=args;}}).props.onSubmit({preventDefault(){}});
  assert.deepEqual(custom,['r1','Brievenbuspakketje · Extra bedrijf','SINTERKLAASFOLDER · Adres 8']);
});
