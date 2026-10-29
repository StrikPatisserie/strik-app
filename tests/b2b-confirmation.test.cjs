const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
function load(file, imports = {}, globals = {}) {
  const exports = {};
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(source, { exports, URL, Error, ...globals, require(name) { return name in imports ? imports[name] : name === 'react/jsx-runtime' ? require(name) : {}; } });
  return exports;
}
function find(node, predicate) {
  if (!node || typeof node !== 'object') return undefined;
  if (Array.isArray(node)) return node.map(child => find(child, predicate)).find(Boolean);
  return predicate(node) ? node : find(node.props?.children, predicate);
}
function order(overrides = {}) {
  return { id: 'example', status: 'akkoord', season: 'kerst', customerName: 'Voorbeeld BV', customerEmail: 'sanne@example.invalid', orderText: '25 kerststollen', totalExVat: '347,50', deliveryDate: '2026-12-18', deliveryDateEnd: '', confirmationEmailedAt: '2026-10-21T10:00:00+02:00', confirmationEmailError: '', confirmationMail: { version: 'v1', backupVersion: 'b1' }, ...overrides };
}
function dialog(initial = order(), sendResponse, mode = 'confirmation', updatedOrder = false) {
  const states = [], refs = [], effects = [];
  let cursor = 0, refCursor = 0, effectCursor = 0, closed = 0;
  const pendingEffects = [], calls = [], updates = [];
  let latest = initial;
  const loaded = load('app/sinterklaas/b2b/B2BConfirmationDialog.tsx', {
    react: { ...React,
      useState(value) { const index = cursor++; if (!(index in states)) states[index] = typeof value === 'function' ? value() : value; return [states[index], next => { states[index] = typeof next === 'function' ? next(states[index]) : next; }]; },
      useRef(value) { return refs[refCursor++] ||= { current: value }; },
      useEffect(callback, deps) { const index = effectCursor++; if (!effects[index] || deps.some((dep, i) => dep !== effects[index][i])) { effects[index] = deps; pendingEffects.push(callback); } },
    },
    '../sinterklaasApi': {
      previewB2BCustomerConfirmation: async id => { calls.push({ kind: 'preview', id }); return { order: latest, html: '<html><body>Geteste bevestiging</body></html>' }; },
      sendB2BCustomerConfirmation: async (id, version) => { calls.push({ kind: 'send', id, version }); return sendResponse ? await sendResponse(latest) : { ...latest, confirmationMail: { ...latest.confirmationMail, customer: { version, state: 'sent', email: latest.customerEmail, sentAt: 'now', error: '' } } }; },
      retryB2BConfirmation: async id => { calls.push({ kind: 'backup', id }); return latest; },
      previewB2BCustomerQuotation: async id => { calls.push({kind:'quote-preview',id});return {order:latest,html:'<html><body>Geteste offerte</body></html>',subject:'Offerte Strik'}; },
      sendB2BCustomerQuotation: async (id,version) => { calls.push({kind:'quote-send',id,version});return sendResponse ? await sendResponse(latest) : {...latest,quotationMail:{...latest.quotationMail,customer:{version,state:'sent',email:latest.customerEmail,sentAt:'2026-10-27T13:00:00+01:00',error:''}}}; },
    },
  }, { document: { activeElement: null }, HTMLElement: class {} });
  return {
    ...loaded, calls, updates,
    render() { cursor = refCursor = effectCursor = 0; return loaded.default({ order: initial, mode, updatedOrder, onClose() { closed++; }, onEdit() {}, onUpdated(next) { updates.push(next); } }); },
    async flush() { while (pendingEffects.length) pendingEffects.shift()(); await new Promise(setImmediate); },
    setLatest(next) { latest = next; }, get closed() { return closed; },
  };
}
const pure = load('app/sinterklaas/b2b/B2BConfirmationDialog.tsx');
test('a final transition or changed customer version offers the popup; private saves and cancellations do not', () => {
  assert.equal(pure.shouldOfferCustomerConfirmation(order(), order({ status: 'aanvraag' })), true);
  assert.equal(pure.shouldOfferCustomerConfirmation(order(), null), true);
  assert.equal(pure.shouldOfferCustomerConfirmation(order(), order()), false);
  assert.equal(pure.shouldOfferCustomerConfirmation(order({ confirmationMail: { version: 'v2' } }), order()), true);
  assert.equal(pure.shouldOfferCustomerConfirmation(order({ cancelled: true }), order({ status: 'aanvraag' })), false);
  assert.equal(pure.shouldOfferCustomerConfirmation(order({ status: 'offerte' }), null), false);
});
test('opening or declining the popup only reads a preview, and the email iframe is sandboxed', async () => {
  const ui = dialog(); ui.render(); await ui.flush();
  assert.equal(ui.calls.length, 1); assert.equal(ui.calls[0].kind, 'preview');
  find(ui.render(), node => node.type === 'button' && node.props['aria-expanded'] !== undefined).props.onClick();
  assert.equal(find(ui.render(), node => node.type === 'iframe').props.sandbox, '');
  find(ui.render(), node => node.type === 'button' && node.props.children === 'Nu niet').props.onClick();
  assert.equal(ui.closed, 1); assert.equal(ui.calls.filter(call => call.kind === 'send').length, 0);
});
test('the explicit send uses the reviewed version and guards rapid double clicks', async () => {
  const ui = dialog(); ui.render(); await ui.flush();
  const send = find(ui.render(), node => node.type === 'button' && node.props.children === 'Ja, mail de klant →');
  assert.equal(send.props.disabled, false); send.props.onClick(); send.props.onClick(); await ui.flush();
  assert.equal(ui.calls.filter(call => call.kind === 'send').length, 1);
  assert.equal(ui.calls.find(call => call.kind === 'send').version, 'v1');
  assert.equal(pure.customerConfirmationSent(ui.updates[0]), true);
  assert.equal(find(ui.render(), node => node.type === 'button' && node.props.children === 'Ja, mail de klant →'), undefined);
});
test('failed sends stay visible and retry keeps the exact version without sending a separate backup request', async () => {
  const ui = dialog(order(), async () => { throw new Error('Verbinding verbroken'); }); ui.render(); await ui.flush();
  for (let attempt = 0; attempt < 2; attempt++) {
    if(attempt) { find(ui.render(),node=>node.type==='button' && node.props.children==='Gegevens en mailvoorbeeld opnieuw ophalen').props.onClick();ui.render();await ui.flush(); }
    find(ui.render(), node => node.type === 'button' && node.props.children === 'Ja, mail de klant →').props.onClick(); await ui.flush();
    assert.ok(find(ui.render(), node => node.props?.role === 'alert'));
    assert.equal(find(ui.render(),node=>node.type==='button' && node.props.children==='Ja, mail de klant →').props.disabled,true);
  }
  assert.deepEqual(ui.calls.filter(call => call.kind === 'send').map(call => call.version), ['v1', 'v1']);
  assert.equal(ui.calls.filter(call => call.kind === 'backup').length, 0);
});
test('missing recipient and uncertain sends cannot mail; an older successful version does not hide a revision', async () => {
  for (const initial of [order({ customerEmail: '' }), order({ confirmationMail: { version: 'v1', customer: { version: 'v1', state: 'sending', sentAt: '', error: 'Controleer de mailbox' } } })]) {
    const ui = dialog(initial); ui.render(); await ui.flush();
    assert.equal(find(ui.render(), node => node.type === 'button' && node.props.children === 'Ja, mail de klant →').props.disabled, true);
  }
  const older = order({ confirmationMail: { version: 'v2', customer: { version: 'v1', state: 'sent', sentAt: 'yesterday' } } });
  assert.equal(pure.customerConfirmationSent(older), false);
});
test('the API reads the preview and sends only an order ID and reviewed version, never a replacement email or order body', async () => {
  const calls = [];
  const api = load('app/sinterklaas/sinterklaasApi.ts', {}, { fetch: async (url, options) => {
    const body = JSON.parse(options.body); calls.push(body);
    return { ok: true, json: async () => body.previewCustomerConfirmation ? { order: order(), html: '<html>preview</html>' } : order() };
  } });
  const preview = await api.previewB2BCustomerConfirmation('example');
  assert.equal(preview.order.confirmationMail.version, 'v1');
  await api.sendB2BCustomerConfirmation('example', 'v1');
  assert.deepEqual(calls, [{ id: 'example', previewCustomerConfirmation: true }, { id: 'example', sendCustomerConfirmation: true, confirmationVersion: 'v1' }]);
});

