const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm'), ts = require('typescript');
const jsx = require('react/jsx-runtime');
function load(file, imports = {}) {
 const exports = {};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, { exports, require: name => { assert(name in imports, `Unmocked ${name}`); return imports[name]; }, Date, Intl, Map, Set, Error, AbortController });
 return exports;
}
const planning = load('app/productie/planning.ts');
const materials = load('app/productie/materialPlanning.ts', { './planning': planning });
const grouping = load('app/productie/recipeGroups.ts');
function harness() {
 const hooks = []; let index;
 const slot = initial => { const id = index++; if (!(id in hooks)) hooks[id] = typeof initial === 'function' ? initial() : initial; return id; };
 const react = { useEffect() {}, useMemo: fn => fn(), useRef: initial => hooks[slot(() => ({ current: initial }))], useState: initial => { const id = slot(initial); return [hooks[id], value => { hooks[id] = typeof value === 'function' ? value(hooks[id]) : value; }]; } };
 const component = load('app/productie/PlanningInspector.tsx', {
  react, 'react/jsx-runtime': jsx, './planning': planning, './materialPlanning': materials, './recipeGroups': grouping,
  './ProductionIcon': { __esModule: true, default: function Icon() {} },
  './TaskWorkPanel': { __esModule: true, default: function TaskWorkPanel() {}, WorkClock: function WorkClock() {} },
  './workSummary': { taskWorkSummary: () => ({ minutes: 15, crewSize: 1 }) },
  './PlanningInspector.module.css': { __esModule: true, default: new Proxy({}, { get: (_, key) => key }) },
 }).default;
 return props => { index = 0; return component(props); };
}
function nodes(tree) { if (!tree || typeof tree !== 'object') return []; if (Array.isArray(tree)) return tree.flatMap(nodes); return [tree, ...nodes(tree.props?.children)]; }
function text(tree) { if (typeof tree === 'string' || typeof tree === 'number') return String(tree); if (Array.isArray(tree)) return tree.map(text).join(''); return tree?.props ? text(tree.props.children) : ''; }
function find(tree, predicate) { const result = nodes(tree).find(predicate); assert(result, 'Expected rendered control'); return result; }
function detail(tree, name) { return find(tree, node => node.type === 'details' && text(node.props.children[0]).startsWith(name)); }
function visibleText(tree) { if (!tree || typeof tree !== 'object') return text(tree); if (Array.isArray(tree)) return tree.map(visibleText).join(''); if (tree.type === 'details' && !tree.props.open) return text(nodes(tree.props.children).find(node => node.type === 'summary')); return visibleText(tree.props?.children); }
function fixture(selected = 'compote') {
 const item = (id, name, unit, kind = 'product') => ({ id, recipeId: id, name, unit, kind, departmentId: 'luxe', stock: 0, note: '' });
 const task = (id, itemId, quantity, extra = {}) => ({ id, itemId, batchId: id, quantity, date: '2026-11-17', departmentId: 'luxe', operation: 'Maken', status: 'planned', recordsOutput: true, source: 'manual', note: '', ...extra });
 const state = { version: 1, items: [item('compote', 'Frambozen Compote', 'kg', 'component'), item('framboyant', 'Framboyant', 'stuks'), item('choco', 'Gateau Choco', 'stuks'), item('cream', 'Vanillecrème', 'kg', 'component')], tasks: [
  task('compote', 'compote', 8, { generatedFor: 'framboyant' }),
  task('framboyant', 'framboyant', 96, { date: '2026-11-20', requires: ['compote'], materialNeeds: { compote: 2 }, operation: 'Afwerken' }),
  task('choco', 'choco', 300, { requires: ['compote'], materialNeeds: { compote: 6 }, operation: 'Opspuiten' }),
  task('choco-finish', 'choco', 300, { batchId: 'choco', dependsOn: 'choco', operation: 'Doorhalen', recordsOutput: false }),
 ] };
 const recipe = (id, name, unit, yieldAmount) => ({ id, name, unit, yield: yieldAmount, allergens: [], ingredients: [], steps: [] });
 const recipes = [
  { ...recipe('compote', 'Frambozen Compote', 'kg', 4), ingredients: [{ name: 'Frambozen', quantity: 3000, unit: 'gram' }], steps: ['Receptregels zijn overgenomen uit Halffabricaten Recepturen Strik 2026.xlsx.', 'Werkwijze en kritieke temperaturen kunnen later per halffabricaat worden aangevuld.', 'Breng rustig aan de kook.'] },
  { ...recipe('framboyant', 'Framboyant', 'stuks', 96), semiFinishedItems: [{ recipeId: 'compote', quantity: 2, unit: 'kg' }, { recipeId: 'cream', quantity: 3, unit: 'kg' }] },
  { ...recipe('choco', 'Gateau Choco', 'stuks', 300), semiFinishedItems: [{ recipeId: 'compote', quantity: 6, unit: 'kg' }] },
  { ...recipe('cream', 'Vanillecrème', 'kg', 1), ingredients: [{ name: 'Melk', quantity: 700, unit: 'gram' }] },
 ];
 const calls = [];
 return { state, recipes, calls, props: { state, recipes, task: state.tasks.find(row => row.id === selected), canManage: true, busy: false, revision: 1, live: false, onClose: () => calls.push(['close']), onComplete: id => calls.push(['complete', id]), onCorrect: id => calls.push(['correct', id]), onAdvanced: id => calls.push(['advanced', id]), onRecipe() {}, onWork() {}, onCombine() {} } };
}
test('shared batch shows all consumers and exact allocations while secondary data starts collapsed', () => {
 const render = harness(), f = fixture(), before = JSON.stringify(f.state);
 const view = render(f.props), parents = find(view, node => node.props?.['aria-label'] === 'Bijbehorende recepten');
 assert(text(parents).includes('Gedeeld voor'));
 for (const [name, amount] of [['Framboyant', '2 kg'], ['Gateau Choco', '6 kg']]) {
  const row = find(parents, node => node.type === 'button' && text(node).includes(name));
  assert(text(row).includes(amount));
 }
 assert(!detail(view, 'Recept').props.open);
 assert(!detail(view, 'Meer').props.open);
 assert(!visibleText(view).includes('6.000 gram'));
 assert(!text(view).includes('Receptregels zijn overgenomen'));
 assert(!text(view).includes('Werkwijze en kritieke temperaturen'));
 assert(text(detail(view, 'Recept')).includes('6.000 gram'));
 assert(text(detail(view, 'Recept')).includes('Breng rustig aan de kook.'));
 const finish = find(view, node => node.type === 'button' && text(node) === 'Afronden');
 finish.props.onClick(); assert.deepEqual(f.calls, [['complete', 'compote']]);
 assert.equal(JSON.stringify(f.state), before);
});
test('parent and unplanned-component drilldown stay in the same inspector and back restores the shared batch', () => {
 const render = harness(), f = fixture(); let view = render(f.props);
 const parents = find(view, node => node.props?.['aria-label'] === 'Bijbehorende recepten');
 find(parents, node => node.type === 'button' && text(node).includes('Framboyant')).props.onClick(); view = render(f.props);
 assert.equal(text(find(view, node => node.type === 'h2')), 'Framboyant');
 const parts = detail(view, 'Onderdelen'); assert.equal(parts.props.open, true);
 const shared = find(parts, node => node.type === 'button' && text(node).includes('Frambozen Compote'));
 assert(text(shared).includes('2 kg')); assert(text(shared).includes('batch 8 kg'));
 const cream = find(parts, node => node.type === 'button' && text(node).includes('Vanillecrème'));
 assert(text(cream).includes('3 kg')); assert(text(cream).includes('Niet apart ingepland'));
 cream.props.onClick(); view = render(f.props);
 assert.equal(text(find(view, node => node.type === 'h2')), 'Vanillecrème');
 assert(text(view).includes('Recept · geen gekoppelde taak'));
 assert(text(detail(view, 'Recept')).includes('2.100 gram'));
 assert(!nodes(view).some(node => node.type === 'footer'));
 const back = tree => find(tree, node => node.props?.['aria-label'] === 'Terug naar vorig product');
 back(view).props.onClick(); view = render(f.props); assert.equal(text(find(view, node => node.type === 'h2')), 'Framboyant');
 back(view).props.onClick(); view = render(f.props); assert.equal(text(find(view, node => node.type === 'h2')), 'Frambozen Compote');
 assert.equal(f.calls.length, 0);
});
test('finishing steps remain separate actions and completed shortages stay explicit', () => {
 const render = harness(), f = fixture('choco'); let view = render(f.props);
 const steps = detail(view, 'Stappen'); assert(!steps.props.open);
 const finish = find(steps, node => node.type === 'button' && text(node).includes('Doorhalen'));
 finish.props.onClick(); view = render(f.props);
 find(view, node => node.type === 'button' && text(node) === 'Afronden').props.onClick();
 assert.deepEqual(f.calls, [['complete', 'choco-finish']]);
 const g = fixture(); g.state.tasks[0] = { ...g.state.tasks[0], status: 'done', completedQuantity: 6 }; g.props.task = g.state.tasks[0];
 view = harness()(g.props);
 assert(text(view).includes('8 kg nodig · 6 kg gemaakt'));
 find(view, node => node.type === 'button' && text(node) === 'Aantal corrigeren').props.onClick();
 assert.deepEqual(g.calls, [['correct', 'compote']]);
});

