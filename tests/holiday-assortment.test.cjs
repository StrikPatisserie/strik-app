const {test}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function load(file,imports={},globals={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,Date,Intl,Buffer,URL,Response,FormData,File,Error,AbortSignal,require:name=>Object.hasOwn(imports,name)?imports[name]:require(name),...globals});return exports;}
const model=load('app/feestdagen/model.ts'),products=load('app/feestdagen/assortment.ts',{'./model':model});
const card=(path='sinterklaas/speculaastaartje',extra='')=>`<a class="product" href="/assortiment/${path}"><img src="/images/products/taart.jpg"><span class="productButtonProductName">Sint &amp; speculaastaartje</span><div class="from">${extra}</div><div class="large">&euro;<span> </span>19</div><div class="small">95</div></a>`;
function importer(overrides={},globals={}){return load('app/feestdagen/assortment-import.server.ts',{'server-only':{},'../kerst-voor-bedrijven/christmasProducts':{christmasProducts:[]},'./model':model,'./server':{},'./assortment.server':{},...overrides},globals);}
test('season product prices preserve cents and VAT and reject ambiguous amounts',()=>{
 const good={name:' Speculaastaart ',variant:'6 personen',category:'Taart',price:'19,95',priceIncludesVat:true};
 assert.equal(products.validateProduct(good).price_cents,1995);
 assert.equal(products.validateProduct({...good,price:'0.50',priceIncludesVat:false}).price_includes_vat,false);
 for(const price of ['','-1','1e3','12,345','NaN','100001','1.234,56'])assert.throws(()=>products.validateProduct({...good,price}));
 for(const delta of [{name:''},{category:'Onbekend'},{priceIncludesVat:null},{variant:'x'.repeat(501)}])assert.throws(()=>products.validateProduct({...good,...delta}));
});
test('webshop capture keeps category, price and photo together, rejects unrelated products and deduplicates',()=>{
 const rows=importer().parseSeasonWebshop(card()+card()+card('kerst/taart')+card('sinterklaas/andere-taart','<span>vanaf</span>'),'sinterklaas');
 assert.equal(rows.length,2);assert.equal(rows[0].name,'Sint & speculaastaartje');assert.equal(rows[0].price_cents,1995);assert.equal(rows[0].category,'Taart');assert.equal(rows[0].image,'https://webshop.strik-patisserie.nl/images/products/taart.jpg');assert.match(rows[1].variant,/Vanafprijs/);
 assert.equal(importer().parseSeasonWebshop(card().replace('/images/products/taart.jpg','https://elsewhere.invalid/a.jpg'),'sinterklaas').length,0);
});
test('import never applies current prices to past years and never replaces a captured product',async()=>{
 let uploads=0,inserts=0;
 const api=importer({'./assortment.server':{editableAssortment:async()=>{},readAssortment:async()=>[{source_key:'webshop:/assortiment/sinterklaas/speculaastaartje'}],storeSeasonFile:async()=>{uploads++;}},'./server':{seasonDb:()=>({from:()=>({insert:async()=>{inserts++;return {error:null};}})})}},{fetch:async()=>new Response(card())});
 await assert.rejects(api.importSeasonProducts('sint',model.amsterdamYear()-1,'webshop',null),/huidige jaar/);
 const result=await api.importSeasonProducts('sint',model.amsterdamYear(),'webshop',null);assert.equal(result.skipped,1);assert.equal(uploads,0);assert.equal(inserts,0);
});
test('file capture checks bytes, separates photos from documents and limits downloads',async()=>{
 const api=load('app/feestdagen/assortment.server.ts',{'server-only':{},'./server':{},'./assortment':products});
 assert.equal(api.detectSeasonFile(Buffer.from([255,216,255,1]),'image.exe','photo').type,'image/jpeg');
 assert.equal(api.detectSeasonFile(Buffer.from('%PDF-1.7'),'assortiment.pdf','document').ext,'pdf');
 assert.throws(()=>api.detectSeasonFile(Buffer.from('%PDF-1.7'),'fake.jpg','photo'));
 assert.throws(()=>api.detectSeasonFile(Buffer.from('<script>'),'fake.png','photo'));
 await assert.rejects(importer().limitedResponse(new Response('12345'),4),/te groot/);
});
function actionHarness({authorized=true,closed=false,conflict=false,updated=true}={}){
 let patch=null,uploaded=0,dbCalls=0;const filters=[];
 const query={select(){return this;},eq(k,v){filters.push([k,v]);return this;},update(p){patch=p;return this;},maybeSingle:async()=>({data:patch?(updated?{id:'product'}:null):(conflict?null:{photo_id:'original-photo'}),error:null})};
 const api=load('app/feestdagen/assortment-actions.ts',{'next/cache':{revalidatePath(){}},'../lib/auth/session':{requireAdminProfile:async()=>{if(!authorized)throw Error('login');return {id:'manager'};}},'./server':{seasonDb:()=>{dbCalls++;return {from:()=>query};}},'./assortment':products,'./assortment.server':{editableAssortment:async()=>{if(closed)throw Error('afgesloten');},storeSeasonFile:async()=>{uploaded++;return 'new-photo';}},'./assortment-import.server':{}});
 const form=new FormData();for(const [k,v] of Object.entries({id:'product',revision:'4',name:'Taart',variant:'6 personen',category:'Taart',price:'19,95',vat:'incl'}))form.set(k,v);
 return {api,form,read:()=>({patch,uploaded,dbCalls,filters})};
}
test('changing a price retains the captured photo and scopes the write to season, year and revision',async()=>{
 const h=actionHarness();const r=await h.api.saveSeasonProduct('sint',2026,h.form);assert.equal(r.ok,true);assert.equal(h.read().patch.photo_id,'original-photo');assert.equal(h.read().patch.price_cents,1995);assert.equal(h.read().uploaded,0);
 for(const [key,value] of [['season','sint'],['year',2026],['revision',4]])assert(h.read().filters.some(f=>f[0]===key&&f[1]===value));
});
test('unauthorized, closed, stale and invalid VAT edits cannot save',async()=>{
 const unauthorized=actionHarness({authorized:false});await assert.rejects(unauthorized.api.saveSeasonProduct('sint',2026,unauthorized.form),/login/);assert.equal(unauthorized.read().dbCalls,0);
 for(const options of [{closed:true},{conflict:true},{updated:false}]){const h=actionHarness(options);assert.notEqual((await h.api.saveSeasonProduct('sint',2026,h.form)).ok,true);}
 const h=actionHarness();h.form.set('vat','anything');assert.notEqual((await h.api.saveSeasonProduct('sint',2026,h.form)).ok,true);assert.equal(h.read().patch,null);
});
test('private file route only serves documents to management and reports missing storage safely',async()=>{
 let profile=null,kind='photo',downloaded=0,missing=false;
 const api=load('app/api/feestdagen/bestanden/[id]/route.ts',{'@/app/lib/auth/session':{getCurrentProfile:async()=>profile},'@/app/lib/auth/access':{canAccessPath:()=>true,hasFullAccess:p=>p.admin},'@/app/feestdagen/assortment.server':{SEASON_BUCKET:'private'},'@/app/feestdagen/server':{seasonDb:()=>({from:()=>({select(){return this;},eq(){return this;},maybeSingle:async()=>({data:{kind,name:'photo.jpg',content_type:'image/jpeg',storage_path:'saved/photo.jpg'},error:null})}),storage:{from:()=>({download:async()=>{downloaded++;return {data:missing?null:new Blob(['photo']),error:null};}})}})}});
 const get=()=>api.GET(null,{params:Promise.resolve({id:'12345678-1234-1234-1234-123456789012'})});
 assert.equal((await get()).status,403);assert.equal(downloaded,0);
 profile={active:true,admin:false};assert.equal((await get()).status,200);
 kind='document';assert.equal((await get()).status,403);assert.equal(downloaded,1);
 profile.admin=true;const response=await get();assert.equal(response.status,200);assert.match(response.headers.get('Content-Disposition'),/^attachment/);assert.equal(response.headers.get('Cache-Control'),'private, max-age=300');
 missing=true;assert.equal((await get()).status,503);
});