function quoteOrder(overrides={}) {return order({status:'offerte',quotationMail:{version:'q1'},...overrides});}
test('inquiries and quotations have their own preview, open status and explicit send without a final backup',async()=>{
 for(const stage of ['aanvraag','offerte']) {
  const ui=dialog(quoteOrder({status:stage}),undefined,'quotation');ui.render();await ui.flush();
  assert.equal(ui.calls.length,1);assert.equal(ui.calls[0].kind,'quote-preview');
  assert.equal(find(ui.render(),n=>n.type==='iframe').props.sandbox,'');
  assert.equal(find(ui.render(),n=>n.type==='button'&&n.props.children==='Back-up opnieuw proberen'),undefined);
  const send=()=>find(ui.render(),n=>n.type==='button'&&n.props.children===`Mail ${stage} →`);
  assert.equal(send().props.disabled,false);const button=send();button.props.onClick();button.props.onClick();await ui.flush();
  assert.equal(ui.calls.filter(c=>c.kind==='quote-send').length,1);assert.equal(ui.updates[0].status,stage);assert.equal(pure.customerQuotationSent(ui.updates[0]),true);
  assert.equal(ui.calls.filter(c=>c.kind==='send'||c.kind==='backup').length,0);
 }
});
test('declining the offer mail sends nothing, and quote history never suppresses the definitive confirmation',async()=>{
 const ui=dialog(quoteOrder(),undefined,'quotation');ui.render();await ui.flush();
 find(ui.render(),n=>n.type==='button'&&n.props['aria-label']==='Bevestigingsvenster sluiten').props.onClick();assert.equal(ui.closed,1);assert.equal(ui.calls.length,1);
 const sent=quoteOrder({quotationMail:{version:'q1',customer:{version:'q1',state:'sent',sentAt:'2026-10-27T12:00:00+01:00'}}});
 assert.equal(pure.customerQuotationSent(sent),true);assert.equal(pure.customerConfirmationSent(sent),false);
 assert.equal(pure.customerQuotationSent({...sent,quotationMail:{...sent.quotationMail,version:'q2'}}),false);
 for(const blocked of [{status:'akkoord'},{status:'afgewezen'},{cancelled:true},{id:'historie-one'}]) assert.equal(pure.canMailQuotation(quoteOrder(blocked)),false);
});
test('changed stages, missing email and uncertain quotation delivery disable sending',async()=>{
 for(const latest of [quoteOrder({status:'akkoord'}),quoteOrder({customerEmail:''}),quoteOrder({quotationMail:{version:'q1',customer:{version:'q1',state:'sending',sentAt:'',error:'Mailbox controleren'}}})]){
  const ui=dialog(quoteOrder(),undefined,'quotation');ui.setLatest(latest);ui.render();await ui.flush();
  const button=find(ui.render(),n=>n.type==='button'&&/^Mail /.test(n.props.children));assert.equal(button.props.disabled,true);button.props.onClick();await ui.flush();assert.equal(ui.calls.filter(c=>c.kind==='quote-send').length,0);
 }
});
test('quotation API uses only saved ID and reviewed quote version, retaining separate receipt fields',async()=>{
 const calls=[];
 const api=load('app/sinterklaas/sinterklaasApi.ts',{}, {fetch:async(url,options)=>{const body=JSON.parse(options.body);calls.push(body);return {ok:true,json:async()=>body.previewCustomerQuotation?{order:quoteOrder(),html:'<html>offerte</html>',subject:'Offerte Strik'}:quoteOrder({quotationMail:{version:'q1',customer:{version:'q1',state:'sent',email:'sanne@example.invalid',sentAt:'2026-10-27',error:''}}})};}});
 const preview=await api.previewB2BCustomerQuotation('example');assert.equal(preview.order.quotationMail.version,'q1');assert.equal(preview.subject,'Offerte Strik');
 const sent=await api.sendB2BCustomerQuotation('example','q1');assert.equal(sent.quotationMail.customer.state,'sent');
 assert.deepEqual(calls,[{id:'example',previewCustomerQuotation:true},{id:'example',sendCustomerQuotation:true,quotationVersion:'q1'}]);
});

