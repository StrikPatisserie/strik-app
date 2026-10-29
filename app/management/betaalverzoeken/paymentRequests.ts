export type MailKind = 'customer' | 'reminder' | 'customer_reminder' | 'followup';
export type PaymentRequest = {
 id: string; actor_id: string; recipient_email: string; amount_cents: number; description: string;
 link_state: 'creating' | 'ready' | 'uncertain'; mollie_link_id: string | null; checkout_url: string | null; mode: 'live' | 'test' | null;
 created_at: string; sent_at: string | null; paid_at: string | null; checked_at: string | null; check_error: string | null; last_error: string | null;
 customer_mail_id: string; customer_mail_state: 'pending' | 'sending' | 'sent' | 'failed'; customer_mail_attempt_at: string | null;
 reminder_mail_id: string; reminder_mail_state: 'pending' | 'sending' | 'sent' | 'failed'; reminder_mail_attempt_at: string | null; reminded_at: string | null;
 mail_version:1|2; settlement_method:'mollie'|'bank'|'store'|null; manual_paid_by:string|null; manual_paid_note:string|null;
 link_archived_at:string|null; archive_error:string|null;
 customer_reminder_mail_id:string; customer_reminder_mail_state:'pending'|'sending'|'sent'|'failed'; customer_reminder_mail_attempt_at:string|null;
 customer_reminder_requested_at:string|null; customer_reminder_requested_by:string|null; customer_reminder_sent_at:string|null; customer_reminder_due_at:string|null;
 followup_mail_id:string; followup_mail_state:'pending'|'sending'|'sent'|'failed'; followup_mail_attempt_at:string|null; followup_sent_at:string|null;
};
export const validRequestId = (value: unknown): value is string => typeof value==='string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
export function parseAmount(value: unknown) {
 const text=String(value??'').trim().replace(',','.');
 if(!/^\d{1,6}(?:\.\d{1,2})?$/.test(text))throw Error('Vul een geldig bedrag in euro’s in, bijvoorbeeld 25,50.');
 const [euros,cents='']=text.split('.');const amount=Number(euros)*100+Number(cents.padEnd(2,'0'));
 if(amount<1||amount>10000000)throw Error('Kies een bedrag tussen € 0,01 en € 100.000,00.');
 return amount;
}
export function paymentInput(value: unknown) {
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Ongeldig betaalverzoek.');
 const input=value as Record<string,unknown>;
 if(!validRequestId(input.id))throw Error('Vernieuw het formulier voor een nieuw betaalverzoek.');
 const email=typeof input.email==='string'?input.email.trim().toLowerCase():'';
 if(email.length>254||!/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i.test(email))throw Error('Vul een geldig e-mailadres in.');
 if(input.description!==undefined&&typeof input.description!=='string')throw Error('Controleer de omschrijving.');
 const description=String(input.description||'').replace(/\s+/g,' ').trim()||'Betaalverzoek Strik Patisserie';
 if(description.length>180)throw Error('Gebruik maximaal 180 tekens voor de omschrijving.');
 return {id:input.id.toLowerCase(),recipient_email:email,amount_cents:parseAmount(input.amount),description};
}
export const paymentReference=(id:string)=>`BV-${id.replace(/-/g,'').slice(0,12).toUpperCase()}`;
export const euro=(cents:number)=>new Intl.NumberFormat('nl-NL',{style:'currency',currency:'EUR'}).format(cents/100);
export const DAY=86400000;
export const mailFields={
 customer:{state:'customer_mail_state',attempt:'customer_mail_attempt_at',id:'customer_mail_id'},
 reminder:{state:'reminder_mail_state',attempt:'reminder_mail_attempt_at',id:'reminder_mail_id'},
 customer_reminder:{state:'customer_reminder_mail_state',attempt:'customer_reminder_mail_attempt_at',id:'customer_reminder_mail_id'},
 followup:{state:'followup_mail_state',attempt:'followup_mail_attempt_at',id:'followup_mail_id'},
} as const;
export function isOverdue(row:Pick<PaymentRequest,'link_state'|'paid_at'|'customer_mail_state'|'sent_at'>,now=Date.now()) {
 return row.link_state==='ready'&&!row.paid_at&&row.customer_mail_state==='sent'&&Boolean(row.sent_at)&&Number.isFinite(Date.parse(row.sent_at!))&&now-Date.parse(row.sent_at!)>=14*DAY;
}
export function reminderDue(row:PaymentRequest,now=Date.now()) {
 return isOverdue(row,now)&&!row.customer_reminder_sent_at&&row.reminder_mail_state!=='sent';
}
export function followupDue(row:PaymentRequest,now=Date.now()) {
 return !row.paid_at&&row.customer_reminder_mail_state==='sent'&&Boolean(row.customer_reminder_due_at)&&Date.parse(row.customer_reminder_due_at!)<=now&&row.followup_mail_state!=='sent';
}
export type PaymentMailData=Pick<PaymentRequest,'id'|'recipient_email'|'amount_cents'|'description'|'checkout_url'|'created_at'|'sent_at'|'mail_version'|'customer_reminder_sent_at'>;
const escape=(value:unknown)=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
function legacyPaymentMail(row:PaymentMailData,internal=false) {
 const title=internal?'Dit betaalverzoek staat al twee weken open':'Je betaalverzoek van Strik';
 const reference=paymentReference(row.id);
 const date=new Intl.DateTimeFormat('nl-NL',{timeZone:'Europe/Amsterdam',dateStyle:'long'}).format(new Date(row.sent_at||row.created_at));
 const subject=internal?`Let op: betaalverzoek ${reference} staat al twee weken open`:`Betaalverzoek ${reference} · Strik Patisserie`;
 const intro=internal?`Het betaalverzoek aan ${escape(row.recipient_email)} is zojuist bij Mollie gecontroleerd en staat nog open. De klant krijgt niet automatisch een herinnering.`:'Bedankt voor je bestelling bij Strik Patisserie. Via de knop hieronder kun je veilig betalen met Mollie.';
 const url=internal?'https://app.strik-patisserie.nl/management/betaalverzoeken':row.checkout_url;
 const html=`<!doctype html><html lang="nl"><body style="margin:0;background:#eef2e9;color:#294334;font:16px Arial,sans-serif"><table role="presentation" width="100%"><tr><td align="center" style="padding:28px 12px"><table role="presentation" style="max-width:580px;width:100%;background:#fffdf8;border-radius:16px;overflow:hidden"><tr><td style="padding:30px;background:#294d39;color:#fffdf8"><p style="letter-spacing:3px;font-size:12px">STRIK PATISSERIE</p><h1 style="font:30px Georgia,serif">${title}</h1><p>${reference}</p></td></tr><tr><td style="padding:30px"><p style="line-height:1.7">${intro}</p><p style="font-size:34px;font-weight:bold;margin:24px 0">${escape(euro(row.amount_cents))}</p><p style="line-height:1.6">${escape(row.description)}</p><p style="color:#6a7768;font-size:13px">${internal?'Verstuurd op':'Referentie'}: ${internal?escape(date):reference}</p><p style="margin:30px 0"><a href="${escape(url)}" style="display:inline-block;padding:15px 25px;border-radius:8px;background:#294d39;color:#ffffff;text-decoration:none;font-weight:bold">${internal?'Open betaalverzoeken':'Veilig betalen'}</a></p>${internal?'':`<p style="font-size:12px;color:#6a7768;word-break:break-all">Werkt de knop niet? Open deze link:<br>${escape(url)}</p>`}<p style="line-height:1.6;margin-top:30px">Hartelijke groet,<br>Strik Patisserie</p><p style="font-size:12px;color:#6a7768">Vragen? Antwoord op deze mail of mail naar info@strik-patisserie.nl.</p></td></tr></table></td></tr></table></body></html>`;
 return {subject,html};
}

