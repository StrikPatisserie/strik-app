const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function load(file,imports={},globals={}){const exports={};const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;vm.runInNewContext(code,{exports,Intl,Date,Map,Set,...globals,require:name=>imports[name]||{}});return exports;}
const model=load('app/management/homeDayRevenue.ts');
const access=load('app/lib/auth/access.ts');
const plain=value=>JSON.parse(JSON.stringify(value));
const record=(shop,date,amount,extra={})=>({id:`${date}:${shop}`,shop,date,amount,year:2026,week:45,source:'dagafsluiting',...extra});
test('latest closing replaces yesterday only when received, regardless of an arbitrary 18:00 cutoff',()=>{
 const yesterday=record('Lent','2026-11-03',1200.25);
 assert.equal(model.latestHomeDayRevenue([yesterday],new Date('2026-11-04T19:00:00+01:00')).shops[3].amount,1200.25);
 const result=model.latestHomeDayRevenue([yesterday,record('Lent','2026-11-04',1400.45)],new Date('2026-11-04T17:50:00+01:00'));
 assert.equal(result.date,'2026-11-04');assert.equal(result.shops[3].amount,1400.45);
});
test('different report arrival times retain the actual date for every store',()=>{
 const result=model.latestHomeDayRevenue([record('Heyendaal','2026-11-04',900),record('Lent','2026-11-03',1200)],new Date('2026-11-04T19:00:00+01:00'));
 assert.equal(result.date,'2026-11-04');assert.equal(result.shops[3].date,'2026-11-03');
 assert.equal(result.shops[1].amount,null);assert.equal(result.shops.length,4);
});
test('no fabricated zero, weekly seeds, future dates, manual projections or invalid amounts',()=>{
 const records=[record('Lent','2026-11-05',99),record('Lent','2026-11-03',99,{source:'manual'}),record('Lent','2026-11-03',99,{source:'excel'}),record('Lent','2026-11-03',NaN),record('Lent','2026-02-31',100),record('Lent','2026-11-03',-3)];
 const result=model.latestHomeDayRevenue(records,new Date('2026-11-04'));assert.equal(result.date,null);assert(result.shops.every(row=>row.amount===null));
 const zero=model.latestHomeDayRevenue([record('Lent','2026-11-04',0)],new Date('2026-11-04'));assert.equal(zero.shops[3].amount,0);
});
test('Amsterdam labels roll from today to yesterday at midnight, including DST and year boundary',()=>{
 assert.equal(model.revenueDateLabel('2026-11-03',new Date('2026-11-03T22:59:00Z')),'vandaag · di 3 nov');
 assert.equal(model.revenueDateLabel('2026-11-03',new Date('2026-11-03T23:01:00Z')),'gisteren · di 3 nov');
 assert.equal(model.amsterdamDateKey(new Date('2026-07-03T22:01:00Z')),'2026-07-04');
 assert.match(model.revenueDateLabel('2026-12-31',new Date('2027-01-01T00:01:00+01:00')),/^gisteren/);
 assert.equal(model.revenueDateLabel('2026-10-31',new Date('2026-11-04')),'za 31 okt');
});
test('corrected copies use the most recent import without mutating stored records',()=>{
 const records=[record('Lent','2026-11-03',100,{updatedAt:'2026-11-04T09:00:00Z'}),record('Lent','2026-11-03',110,{updatedAt:'2026-11-04T10:00:00Z'})];const before=structuredClone(records);
 assert.equal(model.latestHomeDayRevenue(records,new Date('2026-11-04')).shops[3].amount,110);assert.deepEqual(records,before);
});
function endpoint(profile,storage={status:'wordpress'}){let reads=0;const api=load('app/api/home-day-revenue/route.ts',{
 'next/server':{NextResponse:{json:(body,init)=>Response.json(body,init)}},'@/app/lib/auth/session':{getCurrentProfile:async()=>profile},'@/app/lib/auth/access':access,
 '@/app/management/revenueHistoryServer':{getRevenueComparisonHistory:async()=>[]},
 '@/app/management/revenueServer':{getStoredRevenueData:async()=>{reads++;return{storage,data:{dailyRecords:[record('Lent','2026-11-03',1234.56,{note:'private note',messageId:'private-message'})],cashRecords:['private cash'],records:['private weekly']}};}},'@/app/management/homeDayRevenue':model,
 });return{get:api.GET,reads:()=>reads};}
