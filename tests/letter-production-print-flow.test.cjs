const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');
function harness(prepare){
 const state=[],refs=[];let i=0,j=0,prints=0,hook;
 const exports={};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync('app/sinterklaas/letters/productie/useProductionPrint.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{
  exports,window:{print(){prints++;assert.equal(state[0].checklist.lockedAt,'confirmed');}},
  require(name){if(name==='react')return {useState(value){const k=i++;if(!(k in state))state[k]=value;return [state[k],v=>state[k]=v];},useRef(value){const k=j++;return refs[k]||(refs[k]={current:value});}};if(name==='react-dom')return {flushSync(fn){fn();}};throw Error(name);}
 });
 const batch={id:'extra',supplementId:'extra',rows:[{orders:7}],checklist:{lockedAt:null,revision:1}};
 const render=()=>{i=j=0;hook=exports.useProductionPrint(batch,prepare);return hook;};
 return {batch,render,get prints(){return prints;}};
}
test('opening print preview does not freeze; printing waits for persisted confirmation and suppresses duplicate clicks',async()=>{
 let resolve,calls=0;
 const h=harness(async batch=>{calls++;return new Promise(r=>resolve=()=>r({...batch,checklist:{lockedAt:'confirmed',revision:2}}));});
 let hook=h.render();assert.equal(calls,0);assert.equal(h.prints,0);assert.equal(hook.unconfirmed,true);
 const waiting=hook.print();await hook.print();assert.equal(calls,1);assert.equal(h.prints,0);assert(h.render().busy);
 resolve();await waiting;hook=h.render();assert.equal(h.prints,1);assert.equal(hook.unconfirmed,false);assert.equal(hook.busy,false);
});
test('failed, stale or unconfirmed saves never open the browser print dialog',async()=>{
 for(const prepare of [async()=>{throw Error('Changed');},async batch=>batch,undefined]){
  const h=harness(prepare);await h.render().print();const hook=h.render();
  assert.equal(h.prints,0);assert.equal(hook.unconfirmed,true);assert(hook.error);assert.equal(hook.busy,false);
 }
});
