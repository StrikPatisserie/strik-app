const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function load(file,imports={},globals={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,console,Buffer,Date,JSON,Math,Map,Set,URL,Response,Request,File,Uint8Array,process,...globals,require:name=>name in imports?imports[name]:require(name)});return exports;}
const base='app/sinterklaas/b2b/logos/',model=load(base+'model.ts');
const id='11111111-1111-4111-8111-111111111111',id2='22222222-2222-4222-8222-222222222222';
const choice=(more={})=>({id,quantity:60,width_cm:3,height_cm:3,...more});
test('logo controls cover standalone letters, packages, explicit logo agreements and no-logo orders',()=>{
 assert(model.logoOrderRequested({logo:'Logo afstemmen',letterLines:[],orderText:''}));
 assert(model.logoOrderRequested({logo:'',letterLines:[{withLogo:true}],orderText:''}));
 assert(model.logoOrderRequested({logo:'',letterLines:[],orderText:'20x Speculaasbrok met letter · eigen logo'}));
 assert.equal(model.logoOrderRequested({logo:'',letterLines:[],orderText:'Speculaasbrok met letter'}),false);
});
test('A4 layout uses exact centimeters, keeps each requested count and never runs outside printable margins',()=>{
 const items=[choice({quantity:63}),choice({id:id2,quantity:17,width_cm:4.2,height_cm:2.1})],cells=model.logoPrintLayout(items);
 assert.equal(cells.length,80);assert.equal(cells.filter(item=>item.id===id2).length,17);
 for(const cell of cells){assert(cell.x>=.5&&cell.y>=2.2);assert(cell.x+cell.width<=20.500001);assert(cell.y+cell.height<=24.700001);}
 assert.equal(cells[0].width,3);assert.equal(cells[0].height,3);assert(cells.at(-1).page>0);
 for(const items of [[choice({quantity:0})],[choice({quantity:2001})],[choice({width_cm:20})],[choice({height_cm:28})],[choice(),choice()],[choice({quantity:101,width_cm:19,height_cm:27})]])assert.throws(()=>model.logoPrintLayout(items));
});
function repository(initial=[]) {
 const rows=structuredClone(initial);let writes=0;
 return{rows,get writes(){return writes;},from(table){assert.equal(table,'b2b_order_logos');const filters=[];let mode='read',data=null,projection='*';
 const run=()=>{let matches=rows.filter(row=>filters.every(fn=>fn(row)));if(mode==='insert'){const row={id:id2,quantity:1,width_cm:3,height_cm:3,created_at:'2026-11-04T12:00:00Z',...data};rows.push(row);matches=[row];writes++;}
 if(mode==='update'){matches.forEach(row=>Object.assign(row,data));writes+=matches.length;}if(mode==='delete'){matches.forEach(row=>rows.splice(rows.indexOf(row),1));writes+=matches.length;}return projection==='*'?matches:matches.map(row=>Object.fromEntries(projection.split(',').map(key=>[key,row[key]])));};
 const q={select:(fields)=>{projection=fields;return q;},eq:(key,value)=>{filters.push(row=>row[key]===value);return q;},in:(key,values)=>{filters.push(row=>values.includes(row[key]));return q;},order:async()=>({data:run(),error:null}),insert:value=>{mode='insert';data=value;return q;},update:value=>{mode='update';data=value;return q;},delete:()=>{mode='delete';return q;},maybeSingle:async()=>({data:run()[0]||null,error:null}),single:async()=>({data:run()[0]||null,error:null}),then:(resolve,reject)=>Promise.resolve({data:run(),error:null}).then(resolve,reject)};return q;
 }};
}
const row=()=>({id,order_id:'one',season:2026,name:'logo.png',content_type:'image/png',bytes_base64:'test',size:12,quantity:1,width_cm:3,height_cm:3,updated_at:'version-1'});
function route(db,context={}){
 const files=load('app/persoonlijk/fileTypes.ts');return load('app/api/b2b-logos/route.ts',{'@/app/sinterklaas/b2b/logos/access.server':{logoHeaders:{'Cache-Control':'private, no-store'},logoContext:async()=>({db,orderId:'one',year:2026,profile:{id:'actor'},...context})},'@/app/sinterklaas/b2b/logos/model':model,'@/app/persoonlijk/fileTypes':files});
}
const request=(method,body)=>new Request('https://app.test/api/b2b-logos?orderId=one&year=2026',{method,headers:{origin:'https://app.test','Content-Type':'application/json'},body:JSON.stringify(body)});
test('rename/settings/replacement/delete are order-scoped and stale writes never overwrite another edit',async()=>{
 const own=row(),foreign={...row(),id:id2,order_id:'two'},db=repository([own,foreign]),api=route(db);
 let response=await api.PATCH(request('PATCH',{...own,id:id2,name:'stolen'}));assert.equal(response.status,409);assert.equal(db.writes,0);
 response=await api.PATCH(request('PATCH',{...own,name:'New logo',quantity:20,width_cm:2.5,height_cm:4}));assert.equal(response.status,200);assert.equal(db.rows[0].name,'New logo');assert.equal(db.rows[0].quantity,20);
 response=await api.PATCH(request('PATCH',{...own,name:'stale'}));assert.equal(response.status,409);assert.equal(db.rows[0].name,'New logo');
 response=await api.DELETE(request('DELETE',{id:id2,updated_at:foreign.updated_at}));assert.equal(response.status,409);assert.equal(db.rows.length,2);
 response=await api.DELETE(request('DELETE',{id,updated_at:db.rows[0].updated_at}));assert.equal(response.status,200);assert.equal(db.rows.length,1);assert.equal(db.rows[0].order_id,'two');
});
test('upload verifies actual bytes, keeps originals and replacement preserves quantities and dimensions',async()=>{
 const db=repository([row()]),api=route(db);
 async function upload(file,replace=false){const form=new FormData();form.set('file',file);if(replace){form.set('id',id);form.set('updatedAt',db.rows[0].updated_at);}return api.POST(new Request('https://app.test/api/b2b-logos?orderId=one&year=2026',{method:'POST',body:form,headers:{origin:'https://app.test'}}));}
 let response=await upload(new File(['<script>bad</script>'],'fake.png',{type:'image/png'}));assert.equal(response.status,400);assert.equal(db.writes,0);
 const bytes=Buffer.from([137,80,78,71,13,10,26,10]);response=await upload(new File([bytes],'logo.png',{type:'image/png'}));assert.equal(response.status,200);assert.equal(db.rows[1].bytes_base64,bytes.toString('base64'));assert.equal(db.rows[1].width_cm,3);
 db.rows[0].quantity=90;db.rows[0].width_cm=2;db.rows[0].printed_at="2026-11-04T12:00:00Z";response=await upload(new File([bytes],'new.png',{type:'image/png'}),true);assert.equal(response.status,200);assert.equal(db.rows[0].quantity,90);assert.equal(db.rows[0].width_cm,2);assert.equal(db.rows[0].name,'new.png');assert.equal(db.rows[0].printed_at,null,'a replaced logo must be printed again');
});
test('unauthorized file routes return before touching metadata, files or request bodies',async()=>{
 const db=repository(),api=route(db,{error:new Response('Forbidden',{status:403})});
 for(const method of ['GET','POST','PATCH','DELETE']){const response=await api[method](new Request('https://app.test/api/b2b-logos',{method}));assert.equal(response.status,403);}assert.equal(db.writes,0);
});
test('context rejects missing permissions, cross-site uploads and nonexistent source orders',async()=>{
 async function run(profile,request,orders=[]){let reads=0;const mod=load(base+'access.server.ts',{'server-only':{},'@/app/lib/supabase/admin':{createAdminClient:()=>({})},'../../sinterklaasServerApi':{getAuthorizedSinterklaasProfile:async()=>profile,loadProductionB2BOrders:async()=>{reads++;return orders;}}});return{context:await mod.logoContext(request,true),reads};}
 const req=(origin)=>new Request('https://app.test/api/b2b-logos?orderId=one&year=2026',{method:'POST',headers:{origin}});
 let result=await run(null,req('https://app.test'));assert.equal(result.context.error.status,403);assert.equal(result.reads,0);
 result=await run({id:'actor'},req('https://evil.test'));assert.equal(result.context.error.status,403);assert.equal(result.reads,0);
 result=await run({id:'actor'},req('https://app.test'));assert.equal(result.context.error.status,404);
 result=await run({id:'actor'},req('https://app.test'),[{id:'one'}]);assert.equal(result.context.orderId,'one');
});
test('PDF generator produces real A4 sheets with both raster logos and vector PDF logos',async()=>{
 const {PDFDocument,rgb}=require('pdf-lib'),{createCanvas}=require('@napi-rs/canvas');
 const canvas=createCanvas(600,300),ctx=canvas.getContext('2d');ctx.fillStyle='#842E3C';ctx.fillRect(0,0,600,300);ctx.fillStyle='#fff';ctx.font='bold 90px sans-serif';ctx.fillText('STRIK',140,185);
 const vector=await PDFDocument.create();const page=vector.addPage([200,200]);page.drawCircle({x:100,y:100,size:90,color:rgb(.3,.5,.4)});page.drawText('LOGO',{x:48,y:90,size:32,color:rgb(1,1,1)});
 const files=[{id,content_type:'image/png',bytes_base64:canvas.toBuffer('image/png').toString('base64')},{id:id2,content_type:'application/pdf',bytes_base64:Buffer.from(await vector.save()).toString('base64')}];
 const headerText=[];
 const canvasModule=require('@napi-rs/canvas');
 const print=load(base+'print.server.ts',{'server-only':{},'pdf-lib':require('pdf-lib'),'./model':model,'./packedLayout':load(base+'packedLayout.ts',{'./model':model}),'@napi-rs/canvas':{...canvasModule,createCanvas(...args){const result=canvasModule.createCanvas(...args);if(args[0]===1600){const ctx=result.getContext('2d'),draw=ctx.fillText.bind(ctx);ctx.fillText=(value,...rest)=>{headerText.push(value);draw(value,...rest);};}return result;}}});
 const bytes=await print.createLogoPrint([choice({quantity:70}),choice({id:id2,quantity:5,width_cm:4,height_cm:4})],files,'Testbedrijf & Partners');
 const pdf=await PDFDocument.load(bytes);assert.equal(pdf.getPageCount(),3);assert.equal(headerText.filter(text=>text==='Testbedrijf & Partners').length,2);assert.match(pdf.getTitle(),/Testbedrijf & Partners/);assert(Math.abs(pdf.getPage(0).getSize().width-595.27559)<.01);assert(Math.abs(pdf.getPage(0).getSize().height-841.88976)<.01);
 if(process.env.STRIK_LOGO_TEST_PDF_DIR){fs.mkdirSync(process.env.STRIK_LOGO_TEST_PDF_DIR,{recursive:true});fs.writeFileSync(`${process.env.STRIK_LOGO_TEST_PDF_DIR}/logo-print-test.pdf`,bytes);}
 await assert.rejects(print.createLogoPrint([choice()],[{id,content_type:'application/pdf',bytes_base64:Buffer.from('invalid').toString('base64')}],'Testbedrijf'),/onbeveiligde PDF/);
});

