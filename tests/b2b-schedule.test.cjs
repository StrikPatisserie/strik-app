const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
function load(file){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,Date,Map,Set,Intl,require(name){if(name.startsWith('.')){const base=path.resolve(path.dirname(file),name);return load(['.ts','.tsx'].map(ext=>base+ext).find(fs.existsSync));}return require(name);}});return exports;}
const base='app/sinterklaas/letters/productie/';
const {combineProductionOrders}=load(base+'productionChecklist.ts');
const {projectB2BSchedules,prepareB2BSchedule,b2bScheduleVersion}=load(base+'b2bSchedule.ts');
const {productionChecklistView}=load(base+'productionSupplements.ts');
const clone=x=>JSON.parse(JSON.stringify(x));
const order=(x={})=>({id:'valkhof',year:'2099',season:'sint',customerName:'Valkhof Museum',status:'akkoord',department:'chocolade',deliveryDate:'2099-12-04',productionDate:'',logo:'',letterLines:[{id:'v',letter:'V',chocolate:'melk',size:'groot',style:'spuit',quantity:80,exceptions:[],withLogo:true}],...x});
const batches=()=>[{id:'old',startDate:'2099-11-16',date:'2099-11-17',pickupFrom:'2099-11-19',deadlineAt:'2000-11-15T19:00:00Z',status:'OPEN',minimumLeadDays:2,rows:[],storeOrders:[]},{id:'main',startDate:'2099-11-30',date:'2099-12-01',pickupFrom:'2099-12-03',deadlineAt:'2100-11-29T19:00:00Z',status:'OPEN',minimumLeadDays:2,rows:[],storeOrders:[]}];
const assignment=(id='valkhof',batch_id='old')=>({order_id:id,batch_id,season:2099,revision:1});
const demand=o=>combineProductionOrders(batches(),[],[o],[assignment(o.id)],[]).batches[0].rows;
const list=(x={})=>({batch_id:'old',rows:[],supplements:[],revision:5,plan_revision:1,locked_at:'2099-11-15T19:00:00Z',updated_at:'2099-11-24T08:00:00Z',...x});
const extra=(o,x={})=>({id:'extra',date:'2099-11-30',name:'Aanvulling',rows:demand(o),createdAt:'2099-11-24T08:00:00Z',createdBy:null,createdByName:'Test',planRevision:1,...x});
function projection(o,lists,assignments=[]){const current=combineProductionOrders(batches(),[],[o],assignments,lists);return projectB2BSchedules(current.b2bPlanning,current.batches,lists)[0];}
function prepare(o,lists,date,assignments=[]){return prepareB2BSchedule({order:o,batches:batches(),assignments,lists,date,now:'2099-11-24T08:00:00Z',id:'new-extra',actorId:null,actorName:'Test'});}

