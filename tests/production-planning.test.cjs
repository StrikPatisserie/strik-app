const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, imports = {}, extra = '', environment = 'development') {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  vm.runInNewContext(code + extra, { exports, require: name => imports[name] || {}, Date, Intl, structuredClone, process: { env: { NODE_ENV: environment } } });
  return exports;
}
const m = load('app/productie/planning.ts');
const sample = load('app/preview/productie/sampleData.ts', { '../../productie/planning': m });
const workspace=load('app/productie/workspaceData.ts',{'./planning':m});
const component = load('app/preview/productie/ProductionPreview.tsx', { 'react': require('react'), 'next/dynamic':()=>()=>null,'../../productie/WeddingWeekLane':{__esModule:true,default:()=>null},'../../productie/weddingPlanning':{},'../../productie/planning': m, './sampleData': sample, '../../productie/workspaceData':workspace }, '\nexports.validState=isPreviewState;');
test('only planned leaf tasks can be removed without changing the original array or recipes',()=>{
 const state=sample.initialPreviewState(),leaf=state.tasks.find(t=>t.status==='planned'&&!state.tasks.some(n=>n.dependsOn===t.id));
 const next=m.removePlannedTask(state.tasks,leaf.id);assert.equal(next.length,state.tasks.length-1);assert(state.tasks.some(t=>t.id===leaf.id));
 for(const status of ['active','done','blocked'])assert.throws(()=>m.removePlannedTask([{...leaf,status}],leaf.id),/Alleen geplande/);
 assert.throws(()=>m.removePlannedTask([leaf,{...leaf,id:'next',dependsOn:leaf.id}],leaf.id),/vervolgstap/);
});

