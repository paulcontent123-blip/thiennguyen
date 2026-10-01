-- Let an authenticated wallet owner cancel only their own unpaid manual bank-transfer request.
-- Amount and payment instructions remain immutable; VNPAY orders cannot be cancelled here.

alter table public.wallet_topups
  drop constraint if exists wallet_topups_status_check;

alter table public.wallet_topups
  add constraint wallet_topups_status_check
  check (status in ('pending', 'completed', 'rejected', 'cancelled'));

create or replace function public.guard_wallet_topup_update()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  is_owner_cancellation boolean;
begin
  is_owner_cancellation :=
    auth.uid() is not null
    and auth.uid() = old.user_id
    and old.status = 'pending'
    and old.payment_provider = 'bank_transfer'
    and new.status = 'cancelled';

  if not public.is_admin()
    and coalesce(current_setting('app.gateway_ipn', true), '') <> 'on'
    and not is_owner_cancellation then
    raise exception 'Only Admin, verified gateway IPN, or the owner cancelling an unpaid manual top-up may update wallet top-ups';
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

  if is_owner_cancellation then
    if new.admin_note is distinct from 'Hủy bởi người dùng trước khi chuyển khoản'
      or new.processed_by is distinct from old.processed_by
      or new.completed_at is distinct from old.completed_at
      or new.gateway_txn_ref is distinct from old.gateway_txn_ref
      or new.gateway_response_code is distinct from old.gateway_response_code
      or new.gateway_bank_code is distinct from old.gateway_bank_code
      or new.ipn_received_at is distinct from old.ipn_received_at
      or new.ipn_raw is distinct from old.ipn_raw then
      raise exception 'WALLET_TOPUP_CANCEL_FIELDS_INVALID';
    end if;
    return new;
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

create or replace function public.cancel_wallet_topup(p_topup_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  update public.wallet_topups
  set status = 'cancelled',
      admin_note = 'Hủy bởi người dùng trước khi chuyển khoản'
  where id = p_topup_id
    and user_id = auth.uid()
    and status = 'pending'
    and payment_provider = 'bank_transfer';

  if not found then
    raise exception 'WALLET_TOPUP_NOT_CANCELLABLE';
  end if;
end;
$$;

revoke all on function public.cancel_wallet_topup(uuid) from public;
grant execute on function public.cancel_wallet_topup(uuid) to authenticated;

comment on function public.cancel_wallet_topup(uuid) is
'Owner-only cancellation for a pending manual bank-transfer wallet top-up. Use only before any payment is sent.';
