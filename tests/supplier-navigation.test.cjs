const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const jsx = require('react/jsx-runtime');

function load(file, imports = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText, {
    exports,
    require(name) { assert(name in imports, `Unmocked ${name}`); return imports[name]; },
  });
  return exports;
}

const model = load('app/leveranciers/model.ts');
const nodes = tree => !tree || typeof tree !== 'object' ? [] : Array.isArray(tree) ? tree.flatMap(nodes) : [tree, ...nodes(tree.props?.children)];
const text = tree => Array.isArray(tree) ? tree.map(text).join('') : tree?.props ? text(tree.props.children) : tree == null ? '' : String(tree);

function harness(hefePath) {
  const slots = [];
  let index = 0;
  const same = (a, b) => a?.length === b?.length && a.every((value, i) => Object.is(value, b[i]));
  const slot = initial => { const i = index++; if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial; return i; };
  const react = {
    useState(initial) { const i = slot(initial); return [slots[i], next => { slots[i] = typeof next === 'function' ? next(slots[i]) : next; }]; },
    useRef(value) { return slots[slot(() => ({ current: value }))]; },
    useCallback(fn, deps) { const state = slots[slot(() => ({ fn, deps }))]; if (!same(state.deps, deps)) Object.assign(state, { fn, deps }); return state.fn; },
    useEffect(fn, deps) { const state = slots[slot(() => ({ deps: undefined }))]; if (!same(state.deps, deps)) { state.deps = deps; fn(); } },
  };
  const Component = load('app/leveranciers/Suppliers.tsx', {
    react,
    'react/jsx-runtime': jsx,
    'next/link': { __esModule: true, default: 'a' },
    '../productie/OperationalDialog': { __esModule: true, default: 'supplier-dialog' },
    '../productie/ProductionIcon': { __esModule: true, default: 'supplier-icon' },
    './model': model,
    './suppliers.module.css': { __esModule: true, default: new Proxy({}, { get: (_, key) => key }) },
  }).default;
  const requests = [];
  const request = async body => {
    requests.push(body);
    // Include a legacy Hefe URL: navigation must never fall back to it.
    return { revision: 1, suppliers: model.supplierViews({ revision: 1, suppliers: model.defaultSuppliers }).map(supplier => supplier.id === 'hefe' ? { ...supplier, url: 'https://legacy-hefe.example.invalid/' } : supplier) };
  };
  return { requests, render() { index = 0; return Component({ hefePath, request }); } };
}

test('supplier navigation keeps Hefe private to an explicit order-page link, without an external fallback or login controls', async () => {
  for (const hefePath of [undefined, model.HEFE_ORDER_PATH]) {
    const h = harness(hefePath);
    h.render();
    await new Promise(resolve => setImmediate(resolve));
    const tree = h.render();
    const links = nodes(tree).filter(node => node.type === 'a');
    const cards = nodes(tree).filter(node => node.type === 'article');
    for (const name of ['Beko', 'Zeelandia', 'Vipam']) {
      assert(links.some(link => text(link) === name), `${name} remains available`);
      assert(nodes(tree).some(node => node.type === 'button' && node.props['aria-label'] === `Inlog ${name}`));
    }
    assert(!links.some(link => link.props.href === 'https://legacy-hefe.example.invalid/'));
    assert(!links.some(link => text(link) === 'Webshop'));
    assert(!nodes(tree).some(node => node.type === 'button' && node.props['aria-label'] === 'Inlog Hefe'));
    if (hefePath) {
      const hefeLink = links.find(link => text(link) === 'Hefe');
      assert(hefeLink);
      assert.equal(hefeLink.props.href, model.HEFE_ORDER_PATH);
      assert.equal(hefeLink.props.target, undefined);
      assert.equal(cards.length, 4);
    } else {
      assert(!links.some(link => text(link) === 'Hefe'));
      assert(!cards.some(card => text(card).includes('Hefe')));
      assert.equal(cards.length, 3);
    }
    assert.deepEqual(h.requests, [undefined], 'rendering navigation only reads supplier data');
  }
});
