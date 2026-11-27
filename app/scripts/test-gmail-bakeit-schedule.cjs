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
  for (const hour of [0, 6, 8, 12, 13, 19, 21, 23]) {
    const run = makeContext(hour);
    run.context.importBakeItContantbonnenTijdvensters();
    assert.equal(run.imports, 0, `uur ${hour}`);
  }
  for (const hour of [7, 11, 20]) {
    const run = makeContext(hour);
    run.context.importBakeItContantbonnenTijdvensters();
    assert.equal(run.imports, 1, `uur ${hour}`);
  }
});

test('oude middagcheck gebruikt dezelfde nieuwe tijdvensters', () => {
  const run = makeContext(11, [], 15);
  run.context.importBakeItContantbonnenMiddagCheck();
  assert.equal(run.imports, 1);
});

test('prognosemails van 11:10, zaterdagprognose en avondbon houden hun juiste status', () => {
  const mail = { getDate: () => new Date() };
  assert.equal(makeContext(7, [], 15).context.inferBakeItMailTimeStatus_(mail), 'prognose');
  assert.equal(makeContext(11, [], 10).context.inferBakeItMailTimeStatus_(mail), 'prognose');
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

test('een oude geslaagde mail maskeert geen mislukte nieuwe PDF in dezelfde thread', () => {
  const {context}=makeContext(20,[],20);
  context.console.error=()=>{};
  const actions=[];
  const old={getId:()=> 'old',getSubject:()=> 'contantbon',getDate:()=>new Date('2026-11-26T19:15:00Z')};
  const latest={...old,getId:()=> 'new'};
  const thread={getMessages:()=>[old,latest],addLabel:l=>actions.push('add:'+l),removeLabel:l=>actions.push('remove:'+l),moveToInbox:()=>actions.push('inbox'),moveToArchive:()=>actions.push('archive')};
  context.PropertiesService={getScriptProperties:()=>({getProperty:k=>k.endsWith(':old')?'done':null,setProperty:()=>assert.fail('failed mail marked imported')})};
  context.Utilities.getUuid=()=> 'run';
  context.searchBakeItThreads_=()=>[thread];
  context.findBakeItWaitingGroups_=()=>({});
  context.buildBakeItImportWaveIds_=()=>({});
  context.extractBakeItPdfAttachments_=()=>[{}];
  context.sendBakeItPdfAttachment_=()=>{throw Error('timeout');};
  context.getBakeItLabelForRun_=(_cache,name)=>name;
  context.verplaatsBakeItIngelezenThreads_=()=>{};
  context.importBakeItContantbonnenUitvoeren_();
  assert.deepEqual(actions,['add:Fout','remove:Ingelezen','inbox']);
});
