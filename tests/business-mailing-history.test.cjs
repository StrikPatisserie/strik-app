const {test}=require('node:test'), assert=require('node:assert/strict'), fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function load(file,imports={}) { const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,Date,Map,Set,console,require:name=>{assert(name in imports,name);return imports[name];}});return exports; }
const history=load('app/sinterklaas/mailing/orderHistory.ts');
const eligibility=load('app/sinterklaas/mailing/reminderEligibility.ts',{'./orderHistory':history});
const order=(patch={})=>({id:'order1',year:'2026',season:'sint',status:'akkoord',customerName:'Example BV',customerEmail:'hello@example.test',contactName:'Sanne',...patch});
const customer={company:'Example B.V.',recipients:[{email:'HELLO@example.test'}]};
test('2027 shows distinct Sint/Kerst 2026 purchases, ignores inquiries/cancellations/future orders and deduplicates',()=>{
 const match=history.createOrderHistoryMatcher([order(),order(),order({id:'kerst',season:'kerst'}),order({year:'2025'}),order({year:'2024',status:'offerte'}),order({year:'2023',status:'aanvraag'}),order({year:'2022',status:'afgewezen'}),order({year:'2021',cancelled:true}),order({year:'2028'})],'2027');
 const entries=JSON.parse(JSON.stringify(match(customer)));
 assert.deepEqual(entries,[{year:'2026',season:'sint'},{year:'2026',season:'kerst'},{year:'2025',season:'sint'}]);
 assert(eligibility.contactMatchesFilter({...customer,orderHistory:entries},'previous-year','2027'));
 assert(!eligibility.contactMatchesFilter({...customer,orderHistory:entries},'previous-year','2028'));
 assert(!eligibility.reminderExcluded({...customer,orderHistory:entries}),'previous-year orders never suppress this year reminders');
});
test('historical company names match exactly, mixed seasons split, domains and similar companies do not match',()=>{
 const match=history.createOrderHistoryMatcher([order({customerEmail:'',season:'sint-kerst',status:undefined})],'2027');
 assert.equal(match(customer).length,2);
 assert.equal(match({company:'Example BV Department',recipients:[{email:'other@example.test'}]}).length,0);
 assert.equal(match({company:'',recipients:[{email:''}]}).length,0);
});
test('contact capture is idempotent and never changes an existing opt-out or send history',async()=>{
 const values=new Map();let writes=0;
 const db={from:()=>({upsert:async(rows,options)=>{assert.equal(options.ignoreDuplicates,true);for(const row of rows){if(!values.has(row.key)){values.set(row.key,row);writes++;}}return{error:null};}})};
 const contacts=load('app/lib/businessFolderContacts.ts',{'server-only':{},'node:crypto':require('node:crypto'),'./supabase/admin':{createAdminClient:()=>db},'../sinterklaas/mailing/orderHistory':history});
 const existing={id:'c',company:'Example BV',notes:'',recipients:[{id:'r',email:'hello@example.test',contactName:'Sanne',doNotEmail:true,sent:[{kind:'folder',sentAt:'2025'}]}]};
 await contacts.rememberB2BContacts([order(),order()], [existing]);
 assert.equal(writes,1);const snapshot=JSON.stringify([...values]);
 await contacts.rememberB2BContacts([order({contactName:'Changed'})],[{...existing,recipients:[{...existing.recipients[0],doNotEmail:false}]}]);
 assert.equal(JSON.stringify([...values]),snapshot);
 const saved=[...values.values()][0].value.recipient;
 assert.equal(saved.doNotEmail,true);assert.equal(saved.sent.length,0,'campaign history is not copied into a shared contact');
 assert.equal(existing.recipients[0].sent.length,1);
 await contacts.rememberB2BContacts([order({id:'new',customerEmail:'other@example.test'}),order({id:'invalid',customerEmail:'not an email'})]);
 assert.equal(writes,2);assert.equal([...values.values()][1].value.recipient.doNotEmail,false,'new manual B2B contacts join the requested mailing list');
 await contacts.rememberB2BContacts([order({id:'folder',customerEmail:'folder@example.test',folderQuote:{snapshot:{consent:false}}})]);
 assert.equal([...values.values()][2].value.recipient.doNotEmail,true,'folder inquiry without subscription remains blocked');
});
