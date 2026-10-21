const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const exportsMap = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('app/sinterklaas/letters/online/onlineOrders.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { exports: exportsMap });
const { onlineOrderTotal, filterOnlineOrders, onlineItemLabel } = exportsMap;
function order(overrides = {}) {
  return { id: 'order-1', order_number: 'CL26-001', customer_name: 'Voorbeeldklant', customer_email: 'voorbeeld@example.invalid', phone: '0612345678', notes: '', requested_date: '2026-11-06', pickup_location: 'lent', gift_wrap: true, gift_wrap_price_cents: 25, fulfillment_status: 'NEW', created_at: '', letter_order_items: [{quantity: 4, logo: true, logo_storage_path: 'logo.png', unit_price_cents: 1395, logo_price_cents: 100, letter_products: {letter: 'S', flavour: 'melk', size: 'groot', style: 'spuit'}}], ...overrides };
}
test('overview preserves stored wrapping and logo prices, including historical wrapping fees', () => {
  assert.equal(onlineOrderTotal(order()), 6080);
  assert.equal(onlineOrderTotal(order({ gift_wrap: false })), 5980);
  assert.equal(onlineOrderTotal(order({ gift_wrap_price_cents: 100 })), 6380);
});
test('search/status filtering keeps complete orders and sorts by pickup date without mutating the source', () => {
  const later = order({ id: 'later', requested_date: '2026-12-01', fulfillment_status: 'READY' });
  const earlier = order({ id: 'earlier', requested_date: '2026-11-05' });
  const noDate = order({ id: 'no-date', requested_date: '' });
  const input = [later, noDate, earlier];
  assert.equal(filterOnlineOrders(input, '', '').map(row => row.id).join(','), 'earlier,later,no-date');
  assert.equal(input.map(row => row.id).join(','), 'later,no-date,earlier');
  assert.equal(filterOnlineOrders(input, 'CL26-001', 'READY')[0], later);
  assert.equal(filterOnlineOrders(input, 'niet gevonden', '').length, 0);
  assert.equal(filterOnlineOrders(input, 'VOORBEELD@EXAMPLE.INVALID', '').length, 3);
});
test('letter specifications, logo and array-shaped product relations remain searchable', () => {
  const original = order();
  const item = original.letter_order_items[0];
  assert.match(onlineItemLabel(item), /4 × spuitletter S · melk · groot · foto\/logo/);
  item.letter_products = [{letter: 'M', flavour: 'puur', size: 'klein', style: 'vorm'}];
  assert.match(onlineItemLabel(item), /vormletter M · puur · klein/);
  assert.equal(filterOnlineOrders([original], 'puur', '').length, 1);
});
