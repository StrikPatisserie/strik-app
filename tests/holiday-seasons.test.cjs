const {test}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function load(file,imports={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,Date,Intl,require:name=>imports[name]||require(name)});return exports;}
const model=load('app/feestdagen/model.ts');
const year=model.amsterdamYear()+1;
const config={...model.emptyConfig(year),owner:'Teamleider',startDate:`${year}-10-01`,endDate:`${year}-12-05`,assortment:'Melk, puur en wit',pricesChecked:true,letters:true,business:true,mailing:true,batches:[{start:`${year}-11-02`,date:`${year}-11-03`,deadline:`${year}-11-01T20:00`,pickup:`${year}-11-05`}]};
test('new season requires real dates, responsible person, assortment and reviewed prices',()=>{
 assert.equal(model.validateSetup('sint',year,config).batches.length,1);
 for(const delta of [{owner:''},{pricesChecked:false},{assortment:''},{startDate:`${year}-02-31`},{endDate:`${year}-01-01`},{letters:'yes'}])assert.throws(()=>model.validateSetup('sint',year,{...config,...delta}));
 assert.throws(()=>model.validateSetup('pasen',year,config));
 assert.doesNotThrow(()=>model.validateSetup('pasen',year,{...config,letters:false,business:false,mailing:false,batches:[]}));
});
test('production rounds cannot silently overlap, miss the deadline or deliver after Sint',()=>{
 for(const batches of [[],[config.batches[0],config.batches[0]],[{...config.batches[0],deadline:`${year}-11-02T20:00`}],[{...config.batches[0],pickup:`${year}-12-06`}],[{...config.batches[0],deadline:`${year}-11-01T25:00`}]] )assert.throws(()=>model.validateSetup('sint',year,{...config,batches}));
});
test('summary separates store/online channels, cancellations and combined B2B money',()=>{
 const sources={letters:[{id:'s',lines:[{quantity:4}],totalCents:6575,delivery:{},pickedUp:true},{id:'x',status:'geannuleerd',lines:[{quantity:99}],totalCents:9900}],b2b:[{status:'akkoord',totalExVat:'100',season:'sint',delivered:true},{status:'akkoord',totalExVat:'200',season:'sint-kerst',delivered:false},{status:'offerte',totalExVat:'400'}],mailing:[]};
 const central={orders:[{id:'web',channel:'ONLINE',fulfillment_status:'NEW',gift_wrap:true,gift_wrap_price_cents:25},{id:'store-duplicate',channel:'STORE'}],items:[{order_id:'web',quantity:2,unit_price_cents:1395},{order_id:'store-duplicate',quantity:99,unit_price_cents:100}]};
 const s=model.seasonSummary(sources,central);assert.equal(s.storeLetters,4);assert.equal(s.onlineLetters,2);assert.equal(s.onlineValue,28.4);assert.equal(s.b2bValueExVat,100);assert.equal(s.combinedOrders,1);assert.equal(s.openCount,2);
});
test('closure requires explicit review and preserves optional notes',()=>{
 assert.throws(()=>model.validateClosure({good:'Goed',improve:'Sneller',next:'Extra ronde',reviewed:false,exceptions:''}));
 assert.doesNotThrow(()=>model.validateClosure({good:'',improve:'',next:'',reviewed:true,exceptions:''}));
 assert.equal(model.validateClosure({good:'Goed',improve:'Sneller',next:'Extra ronde',reviewed:true,exceptions:''}).next,'Extra ronde');
});
test('old tabs cannot modify closed, future or disabled modules; mixed B2B can finish in the active holiday',async()=>{
 let state={state:'active',config:{letters:true,business:true,mailing:true}};
 const db={from:()=>({select:()=>({eq:()=>({eq:()=>({maybeSingle:async()=>({data:state,error:null})})})})})};
 const api=load('app/feestdagen/server.ts',{'server-only':{},'@/app/lib/supabase/admin':{createAdminClient:()=>db},'./model':model});
 await api.checkSeasonMutation('sinterklaas-letter-orders',{year:2026});
 for(const next of [null,{state:'closed',config:{letters:true}},{state:'closing',config:{letters:true}},{state:'active',config:{letters:false}}]){state=next;await assert.rejects(api.checkSeasonMutation('sinterklaas-letter-orders',{year:2026}));}
});
test('shared holiday entrance preserves business access boundaries',()=>{
 const access=load('app/lib/auth/access.ts'),shop={active:true,role:'winkel',email:'strikpatisserieheyendaal@gmail.com',store:'heyendaal',permissions:{}};
 assert.equal(access.canAccessPath(shop,'/feestdagen'),true);assert.equal(access.canAccessPath(shop,'/feestdagen/sint/start'),false);assert.equal(access.canAccessPath(shop,'/feestdagen/bedrijven'),false);
 assert.equal(access.canAccessPath({...shop,role:'admin'},'/feestdagen/sint/start'),true);
});
