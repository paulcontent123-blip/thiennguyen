-- A wallet top-up is one business order; each VNPAY checkout attempt gets its own TxnRef.
create table public.wallet_topup_payment_attempts (
  id uuid primary key default gen_random_uuid(),
  topup_id uuid not null references public.wallet_topups(id) on delete restrict,
  attempt_no integer not null check (attempt_no > 0),
  tx_ref text not null unique check (length(trim(tx_ref)) between 8 and 100),
  status text not null default 'pending' check (status in ('pending', 'completed', 'failed', 'expired')),
  client_ip text not null default '127.0.0.1',
  gateway_txn_ref text unique,
  gateway_response_code text,
  gateway_bank_code text,
  ipn_received_at timestamptz,
  ipn_raw jsonb,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  completed_at timestamptz,
  unique (topup_id, attempt_no)
);

create index wallet_topup_payment_attempts_topup_idx
  on public.wallet_topup_payment_attempts(topup_id, attempt_no desc);
alter table public.wallet_topup_payment_attempts enable row level security;

-- Gateway IPN remains authoritative even if a delayed success arrives just after
-- the user-facing checkout expiry was marked failed.
create or replace function public.guard_wallet_topup_update()
returns trigger language plpgsql set search_path = '' as $$
declare
  is_gateway_vnpay_recovery boolean :=
    coalesce(current_setting('app.gateway_ipn', true), '') = 'on'
    and old.payment_provider = 'vnpay' and old.status = 'rejected' and new.status = 'completed';
  is_owner_cancellation boolean :=
    auth.uid() is not null and auth.uid() = old.user_id and old.status = 'pending'
    and old.payment_provider = 'bank_transfer' and new.status = 'cancelled';
begin
  if not public.is_admin()
    and coalesce(current_setting('app.gateway_ipn', true), '') <> 'on'
    and not is_owner_cancellation then
    raise exception 'Only Admin, verified gateway IPN, or the owner cancelling an unpaid manual top-up may update wallet top-ups';
  end if;
  if new.user_id is distinct from old.user_id or new.tx_ref is distinct from old.tx_ref
    or new.amount_vnd is distinct from old.amount_vnd or new.receiving_account_id is distinct from old.receiving_account_id
    or new.receiving_bank_id is distinct from old.receiving_bank_id or new.receiving_account_no is distinct from old.receiving_account_no
    or new.receiving_account_name is distinct from old.receiving_account_name or new.transfer_description is distinct from old.transfer_description
    or new.payment_provider is distinct from old.payment_provider or new.created_at is distinct from old.created_at then
    raise exception 'WALLET_TOPUP_IMMUTABLE_FIELDS';
  end if;
  if is_owner_cancellation then
    if new.admin_note is distinct from 'Hủy bởi người dùng trước khi chuyển khoản'
      or new.processed_by is distinct from old.processed_by or new.completed_at is distinct from old.completed_at
      or new.gateway_txn_ref is distinct from old.gateway_txn_ref or new.gateway_response_code is distinct from old.gateway_response_code
      or new.gateway_bank_code is distinct from old.gateway_bank_code or new.ipn_received_at is distinct from old.ipn_received_at
      or new.ipn_raw is distinct from old.ipn_raw then
      raise exception 'WALLET_TOPUP_CANCEL_FIELDS_INVALID';
    end if;
    return new;
  end if;
  if new.status is distinct from old.status and old.status <> 'pending' and not is_gateway_vnpay_recovery then
    raise exception 'WALLET_TOPUP_ALREADY_PROCESSED';
  end if;
  if new.status = 'rejected' and coalesce(length(trim(new.admin_note)), 0) < 3 then
    raise exception 'WALLET_TOPUP_REJECT_NOTE_REQUIRED';
  end if;
  return new;
end;
$$;

create or replace function public.credit_wallet_on_topup_completed()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'completed' and (
    old.status = 'pending' or (
      old.status = 'rejected' and old.payment_provider = 'vnpay'
      and coalesce(current_setting('app.gateway_ipn', true), '') = 'on'
    )
  ) then
    new.completed_at := coalesce(new.completed_at, now());
    insert into public.wallet_ledger (user_id, entry_type, amount_vnd, topup_id, note)
    values (new.user_id, 'topup', new.amount_vnd, new.id, 'Nạp ví ' || new.tx_ref);
  end if;
  return new;
end;
$$;

create or replace function public.expire_my_wallet_vnpay_topups()
returns void
language plpgsql security definer set search_path = '' as $$
declare
  expired_topup record;
