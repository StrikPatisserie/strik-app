const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, imports = {}, globals = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports, require: name => {
    assert(name in imports, `Unexpected import: ${name}`);
    return imports[name];
  }, Date, Intl, JSON, Number, Set, Map, Error, ...globals });
  return exports;
}
const planning = load('app/productie/planning.ts');
const expansion = load('app/productie/recipePlanning.ts', { './planning': planning });
const forecast = load('app/preview/productie/kerstvoorraad/forecast.ts', { '../../../productie/recipePlanning': expansion });
const examples = load('app/preview/productie/kerstvoorraad/examples.ts', { './forecast': forecast });
const inventory = load('app/productie/inventory.ts', { './planning': planning });
const overview = load('app/preview/productie/kerstvoorraad/productionOverview.ts', { '../../../productie/inventory': inventory });
const variants = load('app/preview/productie/kerstvoorraad/variants.ts');
const assortment = load('app/preview/productie/kerstvoorraad/assortment.ts', { './forecast': forecast, './variants': variants });
const campaign = load('app/preview/productie/kerstvoorraad/campaignNeed.ts', { '../../../productie/planning': planning, '../../../productie/inventory': inventory });
const weekly = load('app/preview/productie/kerstvoorraad/week52.ts', { './variants': variants });
const adjustments = load('app/preview/productie/kerstvoorraad/adjustments.ts');
const product = id => ({ id, name: id, group: 'gebak', department: 'patisserie', cash: 20, bake: 30, cashCode: '10', bakeCode: '20', needsSalesReview: false, note: '', folderProduct: false });
const ready = (recipeId, target, stock = 0, phase = 'components') => ({ recipeId, target, stock, phase, checked: true, storageChecked: true });
function run(products, choices, recipes = examples.exampleRecipes, stocks = examples.exampleStocks) {
  return forecast.buildForecastPlan(products, choices, recipes, stocks, 10, '2026-12-17');
}

test('shared preparations merge, deduct stock once and round whole charges afterwards', () => {
  const result = run([product('a'), product('b')], { a: ready('demo-passievol', 600, 120), b: ready('demo-hazelnoot', 800, 160) });
  assert.equal(result.errors.length, 0);
  const mousse = result.components.find(row => row.id === 'demo-vanille');
  assert.equal(mousse.needed, 136);
  assert.equal(mousse.remaining, 116);
  assert.equal(mousse.batches, 12);
  assert.equal(mousse.make, 120);
  assert.equal(mousse.forProducts.length, 2);
});

test('finished stock is deducted at product level, never again as component stock', () => {
  const result = run([product('a')], { a: ready('demo-stol', 600, 80, 'whole') }, examples.exampleRecipes, { 'demo-stol': 80 });
  assert.equal(result.components[0].needed, 520);
  assert.equal(result.components[0].make, 520);
  assert.equal(result.components[0].finishedStockDeducted, true);
});

test('unknown finished stock or recipe prevents a product disappearing into a subtotal', () => {
  const result = run([product('a'), product('b')], { a: ready('', 100), b: ready('demo-passievol', 100, null) });
  assert.equal(result.components.length, 0);
  assert(result.rows.every(row => row.issues.length));
  assert(result.rows[0].issues.includes('Recept koppelen'));
  assert(result.rows[1].issues.includes('Voorraad tellen'));
});

test('unknown component stock does not become zero; an empty work recipe remains blocked', () => {
  const missingStock = run([product('a')], { a: ready('demo-passievol', 100) }, examples.exampleRecipes, {});
  assert(missingStock.errors.length > 0);
  assert(missingStock.components.every(row => row.make === null));
  const workRecipe = { ...examples.exampleRecipes[0], reviewRequired: true };
  const incomplete = run([product('a')], { a: ready(workRecipe.id, 100) }, [workRecipe]);
  assert.equal(incomplete.components.length, 0);
  assert(incomplete.rows[0].issues.includes('Recept aanvullen en controleren'));
});

test('nested stock and batch rounding change upstream ingredient requirements', () => {
  const recipe = (id, yieldAmount, children = [], type = 'semiFinished', unit = 'kg') => ({ id, name: id, yield: yieldAmount, type, unit, ingredients: children.length ? [] : [{ name: 'base', quantity: 1, unit: 'kg' }], semiFinishedItems: children, steps: [], allergens: [] });
  const recipes = [recipe('final', 100, [{ recipeId: 'mousse', quantity: 10, unit: 'kg' }], 'finalProduct', 'stuks'), recipe('mousse', 10, [{ recipeId: 'caramel', quantity: 2, unit: 'kg' }]), recipe('caramel', 1)];
  const result = run([product('a')], { a: ready('final', 250) }, recipes, { mousse: 12, caramel: 0 });
  assert.equal(result.errors.length, 0);
  assert.equal(result.components.find(row => row.id === 'mousse').make, 20);
  assert.equal(result.components.find(row => row.id === 'caramel').needed, 4);
  assert.equal(result.components.find(row => row.id === 'caramel').make, 4);
});

