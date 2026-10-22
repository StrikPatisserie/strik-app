const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ts=require('typescript');
const React=require('react');
function load(file,stubs={}){
 const exports={};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,require(name){
  if(name in stubs)return stubs[name];
  if(name.endsWith('.module.css'))return{default:new Proxy({},{get:(_,key)=>key})};
  if(name.startsWith('.'))return load(path.resolve(path.dirname(file),name+'.ts'),stubs);
  return require(name);
 },Response,Request,URL,Buffer,process});
 return exports;
}
const base='app/sinterklaas/letters/productie/';
const helper=load(base+'productionChecklist.ts');
const sources=load(base+'productionSources.ts');
const planning=load(base+'b2bProductionPlanning.ts');
const {ProductionDistributionSheet}=load(base+'ProductionDistributionPrint.tsx');
const batchId='d8c0af2e-a725-4ef0-a435-6b5f2838784a';
const laterId='c2c52413-9d60-4bf2-b6e8-dd4cba8fc8f9';
const batch=(more={})=>({id:batchId,startDate:'2026-11-02',date:'2026-11-03',pickupFrom:'2026-11-05',deadlineAt:'2026-11-01T19:00:00Z',status:'OPEN',minimumLeadDays:2,rows:[],storeOrders:[],...more});
const line=(more={})=>({letter:'S',chocolate:'melk',size:'groot',style:'spuit',quantity:5,exceptions:[],logo:false,notes:'',specialRequests:[],...more});
const b2b=(more={})=>({id:'wouwse',customerName:'Wouwse Plantage',status:'akkoord',department:'banket',deliveryDate:'2026-11-16',productionDate:'',logo:false,letterLines:[line({quantity:20})],...more});
const row=(more={})=>({key:'s|melk|groot|spuit',label:'S · melk · groot · spuit',orders:0,stock:0,produced:0,...more});
const plain=value=>JSON.parse(JSON.stringify(value));
function elements(node,predicate){if(Array.isArray(node))return node.flatMap(child=>elements(child,predicate));if(!React.isValidElement(node))return[];return[...(predicate(node)?[node]:[]),...elements(node.props.children,predicate)];}
function text(node){return Array.isArray(node)?node.map(text).join(''):React.isValidElement(node)?text(node.props.children):node==null?'':String(node);}

test('distribution follows four actual crates and keeps each order, shop and special letter visible without changing totals',()=>{
 const customer=(id,name,source,quantity)=>({id,code:`CL-${id}`,customerName:name,source,shop:'heyendaal',pickupDate:'2026-11-06',status:'besteld',notes:'Apart inpakken',lines:[line({quantity})]});
 const stock=row({stock:10,recipients:[{id:'stock:ziekerstraat',source:'voorraad',quantity:10,customerName:'Winkelvoorraad',shop:'ziekerstraat'}]});
 const result=helper.combineProductionOrders([batch({rows:[stock]})],[customer('jansen-1','Jansen','winkel',3),customer('jansen-2','Jansen','winkel',2),customer('derksen','Derksen','online',7)],[b2b(),b2b({id:'logo',customerName:'Met logo',logo:true,letterLines:[line({quantity:2,exceptions:['notenvrij']})]})]).batches[0];
 const before=JSON.stringify(result),sheet=ProductionDistributionSheet({batch:result});
 const crates=elements(sheet,n=>n.type==='section').map(n=>({name:n.props['aria-label'],content:text(n),quantities:elements(n,c=>c.props['data-distribution-quantity']).map(c=>c.props['data-distribution-quantity'])}));
 assert.deepEqual(crates.map(c=>c.name),['Winkelbestellingen','Winkelvoorraad','Online Lettershop','B2B-bestellingen']);
 assert.deepEqual(crates.map(c=>c.quantities),[[3,2],[10],[7],[20,2]]);
 assert.match(crates[0].content,/Jansen.*CL-jansen-1.*Apart inpakken.*Heyendaal.*Jansen.*CL-jansen-2/s);
 assert.match(crates[1].content,/Winkelvoorraad.*Ziekerstraat/);
 assert.match(crates[2].content,/Derksen.*CL-derksen/);
 assert.match(crates[3].content,/Wouwse Plantage/);assert.match(crates[3].content,/LET OP: logo · notenvrij.*Met logo/);
 assert.equal(crates.flatMap(c=>c.quantities).reduce((a,b)=>a+b,0),44);
 assert.equal(JSON.stringify(result),before);
});

