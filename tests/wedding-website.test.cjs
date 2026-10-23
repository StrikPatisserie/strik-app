const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');
function load(file, dependencies = {}) {
  const exports = {};
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  vm.runInNewContext(source, {exports,Request,Response,URL,encodeURIComponent,require:name=>dependencies[name]});
  return exports;
}
const site = load('app/lib/weddingPublicSite.ts');
const request = origin => new Request('https://app.strik-patisserie.nl/api/wedding-appointments/book', {headers:origin?{origin}:{}});
test('only the exact Strik website and the API own origin can book; private APIs keep their existing guard', () => {
  for (const origin of ['https://strik-patisserie.nl','https://app.strik-patisserie.nl']) assert.equal(site.weddingPublicOriginAllowed(request(origin)),true);
  for (const origin of [null,'null','https://other.example','https://strik-patisserie.nl.attacker.example','http://strik-patisserie.nl']) {
    assert.equal(site.weddingPublicOriginAllowed(request(origin)),false);
    assert.equal(site.weddingPublicOptions(request(origin)).status,403);
    assert.equal(site.weddingPublicJson(request(origin),{}).headers.get('Access-Control-Allow-Origin'),null);
  }
  assert.match(fs.readFileSync('app/lib/weddingServer.ts','utf8'), /request.headers.get\("origin"\) === new URL\(request.url\).origin/);
});
test('website preflight and error responses support JSON without sharing session credentials or caching availability', () => {
  const req = request('https://strik-patisserie.nl');
  const preflight = site.weddingPublicOptions(req);
  assert.equal(preflight.status,204);
  assert.equal(preflight.headers.get('Access-Control-Allow-Origin'),'https://strik-patisserie.nl');
  assert.equal(preflight.headers.get('Access-Control-Allow-Headers'),'Content-Type');
  assert.equal(preflight.headers.get('Access-Control-Allow-Credentials'),null);
  const failure = site.weddingPublicJson(req,{message:'Tijdvak bezet'},409);
  assert.equal(failure.status,409);
  assert.equal(failure.headers.get('Access-Control-Allow-Origin'),'https://strik-patisserie.nl');
  assert.equal(failure.headers.get('Cache-Control'),'private, no-store');
  assert.equal(failure.headers.get('Vary'),'Origin');
});
test('website image loader keeps responsive image sizes on the app CDN; SVG stays a direct public asset', () => {
  const image = load('app/bruidstaarten/BridalImage.tsx',{'react/jsx-runtime':{jsx:(type,props)=>({type,props})},'next/image':{default:'Image'},'../lib/weddingPublicSite':site}).default;
  const props={src:'/bruidstaarten/voorbeeld-1.webp',alt:'Bruidstaart',fill:true,sizes:'50vw'};
  assert.equal(image(props).props.loader,undefined);
  const result=image({...props,website:true});
  assert.equal(result.props.sizes,'50vw');
  assert.equal(result.props.loader({src:props.src,width:750,quality:75}),'https://app.strik-patisserie.nl/_next/image?url=%2Fbruidstaarten%2Fvoorbeeld-1.webp&w=750&q=75');
  const svg=image({src:'/icons_strik_bruidstaart.svg',alt:'',website:true});
  assert.equal(svg.props.src,'https://app.strik-patisserie.nl/icons_strik_bruidstaart.svg');
  assert.equal(svg.props.unoptimized,true);
});
