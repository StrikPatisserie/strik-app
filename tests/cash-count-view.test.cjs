const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm'), ts = require('typescript');
function load(file, imports = {}, globals = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText, {
    exports, Date, Intl, Map, Set, URL, URLSearchParams, Number, ...globals,
    require(name) { assert(name in imports, `Unmocked ${name}`); return imports[name]; },
  });
  return exports;
}
const revenue = load('app/management/revenueData.ts');
const view = load('app/management/gegevens/geld-tellen/cashCountView.ts', { '../../revenueData': revenue });
const plain = value => JSON.parse(JSON.stringify(value));
const route = '/management/gegevens/geld-tellen';
test('cash selection survives refresh for every shop, type and ISO year boundary', () => {
  for (const shop of revenue.revenueShops) for (const kind of ['patisserie', 'ice']) for (const date of ['2026-10-30', '2026-12-31', '2027-01-01', '2028-02-29']) {
    const selection = { date, shop, kind };
    const href = view.cashCountViewHref(route, selection);
    assert.deepEqual(plain(view.readCashCountView(new URL(href, 'https://test.invalid').searchParams, '2026-11-05')), selection);
  }
});
test('invalid selection parameters fall back safely without inventing calendar dates', () => {
  for (const date of ['2026-02-29', '2026-02-30', '2026-13-01', '2026-11-31', '<script>', '', '2026-1-5']) {
    const result = view.readCashCountView(new URLSearchParams({ date, shop: 'Other', kind: 'invalid' }), '2026-11-05');
    assert.deepEqual(plain(result), { date: '2026-11-05', shop: 'Heyendaal', kind: 'patisserie' });
  }
});
test('selection URLs retain other parameters and the existing section anchor', () => {
  const href = view.cashCountViewHref(`${route}?source=report&date=2026-10-01#day`, { date: '2026-10-30', shop: 'Lent', kind: 'patisserie' });
  const url = new URL(href, 'https://test.invalid');
  assert.equal(url.searchParams.get('source'), 'report'); assert.equal(url.hash, '#day');
  assert.equal(url.searchParams.getAll('date').length, 1); assert.equal(url.searchParams.get('date'), '2026-10-30');
});
test('the server passes the saved selection into the very first client render', async () => {
  const component = () => null;
  const page = load('app/management/gegevens/geld-tellen/page.tsx', {
    'react/jsx-runtime': require('react/jsx-runtime'), '@/app/StrikUI': { StrikShell: 'main', StrikPageHeader: 'header', strikIcons: {} },
    './CashCountManager': { default: component }, './cashCountView': view,
  }).default;
  const tree = await page({ searchParams: Promise.resolve({ date: ['2026-10-30', 'invalid'], shop: 'Lent', kind: 'ice' }) });
  const child = tree.props.children.find(n => n.type === component);
  assert.deepEqual(plain(child.props.initialView), { date: '2026-10-30', shop: 'Lent', kind: 'ice' });
  const empty = await page({ searchParams: Promise.resolve({ date: '2026-02-30' }) });
  assert.equal(empty.props.children.find(n => n.type === component).props.initialView.date, '');
});