test('incomplete or conflicting customer metadata is held for checking and never reassigned to another customer',()=>{
 const old=row({orders:10,orderSources:{online:10},recipients:[{id:'a',source:'online',quantity:7,customerName:'A'}]});
 const recipients=sources.productionRecipientsFor(old,'online');
 assert.equal(recipients[0].customerName,'A');assert.equal(recipients[1].quantity,3);assert.equal(recipients[1].unresolved,true);
 const conflict=sources.productionRecipientsFor({...old,recipients:[{...old.recipients[0],quantity:11}]},'online');
 assert.equal(conflict.length,1);assert.equal(conflict[0].quantity,10);assert.equal(conflict[0].unresolved,true);
 const sheet=ProductionDistributionSheet({batch:batch({rows:[old]})});
 assert.match(text(sheet),/EERST CONTROLEREN.*3 letters/s);
});

test('Sidcon combination items and pending quotes never become unplanned standalone chocolate letters',()=>{
 const result=helper.combineProductionOrders([batch()],[],[b2b({id:'sidcon',customerName:'Sidcon',letterLines:[],bakeryLines:[{product:'Speculaasbrok met letter',quantity:60}]}),b2b({id:'quote',status:'aanvraag'})]);
 assert.equal(result.unplanned.length,0);assert.equal(result.batches[0].rows.length,0);assert.equal(result.b2bPlanning.length,0);
 const mixed=helper.combineProductionOrders([batch()],[],[b2b({bakeryLines:[{product:'Speculaasbrok met letter',quantity:60}]})]);
 assert.equal(mixed.batches[0].rows[0].orders,20,'only explicit standalone letterLines count, never the 60 combination items');
});

test('explicit B2B assignments move standalone letters to one selected batch or deliberately leave them unplanned',()=>{
 const batches=[batch(),batch({id:laterId,startDate:'2026-11-09',date:'2026-11-10',pickupFrom:'2026-11-12'})];
 assert.equal(planning.b2bProductionPlan(b2b(),batches).batchId,laterId);
 const assignments=[{order_id:'wouwse',season:2026,batch_id:batchId,revision:1}];
 const result=helper.combineProductionOrders(batches,[],[b2b()],assignments);
 assert.equal(result.batches[0].rows[0].orders,20);assert.equal(result.batches[1].rows.length,0);assert.equal(result.b2bPlanning[0].manual,true);
 const unplanned=helper.combineProductionOrders(batches,[],[b2b()],[{...assignments[0],batch_id:null}]);
 assert.equal(unplanned.batches.every(b=>b.rows.length===0),true);assert.match(unplanned.unplanned[0],/Wouwse/);
});

test('frozen distributions detect a changed customer even at identical totals, while old snapshots can only be enriched at matching quantities',()=>{
 const recipient={id:'a',source:'online',quantity:5,customerName:'A'};
 const original=row({orders:5,orderSources:{online:5},recipients:[recipient]});
 const changed={...original,recipients:[{...recipient,id:'b',customerName:'B'}]};
 assert.equal(helper.productionChanges([original],[changed])[0].detail,'Verdeling per klant gewijzigd');
 assert.notEqual(helper.productionPlanVersion([original]),helper.productionPlanVersion([changed]));
 const old={...original,recipients:undefined};
 assert.equal(helper.hydrateProductionRecipients([old],[original])[0].recipients[0].customerName,'A');
 assert.equal(helper.hydrateProductionRecipients([old],[{...original,orders:6}])[0].recipients,undefined);
 assert.equal(helper.hydrateProductionRecipients([original],[changed])[0].recipients[0].customerName,'A');
});

