-- Tích hợp cổng thanh toán VNPAY cho quyên góp và nạp ví (thay cho đối soát tay theo yêu cầu techlead).
-- Backend nhận IPN, xác minh chữ ký HMAC-SHA512 rồi mới gọi các RPC dưới đây để ghi nhận thành công.
-- Giữ nguyên đường VietQR/chuyển khoản thủ công làm phương án dự phòng khi cổng VNPAY gặp sự cố.

alter table public.transactions
  drop constraint if exists transactions_payment_provider_check,
  add constraint transactions_payment_provider_check check (payment_provider in ('vietqr', 'wallet', 'vnpay')),
  add column if not exists gateway_txn_ref text,
  add column if not exists gateway_response_code text,
  add column if not exists gateway_bank_code text,
  add column if not exists ipn_received_at timestamptz,
  add column if not exists ipn_raw jsonb;

create unique index if not exists transactions_gateway_txn_ref_unique
  on public.transactions (gateway_txn_ref) where gateway_txn_ref is not null;

alter table public.wallet_topups
  add column if not exists payment_provider text not null default 'bank_transfer'
    check (payment_provider in ('bank_transfer', 'vnpay')),
  add column if not exists gateway_txn_ref text,
  add column if not exists gateway_response_code text,
  add column if not exists gateway_bank_code text,
  add column if not exists ipn_received_at timestamptz,
  add column if not exists ipn_raw jsonb;

create unique index if not exists wallet_topups_gateway_txn_ref_unique
  on public.wallet_topups (gateway_txn_ref) where gateway_txn_ref is not null;

-- Cho phép RPC ghi nhận IPN (chạy bằng service role, auth.uid() là null) đi qua guard,
-- bằng cờ transaction-local giống pattern app.sos_auto_close / app.resource_need_sync.
create or replace function public.guard_wallet_topup_update()
returns trigger language plpgsql as $$
begin
  if not public.is_admin() and coalesce(current_setting('app.gateway_ipn', true), '') <> 'on' then
    raise exception 'Only Admin or a verified gateway IPN may update wallet top-ups';
  end if;
  if new.user_id is distinct from old.user_id
    or new.tx_ref is distinct from old.tx_ref
    or new.amount_vnd is distinct from old.amount_vnd
    or new.receiving_account_id is distinct from old.receiving_account_id
    or new.receiving_bank_id is distinct from old.receiving_bank_id
    or new.receiving_account_no is distinct from old.receiving_account_no
    or new.receiving_account_name is distinct from old.receiving_account_name
    or new.transfer_description is distinct from old.transfer_description
    or new.payment_provider is distinct from old.payment_provider
    or new.created_at is distinct from old.created_at then
    raise exception 'WALLET_TOPUP_IMMUTABLE_FIELDS';
  end if;
  if new.status is distinct from old.status and old.status <> 'pending' then
    raise exception 'WALLET_TOPUP_ALREADY_PROCESSED';
  end if;
  if new.status = 'rejected' and coalesce(length(trim(new.admin_note)), 0) < 3 then
    raise exception 'WALLET_TOPUP_REJECT_NOTE_REQUIRED';
  end if;
  return new;
end;
$$;

-- Đối soát ngân hàng thủ công (transactions) cũng cần chấp nhận cờ gateway IPN.
create or replace function public.guard_transaction_reconciliation_fields()
returns trigger
language plpgsql
as $$
begin
  if not public.is_admin() and coalesce(current_setting('app.gateway_ipn', true), '') <> 'on' then
    raise exception 'Only Admin or a verified gateway IPN may update transactions';
  end if;

  if new.campaign_id is distinct from old.campaign_id
    or new.organization_id is distinct from old.organization_id
    or new.user_id is distinct from old.user_id
    or new.tx_ref is distinct from old.tx_ref
    or new.amount_vnd is distinct from old.amount_vnd
    or new.amount_foreign is distinct from old.amount_foreign
    or new.currency is distinct from old.currency
    or new.receipt_email is distinct from old.receipt_email
    or new.donor_name is distinct from old.donor_name
    or new.receiving_bank_id is distinct from old.receiving_bank_id
    or new.receiving_account_no is distinct from old.receiving_account_no
    or new.receiving_account_name is distinct from old.receiving_account_name
    or new.transfer_description is distinct from old.transfer_description
    or new.payment_provider is distinct from old.payment_provider
    or new.created_at is distinct from old.created_at
    or new.expires_at is distinct from old.expires_at
  then
    raise exception 'Admin/gateway may only update reconciliation fields (status, completed_at, failure_reason, gateway_*, ipn_*)';
  end if;

  if new.status is distinct from old.status and old.status <> 'pending' then
    raise exception 'Only pending transactions can be reconciled';
  end if;

  return new;
end;
$$;

