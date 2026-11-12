const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm'), ts = require('typescript');
function load(file, imports = {}, globals = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText,
    { exports, URL, Request, Response, AbortSignal, ...globals, require: name => imports[name] || {} });
  return exports;
}
const seasons = load('app/lib/businessSeasons.ts');
const model = load('app/lib/businessOrderDeliveries.ts', { './businessSeasons': seasons });
const order = changes => ({ id:'b2b-1', customerName:'Voorbeeld BV', season:'sint', status:'akkoord', entered:false, deliveryDate:'2026-11-23', deliveryWindowType:'date', deliveryDateEnd:'', deliveryMethod:'Bezorgen', deliveryAddress:'Voorbeeldstraat 1', orderText:'25 × Chocoladeletters · € 12,80 p.s.', ...changes });
test('Dagstart remains independent of Bake-it entry and includes tentative orders, while completed/cancelled/pickup orders disappear', () => {
  const values = [order({id:'not-entered'}), order({id:'entered',entered:true}), order({id:'offer',status:'offerte'}), order({id:'inquiry',status:'aanvraag'}), order({id:'cancelled',cancelled:true}), order({id:'delivered',delivered:true}), order({id:'declined',status:'afgewezen'}), order({id:'pickup',deliveryMethod:'Afhalen in Lent',deliveryAddress:''}), order({id:'future',deliveryDate:'2026-12-01'}), order({id:'historie-old'})];
  const result = model.businessDeliveriesForWeek(values, '2026-11-23');
  assert.deepEqual(Array.from(result.orders, x=>x.id).sort(), ['entered','inquiry','not-entered','offer']);
  assert.ok(result.orders.every(x=>x.onSelectedDay));
  assert.equal(model.businessDeliveriesForWeek(values,'2026-10-21').orders.length,0);
});
test('ranges, ISO weeks and legacy delivery markers use the first possible day across months and years', () => {
  const range = model.businessDeliveriesForWeek([order({deliveryDate:'2026-11-16',deliveryDateEnd:'2026-11-30',deliveryWindowType:'range'})], '2026-11-26').orders[0];
  assert.equal(range.start,'2026-11-16'); assert.equal(range.onSelectedDay,true); assert.equal(range.overdue,false);
  const week = model.businessDeliveryWindow(order({deliveryWindowType:'week',deliveryWeek:'2026-W53',deliveryDate:''}));
  assert.equal(week.start,'2026-12-28'); assert.equal(week.end,'2027-01-03');
  assert.equal(model.businessDeliveryWindow(order({deliveryWindowType:'week',deliveryWeek:'2027-W53'})),null);
  assert.equal(model.businessDeliveryWindow(order({sourceSheet:'__STRIK_LEVERPERIODE__range|2026-11-30|'})).end,'2026-11-30');
  assert.equal(model.validBusinessDate('2026-02-30'),false); assert.equal(model.validBusinessDate('2026-11-23T01:00'),false);
});
test('overdue and ambiguous deliveries stay visible rather than being silently treated as collected or delivered', () => {
  const result = model.businessDeliveriesForWeek([order({id:'late',deliveryDate:'2026-11-16'}), order({id:'contradictory',deliveryMethod:'Afhalen in Lent'}), order({id:'unclear',deliveryMethod:'',deliveryAddress:''}), order({id:'old-year',deliveryDate:'2025-11-16'})], '2026-11-23').orders;
  assert.equal(result.length,3); assert.equal(result[0].overdue,true);
  assert.equal(result.find(x=>x.id==='contradictory').deliveryUnclear,true); assert.equal(result.find(x=>x.id==='unclear').deliveryUnclear,true);
});
test('a matching receipt is only a hint and cannot hide B2B orders or match a different delivery day', () => {
  const current = model.businessDeliveriesForWeek([order({})],'2026-11-23').orders[0];
  const receipts = [{customer:'Voorbeeld B.V.',receiptNumber:'60248'}];
  assert.equal(model.possibleBusinessReceipts(current,receipts)[0],'60248');
  assert.equal(model.possibleBusinessReceipts({...current,onSelectedDay:false},receipts).length,0);
  assert.equal(model.businessDeliveriesForWeek([order({entered:true})],'2026-11-23').orders.length,1);
});
test('logistics API checks access before WordPress, returns explicit failures, and exposes only delivery information', async () => {
  let calls=0;
  function api(profile, allowed, ok=true) {
    return load('app/api/bakkerij-logistiek/business-deliveries/route.ts', {
      '@/app/preview/logistiek/businessDeliveriesSource.server':{readLocalBusinessDeliveries:async()=>null},
      '@/app/lib/auth/session':{getCurrentProfile:async()=>profile}, '@/app/lib/auth/access':{canAccessPath:(_,path)=>allowed && path.includes('logistiek')}, '@/app/lib/businessOrderDeliveries':model,
    }, { process:{env:{}}, fetch:async()=>{calls++;return Response.json({orders:[order({customerEmail:'private@example.invalid',invoiceInfo:'PRIVATE INVOICE',importantNotes:'PRIVATE NOTE'})]},{status:ok?200:500});} });
  }
  const request=new Request('https://example.invalid/api/bakkerij-logistiek/business-deliveries?date=2026-11-23');
  assert.equal((await api(null,false).GET(request)).status,403); assert.equal(calls,0);
  assert.equal((await api({active:true},false).GET(request)).status,403); assert.equal(calls,0);
  const response=await api({active:true},true).GET(request); const data=await response.json();
  assert.equal(data.orders.length,1); assert.equal(data.canManage.sint,false);
  assert.ok(!JSON.stringify(data).includes('PRIVATE')); assert.ok(!JSON.stringify(data).includes('private@example.invalid'));
  assert.equal((await api({active:true},true,false).GET(request)).status,502);
});
test('scheduled reminders require their cron secret, support a read-only dry run and report failed/uncertain mail as failure', async()=>{
  let calls=0, received;
  function cron(secret, result={sent:0}) {
    return load('app/api/business-order-reminders/route.ts',{}, {process:{env:{CRON_SECRET:secret}},fetch:async(url,options)=>{calls++;received=JSON.parse(options.body);assert.equal(new URL(url).pathname,'/wp-json/strik/v1/business-order-reminders');return Response.json(result);}});
  }
  assert.equal((await cron('').GET(new Request('https://example.invalid/cron'))).status,403);
  assert.equal((await cron('test-secret').GET(new Request('https://example.invalid/cron'))).status,403); assert.equal(calls,0);
  const request=new Request('https://example.invalid/cron?dryRun=1',{headers:{authorization:'Bearer test-secret'}});
  assert.equal((await cron('test-secret').GET(request)).status,200); assert.equal(received.dryRun,true);
  assert.equal((await cron('test-secret',{uncertain:1}).GET(request)).status,502);
});

