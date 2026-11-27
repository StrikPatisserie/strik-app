const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const React=require('react');
function load(file,overrides={}){
 const exports={};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,Date,Map,Set,Intl,require(name){
  if(name in overrides)return overrides[name];
  if(name.endsWith('.css'))return{default:new Proxy({},{get:(_,k)=>k})};
  if(name.startsWith('.')){const base=path.resolve(path.dirname(file),name);return load(['.ts','.tsx'].map(ext=>base+ext).find(fs.existsSync),overrides);}
  return require(name);
 }});return exports;
}
const combinations=load('app/sinterklaas/b2bCombinationLetters.ts');
const helper=load('app/sinterklaas/letters/productie/productionChecklist.ts');
const planning=load('app/sinterklaas/letters/productie/b2bProductionPlanning.ts');
const sources=load('app/sinterklaas/letters/productie/productionSources.ts');
const readiness=load('app/sinterklaas/letters/productie/productionReadiness.ts');
const opteller=load('app/sinterklaas/b2b/productionTotals.ts');
const {ProductionDistributionSheet}=load('app/sinterklaas/letters/productie/ProductionDistributionPrint.tsx');
const base='Speculaasbrok met letter · Speculaasbrok zonder amandel · kleine spuitletter · letter M';
const order=(more={})=>({id:'package-a',year:'2026',season:'sint',status:'akkoord',customerName:'Voorbeeld BV',department:'beide',letterLines:[],logo:'',deliveryDate:'2026-11-24',deliveryWindowType:'date',productionDate:'',orderText:`PRODUCTEN EN PRIJS\n30 × ${base} · chocolade wit · € 10,00 p.s. ex btw · € 300,00`,...more});
const batch=()=>({id:'round',date:'2026-11-17',startDate:'2026-11-16',pickupFrom:'2026-11-19',minimumLeadDays:2,status:'OPEN',rows:[]});
function text(node){return Array.isArray(node)?node.map(text).join(''):React.isValidElement(node)?text(node.props.children):node==null?'':String(node);}

