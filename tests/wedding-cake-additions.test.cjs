const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');

function load(file, imports = {}, globals = {}, source = fs.readFileSync(file, 'utf8')) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, { exports, ...globals, require: name => imports[name] || require(name) });
  return exports;
}
const data = load('app/bruidstaart-studio/data.ts');
const pricing = load('app/bruidstaart-studio/pricing.ts', { './data': data });
const api = load('app/bruidstaart-studio/studioApi.ts');
const moneyFile = 'app/bruidstaart-studio/WeddingCakeMoneyInput.tsx';
const { parseWeddingCakeAmount } = load(moneyFile);
const example = () => ({
  ...data.initialWeddingCakeConfig,
  styleId: 'naked', sizeId: 'small-6-8',
  contact: { ...data.initialWeddingCakeConfig.contact, recognitionCode: 'TEST-EXTRAS', names: 'Voorbeeldpaar', surname: 'Voorbeeld', email: 'voorbeeld@example.invalid', deliveryDate: '2026-11-06' },
  additionalProducts: [{ id: 'extra-1', description: 'Brownietaartje + red velvet taartje', amount: 44 }],
});

test('extra products add a fixed total once, independent of cake portions, and appear on the production form', () => {
  for (const sizeId of ['small-6-8', 'custom']) {
    const config = { ...example(), sizeId, customCakePersons: 50 };
    const base = pricing.calculateWeddingCakePrice({ ...config, additionalProducts: [] });
    const result = pricing.calculateWeddingCakePrice(config);
    assert.equal(result.total, base.total + 44);
    assert.equal(result.lines.filter(line => line.label.includes('Brownietaartje')).length, 1);
    const form = pricing.createProductionForm(config);
    assert.match(form, /Overige producten & toevoegingen\nBrownietaartje \+ red velvet taartje: €\s44,00/);
    assert.ok(form.includes(pricing.formatEuro(result.total)));
  }
});

test('multiple extras, clearing/removing a line, and older orders calculate without stale charges', () => {
  const config = example();
  const base = pricing.calculateWeddingCakePrice({ ...config, additionalProducts: [] }).total;
  config.additionalProducts.push({ id: 'extra-2', description: 'Extra taartje', amount: 12.50 });
  assert.equal(pricing.calculateWeddingCakePrice(config).total, base + 56.50);
  config.additionalProducts[0].amount = 0;
  assert.equal(pricing.calculateWeddingCakePrice(config).total, base + 12.50);
  config.additionalProducts = [];
  assert.equal(pricing.calculateWeddingCakePrice(config).total, base);
  delete config.additionalProducts;
  assert.equal(pricing.calculateWeddingCakePrice(config).total, base);
});

test('save/load roundtrip preserves extra descriptions and decimals; legacy orders default to no extras', () => {
  const config = example();
  config.additionalProducts[0].amount = 44.50;
  const restored = api.normalizeDraft(JSON.parse(JSON.stringify(api.createDraftFromConfig(config))));
  assert.equal(JSON.stringify(restored.config.additionalProducts), JSON.stringify(config.additionalProducts));
  assert.equal(pricing.calculateWeddingCakePrice(restored.config).total, pricing.calculateWeddingCakePrice(config).total);
  const old = example(); delete old.additionalProducts;
  assert.equal(api.normalizeDraft(api.createDraftFromConfig(old)).config.additionalProducts.length, 0);
});

test('decimal typing retains every comma keystroke while updating the numeric price immediately', () => {
  const state = [];
  let cursor = 0, amount = 0;
  const MoneyInput = load(moneyFile, { react: { ...React, useState(initial) {
    const i = cursor++; if (!(i in state)) state[i] = initial;
    return [state[i], value => { state[i] = value; }];
  } } }).default;
  const render = () => { cursor = 0; return MoneyInput({ value: amount, onValueChange: text => { amount = parseWeddingCakeAmount(text); } }); };
  for (const text of ['4', '44', '44,', '44,5', '44,50']) {
    render().props.onChange({ target: { value: text } });
    assert.equal(render().props.value, text);
  }
  assert.equal(amount, 44.50);
  render().props.onBlur();
  assert.equal(render().props.value, '44,50');
  render().props.onChange({ target: { value: '' } });
  assert.equal(amount, 0); assert.equal(render().props.value, '');
  render().props.onBlur(); amount = 17.25;
  assert.equal(render().props.value, '17,25');
  assert.equal(parseWeddingCakeAmount('€ 1.234,56'), 1234.56);
  assert.equal(parseWeddingCakeAmount('44.50'), 44.50);
  assert.equal(parseWeddingCakeAmount('-5'), 0);
});

// Exercise the actual nested studio mail/payment handlers, with all network
// traffic captured locally so no customer email or payment link is created.
function studioHandlers(config, globals = {}) {
  const file = 'app/bruidstaart-studio/BruidstaartStudioConfigurator.tsx';
  const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const names = ['createMailBody', 'getPaymentDefaultAmount', 'createCustomerPaymentMailBody', 'sendPaymentRequestMail', 'parseEuroInput'];
  const functions = [];
  function visit(node) {
    if (ts.isFunctionDeclaration(node) && names.includes(node.name?.text)) functions.push(node.getText(source));
    ts.forEachChild(node, visit);
  }
  visit(source);
  assert.equal(functions.length, names.length);
  const price = pricing.calculateWeddingCakePrice(config);
  return load(file, {}, {
    ...pricing, config, price, labels: pricing.getSelectedWeddingCakeLabels(config),
    additionalProducts: pricing.getAdditionalProducts(config),
    decorationNoteTexts: [], decorationColorNotes: [], decorationSurcharges: [], topperNoteTexts: [], topperSurcharges: [],
    isCustomCake: false, hasChocolateInitialsTopper: () => false,
    livePriceLabel: pricing.formatEuro(price.total),
    formatDutchShortDate: value => value, formatDutchDateTime: value => value,
    setPaymentRequestStatus() {}, setPaymentRequestSending() {}, ...globals,
  }, functions.join('\n') + '\nObject.assign(exports, {' + names.join(',') + '});');
}

test('order email and payment request include the extras and use the same total as the saved cake', async () => {
  const config = example(), requests = [];
  const expected = pricing.calculateWeddingCakePrice(config).total;
  const handlers = studioHandlers(config, {
    paymentRequestEmail: 'voorbeeld@example.invalid', paymentRequestAmount: expected.toFixed(2).replace('.', ','),
    fetch: async (url, options) => { requests.push({ url, ...JSON.parse(options.body) }); return { ok: true, json: async () => ({ sent: 0 }) }; },
  });
  assert.equal(handlers.getPaymentDefaultAmount(), expected);
  const order = handlers.createMailBody();
  assert.match(order, /Overige producten & toevoegingen\nBrownietaartje \+ red velvet taartje: €\s44,00/);
  await handlers.sendPaymentRequestMail();
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, '/api/bruidstaart-payment-request');
  assert.equal(requests[0].amount, expected);
  assert.match(requests[0].body, /Brownietaartje \+ red velvet taartje: €\s44,00/);
  assert.ok(requests[0].body.includes(pricing.formatEuro(expected)));
});
