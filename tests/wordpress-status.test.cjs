const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function statusApi({ recipeStatus = 200, noSession = false, retry = false, recipeKey = 'recipe-test-key' } = {}) {
  const calls = [];
  let authCalls = 0;
  const exports = {};
  const source = ts.transpileModule(fs.readFileSync('app/api/wordpress-status/route.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const imports = {
    'next/server': { NextResponse: Response },
    '@/app/management/leatInsightsServer': { checkLeatConnection: async () => true },
    '@/app/lib/recipeStorageAuth': { recipeStorageAuthHeaders: async () => {
      authCalls++;
      if (noSession) throw new Error('No session');
      return { Accept: 'application/json', 'X-Strik-User-Token': 'fake-test-session' };
    } },
  };
  vm.runInNewContext(source, {
    exports, URL, setTimeout: callback => callback(),
    process: { env: { WORDPRESS_STRIK_API_KEY: 'shared-test-key', WORDPRESS_RECEPTUREN_API_KEY: recipeKey } },
    require(name) { assert.ok(name in imports, name); return imports[name]; },
    fetch: async (url, options) => {
      calls.push({ url, options });
      const recipeCalls = calls.filter(call => call.url.pathname.endsWith('/recepturen'));
      if (url.pathname.endsWith('/recepturen')) {
        if (options.headers['X-Strik-User-Token'] !== 'fake-test-session') return new Response('{}', { status: 401 });
        return new Response('{}', { status: retry && recipeCalls.length === 1 ? 503 : recipeStatus });
      }
      return new Response('{}', { status: 200 });
    },
  });
  return { GET: exports.GET, calls, authCalls: () => authCalls };
}

test('recipe status uses the current session and recipe key, without forwarding the token to other integrations', async () => {
  const api = statusApi();
  const data = await (await api.GET()).json();
  assert.equal(data.ok, true);
  const recipe = data.checks.find(check => check.id === 'recepturen');
  assert.equal(recipe.status, 200);
  assert.equal(recipe.message, 'Verbonden');
  assert.equal(api.authCalls(), 1);
  for (const call of api.calls) {
    assert.equal(call.options.cache, 'no-store');
    const isRecipe = call.url.pathname.endsWith('/recepturen');
    assert.equal(call.url.searchParams.get('key'), isRecipe ? 'recipe-test-key' : 'shared-test-key');
    assert.equal(call.options.headers['X-Strik-User-Token'], isRecipe ? 'fake-test-session' : undefined);
  }
  assert.ok(!JSON.stringify(data).includes('fake-test-session'));
});

test('recipe retry preserves authentication and falls back to the shared key when no recipe key is configured', async () => {
  const api = statusApi({ retry: true, recipeKey: '' });
  const data = await (await api.GET()).json();
  assert.equal(data.ok, true);
  const calls = api.calls.filter(call => call.url.pathname.endsWith('/recepturen'));
  assert.equal(calls.length, 2);
  for (const call of calls) {
    assert.equal(call.options.headers['X-Strik-User-Token'], 'fake-test-session');
    assert.equal(call.url.searchParams.get('key'), 'shared-test-key');
  }
});

test('an invalid or missing recipe session never produces a false connected status', async () => {
  const invalid = statusApi({ recipeStatus: 401 });
  const data = await (await invalid.GET()).json();
  assert.equal(data.ok, false);
  assert.equal(data.checks.find(check => check.id === 'recepturen').message, 'Opnieuw inloggen');
  const missing = statusApi({ noSession: true });
  const result = await (await missing.GET()).json();
  assert.equal(result.checks.find(check => check.id === 'recepturen').ok, false);
  assert.equal(missing.calls.some(call => call.url.pathname.endsWith('/recepturen')), false);
});
