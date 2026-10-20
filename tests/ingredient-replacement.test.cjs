const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, imports = {}) {
  const exports = {};
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  vm.runInNewContext(source, { exports, require: name => imports[name] || {}, Response, Request, FormData, File, Buffer, URL });
  return exports;
}
const plain = value => JSON.parse(JSON.stringify(value));
const utils = load('app/bakkerij/recepturen/utils.ts');
const replacement = load('app/bakkerij/recepturen/ingredientReplacement.ts', { './utils': utils });
const ingredient = (id, name, extra = {}) => ({ id, name, aliases: [], supplier: 'Leverancier', supplierArticleNumber: id, packageSize: '', recipeUnit: 'gram', lastPrice: 5, previousPrice: 4, pricePerBaseUnit: .005, allergens: ['melk'], status: 'active', ...extra });
const line = (ingredientId, quantity, unit = 'gram', extra = {}) => ({ ingredientId, quantity, unit, costContribution: 1, ...extra });
const recipe = (id, ingredients = [], semiFinishedItems = []) => ({ id, name: id, type: 'semiFinished', productGroup: 'Vullingen', standardBatchQuantity: 1, standardBatchUnit: 'kg', batchSize: '1 kg', ingredients, semiFinishedItems, costPrice: 0, preparationSteps: [], lastUpdated: '2026-01-01' });
const source = ingredient('old', 'Slagroom met 10% suiker 35% vet UHT 2l', { aliases: ['Zoete Beko slagroom', '8040457'], specification: { specsPlazaProductId: 'old-spec' } });
const cream = ingredient('hefe', 'Slagroom 40%', { lastPrice: 3.2, pricePerBaseUnit: .0032, specification: { densityGramsPerMl: 1 } });
const sugar = ingredient('sugar', 'Kristalsuiker extra fijn', { lastPrice: .65, pricePerBaseUnit: .00065 });
const sweet = recipe('Gezoete slagroom', [line('hefe', 5, 'liter'), line('sugar', 450)]);

test('raw supplier replacement keeps quantities, units, old prices and specification, and input data', () => {
  const ingredients = [source, cream, sugar];
  const recipes = [recipe('Roomvulling', [line('old', 2, 'liter', { wastePercentage: 3, sortOrder: 4 }), line('sugar', 150)])];
  const before = JSON.stringify({ ingredients, recipes });
  const result = replacement.replaceIngredientForRecipes('old', { kind: 'ingredient', id: 'hefe' }, ingredients, recipes, '2026-10-20');
  assert.equal(result.affectedRecipes, 1);
  assert.deepEqual(plain(result.recipes[0].ingredients[0]), { ingredientId: 'hefe', quantity: 2, unit: 'liter', costContribution: 0, wastePercentage: 3, sortOrder: 4 });
  assert.equal(result.ingredients[0].status, 'inactive');
  assert.equal(result.ingredients[0].lastPrice, 5);
  assert.equal(result.ingredients[0].specification.specsPlazaProductId, 'old-spec');
  assert.equal(result.ingredients[1].lastPrice, 3.2);
  assert(result.ingredients[1].aliases.includes(source.name));
  assert(!result.ingredients[1].aliases.includes('8040457'));
  assert.equal(JSON.stringify({ ingredients, recipes }), before);
});

test('sweetened cream becomes a semi-finished reference without adding sugar or coalescing duplicate rows', () => {
  const recipes = [sweet, recipe('Vanille mousse', [line('old', 500, 'gram', { sortOrder: 1 }), line('sugar', 350, 'gram', { sortOrder: 2 }), line('old', 2200, 'gram', { sortOrder: 3 })], [{ semiFinishedRecipeId: 'other', quantity: 100, unit: 'gram', costContribution: 1, sortOrder: 0 }])];
  const result = replacement.replaceIngredientForRecipes('old', { kind: 'semiFinished', id: sweet.id }, [source, cream, sugar], recipes);
  assert.equal(result.affectedRecipes, 1);
  assert.deepEqual(plain(result.recipes[1].ingredients), plain([recipes[1].ingredients[1]]));
  assert.deepEqual(plain(result.recipes[1].semiFinishedItems.map(({ semiFinishedRecipeId, quantity, unit, sortOrder }) => ({ semiFinishedRecipeId, quantity, unit, sortOrder }))), [
    { semiFinishedRecipeId: 'other', quantity: 100, unit: 'gram', sortOrder: 0 },
    { semiFinishedRecipeId: sweet.id, quantity: 500, unit: 'gram', sortOrder: 1 },
    { semiFinishedRecipeId: sweet.id, quantity: 2200, unit: 'gram', sortOrder: 3 },
  ]);
  assert.deepEqual(plain(result.recipes[0]), plain(sweet));
});

