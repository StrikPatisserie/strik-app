const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const exportsObject = {};
const source = ts.transpileModule(fs.readFileSync('app/bakkerij/logistiek/BakkerijLogistiekDashboard.tsx','utf8'), {
  compilerOptions: {module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX},
}).outputText;
vm.runInNewContext(source + '\nexports.build=buildPreparationItems; exports.render=createPreparationPrintHtml; exports.sources=preparationSourcesFor;', {
  exports:exportsObject, require:()=>({}), Intl, Date, URL,
});
const {build,render,sources} = exportsObject;
const product = (category='logistiek',articleNumber='20100.686') => ({id:articleNumber,category,articleNumber,articleName:'Red velvet'});
const receipt = (customer,quantity,tags=[],options={}) => ({id:customer,receiptNumber:customer,customer,tags,
  lines:[{quantity:String(quantity),description:'Red velvet',articleNumber:'20100.686'}],...options});
const input = (receipts,category='logistiek') => ({category,items:build(receipts,category,[product(category)]),plan:{date:'2026-10-23'}});
const totalFor = (item,kind) => item.sources.filter(source=>source.kind===kind).reduce((total,source)=>total+source.quantity,0);

test('both preparation lists split customer orders from own-shop stock while retaining the combined total',()=>{
  for(const category of ['bakkerij','logistiek']) {
    const {items}=input([
      receipt('Heyendaalseweg',8,['winkel','intern'],{receiptNumber:'20'}),
      receipt('Winkel Ziekerstraat',6,[],{receiptNumber:'10'}),
      receipt('Lent',3,[],{receiptNumber:'50'}),
      receipt('Klant A',2,[],{receiptNumber:'24001'}),
      receipt('Voorbeeld supermarkt',12,[],{receiptNumber:'102'}),
    ],category);
    assert.equal(items.length,1);
    assert.equal(totalFor(items[0],'besteld'),14);
    assert.equal(totalFor(items[0],'winkel'),17);
    assert.equal(items[0].quantity,31);
  }
});
test('a customer collecting from a shop stays ordered, regardless of the pickup location or delivery notes',()=>{
  const {items}=input([receipt('Klant Jansen',2,['afhalen'],{pickupLocation:'Lent',deliveryAddress:'Winkel Ziekerstraat',customerNote:'Afhalen bij Heyendaalseweg'})]);
  assert.equal(totalFor(items[0],'besteld'),2);
  assert.equal(totalFor(items[0],'winkel'),0);
});
test('article variants, decimal quantities and positive preparation lines retain their existing matching rules',()=>{
  const receipts=[receipt('Klant A','1,5'),receipt('Winkel Lent',2,['winkel']),receipt('Klant B',7,[],{lines:[{quantity:'7',description:'Andere variant',articleNumber:'20100.690'}]}),receipt('Nulbon',0),receipt('Retourbon',-1)];
  const {items}=input(receipts);
  assert.equal(items.length,1);
  assert.equal(items[0].quantity,3.5);
  assert.equal(totalFor(items[0],'besteld'),1.5);
  assert.equal(totalFor(items[0],'winkel'),2);
});
test('receipt sources aggregate inside their category, without merging the two categories',()=>{
  const {items}=input([receipt('Klant A',2),receipt('Klant A',3)]);
  const grouped=sources(items[0]);
  assert.equal(grouped.length,1);
  assert.equal(grouped[0].quantity,5);
  const separated=sources({sources:[...grouped,{...grouped[0],kind:'winkel',quantity:4}]});
  assert.equal(separated.length,2);
});
test('the monochrome print shows separate counts, grouped receipt details and the original total',()=>{
  const html=render(input([receipt('Klant A',2),receipt('Heyendaalseweg',8,['winkel'])]));
  assert.match(html,/>Besteld<\/th>/);
  assert.match(html,/>Winkel-<br>bestellingen<\/th>/);
  assert.match(html,/>Totaal<\/th>/);
  assert.match(html,/<td class="split-quantity">2<\/td>/);
  assert.match(html,/<td class="split-quantity">8<\/td>/);
  assert.match(html,/<td class="quantity">10<\/td>/);
  assert.match(html,/<b>Besteld<\/b><span>2x Klant A/);
  assert.match(html,/<b>Winkelbestellingen<\/b><span>8x Heyendaalseweg/);
  assert.match(html,/break-inside: avoid/);
  assert.match(html,/thead \{ display: table-header-group; \}/);
});
test('all customers remain visible and customer-provided names are escaped in the printable document',()=>{
  const receipts=Array.from({length:12},(_,index)=>receipt(`Klant ${index}`,1));
  receipts.push(receipt('<script>voorbeeld</script> & Co',1));
  const html=render(input(receipts));
  for(let index=0;index<12;index++)assert(html.includes(`1x Klant ${index} · bon`));
  assert.match(html,/&lt;script&gt;voorbeeld&lt;\/script&gt; &amp; Co/);
  assert(!html.includes('<script>voorbeeld</script>'));
  assert.match(html,/<td class="split-quantity empty">0<\/td>/);
});
