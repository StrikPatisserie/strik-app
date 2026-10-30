const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function load(file,imports={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:name=>{assert(name in imports,`Unexpected import: ${name}`);return imports[name];},Response,Request,URL,Date,Set,Map,File,Uint8Array,crypto:require('node:crypto').webcrypto});return exports;}
const model=load('app/persoonlijk/model.ts'),access=load('app/lib/auth/access.ts');
const owner='00000000-0000-4000-8000-000000000001',noteId='00000000-0000-4000-8000-000000000002',other='00000000-0000-4000-8000-000000000003';
function input(changes={}){return{id:noteId,title:'Mijn notitie',notebook:'TO DO',body:'[ ] Controleren\n[x] Afgerond\nGewone tekst',tags:[],pinned:false,archived:false,attachments:[],source_hash:null,source_created_at:null,source_updated_at:null,...changes};}
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
 let downloads=0;const route=load('app/api/persoonlijk/bijlage/route.ts',{'../../../persoonlijk/access.server':{personalContext:async()=>({profile,db:{storage:{from:()=>({download:async()=>{downloads++;return{data:new Blob(['<script>unsafe()</script>'])};}})}}}),personalHeaders:{'Cache-Control':'private, no-store'}},'../../../persoonlijk/model':model,'../../../persoonlijk/fileTypes':load('app/persoonlijk/fileTypes.ts')});
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
test('only the to-do notebook has task controls; meeting and reference notes stay notes',async()=>{
 for(const name of ['TO DO',"To do’s","To-do's",'to dos'])assert(model.isTodoNotebook(name));
 for(const name of ['Vergaderingen','Belangrijke gegevens','Mijn notities']){
  assert(!model.isTodoNotebook(name));const ctx=context(input({notebook:name}));await routes(ctx.value).POST(request('POST',input({notebook:name})));assert.equal(ctx.calls.find(c=>c[0]==='insert')[1].open_tasks,0);
  const read=context([input({notebook:name})]),response=await routes(read.value).GET(new Request('https://app.example.invalid/api/persoonlijk'));assert.equal((await response.json()).notes[0].tasks.length,0);
 }
});
test('custom task categories persist without tasks and moving projects retains children, priority and completion',()=>{
 let body='Context\n[ ] Project\n\n  [x] Stap één\n  [ ] [prioriteit] Stap twee\n[ ] Andere taak';
 assert(model.taskCategories(body).includes('Administratie to do’s'));body=model.addTaskCategory(body,'Personeel');assert(model.taskCategories(body).includes('Personeel'));assert.equal(model.addTaskCategory(body,'Personeel'),body);
 body=model.moveTaskCategory(body,1,'Administratie to do’s');let tasks=model.taskLines(body);const moved=tasks.find(t=>t.text==='Project');assert.equal(moved.category,'Administratie to do’s');assert.equal(tasks.find(t=>t.text==='Stap één').done,true);assert.equal(tasks.find(t=>t.text==='Stap twee').priority,'priority');assert.equal(tasks.find(t=>t.text==='Stap twee').category,moved.category);assert.equal(tasks.find(t=>t.text==='Andere taak').category,model.TASK_FALLBACK_CATEGORY);
 body=model.addTask(body,'Belasting',undefined,'Administratie to do’s');body=model.addTask(body,'Rooster',undefined,'Personeel');tasks=model.taskLines(body);assert.equal(tasks.find(t=>t.text==='Belasting').category,'Administratie to do’s');assert.equal(tasks.find(t=>t.text==='Rooster').category,'Personeel');
 const parent=tasks.find(t=>t.text==='Project');body=model.addTask(body,'Nog een stap',parent.index);assert.equal(model.taskLines(body).find(t=>t.text==='Nog een stap').category,parent.category);
 assert.throws(()=>model.addTaskCategory(body,'Fout\n## injectie'));assert.throws(()=>model.moveTaskCategory(body,model.taskLines(body).find(t=>t.depth===1).index,'Personeel'));
});
test('editing one task preserves category, priority, completion, subtasks and every other line',()=>{
 const body='## Administratie to do’s\n[x] [later] Project\n  [ ] [prioriteit] Subtaak\nNotitie\n[ ] Andere taak';
 const edited=model.editTaskText(body,1,'Project hernoemd');assert.equal(edited,'## Administratie to do’s\n[x] [later] Project hernoemd\n  [ ] [prioriteit] Subtaak\nNotitie\n[ ] Andere taak');
 const task=model.taskLines(edited)[0];assert.equal(task.done,true);assert.equal(task.priority,'later');assert.equal(task.category,'Administratie to do’s');
 assert.equal(model.taskLines(model.editTaskText(body,2,'Nieuwe stap'))[1].depth,1);
 for(const title of ['', 'één\ntwee','x'.repeat(2001)])assert.throws(()=>model.editTaskText(body,1,title));assert.throws(()=>model.editTaskText(body,0,'Titel'));
});
test('removing a category relocates every task and subtask to Daily without changing state or priority',()=>{
 const body='[ ] Bestaand algemeen\n## Winkel to do’s\n[ ] [later] Project\n  [x] Klaar\n  [ ] [prioriteit] Stap\n## Personeel\n[ ] Collega\n## Winkel to do’s\n[ ] Tweede project';
 const before=model.taskLines(body),removed=model.removeTaskCategory(body,'Winkel to do’s'),after=model.taskLines(removed);assert.equal(after.length,before.length);assert(!model.taskCategories(removed).includes('Winkel to do’s'));
 for(const task of before){const restored=after.find(t=>t.text===task.text);assert(restored);assert.equal(restored.done,task.done);assert.equal(restored.priority,task.priority);assert.equal(restored.depth,task.depth);assert.equal(restored.category,task.category==='Winkel to do’s'?model.TASK_FALLBACK_CATEGORY:task.category);}
 assert.equal(model.taskLines(model.addTask(removed,'Nieuwe taak')) .find(t=>t.text==='Nieuwe taak').category,model.TASK_FALLBACK_CATEGORY);
});
test('empty and default categories stay removed after optional categories are deleted; Daily remains',()=>{
 let body='[ ] Taak';for(const name of model.DEFAULT_TASK_CATEGORIES.filter(name=>name!==model.TASK_FALLBACK_CATEGORY))body=model.removeTaskCategory(body,name);assert.equal(model.taskCategories(body).length,0);assert.equal(model.taskLines(body).length,1);assert.equal(model.taskLines(body)[0].category,model.TASK_FALLBACK_CATEGORY);
 body=model.addTaskCategory(body,'Eigen categorie');assert.equal(model.taskCategories(body).length,1);body=model.removeTaskCategory(body,'Eigen categorie');assert.equal(model.taskCategories(body).length,0);assert.throws(()=>model.removeTaskCategory(body,'Algemeen'));assert.throws(()=>model.removeTaskCategory(body,'Bestaat niet'));
 body=model.addTaskCategory(body,'Winkel to do’s');assert(model.taskCategories(body).includes('Winkel to do’s'));
});
test('Daily keeps an existing order when restored category tasks and new tasks are appended',()=>{
 const body='## Algemeen\n[ ] Bestaand\n## Winkel to do’s\n[ ] Verplaatsen\n  [ ] Subtaak';
 let next=model.removeTaskCategory(body,'Winkel to do’s');next=model.addTask(next,'Nieuw');const tasks=model.taskLines(next);assert.deepEqual(Array.from(tasks,t=>t.text),['Bestaand','Verplaatsen','Subtaak','Nieuw']);assert(tasks.every(t=>t.category===model.TASK_FALLBACK_CATEGORY));assert.equal(tasks[2].depth,1);
});
test('resolving a main task removes only its subtree, keeping other tasks, categories and note text',()=>{
 const body='Intro\n## Werk\n[ ] Project\n  [x] Stap\n    [ ] Detail\nAantekening bewaren\n  [ ] Andere stap\n[ ] Ander project\n  [ ] Andere subtaak\n## Privé\n[ ] Laatste';
 const result=model.resolveTask(body,2),tasks=model.taskLines(result);assert.deepEqual(Array.from(tasks,t=>t.text),['Ander project','Andere subtaak','Laatste']);assert(result.includes('Aantekening bewaren'));assert(result.includes('## Werk'));assert(result.includes('## Privé'));assert.throws(()=>model.resolveTask(body,0));
});
test('resolving a subtask preserves its parent and siblings and works for crossed-off tasks',()=>{
 const body='## Algemeen\n[x] Hoofdtaak\n  [ ] Subtaak\n    [ ] Detail\n  [x] Andere stap\n## Leeg\n  [ ] Losse taak';
 const result=model.resolveTask(body,2),tasks=model.taskLines(result);assert.deepEqual(Array.from(tasks,t=>t.text),['Hoofdtaak','Andere stap','Losse taak']);assert.equal(tasks[0].done,true);assert.equal(tasks[1].done,true);
 const withoutParent=model.resolveTask(body,1);assert.deepEqual(Array.from(model.taskLines(withoutParent),t=>t.text),['Losse taak']);
 assert.equal(model.resolveTask('[x] Klaar',0),'');assert.throws(()=>model.resolveTask(body,99));
});
test('Daily is the fixed fallback and legacy General headings map to Daily without losing tasks',()=>{
 const body='[ ] Los\n## Algemeen\n[ ] Project\n  [x] Kind\n## Dagelijkse to do’s\n[ ] Dagelijks';
 assert(!model.taskCategories(body).includes('Algemeen'));assert(model.taskLines(body).every(t=>t.category===model.TASK_FALLBACK_CATEGORY));assert.throws(()=>model.removeTaskCategory(body,model.TASK_FALLBACK_CATEGORY));assert.throws(()=>model.addTaskCategory(body,'Algemeen'));
 const next=model.addTask(body,'Nieuw');assert.equal(model.taskLines(next).length,5);assert(model.taskLines(next).every(t=>t.category===model.TASK_FALLBACK_CATEGORY));
});
test('priority sections stay separate while each subtask follows its parent',()=>{
 const body='## Werk\n[ ] [later] Later project\n  [ ] [prioriteit] Kind blijft bij project\n[ ] Gewoon\n[ ] [prioriteit] Belangrijk\n  [x] Stap\n## Ander\n[ ] Tweede gewoon';
 const groups=model.taskPriorityGroups(body);assert.deepEqual(Array.from(groups,g=>g.priority),['priority','normal','later']);assert.deepEqual(Array.from(groups[0].tasks,t=>t.text),['Belangrijk','Stap']);assert.deepEqual(Array.from(groups[1].tasks,t=>t.text),['Gewoon','Tweede gewoon']);assert.deepEqual(Array.from(groups[2].tasks,t=>t.text),['Later project','Kind blijft bij project']);assert.equal(groups[0].tasks[1].done,true);
});
const undo=load('app/persoonlijk/undo.ts');
const fullNote=(changes={})=>({...input(),revision:1,created_at:'2026-10-29T08:00:00Z',updated_at:'2026-10-29T08:00:00Z',...changes});
test('undo restores resolved tasks and categories and redo reapplies them using the latest saved revision',()=>{
 const original=fullNote({body:'## Winkel to do’s\n[ ] Project\n  [x] Stap'});let state=undo.startTimeline(original);
 const removed=fullNote({body:model.resolveTask(original.body,1),revision:2});state=undo.acceptTimeline(state,removed);const target=undo.stepTimeline(state,'undo');assert.equal(target.present.body,original.body);assert.equal(target.revision,2);assert.equal(state.present.body,removed.body);
 state=undo.acceptTimeline(target,fullNote({body:target.present.body,revision:3}));const redo=undo.stepTimeline(state,'redo');assert.equal(redo.present.body,removed.body);assert.equal(redo.revision,3);
 state=undo.acceptTimeline(redo,fullNote({body:redo.present.body,revision:4}));assert.equal(state.revision,4);assert.equal(state.future.length,0);
 const category=undo.acceptTimeline(undo.startTimeline(original),fullNote({body:model.removeTaskCategory(original.body,'Winkel to do’s'),revision:2}));assert.equal(undo.stepTimeline(category,'undo').present.body,original.body);
});
test('typing bursts make useful undo steps; new edits clear redo, and failed candidates do not consume history',()=>{
 const original=fullNote({body:''});let state=undo.startTimeline(original);state=undo.recordTimeline(state,{...original,body:'H'},'body',1000);state=undo.recordTimeline(state,{...original,body:'Hallo'},'body',1200);assert.equal(state.past.length,1);state=undo.recordTimeline(state,{...original,body:'Hallo wereld'},'body',2200);assert.equal(state.past.length,2);
 const candidate=undo.stepTimeline(state,'undo');assert.equal(candidate.present.body,'Hallo');assert.equal(state.present.body,'Hallo wereld');const branch=undo.recordTimeline(candidate,{...original,body:'Andere tekst'},'body',2300);assert.equal(branch.future.length,0);assert.equal(undo.stepTimeline(branch,'undo').present.body,'Hallo');assert.throws(()=>undo.recordTimeline(state,{...original,id:other}));
});
test('history stays per note and per session; an external revision invalidates stale undo targets',()=>{
 const original=fullNote();let state=undo.acceptTimeline(undo.startTimeline(original),fullNote({title:'Nieuw',revision:2}));assert.equal(undo.reopenTimeline(state,fullNote({title:'Nieuw',revision:2})).past.length,1);assert.equal(undo.reopenTimeline(state,fullNote({title:'Op andere plek gewijzigd',revision:3})).past.length,0);
 const fresh=undo.startTimeline(fullNote({id:other}));assert.equal(fresh.past.length,0);assert.equal(undo.stepTimeline(fresh,'undo'),null);
 for(let i=0;i<40;i++)state=undo.recordTimeline(state,{...original,body:String(i)});assert(state.past.length<=30);
});

