const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, imports = {}, expose = '') {
  const exports = {};
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  vm.runInNewContext(source + '\n' + expose, { exports, require: name => name in imports ? imports[name] : {}, Response, Request, FormData, File, Buffer, URL });
  return exports;
}
const utils = load('app/bakkerij/recepturen/utils.ts');
const detail = load('app/bakkerij/recepturen/RecipeDetail.tsx', { './utils': utils }, 'exports.normalizeIngredients = normalizeIngredientDrafts; exports.normalizeSemi = normalizeSemiFinishedDrafts; exports.print = createRecipePrintHtml;');
const labeling = load('app/bakkerij/recepturen/labeling.ts');
const ingredient = { id: 'color', name: 'Paarse kleurstof', aliases: [], recipeUnit: 'gram', allergens: [], lastPrice: 0, pricePerBaseUnit: 0 };
const filling = { id: 'filling', name: 'Macaronvulling cassis', productGroup: 'Vullingen', type: 'semiFinished', standardBatchQuantity: 1, standardBatchUnit: 'kg', batchSize: '1 kg', ingredients: [], semiFinishedItems: [], allergens: [], costPrice: 0, preparationSteps: [] };
function recipe() {
  return { ...filling, id: 'macaron', name: 'Cassis macaron', type: 'finalProduct', status: 'draft', productGroup: 'Macarons', standardBatchQuantity: 1, standardBatchUnit: 'stuk', batchSize: '1 stuk', ingredients: [{ ingredientId: 'color', quantity: 10, unit: 'gram', costContribution: 0 }], semiFinishedItems: [{ semiFinishedRecipeId: 'filling', quantity: 0, unit: 'kg', costContribution: 0 }], lastUpdated: '2026-10-16', salesPrice: 0, targetMargin: 80 };
}
test('selected components survive saving while their amounts are still unknown', () => {
  const semi = detail.normalizeSemi([{ semiFinishedRecipeId: 'filling', quantity: '', unit: 'kg' }, { semiFinishedRecipeId: '', quantity: '0', unit: 'kg' }], [filling]);
  assert.equal(semi.length, 1);
  assert.equal(semi[0].semiFinishedRecipeId, 'filling');
  assert.equal(semi[0].quantity, 0);
  const direct = detail.normalizeIngredients([{ ingredientId: 'color', quantity: '', unit: 'gram' }], [ingredient]);
  assert.equal(direct.length, 1);
  assert.equal(utils.recipeHasMissingQuantities({ ingredients: direct, semiFinishedItems: semi }), true);
  assert.equal(utils.recipeHasMissingQuantities({ ingredients: [], semiFinishedItems: [{ ...semi[0], quantity: 0.1 }] }), false);
});
test('a concept print shows its linked filling and original color amount without scaling a made-up yield', () => {
  const html = detail.print(recipe(), [ingredient], [filling], 5, 1, 'work');
  assert.match(html, /Macaronvulling cassis/);
  assert.match(html, /Nog invullen/);
  assert.match(html, /ongeschaalde bronhoeveelheden/);
  assert.match(html, /Paarse kleurstof<\/td><td>10<\/td>/);
  assert.doesNotMatch(html, /Paarse kleurstof<\/td><td>50<\/td>/);
});
test('unknown filling quantity warns and includes its potential allergens without producing nutrition totals', () => {
  const nut = { id: 'nut', name: 'Pistache', allergens: ['noten'], specification: { allergensConfirmed: true, nutritionPer100g: { energyKj: 100, energyKcal: 24, fat: 1, saturates: 1, carbohydrates: 1, sugars: 1, protein: 1, salt: 0 } } };
  const semi = { ...filling, ingredients: [{ ingredientId: 'nut', quantity: 100, unit: 'gram' }], labeling: { finalBatchWeightGrams: 100 } };
  const result = labeling.calculateLabel({ ...recipe(), labeling: { finalBatchWeightGrams: 110 } }, [ingredient, nut], [semi]);
  assert(result.allergens.includes('noten'));
  assert(result.warnings.some(w => /Hoeveelheid halffabricaat ontbreekt/.test(w)));
  assert.equal(Object.keys(result.nutrition).length, 0);
});
test('table import preserves a deliberate unknown quantity as a real halffabricaat link', async () => {
  const route = load('app/api/recepturen/data-import/route.ts', {
    '@/app/lib/auth/session': { getCurrentProfile: async () => ({ role: 'manager', active: true }) },
    '@/app/lib/auth/access': { hasFullAccess: () => true },
    '@/app/bakkerij/recepturen/utils': utils,
    'papaparse': require('papaparse'),
    'next/server': { NextResponse: { json: Response.json } },
  });
  const form = new FormData();
  form.set('recipes', JSON.stringify([filling])); form.set('ingredients', JSON.stringify([ingredient]));
  form.set('file', new File(['recept;grondstof;hoeveelheid;eenheid\nCassis macaron;Macaronvulling cassis;0;kg\nCassis macaron;Paarse kleurstof;10;gram'], 'concept.txt', { type: 'text/plain' }));
  const response = await route.POST({ formData: async () => form });
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.recipes[0].semiFinishedItems[0].semiFinishedRecipeId, 'filling');
  assert.equal(data.recipes[0].semiFinishedItems[0].quantity, 0);
  assert.equal(data.recipes[0].ingredients[0].quantity, 10);
  assert.equal(data.unresolvedItems.length, 0);
});
