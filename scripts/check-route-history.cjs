const fs=require('node:fs'),vm=require('node:vm'),{createRequire}=require('node:module');
// Offline replay only: never reads credentials or writes live route plans.
// Usage: node scripts/check-route-history.cjs <history.json> <batches.json> [before-date]
// history.json: {observations: [...]}; batches.json: LogisticsBatch[]. Keep these private.
const root=process.env.ROUTE_REPLAY_ROOT||process.cwd(),req=createRequire(root+'/package.json'),ts=req('typescript');
function load(file,imports={},expose=''){
 const exports={};const code=ts.transpileModule(fs.readFileSync(root+'/'+file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 vm.runInNewContext(code+'\n'+expose,{exports,require:name=>name==='next/dynamic'?{default:()=>()=>null}:imports[name]||{},Date,Map,Set,URL,Intl});return exports;
}
const imports={};for(const name of ['roadRouting','routeHistory','specialSchoolDelivery','specialProCollegeDelivery','receiptDelivery']) imports['./'+name]=load('app/bakkerij/logistiek/'+name+'.ts');
const h=imports['./routeHistory'];
const d=load('app/bakkerij/logistiek/BakkerijLogistiekDashboard.tsx',imports,'exports.plan=buildRouteRounds;exports.profile=buildDayLoadProfile;exports.normalize=normalizeImportedReceipt;exports.assess=routeProposalAssessment;exports.receipts=buildReceiptSummaries;exports.day=dayPlanWithReceiptTotals;exports.reconcile=reconcileRouteDraftRounds;exports.serialize=serializeRouteRounds;exports.routeKey=routeLearningKeyForReceipt;');
module.exports={h,d};
if(require.main===module){
 const [historyPath,batchesPath,beforeDate=new Date().toISOString().slice(0,10)]=process.argv.slice(2);
 if(!historyPath||!batchesPath)throw Error('Supply private history and batch JSON paths. No live data is changed.');
 const data=JSON.parse(fs.readFileSync(historyPath));const batches=JSON.parse(fs.readFileSync(batchesPath));
 const reports=[];
 for(const obs of data.observations.slice().sort((a,b)=>a.date.localeCompare(b.date))){
  if(obs.date>=beforeDate)continue;
  const batch=batches.filter(b=>b.date===obs.date&&b.status==='definitief').sort((a,b)=>b.importedAt.localeCompare(a.importedAt))[0];if(!batch)continue;
  const day=d.day({...batch,isFuture:false},batch.receipts);const receipts=d.receipts(day,batch);const profile=d.profile(day,receipts,'');const history=h.compactRouteHistory(data.observations,obs.date);
  const baseline=d.plan(day,receipts,profile,null);const learned=d.plan(day,receipts,profile,{stops:[],pairs:[],history});const model=h.buildRouteHistoryModel(history,obs.date,[],profile);
  const baseScore=d.assess(baseline,model),learnedScore=d.assess(learned,model);
  const original=baseline.flatMap(r=>r.stops).map(s=>s.sourceId).sort(),updated=learned.flatMap(r=>r.stops).map(s=>s.sourceId).sort();if(JSON.stringify(original)!==JSON.stringify(updated))throw Error('lost/added stop '+obs.date);
  if([...learnedScore.late].some(([key,late])=>late>(baseScore.late.get(key)||0)))throw Error('deadline regression '+obs.date);
  const expected=obs.stops.filter(s=>s.kind==='receipt'&&s.key.startsWith('receipt:'));
  function assignments(routes){return new Map(routes.flatMap(r=>r.stops.filter(s=>s.learningKind==='receipt').map(s=>[s.learningKey,{bus:r.vehicle,round:h.historyRoundNumber(r.id,r.title)}])));}
  const a=assignments(baseline),b=assignments(learned);let comparable=0,base=0,improved=0;const differences=[];
  for(const stop of expected){const old=a.get(stop.key),now=b.get(stop.key);if(!old||!now)continue;comparable++;const expectedRound=h.historyRoundNumber(stop.routeId,stop.routeTitle);const was=old.bus===stop.vehicle&&old.round===expectedRound,becomes=now.bus===stop.vehicle&&now.round===expectedRound;base+=was;improved+=becomes;if(was!==becomes)differences.push({key:stop.key,old,now,expected:{bus:stop.vehicle,round:expectedRound},better:becomes});}
  reports.push({date:obs.date,comparable,expected:expected.length,base,improved,beforeMinutes:baseScore.minutes,afterMinutes:learnedScore.minutes,beforeLate:[...baseScore.late.values()].filter(Boolean).length,afterLate:[...learnedScore.late.values()].filter(Boolean).length,differences});
 }
 // This compares matched receipts, not missing custom stops/manager overrides.
 // All minutes are the existing planner's estimates, not observed driving times.
 const recentFrom=reports.at(-10)?.date||'';
 for(const range of ['all','recent']){const list=reports.filter(r=>range==='all'||r.date>=recentFrom);const sums=list.reduce((s,r)=>{for(const k of ['comparable','expected','base','improved','beforeLate','afterLate','beforeMinutes','afterMinutes'])s[k]=(s[k]||0)+r[k];return s;},{});console.log(range,list.length,sums);}
 console.log(reports.map(r=>({date:r.date,matched:r.comparable,base:r.base,improved:r.improved,minutes:r.afterMinutes-r.beforeMinutes})));
}