test('metadata lists never include file contents and another order cannot download the file',async()=>{
 const db=repository([row(),{...row(),id:id2,order_id:'other'}]),api=route(db);
 const response=await api.GET(new Request('https://app.test/api/b2b-logos?orderId=one&year=2026'));
 const data=await response.json();assert.equal(data.logos.length,1);assert.equal(data.logos[0].bytes_base64,undefined);assert.equal(data.logos[0].order_id,undefined);
 const denied=await api.GET(new Request(`https://app.test/api/b2b-logos?orderId=one&year=2026&id=${id2}`));assert.equal(denied.status,404);
});
test('print endpoint rejects foreign IDs and validates quantity limits before reading file bytes',async()=>{
 let generated=0;const db=repository([row(),{...row(),id:id2,order_id:'other'}]);
 const api=load('app/api/b2b-logos/print/route.ts',{
  '@/app/sinterklaas/b2b/logos/access.server':{logoHeaders:{},logoContext:async()=>({db,orderId:'one',year:2026})},
  '@/app/sinterklaas/b2b/logos/model':model,'@/app/sinterklaas/b2b/logos/print.server':{createLogoPrint:async()=>{generated++;return Buffer.from('%PDF-test');}},
 });
 let response=await api.POST(request('POST',{logos:[choice({id:id2,quantity:1})]}));assert.equal(response.status,400);assert.equal(generated,0);
 response=await api.POST(request('POST',{logos:[choice({quantity:3000})]}));assert.equal(response.status,400);assert.equal(generated,0);
 response=await api.POST(request('POST',{logos:[choice({quantity:2})]}));assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'application/pdf');assert.equal(generated,1);
});
test('overview attachment counts are scoped, paginated, and unknown on storage failure rather than a false missing warning',async()=>{
 async function read(rows,fail=false){const requests=[];const db={from:()=>({select:columns=>{assert.equal(columns,'order_id,quantity,width_cm,height_cm,printed_at,printed_quantity,printed_width_cm,printed_height_cm');return{eq:(key,year)=>{assert.equal(year,2026);return{in:(key,ids)=>{assert.deepEqual(Array.from(ids),['one','two','three']);return{order:()=>({range:async(start,end)=>{requests.push([start,end]);return{data:rows.slice(start,end+1),error:fail?{}:null};}})};}};}};}})};
 const server=load(base+'counts.server.ts',{'./model':model,'server-only':{},'@/app/lib/supabase/admin':{createAdminClient:()=>db}});
 return{data:await server.withLogoCounts([{id:'one'},{id:'two'},{id:'three'}],'2026'),requests};}
 let result=await read([{order_id:'one'},{order_id:'one'},{order_id:'two'}]);assert.deepEqual(Array.from(result.data,order=>order.logoAttachmentCount),[2,1,0]);
 result=await read(Array.from({length:501},()=>({order_id:'one'})));assert.equal(result.data[0].logoAttachmentCount,501);assert.equal(result.requests.length,2);
 result=await read([],true);assert(result.data.every(order=>order.logoAttachmentCount===null&&order.logoPrintComplete===null));
 const printed={...choice(),printed_at:'2026-11-05T10:00:00Z',printed_quantity:60,printed_width_cm:3,printed_height_cm:3};
 result=await read([{...printed,order_id:'one'},{...printed,order_id:'two'},{...printed,order_id:'two',quantity:61}]);assert.deepEqual(Array.from(result.data,order=>order.logoPrintComplete),[true,false,false]);
});
test('missing-logo icons use red state, while uploaded logos use normal styling and dialog mutations notify the overview',()=>{
 const React=require('react'),jsx=require('react/jsx-runtime');
 const component=load(base+'OrderLogos.tsx',{'react':React,'react/jsx-runtime':jsx,'next/dynamic':{default:()=>()=>null},'./Logos.module.css':{default:new Proxy({},{get:(_,name)=>String(name)})}});
 const html=missing=>require('react-dom/server').renderToStaticMarkup(React.createElement(component.default,{orderId:'one',year:'2026',customer:'Test',missing}));
 assert.match(html(true),/data-missing="true"/);assert.doesNotMatch(html(false),/data-missing/);
 const row=fs.readFileSync('app/sinterklaas/b2b/SinterklaasB2BClient.tsx','utf8');assert.doesNotMatch(row,/Logo nog niet gecontroleerd/);assert.match(row,/Nog geen logo geüpload — controleer/);assert.match(row,/logoAttachmentCount===0/);
 const dialog=fs.readFileSync(base+'OrderLogosDialog.tsx','utf8');assert.match(dialog,/onCountChange\?\.\(nextLogos.length,logosPrintComplete\(nextLogos\)\)/);
});
test('print checkmark is manual, records the actor and exact settings, and resets on changed print settings',async()=>{
 const db=repository([row()]),api=route(db,{profile:{id:'actor',full_name:'Feline',email:'feline@example.invalid'}});
 let response=await api.PATCH(request('PATCH',{...row(),printed:true,printed_at:'forged',printed_by_name:'forged'}));assert.equal(response.status,200);
 let current=db.rows[0];assert(current.printed_at);assert.notEqual(current.printed_at,'forged');assert.equal(current.printed_by,'actor');assert.equal(current.printed_by_name,'Feline');assert.equal(current.printed_quantity,1);assert.equal(model.logoPrintedFor(current),true);
 const printedAt=current.printed_at;response=await api.PATCH(request('PATCH',{...current,name:'Renamed logo'}));assert.equal(response.status,200);assert.equal(db.rows[0].printed_at,printedAt,'renaming does not unprint the image');
 response=await api.PATCH(request('PATCH',{...db.rows[0],quantity:20}));assert.equal(response.status,200);assert.equal(db.rows[0].printed_at,null);assert.equal(model.logoPrintedFor(db.rows[0]),false);
 response=await api.PATCH(request('PATCH',{...db.rows[0],printed:true}));assert.equal(response.status,200);assert.equal(db.rows[0].printed_quantity,20);
 response=await api.PATCH(request('PATCH',{...db.rows[0],printed:false}));assert.equal(response.status,200);assert.equal(db.rows[0].printed_at,null);
});
test('reprinting an already confirmed logo requires explicit confirmation on the server',async()=>{
 let generated=0;const db=repository([{...row(),printed_at:'2026-11-04T12:00:00Z'}]);
 const api=load('app/api/b2b-logos/print/route.ts',{
  '@/app/sinterklaas/b2b/logos/access.server':{logoHeaders:{},logoContext:async()=>({db,orderId:'one',year:2026})},
  '@/app/sinterklaas/b2b/logos/model':model,'@/app/sinterklaas/b2b/logos/print.server':{createLogoPrint:async()=>{generated++;return Buffer.from('%PDF-test');}},
 });
 let response=await api.POST(request('POST',{logos:[choice({quantity:1})]}));assert.equal(response.status,409);assert.equal(generated,0);
 response=await api.POST(request('POST',{logos:[choice({quantity:1})],confirmReprint:true}));assert.equal(response.status,200);assert.equal(generated,1);
 assert.equal(db.rows[0].printed_at,'2026-11-04T12:00:00Z','generating a PDF never confirms physical printing');
});