test('cycles and incompatible units stay on the product control list', () => {
  const recipes = structuredClone(examples.exampleRecipes);
  recipes.find(row => row.id === 'demo-vanille').semiFinishedItems = [{ recipeId: 'demo-passievol', quantity: 1, unit: 'stuks' }];
  const cycle = run([product('a')], { a: ready('demo-passievol', 100) }, recipes);
  assert(cycle.rows[0].issues.length > 0);
  assert.equal(cycle.components.length, 0);
  const mismatch = run([product('a')], { a: ready('demo-vanille', 100) });
  assert(mismatch.rows[0].issues.includes('Omrekening van verkoop naar recept controleren'));
});

test('a zero production remainder produces no batches and growth respects unknown sales units', () => {
  const result = run([product('a')], { a: ready('demo-passievol', 50, 50) });
  assert.equal(result.components.length, 0);
  assert.equal(result.rows[0].issues.length, 0);
  assert.equal(forecast.forecastRow(product('a'), forecast.emptyChoice(), 10).forecast, 55);
  assert.equal(forecast.forecastRow({ ...product('a'), unitUnconfirmed: true }, forecast.emptyChoice(), 10).forecast, null);
  assert.equal(forecast.forecastRow({ ...product('a'), cash: null, bake: null }, forecast.emptyChoice(), 10).forecast, null);
});

test('the period and week-52 baseline use the same configurable uplift', () => {
  assert.equal(forecast.projectedSales(4390, 10), 4829);
  assert.equal(forecast.projectedSales(4390, 5), 4610);
  assert.equal(forecast.projectedSales(4390, 15), 5049);
  assert.equal(forecast.projectedSales(100, 10), 110);
  assert.equal(forecast.projectedSales(100, 5), 105);
  assert.equal(forecast.projectedSales(100, 15), 115);
  assert.equal(forecast.projectedSales(null, 10), null);
  assert.equal(forecast.projectedSales(0, 10), 0);
});

test('week-52 exports match channel-specific article numbers and source size rows once', () => {
  const large = {...product('kb-large'), name:'Xmas KB · 10–12p', cashCode:'25832', bakeCode:'2525', cash:25, bake:0, searchNames:['Xmas KB']};
  const small = {...large, id:'kb-small', name:'Xmas KB · 6–8p', cash:103, bake:41};
  const rows = weekly.attachWeek52Sales([large,small], [
    {name:'Xmas KB',code:'25832',variant:'10-12 pers. (rond)',quantity:25},
    {name:'Xmas KB',code:'25832',variant:'6-8 pers. (rond)',quantity:89},
  ], [{name:'Xmas KB',code:'2525',variant:'6-8 pers.',quantity:10}]);
  assert.equal(rows[0].week52.cash,25); assert.equal(rows[0].week52.bake,0);
  assert.equal(rows[1].week52.cash,89); assert.equal(rows[1].week52.bake,10);
  assert.equal(forecast.productProjection(rows[1],forecast.emptyChoice(),10).week52,109);
  assert.equal(large.week52,undefined);
  const incomplete = weekly.attachWeek52Sales([large,small],[{name:'Xmas KB',code:'25832',variant:'Standaard',quantity:10}],[]);
  assert(incomplete.every(row=>row.week52.issue));
  assert(incomplete.every(row=>forecast.productProjection(row,forecast.emptyChoice(),10).week52===null));
});

test('weekly matching rejects ambiguous reused codes and preserves unknown catalogue coverage', () => {
  const a={...product('a'),cash:100,bake:0}, b={...a,id:'b',name:'renamed'};
  const rows=weekly.attachWeek52Sales([a,b,{...product('unknown'),cashCode:'99',bakeCode:'98',cash:null,bake:null}],
    [{name:'unrecognized',code:'10',variant:'Standaard',quantity:5}],[]);
  assert(rows[0].week52.issue); assert(rows[1].week52.issue);
  assert.equal(rows[2].week52,undefined);
  assert.equal(weekly.attachWeek52Sales([a],[],[])[0].week52.cash,0);
  assert.equal(weekly.attachWeek52Sales([a],[{name:'a',code:'20',variant:'Standaard',quantity:8}],[])[0].week52.cash,0,'old invoice code cannot match a cash code');
  assert.equal(weekly.attachWeek52Sales([a],[{name:'a',code:'10',variant:'Standaard',quantity:101}],[])[0].week52.issue.includes('periodebasis'),true);
});