function approvalDialog(latest, failure) {
  const states = [], refs = [], depsSeen = [], effects = [], calls = [];
  let cursor = 0, refCursor = 0, effectCursor = 0, closed = 0;
  const loaded = load('app/sinterklaas/b2b/B2BApprovalDialog.tsx', {
    react: { ...React,
      useState(value) { const i=cursor++; if (!(i in states)) states[i]=typeof value==='function'?value():value; return [states[i],next=>{ states[i]=typeof next==='function'?next(states[i]):next; }]; },
      useRef(value) { return refs[refCursor++] ||= {current:value}; },
      useEffect(callback,deps) { const i=effectCursor++; if (!depsSeen[i] || deps.some((dep,j)=>dep!==depsSeen[i][j])) { depsSeen[i]=deps; effects.push(callback); } },
    },
    '../sinterklaasApi': { fetchB2BOrders: async () => { calls.push({kind:'read'}); if (failure) throw new Error(failure); return [latest]; } },
    '../../lib/businessSeasons': load('app/lib/businessSeasons.ts'),
    './B2BOrders.module.css': { default: new Proxy({}, {get:(_,key)=>key}) },
  }, { document: { documentElement: {style:{overflow:''}} } });
  const initial = {...latest, orderText:'Old order', totalExVat:'1.00'};
  return { calls, get closed(){return closed;},
    render() { cursor=refCursor=effectCursor=0; return loaded.default({order:initial, productText:o=>o.orderText, totalLabel:o=>o.totalExVat, onClose(){closed++;}, onEdit(){}, onApprove:async o=>{calls.push({kind:'approve',order:o});} }); },
    async flush(){while(effects.length) effects.shift()(); await new Promise(setImmediate);},
  };
}
function inquiry(overrides={}) {return order({status:'aanvraag',year:'2026',department:'bakkerij',letterLines:[],cancelled:false,...overrides});}
test('quick approval reads the current saved order, requires a double-check and prevents double clicks',async()=>{
  const latest=inquiry({orderText:'60 speculaaspakketten · letter S',totalExVat:'690.60'});
  const ui=approvalDialog(latest); ui.render(); await ui.flush();
  const button=()=>find(ui.render(),n=>n.type==='button'&&n.props.children==='Ja, maak definitief');
  assert.equal(button().props.disabled,true); button().props.onClick(); await ui.flush();
  assert.equal(ui.calls.filter(c=>c.kind==='approve').length,0);
  assert.ok(JSON.stringify(ui.render()).includes('60 speculaaspakketten'));
  find(ui.render(),n=>n.type==='input'&&n.props.type==='checkbox').props.onChange({target:{checked:true}});
  assert.equal(button().props.disabled,false);
  const action=button(); action.props.onClick(); action.props.onClick(); await ui.flush();
  assert.equal(ui.calls.filter(c=>c.kind==='approve').length,1);
  assert.equal(ui.calls.find(c=>c.kind==='approve').order,latest);
});
test('declining approval, a missing delivery date and a failed refresh never approve or mail',async()=>{
  const ui=approvalDialog(inquiry()); ui.render(); await ui.flush();
  find(ui.render(),n=>n.type==='button'&&n.props.children==='Annuleren').props.onClick();
  assert.equal(ui.closed,1); assert.equal(ui.calls.length,1); assert.equal(ui.calls[0].kind,'read');
  for(const candidate of [approvalDialog(inquiry({deliveryDate:''})),approvalDialog(inquiry(),'Connection unavailable'),approvalDialog(inquiry({status:'akkoord'}))]) {
    candidate.render(); await candidate.flush();
    assert.equal(find(candidate.render(),n=>n.type==='button'&&n.props.children==='Ja, maak definitief').props.disabled,true);
    assert.ok(find(candidate.render(),n=>n.props?.role==='alert'));
    assert.equal(candidate.calls.filter(c=>c.kind==='approve').length,0);
  }
});

