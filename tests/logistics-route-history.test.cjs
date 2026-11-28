const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function load(file,imports={},expose=''){
 const exports={};const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 vm.runInNewContext(code+'\n'+expose,{exports,require:name=>name==='next/dynamic'?{default:()=>()=>null}:imports[name]||{},Date,Map,Set,URL,Intl});return exports;
}
const h=load('app/bakkerij/logistiek/routeHistory.ts');
const imports={'./routeHistory':h};
for(const name of ['roadRouting','receiptDelivery','specialSchoolDelivery','specialProCollegeDelivery'])imports['./'+name]=load('app/bakkerij/logistiek/'+name+'.ts');
const d=load('app/bakkerij/logistiek/BakkerijLogistiekDashboard.tsx',imports,'exports.improve=applyRouteHistory;exports.assess=routeProposalAssessment;exports.timing=buildRouteTiming;exports.reconcile=reconcileRouteDraftRounds;exports.plan=buildRouteRounds;');
const plain=x=>JSON.parse(JSON.stringify(x));
const date='2026-11-26';
const key='receipt:customer:address 1 nijmegen';
const dates=['2026-11-16','2026-11-17','2026-11-18','2026-11-19','2026-11-20'];
const history=(bus='B',round=1,extra=[])=>dates.map(date=>({date,stops:[{key,bus,round,position:1,large:false},...extra]}));
const stop=(id=key,detail='Nijmegen')=>({id,sourceId:'receipt:'+id,learningKey:id,learningKind:'receipt',label:'Klant',detail,badges:[]});
const route=(bus,round,stops=[],departure)=>({id:`bus-${bus}-${round}`,title:`Ronde ${round}`,vehicle:`Bus ${bus}`,departure:departure||(round===1?'08:05':'na ronde 1'),stops,badge:'',tone:'',load:'',reason:''});
const profile={pressure:'laag',deliveryReceipts:1,deliveryStops:1,largeReceipts:0,pastryUnits:0,criticalReceipts:0};
const learning=history=>({history,stops:[],pairs:[]});

