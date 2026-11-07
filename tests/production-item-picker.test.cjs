const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const jsx = require('react/jsx-runtime');

function load(file, imports = {}) {
  const exports = {};
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  }).outputText;
  vm.runInNewContext(source, {
    exports,
    require(name) {
      assert(name in imports, `Unmocked import ${name}`);
      return imports[name];
    },
    Date,
    Intl,
  });
  return exports;
}

const planning = load('app/productie/planning.ts');
const items = [
  { id: 'fruit', name: 'Fruitdesserttaart Vanille', kind: 'product', articleNumber: '4001' },
  { id: 'creme', name: 'Crème Citroen vulling', kind: 'component', articleNumber: 'AK-204', searchValues: ['Roomboter', 'Amandel'] },
  { id: 'vanilla', name: 'Vanille Mousse', kind: 'component' },
  { id: 'chocolate', name: 'Chocolade Mousse', kind: 'component' },
  { id: 'pistache', name: 'Pistachebiscuit', kind: 'component', productionBlocked: true },
  { id: 'cleaning', name: 'Werkbanken schoon', kind: 'activity' },
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
  const node = nodes(tree).find(predicate);
  assert(node, 'Expected picker control');
  return node;
}

function options(tree) {
  return nodes(tree).filter(node => node.props?.role === 'option');
}

function harness(overrides = {}) {
  const slots = [];
  const changes = [];
  let index = 0;
  let pendingEffects = [];
  let props = {
    items,
    value: '',
    onChange(value) {
      changes.push(value);
      props = { ...props, value };
    },
    ...overrides,
  };
  const slot = initial => {
    const current = index++;
    if (!(current in slots)) slots[current] = typeof initial === 'function' ? initial() : initial;
    return current;
  };
  const sameDeps = (first, second) => first?.length === second?.length && first.every((value, position) => Object.is(value, second[position]));
  const react = {
    useId: () => 'picker-test',
    useRef: value => slots[slot(() => ({ current: value }))],
    useState(initial) {
      const current = slot(initial);
      return [slots[current], value => {
        slots[current] = typeof value === 'function' ? value(slots[current]) : value;
      }];
    },
    useMemo(callback, dependencies) {
      const current = slot(() => ({ dependencies: undefined }));
      if (!sameDeps(slots[current].dependencies, dependencies)) {
        slots[current] = { dependencies, value: callback() };
      }
      return slots[current].value;
    },
    useEffect(callback, dependencies) {
      const current = slot(() => ({ dependencies: undefined }));
      if (!sameDeps(slots[current].dependencies, dependencies)) {
        slots[current].dependencies = dependencies;
        pendingEffects.push(callback);
      }
    },
  };
  const Component = load('app/productie/ProductionItemPicker.tsx', {
    react,
    'react/jsx-runtime': jsx,
    './ProductionIcon': { __esModule: true, default: () => null },
    './planning': planning,
    './ProductionItemPicker.module.css': { __esModule: true, default: new Proxy({}, { get: (_, key) => key }) },
  }).default;

  function render(nextProps = {}) {
    props = { ...props, ...nextProps };
    index = 0;
    pendingEffects = [];
    const tree = Component(props);
    pendingEffects.forEach(effect => effect());
    return tree;
  }

  function input(tree = render()) {
    return find(tree, node => node.props?.role === 'combobox');
  }

  function type(query) {
    input().props.onChange({ target: { value: query } });
    return render();
  }

  function key(key) {
    const event = {
      key,
      nativeEvent: {},
      prevented: false,
      stopped: false,
      preventDefault() { this.prevented = true; },
      stopPropagation() { this.stopped = true; },
    };
    input().props.onKeyDown(event);
    return { tree: render(), event };
  }

  return { render, input, type, key, changes };
}

