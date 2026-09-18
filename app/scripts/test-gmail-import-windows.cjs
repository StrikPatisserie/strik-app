const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');

function loadScript(fileName, hour, minute = 0, triggerNames = []) {
  const deleted = [];
  const created = [];
  const properties = new Map();
  const context = {
    console: { log() {} },
    Logger: { log() {} },
    Utilities: {
      formatDate(_date, timezone, format) {
        assert.equal(timezone, 'Europe/Amsterdam');
        return String(format === 'H' ? hour : minute);
      },
    },
    ScriptApp: {
      getProjectTriggers: () => triggerNames.map((name) => ({ getHandlerFunction: () => name })),
      deleteTrigger: (trigger) => deleted.push(trigger.getHandlerFunction()),
      newTrigger(name) {
        const trigger = { name, minutes: null };
        return {
          timeBased() { return this; },
          everyMinutes(minutes) { trigger.minutes = minutes; return this; },
          create() { created.push(trigger); },
        };
      },
    },
  };
  vm.createContext(context);
  vm.runInContext(readFileSync(join(__dirname, fileName), 'utf8'), context);
  return { context, deleted, created, properties };
}

test('dagomzet zoekt alleen rond 04:00 en 19:00', () => {
  for (const [hour, minute, expected] of [
    [3, 44, 0], [3, 45, 1], [4, 0, 1], [5, 29, 1], [5, 30, 0],
    [18, 44, 0], [18, 45, 1], [19, 0, 1], [20, 29, 1], [20, 30, 0],
  ]) {
    const run = loadScript('gmail-day-revenue-import.gs', hour, minute);
    let imports = 0;
    run.context.importDagomzet = () => { imports += 1; };
    run.context.importDagomzetTijdvensters();
    assert.equal(imports, expected, `${hour}:${String(minute).padStart(2, '0')}`);
  }
});

test('dagomzet opruimen gebeurt maximaal eenmaal per 24 uur, tenzij handmatig', () => {
  const run = loadScript('gmail-day-revenue-import.gs', 4);
  const props = {
    getProperty: (key) => run.properties.get(key),
    setProperty: (key, value) => run.properties.set(key, value),
  };
  let cleanups = 0;
  run.context.verplaatsDagomzetIngelezenThreads_ = () => { cleanups += 1; };
  run.context.verplaatsDagomzetFoutThreads_ = () => { cleanups += 1; };
  run.context.ruimDagomzetInboxOpIndienNodig_(props, false);
  run.context.ruimDagomzetInboxOpIndienNodig_(props, false);
  assert.equal(cleanups, 2);
  run.context.ruimDagomzetInboxOpIndienNodig_(props, true);
  assert.equal(cleanups, 4);
});

test('lege dagomzetcontrole haalt geen labels op en ruimt niet telkens op', () => {
  const run = loadScript('gmail-day-revenue-import.gs', 4);
  const props = {
    getProperty: (key) => run.properties.get(key),
    setProperty: (key, value) => run.properties.set(key, value),
  };
  run.context.PropertiesService = { getScriptProperties: () => props };
  run.context.getOrCreateDagomzetLabel_ = () => { throw new Error('Geen labels ophalen bij lege controle'); };
  let cleanups = 0;
  run.context.verplaatsDagomzetIngelezenThreads_ = () => { cleanups += 1; };
  run.context.verplaatsDagomzetFoutThreads_ = () => { cleanups += 1; };
  run.context.importDagomzetThreads_([]);
  run.context.importDagomzetThreads_([]);
  assert.equal(cleanups, 2);
});

test('dagomzet instelfunctie vervangt alleen de dagomzettriggers', () => {
  const run = loadScript('gmail-day-revenue-import.gs', 4, 0, [
    'importDagomzet', 'importDagomzet', 'importDagomzetTijdvensters',
    'importBakeItContantbonnenTijdvensters', 'importWebshopAfbeeldingen',
  ]);
  run.context.maakDagomzetImportTriggerAan();
  assert.deepEqual(run.deleted, ['importDagomzet', 'importDagomzet', 'importDagomzetTijdvensters']);
  assert.deepEqual(run.created, [{ name: 'importDagomzetTijdvensters', minutes: 10 }]);
});

test('webshopafbeeldingen zoeken alleen rond de bonnenmomenten', () => {
  for (const hour of [0, 4, 6, 9, 11, 14, 19, 22, 23]) {
    const run = loadScript('gmail-webshop-images-import.gs', hour);
    let imports = 0;
    run.context.importWebshopAfbeeldingen = () => { imports += 1; };
    run.context.importWebshopAfbeeldingenTijdvensters();
    assert.equal(imports, 0, `uur ${hour}`);
  }
  for (const hour of [7, 8, 12, 13, 20, 21]) {
    const run = loadScript('gmail-webshop-images-import.gs', hour);
    let imports = 0;
    run.context.importWebshopAfbeeldingen = () => { imports += 1; };
    run.context.importWebshopAfbeeldingenTijdvensters();
    assert.equal(imports, 1, `uur ${hour}`);
  }
});

test('afbeeldingen instelfunctie vervangt alleen de afbeeldingentriggers', () => {
  const run = loadScript('gmail-webshop-images-import.gs', 12, 0, [
    'importWebshopAfbeeldingen', 'importWebshopAfbeeldingenTijdvensters',
    'importDagomzet', 'importBakeItContantbonnenTijdvensters',
  ]);
  run.context.maakWebshopAfbeeldingenTriggerAan();
  assert.deepEqual(run.deleted, ['importWebshopAfbeeldingen', 'importWebshopAfbeeldingenTijdvensters']);
  assert.deepEqual(run.created, [{ name: 'importWebshopAfbeeldingenTijdvensters', minutes: 30 }]);
});