function endpoint({allowed=true,order=b2b(),saveError=null,sourceFailure=false}={}){
 const writes=[];
 const batches=[batch()];
 const api=load('app/api/sinterklaas-letter-production/b2b-planning/route.ts',{
  '@/app/lib/auth/session':{getCurrentProfile:async()=>({id:'actor'})},
  '@/app/lib/auth/access':{canAccessSinterklaasPath:()=>allowed},
  '@/app/lib/supabase/admin':{createAdminClient:()=>({rpc:async(name,args)=>{writes.push({name,args});return{error:saveError};}})},
  '@/app/sinterklaas/letters/productie/productionData.server':{loadCentralProduction:async()=>{if(sourceFailure)throw Error('offline');return{batches,assignments:[]};}},
  '@/app/sinterklaas/sinterklaasServerApi':{loadProductionWordPressOrders:async()=>({b2b:[order]})},
  '@/app/sinterklaas/letters/productie/b2bProductionPlanning':planning,
 });
 const payload={season:'2026',orderId:order.id,batchId,revision:0,version:planning.b2bProductionPlan(order,batches).version};
 const request=(body=payload,origin='https://app.strik-patisserie.nl')=>new Request('https://app.strik-patisserie.nl/api/sinterklaas-letter-production/b2b-planning',{method:'POST',headers:{'content-type':'application/json',origin},body:JSON.stringify(body)});
 return{api,writes,payload,request};
}

test('only authorized same-origin staff can plan, and malformed requests never reach a write',async()=>{
 const denied=endpoint({allowed:false});assert.equal((await denied.api.POST(denied.request())).status,403);assert.equal(denied.writes.length,0);
 const f=endpoint();assert.equal((await f.api.POST(f.request(f.payload,'https://elsewhere.test'))).status,403);
 assert.equal((await f.api.POST(f.request({...f.payload,batchId:'invalid'}))).status,400);
 assert.equal((await f.api.POST(f.request({...f.payload,version:'x'.repeat(17000)}))).status,413);assert.equal(f.writes.length,0);
});

test('planning rejects changed orders, combination items, pending requests and rounds too late for delivery',async()=>{
 const stale=endpoint();assert.equal((await stale.api.POST(stale.request({...stale.payload,version:'old'}))).status,409);assert.equal(stale.writes.length,0);
 for(const order of [b2b({letterLines:[]}),b2b({status:'aanvraag'}),b2b({deliveryDate:'2026-11-01'})]){
  const f=endpoint({order});assert.equal((await f.api.POST(f.request())).status,409);assert.equal(f.writes.length,0);
 }
 const unavailable=endpoint({sourceFailure:true});assert.equal((await unavailable.api.POST(unavailable.request())).status,503);assert.equal(unavailable.writes.length,0);
});

test('successful planning changes only the central assignment with compare-and-swap; deadline rejection never reports success',async()=>{
 const f=endpoint();assert.equal((await f.api.POST(f.request())).status,200);
 assert.deepEqual(plain(f.writes),[{name:'letter_plan_b2b_order',args:{p_order_id:'wouwse',p_season:2026,p_batch_id:batchId,p_previous_batch_id:batchId,p_revision:0,p_actor_id:'actor'}}]);
 const locked=endpoint({saveError:{code:'P0001',message:'De deadline is voorbij.'}});const response=await locked.api.POST(locked.request());assert.equal(response.status,409);assert.match((await response.json()).message,/deadline/);
});

test('two identical lines of the same order become one customer allocation without merging different order numbers',()=>{
 const recipient={id:'same',source:'online',quantity:3,customerName:'Jansen',code:'CL1'};
 const actual=sources.productionRecipientsFor(row({orders:8,orderSources:{online:8},recipients:[recipient,{...recipient,quantity:2},{...recipient,id:'other',code:'CL2',quantity:3}]}),'online');
 assert.deepEqual(plain(actual.map(item=>[item.code,item.quantity])),[['CL1',5],['CL2',3]]);
});