test('planning includes upcoming weeks and pickup appointments, excludes delivered orders, and retains legacy weekly behavior', () => {
  const values = [
    order({ id: 'today', deliveryDate: '2026-11-12' }),
    order({ id: 'pickup', deliveryDate: '2026-11-13', deliveryMethod: 'Afhalen bij Strik Lent', deliveryAddress: '' }),
    order({ id: 'next-week', deliveryDate: '2026-11-16' }),
    order({ id: 'delivered', delivered: true, deliveryDate: '2026-11-12' }),
    order({ id: 'cancelled', cancelled: true }),
    order({ id: 'old-year', deliveryDate: '2025-11-12' }),
  ];
  const planning = model.businessDeliveriesForWeek(values, '2026-11-12', { includeUpcoming: true, includePickup: true });
  assert.deepEqual(Array.from(planning.orders, value => value.id).sort(), ['next-week', 'pickup', 'today']);
  assert.equal(planning.orders.find(value => value.id === 'pickup').deliveryUnclear, false);
  assert.deepEqual(Array.from(model.businessDeliveriesForWeek(values, '2026-11-12').orders, value => value.id), ['today']);
});

test('urgency uses the real calendar day, including ranges and tomorrow across week and year boundaries', () => {
  const delivery = changes => model.businessDeliveriesForWeek([order(changes)], '2026-11-12', { includeUpcoming: true }).orders[0];
  assert.equal(model.businessDeliveryUrgency(delivery({ deliveryDate: '2026-11-12' }), '2026-11-12'), 'today');
  assert.equal(model.businessDeliveryUrgency(delivery({ deliveryDate: '2026-11-13' }), '2026-11-12'), 'tomorrow');
  assert.equal(model.businessDeliveryUrgency(delivery({ deliveryDate: '2026-11-11' }), '2026-11-12'), 'overdue');
  assert.equal(model.businessDeliveryUrgency(delivery({ deliveryDate: '2026-11-14' }), '2026-11-12'), null);
  assert.equal(model.businessDeliveryUrgency(delivery({ deliveryDate: '2026-11-09', deliveryDateEnd: '2026-11-15', deliveryWindowType: 'range' }), '2026-11-12'), 'today');
  assert.equal(model.businessDeliveryUrgency(delivery({ deliveryDate: '2026-11-16' }), '2026-11-15'), 'tomorrow');
  assert.equal(model.businessDeliveryUrgency(delivery({ deliveryDate: '2027-01-01' }), '2026-12-31'), 'tomorrow');
});

