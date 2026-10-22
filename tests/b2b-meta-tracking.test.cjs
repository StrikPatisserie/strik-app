const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const requestId = '12345678-1234-4123-8123-123456789abc';
function setup(response = { ok: true, json: async () => ({ ok: true, reference: 'SINT26-123456789ABC' }) }) {
  const store = new Map(), session = new Map(), scripts = [];
  const storage = map => ({ getItem: key => map.get(key) || null, setItem: (key,value) => map.set(key,value) });
  const window = { location: { pathname: '/sint-voor-bedrijven' } };
  const context = { window, localStorage: storage(store), sessionStorage: storage(session), document: { createElement: () => ({}), head: { appendChild: script => scripts.push(script) } }, Date, Set, Error, TypeError, AbortController, setTimeout, clearTimeout, fetch: async () => response };
  function load(file, imports = {}) {
    const exports = {};
    vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText, { ...context, exports, require: name => { assert.ok(name in imports, name); return imports[name]; } });
    return exports;
  }
  const tracking = load('app/lib/b2bMetaTracking.ts');
  const submission = load('app/lib/businessFolderSubmission.ts', { './b2bMetaTracking': tracking });
  return { tracking, submission, window, scripts, store, events: () => window.fbq?.queue.filter(args => args[0] === 'trackSingleCustom') || [] };
}
test('no script, event or retrospective conversion without consent', async () => {
  const app = setup();
  await app.submission.sendBusinessFolderQuote({season:'sint',requestId});
  assert.equal(app.scripts.length,0); assert.equal(app.events().length,0);
  app.tracking.setB2BConsent('granted');
  assert.equal(app.scripts.length,1); assert.equal(app.events().length,0);
});
test('only a confirmed Sint quote fires once, with no form data', async () => {
  const app = setup(); app.tracking.setB2BConsent('granted');
  const payload = {season:'sint',requestId,email:'private@example.com',company:'Private company',wishes:'Private message'};
  await app.submission.sendBusinessFolderQuote(payload);
  await app.submission.sendBusinessFolderQuote(payload);
  assert.equal(app.events().length,1);
  assert.equal(JSON.stringify(app.events()),JSON.stringify([['trackSingleCustom','414315228936451','B2BSintQuoteSubmitted',{folder:'sint',audience:'business'},{eventID:requestId}]]));
  assert.ok(app.window.fbq.queue.some(args => JSON.stringify(args) === JSON.stringify(['set','autoConfig',false,'414315228936451'])));
  assert.equal(app.scripts.length,1);
});
test('failed or unconfirmed responses do not produce a conversion', async () => {
  for (const response of [ {ok:false,json:async()=>({ok:true,reference:'SINT26-123456789ABC'})}, {ok:true,json:async()=>({ok:false})}, {ok:true,json:async()=>({ok:true,reference:'invalid'})} ]) {
    const app = setup(response); app.tracking.setB2BConsent('granted');
    await assert.rejects(app.submission.sendBusinessFolderQuote({season:'sint',requestId}));
    assert.equal(app.events().length,0);
  }
});
test('withdrawal drops queued conversions and prevents further events', () => {
  const app=setup(); app.tracking.setB2BConsent('granted'); app.tracking.trackB2BQuoteSubmitted(requestId);
  app.tracking.setB2BConsent('denied'); app.tracking.trackB2BQuoteSubmitted('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
  assert.equal(app.events().length,0);
  assert.equal(app.tracking.readB2BConsent(),'denied');
});
test('internal routes and kerst quotes are excluded', async () => {
  const app=setup(); app.tracking.setB2BConsent('granted');
  await app.submission.sendBusinessFolderQuote({season:'kerst',requestId});
  app.window.location.pathname='/bakkerij/management'; app.tracking.trackB2BQuoteSubmitted(requestId);
  assert.equal(app.events().length,0);
  const other=setup(); other.window.location.pathname='/bakkerij/management'; other.tracking.setB2BConsent('granted'); assert.equal(other.scripts.length,0);
});
test('expired, invalid or unavailable consent defaults to no consent', () => {
  const app=setup();
  for(const value of ['{}','broken',JSON.stringify({choice:'granted',at:Date.now()-181*86400000})]) { app.store.set(app.tracking.B2B_CONSENT_KEY,value); assert.equal(app.tracking.readB2BConsent(),null); }
});
test('blocked marketing script does not make a successful quote fail', async () => {
  const app=setup(); app.tracking.setB2BConsent('granted'); app.window.fbq.callMethod=()=>{throw new Error('blocked')};
  assert.equal(await app.submission.sendBusinessFolderQuote({season:'sint',requestId}),'SINT26-123456789ABC');
});

test('regrant before script load retains initialisation but not revoked conversions', () => {
  const app=setup(); app.tracking.setB2BConsent('granted'); app.tracking.trackB2BQuoteSubmitted(requestId);
  app.tracking.setB2BConsent('denied'); app.tracking.setB2BConsent('granted');
  assert.equal(app.events().length,0);
  assert.ok(app.window.fbq.queue.some(args=>args[0]==='init'));
  assert.equal(app.scripts.length,1);
});
