const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript'),React=require('react');
function loader(overrides={},globals={}){const cache={};return function load(file){file=path.resolve(file);if(cache[file])return cache[file];const exports=cache[file]={};const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;vm.runInNewContext(code,{exports,Intl,Date,Set,Map,URL,Response,AbortController,AbortSignal,console,...globals,require(name){if(name in overrides)return overrides[name];if(name.endsWith('.css'))return {default:{}};if(name==='server-only')return {};if(name==='next/link')return {default:'a'};if(name.startsWith('.')||name.startsWith('@/')){const base=name.startsWith('@/')?path.resolve(name.slice(2)):path.resolve(path.dirname(file),name);const next=['.ts','.tsx'].map(e=>base+e).find(fs.existsSync);if(next)return load(next);}return require(name);}});return exports;};}
const load=loader(),model=load('app/winkel/weddingAlertModel.ts'),access=load('app/lib/auth/access.ts');
const profile={id:'ipad-ziekerstraat',email:'strikpatisserieziekerstraat@gmail.com',role:'winkel',store:'ziekerstraat',permissions:{'bruidstaarten.view':true},active:true};
const appointment={id:'test-a',appointment_date:'2026-10-30',start_time:'11:30',end_time:'12:00',names:'Voorbeeldpaar',status:'confirmed'};
const at=time=>new Date(`2026-10-30T${time}:00+01:00`);
test('only the active Ziekerstraat shop account qualifies; other shops and staff do not',()=>{
 assert.equal(access.canReceiveZiekerstraatWeddingAlerts(profile),true);
 for(const candidate of [null,{...profile,active:false},{...profile,email:'manager@example.invalid',role:'manager'},{...profile,email:'collega@example.invalid'},...['lent','daalseweg','heyendaal'].map(store=>({...profile,email:`strikpatisserie${store}@gmail.com`,store})),{...profile,store:'lent'}])assert.equal(access.canReceiveZiekerstraatWeddingAlerts(candidate),false);
});
test('iPadOS desktop mode and ordinary iPads qualify; desktop and Android do not',()=>{
 for(const device of [{userAgent:'iPad',platform:'iPad',maxTouchPoints:5},{userAgent:'Macintosh Safari',platform:'MacIntel',maxTouchPoints:5}])assert(model.isIpadDevice(device));
 for(const device of [{userAgent:'Macintosh Chrome',platform:'MacIntel',maxTouchPoints:0},{userAgent:'Android',platform:'Linux',maxTouchPoints:5}])assert.equal(model.isIpadDevice(device),false);
});
test('the day notice groups today’s appointments, survives its start and is not automatically dismissed',()=>{
 const second={...appointment,id:'test-b',start_time:'14:00',end_time:'14:30'};
 const alert=model.nextWeddingStoreAlert([appointment,second],at('08:00'),new Set());assert.equal(alert.phase,'morning');assert.equal(alert.appointments.length,2);
 assert.equal(model.nextWeddingStoreAlert([appointment,second],at('12:30'),new Set(),alert).appointments.length,2);
 assert.equal(model.nextWeddingStoreAlert([appointment],at('13:00'),new Set(),{...alert,appointments:[appointment]}).appointments.length,1);
});
test('morning dismissals persist separately from the fifteen-minute reminder and survive reload',()=>{
 const alert=model.nextWeddingStoreAlert([appointment],at('08:00'),new Set());const ack=model.acknowledgeWeddingAlert(alert,new Set());
 const reloaded=model.readWeddingAcknowledgements(JSON.stringify([...ack]));assert.equal(model.nextWeddingStoreAlert([appointment],at('11:14'),reloaded),null);
 const reminder=model.nextWeddingStoreAlert([appointment],at('11:15'),reloaded);assert.equal(reminder.phase,'reminder');
 const done=model.acknowledgeWeddingAlert(reminder,reloaded);assert.equal(model.nextWeddingStoreAlert([appointment],at('11:16'),done),null);
});
test('the reminder takes priority over an unclosed day notice; missed reminders are not invented after arrival',()=>{
 const morning=model.nextWeddingStoreAlert([appointment],at('08:00'),new Set());
 assert.equal(model.nextWeddingStoreAlert([appointment],at('11:15'),new Set(),morning).phase,'reminder');
 assert.equal(model.nextWeddingStoreAlert([appointment],at('12:30'),new Set()),null);
});
test('cancellations, changed times and day rollover invalidate previous notices; private data is not stored in ack keys',()=>{
 const original=model.nextWeddingStoreAlert([appointment],at('08:00'),new Set());const ack=model.acknowledgeWeddingAlert(original,new Set());
 assert.equal(model.nextWeddingStoreAlert([{...appointment,status:'cancelled'}],at('08:00'),ack,original),null);
 assert.equal(model.nextWeddingStoreAlert([{...appointment,start_time:'14:00',end_time:'14:30'}],at('08:01'),ack).phase,'morning');
 assert.equal(model.nextWeddingStoreAlert([appointment],new Date('2026-10-31T08:00:00+01:00'),ack,original),null);
 assert.equal(JSON.stringify([...ack]).includes('Voorbeeldpaar'),false);
});
test('Amsterdam time is used in summer and winter and stale sources cannot create new notices',()=>{
 const winter=at('11:15'),summer=new Date('2026-07-03T09:15:00Z');
 assert.equal(model.nextWeddingStoreAlert([appointment],winter,new Set()).phase,'reminder');
 assert.equal(model.nextWeddingStoreAlert([{...appointment,appointment_date:'2026-07-03'}],summer,new Set()).phase,'reminder');
 assert.equal(model.nextWeddingStoreAlert([appointment],at('11:15'),new Set(),null,false),null);
 assert.equal(model.nextWeddingStoreAlert([appointment],at('05:00'),new Set()),null);
 assert.equal(model.readWeddingAcknowledgements('{invalid').size,0);
});
function api(candidate=profile,settings={enabled:true},rows=[appointment]){
 const calls=[];const query={};for(const method of ['select','eq','in','order','limit'])query[method]=(...args)=>{calls.push([method,...args]);return query;};query.abortSignal=async()=>({data:rows,error:settings.error||null});
 class Clock extends Date{constructor(...args){super(...(args.length?args:[at('08:00').getTime()]));}}
 const server={weddingJson:(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store'}}),weddingSettings:async()=>settings,weddingDb:()=>({from:name=>{calls.push(['from',name]);return query;}}),weddingWordPress:async()=>{calls.push(['wordpress']);return {};}};
 const handler=loader({'@/app/lib/auth/session':{getCurrentProfile:async()=>candidate},'@/app/lib/weddingServer':server,'@/app/lib/weddingArchive.server':{normalizeWeddingArchive:()=>({appointments:rows.map(row=>({...row,source_id:row.id}))})}},{Date:Clock})('app/api/wedding-appointments/store-alerts/route.ts');return {get:handler.GET,calls};
}
test('the API denies other users before reading either agenda source',async()=>{
 for(const candidate of [null,{...profile,active:false},{...profile,email:'manager@example.invalid'}]){const test=api(candidate);assert.equal((await test.get()).status,403);assert.equal(test.calls.length,0);}
});
test('the API selects today and only active slots and returns no contact, notes, or mail history',async()=>{
 const test=api(profile,{enabled:true},[{...appointment,email:'private@example.invalid',phone:'private',notes:'private'},{...appointment,id:'cancelled',status:'cancelled'},{...appointment,id:'tomorrow',appointment_date:'2026-10-31'}]);const response=await test.get(),data=await response.json();
 assert.equal(response.status,200);assert.equal(response.headers.get('Cache-Control'),'private, no-store');assert.equal(data.appointments.length,1);assert.equal(Object.keys(data.appointments[0]).sort().join(','),'appointment_date,end_time,id,names,start_time,status');
 assert(test.calls.some(call=>call[0]==='eq'&&call[1]==='appointment_date'&&call[2]==='2026-10-30'));
 const fallback=api(profile,{enabled:false});assert.equal((await fallback.get()).status,200);assert(fallback.calls.some(call=>call[0]==='wordpress'));assert(!fallback.calls.some(call=>call[0]==='from'));
 assert.equal((await api(profile,{enabled:true,error:'offline'}).get()).status,503);
});
function monitor({candidate=profile,ipad=true,stored=new Map()}={}){
 let clock=at('08:00').getTime(),state=null,callbacks=[],cleanup=[],payload=[appointment],offline=false,fetches=0;
 const listeners=new Map(),intervals=new Map();const storage={getItem:key=>stored.get(key)||null,setItem:(key,value)=>stored.set(key,value)};
 const window={setInterval:(fn,ms)=>{intervals.set(ms,fn);return ms;},clearInterval:ms=>intervals.delete(ms),setTimeout:()=>1,clearTimeout(){},addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener:name=>listeners.delete(name)};
 const document={hidden:false,addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener:name=>listeners.delete(name)};
 class Clock extends Date{constructor(...args){super(...(args.length?args:[clock]));}static now(){return clock;}}
 const ref={current:null};const hooks={...React,useState:()=>[state,next=>{state=next;}],useRef:()=>ref,useEffect:fn=>callbacks.push(fn)};
 const Component=loader({'react':hooks,'./WeddingAppointmentAlert':{default:'WeddingAlert'}},{Date:Clock,navigator:ipad?{userAgent:'Macintosh Safari',platform:'MacIntel',maxTouchPoints:5}:{userAgent:'Macintosh Chrome',platform:'MacIntel',maxTouchPoints:0},localStorage:storage,window,document,fetch:async()=>{fetches++;if(offline)throw Error('offline');return {ok:true,status:200,json:async()=>({today:'2026-10-30',appointments:payload})};}})('app/winkel/WeddingAppointmentMonitor.tsx').default;
 const render=()=>Component({profile:candidate});render();cleanup=callbacks.splice(0).map(fn=>fn());callbacks=[];
 return {render,stored,listeners,intervals,document,get state(){return state;},get fetches(){return fetches;},setTime(time){clock=at(time).getTime();},setItems(items){payload=items;},setOffline(value){offline=value;},tick(){intervals.get(15000)?.();},poll(){intervals.get(60000)?.();},dismiss(){ref.current?.();},async flush(){await new Promise(setImmediate);},destroy(){cleanup.forEach(fn=>fn?.());}};
}
test('the actual monitor shows morning, remembers dismissal, then shows and dismisses the imminent reminder',async()=>{
 const test=monitor();await test.flush();assert.equal(test.state.alert.phase,'morning');test.dismiss();assert.equal(test.state,null);
 test.setTime('11:14');test.poll();await test.flush();test.tick();assert.equal(test.state,null);
 test.setTime('11:15');test.tick();assert.equal(test.state.alert.phase,'reminder');test.dismiss();assert.equal(test.state,null);
 test.destroy();const reload=monitor({stored:test.stored});reload.setTime('11:16');await reload.flush();assert.equal(reload.state,null);reload.destroy();
});
test('the monitor does not fetch or show on desktops, other shops or staff accounts',async()=>{
 for(const options of [{ipad:false},{candidate:{...profile,email:'collega@example.invalid'}},{candidate:null}]){const test=monitor(options);await test.flush();assert.equal(test.fetches,0);assert.equal(test.state,null);test.destroy();}
});
test('cancellation refresh removes an open alert, wake-up refresh restores the reminder and stale data does not launch one',async()=>{
 const test=monitor();await test.flush();test.setItems([]);test.poll();await test.flush();assert.equal(test.state,null);
 test.setItems([appointment]);test.listeners.get('focus')();await test.flush();assert.equal(test.state.alert.phase,'morning');test.dismiss();
 test.setTime('11:15');test.setOffline(true);test.poll();await test.flush();test.tick();assert.equal(test.state,null);
 test.setOffline(false);test.listeners.get('visibilitychange')();await test.flush();assert.equal(test.state.alert.phase,'reminder');test.destroy();assert.equal(test.intervals.size,0);assert.equal(test.listeners.size,0);
});
test('a dismissal in another tab closes the same notice without losing its later reminder',async()=>{
 const test=monitor();await test.flush();const alert=test.state.alert;const key=model.weddingAlertStorageKey(profile.id,alert.date);
 test.stored.set(key,JSON.stringify([...model.acknowledgeWeddingAlert(alert,new Set())]));test.listeners.get('storage')({key});assert.equal(test.state,null);
 test.setTime('11:15');test.poll();await test.flush();assert.equal(test.state.alert.phase,'reminder');test.destroy();
});
test('the real dialog renders multiple actual appointments and an overdue reminder without a stale countdown',()=>{
 const {renderToStaticMarkup}=require('react-dom/server');const Alert=load('app/winkel/WeddingAppointmentAlert.tsx').default;
 const alert={phase:'morning',date:'2026-10-30',appointments:[appointment,{...appointment,id:'b',names:'Nog een paar',start_time:'14:00',end_time:'14:30'}]};
 const html=renderToStaticMarkup(React.createElement(Alert,{alert,stale:false,storageAvailable:true,now:at('08:00').getTime(),onDismiss(){}}));assert.match(html,/role="dialog"/);assert.match(html,/bruidstaartafspraken/);assert.match(html,/11:30/);assert.match(html,/14:00/);assert.match(html,/Ik heb het gezien/);
 const overdue=renderToStaticMarkup(React.createElement(Alert,{alert:{...alert,phase:'reminder',appointments:[appointment]},stale:true,storageAvailable:false,now:at('11:35').getTime(),onDismiss(){}}));assert.match(overdue,/afspraak is begonnen/);assert.match(overdue,/tijdelijk niet worden vernieuwd/);assert.match(overdue,/kan wegklikken niet bewaren/);
});
