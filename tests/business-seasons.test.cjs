const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, imports = {}, expose = '', globals = {}) {
  const exports = {};
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(source + '\n' + expose, { exports, URL, crypto: require('node:crypto'), ...globals, require: name => name in imports ? imports[name] : name === 'react/jsx-runtime' ? require(name) : { default: name } });
  return exports;
}
const pricing = load('app/lib/business-folder-pricing.ts');
const catalog = load('app/kerst-voor-bedrijven/christmasProducts.ts', { '@/app/lib/business-folder-pricing': pricing });
const sint = load('app/sint-voor-bedrijven/sintProducts.ts', { '@/app/lib/business-folder-pricing': pricing });
const seasons = load('app/lib/businessSeasons.ts');
const b2b = load('app/sinterklaas/b2b/SinterklaasB2BClient.tsx', {
  '../../sint-voor-bedrijven/sintProducts': sint,
  '../../kerst-voor-bedrijven/christmasProducts': catalog,
  '../../lib/business-folder-pricing': pricing,
  '../../lib/businessDeliveryPricing': load('app/lib/businessDeliveryPricing.ts'),
}, 'exports.formStateFromOrder = formStateFromOrder; exports.christmasCatalog = CHRISTMAS_CATALOG; exports.reprice = repriceProductLines; exports.serialize = serializeOrderText; exports.parse = parseOrderText;');
const mailing = load('app/sinterklaas/mailing/SinterklaasMailingClient.tsx', { '../../lib/businessSeasons': seasons }, 'exports.defaultsFor = defaultsFor; exports.migrate = migrateCampaign; exports.preview = EmailPreview;');
function collect(node, predicate) {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap(x => collect(x, predicate));
  return [...(predicate(node) ? [node] : []), ...collect(node.props?.children, predicate)];
}
test('Sint and Christmas share one order identity, mixed orders appear in both, and switching routes is explicit', () => {
  assert.equal(seasons.orderBelongsToSeason({ season: 'kerst' }, 'sint'), false);
  assert.equal(seasons.orderBelongsToSeason({ season: 'sint' }, 'kerst'), false);
  for (const season of ['sint', 'kerst']) assert.equal(seasons.orderBelongsToSeason({ season: 'sint-kerst' }, season), true);
  assert.equal(seasons.orderBelongsToSeason({}, 'sint'), true);
  const nav = load('app/BusinessSeasonNav.tsx', { './lib/businessSeasons': seasons });
  const links = collect(nav.default({ season: 'kerst' }), n => n.type === 'next/link');
  assert.deepEqual(links.map(n => n.props.href), ['/sinterklaas/b2b', '/kerst/b2b', '/kerst/mailing']);
  assert.equal(links.find(n => n.props['aria-current'] === 'page').props.href, '/kerst/b2b');
});
test('Christmas entry uses the full Christmas catalogue and the published VAT/staffel prices, without changing Sint', () => {
  assert.equal(b2b.formStateFromOrder(null, 'kerst').department, 'bakkerij');
  assert.equal(b2b.formStateFromOrder(null, 'sint').department, 'chocolade');
  assert.equal(b2b.christmasCatalog.length, 11);
  for (const count of [1, 25, 51, 101, 201]) for (const product of catalog.christmasProducts) {
    const line = { id: 'line', productId: `kerst-${product.id}`, quantity: count, choice: product.detail, unitPriceEx: '', manualPrice: false, withLogo: false, description: '' };
    const priced = b2b.reprice([line])[0];
    assert.equal(Number(priced.unitPriceEx), catalog.christmasUnitPrice(product, count, false));
    const text = b2b.serialize([priced], 'Verpakking in overleg');
    const parsed = b2b.parse(text);
    assert.equal(parsed.productLines[0].productId, line.productId);
    assert.equal(Number(parsed.productLines[0].unitPriceEx), Number(priced.unitPriceEx));
  }
});
test('each newsletter has separate defaults; both folders are visible as distinct links and revisions survive migration', () => {
  const sintDefault = mailing.defaultsFor('sint');
  const kerstDefault = mailing.defaultsFor('kerst');
  const bothDefault = mailing.defaultsFor('sint-kerst');
  assert.match(sintDefault.subject, /Sinterklaas/);
  assert.match(kerstDefault.subject, /Kerst/);
  assert.match(bothDefault.subject, /Sinterklaas en Kerst/);
  assert.equal(kerstDefault.folderUrl, seasons.businessSeasons.kerst.folder);
  const migrated = mailing.migrate({ customers: [], contactsRevision: 18 }, kerstDefault);
  assert.equal(migrated.campaign.contactsRevision, 18);
  assert.equal(migrated.campaign.selection, 'kerst');
  const preview = mailing.preview({ subject: bothDefault.subject, body: bothDefault.body, folderUrl: bothDefault.folderUrl, kerstFolderUrl: bothDefault.kerstFolderUrl, selection: 'sint-kerst' });
  const links = collect(preview, n => n.type === 'a');
  assert.deepEqual(links.map(n => n.props.href), [seasons.businessSeasons.sint.folder, seasons.businessSeasons.kerst.folder]);
});
test('Christmas navigation is on for existing settings while access still requires management or an explicit permission', () => {
  const visibility = load('app/featureVisibility.ts');
  const access = load('app/lib/auth/access.ts');
  assert.equal(visibility.normalizeFeatureVisibilitySettings({ sinterklaasNavigation: true }).kerstNavigation, true);
  assert.equal(visibility.normalizeFeatureVisibilitySettings({ kerstNavigation: false }).kerstNavigation, false);
  assert.equal(visibility.normalizeFeatureVisibilitySettings({ kerstNavigation: false }).ijsNavigation, true);
  const hiddenIce=visibility.normalizeFeatureVisibilitySettings({ijsNavigation:false});
  assert.deepEqual(Array.from(visibility.filterVisibleMainNavigationItems([{href:'/ijs'},{href:'/bakkerij'},{href:'/management'}],hiddenIce),item=>item.href),['/bakkerij','/management']);
  assert.equal(access.canAccessPath({ active: true, role: 'manager' }, '/kerst/b2b'), true);
  assert.equal(access.canAccessPath({ active: true, role: 'winkel', permissions: {} }, '/kerst/mailing'), false);
  assert.equal(access.canAccessPath({ active: true, role: 'bakkerij', permissions: { 'kerst.view': true } }, '/kerst/b2b'), true);
});