begin
  if auth.uid() is null then raise exception 'WALLET_AUTH_REQUIRED'; end if;
  perform set_config('app.gateway_ipn', 'on', true);
  for expired_topup in
    select t.id
    from public.wallet_topups t
    join lateral (
      select a.status, a.expires_at from public.wallet_topup_payment_attempts a
      where a.topup_id = t.id order by a.attempt_no desc limit 1
    ) latest on true
    where t.user_id = auth.uid() and t.payment_provider = 'vnpay' and t.status = 'pending'
      and latest.status in ('pending', 'expired', 'failed') and latest.expires_at <= now()
    for update of t skip locked
  loop
    update public.wallet_topup_payment_attempts a set status = 'expired'
    where a.topup_id = expired_topup.id and a.status = 'pending' and a.expires_at <= now();
    update public.wallet_topups t set status = 'rejected', admin_note = 'Phiên thanh toán VNPAY đã hết hạn.'
    where t.id = expired_topup.id and t.status = 'pending';
  end loop;
end;
$$;
revoke all on function public.expire_my_wallet_vnpay_topups() from public;
grant execute on function public.expire_my_wallet_vnpay_topups() to authenticated;

-- Preserve existing VNPAY references so delayed IPNs for previously created orders still resolve.
insert into public.wallet_topup_payment_attempts (
  topup_id, attempt_no, tx_ref, status, gateway_txn_ref, gateway_response_code,
  gateway_bank_code, ipn_received_at, ipn_raw, created_at, expires_at, completed_at
)
select
  t.id, 1, t.tx_ref,
  -- Prior attempts did not persist their exact signed parameters/client IP, so
  -- they cannot safely be reconstructed. Let the first retry create a new ref.
  case when t.status = 'completed' then 'completed' when t.status = 'rejected' then 'failed' else 'expired' end,
  t.gateway_txn_ref, t.gateway_response_code, t.gateway_bank_code, t.ipn_received_at, t.ipn_raw,
  t.created_at, t.created_at, t.completed_at
from public.wallet_topups t
where t.payment_provider = 'vnpay'
on conflict (tx_ref) do nothing;

drop function if exists public.create_wallet_topup_vnpay(numeric);
create function public.create_wallet_topup_vnpay(p_amount_vnd numeric, p_client_ip text)
returns table (id uuid, tx_ref text, amount_vnd numeric, status text, created_at timestamptz, expires_at timestamptz, client_ip text)
language plpgsql security definer set search_path = '' as $$
declare
  account record;
  topup_id uuid;
  ref text;
  description text;
  now_at timestamptz := now();
  safe_ip text := coalesce(nullif(trim(p_client_ip), ''), '127.0.0.1');
begin
  if auth.uid() is null or not exists (select 1 from public.profiles p where p.id = auth.uid()) then
    raise exception 'WALLET_AUTH_REQUIRED';
  end if;
  if p_amount_vnd is null or p_amount_vnd < 10000 or p_amount_vnd > 10000000000 or trunc(p_amount_vnd) <> p_amount_vnd then
    raise exception 'WALLET_AMOUNT_INVALID';
  end if;
  if length(safe_ip) > 45 then safe_ip := '127.0.0.1'; end if;
  if (select count(*) from public.wallet_topups t where t.user_id = auth.uid() and t.status = 'pending') >= 5 then
    raise exception 'WALLET_TOO_MANY_PENDING';
  end if;

  select a.* into account from public.platform_receiving_accounts a
  where a.kind = 'domestic_vnd' and a.currency = 'VND' and a.is_active = true limit 1;
  if not found then raise exception 'PLATFORM_RECEIVING_ACCOUNT_NOT_CONFIGURED'; end if;

  ref := 'VIVNP' || to_char(now_at, 'YYYYMMDDHH24MISS') || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  description := 'Nap vi ' || ref;
  insert into public.wallet_topups (user_id, tx_ref, amount_vnd, payment_provider, receiving_account_id,
    receiving_bank_id, receiving_account_no, receiving_account_name, transfer_description)
  values (auth.uid(), ref, p_amount_vnd, 'vnpay', account.id, account.bank_id, account.account_no, account.account_name, description)
  returning wallet_topups.id into topup_id;

  insert into public.wallet_topup_payment_attempts(topup_id, attempt_no, tx_ref, client_ip, created_at, expires_at)
  values (topup_id, 1, ref, safe_ip, now_at, now_at + interval '15 minutes');

  return query select topup_id, ref, p_amount_vnd, 'pending'::text, now_at, now_at + interval '15 minutes', safe_ip;
