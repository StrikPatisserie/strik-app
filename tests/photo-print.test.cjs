const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

function load(file, imports = {}, globals = {}, expose = '') {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(code + '\n' + expose, { exports, require: name => name === './photoPrintEditor' ? load('app/bakkerij/logistiek/photoPrintEditor.ts') : name === '../../lib/photoBackgroundColor' ? load('app/lib/photoBackgroundColor.ts') : name.endsWith('.module.css') ? {default:{}} : name === 'next/dynamic' ? {default:()=>()=>null} : name === './useRoadRouteTimes' ? {} : ['./roadRouting','./routeSaveQueue','./sinterklaasAcquisitionCampaign','./routeHistory'].includes(name) ? load('app/bakkerij/logistiek/'+name.slice(2)+'.ts') : imports[name] || (name === 'server-only' ? {} : require(name)), URL, Date, console, ...globals });
  return exports;
}
const tracking = load('app/bakkerij/logistiek/photoPrintTracking.ts');
const photoIdentity = load('app/bakkerij/logistiek/webshopPhotoIdentity.ts');
const copies = (n, extra = {}) => Array.from({ length: n }, (_, i) => ({
  id: `item-${i}`, imageId: 'logo-a', printKey: `logo-a:${i + 1}`, photoUrl: 'https://example.com/logo.jpg',
  customerName: 'Voorbeeldklant', product: 'Petit fours met logo', receiptNumber: '62000', shape: 'square', sizeCm: 3.78,
  copyNumber: i + 1, copyTotal: n, ...extra,
}));
const job = (id, keys, mode = 'print', date = '2026-10-22') => ({ id, date, printedAt: '2026-10-21T18:30:00.000Z', printedKeys: keys, mode });

test('a partial first print reserves exactly 30 of 100 and leaves 70 outstanding', () => {
  const items = copies(100);
  const groups = tracking.buildPhotoPrintGroups(items, new Set());
  const selected = tracking.selectPhotoPrintItems(items, new Set(), [{ groupId: groups[0].id, count: 30 }], 'print');
  assert.equal(selected.length, 30);
  const history = tracking.historyFromPhotoPrintJobs([job('first-job', selected.map(i => i.printKey))]);
  const nextGroups = tracking.buildPhotoPrintGroups(items, new Set(history.printedKeys));
  assert.equal(nextGroups[0].newItemCount, 70);
  const next = tracking.selectPhotoPrintItems(items, new Set(history.printedKeys), [{ groupId: groups[0].id, count: 70 }], 'print');
  assert.equal(next.length, 70);
  assert(next.every(i => !history.printedKeys.includes(i.printKey)));
});

test('reprinting 30 of 100 never consumes outstanding copies or resets completed status', () => {
  const items = copies(100);
  for (const confirmedCount of [70, 100]) {
    const first = job('first-job', items.slice(0, confirmedCount).map(i => i.printKey));
    const group = tracking.buildPhotoPrintGroups(items, new Set(first.printedKeys))[0];
    const selected = tracking.selectPhotoPrintItems(items, new Set(first.printedKeys), [{ groupId: group.id, count: 30 }], 'reprint');
    assert.equal(selected.length, 30);
    const history = tracking.historyFromPhotoPrintJobs([first, job('reprint-job', selected.map(i => i.printKey), 'reprint')]);
    assert.equal(tracking.buildPhotoPrintGroups(items, new Set(history.printedKeys))[0].newItemCount, 100 - confirmedCount);
  }
});

test('late evening photos and an increased morning quantity stay pending on the same delivery date', () => {
  const initial = copies(100);
  const history = tracking.historyFromPhotoPrintJobs([job('evening-print', initial.map(i => i.printKey))]);
  const morning = [...copies(120), ...copies(10, { imageId: 'new-photo', customerName: 'Nieuwe klant', printKey: 'new' })];
  const groups = tracking.buildPhotoPrintGroups(morning, new Set(history.printedKeys));
  assert.equal(groups.find(g => g.customerName === 'Voorbeeldklant').newItemCount, 20);
  assert.equal(groups.find(g => g.customerName === 'Nieuwe klant').newItemCount, 10);
});

