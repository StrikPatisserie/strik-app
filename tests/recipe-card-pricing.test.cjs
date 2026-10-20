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
