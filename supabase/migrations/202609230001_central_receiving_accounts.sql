-- Centralized donation receiving accounts confirmed by Tech Lead.
-- VEA operates one domestic VND account and one international account.
-- Campaign owners must not choose the receiving account.

do $$
begin
  create type public.receiving_account_kind as enum ('domestic_vnd', 'international');
exception
  when duplicate_object then null;
end
$$;

create table if not exists public.platform_receiving_accounts (
  id uuid primary key default gen_random_uuid(),
  kind public.receiving_account_kind not null,
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  provider text not null,
  bank_id text,
  bank_name text not null,
  account_no text not null,
  account_name text not null,
  swift_code text,
  iban text,
  qr_image_url text,
  transfer_description_template text not null default 'Ung ho {tx_ref}',
  is_active boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (kind = 'domestic_vnd' and currency = 'VND' and bank_id is not null)
    or kind = 'international'
  ),
  check (length(trim(provider)) between 2 and 80),
  check (length(trim(bank_name)) between 2 and 160),
  check (length(trim(account_no)) between 4 and 80),
  check (length(trim(account_name)) between 2 and 160),
  check (length(transfer_description_template) between 1 and 120)
);

create unique index if not exists platform_receiving_accounts_active_currency_idx
  on public.platform_receiving_accounts (currency)
  where is_active = true;

drop trigger if exists platform_receiving_accounts_set_updated_at on public.platform_receiving_accounts;
create trigger platform_receiving_accounts_set_updated_at
before update on public.platform_receiving_accounts
for each row execute function public.set_updated_at();

alter table public.platform_receiving_accounts enable row level security;

drop policy if exists "platform_receiving_accounts_admin_all" on public.platform_receiving_accounts;
create policy "platform_receiving_accounts_admin_all"
on public.platform_receiving_accounts
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

grant select, insert, update, delete on public.platform_receiving_accounts to authenticated;
grant usage on type public.receiving_account_kind to authenticated;

-- campaign_payment_configs is retained only as legacy data so old migrations
-- and deployments remain reversible. It is no longer a donation destination.
drop policy if exists "campaign_payment_configs_public_read" on public.campaign_payment_configs;
drop policy if exists "campaign_payment_configs_owner_or_admin_all" on public.campaign_payment_configs;
drop policy if exists "campaign_payment_configs_admin_all" on public.campaign_payment_configs;
create policy "campaign_payment_configs_admin_all"
on public.campaign_payment_configs
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

alter table public.transactions
  add column if not exists receiving_account_id uuid references public.platform_receiving_accounts(id) on delete restrict,
  add column if not exists expected_amount numeric(18, 2),
  add column if not exists expected_currency text,
  add column if not exists received_amount numeric(18, 2),
  add column if not exists received_currency text,
  add column if not exists bank_fee numeric(18, 2),
  add column if not exists exchange_rate numeric(24, 10),
  add column if not exists reconciliation_note text;

update public.transactions
set expected_amount = coalesce(expected_amount, amount_vnd),
    expected_currency = coalesce(expected_currency, currency)
where expected_amount is null or expected_currency is null;

alter table public.transactions
  alter column expected_amount set not null,
  alter column expected_currency set not null;

alter table public.transactions
  drop constraint if exists transactions_expected_currency_check,
  add constraint transactions_expected_currency_check check (expected_currency ~ '^[A-Z]{3}$'),
  drop constraint if exists transactions_received_currency_check,
  add constraint transactions_received_currency_check check (received_currency is null or received_currency ~ '^[A-Z]{3}$'),
  drop constraint if exists transactions_expected_amount_check,
  add constraint transactions_expected_amount_check check (expected_amount > 0),
  drop constraint if exists transactions_received_amount_check,
  add constraint transactions_received_amount_check check (received_amount is null or received_amount > 0);

create index if not exists transactions_receiving_account_created_idx
  on public.transactions (receiving_account_id, created_at desc)
  where receiving_account_id is not null;

create table if not exists public.bank_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_event_id text not null,
  provider_transaction_id text,
  receiving_account_id uuid references public.platform_receiving_accounts(id) on delete restrict,
  transaction_id uuid references public.transactions(id) on delete set null,
  tx_ref text,
  amount numeric(18, 2),
  currency text check (currency is null or currency ~ '^[A-Z]{3}$'),
  signature_valid boolean not null default false,
  processing_status text not null default 'received'
    check (processing_status in ('received', 'matched', 'needs_review', 'rejected', 'processed')),
  failure_reason text,
  payload jsonb not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (provider, provider_event_id)
);

create index if not exists bank_webhook_events_status_received_idx
  on public.bank_webhook_events (processing_status, received_at desc);
create index if not exists bank_webhook_events_tx_ref_idx
  on public.bank_webhook_events (tx_ref)
  where tx_ref is not null;

alter table public.bank_webhook_events enable row level security;
drop policy if exists "bank_webhook_events_admin_read" on public.bank_webhook_events;
create policy "bank_webhook_events_admin_read"
on public.bank_webhook_events
for select to authenticated
using (public.is_admin());
grant select on public.bank_webhook_events to authenticated;

create or replace function public.donation_currency_available(p_currency text default 'VND')
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.platform_receiving_accounts account
    where account.currency = upper(trim(p_currency))
      and account.is_active = true
  );