end;
$$;
revoke all on function public.create_wallet_topup_vnpay(numeric, text) from public;
grant execute on function public.create_wallet_topup_vnpay(numeric, text) to authenticated;

create or replace function public.create_or_resume_wallet_topup_vnpay_attempt(p_topup_id uuid, p_client_ip text)
returns table (tx_ref text, amount_vnd numeric, created_at timestamptz, expires_at timestamptz, client_ip text)
language plpgsql security definer set search_path = '' as $$
declare
  topup_row public.wallet_topups%rowtype;
  attempt_row public.wallet_topup_payment_attempts%rowtype;
  next_no integer;
  ref text;
  now_at timestamptz := now();
  safe_ip text := coalesce(nullif(trim(p_client_ip), ''), '127.0.0.1');
begin
  if auth.uid() is null then raise exception 'WALLET_AUTH_REQUIRED'; end if;
  select * into topup_row from public.wallet_topups t
  where t.id = p_topup_id and t.user_id = auth.uid()
    and t.payment_provider = 'vnpay' and t.status = 'pending'
  for update;
  if not found then raise exception 'WALLET_VNPAY_TOPUP_NOT_RESUMABLE'; end if;
  if length(safe_ip) > 45 then safe_ip := '127.0.0.1'; end if;

  select * into attempt_row from public.wallet_topup_payment_attempts a
  where a.topup_id = p_topup_id
  order by a.attempt_no desc limit 1 for update;

  if found and attempt_row.status = 'pending' and attempt_row.expires_at > now_at then
    return query select attempt_row.tx_ref, topup_row.amount_vnd, attempt_row.created_at,
      attempt_row.expires_at, attempt_row.client_ip;
    return;
  end if;

  if found then
    perform set_config('app.gateway_ipn', 'on', true);
    update public.wallet_topup_payment_attempts a set status = 'expired'
    where a.id = attempt_row.id and a.status = 'pending';
    update public.wallet_topups t set status = 'rejected', admin_note = 'Phiên thanh toán VNPAY đã hết hạn.'
    where t.id = p_topup_id and t.status = 'pending';
    return;
  end if;

  select coalesce(max(a.attempt_no), 0) + 1 into next_no
  from public.wallet_topup_payment_attempts a where a.topup_id = p_topup_id;
  ref := 'VIVNP' || to_char(now_at, 'YYYYMMDDHH24MISS') || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  insert into public.wallet_topup_payment_attempts(topup_id, attempt_no, tx_ref, client_ip, created_at, expires_at)
  values (p_topup_id, next_no, ref, safe_ip, now_at, now_at + interval '15 minutes')
  returning * into attempt_row;
  return query select attempt_row.tx_ref, topup_row.amount_vnd, attempt_row.created_at,
    attempt_row.expires_at, attempt_row.client_ip;
end;
$$;
revoke all on function public.create_or_resume_wallet_topup_vnpay_attempt(uuid, text) from public;
grant execute on function public.create_or_resume_wallet_topup_vnpay_attempt(uuid, text) to authenticated;

create or replace function public.complete_wallet_topup_via_vnpay(
  p_tx_ref text, p_gateway_txn_ref text, p_response_code text, p_bank_code text, p_amount_vnd numeric, p_raw jsonb
)
returns table (id uuid, status text, already_processed boolean)
language plpgsql security definer set search_path = '' as $$
declare
  attempt_row public.wallet_topup_payment_attempts%rowtype;
  topup_row public.wallet_topups%rowtype;
