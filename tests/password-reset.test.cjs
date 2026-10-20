const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, imports = {}, globals = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports, require: name => imports[name] || {}, URL, URLSearchParams, ...globals });
  return exports;
}
const { getPasswordUpdateUrl, getPasswordResetErrorMessage } = load('app/lib/supabase/passwordReset.ts');
const { loadPasswordRecoverySession } = load('app/lib/supabase/recoverySession.ts');
test('the recovery client uses cookie storage but disables automatic URL redemption', () => {
  let options;
  const { createRecoveryClient } = load('app/lib/supabase/client.ts', {
    '@supabase/ssr': { createBrowserClient: (_, __, value) => { options = value; return {}; } },
    './config': { requireSupabasePublicConfig: () => ({ url: 'https://auth.example.invalid', publishableKey: 'public' }) },
  });
  createRecoveryClient();
  assert.equal(options.isSingleton, false);
  assert.equal(options.auth.detectSessionInUrl, false);
});
test('recovery URLs handle trailing slashes and SMTP failures have actionable, non-sensitive messages', () => {
  assert.equal(getPasswordUpdateUrl('https://app.example.invalid/'), 'https://app.example.invalid/update-password');
  assert.match(getPasswordResetErrorMessage({ code: 'email_address_not_authorized' }), /mailinstellingen/);
  assert.match(getPasswordResetErrorMessage({ code: 'over_email_send_rate_limit' }), /verzendlimiet/);
  assert.match(getPasswordResetErrorMessage({ code: 'over_request_rate_limit' }), /Wacht een minuut/);
  assert(!getPasswordResetErrorMessage(new Error('secret-provider-response')).includes('secret'));
  const config = load('app/lib/supabase/config.ts', {}, { process: { env: { NODE_ENV: 'production' } } });
  assert.equal(config.getSiteUrl(), 'https://app.strik-patisserie.nl');
});
function auth() {
  const calls = [];
  const result = { error: null, data: { session: { user: { id: 'staff' } } } };
  return { calls, setSession: async value => { calls.push(['tokens', value]); return result; }, exchangeCodeForSession: async code => { calls.push(['code', code]); return result; }, verifyOtp: async value => { calls.push(['otp', value]); return result; }, getSession: async () => result };
}
test('reset links work with implicit tokens, PKCE codes, and recovery token hashes', async () => {
  for (const [query, hash, method] of [['', '#access_token=access&refresh_token=refresh', 'tokens'], ['?code=code', '', 'code'], ['?token_hash=hash&type=recovery', '', 'otp']]) {
    const client = auth();
    const result = await loadPasswordRecoverySession(client, query, hash);
    assert.equal(result.ready, true);
    assert.equal(result.clearUrl, true);
    assert.equal(client.calls[0][0], method);
  }
});
test('invalid links do not fall back to an unrelated signed-in account', async () => {
  for (const [query, hash] of [['?error=expired', ''], ['', '#access_token=only-one-token'], ['?token_hash=hash&type=signup', '']]) {
    const client = auth();
    const result = await loadPasswordRecoverySession(client, query, hash);
    assert.equal(result.ready, false);
    assert.equal(client.calls.length, 0);
  }
  const client = auth();
  client.exchangeCodeForSession = async () => ({ error: new Error('invalid'), data: { session: null } });
  assert.equal((await loadPasswordRecoverySession(client, '?code=expired', '')).ready, false);
});
test('network errors are shown without leaking tokens or provider diagnostics', async () => {
  const client = auth();
  client.verifyOtp = async () => { throw Error('secret-provider-response'); };
  const result = await loadPasswordRecoverySession(client, '?token_hash=hash&type=recovery', '');
  assert.equal(result.ready, false);
  assert.equal(result.clearUrl, false);
  assert(!result.message.includes('secret'));
});