-- Tạo giao dịch quyên góp qua VNPAY (không có VietQR tĩnh; server dựng URL thanh toán sau khi có tx_ref).
create or replace function public.create_donation_intent_vnpay(
  p_campaign_id uuid,
  p_amount_vnd numeric,
  p_receipt_email text,
  p_donor_name text default null
)
returns table (id uuid, tx_ref text, amount_vnd numeric, status text, expires_at timestamptz, created_at timestamptz)
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
  if p_amount_vnd is null or p_amount_vnd < 10000 or p_amount_vnd > 10000000000 or trunc(p_amount_vnd) <> p_amount_vnd then
    raise exception 'DONATION_AMOUNT_INVALID';
  end if;

  normalized_email := lower(trim(coalesce(p_receipt_email, '')));
  if normalized_email = '' or length(normalized_email) > 254
    or normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'DONATION_EMAIL_INVALID';
  end if;

  normalized_name := nullif(trim(coalesce(p_donor_name, '')), '');
  if normalized_name is not null and length(normalized_name) not between 2 and 120 then
    raise exception 'DONATION_NAME_INVALID';
  end if;

  select campaign.id, campaign.organization_id, campaign.owner_user_id, campaign.owner_type, campaign.slug
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
  if not found then raise exception 'CAMPAIGN_NOT_ACCEPTING_DONATIONS'; end if;

  select account.* into receiving_account
  from public.platform_receiving_accounts account
  where account.kind = 'domestic_vnd' and account.currency = 'VND' and account.is_active = true
  limit 1;
  if not found then raise exception 'PLATFORM_RECEIVING_ACCOUNT_NOT_CONFIGURED'; end if;

  generated_ref := 'TNVNP' || to_char(now(), 'YYYYMMDDHH24MISS') || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
  generated_description := 'Ung ho ' || generated_ref;

  current_user_id := auth.uid();
  if current_user_id is not null and not exists (select 1 from public.profiles profile where profile.id = current_user_id) then
    current_user_id := null;
  end if;

  return query
  insert into public.transactions (
    campaign_id, organization_id, owner_user_id, user_id, tx_ref, amount_vnd, currency,
    expected_amount, expected_currency, receipt_email, donor_name, payment_provider,
    receiving_account_id, receiving_bank_id, receiving_account_no, receiving_account_name, transfer_description
  ) values (
    campaign_record.id, campaign_record.organization_id,
    case when campaign_record.owner_type = 'individual' then campaign_record.owner_user_id else null end,
    current_user_id, generated_ref, p_amount_vnd, 'VND', p_amount_vnd, 'VND',
    normalized_email, normalized_name, 'vnpay',
    receiving_account.id, receiving_account.bank_id, receiving_account.account_no, receiving_account.account_name,
    generated_description
  )
  returning transactions.id, transactions.tx_ref, transactions.amount_vnd, transactions.status::text,
    transactions.expires_at, transactions.created_at;
end;
$$;
revoke all on function public.create_donation_intent_vnpay(uuid, numeric, text, text) from public;
grant execute on function public.create_donation_intent_vnpay(uuid, numeric, text, text) to anon, authenticated;