test('printer safety reserves 50 mm below every logo, uses 5 mm side margins and never shrinks requested dimensions',()=>{
 const cells=model.logoPrintLayout([choice({quantity:100})]);
 assert.equal(cells[0].x,.5);assert.equal(cells[0].y,2.2);assert.equal(cells.filter(cell=>cell.page===0&&cell.y===2.2).length,6,'six 3 cm logos fit across the wider print area');
 for(const cell of cells){assert(29.7-cell.y-cell.height>=5-.000001);assert.equal(cell.width,3);assert.equal(cell.height,3);}
 assert.throws(()=>model.logoPrintLayout([choice({height_cm:22.6,quantity:1})]),/5 cm vrij/);
 const large=model.logoPrintLayout([choice({height_cm:22.5,quantity:1})]);assert.equal(large.length,1);assert(Math.abs(29.7-large[0].y-large[0].height-5)<.000001);
});


test('overview printer check appears only when every current selected logo is confirmed printed',()=>{
 const printed={...choice(),printed_at:'2026-11-05T10:00:00Z',printed_quantity:60,printed_width_cm:3,printed_height_cm:3};
 assert.equal(model.logosPrintComplete([]),false);
 assert.equal(model.logosPrintComplete([printed]),true);
 assert.equal(model.logosPrintComplete([printed,{...printed,id:id2,printed_at:null}]),false);
 assert.equal(model.logosPrintComplete([printed,{...printed,id:id2,quantity:0}]),true);
 assert.equal(model.logosPrintComplete([{...printed,quantity:61}]),false);
 assert.equal(model.logosPrintComplete([{...printed,width_cm:4}]),false);
 const React=require('react'),jsx=require('react/jsx-runtime');
 const component=load(base+'OrderLogos.tsx',{'react':React,'react/jsx-runtime':jsx,'next/dynamic':{default:()=>()=>null},'./Logos.module.css':{default:new Proxy({},{get:(_,name)=>String(name)})}});
 const html=(complete,missing=false)=>require('react-dom/server').renderToStaticMarkup(React.createElement(component.default,{orderId:'one',year:'2026',customer:'Test',printComplete:complete,missing}));
 assert.match(html(true),/data-printed="true"/);assert.match(html(true),/printCheck/);assert.match(html(true),/geprint · printvel bekijken/);
 assert.doesNotMatch(html(false),/data-printed|printCheck/);assert.doesNotMatch(html(null),/data-printed|printCheck/);assert.doesNotMatch(html(true,true),/data-printed|printCheck/);
});