test('a transfer shows the real main date and remains editable when the historical source is frozen',()=>{
 const o=order(),lists=[list({supplements:[extra(o,{targetBatchId:'main'})]})];
 const p=projection(o,lists);assert.equal(p.batchId,'old');assert.equal(p.scheduledDate,'2099-11-30');assert.equal(p.canReplan,true);assert.equal(p.pendingQuantity,0);assert.equal(p.planningNote,'Nog te maken');
 const before=JSON.stringify(lists),moved=prepare(o,lists,'2099-11-25');
 assert.equal(JSON.stringify(lists),before);assert.equal(moved.batchId,'old');assert.equal(moved.lists[0].supplements.length,1);assert.equal(moved.lists[0].supplements[0].date,'2099-11-25');
 const p2=projection(o,moved.lists,[assignment()]);assert.equal(p2.scheduledDate,'2099-11-25');assert.equal(p2.pendingQuantity,0);
});
test('later removes a transferred customer only, then restores exactly once to a main or extra date',()=>{
 const o=order(),other=order({id:'other',customerName:'Other'});
 const transfer=extra(o,{targetBatchId:'main',rows:[...demand(o),...demand(other)]});
 const lists=[list({supplements:[transfer]})];
 const later=prepare(o,lists,null);assert.equal(later.batchId,null);
 assert.equal(later.lists[0].supplements[0].rows.flatMap(r=>r.recipients).length,1);assert.equal(later.lists[0].supplements[0].rows[0].recipients[0].id,'b2b:other');
 const p=projection(o,later.lists,[assignment('valkhof',null)]);assert.equal(p.pendingQuantity,80);assert.equal(p.productionDates.length,0);assert.equal(p.canReplan,true);
 const main=prepare(o,later.lists,'2099-11-30',[assignment('valkhof',null)]);assert.equal(main.batchId,'main');
 const current=combineProductionOrders(batches(),[],[o,other],[assignment('valkhof','main')],main.lists);
 assert.equal(current.batches[1].rows.reduce((n,r)=>n+r.orders,0),160);
 assert.equal(projectB2BSchedules(current.b2bPlanning,current.batches,main.lists).find(p=>p.id===o.id).scheduledDate,'2099-11-30');
});
test('package letters without a suitable main date can be scheduled together on an extra day, without repricing or duplicate demand',()=>{
 const o=order({id:'gea',customerName:'GEA',deliveryDate:'2099-12-01',letterLines:[],orderText:'PRODUCTEN EN PRIJS\n40 × Klein Sintpakket · Zonder amandel · letter G · chocolade melk · € 19,75 p.s. ex btw · € 790,00\n20 × Klein Sintpakket · Zonder amandel · letter G · chocolade puur · € 19,75 p.s. ex btw · € 395,00\n20 × Klein Sintpakket · Zonder amandel · letter G · chocolade wit · € 19,75 p.s. ex btw · € 395,00',totalExVat:'€ 1.580,00'});
 const before=JSON.stringify(o),p=projection(o,[list()]);assert.equal(p.pendingQuantity,80);assert.equal(p.productionDates.length,0);
 const result=prepare(o,[list()],'2099-11-25');assert.equal(JSON.stringify(o),before);
 const rows=result.lists[0].supplements[0].rows;assert.equal(rows.reduce((n,r)=>n+r.orders,0),80);assert.equal(rows.length,3);assert(rows.every(r=>r.recipients[0].combinationProduct));
 const current=combineProductionOrders(batches(),[],[o],[assignment('gea',result.batchId)],result.lists);
 assert.equal(productionChecklistView(result.lists[0],current.batches[0].rows).pendingOrderChanges.length,0);
 assert.equal(projectB2BSchedules(current.b2bPlanning,current.batches,result.lists)[0].scheduledDate,'2099-11-25');
});
test('reusing an extra day merges quantities once and keeps other customers and printed snapshots unchanged',()=>{
 const o=order(),other=order({id:'other'}),printed=extra(other,{id:'printed',date:'2099-11-21',lockedAt:'2099-11-20T09:00:00Z',rows:demand(other).map(r=>({...r,produced:r.orders}))});
 const lists=[list({supplements:[printed,extra(other,{id:'open',date:'2099-11-25'})]})];
 const result=prepare(o,lists,'2099-11-25',[assignment('valkhof',null)]);
 assert.deepEqual(clone(result.lists[0].supplements[0]),clone(printed));assert.equal(result.lists[0].supplements.length,2);assert.equal(result.lists[0].supplements[1].rows.reduce((n,r)=>n+r.orders,0),160);
});
test('made or printed letters cannot be moved or sent back to later, including an open main with partial production',()=>{
 const o=order();
 for(const lists of [
  [list({rows:demand(o)})],
  [list({supplements:[extra(o,{lockedAt:'2099-11-24T09:00:00Z'})]})],
  [list({supplements:[extra(o,{rows:demand(o).map(r=>({...r,produced:1}))})]})],
  [list({batch_id:'main',locked_at:null,rows:demand(o).map(r=>({...r,produced:1}))})],
 ]){const before=JSON.stringify(lists);assert.equal(projection(o,lists).canReplan,false);assert.throws(()=>prepare(o,lists,null),/geprint|gemaakt/);assert.equal(JSON.stringify(lists),before);}
});
test('new demand after a printed allocation stays pending and does not mislabel the old owner as its production day',()=>{
 const o=order(),lists=[list({supplements:[extra(o,{date:'2099-11-21',lockedAt:'2099-11-20T09:00:00Z'})]})];
 const increased=order({letterLines:order().letterLines.map(l=>({...l,quantity:85}))});
 const p=projection(increased,lists);assert.equal(p.scheduledDate,'2099-11-21');assert.equal(p.pendingQuantity,5);assert.equal(p.canReplan,false);
});
test('invalid dates, late dates, closed main and printed extra destinations are rejected; revisions change the read token',()=>{
 const o=order();for(const date of ['2099-02-30','2098-11-25','2099-11-23','2099-12-05'])assert.throws(()=>prepare(o,[list()],date),/datum|productiedag/);
 assert.equal(prepare(order({deliveryDate:'2099-12-01'}),[list()],'2099-11-30').batchId,'main','manual production uses the chosen day; the shop pickup window only guides automatic suggestions');
 assert.throws(()=>prepare(o,[list({supplements:[extra(order({id:'other'}),{date:'2099-11-25',lockedAt:'2099-11-24T09:00:00Z'})]})],'2099-11-25'),/geprint/);
 assert.notEqual(b2bScheduleVersion(batches(),[list()]),b2bScheduleVersion(batches(),[list({revision:6})]));
});