test('marzipan family week totals include 10–12p subcodes and keep per-person and larger sizes out', () => {
  const member={...product('m'),name:'Marsepeintaart',cashCode:'25000',bakeCode:'225',cash:50,bake:2};
  const family={...member,id:'family',name:'Marsepeintaarten · 10–12p',members:[member]};
  const result=weekly.attachWeek52Sales([family],[
    {name:member.name,code:'25000',variant:'10-12 pers.',quantity:12.5},
    {name:member.name,code:'25000',variant:'14-16 pers.',quantity:6},
  ],[{name:member.name,code:'225',variant:'10-12 pers.',quantity:1}])[0];
  assert.equal(result.week52.cash,12.5); assert.equal(result.week52.bake,1);
  assert.equal(forecast.productProjection(result,forecast.emptyChoice(),10).week52,15);
});

test('per-product growth and direct totals apply once and keep source sales intact', () => {
  const p={...product('a'),cash:400,bake:100,week52:{cash:100,bake:20}};
  assert.equal(forecast.productProjection(p,forecast.emptyChoice(),10).period,550);
  const choice={...forecast.emptyChoice(),adjustment:{growthPercent:15}};
  assert.equal(forecast.productProjection(p,choice,5).period,575);
  assert.equal(forecast.productProjection(p,choice,5).week52,138);
  choice.adjustment.periodTotal=600; choice.adjustment.week52Total=200;
  assert.equal(forecast.productProjection(p,choice,5).period,600);
  assert.equal(forecast.productProjection(p,choice,5).week52,200);
  assert.equal(p.cash,400); assert.equal(p.week52.cash,100);
  assert.equal(forecast.productProjection(p,{...choice,adjustment:{periodTotal:0,week52Total:0}},10).period,0);
  assert(forecast.productProjection(p,{...choice,adjustment:{periodTotal:100}},10).issue);
});

test('2026 replacement keeps a stable history ID and requires its own current article mapping', () => {
  const p={...product('original'),name:'Kerstgebak 2025',members:[product('member')],articleAmbiguous:true};
  const choice={...forecast.emptyChoice(),adjustment:{name2026:'Kerstgebak 2026'}};
  const replaced=forecast.productFor2026(p,choice);
  assert.equal(replaced.id,p.id); assert.equal(replaced.cash,p.cash); assert.equal(replaced.name,'Kerstgebak 2026');
  assert.equal(replaced.cashCode,''); assert.equal(replaced.members,undefined); assert.equal(replaced.articleAmbiguous,true);
  assert.equal(p.cashCode,'10'); assert.equal(p.members.length,1);
  assert.equal(campaign.remainingNeed(replaced,100,campaignReceipts([receiptDay('2026-11-16',20)]),'2026-11-17',true).remaining,null);
  choice.adjustment.cashCode2026='10500';
  assert.equal(forecast.productFor2026(p,choice).cashCode,'10500');
  assert.equal(forecast.productFor2026(p,choice).articleAmbiguous,false);
  const duplicate=forecast.mappedProductsFor2026([p,{...product('second'),cashCode:'30'}], {
    original:choice, second:{...forecast.emptyChoice(),adjustment:{name2026:'Ook nieuw',cashCode2026:'10500'}},
  },10);
  assert(duplicate.every(row=>row.articleAmbiguous),'two forecasts cannot subtract the same current article twice');
  const withHidden=forecast.mappedProductsFor2026([p,{...p,id:'second'}],{
    original:choice, second:{...forecast.emptyChoice(),adjustment:{name2026:'Ook nieuw',cashCode2026:'10500',hidden:true}},
  },10);
  assert.equal(withHidden[0].articleAmbiguous,false,'a hidden forecast does not consume the active article mapping');
});

test('local settings retain explicit zero overrides and reject invalid or older persisted data', () => {
  const loaded=adjustments.parseForecastSettings(JSON.stringify({version:1,growth:15,adjustments:{
    a:{periodTotal:0,week52Total:0,growthPercent:-5,name2026:'Nieuwe taart',cashCode2026:'20400',hidden:true},
    b:{periodTotal:-1,week52Total:1.5,growthPercent:Infinity,name2026:'',cashCode2026:'9999999999'},
  }}));
  assert.equal(loaded.growth,15); assert.equal(loaded.adjustments.a.periodTotal,0); assert.equal(loaded.adjustments.a.growthPercent,-5);
  assert.equal(loaded.adjustments.a.hidden,true);
  assert.equal(loaded.adjustments.a.cashCode2026,'20400'); assert.equal(loaded.adjustments.b.periodTotal,undefined);
  assert.equal(loaded.adjustments.b.week52Total,undefined); assert.equal(loaded.adjustments.b.cashCode2026,undefined);
  assert.equal(adjustments.parseForecastSettings('{').growth,10);
  assert.equal(adjustments.parseForecastSettings(JSON.stringify({version:0,adjustments:{a:{periodTotal:900}}})).adjustments.a,undefined);
});

test('last production, last counted stock and current forecast remain separate', () => {
  const products = [product('bakery:passievol bombe')];
  const choices = examples.exampleChoices(products);
  const source = overview.exampleProduction(products, choices, examples.exampleRecipes);
  const row = overview.productInventory(products[0], choices[products[0].id], source);
  assert.equal(row.latest.quantity, 500);
  assert.equal(row.latest.date, '2026-11-09');
  assert.equal(row.count.quantity, 200);
  assert.equal(row.count.date, '2026-11-08');
  assert.equal(row.issued, 580);
  assert.equal(overview.stockDisplay(row).quantity, 120);
});