test('confirming or changing a logo print updates the overview callback immediately, while failed saves keep its state',async()=>{
 const jsx=require('react/jsx-runtime'),states=[],reports=[];let cursor=0,fail=false;
 const original={...row(),quantity:2};
 const hooks={useEffect(){},useRef:()=>({current:null}),useState(initial){const i=cursor++;if(!(i in states))states[i]=i===0?[original]:i===1?false:initial;return[states[i],value=>{states[i]=typeof value==='function'?value(states[i]):value;}];}};
 const loaded=load(base+'OrderLogosDialog.tsx',{'react':hooks,'react/jsx-runtime':jsx,'react-dom':{createPortal:node=>node},'./model':model,'./Logos.module.css':{default:new Proxy({},{get:(_,key)=>key})}},{document:{body:{}},fetch:async(url,request)=>{
  const input=JSON.parse(request.body);return Response.json(fail?{message:'Niet opgeslagen'}:{logo:{...input,printed_at:input.printed?'2026-11-05T10:00:00Z':null,printed_quantity:input.quantity,printed_width_cm:input.width_cm,printed_height_cm:input.height_cm}},{status:fail?503:200});
 }});
 const render=()=>{cursor=0;return loaded.default({orderId:'one',year:'2026',customer:'Test',startPrint:false,onCountChange:(...args)=>reports.push(args),onClose(){}});};
 const nodes=tree=>Array.isArray(tree)?tree.flatMap(nodes):tree&&typeof tree==='object'?[tree,...nodes(tree.props?.children)]:[];
 let tree=render();nodes(tree).find(n=>n.type==='input'&&n.props.type==='checkbox').props.onChange({target:{checked:true}});await new Promise(setImmediate);
 assert.deepEqual(reports.at(-1),[1,true]);tree=render();assert.equal(nodes(tree).find(n=>n.type==='input'&&n.props.type==='checkbox').props.checked,true);
 fail=true;nodes(tree).find(n=>n.type==='input'&&n.props.type==='checkbox').props.onChange({target:{checked:false}});await new Promise(setImmediate);assert.deepEqual(reports.at(-1),[1,true]);
 fail=false;tree=render();nodes(tree).find(n=>n.type==='input'&&n.props.type==='checkbox').props.onChange({target:{checked:false}});await new Promise(setImmediate);assert.deepEqual(reports.at(-1),[1,false]);
});


