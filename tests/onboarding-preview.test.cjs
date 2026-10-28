const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const exportsModel={};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('app/preview/welkom-bij-strik/previewModel.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:exportsModel,Intl,Date});
const m=exportsModel;

test('evaluations use calendar months, including month ends, leap years and Dutch clock changes',()=>{
 for(const [start,months,expected] of [['2026-11-02',3,'2027-02-02'],['2026-01-31',1,'2026-02-28'],['2027-11-30',3,'2028-02-29'],['2026-08-01',3,'2026-11-01'],['2026-01-29',3,'2026-04-29']])assert.equal(m.addMonths(start,months),expected);
 assert.equal(m.addDays('2026-10-26',-3),'2026-10-23');
 assert.throws(()=>m.addMonths('2026-02-30',3),/datum/);
});
test('a future wage does not silently change the agreement at employment start',()=>{
 const person=m.initialColleagues()[0];person.checked=true;
 const original=m.contractDraft(person);
 person.wages.push({id:'future',effectiveFrom:'2027-01-01',amount:18,reason:'Fictieve toekomstige afspraak'});
 assert.equal(m.wageAt(person,'2026-11-02').amount,16.8);assert.equal(m.wageAt(person,'2027-01-01').amount,18);
 assert.equal(m.contractDraft(person).wage,16.8);assert.equal(original.wage,16.8);
});
test('a later approved entry for the same effective date takes precedence without erasing history',()=>{
 const person=m.initialColleagues()[0];person.wages.push({id:'updated',effectiveFrom:person.startDate,amount:17,reason:'Fictieve correctie'});
 assert.equal(m.wageAt(person,person.startDate).amount,17);assert.equal(person.wages.length,2);assert.equal(person.wages[0].amount,16.8);
});
test('a contract draft requires checked data and a wage effective at the start date',()=>{
 const person=m.initialColleagues()[0];assert.equal(m.contractDraft(person),null);
 person.checked=true;person.wages=[];assert.equal(m.contractDraft(person),null);
 person.wages=[{id:'late',effectiveFrom:'2027-01-01',amount:18,reason:'Later'}];assert.equal(m.contractDraft(person),null);
});
test('contract drafts are snapshots and changes to personal data do not rewrite an existing version',()=>{
 const person=m.initialColleagues()[0];person.checked=true;person.contract=m.contractDraft(person);
 person.profile.firstName='Ander voorbeeld';person.wages.push({id:'new',effectiveFrom:person.startDate,amount:18,reason:'Nieuwe afspraak'});
 assert.equal(person.contract.name,'Noor Jansen');assert.equal(person.contract.wage,16.8);
 const next=m.contractDraft(person);assert.equal(next.revision,2);assert.equal(next.wage,18);assert.equal(person.contract.revision,1);
});
test('employee signature leaves an explicit action for the employer',()=>{
 const person=m.initialColleagues()[1];person.contractState='employee-signed';
 assert.equal(m.statusLabel(person),'Strik nog ondertekenen');assert(m.reminders(person,m.INITIAL_POLICY).some(item=>item.id==='contract'));
 person.contractState='signed';assert(!m.reminders(person,m.INITIAL_POLICY).some(item=>item.id==='contract'));
});
test('evaluation reminders stop when a meeting is scheduled and disabled policy steps stay disabled',()=>{
 const person=m.initialColleagues()[2];assert.equal(m.reminders(person,m.INITIAL_POLICY).find(item=>item.id==='evaluatie').date,'2026-11-01');
 person.evaluation.date='2026-11-02';assert(!m.reminders(person,m.INITIAL_POLICY).some(item=>item.id==='evaluatie'));
 const policy={...m.INITIAL_POLICY,contract:false,evaluation:false,onboarding:false};assert.equal(m.reminders(person,policy).length,0);
});
test('the onboarding preview route is unavailable in production',()=>{
 const page={};let renderCount=0;
 const react={jsx:()=>{renderCount++;return {};}};
 const code=ts.transpileModule(fs.readFileSync('app/preview/welkom-bij-strik/page.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 vm.runInNewContext(code,{exports:page,process:{env:{NODE_ENV:'production'}},require:name=>name==='next/navigation'?{notFound:()=>{throw Error('not-found');}}:name==='react/jsx-runtime'?react:{default:()=>({})}});
 assert.throws(()=>page.default(),/not-found/);assert.equal(renderCount,0);assert.equal(page.metadata.robots.index,false);
});
test('payroll progress is separate from identity data and contract snapshots include no payroll identifiers',()=>{
 const person=m.initialColleagues()[0];person.checked=true;
 assert.deepEqual(Object.keys(person.profile).sort(),['address','city','email','firstName','lastName','phone','postalCode'].sort());
 assert.deepEqual(Object.keys(person.payroll).sort(),['accountantConfirmed','identityChecked']);
 const before=JSON.stringify(m.contractDraft(person));
 person.payroll.identityChecked=true;person.payroll.accountantConfirmed=true;
 // Even unexpected payroll fields in an incoming profile cannot leak into a contract snapshot.
 person.profile.bsn='TEST-NOT-A-BSN';person.profile.passport='TEST-DOCUMENT';person.profile.iban='TEST-NOT-AN-IBAN';
 assert.equal(JSON.stringify(m.contractDraft(person)),before);
 assert(!before.includes('TEST-'));
 assert.equal(m.initialColleagues()[1].payroll.identityChecked,false);
});
test('unconfirmed salary policy and draft FAQ answers stay hidden until explicitly released',()=>{
 const items=m.initialFaq();
 assert.equal(m.publishedAnswer(items.find(item=>item.id==='salaris')),'');
 assert.equal(m.publishedAnswer(items.find(item=>item.id==='loonstrook')),'');
 const draft={...items[0],answer:'  Fictieve betaaldag: de 25e  ',confirmed:false};
 assert.equal(m.publishedAnswer(draft),'');
 assert.equal(m.publishedAnswer({...draft,confirmed:true}),'Fictieve betaaldag: de 25e');
 assert.equal(m.publishedAnswer({...draft,answer:'  ',confirmed:true}),'');
 assert(items.filter(item=>m.publishedAnswer(item)).every(item=>item.confirmed));
});