test('only active management accounts can retrieve revenue; other users never trigger a data read',async()=>{
 for(const profile of [null,{active:false,role:'manager'},...['winkel','bakkerij','logistiek','medewerker'].map(role=>({active:true,role,permissions:{'management.view':true}}))]){
  const api=endpoint(profile),response=await api.get();assert.equal(response.status,403);assert.equal(api.reads(),0);assert.match(response.headers.get('cache-control'),/private, no-store/);
 }
 for(const role of ['admin','manager','management']){const api=endpoint({active:true,role});const response=await api.get();assert.equal(response.status,200);assert.equal(api.reads(),1);const data=await response.json();assert.equal(data.shops.length,4);assert.equal(data.shops[3].amount,1234.56);assert(!JSON.stringify(data).includes('private'));}
});
test('storage outage is not presented as a zero-turnover day or seeded data',async()=>{const api=endpoint({active:true,role:'manager'},{status:'seed'}),response=await api.get();assert.equal(response.status,503);assert.equal('shops' in await response.json(),false);});

function clientHarness(){
 let time='2026-11-03T22:59:00Z',cursor=0,mounted=false,status=200,payload=model.latestHomeDayRevenue([record('Lent','2026-11-03',1234.56)],new Date(time));
 const state=[],effects=[],intervals=[],listeners={},requests=[];
 class Clock extends Date{constructor(...args){super(...(args.length?args:[time]));}static now(){return new Date(time).getTime();}}
 const doc={visibilityState:'visible',addEventListener:(name,fn)=>listeners[name]=fn,removeEventListener:name=>delete listeners[name]};
 const window={setInterval:fn=>{intervals.push(fn);return intervals.length;},clearInterval:()=>{},setTimeout:()=>1,clearTimeout:()=>{},addEventListener:(name,fn)=>listeners[name]=fn,removeEventListener:name=>delete listeners[name]};
 const hooks={useState:initial=>{const i=cursor++;if(!(i in state))state[i]=initial;return[state[i],next=>state[i]=typeof next==='function'?next(state[i]):next];},useEffect:fn=>{if(!mounted)effects.push(fn);}};
 const client=load('app/HomeDayRevenue.tsx',{'react':hooks,'react/jsx-runtime':require('react/jsx-runtime'),'./management/homeDayRevenue':model},{Date:Clock,window,document:doc,AbortController,fetch:async(url,options)=>{requests.push({url,options});return{status,ok:status===200,json:async()=>payload};}});
 function render(){cursor=0;const element=client.default();if(!mounted){mounted=true;effects.splice(0).forEach(fn=>fn());}return element?require('react-dom/server').renderToStaticMarkup(element):'';}
 return{render,requests,advance:value=>{time=value;},status:value=>{status=value;},payload:value=>{payload=value;},hide:value=>{doc.visibilityState=value?'hidden':'visible';},tick:async()=>{intervals.forEach(fn=>fn());await new Promise(resolve=>setImmediate(resolve));},ready:async()=>{render();await new Promise(resolve=>setImmediate(resolve));},focus:async()=>{listeners.focus?.();await new Promise(resolve=>setImmediate(resolve));}};
}
test('open home screen polls, switches date at midnight and receives today without a page reload',async()=>{
 const h=clientHarness();await h.ready();assert.match(h.render(),/vandaag · di 3 nov/);assert.match(h.render(),/1\.234,56/);
 h.advance('2026-11-03T23:01:00Z');await h.tick();assert.match(h.render(),/gisteren · di 3 nov/);
 h.advance('2026-11-04T18:00:00+01:00');h.payload(model.latestHomeDayRevenue([record('Lent','2026-11-04',1500.75)],new Date('2026-11-04T18:00:00+01:00')));await h.tick();assert.match(h.render(),/vandaag · wo 4 nov/);assert.match(h.render(),/1\.500,75/);
 const count=h.requests.length;h.hide(true);await h.tick();assert.equal(h.requests.length,count);h.hide(false);await h.focus();assert.equal(h.requests.length,count+1);
});
test('lost access hides the widget; a network error keeps the last known figures with a compact status',async()=>{
 const h=clientHarness();await h.ready();h.status(503);await h.tick();assert.match(h.render(),/1\.234,56/);assert.match(h.render(),/Bijwerken lukt even niet/);
 h.status(403);await h.tick();assert.equal(h.render(),'');
});