test('a missing dispatch day or intraday checkpoint never presents an estimated stock as current', () => {
  assert.equal(overview.stockDisplay(null).quantity, null);
  assert.equal(overview.stockDisplay({count: {}, known: false, missingDays: 2, balance: 120}).quantity, null);
  assert.equal(overview.stockDisplay({count: {}, known: true, checkpoint: true, balance: 120}).quantity, null);
  assert.equal(overview.stockDisplay({count: {}, known: true, balance: -5}).quantity, null);
  assert.equal(overview.stockDisplay({count: {}, known: true, balance: 0, through: '2026-11-10'}).quantity, 0);
});

test('live matching uses the current article namespace and rejects duplicates and wrong units', () => {
  const base = {itemId: 'real', kind: 'product', unit: 'stuks', link: {article: '20'}};
  const source = {mode: 'live', items: [], recipes: [], overview: {rows: [base]}};
  assert.equal(overview.productInventory(product('a'), ready('demo-passievol', 20), source), null);
  source.overview.rows = [{...base, link: {article: '10'}}];
  assert.equal(overview.productInventory(product('a'), ready('', 20), source).itemId, 'real');
  assert.equal(overview.productInventory({...product('a'), articleAmbiguous:true}, ready('', 20), source), null);
  source.overview.rows.push({...source.overview.rows[0], itemId: 'duplicate'});
  assert.equal(overview.productInventory(product('a'), ready('', 20), source), null);
  assert.equal(overview.productInventory(product('a'), {...ready('', 20), productionItemId: 'real'}, source).itemId, 'real');
  source.overview.rows = [{...base, unit: 'kg', link: {article: '10'}}];
  assert.equal(overview.productInventory(product('a'), {...ready('', 20), productionItemId: 'real'}, source), null);
});

const article = (name, groupNumber, newNumber = '10', previousNumber = '20') => ({ name, groupNumber, newNumber, previousNumber, groupName: groupNumber });
test('six categories distinguish pastries, whole cakes and whole slofs, with Christmas taking priority', () => {
  for (const [name, group, expected] of [
    ['Petit Gateau (6st)', '10', 'gebak'], ['Seizoens Cheese Punt (Citroen-Merengue)', '10', 'gebak'],
    ['Pistache Slofje', '10', 'gebak'], ['Pistache Slof', '35', 'slof'], ['Slagroomschnitt', '35', 'slof'], ['Kersenvlaai', '30', 'slof'], ['Kersenvlaaitje', '10', 'gebak'],
    ["Strik's Marsepeintaart 6-8p", '25', 'taart'], ['Seizoens Cheesecake', '20', 'taart'], ['Luxe taart', '20', 'taart'],
    ['Xmas marsepeintaart-chipolata', '25', 'kerst'], ['Luxe Kerst stol', '155', 'kerst'], ['Amandelstaaf', '50', 'kerst'],
    ['Saucijzenbroodje', '60', 'bak'], ['Worstenbroodje', '60', 'bak'], ['Oliebollen naturel', '90', 'bak'],
    ['Petit Fleur', '65', 'overig'], ['Petit Creme', '65', 'overig'], ['Slagroomtruffels', '70', 'overig'],
  ]) assert.equal(assortment.stockCategory(name, article(name, group)), expected, name);
  assert.equal(assortment.stockCategories.length, 6);
  assert.equal(assortment.stockCategory('Petit Fleur', article('Petit Fleur', '10')), 'overig');
});

test('non-food services and shop supplies never appear as production demand', () => {
  for (const [name, group] of [['Bezorgkosten', '310'], ['Kerstkaart', '83'], ['Logo op Marsepein', '95'], ['Korting op taart', '20'], ['Zak koffiebonen', '100']]) {
    assert.equal(assortment.stockCategory(name, article(name, group)), null, name);
  }
});

test('the complete catalogue retains unknown quantities and both old and new searchable names', () => {
  const catalog = [article('Seizoens Cheese Punt Citroen', '10', '10430', '127'), article('Worstenbroodje', '60', '60103', '905'), article('Bezorgkosten', '310', '99', '90')];
  const products = assortment.buildSalesAssortment([{name: 'Cheese Punt Framboos', code: '10430', quantity: 800}], [{name: 'Cheese Punt Framboos', code: '127', quantity: 200}], catalog, []);
  assert.equal(products.length, 2);
  const renamed = products.find(p => p.cashCode === '10430');
  assert.equal(renamed.cash, 800);
  assert.equal(renamed.bake, 200);
  assert.equal(renamed.needsSalesReview, true);
  assert(renamed.searchNames.includes('Seizoens Cheese Punt Citroen'));
  assert(planning.matchesProductionSearch('citroen 104', [renamed.name, renamed.cashCode, ...renamed.searchNames]));
  const added = products.find(p => p.name === 'Worstenbroodje');
  assert.equal(added.cash, null);
  assert.equal(added.bake, null);
  assert.equal(forecast.forecastRow(added, forecast.emptyChoice(), 10).forecast, null);
});