test('earlier unfinished preparations carry an explicit work date and warning, including nested components', () => {
 const f = fixture('framboyant'), render = harness(), before = JSON.stringify(f.state);
 let view = render(f.props);
 const notice = find(view, node => node.props?.className === 'preparationNotice');
 assert(text(notice).includes('Voorbereiden di 17 nov'));
 const part = find(detail(view, 'Onderdelen'), node => node.type === 'button' && text(node).includes('Frambozen Compote'));
 assert(part.props.className.includes('earlier'));
 assert(text(part).includes('di 17 nov · 3 dagen ervoor'));
 assert.equal(JSON.stringify(f.state), before);
 f.state.tasks[0].status = 'done';
 view = render(f.props);
 assert(!nodes(view).some(node => node.props?.className === 'preparationNotice'));
 assert(!find(detail(view, 'Onderdelen'), node => node.type === 'button' && text(node).includes('Frambozen Compote')).props.className.includes('earlier'));
 const g = fixture('compote');
 g.state.tasks.push({ ...g.state.tasks[0], id: 'base', itemId: 'cream', date: '2026-11-16', generatedFor: 'compote' });
 g.state.tasks[0].requires = ['base'];
 g.recipes[0].semiFinishedItems = [{ recipeId: 'cream', quantity: 1, unit: 'kg' }];
 view = harness()(g.props);
 const nested = find(detail(view, 'Onderdelen'), node => node.type === 'button' && text(node).includes('Vanillecrème'));
 assert(nested.props.className.includes('earlier'));
 assert(text(nested).includes('ma 16 nov · 1 dag ervoor'));
});


