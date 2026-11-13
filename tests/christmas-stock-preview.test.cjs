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
const materials = load('app/productie/materialPlanning.ts', { './planning': planning });
const expansion = load('app/productie/recipePlanning.ts', { './planning': planning, './materialPlanning': materials });
const salesArticles = load('app/preview/productie/kerstvoorraad/salesArticles.ts');
const forecast = load('app/preview/productie/kerstvoorraad/forecast.ts', { '../../../productie/recipePlanning': expansion, './salesArticles': salesArticles });
const examples = load('app/preview/productie/kerstvoorraad/examples.ts', { './forecast': forecast });
const inventory = load('app/productie/inventory.ts', { './planning': planning });
const variants = load('app/preview/productie/kerstvoorraad/variants.ts');
const petitProducts = load('app/preview/productie/kerstvoorraad/petitProducts.ts');
const assortment = load('app/preview/productie/kerstvoorraad/assortment.ts', { './forecast': forecast, './variants': variants, './petitProducts': petitProducts });
const assorted = load('app/preview/productie/kerstvoorraad/assortedPastries.ts');
const flans = load('app/preview/productie/kerstvoorraad/flanVariants.ts');
const campaign = load('app/preview/productie/kerstvoorraad/campaignNeed.ts', { '../../../productie/planning': planning, '../../../productie/inventory': inventory, './assortedPastries': assorted, './salesArticles': salesArticles });
const overview = load('app/preview/productie/kerstvoorraad/productionOverview.ts', { '../../../productie/inventory': inventory, '../../../productie/planning': planning, './campaignNeed': campaign });
const stockCount = load('app/preview/productie/kerstvoorraad/stockCount.ts');
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

