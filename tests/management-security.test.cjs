const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(path, imports, globals = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports, require: name => {
    if (!(name in imports)) throw new Error(`Unmocked import: ${name}`);
    return imports[name];
  }, Response, Request, URL, ...globals });
  return exports;
}
const access = load('app/lib/auth/access.ts', {});
const profile = role => ({ id: 'test', active: true, role, permissions: {}, email: 'test@example.invalid' });
test('management requires an explicit manager role, not app.all or bakery.data flags', () => {
  for (const role of ['admin', 'manager', 'management']) assert.equal(access.hasFullAccess(profile(role)), true);
  const employee = { ...profile('bakkerij'), permissions: { 'app.all': true, 'management.view': true, 'bakkerij.data': true } };
  assert.equal(access.hasFullAccess(employee), false);
  assert.equal(access.canAccessPath(employee, '/management/dashboard'), false);
  assert.equal(access.canAccessPath(employee, '/bakkerij/management'), false);
  assert.equal(access.canAccessPath(employee, '/bakkerij/recepturen'), true);
  assert.equal(access.hasFullAccess({ ...profile('admin'), active: false }), false);
});
function middleware(user, aal) {
  return load('app/lib/supabase/middleware.ts', {
    '@supabase/ssr': { createServerClient: () => ({
      auth: { getClaims: async () => ({ data: { claims: user ? { sub: user.id, aal } : null } }), signOut: async () => {} },
      from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: user }) }) }) }),
    }) },
    'next/server': { NextResponse: { next: () => ({ kind: 'next', headers: new Headers() }), json: Response.json, redirect: url => ({ kind: 'redirect', url: url.href }) } },
    './config': { getSupabasePublicConfig: () => ({ isConfigured: true, url: 'https://example.invalid', publishableKey: 'public' }) },
    '../auth/access': access,
  }, { Headers, process: { env: { NODE_ENV: 'production' } } });
}
function request(path) {
  const nextUrl = new URL(path, 'https://app.example.invalid');
  nextUrl.clone = () => new URL(nextUrl);
  return { nextUrl, url: nextUrl.href, cookies: { getAll: () => [], set: () => {} } };
}
test('AAL1 managers cannot reach pages, APIs, or server-action POST paths', async () => {
  const m = middleware(profile('manager'), 'aal1');
  for (const path of ['/', '/settings', '/management/dashboard', '/bakkerij/recepturen']) {
    const result = await m.updateSession(request(path));
    assert.equal(result.kind, 'redirect');
    assert.equal(new URL(result.url).pathname, '/auth/mfa');
  }
  const result = await m.updateSession(request('/api/management-dashboard'));
  assert.equal(result.status, 403);
  assert.equal((await result.json()).code, 'MFA_REQUIRED');
  assert.equal((await m.updateSession(request('/auth/mfa'))).kind, 'next');
});
test('AAL2 manager proceeds; staff cannot call financial or personnel APIs directly', async () => {
  assert.equal((await middleware(profile('manager'), 'aal2').updateSession(request('/management/dashboard'))).kind, 'next');
  const m = middleware(profile('bakkerij'), 'aal1');
  for (const path of ['/api/management-revenue', '/api/tamigo-labor-costs', '/api/tamigo-week-schedule', '/api/tamigo-employees?view=management', '/api/christmas-letters', '/api/recepturen/data-import']) {
    assert.equal((await m.updateSession(request(path))).status, 403, path);
  }
  assert.equal((await m.updateSession(request('/bakkerij/recepturen'))).kind, 'next');
  assert.equal((await middleware(null, 'aal1').updateSession(request('/api/recepturen'))).status, 401);
});
const recipes = load('app/bakkerij/recepturen/recipeAccess.ts', {});
const data = {
  ingredients: [{ id: 'i', name: 'Bloem', allergens: ['gluten'], lastPrice: 999, lastInvoice: 'private-invoice', newFinancialField: 'private', specification: { nutritionPer100g: { protein: 10 }, secretPrice: 99 } }],
  recipes: [{ id: 'r', name: 'Brood', preparationSteps: ['Bakken'], ingredients: [{ ingredientId: 'i', quantity: 100, unit: 'gram', costContribution: 777 }], semiFinishedItems: [], costPrice: 888, currentMargin: 66, newFinancialField: 'private', productionLog: [] }],
  packagingItems: [{ id: 'p', packagePrice: 555, unitPrice: 111 }],
  invoiceImports: [{ invoiceNumber: 'private-invoice' }], hefeOrderHistory: [{ amount: 99 }],
};
test('production projection drops invoices, prices, nested costs and future unknown financial fields', () => {
  const result = recipes.recipeDataForProduction(data);
  assert.equal(result.recipes[0].preparationSteps[0], 'Bakken');
  assert.equal(result.ingredients[0].allergens[0], 'gluten');
  assert.equal(result.recipes[0].costPrice, 0);
  const json = JSON.stringify(result);
  for (const secret of ['private', '999', '888', '777', '555', 'secretPrice', 'newFinancialField']) assert(!json.includes(secret), secret);
  assert.equal(result.invoiceImports.length, 0);
  assert.equal(data.ingredients[0].lastPrice, 999);
});
test('production writes cannot overwrite prices, invoices, recipe definitions or delete recipes', () => {
  const incoming = structuredClone(data);
  incoming.ingredients = [];
  incoming.recipes[0].costPrice = 0;
  incoming.recipes[0].name = 'Unauthorized edit';
  incoming.recipes[0].productionLog = [{ id: 'log', quantity: 10 }];
  incoming.invoiceImports = [];
  const result = recipes.mergeProductionUpdates(data, incoming);
  assert.equal(result.ingredients[0].lastPrice, 999);
  assert.equal(result.recipes[0].costPrice, 888);
  assert.equal(result.recipes[0].name, 'Brood');
  assert.equal(result.recipes[0].productionLog[0].quantity, 10);
  assert.equal(result.invoiceImports[0].invoiceNumber, 'private-invoice');
  incoming.recipes = [];
  assert.equal(recipes.mergeProductionUpdates(data, incoming).recipes.length, 1);
});