test('a dated preparation reminder opens only that day, drills into a real task and returns without completing the final product', () => {
 const render = harness(), f = fixture('framboyant');
 f.state.tasks.push({ ...f.state.tasks[0], id: 'tomorrow', itemId: 'cream', date: '2026-11-18', generatedFor: 'framboyant' });
 f.state.tasks[1].requires.push('tomorrow');
 const before = JSON.stringify(f.state);
 const props = { ...f.props, preparationDate: '2026-11-17' };
 let view = render(props), parts = detail(view, 'Voorbereiden');
 assert(text(view).includes('Voorbereiden di 17 nov · voor vr 20 nov'));
 assert(text(parts).includes('Frambozen Compote'));
 assert(!text(parts).includes('Vanillecrème'));
 assert(!nodes(view).some(node => node.type === 'footer'), 'The reminder cannot accidentally complete the final product');
 find(parts, node => node.type === 'button' && text(node).includes('Frambozen Compote')).props.onClick();
 view = render(props);
 assert.equal(text(find(view, node => node.type === 'h2')), 'Frambozen Compote');
 find(view, node => node.type === 'button' && text(node) === 'Afronden').props.onClick();
 assert.deepEqual(f.calls, [['complete', 'compote']]);
 find(view, node => node.props?.['aria-label'] === 'Terug naar vorig product').props.onClick();
 view = render(props);
 assert(text(detail(view, 'Voorbereiden')).includes('Frambozen Compote'));
 find(view, node => node.type === 'button' && text(node) === 'Hele recept').props.onClick();
 view = render(props);
 assert(text(detail(view, 'Onderdelen')).includes('Vanillecrème'));
 assert.equal(JSON.stringify(f.state), before);
});