function harness(href) {
  const states = [], effects = [], queued = [], listeners = new Map(), requests = [], historyWrites = [];
  let cursor = 0, effectCursor = 0, dirty = false, tree, reloads = 0;
  const historyState = { nextRouter: 'preserved' };
  const browser = { location: new URL(href, 'https://test.invalid'), history: { state: historyState, replaceState(state, _, href) { assert.equal(state, historyState); browser.location = new URL(href, browser.location); historyWrites.push(browser.location.href); } }, addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: name => listeners.delete(name) };
  browser.location.reload = () => { reloads++; };
  const react = {
    useState(initial) { const i = cursor++; if (!(i in states)) states[i] = typeof initial === 'function' ? initial() : initial; return [states[i], value => { const next = typeof value === 'function' ? value(states[i]) : value; if (!Object.is(next, states[i])) { states[i] = next; dirty = true; } }]; },
    useMemo: fn => fn(),
    useEffect(fn, deps) { const i = effectCursor++, before = effects[i]; if (!before || deps.some((v, j) => v !== before.deps[j])) queued.push(() => { before?.cleanup?.(); effects[i] = { deps, cleanup: fn() }; }); },
  };
  const component = load('app/management/gegevens/geld-tellen/CashCountManager.tsx', {
    react, 'react/jsx-runtime': require('react/jsx-runtime'), 'next/link': { default: 'a' }, './CashCountManager.module.css': { default: {} },
    './cashCountView': view, '@/app/management/revenueData': revenue,
    './DayCountCorrection': { default: 'day-correction' },
  }, { window: browser, fetch: (url, options) => new Promise(resolve => requests.push({ url, options, resolve })) }).default;
  function settle() { let count = 0; do { dirty = false; cursor = effectCursor = 0; tree = component(); queued.splice(0).forEach(fn => fn()); assert(++count < 20, 'render loop'); } while (dirty); return tree; }
  function nodes(value) { if (!value || typeof value !== 'object') return []; if (Array.isArray(value)) return value.flatMap(nodes); return [value, ...nodes(value.props?.children)]; }
  function text(value) { if (typeof value === 'string' || typeof value === 'number') return String(value); if (Array.isArray(value)) return value.map(text).join(''); return value?.props ? text(value.props.children) : ''; }
  function button(label) { return nodes(tree).find(n => n.type === 'button' && (text(n).trim() === label || n.props['aria-label'] === label)); }
  function location() { return nodes(tree).find(n => n.type === 'select' && /^patisserie:|^ice:/.test(n.props.value)); }
  function current() { return nodes(tree).find(n => n.type === 'a' && n.props['aria-current'] === 'page').props.href; }
  async function respond(index, message = `read-${index}`) {
    requests[index].resolve({ ok: true, json: async () => ({ records: [], cashRecords: [], dailyRecords: [], cashDeposits: [], storage: { status: 'seed', message } }) });
    await new Promise(resolve => setImmediate(resolve)); settle();
  }
  settle();
  return { settle, nodes: () => nodes(tree), text: () => text(tree), button, location, current, browser, requests, historyWrites, reloads: () => reloads, respond, dispose: () => effects.forEach(effect => effect.cleanup?.()), pop(href) { browser.location = new URL(href, browser.location); listeners.get('popstate')?.(); settle(); } };
}
test('the selected day and shop persist during a data-only reload, including navigation while the request is pending', async () => {
  const h = harness(`${route}?date=2026-10-30&shop=Lent&kind=patisserie`);
  assert(h.current().includes('date=2026-10-30')); assert.equal(h.location().props.value, 'patisserie:Lent');
  assert.equal(h.historyWrites.length, 0, 'mount must not replace a saved date with today');
  await h.respond(0);
  h.button('Volgende week').props.onClick(); h.settle();
  h.nodes().find(n => n.type === 'button' && n.key === '2026-11-03').props.onClick(); h.settle();
  h.location().props.onChange({ target: { value: 'patisserie:Daalseweg' } }); h.settle();
  assert(h.current().includes('date=2026-11-03')); assert(h.current().includes('shop=Daalseweg'));
  const refresh = h.button('Opnieuw ophalen'); assert(refresh); assert.equal(refresh.props.disabled, false);
  refresh.props.onClick(); h.settle();
  assert.equal(h.requests.length, 2); assert.equal(h.reloads(), 0);
  assert.equal(h.button('Bezig met ophalen…').props.disabled, true);
  for (const request of h.requests) { assert.equal(request.url, '/api/management-revenue'); assert.equal(request.options.cache, 'no-store'); assert.equal(request.options.method, undefined); }
  h.nodes().find(n => n.type === 'button' && n.key === '2026-11-04').props.onClick(); h.settle();
  await h.respond(1, 'Nieuwe daggegevens ontvangen');
  assert(h.text().includes('Nieuwe daggegevens ontvangen')); assert(h.current().includes('date=2026-11-04'));
  assert.equal(h.location().props.value, 'patisserie:Daalseweg'); assert.equal(h.button('Opnieuw ophalen').props.disabled, false);
  const reloaded = harness(h.browser.location.href);
  assert(reloaded.current().includes('date=2026-11-04')); assert.equal(reloaded.location().props.value, 'patisserie:Daalseweg');
  h.dispose(); reloaded.dispose();
});
test('browser history restores the selection without refetching or reverting to the current week', async () => {
  const h = harness(`${route}?date=2026-10-30&shop=Lent&kind=ice`); await h.respond(0);
  assert.equal(h.location().props.value, 'ice:Lent');
  h.pop(`${route}?date=2025-12-31&shop=Heyendaal&kind=patisserie`);
  assert(h.current().includes('date=2025-12-31')); assert.equal(h.location().props.value, 'patisserie:Heyendaal');
  assert.equal(h.requests.length, 1); h.dispose();
});