test('task files stay linked through edits, completion and category moves',()=>{
 const path=`${owner}/tasks/test.pdf`,body=model.attachTaskFile('[ ] Lezen\n[ ] Andere taak',0,path);
 assert.equal(model.taskLines(body)[0].text,'Lezen');assert.equal(model.taskLines(body)[0].files[0],path);
 const edited=model.editTaskText(body,0,'Nieuwe naam');assert.equal(model.taskLines(edited)[0].files[0],path);
 const moved=model.moveTaskCategory(model.toggleTask(edited,0),0,'Administratie to do’s');
 assert.equal(model.taskLines(moved).find(t=>t.text==='Nieuwe naam').files[0],path);
 assert(!model.resolveTask(body,0).includes(path));
});
test('file signatures reject active documents disguised as images',()=>{
 const types=load('app/persoonlijk/fileTypes.ts');
 assert.equal(types.personalFileType(new Uint8Array(Buffer.from('%PDF-1.7'))),'application/pdf');
 assert.equal(types.personalFileType(new Uint8Array(Buffer.from('<svg onload="bad()"/>'))),null);
 assert.equal(types.personalFileType(new Uint8Array([137,80,78,71,13,10,26,10])),'image/png');
});
test('file uploads enforce authentication, same origin, signature and owner storage path',async()=>{
 const types=load('app/persoonlijk/fileTypes.ts');let uploads=[];
 const route=load('app/api/persoonlijk/bijlage/route.ts',{'../../../persoonlijk/model':model,'../../../persoonlijk/fileTypes':types,'../../../persoonlijk/access.server':{personalContext:async()=>({profile,db:{storage:{from:()=>({upload:async(...args)=>{uploads.push(args);return{error:null};}})}}}),personalHeaders:{'Cache-Control':'private, no-store'}}});
 function upload(content,origin='https://app.example.invalid') {const form=new FormData();form.set('file',new File([content],'test.pdf',{type:'application/pdf'}));return new Request('https://app.example.invalid/api/persoonlijk/bijlage',{method:'POST',headers:{Origin:origin},body:form});}
 assert.equal((await route.POST(upload('%PDF-1.7','https://other.example.invalid'))).status,403);
 assert.equal((await route.POST(upload('<svg/>'))).status,400);assert.equal(uploads.length,0);
 const response=await route.POST(upload('%PDF-1.7'));assert.equal(response.status,200);
 const data=await response.json();assert(data.attachment.path.startsWith(`${owner}/tasks/`));assert.equal(data.attachment.type,'application/pdf');assert.equal(uploads[0][2].upsert,false);
 const denied=load('app/api/persoonlijk/bijlage/route.ts',{'../../../persoonlijk/model':model,'../../../persoonlijk/fileTypes':types,'../../../persoonlijk/access.server':{personalContext:async()=>({error:new Response(null,{status:403})}),personalHeaders:{}}});
 assert.equal((await denied.POST(upload('%PDF-1.7'))).status,403);
});
test('cleanup only deletes own task files and reports files blocked by storage',async()=>{
 const types=load('app/persoonlijk/fileTypes.ts');let removed=[];
 const route=load('app/api/persoonlijk/bijlage/route.ts',{'../../../persoonlijk/model':model,'../../../persoonlijk/fileTypes':types,'../../../persoonlijk/access.server':{personalContext:async()=>({profile,db:{storage:{from:()=>({remove:async paths=>{removed.push(...paths);return {data:paths.map(name=>({name})),error:null};}})}}}),personalHeaders:{}}});
 const req=paths=>request('DELETE',{paths});
 for(const path of [`${other}/tasks/test.pdf`,`${owner}/_imports/test.pdf`,`${owner}/tasks/../test.pdf`])assert.equal((await route.DELETE(req([path]))).status,400);
 assert.equal(removed.length,0);assert.equal((await route.DELETE(req([`${owner}/tasks/test.pdf`]))).status,200);
 const sql=fs.readFileSync('app/supabase/migrations/20261030112316_personal_task_file_cleanup.sql','utf8');
 assert(sql.includes("split_part(name,'/',2)='tasks'"));assert(sql.includes('not exists(select 1 from public.personal_notes'));assert(sql.includes('private.is_personal_workspace_owner()'));
});
