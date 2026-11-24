const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function load(file, imports={}) {const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,Date,require:name=>imports[name]});return exports;}
const {mondayLetterProduction}=load('app/productie/letterWeekPlanning.ts');
const days=['2026-11-30','2026-12-01'];
const batch={id:'main',startDate:'2026-11-30',date:'2026-12-01',rows:[{orders:60,stock:10,produced:80},{orders:20,stock:0,produced:5}]};
test('uses the Monday production start, with orders plus shop stock and per-letter remaining demand',()=>{
 const result=mondayLetterProduction([batch],days)[0];
 assert.equal(result.date,'2026-11-30');assert.equal(result.total,90);assert.equal(result.made,85);assert.equal(result.remaining,15);
});
test('fresh order data changes the count, while another week or a Tuesday batch stays out',()=>{
 assert.equal(mondayLetterProduction([{...batch,rows:[{orders:100,stock:20,produced:0}]}],days)[0].total,120);
 assert.equal(mondayLetterProduction([batch],['2026-11-23']).length,0);
 assert.equal(mondayLetterProduction([{...batch,startDate:'2026-12-01'}],days).length,0);
});
test('frozen canonical quantities remain marked as a fixed list',()=>{
 const result=mondayLetterProduction([{...batch,checklist:{lockedAt:'2026-11-29T20:00:00Z'}}],days)[0];
 assert.equal(result.locked,true);assert.equal(result.total,90);
});
const cakes=load('app/preview/productie/kerstvoorraad/christmasCakes.ts');
const {compareStockProducts}=load('app/preview/productie/kerstvoorraad/productOrder.ts',{'./christmasCakes':cakes});
const product=(id,name,group='kerst',cashCode='')=>({id,name,group,cashCode,cash:0,bake:0});
test('keeps pastry varieties and stollen together, independent of sales and sizes',()=>{
 const products=[product('s1','Stol 1000g'),product('c','Taartje choco'),product('s2','Stol 500g'),product('m','Taartje mango'),product('t','Tulband'),product('b','Taartje brownie')];
 const sorted=products.sort(compareStockProducts).map(p=>p.id);
 assert.deepEqual(sorted,['b','c','m','s2','s1','t']);
});
test('all six Christmas cakes stay grouped before the other products',()=>{
 const products=['25830','25831','25832'].flatMap(code=>['6–8p','10–12p'].map(size=>({...product(code+size,`XMAS taart ${code}`,'kerst',code),salesVariant:size})));
 products.push(product('stol','Stol 500g'));products.reverse().sort(compareStockProducts);
 assert.deepEqual(products.slice(0,6).map(p=>cakes.christmasCakeVariant(p).size),['4–6p','6–8p','6–8p','10–12p','10–12p','10–12p']);
 assert.equal(products[6].id,'stol');
});
