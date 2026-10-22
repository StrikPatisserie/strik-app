const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, imports = {}, globals = {}, expose = '') {
  const exports = {};
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(source + '\n' + expose, { exports, require: name => imports[name] || (name === './routePrintPagination' ? load('app/bakkerij/logistiek/routePrintPagination.ts') : {}), URL, Intl, Date, ...globals });
  return exports;
}
const dashboard = 'app/bakkerij/logistiek/BakkerijLogistiekDashboard.tsx';
const stop = (label, id) => ({ id, sourceId: id, label, detail: 'Voorbeeldstraat 1, Nijmegen', badges: [] });
function routeInput() {
  return { plan: { date: '2026-10-20' }, routeGroup: { vehicle: 'Bus A', routes: [
    { id: 'r1', vehicle: 'Bus A', title: 'Ronde 1', departure: '08:05', badge: '6 stops', load: '6 stops', stops: ['Heyendaal vers', 'Vermaat Radboud', 'Daalseweg vers', 'Sint Maartenskliniek Corner', 'Sint Maartenskliniek Rondeel', 'Radboud Universiteit'].map((name, i) => stop(name, 's' + i)) },
    { id: 'r2', vehicle: 'Bus A', title: 'Ronde 2', departure: '10:38', badge: '4 stops', load: '4 stops', stops: ['Heyendaal houdbaar', 'IJs Heyendaal', 'Daalseweg houdbaar', 'IJs Daalseweg'].map((name, i) => stop(name, 't' + i)) },
  ] } };
}
const { render } = load(dashboard, {}, {}, 'exports.render = createBusRoutePrintHtml;');
test('an initial, loading, failed or importing batch never enables route printing', () => {
  const { getRoutePrintBlockedReason } = load('app/bakkerij/logistiek/routePrintWindow.ts');
  for (const state of ['idle', 'loading', 'error']) assert(getRoutePrintBlockedReason(state, false));
  assert(getRoutePrintBlockedReason('ready', true));
  assert(getRoutePrintBlockedReason('ready', false, false), 'Een vorige geladen datum mag niet afgedrukt worden');
  assert.equal(getRoutePrintBlockedReason('ready', false), '');
});
test('screen print buttons stay disabled until the latest order data has loaded', () => {
  const React = require('react');
  const { renderToStaticMarkup } = require('react-dom/server');
  const { Panel } = load(dashboard, { react: React, 'react/jsx-runtime': require('react/jsx-runtime') }, {}, 'exports.Panel = RoutesPanel;');
  const props = { acquisitionMessage: '', acquisitionSuggestions: [], acquisitionUpdatingStopId: '', deletedRouteStopLabel: '', routeCanSave: false, routeSaveMessage: '', routeSaveState: 'idle', routesEdited: false, routeRounds: routeInput().routeGroup.routes, selectedPlan: { date: '2026-10-20' } };
  const blocked = renderToStaticMarkup(React.createElement(Panel, { ...props, routePrintBlockedReason: 'Bestelbonnen laden' }));
  assert.match(blocked, /aria-label="Route printen voor Bus A"[^>]*disabled=""/);
  const ready = renderToStaticMarkup(React.createElement(Panel, { ...props, routePrintBlockedReason: '' }));
  assert.doesNotMatch(ready, /aria-label="Route printen voor Bus A"[^>]*disabled=""/);
});
test('all ten screen stops, including the four business addresses, appear on the route print', () => {
  const input = routeInput();
  const html = render(input);
  assert.equal((html.match(/class="stop-card/g) || []).length, 10);
  assert.match(html, /10 stops totaal/);
  for (const route of input.routeGroup.routes) for (const item of route.stops) assert(html.includes(item.label), item.label);
  assert.match(html, /10 stops afdrukken/);
  assert.match(html, /gemaakt \d{2}:\d{2}/);
});
test('long routes keep every stop and round in their original order across printed pages', () => {
  const input = routeInput();
  input.routeGroup.routes[0].stops = Array.from({ length: 19 }, (_, i) => stop('Adres-' + String(i).padStart(2, '0'), String(i)));
  input.routeGroup.routes.splice(1, 0, { ...input.routeGroup.routes[0], id: 'empty', stops: [] });
  const html = render(input);
  assert.equal((html.match(/class="stop-card/g) || []).length, 23);
  assert.match(html, /23 stops totaal/);
  let previous = -1;
  for (const route of input.routeGroup.routes) for (const item of route.stops) {
    const position = html.indexOf(item.label);
    assert(position > previous, item.label);
    previous = position;
  }
});
test('opening the print captures unsaved screen additions instead of rebuilding a base route', () => {
  let captured;
  const { open } = load(dashboard, { './routePrintWindow': { openRoutePrintWindow: value => { captured = value; } } }, {}, 'exports.open = openBusRouteSheet;');
  const input = routeInput();
  input.routeGroup.routes[1].stops.push(stop('Handmatig toegevoegd & bevestigd', 'manual'));
  open(input.plan, input.routeGroup, '08:25');
  assert.equal(captured.expectedStopCount, 11);
  assert.match(captured.html, /Handmatig toegevoegd &amp; bevestigd/);
  input.routeGroup.routes[0].stops = [];
  assert.equal((captured.html.match(/class="stop-card/g) || []).length, 11);
});
test('iPad print uses a freshly written document and rejects an incomplete document', () => {
  let html = '', closed = false, focused = false;
  const alerts = [];
  const document = { open() { html = ''; }, write(value) { html += value; }, close() {}, querySelectorAll() { return Array.from(html.matchAll(/class="stop-card/g)); } };
  const browser = { open(url) { assert.equal(url, ''); return { document, close() { closed = true; }, focus() { focused = true; } }; }, alert(message) { alerts.push(message); } };
  const { openRoutePrintWindow } = load('app/bakkerij/logistiek/routePrintWindow.ts', {}, { window: browser });
  assert.equal(openRoutePrintWindow({ html: render(routeInput()), expectedStopCount: 10 }), true);
  assert(focused);
  assert.equal(openRoutePrintWindow({ html: '<article class="stop-card"></article>', expectedStopCount: 10 }), false);
  assert(closed);
  assert.match(alerts[0], /niet alle stops/);
});

const { paginateRoutePrint } = load('app/bakkerij/logistiek/routePrintPagination.ts');
function measuredLayout(limit = 1000) {
  const pages = [];
  return {
    pages,
    createPage() { const page = { fragments: [] }; pages.push(page); return page; },
    appendFragment(page, section, continued) { const fragment = { page, section, continued, stops: [] }; page.fragments.push(fragment); return fragment; },
    appendStop(fragment, stop) { const placed = { fragment, stop }; fragment.stops.push(placed); return placed; },
    removeFragment(fragment) { fragment.page.fragments.splice(fragment.page.fragments.indexOf(fragment), 1); },
    removeStop(placed) { placed.fragment.stops.splice(placed.fragment.stops.indexOf(placed), 1); },
    // Header, notes and footer occupy 140px; each round heading 60px. The
    // address height is measured independently instead of counting stops.
    fits(page) { return 140 + page.fragments.reduce((sum, fragment) => sum + 60 + fragment.stops.reduce((sum, placed) => sum + placed.stop.height, 0), 0) <= limit; },
  };
}
const measuredRoute = (heights, id = 'r1') => ({ section: id, stops: heights.map((height, index) => ({ id: `${id}-${index}`, height, detail: `Volledig adres ${index}` })) });
test('the same stop count gets more pages when addresses and extra information need more space', () => {
  const shortLayout = measuredLayout();
  const longLayout = measuredLayout();
  assert.equal(paginateRoutePrint([measuredRoute(Array(10).fill(50))], shortLayout).length, 1);
  assert.equal(paginateRoutePrint([measuredRoute(Array(10).fill(110))], longLayout).length, 2);
  assert(longLayout.pages.every(page => longLayout.fits(page)));
});
test('a round that fits on a fresh page moves there intact instead of splitting', () => {
  const layout = measuredLayout();
  const pages = paginateRoutePrint([measuredRoute([160, 160, 160]), measuredRoute([120, 120, 120], 'r2')], layout);
  assert.equal(pages.length, 2);
  assert.equal(pages[1].fragments.length, 1);
  assert.equal(pages[1].fragments[0].continued, false);
  assert.equal(pages[1].fragments[0].stops.length, 3);
});
test('an oversized round breaks only between complete stops, repeating the round heading and preserving stop order and details', () => {
  const layout = measuredLayout();
  const route = measuredRoute(Array.from({ length: 23 }, (_, index) => index % 3 === 0 ? 140 : 70));
  const pages = paginateRoutePrint([route, measuredRoute([], 'empty')], layout);
  assert(pages.length >= 3);
  assert(pages.every(page => layout.fits(page)));
  assert(pages.slice(1).every(page => page.fragments[0].continued));
  const printed = pages.flatMap(page => page.fragments.flatMap(fragment => fragment.stops.map(placed => placed.stop)));
  assert.equal(printed.length, route.stops.length);
  printed.forEach((item, index) => assert.equal(item, route.stops[index]));
});
test('one exceptionally tall stop blocks printing explicitly instead of dropping or clipping any information', () => {
  assert.throws(() => paginateRoutePrint([measuredRoute([1200])], measuredLayout()), /past niet op één A4/);
});
