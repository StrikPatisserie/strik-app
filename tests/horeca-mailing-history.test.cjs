const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const jsx = require('react/jsx-runtime');

function load(file, imports = {}, globals = {}) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(code, {
    exports, Date, Intl, Map, Set, ...globals,
    require(name) { assert.ok(name in imports, `Unexpected import ${name}`); return imports[name]; },
  });
  return exports;
}
const history = load('app/management/horeca-mailing/mailingHistory.ts');
const mail = (changes = {}) => ({ company: 'Voorbeeld', email: 'team@example.test', subject: 'Nieuwe smaak', sentAt: '2026-11-12T13:20:00+01:00', ...changes });

test('history groups successful logs by Amsterdam day and subject, latest first, without changing the source', () => {
  const source = [mail({sentAt:'2026-11-11T13:20:00+01:00'}), mail(), mail({email:'other@example.test',sentAt:'2026-11-12T13:22:00+01:00'}), mail({subject:'Ander onderwerp',sentAt:'2026-11-12T14:00:00+01:00'})];
  const before = JSON.stringify(source);
  const groups = history.groupMailingHistory(source);
  assert.equal(groups.length, 3);
  assert.equal(groups[0].subject, 'Ander onderwerp');
  assert.equal(groups[1].mailCount, 2);
  assert.equal(groups[1].recipientCount, 2);
  assert.match(history.mailingHistoryLabel(groups[1]), /12 nov 2026, 13:20–13:22 · 2 ontvangers · Nieuwe smaak/);
  assert.equal(JSON.stringify(source), before);
});

test('repeated sends to the same case-insensitive email keep both mail and recipient counts truthful', () => {
  const [group] = history.groupMailingHistory([mail(), mail({email:' TEAM@EXAMPLE.TEST ',sentAt:'2026-11-12T13:20:20+01:00'})]);
  assert.equal(group.mailCount, 2);
  assert.equal(group.recipientCount, 1);
  assert.match(history.mailingHistoryLabel(group), /13:20 · 2 mails naar 1 ontvanger/);
});

test('calendar dates follow Amsterdam across midnight and daylight saving changes', () => {
  const groups = history.groupMailingHistory([mail({sentAt:'2026-11-11T23:30:00Z'}), mail({sentAt:'2026-11-12T00:35:00+01:00',email:'other@example.test'})]);
  assert.equal(groups.length, 1);
  assert.match(history.mailingHistoryLabel(groups[0]), /12 nov 2026, 00:30–00:35/);
  const [summer] = history.groupMailingHistory([mail({sentAt:'2026-07-01T22:05:00Z'})]);
  assert.match(history.mailingHistoryLabel(summer), /2 jul 2026, 00:05/);
});

test('incomplete legacy log rows cannot create fictional sent mails or crash the history', () => {
  const groups = history.groupMailingHistory([null, {}, mail({sentAt:'not-a-date'}), mail({email:''}), mail({subject:''})]);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].mailCount, 1);
  assert.match(history.mailingHistoryLabel(groups[0]), /Zonder onderwerp$/);
});

function nodes(value) {
  if (!value || typeof value !== 'object') return [];
  if (Array.isArray(value)) return value.flatMap(nodes);
  return [value, ...nodes(value.props?.children)];
}
const text = value => {
  if (value == null || typeof value === 'boolean') return '';
  if (typeof value !== 'object') return String(value);
  if (Array.isArray(value)) return value.map(text).join('');
  return text(value.props?.children);
};
const flush = () => new Promise(resolve => setImmediate(resolve));
function harness(fetch) {
  const state = [], effects = [];
  let index = 0, mounted = false;
  const react = {
    useState(initial) {
      const slot = index++;
      if (!(slot in state)) state[slot] = typeof initial === 'function' ? initial() : initial;
      return [state[slot], value => { state[slot] = typeof value === 'function' ? value(state[slot]) : value; }];
    },
    useMemo: fn => fn(),
    useEffect: effect => { if (!mounted) effects.push(effect); },
  };
  const component = load('app/management/horeca-mailing/HorecaMailingPreview.tsx', {
    react, 'react/jsx-runtime': jsx, 'next/image': {__esModule:true, default:()=>null}, './mailingHistory':history,
  }, {fetch});
  return {
    render() { index = 0; const tree = component.default(); mounted = true; return tree; },
    async mount() { this.render(); effects.forEach(effect=>effect()); await flush(); return this.render(); },
  };
}
const customer = {id:'one',company:'Voorbeeld',emails:['one@example.test','two@example.test','three@example.test']};
const draft = {template:'hours',occasion:'christmas',content:{subject:'Nieuw bericht',eyebrow:'Update',title:'Titel',body:'Bericht',price:'',buttonLabel:'',buttonUrl:''}};
const response = (data, ok = true) => ({ok,json:async()=>data});

test('the real screen loads existing history and keeps only confirmed successes after a partial failed campaign', async () => {
  let sent = [mail({subject:'Eerder bericht'})];
  const requests = [];
  const h = harness(async (_url, options) => {
    const method = options.method;
    requests.push(method);
    if (method === 'PATCH') {
      if (requests.filter(value=>value==='PATCH').length===2) return response({message:'Verzending mislukt'}, false);
      sent = [...sent, mail({email:'one@example.test',subject:'Nieuw bericht',sentAt:'2026-11-12T14:00:00+01:00'})];
    }
    return response({customers:[customer],draft,lastSent:sent});
  });
  let tree = await h.mount();
  assert.match(text(tree), /Verzendgeschiedenis.*Eerder bericht/);
  assert.match(text(tree), /1 ontvanger/);
  nodes(tree).find(node=>node.type==='button' && text(node).includes('Controleren & versturen')).props.onClick();
  tree = h.render();
  nodes(tree).find(node=>node.type==='button' && text(node)==='Definitief versturen').props.onClick();
  await flush(); await flush();
  tree = h.render();
  const summary = nodes(tree).find(node=>node.type==='summary');
  assert.match(text(summary), /14:00 · 1 ontvanger · Nieuw bericht/);
  assert.match(text(tree), /1 van 3 mails verstuurd/);
  assert.equal(requests.filter(method=>method==='PATCH').length, 2);
  assert.equal(nodes(tree).find(node=>node.type==='ol').props.children.length, 2);
});

test('empty and unavailable histories are distinguished and log limits stay visible', async () => {
  const empty = harness(async()=>response({lastSent:[]}));
  assert.match(text(await empty.mount()), /nog geen verzending geregistreerd/);
  const failed = harness(async()=>response({message:'Niet bereikbaar'}, false));
  const failedText = text(await failed.mount());
  assert.match(failedText, /Verzendgeschiedenis kon niet worden geladen/);
  assert.doesNotMatch(failedText, /nog geen verzending geregistreerd/);
  const capped = harness(async()=>response({lastSent:Array.from({length:200},(_,i)=>mail({email:`${i}@example.test`}))}));
  assert.match(text(await capped.mount()), /laatste 200 geregistreerde mails/);
});