test('duplicate catalogue codes and folder aliases do not duplicate historical sales', () => {
  const catalog = [article('Kerst Tulband', '40', '40841', '2518'), article('Kerst Tulband anders', '40', '40841', '2518')];
  const products = assortment.buildSalesAssortment([{name: 'Kerst Tulband', code: '40841', quantity: 100}], [{name: 'Kerst Tulband', code: '2518', quantity: 50}], catalog, [{id:'tulband', name:'Tulband'}]);
  assert.equal(products.length, 1);
  assert.equal(products[0].id, 'folder:tulband');
  assert.equal(products[0].cash + products[0].bake, 150);
});

test('split exports preserve cake and bread variants across channels and attach their own week-52 sales', () => {
  const catalog = [article('Red Velvet', '20', '20100', '201'), article('Luxe Kerst stol', '155', '155830', '2516')];
  const cash = [
    {name:'Red Velvet',code:'20100',variant:'6-8 pers.',quantity:140},
    {name:'Red Velvet',code:'20100',variant:'10-12 personen',quantity:22.61},
    {name:'Luxe Kerst stol',code:'155830',variant:'groot (±800gr)',quantity:567},
    {name:'Luxe Kerst stol',code:'155830',variant:'klein (±375gr)',quantity:634},
  ];
  const bake = [
    {name:'Red Velvet',code:'201',variant:'6-8 pers',quantity:14},
    {name:'Red Velvet',code:'201',variant:'10-12 pers.',quantity:26},
    {name:'Luxe Kerst stol',code:'2516',variant:'groot (±800gr)',quantity:490},
    {name:'Luxe Kerst stol',code:'2516',variant:'klein (±375gr)',quantity:1},
  ];
  const products = assortment.buildSalesAssortment(cash,bake,catalog,[{id:'stol-groot',name:'Kerststol'}]);
  assert.equal(products.length,4);
  assert.equal(products.reduce((sum,p)=>sum+(p.cash||0)+(p.bake||0),0),1894.61);
  const small = products.find(p=>p.salesVariant==='6–8p');
  const large = products.find(p=>p.salesVariant==='10–12p');
  assert.equal(forecast.productProjection(small,forecast.emptyChoice(),10).period,170);
  assert.equal(forecast.productProjection(large,forecast.emptyChoice(),10).period,54);
  assert.equal(products.filter(p=>p.folderProduct).length,2);
  const result = weekly.attachWeek52Sales(products,[
    {name:'Red Velvet',code:'20100',variant:'10-12',quantity:10.64},
    {name:'Luxe Kerst stol',code:'155830',variant:'groot (±800gr)',quantity:346},
  ],[{name:'Red Velvet',code:'201',variant:'10-12 pers.',quantity:1}]);
  assert.equal(result.find(p=>p.id===large.id).week52.cash,10.64);
  assert.equal(result.find(p=>p.id===large.id).week52.bake,1);
  assert.equal(result.find(p=>p.id===small.id).week52.cash,0);
  assert.equal(result.find(p=>p.salesVariant==='groot (±800gr)').week52.cash,346);
  assert(result.every(p=>!p.week52.issue));
});

test('explicit marzipan subcodes aggregate only 10–12p and retain other sizes separately', () => {
  const products = assortment.buildSalesAssortment([
    {name:'Marsepeintaart',code:'25200',variant:'6-8 pers. (rond)',quantity:36},
    {name:'Marsepeintaart',code:'25200',variant:'10-12 personen',quantity:17.5},
    {name:'Marsepeintaart',code:'25200',variant:'14-16 pers. (rond)',quantity:5.25},
  ],[{name:'Marsepeintaart',code:'225',variant:'10-12 pers. (rond)',quantity:22}],
  [article('Marsepeintaart','25','25200','225')],[]);
  const family = products.find(p=>p.members);
  assert.equal(family.cash,17.5);
  assert.equal(family.bake,22);
  assert.equal(family.members.length,1);
  assert.equal(products.find(p=>p.salesVariant==='14–16p').cash,5.25);
  assert.equal(products.find(p=>p.salesVariant==='6–8p').cash,36);
});