$$;

revoke all on function public.donation_currency_available(text) from public;
grant execute on function public.donation_currency_available(text) to anon, authenticated;

-- The current product UI accepts VND. The international account is stored in
-- the same model but will be selected only after the bank confirms its QR/API
-- contract, supported currencies, exchange-rate and fee rules.
create or replace function public.create_donation_intent(
  p_campaign_id uuid,
  p_amount_vnd numeric,
  p_receipt_email text,
  p_donor_name text default null
)
returns table (
  id uuid,
  tx_ref text,
  amount_vnd numeric,
  status text,
  bank_id text,
  account_no text,
  account_name text,
  transfer_description text,
  expires_at timestamptz,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  campaign_record record;
  receiving_account record;
  normalized_email text;
  normalized_name text;
  generated_ref text;
  generated_description text;
  current_user_id uuid;
begin
  if p_amount_vnd is null
    or p_amount_vnd < 10000
    or p_amount_vnd > 10000000000
    or trunc(p_amount_vnd) <> p_amount_vnd then
    raise exception 'DONATION_AMOUNT_INVALID';
  end if;

  normalized_email := lower(trim(coalesce(p_receipt_email, '')));
  if normalized_email = ''
    or length(normalized_email) > 254
    or normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'DONATION_EMAIL_INVALID';
  end if;

  normalized_name := nullif(trim(coalesce(p_donor_name, '')), '');
  if normalized_name is not null and length(normalized_name) not between 2 and 120 then
    raise exception 'DONATION_NAME_INVALID';
  end if;

  select
    campaign.id,
    campaign.organization_id,
    campaign.owner_user_id,
    campaign.owner_type,
    campaign.slug
  into campaign_record
  from public.campaigns campaign
  left join public.organizations organization on organization.id = campaign.organization_id
  left join public.personal_profiles personal_profile on personal_profile.user_id = campaign.owner_user_id
  where campaign.id = p_campaign_id
    and campaign.status = 'active'
    and (campaign.deadline is null or campaign.deadline >= current_date)
    and (
      (campaign.owner_type = 'organization' and organization.license_status = 'approved')
      or (campaign.owner_type = 'individual' and personal_profile.verification_status = 'approved')
    );

  if not found then
    raise exception 'CAMPAIGN_NOT_ACCEPTING_DONATIONS';
  end if;

  select account.*
  into receiving_account
  from public.platform_receiving_accounts account
  where account.kind = 'domestic_vnd'
    and account.currency = 'VND'
    and account.is_active = true
  limit 1;

  if not found then
    raise exception 'PLATFORM_RECEIVING_ACCOUNT_NOT_CONFIGURED';
  end if;

  generated_ref := 'TN-' || to_char(now(), 'YYYY') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  generated_description := receiving_account.transfer_description_template;
  generated_description := replace(generated_description, '{campaign_slug}', campaign_record.slug);
  generated_description := replace(generated_description, '{campaign_id}', campaign_record.id::text);
  generated_description := replace(generated_description, '{tx_ref}', generated_ref);
  if position(generated_ref in generated_description) = 0 then
    generated_description := left(generated_description, 100) || ' ' || generated_ref;
  end if;

  current_user_id := auth.uid();
  if current_user_id is not null
    and not exists (select 1 from public.profiles profile where profile.id = current_user_id) then
    current_user_id := null;
  end if;

  return query
  insert into public.transactions (
    campaign_id,
    organization_id,
    owner_user_id,
    user_id,
    tx_ref,
    amount_vnd,
    currency,
    expected_amount,
    expected_currency,
    receipt_email,
    donor_name,
    payment_provider,
    receiving_account_id,
    receiving_bank_id,
    receiving_account_no,
    receiving_account_name,
    transfer_description
  ) values (
    campaign_record.id,
    campaign_record.organization_id,
    case when campaign_record.owner_type = 'individual' then campaign_record.owner_user_id else null end,
    current_user_id,
    generated_ref,
    p_amount_vnd,
    'VND',
    p_amount_vnd,
    'VND',
    normalized_email,
    normalized_name,
    'vietqr',
    receiving_account.id,
    receiving_account.bank_id,
    receiving_account.account_no,
    receiving_account.account_name,
    generated_description
  )
  returning
    transactions.id,
    transactions.tx_ref,
    transactions.amount_vnd,
    transactions.status::text,
    transactions.receiving_bank_id,
    transactions.receiving_account_no,
    transactions.receiving_account_name,
    transactions.transfer_description,
    transactions.expires_at,
    transactions.created_at;
end;
$$;

revoke all on function public.create_donation_intent(uuid, numeric, text, text) from public;
grant execute on function public.create_donation_intent(uuid, numeric, text, text) to anon, authenticated;

comment on table public.platform_receiving_accounts is
'Central VEA receiving accounts. Only Admin can configure them; campaign owners cannot select donation destinations.';
comment on table public.bank_webhook_events is
'Immutable-ish webhook inbox used for signature audit, idempotency and manual reconciliation.';
comment on table public.campaign_payment_configs is
'Legacy per-campaign payment configuration. No longer used as a donation destination after central-account migration.';
comment on function public.create_donation_intent(uuid, numeric, text, text) is
'Creates a VND donation intent and selects the active central VEA domestic receiving account.';
