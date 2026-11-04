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
 for(const cell of cells){assert(cell.x>=1&&cell.y>=1);assert(cell.x+cell.width<=20.000001);assert(cell.y+cell.height<=28.700001);}
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
 db.rows[0].quantity=90;db.rows[0].width_cm=2;response=await upload(new File([bytes],'new.png',{type:'image/png'}),true);assert.equal(response.status,200);assert.equal(db.rows[0].quantity,90);assert.equal(db.rows[0].width_cm,2);assert.equal(db.rows[0].name,'new.png');
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
 const print=load(base+'print.server.ts',{'server-only':{},'pdf-lib':require('pdf-lib'),'./model':model});
 const bytes=await print.createLogoPrint([choice({quantity:70}),choice({id:id2,quantity:5,width_cm:4,height_cm:4})],files);
 const pdf=await PDFDocument.load(bytes);assert(pdf.getPageCount()>=2);assert(Math.abs(pdf.getPage(0).getSize().width-595.27559)<.01);assert(Math.abs(pdf.getPage(0).getSize().height-841.88976)<.01);
 if(process.env.STRIK_LOGO_TEST_PDF_DIR){fs.mkdirSync(process.env.STRIK_LOGO_TEST_PDF_DIR,{recursive:true});fs.writeFileSync(`${process.env.STRIK_LOGO_TEST_PDF_DIR}/logo-print-test.pdf`,bytes);}
 await assert.rejects(print.createLogoPrint([choice()],[{id,content_type:'application/pdf',bytes_base64:Buffer.from('invalid').toString('base64')}]),/onbeveiligde PDF/);
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
 async function read(rows,fail=false){const requests=[];const db={from:()=>({select:columns=>{assert.equal(columns,'order_id');return{eq:(key,year)=>{assert.equal(year,2026);return{in:(key,ids)=>{assert.deepEqual(Array.from(ids),['one','two','three']);return{order:()=>({range:async(start,end)=>{requests.push([start,end]);return{data:rows.slice(start,end+1),error:fail?{}:null};}})};}};}};}})};
 const server=load(base+'counts.server.ts',{'server-only':{},'@/app/lib/supabase/admin':{createAdminClient:()=>db}});
 return{data:await server.withLogoCounts([{id:'one'},{id:'two'},{id:'three'}],'2026'),requests};}
 let result=await read([{order_id:'one'},{order_id:'one'},{order_id:'two'}]);assert.deepEqual(Array.from(result.data,order=>order.logoAttachmentCount),[2,1,0]);
 result=await read(Array.from({length:501},()=>({order_id:'one'})));assert.equal(result.data[0].logoAttachmentCount,501);assert.equal(result.requests.length,2);
 result=await read([],true);assert(result.data.every(order=>order.logoAttachmentCount===null));
});
test('missing-logo icons use red state, while uploaded logos use normal styling and dialog mutations notify the overview',()=>{
 const React=require('react'),jsx=require('react/jsx-runtime');
 const component=load(base+'OrderLogos.tsx',{'react':React,'react/jsx-runtime':jsx,'next/dynamic':{default:()=>()=>null},'./Logos.module.css':{default:new Proxy({},{get:(_,name)=>String(name)})}});
 const html=missing=>require('react-dom/server').renderToStaticMarkup(React.createElement(component.default,{orderId:'one',year:'2026',customer:'Test',missing}));
 assert.match(html(true),/data-missing="true"/);assert.doesNotMatch(html(false),/data-missing/);
 const row=fs.readFileSync('app/sinterklaas/b2b/SinterklaasB2BClient.tsx','utf8');assert.doesNotMatch(row,/Logo nog niet gecontroleerd/);assert.match(row,/Nog geen logo geüpload — controleer/);assert.match(row,/logoAttachmentCount===0/);
 const dialog=fs.readFileSync(base+'OrderLogosDialog.tsx','utf8');assert.match(dialog,/onCountChange\?\.\(replace\?logos.length:logos.length\+uploaded\)/);assert.match(dialog,/onCountChange\?\.\(logos.length-1\)/);
});
