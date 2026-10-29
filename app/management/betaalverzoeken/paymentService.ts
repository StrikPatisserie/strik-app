import type { MailKind, PaymentRequest } from './paymentRequests';
import { DAY, followupDue, isOverdue, mailFields, paymentInput, reminderDue } from './paymentRequests';

export interface PaymentStore {
 insert(input:ReturnType<typeof paymentInput>,actorId:string):Promise<{created:boolean;row:PaymentRequest}>;
 get(id:string):Promise<PaymentRequest>;
 update(id:string,values:Partial<PaymentRequest>):Promise<PaymentRequest>;
 recordPaid(id:string,values:Partial<PaymentRequest>):Promise<PaymentRequest>;
 claimMail(row:PaymentRequest,kind:MailKind,now:string):Promise<PaymentRequest|null>;
}
type Dependencies={store:PaymentStore;createLink(row:PaymentRequest):Promise<Pick<PaymentRequest,'mollie_link_id'|'checkout_url'|'mode'>>;readPaidAt(row:PaymentRequest):Promise<string|null>;archiveLink(row:PaymentRequest):Promise<void>;send(row:PaymentRequest,kind:MailKind):Promise<void>;now():number};
export class PaymentConflictError extends Error {}
export function createPaymentService(deps:Dependencies) {
 async function sendMail(id:string,kind:MailKind) {
  const row=await deps.store.get(id);
  if(row.link_state!=='ready'||row.paid_at||(kind==='reminder'&&!reminderDue(row,deps.now()))||(kind==='followup'&&!followupDue(row,deps.now()))||(kind==='customer_reminder'&&(!row.customer_reminder_requested_at||!isOverdue(row,deps.now()))))return row;
  const {state:field}=mailFields[kind];if(row[field]==='sent')return row;
  const now=new Date(deps.now()).toISOString();
  const claimed=await deps.store.claimMail(row,kind,now);if(!claimed)return deps.store.get(id);
  // Check again immediately before the external side effect.
  if((await deps.store.get(id)).paid_at)return deps.store.get(id);
  try {
   await deps.send(claimed,kind);
   const confirmed=new Date(deps.now()).toISOString();
   return await deps.store.update(id,{[field]:'sent',...(kind==='customer'?{sent_at:row.sent_at||confirmed}:kind==='reminder'?{reminded_at:confirmed}:kind==='customer_reminder'?{customer_reminder_sent_at:confirmed,customer_reminder_due_at:new Date(deps.now()+7*DAY).toISOString()}:{followup_sent_at:confirmed}),last_error:null});
  }catch{
   return deps.store.update(id,{[field]:'failed',last_error:kind==='customer'?'De mail is nog niet bevestigd. Probeer de bestaande mail opnieuw; maak geen nieuw betaalverzoek.':kind==='customer_reminder'?'De herinnering is nog niet bevestigd. Dezelfde mail wordt veilig opnieuw geprobeerd.':'De interne waarschuwing is nog niet bevestigd; wordt opnieuw gecontroleerd.'});
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
 async function archiveManual(row:PaymentRequest){
  if(!row.paid_at||!['bank','store'].includes(row.settlement_method||'')||row.link_archived_at)return row;
  try{await deps.archiveLink(row);return await deps.store.update(row.id,{link_archived_at:new Date(deps.now()).toISOString(),archive_error:null,checked_at:new Date(deps.now()).toISOString(),check_error:null});}
  catch{return deps.store.update(row.id,{archive_error:'Handmatig als betaald vastgelegd. De Mollie-link kon nog niet worden gesloten; dit wordt opnieuw geprobeerd.',checked_at:new Date(deps.now()).toISOString()});}
 }
 async function sync(id:string) {
  const row=await deps.store.get(id);if(row.paid_at)return archiveManual(row);if(row.link_state!=='ready')return row;
  try {
   const paidAt=await deps.readPaidAt(row),checked_at=new Date(deps.now()).toISOString();
   // A concurrent manual payment must never be cleared by an unpaid Mollie read.
   if(paidAt)return deps.store.recordPaid(id,{paid_at:paidAt,settlement_method:'mollie',checked_at,check_error:null});
   return await deps.store.update(id,{checked_at,check_error:null});
  }catch {
   await deps.store.update(id,{checked_at:new Date(deps.now()).toISOString(),check_error:'De betaalstatus kon niet bij Mollie worden gecontroleerd.'});
   throw Error('De betaalstatus kon niet bij Mollie worden gecontroleerd.');
  }
 }
 async function markPaid(id:string,actorId:string,method:'bank'|'store',note:string){
  if(!['bank','store'].includes(method)||typeof note!=='string'||note.length>300||note.includes('\0'))throw Error('Kies bank of winkel en een notitie van maximaal 300 tekens.');
  let row:PaymentRequest;try{row=await sync(id);}catch{row=await deps.store.get(id);}
  if(row.paid_at)return archiveManual(row);
  if(row.link_state!=='ready')throw Error('Controleer eerst de aanmaak van dit betaalverzoek.');
  row=await deps.store.recordPaid(id,{paid_at:new Date(deps.now()).toISOString(),settlement_method:method,manual_paid_by:actorId,manual_paid_note:note.trim()||null,check_error:null,last_error:null});
  return archiveManual(row);
 }
 async function remindCustomer(id:string,actorId:string){
  let row=await sync(id);if(row.paid_at||row.customer_reminder_mail_state==='sent')return row;
  if(!isOverdue(row,deps.now()))throw new PaymentConflictError('Een klant­herinnering kan vanaf twee weken na verzending.');
  if(!row.customer_reminder_requested_at)row=await deps.store.update(id,{customer_reminder_requested_at:new Date(deps.now()).toISOString(),customer_reminder_requested_by:actorId});
  return sendMail(row.id,'customer_reminder');
 }
 async function process(id:string) {
  let row=await sync(id);if(row.link_state!=='ready'||row.paid_at)return row;
  row=await sendMail(id,'customer');
  if(row.customer_reminder_requested_at&&row.customer_reminder_mail_state!=='sent')row=await sendMail(id,'customer_reminder');
  if(reminderDue(row,deps.now()))row=await sendMail(id,'reminder');
  if(followupDue(row,deps.now()))row=await sendMail(id,'followup');
  return row;
 }
 return {create,sync,sendMail,process,markPaid,remindCustomer};
}
