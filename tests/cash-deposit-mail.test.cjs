const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const crypto = require('node:crypto');
const ts = require('typescript');
function load(file, dependencies = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports, Date, Intl, Map, Set, Number, process: { env: {} }, require(name) { assert.ok(name in dependencies, name); return dependencies[name]; } });
  return exports;
}
const builder = load('app/lib/cashDepositMail.ts');
const entry = (overrides = {}) => ({ key: 'patisserie-42-lent', year: 2026, week: 42, weekLabel: '12 t/m 18 oktober', shop: 'Lent', label: 'Patisserie Lent', kind: 'patisserie', amount: 1200.1, ...overrides });
const date = new Date('2026-10-21T22:30:00Z');
const readable = value => value.replace(/\s/g, ' ');
function route(result = { sent: [true], skipped: [], failed: [] }) {
  const messages = [];
  const endpoint = load('app/api/management-revenue/cash-deposit-mail/route.ts', {
    'node:crypto': crypto,
    'next/server': { NextResponse: { json: (body, options) => Response.json(body, options) } },
    '@/app/lib/cashDepositMail': builder,
    '@/app/strik-agenda/personnelMailOrders': { sendPersonnelMailOrders: async orders => { messages.push(...orders); return result; } },
  });
  return { messages, post: input => endpoint.POST(new Request('https://app.strik-patisserie.nl/api/management-revenue/cash-deposit-mail', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) })) };
}
test('selected patisserie and ice deposits appear together and split, per shop, week and overall', () => {
  const result = builder.createCashDepositMail([entry(), entry({ kind: 'ice', amount: 300.2 }), entry({ week: 43, weekLabel: '19 t/m 25 oktober', shop: 'Heyendaal', amount: 500.3 })], date);
  for (const output of [result.body, result.htmlBody]) {
    const text = readable(output);
    for (const amount of ['2.000,60', '1.700,40', '300,20', '1.500,30', '500,30']) assert.ok(text.includes(amount), amount);
    assert.match(text, /Patisserie/); assert.match(text, /IJs/);
    assert.match(text, /Lent/); assert.match(text, /Heyendaal/);
    assert.match(text, /22 oktober 2026/);
  }
  assert.match(result.htmlBody, /background:#244b38/);
  assert.match(result.htmlBody, /Per week en locatie/);
});
test('an unselected category is distinguished from an actual selected zero deposit', () => {
  const onlyIce = builder.createCashDepositMail([entry({ kind: 'ice', amount: 0 })], date);
  assert.match(onlyIce.body, /Patisserie: Niet in deze melding/);
  assert.match(readable(onlyIce.body), /IJs: € 0,00/);
});
test('HTML safely escapes shop names and period labels', () => {
  const result = builder.createCashDepositMail([entry({ shop: '<img src=x onerror=alert(1)>', weekLabel: 'A & B <script>bad</script>' })], date);
  assert.doesNotMatch(result.htmlBody, /<script>|<img src=x/);
  assert.match(result.htmlBody, /&lt;img/);
  assert.match(result.htmlBody, /A &amp; B &lt;script&gt;/);
});
test('a large selection retains the last location and complete total without cutting off the report', () => {
  const entries = Array.from({ length: 80 }, (_, index) => entry({ shop: `Locatie ${index} ${'x'.repeat(60)}`, week: index % 53 + 1, weekLabel: 'x'.repeat(80), amount: 0.1 }));
  const result = builder.createCashDepositMail(entries, date);
  assert.match(result.body, /Locatie 79/); assert.match(result.htmlBody, /Locatie 79/);
  assert.match(readable(result.body), /TOTAAL GESTORT: € 8,00/);
  assert.ok(result.body.length < 40000); assert.ok(result.htmlBody.length < 300000);
});
test('the deposit route keeps administration as recipient, adds Eva as cc and supplies the HTML report', async () => {
  const app = route();
  const response = await app.post({ entries: [entry(), entry({ key: 'ice-42-lent', kind: 'ice', amount: 300.2 })] });
  assert.equal(response.status, 200); assert.equal(app.messages.length, 1);
  const order = app.messages[0];
  assert.equal(JSON.stringify(order.recipients), JSON.stringify(['administratie@strik-banket.nl']));
  assert.equal(JSON.stringify(order.ccRecipients), JSON.stringify(['eva@strik-patisserie.nl']));
  assert.match(order.htmlBody, /TOTAAL GESTORT/); assert.match(readable(order.body), /1.500,30/);
  assert.equal(order.mailType, 'cash-deposit-summary');
  assert.match(order.id, /^cash-deposit-report-[a-f0-9]{12}$/);
});
test('legacy week reports also use the green layout and Eva cc; incomplete reports send nothing', async () => {
  const app = route();
  const input = { year: 2026, week: 42, weekLabel: '12 t/m 18 oktober', rows: [{ shop: 'Lent', expectedCount: 7, checkedCount: 7, missingCount: 0, depositAmount: 600.5 }] };
  const response = await app.post(input);
  assert.equal(response.status, 200); assert.equal(app.messages.length, 1);
  assert.equal(app.messages[0].ccRecipients[0], 'eva@strik-patisserie.nl');
  assert.match(app.messages[0].htmlBody, /background:#244b38/);
  const incomplete = route();
  const denied = await incomplete.post({ ...input, rows: [{ ...input.rows[0], checkedCount: 6, missingCount: 1 }] });
  assert.equal(denied.status, 409); assert.equal(incomplete.messages.length, 0);
});
test('existing duplicate-report handling remains in place', async () => {
  const app = route({ sent: [], skipped: [true], failed: [] });
  const response = await app.post({ entries: [entry()] });
  assert.match((await response.json()).message, /al eerder gemaild/);
});
