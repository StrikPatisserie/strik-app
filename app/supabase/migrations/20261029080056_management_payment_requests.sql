begin;
create table public.management_payment_requests (
 id uuid primary key,
 actor_id uuid not null references auth.users(id),
 recipient_email text not null check(length(recipient_email) between 3 and 254),
 amount_cents integer not null check(amount_cents between 1 and 10000000),
 description text not null check(length(description) between 1 and 180),
 link_state text not null default 'creating' check(link_state in ('creating','ready','uncertain')),
 mollie_link_id text unique,
 checkout_url text,
 mode text check(mode in ('live','test')),
 created_at timestamptz not null default now(),
 sent_at timestamptz,
 paid_at timestamptz,
 checked_at timestamptz,
 check_error text,
 last_error text,
 customer_mail_id uuid not null default gen_random_uuid(),
 customer_mail_state text not null default 'pending' check(customer_mail_state in ('pending','sending','sent','failed')),
 customer_mail_attempt_at timestamptz,
 reminder_mail_id uuid not null default gen_random_uuid(),
 reminder_mail_state text not null default 'pending' check(reminder_mail_state in ('pending','sending','sent','failed')),
 reminder_mail_attempt_at timestamptz,
 reminded_at timestamptz,
 check(link_state<>'ready' or (mollie_link_id is not null and checkout_url is not null))
);
create index management_payment_requests_created on public.management_payment_requests(created_at desc);
create index management_payment_requests_sync on public.management_payment_requests(checked_at nulls first) where paid_at is null and link_state='ready';
alter table public.management_payment_requests enable row level security;
revoke all on public.management_payment_requests from public,anon,authenticated,service_role;
grant select,insert,update on public.management_payment_requests to service_role;
notify pgrst,'reload schema';
commit;
