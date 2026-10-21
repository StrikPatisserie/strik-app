const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm'), ts = require('typescript');
function load(file, imports = {}, globals = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
    { exports, URL, Request, Response, AbortSignal, ...globals, require: name => imports[name] || {} });
  return exports;
}
const seasons = load('app/lib/businessSeasons.ts');
const model = load('app/lib/businessOrderDeliveries.ts', { './businessSeasons': seasons });
const order = changes => ({ id:'b2b-1', customerName:'Voorbeeld BV', season:'sint', status:'akkoord', entered:false, deliveryDate:'2026-11-23', deliveryWindowType:'date', deliveryDateEnd:'', deliveryMethod:'Bezorgen', deliveryAddress:'Voorbeeldstraat 1', orderText:'25 × Chocoladeletters · € 12,80 p.s.', ...changes });
test('Dagstart remains independent of Bake-it entry and includes tentative orders, while completed/cancelled/pickup orders disappear', () => {
  const values = [order({id:'not-entered'}), order({id:'entered',entered:true}), order({id:'offer',status:'offerte'}), order({id:'inquiry',status:'aanvraag'}), order({id:'cancelled',cancelled:true}), order({id:'delivered',delivered:true}), order({id:'declined',status:'afgewezen'}), order({id:'pickup',deliveryMethod:'Afhalen in Lent',deliveryAddress:''}), order({id:'future',deliveryDate:'2026-12-01'}), order({id:'historie-old'})];
  const result = model.businessDeliveriesForWeek(values, '2026-11-23');
  assert.deepEqual(Array.from(result.orders, x=>x.id).sort(), ['entered','inquiry','not-entered','offer']);
  assert.ok(result.orders.every(x=>x.onSelectedDay));
  assert.equal(model.businessDeliveriesForWeek(values,'2026-10-21').orders.length,0);
});
test('ranges, ISO weeks and legacy delivery markers use the first possible day across months and years', () => {
  const range = model.businessDeliveriesForWeek([order({deliveryDate:'2026-11-16',deliveryDateEnd:'2026-11-30',deliveryWindowType:'range'})], '2026-11-26').orders[0];
  assert.equal(range.start,'2026-11-16'); assert.equal(range.onSelectedDay,true); assert.equal(range.overdue,false);
  const week = model.businessDeliveryWindow(order({deliveryWindowType:'week',deliveryWeek:'2026-W53',deliveryDate:''}));
  assert.equal(week.start,'2026-12-28'); assert.equal(week.end,'2027-01-03');
  assert.equal(model.businessDeliveryWindow(order({deliveryWindowType:'week',deliveryWeek:'2027-W53'})),null);
  assert.equal(model.businessDeliveryWindow(order({sourceSheet:'__STRIK_LEVERPERIODE__range|2026-11-30|'})).end,'2026-11-30');
  assert.equal(model.validBusinessDate('2026-02-30'),false); assert.equal(model.validBusinessDate('2026-11-23T01:00'),false);
});
test('overdue and ambiguous deliveries stay visible rather than being silently treated as collected or delivered', () => {
  const result = model.businessDeliveriesForWeek([order({id:'late',deliveryDate:'2026-11-16'}), order({id:'contradictory',deliveryMethod:'Afhalen in Lent'}), order({id:'unclear',deliveryMethod:'',deliveryAddress:''}), order({id:'old-year',deliveryDate:'2025-11-16'})], '2026-11-23').orders;
  assert.equal(result.length,3); assert.equal(result[0].overdue,true);
  assert.equal(result.find(x=>x.id==='contradictory').deliveryUnclear,true); assert.equal(result.find(x=>x.id==='unclear').deliveryUnclear,true);
});
test('a matching receipt is only a hint and cannot hide B2B orders or match a different delivery day', () => {
  const current = model.businessDeliveriesForWeek([order({})],'2026-11-23').orders[0];
  const receipts = [{customer:'Voorbeeld B.V.',receiptNumber:'60248'}];
  assert.equal(model.possibleBusinessReceipts(current,receipts)[0],'60248');
  assert.equal(model.possibleBusinessReceipts({...current,onSelectedDay:false},receipts).length,0);
  assert.equal(model.businessDeliveriesForWeek([order({entered:true})],'2026-11-23').orders.length,1);
});
test('logistics API checks access before WordPress, returns explicit failures, and exposes only delivery information', async () => {
  let calls=0;
  function api(profile, allowed, ok=true) {
    return load('app/api/bakkerij-logistiek/business-deliveries/route.ts', {
      '@/app/lib/auth/session':{getCurrentProfile:async()=>profile}, '@/app/lib/auth/access':{canAccessPath:(_,path)=>allowed && path.includes('logistiek')}, '@/app/lib/businessOrderDeliveries':model,
    }, { process:{env:{}}, fetch:async()=>{calls++;return Response.json({orders:[order({customerEmail:'private@example.invalid',invoiceInfo:'PRIVATE INVOICE',importantNotes:'PRIVATE NOTE'})]},{status:ok?200:500});} });
  }
  const request=new Request('https://example.invalid/api/bakkerij-logistiek/business-deliveries?date=2026-11-23');
  assert.equal((await api(null,false).GET(request)).status,403); assert.equal(calls,0);
  assert.equal((await api({active:true},false).GET(request)).status,403); assert.equal(calls,0);
  const response=await api({active:true},true).GET(request); const data=await response.json();
  assert.equal(data.orders.length,1); assert.equal(data.canManage.sint,false);
  assert.ok(!JSON.stringify(data).includes('PRIVATE')); assert.ok(!JSON.stringify(data).includes('private@example.invalid'));
  assert.equal((await api({active:true},true,false).GET(request)).status,502);
});
test('scheduled reminders require their cron secret, support a read-only dry run and report failed/uncertain mail as failure', async()=>{
  let calls=0, received;
  function cron(secret, result={sent:0}) {
    return load('app/api/business-order-reminders/route.ts',{}, {process:{env:{CRON_SECRET:secret}},fetch:async(url,options)=>{calls++;received=JSON.parse(options.body);assert.equal(new URL(url).pathname,'/wp-json/strik/v1/business-order-reminders');return Response.json(result);}});
  }
  assert.equal((await cron('').GET(new Request('https://example.invalid/cron'))).status,403);
  assert.equal((await cron('test-secret').GET(new Request('https://example.invalid/cron'))).status,403); assert.equal(calls,0);
  const request=new Request('https://example.invalid/cron?dryRun=1',{headers:{authorization:'Bearer test-secret'}});
  assert.equal((await cron('test-secret').GET(request)).status,200); assert.equal(received.dryRun,true);
  assert.equal((await cron('test-secret',{uncertain:1}).GET(request)).status,502);
});