test('package letters follow explicit letter, size, chocolate and logo; almond pastries are not chocolate letters',()=>{
 const original=order(),before=JSON.stringify(original),result=combinations.b2bProductionLetters(original);
 assert.equal(result.lines.length,1);assert.equal(result.lines[0].letter,'M');assert.equal(result.lines[0].size,'klein');assert.equal(result.lines[0].chocolate,'wit');assert.equal(result.lines[0].quantity,30);assert.equal(result.lines[0].withLogo,false);assert.match(result.lines[0].combinationProduct,/Speculaasbrok zonder amandel/);
 const logo=combinations.b2bProductionLetters(order({orderText:original.orderText.replace('kleine','grote').replace('chocolade wit','chocolade puur · eigen logo')})).lines[0];
 assert.equal(logo.withLogo,true);assert.equal(logo.size,'groot');assert.equal(logo.chocolate,'puur');assert.equal(JSON.stringify(original),before);
 assert.equal(combinations.b2bProductionLetters(order({orderText:'PRODUCTEN EN PRIJS\n105 × Amandelletter & gevulde staven · Amandelletter · standaard S / andere letter op aanvraag · € 10,00 p.s. ex btw · € 1050,00'})).requiredQuantity,0);
});
test('legacy packages without a flavor require review and never silently become milk letters',()=>{
 const unknown=order({orderText:order().orderText.replace(' · chocolade wit','')});
 const data=combinations.b2bProductionLetters(unknown);assert.equal(data.lines.length,0);assert.equal(data.requiredQuantity,30);assert.match(data.issues[0].message,/chocoladesmaak/);
 const result=helper.combineProductionOrders([batch()],[],[unknown]);assert.equal(result.batches[0].rows.length,0);assert.match(result.unplanned[0],/combinatieletters controleren/);assert.equal(result.b2bPlanning[0].quantity,30);assert.equal(result.b2bPlanning[0].issues.length,1);
 assert.equal(helper.combineProductionOrders([batch()],[],[order({status:'offerte'})]).b2bPlanning.length,0);
});
test('a small Sintpakket requires both letter and flavor, and then contributes one small letter per package',()=>{
 const small=order({orderText:'PRODUCTEN EN PRIJS\n12 × Klein Sintpakket · Met amandel · letter A · chocolade melk · € 14,00 p.s. ex btw · € 168,00'});
 const data=combinations.b2bProductionLetters(small);assert.equal(data.lines[0].quantity,12);assert.equal(data.lines[0].letter,'A');assert.equal(data.lines[0].size,'klein');assert.equal(data.lines[0].chocolate,'melk');
 const missing=combinations.b2bProductionLetters({...small,orderText:small.orderText.replace(' · letter A','')});assert.equal(missing.lines.length,0);assert.match(missing.issues[0].message,/letter/);
});
test('standalone and package letters share a production batch, while package destinations remain distinct on the cutouts',()=>{
 const original=order({letterLines:[{id:'loose',letter:'M',chocolate:'wit',style:'spuit',size:'klein',quantity:5,withLogo:false,exceptions:[]}]});
 const result=helper.combineProductionOrders([batch()],[],[original]);
 assert.equal(result.batches[0].rows.length,1);const row=result.batches[0].rows[0];assert.equal(row.orders,35);assert.equal(row.orderSources.b2b,35);
 const destinations=sources.productionRecipientsFor(row,'b2b');assert.equal(destinations.length,2);assert.equal(destinations.filter(item=>item.combinationProduct)[0].quantity,30);
 const sheet=text(ProductionDistributionSheet({batch:result.batches[0]}));assert.match(sheet,/COMBINATIE: Speculaasbrok zonder amandel \+ letter/);assert.match(sheet,/Voorbeeld BV/);assert.equal(original.productionDone,undefined);
 assert.equal(result.b2bPlanning[0].quantity,35);assert.equal(result.b2bPlanning[0].combinationQuantity,30);
});
test('an explicit assignment moves all of the order letters once, and completed orders do not re-enter planning',()=>{
 const first=batch(),second={...batch(),id:'later',date:'2026-11-20',startDate:'2026-11-19'};
 const result=helper.combineProductionOrders([first,second],[],[order()],[{order_id:'package-a',season:2026,batch_id:'round',revision:1}]);
 assert.equal(result.batches[0].rows[0].orders,30);assert.equal(result.batches[1].rows.length,0);
 for(const flags of [{letterProductionDone:true},{packed:true},{delivered:true},{cancelled:true}])assert.equal(helper.combineProductionOrders([batch()],[],[order(flags)]).b2bPlanning.length,0);
 const changed=order({orderText:order().orderText.replace('chocolade wit','chocolade puur')});assert.notEqual(planning.b2bProductionPlan(order(),[batch()]).version,planning.b2bProductionPlan(changed,[batch()]).version);
});
test('letter completion remains separate from the rest of a package, and incomplete package choices block a false ready signal',()=>{
 const original=order(),rows=helper.combineProductionOrders([batch()],[],[original]).batches[0].rows;
 const readyRows=rows.map(row=>({...row,produced:row.orders}));
 assert(readiness.readyProductionRecipients([{id:'round',rows}],[{batch_id:'round',rows:readyRows}],{'b2b:package-a':30}).has('b2b:package-a'));
 assert(!readiness.readyProductionRecipients([{id:'round',rows}],[{batch_id:'round',rows:readyRows}],{'b2b:package-a':40}).has('b2b:package-a'));
 assert.equal(original.productionDone,undefined);assert.equal(original.packed,undefined);assert.equal(original.delivered,undefined);
 const changed=helper.combineProductionOrders([batch()],[],[order({orderText:order().orderText.replace('zonder amandel','met amandel')})]).batches[0].rows;
 assert(helper.productionChanges(rows,changed).some(change=>/klant/.test(change.detail)));
});
test('the brok counter still bundles the physical brokken across letter flavors and sizes',()=>{
 const a=order(),b=order({id:'b',orderText:order().orderText.replace('chocolade wit','chocolade melk').replace('kleine','grote')});
 const data=opteller.buildProductionTotals([a,b],'sint','2026');assert.equal(data.products.length,1);assert.equal(data.products[0].quantity,60);assert.equal(data.products[0].product,'Speculaasbrok · zonder amandel');
});


