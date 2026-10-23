const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');

function load(file,imports={},expose='') {
  const exports={};
  const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  vm.runInNewContext(code+'\n'+expose,{exports,Date,Intl,require:name=>imports[name]||{}});
  return exports;
}
const plans=load('app/winkel/haccp/workPlans.ts',{'../../lib/auth/access':{WINKEL_STORE_IDS:['ziekerstraat','heyendaal','daalseweg','lent']}});
const {visible}=load('app/winkel/haccp/WinkelWorkPlanChecklist.tsx',{},'exports.visible=getVisibleSections;');
const definition=plans.getWinkelWorkPlanDefinition('heyendaal','schoonmaakrooster');
const itemsFor=date=>visible(definition,date).flatMap(section=>section.items);

test('Saturday has the requested time blocks and each existing task remains available exactly once',()=>{
  const sections=visible(definition,'2026-10-24');
  for(const id of ['zaterdag-voor-13','zaterdag-na-17','zaterdag-na-sluiting','dagtaken'])assert(sections.some(section=>section.id===id),id);
  const items=itemsFor('2026-10-24');
  assert.equal(new Set(items.map(item=>item.id)).size,items.length);
  for(const id of ['za-vitrine','za-oven','za-schrobben-plinten','za-broodmachine-compressor','dag-stofzuig'])assert.equal(items.filter(item=>item.id===id).length,1,id);
  assert(!items.some(item=>item.id.startsWith('zo-')));
});
test('Saturday preparation, compressor cleaning and every display cleaning step are included',()=>{
  const sections=visible(definition,'2026-10-24');
  assert.equal(sections.find(section=>section.id==='zaterdag-voor-13').items.length,5);
  const items=itemsFor('2026-10-24');
  assert.match(items.find(item=>item.id==='za-zondag-klaarleggen').label,/Croissants, broodjes en VGB-broden/);
  assert.match(items.find(item=>item.id==='za-broodmachine-compressor').detail,/sleutel.+compressor/);
  assert.equal(items.find(item=>item.id==='za-vitrine').steps.length,7);
});
test('Sunday includes both cooling-cleaning procedures and the regular daily tasks',()=>{
  const sections=visible(definition,'2026-10-25');
  const sunday=sections.find(section=>section.id==='zondag-na-sluiting');
  assert.equal(sunday.items.length,2);
  assert.equal(sunday.items[0].steps.length,5);
  assert.equal(sunday.items[1].steps.length,4);
  const items=itemsFor('2026-10-25');
  assert(items.some(item=>item.id==='dag-stofzuig'));
  assert(items.some(item=>item.id==='dag-bonbons'));
  assert(!items.some(item=>item.id.startsWith('za-')));
  assert.equal(new Set(items.map(item=>item.id)).size,items.length);
});
test('weekday cleaning and closing plans retain their existing schedule',()=>{
  const items=itemsFor('2026-10-23');
  assert(items.some(item=>item.id==='vr-wc'));
  assert(!items.some(item=>item.id.startsWith('za-')||item.id.startsWith('zo-')));
  const closing=plans.getWinkelWorkPlanDefinition('heyendaal','afsluitplan');
  assert(visible(closing,'2026-10-23').length>0);
  assert.equal(visible(closing,'2026-10-24').length,0);
  assert.equal(visible(closing,'2026-10-25').length,0);
});

test('Sunday FIFO separates returns, the approved Saturday-vlaai exception, freezing and Monday stock',()=>{
  const fifo=visible(definition,'2026-10-25').find(section=>section.id==='zondag-fifo');
  assert.equal(fifo.items.length,3);
  const returns=fifo.items.find(item=>item.id==='zo-fifo-retour');
  assert.match(returns.steps.join(' '),/Al het gebak van vrijdag of ouder gaat retour/);
  assert.match(returns.steps.join(' '),/Bossche bollen en tompoucen van zaterdag of ouder gaan retour/);
  assert.match(returns.steps.join(' '),/Alleen goed uitziende vlaaien mogen maandag/);
  assert.match(returns.warning,/na maandag retour.+vrijdag of ouder gaan altijd retour/);
  const freeze=fifo.items.find(item=>item.id==='zo-fifo-invriezen');
  assert.match(freeze.warning,/alleen.+zaterdag/);
  for(const name of ['Herfstparel','brownie tresor','hazelino','passiebombe','framboos slagroom','steventje','carrot rondo','red velvet punt','cheesecake punt'])assert(freeze.detail.includes(name),name);
  const monday=fifo.items.find(item=>item.id==='zo-fifo-maandag');
  assert.match(monday.steps.join(' '),/houdbaarheidsdatum tot maandag of later/);
  assert.match(monday.warning,/20%-.+50%-sticker/);
  assert(!visible(definition,'2026-10-24').some(section=>section.id==='zondag-fifo'));
});

