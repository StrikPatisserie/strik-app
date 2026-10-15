const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');
function load(name) {
  const context = vm.createContext({ console, Logger: { log() {} } });
  vm.runInContext(readFileSync(join(__dirname, name), 'utf8'), context);
  return context;
}
test('oude en custom contantbonnen worden herkend en in dezelfde deelgroep geplaatst', () => {
  const c = load('gmail-bakeit-contantbon-import.gs');
  for (const subject of ['Orders email-Contantbon A5 deel 1', 'order email contantbon A5 deel 1', 'custom_order Contantbon A5 deel 1', 'CUSTOM_ORDER Contantbon A5 deel 2']) {
    const message = { getSubject: () => subject };
    assert.equal(c.isBakeItContantbonCandidate_(message), true);
    assert.equal(c.isBakeItOrdersEmailContantbonMail_(message), true);
    assert.equal(c.normalizeBakeItSubjectForWave_(subject), 'orders email contantbon a5');
  }
  assert.equal(c.getBakeItMailPartNumber_('custom_order Contantbon A5 deel 3'), 3);
  assert.equal(c.isBakeItContantbonCandidate_({ getSubject: () => 'custom_omzet Cash-it Filiaal Dag Rapport' }), false);
  assert.equal(c.isBakeItOrdersEmailContantbonMail_({ getSubject: () => 'Factuur A5' }), false);
});
test('actuele zoekopdrachten vinden custom rapportnamen zonder afhankelijkheid van Gmail-label', () => {
  const c = load('gmail-day-revenue-import.gs');
  const queries = vm.runInContext('DAGOMZET_IMPORT_CONFIG.SEARCH_QUERIES', c);
  assert(queries.some(q => q.includes('subject:"Filiaal Dag Rapport"') && !q.includes('label:"Dagomzet"')));
  assert(queries.some(q => q.includes('subject:"Dag Rapport ijs"') && !q.includes('label:"Dagomzet"')));
  const b = load('gmail-bakeit-contantbon-import.gs');
  const bakeQueries = vm.runInContext('BAKEIT_CONTANTBON_CONFIG.SEARCH_QUERIES', b);
  assert(bakeQueries.some(q => q.includes('subject:"contantbon A5"') && !q.includes('label:"Contantbonnen"')));
  // Stable import versions preserve message-ID deduplication after renaming.
  assert.equal(vm.runInContext('BAKEIT_CONTANTBON_CONFIG.IMPORT_VERSION', b), 'split-mails-v1');
  assert.equal(vm.runInContext('DAGOMZET_IMPORT_CONFIG.IMPORT_VERSION', c), 'dagomzet-v1');
});
