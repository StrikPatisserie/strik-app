const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const jsx = require('react/jsx-runtime');

function nodes(tree) {
 if (!tree || typeof tree !== 'object') return [];
 if (Array.isArray(tree)) return tree.flatMap(nodes);
 return [tree, ...nodes(tree.props?.children)];
}
function text(tree) {
 if (typeof tree === 'string' || typeof tree === 'number') return String(tree);
 if (Array.isArray(tree)) return tree.map(text).join('');
 return tree?.props ? text(tree.props.children) : '';
}
function find(tree, predicate) {
 const found = nodes(tree).find(predicate);
 assert(found, 'Expected archive control');
 return found;
}
function refresh(tree) {
 return find(tree, node => node.type === 'button' && node.props['aria-label'] === 'Weekarchief verversen');
}

function harness() {
 const slots = [], effects = [], calls = [];
 let cursor = 0, pending = [], stateWrites = 0;
 const sameDependencies = (first, second) => first?.length === second?.length && first.every((value, index) => Object.is(value, second[index]));
 const react = {
  useState(initial) {
   const index = cursor++;
   if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
   return [slots[index], value => {
    stateWrites++;
    slots[index] = typeof value === 'function' ? value(slots[index]) : value;
   }];
  },
  useCallback(callback, dependencies) {
   const index = cursor++;
   if (!sameDependencies(slots[index]?.dependencies, dependencies)) slots[index] = { callback, dependencies };
   return slots[index].callback;
  },
  useRef(initial) {
   const index = cursor++;
   if (!(index in slots)) slots[index] = { current: initial };
   return slots[index];
  },
  useEffect(effect, dependencies) {
   const index = cursor++;
   if (!sameDependencies(effects[index]?.dependencies, dependencies)) pending.push(() => {
    effects[index]?.cleanup?.();
    effects[index] = { dependencies, cleanup: effect() };
   });
  },
 };
 const exports = {};
 const imports = {
  react,
  'react/jsx-runtime': jsx,
  './weekArchive.module.css': { __esModule: true, default: new Proxy({}, { get: (_, key) => key }) },
 };
 const source = ts.transpileModule(fs.readFileSync('app/productie/ProductionWeekArchive.tsx', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
 }).outputText;
 vm.runInNewContext(source, {
  exports,
  require(name) { assert(name in imports, `Unmocked import ${name}`); return imports[name]; },
  AbortController,
  Error,
  encodeURIComponent,
  fetch(url, options) {
   return new Promise((resolve, reject) => calls.push({ url, options, resolve, reject }));
  },
 });
 return {
  calls,
  get stateWrites() { return stateWrites; },
  render() {
   cursor = 0; pending = [];
   const tree = exports.default();
   pending.forEach(effect => effect());
   return tree;
  },
  async respond(index, body, status = 200) {
   calls[index].resolve(Response.json(body, { status }));
   await new Promise(setImmediate);
  },
  async reject(index) {
   calls[index].reject(new Error('Verbinding verbroken'));
   await new Promise(setImmediate);
  },
  unmount() { effects.forEach(effect => effect?.cleanup?.()); },
 };
}

const week = {
 weekStart: '2026-11-02', weekEnd: '2026-11-08', label: 'Week 45 · 2 t/m 8 november 2026',
 capturedAt: '2026-11-07T23:00:00Z', taskCount: 18, doneCount: 15, mailStatus: 'sent',
};
const data = weeks => ({ weeks, enabledFromWeek: '2026-11-02' });

test('the archive reads only its private relative endpoint with no caching and shows the empty state', async () => {
 const h = harness(); h.render();
 const loading = h.render();
 assert.equal(h.calls.length, 1);
 assert.equal(h.calls[0].url, '/api/productie/weekarchief');
 assert.equal(h.calls[0].options.cache, 'no-store');
 assert.equal(h.calls[0].options.method, undefined);
 assert(h.calls[0].options.signal instanceof AbortSignal);
 assert.equal(refresh(loading).props.disabled, true);
 assert.equal(text(find(loading, node => node.props?.role === 'status')), 'Weekarchief laden…');
 await h.respond(0, data([]));
 const empty = h.render();
 assert(text(empty).includes('De eerste kopie verschijnt na de eerstvolgende zaterdag.'));
 assert.equal(refresh(empty).props.disabled, false);
 assert(!nodes(empty).some(node => node.type === 'a' || node.props?.role === 'alert'));
 h.unmount();
});

