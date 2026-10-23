const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');
const exportsObject = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('app/lib/businessWebsite.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:exportsObject});
test('the published business page uses the existing website canonical, indexable metadata and public sharing image',()=>{
  const meta = exportsObject.businessPageMetadata();
  assert.equal(meta.alternates.canonical,'https://strik-patisserie.nl/zakelijk/');
  assert.equal(meta.openGraph.url,meta.alternates.canonical);
  assert.equal(meta.openGraph.locale,'nl_NL');
  assert.equal(meta.robots.index,true);
  assert.equal(meta.manifest,null);
  assert.match(meta.openGraph.images[0].url,/^https:\/\/app.strik-patisserie.nl\/zakelijk\/.+\.webp$/);
});
test('business structured data connects to the existing Strik organization and website',()=>{
  const graph = exportsObject.businessPageSchema()['@graph'];
  const page = graph.find(item=>item['@type']==='WebPage');
  const service = graph.find(item=>item['@type']==='Service');
  const crumbs = graph.find(item=>item['@type']==='BreadcrumbList');
  assert.equal(page.url,exportsObject.BUSINESS_WEBSITE_URL);
  assert.equal(page.isPartOf['@id'],'https://strik-patisserie.nl/#website');
  assert.equal(service.provider['@id'],'https://strik-patisserie.nl/#organization');
  assert.equal(crumbs.itemListElement.at(-1).item,page.url);
});
