const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function load(file,imports={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:name=>{assert(name in imports,`Unexpected import: ${name}`);return imports[name];},Response,Request,URL,Date,Set,Map,crypto:require('node:crypto').webcrypto});return exports;}
const model=load('app/persoonlijk/model.ts'),access=load('app/lib/auth/access.ts');
const owner='00000000-0000-4000-8000-000000000001',noteId='00000000-0000-4000-8000-000000000002',other='00000000-0000-4000-8000-000000000003';
function input(changes={}){return{id:noteId,title:'Mijn notitie',notebook:'Strik',body:'[ ] Controleren\n[x] Afgerond\nGewone tekst',tags:[],pinned:false,archived:false,attachments:[],source_hash:null,source_created_at:null,source_updated_at:null,...changes};}
const profile={id:owner,role:'manager',active:true,permissions:{},personal_workspace:true};
function context(data,error=null){const calls=[],query={};for(const method of ['select','eq','ilike','gt','order','range','insert','update'])query[method]=(...args)=>{calls.push([method,...args]);return query;};query.maybeSingle=query.single=async()=>({data,error});query.then=(resolve,reject)=>Promise.resolve({data,error,count:1}).then(resolve,reject);return{calls,value:{profile,db:{from:table=>{calls.push(['table',table]);return query;},rpc:async name=>({data:[{notebook:'Strik'}],error:null})}}};}
function routes(ctx){return load('app/api/persoonlijk/route.ts',{'../../persoonlijk/access.server':{personalContext:async()=>ctx,personalHeaders:{'Cache-Control':'private, no-store'}},'../../persoonlijk/model':model});}
function request(method,body,origin='https://app.example.invalid'){return new Request('https://app.example.invalid/api/persoonlijk',{method,headers:{'Content-Type':'application/json',Origin:origin},body:JSON.stringify(body)});}
test('personal access requires explicit database enrolment; other managers, permissions and inactive users do not qualify',()=>{
 for(const role of ['admin','manager','management']){const user={...profile,role,personal_workspace:false,permissions:{'personal_workspace':true,'app.all':true}};assert.equal(access.canAccessPersonalNotes(user),false);assert.equal(access.canAccessPath(user,'/persoonlijk'),false);assert.equal(access.canAccessPath(user,'/persoonlijk/notitie'),false);}
 assert.equal(access.canAccessPath(profile,'/persoonlijk'),true);assert.equal(access.canAccessPersonalNotes({...profile,active:false}),false);assert.equal(access.canAccessPersonalNotes({...profile,role:'winkel'}),false);
});
test('checklists retain every line and toggle only the selected task, including completed Evernote checks',()=>{
 const body='Kopje\n[ ] Eén\n- [x] Twee\nGeen taak\n[x] Drie';assert.equal(model.taskLines(body).length,3);assert.equal(model.toggleTask(body,2),'Kopje\n[ ] Eén\n- [ ] Twee\nGeen taak\n[x] Drie');assert.throws(()=>model.toggleTask(body,3));
});
test('note input whitelists fields and cannot reference another user’s files or path traversal',()=>{
 const clean=model.personalInput(input({owner_id:other,personal_workspace:true,revision:999}),owner);assert(!('owner_id'in clean));assert(!('revision'in clean));assert(!('personal_workspace'in clean));
 for(const path of [`${other}/test`,`${owner}/../${other}/test`,`${owner}/test%2f..`,`${owner}/bad\npath`])assert.throws(()=>model.personalInput(input({attachments:[{path,name:'Bestand',size:1,type:'application/pdf'}]}),owner));
 assert.equal(model.personalInput(input({attachments:[{path:`${owner}/_imports/abc.enex`,name:'Bronexport.enex',size:2,type:'application/xml'}]}),owner).attachments.length,1);
 for(const changes of [{body:'x'.repeat(500001)},{source_hash:'wrong'},{source_created_at:'geen datum'},{tags:['x'.repeat(201)]}])assert.throws(()=>model.personalInput(input(changes),owner));
});
test('all note handlers deny unauthorised sessions before accessing storage',async()=>{
 for(const method of ['GET','POST','PUT']){const response=await routes({error:Response.json({message:'Geen toegang'},{status:403})})[method](method==='GET'?new Request('https://app.example.invalid/api/persoonlijk'):request(method,input()));assert.equal(response.status,403);}
});
test('note reads scope the authenticated owner independently of supplied account IDs and do not cache private data',async()=>{
 const ctx=context(input());const response=await routes(ctx.value).GET(new Request(`https://app.example.invalid/api/persoonlijk?id=${noteId}&owner_id=${other}`));assert.equal(response.status,200);assert(ctx.calls.some(c=>c[0]==='eq'&&c[1]==='owner_id'&&c[2]===owner));assert.equal(response.headers.get('Cache-Control'),'private, no-store');
});
test('list/search keeps the owner constraint and returns excerpts rather than full note bodies',async()=>{
 const ctx=context([input()]),response=await routes(ctx.value).GET(new Request('https://app.example.invalid/api/persoonlijk?view=tasks&search=100%25'));const data=await response.json();assert(!('body'in data.notes[0]));assert.equal(data.notes[0].tasks.length,2);assert(ctx.calls.some(c=>c[0]==='ilike'&&c[1]==='search_text'&&c[2]==='%100\\%%'));assert(ctx.calls.some(c=>c[0]==='eq'&&c[1]==='owner_id'&&c[2]===owner));
});
test('writes reject cross-site requests, ignore supplied ownership and preserve a conflicting draft',async()=>{
 let ctx=context(input());assert.equal((await routes(ctx.value).POST(request('POST',input(),'https://other.example.invalid'))).status,403);assert(!ctx.calls.length);
 ctx=context(input());assert.equal((await routes(ctx.value).POST(request('POST',input({owner_id:other})))).status,200);const inserted=ctx.calls.find(c=>c[0]==='insert')[1];assert.equal(inserted.owner_id,owner);assert.equal(inserted.open_tasks,1);
 ctx=context(null);const response=await routes(ctx.value).PUT(request('PUT',input({revision:7})));assert.equal(response.status,409);assert(ctx.calls.some(c=>c[0]==='eq'&&c[1]==='revision'&&c[2]===7));
});
test('reimporting an existing Evernote note returns that note and never overwrites manual edits',async()=>{
 const existing=input({title:'Later handmatig gewijzigd',source_hash:'a'.repeat(64)}),ctx=context(existing,{code:'23505'});ctx.value.db.from=()=>{const q={select:()=>q,eq:()=>q,insert:()=>{ctx.calls.push(['insert']);return q;},single:async()=>({error:{code:'23505'}}),maybeSingle:async()=>({data:existing})};return q;};
 const response=await routes(ctx.value).POST(request('POST',input({source_hash:'a'.repeat(64)})));assert.equal(response.status,200);const data=await response.json();assert(data.duplicate);assert.equal(data.note.title,'Later handmatig gewijzigd');assert(!ctx.calls.some(c=>c[0]==='update'));
});
test('attachments reject another owner and always download with an inert content type',async()=>{
 let downloads=0;const route=load('app/api/persoonlijk/bijlage/route.ts',{'../../../persoonlijk/access.server':{personalContext:async()=>({profile,db:{storage:{from:()=>({download:async()=>{downloads++;return{data:new Blob(['<script>unsafe()</script>'])};}})}}}),personalHeaders:{'Cache-Control':'private, no-store'}},'../../../persoonlijk/model':model});
 assert.equal((await route.GET(new Request(`https://app.example.invalid/api/persoonlijk/bijlage?path=${other}/test`))).status,404);assert.equal(downloads,0);
 const response=await route.GET(new Request(`https://app.example.invalid/api/persoonlijk/bijlage?path=${owner}/test&name=bron.html`));assert.equal(response.headers.get('Content-Type'),'application/octet-stream');assert(response.headers.get('Content-Disposition').startsWith('attachment;'));assert(response.headers.get('Content-Security-Policy').includes("default-src 'none'"));assert.equal(downloads,1);
});
test('priorities and later retain completion, task text, indentation and unrelated note content',()=>{
 const body='Project\n[ ] Hoofdtaak\n  [ ] Subtaak\n  [x] Gedaan\n[ ] Andere taak';
 const priority=model.setTaskPriority(body,2,'priority');assert.equal(model.taskLines(priority)[1].priority,'priority');assert.equal(model.taskLines(priority)[1].depth,1);assert.equal(model.taskLines(priority)[1].text,'Subtaak');
 const later=model.setTaskPriority(priority,2,'later');assert.equal(model.taskLines(later)[1].priority,'later');assert.equal(model.setTaskPriority(later,2,'normal'),body);
 assert.equal(model.taskLines(model.toggleTask(later,2))[1].done,true);assert.equal(model.taskLines(model.toggleTask(later,2))[1].priority,'later');assert.throws(()=>model.setTaskPriority(body,0,'priority'));assert.throws(()=>model.setTaskPriority(body,1,'unexpected'));
});
test('subtasks insert after descendants, preserve other projects and do not complete children implicitly',()=>{
 const body='[ ] Project\n  [ ] Eerste stap\n    [x] Detail\n[ ] Volgend project';
 assert.equal(model.addTask(body,'Tweede stap',0),'[ ] Project\n  [ ] Eerste stap\n    [x] Detail\n  [ ] Tweede stap\n[ ] Volgend project');
 assert.equal(model.addTask(body,'Detail twee',1),'[ ] Project\n  [ ] Eerste stap\n    [x] Detail\n    [ ] Detail twee\n[ ] Volgend project');
 assert.equal(model.taskLines(model.toggleTask(body,0))[1].done,false);assert.equal(model.addTask('','Nieuw'),'[ ] Nieuw');
 for(const text of ['', 'one\ntwo','x'.repeat(2001)])assert.throws(()=>model.addTask(body,text));assert.throws(()=>model.addTask(body,'Taak',99));
});
test('standalone Evernote tasks preserve completion, priority, order fields and explicitly retain empty tasks',()=>{
 const {evernoteTaskLines}=load('app/persoonlijk/evernote.ts');
 const task=fields=>({children:Object.entries(fields).map(([localName,textContent])=>({localName,textContent}))});
 const warnings=new Set(),rows=evernoteTaskLines([task({title:'Belangrijk',taskStatus:'open',taskFlag:'true',sortWeight:'B',taskGroupNoteLevelID:'group'}),task({title:'Afgerond',taskStatus:'completed'}),task({title:'  ',taskStatus:'open',repeatAfterCompletion:'true'})],warnings);
 assert.equal(rows.length,3);assert.equal(rows[0].line,'[ ] [prioriteit] Belangrijk');assert.equal(rows[0].weight,'B');assert.equal(rows[0].group,'group');assert.equal(rows[1].line,'[x] Afgerond');assert.equal(rows[2].line,'[ ] Lege taak uit Evernote');assert.equal(warnings.size,2);
 assert.throws(()=>evernoteTaskLines([task({title:'Onbekend',taskStatus:'unexpected'})],new Set()));
});