test('component rows flag other weekly consumers with dates and exact demand, and navigate in the same panel', () => {
 const f = fixture('framboyant'), render = harness(), before = JSON.stringify(f.state);
 let view = render(f.props);
 const notice = detail(view, 'Ook deze week');
 assert(!notice.props.open);
 assert(text(notice.props.children[0]).includes('1 andere productie'));
 assert(text(notice).includes('Gateau Choco'));
 assert(text(notice).includes('di 17 nov'));
 assert(text(notice).includes('6 kg'));
 assert(!text(notice).includes('Framboyant'));
 assert(!visibleText(view).includes('Gateau Choco'));
 find(notice, node => node.type === 'button' && text(node).includes('Gateau Choco')).props.onClick();
 view = render(f.props);
 assert.equal(text(find(view, node => node.type === 'h2')), 'Gateau Choco');
 assert.equal(f.calls.length, 0);
 assert.equal(JSON.stringify(f.state), before);
});

test('weekly notices omit completed preparations, other weeks and unrelated recipes', () => {
 const f = fixture('framboyant');
 f.state.tasks.push({ ...f.state.tasks[0], id: 'compote-b', batchId: 'compote-b', date: '2026-11-18', generatedFor: 'choco' });
 f.state.tasks[2].requires = ['compote-b']; f.state.tasks[2].materialNeeds = { 'compote-b': 6 };
 let view = harness()(f.props);
 assert(text(detail(view, 'Ook deze week')).includes('wo 18 nov'));
 f.state.tasks.at(-1).date = '2026-11-23';
 view = harness()(f.props);
 assert(!nodes(view).some(node => node.type === 'summary' && text(node).includes('Ook deze week')));
 f.state.tasks.at(-1).date = '2026-11-18'; f.state.tasks.at(-1).status = 'done';
 view = harness()(f.props);
 assert(!nodes(view).some(node => node.type === 'summary' && text(node).includes('Ook deze week')));
});

test('a shared batch only flags additional weekly demand outside its existing consumers', () => {
 const f = fixture(), render = harness();
 let view = render(f.props);
 assert(!nodes(view).some(node => node.type === 'summary' && text(node).includes('Ook deze week')));
 f.state.tasks.push({ ...f.state.tasks[1], id: 'next-framboyant', batchId: 'next-framboyant', date: '2026-11-21', requires: [], materialNeeds: undefined });
 view = render(f.props);
 const notice = detail(view, 'Ook deze week');
 assert(text(notice).includes('za 21 nov'));
 assert(text(notice).includes('2 kg'));
 assert(text(notice.props.children[0]).includes('1 andere productie'));
});