test('calendar weeks survive Amsterdam clock changes and ISO year boundaries', () => {
  for (const [date, expected] of [['2026-03-28', '2026-03-29'], ['2026-10-24', '2026-10-25'], ['2026-12-31', '2027-01-01']]) assert.equal(m.addDays(date, 1), expected);
  assert.equal(m.mondayOf('2026-10-28'), '2026-10-26');
  assert.equal(m.weekNumber('2026-10-28'), 44);
  assert.equal(m.weekNumber('2027-01-01'), 53);
  assert.equal(m.dateLabel('2026-10-28', true), 'wo 28 okt');
  assert.throws(() => m.addDays('2026-02-30', 1), /datum/);
});
test('three planning boards retain department IDs and combine baking/bread and chocolate/ice', () => {
  assert.deepEqual(Array.from(m.departmentsFor('patisserie'), d => d.id), ['dessert', 'luxe', 'kapsel', 'slagroom', 'bruidstaarten']);
  assert.deepEqual(Array.from(m.departmentsFor('bak'), d => d.id), ['bak', 'brood']);
  assert.equal(m.BOARDS.find(board => board.id === 'bak').name, 'Bak & brood');
  assert.equal(m.BOARDS.some(board => board.id === 'brood'), false);
  assert.deepEqual(Array.from(m.BOARDS, board => board.id), ['patisserie', 'bak', 'chocolade']);
  assert.equal(m.BOARDS.find(board => board.id === 'chocolade').name, 'Chocola & ijs');
  for (const id of ['ijs', 'chocolade']) assert.deepEqual(Array.from(m.departmentsFor(id), department => department.id), ['ijs', 'chocolade']);
  assert.equal(m.DEPARTMENTS.find(department => department.id === 'ijs').board, 'ijs', 'legacy department metadata is retained');
  assert.equal(m.canonicalBoardId('ijs'), 'chocolade');
  assert.equal(m.canonicalBoardId('bak'), 'bak');
  assert(sample.initialPreviewState().tasks.some(task => task.departmentId === 'brood'));
  const nav = load('app/productie/navigation.ts', {'./planning':m});
  assert.equal(nav.productionBoard('brood'), 'bak');
  assert.equal(nav.productionBoard('ijs'), 'chocolade');
  assert.equal(nav.productionBoard('chocolade'), 'chocolade');
  assert.equal(nav.productionBoard('unknown'), undefined);
});
test('a standalone component needs no recipe and retains its ID and tasks when linked later', () => {
  let state = sample.initialPreviewState();
  const item = { id: 'new-component', name: 'Nieuw kapsel', kind: 'component', departmentId: 'bak', unit: 'stuks', stock: 0, note: '' };
  state = m.addItem(state, item);
  const task = { id: 'new-task', itemId: item.id, departmentId: 'bak', date: '2026-10-29', quantity: 20, operation: 'Bakken', status: 'planned', note: '', source: 'manual', batchId: 'new-batch', recordsOutput: true };
  state = m.addTask(state, task);
  const linked = m.linkRecipe(state, item.id, 'demo-kapsel', sample.demoRecipes);
  assert.equal(linked.items.find(i => i.id === item.id).recipeId, 'demo-kapsel');
  assert.equal(linked.tasks.at(-1).itemId, item.id);
  assert.equal(state.items.find(i => i.id === item.id).recipeId, undefined);
  assert.throws(() => m.linkRecipe(state, item.id, 'demo-ganache', sample.demoRecipes), /eenheid/);
  assert.throws(() => m.addItem(state, { ...item, id: 'another' }), /naam bestaat/);
});
test('production steps wait for their predecessor across department boards and cannot undo a consumed completion', () => {
  const state = sample.initialPreviewState();
  assert.throws(() => m.transitionTask(state.tasks, 'k5', 'done'), /Wacht op bakken/);
  assert.throws(() => m.transitionTask(state.tasks, 'k5', 'active'), /Wacht op bakken/);
  const baked = m.transitionTask(state.tasks, 'k4', 'done');
  const completed = m.transitionTask(baked, 'k5', 'done');
  assert.equal(completed.find(t => t.id === 'k5').status, 'done');
  assert.throws(() => m.transitionTask(completed, 'k4', 'planned'), /volgende stap/);
  assert.equal(state.tasks.find(t => t.id === 'k4').status, 'planned');
});
test('a blocked task requires an explicit reopening before completion', () => {
  const state = sample.initialPreviewState();
  assert.throws(() => m.transitionTask(state.tasks, 'l4', 'done'), /blokkade/);
  const reopened = m.transitionTask(state.tasks, 'l4', 'planned');
  assert.equal(m.transitionTask(reopened, 'l4', 'done').find(t => t.id === 'l4').status, 'done');
});
test('moving validates calendar, department, step order and required date without modifying originals', () => {
  const state = sample.initialPreviewState();
  assert.throws(() => m.moveTask(state.tasks, 'k5', '2026-10-28', 'kapsel'), /voorgaande stap/);
  assert.throws(() => m.moveTask(state.tasks, 'k4', '2026-10-31', 'bak'), /volgende stap/);
  assert.throws(() => m.moveTask(state.tasks, 'f6', '2026-10-31', 'dessert'), /benodigde datum/);
  assert.throws(() => m.moveTask(state.tasks, 'f1', '2026-10-31', 'dessert'), /Heropen/);
  assert.throws(() => m.moveTask(state.tasks, 'k4', '2026-10-29', 'nonexistent'), /afdeling/);
  const moved = m.moveTask(state.tasks, 'k4', '2026-10-28', 'bak');
  assert.equal(moved.find(t => t.id === 'k4').date, '2026-10-28');
  assert.equal(state.tasks.find(t => t.id === 'k4').date, '2026-10-29');
});
test('a batch counts output once and repeating a completion does not add stock again', () => {
  const state = sample.initialPreviewState();
  const before = m.completedOutput(state.items, state.tasks).get('kapsels');
  const tasks = m.transitionTask(m.transitionTask(state.tasks, 'k4', 'done'), 'k5', 'done');
  const once = m.completedOutput(state.items, tasks).get('kapsels');
  assert.equal(once - before, 80);
  assert.equal(m.completedOutput(state.items, m.transitionTask(tasks, 'k5', 'done')).get('kapsels'), once);
  assert.throws(() => m.completedOutput(state.items, tasks.map(t => t.id === 'k4' ? { ...t, recordsOutput: true } : t)), /Dubbele/);
});
test('new tasks reject invalid quantities, unknown sources, duplicate output and foreign dependencies', () => {
  const state = sample.initialPreviewState();
  const task = { ...state.tasks.find(t => t.id === 'k5'), id: 'extra', status: 'planned' };
  assert.throws(() => m.addTask(state, task), /al een stap/);
  assert.throws(() => m.addTask(state, { ...task, recordsOutput: false, dependsOn: 'f1' }), /zelfde onderdeel/);
  assert.throws(() => m.addTask(state, { ...task, quantity: NaN }), /geldig aantal/);
  assert.throws(() => m.addTask(state, { ...task, source: 'invented' }), /herkomst/);
  assert.throws(() => m.addTask(state, { ...task, itemId: 'missing' }), /bestaand onderdeel/);
});
test('restoring browser preview data rejects duplicate output, missing links, impossible dates and dependency cycles', () => {
  assert.equal(component.validState(sample.initialPreviewState()), true);
  for (const change of [
    state => { state.tasks[0].date = '2026-02-30'; },
    state => { state.tasks[0].itemId = 'missing'; },
    state => { state.tasks.find(t => t.id === 'k1').recordsOutput = true; },
    state => { state.tasks[0].minutes = Infinity; },
    state => { state.tasks[0].dependsOn = state.tasks[0].id; },
    state => { state.tasks.find(t => t.id === 'k5').status = 'done'; },
  ]) { const state = sample.initialPreviewState(); change(state); assert.equal(component.validState(state), false); }
});
test('production preview is noindex and unavailable outside development at both route and middleware', async () => {
  const page = load('app/preview/productie/page.tsx', { 'next/navigation': { notFound: () => { throw Error('not-found'); } } }, '', 'production');
  await assert.rejects(() => page.default({searchParams:Promise.resolve({})}), /not-found/);
  assert.equal(page.metadata.robots.index, false);
  for (const environment of ['development', 'production', 'test']) {
    const middleware = load('app/lib/supabase/middleware.ts', {}, '\nexports.isPublicPath=isPublicPath;', environment);
    assert.equal(middleware.isPublicPath('/preview/productie'), environment === 'development');
    assert.equal(middleware.isPublicPath('/preview/productie/private'), false);
  }
});

