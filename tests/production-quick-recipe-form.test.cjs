const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const jsx = require('react/jsx-runtime');

function load(file, imports, globals = {}) {
  const exports = {};
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(source, {
    exports,
    require(name) { assert(name in imports, `Unmocked import ${name}`); return imports[name]; },
    Error, Number, ...globals,
  });
  return exports;
}

const workRecipe = load('app/productie/workRecipe.ts', {});
const item = { id: 'manual-cake', name: 'Nieuwe taart', kind: 'product', departmentId: 'luxe', unit: 'stuks', stock: 0, note: '' };
const ingredients = [
  { id: 'flour-a', name: 'Bloem', supplier: 'Molen Noord', unit: 'gram' },
  { id: 'flour-b', name: 'Bloem', supplier: 'Jumbo', unit: 'gram' },
];

function nodes(tree) {
  if (!tree || typeof tree !== 'object') return [];
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  return [tree, ...nodes(tree.props?.children)];
}
function text(tree) {
  if (typeof tree === 'string' || typeof tree === 'number') return String(tree);
  if (Array.isArray(tree)) return tree.map(text).join('');
  return tree?.props ? text(tree.props.children) : '';
}
function find(tree, predicate) {
  const found = nodes(tree).find(predicate);
  assert(found, 'Expected quick recipe control');
  return found;
}

function harness(overrides = {}) {
  const slots = [], effects = [], calls = [];
  let cursor = 0, pending = [], saved = 0, closed = 0;
  const sameDeps = (first, second) => first?.length === second?.length && first.every((value, index) => Object.is(value, second[index]));
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
      return [slots[index], value => { slots[index] = typeof value === 'function' ? value(slots[index]) : value; }];
    },
    useRef(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = { current: initial };
      return slots[index];
    },
    useMemo(callback, dependencies) {
      const index = cursor++;
      if (!sameDeps(slots[index]?.dependencies, dependencies)) slots[index] = { value: callback(), dependencies };
      return slots[index].value;
    },
    useEffect(effect, dependencies) {
      const index = cursor++;
      if (!sameDeps(effects[index]?.dependencies, dependencies)) pending.push(() => {
        effects[index]?.cleanup?.();
        effects[index] = { dependencies, cleanup: effect() };
      });
    },
  };
  const choice = function SearchableChoice() {};
  const component = load('app/productie/QuickRecipeForm.tsx', {
    react, 'react/jsx-runtime': jsx, './workRecipe': workRecipe,
    './SearchableChoice': { __esModule: true, default: choice },
    './requests.module.css': { __esModule: true, default: new Proxy({}, { get: (_, key) => key }) },
  }, {
    FormData: class {
      constructor(fields) {
        const data = new FormData();
        for (const [name, value] of Object.entries(fields)) data.set(name, value);
        return data;
      }
    },
    fetch(url, options) { return new Promise(resolve => calls.push({ url, options, resolve })); },
  }).default;
  const props = {
    item, ingredients, getRevision: () => 23, recipeRevision: 7,
    onSaved: async () => { saved++; }, onClose: () => { closed++; }, ...overrides,
  };
  return {
    choice, calls,
    get saved() { return saved; }, get closed() { return closed; },
    render() {
      cursor = 0; pending = [];
      const tree = component(props);
      pending.forEach(effect => effect());
      return tree;
    },
    async respond(index, body, status = 200) {
      calls[index].resolve(Response.json(body, { status }));
      await new Promise(setImmediate);
    },
  };
}

const formFields = { who: 'Proefbakker', yield: '20', instructions: 'Mengen en bakken', workInstructions: 'Afwegen', finishingInstructions: 'Afwerken' };
const submit = tree => find(tree, node => node.type === 'form').props.onSubmit({ preventDefault() {}, currentTarget: formFields });