test('replacement refuses self links, missing targets, circular recipes and loss of waste percentages', () => {
  assert.throws(() => replacement.replaceIngredientForRecipes('old', { kind: 'ingredient', id: 'old' }, [source], []), /andere actieve/);
  assert.throws(() => replacement.replaceIngredientForRecipes('old', { kind: 'ingredient', id: 'missing' }, [source], []), /andere actieve/);
  const child = recipe('child', [line('old', 100)]);
  const parent = recipe('parent', [], [{ semiFinishedRecipeId: 'child' }]);
  assert.throws(() => replacement.replaceIngredientForRecipes('old', { kind: 'semiFinished', id: 'parent' }, [source], [parent, child]), /kringverwijzing/);
  assert.throws(() => replacement.replaceIngredientForRecipes('old', { kind: 'semiFinished', id: sweet.id }, [source, cream, sugar], [sweet, recipe('waste', [line('old', 100, 'gram', { wastePercentage: 5 })])]), /uitval/);
});

test('replacement chains resolve to the current product and broken or circular chains remain unresolved', () => {
  const old = { ...source, status: 'inactive', recipeReplacement: { kind: 'ingredient', id: cream.id } };
  assert.equal(replacement.resolveRecipeReplacement(old, [old, cream], []).item.id, cream.id);
  assert.equal(replacement.resolveRecipeReplacement(old, [old], []), undefined);
  assert.equal(replacement.resolveRecipeReplacement(old, [old, { ...cream, recipeReplacement: { kind: 'ingredient', id: old.id } }], []), undefined);
});

test('5 liters of the invoice cream and 450 grams sugar cost €16.29 without assuming a density for other ingredients', () => {
  assert.equal(utils.ingredientCostForQuantity(cream, 5, 'liter'), 16);
  assert.equal(utils.ingredientCostForQuantity(cream, 5000, 'ml'), 16);
  assert.equal(utils.ingredientCostForQuantity(cream, 5000, 'gram'), 16);
  assert.equal(utils.ingredientCostForQuantity({ ...cream, specification: { densityGramsPerMl: 2 } }, 5, 'liter'), 32);
  assert.equal(utils.ingredientCostForQuantity(sugar, 450, 'gram'), .293);
  const perLiter = { ...cream, recipeUnit: 'liter', pricePerBaseUnit: 3.2 };
  assert.equal(utils.ingredientCostForQuantity(perLiter, 5000, 'gram'), 16);
  assert.equal(utils.ingredientCostForQuantity(perLiter, 5, 'kg'), 16);
  const costs = utils.recalculateAllRecipeCosts([sweet], [cream, sugar]);
  assert.equal(costs[0].standardBatchQuantity, 5.45);
  assert.equal(costs[0].costPrice, 2.99);
});

test('future imports redirect old sweetened names, raw names and generic room, while keeping the whipped recipe distinct', async () => {
  const oldSweet = { ...source, status: 'inactive', recipeReplacement: { kind: 'semiFinished', id: sweet.id } };
  const oldRaw = ingredient('beko', 'Slagroom', { status: 'inactive', recipeReplacement: { kind: 'ingredient', id: cream.id } });
  const oldRoom = ingredient('room', 'room', { status: 'inactive', recipeReplacement: { kind: 'ingredient', id: cream.id } });
  const whipped = { ...recipe('whipped', [line('hefe', 20000), line('sugar', 1800)]), name: 'Slagroom opgeklopt' };
  const inactive = ingredient('unused', 'Verouderde grondstof', { status: 'inactive' });
  const route = load('app/api/recepturen/data-import/route.ts', {
    '@/app/lib/auth/session': { getCurrentProfile: async () => ({ role: 'manager', active: true }) },
    '@/app/lib/auth/access': { hasFullAccess: () => true },
    '@/app/bakkerij/recepturen/utils': utils,
    '@/app/bakkerij/recepturen/ingredientReplacement': replacement,
    'papaparse': require('papaparse'), 'next/server': { NextResponse: { json: Response.json } },
  });
  const form = new FormData();
  form.set('ingredients', JSON.stringify([oldSweet, oldRaw, oldRoom, inactive, cream, sugar]));
  form.set('recipes', JSON.stringify([sweet, whipped]));
  form.set('file', new File([`recept;grondstof;hoeveelheid;eenheid\nTest;${source.name};500;gram\nTest;Slagroom;2;liter\nTest;room;100;gram\nTest;Slagroom opgeklopt;250;gram\nTest;Verouderde grondstof;10;gram`], 'recipe.txt', { type: 'text/plain' }));
  const response = await route.POST({ formData: async () => form });
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.deepEqual(data.recipes[0].ingredients.map(({ ingredientId, quantity, unit }) => ({ ingredientId, quantity, unit })), [
    { ingredientId: cream.id, quantity: 2, unit: 'liter' }, { ingredientId: cream.id, quantity: 100, unit: 'gram' },
  ]);
  assert.deepEqual(data.recipes[0].semiFinishedItems.map(({ semiFinishedRecipeId, quantity }) => ({ semiFinishedRecipeId, quantity })), [
    { semiFinishedRecipeId: sweet.id, quantity: 500 }, { semiFinishedRecipeId: whipped.id, quantity: 250 },
  ]);
  assert.equal(data.unresolvedItems.length, 1);
  assert.equal(data.unresolvedItems[0].name, 'Verouderde grondstof');
});