-- Tạo yêu cầu nạp ví qua VNPAY.
create or replace function public.create_wallet_topup_vnpay(p_amount_vnd numeric)
returns table (id uuid, tx_ref text, amount_vnd numeric, status text, created_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare
  account record;
  ref text;
  description text;
begin
  if auth.uid() is null or not exists (select 1 from public.profiles where id = auth.uid()) then
    raise exception 'WALLET_AUTH_REQUIRED';
  end if;
  if p_amount_vnd is null or p_amount_vnd < 10000 or p_amount_vnd > 10000000000 or trunc(p_amount_vnd) <> p_amount_vnd then
    raise exception 'WALLET_AMOUNT_INVALID';
  end if;
  if (select count(*) from public.wallet_topups t where t.user_id = auth.uid() and t.status = 'pending') >= 5 then
    raise exception 'WALLET_TOO_MANY_PENDING';
  end if;

  select a.* into account from public.platform_receiving_accounts a
  where a.kind = 'domestic_vnd' and a.currency = 'VND' and a.is_active = true limit 1;
  if not found then raise exception 'PLATFORM_RECEIVING_ACCOUNT_NOT_CONFIGURED'; end if;

  ref := 'VIVNP' || to_char(now(), 'YYYYMMDDHH24MISS') || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
  description := 'Nap vi ' || ref;

  return query
  insert into public.wallet_topups (user_id, tx_ref, amount_vnd, payment_provider, receiving_account_id,
    receiving_bank_id, receiving_account_no, receiving_account_name, transfer_description)
  values (auth.uid(), ref, p_amount_vnd, 'vnpay', account.id, account.bank_id, account.account_no, account.account_name, description)
  returning wallet_topups.id, wallet_topups.tx_ref, wallet_topups.amount_vnd, wallet_topups.status, wallet_topups.created_at;
end;
$$;
revoke all on function public.create_wallet_topup_vnpay(numeric) from public;
grant execute on function public.create_wallet_topup_vnpay(numeric) to authenticated;

-- Ghi nhận IPN thành công cho quyên góp. Chỉ gọi được sau khi API route đã xác minh chữ ký VNPAY.
-- Idempotent: gọi lại với cùng gateway_txn_ref trên giao dịch đã completed sẽ không xử lý lại (trùng khớp vnp_TxnRef unique).
create or replace function public.complete_donation_via_vnpay(
  p_tx_ref text, p_gateway_txn_ref text, p_response_code text, p_bank_code text, p_amount_vnd numeric, p_raw jsonb
)
returns table (id uuid, status text, already_processed boolean)
language plpgsql security definer set search_path = '' as $$
declare
  row_record record;
begin
  perform set_config('app.gateway_ipn', 'on', true);

  select * into row_record from public.transactions where tx_ref = p_tx_ref and payment_provider = 'vnpay' for update;
  if not found then raise exception 'VNPAY_TX_NOT_FOUND'; end if;

  if row_record.status <> 'pending' then
    return query select row_record.id, row_record.status, true;
    return;
  end if;
  if row_record.amount_vnd <> p_amount_vnd then raise exception 'VNPAY_AMOUNT_MISMATCH'; end if;

  if p_response_code = '00' then
    update public.transactions set
      status = 'completed', completed_at = now(), gateway_txn_ref = p_gateway_txn_ref,
      gateway_response_code = p_response_code, gateway_bank_code = p_bank_code,
      ipn_received_at = now(), ipn_raw = p_raw
    where transactions.id = row_record.id;
    return query select row_record.id, 'completed'::text, false;
  else
    update public.transactions set
      status = 'failed', failure_reason = 'VNPAY response code ' || p_response_code,
      gateway_txn_ref = p_gateway_txn_ref, gateway_response_code = p_response_code, gateway_bank_code = p_bank_code,
      ipn_received_at = now(), ipn_raw = p_raw
    where transactions.id = row_record.id;
    return query select row_record.id, 'failed'::text, false;
  end if;
end;
$$;
revoke all on function public.complete_donation_via_vnpay(text, text, text, text, numeric, jsonb) from public;
grant execute on function public.complete_donation_via_vnpay(text, text, text, text, numeric, jsonb) to service_role;

-- Ghi nhận IPN thành công cho nạp ví.
create or replace function public.complete_wallet_topup_via_vnpay(
  p_tx_ref text, p_gateway_txn_ref text, p_response_code text, p_bank_code text, p_amount_vnd numeric, p_raw jsonb
)
returns table (id uuid, status text, already_processed boolean)
language plpgsql security definer set search_path = '' as $$
declare
  row_record record;
begin
  perform set_config('app.gateway_ipn', 'on', true);

  select * into row_record from public.wallet_topups where tx_ref = p_tx_ref and payment_provider = 'vnpay' for update;
  if not found then raise exception 'VNPAY_TOPUP_NOT_FOUND'; end if;

  if row_record.status <> 'pending' then
    return query select row_record.id, row_record.status, true;
    return;
  end if;
  if row_record.amount_vnd <> p_amount_vnd then raise exception 'VNPAY_AMOUNT_MISMATCH'; end if;

  if p_response_code = '00' then
    update public.wallet_topups set
      status = 'completed', gateway_txn_ref = p_gateway_txn_ref, gateway_response_code = p_response_code,
      gateway_bank_code = p_bank_code, ipn_received_at = now(), ipn_raw = p_raw
    where wallet_topups.id = row_record.id;
    return query select row_record.id, 'completed'::text, false;
  else
    update public.wallet_topups set
      status = 'rejected', admin_note = 'VNPAY response code ' || p_response_code,
      gateway_txn_ref = p_gateway_txn_ref, gateway_response_code = p_response_code, gateway_bank_code = p_bank_code,
      ipn_received_at = now(), ipn_raw = p_raw
    where wallet_topups.id = row_record.id;
    return query select row_record.id, 'rejected'::text, false;
  end if;
end;
$$;
revoke all on function public.complete_wallet_topup_via_vnpay(text, text, text, text, numeric, jsonb) from public;
grant execute on function public.complete_wallet_topup_via_vnpay(text, text, text, text, numeric, jsonb) to service_role;

comment on function public.complete_donation_via_vnpay(text, text, text, text, numeric, jsonb) is
'Called only from the server-side VNPAY IPN route after signature verification. Never expose to anon/authenticated grants.';
comment on function public.complete_wallet_topup_via_vnpay(text, text, text, text, numeric, jsonb) is
'Called only from the server-side VNPAY IPN route after signature verification. Never expose to anon/authenticated grants.';