test('quick entry uses searchable ingredient choices, distinguishes suppliers and saves the selected canonical ID', async () => {
  const h = harness(); let tree = h.render();
  let picker = find(tree, node => node.type === h.choice);
  assert.equal(picker.props.label, 'Grondstof');
  assert.equal(picker.props.name, 'component-0');
  assert.equal(picker.props.required, true);
  assert.equal(picker.props.choices.find(choice => choice.id === 'flour-a').description, 'Molen Noord');
  assert.equal(picker.props.choices.find(choice => choice.id === 'flour-b').description, 'Jumbo');
  picker.props.onChange('flour-b');
  tree = h.render();
  find(tree, node => node.props?.name === 'quantity-0').props.onChange({ target: { value: '500' } });
  tree = h.render();
  picker = find(tree, node => node.type === h.choice);
  assert.equal(picker.props.value, 'flour-b');
  const saving = submit(tree);
  assert.equal(h.calls.length, 1);
  const payload = JSON.parse(h.calls[0].options.body);
  assert.equal(h.calls[0].url, '/api/productie/snel-recept');
  assert.equal(payload.revision, 23);
  assert.equal(payload.recipeRevision, 7);
  assert.equal(payload.command.ingredients[0].ingredientId, 'flour-b');
  assert.equal(payload.command.ingredients[0].quantity, 500);
  await h.respond(0, {}); await saving;
  assert.equal(h.saved, 1); assert.equal(h.closed, 1);
});

test('editing keeps missing ingredient and half-finished IDs visible until explicitly repaired and retains canonical metadata', async () => {
  const h = harness({ item: { ...item, recipeId: 'fixed-recipe' }, taskId: 'production-task' });
  assert(text(h.render()).includes('Werkrecept laden'));
  await h.respond(0, {
    recipeRevision: 31, requiresPermanent: true,
    semiFinished: [{ id: 'cream-recipe', name: 'Vanillecrème' }],
    draft: {
      recipeId: 'fixed-recipe', yield: 20, instructions: 'Mengen', workInstructions: 'Afwegen', finishingInstructions: 'Afwerken',
      ingredients: [{ ingredientId: 'deleted-ingredient', quantity: 500, unit: 'gram' }],
      semiFinishedItems: [{ recipeId: 'deleted-recipe', quantity: 2, unit: 'kg' }],
    },
  });
  let tree = h.render();
  const pickerFor = (view, name) => find(view, node => node.type === h.choice && node.props.name === name);
  assert.equal(pickerFor(tree, 'component-0').props.value, 'deleted-ingredient');
  assert.equal(pickerFor(tree, 'component-1').props.value, 'deleted-recipe');
  for (const name of ['component-0', 'component-1']) {
    const picker = pickerFor(tree, name);
    assert.equal(picker.props.invalid, true);
    assert(find(tree, node => node.props?.id === picker.props.describedBy && node.props.role === 'alert'));
  }
  await submit(tree);
  assert.equal(h.calls.length, 1, 'Invalid missing references must not trigger a save');
  pickerFor(tree, 'component-0').props.onChange('flour-a'); tree = h.render();
  assert.equal(pickerFor(tree, 'component-1').props.value, 'deleted-recipe');
  assert.equal(pickerFor(tree, 'component-1').props.label, 'Halffabricaat');
  pickerFor(tree, 'component-1').props.onChange('cream-recipe'); tree = h.render();
  assert.equal(pickerFor(tree, 'component-0').props.invalid, false);
  assert.equal(pickerFor(tree, 'component-1').props.invalid, false);
  const saving = submit(tree);
  const payload = JSON.parse(h.calls[1].options.body);
  assert.equal(payload.scope, 'permanent');
  assert.equal(payload.taskId, 'production-task');
  assert.equal(payload.recipeRevision, 31);
  assert.equal(payload.command.recipeId, 'fixed-recipe');
  assert.equal(payload.command.ingredients[0].ingredientId, 'flour-a');
  assert.equal(payload.command.semiFinishedItems[0].recipeId, 'cream-recipe');
  assert.equal(payload.command.semiFinishedItems[0].quantity, 2);
  assert.equal(payload.command.workInstructions, 'Afwegen');
  await h.respond(1, {}); await saving;
  assert.equal(h.saved, 1); assert.equal(h.closed, 1);
});