test('the holiday submenu retains the existing B2B destination and only offers the explicitly supplied forecast', () => {
  const menu = load('app/productie/HolidayMenu.tsx', {
    'react/jsx-runtime': require('react/jsx-runtime'), 'next/link': 'a',
    './ProductionIcon': { __esModule: true, default: 'svg' },
    './navigation': { PRODUCTION_HOME: '/bakkerij/productie' },
    './holidayMenu.module.css': { __esModule: true, default: {} },
  }).default;
  const links = menu({}).props.children.flat().filter(Boolean);
  assert.equal(links.length, 1);
  assert.equal(links[0].props.href, '/bakkerij/productie/feestdagen/sint');
  const previewLinks = menu({ forecastHref: '/preview/productie?view=kerstvoorraad' }).props.children.flat().filter(Boolean);
  assert.equal(previewLinks.length, 2);
  assert.equal(previewLinks[1].props.href, '/preview/productie?view=kerstvoorraad');
});

test('the holiday forecast uses shared sales in production and checks access before reading them', async () => {
  let allowed = false, reads = 0;
  const settings = { version: 1, revision: 0, growth: 10, adjustments: {}, mappings: {} };
  const page = load('app/bakkerij/productie/feestdagen/kerstvoorraad/page.tsx', {
    'react/jsx-runtime': require('react/jsx-runtime'),
    'next/navigation': { notFound: () => { throw Error('not-found'); } },
    '@/app/lib/auth/session': { requireCurrentProfile: async () => ({ id: 'operator' }) },
    '@/app/productie/access': { productionDepartments: () => allowed ? ['dessert'] : [] },
    '@/app/preview/productie/kerstvoorraad/ChristmasStockPreview': 'ChristmasStockPreview',
    '@/app/preview/productie/kerstvoorraad/campaignNeed': { todayInAmsterdam: () => '2026-11-16' },
    '@/app/preview/productie/kerstvoorraad/liveSource.server': { christmasProductionSource: async () => ({ production: { mode: 'live', items: [], recipes: [] } }) },
    '@/app/preview/productie/kerstvoorraad/store.server': {
      readForecastSales: async () => { reads++; return { products: [{ id: 'real-sales' }] }; },
      readForecastSettings: async () => settings,
    },
    '@/app/preview/productie/kerstvoorraad/source.server': { christmasForecastSource: () => assert.fail('Local Excel must not be read in production') },
  }, '', 'production');
  await assert.rejects(() => page.default(), /not-found/);
  assert.equal(reads, 0);
  allowed = true;
  const result = await page.default();
  assert.equal(result.props.products[0].id, 'real-sales');
  assert.equal(result.props.sharedSettings, settings);
  assert.equal(result.props.production.mode, 'live');
  assert.equal(reads, 1);
});


test('the fixed day rhythm applies only to Patisserie Monday through Friday, including clock-change weeks',()=>{
 const rhythm=load('app/productie/dayRhythm.ts',{'./planning':m});
 for(const date of ['2026-10-26','2026-10-27','2026-10-28','2026-10-29','2026-10-30','2026-03-30']){
  const blocks=rhythm.productionDayRhythm('patisserie',date);
  assert.equal(JSON.stringify(blocks.map(b=>[b.start,b.end])),JSON.stringify([['05:30','08:00'],['08:00','08:30']]));
 }
 for(const date of ['2026-10-31','2026-11-01','2026-10-25'])assert.equal(rhythm.productionDayRhythm('patisserie',date).length,0);
 for(const board of ['bak','ijs','chocolade'])assert.equal(rhythm.productionDayRhythm(board,'2026-10-28').length,0);
 assert.throws(()=>rhythm.productionDayRhythm('patisserie','2026-02-30'),/datum/);
 assert.equal(rhythm.plannedOperation('product',true,false),'Afwerken');
 assert.equal(rhythm.plannedOperation('component',false,false),'Bereiden');
 assert.equal(rhythm.plannedOperation('product',false,false),'Maken');
 assert.equal(rhythm.plannedOperation('product',true,true),'Afwerken');
});

test('operational recipe search matches independent word parts, accents, article numbers and ingredient names',()=>{
 const values=["Strik's Caramel Pécan Pie",'12345','Vanillecrème','Bakken en decoreren'];
 for(const query of ['cara pec','PECAN strik','345','vanille cre','decore bak'])assert(m.matchesProductionSearch(query,values));
 assert(!m.matchesProductionSearch('pecan aardbei',values));assert(m.matchesProductionSearch('',values));
});
