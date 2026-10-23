const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const {renderToStaticMarkup} = require('react-dom/server');

const cache = {};
let existing = [];
function load(file) {
  file=path.resolve(file);
  if(cache[file]) return cache[file];
  const exports=cache[file]={};
  const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  const expose=file.endsWith('SinterklaasB2BClient.tsx')?'\nexports.testDates={formatDate,formatDateTime,compactDeliveryWindow,monthKey,monthLabel,groupByMonth,Row:B2BOrderRow};':'';
  vm.runInNewContext(code+expose,{exports,console,Request,Response,URL,crypto:require('node:crypto').webcrypto,require(name){
    if(name==='server-only')return {};
    if(name==='next/server')return {NextResponse:{json:body=>Response.json(body)}};
    if(name.endsWith('sinterklaasServerApi'))return {proxySinterklaasGet:async()=>Response.json({orders:existing})};
    if(name==='next/image'||name==='next/link')return {default:'a'};
    if(name.endsWith('.css'))return {default:new Proxy({},{get:(_,key)=>key})};
    if(name.startsWith('@/')||name.startsWith('.')) {
      const base=name.startsWith('@/')?path.resolve(name.slice(2)):path.resolve(path.dirname(file),name);
      const target=['.ts','.tsx'].map(ext=>base+ext).find(fs.existsSync);
      if(target)return load(target);
    }
    return require(name);
  }});
  return exports;
}
const dates=load('app/lib/businessDeliveryMoment.ts');
const api=load('app/api/sinterklaas-b2b-orders/route.ts');
const {normalizeB2BOrder}=load('app/sinterklaas/sinterklaasApi.ts');
const ui=load('app/sinterklaas/b2b/SinterklaasB2BClient.tsx').testDates;
const history=[...load('app/api/sinterklaas-mailing/orderHistory.ts').b2bOrderHistory,...load('app/api/sinterklaas-mailing/orderHistoryExtra.ts').b2bOrderHistoryExtra];

test('historical dates require a complete, valid calendar date and never guess ambiguous notations',()=>{
  for(const [raw,year,expected] of [
    ['17-12','2025','2025-12-17'],['16/12','2020','2020-12-16'],['2025-12-17','2025','2025-12-17'],
    ['16-Dec','2023','2023-12-16'],['20-Nov','2022','2022-11-20'],['29-02','2024','2024-02-29'],
    ['17-21','2025',''],['31-11','2025',''],['29-02','2025',''],['2025-02-30','2025',''],
    ['11 dec + 18 dec','2023',''],['11 tot 14 dec','2023',''],['WEEK 50','2023',''],['??','2019',''],
  ])assert.equal(dates.historicalBusinessDeliveryDate(raw,year),expected,raw);
});
test('all archived years load and every historical row renders, preserving unparsed delivery text',async()=>{
  for(const year of new Set(history.map(order=>order.year))) {
    const response=await api.GET(new Request(`https://app.strik-patisserie.nl/api/sinterklaas-b2b-orders?year=${year}`));
    const data=await response.json();
    assert.equal(data.orders.length,history.filter(order=>order.year===year).length);
    const orders=data.orders.map(normalizeB2BOrder);
    for(const [key,group] of ui.groupByMonth(orders)) {
      assert.ok(ui.monthLabel(key));
      for(const order of group) {
        assert.ok(!order.deliveryDate||dates.parseBusinessDate(order.deliveryDate));
        const html=renderToStaticMarkup(React.createElement(ui.Row,{order,updatingId:''}));
        if(order.sourceDeliveryDate)assert.ok(html.includes('Historische notatie'));
      }
    }
    if(year==='2025') {
      const ambiguous=orders.find(order=>order.sourceDeliveryDate==='17-21');
      assert.ok(ambiguous,'the original historical record remains in the list');
      assert.equal(ambiguous.deliveryDate,'');
      assert.equal(ui.compactDeliveryWindow(ambiguous),'17-21');
    }
  }
});
test('malformed dates from other saved orders cannot crash grouping or date/time labels',()=>{
  const fixture=normalizeB2BOrder({id:'saved',customerName:'Voorbeeld',orderText:'20× kruidcake',deliveryDate:'2025-21-17'});
  assert.equal(ui.monthKey(fixture.deliveryDate),'zonder-datum');
  assert.equal(ui.monthLabel('2025-21'),'Zonder datum');
  assert.equal(ui.formatDate(fixture.deliveryDate),'2025-21-17');
  assert.equal(ui.formatDateTime('ongeldig'),'ongeldig');
  assert.equal(ui.compactDeliveryWindow(fixture),'2025-21-17');
  assert.ok(renderToStaticMarkup(React.createElement(ui.Row,{order:fixture,updatingId:''})).includes('Datum controleren'));
  assert.equal(ui.compactDeliveryWindow({...fixture,deliveryDate:'2025-12-17',deliveryWindowType:'range',deliveryDateEnd:'2025-99-20'}),'wo 17-12 t/m 2025-99-20');
});
