import { getCurrentProfile } from '@/app/lib/auth/session';
import { hasFullAccess } from '@/app/lib/auth/access';
import { paymentDb, paymentService, paymentSummary, paymentStore } from '@/app/management/betaalverzoeken/paymentServer';
import { paymentInput, paymentMail, validRequestId, type PaymentRequest } from '@/app/management/betaalverzoeken/paymentRequests';
import { PaymentConflictError } from '@/app/management/betaalverzoeken/paymentService';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=60;
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store'}});
export async function GET(request:Request){
 if(!hasFullAccess(await getCurrentProfile()))return json({message:'Alleen bevoegde beheerders kunnen betaalverzoeken inzien.'},403);
 const params=new URL(request.url).searchParams;
 if(params.has('id')){
  const id=params.get('id'),kind=params.get('mail')||'customer';
  if(!validRequestId(id)||!['customer','customer_reminder'].includes(kind))return json({message:'Ongeldig mailvoorbeeld.'},400);
  try{const row=await paymentStore.get(id);return json({...paymentMail(row,kind as 'customer'|'customer_reminder'),recipient:row.recipient_email,sent_at:kind==='customer'?row.sent_at:row.customer_reminder_sent_at,legacy:kind==='customer'&&row.mail_version===1});}catch{return json({message:'Het mailvoorbeeld kon niet worden geladen.'},503);}
 }
 const offset=Number(params.get('offset')||0);
 const view=new URL(request.url).searchParams.get('view')||'all';
 if(!['all','open','paid'].includes(view))return json({message:'Ongeldige statusselectie.'},400);
 if(!Number.isInteger(offset)||offset<0||offset>100000)return json({message:'Ongeldige pagina.'},400);
 try{let query=paymentDb().from('management_payment_requests').select('*',{count:'exact'});if(view==='open')query=query.is('paid_at',null);if(view==='paid')query=query.not('paid_at','is',null);const result=await query.order('created_at',{ascending:false}).range(offset,offset+49);if(result.error)throw result.error;return json({requests:(result.data as PaymentRequest[]).map(paymentSummary),total:result.count});}catch{return json({message:'Betaalverzoeken konden niet worden geladen.'},503);}
}
export async function POST(request:Request){
 const profile=await getCurrentProfile();if(!hasFullAccess(profile))return json({message:'Alleen bevoegde beheerders kunnen betaalverzoeken versturen.'},403);
 if(request.headers.get('origin')!==new URL(request.url).origin||request.headers.get('content-type')?.split(';')[0].trim()!=='application/json')return json({message:'Open het betaalformulier opnieuw in de app.'},403);
 let input:Record<string,unknown>;
 try{const text=await request.text();if(text.length>4000)throw Error();input=JSON.parse(text);if(!input||typeof input!=='object'||Array.isArray(input))throw Error();}catch{return json({message:'Ongeldig verzoek.'},400);}
 try{
  if(input.action==='create'){
   try{paymentInput(input);}catch(error){return json({message:(error as Error).message},400);}
   return json({request:paymentSummary(await paymentService.create(profile!.id,input))});
  }
  if(!validRequestId(input.id))return json({message:'Ongeldig betaalverzoek.'},400);
  if(input.action==='mark_paid'){
   if(!['bank','store'].includes(String(input.method))||typeof (input.note??'')!=='string'||String(input.note??'').length>300||String(input.note??'').includes('\0'))return json({message:'Kies bank of winkel en maximaal 300 tekens toelichting.'},400);
   return json({request:paymentSummary(await paymentService.markPaid(input.id,profile!.id,input.method as 'bank'|'store',String(input.note||'')))});
  }
  if(input.action==='remind_customer')return json({request:paymentSummary(await paymentService.remindCustomer(input.id,profile!.id))});
  if(input.action==='sync')return json({request:paymentSummary(await paymentService.sync(input.id))});
  if(input.action==='retry_mail'){
   const row=await paymentService.sync(input.id);
   return json({request:paymentSummary(row.paid_at?row:await paymentService.sendMail(row.id,'customer'))});
  }
  return json({message:'Onbekende actie.'},400);
 }catch(error){
  if(error instanceof PaymentConflictError)return json({message:error.message},409);
  // A timeout may have created a link or sent a mail. Retain the client ID.
  try{if(validRequestId(input.id))return json({request:paymentSummary(await paymentStore.get(input.id)),message:'Controleer de opgeslagen status voordat je iets opnieuw verstuurt.'});}catch{}
  return json({message:'Het verzoek is niet bevestigd. Vernieuw het overzicht en controleer de status voordat je opnieuw probeert.'},503);
 }
}
