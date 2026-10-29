import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '../../lib/supabase/admin';
import { getSiteUrl } from '../../lib/supabase/config';
import { weddingWordPress } from '../../lib/weddingServer';
import { getMollieApiKey } from '../../api/bruidstaart-payment-request/mollieServer';
import { createPaymentService, type PaymentStore } from './paymentService';
import { mailFields, paymentMail, paymentReference, type PaymentRequest } from './paymentRequests';

const table='management_payment_requests';
export function paymentDb(){return createAdminClient() as unknown as SupabaseClient;}
const checked=<T>(result:{data:T;error:unknown})=>{if(result.error)throw Error('De betaalverzoeken konden niet veilig worden opgeslagen of gelezen.');return result.data;};
export const paymentStore:PaymentStore={
 async insert(input,actorId){
  const db=paymentDb();const result=await db.from(table).insert({...input,actor_id:actorId,mail_version:2}).select('*').single();
  if(result.error?.code==='23505')return{created:false,row:await this.get(input.id)};
  return{created:true,row:checked(result) as PaymentRequest};
 },
 async get(id){return checked(await paymentDb().from(table).select('*').eq('id',id).single()) as PaymentRequest;},
 async update(id,values){return checked(await paymentDb().from(table).update(values).eq('id',id).select('*').single()) as PaymentRequest;},
 async recordPaid(id,values){const result=await paymentDb().from(table).update(values).eq('id',id).is('paid_at',null).select('*').maybeSingle();return (checked(result) as PaymentRequest|null)||this.get(id);},
 async claimMail(row,kind,now){
  const {state:field,attempt}=mailFields[kind];
  if(row[field]==='sent')return null;
  if(row[field]==='sending'&&(!row[attempt]||Date.parse(now)-Date.parse(row[attempt]!)<600000))return null;
  let query=paymentDb().from(table).update({[field]:'sending',[attempt]:now}).eq('id',row.id).eq(field,row[field]).eq('link_state','ready').is('paid_at',null);
  if(row[field]==='sending')query=query.eq(attempt,row[attempt]);
  return checked(await query.select('*').maybeSingle()) as PaymentRequest|null;
 }
};
function webhookToken(id:string){const key=getMollieApiKey();if(!key)throw Error('Mollie is nog niet ingesteld.');return createHmac('sha256',key).update(`strik-management-payment:${id}`).digest('hex');}
export function validPaymentWebhook(id:string,token:string){
 try{const expected=Buffer.from(webhookToken(id)),actual=Buffer.from(token);return expected.length===actual.length&&timingSafeEqual(expected,actual);}catch{return false;}
}
async function mollie(path:string,body?:unknown,idempotencyKey?:string,method?:string){
 const key=getMollieApiKey();if(!key)throw Error('Mollie is nog niet ingesteld.');
 const response=await fetch(`https://api.mollie.com/v2/payment-links${path}`,{method:method||(body===undefined?'GET':'POST'),headers:{Authorization:`Bearer ${key}`,Accept:'application/json',...(body===undefined?{}:{'Content-Type':'application/json'}),...(idempotencyKey?{'Idempotency-Key':idempotencyKey}:{})},body:body===undefined?undefined:JSON.stringify(body),cache:'no-store',signal:AbortSignal.timeout(10000)});
 if(!response.ok)throw Error(`Mollie antwoordde met HTTP ${response.status}.`);
 return response.json();
}
function matchingAmount(data:{amount?:{currency?:string;value?:string}},row:PaymentRequest){return data.amount?.currency==='EUR'&&data.amount.value===(row.amount_cents/100).toFixed(2);}
export const paymentService=createPaymentService({
 store:paymentStore,now:()=>Date.now(),
 async createLink(row){
  const webhook=new URL('/api/management-payment-requests/webhook',getSiteUrl());webhook.searchParams.set('request',row.id);webhook.searchParams.set('token',webhookToken(row.id));
  const data=await mollie('',{description:`${paymentReference(row.id)} · ${row.description}`,amount:{currency:'EUR',value:(row.amount_cents/100).toFixed(2)},reusable:false,webhookUrl:webhook.toString()},row.id);
  if(!/^pl_[A-Za-z0-9]+$/.test(data.id)||!matchingAmount(data,row)||!['live','test'].includes(data.mode)||data.reusable!==false)throw Error('Onverwacht Mollie-antwoord.');
  const url=new URL(data._links?.paymentLink?.href||'');
  if(url.protocol!=='https:'||!['mollie.com','mollie.nl'].some(host=>url.hostname===host||url.hostname.endsWith(`.${host}`)))throw Error('Onverwachte betaallink.');
  return{mollie_link_id:data.id,checkout_url:url.toString(),mode:data.mode};
 },
 async readPaidAt(row){
  if(!row.mollie_link_id||!/^pl_[A-Za-z0-9]+$/.test(row.mollie_link_id))throw Error('Betaallink ontbreekt.');
  const link=await mollie(`/${encodeURIComponent(row.mollie_link_id)}`);
  if(link.id!==row.mollie_link_id||!matchingAmount(link,row)||link.mode!==row.mode||link.reusable!==false)throw Error('Mollie-status hoort niet bij dit verzoek.');
  if(!link.paidAt){
   if(link.archived===true||(link.expiresAt&&(!Number.isFinite(Date.parse(link.expiresAt))||Date.parse(link.expiresAt)<=Date.now())))throw Error('De betaallink is niet meer actief; controleer Mollie.');
   return null;
  }
  if(typeof link.paidAt!=='string'||!Number.isFinite(Date.parse(link.paidAt))||Date.parse(link.paidAt)>Date.now()+300000)throw Error('Onbekende betaaldatum.');
  return new Date(link.paidAt).toISOString();
 },
 async archiveLink(row){
  if(!row.mollie_link_id||!/^pl_[A-Za-z0-9]+$/.test(row.mollie_link_id))throw Error('Betaallink ontbreekt.');
  const link=await mollie(`/${encodeURIComponent(row.mollie_link_id)}`,{archived:true},undefined,'PATCH');
  if(link.id!==row.mollie_link_id||!matchingAmount(link,row)||link.mode!==row.mode||link.reusable!==false||link.archived!==true)throw Error('Archiveren niet bevestigd.');
 },
 async send(row,kind){
  // Reuse the existing authenticated HTML transport and its durable per-ID receipt.
  // This endpoint sends mail only; it does not create a wedding appointment.
  const internal=kind==='reminder'||kind==='followup';const result=await weddingWordPress('mail',{id:row[mailFields[kind].id],template:internal?'INTERNAL_CONFIRMATION':kind==='customer_reminder'?'CUSTOMER_REMINDER':'CUSTOMER_CONFIRMATION',email:row.recipient_email,...paymentMail(row,kind)});
  if(result?.sent!==true)throw Error('De mail is nog niet bevestigd.');
 }
});
export function paymentSummary(row:PaymentRequest){
 return{id:row.id,recipient_email:row.recipient_email,amount_cents:row.amount_cents,description:row.description,link_state:row.link_state,checkout_url:row.checkout_url,mode:row.mode,created_at:row.created_at,sent_at:row.sent_at,paid_at:row.paid_at,checked_at:row.checked_at,check_error:row.check_error,last_error:row.last_error,customer_mail_state:row.customer_mail_state,reminded_at:row.reminded_at,settlement_method:row.settlement_method,manual_paid_note:row.manual_paid_note,archive_error:row.archive_error,link_archived_at:row.link_archived_at,customer_reminder_mail_state:row.customer_reminder_mail_state,customer_reminder_sent_at:row.customer_reminder_sent_at,customer_reminder_due_at:row.customer_reminder_due_at,followup_sent_at:row.followup_sent_at};
}
export type PaymentSummary=ReturnType<typeof paymentSummary>;
export async function processPaymentRequests(){
 checked(await paymentDb().from(table).update({link_state:'uncertain',last_error:'De aanmaak is niet afgerond. Controleer Mollie voordat je een nieuw verzoek maakt; er is geen automatische herhaling.'}).eq('link_state','creating').lt('created_at',new Date(Date.now()-600000).toISOString()));
 const rows=checked(await paymentDb().from(table).select('id').eq('link_state','ready').or('paid_at.is.null,and(settlement_method.in.(bank,store),link_archived_at.is.null)').order('checked_at',{ascending:true,nullsFirst:true}).limit(20)) as {id:string}[];
 let checkedCount=0,failed=0;
 for(let offset=0;offset<rows.length;offset+=4)await Promise.all(rows.slice(offset,offset+4).map(async row=>{try{const result=await paymentService.process(row.id);checkedCount++;if(result.last_error||result.archive_error)failed++;}catch{failed++;}}));
 return{checked:checkedCount,failed};
}
