const { test } = require('node:test');
const assert = require('node:assert/strict');
const ts = require('typescript');
const fs = require('node:fs');
const vm = require('node:vm');
const exportsForTest = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('app/lib/businessDeliveryPricing.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports: exportsForTest });
const { businessDeliveryRate: rate, businessDeliveryQuote: quote, businessDeliveryLine: line, splitBusinessDeliveryPrice: split, businessAddressPostcode: address, isBusinessDelivery } = exportsForTest;
const automatic = postcode => ({ postcode, mode: 'automatic', manualIncl: '' });

test('all supplied postcode ranges include both boundaries and retain the supplied inclusive prices', () => {
  const expected = [[6511,6514,9.95],[6516,6542,9.95],[6601,6605,14.95],[6561,6562,16.95],[6641,6642,11.95],[6573,6573,11.95],[6571,6572,11.95],[6581,6581,6.95],[6582,6582,10],[6663,6663,12],[6515,6515,16.95],[6543,6560,13.95],[6563,6564,13.95],[6574,6574,11.95],[6584,6585,11.95]];
  for (const [from,to,incl] of expected) {
    for (const prefix of [from,to]) assert.equal(rate(`${prefix}ab`).amountIncl, incl, String(prefix));
  }
  assert.equal(rate('1011 AB').amountIncl, 10);
  assert.equal(rate('6583').amountIncl, 10);
  assert.equal(rate('6606').label, 'Standaardtarief');
  for (const invalid of ['', '651', '0651 AA', '65111', '6511 A', 'Nijmegen']) assert.equal(rate(invalid), null, invalid);
});

test('address postcodes, manual zero, invalid prices and pickup are handled without guessing or adding surcharges', () => {
  assert.equal(address('Voorbeeldstraat 18\n6511ab Nijmegen'), '6511 AB');
  assert.equal(address('Voorbeeldstraat 6511'), '');
  assert.equal(quote(automatic(''), 'Bezorgen', '6511 AB Nijmegen').amountIncl, 9.95);
  assert.equal(quote(automatic('fout'), 'Bezorgen', '6511 AB Nijmegen').amountIncl, null, 'an invalid explicit postcode must not silently use a different one');
  assert.equal(quote({ ...automatic('6511'), mode: 'manual', manualIncl: '0' }, 'Bezorgen').amountIncl, 0);
  assert.equal(quote({ ...automatic('6511'), mode: 'manual', manualIncl: '12,50' }, 'Bezorgen').amountEx, 11.47);
  for (const value of ['', '-1', 'NaN', '10,001', '1.2.3', '10001']) assert.equal(quote({ ...automatic('6511'), mode:'manual', manualIncl:value }, 'Bezorgen').amountIncl, null);
  assert.equal(quote(automatic('6511'), 'Afhalen bij Strik').amountIncl, 0);
  assert.equal(line(automatic('6511'), 'Afhalen bij Strik'), '');
  assert.equal(isBusinessDelivery('Afhalen of bezorgen nog af te stemmen'), false);
  assert.equal(quote({ ...automatic('6511'), mode:'unpriced' }, 'Bezorgen').amountIncl, null);
});

test('the existing order text contract preserves the exact inclusive charge, without duplication or consuming notes', () => {
  for (const pricing of [automatic('6511 ab'), { ...automatic(''), mode:'manual', manualIncl:'0' }, { ...automatic('6601'), mode:'manual', manualIncl:'12,50' }]) {
    const serialized = line(pricing, 'Bezorgen');
    const text = `PRODUCTEN EN PRIJS\n25 × Testproduct · € 10,00 p.s. ex btw · € 250,00\n${serialized}\nOVERIGE ORDERAFSPRAKEN\nEigen afspraak`;
    const parsed = split(text);
    assert.equal(parsed.charge.amountIncl, quote(pricing,'Bezorgen').amountIncl);
    assert.equal(parsed.charge.pricing.mode, pricing.mode);
    assert.equal(parsed.text.includes('Bezorgkosten'), false);
    assert.ok(parsed.text.endsWith('Eigen afspraak'));
    assert.equal(line(parsed.charge.pricing,'Bezorgen'), serialized);
    assert.equal(split(parsed.text).charge, null);
    assert.equal(split(`OVERIGE ORDERAFSPRAKEN\n${serialized}`).text, `OVERIGE ORDERAFSPRAKEN\n${serialized}`);
    const duplicate = `PRODUCTEN EN PRIJS\n${serialized}\n${serialized}`;
    assert.equal(split(duplicate).text, duplicate, 'ambiguous original data stays intact');
  }
});
