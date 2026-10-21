const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
function load(file, imports = {}, globals = {}, expose = '') {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText + expose,
    { exports, console, ...globals, require: name => name in imports ? imports[name] : name === 'react/jsx-runtime' ? require(name) : { default: name } });
  return exports;
}
function nodes(node, predicate) {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap(child => nodes(child, predicate));
  return [...(predicate(node) ? [node] : []), ...nodes(node.props?.children, predicate)];
}
function label(node) {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  return Array.isArray(node) ? node.map(label).join('') : node && typeof node === 'object' ? label(node.props?.children) : '';
}
const pricing = load('app/lib/business-folder-pricing.ts');
const sint = load('app/sint-voor-bedrijven/sintProducts.ts', { '@/app/lib/business-folder-pricing': pricing });
const kerst = load('app/kerst-voor-bedrijven/christmasProducts.ts', { '@/app/lib/business-folder-pricing': pricing });
const letters = load('app/sinterklaas/b2bLetterLines.ts');
function entry(season = 'sint', initialOrder = null) {
  const state = [], refs = [], effects = [], calls = [], updated = [], storage = new Map();
  let cursor = 0, refCursor = 0;
  const loaded = load('app/sinterklaas/b2b/SinterklaasB2BClient.tsx', {
    react: { ...React, useEffect(callback) { effects.push(callback); }, useMemo(callback) { return callback(); },
      useState(initial) { const i = cursor++; if (!(i in state)) state[i] = typeof initial === 'function' ? initial() : initial; return [state[i], next => { state[i] = typeof next === 'function' ? next(state[i]) : next; }]; },
      useRef(initial) { return refs[refCursor++] ||= { current: initial }; } },
    '../../sint-voor-bedrijven/sintProducts': sint, '../../kerst-voor-bedrijven/christmasProducts': kerst, '../../lib/business-folder-pricing': pricing,
    '../b2bLetterLines': letters,
    '../sinterklaasApi': { saveB2BOrder: async data => { calls.push(data); return { ...data, id: 'saved' }; } },
    './B2BOrders.module.css': { default: new Proxy({}, { get: (_, key) => key }) },
  }, { crypto: require('node:crypto').webcrypto, sessionStorage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) }, HTMLInputElement: class {}, HTMLSelectElement: class {}, HTMLTextAreaElement: class {} }, '\nexports.Form = B2BOrderForm;');
  function render() { cursor = refCursor = 0; return loaded.Form({ season, initialOrder, onSaved: order => updated.push(order), onCancel() {} }); }
  render(); effects.splice(0).forEach(effect => effect()); render(); effects.length = 0;
  function field(name) {
    const tree = render();
    return nodes(tree, n => ['input','select','textarea'].includes(n.type) && n.props['aria-label'] === name)[0]
      || nodes(nodes(tree, n => n.type === 'label' && label(n.props.children).startsWith(name))[0], n => ['input','select','textarea'].includes(n.type))[0];
  }
  return { render, calls, updated,
    field(name, value) { const input = field(name); assert.ok(input, `Field: ${name}`); input.props.onChange({ target: { value } }); },
    button(name) { const button = nodes(render(), n => n.type === 'button' && label(n) === name)[0]; assert.ok(button, `Button: ${name}`); const event = { defaultPrevented: false, preventDefault() { this.defaultPrevented = true; } }; button.props.onClick?.(event); return event; },
    step() { return nodes(render(), n => n.props?.['aria-current'] === 'step').map(label)[0]; },
    submit() { return nodes(render(), n => n.type === 'form')[0].props.onSubmit({ preventDefault() {}, currentTarget: { elements: [] } }); },
  };
}
test('Enter and step navigation never save before review, and missing customer stays on the first step', async () => {
  const ui = entry(); await ui.submit();
  assert.match(ui.step(), /Klant & levering/); assert.equal(ui.calls.length, 0);
  assert.ok(nodes(ui.render(), n => n.props?.role === 'alert').length);
  ui.field('Bedrijfsnaam / klantnaam *', 'Voorbeeld BV'); await ui.submit();
  assert.match(ui.step(), /Producten/); assert.equal(ui.calls.length, 0);
  const event = ui.button('Bestelling controleren →'); assert.equal(event.defaultPrevented, true); assert.match(ui.step(), /Controleren/); assert.equal(ui.calls.length, 0);
  assert.equal(nodes(ui.render(), n => n.type === 'button' && label(n) === 'Bestelling opslaan')[0].props.type, 'submit');
});
test('Christmas products, manual prices and customer details survive back/forward navigation and save in the correct season', async () => {
  const ui = entry('kerst');
  ui.field('Bedrijfsnaam / klantnaam *', 'Kerstbedrijf'); ui.field('E-mailadres', 'voorbeeld@example.invalid');
  ui.field('Vaste leverdatum', '2026-12-18'); ui.button('Verder naar producten →');
  // Use the real published catalogue identity and its only variant.
  const product = kerst.christmasProducts[0];
  ui.field('Product', `kerst-${product.id}`); ui.field('Variant', product.detail); ui.field('Aantal producten', '25');
  ui.field('Prijs p.s. excl. btw', '14.25'); ui.button('+ Product toevoegen');
  ui.button('Bestelling controleren →'); ui.button('Vorige stap'); ui.button('Vorige stap');
  assert.ok(nodes(ui.render(), n => n.type === 'input' && n.props.value === 'Kerstbedrijf').length);
  ui.button('Verder naar producten →'); ui.button('Bestelling controleren →');
  await ui.submit(); assert.equal(ui.calls.length, 1); assert.equal(ui.updated.length, 1);
  assert.equal(ui.calls[0].season, 'kerst'); assert.equal(ui.calls[0].customerEmail, 'voorbeeld@example.invalid');
  assert.equal(ui.calls[0].totalExVat, '€ 356,25'); assert.match(ui.calls[0].orderText, /14,25/);
});
test('Sint letter rules retain quantities and pricing when review is revisited', async () => {
  const ui = entry(); ui.field('Bedrijfsnaam / klantnaam *', 'Letterbedrijf'); ui.button('Verder naar producten →');
  ui.field('Letter', 'S'); ui.field('Chocolade', 'melk'); ui.field('Soort', 'spuit'); ui.field('Formaat', 'groot'); ui.field('Aantal letters', '25');
  ui.button('+ Letter toevoegen'); ui.button('Bestelling controleren →'); ui.button('Vorige stap'); ui.button('Bestelling controleren →'); await ui.submit();
  assert.equal(ui.calls.length, 1); assert.equal(ui.calls[0].season, 'sint');
  assert.equal(ui.calls[0].letterLines.length, 1); assert.equal(ui.calls[0].letterLines[0].quantity, 25);
  assert.ok(ui.calls[0].totalExVat); assert.match(ui.calls[0].orderText, /25/);
});