test('week index compares the same shop seven days earlier with 100 as equal turnover',()=>{
 const rows=[record('Lent','2026-11-03',1100),record('Lent','2026-10-27',1000),record('Heyendaal','2026-10-27',20)];
 const result=model.latestHomeDayRevenue(rows,new Date('2026-11-04')).shops[3];
 assert.deepEqual(plain(result.week),{date:'2026-10-27',amount:1000,index:110});
 const equal=model.latestHomeDayRevenue([record('Lent','2026-11-03',1000),record('Lent','2026-10-27',1000)],new Date('2026-11-04')).shops[3];assert.equal(equal.week.index,100);
});
test('year index compares 52 weeks earlier, preserving weekday across leap years',()=>{
 for(const date of ['2026-11-03','2024-03-05','2027-01-01']){
  const reference=new Date(`${date}T12:00:00Z`);reference.setUTCDate(reference.getUTCDate()-364);
  const previous=reference.toISOString().slice(0,10);
  const row=model.latestHomeDayRevenue([record('Lent',date,900),record('Lent',previous,1000)],new Date(`${date}T19:00:00+01:00`)).shops[3];
  assert.equal(row.year.date,previous);assert.equal(row.year.index,90);assert.equal(reference.getUTCDay(),new Date(date).getUTCDay());
 }
});
test('missing or zero reference is no index, while zero current turnover is a valid index zero',()=>{
 const result=model.latestHomeDayRevenue([record('Lent','2026-11-03',1000),record('Lent','2026-10-27',0)],new Date('2026-11-04')).shops[3];assert.equal(result.week.index,null);assert.equal(result.week.amount,0);assert.equal(result.year.index,null);assert.equal(result.year.amount,null);
 const zero=model.latestHomeDayRevenue([record('Lent','2026-11-03',0),record('Lent','2026-10-27',1000)],new Date('2026-11-04')).shops[3];assert.equal(zero.week.index,0);
});
test('a delayed shop compares its own report date, not the date in the widget heading',()=>{
 const result=model.latestHomeDayRevenue([record('Heyendaal','2026-11-04',900),record('Lent','2026-11-03',1234.56),record('Lent','2026-10-27',1000)],new Date('2026-11-04T20:00:00+01:00'));
 assert.equal(result.date,'2026-11-04');assert.equal(result.shops[3].week.date,'2026-10-27');assert.equal(result.shops[3].week.index,123.5);
});
test('home screen shows compact index badges and offers year comparison when historical days exist',async()=>{
 const h=clientHarness();h.payload(model.latestHomeDayRevenue([record('Lent','2026-11-03',1100),record('Lent','2026-10-27',1000),record('Lent','2025-11-04',900)],new Date('2026-11-04')));await h.ready();
 const html=h.render();assert.match(html,/Index t.o.v./);assert.match(html,/vorig jaar/);assert.match(html,/Index 110 t.o.v. vorige week/);assert.match(html,/100 is gelijk/);
});

test('historical daily export feeds year comparisons without becoming current revenue',()=>{
 const history=[record('Lent','2025-11-04',1000,{source:'manual'}),record('Lent','2026-01-25',1200,{source:'manual'})];
 const empty=model.latestHomeDayRevenue([],new Date('2026-11-04'),history);assert.equal(empty.date,null);assert(empty.shops.every(row=>row.amount===null));
 const current=model.latestHomeDayRevenue([record('Lent','2026-11-03',1100)],new Date('2026-11-04'),history);assert.equal(current.shops[3].year.index,110);assert.equal(current.date,'2026-11-03');
});
test('app records override overlapping export dates even if the file was imported later',()=>{
 const current=record('Lent','2026-11-03',1100),baseline=record('Lent','2025-11-04',1000,{updatedAt:'2025-11-04T20:00:00Z'});
 const history=[record('Lent','2025-11-04',500,{updatedAt:'2026-11-04T10:00:00Z'})];
 assert.equal(model.latestHomeDayRevenue([current,baseline],new Date('2026-11-04'),history).shops[3].year.index,110);
});

test('private history reader normalizes stored daily rows and ignores unsupported schemas',async()=>{
 const revenueData=load('app/management/revenueData.ts');
 async function read(value,error=null){const calls=[];const chain={select:fields=>{calls.push(['select',fields]);return chain;},eq:(key,v)=>{calls.push([key,v]);return chain;},maybeSingle:async()=>({data:value?{value}:null,error})};
 const server=load('app/management/revenueHistoryServer.ts',{'../lib/supabase/admin':{createAdminClient:()=>({from:table=>{calls.push(['table',table]);return chain;}})},'./revenueData':revenueData});
 return {rows:await server.getRevenueComparisonHistory(),calls};}
 const result=await read({schema:1,records:[record('Lent','2025-12-29',1234.56),{date:'bad',shop:'unknown'}]});
 assert.equal(result.rows.length,1);assert.equal(result.rows[0].date,'2025-12-29');assert.equal(result.rows[0].year,2026);assert.equal(result.rows[0].amount,1234.56);
 assert(result.calls.some(([key,value])=>key==='key'&&value==='management_revenue_daily_history'));
 assert.equal((await read({schema:2,records:[record('Lent','2025-11-04',1000)]})).rows.length,0);
 assert.equal((await read(null,{message:'offline'})).rows.length,0);
});
