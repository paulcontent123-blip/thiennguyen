-- Donation intent and VietQR preparation.
-- Webhook authentication is intentionally outside this migration because the
-- multi-tenant secret strategy still requires Tech Lead confirmation.

do $$
begin
  create type public.transaction_status as enum (
    'pending',
    'completed',
    'needs_review',
    'failed',
    'expired',
    'refunded'
  );
exception
  when duplicate_object then null;
end
$$;

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete restrict,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  user_id uuid references public.profiles(id) on delete set null,
  tx_ref text not null unique,
  status public.transaction_status not null default 'pending',
  amount_vnd numeric(18, 2) not null check (amount_vnd >= 10000 and amount_vnd <= 10000000000),
  amount_foreign numeric(18, 2),
  currency text not null default 'VND' check (currency ~ '^[A-Z]{3}$'),
  receipt_email text not null,
  donor_name text,
  payment_provider text not null default 'vietqr' check (payment_provider = 'vietqr'),
  receiving_bank_id text not null,
  receiving_account_no text not null,
  receiving_account_name text not null,
  transfer_description text not null,
  provider_transaction_id text unique,
  provider_event_id text unique,
  provider_payload jsonb,
  webhook_received_at timestamptz,
  webhook_matched_at timestamptz,
  completed_at timestamptz,
  receipt_sent_at timestamptz,
  failure_reason text,
  expires_at timestamptz not null default (now() + interval '24 hours'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (amount_foreign is null or amount_foreign > 0),
  check (length(trim(receipt_email)) between 5 and 254),
  check (donor_name is null or length(trim(donor_name)) between 2 and 120),
  check (length(trim(tx_ref)) between 8 and 40),
  check (expires_at > created_at)
);

create index if not exists transactions_campaign_status_created_idx
  on public.transactions (campaign_id, status, created_at desc);
create index if not exists transactions_user_created_idx
  on public.transactions (user_id, created_at desc)
  where user_id is not null;
create index if not exists transactions_organization_created_idx
  on public.transactions (organization_id, created_at desc);

drop trigger if exists transactions_set_updated_at on public.transactions;
create trigger transactions_set_updated_at before update on public.transactions
for each row execute function public.set_updated_at();

alter table public.transactions enable row level security;

drop policy if exists "transactions_donor_read" on public.transactions;
create policy "transactions_donor_read" on public.transactions
for select to authenticated
using (user_id = auth.uid());

drop policy if exists "transactions_organization_or_admin_read" on public.transactions;
create policy "transactions_organization_or_admin_read" on public.transactions
for select to authenticated
using (
  public.is_admin()
  or exists (
    select 1
    from public.organizations organization
    where organization.id = organization_id
      and organization.user_id = auth.uid()
  )
);

-- Donation intents are created through this RPC so callers cannot choose the
-- destination account, organization, status or transaction reference.
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
  payment_record record;
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
    campaign.slug,
    campaign.status,
    campaign.deadline
  into campaign_record
  from public.campaigns campaign
  join public.organizations organization on organization.id = campaign.organization_id
  where campaign.id = p_campaign_id
    and campaign.status = 'active'
    and (campaign.deadline is null or campaign.deadline >= current_date)
    and organization.license_status = 'approved';

  if not found then
    raise exception 'CAMPAIGN_NOT_ACCEPTING_DONATIONS';
  end if;

  select
    config.bank_id,
    config.account_no,
    config.account_name,
    config.description_template
  into payment_record
  from public.campaign_payment_configs config
  where config.campaign_id = campaign_record.id
    and config.is_active = true;

  if not found then
    raise exception 'CAMPAIGN_PAYMENT_NOT_CONFIGURED';
  end if;

  generated_ref := 'TN-' || to_char(now(), 'YYYY') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  generated_description := coalesce(nullif(trim(payment_record.description_template), ''), 'Ung ho {tx_ref}');
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
    user_id,
    tx_ref,
    amount_vnd,
    receipt_email,
    donor_name,
    receiving_bank_id,
    receiving_account_no,
    receiving_account_name,
    transfer_description
  ) values (
    campaign_record.id,
    campaign_record.organization_id,
    current_user_id,
    generated_ref,
    p_amount_vnd,
    normalized_email,
    normalized_name,
    payment_record.bank_id,
    payment_record.account_no,
    payment_record.account_name,
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

create or replace function public.get_campaign_donation_summary(p_campaign_id uuid)
returns table (
  total_amount_vnd numeric,
  completed_count bigint,
  last_completed_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    coalesce(sum(tx.amount_vnd), 0)::numeric,
    count(*)::bigint,
    max(tx.completed_at)
  from public.transactions tx
  where tx.campaign_id = p_campaign_id
    and tx.status = 'completed'
    and exists (
      select 1
      from public.campaigns campaign
      join public.organizations organization on organization.id = campaign.organization_id
      where campaign.id = p_campaign_id
        and campaign.status in ('approved', 'active', 'closed')
        and organization.license_status = 'approved'
    );
$$;

revoke all on function public.create_donation_intent(uuid, numeric, text, text) from public;
revoke all on function public.get_campaign_donation_summary(uuid) from public;
grant execute on function public.create_donation_intent(uuid, numeric, text, text) to anon, authenticated;
grant execute on function public.get_campaign_donation_summary(uuid) to anon, authenticated;
grant select on public.transactions to authenticated;
grant usage on type public.transaction_status to authenticated;

comment on table public.transactions is
'Donation intents and bank reconciliation records. Receiving bank fields are immutable snapshots selected by the server-side RPC.';
comment on column public.transactions.provider_event_id is
'Idempotency key supplied by the future bank webhook integration.';
comment on function public.create_donation_intent(uuid, numeric, text, text) is
'Creates a pending VietQR transaction for an active campaign without allowing the caller to select the receiving account.';
