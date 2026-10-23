const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, imports = {}, globals = {}, expose = '') {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(code + '\n' + expose, { exports, require: name => name in imports ? imports[name] : name === 'server-only' ? {} : require(name), URL, Request, Response, Buffer, Date, ...globals });
  return exports;
}
const extraction = load('app/lib/webshopPhotoExtraction.ts');
const identity = load('app/bakkerij/logistiek/webshopPhotoIdentity.ts');
const row = (name, url, quantity = 1, product = 'Cremetaart Confetti 10-12p') => `<tr><td>${product}<ul><li>Wilt u een foto/logo op de taart?: ${name} (+€ 7.50)<br>${url ? `<img src="${url}">` : ''}</li><li>Vulling: witte chocolade framboos</li></ul></td><td>${quantity}</td><td>€38.50</td></tr>`;
const mail = (bodyHtml, extra = {}) => ({ bodyHtml, bodyText: '', photoUrl: '', fileName: '', productSummary: '', links: [], imageAttachments: [], ...extra });
const two = () => mail(`<img src="https://shop.invalid/logo-strik.png"><table>${row('foto-een.jpeg', 'https://shop.invalid/uploads/foto-een.jpeg')}${row('foto-twee.jpeg', 'https://shop.invalid/uploads/foto-twee.jpeg')}</table>`);
const image = (id, extra = {}) => ({ id, messageId: 'mail-1', orderNumber: '79000', deliveryDate: new Date().toISOString().slice(0,10), customerName: 'Voorbeeldklant', photoUrl: `https://shop.invalid/${id}.jpeg`, sourceUrl: '', fileName: `${id}.jpeg`, productSummary: 'Cremetaart Confetti 10-12p', receivedAt: new Date().toISOString(), importedAt: new Date().toISOString(), subject: '', from: '', confidence: 'hoog', notes: [], ...extra });