test('selection keeps different customers and different print formats separate', () => {
  const items = [...copies(3), ...copies(2, { receiptNumber: '62001' }), ...copies(2, { product: 'Taart', shape: 'round', sizeCm: 12 })];
  const groups = tracking.buildPhotoPrintGroups(items, new Set());
  assert.equal(groups.length, 3);
  const group = groups.find(g => g.receiptNumber === '62001');
  const selected = tracking.selectPhotoPrintItems(items, new Set(), [{ groupId: group.id, count: 1 }], 'print');
  assert.equal(selected.length, 1);
  assert.equal(selected[0].receiptNumber, '62001');
  assert.equal(tracking.selectPhotoPrintItems(items, new Set(), [{ groupId: group.id, count: -1 }], 'print').length, 0);
});

const dashboard = load('app/bakkerij/logistiek/BakkerijLogistiekDashboard.tsx', {
  "../../productie/ProductionRequests":{}, react: React, '../../StrikUI': {}, './BusinessDeliveries': {}, './routePrintPagination': load('app/bakkerij/logistiek/routePrintPagination.ts'), './routePrintWindow': {}, './receiptDelivery': {}, './arendPrintSession': {}, './webshopPhotoIdentity': photoIdentity,
  './specialSchoolDelivery': {}, './specialProCollegeDelivery': {}, './PhotoPrintChoiceModal': {}, './usePhotoPrintHistory': {}, './photoPrintTracking': tracking,
}, {}, 'exports.sheet = createMarzipanPhotoPrintHtml; exports.pushCopies = pushMarzipanPrintCopies; exports.open = openMarzipanPhotoSheet; exports.buildItems = buildMarzipanPrintItems; exports.photoBlock = WebshopImageBlock;');

test('cake photos keep their physical size whether printed alone, together or as a reprint', () => {
  for (const count of [1, 2, 3, 5, 7, 20]) {
    const items = copies(count, { shape: 'round', product: 'Slagroomtaart 10-12p', sizeCm: 12, minimumSizeCm: 6 });
    const html = dashboard.sheet({ items, plan: { date: '2026-11-28' } });
    const sizes = [...html.matchAll(/--item-size:([\d.]+)cm/g)].map(match => Number(match[1]));
    assert.deepEqual(sizes, Array(count).fill(12), `${count} photos must all stay 12 cm`);
    assert.doesNotMatch(html, /geschaald vanaf/);
  }
});

test('mixed cake sizes and petit fours retain their own dimensions on a busy print day', () => {
  const items = [
    ...copies(7, { shape: 'round', sizeCm: 12, minimumSizeCm: 6 }),
    ...copies(2, { shape: 'round', sizeCm: 8, minimumSizeCm: 8, id: 'small-cake' }),
    ...copies(25),
  ];
  const html = dashboard.sheet({ items, plan: { date: '2026-11-28' } });
  assert.equal((html.match(/--item-size:12cm/g) || []).length, 7);
  assert.equal((html.match(/--item-size:8cm/g) || []).length, 2);
  assert.equal((html.match(/--item-size:3.78cm/g) || []).length, 25);
  assert.equal((html.match(/<img /g) || []).length, items.length);
  assert.match(html, /12 cm rond/);
  assert.match(html, /8 cm rond/);
});

function editorItem(key, width = 1200, height = 800) {
  const attrs = { 'data-photo-fit-key': key, 'data-photo-fit': 'cover' };
  const controls = {};
  const styles = {};
  const image = { src: 'https://webshop.strik-patisserie.nl/Media/userupload/13340.jpg', complete: true, naturalWidth: width, naturalHeight: height,
    style: { setProperty: (key, value) => styles[key] = value }, closest: () => item };
  const item = { attrs, controls, styles, image,
    getAttribute: name => attrs[name] ?? null,
    setAttribute: (name, value) => attrs[name] = value,
    removeAttribute: name => delete attrs[name],
    querySelector: selector => selector === 'img' ? image : controls[selector] ||= { style: {} },
  };
  return item;
}
function editorContext(items, extra = {}) {
  const html = dashboard.sheet({ items: copies(1, { shape: 'round', sizeCm: 12 }), plan: { date: '2026-11-28' } });
  const nodes = { 'confirm-print': { disabled: false }, 'print-sheet': {}, 'print-registration-note': {} };
  const context = { AbortSignal, document: {
    querySelectorAll: selector => selector === 'main img' ? items.map(item => item.image) : selector.includes('data-color-loading') ? items.filter(item => item.attrs['data-color-loading'] === 'true') : items,
    getElementById: id => nodes[id],
  }, ...extra };
  vm.createContext(context); vm.runInContext(html.match(/<script>([\s\S]*?)<\/script>/)[1], context);
  return { context, nodes, html };
}

