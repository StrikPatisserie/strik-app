const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const orderId='11111111-1111-4111-8111-111111111111',itemId='22222222-2222-4222-8222-222222222222';
const requestId='33333333-3333-4333-8333-333333333333';
const input=()=>({orderId,revision:3,requestId,confirmation:'CL26-0016',confirmed:true,lines:[{itemId,quantity:2}]});
const request=(data=input(),origin='https://app.example.invalid')=>new Request('https://app.example.invalid/api/lettershop/change-order',{
 method:'POST',headers:{'Content-Type':'application/json',origin},body:JSON.stringify(data),
});
function endpoint({profile={id:'manager',active:true,full:true},configured=true,rpcError=null,mailError=false,status='SENT'}={}) {
 const calls=[],mails=[];
 const db={rpc:async(name,args)=>{calls.push({name,args});return{data:rpcError?null:'mail-job',error:rpcError};},from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:{status}})})})})};
 const imports={
  '@supabase/supabase-js':{createClient:()=>db},
  '@/app/lib/auth/session':{getCurrentProfile:async()=>profile},
  '@/app/lib/auth/access':{hasFullAccess:p=>p.full},
  '@/app/lib/supabase/config':{requireSupabasePublicConfig:()=>({url:'https://database.example.invalid'}),requireSupabaseServiceRoleKey:()=> 'test-only'},
  '@/app/lettershop/sendOrderMail':{lettershopMailIsConfigured:()=>configured,sendLettershopOrderMails:async id=>{mails.push(id);if(mailError)throw Error('delivery unavailable');}},
 };
 const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('app/api/lettershop/change-order/route.ts','utf8'),{
 compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},
 }).outputText,{exports,require:name=>{assert(name in imports,name);return imports[name];},Request,Response,URL});
 return {route:exports,calls,mails};
}
test('order changes require an active manager, matching origin and explicit review confirmation',async()=>{
 for(const settings of [{profile:null},{profile:{active:false,full:true}},{profile:{active:true,full:false}},{configured:false}]){
  const e=endpoint(settings);assert.notEqual((await e.route.POST(request())).status,200);assert.equal(e.calls.length,0);
 }
 for(const patch of [{confirmed:false},{revision:0},{requestId:'invalid'},{lines:[{itemId,quantity:1.5}]},{lines:[{itemId,quantity:-1}]},{lines:[]}]){
  const e=endpoint();assert.equal((await e.route.POST(request({...input(),...patch}))).status,400);assert.equal(e.calls.length,0);
 }
 const e=endpoint();assert.equal((await e.route.POST(request(input(),'https://other.example.invalid'))).status,403);assert.equal(e.calls.length,0);
});
test('the transaction uses the current actor, expected revision, request key and immutable item IDs before mailing',async()=>{
 const e=endpoint();const response=await e.route.POST(request());assert.equal(response.status,200);
 assert.equal(e.calls.length,1);assert.equal(e.calls[0].name,'lettershop_change_quantities');
 const args=e.calls[0].args;
 assert.equal(args.p_actor_id,'manager');assert.equal(args.p_expected_revision,3);assert.equal(args.p_request_key,requestId);
 assert.equal(args.p_order_id,orderId);assert.equal(args.p_lines[0].itemId,itemId);assert.equal(args.p_lines[0].quantity,2);
 assert.deepEqual(e.mails,[orderId]);assert.equal((await response.json()).mailStatus,'SENT');
});
test('a frozen or stale order is rejected before mail and an unavailable sender leaves a visible queued confirmation',async()=>{
 const locked=endpoint({rpcError:{message:'De productielijst staat vast.'}});const denied=await locked.route.POST(request());
 assert.equal(denied.status,409);assert.match((await denied.json()).message,/staat vast/);assert.equal(locked.mails.length,0);
 const queued=endpoint({mailError:true,status:'FAILED'});const response=await queued.route.POST(request());
 assert.equal(response.status,200);const result=await response.json();assert.equal(result.changed,true);assert.equal(result.mailStatus,'QUEUED');
});