test('package-only and mixed orders enter the extra-letter queue and leave it once their extra day is scheduled',()=>{
 const supplements=load('app/sinterklaas/letters/productie/productionSupplements.ts');
 const mixed=order({deliveryDate:'2026-11-27',letterLines:[{id:'loose',letter:'M',chocolate:'wit',style:'spuit',size:'klein',quantity:5,withLogo:false,exceptions:[]}]});
 const small=order({id:'package-small',customerName:'Tweede bedrijf',deliveryDate:'2026-11-27',orderText:'PRODUCTEN EN PRIJS\n12 × Klein Sintpakket · Met amandel · letter A · chocolade melk · € 14,00 p.s. ex btw · € 168,00'});
 const original={batch_id:batch().id,rows:[],supplements:[],revision:1,plan_revision:1,locked_at:'2026-11-15T19:00:00Z',updated_at:'2026-11-15T19:00:00Z'};
 const current=helper.combineProductionOrders([batch()],[],[mixed,small],[],[original]);
 const view=supplements.productionChecklistView(original,current.batches[0].rows);
 assert.equal(view.pendingOrderChanges.length,2);
 assert.equal(view.pendingOrderChanges.find(g=>g.customerName===mixed.customerName).extra,35);
 assert.equal(view.pendingOrderChanges.find(g=>g.customerName===small.customerName).extra,12);
 assert.equal(view.pendingOrderChanges.flatMap(g=>g.items).filter(i=>i.recipient.combinationProduct).reduce((n,i)=>n+i.after,0),42);
 const extra=supplements.createProductionSupplement(original.rows,[],current.batches[0].rows,view.pendingOrderChanges.map(g=>g.id),{id:'new-extra',date:'2026-11-25',createdAt:'2026-11-24T08:00:00Z',createdBy:null,createdByName:'Test'});
 assert.equal(helper.productionTotals(extra.rows).orders,47);
 assert.equal(extra.rows.flatMap(r=>r.recipients).filter(p=>p.combinationProduct).reduce((n,p)=>n+p.quantity,0),42);
 assert.equal(supplements.productionChecklistView({...original,supplements:[extra]},current.batches[0].rows).pendingOrderChanges.length,0);
 const printed={...extra,lockedAt:'2026-11-24T09:00:00Z'};
 const increased={...mixed,orderText:mixed.orderText.replace('30 ×','32 ×')};
 const changed=helper.combineProductionOrders([batch()],[],[increased,small],[],[{...original,supplements:[printed]}]);
 const pending=supplements.productionChecklistView({...original,supplements:[printed]},changed.batches[0].rows).pendingOrderChanges;
 assert.equal(pending.length,1);assert.equal(pending[0].extra,2);
 assert.equal(pending[0].items.length,1);assert.match(pending[0].items[0].recipient.combinationProduct,/Speculaasbrok/);
 const target={...batch(),id:'open-main',startDate:'2026-11-25',date:'2026-11-26',pickupFrom:'2026-11-28'};
 const transfer={...extra,targetBatchId:target.id};
 const assigned=helper.combineProductionOrders([batch(),target],[],[mixed,small],[],[{...original,supplements:[transfer]}]);
 assert.equal(helper.productionTotals(assigned.batches[0].rows).orders,0);
 assert.equal(helper.productionTotals(assigned.batches[1].rows).orders,47);
 assert.equal(supplements.productionChecklistView({...original,supplements:[transfer]},assigned.batches[0].rows).pendingOrderChanges.length,0);
 const sheet=text(ProductionDistributionSheet({batch:assigned.batches[1]}));
 assert.match(sheet,/COMBINATIE: Speculaasbrok/);assert.match(sheet,/COMBINATIE: Klein Sintpakket/);
});