const shared=load('app/winkel/schoonmaak-registratie/temperatureRegistrationShared.ts');
const inventory=load('app/winkel/schoonmaak-registratie/deviceInventory.ts',{'./temperatureRegistrationShared':shared});
const {normalize,isDefault}=load('app/winkel/schoonmaak-registratie/page.tsx',{'./temperatureRegistrationShared':shared},'exports.normalize=normalizeRegistrations; exports.isDefault=isDefaultTemperatureRow;');
test('new shop lists contain exactly the requested equipment and seasonal notes',()=>{
  const names={
    ziekerstraat:['Vriezer 1','Vriezer 2','Vriezer 3','Vriescel','Winkelvriezer','Gebakskoeling','Zelfbedienskoeling'],
    daalseweg:['Vriescel','Koelcel','IJsvriezer','Gebakskoeling','Koeling hartig','Winkelvriezer','Zelfbedieningskoeling'],
    lent:['Vriescel','Koelcel','IJsvriezer','Gebakskoeling','Winkelvriezer','Zelfbedieningskoeling'],
  };
  for(const [location,expected] of Object.entries(names)){
    const devices=inventory.configuredDevicesForDate(shared.temperatureRowsByWinkel[location],'2026-10-23',location);
    assert.equal(devices.map(device=>device.name).join('|'),expected.join('|'));
    assert.equal(new Set(devices.map(device=>device.id)).size,devices.length);
    if(location!=='ziekerstraat')assert.match(devices.find(device=>device.name==='IJsvriezer').department,/ijsseizoen/);
  }
  assert.equal(inventory.configuredDevicesForDate(shared.temperatureRowsByWinkel.heyendaal,'2026-10-23','heyendaal').length,7);
});
test('Lent historical readings keep original equipment, values and notes, including the retired workbench',()=>{
  const devices=inventory.configuredDevicesForDate(shared.temperatureRowsByWinkel.lent,'2026-10-22','lent');
  assert.equal(devices.length,7);
  assert.equal(devices[6].name,'koelwerkbank achter');
  const saved=devices.map((device,index)=>({id:device.id,naam:device.name,displayTemperatuur:String(index),handTemperatuur:String(index+1),note:'Bestaande notitie',actionTaken:'Gecontroleerd'}));
  const before=JSON.stringify(saved);
  const historic=normalize(saved,'lent',{lent:devices});
  assert.equal(historic.map(item=>item.naam).join('|'),devices.map(device=>device.name).join('|'));
  for(const item of historic){
    const original=saved.find(savedItem=>savedItem.id===item.id);
    assert.equal(item.handTemperatuur,original.handTemperatuur);
    assert.equal(item.displayTemperatuur,original.displayTemperatuur);
    assert.equal(item.note,original.note);
    assert.equal(item.actionTaken,original.actionTaken);
  }
  // Even a previously saved registration on the changeover date must never lose readings.
  const current=inventory.configuredDevicesForDate(shared.temperatureRowsByWinkel.lent,'2026-10-23','lent');
  const merged=normalize(saved,'lent',{lent:current});
  assert.equal(merged.length,7);
  for(const original of saved)assert.equal(merged.find(item=>item.id===original.id).handTemperatuur,original.handTemperatuur);
  assert.equal(JSON.stringify(saved),before);
  assert.equal(current.find(device=>device.name==='Koelcel').id,'lent-6');
  assert.equal(current.find(device=>device.name==='Winkelvriezer').id,'lent-1');
});
test('dated temperature equipment never changes an older device ID or creates new historical missing readings',()=>{
  const devices=[{name:'Oud meetpunt',activeUntil:'2026-10-23'},{name:'Nieuwe koeling',activeFrom:'2026-10-23'},'Blijvende vriezer'];
  const before=inventory.configuredDevicesForDate(devices,'2026-10-22','lent');
  const after=inventory.configuredDevicesForDate(devices,'2026-10-23','lent');
  assert.equal(before.map(item=>item.name).join('|'),'Oud meetpunt|Blijvende vriezer');
  assert.equal(after.map(item=>item.name).join('|'),'Nieuwe koeling|Blijvende vriezer');
  assert.equal(before[1].id,after[1].id);
  assert.equal(after[1].id,'lent-3');
});
test('managed bakery inventory changes keep working with dated default devices',()=>{
  const defaults=[{id:'a',name:'Koeling',deviceType:'koeling'},'Vriezer'];
  const changes=[{deviceId:'a',effectiveFrom:'2026-10-24',device:null},{deviceId:'extra',effectiveFrom:'2026-10-24',device:{name:'Extra vriezer',deviceType:'vriezer'}}];
  assert.equal(inventory.inventoryForDate(defaults,changes,'2026-10-23','bakkerij').map(item=>item.name).join('|'),'Koeling|Vriezer');
  assert.equal(inventory.inventoryForDate(defaults,changes,'2026-10-24','bakkerij').map(item=>item.name).join('|'),'Vriezer|Extra vriezer');
});

test('renaming an existing shop device does not turn it into a removable extra reading',()=>{
  const devices=inventory.configuredDevicesForDate(shared.temperatureRowsByWinkel.lent,'2026-10-23','lent');
  assert.equal(isDefault('lent',{id:'lent-5',naam:'Vriescel keuken'},{lent:devices}),true);
  assert.equal(isDefault('lent',{id:'extra-1',naam:'Extra koeling'},{lent:devices}),false);
});