test('separate historical names stay separate even when a seasonal article number is reused', () => {
  const catalog = [article('Kersttaart', '20', '20830', '2510')];
  const products = assortment.buildSalesAssortment([{name:'Kersttaart', code:'20830', quantity:20}, {name:'Paastaart', code:'20830', quantity:30}], [], catalog, []);
  assert.equal(products.length, 2);
  assert.equal(products.reduce((sum, p) => sum + p.cash, 0), 50);
  assert(products.every(p => p.needsSalesReview));
  assert(products.every(p => p.articleAmbiguous));
  const result=weekly.attachWeek52Sales(products,[{name:'Kersttaart',code:'20830',variant:'Standaard',quantity:7}],[]);
  assert.equal(result.find(p=>p.name==='Kersttaart').week52.cash,7);
  assert.equal(result.find(p=>p.name==='Paastaart').week52.cash,0);
  assert(result.every(p=>!p.week52.issue),'the exact sales name takes precedence over a reused catalogue alias');
});

test('volume bands are based on source sales and do not change when uplift changes', () => {
  const bestseller = {...product('a'), cash:800, bake:200};
  assert.equal(assortment.salesVolume(bestseller), 'high');
  assert.equal(assortment.salesVolume({...bestseller, cash:100, bake:200}), 'medium');
  assert.equal(assortment.salesVolume({...bestseller, cash:1, bake:0}), 'low');
  assert.equal(assortment.salesVolume({...bestseller, unitUnconfirmed:true}), 'unknown');
  assert.equal(assortment.salesVolume({...bestseller, cash:null, bake:null}), 'unknown');
});

test('minimum quantities apply to the rounded forecast, independent of search and volume filters', () => {
  const p = (group, base) => ({...product('a'), group, cash:base, bake:0});
  for (const group of ['gebak', 'bak', 'overig']) {
    assert.equal(assortment.includeInStockOverview(p(group, 90), 10), false);
    assert.equal(assortment.includeInStockOverview(p(group, 91), 10), true);
    assert.equal(assortment.includeInStockOverview(p(group, 95), 5), true);
    assert.equal(assortment.includeInStockOverview(p(group, 95), 0), false);
  }
  assert.equal(assortment.includeInStockOverview(p('taart', 17), 10), false);
  assert.equal(assortment.includeInStockOverview(p('taart', 18), 10), true);
  assert.equal(assortment.includeInStockOverview(p('slof', 1), 10), true);
  assert.equal(assortment.includeInStockOverview(p('kerst', 1), 10), true);
  assert.equal(assortment.includeInStockOverview({...p('gebak', 0), cash:null, bake:null}, 10), false);
  for (const group of assortment.stockCategories.map(category=>category.id)) {
    assert.equal(assortment.includeInStockOverview({...p(group,1000),unitUnconfirmed:true},10),false);
    assert.equal(assortment.includeInStockOverview(p(group,0),10),false);
  }
});

test('removed New Year products, chocolate letters and sugar sticks never reappear through filters', () => {
  for (const [name, group] of [['Oliebollen gevuld', 'bak'], ['Appelbeignets', 'bak'], ['MELK Spuitletter Groot B2B', 'overig'], ['Vormletter groot', 'overig'], ['Luxe Letter Pistache Dubai - Melk', 'overig'], ['Chocolade letter open artikel', 'overig'], ['Doos Poedersuikersticks 10g à 500st', 'overig']]) {
    assert.equal(assortment.includeInStockOverview({...product('a'), name, group, cash:1000, bake:0}, 15), false, name);
  }
  assert.equal(assortment.includeInStockOverview({...product('a'), name:'Roomboter Amandelletter', group:'overig', cash:500}, 10), true);
});

test('Christmas excludes chocolate work and missing or zero quantities but keeps a chocolate cake', () => {
  const christmas = {...product('a'), group:'kerst'};
  assert.equal(assortment.includeInStockOverview({...christmas, cash:null, bake:null}, 10), false);
  assert.equal(assortment.includeInStockOverview({...christmas, cash:0, bake:0}, 10), false);
  assert.equal(assortment.includeInStockOverview({...christmas, name:'Choco/Noten Kerstboom', articleGroup:'70'}, 10), false);
  assert.equal(assortment.includeInStockOverview({...christmas, name:'Chocolade Kersttaart', articleGroup:'20'}, 10), true);
});

test('marzipan cakes combine before thresholding and uplift, with small cakes, per-person sales and Christmas separate', () => {
  const variant = (id, name, cash, group = 'taart') => ({...product(id), name, group, cash, bake:0});
  const result = assortment.aggregateMarzipanCakes([
    variant('a','Marsepeintaart Bloemetjes', 9.5), variant('b','Marsepeintaart Kleurrijk Groen', 9),
    variant('small','Flower Marsepeintaartje (6-8pers)', 50), variant('tiny','Tuxedo Marsepeintaartje (6p)', 20),
    variant('portions','Marsepeintaart pp (v.a. 35p)', 150), variant('christmas','Xmas marsepeintaart - chipolata', 74.5, 'kerst'),
  ]);
  const combined = result.find(p => p.members);
  assert.equal(combined.cash, 18.5);
  assert.equal(combined.members.length, 2);
  assert.equal(forecast.forecastRow(combined, forecast.emptyChoice(), 10).forecast, 21);
  assert.equal(assortment.includeInStockOverview(combined, 10), true);
  assert.equal(result.filter(p => !p.members).length, 4);
  assert(planning.matchesProductionSearch('bloemetjes', combined.searchNames));
  assert.equal(overview.productInventory(combined, {productionItemId:'one-variant'}, {mode:'live', overview:{rows:[{itemId:'one-variant',kind:'product',unit:'stuks'}]}}), null);
});

