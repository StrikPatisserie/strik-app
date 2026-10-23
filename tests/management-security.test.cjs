const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(path, imports, globals = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText, { exports, require: name => {
    if (!(name in imports)) throw new Error(`Unmocked import: ${name}`);
    return imports[name];
  }, Response, Request, URL, ...globals });
  return exports;
}
const access = load('app/lib/auth/access.ts', {});
const now = Math.floor(Date.now() / 1000);
// Boundary assertions must use the same clock even during a slower full run.
const mfa = load('app/lib/auth/mfa.ts', {}, { Date: { now: () => now * 1000 } });
const claimsFor = (aal, timestamp = now) => ({ sub: 'test', aal, amr: [{ method: 'password', timestamp: now }, { method: 'totp', timestamp }] });
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
function responseCookies(result) {
  const values = new Map();
  result.cookies = {
    getAll: () => [...values.values()],
    set(name, value, options) { const cookie = typeof name === 'string' ? { name, value, ...options } : name; values.set(cookie.name, cookie); },
  };
  return result;
}
function middleware(user, aal, options = {}) {
  return load('app/lib/supabase/middleware.ts', {
    '@supabase/ssr': { createServerClient: (_, __, config) => ({
      auth: { getClaims: async () => {
        if (options.refresh) config.cookies.setAll([{ name: 'sb-session', value: 'refreshed', options: { secure: true, sameSite: 'lax', path: '/', maxAge: 34560000 } }], { 'Cache-Control': 'private, no-store', Expires: '0', Pragma: 'no-cache' });
        return { data: { claims: user ? (options.claims || claimsFor(aal)) : null } };
      }, signOut: async () => {
        config.cookies.setAll([{ name: 'sb-session', value: '', options: { path: '/', maxAge: 0 } }], {});
      } },
      from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: user }) }) }) }),
    }) },
    'next/server': { NextResponse: { next: () => responseCookies({ kind: 'next', headers: new Headers() }), json: (...args) => responseCookies(Response.json(...args)), redirect: url => responseCookies({ kind: 'redirect', url: url.href, headers: new Headers() }) } },
    './config': { getSupabasePublicConfig: () => ({ isConfigured: true, url: 'https://example.invalid', publishableKey: 'public' }) },
    '../auth/access': access,
    '../auth/mfa': mfa, '../auth/cron': { hasCronAuthorization: () => false },
  }, { Headers, process: { env: { NODE_ENV: 'production' } } });
}
function request(path) {
  const nextUrl = new URL(path, 'https://app.example.invalid');
  nextUrl.clone = () => new URL(nextUrl);
  return { nextUrl, url: nextUrl.href, cookies: { getAll: () => [], set: () => {} } };
}
test('published folder videos are accessible without login; other media and private APIs remain protected', async () => {
  const pricing = load('app/lib/business-folder-pricing.ts', {});
  const catalog = load('app/kerst-voor-bedrijven/christmasProducts.ts', { '@/app/lib/business-folder-pricing': pricing });
  const anonymous = middleware(null, 'aal1');
  for (const highlight of catalog.christmasHighlights) {
    if (!highlight.story) continue;
    const result = await anonymous.updateSession(request(highlight.story.src));
    assert.equal(result.kind, 'next', highlight.story.src);
    assert.notEqual(result.headers.get('Cache-Control'), 'private, no-store');
    assert.equal((await middleware(profile('manager'), 'aal1').updateSession(request(highlight.story.src))).kind, 'next');
  }
  for (const path of ['/Kerst/interne-video.mp4', '/management/rapport.mp4']) {
    const result = await anonymous.updateSession(request(path));
    assert.equal(result.kind, 'redirect');
    assert.equal(new URL(result.url).pathname, '/login');
  }
  assert.equal((await anonymous.updateSession(request('/api/management-revenue/export.mp4'))).status, 401);
});
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
  for (const path of ['/api/management-revenue', '/api/tamigo-labor-costs', '/api/tamigo-week-schedule', '/api/tamigo-hours-review', '/api/tamigo-employees?view=management', '/api/christmas-letters', '/api/recepturen/data-import']) {
    assert.equal((await m.updateSession(request(path))).status, 403, path);
  }
  assert.equal((await m.updateSession(request('/bakkerij/recepturen'))).kind, 'next');
  assert.equal((await middleware(null, 'aal1').updateSession(request('/api/recepturen'))).status, 401);
});
test('a verified MFA code lasts exactly seven days; token refreshes and malformed claims cannot extend it', () => {
  const week = 604800;
  assert.equal(mfa.MFA_VALIDITY_SECONDS, week);
  assert.equal(mfa.hasRecentMfa(claimsFor('aal2', now - week + 1), now), true);
  for (const claims of [
    null, {}, claimsFor('aal1'), claimsFor('aal2', now - week), claimsFor('aal2', now - week - 1),
    claimsFor('aal2', now + 1), claimsFor('aal2', 'yesterday'), claimsFor('aal2', Infinity),
    { aal: 'aal2', iat: now }, { aal: 'aal2', amr: ['totp'] }, { aal: 'aal2', amr: [{ method: 'password', timestamp: now }] },
    { aal: 'aal2', amr: [{ method: 'token_refresh', timestamp: now }, { method: 'totp', timestamp: now - week }] },
  ]) assert.equal(mfa.hasRecentMfa(claims, now), false, JSON.stringify(claims));
  assert.equal(mfa.hasRecentMfa({ aal: 'aal2', amr: [{ method: 'mfa/totp', timestamp: now }] }, now), true);
  assert.equal(mfa.hasRecentMfa({ aal: 'aal2', amr: [null, 'invalid', { method: 'totp', timestamp: now }] }, now), true);
});
test('the weekly deadline is enforced on page and API requests without logging out the user', async () => {
  const expired = middleware(profile('manager'), 'aal2', { claims: claimsFor('aal2', now - 604800) });
  const page = await expired.updateSession(request('/bakkerij/recepturen?recipe=stol'));
  assert.equal(new URL(page.url).pathname, '/auth/mfa');
  assert.equal(new URL(page.url).searchParams.get('next'), '/bakkerij/recepturen?recipe=stol');
  const api = await expired.updateSession(request('/api/management-dashboard'));
  assert.equal(api.status, 403);
  assert.equal((await api.json()).code, 'MFA_REQUIRED');
  assert.equal((await expired.updateSession(request('/auth/mfa'))).kind, 'next');
  assert.equal((await expired.updateSession(request('/kerst-voor-bedrijven'))).kind, 'next');
});
test('refreshed session cookies survive every redirect and denial, including public login and MFA redirects', async () => {
  for (const [user, aal, path] of [
    [profile('manager'), 'aal2', '/management/dashboard'],
    [profile('manager'), 'aal2', '/login'],
    [profile('manager'), 'aal1', '/management/dashboard'],
    [profile('manager'), 'aal1', '/api/management-dashboard'],
    [profile('bakkerij'), 'aal1', '/management/dashboard'],
    [profile('bakkerij'), 'aal1', '/api/management-dashboard'],
    [null, 'aal1', '/management/dashboard'],
    [null, 'aal1', '/api/recepturen'],
  ]) {
    const result = await middleware(user, aal, { refresh: true }).updateSession(request(path));
    const cookie = result.cookies.getAll().find(cookie => cookie.name === 'sb-session');
    assert.equal(cookie?.value, 'refreshed', path);
    assert.equal(cookie.secure, true);
    assert.equal(cookie.maxAge, 34560000);
    assert.match(result.headers.get('Cache-Control'), /no-store/);
    assert.equal(result.headers.get('Expires'), '0');
    assert.equal(result.headers.get('Pragma'), 'no-cache');
  }
  const inactive = await middleware({ ...profile('manager'), active: false }, 'aal2', { refresh: true }).updateSession(request('/management/dashboard'));
  assert.equal(inactive.cookies.getAll().find(cookie => cookie.name === 'sb-session').maxAge, 0);
});
function sessionModule(claims, user = profile('manager')) {
  return load('app/lib/auth/session.ts', {
    'server-only': {}, 'next/navigation': { redirect: url => { throw Error(url); } },
    '../supabase/server': { createClient: async () => ({
      auth: { getClaims: async () => ({ data: { claims } }) },
      from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: user }) }) }) }),
    }) },
    '../supabase/admin': {}, './access': access, './mfa': mfa,
  });
}
test('server actions cannot authorize a manager after seven days or with only a password', async () => {
  assert.equal((await sessionModule(claimsFor('aal2', now - 604799)).getCurrentProfile()).id, 'test');
  for (const claims of [claimsFor('aal1'), claimsFor('aal2', now - 604800), { sub: 'test', aal: 'aal2' }]) {
    assert.equal(await sessionModule(claims).getCurrentProfile(), null);
    await assert.rejects(sessionModule(claims).requireAdminProfile(), /\/login/);
  }
  assert.equal((await sessionModule(claimsFor('aal1'), profile('bakkerij')).getCurrentProfile()).role, 'bakkerij');
});
test('MFA page accepts a fresh session and shows the code form for an expired session without a redirect loop', async () => {
  for (const [claims, redirectExpected] of [[claimsFor('aal2'), true], [claimsFor('aal2', now - 604800), false], [claimsFor('aal1'), false]]) {
    const page = load('app/auth/mfa/page.tsx', {
      'react/jsx-runtime': { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) },
      'next/navigation': { redirect: url => { throw Error(`redirect:${url}`); } },
      '@/app/lib/supabase/server': { createClient: async () => ({
        auth: { getClaims: async () => ({ data: { claims } }) },
        from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: profile('manager') }) }) }) }),
      }) },
      '@/app/lib/auth/access': access, '@/app/lib/auth/mfa': mfa, './MfaPanel': { default: 'MfaPanel' },
    });
    const result = page.default({ searchParams: Promise.resolve({ next: '/management/dashboard' }) });
    if (redirectExpected) await assert.rejects(result, /redirect:\/management\/dashboard/);
    else assert.equal((await result).type, 'main');
  }
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
