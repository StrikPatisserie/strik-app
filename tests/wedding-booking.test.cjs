const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const crypto = require('node:crypto');
function load(file, dependencies = {}, globals = {}) {
  const exports = {};
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(source, { exports, Date, Intl, Buffer, Request, Response, URL, process: { env: { LETTERSHOP_RATE_SALT: 'test-only-salt' } }, require: name => dependencies[name], ...globals });
  return exports;
}
const dates = load('app/lib/weddingAppointments.ts');
const settings = { enabled: true, weekdays: [2, 3, 4, 5, 6], times: ['10:30','11:30'], minimum_notice_minutes: 0, advance_days: 365 };
const now = new Date('2026-10-22T07:00:00Z');
const contact = { names:'Voorbeeld & Test', email:'EXAMPLE@example.com', phone:'0612345678', weddingDate:'2027-05-21',guests:'60',notes:'Geen echte boeking' };
test('one booking closes only its slot; two bookings close the whole date', () => {
  const busy = [{appointment_date:'2026-10-23', start_time:'10:30:00',end_time:'11:00:00',status:'confirmed'}];
  const slots = dates.availableWeddingSlots(settings,'2026-10-23','2026-10-23',busy,[],now);
  assert.equal(JSON.stringify(slots),JSON.stringify([{date:'2026-10-23',times:['11:30']}]));
  busy.push({...busy[0],start_time:'11:30:00',end_time:'12:00:00',status:'pending'});
  assert.equal(dates.availableWeddingSlots(settings,'2026-10-23','2026-10-23',busy,[],now).length,0);
});
test('staff overlaps, full-day blocks, notice, and opening days are respected; cancellation reopens a slot', () => {
  const busy=[{appointment_date:'2026-10-23',start_time:'10:45',end_time:'11:45',status:'confirmed'}];
  assert.equal(dates.availableWeddingSlots(settings,'2026-10-23','2026-10-23',busy,[],now).length,0);
  busy[0].status='cancelled';
  assert.equal(dates.availableWeddingSlots(settings,'2026-10-23','2026-10-23',busy,[],now)[0].times.length,2);
  assert.equal(dates.availableWeddingSlots(settings,'2026-10-23','2026-10-23',[],['2026-10-23'],now).length,0);
  assert.equal(dates.availableWeddingSlots(settings,'2026-10-25','2026-10-26',[],[],now).length,0);
  assert.equal(dates.availableWeddingSlots({...settings,enabled:false},'2026-10-23','2026-10-23',[],[],now).length,0);
  assert.equal(dates.availableWeddingSlots(settings,'2026-10-23','2026-10-23',[],[],new Date('2026-10-23T09:00:00Z'))[0].times.join(','),'11:30');
});
test('local appointment times and reminder-day dates stay correct across winter/summer time', () => {
  assert.equal(dates.weddingSlotInstant('2026-10-24','10:30').toISOString(),'2026-10-24T08:30:00.000Z');
  assert.equal(dates.weddingSlotInstant('2026-10-27','10:30').toISOString(),'2026-10-27T09:30:00.000Z');
  assert.equal(dates.weddingLocalDate(new Date('2026-10-22T22:30:00Z')),'2026-10-23');
});
test('public booking requires valid contact details; staff can record an appointment without email/phone', () => {
  assert.equal(dates.parseWeddingContact(contact).email,'example@example.com');
  assert.throws(()=>dates.parseWeddingContact({...contact,email:''}));
  assert.equal(dates.parseWeddingContact({names:'Telefonische afspraak'},true).email,'');
  assert.throws(()=>dates.parseWeddingContact({...contact,email:'invalid'},true));
  assert.throws(()=>dates.parseWeddingContact({...contact,names:'Name\nBcc: test@example.com'}));
  assert.throws(()=>dates.parseWeddingContact({...contact,weddingDate:'2026-02-30'}));
});
const archive = load('app/lib/weddingArchive.server.ts',{'node:crypto':crypto,'server-only':{}});
function fixture() {
  const tables={booking:[{booking_id:'1',is_trash:'0',creation_date:'2026-10-01 11:00:00',form:'text^name1^Test~text^secondname1^Bruidspaar~email^email1^test%40example.com~textarea^details1^A &amp; B'},{booking_id:'2',is_trash:'1',creation_date:'2024-01-01 11:00:00',form:''}],bookingdates:[{booking_id:'1',booking_date:'2026-11-03 10:30:01',approved:'1'},{booking_id:'1',booking_date:'2026-11-03 11:00:02',approved:'1'},{booking_id:'2',booking_date:'2024-01-04 15:00:01',approved:'0'},{booking_id:'2',booking_date:'2024-01-04 15:30:02',approved:'0'}],booking_dates_props:[{booking_dates_prop_id:'10',calendar_date:'2026-11-07',prop_name:'date_status',prop_value:'unavailable'}]};
  const raw=JSON.stringify(tables);return {format:'strik-wedding-booking-export-v1',raw,sha256:crypto.createHash('sha256').update(raw).digest('hex'),counts:Object.fromEntries(Object.entries(tables).map(([k,v])=>[k,v.length]))};
}
test('migration preserves all original rows, names, local times, trash, and the complete raw archive', () => {
  const input=fixture(), result=archive.normalizeWeddingArchive(input);
  assert.equal(result.appointments.length,2);assert.equal(result.appointments[0].status,'confirmed');assert.equal(result.appointments[1].status,'trash');
  assert.equal(result.appointments[0].names,'Test Bruidspaar');assert.equal(result.appointments[0].notes,'A & B');
  assert.equal(result.appointments[0].start_time,'10:30');assert.equal(result.appointments[1].start_time,'15:00');
  assert.equal(result.archive.raw,input.raw);assert.equal(result.blocks.length,1);
  assert.throws(()=>archive.normalizeWeddingArchive({...input,raw:input.raw+' '}));
  assert.throws(()=>archive.normalizeWeddingArchive({...input,counts:{...input.counts,bookingdates:3}}));
});
const server={ weddingSameOrigin:request=>request.headers.get('origin')===new URL(request.url).origin,weddingJson:(body,status=200)=>Response.json(body,{status}) };
const request=(body,origin='https://app.strik-patisserie.nl')=>new Request('https://app.strik-patisserie.nl/api/wedding-appointments/book',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify(body)});
const payload={date:'2026-11-03',time:'10:30',requestId:'11111111-1111-4111-8111-111111111111',contact};
function bookRoute(rpc) { const after=[];return {...load('app/api/wedding-appointments/book/route.ts',{'node:crypto':crypto,'next/server':{after:fn=>after.push(fn)},'@/app/lib/weddingAppointments':dates,'@/app/lib/weddingServer':{...server,weddingDb:()=>({rpc})},'@/app/lib/weddingMail.server':{sendWeddingMails:async()=>{}}}),after}; }
test('public booking rejects wrong origins, oversized/invalid input and conflicts without acknowledging success',async()=>{
  let calls=0;const route=bookRoute(async()=>{calls++;return {error:{code:'P0001',message:'Tijdvak bezet'}};});
  assert.equal((await route.POST(request(payload,'https://other.example'))).status,403);
  assert.equal((await route.POST(request({...payload,contact:{...contact,notes:'🍪'.repeat(4000)}}))).status,413);
  assert.equal((await route.POST(request({...payload,time:'15:00'}))).status,400);
  const response=await route.POST(request(payload));assert.equal(response.status,409);assert.equal((await response.json()).receipt,undefined);
  assert.equal(calls,1);assert.equal(route.after.length,0);
});
test('confirmed response exposes only a receipt, and retries retain the request UUID for database deduplication',async()=>{
  const received=[];const route=bookRoute(async(name,args)=>{received.push(args);return {data:{id:'booking',reference:'BA-TEST',appointment_date:args.p_date,start_time:args.p_time,end_time:'11:00',names:'Test',email:'test@example.com',status:'confirmed',raw_source:{private:true},rate_key:'private'}};});
  for(let i=0;i<2;i++){const response=await route.POST(request(payload));assert.equal(response.status,200);const result=await response.json();assert.equal(result.receipt.reference,'BA-TEST');assert.equal(result.receipt.raw_source,undefined);assert.equal(result.receipt.rate_key,undefined);}
  assert.equal(received[0].p_request_id,received[1].p_request_id);assert.equal(received[0].p_rate_key.length,64);assert.equal(route.after.length,2);
});
test('private agenda enforces staff access and accepts arbitrary free day/time with revision checks',async()=>{
  let profile=null,calls=0,args;const route=load('app/api/wedding-appointments/manage/route.ts',{'next/server':{after:()=>{}},'@/app/lib/auth/session':{getCurrentProfile:async()=>profile},'@/app/lib/auth/access':{canAccessWeddingCakes:p=>p.role==='staff',hasFullAccess:()=>false},'@/app/lib/weddingArchive.server':archive,'@/app/lib/weddingAppointments':dates,'@/app/lib/weddingServer':{...server,weddingDb:()=>({rpc:async(name,input)=>{calls++;args=input;return {data:{id:'test'}};}})},'@/app/lib/weddingMail.server':{sendWeddingMails:async()=>{}}});
  assert.equal((await route.POST(request({}))).status,403);
  profile={id:'staff-id',active:true,role:'staff'};
  assert.equal((await route.POST(request(null))).status,400);
  assert.equal((await route.POST(request({action:'import'}))).status,403);
  const response=await route.POST(request({date:'2026-11-01',start:'16:15',end:'17:00',requestId:payload.requestId,contact:{names:'Telefonische afspraak'},notify:false}));
  assert.equal(response.status,200);assert.equal(args.p_start,'16:15');assert.equal(args.p_date,'2026-11-01');assert.equal(args.p_actor,'staff-id');assert.equal(args.p_notify,false);
  assert.equal((await route.POST(request({id:payload.requestId,date:'2026-11-01',start:'16:15',end:'17:00',contact:{names:'Test'}}))).status,400);assert.equal(calls,1);
});
test('reminder email is distinct and retains date, time, location and reply address',()=>{
  const mail=load('app/lib/weddingMail.ts',{'./weddingAppointments':dates});
  const result=mail.weddingConfirmationMail({reference:'BA-TEST',appointment_date:'2026-11-03',start_time:'10:30',end_time:'11:00',names:'Test',email:'test@example.com',phone:'',notes:''},false,true);
  assert.match(result.subject,/Herinnering: morgen/);assert.match(result.html,/Morgen is jullie bruidstaartafspraak/);assert.match(result.html,/10:30–11:00/);assert.match(result.html,/Ziekerstraat 124/);assert.match(result.html,/mailto:info@strik-patisserie.nl/);
});
function mailWorker(options={}) {
  const sent=[],updates=[];
  const jobs=options.jobs||[{id:'job-1',appointment_id:'appointment-1',template:'CUSTOMER_REMINDER',status:'PENDING',attempts:0,revision:1}];
  const booking={id:'appointment-1',reference:'BA-TEST',appointment_date:'2026-10-23',start_time:'10:30',end_time:'11:00',status:'confirmed',names:'Test',email:'test@example.com',phone:'',notes:'',source:'app',revision:1,...options.booking};
  const db={from(table){let op='read',patch,filters=[];const query={select(){return query;},update(value){op='update';patch=value;return query;},eq(key,value){filters.push([key,value]);return query;},in(){return query;},lt(){return query;},lte(){return query;},order(){return query;},limit(){return query;},single(){return Promise.resolve({data:booking});},maybeSingle(){return Promise.resolve({data: options.claimLost?null:{id:'job-1'}});},then(resolve,reject){if(op==='update')updates.push({patch,filters});return Promise.resolve(table==='wedding_appointment_mail_outbox'&&op==='read'?{data:jobs}:{data:null}).then(resolve,reject);}};return query;}};
  class Clock extends Date {constructor(...args){super(...(args.length?args:['2026-10-22T07:00:00Z']));}static now(){return new Date('2026-10-22T07:00:00Z').getTime();}}
  const worker=load('app/lib/weddingMail.server.ts',{'server-only':{},'./weddingServer':{weddingDb:()=>db,weddingSettings:async()=>({enabled:options.enabled!==false}),weddingWordPress:async(path,payload)=>{sent.push(payload);return options.receipt||{sent:true};}},'./weddingAppointments':dates,'./weddingMail':{weddingConfirmationMail:(b,internal,reminder)=>({subject:reminder?'Reminder':'Confirmation',html:'Test'})}},{Date:Clock});
  return {...worker,sent,updates};
}
test('reminder worker sends tomorrow only, and ignores cancelled or superseded appointments',async()=>{
  for(const booking of [{appointment_date:'2026-10-24'},{status:'cancelled'},{revision:2},{email:''}]){const worker=mailWorker({booking});await worker.sendWeddingMails();assert.equal(worker.sent.length,0);assert.equal(worker.updates.at(-1).patch.status,'SKIPPED');}
  const worker=mailWorker();await worker.sendWeddingMails();assert.equal(worker.sent.length,1);assert.equal(worker.sent[0].template,'CUSTOMER_REMINDER');assert.equal(worker.sent[0].id,'job-1');assert.equal(worker.updates.at(-1).patch.status,'SENT');
});
test('preview/disabled planner sends nothing; a missing transport receipt stays failed for retry',async()=>{
  const disabled=mailWorker({enabled:false});assert.equal(await disabled.sendWeddingMails(),0);assert.equal(disabled.updates.length,0);assert.equal(disabled.sent.length,0);
  const worker=mailWorker({receipt:{sent:false}});await worker.sendWeddingMails();assert.equal(worker.updates.at(-1).patch.status,'FAILED');
  const lost=mailWorker({claimLost:true});await lost.sendWeddingMails();assert.equal(lost.sent.length,0);
});
