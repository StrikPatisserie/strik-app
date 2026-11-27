const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const sharp = require('sharp');
function load(file, imports = {}, globals = {}) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(file,'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
  vm.runInNewContext(code, {exports, require:name=>imports[name] || require(name), URL, Request, Response, Buffer, AbortSignal, ...globals});
  return exports;
}
const colours = load('app/lib/photoBackgroundColor.ts');
test('an even edge colour is preserved, while a busy photo is not called uniform', () => {
  const pixels = new Uint8Array(80*80*3);
  for(let i=0;i<80*80;i++) pixels.set([255,220,0],i*3);
  assert.equal(colours.photoBackgroundColor(pixels,80,80).color,'#ffdc00');
  assert.equal(colours.photoBackgroundColor(pixels,80,80).uniform,true);
  for(let i=0;i<80*80;i++) pixels.set([i%255,(i*7)%255,(i*23)%255],i*3);
  assert.equal(colours.photoBackgroundColor(pixels,80,80).uniform,false);
});
test('only fixed webshop upload URLs are accepted', () => {
  assert.equal(colours.allowedPhotoColorUrl('https://webshop.strik-patisserie.nl/Media/userupload/13340.jpg'),true);
  for(const url of ['http://webshop.strik-patisserie.nl/Media/userupload/1.jpg','https://localhost/1.jpg','https://webshop.strik-patisserie.nl.evil.test/Media/userupload/1.jpg','https://webshop.strik-patisserie.nl:444/Media/userupload/1.jpg','https://user:password@webshop.strik-patisserie.nl/Media/userupload/1.jpg','https://webshop.strik-patisserie.nl/Media/userupload/1.jpg?url=http://localhost','https://webshop.strik-patisserie.nl/admin','file:///etc/passwd']) assert.equal(colours.allowedPhotoColorUrl(url),false,url);
});
const route = (profile,fetch) => load('app/api/bakkerij-logistiek/webshop-images/background-color/route.ts', {
  '@/app/lib/auth/session': {getCurrentProfile:async()=>profile}, '@/app/lib/photoBackgroundColor':colours,
}, {fetch});
const request = url => new Request('https://app.example/api/background-color',{method:'POST',body:JSON.stringify({url})});
const url = 'https://webshop.strik-patisserie.nl/Media/userupload/13340.jpg';
test('colour endpoint checks authentication and URL before fetching',async()=>{
  let fetched=0;
  const fetch=async()=>{fetched++;throw Error('unexpected')};
  assert.equal((await route(null,fetch).POST(request(url))).status,403);
  assert.equal((await route({active:true},fetch).POST(request('https://localhost/1.jpg'))).status,400);
  assert.equal(fetched,0);
});
test('colour endpoint decodes the real image bytes and forbids redirects',async()=>{
  const bytes=await sharp({create:{width:30,height:20,channels:3,background:'#ffdc00'}}).png().toBuffer();
  const handler=route({active:true},async(_,options)=>{assert.equal(options.redirect,'error');return new Response(bytes)});
  const result=await handler.POST(request(url));
  assert.equal(result.status,200);
  assert.deepEqual(await result.json(),{color:'#ffdc00',uniform:true});
});
test('oversized and invalid source files fail without returning an invented colour',async()=>{
  const large=route({active:true},async()=>new Response('x',{headers:{'content-length':'9000000'}}));
  assert.equal((await large.POST(request(url))).status,422);
  const invalid=route({active:true},async()=>new Response('not an image'));
  assert.equal((await invalid.POST(request(url))).status,422);
});