test('each logo starts its own sheets and every sheet reserves a customer header above exact-size logos', () => {
 const cells=model.logoPrintLayout([choice({quantity:2}),choice({id:id2,quantity:2})]);
 assert.equal(cells.filter(cell=>cell.id===id)[0].page,0);
 assert.equal(cells.filter(cell=>cell.id===id2)[0].page,1);
 for(const page of new Set(cells.map(cell=>cell.page)))assert.equal(new Set(cells.filter(cell=>cell.page===page).map(cell=>cell.id)).size,1);
 assert(cells.every(cell=>cell.y>=2.2&&cell.width===3&&cell.height===3));
});

test('print customer name comes from the verified order, ignoring a supplied customer name', async () => {
 let actualCustomer='';const db=repository([row()]);
 const api=load('app/api/b2b-logos/print/route.ts', {
  '@/app/sinterklaas/b2b/logos/access.server':{logoHeaders:{},logoContext:async()=>({db,orderId:'one',year:2026,customer:'Verified customer'})},
  '@/app/sinterklaas/b2b/logos/model':model,
  '@/app/sinterklaas/b2b/logos/print.server':{createLogoPrint:async(items,files,customer)=>{actualCustomer=customer;return Buffer.from('%PDF-test');}},
 });
 const response=await api.POST(request('POST',{logos:[choice({quantity:1})],customer:'Forged'}));
 assert.equal(response.status,200);assert.equal(actualCustomer,'Verified customer');
});