test('round crop remains default; optional extension keeps every source corner and aspect ratio', () => {
  const {context, html} = editorContext([]);
  for (const [width, height] of [[1200, 800], [800, 1200], [1000, 1000], [3000, 100], [100, 3000]]) {
    const item = editorItem('a', width, height);
    context.fitMarzipanPhoto(item.image);
    assert(Math.min(parseFloat(item.styles['--photo-width']), parseFloat(item.styles['--photo-height'])) >= 100, 'default fills circle');
    item.setAttribute('data-photo-fit', 'extend');
    context.fitMarzipanPhoto(item.image);
    const w = parseFloat(item.styles['--photo-width']), h = parseFloat(item.styles['--photo-height']);
    assert(Math.hypot(w / 2, h / 2) <= 49.000001, 'default extension protects every source corner');
    assert(Math.abs(w / h - width / height) < 1e-9);
  }
  assert.match(html, /data-photo-fit="cover"/);
  assert.match(html, /Origineel rond uitsnijden/);
  assert.match(html, /<small class="background-note">Achtergrond aangevuld/);
  assert.match(html, /@page \{ margin: 10mm 5mm 8mm;/);
  assert.match(html, /\.screen-actions, \.photo-fit-control \{ display: none; \}/);
});

test('crop, zoom, position and reset synchronize only copies of the same order', () => {
  const a = editorItem('a'), a2 = editorItem('a'), b = editorItem('b');
  const { context, nodes } = editorContext([a, a2, b]);
  a.attrs['data-photo-color'] = '#ffe200'; // already selected; no network lookup
  context.setMarzipanPhotoFit({ closest: () => a, value: 'extend' });
  assert.deepEqual([a, a2, b].map(i => i.attrs['data-photo-fit']), ['extend', 'extend', 'cover']);
  assert.equal(nodes['confirm-print'].disabled, true);
  context.setMarzipanPhotoFit({ closest: () => a, value: 'cover' });
  for (const [name,value] of [['zoom','150'],['x','100'],['y','-100']]) context.adjustMarzipanPhoto({closest:()=>a, getAttribute:()=>name,value});
  assert.equal(a2.attrs['data-photo-zoom'], '150');
  assert.equal(b.attrs['data-photo-zoom'], undefined);
  // At maximum movement, no uncovered strip can appear in crop mode.
  const w = parseFloat(a.styles['--photo-width']), left = parseFloat(a.styles['--photo-left']);
  assert(Math.abs(left - w / 2) < 1e-8);
  context.adjustMarzipanPhoto({closest:()=>a, getAttribute:()=> 'x', value:'0'});
  assert.equal(a.styles['--photo-left'], '50%', 'slider zero really centres the photo');
  context.resetMarzipanPhoto({closest:()=>a});
  assert.equal(a2.attrs['data-photo-zoom'], '100');
  assert.equal(a2.attrs['data-photo-x'], '0');
});

test('colour lookup blocks printing while pending and never overrides a later manual colour', async () => {
  const a=editorItem('a'), a2=editorItem('a');
  let resolve;
  const pending=new Promise(done=>resolve=done);
  const {context,nodes}=editorContext([a,a2], {fetch:()=>pending});
  const work=context.suggestMarzipanColor({closest:()=>a});
  assert.equal(nodes['print-sheet'].disabled,true);
  context.adjustMarzipanPhoto({closest:()=>a,getAttribute:()=> 'color',value:'#aabbcc'});
  resolve({ok:true,json:async()=>({color:'#ffee00',uniform:true})});
  await work;
  assert.equal(a.attrs['data-photo-color'],'#aabbcc');
  assert.equal(a2.attrs['data-photo-color'],'#aabbcc');
  assert.equal(nodes['print-sheet'].disabled,false);
  assert.equal(nodes['confirm-print'].disabled,true);
});

test('failed colour lookup leaves original image usable with an actionable message', async () => {
  const a=editorItem('a');
  const {context,nodes}=editorContext([a], {fetch:async()=>{throw Error('offline')}});
  await context.suggestMarzipanColor({closest:()=>a});
  assert.match(a.controls['.color-status'].textContent,/Kies zelf een kleur/);
  assert.equal(nodes['print-sheet'].disabled,false);
  assert.equal(a.image.src,'https://webshop.strik-patisserie.nl/Media/userupload/13340.jpg');
});

test('rectangular and petit-four prints have no round crop control; oversized pairs use separate sheets', () => {
  const items = [...copies(1), ...copies(1, { shape: 'round', sizeCm: 12, photoUrl: 'https://example.com/douglas-60716.jpg' })];
  const html = dashboard.sheet({ items, plan: { date: '2026-11-28' } });
  assert.doesNotMatch(html, /<div class="photo-fit-control"/);
  const large = dashboard.sheet({ items: copies(2, { shape: 'round', sizeCm: 18 }), plan: { date: '2026-11-28' } });
  assert.doesNotMatch(large, /class="round-grid diagonal/);
  assert.equal((large.match(/--item-size:18cm/g) || []).length, 2);
});

test('confirming the same sheet twice registers one job, while a failed save can be retried', async () => {
  const sheet = { document: { open() {}, write() {}, close() {} }, focus() {} };
  const { open } = load('app/bakkerij/logistiek/BakkerijLogistiekDashboard.tsx', {
    "../../productie/ProductionRequests":{}, react: React, '../../StrikUI': {}, './BusinessDeliveries': {}, './routePrintPagination': load('app/bakkerij/logistiek/routePrintPagination.ts'), './routePrintWindow': {}, './receiptDelivery': {}, './arendPrintSession': {}, './webshopPhotoIdentity': photoIdentity,
    './specialSchoolDelivery': {}, './specialProCollegeDelivery': {}, './PhotoPrintChoiceModal': {}, './usePhotoPrintHistory': {}, './photoPrintTracking': tracking,
  }, { window: { open: () => sheet } }, 'exports.open = openMarzipanPhotoSheet;');
  let saves = 0;
  open({ date: '2026-10-22' }, copies(1), async () => { saves++; });
  await Promise.all([sheet.confirmMarzipanPrint(), sheet.confirmMarzipanPrint()]);
  assert.equal(saves, 1);
  let retries = 0;
  open({ date: '2026-10-22' }, copies(1), async () => { if (++retries === 1) throw Error('offline'); });
  await assert.rejects(sheet.confirmMarzipanPrint());
  await sheet.confirmMarzipanPrint();
  assert.equal(retries, 2);
});

test('print identities survive image/product reordering in a new batch', () => {
  const image = { id: 'same-photo', customerName: 'Voorbeeldklant', photoUrl: 'https://example.com/image.jpg' };
  const plan = { product: 'Petit four', shape: 'square', sizeCm: 3.78, minimumSizeCm: 3.78 };
  const a = [], b = [];
  dashboard.pushCopies({ items: a, image, plan, receipt: { receiptNumber: '62000' }, copyTotal: 100, planIndex: 0 });
  dashboard.pushCopies({ items: b, image, plan, receipt: { receiptNumber: '62000' }, copyTotal: 120, planIndex: 2 });
  assert.deepEqual(a.map(i => i.printKey), b.slice(0, 100).map(i => i.printKey));
  assert.equal(tracking.buildPhotoPrintGroups(b, new Set(a.map(i => i.printKey)))[0].newItemCount, 20);
});

test('a print sheet contains only selected copies and opening/printing never registers a successful print', async () => {
  const html = dashboard.sheet({ items: copies(30), plan: { date: '2026-10-22' } });
  assert.equal((html.match(/<img /g) || []).length, 30);
  const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  let printed = 0, confirmed = 0;
  const nodes = { 'print-registration-note': { classList: { add() {} } }, 'confirm-print': { disabled: true } };
  const window = { print: () => printed++, confirmMarzipanPrint: async () => confirmed++ };
  const context = { window, document: { getElementById: id => nodes[id], querySelectorAll: selector => selector === 'main img' ? [{ complete: true, naturalWidth: 100 }] : [] } };
  vm.createContext(context); vm.runInContext(script, context);
  assert.equal(confirmed, 0);
  context.printMarzipanSheet();
  assert.equal(printed, 1);
  assert.equal(confirmed, 0, 'Cancelling the system dialog must not count as printed');
  await context.confirmMarzipanSheet();
  assert.equal(confirmed, 1);
  assert.match(nodes['print-registration-note'].textContent, /Geregistreerd/);
});

test('incomplete/broken images block printing and failed registration can be retried', async () => {
  const html = dashboard.sheet({ items: copies(1), plan: { date: '2026-10-22' } });
  let printed = 0;
  const nodes = { 'print-registration-note': { classList: { add() {} } }, 'confirm-print': { disabled: true } };
  const context = { window: { print: () => printed++, confirmMarzipanPrint: async () => { throw Error('offline'); } }, document: { getElementById: id => nodes[id], querySelectorAll: selector => selector === 'main img' ? [{ complete: true, naturalWidth: 0 }] : [] } };
  vm.createContext(context); vm.runInContext(html.match(/<script>([\s\S]*?)<\/script>/)[1], context);
  context.printMarzipanSheet();
  assert.equal(printed, 0);
  assert.equal(nodes['confirm-print'].disabled, true);
  await context.confirmMarzipanSheet();
  assert.equal(nodes['confirm-print'].disabled, false);
  assert.equal(nodes['confirm-print'].textContent, 'Opnieuw registreren');
});

test('the selection shows per-photo status and count, with new photos selected by default', () => {
  const { PhotoPrintChoiceModal } = load('app/bakkerij/logistiek/PhotoPrintChoiceModal.tsx', { react: React, './photoPrintTracking': tracking });
  const groups = tracking.buildPhotoPrintGroups([...copies(100), ...copies(1, { imageId: 'other-photo', printKey: 'other-photo:1', customerName: 'Nieuwe klant' })], new Set(copies(70).map(i => i.printKey)));
  const html = renderToStaticMarkup(React.createElement(PhotoPrintChoiceModal, { groups, arendCount: 0, loading: false, syncMessage: '', onRefresh() {}, onClose() {}, onPrint() {}, onPrintArend() {} }));
  assert.match(html, /Deels geprint/);
  assert.match(html, /70\/100/);
  assert.match(html, /Aantal voor Voorbeeldklant/);
  assert.match(html, /value="30"/);
  assert.match(html, /Selectie printen · 31 stuks/);
});

test('job input rejects invalid modes, quantities and key payloads', () => {
  const valid = job('valid-job', ['one', 'one', 'two']);
  assert.equal(tracking.parsePhotoPrintJob(valid).printedKeys.length, 2);
  for (const bad of [{ ...valid, mode: 'reset' }, { ...valid, printedKeys: [] }, { ...valid, printedKeys: [2] }, { ...valid, date: '../secret' }, { ...valid, printedAt: 'invalid' }, { ...valid, id: 'x:y' }]) assert.equal(tracking.parsePhotoPrintJob(bad), null);
});

test('shared storage preserves concurrent jobs, isolates dates and deduplicates retries', async () => {
  const rows = new Map();
  const client = { from: () => ({
    upsert: async (row, options) => { if (!options.ignoreDuplicates || !rows.has(row.key)) rows.set(row.key, row); return {}; },
    select: () => ({ like: (_, pattern) => ({ limit: async () => ({ data: [...rows.values()].filter(row => row.key.startsWith(pattern.slice(0, -1))) }) }) }),
  }) };
  const storage = load('app/lib/bakeryPhotoPrintStorage.ts', { './supabase/admin': { createAdminClient: () => client }, '@/app/bakkerij/logistiek/photoPrintTracking': tracking });
  const a = job('printer-one', ['a', 'b']);
  const b = job('printer-two', ['c']);
  await Promise.all([storage.savePhotoPrintJob(a), storage.savePhotoPrintJob(b)]);
  await storage.savePhotoPrintJob(a);
  await storage.savePhotoPrintJob(job('reprint-job', ['extra'], 'reprint'));
  await storage.savePhotoPrintJob(job('another-day', ['tomorrow'], 'print', '2026-10-23'));
  const history = await storage.getPhotoPrintHistory('2026-10-22');
  assert.deepEqual([...history.printedKeys].sort(), ['a', 'b', 'c']);
  assert.equal(rows.size, 4);
});

test('print history endpoints require authentication before reading or writing', async () => {
  let writes = 0, reads = 0;
  const api = load('app/api/bakkerij-logistiek/photo-prints/route.ts', {
    '@/app/lib/bakeryLogisticsAuth': { canAccessLogisticsRequest: async () => false },
    '@/app/lib/bakeryPhotoPrintStorage': { savePhotoPrintJob: async () => writes++, getPhotoPrintHistory: async () => reads++ },
    '@/app/bakkerij/logistiek/photoPrintTracking': tracking,
  });
  assert.equal((await api.GET(new Request('https://example.com?date=2026-10-22'))).status, 403);
  assert.equal((await api.POST(new Request('https://example.com', { method: 'POST', body: '{}' }))).status, 403);
  assert.equal(writes + reads, 0);
});

function historyHarness(shared, browserData = new Map()) {
  const state = [], refs = [];
  let cursor = 0, refCursor = 0;
  const hooks = {
    useCallback: fn => fn, useEffect() {},
    useRef(initial) { return refs[refCursor++] ||= { current: initial }; },
    useState(initial) { const i = cursor++; if (!(i in state)) state[i] = initial; return [state[i], value => { state[i] = typeof value === 'function' ? value(state[i]) : value; }]; },
  };
  const request = async (url, options) => {
    if (shared.offline) return { ok: false };
    const date = options?.body ? JSON.parse(options.body).date : new URL(url, 'https://example.com').searchParams.get('date');
    if (options?.method === 'POST') { const incoming = JSON.parse(options.body); shared.jobs.set(incoming.id, incoming); }
    return { ok: true, json: async () => ({ history: tracking.historyFromPhotoPrintJobs([...shared.jobs.values()].filter(j => j.date === date)) }) };
  };
  const { usePhotoPrintHistory } = load('app/bakkerij/logistiek/usePhotoPrintHistory.ts', { react: hooks, './photoPrintTracking': tracking }, {
    localStorage: { getItem: key => browserData.get(key), setItem: (key, value) => browserData.set(key, value) },
    fetch: request, crypto: { randomUUID: () => `migration-${shared.jobs.size}-job` }, AbortSignal,
  });
  return { browserData, render(date) { cursor = 0; refCursor = 0; return usePhotoPrintHistory(date, 0); } };
}

test('an offline confirmation survives reloading and is shared on the next morning without double registration', async () => {
  const shared = { offline: true, jobs: new Map() };
  const browser = new Map();
  let harness = historyHarness(shared, browser);
  await assert.rejects(harness.render('2026-10-22').recordPrint('2026-10-22', ['a:1', 'a:2'], 'print', 'offline-job'));
  assert.equal(JSON.parse(browser.get('strik-logistiek-foto-print-outbox-v1')).length, 1);
  shared.offline = false;
  harness = historyHarness(shared, browser);
  await harness.render('2026-10-22').refresh();
  assert.equal(harness.render('2026-10-22').historyByDate['2026-10-22'].printedKeys.length, 2);
  assert.equal(harness.render('2026-10-22').syncMessage, '');
  assert.equal(JSON.parse(browser.get('strik-logistiek-foto-print-outbox-v1')).length, 0);
  await harness.render('2026-10-22').refresh();
  assert.equal(shared.jobs.size, 1);
  const otherComputer = historyHarness(shared);
  await otherComputer.render('2026-10-22').refresh();
  assert.equal(otherComputer.render('2026-10-22').historyByDate['2026-10-22'].printedKeys.length, 2);
});

test('existing browser print history migrates and a sheet confirms its captured date after the user switches day', async () => {
  const shared = { offline: false, jobs: new Map() };
  const browser = new Map([['strik-logistiek-marsepeinfoto-print-history-v1', JSON.stringify({ '2026-10-22': { printedAt: '2026-10-21T18:00:00Z', printedKeys: ['legacy:1'] } })]]);
  const harness = historyHarness(shared, browser);
  const oldSheet = harness.render('2026-10-22');
  await oldSheet.refresh();
  assert.equal(shared.jobs.size, 1);
  harness.render('2026-10-23');
  await oldSheet.recordPrint('2026-10-22', ['new:1'], 'print', 'old-date-sheet');
  const history = harness.render('2026-10-23').historyByDate;
  assert.equal(history['2026-10-22'].printedKeys.length, 2);
  assert.equal(history['2026-10-23'], undefined);
});

const photo = (id, extra = {}) => ({ id, messageId:'mail', orderNumber:'79000', deliveryDate:'2026-10-24', customerName:'Voorbeeldklant', photoUrl:`https://shop.invalid/${id}.jpg`, sourceUrl:'', fileName:`${id}.jpg`, productSummary:'Cremetaart Confetti 10-12p', productQuantity:1, receivedAt:'', importedAt:'', notes:[], confidence:'hoog', ...extra });
const photoReceipt = () => ({ id:'receipt', receiptNumber:'79000', customer:'Voorbeeldklant', lines:[{description:'Cremetaart Confetti 10-12p met foto',quantity:'1'},{description:'Cremetaart Confetti 10-12p met foto',quantity:'1'}], tags:[], note:'', customerNote:'', internalNote:'' });
test('two identical cake rows produce one copy of each different photo, including legacy photo records',()=>{
 for(const photos of [[photo('one',{sourceLineId:'line-1'}),photo('two',{sourceLineId:'line-2'})],[photo('one',{productQuantity:undefined}),photo('two',{productQuantity:undefined})]]){
  const items=dashboard.buildItems([photoReceipt()],photos);assert.equal(items.length,2);assert.equal(items.filter(item=>item.imageId==='one').length,1);assert.equal(items.filter(item=>item.imageId==='two').length,1);
 }
});
test('new order-line quantities determine copies without sharing one photo over other cake rows',()=>{
 const items=dashboard.buildItems([photoReceipt()],[photo('one',{productQuantity:3})]);assert.equal(items.length,3);
});
test('an incomplete photo import blocks every sibling from the same order in the print selection',()=>{
 const items=dashboard.buildItems([photoReceipt()],[photo('one',{expectedPhotoCount:2,importedPhotoCount:1,importWarnings:['Tweede foto ontbreekt']}),photo('two')]);assert.equal(items.length,0);
 const html=renderToStaticMarkup(React.createElement(dashboard.photoBlock,{images:[photo('one',{expectedPhotoCount:2,importedPhotoCount:1,importWarnings:['Tweede foto ontbreekt']})],receipt:photoReceipt(),onDelete(){},onUnlink(){}}));assert.match(html,/Foto-import onvolledig/);assert.match(html,/printen voor deze bestelling geblokkeerd/);assert.match(html,/Foto 1 van 2/);
});

test('a missing source photo is visible as an error and printing enables only after all images load',()=>{
 const html=dashboard.sheet({items:copies(2),plan:{date:'2026-10-31'}});
 assert.match(html,/photo-load-error/);assert.match(html,/Open de bronmail/);
 const nodes={'print-registration-note':{},'print-sheet':{disabled:true}};
 const images=[{complete:true,naturalWidth:0},{complete:true,naturalWidth:100}];
 const context={document:{getElementById:id=>nodes[id],querySelectorAll:selector=>selector==='main img'?images:[]},window:{}};
 vm.createContext(context);vm.runInContext(html.match(/<script>([\s\S]*?)<\/script>/)[1],context);
 context.marzipanImageStateChanged();assert.equal(nodes['print-sheet'].disabled,true);assert.match(nodes['print-registration-note'].textContent,/1 foto/);
 images[0]={complete:false,naturalWidth:0};context.marzipanImageStateChanged();assert.equal(nodes['print-sheet'].disabled,true);assert.match(nodes['print-registration-note'].textContent,/laden/);
 images[0]={complete:true,naturalWidth:100};context.marzipanImageStateChanged();assert.equal(nodes['print-sheet'].disabled,false);
});