test('changed final orders offer a new confirmation for legacy metadata and previously skipped revisions', () => {
  const changed = order({ confirmationMail: { version: 'v2', customer: { version: 'v1', state: 'sent', sentAt: '2026-10-20T10:00:00Z' } } });
  assert.equal(pure.customerConfirmationNeedsUpdate(changed), true);
  assert.equal(pure.shouldOfferCustomerConfirmation(changed, changed), true);
  assert.equal(pure.shouldOfferCustomerConfirmation(order(), order({ confirmationMail: undefined })), true);
  const sent = order({ confirmationMail: { version: 'v2', customer: { version: 'v2', state: 'sent', sentAt: '2026-10-29T10:00:00Z' } } });
  assert.equal(pure.customerConfirmationNeedsUpdate(sent), false);
  assert.equal(pure.shouldOfferCustomerConfirmation(sent, changed), false);
});
test('an updated final order opens the current preview and mails only after the explicit updated-confirmation choice', async () => {
  const changed=order({confirmationMail:{version:'v2',customer:{version:'v1',state:'sent',sentAt:'2026-10-20T10:00:00Z'}}});
  const ui=dialog(changed);ui.render();await ui.flush();
  assert.equal(find(ui.render(),n=>n.type==='h2').props.children,'Gewijzigde bevestiging mailen?');
  assert.ok(find(ui.render(),n=>n.type==='iframe'));
  assert.equal(ui.calls.filter(call=>call.kind==='send').length,0);
  find(ui.render(),n=>n.type==='button'&&n.props.children==='Ja, mail gewijzigde bevestiging →').props.onClick();await ui.flush();
  assert.equal(ui.calls.filter(call=>call.kind==='send').length,1);assert.equal(ui.calls.find(call=>call.kind==='send').version,'v2');
  assert.equal(pure.customerConfirmationSent(ui.updates[0]),true);
});
test('the save context labels a changed definitive order even if its first customer mail has not yet been sent', async () => {
  const ui=dialog(order(),undefined,'confirmation',true);ui.render();await ui.flush();
  assert.equal(find(ui.render(),n=>n.type==='h2').props.children,'Gewijzigde bevestiging mailen?');
  assert.ok(find(ui.render(),n=>n.type==='iframe'));
  find(ui.render(),n=>n.type==='button'&&n.props.children==='Nu niet').props.onClick();
  assert.equal(ui.calls.filter(call=>call.kind==='send').length,0);
});