test('today and tomorrow precede overdue and future orders without mutating API data', () => {
  const values = model.businessDeliveriesForWeek([
    order({ id: 'late', deliveryDate: '2026-11-01' }),
    order({ id: 'future', deliveryDate: '2026-11-16' }),
    order({ id: 'tomorrow', deliveryDate: '2026-11-13' }),
    order({ id: 'today', deliveryDate: '2026-11-12' }),
  ], '2026-11-12', { includeUpcoming: true }).orders;
  const before = Array.from(values, value => value.id);
  assert.deepEqual(Array.from(model.prioritizeBusinessDeliveries(values, '2026-11-12'), value => value.id), ['today', 'tomorrow', 'late', 'future']);
  assert.deepEqual(Array.from(values, value => value.id), before);
});

test('the authenticated planning API includes a Monday pickup when viewing Sunday', async () => {
  const api = load('app/api/bakkerij-logistiek/business-deliveries/route.ts', {
    '@/app/lib/auth/session': { getCurrentProfile: async () => ({ active: true }) },
    '@/app/lib/auth/access': { canAccessPath: () => true },
    '@/app/lib/businessOrderDeliveries': model,
  }, {
    process: { env: {} },
    fetch: async () => Response.json({ orders: [order({ deliveryDate: '2026-11-16', deliveryMethod: 'Afhalen bij Strik Lent', deliveryAddress: '' })] }),
  });
  const response = await api.GET(new Request('https://example.invalid/api/bakkerij-logistiek/business-deliveries?date=2026-11-15&planning=1'));
  const data = await response.json();
  assert.equal(response.status, 200);
  assert.equal(data.orders.length, 1);
  assert.equal(data.orders[0].start, '2026-11-16');
  assert.equal(response.headers.get('cache-control'), 'no-store');
});

function planningMarkup({ orders = [], error = '', loading = false, responseDate = '2026-11-12', scope = 'upcoming' } = {}) {
  const React = require('react');
  const states = [{ selectedDate: responseDate, week: model.businessWeek(responseDate), orders, canManage: { sint: true, kerst: true } }, error, loading, 0, scope, ''];
  const component = load('app/bakkerij/logistiek/BusinessDeliveries.tsx', {
    react: { useState: () => [states.shift(), () => {}], useEffect: () => {} },
    'react/jsx-runtime': require('react/jsx-runtime'),
    'next/link': { default: props => React.createElement('a', props) },
    '../../StrikUI': { strikIcons: { sinterklaasB2B: '/icon.svg' } },
    '../../lib/businessSeasons': seasons,
    '../../lib/businessOrderDeliveries': model,
    './BusinessDeliveries.module.css': { default: new Proxy({}, { get: (_, key) => String(key) }) },
  }).default;
  return require('react-dom/server').renderToStaticMarkup(component({ date: '2026-11-12', today: '2026-11-12', receipts: [] }));
}

test('B2B planning remains visible with no orders, while loading, and after a failed read', () => {
  assert.match(planningMarkup(), /B2B-planning/);
  assert.match(planningMarkup(), /Geen openstaande B2B-bestellingen/);
  assert.match(planningMarkup({ loading: true, responseDate: '2026-11-11' }), /B2B-planning laden/);
  assert.match(planningMarkup({ error: 'Ophalen mislukt' }), /role="alert"/);
  assert.match(planningMarkup({ error: 'Ophalen mislukt' }), /Ophalen mislukt/);
});