begin
  perform set_config('app.gateway_ipn', 'on', true);
  select * into attempt_row from public.wallet_topup_payment_attempts a
  where a.tx_ref = p_tx_ref for update;
  if not found then raise exception 'VNPAY_TOPUP_ATTEMPT_NOT_FOUND'; end if;
  select * into topup_row from public.wallet_topups t where t.id = attempt_row.topup_id for update;
  if not found then raise exception 'VNPAY_TOPUP_NOT_FOUND'; end if;
  if topup_row.amount_vnd <> p_amount_vnd then raise exception 'VNPAY_AMOUNT_MISMATCH'; end if;
  if (topup_row.status <> 'pending' and not (topup_row.status = 'rejected' and p_response_code = '00'))
    or attempt_row.status = 'completed' then
    return query select topup_row.id, topup_row.status, true;
    return;
  end if;

  if p_response_code = '00' then
    update public.wallet_topups set
      status = 'completed', gateway_txn_ref = p_gateway_txn_ref, gateway_response_code = p_response_code,
      gateway_bank_code = p_bank_code, ipn_received_at = now(), ipn_raw = p_raw
    where wallet_topups.id = topup_row.id;
    update public.wallet_topup_payment_attempts set
      status = 'completed', gateway_txn_ref = p_gateway_txn_ref, gateway_response_code = p_response_code,
      gateway_bank_code = p_bank_code, ipn_received_at = now(), ipn_raw = p_raw, completed_at = now()
    where wallet_topup_payment_attempts.id = attempt_row.id;
    return query select topup_row.id, 'completed'::text, false;
  else
    update public.wallet_topups set
      status = 'rejected',
      admin_note = 'Thanh toán VNPAY thất bại (mã ' || coalesce(nullif(p_response_code, ''), 'không rõ') || ')',
      gateway_txn_ref = p_gateway_txn_ref, gateway_response_code = p_response_code,
      gateway_bank_code = p_bank_code, ipn_received_at = now(), ipn_raw = p_raw
    where wallet_topups.id = topup_row.id;
    update public.wallet_topup_payment_attempts set
      status = 'failed', gateway_txn_ref = p_gateway_txn_ref, gateway_response_code = p_response_code,
      gateway_bank_code = p_bank_code, ipn_received_at = now(), ipn_raw = p_raw
    where wallet_topup_payment_attempts.id = attempt_row.id;
    return query select topup_row.id, 'rejected'::text, false;
  end if;
end;
$$;
revoke all on function public.complete_wallet_topup_via_vnpay(text, text, text, text, numeric, jsonb) from public;
grant execute on function public.complete_wallet_topup_via_vnpay(text, text, text, text, numeric, jsonb) to service_role;

create or replace function public.fail_wallet_topup_vnpay_attempt(
  p_tx_ref text, p_response_code text, p_bank_code text, p_raw jsonb
)
returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  attempt_id uuid;
begin
  perform set_config('app.gateway_ipn', 'on', true);
  update public.wallet_topup_payment_attempts a set
    status = 'failed', gateway_response_code = p_response_code, gateway_bank_code = p_bank_code,
    ipn_received_at = now(), ipn_raw = p_raw
  from public.wallet_topups t
  where a.topup_id = t.id and a.tx_ref = p_tx_ref and a.status = 'pending'
    and t.payment_provider = 'vnpay' and t.status = 'pending'
    and p_response_code is not null and p_response_code <> '00'
  returning a.id into attempt_id;
  if attempt_id is not null then
    update public.wallet_topups set
      status = 'rejected',
      admin_note = 'Thanh toán VNPAY thất bại (mã ' || p_response_code || ')',
      gateway_response_code = p_response_code, gateway_bank_code = p_bank_code,
      ipn_received_at = now(), ipn_raw = p_raw
    where id = (select a.topup_id from public.wallet_topup_payment_attempts a where a.id = attempt_id);
  end if;
  return attempt_id is not null;
end;
$$;
revoke all on function public.fail_wallet_topup_vnpay_attempt(text, text, text, jsonb) from public;
grant execute on function public.fail_wallet_topup_vnpay_attempt(text, text, text, jsonb) to service_role;

create or replace function public.delete_failed_wallet_vnpay_topup(p_topup_id uuid)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  topup_row public.wallet_topups%rowtype;
begin
  if auth.uid() is null then raise exception 'WALLET_AUTH_REQUIRED'; end if;
  select * into topup_row from public.wallet_topups t
  where t.id = p_topup_id and t.user_id = auth.uid()
    and t.payment_provider = 'vnpay' and t.status = 'rejected'
  for update;
  if not found then raise exception 'WALLET_VNPAY_TOPUP_NOT_DELETABLE'; end if;
  if exists (select 1 from public.wallet_ledger l where l.topup_id = p_topup_id) then
    raise exception 'WALLET_VNPAY_TOPUP_HAS_LEDGER';
  end if;

  delete from public.wallet_topup_payment_attempts a where a.topup_id = p_topup_id;
  delete from public.wallet_topups t where t.id = p_topup_id and t.user_id = auth.uid();
  if not found then raise exception 'WALLET_VNPAY_TOPUP_NOT_DELETABLE'; end if;
end;
$$;
revoke all on function public.delete_failed_wallet_vnpay_topup(uuid) from public;
grant execute on function public.delete_failed_wallet_vnpay_topup(uuid) to authenticated;

comment on table public.wallet_topup_payment_attempts is
'Unique VNPAY checkout references per attempt, tied to one wallet top-up order. Retries reuse an unexpired URL reference or get a fresh reference after expiry.';