test('Stafwerk includes one distinct piped staff per package, never a second sale or the marzipan logo',()=>{
 const o=order({logo:'Logo op het marsepeinen stafje',orderText:'PRODUCTEN EN PRIJS\n10 × Stafwerk pakket · logo op het marsepeinen stafje · eigen logo · € 17,41 p.s. ex btw · € 174,10'});
 const before=JSON.stringify(o),data=combinations.b2bProductionLetters(o);
 assert.equal(data.requiredQuantity,10);assert.equal(data.packageQuantity,10);assert.equal(data.issues.length,0);
 assert.equal(data.lines.length,1);assert.equal(data.lines[0].style,'staf');assert.equal(data.lines[0].chocolate,'roomchocolade');assert.equal(data.lines[0].withLogo,false);
 assert.equal(JSON.stringify(o),before);
 const result=helper.combineProductionOrders([batch()],[],[o]);
 assert.equal(result.b2bPlanning[0].staffQuantity,10);assert.match(result.b2bPlanning[0].letters,/10× chocoladestafje/);
 const sections=load('app/sinterklaas/letters/productie/productionPresentation.ts').productionSections(result.batches[0].rows);
 assert.equal(sections[0].label,'Chocoladestafjes · Stafwerk');assert.match(sections[0].groups[0].label,/spuiten/);
 const sheet=text(ProductionDistributionSheet({batch:result.batches[0]}));assert.match(sheet,/Stafwerk pakket/);assert.match(sheet,/Chocoladestaf/);
 for(const description of ['Stafwerk pakket','Stafwerk pakket · Standaard','Stafwerk']) {
  assert.equal(combinations.b2bProductionLetters(order({orderText:`10x ${description}`})).requiredQuantity,10);
 }
 assert.equal(combinations.b2bProductionLetters(order({orderText:'10x Staaf Stoomboot'})).requiredQuantity,0);
});
test('fulfilled Stafwerk without a production history does not create retrospective demand; registered staffs retain their history',()=>{
 const o=order({orderText:'10 × Stafwerk pakket'});
 for(const flags of [{packed:true},{delivered:true},{letterProductionDone:true},{cancelled:true}]) {
  const result=helper.combineProductionOrders([batch()],[],[order({...o,...flags})]);
  assert.equal(result.b2bPlanning.length,0);assert.equal(result.batches[0].rows.length,0);
 }
 const rows=helper.combineProductionOrders([batch()],[],[o]).batches[0].rows;
 const result=helper.combineProductionOrders([batch()],[],[{...o,delivered:true}],[],[{batch_id:batch().id,locked_at:null,rows,supplements:[]}]);
 assert.equal(result.b2bPlanning.length,0);assert.equal(result.batches[0].rows[0].orders,10);
});

test('chocolate wreaths join the requested piping day with their own weight and keep almond wreaths out',()=>{
 const original=order({id:'wreaths',season:'kerst',department:'bakkerij',deliveryDate:'2026-12-03',productionDate:'2026-11-30',orderText:'PRODUCTEN EN PRIJS\n125 × Chocolade kerstkrans · 300 gram per stuk · € 15,22 p.s. ex btw · € 1.902,50\nOVERIGE ORDERAFSPRAKEN\nLevering 3 december.'});
 const before=JSON.stringify(original),round={...batch(),id:'nov30',date:'2026-11-30',startDate:'2026-11-30',pickupFrom:'2026-12-03'};
 const data=combinations.b2bProductionLetters(original);
 assert.equal(data.requiredQuantity,125);assert.equal(data.packageQuantity,0);assert.equal(data.wreathQuantity,125);assert.equal(data.lines[0].size,'300 gram');assert.equal(data.lines[0].chocolate,'smaak nog bepalen');
 const result=helper.combineProductionOrders([batch(),round],[],[original]);
 assert.equal(result.batches[0].rows.length,0);assert.equal(result.batches[1].rows[0].orders,125);assert.equal(result.batches[1].rows[0].recipients[0].date,'2026-12-03');assert.equal(result.b2bPlanning[0].batchId,'nov30');assert.equal(result.b2bPlanning[0].wreathQuantity,125);
 const presentation=load('app/sinterklaas/letters/productie/productionPresentation.ts');assert.equal(presentation.productionSections(result.batches[1].rows)[0].label,'Chocolade kerstkransen');
 const sheet=text(ProductionDistributionSheet({batch:result.batches[1]}));assert.match(sheet,/Chocolade kerstkrans/);assert.match(sheet,/300 gram/);assert.match(sheet,/125/);
 assert.equal(combinations.b2bProductionLetters({...original,orderText:'160 × Kerstkrans · Gevuld met amandelspijs · € 11,70 p.s. ex btw · € 1.872,00'}).requiredQuantity,0);
 for(const flags of [{packed:true},{delivered:true},{letterProductionDone:true}])assert.equal(helper.combineProductionOrders([round],[],[{...original,...flags}]).batches[0].rows.length,0);
 const specified={...original,orderText:original.orderText.replace('300 gram per stuk','300 gram per stuk · chocolade puur')};assert.equal(combinations.b2bProductionLetters(specified).lines[0].chocolate,'puur');assert.notEqual(planning.b2bProductionPlan(original,[round]).version,planning.b2bProductionPlan(specified,[round]).version);assert.equal(JSON.stringify(original),before);
});
