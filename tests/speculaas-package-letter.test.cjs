const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
function load(file) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports, Buffer, require(name) {
    if (name.startsWith('@/')) return load(`${name.slice(2)}.ts`);
    if (name.startsWith('.')) return load(path.resolve(path.dirname(file), `${name}.ts`));
    return require(name);
  } });
  return exports;
}
const catalog = load('app/sint-voor-bedrijven/sintProducts.ts');
const { buildBusinessFolderQuote } = load('app/lib/businessFolderQuote.ts');
const { businessProductTextParts } = load('app/lib/businessProductPresentation.ts');
const product = catalog.products.find(item => item.id === 'speculaasbrok-met-letter');
const fixture = choice => ({ requestId: 'f1234567-1234-4567-8123-123456789abc', season: 'sint', company: 'Voorbeeld BV', email: 'test@example.invalid', delivery: { method: 'pickup', momentType: 'date', date: '2026-11-23' }, selection: { lines: [{ productId: product.id, quantity: 60, choice }] } });
test('all four package variants offer A–Z without changing price or losing almond/size selection', () => {
  for (const variant of product.variants) {
    const oldPrice = catalog.pricedProduct(product, variant.label).retailPriceIncl;
    for (const letter of catalog.PACKAGE_LETTERS) {
      const choice = catalog.productChoiceWithLetter(product, variant.label, letter);
      assert.ok(catalog.productChoiceCandidates(product).includes(choice));
      assert.equal(catalog.productVariantChoice(product, choice), variant.label);
      assert.equal(catalog.productLetterChoice(product, choice), letter);
      assert.equal(catalog.pricedProduct(product, choice).retailPriceIncl, oldPrice);
    }
  }
});
test('the chosen letter survives server validation, stored selection and quote text without a price surcharge', () => {
  const variant = product.variants[3].label;
  const legacy = buildBusinessFolderQuote(fixture(variant));
  const quote = buildBusinessFolderQuote(fixture(catalog.productChoiceWithLetter(product, variant, 'M')));
  assert.match(quote.quoteText, /grote spuitletter · letter M/);
  assert.match(quote.order.orderText, /letter M/);
  assert.equal(quote.snapshot.selection[0].choice, `${variant} · letter M`);
  assert.equal(quote.order.totalExVat, legacy.order.totalExVat);
  assert.notEqual(quote.payloadHash, legacy.payloadHash);
  for (const invalid of ['AB', '1', '<script>', 'm']) assert.throws(() => buildBusinessFolderQuote(fixture(`${variant} · letter ${invalid}`)), /productuitvoering/);
});
test('older requests keep their original selection and default S, including a Sidcon-style request', () => {
  const variant = product.variants[0].label;
  const input = fixture(variant); input.company = 'Sidcon Milieutechniek B.V.';
  const original = JSON.stringify(input);
  const quote = buildBusinessFolderQuote(input);
  assert.equal(JSON.stringify(input), original);
  assert.equal(quote.snapshot.selection[0].choice, variant);
  assert.equal(catalog.productLetterChoice(product, variant), 'S');
  assert.match(quote.quoteText, /letter S/);
  const oldText = `60 × Speculaasbrok met letter · ${variant}\n  € 11,50 p.s. excl. btw`;
  const parts = businessProductTextParts(oldText);
  assert.match(parts.map(part => part.text).join(''), /letter S/);
  assert.equal(parts.filter(part => part.product?.id === product.id).length, 1);
  assert.equal(oldText.includes('letter S'), false);
});
test('new package letters are never overwritten with S in product presentation', () => {
  for (const letter of ['A', 'M', 'S', 'Z']) {
    const text = `60 × ${product.name} · ${catalog.productChoiceWithLetter(product, product.variants[0].label, letter)}`;
    assert.equal(businessProductTextParts(text).map(part => part.text).join(''), text);
  }
});
test('product hints identify known Sint and Christmas products, leaving unrelated text intact', () => {
  const text = '20 × Speculaas bites Snackbox · 3 × Kerststol klein · eigen afspraak';
  const parts = businessProductTextParts(text);
  assert.equal(parts.map(part => part.text).join(''), text);
  assert.equal(parts.filter(part => part.product).length, 2);
  assert.ok(parts.filter(part => part.product).every(part => part.product.image.startsWith('/')));
  const unknown = 'Handmatig product, instructies voor de klant';
  assert.equal(businessProductTextParts(unknown).map(part => part.text).join(''), unknown);
  assert.equal(businessProductTextParts('Speculaas bites Snackboxen').filter(part => part.product).length, 0);
});

test('photo previews open on hover, close on leaving and stay open after a touch/click until toggled', () => {
  const React = require('react');
  const states = [], refs = []; let stateIndex = 0, refIndex = 0;
  const hooks = { ...React, useEffect() {}, useId: () => 'photo-test', useRef(value) { return refs[refIndex++] ||= { current: value }; }, useState(value) { const at = stateIndex++; if (!(at in states)) states[at] = value; return [states[at], next => { states[at] = typeof next === 'function' ? next(states[at]) : next; }]; } };
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync('app/sinterklaas/b2b/B2BProductText.tsx', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(code + '\nexports.Photo = ProductPhotoHint;', { exports, Node: class {}, window: { innerWidth: 390, innerHeight: 844 }, document: { body: {} }, require(name) {
    if (name === 'react') return hooks;
    if (name === 'react/jsx-runtime') return require(name);
    if (name === 'react-dom') return { createPortal: node => node };
    return { default: {} };
  } });
  const render = () => { stateIndex = refIndex = 0; return exports.Photo({ product: { id: product.id, name: product.name, image: product.image } }); };
  let tree = render(); refs[0].current = { getBoundingClientRect: () => ({ left: 180, top: 300, bottom: 324, width: 24 }) };
  tree.props.onMouseEnter(); tree = render(); assert.equal(tree.props.children[0].props['aria-expanded'], true);
  tree.props.onMouseLeave({ relatedTarget: null }); tree = render(); assert.equal(tree.props.children[0].props['aria-expanded'], false);
  let stopped = false; tree.props.children[0].props.onClick({ stopPropagation() { stopped = true; } });
  tree = render(); tree.props.onMouseLeave({ relatedTarget: null }); tree = render();
  assert.equal(stopped, true); assert.equal(tree.props.children[0].props['aria-expanded'], true);
  tree.props.children[0].props.onClick({ stopPropagation() {} }); tree = render(); assert.equal(tree.props.children[0].props['aria-expanded'], false);
});