test('fractional whole-cake sales yield a forecast while per-person and weight units remain unconverted', () => {
  const catalog = [article('Xmas marsepeintaart - chipolata', '25', '25831', '2524'), article('Marsepeintaart pp (v.a. 35p)', '25', '25900', '2900'), article('Bonbons per 100 gr', '70', '70001', '1300')];
  const products = assortment.buildSalesAssortment([
    {name:catalog[0].name, code:'25831', quantity:74.5}, {name:catalog[1].name, code:'25900', quantity:150}, {name:catalog[2].name, code:'70001', quantity:420},
  ], [], catalog, []);
  const chipolata = products.find(p => p.name === catalog[0].name);
  assert.equal(chipolata.unitUnconfirmed, false);
  assert.equal(forecast.forecastRow(chipolata, forecast.emptyChoice(), 10).forecast, 82);
  assert.equal(products.find(p => p.name === catalog[1].name).unitUnconfirmed, true);
  assert.equal(products.find(p => p.name === catalog[2].name).unitUnconfirmed, true);
});

test('Christmas cookie and meringue wreaths reconcile to their source rows once', () => {
  const catalog = [article('Kerst Koekkransjes', '40', '40840', '2513'), article('Pakje Schuimkransjes', '40', '40843', '904102')];
  const products = assortment.buildSalesAssortment([{name:catalog[0].name,code:'40840',quantity:411},{name:catalog[1].name,code:'40843',quantity:162}], [{name:catalog[0].name,code:'2513',quantity:3},{name:catalog[1].name,code:'904102',quantity:0}], catalog, [{id:'kerstkoekjes',name:'Kerstkoekjes'},{id:'schuimkransjes',name:'Schuimkransjes'}]);
  assert.equal(products.length, 2);
  const cookie = products.find(p => p.id === 'folder:kerstkoekjes');
  assert.equal(cookie.cash + cookie.bake, 414);
  assert.equal(forecast.forecastRow(cookie, forecast.emptyChoice(), 10).forecast, 456);
  assert(planning.matchesProductionSearch('kerstkransjes', cookie.searchNames));
  assert.equal(forecast.forecastRow(products.find(p => p.id === 'folder:schuimkransjes'), forecast.emptyChoice(), 10).forecast, 179);
});

test('approved Christmas size counts include the invoice cakes only in the small KB variant', () => {
  const parent = (cashCode, cash, bake) => ({...product(cashCode), name:`Xmas marsepeintaart ${cashCode}`, group:'kerst', cashCode, cash, bake});
  const rows = assortment.splitChristmasCakeSizes([parent('25831',74.5,0), parent('25832',128,41)]);
  assert.equal(rows.length, 4);
  assert.deepEqual(Array.from(rows, p => forecast.forecastRow(p, forecast.emptyChoice(), 10).forecast), [52,31,159,28]);
  assert.equal(rows.reduce((sum, p) => sum + p.cash, 0), 203);
  assert.equal(rows.reduce((sum, p) => sum + p.bake, 0), 41);
  assert.equal(rows.find(p => p.cashCode === '25832' && p.name.endsWith('6–8p')).bake, 41);
  assert(rows.every(p => p.articleAmbiguous));
  assert(rows.every(p => assortment.includeInStockOverview(p, 10)));
});

test('size overrides do not overwrite a changed or incomplete source report', () => {
  for (const [cash,bake] of [[75.5,0],[74.5,null]]) {
    const rows = assortment.splitChristmasCakeSizes([{...product('25831'), group:'kerst', cashCode:'25831', cash, bake}]);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].cash, cash);
    assert.match(rows[0].note, /Formaatuitsplitsing niet toegepast/);
  }
});

const receiptDay = (date, quantity, importedAt = `${date}T18:00:00Z`) => ({date,importedAt,unknownLines:0,lines:[{article:'10',description:'a',quantity}]});
const campaignReceipts = days => ({mode:'live', available:true, days});
test('remaining demand subtracts elapsed campaign deliveries once from the uplifted total', () => {
  const receipts = campaignReceipts([receiptDay('2026-11-15',999), receiptDay('2026-11-16',100), receiptDay('2026-11-17',120), receiptDay('2026-11-18',80), receiptDay('2026-11-19',500)]);
  const result = campaign.remainingNeed(product('a'), 4829, receipts, '2026-11-19', true);
  assert.equal(result.issued, 300);
  assert.equal(result.remaining, 4529);
  assert.equal(result.through, '2026-11-18');
  assert.equal(campaign.remainingNeed(product('a'), 4610, receipts, '2026-11-19', true).remaining, 4310);
  assert.equal(campaign.remainingNeed(product('a'), 4829, receipts, '2026-11-17', true).issued, 100);
});