test('two identical cakes with different uploads retain both images, line identities and quantities', () => {
  const parsed = extraction.extractWebshopPhotos(two());
  assert.equal(parsed.complete, true); assert.equal(parsed.entries.length, 2); assert.equal(parsed.expectedCount, 2);
  assert.equal(parsed.entries[0].fileName, 'foto-een.jpeg'); assert.equal(parsed.entries[1].fileName, 'foto-twee.jpeg');
  assert.notEqual(parsed.entries[0].sourceLineId, parsed.entries[1].sourceLineId);
  assert(parsed.entries.every(entry => entry.productQuantity === 1 && entry.productSummary === 'Cremetaart Confetti 10-12p'));
  assert(!parsed.entries.some(entry => entry.photoUrl.includes('logo-strik')));
});
test('nested layout tables and repeated plain/html representations do not duplicate uploads', () => {
  const input = two(); input.bodyHtml = `<table><tr><td>${input.bodyHtml}</td></tr></table>`; input.bodyText = 'Foto/logo: foto-een.jpeg\nFoto/logo: foto-twee.jpeg';
  const parsed = extraction.extractWebshopPhotos(input); assert.equal(parsed.entries.length, 2); assert.equal(parsed.complete, true);
});
test('same file name in different product rows resolves against that row rather than the whole mail', () => {
  const parsed = extraction.extractWebshopPhotos(mail(`<table>${row('foto.jpg','https://shop.invalid/a/foto.jpg')}${row('foto.jpg','https://shop.invalid/b/foto.jpg')}</table>`));
  assert.equal(parsed.entries.length,2); assert.notEqual(parsed.entries[0].photoUrl,parsed.entries[1].photoUrl);
});
test('same photo used on two separate product rows stays two independent line allocations', () => {
  const parsed = extraction.extractWebshopPhotos(mail(`<table>${row('foto.jpg','https://shop.invalid/foto.jpg')}${row('foto.jpg','https://shop.invalid/foto.jpg')}</table>`));
  assert.equal(parsed.entries.length,2); assert.notEqual(parsed.entries[0].sourceLineId,parsed.entries[1].sourceLineId);
});
test('a missing second photo never falls back to the first photo or the shop logo', () => {
  const input = two(); input.bodyHtml = input.bodyHtml.replace('<img src="https://shop.invalid/uploads/foto-twee.jpeg">','');
  const parsed = extraction.extractWebshopPhotos(input); assert.equal(parsed.complete,false); assert.equal(parsed.expectedCount,2); assert.equal(parsed.entries.length,1); assert.deepEqual(Array.from(parsed.missing),['foto-twee.jpeg']);
});
test('matching attachments can resolve CID images, while ambiguous files stay unresolved', () => {
  const input = mail(`<table>${row('foto.jpg','cid:photo-1')}</table>`,{imageAttachments:[{fileName:'foto.jpg',dataUrl:'data:image/jpeg;base64,AQID'}]});
  assert.equal(extraction.extractWebshopPhotos(input).entries[0].photoUrl,'data:image/jpeg;base64,AQID');
  input.imageAttachments.push({fileName:'foto.jpg',dataUrl:'data:image/jpeg;base64,BAUG'});
  assert.equal(extraction.extractWebshopPhotos(input).complete,false);
});
test('metadata in dt/dd, escaped download parameters and HTML-only non-table mails are supported', () => {
  const parsed = extraction.extractWebshopPhotos(mail('<p>Foto/logo:</p><p>familie.jpeg</p><a href="https://shop.invalid/download?file=familie.jpeg&amp;token=x">Download</a>'));
  assert.equal(parsed.complete,true); assert.match(parsed.entries[0].photoUrl,/file=familie.jpeg&token=x/);
  const table = extraction.extractWebshopPhotos(mail('<table><tr><td>Cremetaart 10-12p<dl><dt>Foto/logo:</dt><dd>familie.jpeg <img src="https://shop.invalid/familie.jpeg"></dd></dl></td><td>2</td></tr></table>'));
  assert.equal(table.entries[0].productQuantity,2);
});
test('no upload signal means a decorative image is not silently imported as a customer photo', () => {
  assert.equal(extraction.extractWebshopPhotos(mail('<img src="https://shop.invalid/logo-strik.png">')).complete,false);
});
test('duplicate identity compares the whole image, preserves URL case and separates order lines', () => {
  const prefix = 'data:image/jpeg;base64,' + 'A'.repeat(5000);
  assert.notEqual(identity.webshopPhotoDuplicateKey(image('same',{photoUrl:prefix+'AAAA'})),identity.webshopPhotoDuplicateKey(image('same',{photoUrl:prefix+'BBBB'})));
  assert.notEqual(identity.webshopPhotoDuplicateKey(image('same',{sourceLineId:'line-1'})),identity.webshopPhotoDuplicateKey(image('same',{sourceLineId:'line-2'})));
  assert.notEqual(identity.webshopPhotoDuplicateKey(image('same',{photoUrl:'https://shop.invalid/A.jpg'})),identity.webshopPhotoDuplicateKey(image('same',{photoUrl:'https://shop.invalid/a.jpg'})));
});
function storageHarness(initial = []) {
  let stored = {images:initial}, writes = 0;
  const client = {from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:{value:stored}})})}),upsert:async row=>{stored=JSON.parse(JSON.stringify(row.value));writes++;return {};}})};
  const storage = load('app/lib/bakeryLogisticsStorage.ts', {'./supabase/admin':{createAdminClient:()=>client},'@/app/bakkerij/logistiek/webshopPhotoIdentity':identity,'@/app/bakkerij/logistiek/sinterklaasAcquisitionCampaign':{} });
  return {storage,get stored(){return stored;},get writes(){return writes;}};
}
test('one mail stores all photos in one write; retries preserve both without duplicates', async()=>{
  const harness = storageHarness(); const incoming = [image('first',{sourceLineId:'line-1'}),image('second',{sourceLineId:'line-2'})];
  await harness.storage.upsertLogisticsWebshopImages(incoming); assert.equal(harness.stored.images.length,2); assert.equal(harness.writes,1);
  await harness.storage.upsertLogisticsWebshopImages(incoming); assert.equal(harness.stored.images.length,2);
});
test('separate sequential single-photo imports from the same message never overwrite each other',async()=>{
  const harness=storageHarness(); await harness.storage.upsertLogisticsWebshopImage(image('first')); await harness.storage.upsertLogisticsWebshopImage(image('second')); assert.equal(harness.stored.images.length,2);
});
test('reimport upgrades a legacy first photo while retaining its print identity and manual receipt link',async()=>{
  const legacy=image('first',{matchedReceiptId:'receipt-1',matchSource:'manual'}); const harness=storageHarness([legacy]);
  const saved=await harness.storage.upsertLogisticsWebshopImages([image('new-first',{photoUrl:legacy.photoUrl,sourceLineId:'line-1'}),image('second',{sourceLineId:'line-2'})],{preserveManualMatch:true});
  assert.equal(saved[0].id,legacy.id); assert.equal(saved[0].matchedReceiptId,'receipt-1'); assert.equal(harness.stored.images.length,2);
});
function routeHarness(allowed=true){
  let saved=[]; const route=load('app/api/bakkerij-logistiek/webshop-images/import/route.ts',{'next/server':{NextResponse:Response},'@/app/lib/bakeryLogisticsAuth':{canAccessLogisticsRequest:async()=>allowed},'@/app/lib/bakeryLogisticsStorage':{upsertLogisticsWebshopImages:async images=>{saved=images;return images;}},'@/app/lib/webshopPhotoExtraction':extraction});
  return {route,get saved(){return saved;}};
}
const request=(input,query='')=>new Request(`https://app.invalid/api/bakkerij-logistiek/webshop-images/import${query}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messageId:'mail-1',deliveryDate:new Date().toISOString().slice(0,10),orderNumber:'79000',customerName:'Voorbeeldklant',...input})});
test('import API returns and stores two photos with a complete count; dry-run writes nothing',async()=>{
  const h=routeHarness(); const response=await h.route.POST(request(two())); const data=await response.json(); assert.equal(response.status,200);assert.equal(data.complete,true);assert.equal(data.images.length,2);assert.equal(h.saved.length,2);assert.equal(data.expectedPhotoCount,2);assert.equal(data.importedPhotoCount,2);
  const dry=routeHarness();await dry.route.POST(request(two(),'?dryRun=1'));assert.equal(dry.saved.length,0);
});
test('partial import returns 422 and carries visible warnings on every stored photo',async()=>{
  const input=two();input.bodyHtml=input.bodyHtml.replace('<img src="https://shop.invalid/uploads/foto-twee.jpeg">','');
  const h=routeHarness();const response=await h.route.POST(request(input));const data=await response.json();assert.equal(response.status,422);assert.equal(data.complete,false);assert.equal(h.saved.length,1);assert.equal(h.saved[0].expectedPhotoCount,2);assert(h.saved[0].importWarnings.length);
});
test('truncated mails cannot be reported complete and unauthorized imports do not write',async()=>{
  const h=routeHarness();const response=await h.route.POST(request({...two(),bodyText:'x'.repeat(100001)}));assert.equal(response.status,422);assert(h.saved[0].importWarnings.length);
  const denied=routeHarness(false);assert.equal((await denied.route.POST(request(two()))).status,403);assert.equal(denied.saved.length,0);
});

test('the anonymized production invoice layout preserves both long filenames and separate image rows',()=>{
 const input=mail(fs.readFileSync('tests/fixtures/webshop-two-cake-photos.html','utf8'));
 const parsed=extraction.extractWebshopPhotos(input);assert.equal(parsed.complete,true);assert.equal(parsed.entries.length,2);assert(parsed.entries.every(entry=>entry.fileName.length===41&&entry.productQuantity===1&&entry.productSummary==='Cremetaart Confetti 10-12p'));
});

test('an announced second upload without a filename is not silently omitted',()=>{
 const parsed=extraction.extractWebshopPhotos(mail(`<table>${row('foto-een.jpeg','https://shop.invalid/foto-een.jpeg')}<tr><td>Cremetaart Confetti 10-12p<ul><li>Wilt u een foto/logo op de taart?: Ja</li></ul></td><td>1</td><td>38.50</td></tr></table>`));
 assert.equal(parsed.complete,false);assert.equal(parsed.expectedCount,2);assert.equal(parsed.entries.length,1);
});
test('the original download link is preferred over a resized preview for the same file',()=>{
 const parsed=extraction.extractWebshopPhotos(mail(`<table>${row('foto.jpg','https://shop.invalid/foto.jpg?width=300').replace('<img','<a href="https://shop.invalid/foto.jpg">Download</a><img')}</table>`));
 assert.equal(parsed.complete,true);assert.equal(parsed.entries[0].photoUrl,'https://shop.invalid/foto.jpg');
});
function gmailRun(results) {
 const properties=new Map(),events=[],messages=results.map((_,i)=>({getId:()=>`mail-${i}`,getBody:()=>'<p>Foto/logo: foto.jpeg</p>',getPlainBody:()=>'',getSubject:()=>'',getFrom:()=>'',getDate:()=>new Date(),getAttachments:()=>[]}));
 let next=0;
 const thread={getMessages:()=>messages,addLabel:label=>events.push(`add:${label.name}`),removeLabel:label=>events.push(`remove:${label.name}`),moveToArchive:()=>events.push('archive')};
 const props={getProperty:key=>properties.get(key),setProperty:(key,value)=>properties.set(key,value),deleteProperty:key=>properties.delete(key)};
 const context={Date,console:{error:()=>{}},Logger:{log:()=>{}},PropertiesService:{getScriptProperties:()=>props},GmailApp:{search:query=>query.includes('in:inbox')?[]:[thread],getUserLabelByName:name=>({name})},UrlFetchApp:{fetch:()=>{const result=results[next++];return {getResponseCode:()=>result.status||200,getContentText:()=>JSON.stringify(result.data)};}}};
 vm.runInNewContext(fs.readFileSync('app/scripts/gmail-webshop-images-import.gs','utf8'),context);context.importWebshopAfbeeldingen();return {events,properties};
}
const completeResponse={ok:true,complete:true,images:[{id:'one'},{id:'two'}],expectedPhotoCount:2,importedPhotoCount:2};
test('Gmail marks a mail processed only after the API confirms all expected photos',()=>{
 const result=gmailRun([{data:completeResponse}]);assert(result.events.includes('add:Ingelezen'));assert(result.events.includes('archive'));assert(result.properties.has('webshop-image:multi-photo-v5:mail-0'));
});
test('Gmail does not archive or mark a partial or unconfirmed response processed, even with HTTP 200',()=>{
 for(const data of [{...completeResponse,complete:false},{...completeResponse,importedPhotoCount:1},{ok:true,image:{id:'one'}}]){
  const result=gmailRun([{data}]);assert(!result.events.includes('archive'));assert(result.events.includes('add:Fout'));assert(!result.properties.has('webshop-image:multi-photo-v5:mail-0'));
 }
});
test('a thread containing both a complete and a failed import stays out of the processed archive',()=>{
 const result=gmailRun([{data:completeResponse},{status:422,data:{ok:false,complete:false,message:'Tweede foto ontbreekt'}}]);assert(!result.events.includes('archive'));assert(result.events.includes('remove:Ingelezen'));assert(result.events.includes('add:Fout'));
});

test('missing message identifiers cannot merge separate orders merely because their photo URL or line number matches',async()=>{
 const harness=storageHarness();await harness.storage.upsertLogisticsWebshopImages([image('one',{messageId:'',orderNumber:'79000',sourceLineId:'line-1'}),image('two',{messageId:'',orderNumber:'79001',sourceLineId:'line-1',photoUrl:'https://shop.invalid/one.jpeg'})]);assert.equal(harness.stored.images.length,2);
});