test('only earlier distinct reviewed days count; no same-day, future, weekend or duplicate votes',()=>{
 const observation=(date,id=key)=>({date,id:date,updatedAt:date,stops:[{key:id,vehicle:'Bus B',routeId:'bus-B-1',routeTitle:'Ronde 1',kind:'receipt',position:1,badges:[],label:'Klant',target:'Adres'}]});
 const compact=h.compactRouteHistory([observation(date),observation('2026-12-01'),observation('2026-11-25'),observation('2026-11-25'),observation('2026-11-21')],date);
 assert.equal(compact.length,2);
 const model=h.buildRouteHistoryModel(compact,date,[key],profile);
 assert.equal(model.days,1);assert.equal(model.choices.has(key),false);
});
test('recurring exact address can change buses; another address and ambiguous history do not inherit it',()=>{
 const model=h.buildRouteHistoryModel(history(),date,[key],profile);
 assert.equal(model.choices.get(key).bus,'B');
 assert.equal(model.choices.has('receipt:customer:address 2 nijmegen'),false);
 const ambiguous=history().map(day=>({...day,stops:[...day.stops,{...day.stops[0],bus:'A'}]}));
 assert.equal(h.buildRouteHistoryModel(ambiguous,date,[key],profile).choices.has(key),false);
 const initial=[route('A',1,[stop()]),route('A',2),route('B',1),route('B',2)];
 const improved=d.improve(initial,date,profile,learning(history()));
 assert.equal(improved.find(r=>r.id==='bus-B-1').stops[0]?.sourceId,stop().sourceId);
 assert.deepEqual(plain(improved.flatMap(r=>r.stops.map(s=>s.sourceId))),[stop().sourceId]);
});
test('current deadline blocks historical placement into a late second round',()=>{
 const initial=[route('A',1,[stop(key,'voor 09:00 · Nijmegen')]),route('A',2),route('B',1),route('B',2,[],'12:00')];
 const improved=d.improve(initial,date,profile,learning(history('B',2)));
 assert.equal(improved.find(r=>r.id==='bus-A-1').stops.length,1);
});
test('quantity pattern retains a second delivery round when today exceeds comparable first rounds',()=>{
 const initial=[route('A',1,[stop('receipt:other1:address'),stop('receipt:other2:address')]),route('A',2,[stop()]),route('B',1),route('B',2)];
 const improved=d.improve(initial,date,{...profile,deliveryReceipts:3},learning(history('A',1)));
 assert.equal(improved.find(r=>r.id==='bus-A-2').stops.length,1);
});
test('delivery windows preserve earliest and latest; a vanaf time is not a deadline',()=>{
 assert.deepEqual(plain(h.deliveryWindow('10:00–12:00')),{earliest:600,latest:720});
 assert.deepEqual(plain(h.deliveryWindow('vanaf 11:00')),{earliest:660});
 assert.deepEqual(plain(h.deliveryWindow('voor 09:30')),{latest:570});
 assert.deepEqual(plain(h.deliveryWindow('niet voor 11:00')),{earliest:660});
 const timing=d.timing(route('A',1,[stop(key,'10:00-12:00 · Nijmegen')]),485);
 assert(timing.stops[0].arrivalMinute>=600);
});
test('packaging-only rounds are distinct; collection cannot be learned before the shop delivery',()=>{
 const packaging={...stop('shop:lent:emballage'),sourceId:'shop:lent:emballage',learningKind:'shop',label:'Winkel Lent · emballage'};
 const delivery={...stop('shop:lent'),sourceId:'shop:lent',learningKind:'shop',label:'Winkel Lent'};
 assert.equal(h.isPackagingOnlyRound({stops:[packaging]}),true);
 assert.equal(h.isPackagingOnlyRound({stops:[packaging,stop()]}),false);
 assert.equal(h.isPackagingOnlyRound({stops:[]}),false);
 const days=history('A',1).map(day=>({...day,stops:[...day.stops,{key:packaging.learningKey,bus:'B',round:1,position:2,large:false}]}));
 const initial=[route('A',1,[delivery],'12:00'),route('A',2,[packaging]),route('B',1,[],'08:05'),route('B',2)];
 const improved=d.improve(initial,date,profile,learning(days));
 assert.equal(improved.find(r=>r.id==='bus-A-2').stops.length,1);
});
test('saved manual order, bus and excluded stops survive a changed history proposal',()=>{
 const initial=[route('A',1,[stop()]),route('A',2),route('B',1),route('B',2)];
 const automatic=d.improve(initial,date,profile,learning(history()));
 const restored=d.reconcile({date,routes:initial,excludedSourceIds:[]},automatic,profile);
 assert.equal(restored.find(r=>r.id==='bus-A-1').stops[0].sourceId,stop().sourceId);
 assert.equal(restored.flatMap(r=>r.stops).length,1);
});
test('Saturday rules do not get weekday history changes',()=>{
 const initial=[route('A',1,[stop()]),route('B',1)];
 assert.equal(d.improve(initial,'2026-11-28',profile,learning(history())),initial);
});