test('change jobs use the existing customer-mail relay with a distinct retry ID and explicit replacement confirmation',async()=>{
 const deliveries=[],updates=[];
 const job={id:'44444444-4444-4444-8444-444444444444',template:'ORDER_CHANGE',status:'PENDING',attempts:0,
  payload:{order_number:'CL26-0016',customer_email:'customer@example.invalid',requested_date:'2026-11-24',pickup_location:'lent',notes:'Bestaande opmerking',total_cents:1790,items:[{letter:'S',quantity:2}]}};
 const db={from:()=>({
  select(){return this;},eq(){return this;},in(){return this;},order:async()=>({data:[job]}),
  update(change){updates.push(change);return this;},maybeSingle:async()=>({data:{id:job.id}}),
  then(resolve){resolve({error:null});},
 })};
 const imports={'server-only':{},'@supabase/supabase-js':{createClient:()=>db},
  '@/app/lib/supabase/config':{requireSupabasePublicConfig:()=>({url:'https://database.example.invalid'}),requireSupabaseServiceRoleKey:()=> 'test-only'},
  './formatPickupDate':{formatPickupDate:date=>date},'./shops':{lettershopMailLocation:shop=>shop}};
 const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('app/lettershop/sendOrderMail.ts','utf8'),{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},
 }).outputText,{exports,require:name=>imports[name],Date,Buffer,AbortSignal,process:{env:{WORDPRESS_USERNAME:'test',WORDPRESS_APPLICATION_PASSWORD:'test-only'}},
  fetch:async(url,options)=>{deliveries.push(JSON.parse(options.body));return{ok:true};}});
 await exports.sendLettershopOrderMails(orderId);
 assert.equal(deliveries.length,1);assert.equal(deliveries[0].id,job.id);assert.equal(deliveries[0].template,'ONLINE_CONFIRMATION');
 assert.equal(deliveries[0].payload.customer_email,'customer@example.invalid');assert.equal(deliveries[0].payload.items[0].quantity,2);
 assert.match(deliveries[0].payload.notes,/Gewijzigde bestelbevestiging/);assert.match(deliveries[0].payload.notes,/Bestaande opmerking/);
 assert.equal(deliveries[0].attachments.length,0);assert.equal(updates.at(-1).status,'SENT');assert.equal(job.payload.notes,'Bestaande opmerking');
});

function uiNodes(tree) {
 if(!tree||typeof tree!=='object')return[];
 if(Array.isArray(tree))return tree.flatMap(uiNodes);
 return[tree,...uiNodes(tree.props?.children)];
}
function uiText(tree){if(typeof tree==='string'||typeof tree==='number')return String(tree);if(Array.isArray(tree))return tree.map(uiText).join('');return tree?.props?uiText(tree.props.children):'';}
function loadUI(file,imports){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,{exports,require:name=>{assert(name in imports,name);return imports[name];},Intl,crypto:require('node:crypto').webcrypto});return exports;}
test('the editor requires a separate review and checked mail confirmation and retains the opened revision during background refresh',async()=>{
 const hooks=[],requests=[];let index=0,refreshes=0;
 const react={useEffect(){},useRef:value=>{const i=index++;return hooks[i]??(hooks[i]={current:value});},useState:initial=>{const i=index++;if(!(i in hooks))hooks[i]=typeof initial==='function'?initial():initial;return[hooks[i],next=>hooks[i]=typeof next==='function'?next(hooks[i]):next];}};
 const helpers=loadUI('app/sinterklaas/letters/online/onlineOrders.ts',{});
 const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('app/sinterklaas/letters/online/EditOnlineLetterOrder.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,{exports,require:name=>({'react':react,'react/jsx-runtime':require('react/jsx-runtime'),'next/navigation':{useRouter:()=>({refresh(){refreshes++;}})},'./onlineOrders':helpers,'./OnlineOrderEdit.module.css':{__esModule:true,default:new Proxy({},{get:(_,key)=>key})}})[name],Intl,crypto:require('node:crypto').webcrypto,
  fetch:async(url,options)=>{requests.push({url,body:JSON.parse(options.body)});return{ok:true,json:async()=>({changed:true,mailStatus:'SENT'})};}});
 const order={id:orderId,revision:5,order_number:'CL26-0016',customer_name:'Voorbeeldklant',customer_email:'customer@example.invalid',gift_wrap:true,gift_wrap_price_cents:25,
  letter_order_items:[{id:itemId,quantity:1,unit_price_cents:895,logo_price_cents:0,logo:false,letter_products:{letter:'S',flavour:'puur',size:'klein',style:'spuit'}}]};
 const render=(props={order})=>{index=0;return exports.default(props);};
 let tree=render();uiNodes(tree).find(node=>node.type==='button').props.onClick();tree=render();
 uiNodes(tree).find(node=>node.type==='input'&&node.props.type==='number').props.onChange({target:{value:'2'}});tree=render();
 uiNodes(tree).find(node=>node.type==='form').props.onSubmit({preventDefault(){}});tree=render();
 assert.match(uiText(tree),/Controleer de wijziging/);assert.match(uiText(tree),/17,?90|18,?40/);assert.equal(requests.length,0);
 assert(uiNodes(tree).find(node=>node.type==='button'&&uiText(node)==='Opslaan & klant mailen').props.disabled);
 uiNodes(tree).find(node=>node.type==='form').props.onSubmit({preventDefault(){}});assert.equal(requests.length,0);
 uiNodes(tree).find(node=>node.type==='input'&&node.props.type==='checkbox').props.onChange({target:{checked:true}});
 tree=render({order:{...order,revision:6}});
 uiNodes(tree).find(node=>node.type==='form').props.onSubmit({preventDefault(){}});await new Promise(resolve=>setImmediate(resolve));
 assert.equal(requests.length,1);assert.equal(requests[0].body.revision,5);assert.equal(requests[0].body.confirmed,true);assert.equal(requests[0].body.lines[0].quantity,2);assert.equal(refreshes,1);
});
