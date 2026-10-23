// Read-only diagnosis. Prints schema and aggregate counts only: no identities, comments, wages, tokens or raw registrations.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const args=process.argv.slice(2),arg=(name,fallback)=>args.includes(name)?args[args.indexOf(name)+1]:fallback;
require('@next/env').loadEnvConfig(path.resolve(arg('--env-dir','.')));
const cache=new Map();
function load(file){
 file=path.resolve(file);if(cache.has(file))return cache.get(file);
 const exports={};cache.set(file,exports);
 const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(code,{exports,require:name=>name==='server-only'?{}:name.startsWith('.')?load(path.resolve(path.dirname(file),name)+'.ts'):require(name),URL,Date,Intl,Map,Set,AbortSignal,process,fetch});return exports;
}
(async()=>{
 const month=arg('--month','2026-10');
 const server=load('app/management/urencontrole/reviewServer.ts'),rules=load('app/management/urencontrole/reviewRules.ts');
 const data=await server.getTamigoHoursReviewMonth(month);
 const before=JSON.stringify(data.planned)+JSON.stringify(data.actual);
 const rows=rules.buildHoursReview(data);
 const issueCounts=items=>items.reduce((counts,row)=>{for(const issue of row.issues)counts[issue]=(counts[issue]||0)+1;return counts;},{});
 const report={plannedIssueCounts:issueCounts(data.planned),actualIssueCounts:issueCounts(data.actual),plannedStatusCodes:[...new Set(data.planned.map(row=>row.planStatusCode))],month,generatedAt:data.generatedAt,departments:data.departments.length,plannedUnique:data.planned.length,actualUnique:data.actual.length,reviewRows:rows.length,proposals:rows.filter(row=>row.proposal).length,actualMissingId:data.actual.filter(row=>!row.employeeId||row.id.startsWith('missing-id:')).length,duplicateDepartmentReferences:data.actual.filter(row=>row.sourceDepartments.length>1).length,originalsUnchanged:before===JSON.stringify(data.planned)+JSON.stringify(data.actual),statusCodes:[...new Set(data.actual.map(row=>row.planStatusCode))],flags:rows.reduce((total,row)=>{for(const flag of row.flags)total[flag.type]=(total[flag.type]||0)+1;return total;},{}),checks:data.checks.map(check=>({key:check.key.startsWith('shifts-')?'department-shifts':check.key,state:check.state,httpStatus:check.httpStatus,rows:check.rows,fields:check.fields})),originalNetConsistent:data.actual.filter(row=>row.start.ms!==null&&row.end.ms!==null&&row.breakMinutes!==null&&row.reportedNetMinutes!==null&&Math.abs((row.end.ms-row.start.ms)/60000-row.breakMinutes-row.reportedNetMinutes)<1).length};
 console.log(JSON.stringify(report,null,2));
 if(args.includes('--check-day-status')&&data.actual.some(row=>row.departmentId&&row.date)){
  const example=data.actual.find(row=>row.departmentId&&row.date);
  const status=await server.getTamigoHoursDayStatus(example.departmentId,example.date);
  console.log(JSON.stringify({dayStatus:status.state,message:status.message}));
 }
})().catch(()=>{console.error('De alleen-lezen urenproef is mislukt. Controleer de configuratie; er zijn geen registraties gewijzigd.');process.exitCode=1;});
