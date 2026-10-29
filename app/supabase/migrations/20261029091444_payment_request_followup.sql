begin;
alter table public.management_payment_requests
 add column mail_version integer not null default 1 check(mail_version in(1,2)),
 add column settlement_method text check(settlement_method in('mollie','bank','store')),
 add column manual_paid_by uuid references auth.users(id),
 add column manual_paid_note text check(length(manual_paid_note)<=300),
 add column link_archived_at timestamptz,
 add column archive_error text,
 add column customer_reminder_mail_id uuid not null default gen_random_uuid(),
 add column customer_reminder_mail_state text not null default 'pending' check(customer_reminder_mail_state in('pending','sending','sent','failed')),
 add column customer_reminder_mail_attempt_at timestamptz,
 add column customer_reminder_requested_at timestamptz,
 add column customer_reminder_requested_by uuid references auth.users(id),
 add column customer_reminder_sent_at timestamptz,
 add column customer_reminder_due_at timestamptz,
 add column followup_mail_id uuid not null default gen_random_uuid(),
 add column followup_mail_state text not null default 'pending' check(followup_mail_state in('pending','sending','sent','failed')),
 add column followup_mail_attempt_at timestamptz,
 add column followup_sent_at timestamptz,
 add constraint management_payment_manual_audit check(settlement_method not in('bank','store') or (paid_at is not null and manual_paid_by is not null)),
 add constraint management_payment_reminder_deadline check(customer_reminder_due_at is null or (customer_reminder_sent_at is not null and customer_reminder_due_at>=customer_reminder_sent_at+interval '7 days'));
update public.management_payment_requests set settlement_method='mollie' where paid_at is not null;
create index management_payment_manual_archive on public.management_payment_requests(checked_at nulls first) where settlement_method in('bank','store') and link_archived_at is null and link_state='ready';
-- No browser grants or policies: this remains a server-only management table.
notify pgrst,'reload schema';
commit;