test('week labels, totals and mail status render with encoded same-origin download links', async () => {
 const h = harness(); h.render();
 const pendingWeek = { ...week, weekStart: '2026-11-09/extra?format=evil#', label: 'Week 46', mailStatus: 'pending' };
 const checkingWeek = { ...week, weekStart: '2026-11-16', label: 'Week 47', mailStatus: 'checking' };
 await h.respond(0, data([week, pendingWeek, checkingWeek]));
 const tree = h.render();
 const articles = nodes(tree).filter(node => node.type === 'article');
 assert.equal(articles.length, 3);
 assert(text(articles[0]).includes(week.label));
 assert(text(articles[0]).includes('15/18 taken afgerond · Gemaild'));
 assert(text(articles[1]).includes('Mail wordt verwerkt'));
 assert(text(articles[2]).includes('Verzending controleren'));
 for (const [index, entry] of [week, pendingWeek, checkingWeek].entries()) {
  const links = nodes(articles[index]).filter(node => node.type === 'a');
  assert.deepEqual(links.map(text), ['Recap', 'Excel', 'Back-up']);
  for (const [linkIndex, format] of ['html', 'csv', 'json'].entries()) {
   const link = links[linkIndex];
   assert.equal(link.props.href, `/api/productie/weekarchief/${encodeURIComponent(entry.weekStart)}?format=${format}`);
   assert.equal(new URL(link.props.href, 'https://app.invalid').origin, 'https://app.invalid');
  }
  assert.equal(links[0].props.target, '_blank');
  assert.equal(links[0].props.rel, 'noopener noreferrer');
  assert.equal(links[1].props.download, true);
  assert.equal(links[2].props.download, true);
 }
 h.unmount();
});

test('a failed read can be retried and a failed refresh retains the last available archive', async () => {
 const h = harness(); h.render();
 await h.respond(0, { message: 'Geen toegang tot weekarchief.' }, 403);
 let tree = h.render();
 assert.equal(text(find(tree, node => node.props?.role === 'alert')), 'Geen toegang tot weekarchief.');
 assert.equal(refresh(tree).props.disabled, false);
 refresh(tree).props.onClick();
 assert.equal(h.calls.length, 2);
 assert.equal(h.calls[1].url, '/api/productie/weekarchief');
 assert.equal(h.calls[1].options.cache, 'no-store');
 await h.respond(1, data([week]));
 tree = h.render();
 assert(!nodes(tree).some(node => node.props?.role === 'alert'));
 refresh(tree).props.onClick();
 const refreshing = h.render();
 assert.equal(refresh(refreshing).props.disabled, true);
 assert(text(refreshing).includes(week.label));
 await h.respond(2, {}, 503);
 tree = h.render();
 assert.equal(text(find(tree, node => node.props?.role === 'alert')), 'Weekarchief laden mislukt.');
 assert(text(tree).includes(week.label));
 assert.equal(refresh(tree).props.disabled, false);
 h.unmount();
});

test('unmount aborts the initial request and ignores its late result or error', async () => {
 for (const failure of [false, true]) {
  const h = harness(); h.render();
  const signal = h.calls[0].options.signal;
  h.unmount();
  assert.equal(signal.aborted, true);
  const before = h.stateWrites;
  if (failure) await h.reject(0);
  else await h.respond(0, data([week]));
  assert.equal(h.stateWrites, before);
 }
});

test('unmount also prevents an in-flight manual refresh from updating state', async () => {
 const h = harness(); h.render();
 await h.respond(0, data([week]));
 refresh(h.render()).props.onClick();
 assert.equal(h.calls.length, 2);
 h.unmount();
 assert.equal(h.calls[1].options.signal.aborted, true);
 const before = h.stateWrites;
 await h.respond(1, data([]));
 assert.equal(h.stateWrites, before);
});
