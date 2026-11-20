const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ts=require('typescript');
function load(file){
 const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:name=>name.startsWith('.')?load(path.resolve(path.dirname(file),name+'.ts')):require(name)});return exports;
}
const delivery=load('app/sinterklaas/letters/storeLetterDelivery.ts');
const pricing=load('app/lib/businessDeliveryPricing.ts');
const address={address:'Teststraat 12',postcode:'6511 AB',city:'Nijmegen',feeCents:995};
test('delivery minimum excludes postage and accepts exactly 50 euros with a complete address',()=>{
 assert.match(delivery.storeLetterDeliveryError(address,4999),/50,00/);
 assert.equal(delivery.storeLetterDeliveryError(address,5000),'');
 assert.match(delivery.storeLetterDeliveryError({...address,postcode:'6511'},5000),/volledige/);
 assert.match(delivery.storeLetterDeliveryError({...address,address:'Straat'},5000),/huisnummer/);
 assert.match(delivery.storeLetterDeliveryError({...address,city:''},5000),/plaats/);
 assert.equal(delivery.LETTER_DELIVERY_WINDOW,'10:00–14:00');
});
test('store delivery quotes share all B2B boundaries and the same standard fallback; PHP tariffs stay in parity',()=>{
 const php=fs.readFileSync('app/wordpress-snippets/strik-sinterklaas-api.php','utf8');
 const rateBody=php.split('function strik_sinterklaas_letter_delivery_rate')[1].split('function strik_sinterklaas_letter_product_price')[0];
 for(const rate of pricing.BUSINESS_DELIVERY_RATES){
   assert.ok(rateBody.includes(`array(${rate.from},${rate.to},${Math.round(rate.incl*100)})`));
   for(const pc of [rate.from,rate.to]) assert.equal(delivery.storeLetterDeliveryFee(String(pc)),Math.round(pricing.businessDeliveryRate(String(pc)).amountIncl*100));
 }
 assert.equal(delivery.storeLetterDeliveryFee('1000 AA'),1000);
 assert.equal(delivery.storeLetterDeliveryFee('geen'),null);
 assert.equal(delivery.storeLetterDeliveryFee('6511ab'),995);
});
test('legacy orders stay pickup while persisted delivery details and fees survive normalization',()=>{
 const api=load('app/sinterklaas/sinterklaasApi.ts');
 const order={id:'x',customerName:'Voorbeeld',lines:[{letter:'S',quantity:4}],totalCents:6575};
 assert.equal(api.normalizeLetterOrder(order).delivery,null);
 assert.deepEqual(JSON.parse(JSON.stringify(api.normalizeLetterOrder({...order,delivery:address}).delivery)),address);
});