test('Saturday proposes 06:30 and the two shop rounds, also for a future day',()=>{
 for(const isFuture of [false,true]){
  const plan={date:'2026-12-05',isFuture,iceTubs:0,orderValue:0};
  const routes=d.plan(plan,[],profile,null);
  assert.equal(routes.find(r=>r.id==='bus-A-1-saturday').departure,isFuture?'advies 06:30':'06:30');
  assert.deepEqual(plain(routes.find(r=>r.id==='bus-A-1-saturday').stops.map(s=>s.sourceId)),['shop:heyendaalseweg','shop:daalseweg']);
  assert.deepEqual(plain(routes.find(r=>r.id==='bus-B-1-saturday').stops.map(s=>s.sourceId)),['shop:lent','shop:ziekerstraat']);
 }
});
test('Saturday learns a recurring customer bus from Saturdays, never from weekdays',()=>{
 const saturdayDates=['2026-11-07','2026-11-14','2026-11-21'];
 const days=saturdayDates.map(date=>({date,stops:[{key,bus:'B',round:2,position:1,large:false}]}));
 const initial=[route('A',1,[],'06:30'),route('A',2,[stop()]),route('B',1,[],'06:30'),route('B',2)];
 const result=d.improve(initial,'2026-11-28',profile,learning([...history('A',1),...days]));
 assert.equal(result.find(r=>r.id==='bus-B-2').stops[0]?.sourceId,stop().sourceId);
 assert.equal(h.buildRouteHistoryModel([...history('A',1),...days],'2026-11-28',[key],profile).days,3);
});
test('Saturday shop grouping can learn a different reviewed pattern',()=>{
 const days=['2026-11-07','2026-11-14','2026-11-21'].map(date=>({date,stops:[
  {key:'shop:daalseweg',bus:'B',round:1,position:1,large:false},
  {key:'shop:ziekerstraat',bus:'A',round:1,position:1,large:false},
 ]}));
 const result=d.plan({date:'2026-11-28',iceTubs:0},[],profile,learning(days));
 assert(result.find(r=>r.id==='bus-A-1-saturday').stops.some(s=>s.sourceId==='shop:ziekerstraat'));
 assert(result.find(r=>r.id==='bus-B-1-saturday').stops.some(s=>s.sourceId==='shop:daalseweg'));
});
test('same weekday counts more than equally recent other weekdays',()=>{
 const days=['2026-11-05','2026-11-12','2026-11-19'].map(date=>({date,stops:[{key,bus:'A',round:1,position:0,large:false}]}));
 for(const date of ['2026-11-06','2026-11-13','2026-11-20'])days.push({date,stops:[{key,bus:'B',round:1,position:0,large:false}]});
 assert.equal(h.buildRouteHistoryModel(days,'2026-11-26',[key],profile).choices.get(key)?.bus,'A');
});
test('older reviewed days within six months remain available; ice/manual rounds prevent a false single-round pattern',()=>{
 const observation={date:'2026-06-15',updatedAt:'2026-06-15',stops:[{key,vehicle:'Bus A',routeId:'bus-A-1',position:0,badges:[]},{key:'manual:extra delivery',vehicle:'Bus A',routeId:'bus-A-2',position:1,badges:[]}]};
 const compact=h.compactRouteHistory([observation],'2026-11-26');
 const model=h.buildRouteHistoryModel(compact,'2026-11-26',[key],profile);
 assert.equal(model.days,1);assert.equal(model.firstRound.A.singleShare,0);
});
test('comparable quantities and time-sensitive orders outweigh an unlike historical load',()=>{
 const light={...profile,deliveryReceipts:1,largeReceipts:0,pastryUnits:20,criticalReceipts:0};
 const heavy={...profile,deliveryReceipts:20,largeReceipts:10,pastryUnits:1500,criticalReceipts:10};
 const days=['2026-11-05','2026-11-12','2026-11-19'].flatMap(date=>[
  {date,load:heavy,stops:[{key,bus:'B',round:2,position:1,large:true}]},
  {date:date.replace(/05|12|19$/,m=>String(Number(m)+1).padStart(2,'0')),load:light,stops:[{key,bus:'A',round:1,position:1,large:false}]}
 ]);
 assert.equal(h.buildRouteHistoryModel(days,'2026-11-26',[key],heavy).choices.get(key)?.bus,'B');
 assert.equal(h.buildRouteHistoryModel(days,'2026-11-26',[key],light).choices.get(key)?.bus,'A');
});
test('saved Saturday departure, customer placement, and removed packaging survive new proposals',()=>{
 const initial=[route('A',1,[stop()],'vertrek 06:40'),route('A',2),route('B',1,[],'vertrek 06:20'),route('B',2)];
 const automatic=d.plan({date:'2026-11-28',iceTubs:0},[],profile,null);
 // Keep a currently imported receipt in the candidate set, but on the other bus.
 automatic.find(r=>r.vehicle==='Bus B'&&h.historyRoundNumber(r.id)===2).stops.push(stop());
 const saved={date:'2026-11-28',routes:initial,excludedSourceIds:['shop:lent:emballage']};
 const restored=d.reconcile(saved,automatic,profile);
 assert.equal(restored[0].departure,'vertrek 06:40');
 assert.equal(restored[0].stops[0].sourceId,stop().sourceId);
 assert(!restored.flatMap(r=>r.stops).some(s=>s.sourceId==='shop:lent:emballage'));
});
