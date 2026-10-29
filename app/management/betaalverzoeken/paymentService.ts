import type { MailKind, PaymentRequest } from './paymentRequests';
import { paymentInput, reminderDue } from './paymentRequests';

export interface PaymentStore {
 insert(input:ReturnType<typeof paymentInput>,actorId:string):Promise<{created:boolean;row:PaymentRequest}>;
 get(id:string):Promise<PaymentRequest>;
 update(id:string,values:Partial<PaymentRequest>):Promise<PaymentRequest>;
 claimMail(row:PaymentRequest,kind:MailKind,now:string):Promise<PaymentRequest|null>;
}
type Dependencies={store:PaymentStore;createLink(row:PaymentRequest):Promise<Pick<PaymentRequest,'mollie_link_id'|'checkout_url'|'mode'>>;readPaidAt(row:PaymentRequest):Promise<string|null>;send(row:PaymentRequest,kind:MailKind):Promise<void>;now():number};
export class PaymentConflictError extends Error {}
export function createPaymentService(deps:Dependencies) {
 async function sendMail(id:string,kind:MailKind) {
  const row=await deps.store.get(id);
  if(row.link_state!=='ready'||row.paid_at||(kind==='reminder'&&!reminderDue(row,deps.now())))return row;
  const field=kind==='customer'?'customer_mail_state':'reminder_mail_state';
  if(row[field]==='sent')return row;
  const now=new Date(deps.now()).toISOString();
  const claimed=await deps.store.claimMail(row,kind,now);if(!claimed)return deps.store.get(id);
  try {
   await deps.send(claimed,kind);
   return await deps.store.update(id,{[field]:'sent',...(kind==='customer'?{sent_at:row.sent_at||now}:{reminded_at:now}),last_error:null});
  }catch{
   // Stable transport IDs make a retry return the same durable mail receipt.
   return deps.store.update(id,{[field]:'failed',last_error:kind==='customer'?'De mail is nog niet bevestigd. Probeer de bestaande mail opnieuw; maak geen nieuw betaalverzoek.':'De interne waarschuwing is nog niet bevestigd; wordt opnieuw gecontroleerd.'});
  }
 }
 async function create(actorId:string,input:unknown) {
  const values=paymentInput(input);const inserted=await deps.store.insert(values,actorId);let row=inserted.row;
  if(row.actor_id!==actorId||row.recipient_email!==values.recipient_email||row.amount_cents!==values.amount_cents||row.description!==values.description)throw new PaymentConflictError('Deze verzendpoging hoort bij een ander verzoek. Open een nieuw formulier.');
  if(!inserted.created)return row;
  try {row=await deps.store.update(row.id,{...await deps.createLink(row),link_state:'ready',last_error:null});}
  catch {return deps.store.update(row.id,{link_state:'uncertain',last_error:'Mollie heeft de aanmaak niet bevestigd. Controleer Mollie voordat je een nieuw verzoek maakt; er is geen mail verstuurd.'});}
  return sendMail(row.id,'customer');
 }
 async function sync(id:string) {
  const row=await deps.store.get(id);if(row.link_state!=='ready')return row;
  try {
   const paidAt=await deps.readPaidAt(row);
   return await deps.store.update(id,{paid_at:paidAt||row.paid_at,checked_at:new Date(deps.now()).toISOString(),check_error:null});
  }catch {
   await deps.store.update(id,{checked_at:new Date(deps.now()).toISOString(),check_error:'De betaalstatus kon niet bij Mollie worden gecontroleerd.'});
   throw Error('De betaalstatus kon niet bij Mollie worden gecontroleerd.');
  }
 }
 async function process(id:string) {
  const row=await sync(id);if(row.link_state!=='ready'||row.paid_at)return row;
  const sent=await sendMail(id,'customer');
  if(reminderDue(sent,deps.now()))return sendMail(id,'reminder');
  return sent;
 }
 return {create,sync,sendMail,process};
}
