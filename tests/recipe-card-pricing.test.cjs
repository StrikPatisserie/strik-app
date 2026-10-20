const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

function load(file, imports = {}, expose = '') {
  const exports = {};
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(source + '\n' + expose, {
    exports,
    require: name => imports[name] || {},
  });
  return exports;
}

const utils = load('app/bakkerij/recepturen/utils.ts');
const { Card } = load('app/bakkerij/recepturen/RecipeDetail.tsx', {
  react: React,
  'react/jsx-runtime': require('react/jsx-runtime'),
  './utils': utils,
  './RecipeScreens.module.css': { default: {} },
}, 'exports.Card = BakkerRecipeCard;');

const recipe = {
  id: 'test-cake', name: 'Voorbeeldcake', type: 'finalProduct', productGroup: 'Cake',
  status: 'active', standardBatchQuantity: 47, standardBatchUnit: 'stuk', batchSize: '47 stuks',
  salesPrice: 12.95, costPrice: 2.74, targetMargin: 65,
  ingredients: [{ ingredientId: 'flour', quantity: 30708, unit: 'gram' }],
  semiFinishedItems: [], preparationSteps: [], allergens: [], productionLog: [], lastUpdated: '2026-10-20',
};

function render(changes = {}, props = {}) {
  return renderToStaticMarkup(React.createElement(Card, {
    recipe: { ...recipe, ...changes },
    financialAccess: true,
    ingredients: [{ id: 'flour', name: 'Bloem' }], recipes: [],
    quantity: 47, batchQuantity: 47, isStarted: false, feedback: '',
    ...props,
  }));
}

function advice(html) {
  return html.match(/<dt>Advies 80% incl\.<\/dt><dd>(.*?)<\/dd>/)?.[1];
}

test('manager sees a unit selling price including VAT at a fixed 80% margin', () => {
  const html = render();
  // €2.74 cost ex VAT requires €13.70 ex VAT / €14.93 incl VAT.
  assert.match(advice(html), /14,93/);
  assert.match(html, /inclusief 9% btw bij 80% marge exclusief btw/);
  assert.equal(recipe.targetMargin, 65, 'Viewing advice must not change the stored target margin');
  assert.equal(recipe.salesPrice, 12.95, 'Viewing advice must not change the selling price');
});

test('advice agrees with the margin overview and stays per product when scaling a batch', () => {
  assert.equal(advice(render()), utils.formatEuro(utils.targetSalesPrice({ ...recipe, targetMargin: 80 })));
  assert.equal(advice(render({}, { quantity: 94 })), advice(render()));
});

test('production accounts and semi-finished recipes never show the new price advice', () => {
  assert.equal(advice(render({}, { financialAccess: false })), undefined);
  assert.equal(advice(render({}, { financialAccess: undefined })), undefined);
  assert.equal(advice(render({ type: 'semiFinished' })), undefined);
});

test('incomplete recipes and missing costs do not suggest a misleading selling price', () => {
  assert.equal(advice(render({ ingredients: [{ ingredientId: 'flour', quantity: 0, unit: 'gram' }] })), 'Onvolledig');
  assert.equal(advice(render({ costPrice: 0 })), '—');
});

function findElement(node, predicate) {
  if (!node || typeof node !== 'object') return undefined;
  if (Array.isArray(node)) {
    return node.map(child => findElement(child, predicate)).find(Boolean);
  }
  return predicate(node) ? node : findElement(node.props?.children, predicate);
}

function interactiveCard(changes = {}) {
  const storedRecipe = { ...recipe, ...changes };
  let quantity = storedRecipe.standardBatchQuantity;
  const states = [];
  let cursor = 0;
  // Exercise the card's event handlers and local state without a browser session.
  const hooks = {
    ...React,
    useEffect() {},
    useState(initial) {
      const index = cursor++;
      if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial;
      return [states[index], value => {
        states[index] = typeof value === 'function' ? value(states[index]) : value;
      }];
    },
  };
  const { Card: InteractiveCard } = load('app/bakkerij/recepturen/RecipeDetail.tsx', {
    react: hooks,
    'react/jsx-runtime': require('react/jsx-runtime'),
    './utils': utils,
    './RecipeScreens.module.css': { default: {} },
  }, 'exports.Card = BakkerRecipeCard;');
  return {
    storedRecipe,
    render() {
      cursor = 0;
      return InteractiveCard({
        recipe: storedRecipe, financialAccess: false,
        ingredients: [{ id: 'flour', name: 'Bloem' }], recipes: [],
        quantity, batchQuantity: storedRecipe.standardBatchQuantity,
        isStarted: false, feedback: '',
        onQuantityChange(value) { quantity = Number(value.replace(',', '.')); },
        onScaleFromIngredient(_id, desired) {
          quantity = storedRecipe.standardBatchQuantity * desired / storedRecipe.ingredients[0].quantity;
        },
      });
    },
  };
}

test('batch input scales ingredients to 100 and reset restores the stored 47 without saving', () => {
  const card = interactiveCard();
  const original = JSON.stringify(card.storedRecipe);
  const amountInput = tree => findElement(tree, node => node.props?.['aria-label'] === 'Hoeveelheid');
  const resetButton = tree => findElement(tree, node => node.type === 'button' && node.props.title?.startsWith('Zet de hoeveelheid'));

  amountInput(card.render()).props.onFocus();
  amountInput(card.render()).props.onChange({ target: { value: '100' } });
  let tree = card.render();
  assert.equal(amountInput(tree).props.value, '100');
  assert.match(renderToStaticMarkup(tree), /65\.336,2 g/);
  assert.match(renderToStaticMarkup(resetButton(tree)), /Standaard 47 stuks/);

  // Reset must also replace a temporarily empty input, while it still has focus.
  amountInput(tree).props.onChange({ target: { value: '' } });
  resetButton(card.render()).props.onClick();
  tree = card.render();
  assert.equal(amountInput(tree).props.value, '47');
  assert.match(renderToStaticMarkup(tree), /30\.708 g/);
  assert.equal(JSON.stringify(card.storedRecipe), original);
});

test('reset retains decimal batch weights and clears scaling by an ingredient', () => {
  const card = interactiveCard({
    type: 'semiFinished', standardBatchQuantity: 12.3456, standardBatchUnit: 'kg',
    batchSize: '12,3456 kg', ingredients: [{ ingredientId: 'flour', quantity: 12345.6, unit: 'gram' }],
  });
  const scaleInput = tree => findElement(tree, node => node.type === 'input' && node.props.placeholder);
  scaleInput(card.render()).props.onChange({ target: { value: '30000' } });
  let tree = card.render();
  assert.equal(scaleInput(tree).props.value, '30000');
  assert.match(renderToStaticMarkup(tree), /30\.000 g/);

  const reset = findElement(tree, node => node.type === 'button' && node.props.title?.startsWith('Zet de hoeveelheid'));
  assert.match(renderToStaticMarkup(reset), /Standaard 12,3456 kg/);
  reset.props.onClick();
  tree = card.render();
  assert.equal(findElement(tree, node => node.props?.['aria-label'] === 'Hoeveelheid').props.value, '12,3456');
  assert.equal(scaleInput(tree).props.value, '');
  assert.match(renderToStaticMarkup(tree), /12\.345,6 g/);
});

test('incomplete concepts cannot scale or reset unknown batch quantities', () => {
  const html = render({ ingredients: [{ ingredientId: 'flour', quantity: 0, unit: 'gram' }] });
  assert.doesNotMatch(html, /Standaard 47|aria-label="Hoeveelheid"/);
});