test('product search matches middle substrings, accents, article numbers and independent ingredient tokens', () => {
  const h = harness();
  let result = options(h.type('dessert'));
  assert.equal(result.length, 1);
  assert(text(result[0]).includes('Fruitdesserttaart'));
  result = options(h.type('VANILLE dessert'));
  assert.equal(result.length, 1);
  assert(text(result[0]).includes('Fruitdesserttaart'));
  result = options(h.type('204 CREME'));
  assert.equal(result.length, 1);
  assert(text(result[0]).includes('Crème Citroen'));
  result = options(h.type('amandel citroen'));
  assert.equal(result.length, 1);
  assert(text(result[0]).includes('Crème Citroen'));
});

test('arrows move the active option and Enter selects without submitting the planning form', () => {
  const h = harness();
  let tree = h.type('mousse');
  assert.equal(options(tree).length, 2);
  assert.equal(options(tree)[0].props['aria-selected'], true);
  const down = h.key('ArrowDown');
  tree = down.tree;
  assert.equal(down.event.prevented, true);
  assert.equal(options(tree)[1].props['aria-selected'], true);
  assert.equal(h.input(tree).props['aria-activedescendant'], options(tree)[1].props.id);
  const enter = h.key('Enter');
  assert.equal(enter.event.prevented, true);
  assert.deepEqual(h.changes, ['chocolate']);
  assert.equal(h.input(enter.tree).props.value, 'Chocolade Mousse');
  assert.equal(h.input(enter.tree).props['aria-expanded'], false);
  assert.equal(options(enter.tree).length, 0);
});

test('Escape closes suggestions first and editing clears the previous committed product', () => {
  const h = harness({ value: 'fruit' });
  let tree = h.render();
  assert.equal(h.input(tree).props.value, items[0].name);
  tree = h.type('citroen');
  assert.deepEqual(h.changes, ['']);
  assert.equal(h.input(tree).props.value, 'citroen');
  const escape = h.key('Escape');
  assert.equal(escape.event.prevented, true);
  assert.equal(escape.event.stopped, true);
  assert.equal(h.input(escape.tree).props.value, '');
  assert.equal(h.input(escape.tree).props['aria-expanded'], false);
  assert.equal(h.key('Escape').event.prevented, false, 'A second Escape remains available to the surrounding dialog');
});

test('blocked recipes remain selectable and clear and empty-result states stay usable', () => {
  const h = harness();
  let tree = h.type('biscuit');
  const option = options(tree)[0];
  assert(text(option).includes('Recept controleren'));
  assert.equal(option.props['aria-disabled'], undefined);
  option.props.onClick();
  tree = h.render();
  assert.deepEqual(h.changes, ['pistache']);
  assert.equal(h.input(tree).props.value, 'Pistachebiscuit');
  find(tree, node => node.props?.['aria-label'] === 'Productkeuze wissen').props.onClick();
  tree = h.render();
  assert.equal(h.input(tree).props.value, '');
  assert.equal(options(tree).length, items.length);
  tree = h.type('bestaat-nergens');
  assert.equal(options(tree).length, 0);
  assert(text(find(tree, node => node.props?.role === 'status')).includes('Geen producten gevonden'));
  assert.equal(h.key('Enter').event.prevented, true);
  assert.deepEqual(h.changes, ['pistache', '']);
});

test('large catalogs render a bounded list while a refined query can still reach later products', () => {
  const catalog = Array.from({ length: 1_500 }, (_, index) => ({ id: `item-${index}`, name: `Catalogusartikel ${index}`, kind: 'product' }));
  const h = harness({ items: catalog });
  let tree = h.type('catalogus');
  assert.equal(options(tree).length, 60);
  assert(text(find(tree, node => node.props?.role === 'status')).includes('60 van 1500'));
  tree = h.type('1400 catalogus');
  assert.equal(options(tree).length, 1);
  h.key('Enter');
  assert.deepEqual(h.changes, ['item-1400']);
  tree = h.render({ disabled: true });
  assert.equal(h.input(tree).props.disabled, true);
  assert.equal(h.input(tree).props.value, 'Catalogusartikel 1400');
  assert.equal(options(tree).length, 0);
});
