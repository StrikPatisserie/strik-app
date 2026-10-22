const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, dependencies = {}) {
  const exports = {};
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(source, { exports, Date, Intl, require: name => dependencies[name] });
  return exports;
}
const dates = load('app/lib/weddingAppointments.ts');
const mail = load('app/lib/weddingMail.ts', { './weddingAppointments': dates });
const appointment = { id: 'example', reference: 'BA-EXAMPLE', appointment_date: '2026-11-14', start_time: '10:30:00', end_time: '11:00:00', names: 'Noor & Sam', email: 'noor@example.com', phone: '06 1234 5678', wedding_date: '2027-05-21', guests: 65, notes: 'Natuurlijke taart', status: 'confirmed', source: 'app' };
test('customer confirmation clearly contains the local appointment, location and preparation', () => {
  const result = mail.weddingConfirmationMail(appointment, false);
  assert.match(result.subject, /zaterdag 14 november 2026 10:30/);
  assert.match(result.html, /10:30–11:00/);
  assert.match(result.html, /Ziekerstraat 124, Nijmegen/);
  assert.match(result.html, /Zo bereiden jullie je voor/);
  assert.match(result.html, /vrijdag 21 mei 2027/);
  assert.doesNotMatch(result.html, /Open de afsprakenagenda/);
});
test('Strik receives a distinct internal confirmation with a link to the private agenda', () => {
  const result = mail.weddingConfirmationMail(appointment, true);
  assert.match(result.html, /Nieuwe bruidstaartafspraak/);
  assert.match(result.html, /direct definitief geboekt/);
  assert.match(result.html, /https:\/\/app.strik-patisserie.nl\/bruidstaarten\/agenda/);
});
test('customer-supplied text stays plain text in the email', () => {
  const result = mail.weddingConfirmationMail({ ...appointment, names: '<script>alert(1)</script>', notes: '<img src=x onerror=alert(1)> & test' }, false);
  assert.doesNotMatch(result.html, /<script>|<img src=x/);
  assert.match(result.html, /&lt;script&gt;/);
  assert.match(result.html, /&lt;img src=x onerror=alert\(1\)&gt; &amp; test/);
});
