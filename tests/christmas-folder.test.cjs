const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, imports = {}, expose = '') {
  const exports = {};
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(source + '\n' + expose, { exports, require: name => imports[name] || {}, crypto: require('node:crypto'), process: { env: {} } });
  return exports;
}
const pricing = load('app/lib/business-folder-pricing.ts');
const catalog = load('app/kerst-voor-bedrijven/christmasProducts.ts', { '@/app/lib/business-folder-pricing': pricing });
const sint = load('app/sint-voor-bedrijven/sintProducts.ts', { '@/app/lib/business-folder-pricing': pricing });

test('Christmas prices agree with the supplied retail prices and all image paths exist on a case-sensitive host', () => {
  assert.deepEqual(Array.from(catalog.christmasProducts, p => p.retailPriceIncl), [15.95, 7.5, 14.95, 8.95, 14.95, 7.95, 9.95, 13.95, 6.95, 4.95, 6.95]);
  const files = fs.readdirSync('public/Kerst');
  for (const src of Object.values(catalog.christmasImages)) assert.ok(files.includes(src.slice('/Kerst/'.length)), src);
  for (const highlight of catalog.christmasHighlights) {
    if (!highlight.story) continue;
    for (const src of [highlight.story.src, highlight.story.poster]) assert.ok(files.includes(src.slice('/Kerst/'.length)), src);
  }
  assert.deepEqual(Array.from(catalog.christmasHighlights, h => h.id), ['stol', 'tulband', 'bonbons']);
});

test('Christmas uses the same Sint price tiers, VAT conversion and five-cent rounding at every boundary', () => {
  const expectedTiers = [[1, 0], [24, 0], [25, 5], [50, 5], [51, 10], [100, 10], [101, 15], [200, 15], [201, 20]];
  for (const [count, discount] of expectedTiers) {
    assert.equal(catalog.christmasTier(count).discountPercent, discount);
    for (const product of catalog.christmasProducts) {
      const discounted = Math.ceil((product.retailPriceIncl * (1 - discount / 100) - Number.EPSILON) * 20) / 20;
      assert.equal(catalog.christmasUnitPrice(product, count, true), discounted);
      assert.equal(catalog.christmasUnitPrice(product, count, false), Math.round((discounted / 1.09 + Number.EPSILON) * 100) / 100);
      for (const vat of [false, true]) assert.equal(catalog.christmasUnitPrice(product, count, vat), sint.productUnitPrice(product, catalog.christmasTier(count), vat));
    }
  }
  // Existing Sint surcharges retain their price, without applying the discount twice.
  assert.equal(sint.productUnitPrice({ retailPriceIncl: 4.95, fixedSurchargeIncl: 2 }, { discountPercent: 20 }, true), 6);
});

test('package amounts are per package and bulk discounts depend on equal packages, without double discounts', () => {
  const contents = { 'stol-klein': 1, kerstkoekjes: 1, kerstchocolade: 3 };
  const original = JSON.stringify(contents);
  const one = catalog.christmasPackage(contents, 1, true);
  assert.equal(one.perPackage, 35.3);
  assert.equal(one.total, 35.3);
  const twentyFive = catalog.christmasPackage(contents, 25, true);
  assert.equal(twentyFive.perPackage, 33.75); // 7.15 + 6.65 + 3 × 6.65, using the Sint rounding per product.
  assert.equal(twentyFive.total, 843.75);
  assert.equal(twentyFive.lines.find(x => x.product.id === 'kerstchocolade').quantity, 3);
  assert.equal(JSON.stringify(contents), original);
  assert.equal(catalog.christmasPackage({ kerstchocolade: 30 }, 1, true).tier.discountPercent, 0);
  for (const vat of [false, true]) {
    const result = catalog.christmasPackage(contents, 201, vat);
    assert.equal(result.perPackage, catalog.roundMoney(result.lines.reduce((sum, line) => sum + line.total, 0)));
    assert.equal(result.total, catalog.roundMoney(result.perPackage * 201));
  }
});

test('clearing a package produces no payable lines; invalid quantities cannot make totals negative or non-finite', () => {
  const empty = catalog.christmasPackage({}, 25, true);
  assert.equal(empty.lines.length, 0);
  assert.equal(empty.total, 0);
  const invalid = catalog.christmasPackage({ 'stol-groot': -4, bonbons: NaN, unknown: 100 }, Infinity, true);
  assert.equal(invalid.total, 0);
  assert.equal(invalid.count, 1);
  assert.equal(catalog.quantity(1.9), 1);
  assert.equal(catalog.quantity(1e9), 9999);
});

const { mergeSignup } = load('app/api/business-folder-signup/route.ts', {}, 'exports.mergeSignup = mergeSignup;');
test('Christmas quotes save the correct season and do not opt customers into marketing without consent', () => {
  const base = { campaign: { customers: [] }, company: 'Test BV', contactName: 'Test', email: 'test@example.test', consentAt: '2026-10-20T12:00:00Z', quote: true, consent: false, season: 'kerst' };
  const lead = mergeSignup(base).customers[0];
  assert.match(lead.notes, /Offerteaanvraag Kerst/);
  assert.equal(lead.recipients[0].doNotEmail, true);
  assert.equal(lead.recipients[0].interests.length, 0);
  const optedIn = mergeSignup({ ...base, consent: true }).customers[0].recipients[0];
  assert.equal(optedIn.consentSource, '/kerst-voor-bedrijven');
  assert.deepEqual(Array.from(optedIn.interests), ['sint', 'kerst']);
  assert.match(mergeSignup({ ...base, season: 'sint' }).customers[0].notes, /Offerteaanvraag Sint/);
});
