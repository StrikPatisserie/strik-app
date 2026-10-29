const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const cache={};
function load(file){file=path.resolve(file);if(cache[file])return cache[file];const exports=cache[file]={};
 const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 const extra=file.endsWith('SinterklaasB2BClient.tsx')?'\nexports.formStateFromOrder=formStateFromOrder;':'';
 vm.runInNewContext(code+extra,{exports,console,URL,crypto:require('node:crypto').webcrypto,require(name){if(name.endsWith('.css'))return {default:{}};if(name==='next/link'||name==='next/image')return {default:'a'};if(name.startsWith('.')||name.startsWith('@/')){const base=name.startsWith('@/')?path.resolve(name.slice(2)):path.resolve(path.dirname(file),name);const target=['.ts','.tsx'].map(ext=>base+ext).find(fs.existsSync);if(target)return load(target);}return require(name);}});return exports;}
const groups=load('app/sinterklaas/b2b/groupedLetterOrders.ts');
const {stichting12qGroup,stichting12qImport}=load('app/sinterklaas/b2b/stichting12q.ts');
const {normalizeB2BOrder}=load('app/sinterklaas/sinterklaasApi.ts');
test('12Q has exactly the screenshot distribution including zero-letter DIKW and 332 without logo',()=>{
 const totals=groups.groupLetterTotals(stichting12qGroup);assert.deepEqual(JSON.parse(JSON.stringify(totals)),{melk:305,wit:145,puur:135,quantity:585,logos:253});
 assert.equal(totals.quantity*770+totals.logos*30,458040);assert.equal(stichting12qGroup.rows.length,10);
 assert.equal(stichting12qGroup.rows.find(row=>row.company==='DIKW').melk,0);
 const raw=stichting12qImport(),order=normalizeB2BOrder(raw);assert.equal(order.letterLines.length,6);assert(order.letterLines.every(line=>line.letter==='Q'&&line.style==='vorm'&&line.size==='groot'));
 assert.equal(order.totalExVat,'');assert.equal(order.deliveryWindowType,'week');assert.equal(order.deliveryWeek,'2026-W47');
 assert(groups.letterGroupMatchesOrder(groups.parseLetterGroup(order.letterOrderText),order));
});
test('group data survives storage, but changing a quantity, chocolate, or logo fails reconciliation',()=>{
 const order=normalizeB2BOrder(stichting12qImport()),group=groups.parseLetterGroup(order.letterOrderText);
 assert.equal(groups.serializeLetterGroup(group),order.letterOrderText);
 for(const change of [{quantity:999},{chocolate:'wit'},{withLogo:true},{letter:'S'}]){
  const copy=JSON.parse(JSON.stringify(order));Object.assign(copy.letterLines[0],change);assert.equal(groups.letterGroupMatchesOrder(group,copy),false);
 }
});
test('reopening 12Q retains Q and does not assign the S selling price or convert purchase costs into revenue',()=>{
 const {formStateFromOrder}=load('app/sinterklaas/b2b/SinterklaasB2BClient.tsx');
 const order=normalizeB2BOrder(stichting12qImport()),form=formStateFromOrder(order,'sint');
 assert(form.letterLines.every(line=>line.letter==='Q'));assert.equal(form.productLines.length,0);assert.equal(form.letterOrderText,order.letterOrderText);
});
test('priority is set when adding tasks and sub-tasks without modifying surrounding text',()=>{
 const m=load('app/persoonlijk/model.ts');let body=m.addTask('','Bel klant',undefined,m.TASK_FALLBACK_CATEGORY,'priority');assert.equal(m.taskLines(body)[0].priority,'priority');
 body=m.addTask(body,'Later nakijken',0,m.TASK_FALLBACK_CATEGORY,'later');assert.equal(m.taskLines(body)[1].priority,'later');assert.equal(m.taskLines(body)[0].text,'Bel klant');
});
test('shop note priority survives the existing WordPress text-only persistence and is not duplicated on repeat saves',()=>{
 const m=load('app/management/notities/notesApi.ts');const board={winkel:'lent',notes:[{id:'n1',text:'Belangrijk',createdAt:'2026-10-29',priority:true}],todos:[{id:'t1',text:'Bellen',createdAt:'2026-10-29',priority:true,done:false}]};
 for(let i=0;i<3;i++){const saved=m.serializeNotesBoard(board);for(const key of ['notes','todos'])for(const item of saved[key])delete item.priority;const read=m.normalizeNotesBoard(saved,'lent');assert.equal(read.notes[0].priority,true);assert.equal(read.notes[0].text,'Belangrijk');assert.equal(read.todos[0].priority,true);Object.assign(board,read);}
});
test('both folders are accessible for all four shop profiles without access to internal B2B administration',()=>{
 const m=load('app/lib/auth/access.ts');for(const store of ['lent','heyendaal','daalseweg','ziekerstraat']){const profile={active:true,role:'winkel',store,permissions:{}};assert(m.canAccessPath(profile,'/sint-voor-bedrijven'));assert(m.canAccessPath(profile,'/kerst-voor-bedrijven'));assert.equal(m.canAccessPath(profile,'/sinterklaas/b2b'),false);}
});
