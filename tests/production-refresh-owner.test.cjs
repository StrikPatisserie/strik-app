const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
test('global auto refresh delegates production pages to the guarded planner and leaves production forms untouched',async()=>{
 const code=ts.transpileModule(fs.readFileSync('app/AutoUpdateRefresh.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 for(const production of [true,false]){
  const exports={};let requests=0,reloads=0;
  vm.runInNewContext(code,{exports,require:name=>{assert.equal(name,'react');return{useRef:value=>({current:value}),useEffect:fn=>fn()};},fetch:async()=>{requests++;return{ok:true,json:async()=>({version:'new'})};},window:{sessionStorage:{getItem:()=>null,setItem:()=>{}},location:{reload:()=>reloads++},setInterval:()=>1,clearInterval:()=>{},addEventListener:()=>{},removeEventListener:()=>{}},document:{querySelector:()=>production?{}:null,addEventListener:()=>{},removeEventListener:()=>{}},Date});
  exports.default({currentVersion:'old'});await new Promise(resolve=>setImmediate(resolve));
  assert.equal(requests,production?0:1);assert.equal(reloads,production?0:1);
 }
});