test('compact rows show urgent dates and keep full order details and tentative status available', () => {
  const orders = model.businessDeliveriesForWeek([
    order({ id: 'today', customerName: 'Vandaag BV', deliveryDate: '2026-11-12' }),
    order({ id: 'tomorrow', customerName: 'Morgen BV', deliveryDate: '2026-11-13', status: 'offerte' }),
    order({ id: 'later', customerName: 'Later BV', deliveryDate: '2026-11-16' }),
  ], '2026-11-12', { includeUpcoming: true }).orders;
  const html = planningMarkup({ orders });
  assert.match(html, /class="urgent"/);
  assert.match(html, />Vandaag</);
  assert.match(html, />Morgen</);
  assert.match(html, /Offerte · akkoord controleren/);
  assert.match(html, /<details/);
  assert.match(html, /Voorbeeldstraat 1/);
  assert.match(html, /Open B2B-bestellingen/);
  assert.match(html, /Later BV/);
  assert.doesNotMatch(planningMarkup({ orders, scope: 'day' }), /Morgen BV/);
  assert.doesNotMatch(planningMarkup({ orders, responseDate: '2026-11-11' }), /Vandaag BV/);
});


test('local delivery preview requires explicit development configuration and loopback access', async () => {
  const orders = model.businessDeliveriesForWeek([order({ deliveryDate: '2026-11-16' })], '2026-11-12', { includeUpcoming: true }).orders;
  const documents = [{ key: 'logistics-business-deliveries', data: orders, updated_at: '2026-11-12T08:00:00Z' }];
  let reads = 0;
  function preview({ env = {}, configured = false, source = JSON.stringify(documents) } = {}) {
    return load('app/preview/logistiek/businessDeliveriesSource.server.ts', {
      'node:fs/promises': { readFile: async () => { reads++; return source; } },
      '../../lib/supabase/config': { getSupabasePublicConfig: () => ({ isConfigured: configured }) },
      '../../lib/businessOrderDeliveries': model,
    }, { process: { env: { NODE_ENV: 'development', STRIK_PLANNING_PREVIEW_SOURCE: '/tmp/preview.json', ...env } } });
  }
  const request = new Request('http://127.0.0.1:3016/api/bakkerij-logistiek/business-deliveries?date=2026-11-16&planning=1');
  for (const options of [{ env: { NODE_ENV: 'production' } }, { env: { STRIK_PLANNING_PREVIEW_SOURCE: '' } }, { configured: true }]) {
    assert.equal(await preview(options).readLocalBusinessDeliveries(request), null);
  }
  assert.equal(await preview().readLocalBusinessDeliveries(new Request('https://example.invalid/api?date=2026-11-16&planning=1')), null);
  assert.equal(await preview().readLocalBusinessDeliveries(new Request(request.url, { method: 'POST' })), null);
  assert.equal(await preview().readLocalBusinessDeliveries(new Request('http://localhost/api?date=invalid')), null);
  assert.equal(reads, 0);
  const result = await preview().readLocalBusinessDeliveries(request);
  assert.equal(result.orders.length, 1);
  assert.equal(result.orders[0].onSelectedDay, true);
  assert.equal(result.canManage.sint, false);
  assert.equal(result.canManage.kerst, false);
  assert.equal(result.previewUpdatedAt, documents[0].updated_at);
  const later = await preview().readLocalBusinessDeliveries(new Request('http://localhost/api?date=2026-11-17&planning=1'));
  assert.equal(later.orders[0].onSelectedDay, false);
  assert.equal(later.orders[0].overdue, true);
  assert.equal(await preview({ source: '{}' }).readLocalBusinessDeliveries(request), null);
  assert.equal(await preview({ source: 'invalid' }).readLocalBusinessDeliveries(request), null);
  assert.equal(await preview({ source: '[]' }).readLocalBusinessDeliveries(request), null);
});

test('local readonly B2B preview is returned only when no profile is present', async () => {
  let previewReads = 0;
  const preview = { selectedDate: '2026-11-12', orders: [], canManage: { sint: false, kerst: false }, previewUpdatedAt: '2026-11-12T08:00:00Z' };
  function api(profile) {
    return load('app/api/bakkerij-logistiek/business-deliveries/route.ts', {
      '@/app/preview/logistiek/businessDeliveriesSource.server': { readLocalBusinessDeliveries: async () => { previewReads++; return preview; } },
      '@/app/lib/auth/session': { getCurrentProfile: async () => profile },
      '@/app/lib/auth/access': { canAccessPath: () => false },
      '@/app/lib/businessOrderDeliveries': model,
    }, { process: { env: {} }, fetch: async () => { throw new Error('Unexpected live API call'); } });
  }
  const request = new Request('http://localhost/api?date=2026-11-12&planning=1');
  const response = await api(null).GET(request);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await response.json(), preview);
  assert.equal((await api({ active: false }).GET(request)).status, 403);
  assert.equal((await api({ active: true }).GET(request)).status, 403);
  assert.equal(previewReads, 1);
});