test('reimported daily snapshots replace old quantities instead of accumulating', () => {
  const receipts = campaignReceipts([receiptDay('2026-11-16',100),receiptDay('2026-11-16',120,'2026-11-16T19:00:00Z')]);
  const result = campaign.remainingNeed(product('a'), 1000, receipts, '2026-11-17', true);
  assert.equal(result.issued, 120);
  assert.equal(result.remaining, 880);
});

test('before the campaign the whole forecast remains, afterwards missing and unreadable days are explicit', () => {
  const receipts = campaignReceipts([receiptDay('2026-11-16',100),receiptDay('2026-11-18',80)]);
  assert.equal(campaign.remainingNeed(product('a'), 4829, {...receipts,available:false}, '2026-11-10', true).remaining, 4829);
  assert.equal(campaign.remainingNeed(product('a'), 4829, receipts, '2026-11-16', true).issued, 0);
  assert.equal(campaign.remainingNeed(product('a'), 4829, receipts, '2026-11-19', true).remaining, null);
  assert.match(campaign.remainingNeed(product('a'), 4829, receipts, '2026-11-19', true).note, /1 bondag/);
  const unreadable = campaignReceipts([{...receiptDay('2026-11-16',100),unknownLines:1}]);
  assert.equal(campaign.remainingNeed(product('a'), 4829, unreadable, '2026-11-17', true).remaining, null);
});

test('remaining demand requires a verified unit and article, including format-specific and family rows', () => {
  const receipts = campaignReceipts([receiptDay('2026-11-16',100)]);
  for (const row of [{...product('a'), articleAmbiguous:true},{...product('a'), members:[product('b')]},{...product('a'), cashCode:'9999999999'}]) assert.equal(campaign.remainingNeed(row, 1000, receipts, '2026-11-17', true).remaining, null);
  assert.equal(campaign.remainingNeed(product('a'), 1000, receipts, '2026-11-17', false).remaining, null);
  assert.equal(campaign.remainingNeed(product('a'), null, receipts, '2026-11-17', true).remaining, null);
  assert.equal(campaign.remainingNeed(product('a'), 1000, {...receipts,available:false}, '2026-11-17', true).remaining, null);
});

test('returns, zero sales and exceeding the forecast stay distinct from missing data', () => {
  const zero = campaign.remainingNeed(product('a'), 50, campaignReceipts([receiptDay('2026-11-16',0)]), '2026-11-17', true);
  assert.equal(zero.remaining, 50);
  const excess = campaign.remainingNeed(product('a'), 50, campaignReceipts([receiptDay('2026-11-16',70)]), '2026-11-17', true);
  assert.equal(excess.remaining, 0);
  assert.match(excess.note, /20 boven/);
  assert.equal(campaign.remainingNeed(product('a'), 50, campaignReceipts([receiptDay('2026-11-16',-2)]), '2026-11-17', true).remaining, 52);
  assert.equal(campaign.validCampaignDays([receiptDay('2026-11-16',100)]), true);
  assert.equal(campaign.validCampaignDays([receiptDay('2026-02-31',100)]), false);
  assert.equal(campaign.validCampaignDays([receiptDay('2026-11-16',NaN)]), false);
});

test('preview receipt endpoint rejects production and unauthorized sessions before reading data', async () => {
  let reads = 0;
  const imports = {
    '@/app/lib/auth/session': {getCurrentProfile:async()=>null}, '@/app/productie/access': {productionDepartments:()=>[]},
    '@/app/productie/inventorySource.server': {inventoryDispatchDays:async()=>{reads++;return[];}},
    '@/app/preview/productie/kerstvoorraad/campaignNeed': campaign,
  };
  const route = env => load('app/api/preview/kerstvoorraad/bonnen/route.ts', imports, {process:{env:{NODE_ENV:env}}, Response});
  assert.equal((await route('production').GET()).status, 404);
  assert.equal((await route('development').GET()).status, 403);
  assert.equal(reads, 0);
});

test('authorized preview receipt reads are limited to the campaign and never cache publicly', async () => {
  const route = load('app/api/preview/kerstvoorraad/bonnen/route.ts', {
    '@/app/lib/auth/session': {getCurrentProfile:async()=>({id:'bakery'})}, '@/app/productie/access': {productionDepartments:()=>['luxe']},
    '@/app/productie/inventorySource.server': {inventoryDispatchDays:async()=>[receiptDay('2026-11-15',90),receiptDay('2026-11-16',100),receiptDay('2027-01-01',110)]},
    '@/app/preview/productie/kerstvoorraad/campaignNeed': campaign,
  }, {process:{env:{NODE_ENV:'development'}}, Response});
  const response = await route.GET();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  const body = await response.json();
  assert.equal(body.days.length, 1);
  assert.equal(body.days[0].date, '2026-11-16');
});