export function paymentMail(row:PaymentMailData,kind:MailKind|boolean='customer') {
 const type=typeof kind==='boolean'?(kind?'reminder':'customer'):kind;
 // Preserve the exact payload for existing transport receipts and sent previews.
 if(row.mail_version===1&&(type==='customer'||type==='reminder'))return legacyPaymentMail(row,type==='reminder');
 const internal=type==='reminder'||type==='followup',reference=paymentReference(row.id);
 const subject=type==='customer'?`Betaalverzoek ${reference} · Strik Patisserie`:type==='customer_reminder'?`Herinnering betaalverzoek ${reference} · Strik Patisserie`:type==='followup'?`Let op: betaalverzoek ${reference} na herinnering nog niet betaald`:`Let op: betaalverzoek ${reference} staat al twee weken open`;
 const intro=type==='customer'?'Bedankt voor je bestelling bij Strik Patisserie. Hieronder vind je je betaalverzoek. Wil je het bedrag binnen 14 dagen betalen?':type==='customer_reminder'?'Ons betaalverzoek staat nog open. Wil je het onderstaande bedrag binnen één week na deze herinnering betalen?':type==='followup'?`Het betaalverzoek aan ${escape(row.recipient_email)} is na de betaalherinnering nog steeds niet betaald. De betaaltermijn van één week is verstreken. Controleer of een bank- of winkelbetaling nog moet worden verwerkt.`:`Het betaalverzoek aan ${escape(row.recipient_email)} staat al twee weken open. Je kunt vanuit de app een betaalherinnering sturen.`;
 const url=internal?'https://app.strik-patisserie.nl/management/betaalverzoeken':row.checkout_url;
 const html=`<!doctype html><html lang="nl"><body style="margin:0;background:#ffffff;color:#26392e;font:15px Arial,sans-serif;line-height:1.65"><table role="presentation" width="100%" style="font-family:Arial,sans-serif;font-size:15px;line-height:1.65;color:#26392e;background:#ffffff"><tr><td align="center" style="padding:24px 16px"><table role="presentation" style="max-width:560px;width:100%"><tr><td style="padding-bottom:16px;border-bottom:2px solid #31563f;font-size:18px;font-weight:bold">Strik Patisserie</td></tr><tr><td style="padding-top:18px"><p>Beste ${internal?'collega':'klant'},</p><p>${intro}</p><table role="presentation" style="width:100%;border-collapse:collapse;margin:20px 0"><tr><td style="padding:6px 0;color:#637064">Bedrag</td><td style="padding:6px 0;text-align:right;font-size:23px;font-weight:bold">${escape(euro(row.amount_cents))}</td></tr><tr><td style="padding:6px 0;vertical-align:top;color:#637064">Omschrijving</td><td style="padding:6px 0;text-align:right">${escape(row.description)}</td></tr><tr><td style="padding:6px 0;color:#637064">Referentie</td><td style="padding:6px 0;text-align:right">${reference}</td></tr></table><p style="margin:24px 0"><a href="${escape(url)}" style="display:inline-block;background:#31563f;color:#ffffff;padding:11px 19px;border-radius:4px;text-decoration:none;font-weight:bold">${internal?'Open betaalverzoeken':'Veilig betalen'}</a></p>${internal?'':`<p style="font-size:12px;color:#637064;overflow-wrap:anywhere">Je betaalt veilig via Mollie. Werkt de knop niet? Gebruik deze link:<br><a style="color:#31563f" href="${escape(url)}">${escape(url)}</a></p>`}${type==='customer_reminder'?'<p>Heb je inmiddels betaald? Antwoord dan op deze mail, zodat we dit kunnen controleren.</p>':''}<p>Hartelijke groet,<br>Strik Patisserie</p><p style="font-size:12px;color:#637064;border-top:1px solid #e0e5dc;padding-top:14px">Vragen? Antwoord op deze mail of mail naar info@strik-patisserie.nl.</p></td></tr></table></td></tr></table></body></html>`;
 return {subject,html};
}
