const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const jsx = require('react/jsx-runtime');

function load(file, imports) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(code, { exports, require: name => {
    assert(name in imports, `Unmocked ${name}`);
    return imports[name];
  }, Date, Intl });
  return exports;
}

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
  assert(node, 'Expected stock control');
  return node;
}

function button(tree, label) {
  return find(tree, node => node.type === 'button' && text(node) === label);
}

function field(tree, label) {
  return find(find(tree, node => node.type === 'label' && text(node).startsWith(label)), node => node.type === 'input');
}

function harness(result) {
  const states = [];
  let index;
  const commands = [];
  const item = { id: 'mousse', name: 'Vanillemousse', kind: 'component', departmentId: 'dessert', unit: 'kg', stock: 0, note: '' };
  const task = { id: 'task', itemId: item.id, departmentId: 'dessert', date: '2026-11-07', quantity: 1.25, operation: 'Bereiden', status: 'planned', batchId: 'batch', recordsOutput: true, source: 'manual', note: '' };
  let props = { item, task, recipes: [], state: { version: 1, items: [item], tasks: [task] }, busy: false, onCommand: async command => { commands.push(command); return result; } };
  const component = load('app/productie/TaskWorkPanel.tsx', {
    react: {
      useState(initial) {
        const slot = index++;
        if (!(slot in states)) states[slot] = typeof initial === 'function' ? initial() : initial;
        return [states[slot], value => { states[slot] = typeof value === 'function' ? value(states[slot]) : value; }];
      },
      useEffect() {},
    },
    'react/jsx-runtime': jsx,
    './productionWork': { learnedWorkEstimate: () => null, workView: state => state },
    './ProductionIcon': { __esModule: true, default: () => null },
    './work.module.css': { __esModule: true, default: new Proxy({}, { get: (_, key) => key }) },
  }).default;
  function render(next = {}) {
    props = { ...props, ...next };
    index = 0;
    return component(props);
  }
  return { render, commands, item, task, props };
}

test('stock form asks for total physical stock, shows exact remainder and requires a named confirmation', async () => {
  const h = harness();
  let tree = h.render();
  button(tree, 'Uit voorraad gebruiken').props.onClick();
  tree = h.render();
  assert.equal(button(tree, 'Gebruik & klaar').props.disabled, true);
  field(tree, 'Totaal geteld').props.onChange({ target: { value: '2,5' } });
  field(tree, 'Jouw naam').props.onChange({ target: { value: 'Bakker A' } });
  tree = h.render();
  assert(text(tree).includes('2,5 geteld − 1,25 kg nodig = 1,25 over'));
  assert.equal(button(tree, 'Gebruik & klaar').props.disabled, true);
  find(tree, node => node.type === 'input' && node.props.type === 'checkbox').props.onChange({ target: { checked: true } });
  tree = h.render();
  assert.equal(button(tree, 'Gebruik & klaar').props.disabled, false);
  await find(tree, node => node.type === 'form').props.onSubmit({ preventDefault() {} });
  assert.equal(h.commands.length, 1);
  assert.equal(h.commands[0].kind, 'stock');assert.equal(h.commands[0].countedQuantity, 2.5);assert.equal(h.commands[0].who, 'Bakker A');assert.equal(h.commands[0].confirmed, true);
  assert(!('minutes' in h.commands[0]));assert(!('quantity' in h.commands[0]), 'The server takes the required quantity from the planned task');
});

test('a failed stock save clears the physical count and confirmation before retrying', async () => {
  const h = harness('De planning is intussen gewijzigd.');
  let tree = h.render();button(tree, 'Uit voorraad gebruiken').props.onClick();tree = h.render();
  field(tree, 'Totaal geteld').props.onChange({ target: { value: '2,5' } });field(tree, 'Jouw naam').props.onChange({ target: { value: 'Bakker A' } });
  find(tree, node => node.type === 'input' && node.props.type === 'checkbox').props.onChange({ target: { checked: true } });
  tree = h.render();await find(tree, node => node.type === 'form').props.onSubmit({ preventDefault() {} });tree = h.render();
  assert.equal(field(tree, 'Totaal geteld').props.value, '');assert.equal(find(tree, node => node.type === 'input' && node.props.type === 'checkbox').props.checked, false);
  assert.equal(button(tree, 'Gebruik & klaar').props.disabled, true);assert(text(tree).includes('De planning is intussen gewijzigd.'));
});

test('stock-completed tasks show their audit without production time or an ordinary reopen action', () => {
  const h = harness();
  const stock = { id: 'stock-100', taskId: h.task.id, itemId: h.item.id, unit: 'kg', countedQuantity: 2.5, quantity: 1.25, remainingQuantity: 1.25, who: 'Bakker A', at: '2026-11-07T08:00:00Z', actorId: 'baker' };
  const tree = h.render({ task: { ...h.task, status: 'done', stockFulfillmentId: stock.id }, state: { ...h.props.state, productionWork: { stockFulfillments: { task: stock } } } });
  assert(text(tree).includes('uit voorraad'));assert(text(tree).includes('2,5 geteld − 1,25 gebruikt = 1,25 over'));
  assert(!nodes(tree).some(node => node.type === 'button' && text(node) === 'Heropen'));
  assert(!text(tree).includes('arbeidsmin'));assert(!text(tree).includes(' min'));
});
