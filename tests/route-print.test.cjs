const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, imports = {}, globals = {}, expose = '') {
  const exports = {};
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(source + '\n' + expose, { exports, require: name => imports[name] || {}, URL, Intl, Date, ...globals });
  return exports;
}
const dashboard = 'app/bakkerij/logistiek/BakkerijLogistiekDashboard.tsx';
const stop = (label, id) => ({ id, sourceId: id, label, detail: 'Voorbeeldstraat 1, Nijmegen', badges: [] });
function routeInput() {
  return { plan: { date: '2026-10-20' }, routeGroup: { vehicle: 'Bus A', routes: [
    { id: 'r1', title: 'Ronde 1', departure: '08:05', badge: '6 stops', load: '6 stops', stops: ['Heyendaal vers', 'Vermaat Radboud', 'Daalseweg vers', 'Sint Maartenskliniek Corner', 'Sint Maartenskliniek Rondeel', 'Radboud Universiteit'].map((name, i) => stop(name, 's' + i)) },
    { id: 'r2', title: 'Ronde 2', departure: '10:38', badge: '4 stops', load: '4 stops', stops: ['Heyendaal houdbaar', 'IJs Heyendaal', 'Daalseweg houdbaar', 'IJs Daalseweg'].map((name, i) => stop(name, 't' + i)) },
  ] } };
}
const { render } = load(dashboard, {}, {}, 'exports.render = createBusRoutePrintHtml;');
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
