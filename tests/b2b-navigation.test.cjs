const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');

function nodes(node, predicate) {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap(child => nodes(child, predicate));
  return [...(predicate(node) ? [node] : []), ...nodes(node.props?.children, predicate)];
}
function text(node) {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  return Array.isArray(node) ? node.map(text).join('') : text(node?.props?.children || '');
}
function app(season) {
  const cache = {}, state = [], effects = [], pending = [], pushed = [], writes = [];
  const window = new EventTarget();
  let stateIndex = 0, effectIndex = 0;
  const hooks = { ...React,
    useState(initial) { const i = stateIndex++; if (!(i in state)) state[i] = typeof initial === 'function' ? initial() : initial; return [state[i], next => { state[i] = typeof next === 'function' ? next(state[i]) : next; }]; },
    useMemo(fn) { return fn(); },
    useEffect(fn, deps) { const i = effectIndex++, previous = effects[i]; if (!previous || deps.some((dep, j) => dep !== previous.deps[j])) pending.push(() => { previous?.cleanup?.(); effects[i] = { deps, cleanup: fn() }; }); },
  };
  let fixture;
  function load(file, expose = '') {
    file = path.resolve(file);
    if (cache[file]) return cache[file];
    const exports = cache[file] = {};
    const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
    vm.runInNewContext(source + expose, { exports, console, window, Event, URL, setInterval: () => 1, clearInterval: () => {}, crypto: require('node:crypto').webcrypto, require(name) {
      if (name === 'react') return hooks;
      if (name === 'react/jsx-runtime') return require(name);
      if (name === 'next/navigation') return { usePathname: () => season === 'sint' ? '/sinterklaas/b2b' : '/kerst/b2b', useRouter: () => ({ push: route => pushed.push(route) }) };
      if (name === 'next/link' || name === 'next/image') return { default: name };
      if (name.endsWith('.css')) return { default: new Proxy({}, { get: (_, key) => key }) };
      if (name.endsWith('sinterklaasApi')) return { fetchB2BOrders: async () => [fixture], saveB2BOrder: (...args) => writes.push(args), updateB2BOrder: (...args) => writes.push(args) };
      if (name.startsWith('@/') || name.startsWith('.')) {
        const base = name.startsWith('@/') ? path.resolve(name.slice(2)) : path.resolve(path.dirname(file), name);
        const target = ['.ts', '.tsx'].map(ext => base + ext).find(fs.existsSync);
        if (target) return load(target);
      }
      return require(name);
    } });
    return exports;
  }
  const client = load('app/sinterklaas/b2b/SinterklaasB2BClient.tsx', '\nexports.blank=createFormState;');
  const back = load('app/StrikBackButton.tsx').default;
  fixture = { ...client.blank(), id:'existing', season, year:'2026', customerName:'Voorbeeld BV' };
  function render() { stateIndex = effectIndex = 0; const tree = client.default({ season }); pending.splice(0).forEach(fn => fn()); return tree; }
  function clickBack() { const button = back({}); assert.equal(button.type, 'button'); button.props.onClick(); }
  return { fixture, pushed, writes, render, clickBack,
    async ready() { render(); await Promise.resolve(); await Promise.resolve(); render(); },
  };
}

for (const season of ['sint', 'kerst']) test(`${season}: general back returns from editing and new entry to the filtered B2B overview before leaving the section`, async () => {
  const ui = app(season); await ui.ready();
  let tree = ui.render();
  nodes(tree, node => node.props?.['aria-label'] === 'Zoek klant of product')[0].props.onChange({ target:{value:'Voorbeeld'} });
  nodes(tree, node => node.props?.['aria-label'] === 'Filter status')[0].props.onChange({ target:{value:'aanvraag'} });
  tree = ui.render();
  const row = nodes(tree, node => node.props?.order === ui.fixture && node.props?.onToggle)[0];
  assert.ok(row); row.props.onEdit(ui.fixture);
  tree = ui.render(); assert.ok(nodes(tree, node => node.props?.order === ui.fixture && node.props?.onClose).length);
  ui.clickBack();
  tree = ui.render();
  assert.equal(ui.pushed.length, 0, 'editing must not navigate to the parent menu');
  assert.equal(nodes(tree, node => node.props?.['aria-label'] === 'Zoek klant of product')[0].props.value, 'Voorbeeld');
  assert.equal(nodes(tree, node => node.props?.['aria-label'] === 'Filter status')[0].props.value, 'aanvraag');
  nodes(tree, node => node.type === 'button' && text(node) === '+ Nieuwe bestelling')[0].props.onClick();
  ui.render(); ui.clickBack(); tree = ui.render();
  assert.equal(ui.pushed.length, 0, 'new entry also returns to the overview');
  assert.ok(nodes(tree, node => node.type === 'h1' && text(node) === 'B2B-bestellingen').length);
  ui.clickBack();
  assert.deepEqual(ui.pushed, [season === 'sint' ? '/sinterklaas/bedrijven' : '/kerst'], 'from the overview the parent menu remains accessible');
  assert.equal(ui.writes.length, 0, 'back navigation never saves orders or sends mail');
});