test('weekly production target spreads the full forecast over weeks 47 through 50', () => {
  const p = { ...product('a'), cash: 400, bake: 100 };
  const choice = forecast.emptyChoice();
  const projection = forecast.productProjection(p, choice, 10);
  assert.equal(projection.period, 550);
  assert.equal(projection.weeklyTarget, 138);
  assert(projection.weeklyTarget * 4 >= projection.period);
  assert.equal(forecast.productProjection(p, choice, 5).weeklyTarget, 132);
  assert.equal(forecast.productProjection(p, {
    ...choice, adjustment: { growthPercent: 15 },
  }, 5).weeklyTarget, 144);
  assert.equal(forecast.productProjection(p, {
    ...choice, adjustment: { periodTotal: 600, week52Total: 100 },
  }, 10).weeklyTarget, 150);
  assert.equal(forecast.productProjection(p, {
    ...choice, adjustment: { periodTotal: 0 },
  }, 10).weeklyTarget, 0);
  assert.equal(forecast.productProjection({ ...p, cash: null, bake: null }, choice, 10).weeklyTarget, null);
  assert.equal(forecast.productProjection({ ...p, unitUnconfirmed: true }, choice, 10).weeklyTarget, null);
  assert.equal(p.cash, 400);
  assert.equal(p.bake, 100);
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
test('seven categories distinguish pastries, whole cakes and whole slofs, with Christmas taking priority', () => {
  for (const [name, group, expected] of [
    ['Petit Gateau (6st)', '10', 'petit-dv'], ['Seizoens Cheese Punt (Citroen-Merengue)', '10', 'gebak'],
    ['Pistache Slofje', '10', 'gebak'], ['Pistache Slof', '35', 'slof'], ['Slagroomschnitt', '35', 'slof'], ['Kersenvlaai', '30', 'slof'], ['Kersenvlaaitje', '10', 'gebak'],
    ["Strik's Marsepeintaart 6-8p", '25', 'taart'], ['Seizoens Cheesecake', '20', 'taart'], ['Luxe taart', '20', 'taart'],
    ['Xmas marsepeintaart-chipolata', '25', 'kerst'], ['Luxe Kerst stol', '155', 'kerst'], ['Amandelstaaf', '50', 'kerst'],
    ['Saucijzenbroodje', '60', 'bak'], ['Worstenbroodje', '60', 'bak'], ['Oliebollen naturel', '90', 'bak'],
    ['Petit Fleur', '65', 'petit-dv'], ['Petit Creme', '65', 'petit-dv'], ['Slagroomtruffels', '70', 'overig'],
  ]) assert.equal(assortment.stockCategory(name, article(name, group)), expected, name);
  assert.equal(assortment.stockCategories.length, 7);
  assert.equal(assortment.stockCategory('Petit Fleur', article('Petit Fleur', '10')), 'petit-dv');
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
  const result = campaign.remainingNeed(product('a'), 4829, receipts, '2026-11-19');
  assert.equal(result.issued, 300);
  assert.equal(result.remaining, 4529);
  assert.equal(result.through, '2026-11-18');
  assert.equal(campaign.remainingNeed(product('a'), 4610, receipts, '2026-11-19').remaining, 4310);
  assert.equal(campaign.remainingNeed(product('a'), 4829, receipts, '2026-11-17').issued, 100);
});

test('reimported daily snapshots replace old quantities instead of accumulating', () => {
  const receipts = campaignReceipts([receiptDay('2026-11-16',100),receiptDay('2026-11-16',120,'2026-11-16T19:00:00Z')]);
  const result = campaign.remainingNeed(product('a'), 1000, receipts, '2026-11-17');
  assert.equal(result.issued, 120);
  assert.equal(result.remaining, 880);
});

test('before the campaign the whole forecast remains, afterwards missing and unreadable days are explicit', () => {
  const receipts = campaignReceipts([receiptDay('2026-11-16',100),receiptDay('2026-11-18',80)]);
  assert.equal(campaign.remainingNeed(product('a'), 4829, {...receipts,available:false}, '2026-11-10').remaining, 4829);
  assert.equal(campaign.remainingNeed(product('a'), 4829, receipts, '2026-11-16').issued, 0);
  assert.equal(campaign.remainingNeed(product('a'), 4829, receipts, '2026-11-19').remaining, null);
  assert.match(campaign.remainingNeed(product('a'), 4829, receipts, '2026-11-19').note, /1 bondag/);
  const unreadable = campaignReceipts([{...receiptDay('2026-11-16',100),unknownLines:1}]);
  const partial = campaign.remainingNeed(product('a'), 4829, unreadable, '2026-11-17');
  assert.equal(partial.issued, 100);
  assert.equal(partial.remaining, 4729);
  assert.equal(partial.provisional, true);
  assert.match(partial.note, /1 bonregels controleren/);
});

test('remaining demand uses the sales article independently of recipe and stock links, preserving unit and format checks', () => {
  const receipts = campaignReceipts([receiptDay('2026-11-16',100)]);
  for (const row of [{...product('a'), articleAmbiguous:true},{...product('a'), members:[product('b')]},{...product('a'), cashCode:'9999999999'}]) assert.equal(campaign.remainingNeed(row, 1000, receipts, '2026-11-17').remaining, null);
  assert.equal(campaign.remainingNeed({...product('a'), unitUnconfirmed:true}, 1000, receipts, '2026-11-17').remaining, null);
  assert.equal(campaign.remainingNeed(product('a'), null, receipts, '2026-11-17').remaining, null);
  assert.equal(campaign.remainingNeed(product('a'), 1000, {...receipts,available:false}, '2026-11-17').remaining, null);
});

test('returns, zero sales and exceeding the forecast stay distinct from missing data', () => {
  const zero = campaign.remainingNeed(product('a'), 50, campaignReceipts([receiptDay('2026-11-16',0)]), '2026-11-17');
  assert.equal(zero.remaining, 50);
  const excess = campaign.remainingNeed(product('a'), 50, campaignReceipts([receiptDay('2026-11-16',70)]), '2026-11-17');
  assert.equal(excess.remaining, 0);
  assert.match(excess.note, /20 boven/);
  assert.equal(campaign.remainingNeed(product('a'), 50, campaignReceipts([receiptDay('2026-11-16',-2)]), '2026-11-17').remaining, 52);
  assert.equal(campaign.validCampaignDays([receiptDay('2026-11-16',100)]), true);
  assert.equal(campaign.validCampaignDays([receiptDay('2026-02-31',100)]), false);
  assert.equal(campaign.validCampaignDays([receiptDay('2026-11-16',NaN)]), false);
});

test('receipt endpoint rejects unauthorized sessions in development and production before reading data', async () => {
  let reads = 0;
  const imports = {
    '@/app/lib/auth/session': {getCurrentProfile:async()=>null}, '@/app/productie/access': {productionDepartments:()=>[]},
    '@/app/productie/inventorySource.server': {inventoryDispatchDays:async()=>{reads++;return[];}},
    '@/app/preview/productie/kerstvoorraad/campaignNeed': campaign,
  };
  const route = env => load('app/api/preview/kerstvoorraad/bonnen/route.ts', imports, {process:{env:{NODE_ENV:env}}, Response});
  assert.equal((await route('production').GET()).status, 403);
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


test('local settings preserve real production mappings without introducing demo recipe links', () => {
  const raw = JSON.stringify({version:1,growth:10,adjustments:{a:{name2026:'Nieuwe taart'}},mappings:{
    a:{recipeId:'recipe:real',productionItemId:'item:real',checked:true,stock:5000},
    b:{recipeId:[],productionItemId:'x'.repeat(201),checked:'yes'},
    c:null,
  }});
  const settings = adjustments.parseForecastSettings(raw);
  assert.equal(settings.mappings.a.recipeId, 'recipe:real');
  assert.equal(settings.mappings.a.productionItemId, 'item:real');
  assert.equal(settings.mappings.a.checked, true);
  assert.equal(settings.mappings.a.stock, undefined);
  assert.equal(settings.mappings.b.recipeId, '');
  assert.equal(settings.mappings.b.productionItemId, undefined);
  assert.equal(settings.mappings.b.checked, false);
  assert.equal(settings.mappings.c, undefined);
  assert.equal(Object.keys(adjustments.parseForecastSettings(null).mappings).length, 0);
  assert.equal(Object.keys(adjustments.parseForecastSettings(JSON.stringify({version:1,adjustments:{}})).mappings).length, 0);
});

function liveForecastSource(env, options = {}) {
  const imports = {
    'server-only': {},
    'next/navigation': {notFound:()=>{throw Error('not found');}},
    '@/app/lib/auth/session': {requireCurrentProfile:async()=>({id:'bakery'})},
    '@/app/productie/access': {productionDepartments:()=>options.allowed === false ? [] : ['luxe']},
    '@/app/productie/documents.server': {readDocument:async key=>{
      if (options.fail) throw Error('source unavailable');
      return {data:key === 'planner' ? options.planner || {version:1,items:[],tasks:[]} : {},revision:1};
    }},
    '@/app/productie/operationalStore.server': {readOperational:async()=>inventory.emptyInventory()},
    '@/app/productie/inventorySource.server': {inventoryDispatchDays:async()=>{
      if (options.receiptsFail) throw Error('receipts unavailable');
      return [receiptDay('2026-11-15',90),receiptDay('2026-11-16',100)];
    }},
    '@/app/productie/inventory': inventory,
    '@/app/productie/workspaceData': {todayAmsterdam:()=> '2026-11-17',recipeViews:()=>options.recipes || [],syncRecipeCatalog:planner=>planner},
    './campaignNeed': campaign,
  };
  return load('app/preview/productie/kerstvoorraad/liveSource.server.ts', imports, {process:{env:{NODE_ENV:env}}});
}

test('the authenticated local forecast starts from real output and recipes, counting a multi-step batch once', async () => {
  const planner = {version:1,items:[{id:'slof',name:'Woudvruchten slof',kind:'product',unit:'stuks',departmentId:'luxe',recipeId:'recipe-slof'}],tasks:[
    {id:'filling',itemId:'slof',batchId:'batch-slof',date:'2026-11-10',quantity:84,completedQuantity:84,status:'done',recordsOutput:false},
    {id:'finish',itemId:'slof',batchId:'batch-slof',date:'2026-11-11',quantity:84,completedQuantity:84,status:'done',recordsOutput:true},
  ]};
  const source = await liveForecastSource('development',{planner,recipes:[{id:'recipe-slof',name:'Woudvruchten slof',yield:84,unit:'stuks'}]}).christmasProductionSource();
  assert.equal(source.production.mode,'live');
  assert.equal(source.production.items[0].id,'slof');
  assert.equal(source.production.recipes[0].yield,84);
  assert.equal(source.production.overview.rows.find(row=>row.itemId==='slof').latest.quantity,84);
  assert.equal(source.campaignReceipts.available,true);
  assert.equal(source.campaignReceipts.days.length,1);
  assert.equal(source.campaignReceipts.days[0].date,'2026-11-16');
});

test('live forecast data works in production, rejects unauthorized access and never supplies examples on failure', async () => {
  assert.equal((await liveForecastSource('production').christmasProductionSource()).production.mode, 'live');
  await assert.rejects(liveForecastSource('development',{allowed:false}).christmasProductionSource(), /not found/);
  const failed = await liveForecastSource('development',{fail:true}).christmasProductionSource();
  assert.equal(failed.production.mode,'live');
  assert.equal(failed.production.items.length,0);
  assert.equal(failed.production.recipes.length,0);
  assert.equal(failed.production.overview.rows.length,0);
  assert.equal(failed.campaignReceipts.available,false);
  assert.match(failed.productionError,/niet bereikbaar/);
  const missingReceipts = await liveForecastSource('development',{receiptsFail:true}).christmasProductionSource();
  assert.equal(missingReceipts.campaignReceipts.available,false);
  assert.match(missingReceipts.productionError,/bonnen/);
});


const sharedForecast = load('app/preview/productie/kerstvoorraad/sharedSettings.ts', {'./adjustments':adjustments});
const forecastValue = choice => sharedForecast.forecastProductSettings(choice);
const forecastChange = (id, choice, previous = {}) => ({kind:'product',productId:id,value:forecastValue(choice),previous:forecastValue(previous)});
const applyShared = (state, command) => sharedForecast.applyForecastCommand(state,command,new Set(['a','b']),'employee','2026-11-13T11:00:00Z');

test('shared forecast merges independent product edits and rejects an overlapping stale edit', () => {
  const original = sharedForecast.emptySharedSettings();
  const first = applyShared(original,forecastChange('a',{adjustment:{periodTotal:1001}}));
  const second = applyShared(first,forecastChange('b',{adjustment:{growthPercent:15}}));
  assert.equal(second.adjustments.a.periodTotal,1001);
  assert.equal(second.adjustments.b.growthPercent,15);
  assert.equal(second.revision,2);
  assert.equal(second.updatedBy,'employee');
  assert.throws(()=>applyShared(second,forecastChange('a',{adjustment:{periodTotal:2000}})),sharedForecast.ForecastConflictError);
  assert.equal(second.adjustments.a.periodTotal,1001);
});

test('shared forecast retries are idempotent and invalid adjustments never erase data', () => {
  const command = forecastChange('a',{adjustment:{hidden:true,periodTotal:1001},recipeId:'real-recipe',checked:true});
  const saved = applyShared(sharedForecast.emptySharedSettings(),command);
  assert.equal(applyShared(saved,command),saved);
  assert.throws(()=>applyShared(saved,{...command,value:{...command.value,adjustment:{periodTotal:-1}}}),/Controleer/);
  assert.throws(()=>applyShared(saved,{...command,productId:'unknown'}),/verkoopbasis/);
  assert.equal(saved.adjustments.a.periodTotal,1001);
  assert.equal(saved.mappings.a.recipeId,'real-recipe');
});

test('shared growth is compared independently and shared choices never introduce demo values', () => {
  let state = applyShared(sharedForecast.emptySharedSettings(),{kind:'growth',previous:10,value:15});
  assert.equal(state.growth,15);
  assert.throws(()=>applyShared(state,{kind:'growth',previous:10,value:5}),sharedForecast.ForecastConflictError);
  state = applyShared(state,forecastChange('a',{adjustment:{periodTotal:1001}}));
  const choices = sharedForecast.choicesFromSettings([product('a')],state,{a:{...forecast.emptyChoice(),recipeId:'demo',checked:true}});
  assert.equal(choices.a.recipeId,'');
  assert.equal(choices.a.checked,false);
  assert.equal(forecast.productProjection(product('a'),choices.a,state.growth).weeklyTarget,251);
});

function sharedRoute(allowed, overrides = {}) {
  return load('app/api/productie/kerstvoorraad/route.ts', {
    '@/app/lib/auth/session':{getCurrentProfile:async()=>allowed?{id:'employee'}:null},
    '@/app/productie/access':{productionDepartments:()=>allowed?['luxe']:[]},
    '@/app/productie/documents.server':{ProductionStoreError:class extends Error{}},
    '@/app/preview/productie/kerstvoorraad/liveSource.server':{christmasProductionSource:async()=>({production:{mode:'live'}})},
    '@/app/preview/productie/kerstvoorraad/store.server':{
      readForecastSettings:async()=>sharedForecast.emptySharedSettings(),
      saveForecastCommand:async()=>sharedForecast.emptySharedSettings(),...overrides,
    },
    '@/app/preview/productie/kerstvoorraad/sharedSettings':sharedForecast,
  }, {Response,URL});
}

test('shared API authorizes reads and writes before touching storage and enforces request origin', async () => {
  const unavailable = async()=>{throw Error('storage must not be reached');};
  const route = sharedRoute(false,{readForecastSettings:unavailable,saveForecastCommand:unavailable});
  assert.equal((await route.GET(new Request('https://app.test/api/productie/kerstvoorraad'))).status,403);
  assert.equal((await route.PATCH(new Request('https://app.test/api/productie/kerstvoorraad',{method:'PATCH',body:'{}'}))).status,403);
  const authorized = sharedRoute(true,{saveForecastCommand:unavailable});
  assert.equal((await authorized.PATCH(new Request('https://app.test/api/productie/kerstvoorraad',{method:'PATCH',headers:{origin:'https://evil.test'},body:'{}'}))).status,403);
});

test('shared API serves private fresh settings and preserves conflict messages', async () => {
  const route = sharedRoute(true,{saveForecastCommand:async()=>{throw new sharedForecast.ForecastConflictError('Je invoer blijft staan.');}});
  const response = await route.GET(new Request('https://app.test/api/productie/kerstvoorraad?settings=1'));
  assert.equal(response.status,200);
  assert.equal(response.headers.get('cache-control'),'private, no-store');
  const data = await response.json();
  assert.equal(data.sharedSettings.growth,10);
  assert.equal(data.production,undefined);
  const conflict = await route.PATCH(new Request('https://app.test/api/productie/kerstvoorraad',{method:'PATCH',headers:{origin:'https://app.test'},body:'{}'}));
  assert.equal(conflict.status,409);
  assert.equal((await conflict.json()).message,'Je invoer blijft staan.');
});

test('shared storage retries a lost CAS write while preserving another product', async () => {
  class StoreError extends Error { constructor(message,status){super(message);this.status=status;} }
  let current = sharedForecast.emptySharedSettings(), writes = 0;
  const store = load('app/preview/productie/kerstvoorraad/store.server.ts',{
    'server-only':{},
    '@/app/productie/documents.server':{ProductionStoreError:StoreError},
    '@/app/productie/operationalStore.server':{
      readOperational:async(key)=>key===sharedForecast.SALES_KEY?{version:1,products:[product('a'),product('b')]}:current,
      saveOperational:async(key,revision,next)=>{
        writes++;
        if(writes===1){current=applyShared(current,forecastChange('b',{adjustment:{growthPercent:15}}));throw new StoreError('race',409);}
        assert.equal(revision,current.revision);current=next;
      },
    },
    './sharedSettings':sharedForecast,
  });
  const saved = await store.saveForecastCommand(forecastChange('a',{adjustment:{periodTotal:1001}}),'employee');
  assert.equal(writes,2);
  assert.equal(saved.adjustments.a.periodTotal,1001);
  assert.equal(saved.adjustments.b.growthPercent,15);
});


test('a coded product without a recipe or stock count still subtracts finalized dispatch', () => {
  const row = {...product('no-recipe'), name:'Product zonder recept'};
  const result = campaign.remainingNeed(row, 500, campaignReceipts([receiptDay('2026-11-16',80)]), '2026-11-17');
  assert.equal(result.remaining, 420);
  assert.equal(result.issued, 80);
  assert.equal(result.provisional, false);
});

test('incomplete lines cannot masquerade as a complete zero or a definitive forecast', () => {
  const days = [{...receiptDay('2026-11-16',0), unknownLines:4}];
  const result = campaign.remainingNeed(product('a'), 500, campaignReceipts(days), '2026-11-17');
  assert.equal(result.remaining, 500);
  assert.equal(result.provisional, true);
  const missingDay = campaign.remainingNeed(product('a'), 500, campaignReceipts(days), '2026-11-18');
  assert.equal(missingDay.remaining, null);
});

const pastryProducts = () => assorted.ASSORTED_PASTRIES.map(target => ({...product(target.id), cashCode:target.article, cash:100, bake:20, week52:{cash:10,bake:2}}));
const assortedProduct = (cash=21,bake=24) => ({...product('bakery:gesorteerd gebak'), cashCode:'10000', cash, bake, week52:{cash:8,bake:3}});
const sumChannel = (rows,channel) => rows.reduce((total,row)=>total+(row[channel]??0),0);

test('assorted pastries use exactly the owner-selected 15 article numbers', () => {
  assert.equal(assorted.ASSORTED_PASTRIES.length,15);
  assert.equal(new Set(assorted.ASSORTED_PASTRIES.map(row=>row.article)).size,15);
  assert.equal(Array.from(assorted.ASSORTED_PASTRIES,row=>row.article).join(','),'10100,10101,10102,10200,10301,10400,10401,10402,10403,10404,10405,10407,10409,10430,10431');
});

test('historical assorted sales are added to individual sales once before uplift, preserving both channel totals', () => {
  const own=pastryProducts(), rows=[...own,assortedProduct()];
  const before=JSON.stringify(rows), result=assorted.allocateAssortedSales(rows);
  assert.equal(result.length,15);
  assert.equal(JSON.stringify(rows),before);
  assert.equal(sumChannel(result,'cash'),sumChannel(rows,'cash'));
  assert.equal(sumChannel(result,'bake'),sumChannel(rows,'bake'));
  assert(result.every(row=>row.cash+row.bake===123));
  assert(result.every(row=>row.assortedSales.cash+row.assortedSales.bake===3));
  assert.equal(JSON.stringify(assorted.allocateAssortedSales(result)),JSON.stringify(result));
  const choice={...forecast.emptyChoice(),adjustment:{periodTotal:150}};
  assert.equal(forecast.productProjection(result[0],choice,10).period,150);
  assert.equal(forecast.productProjection(result[0],forecast.emptyChoice(),10).period,136);
});

test('week-52 allocation uses its own total and conserves pieces even when the total is not divisible by 15', () => {
  const rows=assorted.allocateAssortedSales([...pastryProducts(),assortedProduct()]);
  assert.equal(rows.reduce((n,row)=>n+row.week52.cash,0),158);
  assert.equal(rows.reduce((n,row)=>n+row.week52.bake,0),33);
  const shares=rows.map(row=>row.assortedSales.week52);
  assert.equal(shares.reduce((a,b)=>a+b,0),11);
  assert.equal(Math.max(...shares)-Math.min(...shares),1);
  assert.equal(rows.filter(row=>row.week52.cash+row.week52.bake===13).length,11);
});

test('approved seasonal names merge into one article without duplicating sales or clearing other variant uncertainty', () => {
  const rows=pastryProducts().map(row=>({...row,articleAmbiguous:true}));
  const alias={...product('bakery:lente parel'),cashCode:'10402',cash:null,bake:7,week52:{cash:0,bake:1},articleAmbiguous:true};
  const result=assorted.allocateAssortedSales([...rows,alias,assortedProduct()]);
  const pear=result.find(row=>row.cashCode==='10402');
  assert.equal(result.filter(row=>row.cashCode==='10402').length,1);
  assert.equal(pear.cash+pear.bake,130);
  assert.equal(pear.week52.cash+pear.week52.bake,14);
  assert.equal(pear.articleAmbiguous,false);
  assert(pear.searchNames.includes(alias.name));
  const unknown={...product('unrecognized-size'),cashCode:'10402',cash:2};
  const unsafe=assorted.allocateAssortedSales([...rows,unknown,assortedProduct()]);
  assert.equal(unsafe.find(row=>row.cashCode==='10000').cash,21);
  assert.match(unsafe.find(row=>row.cashCode==='10000').note,/nog niet verdeeld/);
  assert.equal(unsafe[0].assortedSales,undefined);
});

test('missing recipient or unverified weekly source stays explicit instead of distributing over fewer pastries', () => {
  const rows=pastryProducts(), source=assortedProduct();
  const missing=assorted.allocateAssortedSales([...rows.slice(1),source]);
  assert.equal(missing.length,15);
  assert(missing.every(row=>!row.assortedSales));
  const noWeek=assorted.allocateAssortedSales([...rows,{...source,week52:undefined}]);
  assert.equal(forecast.productProjection(noWeek[0],forecast.emptyChoice(),10).week52,null);
  assert.match(noWeek[0].week52.issue,/ontbreekt/);
});

test('equal allocations preserve fractional source quantities and reverse returns', () => {
  for(const total of [0,1,14,15,16,161,1575,-1,-31,1.5]) {
    const shares=Array.from(assorted.assortedShares(total));
    assert(Math.abs(shares.reduce((a,b)=>a+b,0)-total)<1e-8);
    assert(Math.max(...shares)-Math.min(...shares)<=1+1e-8);
    assert.equal(shares.join(','),Array.from(assorted.assortedShares(-total),n=>-n).join(','));
  }
});

const pastryDay=(date,quantity,extra=[])=>({...receiptDay(date,0),lines:[{article:'10000',description:'Gesorteerd gebak',quantity},...extra]});
test('daily assorted demand includes direct sales and allocates the deduplicated cumulative total without double counting', () => {
  const days=[pastryDay('2026-11-16',14),pastryDay('2026-11-16',1),pastryDay('2026-11-17',1,[{article:'10100',description:'Bossche Bol',quantity:5}])];
  days[1].importedAt='2026-11-16T19:00:00Z';
  const receipts=campaignReceipts(days), window=campaign.campaignWindow(receipts,'2026-11-18');
  assert.equal(window.quantities.has('10000'),false);
  assert.equal(Array.from(window.quantities.values()).reduce((a,b)=>a+b,0),7);
  const results=pastryProducts().map(row=>campaign.remainingNeed(row,100,receipts,'2026-11-18',window));
  assert.equal(results[0].issued,6);
  assert.equal(results[1].issued,1);
  assert.equal(results[2].issued,0);
  assert.equal(results.reduce((n,row)=>n+row.issued,0),7);
  assert.equal(results[0].remaining,94);
  assert.equal(results[0].assortedIssued,1);
  assert.equal(results[0].provisional,true);
  assert.match(results[0].note,/gesorteerd gebak \(geschat\)/);
  assert.equal(results[2].provisional,false);
  assert.equal(campaign.remainingNeed(pastryProducts()[0],100,receipts,'2026-11-19').remaining,null);
});

test('assorted dispatch honors dates, returns, unmapped replacements and hidden recipients without redistributing shares', () => {
  const receipts=campaignReceipts([pastryDay('2026-11-15',999),pastryDay('2026-11-16',-30),pastryDay('2026-11-17',100)]);
  const row=pastryProducts()[0];
  assert.equal(campaign.remainingNeed(row,100,receipts,'2026-11-16').remaining,100);
  assert.equal(campaign.remainingNeed(row,100,receipts,'2026-11-17').remaining,102);
  const replaced=forecast.productFor2026(row,{...forecast.emptyChoice(),adjustment:{name2026:'Nieuw gebakje',cashCode2026:'12345'}});
  assert.equal(campaign.remainingNeed(replaced,100,receipts,'2026-11-17').issued,0);
  const partial=campaign.remainingNeed(row,100,campaignReceipts([{...pastryDay('2026-11-16',15),unknownLines:2}]),'2026-11-17');
  assert.equal(partial.unresolvedLines,2);
  assert.match(partial.note,/bonregels controleren/);
});

const flan = (id, variant, cash, bake = 0, extra = {}) => ({ ...product(id), name: `Kersenvlaai · ${variant}`, salesName: 'Kersenvlaai', salesVariant: variant,
  cashCode: '30103', bakeCode: '305', cash, bake, group: 'slof', articleAmbiguous: true, ...extra });

test('large flans sum 10–12p and cut 14-point whole flans before forecast rounding; 8p stays separate', () => {
  const large = flan('large','10–12p',60.9,65,{week52:{cash:7.25,bake:3}});
  const cut = flan('cut','gesneden 14 punten',null,90,{week52:{cash:0,bake:4}});
  const small = flan('small','8p',158,3,{week52:{cash:26,bake:0}});
  const input=[cut,small,large], before=JSON.stringify(input);
  const result=flans.combineLargeFlans(input), merged=result.find(p=>p.combinedFlan);
  assert.equal(result.length,2); assert.equal(merged.id,'large');
  assert.equal(merged.name,'Kersenvlaai · 10–12/14p');
  assert.equal(merged.cash,60.9); assert.equal(merged.bake,155);
  assert.equal(merged.week52.cash,7.25); assert.equal(merged.week52.bake,7);
  assert.equal(merged.members.length,2); assert.equal(merged.articleAmbiguous,true);
  assert.equal(result.find(p=>p.id==='small'),small);
  assert.equal(forecast.productProjection(merged,forecast.emptyChoice(),10).period,238);
  assert.equal(forecast.productProjection(merged,forecast.emptyChoice(),10).week52,16);
  assert.equal(forecast.productProjection(merged,{...forecast.emptyChoice(),adjustment:{periodTotal:300,week52Total:50}},10).period,300);
  assert.equal(JSON.stringify(input),before);
  assert.equal(JSON.stringify(flans.combineLargeFlans(result)),JSON.stringify(result));
});

test('other flan flavors, unknown subcodes and smaller sizes do not get merged accidentally', () => {
  const small=flan('small','8p',8), unknown=flan('unknown','per punt',5);
  const special=flan('special','gesneden 14 punten glutenvrij',3);
  const apple=flan('apple','14p',2,0,{salesName:'Appelvlaai 14p',name:'Appelvlaai 14p',cashCode:'30101'});
  const cherry=flan('cherry','10–12p',3);
  const single=flan('single','',null,1,{name:'Perenvlaai 10-12p',salesName:'Perenvlaai 10-12p',cashCode:'30107'});
  const cut=flan('pear-cut','gesneden 14 punten',null,46,{name:'Perenvlaai 10-12p · gesneden 14 punten',salesName:'Perenvlaai 10-12p',cashCode:'30107'});
  const result=flans.combineLargeFlans([small,unknown,special,apple,cherry,single,cut]);
  assert.equal(result.find(p=>p.id==='small'),small); assert.equal(result.find(p=>p.id==='unknown'),unknown);
  assert.equal(result.find(p=>p.id==='special'),special);
  assert.equal(result.find(p=>p.id==='cherry'),cherry);
  assert.equal(result.find(p=>p.id==='apple').cash,2);
  assert.equal(result.find(p=>p.id==='single').bake,47);
  assert.equal(result.find(p=>p.id==='single').cash,null);
  assert.equal(result.find(p=>p.id==='single').name,'Perenvlaai · 10–12/14p');
});

test('an explicit small subcode overrides a large base name and seasonal aliases require the known article', () => {
  const small=flan('small','8p',6,0,{salesName:'Kersenvlaai 10-12p',name:'Kersenvlaai 10-12p · 8p'});
  const a=flan('autumn','10–12p',23.2,null,{salesName:'Herfstvlaai Caramel-Hazelnoot',cashCode:'30801'});
  const b=flan('seasonal','10–12p',null,8,{salesName:'Seizoensvlaai Caramel-Hazelnoot',cashCode:'30801'});
  const result=flans.combineLargeFlans([small,a,b]);
  assert.equal(result.length,2); assert.equal(result[0],small);
  assert.equal(result[1].cash,23.2); assert.equal(result[1].bake,8);
  const unverified=flans.combineLargeFlans([{...a,cashCode:'99'},{...b,cashCode:'99'}]);
  assert.equal(unverified.length,2);
});

test('incomplete weekly coverage and unknown flan units remain explicit', () => {
  const a=flan('a','10–12p',5,0,{week52:{cash:1,bake:0}}),b=flan('b','14p',4);
  const merged=flans.combineLargeFlans([a,b])[0];
  assert.match(merged.week52.issue,/ontbreekt/);
  assert.equal(forecast.productProjection(merged,forecast.emptyChoice(),10).week52,null);
  const unknown=flans.combineLargeFlans([a,{...b,unitUnconfirmed:true}])[0];
  assert.equal(unknown.unitUnconfirmed,true);
  assert.equal(forecast.productProjection(unknown,forecast.emptyChoice(),10).period,null);
});

test('daily flan receipts sum unique codes once, but never subtract an indistinguishable 8p article', () => {
  const a=flan('a','10–12p',20,0),b=flan('b','14p',30,0,{cashCode:'30109'});
  const receipts={mode:'live',available:true,days:[{date:'2026-11-16',importedAt:'2026-11-16T18:00:00Z',unknownLines:0,lines:[
    {article:'30103',description:'Kersenvlaai',quantity:3},{article:'30109',description:'Kersenvlaai gesneden',quantity:4}]}]};
  const merged=flans.combineLargeFlans([a,b])[0];
  const need=campaign.remainingNeed(merged,100,receipts,'2026-11-17');
  assert.equal(need.issued,7); assert.equal(need.remaining,93);
  const small=flan('small','8p',20);
  const ambiguous=flans.combineLargeFlans([a,b,small]).find(p=>p.combinedFlan);
  assert.equal(campaign.remainingNeed(ambiguous,100,receipts,'2026-11-17').remaining,null);
  assert.match(campaign.remainingNeed(ambiguous,100,receipts,'2026-11-17').note,/Vlaaiformaat/);
  const replacement=forecast.productFor2026(merged,{...forecast.emptyChoice(),adjustment:{name2026:'Nieuwe vlaai',cashCode2026:'88000'}});
  assert.equal(replacement.members,undefined); assert.equal(replacement.combinedFlan,undefined);
  assert.equal(campaign.remainingNeed(replacement,100,receipts,'2026-11-17').issued,0);
});


test('a replacement cannot silently reuse the secondary code of a combined flan', () => {
  const a=flan('a','10–12p',20),b=flan('b','14p',30,0,{cashCode:'30109'});
  const merged=flans.combineLargeFlans([a,b])[0];
  const other={...product('other'),cashCode:'55555'};
  const choices={other:{...forecast.emptyChoice(),adjustment:{name2026:'Ander product',cashCode2026:'30109'}}};
  const mapped=forecast.mappedProductsFor2026([merged,other],choices,10);
  assert.equal(mapped[0].articleAmbiguous,true); assert.equal(mapped[1].articleAmbiguous,true);
  const hidden=forecast.mappedProductsFor2026([merged,other],{other:{...choices.other,adjustment:{...choices.other.adjustment,hidden:true}}},10);
  assert.equal(hidden[0].articleAmbiguous,false);
});


test('purchased bread is excluded by its inclusive current article range', () => {
  for (const cashCode of ['145100', '145101', '148000', '150802', ' 150802 ']) {
    assert.equal(assortment.includeInStockOverview({...product('bread'), group:'bak', cashCode, cash:1000}, 10), false, cashCode);
  }
  for (const cashCode of ['145099', '150803']) {
    assert.equal(assortment.includeInStockOverview({...product('bread'), group:'bak', cashCode, cash:1000, bakeCode:'145100'}, 10), true, cashCode);
  }
});

const countItem = {id:'finished', name:'Gebak', kind:'product', unit:'stuks', departmentId:'luxe', stock:0, note:''};
const counted = (id, date, quantity) => ({id, itemId:countItem.id, unit:'stuks', date, quantity, who:'Bakker', actorId:'bakery', at:`${date}T19:00:00Z`});
function countedRow(counts, days, date, tasks = []) {
  return inventory.inventoryOverview({version:1, items:[countItem], tasks}, {
    ...inventory.emptyInventory(), counts, links:[{itemId:countItem.id, article:'10', factor:1, unit:'stuks', leadDays:1}],
  }, days, date).rows[0];
}
const campaignDaysThrough = (date, quantities = {}) => {
  const days = [];
  for (let current = campaign.CAMPAIGN_START; current <= date; current = planning.addDays(current, 1)) days.push(receiptDay(current, quantities[current] || 0));
  return days;
};

test('a dated physical count produces remaining production at the same end-of-day cutoff', () => {
  const days = campaignDaysThrough('2026-11-27', {'2026-11-16':150, '2026-11-27':50});
  const row = countedRow([counted('count-27', '2026-11-27', 300)], days, '2026-11-27');
  const result = overview.productionRequirement(product('a'), 1000, row, campaignReceipts(days));
  assert.equal(row.count.date, '2026-11-27');
  assert.equal(result.stock, 300);
  assert.equal(result.quantity, 500);
  assert.equal(result.through, '2026-11-27');
  // The 50 already dispatched on the count day must not be demanded again.
  assert.equal(campaign.remainingNeed(product('a'), 1000, campaignReceipts(days), '2026-11-27').remaining, 850);
});

test('later production lowers remaining work while dispatch is deducted only once', () => {
  const days = campaignDaysThrough('2026-11-28', {'2026-11-16':150, '2026-11-27':50, '2026-11-28':40});
  const task = {id:'output', itemId:countItem.id, batchId:'one-batch', departmentId:'luxe', date:'2026-11-28', quantity:80, completedQuantity:100, recordsOutput:true, status:'done'};
  const row = countedRow([counted('count-27', '2026-11-27', 300)], days, '2026-11-28', [task, {...task, id:'duplicate-step'}]);
  assert.equal(row.made, 100);
  assert.equal(row.issued, 40);
  assert.equal(row.balance, 360);
  const result = overview.productionRequirement(product('a'), 1000, row, campaignReceipts(days));
  assert.equal(result.quantity, 400);
});

test('a later count replaces previous assumptions and keeps prior production out of the new balance', () => {
  const days = campaignDaysThrough('2026-11-28', {'2026-11-16':150, '2026-11-27':50, '2026-11-28':40});
  const task = {id:'made-before-count', itemId:countItem.id, batchId:'one-batch', departmentId:'luxe', date:'2026-11-28', quantity:100, recordsOutput:true, status:'done'};
  const row = countedRow([counted('old', '2026-11-27', 300), counted('new', '2026-11-28', 200)], days, '2026-11-28', [task]);
  assert.equal(row.count.id, 'new');
  assert.equal(row.made, 0);
  assert.equal(row.issued, 0);
  assert.equal(overview.productionRequirement(product('a'), 1000, row, campaignReceipts(days)).quantity, 560);
});

test('zero stock, excess stock and a missing count remain distinguishable', () => {
  const days = campaignDaysThrough('2026-11-27', {'2026-11-16':200});
  const input = quantity => countedRow([counted('count', '2026-11-27', quantity)], days, '2026-11-27');
  assert.equal(overview.productionRequirement(product('a'), 1000, input(0), campaignReceipts(days)).quantity, 800);
  const excess = overview.productionRequirement(product('a'), 1000, input(900), campaignReceipts(days));
  assert.equal(excess.quantity, 0);
  assert.equal(excess.excess, 100);
  assert.equal(overview.productionRequirement(product('a'), 1000, null, campaignReceipts(days)).quantity, null);
});

test('today counts wait for complete same-day demand and ambiguous formats stay unresolved', () => {
  const days = campaignDaysThrough('2026-11-26');
  const row = countedRow([counted('today', '2026-11-27', 300)], days, '2026-11-27');
  const missing = overview.productionRequirement(product('a'), 1000, row, campaignReceipts(days));
  assert.equal(missing.stock, 300);
  assert.equal(missing.quantity, null);
  assert.match(missing.note, /1 bondag/);
  const complete = [...days, receiptDay('2026-11-27',0)];
  assert.equal(overview.productionRequirement({...product('a'),articleAmbiguous:true}, 1000, row, campaignReceipts(complete)).quantity, null);
  const partial = complete.map(day => day.date === '2026-11-27' ? {...day, unknownLines:1} : day);
  assert.equal(overview.productionRequirement(product('a'), 1000, row, campaignReceipts(partial)).provisional, true);
});

test('campaign windows can be shared across products without changing dated count calculations', () => {
  const days = campaignDaysThrough('2026-11-27', {'2026-11-16':200});
  const row = countedRow([counted('count', '2026-11-27',300)], days, '2026-11-27');
  const receipts = campaignReceipts(days);
  const window = campaign.campaignWindow(receipts, '2026-11-28');
  assert.equal(JSON.stringify(overview.productionRequirement(product('a'), 1000, row, receipts, window)), JSON.stringify(overview.productionRequirement(product('a'), 1000, row, receipts)));
});

const stockCountInput = {id:'count-action', itemId:'finished', previousCountId:'previous', date:'2026-11-27', quantity:300, who:'Bakker'};
const countResponse = (revision, countId = 'previous') => ({revision, rows:[{itemId:'finished', kind:'product', unit:'stuks', count:countId ? {id:countId} : null}]});
const response = (status, value) => ({status, ok:status >= 200 && status < 300, json:async()=>value});

test('dated counts use the normal shared inventory endpoint and retain their action ID', async () => {
  const requests = [];
  const saved = countResponse(8, 'count-action:finished');
  const result = await stockCount.registerStockCount(stockCountInput, async (url, options) => {
    requests.push({url, options});
    return response(200, options.method === 'POST' ? saved : countResponse(7));
  });
  assert.equal(result, saved);
  assert.equal(requests.length, 2);
  assert(requests.every(request => request.url === '/api/productie/voorraad'));
  assert.equal(requests[0].options.cache, 'no-store');
  assert.deepEqual(JSON.parse(requests[1].options.body), {id:'count-action', revision:7, command:{kind:'count', date:'2026-11-27', who:'Bakker', entries:[{itemId:'finished',quantity:300}]}});
});

test('a concurrent count for another product retries against the current inventory revision', async () => {
  let gets = 0, posts = 0;
  const revisions = [];
  await stockCount.registerStockCount(stockCountInput, async (_url, options) => {
    if (options.method !== 'POST') return response(200, countResponse(7 + gets++));
    revisions.push(JSON.parse(options.body).revision);
    return posts++ ? response(200, countResponse(9, 'count-action:finished')) : response(409, {message:'Andere telling'});
  });
  assert.deepEqual(revisions, [7,8]);
});

test('a newer count for the same product is preserved and a lost success is recovered', async () => {
  let posts = 0;
  await assert.rejects(stockCount.registerStockCount(stockCountInput, async (_url, options) => {
    if (options.method === 'POST') posts++;
    return response(200, countResponse(8, 'another-baker:finished'));
  }), /intussen opnieuw geteld/);
  assert.equal(posts, 0);
  const result = await stockCount.registerStockCount(stockCountInput, async () => response(200, countResponse(8, 'count-action:finished')));
  assert.equal(result.revision, 8);
});

test('unavailable storage, changed products and persistent conflicts leave the count unconfirmed', async () => {
  await assert.rejects(stockCount.registerStockCount(stockCountInput, async () => response(503,{message:'Voorraad niet bereikbaar'})), /Voorraad niet bereikbaar/);
  await assert.rejects(stockCount.registerStockCount(stockCountInput, async () => response(200,{revision:8,rows:[]})), /productieartikel is gewijzigd/);
  let attempts = 0;
  await assert.rejects(stockCount.registerStockCount(stockCountInput, async (_url, options) => {
    if (options.method !== 'POST') return response(200, countResponse(8));
    attempts++;
    return response(409,{message:'Nieuwe wijziging'});
  }), /Nieuwe wijziging/);
  assert.equal(attempts, 3);
});


const petitFour = (code, cash, bake = 0, extra = {}) => ({ ...product(`petit:${code}`),
  name: { '65300': 'Petit Four (p.s.)', '65301': 'Petit Four met tekst', '65302': 'Petit Four met logo' }[code],
  cashCode: code, bakeCode: { '65300': '550', '65301': '551', '65302': '552' }[code],
  group: 'overig', cash, bake, week52: { cash: 10, bake: 1 }, ...extra,
});

test('petit fours combine all three per-piece articles before uplift and keep the existing plain article ID', () => {
  const input = [petitFour('65302',300,3), petitFour('65301',200,2), petitFour('65300',100,1)];
  const before = JSON.stringify(input);
  const combined = assortment.combinePetitFours(input);
  assert.equal(combined.length,1);
  const p = combined[0];
  assert.equal(p.name,'Petit fours wit'); assert.equal(p.id,'petit:65300');
  assert.equal(p.cash,600); assert.equal(p.bake,6);
  assert.equal(p.week52.cash,30); assert.equal(p.week52.bake,3);
  assert.equal(p.members.length,3);
  assert.equal(forecast.productProjection(p,forecast.emptyChoice(),10).period,667);
  assert.equal(forecast.productProjection(p,forecast.emptyChoice(),10).week52,37);
  for (const query of ['65300','65301','65302','550','551','552','logo','tekst']) assert(planning.matchesProductionSearch(query,p.searchNames),query);
  assert.equal(JSON.stringify(input),before);
  assert.equal(JSON.stringify(assortment.combinePetitFours(combined)),JSON.stringify(combined));
});

test('petit-four packs and special subcodes remain separate, and incomplete quantities stay unknown', () => {
  const pack = { ...product('pack'), name:'Petit Four (6st)', cashCode:'65001' };
  const special = petitFour('65300',10,0,{id:'special',salesVariant:'doos 6 stuks'});
  const source = [pack,special,petitFour('65300',null,null),petitFour('65301',null,null)];
  const result = assortment.combinePetitFours(source);
  assert.equal(result.length,3); assert.equal(result[0],pack); assert.equal(result[1],special);
  assert.equal(result[2].cash,null); assert.equal(result[2].bake,null);
  assert.equal(forecast.productProjection(result[2],forecast.emptyChoice(),10).period,null);
  const noWeek = assortment.combinePetitFours([petitFour('65300',20),petitFour('65301',30,0,{week52:undefined})])[0];
  assert.match(noWeek.week52.issue,/ontbreekt/);
  const unknown = assortment.combinePetitFours([petitFour('65300',20),petitFour('65301',30,0,{unitUnconfirmed:true})])[0];
  assert.equal(unknown.unitUnconfirmed,true);
});

test('petit-four daily receipts use all three current articles and exclude old Bake-it numbers', () => {
  const products = assortment.combinePetitFours([petitFour('65300',100),petitFour('65301',100),petitFour('65302',100)]);
  const p = forecast.mappedProductsFor2026(products,{},10)[0];
  assert.equal(p.articleAmbiguous,false);
  const receipts = campaignReceipts([{ ...receiptDay('2026-11-16',0), lines: [
    {article:'65300',description:'Petit Four',quantity:3}, {article:'65301',description:'Tekst',quantity:4},
    {article:'65302',description:'Logo',quantity:5}, {article:'550',description:'Other article namespace',quantity:999},
  ] }]);
  const need = campaign.remainingNeed(p,330,receipts,'2026-11-17');
  assert.equal(need.issued,12); assert.equal(need.remaining,318);
  const repeated = campaign.remainingNeed(p,330,{...receipts,days:[...receipts.days,{...receipts.days[0],importedAt:'2026-11-16T20:00:00Z'}]},'2026-11-17');
  assert.equal(repeated.issued,12);
  const returned = campaign.remainingNeed(p,330,campaignReceipts([{...receipts.days[0],lines:[{article:'65302',description:'Retour',quantity:-2}]}]),'2026-11-17');
  assert.equal(returned.remaining,332);
});

test('stored marzipan groups retain every article for daily demand without subtracting repeated codes twice', () => {
  const rows = [
    {...product('a'), name:'Marsepeintaart Bloemetjes', group:'taart',cashCode:'25201'},
    {...product('b'), name:'Marsepeintaart Kleurrijk', group:'taart',cashCode:'25202'},
    {...product('c'), name:'Marsepeintaart Blauw', group:'taart',cashCode:'25202'},
  ];
  const grouped = assortment.aggregateMarzipanCakes(rows);
  assert.equal(grouped[0].articleAmbiguous,true,'stored historical groups require validation against the complete current overview');
  const p = forecast.mappedProductsFor2026(grouped,{},10)[0];
  assert.equal(p.articleAmbiguous,false);
  assert.deepEqual(Array.from(salesArticles.salesArticleCodes(p)),['25201','25202']);
  const receipts = campaignReceipts([{...receiptDay('2026-11-16',0),lines:[
    {article:'25201',description:'Bloemetjes',quantity:3}, {article:'25202',description:'Kleurrijk',quantity:4},
  ]}]);
  assert.equal(campaign.remainingNeed(p,100,receipts,'2026-11-17').issued,7);
});

test('a shared small-cake article and incomplete grouped codes remain unresolved in daily demand', () => {
  const large = {...product('a'),name:'Marsepeintaart 10–12p',cashCode:'25200',group:'taart'};
  const small = {...product('small'),name:'Marsepeintaart 6–8p',cashCode:'25200',group:'taart'};
  const mapped = forecast.mappedProductsFor2026(assortment.aggregateMarzipanCakes([large,small]),{},10);
  const group = mapped.find(row=>row.members);
  assert.equal(group.articleAmbiguous,true);
  assert.equal(campaign.remainingNeed(group,100,campaignReceipts([receiptDay('2026-11-16',1)]),'2026-11-17').remaining,null);
  const incomplete = {...group,members:[large,{...large,id:'unknown',cashCode:''}]};
  const missing = forecast.mappedProductsFor2026([incomplete],{},10)[0];
  assert.equal(missing.articleAmbiguous,true);
  assert(salesArticles.salesArticleCodes(missing).includes(''));
});

test('a replacement cannot reuse any grouped petit-four article while a hidden replacement does not consume it', () => {
  const p = assortment.combinePetitFours([petitFour('65300',100),petitFour('65301',100),petitFour('65302',100)])[0];
  const other = {...product('other'),cashCode:'55555'};
  const choice = {...forecast.emptyChoice(),adjustment:{name2026:'Ander product',cashCode2026:'65302'}};
  const choices = {other:choice};
  const mapped = forecast.mappedProductsFor2026([p,other],choices,10);
  assert.equal(mapped[0].articleAmbiguous,true); assert.equal(mapped[1].articleAmbiguous,true);
  const hidden = forecast.mappedProductsFor2026([p,other],{other:{...choice,adjustment:{...choice.adjustment,hidden:true}}},10);
  assert.equal(hidden[0].articleAmbiguous,false);
  const replacement = forecast.productFor2026(p,{...forecast.emptyChoice(),adjustment:{name2026:'Petit fours nieuw',cashCode2026:'65399'}});
  assert.deepEqual(Array.from(salesArticles.salesArticleCodes(replacement)),['65399']);
});

test('nested grouped article lists remain complete and use one occurrence of each receipt article', () => {
  const a=petitFour('65300',100),b=petitFour('65301',100),c=petitFour('65302',100);
  const p={...a,id:'outer',members:[{...a,id:'inner',members:[a,b]},b,c],articleAmbiguous:false};
  assert.deepEqual(Array.from(salesArticles.salesArticleCodes(p)),['65300','65301','65302']);
  const receipts=campaignReceipts([{...receiptDay('2026-11-16',0),lines:[
    {article:'65300',description:'A',quantity:3},{article:'65301',description:'B',quantity:4},{article:'65302',description:'C',quantity:5},
  ]}]);
  assert.equal(campaign.remainingNeed(p,300,receipts,'2026-11-17').issued,12);
});


const kruidcake = (code, cash, bake = 0, extra = {}) => ({
  ...product(`kruidcake:${code}`),
  name: { '40350': 'Kruidcake', '40821': 'Sint Pepernoten Kruidcake', '40861': 'Seizoens Kruidcake (Koningsdag)' }[code],
  cashCode: code,
  bakeCode: { '40350': '1034', '40821': '2307', '40861': '805608' }[code],
  group: 'bak', department: 'bak', cash, bake, week52: { cash: 20, bake: 5 }, ...extra,
});

test('approved whole kruidcakes share one forecast and retain all source articles', () => {
  const source = [kruidcake('40821',363), kruidcake('40861',335), kruidcake('40350',295)];
  const original = JSON.stringify(source);
  const grouped = assortment.combineKruidcakes(source);
  assert.equal(grouped.length,1);
  const combined = grouped[0];
  assert.equal(combined.name,'Kruidcake');
  assert.equal(combined.group,'bak');
  assert.equal(combined.id,'kruidcake:40350');
  assert.equal(combined.cash,993);
  assert.equal(combined.week52.cash,60);
  assert.equal(combined.week52.bake,15);
  assert.equal(forecast.productProjection(combined,forecast.emptyChoice(),10).period,1093);
  assert.deepEqual(Array.from(salesArticles.salesArticleCodes(combined)).sort(),['40350','40821','40861']);
  for (const code of ['40350','40821','40861','1034','2307','805608']) assert(combined.searchNames.includes(code));
  assert.equal(JSON.stringify(source),original);
  assert.equal(JSON.stringify(assortment.combineKruidcakes(grouped)),JSON.stringify(grouped));
});

test('daily kruidcake receipts use every grouped code once and keep other cakes separate', () => {
  const bite = {...product('bite'),name:'Kruidcake Bite',cashCode:'40800'};
  const christmas = {...product('christmas'),name:'Kerst Kruidcake',cashCode:'40842'};
  const special = kruidcake('40350',50,0,{id:'pack',salesVariant:'doos 6 stuks'});
  const grouped = assortment.combineKruidcakes([bite,christmas,special,kruidcake('40350',100),kruidcake('40821',100),kruidcake('40861',100)]);
  assert.equal(grouped.length,4);
  assert.equal(grouped[0],bite);
  assert.equal(grouped[1],christmas);
  assert.equal(grouped[2],special);
  const current = forecast.mappedProductsFor2026(grouped.slice(3),{},10)[0];
  assert.equal(current.articleAmbiguous,false);
  const receipts = campaignReceipts([{...receiptDay('2026-11-16',0),lines:[
    {article:'40350',description:'Kruidcake',quantity:3},
    {article:'40821',description:'Sint',quantity:4},
    {article:'40861',description:'Seizoen',quantity:5},
    {article:'40842',description:'Kerst',quantity:100},
    {article:'1034',description:'Oud Bake-it nummer',quantity:100},
  ]}]);
  const need = campaign.remainingNeed(current,330,receipts,'2026-11-17');
  assert.equal(need.issued,12);
  assert.equal(need.remaining,318);
  const collision = forecast.mappedProductsFor2026(grouped,{},10).find(row=>row.id===current.id);
  assert.equal(collision.articleAmbiguous,true,'shared format codes remain subject to checking');
});


test('Petit DV restores saved packs and per-piece articles without changing raw sales or IDs', () => {
  const rows = [
    {...product('gateau6'),name:'Petit Gateau (6st)',cashCode:'10601',cash:331,bake:29,unitUnconfirmed:true,week52:{cash:121,bake:0}},
    {...product('creme15'),name:'Petit Creme (15st)',cashCode:'65101',cash:136,bake:36,unitUnconfirmed:true,week52:{cash:30,bake:6}},
    {...product('fours6'),name:'Petit Four (6st)',cashCode:'65100',cash:74,bake:55,unitUnconfirmed:true,week52:{cash:16,bake:12}},
    {...product('fleur'),name:'Petit Fleur (p.s.)',cashCode:'65903',cash:null,bake:210},
    {...product('creme'),name:'Petit Creme per stuk',cashCode:'65303',cash:30,bake:80},
    {...product('chou'),name:'Petit Chou Slagroomsoesjes (±200gr)',cashCode:'65200',cash:110,bake:9},
  ];
  const before=JSON.stringify(rows);
  const result=petitProducts.normalizePetitProducts(rows);
  assert.equal(JSON.stringify(rows),before);
  assert.equal(JSON.stringify(petitProducts.normalizePetitProducts(result)),JSON.stringify(result));
  for(const row of result) {
    assert.equal(row.group,'petit-dv');
    assert(assortment.includeInStockOverview(row,10),row.name);
    assert.equal(row.id,rows.find(old=>old.id===row.id).id);
  }
  for(const [id,period,week52,size] of [['gateau6',2376,799,6],['creme15',2838,594,15],['fours6',852,185,6]]) {
    const row=result.find(p=>p.id===id), projection=forecast.productProjection(row,forecast.emptyChoice(),10);
    assert.equal(projection.period,period,id);
    assert.equal(projection.week52,week52,id);
    assert.equal(row.unitsPerSale,size);
    assert.equal(row.unitUnconfirmed,false);
  }
  assert.equal(result.find(p=>p.id==='chou').quantityLabel,'zakjes');
  assert.equal(forecast.productProjection(result.find(p=>p.id==='chou'),forecast.emptyChoice(),10).period,131);
});

test('Petit DV preserves uncertain packages, nonstandard subcodes, weights and seasonal categories', () => {
  const cases=[
    {...product('fraction'),name:'Petit Four (6st)',cashCode:'65100',cash:2.5,unitUnconfirmed:true},
    {...product('subcode'),name:'Petit Four (6st)',cashCode:'65100',salesVariant:'doos 12 stuks',unitUnconfirmed:true},
    {...product('other-code'),name:'Petit Four (6st)',cashCode:'65199',unitUnconfirmed:true},
    {...product('other-pack'),name:'Petit Four (12st)',cashCode:'65100',unitUnconfirmed:true},
    {...product('unknown'),name:'Petit Fleur (8st)',cashCode:'9999999999',unitUnconfirmed:true},
  ];
  for(const row of petitProducts.normalizePetitProducts(cases)) {
    assert.equal(row.unitsPerSale,undefined);
    assert.equal(row.unitUnconfirmed,true);
    assert.equal(assortment.includeInStockOverview(row,10),false);
  }
  assert.equal(assortment.stockCategory('Kerst Petit Four',article('Kerst Petit Four','65')),'kerst');
  assert.equal(petitProducts.normalizePetitProducts([{...product('season'),name:'Kerst Petit Four',group:'kerst'}])[0].group,'kerst');
  const small=petitProducts.normalizePetitProducts([{...product('small'),name:'Petit Creme per stuk',cash:1,bake:0}])[0];
  assert(assortment.includeInStockOverview(small,10));
  assert.equal(assortment.includeInStockOverview({...small,cash:0},10),false);
});

test('Petit DV receipt packs use the same piece conversion as the forecast, including returns', () => {
  const p=petitProducts.normalizePetitProducts([{...product('pack'),name:'Petit Four (6st)',cashCode:'65100',cash:74,bake:55,unitUnconfirmed:true}])[0];
  const receipts={mode:'live',available:true,days:[{date:'2026-11-16',importedAt:'2026-11-16T20:00:00Z',unknownLines:0,lines:[{article:'65100',description:'Doosjes',quantity:3},{article:'502',description:'Oud nummer',quantity:99}]}]};
  let need=campaign.remainingNeed(p,852,receipts,'2026-11-17');
  assert.equal(need.issued,18); assert.equal(need.remaining,834);
  receipts.days[0].lines[0].quantity=-2;
  need=campaign.remainingNeed(p,852,receipts,'2026-11-17');
  assert.equal(need.issued,-12); assert.equal(need.remaining,864);
  const choice={...forecast.emptyChoice(),adjustment:{periodTotal:600,week52Total:300}};
  assert.equal(forecast.productProjection(p,choice,10).period,600);
  assert.equal(forecast.productProjection(p,choice,10).week52,300);
  const replacement=forecast.productFor2026(p,{...forecast.emptyChoice(),adjustment:{name2026:'Nieuwe losse petit four',cashCode2026:'65199'}});
  assert.equal(replacement.unitsPerSale,undefined);
});

test('pack forecasts cannot borrow a stock balance with the wrong piece factor, or compare bags to pieces', () => {
  const p=petitProducts.normalizePetitProducts([{...product('pack'),name:'Petit Four (6st)',cashCode:'65100',unitUnconfirmed:true}])[0];
  const stock={itemId:'stock',kind:'product',unit:'stuks',link:{article:'65100',factor:1}};
  const source={mode:'live',overview:{rows:[stock]},items:[],recipes:[]};
  assert.equal(overview.productInventory(p,forecast.emptyChoice(),source),null);
  assert.equal(overview.productInventory(p,{...forecast.emptyChoice(),productionItemId:'stock'},source),null);
  stock.link.factor=6;
  assert.equal(overview.productInventory(p,forecast.emptyChoice(),source).itemId,'stock');
  assert.equal(overview.productInventory(p,{...forecast.emptyChoice(),productionItemId:'stock'},source).itemId,'stock');
  assert.equal(overview.productInventory({...p,quantityLabel:'zakjes'},{...forecast.emptyChoice(),productionItemId:'stock'},source),null);
});

test('white petit fours keep the photo/text subtitle and original three receipt articles', () => {
  const result=assortment.combinePetitFours(petitProducts.normalizePetitProducts([petitFour('65300',590),petitFour('65301',624),petitFour('65302',709)]));
  assert.equal(result.length,1);
  assert.equal(result[0].name,'Petit fours wit');
  assert.equal(result[0].group,'petit-dv');
  assert.equal(result[0].overviewSubtitle,'Totaal inclusief foto- en tekstpetitfours');
  assert.deepEqual(Array.from(salesArticles.salesArticleCodes(result[0])).sort(),['65300','65301','65302']);
});
