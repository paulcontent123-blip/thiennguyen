-- Wallet allocation, end-to-end disbursement workflow and durable donation receipts.
-- All monetary mutations are performed by atomic SECURITY DEFINER functions.

-- ---------------------------------------------------------------------------
-- 1. Wallet balance and campaign allocations
-- ---------------------------------------------------------------------------

create table if not exists public.wallet_accounts (
  user_id uuid primary key references public.profiles(id) on delete restrict,
  available_balance_vnd numeric(18, 2) not null default 0 check (available_balance_vnd >= 0),
  total_credited_vnd numeric(18, 2) not null default 0 check (total_credited_vnd >= 0),
  total_allocated_vnd numeric(18, 2) not null default 0 check (total_allocated_vnd >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.wallet_allocations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete restrict,
  campaign_id uuid not null references public.campaigns(id) on delete restrict,
  transaction_id uuid unique references public.transactions(id) on delete restrict,
  amount_vnd numeric(18, 2) not null check (amount_vnd >= 10000 and amount_vnd <= 10000000000),
  status text not null default 'completed' check (status in ('completed', 'reversed')),
  idempotency_key uuid not null unique,
  reversal_reason text,
  reversed_at timestamptz,
  reversed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  check (
    (status = 'completed' and reversed_at is null and reversed_by is null)
    or (status = 'reversed' and reversed_at is not null and reversed_by is not null and length(trim(reversal_reason)) >= 3)
  )
);

create index if not exists wallet_allocations_user_created_idx
  on public.wallet_allocations (user_id, created_at desc);
create index if not exists wallet_allocations_campaign_created_idx
  on public.wallet_allocations (campaign_id, created_at desc);

alter table public.wallet_ledger
  drop constraint if exists wallet_ledger_entry_type_check;
alter table public.wallet_ledger
  add constraint wallet_ledger_entry_type_check check (entry_type in ('topup', 'allocation', 'reversal')),
  add column if not exists campaign_id uuid references public.campaigns(id) on delete restrict,
  add column if not exists transaction_id uuid references public.transactions(id) on delete restrict,
  add column if not exists allocation_id uuid references public.wallet_allocations(id) on delete restrict;

create unique index if not exists wallet_ledger_allocation_debit_unique
  on public.wallet_ledger (allocation_id) where entry_type = 'allocation';
create unique index if not exists wallet_ledger_allocation_reversal_unique
  on public.wallet_ledger (allocation_id) where entry_type = 'reversal';

insert into public.wallet_accounts (user_id, available_balance_vnd, total_credited_vnd, total_allocated_vnd)
select
  ledger.user_id,
  greatest(coalesce(sum(ledger.amount_vnd), 0), 0),
  coalesce(sum(ledger.amount_vnd) filter (where ledger.amount_vnd > 0), 0),
  abs(coalesce(sum(ledger.amount_vnd) filter (where ledger.amount_vnd < 0), 0))
from public.wallet_ledger ledger
group by ledger.user_id
on conflict (user_id) do update set
  available_balance_vnd = excluded.available_balance_vnd,
  total_credited_vnd = excluded.total_credited_vnd,
  total_allocated_vnd = excluded.total_allocated_vnd,
  updated_at = now();

create or replace function public.credit_wallet_on_topup_completed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'completed' and old.status = 'pending' then
    new.completed_at := coalesce(new.completed_at, now());

    insert into public.wallet_ledger (user_id, entry_type, amount_vnd, topup_id, note)
    values (new.user_id, 'topup', new.amount_vnd, new.id, 'Nap vi ' || new.tx_ref)
    on conflict (topup_id) do nothing;

    insert into public.wallet_accounts (user_id, available_balance_vnd, total_credited_vnd)
    values (new.user_id, new.amount_vnd, new.amount_vnd)
    on conflict (user_id) do update set
      available_balance_vnd = public.wallet_accounts.available_balance_vnd + excluded.available_balance_vnd,
      total_credited_vnd = public.wallet_accounts.total_credited_vnd + excluded.total_credited_vnd,
      updated_at = now();
  end if;
  return new;
end;
$$;

alter table public.transactions
  drop constraint if exists transactions_payment_provider_check;
alter table public.transactions
  add constraint transactions_payment_provider_check check (payment_provider in ('vietqr', 'wallet')),
  add column if not exists wallet_allocation_id uuid unique references public.wallet_allocations(id) on delete restrict,
  add column if not exists receipt_pdf_hash text,
  add column if not exists receipt_generated_at timestamptz,
  add column if not exists receipt_email_status text not null default 'pending'
    check (receipt_email_status in ('pending', 'sending', 'sent', 'failed')),
  add column if not exists receipt_email_attempts integer not null default 0 check (receipt_email_attempts >= 0),
  add column if not exists receipt_email_last_error text,
  add column if not exists receipt_provider_id text,
  add column if not exists receipt_next_retry_at timestamptz;

create or replace function public.allocate_wallet_to_campaign(
  p_campaign_id uuid,
  p_amount_vnd numeric,
  p_idempotency_key uuid
)
returns table (
  allocation_id uuid,
  transaction_id uuid,
  tx_ref text,
  amount_vnd numeric,
  balance_after_vnd numeric,
  campaign_slug text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  account_record public.wallet_accounts%rowtype;
  campaign_record record;
  profile_record record;
  user_email text;
  generated_ref text;
  new_allocation_id uuid;
  new_transaction_id uuid;
  existing_amount numeric;
  existing_balance numeric;
  existing_slug text;
begin
  if auth.uid() is null then raise exception 'WALLET_AUTH_REQUIRED'; end if;
  if p_idempotency_key is null then raise exception 'WALLET_IDEMPOTENCY_KEY_REQUIRED'; end if;
  if p_amount_vnd is null or p_amount_vnd < 10000 or p_amount_vnd > 10000000000 or trunc(p_amount_vnd) <> p_amount_vnd then
    raise exception 'WALLET_ALLOCATION_AMOUNT_INVALID';
  end if;

  select allocation.id, allocation.transaction_id, allocation.amount_vnd, account.available_balance_vnd, campaign.slug
  into new_allocation_id, new_transaction_id, existing_amount, existing_balance, existing_slug
  from public.wallet_allocations allocation
  join public.wallet_accounts account on account.user_id = allocation.user_id
  join public.campaigns campaign on campaign.id = allocation.campaign_id
  where allocation.idempotency_key = p_idempotency_key and allocation.user_id = auth.uid();
  if found then
    return query select new_allocation_id, new_transaction_id, transaction_record.tx_ref,
      existing_amount, existing_balance, existing_slug
    from public.transactions transaction_record where transaction_record.id = new_transaction_id;
    return;
  end if;

  select campaign.id, campaign.organization_id, campaign.owner_user_id, campaign.owner_type, campaign.slug, campaign.title
  into campaign_record
  from public.campaigns campaign
  where campaign.id = p_campaign_id
    and campaign.status = 'active'
    and (campaign.deadline is null or campaign.deadline >= current_date)
    and public.is_public_campaign(campaign.id);
  if not found then raise exception 'CAMPAIGN_NOT_ACCEPTING_DONATIONS'; end if;

  select profile.full_name, profile.role, auth_user.email
  into profile_record
  from public.profiles profile
  join auth.users auth_user on auth_user.id = profile.id
  where profile.id = auth.uid() and profile.role in ('donor', 'org');
  if not found then raise exception 'WALLET_ROLE_FORBIDDEN'; end if;
  user_email := profile_record.email;
  if coalesce(trim(user_email), '') = '' then raise exception 'WALLET_EMAIL_REQUIRED'; end if;

  insert into public.wallet_accounts (user_id) values (auth.uid()) on conflict (user_id) do nothing;
  select * into account_record from public.wallet_accounts where user_id = auth.uid() for update;
  if account_record.available_balance_vnd < p_amount_vnd then raise exception 'WALLET_INSUFFICIENT_BALANCE'; end if;

  generated_ref := 'VW-' || to_char(now(), 'YYYY') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  insert into public.wallet_allocations (user_id, campaign_id, amount_vnd, idempotency_key)
  values (auth.uid(), campaign_record.id, p_amount_vnd, p_idempotency_key)
  returning id into new_allocation_id;

  insert into public.transactions (
    campaign_id, organization_id, owner_user_id, user_id, tx_ref, status,
    amount_vnd, amount_foreign, currency, expected_amount, expected_currency,
    received_amount, received_currency, receipt_email, donor_name, payment_provider,
    receiving_bank_id, receiving_account_no, receiving_account_name,
    transfer_description, completed_at, webhook_matched_at, wallet_allocation_id
  ) values (
    campaign_record.id, campaign_record.organization_id,
    case when campaign_record.owner_type = 'individual' then campaign_record.owner_user_id else null end,
    auth.uid(), generated_ref, 'completed', p_amount_vnd, null, 'VND', p_amount_vnd, 'VND',
    p_amount_vnd, 'VND', lower(user_email), nullif(trim(profile_record.full_name), ''), 'wallet',
    'WALLET', 'WALLET', 'VI THIEN NGUYEN',
    'Phan bo so du vi ' || generated_ref, now(), now(), new_allocation_id
  ) returning id into new_transaction_id;

  update public.wallet_allocations set transaction_id = new_transaction_id where id = new_allocation_id;
  insert into public.wallet_ledger (
    user_id, entry_type, amount_vnd, campaign_id, transaction_id, allocation_id, note
  ) values (
    auth.uid(), 'allocation', -p_amount_vnd, campaign_record.id, new_transaction_id, new_allocation_id,
    'Ung ho chien dich: ' || campaign_record.title || ' (' || generated_ref || ')'
  );
  update public.wallet_accounts set
    available_balance_vnd = available_balance_vnd - p_amount_vnd,
    total_allocated_vnd = total_allocated_vnd + p_amount_vnd,
    updated_at = now()
  where user_id = auth.uid();

  return query select new_allocation_id, new_transaction_id, generated_ref, p_amount_vnd,
    account_record.available_balance_vnd - p_amount_vnd, campaign_record.slug;
end;
$$;

create or replace function public.reverse_wallet_allocation(p_allocation_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  allocation_record public.wallet_allocations%rowtype;
begin
  if not public.is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  if length(trim(coalesce(p_reason, ''))) < 3 then raise exception 'REVERSAL_REASON_REQUIRED'; end if;

  select * into allocation_record from public.wallet_allocations
  where id = p_allocation_id for update;
  if not found then raise exception 'WALLET_ALLOCATION_NOT_FOUND'; end if;
  if allocation_record.status <> 'completed' then raise exception 'WALLET_ALLOCATION_ALREADY_REVERSED'; end if;

  perform 1 from public.wallet_accounts where user_id = allocation_record.user_id for update;
  update public.transactions set status = 'refunded', failure_reason = trim(p_reason)
  where id = allocation_record.transaction_id and status = 'completed';
  if not found then raise exception 'WALLET_TRANSACTION_NOT_REVERSIBLE'; end if;

  insert into public.wallet_ledger (
    user_id, entry_type, amount_vnd, campaign_id, transaction_id, allocation_id, note
  ) values (
    allocation_record.user_id, 'reversal', allocation_record.amount_vnd,
    allocation_record.campaign_id, allocation_record.transaction_id, allocation_record.id,
    'Hoan phan bo vi: ' || trim(p_reason)
  );
  update public.wallet_accounts set
    available_balance_vnd = available_balance_vnd + allocation_record.amount_vnd,
    total_allocated_vnd = greatest(total_allocated_vnd - allocation_record.amount_vnd, 0),
    updated_at = now()
  where user_id = allocation_record.user_id;
  update public.wallet_allocations set
    status = 'reversed', reversal_reason = trim(p_reason), reversed_at = now(), reversed_by = auth.uid()
  where id = allocation_record.id;
end;
$$;

alter table public.wallet_accounts enable row level security;
alter table public.wallet_allocations enable row level security;
drop policy if exists "wallet_accounts_owner_or_admin_read" on public.wallet_accounts;
create policy "wallet_accounts_owner_or_admin_read" on public.wallet_accounts
for select to authenticated using (user_id = auth.uid() or public.is_admin());
drop policy if exists "wallet_allocations_owner_or_admin_read" on public.wallet_allocations;
create policy "wallet_allocations_owner_or_admin_read" on public.wallet_allocations
for select to authenticated using (user_id = auth.uid() or public.is_admin());

grant select on public.wallet_accounts, public.wallet_allocations to authenticated;
revoke all on function public.allocate_wallet_to_campaign(uuid, numeric, uuid) from public;
grant execute on function public.allocate_wallet_to_campaign(uuid, numeric, uuid) to authenticated;
revoke all on function public.reverse_wallet_allocation(uuid, text) from public;
grant execute on function public.reverse_wallet_allocation(uuid, text) to authenticated;

-- Permit receipt metadata updates by the server service role and a controlled
-- completed-wallet reversal by Admin. Other reconciliation fields stay guarded.
create or replace function public.guard_transaction_reconciliation_fields()
returns trigger
language plpgsql
as $$
begin
  if not public.is_admin() and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Only Admin or server service role may update transactions';
  end if;

  if new.campaign_id is distinct from old.campaign_id
    or new.organization_id is distinct from old.organization_id
    or new.owner_user_id is distinct from old.owner_user_id
    or new.user_id is distinct from old.user_id
    or new.tx_ref is distinct from old.tx_ref
    or new.amount_vnd is distinct from old.amount_vnd
    or new.amount_foreign is distinct from old.amount_foreign
    or new.currency is distinct from old.currency
    or new.receipt_email is distinct from old.receipt_email
    or new.donor_name is distinct from old.donor_name
    or new.payment_provider is distinct from old.payment_provider
    or new.receiving_bank_id is distinct from old.receiving_bank_id
    or new.receiving_account_no is distinct from old.receiving_account_no
    or new.receiving_account_name is distinct from old.receiving_account_name
    or new.transfer_description is distinct from old.transfer_description
    or new.wallet_allocation_id is distinct from old.wallet_allocation_id
    or new.created_at is distinct from old.created_at
    or new.expires_at is distinct from old.expires_at
  then
    raise exception 'Transaction immutable fields cannot be changed';
  end if;

  if new.status is distinct from old.status and not (
    old.status = 'pending'
    or (old.status = 'completed' and new.status = 'refunded' and old.payment_provider = 'wallet' and public.is_admin())
  ) then
    raise exception 'Invalid transaction reconciliation transition';
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Organization disbursement workflow
-- ---------------------------------------------------------------------------

alter table public.disbursements
  add column if not exists evidence_public_ids text[] not null default '{}',
  add column if not exists explanation text,
  add column if not exists explanation_submitted_at timestamptz,
  add column if not exists published_at timestamptz;

create table if not exists public.disbursement_status_history (
  id bigint generated always as identity primary key,
  disbursement_id uuid not null references public.disbursements(id) on delete cascade,
  status public.disbursement_status not null,
  post_audit_status public.post_audit_status not null,
  actor_id uuid references public.profiles(id) on delete set null,
  actor_name text not null default 'He thong',
  note text,
  created_at timestamptz not null default now()
);
create index if not exists disbursement_history_item_created_idx
  on public.disbursement_status_history (disbursement_id, created_at desc);

create or replace function public.guard_disbursement_audit_fields()
returns trigger
language plpgsql
as $$
declare
  explanation_resubmission boolean;
begin
  if new.campaign_id is distinct from old.campaign_id
    or new.submitted_by is distinct from old.submitted_by
    or new.created_at is distinct from old.created_at then
    raise exception 'Disbursement immutable fields cannot be changed';
  end if;

  explanation_resubmission :=
    old.status = 'representative_approved'
    and new.status = 'representative_approved'
    and old.post_audit_status = 'needs_explanation'
    and new.post_audit_status = 'not_reviewed'
    and coalesce(length(trim(new.explanation)), 0) >= 3
    and new.explanation is distinct from old.explanation
    and new.explanation_submitted_at is not null
    and new.post_audited_by is null
    and new.post_audited_at is null
    and new.post_audit_note is null;

  if not public.is_admin() then
    if (
      new.post_audit_status is distinct from old.post_audit_status
      or new.post_audited_by is distinct from old.post_audited_by
      or new.post_audited_at is distinct from old.post_audited_at
      or new.post_audit_note is distinct from old.post_audit_note
      or new.published_at is distinct from old.published_at
    ) and not explanation_resubmission then
      raise exception 'Only Admin may update post-audit fields';
    end if;

    if new.status is distinct from old.status and not (
      (old.status = 'draft' and new.status = 'submitted')
      or (old.status = 'submitted' and new.status = 'representative_approved')
    ) then
      raise exception 'Invalid organization disbursement transition';
    end if;

    if old.status <> 'draft' and (
      new.amount is distinct from old.amount
      or new.description is distinct from old.description
      or new.evidence_paths is distinct from old.evidence_paths
      or new.evidence_public_ids is distinct from old.evidence_public_ids
    ) then
      raise exception 'Submitted disbursement content is locked';
    end if;
  end if;
  return new;
end;
$$;

drop policy if exists "disbursements_owner_or_admin_read" on public.disbursements;
drop policy if exists "disbursements_owner_admin_or_public_read" on public.disbursements;
create policy "disbursements_owner_or_admin_read" on public.disbursements
for select to authenticated
using (public.is_admin() or public.is_campaign_owner(campaign_id));
drop policy if exists "disbursements_org_update" on public.disbursements;
create policy "disbursements_org_update" on public.disbursements
for update to authenticated
using (public.is_campaign_owner(campaign_id))
with check (submitted_by = auth.uid() and public.is_campaign_owner(campaign_id));

create or replace function public.approve_disbursement_by_representative(
  p_disbursement_id uuid,
  p_representative_name text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  disbursement_record record;
  available_amount numeric;
  committed_amount numeric;
begin
  select d.*, c.organization_id, c.status as campaign_status,
    o.user_id as organization_user_id, o.legal_representative_name, o.license_status
  into disbursement_record
  from public.disbursements d
  join public.campaigns c on c.id = d.campaign_id and c.owner_type = 'organization'
  join public.organizations o on o.id = c.organization_id
  where d.id = p_disbursement_id
  for update of d, c;

  if not found or disbursement_record.organization_user_id <> auth.uid() then raise exception 'DISBURSEMENT_FORBIDDEN'; end if;
  if disbursement_record.status <> 'submitted' then raise exception 'DISBURSEMENT_NOT_AWAITING_REPRESENTATIVE'; end if;
  if disbursement_record.license_status <> 'approved' then raise exception 'ORGANIZATION_NOT_VERIFIED'; end if;
  if disbursement_record.campaign_status not in ('active', 'closed') then raise exception 'CAMPAIGN_NOT_DISBURSABLE'; end if;
  if cardinality(disbursement_record.evidence_paths) = 0 then raise exception 'DISBURSEMENT_EVIDENCE_REQUIRED'; end if;
  if lower(trim(coalesce(p_representative_name, ''))) <> lower(trim(disbursement_record.legal_representative_name)) then
    raise exception 'REPRESENTATIVE_NAME_MISMATCH';
  end if;

  select coalesce(sum(coalesce(t.received_amount, t.amount_vnd)), 0)
  into available_amount from public.transactions t
  where t.campaign_id = disbursement_record.campaign_id and t.status = 'completed';
  select coalesce(sum(d.amount), 0)
  into committed_amount from public.disbursements d
  where d.campaign_id = disbursement_record.campaign_id
    and d.id <> disbursement_record.id
    and d.status in ('representative_approved', 'recorded', 'published')
    and d.post_audit_status <> 'violation';
  if committed_amount + disbursement_record.amount > available_amount then raise exception 'DISBURSEMENT_EXCEEDS_RECEIVED_FUNDS'; end if;

  update public.disbursements set
    status = 'representative_approved',
    representative_approved_at = now(),
    signature_method = 'legal_representative_confirmation',
    signature_reference = trim(p_representative_name),
    post_audit_status = 'not_reviewed',
    post_audit_note = null,
    post_audited_by = null,
    post_audited_at = null
  where id = p_disbursement_id;
end;
$$;

create or replace function public.submit_disbursement_explanation(
  p_disbursement_id uuid,
  p_explanation text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if length(trim(coalesce(p_explanation, ''))) < 3 then raise exception 'DISBURSEMENT_EXPLANATION_REQUIRED'; end if;
  update public.disbursements d set
    explanation = trim(p_explanation), explanation_submitted_at = now(),
    post_audit_status = 'not_reviewed', post_audit_note = null,
    post_audited_by = null, post_audited_at = null
  where d.id = p_disbursement_id
    and d.status = 'representative_approved'
    and d.post_audit_status = 'needs_explanation'
    and public.is_campaign_owner(d.campaign_id);
  if not found then raise exception 'DISBURSEMENT_EXPLANATION_NOT_ALLOWED'; end if;
end;
$$;

create or replace function public.log_disbursement_status_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_name text;
begin
  if tg_op = 'UPDATE'
    and new.status is not distinct from old.status
    and new.post_audit_status is not distinct from old.post_audit_status
    and new.explanation_submitted_at is not distinct from old.explanation_submitted_at then
    return new;
  end if;
  select nullif(trim(profile.full_name), '') into actor_name from public.profiles profile where profile.id = auth.uid();
  insert into public.disbursement_status_history (
    disbursement_id, status, post_audit_status, actor_id, actor_name, note
  ) values (
    new.id, new.status, new.post_audit_status, auth.uid(), coalesce(actor_name, 'He thong'),
    coalesce(new.post_audit_note, new.explanation)
  );
  return new;
end;
$$;

create or replace function public.get_public_campaign_cashflow(p_campaign_id uuid)
returns table (
  id uuid,
  amount numeric,
  description text,
  evidence_paths text[],
  post_audited_at timestamptz,
  published_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select d.id, d.amount, d.description, d.evidence_paths, d.post_audited_at, d.published_at
  from public.disbursements d
  where d.campaign_id = p_campaign_id
    and d.status = 'published'
    and d.post_audit_status = 'valid'
    and public.is_public_campaign(d.campaign_id)
  order by d.published_at desc;
$$;

drop trigger if exists disbursements_log_history on public.disbursements;
create trigger disbursements_log_history
after insert or update on public.disbursements
for each row execute function public.log_disbursement_status_history();

alter table public.disbursement_status_history enable row level security;
drop policy if exists "disbursement_history_read" on public.disbursement_status_history;
create policy "disbursement_history_read" on public.disbursement_status_history
for select to authenticated using (
  public.is_admin()
  or exists (
    select 1 from public.disbursements d
    where d.id = disbursement_id and public.is_campaign_owner(d.campaign_id)
  )
);
grant select on public.disbursement_status_history to authenticated;
revoke all on function public.approve_disbursement_by_representative(uuid, text) from public;
grant execute on function public.approve_disbursement_by_representative(uuid, text) to authenticated;
revoke all on function public.submit_disbursement_explanation(uuid, text) from public;
grant execute on function public.submit_disbursement_explanation(uuid, text) to authenticated;
revoke all on function public.get_public_campaign_cashflow(uuid) from public;
grant execute on function public.get_public_campaign_cashflow(uuid) to anon, authenticated;

comment on table public.wallet_accounts is 'Materialized wallet balance locked FOR UPDATE during allocation to prevent double spending.';
comment on table public.wallet_allocations is 'Atomic link between a wallet debit, campaign and completed donation transaction.';
comment on column public.transactions.receipt_pdf_hash is 'Lowercase SHA-256 hex digest of the deterministic server-generated PDF receipt.';
comment on column public.disbursements.published_at is 'Set only after Admin marks post-audit valid; this makes the expense public in the Cashflow Tree.';
