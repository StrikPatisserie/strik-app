const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');

const source = readFileSync(join(__dirname, 'gmail-bakeit-contantbon-import.gs'), 'utf8');

function makeContext(hour, triggerNames = [], minute = 0) {
  const deleted = [];
  const created = [];
  const context = {
    console: { log() {} },
    Logger: { log() {} },
    Utilities: {
      formatDate(_date, timezone, format) {
        assert.equal(timezone, 'Europe/Amsterdam');
        assert.ok(format === 'H' || format === 'm');
        return String(format === 'H' ? hour : minute);
      },
    },
    ScriptApp: {
      getProjectTriggers() {
        return triggerNames.map((name) => ({ getHandlerFunction: () => name }));
      },
      deleteTrigger(trigger) {
        deleted.push(trigger.getHandlerFunction());
      },
      newTrigger(name) {
        const result = { name, minutes: null };
        return {
          timeBased() { return this; },
          everyMinutes(minutes) { result.minutes = minutes; return this; },
          create() { created.push(result); },
        };
      },
    },
  };
  vm.createContext(context);
  vm.runInContext(source, context);
  let imports = 0;
  context.importBakeItContantbonnen = () => { imports += 1; };
  return { context, deleted, created, get imports() { return imports; } };
}

test('vijfminutencheck importeert alleen in de drie Amsterdamse uren', () => {
  for (const hour of [0, 6, 8, 11, 13, 19, 21, 23]) {
    const run = makeContext(hour);
    run.context.importBakeItContantbonnenTijdvensters();
    assert.equal(run.imports, 0, `uur ${hour}`);
  }
  for (const hour of [7, 12, 20]) {
    const run = makeContext(hour);
    run.context.importBakeItContantbonnenTijdvensters();
    assert.equal(run.imports, 1, `uur ${hour}`);
  }
});

test('oude middagcheck gebruikt dezelfde nieuwe tijdvensters', () => {
  const run = makeContext(20);
  run.context.importBakeItContantbonnenMiddagCheck();
  assert.equal(run.imports, 1);
});

test('zaterdagprognose en avondbon houden hun juiste status', () => {
  const mail = { getDate: () => new Date() };
  assert.equal(makeContext(7, [], 15).context.inferBakeItMailTimeStatus_(mail), 'prognose');
  assert.equal(makeContext(20, [], 30).context.inferBakeItMailTimeStatus_(mail), 'definitief');
});

test('instelfunctie vervangt alleen Bake-it-triggers door één vijfminutentrigger', () => {
  const oldNames = [
    'importBakeItContantbonnen',
    'importBakeItContantbonnenMiddagCheck',
    'importBakeItContantbonnenTijdvensters',
    'importBakeItBonnen',
    'importDagomzet',
  ];
  const run = makeContext(12, oldNames);
  run.context.maakBakeItImportTriggerAan();
  assert.deepEqual(run.deleted, oldNames.slice(0, 4));
  assert.deepEqual(run.created, [{ name: 'importBakeItContantbonnenTijdvensters', minutes: 5 }]);
});
