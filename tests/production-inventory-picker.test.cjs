const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const jsx = require('react/jsx-runtime');

function load(file, imports = {}, globals = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText, {
    exports, require: name => { assert(name in imports, `Unmocked ${name}`); return imports[name]; }, Date, Intl, Map, Set,
    crypto: { randomUUID: () => 'inventory-picker-action' },
    setInterval: () => 1, clearInterval() {}, ...globals,
  });
  return exports;
}
const planning = load('app/productie/planning.ts');
const nodes = tree => !tree || typeof tree !== 'object' ? [] : Array.isArray(tree) ? tree.flatMap(nodes) : [tree, ...nodes(tree.props?.children)];
const text = tree => typeof tree === 'string' || typeof tree === 'number' ? String(tree) : Array.isArray(tree) ? tree.map(text).join('') : tree?.props ? text(tree.props.children) : '';
function find(tree, predicate) { const node = nodes(tree).find(predicate); assert(node, 'Expected inventory picker control'); return node; }

function harness(article = 'A101') {
  const records = new Map(), requests = [];
  let current, index, effects;
  const slot = initial => { const key = index++; if (!(key in current)) current[key] = typeof initial === 'function' ? initial() : initial; return key; };
  const react = {
    useId: () => 'inventory-article',
    useRef: value => current[slot(() => ({ current: value }))],
    useState(initial) { const key = slot(initial), store = current; return [store[key], value => { store[key] = typeof value === 'function' ? value(store[key]) : value; }]; },
    useCallback(callback, dependencies) {
      const key = slot(() => ({ dependencies: undefined }));
      const previous = current[key].dependencies;
      if (!previous || previous.length !== dependencies.length || previous.some((value, position) => !Object.is(value, dependencies[position]))) current[key] = { dependencies, callback };
      return current[key].callback;
    },
    useMemo: callback => callback(),
    useEffect(callback, dependencies) {
      const key = slot(() => ({ dependencies: undefined }));
      const previous = current[key].dependencies;
      if (!previous || previous.length !== dependencies.length || previous.some((value, position) => !Object.is(value, dependencies[position]))) {
        current[key].dependencies = dependencies; effects.push(callback);
      }
    },
  };
  const css = { __esModule: true, default: new Proxy({}, { get: (_, key) => key }) };
  const icon = { __esModule: true, default: () => null };
  const Choice = load('app/productie/SearchableChoice.tsx', { react, 'react/jsx-runtime': jsx, './planning': planning, './ProductionIcon': icon, './SearchableChoice.module.css': css }).default;
  const Inventory = load('app/productie/ProductionInventory.tsx', {
    react, 'react/jsx-runtime': jsx, './planning': planning, './ProductionIcon': icon, './inventory.module.css': css,
    './OperationalDialog': { __esModule: true, default: () => null }, './SearchableChoice': { __esModule: true, default: Choice },
  }, { FormData: class { constructor(values) { this.values = values; } get(key) { return this.values[key] ?? null; } } }).default;
  const data = {
    revision: 3, asOf: '2026-11-07', sourceFrom: null, sourceUntil: null, history: [],
    articles: [{ article: 'A101', description: 'Vanillemousse 1 kg' }, { article: 'A102', description: 'Vanillemousse 1 kg' }, { article: 'B200', description: 'Citroencrème 500 gram' }],
    rows: [{ itemId: 'mousse', name: 'Vanillemousse', unit: 'kg', departmentId: 'dessert', latest: null, count: null, made: 0, issued: null, balance: null, known: false, checkpoint: false, productionWeek: null, link: { article, factor: 1, leadDays: 1 } }],
  };
  const request = async body => { if (body) requests.push(body); return data; };
  function render(Component, props) {
    if (!records.has(Component)) records.set(Component, []);
    current = records.get(Component); index = 0; effects = [];
    const tree = Component(props);
    const pending = effects; pending.forEach(effect => effect());
    return tree;
  }
  const inventory = () => render(Inventory, { request });
  const choice = tree => render(Choice, find(tree, node => node.type === Choice).props);
  async function open() {
    inventory(); await new Promise(resolve => setImmediate(resolve));
    const tree = inventory();
    find(tree, node => node.props?.['aria-label'] === 'Artikel koppelen Vanillemousse').props.onClick();
    return inventory();
  }
  async function submit(articleId) {
    const tree = inventory();
    find(tree, node => node.type === 'form').props.onSubmit({ preventDefault() {}, currentTarget: { article: articleId, factor: '0,5', leadDays: '3' } });
    await Promise.resolve();
  }
  return { open, inventory, choice, requests, submit };
}

test('inventory article search matches description, unit text and exact article tokens while submitting its canonical ID', async () => {
  const h = harness(); let tree = await h.open(), picker = h.choice(tree);
  assert.equal(find(picker, node => node.props?.name === 'article').props.value, 'A101');
  find(picker, node => node.props?.role === 'combobox').props.onChange({ target: { value: '102 MOUSSE kg' } });
  tree = h.inventory(); picker = h.choice(tree);
  const options = nodes(picker).filter(node => node.props?.role === 'option');
  assert.equal(options.length, 1); assert(text(options[0]).includes('Artikel A102'));
  options[0].props.onClick(); tree = h.inventory(); picker = h.choice(tree);
  const selectedId = find(picker, node => node.props?.name === 'article').props.value;
  assert.equal(selectedId, 'A102'); assert.equal(find(picker, node => node.props?.role === 'combobox').props.value, 'Vanillemousse 1 kg');
  assert(text(tree).includes('Gekozen artikel A102'));
  await h.submit(selectedId);
  assert.equal(h.requests.length, 1); assert.equal(h.requests[0].command.article, 'A102'); assert.equal(h.requests[0].command.factor, .5); assert.equal(h.requests[0].command.leadDays, 3);
});

test('an article outside the recent source remains explicit and clearing preserves the existing unlink command', async () => {
  const h = harness('OLDER-999'); let tree = await h.open(), picker = h.choice(tree);
  assert.equal(find(picker, node => node.props?.name === 'article').props.value, 'OLDER-999');
  assert.match(find(picker, node => node.props?.role === 'combobox').props.value, /Ontbrekende koppeling \(OLDER-999\)/);
  find(picker, node => node.props?.['aria-label'] === 'Artikelkoppeling wissen').props.onClick();
  tree = h.inventory(); picker = h.choice(tree);
  const clearedId = find(picker, node => node.props?.name === 'article').props.value;
  assert.equal(clearedId, ''); await h.submit(clearedId); assert.equal(h.requests[0].command.article, '');
});
